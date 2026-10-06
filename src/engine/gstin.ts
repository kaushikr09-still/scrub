/**
 * GSTIN (15-character GST Identification Number) check-character validation.
 *
 * Format: 2-digit state code + 10-character PAN + 1 entity-code character +
 * literal "Z" + 1 check character, e.g. "29AABCU9603R1ZX".
 *
 * The check character is computed with a mod-36 algorithm over the first 14
 * characters, using the 36-character alphabet "0-9A-Z". This mirrors the
 * algorithm as commonly published/reproduced for GSTIN validation. It has
 * NOT been confirmed here against an authoritative GSTN source — see the
 * test file for which example numbers are unverified.
 */

const CODE_POINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MOD = 36;

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Computes the GSTIN check character for the first 14 characters. */
export function gstinCheckDigit(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const codePoint = CODE_POINTS.indexOf(first14[i]);
    let digit = factor * codePoint;
    digit = Math.floor(digit / MOD) + (digit % MOD);
    sum += digit;
    factor = factor === 2 ? 1 : 2;
  }
  const checkCodePoint = (MOD - (sum % MOD)) % MOD;
  return CODE_POINTS[checkCodePoint];
}

/**
 * Validates a 15-character GSTIN: checks the structural format, then
 * recomputes the check character and compares it to the 15th character.
 */
export function isValidGstin(value: string): boolean {
  if (!GSTIN_FORMAT.test(value)) {
    return false;
  }
  const first14 = value.slice(0, 14);
  const checkChar = value[14];
  return gstinCheckDigit(first14) === checkChar;
}
