import { describe, expect, it } from "vitest";
import { hasNearbyKeyword, makeCandidate } from "./context";

describe("hasNearbyKeyword", () => {
  const text = "My Aadhaar no is 2341 2341 2346 thanks";
  const start = text.indexOf("2341");
  const end = start + "2341 2341 2346".length;

  it("finds a keyword shortly before the match", () => {
    expect(hasNearbyKeyword(text, start, end, ["aadhaar"])).toBe(true);
  });

  it("ignores case", () => {
    expect(hasNearbyKeyword("AADHAAR: 1", 9, 10, ["aadhaar"])).toBe(true);
  });

  it("only matches whole words", () => {
    // "pan" inside "company" must not count
    expect(hasNearbyKeyword("company ABCDE1234F", 8, 18, ["pan"])).toBe(false);
  });

  it("ignores keywords that are far away", () => {
    const far = "PAN" + " ".repeat(80) + "ABCDE1234F";
    expect(hasNearbyKeyword(far, 83, 93, ["pan"])).toBe(false);
  });

  it("finds a keyword shortly after the match", () => {
    expect(hasNearbyKeyword("ABCDE1234F is my PAN", 0, 10, ["pan"])).toBe(true);
  });

  it("matches multi-word keywords with flexible spacing", () => {
    expect(hasNearbyKeyword("Account  No: 1", 13, 14, ["account no"])).toBe(true);
  });
});

describe("makeCandidate", () => {
  it("raises confidence when a keyword is nearby, capped at 1", () => {
    const c = makeCandidate("PAN ABCDE1234F", "PAN", 4, 14, 0.9, ["pan"], false);
    expect(c.confidence).toBe(1);
    expect(c.contextHit).toBe(true);
    expect(c.value).toBe("ABCDE1234F");
  });

  it("keeps base confidence without a keyword", () => {
    const c = makeCandidate("xx ABCDE1234F", "PAN", 3, 13, 0.8, ["pan"], false);
    expect(c.confidence).toBe(0.8);
    expect(c.contextHit).toBe(false);
  });
});
