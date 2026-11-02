# m360 OS, v7 design push

This file is the complete v7 design for the m360 OS. Hand it to Claude Code inside the m360 OS project.

Appendix A is the approved design itself, the exact file, byte for byte. Appendix B is the same design already mapped onto a full OS with every page (Command, Today, Tasks, Projects, Pitches, Clients, Feed, The week, Scores, People, Hiring, Handbook, Voice, Leave, Desk), with the CSS, the interaction layer and reference components.

---

## For Claude Code: the job

Make this OS look and move exactly like Appendix A. Same type, same spacing, same colours, same glass, same motion, same components. Match the numbers in the CSS, pixel for pixel.

Keep every feature, route, data shape, permission, integration and voice flow exactly as it works today. This is a design push. Data, logic and behaviour stay.

Order of work:

1. Read this whole file first.
2. Unpack the seven files in this document into `design/`. From the folder holding this file:

```bash
python3 - <<'PY'
import re, pathlib
s = pathlib.Path('m360-os-v7-design-push.md').read_text()
blocks = re.findall(r'````\w+\n(.*?)\n````', s, re.S)
names = ['m360-os-v7.html', 'm360-os.css', 'live-mark.html', 'chrome.js', 'shell.js', 'command.js', 'sheet-and-avatar.js']
pathlib.Path('design').mkdir(exist_ok=True)
for n, body in zip(names, blocks):
    pathlib.Path('design', n).write_text(body)
print('unpacked', len(blocks), 'files into design/')
PY
```

   Then open `design/m360-os-v7.html` in a browser (or Playwright) at 1440 by 900 and 390 by 844. That file is the source of truth for the look and the motion. Hover things, press ⌘K, swipe the cards in the phone view, open a panel.
3. Map this OS: the shell and navigation, the page header pattern, cards, buttons, inputs, selects, tabs and segmented controls, modals and drawers, toasts, the founder dashboard, how data loads, and how voice works today.
4. Tokens and base styles first: the `:root` block, the reset, the type and the spring curves from Appendix A. Appendix B1 has the same tokens plus every OS component.
5. Shell: the glass sidebar, the live mark, the island, the Ask bar, the phone capsule, the tab bar and the menu. Details below.
6. Every modal and drawer becomes the glass sheet. Every toast lands in the island.
7. Command (the founder dashboard): rebuild it in the Appendix A layout, wired to live data. See the Command data contract.
8. Every other page: restyle with Appendix B1, which already covers each OS page class by class.
9. Run the checks under Done when.

Appendix A carries simulated parts: the sample people and numbers, the timed live events, and a scripted voice demo. In this OS those come from real data, real events and real voice.

---

## House rules

- No em dashes or en dashes anywhere, in UI copy or in strings users see.
- No contrast constructions in UI copy ("not X but Y", "X, not Y", "rather than", "instead of"). State the positive line on its own.
- One font family: Space Grotesk, weights 300 to 700. No second family, no accent font.
- Colours: flame #F53901 exact, ink #0E0E0E, paper #FFFFFF, warm #F7F6F2, dark #0A0A0A. Greys are ink at an alpha (8, 10, 12, 18, 26, 45, 64 percent). Flame never appears as a tint or at an alpha.
- The m360 logo is always black. Never recoloured, never on a plate or tinted panel, never faded. It moves only through transforms.
- White page ground. Warm and dark only as bands.
- Curved edges everywhere.
- Test and sample data use invented names.

## Flame principles (about 10 percent of the screen)

1. 60, 30, 10: paper, ink, flame.
2. Flame means it needs you: overdue, late, high flags, things waiting on a decision.
3. Flame shows now and where you are: the active page tick, the now line, section index numbers, the full stop after page titles.
4. Flame answers your touch: primary buttons, the Ask icon and hover states turn flame.
5. One loud flame per screen.
6. Never on the logo.

## The look, in numbers

- Body: Space Grotesk 15px, line height 1.5, weight 400. Bold is 500.
- Page title: 48px on 52px, weight 600, tracking -0.035em, flame full stop after it (CSS `::after`). Phone: 36px on 40px.
- Labels: 12px on 16px, tracking .14em, lowercase, with a 6px flame dot before. Caps (12px, tracking .1em) only for button labels, tags and island captions. Data stays in sentence case.
- Big numbers: 72px, weight 300, tracking -0.055em, the denominator in ink at 26 percent. Long values (money) at 40px.
- Section heads: an eyebrow with a flame index number (`01 needs you`), a pill on the right, a 1px ink rule under it.
- Grid: 8px. Desktop canvas: 12px inset, sidebar, then 40px gutters. Phone: 16px sides, 88px top for the capsule, 120px bottom for the tab bar.
- Radius: cards 20, bands 28, sidebar 28, sheets 28, island 18 to 36, buttons and pills fully round.
- Lines: ink at 10 percent for card rings, 8 percent for row hairlines, 18 percent for control rings.
- Glass: white at 56 percent, blur 28px, saturate 185 percent, a 1px light rim, a fine grain, a soft long shadow. Over the dark band it turns to white at 84 to 88 percent.
- Motion: spring `linear()` curves for anything that moves place or size (sidebar width, pills, sheets, lens, island), ease `cubic-bezier(.2,.8,.2,1)` for fades. Content rises 14px on entry with a short stagger. Buttons press to .94 to .95. Reduced motion turns it all off.

## Components and behaviour

- Live mark: the m360 logo as a character, always black. Split into a body and a dot (Appendix B2). It breathes, blinks, glances, follows the pointer, squashes when you scroll fast, nods on page change, hops on success, does an "ahem" on errors, looks at whatever the island or an answer points to, stretches on a morning visit, and sleeps after 45 seconds idle or before 5am. Mood follows the day: alert at 4 or more things waiting, calm at zero. With voice it listens (dot pulses) and thinks (dot circles).
- Glass sidebar: fixed, 12px from the edges. Slim at 80px with icons only, expanded at 248px with names, group labels and badges. `[` toggles it, the choice is remembered per browser. A black pill slides to the active page with a 3px flame tick at its left edge, a warm pill follows the pointer, tooltips show names in slim mode. Footer: Ask m360 with ⌘K, Expand or Collapse, the profile with ID and title. Badges are flame. The mark sits at the top; clicking it spins it and glides to the top.
- Island: one black object at the top centre of the canvas for everything the OS says. Toasts (white check, or a flame mark for problems), confirmations with an UNDO button, live updates as they happen (someone checks in, posts the EOD line, asks for leave, asks to join, a pulse lands), voice states, and the Ask bar. It morphs size with a bouncy spring and queues news behind itself and behind open panels. Tapping a live update goes to it.
- Ask bar (⌘K or `/`, the sidebar Ask item, the Command ask field, the phone Ask button): the island grows into a 600px bar, out of the field you clicked. Empty, it suggests asks and people. Typing searches pages, people, projects, clients, pitches, tasks, candidates and handbook sections, and answers from live data (who is late, who is not in, what needs me, pipeline, biggest client, who leads, flags, team energy, hiring, projects, overdue, leave, EOD, check in). The answer shows as a large first row with a flame icon. Arrow keys move, Enter runs: it goes there, glides, rings the target in flame and the mark looks at it. Esc closes. With voice, the mic sits in the bar and drives Listening, the heard line, Thinking and the answer with SHOW.
- Glass sheet: every modal and drawer. Desktop: a 520px glass panel 12px from the right edge (720px for wide ones), a 26px light title, a round close button, content rising in. Phone: a bottom sheet with a grab handle; drag it down past 90px to close. Esc and the scrim close it.
- Phone (900px and below): a glass capsule at the top with the mark, the page name pill (opens the menu) and the avatar. A glass tab bar at the bottom with a black lens under the active tab, flame badges, More with a flame dot, and a round Ask button. It folds to the active tab when you scroll down and comes back when you scroll up. The menu is full screen glass with grouped pages that stagger in.
- Cards: white, 20px radius, a 1px ring at 10 percent, 24px padding, a pointer spotlight on the rim, a 2px lift on hover for clickable ones. Cards that need you get a 2px flame line on their top edge.
- Buttons: primary ink, fully round, 40px (32px small), turns flame on hover. Secondary is white with a ring and turns ink on hover. Ghost buttons are 32px ring pills. Pills, chips and segmented controls are round; the active one is ink.
- Inputs: warm fill, 14px radius, 44px tall, a flame caret, white with an ink ring on focus.

## Command layout (the founder dashboard)

Top: date label, the title with its flame full stop, "Good morning, Kaavish." by the real hour, and "N things need you" in flame (glides to the cards) or "All clear." in ink. On the right: the Ask field and a LIVE chip with a line of live news that rolls every 5 seconds.

01 needs you: up to 8 cards in a 4 column grid. Leave requests (Approve, Decline, swipe right or left on phone, UNDO in the island), join requests (Add, Dismiss), hires whose panel is complete (Decide), panel reads due from you (Evaluate), high flags (Open, Rule). Empty: an "All clear." card.

02 numbers: four labelled groups. people: in today, late today, office verified, EOD on the last workday. mood: team energy. work: outcomes hit, tasks overdue, high flags. money: weighted pipeline, largest client. Each tile has the big number, a small live visual (bars, a check in timeline, a meter, energy steps, pipeline stages, a 25 percent line), a one line caption, and a flame top line when it needs you. Tapping a tile goes to its detail. On phone the tiles become a swipe strip.

03 attendance today, in a warm band: filter chips (all, office, WFH, late, not in, leave) and a row per person with ID, name, status, place (unverified locations flagged with a map link), check in time (flame when late) and a day bar on an hours axis with the start line and the flame now line.

04 flags: a rule select, severity chips, two columns of flags (8 shown, Show all). Each opens the person or the rule.

Dark band (it opens up as you scroll into it): 05 leaderboard this week with the leader at 76px, 06 pipeline led by the weighted total and the stages with bars, 07 projects with on track, at risk, off track and the projects that need you.

08 people (ladder, keeper test, onboarding, offboarding), 09 hiring (panel ticks), 10 voice (the latest anonymous pulse lines).

11 clients: a revenue share bar (flame when one client is above 25 percent), then client, owner, open tasks, brain completeness and revenue, with a total row in ink.

A counter rail on the right edge marks the section you are in, with a flame progress line.

## Command data contract

Map each to this OS's own data. Appendix B5 shows one working wiring.

- needs: pending leave requests (person, dates, type, asked at), join requests, candidates whose panel is complete, panel reads assigned to the founder, high severity flags.
- people numbers: working today, checked in today, late minutes against start plus grace, office check ins and how many are location verified, EOD lines on the last workday.
- mood: average energy of the latest week's pulses and how many replies.
- work: this week's outcomes with hit or miss marks, overdue open tasks, all flags with severity.
- money: open pitches with value and stage probability (weighted), monthly revenue per client.
- attendance rows: per person check in and out times, mode (office or WFH), place, verified, status (in office, WFH, on leave, holiday, not in yet).
- flags: rule id and name, person, severity (high, medium, low), text, and where it goes.
- business: this week's points per person, pipeline by stage, projects with status, due date and progress.
- team: people with ladder level, keeper test this month, onboarding progress, offboarding; candidates with evaluators and reads in; pulse lines.
- clients: name, status, owner, open tasks, brain fields filled (memory, approvals, lines never to cross), monthly revenue.
- live line and island news: check ins and outs, EOD lines, feed posts, kudos, leave requests, join requests, pulses, newest first.

## Done when

- Side by side with Appendix A at 1440 and 390 wide, the shell, Command, type, spacing, colours, glass and motion match.
- Every page uses the B1 component styles and keeps working: every existing feature, form, role and permission behaves as before.
- No console errors. No horizontal scroll at 1440, 1280, 1024, 900 and 390, with the sidebar slim and expanded.
- ⌘K, `/`, `[` and Esc work. Keyboard focus shows the flame ring.
- Toasts, confirmations with UNDO and live updates all land in the island. Panels open as glass sheets and drag to close on phone. Needs cards swipe on touch.
- The logo is black everywhere. A scan of the UI finds zero em or en dashes and no flame other than #F53901.
- Reduced motion is respected.

---

## Appendix A: the approved v7 design, the exact file

Save this block as `design/m360-os-v7.html` and open it. Space Grotesk is embedded. The people, numbers, timed live events and the voice demo inside are simulated.

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF">
<title>m360 OS · Command</title>
<script>(function(){var d=document.documentElement;d.className='js';try{if(localStorage.getItem('m360.sb')==='x')d.classList.add('sbx');}catch(e){}})();</script>
<style>
@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:300 700;font-display:swap;src:url(data:font/woff2;base64,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) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:300 700;font-display:swap;src:url(data:font/woff2;base64,d09GMgABAAAAAANAABMAAAAABtgAAALcAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGyAcKj9IVkFSOgZgP1NUQVRYJx4ANC9EEQgKaHowcgE2AiQDCAsGAAQgBYQsByAMBxuaBQgeh7GbZZJXsNJwGw/P24V/7puJNpBYGVXyqdLEHj/vB6XlxavDZwQrmSbeG0Q0vPtcUwksT2C+gXPqEtOG0TyQgc7smfr2aqsGuuAvGInH1PQTXLcaKtdbMZMRIqNXFxUoqKeBGDZi3DSSHIpFQKCghVYStpi8bvG2DRT42yBANXQDECgnUEMIBtmgEoKX+iMFeeoY7ZQgHU+zUMbmZWKBaZpyWNIwolEebHTX+ZHszf/fJd8dzRAQn6d70UgmhNIC1eSoJ+1cuWpbQGnVNNNJQES0Q4YUKc6S7kVAZPFrNZL3DxJKPOhBUEmVbaT1DbJBkZChmoxiXSPkckGjXywmzQej0JCuJIk33tK0kXZE63K5EEG3OxFniYz4lcipnz2KRRVBAjkSmqI1IAekhnn52Hd/oVyUPfFG7Hu9UIiKCu56zd5Xu7ntPlakoqs+bdS4aeU+L0yaMXrUKNt30gu9mnd7pFyTTsM7jxw64Z1yjf7q8M25N7ppNRBSTh2JvAe0m1AwbgxCNXtOeef933zz8n1Xh+57+abg44//+uuXz4T5+aeffv/Z8tDgpX17y7/45KMCJPqnz956MrWv8vPPpy96/eVPvv3y44/efNez////7AECiaM3zFm/sGK/30pn2ZfwziVNLoTP36zQ0VhU2pTuRUkJBP8nnE2GgMEcNHMngP/XpcYmk6YDXXRTOedkIi+DR6nE0MKjYlLB12Kmhz9Hc1QsoU46CCU1y6iqoFysEzEUYlfrNBAmRfeflysdpw2FiF4h5AtUQBed4upGpgm4wFSEyTb1SAVUlZdiYFINRpStWj1YrRJAhRJoNb6qQpRmOupopRA8pWYZWgqlRlZIIE+5KRMzZyx77gwKbiUxDqycXaUMjvue+9alfbVkIT3VQafQ1NcIe3NjnS79AHhZ6agQjoD2PwK8HVVrCxz/iyNUS+2ghIMFipfowpXeGcVDN+anAAAAAA==) format('woff2');unicode-range:U+20B9}
:root{
  --flame:#F53901;--ink:#0E0E0E;--paper:#FFFFFF;--warm:#F7F6F2;--dark:#0A0A0A;
  --g64:rgba(14,14,14,.64);--g45:rgba(14,14,14,.45);--g28:rgba(14,14,14,.26);--g12:rgba(14,14,14,.12);--g08:rgba(14,14,14,.08);
  --line:rgba(14,14,14,.10);--line2:rgba(14,14,14,.18);
  --w64:rgba(255,255,255,.64);--w45:rgba(255,255,255,.45);--w20:rgba(255,255,255,.2);--w12:rgba(255,255,255,.12);
  --ease:cubic-bezier(.2,.8,.2,1);--io:cubic-bezier(.45,0,.55,1);
  --spring:cubic-bezier(.3,1.25,.45,1);--bounce:cubic-bezier(.32,1.45,.45,1);
  --inset:12px;--sbw:80px;--g:40px;--cl:calc(var(--inset) * 2 + var(--sbw));
  --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --arw:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E");
  color-scheme:light;
}
@supports (transition-timing-function:linear(0,1)){:root{--spring:linear(0,0.0172,0.0622,0.1268,0.2038,0.2876,0.3738,0.4589,0.5405,0.6167,0.6865,0.749,0.8042,0.8519,0.8926,0.9266,0.9545,0.9769,0.9945,1.0079,1.0176,1.0244,1.0286,1.0309,1.0315,1.031,1.0296,1.0276,1.0252,1.0225,1.0198,1.0171,1.0145,1.0121,1.0099,1.0079,1.0062,1.0047,1.0034,1.0023,1.0014,1.0007,1.0002,0.9998,0.9994,0.9992,0.9991,0.999,1);--bounce:linear(0,0.0279,0.1005,0.2029,0.3221,0.4475,0.571,0.6864,0.7897,0.8783,0.9512,1.0085,1.051,1.0802,1.0978,1.1058,1.1061,1.1008,1.0914,1.0795,1.0663,1.0529,1.04,1.0283,1.0179,1.0092,1.0022,0.9968,0.993,0.9904,0.9891,0.9886,0.9889,0.9897,0.9908,0.9921,0.9936,0.995,0.9963,0.9975,0.9985,0.9994,1,1.0005,1.0009,1.0011,1.0012,1.0012,1)}}
html.sbx{--sbw:248px}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{min-height:100vh;background:var(--paper);color:var(--ink);font:400 15px/1.5 'Space Grotesk',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
b,strong{font-weight:500}
a{color:inherit;text-decoration:none}
button,select{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:inherit;-webkit-tap-highlight-color:transparent}
:focus{outline:none}
:focus-visible{outline:2px solid var(--flame);outline-offset:3px}
svg{display:block}
i,em{font-style:normal}
::selection{background:var(--flame);color:#fff}
[hidden]{display:none!important}
.cap{font-size:12px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;font-weight:400}
.mut{color:var(--g64)}
.soft{color:var(--g45)}
.al{color:var(--flame)}
.tn{font-variant-numeric:tabular-nums}
.nm{background:linear-gradient(var(--flame),var(--flame)) 0 100%/0 1px no-repeat;padding-bottom:1px;transition:background-size .5s var(--ease)}
.lnk:hover .nm{background-size:100% 1px}
.go{display:block;flex:0 0 16px;width:16px;height:16px;background:var(--flame);-webkit-mask:var(--arw) center/16px 16px no-repeat;mask:var(--arw) center/16px 16px no-repeat;opacity:0;translate:-6px 0;transition:opacity .25s var(--ease),translate .5s var(--spring)}
.lnk{position:relative;cursor:pointer}
.lnk>.go{position:absolute;right:12px;top:50%;margin-top:-8px}
.lnk:hover>.go{opacity:1;translate:0 0}

/* live mark: the logo as a character. black always, only its pose changes */
.lm{position:absolute;left:0;top:50%;display:block;width:112px;height:33px;margin-top:-16.5px;color:#000;transform-origin:0 50%;transform:translateX(-4px) scale(.5715);transition:transform .6s var(--spring)}
.sbx .lm{transform:translateX(20px) scale(1)}
.l-react{display:block;width:100%;height:100%;transform-origin:50% 100%;perspective:600px}
.lmk{display:block;width:100%;height:auto;overflow:visible}
.l-pose,.l-breathe,.l-eye,.l-dot{transform-box:fill-box}
.l-pose{transform-origin:50% 100%}
.l-breathe{transform-origin:50% 100%;animation:breathe 4.6s var(--io) infinite}
.l-eye{transform-origin:50% 50%}
.l-dot{transform-origin:50% 50%;transition:transform .5s var(--spring)}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(.99,1.06)}}
.l-dot.blink{animation:blink .2s var(--io)}
@keyframes blink{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.08)}}
.r-stretch{animation:stretch 1.5s var(--io)}
@keyframes stretch{0%,100%{transform:scale(1,1) rotate(0)}28%{transform:scale(.93,1.2) rotate(0)}52%{transform:scale(1.05,.93) rotate(-3deg)}74%{transform:scale(.99,1.02) rotate(1deg)}}
.s-alert .l-breathe{animation-duration:3.2s}
.s-alert .l-dot{transform:scale(1.14)}
.s-calm .l-breathe{animation-duration:6.4s}
.s-calm .l-dot{transform:scale(1.06,.78)}
.s-sleep .l-breathe{animation-duration:7.5s}
.s-sleep .l-dot{transform:scale(1.1,.28)}
.s-happy .l-dot{transform:scale(1.25,.5)}
.s-concern .l-dot{transform:translateY(-18px) scale(.86)}
.s-listen .l-dot{animation:listen .5s var(--io) infinite}
@keyframes listen{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
.s-think .l-dot{animation:think .8s linear infinite}
@keyframes think{0%,100%{transform:translate(0,-24px)}12.5%{transform:translate(17px,-17px)}25%{transform:translate(24px,0)}37.5%{transform:translate(17px,17px)}50%{transform:translate(0,24px)}62.5%{transform:translate(-17px,17px)}75%{transform:translate(-24px,0)}87.5%{transform:translate(-17px,-17px)}}
.r-hop{animation:hop .8s var(--io)}
@keyframes hop{0%{transform:translateY(0) scale(1,1)}16%{transform:translateY(0) scale(1.08,.86)}44%{transform:translateY(-42%) scale(.95,1.08)}70%{transform:translateY(0) scale(1.1,.88)}85%{transform:translateY(0) scale(.97,1.04)}100%{transform:translateY(0) scale(1,1)}}
.r-nod{animation:nod .65s var(--io)}
@keyframes nod{0%,100%{transform:rotate(0)}30%{transform:rotate(7deg)}62%{transform:rotate(-3deg)}}
.r-wig{animation:wig .75s var(--io)}
@keyframes wig{0%,100%{transform:rotate(0)}18%{transform:rotate(-7deg)}38%{transform:rotate(6deg)}58%{transform:rotate(-4deg)}78%{transform:rotate(2deg)}}
.r-spin{animation:spin 1.05s cubic-bezier(.5,0,.15,1)}
@keyframes spin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}
.r-pop{animation:pop .5s var(--io)}
@keyframes pop{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
.r-ahem{animation:ahem .75s var(--io)}
@keyframes ahem{0%,100%{transform:translateY(0)}20%{transform:translateY(-16%)}40%{transform:translateY(0)}60%{transform:translateY(-10%)}80%{transform:translateY(0)}}

/* sidebar: slim icons, expands to names. icons never move between the two */
.side{position:fixed;z-index:60;left:var(--inset);top:var(--inset);bottom:var(--inset);width:var(--sbw);display:flex;flex-direction:column;padding:12px;border-radius:28px;background-color:rgba(255,255,255,.56);background-image:var(--grain),linear-gradient(165deg,rgba(255,255,255,.75),rgba(255,255,255,.15) 38%,rgba(255,255,255,0) 60%,rgba(255,255,255,.35));-webkit-backdrop-filter:blur(28px) saturate(185%);backdrop-filter:blur(28px) saturate(185%);box-shadow:0 0 0 1px rgba(14,14,14,.07),0 1px 2px rgba(14,14,14,.04),0 28px 60px -30px rgba(14,14,14,.38),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.45);transition:width .6s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
.side::after{content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(150deg,#fff,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 50%,rgba(255,255,255,.25) 76%,rgba(255,255,255,.95));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.side.dk{background-color:rgba(255,255,255,.84);box-shadow:0 0 0 1px rgba(255,255,255,.2),0 28px 60px -24px rgba(0,0,0,.6),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(255,255,255,.5)}
.sbt{position:relative;flex:0 0 48px;height:48px}
.snav{position:relative;flex:1;min-height:0;margin:0 -12px;padding:0 12px 8px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
.snav::-webkit-scrollbar{display:none}
.snav.ovb{-webkit-mask-image:linear-gradient(#000 calc(100% - 32px),transparent);mask-image:linear-gradient(#000 calc(100% - 32px),transparent)}
.snav.ovt{-webkit-mask-image:linear-gradient(transparent,#000 32px);mask-image:linear-gradient(transparent,#000 32px)}
.snav.ovt.ovb{-webkit-mask-image:linear-gradient(transparent,#000 32px,#000 calc(100% - 32px),transparent);mask-image:linear-gradient(transparent,#000 32px,#000 calc(100% - 32px),transparent)}
.sgl{position:relative;display:flex;align-items:flex-end;height:32px;padding:0 0 6px 18px;font-size:12px;letter-spacing:.14em;color:var(--g45);white-space:nowrap}
.sgl span{opacity:0;transition:opacity .25s var(--ease)}
.sbx .sgl span{opacity:1;transition:opacity .35s var(--ease) .15s}
.sgl::before{content:"";position:absolute;left:20px;width:16px;top:50%;height:1px;background:var(--g12);transition:opacity .3s var(--ease)}
.sbx .sgl::before{opacity:0}
.nv{position:relative;z-index:1;display:flex;align-items:center;gap:14px;width:100%;height:36px;padding-left:18px;border-radius:12px;font-size:14px;line-height:20px;color:var(--g64);white-space:nowrap;overflow:hidden;opacity:1;transition:color .3s var(--ease),background-color .3s var(--ease),scale .45s var(--spring)}
.nv+.nv{margin-top:2px}
.nv>svg{flex:0 0 20px;width:20px;height:20px}
.nv:hover{color:var(--ink)}
.nv.on{color:#fff}
.nv:active{scale:.95}
.nl{opacity:0;transition:opacity .2s var(--ease)}
.sbx .nl{opacity:1;transition:opacity .35s var(--ease) .12s}
.nl small{display:block;font-size:12px;line-height:16px;color:var(--g45)}
.js .snav .nv,.js .sfoot .nv{animation:nvin .7s var(--ease) backwards;animation-delay:calc(var(--j,0) * 28ms + 150ms)}
@keyframes nvin{from{opacity:0;translate:-10px 0}}
.bd{position:absolute;left:0;top:0;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:grid;place-items:center;font-size:11px;font-weight:500;line-height:1;color:#fff;background:var(--flame);font-variant-numeric:tabular-nums;transform:translate(32px,2px) scale(.9);transition:transform .6s var(--spring)}
.sbx .side .bd{transform:translate(186px,9px) scale(1)}
.sp{position:absolute;z-index:0;left:12px;right:12px;top:0;height:36px;border-radius:12px;pointer-events:none;transition:transform .55s var(--spring),opacity .25s var(--ease)}
.sp-h{background:var(--warm);opacity:0}
.sp-a{background:var(--ink);box-shadow:0 10px 22px -12px rgba(14,14,14,.7)}
.here{position:absolute;z-index:1;left:3px;top:0;width:3px;height:16px;border-radius:2px;background:var(--flame);pointer-events:none;transition:transform .55s var(--spring)}
.sfoot{flex:0 0 auto;margin-top:8px;padding-top:8px;box-shadow:0 -1px 0 var(--g08)}
.sfoot .nv:hover{background:var(--warm)}
.sfoot .kb{margin-left:auto;margin-right:12px}
.av{flex:0 0 22px;width:22px;height:22px;margin:0 -1px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:500;color:#fff;background:var(--ink)}
.tip{position:fixed;z-index:70;left:0;top:0;display:flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:10px;font-size:13px;line-height:1;color:#fff;background:var(--ink);white-space:nowrap;pointer-events:none;opacity:0;transform:translate3d(var(--tx,0),var(--ty,0),0) scale(.94);transform-origin:0 50%;transition:opacity .2s var(--ease),transform .45s var(--spring)}
.tip.on{opacity:1;transform:translate3d(var(--tx,0),var(--ty,0),0) scale(1)}
.tip .bd{position:static;transform:none}
.tip .kb{color:var(--w64);background:rgba(255,255,255,.1);box-shadow:none}

/* canvas */
main{container:main/inline-size;overflow-x:clip;padding:40px calc(var(--inset) + var(--g)) var(--inset) calc(var(--cl) + var(--g));transition:padding-left .6s var(--spring)}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:32px}
.tl{display:flex;flex-direction:column;gap:16px;min-width:0}
.lab{display:inline-flex;align-items:center;gap:8px;height:16px;font-size:12px;letter-spacing:.14em;color:var(--g64)}
.lab::before{content:"";flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
h1{font-size:48px;line-height:48px;font-weight:600;letter-spacing:-.035em}
h1 .fd{color:var(--flame)}
.sum{display:flex;align-items:center;gap:16px;height:28px}
.chip{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.08em;box-shadow:inset 0 0 0 1px var(--line2)}
.chip i{width:6px;height:6px;border-radius:50%;background:var(--flame);animation:beat 1.8s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1)}50%{transform:scale(.5)}}
.needl{display:inline-flex;align-items:center;gap:6px;height:28px;font-size:14px;color:var(--flame);transition:color .3s var(--ease)}
.needl b{font-weight:500}
.needl .ar{width:14px;height:14px;background:currentColor;-webkit-mask:var(--arw) center/14px 14px no-repeat;mask:var(--arw) center/14px 14px no-repeat;rotate:90deg;transition:translate .45s var(--spring)}
.needl:hover .ar{translate:0 3px}
.needl.ok{color:var(--ink)}
.needl.ok .ar{display:none}
.js .top .tl>*{animation:rise .8s var(--ease) backwards}
.js .top .tl>:nth-child(2){animation-delay:.06s}
.js .top .tl>:nth-child(3){animation-delay:.12s}
.js .askf{animation:rise .8s var(--ease) .1s backwards}
@keyframes rise{from{opacity:0;translate:0 14px}}
.askf{flex:0 0 auto;position:relative;display:flex;align-items:center;gap:12px;width:100%;height:44px;padding:0 10px 0 16px;border-radius:22px;color:var(--g64);background:var(--warm);box-shadow:inset 0 0 0 1px var(--g08);transition:background-color .3s var(--ease),box-shadow .35s var(--ease),scale .45s var(--spring)}
.askf:hover{background:#fff;box-shadow:inset 0 0 0 1px var(--line2),0 14px 30px -20px rgba(14,14,14,.4)}
.askf:active{scale:.98}
.askf .ph{flex:1;font-size:14px;line-height:20px}
.wv{display:flex;align-items:center;gap:2px;height:14px}
.wv i{display:block;width:2px;height:35%;border-radius:1px;background:var(--ink);animation:wv 1.4s ease-in-out infinite;animation-delay:calc(var(--k) * -.21s);transition:background-color .3s var(--ease)}
.askf:hover .wv i{background:var(--flame)}
@keyframes wv{0%,100%{height:30%}50%{height:100%}}
.kb{display:inline-flex;align-items:center;gap:1px;height:24px;padding:0 7px;border-radius:8px;font-size:12px;font-weight:500;line-height:1;color:var(--g64);background:#fff;box-shadow:inset 0 0 0 1px var(--line2)}
.kb svg{width:12px;height:12px}

/* sections */
.sec{padding-top:64px}
#need{padding-top:48px}
.band{position:relative;margin:64px calc(-1 * var(--g)) 0;padding:64px var(--g);border-radius:28px}
.band.warm{background:var(--warm)}
.band.dark{background:var(--dark);color:#fff;clip-path:inset(0 calc((1 - var(--e,1)) * 32px) round calc(28px + (1 - var(--e,1)) * 16px))}
.sh{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;padding-bottom:16px;box-shadow:0 1px 0 var(--ink)}
.card .sh{box-shadow:0 1px 0 var(--line)}
.dark .sh{box-shadow:0 1px 0 rgba(255,255,255,.85)}
.eb{display:inline-flex;align-items:baseline;gap:10px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g64);white-space:nowrap}
.eb i{color:var(--flame);font-weight:500;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.dark .eb{color:var(--w64)}
.pl{display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.04em;white-space:nowrap;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
button.pl:hover{color:#fff;background:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
button.pl:active{scale:.94}
.pl.hot{color:#fff;background:var(--flame);box-shadow:none}
.dark .pl{color:#fff;background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.26)}
.dark button.pl:hover{color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px #fff}
.card{position:relative;background:#fff;border-radius:20px;padding:24px;box-shadow:0 0 0 1px var(--line);transition:translate .6s var(--spring),box-shadow .5s var(--ease)}
@media (hover:hover){.card.lift:hover{translate:0 -2px;box-shadow:0 0 0 1px var(--line),0 26px 50px -30px rgba(14,14,14,.32)}}
.spot::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .45s var(--ease)}
.card.spot::after{padding:1px;background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),rgba(14,14,14,.42),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.dark.spot::after{background:radial-gradient(560px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.065),transparent 65%)}
.spot:hover::after{opacity:1}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 18px;border-radius:18px;color:#fff;background:var(--ink);overflow:hidden;transition:background-color .3s var(--ease),width .55s var(--spring),padding .55s var(--spring),scale .45s var(--spring),opacity .3s var(--ease)}
.btn:hover{background:var(--flame)}
.btn:active{scale:.94}
.btn .lb{transition:opacity .2s var(--ease)}
.btn .ck{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .5s var(--ease) .22s}
.btn.done,.btn.done:hover{padding:0;background:var(--ink)}
.btn.done .lb{opacity:0}
.btn.done .ck{stroke-dashoffset:0}
.lnkb{display:inline-flex;align-items:center;height:36px;color:var(--ink);background:linear-gradient(var(--flame),var(--flame)) 0 calc(50% + 10px)/0 1px no-repeat;transition:color .3s var(--ease),background-size .45s var(--ease),opacity .3s var(--ease)}
.lnkb:hover{color:var(--flame);background-size:100% 1px}
.acts.fin .lnkb{opacity:0;pointer-events:none}
.js .rv{opacity:0;translate:0 24px;transition:opacity .9s var(--ease),translate 1.1s var(--ease)}
.js .rv.in{opacity:1;translate:0 0}

/* 01 needs you */
.ngrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:24px}
.nc{display:flex;flex-direction:column;padding:20px;transition:translate .6s var(--spring),box-shadow .5s var(--ease),opacity .35s var(--ease),scale .5s var(--spring)}
.js .nc{animation:rise .8s var(--ease) backwards;animation-delay:calc(var(--j,0) * 60ms + 200ms)}
.nc.going{opacity:0;scale:.94}
.nc.gone{display:none}
.nt{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--g45)}
.nt .cap:first-child{display:inline-flex;align-items:center;gap:8px;color:var(--ink)}
.nt .cap:first-child::before{content:"";flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.who{margin-top:16px;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em}
.ndt{margin-top:4px;font-size:13px;line-height:20px;color:var(--g64)}
.acts{display:flex;align-items:center;gap:16px;margin-top:auto;padding-top:20px}
.clear{display:flex;align-items:center;gap:16px;margin-top:24px;padding:24px;border-radius:20px;box-shadow:0 0 0 1px var(--line);animation:rise .7s var(--ease) backwards}
.clear .ok{flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--ink)}
.clear .ok svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.clear b{display:block;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em}
.clear p{font-size:13px;line-height:20px;color:var(--g64)}

/* 02 numbers */
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));column-gap:32px;row-gap:0;margin-top:32px}
.kp{position:relative;display:block;padding-top:16px;color:inherit}
.kp::before,.kp::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--g12)}
.kp::after{background:var(--ink);transform:scaleX(0);transform-origin:0 50%;transition:transform .7s var(--ease)}
.kp:hover::after{transform:scaleX(1)}
.kp.hot::before,.kp.hot::after{height:2px;background:var(--flame)}
.kl{display:flex;justify-content:space-between;align-items:center;height:16px;color:var(--g64);transition:color .3s var(--ease)}
.kp:hover .kl{color:var(--ink)}
.kp .go{rotate:-45deg}
.kp:hover .go{opacity:1;translate:0 0}
.kv{position:relative;height:72px;margin-top:16px;overflow:hidden}
.num{display:flex;align-items:baseline;height:72px;font-size:72px;line-height:72px;font-weight:300;letter-spacing:-.055em;font-variant-numeric:tabular-nums;animation:roll 1.05s var(--ease) backwards;animation-delay:calc(var(--i,0) * 55ms + 350ms)}
@keyframes roll{from{transform:translate3d(0,100%,0)}}
.num b{font-weight:300}
.num span{color:var(--g28)}
.num.long{font-size:40px;letter-spacing:-.04em}
.viz{position:relative;height:28px;margin-top:12px}
.kn{margin-top:12px;font-size:13px;line-height:16px;color:var(--g64);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .22s var(--ease),translate .3s var(--ease)}
.kn.swap{opacity:0;translate:0 4px}
.vb,.ve{display:flex;align-items:flex-end;gap:8px}
.vb.dense{gap:4px}
.vb i,.ve i{display:block;flex:0 0 2px;width:2px;height:100%;border-radius:1px;background:var(--ink);transform-origin:50% 100%}
.vb i.g,.ve i.g{background:var(--g12)}
.vb i.f{background:var(--flame)}
.ve i:nth-child(1){height:36%}.ve i:nth-child(2){height:52%}.ve i:nth-child(3){height:68%}.ve i:nth-child(4){height:84%}.ve i:nth-child(5){height:100%}
.ve i.part{background:linear-gradient(to top,var(--ink) 10%,var(--g12) 10%)}
.vt{background:linear-gradient(var(--g12),var(--g12)) 0 20px/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--g28) 0 1px,transparent 1px 16.6667%) 0 23px/100% 5px no-repeat}
.vt i{position:absolute;display:block;transform-origin:50% 100%}
.vt .t0{top:0;height:20px;width:1px;background:var(--ink)}
.vt .d{top:18px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--ink)}
.vt .d.f{background:var(--flame)}
.vs{display:flex;align-items:flex-end;gap:4px;padding-bottom:4px}
.vs i{display:block;height:3px;border-radius:2px;background:rgba(14,14,14,var(--a));transform-origin:0 50%}
.vm::before{content:"";position:absolute;left:0;right:0;bottom:4px;height:1px;background:var(--g12)}
.vm .fill{position:absolute;left:0;bottom:3.5px;height:2px;border-radius:2px;background:var(--ink);transform-origin:0 50%}
.vm .mk25{position:absolute;bottom:0;width:1px;height:20px;background:var(--g45)}
.vm .vml{position:absolute;bottom:10px;font-size:12px;line-height:16px;color:var(--g45)}
@media (hover:hover){.kp:hover .vb i,.kp:hover .ve i,.kp:hover .vs i,.kp:hover .vt i,.kp:hover .vm .fill{animation:up .7s var(--ease) backwards;animation-delay:calc(var(--j,0) * 26ms + 40ms)}}
@keyframes up{from{transform:scaleY(0)}}
.kp:hover .vs i,.kp:hover .vm .fill{animation-name:upx}
@keyframes upx{from{transform:scaleX(0)}}

/* filter chips */
.fcs{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.fc{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 14px;border-radius:16px;font-size:13px;line-height:1;color:var(--ink);background:var(--warm);transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.fc b{font-weight:500;color:var(--g45);transition:color .3s var(--ease)}
.fc b.al{color:var(--flame)}
.fc:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.fc.on{color:#fff;background:var(--ink);box-shadow:none}
.fc.on b{color:var(--w64)}
.fc.on b.al{color:var(--flame)}
.fc:active{scale:.94}
.row{box-shadow:0 1px 0 var(--g08)}
.row.fresh{animation:fresh .45s var(--ease)}
@keyframes fresh{from{opacity:0;translate:0 6px}}

/* 03 attendance */
.ops{display:flex;flex-direction:column;gap:24px}
.atb{margin-top:16px}
.tr{display:grid;grid-template-columns:96px minmax(160px,1.3fr) 112px minmax(150px,1fr) 56px minmax(240px,2.8fr);align-items:center;gap:16px;min-height:56px;margin:0 -12px;padding:0 44px 0 12px;border-radius:12px;font-size:14px;box-shadow:none;background:linear-gradient(var(--g08),var(--g08)) 12px 100%/calc(100% - 24px) 1px no-repeat;transition:background-color .3s var(--ease)}
.tr.hd{min-height:40px;font-size:12px;color:var(--g45);border-radius:0;background:linear-gradient(var(--line),var(--line)) 12px 100%/calc(100% - 24px) 1px no-repeat}
.tr.row:last-child{background-image:none}
.tr.row:hover{background-color:var(--warm);background-image:none}
.vf{margin-left:8px;font-size:12px;color:var(--g45)}
.stt{font-size:14px}
.day{position:relative;align-self:stretch}
.day::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--g08)}
.day .g10,.day .gn{position:absolute;top:0;bottom:0;width:0}
.day .g10{left:33.333%;border-left:1px dashed var(--g28)}
.day .gn{left:58.889%;border-left:1px solid var(--flame)}
.day .b{position:absolute;top:50%;height:2px;margin-top:-1px;border-radius:2px;background:var(--g28);transform-origin:0 50%;transition:height .4s var(--spring),margin .4s var(--spring)}
.day .b.live{background:var(--ink)}
.js .day .b{transform:scaleX(0);transition:transform 1.4s var(--ease),height .4s var(--spring),margin .4s var(--spring);transition-delay:calc(var(--j,0) * 70ms),0s,0s}
.js .in .day .b{transform:none}
.tr:hover .day .b{height:4px;margin-top:-2px}
.day .lt,.day .nd{position:absolute;top:50%;z-index:1;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%}
.day .lt{background:var(--flame)}
.day .nd{background:var(--flame);animation:beat 1.8s ease-in-out infinite}
.day .ot{position:absolute;top:50%;transform:translate(-50%,-190%);color:var(--g64);opacity:0;transition:opacity .4s var(--ease),transform .5s var(--spring)}
.tr:hover .day .ot{opacity:1;transform:translate(-50%,-150%)}
.dh{position:relative;align-self:stretch}
.dh i{position:absolute;top:50%;transform:translate(-50%,-50%)}
.dh i:first-child{transform:translate(0,-50%)}
.dh i:last-child{transform:translate(-100%,-50%)}

/* 04 flags */
.sel{position:relative;display:inline-flex;align-items:center;min-width:0;max-width:60%}
.sel select{-webkit-appearance:none;appearance:none;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;height:28px;padding:0 32px 0 12px;border-radius:14px;font-size:12px;letter-spacing:.04em;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px var(--line2);transition:box-shadow .3s var(--ease)}
.sel select:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.sel svg{position:absolute;right:10px;width:14px;height:14px;pointer-events:none}
.fls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:48px;margin-top:8px}
.fl{display:grid;grid-template-columns:16px 1fr;gap:12px;padding:16px 0}
.fl>.go{right:-20px}
.sev{width:8px;height:8px;margin-top:6px;border-radius:50%;background:#C9C6BE}
.sev.h{background:var(--flame)}
.sev.m{background:var(--ink)}
.fl b{display:block;font-size:14px;line-height:20px}
.fl p{margin-top:2px;font-size:13px;line-height:20px;color:var(--g64)}
.empty{padding:24px 0 8px;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em}

/* dark band: 05 leaderboard, 06 pipeline, 07 projects */
.g543{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,3fr);column-gap:48px;row-gap:64px}
.g444{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:48px;row-gap:64px}
.g543>*,.g444>*{min-width:0}
.dark .row{box-shadow:0 1px 0 var(--w12)}
.lbr{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:end;gap:12px;padding:16px 0 12px}
.lbr.row{box-shadow:none}
.lbr>.go{right:-22px}
.lbr .rk{padding-bottom:4px}
.lbr .whom{padding-bottom:4px}
.lbr .ln{display:block;height:1px;margin-top:8px;border-radius:1px;width:var(--w);background:var(--w20);transform-origin:0 50%;transition:background-color .4s var(--ease),height .4s var(--spring),width .9s var(--spring)}
.lbr.first .ln{background:#fff}
.lbr:hover .ln{background:#fff;height:2px}
.pts{font-size:44px;line-height:40px;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums;transition:font-weight .5s var(--ease)}
.lbr.first .pts{font-size:76px;line-height:64px}
.lbr:hover .pts{font-weight:500}
.dsoft{color:var(--w45)}
.ppr{padding:16px 0}
.ppr.row{box-shadow:none}
.ppr>.go{right:-22px;top:18px;margin-top:0}
.ppt{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px}
.ppt b{font-weight:400;font-variant-numeric:tabular-nums}
.ppb{position:relative;height:2px;margin-top:12px;border-radius:2px;background:var(--w12)}
.ppb i{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:2px;background:rgba(255,255,255,var(--a));transform-origin:0 50%;transition:background-color .4s var(--ease)}
.js .ppb i{transform:scaleX(0);transition:transform 1.3s var(--ease),background-color .4s var(--ease),width .9s var(--spring);transition-delay:calc(var(--j,0) * 90ms),0s,0s}
.js .in .ppb i{transform:none}
.ppr:hover .ppb i{background:#fff}
.kvr{display:flex;justify-content:space-between;align-items:baseline;padding:14px 0;font-size:14px}
.pjs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:20px 0 24px;box-shadow:0 1px 0 var(--w12)}
.pjs .v{font-size:56px;line-height:48px;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.pjs .cap{display:flex;align-items:center;gap:8px;margin-top:12px;color:var(--w64)}
.pjs .adot{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.pjr{padding:16px 0}
.pjr>.go{right:-22px;top:18px;margin-top:0}
.pjt{display:flex;align-items:baseline;gap:12px;font-size:14px}
.pjt .grow{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pjb{position:relative;height:2px;margin-top:12px;border-radius:2px;background:var(--w12)}
.pjb i{position:absolute;left:0;top:0;bottom:0;width:var(--p);border-radius:2px;background:var(--w45);transform-origin:0 50%}
.pjb i.off{background:var(--flame)}
.js .pjb i{transform:scaleX(0);transition:transform 1.3s var(--ease) .2s,width .9s var(--spring) 0s}
.pst{margin-top:8px;font-size:13px;line-height:16px}
.js .in .pjb i{transform:none}

/* 08 people, 09 hiring, 10 voice */
.per{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:16px 0;font-size:14px}
.per>.go{right:-22px}
.tags{font-size:13px;color:var(--g45);text-align:right}
.tags .k{color:var(--ink)}
.hir{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;font-size:14px}
.hir>.go{right:-22px}
.sub{margin-top:2px;font-size:13px;line-height:18px;color:var(--g45)}
.ev{display:flex;align-items:center;gap:12px}
.ticks{display:flex;gap:4px}
.ticks i{display:block;width:2px;height:14px;border-radius:1px;background:var(--g12)}
.ticks i.on{background:var(--ink)}
.q{padding:24px 0}
.q blockquote{font-size:22px;line-height:28px;font-weight:300;letter-spacing:-.02em}
.q .sub{margin-top:12px}

/* 11 clients */
.share{display:flex;gap:4px;height:3px;margin:24px 0 16px}
.share i{display:block;border-radius:2px;transition:background-color .4s var(--ease),transform .5s var(--spring)}
.share i.hl{transform:scaleY(2)}
.ct{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.3fr) .7fr .6fr .6fr;gap:16px;align-items:center;min-height:56px;margin:0 -12px;padding:0 44px 0 12px;border-radius:12px;font-size:14px;box-shadow:none;background:linear-gradient(var(--g08),var(--g08)) 12px 100%/calc(100% - 24px) 1px no-repeat;transition:background-color .3s var(--ease),opacity .35s var(--ease)}
.ct.hd{min-height:40px;font-size:12px;color:var(--g45);border-radius:0;background:linear-gradient(var(--line),var(--line)) 12px 100%/calc(100% - 24px) 1px no-repeat}
.ct .rvn{font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
.ct.row:hover,#cli .ct.row.hl{background-color:var(--warm);background-image:none}
#cli.dim .ct.row:not(.hl){opacity:.4}
#cli.dim .share i:not(.hl){background:var(--g12)!important}
.ct.tot{margin-top:8px;min-height:64px;color:#fff;background:var(--ink);border-radius:14px}
.ct.tot .rvn{font-weight:500}

/* counter rail: where you are on the page */
.rail{position:fixed;z-index:45;right:6px;top:50%;width:24px;translate:0 -50%}
.rtr{position:absolute;left:11px;top:16px;bottom:16px;width:2px;border-radius:1px;background:var(--g12);transition:background-color .4s var(--ease)}
.rtr i{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:inherit;background:var(--flame);transform:scaleY(0);transform-origin:50% 0}
.ri{position:relative;display:block;width:24px;height:32px}
.ri::before{content:"";position:absolute;left:8px;top:12px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px var(--g28);transition:background-color .35s var(--ease),box-shadow .35s var(--ease),scale .5s var(--spring)}
.ri.past::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame)}
.ri.on::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame),0 0 0 3px #fff;scale:1.3}
.rl{position:absolute;right:32px;top:50%;display:flex;align-items:center;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;color:var(--g64);background:#fff;box-shadow:0 0 0 1px var(--line),0 12px 28px -16px rgba(14,14,14,.4);opacity:0;translate:10px -50%;pointer-events:none;transition:opacity .25s var(--ease),translate .5s var(--spring),color .25s var(--ease);transition-delay:calc(var(--k) * 22ms)}
.rail:hover .rl{opacity:1;translate:0 -50%;pointer-events:auto}
.ri.on .rl{color:var(--ink)}
.ri:hover .rl{color:var(--flame)}
.rail.dk .rtr{background:var(--w20)}
.rail.dk .ri::before{background:var(--dark);box-shadow:inset 0 0 0 2px var(--w45)}
.rail.dk .ri.past::before,.rail.dk .ri.on::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame)}

/* dynamic island */
#island{position:fixed;z-index:90;left:0;top:0;width:0;height:0;border-radius:18px;color:#fff;background:#000;overflow:hidden;opacity:0;pointer-events:none;cursor:pointer;box-shadow:0 22px 50px -18px rgba(0,0,0,.55);transition:left .62s var(--bounce),top .62s var(--bounce),width .62s var(--bounce),height .62s var(--bounce),border-radius .62s var(--bounce),opacity .16s var(--ease)}
#island.show{opacity:1;pointer-events:auto}
#island.closing{transition:left .42s var(--ease),top .42s var(--ease),width .42s var(--ease),height .42s var(--ease),border-radius .42s var(--ease),opacity .2s var(--ease) .3s}
.is-in{position:absolute;inset:0;display:flex;align-items:center;gap:14px;padding:0 16px 0 20px;opacity:0;transform:scale(.94);transition:opacity .3s var(--ease),transform .5s var(--spring)}
#island.open .is-in{opacity:1;transform:none;transition-delay:.16s}
#island .is-in.fade{opacity:0;transform:translate3d(0,-6px,0);transition-delay:0s}
.is-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.is-t b{font-size:15px;line-height:20px;font-weight:400;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-t em{font-size:12px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-wave{display:flex;align-items:center;gap:3px;height:26px;flex:0 0 auto}
.is-wave i{display:block;width:3px;height:30%;border-radius:2px;background:var(--flame);animation:wv .9s ease-in-out infinite;animation-delay:calc(var(--k) * -.17s)}
.is-wave.calm i{background:#fff;animation-duration:1.9s;opacity:.8}
.is-mic{flex:0 0 8px;width:8px;height:8px;margin-right:6px;border-radius:50%;background:var(--flame)}
.is-ck{flex:0 0 32px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#000;background:#fff}
.is-ck svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;animation:draw .5s var(--ease) .25s backwards}
@keyframes draw{from{stroke-dashoffset:24}}
.ib{flex:0 0 auto;height:32px;padding:0 14px;border-radius:16px;color:#fff;background:rgba(255,255,255,.12);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.ib:hover{background:var(--flame)}
.ib:active{scale:.94}

/* phone: capsule, menu, sections sheet, tab bar */
.pbar,.tabbar{display:none}
.lg{position:relative;isolation:isolate;background:var(--grain) rgba(255,255,255,.66);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);box-shadow:0 0 0 1px rgba(14,14,14,.06),0 14px 34px -14px rgba(14,14,14,.3),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4);transition:background-color .5s var(--ease),box-shadow .5s var(--ease)}
.lg::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(140deg,#fff,rgba(255,255,255,.3) 30%,rgba(255,255,255,0) 50%,rgba(255,255,255,.2) 75%,rgba(255,255,255,.9));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.lg.dk,.dk .lg{background-color:rgba(255,255,255,.88);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 18px 44px -14px rgba(0,0,0,.65),inset 0 1px 0 #fff}
.pm{position:relative;flex:0 0 76px;width:76px;height:22px}
.pm .lm{width:76px;height:22px;margin-top:-11px;transform:none}
.where{display:inline-flex;align-items:center;gap:8px;height:36px;margin-left:auto;padding:0 10px 0 14px;border-radius:18px;font-size:13px;line-height:1;background:rgba(14,14,14,.05);transition:scale .45s var(--spring)}
.where .wi{color:var(--flame);font-weight:500;font-variant-numeric:tabular-nums}
.where svg{width:14px;height:14px;transition:rotate .45s var(--spring)}
.where[aria-expanded="true"] svg{rotate:180deg}
.where:active,.mbtn:active{scale:.94}
.mbtn{flex:0 0 40px;width:40px;height:40px;border-radius:20px;display:grid;place-items:center;transition:scale .45s var(--spring)}
.burger{display:flex;flex-direction:column;gap:5px;width:18px}
.burger i{display:block;height:1.5px;border-radius:1px;background:var(--ink)}
.jump{position:fixed;z-index:57;left:8px;right:8px;top:72px;padding:8px;border-radius:24px;opacity:0;translate:0 -8px;scale:.98;transform-origin:50% 0;pointer-events:none;transition:opacity .25s var(--ease),translate .5s var(--spring),scale .5s var(--spring)}
.jump.open{opacity:1;translate:0 0;scale:1;pointer-events:auto}
.jump button{display:flex;align-items:center;gap:12px;width:100%;height:44px;padding:0 14px;border-radius:16px;font-size:15px;transition:background-color .25s var(--ease)}
.jump button i{width:24px;font-size:12px;letter-spacing:.04em;color:var(--g45);font-variant-numeric:tabular-nums}
.jump button.on{color:#fff;background:var(--ink)}
.jump button.on i{color:var(--flame)}
.menu{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;padding:20px 24px 40px;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(26px) saturate(160%);backdrop-filter:blur(26px) saturate(160%);opacity:0;visibility:hidden;transition:opacity .4s var(--ease),visibility 0s linear .4s}
.menu.open{opacity:1;visibility:visible;transition:opacity .4s var(--ease)}
.menu-top{display:flex;justify-content:space-between;align-items:center;height:40px}
.menu-list{margin-top:16px;overflow:auto}
.menu-list .grp{margin:24px 0 8px;padding-left:4px;font-size:12px;letter-spacing:.14em;color:var(--g45)}
.menu-list .nv{height:48px;padding-left:4px;font-size:18px;color:var(--ink);opacity:0;translate:0 12px;transition:opacity .45s var(--ease),translate .55s var(--spring)}
.menu.open .menu-list .nv{opacity:1;translate:0 0;transition-delay:calc(var(--j) * 22ms + 60ms)}
.menu-list .nv .nl{opacity:1}
.menu-list .nv .bd{position:static;transform:none;margin-left:auto}
.menu-list .nv.on{color:var(--flame)}
.tabbar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:50;align-items:flex-end;justify-content:space-between;gap:10px;pointer-events:none}
.tbg{pointer-events:auto;display:flex;align-items:center;height:62px;padding:5px;border-radius:31px;flex:1 1 0%;min-width:0;transition:flex .6s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
.tab{position:relative;z-index:1;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:52px;border-radius:26px;font-size:10px;font-weight:500;color:var(--g64);overflow:hidden;white-space:nowrap;transition:color .3s var(--ease),flex .6s var(--spring),opacity .35s var(--ease)}
.tab svg{width:22px;height:22px;flex:0 0 auto}
.tab.on{color:#fff}
.lens{position:absolute;z-index:0;top:5px;bottom:5px;left:0;width:0;border-radius:26px;background:var(--ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.16);transition:transform .6s var(--spring),width .6s var(--spring)}
.tb-ask{pointer-events:auto;flex:0 0 62px;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;color:var(--ink);transition:scale .45s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
.tb-ask svg{width:22px;height:22px}
.tb-ask:active{scale:.9}
.tabbar.min .tbg{flex:0 0 72px}
.tabbar.min .tab:not(.on){flex:0 0 0;opacity:0}
.tabbar.min .lens{transform:translate3d(5px,0,0)!important;width:62px!important}

/* v7: header that talks */
.tr2{flex:0 0 320px;width:320px;display:flex;flex-direction:column;align-items:stretch;gap:12px;margin-top:-14px}
.live{display:flex;align-items:center;gap:12px;height:28px}
.tick{position:relative;flex:1;min-width:0;height:20px;overflow:hidden;font-size:13px;line-height:20px;color:var(--g64)}
.tick span{position:absolute;left:0;right:0;top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .6s var(--spring),opacity .3s var(--ease)}
.tick span.up{transform:translateY(-100%);opacity:0}
.tick span.dn{transform:translateY(100%);opacity:0;transition:none}
.lede{display:flex;align-items:center;flex-wrap:wrap;column-gap:12px;row-gap:4px;min-height:28px;font-size:15px;line-height:20px}
.js .live{animation:rise .8s var(--ease) .16s backwards}

/* v7: numbers in four groups */
.kg{display:flex;align-items:center;height:16px;margin-bottom:16px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g45);white-space:nowrap}
.kg.k2{margin-top:48px}
.kgl{display:none;position:absolute;left:0;top:-28px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g45);font-style:normal}

/* v7: needs you cards swipe on touch */
.ncw{position:relative;display:flex;border-radius:20px;transition:translate .6s var(--spring),opacity .35s var(--ease),scale .5s var(--spring)}
.ncw>.nc{flex:1;min-width:0}
.ncw.going{opacity:0;scale:.94}
.ncw.gone{display:none}
.nsw{position:absolute;inset:0;display:flex;align-items:center;padding:0 24px;border-radius:20px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease),background-color .2s var(--ease),color .2s var(--ease)}
.nsw-l{justify-content:flex-start;color:#fff;background:var(--ink)}
.nsw-r{justify-content:flex-end;color:var(--ink);background:var(--warm);box-shadow:inset 0 0 0 1px var(--line2)}
.ncw.sl .nsw-l,.ncw.sr .nsw-r{opacity:1}
.ncw.arm.sl .nsw-l{background:var(--flame)}
.ncw.arm.sr .nsw-r{color:#fff;background:var(--ink);box-shadow:none}
.nc{position:relative;z-index:1;touch-action:pan-y}
.nc>*{transition:opacity .25s var(--ease)}
.nc.morph>*{opacity:0}
.pn{font:inherit;letter-spacing:inherit;color:inherit;background:linear-gradient(var(--flame),var(--flame)) 0 100%/0 1px no-repeat;padding-bottom:1px;transition:background-size .5s var(--ease)}
.pn:hover{background-size:100% 1px}

/* v7: flags close up, notes, highlights */
.fl{transition:translate .55s var(--spring),opacity .26s var(--ease)}
.fl.fading{opacity:0}
.fl.gone{display:none}
.fnote{display:inline-block;margin-left:8px;padding:0 8px;height:20px;border-radius:10px;font-size:12px;line-height:20px;color:#fff;background:var(--ink);animation:rise .5s var(--ease)}
:where(.flash){border-radius:12px}
.flash{outline:2px solid var(--flame);outline-offset:4px;animation:ring .7s var(--spring)}
@keyframes ring{from{outline-offset:18px}}
.flash.flash-out{outline-color:transparent;transition:outline-color .4s var(--ease)}

/* v7: pipeline leads with its number */
.pls{padding:20px 0 24px;box-shadow:0 1px 0 var(--w12)}
.pls .v{font-size:56px;line-height:48px;font-weight:300;letter-spacing:-.05em;white-space:nowrap}
.pls .cap{margin-top:12px;color:var(--w64)}

/* v7: island as the ask bar, events, buttons */
.is-ev{flex:0 0 10px;width:10px;height:10px;margin:0 4px 0 2px;border-radius:50%;background:var(--flame);animation:beat 1.2s ease-in-out infinite}
#island.cmd{cursor:default;box-shadow:0 34px 80px -24px rgba(0,0,0,.6)}
#island.cmd .is-in{display:block;padding:0}
.cb{display:flex;flex-direction:column;height:100%}
.cbr{flex:0 0 64px;display:flex;align-items:center;gap:12px;height:64px;padding:0 14px}
.cbr input{flex:1;min-width:0;height:40px;font:inherit;font-size:17px;line-height:24px;color:#fff;background:none;border:0;outline:none;caret-color:var(--flame)}
.cbr input::placeholder{color:rgba(255,255,255,.42)}
.cbm{flex:0 0 36px;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.1);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.cbm:hover{background:var(--flame)}
.cbm:active{scale:.92}
.cbm svg{width:18px;height:18px}
.cbk{color:rgba(255,255,255,.55);background:rgba(255,255,255,.08);box-shadow:none}
.cbl{flex:0 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.1);scrollbar-width:none}
.cbl::-webkit-scrollbar{display:none}
.cbh{padding:12px 12px 6px;font-size:12px;line-height:16px;letter-spacing:.14em;text-transform:lowercase;color:rgba(255,255,255,.4)}
.cbo{display:flex;align-items:center;gap:14px;width:100%;min-height:52px;padding:8px 12px;border-radius:14px;color:#fff;text-align:left;transition:background-color .2s var(--ease)}
.cbo.hi{background:rgba(255,255,255,.1)}
.cbo .ic{flex:0 0 32px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.08)}
.cbo .ic svg{width:18px;height:18px}
.cbo .tx{flex:1;min-width:0}
.cbo .tx b{display:block;font-size:15px;line-height:20px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbo .tx em{display:block;font-size:12px;line-height:16px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbo .rt{flex:0 0 auto;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.38);transition:color .2s var(--ease)}
.cbo.hi .rt{color:#fff}
.cbo.ans{min-height:76px;margin-top:4px}
.cbo.ans .ic{background:var(--flame)}
.cbo.ans .tx b{font-size:20px;line-height:26px;font-weight:300;letter-spacing:-.01em;white-space:normal}
.av2{font-size:12px;font-weight:500;letter-spacing:.02em}
.cbe{padding:18px 12px;font-size:14px;color:rgba(255,255,255,.55)}

/* v7: glass detail sheets */
.scrim{position:fixed;inset:0;z-index:84;background:rgba(14,14,14,.1);opacity:0;pointer-events:none;transition:opacity .35s var(--ease)}
.scrim.on{opacity:1;pointer-events:auto}
.sheet{position:fixed;z-index:85;top:12px;right:12px;bottom:12px;width:420px;display:flex;flex-direction:column;border-radius:28px;background-color:rgba(255,255,255,.8);background-image:var(--grain),linear-gradient(165deg,rgba(255,255,255,.7),rgba(255,255,255,0) 45%);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);box-shadow:0 0 0 1px rgba(14,14,14,.07),0 30px 70px -28px rgba(14,14,14,.45),inset 0 1px 0 #fff;transform:translate3d(calc(100% + 32px),0,0);transition:transform .6s var(--spring),translate .45s var(--spring);overflow:hidden}
.sheet.on{transform:none}
.sheet::after{content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(150deg,#fff,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 50%,rgba(255,255,255,.25) 76%,rgba(255,255,255,.95));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.grab{display:none}
.shx{position:absolute;z-index:4;top:16px;right:16px;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:var(--ink);background:rgba(14,14,14,.06);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.shx:hover{background:rgba(14,14,14,.12)}
.shx:active{scale:.92}
.shx svg{width:18px;height:18px}
.sh-in{flex:1;min-height:0;overflow-y:auto;padding:28px;scrollbar-width:none}
.sh-in::-webkit-scrollbar{display:none}
.sheet.on .sh-in>*{animation:rise .7s var(--ease) backwards}
.sheet.on .sh-in>:nth-child(2){animation-delay:.04s}
.sheet.on .sh-in>:nth-child(3){animation-delay:.08s}
.sheet.on .sh-in>:nth-child(4){animation-delay:.12s}
.sheet.on .sh-in>:nth-child(5){animation-delay:.16s}
.sheet.on .sh-in>:nth-child(6){animation-delay:.2s}
.s-hd{display:flex;align-items:center;gap:16px;padding-right:44px}
.s-av{flex:0 0 56px;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:18px;font-weight:500;color:#fff;background:var(--ink)}
.s-av.sq{border-radius:18px}
.s-av svg{width:24px;height:24px}
.s-n{font-size:26px;line-height:30px;font-weight:300;letter-spacing:-.02em}
.s-r{margin-top:2px;font-size:13px;line-height:18px;color:var(--g64)}
.s-chips{margin-top:20px}
.s-chips .chip i{background:var(--ink);animation:none}
.s-chips .chip.hot i{background:var(--flame);animation:beat 1.8s ease-in-out infinite}
.s-sec{margin-top:24px;padding-top:16px;box-shadow:0 -1px 0 var(--line)}
.s-lab{margin-bottom:12px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g45)}
.s-kv{display:flex;flex-wrap:wrap;column-gap:32px;row-gap:16px}
.s-kv b{display:block;font-size:28px;line-height:32px;font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums;white-space:nowrap}
.s-kv span{display:block;margin-top:4px;font-size:12px;line-height:16px;color:var(--g64)}
.s-li{display:flex;justify-content:space-between;align-items:baseline;gap:16px;width:100%;padding:12px 0;font-size:14px;line-height:20px;text-align:left;box-shadow:0 1px 0 var(--g08)}
.s-li:last-child{box-shadow:none}
.s-link{cursor:pointer;transition:color .3s var(--ease)}
.s-link:hover{color:var(--flame)}
.s-fl{display:inline-flex;align-items:center;gap:8px}
.s-fl .sev{flex:0 0 8px;margin-top:0}
.s-big{font-size:44px;line-height:44px;font-weight:300;letter-spacing:-.045em}
.s-cap{margin-top:8px;font-size:13px;line-height:18px;color:var(--g64)}
.s-bar{position:relative;height:3px;margin-top:16px;border-radius:2px;background:var(--g12)}
.s-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:var(--ink)}
.s-bar i.f{background:var(--flame)}
.s-bar b{position:absolute;top:-6px;width:1px;height:15px;background:var(--g45)}
.sdots{display:inline-flex;align-items:center;gap:6px}
.sdots i{width:8px;height:8px;border-radius:50%;background:var(--g12)}
.sdots i.on{background:var(--ink)}
.sdots i.f{background:var(--flame)}
.s-ticks{margin-top:12px}
.s-acts{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:28px}
.s-acts .pl{height:36px;padding:0 16px;border-radius:18px;font-size:13px}
.tab .tbd{left:calc(50% + 2px);top:5px;transform:none;z-index:2}

/* widths of the canvas, not the window, decide the grids */
@container main (max-width:1179px){
  .pls .v{font-size:46px;line-height:40px}
  .num{font-size:60px}
  .num.long{font-size:34px}
  .c-id{display:none}
  .tr{grid-template-columns:minmax(150px,1.3fr) 108px minmax(140px,1fr) 56px minmax(220px,2.6fr)}
  .g543{column-gap:40px}
}
@container main (max-width:979px){
  .num{font-size:48px;letter-spacing:-.05em}
  .num.long{font-size:26px}
  .kpis{column-gap:24px}
  .ngrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .c-pl{display:none}
  .tr{grid-template-columns:minmax(130px,1.4fr) 100px 56px minmax(160px,2.4fr)}
  .fls{grid-template-columns:minmax(0,1fr)}
  .g543,.g444{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lbr.first .pts{font-size:64px;line-height:56px}
}
@container main (max-width:759px){
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px;row-gap:32px}
  .kg{display:none}
  .kgl{display:block}
  .kp{margin-top:28px}
  .num{font-size:52px}
  .num.long{font-size:28px}
  .c-day{display:none}
  .tr{grid-template-columns:minmax(0,1fr) 100px 48px;gap:12px}
  .g543,.g444{grid-template-columns:minmax(0,1fr);row-gap:56px}
  .ct{grid-template-columns:minmax(0,1.5fr) minmax(0,1.2fr) .6fr}
  .c-op,.c-br{display:none}
}
@container main (max-width:559px){
  .ngrid{grid-template-columns:minmax(0,1fr)}
  .num{font-size:46px}
  .num.long{font-size:24px}
  .ct{gap:8px}
  .ct .rvn{font-size:18px}
}
@media (min-width:901px){
  .band{margin-left:calc(var(--inset) - var(--cl) - var(--g));padding-left:calc(var(--cl) + var(--g) - var(--inset));transition:margin-left .6s var(--spring),padding-left .6s var(--spring)}
}
@media (max-width:900px){
  :root{--g:24px;--inset:8px}
  .side,.rail,.tip{display:none}
  main{padding:84px var(--g) 120px}
  .pbar{display:flex;position:fixed;z-index:55;left:8px;right:8px;top:8px;height:56px;align-items:center;gap:8px;padding:0 8px 0 20px;border-radius:28px}
  .tabbar{display:flex}
  .top{flex-direction:column;align-items:stretch;gap:24px}
  .tr2{flex:0 0 auto;width:100%;margin-top:0}
  .kpis{display:flex;gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;margin:4px calc(-1 * var(--g)) 0;padding:0 var(--g) 4px;scroll-padding:0 var(--g);scrollbar-width:none}
  .kpis::-webkit-scrollbar{display:none}
  .kp{flex:0 0 172px;scroll-snap-align:start}
  .pls .v{font-size:44px;line-height:40px}
  .sheet{top:auto;left:8px;right:8px;bottom:8px;width:auto;max-height:86vh;transform:translate3d(0,calc(100% + 24px),0)}
  .grab{display:block;position:relative;flex:0 0 auto;width:40px;height:5px;margin:10px auto 0;border-radius:3px;background:var(--g28);touch-action:none;cursor:grab}
  .grab::before{content:"";position:absolute;inset:-14px -80px}
  .sh-in{padding:20px 20px 24px}
  .shx{top:12px;right:12px}
  h1{font-size:40px;line-height:40px}
  .band{padding:48px calc(var(--g) - var(--inset));border-radius:24px;margin:48px calc(-1 * (var(--g) - var(--inset))) 0}
  .band.dark{clip-path:inset(0 calc((1 - var(--e,1)) * 12px) round calc(24px + (1 - var(--e,1)) * 8px))}
  .sec{padding-top:56px}
  #need{padding-top:40px}
  .card{padding:20px}
  .tr,.ct{margin:0 -8px;padding:0 36px 0 8px}
  .tr,.tr.hd,.ct,.ct.hd{background-position:8px 100%;background-size:calc(100% - 16px) 1px}
  .lnk>.go{right:8px}
  .q blockquote{font-size:20px;line-height:26px}
}
@media (hover:none){
  .go{display:none}
  .lnk:hover .nm{background-size:0 1px}
  .tr,.ct{padding-right:12px}
}
@media (hover:none) and (max-width:900px){
  .tr,.ct{padding-right:8px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition-duration:.01ms!important}
  .js .rv{opacity:1;translate:0 0}
}
</style>
</head>
<body>

<aside class="side" id="side" aria-label="Main">
  <div class="sbt"><a class="lm" id="lmS" href="#top" aria-label="m360 OS home"><span class="l-react"><svg class="lmk" viewBox="0 0 1448 422" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><g class="l-pose"><g class="l-breathe"><path d="M1112 416.6C1103.1 414.6 1099.9 413.2 1092.7 408.7C1072.8 396.1 1058.1 373.5 1054 349.1C1051.7 335.5 1047.5 335.2 1038.9 347.9C1031.1 359.3 1008.6 381.2 996.5 389.3C981.6 399.1 967.8 405.3 951.7 409.5C939.9 412.5 936.3 413 926.5 413C916.8 413 913.2 412.5 901.8 409.6C886 405.5 866.8 398.2 858.5 393.2C845.7 385.5 837.1 375.9 833.6 365.3C830.6 356.3 825.9 317.8 825.3 297.5C825 285.8 824.3 278.2 823.7 277.8C821.5 276.4 817 280.2 810.6 289C798.3 305.8 775.8 327.5 752.9 344.5C719.8 369.2 672.1 391.4 632.5 400.5C601.9 407.5 593.9 408.5 563.5 408.5C533.1 408.5 532.1 408.2 522.5 398.6C503.9 379.8 502.6 359.1 519.2 347.7C526.3 342.8 532.7 341.6 547 342.3C555.3 342.7 561.8 343.8 570.5 346.1C587.9 350.8 595.2 350.6 609 345.2C627 338.2 652.1 325.7 673 313.2C686.9 305 717.4 284.2 729.5 274.8C749.5 259.2 768.1 239.5 773 228.8C775.7 222.9 775.5 220.3 772.1 216.9C769.5 214.3 768.5 214 763.2 214C755.9 214 745.7 215.9 730.8 220C720.3 222.9 712.1 225.3 681.5 234.4C663.8 239.7 643.8 243.9 633 244.6C617.4 245.7 605.1 241.4 596.7 232C590.5 225.1 588.6 219.2 589.2 208.1C589.8 194.9 590.6 193.7 622.9 158.3C642.4 136.9 657.9 118.4 658.6 115.4C659 114 658.7 112.3 657.9 111.4C656.4 109.6 657.8 109.6 628.6 111.9C615 113 602.9 111.9 596.3 109C590.3 106.4 583.4 99.6 581.4 94.4C577.9 85.3 580.8 73.6 588.8 64.8C604.7 47 683.4 12 716.5 7.9C727.2 6.5 742.7 7.3 749 9.5C759.6 13.1 769.9 24.5 772.1 34.8C772.8 38.2 773 44 772.7 49C771.5 66.6 758.9 94.3 739.2 122.5C728.5 137.7 727 140.2 727 142.6C727 146.6 730.4 147.7 744.5 148.4C786.1 150.4 816.9 165 830.5 189.4C835.6 198.5 837 203.3 838 214.9C839 226.2 840.5 229.4 843.8 227.4C845.5 226.4 847.4 223.4 863 197.8C872.8 181.6 892.2 152.8 904.5 136C932.4 97.8 953 75.5 973.8 60.8C995.1 45.8 1016.4 49.5 1027.2 70.1C1029.3 74 1029.5 75.9 1029.5 87.5C1029.5 98.3 1029.2 101.2 1027.6 104.5C1026.4 106.9 1019.3 114.6 1009.6 123.9C951.8 179.4 922.6 214 907.9 244.4C903.4 253.6 903.2 255 906 257.5C908 259.3 908.3 259.3 919.8 254.5C956.8 239.3 979.1 233.8 1004 233.8C1016.3 233.8 1019.6 234.1 1025.5 236C1035 239 1039 241.2 1045 246.5C1052.3 252.9 1054.6 254.3 1057.4 253.6C1060 253 1060 253 1066 234C1083.6 178.5 1112.8 124.5 1149.3 80C1159.9 67.1 1183.2 44.4 1194.7 35.8C1214.3 21.1 1234.6 10.9 1252 6.9C1256.7 5.8 1266.2 4.7 1273.5 4.4C1290.6 3.6 1303 6 1316.2 12.6C1342.3 25.4 1355.1 41.7 1360.6 69C1363 80.4 1363.2 83 1362.7 98.5C1362.1 118.8 1359 137.6 1352.8 158.5C1326.9 245.8 1258.4 348.1 1196.5 391.9C1180.7 403.1 1163.9 411.6 1150.5 415.2C1141.5 417.7 1119.9 418.5 1112 416.6ZM397.9 413.6C392.9 411.9 389.5 409.2 382.8 402.3C376 395.1 369.9 385.9 366.8 378.1C364.9 373.3 364.6 370.5 364.6 358.5C364.5 333.6 368.4 322.5 403.2 250.8C410.3 236.1 413 229.5 412.5 228.1C411.1 223.7 407.1 225.7 390.2 239.2C350 271.3 281.1 332.2 236.5 375.1C226.6 384.7 219.7 390.4 216.5 391.9C199.6 399.9 179.6 391.1 174 373.3C167.8 353.4 172.4 316 187.5 264.7C191.2 251.8 191.7 248.1 189.8 246.2C187.8 244.2 186.2 244.8 181.4 249.2C174.3 255.8 160.3 273.6 133.5 310.5C97 360.5 91.7 367.3 79 380.1C61.3 397.9 52.9 402.4 37.5 402.5C26.6 402.5 21.7 400.6 13.9 393.3C6.1 386 4.5 382.3 4.5 371.5L4.5 362.5L16.9 337C43.2 282.5 91.8 187.6 101.5 171.5C118.9 142.9 125.6 133.8 132.2 130.4C136.4 128.1 151.7 127.3 158 129C163.7 130.5 171.3 137.9 173 143.5C173.6 145.7 174.4 152.7 174.7 159C175 165.3 175.7 171.1 176.2 171.8C178.2 174.2 181.1 172.9 190.7 165.2C213.5 146.9 230.6 136.1 241.8 133.1C251.2 130.6 253.1 130.5 259.8 132.5C265.5 134.2 270.8 138.3 274 143.5C278.8 151.3 278.6 169 273.6 192.1C269.4 211.2 263 244.9 263 248C263 251.3 265.3 254 268 254C269 254 272.3 252.1 275.3 249.8C278.4 247.4 285.3 242.1 290.7 238C296.1 233.9 309.3 223.7 320 215.4C330.7 207.2 346.7 195 355.5 188.4C393.8 159.6 448.2 123.1 459.3 118.7C465.5 116.3 481 115.8 487.7 117.8C498.6 121.1 508.5 131.5 512.4 144C515.6 153.9 515.7 161.8 513 172.6C510.8 181.2 507.1 188.8 489.8 220.5C447.6 297.4 432.4 339.3 429.5 386C429.1 391.8 428.4 398.2 427.9 400.3C426.7 404.9 420.7 411.8 416.3 413.7C412.3 415.3 402.7 415.3 397.9 413.6ZM1132.1 359.8C1140.7 356.9 1157.6 342.9 1171 327.5C1203.7 290 1238.5 234.2 1267.2 173.6C1289.4 126.5 1296.9 101.4 1294 83.8C1291.9 70.2 1286.8 68.9 1271.3 77.8C1227.2 103.1 1161.1 187.3 1131.2 256.5C1120.1 282.2 1114.1 305.4 1113.3 325.6C1112.9 336.1 1113.1 339.8 1114.5 344.6C1116.9 352.9 1120 358.1 1123.5 359.6C1127.2 361.3 1127.9 361.3 1132.1 359.8ZM933.3 346C946.5 341.8 958.2 334.5 970.7 322.5C981.6 312.2 984.6 307.9 982.9 304.8C981.4 302 976.7 302.6 967.6 306.6C947.9 315.2 931.9 324.1 921 332.5C912.7 338.9 911.2 344.9 917.3 347.5C921.8 349.5 922.8 349.4 933.3 346Z"/><g class="l-eye"><path class="l-dot" d="M1378.5 414.8C1367.5 410.7 1356.6 397.7 1352.6 384.1C1347.9 367.9 1354 347.7 1367.9 334C1376 326 1384.2 321.5 1393.5 320C1416 316.3 1433.5 327.1 1441.6 349.6C1449.7 371.8 1435.9 399 1410.2 411.7C1403.4 415.1 1402.2 415.4 1392.2 415.7C1385.9 415.8 1380.3 415.5 1378.5 414.8Z"/></g></g></g></svg></span></a></div>
  <nav class="snav" id="snav" aria-label="Pages">
    <span class="sp sp-h" aria-hidden="true"></span><span class="sp sp-a" aria-hidden="true"></span><span class="here" aria-hidden="true"></span>
    <div class="sgl"><span>founder</span></div>
    <a class="nv on" href="#" aria-current="page" data-t="Command" style="--j:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="12" rx="2.2"/><path d="M8 20h8M12 16v4M7 12l2.5-3 2.5 2 3-4"/></svg><span class="nl">Command</span><b class="bd" data-bd="need">4</b></a>
    <a class="nv" href="#" data-t="Desk" style="--j:1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 9.5h17v10h-17z"/><path d="M7.5 9.5V6.5a4.5 4.5 0 0 1 9 0v3"/></svg><span class="nl">Desk</span><b class="bd">2</b></a>
    <a class="nv" href="#" data-t="Today" style="--j:2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg><span class="nl">Today</span></a>
    <div class="sgl"><span>work</span></div>
    <a class="nv" href="#" data-t="My tasks" style="--j:3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="16.5" y="4" width="4" height="7" rx="1.6"/></svg><span class="nl">My tasks</span></a>
    <a class="nv" href="#" data-t="Projects" style="--j:4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></svg><span class="nl">Projects</span></a>
    <a class="nv" href="#" data-t="Pitches" style="--j:5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 17.5l5.5-6 4 4 7.5-9"/><path d="M15.5 6.5h5v5"/></svg><span class="nl">Pitches</span></a>
    <a class="nv" href="#" data-t="Clients" style="--j:6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="17" height="12.5" rx="2.4"/><path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7M3.5 12.5h17"/></svg><span class="nl">Clients</span></a>
    <div class="sgl"><span>team</span></div>
    <a class="nv" href="#" data-t="Feed" style="--j:7"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 3.5z"/></svg><span class="nl">Feed</span></a>
    <a class="nv" href="#" data-t="The week" style="--j:8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg><span class="nl">The week</span></a>
    <a class="nv" href="#" data-t="Scores" style="--j:9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 20.5h10M12 16.5v4"/><path d="M6.5 3.5h11v5.5a5.5 5.5 0 0 1-11 0z"/><path d="M6.5 6H3.5a2.5 2.5 0 0 0 2.5 4M17.5 6h3a2.5 2.5 0 0 1-2.5 4"/></svg><span class="nl">Scores</span></a>
    <a class="nv" href="#" data-t="People" style="--j:10"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.5" r="2.4"/><path d="M16 14.2a4.8 4.8 0 0 1 5 5.3"/></svg><span class="nl">People</span></a>
    <a class="nv" href="#" data-t="Hiring" style="--j:11"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M17 4.5l1 1 2-2"/></svg><span class="nl">Hiring</span><b class="bd">1</b></a>
    <a class="nv" href="#" data-t="Handbook" style="--j:12"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/></svg><span class="nl">Handbook</span></a>
    <a class="nv" href="#" data-t="Voice" style="--j:13"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v9H10l-4 3.5v-3.5H4z"/><path d="M8 11h8"/></svg><span class="nl">Voice</span></a>
    <a class="nv" href="#" data-t="Leave" style="--j:14"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16M6.5 19.5c0-5 2.5-9.5 5.5-12.5 3 3 5.5 7.5 5.5 12.5"/><path d="M12 7v12.5"/></svg><span class="nl">Leave</span></a>
  </nav>
  <div class="sfoot">
    <button class="nv" id="sAsk" type="button" data-t="Ask m360" data-k="1" style="--j:15"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg><span class="nl">Ask m360</span><kbd class="kb nl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>K</kbd></button>
    <button class="nv" id="sTog" type="button" data-t="Expand" aria-expanded="false" style="--j:16"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><path d="M9.5 4.5v15"/></svg><span class="nl">Collapse</span></button>
    <a class="nv" href="#" data-t="Kaavish" style="--j:17"><span class="av">K</span><span class="nl">Kaavish<small>Founder</small></span></a>
  </div>
</aside>
<div class="tip" id="tip" aria-hidden="true"></div>

<nav class="rail" id="rail" aria-label="On this page"><span class="rtr" aria-hidden="true"><i></i></span></nav>

<div class="pbar lg" id="pbar">
  <span class="pm"><a class="lm" id="lmP" href="#top" aria-label="m360 OS home"><span class="l-react"><svg class="lmk" viewBox="0 0 1448 422" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><g class="l-pose"><g class="l-breathe"><path d="M1112 416.6C1103.1 414.6 1099.9 413.2 1092.7 408.7C1072.8 396.1 1058.1 373.5 1054 349.1C1051.7 335.5 1047.5 335.2 1038.9 347.9C1031.1 359.3 1008.6 381.2 996.5 389.3C981.6 399.1 967.8 405.3 951.7 409.5C939.9 412.5 936.3 413 926.5 413C916.8 413 913.2 412.5 901.8 409.6C886 405.5 866.8 398.2 858.5 393.2C845.7 385.5 837.1 375.9 833.6 365.3C830.6 356.3 825.9 317.8 825.3 297.5C825 285.8 824.3 278.2 823.7 277.8C821.5 276.4 817 280.2 810.6 289C798.3 305.8 775.8 327.5 752.9 344.5C719.8 369.2 672.1 391.4 632.5 400.5C601.9 407.5 593.9 408.5 563.5 408.5C533.1 408.5 532.1 408.2 522.5 398.6C503.9 379.8 502.6 359.1 519.2 347.7C526.3 342.8 532.7 341.6 547 342.3C555.3 342.7 561.8 343.8 570.5 346.1C587.9 350.8 595.2 350.6 609 345.2C627 338.2 652.1 325.7 673 313.2C686.9 305 717.4 284.2 729.5 274.8C749.5 259.2 768.1 239.5 773 228.8C775.7 222.9 775.5 220.3 772.1 216.9C769.5 214.3 768.5 214 763.2 214C755.9 214 745.7 215.9 730.8 220C720.3 222.9 712.1 225.3 681.5 234.4C663.8 239.7 643.8 243.9 633 244.6C617.4 245.7 605.1 241.4 596.7 232C590.5 225.1 588.6 219.2 589.2 208.1C589.8 194.9 590.6 193.7 622.9 158.3C642.4 136.9 657.9 118.4 658.6 115.4C659 114 658.7 112.3 657.9 111.4C656.4 109.6 657.8 109.6 628.6 111.9C615 113 602.9 111.9 596.3 109C590.3 106.4 583.4 99.6 581.4 94.4C577.9 85.3 580.8 73.6 588.8 64.8C604.7 47 683.4 12 716.5 7.9C727.2 6.5 742.7 7.3 749 9.5C759.6 13.1 769.9 24.5 772.1 34.8C772.8 38.2 773 44 772.7 49C771.5 66.6 758.9 94.3 739.2 122.5C728.5 137.7 727 140.2 727 142.6C727 146.6 730.4 147.7 744.5 148.4C786.1 150.4 816.9 165 830.5 189.4C835.6 198.5 837 203.3 838 214.9C839 226.2 840.5 229.4 843.8 227.4C845.5 226.4 847.4 223.4 863 197.8C872.8 181.6 892.2 152.8 904.5 136C932.4 97.8 953 75.5 973.8 60.8C995.1 45.8 1016.4 49.5 1027.2 70.1C1029.3 74 1029.5 75.9 1029.5 87.5C1029.5 98.3 1029.2 101.2 1027.6 104.5C1026.4 106.9 1019.3 114.6 1009.6 123.9C951.8 179.4 922.6 214 907.9 244.4C903.4 253.6 903.2 255 906 257.5C908 259.3 908.3 259.3 919.8 254.5C956.8 239.3 979.1 233.8 1004 233.8C1016.3 233.8 1019.6 234.1 1025.5 236C1035 239 1039 241.2 1045 246.5C1052.3 252.9 1054.6 254.3 1057.4 253.6C1060 253 1060 253 1066 234C1083.6 178.5 1112.8 124.5 1149.3 80C1159.9 67.1 1183.2 44.4 1194.7 35.8C1214.3 21.1 1234.6 10.9 1252 6.9C1256.7 5.8 1266.2 4.7 1273.5 4.4C1290.6 3.6 1303 6 1316.2 12.6C1342.3 25.4 1355.1 41.7 1360.6 69C1363 80.4 1363.2 83 1362.7 98.5C1362.1 118.8 1359 137.6 1352.8 158.5C1326.9 245.8 1258.4 348.1 1196.5 391.9C1180.7 403.1 1163.9 411.6 1150.5 415.2C1141.5 417.7 1119.9 418.5 1112 416.6ZM397.9 413.6C392.9 411.9 389.5 409.2 382.8 402.3C376 395.1 369.9 385.9 366.8 378.1C364.9 373.3 364.6 370.5 364.6 358.5C364.5 333.6 368.4 322.5 403.2 250.8C410.3 236.1 413 229.5 412.5 228.1C411.1 223.7 407.1 225.7 390.2 239.2C350 271.3 281.1 332.2 236.5 375.1C226.6 384.7 219.7 390.4 216.5 391.9C199.6 399.9 179.6 391.1 174 373.3C167.8 353.4 172.4 316 187.5 264.7C191.2 251.8 191.7 248.1 189.8 246.2C187.8 244.2 186.2 244.8 181.4 249.2C174.3 255.8 160.3 273.6 133.5 310.5C97 360.5 91.7 367.3 79 380.1C61.3 397.9 52.9 402.4 37.5 402.5C26.6 402.5 21.7 400.6 13.9 393.3C6.1 386 4.5 382.3 4.5 371.5L4.5 362.5L16.9 337C43.2 282.5 91.8 187.6 101.5 171.5C118.9 142.9 125.6 133.8 132.2 130.4C136.4 128.1 151.7 127.3 158 129C163.7 130.5 171.3 137.9 173 143.5C173.6 145.7 174.4 152.7 174.7 159C175 165.3 175.7 171.1 176.2 171.8C178.2 174.2 181.1 172.9 190.7 165.2C213.5 146.9 230.6 136.1 241.8 133.1C251.2 130.6 253.1 130.5 259.8 132.5C265.5 134.2 270.8 138.3 274 143.5C278.8 151.3 278.6 169 273.6 192.1C269.4 211.2 263 244.9 263 248C263 251.3 265.3 254 268 254C269 254 272.3 252.1 275.3 249.8C278.4 247.4 285.3 242.1 290.7 238C296.1 233.9 309.3 223.7 320 215.4C330.7 207.2 346.7 195 355.5 188.4C393.8 159.6 448.2 123.1 459.3 118.7C465.5 116.3 481 115.8 487.7 117.8C498.6 121.1 508.5 131.5 512.4 144C515.6 153.9 515.7 161.8 513 172.6C510.8 181.2 507.1 188.8 489.8 220.5C447.6 297.4 432.4 339.3 429.5 386C429.1 391.8 428.4 398.2 427.9 400.3C426.7 404.9 420.7 411.8 416.3 413.7C412.3 415.3 402.7 415.3 397.9 413.6ZM1132.1 359.8C1140.7 356.9 1157.6 342.9 1171 327.5C1203.7 290 1238.5 234.2 1267.2 173.6C1289.4 126.5 1296.9 101.4 1294 83.8C1291.9 70.2 1286.8 68.9 1271.3 77.8C1227.2 103.1 1161.1 187.3 1131.2 256.5C1120.1 282.2 1114.1 305.4 1113.3 325.6C1112.9 336.1 1113.1 339.8 1114.5 344.6C1116.9 352.9 1120 358.1 1123.5 359.6C1127.2 361.3 1127.9 361.3 1132.1 359.8ZM933.3 346C946.5 341.8 958.2 334.5 970.7 322.5C981.6 312.2 984.6 307.9 982.9 304.8C981.4 302 976.7 302.6 967.6 306.6C947.9 315.2 931.9 324.1 921 332.5C912.7 338.9 911.2 344.9 917.3 347.5C921.8 349.5 922.8 349.4 933.3 346Z"/><g class="l-eye"><path class="l-dot" d="M1378.5 414.8C1367.5 410.7 1356.6 397.7 1352.6 384.1C1347.9 367.9 1354 347.7 1367.9 334C1376 326 1384.2 321.5 1393.5 320C1416 316.3 1433.5 327.1 1441.6 349.6C1449.7 371.8 1435.9 399 1410.2 411.7C1403.4 415.1 1402.2 415.4 1392.2 415.7C1385.9 415.8 1380.3 415.5 1378.5 414.8Z"/></g></g></g></svg></span></a></span>
  <button class="where" id="where" type="button" aria-haspopup="true" aria-expanded="false"><i class="wi">01</i><span class="wl">needs you</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg></button>
  <button class="mbtn" id="menuBtn" type="button" aria-label="Menu" aria-controls="menu" aria-expanded="false"><span class="burger"><i></i><i></i></span></button>
</div>
<div class="jump lg" id="jump" aria-hidden="true"></div>

<main id="main">
  <header class="top" id="top">
    <div class="tl">
      <span class="lab">monday 2 november, week 45</span>
      <h1>Command<i class="fd">.</i></h1>
      <p class="lede"><span id="greet">Good morning, Kaavish.</span><a class="needl" id="needl" href="#need" data-go="need"><b>4</b> things need you<i class="ar"></i></a></p>
    </div>
    <div class="tr2">
      <button class="askf" id="ask" type="button"><span class="wv"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i></span><span class="ph">Ask m360 anything</span><kbd class="kb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>K</kbd></button>
      <div class="live"><span class="chip"><i></i>live</span><span class="tick" id="tick"><span>Synced, all quiet</span></span></div>
    </div>
  </header>

  <section class="sec" id="need" data-l="needs you">
    <div class="sh"><span class="eb"><i>01</i>needs you</span><span class="pl hot tn" id="np">4 waiting</span></div>
    <div class="ngrid" id="ngrid">
      <div class="ncw" data-id="zs"><span class="nsw nsw-l cap">APPROVE</span><span class="nsw nsw-r cap">DECLINE</span>
        <article class="card nc lift spot hotz" style="--j:0" data-act="leave" data-sub="ZOYA SHAIKH, 9 TO 10 NOV, CASUAL" data-ok="Approved" data-no="Declined">
          <div class="nt"><span class="cap">LEAVE REQUEST</span><span class="cap">2 DAYS</span></div>
          <h3 class="who"><button type="button" class="pn" data-open="p:zs">Zoya Shaikh</button></h3>
          <p class="ndt">Casual leave, 9 to 10 Nov</p>
          <div class="acts"><button class="btn cap" type="button" data-a="ok"><span class="lb">APPROVE</span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button><button class="lnkb cap" type="button" data-a="no">DECLINE</button></div>
        </article>
      </div>
      <div class="ncw" data-id="am"><span class="nsw nsw-l cap">APPROVE</span><span class="nsw nsw-r cap">DECLINE</span>
        <article class="card nc lift spot hotz" style="--j:1" data-act="swap" data-sub="AARAV MEHTA, OFFICE DAY MOVES TO 21 NOV" data-ok="Approved" data-no="Declined">
          <div class="nt"><span class="cap">WFH SWAP</span><span class="cap">1 DAY</span></div>
          <h3 class="who"><button type="button" class="pn" data-open="p:am">Aarav Mehta</button></h3>
          <p class="ndt">Office day moves to 21 Nov</p>
          <div class="acts"><button class="btn cap" type="button" data-a="ok"><span class="lb">APPROVE</span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button><button class="lnkb cap" type="button" data-a="no">DECLINE</button></div>
        </article>
      </div>
      <div class="ncw" data-id="vd"><span class="nsw nsw-l cap">NUDGE</span><span class="nsw nsw-r cap">MARK LEAVE</span>
        <article class="card nc lift spot hotz" style="--j:2" data-act="vd" data-sub="VIHAAN DESAI, TODAY" data-ok="Nudge sent" data-no="Marked as leave">
          <div class="nt"><span class="cap">HIGH FLAG</span><span class="cap">NOW</span></div>
          <h3 class="who"><button type="button" class="pn" data-open="p:vd">Vihaan Desai</button></h3>
          <p class="ndt">Not in by 10:00, no leave on file</p>
          <div class="acts"><button class="btn cap" type="button" data-a="ok"><span class="lb">NUDGE</span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button><button class="lnkb cap" type="button" data-a="no">MARK LEAVE</button></div>
        </article>
      </div>
      <div class="ncw" data-id="ks"><span class="nsw nsw-l cap">ADD NOTE</span><span class="nsw nsw-r cap">EXCUSE</span>
        <article class="card nc lift spot hotz" style="--j:3" data-act="ks" data-sub="KABIR SOOD, LATE ON 2 NOV" data-ok="Note added" data-no="Excused">
          <div class="nt"><span class="cap">HIGH FLAG</span><span class="cap">3RD THIS MONTH</span></div>
          <h3 class="who"><button type="button" class="pn" data-open="p:ks">Kabir Sood</button></h3>
          <p class="ndt">In at 10:24, third late this month</p>
          <div class="acts"><button class="btn cap" type="button" data-a="ok"><span class="lb">ADD NOTE</span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button><button class="lnkb cap" type="button" data-a="no">EXCUSE</button></div>
        </article>
      </div>
    </div>
    <div class="clear" id="nclear" hidden><span class="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span><div><b>All clear.</b><p>Nothing needs you right now.</p></div></div>
  </section>

  <section class="sec" id="nums" data-l="numbers">
    <div class="sh"><span class="eb"><i>02</i>numbers, today</span><span class="pl tn">week 45</span></div>
    <div class="kpis" id="kpis">
      <div class="kg" style="grid-column:span 4">people</div><div class="kg">mood</div>
      <a class="kp hot hotz" data-k="in" href="#att" data-go="att" style="--i:0"><span class="kgl">people</span><div class="kl"><span class="cap">IN TODAY</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>7</b><span>/8</span></div></div><div class="viz vb"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i class="f"></i></div>
        <div class="kn">Not in: Vihaan Desai</div></a>
      <a class="kp hot hotz" data-k="late" href="#att" data-go="att" style="--i:1"><div class="kl"><span class="cap">LATE TODAY</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>1</b></div></div><div class="viz vt"><i class="t0" style="left:33.333%"></i><i class="d" style="left:22.778%"></i><i class="d" style="left:26.111%"></i><i class="d" style="left:28.889%"></i><i class="d" style="left:30.556%"></i><i class="d" style="left:32.222%"></i><i class="d" style="left:32.778%"></i><i class="d f" style="left:46.667%"></i></div>
        <div class="kn">Kabir Sood, 10:24</div></a>
      <a class="kp" data-k="ver" href="#att" data-go="att" style="--i:2"><div class="kl"><span class="cap">OFFICE VERIFIED</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>100</b><span>%</span></div></div><div class="viz vb"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="kn">5 of 5</div></a>
      <a class="kp" data-k="eod" href="#team" data-go="team" style="--i:3"><div class="kl"><span class="cap">EOD SATURDAY</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>8</b><span>/8</span></div></div><div class="viz vb"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="kn">Everyone filed</div></a>
      <a class="kp" data-k="mood" href="#team" data-go="team" style="--i:4"><span class="kgl">mood</span><div class="kl"><span class="cap">TEAM ENERGY</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>4.1</b><span>/5</span></div></div><div class="viz ve"><i></i><i></i><i></i><i></i><i class="part"></i></div>
        <div class="kn">Week 44</div></a>
      <div class="kg k2" style="grid-column:span 3">work</div><div class="kg k2" style="grid-column:span 2">money</div>
      <a class="kp" data-k="out" href="#team" data-go="team" style="--i:5"><span class="kgl">work</span><div class="kl"><span class="cap">OUTCOMES HIT</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>7</b><span>/26</span></div></div><div class="viz vb dense"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i><i class="g"></i></div>
        <div class="kn">This week</div></a>
      <a class="kp hot hotz" data-k="due" href="#flg" data-go="flg" style="--i:6"><div class="kl"><span class="cap">TASKS OVERDUE</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>3</b></div></div><div class="viz vb"><i class="f"></i><i class="f"></i><i class="f"></i></div>
        <div class="kn">Across the team</div></a>
      <a class="kp hot hotz" data-k="hf" href="#flg" data-go="flg" style="--i:7"><div class="kl"><span class="cap">HIGH FLAGS</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>2</b></div></div><div class="viz vb"><i class="f"></i><i class="f"></i><i></i><i></i><i></i><i class="g"></i><i class="g"></i></div>
        <div class="kn">7 flags in total</div></a>
      <a class="kp" data-k="pipe" href="#ppl" data-go="dark" style="--i:8"><span class="kgl">money</span><div class="kl"><span class="cap">WEIGHTED PIPELINE</span><i class="go"></i></div>
        <div class="kv"><div class="num long"><b>&#8377;16,65,000</b></div></div><div class="viz vs"><i style="flex:180;--a:.18"></i><i style="flex:260;--a:.32"></i><i style="flex:310;--a:.48"></i><i style="flex:495;--a:.68"></i><i style="flex:420;--a:.92"></i></div>
        <div class="kn">19 open deals, a month</div></a>
      <a class="kp" data-k="cl" href="#cli" data-go="cli" style="--i:9"><div class="kl"><span class="cap">LARGEST CLIENT</span><i class="go"></i></div>
        <div class="kv"><div class="num"><b>24</b><span>%</span></div></div><div class="viz vm"><i class="fill" style="width:24%"></i><i class="mk25" style="left:25%"></i><i class="vml" style="left:calc(25% + 8px)">cap 25%</i></div>
        <div class="kn">Share of revenue</div></a>
    </div>
  </section>

  <section class="band warm ops">
    <div class="card rv" id="att" data-l="attendance">
      <div class="sh"><span class="eb"><i>03</i>attendance, this morning</span><button class="pl" type="button">export</button></div>
      <div class="fcs" id="attF" role="group" aria-label="Filter attendance">
        <button class="fc on" type="button" data-f="" aria-pressed="true">All <b class="tn">8</b></button>
        <button class="fc" type="button" data-f="off" aria-pressed="false">In office <b class="tn">5</b></button>
        <button class="fc" type="button" data-f="wfh" aria-pressed="false">WFH <b class="tn">2</b></button>
        <button class="fc" type="button" data-f="late" aria-pressed="false">Late <b class="tn al">1</b></button>
        <button class="fc" type="button" data-f="out" aria-pressed="false">Not in <b class="tn al">1</b></button>
      </div>
      <div class="atb" role="table" aria-label="Attendance this morning">
        <div class="tr hd cap" role="row"><span class="c-id">ID</span><span>PERSON</span><span>STATUS</span><span class="c-pl">PLACE</span><span>IN</span><span class="c-day dh"><i style="left:0">09:00</i><i style="left:33.333%">10:00</i><i class="al" style="left:58.889%">NOW</i><i style="left:100%">12:00</i></span></div>
        <div class="tr row lnk" role="row" data-id="kr" data-open="p:kr" data-f="off" data-in="09:41"><span class="c-id cap soft tn">M360-001</span><span><span class="nm">Kaavish Ramchandani</span></span><span class="stt">In office</span><span class="c-pl">Mumbai HQ<span class="vf">verified</span></span><span class="tn tin">09:41</span><span class="c-day day"></span></div>
        <div class="tr row lnk" role="row" data-id="mk" data-open="p:mk" data-f="off" data-in="09:52"><span class="c-id cap soft tn">M360-002</span><span><span class="nm">Meher Kapoor</span></span><span class="stt">In office</span><span class="c-pl">Mumbai HQ<span class="vf">verified</span></span><span class="tn tin">09:52</span><span class="c-day day"></span></div>
        <div class="tr row lnk" role="row" data-id="am" data-open="p:am" data-f="off" data-in="09:47"><span class="c-id cap soft tn">M360-003</span><span><span class="nm">Aarav Mehta</span></span><span class="stt">In office</span><span class="c-pl">Mumbai HQ<span class="vf">verified</span></span><span class="tn tin">09:47</span><span class="c-day day"></span></div>
        <div class="tr row lnk hotz" role="row" data-id="ks" data-open="p:ks" data-f="off late" data-in="10:24"><span class="c-id cap soft tn">M360-004</span><span><span class="nm">Kabir Sood</span></span><span class="stt">In office</span><span class="c-pl">Mumbai HQ<span class="vf">verified</span></span><span class="tn tin al">10:24</span><span class="c-day day"></span></div>
        <div class="tr row lnk" role="row" data-id="zs" data-open="p:zs" data-f="wfh" data-in="09:58"><span class="c-id cap soft tn">M360-005</span><span><span class="nm">Zoya Shaikh</span></span><span class="stt">WFH</span><span class="c-pl">Home</span><span class="tn tin">09:58</span><span class="c-day day"></span></div>
        <div class="tr row lnk" role="row" data-id="ri" data-open="p:ri" data-f="off" data-in="09:55"><span class="c-id cap soft tn">M360-006</span><span><span class="nm">Rhea Iyer</span></span><span class="stt">In office</span><span class="c-pl">Dubai office<span class="vf">verified</span></span><span class="tn tin">09:55</span><span class="c-day day"></span></div>
        <div class="tr row lnk" role="row" data-id="tn" data-open="p:tn" data-f="wfh" data-in="09:59"><span class="c-id cap soft tn">M360-007</span><span><span class="nm">Tara Nair</span></span><span class="stt">WFH</span><span class="c-pl">Home</span><span class="tn tin">09:59</span><span class="c-day day"></span></div>
        <div class="tr row lnk hotz" role="row" data-id="vd" data-open="p:vd" data-f="out"><span class="c-id cap soft tn">M360-008</span><span><span class="nm">Vihaan Desai</span></span><span class="stt al">Not in yet</span><span class="c-pl"></span><span class="tn tin"></span><span class="c-day day"></span></div>
      </div>
    </div>

    <div class="card rv" id="flg" data-l="flags">
      <div class="sh"><span class="eb"><i>04</i>flags</span>
        <label class="sel"><select id="ruleSel" aria-label="Filter by rule">
          <option value="">all rules</option>
          <option value="R01">Check in by start time</option>
          <option value="R02">On time</option>
          <option value="R03">Office check-ins are verified</option>
          <option value="R04">EOD line</option>
          <option value="R05">Monday outcomes</option>
          <option value="R06">WFH cap</option>
          <option value="R07">Finish it</option>
          <option value="R08">Show it at 20%</option>
          <option value="R09">Revision cap</option>
          <option value="R10">Escalate blockers</option>
          <option value="R11">Read the handbook</option>
          <option value="R12">The ladder</option>
          <option value="R13">Pitch next steps</option>
          <option value="R14">Projects on track</option>
          <option value="R15">Client brain kept current</option>
          <option value="R16">Hiring panel on time</option>
        </select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg></label>
      </div>
      <div class="fcs" id="flgF" role="group" aria-label="Filter flags">
        <button class="fc on" type="button" data-f="" aria-pressed="true">All <b class="tn">7</b></button>
        <button class="fc" type="button" data-f="h" aria-pressed="false">High <b class="tn al">2</b></button>
        <button class="fc" type="button" data-f="m" aria-pressed="false">Medium <b class="tn">3</b></button>
        <button class="fc" type="button" data-f="l" aria-pressed="false">Low <b class="tn">2</b></button>
      </div>
      <p class="empty" id="clear" hidden>All clear.</p>
      <div class="fls">
        <div class="fl row lnk hotz" data-rule="R01" data-f="h" data-p="vd" data-open="p:vd"><span class="sev h"></span><div><b><span class="nm">Vihaan Desai</span>, Check in by start time</b><p><span class="ft">Not in by 10:00, no leave on file</span></p></div></div>
        <div class="fl row lnk hotz" data-rule="R02" data-f="h" data-p="ks" data-open="p:ks"><span class="sev h"></span><div><b><span class="nm">Kabir Sood</span>, On time</b><p><span class="ft">In at 10:24, third late this month</span></p></div></div>
        <div class="fl row lnk" data-rule="R10" data-f="m" data-p="zs" data-open="p:zs"><span class="sev m"></span><div><b><span class="nm">Zoya Shaikh</span>, Escalate blockers</b><p><span class="ft">Blocked 2 days running on the festive film edit</span></p></div></div>
        <div class="fl row lnk" data-rule="R09" data-f="m" data-p="mk" data-open="p:mk"><span class="sev m"></span><div><b><span class="nm">Meher Kapoor</span>, Revision cap</b><p><span class="ft">Round 4 on the Q4 deck, the cap is 3</span></p></div></div>
        <div class="fl row lnk" data-rule="R13" data-f="m" data-p="am" data-open="p:am"><span class="sev m"></span><div><b><span class="nm">Aarav Mehta</span>, Pitch next steps</b><p><span class="ft">Next step on 1 pitch is 3 days late</span></p></div></div>
        <div class="fl row lnk" data-rule="R11" data-f="l" data-p="tn" data-open="p:tn"><span class="sev"></span><div><b><span class="nm">Tara Nair</span>, Read the handbook</b><p><span class="ft">2 updated sections unread</span></p></div></div>
        <div class="fl row lnk" data-rule="R15" data-f="l" data-p="ri" data-open="p:ri"><span class="sev"></span><div><b><span class="nm">Rhea Iyer</span>, Client brain kept current</b><p><span class="ft">Real estate developer brain at 1 of 3</span></p></div></div>
      </div>
    </div>
  </section>

  <section class="band dark spot" id="dark" data-l="business">
    <div class="g543">
      <div class="rv" id="lbd">
        <div class="sh"><span class="eb"><i>05</i>leaderboard, this week</span><button class="pl" type="button">scores</button></div>
        <div class="lbr row lnk first" data-id="lb-mk" data-open="p:mk"><span class="rk dsoft tn">1</span><div class="whom"><span class="nm">Meher Kapoor</span><i class="ln" style="--w:100%"></i></div><span class="pts" data-n="34">34</span></div>
        <div class="lbr row lnk" data-id="lb-am" data-open="p:am"><span class="rk dsoft tn">2</span><div class="whom"><span class="nm">Aarav Mehta</span><i class="ln" style="--w:85%"></i></div><span class="pts" data-n="29">29</span></div>
        <div class="lbr row lnk" data-id="lb-ri" data-open="p:ri"><span class="rk dsoft tn">3</span><div class="whom"><span class="nm">Rhea Iyer</span><i class="ln" style="--w:76%"></i></div><span class="pts" data-n="26">26</span></div>
        <div class="lbr row lnk" data-id="lb-zs" data-open="p:zs"><span class="rk dsoft tn">4</span><div class="whom"><span class="nm">Zoya Shaikh</span><i class="ln" style="--w:62%"></i></div><span class="pts" data-n="21">21</span></div>
        <div class="lbr row lnk" data-id="lb-tn" data-open="p:tn"><span class="rk dsoft tn">5</span><div class="whom"><span class="nm">Tara Nair</span><i class="ln" style="--w:53%"></i></div><span class="pts" data-n="18">18</span></div>
      </div>
      <div class="rv" id="ppl">
        <div class="sh"><span class="eb"><i>06</i>pipeline</span><button class="pl" type="button">open</button></div>
        <div class="pls"><div class="v tn" id="plTot" data-n="1665000" data-fmt="inr">&#8377;16,65,000</div><div class="cap" id="plCap">19 OPEN DEALS, A MONTH</div></div>
        <div class="ppr row lnk" data-id="st-s1" data-open="s:s1" style="--w:36%;--a:.3;--j:0"><div class="ppt"><span>Lead</span><b>6, &#8377;1,80,000</b></div><div class="ppb"><i></i></div></div>
        <div class="ppr row lnk" data-id="st-s2" data-open="s:s2" style="--w:53%;--a:.44;--j:1"><div class="ppt"><span>Qualified</span><b>4, &#8377;2,60,000</b></div><div class="ppb"><i></i></div></div>
        <div class="ppr row lnk" data-id="st-s3" data-open="s:s3" style="--w:63%;--a:.58;--j:2"><div class="ppt"><span>Diagnostic</span><b>3, &#8377;3,10,000</b></div><div class="ppb"><i></i></div></div>
        <div class="ppr row lnk" data-id="st-s4" data-open="s:s4" style="--w:100%;--a:.76;--j:3"><div class="ppt"><span>Proposal sent</span><b>4, &#8377;4,95,000</b></div><div class="ppb"><i></i></div></div>
        <div class="ppr row lnk" data-id="st-s5" data-open="s:s5" style="--w:85%;--a:.95;--j:4"><div class="ppt"><span>Negotiation</span><b>2, &#8377;4,20,000</b></div><div class="ppb"><i></i></div></div>
        <div class="kvr row"><span class="dsoft">Won this month</span><span class="tn">2</span></div>
        <div class="kvr row"><span class="dsoft">Next steps overdue</span><span class="tn al">1</span></div>
      </div>
      <div class="rv" id="pjc">
        <div class="sh"><span class="eb"><i>07</i>projects</span><button class="pl" type="button">open</button></div>
        <div class="pjs">
          <div><div class="v" id="pjOn" data-n="6">6</div><div class="cap">ON TRACK</div></div>
          <div><div class="v" id="pjRisk" data-n="2">2</div><div class="cap">AT RISK</div></div>
          <div><div class="v al" data-n="1">1</div><div class="cap"><i class="adot"></i>OFF</div></div>
        </div>
        <div class="pjr row lnk" data-id="pj-j1" data-open="j:j1"><div class="pjt"><span class="grow nm">Festive campaign film</span><span class="tn pp">62%</span></div><div class="pjb"><i style="--p:62%"></i></div><div class="pst dsoft">At risk</div></div>
        <div class="pjr row lnk" data-id="pj-j2" data-open="j:j2"><div class="pjt"><span class="grow nm">Q4 influencer drop</span><span class="tn pp">48%</span></div><div class="pjb"><i style="--p:48%"></i></div><div class="pst dsoft">At risk</div></div>
        <div class="pjr row lnk hotz" data-id="pj-j3" data-open="j:j3"><div class="pjt"><span class="grow nm">Website rebuild</span><span class="tn pp">35%</span></div><div class="pjb"><i class="off" style="--p:35%"></i></div><div class="pst al">Off track</div></div>
      </div>
    </div>
  </section>

  <section class="sec" id="team" data-l="team">
    <div class="g444">
      <div class="rv">
        <div class="sh"><span class="eb"><i>08</i>people</span><button class="pl" type="button">desk</button></div>
        <div class="per row lnk" data-id="pp-mk" data-open="p:mk"><span class="nm">Meher Kapoor</span><span class="tags">Clear <span class="k">· Keeper done</span></span></div>
        <div class="per row lnk" data-id="pp-am" data-open="p:am"><span class="nm">Aarav Mehta</span><span class="tags">Clear <span class="k">· Keeper done</span></span></div>
        <div class="per row lnk hotz" data-id="pp-ks" data-open="p:ks"><span class="nm">Kabir Sood</span><span class="tags"><span class="al">Written note</span> · Keeper due</span></div>
        <div class="per row lnk" data-id="pp-zs" data-open="p:zs"><span class="nm">Zoya Shaikh</span><span class="tags">Clear · Keeper due</span></div>
        <div class="per row lnk" data-id="pp-ri" data-open="p:ri"><span class="nm">Rhea Iyer</span><span class="tags">Clear <span class="k">· Keeper done</span></span></div>
        <div class="per row lnk" data-id="pp-tn" data-open="p:tn"><span class="nm">Tara Nair</span><span class="tags">Clear · <span class="k">Onboarding 80%</span></span></div>
        <div class="per row lnk" data-id="pp-vd" data-open="p:vd"><span class="nm">Vihaan Desai</span><span class="tags">Clear · Keeper due</span></div>
      </div>
      <div class="rv" id="hir">
        <div class="sh"><span class="eb"><i>09</i>hiring</span><button class="pl" type="button">open</button></div>
        <div class="hir row lnk" data-id="hr-h1" data-open="h:h1"><div><span class="nm">Ira Sethi</span><div class="sub">Brand strategist</div></div><div class="ev"><span class="ticks"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span><span class="tn hn">3/5</span></div></div>
        <div class="hir row lnk" data-id="hr-h2" data-open="h:h2"><div><span class="nm">Dev Malhotra</span><div class="sub">Motion designer</div></div><div class="ev"><span class="ticks"><i class="on"></i><i></i><i></i><i></i></span><span class="tn hn">1/4</span></div></div>
      </div>
      <div class="rv" id="vox">
        <div class="sh"><span class="eb"><i>10</i>voice</span><button class="pl" type="button">open</button></div>
        <div class="q row"><blockquote>&#8220;The 3 line EOD made Mondays lighter.&#8221;</blockquote><div class="sub">Energy 4 of 5, anonymous</div></div>
        <div class="q row"><blockquote>&#8220;The festive film brief changed twice last week.&#8221;</blockquote><div class="sub">Energy 3 of 5, anonymous</div></div>
      </div>
    </div>
  </section>

  <section class="band warm" id="cli" data-l="clients">
    <div class="card rv">
      <div class="sh"><span class="eb"><i>11</i>clients</span><button class="pl" type="button">open</button></div>
      <div class="share" aria-hidden="true"><i data-k="1" style="flex:24;background:rgba(14,14,14,.92)"></i><i data-k="2" style="flex:22;background:rgba(14,14,14,.68)"></i><i data-k="3" style="flex:21;background:rgba(14,14,14,.46)"></i><i data-k="4" style="flex:17;background:rgba(14,14,14,.28)"></i><i data-k="5" style="flex:16;background:rgba(14,14,14,.14)"></i></div>
      <div class="ct hd cap"><span>CLIENT</span><span>MONTHLY</span><span>SHARE</span><span class="c-op">OPEN</span><span class="c-br">BRAIN</span></div>
      <div class="ct row lnk" data-k="1" data-id="c1" data-open="c:c1"><span><span class="nm">Jewellery house, UAE</span></span><span class="rvn">&#8377;3,90,000</span><span class="tn">24%</span><span class="tn c-op">6</span><span class="tn c-br">3/3</span></div>
      <div class="ct row lnk" data-k="2" data-id="c2" data-open="c:c2"><span><span class="nm">Wellness brand, UAE</span></span><span class="rvn">&#8377;3,60,000</span><span class="tn">22%</span><span class="tn c-op">4</span><span class="tn c-br">3/3</span></div>
      <div class="ct row lnk" data-k="3" data-id="c3" data-open="c:c3"><span><span class="nm">Luxury hotel group</span></span><span class="rvn">&#8377;3,40,000</span><span class="tn">21%</span><span class="tn c-op">5</span><span class="tn c-br">2/3</span></div>
      <div class="ct row lnk" data-k="4" data-id="c4" data-open="c:c4"><span><span class="nm">Skincare D2C</span></span><span class="rvn">&#8377;2,80,000</span><span class="tn">17%</span><span class="tn c-op">3</span><span class="tn c-br">3/3</span></div>
      <div class="ct row lnk hotz" data-k="5" data-id="c5" data-open="c:c5"><span><span class="nm">Real estate developer</span></span><span class="rvn">&#8377;2,60,000</span><span class="tn">16%</span><span class="tn c-op">2</span><span class="tn c-br al">1/3</span></div>
      <div class="ct tot"><span class="cap">TOTAL, A MONTH</span><span class="rvn">&#8377;16,30,000</span><span class="tn">100%</span><span class="tn c-op">20</span><span class="c-br"></span></div>
    </div>
  </section>
</main>

<div id="island" role="status" aria-live="polite"><div class="is-in"></div></div>
<div class="scrim" id="scrim"></div>
<aside class="sheet" id="sheet" aria-hidden="true" aria-label="Details"><span class="grab" id="grab" aria-hidden="true"></span><button class="shx" id="shx" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="sh-in" id="shIn"></div></aside>

<div class="menu" id="menu" aria-hidden="true">
  <div class="menu-top"><span class="cap"><b>M360 OS</b></span><button class="cap lnkb" id="menuClose" type="button">CLOSE</button></div>
  <div class="menu-list" id="menuList"></div>
</div>

<nav class="tabbar" id="tabbar" aria-label="Tabs">
  <div class="tbg lg" id="tb"><span class="lens" aria-hidden="true"></span>
    <button class="tab on" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="12" rx="2.2"/><path d="M8 20h8M12 16v4M7 12l2.5-3 2.5 2 3-4"/></svg><span>Command</span><b class="bd tbd" data-bd="need">4</b></button>
    <button class="tab" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg><span>Today</span></button>
    <button class="tab" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="16.5" y="4" width="4" height="7" rx="1.6"/></svg><span>Tasks</span></button>
    <button class="tab" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 3.5z"/></svg><span>Feed</span></button>
  </div>
  <button class="tb-ask lg" id="tbAsk" type="button" aria-label="Ask m360"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg></button>
</nav>
<script>
(function(){
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(s,r){ return (r||document).querySelector(s); };
  var $$=function(s,r){ return [].slice.call((r||document).querySelectorAll(s)); };
  var html=document.documentElement;
  var clamp=function(v,a,b){ return Math.max(a,Math.min(b,v)); };
  var now=function(){ return performance.now(); };
  var phone=function(){ return innerWidth<=900; };
  var inr=function(n){ var s=String(Math.round(n)), l=s.slice(-3), r=s.slice(0,-3); if(r) l=','+l; return '₹'+r.replace(/\B(?=(\d{2})+(?!\d))/g,',')+l; };
  var ini=function(n){ return n.split(' ').map(function(w){ return w[0]; }).slice(0,2).join(''); };

  /* the people, clients, projects and deals behind every number */
  var P={
    kr:{n:'Kaavish Ramchandani',r:'Founder',c:'M360-001',keeper:'Runs the keepers'},
    mk:{n:'Meher Kapoor',r:'Senior strategist',c:'M360-002',pts:34,rank:1,lates:0,keeper:'Keeper done'},
    am:{n:'Aarav Mehta',r:'Brand strategist',c:'M360-003',pts:29,rank:2,lates:0,keeper:'Keeper done'},
    ks:{n:'Kabir Sood',r:'Account executive',c:'M360-004',pts:12,rank:7,lates:3,keeper:'Keeper due',note:'Written note on file'},
    zs:{n:'Zoya Shaikh',r:'Video editor',c:'M360-005',pts:21,rank:4,lates:0,keeper:'Keeper due'},
    ri:{n:'Rhea Iyer',r:'Client lead, Dubai',c:'M360-006',pts:26,rank:3,lates:1,keeper:'Keeper done'},
    tn:{n:'Tara Nair',r:'Junior strategist',c:'M360-007',pts:18,rank:5,lates:0,keeper:'Onboarding 80%'},
    vd:{n:'Vihaan Desai',r:'Designer',c:'M360-008',pts:14,rank:6,lates:1,keeper:'Keeper due'}
  };
  var C={
    c1:{n:'Jewellery house, UAE',m:390000,s:24,o:6,b:3,lead:'ri',work:'j1'},
    c2:{n:'Wellness brand, UAE',m:360000,s:22,o:4,b:3,lead:'mk',work:'j2'},
    c3:{n:'Luxury hotel group',m:340000,s:21,o:5,b:2,lead:'am',work:'j3'},
    c4:{n:'Skincare D2C',m:280000,s:17,o:3,b:3,lead:'mk'},
    c5:{n:'Real estate developer',m:260000,s:16,o:2,b:1,lead:'ri'}
  };
  var J={
    j1:{n:'Festive campaign film',p:62,st:'At risk',own:'zs',cl:'c1',due:'14 Nov'},
    j2:{n:'Q4 influencer drop',p:48,st:'At risk',own:'mk',cl:'c2',due:'20 Nov'},
    j3:{n:'Website rebuild',p:35,st:'Off track',own:'am',cl:'c3',due:'8 Nov'}
  };
  var S={
    s1:{n:'Lead',c:6,v:180000,d:[['Cafe chain, Pune',40000],['Fintech app',35000],['Spa brand',30000]]},
    s2:{n:'Qualified',c:4,v:260000,d:[['Fashion label',90000],['EV startup',70000],['Gym chain',60000]]},
    s3:{n:'Diagnostic',c:3,v:310000,d:[['Real estate, Pune',140000],['Jewellery D2C',100000],['Restaurant group',70000]]},
    s4:{n:'Proposal sent',c:4,v:495000,d:[['Hotel group, Goa',180000],['Skincare brand',125000],['Watch retailer',110000]]},
    s5:{n:'Negotiation',c:2,v:420000,d:[['Luxury auto',250000],['Beverage brand',170000]]}
  };
  var H={
    h1:{n:'Ira Sethi',r:'Brand strategist',done:3,of:5,next:'Founder round, 4 Nov'},
    h2:{n:'Dev Malhotra',r:'Motion designer',done:1,of:4,next:'Portfolio review, 3 Nov'}
  };
  var PIPE={tot:1665000,deals:19}, PJ={on:6,risk:2,off:1};

  /* the m360 mark as a live character: breathes, blinks, watches, feels, and looks at what it is talking about */
  var M=(function(){
    var roots=$$('.lm').map(function(el){ return {el:el, react:$('.l-react',el), pose:$('.l-pose',el), eye:$('.l-eye',el), dot:$('.l-dot',el)}; });
    var v={lean:0,sq:0,ex:0,ey:0}, vel={lean:0,sq:0,ex:0,ey:0}, tg={lean:0,sq:0,ex:0,ey:0};
    var running=false, last=0, lastIn=now(), lastMove=now(), sleeping=false, listening=false, concern=false, baseLean=0, holdT=0, hold=false, lookT=0;
    var vis=function(){ for(var i=0;i<roots.length;i++){ if(roots[i].el.getClientRects().length) return roots[i]; } return roots[0]; };
    var apply=function(){
      var p='rotate('+v.lean.toFixed(3)+'deg) scale('+(1-v.sq/220).toFixed(4)+','+(1+v.sq/100).toFixed(4)+')';
      var e='translate('+v.ex.toFixed(2)+'px,'+v.ey.toFixed(2)+'px)';
      roots.forEach(function(o){ o.pose.style.transform=p; o.eye.style.transform=e; });
    };
    var step=function(t){
      var dt=Math.min(.034,Math.max(.001,(t-last)/1000)); last=t; var moving=false;
      for(var k in v){ var a=170*(tg[k]-v[k])-17*vel[k]; vel[k]+=a*dt; v[k]+=vel[k]*dt; if(Math.abs(vel[k])>.02||Math.abs(tg[k]-v[k])>.02) moving=true; }
      apply(); if(moving) requestAnimationFrame(step); else running=false;
    };
    var kick=function(){ if(!running&&!rm){ running=true; last=now(); requestAnimationFrame(step); } };
    var set=function(o){ for(var k in o) tg[k]=o[k]; kick(); };
    var react=function(name,ms){ if(rm) return; roots.forEach(function(o){ var r=o.react; r.className='l-react'; r.getBoundingClientRect(); r.className='l-react r-'+name; clearTimeout(o.rt); o.rt=setTimeout(function(){ r.className='l-react'; },ms||900); }); };
    var state=function(c,on){ roots.forEach(function(o){ o.el.classList.toggle(c,on); }); };
    var blinkOnce=function(){ roots.forEach(function(o){ o.dot.classList.remove('blink'); o.dot.getBoundingClientRect(); o.dot.classList.add('blink'); }); setTimeout(function(){ roots.forEach(function(o){ o.dot.classList.remove('blink'); }); },230); };
    var blink=function(){ if(!sleeping&&!listening) { blinkOnce(); if(Math.random()<.25) setTimeout(blinkOnce,330); } setTimeout(blink,2400+Math.random()*3600); };
    var sleepNow=function(){ sleeping=true; state('s-sleep',true); set({ex:-10,ey:24,lean:-4,sq:0}); };
    var wake=function(){ lastIn=now(); if(sleeping){ sleeping=false; state('s-sleep',false); react('pop',520); set({ex:0,ey:0,lean:baseLean}); } };
    var glance=function(){ if(!sleeping&&!listening&&!concern&&!hold&&now()-lastMove>3500){ var a=Math.random()*Math.PI*2, f=.45+Math.random()*.55; set({ex:Math.cos(a)*50*f,ey:Math.sin(a)*32*f}); setTimeout(function(){ if(now()-lastMove>3500&&!listening&&!hold) set({ex:0,ey:0}); },650+Math.random()*700); } setTimeout(glance,2300+Math.random()*2400); };
    addEventListener('pointermove',function(e){
      lastMove=now(); wake(); if(listening||hold) return;
      var o=vis(), r=o.el.getBoundingClientRect(), dx=e.clientX-(r.left+r.width*.6), dy=e.clientY-(r.top+r.height*.5), d=Math.hypot(dx,dy)||1, f=Math.min(1,d/240);
      baseLean=clamp(dx/900,-1,1)*2.6;
      set({ex:dx/d*f*54, ey:dy/d*f*36, lean:concern?baseLean-3.5:baseLean});
    },{passive:true});
    ['keydown','pointerdown','touchstart','wheel'].forEach(function(n){ addEventListener(n,wake,{passive:true}); });
    setInterval(function(){ if(!sleeping&&!listening&&now()-lastIn>24000) sleepNow(); },1000);
    var sy=scrollY, st=now(), sT=0;
    var onScroll=function(){ var t=now(), y=scrollY, dt=Math.max(8,t-st), sp=(y-sy)/dt; sy=y; st=t; wake();
      set({sq:Math.min(14,Math.abs(sp)*6), lean:clamp(sp*3.2,-6,6)});
      clearTimeout(sT); sT=setTimeout(function(){ set({sq:0,lean:baseLean}); },110); };
    document.addEventListener('pointerover',function(e){
      var h=e.target.closest&&e.target.closest('.hotz');
      if(h&&!concern){ concern=true; state('s-concern',true); set({lean:baseLean-3.5}); }
      else if(!h&&concern){ concern=false; state('s-concern',false); set({lean:baseLean}); }
    });
    roots.forEach(function(o){
      o.el.addEventListener('pointerenter',function(){ if(!sleeping) react('wig',780); });
      o.el.addEventListener('click',function(e){ e.preventDefault(); react('spin',1080); if(window.__glide) window.__glide(0); });
    });
    setTimeout(blink,1800); setTimeout(glance,3000);
    return {
      happy:function(){ react('hop',820); state('s-happy',true); clearTimeout(holdT); holdT=setTimeout(function(){ state('s-happy',false); },1100); },
      nod:function(){ react('nod',680); }, pop:function(){ react('pop',520); }, spin:function(){ react('spin',1080); },
      stretch:function(){ react('stretch',1600); },
      ahem:function(){ if(!sleeping&&!listening&&!concern) react('ahem',780); },
      listen:function(on){ listening=on; state('s-listen',on); set(on?{lean:3,ex:30,ey:-26}:{lean:baseLean,ex:0,ey:0}); },
      think:function(on){ state('s-think',on); },
      lookAt:function(el,ms){ if(!el||rm) return; var o=vis(), r=o.el.getBoundingClientRect(), t=el.getBoundingClientRect(), dx=t.left+t.width/2-(r.left+r.width*.6), dy=t.top+t.height/2-(r.top+r.height/2), d=Math.hypot(dx,dy)||1; hold=true; set({ex:dx/d*56,ey:dy/d*38}); clearTimeout(lookT); lookT=setTimeout(function(){ hold=false; },ms||1800); },
      mood:function(n){ state('s-alert',n>=4); state('s-calm',n===0); },
      scroll:onScroll, sleepNow:sleepNow, wake:wake
    };
  })();
  window.__m360=M;

  /* greeting by time of day; the mark wakes up with it */
  var hr=new Date().getHours();
  $('#greet').textContent=hr<5?'Up late, Kaavish.':hr<12?'Good morning, Kaavish.':hr<17?'Good afternoon, Kaavish.':'Good evening, Kaavish.';
  setTimeout(function(){ if(hr<5) M.sleepNow(); else if(hr<12) M.stretch(); else M.nod(); },1400);

  /* attendance: a hairline from check in to now, on a morning clock */
  var mins=function(s){ var p=s.split(':'); return (+p[0])*60+(+p[1]); };
  var T0=540, T1=720, NOW=646;
  var pos=function(m){ return ((m-T0)/(T1-T0)*100).toFixed(3)+'%'; };
  var attRows=$$('#att .tr.row');
  var fOf=function(r){ return ' '+(r.getAttribute('data-f')||'')+' '; };
  var has=function(r,t){ return fOf(r).indexOf(' '+t+' ')>-1; };
  var buildDay=function(row,k){
    var d=$('.day',row); if(!d) return; d.innerHTML='';
    var g1=document.createElement('i'); g1.className='g10'; d.appendChild(g1);
    var g2=document.createElement('i'); g2.className='gn'; d.appendChild(g2);
    var din=row.getAttribute('data-in'); if(!din) return;
    var a=mins(din), bar=document.createElement('i'); bar.className='b live'; bar.style.left=pos(a); bar.style.width=(Math.max(0,NOW-a)/(T1-T0)*100).toFixed(3)+'%'; bar.style.setProperty('--j',k||0); d.appendChild(bar);
    if(has(row,'late')){ var lt=document.createElement('i'); lt.className='lt'; lt.style.left=pos(a); d.appendChild(lt); }
    var nd=document.createElement('i'); nd.className='nd'; nd.style.left=pos(NOW); d.appendChild(nd);
  };
  attRows.forEach(buildDay);
  $$('.viz').forEach(function(z){ [].forEach.call(z.children,function(c,j){ c.style.setProperty('--j',j); }); });
  $$('.lnk').forEach(function(r){ var g=document.createElement('i'); g.className='go'; g.setAttribute('aria-hidden','true'); r.appendChild(g); });

  /* numbers: roll to a new value, count up, swap captions */
  var tile=function(k){ return $('.kp[data-k="'+k+'"]'); };
  var rollTo=function(t,h){
    var kv=$('.kv',t), old=$('.num',kv); if(!old||old.innerHTML===h) return;
    var nu=document.createElement('div'); nu.className=old.className; nu.innerHTML=h;
    nu.style.cssText='position:absolute;left:0;top:0;right:0;animation:none;transform:translate3d(0,100%,0)';
    kv.appendChild(nu); nu.getBoundingClientRect();
    old.style.animation='none'; old.style.transition='transform .7s var(--spring),opacity .35s var(--ease)'; old.style.transform='translate3d(0,-100%,0)'; old.style.opacity='0';
    nu.style.transition='transform .7s var(--spring)'; nu.style.transform='translate3d(0,0,0)';
    setTimeout(function(){ if(old.parentNode) old.remove(); nu.style.cssText='animation:none'; },780);
  };
  var setCap=function(t,c){ var n=$('.kn',t); if(!n||n.textContent===c) return; n.classList.add('swap'); setTimeout(function(){ n.textContent=c; n.classList.remove('swap'); },220); };
  var K=function(k,h,c,hot){ var t=tile(k); if(!t) return; rollTo(t,h); if(c!=null) setCap(t,c); if(hot!=null){ t.classList.toggle('hot',hot); t.classList.toggle('hotz',hot); } };
  var countTo=function(el,to){ var from=+el.getAttribute('data-n')||0, fmt=el.getAttribute('data-fmt'), t0=0, d=1200; el.setAttribute('data-n',to);
    if(rm){ el.textContent=fmt==='inr'?inr(to):to; return; }
    requestAnimationFrame(function f(t){ if(!t0) t0=t; var k=Math.min(1,(t-t0)/d), q=1-Math.pow(1-k,4), val=from+(to-from)*q; el.textContent=fmt==='inr'?inr(val):Math.round(val); if(k<1) requestAnimationFrame(f); }); };
  var count=function(el){ var to=+el.getAttribute('data-n'); el.setAttribute('data-n',0); countTo(el,to); };
  var rvs=$$('.rv');
  if('IntersectionObserver' in window&&!rm){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); $$('[data-n]',e.target).forEach(count); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -6% 0px',threshold:0});
    rvs.forEach(function(el){ io.observe(el); });
  } else rvs.forEach(function(el){ el.classList.add('in'); });

  /* where you are: the counter rail, the phone sheet, a gliding scroll */
  var SEC=[['need','needs you'],['nums','numbers'],['att','attendance'],['flg','flags'],['dark','business'],['team','team'],['cli','clients']];
  var secEl=SEC.map(function(s){ return document.getElementById(s[0]); });
  var rail=$('#rail'), fill=$('.rtr i',rail), jump=$('#jump'), where=$('#where');
  SEC.forEach(function(s,i){
    var b=document.createElement('button'); b.type='button'; b.className='ri'; b.setAttribute('data-s',s[0]); b.setAttribute('aria-label',s[1]); b.style.setProperty('--k',i);
    b.innerHTML='<span class="rl">'+s[1]+'</span>'; rail.appendChild(b);
    var j=document.createElement('button'); j.type='button'; j.setAttribute('data-s',s[0]); j.innerHTML='<i>'+('0'+(i+1)).slice(-2)+'</i>'+s[1]; jump.appendChild(j);
  });
  var cur=-1, lock=null;
  var setActive=function(i){
    $$('.ri',rail).forEach(function(b,k){ b.classList.toggle('on',k===i); b.classList.toggle('past',k<i); });
    $$('button',jump).forEach(function(b,k){ b.classList.toggle('on',k===i); });
    $('.wi',where).textContent=('0'+(i+1)).slice(-2); $('.wl',where).textContent=SEC[i][1];
  };
  var spy=function(){
    var line=phone()?110:innerHeight*.32, tops=secEl.map(function(el){ return el.getBoundingClientRect().top-line; }), idx=0;
    for(var i=0;i<tops.length;i++){ if(tops[i]<=0) idx=i; }
    var end=innerHeight+scrollY>=document.documentElement.scrollHeight-4;
    var p=idx; if(idx<tops.length-1){ var a=tops[idx], b=tops[idx+1]; if(b!==a) p=idx+clamp(-a/(b-a),0,1); }
    if(end){ idx=tops.length-1; p=idx; }
    fill.style.transform='scaleY('+(p/(tops.length-1)).toFixed(4)+')';
    if(lock!==null) idx=lock;
    if(idx!==cur){ cur=idx; setActive(idx); }
  };
  var glide=function(y,done){
    var from=scrollY, to=clamp(y,0,document.documentElement.scrollHeight-innerHeight), d=clamp(Math.abs(to-from)*.45,520,1100), t0=0;
    if(rm||Math.abs(to-from)<2){ scrollTo(0,to); if(done) done(); return; }
    requestAnimationFrame(function f(t){ if(!t0) t0=t; var k=Math.min(1,(t-t0)/d), q=k<.5?8*k*k*k*k:1-Math.pow(-2*k+2,4)/2; scrollTo(0,from+(to-from)*q); if(k<1) requestAnimationFrame(f); else if(done) done(); });
  };
  window.__glide=glide;
  var goTo=function(id,cb){
    var i=SEC.findIndex(function(s){ return s[0]===id; }), el=document.getElementById(id); if(!el) return;
    var off=phone()?80:28; if(i>-1){ lock=i; cur=i; setActive(i); }
    glide(el.getBoundingClientRect().top+scrollY-off,function(){ lock=null; spy(); if(cb) cb(); });
  };
  rail.addEventListener('click',function(e){ var b=e.target.closest('.ri'); if(b) goTo(b.getAttribute('data-s')); });
  $$('[data-go]').forEach(function(a){ a.addEventListener('click',function(e){ e.preventDefault(); goTo(a.getAttribute('data-go')); }); });
  var setJump=function(o){ jump.classList.toggle('open',o); jump.setAttribute('aria-hidden',o?'false':'true'); where.setAttribute('aria-expanded',o?'true':'false'); };
  where.addEventListener('click',function(){ setJump(!jump.classList.contains('open')); });
  jump.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; setJump(false); goTo(b.getAttribute('data-s')); });

  /* light up what an answer points at */
  var flash=function(els){ (els||[]).forEach(function(el){ if(!el) return; el.classList.remove('flash','flash-out'); el.getBoundingClientRect(); el.classList.add('flash'); setTimeout(function(){ el.classList.add('flash-out'); },1600); setTimeout(function(){ el.classList.remove('flash','flash-out'); },2000); }); };
  var showAt=function(id,els,before){ goTo(id,function(){ if(before) before(); setTimeout(function(){ flash(els); if(els&&els[0]) M.lookAt(els[0],2200); },60); }); };

  /* scroll: the mark feels the speed, the dark band opens, glass firms up over dark */
  var dark=$('#dark'), pbar=$('#pbar'), tabbar=$('#tabbar'), side=$('#side'), lastY=scrollY, ticking=false;
  var frame=function(){ ticking=false; var y=scrollY, vh=innerHeight, r=dark.getBoundingClientRect();
    var e=rm?1:clamp((vh-r.top)/(vh*.7),0,1); dark.style.setProperty('--e',e.toFixed(4));
    var mid=vh/2; rail.classList.toggle('dk',r.top<mid+120&&r.bottom>mid-120); side.classList.toggle('dk',r.top<vh-60&&r.bottom>60);
    pbar.classList.toggle('dk',r.top<64&&r.bottom>8); tabbar.classList.toggle('dk',r.top<vh-20&&r.bottom>vh-70);
    if(y>lastY+6&&y>240) tabbar.classList.add('min');
    else if(y<lastY-6&&tabbar.classList.contains('min')){ tabbar.classList.remove('min'); setTimeout(function(){ if(window.__lens) window.__lens(); },640); }
    lastY=y; spy(); };
  addEventListener('scroll',function(){ M.scroll(); if(jump.classList.contains('open')) setJump(false); if(!ticking){ ticking=true; requestAnimationFrame(frame); } },{passive:true});
  addEventListener('resize',frame); frame();

  /* sidebar: black pill marks the page, warm pill follows the pointer, names on demand */
  var snav=$('#snav'), spa=$('.sp-a',snav), sph=$('.sp-h',snav), here=$('.here',snav), tip=$('#tip'), tog=$('#sTog');
  var place=function(p,el,snap,dy){ if(!el) return; if(snap) p.style.transition='none'; p.style.transform='translate3d(0,'+(el.offsetTop+(dy||0))+'px,0)'; if(snap){ p.getBoundingClientRect(); p.style.transition=''; } };
  var act=function(){ return $('.nv.on',snav); };
  var snapAll=function(){ place(spa,act(),true); place(here,act(),true,10); };
  snapAll();
  var tipOn=false;
  var hideTip=function(){ tip.classList.remove('on'); tipOn=false; };
  var showTip=function(el){
    if(html.classList.contains('sbx')||phone()){ hideTip(); return; }
    var r=el.getBoundingClientRect(), s=side.getBoundingClientRect(), bd=$('.bd',el);
    tip.innerHTML=el.getAttribute('data-t')+(el.getAttribute('data-k')?'<kbd class="kb">'+$('.kb',el).innerHTML+'</kbd>':'')+(bd&&!bd.hidden?'<b class="bd">'+bd.textContent+'</b>':'');
    tip.style.setProperty('--tx',(s.right+10)+'px'); tip.style.setProperty('--ty',(r.top+r.height/2-15)+'px');
    if(!tipOn){ tip.style.transition='none'; tip.getBoundingClientRect(); tip.style.transition=''; }
    tip.classList.add('on'); tipOn=true;
  };
  snav.addEventListener('pointerover',function(e){ var b=e.target.closest('.nv'); if(!b) return; if(sph.style.opacity!=='1') place(sph,b,true); else place(sph,b); sph.style.opacity=b.classList.contains('on')?'0':'1'; showTip(b); });
  snav.addEventListener('pointerleave',function(){ sph.style.opacity='0'; hideTip(); });
  $$('.sfoot .nv',side).forEach(function(b){ b.addEventListener('pointerenter',function(){ showTip(b); }); b.addEventListener('pointerleave',hideTip); });
  var pageTo=function(b){ $$('.nv.on',snav).forEach(function(x){ x.classList.remove('on'); x.removeAttribute('aria-current'); }); b.classList.add('on'); b.setAttribute('aria-current','page'); place(spa,b); place(here,b,false,10); sph.style.opacity='0'; M.nod(); };
  snav.addEventListener('click',function(e){ var b=e.target.closest('.nv'); if(!b) return; e.preventDefault(); pageTo(b); });
  var ovf=function(){ var t=snav.scrollTop, m=snav.scrollHeight-snav.clientHeight; snav.classList.toggle('ovt',t>2); snav.classList.toggle('ovb',m-t>2); };
  snav.addEventListener('scroll',function(){ hideTip(); ovf(); },{passive:true}); addEventListener('resize',ovf); ovf();
  var setSb=function(x,quiet){
    html.classList.toggle('sbx',x); try{ localStorage.setItem('m360.sb',x?'x':'s'); }catch(err){}
    $('.nl',tog).textContent=x?'Collapse':'Expand'; tog.setAttribute('data-t',x?'Collapse':'Expand'); tog.setAttribute('aria-expanded',x?'true':'false');
    hideTip(); if(!quiet) M.pop(); setTimeout(function(){ frame(); ovf(); },650);
  };
  setSb(html.classList.contains('sbx'),true);
  tog.addEventListener('click',function(){ setSb(!html.classList.contains('sbx')); });
  $$('a.nv',$('.sfoot')).forEach(function(a){ a.addEventListener('click',function(e){ e.preventDefault(); }); });

  /* phone menu, built from the sidebar */
  var menu=$('#menu'), list=$('#menuList'), mb=$('#menuBtn'), jn=0;
  [].forEach.call(snav.children,function(n){
    if(n.classList.contains('sgl')){ var h=document.createElement('div'); h.className='grp'; h.textContent=n.textContent; list.appendChild(h); }
    else if(n.classList.contains('nv')){ var c=n.cloneNode(true); c.style.setProperty('--j',jn++); c.style.animation='none'; list.appendChild(c); }
  });
  var setMenu=function(o){ menu.classList.toggle('open',o); menu.setAttribute('aria-hidden',o?'false':'true'); mb.setAttribute('aria-expanded',o?'true':'false'); document.body.style.overflow=o?'hidden':''; };
  mb.addEventListener('click',function(){ setJump(false); setMenu(true); });
  $('#menuClose').addEventListener('click',function(){ setMenu(false); });
  list.addEventListener('click',function(e){ var a=e.target.closest('.nv'); if(!a) return; e.preventDefault(); $$('.nv.on',list).forEach(function(x){ x.classList.remove('on'); }); a.classList.add('on'); setTimeout(function(){ setMenu(false); },180); });

  /* the island: one black object for asking, answers, confirmations and live news */
  var isl=$('#island'), isIn=$('.is-in',isl), its=[], mode='', queue=[];
  var cx=function(){ if(phone()) return innerWidth/2; var s=side.getBoundingClientRect(); return (s.right+12+innerWidth-12)/2; };
  var topY=function(){ return phone()?8:12; };
  var put=function(l,t,w,h,rad){ isl.style.left=l+'px'; isl.style.top=t+'px'; isl.style.width=w+'px'; isl.style.height=h+'px'; isl.style.borderRadius=rad+'px'; };
  var shape=function(w,h,r){ put(cx()-w/2,topY(),w,h,r); };
  var pill=function(){ shape(120,36,18); };
  var clr=function(){ its.forEach(clearTimeout); its=[]; };
  var later=function(fn,ms){ its.push(setTimeout(fn,ms)); };
  var isOpen=function(){ return isl.classList.contains('open')&&!isl.classList.contains('closing'); };
  var WV=function(c){ return '<span class="is-wave'+(c?' calm':'')+'"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i></span>'; };
  var TX=function(b,e){ return '<span class="is-t"><b>'+b+'</b><em>'+e+'</em></span>'; };
  var DOT='<span class="is-ev"></span>';
  var CK='<span class="is-ck"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>';
  var XK='<span class="is-ck"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></span>';
  var swapI=function(h,cb){ isIn.classList.add('fade'); later(function(){ isIn.innerHTML=h; isIn.classList.remove('fade'); if(cb) cb(); },200); };
  var openI=function(h,opt){ opt=opt||{}; var W=opt.w||(phone()?innerWidth-16:440), H=opt.h||72, R=opt.r||36;
    if(isOpen()){ clr(); if(mode==='cmd'){ isl.classList.remove('cmd'); mode=''; } swapI(h,opt.cb); shape(W,H,R); return; }
    clr(); isl.classList.remove('closing','open','cmd'); mode=''; isl.style.transition='none';
    if(opt.from){ var f=opt.from; put(f.left,f.top,f.width,f.height,f.height/2); } else pill();
    isl.getBoundingClientRect(); isl.style.transition='';
    isIn.classList.remove('fade'); isIn.innerHTML=h; isl.classList.add('show'); if(opt.cb) opt.cb();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ var d=opt.size?opt.size():[W,H,R]; shape(d[0],d[1],d[2]); isl.classList.add('open'); }); });
  };
  var closeI=function(){ clr(); if(!isl.classList.contains('show')) return; var wasCmd=mode==='cmd'; isl.classList.remove('open'); isl.classList.add('closing'); pill(); mode=''; if(wasCmd){ var a=document.activeElement; if(a&&a.blur) a.blur(); }
    later(function(){ isl.classList.remove('show','closing','cmd'); isIn.innerHTML=''; if(queue.length){ var q=queue.shift(); setTimeout(q,350); } },460); M.listen(false); M.think(false); };
  var notify=function(h,ms,look){ var run=function(){ openI(DOT+h); later(closeI,ms||3200); M.pop(); if(look) setTimeout(function(){ M.lookAt(look,1800); },200); };
    if(isl.classList.contains('show')||shOpen) queue.push(function(){ if(isl.classList.contains('show')||shOpen) queue.push(run); else run(); }); else run(); };

  /* ask m360: type or speak; answers come from this page, enter takes you there */
  var ICO={}; $$('#snav .nv').forEach(function(a){ ICO[a.getAttribute('data-t')]=$('svg',a).outerHTML; });
  var MIC=$('#tbAsk svg').outerHTML;
  var lateRows=function(){ return attRows.filter(function(r){ return has(r,'late'); }); };
  var outRows=function(){ return attRows.filter(function(r){ return has(r,'out'); }); };
  var pn=function(r){ return P[r.getAttribute('data-id')].n; };
  var A={
    late:function(){ var l=lateRows(); return {ic:ICO.Today,t:l.length?l.map(function(r){ return pn(r)+', in at '+r.getAttribute('data-in'); }).join('. ')+'.':'Nobody was late today.',s:l.length===1&&l[0].getAttribute('data-id')==='ks'?'Third late this month':l.length+' late today',r:'show',run:function(){ closeI(); showAt('att',lateRows(),function(){ pickChip('#attF','late'); }); }}; },
    out:function(){ var o=outRows(); return {ic:ICO.Today,t:o.length?o.map(pn).join(', ')+', not in yet.':'Everyone is in.',s:o.length?'No leave on file':'Nobody missing',r:'show',run:function(){ closeI(); showAt('att',o.length?o:attRows.slice(0,1),function(){ if(o.length) pickChip('#attF','out'); }); }}; },
    need:function(){ var n=left(); return {ic:ICO.Command,t:n?n+(n===1?' thing needs you.':' things need you.'):'Nothing needs you.',s:'Approvals and high flags',r:'show',run:function(){ closeI(); showAt('need',$$('.ncw:not(.gone) .nc',ngrid)); }}; },
    pipe:function(){ return {ic:ICO.Pitches,t:inr(PIPE.tot)+' a month across '+PIPE.deals+' deals.',s:'Most of it in proposal sent',r:'show',run:function(){ closeI(); showAt('dark',[$('.pls'),$('.ppr[data-id="st-s4"]')]); }}; },
    client:function(){ return {ic:ICO.Clients,t:'Jewellery house, UAE. '+inr(390000)+' a month.',s:'24% of revenue, cap is 25%',r:'show',run:function(){ closeI(); showAt('cli',[$('#cli .ct[data-id="c1"]')]); }}; },
    lead:function(){ return {ic:ICO.Scores,t:'Meher Kapoor leads with 34 points.',s:'Aarav Mehta second on 29',r:'show',run:function(){ closeI(); showAt('dark',[$('.lbr.first')]); }}; },
    flags:function(){ var v=flRows.filter(function(r){ return !r.classList.contains('gone'); }), h=v.filter(function(r){ return r.getAttribute('data-f')==='h'; }); return {ic:ICO['My tasks'],t:v.length+' flags, '+h.length+' high.',s:h.map(function(r){ return P[r.getAttribute('data-p')].n; }).join(' and ')||'No high flags',r:'show',run:function(){ closeI(); showAt('flg',h.length?h:v.slice(0,1)); }}; },
    mood:function(){ return {ic:ICO.Voice,t:'Team energy 4.1 of 5 last week.',s:'2 notes this week',r:'show',run:function(){ closeI(); showAt('team',[$('#vox')]); }}; },
    hire:function(){ return {ic:ICO.Hiring,t:'2 in the panel. Ira Sethi is at '+H.h1.done+' of 5.',s:'Dev Malhotra at 1 of 4',r:'show',run:function(){ closeI(); showAt('team',$$('#hir .hir')); }}; },
    proj:function(){ return {ic:ICO.Projects,t:PJ.on+' on track, '+PJ.risk+' at risk, '+PJ.off+' off track.',s:'Website rebuild is off track',r:'show',run:function(){ closeI(); showAt('dark',[$('#pjc .pjs'),$('.pjr[data-id="pj-j3"]')]); }}; }
  };
  var INT=[[/late|on time/,'late'],[/not in|absent|missing|who.?s out/,'out'],[/need|waiting|approv|pending|to ?do|inbox/,'need'],[/pipeline|deal|lead\b|proposal|negotiat|sales/,'pipe'],[/client|revenue|biggest|largest|account/,'client'],[/leader|score|point|top|best|winning/,'lead'],[/flag|rule/,'flags'],[/energy|mood|voice|morale/,'mood'],[/hir|candidate|interview/,'hire'],[/project|off track|at risk|delivery/,'proj']];
  var IDX=[];
  Object.keys(P).forEach(function(id){ IDX.push({k:'p',id:id,t:P[id].n,s:P[id].r,w:(P[id].n+' '+P[id].r).toLowerCase()}); });
  Object.keys(C).forEach(function(id){ IDX.push({k:'c',id:id,t:C[id].n,s:'Client, '+inr(C[id].m)+' a month',w:(C[id].n+' client').toLowerCase()}); });
  Object.keys(J).forEach(function(id){ IDX.push({k:'j',id:id,t:J[id].n,s:'Project, '+J[id].st.toLowerCase(),w:(J[id].n+' project').toLowerCase()}); });
  Object.keys(S).forEach(function(id){ IDX.push({k:'s',id:id,t:S[id].n,s:'Pipeline stage',w:(S[id].n+' stage pipeline').toLowerCase()}); });
  Object.keys(H).forEach(function(id){ IDX.push({k:'h',id:id,t:H[id].n,s:'Candidate, '+H[id].r.toLowerCase(),w:(H[id].n+' '+H[id].r+' candidate').toLowerCase()}); });
  $$('#snav .nv').forEach(function(a){ IDX.push({k:'g',el:a,t:'Go to '+a.getAttribute('data-t'),s:'Page',w:a.getAttribute('data-t').toLowerCase()+' page'}); });
  var AV=function(n){ return '<span class="av2">'+ini(n)+'</span>'; };
  var KI={c:'Clients',j:'Projects',s:'Pitches',h:'Hiring',g:'Command'};
  var entItem=function(e){ return {ic:e.k==='p'?AV(e.t):ICO[KI[e.k]],t:e.t,s:e.s,r:e.k==='g'?'go':'open',run:function(){ closeI(); if(e.k==='g') setTimeout(function(){ pageTo(e.el); },250); else setTimeout(function(){ openSheet(e.k,e.id); },250); }}; };
  var SUGG=function(){ return [
    {hd:'Try',ic:ICO.Today,t:'Who’s late today?',r:'ask',q:'who’s late today'},
    {ic:ICO.Command,t:'What needs me?',r:'ask',q:'what needs me'},
    {ic:ICO.Pitches,t:'Pipeline this month',r:'ask',q:'pipeline this month'},
    {ic:ICO.Clients,t:'Biggest client',r:'ask',q:'biggest client'},
    {hd:'People',ic:AV('Kabir Sood'),t:'Kabir Sood',s:'Account executive',r:'open',run:function(){ closeI(); setTimeout(function(){ openSheet('p','ks'); },250); }},
    {ic:AV('Vihaan Desai'),t:'Vihaan Desai',s:'Designer',r:'open',run:function(){ closeI(); setTimeout(function(){ openSheet('p','vd'); },250); }}
  ]; };
  var cbI=null, cbL=null, items=[], sel=0;
  var search=function(q){
    if(!q) return SUGG();
    var out=[], hit=null;
    INT.some(function(x){ if(x[0].test(q)){ hit=A[x[1]](); return true; } return false; });
    if(hit){ hit.ans=true; out.push(hit); }
    var words=q.split(/\s+/).filter(Boolean);
    var m=IDX.filter(function(e){ return words.every(function(w){ return e.w.indexOf(w)>-1; }); }).slice(0,hit?4:6);
    m.forEach(function(e,i){ var it=entItem(e); if(i===0&&hit) it.hd='Jump to'; out.push(it); });
    return out;
  };
  var cbDims=function(){ var lh=cbL?cbL.scrollHeight:56, cap=phone()?Math.round(innerHeight*.56):392; return [phone()?innerWidth-16:600,64+Math.min(lh,cap),28]; };
  var cbSize=function(){ if(mode!=='cmd'||!isl.classList.contains('open')) return; var d=cbDims(); shape(d[0],d[1],d[2]); };
  var render=function(q){
    items=search((q||'').trim().toLowerCase()); sel=0;
    cbL.innerHTML=items.length?items.map(function(it,i){ return (it.hd?'<div class="cbh">'+it.hd+'</div>':'')+'<button type="button" class="cbo'+(it.ans?' ans':'')+(i===0?' hi':'')+'" data-i="'+i+'"><span class="ic">'+it.ic+'</span><span class="tx"><b>'+it.t+'</b>'+(it.s?'<em>'+it.s+'</em>':'')+'</span><span class="rt">'+(it.r||'')+'</span></button>'; }).join(''):'<div class="cbe">No match yet. Try a name, a client, or who’s late.</div>';
    cbSize();
  };
  var runItem=function(it){ if(!it) return; if(it.q){ cbI.value=it.q; render(it.q); return; } it.run(); };
  var openCmd=function(q,from){
    var H0='<div class="cb"><div class="cbr"><button class="cbm" type="button" aria-label="Speak">'+MIC+'</button><input id="cbi" type="text" placeholder="Ask m360 or jump to anything" autocomplete="off" spellcheck="false" aria-label="Ask m360"><kbd class="kb cbk">esc</kbd></div><div class="cbl" id="cbl" role="listbox"></div></div>';
    var start=function(){ isl.classList.add('cmd'); mode='cmd'; cbI=$('#cbi'); cbL=$('#cbl'); cbI.value=q||''; render(q||'');
      cbI.addEventListener('input',function(){ render(cbI.value); });
      cbI.addEventListener('keydown',function(e){ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!items.length) return; sel=(sel+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; $$('.cbo',cbL).forEach(function(b,i){ b.classList.toggle('hi',i===sel); }); var s=$('.cbo.hi',cbL); if(s) s.scrollIntoView({block:'nearest'}); } else if(e.key==='Enter'){ e.preventDefault(); runItem(items[sel]); } else if(e.key==='Escape'){ e.preventDefault(); closeI(); } });
      cbL.addEventListener('click',function(e){ var b=e.target.closest('.cbo'); if(b) runItem(items[+b.getAttribute('data-i')]); });
      cbL.addEventListener('pointermove',function(e){ var b=e.target.closest('.cbo'); if(!b) return; var i=+b.getAttribute('data-i'); if(i!==sel){ sel=i; $$('.cbo',cbL).forEach(function(x,k){ x.classList.toggle('hi',k===sel); }); } });
      $('.cbm',isl).addEventListener('click',function(){ listen(); });
      setTimeout(function(){ try{ cbI.focus({preventScroll:true}); }catch(err){ cbI.focus(); } },120);
      M.lookAt(isl,1400); };
    if(isOpen()){ clr(); isIn.innerHTML=H0; start(); return; }
    openI(H0,{cb:start,size:cbDims,from:from});
  };
  var listen=function(){
    openI(WV()+TX('Listening','ASK M360')+'<i class="is-mic"></i>'); M.listen(true);
    later(function(){ swapI(WV()+TX('“Who’s late today?”','YOU')+'<i class="is-mic"></i>'); },1500);
    later(function(){ M.listen(false); M.think(true); swapI(WV(1)+TX('Thinking','M360')); },2800);
    later(function(){ M.think(false); M.nod(); var a=A.late(); swapI(WV(1)+TX(a.t,a.s.toUpperCase())+'<button class="ib cap" type="button" data-show="late">SHOW</button>'); shape(phone()?innerWidth-16:520,72,36); },3600);
    later(closeI,8200);
  };
  $('#ask').addEventListener('click',function(){ openCmd('',$('#ask').getBoundingClientRect()); });
  $('#sAsk').addEventListener('click',function(){ openCmd(''); });
  $('#tbAsk').addEventListener('click',listen);
  document.addEventListener('pointerdown',function(e){ if(mode==='cmd'&&!isl.contains(e.target)) closeI(); });

  /* detail sheets: every arrow opens a glass panel with the actions you would take */
  var sheet=$('#sheet'), shIn=$('#shIn'), scrim=$('#scrim'), shOpen=false;
  var kv=function(v,l,hot){ return '<div><b class="'+(hot?'al':'')+'">'+v+'</b><span>'+l+'</span></div>'; };
  var BTN=function(k,l,id,sec){ return '<button type="button" class="'+(sec?'pl':'btn cap')+'" data-sa="'+k+'" data-id="'+id+'">'+(sec?l:'<span class="lb">'+l.toUpperCase()+'</span>')+'</button>'; };
  var dots=function(n,of,flame){ var s=''; for(var i=0;i<of;i++) s+='<i class="'+(i<n?(flame?'f':'on'):'')+'"></i>'; return '<span class="sdots">'+s+'</span>'; };
  var R={
    p:function(id){ var p=P[id], row=$('#att .tr.row[data-id="'+id+'"]'), out=row&&has(row,'out'), lv=row&&has(row,'leave'), late=row&&has(row,'late'), wfh=row&&has(row,'wfh'), inT=row&&row.getAttribute('data-in');
      var st=out?'Not in yet':lv?'On leave today':wfh?'Working from home':'In office'; if(inT) st+=', in at '+inT;
      var fl=flRows.filter(function(r){ return r.getAttribute('data-p')===id&&!r.classList.contains('gone'); });
      return '<div class="s-hd"><span class="s-av">'+ini(p.n)+'</span><div><div class="s-n">'+p.n+'</div><div class="s-r">'+p.r+', '+p.c+'</div></div></div>'
        +'<div class="s-chips"><span class="chip'+(out||late?' hot':'')+'"><i></i>'+st+'</span></div>'
        +(p.pts!=null?'<div class="s-sec"><div class="s-lab">this week</div><div class="s-kv">'+kv(p.pts,'points')+kv('#'+p.rank,'on the board')+kv(p.lates,'lates this month',p.lates>=3)+'</div></div>':'')
        +'<div class="s-sec"><div class="s-lab">keeper</div><div class="s-li"><span>'+p.keeper+'</span>'+(p.note?'<span class="al">'+p.note+'</span>':'')+'</div></div>'
        +(fl.length?'<div class="s-sec"><div class="s-lab">flags</div>'+fl.map(function(r){ var f=r.getAttribute('data-f'); return '<div class="s-li"><span class="s-fl"><i class="sev '+(f==='h'?'h':f==='m'?'m':'')+'"></i>'+$('b',r).textContent.split(', ').slice(1).join(', ')+'</span><span class="soft">'+$('.ft',r).textContent+'</span></div>'; }).join('')+'</div>':'')
        +'<div class="s-acts">'+BTN('nudge','Nudge',id)+BTN('note','Add note',id,1)+'</div>'; },
    c:function(id){ var c=C[id], j=c.work&&J[c.work];
      return '<div class="s-hd"><span class="s-av sq">'+ICO.Clients+'</span><div><div class="s-n">'+c.n+'</div><div class="s-r">Client, led by '+P[c.lead].n+'</div></div></div>'
        +'<div class="s-sec"><div class="s-lab">this month</div><div class="s-kv">'+kv(inr(c.m),'a month')+kv(c.s+'%','of revenue')+kv(c.o,'open tasks')+'</div>'
        +'<div class="s-bar"><i style="width:'+(c.s*3)+'%"></i><b style="left:75%"></b></div><div class="s-cap">Share against the 25% cap</div></div>'
        +'<div class="s-sec"><div class="s-lab">client brain</div><div class="s-li"><span>'+dots(c.b,3)+'</span><span class="'+(c.b<2?'al':'soft')+'">'+c.b+' of 3 kept current</span></div></div>'
        +(j?'<div class="s-sec"><div class="s-lab">live work</div><button type="button" class="s-li s-link" data-open="j:'+c.work+'"><span>'+j.n+'</span><span class="'+(j.st==='Off track'?'al':'soft')+'">'+j.p+'%, '+j.st.toLowerCase()+'</span></button></div>':'')
        +'<div class="s-acts">'+BTN('msg','Message lead',id)+BTN('upd','Ask for update',id,1)+'</div>'; },
    j:function(id){ var j=J[id], off=j.st==='Off track';
      return '<div class="s-hd"><span class="s-av sq">'+ICO.Projects+'</span><div><div class="s-n">'+j.n+'</div><div class="s-r">'+C[j.cl].n+', owner '+P[j.own].n+'</div></div></div>'
        +'<div class="s-chips"><span class="chip'+(off?' hot':'')+'"><i></i>'+j.st+', due '+j.due+'</span></div>'
        +'<div class="s-sec"><div class="s-lab">progress</div><div class="s-big tn">'+j.p+'%</div><div class="s-bar"><i class="'+(off?'f':'')+'" style="width:'+j.p+'%"></i></div></div>'
        +'<div class="s-acts">'+BTN('ping','Ping owner',id)+BTN('upd','Ask for update',id,1)+'</div>'; },
    s:function(id){ var s=S[id];
      return '<div class="s-hd"><span class="s-av sq">'+ICO.Pitches+'</span><div><div class="s-n">'+s.n+'</div><div class="s-r">Pipeline stage, '+s.c+' deals</div></div></div>'
        +'<div class="s-sec"><div class="s-lab">value</div><div class="s-big tn">'+inr(s.v)+'</div><div class="s-cap">A month, across '+s.c+' deals</div></div>'
        +'<div class="s-sec"><div class="s-lab">biggest deals</div>'+s.d.map(function(d){ return '<div class="s-li"><span>'+d[0]+'</span><span class="tn">'+inr(d[1])+'</span></div>'; }).join('')+(s.c>s.d.length?'<div class="s-cap">and '+(s.c-s.d.length)+' more</div>':'')+'</div>'
        +'<div class="s-acts">'+BTN('own','Ping deal owners',id)+'</div>'; },
    h:function(id){ var h=H[id];
      return '<div class="s-hd"><span class="s-av">'+ini(h.n)+'</span><div><div class="s-n">'+h.n+'</div><div class="s-r">Candidate, '+h.r.toLowerCase()+'</div></div></div>'
        +'<div class="s-sec"><div class="s-lab">panel</div><div class="s-big tn">'+h.done+' of '+h.of+'</div><div class="s-ticks">'+dots(h.done,h.of)+'</div><div class="s-cap">Next: '+h.next+'</div></div>'
        +'<div class="s-acts">'+BTN('fwd','Move forward',id)+BTN('note','Send note',id,1)+'</div>'; }
  };
  var openSheet=function(k,id){ if(!R[k]) return; shIn.innerHTML=R[k](id); shIn.scrollTop=0; sheet.classList.add('on'); scrim.classList.add('on'); sheet.setAttribute('aria-hidden','false'); shOpen=true; sheet.style.translate=''; setTimeout(function(){ M.lookAt(sheet,1500); },200); };
  var closeSheet=function(){ if(!shOpen) return; sheet.classList.remove('on'); scrim.classList.remove('on'); sheet.setAttribute('aria-hidden','true'); shOpen=false; sheet.style.translate=''; if(queue.length&&!isl.classList.contains('show')){ var q=queue.shift(); setTimeout(q,500); } };
  scrim.addEventListener('click',closeSheet); $('#shx').addEventListener('click',closeSheet);
  var SA={nudge:['Nudge sent',function(id){ return P[id].n; }],note:['Note added',function(id){ return (P[id]||H[id]).n; }],msg:['Message sent',function(id){ return 'TO '+P[C[id].lead].n; }],upd:['Update requested',function(id){ return (C[id]||J[id]).n; }],ping:['Owner pinged',function(id){ return P[J[id].own].n; }],own:['Deal owners pinged',function(id){ return S[id].c+' DEALS IN '+S[id].n; }],fwd:['Moved forward',function(id){ return H[id].n; }]};
  shIn.addEventListener('click',function(e){
    var b=e.target.closest('[data-sa]');
    if(b){ var k=b.getAttribute('data-sa'), id=b.getAttribute('data-id'), s=SA[k];
      if(b.classList.contains('btn')){ b.style.width=b.offsetWidth+'px'; b.getBoundingClientRect(); b.classList.add('done'); b.style.width='36px'; b.innerHTML='<span class="lb"></span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'; b.getBoundingClientRect(); b.classList.add('done'); }
      else { b.textContent='Done'; b.disabled=true; }
      if(k==='fwd'&&H[id].done<H[id].of){ H[id].done++; var hr=$('.hir[data-id="hr-'+id+'"]'); var tk=$$('.ticks i',hr); if(tk[H[id].done-1]) tk[H[id].done-1].classList.add('on'); $('.hn',hr).textContent=H[id].done+'/'+H[id].of; }
      openI(CK+TX(s[0],String(s[1](id)).toUpperCase())); later(closeI,2600); M.happy(); return; }
    var o=e.target.closest('[data-open]'); if(o){ var p=o.getAttribute('data-open').split(':'); openSheet(p[0],p[1]); }
  });
  document.addEventListener('click',function(e){
    if(e.target.closest('#sheet,#island,.btn,.lnkb,.fc,select,.pl,.ncw .nc')&&!e.target.closest('.pn')) return;
    var o=e.target.closest('[data-open]'); if(!o) return; e.preventDefault();
    var p=o.getAttribute('data-open').split(':'); openSheet(p[0],p[1]);
  });
  /* phone: drag the sheet down to close it */
  (function(){ var y0=0, dy=0, on=false; var g=$('#grab');
    var start=function(e){ if(!phone()) return; on=true; y0=e.clientY; dy=0; sheet.style.transition='none'; };
    var move=function(e){ if(!on) return; dy=Math.max(0,e.clientY-y0); sheet.style.translate='0 '+dy+'px'; };
    var end=function(){ if(!on) return; on=false; sheet.style.transition=''; if(dy>110) closeSheet(); else sheet.style.translate=''; };
    g.addEventListener('pointerdown',function(e){ start(e); g.setPointerCapture(e.pointerId); }); g.addEventListener('pointermove',move); g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
  })();

  /* 01 needs you: one tap acts, cards close up, everything else updates, undo sits in the island */
  var ngrid=$('#ngrid'), np=$('#np'), needl=$('#needl'), ncl=$('#nclear'), lastC=null, nudgeT=0;
  var left=function(){ return $$('.ncw',ngrid).filter(function(w){ return !w.classList.contains('gone'); }).length; };
  var counts=function(){ var n=left();
    np.textContent=n?n+' waiting':'all clear'; np.classList.toggle('hot',n>0);
    needl.innerHTML=n?'<b>'+n+'</b> '+(n===1?'thing needs you':'things need you')+'<i class="ar"></i>':'All clear'; needl.classList.toggle('ok',n===0);
    ncl.hidden=n>0; $$('[data-bd="need"]').forEach(function(b){ b.textContent=n; b.hidden=n===0; }); M.mood(n); };
  var flip=function(mut){
    var els=$$('.ncw',ngrid).filter(function(w){ return !w.classList.contains('gone'); }), first=els.map(function(w){ return w.getBoundingClientRect(); });
    mut();
    els.forEach(function(w,i){ if(w.classList.contains('gone')) return; var b=w.getBoundingClientRect(), dx=first[i].left-b.left, dy=first[i].top-b.top; if(Math.abs(dx)<1&&Math.abs(dy)<1) return;
      w.style.transition='none'; w.style.translate=dx+'px '+dy+'px'; w.getBoundingClientRect(); w.style.transition=''; w.style.translate=''; });
  };
  var flRows=$$('#flg .fl');
  var flipEls=function(els,mut){ var first=els.map(function(e){ return e.getBoundingClientRect(); }); mut(); els.forEach(function(e,i){ if(e.classList.contains('gone')||e.hidden) return; var b=e.getBoundingClientRect(), dx=first[i].left-b.left, dy=first[i].top-b.top; if(Math.abs(dx)<1&&Math.abs(dy)<1) return; e.style.transition='none'; e.style.translate=dx+'px '+dy+'px'; e.getBoundingClientRect(); e.style.transition=''; e.style.translate=''; }); };
  var hideFlag=function(rule,hide){ var r=$('#flg .fl[data-rule="'+rule+'"]'); if(!r) return; var vis=flRows.filter(function(x){ return !x.classList.contains('gone')&&!x.hidden; });
    if(hide){ if(r.classList.contains('gone')) return; r.classList.add('fading'); setTimeout(function(){ flipEls(vis,function(){ r.classList.add('gone'); }); r.classList.remove('fading'); },260); }
    else { if(!r.classList.contains('gone')) return; r.classList.add('fading'); flipEls(vis,function(){ r.classList.remove('gone'); }); r.getBoundingClientRect(); requestAnimationFrame(function(){ requestAnimationFrame(function(){ r.classList.remove('fading'); }); }); } };
  var noteFlag=function(rule,on){ var r=$('#flg .fl[data-rule="'+rule+'"]'); if(!r) return; var p=$('p',r), n=$('.fnote',p); if(on&&!n){ n=document.createElement('span'); n.className='fnote'; n.textContent='Note added'; p.appendChild(n); } else if(!on&&n) n.remove(); };
  var setRow=function(id,o){ var r=$('#att .tr.row[data-id="'+id+'"]'); if(!r) return; r.setAttribute('data-f',o.f); var st=$('.stt',r); st.textContent=o.st; st.className='stt'+(o.al?' al':''); $('.c-pl',r).innerHTML=o.place||''; var t=$('.tin',r); t.textContent=o.inT||''; t.classList.toggle('al',/late/.test(o.f)); if(o.inT) r.setAttribute('data-in',o.inT); else r.removeAttribute('data-in'); r.classList.toggle('hotz',/late|out/.test(o.f)); buildDay(r,0); var b=$('.day .b',r); if(b) b.style.transform='none'; };
  var recalc=function(){
    var rows=attRows, ins=rows.filter(function(r){ return has(r,'off')||has(r,'wfh'); }), lv=rows.filter(function(r){ return has(r,'leave'); }), out=outRows(), late=lateRows(), offc=rows.filter(function(r){ return has(r,'off'); });
    var first=function(r){ return pn(r).split(' ')[0]; };
    K('in','<b>'+ins.length+'</b><span>/'+(rows.length-lv.length)+'</span>', out.length?'Not in: '+out.map(pn).join(', '):lv.length?'Everyone else is in':'Everyone is in', out.length>0);
    K('late','<b>'+late.length+'</b>', late.length===1?pn(late[0])+', '+late[0].getAttribute('data-in'):late.length?late.map(function(r){ return first(r)+' '+r.getAttribute('data-in'); }).join(', '):'Nobody late', late.length>0);
    setCap(tile('ver'),offc.length+' of '+offc.length);
    var vz=$('.viz',tile('in')); vz.innerHTML=rows.map(function(r,j){ return '<i class="'+(has(r,'out')?'f':has(r,'leave')?'g':'')+'" style="--j:'+j+'"></i>'; }).join('');
    var cnt={'':rows.length,off:offc.length,wfh:rows.filter(function(r){ return has(r,'wfh'); }).length,late:late.length,out:out.length};
    $$('#attF .fc').forEach(function(b){ var v=b.getAttribute('data-f'), bb=$('b',b); bb.textContent=cnt[v]; bb.classList.toggle('al',(v==='late'||v==='out')&&cnt[v]>0); });
    var fl=flRows.filter(function(r){ return !r.classList.contains('gone'); }), hi=fl.filter(function(r){ return r.getAttribute('data-f')==='h'; });
    K('hf','<b>'+hi.length+'</b>', fl.length+(fl.length===1?' flag':' flags')+' in total', hi.length>0);
    $('.viz',tile('hf')).innerHTML=fl.map(function(r,j){ var f=r.getAttribute('data-f'); return '<i class="'+(f==='h'?'f':f==='l'?'g':'')+'" style="--j:'+j+'"></i>'; }).join('');
    var fc={'':fl.length,h:hi.length,m:fl.filter(function(r){ return r.getAttribute('data-f')==='m'; }).length,l:fl.filter(function(r){ return r.getAttribute('data-f')==='l'; }).length};
    $$('#flgF .fc').forEach(function(b){ var v=b.getAttribute('data-f'), bb=$('b',b); bb.textContent=fc[v]; bb.classList.toggle('al',v==='h'&&fc[v]>0); });
  };
  var vdLeave={f:'leave',st:'On leave',al:false,place:'',inT:null}, vdOut={f:'out',st:'Not in yet',al:true,place:'',inT:null};
  var ACT={
    leave:{}, swap:{},
    vd:{ok:{do:function(){ clearTimeout(nudgeT); nudgeT=setTimeout(vihaanIn,3200); },undo:function(){ clearTimeout(nudgeT); if(vdIn) setTimeout(morphVd,80); }},
        no:{do:function(){ setRow('vd',vdLeave); hideFlag('R01',true); setTimeout(recalc,480); },undo:function(){ setRow('vd',vdOut); hideFlag('R01',false); setTimeout(recalc,40); }}},
    vdl:{ok:{do:function(){ noteFlag('R01',true); },undo:function(){ noteFlag('R01',false); }},
         no:{do:function(){ hideFlag('R01',true); setTimeout(recalc,480); },undo:function(){ hideFlag('R01',false); setTimeout(recalc,40); }}},
    ks:{ok:{do:function(){ noteFlag('R02',true); },undo:function(){ noteFlag('R02',false); }},
        no:{do:function(){ hideFlag('R02',true); setTimeout(recalc,480); },undo:function(){ hideFlag('R02',false); setTimeout(recalc,40); }}}
  };
  var actOn=function(c,ok,fly){
    if(c.classList.contains('settled')) return; c.classList.add('settled');
    var w=c.parentNode, a=(ACT[c.getAttribute('data-act')]||{})[ok?'ok':'no']||{}, acts=$('.acts',c), ap=$('.btn',acts);
    acts.classList.add('fin'); w._t=[];
    if(ok){ ap.style.width=ap.offsetWidth+'px'; ap.getBoundingClientRect(); ap.classList.add('done'); ap.style.width='36px'; M.happy(); } else { ap.style.opacity='.25'; M.nod(); }
    if(fly&&navigator.vibrate){ try{ navigator.vibrate(12); }catch(err){} }
    if(a.do) a.do();
    lastC={w:w,a:a};
    w._t.push(setTimeout(function(){ openI((ok?CK:XK)+TX(c.getAttribute(ok?'data-ok':'data-no'),c.getAttribute('data-sub'))+'<button class="ib cap" type="button" data-undo="1">UNDO</button>'); later(closeI,3800); },fly?120:380));
    if(fly){ c.style.transition='translate .45s var(--ease),opacity .35s var(--ease)'; c.style.translate=(ok?'115%':'-115%')+' 0'; c.style.opacity='0'; }
    w._t.push(setTimeout(function(){ w.classList.add('going'); },fly?360:1100));
    w._t.push(setTimeout(function(){ flip(function(){ w.classList.add('gone'); }); counts(); if(!left()){ M.happy(); setTimeout(M.spin,900); } },fly?640:1480));
  };
  var undo=function(){ var L=lastC; if(!L) return; lastC=null; var w=L.w, c=$('.nc',w); (w._t||[]).forEach(clearTimeout); w._t=[]; if(L.a.undo) L.a.undo();
    var reset=function(){ var acts=$('.acts',c), ap=$('.btn',acts); acts.classList.remove('fin'); ap.classList.remove('done'); ap.style.width=''; ap.style.opacity=''; c.classList.remove('settled'); c.style.translate=''; c.style.opacity=''; c.style.transition=''; w.classList.remove('going'); };
    if(w.classList.contains('gone')){ w.classList.add('going'); flip(function(){ w.classList.remove('gone'); }); w.getBoundingClientRect(); requestAnimationFrame(reset); } else reset();
    counts(); M.pop(); };
  var bindCard=function(w){ var c=$('.nc',w);
    c.addEventListener('click',function(e){ var b=e.target.closest('button[data-a]'); if(b) actOn(c,b.getAttribute('data-a')==='ok'); });
    var x0=0, y0=0, dx=0, drag=false, dec=false, armed=false;
    c.addEventListener('pointerdown',function(e){ if(e.pointerType!=='touch'||e.target.closest('.acts button')||c.classList.contains('settled')) return; x0=e.clientX; y0=e.clientY; dx=0; drag=true; dec=false; armed=false; });
    c.addEventListener('pointermove',function(e){ if(!drag) return; var mx=e.clientX-x0, my=e.clientY-y0;
      if(!dec){ if(Math.abs(mx)>8&&Math.abs(mx)>Math.abs(my)){ dec=true; c.style.transition='none'; try{ c.setPointerCapture(e.pointerId); }catch(err){} } else if(Math.abs(my)>8){ drag=false; return; } else return; }
      dx=mx; c.style.translate=dx+'px 0'; w.classList.toggle('sl',dx>0); w.classList.toggle('sr',dx<0);
      var arm=Math.abs(dx)>w.offsetWidth*.32; if(arm!==armed){ armed=arm; w.classList.toggle('arm',arm); if(arm&&navigator.vibrate){ try{ navigator.vibrate(8); }catch(err){} } } });
    var end=function(){ if(!drag) return; drag=false; c.style.transition=''; w.classList.remove('arm');
      if(dec&&armed){ actOn(c,dx>0,true); } else { c.style.translate=''; setTimeout(function(){ w.classList.remove('sl','sr'); },400); } };
    c.addEventListener('pointerup',end); c.addEventListener('pointercancel',end);
  };
  $$('.ncw',ngrid).forEach(bindCard);
  isl.addEventListener('click',function(e){ if(mode==='cmd') return; var b=e.target.closest('.ib');
    if(b){ e.stopPropagation(); if(b.hasAttribute('data-undo')){ undo(); closeI(); return; } if(b.getAttribute('data-show')==='late'){ A.late().run(); return; } }
    closeI(); });
  setInterval(function(){ if(left()&&!document.hidden) M.ahem(); },16000);

  /* filters */
  var pickChip=function(box,v){ var b=$(box+' .fc[data-f="'+v+'"]'); if(b) b.click(); };
  var fresh=function(r){ r.classList.remove('fresh'); r.getBoundingClientRect(); r.classList.add('fresh'); };
  $('#attF').addEventListener('click',function(e){ var b=e.target.closest('.fc'); if(!b) return;
    $$('#attF .fc').forEach(function(x){ x.classList.toggle('on',x===b); x.setAttribute('aria-pressed',x===b?'true':'false'); });
    var v=b.getAttribute('data-f'); attRows.forEach(function(r){ var show=!v||has(r,v); if(show&&r.hidden) fresh(r); r.hidden=!show; }); });
  var rsel=$('#ruleSel'), sev='';
  var flApply=function(){ var n=0; flRows.forEach(function(r){ var on=(!sev||r.getAttribute('data-f')===sev)&&(!rsel.value||r.getAttribute('data-rule')===rsel.value); if(on&&r.hidden) fresh(r); r.hidden=!on; if(on&&!r.classList.contains('gone')) n++; }); $('#clear').hidden=n>0; };
  $('#flgF').addEventListener('click',function(e){ var b=e.target.closest('.fc'); if(!b) return; $$('#flgF .fc').forEach(function(x){ x.classList.toggle('on',x===b); x.setAttribute('aria-pressed',x===b?'true':'false'); }); sev=b.getAttribute('data-f'); flApply(); });
  rsel.addEventListener('change',flApply);

  /* live: the morning keeps happening while you watch */
  var tick=$('#tick');
  var tickTo=function(t){ var olds=$$('span',tick), n=document.createElement('span'); n.textContent=t; n.className='dn'; tick.appendChild(n); n.getBoundingClientRect(); olds.forEach(function(o){ o.classList.add('up'); setTimeout(function(){ if(o.parentNode) o.remove(); },650); }); n.classList.remove('dn'); };
  var vdIn=false;
  var morphVd=function(){ var w=$('.ncw[data-id="vd"]',ngrid); if(!w) return; var c=$('.nc',w); if(c.getAttribute('data-act')==='vdl') return; c.classList.add('morph'); setTimeout(function(){ $('.nt .cap:last-child',c).textContent='44 MIN LATE'; $('.ndt',c).textContent='In at 10:44, no leave on file'; $('.btn .lb',c).textContent='ADD NOTE'; $('.lnkb',c).textContent='EXCUSE'; $('.nsw-l',w).textContent='ADD NOTE'; $('.nsw-r',w).textContent='EXCUSE'; c.setAttribute('data-act','vdl'); c.setAttribute('data-ok','Note added'); c.setAttribute('data-no','Excused'); c.setAttribute('data-sub','VIHAAN DESAI, LATE ON 2 NOV'); c.classList.remove('morph'); },260); };
  var vihaanIn=function(){ var row=$('#att .tr.row[data-id="vd"]'); if(vdIn||!row||!has(row,'out')) return false; vdIn=true;
    setRow('vd',{f:'off late',st:'In office',al:false,place:'Mumbai HQ<span class="vf">verified</span>',inT:'10:44'});
    var d=document.createElement('i'); d.className='d f'; d.style.left='57.778%'; $('.viz',tile('late')).appendChild(d);
    var ft=$('#flg .fl[data-rule="R01"] .ft'); if(ft) ft.textContent='In at 10:44, no leave on file';
    P.vd.lates=2;
    recalc();
    var w=$('.ncw[data-id="vd"]',ngrid); if(w&&!w.classList.contains('gone')&&!$('.nc',w).classList.contains('settled')) morphVd();
    notify(TX('Vihaan Desai checked in','10:44, MUMBAI HQ, VERIFIED. 44 MIN LATE'),3400,row);
    tickTo('Vihaan Desai checked in, 10:44'); return true; };
  var newLead=function(){ PIPE.tot+=120000; PIPE.deals+=1; S.s1.c=7; S.s1.v=300000; S.s1.d.unshift(['Boutique hotel, Goa',120000]);
    var lr=$('.ppr[data-id="st-s1"]'); $('.ppt b',lr).textContent='7, '+inr(300000); lr.style.setProperty('--w','61%');
    countTo($('#plTot'),PIPE.tot); $('#plCap').textContent=PIPE.deals+' OPEN DEALS, A MONTH';
    K('pipe','<b>'+inr(PIPE.tot)+'</b>',PIPE.deals+' open deals, a month');
    notify(TX('New lead, Boutique hotel, Goa','₹1,20,000 A MONTH, ADDED TO LEAD'),3200,lr); M.happy();
    tickTo('New lead: Boutique hotel, Goa'); return true; };
  var newLeave=function(){
    var w=document.createElement('div'); w.className='ncw'; w.setAttribute('data-id','ri');
    w.innerHTML='<span class="nsw nsw-l cap">APPROVE</span><span class="nsw nsw-r cap">DECLINE</span><article class="card nc lift spot hotz" data-act="leave" data-sub="RHEA IYER, 14 NOV, CASUAL" data-ok="Approved" data-no="Declined"><div class="nt"><span class="cap">LEAVE REQUEST</span><span class="cap">1 DAY</span></div><h3 class="who"><button type="button" class="pn" data-open="p:ri">Rhea Iyer</button></h3><p class="ndt">Casual leave, 14 Nov</p><div class="acts"><button class="btn cap" type="button" data-a="ok"><span class="lb">APPROVE</span><svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button><button class="lnkb cap" type="button" data-a="no">DECLINE</button></div></article>';
    flip(function(){ ngrid.appendChild(w); }); bindCard(w); counts();
    notify(TX('Rhea Iyer asked for leave','14 NOV, CASUAL. IN NEEDS YOU'),3200,w); M.ahem();
    tickTo('Rhea Iyer asked for leave, 14 Nov'); return true; };
  var taraDone=function(){ P.tn.keeper='Onboarding done'; P.tn.pts=21;
    var pr=$('.per[data-id="pp-tn"]'); $('.tags',pr).innerHTML='Clear · <span class="k">Onboarding done</span>';
    var lb=$('.lbr[data-id="lb-tn"]'); countTo($('.pts',lb),21); $('.ln',lb).style.setProperty('--w','62%');
    notify(TX('Tara Nair finished onboarding','+3 POINTS, NOW ON 21'),3200,lb); M.happy();
    tickTo('Tara Nair finished onboarding'); return true; };
  var filmBack=function(){ PJ.on=7; PJ.risk=1; J.j1.p=70; J.j1.st='On track';
    countTo($('#pjOn'),7); countTo($('#pjRisk'),1);
    var r=$('.pjr[data-id="pj-j1"]'); $('.pp',r).textContent='70%'; $('.pjb i',r).style.setProperty('--p','70%'); var st=$('.pst',r); st.textContent='On track'; st.className='pst';
    hideFlag('R10',true); setTimeout(recalc,480);
    notify(TX('Festive campaign film is back on track','70%, BLOCKER CLEARED'),3200,r); M.happy();
    tickTo('Festive campaign film back on track'); return true; };
  var EV=[vihaanIn,newLead,newLeave,taraDone,filmBack], evI=0;
  var nextEv=function(first){ if(evI>=EV.length) return; setTimeout(function(){
      if(document.hidden||shOpen||mode==='cmd'){ nextEv(); return; }
      while(evI<EV.length&&!EV[evI++]()){} nextEv(); },first?11000:17000); };
  nextEv(true);
  window.__m360ev=function(i){ return EV[i](); };

  /* clients: rows and the share line light each other up */
  var cc=$('#cli');
  $$('[data-k]',cc).forEach(function(el){
    var mates=$$('[data-k="'+el.getAttribute('data-k')+'"]',cc);
    el.addEventListener('pointerenter',function(){ cc.classList.add('dim'); mates.forEach(function(m){ m.classList.add('hl'); }); });
    el.addEventListener('pointerleave',function(){ cc.classList.remove('dim'); mates.forEach(function(m){ m.classList.remove('hl'); }); });
  });

  /* a soft light follows the pointer across cards and the dark band */
  document.addEventListener('pointermove',function(e){ var s=e.target.closest&&e.target.closest('.spot'); if(!s) return; var r=s.getBoundingClientRect(); s.style.setProperty('--mx',(e.clientX-r.left).toFixed(0)+'px'); s.style.setProperty('--my',(e.clientY-r.top).toFixed(0)+'px'); },{passive:true});

  /* phone tab bar: a black lens slides to the tapped tab */
  var tb=$('#tb'), lens=$('.lens',tb);
  var lensTo=function(t){ if(!t||!t.offsetWidth) return; lens.style.transform='translate3d('+t.offsetLeft+'px,0,0)'; lens.style.width=t.offsetWidth+'px'; };
  window.__lens=function(){ lensTo($('.tab.on',tb)); };
  tb.addEventListener('click',function(e){ var t=e.target.closest('.tab'); if(!t) return; if(tabbar.classList.contains('min')){ tabbar.classList.remove('min'); setTimeout(window.__lens,640); return; } $$('.tab.on',tb).forEach(function(x){ x.classList.remove('on'); }); t.classList.add('on'); lensTo(t); });
  addEventListener('resize',function(){ window.__lens(); snapAll(); if(mode==='cmd') cbSize(); }); setTimeout(window.__lens,80);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ snapAll(); window.__lens(); });
  counts();

  /* keys: cmd K asks, / asks, [ folds the sidebar, esc closes */
  addEventListener('keydown',function(e){
    var tag=(document.activeElement&&document.activeElement.tagName)||'', typing=/INPUT|SELECT|TEXTAREA/.test(tag);
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(mode==='cmd') closeI(); else openCmd(''); }
    else if(e.key==='/'&&!typing){ e.preventDefault(); openCmd(''); }
    else if(e.key==='['&&!typing){ setSb(!html.classList.contains('sbx')); }
    else if(e.key==='Escape'){ if(mode==='cmd') closeI(); else if(shOpen) closeSheet(); else { closeI(); setJump(false); setMenu(false); } }
  });
})();
</script>
</body>
</html>

````

## Appendix B: the same design on a full OS

Built on the m360 OS as a claude.ai artifact (React 18 with htm, no build step, data through the claude.ai runtime). Lift B1 and B2 as they are. Port B3 to B6 to this codebase's framework, router and data layer, keeping the class names and the markup structure so B1 applies unchanged.

### B1. m360-os.css

Every OS component in the v7 language: shell, island, Ask bar, glass sheet, phone capsule, tab bar, menu, Command, and each page's classes (cards, buttons, pills, inputs, segmented controls, tabs, lists, boards, week grid, scores, handbook, voice, desk, gates). Load Space Grotesk 300 to 700 first.

````css
/* m360 OS, v7 design system mapped onto every OS page. Load Space Grotesk 300 to 700 before this file. */
:root{
  --flame:#F53901;--ink:#0E0E0E;--paper:#FFFFFF;--warm:#F7F6F2;--dark:#0A0A0A;
  --g80:rgba(14,14,14,.8);--g64:rgba(14,14,14,.64);--g45:rgba(14,14,14,.45);--g28:rgba(14,14,14,.26);--g12:rgba(14,14,14,.12);--g08:rgba(14,14,14,.08);--g04:rgba(14,14,14,.04);
  --line:rgba(14,14,14,.10);--line2:rgba(14,14,14,.18);
  --w64:rgba(255,255,255,.64);--w45:rgba(255,255,255,.45);--w20:rgba(255,255,255,.2);--w12:rgba(255,255,255,.12);
  --ease:cubic-bezier(.2,.8,.2,1);--io:cubic-bezier(.45,0,.55,1);
  --spring:cubic-bezier(.3,1.25,.45,1);--bounce:cubic-bezier(.32,1.45,.45,1);
  --inset:12px;--sbw:80px;--g:40px;--cl:calc(var(--inset) * 2 + var(--sbw));
  --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --arw:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E%3C/svg%3E");
  --chev:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230E0E0E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 10l5 5 5-5'/%3E%3C/svg%3E");
  color-scheme:light;
}
@supports (transition-timing-function:linear(0,1)){:root{--spring:linear(0,0.0172,0.0622,0.1268,0.2038,0.2876,0.3738,0.4589,0.5405,0.6167,0.6865,0.749,0.8042,0.8519,0.8926,0.9266,0.9545,0.9769,0.9945,1.0079,1.0176,1.0244,1.0286,1.0309,1.0315,1.031,1.0296,1.0276,1.0252,1.0225,1.0198,1.0171,1.0145,1.0121,1.0099,1.0079,1.0062,1.0047,1.0034,1.0023,1.0014,1.0007,1.0002,0.9998,0.9994,0.9992,0.9991,0.999,1);--bounce:linear(0,0.0279,0.1005,0.2029,0.3221,0.4475,0.571,0.6864,0.7897,0.8783,0.9512,1.0085,1.051,1.0802,1.0978,1.1058,1.1061,1.1008,1.0914,1.0795,1.0663,1.0529,1.04,1.0283,1.0179,1.0092,1.0022,0.9968,0.993,0.9904,0.9891,0.9886,0.9889,0.9897,0.9908,0.9921,0.9936,0.995,0.9963,0.9975,0.9985,0.9994,1,1.0005,1.0009,1.0011,1.0012,1.0012,1)}}
html.sbx{--sbw:248px}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;height:100%}
body{min-height:100%;background:var(--paper);color:var(--ink);font:400 15px/1.5 'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
html.gs-open body,html.mn-open body{overflow:hidden}
b,strong{font-weight:500}
a{color:inherit;text-decoration:none}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0;text-align:inherit;-webkit-tap-highlight-color:transparent}
button:disabled{cursor:not-allowed}
img{display:block;max-width:100%}
img[height]{height:auto}
svg{display:block}
i,em{font-style:normal}
:focus{outline:none}
:focus-visible{outline:2px solid var(--flame);outline-offset:3px;border-radius:10px}
::selection{background:var(--flame);color:#fff}
[hidden]{display:none!important}
#root{min-height:100vh}
.cap{font-size:12px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;font-weight:400}
.tn{font-variant-numeric:tabular-nums}
.go{display:block;flex:0 0 16px;width:16px;height:16px;background:var(--flame);-webkit-mask:var(--arw) center/16px 16px no-repeat;mask:var(--arw) center/16px 16px no-repeat;opacity:0;translate:-6px 0;transition:opacity .25s var(--ease),translate .5s var(--spring)}

/* live mark: the logo as a character. black always, only its pose changes */
.lm{position:absolute;left:0;top:50%;display:block;width:112px;height:33px;margin-top:-16.5px;color:#000;transform-origin:0 50%;transform:translateX(-4px) scale(.5715);transition:transform .6s var(--spring);pointer-events:none}
.sbx .side .lm{transform:translateX(20px) scale(1)}
.l-st,.l-react{display:block;width:100%;height:100%}
.l-react{transform-origin:50% 100%;perspective:600px}
.lmk{display:block;width:100%;height:auto;overflow:visible}
.l-pose,.l-breathe,.l-eye,.l-dot{transform-box:fill-box}
.l-pose{transform-origin:50% 100%}
.l-breathe{transform-origin:50% 100%;animation:breathe 4.6s var(--io) infinite}
.l-eye{transform-origin:50% 50%}
.l-dot{transform-origin:50% 50%;transition:transform .5s var(--spring)}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(.99,1.06)}}
.l-dot.blink{animation:blink .2s var(--io)}
@keyframes blink{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.08)}}
.r-stretch{animation:stretch 1.5s var(--io)}
@keyframes stretch{0%,100%{transform:scale(1,1) rotate(0)}28%{transform:scale(.93,1.2) rotate(0)}52%{transform:scale(1.05,.93) rotate(-3deg)}74%{transform:scale(.99,1.02) rotate(1deg)}}
.s-alert .l-breathe{animation-duration:3.2s}
.s-alert .l-dot{transform:scale(1.14)}
.s-calm .l-breathe{animation-duration:6.4s}
.s-calm .l-dot{transform:scale(1.06,.78)}
.s-sleep .l-breathe{animation-duration:7.5s}
.s-sleep .l-dot{transform:scale(1.1,.28)}
.s-happy .l-dot{transform:scale(1.25,.5)}
.s-concern .l-dot{transform:translateY(-18px) scale(.86)}
.s-think .l-dot{animation:think .8s linear infinite}
@keyframes think{0%,100%{transform:translate(0,-24px)}12.5%{transform:translate(17px,-17px)}25%{transform:translate(24px,0)}37.5%{transform:translate(17px,17px)}50%{transform:translate(0,24px)}62.5%{transform:translate(-17px,17px)}75%{transform:translate(-24px,0)}87.5%{transform:translate(-17px,-17px)}}
.r-hop{animation:hop .8s var(--io)}
@keyframes hop{0%{transform:translateY(0) scale(1,1)}16%{transform:translateY(0) scale(1.08,.86)}44%{transform:translateY(-42%) scale(.95,1.08)}70%{transform:translateY(0) scale(1.1,.88)}85%{transform:translateY(0) scale(.97,1.04)}100%{transform:translateY(0) scale(1,1)}}
.r-nod{animation:nod .65s var(--io)}
@keyframes nod{0%,100%{transform:rotate(0)}30%{transform:rotate(7deg)}62%{transform:rotate(-3deg)}}
.r-wig{animation:wig .75s var(--io)}
@keyframes wig{0%,100%{transform:rotate(0)}18%{transform:rotate(-7deg)}38%{transform:rotate(6deg)}58%{transform:rotate(-4deg)}78%{transform:rotate(2deg)}}
.r-spin{animation:spin 1.05s cubic-bezier(.5,0,.15,1)}
@keyframes spin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}
.r-pop{animation:pop .5s var(--io)}
@keyframes pop{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
.r-ahem{animation:ahem .75s var(--io)}
@keyframes ahem{0%,100%{transform:translateY(0)}20%{transform:translateY(-16%)}40%{transform:translateY(0)}60%{transform:translateY(-10%)}80%{transform:translateY(0)}}

/* sidebar: glass, slim icons, expands to names. icons never move between the two */
.side{position:fixed;z-index:60;left:var(--inset);top:var(--inset);bottom:var(--inset);width:var(--sbw);display:flex;flex-direction:column;padding:12px;border-radius:28px;background-color:rgba(255,255,255,.56);background-image:var(--grain),linear-gradient(165deg,rgba(255,255,255,.75),rgba(255,255,255,.15) 38%,rgba(255,255,255,0) 60%,rgba(255,255,255,.35));-webkit-backdrop-filter:blur(28px) saturate(185%);backdrop-filter:blur(28px) saturate(185%);box-shadow:0 0 0 1px rgba(14,14,14,.07),0 1px 2px rgba(14,14,14,.04),0 28px 60px -30px rgba(14,14,14,.38),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.45);transition:width .6s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
.side::after{content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(150deg,#fff,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 50%,rgba(255,255,255,.25) 76%,rgba(255,255,255,.95));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.side.dk{background-color:rgba(255,255,255,.84);box-shadow:0 0 0 1px rgba(255,255,255,.2),0 28px 60px -24px rgba(0,0,0,.6),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(255,255,255,.5)}
.sbt{position:relative;flex:0 0 48px;display:block;width:100%;height:48px;border-radius:14px}
.snav{position:relative;flex:1;min-height:0;margin:0 -12px;padding:0 12px 8px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
.snav::-webkit-scrollbar{display:none}
.snav.ovb{-webkit-mask-image:linear-gradient(#000 calc(100% - 32px),transparent);mask-image:linear-gradient(#000 calc(100% - 32px),transparent)}
.snav.ovt{-webkit-mask-image:linear-gradient(transparent,#000 32px);mask-image:linear-gradient(transparent,#000 32px)}
.snav.ovt.ovb{-webkit-mask-image:linear-gradient(transparent,#000 32px,#000 calc(100% - 32px),transparent);mask-image:linear-gradient(transparent,#000 32px,#000 calc(100% - 32px),transparent)}
.sgl{position:relative;display:flex;align-items:flex-end;height:32px;padding:0 0 6px 18px;font-size:12px;letter-spacing:.14em;color:var(--g45);white-space:nowrap}
.sgl span{opacity:0;transition:opacity .25s var(--ease)}
.sbx .sgl span{opacity:1;transition:opacity .35s var(--ease) .15s}
.sgl::before{content:"";position:absolute;left:20px;width:16px;top:50%;height:1px;background:var(--g12);transition:opacity .3s var(--ease)}
.sbx .sgl::before{opacity:0}
.nv{position:relative;z-index:1;display:flex;align-items:center;gap:14px;width:100%;height:36px;padding-left:18px;border-radius:12px;font-size:14px;line-height:20px;font-weight:400;color:var(--g64);white-space:nowrap;overflow:hidden;transition:color .3s var(--ease),background-color .3s var(--ease),scale .45s var(--spring)}
.nv+.nv{margin-top:2px}
.nv>svg{flex:0 0 20px;width:20px;height:20px}
.nv:hover{color:var(--ink)}
.nv.on{color:#fff}
.nv:active{scale:.95}
.nl{opacity:0;transition:opacity .2s var(--ease);min-width:0;overflow:hidden;text-overflow:ellipsis}
.sbx .nl{opacity:1;transition:opacity .35s var(--ease) .12s}
.nl small{display:block;font-size:12px;line-height:16px;color:var(--g45);overflow:hidden;text-overflow:ellipsis}
.js .snav .nv,.js .sfoot .nv{animation:nvin .7s var(--ease) backwards;animation-delay:calc(var(--j,0) * 28ms + 150ms)}
@keyframes nvin{from{opacity:0;translate:-10px 0}}
.bd{position:absolute;left:0;top:0;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:grid;place-items:center;font-size:11px;font-weight:500;line-height:1;color:#fff;background:var(--flame);font-variant-numeric:tabular-nums;transform:translate(32px,2px) scale(.9);transition:transform .6s var(--spring)}
.sbx .side .bd{transform:translate(186px,9px) scale(1)}
.sp{position:absolute;z-index:0;left:12px;right:12px;top:0;height:36px;border-radius:12px;pointer-events:none;transition:transform .55s var(--spring),opacity .25s var(--ease)}
.sp-h{background:var(--warm);opacity:0}
.sp-a{background:var(--ink);box-shadow:0 10px 22px -12px rgba(14,14,14,.7)}
.here{position:absolute;z-index:1;left:3px;top:0;width:3px;height:16px;border-radius:2px;background:var(--flame);pointer-events:none;transition:transform .55s var(--spring)}
.sfoot{flex:0 0 auto;margin-top:8px;padding-top:8px;box-shadow:0 -1px 0 var(--g08)}
.sfoot .nv:hover{background:var(--warm)}
.sfoot .kb{margin-left:auto;margin-right:12px}
.sfoot .av{flex:0 0 22px;margin:0 -1px}
.kb{display:inline-flex;align-items:center;gap:1px;height:24px;padding:0 7px;border-radius:8px;font-size:12px;font-weight:500;line-height:1;color:var(--g64);background:#fff;box-shadow:inset 0 0 0 1px var(--line2);font-family:inherit}
.tip{position:fixed;z-index:70;left:0;top:0;display:flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:10px;font-size:13px;line-height:1;color:#fff;background:var(--ink);white-space:nowrap;pointer-events:none;opacity:0;transform:translate3d(var(--tx,0),var(--ty,0),0) scale(.94);transform-origin:0 50%;transition:opacity .2s var(--ease),transform .45s var(--spring)}
.tip.on{opacity:1;transform:translate3d(var(--tx,0),var(--ty,0),0) scale(1)}
.tip .bd{position:static;transform:none}
.tip .kb{color:var(--w64);background:rgba(255,255,255,.1);box-shadow:none}

/* canvas */
.app{min-height:100vh}
.main{container:main/inline-size;min-width:0;overflow-x:clip;padding:40px calc(var(--inset) + var(--g)) 96px calc(var(--cl) + var(--g));transition:padding-left .6s var(--spring)}
.page{max-width:1040px;margin:0 auto}
.page.wide{max-width:1240px}
.page.cmd{max-width:none}
.js .page>*{animation:rise .75s var(--ease) backwards}
.js .page>.rv,.js .page>.c-rail{animation:none}
.js .page>:nth-child(2){animation-delay:.05s}.js .page>:nth-child(3){animation-delay:.1s}.js .page>:nth-child(4){animation-delay:.15s}.js .page>:nth-child(5){animation-delay:.2s}.js .page>:nth-child(n+6){animation-delay:.24s}
@keyframes rise{from{opacity:0;translate:0 14px}}

/* type */
.ph{display:flex;flex-direction:column;gap:16px;margin-bottom:40px}
.ph>div:first-child:not(.lab){display:flex;flex-direction:column;align-items:flex-start;gap:16px;min-width:0}
.ph.row{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:24px}
.ph h1,.c-top h1{font-size:48px;line-height:52px;font-weight:600;letter-spacing:-.035em;overflow-wrap:anywhere}
.ph h1::after,.c-top h1::after{content:".";color:var(--flame)}
.ph .sub{max-width:60ch;margin:0;padding:0;border:0;box-shadow:none;font-size:15px;line-height:22px;color:var(--g64)}
.lab{display:inline-flex;align-items:center;gap:8px;min-height:16px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g64);font-weight:400}
.lab::before{content:"";flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.mut{color:var(--g64)}
.soft{color:var(--g45)}
.sm{font-size:13px;line-height:20px}
.flt{color:var(--flame)}
.big{margin:4px 0 16px;font-size:24px;line-height:30px;font-weight:300;letter-spacing:-.02em}
.big2{font-size:18px;line-height:24px}
.pre{white-space:pre-wrap;word-break:break-word}
.who-n{font-weight:500;font-size:14.5px;line-height:20px}
.grow{flex:1 1 auto;min-width:0}
h2{font-weight:500;letter-spacing:-.02em}
h3{font-weight:500;letter-spacing:-.015em}

/* layout */
.card{position:relative;display:block;background:#fff;border-radius:20px;padding:24px;box-shadow:0 0 0 1px var(--line);transition:translate .6s var(--spring),box-shadow .5s var(--ease)}
button.card{width:100%;text-align:left}
@media (hover:hover){button.card:hover,.card.lift:hover{translate:0 -2px;box-shadow:0 0 0 1px var(--line),0 26px 50px -30px rgba(14,14,14,.32)}}
button.card:active{scale:.99}
.card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;padding:1px;background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),rgba(14,14,14,.36),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);transition:opacity .45s var(--ease)}
@media (hover:hover){.card:hover::after{opacity:1}}
.card.due::before,.post.pinned::before,.card.setup::before{content:"";position:absolute;left:24px;right:24px;top:0;height:2px;border-radius:0 0 2px 2px;background:var(--flame)}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px;margin-bottom:16px;padding-bottom:12px;box-shadow:0 1px 0 var(--line)}
.card-h>:last-child:not(:first-child){flex:0 0 auto}
.card-h.mt{margin-top:24px}
.card.pad0{padding:0;overflow:hidden}
.card.inset{background:var(--warm);box-shadow:none}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid2>*{min-width:0}
.grid2.tight{gap:12px}
.mt{margin-top:16px}.mt2{margin-top:32px}.mb{margin-bottom:16px}
.row{display:flex;align-items:center}
.gap{gap:12px}.gap4{gap:6px}
.between{justify-content:space-between}
.wrap{flex-wrap:wrap}
.stack{display:flex;flex-direction:column;gap:12px}
.pad0{padding:0;overflow-x:auto}
.empty{padding:12px 0 4px;font-size:15px;line-height:22px;color:var(--g45)}

/* controls */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;border-radius:20px;font-size:14px;font-weight:500;line-height:1;color:#fff;background:var(--ink);white-space:nowrap;transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring),opacity .3s var(--ease)}
.btn svg{width:16px;height:16px;flex:0 0 16px}
@media (hover:hover){.btn:hover{background:var(--flame)}}
.btn:active{scale:.95}
.btn.sec{color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px var(--line2)}
@media (hover:hover){.btn.sec:hover{color:#fff;background:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}}
.btn.ghost{height:32px;padding:0 14px;border-radius:16px;font-size:13px;font-weight:400;color:var(--ink);background:transparent;box-shadow:inset 0 0 0 1px var(--line2)}
@media (hover:hover){.btn.ghost:hover{color:#fff;background:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}}
.btn.sm{height:32px;padding:0 14px;border-radius:16px;font-size:13px}
.btn:disabled{opacity:.36;pointer-events:none}
.btn.arm,.btn.arm:hover{color:#fff;background:var(--flame);box-shadow:none}
.icb{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:18px;transition:background-color .3s var(--ease),scale .45s var(--spring)}
.icb svg{width:18px;height:18px}
.icb:hover{background:var(--warm)}
.icb:active{scale:.92}
.icb.bd1{background:#fff;box-shadow:inset 0 0 0 1px var(--line2)}
.icb.bd1:hover{background:var(--warm)}
.icb:disabled{opacity:.32}
.in,.ta,.sel{width:100%;min-height:44px;padding:10px 14px;border:0;border-radius:14px;font-size:15px;line-height:22px;font-weight:400;color:var(--ink);background:var(--warm);box-shadow:inset 0 0 0 1px var(--g08);caret-color:var(--flame);transition:background-color .25s var(--ease),box-shadow .25s var(--ease)}
@media (hover:hover){.in:hover,.ta:hover,.sel:hover{box-shadow:inset 0 0 0 1px var(--line2)}}
.in:focus,.ta:focus,.sel:focus{background:#fff;box-shadow:inset 0 0 0 1px var(--ink),0 0 0 4px var(--g04)}
.ta{resize:vertical;min-height:72px}
.ta.tall{min-height:340px;font-size:14px;line-height:22px}
.in::placeholder,.ta::placeholder{color:var(--g45)}
.sel{-webkit-appearance:none;appearance:none;padding-right:40px;background-image:var(--chev);background-repeat:no-repeat;background-position:right 14px center;background-size:16px 16px;cursor:pointer}
.sel.narrow{width:auto;max-width:240px;min-height:40px;height:40px;padding-top:0;padding-bottom:0;border-radius:20px;font-size:14px}
.sel.mini{width:auto;max-width:100%;min-height:32px;height:32px;padding:0 32px 0 12px;font-size:13px;line-height:20px;border-radius:16px;background-position:right 10px center;background-size:14px 14px}
.in.mini{width:160px;min-height:36px;padding:6px 12px;font-size:13.5px;border-radius:12px}
.in.narrow{max-width:120px}
.in.num{max-width:96px;text-align:right}
input[type=date].in,input[type=time].in{min-height:44px}
.fld{display:flex;flex-direction:column;gap:8px;min-width:0}
.fl-l{font-size:12px;line-height:16px;letter-spacing:.06em;font-weight:500;color:var(--g64)}
.fl-h{font-size:12px;line-height:16px;color:var(--g45)}
.ck{display:flex;align-items:center;gap:12px;font-size:14px;line-height:20px;cursor:pointer}
.ck input{width:18px;height:18px;flex:0 0 18px;accent-color:var(--ink)}
.pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;font-size:12px;line-height:1;letter-spacing:.02em;font-weight:400;color:var(--g64);background:#fff;box-shadow:inset 0 0 0 1px var(--line2);white-space:nowrap}
.pill svg{width:12px;height:12px}
.pill.ink{color:#fff;background:var(--ink);box-shadow:none}
.pill.fl{color:#fff;background:var(--flame);box-shadow:none}
.pill.fo{color:var(--ink);box-shadow:inset 0 0 0 1px var(--flame)}
.pill.wm{color:var(--ink);background:var(--warm);box-shadow:none}
.seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:20px;background:var(--warm)}
.seg button{height:32px;padding:0 14px;border-radius:16px;font-size:13px;line-height:1;font-weight:400;color:var(--g64);transition:color .3s var(--ease),background-color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.seg button:hover{color:var(--ink)}
.seg button.on{color:#fff;background:var(--ink);box-shadow:0 8px 18px -10px rgba(14,14,14,.6)}
.seg button:active{scale:.94}
.tabs{display:flex;gap:8px;margin:8px 0 0;padding-bottom:4px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:0 0 auto;height:36px;padding:0 16px;border-radius:18px;font-size:13px;line-height:1;color:var(--ink);background:var(--warm);white-space:nowrap;transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.tab:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.tab.on{color:#fff;background:var(--ink);box-shadow:none}
.tab:active{scale:.94}
.dot{width:6px;height:6px;border-radius:50%;background:var(--g28);flex:0 0 6px}
.dot.fl{background:var(--flame)}
.lnk{color:var(--ink);font-weight:500;font-size:14px;background:linear-gradient(var(--flame),var(--flame)) 0 100%/100% 1px no-repeat;padding-bottom:1px;transition:color .3s var(--ease)}
.lnk:hover{color:var(--flame)}
.lnkb{font:inherit;color:inherit;text-align:left;background:linear-gradient(var(--flame),var(--flame)) 0 100%/0 1px no-repeat;padding:0 0 1px;transition:color .3s var(--ease),background-size .45s var(--ease)}
.lnkb:hover{color:var(--flame);background-size:100% 1px}
.av{flex:0 0 auto;border-radius:50%;object-fit:cover;display:inline-grid;place-items:center;overflow:hidden;font-weight:500;line-height:1;letter-spacing:.02em;color:#fff;background:var(--ink)}
.av.av0{background:var(--g12);color:var(--g64)}
.hi{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--flame);margin-right:6px;vertical-align:middle}
.bar{height:3px;border-radius:2px;background:var(--g08);overflow:hidden;margin:12px 0}
.bar i{display:block;height:100%;border-radius:2px;background:var(--ink);transform-origin:0 50%;animation:growx 1.1s var(--ease) backwards}
@keyframes growx{from{transform:scaleX(0)}}

/* lists used everywhere */
.tl{list-style:none;display:flex;flex-direction:column}
.tl li{display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 0;font-size:14.5px;line-height:20px;box-shadow:0 1px 0 var(--g08)}
.tl li:last-child{box-shadow:none}
.tl-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:48px;padding:10px 0;font-size:14px;line-height:20px;box-shadow:0 1px 0 var(--g08)}
.kv:last-child{box-shadow:none}
.kv b{font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.lv{display:flex;flex-direction:column}
.lv-r{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:12px 0;flex-wrap:wrap;box-shadow:0 1px 0 var(--g08)}
.lv-r:last-child{box-shadow:none}
.note{margin-top:12px;padding:12px 16px;border-radius:14px;background:var(--warm);font-size:14px;line-height:20px}

/* today */
.card.ann{margin-bottom:16px}
.ann-h{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.flags{display:flex;flex-direction:column}
.flag{display:flex;gap:12px;align-items:flex-start;padding:12px 0;box-shadow:0 1px 0 var(--g08)}
.flag:last-child{box-shadow:none}
.flag b{display:block;font-size:14px;line-height:20px;font-weight:500}
.flag .mut.sm{margin-top:2px}
.sev{flex:0 0 8px;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--g28)}
.sev.high{background:var(--flame)}.sev.medium{background:var(--ink)}.sev.low{background:var(--g28)}
.consent{margin:16px 0 0;padding-top:12px;font-size:12px;line-height:16px;color:var(--g45);box-shadow:0 -1px 0 var(--g08)}
.who{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.who-i{display:flex;align-items:center;gap:12px;min-width:0}
.who-i>div{min-width:0}
.eod{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px 16px;margin-bottom:12px;font-size:14.5px;line-height:20px}
.eod dt{font-size:12px;line-height:20px;letter-spacing:.1em;color:var(--g45)}
.plan{list-style:none;counter-reset:pl;display:flex;flex-direction:column}
.plan li{counter-increment:pl;display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 0;font-size:14.5px;line-height:20px;box-shadow:0 1px 0 var(--g08)}
.plan li:before{content:counter(pl);flex:0 0 16px;width:16px;font-size:12px;font-weight:500;color:var(--flame);font-variant-numeric:tabular-nums}
.plan li:last-child{box-shadow:none}
.pt{flex:1 1 auto;min-width:0}
.conns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.conn{min-width:0;padding:16px;border-radius:16px;background:var(--warm)}
.conn-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.conn .tl li{flex-wrap:wrap;min-height:40px;box-shadow:0 1px 0 var(--g08)}
.conn .tl li:last-child{box-shadow:none}
.tm{flex:0 0 46px;font-variant-numeric:tabular-nums}

/* feed */
.composer{display:flex;flex-direction:column;gap:12px}
.composer .ta{min-height:80px;padding:4px 2px;font-size:17px;line-height:26px;background:transparent;box-shadow:none;border-radius:0}
.composer .ta:focus{box-shadow:none}
.posts{display:flex;flex-direction:column;gap:16px;margin-top:16px}
.post-h{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.post-t{margin-bottom:16px;font-size:15.5px;line-height:24px}
.reacts{display:flex;gap:8px;flex-wrap:wrap}
.rx{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;font-size:15px;background:var(--warm);transition:box-shadow .3s var(--ease),scale .45s var(--spring)}
.rx:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.rx:active{scale:.9}
.rx b{font-size:12.5px;font-weight:500}
.rx.on{background:#fff;box-shadow:inset 0 0 0 1px var(--ink)}

/* boards: tasks, projects, pitches */
.board{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:12px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin}
.pboard{grid-template-columns:repeat(7,minmax(230px,1fr))}
.col{display:flex;flex-direction:column;gap:8px;min-height:200px;padding:12px;border-radius:20px;background:var(--warm)}
.col-h{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;font-size:13px;line-height:20px;font-weight:500}
.col-h .mut{font-weight:400;color:var(--g45);font-variant-numeric:tabular-nums}
.col-e{padding:8px 6px;font-size:13px;color:var(--g45)}
.tk{display:flex;flex-direction:column;gap:10px;width:100%;padding:14px;border-radius:16px;text-align:left;background:#fff;box-shadow:0 0 0 1px var(--line);transition:translate .6s var(--spring),box-shadow .5s var(--ease)}
@media (hover:hover){.tk:hover{translate:0 -2px;box-shadow:0 0 0 1px var(--line2),0 18px 36px -24px rgba(14,14,14,.4)}}
.tk:active{scale:.98}
.tk-t{font-size:14.5px;line-height:20px;font-weight:500}
.tk-m{display:flex;flex-wrap:wrap;gap:6px}
.tk-m .pill{height:22px;padding:0 8px;font-size:11.5px;border-radius:11px}
.tk-o{display:flex;align-items:center;gap:8px}
.pj{display:flex;flex-direction:column;gap:8px}
.pj h3{margin:0;font-size:18px;line-height:24px}
.prow{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:12px;align-items:center;min-height:48px;padding:8px 0;box-shadow:0 1px 0 var(--g08)}
.prow:last-child{box-shadow:none}
.prow-t{font:inherit;text-align:left;background:none;border:0;color:inherit;cursor:pointer;padding:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prow-t:hover{color:var(--flame)}
.secr{margin-bottom:8px}
.sec h3{margin:0;font-size:16px}
.upd{padding:12px 0;box-shadow:0 1px 0 var(--g08)}
.upd:last-child{box-shadow:none}
.upd p{margin:6px 0 0;font-size:14px;line-height:20px}
.sub{margin-top:24px;padding-top:16px;box-shadow:0 -1px 0 var(--line)}
.subr{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:40px;padding:4px 0}
.cmt{display:flex;gap:12px;align-items:flex-start;padding:10px 0}
.cmt p{margin:2px 0 0}
.done{text-decoration:line-through;color:var(--g45)}
.tick{width:20px;height:20px;flex:0 0 20px;border-radius:50%;display:inline-grid;place-items:center;box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.tick:active{scale:.86}
.tick.on{color:#fff;background:var(--ink);box-shadow:none}
.tick svg{width:12px;height:12px}

/* clients, people */
.cl-c{display:flex;flex-direction:column;gap:8px}
.cl-c h3{font-size:20px;line-height:26px;font-weight:500;letter-spacing:-.02em}
.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:20px;color:var(--g64)}
.ppl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.pp{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.pp .pill{margin-top:8px}
.pp-h{display:flex;align-items:center;gap:20px}
.ph.pp-h{flex-direction:row;align-items:center;gap:24px}
.pp-h>div{display:flex;flex-direction:column;align-items:flex-start;gap:12px;min-width:0}
.back{margin:0 0 16px -4px}
.sct{display:flex;flex-direction:column;font-size:13.5px}
.sct-r{display:grid;grid-template-columns:56px repeat(4,minmax(0,1fr));gap:8px;min-height:44px;align-items:center;box-shadow:0 1px 0 var(--g08);font-variant-numeric:tabular-nums}
.sct-r:last-child{box-shadow:none}
.sct-r.hd{min-height:32px;font-size:12px;letter-spacing:.1em;color:var(--g45)}
.ladder{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;border-radius:14px;background:var(--warm)}
.ladder b{font-size:15px}
.ladder.on{background:#fff;box-shadow:inset 0 0 0 1px var(--flame)}
.eodrow{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:12px 0;font-size:14.5px;line-height:20px;box-shadow:0 1px 0 var(--g08)}
.eodrow:last-child{box-shadow:none}
.acc{display:flex;flex-direction:column}
.acc-r{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 0;box-shadow:0 1px 0 var(--g08)}
.acc-r:last-child{box-shadow:none}
.acc-r.off b{text-decoration:line-through;color:var(--g45)}
.offrow{min-height:44px;padding:8px 0;box-shadow:0 1px 0 var(--g08)}
.offrow:last-child{box-shadow:none}
.offst{margin-top:16px;padding-top:12px;box-shadow:0 -1px 0 var(--line)}
.inset{margin-top:12px}
.evr{padding:12px 0;box-shadow:0 1px 0 var(--g08)}
.evr:last-child{box-shadow:none}
.evr p{margin:6px 0 0}
.rules{margin-top:20px;padding-top:12px;box-shadow:0 -1px 0 var(--line)}
.rule{display:flex;align-items:flex-start;gap:12px;padding:10px 0;box-shadow:0 1px 0 var(--g08)}
.rule:last-child{box-shadow:none}

/* the week */
.wg{display:grid;grid-template-columns:minmax(160px,1.4fr) repeat(6,minmax(72px,1fr));min-width:700px}
.wg-h{display:flex;align-items:baseline;gap:6px;padding:16px 12px 12px;font-size:12px;letter-spacing:.12em;color:var(--g45);box-shadow:0 1px 0 var(--line)}
.wg-h span{font-size:13px;letter-spacing:0;color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}
.wg-h.td{color:var(--flame)}
.wg-h.td span{color:var(--flame)}
.wg-p{display:flex;align-items:center;gap:10px;min-width:0;padding:12px;font-size:14px;font-weight:500;box-shadow:0 1px 0 var(--g08)}
.wg-p span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wg-c{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;min-height:60px;padding:10px 12px;box-shadow:0 1px 0 var(--g08),inset 1px 0 0 var(--g08);transition:background-color .25s var(--ease)}
.wg-c:disabled{cursor:default}
.wg-c:not(:disabled):hover{background:var(--warm)}
.wg-c.fut{background:repeating-linear-gradient(135deg,transparent 0 6px,var(--g04) 6px 12px)}
.st{font-size:12px;font-weight:500;letter-spacing:.02em}
.st-office{color:var(--ink)}.st-wfh{color:var(--g64)}.st-leave{color:var(--flame)}.st-holiday{color:var(--g45)}
.eodk{font-size:11px;font-weight:500;line-height:18px;padding:0 7px;border-radius:9px;color:#fff;background:var(--ink)}
.eodk.bl{background:var(--flame)}
.eodk.miss{color:var(--g45);background:transparent;box-shadow:inset 0 0 0 1px var(--line2)}
.mk{height:28px;padding:0 12px;border-radius:14px;font-size:12.5px;font-weight:500;color:var(--g64);box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),color .3s var(--ease),scale .45s var(--spring)}
.mk:active{scale:.92}
.mk.hit{color:#fff;background:var(--ink);box-shadow:none}
.mk.miss{color:#fff;background:var(--flame);box-shadow:none}
.rv-q{display:flex;align-items:center;gap:6px;margin:16px 0 12px;flex-wrap:wrap}
.qn{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:16px;font-weight:500;font-size:13.5px;box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),color .3s var(--ease),scale .45s var(--spring)}
.qn:active{scale:.9}
.qn.on{color:#fff;background:var(--ink);box-shadow:none}

/* scores */
.podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;align-items:end;margin-bottom:16px}
.pod-s{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;border-radius:20px;text-align:center;background:#fff;box-shadow:0 0 0 1px var(--line)}
.pod-s.p0{padding:28px 12px;color:#fff;background:var(--dark);box-shadow:0 30px 60px -36px rgba(14,14,14,.6)}
.pod-s.p0 .mut{color:var(--w64)}
.pod-s .pts{font-size:44px;line-height:44px;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.pod-s.p0 .pts{font-size:64px;line-height:60px}
.pod-s b{font-weight:500}
.pod-s.empty{box-shadow:none;background:none}
.lb{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 0;box-shadow:0 1px 0 var(--g08)}
.lb:last-of-type{box-shadow:none}
.lb b{font-weight:500}
.rank{width:20px;font-size:12px;color:var(--g45);font-variant-numeric:tabular-nums}
.split{display:flex;height:3px;margin-top:8px;border-radius:2px;overflow:hidden;background:var(--g08)}
.split i{display:block;height:100%;transform-origin:0 50%;animation:growx 1.1s var(--ease) backwards}
.split .o{background:var(--ink)}
.split .d{background:var(--g28)}
.brk{display:flex;flex-direction:column}
.brk-r{display:flex;justify-content:space-between;gap:12px;min-height:44px;align-items:center;font-size:14px;box-shadow:0 1px 0 var(--g08)}
.brk-r:last-child{box-shadow:none}
.brk-r b{font-weight:500;font-variant-numeric:tabular-nums}

/* handbook */
.hb{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}
.hb-nav{display:flex;flex-direction:column;gap:4px;position:sticky;top:24px}
.hb-i{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:10px 16px;border-radius:14px;font-size:14px;line-height:20px;text-align:left;background:#fff;box-shadow:inset 0 0 0 1px var(--line);transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.hb-i:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.hb-i:active{scale:.97}
.hb-i.on{color:#fff;background:var(--ink);box-shadow:none}
.hb-r{padding:32px 40px}
.hb-t{margin:8px 0 20px;font-size:32px;line-height:36px;font-weight:600;letter-spacing:-.03em}
.md{max-width:66ch}
.md h3{margin:28px 0 8px;font-size:21px;line-height:28px;font-weight:500;letter-spacing:-.02em}
.md h4{margin:20px 0 6px;font-size:16.5px;line-height:24px;font-weight:500}
.md p{margin:0 0 12px;font-size:15.5px;line-height:25px;color:var(--g80)}
.md ul{margin:4px 0 12px;list-style:none}
.md li{position:relative;margin:6px 0;padding-left:20px;font-size:15.5px;line-height:24px;color:var(--g80)}
.md li:before{content:"";position:absolute;left:2px;top:.66em;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.md b{color:var(--ink)}
.hb-f{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:28px;padding-top:20px;box-shadow:0 -1px 0 var(--line)}
.readers{display:flex;align-items:center;gap:10px}
.avs{display:flex}
.avs .av{margin-left:-6px;box-shadow:0 0 0 2px #fff}
.avs .av:first-child{margin-left:0}

/* voice */
.idea{display:flex;gap:12px;align-items:flex-start;padding:12px 0;box-shadow:0 1px 0 var(--g08)}
.idea:last-child{box-shadow:none}
.idea p{margin:0 0 2px}
.vote{min-width:44px;height:32px;padding:0 10px;border-radius:16px;font-size:12.5px;font-weight:500;background:#fff;box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),color .3s var(--ease),scale .45s var(--spring)}
.vote:active{scale:.9}
.vote.on{color:#fff;background:var(--ink);box-shadow:none}
.bars{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;height:160px;align-items:end}
.barc{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%;font-size:12px}
.barc i{display:block;width:8px;min-height:2px;border-radius:4px;background:var(--ink);transform-origin:50% 100%;animation:growy 1s var(--ease) backwards}
@keyframes growy{from{transform:scaleY(0)}}
.barc i.low{background:var(--flame)}
.barc b{font-weight:500;font-variant-numeric:tabular-nums}

/* desk */
.setup{margin-bottom:16px}
.steps{margin:12px 0 0 20px;display:flex;flex-direction:column;gap:8px;font-size:14.5px;line-height:22px}
.ros{display:flex;flex-direction:column;margin-bottom:16px}
.ros-r{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:12px 0;flex-wrap:wrap;box-shadow:0 1px 0 var(--g08)}
.ros-r:last-child{box-shadow:none}
.ros-r.off{opacity:.5}
.addp{display:flex;flex-direction:column;gap:12px}
.hits{display:flex;flex-direction:column;overflow:hidden;border-radius:14px;box-shadow:inset 0 0 0 1px var(--line2)}
.hit{display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 14px;font-size:14.5px;text-align:left;box-shadow:0 1px 0 var(--g08);transition:background-color .25s var(--ease)}
.hit:last-child{box-shadow:none}
.hit:hover{background:var(--warm)}
.lad{display:flex;flex-direction:column}
.lad-r{display:grid;grid-template-columns:minmax(0,1fr) 110px 140px;align-items:center;gap:12px;min-height:52px;padding:10px 0;box-shadow:0 1px 0 var(--g08)}
.lad-r:last-child{box-shadow:none}
.lad-r .pill{justify-self:end}
.kp{display:flex;flex-direction:column}
.kp-r{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px 24px;padding:14px 0;box-shadow:0 1px 0 var(--g08)}
.kp-r:last-child{box-shadow:none}
.kp-r p{grid-column:1 / -1}
.kp-q{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:4px 0}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:24px;row-gap:24px;margin-bottom:24px}
.kpi{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0;padding-top:16px;text-align:left;color:inherit}
.kpi::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--g12)}
.kpi.bad::before{height:2px;background:var(--flame)}
.kpi .k{font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g64)}
.kpi b{max-width:100%;font-size:40px;line-height:44px;font-weight:300;letter-spacing:-.045em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi .n{max-width:100%;font-size:13px;line-height:16px;color:var(--g64);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbl{overflow-x:auto}
.sec{min-width:0}

/* gate */
.gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:#fff}
.gate-in{width:100%;max-width:460px}
.gmark{position:relative;width:140px;height:42px;margin-bottom:48px}
.gmark .lm{width:140px;height:41px;margin-top:-20.5px;transform:none}
.gate h1{font-size:36px;line-height:40px;font-weight:600;letter-spacing:-.03em}
.gate h1::after{content:".";color:var(--flame)}
.gate p{margin-top:16px;font-size:16px;line-height:24px;color:var(--g64)}
.gate .row{margin-top:24px}
.js .gate-in>*{animation:rise .8s var(--ease) backwards}
.js .gate-in>:nth-child(2){animation-delay:.08s}.js .gate-in>:nth-child(3){animation-delay:.16s}.js .gate-in>:nth-child(4){animation-delay:.24s}

/* glass detail sheet: every drawer */
.gs-scrim{position:fixed;inset:0;z-index:84;background:rgba(14,14,14,.12);opacity:0;transition:opacity .35s var(--ease)}
.gs-scrim.on{opacity:1}
.gs{position:fixed;z-index:85;top:12px;right:12px;bottom:12px;width:min(520px,calc(100vw - 24px));display:flex;flex-direction:column;border-radius:28px;background-color:rgba(255,255,255,.86);background-image:var(--grain),linear-gradient(165deg,rgba(255,255,255,.7),rgba(255,255,255,0) 45%);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);box-shadow:0 0 0 1px rgba(14,14,14,.07),0 30px 70px -28px rgba(14,14,14,.45),inset 0 1px 0 #fff;transform:translate3d(calc(100% + 32px),0,0);transition:transform .6s var(--spring);overflow:hidden}
.gs.wide{width:min(720px,calc(100vw - 24px))}
.gs.on{transform:none}
.gs::after{content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(150deg,#fff,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 50%,rgba(255,255,255,.25) 76%,rgba(255,255,255,.95));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.grab{display:none}
.gs-h{position:relative;z-index:4;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 20px 16px 28px}
.gs-h h2{min-width:0;font-size:26px;line-height:30px;font-weight:300;letter-spacing:-.02em}
.shx{flex:0 0 36px;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:var(--ink);background:rgba(14,14,14,.06);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.shx:hover{background:rgba(14,14,14,.12)}
.shx:active{scale:.92}
.shx svg{width:18px;height:18px}
.gs-in{flex:1;min-height:0;overflow-y:auto;padding:8px 28px 32px;scrollbar-width:none}
.gs-in::-webkit-scrollbar{display:none}
.gs.on .gs-in>*{animation:rise .7s var(--ease) backwards}
.gs.on .gs-in>:nth-child(2){animation-delay:.04s}.gs.on .gs-in>:nth-child(3){animation-delay:.08s}.gs.on .gs-in>:nth-child(4){animation-delay:.12s}.gs.on .gs-in>:nth-child(n+5){animation-delay:.16s}
.gs .card{box-shadow:0 0 0 1px var(--line);background:rgba(255,255,255,.7)}

/* dynamic island: one black object for asking, answers, confirmations and live news */
#island{position:fixed;z-index:90;left:0;top:0;width:0;height:0;border-radius:18px;color:#fff;background:#000;overflow:hidden;opacity:0;pointer-events:none;cursor:pointer;box-shadow:0 22px 50px -18px rgba(0,0,0,.55);transition:left .62s var(--bounce),top .62s var(--bounce),width .62s var(--bounce),height .62s var(--bounce),border-radius .62s var(--bounce),opacity .16s var(--ease)}
#island.show{opacity:1;pointer-events:auto}
#island.closing{transition:left .42s var(--ease),top .42s var(--ease),width .42s var(--ease),height .42s var(--ease),border-radius .42s var(--ease),opacity .2s var(--ease) .3s}
.is-in{position:absolute;inset:0;display:flex;align-items:center;gap:14px;padding:0 16px 0 20px;opacity:0;transform:scale(.94);transition:opacity .3s var(--ease),transform .5s var(--spring)}
#island.open .is-in{opacity:1;transform:none;transition-delay:.16s}
#island .is-in.fade{opacity:0;transform:translate3d(0,-6px,0);transition-delay:0s}
.is-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.is-t b{font-size:15px;line-height:20px;font-weight:400;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-t em{font-size:12px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-ev{flex:0 0 10px;width:10px;height:10px;margin:0 4px 0 2px;border-radius:50%;background:var(--flame);animation:beat 1.2s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1)}50%{transform:scale(.5)}}
.is-ck{flex:0 0 32px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#000;background:#fff}
.is-ck.bad{color:#fff;background:var(--flame)}
.is-ck svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;animation:draw .5s var(--ease) .25s backwards}
@keyframes draw{from{stroke-dashoffset:24}}
.ib{flex:0 0 auto;height:32px;padding:0 14px;border-radius:16px;font-size:12px;letter-spacing:.1em;color:#fff;background:rgba(255,255,255,.12);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.ib:hover{background:var(--flame)}
.ib:active{scale:.94}
#island.cmd{cursor:default;box-shadow:0 34px 80px -24px rgba(0,0,0,.6)}
#island.cmd .is-in{display:block;padding:0}
.cb{display:flex;flex-direction:column;height:100%}
.cbr{flex:0 0 64px;display:flex;align-items:center;gap:12px;height:64px;padding:0 14px 0 20px}
.cbr>svg{flex:0 0 20px;width:20px;height:20px;color:rgba(255,255,255,.55)}
.cbr input{flex:1;min-width:0;height:40px;font:inherit;font-size:17px;line-height:24px;color:#fff;background:none;border:0;outline:none;caret-color:var(--flame)}
.cbr input::placeholder{color:rgba(255,255,255,.42)}
.cbk{color:rgba(255,255,255,.55);background:rgba(255,255,255,.08);box-shadow:none}
.cbl{flex:0 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.1);scrollbar-width:none}
.cbl::-webkit-scrollbar{display:none}
.cbh{padding:12px 12px 6px;font-size:12px;line-height:16px;letter-spacing:.14em;color:rgba(255,255,255,.4)}
.cbo{display:flex;align-items:center;gap:14px;width:100%;min-height:52px;padding:8px 12px;border-radius:14px;color:#fff;text-align:left;transition:background-color .2s var(--ease)}
.cbo.cur{background:rgba(255,255,255,.1)}
.cbo .ic{flex:0 0 32px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:12px;font-weight:500;color:#fff;background:rgba(255,255,255,.08)}
.cbo .ic svg{width:18px;height:18px}
.cbo .ic.r{border-radius:16px}
.cbo .tx{flex:1;min-width:0}
.cbo .tx b{display:block;font-size:15px;line-height:20px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbo .tx em{display:block;font-size:12px;line-height:16px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbo .rt{flex:0 0 auto;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.38);transition:color .2s var(--ease)}
.cbo.cur .rt{color:#fff}
.cbo.ans{min-height:76px;margin-top:4px}
.cbo.ans .ic{background:var(--flame)}
.cbo.ans .tx b{font-size:20px;line-height:26px;font-weight:300;letter-spacing:-.01em;white-space:normal}
.cbe{padding:18px 12px;font-size:14px;color:rgba(255,255,255,.55)}
:where(.flash){border-radius:12px}
.flash{outline:2px solid var(--flame);outline-offset:4px;animation:ring .7s var(--spring)}
@keyframes ring{from{outline-offset:18px}}
.flash.flash-out{outline-color:transparent;transition:outline-color .4s var(--ease)}

/* phone: capsule, menu, tab bar */
.pbar,.tabbar{display:none}
.lg{position:relative;isolation:isolate;background:var(--grain) rgba(255,255,255,.66);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);box-shadow:0 0 0 1px rgba(14,14,14,.06),0 14px 34px -14px rgba(14,14,14,.3),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4);transition:background-color .5s var(--ease),box-shadow .5s var(--ease)}
.lg::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(140deg,#fff,rgba(255,255,255,.3) 30%,rgba(255,255,255,0) 50%,rgba(255,255,255,.2) 75%,rgba(255,255,255,.9));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.lg.dk{background-color:rgba(255,255,255,.88);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 18px 44px -14px rgba(0,0,0,.65),inset 0 1px 0 #fff}
.pm{position:relative;flex:0 0 76px;width:76px;height:40px}
.pm .lm{width:76px;height:22px;margin-top:-11px;transform:none}
.where{display:inline-flex;align-items:center;gap:8px;height:36px;margin-left:auto;padding:0 12px 0 14px;border-radius:18px;font-size:13px;line-height:1;background:rgba(14,14,14,.05);transition:scale .45s var(--spring);max-width:52vw}
.where span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.where svg{flex:0 0 14px;width:14px;height:14px;transition:rotate .45s var(--spring)}
.where[aria-expanded="true"] svg{rotate:180deg}
.where:active,.mbtn:active{scale:.94}
.mbtn{position:relative;flex:0 0 40px;width:40px;height:40px;border-radius:20px;display:grid;place-items:center;transition:scale .45s var(--spring)}
.mdot{position:absolute;right:4px;top:4px;width:8px;height:8px;border-radius:50%;background:var(--flame);box-shadow:0 0 0 2px #fff}
.menu{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;padding:calc(16px + env(safe-area-inset-top,0px)) 24px calc(32px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(26px) saturate(160%);backdrop-filter:blur(26px) saturate(160%);opacity:0;transition:opacity .4s var(--ease)}
.menu.open{opacity:1}
.menu-top{display:flex;justify-content:space-between;align-items:center;height:48px}
.menu-top .pm{height:48px}
.menu-list{margin-top:8px;overflow:auto;scrollbar-width:none}
.menu-list::-webkit-scrollbar{display:none}
.menu-list .grp{margin:24px 0 8px;padding-left:4px;font-size:12px;letter-spacing:.14em;color:var(--g45)}
.mi{position:relative;display:flex;align-items:center;gap:16px;width:100%;height:52px;padding:0 4px;border-radius:14px;font-size:19px;line-height:24px;color:var(--ink);opacity:0;translate:0 12px;transition:opacity .45s var(--ease),translate .55s var(--spring),color .3s var(--ease)}
.mi svg{flex:0 0 22px;width:22px;height:22px;color:var(--g64)}
.menu.open .mi{opacity:1;translate:0 0;transition-delay:calc(var(--j) * 22ms + 60ms)}
.mi .bd{position:static;transform:none;margin-left:auto}
.mi.on{color:var(--flame)}
.mi.on svg{color:var(--flame)}
.mi:active{scale:.97}

/* the command page: v7 on live data */
.c-top{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;gap:32px;margin-bottom:0}
.c-tl{display:flex;flex-direction:column;gap:16px;min-width:0}
.c-lede{display:flex;align-items:center;flex-wrap:wrap;column-gap:12px;row-gap:4px;min-height:28px;font-size:15px;line-height:20px}
.c-needl{display:inline-flex;align-items:center;gap:6px;height:28px;font-size:14px;color:var(--flame);transition:color .3s var(--ease)}
.c-needl b{font-weight:500}
.c-needl .ar{width:14px;height:14px;background:currentColor;-webkit-mask:var(--arw) center/14px 14px no-repeat;mask:var(--arw) center/14px 14px no-repeat;rotate:90deg;transition:translate .45s var(--spring)}
.c-needl:hover .ar{translate:0 3px}
.c-needl.ok{color:var(--ink)}
.c-needl.ok .ar{display:none}
.c-tr2{flex:0 0 320px;width:320px;display:flex;flex-direction:column;align-items:stretch;gap:12px;margin-top:-6px}
.c-askf{position:relative;display:flex;align-items:center;gap:12px;width:100%;height:44px;padding:0 10px 0 16px;border-radius:22px;color:var(--g64);background:var(--warm);box-shadow:inset 0 0 0 1px var(--g08);transition:background-color .3s var(--ease),box-shadow .35s var(--ease),scale .45s var(--spring)}
.c-askf:hover{background:#fff;box-shadow:inset 0 0 0 1px var(--line2),0 14px 30px -20px rgba(14,14,14,.4)}
.c-askf:active{scale:.98}
.c-askf>svg{flex:0 0 18px;width:18px;height:18px;color:var(--ink);transition:color .3s var(--ease)}
.c-askf:hover>svg{color:var(--flame)}
.c-askf .phd{flex:1;font-size:14px;line-height:20px;text-align:left}
.c-live{display:flex;align-items:center;gap:12px;height:28px}
.chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.08em;box-shadow:inset 0 0 0 1px var(--line2)}
.chip i{width:6px;height:6px;border-radius:50%;background:var(--flame);animation:beat 1.8s ease-in-out infinite}
.c-tkr{position:relative;flex:1;min-width:0;height:20px;overflow:hidden;font-size:13px;line-height:20px;color:var(--g64)}
.c-tkr span{position:absolute;left:0;right:0;top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .6s var(--spring),opacity .3s var(--ease)}
.c-tkr span.up{transform:translateY(-100%);opacity:0}
.c-tkr span.dn{transform:translateY(100%);opacity:0;transition:none}
.c-sec{padding-top:64px}
#c-need{padding-top:48px}
.c-band{position:relative;margin:64px calc(-1 * var(--g)) 0;padding:64px var(--g);border-radius:28px}
.c-band.warm{background:var(--warm)}
.c-band.dark{background:var(--dark);color:#fff;clip-path:inset(0 calc((1 - var(--e,1)) * 32px) round calc(28px + (1 - var(--e,1)) * 16px))}
.c-band.dark::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;background:radial-gradient(560px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.065),transparent 65%);transition:opacity .45s var(--ease)}
@media (hover:hover){.c-band.dark:hover::after{opacity:1}}
.c-sh{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;padding-bottom:16px;box-shadow:0 1px 0 var(--ink)}
.dark .c-sh{box-shadow:0 1px 0 rgba(255,255,255,.85)}
.card .c-sh{box-shadow:0 1px 0 var(--line)}
.c-eb{display:inline-flex;align-items:baseline;gap:10px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g64);white-space:nowrap}
.c-eb i{color:var(--flame);font-weight:500;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.dark .c-eb{color:var(--w64)}
.c-pl{display:inline-flex;align-items:center;flex:0 0 auto;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.04em;white-space:nowrap;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px var(--line2);transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.c-pl:hover{color:#fff;background:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.c-pl:active{scale:.94}
.dark .c-pl{color:#fff;background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.26)}
.dark .c-pl:hover{color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px #fff}
.c-lk{position:relative;cursor:pointer}
.c-lk>.go{position:absolute;right:12px;top:50%;margin-top:-8px}
@media (hover:hover){.c-lk:hover>.go{opacity:1;translate:0 0}}
.c-nm{background:linear-gradient(var(--flame),var(--flame)) 0 100%/0 1px no-repeat;padding-bottom:1px;transition:background-size .5s var(--ease)}
.c-lk:hover .c-nm{background-size:100% 1px}
.dark .c-nm{background-image:linear-gradient(#fff,#fff)}
.js .rv{opacity:0;translate:0 24px;transition:opacity .9s var(--ease),translate 1.1s var(--ease)}
.js .rv.seen{opacity:1;translate:0 0}
.c-hl{box-shadow:0 1px 0 var(--g08)}
.dark .c-hl{box-shadow:0 1px 0 var(--w12)}
.c-hl:last-child{box-shadow:none}

/* 01 needs you */
.c-ngrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:24px}
.c-ncw{position:relative;display:flex;border-radius:20px;transition:translate .6s var(--spring),opacity .35s var(--ease),scale .5s var(--spring)}
.js .c-ncw{animation:rise .8s var(--ease) backwards;animation-delay:calc(var(--j,0) * 60ms + 200ms)}
.c-ncw.going{opacity:0;scale:.94;pointer-events:none}
.c-nsw{position:absolute;inset:0;display:flex;align-items:center;padding:0 24px;border-radius:20px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease),background-color .2s var(--ease),color .2s var(--ease)}
.c-nsw-l{justify-content:flex-start;color:#fff;background:var(--ink)}
.c-nsw-r{justify-content:flex-end;color:var(--ink);background:var(--warm);box-shadow:inset 0 0 0 1px var(--line2)}
.c-ncw.sl .c-nsw-l,.c-ncw.sr .c-nsw-r{opacity:1}
.c-ncw.arm.sl .c-nsw-l{background:var(--flame)}
.c-ncw.arm.sr .c-nsw-r{color:#fff;background:var(--ink);box-shadow:none}
.c-nc{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;padding:20px;border-radius:20px;background:#fff;box-shadow:0 0 0 1px var(--line);touch-action:pan-y;transition:translate .6s var(--spring),box-shadow .5s var(--ease)}
@media (hover:hover){.c-nc:hover{translate:0 -2px;box-shadow:0 0 0 1px var(--line),0 26px 50px -30px rgba(14,14,14,.32)}}
.c-nc.drag{transition:box-shadow .5s var(--ease)}
.c-nt{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--g45)}
.c-nt .cap:first-child{display:inline-flex;align-items:center;gap:8px;color:var(--ink)}
.c-nt .cap:first-child::before{content:"";flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.c-nt .cap:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-who{margin-top:16px;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em;overflow-wrap:anywhere}
.c-who button{font:inherit;letter-spacing:inherit;color:inherit;text-align:left;background:linear-gradient(var(--flame),var(--flame)) 0 100%/0 1px no-repeat;padding-bottom:1px;transition:background-size .5s var(--ease)}
.c-who button:hover{background-size:100% 1px}
.c-ndt{margin-top:4px;font-size:13px;line-height:20px;color:var(--g64)}
.c-acts{display:flex;align-items:center;gap:16px;margin-top:auto;padding-top:20px}
.c-acts .btn{height:36px;padding:0 18px;border-radius:18px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:400}
.c-acts .lnkb{height:36px;display:inline-flex;align-items:center;font-size:12px;letter-spacing:.1em;text-transform:uppercase;background-position:0 calc(50% + 10px)}
.c-clear{display:flex;align-items:center;gap:16px;margin-top:24px;padding:24px;border-radius:20px;box-shadow:0 0 0 1px var(--line);animation:rise .7s var(--ease) backwards}
.c-clear .ok{flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--ink)}
.c-clear .ok svg{width:18px;height:18px;stroke-width:2.2}
.c-clear b{display:block;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em}
.c-clear p{font-size:13px;line-height:20px;color:var(--g64)}
.c-more{margin-top:16px;font-size:13px;color:var(--g64)}

/* 02 numbers */
.c-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));column-gap:32px;row-gap:0;margin-top:32px}
.c-kg{display:flex;align-items:center;height:16px;margin-bottom:16px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g45);white-space:nowrap}
.c-kg.k2{margin-top:48px}
.c-kgl{display:none;position:absolute;left:0;top:-28px;font-size:12px;line-height:16px;letter-spacing:.14em;color:var(--g45);font-style:normal}
.c-kp{position:relative;display:block;width:100%;min-width:0;padding-top:16px;text-align:left;color:inherit}
.c-kp::before,.c-kp::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--g12)}
.c-kp::after{background:var(--ink);transform:scaleX(0);transform-origin:0 50%;transition:transform .7s var(--ease)}
.c-kp:hover::after{transform:scaleX(1)}
.c-kp.hot::before,.c-kp.hot::after{height:2px;background:var(--flame)}
.c-kl{display:flex;justify-content:space-between;align-items:center;height:16px;color:var(--g64);transition:color .3s var(--ease)}
.c-kp:hover .c-kl{color:var(--ink)}
.c-kp .go{rotate:-45deg}
@media (hover:hover){.c-kp:hover .go{opacity:1;translate:0 0}}
.c-kvb{position:relative;display:block;height:72px;margin-top:16px;overflow:hidden}
.c-num{display:flex;align-items:baseline;height:72px;font-size:72px;line-height:72px;font-weight:300;letter-spacing:-.055em;white-space:nowrap;font-variant-numeric:tabular-nums;animation:roll 1.05s var(--ease) backwards;animation-delay:calc(var(--i,0) * 55ms + 350ms)}
@keyframes roll{from{transform:translate3d(0,100%,0)}}
.c-num span{color:var(--g28)}
.c-num.long{font-size:40px;letter-spacing:-.04em}
.c-num.word{font-size:32px;letter-spacing:-.03em;color:var(--g45)}
.c-viz{position:relative;display:block;height:28px;margin-top:12px}
.c-kn{display:block;margin-top:12px;font-size:13px;line-height:16px;color:var(--g64);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vb,.ve{display:flex;align-items:flex-end;gap:8px;height:100%}
.vb.dense{gap:4px}
.vb i,.ve i{display:block;flex:0 0 2px;width:2px;height:100%;border-radius:1px;background:var(--ink);transform-origin:50% 100%}
.vb i.g,.ve i.g{background:var(--g12)}
.vb i.f{background:var(--flame)}
.vb i.s{background:var(--g28)}
.ve i:nth-child(1){height:36%}.ve i:nth-child(2){height:52%}.ve i:nth-child(3){height:68%}.ve i:nth-child(4){height:84%}.ve i:nth-child(5){height:100%}
.vt{background:linear-gradient(var(--g12),var(--g12)) 0 20px/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--g28) 0 1px,transparent 1px 16.6667%) 0 23px/100% 5px no-repeat}
.vt i{position:absolute;display:block;transform-origin:50% 100%}
.vt .t0{top:0;height:20px;width:1px;background:var(--ink)}
.vt .d{top:18px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--ink)}
.vt .d.f{background:var(--flame)}
.vs{display:flex;align-items:flex-end;gap:4px;padding-bottom:4px;height:100%}
.vs i{display:block;height:3px;border-radius:2px;background:rgba(14,14,14,var(--a));transform-origin:0 50%}
.vm::before{content:"";position:absolute;left:0;right:0;bottom:4px;height:1px;background:var(--g12)}
.vm .fill{position:absolute;left:0;bottom:3.5px;height:2px;border-radius:2px;background:var(--ink);transform-origin:0 50%}
.vm .fill.f{background:var(--flame)}
.vm .mk25{position:absolute;bottom:0;width:1px;height:20px;background:var(--g45)}
.vm .vml{position:absolute;bottom:10px;font-size:12px;line-height:16px;color:var(--g45)}
@media (hover:hover){.c-kp:hover .vb i,.c-kp:hover .ve i,.c-kp:hover .vt i{animation:up .7s var(--ease) backwards;animation-delay:calc(var(--j,0) * 26ms + 40ms)}.c-kp:hover .vs i,.c-kp:hover .vm .fill{animation:upx .7s var(--ease) backwards;animation-delay:calc(var(--j,0) * 26ms + 40ms)}}
@keyframes up{from{transform:scaleY(0)}}
@keyframes upx{from{transform:scaleX(0)}}

/* filter chips */
.c-fcs{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.c-fc{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 14px;border-radius:16px;font-size:13px;line-height:1;color:var(--ink);background:var(--warm);transition:background-color .3s var(--ease),color .3s var(--ease),box-shadow .3s var(--ease),scale .45s var(--spring)}
.c-fc b{font-weight:500;color:var(--g45);font-variant-numeric:tabular-nums;transition:color .3s var(--ease)}
.c-fc b.al{color:var(--flame)}
.c-fc:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.c-fc.on{color:#fff;background:var(--ink);box-shadow:none}
.c-fc.on b{color:var(--w64)}
.c-fc.on b.al{color:var(--flame)}
.c-fc:active{scale:.94}
.c-fresh{animation:fresh .45s var(--ease)}
@keyframes fresh{from{opacity:0;translate:0 6px}}

/* 03 attendance */
.c-atb{margin-top:16px}
.c-tr{display:grid;grid-template-columns:88px minmax(160px,1.3fr) minmax(120px,.9fr) minmax(150px,1fr) 56px minmax(220px,2.6fr);align-items:center;gap:16px;min-height:56px;margin:0 -12px;padding:0 44px 0 12px;border-radius:12px;font-size:14px;line-height:20px;text-align:left;width:calc(100% + 24px);background:linear-gradient(var(--g08),var(--g08)) 12px 100%/calc(100% - 24px) 1px no-repeat;transition:background-color .3s var(--ease)}
.c-tr.hd{min-height:40px;font-size:12px;color:var(--g45);border-radius:0;background:linear-gradient(var(--line),var(--line)) 12px 100%/calc(100% - 24px) 1px no-repeat;cursor:default}
.c-tr.rw:last-child{background-image:none}
@media (hover:hover){.c-tr.rw:hover{background-color:var(--warm);background-image:none}}
.c-tr>*{min-width:0}
.c-tr .c-person{display:flex;align-items:center;gap:10px;min-width:0}
.c-tr .c-person span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-tr .c-pl2{display:flex;align-items:center;gap:6px;min-width:0}
.c-tr .c-pl2>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-vf{font-size:12px;color:var(--g45);white-space:nowrap}
.c-day{position:relative;align-self:stretch}
.c-day::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--g08)}
.c-day .g10,.c-day .gn{position:absolute;top:0;bottom:0;width:0}
.c-day .g10{border-left:1px dashed var(--g28)}
.c-day .gn{border-left:1px solid var(--flame)}
.c-day .b{position:absolute;top:50%;height:2px;margin-top:-1px;border-radius:2px;background:var(--g28);transform-origin:0 50%;transition:height .4s var(--spring),margin .4s var(--spring)}
.c-day .b.live{background:var(--ink)}
.js .c-day .b{transform:scaleX(0);transition:transform 1.4s var(--ease),height .4s var(--spring),margin .4s var(--spring);transition-delay:calc(var(--j,0) * 70ms),0s,0s}
.js .seen .c-day .b{transform:none}
.c-tr:hover .c-day .b{height:4px;margin-top:-2px}
.c-day .lt,.c-day .nd{position:absolute;top:50%;z-index:1;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%}
.c-day .lt{background:var(--flame)}
.c-day .nd{background:var(--flame);animation:beat 1.8s ease-in-out infinite}
.c-day .ot{position:absolute;top:50%;font-size:12px;color:var(--g64);white-space:nowrap;transform:translate(-50%,-190%);opacity:0;transition:opacity .4s var(--ease),transform .5s var(--spring)}
.c-tr:hover .c-day .ot{opacity:1;transform:translate(-50%,-150%)}
.c-dh{position:relative;align-self:stretch}
.c-dh i{position:absolute;top:50%;white-space:nowrap;transform:translate(-50%,-50%)}
.c-dh i:first-child{transform:translate(0,-50%)}
.c-dh i:last-child{transform:translate(-100%,-50%)}
.c-dh i.al{color:var(--flame)}
.c-tr>.go{right:12px}

/* 04 flags */
.c-fls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:48px;margin-top:8px}
.c-fl{display:grid;grid-template-columns:16px minmax(0,1fr);gap:12px;width:100%;padding:16px 28px 16px 0;text-align:left}
.c-fl>.go{right:0}
.c-fl .sev{margin-top:6px}
.c-fl b{display:block;font-size:14px;line-height:20px;font-weight:500}
.c-fl p{margin-top:2px;font-size:13px;line-height:20px;color:var(--g64)}
.c-empty{padding:24px 0 8px;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.02em}
.c-empty small{display:block;margin-top:6px;font-size:13px;line-height:20px;letter-spacing:0;color:var(--g64)}
.dark .c-empty small{color:var(--w64)}

/* dark band: leaderboard, pipeline, projects */
.c-g543{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,3fr);column-gap:48px;row-gap:64px}
.c-g444{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:48px;row-gap:64px}
.c-g543>*,.c-g444>*{min-width:0}
.c-lbr{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:end;gap:12px;width:100%;padding:16px 28px 12px 0;text-align:left}
.c-lbr>.go{right:0}
.c-lbr .rk{padding-bottom:4px;font-variant-numeric:tabular-nums}
.c-lbr .whom{min-width:0;padding-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-lbr .ln{display:block;height:1px;margin-top:8px;border-radius:1px;width:var(--w);background:var(--w20);transition:background-color .4s var(--ease),height .4s var(--spring)}
.c-lbr.first .ln{background:#fff}
.c-lbr:hover .ln{background:#fff;height:2px}
.c-pts{font-size:44px;line-height:40px;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums;transition:font-weight .5s var(--ease)}
.c-lbr.first .c-pts{font-size:76px;line-height:64px}
.c-lbr:hover .c-pts{font-weight:500}
.dsoft{color:var(--w45)}
.c-pls{padding:20px 0 24px;box-shadow:0 1px 0 var(--w12)}
.c-pls .v{font-size:56px;line-height:48px;font-weight:300;letter-spacing:-.05em;white-space:nowrap;font-variant-numeric:tabular-nums}
.c-pls .cap{margin-top:12px;color:var(--w64)}
.c-ppr{display:block;width:100%;padding:16px 28px 16px 0;text-align:left}
.c-ppr>.go{right:0;top:18px;margin-top:0}
.c-ppt{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px}
.c-ppt b{font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}
.c-ppb{position:relative;display:block;height:2px;margin-top:12px;border-radius:2px;background:var(--w12)}
.c-ppb i{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:2px;background:rgba(255,255,255,var(--a));transform-origin:0 50%;transition:background-color .4s var(--ease)}
.js .c-ppb i{transform:scaleX(0);transition:transform 1.3s var(--ease),background-color .4s var(--ease);transition-delay:calc(var(--j,0) * 90ms),0s}
.js .seen .c-ppb i{transform:none}
.c-ppr:hover .c-ppb i{background:#fff}
.c-kvr{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;font-size:14px}
.c-pjs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:20px 0 24px;box-shadow:0 1px 0 var(--w12)}
.c-pjs .v{font-size:56px;line-height:48px;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.c-pjs .cap{display:flex;align-items:center;gap:8px;margin-top:12px;color:var(--w64);white-space:nowrap}
.c-pjs .adot{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--flame)}
.c-pjr{display:block;width:100%;padding:16px 28px 16px 0;text-align:left}
.c-pjr>.go{right:0;top:18px;margin-top:0}
.c-pjt{display:flex;align-items:baseline;gap:12px;font-size:14px}
.c-pjt .grow{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-pjb{position:relative;display:block;height:2px;margin-top:12px;border-radius:2px;background:var(--w12)}
.c-pjb i{position:absolute;left:0;top:0;bottom:0;width:var(--p);border-radius:2px;background:var(--w45);transform-origin:0 50%}
.c-pjb i.off{background:var(--flame)}
.js .c-pjb i{transform:scaleX(0);transition:transform 1.3s var(--ease) .2s}
.js .seen .c-pjb i{transform:none}
.c-pst{display:block;margin-top:8px;font-size:13px;line-height:16px}

/* team: people, hiring, voice */
.c-per{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:56px;padding:12px 28px 12px 0;font-size:14px;text-align:left}
.c-per>.go{right:0}
.c-per .c-person{display:flex;align-items:center;gap:10px;min-width:0}
.c-per .c-person span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-tags{flex:0 1 auto;min-width:0;font-size:13px;line-height:18px;color:var(--g45);text-align:right}
.c-tags .k{color:var(--ink)}
.c-tags .al{color:var(--flame)}
.c-hir{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-height:64px;padding:12px 28px 12px 0;font-size:14px;text-align:left}
.c-hir>.go{right:0}
.c-sub{display:block;margin-top:2px;font-size:13px;line-height:18px;color:var(--g45)}
.c-ev{display:flex;align-items:center;gap:12px;flex:0 0 auto;font-variant-numeric:tabular-nums}
.c-ticks{display:flex;gap:4px}
.c-ticks i{display:block;width:2px;height:14px;border-radius:1px;background:var(--g12)}
.c-ticks i.on{background:var(--ink)}
.c-q{display:block;width:100%;padding:24px 0}
.c-q blockquote{font-size:22px;line-height:28px;font-weight:300;letter-spacing:-.02em;overflow-wrap:anywhere}
.c-q .c-sub{margin-top:12px}

/* clients */
.c-share{display:flex;gap:4px;height:3px;margin:24px 0 16px}
.c-share i{display:block;border-radius:2px;transform-origin:0 50%;transition:background-color .4s var(--ease),transform .5s var(--spring)}
.c-share i:hover{transform:scaleY(2)}
.c-ct{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.2fr) .7fr .8fr minmax(0,1.1fr);gap:16px;align-items:center;width:calc(100% + 24px);min-height:56px;margin:0 -12px;padding:0 44px 0 12px;border-radius:12px;font-size:14px;line-height:20px;text-align:left;background:linear-gradient(var(--g08),var(--g08)) 12px 100%/calc(100% - 24px) 1px no-repeat;transition:background-color .3s var(--ease),opacity .35s var(--ease)}
.c-ct>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-ct.hd{min-height:40px;font-size:12px;color:var(--g45);border-radius:0;background:linear-gradient(var(--line),var(--line)) 12px 100%/calc(100% - 24px) 1px no-repeat;cursor:default}
.c-ct .rvn{font-size:24px;line-height:28px;font-weight:300;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
@media (hover:hover){.c-ct.rw:hover{background-color:var(--warm);background-image:none}}
.c-ct.tot{margin-top:8px;min-height:64px;color:#fff;background:var(--ink);border-radius:14px}
.c-ct.tot .rvn{font-weight:500}
.c-ct>.go{right:12px;white-space:normal}
.c-dots{display:inline-flex;align-items:center;gap:6px}
.c-dots i{width:8px;height:8px;border-radius:50%;background:var(--g12)}
.c-dots i.on{background:var(--ink)}

/* counter rail: where you are on the page */
.c-rail{position:fixed;z-index:45;right:6px;top:50%;width:24px;translate:0 -50%}
.c-rtr{position:absolute;left:11px;top:16px;bottom:16px;width:2px;border-radius:1px;background:var(--g12);transition:background-color .4s var(--ease)}
.c-rtr i{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:inherit;background:var(--flame);transform:scaleY(0);transform-origin:50% 0}
.c-ri{position:relative;display:block;width:24px;height:32px}
.c-ri::before{content:"";position:absolute;left:8px;top:12px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px var(--g28);transition:background-color .35s var(--ease),box-shadow .35s var(--ease),scale .5s var(--spring)}
.c-ri.past::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame)}
.c-ri.on::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame),0 0 0 3px #fff;scale:1.3}
.c-rl{position:absolute;right:32px;top:50%;display:flex;align-items:center;height:28px;padding:0 12px;border-radius:14px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;color:var(--g64);background:#fff;box-shadow:0 0 0 1px var(--line),0 12px 28px -16px rgba(14,14,14,.4);opacity:0;translate:10px -50%;pointer-events:none;transition:opacity .25s var(--ease),translate .5s var(--spring),color .25s var(--ease);transition-delay:calc(var(--k) * 22ms)}
.c-rail:hover .c-rl{opacity:1;translate:0 -50%;pointer-events:auto}
.c-ri.on .c-rl{color:var(--ink)}
.c-ri:hover .c-rl{color:var(--flame)}
.c-rail.dk .c-rtr{background:var(--w20)}
.c-rail.dk .c-ri::before{background:var(--dark);box-shadow:inset 0 0 0 2px var(--w45)}
.c-rail.dk .c-ri.past::before,.c-rail.dk .c-ri.on::before{background:var(--flame);box-shadow:inset 0 0 0 2px var(--flame)}

/* widths of the canvas, not the window, decide the grids */
@container main (max-width:1179px){
  .c-pls .v,.c-pjs .v{font-size:46px;line-height:40px}
  .c-num{font-size:60px}
  .c-num.long{font-size:34px}
  .c-id{display:none}
  .c-tr{grid-template-columns:minmax(150px,1.3fr) minmax(110px,.9fr) minmax(130px,1fr) 56px minmax(200px,2.4fr)}
  .c-g543{column-gap:40px}
  .kpi b{font-size:34px;line-height:40px}
}
@container main (max-width:979px){
  .c-num{font-size:48px;letter-spacing:-.05em}
  .c-num.long{font-size:26px}
  .c-num.word{font-size:24px}
  .c-kpis{column-gap:24px}
  .c-ngrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .c-place,.c-tr .c-place{display:none}
  .c-tr{grid-template-columns:minmax(130px,1.4fr) minmax(100px,1fr) 56px minmax(160px,2.4fr)}
  .c-fls{grid-template-columns:minmax(0,1fr)}
  .c-g543,.c-g444{grid-template-columns:repeat(2,minmax(0,1fr))}
  .c-g543>:first-child{grid-column:1 / -1}
  .c-g444>:last-child{grid-column:1 / -1}
  .c-top{flex-direction:column;align-items:stretch;gap:24px}
  .c-tr2{flex:none;width:100%;max-width:440px;margin-top:0}
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .conns{grid-template-columns:minmax(0,1fr)}
  .c-ct{grid-template-columns:minmax(0,2fr) .7fr .8fr minmax(0,1.2fr)}
  .c-own{display:none}
}
@container main (max-width:759px){
  .c-kpis{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:40px}
  .c-kg{display:none}
  .c-kgl{display:block}
  .c-kp{margin-top:28px}
  .c-g543,.c-g444{grid-template-columns:minmax(0,1fr)}
  .c-g543>:first-child,.c-g444>:last-child{grid-column:auto}
  .grid2{grid-template-columns:minmax(0,1fr)}
  .hb{grid-template-columns:minmax(0,1fr)}
  .hb-nav{position:static;flex-direction:row;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
  .hb-i{white-space:nowrap}
}
@container main (max-width:559px){
  .c-ngrid{grid-template-columns:minmax(0,1fr)}
  .c-band{margin-left:-16px;margin-right:-16px;padding:48px 16px;border-radius:24px}
  .c-pls .v,.c-pjs .v{font-size:40px;line-height:36px}
  .c-ct{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
  .c-ct .c-open,.c-ct .c-brain{display:none}
  .c-tr{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 48px;padding-right:12px}
  .c-tr .c-dayc{display:none}
  .c-tr>.go{display:none}
}

@media (max-width:900px){
  :root{--g:16px}
  .side,.c-rail,.tip{display:none}
  .main{padding:88px 16px calc(120px + env(safe-area-inset-bottom,0px))}
  .pbar{position:fixed;z-index:56;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:8px;height:56px;padding:0 8px 0 20px;border-radius:28px}
  .tabbar{display:flex;position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;align-items:flex-end;justify-content:space-between;gap:10px;pointer-events:none}
  .tbg{pointer-events:auto;position:relative;display:flex;align-items:center;height:62px;padding:5px;border-radius:31px;flex:1 1 0%;min-width:0;transition:flex .6s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
  .ptab{position:relative;z-index:1;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:52px;border-radius:26px;font-size:10px;font-weight:500;line-height:12px;color:var(--g64);overflow:hidden;white-space:nowrap;transition:color .3s var(--ease),flex .6s var(--spring),opacity .35s var(--ease)}
  .ptab svg{width:22px;height:22px;flex:0 0 auto}
  .ptab.on{color:#fff}
  .ptab .bd{left:calc(50% + 2px);top:5px;transform:none;z-index:2}
  .ptab .tdot{position:absolute;left:calc(50% + 8px);top:8px;width:8px;height:8px;border-radius:50%;background:var(--flame)}
  .lens{position:absolute;z-index:0;top:5px;bottom:5px;left:0;width:0;border-radius:26px;background:var(--ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.16);transition:transform .6s var(--spring),width .6s var(--spring)}
  .tb-ask{pointer-events:auto;flex:0 0 62px;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;color:var(--ink);transition:scale .45s var(--spring),background-color .5s var(--ease),box-shadow .5s var(--ease)}
  .tb-ask svg{width:22px;height:22px}
  .tb-ask:active{scale:.9}
  .tabbar.min .tbg{flex:0 0 72px}
  .tabbar.min .ptab:not(.on){flex:0 0 0;opacity:0}
  .tabbar.min .lens{transform:translate3d(5px,0,0)!important;width:62px!important}
  .ph{margin-bottom:32px}
  .ph.row{flex-direction:column;align-items:flex-start}
  .ph h1,.c-top h1{font-size:36px;line-height:40px}
  .card{padding:20px;border-radius:20px}
  .card.pad0{padding:0}
  .card.due::before,.post.pinned::before,.card.setup::before{left:20px;right:20px}
  .board{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:84%;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px 8px;scroll-padding:0 16px}
  .col{scroll-snap-align:start}
  .wg{grid-template-columns:52px repeat(6,minmax(62px,1fr));min-width:430px}
  .wg-p{justify-content:center;padding:10px}
  .wg-p span{display:none}
  .wg-h{flex-direction:column;gap:0;padding:12px 8px 8px}
  .wg-c{padding:8px}
  .hb-r{padding:24px 20px}
  .hb-t{font-size:26px;line-height:30px}
  .lad-r{grid-template-columns:minmax(0,1fr) auto;gap:6px 12px}
  .lad-r .mut{grid-column:1;grid-row:2}
  .lad-r .pill{grid-column:2;grid-row:1 / span 2}
  .kp-r{grid-template-columns:minmax(0,1fr);gap:10px}
  .sct-r{grid-template-columns:40px repeat(4,minmax(0,1fr));gap:6px;font-size:12.5px}
  .eod{grid-template-columns:68px minmax(0,1fr)}
  .podium{gap:8px}
  .pod-s{padding:16px 8px}
  .pod-s .pts{font-size:32px;line-height:32px}
  .pod-s.p0 .pts{font-size:44px;line-height:44px}
  .gs{left:0;right:0;top:auto;bottom:0;width:auto!important;max-height:calc(100% - 48px);border-radius:28px 28px 0 0;transform:translate3d(0,calc(100% + 24px),0)}
  .gs.on{transform:none}
  .gs.drag{transition:none}
  .grab{display:block;flex:0 0 auto;width:100%;height:28px;cursor:grab;touch-action:none}
  .grab::before{content:"";display:block;width:40px;height:5px;margin:10px auto 0;border-radius:3px;background:var(--g28)}
  .gs-h{padding:4px 16px 12px 20px}
  .gs-h h2{font-size:24px;line-height:28px}
  .gs-in{padding:4px 20px calc(28px + env(safe-area-inset-bottom,0px))}
  .c-kpis{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:16px;margin:24px -16px 0;padding:28px 16px 4px;scrollbar-width:none;scroll-padding:0 16px}
  .c-kpis::-webkit-scrollbar{display:none}
  .c-kpis .c-kg{display:none}
  .c-kp{flex:0 0 172px;margin-top:0;scroll-snap-align:start}
  .c-kgl{display:block}
  .c-num{font-size:52px;line-height:72px}
  .c-num.long{font-size:30px}
  .c-sec{padding-top:48px}
  .c-band{margin-top:48px}
}
@media (max-width:420px){
  .ppl{grid-template-columns:1fr 1fr}
  .who{grid-template-columns:1fr 1fr}
  .who-i .av{width:32px!important;height:32px!important}
}
@media (hover:none){
  .c-tr{padding-right:12px}
  .c-tr>.go,.c-lk>.go{display:none}
  .c-fl,.c-lbr,.c-ppr,.c-pjr,.c-per,.c-hir{padding-right:0}
}
/* voice: the mark listens, the island shows the wave (used when the OS has voice) */
.s-listen .l-dot{animation:listen .5s var(--io) infinite}
@keyframes listen{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
.is-wave{display:flex;align-items:center;gap:3px;height:26px;flex:0 0 auto}
.is-wave i{display:block;width:3px;height:30%;border-radius:2px;background:var(--flame);animation:wv .9s ease-in-out infinite;animation-delay:calc(var(--k) * -.17s)}
.is-wave.calm i{background:#fff;animation-duration:1.9s;opacity:.8}
@keyframes wv{0%,100%{height:30%}50%{height:100%}}
.is-mic{flex:0 0 8px;width:8px;height:8px;margin-right:6px;border-radius:50%;background:var(--flame)}
.cbm{flex:0 0 36px;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.1);transition:background-color .3s var(--ease),scale .45s var(--spring)}
.cbm:hover{background:var(--flame)}
.cbm:active{scale:.92}
.cbm svg{width:18px;height:18px}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}


````

### B2. live-mark.html

The m360 logo split into body and dot for the live character. Render it inside `<span class="lm">` wherever the mark appears (sidebar top, phone capsule, menu, gates), then call `MK.scan()`.

````html
<span class="l-st"><span class="l-react"><svg class="lmk" viewBox="0 0 1448 422" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><g class="l-pose"><g class="l-breathe"><path d="M1112 416.6C1103.1 414.6 1099.9 413.2 1092.7 408.7C1072.8 396.1 1058.1 373.5 1054 349.1C1051.7 335.5 1047.5 335.2 1038.9 347.9C1031.1 359.3 1008.6 381.2 996.5 389.3C981.6 399.1 967.8 405.3 951.7 409.5C939.9 412.5 936.3 413 926.5 413C916.8 413 913.2 412.5 901.8 409.6C886 405.5 866.8 398.2 858.5 393.2C845.7 385.5 837.1 375.9 833.6 365.3C830.6 356.3 825.9 317.8 825.3 297.5C825 285.8 824.3 278.2 823.7 277.8C821.5 276.4 817 280.2 810.6 289C798.3 305.8 775.8 327.5 752.9 344.5C719.8 369.2 672.1 391.4 632.5 400.5C601.9 407.5 593.9 408.5 563.5 408.5C533.1 408.5 532.1 408.2 522.5 398.6C503.9 379.8 502.6 359.1 519.2 347.7C526.3 342.8 532.7 341.6 547 342.3C555.3 342.7 561.8 343.8 570.5 346.1C587.9 350.8 595.2 350.6 609 345.2C627 338.2 652.1 325.7 673 313.2C686.9 305 717.4 284.2 729.5 274.8C749.5 259.2 768.1 239.5 773 228.8C775.7 222.9 775.5 220.3 772.1 216.9C769.5 214.3 768.5 214 763.2 214C755.9 214 745.7 215.9 730.8 220C720.3 222.9 712.1 225.3 681.5 234.4C663.8 239.7 643.8 243.9 633 244.6C617.4 245.7 605.1 241.4 596.7 232C590.5 225.1 588.6 219.2 589.2 208.1C589.8 194.9 590.6 193.7 622.9 158.3C642.4 136.9 657.9 118.4 658.6 115.4C659 114 658.7 112.3 657.9 111.4C656.4 109.6 657.8 109.6 628.6 111.9C615 113 602.9 111.9 596.3 109C590.3 106.4 583.4 99.6 581.4 94.4C577.9 85.3 580.8 73.6 588.8 64.8C604.7 47 683.4 12 716.5 7.9C727.2 6.5 742.7 7.3 749 9.5C759.6 13.1 769.9 24.5 772.1 34.8C772.8 38.2 773 44 772.7 49C771.5 66.6 758.9 94.3 739.2 122.5C728.5 137.7 727 140.2 727 142.6C727 146.6 730.4 147.7 744.5 148.4C786.1 150.4 816.9 165 830.5 189.4C835.6 198.5 837 203.3 838 214.9C839 226.2 840.5 229.4 843.8 227.4C845.5 226.4 847.4 223.4 863 197.8C872.8 181.6 892.2 152.8 904.5 136C932.4 97.8 953 75.5 973.8 60.8C995.1 45.8 1016.4 49.5 1027.2 70.1C1029.3 74 1029.5 75.9 1029.5 87.5C1029.5 98.3 1029.2 101.2 1027.6 104.5C1026.4 106.9 1019.3 114.6 1009.6 123.9C951.8 179.4 922.6 214 907.9 244.4C903.4 253.6 903.2 255 906 257.5C908 259.3 908.3 259.3 919.8 254.5C956.8 239.3 979.1 233.8 1004 233.8C1016.3 233.8 1019.6 234.1 1025.5 236C1035 239 1039 241.2 1045 246.5C1052.3 252.9 1054.6 254.3 1057.4 253.6C1060 253 1060 253 1066 234C1083.6 178.5 1112.8 124.5 1149.3 80C1159.9 67.1 1183.2 44.4 1194.7 35.8C1214.3 21.1 1234.6 10.9 1252 6.9C1256.7 5.8 1266.2 4.7 1273.5 4.4C1290.6 3.6 1303 6 1316.2 12.6C1342.3 25.4 1355.1 41.7 1360.6 69C1363 80.4 1363.2 83 1362.7 98.5C1362.1 118.8 1359 137.6 1352.8 158.5C1326.9 245.8 1258.4 348.1 1196.5 391.9C1180.7 403.1 1163.9 411.6 1150.5 415.2C1141.5 417.7 1119.9 418.5 1112 416.6ZM397.9 413.6C392.9 411.9 389.5 409.2 382.8 402.3C376 395.1 369.9 385.9 366.8 378.1C364.9 373.3 364.6 370.5 364.6 358.5C364.5 333.6 368.4 322.5 403.2 250.8C410.3 236.1 413 229.5 412.5 228.1C411.1 223.7 407.1 225.7 390.2 239.2C350 271.3 281.1 332.2 236.5 375.1C226.6 384.7 219.7 390.4 216.5 391.9C199.6 399.9 179.6 391.1 174 373.3C167.8 353.4 172.4 316 187.5 264.7C191.2 251.8 191.7 248.1 189.8 246.2C187.8 244.2 186.2 244.8 181.4 249.2C174.3 255.8 160.3 273.6 133.5 310.5C97 360.5 91.7 367.3 79 380.1C61.3 397.9 52.9 402.4 37.5 402.5C26.6 402.5 21.7 400.6 13.9 393.3C6.1 386 4.5 382.3 4.5 371.5L4.5 362.5L16.9 337C43.2 282.5 91.8 187.6 101.5 171.5C118.9 142.9 125.6 133.8 132.2 130.4C136.4 128.1 151.7 127.3 158 129C163.7 130.5 171.3 137.9 173 143.5C173.6 145.7 174.4 152.7 174.7 159C175 165.3 175.7 171.1 176.2 171.8C178.2 174.2 181.1 172.9 190.7 165.2C213.5 146.9 230.6 136.1 241.8 133.1C251.2 130.6 253.1 130.5 259.8 132.5C265.5 134.2 270.8 138.3 274 143.5C278.8 151.3 278.6 169 273.6 192.1C269.4 211.2 263 244.9 263 248C263 251.3 265.3 254 268 254C269 254 272.3 252.1 275.3 249.8C278.4 247.4 285.3 242.1 290.7 238C296.1 233.9 309.3 223.7 320 215.4C330.7 207.2 346.7 195 355.5 188.4C393.8 159.6 448.2 123.1 459.3 118.7C465.5 116.3 481 115.8 487.7 117.8C498.6 121.1 508.5 131.5 512.4 144C515.6 153.9 515.7 161.8 513 172.6C510.8 181.2 507.1 188.8 489.8 220.5C447.6 297.4 432.4 339.3 429.5 386C429.1 391.8 428.4 398.2 427.9 400.3C426.7 404.9 420.7 411.8 416.3 413.7C412.3 415.3 402.7 415.3 397.9 413.6ZM1132.1 359.8C1140.7 356.9 1157.6 342.9 1171 327.5C1203.7 290 1238.5 234.2 1267.2 173.6C1289.4 126.5 1296.9 101.4 1294 83.8C1291.9 70.2 1286.8 68.9 1271.3 77.8C1227.2 103.1 1161.1 187.3 1131.2 256.5C1120.1 282.2 1114.1 305.4 1113.3 325.6C1112.9 336.1 1113.1 339.8 1114.5 344.6C1116.9 352.9 1120 358.1 1123.5 359.6C1127.2 361.3 1127.9 361.3 1132.1 359.8ZM933.3 346C946.5 341.8 958.2 334.5 970.7 322.5C981.6 312.2 984.6 307.9 982.9 304.8C981.4 302 976.7 302.6 967.6 306.6C947.9 315.2 931.9 324.1 921 332.5C912.7 338.9 911.2 344.9 917.3 347.5C921.8 349.5 922.8 349.4 933.3 346Z"/><g class="l-eye"><path class="l-dot" d="M1378.5 414.8C1367.5 410.7 1356.6 397.7 1352.6 384.1C1347.9 367.9 1354 347.7 1367.9 334C1376 326 1384.2 321.5 1393.5 320C1416 316.3 1433.5 327.1 1441.6 349.6C1449.7 371.8 1435.9 399 1410.2 411.7C1403.4 415.1 1402.2 415.4 1392.2 415.7C1385.9 415.8 1380.3 415.5 1378.5 414.8Z"/></g></g></g></svg></span></span>
````

### B3. chrome.js

The interaction layer: the live mark, the island (toasts, confirmations with UNDO, live news, the Ask bar, voice states), glide and flame ring, sidebar motion, the tab bar lens, reveal and count up, the scroll frame (dark band, glass over dark, tab bar fold, counter rail), the pointer spotlight, swipe on touch, keyboard shortcuts. The ADAPT block reads the artifact's data helpers; rewrite it against this OS's data and keep the shapes it returns.

With voice: call `ISL.setVoice(startListening)` once, then drive the island from the voice flow with `ISL.voice('listening')`, `ISL.voice('heard', text)`, `ISL.voice('thinking')` and `ISL.voice('answer', text, caption, onShow)`.

````js
/* chrome.js, the interaction layer of the m360 v7 design.
   Framework free except LiveMark and useOpenReq (marked REACT). Needs, from the app:
   CUR.ctx (live data), CUR.go(route), CUR.page, CUR.hash, CUR.nav (pages as [key,label,icon,badge,group]).
   Pieces: MK the live mark, glide/flash/showAt, ISL the island (toast, confirm with UNDO, notify, Ask bar, voice),
   SB sidebar motion, TB tab bar lens, RV reveal and count up, FX scroll frame, CMDP Command rail and live line, bindSwipe. */
/* ---------------- chrome: live mark, island, ask bar, sidebar motion ---------------- */
var RM = (function(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(err){ return false; } })();
function $q(s,r){ return (r||document).querySelector(s); }
function $qa(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function clampN(v,a,b){ return Math.max(a,Math.min(b,v)); }
function pnow(){ return (window.performance&&performance.now)?performance.now():Date.now(); }
function phone(){ return innerWidth<=900; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function ini(n){ var w=String(n||'').trim().split(/\s+/).filter(Boolean); if(!w.length) return ''; return (w[0][0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase(); }
function names(arr){ var a=arr.filter(Boolean); if(a.length<=2) return a.join(' and '); return a.slice(0,-1).join(', ')+' and '+a[a.length-1]; }
function plural(n,one,many){ return n+' '+(n===1?one:(many||one+'s')); }
var CUR={ctx:null, go:null, page:'', hash:''};
var PEND={att:null};
var BOOT=Date.now();
document.documentElement.classList.add('js');
try{ if(localStorage.getItem('m360.sb')==='x') document.documentElement.classList.add('sbx'); }catch(err){}

/* raw icons for the parts drawn outside React */
function IcoS(d){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; }
var IR={
  today:IcoS('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  feed:IcoS('<path d="M4 5.5h16v10H9l-5 3.5z"/>'),
  tasks:IcoS('<rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="16.5" y="4" width="4" height="7" rx="1.6"/>'),
  projects:IcoS('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  pitches:IcoS('<path d="M3.5 17.5l5.5-6 4 4 7.5-9"/><path d="M15.5 6.5h5v5"/>'),
  week:IcoS('<rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  handbook:IcoS('<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>'),
  clients:IcoS('<rect x="3.5" y="7" width="17" height="12.5" rx="2.4"/><path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7M3.5 12.5h17"/>'),
  people:IcoS('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.5" r="2.4"/><path d="M16 14.2a4.8 4.8 0 0 1 5 5.3"/>'),
  leave:IcoS('<path d="M4 19.5h16M6.5 19.5c0-5 2.5-9.5 5.5-12.5 3 3 5.5 7.5 5.5 12.5"/><path d="M12 7v12.5"/>'),
  desk:IcoS('<path d="M3.5 9.5h17v10h-17z"/><path d="M7.5 9.5V6.5a4.5 4.5 0 0 1 9 0v3"/>'),
  command:IcoS('<rect x="3.5" y="4" width="17" height="12" rx="2.2"/><path d="M8 20h8M12 16v4M7 12l2.5-3 2.5 2 3-4"/>'),
  scores:IcoS('<path d="M7 20.5h10M12 16.5v4"/><path d="M6.5 3.5h11v5.5a5.5 5.5 0 0 1-11 0z"/><path d="M6.5 6H3.5a2.5 2.5 0 0 0 2.5 4M17.5 6h3a2.5 2.5 0 0 1-2.5 4"/>'),
  hiring:IcoS('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M17 4.5l1 1 2-2"/>'),
  voice:IcoS('<path d="M4 6.5h16v9H10l-4 3.5v-3.5H4z"/><path d="M8 11h8"/>'),
  search:IcoS('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>')
};

/* a tiny event bus between React and the parts outside it */
var EVB={l:{}, on:function(n,f){ (this.l[n]=this.l[n]||[]).push(f); }, off:function(n,f){ this.l[n]=(this.l[n]||[]).filter(function(x){ return x!==f; }); }, emit:function(n,d){ (this.l[n]||[]).slice().forEach(function(f){ try{ f(d); }catch(err){} }); }};

/* the m360 mark as a live character: breathes, blinks, watches, feels, and looks at what it is talking about */
var MK=(function(){
  var roots=[], stateCls={}, bound=false;
  var v={lean:0,sq:0,ex:0,ey:0}, vel={lean:0,sq:0,ex:0,ey:0}, tg={lean:0,sq:0,ex:0,ey:0};
  var running=false, last=0, lastIn=pnow(), lastMove=pnow(), sleeping=false, concern=false, baseLean=0, holdT=0, hold=false, lookT=0, moodN=-1;
  function scan(){
    roots=$qa('.lm').filter(function(el){ return $q('.l-react',el); }).map(function(el){ return {el:el, st:$q('.l-st',el), react:$q('.l-react',el), pose:$q('.l-pose',el), eye:$q('.l-eye',el), dot:$q('.l-dot',el)}; });
    roots.forEach(function(o){ Object.keys(stateCls).forEach(function(c){ if(o.st) o.st.classList.toggle(c,!!stateCls[c]); });
      var host=o.el.parentNode; if(host && !host.__mk){ host.__mk=1; host.addEventListener('pointerenter',function(){ if(!sleeping) react('wig',780); }); } });
    apply();
  }
  function vis(){ for(var i=0;i<roots.length;i++){ if(roots[i].el.isConnected && roots[i].el.getClientRects().length) return roots[i]; } return null; }
  function apply(){ var p='rotate('+v.lean.toFixed(3)+'deg) scale('+(1-v.sq/220).toFixed(4)+','+(1+v.sq/100).toFixed(4)+')'; var e='translate('+v.ex.toFixed(2)+'px,'+v.ey.toFixed(2)+'px)';
    roots.forEach(function(o){ if(o.pose) o.pose.style.transform=p; if(o.eye) o.eye.style.transform=e; }); }
  function step(t){ var dt=Math.min(.034,Math.max(.001,(t-last)/1000)); last=t; var moving=false;
    for(var k in v){ var a=170*(tg[k]-v[k])-17*vel[k]; vel[k]+=a*dt; v[k]+=vel[k]*dt; if(Math.abs(vel[k])>.02||Math.abs(tg[k]-v[k])>.02) moving=true; }
    apply(); if(moving) requestAnimationFrame(step); else running=false; }
  function kick(){ if(!running&&!RM){ running=true; last=pnow(); requestAnimationFrame(step); } }
  function set(o){ for(var k in o) tg[k]=o[k]; kick(); }
  function react(name,ms){ if(RM) return; roots.forEach(function(o){ var r=o.react; if(!r) return; r.className='l-react'; r.getBoundingClientRect(); r.className='l-react r-'+name; clearTimeout(o.rt); o.rt=setTimeout(function(){ r.className='l-react'; },ms||900); }); }
  function state(c,on){ stateCls[c]=on; roots.forEach(function(o){ if(o.st) o.st.classList.toggle(c,on); }); }
  function blinkOnce(){ roots.forEach(function(o){ if(!o.dot) return; o.dot.classList.remove('blink'); o.dot.getBoundingClientRect(); o.dot.classList.add('blink'); }); setTimeout(function(){ roots.forEach(function(o){ if(o.dot) o.dot.classList.remove('blink'); }); },230); }
  function blink(){ if(!sleeping){ blinkOnce(); if(Math.random()<.25) setTimeout(blinkOnce,330); } setTimeout(blink,2400+Math.random()*3600); }
  function sleepNow(){ if(sleeping) return; sleeping=true; state('s-sleep',true); set({ex:-10,ey:24,lean:-4,sq:0}); }
  function wake(){ lastIn=pnow(); if(sleeping){ sleeping=false; state('s-sleep',false); react('pop',520); set({ex:0,ey:0,lean:baseLean}); } }
  function glance(){ if(!sleeping&&!concern&&!hold&&pnow()-lastMove>3500){ var a=Math.random()*Math.PI*2, f=.45+Math.random()*.55; set({ex:Math.cos(a)*50*f,ey:Math.sin(a)*32*f}); setTimeout(function(){ if(pnow()-lastMove>3500&&!hold) set({ex:0,ey:0}); },650+Math.random()*700); } setTimeout(glance,2300+Math.random()*2400); }
  function bind(){
    if(bound) return; bound=true;
    addEventListener('pointermove',function(e){ lastMove=pnow(); wake(); if(hold) return; var o=vis(); if(!o) return; var r=o.el.getBoundingClientRect(); if(!r.width) return;
      var dx=e.clientX-(r.left+r.width*.6), dy=e.clientY-(r.top+r.height*.5), d=Math.hypot(dx,dy)||1, f=Math.min(1,d/240);
      baseLean=clampN(dx/900,-1,1)*2.6; set({ex:dx/d*f*54, ey:dy/d*f*36, lean:concern?baseLean-3.5:baseLean}); },{passive:true});
    ['keydown','pointerdown','touchstart','wheel'].forEach(function(n){ addEventListener(n,wake,{passive:true}); });
    setInterval(function(){ if(!sleeping&&pnow()-lastIn>45000) sleepNow(); },1000);
    var sy=scrollY, st=pnow(), sT=0;
    addEventListener('scroll',function(){ var t=pnow(), y=scrollY, dt=Math.max(8,t-st), sp=(y-sy)/dt; sy=y; st=t; wake();
      set({sq:Math.min(14,Math.abs(sp)*6), lean:clampN(sp*3.2,-6,6)}); clearTimeout(sT); sT=setTimeout(function(){ set({sq:0,lean:baseLean}); },110); },{passive:true});
    document.addEventListener('pointerover',function(e){ var h=e.target.closest&&e.target.closest('.hotz');
      if(h&&!concern){ concern=true; state('s-concern',true); set({lean:baseLean-3.5}); }
      else if(!h&&concern){ concern=false; state('s-concern',false); set({lean:baseLean}); } });
    setTimeout(blink,1800); setTimeout(glance,3000);
    var hr=new Date().getHours(); setTimeout(function(){ if(hr<5) sleepNow(); else if(hr<12) react('stretch',1600); else react('nod',680); },900);
  }
  return {
    scan:function(){ scan(); bind(); },
    happy:function(){ react('hop',820); state('s-happy',true); clearTimeout(holdT); holdT=setTimeout(function(){ state('s-happy',false); },1100); },
    nod:function(){ react('nod',680); }, pop:function(){ react('pop',520); }, spin:function(){ react('spin',1080); }, stretch:function(){ react('stretch',1600); },
    ahem:function(){ if(!sleeping) react('ahem',780); },
    think:function(on){ state('s-think',on); },
    lookAt:function(el,ms){ if(!el||RM) return; var o=vis(); if(!o) return; var r=o.el.getBoundingClientRect(), t=el.getBoundingClientRect(), dx=t.left+t.width/2-(r.left+r.width*.6), dy=t.top+t.height/2-(r.top+r.height/2), d=Math.hypot(dx,dy)||1; hold=true; set({ex:dx/d*56,ey:dy/d*38}); clearTimeout(lookT); lookT=setTimeout(function(){ hold=false; },ms||1800); },
    mood:function(n){ if(n===moodN) return; moodN=n; state('s-alert',n>=4); state('s-calm',n===0); },
    listen:function(on){ state('s-listen',on); set(on?{lean:3,ex:30,ey:-26}:{lean:baseLean,ex:0,ey:0}); }
  };
})();
var LIVE=window.__M360_LIVE__||'';
/* REACT: the live mark as a component. Any framework works: render live-mark.html inside <span class="lm">, call MK.scan() after it mounts. */
var LiveMark=React.memo(function LiveMark(){ useEffect(function(){ MK.scan(); },[]); return html`<span class="lm" aria-hidden="true" dangerouslySetInnerHTML=${{__html:LIVE}}></span>`; });

/* smooth scroll, flash and the open requests that let Ask land on a row */
function glide(y,done){
  var from=scrollY, to=clampN(y,0,Math.max(0,document.documentElement.scrollHeight-innerHeight)), d=clampN(Math.abs(to-from)*.45,520,1100), t0=0;
  if(RM||Math.abs(to-from)<2){ scrollTo(0,to); if(done) done(); return; }
  var ez=function(t){ return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; };
  var f=function(ts){ if(!t0) t0=ts; var p=Math.min(1,(ts-t0)/d); scrollTo(0,from+(to-from)*ez(p)); if(p<1) requestAnimationFrame(f); else if(done) done(); };
  requestAnimationFrame(f);
}
function glideTo(el,done){ var off=phone()?96:32; glide(el.getBoundingClientRect().top+scrollY-off,done); }
function flash(els){ (els||[]).forEach(function(el){ if(!el) return; el.classList.remove('flash','flash-out'); el.getBoundingClientRect(); el.classList.add('flash'); setTimeout(function(){ el.classList.add('flash-out'); },1600); setTimeout(function(){ el.classList.remove('flash','flash-out'); },2000); }); }
function showAt(page, sel, opts){
  opts=opts||{}; var same=CUR.page===page && !CUR.hash.split('/')[1];
  if(opts.att!=null){ PEND.att=opts.att; EVB.emit('att',opts.att); }
  if(!same && CUR.go) CUR.go(page);
  var tries=0;
  var look=function(){ var els=$qa(sel); if(!els.length){ if(tries++<12) return setTimeout(look,90); return; }
    glideTo(els[0],function(){ flash(els.slice(0,6)); MK.lookAt(els[0],2200); }); };
  setTimeout(look, same?80:260);
}
function openReq(page,id){ window.__m360open={page:page,id:id}; if(CUR.page===page && !CUR.hash.split('/')[1]) window.dispatchEvent(new Event('m360open')); else if(CUR.go) CUR.go(page); }
/* REACT: lets Ask open a record's drawer on its page. Port to the router you use. */
function useOpenReq(page,fn){
  var r=useRef(fn); r.current=fn;
  useEffect(function(){ var chk=function(){ var q=window.__m360open; if(q && q.page===page){ window.__m360open=null; setTimeout(function(){ r.current(q.id); },60); } }; chk(); window.addEventListener('m360open',chk); return function(){ window.removeEventListener('m360open',chk); }; },[]);
}

/* the island: one black object for asking, answers, confirmations and live news */
var ISL=(function(){
  var isl=null, isIn=null, its=[], mode='', queue=[], onTap=null, acts={};
  function el(){ if(isl) return; isl=document.createElement('div'); isl.id='island'; isl.setAttribute('role','status'); isl.setAttribute('aria-live','polite'); isl.innerHTML='<div class="is-in"></div>'; document.body.appendChild(isl); isIn=$q('.is-in',isl);
    isl.addEventListener('click',function(e){ if(mode==='cmd') return; var b=e.target.closest('[data-act]'); if(b){ e.stopPropagation(); var f=acts[b.getAttribute('data-act')]; close(); if(f) f(); return; } var t=onTap; close(); if(t) t(); }); }
  function cx(){ if(phone()) return innerWidth/2; var s=$q('#side'), r=s?s.getBoundingClientRect():null; return ((r?r.right:0)+12+innerWidth-12)/2; }
  function topY(){ return phone()?8:12; }
  function put(l,t,w,h,rad){ isl.style.left=l+'px'; isl.style.top=t+'px'; isl.style.width=w+'px'; isl.style.height=h+'px'; isl.style.borderRadius=rad+'px'; }
  function shape(w,h,r){ put(cx()-w/2,topY(),w,h,r); }
  function pill(){ shape(120,36,18); }
  function clr(){ its.forEach(clearTimeout); its=[]; }
  function later(fn,ms){ its.push(setTimeout(fn,ms)); }
  function isOpen(){ return !!isl && isl.classList.contains('open') && !isl.classList.contains('closing'); }
  function busy(){ return !!isl && isl.classList.contains('show'); }
  function W(n){ return phone()?innerWidth-16:(n||440); }
  function swapI(h,cb){ isIn.classList.add('fade'); later(function(){ isIn.innerHTML=h; isIn.classList.remove('fade'); if(cb) cb(); },200); }
  function open(h,opt){ el(); opt=opt||{}; var w=opt.w||W(), hh=opt.h||72, r=opt.r||36;
    if(isOpen()){ clr(); if(mode==='cmd'){ isl.classList.remove('cmd'); mode=''; } swapI(h,opt.cb); shape(w,hh,r); return; }
    clr(); isl.classList.remove('closing','open','cmd'); mode=''; isl.style.transition='none';
    if(opt.from){ var f=opt.from; put(f.left,f.top,f.width,f.height,f.height/2); } else pill();
    isl.getBoundingClientRect(); isl.style.transition='';
    isIn.classList.remove('fade'); isIn.innerHTML=h; isl.classList.add('show'); if(opt.cb) opt.cb();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ var sz=opt.size?opt.size():null; if(sz) shape(sz[0],sz[1],sz[2]); else shape(w,hh,r); isl.classList.add('open'); }); });
  }
  function close(){ clr(); if(!busy()) return; var wasCmd=mode==='cmd'; isl.classList.remove('open'); isl.classList.add('closing'); pill(); mode=''; onTap=null; acts={};
    if(wasCmd){ var a=document.activeElement; if(a&&a.blur) a.blur(); }
    later(function(){ isl.classList.remove('show','closing','cmd'); isIn.innerHTML=''; if(queue.length){ var q=queue.shift(); setTimeout(q,350); } },460); MK.think(false); }
  var TX=function(b,e){ return '<span class="is-t"><b>'+esc(b)+'</b>'+(e?'<em>'+esc(e)+'</em>':'')+'</span>'; };
  var DOT='<span class="is-ev"></span>';
  var CK='<span class="is-ck"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>';
  var BAD='<span class="is-ck bad"><svg viewBox="0 0 24 24"><path d="M12 6.5v7M12 17v.5"/></svg></span>';
  function toast(msg,bad){ acts={}; onTap=null; open((bad?BAD:CK)+TX(msg, bad?'check this':'done')); later(close, bad?4200:2600); if(bad) MK.ahem(); else MK.happy(); }
  function confirm(msg,cap,undo){ acts={}; onTap=null; open(CK+TX(msg,cap)+(undo?'<button class="ib" type="button" data-act="undo">UNDO</button>':''),{w:W(480)}); if(undo) acts.undo=undo; later(close,5200); MK.happy(); }
  function notify(text,cap,tap,look){ var run=function(){ acts={}; open(DOT+TX(text,cap)); onTap=tap||null; later(close,4200); MK.pop(); if(look) setTimeout(function(){ MK.lookAt(look,1800); },200); };
    if(busy()||document.documentElement.classList.contains('gs-open')) queue.push(function(){ if(busy()) queue.push(run); else run(); }); else run(); }

  /* ask m360: answers come from the OS itself, enter takes you there */
  /* voice: if the OS has voice, register it with ISL.setVoice(fn) and drive the island with ISL.voice(stage,text,caption,onShow)
     stages: 'listening' | 'heard' | 'thinking' | 'answer'. The mic shows in the Ask bar only when a voice handler is set. */
  var voiceFn=null;
  var WV=function(calm){ return '<span class="is-wave'+(calm?' calm':'')+'"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i></span>'; };
  function voice(stage,text,cap,onShow){ acts={}; onTap=null; clr();
    if(stage==='listening'){ open(WV()+TX('Listening','ask m360')+'<i class="is-mic"></i>'); MK.listen(true); return; }
    if(stage==='heard'){ open(WV()+TX('\u201c'+text+'\u201d','you')+'<i class="is-mic"></i>'); return; }
    if(stage==='thinking'){ MK.listen(false); MK.think(true); open(WV(1)+TX('Thinking','m360')); return; }
    MK.listen(false); MK.think(false); MK.nod(); open(WV(1)+TX(text,cap||'')+(onShow?'<button class="ib" type="button" data-act="show">SHOW</button>':''),{w:W(520)}); if(onShow) acts.show=onShow; later(close,8200); }
  var cbI=null, cbL=null, items=[], sel=0;
  function mark(){ $qa('.cbo',cbL).forEach(function(b,i){ b.classList.toggle('cur',i===sel); }); var s=$q('.cbo.cur',cbL); if(s&&s.scrollIntoView) s.scrollIntoView({block:'nearest'}); }
  function cbDims(){ var lh=cbL?cbL.scrollHeight:56, cap=phone()?Math.round(innerHeight*.56):392; return [W(600),64+Math.min(lh,cap),28]; }
  function render(q){ items=SEARCH((q||'').trim()); sel=0;
    cbL.innerHTML=items.length?items.map(function(it,i){ return (it.hd?'<div class="cbh">'+esc(it.hd)+'</div>':'')+'<button type="button" class="cbo'+(it.ans?' ans':'')+(i===0?' cur':'')+'" data-i="'+i+'"><span class="ic'+(it.round?' r':'')+'">'+it.ic+'</span><span class="tx"><b>'+esc(it.t)+'</b>'+(it.s?'<em>'+esc(it.s)+'</em>':'')+'</span><span class="rt">'+esc(it.r||'')+'</span></button>'; }).join(''):'<div class="cbe">No match yet. Try a name, a client, a page or who is late.</div>';
    if(mode==='cmd'){ var d=cbDims(); shape(d[0],d[1],d[2]); } }
  function runItem(it){ if(!it) return; if(it.q){ cbI.value=it.q; render(it.q); return; } close(); setTimeout(function(){ try{ it.run(); }catch(err){} },240); }
  function openCmd(q,from){ el();
    var MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg>';
    var H0='<div class="cb"><div class="cbr">'+(voiceFn?'<button class="cbm" type="button" aria-label="Speak">'+MIC+'</button>':IR.search)+'<input id="cbi" type="text" placeholder="Ask m360 or jump to anything" autocomplete="off" spellcheck="false" aria-label="Ask m360"><kbd class="kb cbk">esc</kbd></div><div class="cbl" id="cbl" role="listbox"></div></div>';
    var start=function(){ isl.classList.add('cmd'); mode='cmd'; cbI=$q('#cbi'); cbL=$q('#cbl'); cbI.value=q||''; render(q||'');
      cbI.addEventListener('input',function(){ render(cbI.value); });
      cbI.addEventListener('keydown',function(e){ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!items.length) return; sel=(sel+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; mark(); } else if(e.key==='Enter'){ e.preventDefault(); runItem(items[sel]); } else if(e.key==='Escape'){ e.preventDefault(); close(); } });
      cbL.addEventListener('click',function(e){ var b=e.target.closest('.cbo'); if(b) runItem(items[+b.getAttribute('data-i')]); });
      cbL.addEventListener('pointermove',function(e){ var b=e.target.closest('.cbo'); if(!b) return; var i=+b.getAttribute('data-i'); if(i!==sel){ sel=i; mark(); } });
      var mb=$q('.cbm',isl); if(mb) mb.addEventListener('click',function(){ if(voiceFn) voiceFn(); });
      setTimeout(function(){ try{ cbI.focus({preventScroll:true}); }catch(err){ cbI.focus(); } },120);
      MK.lookAt(isl,1400); };
    if(isOpen()){ clr(); isl.classList.add('cmd'); mode='cmd'; isIn.innerHTML=H0; start(); return; }
    open(H0,{from:from||null, w:W(600), h:120, r:28, cb:start, size:cbDims});
  }
  document.addEventListener('pointerdown',function(e){ if(mode==='cmd'&&isl&&!isl.contains(e.target)&&!(e.target.closest&&e.target.closest('.c-askf,#sAsk,.tb-ask'))) close(); });
  addEventListener('resize',function(){ if(!busy()) return; if(mode==='cmd'){ var d=cbDims(); shape(d[0],d[1],d[2]); } else if(isOpen()) shape(W(), isl.offsetHeight, 36); });
  return {open:open, close:close, toast:toast, confirm:confirm, notify:notify, cmd:openCmd, voice:voice, setVoice:function(fn){ voiceFn=fn||null; }, isCmd:function(){ return mode==='cmd'; }};
})();

/* what the OS knows, for asking.
   ADAPT from here to SEARCH: needsOf, liveEvents, INDEX, INTENTS and SUGG read the artifact's data helpers
   (checkinOf, eodOf, lateMins, tasksOf, pitchValue, rankAll, evaluateRules output and so on).
   Rewrite them against this OS's data. Keep the shapes they return: the island and Command read those. */
function needsOf(ctx){
  var out=[]; if(!ctx || !ctx.isFounder) return out;
  Object.keys(ctx.leave||{}).forEach(function(uid){ var dec=((ctx.leavedec[uid]||{}).d)||{}; ((ctx.leave[uid]||{}).reqs||[]).forEach(function(r){ if(!dec[r.id]) out.push({k:'lv:'+uid+':'+r.id, kind:'leave', uid:uid, r:r, at:r.at||0}); }); });
  Object.keys(ctx.joinreq||{}).forEach(function(uid){ var m=((ctx.roster||{}).members||{})[uid]; if(!m || m.active===false) out.push({k:'jr:'+uid, kind:'join', uid:uid, at:(ctx.joinreq[uid]||{}).at||0}); });
  Object.keys(ctx.candidates||{}).forEach(function(cid){ var c=ctx.candidates[cid]; if(!c || c.decision || c.stage==='hired' || c.stage==='rejected') return; var evs=c.evaluators||[]; var n=Object.keys(evalsFor(ctx,cid)).length;
    if(evs.indexOf(ctx.meId)>-1 && !((ctx.evals[ctx.meId]||{}).e||{})[cid]) out.push({k:'ev:'+cid, kind:'eval', cid:cid, c:c, n:n, at:c.created||0});
    else if(evs.length && n>=evs.length) out.push({k:'hd:'+cid, kind:'decide', cid:cid, c:c, n:n, at:c.created||0}); });
  var sorted=out.sort(function(a,b){ return (a.at||0)-(b.at||0); });
  (ctx.flags||[]).filter(function(f){ return f.sev==='high'; }).forEach(function(f,i){ sorted.push({k:'fl:'+f.rule+':'+f.uid+':'+i, kind:'flag', f:f, uid:f.uid, at:0}); });
  return sorted;
}
function leaveRange(r){ return fmtDay(r.from)+(r.to!==r.from?' to '+fmtDay(r.to):''); }
function flagGo(f){ if(f.ref==='handbook') return 'handbook/'+f.section; if(f.ref==='today'||f.ref==='week'||f.ref==='people') return (CUR.ctx&&f.uid===CUR.ctx.meId)?'today':'people/'+f.uid; return f.ref||'today'; }
function liveEvents(ctx){
  var t=todayStr(), ev=[], since=Date.now()-36*3600000;
  (ctx.ids||[]).forEach(function(uid){ var ci=checkinOf(ctx,uid,t);
    if(ci){ ev.push({k:'ci:'+uid+':'+t, at:ci.in, uid:uid, text:ctx.nm(uid)+' checked in, '+hm(ci.in)+', '+(ci.mode==='wfh'?'WFH':'office'), cap:'check in', go:'people/'+uid});
      if(ci.out) ev.push({k:'co:'+uid+':'+t, at:ci.out, uid:uid, text:ctx.nm(uid)+' checked out, '+hm(ci.out), cap:'check out', go:'people/'+uid}); }
    var ed=eodOf(ctx,uid,t); if(ed) ev.push({k:'eod:'+uid+':'+t, at:ed.at, uid:uid, text:ctx.nm(uid)+' posted the EOD line'+(ed.blocked?', blocked':''), cap:'eod', go:'week'}); });
  Object.keys(ctx.feed||{}).forEach(function(uid){ ((ctx.feed[uid]||{}).posts||[]).forEach(function(po){ if((po.at||0)>since) ev.push({k:'fd:'+uid+':'+po.id, at:po.at, uid:uid, text:ctx.nm(uid)+(po.kind==='win'?' shared a win':po.kind==='question'?' asked a question':po.kind==='announce'?' posted an announcement':' posted an update'), cap:'feed', go:'feed'}); }); });
  Object.keys(ctx.kudos||{}).forEach(function(g){ ((ctx.kudos[g]||{}).given||[]).forEach(function(kd){ if((kd.at||0)>since) ev.push({k:'kd:'+g+':'+(kd.id||kd.at), at:kd.at, uid:g, to:kd.to, text:ctx.nm(g)+' gave kudos to '+(kd.to===ctx.meId?'you':ctx.nm(kd.to)), cap:'kudos', go:'feed'}); }); });
  if(ctx.isFounder){
    Object.keys(ctx.leave||{}).forEach(function(uid){ var dec=((ctx.leavedec[uid]||{}).d)||{}; ((ctx.leave[uid]||{}).reqs||[]).forEach(function(r){ if(!dec[r.id]) ev.push({k:'lv:'+uid+':'+r.id, at:r.at||0, uid:uid, text:ctx.nm(uid)+' asked for leave, '+leaveRange(r), cap:'leave', go:'command'}); }); });
    Object.keys(ctx.joinreq||{}).forEach(function(uid){ var m=((ctx.roster||{}).members||{})[uid]; if(!m||m.active===false) ev.push({k:'jr:'+uid, at:(ctx.joinreq[uid]||{}).at||0, uid:uid, text:ctx.nm(uid)+' asked to join the OS', cap:'join', go:'desk'}); });
    Object.keys(ctx.pulse||{}).forEach(function(k){ var x=ctx.pulse[k]; if((x.at||0)>since) ev.push({k:'pu:'+k, at:x.at, text:'A pulse came in, energy '+x.energy+' of 5', cap:'pulse', go:'voice'}); });
  }
  return ev.sort(function(a,b){ return (b.at||0)-(a.at||0); });
}
var PAGE_IC={today:'today',tasks:'tasks',projects:'projects',pitches:'pitches',clients:'clients',feed:'feed',week:'week',scores:'scores',people:'people',hiring:'hiring',handbook:'handbook',voice:'voice',leave:'leave',command:'command',desk:'desk'};
function pIc(k){ return IR[PAGE_IC[k]||'command']||IR.command; }
function avIc(name){ return esc(ini(name)||'?'); }
function INDEX(ctx){
  var out=[], t=todayStr(), push=function(o){ out.push(o); };
  (CUR.nav||[]).forEach(function(n){ push({o:0, k:'page', ic:pIc(n[0]), t:n[1], s:'Page', w:(n[1]+' '+n[0]+' page '+(n[4]||'')).toLowerCase(), run:function(){ CUR.go(n[0]); }}); });
  var mem=(ctx.roster||{}).members||{};
  Object.keys(mem).filter(function(id){ return mem[id] && mem[id].active!==false; }).forEach(function(id){ var m=mem[id]; var st=STATUS_LABEL[statusOf(ctx,id,t)]||''; push({o:1, k:'person', round:1, ic:avIc(ctx.nm(id)), t:ctx.nm(id), s:[m.title,m.pod,st].filter(Boolean).join(', '), w:(ctx.nm(id)+' '+(m.title||'')+' '+(m.pod||'')+' person people').toLowerCase(), run:function(){ CUR.go('people/'+id); }}); });
  Object.keys(ctx.projects||{}).forEach(function(k){ var x=ctx.projects[k]; if(x.archived) return; var pg=projProgress(ctx,k); push({o:2, k:'project', ic:IR.projects, t:x.name||'Project', s:'Project, '+(x.status==='off'?'off track':x.status==='risk'?'at risk':x.status==='done'?'done':'on track')+', '+pg.pct+'%', w:((x.name||'')+' project').toLowerCase(), run:function(){ CUR.go('projects/'+k); }}); });
  Object.keys(ctx.clients||{}).forEach(function(k){ var c=ctx.clients[k]; push({o:3, k:'client', ic:IR.clients, t:c.name||'Client', s:'Client, '+(c.status||'live'), w:((c.name||'')+' client brand').toLowerCase(), run:function(){ openReq('clients',k); }}); });
  Object.keys(ctx.pitches||{}).forEach(function(k){ var x=ctx.pitches[k]; push({o:4, k:'pitch', ic:IR.pitches, t:x.brand||'Pitch', s:'Pitch, '+(STAGE_LABEL[x.stage]||'Lead').toLowerCase(), w:((x.brand||'')+' '+(x.category||'')+' pitch deal').toLowerCase(), run:function(){ openReq('pitches',k); }}); });
  Object.keys(ctx.tasks||{}).forEach(function(k){ var x=ctx.tasks[k]; if(x.status==='done' && x.owner!==ctx.meId) return; push({o:5, k:'task', ic:IR.tasks, t:x.title||'Task', s:'Task, '+ctx.nm(x.owner)+(x.due?', due '+fmtDay(x.due):'')+(x.status==='done'?', done':''), w:((x.title||'')+' task').toLowerCase(), run:function(){ openReq('tasks',k); }}); });
  Object.keys(ctx.candidates||{}).forEach(function(k){ var c=ctx.candidates[k]; if(!ctx.isFounder && (c.evaluators||[]).indexOf(ctx.meId)<0) return; push({o:6, k:'cand', round:1, ic:avIc(c.name), t:c.name||'Candidate', s:'Candidate, '+(c.role||'').toLowerCase(), w:((c.name||'')+' '+(c.role||'')+' candidate hiring').toLowerCase(), run:function(){ CUR.go('hiring/'+k); }}); });
  (ctx.hbIds||[]).forEach(function(k){ var h=ctx.handbook[k]||{}; push({o:7, k:'hb', ic:IR.handbook, t:h.title||k, s:'Handbook', w:((h.title||k)+' handbook rule section').toLowerCase(), run:function(){ CUR.go('handbook/'+k); }}); });
  return out;
}
function ansPipe(ctx){ var w=0, n=0, by={}; Object.keys(ctx.pitches||{}).forEach(function(k){ var x=ctx.pitches[k]; if(x.stage==='won'||x.stage==='lost') return; var pv=pitchValue(ctx,k); w+=pv.weighted; n++; by[x.stage]=(by[x.stage]||0)+pv.weighted; }); var top=Object.keys(by).sort(function(a,b){ return by[b]-by[a]; })[0]; return {w:w, n:n, top:top}; }
function ansLargest(ctx){ var fin=((ctx.finance||{}).clients)||{}; var rows=Object.keys(ctx.clients||{}).map(function(k){ return [k,(fin[k]||{}).monthly||0]; }).sort(function(a,b){ return b[1]-a[1]; }); var tot=rows.reduce(function(s,r){ return s+r[1]; },0); return {rows:rows, tot:tot}; }
function ansEnergy(ctx){ var ps=Object.keys(ctx.pulse||{}).map(function(k){ return ctx.pulse[k]; }); var wks=ps.map(function(x){ return x.week; }).filter(Boolean).sort(); var lw=wks[wks.length-1]; var vals=ps.filter(function(x){ return x.week===lw; }).map(function(x){ return x.energy||0; }); return {lw:lw, n:vals.length, e:vals.length?vals.reduce(function(a,b){ return a+b; },0)/vals.length:null}; }
var INTENTS=[
  {re:/\blate\b|on time/, a:function(ctx){ var t=todayStr(); var ins=ctx.ids.filter(function(id){ return checkinOf(ctx,id,t); }); var l=ins.filter(function(id){ return lateMins(ctx,id,checkinOf(ctx,id,t))>0; });
    return {ic:IR.today, t:l.length?l.map(function(id){ return ctx.nm(id)+', in at '+hm(checkinOf(ctx,id,t).in); }).join('. ')+'.':'Nobody was late today.', s:l.length+' late, '+ins.length+' in so far', run:function(){ if(ctx.isFounder) showAt('command','#c-att .c-tr.rw',{att:l.length?'late':'all'}); else showAt('today','#t-who'); }}; }},
  {re:/not in|absent|missing|who.?s (in|out|here)|attendance|who checked/, a:function(ctx){ var t=todayStr(); var wk=ctx.ids.filter(function(id){ return isWorkingDay(ctx,id,t); }); var out=wk.filter(function(id){ return !checkinOf(ctx,id,t); });
    return {ic:IR.today, t:out.length?names(out.map(ctx.nm))+(out.length===1?' is':' are')+' not in yet.':(wk.length?'Everyone is in.':'Nobody is working today.'), s:(wk.length-out.length)+' of '+wk.length+' in today', run:function(){ if(ctx.isFounder) showAt('command','#c-att .c-tr.rw',{att:out.length?'none':'all'}); else showAt('today','#t-who'); }}; }},
  {re:/need|waiting|approv|pending|inbox/, f:1, a:function(ctx){ var n=needsOf(ctx); return {ic:IR.command, t:n.length?plural(n.length,'thing needs you.','things need you.'):'Nothing needs you right now.', s:'Approvals, panel calls and high flags', run:function(){ showAt('command','#c-need .c-nc,#c-need .c-clear'); }}; }},
  {re:/pipeline|deal|proposal|negotiat|sales|weighted/, f:1, a:function(ctx){ var p=ansPipe(ctx); return {ic:IR.pitches, t:p.n?inr(p.w)+' a month, weighted, across '+plural(p.n,'open pitch','open pitches')+'.':'No open pitches yet.', s:p.top?'Most of it in '+(STAGE_LABEL[p.top]||'').toLowerCase():'Add pitches to see the pipeline', run:function(){ showAt('command','#c-pipe'); }}; }},
  {re:/client|revenue|biggest|largest|account/, f:1, a:function(ctx){ var L=ansLargest(ctx); if(!L.tot) return {ic:IR.clients, t:'No client revenue set yet.', s:'Set a monthly figure on each client', run:function(){ CUR.go('clients'); }}; var k=L.rows[0][0], v=L.rows[0][1], pc=Math.round(100*v/L.tot);
    return {ic:IR.clients, t:(ctx.clients[k].name||'Client')+', '+inr(v)+' a month.', s:pc+'% of revenue'+(pc>25?', above the 25% line':''), run:function(){ showAt('command','#c-cli [data-id="'+k+'"]'); }}; }},
  {re:/leader|score|point|\btop\b|best|winning|podium/, a:function(ctx){ var rows=rankAll(ctx,'week',ctx.now).rows; if(!rows.length) return {ic:IR.scores, t:'Nobody on the board yet.', s:'This week', run:function(){ CUR.go('scores'); }};
    return {ic:IR.scores, t:ctx.nm(rows[0].uid)+' leads with '+plural(rows[0].total,'point')+'.', s:rows[1]?ctx.nm(rows[1].uid)+' second on '+rows[1].total:'This week', run:function(){ if(ctx.isFounder) showAt('command','#c-lb .c-lbr'); else CUR.go('scores'); }}; }},
  {re:/flag|rule/, a:function(ctx){ if(ctx.isFounder){ var f=ctx.flags, h=f.filter(function(x){ return x.sev==='high'; }); var who=[]; h.forEach(function(x){ var n=ctx.nm(x.uid); if(who.indexOf(n)<0) who.push(n); });
      return {ic:IR.handbook, t:f.length?plural(f.length,'flag')+', '+h.length+' high.':'No flags. All clear.', s:who.length?names(who.slice(0,3))+' need a look':'The rules are quiet', run:function(){ showAt('command','#c-flg'); }}; }
    var mine=ctx.flags.filter(function(x){ return x.uid===ctx.meId; }); return {ic:IR.handbook, t:mine.length?'You have '+plural(mine.length,'open flag')+'.':'Your rule box is clear.', s:mine[0]?mine[0].name:'All clear', run:function(){ showAt('today','#t-rules'); }}; }},
  {re:/energy|mood|pulse|morale/, f:1, a:function(ctx){ var E=ansEnergy(ctx); return {ic:IR.voice, t:E.e!=null?'Team energy '+E.e.toFixed(1)+' of 5 in week '+weekNum(E.lw)+'.':'No pulse yet.', s:E.n?plural(E.n,'reply','replies')+', anonymous':'Pulses are anonymous', run:function(){ showAt('command','#c-vox'); }}; }},
  {re:/hir|candidate|interview|panel|evaluat/, a:function(ctx){ var me=ctx.meId; if(ctx.isFounder){ var cs=Object.keys(ctx.candidates).filter(function(k){ return !ctx.candidates[k].decision; }); if(!cs.length) return {ic:IR.hiring, t:'Nobody in the panel.', s:'Hiring', run:function(){ CUR.go('hiring'); }}; var c=ctx.candidates[cs[0]];
      return {ic:IR.hiring, t:plural(cs.length,'candidate')+' in the panel. '+(c.name||'')+' is at '+Object.keys(evalsFor(ctx,cs[0])).length+' of '+(c.evaluators||[]).length+'.', s:'Panel reads', run:function(){ showAt('command','#c-hire'); }}; }
    var mine=Object.keys(ctx.candidates).filter(function(k){ var c=ctx.candidates[k]; return c && !c.decision && (c.evaluators||[]).indexOf(me)>-1 && !((ctx.evals[me]||{}).e||{})[k]; });
    return {ic:IR.hiring, t:mine.length?'You have '+plural(mine.length,'evaluation')+' to write.':'No evaluations assigned to you.', s:'Hiring panel', run:function(){ CUR.go('hiring'); }}; }},
  {re:/project|off track|at risk|delivery/, a:function(ctx){ var ks=Object.keys(ctx.projects).filter(function(k){ var x=ctx.projects[k]; return !x.archived && x.status!=='done'; }); var ph={on:0,risk:0,off:0}; ks.forEach(function(k){ ph[ctx.projects[k].status||'on']=(ph[ctx.projects[k].status||'on']||0)+1; });
    var worst=ks.filter(function(k){ return ctx.projects[k].status==='off'; })[0]||ks.filter(function(k){ return ctx.projects[k].status==='risk'; })[0];
    return {ic:IR.projects, t:ks.length?ph.on+' on track, '+ph.risk+' at risk, '+ph.off+' off track.':'No live projects.', s:worst?(ctx.projects[worst].name||'')+' is '+(ctx.projects[worst].status==='off'?'off track':'at risk'):'Projects', run:function(){ if(ctx.isFounder&&ks.length) showAt('command','#c-proj'); else CUR.go('projects'); }}; }},
  {re:/overdue|task|\bdue\b/, a:function(ctx){ var t=todayStr(); if(ctx.isFounder){ var od=tasksOf(ctx).filter(function(x){ return x.status!=='done' && x.due && x.due<t; }); var who=[]; od.forEach(function(x){ var n=ctx.nm(x.owner); if(who.indexOf(n)<0) who.push(n); });
      return {ic:IR.tasks, t:od.length?plural(od.length,'task')+' overdue across the team.':'Nothing overdue.', s:who.length?names(who.slice(0,3)):'The board is clean', run:function(){ CUR.go('tasks'); }}; }
    var mine=tasksOf(ctx,ctx.meId).filter(function(x){ return x.status!=='done'; }); var o=mine.filter(function(x){ return x.due && x.due<t; }).length;
    return {ic:IR.tasks, t:'You have '+plural(mine.length,'open task')+(o?', '+o+' overdue':'')+'.', s:'My tasks', run:function(){ CUR.go('tasks'); }}; }},
  {re:/leave|holiday|day off|time off|vacation/, a:function(ctx){ if(ctx.isFounder){ var n=needsOf(ctx).filter(function(x){ return x.kind==='leave'; }); return {ic:IR.leave, t:n.length?plural(n.length,'leave request')+' waiting for you.':'No leave waiting.', s:'Leave', run:function(){ if(n.length) showAt('command','#c-need .c-nc'); else CUR.go('leave'); }}; }
    var reqs=((ctx.leave[ctx.meId]||{}).reqs||[]).slice().sort(function(a,b){ return (b.at||0)-(a.at||0); }); var dec=((ctx.leavedec[ctx.meId]||{}).d)||{}; var r=reqs[0];
    return {ic:IR.leave, t:r?'Your last request, '+leaveRange(r)+', is '+((dec[r.id]||{}).status||'waiting')+'.':'No leave requests yet.', s:'Leave', run:function(){ CUR.go('leave'); }}; }},
  {re:/\beod\b|end of day|shipped|blocked/, a:function(ctx){ var ed=eodOf(ctx,ctx.meId,todayStr()); return {ic:IR.today, t:ed?'Your EOD line is in, posted '+hm(ed.at)+'.':'No EOD line yet today. Cutoff is '+ctx.settings.eodCut+'.', s:'End of day', run:function(){ showAt('today','#t-eod'); }}; }},
  {re:/check ?(in|out)/, a:function(ctx){ var ci=checkinOf(ctx,ctx.meId,todayStr()); return {ic:IR.today, t:ci?'You checked in at '+hm(ci.in)+', '+(ci.mode==='wfh'?'WFH':'office')+'.':'You have not checked in yet. Start is '+startFor(ctx,ctx.meId)+'.', s:'Check in', run:function(){ showAt('today','#t-check'); }}; }}
];
function SUGG(ctx){
  var out=[], mem=(ctx.roster||{}).members||{};
  var asks=ctx.isFounder?[[IR.today,'Who is late today?','who is late today'],[IR.command,'What needs me?','what needs me'],[IR.pitches,'Pipeline this month','pipeline this month'],[IR.clients,'Biggest client','biggest client']]
    :[[IR.today,'Did I check in?','check in'],[IR.tasks,'My tasks','my tasks'],[IR.today,'Who is in today?','who is in today'],[IR.scores,'Who leads this week?','who leads this week']];
  asks.forEach(function(a,i){ out.push({hd:i===0?'Try':null, ic:a[0], t:a[1], r:'ask', q:a[2]}); });
  var ppl=ctx.ids.filter(function(id){ return id!==ctx.meId && mem[id]; }).slice(0,3);
  ppl.forEach(function(id,i){ var m=mem[id]||{}; out.push({hd:i===0?'People':null, round:1, ic:avIc(ctx.nm(id)), t:ctx.nm(id), s:m.title||'', r:'open', run:function(){ CUR.go('people/'+id); }}); });
  if(!ppl.length && ctx.isFounder) out.push({hd:'Go to', ic:IR.desk, t:'Add your team', s:'Desk, roster', r:'go', run:function(){ CUR.go('desk'); }});
  return out;
}
function SEARCH(q){
  var ctx=CUR.ctx; if(!ctx) return [];
  var ql=q.toLowerCase().replace(/[‘’]/g,"'");
  if(!ql) return SUGG(ctx);
  var out=[], hit=null;
  INTENTS.some(function(x){ if((!x.f||ctx.isFounder) && x.re.test(ql)){ try{ hit=x.a(ctx); }catch(err){ hit=null; } return !!hit; } return false; });
  if(hit){ hit.ans=true; hit.r='show'; out.push(hit); }
  var words=ql.split(/\s+/).filter(function(w){ return w.length>1 || ql.length<3; });
  var m=INDEX(ctx).filter(function(e){ return words.length && words.every(function(w){ return e.w.indexOf(w)>-1; }); });
  m.sort(function(a,b){ var as=a.t.toLowerCase().indexOf(ql)===0?0:1, bs=b.t.toLowerCase().indexOf(ql)===0?0:1; return as-bs || a.o-b.o; });
  m.slice(0,hit?5:8).forEach(function(e,i){ out.push({hd:i===0?(hit?'Jump to':null):null, ic:e.ic, round:e.round, t:e.t, s:e.s, r:e.k==='page'?'go':'open', run:e.run}); });
  return out;
}
addEventListener('keydown',function(e){
  var k=e.key||''; var tg=e.target||{}; var typing=/INPUT|TEXTAREA|SELECT/.test(tg.tagName||'')||tg.isContentEditable;
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='k'){ e.preventDefault(); if(ISL.isCmd()) ISL.close(); else ISL.cmd(''); return; }
  if(k==='Escape' && ISL.isCmd()){ ISL.close(); return; }
  if(typing||e.metaKey||e.ctrlKey||e.altKey) return;
  if(k==='/'){ e.preventDefault(); ISL.cmd(''); }
  else if(k==='['){ SB.toggle(); }
});

/* sidebar: black pill marks the page, warm pill follows the pointer, names on demand */
var SB=(function(){
  var side=null, snav=null, spa=null, sph=null, here=null, tip=null, tipOn=false, lastK=null, bound=false;
  function placeEl(p,el,snap,dy){ if(!p||!el) return; if(snap) p.style.transition='none'; p.style.transform='translate3d(0,'+(el.offsetTop+(dy||0))+'px,0)'; if(snap){ p.getBoundingClientRect(); p.style.transition=''; } }
  function place(snap){ if(!snav) return; var a=$q('.nv.on',snav); if(!a){ spa.style.opacity='0'; here.style.opacity='0'; lastK=null; return; } var first=!lastK; spa.style.opacity='1'; here.style.opacity='1'; placeEl(spa,a,snap||first); placeEl(here,a,snap||first,10); var k=a.getAttribute('data-k'); if(lastK && lastK!==k) MK.nod(); lastK=k; }
  function ovf(){ if(!snav) return; var t=snav.scrollTop, m=snav.scrollHeight-snav.clientHeight; snav.classList.toggle('ovt',t>2); snav.classList.toggle('ovb',m-t>2); }
  function hideTip(){ if(tip) tip.classList.remove('on'); tipOn=false; }
  function showTip(el){ if(!tip||!side) return; if(document.documentElement.classList.contains('sbx')||phone()){ hideTip(); return; }
    var r=el.getBoundingClientRect(), s=side.getBoundingClientRect(), bd=$q('.bd',el), kb=el.getAttribute('data-kb');
    tip.innerHTML=esc(el.getAttribute('data-t')||'')+(kb?'<kbd class="kb">'+esc(kb)+'</kbd>':'')+(bd?'<b class="bd">'+esc(bd.textContent)+'</b>':'');
    tip.style.setProperty('--tx',(s.right+10)+'px'); tip.style.setProperty('--ty',(r.top+r.height/2-15)+'px');
    if(!tipOn){ tip.style.transition='none'; tip.getBoundingClientRect(); tip.style.transition=''; } tip.classList.add('on'); tipOn=true; }
  function mount(el){ if(!el) return; side=el; snav=$q('.snav',el); spa=$q('.sp-a',el); sph=$q('.sp-h',el); here=$q('.here',el);
    tip=$q('#tip'); if(!tip){ tip=document.createElement('div'); tip.id='tip'; tip.className='tip'; tip.setAttribute('aria-hidden','true'); document.body.appendChild(tip); }
    snav.addEventListener('pointerover',function(e){ var b=e.target.closest('.nv'); if(!b) return; if(sph.style.opacity!=='1') placeEl(sph,b,true); else placeEl(sph,b); sph.style.opacity=b.classList.contains('on')?'0':'1'; showTip(b); });
    snav.addEventListener('pointerleave',function(){ sph.style.opacity='0'; hideTip(); });
    side.addEventListener('pointerover',function(e){ var b=e.target.closest('.sfoot .nv'); if(b) showTip(b); });
    side.addEventListener('pointerout',function(e){ var b=e.target.closest('.sfoot .nv'); if(b && !(e.relatedTarget && b.contains(e.relatedTarget))) hideTip(); });
    snav.addEventListener('scroll',function(){ hideTip(); ovf(); },{passive:true});
    if(!bound){ bound=true; addEventListener('resize',function(){ ovf(); place(true); }); }
    place(true); ovf(); setTimeout(ovf,700); }
  function toggle(){ var x=!document.documentElement.classList.contains('sbx'); document.documentElement.classList.toggle('sbx',x); try{ localStorage.setItem('m360.sb',x?'x':'s'); }catch(err){} hideTip(); MK.pop(); setTimeout(function(){ ovf(); place(true); FX.frame(); },650); EVB.emit('sb',x); }
  return {mount:mount, place:place, toggle:toggle, hideTip:hideTip, ovf:ovf};
})();

/* phone tab bar lens */
var TB={place:function(nav,snap){ if(!nav) return; var a=$q('.ptab.on',nav), lens=$q('.lens',nav); if(!lens) return; if(!a||!a.offsetWidth){ lens.style.opacity='0'; return; } lens.style.opacity='1'; var first=!lens.__p; if(first||snap) lens.style.transition='none'; lens.style.width=a.offsetWidth+'px'; lens.style.transform='translate3d('+a.offsetLeft+'px,0,0)'; if(first||snap){ lens.getBoundingClientRect(); lens.style.transition=''; } lens.__p=1; }};

/* sections rise in when they arrive, numbers count up */
function fmtCount(n,fmt){ return fmt==='inr'?inr(n):String(Math.round(n)); }
function countTo(el,to){ var fmt=el.getAttribute('data-fmt'), t0=0, d=1200; var tn=el.firstChild; if(!tn||tn.nodeType!==3) return; if(RM){ return; }
  var f=function(ts){ if(!t0) t0=ts; var p=Math.min(1,(ts-t0)/d), e=1-Math.pow(1-p,3); var fin=el.getAttribute('data-v'); if(p<1){ tn.nodeValue=fmtCount(to*e,fmt); requestAnimationFrame(f); } else tn.nodeValue=fin!=null?fin:fmtCount(to,fmt); };
  requestAnimationFrame(f); }
var RV=(function(){ var io=null;
  function see(el){ el.classList.add('seen'); $qa('[data-n]',el).forEach(function(n){ var to=+n.getAttribute('data-n')||0; if(to) countTo(n,to); }); }
  return {scan:function(root){ var els=$qa('.rv',root||document).filter(function(el){ return !el.classList.contains('seen'); }); if(!els.length) return;
    if(!('IntersectionObserver' in window)||RM){ els.forEach(see); return; }
    if(!io) io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ see(e.target); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -6% 0px',threshold:0});
    els.forEach(function(el){ io.observe(el); }); }};
})();

/* scroll frame: dark band, glass over dark, tab bar folds away, counter rail */
var FX=(function(){
  var ticking=false, lastY=0;
  function frame(){ ticking=false; var y=scrollY, vh=innerHeight;
    var dark=$q('#c-biz'), side=$q('#side'), pbar=$q('#pbar'), tabbar=$q('#tabbar'), rail=$q('#c-rail');
    if(dark){ var r=dark.getBoundingClientRect(); var e=RM?1:clampN((vh-r.top)/(vh*.7),0,1); dark.style.setProperty('--e',e.toFixed(4)); var mid=vh/2;
      if(rail) rail.classList.toggle('dk',r.top<mid+120&&r.bottom>mid-120); if(side) side.classList.toggle('dk',r.top<vh-60&&r.bottom>60); if(pbar) pbar.classList.toggle('dk',r.top<64&&r.bottom>8); if(tabbar) $qa('.lg',tabbar).forEach(function(g){ g.classList.toggle('dk',r.top<vh-20&&r.bottom>vh-70); }); }
    else { if(side) side.classList.remove('dk'); if(pbar) pbar.classList.remove('dk'); if(tabbar) $qa('.lg',tabbar).forEach(function(g){ g.classList.remove('dk'); }); }
    if(tabbar){ if(y>lastY+6&&y>240) tabbar.classList.add('min'); else if(y<lastY-6&&tabbar.classList.contains('min')){ tabbar.classList.remove('min'); setTimeout(function(){ TB.place(tabbar,false); },640); } }
    lastY=y; if(rail) CMDP.spy(); }
  addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } },{passive:true});
  addEventListener('resize',function(){ frame(); });
  return {frame:frame};
})();

/* the command page: counter rail and the line of live news */
var CMDP=(function(){
  var SEC=[['c-need','needs you'],['c-nums','numbers'],['c-att','attendance'],['c-flg','flags'],['c-biz','business'],['c-team','team'],['c-cli','clients']];
  var cur=-1, lock=null, tk=null, tkI=0, tkList=[], tkKey='';
  function els(){ return SEC.map(function(s){ return document.getElementById(s[0]); }); }
  function setActive(i){ var rail=$q('#c-rail'); if(!rail) return; $qa('.c-ri',rail).forEach(function(b,k){ b.classList.toggle('on',k===i); b.classList.toggle('past',k<i); }); }
  function spy(){ var rail=$q('#c-rail'); if(!rail) return; var line=phone()?110:innerHeight*.32, list=els(), tops=list.map(function(el){ return el?el.getBoundingClientRect().top-line:1e9; }), idx=0;
    for(var i=0;i<tops.length;i++){ if(tops[i]<=0) idx=i; }
    var end=innerHeight+scrollY>=document.documentElement.scrollHeight-4; if(end) idx=tops.length-1;
    var p=idx; if(idx<tops.length-1){ var a=tops[idx], b=tops[idx+1]; if(b!==a) p=idx+clampN(-a/(b-a),0,1); }
    var fill=$q('.c-rtr i',rail); if(fill) fill.style.transform='scaleY('+(p/(SEC.length-1)).toFixed(4)+')';
    if(lock!==null){ if(lock===idx) lock=null; else return; }
    if(idx!==cur){ cur=idx; setActive(idx); } }
  function go(i){ var el=document.getElementById(SEC[i][0]); if(!el) return; lock=i; cur=i; setActive(i); glideTo(el,function(){ lock=null; MK.lookAt(el,1200); }); }
  function tick(){ if(!tk||!tk.isConnected){ stopT(); return; } if(document.hidden) return; if(tkList.length<2) return; tkI=(tkI+1)%tkList.length; swap(tkList[tkI]); }
  var tkT=null; function stopT(){ clearInterval(tkT); tkT=null; }
  function swap(text){ if(!tk) return; var old=$qa('span',tk); var s=document.createElement('span'); s.className='dn'; s.textContent=text; tk.appendChild(s); s.getBoundingClientRect(); s.className=''; old.forEach(function(o){ o.className='up'; setTimeout(function(){ if(o.parentNode) o.parentNode.removeChild(o); },700); }); }
  return {
    sec:SEC,
    mount:function(){ cur=-1; lock=null; setTimeout(function(){ spy(); FX.frame(); },60); },
    go:go, spy:spy,
    ticker:function(el,list){ tk=el; if(!tk) return; var key=list.join('|'); if(key===tkKey && $q('span',tk)) return; tkKey=key; tkList=list.length?list:['Quiet so far today']; tkI=0; if(!$q('span',tk)){ var s=document.createElement('span'); s.textContent=tkList[0]; tk.appendChild(s); } else swap(tkList[0]); stopT(); tkT=setInterval(tick,5200); },
    unmount:function(){ stopT(); tk=null; tkKey=''; }
  };
})();

/* the pointer lights the edge of whatever card it is on */
(function(){ var raf=0, last=null; document.addEventListener('pointermove',function(e){ last=e; if(raf) return; raf=requestAnimationFrame(function(){ raf=0; var t=last.target; var c=t&&t.closest&&t.closest('.card,.c-band.dark'); if(!c) return; var r=c.getBoundingClientRect(); c.style.setProperty('--mx',(last.clientX-r.left)+'px'); c.style.setProperty('--my',(last.clientY-r.top)+'px'); }); },{passive:true}); })();

/* swipe a needs card on touch: right says yes, left says no */
function bindSwipe(w,c,done){
  var x0=0,y0=0,dx=0,on=false,lock=0,id=null,Wd=0;
  function down(e){ if(e.pointerType!=='touch'||(e.target.closest&&e.target.closest('.c-acts button'))) return; x0=e.clientX; y0=e.clientY; dx=0; lock=0; on=true; id=e.pointerId; Wd=c.offsetWidth; }
  function move(e){ if(!on||e.pointerId!==id) return; var mx=e.clientX-x0, my=e.clientY-y0;
    if(!lock){ if(Math.abs(mx)>8&&Math.abs(mx)>Math.abs(my)){ lock=1; try{ c.setPointerCapture(id); }catch(err){} c.classList.add('drag'); } else if(Math.abs(my)>10){ on=false; return; } else return; }
    dx=mx; c.style.translate=dx+'px 0'; w.classList.toggle('sl',dx>0); w.classList.toggle('sr',dx<0);
    var arm=Math.abs(dx)>Wd*.32; if(arm!==w.classList.contains('arm')){ w.classList.toggle('arm',arm); if(arm&&navigator.vibrate){ try{ navigator.vibrate(8); }catch(err){} } } }
  function up(e){ if(!on||e.pointerId!==id) return; on=false; c.classList.remove('drag'); if(!lock) return; var arm=Math.abs(dx)>Wd*.32;
    if(arm){ c.style.translate=(dx>0?Wd+40:-Wd-40)+'px 0'; done(dx>0?1:-1); } else { c.style.translate=''; w.classList.remove('sl','sr','arm'); } }
  c.addEventListener('pointerdown',down); c.addEventListener('pointermove',move); c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
  return function(){ c.removeEventListener('pointerdown',down); c.removeEventListener('pointermove',move); c.removeEventListener('pointerup',up); c.removeEventListener('pointercancel',up); };
}

````

### B4. shell.js (React reference)

The app frame: Side (glass sidebar), the phone capsule, TabBar, Menu, the gates, and App wiring live data, badges, the mark's mood and island news.

````js
/* REACT reference (React 18 + htm): the app frame with the glass sidebar, phone capsule, tab bar and menu.
   Port the markup and class names; keep this OS's own data hooks, auth and routing. */
/* ---------------- shell ---------------- */
function Gate(p){ return html`<div class="gate"><div class="gate-in"><div class="gmark"><${LiveMark} /></div><h1>${p.title}</h1><p>${p.text}</p></div></div>`; }
function JoinGate(p){ return html`<div class="gate"><div class="gate-in"><div class="gmark"><${LiveMark} /></div><h1>Hi ${p.name}</h1><p>${p.sent ? 'Request sent. '+p.founder+' adds you from the Desk, and the OS opens the next time you load this link.' : 'You\'re signed in, but not on the team roster yet.'}</p>${p.sent?null:html`<div class="row gap"><button class="btn" onClick=${p.onAsk}>Ask to join</button></div>`}</div></div>`; }
function Side(p){
  var ref=useRef(null);
  useEffect(function(){ SB.mount(ref.current); },[]);
  useEffect(function(){ SB.place(false); });
  var j=0;
  return html`<aside class="side" id="side" ref=${ref} aria-label="Pages">
    <button class="sbt" type="button" aria-label="m360, back to top" onClick=${function(){ MK.spin(); glide(0); }}><${LiveMark} /></button>
    <nav class="snav"><span class="sp sp-h"></span><span class="sp sp-a"></span><i class="here"></i>
      ${p.groups.map(function(g){ return html`<${React.Fragment} key=${g.g||'top'}>${g.g?html`<div class="sgl"><span>${g.g}</span></div>`:null}${g.items.map(function(n){ var jj=j++; return html`<button key=${n[0]} type="button" class=${cls('nv', p.page===n[0]&&'on')} data-t=${n[1]} data-k=${n[0]} style=${{'--j':jj}} aria-current=${p.page===n[0]?'page':null} onClick=${function(){ p.go(n[0]); }}>${n[2]}<span class="nl">${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}<//>`; })}
    </nav>
    <div class="sfoot">
      <button class="nv" id="sAsk" type="button" data-t="Ask m360" data-kb="⌘K" style=${{'--j':j}} onClick=${function(){ ISL.cmd(''); }}>${I.search}<span class="nl">Ask m360</span><kbd class="kb">⌘K</kbd></button>
      <button class="nv" id="sTog" type="button" data-t=${p.sbx?'Collapse':'Expand'} data-kb="[" aria-expanded=${p.sbx?'true':'false'} style=${{'--j':j+1}} onClick=${function(){ SB.toggle(); }}>${I.panel}<span class="nl">${p.sbx?'Collapse':'Expand'}</span></button>
      <button class="nv" type="button" data-t=${p.meName} style=${{'--j':j+2}} onClick=${function(){ p.go('people/'+p.meId); }}><${Av} prof=${p.me} size=${22} /><span class="nl">${p.meName}<small>${p.sub}</small></span></button>
    </div></aside>`;
}
function TabBar(p){
  var ref=useRef(null);
  useEffect(function(){ TB.place(ref.current); });
  useEffect(function(){ var f=function(){ TB.place(ref.current,true); }; addEventListener('resize',f); return function(){ removeEventListener('resize',f); }; },[]);
  return html`<nav class="tabbar" id="tabbar" ref=${ref} aria-label="Tabs"><div class="tbg lg"><span class="lens"></span>
    ${p.tabs.map(function(n){ return html`<button key=${n[0]} type="button" class=${cls('ptab', p.page===n[0]&&'on')} aria-current=${p.page===n[0]?'page':null} onClick=${function(){ p.go(n[0]); }}>${n[2]}<span>${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}
    <button type="button" class=${cls('ptab', p.moreOn&&'on')} onClick=${p.onMore}>${I.more}<span>More</span>${p.moreDot?html`<i class="tdot"></i>`:null}</button></div>
    <button class="tb-ask lg" type="button" aria-label="Ask m360" onClick=${function(){ ISL.cmd(''); }}>${I.search}</button></nav>`;
}
function Menu(p){
  var s=useState(false); var on=s[0], setOn=s[1]; var cb=useRef(p.onClose); cb.current=p.onClose; var gone=useRef(false);
  function close(){ if(gone.current) return; gone.current=true; setOn(false); setTimeout(function(){ cb.current(); },300); }
  useEffect(function(){ document.documentElement.classList.add('mn-open'); var r=requestAnimationFrame(function(){ requestAnimationFrame(function(){ setOn(true); }); });
    var f=function(e){ if(e.key==='Escape') close(); }; addEventListener('keydown',f);
    return function(){ cancelAnimationFrame(r); document.documentElement.classList.remove('mn-open'); removeEventListener('keydown',f); }; },[]);
  var j=0;
  return html`<div class=${cls('menu', on&&'open')} role="dialog" aria-modal="true" aria-label="Menu">
    <div class="menu-top"><span class="pm"><${LiveMark} /></span><button class="shx" type="button" aria-label="Close menu" onClick=${close}>${I.x}</button></div>
    <div class="menu-list">${p.groups.map(function(g){ return html`<div key=${g.g||'top'}>${g.g?html`<div class="grp">${g.g}</div>`:null}${g.items.map(function(n){ var jj=j++; return html`<button key=${n[0]} type="button" class=${cls('mi', p.page===n[0]&&'on')} style=${{'--j':jj}} onClick=${function(){ p.go(n[0]); close(); }}>${n[2]}<span>${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}</div>`; })}</div></div>`;
}

function App(){
  var pf=usePlatform(); var db=pf.mode==='ok'?pf.db:null; var meId=pf.me&&pf.me.id; var now=useNow(60000);
  var roster=useDocSnap(db,'roster/team'); var settingsDoc=useDocSnap(db,'settings/app');
  var C={}; ['checkin','eod','plan','review','rocks','feed','reacts','acks','kudos','leave','leavedec','tasks','projects','pitches','clients','handbook','candidates','pulse','ideas','votes','access','onboard','joinreq'].forEach(function(k){ C[k]=useColl(db,k); });
  var joinMine=useDocSnap(db, meId?'joinreq/'+meId:null);
  var evalsColl=useColl(pf.mode==='ok'&&pf.owner?db:null,'evals'); var evalsMine=useDocSnap(pf.mode==='ok'&&!pf.owner?db:null, meId?'evals/'+meId:null);
  var keeperPath=meId?'data/users/'+meId+'/keeper':null, finPath=meId?'data/users/'+meId+'/finance':null, statePath=meId?'data/users/'+meId+'/state':null;
  var keeper=useDocSnap(pf.mode==='ok'&&pf.owner?db:null, keeperPath); var finance=useDocSnap(pf.mode==='ok'&&pf.owner?db:null, finPath); var stateDoc=useDocSnap(db, statePath);
  var tb=useHash(''); var hash=tb[0], setHash=tb[1]; var boot=useRef(false);
  var mn=useState(false); var menu=mn[0], setMenu=mn[1];
  var sbS=useState(document.documentElement.classList.contains('sbx')); var sbx=sbS[0], setSbx=sbS[1];
  var seenEv=useRef(null);
  var w=useMemo(function(){ return db?mkWriter(db):null; },[db]);
  useEffect(function(){ var f=function(x){ setSbx(!!x); }; EVB.on('sb',f); return function(){ EVB.off('sb',f); }; },[]);
  useEffect(function(){ if(!db || !pf.owner || !roster.ready || boot.current) return; var m=(roster.data&&roster.data.members)||{}; if(!m[pf.me.id] || !m[pf.me.id].empId){ boot.current=true; var cur=clone(roster.data)||{members:{},nextEmp:1}; cur.members=cur.members||{}; var ex=cur.members[pf.me.id]||{}; if(!ex.empId){ ex.empId=cur.nextEmp||1; cur.nextEmp=(cur.nextEmp||1)+1; } cur.members[pf.me.id]=Object.assign({role:'founder', title:'Founder', pod:'', joined:todayStr(), active:true}, ex); cur.updated=Date.now(); w.set('roster/team', cur); } },[db, pf.owner, roster.ready, roster.data]);
  var rosterData=roster.data||{members:{},nextEmp:1}; var ids=orderIds(rosterData, activeIds(rosterData));
  var founderId=Object.keys(rosterData.members||{}).find(function(id){ return (rosterData.members[id]||{}).role==='founder'; })||(pf.owner&&pf.me?pf.me.id:null);
  var allIds=Object.keys(rosterData.members||{}); var extra=[]; Object.keys(C.tasks.map).forEach(function(k){ var o=C.tasks.map[k].owner; if(o&&allIds.indexOf(o)<0&&extra.indexOf(o)<0) extra.push(o); });
  Object.keys(C.joinreq.map).forEach(function(k){ if(allIds.indexOf(k)<0&&extra.indexOf(k)<0) extra.push(k); });
  var prof=useProfiles(pf.mode==='ok'?pf.user:null, allIds.concat(extra).concat(meId?[meId]:[]));
  var me=pf.me?pf.me.id:null; var isFounder=!!pf.owner; var mem=me?(rosterData.members||{})[me]:null;
  function nm(id){ if(id===me && pf.me && pf.me.name) return pf.me.name; return (prof[id]&&prof[id].name)||'Someone'; }
  var settings=Object.assign({}, DEF_SETTINGS, settingsDoc.data||{});
  var hbIds=Object.keys(C.handbook.map).sort(function(a,b){ return (C.handbook.map[a].order||99)-(C.handbook.map[b].order||99) || String(C.handbook.map[a].title).localeCompare(String(C.handbook.map[b].title)); });
  var pinKey=((C.feed.map[founderId]||{}).pinned)||null; var pinnedPost=null; if(pinKey){ var pp=pinKey.split(':'); var po=((C.feed.map[pp[0]]||{}).posts||[]).find(function(x){ return x.id===pp[1]; }); if(po) pinnedPost=Object.assign({uid:pp[0]}, po); }
  var evals = isFounder ? evalsColl.map : (evalsMine.data && me ? (function(){ var o={}; o[me]=evalsMine.data; return o; })() : {});
  var ctx={db:db, user:pf.user, mcp:pf.mcp, downloads:pf.downloads, permissions:pf.permissions, w:w, now:now, meId:me, meName:pf.me?pf.me.name:'', isFounder:isFounder, founderId:founderId, roster:rosterData, settings:settings, ids:ids.length?ids:(me?[me]:[]), prof:prof, nm:nm,
    keeperPath:keeperPath, finPath:finPath, statePath:statePath, keeper:keeper.data, finance:finance.data, state:stateDoc.data, evals:evals, hbIds:hbIds, pinnedPost:pinnedPost};
  Object.keys(C).forEach(function(k){ ctx[k]=C[k].map; });
  ctx.flags=useMemo(function(){ return me ? evaluateRules(ctx, now) : []; }, [now, me, C.checkin.map, C.eod.map, C.plan.map, C.review.map, C.tasks.map, C.pitches.map, C.projects.map, C.clients.map, C.candidates.map, C.acks.map, C.handbook.map, C.leave.map, C.leavedec.map, evals, settingsDoc.data, rosterData]);
  var ready=pf.mode==='ok' && roster.ready && settingsDoc.ready && (isFounder || (mem && mem.active!==false));
  var needs=ready?needsOf(ctx):[];
  var moodN=isFounder?needs.length:(ready?ctx.flags.filter(function(f){ return f.uid===me && f.sev!=='low'; }).length:0);
  useEffect(function(){ if(ready) MK.mood(moodN); });
  useEffect(function(){ if(!ready) return; var ev=liveEvents(ctx); var keys={}; ev.forEach(function(e){ keys[e.k]=1; });
    if(!seenEv.current){ seenEv.current=keys; return; }
    var fresh=ev.filter(function(e){ return !seenEv.current[e.k] && e.uid!==me && (e.at||0)>BOOT && (isFounder || e.cap==='feed' || (e.cap==='kudos' && e.to===me)); });
    seenEv.current=keys;
    fresh.slice(0,3).reverse().forEach(function(e){ ISL.notify(e.text, e.cap, function(){ if(CUR.go) CUR.go(e.go); }); }); });
  if(pf.mode==='loading') return html`<${Gate} title="Signing you in" text="Connecting to your Mask360 workspace." />`;
  if(pf.mode==='nohost') return html`<${Gate} title="Open this inside Claude" text="m360 OS runs at its claude.ai link. Sign in with your Mask360 Claude account and open the link you were sent." />`;
  if(pf.mode==='nocap') return html`<${Gate} title="Workspace unavailable" text="This view can't reach the Mask360 workspace. Reload, or open the link again from claude.ai." />`;
  if(pf.mode==='noid') return html`<${Gate} title="Sign in to continue" text="m360 OS needs your Mask360 Claude account. Sign in on claude.ai with your work account, then open the link again." />`;
  if(!roster.ready || !settingsDoc.ready) return html`<${Gate} title="Loading the workspace" text="One moment." />`;
  if(!isFounder && (!mem || mem.active===false)) return html`<${JoinGate} name=${first(pf.me.name)} founder=${(founderId&&prof[founderId]&&prof[founderId].name)||'Kaavish'} sent=${!!joinMine.data} onAsk=${function(){ w.set('joinreq/'+me, {at:Date.now()}, 'Request sent'); }} />`;
  var unreadHb=hbIds.filter(function(id){ return ((((C.acks.map[me]||{}).s)||{})[id]||0) < (C.handbook.map[id].updated||0); }).length;
  var pendLeave=0; if(isFounder){ Object.keys(C.leave.map).forEach(function(uid){ var d=((C.leavedec.map[uid]||{}).d)||{}; ((C.leave.map[uid]||{}).reqs||[]).forEach(function(r){ if(!d[r.id]) pendLeave++; }); }); }
  var myEvals=Object.keys(C.candidates.map).filter(function(cid){ var c=C.candidates.map[cid]; return c && !c.decision && (c.evaluators||[]).indexOf(me)>-1 && !((evals[me]||{}).e||{})[cid]; }).length;
  var parts=hash.split('/'); var page=parts[0]||(isFounder?'command':'today'); var sub=parts[1]||null;
  var NAV=[['today','Today',I.today,0,''],['tasks','My tasks',I.tasks,0,'work'],['projects','Projects',I.projects,0,'work'],['pitches','Pitches',I.pitches,0,'work'],['clients','Clients',I.brief,0,'work'],['feed','Feed',I.feed,0,'team'],['week','The week',I.week,0,'team'],['scores','Scores',I.scores,0,'team'],['people','People',I.people,0,'team'],['hiring','Hiring',I.hiring,myEvals,'team'],['handbook','Handbook',I.book,unreadHb,'team'],['voice','Voice',I.voice,0,'team'],['leave','Leave',I.leave,0,'team']];
  if(isFounder) NAV=[['command','Command',I.command,needs.length,'']].concat(NAV).concat([['desk','Desk',I.desk,pendLeave,'founder']]);
  var valid=NAV.map(function(n){ return n[0]; }); if(valid.indexOf(page)<0){ page=isFounder?'command':'today'; sub=null; }
  var TABS=isFounder?[['command','Command',I.command,needs.length],['today','Today',I.today,0],['tasks','Tasks',I.tasks,0],['week','Week',I.week,0]]:[['today','Today',I.today,0],['tasks','Tasks',I.tasks,0],['feed','Feed',I.feed,0],['week','Week',I.week,0]];
  var tabKeys=TABS.map(function(n){ return n[0]; }); var MORE=NAV.filter(function(n){ return tabKeys.indexOf(n[0])<0; });
  var go=function(k){ setHash(k); };
  var P={today:Today, tasks:Tasks, projects:Projects, pitches:Pitches, clients:Clients, feed:Feed, week:Week, scores:Scores, people:People, hiring:Hiring, handbook:Handbook, voice:Voice, leave:Leave, command:Command, desk:Desk};
  var Page=P[page]; var myTitle=(mem&&mem.title)||(isFounder?'Founder':'');
  var groups=[]; NAV.forEach(function(n){ var g=groups.find(function(x){ return x.g===n[4]; }); if(!g){ g={g:n[4], items:[]}; groups.push(g); } g.items.push(n); });
  CUR.ctx=ctx; CUR.go=go; CUR.page=page; CUR.hash=hash; CUR.nav=NAV;
  var label=(NAV.find(function(n){ return n[0]===page; })||[])[1]||'';
  return html`<div class="app">
    <${Side} groups=${groups} page=${page} go=${go} me=${pf.me} meId=${me} meName=${pf.me.name||'You'} sub=${[empIdOf(ctx,me), myTitle].filter(Boolean).join(', ')} sbx=${sbx} />
    <header class="pbar lg" id="pbar"><button class="pm" type="button" aria-label="m360, back to top" onClick=${function(){ MK.spin(); glide(0); }}><${LiveMark} /></button>
      <button class="where" type="button" aria-haspopup="dialog" aria-expanded=${menu?'true':'false'} onClick=${function(){ setMenu(true); }}><span>${label}</span>${I.chev}</button>
      <button class="mbtn" type="button" aria-label="Your profile" onClick=${function(){ go('people/'+me); }}><${Av} prof=${pf.me} size=${32} /></button></header>
    <main class="main" id="main"><${Page} key=${page+'/'+(sub||'')} ctx=${ctx} go=${go} id=${sub} /></main>
    <${TabBar} tabs=${TABS} page=${page} go=${go} moreOn=${MORE.some(function(n){ return n[0]===page; })} moreDot=${MORE.some(function(n){ return n[3]; })} onMore=${function(){ setMenu(true); }} />
    ${menu ? html`<${Menu} groups=${groups} page=${page} go=${go} onClose=${function(){ setMenu(false); }} />` : null}
  </div>`;
}
var root=ReactDOM.createRoot(document.getElementById('root')); root.render(html`<${App} />`);

````

### B5. command.js (React reference)

Command in the v7 layout on live data, section by section, with NeedCard (swipe, undo) and the viz helpers.

````js
/* REACT reference (React 18 + htm): Command rebuilt in the v7 layout on live data.
   Uses the artifact's helpers; map each to this OS's data using the Command data contract. */
/* ---------------- Command ---------------- */
function NeedCard(p){
  var ref=useRef(null); var g=useState(false); var leaving=g[0], setLeaving=g[1];
  var okR=useRef(p.onOk), noR=useRef(p.onNo); okR.current=p.onOk; noR.current=p.onNo;
  function act(which){ setLeaving(true); setTimeout(function(){ var f=which>0?okR.current:noR.current; Promise.resolve(f?f():true).then(function(ok){ if(ok===false){ setLeaving(false); var c=ref.current&&ref.current.querySelector('.c-nc'); if(c) c.style.translate=''; if(ref.current) ref.current.classList.remove('sl','sr','arm'); } }); },320); }
  useEffect(function(){ if(!p.swipe||!ref.current) return; var c=ref.current.querySelector('.c-nc'); return bindSwipe(ref.current,c,function(dir){ act(dir); }); },[p.swipe]);
  return html`<div class=${cls('c-ncw', leaving&&'going')} ref=${ref} style=${{'--j':p.j}}>
    ${p.swipe?html`<div class="c-nsw c-nsw-l cap" aria-hidden="true">${p.okLabel}</div><div class="c-nsw c-nsw-r cap" aria-hidden="true">${p.noLabel}</div>`:null}
    <article class=${cls('c-nc', p.hot&&'hotz')}>
      <div class="c-nt"><span class="cap">${p.tag}</span><span class="cap">${p.when}</span></div>
      <div class="c-who">${p.who}</div>
      <div class="c-ndt">${p.detail}</div>
      <div class="c-acts"><button class="btn" type="button" onClick=${function(){ if(p.okNav) p.onOk(); else act(1); }}>${p.okLabel}</button>${p.noLabel?html`<button class="lnkb" type="button" onClick=${function(){ if(p.noNav) p.onNo(); else act(-1); }}>${p.noLabel}</button>`:null}</div>
    </article></div>`;
}
function CmdHead(p){ return html`<div class="c-sh"><span class="c-eb"><i>${p.n}</i>${p.t}</span>${p.children||null}</div>`; }
function vzBars(arr,dense){ return html`<div class=${cls('vb', (dense||arr.length>14)&&'dense')}>${arr.slice(0,40).map(function(c,i){ return html`<i key=${i} class=${c||null} style=${{'--j':i}}></i>`; })}</div>`; }
function Command(p){
  var ctx=p.ctx; var t=todayStr(); var nowD=new Date(ctx.now); var team=ctx.ids; var y=ymd(addDays(nowD,-1)); for(var bk=1; bk<=7; bk++){ var dd=ymd(addDays(nowD,-bk)); if(team.some(function(id){ return isWorkingDay(ctx,id,dd); })){ y=dd; break; } } var yLab=y===ymd(addDays(nowD,-1))?'eod yesterday':'eod '+WD[parseYmd(y).getDay()].toLowerCase(); var wk=weekId(nowD); var mon=mondayOf(nowD); var nm=nowMin();
  var rf=useState(''); var ruleF=rf[0], setRuleF=rf[1];
  var sf=useState('all'); var sevF=sf[0], setSevF=sf[1];
  var fa=useState(false); var allF=fa[0], setAllF=fa[1];
  var af=useState(PEND.att||'all'); var attF=af[0], setAttF=af[1];
  var root=useRef(null), tkr=useRef(null);
  useEffect(function(){ PEND.att=null; var f=function(v){ setAttF(v||'all'); }; EVB.on('att',f); RV.scan(root.current); CMDP.mount(); return function(){ EVB.off('att',f); CMDP.unmount(); }; },[]);
  var st=ctx.settings; var lim=minutesOf(st.start||'10:30')+(st.grace||0);
  var working=team.filter(function(id){ return isWorkingDay(ctx,id,t); });
  var inToday=working.filter(function(id){ return checkinOf(ctx,id,t); });
  var notIn=working.filter(function(id){ return !checkinOf(ctx,id,t); });
  var late=inToday.filter(function(id){ return lateMins(ctx,id,checkinOf(ctx,id,t))>0; });
  var office=inToday.filter(function(id){ return checkinOf(ctx,id,t).mode==='office'; }); var verified=office.filter(function(id){ var l=checkinOf(ctx,id,t).loc; return l&&l.verified; });
  var yWorking=team.filter(function(id){ return isWorkingDay(ctx,id,y); }); var yEod=yWorking.filter(function(id){ return eodOf(ctx,id,y); });
  var marks=[]; team.forEach(function(id){ var plan=((((ctx.plan[id]||{}).weeks)||{})[wk]||{}).items||[]; var rv=((((ctx.review[id]||{}).weeks)||{})[wk]||{}).marks||{}; plan.forEach(function(it){ marks.push(rv[it.id]==='hit'?'':rv[it.id]==='miss'?'f':'g'); }); });
  var hit=marks.filter(function(m){ return m===''; }).length, missed=marks.filter(function(m){ return m==='f'; }).length;
  var overdueT=tasksOf(ctx).filter(function(x){ return x.status!=='done' && x.due && x.due<t; });
  var flagsAll=ctx.flags; var high=flagsAll.filter(function(f){ return f.sev==='high'; }).length;
  var PIPE=ansPipe(ctx); var L=ansLargest(ctx); var largest=L.tot?Math.round(100*L.rows[0][1]/L.tot):null; var E=ansEnergy(ctx);
  var needs=needsOf(ctx); var nmY=function(id){ return id===ctx.meId?'You':ctx.nm(id); };
  var hr=nowD.getHours(); var greet=(hr<5?'Up late':hr<12?'Good morning':hr<17?'Good afternoon':'Good evening')+', '+first(ctx.meName)+'.';
  var evs=liveEvents(ctx).filter(function(e){ return (e.at||0)>Date.now()-24*3600000; }).slice(0,6).map(function(e){ return e.text; });
  useEffect(function(){ CMDP.ticker(tkr.current, evs); });

  /* needs you */
  function decide(r,status){ var cur=clone(ctx.leavedec[r.uid])||{d:{}}; cur.d=cur.d||{}; cur.d[r.id]={status:status, at:Date.now()}; cur.d=pruneKeys(cur.d,120);
    return ctx.w.set('leavedec/'+r.uid, cur).then(function(ok){ if(ok) ISL.confirm((status==='approved'?'Approved, ':'Declined, ')+ctx.nm(r.uid), leaveRange(r), function(){ var c2=clone(CUR.ctx.leavedec[r.uid])||{d:{}}; if(c2.d) delete c2.d[r.id]; CUR.ctx.w.set('leavedec/'+r.uid, c2, 'Back in your queue'); }); return ok; }); }
  function dismissJoin(uid){ var at=(ctx.joinreq[uid]||{}).at||Date.now(); return ctx.w.del('joinreq/'+uid).then(function(ok){ if(ok) ISL.confirm('Dismissed, '+ctx.nm(uid), 'join request', function(){ CUR.ctx.w.set('joinreq/'+uid, {at:at}, 'Back in your queue'); }); return ok; }); }
  var shown=needs.slice(0,8);
  var needCards=shown.map(function(n,i){
    if(n.kind==='leave'){ var r=Object.assign({uid:n.uid}, n.r); var days=daysBetween(r.from,r.to)+1; var ty=(LTYPES.find(function(x){ return x[0]===r.type; })||['',''])[1];
      return html`<${NeedCard} key=${n.k} j=${i} swipe=${true} tag="leave" when=${'asked '+ago(r.at||Date.now())} who=${html`<button type="button" onClick=${function(){ p.go('people/'+n.uid); }}>${ctx.nm(n.uid)}</button>`} detail=${leaveRange(r)+', '+plural(days,'day')+(ty?', '+ty.toLowerCase():'')} okLabel="Approve" noLabel="Decline" onOk=${function(){ return decide(r,'approved'); }} onNo=${function(){ return decide(r,'declined'); }} />`; }
    if(n.kind==='join') return html`<${NeedCard} key=${n.k} j=${i} tag="join" when=${'asked '+ago(n.at||Date.now())} who=${ctx.nm(n.uid)} detail="Wants in on the OS. Add a title and pod on the Desk." okLabel="Add" noLabel="Dismiss" okNav=${true} onOk=${function(){ p.go('desk'); }} onNo=${function(){ return dismissJoin(n.uid); }} />`;
    if(n.kind==='decide') return html`<${NeedCard} key=${n.k} j=${i} tag="hire" when="panel done" who=${n.c.name||'Candidate'} detail=${(n.c.role||'')+', '+n.n+' of '+(n.c.evaluators||[]).length+' reads in'} okLabel="Decide" okNav=${true} onOk=${function(){ p.go('hiring/'+n.cid); }} />`;
    if(n.kind==='eval') return html`<${NeedCard} key=${n.k} j=${i} tag="evaluate" when=${n.c.deadline?'by '+fmtDay(n.c.deadline):'panel'} who=${n.c.name||'Candidate'} detail=${(n.c.role||'')+', your read is due'} okLabel="Evaluate" okNav=${true} onOk=${function(){ p.go('hiring/'+n.cid); }} />`;
    var f=n.f; return html`<${NeedCard} key=${n.k} j=${i} hot=${true} tag="flag" when="high" who=${html`<button type="button" onClick=${function(){ p.go(f.uid===ctx.meId?'today':'people/'+f.uid); }}>${nmY(f.uid)}</button>`} detail=${f.name+'. '+f.text} okLabel="Open" noLabel="Rule" okNav=${true} noNav=${true} onOk=${function(){ p.go(flagGo(f)); }} onNo=${function(){ p.go('handbook/'+f.section); }} />`;
  });

  /* numbers */
  var T0v=minutesOf(st.start||'10:30')-60, T1v=T0v+180; var vpos=function(m){ return clampN((m-T0v)/(T1v-T0v)*100,0,100).toFixed(2)+'%'; };
  var lateViz=html`<div class="vt">${[html`<i key="t0" class="t0" style=${{left:vpos(minutesOf(st.start||'10:30'))}}></i>`].concat(inToday.slice(0,30).map(function(id,i){ var c=checkinOf(ctx,id,t); return html`<i key=${id} class=${cls('d', lateMins(ctx,id,c)>0&&'f')} style=${{left:vpos(tsMin(c.in)),'--j':i}}></i>`; }))}</div>`;
  var verPct=office.length?Math.round(100*verified.length/office.length):null;
  var eFull=E.e!=null?Math.floor(E.e):0, eFrac=E.e!=null?E.e-eFull:0;
  var energyViz=html`<div class="ve">${[0,1,2,3,4].map(function(i){ var bg=i<eFull?null:(i===eFull&&eFrac>0?{background:'linear-gradient(to top,var(--ink) '+Math.round(eFrac*100)+'%,var(--g12) '+Math.round(eFrac*100)+'%)'}:null); return html`<i key=${i} class=${i<eFull||(i===eFull&&eFrac>0)?null:'g'} style=${Object.assign({'--j':i},bg||{})}></i>`; })}</div>`;
  var stOpen=['lead','qualified','diagnostic','proposal','negotiation']; var stW={}, stN={}; stOpen.forEach(function(s){ stW[s]=0; stN[s]=0; });
  Object.keys(ctx.pitches).forEach(function(k){ var x=ctx.pitches[k]; if(stW[x.stage]==null) return; stW[x.stage]+=pitchValue(ctx,k).weighted; stN[x.stage]++; });
  var pipeViz=html`<div class="vs">${PIPE.w?stOpen.filter(function(s){ return stW[s]>0; }).map(function(s,i){ return html`<i key=${s} style=${{width:(100*stW[s]/PIPE.w).toFixed(2)+'%','--a':(.3+.7*(STAGE_PROB[s]||10)/75).toFixed(2),'--j':i}}></i>`; }):html`<i style=${{width:'100%','--a':.12}}></i>`}</div>`;
  var meter=function(pct,hotM,mark){ return html`<div class="vm">${mark?html`<i class="mk25" style=${{left:'25%'}}></i><span class="vml" style=${{left:'calc(25% + 6px)'}}>25%</span>`:null}<i class=${cls('fill', hotM&&'f')} style=${{width:clampN(pct||0,0,100)+'%'}}></i></div>`; };
  var num=function(v,o){ return html`<span class=${cls('c-num', o&&o.long&&'long', o&&o.word&&'word')} style=${{'--i':o&&o.i||0}}>${v}</span>`; };
  var after=nm>lim;
  var T=[
    ['people',{k:'in',l:'in today',v:num(html`${inToday.length}<span>/${working.length}</span>`,{i:0}),viz:vzBars(working.map(function(id){ return checkinOf(ctx,id,t)?'':'g'; })),c:notIn.length?(after?'Not in: ':'Still to come: ')+names(notIn.map(nmY)):(working.length?'Everyone is in':'Nobody working today'),hot:after&&notIn.length>0,go:function(){ showAt('command','#c-att .c-tr.rw',{att:notIn.length?'none':'all'}); }}],
    ['people',{k:'late',l:'late today',v:num(late.length,{i:1}),viz:lateViz,c:late.length?names(late.map(ctx.nm)):'Nobody late',hot:late.length>0,go:function(){ showAt('command','#c-att .c-tr.rw',{att:late.length?'late':'all'}); }}],
    ['people',{k:'ver',l:'office verified',v:verPct!=null?num(html`${verPct}<span>%</span>`,{i:2}):num('none yet',{i:2,word:1}),viz:meter(verPct||0,false),c:office.length?verified.length+' of '+office.length+' office check-ins':'No office check-ins yet',hot:false,go:function(){ showAt('command','#c-att .c-tr.rw',{att:'office'}); }}],
    ['people',{k:'eod',l:yLab,v:num(html`${yEod.length}<span>/${yWorking.length}</span>`,{i:3}),viz:vzBars(yWorking.map(function(id){ return eodOf(ctx,id,y)?'':'g'; })),c:yWorking.length&&yEod.length<yWorking.length?'Missing: '+names(yWorking.filter(function(id){ return !eodOf(ctx,id,y); }).map(nmY)):(yWorking.length?'Everyone posted':'Nobody worked yesterday'),hot:false,go:function(){ p.go('week'); }}],
    ['mood',{k:'mood',l:'team energy',v:E.e!=null?num(html`${E.e.toFixed(1)}<span>/5</span>`,{i:4}):num('none yet',{i:4,word:1}),viz:energyViz,c:E.e!=null?'Week '+weekNum(E.lw)+', '+plural(E.n,'reply','replies'):'No pulse yet',hot:E.e!=null&&E.e<3,go:function(){ showAt('command','#c-vox'); }}],
    ['work',{k:'out',l:'outcomes hit',v:num(html`${hit}<span>/${marks.length}</span>`,{i:5}),viz:vzBars(marks),c:marks.length?'This week'+(missed?', '+missed+' missed':''):'No outcomes posted yet',hot:false,go:function(){ p.go('week'); }}],
    ['work',{k:'due',l:'tasks overdue',v:num(overdueT.length,{i:6}),viz:vzBars(overdueT.map(function(x){ return daysBetween(x.due,t)>3?'f':''; }),true),c:overdueT.length?'Across the team':'Nothing overdue',hot:overdueT.length>0,go:function(){ p.go('tasks'); }}],
    ['work',{k:'hf',l:'high flags',v:num(high,{i:7}),viz:vzBars(flagsAll.map(function(f){ return f.sev==='high'?'f':f.sev==='medium'?'':'s'; }),true),c:plural(flagsAll.length,'flag')+' in total',hot:high>0,go:function(){ showAt('command','#c-flg'); }}],
    ['money',{k:'pipe',l:'weighted pipeline',v:num(inr(PIPE.w),{i:8,long:1}),viz:pipeViz,c:'A month, '+plural(PIPE.n,'open pitch','open pitches'),hot:false,go:function(){ showAt('command','#c-pipe'); }}],
    ['money',{k:'cl',l:'largest client',v:largest!=null?num(html`${largest}<span>%</span>`,{i:9}):num('none yet',{i:9,word:1}),viz:meter(largest||0,largest!=null&&largest>25,true),c:largest!=null?(ctx.clients[L.rows[0][0]].name||'Client')+', share of revenue':'No revenue set',hot:largest!=null&&largest>25,go:function(){ showAt('command',largest!=null?'#c-cli [data-id="'+L.rows[0][0]+'"]':'#c-cli'); }}]
  ];
  var GL={people:'people',mood:'mood',work:'work',money:'money'}; var seenG={};
  var tile=function(g,o){ var firstOf=!seenG[g]; seenG[g]=1; return html`<button type="button" key=${o.k} class=${cls('c-kp', o.hot&&'hot hotz')} onClick=${o.go}>${firstOf?html`<i class="c-kgl">${GL[g]}</i>`:null}<span class="c-kl"><span class="cap">${o.l}</span><i class="go"></i></span><span class="c-kvb">${o.v}</span><span class="c-viz">${o.viz}</span><span class="c-kn">${o.c}</span></button>`; };

  /* attendance */
  var STS=minutesOf(st.start||'10:30'); var A0=Math.floor((STS-60)/60)*60; var A1=Math.max(A0+240, Math.min(1440, Math.ceil((nm+30)/60)*60)); if(A1-A0>720) A0=A1-720;
  var apos=function(m){ return clampN((m-A0)/(A1-A0)*100,0,100); };
  var attRows=team.map(function(id){ var ci=checkinOf(ctx,id,t); var s=statusOf(ctx,id,t); var lm=ci?lateMins(ctx,id,ci):0; var wkd=isWorkingDay(ctx,id,t);
    var f=['all']; if(ci){ f.push(ci.mode==='wfh'?'wfh':'office'); if(lm) f.push('late'); } else if(s==='leave'||s==='holiday') f.push('leave'); else if(wkd) f.push('none');
    return {id:id, ci:ci, s:s, lm:lm, f:f, wkd:wkd}; });
  var cnt=function(k){ return attRows.filter(function(r){ return r.f.indexOf(k)>-1; }).length; };
  var chips=[['all','All'],['office','Office'],['wfh','WFH'],['late','Late'],['none','Not in'],['leave','Leave']];
  var labs=[[A0,pad(Math.floor(A0/60))+':00',''],[STS,'start '+(st.start||'10:30'),'']].concat(nm>=A0&&nm<=A1?[[nm,'now','al']]:[]).concat([[A1,pad(Math.floor(A1/60)%24)+':00','']]);
  labs.sort(function(a,b){ return a[0]-b[0]; }); var keep=[];
  labs.forEach(function(lb){ var prev=keep[keep.length-1]; if(!prev || apos(lb[0])-apos(prev[0])>=11){ keep.push(lb); return; } if(lb[2]==='al') keep[keep.length-1]=lb; });
  var dayCell=function(r,i){ var out=[html`<i key="g" class="g10" style=${{left:apos(STS)+'%'}}></i>`]; if(nm>=A0&&nm<=A1) out.push(html`<i key="n" class="gn" style=${{left:apos(nm)+'%'}}></i>`);
    if(r.ci){ var a=tsMin(r.ci.in), b=r.ci.out?tsMin(r.ci.out):nm; out.push(html`<i key="b" class=${cls('b', !r.ci.out&&'live')} style=${{left:apos(a)+'%',width:Math.max(.6,apos(b)-apos(a))+'%','--j':i}}></i>`); out.push(html`<i key="o" class="ot" style=${{left:apos(a)+'%'}}>in ${hm(r.ci.in)}${r.ci.out?', out '+hm(r.ci.out):''}</i>`); if(r.lm) out.push(html`<i key="l" class="lt" style=${{left:apos(a)+'%'}}></i>`); }
    else if(r.wkd && r.s==='none' && nm>lim) out.push(html`<i key="d" class="nd" style=${{left:apos(Math.min(nm,A1))+'%'}}></i>`);
    return html`<span class="c-day c-dayc">${out}</span>`; };
  var rowsShown=attRows.filter(function(r){ return r.f.indexOf(attF)>-1; });

  /* flags */
  var fl=flagsAll.filter(function(f){ return (!ruleF||f.rule===ruleF) && (sevF==='all'||f.sev===sevF); });
  var sevN=function(s){ return flagsAll.filter(function(f){ return (!ruleF||f.rule===ruleF) && (s==='all'||f.sev===s); }).length; };

  /* business */
  var lb=rankAll(ctx,'week',ctx.now).rows.slice(0,5); var lbMax=Math.max(1, lb.length?Math.max.apply(null, lb.map(function(r){ return Math.max(0,r.total); })):1);
  var stMax=Math.max.apply(null, stOpen.map(function(s){ return PIPE.w?stW[s]:stN[s]; }).concat([1]));
  var nextOver=Object.keys(ctx.pitches).filter(function(k){ var x=ctx.pitches[k]; return x.nextDate&&x.nextDate<t&&x.stage!=='won'&&x.stage!=='lost'; }).length;
  var projs=Object.keys(ctx.projects).filter(function(k){ var x=ctx.projects[k]; return !x.archived && x.status!=='done'; }); var ph={on:0,risk:0,off:0}; projs.forEach(function(k){ var s=ctx.projects[k].status||'on'; ph[s]=(ph[s]||0)+1; });
  var shaky=projs.filter(function(k){ return (ctx.projects[k].status||'on')!=='on'; }).sort(function(a,b){ return (ctx.projects[a].status==='off'?0:1)-(ctx.projects[b].status==='off'?0:1); });

  /* team */
  var mid=monthId(nowD); var keeperNotes=((ctx.keeper||{}).notes)||{};
  var crew=team.filter(function(id){ return id!==ctx.founderId; });
  var cands=Object.keys(ctx.candidates).filter(function(k){ return !ctx.candidates[k].decision && ctx.candidates[k].stage!=='hired' && ctx.candidates[k].stage!=='rejected'; });
  var pulses=Object.keys(ctx.pulse).map(function(k){ return ctx.pulse[k]; }).sort(function(a,b){ return (b.at||0)-(a.at||0); }).filter(function(x){ return x.change||x.broken||x.working; }).slice(0,2);

  /* clients */
  var fin=((ctx.finance||{}).clients)||{}; var cids=Object.keys(ctx.clients).sort(function(a,b){ return ((fin[b]||{}).monthly||0)-((fin[a]||{}).monthly||0) || String(ctx.clients[a].name).localeCompare(String(ctx.clients[b].name)); });
  var openOf=function(k){ return tasksOf(ctx).filter(function(x){ return x.client===k&&x.status!=='done'; }).length; };

  return html`<div class="page cmd" ref=${root}>
    <header class="c-top">
      <div class="c-tl">
        <div class="lab">${fmtLong(nowD).toLowerCase()}, week ${weekNum(wk)}</div>
        <h1>Command</h1>
        <p class="c-lede"><span>${greet}</span>${needs.length?html`<button type="button" class="c-needl" onClick=${function(){ showAt('command','#c-need .c-nc'); }}><b>${plural(needs.length,'thing needs you','things need you')}</b><i class="ar"></i></button>`:html`<span class="c-needl ok">All clear.</span>`}</p>
      </div>
      <div class="c-tr2">
        <button type="button" class="c-askf" onClick=${function(e){ ISL.cmd('', e.currentTarget.getBoundingClientRect()); }}>${I.search}<span class="phd">Ask m360 or jump to anything</span><kbd class="kb">⌘K</kbd></button>
        <div class="c-live"><span class="chip cap"><i></i>live</span><div class="c-tkr" ref=${tkr} aria-live="polite" dangerouslySetInnerHTML=${{__html:''}}></div></div>
      </div>
    </header>

    <section class="c-sec" id="c-need">
      <${CmdHead} n="01" t="needs you">${needs.length?html`<span class="c-pl">${needs.length} open</span>`:null}<//>
      ${needs.length?html`<div class="c-ngrid">${needCards}</div>${needs.length>shown.length?html`<p class="c-more">And ${needs.length-shown.length} more in the flags below.</p>`:null}`
        :html`<div class="c-clear"><span class="ok">${I.check}</span><div><b>All clear.</b><p>Nothing needs you right now. Approvals and high flags land here.</p></div></div>`}
    </section>

    <section class="c-sec rv" id="c-nums">
      <${CmdHead} n="02" t="numbers"><button type="button" class="c-pl" onClick=${function(){ p.go('week'); }}>The week</button><//>
      <div class="c-kpis">
        <div class="c-kg" style=${{gridColumn:'span 4'}}>people</div><div class="c-kg">mood</div>
        ${T.slice(0,5).map(function(x){ return tile(x[0],x[1]); })}
        <div class="c-kg k2" style=${{gridColumn:'span 3'}}>work</div><div class="c-kg k2" style=${{gridColumn:'span 2'}}>money</div>
        ${T.slice(5).map(function(x){ return tile(x[0],x[1]); })}
      </div>
    </section>

    <section class="c-band warm rv" id="c-att">
      <div class="stack" style=${{gap:'24px'}}>
        <div class="card">
          <${CmdHead} n="03" t="attendance today"><button type="button" class="c-pl" onClick=${function(){ p.go('desk'); }}>Export</button><//>
          <div class="c-fcs" role="tablist">${chips.map(function(c){ var n=cnt(c[0]); var al=(c[0]==='late'&&n>0)||(c[0]==='none'&&n>0&&after); return html`<button key=${c[0]} type="button" class=${cls('c-fc', attF===c[0]&&'on')} onClick=${function(){ setAttF(c[0]); }}>${c[1]}<b class=${al?'al':null}>${n}</b></button>`; })}</div>
          <div class="c-atb">
            <div class="c-tr hd"><span class="c-id">id</span><span>person</span><span>status</span><span class="c-place">place</span><span>in</span><span class="c-dh c-dayc">${keep.map(function(lb){ return html`<i key=${lb[1]} class=${lb[2]||null} style=${{left:apos(lb[0])+'%'}}>${lb[1]}</i>`; })}</span></div>
            ${rowsShown.length?rowsShown.map(function(r,i){ var l=r.ci&&r.ci.loc;
              return html`<div class="c-tr rw c-lk c-fresh" key=${r.id} role="button" tabIndex="0" onClick=${function(){ p.go('people/'+r.id); }} onKeyDown=${function(e){ if(e.key==='Enter') p.go('people/'+r.id); }}>
                <span class="c-id mut sm tn">${empIdOf(ctx,r.id)}</span>
                <span class="c-person"><${Av} prof=${ctx.prof[r.id]} size=${24} /><span class="c-nm">${ctx.nm(r.id)}</span></span>
                <span class=${r.s==='none'&&r.wkd&&after?'flt':null}>${r.s==='none'&&!r.wkd?'Off today':STATUS_LABEL[r.s]}</span>
                <span class="c-pl2 c-place">${l?html`<span>${l.place}</span>${l.lat!=null&&!l.verified?html`<a class="lnk sm" href=${'https://www.google.com/maps?q='+l.lat+','+l.lng} target="_blank" rel="noopener noreferrer" onClick=${function(e){ e.stopPropagation(); }}>Map</a>`:null}${l.verified?null:html`<span class="c-vf">unverified</span>`}`:html`<span class="soft">${r.ci?'No location':''}</span>`}</span>
                <span class=${cls('tn', r.lm&&'flt')}>${r.ci?hm(r.ci.in):''}</span>
                ${dayCell(r,i)}<i class="go"></i></div>`; }):html`<p class="c-empty">Nobody here.<small>Try another filter.</small></p>`}
          </div>
        </div>
        <div class="card" id="c-flg">
          <${CmdHead} n="04" t="flags"><select class="sel mini" value=${ruleF} onChange=${function(ev){ setRuleF(ev.target.value); }} aria-label="Filter by rule"><option value="">All rules</option>${RULE_IDS.map(function(r){ return html`<option key=${r} value=${r}>${r} ${RULE_NAMES[r]}</option>`; })}</select><//>
          <div class="c-fcs">${[['all','All'],['high','High'],['medium','Medium'],['low','Low']].map(function(c){ var n=sevN(c[0]); return html`<button key=${c[0]} type="button" class=${cls('c-fc', sevF===c[0]&&'on')} onClick=${function(){ setSevF(c[0]); }}>${c[1]}<b class=${c[0]==='high'&&n>0?'al':null}>${n}</b></button>`; })}</div>
          ${fl.length?html`<div class="c-fls">${fl.slice(0,allF?60:8).map(function(f,i){ return html`<button type="button" class="c-fl c-hl c-lk" key=${f.rule+f.uid+i} onClick=${function(){ p.go(flagGo(f)); }}><span class=${cls('sev', f.sev)}></span><span><b><span class="c-nm">${nmY(f.uid)}</span>, ${f.name}</b><p>${f.text}</p></span><i class="go"></i></button>`; })}</div>${fl.length>8?html`<div class="c-fcs"><button type="button" class="c-pl" onClick=${function(){ setAllF(!allF); }}>${allF?'Show fewer':'Show all '+fl.length}</button></div>`:null}`
            :html`<p class="c-empty">All clear.<small>${flagsAll.length?'Nothing at this filter.':'The rules are quiet.'}</small></p>`}
        </div>
      </div>
    </section>

    <section class="c-band dark rv" id="c-biz">
      <div class="c-g543">
        <div id="c-lb">
          <${CmdHead} n="05" t="leaderboard, this week"><button type="button" class="c-pl" onClick=${function(){ p.go('scores'); }}>Scores</button><//>
          ${lb.length?lb.map(function(r,i){ return html`<button type="button" class=${cls('c-lbr c-hl c-lk', i===0&&'first')} key=${r.uid} onClick=${function(){ p.go('people/'+r.uid); }}><span class="rk dsoft">${i+1}</span><span class="whom"><span class="c-nm">${ctx.nm(r.uid)}</span><span class="ln" style=${{'--w':Math.max(4,Math.round(100*Math.max(0,r.total)/lbMax))+'%'}}></span></span><span class="c-pts">${r.total}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">No scores yet.<small>${crew.length?'Points land as the week moves.':'Add your team from the Desk to start the board.'}</small></p>`}
        </div>
        <div id="c-pipe">
          <${CmdHead} n="06" t="pipeline"><button type="button" class="c-pl" onClick=${function(){ p.go('pitches'); }}>Open</button><//>
          <div class="c-pls"><div class="v" data-n=${Math.round(PIPE.w)} data-fmt="inr" data-v=${inr(PIPE.w)}>${inr(PIPE.w)}</div><div class="cap">weighted, a month, ${plural(PIPE.n,'open pitch','open pitches')}</div></div>
          ${stOpen.map(function(s,i){ var w=PIPE.w?stW[s]:stN[s]; return html`<button type="button" class="c-ppr c-hl c-lk" key=${s} onClick=${function(){ p.go('pitches'); }}><span class="c-ppt"><span class="c-nm">${STAGE_LABEL[s]}</span><b>${stN[s]}${stW[s]?', '+inr(stW[s]):''}</b></span><span class="c-ppb"><i style=${{'--w':(stMax?Math.round(100*w/stMax):0)+'%','--a':(.3+.7*(STAGE_PROB[s]||10)/75).toFixed(2),'--j':i}}></i></span><i class="go"></i></button>`; })}
          <div class="c-kvr"><span class="dsoft">Next steps overdue</span><b class=${nextOver?'flt':null}>${nextOver}</b></div>
        </div>
        <div id="c-proj">
          <${CmdHead} n="07" t="projects"><button type="button" class="c-pl" onClick=${function(){ p.go('projects'); }}>Open</button><//>
          <div class="c-pjs"><div><div class="v" data-n=${ph.on} data-v=${String(ph.on)}>${ph.on}</div><div class="cap">on track</div></div><div><div class="v" data-n=${ph.risk} data-v=${String(ph.risk)}>${ph.risk}</div><div class="cap">${ph.risk?html`<i class="adot"></i>`:null}at risk</div></div><div><div class="v" data-n=${ph.off} data-v=${String(ph.off)}>${ph.off}</div><div class="cap">${ph.off?html`<i class="adot"></i>`:null}off track</div></div></div>
          ${shaky.length?shaky.slice(0,5).map(function(k){ var x=ctx.projects[k]; var pg=projProgress(ctx,k); var off=x.status==='off'; return html`<button type="button" class="c-pjr c-hl c-lk" key=${k} onClick=${function(){ p.go('projects/'+k); }}><span class="c-pjt"><span class="grow c-nm">${x.name}</span><b class="tn">${pg.pct}%</b></span><span class="c-pjb"><i class=${off?'off':null} style=${{'--p':pg.pct+'%'}}></i></span><span class=${cls('c-pst', off?'flt':'dsoft')}>${off?'Off track':'At risk'}${x.due?', due '+fmtDay(x.due):''}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">${projs.length?'Every live project is on track.':'No live projects.'}</p>`}
        </div>
      </div>
    </section>

    <section class="c-sec rv" id="c-team">
      <div class="c-g444">
        <div>
          <${CmdHead} n="08" t="people"><button type="button" class="c-pl" onClick=${function(){ p.go('desk'); }}>Desk</button><//>
          ${crew.length?crew.slice(0,12).map(function(id){ var mi=missesLast30(ctx,id); var lv=Math.min(3,mi); var kd=(keeperNotes[id]||{})[mid]; var m=memberOf(ctx,id); var ob=m.joined&&daysBetween(m.joined,t)<=45?onboardState(ctx,id):null; var off=(ctx.access[id]||{}).offboard;
              return html`<button type="button" class="c-per c-hl c-lk" key=${id} onClick=${function(){ p.go('people/'+id); }}><span class="c-person"><${Av} prof=${ctx.prof[id]} size=${24} /><span class="c-nm">${ctx.nm(id)}</span></span><span class="c-tags"><span class=${lv>=2?'al':lv===1?'k':null}>${LADDER[lv].toLowerCase()}</span>, ${kd&&kd.fight&&kd.rehire?html`<span class="k">keeper done</span>`:'keeper due'}${ob?', onboarding '+ob.pct+'%':''}${off?html`, <span class="al">offboarding</span>`:null}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">Just you so far.<small>Add your team from the Desk and they show up here.</small></p>`}
        </div>
        <div id="c-hire">
          <${CmdHead} n="09" t="hiring"><button type="button" class="c-pl" onClick=${function(){ p.go('hiring'); }}>Open</button><//>
          ${cands.length?cands.slice(0,6).map(function(k){ var c=ctx.candidates[k]; var n=Object.keys(evalsFor(ctx,k)).length; var of=(c.evaluators||[]).length; return html`<button type="button" class="c-hir c-hl c-lk" key=${k} onClick=${function(){ p.go('hiring/'+k); }}><span><span class="c-nm">${c.name}</span><span class="c-sub">${c.role}</span></span><span class="c-ev"><span class="c-ticks">${Array.from({length:Math.max(of,1)}).map(function(_,i){ return html`<i key=${i} class=${i<n?'on':null}></i>`; })}</span><span class="sm">${n}/${of}</span></span><i class="go"></i></button>`; })
            :html`<p class="c-empty">Nobody in the panel.<small>New candidates get an independent read here.</small></p>`}
        </div>
        <div id="c-vox">
          <${CmdHead} n="10" t="voice"><button type="button" class="c-pl" onClick=${function(){ p.go('voice'); }}>Open</button><//>
          ${pulses.length?pulses.map(function(x,i){ return html`<div class="c-q c-hl" key=${i}><blockquote>${x.change||x.broken||x.working}</blockquote><div class="c-sub">Energy ${x.energy} of 5, week ${weekNum(x.week)}, anonymous</div></div>`; })
            :html`<p class="c-empty">No pulse yet.<small>The team answers one pulse a week, anonymously.</small></p>`}
        </div>
      </div>
    </section>

    <section class="c-sec rv" id="c-cli">
      <${CmdHead} n="11" t="clients"><button type="button" class="c-pl" onClick=${function(){ p.go('clients'); }}>Open</button><//>
      <div class="c-share">${L.tot?cids.filter(function(k){ return (fin[k]||{}).monthly; }).map(function(k,i){ var v=(fin[k]||{}).monthly||0; var pc=100*v/L.tot; return html`<i key=${k} title=${ctx.clients[k].name} style=${{width:pc.toFixed(2)+'%',background:i===0&&pc>25?'var(--flame)':'rgba(14,14,14,'+Math.max(.18,.9-i*.16).toFixed(2)+')'}}></i>`; }):html`<i style=${{width:'100%',background:'var(--g12)'}}></i>`}</div>
      ${cids.length?html`<div class="c-ct hd"><span>client</span><span class="c-own">owner</span><span class="c-open">open</span><span class="c-brain">brain</span><span>revenue</span></div>
        ${cids.map(function(k){ var c=ctx.clients[k]; var rev=(fin[k]||{}).monthly||0; var comp=['memory','approvals','never'].filter(function(f){ return c[f]; }).length; var o=openOf(k);
          return html`<div class="c-ct rw c-lk" key=${k} data-id=${k} role="button" tabIndex="0" onClick=${function(){ openReq('clients',k); }} onKeyDown=${function(e){ if(e.key==='Enter') openReq('clients',k); }}><span><span class="c-nm">${c.name}</span>${c.status&&c.status!=='live'?html` <span class="soft sm">${c.status}</span>`:null}</span><span class="c-own mut">${c.owner?ctx.nm(c.owner):'No owner'}</span><span class="c-open tn">${o}</span><span class="c-brain"><span class="c-dots">${[0,1,2].map(function(i){ return html`<i key=${i} class=${i<comp?'on':null}></i>`; })}</span></span><span>${rev?html`<span class="rvn">${inr(rev)}</span> <span class="soft sm">${Math.round(100*rev/L.tot)}%</span>`:html`<span class="soft">No revenue set</span>`}</span><i class="go"></i></div>`; })}
        ${L.tot?html`<div class="c-ct tot"><span>Total</span><span class="c-own"></span><span class="c-open tn">${cids.reduce(function(s,k){ return s+openOf(k); },0)}</span><span class="c-brain"></span><span><span class="rvn">${inr(L.tot)}</span> a month</span></div>`:null}`
        :html`<p class="c-empty">No clients yet.<small>Add the first one on Clients.</small></p>`}
    </section>

    <nav class="c-rail" id="c-rail" aria-label="Sections"><span class="c-rtr"><i></i></span>${CMDP.sec.map(function(s,i){ return html`<button key=${s[0]} type="button" class="c-ri" style=${{'--k':i}} aria-label=${s[1]} onClick=${function(){ CMDP.go(i); }}><span class="c-rl">${s[1]}</span></button>`; })}</nav>
  </div>`;
}

````

### B6. sheet-and-avatar.js (React reference)

The glass sheet that replaces every drawer (scrim, Esc, drag to close on phone) and initials avatars on ink.

````js
/* REACT reference: every drawer becomes the glass sheet; avatars are initials on ink. */
var GSN=0;
function Drawer(p){
  var s=useState(false); var on=s[0], setOn=s[1]; var ref=useRef(null); var cb=useRef(p.onClose); cb.current=p.onClose; var gone=useRef(false);
  function close(){ if(gone.current) return; gone.current=true; setOn(false); setTimeout(function(){ cb.current(); },300); }
  useEffect(function(){
    var f=function(ev){ if(ev.key==='Escape' && !ISL.isCmd()) close(); }; window.addEventListener('keydown',f);
    GSN++; document.documentElement.classList.add('gs-open');
    var r1=requestAnimationFrame(function(){ requestAnimationFrame(function(){ setOn(true); }); });
    var lt=setTimeout(function(){ if(ref.current) MK.lookAt(ref.current,1200); },260);
    var sh=ref.current, g=sh&&sh.querySelector('.grab'), y0=0, dy=0, drag=false;
    var dn=function(e){ drag=true; y0=e.clientY; dy=0; sh.classList.add('drag'); try{ g.setPointerCapture(e.pointerId); }catch(err){} };
    var mv=function(e){ if(!drag) return; dy=Math.max(0,e.clientY-y0); sh.style.transform='translate3d(0,'+dy+'px,0)'; };
    var up=function(){ if(!drag) return; drag=false; sh.classList.remove('drag'); if(dy>90){ sh.style.transform='translate3d(0,calc(100% + 24px),0)'; close(); } else sh.style.transform=''; };
    if(g){ g.addEventListener('pointerdown',dn); g.addEventListener('pointermove',mv); g.addEventListener('pointerup',up); g.addEventListener('pointercancel',up); }
    return function(){ window.removeEventListener('keydown',f); cancelAnimationFrame(r1); clearTimeout(lt); GSN=Math.max(0,GSN-1); if(!GSN) document.documentElement.classList.remove('gs-open');
      if(g){ g.removeEventListener('pointerdown',dn); g.removeEventListener('pointermove',mv); g.removeEventListener('pointerup',up); g.removeEventListener('pointercancel',up); } };
  },[]);
  return html`<div class="gs-wrap"><div class=${cls('gs-scrim', on&&'on')} onClick=${close}></div>
    <div class=${cls('gs', p.wide&&'wide', on&&'on')} role="dialog" aria-modal="true" aria-label=${p.title} ref=${ref}>
      <div class="grab" aria-hidden="true"></div>
      <div class="gs-h"><h2>${p.title}</h2><button class="shx" type="button" aria-label="Close" onClick=${close}>${I.x}</button></div>
      <div class="gs-in">${p.children}</div></div></div>`;
}

function ini(n){ var w=String(n||'').trim().split(/\s+/).filter(Boolean); if(!w.length) return ''; return (w[0][0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase(); }
function Av(p){ var pr=p.prof||{}; var sz=p.size||32; var st={width:sz+'px',height:sz+'px',fontSize:Math.max(9,Math.round(sz*.36))+'px'};
  if(pr.avatarUrl && /^(data|blob):/.test(pr.avatarUrl)) return html`<img class="av" src=${pr.avatarUrl} alt="" width=${sz} height=${sz} style=${st} />`;
  var t=ini(pr.name); return html`<span class=${cls('av', !t&&'av0')} style=${st} aria-hidden="true">${t}</span>`; }

````
