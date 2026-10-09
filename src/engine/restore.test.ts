import { describe, expect, it } from "vitest";
import { restore } from "./restore";
import type { Mapping } from "./scrub";
import type { DetectionType } from "./types";

function mapOf(entries: Record<string, string>): Mapping {
  return new Map(
    Object.entries(entries).map(([key, value]) => [
      key,
      { type: key.replace(/_\d+$/, "") as DetectionType, value },
    ]),
  );
}

const mapping = mapOf({ EMAIL_1: "a@b.com", EMAIL_10: "ten@b.com", PERSON_1: "Rahul" });
const text = (reply: string) => restore(reply, mapping).text;

describe("restore — tolerant matching", () => {
  it.each([
    ["[EMAIL_1]", "a@b.com"],
    ["[email_1]", "a@b.com"],
    ["EMAIL_1", "a@b.com"],
    ["email_1", "a@b.com"],
    ["Email_1", "a@b.com"],
    ["[ Email_1 ]", "a@b.com"],
    ["[\tEMAIL_1 ]", "a@b.com"],
    ["{EMAIL_1}", "a@b.com"],
    ["[[EMAIL_1]]", "a@b.com"],
    ["{{ EMAIL_1 }}", "a@b.com"],
    ["{EMAIL_1]", "a@b.com"],
    ["[EMAIL_1", "a@b.com"],
    ["EMAIL_1]", "a@b.com"],
    ["**[EMAIL_1]**", "**a@b.com**"],
    ["`EMAIL_1`", "`a@b.com`"],
  ])("%s → %s", (reply, expected) => {
    expect(text(reply)).toBe(expected);
  });

  it("keeps < > and ( ) around a token", () => {
    expect(text("<EMAIL_1>")).toBe("<a@b.com>");
    expect(text("<[EMAIL_1]>")).toBe("<a@b.com>");
    expect(text("(EMAIL_1)")).toBe("(a@b.com)");
    expect(text("([EMAIL_1])")).toBe("(a@b.com)");
  });

  it("keeps possessives", () => {
    expect(text("[PERSON_1]'s mail")).toBe("Rahul's mail");
    expect(text("PERSON_1’s mail")).toBe("Rahul’s mail");
    expect(text("[person_1]'s")).toBe("Rahul's");
  });

  it("[EMAIL_1] does not damage [EMAIL_10], and the reverse", () => {
    expect(text("[EMAIL_10] [EMAIL_1]")).toBe("ten@b.com a@b.com");
    expect(text("[EMAIL_1][EMAIL_10]")).toBe("a@b.comten@b.com");
    expect(text("EMAIL_10, EMAIL_1")).toBe("ten@b.com, a@b.com");
  });

  it("keeps spaces outside a lone bracket, and line breaks always", () => {
    expect(text("[ EMAIL_1 and more")).toBe("[ a@b.com and more");
    expect(text("[\nEMAIL_1\n]")).toBe("[\na@b.com\n]");
  });

  it("does not re-scan restored values", () => {
    const m = mapOf({ EMAIL_1: "EMAIL_2@x.com", EMAIL_2: "two@x.com" });
    expect(restore("[EMAIL_1]", m).text).toBe("EMAIL_2@x.com");
  });

  it("handles multi-word types such as BANK_ACCOUNT", () => {
    const m = mapOf({ BANK_ACCOUNT_1: "12345678901" });
    expect(restore("A/c [bank_account_1].", m).text).toBe("A/c 12345678901.");
  });

  it("does not touch tokens glued to other letters or digits", () => {
    expect(text("EMAIL_1x EMAIL_12a 9EMAIL_1")).toBe("EMAIL_1x EMAIL_12a 9EMAIL_1");
  });
});

describe("restore — warnings", () => {
  it("returns no warnings when every token is known", () => {
    expect(restore("[EMAIL_1] [EMAIL_10]", mapping).warnings).toEqual([]);
  });

  it("warns about an unknown [PERSON_9] and leaves it in place", () => {
    const r = restore("Hi [PERSON_9],", mapping);
    expect(r.text).toBe("Hi [PERSON_9],");
    expect(r.warnings).toEqual([{ kind: "unknown-placeholder", token: "[PERSON_9]", start: 3, end: 13 }]);
  });

  it("warns about unknown bare ALL-CAPS tokens and any bracketed token", () => {
    const r = restore("PHONE_3 and [file_2] and {x_1}", mapping);
    expect(r.warnings.map((w) => w.token)).toEqual(["PHONE_3", "[file_2]", "{x_1}"]);
  });

  it("warns about lower-case bare tokens of a type in the mapping", () => {
    expect(restore("email_2", mapping).warnings.map((w) => w.token)).toEqual(["email_2"]);
  });

  it("does not warn about ordinary words like file_2 or python_3", () => {
    expect(restore("open file_2 with python_3", mapping).warnings).toEqual([]);
  });

  it("treats leading zeros as a different number and warns", () => {
    const r = restore("[EMAIL_01]", mapping);
    expect(r.text).toBe("[EMAIL_01]");
    expect(r.warnings.map((w) => w.token)).toEqual(["[EMAIL_01]"]);
  });
});
