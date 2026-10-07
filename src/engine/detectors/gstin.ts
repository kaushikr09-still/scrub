import { isValidGstin } from "../gstin";
import type { Detector } from "../types";
import { findIdPattern } from "./idPattern";

const KEYWORDS = ["gstin", "gst", "gst no", "gst number"];

/**
 * 15 characters that pass the GSTIN check character (see ../gstin.ts,
 * itself [assumed] until confirmed with official test vectors).
 * [assumed] confidence 0.95, or 0.85 when not all uppercase.
 */
export const gstin: Detector = {
  type: "GSTIN",
  find: (text) =>
    findIdPattern(
      text,
      "GSTIN",
      "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]",
      0.95,
      0.1,
      KEYWORDS,
      isValidGstin,
    ),
};
