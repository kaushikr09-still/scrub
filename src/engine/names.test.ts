import { describe, expect, it } from "vitest";
import { detect } from "./detect";
import {
  CHUNK_CHARS,
  MAX_MODEL_TOKENS,
  NamesIncompleteError,
  OVERLAP_CHARS,
  combineDetections,
  findNames,
  mapLabel,
  planChunks,
  type NameRunner,
} from "./names";
import { scrub } from "./scrub";
import type { RawPrediction } from "./spans";

const GAZETTEER: Record<string, string> = {
  "Priya Sharma": "PER",
  "Rahul Verma": "PER",
  "Infosys": "ORG",
  "Pune": "LOC",
  "Diwali": "MISC",
};

/** A fake model: reports every gazetteer entry it can see whole in the chunk, as B-/I- word tokens. */
function gazetteerPredictions(chunk: string): RawPrediction[] {
  const out: RawPrediction[] = [];
  for (const [name, kind] of Object.entries(GAZETTEER)) {
    for (let at = chunk.indexOf(name); at >= 0; at = chunk.indexOf(name, at + 1)) {
      let offset = at;
      name.split(" ").forEach((word, i) => {
        out.push({ entity: `${i === 0 ? "B" : "I"}-${kind}`, word, start: offset, end: offset + word.length, score: 0.99 });
        offset += word.length + 1;
      });
    }
  }
  return out.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

const fakeRunner: NameRunner = async (chunk) => gazetteerPredictions(chunk);

/** A fake token counter: every letter run of up to 4 letters is one token, every other non-space character is one. */
function fakeTokenCount(chunk: string): number {
  const words = chunk.match(/\p{L}{1,4}/gu)?.length ?? 0;
  const other = chunk.match(/[^\p{L}\s]/gu)?.length ?? 0;
  return words + other + 2;
}

const FILLER = "The quarterly review went well and the team agreed on the next steps for the release. ";

describe("planChunks", () => {
  it("gives one chunk for short text", () => {
    expect(planChunks("Hello there", 100, 20)).toEqual([{ start: 0, end: 11 }]);
    expect(planChunks("", 100, 20)).toEqual([]);
  });

  it("covers long text, overlaps neighbours and never exceeds the size", () => {
    const text = FILLER.repeat(60);
    const chunks = planChunks(text, 300, 60);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0].start).toBe(0);
    expect(chunks[chunks.length - 1].end).toBe(text.length);
    chunks.forEach((c, i) => {
      expect(c.end - c.start).toBeLessThanOrEqual(300);
      if (i > 0) {
        expect(c.start).toBeLessThan(chunks[i - 1].end); // overlap
        expect(c.start).toBeGreaterThan(chunks[i - 1].start); // progress
      }
    });
  });

  it("cuts at spaces, not in the middle of a word", () => {
    const text = FILLER.repeat(30);
    for (const c of planChunks(text, 250, 50)) {
      expect(text[c.start - 1] === undefined || /\s/.test(text[c.start - 1])).toBe(true);
      expect(text[c.end] === undefined || /\s/.test(text[c.end])).toBe(true);
    }
  });

  it("still makes progress and covers text that has no spaces at all", () => {
    const text = "x".repeat(1000);
    const chunks = planChunks(text, 200, 40);
    expect(chunks[chunks.length - 1].end).toBe(1000);
    chunks.forEach((c, i) => {
      expect(c.end - c.start).toBeLessThanOrEqual(200);
      if (i > 0) expect(c.start).toBeGreaterThan(chunks[i - 1].start);
    });
  });

  it("uses the documented default sizes", () => {
    expect(CHUNK_CHARS).toBe(1200);
    expect(OVERLAP_CHARS).toBe(200);
    expect(MAX_MODEL_TOKENS).toBe(500);
  });
});

describe("mapLabel", () => {
  it("maps PER to PERSON, keeps ORG and LOC, ignores MISC and unknowns", () => {
    expect(mapLabel("B-PER")).toBe("PERSON");
    expect(mapLabel("I-PER")).toBe("PERSON");
    expect(mapLabel("PER")).toBe("PERSON");
    expect(mapLabel("B-ORG")).toBe("ORG");
    expect(mapLabel("I-LOC")).toBe("LOC");
    expect(mapLabel("B-MISC")).toBeNull();
    expect(mapLabel("O")).toBeNull();
    expect(mapLabel("")).toBeNull();
  });
});

describe("findNames", () => {
  it("finds persons, organisations and places, and skips MISC", async () => {
    const text = "Priya Sharma joined Infosys in Pune before Diwali.";
    const found = await findNames(text, fakeRunner);
    expect(found.map((d) => [d.type, d.value])).toEqual([
      ["PERSON", "Priya Sharma"],
      ["ORG", "Infosys"],
      ["LOC", "Pune"],
    ]);
    for (const d of found) expect(text.slice(d.start, d.end)).toBe(d.value);
  });

  it("keeps two people side by side apart when the model starts a new name", async () => {
    const runner: NameRunner = async () => [
      { entity: "B-PER", word: "Priya", start: 0, end: 5 },
      { entity: "I-PER", word: "Sharma", start: 6, end: 12 },
      { entity: "B-PER", word: "Rahul", start: 13, end: 18 },
      { entity: "I-PER", word: "Verma", start: 19, end: 24 },
    ];
    const found = await findNames("Priya Sharma Rahul Verma", runner);
    expect(found.map((d) => d.value)).toEqual(["Priya Sharma", "Rahul Verma"]);
  });

  it("joins word pieces when the model gives no offsets", async () => {
    const runner: NameRunner = async () => [
      { entity: "B-PER", word: "Pri" },
      { entity: "I-PER", word: "##ya" },
      { entity: "I-PER", word: "Sharma" },
    ];
    const found = await findNames("Ask Priya Sharma today", runner);
    expect(found.map((d) => d.value)).toEqual(["Priya Sharma"]);
  });

  it("returns nothing for empty text and does not call the model", async () => {
    let calls = 0;
    const found = await findNames("   ", async () => {
      calls++;
      return [];
    });
    expect(found).toEqual([]);
    expect(calls).toBe(0);
  });

  it("finds a name that straddles every possible chunk boundary exactly once", async () => {
    const size = 300;
    for (let pad = 0; pad < 60; pad++) {
      const before = ("word ".repeat(100)).slice(0, size - 30 + pad);
      const text = `${before} Priya Sharma ${"later ".repeat(80)}`;
      const found = await findNames(text, fakeRunner, { size, overlap: 80 });
      const people = found.filter((d) => d.type === "PERSON");
      expect(people.map((d) => d.value), `pad ${pad}`).toEqual(["Priya Sharma"]);
    }
  });

  it("merges the same name reported by two overlapping chunks into one span", async () => {
    const text = `${"filler ".repeat(40)}Rahul Verma ${"filler ".repeat(40)}`;
    const seen: string[] = [];
    const runner: NameRunner = async (chunk) => {
      seen.push(chunk);
      return gazetteerPredictions(chunk);
    };
    const found = await findNames(text, runner, { size: 300, overlap: 200 });
    expect(seen.filter((c) => c.includes("Rahul Verma")).length).toBeGreaterThan(1); // really reported twice
    expect(found.map((d) => d.value)).toEqual(["Rahul Verma"]);
  });

  it("unions partial reports of the same name from different chunks", async () => {
    // First chunk only sees "Priya Sha" (cut), second sees all of it.
    const text = "aaaa bbbb Priya Sharma cccc dddd";
    const runner: NameRunner = async (chunk) =>
      chunk.includes("Priya Sharma")
        ? [
            { entity: "B-PER", word: "Priya", start: chunk.indexOf("Priya"), end: chunk.indexOf("Priya") + 5 },
            { entity: "I-PER", word: "Sharma", start: chunk.indexOf("Sharma"), end: chunk.indexOf("Sharma") + 6 },
          ]
        : chunk.includes("Priya")
          ? [{ entity: "B-PER", word: "Priya", start: chunk.indexOf("Priya"), end: chunk.indexOf("Priya") + 5 }]
          : [];
    const found = await findNames(text, runner, { size: 20, overlap: 12, minSize: 4 });
    expect(found.map((d) => d.value)).toEqual(["Priya Sharma"]);
  });

  it("rejects when the runner throws, without putting any text in the message", async () => {
    const secret = "Priya Sharma lives at flat 12";
    const runner: NameRunner = async (chunk) => {
      throw new Error(`model crashed on ${chunk}`);
    };
    const err = await findNames(secret, runner).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain("Priya");
    expect((err as Error).message).not.toContain("flat");
  });

  it("splits and retries chunks the model says are too long (digit-and-symbol-heavy text)", async () => {
    // Each piece is unique, so a chunk can be located in the text afterwards.
    const heavy = (from: number) => Array.from({ length: 500 }, (_, i) => `${from + i}#`).join(" ");
    const text = `${heavy(0)} Priya Sharma ${heavy(1000)} Pune ${heavy(2000)}`;
    // The first, default-sized chunk really is over the limit: this is why splitting matters.
    expect(fakeTokenCount(text.slice(0, CHUNK_CHARS))).toBeGreaterThan(MAX_MODEL_TOKENS);

    const accepted: { start: number; end: number }[] = [];
    let rejected = 0;
    const runner: NameRunner = async (chunk) => {
      if (fakeTokenCount(chunk) > MAX_MODEL_TOKENS) {
        rejected++;
        return null;
      }
      const at = text.indexOf(chunk);
      accepted.push({ start: at, end: at + chunk.length });
      return gazetteerPredictions(chunk);
    };
    const found = await findNames(text, runner);
    expect(rejected).toBeGreaterThan(0);
    expect(found.map((d) => d.value)).toEqual(["Priya Sharma", "Pune"]);

    // Every character of the text was inside some chunk the model accepted.
    const covered = new Uint8Array(text.length);
    for (const a of accepted) covered.fill(1, a.start, a.end);
    const gaps = [...covered].filter((v, i) => v === 0 && /\S/.test(text[i])).length;
    expect(gaps).toBe(0);
  });

  it("fails with NamesIncompleteError when a piece cannot be checked at any size", async () => {
    const text = "Priya Sharma ".repeat(100);
    const err = await findNames(text, async () => null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NamesIncompleteError);
    expect((err as Error).message).not.toContain("Priya");
  });
});

describe("combineDetections (rules first, model last)", () => {
  it("keeps rule detections and adds model names beside them", () => {
    const text = "Priya Sharma, priya@example.com, Pune";
    const rules = detect(text);
    const names = [
      { type: "PERSON" as const, start: 0, end: 12, value: "Priya Sharma", confidence: 0.9 },
      { type: "LOC" as const, start: 33, end: 37, value: "Pune", confidence: 0.9 },
    ];
    const all = combineDetections(text, rules, names);
    expect(all.map((d) => [d.type, d.value])).toEqual([
      ["PERSON", "Priya Sharma"],
      ["EMAIL", "priya@example.com"],
      ["LOC", "Pune"],
    ]);
  });

  it("a rule always beats a model span it overlaps; the model span keeps only what is left over", () => {
    const text = "Ask Rahul priya@example.com now";
    const rules = detect(text);
    const names = [{ type: "PERSON" as const, start: 4, end: 27, value: "Rahul priya@example.com", confidence: 0.8 }];
    const all = combineDetections(text, rules, names);
    expect(all.map((d) => [d.type, d.value])).toEqual([
      ["PERSON", "Rahul"],
      ["EMAIL", "priya@example.com"],
    ]);
  });

  it("drops a model span that is entirely inside a rule span", () => {
    const text = "Mail priya@example.com";
    const rules = detect(text);
    const names = [{ type: "PERSON" as const, start: 5, end: 10, value: "priya", confidence: 0.8 }];
    expect(combineDetections(text, rules, names).map((d) => d.type)).toEqual(["EMAIL"]);
  });

  it("produces output that scrub accepts and that round-trips placeholders", () => {
    const text = "Priya Sharma of Infosys, Pune: priya@example.com";
    const names = [
      { type: "PERSON" as const, start: 0, end: 12, value: "Priya Sharma", confidence: 0.9 },
      { type: "ORG" as const, start: 16, end: 23, value: "Infosys", confidence: 0.9 },
      { type: "LOC" as const, start: 25, end: 29, value: "Pune", confidence: 0.9 },
    ];
    const r = scrub(text, combineDetections(text, detect(text), names));
    expect(r.text).toBe("[PERSON_1] of [ORG_1], [LOC_1]: [EMAIL_1]");
  });
});

describe("findNames with ALL CAPS text", () => {
  it("shows the model a title-case copy but reports spans and values from the original", async () => {
    const text = "SIGNED BY RAHUL VERMA TODAY";
    const seen: string[] = [];
    const runner: NameRunner = async (chunk) => {
      seen.push(chunk);
      return gazetteerPredictions(chunk);
    };
    const found = await findNames(text, runner);
    expect(seen).toEqual(["Signed By Rahul Verma Today"]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ type: "PERSON", start: 10, end: 21, value: "RAHUL VERMA" });
    expect(text.slice(found[0].start, found[0].end)).toBe("RAHUL VERMA");
  });

  it("does not change text that has no ALL CAPS run", async () => {
    const seen: string[] = [];
    await findNames("Ask Rahul Verma about PAN", async (chunk) => {
      seen.push(chunk);
      return [];
    });
    expect(seen).toEqual(["Ask Rahul Verma about PAN"]);
  });
});

describe("findNames joins initials to the name after them", () => {
  const tok = (text: string, word: string, entity: string, from = 0): RawPrediction => {
    const start = text.indexOf(word, from);
    return { entity, word, start, end: start + word.length, score: 0.9 };
  };
  const run = async (text: string, preds: (t: string) => RawPrediction[]) => (await findNames(text, async () => preds(text))).map((d) => [d.type, d.value]);

  it("A. Agarwal is one name, including the dot", async () => {
    const text = "Escalated to A. Agarwal today.";
    expect(await run(text, (t) => [tok(t, "A", "B-PER"), tok(t, ".", "O"), tok(t, "Agarwal", "B-PER")])).toEqual([["PERSON", "A. Agarwal"]]);
  });
  it("R. L. Bains is one name", async () => {
    const text = "Escalated to R. L. Bains.";
    expect(await run(text, (t) => [tok(t, "R", "B-PER"), tok(t, "L", "B-PER", 15), tok(t, "Bains", "B-PER")])).toEqual([["PERSON", "R. L. Bains"]]);
  });
  it("does not join a full word before a full stop to the next sentence's name", async () => {
    const text = "Ask Priya. Rahul agrees.";
    expect(await run(text, (t) => [tok(t, "Priya", "B-PER"), tok(t, "Rahul", "B-PER")])).toEqual([["PERSON", "Priya"], ["PERSON", "Rahul"]]);
  });
  it("does not join a single capital letter that is not a PERSON", async () => {
    const text = "Plan B. Pune office.";
    expect(await run(text, (t) => [tok(t, "B", "B-ORG"), tok(t, "Pune", "B-LOC")])).toEqual([["ORG", "B"], ["LOC", "Pune"]]);
  });
});
