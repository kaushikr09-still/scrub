/**
 * Finds numbers that may be written with separators, e.g. "98765 43210",
 * "2341-2341-2346" or "9 8 7 6 5 4 3 2 1 0".
 *
 * A "run" is digit groups joined by a single space or dash. Inside a run we
 * offer every sub-span of whole groups, but only cut at spaces (never at
 * dashes, so "2024-9876543210" stays one 14-digit thing).
 */

export interface DigitSpan {
  start: number;
  end: number;
  /** The digits only, separators removed. */
  digits: string;
}

interface Run {
  groups: { start: number; end: number }[];
  /** seps[i] is the separator between groups[i] and groups[i + 1]. */
  seps: string[];
}

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isAlnum = (c: string | undefined) => c !== undefined && /[A-Za-z0-9]/.test(c);

function findRuns(text: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < text.length) {
    if (!isDigit(text[i])) {
      i++;
      continue;
    }
    const run: Run = { groups: [], seps: [] };
    for (;;) {
      const gStart = i;
      while (isDigit(text[i])) i++;
      run.groups.push({ start: gStart, end: i });
      const sep = text[i];
      if ((sep === " " || sep === "-") && isDigit(text[i + 1])) {
        run.seps.push(sep);
        i++;
      } else {
        break;
      }
    }
    runs.push(run);
  }
  return runs;
}

/**
 * [assumed] A number is not a standalone value when it touches a letter,
 * underscore or "@", or a "." or "/" that continues into more letters/digits
 * (version numbers, decimals, dates, IDs like ORD123, handles like 98..@ybl).
 */
function cleanBefore(text: string, start: number): boolean {
  const c = text[start - 1];
  if (c === undefined) return true;
  if (/[A-Za-z_@]/.test(c)) return false;
  if ((c === "." || c === "/") && isAlnum(text[start - 2])) return false;
  return true;
}

function cleanAfter(text: string, end: number): boolean {
  const c = text[end];
  if (c === undefined) return true;
  if (/[A-Za-z_@]/.test(c)) return false;
  if ((c === "." || c === "/") && isAlnum(text[end + 1])) return false;
  return true;
}

/** All standalone digit spans with between `min` and `max` digits. */
export function digitSpans(text: string, min: number, max: number): DigitSpan[] {
  const out: DigitSpan[] = [];
  for (const run of findRuns(text)) {
    const { groups, seps } = run;
    const last = groups.length - 1;
    for (let i = 0; i <= last; i++) {
      if (i > 0 && seps[i - 1] !== " ") continue;
      if (i === 0 && !cleanBefore(text, groups[0].start)) continue;
      let digits = "";
      for (let j = i; j <= last; j++) {
        digits += text.slice(groups[j].start, groups[j].end);
        if (digits.length > max) break;
        if (digits.length < min) continue;
        if (j < last && seps[j] !== " ") continue;
        if (j === last && !cleanAfter(text, groups[last].end)) continue;
        out.push({ start: groups[i].start, end: groups[j].end, digits });
      }
    }
  }
  return out;
}
