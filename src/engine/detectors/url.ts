import { makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["url", "link", "website", "site", "web", "portfolio", "blog", "linkedin", "github"];

const BASE_SCHEME = 0.95;
const BASE_WWW = 0.9; // [assumed]
const BASE_BARE = 0.75; // [assumed]

// [assumed] Endings that make a bare "name.ending" a web address. File
// endings like pdf, py, docx are deliberately absent. Longer ones first.
const ENDINGS = [
  "co.in", "org.in", "net.in", "ac.in", "gov.in", "nic.in", "co.uk",
  "com", "in", "org", "net", "edu", "gov", "io", "ai", "dev", "app", "me", "co",
  "info", "biz", "xyz", "tech", "online", "site", "store", "uk", "us",
];

const LABEL = String.raw`[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?`;
const REST = String.raw`[^\s<>"'\`]*`;
// [assumed] Not right after an email local part, "@", "/", "_" or another dot.
const START = String.raw`(?<![A-Za-z0-9._%+@/\\-])`;

const SCHEME = new RegExp(String.raw`(?<![A-Za-z0-9])https?:\/\/[^\s<>"'\`]+`, "gi");
const WWW = new RegExp(
  String.raw`${START}www\.(?:${LABEL}\.)+[A-Za-z]{2,24}(?![A-Za-z0-9_@-])(?::\d{1,5})?(?:\/${REST})?`,
  "gi",
);
// [assumed] The ending must be lower case, so "done.In we left" is not a URL;
// the rest of the domain may be any case.
const BARE = new RegExp(
  String.raw`${START}(?:${LABEL}\.)+(?:${ENDINGS.map((e) => e.replace(".", "\\.")).join("|")})` +
    String.raw`(?![A-Za-z0-9_@-])(?::\d{1,5})?(?:\/${REST})?`,
  "g",
);

/** Drops trailing punctuation, and a ")" with no matching "(" inside. */
function trimEnd(s: string): string {
  for (;;) {
    const last = s[s.length - 1];
    if (/[.,;:!?'"’”\]}>]/.test(last)) {
      s = s.slice(0, -1);
    } else if (last === ")" && s.split("(").length < s.split(")").length) {
      s = s.slice(0, -1);
    } else {
      return s;
    }
  }
}

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  const add = (re: RegExp, base: number, skip?: (v: string) => boolean) => {
    for (const m of text.matchAll(re)) {
      const value = trimEnd(m[0]);
      if (skip?.(value) || !value.includes(".")) continue;
      out.push(makeCandidate(text, "URL", m.index, m.index + value.length, base, KEYWORDS, false));
    }
  };
  add(SCHEME, BASE_SCHEME);
  add(WWW, BASE_WWW);
  add(BARE, BASE_BARE, (v) => /^www\./i.test(v));
  return out;
}

export const url: Detector = { type: "URL", find };
