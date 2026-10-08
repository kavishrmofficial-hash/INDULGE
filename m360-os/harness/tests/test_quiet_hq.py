#!/usr/bin/env python3
"""v30 test: quiet stretches on the founder's HQ.

With the clock pinned at 14:40 on a working Tuesday: Durvesh (m1) checked in at 10:30 and saved work at
10:40 and 10:45, then nothing; Aanya (m2, lead of his pod, so his manager) checked in at 10:05 and saved
every twenty minutes; Kaavish checked in at 09:30 and Ishaan (m3) at 09:00 on a day of approved leave,
neither with anything after. On #hq the tape carries Durvesh's quiet stretch as a hot row ("since
10:50, 2h 50m so far, lunch aside"), and keeps it, folded or not, once 45 posts push it past 40 rows.
The Quiet stretches board puts him first with a live flame band from 10:50 to the now line on a 10:00
to 20:00 axis, his summary and his status, Aanya reads steady, Kaavish's own day and Ishaan's leave
have no row, and the head counts one quiet now. Yesterday Durvesh checked in at 10:30 and out at 19:00
with only the founder's log to go on (no stamps): the Yesterday chip shows the closed 10:50 to 14:30 (the save at 10:45 fills its five minute block)
stretch. A row opens the person. At 390 wide the fold opens on its own and the strip fits with no
overflow, in light and dark. The AI context (M.ai.teamSlice, the brief and Ask HQ) and look_up("quiet")
carry the QUIET STRETCHES lines; Aanya's carries Durvesh's (without the founder's log), Ishaan's none,
and HQ stays the founder's. No console errors.

Run: cd m360-os && python3 harness/tests/test_quiet_hq.py
Screenshots go to harness/shots, or to $QUIET_SHOTS when set.
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
SHOTS = os.environ.get('QUIET_SHOTS') or os.path.join(ROOT, 'harness', 'shots')


def at(day, h, m):
    return int(datetime(day.year, day.month, day.day, h, m, tzinfo=IST).timestamp() * 1000)


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    os.makedirs(SHOTS, exist_ok=True)
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    mon = tue - timedelta(days=1)
    today, yesterday = tue.isoformat(), mon.isoformat()
    t_now = datetime(tue.year, tue.month, tue.day, 14, 40, tzinfo=IST)

    ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(ctx)
    ctx.clock.set_fixed_time(t_now)
    p = ctx.new_page()
    p.set_default_timeout(30000)
    p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.goto(h.url('founder', '#home', reset=True, seed=True))
    h.ready(p)
    seed(h, p)
    # Aanya leads Pod 1, so Durvesh reports to her; Ishaan (Pod 2) reports to Kaavish
    h.roster(p, [M1, M2, M3], extra={M2: {'role': 'lead'}})

    # ---- a quiet workspace: no check-ins, EOD lines, posts or kudos, every task three days old ----
    for u in (F, M1, M2, M3):
        h.seed_doc(p, 'checkin/' + u, {'days': {}})
        h.seed_doc(p, 'eod/' + u, {'days': {}})
        h.seed_doc(p, 'feed/' + u, {'posts': []})
        h.seed_doc(p, 'kudos/' + u, {'given': []})
    p.evaluate('''() => { const s = window.__db.store(); const old = Date.now() - 3 * 86400000;
      for (const k of Object.keys(s)) if (k.startsWith('tasks/') && s[k]) { const t = s[k], o = {...t, created: old, updated: old, comments: {}};
        for (const f of ['doneAt', 'reviewAt', 'sentBackAt', 'approvedAt']) if (t[f]) o[f] = old;
        window.__db.set(k, o); } }''')

    # Durvesh today: in at 10:30, saved at 10:40 and 10:45, a status; nothing since
    h.seed_doc(p, 'checkin/' + M1, {'days': {
        today: {'in': at(tue, 10, 30), 'out': None, 'mode': 'office', 'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None},
        yesterday: {'in': at(mon, 10, 30), 'out': at(mon, 19, 0), 'mode': 'office', 'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})
    me1 = p.evaluate('() => window.__db.get("me/u_m1") || {}')
    me1.update({'act': {today: {'1040': 1, '1045': 1}}, 'status': {'text': 'At the Swisse shoot', 'at': at(tue, 10, 41)}})
    h.seed_doc(p, 'me/' + M1, me1)
    # Aanya today: in at 10:05, a save every twenty minutes up to 14:30
    h.seed_doc(p, 'checkin/' + M2, {'days': {today: {'in': at(tue, 10, 5), 'out': None, 'mode': 'wfh', 'loc': {'verified': False, 'place': 'Home'}, 'outLoc': None}}})
    buckets = {}
    mins = 10 * 60 + 10
    while mins <= 14 * 60 + 30:
        hh, mm = divmod(mins, 60)
        buckets['%02d%02d' % (hh, mm - mm % 5)] = 1
        mins += 20
    me2 = p.evaluate('() => window.__db.get("me/u_m2") || {}')
    me2.update({'act': {today: buckets}})
    h.seed_doc(p, 'me/' + M2, me2)
    # Durvesh yesterday: no stamps, only the log (10:40, 10:45, then every half hour from 14:30 to 18:30)
    times = [(10, 40), (10, 45), (14, 30), (15, 0), (15, 30), (16, 0), (16, 30), (17, 0), (17, 30), (18, 0), (18, 30), (18, 50)]
    entries = {'e%02d' % i: {'at': at(mon, hh, mm), 'a': 'update', 'p': 'tasks/t1', 's': ''} for i, (hh, mm) in enumerate(times)}
    h.seed_doc(p, 'log/%s/days/%s' % (M1, yesterday), {'e': entries})
    # Kaavish checked in at 09:30 and has been out on calls since: his own day stays off his board
    h.seed_doc(p, 'checkin/' + F, {'days': {today: {'in': at(tue, 9, 30), 'out': None, 'mode': 'office', 'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})
    # Ishaan tapped in at 09:00, but today is approved leave: no row, no flag
    h.seed_doc(p, 'checkin/' + M3, {'days': {today: {'in': at(tue, 9, 0), 'out': None, 'mode': 'office', 'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})
    h.seed_doc(p, 'leave/' + M3, {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'kind': 'casual', 'note': 'family', 'at': at(mon, 18, 0)}]})
    h.seed_doc(p, 'leavedec/' + M3, {'d': {'L1': {'status': 'approved', 'by': F, 'at': at(mon, 18, 30)}}})

    # ---- HQ at 1280 ----
    p.goto(h.url('founder', '#hq', seed=True))
    h.ready(p)
    p.wait_for_selector('#quiet-board #qb-u_m1')
    check(p.get_attribute('#quiet-now', 'data-n') == '1' and p.inner_text('#quiet-now').strip() == '1 quiet now', 'one quiet now in the card head: %r' % p.inner_text('#quiet-now'))
    rows = p.evaluate('() => [...document.querySelectorAll("#quiet-board .qb-row")].map(r => [r.id, r.dataset.live])')
    check(rows[:2] == [['qb-' + M1, '1'], ['qb-' + M2, '0']] and len(rows) == 2, 'Durvesh first and live, Aanya after, nobody else in: %r' % rows)
    check(p.locator('#qb-u_m1 .qb-q.live').count() == 1, 'a live flame band on Durvesh')
    s1 = p.inner_text('#qb-u_m1 .qb-sum')
    check('quiet since 10:50, 2h 50m so far' in s1 and 'status: At the Swisse shoot' in s1, 'the summary and the status: %r' % s1)
    check(p.inner_text('#qb-u_m2 .qb-sum').strip() == 'steady' and p.locator('#qb-u_m2 .qb-q').count() == 0, 'Aanya is steady')
    lab = p.get_attribute('#qb-u_m1 .qb-strip', 'aria-label')
    check('in at 10:30, still in' in lab and 'Nothing recorded on m360 since 10:50 (2h 50m so far, lunch aside)' in lab, 'the strip reads as a sentence: %r' % lab)
    check(p.locator('#qb-u_m1 .qb-now').count() == 1 and p.locator('#qb-u_m1 .qb-lunch').count() == 1, 'a now line and the lunch hour')
    check(p.locator('#qb-u_m1 .qb-q .qb-ql').count() == 1 and p.inner_text('#qb-u_m1 .qb-q').strip() == '2h 50m', 'lunch shows through the band, the band says its length')
    check(p.locator('#qb-u_m1 .qb-t.k-in').count() == 1 and p.locator('#qb-u_m1 .qb-t.k-w').count() == 2, 'ticks for the check-in and both saves')
    band = p.evaluate('() => { const q = document.querySelector("#qb-u_m1 .qb-q.live"), n = document.querySelector("#qb-u_m1 .qb-now"); const a = q.getBoundingClientRect(), b = n.getBoundingClientRect(); return [a.left, a.right, b.left + b.width / 2]; }')
    check(band[1] - band[0] > 60 and abs(band[1] - band[2]) < 3, 'the live band runs up to the now line: %r' % band)
    # the axis runs 10:00 to 20:00 (Kaavish at 09:30 and Ishaan at 09:00 are not on it); the band starts at 10:50
    axis = p.evaluate('''() => { const s = document.querySelector("#qb-u_m1 .qb-strip").getBoundingClientRect(), q = document.querySelector("#qb-u_m1 .qb-q").getBoundingClientRect(),
      n = document.querySelector("#qb-u_m1 .qb-now").getBoundingClientRect(), hs = [...document.querySelectorAll("#quiet-board .qb-axis .qb-hours span")].map(x => x.textContent);
      return {hs, start: (q.left - s.left) / s.width, now: (n.left + n.width / 2 - s.left) / s.width}; }''')
    check(axis['hs'][0] == '10:00' and axis['hs'][-1] == '20:00', 'the hours run 10:00 to 20:00: %r' % axis['hs'])
    check(abs(axis['start'] - 50 / 600) < 0.01 and abs(axis['now'] - 280 / 600) < 0.01, 'the band starts at 10:50, the now line sits at 14:40: %r' % axis)
    check(p.locator('#qb-' + F).count() == 0 and p.locator('#qb-' + M3).count() == 0, 'no row for Kaavish himself or for Ishaan on leave')
    p.locator('#quiet-board').screenshot(path=os.path.join(SHOTS, 'quiet-hq-1280.png'))

    # ---- the tape: the quiet row, hot, at 10:50 ----
    tq = p.locator('#tape .tape-row[data-k="quiet"]')
    check(tq.count() == 1, 'one quiet row on the tape')
    check(tq.get_attribute('data-hot') == '1' and tq.locator('.nd i.hot').count() == 1, 'the quiet row is hot')
    txt = tq.inner_text()
    check('10:50' in txt and 'Durvesh Patil: nothing recorded on m360 since 10:50 (2h 50m so far, lunch aside)' in txt, 'the tape says it: %r' % txt)
    p.locator('#tape').screenshot(path=os.path.join(SHOTS, 'quiet-tape-1280.png'))
    check(not [t for t in p.locator('#tape .tape-row[data-k="quiet"]').all_inner_texts() if 'Kaavish' in t], 'Kaavish is not on his own tape as quiet')
    # a busy afternoon: 45 posts from Aanya push the tape past its 40 rows; the quiet row stays, folded or not
    posts = [{'id': 'qp%d' % i, 'kind': 'update', 'text': 'Cut %d is up.' % i, 'at': at(tue, 11, 0) + i * 4 * 60000} for i in range(45)]
    h.seed_doc(p, 'feed/' + M2, {'posts': posts, 'pinned': None})
    p.wait_for_function('() => /40 today/.test(document.querySelector("#tape").innerText)')
    folded = p.evaluate('() => [...document.querySelectorAll("#tape .tape-row")].map(r => r.dataset.k)')
    check(len(folded) == 9 and folded[-1] == 'quiet' and folded.count('quiet') == 1, 'folded: the newest eight and the quiet row: %r' % folded)
    p.locator('#tape').get_by_role('button', name='Show all 40').click()
    full = p.evaluate('() => [...document.querySelectorAll("#tape .tape-row")].map(r => r.dataset.k)')
    check(len(full) == 40 and full.count('quiet') == 1, 'all forty, the quiet row kept: %d rows' % len(full))
    p.locator('#tape').get_by_role('button', name='Show less').click()

    # ---- yesterday, from the founder's log alone ----
    p.locator('#quiet-board .qb-days button[data-ymd="%s"]' % yesterday).click()
    check(p.inner_text('#quiet-board .qb-days button[aria-pressed="true"]').strip() == 'Yesterday', 'the Yesterday chip is on')
    p.wait_for_selector('#qb-u_m1 .qb-q')
    check(p.locator('#qb-u_m1 .qb-q.live').count() == 0 and p.locator('#qb-u_m1 .qb-q').count() == 1, 'one closed stretch yesterday')
    check(p.locator('#qb-u_m2').count() == 0 and p.locator('#qb-u_m1 .qb-now').count() == 0, 'Aanya was not in yesterday, no now line on a past day')
    s1 = p.inner_text('#qb-u_m1 .qb-sum')
    check(s1.startswith('1 quiet stretch, 2h 40m'), 'yesterday summary: %r' % s1)
    lab = p.get_attribute('#qb-u_m1 .qb-strip', 'aria-label')
    check('out at 19:00' in lab and 'Nothing recorded on m360 from 10:50 to 14:30 (2h 40m, lunch aside)' in lab, 'yesterday reads 10:50 to 14:30: %r' % lab)
    check(p.locator('#qb-u_m1 .qb-t.k-log').count() >= 10, 'the log entries tick the strip')
    check(p.get_attribute('#quiet-now', 'data-n') == '1', 'the head still counts today')
    p.mouse.move(5, 5)
    p.wait_for_timeout(1000)
    p.locator('#quiet-board').screenshot(path=os.path.join(SHOTS, 'quiet-hq-yesterday-1280.png'))
    # a row opens the person
    p.locator('#qb-u_m1').click()
    p.wait_for_function('() => location.hash === "#people/u_m1"')
    check(True, 'a row opens the person')

    # ---- the AI knows ----
    p.goto(h.url('founder', '#hq', seed=True))
    h.ready(p)
    p.wait_for_selector('#quiet-board #qb-u_m1')
    sl = p.evaluate('() => M.ai.teamSlice(M.lastCtx)')
    check('QUIET STRETCHES' in sl, 'the team slice has a QUIET STRETCHES section')
    check('Durvesh Patil, today: nothing recorded on m360 since 10:50 (2h 50m so far, lunch aside), QUIET NOW, status: At the Swisse shoot' in sl, 'today live line: %r' % sl[sl.find('QUIET'):sl.find('QUIET') + 400])
    check('nothing recorded on m360 from 10:50 to 14:30 (2h 40m, lunch aside)' in sl, 'yesterday line from the log')
    check(sl.find('QUIET STRETCHES') < sl.find('PROJECTS:'), 'the section sits before the projects, so a cut keeps it')
    check('Kaavish Ramchandani, today' not in sl and 'Ishaan Rao, today' not in sl, 'no line for Kaavish himself or for Ishaan on leave')
    lk = p.evaluate('async () => { const c = M.lastCtx; return M.brain.lookUp(c, await M.ai.names(c), "quiet", "durvesh"); }')
    check('since 10:50' in lk and 'Aanya' not in lk, 'look_up quiet for one person: %r' % lk[:200])
    p.locator('.ai-card.dark').get_by_role('button', name='Brief me').click()
    p.wait_for_function('() => (window.__sampleCalls || []).some(c => c.kind === "json" && /Durvesh Patil, today: nothing recorded on m360 since 10:50/.test(c.text))')
    check(True, 'the intelligence brief prompt carries the quiet lines')

    # ---- only the founder, the person and their manager: Aanya manages Durvesh, Ishaan does not ----
    ma = ctx.new_page()
    ma.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    ma.goto(h.url('m2', '#home', seed=True))
    h.ready(ma)
    ma.wait_for_function('() => M.lastCtx && M.lastCtx.ready && M.lastCtx.uid === "u_m2"')
    # quiet stretches read nothing until the day's collections have arrived (M.quiet holds them back while loading)
    ma.wait_for_function('() => !M.quiet.day(M.lastCtx, "u_m1", M.U.todayStr()).pending', timeout=30000)
    sa = ma.evaluate('() => M.ai.teamSlice(M.lastCtx)')
    check('Durvesh Patil, today: nothing recorded on m360 since 10:50' in sa, 'his manager reads his quiet stretch')
    check('from 10:50 to 14:30' not in sa, 'the founder\'s log stays with the founder: %r' % sa[sa.find('QUIET'):sa.find('QUIET') + 300])
    ma.goto(h.url('m3', '#hq', seed=True))
    h.ready(ma)
    ma.wait_for_function('() => M.lastCtx && M.lastCtx.ready && M.lastCtx.uid === "u_m3"')
    ma.wait_for_function('() => location.hash === "#home"')
    # loaded first, so the peer's empty answer is the rule speaking and not a page still loading
    ma.wait_for_function('() => !M.quiet.day(M.lastCtx, "u_m1", M.U.todayStr()).pending', timeout=30000)
    check(ma.locator('#quiet-board').count() == 0 and ma.locator('#tape').count() == 0, 'HQ, the board and the tape stay with the founder')
    s3 = ma.evaluate('() => M.ai.teamSlice(M.lastCtx)')
    check('QUIET STRETCHES' not in s3 and 'since 10:50' not in s3, 'a peer reads no quiet lines: %r' % s3[:200])
    l3 = ma.evaluate('async () => { const c = M.lastCtx; return M.brain.lookUp(c, await M.ai.names(c), "quiet", "durvesh"); }')
    check('since 10:50' not in l3 and 'not one of your reports' in l3, 'look_up quiet on someone else\'s report: %r' % l3)
    ma.close()

    # ---- reduced motion: the now dot stands still ----
    # the board keeps the day picked above while HQ stays open (only the hash changed), so go back to today
    p.locator('#quiet-board .qb-days button').first.click()
    p.wait_for_selector('#qb-u_m1 .qb-now')
    p.emulate_media(reduced_motion='reduce')
    anim = p.evaluate('() => getComputedStyle(document.querySelector("#qb-u_m1 .qb-now"), "::before").animationName')
    check(anim == 'none', 'no pulse under reduced motion: %r' % anim)
    p.emulate_media(reduced_motion='no-preference')

    # ---- dark at 1280 ----
    p.evaluate('M.theme.set("dark")')
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    p.wait_for_timeout(300)
    p.locator('#quiet-board').screenshot(path=os.path.join(SHOTS, 'quiet-hq-1280-dark.png'))
    p.evaluate('M.theme.set("light")')

    # ---- phone, 390 wide ----
    p.set_viewport_size({'width': 390, 'height': 844})
    p.goto(h.url('founder', '#hq', seed=True))
    h.ready(p)
    p.wait_for_selector('#fold-quiet')
    check('open' in (p.get_attribute('#fold-quiet', 'class') or ''), 'the fold opens itself while someone is quiet')
    check('1 quiet now' in p.inner_text('#fold-quiet .fold-sum'), 'the fold summary counts: %r' % p.inner_text('#fold-quiet .fold-sum'))
    p.wait_for_selector('#qb-u_m1 .qb-strip')
    geo = p.evaluate('''() => { const s = document.querySelector("#qb-u_m1 .qb-strip").getBoundingClientRect(), n = document.querySelector("#qb-u_m1 .qb-nm").getBoundingClientRect(),
      m = document.querySelector("#qb-u_m1 .qb-sum").getBoundingClientRect(), hs = document.querySelector("#qb-u_m1 .qb-hours.per").getBoundingClientRect();
      return {w: s.width, l: s.left, r: s.right, vw: innerWidth, sumBelow: m.top >= n.bottom - 2, stripBelow: s.top >= m.bottom - 2, hours: hs.height}; }''')
    check(geo['w'] >= 300 and geo['l'] >= 0 and geo['r'] <= geo['vw'], 'the strip takes the width and fits: %r' % geo)
    check(geo['sumBelow'] and geo['stripBelow'] and geo['hours'] > 0, 'the summary drops under the name, the strip under it with its own hours: %r' % geo)
    check(h.overflow(p) <= 0, 'no horizontal overflow at 390: %r' % h.overflow(p))
    small = [x for x in h.small_text(p) if 'quiet' in x[2].lower() or ':00' in x[2]]
    check(not small, 'nothing under 11px on the board: %r' % small)
    p.locator('#fold-quiet').screenshot(path=os.path.join(SHOTS, 'quiet-hq-390.png'))
    p.evaluate('M.theme.set("dark")')
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    p.wait_for_timeout(300)
    check(h.overflow(p) <= 0, 'no horizontal overflow at 390 in dark')
    p.locator('#fold-quiet').screenshot(path=os.path.join(SHOTS, 'quiet-hq-390-dark.png'))
    p.evaluate('M.theme.set("auto")')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
