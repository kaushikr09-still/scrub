import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { url } from "./url";

const found = (text: string) => detect(text, [url]);
const values = (text: string) => found(text).map((d) => d.value);

describe("URL — should detect", () => {
  it("http and https links", () => {
    expect(values("see https://example.com/a?b=1#c")).toEqual(["https://example.com/a?b=1#c"]);
    expect(values("see http://10.0.0.1:8080/x")).toEqual(["http://10.0.0.1:8080/x"]);
    expect(found("https://example.com")[0].confidence).toBe(0.95);
  });

  it("www links", () => {
    expect(values("www.priyasharma.in")).toEqual(["www.priyasharma.in"]);
    expect(found("www.example.org")[0].confidence).toBe(0.9);
  });

  it("bare domains with a path", () => {
    expect(values("linkedin.com/in/priya-sharma")).toEqual(["linkedin.com/in/priya-sharma"]);
    expect(values("github.com/priya")).toEqual(["github.com/priya"]);
  });

  it("bare domains with two-part endings", () => {
    expect(values("acme.co.in")).toEqual(["acme.co.in"]);
    expect(values("portal.gov.in/apply")).toEqual(["portal.gov.in/apply"]);
  });

  it("trims trailing punctuation", () => {
    expect(values("Visit www.acme.com.")).toEqual(["www.acme.com"]);
    expect(values("(see https://acme.com/x)")).toEqual(["https://acme.com/x"]);
    expect(values("https://acme.com/x, then")).toEqual(["https://acme.com/x"]);
  });

  it("keeps balanced brackets inside a link", () => {
    expect(values("https://en.wikipedia.org/wiki/Pune_(city)")).toEqual([
      "https://en.wikipedia.org/wiki/Pune_(city)",
    ]);
  });

  it("a keyword raises confidence", () => {
    expect(found("acme.io")[0].confidence).toBe(0.75);
    expect(found("Portfolio: acme.io")[0].confidence).toBe(0.9);
  });
});

describe("URL — should NOT detect", () => {
  it("the domain of an email", () => {
    expect(values("priya@gmail.com")).toEqual([]);
    expect(values("first.last@acme.co.in")).toEqual([]);
  });

  it("file names", () => {
    expect(values("see report.pdf and main.py")).toEqual([]);
    expect(values("resume_final.docx")).toEqual([]);
  });

  it("an unknown ending", () => {
    expect(values("foo.bar")).toEqual([]);
  });

  it("a sentence missing its space", () => {
    expect(values("done.Then we left")).toEqual([]);
  });

  it("a number with a dot", () => {
    expect(values("1.5 lakh")).toEqual([]);
  });

  it("an ending glued to more letters", () => {
    expect(values("acme.community")).toEqual([]);
  });
});
