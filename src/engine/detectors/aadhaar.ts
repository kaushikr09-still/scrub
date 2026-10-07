import { makeCandidate } from "../context";
import { digitSpans } from "../digits";
import type { Candidate, Detector } from "../types";
import { isValidAadhaar } from "../verhoeff";

const KEYWORDS = ["aadhaar", "aadhar", "adhaar", "adhar", "uid", "uidai"];

const BASE = 0.85; // [assumed]

/**
 * 12 digits that pass the Verhoeff checksum.
 * [assumed] first digit is 2-9.
 * [assumed] any single-space or dash grouping is allowed, not only 4-4-4.
 */
function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const span of digitSpans(text, 12, 12)) {
    if (!/^[2-9]/.test(span.digits) || !isValidAadhaar(span.digits)) continue;
    out.push(makeCandidate(text, "AADHAAR", span.start, span.end, BASE, KEYWORDS, true));
  }
  return out;
}

export const aadhaar: Detector = { type: "AADHAAR", find };
