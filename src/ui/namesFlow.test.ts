// How the page treats the name model: loading, ready, failed, and results that go stale.
import { describe, expect, it } from "vitest";
import type { Detection } from "../engine/types";
import { ScrubSession, type ModelState, type NameChecker } from "./app";

const TEXT = "Priya Sharma wrote from Pune: priya@example.com";

const NAMES: Detection[] = [
  { type: "PERSON", start: 0, end: 12, value: "Priya Sharma", confidence: 0.9 },
  { type: "LOC", start: 24, end: 28, value: "Pune", confidence: 0.9 },
];

/** A name checker the test controls: set `state`, and release `find` calls by hand. */
class FakeChecker implements NameChecker {
  state_: ModelState = "loading";
  calls = 0;
  private waiting: { resolve: (d: Detection[]) => void; reject: (e: Error) => void }[] = [];
  result: Detection[] = NAMES;
  mode: "instant" | "manual" | "throw" = "instant";

  state(): ModelState {
    return this.state_;
  }

  find(): Promise<Detection[]> {
    this.calls++;
    if (this.mode === "throw") return Promise.reject(new Error("model crashed"));
    if (this.mode === "instant") return Promise.resolve(this.result);
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  release(): void {
    for (const w of this.waiting.splice(0)) w.resolve(this.result);
  }
}

function session(state: ModelState, mode: FakeChecker["mode"] = "instant") {
  const checker = new FakeChecker();
  checker.state_ = state;
  checker.mode = mode;
  return { s: new ScrubSession(undefined, checker), checker };
}

describe("rules only while the model is loading", () => {
  it("scrubs at once with the rules, never calls the model, and says names were NOT checked", async () => {
    const { s, checker } = session("loading");
    const v = await s.scrub(TEXT);
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Priya Sharma wrote from Pune: [EMAIL_1]");
    expect(v.namesChecked).toBe(false);
    expect(v.namesNote).toMatch(/names NOT checked/i);
    expect(v.namesNote).toMatch(/still loading/i);
    expect(checker.calls).toBe(0);
  });

  it("needs the acknowledgment before copy", async () => {
    const { s } = session("loading");
    await s.scrub(TEXT);
    expect(s.scrubbedCopy(TEXT)).toMatchObject({ ok: false, focus: "ack" });
    s.setAcknowledged(true);
    expect(s.scrubbedCopy(TEXT).ok).toBe(true);
  });
});

describe("ready", () => {
  it("masks names, organisations and places too, and needs no acknowledgment", async () => {
    const { s, checker } = session("ready");
    const v = await s.scrub(TEXT);
    expect(checker.calls).toBe(1);
    expect(v.text).toBe("[PERSON_1] wrote from [LOC_1]: [EMAIL_1]");
    expect(v.namesChecked).toBe(true);
    expect(v.summary).toMatch(/^Masked 3 items: /);
    expect(v.summary).toContain("PERSON × 1");
    expect(s.scrubbedCopy(TEXT)).toEqual({ ok: true, text: "[PERSON_1] wrote from [LOC_1]: [EMAIL_1]" });
  });

  it("restores the names too", async () => {
    const { s } = session("ready");
    await s.scrub(TEXT);
    expect(s.restore("Hello [PERSON_1] in [LOC_1]").text).toBe("Hello Priya Sharma in Pune");
  });

  it("still says to read the text when nothing was found", async () => {
    const { s, checker } = session("ready");
    checker.result = [];
    const v = await s.scrub("Hello there");
    expect(v.summary).toMatch(/nothing found/i);
    expect(v.summary).toMatch(/read your text yourself before you share it/i);
  });
});

describe("failed", () => {
  it("a model that failed to load gives a rules-only result that needs the acknowledgment", async () => {
    const { s, checker } = session("failed");
    const v = await s.scrub(TEXT);
    expect(v.ok).toBe(true);
    expect(v.namesChecked).toBe(false);
    expect(v.namesNote).toMatch(/names NOT checked/i);
    expect(checker.calls).toBe(0);
    expect(s.scrubbedCopy(TEXT)).toMatchObject({ ok: false, focus: "ack" });
  });

  it("a model that throws during a scrub fails closed to rules-only, without leaking text", async () => {
    const { s } = session("ready", "throw");
    const v = await s.scrub(TEXT);
    expect(v.ok).toBe(true);
    expect(v.text).toBe("Priya Sharma wrote from Pune: [EMAIL_1]");
    expect(v.namesChecked).toBe(false);
    expect(JSON.stringify(v)).not.toContain("crashed");
    expect(s.scrubbedCopy(TEXT)).toMatchObject({ ok: false, focus: "ack" });
  });

  it("with no model at all, names are not checked", async () => {
    const v = await new ScrubSession().scrub(TEXT);
    expect(v.namesChecked).toBe(false);
  });
});

describe("the state is captured at scrub time", () => {
  it("a scrub made while loading stays rules-only after the model becomes ready", async () => {
    const { s, checker } = session("loading");
    const v = await s.scrub(TEXT);
    checker.state_ = "ready";
    expect(v.namesChecked).toBe(false);
    expect(s.scrubbedCopy(TEXT)).toMatchObject({ ok: false, focus: "ack" });
    // Only a new scrub picks up the model.
    const again = await s.scrub(TEXT);
    expect(again.namesChecked).toBe(true);
    expect(s.scrubbedCopy(TEXT).ok).toBe(true);
  });

  it("a scrub made while ready stays checked even if the model fails afterwards", async () => {
    const { s, checker } = session("ready");
    await s.scrub(TEXT);
    checker.state_ = "failed";
    expect(s.scrubbedCopy(TEXT).ok).toBe(true);
  });

  it("a ready model that fails mid-scrub flips only that scrub to rules-only", async () => {
    const { s, checker } = session("ready", "throw");
    await s.scrub(TEXT);
    checker.mode = "instant";
    const next = await s.scrub(TEXT);
    expect(next.namesChecked).toBe(true);
  });
});

describe("text edited or re-scrubbed while the model is running", () => {
  it("discards the result when the text changed during the run", async () => {
    const { s, checker } = session("ready", "manual");
    let current = TEXT;
    const pending = s.scrub(TEXT, () => current);
    current = `${TEXT} and more`;
    checker.release();
    const v = await pending;
    expect(v.ok).toBe(false);
    expect(v.discarded).toBe(true);
    expect(v.text).toBe("");
    expect(v.warnings.join(" ")).toMatch(/changed your text/i);
    // Nothing is left to copy or restore.
    s.setAcknowledged(true);
    expect(s.scrubbedCopy(current).ok).toBe(false);
    expect(s.restore("[PERSON_1]").text).toBe("");
  });

  it("is also caught by the stale check if the caller does not pass a current-text function", async () => {
    const { s, checker } = session("ready", "manual");
    const pending = s.scrub(TEXT);
    checker.release();
    await pending;
    expect(s.isStale(`${TEXT} and more`)).toBe(true);
    expect(s.scrubbedCopy(`${TEXT} and more`)).toMatchObject({ ok: false, focus: "input" });
  });

  it("a newer scrub supersedes an older one that is still running", async () => {
    const { s, checker } = session("ready", "manual");
    const first = s.scrub(TEXT);
    checker.mode = "instant";
    checker.result = [];
    const second = await s.scrub("Rahul at rahul@example.com");
    checker.result = NAMES;
    // Release the first run's model call only now, after the second finished.
    checker.release();
    const v1 = await first;
    expect(second.ok).toBe(true);
    expect(v1.ok).toBe(false);
    expect(v1.discarded).toBe(true);
    // The session still holds the second scrub's result, not the first's.
    expect(s.scrubbedCopy("Rahul at rahul@example.com")).toMatchObject({ ok: true });
  });

  it("cannot be copied while the model is still running", async () => {
    const { s, checker } = session("ready", "manual");
    s.setAcknowledged(true);
    const pending = s.scrub(TEXT);
    expect(s.scrubbedCopy(TEXT)).toMatchObject({ ok: false, focus: "input" });
    checker.release();
    await pending;
    expect(s.scrubbedCopy(TEXT).ok).toBe(true);
  });
});
