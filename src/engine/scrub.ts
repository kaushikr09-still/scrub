import { findTokens, formatPlaceholder } from "./placeholder";
import type { Detection, DetectionType } from "./types";

/** The real value behind one placeholder. */
export interface MappedValue {
  type: DetectionType;
  value: string;
}

/**
 * Placeholder key (e.g. "EMAIL_1") → real value. Lives in memory only:
 * never saved, logged or sent anywhere.
 */
export type Mapping = ReadonlyMap<string, MappedValue>;

/** Something in the input already looks like a placeholder. */
export interface ScrubWarning {
  kind: "existing-placeholder";
  token: string;
  start: number;
  end: number;
}

export interface ScrubResult {
  text: string;
  mapping: Mapping;
  warnings: ScrubWarning[];
}

/** Types whose values are the same thing whatever their letter case. */
const CASE_INSENSITIVE: ReadonlySet<DetectionType> = new Set(["EMAIL", "UPI", "PAN", "GSTIN", "IFSC"]);

function sameValueKey(d: Detection): string {
  const v = CASE_INSENSITIVE.has(d.type) ? d.value.toLowerCase() : d.value;
  return `${d.type}\u0000${v}`;
}

/** Fail-closed: refuse broken detections. Messages never include the text. */
function checked(text: string, detections: readonly Detection[]): Detection[] {
  const sorted = [...detections].sort((a, b) => a.start - b.start);
  let prevEnd = 0;
  sorted.forEach((d, i) => {
    if (!(Number.isInteger(d.start) && Number.isInteger(d.end) && 0 <= d.start && d.start < d.end && d.end <= text.length)) {
      throw new Error(`scrub: detection ${i} has an invalid span`);
    }
    if (text.slice(d.start, d.end) !== d.value) {
      throw new Error(`scrub: detection ${i} value does not match the text`);
    }
    if (d.start < prevEnd) throw new Error(`scrub: detections overlap at index ${i}`);
    prevEnd = d.end;
  });
  return sorted;
}

/**
 * Replaces each detection with [TYPE_N]. The same value always gets the
 * same number; everything outside the detections is kept exactly.
 *
 * If the input already contains placeholder-like tokens, they are reported
 * as warnings and new numbers start above the highest one present for that
 * type, so restore can never confuse them with real values.
 */
export function scrub(text: string, detections: readonly Detection[]): ScrubResult {
  const spans = checked(text, detections);
  const insideDetection = (s: number, e: number) => spans.some((d) => s < d.end && e > d.start);
  const scrubbedTypes = new Set<string>(spans.map((d) => d.type));

  const lastUsed = new Map<string, number>();
  const warnings: ScrubWarning[] = [];
  for (const t of findTokens(text)) {
    if (insideDetection(t.start, t.end)) continue;
    const n = Number(t.number);
    if (Number.isSafeInteger(n)) lastUsed.set(t.type, Math.max(lastUsed.get(t.type) ?? 0, n));
    if (t.looksLikePlaceholder || scrubbedTypes.has(t.type)) {
      warnings.push({ kind: "existing-placeholder", token: text.slice(t.start, t.end), start: t.start, end: t.end });
    }
  }

  const mapping = new Map<string, MappedValue>();
  const placeholderFor = new Map<string, string>();
  let out = "";
  let pos = 0;
  for (const d of spans) {
    const valueKey = sameValueKey(d);
    let placeholder = placeholderFor.get(valueKey);
    if (!placeholder) {
      const n = (lastUsed.get(d.type) ?? 0) + 1;
      lastUsed.set(d.type, n);
      placeholder = formatPlaceholder(d.type, n);
      placeholderFor.set(valueKey, placeholder);
      mapping.set(`${d.type}_${n}`, { type: d.type, value: d.value });
    }
    out += text.slice(pos, d.start) + placeholder;
    pos = d.end;
  }
  out += text.slice(pos);
  return { text: out, mapping, warnings };
}
