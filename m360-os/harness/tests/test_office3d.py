#!/usr/bin/env python3
"""v35 test: the office in 3D (spec part M), forced on under SwiftShader at 720x480 and a device pixel ratio of 1.

The default harness draws the office flat (a software renderer reads as flat), so every check here forces 3D with
FORCE_3D and moves the page clock to test_office.py's working Tuesday with travel(), which keeps page timers and
animation frames real. Checks, numbered as part M:
 1. #office draws data-render="3d" and reaches data-office3d="ready" within 30 s;
 2. the DOM contract: the twelve stations as buttons in the owner scope, a desk button per member with its
    data-uid, data-state and data-place, one .office-founder, the mascot with data-spot and data-state around its
    hit button, the one .office-sr, the List button, and #office-run in list mode;
 3. honesty: a row still running moves nothing; once it settles the COO walks to the task board;
 4. ten settled rows at once play at most six steps, then "And 4 more";
 5. zero frames at idle: M.office3d.state().frames holds for 3 s once the scene settles;
 6. the loop stops while the page is hidden (during a COO walk), off screen and behind a drawer;
 7. reduced motion is flat, no WebGL2 is flat, and a lost context is flat within 3 s;
 8. a member: no composer, no Arrange, a click on the floor and W A S D leave Kaavish where he is, and the COO's
    bubble and the desk tags pass test_office.py's PRIVATE words (his own .office-say is his to share);
 9. Kaavish: a desk button walks him there (presence o3.s goes up) and opens DeskDrawer on arrival; W A S D on the
    floor moves him and typed into an input moves nothing;
10. Arrange by keyboard: two benches swapped writes office/plan once at rev + 1, and a second page sees the new
    layout, in 3D and flat;
11. no sideways scroll at 390 x 700;
12. no console errors.
Also: the windows (the HQ brief, the COO hero, Home's studio) draw in 3D on a desktop and flat on a phone.

Run: cd m360-os && python3 harness/tests/test_office3d.py
"""
import os
import re
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run, FORCE_3D, travel, office_world, office_row  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4 = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4'
SHOTS = os.environ.get('COO_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'office3d')
STATIONS = ['attendance', 'calendar', 'board', 'review', 'desk', 'meeting', 'clients', 'mail', 'tray', 'books', 'reception', 'clock']
# test_office.py's words a member must never read in the office
PRIVATE = re.compile(r'Durvesh|Aanya|Ishaan|Ekta|Kaavish|casual|sick|overload|late|quiet|₹|INR|invoice|Swisse|\d', re.I)
READY = '.office[data-render="3d"][data-office3d="ready"]'
# nothing moving (no walk, no camera, no crowd being built) and no frame drawn for 1.5 s
SETTLED = '''() => { const s = M.office3d.state(), m = document.querySelector('.office-mascot'), w = window.__o3w || (window.__o3w = {f: -1, at: 0});
  if (s.frames !== w.f) { w.f = s.frames; w.at = performance.now(); }
  return s.ready && !s.paused && !s.building && !s.moving && !!m && m.dataset.state !== 'walking' && performance.now() - w.at > 1500; }'''
FRAMES = '() => M.office3d.state().frames'
HIDE = '''v => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => v ? 'hidden' : 'visible'});
  Object.defineProperty(document, 'hidden', {configurable: true, get: () => v}); document.dispatchEvent(new Event('visibilitychange')); }'''
# a point on screen where the canvas itself (not a label) shows the floor
FLOOR_PT = '''() => { const a = M.office3d.api(); const L = M.office.layout(M.lastCtx); const r = a.canvas.getBoundingClientRect();
  for (const q of [{x: 980, y: 780 + L.grow}, {x: 600, y: 200}, {x: 300, y: 200}, {x: 980, y: 460}, {x: 250, y: 600}]) {
    const s = a.toScreen(q, 0); const x = r.left + s.x, y = r.top + s.y;
    if (s.visible && document.elementFromPoint(x, y) === a.canvas) return {x, y}; }
  return null; }'''
# one page of a context drawn flat while the others force 3D (the preference is shared through localStorage)
PAGE_FLAT = '''(() => { const gi = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { return k === 'm360.office.mode' ? 'flat' : gi.call(this, k); }; })();'''
PARTS = set(filter(None, os.environ.get('O3_PARTS', '').split(',')))


def part(name):
    return not PARTS or name in PARTS


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    clock = travel(datetime(tue.year, tue.month, tue.day, 11, 16, tzinfo=IST))
    os.makedirs(SHOTS, exist_ok=True)

    def ms(hh, mm):
        return int(datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST).timestamp() * 1000)

    def until(p, js, msg, arg=None, timeout=10000, polling=200):
        """wait for js to hold in the page; a wait that runs out fails with what it was waiting for"""
        try:
            p.wait_for_function(js, arg=arg, timeout=timeout, polling=polling)
        except Exception:
            raise AssertionError(msg)

    def office(p, ident='founder', timeout=30000):
        """#office in 3D, scrolled into view; the seconds from the app's start to the scene's first full frame"""
        p.goto(h.url(ident, '#office'))
        h.ready(p)
        t0 = time.time()
        until(p, 's => !!document.querySelector(s)', '%s: #office never drew in 3D in %d s' % (ident, timeout // 1000), arg=READY, timeout=timeout)
        took = time.time() - t0
        p.evaluate('() => document.querySelector(".office").scrollIntoView({block: "start"})')
        p.wait_for_function('() => !M.office3d.state().paused', timeout=timeout, polling=200)
        return took

    def settle(p, timeout=60000):
        try:
            p.wait_for_function(SETTLED, timeout=timeout, polling=250)
        except Exception:
            raise AssertionError('the scene never settled: %r' % p.evaluate('() => [M.office3d.state(), (document.querySelector(".office-mascot") || {}).dataset]'))

    def more_frames(p, n=2, timeout=20000):
        f0 = p.evaluate(FRAMES)
        p.wait_for_function('n => M.office3d.state().frames >= n', arg=f0 + n, timeout=timeout, polling=100)

    def held(p, ms_):
        """the frame count over ms_ of real time: [before, after]"""
        f0 = p.evaluate(FRAMES)
        p.wait_for_timeout(ms_)
        return [f0, p.evaluate(FRAMES)]

    c = h.context(init=[FORCE_3D, clock])
    p = h.page(c)
    today = office_world(h, p, tue)
    took = office(p)

    # ---- 1. 3D, ready ----
    check(p.evaluate('() => M.office3d.state().mode') == '3d' and took < 30, '1. #office draws in 3D and is ready in %.1f s' % took)

    # ---- 2. the DOM contract ----
    dom = p.evaluate('''() => { const o = document.querySelector('.office');
      const m = o.querySelector('.office-mascot[data-spot][data-state]');
      return {region: [o.getAttribute('role'), o.getAttribute('aria-label'), o.dataset.scope],
        stations: [...o.querySelectorAll('button.office-station[data-key]')].map(b => b.dataset.key),
        desks: [...o.querySelectorAll('button.office-desk[data-uid][data-state][data-place]')].map(b => b.dataset.uid),
        founder: [...o.querySelectorAll('button.office-founder[data-uid][data-state][data-place][data-live]')].map(b => b.dataset.uid),
        mascot: !!(m && m.querySelector(':scope > button.office-mascot-hit[aria-label]')), sr: document.querySelectorAll('.office-sr').length,
        canvas: [...o.querySelectorAll('.office-view canvas.office-gl')].map(c => [c.getAttribute('aria-hidden'), c.tabIndex, c.getAttribute('aria-label')])}; }''')
    check(dom['region'] == ['region', 'The office', 'owner'], '2. one region, "The office", owner scope: %r' % dom['region'])
    check(sorted(dom['stations']) == sorted(STATIONS), '2. the twelve stations, each a button: %r' % dom['stations'])
    check(sorted(dom['desks']) == [M1, M2, M3, M4] and dom['founder'] == [F], '2. a desk button per member and one .office-founder: %r' % [dom['desks'], dom['founder']])
    check(dom['mascot'] and dom['sr'] == 1, '2. the mascot around its hit button, and one .office-sr')
    check(dom['canvas'] == [['true', 0, 'The office floor. Use W A S D to walk.']], '2. one canvas, hidden from readers, in the tab order, with his words: %r' % dom['canvas'])
    p.get_by_role('tab', name='List', exact=True).click()
    p.wait_for_selector('#office-run', timeout=10000)
    check(p.locator('#office-run').count() == 1 and p.locator('.office-gl').count() == 0, '2. List shows #office-run in the scene\'s place')
    p.get_by_role('tab', name='Office', exact=True).click()
    p.wait_for_selector(READY, timeout=30000)
    p.evaluate('() => document.querySelector(".office").scrollIntoView({block: "start"})')
    p.screenshot(path=os.path.join(SHOTS, 'office3d-720.png'))

    # ---- 5. zero frames at idle ----
    if part('idle'):
        # v37: office life walks someone over now and then; idle here means with it switched off on this device
        p.evaluate("() => M.prefs.set('office.life', 'off')")
        settle(p)
        f = held(p, 3000)
        check(f[0] == f[1], '5. no frame at idle over 3 s: %r' % f)

    # ---- 6. the loop stops: off screen and behind a drawer (hidden is checked during a walk, below) ----
    if part('pause'):
        settle(p)
        # something that would animate forever: the loop now runs until the page cannot be seen
        p.evaluate('() => { window.__spin = M.office3d.api().tick(function spin() { return true; }); }')
        more_frames(p)
        p.evaluate('() => window.scrollTo(0, 0)')
        p.evaluate('() => { const s = document.createElement("div"); s.id = "o3-spacer"; s.style.height = "3000px"; document.body.appendChild(s); window.scrollTo(0, document.body.scrollHeight); }')
        until(p, '() => M.office3d.state().paused', '6. the office never paused off screen', polling=100)
        f = held(p, 2000)
        check(f[0] == f[1], '6. no frame while the office is scrolled off screen: %r' % f)
        p.evaluate('() => { document.getElementById("o3-spacer").remove(); document.querySelector(".office").scrollIntoView({block: "start"}); }')
        more_frames(p)
        p.evaluate('() => M.office3d.api().drawers.station("board")')
        p.wait_for_selector('.scrim', timeout=10000)
        until(p, '() => M.office3d.state().paused', '6. the office never paused behind a drawer', polling=100)
        f = held(p, 2000)
        check(f[0] == f[1], '6. no frame behind a drawer: %r' % f)
        p.keyboard.press('Escape')
        p.wait_for_function('() => !document.querySelector(".scrim")', timeout=10000)
        more_frames(p)
        p.evaluate('() => window.__spin()')

    # ---- 3. honesty, and 6. hidden during a COO walk ----
    if part('honesty'):
        where = '() => { const m = document.querySelector(".office-mascot"); return [m.dataset.spot, m.dataset.state]; }'
        p.evaluate('''() => { window.__spots = []; const m = document.querySelector('.office-mascot');
          new MutationObserver(() => { window.__spotAt = performance.now(); window.__spots.push([m.dataset.spot, m.dataset.state]); })
            .observe(m, {attributes: true, attributeFilter: ['data-spot', 'data-state']}); window.__spotAt = performance.now(); }''')
        p.wait_for_function('() => performance.now() - window.__spotAt > 4000 && document.querySelector(".office-mascot").dataset.state !== "walking"', timeout=90000, polling=250)
        before = p.evaluate(where)
        check(before[0] != 'board', '3. the COO starts away from the task board: %r' % before)
        p.evaluate('() => { window.__spots = []; }')
        p.evaluate('([d, r]) => { const doc = window.__db.get("coo/L-" + d); doc.acts.r_run = r; window.__db.set("coo/L-" + d, doc); }',
                   [today, office_row('r_run', 'J31', 'rebalance', 'board', {'n': 1}, {}, ms(11, 15), status='running')])
        p.wait_for_function('d => !!((((M.lastCtx.coo || {}).L || {})[d] || {}).acts || {}).r_run', arg=today, timeout=10000, polling=200)
        p.wait_for_timeout(4000)
        seen = p.evaluate('() => window.__spots.slice()')
        check(all(sp == before[0] and st != 'walking' for sp, st in seen) and p.evaluate(where)[0] == before[0], '3. a row still running moves nothing: %r' % [before, seen])
        p.evaluate('d => { const doc = window.__db.get("coo/L-" + d); doc.acts.r_run.status = "done"; doc.acts.r_run.at = Date.now(); window.__db.set("coo/L-" + d, doc); }', today)
        until(p, '() => window.__spots.some(([sp, st]) => st === "walking" || sp === "board")', '3. the settled row never moved the COO', timeout=20000, polling=50)
        walking = p.evaluate('() => document.querySelector(".office-mascot").dataset.state === "walking"')
        if walking:
            p.evaluate(HIDE, True)
            f = held(p, 2000)
            p.evaluate(HIDE, False)
            check(f[0] == f[1], '6. no frame while the page is hidden during a COO walk: %r' % f)
        check(walking, '6. the settled row walks the COO, so the hidden check ran mid walk')
        until(p, '() => window.__spots.some(([sp]) => sp === "board")', '3. the COO never reached the task board', timeout=30000)
        check(True, '3. once settled, the row sends the COO to the task board')

    # ---- 4. a burst: six steps, then one summary ----
    if part('burst'):
        p.evaluate('''() => { window.__bubbles = []; const seen = new Set();
          new MutationObserver(() => document.querySelectorAll('.office-bubble').forEach(b => { const t = b.innerText.trim(); if (t && !seen.has(t)) { seen.add(t); window.__bubbles.push(t); } }))
            .observe(document.body, {subtree: true, childList: true, characterData: true}); }''')
        burst = {}
        for i in range(10):
            burst['b%d' % i] = office_row('b%d' % i, 'J16', 'review_ask', 'review', {'task': 'none', 'uid': M1, 'to': M2, 'day': today}, {'uid': M1}, 0)
        p.evaluate('([d, rows]) => { const doc = window.__db.get("coo/L-" + d); const now = Date.now(); Object.keys(rows).forEach((k, i) => { rows[k].at = now - 1000 + i; doc.acts[k] = rows[k]; }); window.__db.set("coo/L-" + d, doc); }', [today, burst])
        until(p, '() => window.__bubbles.some(x => /And \\d+ more/.test(x))', '4. the burst never ended in one summary bubble', timeout=180000, polling=500)
        got = p.evaluate('() => window.__bubbles.slice()')
        summary = [x for x in got if re.search(r'And \d+ more', x)][0]
        steps = [x for x in got[:got.index(summary)] if 'review' in x.lower() or 'Asked' in x]
        check(len(steps) <= 6 and 'And 4 more' in summary, '4. at most six steps play, then "And 4 more": %r' % [steps, summary])

    # ---- 8. a member watches ----
    if part('member') or part('owner') or part('arrange'):
        m = h.page(c)
        office(m, 'm1')
        settle(m)
    if part('member'):
        check(m.evaluate('() => document.querySelector(".office").dataset.scope') == 'team' and m.evaluate('() => M.officeLive.state().role') == 'member', '8. a member sees the team scope')
        check(m.locator('#office-say').count() == 0 and m.locator('.o3-arr-go').count() == 0 and m.locator('.ol-composer').count() == 0, '8. a member has no composer and no Arrange')
        check(m.evaluate('() => document.querySelector("canvas.office-gl").getAttribute("aria-label")') == 'The office floor. Drag to look around.', '8. the canvas tells a member to look around')
        k0 = m.evaluate('() => M.officeLive.state()')
        fs0 = p.evaluate('() => [M.officeLive.state().seq, (window.__presence || {}).o3 || null]')
        pt = m.evaluate(FLOOR_PT)
        check(pt is not None, '8. a point of open floor on the member\'s canvas')
        m.mouse.click(pt['x'], pt['y'])
        m.focus('canvas.office-gl')
        for key in 'wasd':
            m.keyboard.down(key)
            m.wait_for_timeout(250)
            m.keyboard.up(key)
        m.wait_for_timeout(1500)
        k1 = m.evaluate('() => M.officeLive.state()')
        moved = [(k['seq'], k['x'], k['y'], k['mode']) for k in (k0, k1)]
        check(moved[0] == moved[1] and k1['mode'] == 'sit', '8. a member\'s floor click and W A S D leave Kaavish where he is: %r' % moved)
        check(p.evaluate('() => [M.officeLive.state().seq, (window.__presence || {}).o3 || null]') == fs0 and m.locator('.scrim').count() == 0, '8. and send nothing, open nothing')
        check(m.evaluate('() => M.officeLive.walkTo({x: 600, y: 480})') is False and m.evaluate('() => M.officeLive.say("hello")') is False, '8. a member\'s walkTo and say return false')
        words = m.evaluate('''() => ({bubbles: [...document.querySelectorAll('.office .office-bubble')].map(b => b.innerText),
          tags: [...document.querySelectorAll('.office .office-desk')].filter(d => d.dataset.uid !== M.lastCtx.uid).map(d => [...d.querySelectorAll('.o3-st, .od-late, .od-new')].map(x => x.innerText).join(' ')),
          own: [...document.querySelectorAll('.office .office-desk')].filter(d => d.dataset.uid === M.lastCtx.uid).map(d => d.innerText).join(' ')})''')
        check(not [t for t in words['bubbles'] if PRIVATE.search(t)], '8. no private word in a member\'s COO bubble: %r' % words['bubbles'])
        check(not [t for t in words['tags'] if PRIVATE.search(t)], '8. no private word on another person\'s desk tag: %r' % words['tags'])
        check(not re.search(r'casual|sick|overload', words['own'], re.I), '8. the member\'s own desk names no leave type or reason: %r' % words['own'])
        m.screenshot(path=os.path.join(SHOTS, 'office3d-member-720.png'))

    # ---- 9. Kaavish walks to a desk, the drawer opens on arrival; W A S D on the floor, never from an input ----
    if part('owner'):
        p.evaluate('() => document.querySelector(".office").scrollIntoView({block: "start"})')
        s0 = p.evaluate('() => ((window.__presence || {}).o3 || {}).s || 0')
        # what this page draws him doing, sampled while he goes (a software renderer draws a frame a second or so)
        p.evaluate('''() => { window.__kseen = []; window.__kiv = setInterval(() => { const k = M.officeLive.state(), d = M.office3d.state().kaavish;
          window.__kseen.push([k.mode, k.x, k.y, d.mode]); }, 100); }''')
        p.evaluate('u => document.querySelector(`.office-desk[data-uid="${u}"]`).click()', M4)
        until(p, 'n => ((window.__presence || {}).o3 || {}).s > n', '9. a desk button sent no walk', arg=s0, polling=100)
        o3 = p.evaluate('() => window.__presence.o3')
        p.wait_for_function('() => window.__kseen.some(x => x[0] === "walk")', timeout=10000, polling=100)
        check(o3['m'] == 'walk' and o3['to'] == 'desk:' + M4 and len(o3['p']) >= 2,
              '9. a desk button walks him there along the aisles, presence o3.s %d -> %d: %r' % (s0, o3['s'], {x: o3[x] for x in ('m', 'to', 'v', 'p')}))
        check(set(o3.keys()) <= {'s', 'm', 'p', 'v', 'x', 'y', 'h', 'to', 'lv'} and set(window_keys(p)) <= {'uid', 'page', 'at', 'o3', 'say', 'o3w'},
              '9. presence carries o3 and the page fields only: %r' % window_keys(p))
        until(p, 's => !!document.querySelector(s)', '9. DeskDrawer never opened on his arrival', arg='.office-drawer[data-uid="%s"]' % M4, timeout=45000)
        end = p.evaluate('u => M.office.standPoint(M.office.layout(M.lastCtx), "desk:" + u)', M4)
        k = p.evaluate('() => M.officeLive.state()')
        seen = p.evaluate('() => { clearInterval(window.__kiv); return window.__kseen; }')
        check(abs(k['x'] - end['x']) < 3 and abs(k['y'] - end['y']) < 3 and k['mode'] != 'walk', '9. on arrival he stands at %r and DeskDrawer opens: %r' % (end, (k['x'], k['y'], k['mode'])))
        check(any(x[3] == 'walk' for x in seen), '9. the scene drew him walking on the way: %r' % [x for x in seen if x[3] == 'walk'][:3])
        p.keyboard.press('Escape')
        p.wait_for_function('() => !document.querySelector(".scrim")', timeout=10000)
        k0 = p.evaluate('() => M.officeLive.state()')
        p.focus('canvas.office-gl')
        # S steps back from the desk into the aisle
        p.keyboard.down('s')
        until(p, 'k => { const s = M.officeLive.state(); return s.seq > k.seq && Math.hypot(s.x - k.x, s.y - k.y) > 5; }', '9. S on the floor never moved him', arg=k0, timeout=15000, polling=100)
        p.keyboard.up('s')
        p.wait_for_function('() => M.officeLive.state().mode !== "pad"', timeout=10000, polling=100)
        k1 = p.evaluate('() => M.officeLive.state()')
        check(k1['seq'] > k0['seq'] and (window_o3(p) or {}).get('m') == 'idle', '9. S on the floor moves him and stops him (pad, then a stop): %r' % [(k0['x'], k0['y']), (k1['x'], k1['y'])])
        k0 = p.evaluate('() => M.officeLive.state()')
        p.click('#office-say')
        p.keyboard.type('wasd ddd')
        p.keyboard.down('w')
        p.wait_for_timeout(600)
        p.keyboard.up('w')
        p.wait_for_timeout(600)
        k1 = p.evaluate('() => M.officeLive.state()')
        check([k0[x] for x in ('seq', 'x', 'y')] == [k1[x] for x in ('seq', 'x', 'y')] and p.input_value('#office-say').startswith('wasd ddd'),
              '9. W A S D typed into the composer moves nothing: %r' % [(k0['seq'], k0['x'], k0['y']), (k1['seq'], k1['x'], k1['y'])])
        p.fill('#office-say', '')

    # ---- 10. Arrange by keyboard: a swap of two benches, one write, seen by a second page in 3D and flat ----
    if part('arrange'):
        fl = h.page(c)
        fl.add_init_script(PAGE_FLAT)
        fl.goto(h.url('m2', '#office'))
        h.ready(fl)
        fl.wait_for_selector('.office[data-render="flat"] .office-desk[data-uid="%s"]' % M1, timeout=30000)
        flat0 = fl.evaluate('u => document.querySelector(`.office-desk[data-uid="${u}"]`).style.left', M1)
        p.evaluate('() => document.querySelector(".office").scrollIntoView({block: "start"})')
        before = p.evaluate('() => M.office.layout(M.lastCtx).benches.map(b => [b.slot, b.pod])')
        rev0 = p.evaluate('() => ((window.__db.get("office/plan") || {}).rev) || 0')
        p.click('.o3-arr-go')
        p.wait_for_selector('.o3-handle.o3-bench[data-slot="0"]', timeout=15000)
        p.wait_for_selector('.o3-handle.o3-bench[data-slot="1"]', timeout=15000)
        w0 = p.evaluate('() => window.__dbWrites.length')
        p.focus('.o3-handle.o3-bench[data-slot="0"]')
        p.keyboard.press('Enter')
        p.keyboard.press('ArrowRight')
        p.keyboard.press('Enter')
        until(p, 'n => window.__dbWrites.slice(n).some(w => w.path === "office/plan")', '10. the keyboard drop wrote no office/plan', arg=w0, timeout=15000, polling=100)
        p.wait_for_timeout(800)
        writes = p.evaluate('n => window.__dbWrites.slice(n).filter(w => w.path === "office/plan")', w0)
        plan = p.evaluate('() => window.__db.get("office/plan")')
        pod = dict((s, x) for s, x in before)
        check(len(writes) == 1 and plan['rev'] == rev0 + 1 and plan['slots'].get('0') == pod[1] and plan['slots'].get('1') == pod[0],
              '10. the swap is one write of office/plan at rev %d: %r' % (rev0 + 1, {k: plan.get(k) for k in ('rev', 'slots', 'seats', 'by')}))
        check(not re.search(r'"(name|email)"\s*:', str(writes[0]['data']).replace("'", '"')), '10. the plan holds ids only')
        want = [[0, pod[1]], [1, pod[0]]]
        swapped = 'w => { const b = M.office.layout(M.lastCtx).benches.map(x => [x.slot, x.pod]); return JSON.stringify(b.slice(0, 2)) === JSON.stringify(w); }'
        until(m, swapped, '10. the second page never laid the benches out swapped', arg=want, timeout=20000)
        until(m, 'r => M.office3d.state().plan === r && !M.office3d.state().building', '10. the second page never drew plan rev %d' % (rev0 + 1), arg=rev0 + 1, timeout=60000, polling=250)
        check(True, '10. a second page in 3D draws the swapped benches (plan rev %d)' % (rev0 + 1))
        until(fl, swapped, '10. the flat page never laid the benches out swapped', arg=want, timeout=20000)
        until(fl, '([u, x]) => document.querySelector(`.office-desk[data-uid="${u}"]`).style.left !== x', '10. the flat page never moved the desks', arg=[M1, flat0], timeout=20000)
        check(True, '10. and a flat page moves the desks with their bench: %s -> %s' % (flat0, fl.evaluate('u => document.querySelector(`.office-desk[data-uid="${u}"]`).style.left', M1)))
        # his own floor is rebuilt with the swap, and his view stays near top down while he arranges
        polar = '() => { const a = M.office3d.api(), c = a.camera.position, t = a.controls.target; return Math.round(Math.acos((c.y - t.y) / Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z)) * 180 / Math.PI); }'
        until(p, 'r => M.office3d.state().plan === r && !M.office3d.state().building', '10. his own page never drew plan rev %d' % (rev0 + 1), arg=rev0 + 1, timeout=60000, polling=250)
        check(p.evaluate(polar) <= 22, '10. after the drop his view is still near top down: %d degrees' % p.evaluate(polar))
        p.click('.o3-arr-done')
        fl.close()
    # the pages above stop drawing, so the checks below have the renderer's time to themselves
    c.close()

    # ---- 7. flat where it must be ----
    if part('flat'):
        for name, opts, why in (('reduced motion', {'reduced': True}, 'reduced'),
                                ('no WebGL2', {'init': ["(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); }; })();"]}, 'nogl')):
            q = h.page(h.context(init=[FORCE_3D, clock] + opts.get('init', []), reduced=opts.get('reduced', False)))
            q.goto(h.url('founder', '#office', reset=True, seed=True))
            h.ready(q)
            until(q, 's => !!document.querySelector(s)', '7. %s never drew flat' % name, arg='.office[data-render="flat"]', timeout=20000)
            check(q.locator('.office-gl').count() == 0 and q.evaluate('() => M.office3d.can().why') == why, '7. %s draws flat (%s)' % (name, why))
            q.context.close()
        q = h.page(h.context(init=[FORCE_3D, clock]))
        q.goto(h.url('founder', '#office', reset=True, seed=True))
        h.ready(q)
        q.wait_for_selector(READY, timeout=30000)
        q.evaluate('''() => { window.__flatAt = 0; new MutationObserver(() => { if (!window.__flatAt && document.querySelector('.office[data-render="flat"]')) window.__flatAt = performance.now(); })
          .observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-render']});
          const gl = document.querySelector("canvas.office-gl").getContext("webgl2"); window.__lost = performance.now(); gl.getExtension("WEBGL_lose_context").loseContext(); }''')
        until(q, '() => window.__flatAt > 0', '7. a lost context never went flat', polling=100)
        took = q.evaluate('() => (window.__flatAt - window.__lost) / 1000')
        check(took < 3 and q.evaluate('() => M.office3d.can().why') == 'lost', '7. a lost context is flat in %.1f s' % took)
        q.context.close()

    # ---- 11. no sideways scroll at 390 x 700 ----
    if part('phone'):
        q = h.page(h.context(width=390, height=700, init=[FORCE_3D, clock]))
        office_world(h, q, tue)
        office(q)
        settle(q)
        check(h.overflow(q) <= 0 and q.evaluate('() => document.querySelector(".office").classList.contains("on-phone")'), '11. no sideways scroll at 390 x 700 in 3D')
        q.screenshot(path=os.path.join(SHOTS, 'office3d-390.png'))
        q.context.close()

    # ---- the windows: 3D on a desktop, flat on a phone ----
    def open_studio(q):
        # v36 relief R14: Home's studio starts closed: Look in opens it on a desktop, its fold on a phone
        q.wait_for_selector('#studio-look, #fold-studio .fold-head', timeout=20000)
        check(q.locator('#studio-now .office-window').count() == 0, "Home's studio starts folded")
        q.click('#studio-look' if q.locator('#studio-look').count() else '#fold-studio .fold-head')

    if part('windows'):
        q = h.page(h.context(width=1280, height=800, init=[FORCE_3D, clock]))
        office_world(h, q, tue)
        for hsh, sel, name in (('#hq', '.hq-office .office-window', 'the HQ brief'), ('#coo', '.coo-hero-office .office-window', 'the COO hero'),
                               ('#home', '#studio-now .office-window', 'Home\'s studio')):
            q.goto(h.url('founder', hsh))
            h.ready(q)
            if hsh == '#home':
                open_studio(q)
            if hsh == '#hq' and q.locator('#hq-more[aria-expanded="false"]').count():
                q.click('#hq-more')   # v40: HQ opens on Command; the office sits under "more from HQ"
            q.wait_for_selector(sel, timeout=20000)
            q.evaluate('s => document.querySelector(s).scrollIntoView({block: "center"})', sel)
            until(q, 's => !!document.querySelector(s)', '%s never drew in 3D' % name, arg=sel + ' ' + READY, timeout=45000)
            box = q.evaluate('''s => { const w = document.querySelector(s), v = w.querySelector('.office-view').getBoundingClientRect(), o = w.getBoundingClientRect();
              return {w: Math.round(v.width), h: Math.round(v.height), inside: v.left >= o.left - 1 && v.right <= o.right + 1, orbit: M.office3d.api().controls.enabled,
                foot: !!w.querySelector('.office-foot button'), canvases: document.querySelectorAll('canvas.office-gl').length}; }''', sel)
            check(box['inside'] and box['w'] > 200 and 1.6 < box['w'] / box['h'] < 1.9 and not box['orbit'] and box['foot'] and box['canvases'] == 1,
                  '%s draws in 3D, 16 by 9, a fixed camera, the office one tap away: %r' % (name, box))
            q.screenshot(path=os.path.join(SHOTS, 'window-%s-1280.png' % hsh[1:]))
        q.set_viewport_size({'width': 390, 'height': 844})
        for hsh, sel, name in (('#hq', '.hq-office .office-window', 'the HQ brief'), ('#coo', '.coo-hero-office .office-window', 'the COO hero'),
                               ('#home', '#studio-now .office-window', 'Home\'s studio')):
            q.goto(h.url('founder', hsh))
            h.ready(q)
            if hsh == '#home':
                open_studio(q)
            until(q, 's => !!document.querySelector(s)', '%s is not flat on a phone' % name, arg=sel + ' .office[data-render="flat"]', timeout=20000)
            check(q.locator(sel + ' .office-gl').count() == 0 and h.overflow(q) <= 0, '%s is flat on a phone' % name)
        q.context.close()

    # ---- 12. no console errors ----
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, '12. no console errors: %r' % errs[:3])
    return checks


def window_o3(p):
    return p.evaluate('() => (window.__presence || {}).o3 || null')


def window_keys(p):
    return sorted((p.evaluate('() => window.__presence || {}') or {}).keys())


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
