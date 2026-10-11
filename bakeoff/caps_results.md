# ALL CAPS experiment (P6c) results

Model: Xenova/bert-base-NER (q8), real browser, run with `bakeoff-caps.html`. Selection data written by the author, so likely optimistic.

| Transform | ALL CAPS names touched | ALL CAPS names fully masked | Headings with a false PERSON/ORG/LOC mask |
|---|---|---|---|
| off | 3 of 9 | 0 of 9 | 5 of 24 |
| on  | 9 of 9 | 9 of 9 | 4 of 24 |

Headings masked, off: DECLARATION, EDUCATION, TECHNICAL SKILLS (only "TECHNICAL"), INTERNSHIP, ACADEMIC QUALIFICATION.
Headings masked, on: DECLARATION, EDUCATION, INTERNSHIP, THANK YOU FOR YOUR BUSINESS.

Decision rule (fixed beforehand): adopt only if fully masked goes from 0 of 9 to at least 6 of 9 AND false masks rise by no more than 3. Result: adopted.

By design, a single caps word is never changed, so "NAME: RAHUL" is not helped (punctuation ends a run).
