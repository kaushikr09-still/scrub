import { describe, expect, it } from "vitest";
import { detect } from "./detect";

const summary = (text: string) => detect(text).map((d) => `${d.type}:${d.value}`);

describe("detect — shape", () => {
  it("returns nothing for empty text", () => {
    expect(detect("")).toEqual([]);
  });

  it("returns {type, start, end, value, confidence} with value = text slice", () => {
    const text = "PAN ABCDE1234F";
    const [d] = detect(text);
    expect(d).toEqual({ type: "PAN", start: 4, end: 14, value: "ABCDE1234F", confidence: 0.95 });
    expect(Object.keys(d).sort()).toEqual(["confidence", "end", "start", "type", "value"]);
    expect(text.slice(d.start, d.end)).toBe(d.value);
  });

  it("finds several types in one text, in reading order", () => {
    const text =
      "Hi, I'm Priya. Email priya@gmail.com, mobile +91 98765 43210, " +
      "PAN ABCDE1234F, UPI priya@okaxis, IFSC SBIN0001234.";
    expect(summary(text)).toEqual([
      "EMAIL:priya@gmail.com",
      "PHONE:+91 98765 43210",
      "PAN:ABCDE1234F",
      "UPI:priya@okaxis",
      "IFSC:SBIN0001234",
    ]);
  });

  it("keeps low-confidence detections (no cut-off)", () => {
    expect(summary("look at google dot com")).toEqual(["EMAIL:look at google dot com"]);
  });
});

describe("detect — collisions", () => {
  it("[published] a Luhn-valid card gives one CARD and no PHONE", () => {
    expect(summary("4242 4242 4242 4242")).toEqual(["CARD:4242 4242 4242 4242"]);
  });

  it("[self-computed] a card starting 9876543210 gives one CARD and no PHONE", () => {
    expect(summary("9876543210123452")).toEqual(["CARD:9876543210123452"]);
    expect(summary("9876 5432 1012 3452")).toEqual(["CARD:9876 5432 1012 3452"]);
    // grouped so that the first two groups look exactly like a phone number
    expect(summary("98765 43210 12345 2")).toEqual(["CARD:98765 43210 12345 2"]);
  });

  it("[self-computed] a Verhoeff-valid Aadhaar starting with 9 gives one AADHAAR and no PHONE", () => {
    expect(summary("999888777669")).toEqual(["AADHAAR:999888777669"]);
    expect(summary("9998 8877 7669")).toEqual(["AADHAAR:9998 8877 7669"]);
  });

  it("919876543210 (not Verhoeff-valid) gives a PHONE", () => {
    expect(summary("919876543210")).toEqual(["PHONE:919876543210"]);
  });

  it("[self-computed] 919876543216 is Verhoeff-valid AND phone-shaped: checksum wins, AADHAAR", () => {
    expect(summary("919876543216")).toEqual(["AADHAAR:919876543216"]);
  });

  it("a GSTIN gives one GSTIN, not a PAN inside it", () => {
    expect(summary("GSTIN 29AABCU9603R1ZJ")).toEqual(["GSTIN:29AABCU9603R1ZJ"]);
  });

  it("a phone-number UPI handle gives one UPI and no PHONE", () => {
    expect(summary("9876543210@ybl")).toEqual(["UPI:9876543210@ybl"]);
  });

  it("a phone-number email gives one EMAIL", () => {
    expect(summary("9876543210@gmail.com")).toEqual(["EMAIL:9876543210@gmail.com"]);
  });

  it("'name@gmail dot com' gives one EMAIL, not a UPI", () => {
    expect(summary("name@gmail dot com")).toEqual(["EMAIL:name@gmail dot com"]);
  });

  it("random 10-digit numbers starting 1-5 give nothing", () => {
    expect(summary("ids 1234567890 2345678901 3456789012 4567890123 5678901234")).toEqual([]);
  });
});

describe("detect — collisions (Tier 1 part 2)", () => {
  it("₹1,00,00,000 gives one MONEY and no PHONE", () => {
    expect(summary("₹1,00,00,000")).toEqual(["MONEY:₹1,00,00,000"]);
  });

  it("12-05-2024 gives DATE and no PHONE", () => {
    expect(summary("12-05-2024")).toEqual(["DATE:12-05-2024"]);
  });

  it("a 6-digit order ID with no context gives no PIN", () => {
    expect(summary("Order 482913 shipped")).toEqual([]);
  });

  it("a 10-digit account number with 'A/c' gives BANK_ACCOUNT, not PHONE", () => {
    expect(summary("A/c 9876543210")).toEqual(["BANK_ACCOUNT:9876543210"]);
  });

  it("the same 10 digits without any context give PHONE", () => {
    expect(summary("9876543210")).toEqual(["PHONE:9876543210"]);
  });

  it("a bare 12-digit number without a valid checksum gives no AADHAAR and no BANK_ACCOUNT", () => {
    expect(summary("123456789012")).toEqual([]);
  });

  it("a rupee amount with phone-shaped digits gives MONEY, not PHONE", () => {
    expect(summary("Rs 9876543210")).toEqual(["MONEY:Rs 9876543210"]);
  });

  it("an email's domain is not also a URL", () => {
    expect(summary("priya@gmail.com")).toEqual(["EMAIL:priya@gmail.com"]);
  });

  it("an IP inside a link gives one URL", () => {
    expect(summary("http://10.0.0.1/admin")).toEqual(["URL:http://10.0.0.1/admin"]);
  });

  it("finds the new types in one text, in reading order", () => {
    const text =
      "DOB: 12/05/1990. Address: 12, MG Road, Bengaluru 560038. " +
      "A/c 50100123456788, CTC ₹12 LPA, linkedin.com/in/priya, server 10.0.0.1.";
    expect(summary(text)).toEqual([
      "DATE:12/05/1990",
      "PIN:560038",
      "BANK_ACCOUNT:50100123456788",
      "MONEY:₹12 LPA",
      "URL:linkedin.com/in/priya",
      "IP:10.0.0.1",
    ]);
  });
});

describe("detect — documented trade-offs", () => {
  it("[self-computed] an account number that happens to pass Luhn is labelled CARD (checksum wins)", () => {
    // 50100123456789 is Luhn-valid. It is still masked, just under CARD.
    expect(summary("A/c 50100123456789")).toEqual(["CARD:50100123456789"]);
  });
});
