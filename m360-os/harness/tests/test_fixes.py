#!/usr/bin/env python3
"""v5 test: correction requests and the activity log. A member asks for a check-in time to be put
right, the founder approves it from Admin > Controls > Corrections and the day changes; a second
request is declined with a note the member reads on Me and in the inbox; every write shows up on
the founder's Log tab and in log/<uid>/days/<today>; the queue and the log fit a phone.

Run: cd m360-os && python3 harness/tests/test_fixes.py
"""
import os
import re
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed, browser_today  # noqa: E402


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    now = browser_today(p)
    monday = (now - timedelta(days=now.weekday())).strftime('%Y-%m-%d')
    today = p.evaluate('M.U.todayStr()')
    before = doc(p, 'checkin/u_m1')['days'][monday]

    # ---- m1 asks for the Monday check-in to read 09:45 ----
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#fix-card')
    check('Something wrong?' in p.inner_text('#fix-card'), 'card title missing')
    p.click('#fix-open')
    p.wait_for_selector('#fix-drawer')
    p.fill('#fix-date', monday)
    p.fill('#fix-want', '09:45')
    p.fill('#fix-note', 'I was at the office at 09:40 and the check-in did not go through until later.')
    p.click('#fix-send')
    p.wait_for_function('() => { const d = window.__db.get("fixes/u_m1"); return d && Object.values(d.reqs || {}).some(r => r.want === "09:45"); }')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    reqs = doc(p, 'fixes/u_m1')['reqs']
    att_id = next(k for k, r in reqs.items() if r['want'] == '09:45')
    r1 = reqs[att_id]
    check(r1['kind'] == 'attendance' and r1['field'] == 'in' and r1['date'] == monday and r1['status'] == 'pending', 'request shape %r' % r1)
    check('pending' in p.inner_text('#fix-card'), 'pending pill missing on Me')

    # ---- a second request about a task, to be declined ----
    p.click('#fix-open')
    p.wait_for_selector('#fix-drawer')
    p.locator('#fix-drawer').get_by_role('tab', name='Task').click()
    p.fill('#fix-want', 'Due on Friday')
    p.fill('#fix-note', 'The client moved the shoot.')
    p.click('#fix-send')
    p.wait_for_function('() => Object.keys((window.__db.get("fixes/u_m1") || {}).reqs || {}).length === 2')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    reqs = doc(p, 'fixes/u_m1')['reqs']
    task_id = next(k for k, r in reqs.items() if r['kind'] == 'task')
    check(reqs[task_id]['field'] == 'status', 'task field default %r' % reqs[task_id].get('field'))
    check(len(h.ctx(p, 'M.fixes.pending(ctx)')) == 2, 'M.fixes.pending for the member')

    # ---- the log doc for m1 holds the fixes write (log/<uid>/days/<date>, a {self} shaped rule) ----
    log_m1 = doc(p, 'log/u_m1/days/%s' % today)
    check(bool(log_m1), 'log/u_m1/days/%s missing' % today)
    if log_m1:
        check(any(str(e.get('p', '')).startswith('fixes/') for e in log_m1['e'].values()), 'log for m1 missing a fixes entry: %r' % log_m1)
        entry = next(e for e in log_m1['e'].values() if str(e.get('p', '')).startswith('fixes/'))
        check(entry['a'] == 'set' and entry['s'] == 'reqs' and entry['at'] > 0, 'log entry shape %r' % entry)
        check(all(re.match(r'^\d{13}[a-z0-9]{4}$', k) for k in log_m1['e']), 'log entry ids %r' % list(log_m1['e'])[:3])

    # ---- the founder: inbox item, then the Corrections tab ----
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    body = p.inner_text('.drawer')
    check('Durvesh Patil asked for a correction: attendance' in body, 'founder inbox missing the request: ' + body[:300])
    p.locator('.drawer').get_by_role('button', name='Close').click()
    p.wait_for_function('() => !document.querySelector(".drawer")')
    check(len(h.ctx(p, 'M.fixes.pending(ctx)')) == 2, 'M.fixes.pending for the founder')

    h.go(p, 'founder', hash='#admin', width=1280)
    p.get_by_role('tab', name=re.compile(r'^Corrections')).click()
    p.wait_for_selector('#fix-queue')
    qtext = p.inner_text('#fix-queue')
    check('Durvesh Patil' in qtext and '09:45' in qtext and 'Due on Friday' in qtext, 'queue text: ' + qtext[:400])
    check('2 pending' in qtext, 'pending count pill: ' + qtext[:200])
    h.shot(p, 'fixes-queue')

    # approve the check-in: the day now reads 09:45, the rest of the entry is kept
    p.locator('#fix-' + att_id).get_by_role('button', name='Approve').click()
    expected = p.evaluate('M.U.parseYmd("%s").getTime() + 585 * 60000' % monday)
    p.wait_for_function('() => ((window.__db.get("fixes/u_m1").reqs["%s"] || {}).status) === "approved"' % att_id)
    after = doc(p, 'checkin/u_m1')['days'][monday]
    check(after['in'] == expected, 'check-in not applied: %r vs %r' % (after.get('in'), expected))
    check(after['out'] == before['out'] and after['mode'] == before['mode'] and after['loc'] == before['loc'], 'day entry lost fields: %r' % after)
    check(p.evaluate('M.U.hhmm(window.__db.get("checkin/u_m1").days["%s"].in)' % monday) == '09:45', 'hhmm of the new in')
    check(h.ctx(p, 'M.att.dayStatus(ctx, "u_m1", "%s").late' % monday) is False, 'late mark should clear at 09:45')
    r1 = doc(p, 'fixes/u_m1')['reqs'][att_id]
    check(r1.get('decidedAt') and r1.get('decidedNote') == '', 'decision fields %r' % r1)

    # decline the task request with a note
    p.locator('#fix-' + task_id).get_by_role('button', name='Decline').click()
    p.fill('#fix-decline-' + task_id, 'Friday is the shoot day, the brief stays due Thursday.')
    p.locator('#fix-' + task_id).get_by_role('button', name='Decline').click()
    p.wait_for_function('() => ((window.__db.get("fixes/u_m1").reqs["%s"] || {}).status) === "declined"' % task_id)
    r2 = doc(p, 'fixes/u_m1')['reqs'][task_id]
    check(r2['decidedNote'].startswith('Friday is the shoot day'), 'decline note %r' % r2)
    p.wait_for_selector('#fix-past')
    check('Nothing waiting' in p.inner_text('#fix-queue'), 'queue not empty after decisions')
    check(len(h.ctx(p, 'M.fixes.pending(ctx)')) == 0, 'pending after decisions')

    # ---- m1 reads both decisions on Me and in the inbox ----
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#fix-card')
    mtext = p.inner_text('#fix-card')
    check('approved' in mtext and 'declined' in mtext, 'statuses on Me: ' + mtext[:300])
    check('Kaavish: Friday is the shoot day' in mtext, 'decline note not shown to m1: ' + mtext[:300])
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    body = p.inner_text('.drawer')
    check('Correction declined, task: Friday is the shoot day' in body, 'member inbox missing the decline: ' + body[:300])
    check('Correction approved, attendance' in body, 'member inbox missing the approval: ' + body[:300])
    p.locator('.drawer').get_by_role('button', name='Close').click()
    p.wait_for_function('() => !document.querySelector(".drawer")')

    # deep link from anywhere: M.fixes.open(kind, date, field) lands on Me with the drawer prefilled
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')
    p.evaluate('M.fixes.open("attendance", "%s", "out")' % monday)
    p.wait_for_selector('#fix-drawer')
    check(p.evaluate('location.hash') == '#me', 'deep link did not land on Me')
    check(p.input_value('#fix-date') == monday and p.input_value('#fix-field') == 'out', 'deep link prefill %r %r' % (p.input_value('#fix-date'), p.input_value('#fix-field')))
    p.locator('.drawer').get_by_role('button', name='Close').click()

    # ---- the founder's Log tab ----
    h.go(p, 'founder', hash='#admin', width=1280)
    p.get_by_role('tab', name='Log').click()
    p.wait_for_selector('#log-tab')
    p.wait_for_selector('#log-rows .log-row')
    ltext = p.inner_text('#log-rows')
    check('check-in' in ltext, 'log rows missing the check-in change: ' + ltext[:400])
    check('Kaavish Ramchandani changed check-in for Durvesh Patil' in ltext, 'log verb and target: ' + ltext[:400])
    check('correction request' in ltext, 'log rows missing the fixes writes: ' + ltext[:400])
    check(p.locator('#log-rows .log-row[data-path="checkin/u_m1"]').count() >= 1, 'no checkin/u_m1 row')
    n_all = p.locator('#log-rows .log-row').count()
    p.fill('#log-q', 'fixes/')
    p.wait_for_function('() => document.querySelectorAll("#log-rows .log-row").length > 0 && [...document.querySelectorAll("#log-rows .log-row")].every(r => r.dataset.path.startsWith("fixes/"))')
    p.fill('#log-q', '')
    p.select_option('#log-who', 'u_m1')
    if log_m1:
        p.wait_for_function('() => document.querySelectorAll("#log-rows .log-row").length > 0 && document.querySelectorAll("#log-rows .log-row").length < %d' % n_all)
        check('Durvesh Patil' in p.inner_text('#log-rows') and 'Kaavish Ramchandani' not in p.inner_text('#log-rows'), 'person filter')
    else:
        p.wait_for_selector('#log-tab:has-text("Nothing logged in this range")')
    p.select_option('#log-who', 'u_founder')
    p.wait_for_function('() => document.querySelectorAll("#log-rows .log-row").length > 0')
    check('Durvesh Patil changed' not in p.inner_text('#log-rows'), 'person filter shows other people')
    p.select_option('#log-who', '')
    p.get_by_role('tab', name='Sign-ins').click()
    p.wait_for_selector('#log-tab:has-text("Nothing logged in this range")')
    p.get_by_role('tab', name='Writes').click()
    p.wait_for_selector('#log-rows .log-row')
    p.click('#log-export')
    p.wait_for_function('() => (window.__downloads || []).some(d => d.filename.startsWith("log-"))')
    csv = p.evaluate('window.__downloads.find(d => d.filename.startsWith("log-")).data')
    check(csv.splitlines()[0] == '"date","time","person","action","target","summary"' and 'checkin/u_m1' in csv, 'csv: ' + csv[:200])
    h.shot(p, 'log-tab')
    # the founder's own log doc: entries for the approval writes, ids as String(at) plus 4 base36 chars
    log_f = doc(p, 'log/u_founder/days/%s' % today)
    check(bool(log_f) and any(e.get('p') == 'checkin/u_m1' and e.get('a') == 'update' and e.get('s') == 'days' for e in log_f['e'].values()), 'founder log missing the check-in change: %r' % (log_f and list(log_f['e'].values())[:3]))
    check(bool(log_f) and any(str(e.get('p', '')).startswith('fixes/u_m1') for e in log_f['e'].values()), 'founder log missing the decision writes')
    check(bool(log_f) and all(re.match(r'^\d{13}[a-z0-9]{4}$', k) for k in log_f['e']), 'log entry ids %r' % (log_f and list(log_f['e'])[:3]))
    check(bool(log_f) and all(len(e.get('s', '')) <= 120 and set(e) == {'at', 'a', 'p', 's'} for e in log_f['e'].values()), 'log entry shape')
    # log writes never log themselves
    check(not any(str(e.get('p', '')).startswith('log/') for lid in p.evaluate('Object.keys(window.__db.store()).filter(k => k.startsWith("log/"))') for e in doc(p, lid)['e'].values()), 'a log write logged itself')

    # ---- a phone fits the queue, the log and the card ----
    h.go(p, 'm1', hash='#me', width=390)
    p.wait_for_selector('#fix-card')
    check(h.overflow(p) <= 0, 'Me card overflow %d' % h.overflow(p))
    p.click('#fix-open')
    p.wait_for_selector('#fix-drawer')
    check(h.overflow(p) <= 0, 'drawer overflow %d' % h.overflow(p))
    p.locator('.drawer').get_by_role('button', name='Close').click()
    h.seed_doc(p, 'fixes/u_m2', {'reqs': {'x1': {'kind': 'profile', 'date': '', 'field': 'title', 'want': 'Senior Creative Lead',
                                                  'note': 'Promoted last month and the roster still says Creative Lead.',
                                                  'at': 1, 'status': 'pending', 'decidedAt': None, 'decidedNote': ''}}})
    h.go(p, 'founder', hash='#admin', width=390)
    p.get_by_role('tab', name=re.compile(r'^Corrections')).click()
    p.wait_for_selector('#fix-queue:has-text("Senior Creative Lead")')
    check(h.overflow(p) <= 0, 'queue overflow at 390: %d' % h.overflow(p))
    check(not h.small_text(p), 'small text on the queue: %r' % h.small_text(p)[:2])
    h.shot(p, 'fixes-queue-390')
    p.locator('#fix-x1').get_by_role('button', name='Approve').click()
    p.wait_for_function('() => (window.__db.get("roster/team").members.u_m2 || {}).title === "Senior Creative Lead"')
    p.get_by_role('tab', name='Log').click()
    p.wait_for_selector('#log-rows .log-row')
    check(h.overflow(p) <= 0, 'log overflow at 390: %d' % h.overflow(p))
    check(not h.small_text(p), 'small text on the log: %r' % h.small_text(p)[:2])
    check('roster' in p.inner_text('#log-rows'), 'roster change not logged')

    # a member never reads another person's requests or the log
    h.go(p, 'm2', hash='#me', width=1280)
    p.wait_for_selector('#fix-card')
    check(h.ctx(p, 'Object.keys(ctx.coll.fixes.map)') == ['u_m2'], 'm2 sees other fixes docs')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
