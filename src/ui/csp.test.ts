/// <reference types="vite/client" />
// Pins the page's Content-Security-Policy (vercel.json) so it cannot quietly get looser.
import { describe, expect, it } from "vitest";
import vercelRaw from "../../vercel.json?raw";

const vercel = JSON.parse(vercelRaw) as { headers: { headers: { key: string; value: string }[] }[] };
const csp = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
const directives = new Map(
  csp.split(";").map((d) => {
    const [name, ...values] = d.trim().split(/\s+/);
    return [name, values] as const;
  }),
);

describe("Content-Security-Policy in vercel.json", () => {
  it("keeps form-action, base-uri and frame-ancestors shut", () => {
    expect(directives.get("form-action")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("allows scripts only from this site, plus WebAssembly (no eval, no inline)", () => {
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("script-src")).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(directives.get("worker-src")).toEqual(["'self'"]);
    expect(csp).not.toMatch(/'unsafe-inline'|'unsafe-eval'|blob:|data:/);
  });

  it("lets the page connect only to itself and the two exact model-download hosts, with no wildcards", () => {
    expect(directives.get("connect-src")).toEqual(["'self'", "https://huggingface.co", "https://us.aws.cdn.hf.co"]);
    expect(csp).not.toContain("*");
  });
});
