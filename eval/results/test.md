# Scrub evaluation: test split

- Code version (git commit): ed5d6d2dab4a29e3cb3497661e0127543aa32f89
- Split: test
- Run date and time: 2026-10-12T19:02:26.708Z
- Model: Xenova/bert-base-NER (q8)
- Documents: 72
- SHA-256 of the scored file: f1d5f678e90db34a9c3feb0dc836e11afb41125b9351062cb685a2ee43f7bd2f
- File on disk now: same SHA-256 as the scored file
- Run time: 105.6 seconds

## Definitions

- **Truth span**: one piece of personal data that the generator put into a document, with its exact position. Look-alike codes (order, ticket, invoice, reference, version numbers) are *not* truth.
- **Fully masked**: every character of the truth span is covered by the union of the product's detections, whatever type label the detections carry. **Partly masked**: some but not all characters are covered. **Missed**: none are. A partly masked span still shows part of the value, so it counts as a leak.
- **Recall** (headline) = fully masked spans / all truth spans. **Type-correct recall** is the same count, but the covering detections must all carry the truth span's own type.
- **Detection**: one span returned by the product's detection path (rules, name model, ALL CAPS copy, whole-word snapping), with every category on and no preset filtering.
- A detection is **true** if it overlaps a truth span of the same type. It is a **type mismatch** if it overlaps only truth of another type (still protective; counted and listed separately, and left out of precision). It is a **false positive** if it overlaps no truth span.
- **Precision** = true / (true + false positive).
- **Document leak rate** = documents with at least one truth span not fully masked / all documents.
- **Fixed template text is not scored as truth.** Timestamps such as "[12/05/24, 10:42 am]" and dates such as "Jan 2021 - Present" are written into the templates, so a mask there counts as a false positive. The same goes for filler words (skills, job titles, bank names) and for streets and door numbers.
- **Look-alike numbers (NEG)**: detections that overlap them are false positives and are also counted by kind.
- **Percentages** are always shown with their counts ("212 of 230") and a 95% Wilson score interval.

### Limits of this benchmark

- The documents are invented from templates and word lists written by the author. They are not real documents, and the numbers are likely optimistic for real text.
- **ADDRESS**: only the area, the city and the 6-digit PIN are scored. Street and door number are not scored (documented limit).
- **PERSON**: honorifics (Mr., Dr., Shri ...) are not part of the truth span. For "Priya S." the truth span is "Priya S" without the final dot.
- **MONEY forms used**: ₹5,000 · Rs. 5,000/- · Rs.5,000 · INR 1,25,000 · INR 1.5M · ₹12 LPA · 5,000 INR · 500 rupees · 5 lakh · 1.2 crore. Bare short units (12L, 50K) are not used.
- **DATE forms used**: day-month-year only, such as 12/05/2024, 12-05-24, 12.05.2024, 12 May 2024, 12th May 2024, 12-May-2024.
- Every ID is valid (Aadhaar Verhoeff, card Luhn, GSTIN check character). Bank accounts are 9 to 18 digits that fail Luhn.

## How to read this

Start with the headline recall and the document leak rate: they say how often something is left visible. Then look at recall by entity type and by PERSON pattern and case style to see where. Precision says how much extra is masked by mistake. A small count with a wide interval means the number is not reliable. Do not tune the product on the frozen test split; report these numbers as they are.

## Results

### Headline

| Measure | Result |
| --- | --- |
| Recall: truth spans fully masked | 1079 of 1160 (93.0%, 95% CI 91.4% to 94.3%) |
| Type-correct recall: fully masked by detections of the right type | 1027 of 1160 (88.5%, 95% CI 86.6% to 90.2%) |
| Truth spans partly masked (counted as leaks) | 29 of 1160 |
| Truth spans missed completely | 52 of 1160 |
| Document leak rate: documents with at least one span not fully masked | 38 of 72 (52.8%, 95% CI 41.4% to 63.9%) |
| Precision: true detections out of true plus false positives | 1047 of 1154 (90.7%, 95% CI 88.9% to 92.3%) |
| All detections | 1232 (true 1047, type mismatch 78, false positive 107) |

### Recall by entity type

| Type | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| AADHAAR | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| BANK_ACCOUNT | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| CARD | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| DATE | 72 | 72 of 72 (100.0%, 95% CI 94.9% to 100.0%) | 72 of 72 (100.0%, 95% CI 94.9% to 100.0%) | 0 | 0 |
| EMAIL | 64 | 64 of 64 (100.0%, 95% CI 94.3% to 100.0%) | 64 of 64 (100.0%, 95% CI 94.3% to 100.0%) | 0 | 0 |
| GSTIN | 24 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 0 | 0 |
| IFSC | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| IP | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |
| LOC | 136 | 130 of 136 (95.6%, 95% CI 90.7% to 98.0%) | 121 of 136 (89.0%, 95% CI 82.6% to 93.2%) | 1 | 5 |
| MONEY | 104 | 100 of 104 (96.2%, 95% CI 90.5% to 98.5%) | 100 of 104 (96.2%, 95% CI 90.5% to 98.5%) | 4 | 0 |
| ORG | 168 | 161 of 168 (95.8%, 95% CI 91.7% to 98.0%) | 161 of 168 (95.8%, 95% CI 91.7% to 98.0%) | 7 | 0 |
| PERSON | 368 | 305 of 368 (82.9%, 95% CI 78.7% to 86.4%) | 264 of 368 (71.7%, 95% CI 66.9% to 76.1%) | 17 | 46 |
| PHONE | 104 | 104 of 104 (100.0%, 95% CI 96.4% to 100.0%) | 102 of 104 (98.1%, 95% CI 93.3% to 99.5%) | 0 | 0 |
| PIN | 32 | 31 of 32 (96.9%, 95% CI 84.3% to 99.4%) | 31 of 32 (96.9%, 95% CI 84.3% to 99.4%) | 0 | 1 |
| UPI | 24 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 0 | 0 |
| URL | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |

### Recall by preset

| Preset | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| chats | 352 | 301 of 352 (85.5%, 95% CI 81.5% to 88.8%) | 291 of 352 (82.7%, 95% CI 78.4% to 86.3%) | 1 | 50 |
| emails | 376 | 362 of 376 (96.3%, 95% CI 93.8% to 97.8%) | 339 of 376 (90.2%, 95% CI 86.7% to 92.8%) | 14 | 0 |
| resumes | 432 | 416 of 432 (96.3%, 95% CI 94.1% to 97.7%) | 397 of 432 (91.9%, 95% CI 88.9% to 94.1%) | 14 | 2 |

### Recall by PERSON pattern

| Pattern | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| full | 88 | 79 of 88 (89.8%, 95% CI 81.7% to 94.5%) | 73 of 88 (83.0%, 95% CI 73.8% to 89.4%) | 3 | 6 |
| honorific | 32 | 30 of 32 (93.8%, 95% CI 79.9% to 98.3%) | 29 of 32 (90.6%, 95% CI 75.8% to 96.8%) | 0 | 2 |
| initials_first | 24 | 13 of 24 (54.2%, 95% CI 35.1% to 72.1%) | 8 of 24 (33.3%, 95% CI 18.0% to 53.3%) | 11 | 0 |
| multipart | 8 | 5 of 8 (62.5%, 95% CI 30.6% to 86.3%) | 3 of 8 (37.5%, 95% CI 13.7% to 69.4%) | 3 | 0 |
| ordinary_word | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| single | 208 | 170 of 208 (81.7%, 95% CI 75.9% to 86.4%) | 143 of 208 (68.8%, 95% CI 62.2% to 74.7%) | 0 | 38 |

### Recall by PERSON case style

| Case style | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| lower | 28 | 1 of 28 (3.6%, 95% CI 0.6% to 17.7%) | 1 of 28 (3.6%, 95% CI 0.6% to 17.7%) | 0 | 27 |
| title | 310 | 279 of 310 (90.0%, 95% CI 86.2% to 92.9%) | 247 of 310 (79.7%, 95% CI 74.8% to 83.8%) | 12 | 19 |
| upper | 30 | 25 of 30 (83.3%, 95% CI 66.4% to 92.7%) | 16 of 30 (53.3%, 95% CI 36.1% to 69.8%) | 5 | 0 |

### Document leak rate by preset

| Preset | Documents with a leak |
| --- | --- |
| chats | 15 of 24 (62.5%, 95% CI 42.7% to 78.8%) |
| emails | 10 of 24 (41.7%, 95% CI 24.5% to 61.2%) |
| resumes | 13 of 24 (54.2%, 95% CI 35.1% to 72.1%) |

### Precision by detected type

| Detected type | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| AADHAAR | 10 | 8 | 2 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| BANK_ACCOUNT | 8 | 8 | 0 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| CARD | 8 | 8 | 0 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| DATE | 72 | 72 | 0 | 0 | 72 of 72 (100.0%, 95% CI 94.9% to 100.0%) |
| EMAIL | 64 | 64 | 0 | 0 | 64 of 64 (100.0%, 95% CI 94.3% to 100.0%) |
| GSTIN | 24 | 24 | 0 | 0 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) |
| IFSC | 8 | 8 | 0 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| IP | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| LOC | 188 | 122 | 14 | 52 | 122 of 174 (70.1%, 95% CI 62.9% to 76.4%) |
| MONEY | 104 | 104 | 0 | 0 | 104 of 104 (100.0%, 95% CI 96.4% to 100.0%) |
| ORG | 278 | 168 | 62 | 48 | 168 of 216 (77.8%, 95% CI 71.8% to 82.8%) |
| PERSON | 279 | 272 | 0 | 7 | 272 of 279 (97.5%, 95% CI 94.9% to 98.8%) |
| PHONE | 102 | 102 | 0 | 0 | 102 of 102 (100.0%, 95% CI 96.4% to 100.0%) |
| PIN | 31 | 31 | 0 | 0 | 31 of 31 (100.0%, 95% CI 89.0% to 100.0%) |
| UPI | 24 | 24 | 0 | 0 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) |
| URL | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |

### Precision by preset

| Preset | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| chats | 321 | 292 | 10 | 19 | 292 of 311 (93.9%, 95% CI 90.7% to 96.1%) |
| emails | 411 | 346 | 37 | 28 | 346 of 374 (92.5%, 95% CI 89.4% to 94.8%) |
| resumes | 500 | 409 | 31 | 60 | 409 of 469 (87.2%, 95% CI 83.9% to 89.9%) |

### Type mismatches (still protective, listed separately)

| Detected as -> truth type | Detections |
| --- | --- |
| AADHAAR -> PHONE | 2 |
| LOC -> ORG | 6 |
| LOC -> PERSON | 8 |
| ORG -> LOC | 4 |
| ORG -> LOC+PERSON | 2 |
| ORG -> PERSON | 56 |

### Look-alike numbers (NEG): detections that overlap them

These codes are not personal data. A detection over one is a false positive.

| Kind | NEG spans | Touched by a detection | Detections touching |
| --- | --- | --- | --- |
| invoice | 24 | 4 of 24 (16.7%, 95% CI 6.7% to 35.9%) | 4 |
| ref | 16 | 0 of 16 (0.0%, 95% CI 0.0% to 19.4%) | 0 |
| order | 24 | 0 of 24 (0.0%, 95% CI 0.0% to 13.8%) | 0 |
| ticket | 8 | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 |
