#!/usr/bin/env python3
"""v33 test: the COO's runner on the claude.ai page (spec part J, M.coo.Runner).

The page runs the COO only for Kaavish, on his own visible page, with the COO on, and never on the team
site (window.M360_API), where the server heartbeat runs it. A working Tuesday next week at 12:30 IST, with
nothing run yet today. Checks:
- one founder tab runs the due slots and claims each in coo/slots-<ymd>; catch-up runs only the latest
  watch slot (w1230), lists open and r10 as skipped late, and runs brief, the roll call, r11 and r12 once;
- two founder tabs in one browser: one tab leads, every claim carries one tab id, the roll call runs once;
- two pages with no BroadcastChannel between them (two devices): the slots doc still lets each slot run
  once, and the roll call runs once;
- a member's page, Kaavish previewing as a member (viewAs), the team site, the COO off, and Kaavish's own
  page while it is hidden: nothing is claimed.

Fails until builders 1 and 2 are merged (the runner and the place it is mounted); the message says so.

Run: cd m360-os && python3 harness/tests/test_coo_runner.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
# a tab in the background from its first moment: the runner waits for it to be seen
HIDDEN = ('Object.defineProperty(document, "visibilityState", {configurable: true, get: () => "hidden"});'
          'Object.defineProperty(document, "hidden", {configurable: true, get: () => true});')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()
    noon = datetime(tue.year, tue.month, tue.day, 12, 30, tzinfo=IST)

    def browser(init=''):
        c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
        h.contexts.append(c)
        c.clock.set_fixed_time(noon)
        if init:
            c.add_init_script(init)
        return c

    def page(c, init=''):
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        if init:
            p.add_init_script(init)
        return p

    def seed(p, on=True):
        p.goto(h.url('founder', '#home', reset=True, seed=True))
        h.ready(p)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        h.roster(p, [M1, M2, M3])
        s = p.evaluate('() => window.__db.get("settings/app") || {}')
        s['coo'] = {'on': on, 'title': 'm360 COO', 'signedAt': int(noon.timestamp() * 1000) - 9 * 86400000, 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
        h.seed_doc(p, 'settings/app', s)

    def go(p, ident='founder', hash='#home'):
        p.goto(h.url(ident, hash))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.lastCtx.activeMembers.length >= 3)')

    def slots(p):
        return p.evaluate('d => window.__db.get("coo/slots-" + d) || {}', today) or {}

    def rows(p, job, slot='roll1045'):
        acts = (p.evaluate('d => window.__db.get("coo/L-" + d) || {}', today) or {}).get('acts') or {}
        return [a for a in acts.values() if a.get('job') == job and a.get('slot') == slot and a.get('status') not in ('skipped',)]

    def ran(p, n=25):
        for _ in range(n):
            s = slots(p)
            if s.get('r12', {}).get('state') == 'done' and s.get('w1230', {}).get('state') == 'done':
                return s
            p.wait_for_timeout(1000)
        return slots(p)

    # ---- one tab: catch-up runs the latest only ----
    c1 = browser()
    a = page(c1)
    seed(a)
    go(a)
    if not a.evaluate('() => !!(M.coo && M.coo.Runner)'):
        raise AssertionError('M.coo.Runner is not on the page: this test runs once builders 1 and 2 are merged')
    s = ran(a)
    ws = sorted(k for k in s if k.startswith('w'))
    check(ws == ['w1230'], 'catch-up runs the latest watch slot only: %r' % ws)
    check((s.get('open') or {}).get('state') == 'skipped' and (s.get('r10') or {}).get('state') == 'skipped', 'open and r10 are past lateMax and listed skipped: %r' % {k: s.get(k) for k in ('open', 'r10')})
    check(all((s.get(k) or {}).get('state') == 'done' for k in ('brief', 'r11', 'r12')) and any(k.startswith('roll') for k in s), 'brief, r11, r12 and the roll call ran: %r' % sorted(s))
    check(len(rows(a, 'J03')) == 1, 'the 10:45 roll call ran once: %r' % [r.get('slot') for r in rows(a, 'J03')])
    now = a.evaluate('() => window.__db.get("coo/now") || {}')
    check(((now.get('pass') or {}).get('by')) == 'page', 'coo/now says the page ran it: %r' % now.get('pass'))

    # ---- two tabs in one browser: one leads ----
    c2 = browser()
    b1 = page(c2)
    seed(b1)
    b2 = page(c2)
    go(b1)
    go(b2)
    s = ran(b1)
    ids = {v.get('id') for k, v in s.items() if isinstance(v, dict) and v.get('state') == 'done'}
    check(len(ids) == 1, 'one tab leads: every claim carries one tab id: %r' % ids)
    check(len(rows(b1, 'J03')) == 1 and len([k for k in s if k.startswith('w')]) == 1, 'the roll call and the watch slot ran once')

    # ---- two devices: no channel between them, the slots doc still claims once ----
    c3 = browser(init='try { delete window.BroadcastChannel; window.BroadcastChannel = undefined; } catch (e) {}')
    d1 = page(c3)
    seed(d1)
    d2 = page(c3)
    go(d1)
    go(d2)
    s = ran(d1)
    d1.wait_for_timeout(3000)
    s = slots(d1)
    check(len(rows(d1, 'J03')) == 1 and len([k for k in s if k.startswith('w')]) == 1, 'two devices: each slot runs once through the claim: %r' % [sorted(s), [(r.get('slot'), r.get('status'), r.get('at')) for r in rows(d1, 'J03')], s.get('roll1045')])
    done_ids = [v.get('id') for v in s.values() if isinstance(v, dict) and v.get('state') == 'done']
    check(done_ids and all(done_ids), 'and each settled slot names the tab that ran it: %r' % done_ids)

    # ---- never: a member, viewAs, the team site, the COO off ----
    for label, init, ident, on, view in (('a member', '', 'm1', True, False), ('viewAs', '', 'founder', True, True),
                                         ('the team site', 'window.M360_API = async () => ({ok: true});', 'founder', True, False),
                                         ('the COO off', '', 'founder', False, False),
                                         ('a hidden page', HIDDEN, 'founder', True, False)):
        c = browser()
        p = page(c)
        seed(p, on=False)
        p.close()
        q = page(c, init)
        go(q, ident)
        if view:
            q.evaluate('() => M.viewAs.set("u_m1")')
            q.wait_for_timeout(500)
        if on:
            q.evaluate('() => { const s = window.__db.get("settings/app"); window.__db.set("settings/app", {...s, coo: {...s.coo, on: true}}); }')
        q.wait_for_timeout(6000)
        check(not slots(q), '%s: nothing is claimed, nothing runs: %r' % (label, slots(q)))
        c.close()

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
