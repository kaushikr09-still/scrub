import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { date } from "./date";

const found = (text: string) => detect(text, [date]);
const values = (text: string) => found(text).map((d) => d.value);

describe("DATE — should detect", () => {
  it("slash, dash and dot styles", () => {
    expect(values("on 12/05/2024")).toEqual(["12/05/2024"]);
    expect(values("on 12-05-2024")).toEqual(["12-05-2024"]);
    expect(values("on 12.05.2024.")).toEqual(["12.05.2024"]);
  });

  it("single-digit parts and a 2-digit year", () => {
    expect(values("joined 1/5/24")).toEqual(["1/5/24"]);
    expect(values("joined 01-05-24")).toEqual(["01-05-24"]);
  });

  it("month-first numbers are accepted too (order is not decided)", () => {
    expect(values("05/31/2024")).toEqual(["05/31/2024"]);
  });

  it("ISO style", () => {
    expect(values("2024-05-12")).toEqual(["2024-05-12"]);
  });

  it("day month year in words", () => {
    expect(values("12 May 2024")).toEqual(["12 May 2024"]);
    expect(values("12th May 2024")).toEqual(["12th May 2024"]);
    expect(values("1st of January, 2024")).toEqual(["1st of January, 2024"]);
    expect(values("12-May-2024")).toEqual(["12-May-2024"]);
    expect(values("12 Sept. 2024")).toEqual(["12 Sept. 2024"]);
  });

  it("month day, year in words", () => {
    expect(values("May 12, 2024")).toEqual(["May 12, 2024"]);
    expect(values("may 12th 2024")).toEqual(["may 12th 2024"]);
  });

  it("an apostrophe year", () => {
    expect(values("12 Mar '24")).toEqual(["12 Mar '24"]);
    expect(values("12 Mar ’24")).toEqual(["12 Mar ’24"]);
  });

  it("a DOB label raises confidence", () => {
    expect(found("12/05/1990")[0].confidence).toBe(0.6);
    expect(found("DOB: 12/05/1990")[0].confidence).toBe(0.75);
    expect(found("Date of Birth: 12 May 1990")[0].confidence).toBe(0.75);
  });

  it("month+year or a bare year directly after a birth label", () => {
    expect(values("DOB: May 1990")).toEqual(["May 1990"]);
    expect(values("Date of Birth - 1990")).toEqual(["1990"]);
    expect(values("Born 1990, Pune")).toEqual(["1990"]);
    expect(values("born in Sept 1990")).toEqual(["Sept 1990"]);
    expect(found("D.O.B. 1990")[0].confidence).toBe(0.75);
  });
});

describe("DATE — should NOT detect", () => {
  it("month+year without a birth label", () => {
    expect(values("Analyst, Jan 2020 – May 2023")).toEqual([]);
  });

  it("a bare year without a birth label", () => {
    expect(values("In 1990 we moved")).toEqual([]);
  });

  it("a birth label that is not directly before the year", () => {
    expect(values("DOB is on file. In 1990 we moved")).toEqual([]);
  });

  it("day and month without a year", () => {
    expect(values("on 12 May")).toEqual([]);
    expect(values("on 12/05")).toEqual([]);
  });

  it("impossible day/month numbers", () => {
    expect(values("32/05/2024")).toEqual([]);
    expect(values("13/13/2024")).toEqual([]);
    expect(values("00/05/2024")).toEqual([]);
  });

  it("mixed separators", () => {
    expect(values("12/05-2024")).toEqual([]);
  });

  it("version numbers and dotted 2-digit years", () => {
    expect(values("version 10.2.33")).toEqual([]);
    expect(values("v12.05.2024")).toEqual([]);
  });

  it("part of a longer number or ID", () => {
    expect(values("INV12-05-2024")).toEqual([]);
    expect(values("12-05-2024-77")).toEqual([]);
    expect(values("10.12.05.2024")).toEqual([]);
  });

  it("a year outside 1900-2099", () => {
    expect(values("12/05/2124")).toEqual([]);
  });

  it("'may' the verb", () => {
    expect(values("we may 12 people in 2024")).toEqual([]);
  });
});
