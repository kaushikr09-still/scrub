# Scrub evaluation: dev split

- Code version (git commit): 4b931237d38a05cb407a76d4005b17c195133c7d
- Split: dev
- Run date and time: 2026-10-12T16:59:47.684Z
- Model: Xenova/bert-base-NER (q8)
- Documents: 72
- SHA-256 of the scored file: d94d4873ad2753bb4fe246e6a17065753bbb2411bafe329f70e40bd5554c0ef3
- File on disk now: same SHA-256 as the scored file
- Run time: 142.3 seconds

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
| Recall: truth spans fully masked | 726 of 1200 (60.5%, 95% CI 57.7% to 63.2%) |
| Type-correct recall: fully masked by detections of the right type | 699 of 1200 (58.3%, 95% CI 55.4% to 61.0%) |
| Truth spans partly masked (counted as leaks) | 21 of 1200 |
| Truth spans missed completely | 453 of 1200 |
| Document leak rate: documents with at least one span not fully masked | 66 of 72 (91.7%, 95% CI 83.0% to 96.1%) |
| Precision: true detections out of true plus false positives | 708 of 833 (85.0%, 95% CI 82.4% to 87.3%) |
| All detections | 878 (true 708, type mismatch 45, false positive 125) |

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
| LOC | 176 | 66 of 176 (37.5%, 95% CI 30.7% to 44.8%) | 62 of 176 (35.2%, 95% CI 28.6% to 42.5%) | 2 | 108 |
| MONEY | 48 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 0 | 0 |
| ORG | 168 | 42 of 168 (25.0%, 95% CI 19.1% to 32.1%) | 42 of 168 (25.0%, 95% CI 19.1% to 32.1%) | 3 | 123 |
| PAN | 24 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) | 0 | 0 |
| PERSON | 352 | 117 of 352 (33.2%, 95% CI 28.5% to 38.3%) | 99 of 352 (28.1%, 95% CI 23.7% to 33.0%) | 13 | 222 |
| PHONE | 96 | 93 of 96 (96.9%, 95% CI 91.2% to 98.9%) | 92 of 96 (95.8%, 95% CI 89.8% to 98.4%) | 3 | 0 |
| PIN | 32 | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) | 0 | 0 |
| UPI | 16 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) | 0 | 0 |
| URL | 48 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) | 46 of 48 (95.8%, 95% CI 86.0% to 98.8%) | 0 | 0 |

### Recall by preset

| Preset | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| chats | 344 | 214 of 344 (62.2%, 95% CI 57.0% to 67.2%) | 209 of 344 (60.8%, 95% CI 55.5% to 65.8%) | 1 | 129 |
| emails | 400 | 308 of 400 (77.0%, 95% CI 72.6% to 80.9%) | 297 of 400 (74.3%, 95% CI 69.7% to 78.3%) | 6 | 86 |
| resumes | 456 | 204 of 456 (44.7%, 95% CI 40.2% to 49.3%) | 193 of 456 (42.3%, 95% CI 37.9% to 46.9%) | 14 | 238 |

### Recall by PERSON pattern

| Pattern | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| full | 112 | 39 of 112 (34.8%, 95% CI 26.6% to 44.0%) | 29 of 112 (25.9%, 95% CI 18.7% to 34.7%) | 13 | 60 |
| honorific | 40 | 11 of 40 (27.5%, 95% CI 16.1% to 42.8%) | 10 of 40 (25.0%, 95% CI 14.2% to 40.2%) | 0 | 29 |
| initials_first | 8 | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 | 8 |
| initials_last | 8 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) | 3 of 8 (37.5%, 95% CI 13.7% to 69.4%) | 0 | 0 |
| multipart | 8 | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 of 8 (0.0%, 95% CI 0.0% to 32.4%) | 0 | 8 |
| single | 176 | 59 of 176 (33.5%, 95% CI 27.0% to 40.8%) | 57 of 176 (32.4%, 95% CI 25.9% to 39.6%) | 0 | 117 |

### Recall by PERSON case style

| Case style | Spans | Recall (fully masked) | Type-correct recall | Partly masked | Missed |
| --- | --- | --- | --- | --- | --- |
| lower | 51 | 0 of 51 (0.0%, 95% CI 0.0% to 7.0%) | 0 of 51 (0.0%, 95% CI 0.0% to 7.0%) | 0 | 51 |
| title | 274 | 107 of 274 (39.1%, 95% CI 33.5% to 44.9%) | 92 of 274 (33.6%, 95% CI 28.2% to 39.4%) | 12 | 155 |
| upper | 27 | 10 of 27 (37.0%, 95% CI 21.5% to 55.8%) | 7 of 27 (25.9%, 95% CI 13.2% to 44.7%) | 1 | 16 |

### Document leak rate by preset

| Preset | Documents with a leak |
| --- | --- |
| chats | 23 of 24 (95.8%, 95% CI 79.8% to 99.3%) |
| emails | 19 of 24 (79.2%, 95% CI 59.5% to 90.8%) |
| resumes | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) |

### Precision by detected type

| Detected type | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| AADHAAR | 13 | 8 | 5 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| BANK_ACCOUNT | 14 | 14 | 0 | 0 | 14 of 14 (100.0%, 95% CI 78.5% to 100.0%) |
| DATE | 144 | 96 | 0 | 48 | 96 of 144 (66.7%, 95% CI 58.6% to 73.8%) |
| EMAIL | 82 | 80 | 2 | 0 | 80 of 80 (100.0%, 95% CI 95.4% to 100.0%) |
| GSTIN | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| IFSC | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| IP | 8 | 8 | 0 | 0 | 8 of 8 (100.0%, 95% CI 67.6% to 100.0%) |
| LOC | 95 | 63 | 5 | 27 | 63 of 90 (70.0%, 95% CI 59.9% to 78.5%) |
| MONEY | 48 | 48 | 0 | 0 | 48 of 48 (100.0%, 95% CI 92.6% to 100.0%) |
| ORG | 109 | 43 | 29 | 37 | 43 of 80 (53.8%, 95% CI 42.9% to 64.3%) |
| PAN | 24 | 24 | 0 | 0 | 24 of 24 (100.0%, 95% CI 86.2% to 100.0%) |
| PERSON | 122 | 106 | 3 | 13 | 106 of 119 (89.1%, 95% CI 82.2% to 93.5%) |
| PHONE | 93 | 92 | 1 | 0 | 92 of 92 (100.0%, 95% CI 96.0% to 100.0%) |
| PIN | 32 | 32 | 0 | 0 | 32 of 32 (100.0%, 95% CI 89.3% to 100.0%) |
| UPI | 16 | 16 | 0 | 0 | 16 of 16 (100.0%, 95% CI 80.6% to 100.0%) |
| URL | 46 | 46 | 0 | 0 | 46 of 46 (100.0%, 95% CI 92.3% to 100.0%) |

### Precision by preset

| Preset | Detections | True | Type mismatch | False positive | Precision |
| --- | --- | --- | --- | --- | --- |
| chats | 268 | 209 | 6 | 53 | 209 of 262 (79.8%, 95% CI 74.5% to 84.2%) |
| emails | 364 | 302 | 16 | 46 | 302 of 348 (86.8%, 95% CI 82.8% to 89.9%) |
| resumes | 246 | 197 | 23 | 26 | 197 of 223 (88.3%, 95% CI 83.5% to 91.9%) |

### Type mismatches (still protective, listed separately)

| Detected as -> truth type | Detections |
| --- | --- |
| AADHAAR -> BANK_ACCOUNT | 1 |
| AADHAAR -> PHONE | 4 |
| EMAIL -> URL | 2 |
| LOC -> PERSON | 5 |
| ORG -> LOC | 4 |
| ORG -> PERSON | 25 |
| PERSON -> LOC | 1 |
| PERSON -> ORG | 2 |
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
| 1 | ch_d2-6 | PHONE | - / n/a | partial, 1 of 14 characters not covered | +91-9486368959 | ail: chopra.mohammed@hotmail.com⏎Phone:  | ⏎Company: Bluepeak Software Pvt Ltd⏎⏎Des | AADHAAR |
| 2 | res_d2-5 | PHONE | - / n/a | partial, 1 of 14 characters not covered | +91-8153084236 |  Project Coordinator⏎Dwarka, Indore  \|   |   \|  s.thomas@outlook.com  \|  https://ww | AADHAAR |
| 3 | res_d3-7 | PHONE | - / n/a | partial, 1 of 14 characters not covered | +91-6400244792 | e Engineer, Vasant Retail Pvt Ltd - Ph:  |  | AADHAAR |
| 4 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 5 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya kavitasubramanian | - |
| 6 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | manian@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. pallavi ka number do na⏎[12/05/24, | - |
| 7 | ch_d1-1 | PERSON | single / lower | missed, 7 of 7 characters not covered | pallavi | .co.in⏎[12/05/24, 10:44 am] kavita: ok.  |  ka number do na⏎[12/05/24, 10:44 am] so | - |
| 8 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | vi ka number do na⏎[12/05/24, 10:44 am]  | : 62187-01918⏎[12/05/24, 10:47 am] kavit | - |
| 9 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | kavita | ourav: 62187-01918⏎[12/05/24, 10:47 am]  | : payment Rs.1,29,900 kal tak ho jayega, | - |
| 10 | ch_d1-1 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav |  UPI id vermaa@ybl⏎[12/05/24, 10:48 am]  | : done. order OD76454550 ka status check | - |
| 11 | ch_d1-2 | PERSON | single / title | missed, 6 of 6 characters not covered | Rajesh | r.bora@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. Venkatesh ka number do na⏎[12/05/2 | - |
| 12 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 13 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya dorjee.sourav@red | - |
| 14 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | rav@rediffmail.com⏎[12/05/24, 10:44 am]  | : ok. nikhil ka number do na⏎[12/05/24,  | - |
| 15 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | nikhil | il.com⏎[12/05/24, 10:44 am] sourav: ok.  |  ka number do na⏎[12/05/24, 10:44 am] zo | - |
| 16 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | il ka number do na⏎[12/05/24, 10:44 am]  | : 91 74645 85249⏎[12/05/24, 10:47 am] so | - |
| 17 | ch_d1-3 | PERSON | single / lower | missed, 6 of 6 characters not covered | sourav | ya: 91 74645 85249⏎[12/05/24, 10:47 am]  | : payment ₹1,07,300 kal tak ho jayega, U | - |
| 18 | ch_d1-3 | PERSON | single / lower | missed, 4 of 4 characters not covered | zoya | kavita.trivedi@ibl⏎[12/05/24, 10:48 am]  | : done. order OD84497826 ka status check | - |
| 19 | ch_d1-4 | PERSON | single / title | missed, 6 of 6 characters not covered | Vikram | preet.patel@okaxis⏎[12/05/24, 10:48 am]  | : done. order ORD-6955699 ka status chec | - |
| 20 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 21 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit | ari@rediffmail.com⏎[12/05/24, 10:44 am]  | : ok. Jyoti ka number do na⏎[12/05/24, 1 | - |
| 22 | ch_d1-5 | PERSON | single / title | missed, 5 of 5 characters not covered | Jyoti | mail.com⏎[12/05/24, 10:44 am] Amit: ok.  |  ka number do na⏎[12/05/24, 10:44 am] Im | - |
| 23 | ch_d1-5 | PERSON | single / title | missed, 4 of 4 characters not covered | Amit |  Imran: 6933921669⏎[12/05/24, 10:47 am]  | : payment ₹303,000 kal tak ho jayega, UP | - |
| 24 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 25 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya shruti23@gmail.co | - |
| 26 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti | shruti23@gmail.com⏎[12/05/24, 10:44 am]  | : ok. varun ka number do na⏎[12/05/24, 1 | - |
| 27 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | varun | il.com⏎[12/05/24, 10:44 am] shruti: ok.  |  ka number do na⏎[12/05/24, 10:44 am] ab | - |
| 28 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | un ka number do na⏎[12/05/24, 10:44 am]  | : 8863220133⏎[12/05/24, 10:47 am] shruti | - |
| 29 | ch_d1-6 | PERSON | single / lower | missed, 6 of 6 characters not covered | shruti |  abdul: 8863220133⏎[12/05/24, 10:47 am]  | : payment Rs.4,74,100 kal tak ho jayega, | - |
| 30 | ch_d1-6 | PERSON | single / lower | missed, 5 of 5 characters not covered | abdul | id zainab20@okaxis⏎[12/05/24, 10:48 am]  | : done. order ORD-2124050 ka status chec | - |
| 31 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Balaji | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 32 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | ice bhej diya kya?⏎[12/05/24, 10:43 am]  | : haan, abhi mail kiya balaji.kapoor@yah | - |
| 33 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Balaji | kapoor@yahoo.co.in⏎[12/05/24, 10:44 am]  | : ok. Tenzin ka number do na⏎[12/05/24,  | - |
| 34 | ch_d1-7 | PERSON | single / title | missed, 6 of 6 characters not covered | Tenzin | .co.in⏎[12/05/24, 10:44 am] Balaji: ok.  |  ka number do na⏎[12/05/24, 10:44 am] La | - |
| 35 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | in ka number do na⏎[12/05/24, 10:44 am]  | : 9993948094⏎[12/05/24, 10:47 am] Balaji | - |
| 36 | ch_d1-7 | PERSON | single / title | missed, 7 of 7 characters not covered | Lakshmi | PI id manoj921@ybl⏎[12/05/24, 10:48 am]  | : done. order SO-533758 ka status check  | - |
| 37 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | [12/05/24, 10:42 am]  | : bhai invoice bhej diya kya?⏎[12/05/24, | - |
| 38 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | nverma@hotmail.com⏎[12/05/24, 10:44 am]  | : ok. Yamini ka number do na⏎[12/05/24,  | - |
| 39 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Yamini | il.com⏎[12/05/24, 10:44 am] Naveen: ok.  |  ka number do na⏎[12/05/24, 10:44 am] Ad | - |
| 40 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Naveen | tya: 91 6320214912⏎[12/05/24, 10:47 am]  | : payment ₹21 LPA kal tak ho jayega, UPI | - |
| 41 | ch_d1-8 | PERSON | single / title | missed, 6 of 6 characters not covered | Aditya | UPI id iyers@paytm⏎[12/05/24, 10:48 am]  | : done. order SO-022877 ka status check  | - |
| 42 | ch_d2-1 | PERSON | full / title | missed, 16 of 16 characters not covered | Ishita Deshpande | : Open⏎Created: 23 March 2022⏎Customer:  | ⏎Email: ishitadeshpande@yahoo.co.in⏎Phon | - |
| 43 | ch_d2-1 | ORG | - / n/a | missed, 22 of 22 characters not covered | Tapestry Design Studio | yahoo.co.in⏎Phone: 06169607810⏎Company:  | ⏎⏎Description:⏎Customer reports that the | - |
| 44 | ch_d2-1 | PERSON | single / title | missed, 6 of 6 characters not covered | Ishita | 8 is blocked. Customer asked us to call  |  back on 64689-21331.⏎⏎Internal notes:⏎M | - |
| 45 | ch_d2-1 | PERSON | full / title | missed, 11 of 11 characters not covered | Mridul Bhat | a back on 64689-21331.⏎⏎Internal notes:⏎ |  (L2 support): checked logs, version 6.2 | - |
| 46 | ch_d2-1 | PERSON | initials_first / title | missed, 11 of 11 characters not covered | R. L. Bains | ecked logs, version 6.2.9. Escalated to  | .⏎Customer shared screenshot at https:// | - |
| 47 | ch_d2-2 | PERSON | full / title | missed, 9 of 9 characters not covered | Anita Rao | pen⏎Created: 20 January, 2025⏎Customer:  | ⏎Email: anita.rao@outlook.com⏎Phone: 784 | - |
| 48 | ch_d2-2 | ORG | - / n/a | missed, 29 of 29 characters not covered | Anantha Constructions Pvt Ltd | @outlook.com⏎Phone: 7843870421⏎Company:  | ⏎⏎Description:⏎Customer reports that the | - |
| 49 | ch_d2-2 | PERSON | single / title | missed, 5 of 5 characters not covered | Anita | 2 is blocked. Customer asked us to call  |  back on +91 64637 82084.⏎⏎Internal note | - |
| 50 | ch_d2-2 | PERSON | full / title | missed, 12 of 12 characters not covered | Kamala Patel | ck on +91 64637 82084.⏎⏎Internal notes:⏎ |  (L2 support): checked logs, version 8.1 | - |

## Most common false positives (dev only)

| Detection | Times |
| --- | --- |
| DATE: 12/05/24 | 48 |
| ORG: IFSC | 8 |
| ORG: Vendor | 4 |
| LOC: Cross Road 3 | 3 |
| LOC: Main Road | 3 |
| LOC: Ring Road | 3 |
| ORG: State Bank of India | 3 |
| PERSON: Hi | 3 |
| LOC: Near | 2 |
| LOC: Old Airport Road | 2 |
| LOC: Sector | 2 |
| ORG: Bank | 2 |
| ORG: Date | 2 |
| ORG: Place | 2 |
| ORG: Plot | 2 |
| ORG: Procurement | 2 |
| ORG: Punjab National Bank | 2 |
| PERSON: Er | 2 |
| PERSON: Shri | 2 |
| LOC: Canal Road | 1 |
| LOC: Flat 25 | 1 |
| LOC: Gandhi Marg | 1 |
| LOC: Lake View Road | 1 |
| LOC: Lakeview Park | 1 |
| LOC: Market Road | 1 |
| LOC: Near Old Water Tank | 1 |
| LOC: Nehru Street | 1 |
| LOC: No | 1 |
| LOC: Old Water Tank | 1 |
| LOC: Rose Petal Cinema | 1 |
| LOC: Sector 9 | 1 |
| ORG: Axis Bank | 1 |
| ORG: Bank of Baroda | 1 |
| ORG: Canara Bank | 1 |
| ORG: Flat | 1 |
| ORG: ICICI Bank | 1 |
| ORG: INC4210743 | 1 |
| ORG: knowledge | 1 |
| ORG: Kotak Mahindra Bank | 1 |
| ORG: share | 1 |
