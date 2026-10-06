import { describe, expect, it } from "vitest";
import { isValidAadhaar } from "./verhoeff";

/**
 * Test vectors.
 *
 * Tables (d, p, inv) are the published Verhoeff (1969) tables from
 * https://en.wikipedia.org/wiki/Verhoeff_algorithm — this is where the
 * implementation in verhoeff.ts comes from.
 *
 * The three "valid" 12-digit numbers below are self-computed: we took an
 * arbitrary 11-digit base, ran it through verhoeffCheckDigit() to get a
 * check digit, and independently re-verified by hand-tracing the checksum
 * algorithm against the tables (see the "hand trace" log kept in the task
 * notes) before trusting the result here. They are not real Aadhaar numbers
 * and are not claimed to be numbers UIDAI has issued or published — they are
 * only arithmetically valid under the Verhoeff checksum.
 */
describe("isValidAadhaar", () => {
  it("accepts a self-computed valid 12-digit number (base 23412341234)", () => {
    expect(isValidAadhaar("234123412346")).toBe(true);
  });

  it("accepts a second self-computed valid 12-digit number (base 99988877766)", () => {
    expect(isValidAadhaar("999888777669")).toBe(true);
  });

  it("accepts a third self-computed valid 12-digit number (base 12345678901)", () => {
    expect(isValidAadhaar("123456789010")).toBe(true);
  });

  it("rejects the same number with a wrong check digit", () => {
    expect(isValidAadhaar("234123412345")).toBe(false);
  });

  it("rejects a single altered interior digit", () => {
    // 234123412346 with the 5th digit changed from 2 to 3
    expect(isValidAadhaar("234133412346")).toBe(false);
  });

  it("rejects a transposition of two adjacent digits (Verhoeff's key property)", () => {
    // 234123412346 with digits at positions 0 and 1 swapped: "324123412346"
    expect(isValidAadhaar("324123412346")).toBe(false);
  });

  it("rejects strings that are not exactly 12 digits", () => {
    expect(isValidAadhaar("23412341234")).toBe(false); // 11 digits
    expect(isValidAadhaar("2341234123466")).toBe(false); // 13 digits
    expect(isValidAadhaar("")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidAadhaar("23412341234a")).toBe(false);
    expect(isValidAadhaar("2341-2341-234")).toBe(false);
  });

  it("rejects all-zero input", () => {
    // Verified by direct calculation: checksum("000000000000") = 2, not 0.
    expect(isValidAadhaar("000000000000")).toBe(false);
  });
});
