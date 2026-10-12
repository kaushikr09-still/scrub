import { describe, expect, it } from "vitest";
import { detect } from "../engine/detect";
import { restore } from "../engine/restore";
import { scrub } from "../engine/scrub";
import type { Detection, DetectionType } from "../engine/types";
import { ALL_TYPES, PRESETS, buildRows, defaultsFor, filterDetections, type Overrides } from "./review";

function det(type: DetectionType, text: string, value: string, from = 0): Detection {
  const start = text.indexOf(value, from);
  return { type, start, end: start + value.length, value, confidence: 1 };
}

const TEXT = "Rahul Rao of Acme Ltd in Pune: rahul@example.com, again Rahul Rao, RAHUL@example.com.";
const FOUND: Detection[] = [
  det("PERSON", TEXT, "Rahul Rao"),
  det("ORG", TEXT, "Acme Ltd"),
  det("LOC", TEXT, "Pune"),
  det("EMAIL", TEXT, "rahul@example.com"),
  det("PERSON", TEXT, "Rahul Rao", 40),
  det("EMAIL", TEXT, "RAHUL@example.com"),
];

describe("preset defaults", () => {
  it("Resumes: ORG and LOC off, everything else on", () => {
    const d = defaultsFor("resumes");
    expect(ALL_TYPES.filter((t) => !d[t])).toEqual(["ORG", "LOC"]);
  });
  it("Business emails: everything on", () => {
    const d = defaultsFor("business");
    expect(ALL_TYPES.every((t) => d[t])).toBe(true);
  });
  it("Chat logs: only LOC off", () => {
    const d = defaultsFor("chat");
    expect(ALL_TYPES.filter((t) => !d[t])).toEqual(["LOC"]);
  });
  it("every preset knows every type", () => {
    for (const p of PRESETS) expect(Object.keys(defaultsFor(p.id)).sort()).toEqual([...ALL_TYPES].sort());
  });
});

describe("filterDetections", () => {
  it("leaves categories that are off as plain text", () => {
    const out = filterDetections(FOUND, defaultsFor("resumes"), {});
    expect(out.map((d) => d.type)).not.toContain("ORG");
    expect(out.map((d) => d.type)).not.toContain("LOC");
    expect(scrub(TEXT, out).text).toContain("Acme Ltd");
  });
  it("an override beats the category, both ways", () => {
    const rows = buildRows(FOUND, defaultsFor("resumes"), {});
    const org = rows.find((r) => r.type === "ORG")!;
    const person = rows.find((r) => r.type === "PERSON")!;
    const overrides: Overrides = { [org.key]: true, [person.key]: false };
    const text = scrub(TEXT, filterDetections(FOUND, defaultsFor("resumes"), overrides)).text;
    expect(text).not.toContain("Acme");
    expect(text).toContain("Rahul Rao");
  });
  it("the same value is masked in every place or in none", () => {
    const rows = buildRows(FOUND, defaultsFor("business"), {});
    const person = rows.find((r) => r.type === "PERSON")!;
    expect(person.count).toBe(2);
    const off = scrub(TEXT, filterDetections(FOUND, defaultsFor("business"), { [person.key]: false })).text;
    expect(off.match(/Rahul Rao/g)).toHaveLength(2);
    const on = scrub(TEXT, filterDetections(FOUND, defaultsFor("business"), {})).text;
    expect(on).not.toContain("Rahul Rao");
  });
  it("does not change the list it is given", () => {
    const copy = JSON.stringify(FOUND);
    filterDetections(FOUND, defaultsFor("resumes"), {});
    expect(JSON.stringify(FOUND)).toBe(copy);
  });
});

describe("buildRows", () => {
  it("one row per distinct value, with counts, in first-seen order", () => {
    const rows = buildRows(FOUND, defaultsFor("business"), {});
    expect(rows.map((r) => [r.type, r.count])).toEqual([
      ["PERSON", 2],
      ["ORG", 1],
      ["LOC", 1],
      ["EMAIL", 2], // letter case does not make an email a different value
    ]);
    expect(rows[3].value).toBe("rahul@example.com");
  });
  it("ticks follow the category until a row is overridden", () => {
    const rows = buildRows(FOUND, defaultsFor("resumes"), {});
    expect(rows.map((r) => r.masked)).toEqual([true, false, false, true]);
  });
});

describe("restore still works for what was masked", () => {
  it("round-trips with some values left plain", () => {
    const text = "Mail asha@example.com, call 98765 43210, PAN ABCDE1234F, Asha Rao.";
    const found = [...detect(text), det("PERSON", text, "Asha Rao")];
    const rows = buildRows(found, defaultsFor("business"), {});
    const phone = rows.find((r) => r.type === "PHONE")!;
    const r = scrub(text, filterDetections(found, defaultsFor("business"), { [phone.key]: false }));
    expect(r.text).toContain("98765 43210");
    expect(r.text).not.toContain("asha@example.com");
    expect(restore(r.text, r.mapping).text).toBe(text);
  });
});
