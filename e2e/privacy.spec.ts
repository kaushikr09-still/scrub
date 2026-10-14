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

// Examples: Load example fills the box, Scrub masks it (names too, with the model), and nothing is requested.
test("example: chat log loads, scrubs with the name model, and makes no requests", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#notice-heading")).toHaveText("Name check ready", { timeout: 3 * 60_000 });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));

  await page.getByLabel("Chat logs").check();
  await page.locator("#load-example").click();
  const example = await page.locator("#input").inputValue();
  expect(example).toContain("PRIYA NAIR");
  expect(example).toContain("haan ji");

  await page.locator("#scrub-button").click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>("#scrubbed")!.value !== "");
  const out = await page.locator("#scrubbed").inputValue();
  for (const secret of ["ravi.nair@example.com", "ABCDE1234F", "2345 6789 0124", "4242 4242 4242 4242"]) {
    expect(out).not.toContain(secret);
  }
  // Names in lowercase chat are a known limit (SPEC: Limits), so only the rule-based details are asserted here.
  await expect(page.locator("#review")).toBeVisible();

  // An ALL CAPS name in ordinary English is masked by the name model (via the title-case copy).
  await page.getByLabel("Business emails").check();
  await page.locator("#load-example").click();
  await page.locator("#scrub-button").click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>("#scrubbed")!.value.includes("[EMAIL_1]"));
  const business = await page.locator("#scrubbed").inputValue();
  expect(business).not.toContain("VIKRAM DESHMUKH");
  expect(business).toMatch(/\[PERSON_\d+\]/);
  expect(requests, "requests made after the example was loaded").toEqual([]);
});

// First-visit layout: the ready notice is short, with the rules list and the category ticks in closed fold-outs.
test("first visit: ready notice is short and the fold-outs start closed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#notice-heading")).toHaveText("Name check ready", { timeout: 3 * 60_000 });
  await expect(page.locator("#model-status")).toContainText("checked when you press Scrub");
  await expect(page.locator("#model-status strong")).toHaveText("Read your text yourself before you share it.");
  await expect(page.locator("#model-status")).not.toContainText("The name model is ready");
  await expect(page.locator("#rules-fold")).toBeVisible();
  await expect(page.locator("#rules-fold")).not.toHaveAttribute("open", "");
  await expect(page.locator("#categories-fold")).not.toHaveAttribute("open", "");
  await expect(page.locator("#rules-intro")).toBeHidden();
  await page.getByText("What does Scrub look for?").click();
  await expect(page.locator("#rules-fold")).toContainText("IP addresses");
  await expect(page.getByText("New here? Press Load example, then Scrub. The example text is invented.")).toBeVisible();
});

// The review checklist: untick leaves a value plain everywhere, tick masks it again, restore still works.
test("review checklist: untick and tick update the output, restore still works", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(HF, (r) => r.abort()); // rules are enough for this test
  await page.goto("/");
  await page.getByLabel("Business emails").check();
  await page.locator("#load-example").click();
  await page.locator("#scrub-button").click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>("#scrubbed")!.value !== "");
  const scrubbed = page.locator("#scrubbed");
  const email = "accounts@example.com";
  expect(await scrubbed.inputValue()).not.toContain(email);

  const row = page.getByLabel(new RegExp(`EMAIL ${email}`));
  await expect(row).toBeChecked();
  await row.uncheck();
  expect(await scrubbed.inputValue()).toContain(email);
  await expect(page.locator("#review-list li.plain")).toHaveCount(1);
  await row.check();
  expect(await scrubbed.inputValue()).not.toContain(email);

  // a category tick-box works too, and the other values still restore
  // (the tick-boxes sit in a fold-out that is closed by default)
  await expect(page.locator("#cat-URL")).toBeHidden();
  await page.getByText("Advanced: choose what to mask").click();
  await page.locator("#cat-URL").uncheck();
  expect(await scrubbed.inputValue()).toContain("https://portal.example.com/orders/2291");
  const pan = (await scrubbed.inputValue()).match(/\[PAN_\d+\]/)![0];
  await page.locator("#reply").fill(`Noted ${pan}.`);
  await page.locator("#restore-button").click();
  expect(await page.locator("#restored").inputValue()).toBe("Noted ABCDE1234F.");
  await context.close();
});
