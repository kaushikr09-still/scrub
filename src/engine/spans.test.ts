import { describe, expect, it } from "vitest";
import { findNames, type NameRunner } from "./names";
import { locatePredictions, type RawPrediction } from "./spans";

/** Tokens as bert-base-NER really returned them for the opening of a paragraph (all tokens, O included). */
const TEXT =
  "Hi Meera, thanks for sending over the revised proposal on Friday. Rohan Kapoor from Finance has a question.";
const REAL_TOKENS: RawPrediction[] = [
  { entity: "O", word: "Hi" },
  { entity: "B-PER", word: "Me" },
  { entity: "B-PER", word: "##era" },
  { entity: "O", word: "," },
  { entity: "O", word: "thanks" },
  { entity: "O", word: "for" },
  { entity: "O", word: "sending" },
  { entity: "O", word: "over" },
  { entity: "O", word: "the" },
  { entity: "O", word: "revised" },
  { entity: "O", word: "proposal" },
  { entity: "O", word: "on" },
  { entity: "O", word: "Friday" },
  { entity: "O", word: "." },
  { entity: "B-PER", word: "R" },
  { entity: "B-PER", word: "##oh" },
  { entity: "B-PER", word: "##an" },
  { entity: "I-PER", word: "Kapoor" },
  { entity: "O", word: "from" },
  { entity: "B-ORG", word: "Finance" },
  { entity: "O", word: "has" },
  { entity: "O", word: "a" },
  { entity: "O", word: "question" },
  { entity: "O", word: "." },
];

describe("locatePredictions with every token, in order", () => {
  it("puts a lone first letter on its own word, not on the next word that starts with that letter", () => {
    const spans = locatePredictions(TEXT, REAL_TOKENS).filter((s) => s.label !== "O");
    const words = spans.map((s) => [s.label, TEXT.slice(s.start, s.end)]);
    expect(words).toEqual([
      ["B-PER", "Meera"],
      ["B-PER", "Rohan"],
      ["I-PER", "Kapoor"],
      ["B-ORG", "Finance"],
    ]);
  });

  it("joins word pieces into whole words and keeps O words as O", () => {
    const spans = locatePredictions(TEXT, REAL_TOKENS);
    const revised = spans.find((s) => TEXT.slice(s.start, s.end) === "revised");
    expect(revised?.label).toBe("O");
  });

  it("a name piece after an O first piece still marks the word as a name", () => {
    const spans = locatePredictions("Hi Xyzabc", [
      { entity: "O", word: "Hi" },
      { entity: "O", word: "X" },
      { entity: "B-PER", word: "##yz" },
      { entity: "O", word: "##abc" },
    ]);
    expect(spans.map((s) => [s.label, "Hi Xyzabc".slice(s.start, s.end)])).toEqual([
      ["O", "Hi"],
      ["B-PER", "Xyzabc"],
    ]);
  });

  it("still copes with dropped tokens (the old way), as before", () => {
    const text = "Hi Priya Sharma";
    const spans = locatePredictions(text, [
      { entity: "B-PER", word: "Pri" },
      { entity: "I-PER", word: "##ya" },
      { entity: "I-PER", word: "Sharma" },
    ]);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["Priya", "Sharma"]);
  });

  it("walks punctuation tokens exactly, so email-like text stays in step", () => {
    const text = "to rahul.s@gmail.com now Ravi";
    const spans = locatePredictions(text, [
      { entity: "O", word: "to" },
      { entity: "O", word: "r" },
      { entity: "O", word: "##ahu" },
      { entity: "O", word: "##l" },
      { entity: "O", word: "." },
      { entity: "O", word: "s" },
      { entity: "O", word: "@" },
      { entity: "O", word: "g" },
      { entity: "O", word: "##mail" },
      { entity: "O", word: "." },
      { entity: "O", word: "com" },
      { entity: "O", word: "now" },
      { entity: "B-PER", word: "Ravi" },
    ]);
    const last = spans[spans.length - 1];
    expect([last.label, text.slice(last.start, last.end)]).toEqual(["B-PER", "Ravi"]);
  });
});

describe("findNames with the real token stream", () => {
  const runner: NameRunner = async () => REAL_TOKENS;

  it("masks the right words and does not touch 'revised'", async () => {
    const found = await findNames(TEXT, runner);
    expect(found.map((d) => [d.type, d.value])).toEqual([
      ["PERSON", "Meera"],
      ["PERSON", "Rohan Kapoor"],
      ["ORG", "Finance"],
    ]);
  });
});
