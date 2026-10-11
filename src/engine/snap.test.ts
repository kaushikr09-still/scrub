import { describe, expect, it } from "vitest";
import { findNames, type NameRunner } from "./names";
import { snapToWords } from "./spans";

/** Snaps the first occurrence of `part` in `text` and returns the text it covers. */
function snapped(text: string, part: string): string {
  const start = text.indexOf(part);
  const r = snapToWords(text, start, start + part.length);
  return text.slice(r.start, r.end);
}

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}\p{M}]/u.test(ch);

describe("snapToWords", () => {
  it("grows a first-letter, first-piece or middle fragment to the whole word", () => {
    const text = "Hi Priya, send it";
    expect(snapped(text, "P")).toBe("Priya");
    expect(snapped(text, "Pri")).toBe("Priya");
    expect(snapped(text, "riy")).toBe("Priya");
    expect(snapped(text, "riya")).toBe("Priya");
    expect(snapped(text, "Priya")).toBe("Priya");
  });

  it("stops at spaces and punctuation", () => {
    expect(snapped("Hi Priya, send", "Priya")).toBe("Priya");
    expect(snapped("(Priya) said", "Priya")).toBe("Priya");
    expect(snapped("Priya. Next", "Priya")).toBe("Priya");
    expect(snapped("a Priya b", "P")).toBe("Priya");
  });

  it("treats apostrophes and hyphens between letters as part of the word, straight or curly", () => {
    expect(snapped("Ask O'Brien today", "Bri")).toBe("O'Brien");
    expect(snapped("Ask O’Brien today", "O")).toBe("O’Brien");
    expect(snapped("Ask Anne-Marie today", "Anne")).toBe("Anne-Marie");
    expect(snapped("Ask Anne-Marie today", "Mar")).toBe("Anne-Marie");
  });

  it("does not take a hyphen or apostrophe that is not between letters", () => {
    expect(snapped("Priya- next", "Priya")).toBe("Priya");
    expect(snapped("'Priya' said", "Priya")).toBe("Priya");
    expect(snapped("Priya -Sharma", "Priya")).toBe("Priya");
  });

  it("stops before a trailing possessive 's, straight or curly", () => {
    expect(snapped("Priya's laptop", "Pri")).toBe("Priya");
    expect(snapped("Priya’s laptop", "Pri")).toBe("Priya");
    expect(snapped("Priya'S laptop", "Pri")).toBe("Priya");
    expect(snapped("Priya's", "P")).toBe("Priya");
  });

  it("only treats 's as a possessive when it ends the word", () => {
    expect(snapped("D'Souza called", "D")).toBe("D'Souza");
    expect(snapped("O'Sullivan called", "O")).toBe("O'Sullivan");
  });

  it("counts digits as word characters", () => {
    expect(snapped("ID Priya123 ok", "Priya")).toBe("Priya123");
    expect(snapped("ID 12Priya ok", "Priya")).toBe("12Priya");
  });

  it("counts any Unicode letter and combining mark, not only a-z", () => {
    expect(snapped("Hi Zoë, ok", "Zo")).toBe("Zoë");
    expect(snapped("Hi José, ok", "Jo")).toBe("José");
    expect(snapped("Hi José, ok", "Jos")).toBe("José");
    expect(snapped("Hi Ångström, ok", "ngstr")).toBe("Ångström");
    expect(snapped("नमस्ते Priya", "Pri")).toBe("Priya");
    expect(snapped("प्रिया शर्मा", "प्र")).toBe("प्रिया"); // letters plus combining vowel signs
    expect(snapped("Hi 😀Priya", "Pri")).toBe("Priya"); // an emoji is not a word character
  });

  it("copes with the edges of the text and empty spans", () => {
    expect(snapped("Priya", "ri")).toBe("Priya");
    expect(snapToWords("abc", 0, 0)).toEqual({ start: 0, end: 0 });
    expect(snapToWords("abc", 3, 3)).toEqual({ start: 3, end: 3 });
  });

  it("never leaves a letter or digit touching the span, wherever the fragment sits in a word", () => {
    const sentences = [
      "Hi Priya, send the invoice to rahul.s@gmail.com or call 98765 43210.",
      "Thanks, Anne-Marie O'Brien’s team (Zoë) and José.",
      "Priya123's file; D'Souza-Nair: ok",
    ];
    for (const text of sentences) {
      for (let a = 0; a < text.length; a++) {
        for (let b = a + 1; b <= Math.min(a + 4, text.length); b++) {
          if (!isWordChar(text[a])) continue;
          const r = snapToWords(text, a, b);
          expect(r.start <= a && r.end >= b, `${a}-${b} contains the original`).toBe(true);
          expect(isWordChar(text[r.start - 1]), `${text} [${a},${b}) left`).toBe(false);
          expect(isWordChar(text[r.end]), `${text} [${a},${b}) right`).toBe(false);
        }
      }
    }
  });
});

describe("findNames snaps model spans to whole words", () => {
  /** A runner that reports only `part` (first occurrence), as one person token. */
  const partial = (part: string, entity = "B-PER"): NameRunner => async (chunk) => {
    const start = chunk.indexOf(part);
    return start < 0 ? [] : [{ entity, word: part, start, end: start + part.length, score: 0.9 }];
  };
  const text = "Hi Priya, send the invoice to rahul.s@gmail.com or call 98765 43210.";

  it.each(["P", "Pri", "riy", "riya", "Priya"])("model says %j: the whole word is covered", async (part) => {
    const found = await findNames(text, partial(part));
    expect(found.map((d) => [d.type, d.value])).toEqual([["PERSON", "Priya"]]);
  });

  it("also snaps organisations and places", async () => {
    const t = "She joined Infosys in Pune.";
    expect((await findNames(t, partial("Info", "B-ORG"))).map((d) => d.value)).toEqual(["Infosys"]);
    expect((await findNames(t, partial("un", "B-LOC"))).map((d) => d.value)).toEqual(["Pune"]);
  });

  it("keeps the possessive outside the span", async () => {
    const found = await findNames("Priya's laptop", partial("Pri"));
    expect(found.map((d) => d.value)).toEqual(["Priya"]);
  });

  it("snaps a fragment cut off by a chunk boundary, using the whole text", async () => {
    const filler = "word ".repeat(40);
    const t = `${filler}Priya Sharma ${filler}`;
    const at = t.indexOf("Priya");
    // The runner reports only "Pri" wherever it sees it, as if a chunk edge had cut the name.
    const runner: NameRunner = async (chunk) => {
      const i = chunk.indexOf("Pri");
      return i < 0 ? [] : [{ entity: "B-PER", word: "Pri", start: i, end: i + 3 }];
    };
    const found = await findNames(t, runner, { size: 200, overlap: 60 });
    expect(found.map((d) => [d.value, d.start])).toEqual([["Priya", at]]);
  });

  it("in a multi-word name, only the words the model predicted are masked (no invented rule)", async () => {
    const found = await findNames("Hi Priya Sharma, thanks", partial("Priya"));
    expect(found.map((d) => d.value)).toEqual(["Priya"]);
  });

  it("leaves no letter or digit touching any model span, whatever fragment the model reports", async () => {
    for (let a = 0; a < text.length; a++) {
      for (let b = a + 1; b <= Math.min(a + 4, text.length); b++) {
        if (!isWordChar(text[a])) continue;
        const runner: NameRunner = async () => [{ entity: "B-PER", word: "x", start: a, end: b }];
        for (const d of await findNames(text, runner)) {
          expect(isWordChar(text[d.start - 1]), `[${a},${b}) left of "${d.value}"`).toBe(false);
          expect(isWordChar(text[d.end]), `[${a},${b}) right of "${d.value}"`).toBe(false);
        }
      }
    }
  });
});
