// The file the eval page downloads (results.json) and the report script reads.
import type { Summary } from "./score/score.ts";
import type { ReportMeta } from "./score/tables.ts";

export interface ResultsFile {
  format: 1;
  split: string;
  /** ISO 8601, UTC. */
  runAt: string;
  model: { id: string; dtype: string };
  documents: number;
  /** SHA-256 (hex) of the exact bytes of eval/generated/<split>.jsonl that were scored. */
  jsonlSha256: string;
  durationMs: number;
  /** What the product detected, per document id. */
  detections: Record<string, { type: string; start: number; end: number; confidence: number }[]>;
  summary: Summary;
}

export function metaFrom(r: ResultsFile, commit: string | null, currentJsonlSha256?: string | null): ReportMeta {
  return {
    split: r.split,
    runAt: r.runAt,
    modelId: `${r.model.id} (${r.model.dtype})`,
    documents: r.documents,
    jsonlSha256: r.jsonlSha256,
    commit,
    durationMs: r.durationMs,
    ...(currentJsonlSha256 === undefined ? {} : { currentJsonlSha256 }),
  };
}
