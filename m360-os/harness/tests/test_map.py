#!/usr/bin/env python3
"""The map, "What's in m360": every section and tab in one line each with live numbers, reachable from
the sidebar's help group, the phone menu and the Ask bar; the founder sees HQ, Books and
Handshake on it and a member does not; a member in their first two weeks gets the way in on Home and
the day-one list on the map; the tab strips carry the same lines as tooltips.

Run: cd m360-os && python3 harness/tests/test_map.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    # the sidebar entry and the page
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#side-map')
    p.click('#side-map')
    p.wait_for_selector('#map')
    check(p.locator('#map-work').count() == 1 and p.locator('#map-books').count() == 1 and p.locator('#map-hq').count() == 1, 'the founder sees Work, Books and HQ on the map')
    # v40: HQ opens on Command; the old Intelligence and Dashboard tabs are gone
    hq = p.inner_text('#map-hq')
    check('Command' in hq and 'Intelligence' not in hq and 'Dashboard' not in hq, 'HQ lists Command first and no Dashboard: %r' % hq[:200])
    # v37: Accounts is People, Pipeline and Clients
    check(all(w in p.inner_text('#map-accounts') for w in ('People', 'Pipeline', 'Clients')), 'Accounts lists People, Pipeline and Clients')
    check(p.locator('#map-always .map-tab').count() == 8, 'the always-around list: %d' % p.locator('#map-always .map-tab').count())
    check(p.locator('#map .map-tab').count() >= 40, 'every tab has a line: %d' % p.locator('#map .map-tab').count())
    check(p.locator('#map-day-one').count() == 0, 'no day-one list for someone long in')
    check(p.locator('#map .flame-t.num').count() >= 1, 'at least one live number on the map')
    check(h.overflow(p) == 0, 'overflow on the map: %d' % h.overflow(p))
    # a line opens the place
    p.locator('#map-work .map-tab').filter(has=p.locator('b', has_text='Projects')).first.click()
    p.wait_for_function('() => location.hash === "#projects"')
    # v40: the design's section header carries no map link; the map opens on a section by its hash
    p.wait_for_selector('.section-hero')
    check(p.locator('.hero-map').count() == 0, 'no map link in the section header')
    p.wait_for_selector('.section-tabs .tab', state='attached')
    check(p.locator('.section-tabs .tab[title*="Every task on you"]').count() == 1, 'the tab strip carries the line as a tooltip: %r' % p.evaluate('() => [...document.querySelectorAll(".section-tabs .tab")].map(t => [t.textContent, t.title.slice(0, 20)])'))
    h.go(p, 'founder', hash='#map/work', width=1280)
    p.wait_for_selector('#map-work.open')
    check(p.locator('.map-card.open').count() == 1, 'the section card is marked open')
    # the palette knows it
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#side-map')
    p.keyboard.press('Control+k')
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'what')
    p.wait_for_selector('#pal-list:has-text("What\'s in m360")')
    p.keyboard.press('Escape')
    # phone: the menu lists it
    h.go(p, 'founder', hash='#home', width=390)
    p.wait_for_selector('.tabbar')
    p.locator('#menuBtn').click()
    # v40: the capsule's menu button opens the full screen glass menu
    p.wait_for_selector('#menu.open:has-text("What\'s here")')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector("#menu.open")')
    h.go(p, 'founder', hash='#map', width=390)
    p.wait_for_selector('#map')
    p.wait_for_timeout(300)
    check(h.overflow(p) == 0, 'phone overflow on the map: %d' % h.overflow(p))
    # a member in their first weeks: the way in on Home, the day-one list, no founder places
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#find-your-way')
    p.locator('#find-your-way button:has-text("See what\'s here")').click()
    p.wait_for_selector('#map')
    check(p.locator('#map-day-one').count() == 1 and p.locator('#map-day-one .map-tab').count() == 7, 'the day-one list for a new joiner')
    check(p.locator('#map-hq').count() == 0 and p.locator('#map-books').count() == 0 and p.locator('#map-admin').count() == 0, 'no founder places for a member')
    check('People' in p.inner_text('#map-accounts'), 'People is on the member map too')
    check('Hiring' in p.inner_text('#map-me'), 'a member sees Hiring under Me')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#find-your-way')
    p.locator('#find-your-way button[aria-label="Close"]').click()
    p.wait_for_function('() => !document.querySelector("#find-your-way")')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#side-map')
    check(p.locator('#find-your-way').count() == 0, 'closed stays closed')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def main():
    fails = run(part)
    if fails:
        for f in fails:
            print('FAIL', f)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
