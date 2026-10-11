// Turns a model's token predictions into character spans in the original text.
// Pure code: no model, no browser, no network. Shared by the app and the dev-only bake-off.

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
  score?: number;
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
    const score = p.score;
    if (typeof p.start === "number" && typeof p.end === "number") {
      out.push(score === undefined ? { label, start: p.start, end: p.end } : { label, start: p.start, end: p.end, score });
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
    out.push(score === undefined ? { label, start: idx, end: idx + piece.length } : { label, start: idx, end: idx + piece.length, score });
    cursor = idx + piece.length;
  }
  return out;
}
