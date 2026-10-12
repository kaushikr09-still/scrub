import { describe, expect, it } from "vitest";
import { positionOf } from "./position.ts";

const pos = (text: string, name: string) => {
  const start = text.indexOf(name);
  return positionOf(text, start, start + name.length);
};

describe("where a name sits", () => {
  it("chat speaker after a bracketed time stamp", () => {
    expect(pos("[12/05/24, 10:42 am] Amit: hello", "Amit").position).toBe("chat_speaker");
    expect(pos("12/05/24, 10:42 - sourav: hi", "sourav").position).toBe("chat_speaker");
  });
  it("after Dear / Hi / Hello, with an honorific too", () => {
    expect(pos("Dear Priya Sharma,\nbody", "Priya Sharma").position).toBe("greeting");
    expect(pos("Hi Rahul, thanks", "Rahul").position).toBe("greeting");
    expect(pos("Hello Mr. Rao,", "Rao").position).toBe("greeting");
  });
  it("after a label, and reports the label", () => {
    const r = pos("Customer: Ishita Deshpande\nEmail: x", "Ishita Deshpande");
    expect(r.position).toBe("label");
    expect(r.label).toBe("Customer");
    expect(pos("Father's Name: Ramesh Rao", "Ramesh Rao").label).toBe("Father's Name");
  });
  it("under a sign-off line", () => {
    expect(pos("Thanks,\nAnita Rao\n", "Anita Rao").position).toBe("signoff");
    expect(pos("Best regards,\n\nAnita Rao", "Anita Rao").position).toBe("signoff");
  });
  it("alone on its line", () => {
    expect(pos("Kamala Thakur\nPlot 3", "Kamala Thakur").position).toBe("alone");
  });
  it("inside a sentence", () => {
    expect(pos("I worked with Sandeep from Sales.", "Sandeep").position).toBe("sentence");
  });
});
