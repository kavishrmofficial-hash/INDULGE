#!/usr/bin/env python3
"""Leave module test: probation line, request, approve, withdraw with tap-again, at 1280 and 390.

Run: M360_MODULES=36-leave.js M360_TAG=leave python3 harness/tests/test_leave.py
Playwright contexts keep separate localStorage, so every page after the first opens inside the first
page's context: the store is shared there and storage events keep every open page live.
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def fmt(ymd):
    d = date.fromisoformat(ymd)
    return '%d %s %d' % (d.day, MON[d.month - 1], d.year)


def open_page(h, ctx, ident, hsh, width):
    """A page inside an existing context, so it shares that context's store."""
    page = ctx.new_page()
    page.set_viewport_size({'width': width, 'height': 900})
    page.set_default_timeout(8000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hsh))
    h.ready(page)
    page.wait_for_timeout(250)
    return page


def test(h):
    today = date.today()
    next_mon = today + timedelta(days=((7 - today.weekday()) % 7) or 7)
    frm = next_mon.isoformat()
    to = (next_mon + timedelta(days=1)).isoformat()
    d2 = (next_mon + timedelta(days=3)).isoformat()
    prob = (today.replace(day=1) + timedelta(days=32)).replace(day=15).isoformat()
    opened = []

    # m1 at 1280: probation line, then a two day request
    p1 = h.open('m1', width=1280, hash='#leave', reset=True)
    h.roster(p1, ('u_m1', 'u_m2'), extra={'u_m1': {'probationEnd': prob}})
    p1.wait_for_selector('h1.pgt:has-text("Leave")')
    p1.wait_for_timeout(200)
    opened.append(('m1 1280', p1))
    body = p1.inner_text('body')
    line = "You're in probation until %s. Leave in probation is loss of pay." % fmt(prob)
    assert line in body, 'probation line missing: ' + body[:300]
    assert 'Details go to Kaavish directly.' in body
    assert p1.locator('h2.card-title', has_text='Approvals').count() == 0, 'member must never see Approvals'
    assert 'No requests yet.' in p1.inner_text('#leave-mine')
    btn = p1.get_by_role('button', name='Request leave')
    assert btn.is_disabled(), 'button must start disabled'
    p1.fill('#leave-from', frm)
    p1.wait_for_function('() => document.querySelector("#leave-to").value === "%s"' % frm)
    p1.fill('#leave-to', to)
    p1.select_option('#leave-type', 'casual')
    assert btn.is_enabled(), 'button must enable once dates are valid'
    btn.click()
    p1.wait_for_selector('.toast:has-text("Requested")')
    p1.wait_for_timeout(250)
    doc = p1.evaluate('window.__db.get("leave/u_m1")')
    assert doc and len(doc['reqs']) == 1, doc
    r = doc['reqs'][0]
    assert r['from'] == frm and r['to'] == to and r['type'] == 'casual' and r['id'] and r['at'], r
    rid = r['id']
    p1.wait_for_selector('#leave-mine .pill.flame-o:has-text("pending")')
    mine = p1.inner_text('#leave-mine')
    assert '%s to %s' % (fmt(frm), fmt(to)) in mine, mine
    assert '2 days' in mine, mine
    assert p1.input_value('#leave-from') == '' and p1.input_value('#leave-to') == '', 'form must clear after the write'

    # phone width while the request is pending: member and founder
    p2 = open_page(h, p1.context, 'm1', '#leave', 390)
    opened.append(('m1 390', p2))
    p2.wait_for_selector('#leave-mine .pill.flame-o:has-text("pending")')
    p3 = open_page(h, p1.context, 'founder', '#leave', 390)
    opened.append(('founder 390', p3))
    p3.wait_for_selector('#leave-approvals button:has-text("Approve")')
    h.shot(p2, 'leave-m1-390')
    h.shot(p3, 'leave-founder-390')

    # founder at 1280: approve from the Approvals card
    pf = open_page(h, p1.context, 'founder', '#leave', 1280)
    opened.append(('founder 1280', pf))
    pf.wait_for_selector('#leave-approvals:has-text("Durvesh Patil")')
    appr = pf.inner_text('#leave-approvals')
    assert '%s to %s' % (fmt(frm), fmt(to)) in appr, appr
    assert 'casual' in appr and '1 pending' in appr, appr
    assert h.ctx(pf, 'M.leave.pending(ctx).map(x => x.uid + ":" + x.req.id)') == ['u_m1:' + rid]
    h.shot(pf, 'leave-founder-1280')
    pf.locator('#leave-approvals button:has-text("Approve")').click()
    pf.wait_for_selector('.toast:has-text("Approved")')
    pf.wait_for_timeout(250)
    dec = pf.evaluate('window.__db.get("leavedec/u_m1")')
    assert dec and dec['d'][rid]['status'] == 'approved' and dec['d'][rid]['at'], dec
    pf.wait_for_selector('#leave-approvals:has-text("No leave requests waiting.")')
    assert h.ctx(pf, 'M.leave.pending(ctx).length') == 0
    assert h.ctx(pf, 'ctx.onLeave("u_m1", "%s") && ctx.onLeave("u_m1", "%s")' % (frm, to)), 'approved leave must reach ctx.leaveMap'

    # m1 sees approved, then asks again and withdraws with tap-again
    p1.wait_for_selector('#leave-mine .pill.ink:has-text("approved")')
    assert p1.locator('#leave-mine button:has-text("Withdraw")').count() == 0, 'approved requests carry no Withdraw'
    p1.fill('#leave-from', d2)
    p1.wait_for_function('() => document.querySelector("#leave-to").value === "%s"' % d2)
    p1.select_option('#leave-type', 'swap')
    p1.get_by_role('button', name='Request leave').click()
    p1.wait_for_selector('#leave-mine .pill.flame-o:has-text("pending")')
    p1.wait_for_timeout(200)
    doc = p1.evaluate('window.__db.get("leave/u_m1")')
    assert len(doc['reqs']) == 2, doc
    assert doc['reqs'][0]['from'] == d2 and doc['reqs'][0]['to'] == d2 and doc['reqs'][0]['type'] == 'swap', doc
    assert doc['reqs'][1]['id'] == rid, 'older requests stay in order'
    assert 'wfh swap' in p1.inner_text('#leave-mine')
    w = p1.locator('#leave-mine button:has-text("Withdraw")')
    assert w.count() == 1
    w.click()
    p1.wait_for_selector('#leave-mine button:has-text("Tap again to confirm")')
    p1.wait_for_timeout(200)
    assert len(p1.evaluate('window.__db.get("leave/u_m1")')['reqs']) == 2, 'one tap must change nothing'
    p1.locator('#leave-mine button:has-text("Tap again to confirm")').click()
    p1.wait_for_selector('.toast:has-text("Withdrawn")')
    p1.wait_for_timeout(250)
    doc = p1.evaluate('window.__db.get("leave/u_m1")')
    assert len(doc['reqs']) == 1 and doc['reqs'][0]['id'] == rid, doc
    assert p1.locator('#leave-mine .pill.flame-o').count() == 0
    h.shot(p1, 'leave-m1-1280')

    # founder: nothing waiting, on the live page and on a fresh one
    pf.wait_for_selector('#leave-approvals:has-text("No leave requests waiting.")')
    pf2 = open_page(h, p1.context, 'founder', '#leave', 1280)
    opened.append(('founder 1280 fresh', pf2))
    assert 'No leave requests waiting.' in pf2.inner_text('#leave-approvals')
    assert h.ctx(pf2, 'M.leave.pending(ctx).length') == 0

    # layout and console on every page opened
    for label, page in opened:
        ov = h.overflow(page)
        assert ov == 0, '%s: horizontal overflow %dpx' % (label, ov)
        st = h.small_text(page)
        assert not st, '%s: text under 11px %r' % (label, st[:3])
    errs = h.errors()
    assert not errs, 'console errors: %r' % errs
    return True


if __name__ == '__main__':
    try:
        ok = run(test)
    except AssertionError as e:
        print('FAIL:', e)
        sys.exit(1)
    if not ok:
        print('FAIL')
        sys.exit(1)
    print('PASS')
