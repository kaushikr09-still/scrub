// Pure scoring helpers for the bake-off page. No model, no browser, no network.
import { locatePredictions, type Located, type RawPrediction } from "../src/engine/spans";

export { locatePredictions, type Located, type RawPrediction };

export interface Sentence {
  id: string;
  pattern: string;
  name: string;
  text: string;
}

export interface Tally {
  found: number;
  total: number;
}

export interface Score {
  overall: Tally;
  byPattern: Record<string, Tally>;
  /** Person predictions that do not overlap the name span. */
  outside: number;
}

const PERSON_LABELS = new Set(["PER", "PERSON", "NAME", "GIVENNAME", "SURNAME", "FIRSTNAME", "LASTNAME", "FULLNAME"]);

export function isPersonLabel(label: string): boolean {
  return PERSON_LABELS.has(label.replace(/^[BI][-_]/i, "").toUpperCase());
}

export function findNameSpan(text: string, name: string): { start: number; end: number } | null {
  const start = text.toLowerCase().indexOf(name.toLowerCase());
  return start < 0 ? null : { start, end: start + name.length };
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }): boolean =>
  a.start < b.end && b.start < a.end;

/** predictions[i] belongs to sentences[i]. A name is found if any person prediction overlaps it. */
export function scoreCandidate(sentences: Sentence[], predictions: Located[][]): Score {
  const score: Score = { overall: { found: 0, total: 0 }, byPattern: {}, outside: 0 };
  sentences.forEach((s, i) => {
    const span = findNameSpan(s.text, s.name);
    const people = (predictions[i] ?? []).filter((p) => isPersonLabel(p.label));
    const hit = span !== null && people.some((p) => overlaps(p, span));
    const tally = (score.byPattern[s.pattern] ??= { found: 0, total: 0 });
    tally.total++;
    score.overall.total++;
    if (hit) {
      tally.found++;
      score.overall.found++;
    }
    score.outside += people.filter((p) => span === null || !overlaps(p, span)).length;
  });
  return score;
}

export function formatRecall(t: Tally): string {
  const pct = t.total === 0 ? "n/a" : `${Math.round((t.found / t.total) * 100)}%`;
  return `${pct} (${t.found} of ${t.total})`;
}

/** Total download in MB (1 MB = 1,000,000 bytes), counting each file once at its largest reported size. */
export function sumFileSizes(events: { file: string; loaded?: number; total?: number }[]): number {
  const biggest = new Map<string, number>();
  for (const e of events) {
    const size = Math.max(e.total ?? 0, e.loaded ?? 0);
    biggest.set(e.file, Math.max(biggest.get(e.file) ?? 0, size));
  }
  let bytes = 0;
  for (const b of biggest.values()) bytes += b;
  return bytes / 1_000_000;
}
