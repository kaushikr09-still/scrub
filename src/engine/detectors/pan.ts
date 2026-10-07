import type { Detector } from "../types";
import { findIdPattern } from "./idPattern";

const KEYWORDS = ["pan", "pan no", "pan card", "permanent account number"];

/**
 * 5 letters + 4 digits + 1 letter. No checksum exists.
 * [assumed] the 4th letter (holder type) is not restricted to known values.
 * [assumed] confidence 0.8, or 0.7 when not all uppercase.
 */
export const pan: Detector = {
  type: "PAN",
  find: (text) => findIdPattern(text, "PAN", "[A-Z]{5}[0-9]{4}[A-Z]", 0.8, 0.1, KEYWORDS),
};
