#!/usr/bin/env python3
"""Setup and navigation test: the founder's Get m360 ready checklist, the New menu, quick actions,
sidebar sub-pages and section tabs by screen width.

Run: cd m360-os && python3 harness/tests/test_setup.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

GEO = (19.0760, 72.8777, 25)


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def settings(p):
        return p.evaluate('window.__db.get("settings/app")')

    p = h.session('founder', width=1280, hash='#hq', reset=True, seed=True, geo=GEO)
    p.wait_for_selector('#setup-card')
    card = p.inner_text('#setup-card')
    check('Get m360 ready' in card and '1 of 6 done' in card, 'setup card: ' + card[:200])
    h.shot(p, 'setup-hq')

    # pin the office from here
    p.locator('#setup-office').get_by_role('button', name="I'm at the office, pin it").click()
    p.wait_for_function('() => (window.__db.get("settings/app") || {}).office')
    off = settings(p)['office']
    check(abs(off['lat'] - GEO[0]) < 1e-6 and off['radius'] == 200, 'office %r' % off)

    # hours, holidays
    p.locator('#setup-hours').get_by_role('button', name='Looks right').click()
    p.wait_for_function('() => ((window.__db.get("settings/app") || {}).setup || {}).hours')
    p.locator('#setup-holidays').get_by_role('button').first.click()
    p.wait_for_function('() => ((window.__db.get("settings/app") || {}).holidays || []).length')
    hol = settings(p)['holidays']
    today = p.evaluate('M.U.todayStr()')
    check(all(d >= today for d in hol) and hol == sorted(hol) and len(hol) >= 5, 'holidays %r' % hol)
    check('4 of 6 done' in p.inner_text('#setup-card'), 'count after three steps: ' + p.inner_text('#setup-card')[:80])

    # Enter it by hand opens Admin on Settings; saving there keeps the setup flags
    p.locator('#setup-client').count()  # client seeded, step already ticked
    h.go(p, 'founder', hash='#hq', width=1280)
    p.wait_for_selector('#setup-card')
    p.get_by_role('button', name='Show steps').click() if p.get_by_role('button', name='Show steps').count() else None
    # the office step is done, so use the team step's how-it-works link, then open Settings through an intent
    p.evaluate("M.intend('#admin', 'settings')")
    p.wait_for_selector('text=Office location')
    check(p.get_by_role('tab', name='Settings').get_attribute('aria-selected') == 'true', 'settings tab not active')
    p.get_by_role('button', name='Save settings').click()
    p.wait_for_timeout(300)
    s = settings(p)
    check((s.get('setup') or {}).get('hours') is True, 'desk save wiped setup %r' % s.get('setup'))
    check(s.get('office') and s.get('holidays'), 'desk save lost office or holidays')

    # say hello: the feed opens with the composer focused
    h.go(p, 'founder', hash='#hq', width=1280)
    p.locator('#setup-hello').get_by_role('button', name='Write a post').click()
    p.wait_for_function("() => document.activeElement && document.activeElement.id === 'feed-text'")

    # done for now hides the card for good, merging with the hours flag
    h.go(p, 'founder', hash='#hq', width=1280)
    p.locator('#setup-card').get_by_role('button', name='Done for now').click()
    p.locator('#setup-card').get_by_role('button', name='Tap again to hide for good').click()
    p.wait_for_function("() => !document.querySelector('#setup-card')")
    st = settings(p)['setup']
    check(st.get('dismissed') and st.get('hours'), 'setup flags %r' % st)

    # members never see the checklist
    h.roster(p)
    p.evaluate('() => { const s = window.__db.get("settings/app"); delete s.setup; window.__db.set("settings/app", s); }')
    h.go(p, 'm1', hash='#home', width=1280)
    check(p.locator('#setup-card').count() == 0, 'member sees setup')

    # ---- New menu ----
    def new(label):
        p.locator('.sidebar .new-trigger').click()
        p.wait_for_selector('.newmenu')
        p.locator('.newmenu').get_by_role('menuitem', name=label).click()

    new('Kudos')
    p.wait_for_selector('.drawer:has-text("Give kudos")')
    check(p.evaluate('location.hash') == '#feed', 'kudos did not open the feed')
    p.keyboard.press('Escape')
    h.go(p, 'm1', hash='#home', width=1280)
    new('Task')
    p.wait_for_selector('.drawer:has-text("New task")')
    p.keyboard.press('Escape')
    h.go(p, 'm1', hash='#home', width=1280)
    new('Project')
    p.wait_for_selector('.drawer:has-text("New project")')
    check(p.evaluate('location.hash') == '#projects', 'project intent hash')
    h.go(p, 'm1', hash='#home', width=1280)
    p.locator('.sidebar .new-trigger').click()
    check(p.locator('.newmenu').get_by_role('menuitem', name='Pitch').count() == 0, 'member sees New pitch')
    p.keyboard.press('Escape')
    p.wait_for_function("() => !document.querySelector('.newmenu')")
    h.go(p, 'founder', hash='#hq', width=1280)
    new('Pitch')
    p.wait_for_selector('.drawer:has-text("New pitch")')

    # phone: the + in the top bar opens the same menu inside the screen
    h.go(p, 'm1', hash='#home', width=390)
    p.locator('.topbar .new-trigger').click()
    p.wait_for_selector('.newmenu')
    box = p.locator('.newmenu').bounding_box()
    check(box['x'] >= 0 and box['x'] + box['width'] <= 390, 'menu off screen %r' % box)
    p.locator('.newmenu').get_by_role('menuitem', name='Leave request').click()
    p.wait_for_function("() => location.hash === '#leave'")

    # ---- quick actions on Home ----
    h.go(p, 'm1', hash='#home', width=1280)
    p.locator('.quick').get_by_role('button', name='Give kudos').click()
    p.wait_for_selector('.drawer:has-text("Give kudos")')
    h.go(p, 'm1', hash='#home', width=1280)
    check(p.locator('#my-week .wk-day').count() == 6, 'week strip days')
    check(p.locator('#my-projects').count() == 1 and p.locator('#buzz').count() == 1, 'home cards missing')

    # ---- sidebar sub-pages and section tabs ----
    h.go(p, 'm1', hash='#work', width=1280)
    check(not p.locator('.tabs.section-tabs').is_visible(), 'section tabs visible on desktop')
    p.locator('.side-sub', has_text='Projects').click()
    p.wait_for_function("() => location.hash === '#projects'")
    p.wait_for_selector('.side-sub.active:has-text("Projects")')
    h.go(p, 'm1', hash='#work', width=390)
    check(p.locator('.tabs.section-tabs').is_visible(), 'section tabs hidden on phone')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
