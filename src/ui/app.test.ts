import { describe, expect, it } from "vitest";
import { detect } from "../engine/detect";
import { restore } from "../engine/restore";
import { scrub } from "../engine/scrub";
import { ScrubSession, type Engine, type NameChecker } from "./app";

const TEXT = "Mail asha@example.com or asha@example.com, call 98765 43210.";

const broken: Engine = {
  detect: () => {
    throw new Error("boom");
  },
  scrub,
  restore,
};

describe("ScrubSession.scrub", () => {
  it("returns the scrubbed text and a count by type", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT);
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Mail [EMAIL_1] or [EMAIL_1], call [PHONE_1].");
    expect(v.summary).toBe("Masked 3 items: EMAIL × 2, PHONE × 1.");
    expect(v.warnings).toEqual([]);
  });

  it("says when nothing was found, and still allows the text through", async () => {
    const v = await new ScrubSession().scrub("Hello there");
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Hello there");
    expect(v.summary).toMatch(/nothing found/i);
  });

  it("refuses empty input", async () => {
    const v = await new ScrubSession().scrub("   ");
    expect(v.ok).toBe(false);
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/paste some text/i);
  });

  it("warns once per token when the input already has placeholders", async () => {
    const v = await new ScrubSession().scrub("See [EMAIL_4] and [EMAIL_4], or a@b.co");
    expect(v.text).toBe("See [EMAIL_4] and [EMAIL_4], or [EMAIL_5]");
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain("[EMAIL_4]");
    expect(v.warnings[0]).toContain("2 times");
  });

  it("fails closed when detection throws: no text, no copy, no restore", async () => {
    const s = new ScrubSession(broken);
    s.setAcknowledged(true);
    const v = await s.scrub(TEXT);
    expect(v.ok).toBe(false);
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/nothing was scrubbed/i);
    expect(v.warnings.join(" ")).not.toContain("asha");
    expect(s.scrubbedCopy(TEXT).ok).toBe(false);
    expect(s.restore("[EMAIL_1]").warnings.join(" ")).toMatch(/scrub some text first/i);
  });

  it("a failed scrub drops the previous mapping", async () => {
    const engine: Engine = { detect, scrub, restore };
    const s = new ScrubSession(engine);
    await s.scrub(TEXT);
    engine.detect = broken.detect;
    await s.scrub(TEXT);
    expect(s.restore("[EMAIL_1]").text).toBe("");
  });
});

describe("ScrubSession.scrubbedCopy (the acknowledgment gate)", () => {
  it("blocks copy until the note is acknowledged", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    const blocked = s.scrubbedCopy(TEXT);
    expect(blocked).toEqual({ ok: false, focus: "ack", message: expect.stringMatching(/tick the box/i) });
    s.setAcknowledged(true);
    expect(s.scrubbedCopy(TEXT)).toEqual({ ok: true, text: "Mail [EMAIL_1] or [EMAIL_1], call [PHONE_1]." });
  });

  it("keeps the acknowledgment across new scrubs (one per page load)", async () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    await s.scrub(TEXT);
    await s.scrub("call 98765 43210");
    expect(s.scrubbedCopy("call 98765 43210")).toEqual({ ok: true, text: "call [PHONE_1]" });
  });

  it("can be un-acknowledged", async () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    s.setAcknowledged(false);
    await s.scrub(TEXT);
    expect(s.scrubbedCopy(TEXT).ok).toBe(false);
  });

  it("blocks copy before any scrub", async () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    expect(s.scrubbedCopy("")).toMatchObject({ ok: false, focus: "input" });
  });

  it("blocks copy when the input changed after scrubbing", async () => {
    const s = new ScrubSession();
    s.setAcknowledged(true);
    await s.scrub(TEXT);
    expect(s.isStale(TEXT)).toBe(false);
    expect(s.isStale(TEXT + " more")).toBe(true);
    expect(s.scrubbedCopy(TEXT + " more")).toMatchObject({
      ok: false,
      focus: "input",
      message: expect.stringMatching(/press scrub again/i),
    });
  });

  it("checks staleness before acknowledgment, so the first fix asked for is the real one", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    expect(s.scrubbedCopy("changed")).toMatchObject({ ok: false, focus: "input" });
  });
});

describe("ScrubSession.restore", () => {
  it("round-trips a reply that uses tolerated placeholder forms", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    const v = s.restore("Write to [email_1]; PHONE_1's line is busy.");
    expect(v.text).toBe("Write to asha@example.com; 98765 43210's line is busy.");
    expect(v.warnings).toEqual([]);
  });

  it("warns about unknown placeholders and leaves them as is", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    const v = s.restore("Ask [PERSON_1] at [EMAIL_2] and [EMAIL_2].");
    expect(v.text).toBe("Ask [PERSON_1] at [EMAIL_2] and [EMAIL_2].");
    expect(v.warnings).toHaveLength(2);
    expect(v.warnings[0]).toContain("[PERSON_1]");
    expect(v.warnings[1]).toContain("[EMAIL_2]");
    expect(v.warnings[1]).toContain("2 times");
  });

  it("asks for a scrub first", async () => {
    const v = new ScrubSession().restore("[EMAIL_1]");
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/scrub some text first/i);
  });

  it("asks for a reply when the box is empty", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    const v = s.restore("  ");
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/paste the chatbot's reply/i);
  });

  it("uses the latest scrub's mapping", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    await s.scrub("x@y.in");
    expect(s.restore("[EMAIL_1]").text).toBe("x@y.in");
  });
});

describe("ScrubSession.restoredCopy", () => {
  it("copies the restored text without needing acknowledgment", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    s.restore("Hi [EMAIL_1]");
    expect(s.restoredCopy("Hi [EMAIL_1]")).toEqual({ ok: true, text: "Hi asha@example.com" });
  });

  it("blocks copy before a restore, or after the reply changed", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    expect(s.restoredCopy("Hi")).toMatchObject({ ok: false, focus: "reply" });
    s.restore("Hi [EMAIL_1]");
    expect(s.restoredCopy("Hi [EMAIL_1]!")).toMatchObject({
      ok: false,
      focus: "reply",
      message: expect.stringMatching(/press restore again/i),
    });
  });

  it("a new scrub invalidates the old restored result", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT);
    s.restore("Hi [EMAIL_1]");
    await s.scrub("x@y.in");
    expect(s.restoredCopy("Hi [EMAIL_1]").ok).toBe(false);
  });
});

describe("ScrubSession review checklist", () => {
  const TEXT2 = "Mail asha@example.com, again asha@example.com, call 98765 43210.";
  const names: NameChecker = {
    state: () => "ready",
    find: async (t) => {
      const v = "Acme Ltd";
      const start = t.indexOf(v);
      return start < 0 ? [] : [{ type: "ORG", start, end: start + v.length, value: v, confidence: 0.9 }];
    },
  };

  it("lists one row per distinct value with its count", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT2);
    expect(v.rows.map((r) => [r.type, r.value, r.count, r.masked])).toEqual([
      ["EMAIL", "asha@example.com", 2, true],
      ["PHONE", "98765 43210", 1, true],
    ]);
  });

  it("unticking leaves the value plain everywhere, and ticking masks it again", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT2);
    const email = v.rows[0].key;
    const off = s.setValueMasked(email, false)!;
    expect(off.text).toBe("Mail asha@example.com, again asha@example.com, call [PHONE_1].");
    expect(off.rows[0].masked).toBe(false);
    expect(s.setValueMasked(email, true)!.text).toBe("Mail [EMAIL_1], again [EMAIL_1], call [PHONE_1].");
  });

  it("restore works for everything that is still masked", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT2);
    s.setValueMasked(v.rows[0].key, false);
    expect(s.restore("Call [PHONE_1] and write asha@example.com").text).toBe("Call 98765 43210 and write asha@example.com");
  });

  it("changing the ticks clears an old restored reply", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT2);
    s.restore("[PHONE_1]");
    s.setValueMasked(v.rows[1].key, false);
    expect(s.restoredCopy("[PHONE_1]").ok).toBe(false);
  });

  it("the Business emails preset (default) masks organisations; Resumes leaves them", async () => {
    const s = new ScrubSession(undefined, names);
    const text = "Worked at Acme Ltd. asha@example.com";
    expect((await s.scrub(text)).text).toBe("Worked at [ORG_1]. [EMAIL_1]");
    s.setPreset("resumes");
    expect(s.rebuild()!.text).toBe("Worked at Acme Ltd. [EMAIL_1]");
    expect(s.rebuild()!.leftPlain).toEqual(["ORG"]);
  });

  it("a category tick-box resets that category's per-value choices", async () => {
    const s = new ScrubSession();
    const v = await s.scrub(TEXT2);
    s.setValueMasked(v.rows[0].key, false);
    expect(s.setCategory("EMAIL", true)!.rows[0].masked).toBe(true);
    expect(s.setCategory("EMAIL", false)!.text).toContain("asha@example.com");
  });

  it("a new scrub keeps the preset and category choices", async () => {
    const s = new ScrubSession();
    s.setPreset("chat");
    s.setCategory("PHONE", false);
    expect((await s.scrub(TEXT2)).text).toBe("Mail [EMAIL_1], again [EMAIL_1], call 98765 43210.");
  });

  it("toggling never lifts the names-NOT-checked gate or the stale check", async () => {
    const s = new ScrubSession(); // no name checker: names not checked
    const v = await s.scrub(TEXT2);
    s.setValueMasked(v.rows[0].key, false);
    expect(s.scrubbedCopy(TEXT2)).toMatchObject({ ok: false, focus: "ack" });
    s.setAcknowledged(true);
    expect(s.scrubbedCopy(TEXT2)).toMatchObject({ ok: true });
    expect(s.scrubbedCopy(TEXT2 + "x")).toMatchObject({ ok: false, focus: "input" });
  });

  it("forget() drops the held scrub: nothing to rebuild or copy", async () => {
    const s = new ScrubSession();
    await s.scrub(TEXT2);
    s.forget();
    expect(s.rebuild()).toBeNull();
    expect(s.scrubbedCopy(TEXT2).ok).toBe(false);
  });

  it("dropScrubKeepRestore() refuses copy and rebuild but still restores the last scrub", async () => {
    const s = new ScrubSession();
    const v = await s.scrub("Mail me at priya@example.com please.");
    const placeholder = v.text.match(/\[[A-Z]+_\d+\]/)![0];
    s.setAcknowledged(true);
    s.dropScrubKeepRestore();
    expect(s.rebuild()).toBeNull();
    expect(s.scrubbedCopy("")).toMatchObject({ ok: false, message: expect.stringContaining("Nothing to copy yet") });
    expect(s.scrubbedCopy("Mail me at priya@example.com please.").ok).toBe(false);
    expect(s.restore(`Noted ${placeholder}.`).text).toBe("Noted priya@example.com.");
  });

  it("does nothing before a scrub", () => {
    const s = new ScrubSession();
    expect(s.setValueMasked("x", false)).toBeNull();
    expect(s.rebuild()).toBeNull();
  });
});
