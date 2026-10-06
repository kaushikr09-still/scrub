/**
 * Verhoeff checksum, used to validate 12-digit Aadhaar numbers.
 * Tables are the standard Verhoeff (1969) multiplication (d), permutation (p),
 * and inverse (inv) tables as published at
 * https://en.wikipedia.org/wiki/Verhoeff_algorithm
 */

const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const inv: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Runs the Verhoeff checksum over a string of digits, rightmost digit first.
 * Returns the final checksum value c; the number is valid when c === 0.
 */
function checksum(digits: string): number {
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i].charCodeAt(0) - 48;
    c = d[c][p[i % 8][digit]];
  }
  return c;
}

/** Computes the Verhoeff check digit to append to a base number. */
export function verhoeffCheckDigit(baseDigits: string): string {
  let c = 0;
  for (let i = 0; i < baseDigits.length; i++) {
    const digit = baseDigits[baseDigits.length - 1 - i].charCodeAt(0) - 48;
    c = d[c][p[(i + 1) % 8][digit]];
  }
  return String(inv[c]);
}

/**
 * Validates a 12-digit Aadhaar number using the Verhoeff checksum.
 * Returns false for anything that is not exactly 12 digits.
 */
export function isValidAadhaar(value: string): boolean {
  if (!/^\d{12}$/.test(value)) {
    return false;
  }
  return checksum(value) === 0;
}
