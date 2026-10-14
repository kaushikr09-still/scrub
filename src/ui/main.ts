// Connects index.html to ScrubSession. Builds DOM with textContent only,
// so pasted text is never parsed as HTML.
import { ScrubSession, type CopyCheck, type RebuildView } from "./app";
import { ModelClient, type WorkerLike } from "./modelClient";
import { ALL_TYPES, PRESETS, type PresetId, type ReviewRow } from "./review";
import { SAMPLES } from "./samples";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const input = el<HTMLTextAreaElement>("input");
const inputStatus = el<HTMLParagraphElement>("input-status");
const scrubButton = el<HTMLButtonElement>("scrub-button");
const scrubbed = el<HTMLTextAreaElement>("scrubbed");
const scrubSummary = el<HTMLParagraphElement>("scrub-summary");
const namesNote = el<HTMLParagraphElement>("names-note");
const ackRow = el<HTMLDivElement>("ack-row");
const noticeHeading = el<HTMLSpanElement>("notice-heading");
const noticeIcon = el<HTMLSpanElement>("notice-icon");
const modelStatus = el<HTMLParagraphElement>("model-status");
const modelDownload = el<HTMLDivElement>("model-download");
const rulesIntro = el<HTMLParagraphElement>("rules-intro");
const rulesFold = el<HTMLDetailsElement>("rules-fold");
const readYourself = el<HTMLParagraphElement>("read-yourself");
const modelProgress = el<HTMLProgressElement>("model-progress");
const modelProgressText = el<HTMLSpanElement>("model-progress-text");
const scrubWarnings = el<HTMLUListElement>("scrub-warnings");
const ack = el<HTMLInputElement>("ack");
const copyScrubbed = el<HTMLButtonElement>("copy-scrubbed");
const copyScrubbedStatus = el<HTMLParagraphElement>("copy-scrubbed-status");
const reply = el<HTMLTextAreaElement>("reply");
const restoreButton = el<HTMLButtonElement>("restore-button");
const restored = el<HTMLTextAreaElement>("restored");
const restoreWarnings = el<HTMLUListElement>("restore-warnings");
const copyRestored = el<HTMLButtonElement>("copy-restored");
const copyRestoredStatus = el<HTMLParagraphElement>("copy-restored-status");
const categoryList = el<HTMLDivElement>("category-list");
const loadExample = el<HTMLButtonElement>("load-example");
const loadExampleFor = el<HTMLSpanElement>("load-example-for");
const exampleStatus = el<HTMLParagraphElement>("example-status");
const exampleHint = el<HTMLSpanElement>("example-hint");

/** The "New here?" hint is for an empty box only. */
function updateExampleHint(): void {
  exampleHint.hidden = input.value !== "";
}
const review = el<HTMLFieldSetElement>("review");
const reviewList = el<HTMLUListElement>("review-list");
const reviewStatus = el<HTMLParagraphElement>("review-status");
const leftPlain = el<HTMLParagraphElement>("left-plain");

// The name model starts loading in a Web Worker as soon as the page opens.
// If workers are unavailable the model counts as failed: names are NOT checked, and copying needs the tick box.
let model: ModelClient | null = null;
try {
  const worker = new Worker(new URL("./modelWorker.ts", import.meta.url), { type: "module" });
  model = new ModelClient(worker as unknown as WorkerLike, { onChange: renderModel });
} catch {
  model = null;
}

// The only place the mapping lives: this object, in memory, until reload.
const session = new ScrubSession(undefined, model);
// Browsers may keep a checkbox ticked across reloads; one acknowledgment per page load means starting unticked.
ack.checked = false;

renderModel();

const focusTargets = { ack, input, reply } as const;

function warningItem(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.appendChild(document.createElement("strong")).textContent = "Warning:";
  li.append(` ${text}`);
  return li;
}

function setWarning(target: HTMLElement, text: string): void {
  target.replaceChildren();
  if (text) {
    target.appendChild(document.createElement("strong")).textContent = "Warning:";
    target.append(` ${text}`);
  }
}

const presetRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="preset"]')];
const categoryBoxes = new Map<string, HTMLInputElement>();
const rowBoxes = new Map<string, HTMLInputElement>();

for (const type of ALL_TYPES) {
  const row = document.createElement("div");
  row.className = "choice";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = `cat-${type}`;
  const label = document.createElement("label");
  label.htmlFor = box.id;
  label.textContent = type;
  row.append(box, label);
  categoryList.appendChild(row);
  categoryBoxes.set(type, box);
  box.addEventListener("change", () => {
    const v = session.setCategory(type, box.checked);
    if (v) render(v);
  });
}

function showCategories(): void {
  for (const [type, box] of categoryBoxes) box.checked = session.categoryOn(type as (typeof ALL_TYPES)[number]);
  const preset = PRESETS.find((p) => p.id === session.presetId());
  loadExampleFor.textContent = ` for ${preset?.label ?? ""}`;
}

showCategories();

function renderRows(rows: ReviewRow[]): void {
  const sameRows = rows.length === rowBoxes.size && rows.every((r) => rowBoxes.has(r.key));
  if (!sameRows) {
    rowBoxes.clear();
    reviewList.replaceChildren(
      ...rows.map((r, i) => {
        const li = document.createElement("li");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.id = `row-${i}`;
        const label = document.createElement("label");
        label.htmlFor = box.id;
        label.append(
          Object.assign(document.createElement("span"), { className: "review-type", textContent: `${r.type} ` }),
          Object.assign(document.createElement("span"), { className: "review-value", textContent: r.value }),
          Object.assign(document.createElement("span"), { className: "review-count" }),
        );
        li.append(box, label);
        rowBoxes.set(r.key, box);
        box.addEventListener("change", () => {
          const v = session.setValueMasked(r.key, box.checked);
          if (v) render(v);
        });
        return li;
      }),
    );
  }
  rows.forEach((r, i) => {
    const box = rowBoxes.get(r.key)!;
    box.checked = r.masked;
    const li = reviewList.children[i] as HTMLLIElement;
    li.classList.toggle("plain", !r.masked);
    li.querySelector(".review-count")!.textContent =
      ` (${r.count} ${r.count === 1 ? "time" : "times"})${r.masked ? "" : " left as plain text"}`;
  });
  review.hidden = rows.length === 0;
}

/** Shows the output built from the current ticks. Placeholder numbers can change, so an old restored reply is cleared. */
function render(v: RebuildView): void {
  const hadRestored = restored.value !== "";
  scrubbed.value = v.text;
  scrubSummary.textContent = v.summary;
  scrubWarnings.replaceChildren(...v.warnings.map(warningItem));
  leftPlain.textContent = v.leftPlain.length ? `Left as plain text: ${v.leftPlain.join(", ")}. Check the list below.` : "";
  renderRows(v.rows);
  clearRestore();
  reviewStatus.textContent = hadRestored
    ? "The placeholders changed, so the restored reply was cleared. Paste the reply again and press Restore."
    : "";
  copyScrubbedStatus.textContent = "";
}

function clearOutput(): void {
  scrubbed.value = "";
  scrubSummary.textContent = "";
  namesNote.textContent = "";
  leftPlain.textContent = "";
  reviewStatus.textContent = "";
  scrubWarnings.replaceChildren();
  rowBoxes.clear();
  reviewList.replaceChildren();
  review.hidden = true;
  copyScrubbedStatus.textContent = "";
  clearRestore();
}

function clearRestore(): void {
  restored.value = "";
  restoreWarnings.replaceChildren();
  copyRestoredStatus.textContent = "";
}

/** Shows whether the name model is loading, ready or failed. */
function renderModel(): void {
  const state = model?.state() ?? "failed";
  noticeIcon.hidden = state === "ready";
  // Only the ready state uses the short text and the fold-out; the other states keep the full list and warning line.
  rulesIntro.hidden = state === "ready";
  readYourself.hidden = state === "ready";
  rulesFold.hidden = state !== "ready";
  if (state === "ready") {
    noticeHeading.textContent = "Name check ready";
    modelStatus.replaceChildren(
      "Names, organisations and places are checked when you press Scrub. It misses some, especially in all-lowercase text. ",
      Object.assign(document.createElement("strong"), { textContent: "Read your text yourself before you share it." }),
    );
    modelDownload.hidden = true;
  } else if (state === "failed") {
    noticeHeading.textContent = "Names NOT checked";
    modelStatus.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: "Names NOT checked:" }),
      " the name model could not be loaded, so only the rules run. Copying needs a tick box first.",
    );
    modelDownload.hidden = true;
  } else {
    const p = model?.progress() ?? null;
    modelProgress.max = 100;
    if (p === null) modelProgress.removeAttribute("value");
    else modelProgress.value = Math.round(p * 100);
    modelProgressText.textContent = p === null ? "Starting…" : `${Math.round(p * 100)}%`;
  }
}

let scrubbing = false;

async function doScrub(): Promise<void> {
  if (scrubbing) return;
  scrubbing = true;
  scrubButton.disabled = true;
  scrubbed.value = "";
  namesNote.textContent = "";
  scrubSummary.textContent = model?.state() === "ready" ? "Checking names…" : "";
  try {
    const v = await session.scrub(input.value, () => input.value);
    if (v.discarded && v.warnings.length === 0) return; // replaced by a newer scrub
    if (!v.ok) {
      clearOutput();
      scrubWarnings.replaceChildren(...v.warnings.map(warningItem));
      return;
    }
    render(v);
    namesNote.textContent = v.namesNote;
    ackRow.hidden = v.namesChecked; // the tick box is only for scrubs where names were not checked
    setWarning(inputStatus, "");
  } finally {
    scrubbing = false;
    scrubButton.disabled = false;
  }
}

function doRestore(): void {
  const v = session.restore(reply.value);
  restored.value = v.text;
  restoreWarnings.replaceChildren(...v.warnings.map(warningItem));
  copyRestoredStatus.textContent = "";
}

/** Copies via the clipboard; if the browser refuses, selects the text instead. */
async function copy(check: CopyCheck, source: HTMLTextAreaElement, status: HTMLElement): Promise<void> {
  if (!check.ok) {
    setWarning(status, check.message);
    focusTargets[check.focus].focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(check.text);
    status.textContent = "Copied.";
  } catch {
    source.focus();
    source.select();
    status.textContent = "Could not copy automatically. The text is selected: press Ctrl+C (or ⌘+C).";
  }
}

function onCtrlEnter(box: HTMLTextAreaElement, action: () => void): void {
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      action();
    }
  });
}

for (const radio of presetRadios) {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    session.setPreset(radio.value as PresetId);
    showCategories();
    const v = session.rebuild();
    if (v) render(v);
    exampleStatus.textContent = "";
  });
}

loadExample.addEventListener("click", () => {
  const text = SAMPLES[session.presetId()];
  const isExample = Object.values(SAMPLES).includes(input.value);
  if (input.value.trim() !== "" && !isExample && !window.confirm("Replace the text in the box with the example?")) return;
  input.value = text;
  session.forget();
  clearOutput();
  setWarning(inputStatus, "");
  exampleStatus.textContent = "Example loaded. It is made up. Press Scrub.";
  updateExampleHint();
  input.focus();
});
updateExampleHint(); // browsers may restore the box contents on reload

scrubButton.addEventListener("click", () => void doScrub());
restoreButton.addEventListener("click", doRestore);
onCtrlEnter(input, () => void doScrub());
onCtrlEnter(reply, doRestore);

input.addEventListener("input", () => {
  updateExampleHint();
  if (input.value === "") {
    // An empty box: drop the old output and warnings, but keep the placeholder list so Restore still works.
    session.dropScrubKeepRestore();
    clearOutput();
    setWarning(inputStatus, "");
    return;
  }
  setWarning(
    inputStatus,
    session.isStale(input.value) ? "You changed your text after scrubbing. Press Scrub again before copying." : "",
  );
});

ack.addEventListener("change", () => {
  session.setAcknowledged(ack.checked);
  copyScrubbedStatus.textContent = "";
});

copyScrubbed.addEventListener("click", () => {
  void copy(session.scrubbedCopy(input.value), scrubbed, copyScrubbedStatus);
});

copyRestored.addEventListener("click", () => {
  void copy(session.restoredCopy(reply.value), restored, copyRestoredStatus);
});

// The same gate applies when someone selects the scrubbed text and copies it by hand.
scrubbed.addEventListener("copy", (e) => {
  const check = session.scrubbedCopy(input.value);
  if (!check.ok) {
    e.preventDefault();
    setWarning(copyScrubbedStatus, check.message);
  }
});
