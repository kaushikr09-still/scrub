// Dev-only evaluation runner. Lives outside src/ on purpose, like bakeoff/. It reads the generated benchmark from this
// dev server and runs the product's own detection path over it. Nothing a user typed is involved.
import { detect } from "../src/engine/detect";
import { combineDetections } from "../src/engine/names";
import { ModelClient, type WorkerLike } from "../src/ui/modelClient";
import { checkFrozenGuard, looksLikeResultsJson } from "./guard";
import type { ResultsFile } from "./results";
import { scoreRun } from "./score/score";
import { buildTables } from "./score/tables";
import type { EvalDoc } from "./types";

// Keep in step with src/ui/modelWorker.ts (MODEL_ID and dtype there); the worker does not export them.
const MODEL = { id: "Xenova/bert-base-NER", dtype: "q8" };

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const splitSelect = $<HTMLSelectElement>("split");
const frozenBox = $<HTMLFieldSetElement>("frozen");
const frozenOk = $<HTMLInputElement>("frozen-ok");
const runButton = $<HTMLButtonElement>("run");
const modelStatus = $("model-status");
const status = $("status");
const refusal = $("refusal");
const progress = $<HTMLProgressElement>("progress");
const download = $<HTMLButtonElement>("download");
const tablesBox = $("tables");

const params = new URLSearchParams(location.search);
const force = params.get("force") === "1";
if (params.get("split") === "test" || params.get("split") === "dev") splitSelect.value = params.get("split")!;

let results: ResultsFile | null = null;
let waiters: (() => void)[] = [];

function showModel(): void {
  const state = model.state();
  const p = model.progress();
  modelStatus.textContent =
    state === "ready" ? "Name model: ready." : state === "failed" ? "Name model: FAILED. A run cannot start." : `Name model: loading${p === null ? "" : ` (${Math.round(p * 100)}%)`}.`;
  const w = waiters;
  waiters = [];
  w.forEach((f) => f());
}

const worker = new Worker(new URL("../src/ui/modelWorker.ts", import.meta.url), { type: "module" });
const model = new ModelClient(worker as unknown as WorkerLike, { onChange: showModel });
showModel();

async function whenModelSettled(): Promise<void> {
  while (model.state() === "loading") await new Promise<void>((r) => waiters.push(r));
}

splitSelect.addEventListener("change", showFrozen);
function showFrozen(): void {
  frozenBox.hidden = splitSelect.value !== "test";
  if (frozenBox.hidden) frozenOk.checked = false;
}
showFrozen();

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resultsAlreadyExist(split: string): Promise<boolean> {
  try {
    const res = await fetch(`/eval/results/${split}.json`, { cache: "no-store" });
    return res.ok && looksLikeResultsJson(await res.text());
  } catch {
    return false;
  }
}

function drawTables(): void {
  tablesBox.replaceChildren();
  if (!results) return;
  for (const t of buildTables(results.summary)) {
    const h = document.createElement("h2");
    h.textContent = t.title;
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    for (const c of t.head) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = c;
      head.appendChild(th);
    }
    const body = table.createTBody();
    for (const r of t.rows) {
      const tr = body.insertRow();
      r.forEach((c, i) => {
        const cell = tr.insertCell();
        cell.textContent = c;
        if (i === 0) cell.className = "first";
      });
    }
    tablesBox.append(h);
    if (t.note) tablesBox.append(Object.assign(document.createElement("p"), { className: "small", textContent: t.note }));
    tablesBox.append(table);
  }
  const misses = results.summary.worstMisses;
  if (misses.length > 0) {
    tablesBox.append(Object.assign(document.createElement("h2"), { textContent: "Worst misses (dev only)" }));
    const ol = document.createElement("ol");
    for (const m of misses.slice(0, 30)) {
      const li = document.createElement("li");
      li.textContent = `${m.docId} ${m.type} "${m.value}" (${m.status}, ${m.uncovered}) …${m.before.replace(/\n/g, "⏎")}[${m.value}]${m.after.replace(/\n/g, "⏎")}…`;
      ol.append(li);
    }
    tablesBox.append(ol);
  }
}

async function run(): Promise<void> {
  const split = splitSelect.value;
  refusal.textContent = "";
  download.disabled = true;
  results = null;
  tablesBox.replaceChildren();
  runButton.disabled = true;
  try {
    const verdict = checkFrozenGuard({
      split,
      ticked: frozenOk.checked,
      resultsExist: split === "test" ? await resultsAlreadyExist("test") : false,
      force,
    });
    if (!verdict.ok) {
      refusal.textContent = verdict.message;
      status.textContent = "Refused.";
      return;
    }
    status.textContent = "Waiting for the name model…";
    await whenModelSettled();
    if (model.state() !== "ready") {
      refusal.textContent = "The name model failed to load, so the real detection path cannot run. Nothing was scored.";
      status.textContent = "Stopped.";
      return;
    }

    const res = await fetch(`/eval/generated/${split}.jsonl`, { cache: "no-store" });
    if (!res.ok) throw new Error(`could not read eval/generated/${split}.jsonl. Run npm run eval:generate first.`);
    const bytes = await res.arrayBuffer();
    const jsonlSha256 = await sha256Hex(bytes);
    const docs = new TextDecoder().decode(bytes).trimEnd().split("\n").map((l) => JSON.parse(l) as EvalDoc);

    const runAt = new Date().toISOString();
    const t0 = performance.now();
    const detections: ResultsFile["detections"] = {};
    progress.hidden = false;
    progress.max = docs.length;
    for (let i = 0; i < docs.length; i++) {
      status.textContent = `Document ${i + 1} of ${docs.length}`;
      progress.value = i;
      const d = docs[i];
      // The same two steps as the page's scrub: rules, then the name model merged in. A model error stops the run.
      const rules = detect(d.text);
      const names = await model.find(d.text);
      detections[d.id] = combineDetections(d.text, rules, names).map((x) => ({
        type: x.type,
        start: x.start,
        end: x.end,
        confidence: x.confidence,
      }));
    }
    progress.value = docs.length;
    const durationMs = Math.round(performance.now() - t0);
    const summary = scoreRun(docs, detections, { includeDetail: split === "dev" });
    results = { format: 1, split, runAt, model: MODEL, documents: docs.length, jsonlSha256, durationMs, detections, summary };
    drawTables();
    download.disabled = false;
    status.textContent = `Done: ${docs.length} documents in ${(durationMs / 1000).toFixed(1)} seconds.`;
  } catch (e) {
    refusal.textContent = `Stopped: ${e instanceof Error ? e.message : "unknown error"}. No results were produced.`;
    status.textContent = "Stopped.";
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => void run());
download.addEventListener("click", () => {
  if (!results) return;
  const blob = new Blob([JSON.stringify(results, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${results.split}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
