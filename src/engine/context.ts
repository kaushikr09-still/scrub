import type { Candidate, DetectionType } from "./types";

// [assumed] How far around a match we look for a keyword, and how much it adds.
const WINDOW_BEFORE = 40;
const WINDOW_AFTER = 20;
const BOOST = 0.15;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when one of `keywords` appears as a whole word within a short window
 * before or after the span. Case-insensitive; spaces in a keyword match any
 * run of whitespace.
 */
export function hasNearbyKeyword(
  text: string,
  start: number,
  end: number,
  keywords: readonly string[],
): boolean {
  const before = text.slice(Math.max(0, start - WINDOW_BEFORE), start);
  const after = text.slice(end, end + WINDOW_AFTER);
  return keywords.some((kw) => {
    const body = kw.split(/\s+/).map(escapeRegExp).join("\\s+");
    const re = new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "i");
    return re.test(before) || re.test(after);
  });
}

/** Builds a candidate, applying the keyword boost. */
export function makeCandidate(
  text: string,
  type: DetectionType,
  start: number,
  end: number,
  baseConfidence: number,
  keywords: readonly string[],
  checksum: boolean,
): Candidate {
  const contextHit = hasNearbyKeyword(text, start, end, keywords);
  const confidence = Math.min(1, baseConfidence + (contextHit ? BOOST : 0));
  return {
    type,
    start,
    end,
    value: text.slice(start, end),
    confidence: Math.round(confidence * 100) / 100,
    checksum,
    contextHit,
  };
}
