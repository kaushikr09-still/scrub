import { makeCandidate } from "../context";
import { digitSpans } from "../digits";
import type { Candidate, Detector } from "../types";

const KEYWORDS = [
  "phone", "mobile", "mob", "cell", "call", "contact", "whatsapp", "ph", "tel", "telephone",
];

const BASE = 0.7; // [assumed]

/**
 * Indian mobile numbers: 10 digits starting 6-9, optionally preceded by
 * "0", "91" or "+91" (with or without a space/dash). Landlines are not
 * covered. [assumed] a single space or dash may sit between any digits.
 */
function isMobile(digits: string): boolean {
  if (digits.length === 10) return /^[6-9]/.test(digits);
  if (digits.length === 11) return /^0[6-9]/.test(digits);
  if (digits.length === 12) return /^91[6-9]/.test(digits);
  return false;
}

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const span of digitSpans(text, 10, 12)) {
    if (!isMobile(span.digits)) continue;
    let start = span.start;
    if (span.digits.length === 12 && text[start - 1] === "+") start--;
    out.push(makeCandidate(text, "PHONE", start, span.end, BASE, KEYWORDS, false));
  }
  return out;
}

export const phone: Detector = { type: "PHONE", find };
