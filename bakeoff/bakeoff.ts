// Dev-only bake-off runner. Lives outside src/ on purpose: it downloads models, which the app itself must never do.
// Only bakeoff/names.json goes through the models. Nothing a user typed is read, sent or stored.
import { env, pipeline } from "@huggingface/transformers";
import candidates from "./candidates.json";
import names from "./names.json";
import {
  formatBoth,
  isPersonLabel,
  locatePredictions,
  scoreCandidate,
  sumFileSizes,
  type Located,
  type PartialName,
  type RawPrediction,
  type Sentence,
} from "./scoring";

interface Candidate {
  id: string;
  model_id: string;
  dtype: string;
  reported_size_mb: number | null;
}

const sentences = names as Sentence[];
const patterns = [...new Set(sentences.map((s) => s.pattern))];
const perPattern = sentences.length / patterns.length;

/** Everything the page measured, so a run can be read back as data (window.__bakeoff). */
const results: Record<string, unknown>[] = [];
(window as unknown as { __bakeoff: unknown }).__bakeoff = results;

env.allowLocalModels = false; // never look for models on this dev server

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function cell(row: HTMLTableRowElement, text: string, opts: { colspan?: number; header?: boolean; fail?: boolean } = {}) {
  const c = document.createElement(opts.header ? "th" : "td");
  c.textContent = text;
  if (opts.colspan) c.colSpan = opts.colspan;
  if (opts.fail) c.className = "fail";
  row.appendChild(c);
}

function buildHeader() {
  const tr = document.createElement("tr");
  for (const h of ["Candidate", "Overall", ...patterns, "Person outside name", "Size MB (measured / reported)", "ms per sentence"]) {
    cell(tr, h, { header: true });
  }
  $("head").replaceChildren(tr);
}

function rowFor(c: Candidate): HTMLTableRowElement {
  const tr = document.createElement("tr");
  $("rows").appendChild(tr);
  cell(tr, `${c.id} (${c.model_id}, ${c.dtype})`);
  return tr;
}

const fmtMb = (c: Candidate, mb: number) =>
  `${mb.toFixed(1)} / ${c.reported_size_mb === null ? "not reported" : c.reported_size_mb}`;

/** Lists the names the model touched but did not fully cover, with each uncovered letter shown as _. */
function showPartial(c: Candidate, partial: PartialName[]) {
  const h = document.createElement("h3");
  h.textContent = `${c.id}: ${partial.length} name(s) touched but only partly masked`;
  const ul = document.createElement("ul");
  for (const p of partial) {
    const li = document.createElement("li");
    li.textContent = `${p.id} (${p.pattern}): ${p.shown}`;
    ul.appendChild(li);
  }
  $("partials").append(h, ul);
}

async function runCandidate(c: Candidate, tr: HTMLTableRowElement) {
  const events: { file: string; loaded?: number; total?: number }[] = [];
  const pipe = await pipeline("token-classification", c.model_id, {
    dtype: c.dtype as "q4" | "q8",
    progress_callback: (e) => {
      if ("file" in e && e.file) events.push({ file: e.file, loaded: "loaded" in e ? e.loaded : undefined, total: "total" in e ? e.total : undefined });
    },
  });
  try {
    const id2label = (pipe.model.config as { id2label?: Record<string, string> }).id2label ?? {};
    const labels = [...new Set(Object.values(id2label))];
    const sizeMb = sumFileSizes(events);
    if (!labels.some(isPersonLabel)) {
      cell(tr, `labels unrecognised. Model labels: ${labels.join(", ") || "(none found)"}. Size ${fmtMb(c, sizeMb)} MB.`, {
        colspan: patterns.length + 5,
        fail: true,
      });
      return;
    }
    await pipe(sentences[0].text, { ignore_labels: [] }); // warm-up, not timed
    const located: Located[][] = [];
    let totalMs = 0;
    for (const s of sentences) {
      $("status").textContent = `${c.id}: sentence ${located.length + 1} of ${sentences.length}`;
      const t0 = performance.now();
      const out = (await pipe(s.text, { ignore_labels: [] })) as RawPrediction[];
      totalMs += performance.now() - t0;
      located.push(locatePredictions(s.text, out));
    }
    const score = scoreCandidate(sentences, located);
    const both = (t: { found: number; total: number } | undefined, f: { found: number; total: number } | undefined) =>
      formatBoth(t ?? { found: 0, total: perPattern }, f ?? { found: 0, total: perPattern }).replace(" / ", "\n");
    cell(tr, both(score.overall, score.fullOverall));
    for (const p of patterns) cell(tr, both(score.byPattern[p], score.fullByPattern[p]));
    showPartial(c, score.partial);
    results.push({
      id: c.id,
      touched: score.overall,
      fully: score.fullOverall,
      touchedByPattern: score.byPattern,
      fullyByPattern: score.fullByPattern,
      partial: score.partial,
      outside: score.outside,
      sizeMb: sizeMb,
      msPerSentence: totalMs / sentences.length,
    });
    cell(tr, String(score.outside));
    cell(tr, fmtMb(c, sizeMb));
    cell(tr, (totalMs / sentences.length).toFixed(1));
  } finally {
    await pipe.dispose();
  }
}

async function runAll() {
  $<HTMLButtonElement>("run").disabled = true;
  buildHeader();
  $("rows").replaceChildren();
  $("partials").replaceChildren();
  results.length = 0;
  for (const c of candidates as Candidate[]) {
    const tr = rowFor(c);
    $("status").textContent = `${c.id}: loading model…`;
    try {
      await runCandidate(c, tr);
    } catch (err) {
      tr.querySelectorAll("td:not(:first-child)").forEach((n) => n.remove());
      cell(tr, `FAILED to load or run: ${err instanceof Error ? err.message : String(err)}`, {
        colspan: patterns.length + 5,
        fail: true,
      });
    }
  }
  $("status").textContent = "Done.";
  $<HTMLButtonElement>("run").disabled = false;
}

$("run").addEventListener("click", () => void runAll());
