// npm run eval:generate — writes eval/generated/dev.jsonl and test.jsonl. Stops with an error if any self-check fails.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Template } from "../types.ts";
import { generateChecked, type Lists } from "./generate.ts";

const evalDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(evalDir, p), "utf8")) as T;

const lists = read<Lists>("data/lists.json");
mkdirSync(join(evalDir, "generated"), { recursive: true });

for (const split of ["dev", "test"]) {
  const templates = read<Template[]>(`templates/${split}.json`);
  const { docs, jsonl } = generateChecked(split, templates, lists);
  writeFileSync(join(evalDir, "generated", `${split}.jsonl`), jsonl);
  const spans = docs.reduce((n, d) => n + d.truth.length, 0);
  const negs = docs.reduce((n, d) => n + d.negatives.length, 0);
  console.log(`${split}: ${docs.length} documents, ${spans} truth spans, ${negs} negatives. Self-checks passed.`);
}
