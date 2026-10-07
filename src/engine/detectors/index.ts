import type { Detector } from "../types";
import { aadhaar } from "./aadhaar";
import { card } from "./card";
import { email } from "./email";
import { gstin } from "./gstin";
import { ifsc } from "./ifsc";
import { pan } from "./pan";
import { phone } from "./phone";
import { upi } from "./upi";

/** Every active detector. To add a type: write its file, then list it here. */
export const DETECTORS: readonly Detector[] = [
  email, phone, aadhaar, pan, gstin, ifsc, upi, card,
];
