# Rules for Claude Code on Scrub

## Privacy (non-negotiable)
- No network calls that involve user text. Ever.
- No analytics, error reporting, logging of text, text in URLs, or text in persistent storage.
- The only allowed network request is the one-time model file download.

## How to work
- Read SPEC.md first. It holds all decisions. Do not research or change decisions; if something is missing, ask me.
- One task per session. Plan first, show me the plan, wait for my OK.
- Write tests first, then the code, then run the tests.
- Ask before adding any dependency. Pin versions and keep the lockfile.
- Make small commits with clear messages.
- Explain every change in plain English, for a non-coder.
- End every task with: "How to check this by hand" (steps I can do in a browser or terminal).
- Never paste or create large data or model files in the chat.

## Code
- TypeScript + Vite, vanilla UI (no framework), Vitest for tests, Playwright for the browser test.
- Detection engine lives in /src/engine with no UI imports.
- UI lives in /src/ui. Tests sit next to the code they test.
- Accessible by default: keyboard use, highlights not shown by colour alone, mobile first.
- MIT license for my code.

## Honesty
- Copy in the UI and docs must say "reduces what you expose", never "anonymous" or "compliant".
