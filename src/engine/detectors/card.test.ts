import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { card } from "./card";

/**
 * 4242424242424242 and 4000056655665556 are Stripe's published test cards
 * (already cited in ../luhn.test.ts).
 * SELF-COMPUTED (base + Luhn check digit, computed by an independent
 * implementation written separately and confirmed here by isValidLuhn):
 *   9000000000001 (13), 378282246310005 (15), 6212345678901232 (16),
 *   9876543210123452 (16), 6070123456789012344 (19)
 */
const found = (text: string) => detect(text, [card]);
const values = (text: string) => found(text).map((d) => d.value);

describe("CARD — should detect", () => {
  it("[published] in groups of 4", () => {
    const d = found("4242 4242 4242 4242");
    expect(d.map((x) => x.value)).toEqual(["4242 4242 4242 4242"]);
    expect(d[0].confidence).toBe(0.85);
  });

  it("[published] unspaced", () => {
    expect(values("4000056655665556")).toEqual(["4000056655665556"]);
  });

  it("[self-computed] with dashes and a 'card' keyword boost", () => {
    const d = found("Card no: 6212-3456-7890-1232");
    expect(d.map((x) => x.value)).toEqual(["6212-3456-7890-1232"]);
    expect(d[0].confidence).toBe(1);
  });

  it("[self-computed] 13 digits", () => {
    expect(values("9000000000001")).toEqual(["9000000000001"]);
  });

  it("[self-computed] 15 digits in 4-6-5 grouping", () => {
    expect(values("3782 822463 10005")).toEqual(["3782 822463 10005"]);
  });

  it("[self-computed] 19 digits", () => {
    expect(values("6070123456789012344")).toEqual(["6070123456789012344"]);
  });

  it("[self-computed] DEBIT CARD in caps boosts", () => {
    expect(found("DEBIT CARD 9876543210123452")[0].confidence).toBe(1);
  });
});

describe("CARD — should NOT detect", () => {
  it("a Luhn failure", () => {
    expect(values("4242 4242 4242 4241")).toEqual([]);
  });

  it("an order ID of 16 digits that fails Luhn", () => {
    expect(values("order 1234567890123456")).toEqual([]);
  });

  it("12 digits", () => {
    expect(values("424242424242")).toEqual([]);
  });

  it("20 digits unspaced", () => {
    expect(values("42424242424242424242")).toEqual([]);
  });

  it("glued to letters", () => {
    expect(values("CARD4242424242424242")).toEqual([]);
  });

  it("dotted like a version number", () => {
    expect(values("4242.4242.4242.4242")).toEqual([]);
  });

  it("13 digits failing Luhn", () => {
    expect(values("4512339877101")).toEqual([]);
  });
});
