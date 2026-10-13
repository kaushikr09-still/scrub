# Scrub

**Hide personal details before you paste text into an AI chatbot. Put them back when the answer comes.**

Live site: https://scrub-vert.vercel.app/ · Built for Indian English text (names, phone numbers, Aadhaar, PAN, GSTIN and more) · Runs entirely in your browser

<img width="752" height="572" alt="image" src="https://github.com/user-attachments/assets/d11ff621-9ac5-4214-9340-83b4873c3b27" />
<img width="751" height="609" alt="image" src="https://github.com/user-attachments/assets/eac68e2d-43d1-4e81-91ba-5f8af8c66da4" />

## The problem

People paste resumes, business emails and chat logs into AI chatbots all the time. Those texts are full of names, phone numbers, bank details and ID numbers. Scrub replaces them with neutral placeholders such as `[PERSON_1]` or `[PHONE_2]` before the text leaves your screen. When the chatbot replies, Scrub swaps the real details back in.

## How it works

1. **Scrub.** Paste your text and press Scrub. Personal details become placeholders.
2. **Ask.** Copy the scrubbed text into any chatbot and ask your question.
3. **Restore.** Paste the chatbot's reply back into Scrub. The placeholders become the real details again.

Everything happens on your device. There is no server that sees your text. The only network request is a one-time download of the name-finding model (about 110 MB), which your browser then keeps.

## Try it

Pick a preset, press **Load example**, then **Scrub**. The examples are invented.

| Preset | Leaves visible by default | Why |
|---|---|---|
| Resumes | Employers, schools, cities | A reviewer can't judge a career without them |
| Business emails | Nothing | Everything is masked |
| Chat logs and tickets | Cities | Everything else is masked |

After Scrub, a checklist lists each distinct detail. Untick any row to keep that detail as plain text everywhere it appears.

## What it finds

Names, organisations and places (found by a small language model), plus these, found by rules and checksums: email, phone, Aadhaar, PAN, GSTIN, IFSC, UPI ID, PIN code, card number, bank account, URL, IP address, date and rupee amounts.

It handles messy text too: ALL CAPS names, initials, honorifics (Mr., Dr., Shri), romanised Indian names and light Hinglish.

## How well does it work?

I measured it. This is the result on a **frozen test set**: 72 invented documents (24 resumes, 24 business emails, 24 chat logs and tickets) with 1,160 known personal details. I tuned the product on a separate set of 72 documents built from different templates. I ran the test set **once**, after the code was final, and I report the numbers as they came out.

| Measure | Result |
|---|---|
| Details fully hidden | **1,079 of 1,160 (93.0%)**, 95% range 91.4–94.3% |
| Names fully hidden | 305 of 368 (82.9%) |
| Names written normally (Title Case) | 279 of 310 (90.0%) |
| Names in ALL CAPS | 25 of 30 (83.3%) |
| Names in lowercase | 1 of 28 (3.6%) |
| Phone, email, card, bank account, GSTIN, IFSC, UPI, URL, IP, date | 100% each (some with only 8 examples) |
| Aadhaar | 8 of 8 (small sample) |
| Precision (masked things that really were personal) | 1,047 of 1,154 (90.7%) |
| **Documents with at least one detail left visible** | **38 of 72 (52.8%)** |

The last row matters most. **In about half of the test documents, something was still visible.** Scrub reduces what you expose. It does not guarantee that nothing is left, so read the output before you copy it. The page nudges you to do this.

Full tables, definitions and the exact code version are in `eval/results/test.md`.

### What the benchmark found

On the tuning set, name recall started at 33%. Digging in showed that the product itself lost names whenever a word was followed by a colon (`Name:`, `Priority:`). Fixing it took names to 74% on that set. A benchmark that finds a real bug is doing its job.

## What it does not do

- **Lowercase names are mostly missed**, especially in chats. The name model rarely recognises them. It was trained on English news text, not on Indian chat messages.
- **Initials and multi-part names are patchy** (54% and 62% on small samples), and sometimes only part of the name is hidden.
- **It over-masks sometimes.** Organisations and places are the noisiest (precision 78% and 70%). Some everyday phrases, like a thank-you line in capitals, can be masked by mistake.
- **A 12-digit number can look like an Aadhaar number.** Checksums cut false alarms, but they can't remove them. About 1 in 10 random 13–19 digit numbers also passes the card check.
- **Numbers glued to letters can slip through** (for example `Call9876543210`).
- **Street names and door numbers are not detected.** Only the area, city and PIN are.
- **Dates:** a month and year alone (such as a job history) is not masked.
- **Currencies:** rupee amounts only.
- **Real documents will score worse than these invented ones.** My test documents are cleaner than real writing.

More detail: `SPEC.md` (limits section) and `THREAT_MODEL.md`.

## Privacy: what is checked, and what isn't

- A strict content security policy lets the page talk only to itself and to two Hugging Face hosts for the model download.
- An automated browser test scrubs text and **fails if any request leaves the page**. The test also proves the safety net works by trying a forbidden request on purpose.
- If the name model can't load, Scrub says **"names NOT checked"** and asks you to tick a box before it lets you copy.
- **Hugging Face sees your IP address once**, when the model downloads. It never sees your text.
- Your device, browser and extensions are trusted. Scrub can't protect against malware on your machine.

## Decisions

- **Why a small model in the browser?** It keeps your text on your device. I compared four candidate models on 81 invented names, and chose `bert-base-NER` because the others missed single first names or were far larger. Those 81 names were selection data, not a benchmark.
- **Why a frozen test set?** So the headline number can't be tuned to look good.
- **Why list a checklist instead of auto-everything?** The model will sometimes be wrong, so you stay in control.

Read the full story in [CASE_STUDY.md](CASE_STUDY.md) and the open risks in [RISKS.md](RISKS.md).
The full spec is in `SPEC.md`.

## Run it yourself

```bash
npm install
npm run dev          # the app
npm test             # unit tests
npm run test:e2e     # browser tests, including the no-network-leak test
```

The benchmark is described in `HANDOFF.md`. TypeScript, Vite, Vitest, Playwright, Transformers.js with ONNX Runtime Web, hosted on Vercel.

## Credits

- Name model: [dslim/bert-base-NER](https://huggingface.co/dslim/bert-base-NER) (MIT licence), converted for the browser by [Xenova](https://huggingface.co/Xenova/bert-base-NER) (MIT licence). Both licence lines were read on the model pages on 13 October 2026. The model was trained on CoNLL-2003, English news text, which is a likely reason it struggles with lowercase chat and less common name patterns. I have not reviewed the terms of that training data.
- [Transformers.js](https://github.com/huggingface/transformers.js) and [ONNX Runtime Web](https://github.com/microsoft/onnxruntime).
- All names, numbers and documents in the examples and benchmark are invented. A made-up valid ID number can coincidentally match a real one.

## About this project

Scrub is my second portfolio project. I'm not a software engineer. I designed the product, set the rules for what counts as success, and checked the work, and I built it with Claude Code as my only paid tool. The tests, the frozen benchmark and the limits above are there so you don't have to take my word for any of it.

## Licence

MIT
