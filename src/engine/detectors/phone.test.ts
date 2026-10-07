import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { phone } from "./phone";

const found = (text: string) => detect(text, [phone]);
const values = (text: string) => found(text).map((d) => d.value);

describe("PHONE — should detect", () => {
  it("10 digits starting 9", () => {
    expect(values("Call 9876543210")).toEqual(["9876543210"]);
  });

  it("10 digits followed by a full stop", () => {
    expect(values("Call 9876543210.")).toEqual(["9876543210"]);
  });

  it("+91 with spaces (whole thing, including +91)", () => {
    expect(values("ph +91 98765 43210")).toEqual(["+91 98765 43210"]);
  });

  it("+91 with dashes", () => {
    expect(values("+91-98765-43210")).toEqual(["+91-98765-43210"]);
  });

  it("91 then a space", () => {
    expect(values("91 98765 43210")).toEqual(["91 98765 43210"]);
  });

  it("91 directly followed by the 10-digit mobile (12 digits)", () => {
    expect(values("919876543210")).toEqual(["919876543210"]);
  });

  it("leading 0", () => {
    expect(values("09876543210")).toEqual(["09876543210"]);
    expect(values("0 98765 43210")).toEqual(["0 98765 43210"]);
  });

  it("fully spaced-out digits", () => {
    expect(values("9 8 7 6 5 4 3 2 1 0")).toEqual(["9 8 7 6 5 4 3 2 1 0"]);
  });

  it("starting with 6, with a keyword boost", () => {
    const d = found("Mobile: 6123456789");
    expect(d.map((x) => x.value)).toEqual(["6123456789"]);
    expect(d[0].confidence).toBe(0.85);
  });

  it("MOBILE in caps still boosts", () => {
    expect(found("MOBILE NO 7012345678")[0].confidence).toBe(0.85);
  });
});

describe("PHONE — should NOT detect", () => {
  it("random 10-digit numbers starting 1-5", () => {
    expect(values("1234567890")).toEqual([]);
    expect(values("2987654321")).toEqual([]);
    expect(values("3987654321")).toEqual([]);
    expect(values("4123456789")).toEqual([]);
    expect(values("5876543210")).toEqual([]);
  });

  it("an order ID glued to letters", () => {
    expect(values("Order ORD9876543210")).toEqual([]);
  });

  it("an order ID with a dashed date prefix", () => {
    expect(values("ref 2024-9876543210")).toEqual([]);
  });

  it("a version number", () => {
    expect(values("version 9.8765.43210")).toEqual([]);
    expect(values("v9876543210.2")).toEqual([]);
  });

  it("11 digits not starting with 0", () => {
    expect(values("98765432101")).toEqual([]);
  });

  it("9 digits", () => {
    expect(values("987654321")).toEqual([]);
  });

  it("10 digits starting with 0", () => {
    expect(values("0123456789")).toEqual([]);
  });

  it("an invoice number", () => {
    expect(values("Invoice INV-20241009-001")).toEqual([]);
  });

  it("the number part of a UPI handle", () => {
    expect(values("9876543210@ybl")).toEqual([]);
  });

  it("12 digits starting 91 whose mobile part starts 1-5", () => {
    expect(values("911234567890")).toEqual([]);
  });
});
