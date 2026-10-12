// npm run eval:report -- dev    (or: test)
// Turns eval/results/<split>.json (downloaded from the eval page) into eval/results/<split>.md.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { metaFrom, type ResultsFile } from "./results.ts";
import { scoreRun } from "./score/score.ts";
import { renderMarkdown } from "./score/tables.ts";
import type { EvalDoc } from "./types.ts";

const evalDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(evalDir, "..");
const split = process.argv[2];
if (split !== "dev" && split !== "test") {
  console.error("Usage: npm run eval:report -- dev   (or: test)");
  process.exit(1);
}

const input = join(evalDir, "results", `${split}.json`);
let results: ResultsFile;
try {
  results = JSON.parse(readFileSync(input, "utf8")) as ResultsFile;
} catch {
  console.error(`Could not read ${input}. Run the evaluation page and save its download there first.`);
  process.exit(1);
}
if (results.split !== split) {
  console.error(`${input} says it is the "${results.split}" split, not "${split}". Nothing written.`);
  process.exit(1);
}

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
const head = git("rev-parse", "HEAD");
const dirty = head !== null && (git("status", "--porcelain", "--", "src", "eval", "package.json", ":(exclude)eval/results") ?? "") !== "";
const commit = head === null ? null : dirty ? `${head} (plus uncommitted changes in src, eval or package.json)` : head;

let current: string | null = null;
let docs: EvalDoc[] | null = null;
try {
  const bytes = readFileSync(join(evalDir, "generated", `${split}.jsonl`));
  current = createHash("sha256").update(bytes).digest("hex");
  docs = bytes.toString("utf8").trimEnd().split("\n").map((l) => JSON.parse(l) as EvalDoc);
} catch {
  current = null;
}

// The tables are re-scored from the raw detections stored in the results file, so the numbers always come from the
// scoring code in this commit. This only works if the scored file is byte-for-byte the one that was run.
let summary = results.summary;
if (docs !== null && current === results.jsonlSha256) {
  summary = scoreRun(docs, results.detections, { includeDetail: split === "dev" });
  if (summary.recall.num !== results.summary.recall.num || summary.recall.den !== results.summary.recall.den) {
    console.warn("Note: the summary stored in the results file differs from a re-score; the report uses the re-score.");
  }
} else {
  console.warn("Warning: eval/generated/" + split + ".jsonl is not the file that was scored, so the report uses the summary stored in the results file.");
}

const md = renderMarkdown(summary, metaFrom(results, commit, current));
const out = join(evalDir, "results", `${split}.md`);
writeFileSync(out, md);
console.log(`Wrote ${out}`);
