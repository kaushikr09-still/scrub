import { describe, expect, it } from "vitest";
import { referenceLocate } from "./align.ts";

const p = (word: string, entity = "O") => ({ word, entity, score: 0.9 });

describe("referenceLocate", () => {
  it("places tokens in order, including punctuation stuck to a word", () => {
    const text = "Priority: Amit ok";
    const out = referenceLocate(text, [p("Priority"), p(":"), p("Amit", "B-PER"), p("ok")]);
    expect(out.map((l) => text.slice(l.start, l.end))).toEqual(["Priority", ":", "Amit", "ok"]);
  });
  it("joins word pieces and keeps the label of each", () => {
    const text = "Ishita";
    const out = referenceLocate(text, [p("Is", "B-PER"), p("##hita", "B-PER")]);
    expect(out.map((l) => [l.label, l.start, l.end])).toEqual([["B-PER", 0, 2], ["B-PER", 2, 6]]);
  });
  it("skips a token it cannot find without moving, and never searches ahead", () => {
    const text = "a Amit b";
    const out = referenceLocate(text, [p("a"), p("[UNK]"), p("Amit", "B-PER")]);
    expect(out.map((l) => text.slice(l.start, l.end))).toEqual(["a", "Amit"]);
  });
});
