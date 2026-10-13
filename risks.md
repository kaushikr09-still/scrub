# Scrub: risk list

Status words: **verified** means tested or read from a source. **Assumed** means believed but not checked. Last updated 13 October 2026.

## 1. Risks to people using it

| Risk | Impact | What exists today | Status | What I'd do next |
|---|---|---|---|---|
| Something stays visible after Scrub. On the frozen test, 38 of 72 documents had at least one detail left. | High | The README leads with this number. The page asks the user to review the output and shows a review checklist. | Verified (frozen test) | Test on real, consented documents. Improve lowercase and initials handling. |
| Users trust it too much and paste without reading. | High | No "anonymous", "safe" or "compliant" wording anywhere. The limits are written on the page and in the README. | Verified (wording scan in tests covers the page, not the README) | Add a short reminder next to the Copy button. |
| Lowercase names in chats are not caught (1 of 28). | High for the chat preset | Notice on the page warns about all-lowercase text. | Verified | Try a second pass or a model built for this. |
| Wrong things get masked (organisations 78% precise, places 70%). | Low to medium | The checklist lets users untick any row. The Resumes preset leaves organisations and places visible. | Verified | Better rules for headings and bank names. |
| A masked reply is restored wrongly if the user unticks something after copying. | Medium | The page clears the restore box and explains. | Verified (unit and browser tests) | Keep placeholder numbers stable across changes. |

## 2. Privacy and security risks

| Risk | Impact | What exists today | Status | What I'd do next |
|---|---|---|---|---|
| Hugging Face sees the visitor's IP address when the model downloads. | Low | Written in the README and THREAT_MODEL.md. The text itself never leaves the page. | Verified | Host the model file on my own site if a licence and size allow it. |
| The page could be changed to send text out. | High | Strict content security policy. A browser test fails if any request leaves while scrubbing, and it proves its own safety net works. | Verified (browser tests) | Re-run the test on every change. |
| The model fails to load or is blocked. | Medium | Fail-closed: "names NOT checked", and Copy needs a tick. | Verified (browser test) | None needed now. |
| The model hosts change their addresses, so downloads fail. | Medium | Fails safe (the above). The content security policy names exactly two hosts. | Assumed that the two hosts stay stable | Watch for failures. Consider self-hosting. |
| A browser extension or malware on the user's device reads the text. | High, but outside my control | Stated as out of scope in THREAT_MODEL.md. | Verified (documented) | None. Can't be fixed here. |
| A build tool pinned by the model library is a development-tagged version (onnxruntime-web). | Low | Pinned to an exact version. | Verified | Move to a stable release when the library does. |

## 3. Technical risks

| Risk | Impact | What exists today | Status | What I'd do next |
|---|---|---|---|---|
| Slow on phones. Only a laptop was timed (about 18 s for 1,500 words). The model is about 110 MB. | Medium | The page shows progress while the model loads. | Phone speed assumed, laptop verified | Test on one Android and one iPhone and record the times. |
| Only tested in Firefox and Chromium. Safari and iOS untested. | Medium | None. | Not tested | Check Safari/iPhone before promoting. |
| Checksum rules wrongly accept random numbers: about 1 in 10 random 13–19 digit numbers passes the card check. | Low | Listed as a limit. Sample numbers were chosen not to collide. | Verified | Add more context checks near card numbers. |
| Aadhaar with one wrong digit is not masked. | Medium | Listed as a limit. The checksum is required by design. | Verified | Offer a "mask near the word Aadhaar" option. |
| The GSTIN check-character rule was worked out from the published algorithm and not confirmed against an official GSTN document. | Low | Checked against my own test numbers. | **Assumed** | Confirm against an official source. |
| Numbers stuck to letters (`Call9876543210`) slip through. | Low | Listed as a limit. | Verified | A looser phone rule, measured first. |

## 4. Risks to the evidence

| Risk | Impact | What exists today | Status | What I'd do next |
|---|---|---|---|---|
| The benchmark documents come from templates I wrote, so real text will score worse. | High for any claim | Stated in the README, the report and the case study. | Verified | A small set of real, consented documents. |
| Dev and test share some wording habits ("Dear", "Regards", "Father's Name"). | Medium | Different template families, no shared long lines (checked by script). | Verified | A third set written by someone else. |
| I tuned on the dev set, so dev numbers are optimistic. | Medium | The headline uses the frozen test, run once. | Verified | Keep the frozen set frozen. |
| Fake ID numbers are valid by checksum, so one could match a real person's number by chance. | Low | Said in the README credits. | Verified | None. |
| Small samples: several types have only 8 examples. | Medium | Counts and 95% ranges shown beside every percentage. | Verified | Generate more documents per template. |
| The model's training data (English news) has its own terms, which I haven't reviewed. | Low to medium | Said in the README credits. | **Assumed** | Read the dataset terms. |

## 5. Project and communication risks

| Risk | Impact | What exists today | Status | What I'd do next |
|---|---|---|---|---|
| Claims in the README drift away from the code as it changes. | Medium | The numbers are tied to a git commit and a data hash in `eval/results/test.md`. | Verified | Re-run the benchmark only as a new, labelled run. |
| Deployments sometimes don't trigger from a push. | Low | Empty commit as a nudge. | Verified (happened twice) | Check the Vercel connection when it recurs. |
| Claude Code access ends, so changes later need another route. | Medium | `HANDOFF.md` explains the benchmark steps. The tests are in the repo. | Verified | Make small fixes by hand or with another tool, and re-run `npm test` and `npm run test:e2e` each time. |
| Someone treats this as legal or compliance protection. | High | The README says it reduces exposure and gives no guarantee. I am not giving legal advice. | Verified | Keep the wording. Never add compliance claims. |

## The three that matter most

1. Something stays visible in about half of documents. The tool helps, and it needs a person to check the result.
2. All numbers come from invented documents.
3. Phones and Safari are untested.
