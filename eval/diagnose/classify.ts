// Dev-only diagnosis: for each PERSON truth span that is missed or partly masked, says whether
//  (a) the model never tagged it,
//  (b) the model tagged it but our code lost it (and at which step), or
//  (c) a rule detection of another type took its characters.
// Pure code: the browser page feeds it the model's raw output.
import { group, mapLabel, mergeSpans, type Span } from "../../src/engine/names.ts";
import { locatePredictions, snapToWords, type RawPrediction } from "../../src/engine/spans.ts";
import type { CaseStyle, Det, EvalDoc, PersonPattern } from "../types.ts";
import { positionOf, type Position } from "./position.ts";

/** One model call: the text it saw (the ALL CAPS copy, where used), where that text starts, and what it returned. */
export interface RawCall {
  offset: number;
  text: string;
  predictions: RawPrediction[];
}

export type Category = "a" | "b" | "c";

export interface DiagRow {
  docId: string;
  value: string;
  caseStyle: CaseStyle;
  pattern: PersonPattern | null;
  position: Position;
  label: string | null;
  status: "missed" | "partial";
  category: Category;
  /** a: none | other-label | partial.  b: grouping | snapping | merge | combine.  c: the rule's type. */
  sub: string;
  before: string;
  after: string;
  detectedAs: string[];
}

interface Iv {
  start: number;
  end: number;
}

function covered(ivs: readonly Iv[], s: number, e: number): number {
  let n = 0;
  for (let i = s; i < e; i++) if (ivs.some((v) => v.start <= i && i < v.end)) n++;
  return n;
}

const NAME_KINDS = new Set(["PERSON", "ORG", "LOC"]);
const context = (s: string): string => s.replace(/\n/g, "⏎");

export function diagnoseDoc(doc: EvalDoc, calls: readonly RawCall[], finalDets: readonly Det[]): DiagRow[] {
  // Tokens by kind, as absolute positions; PERSON ones snapped to whole words like the product does.
  const personTokens: Iv[] = [];
  const otherTokens: Iv[] = [];
  const grouped: Span[] = [];
  for (const c of calls) {
    const located = locatePredictions(c.text, c.predictions);
    for (const l of located) {
      const kind = mapLabel(l.label);
      const raw = l.label.replace(/^[BIES][-_]/i, "").toUpperCase();
      const iv = { start: c.offset + l.start, end: c.offset + l.end };
      if (kind === "PERSON") personTokens.push({ ...iv, ...snapToWords(doc.text, iv.start, iv.end) });
      else if (kind !== null || raw === "MISC") otherTokens.push(iv);
    }
    grouped.push(...group(c.text, located, c.offset));
  }
  const snapped = grouped.map((s) => ({ ...s, ...snapToWords(doc.text, s.start, s.end) }));
  const merged = mergeSpans(snapped);
  const people = (spans: readonly Span[]): Iv[] => spans.filter((s) => s.type === "PERSON");

  const rows: DiagRow[] = [];
  for (const t of doc.truth) {
    if (t.type !== "PERSON") continue;
    const len = t.end - t.start;
    const hits = covered(finalDets, t.start, t.end);
    if (hits === len) continue;
    const ruleHit = finalDets.find((d) => !NAME_KINDS.has(d.type) && d.start < t.end && d.end > t.start);

    let category: Category;
    let sub: string;
    if (ruleHit) {
      category = "c";
      sub = ruleHit.type;
    } else if (covered(personTokens, t.start, t.end) === len) {
      category = "b";
      if (covered(people(grouped), t.start, t.end) < len) sub = "grouping";
      else if (covered(people(snapped), t.start, t.end) < len) sub = "snapping";
      else if (covered(people(merged), t.start, t.end) < len) sub = "merge";
      else sub = "combine";
    } else {
      category = "a";
      if (covered(personTokens, t.start, t.end) > 0) sub = "partial";
      else if (covered(otherTokens, t.start, t.end) > 0) sub = "other-label";
      else sub = "none";
    }

    const where = positionOf(doc.text, t.start, t.end);
    rows.push({
      docId: doc.id,
      value: t.value,
      caseStyle: t.caseStyle,
      pattern: t.pattern,
      position: where.position,
      label: where.label ?? null,
      status: hits === 0 ? "missed" : "partial",
      category,
      sub,
      before: context(doc.text.slice(Math.max(0, t.start - 40), t.start)),
      after: context(doc.text.slice(t.end, t.end + 40)),
      detectedAs: [...new Set(finalDets.filter((d) => d.start < t.end && d.end > t.start).map((d) => d.type))],
    });
  }
  return rows;
}

type Counts = Record<Category, number>;
const zero = (): Counts => ({ a: 0, b: 0, c: 0 });

export interface DiagSummary {
  total: number;
  byCategory: Counts;
  bySub: Record<string, number>;
  byCaseAndCategory: Record<string, Counts>;
  byPositionAndCategory: Record<string, Counts>;
  byLabelWhenGroupA: Record<string, number>;
}

export function summarise(rows: readonly DiagRow[]): DiagSummary {
  const s: DiagSummary = { total: rows.length, byCategory: zero(), bySub: {}, byCaseAndCategory: {}, byPositionAndCategory: {}, byLabelWhenGroupA: {} };
  for (const r of rows) {
    s.byCategory[r.category]++;
    const key = `${r.category}:${r.sub}`;
    s.bySub[key] = (s.bySub[key] ?? 0) + 1;
    (s.byCaseAndCategory[r.caseStyle] ??= zero())[r.category]++;
    (s.byPositionAndCategory[r.position] ??= zero())[r.category]++;
    if (r.category === "a" && r.label) s.byLabelWhenGroupA[r.label] = (s.byLabelWhenGroupA[r.label] ?? 0) + 1;
  }
  return s;
}
