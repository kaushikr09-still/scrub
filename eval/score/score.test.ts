import { describe, expect, it } from "vitest";
import type { Det, EvalDoc, NegKind, TruthSpan, TruthType } from "../types.ts";
import { scoreRun } from "./score.ts";
import { formatRatio, ratio, wilson } from "./wilson.ts";
import { buildTables, renderMarkdown, type ReportMeta } from "./tables.ts";

/** Builds a mini document. Each part is [text, truth type?, extras?] and parts are joined with single spaces. */
type Part = string | [string, TruthType, Partial<TruthSpan>?] | [string, "NEG", NegKind];
function doc(id: string, preset: EvalDoc["preset"], parts: Part[]): EvalDoc {
  let text = "";
  const truth: TruthSpan[] = [];
  const negatives: EvalDoc["negatives"] = [];
  for (const p of parts) {
    if (text) text += " ";
    if (typeof p === "string") {
      text += p;
      continue;
    }
    const [value, type, extra] = p;
    const start = text.length;
    text += value;
    if (type === "NEG") negatives.push({ start, end: start + value.length, value, kind: extra as NegKind });
    else truth.push({ type, start, end: start + value.length, value, pattern: null, caseStyle: "n/a", ...(extra as object) });
  }
  return { id, split: "dev", preset, template: "t", text, truth, negatives };
}
const at = (d: EvalDoc, sub: string, type: string, from = 0, len = sub.length): Det => {
  const start = d.text.indexOf(sub, from);
  if (start < 0) throw new Error(`test setup: ${sub} not found`);
  return { type, start, end: start + len };
};

describe("wilson interval and formatting", () => {
  it("has no interval for zero", () => {
    expect(wilson(0, 0)).toBeNull();
  });
  it("50 of 100 is about 40.4% to 59.6%", () => {
    const w = wilson(50, 100)!;
    expect(w.lo).toBeCloseTo(0.4038, 3);
    expect(w.hi).toBeCloseTo(0.5962, 3);
  });
  it("10 of 10 has a lower bound near 72% and upper bound 100%", () => {
    const w = wilson(10, 10)!;
    expect(w.lo).toBeCloseTo(0.7225, 3);
    expect(w.hi).toBeCloseTo(1, 6);
  });
  it("0 of 10 starts at 0", () => {
    expect(wilson(0, 10)!.lo).toBeCloseTo(0, 6);
  });
  it("formats the count beside the percentage", () => {
    expect(formatRatio(ratio(212, 230))).toMatch(/^212 of 230 \(92\.2%, 95% CI \d+\.\d% to \d+\.\d%\)$/);
    expect(formatRatio(ratio(0, 0))).toBe("0 of 0 (n/a)");
  });
});

describe("masking status", () => {
  const d = doc("d1", "emails", [
    "Hello",
    ["Rahul Sharma", "PERSON", { pattern: "full", caseStyle: "title" }],
    "call",
    ["9876543210", "PHONE"],
    "or",
    ["a@b.com", "EMAIL"],
  ]);
  it("fully, partly and not masked", () => {
    const s = scoreRun([d], { d1: [at(d, "Rahul Sharma", "PERSON"), at(d, "9876543210", "PHONE", 0, 5)] });
    expect(s.truthTotal).toBe(3);
    expect(s.fullyMasked).toBe(1);
    expect(s.partlyMasked).toBe(1);
    expect(s.missed).toBe(1);
    expect(s.recall).toMatchObject({ num: 1, den: 3 });
  });
  it("partly masked counts as a leak, so the document leaks", () => {
    const s = scoreRun([d], { d1: [at(d, "Rahul Sharma", "PERSON"), at(d, "9876543210", "PHONE"), at(d, "a@b.com", "EMAIL")] });
    expect(s.leakDocs).toMatchObject({ num: 0, den: 1 });
    const s2 = scoreRun([d], { d1: [at(d, "Rahul Sharma", "PERSON", 0, 5)] });
    expect(s2.leakDocs).toMatchObject({ num: 1, den: 1 });
  });
  it("the union of detections counts, whatever their labels", () => {
    const s = scoreRun([d], {
      d1: [at(d, "9876543210", "PHONE", 0, 5), { type: "BANK_ACCOUNT", start: d.truth[1].start + 5, end: d.truth[1].end }],
    });
    expect(s.fullyMasked).toBe(1); // the phone only
    expect(s.typeCorrectFullyMasked).toBe(0); // but not by one type alone
    expect(s.recall).toMatchObject({ num: 1, den: 3 });
    expect(s.typeCorrectRecall).toMatchObject({ num: 0, den: 3 });
  });
  it("a detection that is the right size but the wrong label is masked, not type-correct", () => {
    const s = scoreRun([d], { d1: [at(d, "9876543210", "AADHAAR")] });
    expect(s.fullyMasked).toBe(1);
    expect(s.typeCorrectFullyMasked).toBe(0);
  });
  it("a detection that only touches the edge does not cover anything", () => {
    const t = d.truth[1];
    const s = scoreRun([d], { d1: [{ type: "PHONE", start: t.start - 3, end: t.start }] });
    expect(s.fullyMasked).toBe(0);
    expect(s.partlyMasked).toBe(0);
  });
  it("overlapping detections do not double count", () => {
    const t = d.truth[1];
    const s = scoreRun([d], { d1: [{ type: "PHONE", start: t.start, end: t.start + 6 }, { type: "PHONE", start: t.start + 4, end: t.end }] });
    expect(s.fullyMasked).toBe(1);
  });
});

describe("detections: true, type mismatch, false positive", () => {
  const d = doc("d2", "chats", ["see", ["9876543210", "PHONE"], "ref", ["ORD-12345", "NEG", "order" as never], "ok thanks"]);
  d.negatives[0].kind = "order";
  it("classifies each detection and computes precision", () => {
    const s = scoreRun([d], {
      d2: [
        at(d, "9876543210", "PHONE"), // true
        at(d, "ORD-12345", "AADHAAR"), // overlaps only a NEG: false positive
        at(d, "thanks", "PERSON"), // false positive
      ],
    });
    expect(s.detections).toMatchObject({ total: 3, true: 1, mismatch: 0, falsePositive: 2 });
    expect(s.precision).toMatchObject({ num: 1, den: 3 });
    expect(s.negHits.order).toMatchObject({ total: 1, touched: 1, detections: 1 });
    expect(s.negHits.ticket).toBeUndefined();
  });
  it("a detection over truth of another type is a mismatch, listed separately and left out of precision", () => {
    const s = scoreRun([d], { d2: [at(d, "9876543210", "AADHAAR"), at(d, "thanks", "PERSON")] }, { includeDetail: true });
    expect(s.detections).toMatchObject({ total: 2, true: 0, mismatch: 1, falsePositive: 1 });
    expect(s.precision).toMatchObject({ num: 0, den: 1 });
    expect(s.mismatchPairs).toEqual({ "AADHAAR -> PHONE": 1 });
    expect(s.mismatches).toEqual([{ docId: "d2", detected: "AADHAAR", truthTypes: ["PHONE"], value: "9876543210" }]);
  });
  it("a detection touching one same-type truth and one other-type truth is true", () => {
    const e = doc("e", "emails", [["12345", "PHONE"], ["67890", "PIN"]]);
    const s = scoreRun([e], { e: [{ type: "PHONE", start: 0, end: e.text.length }] });
    expect(s.detections).toMatchObject({ true: 1, mismatch: 0 });
  });
  it("adjacent detections are not overlapping", () => {
    const t = d.truth[0];
    const s = scoreRun([d], { d2: [{ type: "PHONE", start: t.end, end: t.end + 2 }] });
    expect(s.detections.falsePositive).toBe(1);
  });
});

describe("breakdowns", () => {
  const a = doc("a", "resumes", [
    ["RAHUL SHARMA", "PERSON", { pattern: "full", caseStyle: "upper" }],
    ["Priya", "PERSON", { pattern: "single", caseStyle: "title" }],
    ["a@b.com", "EMAIL"],
  ]);
  const b = doc("b", "chats", [["rahul", "PERSON", { pattern: "single", caseStyle: "lower" }], ["Bengaluru", "LOC"]]);
  const s = scoreRun([a, b], {
    a: [at(a, "RAHUL SHARMA", "PERSON"), at(a, "a@b.com", "EMAIL"), at(a, "Priya", "PERSON", 0, 2)],
    b: [at(b, "Bengaluru", "LOC")],
  });
  it("by type", () => {
    expect(s.recallBy.type.PERSON).toMatchObject({ total: 3, full: 1, partial: 1, missed: 1 });
    expect(s.recallBy.type.PERSON.recall).toMatchObject({ num: 1, den: 3 });
    expect(s.recallBy.type.EMAIL.recall).toMatchObject({ num: 1, den: 1 });
    expect(s.recallBy.type.LOC.typeCorrect).toMatchObject({ num: 1, den: 1 });
  });
  it("by preset", () => {
    expect(s.recallBy.preset.resumes.recall).toMatchObject({ num: 2, den: 3 });
    expect(s.recallBy.preset.chats.recall).toMatchObject({ num: 1, den: 2 });
  });
  it("by person pattern and case style use people only", () => {
    expect(s.recallBy.personPattern.full.recall).toMatchObject({ num: 1, den: 1 });
    expect(s.recallBy.personPattern.single.recall).toMatchObject({ num: 0, den: 2 });
    expect(s.recallBy.caseStyle.upper.recall).toMatchObject({ num: 1, den: 1 });
    expect(s.recallBy.caseStyle.lower.recall).toMatchObject({ num: 0, den: 1 });
    expect(s.recallBy.caseStyle["n/a"]).toBeUndefined();
  });
  it("leak rate by preset", () => {
    expect(s.leakBy.preset.resumes).toMatchObject({ num: 1, den: 1 });
    expect(s.leakBy.preset.chats).toMatchObject({ num: 1, den: 1 });
    expect(s.leakDocs).toMatchObject({ num: 2, den: 2 });
  });
  it("precision by detected type and by preset", () => {
    expect(s.precisionBy.type.PERSON).toMatchObject({ detections: 2, true: 2, falsePositive: 0 });
    expect(s.precisionBy.preset.resumes.precision).toMatchObject({ num: 3, den: 3 });
  });
});

describe("worst misses", () => {
  const a = doc("a", "chats", [
    "start of the line with some filler text here before",
    ["Amit", "PERSON", { pattern: "single", caseStyle: "lower" }],
    "and then a long tail of words that goes on well past forty characters",
    ["Rahul Sharma", "PERSON", { pattern: "full", caseStyle: "title" }],
    "end",
  ]);
  const detections = { a: [at(a, "Rahul Sharma", "PERSON", 0, 5)] };
  it("lists missed before partly masked, with 40 characters of context each side", () => {
    const s = scoreRun([a], detections, { includeDetail: true });
    expect(s.worstMisses.map((m) => [m.value, m.status])).toEqual([["Amit", "missed"], ["Rahul Sharma", "partial"]]);
    const m = s.worstMisses[0];
    expect(m.before).toBe(a.text.slice(a.truth[0].start - 40, a.truth[0].start));
    expect(m.after.length).toBe(40);
    expect(m.uncovered).toBe("4 of 4 characters not covered");
    expect(s.worstMisses[1].uncovered).toBe("7 of 12 characters not covered");
  });
  it("limits the list and is left out when detail is off", () => {
    expect(scoreRun([a], detections, { includeDetail: true, maxMisses: 1 }).worstMisses).toHaveLength(1);
    const s = scoreRun([a], detections);
    expect(s.worstMisses).toEqual([]);
    expect(s.falsePositives).toEqual([]);
  });
  it("lists false positives when detail is on", () => {
    const s = scoreRun([a], { a: [at(a, "filler", "PERSON")] }, { includeDetail: true });
    expect(s.falsePositives).toEqual([{ docId: "a", type: "PERSON", value: "filler" }]);
  });
});

describe("tables and markdown", () => {
  const a = doc("a", "resumes", [["Priya", "PERSON", { pattern: "single", caseStyle: "title" }], ["x@y.com", "EMAIL"]]);
  const s = scoreRun([a], { a: [at(a, "Priya", "PERSON")] }, { includeDetail: true });
  const meta: ReportMeta = {
    split: "dev",
    runAt: "2026-10-12T10:00:00.000Z",
    modelId: "Xenova/bert-base-NER",
    documents: 1,
    jsonlSha256: "ab".repeat(32),
    commit: "abc1234",
    durationMs: 1000,
  };
  it("every percentage in every table has a count and an interval", () => {
    for (const t of buildTables(s)) {
      for (const row of t.rows) {
        for (const cell of row) {
          if (cell.includes("%")) expect(cell).toMatch(/\d+ of \d+ \(/);
        }
      }
    }
  });
  it("the markdown starts with the commit and run facts and defines the metrics", () => {
    const md = renderMarkdown(s, meta);
    expect(md).toContain("abc1234");
    expect(md).toContain("Xenova/bert-base-NER");
    expect(md).toContain("ab".repeat(32));
    expect(md).toContain("Fixed template text");
    expect(md).toContain("false positive");
    expect(md).toContain("How to read this");
    expect(md).toContain("| Type |");
    expect(md.indexOf("abc1234")).toBeLessThan(md.indexOf("How to read this"));
  });
  it("shows the missed-name list only when detail is present", () => {
    expect(renderMarkdown(s, meta)).toContain("Worst misses");
    const s2 = scoreRun([a], { a: [] });
    expect(renderMarkdown(s2, { ...meta, split: "test" })).not.toContain("Worst misses");
  });
  it("says when git was unavailable", () => {
    expect(renderMarkdown(s, { ...meta, commit: null })).toContain("not available");
  });
});
