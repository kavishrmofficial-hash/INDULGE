# m360 OS

The internal operating system for Mask360, built as one self-contained HTML page and published as a claude.ai artifact. The brief is in `BRIEF.md`; the module contract every feature file follows is in `CONTRACT.md`.

## Layout

```
assets/        Space Grotesk woff2 (latin) and the rupee glyph subset
src/css.css    the design system (tokens, components, layout)
src/mark.svg   the m360 mark, inlined by the build
src/js/        the app, concatenated in filename order:
               00-core  01-ui  02-state  03-shell  (foundation)
               05-rules 06-points                  (engines)
               10..41   feature pages and parts
               99-app   boot and mount
seed/          seed.json generated from BRIEF section 13 (make_seed.py)
harness/       local QA only, never shipped: mock window.claude, Playwright helpers, tests
build.py       assembles dist/index.html and asserts the copy rules
```

## Build

```
python3 build.py                      # dist/index.html, the artifact page
M360_MODULES=10-today.js M360_TAG=today python3 build.py   # core plus one module, for isolated tests
```

The build fails when the page contains an em dash, an en dash, or a `window.alert`, `confirm` or `prompt` call.

## Local QA

The page runs against a mock `window.claude` that enforces the section 5 database rules, offers four identities (`?as=founder|m1|m2|m3|outsider`), mock connectors with per-server error codes, and a downloads recorder. Everything persists in localStorage.

```
pip install playwright==1.56.0 --break-system-packages
python3 harness/smoke.py              # every page at 390, 768 and 1280 as founder and member
python3 harness/tests/test_<module>.py
python3 harness/qa.py                 # the section 14 founder, member and outsider flows
```

## Publish

Publish `dist/index.html` with the Artifact tool, title "m360 OS", with the capabilities in `capabilities.json`, then seed the database with `seed/seed.json` (one batch write) and read it back.
