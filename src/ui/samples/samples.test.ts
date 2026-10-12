import { describe, expect, it } from "vitest";
import { detect } from "../../engine/detect";
import { restore } from "../../engine/restore";
import { scrub } from "../../engine/scrub";
import { SAMPLES } from "./index";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe.each(Object.entries(SAMPLES))("sample: %s", (_name, text) => {
  it("is about 150 to 250 words", () => {
    expect(words(text)).toBeGreaterThanOrEqual(150);
    expect(words(text)).toBeLessThanOrEqual(250);
  });

  it("has at least 6 different types found by the rules", () => {
    const types = new Set(detect(text).map((d) => d.type));
    expect(types.size, [...types].join(",")).toBeGreaterThanOrEqual(6);
  });

  it("scrubs and restores back to the original exactly", () => {
    const found = detect(text);
    const r = scrub(text, found);
    expect(r.text).not.toBe(text);
    for (const d of found) expect(r.text).not.toContain(d.value);
    expect(r.warnings).toEqual([]);
    const back = restore(r.text, r.mapping);
    expect(back.warnings).toEqual([]);
    expect(back.text).toBe(text);
  });

  it("uses only invented contact details", () => {
    for (const e of text.match(/[\w.+-]+@[\w.-]*\w/g) ?? []) expect(e).toMatch(/@(example\.com|ok\w+|[\w.]*example\.com)$/);
    for (const u of text.match(/https?:\/\/[^\s/]+/g) ?? []) expect(u).toMatch(/example\.com$/);
  });
});

it("the chat sample has an ALL CAPS name and a Hinglish line; the others have an ALL CAPS name", () => {
  expect(SAMPLES.chat).toMatch(/PRIYA NAIR/);
  expect(SAMPLES.chat).toMatch(/haan ji/);
  expect(SAMPLES.resumes).toMatch(/MEERA IYENGAR/);
  expect(SAMPLES.business).toMatch(/VIKRAM DESHMUKH/);
});

it("account numbers in the samples are read as bank accounts, not cards", () => {
  for (const text of Object.values(SAMPLES)) {
    for (const m of text.matchAll(/(?:A\/c No|Account No|account number)[: ]+(?:\w+ \w+ )?(\d{15})/g)) {
      const d = detect(text).find((x) => x.value === m[1]);
      expect(d?.type).toBe("BANK_ACCOUNT");
    }
  }
});
