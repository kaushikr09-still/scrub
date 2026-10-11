// Finds names, organisations and places with a model, without importing one.
// The model is injected as a "runner", so this file and its tests need no model, browser or network.
import { normaliseCapsRuns } from "./capsNormalise";
import { locatePredictions, snapToWords, type Located, type RawPrediction } from "./spans";
import type { Detection, DetectionType } from "./types";

/** The model reads at most 512 tokens (including 2 special ones). The worker refuses chunks over this. */
export const MAX_MODEL_TOKENS = 500;
/**
 * First-try chunk size in characters. Ordinary English is roughly 4 to 5 characters per token, so this is
 * usually 250 to 350 tokens. Text heavy in digits or symbols can be close to 1 token per character, which
 * would be too long: the worker then says so (returns null) and the chunk is split in two and retried.
 */
export const CHUNK_CHARS = 1200;
/** Neighbouring chunks share this many characters, so a name cut by one chunk is whole in the next. */
export const OVERLAP_CHARS = 200;
/** A piece this short that still does not fit means the text cannot be fully checked. */
export const MIN_CHUNK_CHARS = 24;

/**
 * Runs the model on one chunk. Returns its token predictions, or null if the chunk is over the model's
 * token limit (the caller then splits it and tries again). Rejects if the model fails.
 */
export type NameRunner = (chunk: string) => Promise<RawPrediction[] | null>;

/** Part of the text could not be checked. Its message never contains any of the text. */
export class NamesIncompleteError extends Error {
  constructor() {
    super("names: part of the text could not be checked");
    this.name = "NamesIncompleteError";
  }
}

/** The model failed. Its message never contains any of the text, and the original error is dropped. */
export class NamesFailedError extends Error {
  constructor() {
    super("names: the model failed");
    this.name = "NamesFailedError";
  }
}

export interface ChunkRange {
  start: number;
  end: number;
}

const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/**
 * Splits text into overlapping ranges of at most `size` characters. Cuts fall on whitespace when there is
 * any in reach, so words are not split; text with no spaces is cut hard. Always makes progress.
 */
export function planChunks(text: string, size: number, overlap: number): ChunkRange[] {
  const out: ChunkRange[] = [];
  if (text.length === 0) return out;
  let start = 0;
  for (;;) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const floor = start + Math.ceil(size / 2);
      let e = end;
      while (e > floor && !isSpace(text[e])) e--;
      if (isSpace(text[e])) end = e;
    }
    out.push({ start, end });
    if (end >= text.length) break;
    const earliest = Math.max(end - overlap, start + 1);
    let next = earliest;
    while (next < end && !isSpace(text[next - 1])) next++; // start the next chunk at the beginning of a word
    start = next < end ? next : earliest;
  }
  return out;
}

/** PER becomes PERSON; ORG and LOC are kept; MISC and everything else is ignored. */
export function mapLabel(label: string): DetectionType | null {
  switch (label.replace(/^[BIES][-_]/i, "").toUpperCase()) {
    case "PER":
    case "PERSON":
      return "PERSON";
    case "ORG":
      return "ORG";
    case "LOC":
      return "LOC";
    default:
      return null;
  }
}

interface Span {
  type: DetectionType;
  start: number;
  end: number;
  score: number;
}

/** Groups token spans into entity spans: a B- label starts a new one; an I- label continues the last. */
function group(piece: string, located: Located[], offset: number): Span[] {
  const out: Span[] = [];
  let cur: Span | null = null;
  for (const l of located) {
    const type = mapLabel(l.label);
    if (type === null) {
      cur = null;
      continue;
    }
    const begins = /^B[-_]/i.test(l.label);
    const score = l.score ?? 0.5;
    if (cur && cur.type === type && !begins && l.start >= cur.end - offset && /^\s*$/.test(piece.slice(cur.end - offset, l.start))) {
      cur.end = offset + l.end;
      cur.score = Math.min(cur.score, score);
    } else {
      cur = { type, start: offset + l.start, end: offset + l.end, score };
      out.push(cur);
    }
  }
  return out;
}

/** Merges duplicates from overlapping chunks: same type overlapping is unioned; different types keep the longer. */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (!last || s.start >= last.end) {
      out.push({ ...s });
    } else if (s.type === last.type) {
      last.end = Math.max(last.end, s.end);
      last.score = Math.min(last.score, s.score);
    } else if (s.end - s.start > last.end - last.start) {
      out[out.length - 1] = { ...s };
    }
  }
  return out;
}

export interface FindNamesOptions {
  size?: number;
  overlap?: number;
  minSize?: number;
}

/**
 * Finds PERSON, ORG and LOC spans in `text`. Never silently skips text: if any part cannot be checked it
 * throws NamesIncompleteError, and if the model fails it throws NamesFailedError. Either way the caller
 * must treat the names as NOT checked.
 */
export async function findNames(text: string, runner: NameRunner, options: FindNamesOptions = {}): Promise<Detection[]> {
  const minSize = options.minSize ?? MIN_CHUNK_CHARS;
  // The model reads a same-length title-case copy of long ALL CAPS runs. Everything below that is not the
  // model call (spans, values, rules) uses the original `text`, so positions need no mapping.
  const modelText = normaliseCapsRuns(text);
  const spans: Span[] = [];

  async function checkRange(from: number, to: number, size: number, overlap: number): Promise<void> {
    for (const c of planChunks(modelText.slice(from, to), size, overlap)) await checkChunk(from + c.start, from + c.end);
  }

  async function checkChunk(start: number, end: number): Promise<void> {
    const piece = modelText.slice(start, end);
    if (!/\S/.test(piece)) return;
    let predictions: RawPrediction[] | null;
    try {
      predictions = await runner(piece);
    } catch {
      throw new NamesFailedError();
    }
    if (predictions === null) {
      const length = end - start;
      if (length <= minSize) throw new NamesIncompleteError();
      const half = Math.min(Math.ceil(length * 0.6), length - 1);
      await checkRange(start, end, half, Math.min(options.overlap ?? OVERLAP_CHARS, Math.floor(length / 5)));
      return;
    }
    spans.push(...group(piece, locatePredictions(piece, predictions), start));
  }

  await checkRange(0, text.length, options.size ?? CHUNK_CHARS, options.overlap ?? OVERLAP_CHARS);

  const found: Detection[] = [];
  // Snap every model span outward to whole words first: the model often labels only the first piece of a
  // word ("P" of "Priya"), and the rest must never be left touching the placeholder.
  const snapped = spans.map((s) => {
    const raw = text.slice(s.start, s.end);
    const start = s.start + (raw.length - raw.trimStart().length);
    const end = s.end - (raw.length - raw.trimEnd().length);
    return end > start ? { ...s, ...snapToWords(text, start, end) } : s;
  });
  for (const s of mergeSpans(snapped)) {
    const raw = text.slice(s.start, s.end);
    const start = s.start + (raw.length - raw.trimStart().length);
    const end = s.end - (raw.length - raw.trimEnd().length);
    if (end <= start) continue;
    const value = text.slice(start, end);
    if (!/\p{L}/u.test(value)) continue; // a name has letters; stray digits or punctuation are not one
    found.push({ type: s.type, start, end, value, confidence: s.score });
  }
  return found;
}

/**
 * Adds model names to rule detections using the SPEC precedence: the model is last, so a rule detection
 * always wins where they overlap. A model span keeps only the part no rule covers.
 */
export function combineDetections(text: string, rules: readonly Detection[], names: readonly Detection[]): Detection[] {
  const out: Detection[] = [...rules];
  for (const n of names) {
    let pieces: ChunkRange[] = [{ start: n.start, end: n.end }];
    for (const r of rules) {
      pieces = pieces.flatMap((p) => {
        if (r.end <= p.start || r.start >= p.end) return [p];
        const left: ChunkRange[] = r.start > p.start ? [{ start: p.start, end: r.start }] : [];
        const right: ChunkRange[] = r.end < p.end ? [{ start: r.end, end: p.end }] : [];
        return [...left, ...right];
      });
    }
    for (const p of pieces) {
      const raw = text.slice(p.start, p.end);
      const start = p.start + (raw.length - raw.trimStart().length);
      const end = p.end - (raw.length - raw.trimEnd().length);
      const value = text.slice(start, end);
      if (end > start && /\p{L}/u.test(value)) out.push({ type: n.type, start, end, value, confidence: n.confidence });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
