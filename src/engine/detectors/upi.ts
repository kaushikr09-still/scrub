import { makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["upi", "upi id", "vpa", "gpay", "google pay", "phonepe", "paytm", "bhim"];

const BASE = 0.75; // [assumed]

/**
 * handle@provider where the provider is letters only with no dot after it
 * (a dot would make it an email). No list of known providers is used.
 * [assumed] handle is 2+ characters of letters, digits, ".", "_" or "-";
 * provider is 2-20 letters.
 */
const UPI = new RegExp(
  String.raw`(?<![A-Za-z0-9._@-])[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z]{2,20}` +
    String.raw`(?![A-Za-z0-9_@]|[./-][A-Za-z0-9])`,
  "g",
);

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(UPI)) {
    out.push(makeCandidate(text, "UPI", m.index, m.index + m[0].length, BASE, KEYWORDS, false));
  }
  return out;
}

export const upi: Detector = { type: "UPI", find };
