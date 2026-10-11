import type { Page } from "@playwright/test";

export const NAME = "Priya Sharma";
export const EMAIL = "priya.sharma@example.com";
export const PHONE = "+91 98765 43210";
export const AADHAAR = "2345 6789 0124"; // Verhoeff-valid
export const PAN = "ABCDE1234F";

export const SAMPLE = `Hello, my name is ${NAME}. Email me at ${EMAIL} or call ${PHONE}. Aadhaar: ${AADHAAR}. PAN: ${PAN}.`;

export async function scrub(page: Page, text = SAMPLE): Promise<string> {
  await page.locator("#input").fill(text);
  await page.locator("#scrub-button").click();
  await page.waitForFunction(() => {
    const out = document.querySelector<HTMLTextAreaElement>("#scrubbed");
    const btn = document.querySelector<HTMLButtonElement>("#scrub-button");
    return !!out && out.value !== "" && !btn?.disabled;
  });
  return page.locator("#scrubbed").inputValue();
}
