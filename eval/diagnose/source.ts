// The diagnosis may only ever read the dev split. This is the one place that names the file it reads.
export const DIAGNOSE_SPLIT = "dev";
export const DIAGNOSE_URL = `/eval/generated/${DIAGNOSE_SPLIT}.jsonl`;

/** Throws for anything but "dev", so a typo or a ?split=test in the address can never reach the frozen split. */
export function assertDevSplit(split: string): void {
  if (split !== DIAGNOSE_SPLIT) throw new Error("the diagnosis reads the dev split only");
}
