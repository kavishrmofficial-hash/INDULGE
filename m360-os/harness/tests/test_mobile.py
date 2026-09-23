#!/usr/bin/env python3
"""v5 test: the phone pass and the home hero.

At 390 wide, as the founder and as a member, every section fits the viewport, the tabbar items
are 44px tall, every button in the page body is at least 36px tall, drawers are bottom sheets
with a grab handle that closes on a swipe down, and inputs keep 16px type. At 1280 the home
hero shows the flame sun by day and the paper ring moon at night.

Run: cd m360-os && python3 harness/tests/test_mobile.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run, ROOT  # noqa: E402
from harness.qa import seed  # noqa: E402

PAGES = ['#home', '#work', '#projects', '#clients', '#pitches', '#feed', '#people', '#scores', '#me',
         '#leave', '#handbook', '#hq', '#admin']
FOUNDER_ONLY = ('#hq', '#admin')

SMALL_BUTTONS = '''() => {
  const out = [];
  for (const b of document.querySelectorAll('.main button')) {
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(b);
    if (cs.visibility === 'hidden') continue;
    if (r.height < 36) out.push([b.className.slice(0, 40), Math.round(r.height), b.textContent.trim().slice(0, 24)]);
  }
  return out;
}'''
TAB_HEIGHTS = '''() => [...document.querySelectorAll('.tabbar .tab-item')]
  .map(b => b.getBoundingClientRect()).filter(r => r.width && r.height).map(r => Math.round(r.height))'''
OVERFLOW = '() => document.documentElement.scrollWidth - document.documentElement.clientWidth'


def pin(p, hour, minute):
    """Pin the hero's clock to a moment today; the hero re-reads it within a second."""
    p.evaluate('([h, m]) => { const d = new Date(); d.setHours(h, m, 0, 0); M.hero.at = d.getTime(); }', [hour, minute])
    p.wait_for_function('() => document.querySelector("#home-hero") && M.hero.at')
    p.wait_for_timeout(1300)


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=390, height=844, hash='#home', reset=True, seed=True)
    seed(h, p)

    # ---- every section, founder and member, at 390 ----
    for ident in ('founder', 'm1'):
        for hsh in PAGES:
            if ident == 'm1' and hsh in FOUNDER_ONLY:
                continue
            h.go(p, ident, hash=hsh, width=390, seed=True, online='u_m2')
            p.wait_for_timeout(450)
            ov = p.evaluate(OVERFLOW)
            check(ov <= 0, '%s %s overflows by %dpx at 390' % (ident, hsh, ov))
            tabs = p.evaluate(TAB_HEIGHTS)
            check(tabs and min(tabs) >= 44, '%s %s tabbar items under 44px: %r' % (ident, hsh, tabs))
            small = p.evaluate(SMALL_BUTTONS)
            check(not small, '%s %s buttons under 36px: %r' % (ident, hsh, small[:5]))
            if ident == 'founder':
                h.shot(p, 'mobile-%s-390' % hsh.strip('#'))
            else:
                h.shot(p, 'mobile-m1-%s-390' % hsh.strip('#'))

    # ---- 360 wide: the two busiest pages still fit ----
    for hsh in ('#home', '#work'):
        h.go(p, 'm1', hash=hsh, width=360, seed=True, online='u_m2')
        p.wait_for_timeout(400)
        ov = p.evaluate(OVERFLOW)
        check(ov <= 0, '%s overflows by %dpx at 360' % (hsh, ov))
        check(not p.evaluate(SMALL_BUTTONS), '%s has buttons under 36px at 360' % hsh)
    h.shot(p, 'mobile-work-360')

    # ---- the home hero on a phone: chips in one scrolling row, panel full width ----
    h.go(p, 'm1', hash='#home', width=390, seed=True, online='u_m2')
    p.wait_for_selector('#home-hero .hero-chips')
    chips = p.evaluate('() => { const n = document.querySelector("#home-hero .hero-chips"); const cs = getComputedStyle(n); return [cs.flexWrap, cs.overflowX]; }')
    check(chips == ['nowrap', 'auto'], 'hero chips do not scroll on a phone: %r' % chips)
    panel = p.locator('#home-hero .hero-panel').bounding_box()
    check(panel and panel['width'] > 300, 'check-in panel is not full width on a phone: %r' % panel)
    check(p.locator('#install-hint').count() == 1, 'home screen hint missing on a phone browser')
    p.locator('#install-hint').get_by_role('button', name='Not now').click()
    p.wait_for_function('() => !document.querySelector("#install-hint")')
    check(p.evaluate('localStorage.getItem("m360.a2hs")') == '1', 'dismissing the hint was not remembered')

    # ---- the board: snap panes, one column wide ----
    h.go(p, 'm1', hash='#work', width=390, seed=True)
    p.wait_for_selector('.colm[data-status="todo"]')
    cols = p.evaluate('() => [...document.querySelectorAll(".colm")].map(c => Math.round(c.getBoundingClientRect().width))')
    check(cols and max(cols) <= 340 and min(cols) >= 260, 'board columns are not phone panes: %r' % cols)
    check(p.evaluate('getComputedStyle(document.querySelector(".board-wrap")).scrollSnapType') .startswith('x'), 'board does not snap')

    # ---- section tabs scroll sideways and keep the active one in view ----
    h.go(p, 'm1', hash='#handbook', width=390, seed=True)
    p.wait_for_selector('.tabs.section-tabs .tab.active')
    p.wait_for_timeout(300)
    inview = p.evaluate('''() => { const n = document.querySelector('.tabs.section-tabs'); const t = n.querySelector('.tab.active');
      const nr = n.getBoundingClientRect(), tr = t.getBoundingClientRect(); return tr.left >= nr.left && tr.right <= nr.right + 1; }''')
    check(inview, 'active section tab is not scrolled into view')

    # ---- the task drawer is a bottom sheet: handle, 92dvh, 16px inputs, swipe to close ----
    h.go(p, 'm1', hash='#work', width=390, seed=True)
    p.wait_for_selector('.tcard[data-task="t1"]')
    p.locator('.tcard[data-task="t1"]').click()
    p.wait_for_selector('.drawer .sheet-handle')
    p.wait_for_timeout(350)
    mh = p.evaluate('parseFloat(getComputedStyle(document.querySelector(".drawer")).maxHeight)')
    check(abs(mh - 844 * 0.92) < 2, 'drawer max-height is %r, expected 92dvh' % mh)
    box = p.locator('.drawer').bounding_box()
    check(box and box['x'] == 0 and abs(box['width'] - 390) < 1 and abs(box['y'] + box['height'] - 844) < 1, 'drawer is not docked to the bottom: %r' % box)
    radius = p.evaluate('getComputedStyle(document.querySelector(".drawer")).borderTopLeftRadius')
    check(radius not in ('0px', ''), 'sheet has square top corners')
    fs = p.evaluate('parseFloat(getComputedStyle(document.querySelector("#task-title")).fontSize)')
    check(fs >= 16, 'drawer input is %spx, iOS would zoom' % fs)
    foot = p.locator('.drawer-foot').bounding_box()
    check(foot and abs(foot['y'] + foot['height'] - 844) < 1, 'drawer footer does not stick to the bottom: %r' % foot)
    hb = p.locator('.drawer .sheet-handle').bounding_box()
    cx, cy = hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2
    # a short drag springs back
    p.mouse.move(cx, cy)
    p.mouse.down()
    p.mouse.move(cx, cy + 40, steps=4)
    p.mouse.up()
    p.wait_for_timeout(300)
    check(p.locator('.drawer').count() == 1, 'a 40px drag closed the sheet')
    # past the threshold it closes
    p.mouse.move(cx, cy)
    p.mouse.down()
    p.mouse.move(cx, cy + 140, steps=6)
    p.mouse.up()
    p.wait_for_selector('.drawer', state='detached')
    # the scrim still closes it
    p.locator('.tcard[data-task="t1"]').click()
    p.wait_for_selector('.drawer')
    p.mouse.click(195, 20)
    p.wait_for_selector('.drawer', state='detached')

    # ---- the hero at 1280: a sun by day, a moon at night ----
    h.go(p, 'founder', hash='#home', width=1280, seed=True, online='u_m2')
    p.wait_for_selector('#home-hero')
    pin(p, 10, 0)
    check(p.locator('#home-hero .sun').count() == 1 and p.locator('#home-hero .moon').count() == 0, 'no sun at 10:00')
    check(p.evaluate('document.querySelector("#home-hero").dataset.mode') == 'day', 'hero mode at 10:00')
    check('Good morning' in p.inner_text('#home-hero'), 'greeting at 10:00')
    check(p.locator('#home-hero .hero-panel .btn.xl').count() == 1, 'check-in button missing from the day hero')
    check(p.locator('#home-hero .moods .mood').count() == 5, 'mood row missing from the day hero')
    check(p.locator('#home-hero .chipline').count() == 4, 'stat chips missing from the day hero')
    check(p.locator('#home-hero .hero-clock .clock').count() == 1, 'hero clock missing')
    p.locator('#home-hero').screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'hero-day-1280.png'))
    pin(p, 13, 0)
    check(p.evaluate('parseFloat(document.querySelector("#home-hero").style.getPropertyValue("--sy"))') < 20, 'the sun is not high at 13:00')
    pin(p, 22, 0)
    check(p.locator('#home-hero .moon').count() == 1 and p.locator('#home-hero .sun').count() == 0, 'no moon at 22:00')
    check(p.evaluate('document.querySelector("#home-hero").classList.contains("ink")'), 'night hero is not the ink surface')
    p.locator('#home-hero').screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'hero-night-1280.png'))
    p.evaluate('M.theme.set("dark")')
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    pin(p, 10, 0)
    check(p.locator('#home-hero .sun').count() == 1, 'no sun in dark mode by day')
    p.locator('#home-hero').screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'hero-day-dark-1280.png'))
    p.evaluate('M.theme.set("auto"); M.hero.at = null')
    check(p.evaluate('M.heroMode(new Date(2026, 0, 1, 23, 0)).mode') == 'night' and p.evaluate('M.heroMode(new Date(2026, 0, 1, 8, 0)).mode') == 'day', 'M.heroMode')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
