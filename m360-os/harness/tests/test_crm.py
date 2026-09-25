#!/usr/bin/env python3
"""The CRM tab folds Base companies, clients and pitches into one row each; the Web page frames a site
and keeps shared bookmarks; a person's own WFH allowance beats the team default.

Run: cd m360-os && python3 harness/tests/test_crm.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def test(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, ('u_m1',))
    # the CRM: one row per account, a client and a pitch under the same name fold together
    h.go(p, 'founder', hash='#crm', width=1280)
    p.wait_for_selector('#crm-table')
    rows = p.evaluate('() => [...document.querySelectorAll("#crm-table tbody tr")].map(r => r.querySelector("td").innerText.trim())')
    check(len(rows) >= 2, 'crm rows %r' % rows)
    names = [r.lower() for r in rows]
    check(len(names) == len(set(names)), 'an account should appear once, got %r' % rows)
    check(p.locator('#crm-table thead th:has-text("in play")').count() == 1, 'the founder sees value in play')
    p.fill('#crm-q', 'swisse')
    p.wait_for_timeout(200)
    check(p.locator('#crm-table tbody tr').count() >= 1 and 'swisse' in p.locator('#crm-table tbody tr').first.inner_text().lower(), 'search should narrow to Swisse')
    p.locator('#crm-table tbody tr').first.click()
    p.wait_for_timeout(500)
    check(p.evaluate('() => location.hash').startswith('#clients') or p.evaluate('() => location.hash').startswith('#companies'), 'a row opens its client or company, got %r' % p.evaluate('() => location.hash'))
    # a member sees the CRM without the money column
    h.go(p, 'm1', hash='#crm', width=1280)
    p.wait_for_selector('#crm-table')
    check(p.locator('#crm-table thead th:has-text("in play")').count() == 0, 'members never see value in play')
    # the Web page: bookmarks are shared, a site frames
    h.go(p, 'founder', hash='#web', width=1280)
    p.wait_for_selector('#web-url')
    check(p.locator('#web-marks .chip').count() >= 4, 'starter bookmarks missing')
    p.fill('#web-url', 'example.com'); p.locator('#web-go').click()
    p.wait_for_selector('#web-frame')
    check(p.evaluate('() => document.querySelector("#web-frame").src') == 'https://example.com/', 'the frame should load the address, got %r' % p.evaluate('() => document.querySelector("#web-frame").src'))
    p.locator('#web-save').click(); p.wait_for_selector('#web-title'); p.fill('#web-title', 'Example'); p.keyboard.press('Enter')
    p.wait_for_selector('#web-marks .chip:has-text("Example")')
    h.go(p, 'm1', hash='#web', width=1280)
    p.wait_for_selector('#web-marks .chip:has-text("Example")')
    check(p.locator('#web-marks .chip').count() == 1, 'a saved bookmark replaces the starters for everyone')
    # WFH: the roster allowance for one person beats the team default
    h.go(p, 'founder', hash='#admin', width=1280)
    p.wait_for_timeout(300)
    p.evaluate('() => M.lastCtx.W.merge("roster/team", {members: {u_m1: {wfhCap: 0}}, updated: Date.now()})')
    p.wait_for_function('() => M.lastCtx.members.u_m1 && M.lastCtx.members.u_m1.wfhCap === 0')
    check(p.evaluate('() => M.att.wfhCapFor(M.lastCtx, "u_m1")') == 0, 'own allowance should win')
    check(p.evaluate('() => M.att.wfhCapFor(M.lastCtx, "u_founder")') == p.evaluate('() => Number(M.lastCtx.settings.wfhCap)'), 'others keep the team default')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#home-hero')
    if p.locator('#checkin-card').count():
        check('of 0' in p.inner_text('#checkin-card') or p.locator('#checkin-card button:has-text("Check in, WFH")').is_disabled(), 'a zero allowance should close WFH for that person')
    check(p.evaluate('() => M.att.wfhCapFor(M.lastCtx, M.lastCtx.uid)') == 0, 'the member page should read a zero allowance')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = run(test)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
