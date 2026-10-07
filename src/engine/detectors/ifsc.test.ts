import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { ifsc } from "./ifsc";

// IFSC has no checksum; these are strings of the right shape.
const found = (text: string) => detect(text, [ifsc]);
const values = (text: string) => found(text).map((d) => d.value);

describe("IFSC — should detect", () => {
  it("a bare code", () => {
    const d = found("SBIN0001234");
    expect(d.map((x) => x.value)).toEqual(["SBIN0001234"]);
    expect(d[0].confidence).toBe(0.75);
  });

  it("with an 'IFSC' keyword boost and letters in the branch part", () => {
    expect(found("IFSC: HDFC0ABC123")[0].confidence).toBe(0.9);
  });

  it("lowercase, at lower confidence", () => {
    const d = found("icic0000456");
    expect(d.map((x) => x.value)).toEqual(["icic0000456"]);
    expect(d[0].confidence).toBe(0.65);
  });

  it("followed by a full stop", () => {
    expect(values("Branch code UTIB0SBI001.")).toEqual(["UTIB0SBI001"]);
  });

  it("in brackets", () => {
    expect(values("(KKBK0000958)")).toEqual(["KKBK0000958"]);
  });
});

describe("IFSC — should NOT detect", () => {
  it("5th character not zero", () => {
    expect(values("SBIN1001234")).toEqual([]);
  });

  it("letter O instead of zero", () => {
    expect(values("SBINO001234")).toEqual([]);
  });

  it("10 or 12 characters", () => {
    expect(values("SBIN000123")).toEqual([]);
    expect(values("SBIN00012345")).toEqual([]);
  });

  it("only 3 letters", () => {
    expect(values("SBI0001234")).toEqual([]);
  });

  it("a PAN", () => {
    expect(values("ABCDE1234F")).toEqual([]);
  });

  it("an order ID", () => {
    expect(values("ORD-0001234")).toEqual([]);
  });
});
