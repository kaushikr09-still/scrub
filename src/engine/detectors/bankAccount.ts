import { hasNearbyKeyword, makeCandidate } from "../context";
import { digitSpans } from "../digits";
import type { Candidate, Detector } from "../types";

// [assumed] "account number" added beside the requested "account no".
const KEYWORDS = ["a/c", "account no", "account number", "acct", "bank", "ifsc"];

const BASE = 0.65; // [assumed] always gets the keyword boost, so 0.8 in practice

/**
 * 9-18 digits, ONLY when one of KEYWORDS is nearby. A bare long number is
 * never a bank account. [assumed] any single-space or dash grouping.
 * A number that also passes the Aadhaar or card checksum is labelled as that
 * type instead (checksum wins under the SPEC precedence); it is masked anyway.
 */
function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const span of digitSpans(text, 9, 18)) {
    if (!hasNearbyKeyword(text, span.start, span.end, KEYWORDS)) continue;
    out.push(makeCandidate(text, "BANK_ACCOUNT", span.start, span.end, BASE, KEYWORDS, false));
  }
  return out;
}

export const bankAccount: Detector = { type: "BANK_ACCOUNT", find };
