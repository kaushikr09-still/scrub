import { makeCandidate } from "../context";
import type { Candidate, Detector } from "../types";

const KEYWORDS = ["ip", "ip address", "ipv4", "server", "host"];

const BASE = 0.85; // [assumed]

// 0-255. [assumed] no leading zeros ("01" is not a valid part).
const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)`;

/**
 * IPv4 only. [assumed] It must not touch letters, digits, "_" or another
 * dot-and-digit, so "v1.2.3.4", "1.2.3.4.5" and "1.2.3.4567" are skipped.
 * A sentence-ending full stop or a ":port" after it is fine.
 */
const IPV4 = new RegExp(
  String.raw`(?<![A-Za-z0-9_.])${OCTET}(?:\.${OCTET}){3}(?![A-Za-z0-9_]|\.\d)`,
  "g",
);

function find(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(IPV4)) {
    out.push(makeCandidate(text, "IP", m.index, m.index + m[0].length, BASE, KEYWORDS, false));
  }
  return out;
}

export const ip: Detector = { type: "IP", find };
