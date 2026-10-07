import { makeCandidate } from "../context";
import { digitSpans } from "../digits";
import { isValidLuhn } from "../luhn";
import type { Candidate, Detector } from "../types";

const KEYWORDS = [
  "card", "card no", "credit", "debit", "visa", "mastercard", "rupay", "amex", "cc",
];

const BASE = 0.85; // [assumed]

/**
 * 13-19 digits that pass Luhn. Any single-space or dash grouping.
 * Note: about 1 in 10 random long numbers also pass Luhn.
 */
function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const span of digitSpans(text, 13, 19)) {
    if (!isValidLuhn(span.digits)) continue;
    out.push(makeCandidate(text, "CARD", span.start, span.end, BASE, KEYWORDS, true));
  }
  return out;
}

export const card: Detector = { type: "CARD", find };
