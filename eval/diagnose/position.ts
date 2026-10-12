// Says where a name sits in a document: after a chat time stamp, a greeting, a label, a sign-off, alone on its
// line, or inside a sentence. Used only by the dev diagnosis. Pure code.

export type Position = "chat_speaker" | "greeting" | "label" | "signoff" | "alone" | "sentence";

export interface Where {
  position: Position;
  /** The label text for "label" (for example "Father's Name"). */
  label?: string;
}

const TIME_PREFIX = /^[ \t]*\[?(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\]?\s*[-–—]?\s*$/i;
const GREETING = /(?:^|[\s,;(])(?:dear|hi|hii|hello|hey)\s+(?:(?:mr|mrs|ms|miss|dr|shri|smt|sri|prof)\.?\s+)?$/i;
const LABEL = /(?:^|[|,;]\s*)(\p{L}[\p{L}'’ ./]{1,30}?)\s*[:\-–]\s*$/u;
const SIGNOFF = /^\s*(?:(?:with\s+)?(?:warm(?:est)?|kind(?:est)?|best|best\s+wishes|many)?\s*regards|thanks|thank\s+you|thanks\s+and\s+regards|best|sincerely|yours\s+(?:sincerely|faithfully)|cheers|cordially)\s*[,.!]?\s*$/i;

export function positionOf(text: string, start: number, end: number): Where {
  const ls = text.lastIndexOf("\n", start - 1) + 1;
  let le = text.indexOf("\n", end);
  if (le < 0) le = text.length;
  const before = text.slice(ls, start);
  const after = text.slice(end, le);

  if (TIME_PREFIX.test(before) && /^\s*:/.test(after)) return { position: "chat_speaker" };
  if (GREETING.test(before)) return { position: "greeting" };
  const label = LABEL.exec(before);
  if (label) return { position: "label", label: label[1].trim() };
  if (/^\s*$/.test(before) && /^\s*$/.test(after)) {
    let p = ls - 1; // the "\n" that ends the previous line
    while (p > 0) {
      const prevStart = text.lastIndexOf("\n", p - 1) + 1;
      const line = text.slice(prevStart, p);
      if (/\S/.test(line)) return SIGNOFF.test(line) ? { position: "signoff" } : { position: "alone" };
      p = prevStart - 1;
    }
    return { position: "alone" };
  }
  return { position: "sentence" };
}
