// Counts with a 95% Wilson score interval. Every percentage in the reports is shown through formatRatio.

const Z = 1.96;

/** 95% Wilson interval for k successes out of n, as fractions between 0 and 1. Null when n is 0. */
export function wilson(k: number, n: number): { lo: number; hi: number } | null {
  if (n <= 0) return null;
  const p = k / n;
  const z2 = Z * Z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export interface Ratio {
  num: number;
  den: number;
  /** num / den as a fraction, or null when den is 0. */
  pct: number | null;
  lo: number | null;
  hi: number | null;
}

export function ratio(num: number, den: number): Ratio {
  const w = wilson(num, den);
  return { num, den, pct: den > 0 ? num / den : null, lo: w ? w.lo : null, hi: w ? w.hi : null };
}

const pc = (x: number) => `${(x * 100).toFixed(1)}%`;

/** "212 of 230 (92.2%, 95% CI 88.1% to 95.1%)" */
export function formatRatio(r: Ratio): string {
  if (r.pct === null || r.lo === null || r.hi === null) return `${r.num} of ${r.den} (n/a)`;
  return `${r.num} of ${r.den} (${pc(r.pct)}, 95% CI ${pc(r.lo)} to ${pc(r.hi)})`;
}
