# m360 OS module contract

Every feature module is one file in `src/js/`. The build concatenates `src/js/*.js` in filename order into one `<script>` after React 18, ReactDOM 18 and htm 3 UMD tags. There is no build step for JS, no JSX, no imports. Plain ES2020 that runs in the browser as is.

Read `BRIEF.md` for the product spec. Sections 2 (copy rules), 3 (design system) and 5 (database) apply to every line you write. This file tells you what the core already gives you and what your module must export.

## 1. Copy rules (the build fails on the first two)

- Never use an em dash or an en dash anywhere: not in UI strings, not in comments, not in seed text. Use commas, full stops, colons, or "to" for ranges ("10 to 15").
- Never write contrast constructions: no "X, not Y", no "rather than", no "instead of", no "A does this, B does that". State the positive claim on its own.
- Sentence case. Plain verbs. No jargon, no filler, no exclamation marks.
- Button labels say exactly what happens: "Check in, office", "Post EOD line", "Save outcomes", "Give kudos", "Tap again to confirm".
- Numbers beat adjectives. One idea per sentence. Micro labels are lowercase.
- User text always renders as text. React escapes strings; never pass user text through `dangerouslySetInnerHTML`.
- No `window.confirm`, `alert` or `prompt`. Destructive actions use `UI.ConfirmBtn` (tap-again).

## 2. Module pattern

```js
/* module: tasks */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  function Tasks({id}) {
    const ctx = M.useCtx();
    ...
    return html`...`;
  }

  M.pages.Tasks = Tasks;          // pages the shell routes to
  M.parts.TaskDrawer = TaskDrawer; // shared parts other modules render
  M.tasks = {isOverdue, progress}; // pure helpers other modules call
})();
```

Rules:
- Wrap the whole file in an IIFE. Only assign to `M.pages`, `M.parts` and your own `M.<module>` namespace. Never touch other modules' namespaces.
- Never destructure `M.pages`, `M.parts` or another module's helper namespace at the top of the file. They may load after you. Access them inside render or inside a function: `const D = M.parts.TaskDrawer;`.
- `M.html`, `M.React`, `M.U`, `M.UI`, `M.icons`, `M.toast`, `M.nav`, `M.useCtx`, `M.useProfiles`, `M.getLoc`, `M.useWatch`, `M.useNow`, `M.Mark` are core and safe to destructure at the top.
- htm syntax: `html\`<div class="x">${a}</div>\``, components `html\`<${UI.Card} title="x">...<//>\``, self-closing `html\`<${UI.Avatar} id=${u}/>\``. Use `class`, not `className`. Event props are `onClick`, `onInput`, `onChange`, `onKeyDown`. Style objects are `style=${{width:'10px'}}`.
- Lists need `key=${...}`.
- Only CSS classes from `src/css.css` plus small inline styles for widths and gaps. Never introduce colours outside the tokens. There is no green, blue or yellow anywhere. Ink means good or done. Flame means a problem. Outline or grey means neutral or open.
- Minimum text size is 11px. Never set a font size under that.

## 3. The core namespace `M`

### `M.U` (utils)
| helper | returns |
|---|---|
| `U.pad(n)` | "07" |
| `U.ymd(date)` | "2026-09-22" (local) |
| `U.parseYmd("2026-09-22")` | local Date at midnight |
| `U.todayStr()` | today's ymd |
| `U.mondayOf(date)` | Date of that week's Monday |
| `U.addDays(date, n)` | Date |
| `U.weekDays(monday)` | array of 6 ymd strings, Monday to Saturday |
| `U.isoWeek(date)` | "2026-W39" |
| `U.mondayOfWeekId("2026-W39")` | Date |
| `U.quarterId(date)` | "2026-Q3" |
| `U.monthId(date)` | "2026-09" |
| `U.periodRange('week' or 'month' or 'quarter', date)` | `{from, to}` ymd, inclusive |
| `U.isoLocal(date)` | "2026-09-22T00:00:00+05:30" |
| `U.haversine(a, b)` | metres between `{lat,lng}` points |
| `U.hhmm(epochMs)` | "10:12" |
| `U.minutes("10:30")` | 630 |
| `U.durText(ms)` | "9h 28m" |
| `U.fmtDate("2026-09-22")` | "22 Sep 2026" |
| `U.fmtDay("2026-09-22")` | "Tue 22 Sep" |
| `U.timeAgo(epochMs)` | "3m ago", "2h ago", "5d ago" |
| `U.inr(n)` | "₹1,20,000" (en-IN grouping) |
| `U.uid()` | short random id for new documents and items |
| `U.clone(x)` | deep clone (snapshots are frozen; clone before editing) |
| `U.cap(s)` | capitalises the first letter |
| `U.daysBetween(ymdA, ymdB)` | integer days, B minus A |
| `U.pct(a, b)` | integer percent |
| `U.pruneDays(daysMap, 150)` | new map with only the last 150 days |
| `U.pruneWeeks(weeksMap, 26)` | new map with only the last 26 weeks |
| `U.greeting(date)` | "Good morning" before 12:00, "Good afternoon" before 17:00, else "Good evening" |
| `U.dateLabel(date)` | "tuesday 22 september, week 39" |
| `U.firstName(name)` | first word |
| `U.MONTHS`, `U.DAYS`, `U.DAYS_S` | lowercase month names, lowercase day names (Sunday first), short day names |

### `M.UI` (components)
| component | props |
|---|---|
| `UI.Card` | `{title, action, flame, className, id, children}`. White card. `action` renders on the right of the title. `flame` gives the flame border. |
| `UI.Micro` | `{children, plain}`. Lowercase micro label with a flame dot. `plain` drops the dot. |
| `UI.Btn` | `{kind: undefined (primary) or 'sec' or 'ghost' or 'flame', sm, disabled, onClick, type, children}` |
| `UI.ConfirmBtn` | `{onConfirm, label, sm (default true), kind: 'ghost' (default) or 'sec' or 'flame', children}`. First tap arms it flame with "Tap again to confirm" (or `label`) for 3.5 s. |
| `UI.Pill` | `{kind: undefined (outline) or 'ink' or 'flame' or 'flame-o' or 'warm', children}` |
| `UI.Seg` | `{options: [{v, label}], value, onChange(v), sm, ariaLabel}` |
| `UI.Field` | `{label, hint, children}` for a custom control |
| `UI.Input` | `{label, hint, value, onChange(str), type, placeholder, id, min, max, step, disabled, onEnter(str)}` |
| `UI.TextArea` | `{label, hint, value, onChange(str), placeholder, rows, id}` |
| `UI.Select` | `{label, hint, value, onChange(str), options: [{v, label}], id}` |
| `UI.Check` | `{label, checked, onChange(bool)}` |
| `UI.Drawer` | `{open, onClose, title, head, footer, children}`. Right drawer on desktop, bottom sheet on phone. Escape closes. |
| `UI.Avatar` | `{id, size (px, default 28), title}` |
| `UI.AvatarRow` | `{ids, size (default 24), max (default 6)}` |
| `UI.Name` | `{id, fallback}` renders the display name as text |
| `UI.Empty` | `{text}` small grey line for empty states |
| `UI.Bar` | `{a, b, max, thin}` progress bar. `a` fills ink, optional `b` fills grey after it. |
| `UI.PageHead` | `{micro, title, children}`. `children` sit right of the title (buttons). |

Icons: `M.icons.today, tasks, projects, pitches, clients, feed, week, scores, people, hiring, handbook, voice, leave, command, desk, more, plus, x, chevL, chevR, chevD, search, link, pin, clock, check, trash, edit, send, up, down, cal, mail, drive, out, map`. Render as `html\`<${icons.plus}/>\``. They are 24px line icons and size with CSS (`.btn svg` is 18px, `.iconbtn svg` 20px).

Useful CSS classes: `stack`, `stack tight`, `row`, `row between`, `row nowrap`, `grow`, `grid2`, `grid3`, `listrow`, `rowbtn`, `hair`, `sub`, `small`, `tiny`, `num`, `flame-t`, `ink62`, `iconbtn`, `linky`, `kpi` (`.v` value, `.l` label), `kpi-rail`, `board-wrap > board > colm > col-head + tcard`, `tbl-wrap > table.tbl` (`tr.dark` for total rows), `bar`, `vbars > .vb (.low)`, `emoji-btn (.on)`, `podium > .po (.first) > .plinth`, `hb` (handbook body), `dotflame`, `checkline`, `badge`.

### Other core members
- `M.toast(msg, isError)`: ink pill, flame when `isError`, gone after 3.2 s.
- `M.nav('#tasks')`, `M.nav('#projects/' + id)`: routing by hash. `M.useRoute()` returns `{page, id}`.
- `M.useCtx()`: the app context (section 4).
- `M.useProfiles(ids)`: returns `{[id]: {id, name, avatarUrl, color, email, isMe}}`, resolved live. `name` is "" when unresolved, so render `p.name || 'Someone'`.
- `M.useNow()`: epoch ms, re-renders once a minute.
- `M.getLoc()`: Promise of `{lat, lng, acc}` rounded to 4 decimals, or `null` on any failure within 11 s.
- `M.useWatch(mcp, server, tool, input, refetchMs)`: `{state: 'none' or 'loading' or 'ok' or 'denied' or 'error', data, at, stale, code, msg}`.
- `M.Mark`: the m360 mark, `{width}`.

## 4. The context `ctx = M.useCtx()`

```
ctx.db, ctx.user, ctx.mcp (may be null), ctx.downloads (may be null), ctx.permissions (may be null)
ctx.me            Viewer {id, name, avatarUrl, color, email, isOwner, canEdit}
ctx.uid           my id (string)
ctx.isFounder     true for the owner or the roster role "founder"
ctx.founderUid    the founder's id
ctx.roster        {members, nextEmp, updated} or null
ctx.members       roster.members map {[uid]: {role, empId, title, pod, joined, start, probationEnd, active}}
ctx.member        my roster entry or null
ctx.activeMembers [{uid, role, empId, title, pod, joined, start, probationEnd, active}] sorted by empId
ctx.settings      full settings with defaults merged: {office, start, grace, eodCut, mondayCut, wfhCap, revCap, ackHours, blockerDays, holidays:[], rules:{R01..R16: bool}, points:{...}, leaderboardIncludesFounder}
ctx.holidays      Set of ymd strings
ctx.coll          one entry per collection: {ready, map: {[docId]: data}}
                  keys: checkin, eod, plan, review, rocks, feed, reacts, acks, kudos, leave, leavedec, tasks,
                        projects, pitches, clients, handbook, candidates, evals, pulse, ideas, votes, access, onboard
ctx.priv          {state, keeper, finance} each {ready, data}. keeper and finance load for the founder only.
ctx.leaveMap      {[uid]: Set of approved leave ymd}
ctx.onLeave(uid, ymd)         approved leave that day
ctx.isWorkingDay(ymd, uid)    Monday to Saturday, no holiday, no approved leave for uid (uid optional)
ctx.startFor(uid)             "HH:MM" roster start or settings.start
ctx.canSee(uid)               true when I am the founder or uid is me (private detail: locations, exact times, late marks, scores, leave)
ctx.flags         every live flag from the rules engine: [{rule, uid, severity, text, section, ref}]
ctx.myFlags       flags where uid is me
ctx.now           epoch ms, ticks once a minute
ctx.W             writes, see below
```

### Writes `ctx.W`
All writes are serialised per path and toast on failure. Each returns a promise.
- `W.set(path, doc)`: replace the whole document (creates it).
- `W.update(path, partial)`: nested merge. Requires the document to exist.
- `W.merge(path, partial)`: nested merge, creates the document when missing. Use this for per-person documents.
- `W.del(path)`: delete.

Patterns:
- Per-person maps keyed by date, week or id: `W.merge('eod/' + uid, {days: {[date]: {shipped, next, blocked, at: Date.now()}}})`.
- Arrays (feed posts, kudos given, leave reqs, plan items, rocks): read the current doc from `ctx.coll`, `U.clone` it, change the array, then `W.set` or `W.merge` the whole field. Arrays replace wholesale on update.
- Multi-writer maps (task comments, subtasks, project updates, ideas status, access items): `W.update('tasks/' + id, {comments: {[cid]: {by, t, at}}})` so nested objects merge. To delete a key inside a map, clone the map without it and write the map back with `W.update`.
- Prune rolling per-person docs on every write: `days: U.pruneDays({...old, [date]: entry})`, `weeks: U.pruneWeeks(...)`. Feed keeps the last 80 posts, kudos the last 60.
- Timestamps are epoch ms. Dates are local "YYYY-MM-DD". Week ids "YYYY-Www". Quarter ids "YYYY-Qn". Month ids "YYYY-MM".
- Only the founder can write roster, settings, handbook, review, leavedec, candidates. Members write only their own per-person docs. Everyone writes tasks, projects, pitches, clients, pulse.
- Never store names, avatars or emails. Store ids; resolve with `UI.Name`, `UI.Avatar` or `M.useProfiles`.

## 5. Module map and exports

Files and what each must export. Props are exact; other modules rely on them.

| file | page | shared exports |
|---|---|---|
| `05-rules.js` | none | `M.rules.evaluate(ctx, nowDate)` returns flags `[{rule, uid, severity:'high' or 'medium' or 'low', text, section, ref}]` for every active member the viewer can compute. `M.rules.NAMES` `{R01: 'Check in by start time', ...}` from BRIEF section 8. `M.rules.SECTION_RULES(sectionId)` returns the rule ids linked to a handbook section (the-week: R01 to R06, house-rules: R07 R08, standards: R09, escalation: R10, ladder: R12, hiring-panel: R16, pipeline: R13, projects: R14, clients: R15; and R11 for any section). `ref` is a hash to jump to (for example `#tasks`, `#handbook/the-week`). Rules switched off in `ctx.settings.rules` never fire. |
| `06-points.js` | none | `M.points.pointsFor(ctx, uid, fromYmd, toYmd)` returns `{total, output, discipline, parts: {[key]: points}, counts: {[key]: n}, badges: ['Every EOD', 'On time', 'Clean sweep']}`. `M.points.scoreFor(ctx, uid, mondayDate)` returns `{due, onTimePct, revPerTask, quality, hit, planned}`. `M.points.ladder(ctx, uid, nowDate)` returns `{misses, level: 'clear' or 'note' or 'warning' or 'exit'}` from misses in the last 30 days. `M.points.leaderboard(ctx, period, nowDate)` returns `[{uid, total, output, discipline, badges}]` ranked, founder excluded unless `settings.leaderboardIncludesFounder`, ties broken by output. |
| `50-home.js` | `M.pages.Home` | `M.home` helpers (streak, todayStatus, level) |
| `11-checkin.js` | none | `M.parts.CheckinCard` (no props). `M.att.dayStatus(ctx, uid, ymd)` returns `{status: 'office' or 'wfh' or 'leave' or 'holiday' or 'sunday' or 'none', in, out, late (bool), verified (bool), place, loc, outLoc, hours (ms or null), entry}`. `M.att.isLate(ctx, uid, inEpochMs)`. `M.att.wfhUsed(ctx, uid, mondayDate)` count of WFH check-ins that week. |
| `12-eod.js` | none | `M.parts.EodCard` (no props). `M.parts.OutcomesCard` (no props). |
| `13-yourday.js` | none | `M.parts.YourDay` (no props). Renders null when `ctx.mcp` is null. |
| `20-feed.js` | `M.pages.Feed` | none |
| `21-tasks.js` | `M.pages.Tasks` | `M.parts.TaskDrawer({taskId, onClose, defaults})`. `taskId` null means a new task prefilled from `defaults` `{project, section, client, owner}`. `M.tasks.isOverdue(task, todayYmd)`. `M.tasks.progress(ctx, projectId)` returns `{done, total, overdue}`. `M.tasks.open(ctx)` returns open tasks (status not done). |
| `22-projects.js` | `M.pages.Projects` (`{id}`: null for the list, else the project page) | `M.projects.TEMPLATES` `{campaign, retainer, pitch, internal}` each `{label, sections: [names]}`. `M.projects.create(ctx, {name, kind, template, client, pitch, owner, due})` writes the project and returns its id. |
| `23-pitches.js` | `M.pages.Pitches` | `M.pitches.STAGES` `[{v, label, prob}]`. `M.pitches.metrics(ctx)` returns `{weighted, byStage: {[stage]: {count, value}}, winRate90 (0 to 100 or null), overdue: [pitch ids]}` using the founder's finance doc (value 0 when absent). |
| `24-clients.js` | `M.pages.Clients` | `M.clients.completeness(client)` returns `{filled, total: 3, missing: []}` over memory, approvals, never. `M.clients.shares(ctx)` returns `[{id, name, monthly, share}]` from the founder's finance doc, share as percent of total. |
| `30-week.js` | `M.pages.Week` | none |
| `31-scores.js` | `M.pages.Scores` | none |
| `32-people.js` | `M.pages.People` (`{id}`: null for the directory, else the person page) | `M.parts.Onboarding({uid, compact})`. `M.parts.AccessRegister({uid})`. `M.parts.Offboarding({uid})`. `M.people.isNewHire(ctx, uid)` joined within 45 days. `M.people.onboardingProgress(ctx, uid)` returns `{done, total}`. |
| `33-hiring.js` | `M.pages.Hiring` | `M.parts.EvalDrawer({candidateId, onClose})`. `M.hiring.panel(ctx)` returns `[{id, candidate, submitted, total}]` for candidates not yet decided. `M.hiring.assignedToMe(ctx)` returns candidate ids assigned to me and not yet submitted, candidate undecided. |
| `34-handbook.js` | `M.pages.Handbook` (`{id}`) | `M.parts.HandbookBody({body})` renders markdown-lite with live tokens from settings. `M.handbook.unread(ctx, uid)` returns unread section ids. `M.handbook.sections(ctx)` returns `[{id, title, body, order, updated}]` sorted by order. |
| `35-voice.js` | `M.pages.Voice` | `M.voice.energyByWeek(ctx, n)` returns the last n weeks `[{week, avg or null, n}]` oldest first. `M.voice.latest(ctx, n)` returns the newest n pulse responses. |
| `36-leave.js` | `M.pages.Leave` | `M.parts.LeaveApprovals` (no props): pending requests with Approve and Decline inline, founder only. `M.leave.pending(ctx)` returns `[{uid, req}]`. |
| `40-command.js` | `M.pages.Command` | none |
| `41-desk.js` | `M.pages.Desk` | none |

Every page component receives `{id}` from the route. Pages render inside `.content` (max width 1000px, or 1180px for tasks, projects, pitches, week, command). Start every page with `UI.PageHead`.

## 6. Visibility rules (from BRIEF 7.3, 7.10, 7.12, 12)

- Teammates see status and check-in time. Locations, exact in and out times, hours, place, verified marks and late marks show only when `ctx.canSee(uid)`.
- Scorecard, quality scores, ladder status and leave details: `ctx.canSee(uid)`.
- Evaluations: the database lets the founder read all and each evaluator read their own. Never render another evaluator's answers.
- Keeper test and finance: `ctx.isFounder` only, from `ctx.priv`.
- Connector data never leaves the viewer's screen and is never written to the database.

## 7. Behaviour conventions

- Buttons that write: disable while a write is pending where it matters, then toast a confirmation in plain words ("Checked in", "Posted", "Saved").
- Empty states are one short line.
- Every list is derived in render from `ctx.coll`. Never store derived numbers.
- Sort newest first for streams, soonest first for due dates.
- Keep phone width in mind: wide tables go inside `.tbl-wrap`, boards inside `.board-wrap`.
- Form controls get stable `id`s where practical (`UI.Input id="task-title"`).
- Dates shown to people use `U.fmtDate` or `U.fmtDay`; times use `U.hhmm`.
