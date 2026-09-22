# m360 OS: complete build brief

Paste this entire brief as the first message. It contains every decision needed to build, test, publish and seed the app. Build it end to end.

---

## 0. Your job and how you work

You are building **m360 OS**, the internal operating system for Mask360, for its founder Kaavish Ramchandani. It is a live web app that every team member signs into with their own account. It runs each person's day (check-in with time and location, EOD line, weekly outcomes, their own calendar, mail and Drive), the work (tasks, Asana-style projects, a pitch pipeline, client brains), the team (feed, kudos, points and leaderboard, hiring panel evaluations, anonymous pulse, a handbook whose rules check themselves live) and gives the founder one master dashboard over all of it.

How you work:
1. Ask Kaavish nothing. Every decision is in this brief. Where it is silent, pick the simplest option that fits section 1 and the design system in section 3.
2. Follow the build order in section 14. Post one short line per milestone.
3. If a platform capability is missing in this account, say so in one line, build everything else, and let that feature degrade gracefully.
4. If a turn runs out of steps, stop at a clean point and state exactly where you stopped. When Kaavish says "continue", resume from that point.
5. Every reply to Kaavish follows the copy rules in section 2.

---

## 1. Context

- Mask360 is a 360 marketing and creative agency for luxury and premium brands, operating in India and the UAE, headquartered in Mumbai. Kaavish is the founder and holds the Visionary seat: vision, new business, key relationships, taste and culture.
- Kaavish refuses to parent the team daily. The OS replaces daily supervision with four things: written standards (the handbook), a fixed week (four moments), visible work (tasks, projects, EOD lines) and numbers with consequences (scorecard, points, the ladder).
- The culture line used in every job description: "Results and culture are the only two things that count."
- Working week: six days, Monday to Saturday. Two WFH days a week, the employee's choice; in practice Saturday plus one midweek day. Sunday is off. Leave taken during probation is loss of pay.
- The fixed week: Monday 10:00 plan (30 min). Wednesday 12:00 the 20% check (a two-minute Loom per live brief). Every day 19:00 the EOD line. Friday 17:00 review (30 min).
- Current live client: Swisse Wellness UAE, a 30 reel shoot, production partner Blah Studio, run day to day with Durvesh.
- Direction: pods led by Brand Strategists, and an agency a buyer would acquire. Buyers pay for agencies that run without the founder, so the OS is also the evidence of that.

---

## 2. Copy rules

These apply to every string in the app, every seed, and every reply you send Kaavish.

- Never use em dashes or en dashes. Use commas, full stops, colons, or the word "to" for ranges ("10 to 15").
- Never write contrast constructions. No "X, not Y". No "rather than". No "instead of". No parallel pairs like "A does this, B does that". State the positive claim on its own.
- Sentence case, plain verbs, no jargon, no filler, no exclamation marks.
- Button labels say exactly what happens: "Check in, office", "Post EOD line", "Save outcomes", "Give kudos", "Tap again to confirm".
- Numbers beat adjectives. One idea per sentence. Micro labels are lowercase.
- User text always renders as text. Never inject user text as HTML.

---

## 3. Design system

### Tokens (CSS custom properties on :root)

| token | value | use |
|---|---|---|
| --paper | #FFFFFF | cards, sidebar, drawers, top bar, gate screens |
| --warm | #F7F6F2 | app background, inset panels, segmented control track |
| --col | #EFEDE7 | task and pipeline board columns |
| --dark | #0A0A0A | total rows and the rare dark surface |
| --ink | #0E0E0E | text, primary buttons, active nav, "good" or "done" status |
| --ink62 | rgba(14,14,14,.62) | secondary text |
| --micro | rgba(14,14,14,.64) | micro labels, captions |
| --line | rgba(14,14,14,.10) | hairlines, card borders |
| --line2 | rgba(14,14,14,.18) | input borders, secondary buttons |
| --flame | #F53901 | accent only: dots, alerts, overdue, misses, announcements, armed confirm |

### Rules

- The app background is --warm. Cards are white. No cream, no beige, no gradients.
- Status colours: ink means good or done. Flame means a problem. Outline or grey means neutral or open. There is no green, blue or yellow anywhere in the app.
- Flame is an accent. Use it for dots, alert pills, overdue dates, "miss", the pinned announcement border, the late marker and the armed confirm button. Flame text stays to short lines.
- One font family: Space Grotesk, weights 300 to 700, embedded (section 14). Body 15px, weight 300, line-height 1.5. Bold is weight 500. Page titles weight 600, clamp(28px, 3.1vw, 40px), letter-spacing -0.032em, line-height 1.05. Card titles weight 500, 17px. Micro labels 12px, weight 400, letter-spacing 0.14em, lowercase, preceded by a 6px flame dot. Minimum text size anywhere is 11px.
- Curved edges everywhere: cards 20px (18px on phone), drawers 22px, buttons and inputs 12px (10px for small), pills 999px, avatars circular. No sharp corners anywhere.
- Buttons: primary is ink background with white text, 42px high, weight 500. Secondary is white with a --line2 border. Ghost is transparent. Small is 34px high. Armed confirm is flame background with white text.
- Pills, 24px high: default is outline with --micro text; ink filled; flame filled (overdue, announcement, miss, high flag); flame outline (pending, warning); warm filled (neutral info).
- Inputs: minimum 44px high, 12px radius, --line2 border, white. Focus-visible outline is 2px flame with 2px offset on every focusable element.
- Segmented control: warm track, 3px padding, the active segment white with a --line2 ring.
- Cards: white, 1px --line border, 22px padding (18px on phone).
- Logo: the m360 mark in Appendix A, inline SVG with fill currentColor, always black (#000), sitting directly on light grounds with no plate, never recoloured, never flame. Sidebar mark 84px wide with a small "os" micro label beside it. Phone top bar mark 66px. Gate screens 110px.
- Icons: simple 24px line icons, stroke width 1.7, round caps and joins, drawn inline as SVG.
- Motion: hover background changes only. No scroll animations, parallax or confetti.
- Desktop layout: white sidebar 252px wide with a right hairline. Main area on --warm with 36px by 40px padding. Content max width 1000px; 1180px for wide pages (My tasks, Projects, Pitches, The week, Command). Two-column card grids collapse to one column under 860px, with min-width 0 on grid children.
- Phone layout (under 860px): sticky white top bar 56px (mark left, avatar right). Bottom tab bar with five items and env(safe-area-inset-bottom) padding. Drawers become bottom sheets with max height 92vh and a 22px top radius. Content padding 20px by 16px. Toasts sit above the tab bar. No page-level horizontal scroll at 390px wide; wide tables and boards scroll inside their own card.
- Head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and color-scheme light.
- Toasts: an ink pill at the bottom centre for confirmations, flame for errors, gone after 3.2 seconds.

---

## 4. Platform and architecture

- One self-contained HTML file, published with the Artifact tool as a claude.ai artifact. Logins and shared data only exist on a published artifact, so this app ships as a link. If Kaavish's saved preferences say to deliver HTML files for download, that rule covers proposals; this app is the exception because it cannot work as a file.
- Libraries, as UMD script tags at exact versions, placed before the app script:
  - https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js
  - https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js
- Components use htm tagged templates: `const html = htm.bind(React.createElement)`. No build step, no JSX, no other network requests.
- Before writing any runtime code, call the Artifact tool with action "capabilities" and follow the contract it returns. Read the type definitions it extracts under /mnt/user-data/outputs/artifacts/_contract/<version>/: claude.d.ts, db.d.ts, user.d.ts, mcp.d.ts, permissions.d.ts and downloads.d.ts. Where they differ from this brief on call shapes, the type definitions win.
- Capabilities to declare at publish:

```json
{
 "user": {
  "scopes": [
   "profile",
   "email"
  ]
 },
 "db": {
  "rules": [
   {
    "path": "",
    "read": "interact",
    "write": "interact"
   },
   {
    "path": "roster",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "settings",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "handbook",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "review",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "leavedec",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "candidates",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "evals",
    "read": "admin",
    "write": "admin"
   },
   {
    "path": "evals/{self}",
    "read": "interact",
    "write": "interact"
   },
   {
    "path": "checkin",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "checkin/{self}",
    "write": "interact"
   },
   {
    "path": "eod",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "eod/{self}",
    "write": "interact"
   },
   {
    "path": "plan",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "plan/{self}",
    "write": "interact"
   },
   {
    "path": "rocks",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "rocks/{self}",
    "write": "interact"
   },
   {
    "path": "feed",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "feed/{self}",
    "write": "interact"
   },
   {
    "path": "reacts",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "reacts/{self}",
    "write": "interact"
   },
   {
    "path": "acks",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "acks/{self}",
    "write": "interact"
   },
   {
    "path": "kudos",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "kudos/{self}",
    "write": "interact"
   },
   {
    "path": "leave",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "leave/{self}",
    "write": "interact"
   },
   {
    "path": "ideas",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "ideas/{self}",
    "write": "interact"
   },
   {
    "path": "votes",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "votes/{self}",
    "write": "interact"
   },
   {
    "path": "access",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "access/{self}",
    "write": "interact"
   },
   {
    "path": "onboard",
    "read": "interact",
    "write": "admin"
   },
   {
    "path": "onboard/{self}",
    "write": "interact"
   }
  ]
 },
 "mcp": {
  "servers": [
   {
    "server": "Google Calendar",
    "tools": [
     "list_events"
    ]
   },
   {
    "server": "Gmail",
    "tools": [
     "search_threads"
    ]
   },
   {
    "server": "Google Drive",
    "tools": [
     "list_recent_files"
    ]
   }
  ]
 },
 "downloads": true
}
```

  If publish rejects the "email" scope, publish again with `"scopes":["profile"]` and hide every email field.
- `permissions` is built in. Never declare it.
- Boot: render a "Signing you in" gate on the first paint. Resolve `claude.use()` for "db", "user", "mcp", "downloads" and "permissions" in parallel. If window.claude is missing, show the gate "Open this inside Claude". If db or user resolves null, show "Workspace unavailable". If `me.id` is null, show "Sign in to continue". Never block first paint on permissions.
- Identity: `me = await user.me()`. `me.isOwner` is the founder. Store only ids in the database. Resolve names and avatars with `user.profiles(ids)` at render.
- The roster decides access. The owner is added automatically as founder on first open. Any signed-in viewer missing from the roster, or marked inactive, sees a holding screen: "You're signed in, but not on the team roster yet. Kaavish adds you from the Desk."
- **Logins and passwords (final decision).** Each person's personal login is their own Claude account in the Mask360 Claude organisation, signed in with their own mask360.agency Google account. They set and change that password themselves in Google. Do not build a second username and password system. The database is readable by every viewer and the platform forbids storing secrets in it, so a second password layer would be less secure. Every person gets an **Employee ID** (M360-001, M360-002 and so on, assigned in order from the Desk roster and never reused), shown on their profile, the People directory, the sidebar and the Command attendance board.
- Database discipline, from the db contract:
  - Limits: 5,000 documents per artifact, 256 KiB per document. Last writer wins and there are no transactions.
  - Keep one writer per document wherever possible; each person writes their own documents.
  - Serialise writes per document with a per-path promise queue (Appendix B).
  - Subscribe once per collection at app start and derive everything else in render.
  - Where several people write the same document (task comments, subtasks, project status updates, ideas status, access items), use maps keyed by id and write with `update()` so nested objects merge.
  - Prune rolling documents on every write: keep 150 days of daily entries and 26 weeks of weekly entries.
- Everything derived (flags, points, scorecards, leaderboards, ladder levels, pipeline value, concentration) is computed at render from source documents and never stored.
- No `window.confirm`, `alert` or `prompt` anywhere; the frame can block them. Destructive actions use a tap-again button: the first tap turns it flame with "Tap again to confirm" for 3.5 seconds (Appendix B).
- Routing uses location.hash: #command, #today, #tasks, #projects, #projects/<id>, #pitches, #clients, #feed, #week, #scores, #people, #people/<uid>, #hiring, #handbook, #handbook/<id>, #voice, #leave, #desk.

---

## 5. Database

Conventions: timestamps are epoch milliseconds. Dates are local "YYYY-MM-DD". Week ids are ISO "YYYY-Www". Quarter ids are "YYYY-Qn". Month ids are "YYYY-MM". "person" means the document belongs to one user and only they write it.

| path | written by | shape |
|---|---|---|
| roster/team | founder | {members:{[uid]:{role:"founder" or "lead" or "member", empId, title, pod, joined, start:"HH:MM" or "", probationEnd:"YYYY-MM-DD" or "", active:true}}, nextEmp:number, updated} |
| settings/app | founder | {office:{lat,lng,radius,label} or null, start:"10:30", grace:15, eodCut:"19:30", mondayCut:"12:00", wfhCap:2, revCap:2, ackHours:48, blockerDays:2, holidays:[date], rules:{R01:true, ... R16:true}, points:{see section 9}, leaderboardIncludesFounder:false, updated} |
| checkin/<uid> | person | {days:{[date]:{in, out, mode:"office" or "wfh", loc:Loc, outLoc:Loc or null}}} |
| eod/<uid> | person | {days:{[date]:{shipped, next, blocked, at}}} |
| plan/<uid> | person | {weeks:{[weekId]:{items:[{id,text}], at}}} |
| review/<uid> | founder | {weeks:{[weekId]:{marks:{[itemId]:"hit" or "miss"}, quality:1 to 5 or null, note, at}}} |
| rocks/<uid> | person | {q:{[quarterId]:[{id,text,state:"on" or "off" or "done"}]}} |
| feed/<uid> | person | {posts:[{id, kind:"update" or "win" or "question" or "announce", text, at}], pinned:"<uid>:<postId>" or null}. Keep the last 80 posts. Only the founder's pinned field is read. |
| reacts/<uid> | person | {r:{["<authorUid>:<postId>"]:emoji}} |
| acks/<uid> | person | {s:{[sectionId or "ann:<postKey>"]:at}} |
| kudos/<uid> | person (the giver) | {given:[{id, to, why, at}]}. Keep the last 60. |
| leave/<uid> | person | {reqs:[{id, from, to, type:"casual" or "sick" or "swap" or "other", at}]} |
| leavedec/<uid> | founder | {d:{[reqId]:{status:"approved" or "declined", at}}} |
| tasks/<id> | anyone | {title, owner, client, project, section, due, status:"todo" or "doing" or "review" or "done", priority:"low" or "normal" or "high", link, revisions, shown20, subtasks:{[id]:{t, done, o}}, comments:{[id]:{by, t, at}}, by, created, updated, doneAt} |
| projects/<id> | anyone | {name, kind:"client" or "pitch" or "internal", client, pitch, owner, members:[uid], status:"on" or "risk" or "off" or "done", start, due, desc, sections:[{id,name}], updates:{[id]:{by, status, text, at}}, archived:false, by, created} |
| pitches/<id> | anyone | {brand, category, contact, source, stage, stageAt, owner, next, nextDate, project, lost, created, updated} |
| clients/<id> | anyone | {name, status:"live" or "pitch" or "paused", pod, owner, memory, approvals, never, links, updated, by} |
| handbook/<sectionId> | founder | {title, body, order, updated} |
| candidates/<id> | founder | {name, role, stage:"screen" or "test" or "panel" or "offer" or "hired" or "rejected", links, notes, evaluators:[uid], deadline, decision, decidedAt, created} |
| evals/<uid> | person (the evaluator) | {e:{[candidateId]:{gwc:{g,w,c}, s:{craft,thinking,comms,ownership,culture}, pod:"yes" or "no", verdict:"strong-no" or "no" or "yes" or "strong-yes", why, risk, at}}} |
| pulse/<randomId> | anyone | {at, week, energy:1 to 5, working, broken, change}. No user id is ever stored. |
| ideas/<uid> | person; founder sets status | {items:{[id]:{t, at, status:"open" or "doing" or "done" or "parked"}}} |
| votes/<uid> | person | {v:{["<authorUid>:<ideaId>"]:true}} |
| access/<uid> | person and founder | {items:{[id]:{name, kind, risk:"high" or "normal", xfer:boolean, added, by, revoked:false, revokedAt}}, offboard:{started, lastDay, steps:{[key]:at}} or null} |
| onboard/<uid> | person | {done:{[key]:at}} |
| data/users/<founderId>/keeper | founder, private | {notes:{[uid]:{[monthId]:{fight:"yes" or "no" or "", rehire:"yes" or "no" or "", note, at}}}} |
| data/users/<founderId>/finance | founder, private | {pitch:{[pitchId]:{value, prob}}, clients:{[clientId]:{monthly}}} |
| data/users/<uid>/state | person, private | {pulse:{[weekId]:true}} |

`Loc` = {lat, lng (both rounded to 4 decimals), acc (metres), dist (metres to the office, or null), verified:boolean, place:string, src:"gps" or "self"}.

Access rules to declare exactly, as `capabilities.db.rules`:

```json
[
 {
  "path": "",
  "read": "interact",
  "write": "interact"
 },
 {
  "path": "roster",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "settings",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "handbook",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "review",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "leavedec",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "candidates",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "evals",
  "read": "admin",
  "write": "admin"
 },
 {
  "path": "evals/{self}",
  "read": "interact",
  "write": "interact"
 },
 {
  "path": "checkin",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "checkin/{self}",
  "write": "interact"
 },
 {
  "path": "eod",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "eod/{self}",
  "write": "interact"
 },
 {
  "path": "plan",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "plan/{self}",
  "write": "interact"
 },
 {
  "path": "rocks",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "rocks/{self}",
  "write": "interact"
 },
 {
  "path": "feed",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "feed/{self}",
  "write": "interact"
 },
 {
  "path": "reacts",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "reacts/{self}",
  "write": "interact"
 },
 {
  "path": "acks",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "acks/{self}",
  "write": "interact"
 },
 {
  "path": "kudos",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "kudos/{self}",
  "write": "interact"
 },
 {
  "path": "leave",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "leave/{self}",
  "write": "interact"
 },
 {
  "path": "ideas",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "ideas/{self}",
  "write": "interact"
 },
 {
  "path": "votes",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "votes/{self}",
  "write": "interact"
 },
 {
  "path": "access",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "access/{self}",
  "write": "interact"
 },
 {
  "path": "onboard",
  "read": "interact",
  "write": "admin"
 },
 {
  "path": "onboard/{self}",
  "write": "interact"
 }
]
```

What these rules do: the founder alone writes the roster, settings, handbook, reviews, leave decisions and candidates. Each person writes only their own check-ins, EOD lines, plans, rocks, posts, reactions, reads, kudos, leave requests, ideas, votes, access list and onboarding ticks, and everyone on the team can read them. Evaluations are readable by the founder and by their own author only. The founder's keeper test and finance, and each person's private state, sit in private per-user space.

---

## 6. App shell and navigation

Desktop sidebar, grouped under lowercase micro group labels:
- **Today**
- **work:** My tasks, Projects, Pitches, Clients
- **team:** Feed, The week, Scores, People, Hiring, Handbook, Voice, Leave
- **founder** (owner only): Command, Desk

Badges (flame circle, white 11px number):
- Handbook: sections you haven't read.
- Hiring: evaluations assigned to you and not submitted.
- Desk: leave requests pending.
- Command: high flags.

The sidebar foot shows the avatar, name, Employee ID and title.

The founder lands on Command. Everyone else lands on Today.

Phone tab bar: Today, My tasks, Feed, Week, More. "More" opens a bottom sheet listing the rest, with their badges.

---

## 7. Features

### 7.1 Gate screens
White, centred, the mark at 110px, a 32px title and one line of text. States: Signing you in, Open this inside Claude, Workspace unavailable, Sign in to continue, Not on the roster yet.

### 7.2 Today (everyone's home)
Header: micro label with the live date and week ("tuesday 22 september, week 39"), then the title "Good morning, {first name}." (morning before 12:00, afternoon before 17:00, evening after).

Cards in this order:
1. **Pinned announcement**, if any. Flame border, "announcement" flame pill, author and time, text, and a "Got it" button that writes `acks["ann:<postKey>"]`. The founder sees "Seen by x of y" with avatars instead.
2. **Rule box.** This person's open flags from section 8: rule name, detail, and a link to the handbook section. Empty state: "All clear."
3. **Check in** (7.3).
4. **EOD line** (7.4).
5. **This week's outcomes** (7.5).
6. **Your day**: calendar, mail and Drive (section 10).
7. **My open tasks.** The six soonest, overdue in flame, and a "Board" button.
8. **Evaluations assigned to you**, if any. Candidate, role, deadline, "Evaluate".
9. **Onboarding checklist**, if joined within the last 45 days (7.17).
10. **Who's in today.** Every active roster member with status (In office, WFH, On leave, Not in yet) and check-in time.
11. **Handbook to read**, if any sections are unread.

### 7.3 Check-in with time and location
- **Not in yet:** two buttons, "Check in, office" and "Check in, WFH". Under them: "WFH days used this week: x of {wfhCap}". WFH is disabled at the cap.
- **Checked in:** "Checked in at 10:12, office. Verified at Mumbai office." plus a "Check out" button.
- **Checked out:** "In 10:12, out 19:40, 9h 28m."
- **Capturing location.** On either check-in tap, call `navigator.geolocation.getCurrentPosition` with enableHighAccuracy false, timeout 10000 and maximumAge 60000. On success, compute the distance to settings.office with the haversine formula (Appendix B).
  - verified = the office is set, the distance is within the radius (default 200 m) and the accuracy is 1000 m or better.
  - place = the office label when verified. Otherwise "Outside office, 3.4 km away", or "Location captured" when no office is set.
- **When location fails** (denied, unavailable, timeout, or the frame blocks it), show a small picker, "Where are you checking in from?": Office, Client site, Home, Travelling. Save it with src "self" and verified false.
- **Saving.** Save `{in: now, out: null, mode, loc}`. Check-out captures location the same way into outLoc; skip the location silently if it fails.
- **Late.** start = the roster start time or settings.start. A check-in is late when it lands after start plus grace minutes. Show "late" in flame on the card and wherever that attendance appears.
- **Consent line**, always visible under the buttons: "Checking in records the time and your location at that moment. Kaavish can see both."
- **Special days.** On approved leave: "You're on approved leave today." On a holiday: "Today is a holiday." On Sunday: "Sunday. The OS rests too."
- **Who sees what.** Other people's locations, exact times and late markers show only to the founder and the person themselves. Teammates see status and check-in time on "Who's in today".

### 7.4 EOD line
- Three fields: Shipped (required), Next, Blocked. Post, then Edit.
- After 18:00 with nothing posted, the card border turns flame with "Due at 19:00."
- The posted view shows all three lines, with Blocked in flame when it is filled.

### 7.5 This week's outcomes
- Up to three inputs under the line "Three outcomes that will exist by Saturday."
- Save, then Edit, until the founder reviews that week (review.at exists). After that the outcomes are locked.
- Each outcome shows its Friday mark: open (outline), hit (ink) or miss (flame).

### 7.6 Feed and kudos
- **Composer:** "Share an update, a win or a question", with a kind segmented control (Update, Win, Question; plus Announcement for the founder) and Post. Announcements are pinned automatically.
- **Kudos:** a "Give kudos" button opens a drawer to pick a person from the roster, write one line on why, and send.
  - Each giver can send 3 a week; show "x of 3 left this week".
  - Kudos appear in the stream as "Kudos to {name}" cards.
- **Filters:** All, Announcements, Wins, Kudos.
- **Post card:** avatar, name, time ago, kind pill, text, and reactions (👍 🔥 👀 ✅). Each person gives one reaction per post, and tapping it again removes it. The founder gets Pin or Unpin; the author gets Delete (tap-again).
- **Stream:** merge every feed document and every kudos document into one list, newest first, capped at 120 items.

### 7.7 My tasks
- **Board:** To do, Doing, In review, Done (last 14 days). Filters: Mine or Everyone, project, client. A "New task" button.
- **Card:**
  - title, project chip and client chip
  - due pill, flame when overdue
  - a high priority marker
  - revision count ("2 rev") in flame outline
  - a "20% shown" pill
  - subtask progress ("2 of 5")
  - owner avatar
- **Drawer:**
  - title, status (segmented), owner, due, priority
  - project and section (section options come from the chosen project), client
  - link to the output, and the checkbox "Rough direction shown at the 20% check"
  - subtasks checklist (add, tick, delete)
  - comments thread, oldest first, with a composer at the bottom
  - a revision count note and an "Open the output" link
  - Delete, for the creator or the founder, tap-again
- **Logic.**
  - Moving a task from In review back to Doing or To do adds one revision automatically, with the toast "Sent back, revision 2".
  - Setting Done stamps doneAt. Leaving Done clears it.

### 7.8 Projects (the Asana replacement)
- **Projects list.** Filters: Active, Done, All, and kind (client, pitch, internal).
  - Card: name, client or pitch, owner avatar, status pill (On track in ink, At risk in flame outline, Off track in flame, Done in warm), due date, a progress bar (done tasks over total) and the overdue count.
- **New project** starts from a template:
  - Campaign: Brief, Strategy, Creative, Production, Live, Report
  - Retainer month: Plan, Create, Approve, Publish, Report
  - Pitch: Research, Diagnostic, Strategy, Proposal, Follow-up
  - Internal: To do, Doing, Done
- **Project page** (#projects/<id>): a header with name, status pill, owner, member avatars, due date and client link, then three tabs.
  - **List:** each section is a group of task rows (a checkbox that completes the task, title, owner avatar, due date, status pill), with an inline "Add task" per section (type a title, press Enter).
  - **Board:** one column per section, each card with a "Move to next section" button.
  - **Overview:** editable description; a status update composer (status segmented plus text, stored in the updates map, newest first); a members picker; a sections editor (add, rename, move up or down, delete an empty section).
- **Progress** is done tasks over total tasks in the project. The owner sets the status. Rule R14 flags projects at risk automatically.

### 7.9 Pitches (pipeline)
- **Stages and default probability:** Lead 10, Qualified 25, Diagnostic 40, Proposal sent 55, Negotiation 75, Won 100, Lost 0.
- **Board by stage**, scrolling horizontally on phone.
  - Card: brand, category, owner avatar, days in the current stage (from stageAt), next step and date (flame when overdue).
  - The founder also sees the monthly value in ₹, from the private finance document, formatted with `toLocaleString("en-IN")`.
- **Drawer:** brand, category, contact (name and role only), source, stage (segmented; a change stamps stageAt), owner, next step and date, lost reason (shown when Lost), linked project.
  - Founder-only fields: monthly value and a probability override, written to data/users/<founderId>/finance.
- **Actions.**
  - "Start pitch project" creates a project from the Pitch template, linked both ways.
  - On Won, offer "Create client page" (prefilled) and "Create retainer project".
- **Founder metrics bar:**
  - weighted pipeline (the sum of value times probability)
  - count by stage
  - win rate over the last 90 days (won over won plus lost)
  - next steps overdue

### 7.10 The week
- Week picker: previous, "This week", next. No future weeks.
- **Grid:** people as rows, Monday to Saturday as columns. Each cell shows:
  - status (office, wfh or leave)
  - check-in time, with late in flame
  - an "eod" chip: ink, flame when a blocker was reported, or a dashed "no eod" for past working days without one
- Tap a cell to read that day's EOD line. The founder and the person themselves also see the place and the verified mark in that drawer.
- **Outcomes and review:** one card per person.
  - The founder marks each outcome hit or miss, sets quality 1 to 5 (skipped on the founder's own card), writes an optional note, and saves.
  - The person sees their marks, quality and note. Teammates see the outcomes only.

### 7.11 Scores
See section 9.

### 7.12 People
- **Directory:** cards with avatar, name, Employee ID, title, pod and today's status.
- **Person page tabs:**
  - **Overview**, visible to everyone: title, pod, joined date, Employee ID, rocks for the quarter, recent EOD lines (last 5) and kudos received. The person edits their own 1 to 3 rocks, each on track, off track or done.
  - **Scorecard**, visible to the person and the founder: a table of the last 4 weeks (on time %, revisions per task, quality, outcomes hit), plus ladder status for the last 30 days.
  - **Access**, visible to the person and the founder: the access register (7.18).
  - **Onboarding** or **Offboarding**, visible to the person and the founder.

### 7.13 Hiring (panel evaluations)
- **Founder: new candidate.** Fields: name, role, stage, links (portfolio, the paid two-hour test brief and the submission, one per line), notes, evaluators (multi-select from the roster) and deadline.
- **Founder: candidate page.**
  - Shows each evaluator's submission, the average per criterion, the GWC yes counts, the verdict tally, and the lists of reasons to hire and risks.
  - Decision buttons: Hire and Reject.
  - Deciding before every evaluator has submitted needs a tap-again confirm labelled "Decide without all evaluations".
- **Evaluator view.** Assigned candidates carry a badge. Opening one shows the evaluation drawer:
  - At the top: "Your evaluation goes to Kaavish only. Nobody else on the panel sees it. Write what you would say to his face."
  - The candidate's links.
  - GWC: Gets it? Wants it? Capacity to do it? Yes or No each.
  - Scores 1 to 5: Quality of work, Thinking and logic, Communication, Ownership (finishes things), Culture add.
  - Would you want them in your pod? Yes or No.
  - Verdict: Strong no, No, Yes, Strong yes.
  - One reason to hire, and one risk. Both required.
  - Submit. It stays editable until the founder decides.
- **Independence.** Evaluators never see each other's answers; the database rules in section 5 enforce it.

### 7.14 Handbook with live rules
- **Layout.** Left: the section list, with a flame dot on unread sections (unread means your read timestamp is older than section.updated). Right: the reader, with the title, "updated x ago" and the body.
- **Body format (markdown-lite):**
  - "# " for a heading and "## " for a subheading
  - "- " for a list item, shown with flame dot bullets
  - **bold** inside double asterisks
  - a blank line starts a new paragraph
- **Live tokens.** These are replaced from settings on every render: {{start}}, {{grace}}, {{eodCut}}, {{mondayCut}}, {{wfhCap}}, {{revCap}}, {{ackHours}}, {{blockerDays}}.
- **Live rules box**, under the body. It lists the rules linked to that section (section 8) with a live status: "All clear" in ink or "3 flags" in flame. Members see their own status. The founder sees counts and names.
- **Footer.** "I've read this" (writes the read timestamp), or a "Read" pill once done. The founder sees "Read by x of y" with avatars.
- **Founder controls:** New section, Edit (title, position, body), and Delete (tap-again). Saving bumps updated, so everyone sees the section as unread again.

### 7.15 Voice
- **Pulse (anonymous).**
  - Once a week per person, tracked in that person's private state document.
  - Fields: energy this week 1 to 5, what's working, what's broken, one thing the founder should change.
  - Saved to pulse/<random id> with no user id.
  - At the top: "Anonymous. Your name is never stored with it."
- **Founder view.** Average energy per week for the last 8 weeks as simple ink bars (flame when the average drops under 3), plus every response, newest first.
- **Ideas box (attributed).**
  - Anyone posts an idea and anyone can give it +1, one per person.
  - The founder sets the status: Open, Doing, Done, Parked.
  - Sorted by votes.

### 7.16 Clients
- Client brain cards and a drawer with: brand memory, approvals, lines never to cross, links, owner, pod, status and open task count.
- Founder only: a monthly revenue field (stored in the private finance document) and each client's share of total monthly revenue.

### 7.17 Onboarding checklist
For members whose joined date is within the last 45 days.
- **Auto items**, ticked from the data:
  - read House rules, The week, The ladder, and your role card
  - first check-in, first EOD line, first Monday outcomes
  - rocks set for the quarter
- **Manual items**, ticked by the person and stored in onboard/<uid>:
  - working laptop confirmed
  - Google Workspace account active
  - added to client groups
  - access register filled in
  - first brief delivered
- Progress shows on Today, the person page and Command.

### 7.18 Access register and offboarding
- **Access register**, one per person.
  - Each item has a name (for example "Swisse client WhatsApp group", "Drive: Swisse folder", "Canva team seat"), a kind (client group, drive folder, tool seat, social account, client login, other), a risk (high or normal) and an "ownership transfer needed" toggle.
  - The person and the founder can add items. The input hint reads "Names only. Never passwords or codes."
  - The founder marks items revoked.
- **Offboarding.** The founder starts it from the person page with "Start offboarding" and a last working day. The checklist is every open access item (revoke or transfer), plus these fixed steps:
  - Drive file ownership transferred to a Mask360 account
  - removed from client groups
  - client-side logins rotated by the client owner
  - email suspended and forwarded
  - handover document received
  - full and final settlement released
  - relieving letter issued
  - removed from the roster
- Progress shows as a bar. "Finish offboarding" sets the roster entry to inactive; history stays.

### 7.19 Leave
- **Request:** from, to, and type (Casual, Sick, WFH swap, Other). There is no reason field by design; the line under the form reads "Details go to Kaavish directly."
- **Probation:** when the person's probationEnd is in the future, show "You're in probation until {date}. Leave in probation is loss of pay."
- **Your requests:** each with its status (pending in flame outline, approved in ink, declined in flame), plus Withdraw on pending requests (tap-again).
- Approved leave switches off the attendance rules for those days and shows "On leave" everywhere.

---

## 8. Live rule box (the rules engine)

- **Working day:** Monday to Saturday, excluding the dates in settings.holidays and any day of approved leave for that person.
- **Clock:** rules evaluate against the viewer's local clock.
- **Switches:** each rule can be turned off in Desk settings.
- **Output:** a list of `{rule, uid, severity, text, section, ref}`.

| id | rule | handbook section | fires when | severity |
|---|---|---|---|---|
| R01 | Check in by start time | the-week | a working day, the time is past start plus grace, and there is no check-in today | high after 2 hours, else medium |
| R02 | On time | the-week | today's check-in landed after start plus grace ("Checked in 13:40, 3h 10m late") | medium |
| R03 | Office check-ins are verified | the-week | today's mode is office and loc.verified is false | medium |
| R04 | EOD line by {{eodCut}} | the-week | past eodCut today with no EOD, or the previous working day has no EOD | medium |
| R05 | Monday outcomes | the-week | this week has no plan, and it is Monday after mondayCut or any later day | medium |
| R06 | WFH cap | the-week | WFH check-ins this week exceed wfhCap | low |
| R07 | Finish it | house-rules | an open task the person owns is past its due date (text includes days overdue) | high past 3 days, else medium |
| R08 | Show it at 20% | house-rules | a task reached review or done in the last 14 days with shown20 false | medium |
| R09 | Revision cap | standards | a task has revisions at or above revCap | medium |
| R10 | Escalate blockers | escalation | the person reported a blocker on blockerDays working days in a row | high |
| R11 | Read the handbook | the section itself | a section was updated more than ackHours ago and the person hasn't read it | low |
| R12 | The ladder | ladder | missed outcomes in the last 30 days total 1 or more (1 note, 2 warning, 3 exit) | medium at 1, high at 2 or more |
| R13 | Pitch next steps | pipeline | a pitch the person owns has nextDate before today and isn't Won or Lost | medium |
| R14 | Projects on track | projects | a project the person owns is Off track, or due within 3 days with progress under 70% | medium |
| R15 | Client brain kept current | clients | a live client the person owns has an empty memory, approvals or lines-never-to-cross field, or was last updated more than 60 days ago | low |
| R16 | Hiring panel on time | hiring-panel | an evaluator hasn't submitted by the candidate deadline | medium |

Section links:
- the-week: R01 to R06
- house-rules: R07 and R08
- standards: R09
- escalation: R10
- ladder: R12
- hiring-panel: R16
- every section: R11, for that section only

Flags show in four places:
- the person's Rule box on Today
- the Live rules box on each handbook section
- the Command flags panel: all people, grouped High, Medium and Low, filterable by rule
- the Command badge, which counts high flags

---

## 9. Scores and leaderboard

Points are computed from source data for a period: this week, this month or this quarter. They are never stored. Default weights, editable on the Desk and stored in settings.points:

| key | event | points |
|---|---|---|
| checkinOnTime | on-time check-in on a working day | +2 |
| eod | EOD line posted for a working day, by 10:00 the next day | +2 |
| planOnTime | Monday outcomes posted by mondayCut | +4 |
| planLate | Monday outcomes posted later that week | +1 |
| outcomeHit | outcome marked hit | +12 |
| outcomeMiss | outcome marked miss | -6 |
| taskOnTime | task done on or before its due date | +6 |
| taskLate | task done after its due date | +2 |
| revision | each revision round on tasks done in the period | -2 |
| shown20 | a task that reached review with 20% shown | +2 |
| qualityMult | weekly quality score multiplied by this | 4 |
| kudos | kudos received, 5 counted per week at most | +3 |
| rockDone | rock marked done (quarter view) | +20 |
| overdueOpen | each open overdue task at the end of the period | -2 |

- **Principle.** Show this line on the Scores page: "Output earns about three times what discipline earns. Showing up is the floor. Shipping is what scores." Output means outcomes, tasks and quality. Discipline means check-ins, EOD lines and Monday outcomes.
- **Scores page.**
  - A period toggle: Week, Month, Quarter.
  - A podium for the top 3.
  - A ranked list: avatar, name, total, and a thin bar split into output points (ink) and discipline points (warm).
  - A "Your points" breakdown card for the person. The founder sees every breakdown.
- **Badges**, derived from the data:
  - "Every EOD": posted on every working day in the period.
  - "On time": every task due in the period was done on time.
  - "Clean sweep": every outcome hit.
- **Ranking rules.** The founder is left out by default (a settings toggle brings him in). Ties are broken by output points.

---

## 10. Connectors: "Your day"

- **What it shows.** Each person's own Google Calendar, Gmail and Google Drive, through the connectors in their own Claude account.
- **Where the data goes.** It renders only on their own screen and is never written to the database. Command never shows employees' calendars or mail.
- **Before publishing,** make one real call per tool in your own session with the read-only inputs below; the contract requires it. Learn the shapes, and never embed any real value in the page.
- **Expected shapes** (verify them):
  - **Google Calendar `list_events`.**
    - Input: `{startTime, endTime, orderBy:"startTime", pageSize:10}`, where startTime and endTime are local ISO with offset for today 00:00 and tomorrow 00:00.
    - The payload is an object, and events sit in `payload.events`. That key is missing when there are none.
    - Each event has id, summary, start.dateTime or start.date, end, htmlLink, conferenceUrl and eventType.
  - **Gmail `search_threads`.**
    - Input: `{query:"is:unread in:inbox", pageSize:3, view:"THREAD_VIEW_MINIMAL"}`.
    - `payload.threads[]` each carry `messages[0].subject`, `.sender` and `.date`.
    - `payload.resultCountEstimate` is a string.
  - **Google Drive `list_recent_files`.**
    - Input: `{orderBy:"recency", pageSize:5, excludeContentSnippets:true}`.
    - `payload.files[]` each carry title, mimeType, viewUrl and modifiedTime.
- **Display** with `mcp.watchTool`: refetchInterval 300000 for calendar and mail, 600000 for Drive.
  - Calendar: today's events (time, title, and a Join link when conferenceUrl exists).
  - Mail: the unread count ("201 unread") and the top 3 sender and subject lines, with no snippets.
  - Drive: 5 recent files with open links.
- **Section states** by error code, each contained to its own section:
  - needs_reauth: "Reconnect {server} in claude.ai Settings, Connectors."
  - server_not_connected: "Add {server} in claude.ai Settings, Connectors to see it here."
  - not_in_manifest: "Turned off for this page."
  - blocked_by_policy or approval_required: "Blocked by your organisation."
  - selection_required: "Choose which {server} to use when Claude asks."
  - server_unavailable: keep the last data with "updated x ago", taken from `result.cache.storedAt`.
  - tool_error: show its message in the section.
  - A null mcp namespace hides the whole card.
- **Permissions.** Read `permissions.state("mcp:<server>")` per section and tolerate a rejection. When the state is "prompt", show a "Connect" button that calls `permissions.request(["mcp:<server>"])`. Never request in a loop.

---

## 11. Founder: Command and Desk

### Command (the master dashboard and the founder's landing page)
A wide layout. Every tile and row links to its page.

1. **KPI rail**, two rows of 5 tiles:
   - In today (x of y), Late today, Office verified (%), EOD yesterday (x of y), Outcomes hit this week (x of y)
   - Tasks overdue, High flags, Weighted pipeline (₹), Largest client share (%), Team energy (the latest pulse week's average)
2. **Attendance board.** Employee ID, person, status, in time (late in flame), place with a verified pill, out time, hours, and a map link (https://www.google.com/maps?q=lat,lng).
3. **Flags.** Grouped High, Medium and Low, with person, rule and detail, plus a rule filter.
4. **Leaderboard.** The top 5 this week.
5. **Pipeline.** Count and weighted value per stage, plus overdue next steps.
6. **Projects health.** Counts on track, at risk and off track, plus the at-risk list.
7. **People.**
   - ladder level per person
   - keeper test done this month, yes or no
   - onboarding progress for new hires
   - any offboarding in progress
8. **Hiring.** Candidates in panel, with evaluations submitted (x of y).
9. **Approvals.** Pending leave, with Approve and Decline inline.
10. **Voice.** The energy trend and the latest two comments.
11. **Clients.** Monthly revenue (private), share of total, open tasks and brain completeness.

### Desk
- **Roster.**
  - Search the organisation with `user.search`, calling it on focus and on every input.
  - Add a person with title, pod, role (Member or Pod lead), joined date, and optionally a start time and a probation end.
  - The Employee ID is assigned automatically from nextEmp.
  - Edit, Remove (tap-again; history stays) and Restore.
  - While the roster holds only the founder, show a setup card: "1. Everyone needs a seat in your Claude organisation. 2. Share this page with them, set to Can interact. 3. Add them here."
- **Settings.**
  - Office location: a "Set office to where I am now" button (geolocation), a label, a radius, and manual latitude and longitude inputs.
  - Thresholds: start time, grace, EOD cutoff, Monday cutoff, WFH cap, revision cap, handbook read window, blocker days.
  - A holidays list.
  - Rule switches R01 to R16.
  - Points weights.
  - Whether the leaderboard includes the founder.
- **Keeper test** (private).
  - For each person each month: "Would I fight to keep them?" and "Knowing what I know now, would I hire them again?", each Yes or No.
  - A no on either shows: "A no ends it quickly. Documented, paid in full, neutral relieving letter."
- **Leave approvals.**
- **Attendance export.** Pick a month and download a CSV through `downloads.save`.
  - Columns: date, employee_id, name, status, in, out, late, place, verified, hours, on_leave, in_probation.
  - Names are resolved at export time. This is the payroll input for loss-of-pay days.
- **Cleanup**, each with a tap-again confirm, and the document count shown against the 5,000 limit:
  - done tasks older than 60 days
  - pulse responses older than 26 weeks
  - lost pitches older than 180 days

---

## 12. Privacy, security and honest limits

Build all of this in, and state it in the final message.

- **Truly private:** the keeper test, the finance document (pitch values and client revenue) and each person's pulse marker live in private per-user space. Nobody else can read them.
- **Shared workspace:** everything else, including check-in locations, scores and leave dates, is readable by anyone the page is shared with if they dig into the data. The screens hide teammates' locations, scores and leave details from each other, which is why leave takes dates and a type only.
- **Pulse:** anonymous, with no user id stored. Teammates could technically read the anonymous responses too.
- **Location:** captured only at check-in and check-out, with the consent line visible every time, and stored rounded to 4 decimals. There is no background tracking.
- **Credentials:** no passwords, codes or credentials anywhere in the app, including the access register.
- **Connectors:** connector data never leaves the viewer's own screen.
- **Location fallback:** if the frame blocks location, check-ins fall back to self-reported places marked unverified, and R03 flags office days.

---

## 13. Seed data

Write these with the Artifact tool, action "write_db", db_op "batch", right after publishing. Use the current epoch milliseconds for every `updated`.

- **settings/app:** the defaults from section 5 with office null, all rules on, and the section 9 points.
- **clients/swisse-wellness-uae:** `{name:"Swisse Wellness UAE", status:"live", pod:"Pod 1", owner:"", memory:"30 reel shoot with Blah Studio as the production partner, run day to day with Durvesh.", approvals:"", never:"", links:"", updated, by:""}`
- **handbook:** the ten sections below, verbatim, with doc id, order and title as given.

**handbook/house-rules** (order 1, title "House rules")

```
# Results and culture are the only two things that count.
These five rules are the culture. They apply to the founder too.

## Finish it.
The last 20% belongs to whoever owns the task. Half work goes back unread.

## Show it at 20%.
Rough direction goes to the Wednesday check before a single slide is built.

## Write it down.
This handbook is the source of truth. A decision that isn't written down hasn't been made.

## Bring the answer.
Every escalation arrives with a recommendation and the name of whoever owns the call.

## Say it to their face.
Say about a colleague only what you would say to them directly.
```

**handbook/the-week** (order 2, title "The week")

```
# Four fixed moments. Everything else runs async.

## Check in when you start
Tap Check in on Today. It records the time and your location at that moment. Start time is {{start}}. Checking in more than {{grace}} minutes after that counts as late. You get {{wfhCap}} WFH days a week, your choice. In practice that's Saturday plus one midweek day.

## Monday, 10:00. Plan, 30 min
Post three outcomes on Today before the meeting. An outcome is something that will exist by Saturday. Outcomes posted after {{mondayCut}} on Monday count as late. Rocks get one word each: on track or off track.

## Wednesday, 12:00. The 20% check
A two-minute Loom per live brief showing the rough direction. Kaavish replies by Loom. Tick "20% shown" on the task.

## Every day, 19:00. EOD line
Three lines on Today: shipped, next, blocked. After {{eodCut}} it counts as missed. Kaavish replies to blockers only.

## Friday, 17:00. Review, 30 min
Every Monday outcome gets marked hit or miss. One piece of work goes into crit.

## Month end and quarter end
Month end: Kaavish runs the keeper test on every seat. Quarter end: Rocks close, done or not done.
```

**handbook/ladder** (order 3, title "The ladder")

```
# One bar, applied the same way to everyone.
Known on day one, so nothing is a surprise.

## One missed Friday commitment
A written note.

## Two in a month
A formal warning.

## Three
Exit.

You can see your own ladder status on your People page at any time.
```

**handbook/escalation** (order 4, title "Escalation map")

```
# What comes to Kaavish
- **Money.** Pricing, scope changes, anything that changes what a client pays.
- **Client risk.** An escalation, a missed deadline, a client asking for a change in the team.
- **Final creative sign-off** on anything going to a client for the first time.

# What stays with you
Everything else. Decide it, write it down, move.

# How to escalate
One message: the problem, your recommendation, what you need from Kaavish and by when. A blocker reported {{blockerDays}} working days in a row shows up on Kaavish's dashboard automatically.
```

**handbook/standards** (order 5, title "Standards library")

```
# A campaign idea lands as five parts
- **The line.** The idea in one sentence anyone in the room can repeat.
- **The logic.** Why it moves behaviour, tied to the brief's objective.
- **The look.** Pulled references, actual images, a moodboard.
- **The asset map.** What it becomes across films, statics, creator cuts, experiential and OOH, with quantities and cadence.
- **The phasing.** What goes live when.

Anything that arrives as a paragraph goes back with this page linked. A task that reaches {{revCap}} revision rounds gets flagged.

# Client messages
Read it once before it goes. Names, spelling and dates checked.

# Still to add
Pitch, script and client update standards, each with one example Kaavish has approved.
```

**handbook/role-brand-strategist** (order 6, title "Role card: Brand Strategist")

```
# You own
Client briefs from input to output. Content strategy, scripts, campaign thinking and creator briefs. You're on the client group and on the call.

# The number
On-time delivery above 90%. Under two revision rounds per deliverable. Quality 4 or more out of 5.

# You decide alone
Everything inside the brief and the agreed scope.

# Comes to Kaavish
Commercials, scope changes, client escalations and final creative approval.

# 30, 60, 90
- **Day 30.** Running one account without instructions being repeated.
- **Day 60.** Presenting your own work to a client with no one else in the room.
- **Day 90.** Two accounts end to end, plus one process the rest of the team uses.
```

**handbook/tool-map** (order 7, title "Tool map")

```
# Where things live
- **m360 OS.** Tasks, projects, pitches, outcomes, EOD lines, check-ins, leave, hiring panels, this handbook and client brains.
- **Google Drive.** Every working file, in the client's folder, owned by the Mask360 account.
- **Loom.** The Wednesday 20% check and async feedback.
- **Figma and Canva.** Design work, shared with the Mask360 account.
- **WhatsApp.** Client groups only. Internal updates go in the Feed.

# Access register
Every group, folder, seat and client login you hold goes in your access register on your People page. Names only. Never passwords or codes.
```

**handbook/how-scores-work** (order 8, title "How scores work")

```
# Output scores. Showing up is the floor.
Outcomes hit, tasks delivered on time and your weekly quality score earn about three times what check-ins and EOD lines earn. The live points table is on the Scores page.

## What earns points
- Outcomes marked hit at Friday review.
- Tasks done on or before their due date.
- Your weekly quality score.
- Rough direction shown at the 20% check.
- Kudos from teammates.
- On-time check-ins, EOD lines and Monday outcomes.

## What costs points
- Outcomes marked miss.
- Revision rounds.
- Tasks left overdue at the end of the period.

Points are calculated from the work itself. Nobody enters them by hand.
```

**handbook/hiring-panel** (order 9, title "Hiring panel")

```
# How we hire
Every strategy and creative hire does a paid two-hour test on a live brief before an offer. The pass condition is the shape of what comes back.

## The panel
Kaavish picks the evaluators. Each one reviews the candidate's work and the test independently, and nobody sees anyone else's evaluation. Submit before the deadline on the candidate card.

## What you answer
- Gets it, wants it, has the capacity to do it. All three need a yes.
- Quality of work, thinking and logic, communication, ownership and culture add, each 1 to 5.
- Whether you want them in your pod.
- Your verdict, one reason to hire and one risk.

Your evaluation goes to Kaavish only. Write what you would say to his face.
```

**handbook/what-we-record** (order 10, title "What the OS records")

```
# What's recorded
- **Check-in and check-out.** The time and your location at that moment. Nothing in between.
- **Your work.** Tasks, outcomes, EOD lines, comments, posts and kudos.
- **Leave.** Dates and type. Details go to Kaavish directly.

# Who sees what
- Teammates see your status, check-in time, outcomes, EOD lines, tasks, posts and your points total.
- The screens show your check-in location, scorecard, quality scores, ladder status and leave requests only to you and Kaavish.
- Only Kaavish sees hiring evaluations and his own private notes.
- The pulse in Voice is anonymous. Your name is never stored with it.

# What's never recorded
Passwords, codes, bank details and anything from your personal accounts. Your calendar, mail and Drive show on your own screen only.
```


---

## 14. Build order, QA and publish

1. **Skills.** If a frontend or design skill exists in this account, read it. This brief's design system wins every conflict.
2. **Contract.** Call Artifact action "capabilities" and read the type definitions listed in section 4.
3. **Connectors.** Make one real call each to Google Calendar list_events, Gmail search_threads and Google Drive list_recent_files, with the read-only inputs from section 10. If a connector isn't connected in this account, say so in one line, keep that section's degraded state, and ship anyway.
4. **Assets.**
   - Download the Space Grotesk latin woff2 from https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2 and the latin-ext file from https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPb94C-s0.woff2.
   - Subset the latin-ext file to U+20B9 (₹) with the fontTools subsetter, woff2 flavour (install brotli with pip, using --break-system-packages).
   - If either URL fails, fetch https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap with a desktop Chrome user agent to find the current URLs.
   - Embed both as base64 @font-face rules with their unicode-range values, and put the Appendix A mark inline.
5. **Build.** Write the app (React 18 plus htm) and a Python build script that assembles /mnt/user-data/outputs/m360-os/index.html from the fonts, mark, CSS, CDN script tags and app. The script asserts the output contains no em dash or en dash characters.
6. **Local QA harness** (never shipped).
   - A mock window.claude whose `use()` resolves after 40 ms.
   - A db mock with doc and collection refs; set, update (nested merge) and delete; onSnapshot; path parity checks; localStorage persistence; frozen snapshots; and the section 5 rules enforced (admin paths writable only by the owner identity, {self} paths only by their owner, data/users paths private).
   - A user mock with switchable identities (founder, two members, one outsider) plus profiles and search.
   - An mcp mock that returns the section 10 shapes and, on demand, one error code per server. Permissions and downloads mocks too.
   - Serve over http://127.0.0.1 from the same Python process that runs Playwright; background servers die between tool calls.
   - Use Playwright's geolocation grant and coordinates to test both verified and unverified check-ins.
7. **Playwright checks** at 390, 768 and 1280 px wide:
   - zero console errors; no page-level horizontal overflow; no text under 11px
   - **founder flow:** add to roster, set the office in settings, check in, EOD, outcomes, tasks, a project from a template, a pitch through every stage, a candidate with two evaluators, an announcement, a handbook edit, review marks and quality, a leave approval, the keeper test, the CSV export call
   - **member flow:** check-in verified and unverified, the WFH cap, EOD, outcomes, the kudos cap, an evaluation submit, pulse once per week, an idea and a vote, a handbook read
   - the outsider sees the holding screen
   - members can't see Command or Desk
   - rule flags appear for seeded violations
   - points match a hand calculation for one person
   - tap-again confirms work
8. **Publish** with the Artifact tool: file /mnt/user-data/outputs/m360-os/index.html, title "m360 OS", favicon 🟠, the capabilities from section 4 and the rules from section 5.
9. **Seed** with a write_db batch (section 13), then read back with read_db to confirm.
10. **Finish** with the final message in section 15.

---

## 15. Final message to Kaavish

Send this, filled in, and nothing longer:

"m360 OS is live: {link}.
1. Open it first. That makes you founder and opens Command and the Desk.
2. At the office, go to Desk, Settings, and tap Set office to where I am now.
3. Everyone needs a seat in this Claude organisation. Their Claude account, signed in with their mask360.agency Google login, is their personal login, and they set and change that password themselves. Everyone also gets an Employee ID.
4. Share the page with each person as Can interact, then add them on the Desk roster.
5. Tell the team check-in records time and location. Test one check-in on your phone. If no location prompt appears, the app falls back to self-reported places marked unverified.
Private to you: keeper test, pitch values, client revenue. Everything else is shared workspace data, and the screens hide teammates' locations, scores and leave from each other."

Add one line naming any connector that wasn't connected during the build.

---

## Appendix A: the m360 mark

Use exactly this. Put it inline, with CSS `color:#000` on its wrapper, width 100% and height auto.

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 422" fill="currentColor" fill-rule="evenodd"><path d="M1112 416.6C1103.1 414.6 1099.9 413.2 1092.7 408.7C1072.8 396.1 1058.1 373.5 1054 349.1C1051.7 335.5 1047.5 335.2 1038.9 347.9C1031.1 359.3 1008.6 381.2 996.5 389.3C981.6 399.1 967.8 405.3 951.7 409.5C939.9 412.5 936.3 413 926.5 413C916.8 413 913.2 412.5 901.8 409.6C886 405.5 866.8 398.2 858.5 393.2C845.7 385.5 837.1 375.9 833.6 365.3C830.6 356.3 825.9 317.8 825.3 297.5C825 285.8 824.3 278.2 823.7 277.8C821.5 276.4 817 280.2 810.6 289C798.3 305.8 775.8 327.5 752.9 344.5C719.8 369.2 672.1 391.4 632.5 400.5C601.9 407.5 593.9 408.5 563.5 408.5C533.1 408.5 532.1 408.2 522.5 398.6C503.9 379.8 502.6 359.1 519.2 347.7C526.3 342.8 532.7 341.6 547 342.3C555.3 342.7 561.8 343.8 570.5 346.1C587.9 350.8 595.2 350.6 609 345.2C627 338.2 652.1 325.7 673 313.2C686.9 305 717.4 284.2 729.5 274.8C749.5 259.2 768.1 239.5 773 228.8C775.7 222.9 775.5 220.3 772.1 216.9C769.5 214.3 768.5 214 763.2 214C755.9 214 745.7 215.9 730.8 220C720.3 222.9 712.1 225.3 681.5 234.4C663.8 239.7 643.8 243.9 633 244.6C617.4 245.7 605.1 241.4 596.7 232C590.5 225.1 588.6 219.2 589.2 208.1C589.8 194.9 590.6 193.7 622.9 158.3C642.4 136.9 657.9 118.4 658.6 115.4C659 114 658.7 112.3 657.9 111.4C656.4 109.6 657.8 109.6 628.6 111.9C615 113 602.9 111.9 596.3 109C590.3 106.4 583.4 99.6 581.4 94.4C577.9 85.3 580.8 73.6 588.8 64.8C604.7 47 683.4 12 716.5 7.9C727.2 6.5 742.7 7.3 749 9.5C759.6 13.1 769.9 24.5 772.1 34.8C772.8 38.2 773 44 772.7 49C771.5 66.6 758.9 94.3 739.2 122.5C728.5 137.7 727 140.2 727 142.6C727 146.6 730.4 147.7 744.5 148.4C786.1 150.4 816.9 165 830.5 189.4C835.6 198.5 837 203.3 838 214.9C839 226.2 840.5 229.4 843.8 227.4C845.5 226.4 847.4 223.4 863 197.8C872.8 181.6 892.2 152.8 904.5 136C932.4 97.8 953 75.5 973.8 60.8C995.1 45.8 1016.4 49.5 1027.2 70.1C1029.3 74 1029.5 75.9 1029.5 87.5C1029.5 98.3 1029.2 101.2 1027.6 104.5C1026.4 106.9 1019.3 114.6 1009.6 123.9C951.8 179.4 922.6 214 907.9 244.4C903.4 253.6 903.2 255 906 257.5C908 259.3 908.3 259.3 919.8 254.5C956.8 239.3 979.1 233.8 1004 233.8C1016.3 233.8 1019.6 234.1 1025.5 236C1035 239 1039 241.2 1045 246.5C1052.3 252.9 1054.6 254.3 1057.4 253.6C1060 253 1060 253 1066 234C1083.6 178.5 1112.8 124.5 1149.3 80C1159.9 67.1 1183.2 44.4 1194.7 35.8C1214.3 21.1 1234.6 10.9 1252 6.9C1256.7 5.8 1266.2 4.7 1273.5 4.4C1290.6 3.6 1303 6 1316.2 12.6C1342.3 25.4 1355.1 41.7 1360.6 69C1363 80.4 1363.2 83 1362.7 98.5C1362.1 118.8 1359 137.6 1352.8 158.5C1326.9 245.8 1258.4 348.1 1196.5 391.9C1180.7 403.1 1163.9 411.6 1150.5 415.2C1141.5 417.7 1119.9 418.5 1112 416.6ZM1378.5 414.8C1367.5 410.7 1356.6 397.7 1352.6 384.1C1347.9 367.9 1354 347.7 1367.9 334C1376 326 1384.2 321.5 1393.5 320C1416 316.3 1433.5 327.1 1441.6 349.6C1449.7 371.8 1435.9 399 1410.2 411.7C1403.4 415.1 1402.2 415.4 1392.2 415.7C1385.9 415.8 1380.3 415.5 1378.5 414.8ZM397.9 413.6C392.9 411.9 389.5 409.2 382.8 402.3C376 395.1 369.9 385.9 366.8 378.1C364.9 373.3 364.6 370.5 364.6 358.5C364.5 333.6 368.4 322.5 403.2 250.8C410.3 236.1 413 229.5 412.5 228.1C411.1 223.7 407.1 225.7 390.2 239.2C350 271.3 281.1 332.2 236.5 375.1C226.6 384.7 219.7 390.4 216.5 391.9C199.6 399.9 179.6 391.1 174 373.3C167.8 353.4 172.4 316 187.5 264.7C191.2 251.8 191.7 248.1 189.8 246.2C187.8 244.2 186.2 244.8 181.4 249.2C174.3 255.8 160.3 273.6 133.5 310.5C97 360.5 91.7 367.3 79 380.1C61.3 397.9 52.9 402.4 37.5 402.5C26.6 402.5 21.7 400.6 13.9 393.3C6.1 386 4.5 382.3 4.5 371.5L4.5 362.5L16.9 337C43.2 282.5 91.8 187.6 101.5 171.5C118.9 142.9 125.6 133.8 132.2 130.4C136.4 128.1 151.7 127.3 158 129C163.7 130.5 171.3 137.9 173 143.5C173.6 145.7 174.4 152.7 174.7 159C175 165.3 175.7 171.1 176.2 171.8C178.2 174.2 181.1 172.9 190.7 165.2C213.5 146.9 230.6 136.1 241.8 133.1C251.2 130.6 253.1 130.5 259.8 132.5C265.5 134.2 270.8 138.3 274 143.5C278.8 151.3 278.6 169 273.6 192.1C269.4 211.2 263 244.9 263 248C263 251.3 265.3 254 268 254C269 254 272.3 252.1 275.3 249.8C278.4 247.4 285.3 242.1 290.7 238C296.1 233.9 309.3 223.7 320 215.4C330.7 207.2 346.7 195 355.5 188.4C393.8 159.6 448.2 123.1 459.3 118.7C465.5 116.3 481 115.8 487.7 117.8C498.6 121.1 508.5 131.5 512.4 144C515.6 153.9 515.7 161.8 513 172.6C510.8 181.2 507.1 188.8 489.8 220.5C447.6 297.4 432.4 339.3 429.5 386C429.1 391.8 428.4 398.2 427.9 400.3C426.7 404.9 420.7 411.8 416.3 413.7C412.3 415.3 402.7 415.3 397.9 413.6ZM1132.1 359.8C1140.7 356.9 1157.6 342.9 1171 327.5C1203.7 290 1238.5 234.2 1267.2 173.6C1289.4 126.5 1296.9 101.4 1294 83.8C1291.9 70.2 1286.8 68.9 1271.3 77.8C1227.2 103.1 1161.1 187.3 1131.2 256.5C1120.1 282.2 1114.1 305.4 1113.3 325.6C1112.9 336.1 1113.1 339.8 1114.5 344.6C1116.9 352.9 1120 358.1 1123.5 359.6C1127.2 361.3 1127.9 361.3 1132.1 359.8ZM933.3 346C946.5 341.8 958.2 334.5 970.7 322.5C981.6 312.2 984.6 307.9 982.9 304.8C981.4 302 976.7 302.6 967.6 306.6C947.9 315.2 931.9 324.1 921 332.5C912.7 338.9 911.2 344.9 917.3 347.5C921.8 349.5 922.8 349.4 933.3 346Z"/></svg>
```

## Appendix B: code patterns

```js
// Boot (render the "Signing you in" gate first; use() resolves later, never during the first run)
async function boot(){
  const cl = window.claude;
  if(!cl || typeof cl.use !== 'function') return {mode:'nohost'};
  const [db,user,mcp,downloads,permissions] = await Promise.all(
    ['db','user','mcp','downloads','permissions'].map(n => cl.use(n)));
  if(!db || !user) return {mode:'nocap'};
  const me = await user.me();
  if(!me.id) return {mode:'noid'};
  return {mode:'ok', db, user, mcp, downloads, permissions, me, owner: !!me.isOwner};
}

// One write at a time per document
const Q = {};
function queued(path, fn){ const p = (Q[path]||Promise.resolve()).then(fn, fn); Q[path] = p.catch(()=>{}); return p; }
const w = {
  set:(p,d)=>queued(p,()=>db.doc(p).set(d)),
  update:(p,d)=>queued(p,()=>db.doc(p).update(d)),
  del:(p)=>queued(p,()=>db.doc(p).delete())
};
// On rejection: toast by code (quota_exceeded, invalid_argument, revoked, default "That did not save. Try again in a moment.")

// Subscribe once per collection
function useColl(db, path){
  const [s,set] = React.useState({ready:false, map:{}});
  React.useEffect(()=>{ if(!db) return; let un;
    try{ un = db.collection(path).onSnapshot(q=>{ const m={}; q.docs.forEach(d=>{ if(d.exists) m[d.id]=d.data(); }); set({ready:true,map:m}); },
      e=>set(x=>({...x, ready:true, err:e&&e.code}))); }catch(e){ set({ready:true,map:{}}); }
    return ()=>{ if(un) un(); }; },[db,path]);
  return s;
}
// Snapshots are frozen: clone before editing, JSON.parse(JSON.stringify(x)).

// Dates
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function mondayOf(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function isoWeek(d){ const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dn=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-dn+3);
  const fy=x.getUTCFullYear(), f=new Date(Date.UTC(fy,0,4)); return fy+'-W'+pad(1+Math.round(((x-f)/86400000-3+((f.getUTCDay()+6)%7))/7)); }
const quarterId = d => d.getFullYear()+'-Q'+(Math.floor(d.getMonth()/3)+1);
function isoLocal(d){ const o=-d.getTimezoneOffset(), s=o>=0?'+':'-', a=Math.abs(o);
  return ymd(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+':00'+s+pad(Math.floor(a/60))+':'+pad(a%60); }

// Distance in metres
function haversine(a,b){ const R=6371000, r=x=>x*Math.PI/180; const dLat=r(b.lat-a.lat), dLng=r(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }

// Location with a hard timeout; resolves null on any failure
function getLoc(){ return new Promise(res=>{ if(!navigator.geolocation) return res(null); let done=false;
  const t=setTimeout(()=>{ if(!done){ done=true; res(null); } }, 11000);
  navigator.geolocation.getCurrentPosition(p=>{ if(done) return; done=true; clearTimeout(t);
    res({lat:+p.coords.latitude.toFixed(4), lng:+p.coords.longitude.toFixed(4), acc:Math.round(p.coords.accuracy)}); },
    ()=>{ if(done) return; done=true; clearTimeout(t); res(null); },
    {enableHighAccuracy:false, timeout:10000, maximumAge:60000}); }); }

// Connector section (display arm)
function useWatch(mcp, server, tool, input, ms){
  const [s,set] = React.useState({state: mcp ? 'loading' : 'none'});
  const key = JSON.stringify(input);
  React.useEffect(()=>{ if(!mcp) return;
    const DENY=['needs_reauth','server_not_connected','blocked_by_policy','approval_required','not_in_manifest','selection_required','not_granted','capability_disabled','capability_removed'];
    const un = mcp.watchTool(server, tool, input, ev=>{
      if(ev.type==='data') set({state:'ok', data:ev.result.payload, at:(ev.result.cache&&ev.result.cache.storedAt)||Date.now()});
      else { const c=ev.error&&ev.error.code; if(DENY.includes(c)) set({state:'denied', code:c});
             else set(x=>x.state==='ok' ? {...x, stale:true, code:c} : {state:'error', code:c, msg:ev.error&&ev.error.message}); }
    }, {refetchInterval: ms});
    return un; },[mcp, server, tool, key]);
  return s;
}

// Tap-again confirm
function ConfirmBtn({onConfirm, children, label}){
  const [armed,setArmed] = React.useState(false);
  React.useEffect(()=>{ if(!armed) return; const t=setTimeout(()=>setArmed(false),3500); return ()=>clearTimeout(t); },[armed]);
  return html`<button class=${'btn ghost sm'+(armed?' arm':'')} onClick=${()=>{ if(armed){ setArmed(false); onConfirm(); } else setArmed(true); }}>${armed ? (label||'Tap again to confirm') : children}</button>`;
}

// Derived, never stored
// evaluateRules(ctx, now) -> [{rule, uid, severity, text, section, ref}]
// pointsFor(ctx, uid, fromDate, toDate) -> {total, output, discipline, parts:{[key]:points}, badges:[...]}
// scoreFor(ctx, uid, weekMonday) -> {due, onTimePct, revPerTask, quality, hit, planned}
```
