#!/usr/bin/env python3
"""v30 test: rule R17, Keep work moving, and the quiet stretch settings in Admin.

m1 (Pod 1) reports to m2, the Pod 1 lead; m3 (Pod 2) is a peer who reports to Kaavish. On a Tuesday
next week m1 checks in at 10:30, saves at 10:40 and 10:45, and then nothing. At 12:00 with the default
two hours there is no R17. Kaavish sets quiet stretch after to 60 in Admin: the flag appears at once, high,
in m1's own Rule box and on m2's Your team. The lunch fields refuse lunch ending before it starts and a
lunch with one time, then save 13:30 to 14:30 with the threshold back at 120. At 14:40 m1 reads "Nothing
recorded on m360 since 10:50, 2h 50m, lunch aside"; Kaavish sees it in the Command flags (filtered to
R17) and on the handbook's live rules; m3 computes nothing about m1. No lunch hour makes it 3h 50m. A save
at 15:00 closes the stretch (medium, with the day's status). R17 switched off in Admin clears the Rule
box, the manager's Your team and the Command flags. Screenshots of the Admin card and the Rule box, 1280
and 390, light and dark, land in harness/shots (or QUIET_SHOTS).

Run: cd m360-os && python3 harness/tests/test_quiet_rules.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
SECTIONS = ['house-rules', 'the-week', 'ladder', 'escalation', 'standards', 'role-brand-strategist', 'tool-map',
            'how-scores-work', 'hiring-panel', 'what-we-record']
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.environ.get('QUIET_SHOTS') or os.path.join(ROOT, 'harness', 'shots')
RULEBOX = 'section.card:has(h2.card-title:text-is("Rule box"))'
# every collection the quiet watch reads has arrived
LOADED = '["me", "checkin", "eod", "tasks", "feed", "kudos", "leave", "leavedec"].every(k => M.lastCtx.coll[k].ready)'


def new_ctx(h, fixed):
    ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
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
    n = [0]

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    def until(page, expr, what, secs=20):
        """poll from here: a page whose clock is pinned can leave requestAnimationFrame polling idle"""
        for _ in range(int(secs * 10)):
            if page.evaluate(expr):
                return
            page.wait_for_timeout(100)
        raise AssertionError('timed out waiting for ' + what)

    def go(page, ident, hash):
        """a full load every time (a bare hash change would keep the old page), so the clock and the store read fresh"""
        n[0] += 1
        page.goto(h.url(ident, hash, seed=True, v=n[0]))
        h.ready(page)
        until(page, '() => !!(M.lastCtx && M.lastCtx.ready && M.lastCtx.roster && ' + LOADED + ')', 'the app on ' + hash)
        page.wait_for_timeout(250)

    def r17(page, uid=M1):
        return h.ctx(page, 'ctx.flags.filter(f => f.rule === "R17" && f.uid === "%s").map(f => ({severity: f.severity, text: f.text, key: f.key, ref: f.ref, section: f.section}))' % uid)

    def rulebox(page):
        page.wait_for_selector(RULEBOX)
        more = page.locator(RULEBOX + ' button:has-text("Show all")')
        if more.count():
            more.click()
        return page.inner_text(RULEBOX)

    def quiet_flags(page, uid=M1):
        return page.evaluate('u => [...document.querySelectorAll("#team-" + u + " .team-flag[data-k=quiet]")].map(f => [f.dataset.hot, f.textContent.trim()])', uid)

    def settings_tab(page):
        go(page, 'founder', '#admin')
        page.get_by_role('tab', name='Settings').click()
        page.wait_for_selector('#quiet-card')
        page.wait_for_timeout(150)

    def save_settings(page, cond):
        page.get_by_role('button', name='Save settings').click()
        until(page, '() => { const s = window.__db.get("settings/app") || {}; return !!(%s); }' % cond, 'the settings to save: ' + cond)

    def shot(page, sel, name):
        os.makedirs(SHOTS, exist_ok=True)
        page.locator(sel).first.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        page.locator(sel).first.screenshot(path=os.path.join(SHOTS, name + '.png'))

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    at = lambda hh, mm: datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST)  # noqa: E731
    ms = lambda hh, mm: int(at(hh, mm).timestamp() * 1000)  # noqa: E731
    today = tue.isoformat()
    monday = (tue - timedelta(days=1)).isoformat()

    # ---- the workspace: m1 reports to m2, in at 10:30, two saves, a clean record otherwise ----
    ctx = new_ctx(h, at(12, 0))
    p = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)
    # a fresh store gets the founder's own roster first; seeding before it lands would be overwritten
    until(p, '() => !!window.__db.get("roster/team")', 'the first roster')
    h.roster(p, [M1, M2, M3], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1', 'role': 'lead'}, M3: {'pod': 'Pod 2'}})
    week = p.evaluate('() => M.U.isoWeek(new Date())')
    h.seed_doc(p, 'checkin/' + M1, {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'office',
                                                      'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})
    h.seed_doc(p, 'me/' + M1, {'act': {today: {'1040': 1, '1045': 1}}})
    h.seed_doc(p, 'acks/' + M1, {'s': {s: ms(10, 31) for s in SECTIONS}})
    h.seed_doc(p, 'plan/' + M1, {'weeks': {week: {'items': [{'id': 'a', 'text': 'Swisse reel cut locked'}], 'at': ms(10, 35)}}})
    h.seed_doc(p, 'eod/' + M1, {'days': {monday: {'shipped': 'Scripts v3', 'next': 'Reel cut', 'blocked': '', 'at': ms(10, 0) - 15 * 3600000}}})
    until(p, '() => !!(M.lastCtx && (M.lastCtx.members.u_m2 || {}).role === "lead" && M.lastCtx.coll.me.map.u_m1 && M.lastCtx.coll.eod.map.u_m1)', 'the seed to land')
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_m1")') == M2, 'm1 reports to m2')
    check(h.ctx(p, 'M.RULE_IDS.indexOf("R17") === 16 && M.rules.NAMES.R17') == 'Keep work moving', 'R17 is Keep work moving')
    check(h.ctx(p, 'M.rules.SECTION_RULES("the-week")') == ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R17', 'R11'], 'R17 sits in the week')

    # ---- 12:00, two hours: 70 quiet minutes, nothing to flag yet ----
    m1 = open_page(h, ctx, 'm1', '#home', seed=True)
    go(m1, 'm1', '#home')
    check(r17(m1) == [], 'no R17 under the threshold: %r' % r17(m1))
    box = rulebox(m1)
    check('Keep work moving' not in box, 'the Rule box is clear: %r' % box)
    check(h.ctx(m1, 'M.quiet.day(ctx, "u_m1", M.U.todayStr(), {now: Date.now()}).idle.quietMs') == 70 * 60000, 'the running gap is 70 minutes')

    # ---- Admin: quiet stretch after, 60 minutes ----
    settings_tab(p)
    card = p.inner_text('#quiet-card')
    check('R17 on' in card and 'quiet stretch after' in card.lower(), 'the quiet card shows the switch: %r' % card[:120])
    check(p.input_value('#quiet-mins') == '120' and p.input_value('#lunch-from') == '13:30' and p.input_value('#lunch-to') == '14:30', 'defaults: 2 hours, lunch 13:30 to 14:30')
    check('flagged at 12:45' in p.inner_text('#quiet-example'), 'the strip example reads: %r' % p.inner_text('#quiet-example'))
    opts = p.evaluate('() => [...document.querySelectorAll("#quiet-mins option")].map(o => o.value)')
    check(opts == ['60', '90', '120', '150', '180', '240'], 'the six choices: %r' % opts)
    for wide in (1280, 390):
        p.set_viewport_size({'width': wide, 'height': 900})
        p.wait_for_timeout(250)
        check(h.overflow(p) == 0, 'no overflow on Admin settings at %d' % wide)
        shot(p, '#quiet-card', 'admin-quiet-%d-light' % wide)
    p.evaluate('M.theme.set("dark")')
    until(p, '() => document.documentElement.getAttribute("data-theme") === "dark"', 'the dark theme')
    shot(p, '#quiet-card', 'admin-quiet-390-dark')
    p.set_viewport_size({'width': 1280, 'height': 900})
    p.wait_for_timeout(250)
    shot(p, '#quiet-card', 'admin-quiet-1280-dark')
    p.evaluate('M.theme.set("light")')
    p.select_option('#quiet-mins', '60')
    check('flagged at 11:45' in p.inner_text('#quiet-example'), 'the example follows the choice: %r' % p.inner_text('#quiet-example'))
    save_settings(p, 's.quietMins === 60')
    until(p, '() => M.quiet.cfg(M.lastCtx).mins === 60', 'the quiet watch to read 60')

    # the flag appears earlier: high, in m1's own Rule box and on the manager's Your team
    go(m1, 'm1', '#home')
    f = r17(m1)
    check(len(f) == 1 and f[0]['severity'] == 'high' and f[0]['text'] == 'Nothing recorded on m360 since 10:50, 1h 10m', 'R17 high at 60 minutes: %r' % f)
    check(f[0]['key'] == 'R17:u_m1:1050' and f[0]['ref'] == '#today' and f[0]['section'] == 'the-week', 'key, ref and section: %r' % f)
    box = rulebox(m1)
    check('Keep work moving' in box and 'since 10:50, 1h 10m' in box, 'the Rule box shows it: %r' % box)
    m2 = open_page(h, ctx, 'm2', '#home', seed=True)
    go(m2, 'm2', '#home')
    m2.wait_for_selector('#team-u_m1')
    q = quiet_flags(m2)
    check(len(q) == 1 and q[0][0] == '1' and 'since 10:50' in q[0][1], 'the manager sees it, hot: %r' % q)

    # ---- the lunch fields validate, then save with the threshold back at two hours ----
    settings_tab(p)
    p.fill('#lunch-from', '14:30')
    p.fill('#lunch-to', '13:30')
    p.get_by_role('button', name='Save settings').click()
    p.wait_for_selector('text=Lunch has to end after it starts')
    p.wait_for_timeout(300)
    check(h.ctx(p, '[window.__db.get("settings/app").lunchFrom, window.__db.get("settings/app").lunchTo]') == ['13:30', '14:30'], 'a backwards lunch never saves')
    p.fill('#lunch-to', '')
    p.get_by_role('button', name='Save settings').click()
    p.wait_for_selector('text=Set both lunch times, or clear both for no lunch hour')
    p.wait_for_timeout(300)
    check(h.ctx(p, '[window.__db.get("settings/app").lunchFrom, window.__db.get("settings/app").lunchTo]') == ['13:30', '14:30'], 'half a lunch never saves')
    p.fill('#lunch-from', '13:30')
    p.fill('#lunch-to', '14:30')
    p.select_option('#quiet-mins', '120')
    save_settings(p, 's.quietMins === 120 && s.lunchFrom === "13:30" && s.lunchTo === "14:30"')
    until(p, '() => JSON.stringify(M.quiet.cfg(M.lastCtx).lunch) === "[810,870]" && M.quiet.cfg(M.lastCtx).mins === 120', 'the quiet watch to read the lunch hour')

    # ---- 14:40: the founder's example ----
    ctx.clock.set_fixed_time(at(14, 40))
    go(m1, 'm1', '#home')
    f = r17(m1)
    check(len(f) == 1 and f[0]['severity'] == 'high' and f[0]['text'] == 'Nothing recorded on m360 since 10:50, 2h 50m, lunch aside', 'the 14:40 flag: %r' % f)
    box = rulebox(m1)
    check('Nothing recorded on m360 since 10:50, 2h 50m, lunch aside' in box, 'the Rule box reads it: %r' % box)
    check(h.overflow(m1) == 0, 'no overflow on m1 Home at 1280')
    shot(m1, RULEBOX, 'rulebox-1280-light')
    m1.set_viewport_size({'width': 390, 'height': 844})
    go(m1, 'm1', '#home')
    rulebox(m1)
    check(h.overflow(m1) == 0, 'no overflow on m1 Home at 390')
    shot(m1, '#fold-rules', 'rulebox-390-light')
    m1.evaluate('M.theme.set("dark")')
    until(m1, '() => document.documentElement.getAttribute("data-theme") === "dark"', 'the dark theme')
    shot(m1, '#fold-rules', 'rulebox-390-dark')
    m1.evaluate('M.theme.set("light")')
    m1.set_viewport_size({'width': 1280, 'height': 900})
    go(m2, 'm2', '#home')
    m2.wait_for_selector('#team-u_m1')
    q = quiet_flags(m2)
    check(len(q) == 1 and q[0][0] == '1' and '2h 50m so far, lunch aside' in q[0][1], 'the manager reads the same stretch: %r' % q)

    # the founder's rule views: the Command flags, filtered to R17, and the week's live rules
    go(p, 'founder', '#command')
    p.select_option('select[aria-label="Rule filter"]', 'R17')
    p.wait_for_timeout(200)
    flags_card = p.locator('.card:has(select[aria-label="Rule filter"])').inner_text()
    check('Keep work moving' in flags_card and 'Nothing recorded on m360 since 10:50, 2h 50m, lunch aside' in flags_card, 'Command flags show R17 for m1: %r' % flags_card[:300])
    check('high' in flags_card.lower(), 'filed under high')
    go(p, 'founder', '#handbook/the-week')
    row = p.locator('.listrow:has-text("Keep work moving")')
    check(row.count() == 1 and '1 flag' in row.inner_text(), 'the live rules on the week list it: %r' % (row.inner_text() if row.count() else None))
    # a peer computes nothing about m1's day
    m3 = open_page(h, ctx, 'm3', '#home', seed=True)
    go(m3, 'm3', '#home')
    check(h.ctx(m3, 'ctx.canSee("u_m1")') is False and r17(m3) == [], 'm3 sees no quiet stretch of m1')

    # ---- no lunch hour: the whole gap counts ----
    settings_tab(p)
    p.click('#lunch-clear')
    check(p.input_value('#lunch-from') == '' and p.input_value('#lunch-to') == '', 'No lunch hour clears both')
    check(p.locator('#quiet-day .qr-lunch').count() == 0 and 'lunch' not in p.inner_text('#quiet-day'), 'the strip drops the lunch band')
    save_settings(p, 's.lunchFrom === "" && s.lunchTo === ""')
    go(m1, 'm1', '#home')
    f = r17(m1)
    check(len(f) == 1 and f[0]['text'] == 'Nothing recorded on m360 since 10:50, 3h 50m', 'with no lunch hour: %r' % f)

    # ---- a save at 15:00 closes the stretch: medium, keyed the same, with the day's status ----
    h.seed_doc(m1, 'me/' + M1, {'act': {today: {'1040': 1, '1045': 1, '1500': 1}}, 'status': {'text': 'At the Swisse shoot', 'at': ms(15, 1)}})
    ctx.clock.set_fixed_time(at(15, 30))
    go(m1, 'm1', '#home')
    f = r17(m1)
    check(len(f) == 1 and f[0]['severity'] == 'medium' and f[0]['text'] == 'Quiet from 10:50 to 15:00, 4h 10m, status: At the Swisse shoot'
          and f[0]['key'] == 'R17:u_m1:1050', 'closed, medium, with the status: %r' % f)

    # ---- R17 off in Admin: the whole watch stands down ----
    settings_tab(p)
    p.locator('label.checkline:has-text("R17 Keep work moving") input').click()
    check('R17 off' in p.inner_text('#quiet-card'), 'the card says R17 is off')
    save_settings(p, 's.rules && s.rules.R17 === false')
    go(m1, 'm1', '#home')
    check(r17(m1) == [] and 'Keep work moving' not in rulebox(m1), 'the Rule box drops R17')
    go(m2, 'm2', '#home')
    m2.wait_for_selector('#team-u_m1')
    check(quiet_flags(m2) == [], 'the manager has no quiet flags: %r' % quiet_flags(m2))
    check(h.ctx(m2, 'M.lines.watch(ctx, "u_m1").filter(x => x.k === "quiet").length') == 0, 'the watch carries none')
    go(p, 'founder', '#command')
    check(h.ctx(p, 'ctx.flags.filter(f => f.rule === "R17").length') == 0, 'Kaavish has none either')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
