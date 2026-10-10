import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { ip } from "./ip";

const found = (text: string) => detect(text, [ip]);
const values = (text: string) => found(text).map((d) => d.value);

describe("IP — should detect", () => {
  it("a private address", () => {
    const d = found("192.168.1.10");
    expect(d.map((x) => x.value)).toEqual(["192.168.1.10"]);
    expect(d[0].confidence).toBe(0.85);
  });

  it("all-zero and all-255 parts", () => {
    expect(values("0.0.0.0 and 255.255.255.255")).toEqual(["0.0.0.0", "255.255.255.255"]);
  });

  it("at the end of a sentence", () => {
    expect(values("from 10.0.0.1.")).toEqual(["10.0.0.1"]);
  });

  it("with a port", () => {
    expect(values("10.0.0.1:8080")).toEqual(["10.0.0.1"]);
  });

  it("a keyword raises confidence", () => {
    expect(found("IP address: 8.8.8.8")[0].confidence).toBe(1);
  });
});

describe("IP — should NOT detect", () => {
  it("a part above 255", () => {
    expect(values("256.1.1.1")).toEqual([]);
    expect(values("1.2.3.256")).toEqual([]);
  });

  it("a version number with a long last part", () => {
    expect(values("1.2.3.4567")).toEqual([]);
  });

  it("only three parts", () => {
    expect(values("10.2.3")).toEqual([]);
  });

  it("five parts", () => {
    expect(values("1.2.3.4.5")).toEqual([]);
  });

  it("a version with a 'v'", () => {
    expect(values("v1.2.3.4")).toEqual([]);
  });

  it("leading zeros", () => {
    expect(values("01.02.03.04")).toEqual([]);
  });
});
