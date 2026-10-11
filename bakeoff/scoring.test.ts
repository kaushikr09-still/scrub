import { describe, expect, it } from "vitest";
import names from "./names.json";
import {
  findNameSpan,
  formatRecall,
  isPersonLabel,
  locatePredictions,
  scoreCandidate,
  sumFileSizes,
  type RawPrediction,
  type Sentence,
} from "./scoring";

describe("isPersonLabel", () => {
  it.each(["PER", "PERSON", "NAME", "GIVENNAME", "SURNAME", "FIRSTNAME", "LASTNAME", "FULLNAME"])(
    "accepts %s",
    (label) => expect(isPersonLabel(label)).toBe(true),
  );
  it("strips B- and I- prefixes", () => {
    expect(isPersonLabel("B-PER")).toBe(true);
    expect(isPersonLabel("I-PER")).toBe(true);
    expect(isPersonLabel("B-GIVENNAME")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isPersonLabel("b-per")).toBe(true);
    expect(isPersonLabel("Person")).toBe(true);
  });
  it("rejects other labels", () => {
    for (const l of ["ORG", "B-LOC", "I-MISC", "O", "EMAIL", "PHONE", "PERIOD", ""]) {
      expect(isPersonLabel(l)).toBe(false);
    }
  });
});

describe("findNameSpan", () => {
  it("finds the name, ignoring case", () => {
    expect(findNameSpan("Hi Priya Nair, thanks", "Priya Nair")).toEqual({ start: 3, end: 13 });
    expect(findNameSpan("hi priya nair, thanks", "Priya Nair")).toEqual({ start: 3, end: 13 });
  });
  it("returns null when the name is absent", () => {
    expect(findNameSpan("nobody here", "Priya")).toBeNull();
  });
  it("finds the name in every sentence of names.json", () => {
    for (const n of names) expect(findNameSpan(n.text, n.name), n.id).not.toBeNull();
  });
});

describe("locatePredictions", () => {
  const text = "Hi Priya Nair, thanks";

  it("uses start/end when the model gives them", () => {
    const p: RawPrediction[] = [{ entity: "B-PER", word: "Priya", start: 3, end: 8 }];
    expect(locatePredictions(text, p)).toEqual([{ label: "B-PER", start: 3, end: 8 }]);
  });

  it("matches a lower-case word to the original case ('priya' matches 'Priya')", () => {
    const p: RawPrediction[] = [{ entity: "B-PER", word: "priya" }];
    expect(locatePredictions(text, p)).toEqual([{ label: "B-PER", start: 3, end: 8 }]);
  });

  it("joins word-piece fragments into one word", () => {
    const p: RawPrediction[] = [
      { entity: "B-PER", word: "pri" },
      { entity: "I-PER", word: "##ya" },
      { entity: "I-PER", word: "na" },
      { entity: "I-PER", word: "##ir" },
    ];
    expect(locatePredictions(text, p)).toEqual([
      { label: "B-PER", start: 3, end: 8 },
      { label: "I-PER", start: 9, end: 13 },
    ]);
  });

  it("handles sentencepiece-style ▁ prefixes", () => {
    const p: RawPrediction[] = [{ entity: "PER", word: "▁Arjun" }];
    expect(locatePredictions("Share with Arjun Mehta", p)).toEqual([{ label: "PER", start: 11, end: 16 }]);
  });

  it("does not match the middle of an earlier word for a word-start token", () => {
    // "an" also occurs inside "thanks"; the word-start match must skip it and find "An".
    const p: RawPrediction[] = [{ entity: "PER", word: "an" }];
    expect(locatePredictions("thanks to An Roy", p)).toEqual([{ label: "PER", start: 10, end: 12 }]);
  });

  it("skips tokens it cannot find instead of throwing", () => {
    const p: RawPrediction[] = [{ entity: "PER", word: "[UNK]" }];
    expect(locatePredictions(text, p)).toEqual([]);
  });
});

describe("scoreCandidate", () => {
  const sentences: Sentence[] = [
    { id: "a", pattern: "full_name", name: "Priya Nair", text: "Hi Priya Nair, thanks" },
    { id: "b", pattern: "full_name", name: "Arjun Mehta", text: "Send to Arjun Mehta in Pune" },
    { id: "c", pattern: "single_name", name: "Ravi", text: "Ravi will join from Pune" },
  ];

  it("counts a name found when any person prediction overlaps it", () => {
    const preds = [
      [{ label: "B-PER", start: 3, end: 8 }], // a: partial overlap -> found
      [{ label: "B-ORG", start: 8, end: 19 }], // b: wrong type -> missed
      [], // c: nothing -> missed
    ];
    const r = scoreCandidate(sentences, preds);
    expect(r.overall).toEqual({ found: 1, total: 3 });
    expect(r.byPattern.full_name).toEqual({ found: 1, total: 2 });
    expect(r.byPattern.single_name).toEqual({ found: 0, total: 1 });
  });

  it("does not count a prediction that only touches the name span", () => {
    const preds = [[{ label: "PER", start: 0, end: 3 }], [], []]; // ends exactly where the name starts
    expect(scoreCandidate(sentences, preds).overall.found).toBe(0);
  });

  it("counts person predictions outside the name span", () => {
    const preds = [
      [
        { label: "PER", start: 3, end: 8 }, // inside
        { label: "PER", start: 15, end: 21 }, // outside
        { label: "LOC", start: 0, end: 2 }, // not a person: ignored
      ],
      [{ label: "I-PER", start: 0, end: 4 }], // outside
      [],
    ];
    expect(scoreCandidate(sentences, preds).outside).toBe(2);
  });
});

describe("formatRecall", () => {
  it("shows percentage with x of N", () => {
    expect(formatRecall({ found: 7, total: 9 })).toBe("78% (7 of 9)");
    expect(formatRecall({ found: 0, total: 9 })).toBe("0% (0 of 9)");
    expect(formatRecall({ found: 81, total: 81 })).toBe("100% (81 of 81)");
  });
  it("handles an empty group", () => {
    expect(formatRecall({ found: 0, total: 0 })).toBe("n/a (0 of 0)");
  });
});

describe("sumFileSizes", () => {
  it("sums the size of each distinct file once, in MB", () => {
    const events = [
      { file: "model.onnx", loaded: 10, total: 4_000_000 },
      { file: "model.onnx", loaded: 4_000_000, total: 4_000_000 },
      { file: "tokenizer.json", loaded: 1_000_000, total: 1_000_000 },
    ];
    expect(sumFileSizes(events)).toBeCloseTo(5, 5);
  });
  it("falls back to the largest loaded value when total is missing", () => {
    expect(sumFileSizes([{ file: "a", loaded: 2_000_000 }])).toBeCloseTo(2, 5);
  });
  it("is zero for no events", () => {
    expect(sumFileSizes([])).toBe(0);
  });
});
