import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { email } from "./email";

const found = (text: string) => detect(text, [email]);
const values = (text: string) => found(text).map((d) => d.value);

describe("EMAIL — should detect", () => {
  it("a plain address", () => {
    expect(values("write to priya.sharma@gmail.com today")).toEqual(["priya.sharma@gmail.com"]);
  });

  it("an ALL CAPS address with a multi-part domain", () => {
    expect(values("RAHUL.K@INFOSYS.CO.IN")).toEqual(["RAHUL.K@INFOSYS.CO.IN"]);
  });

  it("an address followed by a full stop (stop not included)", () => {
    expect(values("Mine is a.b+tag@sub.example.org.")).toEqual(["a.b+tag@sub.example.org"]);
  });

  it("bracketed obfuscation: name [at] gmail dot com", () => {
    const d = found("name [at] gmail dot com");
    expect(d.map((x) => x.value)).toEqual(["name [at] gmail dot com"]);
    expect(d[0].confidence).toBe(0.85);
  });

  it("ALL CAPS bracketed obfuscation with (DOT)", () => {
    expect(values("PRIYA (AT) YAHOO (DOT) CO (DOT) IN")).toEqual([
      "PRIYA (AT) YAHOO (DOT) CO (DOT) IN",
    ]);
  });

  it("curly-bracket at with a real dot", () => {
    expect(values("rahul{at}gmail.com")).toEqual(["rahul{at}gmail.com"]);
  });

  it("a real @ with a spelled-out dot", () => {
    expect(values("name@gmail dot com")).toEqual(["name@gmail dot com"]);
  });

  it("plain-word ' at ' form, at low confidence, raised by a nearby keyword", () => {
    expect(found("ravi at outlook dot com")[0].confidence).toBe(0.6);
    const d = found("email me: ravi at outlook dot com");
    expect(d.map((x) => x.value)).toEqual(["ravi at outlook dot com"]);
    expect(d[0].confidence).toBe(0.75);
  });
});

describe("EMAIL — should NOT detect", () => {
  it("a UPI handle (no dot in the provider)", () => {
    expect(values("rahul@okaxis")).toEqual([]);
  });

  it("a version number", () => {
    expect(values("version 1.2.3 released")).toEqual([]);
  });

  it("a social @mention", () => {
    expect(values("@rahul mentioned it")).toEqual([]);
  });

  it("a time written with 'at' and 'dot'", () => {
    expect(values("meet at 5 dot 30")).toEqual([]);
  });

  it("a host with no top-level domain", () => {
    expect(values("user@localhost")).toEqual([]);
  });

  it("'name at gmail' with no dot part", () => {
    expect(values("rahul at gmail")).toEqual([]);
  });

  it("an order ID", () => {
    expect(values("order ORD-2024-1234")).toEqual([]);
  });

  it("a one-letter top-level domain", () => {
    expect(values("a@b.c")).toEqual([]);
  });
});
