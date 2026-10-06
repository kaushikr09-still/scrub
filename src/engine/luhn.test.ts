import { describe, expect, it } from "vitest";
import { isValidLuhn } from "./luhn";

/**
 * Test vectors.
 *
 * "79927398713" is the worked example from the Luhn algorithm Wikipedia
 * article (https://en.wikipedia.org/wiki/Luhn_algorithm, "Strengths and
 * weaknesses" / worked-example section): base "7992739871" with computed
 * check digit "3". Source: published, verified by independent calculation.
 *
 * "4242424242424242" and "4000056655665556" are published test card numbers
 * from Stripe's testing documentation (https://docs.stripe.com/testing,
 * "Cards" section) — not real card numbers, documented as always Luhn-valid
 * test values. Source: published, verified by independent calculation.
 */
describe("isValidLuhn", () => {
  it("accepts the Wikipedia worked example", () => {
    expect(isValidLuhn("79927398713")).toBe(true);
  });

  it("accepts the Stripe Visa test card number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true);
  });

  it("accepts the Stripe Visa debit test card number", () => {
    expect(isValidLuhn("4000056655665556")).toBe(true);
  });

  it("rejects the Wikipedia example with a wrong check digit", () => {
    expect(isValidLuhn("79927398710")).toBe(false);
  });

  it("rejects the Stripe test card with one digit altered", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false);
  });

  it("rejects a transposition of two digits", () => {
    // 4242424242424242 with the last two digits swapped is still "...42" (no-op for this
    // particular number), so use the debit number instead: swap last two digits 5<->6
    expect(isValidLuhn("4000056655665565")).toBe(false);
  });

  it("rejects strings outside the 8-19 digit range", () => {
    expect(isValidLuhn("1234567")).toBe(false); // 7 digits
    expect(isValidLuhn("12345678901234567890")).toBe(false); // 20 digits
    expect(isValidLuhn("")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false);
    expect(isValidLuhn("424242424242424a")).toBe(false);
  });
});
