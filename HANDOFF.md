# Handoff: how to run the Scrub benchmark

This file is for you, after Claude Code access ends. It explains the benchmark in plain language.
Scrub reduces what you expose; the benchmark measures how well it does that on invented documents.

## What is in the box

- `eval/templates/dev.json` and `test.json`: nine document templates each (3 resumes, 3 business emails, 3 chats or tickets).
- `eval/data/lists.json`: the names, companies, cities and other word lists used to fill the templates.
- `eval/generated/dev.jsonl` and `test.jsonl`: 72 invented documents per split, 8 per template, with the exact position of every piece of personal data ("truth"). Made by the generator. The same inputs always give the same files.
- `eval.html` (open it through the dev server): runs the real Scrub detection over a split and shows the scores. Not part of the production build.
- `eval/results/dev.json` and `dev.md`: the dev run. `test.json` and `test.md` appear only after the frozen run.

Words used: **dev** is the split you may look at, learn from, and re-run as often as you like. **test** (also called **frozen**) is run once, at the end, and never used to improve anything.

## Regenerate the data (rarely needed)

```bash
npm run eval:generate
```

It rewrites both `.jsonl` files and prints the document and span counts. It stops with an error if any self-check fails (wrong positions, invalid ID numbers, overlapping spans, a look-alike code that equals real data, or output that changes between two runs). If you have not changed the templates, the lists or the generator, git will show no change to the `.jsonl` files. If it does show a change, stop and find out why before going on.

## Run the dev split by hand in the browser

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173/eval.html` in Chrome or Edge. (Use the address the terminal prints if it is different.)
3. Wait for the line "Name model: ready." The first time, the model downloads (about 110 MB), which is the only network request. Later it is cached.
4. Leave "Split" on **dev** and press **Run evaluation**. It shows "Document x of 72". It takes about two to three minutes.
5. When it says Done, the tables appear on the page. Press **Download results.json**. The browser saves a file called `dev.json`, usually in your Downloads folder.
6. Move that file to `eval/results/dev.json` (replace the old one), then make the readable report:
   ```bash
   npm run eval:report -- dev
   ```
   This writes `eval/results/dev.md`.

If the model fails to load, or fails on any document, the run stops and produces no numbers. It never quietly falls back to rules only.

## Run the frozen test split, exactly once

Do this only when you are completely done changing the product, the templates, the lists and the generator.

1. **Commit all code first.** Run `git status`. It must show nothing to commit (apart from files you deliberately keep out of git). Run `npm test` and make sure it passes. The report records the commit it was made from, so this step is what makes the result traceable.
2. Make sure the data is unchanged: `npm run eval:generate`, then `git status` must still be clean.
3. `npm run dev`, then open `http://localhost:5173/eval.html`.
4. Choose **test (frozen)** in "Split". Tick **"I understand this is the frozen run and I will not tune on it"**.
5. Press **Run evaluation** and wait for Done. Do not press it twice.
6. Press **Download results.json**. The browser saves it as `test.json`.
7. **Save it as `eval/results/test.json`** in the repository.
8. Make the report: `npm run eval:report -- test`. This writes `eval/results/test.md`. The top of that file shows the git commit, the run time, the model and the fingerprint (SHA-256) of the test file that was scored.
9. Commit exactly these two files, by name, and push:
   ```bash
   git add eval/results/test.json eval/results/test.md
   git commit -m "Frozen test run: results"
   git push
   ```

The page protects the frozen run. For the test split it will not start unless the box is ticked, and it will refuse to run if `eval/results/test.json` already exists. Adding `?force=1` to the address lets it run again on purpose. If a frozen run stops with an error before giving any numbers, nothing was produced, so you may simply start again.

## Rules

- **Never tune after the frozen run.** Do not change the product, the model, the templates, the lists or the generator to improve the test numbers. If you change anything, the frozen result belongs to the old version and you must say so.
- **Report the numbers as they are.** Quote them with their counts and intervals ("212 of 230"). Do not round up, do not leave out the weak rows, and do not describe the result with words like "anonymous" or "compliant". Say "reduces what you expose".
- **Do not read these numbers as real-world accuracy.** The documents are invented from templates written by the author, so the numbers are likely optimistic.
- Keep the dev and test results separate. Do not mix them in one table.

## How to read the report

- **Recall** is the main number: how many pieces of personal data were fully covered by a mask. A piece that is only partly covered counts as a leak.
- **Document leak rate** is the share of documents where at least one piece was not fully covered.
- **Precision** is how much of what was masked really was personal data.
- Every percentage is shown with its counts and a 95% interval. A wide interval means too few examples to trust the number.

## Known limits of the benchmark

- Street names and door numbers inside addresses are not scored. Only the area, the city and the 6-digit PIN are.
- Fixed template text is not truth. Timestamps in chat lines and dates such as "Jan 2021 - Present" are written into the templates, so if Scrub masks them they count as false positives. The same goes for filler words (skills, job titles, bank names).
- Honorifics (Mr., Dr., Shri) are not part of a name. In "Priya S." the scored span stops before the final dot.
- Money is tested only in the forms the money detector documents (for example ₹5,000, Rs. 5,000/-, INR 1.5M, ₹12 LPA, 5 lakh). Dates are tested only in day-month-year forms.
- Names are written in ALL CAPS in about 20% of resumes and 10% of emails, and in lowercase in about 25% of chats. This is recorded for each name so recall can be split by it.
