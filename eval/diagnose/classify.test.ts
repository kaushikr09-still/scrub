import { describe, expect, it } from "vitest";
import type { RawPrediction } from "../../src/engine/spans.ts";
import type { Det, EvalDoc } from "../types.ts";
import { diagnoseDoc, summarise, type RawCall } from "./classify.ts";

function makeDoc(text: string, value: string, caseStyle: "title" | "upper" | "lower" = "title"): EvalDoc {
  const start = text.indexOf(value);
  return {
    id: "d", split: "dev", preset: "chats", template: "t", text,
    truth: [{ type: "PERSON", start, end: start + value.length, value, pattern: "single", caseStyle }],
    negatives: [],
  };
}
const tok = (word: string, entity: string, start: number): RawPrediction => ({ word, entity, score: 0.99, start, end: start + word.length });
const call = (text: string, predictions: RawPrediction[]): RawCall => ({ offset: 0, text, predictions });

describe("diagnoseDoc", () => {
  const text = "ok. Priya ka number do";
  const d = makeDoc(text, "Priya");

  it("covered names are not reported", () => {
    const dets: Det[] = [{ type: "PERSON", start: 4, end: 9 }];
    expect(diagnoseDoc(d, [call(text, [tok("Priya", "B-PER", 4)])], dets)).toEqual([]);
  });

  it("(a) the model returned nothing for the span", () => {
    const rows = diagnoseDoc(d, [call(text, [tok("ok", "O", 0)])], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "a", sub: "none", status: "missed", position: "sentence" });
  });

  it("(a) the model tagged it with a different kind of label", () => {
    const rows = diagnoseDoc(d, [call(text, [tok("Priya", "B-ORG", 4)])], []);
    expect(rows[0]).toMatchObject({ category: "a", sub: "other-label" });
  });

  it("(a) the model tagged only part of a two-word name", () => {
    const t = "Mail Priya Sharma today";
    const doc = makeDoc(t, "Priya Sharma");
    const rows = diagnoseDoc(doc, [call(t, [tok("Priya", "B-PER", 5)])], [{ type: "PERSON", start: 5, end: 10 }]);
    expect(rows[0]).toMatchObject({ category: "a", sub: "partial", status: "partial" });
  });

  it("(b) the model tagged it but only another label survived", () => {
    const rows = diagnoseDoc(d, [call(text, [tok("Priya", "B-PER", 4)])], [{ type: "ORG", start: 4, end: 6 }]);
    expect(rows[0]).toMatchObject({ category: "b" });
  });

  it("(b) the product's locator lost the model's tags", () => {
    const t = "Priority: High\nCustomer Ishita Rao\n(x): y";
    const doc = makeDoc(t, "Ishita Rao");
    const w = (word: string, entity = "O") => ({ word, entity, score: 0.9 });
    const preds = [w("Priority"), w(":"), w("High"), w("Customer"), w("Is", "B-PER"), w("##hita", "B-PER"), w("Rao", "I-PER"), w("("), w("x"), w(")"), w(":"), w("y")];
    const rows = diagnoseDoc(doc, [{ offset: 0, text: t, predictions: preds }], [], () => []);
    expect(rows[0]).toMatchObject({ category: "b", sub: "locate" });
    // With the real locator the same output is placed correctly, so nothing is lost at that step.
    expect(diagnoseDoc(doc, [{ offset: 0, text: t, predictions: preds }], [])[0].sub).not.toBe("locate");
  });

  it("(c) a rule detection took the characters", () => {
    const t = "Priya 9876543210";
    const doc = makeDoc(t, "Priya");
    const rows = diagnoseDoc(doc, [call(t, [tok("Priya", "B-PER", 0)])], [{ type: "PHONE", start: 1, end: 3 }]);
    expect(rows[0]).toMatchObject({ category: "c", sub: "PHONE" });
  });

  it("keeps 40 characters of context and a line break marker", () => {
    const t = `${"x".repeat(50)}\nPriya here`;
    const doc = makeDoc(t, "Priya");
    const rows = diagnoseDoc(doc, [call(t, [])], []);
    expect(rows[0].before).toBe(`${"x".repeat(39)}⏎`);
    expect(rows[0].after).toBe(" here");
  });
});

describe("summarise", () => {
  it("counts by category, case style and position", () => {
    const d = makeDoc("ok. Priya ka number do", "Priya", "lower");
    const rows = diagnoseDoc(d, [call(d.text, [])], []);
    const s = summarise(rows);
    expect(s.total).toBe(1);
    expect(s.byCategory).toEqual({ a: 1, b: 0, c: 0 });
    expect(s.byCaseAndCategory.lower).toEqual({ a: 1, b: 0, c: 0 });
    expect(s.byPositionAndCategory.sentence).toEqual({ a: 1, b: 0, c: 0 });
  });
});
