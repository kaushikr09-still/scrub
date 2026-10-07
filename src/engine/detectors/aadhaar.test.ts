import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { aadhaar } from "./aadhaar";

/**
 * All "valid" numbers here are SELF-COMPUTED: an arbitrary 11-digit base plus
 * a Verhoeff check digit. Each was computed by an independent implementation
 * (arithmetic dihedral-group formulation, written separately, not importing
 * repo code) and is confirmed here by the repo's table-based isValidAadhaar.
 * They are not real Aadhaar numbers.
 *   234123412346, 999888777669  (already in verhoeff.test.ts)
 *   456789123451, 567812345678, 876543210988, 919876543216  (new)
 */
const found = (text: string) => detect(text, [aadhaar]);
const values = (text: string) => found(text).map((d) => d.value);

describe("AADHAAR — should detect", () => {
  it("[self-computed] in groups of 4", () => {
    expect(values("no 2341 2341 2346 ok")).toEqual(["2341 2341 2346"]);
  });

  it("[self-computed] unspaced", () => {
    expect(values("234123412346")).toEqual(["234123412346"]);
  });

  it("[self-computed] with an 'Aadhaar' keyword boost", () => {
    const d = found("Aadhaar: 9998 8877 7669");
    expect(d.map((x) => x.value)).toEqual(["9998 8877 7669"]);
    expect(d[0].confidence).toBe(1);
  });

  it("[self-computed] with dashes", () => {
    expect(values("4567-8912-3451")).toEqual(["4567-8912-3451"]);
  });

  it("[self-computed] fully spaced-out", () => {
    expect(values("5 6 7 8 1 2 3 4 5 6 7 8")).toEqual(["5 6 7 8 1 2 3 4 5 6 7 8"]);
  });

  it("[self-computed] ALL CAPS keyword and common misspelling", () => {
    expect(found("AADHAR NO 876543210988")[0].confidence).toBe(1);
  });
});

describe("AADHAAR — should NOT detect", () => {
  it("a wrong check digit", () => {
    expect(values("234123412345")).toEqual([]);
  });

  it("Verhoeff-valid but starting with 1 (first digit must be 2-9)", () => {
    expect(values("123456789010")).toEqual([]);
    expect(values("1111 2222 3333")).toEqual([]);
  });

  it("starting with 0", () => {
    expect(values("0234 1234 1234")).toEqual([]);
  });

  it("an order-ID-like 12-digit number", () => {
    expect(values("order 4512 3398 7710")).toEqual([]);
  });

  it("13 or 11 digits", () => {
    expect(values("2341234123466")).toEqual([]);
    expect(values("23412341234")).toEqual([]);
  });

  it("glued to letters", () => {
    expect(values("ORD234123412346")).toEqual([]);
  });

  it("a dotted version-like number", () => {
    expect(values("2341.2341.2346")).toEqual([]);
  });
});
