#!/usr/bin/env python3
"""Notifications: the permission card on Home, a new inbox item becoming a bubble and a system
notification while m360 sits in another window, the mark that stops a backlog and a repeat, and
the state on Me.

Run: cd m360-os && python3 harness/tests/test_notify.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

# a stand-in for the browser's Notification: records what would have shown, grants on request, and
# the window counts as not in front, the way it is when someone works in another app
FAKE = '''
window.__notes = [];
class FakeNotification {
  constructor(title, opts) { window.__notes.push({title, body: (opts || {}).body || '', tag: (opts || {}).tag || ''}); }
  close() {}
  static requestPermission() { FakeNotification.permission = 'granted'; try { localStorage.setItem('__fakeperm', 'granted'); } catch (e) {} return Promise.resolve('granted'); }
}
FakeNotification.permission = (function () { try { return localStorage.getItem('__fakeperm') || 'default'; } catch (e) { return 'default'; } })();
window.Notification = FakeNotification;
document.hasFocus = () => false;
window.M360_WELCOME_OFF = true;
'''


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    p.add_init_script(FAKE)
    # the member's first load: the card asks, the mark is set, nothing rains down
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#notify-card')
    p.wait_for_timeout(500)
    check(p.locator('.notice-body').count() == 0, 'a backlog of notices on the first load: %r' % p.evaluate('[...document.querySelectorAll(".notice-title")].map(n => n.textContent)'))
    mark = p.evaluate('localStorage.getItem("m360.inboxNotice.u_m1")')
    check(mark and int(mark) > 0, 'the mark was not set on the first load: %r' % mark)
    # a second person says not now, and the card stays away for them
    h.go(p, 'm2', hash='#home', width=1280)
    p.wait_for_selector('#notify-card')
    p.click('#notify-later')
    p.wait_for_function('() => !document.querySelector("#notify-card")')
    p.reload()
    p.wait_for_selector('#home-hero')
    check(p.locator('#notify-card').count() == 0, 'the card came back after Not now')
    check(p.evaluate('localStorage.getItem("m360.notifyAsk.u_m2")') == '0', 'Not now was not remembered')
    # the member turns notifications on
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#notify-card')
    p.click('#notify-on')
    p.wait_for_function('() => !document.querySelector("#notify-card")')
    check(p.evaluate('Notification.permission') == 'granted', 'permission not asked')
    # a task handed to the member by the founder: a bubble with the line, and a system notification
    now_ms = p.evaluate('Date.now()')
    h.seed_doc(p, 'tasks/t_notify', {'title': 'Cut the teaser', 'owner': 'u_m1', 'by': 'u_founder', 'created': now_ms, 'updated': now_ms,
                                     'status': 'todo', 'priority': 'normal', 'due': '', 'client': '', 'project': '', 'section': '', 'link': ''})
    p.wait_for_selector('.notice-body:has-text("Handed you Cut the teaser")')
    title = p.inner_text('.notice-title')
    check(title == 'Kaavish Ramchandani', 'the bubble carries the sender as its title: %r' % title)
    p.wait_for_function('() => window.__notes.length > 0')
    notes = p.evaluate('window.__notes')
    check(any(n['body'] == 'Handed you Cut the teaser' and n['title'] == 'Kaavish Ramchandani' for n in notes), 'system notification: %r' % notes)
    check(int(p.evaluate('localStorage.getItem("m360.inboxNotice.u_m1")')) >= now_ms, 'the mark did not move past the new item')
    # a reload does not repeat it
    p.reload()
    p.wait_for_selector('#home-hero')
    p.wait_for_timeout(600)
    check(p.locator('.notice-body').count() == 0, 'the item was notified again on reload')
    # Me shows the state
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#prefs-card')
    if p.locator('#notify-state').count() == 0:
        p.locator('.fold-head:has-text("Your m360")').first.click()
    p.wait_for_selector('#notify-state')
    check(p.inner_text('#notify-state') == 'on', 'Me should say notifications are on: %r' % p.inner_text('#notify-state'))
    # a kudos for the founder: the bubble names the giver and the inbox line reads in plain words
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#home-hero')
    p.wait_for_timeout(400)
    now_ms = p.evaluate('Date.now()')
    given = p.evaluate('(window.__db.get("kudos/u_m1") || {}).given || []')
    given.append({'id': 'k_notify', 'to': 'u_founder', 'why': 'Unblocked the shoot', 'at': now_ms})
    h.seed_doc(p, 'kudos/u_m1', {'given': given})
    p.wait_for_selector('.notice-body:has-text("Gave you kudos: Unblocked the shoot")')
    check(p.inner_text('.notice-title') == 'Durvesh Patil', 'kudos bubble title: %r' % p.inner_text('.notice-title'))
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = run(t)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
