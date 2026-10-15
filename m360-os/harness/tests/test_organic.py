#!/usr/bin/env python3
"""Organic, the launch playbook for organic growth: a campaign is made from the empty state with the
playbook's numbers; the six steps read live from the data (volume from accounts and posted posts, the one
feature, onboarding questions with the paywall last, price tests with the best revenue per trial, the
waitlist, and the paid ads floor at 50 conversions in 7 days); the studio drafts a slideshow with the AI
and with it off, saves it, makes a variant and downloads every slide as a PNG; the schedule plans the rest
of the week at each account's daily target, marks a post posted and keeps its numbers; a member sees and
writes the same campaign; nothing scrolls sideways at 390.

Run: cd m360-os && python3 harness/tests/test_organic.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402


def part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    h.roster(p, ('u_m1',))
    h.go(p, 'founder', hash='#organic', width=1280)
    p.wait_for_selector('#organic')
    check(p.locator('.side-item:has-text("Organic")').count() == 1, 'Organic is in the sidebar')
    check(p.locator('.section-tabs .tab').count() == 4, 'four tabs: %d' % p.locator('.section-tabs .tab').count())
    check('Post at volume from day one' in p.inner_text('#organic'), 'the empty state lists the six steps')

    # make a campaign
    p.locator('#organic button:has-text("New campaign")').first.click()
    p.fill('#org-title', 'Golf app launch')
    p.locator('.drawer button:has-text("Make the campaign")').click()
    p.wait_for_selector('#org-playbook')
    cid = h.ctx(p, 'M.organic.campaigns(ctx)[0].id')
    c = h.ctx(p, 'M.organic.campaign(ctx, %r)' % cid)
    check(c['target'] == 8 and c['perDay'] == 5 and c['waitGoal'] == 5000 and c['trialDays'] == 14, 'the playbook defaults: %r' % c)
    check(p.locator('.org-step').count() == 6, 'six steps')
    check(p.locator('.org-step[data-ok="1"]').count() == 0, 'nothing done on a fresh campaign')

    # step 2: the one screen, saved on blur
    p.locator('#org-step-feature .org-step-head').click()
    p.fill('#org-feature', 'Point the camera at the ball and get the club and the aim.')
    p.locator('#org-feature').blur()
    p.wait_for_function('() => (M.organic.campaign(M.lastCtx, %r).feature || {}).line' % cid)
    p.locator('#org-step-feature label:has-text("in one look")').click()
    p.wait_for_selector('#org-step-feature[data-ok="1"]')

    # step 3: five questions and the paywall last
    p.locator('#org-step-onboarding .org-step-head').click()
    for q in ('What is your goal?', 'How often do you play?', 'What is your handicap?', 'Where do you lose shots?', 'When do you want to improve by?'):
        p.fill('#org-q', q)
        p.locator('#org-step-onboarding button:has-text("Add question")').click()
        p.wait_for_timeout(150)
    p.locator('#org-step-onboarding label:has-text("paywall comes after")').click()
    p.wait_for_selector('#org-step-onboarding[data-ok="1"]')
    check(p.locator('#org-step-onboarding .org-qs li').count() == 5, 'five questions listed')

    # step 4: two price tests, the best per trial marked keep
    p.locator('#org-step-price .org-step-head').click()
    for price, trials, paid in (('4000', '200', '20'), ('12000', '180', '12')):
        p.fill('#org-price', price)
        p.fill('#org-trials', trials)
        p.fill('#org-paid', paid)
        p.locator('#org-step-price button:has-text("Add price test")').click()
        p.wait_for_timeout(150)
    p.wait_for_selector('#org-step-price[data-ok="1"]')
    best = h.ctx(p, 'M.organic.bestPrice(M.organic.campaign(ctx, %r)).price' % cid)
    check(best == 12000, 'the best revenue per trial is the higher price: %r' % best)
    check('keep' in p.inner_text('#org-step-price tr.org-best'), 'the best row is marked keep')

    # step 6: the ads floor
    p.locator('#org-step-ads .org-step-head').click()
    p.fill('#org-cpa', '700')
    p.locator('#org-cpa').blur()
    p.fill('#org-budget', '3000')
    p.locator('#org-budget').blur()
    p.wait_for_function('() => (M.organic.campaign(M.lastCtx, %r).ads || {}).budget === 3000' % cid)
    check(h.ctx(p, 'M.organic.adNeed(700)') == 5000, 'learning at 700 a conversion needs 5000 a day')
    check(p.locator('#org-step-ads[data-ok="0"]').count() == 1, 'a budget under the floor holds paid ads')
    check('5,000' in p.inner_text('#org-step-ads'), 'the floor reads in rupees')

    # step 5: the waitlist
    p.locator('#org-step-prelaunch .org-step-head').click()
    p.fill('#org-wait', '5200')
    p.locator('#org-wait').blur()
    p.wait_for_selector('#org-step-prelaunch[data-ok="1"]')

    # accounts: add two, the second owned by a member
    h.go(p, 'founder', hash='#handles', width=1280)
    p.wait_for_selector('#org-handles')
    p.fill('#org-handle', '@golftips4')
    p.fill('#org-acc-perday', '3')
    p.locator('#org-handles button:has-text("Add account")').click()
    p.wait_for_timeout(200)
    p.fill('#org-handle', 'golfingworld0')
    p.select_option('#org-platform', 'instagram')
    p.locator('#org-handles button:has-text("Add account")').click()
    p.wait_for_function('() => Object.keys(M.organic.campaign(M.lastCtx, %r).accounts).length === 2' % cid)
    p.fill('#org-handle', 'golftips4')
    p.select_option('#org-platform', 'tiktok')
    p.locator('#org-handles button:has-text("Add account")').click()
    p.wait_for_timeout(200)
    check(len(h.ctx(p, 'M.organic.campaign(ctx, %r).accounts' % cid)) == 2, 'a duplicate handle is refused')
    check(p.locator('#org-handles tbody tr').count() == 2, 'two accounts listed')

    # studio: the AI draft, save, variant, download
    h.go(p, 'founder', hash='#slides', width=1280)
    p.wait_for_selector('#org-studio')
    p.locator('#org-studio button:has-text("New slideshow")').click()
    p.fill('#org-topic', 'golf')
    p.locator('.drawer button:has-text("Draft the slides")').click()
    p.wait_for_function('() => [...document.querySelectorAll(".drawer textarea")].some(t => /weird golf habits/.test(t.value))')
    check(p.locator('.drawer .org-slide').count() == 7, 'the preview shows seven slides: %d' % p.locator('.drawer .org-slide').count())
    p.locator('.drawer button:has-text("Save slideshow")').click()
    p.wait_for_selector('.org-deck')
    p.locator('.org-deck button:has-text("Make a variant")').click()
    p.wait_for_selector('.drawer:has-text("Edit slideshow")')
    p.locator('.drawer button:has-text("Close")').last.click()
    p.wait_for_function('() => document.querySelectorAll(".org-deck").length === 2')
    p.evaluate('() => { window.__downloads.length = 0; }')
    p.locator('.org-deck').first.locator('button:has-text("Download slides")').click()
    p.wait_for_function('() => window.__downloads.length === 7', timeout=15000)
    dl = p.evaluate('() => window.__downloads.map(d => d.filename)')
    check(all(f.endswith('.png') for f in dl) and dl[0].endswith('-01.png'), 'seven PNG slides: %r' % dl[:2])

    # the AI off: a template draft in the chosen format
    h.go(p, 'founder', hash='#slides', width=1280, noai='1')
    p.wait_for_selector('#org-studio')
    p.locator('#org-studio button:has-text("New slideshow")').click()
    p.fill('#org-topic', 'Skincare')
    p.locator('.drawer .seg button:has-text("Mistakes")').click()
    p.fill('#org-n', '4')
    p.locator('.drawer button:has-text("Draft the slides")').click()
    p.wait_for_function('() => [...document.querySelectorAll(".drawer textarea")].some(t => t.value === "4 skincare mistakes everyone makes")')
    check(p.locator('.drawer textarea').count() == 6, 'hook, four points and the follow slide: %d' % p.locator('.drawer textarea').count())
    p.keyboard.press('Escape')

    # schedule: plan the week, post one, log its numbers
    h.go(p, 'founder', hash='#posting', width=1280)
    p.wait_for_selector('#org-schedule')
    p.locator('#org-schedule button:has-text("Plan the rest of the week")').click()
    p.wait_for_function('() => M.organic.posts(M.lastCtx, %r).length > 0' % cid)
    ps = h.ctx(p, 'M.organic.posts(ctx, %r)' % cid)
    days = sorted(set(x['d'] for x in ps))
    accs = h.ctx(p, 'M.organic.campaign(ctx, %r).accounts' % cid)
    a3 = [k for k, v in accs.items() if v['handle'] == 'golftips4'][0]
    per = {}
    for x in ps:
        per.setdefault((x['a'], x['d']), 0)
        per[(x['a'], x['d'])] += 1
    want = {k: (v.get('perDay') or 5) for k, v in accs.items()}
    check(want[a3] == 3, 'golftips4 posts 3 a day')
    check(all(n == want[a] for (a, d), n in per.items()), 'each account gets its own daily target: %r' % list(per.values())[:6])
    check(all(x['k'] for x in ps), 'every planned post has a slideshow')
    check(min(days) == h.ctx(p, 'U.todayStr()'), 'planning starts today')
    n0 = len(ps)
    p.locator('#org-schedule button:has-text("Plan the rest of the week")').click()
    p.wait_for_timeout(300)
    check(len(h.ctx(p, 'M.organic.posts(ctx, %r)' % cid)) == n0, 'planning twice adds nothing')
    p.wait_for_selector('#org-schedule .card:has-text("To post today")')
    first = p.locator('#org-schedule .org-post').first
    first.locator('button:has-text("Mark posted")').click()
    p.wait_for_function('() => M.organic.posts(M.lastCtx, %r).some(x => x.s === "posted")' % cid)
    # open the cell for that post and log its views
    done = [x for x in h.ctx(p, 'M.organic.posts(ctx, %r)' % cid) if x['s'] == 'posted'][0]
    p.locator('.org-cell[data-acc="%s"][data-day="%s"]' % (done['a'], done['d'])).click()
    row = p.locator('.drawer .org-post[data-pid="%s"]' % done['id'])
    row.locator('input[type="number"]').first.fill('125000')
    row.locator('input[type="number"]').nth(1).fill('4900')
    row.locator('input[type="number"]').nth(1).blur()
    p.wait_for_function('() => M.organic.stats(M.lastCtx, M.organic.campaign(M.lastCtx, %r)).views === 125000' % cid)
    p.keyboard.press('Escape')
    check('125k' in p.inner_text('#org-schedule .org-kpis'), 'the 30 day views read 125k')
    check(h.ctx(p, 'M.organic.stats(ctx, M.organic.campaign(ctx, %r)).posts7' % cid) == 1, 'one post in the last 7 days')

    # Home: the posts due today on the founder's own accounts, in a quiet fold
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#home-organic')
    mine = h.ctx(p, 'M.organic.mineToday(ctx).length')
    check(mine > 0 and str(mine) in p.inner_text('#home-organic'), 'the Home fold counts my posts today: %r' % mine)
    # Cmd K finds the studio
    p.keyboard.press('Control+k')
    p.wait_for_selector('.pal input')
    p.fill('.pal input', 'slideshow')
    p.wait_for_selector('.pal:has-text("Slideshow studio")')
    p.keyboard.press('Escape')

    # a member sees the same campaign and can write to it
    h.go(p, 'm1', hash='#organic', width=1280)
    p.wait_for_selector('#org-playbook')
    check(p.locator('.org-step[data-ok="1"]').count() == 4, 'the member sees four steps done: %d' % p.locator('.org-step[data-ok="1"]').count())
    h.go(p, 'm1', hash='#handles', width=1280)
    p.wait_for_selector('#org-handles')
    p.fill('#org-handle', 'golfersdigest0')
    p.locator('#org-handles button:has-text("Add account")').click()
    p.wait_for_function('() => Object.keys(M.organic.campaign(M.lastCtx, %r).accounts).length === 3' % cid)
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('.split')
    p.wait_for_timeout(300)
    check(p.locator('#home-organic').count() == 0, 'no Organic fold for a member with nothing planned on their accounts')

    # phone: no sideways scroll on any tab
    for hsh in ('#organic', '#slides', '#handles', '#posting'):
        h.go(p, 'founder', hash=hsh, width=390)
        p.wait_for_selector('#organic')
        p.wait_for_timeout(250)
        check(h.overflow(p) == 0, 'overflow at 390 on %s: %d' % (hsh, h.overflow(p)))
        small = h.small_text(p)
        check(not small, 'text under 11px on %s: %r' % (hsh, small[:3]))

    # the map lists it
    h.go(p, 'founder', hash='#map', width=1280)
    p.wait_for_selector('#map-organic')
    check('Studio' in p.inner_text('#map-organic'), 'the map lists the Organic tabs')

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
