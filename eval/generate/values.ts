// Makers for individual values. Every ID is built to be valid; every format is one the rule detectors document.
import { verhoeffCheckDigit } from "../../src/engine/verhoeff.ts";
import { gstinCheckDigit } from "../../src/engine/gstin.ts";
import { isValidLuhn } from "../../src/engine/luhn.ts";
import type { NegKind } from "../types.ts";
import type { Rng } from "./rng.ts";

interface StateLists {
  state_codes: string[];
}

/** The check digit that makes `base` pass Luhn once appended. */
export function luhnCheckDigit(base: string): string {
  let sum = 0;
  let double = true; // the check digit will be the rightmost, so the digit left of it is doubled
  for (let i = base.length - 1; i >= 0; i--) {
    let d = base.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

const group4 = (d: string, sep: string) => d.match(/.{4}/g)!.join(sep);

/** 12 digits, first digit 2-9, Verhoeff check digit last. Grouped 4-4-4 about 70% of the time. */
export function aadhaar(rng: Rng): string {
  const base = String(rng.int(2, 9)) + rng.digits(10);
  const d = base + verhoeffCheckDigit(base);
  return rng.chance(0.7) ? group4(d, " ") : d;
}

/** 5 letters, 4 digits, 1 letter. The 4th letter is P (individual), as on most real cards. */
export function pan(rng: Rng): string {
  return rng.letters(3) + "P" + rng.letters(1) + rng.digits(4) + rng.letters(1);
}

/** State code + PAN + entity digit + Z + check character. */
export function gstin(rng: Rng, lists: StateLists): string {
  const first14 = rng.pick(lists.state_codes) + pan(rng) + String(rng.int(1, 9)) + "Z";
  return first14 + gstinCheckDigit(first14);
}

/** 4 bank letters + 0 + 6 letters or digits. */
export function ifsc(rng: Rng, prefix: string): string {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += rng.chance(0.7) ? String(rng.int(0, 9)) : rng.letters(1);
  return `${prefix}0${tail}`;
}

/** 16 digits passing Luhn. Plain, space-grouped or dash-grouped. */
export function card(rng: Rng): string {
  const base = String(rng.pick([4, 5, 6])) + rng.digits(14);
  const d = base + luhnCheckDigit(base);
  const r = rng.float();
  return r < 0.4 ? d : r < 0.8 ? group4(d, " ") : group4(d, "-");
}

/** 9 to 18 digits that do NOT pass Luhn. */
export function bankAccount(rng: Rng): string {
  for (;;) {
    const v = rng.digits(rng.int(9, 18), true);
    if (!isValidLuhn(v)) return v;
  }
}

/** Indian mobile: 10 digits starting 6-9, written in several ways. */
export function phone(rng: Rng): string {
  const core = String(rng.int(6, 9)) + rng.digits(9);
  const sep = rng.pick(["", " ", "-"]);
  const body = rng.chance(0.5) ? core : `${core.slice(0, 5)}${sep}${core.slice(5)}`;
  const prefix = rng.pick(["", "", "+91", "+91", "0", "91"]);
  if (prefix === "") return body;
  return prefix === "0" ? `0${body}` : `${prefix}${rng.pick([" ", "-", ""])}${body}`;
}

/** 6 digits, first digit 1-9. */
export function pin(rng: Rng): string {
  return rng.digits(6, true);
}

export function ip(rng: Rng): string {
  return [rng.int(1, 223), rng.int(0, 255), rng.int(0, 255), rng.int(1, 254)].join(".");
}

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];
const ordinal = (d: number) => {
  const s = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${d}${s}`;
};

/**
 * Day-month-year forms only (12/05/2024, 12-05-24, 12.05.2024, 12 May 2024, 12th May 2024, 12-May-2024).
 * "dob" uses birth years, "any" recent years, "long" always writes the month as a word.
 */
export function date(rng: Rng, kind: string): string {
  const day = rng.int(1, 28);
  const month = rng.int(1, 12);
  const year = kind === "dob" ? rng.int(1980, 2003) : rng.int(2019, 2025);
  const pad = (n: number) => (rng.chance(0.7) ? String(n).padStart(2, "0") : String(n));
  const m = MONTH_FULL[month - 1];
  const word = rng.chance(0.6) ? m : m.slice(0, 3);
  const long = [
    () => `${day} ${word} ${year}`,
    () => `${ordinal(day)} ${m} ${year}`,
    () => `${day}-${word}-${year}`,
    () => `${day} ${m}, ${year}`,
  ];
  if (kind === "long") return rng.pick(long)();
  const numeric = [
    () => `${pad(day)}/${pad(month)}/${year}`,
    () => `${pad(day)}-${pad(month)}-${year}`,
    () => `${pad(day)}.${pad(month)}.${year}`,
    () => `${pad(day)}/${pad(month)}/${String(year).slice(2)}`,
    () => `${pad(day)}-${pad(month)}-${String(year).slice(2)}`,
  ];
  return rng.chance(0.55) ? rng.pick(numeric)() : rng.pick(long)();
}

const indian = (n: number): string => {
  const s = String(n);
  if (s.length <= 3) return s;
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${s.slice(-3)}`;
};
const western = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Rupee amounts in the forms money.ts documents: ₹5,000 · Rs. 5,000/- · Rs.5,000 · INR 1,25,000 · INR 1.5M ·
 * ₹12 LPA · 5,000 INR · 500 rupees · 5 lakh · 1.2 crore. Bare short units (12L, 50K) are not used: they only count
 * near a money word.
 */
export function money(rng: Rng): string {
  const amount = rng.int(5, 5000) * 100; // 500 .. 500,000
  const num = rng.chance(0.7) ? indian(amount) : western(amount);
  const oneDecimal = (lo: number, hi: number) => {
    const v = rng.int(lo * 10, hi * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  const forms: (() => string)[] = [
    () => `₹${num}`,
    () => `₹${num}`,
    () => `Rs. ${num}/-`,
    () => `Rs.${num}`,
    () => `INR ${num}`,
    () => `₹${rng.int(3, 40)} LPA`,
    () => `${num} INR`,
    () => `${rng.int(5, 900) * 10} rupees`,
    () => `${oneDecimal(1, 40)} lakh`,
    () => `${oneDecimal(1, 9)} crore`,
    () => `INR ${oneDecimal(1, 9)}M`,
  ];
  return rng.pick(forms)();
}

/** Look-alike codes that are NOT personal data. None has 10 or more digits in a row. */
export function neg(rng: Rng, kind: NegKind): string {
  switch (kind) {
    case "order":
      return rng.pick([() => `ORD-${rng.digits(7)}`, () => `OD${rng.digits(8)}`, () => `SO-${rng.digits(6)}`])();
    case "ticket":
      return rng.pick([() => `TKT-${rng.digits(6)}`, () => `INC${rng.digits(7)}`, () => rng.digits(5, true)])();
    case "invoice":
      return rng.pick([() => `INV-2024-${rng.digits(4)}`, () => `INV/24-25/${rng.digits(5)}`, () => `INV-${rng.digits(6)}`])();
    case "ref":
      return rng.pick([() => `VND-${rng.digits(5)}`, () => `REF/24/${rng.digits(4)}`, () => `CUST${rng.digits(6)}`])();
    case "version":
      return `${rng.int(1, 9)}.${rng.int(0, 20)}.${rng.int(0, 9)}`;
  }
}
