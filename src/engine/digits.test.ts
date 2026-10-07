import { describe, expect, it } from "vitest";
import { digitSpans } from "./digits";

const all = (text: string, min: number, max: number) =>
  digitSpans(text, min, max).map((s) => ({ digits: s.digits, value: text.slice(s.start, s.end) }));

describe("digitSpans", () => {
  it("finds a plain run of digits", () => {
    expect(all("call 9876543210 now", 10, 10)).toEqual([
      { digits: "9876543210", value: "9876543210" },
    ]);
  });

  it("joins groups split by single spaces or dashes", () => {
    expect(all("x 98765 43210 y", 10, 10)).toEqual([
      { digits: "9876543210", value: "98765 43210" },
    ]);
    expect(all("x 2341-2341-2346 y", 12, 12)).toEqual([
      { digits: "234123412346", value: "2341-2341-2346" },
    ]);
  });

  it("handles fully spaced-out digits", () => {
    expect(all("9 8 7 6 5 4 3 2 1 0", 10, 10)).toEqual([
      { digits: "9876543210", value: "9 8 7 6 5 4 3 2 1 0" },
    ]);
  });

  it("offers sub-spans cut at spaces", () => {
    expect(all("qty 2 9876543210", 10, 10)).toEqual([
      { digits: "9876543210", value: "9876543210" },
    ]);
  });

  it("does not cut at dashes (keeps order IDs like 2024-9876543210 whole)", () => {
    expect(all("2024-9876543210", 10, 10)).toEqual([]);
  });

  it("rejects digits glued to letters, underscores or @", () => {
    expect(all("ORD9876543210", 10, 10)).toEqual([]);
    expect(all("9876543210abc", 10, 10)).toEqual([]);
    expect(all("9876543210@ybl", 10, 10)).toEqual([]);
  });

  it("rejects digits that are part of a dotted or slashed number", () => {
    expect(all("v9876543210.2", 10, 10)).toEqual([]);
    expect(all("1.9876543210", 10, 10)).toEqual([]);
    expect(all("12/9876543210", 10, 10)).toEqual([]);
  });

  it("allows a sentence-ending full stop", () => {
    expect(all("Call 9876543210.", 10, 10)).toHaveLength(1);
  });

  it("does not join across two spaces or a newline", () => {
    expect(all("98765  43210", 10, 10)).toEqual([]);
    expect(all("98765\n43210", 10, 10)).toEqual([]);
  });
});
