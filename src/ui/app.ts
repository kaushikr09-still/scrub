// The page's behaviour, kept free of the DOM so it can be tested.
// Everything here lives in memory for as long as the page is open:
// nothing is saved, logged or sent anywhere.
import { detect } from "../engine/detect";
import { combineDetections } from "../engine/names";
import { restore } from "../engine/restore";
import { scrub, type Mapping } from "../engine/scrub";
import type { Detection, DetectionType } from "../engine/types";
import { buildRows, defaultsFor, filterDetections, type CategoryState, type Overrides, type PresetId, type ReviewRow } from "./review";

export type ModelState = "loading" | "ready" | "failed";

/** The name model, as the session sees it. find() rejects if the names could not be fully checked. */
export interface NameChecker {
  state(): ModelState;
  find(text: string): Promise<Detection[]>;
}

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
  /** True only if the name model ran over all of this text during this scrub. */
  namesChecked: boolean;
  /** One sentence on whether names were checked in this scrub. */
  namesNote: string;
  /** One row per distinct detected value, for the review checklist. */
  rows: ReviewRow[];
  /** Types that were found but are left as plain text because their category is off. */
  leftPlain: DetectionType[];
  /** The result was thrown away: the text changed, or a newer scrub replaced it. */
  discarded?: boolean;
}

/** What the page shows after a tick-box changes. Restored text is cleared, as placeholder numbers can change. */
export interface RebuildView {
  text: string;
  summary: string;
  warnings: string[];
  rows: ReviewRow[];
  leftPlain: DetectionType[];
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

const NOTE_CHECKED =
  "Names, organisations and places were checked by the name model. It misses some, especially in all-lowercase text.";
const NOTE_LOADING =
  "Names NOT checked: the name model was still loading when you pressed Scrub, so this is a rules-only result. Press Scrub again once it is ready.";
const NOTE_FAILED = "Names NOT checked: the name model could not check this text, so this is a rules-only result.";

function summarise(types: string[], foundCount = types.length): string {
  if (types.length === 0) {
    return foundCount === 0
      ? "Nothing found. Read your text yourself before you share it."
      : "Nothing is masked: every item found is unticked. Read your text yourself before you share it.";
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
  /** Whether the scrub now held was names-checked. Fixed when that scrub finished: never updated later. */
  private namesChecked = false;
  private runs = 0;
  /** Everything detected in the scrubbed text. The page filters this; the engine masks only what passes. */
  private found: Detection[] = [];
  private preset: PresetId = "business";
  private categories: CategoryState = defaultsFor("business");
  private overrides: Overrides = {};

  constructor(
    private readonly engine: Engine = { detect, scrub, restore },
    private readonly names: NameChecker | null = null,
  ) {}

  /** Drops the held scrub (for example when an example replaces the text), so nothing old can be rebuilt or copied. */
  forget(): void {
    this.runs++;
    this.mapping = null;
    this.scrubbedFrom = null;
    this.scrubbedText = "";
    this.restoredFrom = null;
    this.restoredText = "";
    this.found = [];
    this.overrides = {};
    this.namesChecked = false;
  }

  setPreset(id: PresetId): void {
    this.preset = id;
    this.categories = defaultsFor(id);
    this.overrides = {};
  }

  presetId(): PresetId {
    return this.preset;
  }

  categoryOn(type: DetectionType): boolean {
    return this.categories[type];
  }

  /** Ticks a category and forgets per-value choices in it. Returns the new view, or null before a scrub. */
  setCategory(type: DetectionType, on: boolean): RebuildView | null {
    this.categories = { ...this.categories, [type]: on };
    const rows = buildRows(this.found, this.categories, {});
    for (const r of rows) if (r.type === type) delete this.overrides[r.key];
    return this.rebuild();
  }

  setValueMasked(key: string, masked: boolean): RebuildView | null {
    this.overrides = { ...this.overrides, [key]: masked };
    return this.rebuild();
  }

  /** Builds the output from the saved detections and the current ticks. Null if nothing was scrubbed. */
  rebuild(): RebuildView | null {
    if (this.scrubbedFrom === null) return null;
    const input = this.scrubbedFrom;
    const masked = filterDetections(this.found, this.categories, this.overrides);
    const r = this.engine.scrub(input, masked);
    this.mapping = r.mapping;
    this.scrubbedText = r.text;
    this.restoredFrom = null;
    this.restoredText = "";
    const warnings = countTokens(r.warnings.map((w) => w.token)).map(
      (t) =>
        `Your text already contains ${t}, which looks like a placeholder. ` +
        "New placeholders were numbered above it so they don't clash.",
    );
    const rows = buildRows(this.found, this.categories, this.overrides);
    const leftPlain = [...new Set(rows.filter((x) => !x.masked).map((x) => x.type))];
    return { text: r.text, summary: summarise(masked.map((d) => d.type), this.found.length), warnings, rows, leftPlain };
  }

  setAcknowledged(value: boolean): void {
    this.acknowledged = value;
  }

  /** True when the input box no longer matches what was scrubbed. */
  isStale(currentInput: string): boolean {
    return this.scrubbedFrom !== null && this.scrubbedFrom !== currentInput;
  }

  /**
   * Rules run at once. If the name model is ready it runs too; if it is loading, failed, or errors, this
   * scrub is rules-only and says so. That is decided during this scrub and never changes for its result.
   * `currentInput` says what the box holds when the model finishes: a mismatch discards the result.
   */
  async scrub(input: string, currentInput?: () => string): Promise<ScrubView> {
    const run = ++this.runs;
    this.mapping = null;
    this.scrubbedFrom = null;
    this.scrubbedText = "";
    this.restoredFrom = null;
    this.restoredText = "";
    this.namesChecked = false;
    this.found = [];
    const fail = (warning: string, discarded = false): ScrubView => ({
      ok: false,
      text: "",
      summary: "",
      warnings: warning ? [warning] : [],
      namesChecked: false,
      namesNote: "",
      rows: [],
      leftPlain: [],
      ...(discarded ? { discarded } : {}),
    });
    if (input.trim() === "") return fail("Paste some text first.");
    try {
      let found = this.engine.detect(input);
      let checked = false;
      let note = NOTE_FAILED;
      const state = this.names?.state() ?? "failed";
      if (state === "loading") note = NOTE_LOADING;
      if (state === "ready" && this.names) {
        try {
          found = combineDetections(input, found, await this.names.find(input));
          checked = true;
          note = NOTE_CHECKED;
        } catch {
          // The model failed or could not cover all the text: keep the rules-only result and say so.
        }
      }
      if (run !== this.runs) return fail("", true); // a newer scrub owns the session now
      if (currentInput && currentInput() !== input) {
        return fail("You changed your text while it was being checked. Press Scrub again.", true);
      }
      // Per-value choices belong to one scrub; the preset and category ticks carry over.
      this.overrides = {};
      this.found = found;
      this.scrubbedFrom = input;
      this.namesChecked = checked;
      const v = this.rebuild();
      if (v === null) throw new Error("rebuild");
      return { ok: true, ...v, namesChecked: checked, namesNote: note };
    } catch {
      this.scrubbedFrom = null; // nothing usable is held, so nothing can be copied
      // Fail closed. The error itself is not shown, as it could quote the text.
      return fail("Something went wrong while checking your text. Nothing was scrubbed, so there is nothing to copy.");
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
    if (!this.namesChecked && !this.acknowledged) {
      return {
        ok: false,
        focus: "ack",
        message: "Not copied. First tick the box to confirm you know names, organisations and places were not checked.",
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
