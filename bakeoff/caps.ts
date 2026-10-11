// Dev-only runner for the ALL CAPS experiment (P6c). Lives outside src/ on purpose: it downloads the model.
// Only bakeoff/names.json and bakeoff/caps_headings.json go through the model. No user text is read, sent or stored.
import { env, pipeline } from "@huggingface/transformers";
import { normaliseCapsRuns } from "../src/engine/capsNormalise";
import { findNames } from "../src/engine/names";
import headings from "./caps_headings.json";
import names from "./names.json";
import { locatePredictions, scoreCandidate, type RawPrediction, type Sentence } from "./scoring";

env.allowLocalModels = false;

const capsNames = (names as Sentence[]).filter((s) => s.pattern === "all_caps");
const results: Record<string, unknown> = {};
(window as unknown as { __caps: unknown }).__caps = results;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

async function run() {
  ($("run") as HTMLButtonElement).disabled = true;
  $("status").textContent = "Loading model…";
  const pipe = await pipeline("token-classification", "Xenova/bert-base-NER", { dtype: "q8" });
  const detail: string[] = [];
  try {
    await pipe("warm up", { ignore_labels: [] });
    for (const on of [false, true]) {
      const feed = (t: string) => (on ? normaliseCapsRuns(t) : t);
      // Names: same scoring as the earlier bake-off. The model sees the copy; scoring slices the original (same length).
      const located = [];
      for (const s of capsNames) {
        const seen = feed(s.text);
        const out = (await pipe(seen, { ignore_labels: [] })) as RawPrediction[];
        located.push(locatePredictions(seen, out));
      }
      const score = scoreCandidate(capsNames, located);
      // Headings: the real name detector (chunking, grouping, snapping, PER/ORG/LOC mapping).
      const runner = async (chunk: string) =>
        ((await pipe(chunk, { ignore_labels: [] })) as { entity: string; word: string; score: number }[]).map((p) => ({
          entity: p.entity,
          word: p.word,
          score: p.score,
        }));
      const falseMasks: string[] = [];
      for (const h of headings as string[]) {
        const found = await findNames(feed(h), runner);
        if (found.length > 0) falseMasks.push(`${h}  ->  ${found.map((d) => `${d.type}:"${h.slice(d.start, d.end)}"`).join(", ")}`);
      }
      const label = on ? "ON" : "OFF";
      results[label] = {
        touched: score.overall,
        fully: score.fullOverall,
        partial: score.partial,
        outside: score.outside,
        falseMasks,
        fedNames: capsNames.map((s) => feed(s.text)),
      };
      const tr = document.createElement("tr");
      for (const t of [label, `${score.overall.found} of ${score.overall.total}`, `${score.fullOverall.found} of ${score.fullOverall.total}`, `${falseMasks.length} of ${(headings as string[]).length}`]) {
        const td = document.createElement("td");
        td.textContent = t;
        tr.appendChild(td);
      }
      $("rows").appendChild(tr);
      detail.push(`Transform ${label}: headings with a false mask:`, ...falseMasks.map((m) => `  ${m}`), "");
      detail.push(`Transform ${label}: names touched but partly masked:`, ...score.partial.map((p) => `  ${p.id}: ${p.shown}`), "");
    }
  } finally {
    await pipe.dispose();
  }
  $("detail").textContent = detail.join("\n");
  $("status").textContent = "Done.";
  ($("run") as HTMLButtonElement).disabled = false;
}

$("run").addEventListener("click", () => void run());
