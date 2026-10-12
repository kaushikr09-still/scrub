// Dev-only diagnosis page. Reads the dev split only, runs the real model and the product's own name path, and records
// the model's raw output so each weak PERSON result can be put in group (a), (b) or (c). Nothing a user typed is involved.
import { detect } from "../src/engine/detect";
import { normaliseCapsRuns } from "../src/engine/capsNormalise";
import { combineDetections, findNames } from "../src/engine/names";
import { ModelClient, type WorkerLike } from "../src/ui/modelClient";
import { diagnoseDoc, summarise, type DiagRow, type RawCall } from "./diagnose/classify";
import { assertDevSplit, DIAGNOSE_SPLIT, DIAGNOSE_URL } from "./diagnose/source";
import type { EvalDoc } from "./types";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const modelStatus = $("model-status");
const status = $("status");
const out = $<HTMLPreElement>("out");
const runButton = $<HTMLButtonElement>("run");
const download = $<HTMLButtonElement>("download");

const worker = new Worker(new URL("../src/ui/modelWorker.ts", import.meta.url), { type: "module" });
let waiters: (() => void)[] = [];
const model = new ModelClient(worker as unknown as WorkerLike, {
  onChange: () => {
    modelStatus.textContent = model.state() === "ready" ? "Name model: ready." : model.state() === "failed" ? "Name model: FAILED." : "Name model: loading.";
    const w = waiters;
    waiters = [];
    w.forEach((f) => f());
  },
});

let result: { rows: DiagRow[]; summary: ReturnType<typeof summarise> } | null = null;

async function run(): Promise<void> {
  assertDevSplit(DIAGNOSE_SPLIT);
  runButton.disabled = true;
  try {
    while (model.state() === "loading") await new Promise<void>((r) => waiters.push(r));
    if (model.state() !== "ready") throw new Error("the name model failed to load");
    const res = await fetch(DIAGNOSE_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("could not read the dev file");
    const docs = (await res.text()).trimEnd().split("\n").map((l) => JSON.parse(l) as EvalDoc);
    const rows: DiagRow[] = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      status.textContent = `Document ${i + 1} of ${docs.length}`;
      const modelText = normaliseCapsRuns(d.text);
      const calls: RawCall[] = [];
      let from = 0;
      // Record every model call. Chunks are cut from the model's text in reading order, so each one is found at or after the last start.
      const names = await findNames(d.text, async (chunk) => {
        const predictions = await model.runner(chunk);
        if (predictions !== null) {
          const offset = modelText.indexOf(chunk, from);
          if (offset < 0) throw new Error("diagnosis: could not place a chunk");
          from = offset;
          calls.push({ offset, text: chunk, predictions });
        }
        return predictions;
      });
      const finalDets = combineDetections(d.text, detect(d.text), names).map((x) => ({ type: x.type, start: x.start, end: x.end }));
      rows.push(...diagnoseDoc(d, calls, finalDets));
    }
    result = { rows, summary: summarise(rows) };
    (window as unknown as { __diagnose: unknown }).__diagnose = result;
    out.textContent = JSON.stringify(result.summary, null, 1);
    download.disabled = false;
    status.textContent = `Done: ${docs.length} documents, ${rows.length} weak PERSON spans.`;
  } catch (e) {
    status.textContent = `Stopped: ${e instanceof Error ? e.message : "unknown error"}.`;
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => void run());
download.addEventListener("click", () => {
  if (!result) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 1)], { type: "application/json" }));
  a.download = "diagnose-dev.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
