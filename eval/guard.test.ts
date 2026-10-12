import { describe, expect, it } from "vitest";
import { checkFrozenGuard, looksLikeResultsJson } from "./guard.ts";

describe("frozen guard", () => {
  it("never blocks the dev split", () => {
    expect(checkFrozenGuard({ split: "dev", ticked: false, resultsExist: true, force: false })).toEqual({ ok: true });
  });
  it("test split needs the box ticked", () => {
    const r = checkFrozenGuard({ split: "test", ticked: false, resultsExist: false, force: false });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/Tick the box/);
  });
  it("test split runs when ticked and no results file exists", () => {
    expect(checkFrozenGuard({ split: "test", ticked: true, resultsExist: false, force: false }).ok).toBe(true);
  });
  it("test split refuses when results already exist, and says how to override", () => {
    const r = checkFrozenGuard({ split: "test", ticked: true, resultsExist: true, force: false });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/already exists/);
    expect(r.ok === false && r.message).toMatch(/\?force=1/);
  });
  it("force=1 allows a re-run but still needs the box", () => {
    expect(checkFrozenGuard({ split: "test", ticked: true, resultsExist: true, force: true }).ok).toBe(true);
    expect(checkFrozenGuard({ split: "test", ticked: false, resultsExist: true, force: true }).ok).toBe(false);
  });
});

describe("looksLikeResultsJson", () => {
  it("accepts a results file and rejects the dev server's HTML fallback", () => {
    expect(looksLikeResultsJson('{"split":"test","summary":{}}')).toBe(true);
    expect(looksLikeResultsJson("<!doctype html><html></html>")).toBe(false);
    expect(looksLikeResultsJson("")).toBe(false);
    expect(looksLikeResultsJson("[1,2]")).toBe(false);
    expect(looksLikeResultsJson('{"other":1}')).toBe(false);
  });
});
