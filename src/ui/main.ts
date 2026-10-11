// Connects index.html to ScrubSession. Builds DOM with textContent only,
// so pasted text is never parsed as HTML.
import { ScrubSession, type CopyCheck } from "./app";
import { ModelClient, type WorkerLike } from "./modelClient";

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

function clearRestore(): void {
  restored.value = "";
  restoreWarnings.replaceChildren();
  copyRestoredStatus.textContent = "";
}

/** Shows whether the name model is loading, ready or failed. */
function renderModel(): void {
  const state = model?.state() ?? "failed";
  noticeIcon.hidden = state === "ready";
  if (state === "ready") {
    noticeHeading.textContent = "Name check ready";
    modelStatus.textContent =
      "The name model is ready. Names, organisations and places are checked when you press Scrub. It misses some, especially in ALL CAPS or all-lowercase text.";
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
    scrubbed.value = v.text;
    scrubSummary.textContent = v.summary;
    namesNote.textContent = v.namesNote;
    ackRow.hidden = v.namesChecked; // the tick box is only for scrubs where names were not checked
    scrubWarnings.replaceChildren(...v.warnings.map(warningItem));
    setWarning(inputStatus, "");
    copyScrubbedStatus.textContent = "";
    clearRestore();
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

scrubButton.addEventListener("click", () => void doScrub());
restoreButton.addEventListener("click", doRestore);
onCtrlEnter(input, () => void doScrub());
onCtrlEnter(reply, doRestore);

input.addEventListener("input", () => {
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
