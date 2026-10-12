// The rule that keeps the test split frozen: it may be run once, on purpose.

export type GuardResult = { ok: true } | { ok: false; message: string };

export function checkFrozenGuard(i: { split: string; ticked: boolean; resultsExist: boolean; force: boolean }): GuardResult {
  if (i.split !== "test") return { ok: true };
  if (!i.ticked) {
    return { ok: false, message: 'Not run. Tick the box "I understand this is the frozen run and I will not tune on it" first.' };
  }
  if (i.resultsExist && !i.force) {
    return {
      ok: false,
      message:
        "Not run. eval/results/test.json already exists, so the frozen run has been done. " +
        "To run it again on purpose, open this page with ?force=1 at the end of the address.",
    };
  }
  return { ok: true };
}

/** The dev server answers a missing file with its own HTML page, so "exists" means "parses as a results file". */
export function looksLikeResultsJson(text: string): boolean {
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === "object" && v !== null && !Array.isArray(v) && "split" in v && "summary" in v;
  } catch {
    return false;
  }
}
