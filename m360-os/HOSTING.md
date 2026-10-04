# Where m360 OS lives, and what to move with it

No secret is written in this file or anywhere in the repository. Each line says where a key is kept.

## 1. Code: GitHub

- Repository: https://github.com/kavishrmofficial-hash/INDULGE (GitHub account `kavishrmofficial-hash`).
- The app is the `m360-os/` folder. Two branches matter:
  - `claude/amazing-euler-c4ngj2`: development. Every release is pushed here first.
  - `claude/luxury-concierge-research-orbwp5`: the branch EdgeOne Pages builds the team site from. Every release is pushed here too.
- GitHub Actions in `.github/workflows/`:
  - `desktop.yml` builds the desktop app and publishes `m360-mac.dmg` and `m360-win.exe` to the `desktop` release (https://github.com/kavishrmofficial-hash/INDULGE/releases/tag/desktop). Needs no secret.
  - `deploy-edgeone.yml` can deploy to EdgeOne by API. It runs only when the repository secret `EDGEONE_API_TOKEN` is set (it is not set today; EdgeOne deploys from git instead), with the repository variable `EDGEONE_PROJECT` naming the project.

## 2. The team site: EdgeOne Pages (Tencent)

- Site: https://m360os-wx9u1bqs.edgeone.dev
- Project name: `mask360os`, in the EdgeOne Pages console of whoever set it up (the Tencent Cloud account used at setup).
- Build settings in that console: git integration on branch `claude/luxury-concierge-research-orbwp5`, root directory `m360-os/edgeone`, no build command, output directory `public`.
- Storage: the project's EdgeOne Pages Blob store. Every document, every person, every session and every file attachment lives there. Admin > Backups downloads a full site backup (people, passwords hashed, every document) that a fresh deployment can restore from its setup screen.
- Keys kept on the server (pasted once by the founder in Admin, stored in the blob store, never sent to a page):
  - Anthropic API key (Admin > m360 AI). Belongs to the Anthropic console account it was made in.
  - Resend API key and sender address (Admin > Email sending). Belongs to the Resend account.
  - ElevenLabs API key (Admin > The buddy's voice). Belongs to the ElevenLabs account.
  - Google OAuth client id and client key (Admin > Google Workspace). Belongs to the Google Cloud project it was made in; its authorised redirect is the site address plus `/api/google`.
- The founder's password (chosen at setup, changeable in Me) is the super admin sign-in. It is kept only as a hash in the blob store, and it is not in the code, the repository or the tests. Admin > Super holds the super controls (lock, joining, alerts) behind that sign-in.

## 3. The claude.ai page

- Artifact: https://claude.ai/artifact/D6nbirdVBLqU3ZD9qrA8Yq, owned by the claude.ai account that published it (the account these sessions run under). Its data lives in that artifact's own database on claude.ai, separate from the team site.
- The team works on the EdgeOne site; the artifact is the same app for anyone inside claude.ai.

## Moving to another claude.ai account

1. The code needs nothing: give the new account access to the GitHub repository (or fork it) and start its sessions from there.
2. The team site needs nothing either: it is tied to GitHub and Tencent, not to claude.ai.
3. The artifact cannot be transferred between claude.ai accounts. The new account publishes a new artifact from `dist/index.html` (a new link), and its database starts empty; the team site is unaffected.
4. Keep the EdgeOne console login, the GitHub login, and the four key accounts above with whoever owns the company. Download a site backup from Admin before any change of hands.

## Keys added in v15

- **Apollo API key**: pasted by the founder in Admin under Hunt on the team site; stored in the EdgeOne blob store as `x/apollo` and never sent to a browser. To move it, paste it again on the new site; to revoke it, press Remove there or rotate the key in Apollo (Settings, Integrations, API). Set `APOLLO_API_KEY` in the EdgeOne project's environment variables to make it come from the server instead. Phone reveals need the public https address of the site, because Apollo posts the number back to `<site>/api/apollo`.
- **Spotify client ID**: from a Spotify developer app (developer.spotify.com/dashboard, made with the Mask360 Spotify account); pasted in Admin under Spotify and kept in `settings/app.spotify.clientId`. Its redirect URI is the site address with a trailing slash, so a new address means adding a new redirect URI in that dashboard. There is no client key to keep; each person's tokens live only in their own browser.

## The personal managers on the team site (v32)

- **How the passes run.** Nothing on the team site is scheduled. Every API request runs the passes before its action, in this order: the daily backup, the holiday notice, the books, the personal managers' mail pass (`edgeone/server/pm.js`) and the daily log prune. Each pass looks at most once every ten minutes per function instance (`PM_RECHECK_MS` in the project's environment changes that for the mail pass). Open pages poll every 3 seconds while visible and every 20 seconds while hidden, so any open tab keeps the passes moving.
- **What the mail pass does.** On IST working days between 09:30 and 21:30 it emails someone who is away from m360 (no presence beacon in 2 minutes, nothing saved in 30) about a step their manager's bot, or a voice or chat ask, has waited on for 15 minutes or more. It keeps to the same window the page rings in: the person's own hours (start minus 30 minutes to the EOD cut plus 90), never over lunch, nothing once they have checked out, and before a check-in only the check-in itself; only Kaavish's "send now anyway" lifts that. Nothing goes on leave, on a day with a leave request waiting, on a holiday or a Sunday, and an ask counts only from someone with the right to make it (Kaavish, or up the person's line). That is at most two mails a person a day, and one a day to a manager whose report has not answered. Every mail is claimed in the store (`x/pm/<day>/<uid>/<slot>`) and read back before it goes, so two instances never send the same one. Failures are kept in `x/pm/index`, which Admin reads through the `pmstatus` action. It sends nothing while `settings/app.pm.mail` is off or no Resend key is set. The bots themselves stay off until Kaavish switches them on under Admin > Personal managers; asks made by voice or chat are mailed even then.
- **When nobody has m360 open.** The heartbeat below (v33) posts `{"a": "tick"}` to `<site>/api/m360` with `content-type: application/json` every 15 minutes in the working day, which also wakes these passes. A tick needs no sign-in and does nothing by itself; the passes stay throttled, so pinging more often changes nothing.
- **A verified sending domain.** Resend's test sender (`onboarding@resend.dev`) only delivers to the address of the Resend account itself. For the team's mail to arrive, verify the agency's domain in Resend (Domains, then the DNS records it lists) and set the sender in Admin > Email sending to an address on that domain, for example `m360 <m360@mask360.agency>`.
- **Phones.** On the team site a notification is shown through the service worker (`sw.js`, written by `build_edgeone.py`), which works on Android Chrome too. A tap on it brings an open m360 forward on that screen, or opens m360 there. Nothing reaches a phone with m360 fully closed except the email above. Web Push comes in a later release.

## The m360 COO and its heartbeat (v33)

- **What runs it.** On the team site the m360 COO runs on the server (`edgeone/server/coo.js`) with no page open. Every request runs its pass after the personal managers' pass. A tick always looks; any other request looks only when the last heartbeat is over 20 minutes old, between 09:00 and 21:00 IST on a working day, so page traffic covers a missed tick. The slot it runs always comes from the server's own IST clock, never from what a request says, and every slot is claimed once in the store (`x/coo/<day>/<slot>`), every act has its own key (`x/coo/acts/<day>/<key>`), and model calls and mail happen only inside a claimed slot under the COO's own day cap. Extra, late or forged ticks therefore change nothing. A pass starts only in the first 8 seconds of its request and starts no new act after 22; where it stopped is kept as the slot's cursor and the next tick carries on.
- **The heartbeat.** `.github/workflows/coo-tick.yml` posts the tick every 15 minutes from 09:00 to 21:00 IST, plus the 21:00 close: 49 runs a day (cron in UTC, 03:30 to 15:30). It reads the site from the repository variable `M360_SITE` when set, else the EdgeOne address; it can also be run by hand from the Actions tab (Run workflow, with a site). The tick's answer is `{"ok": true, "at", "coo": {"slot", "state", "acts", "ms"}}` while the COO is on (plain `{"ok": true}` while it is off), with no names in it, and each run writes it to the run's summary.
- **The default branch.** GitHub fires a schedule only from the repository's default branch, today `claude/luxury-concierge-research-orbwp5`. The workflow must be merged there; a copy on any other branch never fires on its own. If the default branch changes, merge it into the new one.
- **Actions minutes.** On a private repository each run bills at least one minute: about 1,470 minutes a month, inside the 2,000 free minutes of GitHub Free (3,000 on Team) only while the other workflows stay small. On a public repository it costs nothing.
- **The 60-day switch-off.** GitHub switches scheduled workflows off after 60 days with no activity in the repository. When that happens the COO only runs on page traffic; the COO tab's Health shows the last beat, and the clock in the office turns flame after 30 minutes without one. Switch it back on under Actions, coo-tick, Enable workflow.
- **Late and skipped runs.** GitHub's cron is best effort: runs can start 10 to 30 minutes late or not at all. A slot runs when a tick or a request reaches it before its own limit (three hours for the open and the brief, two for most, 14 minutes for a watch round); past that it is recorded as skipped and listed at the close, so a stale roll call never runs at 4 in the afternoon. Sunday and holiday ticks only check health.
- **The kill switch.** `COO_OFF=1` in the EdgeOne project's environment variables stops the server's COO whatever the settings say: no slots, no acts, no drafts, and the books' auto-chase sends again. The faster switches are "COO stop" by voice or chat, Off on the COO tab, and Admin, COO. Open undo windows stay valid after a stop.
- **What it keeps.** Its ledger (`coo/L-<day>`, 90 days), its cards (`coo/dec`, and the owner's money cards in `books/cooq`), its state and the live feed (`coo/now` for the founder, `office/live` for everyone) live with the other documents and travel with a site backup. The claims and keys (`x/coo/...`, 14 days) and its model count (`n/ai/<day>/u_m360coo`) are server-only. Its own name is `p/u_m360coo`. `coostatus` (admin) reads the beat, the day's slots, the model calls used, and whether mail and Google are set up.
- **Mail.** The COO sends Kaavish at most two mails a day (`limits.foundMailsPerDay`): the away mail at 12:30 and 17:30 when cards have waited two hours and he is away from m360, and the close when his digest setting asks for it. Everything to a client is a draft: `coosend`, his own tap, sends it from his Gmail (Google connected under Workspace) or, for an invoice reminder, through the books' own reminder path. While the COO is on, the books' auto-chase sends nothing. Without a Resend key or Google, drafts wait and Health names the fix.

