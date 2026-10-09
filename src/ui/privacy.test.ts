/// <reference types="vite/client" />
// Guards the privacy rules in CLAUDE.md by reading the source itself:
// no storage, no network, no logging, no URL changes, and honest copy.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["/src/ui/**/*.ts", "/src/engine/**/*.ts", "!**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const pages = import.meta.glob(["/index.html"], { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const FORBIDDEN: [string, RegExp][] = [
  ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/],
  ["indexedDB", /\bindexedDB\b/],
  ["cookies", /\bdocument\.cookie\b/],
  ["caches", /\bcaches\b/],
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["sendBeacon", /\bsendBeacon\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
  ["console", /\bconsole\s*\./],
  ["history", /\bhistory\s*\.\s*(push|replace)State\b/],
  ["location", /\blocation\s*\.\s*(href|hash|search|assign|replace)\b/],
  ["window.open", /\bwindow\.open\b/],
];

/** Removes comments so explanations like "never logged" don't trip the check. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("privacy guard", () => {
  it("finds the files it is meant to scan", () => {
    const files = Object.keys(sources);
    expect(files).toContain("/src/ui/main.ts");
    expect(files).toContain("/src/ui/app.ts");
    expect(files).toContain("/src/engine/scrub.ts");
    expect(files.some((f) => f.endsWith(".test.ts"))).toBe(false);
    expect(Object.keys(pages)).toEqual(["/index.html"]);
  });

  for (const [file, src] of Object.entries(sources)) {
    it(`${file} uses no storage, network, logging or URL APIs`, () => {
      const body = code(src);
      const hits = FORBIDDEN.filter(([, re]) => re.test(body)).map(([name]) => name);
      expect(hits).toEqual([]);
    });
  }

  it("the page has no inline scripts, inline styles or external resources", () => {
    const html = pages["/index.html"];
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/(src|href)="https?:/i);
  });

  it("copy never claims anonymity or compliance", () => {
    for (const text of [...Object.values(pages), ...Object.values(sources).map(code)]) {
      const cleaned = text.replace(/does not guarantee anonymity/gi, "");
      expect(cleaned).not.toMatch(/anonym|complian/i);
    }
  });

  it("the page carries the required honesty notes", () => {
    const html = pages["/index.html"].replace(/\s+/g, " ");
    expect(html).toContain("Reduces what you expose. It does not guarantee anonymity.");
    expect(html).toContain("Names, organisations and places are <strong>NOT</strong> checked yet (rules only).");
  });
});
