// Makes a title-case copy of long ALL CAPS runs, for the name model only.
// The copy has exactly the same length and character positions as the original, so a span found on the
// copy points at the same characters in the original. The original is never changed, and rules always
// run on the original. Pure code: no model, no browser, no network.

/** Words that are normally written in capitals. A run made only of these is left alone. */
const ACRONYMS = new Set(["PAN", "GST", "GSTIN", "IFSC", "UPI", "OTP", "NEFT", "RTGS", "IMPS", "KYC", "CTC", "CGPA", "PDF", "FAQ", "ASAP"]);

const WORD = /\p{L}+(?:['’-]\p{L}+)*/gu;
const ALL_UPPER = /^\p{Lu}+(?:['’-]\p{Lu}+)*$/u;
const isJoiner = (ch: string): boolean => ch === "'" || ch === "’" || ch === "-";

interface Word {
  start: number;
  end: number;
}

/** True if this word is 2+ uppercase letters and is not stuck to digits or an underscore. */
function qualifies(text: string, w: Word): boolean {
  const word = text.slice(w.start, w.end);
  if (!ALL_UPPER.test(word)) return false;
  if (word.replace(/['’-]/g, "").length < 2) return false;
  return !/[\p{N}_]/u.test(text[w.start - 1] ?? "") && !/[\p{N}_]/u.test(text[w.end] ?? "");
}

/** Title-case one word: first letter and the letter after a hyphen stay capital; after an apostrophe only for O'Brien-style. */
function titleCase(word: string): string {
  let out = "";
  let capitalNext = true;
  let segmentLength = 0;
  for (const ch of word) {
    if (isJoiner(ch)) {
      capitalNext = ch === "-" || segmentLength === 1;
      segmentLength = 0;
      out += ch;
    } else {
      out += capitalNext ? ch : ch.toLowerCase();
      capitalNext = false;
      segmentLength++;
    }
  }
  return out;
}

/** A run is safe only if no character in it changes length when lowercased. */
function keepsLength(run: string): boolean {
  for (const ch of run) if (ch.toLowerCase().length !== ch.length) return false;
  return true;
}

/**
 * A run is 2 or more ALL CAPS words (2+ letters each) separated by single spaces. Punctuation other than an
 * inner apostrophe or hyphen ends a run. Runs of only known acronyms, and runs that would change length, stay as they are.
 */
export function normaliseCapsRuns(text: string): string {
  const words: Word[] = [];
  for (const m of text.matchAll(WORD)) words.push({ start: m.index, end: m.index + m[0].length });

  let out = "";
  let cursor = 0;
  let i = 0;
  while (i < words.length) {
    if (!qualifies(text, words[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < words.length && qualifies(text, words[j + 1]) && text.slice(words[j].end, words[j + 1].start) === " ") j++;
    const run = words.slice(i, j + 1);
    i = j + 1;
    if (run.length < 2) continue;
    const slices = run.map((w) => text.slice(w.start, w.end));
    if (slices.every((s) => ACRONYMS.has(s))) continue;
    const from = run[0].start;
    const original = text.slice(from, run[run.length - 1].end);
    if (!keepsLength(original)) continue;
    const changed = original.replace(WORD, titleCase);
    if (changed.length !== original.length) continue;
    out += text.slice(cursor, from) + changed;
    cursor = from + original.length;
  }
  return out + text.slice(cursor);
}
