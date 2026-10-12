// Builds benchmark documents from templates. Pure TypeScript: no UI imports, no clock, no file access.
// Slot syntax: {TYPE:variant@n}. The same @n in one document is the same person. A slot with no @n is fresh.
import type { CaseStyle, EvalDoc, NegKind, NegSpan, PersonPattern, PresetName, Template, TruthSpan, TruthType } from "../types.ts";
import { Rng } from "./rng.ts";
import { validateValue } from "./validators.ts";
import * as v from "./values.ts";

export interface Lists {
  first_names: string[];
  last_names: string[];
  middle_names: string[];
  ordinary_word_names: string[];
  honorifics: string[];
  orgs: string[];
  schools: string[];
  cities: string[];
  areas: string[];
  streets: string[];
  landmarks: string[];
  personal_email_domains: string[];
  upi_handles: string[];
  banks: { name: string; ifsc_prefix: string }[];
  url_patterns: string[];
  state_codes: string[];
  fillers: Record<string, string[]>;
}

export const DOCS_PER_TEMPLATE = 8;

/** Share of documents (per preset) whose person names are written in a messy case. */
const MESSY: Record<PresetName, { style: CaseStyle; share: number }> = {
  resumes: { style: "upper", share: 0.2 },
  emails: { style: "upper", share: 0.1 },
  chats: { style: "lower", share: 0.25 },
};

interface Person {
  first: string;
  middle: string;
  last: string;
  honorific: string;
  email?: string;
}

const SLOT = /\{([A-Z_]+)(?::([A-Za-z0-9_]+))?(?:@(\d+))?\}/g;
const ascii = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function recase(s: string, style: CaseStyle): string {
  return style === "upper" ? s.toUpperCase() : style === "lower" ? s.toLowerCase() : s;
}

/** Produced by one slot: the text it adds, and which parts of it are truth or negatives. */
interface Rendered {
  text: string;
  truth: RenderedTruth[];
  neg?: { kind: NegKind };
}
interface RenderedTruth {
  off: number;
  len: number;
  type: TruthType;
  pattern: PersonPattern | null;
  caseStyle: CaseStyle;
}

export function generateDoc(template: Template, index: number, lists: Lists, personCase: CaseStyle): EvalDoc {
  const rng = new Rng(`${template.id}#${index}`);
  const people = new Map<number, Person>();
  let bank: { name: string; ifsc_prefix: string } | null = null;
  const docBank = () => (bank ??= rng.pick(lists.banks));
  const caseLabel: CaseStyle = personCase;

  const newPerson = (ordinary: boolean): Person => {
    const first = ordinary ? rng.pick(lists.ordinary_word_names) : rng.pick(lists.first_names);
    let last = rng.pick(lists.last_names);
    while (last === first) last = rng.pick(lists.last_names);
    let middle = rng.pick(lists.middle_names);
    while (middle === first || middle === last) middle = rng.pick(lists.middle_names);
    return { first, middle, last, honorific: rng.pick(lists.honorifics) };
  };
  const personFor = (n: string | undefined, ordinary: boolean): Person => {
    if (n === undefined) return newPerson(ordinary);
    const key = Number(n);
    let p = people.get(key);
    if (!p) people.set(key, (p = newPerson(ordinary)));
    return p;
  };
  const companySlug = () => ascii(rng.pick(lists.orgs).split(" ")[0]);

  const person = (variant: string, n: string | undefined): Rendered => {
    const pattern = variant as PersonPattern;
    const p = personFor(n, pattern === "ordinary_word");
    let prefix = "";
    let name: string;
    let suffix = "";
    switch (pattern) {
      case "full":
        name = `${p.first} ${p.last}`;
        break;
      case "multipart":
        name = `${p.first} ${p.middle} ${p.last}`;
        break;
      case "initials_first":
        name = rng.chance(0.35) ? `${p.first[0]}. ${p.middle[0]}. ${p.last}` : `${p.first[0]}. ${p.last}`;
        break;
      case "initials_last":
        name = `${p.first} ${p.last[0]}`;
        suffix = ".";
        break;
      case "honorific":
        prefix = `${p.honorific} `;
        name = rng.chance(0.5) ? `${p.first} ${p.last}` : p.last;
        break;
      case "single":
        name = p.first;
        break;
      case "ordinary_word":
        name = rng.chance(0.6) ? p.first : `${p.first} ${p.last}`;
        break;
      default:
        throw new Error(`generate: unknown PERSON pattern "${variant}" in ${template.id}`);
    }
    const shown = recase(name, personCase);
    return {
      text: prefix + shown + suffix,
      truth: [{ off: prefix.length, len: shown.length, type: "PERSON", pattern, caseStyle: caseLabel }],
    };
  };

  const plain = (type: TruthType, value: string): Rendered => ({
    text: value,
    truth: [{ off: 0, len: value.length, type, pattern: null, caseStyle: "n/a" }],
  });

  const emailFor = (n: string): string => {
    const p = personFor(n, false);
    if (p.email) return p.email;
    const f = ascii(p.first);
    const l = ascii(p.last);
    const local = rng.pick([
      `${f}.${l}`, `${f}${l}`, `${f}_${l}`, `${f[0]}.${l}`, `${f}.${l[0]}`, `${f}${rng.digits(2)}`, `${l}.${f}`,
    ]);
    const corporate = template.preset === "emails" && rng.chance(0.55);
    const domain = corporate ? `${companySlug()}.${rng.pick(["com", "in", "co.in"])}` : rng.pick(lists.personal_email_domains);
    return (p.email = `${local}@${domain}`);
  };

  const address = (): Rendered => {
    const n = rng.int(1, 240);
    const door = rng.pick([`Flat ${n}`, `No. ${n}`, `#${n}/${rng.int(1, 9)}`, `Plot ${n}`, `H.No ${n}`, String(n)]);
    const street = rng.pick(lists.streets);
    const near = rng.chance(0.25) ? `Near ${rng.pick(lists.landmarks)}, ` : "";
    const area = rng.pick(lists.areas);
    const city = rng.pick(lists.cities);
    const pin = v.pin(rng);
    const head = `${door}, ${street}, ${near}`;
    const text = `${head}${area}, ${city} - ${pin}`;
    const at = (s: string, from: number) => text.indexOf(s, from);
    const areaOff = at(area, head.length);
    const cityOff = at(city, areaOff + area.length);
    return {
      text,
      truth: [
        { off: areaOff, len: area.length, type: "LOC", pattern: null, caseStyle: "n/a" },
        { off: cityOff, len: city.length, type: "LOC", pattern: null, caseStyle: "n/a" },
        { off: text.length - pin.length, len: pin.length, type: "PIN", pattern: null, caseStyle: "n/a" },
      ],
    };
  };

  const url = (): Rendered => {
    const p = newPerson(false);
    const slug = rng.pick([`${ascii(p.first)}-${ascii(p.last)}`, `${ascii(p.first)}${ascii(p.last)}${rng.int(1, 99)}`]);
    const value = rng
      .pick(lists.url_patterns)
      .replace("{slug}", slug)
      .replace("{company_slug}", companySlug())
      .replace("{digits}", rng.digits(6, true));
    return plain("URL", value);
  };

  const upi = (): Rendered => {
    const p = newPerson(false);
    const handle = rng.pick([`${ascii(p.first)}.${ascii(p.last)}`, `${ascii(p.first)}${rng.int(10, 999)}`, `${ascii(p.last)}${ascii(p.first)[0]}`]);
    return plain("UPI", `${handle}@${rng.pick(lists.upi_handles)}`);
  };

  const render = (type: string, variant: string | undefined, n: string | undefined): Rendered => {
    switch (type) {
      case "PERSON":
        return person(variant ?? "full", n);
      case "EMAIL": {
        const m = /^of(\d+)$/.exec(variant ?? "");
        if (!m) throw new Error(`generate: EMAIL needs a variant like of1 in ${template.id}`);
        return plain("EMAIL", emailFor(m[1]));
      }
      case "ORG":
        return plain("ORG", rng.pick(variant === "school" ? lists.schools : lists.orgs));
      case "LOC":
        return plain("LOC", rng.pick(variant === "area" ? lists.areas : lists.cities));
      case "PHONE":
        return plain("PHONE", v.phone(rng));
      case "AADHAAR":
        return plain("AADHAAR", v.aadhaar(rng));
      case "PAN":
        return plain("PAN", v.pan(rng));
      case "GSTIN":
        return plain("GSTIN", v.gstin(rng, lists));
      case "IFSC":
        return plain("IFSC", v.ifsc(rng, docBank().ifsc_prefix));
      case "UPI":
        return upi();
      case "PIN":
        return plain("PIN", v.pin(rng));
      case "CARD":
        return plain("CARD", v.card(rng));
      case "BANK_ACCOUNT":
        return plain("BANK_ACCOUNT", v.bankAccount(rng));
      case "DATE":
        return plain("DATE", v.date(rng, variant ?? "any"));
      case "MONEY":
        return plain("MONEY", v.money(rng));
      case "URL":
        return url();
      case "IP":
        return plain("IP", v.ip(rng));
      case "ADDRESS":
        return address();
      case "FILL": {
        if (variant === "bank_name") return { text: docBank().name, truth: [] };
        const options = lists.fillers[variant ?? ""];
        if (!options) throw new Error(`generate: no filler list "${variant}" in lists.json (${template.id})`);
        return { text: rng.pick(options), truth: [] };
      }
      case "NEG": {
        const kind = variant as NegKind;
        return { text: v.neg(rng, kind), truth: [], neg: { kind } };
      }
      default:
        throw new Error(`generate: unknown slot ${type} in ${template.id}`);
    }
  };

  let text = "";
  let cursor = 0;
  const truth: TruthSpan[] = [];
  const negatives: NegSpan[] = [];
  for (const m of template.text.matchAll(SLOT)) {
    text += template.text.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    const r = render(m[1], m[2], m[3]);
    const base = text.length;
    for (const t of r.truth) {
      truth.push({
        type: t.type,
        start: base + t.off,
        end: base + t.off + t.len,
        value: r.text.slice(t.off, t.off + t.len),
        pattern: t.pattern,
        caseStyle: t.caseStyle,
      });
    }
    if (r.neg) negatives.push({ start: base, end: base + r.text.length, value: r.text, kind: r.neg.kind });
    text += r.text;
  }
  text += template.text.slice(cursor);

  return {
    id: `${template.id}-${index + 1}`,
    split: template.split,
    preset: template.preset,
    template: template.id,
    text,
    truth,
    negatives,
  };
}

/** 8 documents per template. Which documents get messy person-name case is decided by a seeded quota per preset. */
export function generateSplit(split: string, templates: readonly Template[], lists: Lists, perTemplate = DOCS_PER_TEMPLATE): EvalDoc[] {
  const slots = templates.flatMap((t) => Array.from({ length: perTemplate }, (_, i) => ({ t, i })));
  const styleFor = new Map<(typeof slots)[number], CaseStyle>();
  for (const preset of Object.keys(MESSY) as PresetName[]) {
    const mine = slots.filter((s) => s.t.preset === preset);
    const quota = Math.round(mine.length * MESSY[preset].share);
    const chosen = new Rng(`${split}#${preset}#case`).shuffle(mine).slice(0, quota);
    for (const s of chosen) styleFor.set(s, MESSY[preset].style);
  }
  return slots.map((s) => generateDoc(s.t, s.i, lists, styleFor.get(s) ?? "title"));
}

export function toJsonl(docs: readonly EvalDoc[]): string {
  return docs.map((d) => JSON.stringify(d)).join("\n") + "\n";
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** Throws on the first problem it finds. Messages name the document and never include more than one value. */
export function selfCheck(docs: readonly EvalDoc[], lists: Lists): void {
  const ids = new Set<string>();
  const truthValues = new Set<string>();
  for (const d of docs) for (const t of d.truth) truthValues.add(t.value);
  for (const d of docs) {
    if (ids.has(d.id)) throw new Error(`selfCheck: duplicate document id ${d.id}`);
    ids.add(d.id);
    for (const t of d.truth) {
      if (d.text.slice(t.start, t.end) !== t.value) throw new Error(`selfCheck: ${d.id}: text.slice does not equal the ${t.type} value`);
      const bad = validateValue(t.type, t.value);
      if (bad) throw new Error(`selfCheck: ${d.id}: ${t.type} "${t.value}" is invalid: ${bad}`);
      if (t.type === "PERSON" && lists.honorifics.some((h) => t.value.startsWith(`${h} `))) {
        throw new Error(`selfCheck: ${d.id}: PERSON truth "${t.value}" includes an honorific`);
      }
      if (t.type === "UPI" && !lists.upi_handles.includes(t.value.split("@")[1])) {
        throw new Error(`selfCheck: ${d.id}: UPI handle is not in lists.json`);
      }
      if (t.type === "IFSC" && !lists.banks.some((b) => t.value.startsWith(b.ifsc_prefix))) {
        throw new Error(`selfCheck: ${d.id}: IFSC prefix is not in lists.json`);
      }
    }
    const sorted = [...d.truth].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (overlaps(sorted[i - 1], sorted[i])) throw new Error(`selfCheck: ${d.id}: truth spans overlap (${sorted[i - 1].type}, ${sorted[i].type})`);
    }
    for (const n of d.negatives) {
      if (d.text.slice(n.start, n.end) !== n.value) throw new Error(`selfCheck: ${d.id}: text.slice does not equal the NEG ${n.kind} value`);
      if (/\d{10,}/.test(n.value)) throw new Error(`selfCheck: ${d.id}: NEG ${n.kind} has 10 or more digits in a row`);
      if (truthValues.has(n.value)) throw new Error(`selfCheck: ${d.id}: NEG ${n.kind} value is also a truth value`);
      if (d.truth.some((t) => overlaps(t, n))) throw new Error(`selfCheck: ${d.id}: NEG ${n.kind} overlaps a truth span`);
    }
  }
}

/** Generates twice (they must match byte for byte), then runs every self-check. Returns the jsonl text. */
export function generateChecked(split: string, templates: readonly Template[], lists: Lists): { docs: EvalDoc[]; jsonl: string } {
  const docs = generateSplit(split, templates, lists);
  const jsonl = toJsonl(docs);
  if (toJsonl(generateSplit(split, templates, lists)) !== jsonl) throw new Error(`selfCheck: ${split}: the same seed gave different output`);
  selfCheck(docs, lists);
  return { docs, jsonl };
}
