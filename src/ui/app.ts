// The page's behaviour, kept free of the DOM so it can be tested.
// Everything here lives in memory for as long as the page is open:
// nothing is saved, logged or sent anywhere.
import { detect } from "../engine/detect";
import { restore } from "../engine/restore";
import { scrub, type Mapping } from "../engine/scrub";

export interface Engine {
  detect: typeof detect;
  scrub: typeof scrub;
  restore: typeof restore;
}

export interface ScrubView {
  ok: boolean;
  text: string;
  summary: string;
  warnings: string[];
}

export interface RestoreView {
  text: string;
  warnings: string[];
}

/** Where the page should send keyboard focus when a copy is refused. */
export type CopyCheck =
  | { ok: true; text: string }
  | { ok: false; message: string; focus: "ack" | "input" | "reply" };

/** "[EMAIL_4]" or "[EMAIL_4] (2 times)", in first-seen order. */
function countTokens(tokens: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([t, n]) => (n > 1 ? `${t} (${n} times)` : t));
}

function summarise(types: string[]): string {
  if (types.length === 0) {
    return "Nothing found by the rules. Read the text yourself before you share it.";
  }
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  const parts = [...counts].map(([t, n]) => `${t} × ${n}`);
  return `Masked ${types.length} ${types.length === 1 ? "item" : "items"}: ${parts.join(", ")}.`;
}

export class ScrubSession {
  private mapping: Mapping | null = null;
  private scrubbedFrom: string | null = null;
  private scrubbedText = "";
  private restoredFrom: string | null = null;
  private restoredText = "";
  private acknowledged = false;

  constructor(private readonly engine: Engine = { detect, scrub, restore }) {}

  setAcknowledged(value: boolean): void {
    this.acknowledged = value;
  }

  /** True when the input box no longer matches what was scrubbed. */
  isStale(currentInput: string): boolean {
    return this.scrubbedFrom !== null && this.scrubbedFrom !== currentInput;
  }

  scrub(input: string): ScrubView {
    this.mapping = null;
    this.scrubbedFrom = null;
    this.scrubbedText = "";
    this.restoredFrom = null;
    this.restoredText = "";
    if (input.trim() === "") {
      return { ok: false, text: "", summary: "", warnings: ["Paste some text first."] };
    }
    try {
      const found = this.engine.detect(input);
      const r = this.engine.scrub(input, found);
      this.mapping = r.mapping;
      this.scrubbedFrom = input;
      this.scrubbedText = r.text;
      const warnings = countTokens(r.warnings.map((w) => w.token)).map(
        (t) =>
          `Your text already contains ${t}, which looks like a placeholder. ` +
          "New placeholders were numbered above it so they don't clash.",
      );
      return { ok: true, text: r.text, summary: summarise(found.map((d) => d.type)), warnings };
    } catch {
      // Fail closed. The error itself is not shown, as it could quote the text.
      return {
        ok: false,
        text: "",
        summary: "",
        warnings: ["Something went wrong while checking your text. Nothing was scrubbed, so there is nothing to copy."],
      };
    }
  }

  restore(reply: string): RestoreView {
    this.restoredFrom = null;
    this.restoredText = "";
    if (this.mapping === null) {
      return { text: "", warnings: ["Scrub some text first. Restore uses the placeholders from your last scrub."] };
    }
    if (reply.trim() === "") {
      return { text: "", warnings: ["Paste the chatbot's reply first."] };
    }
    const r = this.engine.restore(reply, this.mapping);
    this.restoredFrom = reply;
    this.restoredText = r.text;
    const warnings = countTokens(r.warnings.map((w) => w.token)).map(
      (t) =>
        `${t} is not one of your placeholders, so it was left as is. ` +
        "The chatbot may have made it up or changed it.",
    );
    return { text: r.text, warnings };
  }

  scrubbedCopy(currentInput: string): CopyCheck {
    if (this.scrubbedFrom === null) {
      return { ok: false, focus: "input", message: "Nothing to copy yet. Paste your text and press Scrub." };
    }
    if (this.isStale(currentInput)) {
      return { ok: false, focus: "input", message: "You changed your text after scrubbing. Press Scrub again, then copy." };
    }
    if (!this.acknowledged) {
      return {
        ok: false,
        focus: "ack",
        message: "Not copied. First tick the box to confirm you know names, organisations and places are not checked.",
      };
    }
    return { ok: true, text: this.scrubbedText };
  }

  restoredCopy(currentReply: string): CopyCheck {
    if (this.restoredFrom === null) {
      return { ok: false, focus: "reply", message: "Nothing to copy yet. Paste the chatbot's reply and press Restore." };
    }
    if (this.restoredFrom !== currentReply) {
      return { ok: false, focus: "reply", message: "You changed the reply after restoring. Press Restore again, then copy." };
    }
    return { ok: true, text: this.restoredText };
  }
}
