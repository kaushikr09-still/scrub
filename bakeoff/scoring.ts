// Pure scoring helpers for the bake-off page. No model, no browser, no network.

export interface Sentence {
  id: string;
  pattern: string;
  name: string;
  text: string;
}

/** One token (or word) as transformers.js returns it. start/end are only present on some models. */
export interface RawPrediction {
  entity?: string;
  entity_group?: string;
  word: string;
  start?: number;
  end?: number;
  score?: number;
}

export interface Located {
  label: string;
  start: number;
  end: number;
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

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Turns token predictions into character spans in the original text.
 * Uses start/end when given; otherwise finds each token in the text, ignoring case,
 * and joins word-piece fragments (## prefix) onto the word before them.
 * Tokens that cannot be found (e.g. [UNK]) are skipped.
 */
export function locatePredictions(text: string, predictions: RawPrediction[]): Located[] {
  const lower = text.toLowerCase();
  const out: Located[] = [];
  let cursor = 0;
  for (const p of predictions) {
    const label = p.entity_group ?? p.entity ?? "";
    if (typeof p.start === "number" && typeof p.end === "number") {
      out.push({ label, start: p.start, end: p.end });
      cursor = Math.max(cursor, p.end);
      continue;
    }
    const continuation = p.word.startsWith("##");
    const piece = p.word.replace(/^(##|▁|Ġ)/, "").toLowerCase();
    if (!piece) continue;
    const prev = out[out.length - 1];
    if (continuation && prev && lower.startsWith(piece, prev.end)) {
      prev.end += piece.length;
      cursor = prev.end;
      continue;
    }
    let idx = lower.indexOf(piece, cursor);
    while (idx >= 0 && !continuation && isWordChar(text[idx - 1])) idx = lower.indexOf(piece, idx + 1);
    if (idx < 0) continue;
    out.push({ label, start: idx, end: idx + piece.length });
    cursor = idx + piece.length;
  }
  return out;
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
