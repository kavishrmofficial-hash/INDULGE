# Atenx House: the members app

Confidential. A review build of the private members app for the invitation-only performance House created by Atenx and Neeraj Chopra. One self-contained web page, designed and built in the manner of the Soho House app: the room first, the training and recovery as what happens to be inside it.

Open `index.html` in any browser. On a desktop it shows the phone on a stage with an index of every screen down the left. On a phone it fills the screen. Nothing is sent anywhere; every figure is an example and everything you change stays in that browser.

## The ordering every screen keeps

1. **The door before the app.** The first screen is an invitation code, not a sign-up. There is no "create account", no social login, no App Store style onboarding. Membership is granted by application, interview and committee review, and the application screen says so in the House's own words.
2. **The room before the gym.** Home is called Today and opens with the greeting, the doors, who is in the House now, and what is on this week. The training metrics are one strip on that screen and one tab of their own. The House never reads as a fitness app with a club attached.
3. **Discretion as a feature.** Form (recovery, sleep, strain) is shared with the member's coach and physio and never with other members, and the app says this on every screen where it matters. Messages stay inside the House. The directory shows only members who chose to be visible.
4. **Scarcity shown, never shouted.** Places left on an event, passes left this quarter, two nominations a year, ten Houses and no more. Numbers, in small type, in the corner.
5. **Nothing leaves the House.** No share sheets to outside networks, no public profiles, no referral links. The only way in is a member's nomination and the committee.

## Screens

| # | Screen | What it does |
|---|---|---|
| 00 | The door | Invitation code. Any code opens the door in this build; a code starting with `APP` opens an application in review. |
| 01 | Application | The five stages from invitation to decision, the interview date, and what the committee looks for. |
| 02 | Today | Greeting, doors, this morning's form, the next reservation with check-in, who is in the House now, this week, notes from the House, and four quick actions. |
| 03 | Form | WHOOP-style recovery ring, HRV and resting HR against baseline, day strain against a target band, sleep with stages, seven days, the coach's read, the quarterly Lab assessment, and the sharing switch. Tap a day to move through the week. |
| 04 | Book | Train, Recover, Courts and The table. Rooms with hourly slots and places left, reservations, and the reciprocal Houses. Tap a slot to reserve, cancel from the list. |
| 05 | What's on | Editorial cards with date, places left and your RSVP. Filters for Going, With Neeraj, Tables, Train, Recover and Talks. |
| 06 | Event | Full-bleed atmosphere, Going / Not going / Maybe, host, who is going, bring a guest, add to calendar. A full event puts you first on the list. |
| 07 | Connect | The constellation of members in the House now, then three segments: The room (a members-only feed with likes and posting), Tables (standing groups to join or start) and Members (searchable directory with follow). |
| 08 | Member | A member's page: name, handle, follow and message, following, followers and sessions, bio, two moments at the House. Their form is private. |
| 09 | Messages | Threads with members and the House. |
| 10 | Concierge | The House thread with quick asks. The concierge answers in character. |
| 11 | The Key | The membership card (tilts with the pointer), Show at the door (a rotating door code), guest passes, House credit, nominations, the network, your House, the Ledger, membership and sign out. |
| 12 | Guests | Passes left, guests signed in, issue a pass. |
| 13 | The Ledger | House credit and what it has paid for, and everything membership carries. |
| 14 | Ten Houses | The finite network, seven cities, and Register interest for the Houses not yet open. |
| 15 | Nominate | Two names a year to the committee. |
| 16 | Settings | Visible to members, share form with the House, quiet hours, where form comes from (WHOOP, Apple Health, Garmin), the discretion note. |
| 17 | Notifications | From the coach, the form, members, events, the committee and the House. |

Screenshots of every screen are in `shots/`.

## Design

- **World.** Daylight at a private house, the way the Soho House app reads: ivory grounds (`#F5F2EB`), ink type (`#151412`), white cards with hairlines, photography, and one black object, the Key. Brass (`#8C672A` on paper, `#C9A55E` as a fill) appears on the Key, the House's own notices and the interview stage, and nowhere else. Recovery green, amber and red exist only inside Form.
- **The sky.** Today and Connect open under a tint that follows the time of day at the House: gold in the morning, pale blue by day, peach in the evening (`.sky`, `.sky.morning`, `.sky.day`). It is the wash at the top of the first reference screen, made to mean something.
- **Type.** Instrument Serif for headlines and the wordmark, Instrument Sans for reading, DM Mono for micro labels, times and every number. Loaded from Google Fonts with real fallbacks.
- **Photographs.** The out-of-focus photography in the reference designs is made here from layered light and grain in CSS (`.atm-track`, `.atm-table`, `.atm-plunge` and so on), so the build ships with no photographs and no likeness rights to clear. Captions sit on frosted white glass. Replace each atmosphere with a real image when the House has its own photography.
- **Full-bleed pages.** An event or a member opens on the photograph, and the paper sheet rises over it with the title, the RSVP and the rest, the way the reference screens do.
- **Motion.** One rise on each screen change, the door opening on entry, the ring and gauges filling once. `prefers-reduced-motion` is respected.

## Layout of this folder

```
index.html         the app, standalone, built from src/ (commit this with every change)
src/styles.css     design tokens and every component
src/data.js        seed data: the House, members, events, rooms, seven days of form, ten Houses
src/app.js         the app: routing, screens, sheets, actions
src/page.html      the stage, the reviewer rail and the phone frame
build.py           assembles index.html and dist/artifact.html (the page for the claude.ai Artifact tool)
tools/shots.py     screenshots every screen with Playwright into shots/
shots/             the screenshots
```

Build: `python3 build.py`. Screenshots: `pip install playwright pillow` then `python3 tools/shots.py`. The build refuses a page that contains an em dash or an en dash.

## Placeholders to settle

- **The name.** The app uses the working mark `HOUSE` with the co-brand line `Atenx × Neeraj Chopra` and `House No. 1 · Gurugram`. Change `D.club` in `src/data.js` when the name is decided.
- **People.** Every member, coach, post and message is invented for the review. Neeraj Chopra appears as co-founder and as host of Track night; the House team and members are fictional.
- **Numbers.** Form data, prices, credit, addresses and the phone number are examples. The ten Houses and seven cities are illustrative placements of the network the brief describes.
- **Backend.** The build keeps state in the browser. The production app needs accounts tied to committee decisions, WHOOP, Apple Health and Garmin integrations, a booking engine with capacity, and a messaging service that keeps everything inside the House.
