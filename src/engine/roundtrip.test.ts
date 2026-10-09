// Restore round-trip suite (SPEC hard gate): restore(scrub(x)) must give x back.
import { describe, expect, it } from "vitest";
import { detect } from "./detect";
import { restore } from "./restore";
import { scrub } from "./scrub";

function roundTrip(text: string) {
  const found = detect(text);
  const scrubbed = scrub(text, found);
  const restored = restore(scrubbed.text, scrubbed.mapping);
  return { found, scrubbed, restored };
}

const SAMPLES: Record<string, string> = {
  resume:
    "PRIYA SHARMA\r\n" +
    "Email: priya.sharma@gmail.com | Mobile: +91 98765 43210\r\n" +
    "PAN: ABCDE1234F\r\n\r\n" +
    "\tExperience\r\n" +
    "  - Analyst, 2019–2023\r\n",
  businessEmail:
    "Hi team,\n\nPlease pay via UPI priya@okaxis or IFSC SBIN0001234.\n" +
    "Card on file: 4242 4242 4242 4242. Reply to accounts@acme.co.in.\n\n" +
    "Thanks,\nRavi (ravi@acme.co.in, 9876543210)\n",
  chatLog:
    "[10:02] customer: my number is 9876543210, mail priya@gmail.com\n" +
    "[10:03] agent: thanks! confirming priya@gmail.com and 9876543210?\n" +
    "[10:04] customer: yes 👍\n",
};

describe("round trip — sample documents", () => {
  it.each(Object.entries(SAMPLES))("%s comes back exactly", (_name, text) => {
    const { found, scrubbed, restored } = roundTrip(text);
    expect(found.length).toBeGreaterThan(0);
    for (const d of found) expect(scrubbed.text).not.toContain(d.value);
    expect(scrubbed.warnings).toEqual([]);
    expect(restored).toEqual({ text, warnings: [] });
  });

  it("keeps layout exactly: only the detected spans change", () => {
    const text = SAMPLES.resume;
    const { found, scrubbed } = roundTrip(text);
    let withoutValues = text;
    for (const d of [...found].reverse()) {
      withoutValues = withoutValues.slice(0, d.start) + withoutValues.slice(d.end);
    }
    expect(scrubbed.text.replace(/\[[A-Z_]+_\d+\]/g, "")).toBe(withoutValues);
  });

  it("the same value twice gets one number; restoring a reply that reorders them works", () => {
    const { scrubbed } = roundTrip(SAMPLES.chatLog);
    expect(scrubbed.text).toBe(
      "[10:02] customer: my number is [PHONE_1], mail [EMAIL_1]\n" +
        "[10:03] agent: thanks! confirming [EMAIL_1] and [PHONE_1]?\n" +
        "[10:04] customer: yes 👍\n",
    );
    const reply = "Sure — I'll call [phone_1] and cc EMAIL_1.";
    expect(restore(reply, scrubbed.mapping).text).toBe(
      "Sure — I'll call 9876543210 and cc priya@gmail.com.",
    );
  });
});

describe("round trip — traps", () => {
  const emails = Array.from({ length: 12 }, (_, i) => `user${i + 1}@mail.com`);
  const text = emails.join("\n");

  it("[EMAIL_1] does not damage [EMAIL_10]..[EMAIL_12], and the reverse", () => {
    const { scrubbed, restored } = roundTrip(text);
    expect(scrubbed.text.split("\n")).toEqual(emails.map((_, i) => `[EMAIL_${i + 1}]`));
    expect(restored.text).toBe(text);

    const reply = "[EMAIL_10] [EMAIL_1] [EMAIL_11][EMAIL_1] EMAIL_12 EMAIL_1";
    expect(restore(reply, scrubbed.mapping).text).toBe(
      "user10@mail.com user1@mail.com user11@mail.comuser1@mail.com user12@mail.com user1@mail.com",
    );
  });

  it("two different emails get different numbers", () => {
    const { scrubbed } = roundTrip("a@b.com and c@d.com");
    expect(scrubbed.text).toBe("[EMAIL_1] and [EMAIL_2]");
  });

  it("the same email written twice gets the same number", () => {
    const { scrubbed, restored } = roundTrip("a@b.com and again a@b.com");
    expect(scrubbed.text).toBe("[EMAIL_1] and again [EMAIL_1]");
    expect(restored.text).toBe("a@b.com and again a@b.com");
  });

  it("input already containing [EMAIL_1]: scrub warns, round trip still exact, restore warns", () => {
    const original = "Template slot [EMAIL_1] — real one is a@b.com";
    const { scrubbed, restored } = roundTrip(original);
    expect(scrubbed.text).toBe("Template slot [EMAIL_1] — real one is [EMAIL_2]");
    expect(scrubbed.warnings.map((w) => w.token)).toEqual(["[EMAIL_1]"]);
    expect(restored.text).toBe(original);
    expect(restored.warnings.map((w) => w.token)).toEqual(["[EMAIL_1]"]);
  });

  it('"Rahul S <rahul.s@gmail.com>" round-trips, incl. <EMAIL_1> and <[EMAIL_1]> replies', () => {
    const original = "Rahul S <rahul.s@gmail.com>";
    const { scrubbed, restored } = roundTrip(original);
    expect(scrubbed.text).toBe("Rahul S <[EMAIL_1]>");
    expect(restored.text).toBe(original);
    expect(restore("Rahul S <EMAIL_1>", scrubbed.mapping).text).toBe(original);
    expect(restore("Rahul S <[EMAIL_1]>", scrubbed.mapping).text).toBe(original);
  });

  it("an unknown [PERSON_9] in the reply is warned about and left alone", () => {
    const { scrubbed } = roundTrip("a@b.com");
    const r = restore("Dear [PERSON_9], see [EMAIL_1].", scrubbed.mapping);
    expect(r.text).toBe("Dear [PERSON_9], see a@b.com.");
    expect(r.warnings.map((w) => w.token)).toEqual(["[PERSON_9]"]);
  });
});
