import { describe, expect, it } from "vitest";
import { findTokens, formatPlaceholder } from "./placeholder";

const spans = (text: string) =>
  findTokens(text).map((t) => [text.slice(t.start, t.end), t.key, t.looksLikePlaceholder]);

describe("formatPlaceholder", () => {
  it("writes [TYPE_N]", () => {
    expect(formatPlaceholder("EMAIL", 1)).toBe("[EMAIL_1]");
    expect(formatPlaceholder("PHONE", 12)).toBe("[PHONE_12]");
  });
});

describe("findTokens", () => {
  it("finds a bracketed token and its key", () => {
    expect(spans("mail [EMAIL_1] now")).toEqual([["[EMAIL_1]", "EMAIL_1", true]]);
  });

  it("reads the whole number, so EMAIL_1 never matches inside EMAIL_10", () => {
    expect(spans("[EMAIL_10] [EMAIL_1]")).toEqual([
      ["[EMAIL_10]", "EMAIL_10", true],
      ["[EMAIL_1]", "EMAIL_1", true],
    ]);
  });

  it("upper-cases the key whatever case is written", () => {
    expect(spans("[email_1] Email_2")).toEqual([
      ["[email_1]", "EMAIL_1", true],
      ["Email_2", "EMAIL_2", false],
    ]);
  });

  it("treats bare ALL-CAPS as placeholder-looking, bare lower case as not", () => {
    expect(spans("PERSON_9 and file_2")).toEqual([
      ["PERSON_9", "PERSON_9", true],
      ["file_2", "FILE_2", false],
    ]);
  });

  it("includes square and curly brackets, with inner spaces", () => {
    expect(spans("[ Email_1 ] {PHONE_2} [[PAN_3]] {{UPI_4}}")).toEqual([
      ["[ Email_1 ]", "EMAIL_1", true],
      ["{PHONE_2}", "PHONE_2", true],
      ["[[PAN_3]]", "PAN_3", true],
      ["{{UPI_4}}", "UPI_4", true],
    ]);
  });

  it("does not include < > or ( )", () => {
    expect(spans("<EMAIL_1> (EMAIL_2) <[EMAIL_3]>")).toEqual([
      ["EMAIL_1", "EMAIL_1", true],
      ["EMAIL_2", "EMAIL_2", true],
      ["[EMAIL_3]", "EMAIL_3", true],
    ]);
  });

  it("includes a lone bracket only when it touches the token", () => {
    expect(spans("[EMAIL_1 and PHONE_2]")).toEqual([
      ["[EMAIL_1", "EMAIL_1", true],
      ["PHONE_2]", "PHONE_2", true],
    ]);
    expect(spans("[ EMAIL_1 and PHONE_2 ]")).toEqual([
      ["EMAIL_1", "EMAIL_1", true],
      ["PHONE_2", "PHONE_2", true],
    ]);
  });

  it("never reaches across a line break", () => {
    expect(spans("[\nEMAIL_1\n]")).toEqual([["EMAIL_1", "EMAIL_1", true]]);
  });

  it("leaves possessives outside the token", () => {
    expect(spans("[PERSON_1]'s and PERSON_2’s")).toEqual([
      ["[PERSON_1]", "PERSON_1", true],
      ["PERSON_2", "PERSON_2", true],
    ]);
  });

  it("handles multi-word types such as BANK_ACCOUNT", () => {
    expect(spans("[BANK_ACCOUNT_1]")).toEqual([["[BANK_ACCOUNT_1]", "BANK_ACCOUNT_1", true]]);
  });

  it("ignores tokens glued to other letters or digits", () => {
    expect(spans("EMAIL_1x EMAIL_12a 9EMAIL_1 _EMAIL_1")).toEqual([]);
  });
});
