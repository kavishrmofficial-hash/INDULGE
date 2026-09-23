#!/usr/bin/env python3
"""v4 test: the command palette, inbox, focus timer, reviews with drag and drop, calendar, polls,
trophies and celebrations, breathe, the buddy tour, HQ tape and heatmap, shortcuts, mentions,
dark mode, the client update writer and the phone layout.

Run: cd m360-os && python3 harness/tests/test_v4.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#home', width=1280, online='u_m1')
    p.wait_for_selector('.side-tools')

    # ---- palette: find a task, run an action ----
    p.keyboard.press('Control+k')
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'shot list')
    p.wait_for_selector('.pal-item:has-text("Lock the shot list")')
    p.keyboard.press('Enter')
    p.wait_for_selector('.drawer:has-text("Lock the shot list")')
    check(p.evaluate('location.hash') == '#tasks/t2', 'palette did not open the task: ' + p.evaluate('location.hash'))
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    p.keyboard.press('/')
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'dark mode')
    p.keyboard.press('Enter')
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    h.shot(p, 'v4-dark-home')
    p.evaluate('M.theme.set("light")')

    # ---- HQ: tape, heatmap, reviews on the founder ----
    h.go(p, 'founder', hash='#hq', width=1280, online='u_m1')
    p.wait_for_selector('#tape')
    check(p.locator('#tape .tape-row').count() >= 1, 'tape is empty')
    check(p.locator('#moodheat .heat-cell').count() > 20, 'heatmap missing')
    check('Lock the shot list' in p.inner_text('#reviews'), 'review queue missing the seeded task')
    h.shot(p, 'v4-hq')

    # ---- drag and drop on the board (m1 moves hero script into review) ----
    h.go(p, 'm1', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard[data-task="t1"]')
    card = p.locator('.tcard[data-task="t1"] .grip').bounding_box()
    dest = p.locator('.colm[data-status="review"]').bounding_box()
    p.mouse.move(card['x'] + 4, card['y'] + 4)
    p.mouse.down()
    p.mouse.move(card['x'] + 40, card['y'] + 40, steps=4)
    p.mouse.move(dest['x'] + dest['width'] / 2, dest['y'] + 60, steps=8)
    p.mouse.up()
    p.wait_for_function('() => window.__db.get("tasks/t1").status === "review"')
    check(doc(p, 'tasks/t1').get('reviewAt'), 'reviewAt not stamped')
    check(p.locator('.drawer').count() == 0, 'drag opened the drawer')

    # ---- founder reviews: approve one, send one back with a note ----
    h.go(p, 'founder', hash='#reviews', width=1280)
    p.wait_for_selector('#rev-t2')
    p.locator('#rev-t2').get_by_role('button', name='Approve').click()
    p.wait_for_function('() => window.__db.get("tasks/t2").status === "done"')
    check(doc(p, 'tasks/t2').get('approvedBy') == 'u_founder', 'approvedBy missing')
    p.locator('#rev-t1').get_by_role('button', name='Send back').click()
    p.fill('#rev-t1 input', 'Tighten the opening line')
    p.locator('#rev-t1').get_by_role('button', name='Send back').click()
    p.wait_for_function('() => window.__db.get("tasks/t1").status === "doing"')
    t1 = doc(p, 'tasks/t1')
    check(t1.get('revisions') == 1 and t1.get('sentBackNote') == 'Tighten the opening line', 'send back %r' % {k: t1.get(k) for k in ('revisions', 'sentBackNote')})

    # ---- inbox: m1 sees the send back and the approval, then reading clears the badge ----
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('.bellbtn .badge')
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    body = p.inner_text('.drawer')
    check('sent Write hero reel script back: Tighten the opening line' in body, 'inbox missing send back: ' + body[:300])
    check('approved Lock the shot list' in body, 'inbox missing approval')
    check('gave you kudos' in body, 'inbox missing kudos')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".bellbtn .badge")')
    check(doc(p, 'me/u_m1').get('inboxSeen'), 'inboxSeen not written')

    # ---- mentions in a comment ----
    h.go(p, 'm1', hash='#tasks/t1', width=1280)
    p.wait_for_selector('#task-comment')
    p.fill('#task-comment', 'Can you look @Aan')
    p.wait_for_selector('.mention-menu button:has-text("Aanya Mehta")')
    p.locator('.mention-menu button').first.click()
    check(p.input_value('#task-comment') == 'Can you look @Aanya Mehta ', 'mention not inserted: ' + p.input_value('#task-comment'))
    p.get_by_role('button', name='Add comment').click()
    p.wait_for_function('() => Object.values(window.__db.get("tasks/t1").comments).some(c => (c.mentions || []).includes("u_m2"))')
    check(p.locator('.drawer .mention').count() == 1, 'mention not highlighted')
    p.keyboard.press('Escape')
    h.go(p, 'm2', hash='#home', width=1280)
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("mentioned you on Write hero reel script")')
    p.keyboard.press('Escape')

    # ---- focus: start from the key, stop, then finish early and bank it ----
    h.go(p, 'm1', hash='#home', width=1280)
    p.keyboard.press('f')
    p.wait_for_selector('.drawer:has-text("Focus")')
    p.get_by_role('button', name='Start 25 minutes').click()
    p.wait_for_selector('#focus-pill')
    check('24:5' in p.inner_text('#focus-pill') or '25:00' in p.inner_text('#focus-pill'), 'timer text ' + p.inner_text('#focus-pill'))
    p.locator('#focus-pill').get_by_role('button', name='Stop focus').click()
    p.wait_for_function('() => !document.querySelector("#focus-pill")')
    p.locator('.quick').get_by_role('button', name='Focus').click()
    p.get_by_role('button', name='Start 45 minutes').click()
    p.wait_for_selector('#focus-pill')
    p.locator('.side-tools').get_by_role('button', name='Focus timer').click()
    p.get_by_role('button', name='Done early').click()
    p.wait_for_function('() => (((window.__db.get("me/u_m1") || {}).focus || {}).sessions || []).length === 1')
    check(doc(p, 'me/u_m1')['focus']['sessions'][0]['mins'] == 45, 'session minutes')

    # ---- calendar ----
    h.go(p, 'm1', hash='#calendar', width=1280)
    p.wait_for_selector('#calendar')
    check(p.locator('.cal-day').count() >= 35, 'calendar days')
    check(p.locator('.cal-ev', has_text='Creator brief').count() == 0, 'mine filter shows other people')
    p.get_by_role('tab', name='Everyone').click()
    p.wait_for_selector('.cal-ev:has-text("Creator brief")')
    p.locator('.cal-day.today').click()
    p.wait_for_selector('.drawer')
    p.get_by_role('button', name='New task due this day').click()
    p.wait_for_selector('#task-due')
    check(p.input_value('#task-due') == p.evaluate('M.U.todayStr()'), 'due not prefilled: ' + p.input_value('#task-due'))
    p.keyboard.press('Escape')

    # ---- polls ----
    h.go(p, 'm1', hash='#feed', width=1280)
    p.get_by_role('tab', name='Poll').click()
    p.fill('#feed-text', 'Friday plan?')
    inputs = p.locator('#poll-options input')
    inputs.nth(0).fill('Bowling')
    inputs.nth(1).fill('Dinner')
    p.get_by_role('button', name='Post').click()
    p.wait_for_selector('.poll-opt:has-text("Bowling")')
    p.locator('.poll-opt', has_text='Dinner').click()
    p.wait_for_function('() => { const v = window.__db.get("votes/u_m1"); return v && v.polls && Object.values(v.polls)[0] === 1; }')
    p.wait_for_selector('.poll-opt.on:has-text("100%")')
    h.go(p, 'm2', hash='#feed', width=1280)
    p.locator('.poll-opt', has_text='Bowling').click()
    p.wait_for_selector('.poll-opt:has-text("50%")')

    # ---- trophies, about you, celebrations ----
    h.go(p, 'm1', hash='#trophies', width=1280)
    p.wait_for_selector('#trophies')
    check(p.locator('.trophy').count() == 14, 'trophy count')
    check(p.locator('.trophy:not(.locked)').count() >= 2, 'no trophies earned from seeded work')
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#about-card')
    today = p.evaluate('M.U.todayStr()')
    p.fill('#about-card input[type="date"]', '1999-' + today[5:])
    p.locator('#about-card').get_by_role('button', name='Save').click()
    p.wait_for_function('() => (window.__db.get("me/u_m1") || {}).birthday === "%s"' % today[5:])
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#celebrate')
    check('Durvesh Patil' in p.inner_text('#celebrate') and 'birthday' in p.inner_text('#celebrate'), 'celebration card: ' + p.inner_text('#celebrate'))
    p.locator('#celebrate').get_by_role('button', name='Send wishes').click()
    p.wait_for_function('() => (window.__db.get("kudos/u_founder").given || []).some(k => /birthday/i.test(k.why))')
    h.go(p, 'founder', hash='#calendar', width=1280)
    p.wait_for_selector('.cal-ev.bday')

    # ---- breathe, tour, shortcuts sheet ----
    h.go(p, 'm1', hash='#home', width=1280)
    p.keyboard.press('b')
    p.wait_for_selector('#breathe')
    check('Breathe in' in p.inner_text('#breathe'), 'breathe copy')
    p.get_by_role('button', name='Skip').click()
    p.wait_for_function('() => !document.querySelector("#breathe")')
    p.keyboard.press('?')
    p.wait_for_selector('.drawer:has-text("Keyboard shortcuts")')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    p.evaluate('window.dispatchEvent(new CustomEvent("m360:tour"))')
    p.wait_for_selector('.buddy-bubble:has-text("Home is your day")')
    p.locator('.buddy-bubble').get_by_role('button', name='Next').click()
    p.wait_for_selector('.buddy-bubble:has-text("New makes anything")')
    check(p.locator('.buddy-ring').count() == 1, 'tour ring missing')
    p.locator('.buddy-bubble').get_by_role('button', name='Skip').click()
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')

    # ---- g then w navigates; prefs card toggles sound ----
    p.keyboard.press('g')
    p.keyboard.press('w')
    p.wait_for_function('() => location.hash === "#tasks"')
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#prefs-card')
    p.locator('#prefs-card').get_by_role('tab', name='Off').click()
    check(p.evaluate('localStorage.getItem("m360.sound")') == '0', 'sound pref')
    p.locator('#prefs-card').get_by_role('button', name='Ink').click()
    p.wait_for_function('() => document.documentElement.getAttribute("data-theme") === "dark"')
    p.locator('#prefs-card').get_by_role('button', name='Auto').click()

    # ---- client update writer ----
    h.go(p, 'founder', hash='#clients', width=1280)
    p.locator('.card.rowbtn', has_text='Swisse Wellness UAE').click()
    p.wait_for_selector('#client-update')
    p.locator('#client-update').get_by_role('button', name='Write an update').click()
    p.wait_for_selector('#client-update .ai-out', timeout=15000)
    p.keyboard.press('Escape')

    # ---- phone ----
    h.go(p, 'm1', hash='#home', width=390)
    p.wait_for_selector('.topbar .bellbtn')
    p.locator('.topbar').get_by_role('button', name='Search').click()
    p.wait_for_selector('#pal-input')
    box = p.locator('.pal').bounding_box()
    check(box['x'] >= 0 and box['x'] + box['width'] <= 390, 'palette off screen')
    p.keyboard.press('Escape')
    ov = p.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    check(ov <= 0, 'phone overflow %d' % ov)
    h.go(p, 'm1', hash='#calendar', width=390)
    p.wait_for_selector('#calendar')
    ov = p.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    check(ov <= 0, 'calendar phone overflow %d' % ov)
    h.shot(p, 'v4-calendar-390')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
