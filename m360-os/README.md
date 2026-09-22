# m360 OS

The internal operating system for Mask360, built as one self-contained HTML page and published as a claude.ai artifact. The brief is in `BRIEF.md`; the module contract every feature file follows is in `CONTRACT.md`.

## Layout

```
assets/        Space Grotesk woff2 (latin) and the rupee glyph subset
src/css.css    the design system (tokens, components, layout)
src/mark.svg   the m360 mark, inlined by the build
src/js/        the app, concatenated in filename order:
               00-core  01-ui  02-state  03-shell  04-ai  (foundation)
               05-rules 06-points                  (engines)
               11..41   feature pages and parts
               50-home  your dashboard (Home)
               51-sections  Work, Accounts, Vibe, Me, Admin
               55-hq    founder intelligence (HQ)
               57-ask   the Ask chat drawer (Cmd or Ctrl K)
               58-buddy the m360 cursor buddy (hold Ctrl Option)
               99-app   boot and mount
seed/          seed.json generated from BRIEF section 13 (make_seed.py)
harness/       local QA only, never shipped: mock window.claude, Playwright helpers, tests
build.py       assembles dist/index.html and asserts the copy rules
```

## Build

```
python3 build.py                      # dist/index.html, the artifact page
M360_MODULES=11-checkin.js M360_TAG=checkin python3 build.py   # core plus one module, for isolated tests
```

The build fails when the page contains an em dash, an en dash, or a `window.alert`, `confirm` or `prompt` call.

## Local QA

The page runs against a mock `window.claude` that enforces the section 5 database rules, offers four identities (`?as=founder|m1|m2|m3|outsider`), mock connectors with per-server error codes, and a downloads recorder. Everything persists in localStorage.

```
pip install playwright==1.56.0 --break-system-packages
python3 harness/smoke.py              # every page at 390, 768 and 1280 as founder and member
python3 harness/tests/test_<module>.py
python3 harness/qa.py                 # every section as founder and members at 390, 768 and 1280
python3 harness/conformance.py        # copy, design tokens, db rules, routes
python3 harness/shot.py               # screenshots into harness/shots
```

## Publish

Publish `dist/index.html` with the Artifact tool, title "m360 OS", with the capabilities in `capabilities.json`, then seed the database with `seed/seed.json` (one batch write) and read it back.

## The cursor buddy

`58-buddy.js` is m360's own take on a Clicky style AI cursor. A small flame pointer follows the mouse. Hold Ctrl plus Option (Ctrl plus Alt on Windows) to talk, or tap Ask m360 bottom right to type. Every question is sent with a list of the controls on screen (each tagged `data-ai`), and the model answers through the tools `point_at` (the pointer flies to the control and rings it), `go_to` (opens a section) and the task tools from `04-ai.js`. It never clicks for you. Voice uses the browser's speech recognition where the frame allows it and falls back to typing.
