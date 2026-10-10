import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { bankAccount } from "./bankAccount";

const found = (text: string) => detect(text, [bankAccount]);
const values = (text: string) => found(text).map((d) => d.value);

describe("BANK_ACCOUNT — should detect", () => {
  it("after 'A/c'", () => {
    const d = found("A/c 123456789012");
    expect(d.map((x) => x.value)).toEqual(["123456789012"]);
    expect(d[0].confidence).toBe(0.8);
  });

  it("after 'Account No' and 'Account Number'", () => {
    expect(values("Account No: 50100123456789")).toEqual(["50100123456789"]);
    expect(values("Account Number 001234567")).toEqual(["001234567"]);
  });

  it("after 'Acct'", () => {
    expect(values("Acct #987654321098")).toEqual(["987654321098"]);
  });

  it("near 'Bank' and 'IFSC'", () => {
    expect(values("HDFC Bank 50100123456789")).toEqual(["50100123456789"]);
    expect(values("123456789012345678, IFSC HDFC0001234")).toEqual(["123456789012345678"]);
  });

  it("with spaces between groups", () => {
    expect(values("A/c no. 1234 5678 9012")).toEqual(["1234 5678 9012"]);
  });
});

describe("BANK_ACCOUNT — should NOT detect", () => {
  it("a bare long number", () => {
    expect(values("123456789012")).toEqual([]);
  });

  it("8 digits", () => {
    expect(values("A/c 12345678")).toEqual([]);
  });

  it("19 digits", () => {
    expect(values("A/c 1234567890123456789")).toEqual([]);
  });

  it("glued to letters", () => {
    expect(values("A/c ORD123456789012")).toEqual([]);
  });

  it("'account' alone is not enough", () => {
    expect(values("my account 123456789012")).toEqual([]);
  });

  it("the keyword is far away", () => {
    expect(values("Bank" + " ".repeat(60) + "123456789012")).toEqual([]);
  });
});
