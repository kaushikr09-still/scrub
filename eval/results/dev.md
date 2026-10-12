# Scrub evaluation: dev split

- Code version (git commit): 4946553436addb315cc1179a87875e0933ed18a2
- Split: dev
- Run date and time: 2026-10-12T18:17:29.669Z
- Model: Xenova/bert-base-NER (q8)
- Documents: 72
- SHA-256 of the scored file: d94d4873ad2753bb4fe246e6a17065753bbb2411bafe329f70e40bd5554c0ef3
- File on disk now: same SHA-256 as the scored file
- Run time: 127.1 seconds

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
| Recall: truth spans fully masked | 1101 of 1200 (91.8%, 95% CI 90.1% to 93.2%) |
| Type-correct recall: fully masked by detections of the right type | 1050 of 1200 (87.5%, 95% CI 85.5% to 89.3%) |
| Truth spans partly masked (counted as leaks) | 20 of 1200 |
| Truth spans missed completely | 79 of 1200 |
| Document leak rate: documents with at least one span not fully masked | 34 of 72 (47.2%, 95% CI 36.1% to 58.6%) |
| Precision: true detections out of true plus false positives | 1069 of 1294 (82.6%, 95% CI 80.5% to 84.6%) |
| All detections | 1357 (true 1069, type mismatch 63, false positive 225) |

### Recall by entity type

| Type | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| AADHAAR | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| BANK_ACCOUNT | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 14 of 16 (87.5%, 95% CI 64.0% to 96.5%) | 0 | 0 |
| DATE | 96 | 96 of 96 (100.0%, 95% CI 96.2% to 100.0%) | 96 of 96 (100.0%, 95% CI 96.2% to 100.0%) | 0 | 0 |
| EMAIL | 80 | 80 of 80 (100.0%, 95% CI 95.4% to 100.0%) | 80 of 80 (100.0%, 95% CI 95.4% to 100.0%) | 0 | 0 |
| GSTIN | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |
| IFSC | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |
| IP | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| LOC | 176 | 173 of 176 (98.3%, 95% CI 95.1% to 99.4%) | 160 of 176 (90.9%, 95% CI 85.7% to 94.3%) | 2 | 1 |
| MONEY | 48 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 0 | 0 |
| ORG | 168 | 162 of 168 (96.4%, 95% CI 92.4% to 98.4%) | 162 of 168 (96.4%, 95% CI 92.4% to 98.4%) | 6 | 0 |
| PAN | 24 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 0 | 0 |
| PERSON | 352 | 262 of 352 (74.4%, 95% CI 69.6% to 78.7%) | 229 of 352 (65.1%, 95% CI 59.9% to 69.9%) | 12 | 78 |
| PHONE | 96 | 96 of 96 (100.0%, 95% CI 96.2% to 100.0%) | 95 of 96 (99.0%, 95% CI 94.3% to 99.8%) | 0 | 0 |
| PIN | 32 | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) | 0 | 0 |
| UPI | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |
| URL | 48 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 46 of 48 (95.8%, 95% CI 86.0% to 98.8%) | 0 | 0 |

### Recall by preset

| Preset | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| chats | 344 | 265 of 344 (77.0%, 95% CI 72.3% to 81.2%) | 259 of 344 (75.3%, 95% CI 70.5% to 79.6%) | 3 | 76 |
| emails | 400 | 393 of 400 (98.3%, 95% CI 96.4% to 99.1%) | 371 of 400 (92.8%, 95% CI 89.8% to 94.9%) | 5 | 2 |
| resumes | 456 | 443 of 456 (97.1%, 95% CI 95.2% to 98.3%) | 420 of 456 (92.1%, 95% CI 89.3% to 94.2%) | 12 | 1 |

### Recall by PERSON pattern

| Pattern | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| full | 112 | 103 of 112 (92.0%, 95% CI 85.4% to 95.7%) | 81 of 112 (72.3%, 95% CI 63.4% to 79.8%) | 9 | 0 |
| honorific | 40 | 35 of 40 (87.5%, 95% CI 73.9% to 94.5%) | 33 of 40 (82.5%, 95% CI 68.0% to 91.3%) | 0 | 5 |
| initials_first | 8 | 5 of 8 (62.5%, 95% CI 30.6% to 86.3%) | 5 of 8 (62.5%, 95% CI 30.6% to 86.3%) | 3 | 0 |
| initials_last | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 3 of 8 (37.5%, 95% CI 13.7% to 69.4%) | 0 | 0 |
| multipart | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 0 | 0 |
| single | 176 | 103 of 176 (58.5%, 95% CI 51.1% to 65.5%) | 99 of 176 (56.3%, 95% CI 48.9% to 63.4%) | 0 | 73 |

### Recall by PERSON case style

| Case style | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| lower | 51 | 0 of 51 (0.0%, 95% CI 0.0% to 7.0%) | 0 of 51 (0.0%, 95% CI 0.0% to 7.0%) | 0 | 51 |
| title | 274 | 238 of 274 (86.9%, 95% CI 82.3% to 90.4%) | 211 of 274 (77.0%, 95% CI 71.7% to 81.6%) | 12 | 24 |
| upper | 27 | 24 of 27 (88.9%, 95% CI 71.9% to 96.1%) | 18 of 27 (66.7%, 95% CI 47.8% to 81.4%) | 0 | 3 |

### Document leak rate by preset

| Preset | Documents with a leak |
| --- | --- |
| chats | 17 of 24 (70.8%, 95% CI 50.8% to 85.1%) |
| emails | 7 of 24 (29.2%, 95% CI 14.9% to 49.2%) |
| resumes | 10 of 24 (41.7%, 95% CI 24.5% to 61.2%) |

### Precision by detected type

| Detected type | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| AADHAAR | 10 | 8 | 2 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| BANK_ACCOUNT | 14 | 14 | 0 | 0 | 14 of 14 (100.0%, 95% CI 78.5% to 100.0%) |
| DATE | 144 | 96 | 0 | 48 | 96 of 144 (66.7%, 95% CI 58.6% to 73.8%) |
| EMAIL | 82 | 80 | 2 | 0 | 80 of 80 (100.0%, 95% CI 95.4% to 100.0%) |
| GSTIN | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| IFSC | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| IP | 8 | 8 | 0 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| LOC | 223 | 161 | 11 | 51 | 161 of 212 (75.9%, 95% CI 69.8% to 81.2%) |
| MONEY | 48 | 48 | 0 | 0 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) |
| ORG | 327 | 167 | 46 | 114 | 167 of 281 (59.4%, 95% CI 53.6% to 65.0%) |
| PAN | 24 | 24 | 0 | 0 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) |
| PERSON | 255 | 242 | 1 | 12 | 242 of 254 (95.3%, 95% CI 91.9% to 97.3%) |
| PHONE | 96 | 95 | 1 | 0 | 95 of 95 (100.0%, 95% CI 96.1% to 100.0%) |
| PIN | 32 | 32 | 0 | 0 | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) |
| UPI | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| URL | 46 | 46 | 0 | 0 | 46 of 46 (100.0%, 95% CI 92.3% to 100.0%) |

### Precision by preset

| Preset | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| chats | 323 | 264 | 9 | 50 | 264 of 314 (84.1%, 95% CI 79.6% to 87.7%) |
| emails | 440 | 376 | 18 | 46 | 376 of 422 (89.1%, 95% CI 85.8% to 91.7%) |
| resumes | 594 | 429 | 36 | 129 | 429 of 558 (76.9%, 95% CI 73.2% to 80.2%) |

### Type mismatches (still protective, listed separately)

| Detected as -> truth type | Detections |
| --- | --- |
| AADHAAR -> BANK_ACCOUNT | 1 |
| AADHAAR -> PHONE | 1 |
| EMAIL -> URL | 2 |
| LOC -> ORG | 6 |
| LOC -> PERSON | 5 |
| ORG -> LOC | 13 |
| ORG -> PERSON | 33 |
| PERSON -> LOC | 1 |
| PHONE -> BANK_ACCOUNT | 1 |

### Look-alike numbers (NEG): detections that overlap them

These codes are not personal data. A detection over one is a false positive.

| Kind | NEG spans | Touched by a detection | Detections touching |
| --- | --- | --- | --- |
| ticket | 16 | 1 of 16 (6.3%, 95% CI 1.1% to 28.3%) | 1 |
| invoice | 16 | 0 of 16 (0.0%, 95% CI 0.0% to 19.4%) | 0 |
| order | 24 | 0 of 24 (0.0%, 95% CI 0.0% to 13.8%) | 0 |
| ref | 8 | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 |
| version | 8 | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 |

## Worst misses (dev only)

Structured IDs first, then names, organisations and places; within each, missed spans first, then partly masked ones by how much is left uncovered. Context is 40 characters each side; ⏎ marks a line break.

| # | Doc | Type | Pattern / case | Status | Value | Before | After | Detected as |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 2 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya kavitasubramanian | - |
| 3 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | manian@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. pallavi ka number do na⏎[12/05/24, | - |
| 4 | ch_d1-1 | PERSON | single / lower | missed, 7 of 7 characters not covered | pallavi | .co.in⏎[12/05/24, 10:44 am] kavita: ok.  |  ka number do na⏎[12/05/24, 10:44 am] so | - |
| 5 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | vi ka number do na⏎[12/05/24, 10:44 am]  | : 62187-01918⏎[12/05/24, 10:47 am] kavit | - |
| 6 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | ourav: 62187-01918⏎[12/05/24, 10:47 am]  | : payment Rs.1,29,900 kal tak ho jayega, | - |
| 7 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav |  UPI id vermaa@ybl⏎[12/05/24, 10:48 am]  | : done. order OD76454550 ka status check | - |
| 8 | ch_d1-2 | PERSON | single / title | missed, 6 of 6 characters not covered | Rajesh | r.bora@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. Venkatesh ka number do na⏎[12/05/2 | - |
| 9 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 10 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya dorjee.sourav@red | - |
| 11 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | rav@rediffmail.com⏎[12/05/24, 10:44 am]  | : ok. nikhil ka number do na⏎[12/05/24,  | - |
| 12 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | nikhil | il.com⏎[12/05/24, 10:44 am] sourav: ok.  |  ka number do na⏎[12/05/24, 10:44 am] zo | - |
| 13 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | il ka number do na⏎[12/05/24, 10:44 am]  | : 91 74645 85249⏎[12/05/24, 10:47 am] so | - |
| 14 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | ya: 91 74645 85249⏎[12/05/24, 10:47 am]  | : payment ₹1,07,300 kal tak ho jayega, U | - |
| 15 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | kavita.trivedi@ibl⏎[12/05/24, 10:48 am]  | : done. order OD84497826 ka status check | - |
| 16 | ch_d1-4 | PERSON | single / title | missed, 6 of 6 characters not covered | Vikram | preet.patel@okaxis⏎[12/05/24, 10:48 am]  | : done. order ORD-6955699 ka status chec | - |
| 17 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 18 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit | ari@rediffmail.com⏎[12/05/24, 10:44 am]  | : ok. Jyoti ka number do na⏎[12/05/24, 1 | - |
| 19 | ch_d1-5 | PERSON | single / title | missed, 5 of 5 characters not covered | Jyoti | mail.com⏎[12/05/24, 10:44 am] Amit: ok.  |  ka number do na⏎[12/05/24, 10:44 am] Im | - |
| 20 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit |  Imran: 6933921669⏎[12/05/24, 10:47 am]  | : payment ₹303,000 kal tak ho jayega, UP | - |
| 21 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 22 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya shruti23@gmail.co | - |
| 23 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti | shruti23@gmail.com⏎[12/05/24, 10:44 am]  | : ok. varun ka number do na⏎[12/05/24, 1 | - |
| 24 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | varun | il.com⏎[12/05/24, 10:44 am] shruti: ok.  |  ka number do na⏎[12/05/24, 10:44 am] ab | - |
| 25 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | un ka number do na⏎[12/05/24, 10:44 am]  | : 8863220133⏎[12/05/24, 10:47 am] shruti | - |
| 26 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti |  abdul: 8863220133⏎[12/05/24, 10:47 am]  | : payment Rs.4,74,100 kal tak ho jayega, | - |
| 27 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | id zainab20@okaxis⏎[12/05/24, 10:48 am]  | : done. order ORD-2124050 ka status chec | - |
| 28 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Balaji | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 29 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya balaji.kapoor@yah | - |
| 30 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Balaji | kapoor@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. Tenzin ka number do na⏎[12/05/24,  | - |
| 31 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Tenzin | .co.in⏎[12/05/24, 10:44 am] Balaji: ok.  |  ka number do na⏎[12/05/24, 10:44 am] La | - |
| 32 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | in ka number do na⏎[12/05/24, 10:44 am]  | : 9993948094⏎[12/05/24, 10:47 am] Balaji | - |
| 33 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | PI id manoj921@ybl⏎[12/05/24, 10:48 am]  | : done. order SO-533758 ka status check  | - |
| 34 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 35 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | nverma@hotmail.com⏎[12/05/24, 10:44 am]  | : ok. Yamini ka number do na⏎[12/05/24,  | - |
| 36 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Yamini | il.com⏎[12/05/24, 10:44 am] Naveen: ok.  |  ka number do na⏎[12/05/24, 10:44 am] Ad | - |
| 37 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | tya: 91 6320214912⏎[12/05/24, 10:47 am]  | : payment ₹21 LPA kal tak ho jayega, UPI | - |
| 38 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Aditya | UPI id iyers@paytm⏎[12/05/24, 10:48 am]  | : done. order SO-022877 ka status check  | - |
| 39 | ch_d3-3 | PERSON | single / title | missed, 4 of 4 characters not covered | Neha | gar said they would sign by 05.02.2024.⏎ | : Action items: Joseph to send the contr | - |
| 40 | ch_d3-4 | PERSON | single / title | missed, 4 of 4 characters not covered | Ritu | waiting. I will call him on 6768641808.⏎ | : I can follow up with Pioneer Valve Wor | - |
| 41 | ch_d3-4 | PERSON | single / title | missed, 4 of 4 characters not covered | Ritu | 16th August 2023.⏎Simran: Action items:  |  to send the contract, Harini to share t | - |
| 42 | ch_d3-5 | PERSON | single / lower | missed, 7 of 7 characters not covered | sandeep | urity Systems⏎Date: 18 September, 2020⏎⏎ | : Okay everyone, let's start. anjali, ca | - |
| 43 | ch_d3-5 | PERSON | single / lower | missed, 6 of 6 characters not covered | anjali | 0⏎⏎sandeep: Okay everyone, let's start.  | , can you share the numbers?⏎anjali: Sur | - |
| 44 | ch_d3-5 | PERSON | single / lower | missed, 6 of 6 characters not covered | anjali | art. anjali, can you share the numbers?⏎ | : Sure. We closed ₹38 LPA this quarter,  | - |
| 45 | ch_d3-5 | PERSON | single / lower | missed, 7 of 7 characters not covered | sandeep | , mostly from Visakhapatnam and Mumbai.⏎ | : Good. And the pending approval from Sm | - |
| 46 | ch_d3-5 | PERSON | honorific / lower | missed, 6 of 6 characters not covered | thakur | ood. And the pending approval from Smt.  | ?⏎anjali: Still waiting. I will call him | - |
| 47 | ch_d3-5 | PERSON | single / lower | missed, 6 of 6 characters not covered | anjali |  the pending approval from Smt. thakur?⏎ | : Still waiting. I will call him on +916 | - |
| 48 | ch_d3-5 | PERSON | single / lower | missed, 5 of 5 characters not covered | rahul | ting. I will call him on +916371887655.⏎ | : I can follow up with Silverline Packag | - |
| 49 | ch_d3-5 | PERSON | single / lower | missed, 7 of 7 characters not covered | sandeep | Baner said they would sign by 13/01/19.⏎ | : Action items: rahul to send the contra | - |
| 50 | ch_d3-5 | PERSON | single / lower | missed, 5 of 5 characters not covered | rahul | ign by 13/01/19.⏎sandeep: Action items:  |  to send the contract, anjali to share t | - |

## Most common false positives (dev only)

| Detection | Times |
| --- | --- |
| DATE: 12/05/24 | 48 |
| ORG: IFSC | 8 |
| ORG: OBJECTIVE | 7 |
| ORG: Excel | 6 |
| ORG: Power BI | 6 |
| LOC: Main Road | 5 |
| ORG: Aadhaar | 5 |
| ORG: Com | 5 |
| ORG: SAP | 5 |
| ORG: Tally | 5 |
| PERSON: Er | 5 |
| LOC: Cross Road 3 | 4 |
| ORG: AutoCAD | 4 |
| ORG: Digital Marketing | 4 |
| ORG: EXPERIENCE | 4 |
| ORG: Salesforce | 4 |
| ORG: State Bank of India | 4 |
| ORG: Vendor | 4 |
| LOC: Lake View Road | 3 |
| LOC: Ring Road | 3 |
| ORG: Aadhaar No | 3 |
| ORG: CGPA | 3 |
| ORG: Punjab National Bank | 3 |
| LOC: Market Road | 2 |
| LOC: MG Road | 2 |
| LOC: Near | 2 |
| LOC: Near Old Water Tank | 2 |
| LOC: No | 2 |
| LOC: Old Airport Road | 2 |
| LOC: Plot | 2 |
| LOC: Rose Garden Road | 2 |
| LOC: Sector | 2 |
| LOC: Sector 9 | 2 |
| ORG: Bank | 2 |
| ORG: Computer Science | 2 |
| ORG: Digital | 2 |
| ORG: Engineering | 2 |
| ORG: IDFC FIRST Bank | 2 |
| ORG: Kotak Mahindra Bank | 2 |
| ORG: Marketing | 2 |
