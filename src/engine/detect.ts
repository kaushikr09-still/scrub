import { DETECTORS } from "./detectors";
import type { Candidate, Detection, Detector } from "./types";

/** SPEC precedence: (1) checksum-valid, (2) label/context, (3) other. */
function tier(c: Candidate): number {
  if (c.checksum) return 1;
  if (c.contextHit) return 2;
  return 3;
}

/**
 * Keeps the best non-overlapping candidates: lower tier first, then the
 * longer span, then the earlier one. Result is in reading order.
 */
function resolve(candidates: Candidate[]): Candidate[] {
  const ranked = [...candidates].sort(
    (a, b) =>
      tier(a) - tier(b) ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  );
  const kept: Candidate[] = [];
  for (const c of ranked) {
    if (kept.every((k) => c.end <= k.start || c.start >= k.end)) kept.push(c);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * Finds personal details in `text`. Every result should be masked; the
 * confidence score is informational only.
 */
export function detect(text: string, detectors: readonly Detector[] = DETECTORS): Detection[] {
  const candidates = detectors.flatMap((d) => d.find(text));
  return resolve(candidates).map(({ type, start, end, value, confidence }) => ({
    type, start, end, value, confidence,
  }));
}
