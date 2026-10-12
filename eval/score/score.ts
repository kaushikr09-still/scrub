// Scoring: pure functions, no I/O. Takes the generated documents and what the product detected in them.
import type { Det, EvalDoc, NegKind, TruthSpan } from "../types.ts";
import { ratio, type Ratio } from "./wilson.ts";

export interface RecallRow {
  total: number;
  full: number;
  partial: number;
  missed: number;
  /** Fully masked / total. Any label counts. */
  recall: Ratio;
  /** Fully masked by detections that all carry the truth span's own type. */
  typeCorrect: Ratio;
}

export interface PrecisionRow {
  detections: number;
  true: number;
  mismatch: number;
  falsePositive: number;
  /** true / (true + falsePositive). Type mismatches are left out of both. */
  precision: Ratio;
}

export interface Miss {
  docId: string;
  preset: string;
  type: string;
  pattern: string | null;
  caseStyle: string;
  value: string;
  status: "missed" | "partial";
  uncovered: string;
  before: string;
  after: string;
  /** Types of detections that touched the span (empty for a complete miss). */
  detectedAs: string[];
}

export interface Summary {
  documents: number;
  truthTotal: number;
  fullyMasked: number;
  typeCorrectFullyMasked: number;
  partlyMasked: number;
  missed: number;
  recall: Ratio;
  typeCorrectRecall: Ratio;
  leakDocs: Ratio;
  detections: { total: number; true: number; mismatch: number; falsePositive: number };
  precision: Ratio;
  /** "detected type -> truth type(s)" with a count. Always present. */
  mismatchPairs: Record<string, number>;
  negHits: Partial<Record<NegKind, { total: number; touched: number; detections: number }>>;
  recallBy: {
    type: Record<string, RecallRow>;
    preset: Record<string, RecallRow>;
    personPattern: Record<string, RecallRow>;
    caseStyle: Record<string, RecallRow>;
  };
  leakBy: { preset: Record<string, Ratio> };
  precisionBy: { type: Record<string, PrecisionRow>; preset: Record<string, PrecisionRow> };
  /** The lists below hold text and are filled only when includeDetail is set (dev runs). */
  mismatches: { docId: string; detected: string; truthTypes: string[]; value: string }[];
  falsePositives: { docId: string; type: string; value: string }[];
  worstMisses: Miss[];
}

export interface ScoreOptions {
  includeDetail?: boolean;
  maxMisses?: number;
  contextChars?: number;
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** How many characters of the span are inside at least one of the detections. */
function coveredChars(span: { start: number; end: number }, dets: readonly Det[]): number {
  const hit = new Uint8Array(span.end - span.start);
  for (const d of dets) {
    const lo = Math.max(span.start, d.start);
    const hi = Math.min(span.end, d.end);
    for (let i = lo; i < hi; i++) hit[i - span.start] = 1;
  }
  let n = 0;
  for (const h of hit) n += h;
  return n;
}

interface Tally {
  total: number;
  full: number;
  partial: number;
  missed: number;
  typeCorrect: number;
}
const emptyTally = (): Tally => ({ total: 0, full: 0, partial: 0, missed: 0, typeCorrect: 0 });
const toRow = (t: Tally): RecallRow => ({
  total: t.total,
  full: t.full,
  partial: t.partial,
  missed: t.missed,
  recall: ratio(t.full, t.total),
  typeCorrect: ratio(t.typeCorrect, t.total),
});

interface PTally {
  detections: number;
  true: number;
  mismatch: number;
  falsePositive: number;
}
const emptyP = (): PTally => ({ detections: 0, true: 0, mismatch: 0, falsePositive: 0 });
const toP = (t: PTally): PrecisionRow => ({ ...t, precision: ratio(t.true, t.true + t.falsePositive) });

function bump<T>(map: Map<string, T>, key: string, make: () => T): T {
  let v = map.get(key);
  if (!v) map.set(key, (v = make()));
  return v;
}
const toRecord = <T, U>(m: Map<string, T>, f: (t: T) => U): Record<string, U> =>
  Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, f(v)]));

export function scoreRun(docs: readonly EvalDoc[], detections: Record<string, readonly Det[]>, options: ScoreOptions = {}): Summary {
  const detail = options.includeDetail ?? false;
  const ctx = options.contextChars ?? 40;
  const byType = new Map<string, Tally>();
  const byPreset = new Map<string, Tally>();
  const byPattern = new Map<string, Tally>();
  const byCase = new Map<string, Tally>();
  const leakPreset = new Map<string, { leaks: number; docs: number }>();
  const pType = new Map<string, PTally>();
  const pPreset = new Map<string, PTally>();
  const negHits: Summary["negHits"] = {};
  const mismatchPairs = new Map<string, number>();
  const mismatches: Summary["mismatches"] = [];
  const falsePositives: Summary["falsePositives"] = [];
  const misses: Miss[] = [];
  const total = emptyTally();
  const det = emptyP();
  let leakDocs = 0;

  for (const doc of docs) {
    const dets = detections[doc.id] ?? [];
    let leaked = false;

    for (const t of doc.truth) {
      const len = t.end - t.start;
      const covered = coveredChars(t, dets);
      const sameType = coveredChars(t, dets.filter((d) => d.type === t.type));
      const status = covered === len ? "full" : covered > 0 ? "partial" : "missed";
      const apply = (tally: Tally) => {
        tally.total++;
        tally[status]++;
        if (status === "full" && sameType === len) tally.typeCorrect++;
      };
      apply(total);
      apply(bump(byType, t.type, emptyTally));
      apply(bump(byPreset, doc.preset, emptyTally));
      if (t.type === "PERSON") {
        apply(bump(byPattern, t.pattern ?? "unknown", emptyTally));
        apply(bump(byCase, t.caseStyle, emptyTally));
      }
      if (status !== "full") {
        leaked = true;
        if (detail) misses.push(describeMiss(doc, t, status, len - covered, dets, ctx));
      }
    }
    if (leaked) leakDocs++;
    const lp = bump(leakPreset, doc.preset, () => ({ leaks: 0, docs: 0 }));
    lp.docs++;
    if (leaked) lp.leaks++;

    for (const n of doc.negatives) {
      const h = (negHits[n.kind] ??= { total: 0, touched: 0, detections: 0 });
      h.total++;
      if (dets.some((d) => overlaps(d, n))) h.touched++;
    }

    for (const d of dets) {
      const touching = doc.truth.filter((t) => overlaps(d, t));
      const kind = touching.some((t) => t.type === d.type) ? "true" : touching.length > 0 ? "mismatch" : "falsePositive";
      for (const tally of [det, bump(pType, d.type, emptyP), bump(pPreset, doc.preset, emptyP)]) {
        tally.detections++;
        tally[kind]++;
      }
      if (kind === "mismatch") {
        const types = [...new Set(touching.map((t) => t.type))].sort();
        const key = `${d.type} -> ${types.join("+")}`;
        mismatchPairs.set(key, (mismatchPairs.get(key) ?? 0) + 1);
        if (detail) mismatches.push({ docId: doc.id, detected: d.type, truthTypes: types, value: doc.text.slice(d.start, d.end) });
      }
      if (kind === "falsePositive" && detail) falsePositives.push({ docId: doc.id, type: d.type, value: doc.text.slice(d.start, d.end) });
      for (const k of new Set(doc.negatives.filter((n) => overlaps(d, n)).map((n) => n.kind))) negHits[k]!.detections++;
    }
  }

  misses.sort(
    (a, b) =>
      Number(b.status === "missed") - Number(a.status === "missed") ||
      fractionLeft(b) - fractionLeft(a) ||
      a.docId.localeCompare(b.docId),
  );

  return {
    documents: docs.length,
    truthTotal: total.total,
    fullyMasked: total.full,
    typeCorrectFullyMasked: total.typeCorrect,
    partlyMasked: total.partial,
    missed: total.missed,
    recall: ratio(total.full, total.total),
    typeCorrectRecall: ratio(total.typeCorrect, total.total),
    leakDocs: ratio(leakDocs, docs.length),
    detections: { total: det.detections, true: det.true, mismatch: det.mismatch, falsePositive: det.falsePositive },
    precision: ratio(det.true, det.true + det.falsePositive),
    mismatchPairs: Object.fromEntries([...mismatchPairs].sort(([a], [b]) => a.localeCompare(b))),
    negHits,
    recallBy: {
      type: toRecord(byType, toRow),
      preset: toRecord(byPreset, toRow),
      personPattern: toRecord(byPattern, toRow),
      caseStyle: toRecord(byCase, toRow),
    },
    leakBy: { preset: toRecord(leakPreset, (x) => ratio(x.leaks, x.docs)) },
    precisionBy: { type: toRecord(pType, toP), preset: toRecord(pPreset, toP) },
    mismatches,
    falsePositives,
    worstMisses: misses.slice(0, options.maxMisses ?? 50),
  };
}

/** Fraction of a missed span's characters that are uncovered, read back from the "x of y" text. */
function fractionLeft(m: Miss): number {
  const [x, y] = m.uncovered.split(" characters")[0].split(" of ").map(Number);
  return x / y;
}

function describeMiss(doc: EvalDoc, t: TruthSpan, status: "missed" | "partial", left: number, dets: readonly Det[], ctx: number): Miss {
  return {
    docId: doc.id,
    preset: doc.preset,
    type: t.type,
    pattern: t.pattern,
    caseStyle: t.caseStyle,
    value: t.value,
    status,
    uncovered: `${left} of ${t.end - t.start} characters not covered`,
    before: doc.text.slice(Math.max(0, t.start - ctx), t.start),
    after: doc.text.slice(t.end, t.end + ctx),
    detectedAs: [...new Set(dets.filter((d) => overlaps(d, t)).map((d) => d.type))],
  };
}
