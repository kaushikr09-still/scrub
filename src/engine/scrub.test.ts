import { describe, expect, it } from "vitest";
import { scrub } from "./scrub";
import type { Detection, DetectionType } from "./types";

/** Builds detections for each listed value, in the order they appear. */
function at(text: string, ...found: [DetectionType, string][]): Detection[] {
  let from = 0;
  return found.map(([type, value]) => {
    const start = text.indexOf(value, from);
    if (start < 0) throw new Error(`test setup: ${value} not found`);
    from = start + value.length;
    return { type, start, end: from, value, confidence: 0.95 };
  });
}

describe("scrub — replacing", () => {
  it("returns text unchanged with an empty mapping when nothing is found", () => {
    const r = scrub("nothing here", []);
    expect(r).toEqual({ text: "nothing here", mapping: new Map(), warnings: [] });
  });

  it("replaces each detection with [TYPE_N] and keeps everything else exactly", () => {
    const text = "Mail:\ta@b.com\r\n\r\n  Call 98765 43210.";
    const r = scrub(text, at(text, ["EMAIL", "a@b.com"], ["PHONE", "98765 43210"]));
    expect(r.text).toBe("Mail:\t[EMAIL_1]\r\n\r\n  Call [PHONE_1].");
    expect(r.mapping).toEqual(
      new Map([
        ["EMAIL_1", { type: "EMAIL", value: "a@b.com" }],
        ["PHONE_1", { type: "PHONE", value: "98765 43210" }],
      ]),
    );
  });

  it("numbers each type separately, in order of first appearance", () => {
    const text = "x@y.in, 9876543210, a@b.com";
    const r = scrub(text, at(text, ["EMAIL", "x@y.in"], ["PHONE", "9876543210"], ["EMAIL", "a@b.com"]));
    expect(r.text).toBe("[EMAIL_1], [PHONE_1], [EMAIL_2]");
  });

  it("gives two different emails different numbers", () => {
    const text = "a@b.com c@d.com";
    expect(scrub(text, at(text, ["EMAIL", "a@b.com"], ["EMAIL", "c@d.com"])).text).toBe(
      "[EMAIL_1] [EMAIL_2]",
    );
  });

  it("gives the same email written twice the same number", () => {
    const text = "a@b.com then a@b.com";
    const r = scrub(text, at(text, ["EMAIL", "a@b.com"], ["EMAIL", "a@b.com"]));
    expect(r.text).toBe("[EMAIL_1] then [EMAIL_1]");
    expect(r.mapping.size).toBe(1);
  });

  it("ignores case for EMAIL, UPI, PAN, GSTIN, IFSC; keeps the first spelling", () => {
    const text = "Ravi@X.com ravi@x.com abcde1234f ABCDE1234F";
    const r = scrub(
      text,
      at(text, ["EMAIL", "Ravi@X.com"], ["EMAIL", "ravi@x.com"], ["PAN", "abcde1234f"], ["PAN", "ABCDE1234F"]),
    );
    expect(r.text).toBe("[EMAIL_1] [EMAIL_1] [PAN_1] [PAN_1]");
    expect(r.mapping.get("EMAIL_1")!.value).toBe("Ravi@X.com");
  });

  it("does not merge differently written phone numbers (no alias grouping)", () => {
    const text = "98765 43210 / 9876543210";
    const r = scrub(text, at(text, ["PHONE", "98765 43210"], ["PHONE", "9876543210"]));
    expect(r.text).toBe("[PHONE_1] / [PHONE_2]");
  });

  it("accepts detections in any order", () => {
    const text = "a@b.com 9876543210";
    const [e, p] = at(text, ["EMAIL", "a@b.com"], ["PHONE", "9876543210"]);
    expect(scrub(text, [p, e]).text).toBe("[EMAIL_1] [PHONE_1]");
  });

  it("starts fresh on every call (no shared state)", () => {
    const text = "a@b.com";
    scrub("z@z.com", at("z@z.com", ["EMAIL", "z@z.com"]));
    expect(scrub(text, at(text, ["EMAIL", "a@b.com"])).text).toBe("[EMAIL_1]");
  });
});

describe("scrub — text that already contains placeholders", () => {
  it("warns about [EMAIL_1] in the input and numbers the real email above it", () => {
    const text = "Ref [EMAIL_1]: write to a@b.com";
    const r = scrub(text, at(text, ["EMAIL", "a@b.com"]));
    expect(r.text).toBe("Ref [EMAIL_1]: write to [EMAIL_2]");
    expect(r.warnings).toEqual([{ kind: "existing-placeholder", token: "[EMAIL_1]", start: 4, end: 13 }]);
  });

  it("numbers above the highest number already present, per type", () => {
    const text = "[EMAIL_7] EMAIL_3 [PHONE_4] a@b.com 9876543210";
    const r = scrub(text, at(text, ["EMAIL", "a@b.com"], ["PHONE", "9876543210"]));
    expect(r.text).toBe("[EMAIL_7] EMAIL_3 [PHONE_4] [EMAIL_8] [PHONE_5]");
    expect(r.warnings.map((w) => w.token)).toEqual(["[EMAIL_7]", "EMAIL_3", "[PHONE_4]"]);
  });

  it("an existing token of another type does not shift numbering", () => {
    const text = "[PHONE_4] a@b.com";
    expect(scrub(text, at(text, ["EMAIL", "a@b.com"])).text).toBe("[PHONE_4] [EMAIL_1]");
  });

  it("warns about lower-case bare tokens of a type being scrubbed", () => {
    const text = "see email_1, a@b.com";
    const r = scrub(text, at(text, ["EMAIL", "a@b.com"]));
    expect(r.text).toBe("see email_1, [EMAIL_2]");
    expect(r.warnings.map((w) => w.token)).toEqual(["email_1"]);
  });

  it("does not warn about ordinary words like file_2", () => {
    expect(scrub("open file_2 now", []).warnings).toEqual([]);
  });

  it("ignores token-like text inside a detection, since it gets replaced", () => {
    const text = "EMAIL_3@x.com";
    const r = scrub(text, at(text, ["EMAIL", "EMAIL_3@x.com"]));
    expect(r.text).toBe("[EMAIL_1]");
    expect(r.warnings).toEqual([]);
  });
});

describe("scrub — fail-closed on bad detections", () => {
  const secret = "a@b.com c@d.com";

  it("throws when detections overlap, without echoing the text", () => {
    const bad: Detection[] = [
      { type: "EMAIL", start: 0, end: 7, value: "a@b.com", confidence: 1 },
      { type: "EMAIL", start: 3, end: 7, value: ".com", confidence: 1 },
    ];
    expect(() => scrub(secret, bad)).toThrow(/overlap/);
    expect(() => scrub(secret, bad)).not.toThrow(/a@b/);
  });

  it("throws when a value does not match the text", () => {
    const bad: Detection[] = [{ type: "EMAIL", start: 0, end: 7, value: "x@y.com", confidence: 1 }];
    expect(() => scrub(secret, bad)).toThrow(/does not match/);
  });

  it("throws when a span is out of range or empty", () => {
    expect(() => scrub(secret, [{ type: "EMAIL", start: 10, end: 40, value: "", confidence: 1 }])).toThrow();
    expect(() => scrub(secret, [{ type: "EMAIL", start: 3, end: 3, value: "", confidence: 1 }])).toThrow();
  });
});
