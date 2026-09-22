#!/usr/bin/env python3
"""v2 end to end: tap in with mood, status, and every AI feature against the mock Claude.
Also checks what a member's prompts carry: never teammates' lateness, locations or money."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)
        print('FAIL:', msg)


def tasks(page):
    return page.evaluate('() => Object.entries(window.__db.store()).filter(([k]) => k.startsWith("tasks/")).map(([k, v]) => ({id: k, ...v}))')


def test(h):
    page = h.session('founder', width=1280, hash='#home', reset=True, seed=True, geo=(19.076, 72.8777, 25))
    seed(h, page)

    # ---- tap in as a member with no check-in today, with a mood ----
    h.go(page, 'm3', hash='#home', width=1280, seed=True)
    page.wait_for_timeout(400)
    check(page.get_by_role('button', name='Check in, office').is_visible(), 'check in shows in the hero for someone not in yet')
    page.get_by_role('button', name='on fire').click()
    page.get_by_role('button', name='Check in, office').click()
    page.wait_for_timeout(700)
    ci = page.evaluate('() => window.__db.get("checkin/u_m3")') or {}
    day = list((ci.get('days') or {}).values())
    check(day and day[-1].get('mood') == 5, 'mood saved with the check-in: %r' % day)
    check(day and day[-1]['loc']['verified'] is True, 'check-in verified at the office')
    check('In since' in page.inner_text('main'), 'hero switches to the in-the-day state')

    # ---- status ----
    page.get_by_role('button', name='Set a status').click()
    page.get_by_role('button', name='Deep work').click()
    page.wait_for_timeout(300)
    st = page.evaluate('() => window.__db.get("me/u_m3")') or {}
    check(st.get('status', {}).get('text') == 'Deep work', 'status saved: %r' % st)

    # ---- member AI: brief me ----
    h.go(page, 'm1', hash='#home', width=1280, seed=True)
    page.wait_for_timeout(300)
    page.evaluate('window.__sampleCalls = []')
    page.get_by_role('button', name='Brief me').click()
    page.wait_for_timeout(500)
    check('Ship the hero reel script first' in page.inner_text('main'), 'brief text renders')
    cache = page.evaluate('() => window.__db.get("data/users/u_m1/ai")') or {}
    check(cache.get('brief', {}).get('text', '').startswith('**Ship'), 'brief cached privately for the day')
    calls = page.evaluate('window.__sampleCalls')
    prompt = calls[-1]['text'] if calls else ''
    check('Write hero reel script' in prompt and 'OVERDUE' in prompt, 'brief prompt carries my overdue task')

    # ---- member AI: quick add in plain words ----
    page.fill('#quick-add', 'ask aanya to cut the teaser by friday')
    page.keyboard.press('Enter')
    page.wait_for_timeout(600)
    t = [x for x in tasks(page) if x['title'] == 'Cut the teaser']
    check(t and t[0]['owner'] == 'u_m2' and t[0]['priority'] == 'high', 'AI quick add assigned the task to Aanya: %r' % t)

    # ---- member AI: Ask m360 creates a task through a tool ----
    page.keyboard.press('Control+k')
    page.get_by_role('button', name='Add a task for me to follow up with the client tomorrow').click()
    page.wait_for_timeout(800)
    t = [x for x in tasks(page) if x['title'] == 'Follow up with the client']
    check(t and t[0]['owner'] == 'u_m1', 'Ask m360 tool created a task for me: %r' % t)
    check(page.locator('.bubble.act').count() >= 1, 'action bubble shows what the AI did')
    calls = page.evaluate('window.__sampleCalls')
    askp = [c for c in calls if c.get('tools')]
    check(askp and 'reassign_task' not in askp[-1]['tools'], 'members never get the reassign tool')
    # privacy: a member prompt never carries teammates' lateness, location checks, points or money
    mp = askp[-1]['text'] if askp else ''
    aanya = [ln for ln in mp.split('\n') if ln.startswith('- Aanya')]
    check(aanya and 'LATE' not in aanya[0] and 'verified' not in aanya[0] and 'points' not in aanya[0], 'teammate privacy in member prompt: %r' % aanya)
    check('PIPELINE' not in mp and 'CLIENTS:' not in mp and '₹' not in mp, 'no money in a member prompt')
    page.keyboard.press('Escape')

    # ---- the cursor buddy: points at things on screen, and goes to other sections to show you ----
    h.go(page, 'm2', hash='#home', width=1280, seed=True)
    page.wait_for_timeout(300)
    page.mouse.move(400, 300)
    page.wait_for_timeout(150)
    check(page.locator('.buddy').count() == 1, 'the pointer rides next to the cursor')
    page.locator('.buddy-home').click()
    page.fill('#buddy-input', 'show me the leave form')
    page.keyboard.press('Enter')
    page.wait_for_function("() => /Request leave/.test((document.querySelector('.buddy-bubble') || {}).innerText || '')", timeout=8000)
    page.wait_for_timeout(300)
    check(page.evaluate('location.hash') == '#leave', 'buddy opened the leave section: %r' % page.evaluate('location.hash'))
    check(page.locator('.buddy-ring').count() == 1, 'buddy rings the element it points at')
    ring = page.locator('.buddy-ring').bounding_box()
    btn = page.get_by_role('button', name='Request leave').bounding_box()
    check(ring and btn and abs(ring['x'] + 6 - btn['x']) < 3 and abs(ring['y'] + 6 - btn['y']) < 3, 'ring sits on the Request leave button: %r %r' % (ring, btn))
    check('Request leave' in page.locator('.buddy-bubble').inner_text(), 'buddy answers in its bubble')
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    check(page.locator('.buddy-bubble').count() == 0 and page.locator('.buddy-ring').count() == 0, 'Escape puts the buddy away')

    # ---- member AI: wrap your day with an AI draft ----
    h.go(page, 'm2', hash='#home', width=1280, seed=True)
    page.wait_for_timeout(400)
    if page.get_by_role('button', name='Write it for me').count():
        page.get_by_role('button', name='Write it for me').click()
        page.wait_for_timeout(500)
        check(page.input_value('#wrap-next') == 'Lock the shot list.', 'AI draft fills the EOD fields')
        page.get_by_role('button', name='Post EOD line').click()
        page.wait_for_timeout(400)
        eod = page.evaluate('() => window.__db.get("eod/u_m2")') or {}
        check(any(d.get('shipped') == 'Storyboarded the hero reel.' for d in eod.get('days', {}).values()), 'EOD posted from the draft')
    else:
        print('note: wrap card not shown at this hour for m2; skipped')

    # ---- founder HQ: intelligence brief and one tap assign ----
    h.go(page, 'founder', hash='#hq', width=1280, seed=True, online='u_m2')
    page.wait_for_timeout(400)
    page.locator('.ai-card.dark').get_by_role('button', name='Brief me').click()
    page.wait_for_timeout(600)
    check('shot list is the bottleneck' in page.inner_text('main'), 'HQ headline renders')
    before = len(tasks(page))
    page.get_by_role('button', name='Assign').nth(1).click()
    page.wait_for_timeout(500)
    t = [x for x in tasks(page) if x['title'] == 'Chase Blah Studio for the call sheet']
    check(len(tasks(page)) == before + 1 and t and t[0]['owner'] == 'u_m1', 'Assign created the task for Durvesh: %r' % t)
    hqc = page.evaluate('() => window.__db.get("data/users/u_founder/ai")') or {}
    check(bool(hqc.get('hq', {}).get('data', {}).get('headline')), 'HQ brief cached privately')
    fp = page.evaluate('window.__sampleCalls')[-1]['text']
    check('PIPELINE' in fp and 'LATE' in fp, 'founder prompt carries the whole company')

    # ---- founder HQ: rebalance ----
    page.get_by_role('button', name='Rebalance').click()
    page.wait_for_timeout(500)
    page.get_by_role('button', name='Move it').click()
    page.wait_for_timeout(400)
    cb = [x for x in tasks(page) if x['title'] == 'Creator brief']
    check(cb and cb[0]['owner'] == 'u_m3', 'rebalance moved Creator brief to Ishaan: %r' % cb)
    check(page.locator('text=online').count() > 0, 'live now shows online people')

    # ---- brief to tasks ----
    h.go(page, 'founder', hash='#work', width=1280, seed=True)
    page.wait_for_timeout(300)
    page.get_by_role('button', name='Brief to tasks').click()
    page.fill('#brief-text', 'Swisse wants ten Diwali reels, live by 20 October, Hindi and English.')
    page.get_by_role('button', name='Break it down').click()
    page.wait_for_timeout(500)
    before = len(tasks(page))
    page.get_by_role('button', name='Send 2 tasks').click()
    page.wait_for_timeout(600)
    new = [x for x in tasks(page) if x['title'] in ('Write ten Diwali reel scripts', 'Book the studio day')]
    check(len(tasks(page)) == before + 2 and {x['owner'] for x in new} == {'u_m1', 'u_m3'}, 'brief became 2 assigned tasks: %r' % new)

    # ---- AI off and AI refused ----
    h.go(page, 'm1', hash='#home', width=1280, seed=True, noai=True)
    page.wait_for_timeout(300)
    check(page.locator('.buddy-home').count() == 0 and 'Your day, sorted' not in page.inner_text('main'), 'no AI surfaces without sample')
    h.go(page, 'm1', hash='#home', width=390, seed=True, aierr='not_granted')
    page.wait_for_timeout(300)
    page.evaluate('() => { const k = Object.keys(window.__db.store()); }')
    btn = page.get_by_role('button', name='Refresh')
    if btn.count():
        btn.click()
        page.wait_for_timeout(300)
        check('AI is off for you' in page.inner_text('main'), 'friendly copy when AI is declined')
    check(h.overflow(page) == 0, 'no overflow at 390')

    # ---- check-in edge cases, each in its own browser session ----
    far = h.session('founder', width=390, hash='#home', reset=True, seed=True, geo=(19.2, 72.9, 30))
    seed(h, far)
    h.go(far, 'm3', hash='#home', width=390, seed=True)
    far.wait_for_timeout(300)
    far.get_by_role('tab', name='WFH', exact=True).click()
    far.get_by_role('button', name='Check in, WFH').click()
    far.wait_for_timeout(600)
    e = list(((far.evaluate('() => window.__db.get("checkin/u_m3")') or {}).get('days') or {}).values())
    check(e and e[-1]['mode'] == 'wfh' and e[-1]['loc']['verified'] is False and e[-1]['loc']['place'].startswith('Outside office'),
          'far check-in is unverified with a distance: %r' % (e[-1] if e else None))
    far.get_by_role('button', name='Check out').click()
    far.wait_for_timeout(600)
    e = list(((far.evaluate('() => window.__db.get("checkin/u_m3")') or {}).get('days') or {}).values())
    check(e and e[-1].get('out'), 'check out stamps the time')
    check('Done for today' in far.inner_text('main'), 'hero shows the day as done')
    # WFH cap: Aanya already has two WFH days this week
    h.go(far, 'm2', hash='#home', width=390, seed=True)
    far.wait_for_timeout(300)
    if far.get_by_role('button', name='Check in, office').count():
        far.get_by_role('tab', name='WFH', exact=True).click()
        far.wait_for_timeout(200)
        check(far.get_by_role('button', name='Check in, office').count() == 1, 'WFH is refused at the cap')

    nogeo = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, nogeo)
    h.go(nogeo, 'm3', hash='#home', width=1280, seed=True)
    nogeo.wait_for_timeout(300)
    nogeo.get_by_role('button', name='Check in, office').click()
    nogeo.wait_for_selector('text=Where are you checking in from?', timeout=15000)
    nogeo.get_by_role('button', name='Client site').click()
    nogeo.wait_for_timeout(500)
    e = list(((nogeo.evaluate('() => window.__db.get("checkin/u_m3")') or {}).get('days') or {}).values())
    check(e and e[-1]['loc']['src'] == 'self' and e[-1]['loc']['place'] == 'Client site' and e[-1]['loc']['verified'] is False,
          'blocked location falls back to a self-reported place: %r' % (e[-1] if e else None))

    check(not h.errors(), 'console errors: %r' % h.errors()[:3])
    return fails


if __name__ == '__main__':
    out = run(test)
    if out:
        print('FAILED %d' % len(out))
        sys.exit(1)
    print('PASS')
