import { describe, expect, it } from "vitest";
import { detect } from "../engine/detect";
import { restore } from "../engine/restore";
import { scrub } from "../engine/scrub";
import { ScrubSession, type Engine } from "./app";

const TEXT = "Mail asha@example.com or asha@example.com, call 98765 43210.";

const broken: Engine = {
  detect: () => {
    throw new Error("boom");
  },
  scrub,
  restore,
};

describe("ScrubSession.scrub", () => {
  it("returns the scrubbed text and a count by type", () => {
    const s = new ScrubSession();
    const v = s.scrub(TEXT);
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Mail [EMAIL_1] or [EMAIL_1], call [PHONE_1].");
    expect(v.summary).toBe("Masked 3 items: EMAIL × 2, PHONE × 1.");
    expect(v.warnings).toEqual([]);
  });

  it("says when nothing was found, and still allows the text through", () => {
    const v = new ScrubSession().scrub("Hello there");
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Hello there");
    expect(v.summary).toMatch(/nothing found/i);
  });

  it("refuses empty input", () => {
    const v = new ScrubSession().scrub("   ");
    expect(v.ok).toBe(false);
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/paste some text/i);
  });

  it("warns once per token when the input already has placeholders", () => {
    const v = new ScrubSession().scrub("See [EMAIL_4] and [EMAIL_4], or a@b.co");
    expect(v.text).toBe("See [EMAIL_4] and [EMAIL_4], or [EMAIL_5]");
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain("[EMAIL_4]");
    expect(v.warnings[0]).toContain("2 times");
  });

  it("fails closed when detection throws: no text, no copy, no restore", () => {
    const s = new ScrubSession(broken);
    s.setAcknowledged(true);
    const v = s.scrub(TEXT);
    expect(v.ok).toBe(false);
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/nothing was scrubbed/i);
    expect(v.warnings.join(" ")).not.toContain("asha");
    expect(s.scrubbedCopy(TEXT).ok).toBe(false);
    expect(s.restore("[EMAIL_1]").warnings.join(" ")).toMatch(/scrub some text first/i);
  });

  it("a failed scrub drops the previous mapping", () => {
    const engine: Engine = { detect, scrub, restore };
    const s = new ScrubSession(engine);
    s.scrub(TEXT);
    engine.detect = broken.detect;
    s.scrub(TEXT);
    expect(s.restore("[EMAIL_1]").text).toBe("");
  });
});

describe("ScrubSession.scrubbedCopy (the acknowledgment gate)", () => {
  it("blocks copy until the note is acknowledged", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    const blocked = s.scrubbedCopy(TEXT);
    expect(blocked).toEqual({ ok: false, focus: "ack", message: expect.stringMatching(/tick the box/i) });
    s.setAcknowledged(true);
    expect(s.scrubbedCopy(TEXT)).toEqual({ ok: true, text: "Mail [EMAIL_1] or [EMAIL_1], call [PHONE_1]." });
  });

  it("keeps the acknowledgment across new scrubs (one per page load)", () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    s.scrub(TEXT);
    s.scrub("call 98765 43210");
    expect(s.scrubbedCopy("call 98765 43210")).toEqual({ ok: true, text: "call [PHONE_1]" });
  });

  it("can be un-acknowledged", () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    s.setAcknowledged(false);
    s.scrub(TEXT);
    expect(s.scrubbedCopy(TEXT).ok).toBe(false);
  });

  it("blocks copy before any scrub", () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    expect(s.scrubbedCopy("")).toMatchObject({ ok: false, focus: "input" });
  });

  it("blocks copy when the input changed after scrubbing", () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    s.scrub(TEXT);
    expect(s.isStale(TEXT)).toBe(false);
    expect(s.isStale(TEXT + " more")).toBe(true);
    expect(s.scrubbedCopy(TEXT + " more")).toMatchObject({
      ok: false,
      focus: "input",
      message: expect.stringMatching(/press scrub again/i),
    });
  });

  it("checks staleness before acknowledgment, so the first fix asked for is the real one", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    expect(s.scrubbedCopy("changed")).toMatchObject({ ok: false, focus: "input" });
  });
});

describe("ScrubSession.restore", () => {
  it("round-trips a reply that uses tolerated placeholder forms", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    const v = s.restore("Write to [email_1]; PHONE_1's line is busy.");
    expect(v.text).toBe("Write to asha@example.com; 98765 43210's line is busy.");
    expect(v.warnings).toEqual([]);
  });

  it("warns about unknown placeholders and leaves them as is", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    const v = s.restore("Ask [PERSON_1] at [EMAIL_2] and [EMAIL_2].");
    expect(v.text).toBe("Ask [PERSON_1] at [EMAIL_2] and [EMAIL_2].");
    expect(v.warnings).toHaveLength(2);
    expect(v.warnings[0]).toContain("[PERSON_1]");
    expect(v.warnings[1]).toContain("[EMAIL_2]");
    expect(v.warnings[1]).toContain("2 times");
  });

  it("asks for a scrub first", () => {
    const v = new ScrubSession().restore("[EMAIL_1]");
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/scrub some text first/i);
  });

  it("asks for a reply when the box is empty", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    const v = s.restore("  ");
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/paste the chatbot's reply/i);
  });

  it("uses the latest scrub's mapping", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    s.scrub("x@y.in");
    expect(s.restore("[EMAIL_1]").text).toBe("x@y.in");
  });
});

describe("ScrubSession.restoredCopy", () => {
  it("copies the restored text without needing acknowledgment", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    s.restore("Hi [EMAIL_1]");
    expect(s.restoredCopy("Hi [EMAIL_1]")).toEqual({ ok: true, text: "Hi asha@example.com" });
  });

  it("blocks copy before a restore, or after the reply changed", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    expect(s.restoredCopy("Hi")).toMatchObject({ ok: false, focus: "reply" });
    s.restore("Hi [EMAIL_1]");
    expect(s.restoredCopy("Hi [EMAIL_1]!")).toMatchObject({
      ok: false,
      focus: "reply",
      message: expect.stringMatching(/press restore again/i),
    });
  });

  it("a new scrub invalidates the old restored result", () => {
    const s = new ScrubSession();
    s.scrub(TEXT);
    s.restore("Hi [EMAIL_1]");
    s.scrub("x@y.in");
    expect(s.restoredCopy("Hi [EMAIL_1]").ok).toBe(false);
  });
});
