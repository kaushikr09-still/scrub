import { makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["email", "e-mail", "mail", "mail id", "email id"];

const LOCAL = String.raw`[A-Za-z0-9][A-Za-z0-9._%+-]*`;
const LABEL = String.raw`[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?`;
const TLD = String.raw`[A-Za-z]{2,24}`;
const START = String.raw`(?<![A-Za-z0-9._%+-])`;
const END = String.raw`(?![A-Za-z0-9-])`;

const PLAIN = new RegExp(`${START}${LOCAL}@(?:${LABEL}\\.)+${TLD}${END}`, "g");

// [assumed] Obfuscated forms: "at" in [], (), {} or <>, or as a plain word
// between spaces; "dot" in brackets, as a plain word, or a real ".".
const OPEN = String.raw`[\[({<]`;
const CLOSE = String.raw`[\])}>]`;
const AT = String.raw`(?<at> *${OPEN} *at *${CLOSE} *| +at +|@)`;
const DOT = String.raw`(?: *${OPEN} *dot *${CLOSE} *| +dot +|\.)`;
const OBFUSCATED = new RegExp(
  `${START}${LOCAL}${AT}${LABEL}(?<rest>(?:${DOT}${LABEL})*${DOT}${TLD})${END}`,
  "gi",
);

const BASE_PLAIN = 0.95;
const BASE_BRACKETED = 0.85; // [assumed]
const BASE_WORD_AT = 0.6; // [assumed] "look at google dot com" also matches

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(PLAIN)) {
    out.push(makeCandidate(text, "EMAIL", m.index, m.index + m[0].length, BASE_PLAIN, KEYWORDS, false));
  }
  for (const m of text.matchAll(OBFUSCATED)) {
    const at = m.groups!.at;
    const rest = m.groups!.rest;
    // A real @ with only real dots is a plain email, handled above.
    if (at === "@" && !/dot/i.test(rest)) continue;
    const base = /^ +at +$/i.test(at) ? BASE_WORD_AT : BASE_BRACKETED;
    out.push(makeCandidate(text, "EMAIL", m.index, m.index + m[0].length, base, KEYWORDS, false));
  }
  return out;
}

export const email: Detector = { type: "EMAIL", find };
