// Messages between the page and the model worker. Types only.
// The worker never sends back error text: it could quote the user's text.
import type { RawPrediction } from "../engine/spans";

export type ToWorker = { type: "load" } | { type: "run"; id: number; text: string };

export type FromWorker =
  | { type: "progress"; file: string; loaded: number; total: number }
  | { type: "ready" }
  | { type: "load-error" }
  /** predictions is null when the chunk is over the model's token limit. */
  | { type: "result"; id: number; predictions: RawPrediction[] | null }
  | { type: "run-error"; id: number };
