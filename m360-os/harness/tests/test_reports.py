#!/usr/bin/env python3
"""v27 test: who reports to whom, and the manager's watch.

m2 is the lead of Pod 1, so m1 (Pod 1, nobody named) reports to m2; m3 is named as reporting to m2 on
the roster by the founder from Admin; m2 reports to Kaavish. With the clock pinned at 11:30 on a
working day, nobody in: m2's Home carries Your team with a hot "has not checked in" on both reports,
the same flags land in m2's inbox, and the founder's Your team shows m2 only. m2 can open m1's
scorecard (private detail); m1 cannot open m3's. The person page says who reports to whom. At 15:00
with m1 in late and nothing moved on their tasks: late and idle. At 20:45 with no check-out and no EOD
line: both flagged, and an overdue task on m3 counts. A report on approved leave carries no flags.
v33: a task the m360 COO handed m1 a minute ago (updatedBy u_m360coo) is not m1's own movement, so m1
stays idle until m1 moves something.

Run: cd m360-os && python3 harness/tests/test_reports.py
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


def new_ctx(h, fixed):
    ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(ctx)
    ctx.clock.set_fixed_time(fixed)
    return ctx


def open_page(h, ctx, ident, hash, **params):
    page = ctx.new_page()
    page.set_default_timeout(8000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hash, **params))
    h.ready(page)
    return page


def flags(page, uid):
    return page.evaluate('u => [...document.querySelectorAll("#team-" + u + " .team-flag")].map(f => [f.dataset.k, f.dataset.hot, f.textContent.trim()])', uid)


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    # a Tuesday next week, 11:30 IST: a working day with nobody in yet
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    t_morning = datetime(tue.year, tue.month, tue.day, 11, 30, tzinfo=IST)
    today = tue.isoformat()
    yesterday = (tue - timedelta(days=1)).isoformat()

    ctx = new_ctx(h, t_morning)
    p = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, [M1, M2, M3], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1', 'role': 'lead'}, M3: {'pod': 'Pod 2'}})
    # the day's checkins are the seed's: clear them so the morning is quiet
    for u in (F, M1, M2, M3):
        h.seed_doc(p, 'checkin/' + u, {'days': {}})
        h.seed_doc(p, 'eod/' + u, {'days': {}})

    # ---- the founder names m3's manager from Admin ----
    p.goto(h.url('founder', '#admin', seed=True))
    h.ready(p)
    row = p.locator('table.tbl tr', has_text='M360-004')
    row.get_by_role('button', name='Edit').click()
    p.wait_for_selector('#desk-reports')
    p.select_option('#desk-reports', M2)
    p.locator('.drawer').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_function('() => (window.__db.get("roster/team").members.u_m3 || {}).reportsTo === "u_m2"')
    check(True, 'reports to is on the roster line')
    # the page catches up with the saved roster a moment after the store does
    p.wait_for_function('() => M.lastCtx && M.lines.managerOf(M.lastCtx, "u_m3") === "u_m2"', timeout=15000)
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_m1")') == M2, 'm1 reports to the pod lead')
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_m3")') == M2, 'm3 reports to m2 by name')
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_m2")') == F, 'm2 reports to Kaavish')
    check(h.ctx(p, 'M.lines.managerOf(ctx, "u_founder")') is None, 'Kaavish reports to nobody')
    check(sorted(h.ctx(p, 'M.lines.reportsOf(ctx, "u_m2")')) == [M1, M3], 'm2 has two reports')

    # ---- the founder's Home: Your team shows m2, who has not checked in ----
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.wait_for_selector('#team-watch')
    check(p.locator('#team-watch .team-row').count() == 1 and p.locator('#team-u_m2').count() == 1, 'the founder watches m2 alone')
    f2 = flags(p, M2)
    check(any(k == 'noin' and hot == '1' for k, hot, _ in f2), 'm2 not checked in, hot: %r' % f2)

    # ---- m2's Home: both reports, both not in ----
    m2 = open_page(h, ctx, 'm2', '#home', seed=True)
    m2.wait_for_selector('#team-watch')
    check(m2.locator('#team-u_m1').count() == 1 and m2.locator('#team-u_m3').count() == 1, 'm2 sees m1 and m3')
    check(any(k == 'noin' for k, _, _ in flags(m2, M1)) and any(k == 'noin' for k, _, _ in flags(m2, M3)), 'both reports flagged for no check-in')
    check('has not checked in' in m2.inner_text('#team-u_m1').lower(), 'the flag reads in words: %r' % m2.inner_text('#team-u_m1')[:80])
    check(m2.locator('#team-watch.flame').count() == 1, 'the card is hot')
    # and in m2's inbox
    items = m2.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "flag").map(i => i.id)')
    check(any(i.startswith('team:u_m1:noin:') for i in items) and any(i.startswith('team:u_m3:noin:') for i in items), 'the watch lands in the inbox: %r' % items[:4])
    m2.locator('.bellbtn').first.click()
    m2.wait_for_selector('.drawer')
    check('has not checked in' in m2.inner_text('.drawer'), 'the inbox drawer says it')
    m2.keyboard.press('Escape')
    # a manager sees private detail; a peer does not
    m2.goto(h.url('m2', '#people/u_m1', seed=True))
    h.ready(m2)
    m2.wait_for_selector('#person-head')
    check(m2.get_by_role('tab', name='Scorecard').count() == 1, 'm2 opens m1 detail')
    check('reports to' in m2.inner_text('#person-reports'), 'the person page says who m1 reports to')
    m2.goto(h.url('m2', '#people/u_m2', seed=True))
    h.ready(m2)
    m2.wait_for_selector('#person-reports')
    check('2 reports' in m2.inner_text('#person-reports') and 'reports to' in m2.inner_text('#person-reports'), 'm2 page: reports to Kaavish, two reports: %r' % m2.inner_text('#person-reports'))
    m1 = open_page(h, ctx, 'm1', '#people/u_m3', seed=True)
    m1.wait_for_selector('#person-head')
    check(m1.get_by_role('tab', name='Scorecard').count() == 0, 'a peer sees no private detail')
    check(m1.locator('#team-watch').count() == 0, 'm1 has no team')
    m1.goto(h.url('m1', '#home', seed=True))
    h.ready(m1)
    check(m1.locator('#team-watch').count() == 0, 'no Your team on m1 Home')

    # ---- 15:00: m1 came in late and has not moved a task; m3 is on approved leave ----
    t_noon = datetime(tue.year, tue.month, tue.day, 15, 0, tzinfo=IST)
    in_late = int(datetime(tue.year, tue.month, tue.day, 11, 10, tzinfo=IST).timestamp() * 1000)
    h.seed_doc(m2, 'checkin/' + M1, {'days': {today: {'in': in_late, 'out': None, 'mode': 'office', 'loc': {'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})
    # the seed stamped m1's tasks today; age them so the afternoon is quiet
    m2.evaluate('''() => { const s = window.__db.store(); const old = Date.now() - 3 * 86400000;
      for (const k of Object.keys(s)) if (k.startsWith('tasks/')) { const t = s[k]; if (t && (t.owner === 'u_m1' || t.by === 'u_m1' || t.approvedBy === 'u_m1')) window.__db.set(k, {...t, created: old, updated: old, approvedAt: t.approvedAt ? old : t.approvedAt, comments: {}}); } }''')
    h.seed_doc(m2, 'leave/' + M3, {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'kind': 'casual', 'note': 'family', 'at': in_late}]})
    h.seed_doc(m2, 'leavedec/' + M3, {'d': {'L1': {'status': 'approved', 'by': F, 'at': in_late}}})
    ctx.clock.set_fixed_time(t_noon)
    m2.goto(h.url('m2', '#home', seed=True))
    m2.reload()
    h.ready(m2)
    m2.wait_for_selector('#team-watch')
    f1 = flags(m2, M1)
    check(any(k == 'late' for k, _, _ in f1), 'late check-in flagged: %r' % f1)
    check(any(k == 'idle' and hot == '1' for k, hot, _ in f1), 'nothing moved: %r, hour %r, ctx %r, tasks %r' % (f1, m2.evaluate('() => new Date().getHours()'), h.ctx(m2, '[ctx.now, new Date(ctx.now).getHours(), new Date(ctx.now).getMinutes(), M.lines.watch(ctx, "u_m1").map(f => f.k), M.att.dayStatus(ctx, "u_m1", M.U.todayStr()).in]'), m2.evaluate('''() => { const s = window.__db.store(); const day = new Date(); day.setHours(0,0,0,0); const out = []; for (const k of Object.keys(s)) if (k.startsWith('tasks/')) { const t = s[k]; if (t && (t.owner === 'u_m1' || t.by === 'u_m1' || t.approvedBy === 'u_m1')) out.push([k, t.updated >= day.getTime(), t.created >= day.getTime(), t.approvedBy === 'u_m1' && t.approvedAt >= day.getTime(), Object.keys(t.comments || {}).filter(c => t.comments[c].by === 'u_m1' && t.comments[c].at >= day.getTime()).length]); } return out; }''')))
    check(not any(k == 'noin' for k, _, _ in f1), 'no more "not checked in" once in')
    check(not flags(m2, M3) and 'on leave' in m2.inner_text('#team-u_m3'), 'leave carries no flags: %r' % flags(m2, M3))
    now_ms = int(t_noon.timestamp() * 1000)
    # the COO handing m1 a task is not m1 moving it: still idle
    h.seed_doc(m2, 'tasks/tr0', {'title': 'Studio banner', 'owner': M1, 'by': F, 'status': 'todo', 'due': today, 'created': now_ms - 86400000 * 3, 'updated': now_ms - 60000,
                                 'updatedBy': 'u_m360coo', 'ownerLog': [{'from': M3, 'to': M1, 'by': 'u_m360coo', 'at': now_ms - 60000, 'why': 'leave'}]})
    m2.goto(h.url('m2', '#home', seed=True))
    m2.reload()
    h.ready(m2)
    m2.wait_for_selector('#team-watch')
    m2.wait_for_function('() => !!(M.lastCtx && M.lastCtx.coll.tasks.map.tr0)')
    check(any(k == 'idle' for k, _, _ in flags(m2, M1)), 'a task the COO handed over is not the owner moving it: %r' % flags(m2, M1))
    # a move on a task clears idle
    h.seed_doc(m2, 'tasks/tr1', {'title': 'Cut the teaser', 'owner': M1, 'by': M1, 'status': 'doing', 'due': today, 'created': now_ms - 3600000, 'updated': now_ms - 60000})
    m2.goto(h.url('m2', '#home', seed=True))
    m2.reload()
    h.ready(m2)
    m2.wait_for_selector('#team-watch')
    check(not any(k == 'idle' for k, _, _ in flags(m2, M1)), 'a moved task clears idle: %r' % flags(m2, M1))

    # ---- 20:45: no check-out, no EOD line; an overdue task on m3 (back from leave tomorrow, still counts) ----
    t_night = datetime(tue.year, tue.month, tue.day, 20, 45, tzinfo=IST)
    h.seed_doc(m2, 'tasks/tr2', {'title': 'Send the deck', 'owner': M3, 'by': F, 'status': 'todo', 'due': yesterday, 'created': now_ms - 86400000 * 2, 'updated': now_ms - 86400000 * 2})
    h.seed_doc(m2, 'leavedec/' + M3, {'d': {}})
    ctx.clock.set_fixed_time(t_night)
    m2.goto(h.url('m2', '#home', seed=True))
    m2.reload()
    h.ready(m2)
    m2.wait_for_selector('#team-watch')
    f1 = flags(m2, M1)
    check(any(k == 'noout' for k, _, _ in f1), 'no check-out flagged: %r' % f1)
    check(any(k == 'noeod' and hot == '1' for k, hot, _ in f1), 'no EOD line flagged: %r' % f1)
    f3 = flags(m2, M3)
    check(any(k == 'overdue' and '1 overdue task' in txt for k, _, txt in f3), 'the overdue task counts: %r' % f3)
    check(any(k == 'noeod' for k, _, _ in f3), 'm3 owes an EOD line too: %r' % f3)
    h.shot(m2, 'reports-home-1280')
    # a flag opens the person
    m2.locator('#team-u_m1 .team-flag[data-k="noeod"] button').click()
    m2.wait_for_selector('#person-head')
    check('reports to' in m2.inner_text('#person-reports'), 'Open lands on the person')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
