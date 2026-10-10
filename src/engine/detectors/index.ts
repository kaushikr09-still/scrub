import type { Detector } from "../types";
import { aadhaar } from "./aadhaar";
import { bankAccount } from "./bankAccount";
import { card } from "./card";
import { date } from "./date";
import { email } from "./email";
import { gstin } from "./gstin";
import { ifsc } from "./ifsc";
import { ip } from "./ip";
import { money } from "./money";
import { pan } from "./pan";
import { phone } from "./phone";
import { pin } from "./pin";
import { upi } from "./upi";
import { url } from "./url";

/** Every active detector. To add a type: write its file, then list it here. */
export const DETECTORS: readonly Detector[] = [
  email, phone, aadhaar, pan, gstin, ifsc, upi, card,
  bankAccount, pin, date, money, url, ip,
];
