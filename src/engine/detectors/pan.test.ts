import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { pan } from "./pan";

// PAN has no checksum; these are made-up strings of the right shape.
const found = (text: string) => detect(text, [pan]);
const values = (text: string) => found(text).map((d) => d.value);

describe("PAN — should detect", () => {
  it("a bare PAN", () => {
    const d = found("ABCDE1234F");
    expect(d.map((x) => x.value)).toEqual(["ABCDE1234F"]);
    expect(d[0].confidence).toBe(0.8);
  });

  it("with a 'PAN' keyword boost", () => {
    expect(found("PAN: AAPFU0939F")[0].confidence).toBe(0.95);
  });

  it("lowercase, at lower confidence", () => {
    const d = found("abcde1234f");
    expect(d.map((x) => x.value)).toEqual(["abcde1234f"]);
    expect(d[0].confidence).toBe(0.7);
  });

  it("in a sentence ending with a full stop", () => {
    expect(values("my pan is BNZPM2501F.")).toEqual(["BNZPM2501F"]);
  });

  it("in brackets", () => {
    expect(values("(AAACR4849R)")).toEqual(["AAACR4849R"]);
  });

  it("after a dash in ALL CAPS text", () => {
    expect(values("PAN NO-ABCPE1234K")).toEqual(["ABCPE1234K"]);
  });
});

describe("PAN — should NOT detect", () => {
  it("only 4 letters", () => {
    expect(values("ABCD1234F")).toEqual([]);
  });

  it("no final letter", () => {
    expect(values("ABCDE12345")).toEqual([]);
  });

  it("the PAN inside a GSTIN", () => {
    expect(values("29AABCU9603R1ZJ")).toEqual([]);
  });

  it("glued to more letters", () => {
    expect(values("XABCDE1234F")).toEqual([]);
    expect(values("ABCDE1234FG")).toEqual([]);
  });

  it("an order ID", () => {
    expect(values("ORD-1234-X")).toEqual([]);
  });

  it("an IFSC code", () => {
    expect(values("SBIN0001234")).toEqual([]);
  });
});
