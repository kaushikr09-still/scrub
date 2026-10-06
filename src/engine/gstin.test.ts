import { describe, expect, it } from "vitest";
import { gstinCheckDigit, isValidGstin } from "./gstin";

/**
 * Test vectors.
 *
 * IMPORTANT — the two "valid" GSTIN strings below are UNVERIFIED against any
 * authoritative GSTN source. They were produced by running our own
 * gstinCheckDigit() implementation of the published mod-36 check-character
 * algorithm over a plausible-looking 14-character prefix (state code + PAN
 * shape + entity code + "Z"). They prove the code is internally consistent
 * (the function that computes a check digit agrees with the function that
 * verifies one) but do NOT prove the algorithm itself matches the real GSTN
 * specification. Please verify these independently — see chat.
 *
 * The "invalid" cases below don't depend on that: a corrupted check
 * character, wrong length, or lowercase input is wrong regardless of
 * whether the checksum algorithm itself is correct.
 */
describe("gstinCheckDigit", () => {
  it("is self-consistent: isValidGstin accepts what gstinCheckDigit computes", () => {
    const prefix = "29AABCU9603R1Z";
    const check = gstinCheckDigit(prefix);
    expect(isValidGstin(prefix + check)).toBe(true);
  });
});

describe("isValidGstin", () => {
  it("[UNVERIFIED] accepts a self-generated example GSTIN (state 29 prefix)", () => {
    expect(isValidGstin("29AABCU9603R1ZJ")).toBe(true);
  });

  it("[UNVERIFIED] accepts a second self-generated example GSTIN (state 27 prefix)", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });

  it("rejects a GSTIN with a corrupted check character", () => {
    expect(isValidGstin("29AABCU9603R1ZX")).toBe(false); // J -> X
  });

  it("rejects a GSTIN with a corrupted body digit", () => {
    expect(isValidGstin("27AAPFU0938F1ZV")).toBe(false); // 9939 -> 9938, check char now wrong
  });

  it("rejects wrong length", () => {
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false); // 14 chars
    expect(isValidGstin("27AAPFU0939F1ZVV")).toBe(false); // 16 chars
    expect(isValidGstin("")).toBe(false);
  });

  it("rejects lowercase input", () => {
    expect(isValidGstin("27aapfu0939f1zv")).toBe(false);
  });

  it("rejects a string that doesn't follow the GSTIN shape", () => {
    expect(isValidGstin("AB1234567890123")).toBe(false); // state code must be digits
    expect(isValidGstin("271APFU0939F1ZV")).toBe(false); // PAN block must start with 5 letters
  });

  it("rejects a GSTIN missing the fixed 'Z' in position 14", () => {
    expect(isValidGstin("27AAPFU0939F1YV")).toBe(false);
  });
});
