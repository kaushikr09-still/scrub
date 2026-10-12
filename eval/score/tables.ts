// Turns a Summary into plain tables. The eval page draws them as HTML and the report script as Markdown.
import type { PrecisionRow, RecallRow, Summary } from "./score.ts";
import { formatRatio, ratio, type Ratio } from "./wilson.ts";

export interface Table {
  title: string;
  note?: string;
  head: string[];
  rows: string[][];
}

export interface ReportMeta {
  split: string;
  runAt: string;
  modelId: string;
  documents: number;
  jsonlSha256: string;
  /** Output of `git rev-parse HEAD`, or null if git was not available. */
  commit: string | null;
  durationMs?: number | null;
  /** SHA-256 of the jsonl file on disk when the report was made, if it could be read. */
  currentJsonlSha256?: string | null;
}

const recallRows = (m: Record<string, RecallRow>): string[][] =>
  Object.entries(m).map(([k, r]) => [k, String(r.total), formatRatio(r.recall), formatRatio(r.typeCorrect), String(r.partial), String(r.missed)]);
const RECALL_HEAD = (first: string) => [first, "Spans", "Recall (fully masked)", "Type-correct recall", "Partly masked", "Missed"];

const precisionRows = (m: Record<string, PrecisionRow>): string[][] =>
  Object.entries(m).map(([k, r]) => [k, String(r.detections), String(r.true), String(r.mismatch), String(r.falsePositive), formatRatio(r.precision)]);
const PRECISION_HEAD = (first: string) => [first, "Detections", "True", "Type mismatch", "False positive", "Precision"];

export function buildTables(s: Summary): Table[] {
  const tables: Table[] = [
    {
      title: "Headline",
      head: ["Measure", "Result"],
      rows: [
        ["Recall: truth spans fully masked", formatRatio(s.recall)],
        ["Type-correct recall: fully masked by detections of the right type", formatRatio(s.typeCorrectRecall)],
        ["Truth spans partly masked (counted as leaks)", `${s.partlyMasked} of ${s.truthTotal}`],
        ["Truth spans missed completely", `${s.missed} of ${s.truthTotal}`],
        ["Document leak rate: documents with at least one span not fully masked", formatRatio(s.leakDocs)],
        ["Precision: true detections out of true plus false positives", formatRatio(s.precision)],
        [
          "All detections",
          `${s.detections.total} (true ${s.detections.true}, type mismatch ${s.detections.mismatch}, false positive ${s.detections.falsePositive})`,
        ],
      ],
    },
    { title: "Recall by entity type", head: RECALL_HEAD("Type"), rows: recallRows(s.recallBy.type) },
    { title: "Recall by preset", head: RECALL_HEAD("Preset"), rows: recallRows(s.recallBy.preset) },
    { title: "Recall by PERSON pattern", head: RECALL_HEAD("Pattern"), rows: recallRows(s.recallBy.personPattern) },
    { title: "Recall by PERSON case style", head: RECALL_HEAD("Case style"), rows: recallRows(s.recallBy.caseStyle) },
    {
      title: "Document leak rate by preset",
      head: ["Preset", "Documents with a leak"],
      rows: Object.entries(s.leakBy.preset).map(([k, r]: [string, Ratio]) => [k, formatRatio(r)]),
    },
    { title: "Precision by detected type", head: PRECISION_HEAD("Detected type"), rows: precisionRows(s.precisionBy.type) },
    { title: "Precision by preset", head: PRECISION_HEAD("Preset"), rows: precisionRows(s.precisionBy.preset) },
    {
      title: "Type mismatches (still protective, listed separately)",
      head: ["Detected as -> truth type", "Detections"],
      rows: Object.entries(s.mismatchPairs).map(([k, n]) => [k, String(n)]),
    },
    {
      title: "Look-alike numbers (NEG): detections that overlap them",
      note: "These codes are not personal data. A detection over one is a false positive.",
      head: ["Kind", "NEG spans", "Touched by a detection", "Detections touching"],
      rows: Object.entries(s.negHits).map(([k, h]) => [
        k,
        String(h!.total),
        formatRatio(ratio(h!.touched, h!.total)),
        String(h!.detections),
      ]),
    },
  ];
  return tables;
}

const cell = (s: string) => s.replace(/\r?\n/g, "⏎").replace(/\|/g, "\\|");
const mdTable = (t: Table): string =>
  [
    `### ${t.title}`,
    ...(t.note ? ["", t.note] : []),
    "",
    `| ${t.head.map(cell).join(" | ")} |`,
    `| ${t.head.map(() => "---").join(" | ")} |`,
    ...(t.rows.length ? t.rows : [t.head.map((_, i) => (i === 0 ? "(none)" : ""))]).map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");

const DEFINITIONS = `## Definitions

- **Truth span**: one piece of personal data that the generator put into a document, with its exact position. Look-alike codes (order, ticket, invoice, reference, version numbers) are *not* truth.
- **Fully masked**: every character of the truth span is covered by the union of the product's detections, whatever type label the detections carry. **Partly masked**: some but not all characters are covered. **Missed**: none are. A partly masked span still shows part of the value, so it counts as a leak.
- **Recall** (headline) = fully masked spans / all truth spans. **Type-correct recall** is the same count, but the covering detections must all carry the truth span's own type.
- **Detection**: one span returned by the product's detection path (rules, name model, ALL CAPS copy, whole-word snapping), with every category on and no preset filtering.
- A detection is **true** if it overlaps a truth span of the same type. It is a **type mismatch** if it overlaps only truth of another type (still protective; counted and listed separately, and left out of precision). It is a **false positive** if it overlaps no truth span.
- **Precision** = true / (true + false positive).
- **Document leak rate** = documents with at least one truth span not fully masked / all documents.
- **Fixed template text is not scored as truth.** Timestamps such as "[12/05/24, 10:42 am]" and dates such as "Jan 2021 - Present" are written into the templates, so a mask there counts as a false positive. The same goes for filler words (skills, job titles, bank names) and for streets and door numbers.
- **Look-alike numbers (NEG)**: detections that overlap them are false positives and are also counted by kind.
- **Percentages** are always shown with their counts ("212 of 230") and a 95% Wilson score interval.

### Limits of this benchmark

- The documents are invented from templates and word lists written by the author. They are not real documents, and the numbers are likely optimistic for real text.
- **ADDRESS**: only the area, the city and the 6-digit PIN are scored. Street and door number are not scored (documented limit).
- **PERSON**: honorifics (Mr., Dr., Shri ...) are not part of the truth span. For "Priya S." the truth span is "Priya S" without the final dot.
- **MONEY forms used**: ₹5,000 · Rs. 5,000/- · Rs.5,000 · INR 1,25,000 · INR 1.5M · ₹12 LPA · 5,000 INR · 500 rupees · 5 lakh · 1.2 crore. Bare short units (12L, 50K) are not used.
- **DATE forms used**: day-month-year only, such as 12/05/2024, 12-05-24, 12.05.2024, 12 May 2024, 12th May 2024, 12-May-2024.
- Every ID is valid (Aadhaar Verhoeff, card Luhn, GSTIN check character). Bank accounts are 9 to 18 digits that fail Luhn.

## How to read this

Start with the headline recall and the document leak rate: they say how often something is left visible. Then look at recall by entity type and by PERSON pattern and case style to see where. Precision says how much extra is masked by mistake. A small count with a wide interval means the number is not reliable. Do not tune the product on the frozen test split; report these numbers as they are.`;

export function renderMarkdown(s: Summary, meta: ReportMeta): string {
  const out: string[] = [];
  out.push(`# Scrub evaluation: ${meta.split} split`, "");
  out.push(`- Code version (git commit): ${meta.commit ?? "not available (git could not be run)"}`);
  out.push(`- Split: ${meta.split}`);
  out.push(`- Run date and time: ${meta.runAt}`);
  out.push(`- Model: ${meta.modelId}`);
  out.push(`- Documents: ${meta.documents}`);
  out.push(`- SHA-256 of the scored file: ${meta.jsonlSha256}`);
  if (meta.currentJsonlSha256 !== undefined) {
    out.push(
      `- File on disk now: ${meta.currentJsonlSha256 === null ? "could not be read" : meta.currentJsonlSha256 === meta.jsonlSha256 ? "same SHA-256 as the scored file" : `DIFFERENT SHA-256 (${meta.currentJsonlSha256}); the data changed after this run`}`,
    );
  }
  if (meta.durationMs != null) out.push(`- Run time: ${(meta.durationMs / 1000).toFixed(1)} seconds`);
  out.push("", DEFINITIONS, "", "## Results", "");
  for (const t of buildTables(s)) out.push(mdTable(t), "");

  if (s.worstMisses.length > 0) {
    out.push("## Worst misses (dev only)", "", "Structured IDs first, then names, organisations and places; within each, missed spans first, then partly masked ones by how much is left uncovered. Context is 40 characters each side; ⏎ marks a line break.", "");
    out.push("| # | Doc | Type | Pattern / case | Status | Value | Before | After | Detected as |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    s.worstMisses.forEach((m, i) => {
      out.push(
        `| ${i + 1} | ${cell(m.docId)} | ${m.type} | ${cell(`${m.pattern ?? "-"} / ${m.caseStyle}`)} | ${m.status}, ${m.uncovered} | ${cell(m.value)} | ${cell(m.before)} | ${cell(m.after)} | ${cell(m.detectedAs.join(", ") || "-")} |`,
      );
    });
    out.push("");
  }
  if (s.falsePositives.length > 0) {
    const counts = new Map<string, number>();
    for (const f of s.falsePositives) counts.set(`${f.type}: ${f.value}`, (counts.get(`${f.type}: ${f.value}`) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
    out.push("## Most common false positives (dev only)", "", "| Detection | Times |", "| --- | --- |");
    for (const [k, n] of top) out.push(`| ${cell(k)} | ${n} |`);
    out.push("");
  }
  return out.join("\n");
}
