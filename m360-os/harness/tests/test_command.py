#!/usr/bin/env python3
"""v40 Command test: the founder dashboard in the v7 layout on live data (src/js/40-command.js).

HQ opens on Command: the date label, "Command." and the greeting; 01 needs you lists pending leave as cards.
Approve writes the decision once the card has closed up and the island offers UNDO, which takes it back;
a swipe on touch acts the same way. 02 numbers, 03 attendance with filter chips, 04 flags with the rule select
and severity chips, the dark band (05 to 07), 08 to 10 and 11 clients all render. The counter rail sits on the
right edge on a laptop and is gone on a phone. The rest of HQ sits under "more from HQ". Reduced motion shows
everything at once. No horizontal scroll at 1440, 1024 and 390. No console errors.

Run: cd m360-os && python3 harness/tests/test_command.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1440, hash='#home', reset=True, seed=True)
    h.roster(p)
    today = p.evaluate('M.U.todayStr()')
    now = int(time.time() * 1000)
    h.seed_doc(p, 'leave/u_m1', {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'type': 'casual', 'at': now - 60000}]})
    h.seed_doc(p, 'leave/u_m2', {'reqs': [{'id': 'L2', 'from': today, 'to': today, 'type': 'sick', 'at': now - 30000}]})
    h.go(p, 'founder', hash='#hq', width=1440)
    p.wait_for_selector('#cmd7 .c-ncw[data-id="lv:u_m1:L1"]')

    # ---- the header ----
    check(p.inner_text('#cmd7 .c-top h1').strip() == 'Command.', 'the title reads Command.: %r' % p.inner_text('#cmd7 .c-top h1'))
    greet = p.inner_text('#c-greet')
    check(greet.startswith(('Good morning', 'Good afternoon', 'Good evening', 'Up late')) and greet.endswith('.'), 'greeting by the hour: %r' % greet)
    check('need' in p.inner_text('#c-needl') or 'All clear' in p.inner_text('#c-needl'), 'the need line: %r' % p.inner_text('#c-needl'))
    check(p.locator('#cmd7 .c-askf').count() == 1 and p.locator('#cmd7 .c-chip').count() == 1, 'the Ask field and the live chip')
    check(p.locator('#cmd7 .c-ngrid .c-ncw').count() <= 8, 'up to 8 cards')
    check(p.locator('#hq-rest #hq-more').count() == 1 and p.locator('#fold-setup, #tape').count() == 0, 'the rest of HQ waits under one quiet line')
    top = p.evaluate('() => [document.querySelector("#c-need").getBoundingClientRect().top, document.querySelector("#hq-rest").getBoundingClientRect().top]')
    check(top[0] < top[1], 'nothing of the rest sits above 01: %r' % top)

    # ---- approve, then UNDO in the island ----
    card = p.locator('.c-ncw[data-id="lv:u_m1:L1"]')
    card.locator('[data-a="ok"]').click()
    p.wait_for_selector('#island [data-act="undo"]', timeout=4000)
    p.wait_for_function('() => (((window.__db.get("leavedec/u_m1") || {}).d || {}).L1 || {}).status === "approved"', timeout=6000)
    check(p.locator('.c-ncw[data-id="lv:u_m1:L1"]').count() == 0, 'the approved card leaves the grid')
    p.locator('#island [data-act="undo"]').click()
    p.wait_for_function('() => !(((window.__db.get("leavedec/u_m1") || {}).d || {}).L1)', timeout=6000)
    p.wait_for_selector('.c-ncw[data-id="lv:u_m1:L1"]', timeout=6000)
    check(True, 'UNDO puts the request back')

    # ---- decline from a swipe on touch (left takes the other way) ----
    p.wait_for_timeout(5600)
    swiped = p.evaluate('''async () => {
      const c = document.querySelector('.c-ncw[data-id="lv:u_m2:L2"] .c-nc'); if (!c) return 'no card';
      const r = c.getBoundingClientRect(), y = r.top + r.height / 2, x0 = r.left + r.width / 2;
      const ev = (t, x) => c.dispatchEvent(new PointerEvent(t, {pointerType: 'touch', pointerId: 7, clientX: x, clientY: y, bubbles: true}));
      ev('pointerdown', x0);
      for (let i = 1; i <= 12; i++) { ev('pointermove', x0 - i * 20); await new Promise(f => setTimeout(f, 16)); }
      ev('pointerup', x0 - 240); return 'ok'; }''')
    check(swiped == 'ok', 'swipe ran: %r' % swiped)
    p.wait_for_function('() => (((window.__db.get("leavedec/u_m2") || {}).d || {}).L2 || {}).status === "declined"', timeout=6000)
    check(True, 'a left swipe declines')

    # ---- numbers, attendance, flags ----
    ks = p.evaluate('() => [...document.querySelectorAll("#c-kpis .c-kp")].map(k => k.dataset.k)')
    check(ks[:8] == ['in', 'late', 'ver', 'eod', 'mood', 'out', 'due', 'hf'], 'the number tiles in order: %r' % ks)
    check(('pipe' in ks and 'cl' in ks) == bool(h.ctx(p, 'ctx.isOwner')), 'money tiles for the owner only: %r' % ks)
    rows = p.locator('#c-att .c-tr.c-rw').count()
    check(rows == 4, 'a row per person on the roster: %r' % rows)
    p.locator('#c-attF .c-fc[data-f="out"]').click()
    p.wait_for_timeout(200)
    n_out = int(p.inner_text('#c-attF .c-fc[data-f="out"] b'))
    check(p.locator('#c-att .c-tr.c-rw').count() == n_out, 'the Not in chip filters the rows')
    p.locator('#c-attF .c-fc[data-f=""]').click()
    sel = p.locator('#c-flg select[aria-label="Rule filter"]')
    check(sel.count() == 1 and sel.locator('option').count() >= 17, 'the rule select lists the rules')
    p.locator('#c-flgF .c-fc[data-f="high"]').click()
    p.wait_for_timeout(200)
    sevs = p.evaluate('() => [...document.querySelectorAll("#c-flg .c-fl")].map(f => f.dataset.f)')
    check(all(s == 'high' for s in sevs), 'the High chip shows high flags only: %r' % sevs)
    p.locator('#c-flgF .c-fc[data-f=""]').click()

    # ---- the dark band, the team, clients, the rail ----
    for sid in ('c-biz', 'c-lbd', 'c-ppl', 'c-pjc', 'c-team', 'c-vox', 'c-cli'):
        check(p.locator('#' + sid).count() == 1, 'section %s renders' % sid)
    check(p.locator('#c-rail .c-ri').count() == 7 and p.locator('#c-rail').is_visible(), 'the counter rail has seven stops')
    p.locator('#c-rail .c-ri').nth(6).click()
    p.wait_for_function('() => scrollY > 600', timeout=4000)
    p.wait_for_timeout(1200)
    check(p.evaluate('() => document.querySelector("#c-biz").style.getPropertyValue("--e")') == '1.0000', 'the dark band has opened on the way past')
    check(p.evaluate('() => document.querySelectorAll("#cmd7 .c-rv.in").length') >= 5, 'sections reveal as they scroll in')
    check(h.overflow(p) <= 0, 'no horizontal scroll at 1440: %r' % h.overflow(p))

    # ---- the rest of HQ opens under the quiet line ----
    p.locator('#hq-more').click()
    p.wait_for_selector('#hq-rest .ai-card, #hq-rest #fold-workload')
    check(p.locator('#hq-rest .section-tabs').count() == 1, 'the HQ tabs stay in reach')
    p.locator('#hq-more').click()

    # ---- 1024 and phone ----
    p.set_viewport_size({'width': 1024, 'height': 800})
    p.wait_for_timeout(500)
    check(h.overflow(p) <= 0, 'no horizontal scroll at 1024: %r' % h.overflow(p))
    p.set_viewport_size({'width': 390, 'height': 844})
    p.wait_for_timeout(600)
    check(h.overflow(p) <= 0, 'no horizontal scroll at 390: %r' % h.overflow(p))
    check(not p.locator('#c-rail').is_visible(), 'no rail on a phone')
    strip = p.evaluate('() => { const k = document.querySelector("#c-kpis"); return [getComputedStyle(k).display, k.scrollWidth > k.clientWidth]; }')
    check(strip[0] == 'flex' and strip[1], 'the numbers are a swipe strip on a phone: %r' % strip)
    h.shot(p, 'command-390')

    # ---- reduced motion: everything shows at once ----
    p.emulate_media(reduced_motion='reduce')
    h.go(p, 'founder', hash='#hq', width=1440)
    p.wait_for_selector('#cmd7')
    p.wait_for_timeout(300)
    op = p.evaluate('() => [...document.querySelectorAll("#cmd7 .c-rv")].map(e => getComputedStyle(e).opacity)')
    check(op and all(o == '1' for o in op), 'reduced motion shows every section: %r' % op)
    p.emulate_media(reduced_motion='no-preference')

    # ---- dark theme ----
    p.evaluate('M.theme.set("dark")')
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    p.wait_for_timeout(300)
    h.shot(p, 'command-1440-dark')
    p.evaluate('M.theme.set("light")')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    out = run(t)
    for f in out:
        print('FAIL', f)
    print('PASS' if not out else '%d failed' % len(out))
    sys.exit(1 if out else 0)
