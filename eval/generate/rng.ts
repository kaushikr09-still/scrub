// Seeded random numbers, so a given template and index always give the same document.

/** FNV-1a: turns a string into a 32-bit seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and the same on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;
  constructor(seed: string | number) {
    this.next = mulberry32(typeof seed === "string" ? hashSeed(seed) : seed);
  }
  /** 0 up to but not including 1. */
  float(): number {
    return this.next();
  }
  /** Whole number from lo to hi, both included. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("rng: cannot pick from an empty list");
    return items[Math.floor(this.next() * items.length)];
  }
  /** A string of random digits (first digit may be 0 unless firstNonZero). */
  digits(n: number, firstNonZero = false): string {
    let s = "";
    for (let i = 0; i < n; i++) s += String(i === 0 && firstNonZero ? this.int(1, 9) : this.int(0, 9));
    return s;
  }
  letters(n: number): string {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(65 + this.int(0, 25));
    return s;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
