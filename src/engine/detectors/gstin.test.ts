import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { gstin } from "./gstin";

/**
 * Valid GSTINs here are SELF-COMPUTED (plausible 14-char prefix + mod-36
 * check character), cross-checked by an independent implementation written
 * separately. Not confirmed against an official GSTN document.
 *   29AABCU9603R1ZJ, 27AAPFU0939F1ZV  (already in ../gstin.test.ts)
 *   07ABCDE1234F1Z2, 33AAACR4849R1ZS  (new)
 */
const found = (text: string) => detect(text, [gstin]);
const values = (text: string) => found(text).map((d) => d.value);

describe("GSTIN — should detect", () => {
  it("[self-computed] a bare GSTIN", () => {
    const d = found("29AABCU9603R1ZJ");
    expect(d.map((x) => x.value)).toEqual(["29AABCU9603R1ZJ"]);
    expect(d[0].confidence).toBe(0.95);
  });

  it("[self-computed] with a 'GSTIN' keyword boost", () => {
    expect(found("GSTIN: 27AAPFU0939F1ZV")[0].confidence).toBe(1);
  });

  it("[self-computed] lowercase, at lower confidence", () => {
    const d = found("33aaacr4849r1zs");
    expect(d.map((x) => x.value)).toEqual(["33aaacr4849r1zs"]);
    expect(d[0].confidence).toBe(0.85);
  });

  it("[self-computed] another state code", () => {
    expect(values("seller 07ABCDE1234F1Z2")).toEqual(["07ABCDE1234F1Z2"]);
  });

  it("[self-computed] followed by a full stop", () => {
    expect(values("gst no 33AAACR4849R1ZS.")).toEqual(["33AAACR4849R1ZS"]);
  });
});

describe("GSTIN — should NOT detect", () => {
  it("a wrong check character", () => {
    expect(values("29AABCU9603R1ZX")).toEqual([]);
  });

  it("14 or 16 characters", () => {
    expect(values("29AABCU9603R1Z")).toEqual([]);
    expect(values("29AABCU9603R1ZJK")).toEqual([]);
  });

  it("glued to a letter in front", () => {
    expect(values("X29AABCU9603R1ZJ")).toEqual([]);
  });

  it("missing the fixed Z", () => {
    expect(values("27AAPFU0939F1YV")).toEqual([]);
  });

  it("a random 15-character code", () => {
    expect(values("AB1234567890123")).toEqual([]);
  });

  it("a bare PAN", () => {
    expect(values("ABCDE1234F")).toEqual([]);
  });
});
