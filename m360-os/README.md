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

## The launch audit (v9.2)

Three reviewers read the buddy, the server and the data flow between features; the findings that mattered are fixed:

- **Server**: an invite for an email that already has a login is refused, and accepting an invite can never take over an existing account or the owner. Every link in an email (invite, sign-in, reset) is built from the address the request came to, never from the caller. A reset code try is counted before it is checked, so parallel guesses cannot beat the limit. Unknown action names never reach built-in object methods. The client brain refuses wildcard DNS hosts that resolve into private address space.
- **Data**: a failed first load on EdgeOne is retried instead of running the page on an empty copy (which could have rewritten the roster); merge only creates a document when it is truly missing, never on a refused write. Un-voting an idea keeps your poll votes. Leave marked from Admin counts as leave for check-ins, rules and streaks. A client saved with a company links the company back. The AI's task moves do the same bookkeeping as a hand move. Private docs (state, keeper, finance) now re-render the moment they change.
- **Buddy and chat**: its own Escape press never closes it; the welcome offer is answered by Escape too; a closed bubble stops every tool; the tools are chosen by what you asked so a host cap never drops the one you need; a blocked audio play falls back to the browser voice; the shared chat thread unsubscribes properly and stays quiet in preview.

Closed in the same release: a second person with Full access reads shared founder docs from the owner (the roster remembers who owns the workspace) and keeps their own finance notes; the activity log prunes itself once a day (90 days on EdgeOne, the same from the founder's browser on the artifact); someone waiting to join sees that a roster exists but no names on it; an admin who is not the owner never sees another person's private docs in version history, the trash, backups or the site export.

## What is in v10 (day one feedback)

- **Everyone sees the same thing**: every write now stamps a strongly consistent marker per collection (`x/v/<coll>`) that sync reads alongside the blob listing, because an edge listing can lag a write for a while and people were seeing different client states. Restores and reverts stamp too. `test_sync.py` proves it against a listing sixty seconds stale.
- **CRM** under Accounts: Base companies, clients and pitch brands folded into one row each, with stage, owner, people, open pitches, open tasks, next step (overdue in flame), last touch and, for the founder, value in play. A pitch remembers its Base company when the names match.
- **Web**: a browser inside m360 with shared bookmarks (`links/team`). Sites that refuse a frame open in a new tab with one tap.
- **WFH allowance per person**: Admin > Team > edit a person > WFH days a week. Blank means the team default. Check-in and the WFH rule use it. WFH was never leave; leave stays leave.
- **The handbook** and the rest of Me stay listed in members' sidebars whichever section is open.

## What is in v11

- **Google Workspace** (`28-workspace.js`, `edgeone/server/google.js`): each person signs in with Google once (the OAuth code flow; the callback is `/api/google`), then Mail (inbox, unread, starred, sent, search, open, reply, new mail, archive), Calendar (today, 7 or 30 days, RSVP, New meeting with a Google Meet link and team invitees) and Drive (recent files, search) live under Workspace. Tokens stay on the server in `x/g/<uid>`; the OAuth client Kaavish makes in Google Cloud sits in `x/google` (Admin > Google Workspace has the steps and the exact redirect address). Choose Internal on the consent screen: a Workspace organisation gets no review and no token expiry.
- **Chat** (`29-chat.js`): rooms (general plus any the team makes) and direct messages. Messages live per room per sender (`chat/<room>:<uid>`) so nobody overwrites anybody; a direct message room (`dm.<a>.<b>`) is readable by those two alone, enforced on the server. Read marks in each person's private state, unread badges on Chat, DMs and mentions in the inbox, browser notices when the tab is hidden, edit and delete your own lines, @everyone.
- **Web, second pass** (`79-web.js`, `edgeone/server/web.js`): tabs, back and forward, reload, search from the bar. Before framing, the server asks the site whether it allows frames; a site that refuses opens as text with its links (the reader view) and one tap to open it outside. The **frame helper** (`extension/`, zipped to `m360-frame-helper.zip` at build) is a Chrome or Edge extension that strips the no-framing headers only inside m360 tabs; with it, most sites open inside. Google, Meet, LinkedIn, WhatsApp and Instagram refuse by script and always open outside; that is why Workspace goes through Google's API instead.

## What is in v12: the browser, properly

- **Laid out like Arc** (`79-web.js`): a rail on the left with the address, the team's spaces (bookmarks as app tiles with favicons) and the open tabs; the page on the right with back, forward, reload, the address pill and a full screen button. Full screen hides the rest of m360 and gives the page the whole window; Escape brings it back. Cmd L jumps to the address, Cmd T a new tab, Cmd W closes one.
- **Links stay inside**: any link in m360 that would have opened a browser tab (a news story, a link in chat, a file) opens as a tab in the Web section instead (`M.web.open`). Sites that always refuse frames still go outside.
- **The frame helper, 1.1** (`extension/`): a link a framed site tries to pop out comes back into m360 as a new tab, and when you click around inside the frame the address bar follows.
- **m360 Desktop** (`desktop/`): an Electron app for Mac and Windows with a real Chromium view per tab, laid over the Web section's stage. Every site opens, logins persist, popups become tabs. The page talks to it through `window.m360desktop` (preload.js); `.github/workflows/desktop.yml` builds the .dmg and the installer as run artifacts. Built here without an Electron runtime to run it, so the first real launch is the test.

## What is in v13: files in chat, notices, notes, music, reading mode

- **Attachments in chat** (`29-chat.js`, `edgeone/server/files.js`): any file type, up to 25 MB, from the paperclip, a drop onto the room or a paste. Pictures show inline, sound and video play in place, everything else is a card with a download. On the team site a file goes up in parts (`fileput`) and is served back by `GET /api/file?id=`; a file sent in a direct message is served only to the two people in it, and only the uploader or an admin can remove one. On claude.ai the page has no file store declared, so the paperclip says so.
- **Notices** (`60-notices.js`, `ChatWatch` in `29-chat.js`): a direct message or a mention for you shows as a small card top right wherever you are in m360, the way a phone shows a message: who, and the line. Me > Your m360 has two switches: message previews (show the line, or only who) and notices for every room message. When the tab is in the background the same notice goes through the browser's own notifications, honouring the same preview setting.
- **Notes** (`31-notes.js`): Me > Notes, a private notebook per person under `data/users/<uid>/`, which nobody else can read, the founder included. Saves itself as you type, the first line is the title, pin what matters, search by title.
- **Music** (`32-music.js`): Vibe > Music, the team's shared list (`music/team`). Paste a Spotify, Apple Music, YouTube or SoundCloud link; Play puts it in a dock at the bottom right that keeps playing while you move around m360. Full songs on Spotify and Apple Music need you signed in to that service in the browser; otherwise previews. YouTube plays in full.
- **Reading mode in the browser** (`79-web.js`, `browseHandler` in `edgeone/server/web.js`): the helper nag is gone. A site that refuses frames is fetched by the team site (`GET /api/browse?u=`), shown inside with its assets, every link routed back through the same path so it stays inside, and the address bar and tab title follow. The page runs in a sandbox with an opaque origin and a CSP sandbox header, so its scripts never reach m360's cookies or storage. Public pages only: sites that need a sign-in (Google, LinkedIn, WhatsApp) are for m360 Desktop, which the rail now points at. Just the text is one tap away.
- **Integrity, more honest** (`safety.js`): a read cache that merely lags behind a write or a restore is not "stale" (every entry is checked by tag before it is served, and refreshed on the next read); the check now reports it as lagging and rebuilds it, and calls stale only a cache that would serve the wrong document or cannot be read. Chat remembers the last room per person, so a shared browser profile never opens someone else's direct message.
- **m360 Desktop release**: `desktop.yml` now publishes `m360-mac.dmg` and `m360-win.exe` to the `desktop` release, so the team finds them at the repo's releases page (a GitHub sign-in with access to the repo is needed to download). The frame helper lives on under Admin > The browser for laptops that stay in Chrome.

## What is in v13.1: a Base of 26,000 people

- **Sync by document** (`deltaFor` in `core.js`, `shim.js`): a page sends the tag of every document it holds and gets back only what moved, the ids that are gone, and its new tags. Answers stay under 2.5 MB; a big collection arrives over a few rounds (`more: true`), and a write to one page of contacts costs one page on the wire. Before this, every one of the 175 page writes an Apollo import makes re-sent the whole 13 MB collection to every open page, which parsed, cloned and froze it each time: that was the hang.
- **The mirror keeps its objects**: an unchanged document keeps its object and its frozen copy, so nothing re-renders for it.
- **Import plans once**: the plan is worked out when the file, the mapping or the database changes, never while its writes are running.
- `harness/tests/test_bigbase.py` imports 26,000 people (17 MB, 175 pages) against the stand-in: the page never blocks for more than a fraction of a second, a fresh browser gets the base in rounds under the budget, and one edit costs one page.

## What is in v13.2: the real Apollo export

- Tried against the real thing: an Apollo export of 25,413 people, 83 columns, 141 MB. Three things stood in its way, all fixed.
- **The file is read in slices** (`readCsvFile` in `76-base.js`): the bytes are scanned for rows and cells, and only the mapped columns are decoded, each into its own string. The page holds about 150 MB less than before and never one giant string. Mapping a column that was not kept reads the file again with it.
- **Pages are placed by bytes as well as rows**: Apollo's Keywords run to hundreds of terms, which put a page of 200 companies at 553 KB, over the server's 256 KiB document limit, so the first write was refused. Keywords and tags now keep at most 40 entries, any text field 600 characters, and a page closes at 160 KB.
- **A stopped import says so** under the button, with the reason; every page written stays whole, and importing the same file again only adds what is missing.
- Measured on the stand-in with that file: 4 seconds to read and plan, 81 seconds to write 169 pages, no freeze over a fifth of a second, a fresh browser loads the whole base in about 36 seconds.

## Which build is the site running

Every EdgeOne build carries a stamp, `<commit>[+].<yymmdd-hhmm>` (the plus means the tree had changes past that commit when it was built). It shows in Me > Your m360 under "This build" and in the Admin hero, and it is served at `/version.json`. A page checks that file on load, when its tab comes back, and every ten minutes; when the server has a newer build it shows one line at the top with a Reload. The service worker's cache is keyed to the same stamp, so an old shell never lingers past one reload.

If a push does not show up: the EdgeOne console, project `mask360os`, Deployments, should list the commit; if it does not, the git integration did not fire (Redeploy from there, or check that the branch is `claude/luxury-concierge-research-orbwp5` with root `m360-os/edgeone`). If it does and the page is still old, open `/version.json` on the site: a new stamp there with an old one in the app means the tab is stale, so reload; the same old stamp in both means the deploy has not finished.

## What is in v14: the Base lives on the server

- **A page never holds the base.** After the Apollo import every page of m360 carried 25,000 people and re-read them on every change, and the whole OS lagged. Now the team site keeps a compact index per collection on the server (`edgeone/server/base.js`, `n/bx/<coll>`, rebuilt when the collection's version moves) and answers `basesearch` (rows, counts, facets, matching companies), `baseget` (one full row and its page), `basestats`, `baseroom` (where a new row goes) and `baseexport` (a CSV of what matches, up to 5,000 rows). The browser receives only the rows it shows.
- **Search never loads it.** The palette and the People and Companies pages ask the server as you type; the company picker in a person's record searches the same way. The sync marks `contacts` and `orgs` as lazy: they travel only to a page that subscribes to them.
- **Only Import holds everything**, because a clean import must dedupe against the whole base. Its screen says "Opening the whole database" and waits for the last page before it plans; the plan never runs against half a base.
- Clients, pitches and the CRM read the company and its people through the same layer (`M.base.useQuery`, `useRow`, `useOrgForClient`, `usePeopleAt`, `useStats`). On the claude.ai page and in tests the same calls run against the page's own index, so nothing changes there.
- `test_bigbase.py` now also proves that a fresh browser on Home holds no base pages and stays light, that a search and an edit travel one row at a time, that the palette finds a person through the server, and that Import still opens the whole base.

## What is in v15: Radar for India, Hunt, Spotify, and four fixes

- **Radar reads India first.** The stream is sorted into lanes the way exchange4media or afaqs would list the week: People moves (who joined where), Account moves (who won which mandate), Launches, Campaigns and Awards, with the rest of the world under its own chip. Forty nine default sources: the Indian trade press that answers with a feed (afaqs, ET Brand Equity's sections, MediaNews4U, Social Samosa, MediaBrief, Media Samosa, Agency Reporter, Indian Television), Google News site queries for the ones that refuse a fetch (exchange4media, BestMediaInfo, Campaign India, Adgully, Storyboard18, Marketing Mind), and Google News lanes for CMO appointments, agency mandates, brand launches, ad films, festive and IPL work, and the Indian award shows. The server sorts every story into a lane and marks whether it is India (`laneOf`, `isIndia` in `edgeone/server/radar.js`); the page applies the same rules to a stream cached before the lanes existed. A people or account story carries a Pursue button that opens Hunt with the brand, the person and the trigger filled in. The feeds were checked from a GitHub runner with the feed-check workflow, because this sandbox cannot reach them.
- **Hunt, the big brand lane** (Accounts, Hunt). One pursuit per person at a brand worth a retainer: the trigger that opened the door, the twenty minute audit of their public handle, one carve out (short video at volume, regional language, a creator series, community, CXO LinkedIn, launch or festive overflow, property led hotel content, in house overflow) and every piece of copy ready to paste with a Copy button: the three line proposition, the LinkedIn connect note and message, the email, the WhatsApp, the call opener, four follow ups and eighteen objection answers. The copy comes from the model when m360 ai is on and from a template otherwise; numbers that were not audited appear in square brackets, the incumbent is never named, no free month and no contingent fee are ever offered, and the sign off, the proof outcome, the spec link and the price band come from Admin, Hunt. Pressing Sent logs the touch and sets the next one (day 3, 7, 14, 30, then closed for ninety days); the Due today strip lists what is owed. People are found on Apollo through the team site (`edgeone/server/hunt.js`): the founder pastes the Apollo API key in Admin, it stays on the server, a people search is free, an email costs a credit and a mobile about eight (it arrives on Apollo's webhook at `/api/apollo`, which only keeps a number the team asked for in the last twenty minutes and that carries the one time token in its address). A search hit is a preview (first name, an obfuscated surname, title, employer); the full record comes with Get the work email. The playbook underneath (how Dentsu, Ogilvy and Havas win and keep these accounts, and the weekly routine that copies it) is on the page.
- **Spotify inside m360** (Vibe, Music). The founder pastes the client ID of a Spotify developer app in Admin (redirect URI: the team site address with a trailing slash); each person connects their own Spotify once (PKCE in the browser, no client key anywhere, tokens in that browser's local storage and never in the database) and the dock plays full tracks with search, play, pause, next, previous, seek and volume through the Web Playback SDK; a Spotify link on the team list plays in the page too. What someone is playing shows on the Music page for ten minutes. Spotify Premium is required for the in page player, and a developer app in development mode admits up to 25 people by their Spotify email; without either, links keep playing as embeds. On the claude.ai page the card says so. Saving the client ID in Admin checks its shape (`spotifycheck`, `edgeone/server/spotify.js`) and explains what Spotify's own errors mean, because Spotify confirms a client ID only after a sign in: its authorize page answers every request, a bogus ID included, with a redirect to the sign in, and its token endpoint answers an unknown client and a wrong secret alike (checked from a GitHub runner with the spotify-check workflow). Home carries a Spotify mini player from the first screen: Connect before connecting, then what is playing here, or what is playing on another device with a Play here button (playback transfer), and a search box. A return from Spotify's sign in strips its `code` and `state` from the address before the standalone shim reads it. The Music card is a Spotify browser (`src/js/34-spotify-lib.js`): Home (recently played, new releases, your top tracks of the last four weeks), Search, Your library (playlists, liked songs, albums, followed artists, top tracks, top artists, recent), a playlist, album or artist opened in place with play from any row, the queue with add from any track, devices with playback transfer, and like, shuffle and repeat on the player. That needs the library permissions, so a connection made before this version shows a Reconnect button until it is renewed. Spotify withholds its own editorial playlists (charts, Discover Weekly, Release Radar) from apps in development mode: a saved one is listed and plays whole, but its track list stays with Spotify.
- **The dashboards count open tasks.** Command and the HQ hero read "overdue of open" (0 of 6, or 1/7), Command has a Tasks card (open, due this week, overdue, shipped this week, no due date, tasks waiting for an owner), HQ's Workload lists tasks nobody on the roster owns, a client's open tasks include the ones linked through its projects, and the phone summary of Attendance no longer says "late" when nobody is.
- **The leaderboard on a Monday.** The week board scores Monday to Saturday, so on Monday morning everyone was at zero. Now the board keeps the week that just closed until one working day of the new week is behind us, with a "last week" pill on Scores and the same window on Home and Command (`M.points.boardRange`). A zero also explains itself: how many check-ins and EOD lines were found across which working days, and the cut times that earn points.
- **The calendar stays a calendar.** The Workspace meetings list reused the month grid's class names, so its row styles leaked into the cells and stretched them; the meetings list has its own names now. Every cell is the same height (96px, 58px on phones), shows two chips and "+N more", and a tap opens the day grouped: tasks due with owner and status, project deadlines, who is away or at home, celebrations, holidays, with "New task due this day" in the footer.
- **Dark theme on Web and Chat.** The chat list and pane, the browser rail, stage and frame, the mail frame and the space chips were hard coded white; they follow the theme now, active rows use the on ink colour, ghost buttons and bars use theme lines. The chat pane no longer overflows a phone, the browser toolbar pill clips instead of spilling, and the browser page no longer scrolls behind its stage.
- Tests: `test_hunt.py` (Admin key, a preview search on a canned Apollo, enrichment, the webhook with and without its token, the audit and the copy, the clipboard, the follow up ladder, Pursue from Radar, the template writer on the claude.ai build), `test_spotify.py` (the client ID, PKCE to a routed Spotify and back, tokens kept in local storage only, search, play through a stub SDK, the dock, refresh, disconnect), `test_radar.py` rewritten for lanes; `test_points.py` no longer assumes a week sits inside one quarter; the inbox marks itself read up to the newest item as well as now, so a teammate's fast clock cannot keep the badge lit.

## What is in v15.4: a plain Home hero and the phone pass

- **The Home hero is a plain head.** The concentric ring texture, the dot grid and the large flame disc that sat behind the greeting are gone, on the day and the night hero and on HQ. The hour shows as one small mark in the date line: a flame dot by day, a paper ring moon at night. The date line sits at the top of the head, the greeting and its chips at the bottom, the check-in panel to the right; on the dark theme the panel lifts off the page. Nothing sits under the greeting any more, so nothing clips it.
- **Phones wrap; nothing is cut at an edge.** Every row that used to scroll sideways with a fade on a phone now wraps: the section head chips, the section tabs, every segment control (the feed post kinds, the Admin controls, a person's sub tabs), the calendar's month controls, the task filters (whose tasks on one line, the two selects side by side), the quick actions on Home (two rows of three). The week grid is a row of day boxes per person, three to a row; a project's task rows put owner, due date and status under the title; a feed post puts Pin and Delete on their own line; the CRM row gives the account and the next step the full width; the podium shares the width three ways and the leaderboard row keeps the score on the line; the Base search box takes the full width above its button. Every route was shot at 390 and 360 pixels, with the drawers, the palette, the inbox, the New menu and the Ask panel, and none of them overflows.

## What is in v15.5: links that open, and reading mode that says why not

- **A candidate's links open in the real browser.** A portfolio, a drive folder or a profile needs the site's own scripts and often a sign in, which the reading mode inside m360 cannot give it, so the links on a Hiring candidate open outside (`data-out`), the way Google and LinkedIn always did.
- **Reading mode asks for the page first.** The Web section used to point its frame straight at `/api/browse`, so when the server function could not pass a page on the frame showed the platform's own Bad Gateway page. Now the page fetches the server's copy itself (`src/standalone/73-browse.js`) and shows it as a blob in the same sandboxed frame; a failure becomes one sentence (too big, too slow, the platform's 502, a file) with Open outside, Just the text and Try the frame.
- **The server stays inside the platform's limits.** EdgeOne carries at most 6 MB through a function, stops one that runs out of memory with a 502 and one that runs past 30 seconds with a 504. The browse function now reads a page in chunks up to 2.5 MB and refuses anything past it with 413 before it is buffered, and never carries a file (a PDF, an image): the frame gets a small page that names the file type and links it, with `x-m360-kind: file` for the page to read. `api-check.yml` (repo root) asks every API function how it answers signed out and reads the platform's documented limits from a runner.

## What is in v15.6: a check-out pressed by mistake, and the day before a holiday

- **Reopen the day.** After a check-out the card offers the way back: the founder reopens the day in one tap (the check-in and its place stay); everyone else presses "Ask Kaavish to reopen the day", which opens the correction drawer on the spot, prefilled (attendance, Undo a check-out, today), and sends it. The request reads as one in the founder's inbox ("checked out by mistake and asks you to reopen Tue 29 Sep") and in Admin > Controls > Corrections, where Approve clears the check-out and leaves the check-in as it was; the answer lands in the person's inbox and the card says the request is out until then.
- **The day before a holiday, everyone hears.** On the day before any date in Settings > holidays: Home carries a line under the greeting ("Tomorrow, Thu 2 Oct, is a holiday: Gandhi Jayanti. m360 rests too."), a corner notice shows once per person (and through the browser's own notifications when the tab is away), and the inbox has the line for everyone. The team site posts it as a pinned announcement from Kaavish at its first request that day (`edgeone/server/holiday.js`, one look every ten minutes, so a holiday added in the afternoon still gets its notice) and emails every active person with an email; the announcement then takes the inbox line's place. On the claude.ai page the founder's own page posts the announcement when nothing has after a short wait. `settings/app.holNotes` remembers which holidays were announced. Names come from the fixed national list; a holiday added by hand reads as "a holiday".

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

- Storage is the project's EdgeOne Pages Blob store, one blob per document, so writes to different documents never collide. Pages poll every 3 seconds and get back only the documents that moved.
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
