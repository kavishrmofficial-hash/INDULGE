#!/usr/bin/env python3
"""Break, the reset room rebuilt on the evidence, and the feed's celebrations. Five, the word of the day,
solves in two tries and lands sparks, a workday streak and a squares-only card on the feed; Doubles
plays to its timer; the reaction check records a read in the private space; every reset (the breathing
protocols, the if-then shown on Home, both walks, park it, the two-gear sprint, eyes off, the nap)
earns sparks once; the scoreboard hides; squads and the streak repair are pure; care reminders ring,
snooze and tick; Reflect writes and shares; a reaction rains the emoji across the screen and kudos
cards take reactions; a member has the section on the phone without overflow.

Run: cd m360-os && python3 harness/tests/test_break.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def sparks(p):
    return p.evaluate('() => M.play.mine(M.lastCtx).week')


def wait_sparks(p, n):
    p.wait_for_function('n => M.play.mine(M.lastCtx).week === n', arg=n, timeout=15000)


def part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#break', width=1280)
    p.wait_for_selector('#five')
    check(p.locator('.section-tabs .tab').count() == 4 and sparks(p) == 0, 'the four tabs and zero sparks to start')
    td = p.evaluate('() => M.U.todayStr()')
    # Five: a wrong word, then the word
    word = p.evaluate('() => M.play.five.wordFor(M.U.todayStr())')
    wrong = p.evaluate('w => M.play.five.WORDS.find(x => x !== w)', word)
    p.keyboard.type('abc')
    p.keyboard.press('Enter')
    check(p.locator('.five-cell.typed').count() == 3, 'three letters typed, a short guess does not submit')
    for _ in range(3):
        p.keyboard.press('Backspace')
    p.keyboard.type(wrong)
    p.keyboard.press('Enter')
    p.wait_for_function('() => document.querySelectorAll(".five-cell.ok, .five-cell.near, .five-cell.out").length === 5')
    check(p.locator('.drawer').count() == 0, 'typing a word does not fire the single-key shortcuts')
    p.keyboard.type(word)
    p.keyboard.press('Enter')
    p.wait_for_selector('#five-done', timeout=10000)
    wait_sparks(p, 15)
    me = p.evaluate('() => M.play.mine(M.lastCtx)')
    doc = p.evaluate('() => M.play.docOf(M.lastCtx)')
    five = doc['days'][td]['five']
    check(five['tries'] == 2 and five['rows'][1] == '22222' and five['ms'] >= 0, 'the solve is on the record: %r' % five)
    check(me['streak'] == 1 and me['level']['name'] == 'Spark', 'the streak and the level after Five: %r' % me)
    check(p.locator('#sparks:has-text("1 workday streak")').count() == 1, 'the hero shows the streak')
    check(p.locator('#five-share .five-mrow').count() == 2 and 'played' in p.inner_text('#five'), 'the result card, squares only')
    check(p.locator('#five-team .avatar, #five-team img, #five-team .av').count() >= 1 or p.locator('#five-team .five-track i[style*="100%"]').count() == 1, 'the team spread shows the solve')
    same = p.evaluate('() => M.play.five.wordFor(M.U.todayStr()) === M.play.five.wordFor(M.U.todayStr()) && M.play.five.score("crane", "crane") === "22222" && M.play.five.score("eerie", "ember") === "21100"')
    check(same, 'the word is seeded by the day and scoring handles doubles')
    # Doubles: a short game to the timer
    p.evaluate('() => { M.games.GAME.seconds = 3; }')
    p.click('#doubles-start')
    for _ in range(6):
        p.keyboard.press('ArrowLeft')
        p.keyboard.press('ArrowDown')
    p.wait_for_selector('#doubles:has-text("Back to it")', timeout=10000)
    wait_sparks(p, 20)
    doc = p.evaluate('() => M.play.docOf(M.lastCtx)')
    check(doc.get('game', {}).get('games') == 1, 'the game is on the record: %r' % doc.get('game'))
    check(p.evaluate('() => M.games.slideRow([2, 2, 4, 0]).row.join(",") === "4,4,0,0" && M.games.slideRow([2, 2, 2, 2]).pts === 8'), 'slide and merge are pure')
    # the reaction check, quick
    p.evaluate('() => { M.games.RT.seconds = 4; M.games.RT.minGap = 200; M.games.RT.maxGap = 500; }')
    p.click('#rt-start')
    for _ in range(12):
        try:
            p.wait_for_selector('#rt-pad.lit', timeout=2500)
            p.click('#rt-pad')
        except Exception:
            break
    p.wait_for_selector('#rt-result', timeout=10000)
    wait_sparks(p, 25)
    priv = p.evaluate('() => window.__db.get("data/users/u_founder/break")')
    check(priv and priv.get('rt', {}).get(td, {}).get('n', 0) >= 1, 'the read is in the private space: %r' % (priv or {}).get('rt'))
    # the scoreboard hides and comes back
    p.click('#sparks-hide')
    p.wait_for_selector('#sparks-show')
    p.click('#sparks-show')
    p.wait_for_selector('#sparks-hide')
    # squads and the streak repair are pure
    sq = p.evaluate('() => M.play.squads({activeMembers: ["a", "b", "c", "d", "e", "f", "g", "h"].map(uid => ({uid}))}, "2026-10")')
    check(len(sq) == 2 and sorted(len(s['ids']) for s in sq) == [4, 4] and sq[0]['name'] != sq[1]['name'], 'eight people make two squads of four: %r' % sq)
    rep = p.evaluate('''() => { const td = M.U.todayStr(); const back = M.play.workdayBack(td, 2);
      return [M.play.nextStreak({lastDay: back, streak: 3, repairs: {}}, td), M.play.nextStreak({lastDay: back, streak: 3, repairs: {[M.play.weekOf(td)]: "x"}}, td), M.play.nextStreak({lastDay: M.play.workdayBack(td, 1), streak: 3}, td)]; }''')
    check(rep[0]['streak'] == 5 and rep[0].get('repaired') and rep[1]['streak'] == 1 and rep[2]['streak'] == 4, 'one missed workday a week is covered: %r' % rep)
    # Reset: the breathing protocols
    h.go(p, 'founder', hash='#reset', width=1280)
    p.wait_for_selector('#break-reset')
    p.evaluate('() => { M.reset.quick = true; }')
    p.click('#breathe-slow')
    p.wait_for_selector('#breathe[data-kind="slow"]')
    check(re.search(r'(5:00|4:5\d)', p.inner_text('#breathe .micro')) is not None, 'the slow protocol is five minutes: %r' % p.inner_text('#breathe .micro'))
    p.keyboard.press('Escape')
    p.wait_for_timeout(200)
    check(sparks(p) == 25, 'skipping a breath earns nothing')
    p.evaluate('() => M.breathe.open("slow", {seconds: 2, onDone: () => M.reset.earn(M.lastCtx, "slow breathing", 10)})')
    p.wait_for_selector('#breathe:has-text("Nice")', timeout=8000)
    wait_sparks(p, 35)
    p.keyboard.press('Escape')
    p.evaluate('() => M.breathe.open("slow", {seconds: 2, onDone: () => M.reset.earn(M.lastCtx, "slow breathing", 10)})')
    p.wait_for_selector('#breathe:has-text("Nice")', timeout=8000)
    p.keyboard.press('Escape')
    p.wait_for_timeout(300)
    check(sparks(p) == 35, 'a breath counts once a day')
    p.click('#breathe-box')
    p.wait_for_selector('#breathe[data-kind="box"]')
    p.keyboard.press('Escape')
    # one if-then, shown on Home
    p.fill('#ifthen-when', '11:00')
    p.fill('#ifthen-where', 'at my desk')
    p.fill('#ifthen-will', 'write the first slide title')
    p.click('#ifthen-save')
    p.wait_for_selector('#ifthen-plan:has-text("write the first slide title")')
    wait_sparks(p, 40)
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#plan-today:has-text("11:00")')
    # a walk for energy, then a walk with a problem
    h.go(p, 'founder', hash='#reset', width=1280)
    p.wait_for_selector('#break-reset')
    p.evaluate('() => { M.reset.quick = true; }')
    p.click('#walk-start')
    p.wait_for_selector('#walk-rate', timeout=8000)
    p.click('#walk-energy-4')
    wait_sparks(p, 45)
    p.get_by_role('radio', name='With a problem').click() if p.get_by_role('radio', name='With a problem').count() else p.locator('#walk button:has-text("With a problem")').click()
    p.click('#walk-dump-start')
    p.wait_for_selector('#walk-text', timeout=8000)
    p.fill('#walk-text', 'a billboard that melts\na sunscreen for the moon')
    p.click('#walk-keep')
    wait_sparks(p, 55)
    # park it
    p.click('#park-start')
    p.wait_for_selector('#shades', timeout=8000)
    p.locator('.shade-tile').nth(0).click()
    p.locator('.shade-tile').nth(1).click()
    p.wait_for_selector('#park-text', timeout=8000)
    p.fill('#park-text', 'open on a Tuesday\nno logo at all')
    p.click('#park-keep')
    wait_sparks(p, 65)
    # the two-gear sprint
    p.click('#sprint-start')
    p.wait_for_selector('#sprint-one-text')
    p.fill('#sprint-one-text', 'a poster\na reel\na flyer')
    p.wait_for_selector('#sprint-two-text', timeout=8000)
    p.fill('#sprint-two-text', 'the dentist narrates a horror film')
    p.click('#sprint-keep')
    wait_sparks(p, 75)
    # eyes off, the nap
    p.click('#eyes-start')
    wait_sparks(p, 80)
    p.click('#nap-start')
    wait_sparks(p, 85)
    p.wait_for_selector('#catches')
    check(p.locator('#catches .brk-row').count() == 3, 'three catches kept')
    priv = p.evaluate('() => window.__db.get("data/users/u_founder/break")')
    check(priv['energy'][td] == [4] and len(priv['catches']) == 3 and priv['plan']['will'] == 'write the first slide title', 'the private break doc: %r' % list(priv.keys()))
    check(len(p.evaluate('() => M.play.mine(M.lastCtx).today')) >= 11, 'eleven things counted today')
    # Care: the usual five, one due now, snooze, done, the day earns sparks
    h.go(p, 'founder', hash='#care', width=1280)
    p.wait_for_selector('#care-today')
    p.click('#care-usual')
    p.wait_for_selector('#care-setup input[aria-label="Reminder name"]')
    check(p.locator('#care-setup input[aria-label="Reminder name"]').count() == 6, 'the usual five (six rows, water twice)')
    now = p.evaluate('() => { const d = new Date(Date.now() - 60000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }')
    p.fill('#care-label', 'Stretch'); p.fill('#care-time', now); p.click('#care-add')
    p.wait_for_selector('.care-row.due:has-text("Stretch")', timeout=8000)
    snooze = p.locator('.care-row.due:has-text("Stretch") button[id^=care-snooze-]')
    check(snooze.count() == 1, 'the due row offers a snooze')
    snooze.click()
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
    wait_sparks(p, before + 5)
    check('7 of 7 done' in p.inner_text('#care-today'), 'the day is cared for: ' + p.inner_text('#care-today')[:60])
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
    # the feed: the Five card, a shipped card with the rain, reactions and comments
    h.go(p, 'founder', hash='#feed', width=1280)
    p.wait_for_selector('#feed-stream')
    p.wait_for_selector('#feed-stream .card[data-kind="five"]')
    fc = p.locator('#feed-stream .card[data-kind="five"]').first
    check('Five in 2' in fc.inner_text() and fc.locator('.five-mrow').count() == 2 and fc.locator('.reacts .emoji-btn').count() == 7, 'the Five card on the feed: %r' % fc.inner_text()[:80])
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
    first.locator('button[aria-label="React 🔥"]').click()
    p.wait_for_function('() => { const r = window.__db.get("reacts/u_founder"); return r && !(Object.keys(r.r || {}).some(k => k.startsWith("s:"))); }')
    r = p.evaluate('() => window.__db.get("reacts/u_founder")')
    check(r.get('cm') and any(k.startswith('s:') for k in r['cm']), 'the comment survives an unreact')
    p.get_by_role('tab', name='Kudos').click()
    p.wait_for_selector('#feed-stream .card[data-kind="kudos"]')
    check(p.locator('#feed-stream .card[data-kind="kudos"] .reacts .emoji-btn').count() >= 7, 'kudos cards take reactions too')
    # a member has the section too, on the phone, without overflow
    h.go(p, 'm1', hash='#play', width=390)
    p.wait_for_selector('#five')
    p.wait_for_timeout(400)
    check(h.overflow(p) == 0, 'phone overflow on Daily: %d' % h.overflow(p))
    check('1 of' in p.inner_text('#five'), 'a member sees the team spread')
    h.go(p, 'm1', hash='#reset', width=390)
    p.wait_for_selector('#break-reset')
    p.wait_for_timeout(300)
    check(h.overflow(p) == 0, 'phone overflow on Reset: %d' % h.overflow(p))
    h.go(p, 'm1', hash='#map', width=1280)
    p.wait_for_selector('#map-break')
    check('five' in p.inner_text('#map-break').lower(), 'the map lists Break')
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
