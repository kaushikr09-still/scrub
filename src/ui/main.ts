// Connects index.html to ScrubSession. Builds DOM with textContent only,
// so pasted text is never parsed as HTML.
import { ScrubSession, type CopyCheck } from "./app";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const input = el<HTMLTextAreaElement>("input");
const inputStatus = el<HTMLParagraphElement>("input-status");
const scrubButton = el<HTMLButtonElement>("scrub-button");
const scrubbed = el<HTMLTextAreaElement>("scrubbed");
const scrubSummary = el<HTMLParagraphElement>("scrub-summary");
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

// The only place the mapping lives: this object, in memory, until reload.
const session = new ScrubSession();
// Browsers may keep a checkbox ticked across reloads; one acknowledgment per page load means starting unticked.
ack.checked = false;

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

function doScrub(): void {
  const v = session.scrub(input.value);
  scrubbed.value = v.text;
  scrubSummary.textContent = v.summary;
  scrubWarnings.replaceChildren(...v.warnings.map(warningItem));
  setWarning(inputStatus, "");
  copyScrubbedStatus.textContent = "";
  clearRestore();
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

scrubButton.addEventListener("click", doScrub);
restoreButton.addEventListener("click", doRestore);
onCtrlEnter(input, doScrub);
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
