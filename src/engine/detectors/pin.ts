import { hasNearbyKeyword } from "../context";
import { digitSpans } from "../digits";
import type { Candidate, Detector } from "../types";

// [assumed] "zip" added to the requested words.
const KEYWORDS = ["pin", "pincode", "pin code", "postal", "postal code", "zip"];

// [assumed] Words that make a line look like an address.
const ADDRESS_WORDS = [
  "address", "road", "rd", "street", "marg", "nagar", "colony", "layout", "lane", "sector",
  "block", "cross", "floor", "flat", "apartment", "apartments", "apt", "house", "plot",
  "near", "opp", "village", "district", "dist", "taluk", "tehsil", "mandal",
];

// [assumed] Indian states and union territories, plus a few old/alternative names.
const STATES = [
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat",
  "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh",
  "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "orissa", "punjab",
  "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand",
  "west bengal", "andaman and nicobar", "chandigarh", "dadra and nagar haveli", "daman and diu",
  "delhi", "jammu and kashmir", "ladakh", "lakshadweep", "puducherry", "pondicherry",
];

const ADDRESS_LINE = new RegExp(
  `(?<![A-Za-z0-9])(?:${[...ADDRESS_WORDS, ...STATES].map((w) => w.replace(/ /g, "\\s+")).join("|")})(?![A-Za-z0-9])`,
  "i",
);

// [assumed] How far back on the same line we look for address words.
const LINE_BEFORE = 200;

const CONFIDENCE = 0.8; // [assumed]

/** [assumed] The rest of the line around the span counts as "an address line". */
function onAddressLine(text: string, start: number, end: number): boolean {
  const lineStart = Math.max(text.lastIndexOf("\n", start - 1) + 1, start - LINE_BEFORE);
  const nl = text.indexOf("\n", end);
  const lineEnd = nl === -1 ? text.length : nl;
  return ADDRESS_LINE.test(text.slice(lineStart, start)) || ADDRESS_LINE.test(text.slice(end, lineEnd));
}

/**
 * Indian PIN codes: 6 digits, first digit 1-9, written "560001" or
 * [assumed] "560 001". ONLY when a PIN keyword is nearby or the number sits
 * on an address line. A bare 6-digit number never matches.
 */
function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const span of digitSpans(text, 6, 6)) {
    const value = text.slice(span.start, span.end);
    if (!/^[1-9]\d{5}$|^[1-9]\d{2} \d{3}$/.test(value)) continue;
    const context =
      hasNearbyKeyword(text, span.start, span.end, KEYWORDS) ||
      onAddressLine(text, span.start, span.end);
    if (!context) continue;
    out.push({
      type: "PIN", start: span.start, end: span.end, value, confidence: CONFIDENCE,
      checksum: false, contextHit: true,
    });
  }
  return out;
}

export const pin: Detector = { type: "PIN", find };
