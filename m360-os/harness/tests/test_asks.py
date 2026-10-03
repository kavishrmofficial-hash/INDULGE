#!/usr/bin/env python3
"""v32 test: the founder's story end to end, through the dock, the grammar, one yes and the personal managers.

The roster: Shreya (u_sh) is a lead under Kaavish and Prarthana (u_pr) reports to her; Durvesh (u_m1) and
Aanya (u_m2) report to Kaavish. A working Tuesday next week, the clock pinned in Asia/Kolkata.

Part 1, 20:45, with the personal managers still off (they ship off):
- Durvesh (in 10:08, last save 17:40) and Prarthana (in 10:31, last save 18:55) have not checked out.
  Aanya is still in and saved at 20:35. Shreya checked out at 19:40.
- Kaavish says the sentence to the dock with the AI off. The grammar reads it, and the pop-up shows the
  tap card: "Ask 2 people why they haven't checked out", Durvesh and Prarthana ticked, Aanya unticked.
- One spoken yes sends it. The record holds codes, one DM line per person, the receipt folds.
- Durvesh's Home has the card row from Kaavish, his inbox the item, his page the bubble, his DM the line.
- Durvesh answers "Still working, done by..." in an hour. The answer comes back: Kaavish's receipt row
  and a bubble on Kaavish's page.
- Shreya, Prarthana's manager, is not pinged; Your team shows "Kaavish asked Prarthana at 20:45".

Part 2, the morning, with the founder switching the bots on in Admin:
- Kaavish presses the Admin switch; settings/app.pm.on is true.
- 11:20: Prarthana has an overdue task. Shreya's bot tells Prarthana first (her card and one bubble);
  Shreya hears nothing yet. The chip on Shreya's Your team reads the nudge.
- 11:45: Prarthana's quiet stretch (nothing since 10:40, a 60 minute threshold) is on her card too.
- 12:16: the hour is up on the overdue task; Shreya's bot tells Shreya, once.
- Shreya cannot switch her bot off: the Me switch is held, the engine and the agent refuse.

Screenshots go to $ASKS_SHOTS (default harness/shots/asks).

Run: cd m360-os && python3 harness/tests/test_asks.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, SH, PR, DU, AA = 'u_founder', 'u_sh', 'u_pr', 'u_m1', 'u_m2'
SHOTS = os.environ.get('ASKS_SHOTS') or os.path.join(ROOT, 'harness', 'shots', 'asks')
SENTENCE = "flag the people who haven't checked out from office and ask them why"
SPY = '''() => { window.__pmBubbles = window.__pmBubbles || []; if (M.notices.__spy) return; M.notices.__spy = true;
  const push = M.notices.push; M.notices.push = n => { if (String(n.key || "").startsWith("pm:")) window.__pmBubbles.push(n); return push(n); }; }'''


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    os.makedirs(SHOTS, exist_ok=True)
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()

    def at(hh, mm):
        return datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST)

    def ms(hh, mm):
        return int(at(hh, mm).timestamp() * 1000)

    def shot(p, name):
        p.screenshot(path=os.path.join(SHOTS, name + '.png'))

    def new_ctx(fixed, **opts):
        o = {'viewport': {'width': 1280, 'height': 860}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata'}
        o.update(opts)
        c = h.browser.new_context(**o)
        h.contexts.append(c)
        c.clock.set_fixed_time(fixed)
        return c

    def open_page(c, ident, hash, **params):
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        p.goto(h.url(ident, hash, **params))
        h.ready(p)
        return p

    def be(p, ident, hash='#home', **params):
        # a fresh document each time, so the store and the pinned clock are read afresh
        p.goto('about:blank')
        p.goto(h.url(ident, hash, **params))
        h.ready(p)
        p.wait_for_function('() => window.M && M.pm && M.lastCtx && M.pm.loaded(M.lastCtx)')
        p.evaluate('() => { M.pm.PASS = 800; }')
        p.evaluate(SPY)
        p.wait_for_timeout(500)

    def world(c, pm_on=False, quiet_mins=None):
        p = open_page(c, 'founder', '#home', reset=True, seed=True)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        p.wait_for_timeout(300)
        h.roster(p, [SH, PR, DU, AA], extra={SH: {'pod': '', 'title': 'Design Lead'}, PR: {'pod': '', 'reportsTo': SH, 'title': 'Designer'},
                                              DU: {'pod': ''}, AA: {'pod': ''}})
        app = p.evaluate('() => window.__db.get("settings/app")') or {}
        app.pop('pm', None)
        app['holidays'] = []
        if pm_on:
            app['pm'] = {'on': True}
        if quiet_mins:
            app['quietMins'] = quiet_mins
        h.seed_doc(p, 'settings/app', app)
        for u in (F, SH, PR, DU, AA):
            h.seed_doc(p, 'checkin/' + u, {'days': {}})
            h.seed_doc(p, 'eod/' + u, {'days': {}})
            p.evaluate('p => window.__db.del(p)', 'leave/' + u)
            h.seed_doc(p, 'me/' + u, {})
        return p

    # ======================= part 1: 20:45, the sentence, one yes =======================
    c1 = new_ctx(at(20, 45))
    p = world(c1)
    h.seed_doc(p, 'checkin/' + F, {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + DU, {'days': {today: {'in': ms(10, 8), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + PR, {'days': {today: {'in': ms(10, 31), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + AA, {'days': {today: {'in': ms(11, 2), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + SH, {'days': {today: {'in': ms(10, 20), 'out': ms(19, 40), 'mode': 'office'}}})
    h.seed_doc(p, 'me/' + DU, {'act': {today: {'1100': 1, '1740': 1}}})
    h.seed_doc(p, 'me/' + PR, {'act': {today: {'1200': 1, '1855': 1}}})
    h.seed_doc(p, 'me/' + AA, {'act': {today: {'1500': 1, '2035': 1}}})

    be(p, 'founder', '#home', noai=1)
    check(p.evaluate('() => M.pm.P(M.lastCtx).on') is False, 'the personal managers are off (they ship off); asks work regardless')
    p.wait_for_selector('#buddy-dock .buddy-home')
    shot(p, '01-founder-home-dock')
    p.locator('#buddy-dock .buddy-home').click()
    p.wait_for_selector('.buddy-bubble #buddy-input')
    p.fill('#buddy-input', SENTENCE)
    shot(p, '02-founder-the-sentence')
    p.fill('#buddy-input', '')
    # said out loud: what the recogniser heard goes in as a voice turn
    p.evaluate('t => { M.assistant.send(M.lastCtx, t, {via: "voice", dock: true}); }', SENTENCE)
    p.wait_for_selector('.buddy-bubble .pending-act.ask-preview', timeout=20000)
    p.wait_for_timeout(600)
    card = p.inner_text('.pending-act.ask-preview')
    shot(p, '03-founder-preview-card')
    check("Ask 2 people why they haven't checked out" in card, 'the tap card title: %r' % card[:200])
    ticks = p.evaluate('() => [...document.querySelectorAll(".ask-person input[data-uid]")].map(i => [i.dataset.uid, i.checked])')
    check(sorted(ticks) == sorted([[DU, True], [PR, True], [AA, False]]), 'Durvesh and Prarthana ticked, Aanya (saved 20:35) unticked: %r' % ticks)
    check(p.locator('#ask-send').count() == 1 and 'Send to 2' in p.inner_text('#ask-send'), 'Send to 2')
    check(p.evaluate('() => Object.keys(((window.__db.get("me/u_founder") || {}).pm || {}).asks || {}).length') == 0, 'nothing goes before the yes')

    # one spoken yes: the microphone opened after the agent stopped speaking, inside 15 seconds
    said = p.evaluate('() => M.assistant.send(M.lastCtx, "yes", {via: "voice", micAt: Date.now(), dock: true}).then(r => r && r.text)')
    p.wait_for_function('() => Object.keys(((window.__db.get("me/u_founder") || {}).pm || {}).asks || {}).length === 1')
    p.wait_for_timeout(800)
    check(said and 'Sent' in said, 'the spoken yes sends it and says so: %r' % said)
    ask = p.evaluate('() => Object.entries(window.__db.get("me/u_founder").pm.asks).map(([id, a]) => ({id, ...a}))[0]')
    aid = ask['id']
    check(ask['kind'] == 'noout' and sorted(ask['to']) == sorted([DU, PR]) and ask['ask'] == 'why' and ask['via'] == 'voice', 'the ask record: %r' % ask)
    check(not any(isinstance(v, str) and len(v) > 40 for v in ask.values()), 'the record holds codes only: %r' % ask)
    for u in (DU, PR):
        room = 'chat/dm.' + '.'.join(sorted([F, u])) + ':' + F
        ids = p.evaluate('r => ((window.__db.get(r) || {}).msgs || []).map(m => m.id)', room)
        check(ids.count('ask.%s.%s' % (aid, u)) == 1, 'one DM line to %s: %r' % (u, ids))
    shot(p, '04-founder-sent-receipt')
    rec = p.inner_text('.buddy-bubble')
    check('Asked 2 people' in rec, 'the receipt folds to "Asked 2 people": %r' % rec[-300:])

    # ---- Durvesh: the card, the inbox, the bubble, the DM ----
    be(p, 'm1', '#home')
    k = DU + ':noout:-:' + today
    p.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % k)
    row = p.inner_text('#pm-card .pm-row[data-k="%s"]' % k)
    check('Kaavish asked' in row and 'by voice' in row, 'the row says who asked, by voice: %r' % row)
    check('still checked in from 10:08' in row and '17:40' in row, 'the ask line carries his facts: %r' % row)
    p.wait_for_function('() => window.__pmBubbles.length >= 1', timeout=25000)
    bub = p.evaluate('() => window.__pmBubbles[0]')
    check(bub['title'].startswith('Kaavish') and 'checked in' in bub['body'], 'the bubble: %r' % bub)
    p.wait_for_selector('.notice[data-key^="pm:"]')
    shot(p, '05-durvesh-card-and-bubble')
    inbox = p.evaluate('() => M.inbox.items(M.lastCtx).filter(i => String(i.id).startsWith("pm:")).map(i => i.id)')
    check(any(aid in i for i in inbox), 'the inbox item: %r' % inbox)
    told = p.evaluate('() => ((window.__db.get("me/u_m1") || {}).pm || {}).told || {}')
    check(any(v > 0 for v in told.values()), 'told is marked: %r' % told)

    # he answers: still working, done in an hour
    p.locator('#pm-card .pm-row[data-k="%s"] button[data-how="onit"]' % k).first.click()
    p.locator('#pm-card [data-eta="1h"]').click()
    p.wait_for_function('() => ((((window.__db.get("me/u_m1") || {}).pm || {}).ack || {})[%r] || {}).how === "onit"' % k)
    p.wait_for_selector('#pm-card .pm-said')
    check('Kaavish can see this' in p.inner_text('#pm-card .pm-said'), 'the row reads back the answer')
    shot(p, '06-durvesh-answered')
    be(p, 'm1', '#chat/' + 'dm.' + '.'.join(sorted([F, DU])))
    p.wait_for_timeout(800)
    check('checked in' in p.inner_text('.main'), 'the DM shows the ask line from Kaavish')
    shot(p, '07-durvesh-dm')

    # ---- Prarthana's manager sees it, unpinged ----
    be(p, 'sh', '#home')
    p.wait_for_selector('#team-u_pr')
    t = p.inner_text('#team-u_pr')
    check('Kaavish asked Prarthana at 20:45' in t, "Shreya sees Kaavish's ask on Prarthana as a line: %r" % t)
    check(p.evaluate('() => window.__pmBubbles.length') == 0 and p.evaluate('() => M.pm.forMe(M.lastCtx).length') == 0, 'and is not pinged')
    p.locator('#team-u_pr').scroll_into_view_if_needed()
    shot(p, '08-shreya-your-team-line')

    # ---- the answer comes back to Kaavish ----
    be(p, 'founder', '#home', noai=1)
    st = p.evaluate('a => (M.pm.sent(M.lastCtx) || []).find(s => s.askId === a || s.id === a)', aid)
    check(st is not None, 'the sent list holds the ask')
    du = [r for r in st['rows'] if r['uid'] == DU]
    check(du and du[0].get('how') == 'onit', "Durvesh's answer is on the receipt: %r" % st['rows'])
    p.wait_for_function('() => window.__pmBubbles.length >= 1', timeout=25000)
    bub = p.evaluate('() => window.__pmBubbles[0]')
    check('Durvesh' in bub['body'], 'Kaavish gets a bubble with the answer: %r' % bub)
    p.wait_for_selector('.notice[data-key^="pm:"]')
    shot(p, '09-founder-answer-bubble')
    p.locator('#buddy-dock .buddy-home').click()
    p.wait_for_selector('.buddy-bubble .agent-receipt-toggle, .buddy-bubble .pm-receipt')
    tg = p.locator('.buddy-bubble .pm-receipt .agent-receipt-toggle')
    if tg.count():
        tg.last.click()
        p.wait_for_timeout(400)
    shot(p, '10-founder-receipt-rows')
    c1.close()

    # ======================= part 2: the bots on, Shreya's bot and Prarthana =======================
    c2 = new_ctx(at(9, 50))
    p = world(c2, quiet_mins=60)
    h.seed_doc(p, 'checkin/' + PR, {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + SH, {'days': {today: {'in': ms(10, 20), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + DU, {'days': {today: {'in': ms(10, 25), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + AA, {'days': {today: {'in': ms(10, 28), 'out': None, 'mode': 'office'}}})
    yday = (tue - timedelta(days=1)).isoformat()
    h.seed_doc(p, 'tasks/t1', {'title': 'Tanishq carousel', 'owner': PR, 'by': SH, 'status': 'doing', 'due': yday,
                               'created': ms(10, 0) - 5 * 86400000, 'updated': ms(10, 0) - 2 * 86400000})
    # yesterday's EOD lines are in, so the morning sweep has nothing to carry
    for u in (SH, PR, DU, AA, F):
        h.seed_doc(p, 'eod/' + u, {'days': {yday: {'shipped': 'x', 'next': 'y', 'blocked': '', 'at': ms(19, 0) - 86400000}}})

    # the founder switches them on in Admin
    be(p, 'founder', '#admin')
    p.wait_for_selector('#pm-admin')
    if p.locator('#pm-on').count() == 0:
        p.locator('#pm-admin').first.click()
        p.wait_for_timeout(300)
    p.locator('#pm-on').scroll_into_view_if_needed()
    shot(p, '11-admin-off')
    p.locator('#pm-on').click()
    p.wait_for_function('() => ((window.__db.get("settings/app") || {}).pm || {}).on === true')
    p.wait_for_timeout(500)
    shot(p, '12-admin-on')
    check(True, 'the founder switched the personal managers on in Admin')

    # 11:20, Prarthana hears first
    c2.clock.set_fixed_time(at(11, 20))
    h.seed_doc(p, 'me/' + PR, {'act': {today: {'1035': 1, '1040': 1}}})
    # Shreya, Durvesh and Aanya are busy on m360 all morning
    busy = {today: {'%02d%02d' % (hh, mm): 1 for hh in (10, 11, 12) for mm in range(0, 60, 5) if (hh, mm) >= (10, 25)}}
    for u in (SH, DU, AA):
        h.seed_doc(p, 'me/' + u, {'act': busy})
    be(p, 'pr', '#home')
    ko = PR + ':overdue:t1:' + today
    p.wait_for_selector('#pm-card .pm-row[data-k="%s"]' % ko)
    card = p.inner_text('#pm-card')
    check("From Shreya's bot" in card and 'Tanishq carousel' in card, 'the card from Shreya\'s bot: %r' % card[:240])
    check('If there is no answer by 12:15, Shreya hears about it.' in card, 'the window first: %r' % card)
    p.wait_for_function('() => window.__pmBubbles.length >= 1', timeout=25000)
    bub = p.evaluate('() => window.__pmBubbles[0]')
    check(bub['title'] == "Shreya's bot" and 'Tanishq carousel' in bub['body'], 'one bubble from Shreya\'s bot: %r' % bub)
    p.wait_for_selector('.notice[data-key^="pm:"]')
    shot(p, '13-prarthana-overdue-card-bubble')

    be(p, 'sh', '#home')
    early = p.evaluate('() => M.pm.forMe(M.lastCtx).filter(x => x.step === "2").map(x => x.stepId)')
    check(not early, 'Shreya hears nothing inside the window: %r' % early)
    p.wait_for_selector('#team-u_pr .pm-chip[data-k="%s"]' % ko)
    chip = p.inner_text('#team-u_pr .pm-chip[data-k="%s"]' % ko)
    check(chip.startswith(('nudged', 'seen')), "Shreya's chip reads the nudge: %r" % chip)
    p.locator('#team-u_pr').scroll_into_view_if_needed()
    shot(p, '14-shreya-chip-nudged')

    # 11:45, the quiet stretch since 10:40
    c2.clock.set_fixed_time(at(11, 45))
    be(p, 'pr', '#home')
    kinds = p.evaluate('() => M.pm.cardItems(M.lastCtx, Date.now()).map(i => i.kind)')
    check('quiet' in kinds and 'overdue' in kinds, 'the quiet stretch joins the card: %r' % kinds)
    p.wait_for_selector('#pm-card .pm-row[data-kind="quiet"]')
    shot(p, '15-prarthana-quiet')
    q = p.inner_text('#pm-card .pm-row[data-kind="quiet"]')
    check('since 10:40' in q or 'since 10:45' in q, 'the quiet line names when it went quiet: %r' % q)

    # 12:16, the hour is up: Shreya hears, once
    c2.clock.set_fixed_time(at(12, 16))
    be(p, 'sh', '#home')
    due = p.evaluate('() => M.pm.forMe(M.lastCtx).map(x => [x.stepId, x.ring])')
    check([ko + '#2', True] in due, "Shreya's bot tells Shreya at 12:15: %r" % due)
    p.wait_for_function('() => window.__pmBubbles.length >= 1', timeout=25000)
    p.wait_for_timeout(2500)
    bb = p.evaluate('() => window.__pmBubbles')
    check(len(bb) == 1 and bb[0]['title'] == 'Your bot' and 'Prarthana' in bb[0]['body'], 'one escalation bubble: %r' % bb)
    p.wait_for_selector('.notice[data-key^="pm:"]')
    shot(p, '16-shreya-escalation')

    # Shreya cannot switch her bot off
    be(p, 'sh', '#me')
    p.wait_for_selector('#pm-me #pm-bot-on')
    held = p.locator('#pm-bot-on').first.evaluate('e => !!(e.disabled || e.getAttribute("aria-disabled") === "true" || e.querySelector("button:disabled, [aria-disabled=true], input:disabled"))')
    check(held, 'the Me switch is held on')
    p.locator('#pm-me').scroll_into_view_if_needed()
    shot(p, '17-shreya-me-held')
    err = p.evaluate('() => M.pm.setCfg(M.lastCtx, {on: false}).then(() => "ran", e => e.message)')
    check('Kaavish' in err, 'the engine refuses: %r' % err)
    err = p.evaluate('() => M.agent.ACTIONS.find(a => a.name === "pm_settings").run(M.lastCtx, null, {on: false}, {}).then(() => "ran", e => e.message)')
    check('Kaavish' in err, 'the agent refuses: %r' % err)
    ok = p.evaluate('() => M.pm.setCfg(M.lastCtx, {pause: {u_pr: M.U.todayStr()}}).then(() => "ran", e => e.message)')
    check(ok == 'ran', 'pausing one person for today stays allowed: %r' % ok)
    c2.close()

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'no console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print(len(out), 'checks')
    print('PASS')
