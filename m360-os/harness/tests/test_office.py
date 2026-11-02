#!/usr/bin/env python3
"""v33 test: the virtual office and the COO mascot (spec part P, selectors in part O6).

A working Tuesday next week at 11:20 IST, the COO on. Durvesh is in, Aanya works from home, Ishaan is on
leave (casual), Ekta came in late. The ledger has the morning's rows (open, the roll call, a leave approval).

Checks:
- #office renders one scene (.office[data-scope]) with the twelve stations as buttons (.office-station
  [data-key]), a desk per active member (.office-desk[data-uid][data-state]) and exactly one mascot: v40
  retires the robot, so the COO is drawn as the m360 mark (.office-mascot .mark, always black) with its tap
  target named "m360 COO", and nothing is drawn in the corner dock (the canvas checks for 4K are retired);
- it pauses: while the page is hidden, and with the office scrolled off screen, nothing in it animates;
- reduced motion: no animation runs in the office and the mascot is a still frame;
- no sideways scroll at 390 px; it reads in dark mode;
- a member sees the team scope: no names, numbers, late, quiet, leave types, reasons or money in any
  bubble, the run list or a desk tag ("Away today" for Ishaan, never "casual");
- honesty: a row still running moves nothing; a settled row does;
- a burst: ten settled rows at once play at most six steps, then one summary bubble ("And 4 more ...").

Fails until builder 5 (90-office.js) and builder 1 (M.coo) are merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_office.py
"""
import os
import re
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4 = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4'
BOT = 'u_m360coo'
SHOTS = os.environ.get('COO_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'coo')
STATIONS = ['attendance', 'calendar', 'board', 'review', 'desk', 'meeting', 'clients', 'mail', 'tray', 'books', 'reception', 'clock']
# what the team must never read in the office: names, the leave type, reasons, marks, money
PRIVATE = re.compile(r'Durvesh|Aanya|Ishaan|Ekta|Kaavish|casual|sick|overload|late|quiet|₹|INR|invoice|Swisse|\d', re.I)
RUNNING = '''() => { const o = document.querySelector('.office'); if (!o) return -1;
  return document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && o.contains(a.effect.target)).length; }'''


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()

    def ms(hh, mm, day=0):
        return int((datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)).timestamp() * 1000)

    def ctx_page(dsf=1, width=1280, height=900, reduced=False, clock=(11, 20)):
        c = h.browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dsf, locale='en-IN', timezone_id='Asia/Kolkata',
                                  reduced_motion='reduce' if reduced else 'no-preference')
        c.add_init_script("localStorage.setItem('m360.office.mode','flat')")
        h.contexts.append(c)
        c.clock.set_fixed_time(datetime(tue.year, tue.month, tue.day, clock[0], clock[1], tzinfo=IST))
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        return p

    def row(i, job, code, station, args, refs, at, status='done'):
        return {'at': at, 'slot': 'w1100', 'job': job, 'cap': None, 'rung': 'alone', 'code': code, 'station': station, 'subject': 'x:' + i,
                'args': args, 'refs': refs, 'why': {'code': '', 'args': {}}, 'checks': [], 'facts': [], 'before': {}, 'after': {}, 'told': [], 'status': status}

    def seed(p):
        p.goto(h.url('founder', '#home', reset=True, seed=True))
        h.ready(p)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        h.roster(p, [M1, M2, M3, M4], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1'}, M3: {'pod': 'Pod 2'}, M4: {'pod': 'Pod 2', 'title': 'Ekta Shah'}})
        office = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}
        h.seed_doc(p, 'checkin/' + M1, {'days': {today: {'in': ms(10, 22), 'out': None, 'mode': 'office', 'loc': office, 'outLoc': None}}})
        h.seed_doc(p, 'checkin/' + M2, {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'wfh', 'loc': None, 'outLoc': None}}})
        h.seed_doc(p, 'checkin/' + M4, {'days': {today: {'in': ms(11, 5), 'out': None, 'mode': 'office', 'loc': office, 'outLoc': None}}})
        h.seed_doc(p, 'leave/' + M3, {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'type': 'casual', 'at': ms(9, 0, -3)}]})
        h.seed_doc(p, 'leavedec/' + M3, {'d': {'L1': {'status': 'approved', 'at': ms(9, 0, -2), 'by': F}}})
        # every slot of the day already settled, so the founder's own page runner adds no rows of its own
        p.wait_for_function('() => !!(window.M && M.coo && M.coo.plan && M.lastCtx && M.lastCtx.activeMembers.length > 3)')
        p.evaluate('''d => { const P = M.coo.plan; const ids = P.slotList(P.stateOf(M.lastCtx, Date.now()).slots).map(x => x.id);
          window.__db.set('coo/slots-' + d, Object.fromEntries(ids.map(id => [id, {state: 'done', at: Date.now(), acts: 0}]))); }''', today)
        s = p.evaluate('() => window.__db.get("settings/app") || {}')
        s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -9), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
        h.seed_doc(p, 'settings/app', s)
        h.seed_doc(p, 'coo/L-' + today, {'acts': {
            'r_open': row('r_open', 'J01', 'open', 'clock', {}, {}, ms(9, 0)),
            'r_roll': row('r_roll', 'J03', 'roll', 'attendance', {'n': 3, 'wfh': 1, 'leave': 1, 'notIn': 0}, {}, ms(10, 45)),
            'r_leave': row('r_leave', 'J10', 'leave_ok', 'calendar', {'uid': M3, 'd1': today, 'd2': today, 'left': 5, 'out': 1, 'type': 'casual'}, {'uid': M3, 'req': 'L1'}, ms(10, 50))}})
        h.seed_doc(p, 'office/live', {'v': 1, 'state': 'idle', 'job': '', 'station': 'desk', 'at': ms(11, 0), 'next': {'slot': 'w1130', 'at': ms(11, 30)}, 'pass': {'at': ms(11, 15), 'by': 'page'}, 'seq': 1})
        h.seed_doc(p, 'coo/now', {'state': 'idle', 'job': '', 'station': 'desk', 'at': ms(11, 15), 'pass': {'at': ms(11, 15), 'slot': 'w1115', 'by': 'page'}, 'recent': []})
        p.wait_for_timeout(400)

    def open_office(p, ident='founder'):
        p.goto(h.url(ident, '#office'))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.lastCtx.activeMembers.length > 3)')
        if not p.evaluate('() => !!(M.pages && M.pages.Office && M.office && M.coo)'):
            raise AssertionError('the office is not on the page: this test runs once builders 5 and 1 are merged')
        p.wait_for_selector('.office[data-scope] .office-mascot .mark svg', timeout=20000)
        p.wait_for_timeout(800)

    os.makedirs(SHOTS, exist_ok=True)
    p = ctx_page()
    seed(p)
    open_office(p)

    # ---- the scene ----
    keys = p.evaluate('() => [...document.querySelectorAll(".office .office-station[data-key]")].map(b => [b.dataset.key, b.tagName])')
    check(sorted(k for k, _ in keys) == sorted(STATIONS) and all(t == 'BUTTON' for _, t in keys), 'the twelve stations, each a button: %r' % keys)
    all_desks = p.evaluate('() => [...document.querySelectorAll(".office .office-desk[data-uid]")].map(d => [d.dataset.uid, d.dataset.state, d.dataset.place])')
    desks = {u: st for u, st, pl in all_desks if pl != 'cabin'}
    cabin = [u for u, st, pl in all_desks if pl == 'cabin']
    check(set(desks) >= {M1, M2, M3, M4} and F not in desks and BOT not in [u for u, _, _ in all_desks], 'a desk per member, none for the COO: %r' % all_desks)
    check(cabin in ([], [F]), 'Kaavish sits in the cabin, never at a bench: %r' % cabin)
    check(desks.get(M3) == 'leave' and desks.get(M2) == 'wfh' and desks.get(M1) in ('office', 'in'), 'the desks read the day: %r' % desks)
    n = p.evaluate('() => [document.querySelectorAll(".office-mascot").length, document.querySelectorAll(".office-mascot .mark svg").length, document.querySelectorAll(".office canvas.office-bot, .office-mascot canvas").length]')
    hit = p.evaluate('() => (document.querySelector(".office-mascot-hit") || {}).getAttribute ? document.querySelector(".office-mascot-hit").getAttribute("aria-label") : ""')
    dock = p.evaluate('() => document.querySelectorAll("#buddy-dock canvas").length')
    check(n == [1, 1, 0] and 'COO' in (hit or '') and dock == 0, 'one mascot, the m360 mark with no robot, its tap named for the COO, nothing in the dock: %r' % [n, hit, dock])
    check(p.evaluate('() => document.querySelector(".office").getAttribute("role") === "region" || !!document.querySelector(".office [role=region], [role=region] .office")'), 'the scene is a region')
    p.screenshot(path=os.path.join(SHOTS, 'office-1280-light.png'))
    check(p.evaluate('() => !!document.querySelector("#office-run")') or p.locator('button', has_text='List').count() > 0, 'the list view (#office-run) is one tap away')

    # ---- honesty: running moves nothing, settled does ----
    # the mascot's place and pose, from its own data attributes (a seated pose changes its box, not its place)
    where = '() => { const m = document.querySelector(".office-mascot"); return [m.dataset.spot, m.dataset.state]; }'
    p.evaluate('''() => { window.__spots = []; window.__spotAt = Date.now(); const m = document.querySelector('.office-mascot');
      new MutationObserver(() => { window.__spotAt = performance.now(); window.__spots.push([m.dataset.spot, m.dataset.state]); })
        .observe(m, {attributes: true, attributeFilter: ['data-spot', 'data-state']}); window.__spotAt = performance.now(); }''')
    # whatever the first look plays, it plays out first: the mascot at rest for four seconds
    p.wait_for_function('() => performance.now() - window.__spotAt > 4000 && document.querySelector(".office-mascot").dataset.state !== "walking"', timeout=60000, polling=250)
    before = p.evaluate(where)
    p.evaluate('() => { window.__spots = []; }')
    p.evaluate('([d, r]) => { const doc = window.__db.get("coo/L-" + d); doc.acts.r_run = r; window.__db.set("coo/L-" + d, doc); }',
               [today, row('r_run', 'J31', 'rebalance', 'board', {'n': 1}, {}, ms(11, 19), status='running')])
    p.wait_for_timeout(4000)
    p.wait_for_timeout(600)
    seen = p.evaluate('() => window.__spots.slice()')
    check(all(sp == before[0] and st != 'walking' for sp, st in seen) and p.evaluate(where)[0] == before[0], 'a row still running moves nothing: %r' % [before, seen])
    p.evaluate('d => { const doc = window.__db.get("coo/L-" + d); doc.acts.r_run.status = "done"; doc.acts.r_run.at = Date.now(); window.__db.set("coo/L-" + d, doc); }', today)
    moved = False
    for _ in range(16):
        p.wait_for_timeout(500)
        p.wait_for_timeout(250)
        seen = p.evaluate('() => window.__spots.slice()')
        if any(st == 'walking' or sp == 'board' for sp, st in seen):
            moved = True
            break
    check(moved, 'a settled row sends the mascot to its station')

    # ---- it pauses: hidden, and off screen ----
    p.evaluate('''() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange')); }''')
    p.wait_for_timeout(500)
    check(p.evaluate(RUNNING) == 0, 'nothing in the office animates while the page is hidden: %r' % p.evaluate('''() => { const o = document.querySelector('.office');
      return document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && o.contains(a.effect.target)).map(a => [a.effect.target.className, a.animationName || a.id || '', a.effect.getTiming().duration, a.effect.getTiming().iterations]); }'''))
    p.evaluate('''() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange')); }''')

    # ---- dark ----
    tone = '() => { const o = getComputedStyle(document.querySelector(".office")); const b = getComputedStyle(document.body); return [o.backgroundColor, b.backgroundColor, b.color]; }'
    lt = p.evaluate(tone)
    p.emulate_media(color_scheme='dark')
    p.wait_for_timeout(500)
    p.screenshot(path=os.path.join(SHOTS, 'office-1280-dark.png'))
    dk = p.evaluate(tone)
    check(dk != lt and dk[1] != dk[2], 'it turns with the theme and reads in dark: %r' % [lt, dk])
    p.emulate_media(color_scheme='light')

    # ---- 390 ----
    p.set_viewport_size({'width': 390, 'height': 844})
    p.wait_for_timeout(700)
    check(h.overflow(p) <= 0, 'no sideways scroll at 390')
    p.screenshot(path=os.path.join(SHOTS, 'office-390.png'))
    p.set_viewport_size({'width': 1280, 'height': 900})

    # ---- Home: the studio window pauses off screen ----
    p.goto(h.url('founder', '#home'))
    h.ready(p)
    # RELIEF R14: the studio fold starts closed for Kaavish too; he looks in
    p.wait_for_selector('#studio-look')
    check(p.locator('#studio-now .office-window').count() == 0, 'the studio starts closed on Home')
    p.click('#studio-look')
    p.wait_for_selector('#studio-now .office-window')
    p.wait_for_timeout(800)
    win = p.evaluate('() => !!document.querySelector(".office-window")')
    if win:
        p.evaluate('() => { const w = document.querySelector(".office-window"); window.scrollTo(0, w.getBoundingClientRect().bottom + window.scrollY + 2000); }')
        p.evaluate('() => { const s = document.createElement("div"); s.style.height = "4000px"; document.body.appendChild(s); window.scrollTo(0, document.body.scrollHeight); }')
        p.wait_for_timeout(800)
        off = p.evaluate('''() => { const w = document.querySelector('.office-window'); if (!w) return 0;
          return document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && w.contains(a.effect.target)).length; }''')
        check(off == 0, 'a window scrolled off screen does not animate')
    check(win, 'Home carries the studio window (.office-window)')

    # ---- a member's office: team scope ----
    open_office(p, 'm1')
    check(p.evaluate('() => document.querySelector(".office").dataset.scope') == 'team', 'a member sees the team scope')
    texts = p.evaluate('''() => ({bubbles: [...document.querySelectorAll('.office-bubble')].map(b => b.innerText),
      tags: [...document.querySelectorAll('.office-desk')].map(d => d.innerText), run: (document.querySelector('#office-run') || {}).innerText || ''})''')
    leaky = [t for t in texts['bubbles'] if PRIVATE.search(t)]
    check(not leaky, 'no name, number, late, quiet, leave type, reason or money in a member\'s bubbles: %r' % leaky)
    check(not re.search(r'casual|sick|late|quiet|overload', ' '.join(texts['tags']), re.I), 'desk tags never say a leave type, late or quiet: %r' % texts['tags'])
    check(not PRIVATE.search(re.sub(r'\b\d{1,2}:\d{2}\b', '', texts['run'])), 'the run list carries no names or reasons for a member: %r' % texts['run'][:200])
    p.screenshot(path=os.path.join(SHOTS, 'office-member.png'))

    # ---- v39: a member's station drawers say what the COO does there, and the task board is never blank ----
    def drawer(k):
        p.locator('.office-station[data-key="%s"]' % k).first.evaluate('e => e.click()')
        p.wait_for_selector('.office-drawer[data-station="%s"]' % k, timeout=10000)
        t = p.locator('.office-drawer[data-station="%s"]' % k).inner_text()
        p.keyboard.press('Escape')
        p.wait_for_timeout(300)
        return t
    att, board = drawer('attendance'), drawer('board')
    check('Doing the morning roll call.' not in att and 'The COO takes the morning roll call here.' in att,
          'v39: the attendance drawer says what happens there while the COO is at its desk: %r' % att[:120])
    check('The COO tidies the task board here.' in board and re.search(r'You have \d+ open|Nothing open for you\.', board),
          'v39: a member\'s task board drawer carries a line of its own: %r' % board[:160])

    # ---- v39: emotes are timed from when they arrive, whatever the sender's clock says ----
    em = p.evaluate('''() => { const see = M.character.emoteClock(), now = Date.now();
      const coll = map => ({ready: true, map});
      const a = see(coll({u1: {emote: {e: 'wave', at: now - 60000}}}), now);
      const b = see(coll({u1: {emote: {e: 'wave', at: now - 30000}}, u2: {emote: {e: 'five', at: now + 120000}}}), now + 1000);
      const c = see(coll({u1: {emote: {e: 'wave', at: now - 30000}}, u2: {emote: {e: 'five', at: now + 120000}}}), now + 20000);
      return {load: a[0].seen - now, behind: b.find(x => x.uid === 'u1').seen - now, ahead: b.find(x => x.uid === 'u2').seen - now,
        later: c.map(x => x.seen - now)}; }''')
    check(em['load'] == -60000 and em['behind'] == 1000 and em['ahead'] == 1000 and em['later'] == [1000, 1000],
          'v39: an emote already there places by its own at; one that changes is timed from its arrival: %r' % em)

    # ---- v39: 3D name tags tell people apart ----
    tags = p.evaluate('''() => { const n = {a: 'Rahul Sharma', b: 'Rahul Verma', c: 'Rahul Singh', d: 'Rahul Shah', e: 'Aanya Rao', f: 'Staff 11', g: 'Staff 12'};
      return M.office3d.tagNames(Object.keys(n), u => n[u]); }''')
    check(tags == {'a': 'Rahul Sharma', 'b': 'Rahul V.', 'c': 'Rahul Singh', 'd': 'Rahul Shah', 'e': 'Aanya', 'f': 'Staff 11', 'g': 'Staff 12'},
          'v39: a shared first name takes an initial, or the whole name where the initial matches too: %r' % tags)

    # ---- a burst: six steps, then one summary ----
    open_office(p)
    # v39: the founder's #office (HQ > Office) opens on the office, with no HQ hero or checklist above it
    hq = p.evaluate('() => ({hero: document.querySelectorAll(".hero").length, setup: document.querySelectorAll("#fold-setup").length, top: Math.round(document.querySelector(".office-head").getBoundingClientRect().top + window.scrollY)})')
    check(hq['hero'] == 0 and hq['setup'] == 0 and hq['top'] < 260, 'v39: HQ > Office starts with the office: %r' % hq)
    p.evaluate('''() => { window.__bubbles = []; const seen = new Set();
      new MutationObserver(() => document.querySelectorAll('.office-bubble').forEach(b => { const t = b.innerText.trim(); if (t && !seen.has(t)) { seen.add(t); window.__bubbles.push(t); } }))
        .observe(document.body, {subtree: true, childList: true, characterData: true}); }''')
    burst = {}
    for i in range(10):
        burst['b%d' % i] = row('b%d' % i, 'J16', 'review_ask', 'review', {'task': 'none', 'uid': M1, 'to': M2, 'day': today}, {'uid': M1}, 0)
    p.evaluate('([d, rows]) => { const doc = window.__db.get("coo/L-" + d); const now = Date.now(); Object.keys(rows).forEach((k, i) => { rows[k].at = now - 1000 + i; doc.acts[k] = rows[k]; }); window.__db.set("coo/L-" + d, doc); }', [today, burst])
    summary = None
    for _ in range(120):
        p.wait_for_timeout(1000)
        p.wait_for_timeout(120)
        got = p.evaluate('() => window.__bubbles.slice()')
        hit = [x for x in got if re.search(r'And \d+ more', x)]
        if hit:
            summary = (got, hit[0])
            break
    check(summary is not None, 'a burst ends in one summary bubble')
    steps = [x for x in summary[0][:summary[0].index(summary[1])] if 'review' in x.lower() or 'Asked' in x]
    check(len(steps) <= 6 and 'And 4 more' in summary[1], 'at most six steps play, then "And 4 more": %r' % (summary,))

    # ---- v40: the 4K canvas checks are retired with the robot; the mark is vector at any ratio ----
    q = ctx_page(dsf=3)
    seed(q)
    open_office(q)
    check(q.evaluate('() => document.querySelectorAll(".office-mascot canvas").length') == 0, 'at a ratio of 3 the mascot is the vector mark, no canvas')
    q.screenshot(path=os.path.join(SHOTS, 'office-1280-dpr3.png'))
    q.context.close()

    # ---- reduced motion: a still frame ----
    r = ctx_page(reduced=True)
    seed(r)
    open_office(r)
    r.evaluate('d => { const doc = window.__db.get("coo/L-" + d); doc.acts.rm = {...doc.acts.r_roll, at: Date.now(), code: "eod", job: "J04", station: "desk"}; window.__db.set("coo/L-" + d, doc); }', today)
    r.wait_for_timeout(2000)
    r.wait_for_timeout(500)
    check(r.evaluate(RUNNING) == 0, 'under reduced motion nothing in the office animates')
    # the row plays (a fade to its station, a bubble) and the mascot rests again: then it holds still
    r.evaluate('''() => { window.__spotAt = performance.now(); const m = document.querySelector('.office-mascot');
      new MutationObserver(() => { window.__spotAt = performance.now(); }).observe(m, {attributes: true, attributeFilter: ['data-spot', 'data-state', 'class']}); }''')
    r.wait_for_function('() => performance.now() - window.__spotAt > 4000', timeout=60000, polling=250)
    # the mark's own place and transform, so a bubble folding nearby is not read as the mascot moving
    frame = '() => { const m = document.querySelector(".office-mascot .mark"); const r = m.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), getComputedStyle(m).transform]; }'
    a = r.evaluate(frame)
    r.wait_for_timeout(1500)
    r.wait_for_timeout(400)
    b = r.evaluate(frame)
    check(a == b, 'the mascot is a still frame under reduced motion')
    r.context.close()

    # ---- v39: a second founder sees the looks and is never offered a restyle of anyone ----
    a = ctx_page()
    seed(a)
    # Aanya as a roster founder who can edit the room: a founder, never the owner
    a.evaluate('u => { const r = window.__db.get("roster/team"); r.members[u].role = "founder"; window.__db.set("roster/team", r); }', M2)
    a.wait_for_timeout(300)
    a.goto(h.url('m2', '#character', edit=True))
    h.ready(a)
    a.wait_for_selector('#cast-admin', timeout=20000)
    adm = a.evaluate('() => ({owner: !!M.lastCtx.isOwner, founder: !!M.lastCtx.isFounder, buttons: document.querySelectorAll("#cast-admin button").length})')
    check(adm == {'owner': False, 'founder': True, 'buttons': 0}, 'v39: a second founder sees Characters with no Restyle, Lock or Unlock: %r' % adm)
    a.goto(h.url('m2', '#office', edit=True))
    h.ready(a)
    a.wait_for_selector('.office-desk[data-uid="%s"]' % M1, timeout=20000)
    a.locator('.office-desk[data-uid="%s"]' % M1).first.evaluate('e => e.click()')
    a.wait_for_selector('.office-drawer[data-uid="%s"]' % M1, timeout=10000)
    btns = a.evaluate('() => [...document.querySelectorAll("[role=dialog] button")].map(b => b.innerText.trim())')
    check('Character' not in btns, 'v39: and a desk drawer offers that founder no Character button: %r' % btns)
    a.context.close()

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
