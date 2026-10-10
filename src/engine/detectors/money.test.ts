import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { money } from "./money";

const found = (text: string) => detect(text, [money]);
const values = (text: string) => found(text).map((d) => d.value);

describe("MONEY — should detect", () => {
  it("₹ with Indian grouping", () => {
    expect(values("₹1,00,000")).toEqual(["₹1,00,000"]);
    expect(values("₹ 1,00,00,000.")).toEqual(["₹ 1,00,00,000"]);
  });

  it("Rs., Rs and INR before the number", () => {
    expect(values("Rs. 5,000/-")).toEqual(["Rs. 5,000/-"]);
    expect(values("Rs 250")).toEqual(["Rs 250"]);
    expect(values("INR 1,200.50")).toEqual(["INR 1,200.50"]);
  });

  it("currency after the number", () => {
    expect(values("paid 5000 INR")).toEqual(["5000 INR"]);
    expect(values("5,000 Rs")).toEqual(["5,000 Rs"]);
    expect(values("500 rupees")).toEqual(["500 rupees"]);
  });

  it("Western grouping and decimals", () => {
    expect(values("₹100,000.75")).toEqual(["₹100,000.75"]);
  });

  it("lakh, crore and LPA on their own", () => {
    expect(values("expecting 12 LPA")).toEqual(["12 LPA"]);
    expect(values("5 lakh")).toEqual(["5 lakh"]);
    expect(values("2.5 lakhs")).toEqual(["2.5 lakhs"]);
    expect(values("3 lac")).toEqual(["3 lac"]);
    expect(values("1.2 crore")).toEqual(["1.2 crore"]);
    expect(values("10 crores")).toEqual(["10 crores"]);
  });

  it("L, Cr, K and M with a currency mark", () => {
    expect(values("₹12L")).toEqual(["₹12L"]);
    expect(values("Rs 2 Cr")).toEqual(["Rs 2 Cr"]);
    expect(values("₹50K")).toEqual(["₹50K"]);
    expect(values("INR 1.5M")).toEqual(["INR 1.5M"]);
    expect(values("₹12 LPA")).toEqual(["₹12 LPA"]);
  });

  it("L, Cr, K and M with a nearby money word", () => {
    expect(values("CTC 12L")).toEqual(["12L"]);
    expect(values("salary: 50K per month")).toEqual(["50K"]);
    expect(values("package of 1.5 Cr")).toEqual(["1.5 Cr"]);
  });

  it("a money word raises confidence", () => {
    expect(found("₹500")[0].confidence).toBe(0.85);
    expect(found("salary ₹500")[0].confidence).toBe(1);
    expect(found("5 lakh")[0].confidence).toBe(0.7);
  });
});

describe("MONEY — should NOT detect", () => {
  it("a bare number", () => {
    expect(values("1,00,000")).toEqual([]);
    expect(values("we have 500 users")).toEqual([]);
  });

  it("K, M, L or Cr without a currency mark or money word", () => {
    expect(values("10K steps")).toEqual([]);
    expect(values("5M users")).toEqual([]);
    expect(values("size 12L bottle")).toEqual([]);
    expect(values("2 Cr")).toEqual([]);
  });

  it("other currencies", () => {
    expect(values("$500")).toEqual([]);
    expect(values("USD 500")).toEqual([]);
  });

  it("Rs inside a word", () => {
    expect(values("Hours 500")).toEqual([]);
    expect(values("ERs500")).toEqual([]);
  });

  it("a unit glued to more letters", () => {
    expect(values("12 Lakhimpur")).toEqual([]);
    expect(values("₹5Kg")).toEqual([]);
  });

  it("a currency mark with no number", () => {
    expect(values("price in INR only")).toEqual([]);
  });
});
