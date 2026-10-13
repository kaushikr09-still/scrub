# Scrub: a case study

**A browser tool that hides personal details before you paste text into an AI chatbot, built by a non-engineer with Claude Code, and measured honestly.**

## In short

- I built Scrub as my second portfolio project, after a breathing app called Reset.
- It finds names, phone numbers, Aadhaar, PAN, GSTIN and about a dozen other kinds of detail in Indian English text, swaps them for placeholders, and puts them back when the chatbot answers.
- Everything runs in the browser. No server sees the text.
- On a frozen test of 72 invented documents, it fully hid **93.0%** of 1,160 personal details. In **53% of documents, something was still visible**. I think that second number matters more than the first, and the project is built around saying so.

## The problem, and why I made it local

People paste resumes, business emails and chat logs into AI chatbots without thinking about what is in them. A tool that fixes this by sending the text to *another* server would be solving the problem with the problem. So the first decision was: **the text never leaves the device.** That one rule shaped everything else: a small language model that runs in the browser, rules and checksums for structured IDs, and a security policy that stops the page from calling anywhere else.

## Constraints I set

- Claude Code was my only paid tool. Everything else was free, and the build had a hard end date.
- The scope was fixed at the start: three presets (resumes, business emails, chat logs), Indian English with light Hinglish, and nothing added without saying what was removed.
- I am not an engineer. My job was to decide what to build, define what "good" means, check the work, and say no.

## Decisions that mattered

**1. Fail closed.** If the name model can't load, Scrub says "names NOT checked" and won't let you copy until you tick a box. A tool that silently falls back to weaker protection is worse than one that stops.

**2. Choose the model with a test, not a feeling.** I wrote 81 invented names covering awkward cases (initials, honorifics, single first names, names that are also ordinary words, ALL CAPS, lowercase) and ran four candidate models over them. The two privacy-focused models missed almost every single first name. A multilingual model was much bigger with no gain. I picked `bert-base-NER`, which fully hid 62 of 81. Those 81 names were selection data written by me, so they are optimistic, and I never call them a benchmark.

**3. Count leaks, not "found".** My first scoring counted a half-hidden name as found. A real test run showed `Hi [PERSON_1]riya`, where the model had hidden "Pri" and left "riya" exposed. That was my mistake in approving the scoring, and I fixed it by adding a strict "fully masked" column and by snapping every detection to whole-word edges. From then on, a half-hidden name counted as a leak.

**4. Split the data, and run the final test once.** I built 72 documents for tuning and 72 from different templates for a frozen test. The frozen test was run once, after the code was final, with the guard built into the page. I report what it said.

**5. Decide the rules before looking at the results.** For the context rules I wanted to add, I fixed the bar in advance: keep a rule only if at least 75% of what it catches is correct and it adds at least 15 fully hidden names. One rule scored 14. I dropped it, even though it was precise, because the bar was set before I saw the number.

## What testing found

- **A real bug, found by the benchmark.** On the tuning set, name recall started at 33%. Claude Code's first diagnosis blamed the model. I asked it to prove that, and it built an independent check, which showed the opposite: the model was tagging the names and *our code was losing them* whenever a word was followed by a colon, such as `Name:` or `Priority:`. Fixing that took name recall to 74% on the tuning set, and it was a bug real users would have hit.
- **ALL CAPS names.** The model hid 0 of 9. Showing it a title-case copy of long capitalised runs, with the same character positions, fixed 9 of 9 on my set, at the cost of a few extra false masks on headings. The fixed rule for adopting it was written first.
- **A wrong claim I caught.** Claude Code said 1,000 characters at roughly one token each was safely under the model's 512-token limit. It wasn't. The fix was to count real tokens and split and retry, and never to rely on truncation.
- **Plain bugs.** A word hidden by mistake ("revised") because of an offset drift, and 12-digit phone numbers with a `+91` prefix that were mistaken for Aadhaar numbers.

## Results (frozen test, run once)

| Measure | Result |
|---|---|
| Details fully hidden | 1,079 of 1,160 (93.0%) |
| Names | 305 of 368 (82.9%) |
| Structured IDs, emails, phones, dates | 96–100% each |
| Lowercase names | 1 of 28 |
| Precision | 90.7% |
| Documents with something left visible | 38 of 72 (52.8%) |

Full definitions and tables are in `eval/results/test.md`.

## What it still gets wrong

Lowercase names, especially in chat, are almost never caught. Initials and multi-part names are patchy. Organisations and places are over-masked. The test documents are invented from templates I wrote, so real text will score worse. The model was trained on English news, which probably explains much of the name weakness.

## What I'd do next

1. Test on real, consented documents.
2. Try a model or a second pass built for lowercase and Indian name patterns.
3. Add generic context rules for names after labels and greetings, and measure them with the same pre-set bar.
4. Measure speed on phones. I have only timed a laptop (about 18 seconds for a 1,500-word document).

## What I learned about building with AI

- **The tests are the product.** Without the frozen set and the leak count, I would have shipped a tool that looked good in demos and failed on half of real documents.
- **Ask the AI to prove, not to say.** Two of the most valuable moments were asking "show me" after a confident diagnosis, and catching an arithmetic claim that sounded right.
- **One small task per session, ending with something I can check by hand,** kept a non-engineer in control of the work.
- **Fix the rules before you see the numbers.** It is the cheapest honesty there is.
