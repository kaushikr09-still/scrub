import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Test (a): the page response carries every header listed in vercel.json.
test("page response has the headers from vercel.json", async ({ request }) => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const expected: { key: string; value: string }[] = config.headers.flatMap((b: { headers: never[] }) => b.headers);
  expect(expected.map((h) => h.key)).toContain("Content-Security-Policy");
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  for (const { key, value } of expected) expect(res.headers()[key.toLowerCase()], key).toBe(value);
});
