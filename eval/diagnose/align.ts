// A strict reference aligner, independent of src/engine/spans.ts, used only by the dev diagnosis to say where the
// model really put its tags. The model's tokens come in text order and cover every non-space character, so each
// token is expected exactly at the cursor (after spaces). A token that is not there is skipped without moving the
// cursor. It never searches far ahead, which is what makes it a fair judge of the product's own locator.
import type { Located, RawPrediction } from "../../src/engine/spans.ts";

export function referenceLocate(text: string, predictions: readonly RawPrediction[]): Located[] {
  const lower = text.toLowerCase();
  const out: Located[] = [];
  let cursor = 0;
  for (const p of predictions) {
    const label = p.entity_group ?? p.entity ?? "";
    if (typeof p.start === "number" && typeof p.end === "number") {
      out.push({ label, start: p.start, end: p.end });
      cursor = Math.max(cursor, p.end);
      continue;
    }
    const piece = p.word.replace(/^(##|▁|Ġ)/, "").toLowerCase();
    if (!piece) continue;
    let at = cursor;
    if (!p.word.startsWith("##")) while (at < text.length && /\s/.test(text[at])) at++;
    if (!lower.startsWith(piece, at)) continue;
    out.push({ label, start: at, end: at + piece.length });
    cursor = at + piece.length;
  }
  return out;
}
