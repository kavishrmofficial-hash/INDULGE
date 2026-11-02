---
name: m360-test-everything
description: Run the m360 OS testing agents across the whole app, merge their findings into one bug report, fix the bugs, and re-test. Use when Kaavish asks to test everything, find bugs, run the testers, or check the app before a release.
---

# Test everything, report, fix

The agents are defined in `m360-os/harness/agents/` (`m360-tester.md`, `m360-fixer.md`); this playbook is `m360-os/harness/skills/m360-test-everything/SKILL.md`. On a seat where they are
not linked into `.claude/agents` yet, read those files and give their text to general-purpose agents as the
brief. Work from `/Users/kaavishr/Desktop/m360-os-app/repo/m360-os`.

## 0. Before

- `./start.sh` from the seat folder, so the tree is current.
- `rm -rf harness/out/bugs && mkdir -p harness/out/bugs`
- Build once: `python3 build.py && python3 build_edgeone.py`. Testers then run with `OFFICE_NO_BUILD=1`.

## 1. The load test (a few minutes, in the background)

    node harness/sim/office_sim.mjs          # 100 people for 4 minutes: lost saves, stale screens, errors, timings

Any lost write, stale copy or error in its summary is a blocker bug: add it to the report as area `load`.

## 2. Testers, four at a time

One m360-tester per area. Each runs its own small office, so keep four running at once at most on this Mac.

| area | covers |
| --- | --- |
| `home` | Today, check in and out, status, inbox, notices, search, the buddy and its tour, the map |
| `work` | My tasks, projects, sections, sign-off, calendar, reviews, the week |
| `accounts` | People (talks), Pipeline, Clients (retainer and project, company search), prospects, CRM table, LinkedIn desk, Base |
| `team` | Chat rooms and DMs, feed, kudos, polls, crew, pulse and ideas, leaderboard, music, break and games |
| `office` | The office in flat and 3D, characters and the character page, emotes, office life, HQ office view |
| `books` | Invoices, bank statements (CSV, XLSX), expenses, payroll, letters, billing setup; owner only |
| `admin` | Admin, roster and roles, settings, leave and approvals, hiring, handbook, AI check, backups and trash, the COO |
| `access` | Sign-in, sign-up, join requests, invites, passwords and reset, devices, the lock, who can see and change what, phone layout everywhere |

Brief each tester with: its area, the table row, "write `harness/out/bugs/<area>.json`", and "use `OFFICE_NO_BUILD=1`".

## 3. The report

Merge every `harness/out/bugs/*.json` (not `fixes-*`) into `harness/out/bugs/REPORT.md`:

- a count by severity, then one table per severity: id, area, who, viewport, title, suspect file
- drop duplicates (same cause seen by two testers): keep one, list the other ids on it
- re-run the repro of every blocker yourself before you trust it

Show Kaavish the counts and the blockers before fixing, in plain words.

## 4. Fixes

Group the bugs by the files they will touch (the `suspect` field). One m360-fixer per group, one at a time
(every fixer rebuilds the same output files, so two at once can trip each other's tests). Give each: the ids,
the files it may change, a group name for its `fixes-<group>.json`, and the version tag for comments.
Leave `needs_decision` items for Kaavish.

## 5. Re-test

- each fixed bug's repro script, now passing
- `node harness/sim/office_sim.mjs` and `.venv/bin/python harness/sim/office_walk.py`
- `harness/conformance.py`, and the test files for every module that changed
- then update REPORT.md with the outcome of each bug (fixed, cannot reproduce, not a bug, needs a decision)

Ship only when Kaavish says so (`./ship.sh`, or the owner-account pull requests while this seat is read only).
