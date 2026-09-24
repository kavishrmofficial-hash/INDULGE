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
               71-profile  photo, bio and details on Me and Person pages
               72-fixes    correction requests and the founder's queue
               73-log      the activity log tab and client side logging
               74-super    founder super controls
               75-radar    news, awards and watch channels
               76-base     the contacts and companies database, Apollo import
               77-safety   export and import a backup (both builds)
               78-search   master search, connections, the intelligence layer
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

## What is in v5

- **Logins that hold**: an invite link is tied to the email it was made for and asks for that email before it lets anyone in; sign-in links expire in minutes; every member sees their own devices in Me and can sign the others out; the founder can sign anyone out everywhere, lock the workspace, and switch joining to invite only.
- **Profiles**: photo, pronouns, city, bio, ask me about, links, phone, birthday and a fun fact, on Me and on every Person page.
- **Corrections**: a member asks for a fix (a check-in time, a leave balance, a task, their title) from Me; the founder approves or declines from Admin, and approved attendance or title fixes apply themselves.
- **Activity log**: every write and every sign-in is recorded per person per day (`log/<date>-<uid>`, ids only) and read from Admin > Log with filters, search and CSV export. On EdgeOne the server writes it, so it cannot be skipped.
- **Super controls** in Admin > Super: lock, join policy, an alert banner for everyone, view the OS as any member (preview only), fix anyone's attendance with a reason, offboard in one tap, export everything.
- **Radar**: a live news stream for agency business (India, awards, campaigns, business, platforms, creators) with watch keywords, save and share to Vibe, an awards season table, and Watch: YouTube channels with their latest videos playing inside m360. The live feeds run on the EdgeOne address; the claude.ai page shows the directories and the awards table.
- **Phone pass**: bottom sheets with a grab handle, bigger tap targets, snap scrolling board columns, no sideways scroll, and an add to home screen nudge. **Home hero**: a sun that moves with the time of day, a moon at night.

## What is in v6

- **Password sign-in on EdgeOne**: the founder's email is the super admin login; everyone sets their own password; forgotten ones are reset with a six digit code by email, or a code the founder hands over from the team list. Email links still work as an alternative. Passwords are stored only as PBKDF2 hashes on the server.
- **The safety net**: nothing is erased outright. Deleted documents go to a trash the founder can put back from; every day the server writes a backup of every collection and keeps 45 days; Admin > Backups downloads any day, restores a collection (missing only, or overwrite with the current copies trashed first) and runs an integrity check; the write path refuses malformed payloads and a roster write that would lock everyone out.
- **Base**: the database of everyone we know. People and companies, searchable by anyone on the roster and editable by anyone (every edit is logged with who and when). Import the monthly Apollo CSV: only the useful columns are mapped, duplicates merge, and a hand edit is never overwritten by an import. Companies map to clients both ways: make a client from a company, or map a company to an existing client, and clients created in Accounts find their company by name or domain.
- **Master search**: Cmd K searches across people, companies, tasks, projects, clients, pitches, posts, handbook, inbox and (for the founder) the log, with a full results drawer. Every client, company, contact, project and pitch shows its connections.
- **Intelligence**: Ask m360 can search the Base and everything else, answer "who do we know at", and pull the pipeline for a company. Ask the base on the Base page, quiet lead nudges, and an intro note drafted per contact.

## What is in v7

- **Moving between addresses**: Admin > Backups > Download the site backup gives one file with every document and every login (password hashes, never keys). A brand new deployment's setup screen has "Restore a site backup": upload the file and everyone signs in with the password they had. The server keeps a fresh site copy daily.
- **Client brain**: a logo (uploaded, or the site's own), website, industry, socials; a company brain the model builds from the client's own website (read by the server) plus what the team already noted, editable field by field; news mentions from Radar; a one tap meeting prep note; a health line with the reason.
- **Every change kept**: before any document is changed on EdgeOne, the version being replaced is stored (30 versions for 30 days, per document). Admin > Backups > Every change lists them with View and Revert to this, and every log row has a Versions link.
- **Breathe** rebuilt: the orb grows from small on the first breath and moves with the count, a four count inside it, a ring for the minute, phase dots, and Go again.

## What is in v8

- **The mark everywhere**: the home screen icon, favicons and the link preview are the m360 mark in black on white, rendered from the same SVG the app uses (`edgeone/public/icons`). Invite, sign-in and reset emails open with the mark from the site that sent them. The Breathe screen carries it too. Anyone who added m360 to a phone before this release removes the shortcut and adds it again to pick up the new icon.
- **The buddy follows again**: the pointer glides after the mouse whenever the buddy is on and only pins to a target during a tour hop; it fades after a few idle seconds. Touch does not drag it. Spoken answers are short and conversational, with a Talk button in the ask bubble.
- **A real voice**: Admin > The buddy's voice takes an ElevenLabs key and picks a warm voice; the server fetches and caches each line for a week. Without a key the browser's best natural voice is used. Prefs > The buddy speaks turns it off.

## What is in v9

- **The onboarding tour**: the buddy walks a new person through the place, out loud, section by section: check in, the EOD line, New, Search, Inbox, Focus, Work, Accounts, Base, Vibe, Radar, Me, then itself (HQ and Admin for the founder). It offers itself once on a first sign in, moves on by itself after each line when the voice is on, and replays from Me > Prefs > Show me around or the palette. Script in `57-tour.js`.
- **The buddy, rebuilt**: a flame character with a face that looks where it is going, rides the mouse on a spring with a trail, flies to controls on an arc and lands with a pop, and talks with its mouth moving. The bubble rides along on a leash and holds still under your hand. It now does things when asked: `click` and `type_into` tools (never on delete, remove, offboard, restore, approve or sign out, those it points at), keeps the last few turns of the chat, listens for a follow up after a spoken answer, and takes a hold on the Ask m360 button as talk on phones.
- **The voice** resolves when a line has been heard, so the tour and the mouth stay in step. Server lines are cached for 30 days, so the ElevenLabs free tier covers a team.

## Launch day

1. Admin > Team: invite each person by email. They get a link, type their email and pick a password. Without an email key the invite shows a link to copy instead.
2. Admin > AI: the Anthropic key. Without it the buddy, the brief and every writer are off.
3. Admin > The buddy's voice: an ElevenLabs key (free tier) for the natural voice. Otherwise the browser voice speaks.
4. Everyone adds m360 to their phone home screen from Safari or Chrome (Share, Add to Home Screen).
5. The first sign in offers the tour. Say yes.
6. Admin > Backups: download the site backup once the team is in, and keep it somewhere else.

## Keeping it safe

- Claim the EdgeOne project or set `EDGEONE_API_TOKEN` so deploys go to one stable project. An anonymous deploy is a new project with an empty store every time, and it is removed an hour after it is made unless claimed. The claude.ai artifact keeps its database across republishes; only the EdgeOne address changes.
- Before a move, download the site backup from Admin > Backups. On the new address choose Restore a site backup on the setup screen, then re-enter the AI and email keys in Admin.
- The daily backup runs on the server. Download one from Admin > Backups every week and keep it somewhere else too.
- Admin > Super > Export everything and Admin > Safety > Import a backup work on both builds.

## The cursor buddy

`58-buddy.js` is m360's own take on a Clicky style AI cursor. A small flame pointer follows the mouse. Hold Ctrl plus Option (Ctrl plus Alt on Windows) to talk, or tap Ask m360 bottom right to type. Every question is sent with a list of the controls on screen (each tagged `data-ai`), and the model answers through the tools `point_at` (the pointer flies to the control and rings it), `go_to` (opens a section) and the task tools from `04-ai.js`. It never clicks for you. Voice uses the browser's speech recognition where the frame allows it and falls back to typing. Spoken answers go through `80-voice.js` (`M.speech`): the server voice on EdgeOne when a key is set, else the browser's best natural voice.

## EdgeOne Pages (standalone)

The same app also runs on its own at an EdgeOne Pages address, outside Claude. `src/standalone/shim.js` gives the page the `window.claude` contract it expects, backed by one API function:

```
edgeone/public/                      the built page (python3 build_edgeone.py), React, ReactDOM and htm pinned locally
edgeone/cloud-functions/api/m360.js  POST /api/m360 {a: action}: sign in, documents, sync, presence, AI
edgeone/server/core.js               the actions, the access rules from capabilities.json, the first-run seed
edgeone/dev/server.mjs               a local stand-in with a file-backed store, for tests
```

- Storage is the project's EdgeOne Pages Blob store, one blob per document, so writes to different documents never collide. Pages poll every 3 seconds for changed collections.
- The first person to open a fresh deployment types their name and email and becomes the founder; the workspace is seeded from `seed/seed.json`. A session is an HttpOnly cookie; a new device signs in by email (a one-time link lands in the inbox) or with a one-time link from Me (or from the founder, on the team list).
- Members join by invite. In Admin the founder types an email, an optional name, title and role, and gets a personal link (one use, 7 days). Opening it asks the person to confirm that email, then signs them in and puts them on the team with an employee id, no approval step. With email switched on the invite is sent for them; without it the founder sends the link by hand (WhatsApp works). Anyone without an invite can still tap Ask to join and wait for the founder, unless joining is switched to invite only in Admin > Super.
- Sessions are per device. Me lists your devices and signs the others out; the founder can sign anyone out everywhere from the team list, and deactivating someone ends their sessions at once. Email sign-in links last 20 minutes, founder-made links 24 hours.
- Email goes through Resend: the `RESEND_API_KEY` and `MAIL_FROM` environment variables, or a key pasted once by the founder in Admin (kept on the server, never sent to a page). Without it, sign-in by email is off and the invite card hands out links instead.
- AI runs through the function with an Anthropic key: the `ANTHROPIC_API_KEY` environment variable in the EdgeOne console, or pasted once by the founder in Admin (kept on the server, never sent to a page). Without a key the AI buttons stay hidden.
- Google connectors exist only inside Claude, so the Your day card is hidden here.

Deploys run from `.github/workflows/deploy-edgeone.yml`. With the `EDGEONE_API_TOKEN` repository secret, every push updates the project named by the `EDGEONE_PROJECT` variable (default `m360os`). Without it, a commit message containing `[deploy]` makes an anonymous deployment that has to be claimed within an hour from the link in the run summary.

```
python3 harness/tests/test_edgeone.py   # browsers against the local stand-in: setup, join, sync, rules, links, invites, passwords, devices, AI
python3 harness/tests/test_safety.py    # trash, backups, restore, integrity, import
python3 harness/tests/test_radar.py     # news, awards and watch against canned feeds
```
