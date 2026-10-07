// Dev-only hand-check page for the rules engine (see /playground.html).
// Builds DOM with textContent only, so typed text is never parsed as HTML.
import { detect } from "../engine/detect";

const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const highlighted = document.querySelector<HTMLDivElement>("#highlighted")!;
const rows = document.querySelector<HTMLTableSectionElement>("#rows")!;

function cell(tr: HTMLTableRowElement, text: string): void {
  tr.appendChild(document.createElement("td")).textContent = text;
}

function render(): void {
  const text = input.value;
  const found = detect(text);
  highlighted.replaceChildren();
  rows.replaceChildren();
  let pos = 0;
  for (const d of found) {
    highlighted.append(text.slice(pos, d.start));
    const mark = document.createElement("mark");
    // The type label in brackets means highlights don't rely on colour alone.
    mark.appendChild(document.createElement("b")).textContent = `[${d.type}] `;
    mark.append(d.value);
    highlighted.appendChild(mark);
    pos = d.end;

    const tr = rows.insertRow();
    cell(tr, d.type);
    cell(tr, d.value);
    cell(tr, `${d.start}–${d.end}`);
    cell(tr, d.confidence.toFixed(2));
  }
  highlighted.append(text.slice(pos));
  if (found.length === 0) {
    const tr = rows.insertRow();
    cell(tr, "—");
    cell(tr, "No detections");
    cell(tr, "");
    cell(tr, "");
  }
}

input.addEventListener("input", render);
render();
