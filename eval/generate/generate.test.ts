import { describe, expect, it } from "vitest";
import dev from "../templates/dev.json";
import test_ from "../templates/test.json";
import lists from "../data/lists.json";
import type { EvalDoc, Template } from "../types.ts";
import { generateDoc, generateSplit, selfCheck, toJsonl, type Lists } from "./generate.ts";
import { validateValue } from "./validators.ts";
import { Rng } from "./rng.ts";
import * as values from "./values.ts";

const L = lists as unknown as Lists;
const devT = dev as Template[];
const testT = test_ as Template[];
const tpl = (text: string, preset: Template["preset"] = "emails"): Template => ({ split: "dev", preset, id: "x_1", text });

describe("rng", () => {
  it("same seed gives the same numbers, different seed does not", () => {
    const a = new Rng("res_d1#0");
    const b = new Rng("res_d1#0");
    const c = new Rng("res_d1#1");
    const xs = [a.int(0, 1e6), a.int(0, 1e6), a.int(0, 1e6)];
    expect([b.int(0, 1e6), b.int(0, 1e6), b.int(0, 1e6)]).toEqual(xs);
    expect([c.int(0, 1e6), c.int(0, 1e6), c.int(0, 1e6)]).not.toEqual(xs);
  });
});

describe("value makers always pass the project validators", () => {
  const rng = new Rng("values");
  const cases: [string, () => string][] = [
    ["AADHAAR", () => values.aadhaar(rng)],
    ["PAN", () => values.pan(rng)],
    ["GSTIN", () => values.gstin(rng, L)],
    ["IFSC", () => values.ifsc(rng, L.banks[0].ifsc_prefix)],
    ["CARD", () => values.card(rng)],
    ["BANK_ACCOUNT", () => values.bankAccount(rng)],
    ["PHONE", () => values.phone(rng)],
    ["PIN", () => values.pin(rng)],
    ["IP", () => values.ip(rng)],
    ["DATE", () => values.date(rng, "any")],
    ["DATE", () => values.date(rng, "dob")],
    ["DATE", () => values.date(rng, "long")],
    ["MONEY", () => values.money(rng)],
  ];
  for (const [type, make] of cases) {
    it(`${type} (500 samples)`, () => {
      for (let i = 0; i < 500; i++) {
        const v = make();
        expect(validateValue(type as never, v), `${type} ${v}`).toBeNull();
      }
    });
  }
  it("validator rejects bad values", () => {
    expect(validateValue("AADHAAR", "1234 5678 9012")).not.toBeNull(); // first digit 1
    expect(validateValue("PAN", "ABCD1234E")).not.toBeNull();
    expect(validateValue("GSTIN", "29ABCDE1234F1Z0")).not.toBeNull();
    expect(validateValue("CARD", "4111 1111 1111 1112")).not.toBeNull();
    expect(validateValue("CARD", "4111111111111111")).toBeNull(); // well-known Luhn-valid test number
    expect(validateValue("BANK_ACCOUNT", "4111111111111111")).not.toBeNull(); // passes Luhn
    expect(validateValue("PHONE", "5876543210")).not.toBeNull();
    expect(validateValue("IFSC", "SBIN1234567")).not.toBeNull();
  });
  it("bank accounts never pass Luhn and are 9 to 18 digits", () => {
    for (let i = 0; i < 2000; i++) {
      const v = values.bankAccount(rng);
      expect(v).toMatch(/^[1-9]\d{8,17}$/);
    }
  });
  it("phone numbers use several formats", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const v = values.phone(rng);
      seen.add(v.startsWith("+91") ? "+91" : v.startsWith("0") ? "0" : v.startsWith("91") ? "91" : "plain");
      seen.add(/ /.test(v) ? "space" : /-/.test(v) ? "dash" : "nosep");
    }
    expect([...seen].sort()).toEqual(["+91", "0", "91", "dash", "nosep", "plain", "space"].sort());
  });
  it("NEG values never hold a run of 10 digits", () => {
    for (const kind of ["order", "ticket", "invoice", "ref", "version"] as const) {
      for (let i = 0; i < 300; i++) expect(values.neg(rng, kind)).not.toMatch(/\d{10}/);
    }
  });
});

describe("generating documents", () => {
  it("makes 8 documents per template, with unique ids", () => {
    const docs = generateSplit("dev", devT, L);
    expect(docs).toHaveLength(devT.length * 8);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    for (const t of devT) expect(docs.filter((d) => d.template === t.id)).toHaveLength(8);
  });

  it("is repeatable: the same input gives byte-identical output", () => {
    expect(toJsonl(generateSplit("dev", devT, L))).toBe(toJsonl(generateSplit("dev", devT, L)));
    expect(toJsonl(generateSplit("test", testT, L))).toBe(toJsonl(generateSplit("test", testT, L)));
  });

  it("different indexes of one template differ", () => {
    const docs = generateSplit("dev", devT, L).filter((d) => d.template === "res_d1");
    expect(new Set(docs.map((d) => d.text)).size).toBe(8);
  });

  it("passes every self-check for both splits", () => {
    selfCheck(generateSplit("dev", devT, L), L);
    selfCheck(generateSplit("test", testT, L), L);
  });

  it("assigns messy-case documents by quota", () => {
    const docs = generateSplit("dev", devT, L);
    const styleOf = (d: EvalDoc) => d.truth.find((t) => t.type === "PERSON" && t.value.length > 1)?.caseStyle;
    const count = (preset: string, style: string) => docs.filter((d) => d.preset === preset && styleOf(d) === style).length;
    expect(count("resumes", "upper")).toBe(5);
    expect(count("emails", "upper")).toBe(2);
    expect(count("chats", "lower")).toBe(6);
    expect(count("resumes", "lower") + count("emails", "lower") + count("chats", "upper")).toBe(0);
  });

  it("jsonl lines parse back to the same documents", () => {
    const docs = generateSplit("dev", devT, L);
    const lines = toJsonl(docs).trimEnd().split("\n");
    expect(lines).toHaveLength(docs.length);
    expect(JSON.parse(lines[3])).toEqual(docs[3]);
    expect(Object.keys(JSON.parse(lines[0]))).toEqual(["id", "split", "preset", "template", "text", "truth", "negatives"]);
  });
});

describe("slots", () => {
  it("same @n is the same person, EMAIL:ofN is built from that person", () => {
    const d = generateDoc(tpl("A {PERSON:full@1} B {PERSON:single@1} C {EMAIL:of1} D {EMAIL:of1}"), 0, L, "title");
    const [full, single, e1, e2] = d.truth;
    expect(full.value.split(" ")[0]).toBe(single.value);
    expect(e1.value).toBe(e2.value);
    expect(e1.type).toBe("EMAIL");
  });

  it("an email local part comes from the person's name", () => {
    for (let i = 0; i < 40; i++) {
      const d = generateDoc(tpl("{PERSON:full@1} {EMAIL:of1}"), i, L, "title");
      const [p, e] = d.truth;
      const [first, ...rest] = p.value.split(" ");
      const last = rest.join("").toLowerCase().replace(/[^a-z]/g, "");
      const local = e.value.split("@")[0].toLowerCase();
      expect(local.includes(first.toLowerCase().replace(/[^a-z]/g, "")) || local.includes(last) || local.startsWith(first[0].toLowerCase())).toBe(true);
    }
  });

  it("slots without @n are fresh", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const d = generateDoc(tpl("{PERSON:full} {PERSON:full}"), i, L, "title");
      seen.add(d.truth[0].value === d.truth[1].value ? "same" : "diff");
    }
    expect(seen.has("diff")).toBe(true);
  });

  it("honorifics stay out of PERSON truth", () => {
    for (let i = 0; i < 30; i++) {
      const d = generateDoc(tpl("Dear {PERSON:honorific},"), i, L, "title");
      expect(d.truth).toHaveLength(1);
      expect(d.truth[0].pattern).toBe("honorific");
      expect(d.text.slice(0, d.truth[0].start)).toMatch(/Dear (Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Shri|Smt\.|Er\.) $/);
      expect(L.honorifics.some((h) => d.truth[0].value.startsWith(h))).toBe(false);
    }
  });

  it("makes every person pattern", () => {
    const patterns = ["full", "initials_first", "initials_last", "honorific", "single", "ordinary_word", "multipart"];
    for (const p of patterns) {
      const d = generateDoc(tpl(`x {PERSON:${p}} y`), 3, L, "title");
      expect(d.truth[0].pattern).toBe(p);
    }
    for (let i = 0; i < 20; i++) {
      const o = generateDoc(tpl("{PERSON:ordinary_word}"), i, L, "title").truth[0].value;
      expect(L.ordinary_word_names.includes(o.split(" ")[0])).toBe(true);
      const m = generateDoc(tpl("{PERSON:multipart}"), i, L, "title").truth[0].value;
      expect(m.split(" ").length).toBeGreaterThanOrEqual(3);
      const il = generateDoc(tpl("{PERSON:initials_last}"), i, L, "title").truth[0].value;
      expect(il).toMatch(/^\S+ [A-Z]$/);
      const jf = generateDoc(tpl("{PERSON:initials_first}"), i, L, "title").truth[0].value;
      expect(jf).toMatch(/^([A-Z]\. ?)+\S+$/);
    }
  });

  it("ordinary-word names appear only in the ordinary_word pattern", () => {
    for (const d of generateSplit("dev", devT, L)) {
      for (const t of d.truth) {
        if (t.type === "PERSON" && t.pattern !== "ordinary_word") {
          for (const w of L.ordinary_word_names) expect(t.value.split(" ")).not.toContain(w);
        }
      }
    }
  });

  it("ALL CAPS and lowercase keep length and are recorded per span", () => {
    for (const style of ["upper", "lower"] as const) {
      const t = tpl("{PERSON:full@1} / {PERSON:honorific} / {EMAIL:of1}");
      const d = generateDoc(t, 2, L, style);
      const base = generateDoc(t, 2, L, "title");
      expect(d.text.length).toBe(base.text.length);
      const [p1, hon, email] = d.truth;
      expect(p1.caseStyle).toBe(style);
      expect(p1.value).toBe(style === "upper" ? p1.value.toUpperCase() : p1.value.toLowerCase());
      expect(hon.caseStyle).toBe(style);
      expect(email.caseStyle).toBe("n/a");
      expect(email.value).toBe(base.truth[2].value);
      expect(d.truth.map((x) => [x.start, x.end])).toEqual(base.truth.map((x) => [x.start, x.end]));
    }
  });

  it("title-case persons are recorded as title", () => {
    const d = generateDoc(tpl("{PERSON:full}"), 0, L, "title");
    expect(d.truth[0].caseStyle).toBe("title");
  });

  it("ADDRESS scores only area, city and PIN", () => {
    for (let i = 0; i < 20; i++) {
      const d = generateDoc(tpl("Addr: {ADDRESS}\nend", "resumes"), i, L, "title");
      expect(d.truth.map((t) => t.type)).toEqual(["LOC", "LOC", "PIN"]);
      expect(L.areas).toContain(d.truth[0].value);
      expect(L.cities).toContain(d.truth[1].value);
      expect(d.truth[2].value).toMatch(/^[1-9]\d{5}$/);
      const street = L.streets.find((s) => d.text.includes(s));
      expect(street).toBeDefined();
      expect(d.truth.every((t) => !t.value.includes(street!))).toBe(true);
    }
  });

  it("NEG slots are negatives only, never truth", () => {
    const d = generateDoc(tpl("Inv {NEG:invoice} order {NEG:order} t {NEG:ticket} r {NEG:ref} v {NEG:version}"), 4, L, "title");
    expect(d.truth).toHaveLength(0);
    expect(d.negatives.map((n) => n.kind)).toEqual(["invoice", "order", "ticket", "ref", "version"]);
    for (const n of d.negatives) expect(d.text.slice(n.start, n.end)).toBe(n.value);
  });

  it("FILL slots draw from lists.json, including bank names", () => {
    const d = generateDoc(tpl("{FILL:designation}|{FILL:bank_name}|{FILL:skill}"), 1, L, "title");
    const [a, b, c] = d.text.split("|");
    expect(L.fillers.designation).toContain(a);
    expect(L.banks.map((x) => x.name)).toContain(b);
    expect(L.fillers.skill).toContain(c);
    expect(d.truth).toHaveLength(0);
  });

  it("IFSC prefix matches the bank named in the same document", () => {
    const d = generateDoc(tpl("{FILL:bank_name} {IFSC}"), 5, L, "title");
    const bank = L.banks.find((b) => d.text.startsWith(b.name))!;
    expect(d.truth[0].value.startsWith(bank.ifsc_prefix)).toBe(true);
  });

  it("an unknown slot is an error", () => {
    expect(() => generateDoc(tpl("{WIDGET}"), 0, L, "title")).toThrow(/WIDGET/);
  });
});

describe("self-checks fail loudly", () => {
  const good = () => generateSplit("dev", devT, L).slice(0, 4);
  it("wrong offsets", () => {
    const docs = good();
    docs[0].truth[0].end += 1;
    expect(() => selfCheck(docs, L)).toThrow(/slice/);
  });
  it("overlapping truth", () => {
    const docs = good();
    docs[0].truth.push({ ...docs[0].truth[0] });
    expect(() => selfCheck(docs, L)).toThrow(/overlap/);
  });
  it("invalid ID", () => {
    const d = generateSplit("dev", devT, L).find((x) => x.truth.some((t) => t.type === "AADHAAR"))!;
    const t = d.truth.find((x) => x.type === "AADHAAR")!;
    const bad = t.value.replace(/\d$/, (c) => String((Number(c) + 1) % 10));
    d.text = d.text.slice(0, t.start) + bad + d.text.slice(t.end);
    t.value = bad;
    expect(() => selfCheck([d], L)).toThrow(/AADHAAR/);
  });
  it("NEG value equal to a truth value", () => {
    const d = generateDoc(tpl("{PHONE} {NEG:order}"), 0, L, "title");
    const n = d.negatives[0];
    d.text = d.text + " " + d.truth[0].value;
    d.negatives.push({ ...n, start: d.text.length - d.truth[0].value.length, end: d.text.length, value: d.truth[0].value });
    expect(() => selfCheck([d], L)).toThrow(/also a truth value/);
  });
  it("NEG with 10 digits in a row", () => {
    const d = generateDoc(tpl("{NEG:order}"), 0, L, "title");
    d.text = "1234567890";
    d.negatives[0] = { ...d.negatives[0], start: 0, end: 10, value: "1234567890" };
    expect(() => selfCheck([d], L)).toThrow(/10/);
  });
  it("a NEG overlapping a truth span", () => {
    const d = generateDoc(tpl("{PHONE} {NEG:order}"), 0, L, "title");
    d.negatives[0] = { ...d.negatives[0], start: d.truth[0].start, end: d.truth[0].end, value: d.truth[0].value };
    expect(() => selfCheck([d], L)).toThrow();
  });
});

describe("money and date forms are ones the detectors document", () => {
  it("the money detector covers every generated amount whole", async () => {
    const { money } = await import("../../src/engine/detectors/money");
    const rng = new Rng("money-forms");
    for (let i = 0; i < 1000; i++) {
      const m = values.money(rng);
      const hit = money.find(`Paid ${m} today`).some((c) => c.value === m);
      expect(hit, m).toBe(true);
    }
  });
  it("the date detector covers every generated date whole", async () => {
    const { date } = await import("../../src/engine/detectors/date");
    const rng = new Rng("date-forms");
    for (const kind of ["any", "dob", "long"]) {
      for (let i = 0; i < 500; i++) {
        const d = values.date(rng, kind);
        expect(date.find(`On ${d} we met`).some((c) => c.value === d), d).toBe(true);
      }
    }
  });
});
