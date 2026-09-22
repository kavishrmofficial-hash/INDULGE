#!/usr/bin/env python3
"""Team test: an outsider asks to join, the founder lets them in from HQ and Admin, declines another,
view-only and guest viewers get the locked screen, and the join rules keep requests private.

Run: cd m360-os && python3 harness/tests/test_team.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#hq', reset=True, seed=True)
    h.roster(p)

    # ---- an outsider asks to join ----
    h.go(p, 'outsider', hash='#home', width=390)
    p.wait_for_selector('text=Welcome to m360')
    check(p.locator('.sidebar').count() == 0, 'outsider sees the app')
    p.fill('#join-title', 'Motion designer')
    p.get_by_role('button', name='Ask to join').click()
    p.wait_for_selector('text=Request sent')
    doc = p.evaluate('window.__db.get("join/u_out")')
    check(doc and doc.get('title') == 'Motion designer' and doc.get('at'), 'join doc %r' % doc)
    h.shot(p, 'team-join-sent-390')

    # members cannot read or write someone else's request
    h.go(p, 'm1', hash='#home', width=1280)
    r = p.evaluate('''async () => {
      const db = await window.claude.use('db');
      const s = await db.doc('join/u_out').get();
      let wrote = true;
      try { await db.doc('join/u_out').set({at: 1}); } catch (e) { wrote = false; }
      const own = await db.doc('join/u_m1').set({at: 1}).then(() => true, () => false);
      await db.doc('join/u_m1').delete();
      return {seen: s.exists, wrote, own};
    }''')
    check(not r['seen'], 'member reads another join request')
    check(not r['wrote'], 'member writes another join request')
    check(r['own'], 'member cannot write their own join doc')
    check(p.locator('.join-banner').count() == 0, 'member sees the join banner')

    # ---- the founder sees it on HQ and lets them in from Admin ----
    h.go(p, 'founder', hash='#hq', width=1280)
    p.wait_for_selector('.join-banner')
    check('Rohan Verma wants to join the team' in p.inner_text('.join-banner'), 'banner text: ' + p.inner_text('.join-banner'))
    check(p.locator('.side-item', has_text='Admin').locator('.badge').count() == 1, 'admin badge missing')
    p.click('.join-banner')
    p.wait_for_selector('#join-requests')
    check(p.evaluate('location.hash') == '#admin', 'banner did not open admin')
    card = p.inner_text('#join-requests')
    check('Rohan Verma' in card and 'Motion designer' in card, 'request card: ' + card)
    h.shot(p, 'team-admin-requests')
    p.locator('#join-requests').get_by_role('button', name='Let them in').click()
    p.wait_for_selector('#desk-title')
    check(p.input_value('#desk-title') == 'Motion designer', 'title not prefilled')
    p.get_by_role('button', name='Add to the team').click()
    p.wait_for_function('() => !window.__db.get("join/u_out")')
    roster = p.evaluate('window.__db.get("roster/team")')
    m = roster['members'].get('u_out')
    check(m and m['active'] and m['role'] == 'member' and m['title'] == 'Motion designer' and m['empId'] == 'M360-005', 'roster row %r' % m)
    check(p.locator('#join-requests').count() == 0, 'request card still shown')

    # the new member's waiting screen opens into the app by itself
    h.go(p, 'outsider', hash='#home', width=1280)
    p.wait_for_selector('.sidebar')
    check(p.locator('.side-item', has_text='HQ').count() == 0, 'new member sees HQ')

    # ---- decline an unknown request ----
    h.seed_doc(p, 'join/u_stray', {'at': 1, 'title': ''})
    h.go(p, 'founder', hash='#admin', width=1280)
    p.wait_for_selector('#join-requests')
    p.locator('#join-requests').get_by_role('button', name='Decline').click()
    p.locator('#join-requests').get_by_role('button', name='Tap again to confirm').click()
    p.wait_for_function('() => !window.__db.get("join/u_stray")')

    # ---- invite card ----
    check(p.locator('#invite-card').count() == 1, 'invite card missing')
    if p.locator('#invite-card').get_by_role('button', name='Show how').count():
        p.locator('#invite-card').get_by_role('button', name='Show how').click()
    inv = p.inner_text('#invite-card')
    check('claude.ai/artifact/' in inv and 'Can interact' in inv and 'organisation' in inv, 'invite card: ' + inv)

    # ---- full access role ----
    row = p.locator('tr', has_text='Aanya Mehta')
    row.get_by_role('button', name='Edit').click()
    p.get_by_role('tab', name='Full access').click()
    p.get_by_role('button', name='Save').click()
    p.wait_for_timeout(300)
    check(p.evaluate('window.__db.get("roster/team").members.u_m2.role') == 'founder', 'full access not saved')
    h.go(p, 'm2', hash='#hq', width=1280)
    check(p.locator('.side-item', has_text='HQ').count() == 1, 'full access member lacks HQ')
    # editing the founder keeps founder
    h.go(p, 'founder', hash='#admin', width=1280)
    p.locator('tr', has_text='Kaavish Ramchandani').get_by_role('button', name='Edit').click()
    p.get_by_role('button', name='Save').click()
    p.wait_for_timeout(300)
    check(p.evaluate('window.__db.get("roster/team").members.u_founder.role') == 'founder', 'founder demoted on edit')

    # a removed full access member loses founder powers
    p.evaluate('() => { const r = window.__db.get("roster/team"); r.members.u_m2.active = false; window.__db.set("roster/team", r); }')
    h.go(p, 'm2', hash='#hq', width=1280)
    p.wait_for_selector('text=Your access is paused')

    # ---- view-only and guest viewers see the locked screen ----
    p.evaluate('() => { const r = window.__db.get("roster/team"); delete r.members.u_m3; window.__db.set("roster/team", r); }')
    h.go(p, 'm3', hash='#home', width=390, level='view')
    p.wait_for_selector('text=Almost there')
    check('view only' in p.inner_text('body'), 'view-only copy missing')
    check(p.get_by_role('button', name='Ask to join').count() == 0, 'view-only sees Ask to join')
    h.go(p, 'm3', hash='#home', width=390, guest='1')
    p.wait_for_selector('text=Almost there')
    check('outside the Mask360 organisation' in p.inner_text('body'), 'guest copy missing')
    h.shot(p, 'team-guest-390')
    # can() says nothing: the write refusal decides
    h.go(p, 'm3', hash='#home', width=390, level='view', cannull='1')
    p.wait_for_selector('text=Welcome to m360')
    p.get_by_role('button', name='Ask to join').click()
    p.wait_for_selector('text=Almost there')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
