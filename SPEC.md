# Scrub spec
Browser-only tool: masks personal details before pasting into an AI chatbot, restores them in the reply. Reduces exposure; no guarantee of anonymity. No legal-compliance claims.

## Scope
Presets: Resumes, Business emails, Chat logs/tickets/transcripts. India-focused English incl. romanised Indian names, light Hinglish.
Out of scope: other scripts, contracts, code, financial/medical/travel/HR docs, OCR, audio, spreadsheets, file upload, extension, Tier 2 IDs, alias grouping, offline mode, comparison with other redactors.

## Decisions
- Placeholders: [TYPE_N], e.g. [PERSON_1], [EMAIL_1]. Same value = same number.
- Mapping lives in memory only, for the session.
- Restore tolerates case, spacing, brackets, possessives ([person_1]'s, PERSON_1). Unknown tokens produce a warning.
- Precedence when detections overlap: (1) checksum-valid rule, (2) label/context rule, (3) other rule, (4) model. Longer span wins ties.
- Tier 1 types: EMAIL, PHONE, AADHAAR, PAN, GSTIN, IFSC, UPI, PIN, CARD, URL, IP, DATE, MONEY. BANK_ACCOUNT only near a context word (A/c, Account No, IFSC).
- Validators: Verhoeff (Aadhaar), Luhn (cards), GSTIN check character. [assumed: confirm with test vectors before relying]
- Model: Xenova/bert-base-NER (q8, about 110 MB), run via transformers.js in a Web Worker, cached after first download. Chosen from a 4-model bake-off on 81 invented names, strict scoring: 65 touched, 62 fully masked. ALL CAPS runs are shown to the model as a same-length title-case copy (the original text is never changed): 9 of 9 ALL CAPS names fully masked on the author's selection set (bakeoff/caps_results.md), and 4 of 24 headings falsely masked (5 of 24 without the copy). Lowercase chat is still 1 of 9 fully masked. These are selection data written by the author, so likely optimistic, not benchmark results. Labels: PER becomes PERSON; ORG and LOC are kept; MISC is ignored. The page decides which categories are masked (presets and the review checklist); the engine still detects everything.
- Fail-closed: if the model fails or detection errors, show "names NOT checked" and require one explicit acknowledgment before copy. Rules-only works while the model loads, with that state visible.
- Resumes: employers/schools kept by default, toggle to mask. Personal-details block detected by label.
- Chunk long text with overlap, merge spans.
- Always-mask list: user-defined, session only.

## Success
Hard gates: local-proof test passes; fail-closed test passes; validators tested; restore round-trip suite passes; three sample documents load; dev/frozen split exists and frozen set is run once; handoff file exists and everything is pushed.
Reported, not targeted: recall, precision, document-level leak rate per type and preset, counts beside every percentage, recall by naming pattern, hand-written set separately.
Labels: structured type with at least 95% recall on dev = "supported"; otherwise "best effort".

## Limits
- Names can be missed, especially in all-lowercase text and chat (1 of 9 fully masked in our small test).
- ALL CAPS lines that are not names can get a false mask, for example "THANK YOU FOR YOUR BUSINESS". A single ALL CAPS word is never changed, so "NAME: RAHUL" is not helped.
- Numbers that look like IDs can be masked by mistake, and real ones can be missed. Checksum test vectors are still marked as assumed.
- Bank account numbers are found only next to words like A/c or Account No.
- Only English with light Hinglish and Indian-style names. Other scripts, contracts, code, financial, medical, travel and HR documents are not supported.
- The Resumes preset leaves organisations and places visible by default. You can change this.
- Unticking a value in the review list leaves it visible everywhere it appears. That is your choice, and Scrub does not warn about it.
- Placeholder numbers can change when you tick or untick a value, so restore a reply only against the latest scrubbed text.
- Your device, browser and extensions are trusted. Hugging Face sees your IP address once, when the model downloads.
- Scrub reduces what you expose. It does not make anything anonymous.
