import { expect, test } from "@playwright/test";
import { AADHAAR, EMAIL, NAME, PAN, PHONE, SAMPLE, scrub } from "./sample";

const HF = /^https:\/\/(huggingface\.co|us\.aws\.cdn\.hf\.co)\//;

// Test (b): after the text is entered, the page makes no network request at all.
test("no leaks: nothing is requested after text is entered", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on("console", (m) => consoleMessages.push(m.text()));
  await page.goto("/");
  // The model download is allowed, but only before any text is entered.
  await expect(page.locator("#notice-heading")).toHaveText("Name check ready", { timeout: 3 * 60_000 });

  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));

  const out = await scrub(page);
  expect(out).not.toContain(EMAIL);
  expect(out).not.toContain(PAN);
  expect(out).not.toContain(NAME);
  expect(requests, "requests made after text was entered").toEqual([]);
  expect(consoleMessages.filter((m) => m.includes("Refused to"))).toEqual([]);

  // Self-check, run after the real check so it cannot disturb it. Chromium stops a CSP-blocked fetch before it
  // reaches the network, so the request recorder never sees it: the console is what records a CSP block.
  // So we prove both recorders separately:
  // 1. the CSP blocks a forbidden host, and the console recorder saw the "Refused to" message;
  const outcome = await page.evaluate(() =>
    fetch("https://example.com/")
      .then(() => "allowed")
      .catch(() => "blocked"),
  );
  expect(outcome).toBe("blocked");
  await expect
    .poll(() => consoleMessages.some((m) => m.includes("Refused to") && m.includes("example.com")))
    .toBe(true);
  // 2. the request recorder does see an allowed (same-origin) request, so an empty list above means something.
  await page.evaluate(() => fetch("/recorder-probe").catch(() => undefined));
  await expect.poll(() => requests.some((r) => r.includes("/recorder-probe"))).toBe(true);
});

// Test (c): if the model cannot download, only rules run, and the page says so and blocks Copy.
test("fail-closed: rules-only result, notice, and Copy blocked until the tick-box", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.route(HF, (r) => r.abort());
  await page.goto("/");
  await expect(page.locator("#notice-heading")).toHaveText("Names NOT checked", { timeout: 60_000 });

  const out = await scrub(page);
  expect(out).not.toContain(EMAIL);
  expect(out).not.toContain(PAN);
  expect(out).not.toContain(PHONE);
  expect(out).not.toContain(AADHAAR);
  expect(out).toContain(NAME); // names are not checked, and the page must not pretend otherwise
  await expect(page.locator("#names-note")).toContainText("Names NOT checked");
  await expect(page.locator("#ack-row")).toBeVisible();

  await page.locator("#copy-scrubbed").click();
  await expect(page.locator("#copy-scrubbed-status")).toContainText("Not copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("");

  await page.locator("#ack").check();
  await page.locator("#copy-scrubbed").click();
  await expect(page.locator("#copy-scrubbed-status")).toHaveText("Copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(out);
  await context.close();
});

// Test (d): placeholders in a chatbot reply turn back into the real values.
test("restore: placeholders in a reply return the real values", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(HF, (r) => r.abort()); // rules are enough for this test
  await page.goto("/");
  const out = await scrub(page, SAMPLE);
  const token = (type: string) => out.match(new RegExp(`\\[${type}_\\d+\\]`))?.[0];
  const [email, phone, aadhaar, pan] = ["EMAIL", "PHONE", "AADHAAR", "PAN"].map(token);
  for (const t of [email, phone, aadhaar, pan]) expect(t).toBeTruthy();

  await page.locator("#reply").fill(`Thanks. Noted ${pan} and ${aadhaar}. We will write to ${email} and call ${phone?.toLowerCase()}.`);
  await page.locator("#restore-button").click();
  const restored = await page.locator("#restored").inputValue();
  for (const v of [PAN, AADHAAR, EMAIL, PHONE]) expect(restored).toContain(v);
  expect(restored).not.toMatch(/\[[A-Z_]+_\d+\]/);
  await context.close();
});
