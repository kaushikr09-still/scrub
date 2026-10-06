/**
 * Luhn checksum, used to validate card-like numbers (bank cards, etc.).
 * Algorithm: https://en.wikipedia.org/wiki/Luhn_algorithm
 */

/**
 * Validates a string of digits using the Luhn algorithm.
 * Accepts only digit strings of length 8-19 (typical card number range);
 * anything else returns false without attempting the checksum.
 */
export function isValidLuhn(value: string): boolean {
  if (!/^\d{8,19}$/.test(value)) {
    return false;
  }

  let sum = 0;
  let double = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = value.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}
