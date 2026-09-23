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
               59-mic   a talk button (speech to text)
               62-palette  Cmd K: search anything, run anything, or ask AI
               63-inbox    what happened to you, derived live
               64-focus    the focus timer and deep work hours
               65-reviews  the creative approval queue
               66-calendar a month of everything with a date
               67-badges   the trophy case and celebrations
               68-breathe  sixty seconds of box breathing
               69-tape     HQ's live tape and the mood heatmap
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

## What is in v4

- **Cmd K palette**: find any task, project, client, person or handbook section, run any action (check in, new task, focus, breathe, theme), or hand the line to m360 AI.
- **Inbox**: assignments, approvals and send backs, kudos, mentions, leave decisions, announcements, polls and join requests, derived from data you can already see. Only "last looked" is stored.
- **Reviews**: everything in review with Approve and Send back (a note, a revision, an inbox item for the owner). Founder and project owners review.
- **Board drag and drop** with the same bookkeeping as the drawer; **@mentions** in comments.
- **Focus timer**: 25, 45 or 90 minutes on a task, banked as deep work in `me/<uid>.focus`.
- **Calendar**: due dates, project deadlines, approved leave, holidays, birthdays and anniversaries.
- **Polls** on the feed, votes in each voter's `votes/<uid>.polls`.
- **Trophy case** (14 trophies earned from real work), **birthdays and anniversaries** with one tap wishes.
- **Breathe**: a one minute box breathing screen. **The tour**: the cursor buddy walks you around.
- **HQ**: the tape (today, newest first) and a three week mood heatmap. **Client update**: an AI written, client ready status note.
- **Look and feel**: paper by day and ink by night (auto, or pick), entrance motion, rolling numbers, a flame spark when something ships, tiny synthesized sounds (off in one tap), keyboard shortcuts (`?`), and on EdgeOne an installable phone app.

## The cursor buddy

`58-buddy.js` is m360's own take on a Clicky style AI cursor. A small flame pointer follows the mouse. Hold Ctrl plus Option (Ctrl plus Alt on Windows) to talk, or tap Ask m360 bottom right to type. Every question is sent with a list of the controls on screen (each tagged `data-ai`), and the model answers through the tools `point_at` (the pointer flies to the control and rings it), `go_to` (opens a section) and the task tools from `04-ai.js`. It never clicks for you. Voice uses the browser's speech recognition where the frame allows it and falls back to typing.

## EdgeOne Pages (standalone)

The same app also runs on its own at an EdgeOne Pages address, outside Claude. `src/standalone/shim.js` gives the page the `window.claude` contract it expects, backed by one API function:

```
edgeone/public/                      the built page (python3 build_edgeone.py), React, ReactDOM and htm pinned locally
edgeone/cloud-functions/api/m360.js  POST /api/m360 {a: action}: sign in, documents, sync, presence, AI
edgeone/server/core.js               the actions, the access rules from capabilities.json, the first-run seed
edgeone/dev/server.mjs               a local stand-in with a file-backed store, for tests
```

- Storage is the project's EdgeOne Pages Blob store, one blob per document, so writes to different documents never collide. Pages poll every 3 seconds for changed collections.
- The first person to open a fresh deployment types their name and becomes the founder; the workspace is seeded from `seed/seed.json`. Everyone after that types their name, taps Ask to join, and the founder lets them in. A session is an HttpOnly cookie; a new device signs in with a one-time link from Me (or from the founder, on the team list).
- AI runs through the function with an Anthropic key: the `ANTHROPIC_API_KEY` environment variable in the EdgeOne console, or pasted once by the founder in Admin (kept on the server, never sent to a page). Without a key the AI buttons stay hidden.
- Google connectors exist only inside Claude, so the Your day card is hidden here.

Deploys run from `.github/workflows/deploy-edgeone.yml`. With the `EDGEONE_API_TOKEN` repository secret, every push updates the project named by the `EDGEONE_PROJECT` variable (default `m360os`). Without it, a commit message containing `[deploy]` makes an anonymous deployment that has to be claimed within an hour from the link in the run summary.

```
python3 harness/tests/test_edgeone.py   # two browsers against the local stand-in: setup, join, sync, rules, links, AI
```
