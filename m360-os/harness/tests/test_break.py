#!/usr/bin/env python3
"""Break, the reset room, and the feed's celebrations. The daily puzzle (whichever kind today is)
solves and lands on the team's times with sparks and a streak; Flame Run ends and saves a score; a
breath, the triads and thirty uses earn sparks once; care reminders ring when due, snooze and tick,
and a full day earns sparks; Reflect shows the era with numbers, writes the read on the canned
model and shares a line to Vibe; a finished task shows on the feed as a shipped card that takes
reactions and comments; a member has the section; the phone does not overflow.

Run: cd m360-os && python3 harness/tests/test_break.py
"""
import os
import sys
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def sparks(p):
    return p.evaluate('() => M.play.mine(M.lastCtx).sparks')


def solve_today(p, check):
    kind = p.evaluate('() => M.play.kindFor(M.U.todayStr())')
    if kind == 'word':
        word = p.evaluate('() => M.play.puzzleFor(M.U.todayStr()).word')
        p.fill('#scramble-answer', 'wrongone')
        p.click('#scramble-check')
        p.wait_for_selector('#daily-puzzle:has-text("Not it")')
        p.fill('#scramble-answer', word)
        p.click('#scramble-check')
    else:
        grid = p.evaluate('() => M.play.puzzleFor(M.U.todayStr()).grid')
        for r in range(5):
            for c in range(5):
                if grid[r][c]:
                    p.click('.brk-cell[aria-label="row %d column %d"]' % (r + 1, c + 1))
    p.wait_for_selector('#puzzle-done', timeout=10000)
    return kind


def part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#break', width=1280)
    p.wait_for_selector('#break')
    check(p.locator('.section-tabs .tab').count() == 4 and sparks(p) == 0, 'the four tabs and zero sparks to start')
    # the daily puzzle
    kind = solve_today(p, check)
    p.wait_for_function('() => M.play.mine(M.lastCtx).sparks >= 10')
    me = p.evaluate('() => M.play.mine(M.lastCtx)')
    doc = p.evaluate('() => M.play.docOf(M.lastCtx)')
    td = p.evaluate('() => M.U.todayStr()')
    check(doc['days'][td]['kind'] == kind and doc['days'][td]['ms'] >= 0, 'the solve is on the record: %r' % doc.get('days'))
    check(me['sparks'] in (10, 15) and me['streak'] == 1 and me['level']['name'] == 'Spark', 'sparks and the streak after the puzzle: %r' % me)
    check('Kaavish' in p.inner_text('#puzzle-board') or p.locator('#puzzle-board .brk-row').count() == 1, 'the team\'s times list the solve')
    check(p.locator('#sparks:has-text("1 day streak")').count() == 1, 'the hero shows the streak')
    # the same puzzle is the same for everyone that day
    same = p.evaluate('() => JSON.stringify(M.play.puzzleFor(M.U.todayStr())) === JSON.stringify(M.play.puzzleFor(M.U.todayStr()))')
    check(same, 'the puzzle is seeded by the day')
    # Flame Run: start, do nothing, hit a block, the score lands
    before = sparks(p)
    p.click('#run-start')
    p.wait_for_selector('#flame-run:has-text("Run again")', timeout=25000)
    doc = p.evaluate('() => M.play.docOf(M.lastCtx)')
    check(doc.get('runner', {}).get('games') == 1 and doc['runner'].get('last', -1) >= 0, 'the run is on the record: %r' % doc.get('runner'))
    p.wait_for_function('n => M.play.mine(M.lastCtx).sparks > n', arg=before)
    # Reset: a breath, the triads, thirty uses
    h.go(p, 'founder', hash='#reset', width=1280)
    p.wait_for_selector('#break-reset')
    before = sparks(p)
    p.click('#breathe-now')
    p.wait_for_selector('#breathe')
    p.keyboard.press('Escape')
    p.wait_for_function('n => M.play.mine(M.lastCtx).sparks === n + 5', arg=before)
    p.click('#breathe-now')
    p.wait_for_selector('#breathe'); p.keyboard.press('Escape')
    p.wait_for_timeout(300)
    check(sparks(p) == before + 5, 'a breath counts once a day')
    words = p.locator('#triads-card .brk-tile').all_inner_texts()
    answer = p.evaluate('ws => M.reset.TRIADS.find(t => t[0].join("|") === ws.join("|"))[1]', words)
    p.fill('#triad-answer', 'nope'); p.click('#triad-check')
    p.wait_for_selector('#triads-card:has-text("Not that one")')
    p.fill('#triad-answer', answer); p.click('#triad-check')
    p.wait_for_selector('#triads-card:has-text("Yes.")')
    p.click('#uses-start')
    p.wait_for_selector('#uses-text')
    p.fill('#uses-text', 'hold paper\nlockpick\nzipper pull\nearring')
    p.wait_for_selector('#uses-card:has-text("4 so far")')
    p.locator('#brk-timer button:has-text("Stop")').first.click()
    p.wait_for_selector('#uses-card:has-text("4 uses")')
    p.wait_for_function('n => M.play.mine(M.lastCtx).sparks === n + 10', arg=before)
    # Care: the usual five, one due now, snooze, done, the day earns sparks
    h.go(p, 'founder', hash='#care', width=1280)
    p.wait_for_selector('#care-today')
    p.click('#care-usual')
    p.wait_for_selector('#care-setup input[aria-label="Reminder name"]')
    check(p.locator('#care-setup input[aria-label="Reminder name"]').count() == 6, 'the usual five (six rows, water twice)')
    # one that was due a minute ago
    now = p.evaluate('() => { const d = new Date(Date.now() - 60000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }')
    p.fill('#care-label', 'Stretch'); p.fill('#care-time', now); p.click('#care-add')
    p.wait_for_selector('.care-row.due:has-text("Stretch")', timeout=8000)
    stretch = p.evaluate('() => (document.querySelector(".care-row.due button[id^=care-snooze-]") || {}).id')
    check(bool(stretch), 'the due row offers a snooze')
    p.click('#' + stretch)
    p.wait_for_selector('.care-row.snoozed:has-text("Stretch")')
    check('until' in p.inner_text('.care-row.snoozed'), 'the snooze says until when')
    before = sparks(p)
    for i in range(7):
        btn = p.locator('#care-today button[id^=care-done-]').first
        if btn.count() == 0:
            break
        btn.click()
        p.wait_for_timeout(250)
    p.wait_for_function('() => document.querySelectorAll(".care-row.done").length === 7')
    p.wait_for_function('n => M.play.mine(M.lastCtx).sparks === n + 5', arg=before)
    check('7 of 7 done' in p.inner_text('#care-today'), 'the day is cared for: ' + p.inner_text('#care-today')[:60])
    care = p.evaluate('() => window.__db.get("data/users/u_founder/care")')
    check(len(care['items']) == 7 and all(care['log'][td][it['id']].get('done') for it in care['items']), 'the care doc holds the list and the log')
    # Reflect: the era, the read, a line to Vibe
    h.go(p, 'founder', hash='#reflect', width=1280)
    p.wait_for_selector('#reflect-era')
    era = p.evaluate('() => M.reflect.stats(M.lastCtx, "month").era.title')
    check(era.endswith(' era') and era in p.inner_text('#reflect-era'), 'the era title: %r' % era)
    check(p.locator('#reflect-era .brk-tile-stat').count() == 8, 'the eight numbers')
    p.click('#reflect-write')
    p.wait_for_selector('#reflect-text .ai-out', timeout=15000)
    p.wait_for_function('() => { const d = window.__db.get("data/users/u_founder/ai"); return d && d.reflect && d.reflect.month && d.reflect.month.text; }')
    p.click('#reflect-share')
    p.wait_for_function('() => { const f = window.__db.get("feed/u_founder"); return f && f.posts && f.posts[0] && f.posts[0].kind === "win" && /era:/.test(f.posts[0].text); }')
    # the feed: a finished task is a shipped card with reactions and comments
    h.go(p, 'founder', hash='#feed', width=1280)
    p.wait_for_selector('#feed-stream')
    p.get_by_role('tab', name='Shipped').click()
    p.wait_for_selector('#feed-stream .card.ship')
    n = p.locator('#feed-stream .card.ship').count()
    check(n >= 1 and 'shipped' in p.inner_text('#feed-stream .card.ship >> nth=0').lower(), 'shipped cards from the seeded done tasks: %d' % n)
    first = p.locator('#feed-stream .card.ship').first
    check(first.locator('.reacts .emoji-btn').count() == 7, 'seven reactions on a card: %d' % first.locator('.reacts .emoji-btn').count())
    first.locator('button[aria-label="React 🔥"]').click()
    check(p.locator('.rain i').count() >= 40 and p.locator('.rain b').count() >= 10, 'the fire rains across the screen: %d' % p.locator('.rain i').count())
    check(p.inner_text('.rain i >> nth=0') == '🔥', 'the rain is the emoji that was tapped')
    p.wait_for_function('() => { const r = window.__db.get("reacts/u_founder"); return r && r.r && Object.keys(r.r).some(k => k.startsWith("s:")); }')
    first.locator('button:has-text("Comment")').click()
    first.locator('input[aria-label="Comment"]').fill('Huge. Love this one.')
    first.locator('button:has-text("Post")').click()
    p.wait_for_selector('#feed-stream .card.ship >> nth=0 >> .comment:has-text("Huge. Love this one.")')
    check(p.locator('.rain i', has_text='💬').count() >= 10, 'a comment rains a little')
    p.wait_for_timeout(3800)
    check(p.locator('.rain').count() == 0, 'the rain clears itself')
    check(p.locator('#feed-stream .card.ship >> nth=0 >> button:has-text("1 comment")').count() == 1, 'the comment count')
    r = p.evaluate('() => window.__db.get("reacts/u_founder")')
    check(r.get('cm') and any(k.startswith('s:') for k in r['cm']), 'the comment lives in my reacts doc: %r' % list(r.keys()))
    # unreacting keeps the comment
    first.locator('button[aria-label="React 🔥"]').click()
    p.wait_for_function('() => { const r = window.__db.get("reacts/u_founder"); return r && !(Object.keys(r.r || {}).some(k => k.startsWith("s:"))); }')
    r = p.evaluate('() => window.__db.get("reacts/u_founder")')
    check(r.get('cm') and any(k.startswith('s:') for k in r['cm']), 'the comment survives an unreact')
    p.get_by_role('tab', name='Kudos').click()
    p.wait_for_selector('#feed-stream .card[data-kind="kudos"]')
    check(p.locator('#feed-stream .card[data-kind="kudos"] .reacts .emoji-btn').count() >= 7, 'kudos cards take reactions too')
    # a member has the section too, on the phone, without overflow
    h.go(p, 'm1', hash='#play', width=390)
    p.wait_for_selector('#daily-puzzle')
    p.wait_for_timeout(400)
    check(h.overflow(p) == 0, 'phone overflow on Play: %d' % h.overflow(p))
    check('Kaavish' in p.inner_text('#puzzle-board') or p.locator('#puzzle-board .brk-row').count() >= 1, 'a member sees the team\'s times')
    h.go(p, 'm1', hash='#map', width=1280)
    p.wait_for_selector('#map-break')
    check('puzzle' in p.inner_text('#map-break').lower(), 'the map lists Break')
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
