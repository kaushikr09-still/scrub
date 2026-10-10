import { makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["dob", "d.o.b", "date of birth", "birth date", "birthdate", "born", "birthday"];

const BASE = 0.6; // [assumed]

// Not part of a longer word, number or ID like "INV12-05-2024" or "10.12.05.2024".
const START = String.raw`(?<![A-Za-z0-9_]|\d[./-])`;
const END = String.raw`(?![A-Za-z0-9_]|[./-]\d)`;

// [assumed] full names, 3-letter forms and "Sept", any case, optional dot.
const MONTH =
  String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|` +
  String.raw`sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![A-Za-z])\.?`;
const DAY = String.raw`(?:3[01]|[12]\d|0?[1-9])(?:st|nd|rd|th)?`;
// [assumed] 4-digit years 1900-2099, or '24 / ’24.
const YEAR = String.raw`(?:(?:19|20)\d\d|['’]\d\d)`;

// 12/05/2024, 12-05-24, 12.05.2024 (same separator twice).
const NUMERIC = new RegExp(String.raw`${START}(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})${END}`, "g");
// [assumed] ISO 2024-05-12.
const ISO = new RegExp(String.raw`${START}(\d{4})-(\d{1,2})-(\d{1,2})${END}`, "g");
// 12 May 2024, 12th of May, 2024, 12-May-2024, 12 Mar '24.
const DAY_MONTH_YEAR = new RegExp(
  String.raw`${START}${DAY}(?:\s+of)?(?:\s+|-)${MONTH},?(?:\s+|-)${YEAR}${END}`,
  "gi",
);
// May 12, 2024 / May 12th 2024.
const MONTH_DAY_YEAR = new RegExp(String.raw`${START}${MONTH}\s+${DAY},?\s+${YEAR}${END}`, "gi");
// [assumed] Directly after a birth label (optionally "in"/"on"): "May 1990" or "1990".
const AFTER_BIRTH_LABEL = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?:dob|d\.o\.b\.?|date\s+of\s+birth|birth\s*date|born)` +
    String.raw`[\s:.\-–]*(?:(?:in|on)\s+)?(?<value>(?:${MONTH},?\s+)?(?:19|20)\d\d)${END}`,
  "gi",
);

const part = (s: string) => Number(s) >= 1 && Number(s) <= 31;

/**
 * [assumed] Day and month are not told apart: both must be 1-31 and at least
 * one of them 12 or less.
 */
function plausible(a: string, b: string): boolean {
  return part(a) && part(b) && (Number(a) <= 12 || Number(b) <= 12);
}

function validYear(y: string, sep: string): boolean {
  if (y.length === 2) return sep !== "."; // [assumed] 10.2.33 is a version, not a date
  return /^(19|20)\d\d$/.test(y);
}

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  const add = (start: number, end: number) =>
    out.push(makeCandidate(text, "DATE", start, end, BASE, KEYWORDS, false));

  for (const m of text.matchAll(NUMERIC)) {
    const [whole, a, sep, b, y] = m;
    if (plausible(a, b) && validYear(y, sep)) add(m.index, m.index + whole.length);
  }
  for (const m of text.matchAll(ISO)) {
    const [whole, y, a, b] = m;
    if (plausible(a, b) && validYear(y, "-")) add(m.index, m.index + whole.length);
  }
  for (const re of [DAY_MONTH_YEAR, MONTH_DAY_YEAR]) {
    for (const m of text.matchAll(re)) add(m.index, m.index + m[0].length);
  }
  for (const m of text.matchAll(AFTER_BIRTH_LABEL)) {
    const end = m.index + m[0].length;
    add(end - m.groups!.value.length, end);
  }
  return out;
}

export const date: Detector = { type: "DATE", find };
