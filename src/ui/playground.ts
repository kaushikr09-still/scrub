// Dev-only hand-check page for the rules engine (see /playground.html).
// Builds DOM with textContent only, so typed text is never parsed as HTML.
import { detect } from "../engine/detect";
import { restore } from "../engine/restore";
import { scrub, type Mapping } from "../engine/scrub";
import type { Detection } from "../engine/types";

const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const highlighted = document.querySelector<HTMLDivElement>("#highlighted")!;
const rows = document.querySelector<HTMLTableSectionElement>("#rows")!;
const scrubbed = document.querySelector<HTMLDivElement>("#scrubbed")!;
const scrubWarnings = document.querySelector<HTMLUListElement>("#scrub-warnings")!;
const mappingRows = document.querySelector<HTMLTableSectionElement>("#mapping")!;
const reply = document.querySelector<HTMLTextAreaElement>("#reply")!;
const restored = document.querySelector<HTMLDivElement>("#restored")!;
const restoreWarnings = document.querySelector<HTMLUListElement>("#restore-warnings")!;

// Held in this variable only, for as long as the page is open.
let mapping: Mapping = new Map();

function cell(tr: HTMLTableRowElement, text: string): void {
  tr.appendChild(document.createElement("td")).textContent = text;
}

function showWarnings(list: HTMLUListElement, lines: string[]): void {
  list.replaceChildren(
    ...lines.map((line) => {
      const li = document.createElement("li");
      li.textContent = `Warning: ${line}`;
      return li;
    }),
  );
}

function renderRestore(): void {
  const r = restore(reply.value, mapping);
  restored.textContent = r.text;
  showWarnings(
    restoreWarnings,
    r.warnings.map((w) => `${w.token} is not in the mapping, left as is (at ${w.start})`),
  );
}

function renderScrub(found: Detection[]): void {
  const r = scrub(input.value, found);
  mapping = r.mapping;
  scrubbed.textContent = r.text;
  showWarnings(
    scrubWarnings,
    r.warnings.map((w) => `the text already contains ${w.token} (at ${w.start}); new numbers start above it`),
  );
  mappingRows.replaceChildren();
  for (const [key, { type, value }] of mapping) {
    const tr = mappingRows.insertRow();
    cell(tr, `[${key}]`);
    cell(tr, type);
    cell(tr, value);
  }
  renderRestore();
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
  renderScrub(found);
}

input.addEventListener("input", render);
reply.addEventListener("input", renderRestore);
render();
