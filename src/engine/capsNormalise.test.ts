import { describe, expect, it } from "vitest";
import { normaliseCapsRuns } from "./capsNormalise";

describe("normaliseCapsRuns", () => {
  it("title-cases a run of 2 or more ALL CAPS words", () => {
    expect(normaliseCapsRuns("RAHUL VERMA")).toBe("Rahul Verma");
    expect(normaliseCapsRuns("SIGNED BY KULDEEP SINGH BAINS")).toBe("Signed By Kuldeep Singh Bains");
  });

  it("never changes a single caps word", () => {
    expect(normaliseCapsRuns("RAHUL")).toBe("RAHUL");
    expect(normaliseCapsRuns("Name: RAHUL")).toBe("Name: RAHUL");
  });

  it("leaves a single caps word after a label alone, because punctuation ends the run", () => {
    expect(normaliseCapsRuns("NAME: RAHUL")).toBe("NAME: RAHUL");
  });

  it("ends a run at punctuation but still converts the words before it", () => {
    expect(normaliseCapsRuns("DEAR NEHA KULKARNI, YOUR REQUEST IS APPROVED.")).toBe(
      "Dear Neha Kulkarni, Your Request Is Approved.",
    );
    expect(normaliseCapsRuns("CANDIDATE NAME: RAHUL VERMA")).toBe("Candidate Name: Rahul Verma");
  });

  it("needs a single space between words", () => {
    expect(normaliseCapsRuns("RAHUL  VERMA")).toBe("RAHUL  VERMA");
    expect(normaliseCapsRuns("RAHUL\nVERMA")).toBe("RAHUL\nVERMA");
  });

  it("ignores words with fewer than 2 letters", () => {
    expect(normaliseCapsRuns("A RAHUL")).toBe("A RAHUL");
    expect(normaliseCapsRuns("PAYMENT A DETAILS")).toBe("PAYMENT A DETAILS");
  });

  it("skips a run made only of known acronyms", () => {
    expect(normaliseCapsRuns("PAN GST")).toBe("PAN GST");
    expect(normaliseCapsRuns("UPI OTP KYC")).toBe("UPI OTP KYC");
    expect(normaliseCapsRuns("PAN CARD")).toBe("Pan Card");
  });

  it("keeps apostrophes and hyphens inside words", () => {
    expect(normaliseCapsRuns("MARY O'BRIEN")).toBe("Mary O'Brien");
    expect(normaliseCapsRuns("ANNE-MARIE SINGH")).toBe("Anne-Marie Singh");
    expect(normaliseCapsRuns("RAHUL SINGH'S")).toBe("Rahul Singh's");
  });

  it("leaves digits and punctuation untouched", () => {
    const text = "INVOICE NO. 12345 - TOTAL AMOUNT: Rs. 4,500/- (PAID IN FULL)";
    expect(normaliseCapsRuns(text)).toBe("Invoice No. 12345 - Total Amount: Rs. 4,500/- (Paid In Full)");
    expect(normaliseCapsRuns("ABC123 DEF456")).toBe("ABC123 DEF456");
  });

  it("leaves mixed-case text untouched", () => {
    for (const t of ["Hello World", "hello world", "Priya NAIR", "iPhone PRO max", ""]) {
      expect(normaliseCapsRuns(t)).toBe(t);
    }
  });

  it("handles non-ASCII Unicode letters", () => {
    expect(normaliseCapsRuns("JOSÉ MÜLLER")).toBe("José Müller");
  });

  it("leaves a run unchanged if title-casing would change its length", () => {
    // "İ".toLowerCase() is 2 UTF-16 units, so the run cannot keep its positions.
    expect(normaliseCapsRuns("İSTANBUL TURKEY")).toBe("İSTANBUL TURKEY");
    // Only that run is left alone; others in the text still change.
    expect(normaliseCapsRuns("İSTANBUL TURKEY, RAHUL VERMA")).toBe("İSTANBUL TURKEY, Rahul Verma");
  });

  it("always preserves length", () => {
    const samples = [
      "PLEASE SEND THE FILE TO SRINIVASAN RAGHAVAN TODAY.",
      "ÀÉÎ ÕÜ STRASSE ß GROSS",
      "İİ İİ ŞŞ",
      "ΣΑΣ ΣΟΦΟΣ",
      "A B C D",
      "RAHUL  VERMA   ABDUL RAHMAN",
      "😀 RAHUL VERMA 😀",
      "MARY O'BRIEN-SMITH AND SONS",
    ];
    for (const t of samples) expect(normaliseCapsRuns(t).length).toBe(t.length);
  });

  it("round trip: a span found on the copy slices the same place in the original", () => {
    const original = "PLEASE SEND THE FILE TO SRINIVASAN RAGHAVAN TODAY.";
    const copy = normaliseCapsRuns(original);
    const start = copy.indexOf("Srinivasan Raghavan");
    const end = start + "Srinivasan Raghavan".length;
    expect(start).toBeGreaterThan(-1);
    expect(original.slice(start, end)).toBe("SRINIVASAN RAGHAVAN");
  });

  it("does not modify its input string", () => {
    const original = "RAHUL VERMA";
    normaliseCapsRuns(original);
    expect(original).toBe("RAHUL VERMA");
  });
});
