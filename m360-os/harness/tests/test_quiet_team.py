#!/usr/bin/env python3
"""v30 test: quiet stretches for a manager and for the person, outside HQ.

m2 is the lead of Pod 1, so m1 reports to m2; m3 (Pod 2) is named as reporting to m2 too. On a
Tuesday with the clock at 14:40: m1 checked in at 10:30 and saved at 10:40 and 10:45, then nothing;
m3 checked in at 9:00 and saved at 9:05 and 11:30. m2's Your team carries one live quiet flag on m1
(hot, data-k quiet, the listening orb, "since 10:50", a link to m1's page) and two quiet lines on m3
in time order (the closed one first, then the running one). m2 opens m1's page: Today on m360 shows
the strip with a flame band, the lunch hour, a now line, the stretch in words and the week (Monday's
two stretches, today's running one). m3, a peer, sees no strip on m1's page; m1 sees their own. At
12:00 m1's Home is calm; at 12:30 (1h 40m quiet) it carries the nudge with its three buttons, each of
which goes where it says; adding a task from Home clears it at once and stamps the save. m3 answers
their nudge with a status, and m2 reads the status beside the flag. After a check-out the nudge never
shows. No overflow at 390, light and dark; no console errors.

Run: cd m360-os && python3 harness/tests/test_quiet_team.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
SHOTS = '/tmp/claude-0/-home-user-INDULGE/c70c5fa1-d903-5f8a-a380-0c7e1b00c68e/scratchpad/quiet30'


def new_ctx(h, fixed, width=1280):
    ctx = h.browser.new_context(viewport={'width': width, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
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


def goto(h, page, ident, hash):
    page.goto(h.url(ident, hash, seed=True))
    page.reload()
    h.ready(page)


def flags(page, uid):
    return page.evaluate('''u => [...document.querySelectorAll("#team-" + u + " .team-flag")].map(f =>
      [f.dataset.k, f.dataset.hot, f.dataset.live || "", f.textContent.trim()])''', uid)


def shot(page, name, sel=None):
    """A flame card sits in a beam that remounts it once the effects settle: let the page settle, try twice."""
    os.makedirs(SHOTS, exist_ok=True)
    path = os.path.join(SHOTS, name + '.png')
    for tries in (0, 1):
        page.wait_for_timeout(900)
        try:
            if sel:
                page.locator(sel).first.screenshot(path=path, timeout=10000)
            else:
                page.screenshot(path=path, full_page=True)
            return
        except Exception:
            if tries:
                raise


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    mon = tue - timedelta(days=1)
    at = lambda d, hh, mm: datetime(d.year, d.month, d.day, hh, mm, tzinfo=IST)  # noqa: E731
    ms = lambda d, hh, mm: int(at(d, hh, mm).timestamp() * 1000)  # noqa: E731
    today, monday = tue.isoformat(), mon.isoformat()

    ctx = new_ctx(h, at(tue, 14, 40))
    p = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, [M1, M2, M3], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1', 'role': 'lead'}, M3: {'pod': 'Pod 2', 'reportsTo': M2}})
    for u in (F, M1, M2, M3):
        h.seed_doc(p, 'checkin/' + u, {'days': {}})
        h.seed_doc(p, 'eod/' + u, {'days': {}})
    office = {'verified': True, 'place': 'Mumbai office'}
    h.seed_doc(p, 'checkin/' + M1, {'days': {
        monday: {'in': ms(mon, 10, 30), 'out': ms(mon, 19, 0), 'mode': 'office', 'loc': office, 'outLoc': None},
        today: {'in': ms(tue, 10, 30), 'out': None, 'mode': 'office', 'loc': office, 'outLoc': None}}})
    h.seed_doc(p, 'me/' + M1, {'act': {monday: {'1040': 1, '1100': 1, '1500': 1, '1800': 1}, today: {'1040': 1, '1045': 1}}})
    h.seed_doc(p, 'checkin/' + M3, {'days': {today: {'in': ms(tue, 9, 0), 'out': None, 'mode': 'office', 'loc': office, 'outLoc': None}}})
    h.seed_doc(p, 'me/' + M3, {'act': {today: {'0905': 1, '1130': 1}}})
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_m1")') == M2 and h.ctx(p, 'M.lines.managerOf(ctx, "u_m3")') == M2, 'm1 and m3 report to m2')

    # ---- 14:40, m2's Home: the live flag on m1, two quiet lines on m3 in time order ----
    m2 = open_page(h, ctx, 'm2', '#home', seed=True)
    m2.wait_for_selector('#team-watch #team-u_m1 .team-flag[data-k="quiet"]')
    f1 = [f for f in flags(m2, M1) if f[0] == 'quiet']
    check(len(f1) == 1, 'one quiet flag on m1: %r' % f1)
    k, hot, live, text = f1[0]
    check(hot == '1' and live == '1', 'the running stretch is hot and live: %r' % f1)
    check('since 10:50' in text and '2h 50m so far' in text and 'lunch aside' in text, 'the flag says since when: %r' % text)
    check(m2.locator('#team-u_m1 .team-flag[data-k="quiet"] .tf-live').count() == 1, 'the live line carries the live mark')
    check(m2.locator('#team-u_m1 .team-flag[data-k="quiet"] .dotflame').count() == 0, 'the live mark takes the place of the dot')
    f3 = [f for f in flags(m2, M3) if f[0] == 'quiet']
    check(len(f3) == 2, 'two quiet lines on m3: %r' % f3)
    check('from 09:10 to 11:30' in f3[0][3] and f3[0][2] == '0' and f3[0][1] == '0', 'the closed stretch first, not hot: %r' % f3[0])
    check('since 11:35' in f3[1][3] and f3[1][2] == '1' and f3[1][1] == '1', 'then the running one, hot and live: %r' % f3[1])
    check(m2.locator('#team-u_m3 .team-flag[data-k="quiet"] .tf-live').count() == 1, 'only the running line carries the live mark')
    items = m2.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "flag").map(i => i.id)')
    check(any(i.startswith('team:u_m1:quiet1050') for i in items) and any(i.startswith('team:u_m3:quiet0910') for i in items)
          and any(i.startswith('team:u_m3:quiet1135') for i in items), 'each stretch lands in the inbox once: %r' % items)
    shot(m2, 'team-1280', '#team-watch')
    m2.locator('#team-u_m1 .team-flag[data-k="quiet"] button').click()
    m2.wait_for_function('() => location.hash === "#people/u_m1"')
    check(True, 'the quiet flag links to #people/u_m1')

    # ---- m1's page as m2: the strip ----
    m2.wait_for_selector('#person-quiet')
    check(m2.locator('#person-quiet .pq-strip .pq-q').count() == 1, 'one flame band on the strip')
    check(m2.locator('#person-quiet .pq-strip .pq-q.live').count() == 1, 'the band runs to now')
    check(m2.locator('#person-quiet .pq-strip .pq-lunch').count() == 1 and m2.locator('#person-quiet .pq-strip .pq-now').count() == 1, 'lunch shaded and a now line')
    check(m2.locator('#person-quiet .pq-strip .pq-t').count() >= 2, 'a tick per mark')
    check(m2.locator('#person-quiet .pq-q .pq-ql').count() == 1, 'the lunch hour shows through the band')
    check(m2.inner_text('#person-quiet-state').strip() == 'quiet now', 'the card says quiet now: %r' % m2.inner_text('#person-quiet-state'))
    st = m2.inner_text('#person-quiet .pq-st')
    check('Since 10:50' in st and '2h 50m so far' in st, 'the stretch in words: %r' % st)
    label = m2.get_attribute('#person-quiet .pq-strip', 'aria-label')
    check('In at 10:30' in label and 'since 10:50' in label, 'the strip reads aloud: %r' % label)
    band = m2.evaluate('''() => { const s = document.querySelector("#person-quiet .pq-strip").getBoundingClientRect();
      const q = document.querySelector("#person-quiet .pq-q").getBoundingClientRect(); return [q.left - s.left, q.width, s.width, getComputedStyle(document.querySelector("#person-quiet .pq-q")).backgroundColor]; }''')
    check(band[1] > 40 and band[0] > 0 and band[3] == 'rgb(245, 57, 1)', 'the band is flame and wide: %r' % band)
    week = m2.evaluate('() => [...document.querySelectorAll("#person-quiet-week .pq-wk")].map(r => [r.dataset.ymd, r.textContent.trim()])')
    check(len(week) == 2 and week[0][0] == monday and week[1][0] == today, 'the week, Monday to today: %r' % week)
    check(week[0][1].startswith('Mon') and '2 quiet stretches, longest 2h 55m' in week[0][1], 'Monday in a line: %r' % week[0])
    check(week[1][1].startswith('Today') and '1 quiet stretch, 2h 50m, one running now' in week[1][1], 'today in a line: %r' % week[1])
    shot(m2, 'person-1280', '#person-quiet')
    m2.evaluate('M.theme.set("dark")')
    m2.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    m2.wait_for_timeout(300)
    shot(m2, 'person-1280-dark', '#person-quiet')
    m2.evaluate('M.theme.set("light")')

    # ---- m3, a peer, sees no strip on m1's page; m1 sees their own ----
    m3 = open_page(h, ctx, 'm3', '#people/u_m1', seed=True)
    m3.wait_for_selector('#person-head')
    m3.wait_for_timeout(400)
    check(m3.locator('#person-quiet').count() == 0, 'a peer sees no quiet strip')
    goto(h, m3, 'm3', '#people/u_m3')
    m3.wait_for_selector('#person-quiet')
    check(m3.locator('#person-quiet .pq-q').count() == 2 and m3.locator('#person-quiet .pq-q.live').count() == 1, 'm3 sees their own day, both stretches in flame')
    m1 = open_page(h, ctx, 'm1', '#people/u_m1', seed=True)
    m1.wait_for_selector('#person-quiet')
    check('Your manager sees this too' in m1.inner_text('#person-quiet'), 'the person sees their own strip, and who else does')
    goto(h, m1, 'm1', '#people/u_m2')
    m1.wait_for_selector('#person-head')
    m1.wait_for_timeout(400)
    check(m1.locator('#person-quiet').count() == 0, 'm1 sees no strip on their manager')

    # ---- m3 answers their own nudge with a status; m2 reads it beside the flag ----
    goto(h, m3, 'm3', '#home')
    m3.wait_for_selector('#quiet-nudge')
    check('Nothing saved since 11:35' in m3.inner_text('#quiet-nudge'), 'm3 has the nudge: %r' % m3.inner_text('#quiet-nudge'))
    m3.click('#qn-status')
    m3.wait_for_selector('.drawer')
    m3.locator('.drawer').get_by_role('button', name='In a meeting').click()
    m3.wait_for_selector('#quiet-nudge', state='detached')
    check(True, 'a status answers the nudge')
    goto(h, m2, 'm2', '#home')
    m2.wait_for_selector('#team-u_m3 .team-flag[data-k="quiet"][data-live="1"]')
    check('status: In a meeting' in m2.inner_text('#team-u_m3 .team-flag[data-live="1"]'), 'the manager reads the status with the flag')

    # ---- phone, 390: Your team and the strip fit ----
    m2.set_viewport_size({'width': 390, 'height': 844})
    goto(h, m2, 'm2', '#home')
    m2.wait_for_selector('#fold-team')
    if m2.locator('#team-watch').count() == 0:
        m2.click('#fold-team .fold-head')
    m2.wait_for_selector('#team-watch .team-flag[data-k="quiet"]')
    check(h.overflow(m2) <= 0, 'm2 Home fits at 390: %d' % h.overflow(m2))
    shot(m2, 'team-390', '#team-watch')
    goto(h, m2, 'm2', '#people/u_m1')
    m2.wait_for_selector('#person-quiet .pq-q')
    check(h.overflow(m2) <= 0, 'the person page fits at 390: %d' % h.overflow(m2))
    hrs = m2.evaluate('() => [...document.querySelectorAll("#person-quiet .pq-hours span")].filter(s => getComputedStyle(s).display !== "none").map(s => s.getBoundingClientRect()).map(r => [r.left, r.right])')
    check(all(hrs[i][1] <= hrs[i + 1][0] for i in range(len(hrs) - 1)), 'hour labels never overlap at 390: %r' % hrs)
    shot(m2, 'person-390', '#person-quiet')
    m2.evaluate('M.theme.set("dark")')
    m2.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    m2.wait_for_timeout(300)
    check(h.overflow(m2) <= 0, 'the person page fits at 390 in the dark')
    shot(m2, 'person-390-dark', '#person-quiet')
    m2.evaluate('M.theme.set("light")')
    # reduced motion: the live mark holds still and still reads
    m2.emulate_media(reduced_motion='reduce')
    goto(h, m2, 'm2', '#home')
    m2.wait_for_selector('#fold-team')
    if m2.locator('#team-watch').count() == 0:
        m2.click('#fold-team .fold-head')
    m2.wait_for_selector('#team-u_m1 .team-flag[data-live="1"] .tf-live')
    box = m2.locator('#team-u_m1 .team-flag[data-live="1"] .tf-live').bounding_box()
    check(box and box['width'] >= 12 and box['height'] >= 12, 'the live mark shows with reduced motion: %r' % box)
    m2.emulate_media(reduced_motion='no-preference')

    # ---- m1's own Home: calm at 12:00, the nudge at 12:30 ----
    ctx.clock.set_fixed_time(at(tue, 12, 0))
    goto(h, m1, 'm1', '#home')
    m1.wait_for_selector('#home-hero')
    m1.wait_for_timeout(400)
    check(m1.locator('#quiet-nudge').count() == 0, 'no nudge at 1h 10m quiet')
    ctx.clock.set_fixed_time(at(tue, 12, 30))
    goto(h, m1, 'm1', '#home')
    m1.wait_for_selector('#quiet-nudge')
    txt = m1.inner_text('#quiet-nudge')
    check('Nothing saved since 10:50. Move a task, post what you are on, or set a status.' in txt, 'the nudge line: %r' % txt)
    check('After 2 hours with nothing saved' in txt, 'it says when the manager hears: %r' % txt)
    check(m1.locator('#qn-board').count() == 1 and m1.locator('#qn-post').count() == 1 and m1.locator('#qn-status').count() == 1, 'three buttons')
    check(m1.evaluate('() => document.querySelector("#quiet-nudge").compareDocumentPosition(document.querySelector("#home-hero")) & Node.DOCUMENT_POSITION_PRECEDING') != 0, 'the nudge sits under the hero')
    shot(m1, 'nudge-1280', '#quiet-nudge')
    m1.click('#qn-board')
    m1.wait_for_function('() => location.hash.startsWith("#tasks")')
    check(True, 'Open the board opens the board')
    goto(h, m1, 'm1', '#home')
    m1.click('#qn-post')
    m1.wait_for_function('() => location.hash.startsWith("#feed")')
    check(True, 'Post an update opens the feed composer')
    goto(h, m1, 'm1', '#home')
    m1.click('#qn-status')
    m1.wait_for_selector('.drawer')
    check('Set your status' in m1.inner_text('.drawer'), 'Set a status opens the status picker')
    m1.keyboard.press('Escape')
    m1.wait_for_selector('.drawer', state='detached')
    check(m1.locator('#quiet-nudge').count() == 1, 'closing the picker keeps the nudge')
    # the phone and the dark theme
    m1.set_viewport_size({'width': 390, 'height': 844})
    m1.wait_for_timeout(300)
    check(h.overflow(m1) <= 0, 'the nudge fits at 390: %d' % h.overflow(m1))
    shot(m1, 'nudge-390', '#quiet-nudge')
    m1.evaluate('M.theme.set("dark")')
    m1.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    m1.wait_for_timeout(300)
    shot(m1, 'nudge-390-dark', '#quiet-nudge')
    m1.evaluate('M.theme.set("light")')
    m1.set_viewport_size({'width': 1280, 'height': 900})
    m1.wait_for_timeout(300)
    # a task added from Home clears it at once, and the save is stamped
    m1.fill('#quick-add', 'Draft the creator brief')
    m1.press('#quick-add', 'Enter')
    m1.wait_for_selector('#quiet-nudge', state='detached', timeout=20000)
    check(True, 'saving a task clears the nudge')
    m1.wait_for_function('() => ((((window.__db.get("me/u_m1") || {}).act || {})[M.U.todayStr()]) || {})["1230"] === 1')
    check(True, 'the save is stamped at 12:30')

    # ---- after a check-out the nudge never shows ----
    h.seed_doc(m1, 'checkin/' + M3, {'days': {today: {'in': ms(tue, 9, 0), 'out': ms(tue, 12, 0), 'mode': 'office', 'loc': office, 'outLoc': None}}})
    ctx.clock.set_fixed_time(at(tue, 15, 0))
    goto(h, m3, 'm3', '#home')
    m3.wait_for_selector('#home-hero')
    m3.wait_for_timeout(400)
    check(m3.locator('#quiet-nudge').count() == 0, 'no nudge after the check-out')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
