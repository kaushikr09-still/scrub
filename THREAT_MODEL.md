# Threat model

Scrub reduces what you expose. It does not make anything anonymous.

## What Scrub protects
Personal details in text you paste into an AI chatbot are swapped for placeholders like [EMAIL_1] in your browser, so the chatbot sees the placeholders instead.
Your text is never sent anywhere by this page and is not saved; the mapping lives in memory until you reload.

## What it does not protect
- A lookalike number may be a real one, and a real one may be missed or wrongly masked.
- Names can be missed, especially in all-lowercase text.
- Your device and browser are trusted. Malware, extensions or someone looking at your screen are out of scope.

## What the site and Hugging Face can see
- Hugging Face sees the visitor's IP address (and the usual request details) when the name model downloads, once, then it is cached on the device.
- Our host sees normal page requests only. It never receives your text.

## Why the CSP allows two outside hosts
The CSP (`vercel.json`) allows connections to exactly `https://huggingface.co` and `https://us.aws.cdn.hf.co`, and nothing else outside the site.
These are the model download address and the file host it redirects to.

## Checks that back each claim
- Headers are really served (CSP, Referrer-Policy, nosniff): `e2e/headers.spec.ts`, "page response has the headers from vercel.json".
- No request is made once text is entered, and the CSP and the request recorder are proven to work: `e2e/privacy.spec.ts`, "no leaks".
- If the model cannot load, names are flagged as NOT checked and Copy needs a tick first: `e2e/privacy.spec.ts`, "fail-closed".
- Placeholders in a chatbot reply return the real values: `e2e/privacy.spec.ts`, "restore".

## Known limits
See the "What it does not do" section of README.md and the Limits section of SPEC.md.
