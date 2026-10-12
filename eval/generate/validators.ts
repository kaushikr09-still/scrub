// Checks that a generated value is really valid, using the project's own validators where they exist.
import { isValidLuhn } from "../../src/engine/luhn.ts";
import { isValidAadhaar } from "../../src/engine/verhoeff.ts";
import { isValidGstin } from "../../src/engine/gstin.ts";
import type { TruthType } from "../types.ts";

const digitsOf = (v: string) => v.replace(/[ -]/g, "");

const MONTHS =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_FORMS = [
  /^\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d\d$/,
  /^\d{1,2}[/-]\d{1,2}[/-]\d\d$/,
  new RegExp(`^\\d{1,2}(?:st|nd|rd|th)?[ -]${MONTHS},?[ -](?:19|20)\\d\\d$`, "i"),
];

/** Returns null if the value is valid for its type, otherwise a short reason. */
export function validateValue(type: TruthType, value: string): string | null {
  const d = digitsOf(value);
  switch (type) {
    case "AADHAAR":
      if (!/^[2-9]/.test(d)) return "first digit must be 2-9";
      if (!/^\d{4} \d{4} \d{4}$|^\d{12}$/.test(value)) return "must be 12 digits, plain or in groups of 4";
      return isValidAadhaar(d) ? null : "Verhoeff check failed";
    case "PAN":
      return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value) ? null : "bad PAN format";
    case "GSTIN":
      return isValidGstin(value) ? null : "bad GSTIN format or check character";
    case "IFSC":
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value) ? null : "bad IFSC format";
    case "UPI":
      return /^[a-z0-9][a-z0-9._-]{1,}@[a-z]{2,20}$/.test(value) ? null : "bad UPI format";
    case "CARD":
      if (!/^\d{16}$|^\d{4}([ -])\d{4}\1\d{4}\1\d{4}$/.test(value)) return "must be 16 digits";
      return isValidLuhn(d) ? null : "Luhn check failed";
    case "BANK_ACCOUNT":
      if (!/^\d{9,18}$/.test(value)) return "must be 9 to 18 plain digits";
      return isValidLuhn(value) ? "must NOT pass Luhn" : null;
    case "PHONE":
      return /^(?:\+91[ -]?|91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}$/.test(value) ? null : "bad phone format";
    case "PIN":
      return /^[1-9]\d{5}$/.test(value) ? null : "bad PIN";
    case "IP": {
      const parts = value.split(".");
      const ok = parts.length === 4 && parts.every((p) => /^(?:0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
      return ok ? null : "bad IPv4";
    }
    case "DATE":
      if (!DATE_FORMS.some((re) => re.test(value))) return "not a day-month-year form";
      return null;
    case "MONEY":
      return /\d/.test(value) ? null : "no number";
    case "EMAIL":
      return /^[A-Za-z0-9][A-Za-z0-9._%+-]*@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/.test(value) ? null : "bad email";
    case "URL":
      return /^(?:https?:\/\/|www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/\S*)?$/.test(value) ? null : "bad URL";
    case "PERSON":
    case "ORG":
    case "LOC":
      return value.trim() === value && value.length > 0 ? null : "bad name";
  }
}
