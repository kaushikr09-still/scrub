/** Types the rules engine can detect. More are added in later tasks. */
export type DetectionType =
  | "EMAIL"
  | "PHONE"
  | "AADHAAR"
  | "PAN"
  | "GSTIN"
  | "IFSC"
  | "UPI"
  | "CARD";

/**
 * One detected span. `start`/`end` are string offsets (end exclusive) and
 * `value` is exactly text.slice(start, end). `confidence` is informational
 * only: every detection is masked regardless of its score.
 */
export interface Detection {
  type: DetectionType;
  start: number;
  end: number;
  value: string;
  confidence: number;
}

/**
 * A detection plus the facts the overlap resolver needs to apply the SPEC
 * precedence: (1) checksum-valid, (2) label/context, (3) other.
 */
export interface Candidate extends Detection {
  checksum: boolean;
  contextHit: boolean;
}

/** Every type lives in its own file and exports one of these. */
export interface Detector {
  type: DetectionType;
  find(text: string): Candidate[];
}
