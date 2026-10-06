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
- Model: runs in a Web Worker via transformers.js, cached after first download. Chosen after a bake-off (result goes here).
- Fail-closed: if the model fails or detection errors, show "names NOT checked" and require one explicit acknowledgment before copy. Rules-only works while the model loads, with that state visible.
- Resumes: employers/schools kept by default, toggle to mask. Personal-details block detected by label.
- Chunk long text with overlap, merge spans.
- Always-mask list: user-defined, session only.

## Success
Hard gates: local-proof test passes; fail-closed test passes; validators tested; restore round-trip suite passes; three sample documents load; dev/frozen split exists and frozen set is run once; handoff file exists and everything is pushed.
Reported, not targeted: recall, precision, document-level leak rate per type and preset, counts beside every percentage, recall by naming pattern, hand-written set separately.
Labels: structured type with at least 95% recall on dev = "supported"; otherwise "best effort".
