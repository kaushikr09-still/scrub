import { hasNearbyKeyword, makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["salary", "ctc", "package", "amount", "fee", "paid", "balance", "stipend"];
// Money words that let a short unit (L, Cr, K, M) stand without a currency mark.
const SHORT_UNIT_WORDS = ["salary", "ctc", "package", "amount", "fee", "paid", "balance"];

const BASE_CURRENCY = 0.85; // [assumed]
const BASE_UNIT_ONLY = 0.7; // [assumed]

// Indian grouping (1,00,000), Western grouping (100,000) or plain digits,
// with up to 2 decimals. Must not run on into more digits.
const NUM =
  String.raw`(?:\d{1,3}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?!\d|[.,]\d)`;
// [assumed] "rupee(s)" added; any letter case.
const CURRENCY_BEFORE = String.raw`(?:₹|rs\.?|inr|rupees?)`;
// [assumed] no dot after a trailing "Rs" (it is usually a full stop).
const CURRENCY_AFTER = String.raw`(?:₹|rs|inr|rupees?)`;
const LONG_UNIT = String.raw`(?:lakhs?|lacs?|crores?|lpa)`;
// [assumed] "Mn" added beside M.
const SHORT_UNIT = String.raw`(?:l|cr|k|mn|m)`;
const ANY_UNIT = `(?:${LONG_UNIT}|${SHORT_UNIT})`;
const NOT_WORD_BEFORE = String.raw`(?<![A-Za-z0-9_])`;
const NOT_NUMBER_BEFORE = String.raw`(?<![A-Za-z0-9_.,])`;
const NOT_WORD_AFTER = String.raw`(?![A-Za-z0-9_])`;

// ₹5,000 · Rs. 5,000/- · INR 1.5M · ₹12 LPA. [assumed] "/-" kept in the span.
const PREFIXED = new RegExp(
  `${NOT_WORD_BEFORE}${CURRENCY_BEFORE}\\s*${NUM}(?:\\s*${ANY_UNIT})?(?:\\/-)?${NOT_WORD_AFTER}`,
  "gi",
);
// 5000 INR · 5,000 Rs · 500 rupees · 2 lakh INR.
const SUFFIXED = new RegExp(
  `${NOT_NUMBER_BEFORE}${NUM}(?:\\s*${ANY_UNIT})?\\s*${CURRENCY_AFTER}${NOT_WORD_AFTER}`,
  "gi",
);
// 12 LPA · 5 lakh · 1.2 crore.
const LONG = new RegExp(`${NOT_NUMBER_BEFORE}${NUM}\\s*${LONG_UNIT}${NOT_WORD_AFTER}`, "gi");
// 12L · 50K · 1.5 Cr — only near a money word.
const SHORT = new RegExp(`${NOT_NUMBER_BEFORE}${NUM}\\s*${SHORT_UNIT}${NOT_WORD_AFTER}`, "gi");

/**
 * Indian rupee amounts. A bare number is never money. Other currencies are
 * out of scope.
 */
function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  const add = (re: RegExp, base: number, needsWord = false) => {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (needsWord && !hasNearbyKeyword(text, start, end, SHORT_UNIT_WORDS)) continue;
      out.push(makeCandidate(text, "MONEY", start, end, base, KEYWORDS, false));
    }
  };
  add(PREFIXED, BASE_CURRENCY);
  add(SUFFIXED, BASE_CURRENCY);
  add(LONG, BASE_UNIT_ONLY);
  add(SHORT, BASE_UNIT_ONLY, true);
  // Keep only the widest reading of each amount ("₹12 LPA", not also "12 LPA").
  return out.filter(
    (c) => !out.some((o) => o !== c && o.start <= c.start && o.end >= c.end && o.end - o.start > c.end - c.start),
  );
}

export const money: Detector = { type: "MONEY", find };
