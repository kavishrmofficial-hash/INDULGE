#!/usr/bin/env python3
"""Super controls test: the founder locks the workspace (members see the line and their writes are
refused), sets an alert everyone sees and can dismiss, views the app as a member with every write
refused, fixes a member's attendance with a reason, switches joining to invite only, offboards
someone, exports everything, and the tab fits a phone.

Run: cd m360-os && python3 harness/tests/test_super.py
"""
import json
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed, browser_today, ymd  # noqa: E402


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    def open_super(p, width=1280):
        h.go(p, 'founder', hash='#admin', width=width)
        p.get_by_role('tab', name='Super').click()
        p.wait_for_selector('#super-tab')

    def writes_to(p, path):
        return p.evaluate('p => window.__dbWrites.filter(w => w.path === p).length', path)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    today = browser_today(p)
    today_s = ymd(today)
    mon_s = ymd(today - timedelta(days=today.weekday()))

    # ---- lock on: the member sees the line and a task change is refused ----
    open_super(p)
    p.locator('#super-lock').get_by_role('tab', name='Locked').click()
    p.wait_for_function('() => (window.__db.get("settings/app") || {}).locked === true')
    p.fill('#super-locknote', 'Payroll run, back by 3pm')
    p.locator('#super-lock').get_by_role('button', name='Save note').click()
    p.wait_for_function('() => window.__db.get("settings/app").lockNote === "Payroll run, back by 3pm"')
    check(p.locator('#lock-banner').count() == 0, 'the founder sees the lock line')

    h.go(p, 'm1', hash='#tasks/t1', width=1280)
    p.wait_for_selector('#lock-banner')
    line = p.inner_text('#lock-banner')
    check('m360 is locked for changes right now.' in line and 'Payroll run, back by 3pm' in line, 'lock line: ' + line)
    p.wait_for_selector('.drawer #task-title')
    p.locator('.drawer').get_by_role('tab', name='Done', exact=True).click()
    p.locator('.drawer').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_selector('.toast:has-text("m360 is locked right now. Try again later.")')
    p.wait_for_timeout(200)
    check(doc(p, 'tasks/t1')['status'] == 'doing', 'locked write went through: ' + doc(p, 'tasks/t1')['status'])
    check(writes_to(p, 'tasks/t1') == 0, 'locked write reached the db')
    p.keyboard.press('Escape')
    # own per-person documents still save while locked (the inbox marks itself read)
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !!(window.__db.get("me/u_m1") || {}).inboxSeen')

    # ---- lock off: the same change works ----
    open_super(p)
    p.locator('#super-lock').get_by_role('tab', name='Open').click()
    p.wait_for_function('() => window.__db.get("settings/app").locked === false')
    h.go(p, 'm1', hash='#tasks/t1', width=1280)
    check(p.locator('#lock-banner').count() == 0, 'lock line still showing after unlock')
    p.wait_for_selector('.drawer #task-title')
    p.locator('.drawer').get_by_role('tab', name='Done', exact=True).click()
    p.locator('.drawer').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_function('() => window.__db.get("tasks/t1").status === "done"')

    # ---- alert: everyone sees it, each person dismisses it for the day ----
    open_super(p)
    p.fill('#super-alert-text', 'Office shut on Friday for the shoot')
    p.fill('#super-alert-until', today_s)
    p.locator('#super-alert').get_by_role('button', name='Show the alert').click()
    p.wait_for_function('() => ((window.__db.get("settings/app") || {}).alert || {}).text === "Office shut on Friday for the shoot"')
    a = doc(p, 'settings/app')['alert']
    check(a.get('until') == today_s and a.get('at'), 'alert shape: %r' % a)
    p.wait_for_selector('#alert-banner')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#alert-banner')
    check('Office shut on Friday for the shoot' in p.inner_text('#alert-banner'), 'alert text: ' + p.inner_text('#alert-banner'))
    p.locator('#alert-banner').get_by_role('button', name='Dismiss').click()
    p.wait_for_function('() => !document.querySelector("#alert-banner")')
    check((p.evaluate('localStorage.getItem("m360.alertSeen")') or '').endswith(today_s), 'dismissal not remembered for the day')
    check(doc(p, 'settings/app')['alert']['text'] == 'Office shut on Friday for the shoot', 'dismissing changed the alert')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_timeout(300)
    check(p.locator('#alert-banner').count() == 0, 'alert came back after dismissal')
    open_super(p)
    p.locator('#super-alert').get_by_role('button', name='Clear').click()
    p.wait_for_function('() => !window.__db.get("settings/app").alert')

    # ---- view as: the founder becomes m1, nothing saves, exit restores ----
    open_super(p)
    p.select_option('#super-viewas-who', 'u_m1')
    p.wait_for_selector('#preview-bar')
    bar = p.inner_text('#preview-bar')
    check('Viewing as Durvesh Patil' in bar and 'Preview only, nothing saves.' in bar, 'preview bar: ' + bar)
    p.wait_for_function('() => location.hash === "#home"')
    p.wait_for_function('() => /Durvesh Patil/.test(document.querySelector(".side-foot .nm").textContent)')
    check(p.locator('.side-item', has_text='HQ').count() == 0 and p.locator('.side-item', has_text='Admin').count() == 0, 'founder sections visible in preview')
    check(h.ctx(p, 'ctx.uid') == 'u_m1' and h.ctx(p, 'ctx.isFounder') is False and h.ctx(p, 'ctx.realUid') == 'u_founder', 'preview context wrong')
    p.evaluate('M.nav("#tasks/t3")')
    p.wait_for_selector('.drawer #task-title')
    p.locator('.drawer').get_by_role('tab', name='Doing', exact=True).click()
    p.locator('.drawer').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_selector('.toast:has-text("Preview mode. Nothing saves.")')
    p.wait_for_timeout(200)
    check(doc(p, 'tasks/t3')['status'] == 'todo', 'preview write went through')
    check(writes_to(p, 'tasks/t3') == 0, 'preview write reached the db')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    p.locator('#preview-bar').get_by_role('button', name='Exit').click()
    p.wait_for_function('() => !document.querySelector("#preview-bar")')
    p.wait_for_function('() => /Kaavish Ramchandani/.test(document.querySelector(".side-foot .nm").textContent)')
    check(p.locator('.side-item', has_text='Admin').count() == 1, 'Admin missing after exit')
    check(h.ctx(p, 'ctx.isFounder') is True and h.ctx(p, 'ctx.uid') == 'u_founder', 'founder not restored')
    check(p.evaluate('Object.keys(localStorage).some(k => /viewAs/i.test(k))') is False, 'view as was persisted')

    # ---- fix attendance: u_m1's Monday to in 09:40 with a reason ----
    before = p.evaluate('() => { const d = window.__db.get("checkin/u_m1").days["%s"]; return d ? M.U.hhmm(d.in) : ""; }' % mon_s)
    check(before != '', 'seeded Monday check-in missing for u_m1')
    open_super(p)
    p.select_option('#super-fix-who', 'u_m1')
    p.fill('#super-fix-date', mon_s)
    p.wait_for_selector('#super-fix-record')
    check(before in p.inner_text('#super-fix-record'), 'record does not show the seeded time %s: %s' % (before, p.inner_text('#super-fix-record')))
    check(p.locator('#super-fix').get_by_role('button', name='Save the day').is_disabled(), 'save enabled without a reason')
    p.fill('#super-fix-in', '09:40')
    p.fill('#super-fix-note', 'Forgot to tap in, confirmed on WhatsApp')
    p.locator('#super-fix').get_by_role('button', name='Save the day').click()
    p.wait_for_function('() => (window.__db.get("checkin/u_m1").days["%s"] || {}).fixNote === "Forgot to tap in, confirmed on WhatsApp"' % mon_s)
    day = p.evaluate('() => { const d = window.__db.get("checkin/u_m1").days["%s"]; return {...d, inT: M.U.hhmm(d.in), outT: d.out ? M.U.hhmm(d.out) : null}; }' % mon_s)
    check(day['inT'] == '09:40', 'in time not saved: %r' % day['inT'])
    check(day['fixedBy'] == 'u_founder' and day['fixedAt'], 'fixedBy or fixedAt missing: %r' % day)
    check(day['mode'] == 'office' and 'late' not in day, 'day shape changed: %r' % sorted(day.keys()))
    check(day.get('loc') is not None, 'location dropped on fix')
    check(h.ctx(p, 'M.att.dayStatus(ctx, "u_m1", "%s").late' % mon_s) is False, 'late not recomputed from the fixed time')
    check('Fixed by Kaavish Ramchandani' in p.inner_text('#super-fix-record'), 'fix note not shown: ' + p.inner_text('#super-fix-record'))

    # ---- join policy: invite only hides Ask to join ----
    open_super(p)
    p.locator('#super-join').get_by_role('tab', name='Invite only').click()
    p.wait_for_function('() => window.__db.get("settings/app").joinPolicy === "invite"')
    h.go(p, 'outsider', hash='#home', width=1280)
    p.wait_for_selector('text=Joining is by invite. Ask Kaavish for one.')
    check(p.get_by_role('button', name='Ask to join').count() == 0, 'invite only still shows Ask to join')
    check(p.locator('.sidebar').count() == 0, 'outsider sees the app')
    open_super(p)
    p.locator('#super-join').get_by_role('tab', name='Anyone with the link can ask to join').click()
    p.wait_for_function('() => window.__db.get("settings/app").joinPolicy === "open"')
    h.go(p, 'outsider', hash='#home', width=1280)
    p.wait_for_selector('button:has-text("Ask to join")')

    # ---- offboard u_m2: inactive, off the project, open tasks stay ----
    open_super(p)
    p.select_option('#super-off-who', 'u_m2')
    p.wait_for_selector('#super-offboard:has-text("1 open task still assigned to them")')
    p.locator('#super-offboard').get_by_role('button', name='Offboard').click()
    p.locator('#super-offboard').get_by_role('button', name='Tap again to confirm').click()
    p.wait_for_function('() => window.__db.get("roster/team").members.u_m2.active === false')
    m2 = doc(p, 'roster/team')['members']['u_m2']
    check(m2.get('left') == today_s and m2.get('empId') == 'M360-003', 'offboarded member: %r' % m2)
    p.wait_for_function('() => window.__db.get("projects/p1").members.length === 1')
    check(doc(p, 'projects/p1')['members'] == ['u_m1'], 'project members: %r' % doc(p, 'projects/p1')['members'])
    check(doc(p, 'tasks/t3')['owner'] == 'u_m2', 'open task was reassigned')
    p.wait_for_selector('.toast:has-text("Offboarded")')
    check('u_m2' not in [o.get_attribute('value') for o in p.locator('#super-off-who option').all()], 'offboarded person still offered')

    # ---- export everything ----
    p.locator('#super-export').get_by_role('button', name='Download everything').click()
    p.wait_for_function('() => window.__downloads.length === 1')
    dl = p.evaluate('window.__downloads[0]')
    check(dl['filename'] == 'm360-everything-%s.json' % today_s, 'export filename: ' + dl['filename'])
    data = json.loads(dl['data'])
    check(set(data) >= {'roster', 'settings', 'collections'}, 'export keys: %r' % sorted(data))
    check(data['collections']['tasks']['t1']['title'] == 'Write hero reel script', 'export missing tasks')
    check(data['collections']['checkin']['u_m1']['days'][mon_s]['fixNote'], 'export missing the fixed day')
    check(data['roster']['members']['u_m2']['active'] is False, 'export roster stale')
    check('Kaavish Ramchandani' not in dl['data'] and '@mask360' not in dl['data'], 'export carries profile names or addresses')

    # ---- phone ----
    open_super(p, width=390)
    p.wait_for_timeout(300)
    ov = h.overflow(p)
    check(ov <= 0, 'phone overflow %d' % ov)
    p.select_option('#super-fix-who', 'u_m1')
    p.wait_for_selector('#super-fix-record')
    ov = h.overflow(p)
    check(ov <= 0, 'phone overflow with the record open %d' % ov)
    check(not h.small_text(p), 'small text %r' % h.small_text(p)[:2])
    h.shot(p, 'super-390')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
