import { describe, expect, it } from "vitest";
import { detect } from "../detect";

// 919876543216 passes the Verhoeff check (self-computed, see aadhaar.test.ts) and also looks like 91 + a mobile number.
const all = (text: string) => detect(text).map((d) => [d.type, d.value]);

describe("a '+' in front means PHONE, not AADHAAR", () => {
  it("+91 with spaces is one PHONE including the +", () => {
    expect(all("Mobile: +91 98765 43216")).toEqual([["PHONE", "+91 98765 43216"]]);
  });
  it("+91 with a dash is one PHONE including the +", () => {
    expect(all("Ph: +91-9876543216")).toEqual([["PHONE", "+91-9876543216"]]);
  });
  it("+91 with no separator is one PHONE including the +", () => {
    expect(all("call +919876543216 now")).toEqual([["PHONE", "+919876543216"]]);
  });
  it("+91 at the start of the text and at the end of a line", () => {
    expect(all("+91 98765 43216")).toEqual([["PHONE", "+91 98765 43216"]]);
    expect(all("Phone +91 98765 43216\nnext")).toEqual([["PHONE", "+91 98765 43216"]]);
  });
});

describe("a bare checksum-valid 12-digit number is still AADHAAR", () => {
  it("unspaced and in groups of 4", () => {
    expect(all("234123412346")).toEqual([["AADHAAR", "234123412346"]]);
    expect(all("no 2341 2341 2346 ok")).toEqual([["AADHAAR", "2341 2341 2346"]]);
  });
  it("a bare 91-prefixed one stays AADHAAR (SPEC precedence: checksum first)", () => {
    expect(all("919876543216")).toEqual([["AADHAAR", "919876543216"]]);
  });
  it("a '+' somewhere else does not matter", () => {
    expect(all("a+ 2341 2341 2346")).toEqual([["AADHAAR", "2341 2341 2346"]]);
  });
});
