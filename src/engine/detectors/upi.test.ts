import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { upi } from "./upi";

const found = (text: string) => detect(text, [upi]);
const values = (text: string) => found(text).map((d) => d.value);

describe("UPI — should detect", () => {
  it("a name handle", () => {
    const d = found("rahul@okaxis");
    expect(d.map((x) => x.value)).toEqual(["rahul@okaxis"]);
    expect(d[0].confidence).toBe(0.75);
  });

  it("a phone-number handle, with a 'UPI' keyword boost", () => {
    const d = found("UPI: 9876543210@ybl");
    expect(d.map((x) => x.value)).toEqual(["9876543210@ybl"]);
    expect(d[0].confidence).toBe(0.9);
  });

  it("ALL CAPS with a dot in the handle", () => {
    expect(values("PRIYA.S@OKICICI")).toEqual(["PRIYA.S@OKICICI"]);
  });

  it("followed by a full stop", () => {
    expect(values("pay ravi-kumar@paytm.")).toEqual(["ravi-kumar@paytm"]);
  });

  it("with an underscore in the handle", () => {
    expect(values("send to shop_99@upi")).toEqual(["shop_99@upi"]);
  });
});

describe("UPI — should NOT detect", () => {
  it("an email address", () => {
    expect(values("rahul@gmail.com")).toEqual([]);
  });

  it("a social @mention", () => {
    expect(values("thanks @rahul")).toEqual([]);
  });

  it("spaces around @", () => {
    expect(values("rahul @ okaxis")).toEqual([]);
  });

  it("a time after @", () => {
    expect(values("meet@5pm")).toEqual([]);
  });

  it("one-character handle or provider", () => {
    expect(values("a@bank")).toEqual([]);
    expect(values("rahul@b")).toEqual([]);
  });

  it("digits in the provider", () => {
    expect(values("rahul@ok1axis")).toEqual([]);
  });
});
