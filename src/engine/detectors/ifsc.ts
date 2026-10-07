import type { Detector } from "../types";
import { findIdPattern } from "./idPattern";

const KEYWORDS = ["ifsc", "ifsc code", "bank", "branch"];

/**
 * 4 letters + the digit 0 + 6 letters/digits. No checksum exists.
 * [assumed] confidence 0.75, or 0.65 when not all uppercase.
 */
export const ifsc: Detector = {
  type: "IFSC",
  find: (text) => findIdPattern(text, "IFSC", "[A-Z]{4}0[A-Z0-9]{6}", 0.75, 0.1, KEYWORDS),
};
