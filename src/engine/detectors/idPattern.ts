import { makeCandidate } from "../context";
import type { Candidate, DetectionType } from "../types";

/**
 * Shared finder for letter+digit codes (PAN, IFSC, GSTIN). The code must not
 * touch other letters, digits, "_" or "@". Upper or lower case is accepted;
 * anything not fully uppercase gets `lowerPenalty` taken off the base.
 */
export function findIdPattern(
  text: string,
  type: DetectionType,
  body: string,
  base: number,
  lowerPenalty: number,
  keywords: readonly string[],
  validate?: (upper: string) => boolean,
): Candidate[] {
  const re = new RegExp(`(?<![A-Za-z0-9_@])${body}(?![A-Za-z0-9_@])`, "gi");
  const out: Candidate[] = [];
  for (const m of text.matchAll(re)) {
    const upper = m[0].toUpperCase();
    if (validate && !validate(upper)) continue;
    const conf = upper === m[0] ? base : base - lowerPenalty;
    out.push(makeCandidate(text, type, m.index, m.index + m[0].length, conf, keywords, !!validate));
  }
  return out;
}
