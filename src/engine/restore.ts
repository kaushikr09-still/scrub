import { findTokens } from "./placeholder";
import type { Mapping } from "./scrub";

/** A placeholder-looking token in the reply that is not in the mapping. */
export interface RestoreWarning {
  kind: "unknown-placeholder";
  token: string;
  start: number;
  end: number;
}

export interface RestoreResult {
  text: string;
  warnings: RestoreWarning[];
}

/**
 * Puts real values back into a chatbot reply. Tolerates any letter case,
 * spaces inside brackets, [ ] / { } brackets that are doubled, missing or
 * mixed, and possessives ([PERSON_1]'s). < > and ( ) are kept as prose.
 * Works in one pass, so a restored value is never scanned again.
 */
export function restore(reply: string, mapping: Mapping): RestoreResult {
  const mappedTypes = new Set([...mapping.values()].map((v) => v.type as string));
  const warnings: RestoreWarning[] = [];
  let out = "";
  let pos = 0;
  for (const t of findTokens(reply)) {
    const known = mapping.get(t.key);
    if (known) {
      out += reply.slice(pos, t.start) + known.value;
      pos = t.end;
    } else if (t.looksLikePlaceholder || mappedTypes.has(t.type)) {
      warnings.push({ kind: "unknown-placeholder", token: reply.slice(t.start, t.end), start: t.start, end: t.end });
    }
  }
  out += reply.slice(pos);
  return { text: out, warnings };
}
