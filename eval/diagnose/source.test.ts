import { describe, expect, it } from "vitest";
import { assertDevSplit, DIAGNOSE_URL } from "./source.ts";

describe("the diagnosis reads dev only", () => {
  it("reads the dev file", () => {
    expect(DIAGNOSE_URL).toBe("/eval/generated/dev.jsonl");
  });
  it("accepts dev and refuses everything else", () => {
    expect(() => assertDevSplit("dev")).not.toThrow();
    expect(() => assertDevSplit("test")).toThrow();
    expect(() => assertDevSplit("")).toThrow();
  });
});
