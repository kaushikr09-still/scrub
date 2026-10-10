import { describe, expect, it } from "vitest";
import { detect } from "../detect";
import { pin } from "./pin";

const found = (text: string) => detect(text, [pin]);
const values = (text: string) => found(text).map((d) => d.value);

describe("PIN — should detect", () => {
  it("after 'PIN'", () => {
    const d = found("PIN: 560001");
    expect(d.map((x) => x.value)).toEqual(["560001"]);
    expect(d[0].confidence).toBe(0.8);
  });

  it("after 'Pincode' and 'PIN code'", () => {
    expect(values("Pincode 110001")).toEqual(["110001"]);
    expect(values("PIN code - 400 001")).toEqual(["400 001"]);
  });

  it("after 'Postal code'", () => {
    expect(values("Postal code: 700019")).toEqual(["700019"]);
  });

  it("on an address line with a road word", () => {
    expect(values("12, MG Road, Indiranagar, Bengaluru 560038")).toEqual(["560038"]);
  });

  it("on an address line with a state name", () => {
    expect(values("Koramangala, Bengaluru, Karnataka - 560034")).toEqual(["560034"]);
  });

  it("on an address line with 'Nagar'", () => {
    expect(values("Flat 4B, Shanti Nagar, Hyderabad 500028.")).toEqual(["500028"]);
  });
});

describe("PIN — should NOT detect", () => {
  it("a bare 6-digit number", () => {
    expect(values("560001")).toEqual([]);
  });

  it("a 6-digit order ID with no context", () => {
    expect(values("Order 482913 shipped")).toEqual([]);
  });

  it("starting with 0", () => {
    expect(values("PIN 056001")).toEqual([]);
  });

  it("5 or 7 digits", () => {
    expect(values("PIN 56001")).toEqual([]);
    expect(values("PIN 5600011")).toEqual([]);
  });

  it("glued to letters", () => {
    expect(values("PIN ORD560001")).toEqual([]);
  });

  it("an address word on a different line", () => {
    expect(values("MG Road\nTicket 560001")).toEqual([]);
  });

  it("'pin' inside another word", () => {
    expect(values("shipping 560001")).toEqual([]);
  });
});

describe("PIN — documented trade-offs", () => {
  it("a state or UT name on the line makes any 6-digit number a PIN", () => {
    // Known false positive: "Delhi" counts as an address line.
    expect(values("Order 482913 shipped to Delhi")).toEqual(["482913"]);
  });
});
