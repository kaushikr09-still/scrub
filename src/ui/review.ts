// Which detections get masked: preset defaults, category tick-boxes, and per-value overrides.
// Pure code with no DOM. The engine still detects everything; this only decides what is masked.
import { sameValueKey } from "../engine/scrub";
import type { Detection, DetectionType } from "../engine/types";

export type PresetId = "resumes" | "business" | "chat";

export const ALL_TYPES: readonly DetectionType[] = [
  "PERSON", "ORG", "LOC", "EMAIL", "PHONE", "AADHAAR", "PAN", "GSTIN", "IFSC", "UPI",
  "PIN", "CARD", "BANK_ACCOUNT", "URL", "IP", "DATE", "MONEY",
];

export const PRESETS: readonly { id: PresetId; label: string; off: readonly DetectionType[] }[] = [
  { id: "resumes", label: "Resumes", off: ["ORG", "LOC"] },
  { id: "business", label: "Business emails", off: [] },
  { id: "chat", label: "Chat logs", off: ["LOC"] },
];

export type CategoryState = Record<DetectionType, boolean>;
/** Per-value choices made in the checklist, keyed by `ReviewRow.key`. true = masked, false = left plain. */
export type Overrides = Record<string, boolean>;

export function defaultsFor(id: PresetId): CategoryState {
  const off = PRESETS.find((p) => p.id === id)?.off ?? [];
  return Object.fromEntries(ALL_TYPES.map((t) => [t, !off.includes(t)])) as CategoryState;
}

export interface ReviewRow {
  key: string;
  type: DetectionType;
  value: string;
  count: number;
  masked: boolean;
}

const keyOf = sameValueKey;

function isMasked(d: Detection, categories: CategoryState, overrides: Overrides): boolean {
  return overrides[keyOf(d)] ?? categories[d.type];
}

/** The detections that will be masked. Same value = all places or none. */
export function filterDetections(found: readonly Detection[], categories: CategoryState, overrides: Overrides): Detection[] {
  return found.filter((d) => isMasked(d, categories, overrides));
}

/** One row per distinct value, in the order first seen. */
export function buildRows(found: readonly Detection[], categories: CategoryState, overrides: Overrides): ReviewRow[] {
  const rows = new Map<string, ReviewRow>();
  for (const d of found) {
    const key = keyOf(d);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { key, type: d.type, value: d.value, count: 1, masked: isMasked(d, categories, overrides) });
  }
  return [...rows.values()];
}
