#!/usr/bin/env python3
"""v32 test: the nudge engine and the personal managers (M.pm, 09-pm.js; PmWatch, 88-pm.js).

The chain: m1 reports to Kaavish (nobody named, no pod lead), m2 reports to m1, m3 reports to m2.
settings/app.pm.on is true for the scenario (it ships off). On a working Tuesday next week, with the
clock pinned and moved:

- Off by default: with no pm in settings, nothing is chased and nothing shows.
- 10:46: m3 (no check-in) has the step 1 on noin, keyed u_m3:noin:-:<ymd>#1; on m3's Home the card
  reads the warm line; two pages of m3 in one browser bring exactly one bubble, and told is written once.
- m3 answers "On it, in 30 minutes": the ack lands, m2's chip reads "on it, by 11:16", the DM shows the
  derived row and the coded answer. The eta passes with no check-in: step 1b comes due at 11:16.
- 11:46 on the m2 path: m1 (no check-in, no answer) brings Kaavish's escalation (step 2 to the founder)
  exactly once; a manager may not hear inside the window (none at 11:44).
- mine on an item stops step 3; the 17:30 digest reaches the founder once for what m1 left open
  (m3 under m2 under m1 under the founder).
- noeod: the card heads-up at 19:00 (step 0, never rings), step 1 at 19:30, the morning sweep to the
  manager next day at start plus grace.
- Rings are held over lunch and while a focus timer runs.
- Leave, a pending leave request, a holiday, a Sunday, pm.on off and R01 off each produce nothing to ring.
- perDay caps the ring budget deterministically and bubbles stay fifteen minutes apart. Coach days hold
  back step 2.
- A stricter cfg (a shorter wait) applies from the next working day; the founder alone switches a bot
  off (setCfg refuses on:false while require holds); a pause shows in the audit.
- "Not right" freezes step 2 and opens the fix drawer prefilled.
- waiton: m3 answers "blocked" on overdue work; m2 leaves it for 120 minutes and hears from m1's bot;
  a DM reply from m2 closes it.
- The radar save no longer erases pm.
- Asks: the record holds uids and codes only, one DM line per person with a deterministic id, a retry
  does not double; the receipt and the answer back.
- The audit's zero checks read zero.

Run: cd m360-os && python3 harness/tests/test_pm.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}
PM_ON = {'on': True}


def new_ctx(h, fixed, width=1280, height=900):
    ctx = h.browser.new_context(viewport={'width': width, 'height': height}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(ctx)
    ctx.clock.set_fixed_time(fixed)
    return ctx


def open_page(h, ctx, ident, hash, **params):
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hash, **params))
    h.ready(page)
    return page


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()
    wed = (tue + timedelta(days=1)).isoformat()
    mon = (tue - timedelta(days=1)).isoformat()

    def at(hh, mm, day=0):
        d = tue + timedelta(days=day)
        return datetime(d.year, d.month, d.day, hh, mm, tzinfo=IST)

    def ms(hh, mm, day=0):
        return int(at(hh, mm, day).timestamp() * 1000)

    ctx = new_ctx(h, at(9, 30))
    pg = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)

    def be(ident, hash='#home', **params):
        # a fresh document every time, so the store and the pinned clock are read afresh (a hash change alone is no navigation)
        pg.goto('about:blank')
        pg.goto(h.url(ident, hash, **params))
        h.ready(pg)
        pg.wait_for_function('() => window.M && M.pm && M.lastCtx && M.pm.loaded(M.lastCtx)')
        pg.wait_for_timeout(400)

    def ev(expr, arg=None):
        return pg.evaluate('(a) => { const ctx = M.lastCtx; return (%s); }' % expr, arg)

    pg.wait_for_function('() => !!window.__db.get("roster/team")')
    pg.wait_for_timeout(300)
    h.roster(pg, [M1, M2, M3], extra={M2: {'reportsTo': M1}, M3: {'reportsTo': M2}})
    for u in (F, M1, M2, M3):
        h.seed_doc(pg, 'checkin/' + u, {'days': {}})
        # yesterday's EOD lines are in, so the morning sweep has nothing to carry
        h.seed_doc(pg, 'eod/' + u, {'days': {mon: {'shipped': 'x', 'next': 'y', 'blocked': '', 'at': ms(19, 0, -1)}}})
        h.seed_doc(pg, 'leave/' + u, {'reqs': []})
        h.seed_doc(pg, 'me/' + u, {})
    h.seed_doc(pg, 'me/' + M1, {'name': 'Durvesh Patil'})
    h.seed_doc(pg, 'me/' + M2, {'name': 'Aanya Mehta'})
    h.seed_doc(pg, 'me/' + M3, {'name': 'Ishaan Rao'})
    base = pg.evaluate('() => window.__db.get("settings/app") || {}')
    base.pop('pm', None)
    h.seed_doc(pg, 'settings/app', base)
    # the founder is in, so their own day is not part of the picture
    h.seed_doc(pg, 'checkin/' + F, {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})

    # ---- off by default ----
    ctx.clock.set_fixed_time(at(10, 46))
    be('founder')
    check(ev('M.pm.P(ctx).on') is False and ev('M.SETTINGS_DEFAULTS.pm.on') is False, 'personal managers ship off')
    check(ev('M.pm.P(ctx).require') is True, 'and a manager may not switch their own bot off')
    check(ev('M.pm.items(ctx, "u_m3").length') == 0 and ev('M.pm.forMe(ctx).length') == 0, 'off: nothing is chased: %r' % ev('M.pm.items(ctx, "u_m3")'))
    check(pg.locator('#pm-card').count() == 0, 'off: no card on Home')

    # ---- on: 10:46, m3 has not checked in ----
    h.seed_doc(pg, 'settings/app', dict(base, pm=PM_ON))
    be('founder')
    check(ev('M.lines.managerOf(ctx, "u_m1")') == F and ev('M.lines.chainOf(ctx, "u_m3")') == [M2, M1, F], 'the chain: m3 under m2 under m1 under the founder')
    k3 = 'u_m3:noin:-:' + today
    it3 = ev('M.pm.items(ctx, "u_m3").map(i => ({K: i.K, kind: i.kind, state: i.state, steps: i.steps.map(s => [s.step, s.to, s.state]), line: i.line, mgrLine: i.mgrLine, bot: i.botName}))')
    check(len(it3) == 1 and it3[0]['K'] == k3, 'one item for m3, the noin key: %r' % it3)
    check(it3[0]['steps'] == [['1', M3, 'due'], ['2', M2, 'waiting']], 'step 1 due to m3, step 2 waiting for m2: %r' % it3[0]['steps'])
    check(it3[0]['line'] == 'Morning Ishaan. No check-in yet, and your day started at 10:30. Check in when you are set, or tell Aanya if today is off.', 'the warm line: %r' % it3[0]['line'])
    check(it3[0]['bot'] == "Aanya's bot", 'the bot is the manager\'s: %r' % it3[0]['bot'])
    check(ev('M.pm.items(ctx, "u_founder").length') == 0, 'the founder is never chased')

    # ---- m3's Home: the card, and one bubble across two pages ----
    pg.evaluate('() => { M.pm.PASS = 800; }')
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 800; }')
    pg.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % k3)
    card = pg.inner_text('#pm-card')
    check("From Aanya's bot" in card and 'Morning Ishaan' in card, 'the card on Home: %r' % card[:200])
    check('If there is no answer by 11:45, Aanya hears about it.' in card, 'the ladder line: %r' % card)
    check(pg.locator('#quiet-nudge').count() == 0, 'the card takes the quiet nudge\'s place')
    pg2 = ctx.new_page()
    pg2.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    pg2.goto(h.url('m3', '#tasks'))
    h.ready(pg2)
    pg2.evaluate('() => { M.pm.PASS = 800; }')
    for p in (pg, pg2):
        p.evaluate('() => { window.__pmBubbles = []; const push = M.notices.push; M.notices.push = n => { if (String(n.key || "").startsWith("pm:")) window.__pmBubbles.push(n); return push(n); }; }')
    pg.wait_for_function('() => (((window.__db.get("me/u_m3") || {}).pm || {}).told || {})[%r] > 0' % (k3 + '#1'), timeout=20000)
    pg.wait_for_timeout(2500)
    b1 = pg.evaluate('() => window.__pmBubbles')
    b2 = pg2.evaluate('() => window.__pmBubbles')
    check(len(b1) + len(b2) == 1, 'exactly one bubble across two pages: %r / %r' % (b1, b2))
    bub = (b1 or b2)[0]
    check(bub['title'] == "Aanya's bot" and bub['body'].startswith('Morning Ishaan') and bub.get('bot') is True, 'the bubble: %r' % bub)
    writes = pg.evaluate('() => window.__dbWrites.filter(w => w.path === "me/u_m3").length')
    told = pg.evaluate('() => window.__db.get("me/u_m3").pm.told')
    check(list(told.keys()) == [k3 + '#1'], 'told is written once, for the one step: %r (%d writes)' % (told, writes))
    pg2.close()

    # ---- m3 answers: on it, in 30 minutes ----
    pg.locator('#pm-card .pm-row[data-k="%s"] button[data-how="onit"]' % k3).first.click()
    pg.locator('#pm-card [data-eta="30m"]').click()
    pg.wait_for_function('() => ((((window.__db.get("me/u_m3") || {}).pm || {}).ack || {})[%r] || {}).how === "onit"' % k3)
    ack = pg.evaluate('() => window.__db.get("me/u_m3").pm.ack[%r]' % k3)
    check(ack['eta'] == ms(11, 16) and ack['at'] == ms(10, 46), 'the ack: on it, by 11:16: %r' % ack)
    pg.wait_for_selector('#pm-card .pm-said')
    check('You said: on it, in by 11:16. Aanya can see this.' in pg.inner_text('#pm-card .pm-said'), 'the row reads what was said')
    check(not any(c[0] in ('error', 'pageerror') and 'pm' in c[1].lower() for c in h.console), 'no errors so far: %r' % h.errors()[:2])

    # m2 sees the chip
    be('m2')
    pg.wait_for_selector('#team-u_m3 .pm-chip[data-k="%s"]' % k3)
    chip = pg.inner_text('#team-u_m3 .pm-chip[data-k="%s"]' % k3)
    check(chip == 'on it, by 11:16', "m2's chip: %r" % chip)
    # the DM between them carries the derived row and the coded answer
    be('m2', '#chat/dm.u_m2.u_m3')
    pg.wait_for_selector('.pm-dm-row[data-k="%s"]' % k3)
    dm = pg.inner_text('#pm-dm')
    check("Aanya's bot, automatic, only you two see this" in dm and 'Running late, in by 11:16.' in dm, 'the DM rows: %r' % dm)
    check(pg.evaluate('() => (window.__db.get("chat/dm.u_m2.u_m3:u_m3") || null)') is None, 'a one-tap answer writes no chat line')

    # ---- 11:17: the eta passed, still no check-in: step 1b ----
    ctx.clock.set_fixed_time(at(11, 17))
    be('m2')
    st = ev('M.pm.items(ctx, "u_m3").find(i => i.K === a).steps.map(s => [s.step, s.to, s.state])', k3)
    check(['1b', M3, 'due'] in st and ['2', M2, 'skipped'] in st and any(s[0] == '2b' and s[2] == 'waiting' for s in st), 'step 1b due at the eta, step 2 covered, 2b waiting: %r' % st)
    chip = pg.inner_text('#team-u_m3 .pm-chip[data-k="%s"]' % k3)
    check(chip == 'said 11:16, still open', 'the chip turns: %r' % chip)

    # ---- 11:44 and 11:46: m2 hears nothing early; the founder hears about m1 once ----
    ctx.clock.set_fixed_time(at(11, 44))
    be('founder')
    k1 = 'u_m1:noin:-:' + today
    st = ev('M.pm.items(ctx, "u_m1")[0].steps.map(s => [s.step, s.to, s.state])')
    check(['2', F, 'waiting'] in st, 'at 11:44 the manager has not heard: %r' % st)
    ctx.clock.set_fixed_time(at(11, 46))
    be('founder')
    pg.evaluate('() => { M.pm.PASS = 800; window.__pmBubbles = []; const push = M.notices.push; M.notices.push = n => { if (String(n.key || "").startsWith("pm:")) window.__pmBubbles.push(n); return push(n); }; }')
    mine = ev('M.pm.forMe(ctx).map(x => [x.stepId, x.ring])')
    check([k1 + '#2', True] in mine, 'the founder has step 2 on m1 due and ringing: %r' % mine)
    pg.wait_for_function('() => (((window.__db.get("me/u_founder") || {}).pm || {}).told || {})[%r] > 0' % (k1 + '#2'), timeout=20000)
    pg.wait_for_timeout(2500)
    bb = pg.evaluate('() => window.__pmBubbles')
    check(len(bb) == 1 and bb[0]['title'] == 'Your bot' and bb[0]['body'].startswith('Durvesh'), 'one escalation bubble: %r' % bb)

    # ---- m3 is quiet too; m2 on m2's own page gets m3's 2b later; and mine stops step 3 ----
    ctx.clock.set_fixed_time(at(11, 50))
    be('m2')
    pg.evaluate('a => M.pm.handle(M.lastCtx, a, "mine")', k3)
    pg.wait_for_function('() => ((((window.__db.get("me/u_m2") || {}).pm || {}).ack || {})[%r] || {}).how === "mine"' % k3)
    check(True, 'm2 says "I will handle it" on m3')

    # ---- 17:30: the digest to the founder for what m1 left (m2's noin, with m1 since 11:45) ----
    ctx.clock.set_fixed_time(at(17, 31))
    be('founder')
    dg = ev('(() => { const d = M.pm.digest(ctx, "u_founder"); return d && {id: d.id, n: d.rows.length, rows: d.rows.map(r => r.item.K), text: d.text}; })()')
    k2 = 'u_m2:noin:-:' + today
    check(dg and dg['rows'] == [k2] and dg['id'] == 'digest:u_founder:' + today, 'the founder\'s note holds m2 (left by m1), never m3 (m2 said mine): %r' % dg)
    check(dg['text'].startswith("1 thing on Durvesh's team is still open. Aanya: no check-in yet, with Durvesh since 11:45."), 'the note reads: %r' % dg['text'])
    check(ev('M.pm.digest(ctx, "u_m1")') is None or ev('M.pm.digest(ctx, "u_m1").rows.length') == 0, 'm1 gets no note about m3: mine stopped it')
    pg.evaluate('() => { M.pm.PASS = 800; }')
    pg.wait_for_function('() => (((window.__db.get("me/u_founder") || {}).pm || {}).told || {})[%r] > 0' % ('digest:u_founder:' + today), timeout=20000)
    check(True, 'the digest reached the founder')
    n_before = ev('M.pm.forMe(ctx).filter(x => x.step === "digest").length')
    check(n_before == 1, 'one digest a day: %r' % n_before)


    # ---------------------------------------------------------------- helpers for the days that follow
    def day_of(n):
        return (tue + timedelta(days=n)).isoformat()

    def checkin(u, n, hin, out=None):
        doc = pg.evaluate('p => window.__db.get(p) || {days: {}}', 'checkin/' + u)
        doc.setdefault('days', {})[day_of(n)] = {'in': ms(hin[0], hin[1], n), 'out': ms(out[0], out[1], n) if out else None, 'mode': 'office', 'loc': OFFICE, 'outLoc': OFFICE if out else None}
        h.seed_doc(pg, 'checkin/' + u, doc)

    def merge_doc(path, patch):
        pg.evaluate('''([p, x]) => {
          const deep = (a, b) => { const o = {...(a || {})}; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deep(o[k], b[k]) : b[k]; return o; };
          window.__db.set(p, deep(window.__db.get(p) || {}, x)); }''', [path, patch])
        pg.wait_for_timeout(150)

    def bubbles_hook():
        pg.evaluate('''() => { window.__pmBubbles = []; window.__pmEv = [];
          window.addEventListener('m360:pm', e => window.__pmEv.push(e.detail));
          const push = M.notices.push; M.notices.push = n => { if (String(n.key || '').startsWith('pm:')) window.__pmBubbles.push(n); return push(n); }; }''')

    for n in range(0, 5):
        checkin(F, n, (10, 0))

    # ---------------------------------------------------------------- noeod: 19:00 heads-up, 19:30, next morning
    for u in (M1, M2, M3):
        checkin(u, 0, (10, 30))
    ctx.clock.set_fixed_time(at(19, 1))
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    ke = 'u_m3:noeod:-:' + today
    st = ev('(M.pm.items(ctx, "u_m3").find(i => i.K === a) || {steps: []}).steps.map(s => [s.step, s.state])', ke)
    check(st[:2] in ([['0', 'due'], ['1', 'waiting']], [['0', 'told'], ['1', 'waiting']]), 'noeod at 19:01: the heads-up is due, the nudge waits: %r' % st)
    x0 = ev('M.pm.forMe(ctx).filter(x => x.item.K === a).map(x => [x.step, x.ring])', ke)
    check(x0 == [['0', False]], 'the heads-up never rings: %r' % x0)
    pg.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % ke)
    check('Your EOD line is due at 19:30. Shipped, next, blocked.' in pg.inner_text('#pm-card'), 'the card carries the heads-up line')
    pg.wait_for_function('k => (((window.__db.get("me/u_m3") || {}).pm || {}).told || {})[k] < 0', arg=ke + '#0')
    check(True, 'shown on the card, it is marked seen without a sound (a negative mark)')
    ctx.clock.set_fixed_time(at(19, 31))
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    x1 = ev('M.pm.forMe(ctx).filter(x => x.item.K === a).map(x => [x.step, x.ring])', ke)
    check(['1', True] in x1, 'at 19:31 the nudge is due and rings: %r' % x1)
    check("It is 19:30 and today's EOD line is not in." in pg.inner_text('#pm-card'), 'the card turns to the nudge')
    check(ev('M.pm.items(ctx, "u_m3").find(i => i.K === a).steps.every(s => s.step !== "2")', ke), 'no same-evening escalation for the EOD line')
    ctx.clock.set_fixed_time(at(10, 46, 1))
    be('m2')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    sw = ev('M.pm.forMe(ctx).filter(x => x.item.K === a).map(x => [x.stepId, x.ring, x.item.mgrLine])', ke)
    check(len(sw) == 1 and sw[0][0] == ke + '#2', 'next morning the sweep reaches m2 with yesterday\'s key: %r' % sw)
    check(sw[0][2].startswith('From yesterday: no EOD line from Ishaan for '), 'the sweep line: %r' % sw[0][2])

    # ---------------------------------------------------------------- lunch and focus hold the ring (Wednesday)
    ctx.clock.set_fixed_time(at(14, 35, 1))
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    kw = 'u_m3:noin:-:' + wed
    lunch = ev('M.pm.forMe(ctx, {now: a}).filter(x => x.stepId === "%s#1").map(x => x.ring)' % kw, ms(13, 45, 1))
    after = ev('M.pm.forMe(ctx, {now: a}).filter(x => x.stepId === "%s#1").map(x => x.ring)' % kw, ms(14, 35, 1))
    check(lunch == [False] and after == [True], 'held over lunch, rings after it: %r / %r' % (lunch, after))
    foc = pg.evaluate('''k => { M.focus.start('', 'Deep work', 25); const x = M.pm.forMe(M.lastCtx, {now: Date.now()}).find(y => y.stepId === k + '#1'); M.focus.stop(); return x && [x.ring, x.held]; }''', kw)
    check(foc == [False, True], 'held while a focus timer runs: %r' % foc)

    # ---------------------------------------------------------------- leave, pending leave, holiday, Sunday, off, R01 off
    none = pg.evaluate(r'''([td, sun]) => {
      const b = M.lastCtx, mk = o => ({...b, ...o});
      const due = c => M.pm.items(c, 'u_m3').filter(i => i.steps.some(s => s.state === 'due')).length;
      const leave = mk({onLeave: (u, d) => u === 'u_m3' || b.onLeave(u, d), isWorkingDay: (d, u) => u !== 'u_m3' && b.isWorkingDay(d, u)});
      const pend = mk({coll: {...b.coll, leave: {ready: true, map: {...b.coll.leave.map, u_m3: {reqs: [{id: 'P1', from: td, to: td, kind: 'casual'}]}}}}});
      const hol = mk({holidays: new Set([td]), isWorkingDay: (d, u) => d !== td && b.isWorkingDay(d, u)});
      const off = mk({settings: {...b.settings, pm: {...b.settings.pm, on: false}}});
      const r01 = mk({settings: {...b.settings, rules: {...b.settings.rules, R01: false}}});
      return {base: due(b), leave: due(leave), pend: due(pend), pendState: M.pm.items(pend, 'u_m3').map(i => i.state),
        hol: due(hol), sun: M.pm.items(b, 'u_m3', {now: sun}).length, off: due(off), r01: M.pm.items(r01, 'u_m3').filter(i => i.kind === 'noin').length};
    }''', [wed, ms(11, 0, 5)])
    check(none['base'] >= 1, 'the baseline has something due: %r' % none)
    check(none['leave'] == 0 and none['hol'] == 0 and none['sun'] == 0 and none['off'] == 0 and none['r01'] == 0, 'leave, a holiday, a Sunday, pm off and R01 off: nothing: %r' % none)
    check(none['pend'] == 0 and set(none['pendState']) == {'held'}, 'a pending leave request holds every item: %r' % none)

    # ---------------------------------------------------------------- Thursday: "Not right" on m1's missing check-in
    for u in (M2, M3):
        checkin(u, 2, (10, 30))
    ctx.clock.set_fixed_time(at(10, 50, 2))
    be('m1')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    kn = 'u_m1:noin:-:' + day_of(2)
    pg.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % kn)
    pg.locator('#pm-card .pm-row[data-k="%s"] button[data-how="wrong"]' % kn).click()
    pg.wait_for_selector('#fix-drawer')
    check(pg.input_value('#fix-field') == 'in' and pg.input_value('#fix-date') == day_of(2), 'the fix drawer opens prefilled: %r %r' % (pg.input_value('#fix-field'), pg.input_value('#fix-date')))
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)
    nr = ev('(() => { const i = M.pm.items(ctx, "u_m1").find(x => x.K === a); return [i.state, i.steps.find(s => s.step === "2").state]; })()', kn)
    check(nr == ['disputed', 'skipped'], '"Not right" freezes step 2: %r' % nr)

    # ---------------------------------------------------------------- the ring budget and the fifteen minutes between bubbles
    tasks = {}
    for i in range(6):
        tasks['t_od%d' % i] = {'title': 'Cutdown %d' % i, 'owner': M3, 'by': M2, 'status': 'todo', 'due': mon, 'created': ms(9, 0, -3), 'updated': ms(9, 0, -3), 'subtasks': {}, 'comments': {}}
    for tid, t in tasks.items():
        h.seed_doc(pg, 'tasks/' + tid, t)
    # room for every one of them on the live page; the default budget is checked on a copy of the context
    h.seed_doc(pg, 'settings/app', dict(base, pm=dict(PM_ON, perDay=10)))
    ctx.clock.set_fixed_time(at(11, 20, 2))
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    bud = pg.evaluate('''() => { const b = M.lastCtx;
      const four = {...b, settings: {...b.settings, pm: {...b.settings.pm, perDay: 4}}};
      const r1 = M.pm.forMe(four).filter(x => x.item.kind === 'overdue' && x.step === '1');
      const r2 = M.pm.forMe({...four}).filter(x => x.item.kind === 'overdue' && x.step === '1');
      return {n: r1.length, ring: r1.filter(x => x.ring).map(x => x.stepId), again: r2.filter(x => x.ring).map(x => x.stepId)}; }''')
    check(bud['n'] == 6 and len(bud['ring']) == 4 and bud['ring'] == bud['again'], 'perDay 4: four of six ring, the same four every time: %r' % bud)
    check(ev('M.SETTINGS_DEFAULTS.pm.perDay') == 4 and ev('M.pm.forMe(ctx).filter(x => x.item.kind === "overdue" && x.ring).length') == 6, 'the default budget is four; ten lets all six ring')
    # coach days: a new joiner's step 2 is held back
    coach = pg.evaluate('''([j]) => { const b = M.lastCtx;
      const c = {...b, members: {...b.members, u_m3: {...b.members.u_m3, joined: j}}};
      const i = M.pm.items(c, 'u_m3').find(x => x.kind === 'overdue');
      return [i.coach, i.steps.find(s => s.step === '2').state]; }''', [day_of(-3)])
    check(coach == [True, 'skipped'], 'coach days hold back step 2: %r' % coach)
    # the live bubbles: one bubble now, the next fifteen minutes on
    be('m3')
    bubbles_hook()
    pg.evaluate('() => { M.pm.PASS = 800; }')
    pg.wait_for_function('() => window.__pmBubbles.length >= 1', timeout=20000)
    pg.wait_for_timeout(2500)
    bb = pg.evaluate('() => window.__pmBubbles')
    check(len(bb) == 1 and ('6 things' in bb[0]['body']), 'six steps due together ring as one bubble: %r' % bb)
    check(pg.evaluate('() => window.__pmEv') == [{'type': 'step', 'n': 6}], 'and one m360:pm event: %r' % pg.evaluate('() => window.__pmEv'))
    merge_doc('me/' + M2, {'pm': {'chase': {'t_od0': {'rep': M3, 'at': ms(11, 25, 2)}}}})
    ctx.clock.set_fixed_time(at(11, 31, 2))
    pg.wait_for_timeout(3500)
    kc = 'u_m3:chase:t_od0:' + day_of(2)
    due_c = ev('M.pm.forMe(ctx, {now: Date.now()}).filter(x => x.item.kind === "chase").map(x => [x.stepId, x.ring])')
    check(due_c == [[kc + '#1', True]], 'the chase is due at 11:30: %r' % due_c)
    check(len(pg.evaluate('() => window.__pmBubbles')) == 1, 'and waits: fifteen minutes since the last bubble have not passed')
    ctx.clock.set_fixed_time(at(11, 36, 2))
    pg.wait_for_function('() => window.__pmBubbles.length >= 2', timeout=20000)
    bb = pg.evaluate('() => window.__pmBubbles')
    check(len(bb) == 2 and bb[1]['body'].startswith('Aanya asked me to check on the Cutdown 0'), 'at 11:36 it rings on its own: %r' % bb[1])

    # ---------------------------------------------------------------- the manager's own bot: stricter from tomorrow, never off
    be('m2')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    fri = day_of(3)
    r = pg.evaluate('() => M.pm.setCfg(M.lastCtx, {wait: 30})')
    pg.wait_for_timeout(300)
    cfg = pg.evaluate('() => window.__db.get("me/u_m2").pm.cfg')
    check(cfg['next']['from'] == fri and cfg['next']['wait'] == 30 and 'wait' not in cfg, 'a shorter wait waits for the next working day: %r' % cfg)
    check(ev('[M.pm.cfgOf(ctx, "u_m2", a[0]).wait, M.pm.cfgOf(ctx, "u_m2", a[1]).wait]', [day_of(2), fri]) == [60, 30], 'today 60, tomorrow 30')
    pg.evaluate('() => M.pm.setCfg(M.lastCtx, {wait: 120})')
    pg.wait_for_timeout(300)
    check(ev('M.pm.cfgOf(ctx, "u_m2").wait') == 120, 'a longer wait applies now')
    pg.evaluate('() => M.pm.setCfg(M.lastCtx, {wait: 60})')
    refused = pg.evaluate('() => M.pm.setCfg(M.lastCtx, {on: false}).then(() => "saved", e => e.message)')
    check(refused == 'Only Kaavish can switch a bot off.', 'a manager cannot switch their bot off: %r' % refused)
    be('m2', '#me')
    pg.wait_for_selector('#pm-me')
    check(pg.locator('#pm-bot-on button').is_disabled() and pg.locator('#pm-bot-on').get_attribute('data-on') == 'true', 'the Me switch reads on and is held for the manager')
    pg.evaluate('a => M.pm.setCfg(M.lastCtx, {pause: {u_m3: a}})', day_of(2))
    pg.wait_for_timeout(400)
    check(ev('M.pm.items(ctx, "u_m3").filter(i => i.source === "bot").length') == 0, 'a pause stops the bot for that person today')
    be('founder')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    row = ev('M.pm.audit(ctx).rows.find(r => r.uid === "u_m2")')
    check(row and row['paused'] == [M3], 'the pause shows in the founder\'s audit: %r' % row)
    merge_doc('settings/app', {'pm': {'off': {M2: True}}})
    check(ev('M.pm.botOn(ctx, "u_m2")') is False, 'the founder switches a manager\'s bot off')
    merge_doc('settings/app', {'pm': {'off': {M2: None}}})
    check(ev('M.pm.botOn(ctx, "u_m2")') is True, 'and on again')
    be('m2')
    pg.evaluate('() => M.pm.setCfg(M.lastCtx, {pause: {u_m3: null}})')
    pg.wait_for_timeout(300)

    # ---------------------------------------------------------------- Friday: blocked, then the chain upward (waiton)
    for u in (M1, M2, M3):
        checkin(u, 3, (10, 30))
    h.seed_doc(pg, 'tasks/t_w', {'title': 'Swisse reel cutdown', 'owner': M3, 'by': M2, 'status': 'todo', 'due': day_of(2), 'created': ms(9, 0, -3), 'updated': ms(9, 0, -3), 'subtasks': {}, 'comments': {}})
    for tid in tasks:
        h.seed_doc(pg, 'tasks/' + tid, dict(tasks[tid], status='done', doneAt=ms(18, 0, 2)))
    ctx.clock.set_fixed_time(at(11, 20, 3))
    be('m3')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    kb = 'u_m3:overdue:t_w:' + fri
    pg.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % kb)
    pg.locator('#pm-card .pm-row[data-k="%s"] button[data-how="blocked"]' % kb).click()
    pg.fill('#pm-card .pm-row[data-k="%s"] input[data-note="blocked"]' % kb, "waiting on the client's footage")
    pg.locator('#pm-card .pm-row[data-k="%s"] .pm-note .btn' % kb).click()
    pg.wait_for_function('() => ((((window.__db.get("me/u_m3") || {}).pm || {}).ack || {})[%r] || {}).how === "blocked"' % kb)
    pg.wait_for_function('() => ((window.__db.get("chat/dm.u_m2.u_m3:u_m3") || {}).msgs || []).some(m => m.pmHow === "blocked")')
    line = pg.evaluate('() => window.__db.get("chat/dm.u_m2.u_m3:u_m3").msgs.find(m => m.pmHow === "blocked")')
    check(line['text'] == "Blocked: waiting on the client's footage" and line['pm'] == kb, 'the note goes to the manager as a DM line: %r' % line)
    s2 = ev('M.pm.items(ctx, "u_m3").find(i => i.K === a).steps.find(s => s.step === "2")', kb)
    check(s2['state'] == 'due' and s2['at'] == ms(11, 20, 3), 'blocked brings the manager in at once: %r' % s2)
    ctx.clock.set_fixed_time(at(13, 21, 3))
    be('m2')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    kwo = 'u_m2:waiton:u_m3.overdue.t_w:' + fri
    wo = ev('(() => { const i = M.pm.items(ctx, "u_m2").find(x => x.K === a); return i && {state: i.state, bot: i.botName, line: i.line, steps: i.steps.map(s => [s.step, s.to, s.state])}; })()', kwo)
    check(wo and wo['steps'][0] == ['1', M2, 'due'] and wo['bot'] == "Durvesh's bot", 'two hours on, m2 hears from m1\'s bot: %r' % wo)
    check(wo['line'] == 'Ishaan has been blocked on the Swisse reel cutdown since 11:20 and is waiting on you. Reply to Ishaan, or Durvesh hears at 14:20.', 'the waiton line: %r' % wo['line'])
    pg.evaluate('() => M.rooms.send(M.lastCtx, "dm.u_m2.u_m3", "Footage lands at 3, I chased them.", [])')
    pg.wait_for_function('() => ((((window.__db.get("me/u_m2") || {}).pm || {}).ack || {})[%r] || {}).how === "answered"' % kb, timeout=10000)
    st = ev('M.pm.items(ctx, "u_m2").find(x => x.K === a).state', kwo)
    check(st == 'sorted', 'a DM reply closes it, and the page records the answer: %r' % st)

    # ---------------------------------------------------------------- the radar save never rewrites the profile
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'src', 'js', '75-radar.js'), encoding='utf-8').read()
    body = src.split('async function toggleSave', 1)[1].split('\n  }\n', 1)[0]
    check("W.set('me/" not in body and 'W.set(' not in body and "{saved: {[it.id]: null}}" in body, 'toggleSave merges a null, never sets the whole profile')
    before = pg.evaluate('() => JSON.stringify(window.__db.get("me/u_m2").pm)')
    pg.evaluate('''async () => { const c = M.lastCtx;
      await c.W.merge('me/u_m2', {saved: {r1: {title: 'x', link: 'https://example.com', at: Date.now()}}});
      await c.W.merge('me/u_m2', {saved: {r1: null}}); }''')
    pg.wait_for_timeout(300)
    check(pg.evaluate('() => JSON.stringify(window.__db.get("me/u_m2").pm)') == before, 'the bot marks survive a save and an unsave')

    # ---------------------------------------------------------------- asks: Friday 20:41, the founder
    checkin(M1, 3, (10, 8))
    checkin(M3, 3, (10, 30), (19, 0))
    ctx.clock.set_fixed_time(at(20, 41, 3))
    be('founder')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    res = pg.evaluate('a => M.pm.ask(M.lastCtx, {kind: "noout", to: ["u_m1", "u_m3"], ask: "why", via: "voice", tellBy: a})', ms(21, 45, 3))
    check(res['sent'] == [M1] and res['skipped'] == [{'uid': M3, 'why': 'already sorted'}], 'm1 is asked, m3 checked out and is left out: %r' % res)
    aid = res['askId']
    rec = pg.evaluate('a => window.__db.get("me/u_founder").pm.asks[a]', aid)
    check(sorted(rec.keys()) == ['ask', 'at', 'kind', 'tellBy', 'to', 'via'] and rec['to'] == [M1] and rec['via'] == 'voice', 'the record holds uids and codes only: %r' % rec)
    res2 = pg.evaluate('() => M.pm.ask(M.lastCtx, {kind: "custom", to: ["u_m2"], note: "Can you send me the Swisse deck tonight?", via: "typed"})')
    rec2 = pg.evaluate('a => window.__db.get("me/u_founder").pm.asks[a]', res2['askId'])
    check(res2['sent'] == [M2] and 'Swisse' not in str(rec2) and rec2['note'] is True, 'the sender\'s own words never reach the record: %r' % rec2)
    msgs = pg.evaluate('() => (window.__db.get("chat/dm.u_founder.u_m1:u_founder") || {}).msgs || []')
    mine = [m for m in msgs if m.get('ask') == aid]
    check(len(mine) == 1 and mine[0]['id'] == 'ask.%s.%s' % (aid, M1) and mine[0]['text'] == 'You are still checked in from 10:08. What happened?' and mine[0]['via'] == 'voice', 'one DM line with its id: %r' % mine)
    again = pg.evaluate('a => M.rooms.send(M.lastCtx, "dm.u_founder.u_m1", "x", [], null, {id: a}).then(() => (window.__db.get("chat/dm.u_founder.u_m1:u_founder").msgs || []).length)', 'ask.%s.%s' % (aid, M1))
    check(again == len(msgs), 'a retry adds nothing: %r vs %r' % (again, len(msgs)))
    # the middle manager sees the ask on Your team, and is never pinged
    be('m1')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    pg.wait_for_selector('#team-u_m2')
    check('Kaavish asked Aanya at 20:41' in pg.inner_text('#team-u_m2'), 'm1 sees the founder asked m2: %r' % pg.inner_text('#team-u_m2'))
    # m1 answers the ask: I left at...
    ka = 'u_m1:noout:-:' + fri
    pg.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % ka)
    card = pg.inner_text('#pm-card')
    check('Kaavish asked about this too, by voice' in card, 'the ask rides on the bot\'s row: %r' % card[:300])
    pg.locator('#pm-card .pm-row[data-k="%s"] button[data-how="wrong"]' % ka).click()
    pg.wait_for_selector('#fix-drawer')
    check(pg.input_value('#fix-field') == 'out', 'the correction asks for the check-out time')
    pg.keyboard.press('Escape')
    pg.wait_for_function('() => ((((window.__db.get("me/u_m1") || {}).pm || {}).ack || {})[%r] || {}).how === "wrong"' % ka)
    be('founder')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    sent = ev('M.pm.sent(ctx).find(s => s.askId === a)', aid)
    check(sent['answered'] == 1 and sent['rows'][0]['text'] == 'Durvesh: left earlier, asked for a fix', 'the receipt reads the answer: %r' % sent['rows'])
    back = ev('M.pm.forMe(ctx).filter(x => x.step === "r").map(x => x.stepId)')
    check('r:%s:u_m1:wrong' % aid in back, 'the answer comes back to the sender: %r' % back)
    pg.evaluate('''a => { const d = document.createElement('div'); d.id = 'receipt-host'; document.body.appendChild(d);
      ReactDOM.createRoot(d).render(React.createElement(M.Ctx.Provider, {value: M.lastCtx}, React.createElement(M.parts.PmAskReceipt, {askId: a}))); }''', aid)
    pg.wait_for_selector('#receipt-host .agent-receipt-toggle')
    check('Asked 1 person · 1 answered' in pg.inner_text('#receipt-host'), 'the receipt folds: %r' % pg.inner_text('#receipt-host'))
    pg.click('#receipt-host .agent-receipt-toggle')
    check('left earlier, asked for a fix' in pg.inner_text('#receipt-host .agent-receipt-row[data-uid="u_m1"]'), 'and opens to the row')
    # withdraw: the DM line reads Withdrawn
    pg.evaluate('a => M.pm.withdraw(M.lastCtx, a)', res2['askId'])
    pg.wait_for_function('a => ((window.__db.get("chat/dm.u_founder.u_m2:u_founder") || {}).msgs || []).some(m => m.ask === a && m.text === "Withdrawn")', arg=res2['askId'])
    check(True, 'withdraw marks the line')

    # ---------------------------------------------------------------- the founder's audit: the checks read zero
    au = ev('M.pm.audit(ctx)')
    check(au['zero'] == {'hours': 0, 'budget': 0, 'early': 0, 'offday': 0, 'ruleoff': 0}, 'the zero checks: %r %r' % (au['zero'], au['bad']))
    rows = {r['uid']: r for r in au['rows']}
    check(rows[M2]['nudges'] >= 1 and rows[F]['mgr'] >= 1, 'the week counts nudges and what reached the manager: %r' % rows)
    be('founder', '#admin')
    pg.wait_for_selector('#pm-admin')
    pg.locator('#pm-admin .pm-audit-wrap .linky').click()
    pg.wait_for_selector('#pm-audit')
    check(pg.locator('#pm-audit [data-zero].flame').count() == 0, 'no flame on the zero checks')

    # ---------------------------------------------------------------- the review: rights, pauses, the outbox, privacy
    forged = pg.evaluate('''() => { const b = M.lastCtx, now = Date.now();
      const withAsks = (u, a) => ({...b, coll: {...b.coll, me: {...b.coll.me, map: {...b.coll.me.map, [u]: {...(b.coll.me.map[u] || {}), pm: {asks: a}}}}}});
      const peer = withAsks('u_m3', {fake: {kind: 'custom', to: ['u_m1'], at: now, via: 'typed'}});
      const skip = withAsks('u_m1', {sk: {kind: 'short', to: ['u_m3'], at: now, via: 'typed'}, ok: {kind: 'custom', to: ['u_m3'], at: now, via: 'typed'}});
      const direct = withAsks('u_m2', {dk: {kind: 'short', to: ['u_m3'], at: now, via: 'typed', ringNow: true}});
      const by = (c, u) => M.pm.items(c, u).flatMap(i => i.asks.filter(a => a.by !== 'u_founder').map(a => a.id));
      return {peer: by(peer, 'u_m1'), skip: by(skip, 'u_m3'), direct: by(direct, 'u_m3'),
        ringNow: M.pm.items(direct, 'u_m3').flatMap(i => i.asks).filter(a => a.ringNow).length}; }''')
    check(forged['peer'] == [] and forged['skip'] == ['ok'] and forged['direct'] == ['dk'] and forged['ringNow'] == 0,
          'an ask shows only from someone with the right to ask, and ringNow only from the founder: %r' % forged)
    check(ev('M.pm.covers({at: 5, how: "blocked", n: 2}, {at: 3, how: "onit", n: 1})') is True, 'the outbox lets a newer answer stand')
    be('m2')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    chat = ev('(M.pm.forMe(ctx).find(x => x.stepId === a) || {}).chat', kb + '#2')
    check(chat is True, 'a blocked note that rang as a message keeps step 2 from ringing again: %r' % chat)
    pg.evaluate('a => M.pm.setCfg(M.lastCtx, {pause: {u_m3: a}})', day_of(9))
    pg.wait_for_timeout(400)
    cfg = pg.evaluate('() => window.__db.get("me/u_m2").pm.cfg')
    check(cfg['pause']['u_m3'] == fri and ('u_m3:' + fri) in cfg.get('plog', {}), 'a pause lasts today only and leaves a mark: %r' % cfg)
    pg.evaluate('() => M.pm.setCfg(M.lastCtx, {pause: {u_m3: null}})')
    pg.wait_for_timeout(300)
    off_all = pg.evaluate('() => M.pm.setCfg(M.lastCtx, {kinds: Object.fromEntries(M.pm.BOT_KINDS.map(k => [k, false]))}).then(() => "saved", e => e.message)')
    check(off_all.startswith('Only Kaavish can switch a bot off'), 'switching every kind off is refused: %r' % off_all)
    att = lambda: pg.evaluate('''() => Array.from(document.querySelectorAll('#person-pm [data-k]')).map(e => e.getAttribute('data-k'))''')
    pg.goto('about:blank')
    pg.goto(h.url('m2', '#people/' + M3))
    h.ready(pg)
    pg.wait_for_selector('#person-pm')
    rows_m2 = att()
    be('m1', '#people/' + M3)
    pg.wait_for_selector('#person-pm')
    rows_m1 = att()
    kinds_of = lambda rows: set(r.split(':')[1] for r in rows)
    check(kinds_of(rows_m2) & {'noin', 'noeod', 'noout', 'quiet'} and not (kinds_of(rows_m1) & {'noin', 'noeod', 'noout', 'quiet', 'idle', 'short'}) and 'overdue' in kinds_of(rows_m1),
          'the bot log shows attendance to the manager, only work further up: %r / %r' % (rows_m2, rows_m1))
    be('founder')
    pg.evaluate('() => { M.pm.PASS = 1e9; }')
    row = ev('M.pm.audit(ctx).rows.find(r => r.uid === "u_m2")')
    check(M3 in row['paused'], 'a resumed pause still shows in the audit this week: %r' % row)

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
