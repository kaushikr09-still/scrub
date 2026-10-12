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
      // A word is a name if any of its pieces is: keep a name label even when the first piece was "O".
      if (prev.label === "O" && label !== "O" && label !== "") prev.label = label;
      cursor = prev.end;
      continue;
    }
    // The model's tokens come in text order, so the next one normally sits right at the cursor (after spaces).
    // Take it there first: this keeps punctuation stuck to a word ("Amit:", "Name:") in step.
    let at = cursor;
    if (!continuation) while (at < text.length && /\s/.test(text[at])) at++;
    let idx = lower.startsWith(piece, at) ? at : -1;
    if (idx < 0 && isWordChar(piece[0])) {
      // Not there: tokens were dropped (or the model could not read a character). Search ahead for a word, but
      // never into the middle of another word.
      idx = lower.indexOf(piece, cursor);
      while (idx >= 0 && !continuation && isWordChar(text[idx - 1])) idx = lower.indexOf(piece, idx + 1);
    }
    // A punctuation token that is not at the cursor is skipped, never searched for further on: a later
    // match would carry the cursor past real names.
    if (idx < 0) continue;
    out.push(score === undefined ? { label, start: idx, end: idx + piece.length } : { label, start: idx, end: idx + piece.length, score });
    cursor = idx + piece.length;
  }
  return out;
}

// A word is any run of Unicode letters, digits and combining marks. An apostrophe (straight or curly) or a
// hyphen between two of those stays inside the word, except a trailing possessive 's, which is left outside
// so "Priya's" is masked as "[PERSON_1]'s" and Priya and Priya's get the same placeholder.
const WORD_CHAR = /^[\p{L}\p{N}\p{M}]$/u;
const JOINERS = new Set(["'", "’", "-"]);

const isWordPoint = (ch: string): boolean => ch !== "" && WORD_CHAR.test(ch);

/** The code point that starts at i, or "" past the end. */
function charAt(text: string, i: number): string {
  const cp = text.codePointAt(i);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}

/** The code point that ends at i, or "" at the start. */
function charBefore(text: string, i: number): string {
  if (i <= 0) return "";
  const low = text.charCodeAt(i - 1);
  if (low >= 0xdc00 && low <= 0xdfff && i >= 2) {
    const high = text.charCodeAt(i - 2);
    if (high >= 0xd800 && high <= 0xdbff) return text.slice(i - 2, i);
  }
  return text[i - 1];
}

/** A trailing 's: the apostrophe at i is followed by s or S and then a non-word character. */
function isPossessive(text: string, i: number): boolean {
  const next = text[i + 1];
  return (next === "s" || next === "S") && !isWordPoint(charAt(text, i + 2));
}

/**
 * Grows [start, end) outward to whole-word edges, so no letter or digit is left touching the span.
 * Never shrinks the span and never crosses a space or other punctuation into a neighbouring word.
 */
export function snapToWords(text: string, start: number, end: number): { start: number; end: number } {
  if (end <= start) return { start, end };
  for (;;) {
    const c = charBefore(text, start);
    if (isWordPoint(c)) {
      start -= c.length;
    } else if (JOINERS.has(c) && isWordPoint(charBefore(text, start - c.length)) && isWordPoint(charAt(text, start))) {
      start -= c.length;
    } else break;
  }
  for (;;) {
    const c = charAt(text, end);
    if (isWordPoint(c)) {
      end += c.length;
    } else if (JOINERS.has(c) && isWordPoint(charBefore(text, end)) && isWordPoint(charAt(text, end + c.length))) {
      if (c !== "-" && isPossessive(text, end)) break;
      end += c.length;
    } else break;
  }
  return { start, end };
}
