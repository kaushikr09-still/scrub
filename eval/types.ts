// Shapes shared by the generator, the scorer, the eval page and the report. Pure types: no code runs from here.

export type TruthType =
  | "PERSON" | "ORG" | "LOC" | "EMAIL" | "PHONE" | "AADHAAR" | "PAN" | "GSTIN" | "IFSC"
  | "UPI" | "PIN" | "CARD" | "BANK_ACCOUNT" | "DATE" | "MONEY" | "URL" | "IP";

export const TRUTH_TYPES: readonly TruthType[] = [
  "PERSON", "ORG", "LOC", "EMAIL", "PHONE", "AADHAAR", "PAN", "GSTIN", "IFSC",
  "UPI", "PIN", "CARD", "BANK_ACCOUNT", "DATE", "MONEY", "URL", "IP",
];

export type PersonPattern =
  | "full" | "initials_first" | "initials_last" | "honorific" | "single" | "ordinary_word" | "multipart";

export type CaseStyle = "title" | "upper" | "lower" | "n/a";

export type PresetName = "resumes" | "emails" | "chats";

export type NegKind = "order" | "ticket" | "invoice" | "ref" | "version";

export interface TruthSpan {
  type: TruthType;
  start: number;
  end: number;
  value: string;
  /** PERSON only; null for every other type. */
  pattern: PersonPattern | null;
  /** How a person name is written. Always "n/a" for non-PERSON spans. */
  caseStyle: CaseStyle;
}

export interface NegSpan {
  start: number;
  end: number;
  value: string;
  kind: NegKind;
}

export interface EvalDoc {
  id: string;
  split: string;
  preset: PresetName;
  template: string;
  text: string;
  truth: TruthSpan[];
  negatives: NegSpan[];
}

export interface Template {
  split: string;
  preset: PresetName;
  id: string;
  text: string;
}

/** What the product's detection path returned for one document. */
export interface Det {
  type: string;
  start: number;
  end: number;
}
