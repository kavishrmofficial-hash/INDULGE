#!/usr/bin/env python3
"""v34 test: the follow-up ring (M.parts.FollowWatch in src/js/25-prospects.js) on the claude.ai mock.

Sat 17 Oct 2026, the day "talk after the 16th" lands on, with a frozen clock moved through the day. Checks:
- at 10:00 one black card rings for Meera across two tabs of one device ("Follow up with Meera", "Swisse. You
  said after the 16th."), once: the second tab and a reload stay quiet, the index carries fu.rang with the key,
  the localStorage mark holds it, one soft sound; a follow-up another device already rang (rang synced) is skipped;
- a focus timer holds the ring, and the card comes when focus ends;
- a snooze to 11:00 arms a new key and rings again at 11:00;
- a default-time follow-up never rings outside 09:00 to 21:00 IST; a time the person said (22:00) rings as given;
- a hidden tab sends the generic away text to the system notice ("A follow-up is due", "Open m360 to see who")
  while the page card still names the person, and rings only after seeing the key on two passes;
- the dock badge never moves for a follow-up; the inbox carries kind follow as a silent item, hot once late;
- the catch-up card (founder decision D3): the first open on a later day lists what was missed while m360 was
  closed, once a day per device, and the missed ones then sit as late on Home.
window.__sampleCalls stays empty.

Fails until builders 1 and 2 are merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_ring.py
"""
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F = 'u_founder'
SAT = '2026-10-17'
IX = 'data/users/u_founder/prospects'
# a hidden tab, whose page clock the test moves by hand: the fixed clock freezes performance.now, and the
# hidden rule needs a whole pass between two sightings of a key
HIDDEN = ('Object.defineProperty(document, "visibilityState", {configurable: true, get: () => "hidden"});'
          'Object.defineProperty(document, "hidden", {configurable: true, get: () => true});'
          'window.__pnow = 1000; Object.defineProperty(performance, "now", {configurable: true, writable: true, value: () => window.__pnow});')
NOTIFY = ('window.__notes = []; window.Notification = class { constructor(t, o) { window.__notes.push({title: t, body: o && o.body, tag: o && o.tag}); } '
          'static get permission() { return "granted"; } static requestPermission() { return Promise.resolve("granted"); } close() {} };')
# the follow-up and meeting cards the page pushes (the team's own flags ride the same stack and are left out),
# and every sound it plays
WRAP = '''() => { if (window.__pushed) return; window.__pushed = []; window.__sounds = [];
  const p0 = M.notices.push.bind(M.notices); M.notices.push = n => { if (/^(fu|mt):/.test(String(n && n.key || ''))) window.__pushed.push({key: n.key, title: n.title, body: n.body, href: n.href, away: n.away || null, life: n.life}); return p0(n); };
  const s0 = M.sound.play; M.sound.play = k => { window.__sounds.push(k); }; }'''


def at(hh, mm, ss=0, day=17):
    return datetime(2026, 10, day, hh, mm, ss, tzinfo=IST)


def ms(hh, mm, day=17):
    return int(at(hh, mm, 0, day).timestamp() * 1000)


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(at(9, 58))

    def page(init=''):
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        if init:
            p.add_init_script(init)
        return p

    def ready(p, hash='#home'):
        url = h.url('founder', hash, noai=True)
        if p.url == url:
            p.reload()
        else:
            p.goto(url)
        # the wrap goes on before the app boots, so a card rung on the watcher's first pass is caught too
        p.wait_for_function('() => !!(window.M && M.notices && M.sound && M.prospects && M.prospects.ring)')
        p.evaluate(WRAP)
        h.ready(p)
        p.wait_for_function('() => !!(M.lastCtx && M.lastCtx.priv && M.lastCtx.priv.prospects.ready)')
        p.wait_for_timeout(200)

    def ring(p):
        p.evaluate('() => M.prospects.ring()')
        p.wait_for_timeout(500)

    pushed = lambda p: p.evaluate('() => window.__pushed')  # noqa: E731
    doc = lambda p, path: p.evaluate('k => window.__db.get(k)', path)  # noqa: E731
    now = ms(9, 58)
    person = lambda who, org, pi: {'cid': '', 'oid': '', 'who': who, 'org': org, 'role': '', 'pi': [pi] if pi else [], 'st': '', 'last': {'at': now - 86400000, 'k': 'talk'}, 'mo': ['2026-10'], 'at': now - 86400000, 'up': now - 86400000}  # noqa: E731
    fu = lambda p, pi, t, x, said='', **k: {'p': p, 'pi': pi, 'x': x, 'd': SAT, 't': t, 'after': '', 'said': said, 'src': 'typed', 'at': now - 86400000, **k}  # noqa: E731

    a = page()
    a.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(a)
    a.wait_for_function('() => !!window.__db.get("roster/team")')
    if not a.evaluate('() => !!(M.prospects && M.prospects.ring && M.when)'):
        raise AssertionError('M.prospects is not on the page: this test runs once builder 1 (25-prospects.js) is merged')
    h.roster(a, ['u_m1', 'u_m2'])
    base = {'category': '', 'contact': '', 'source': '', 'updated': now, 'stageAt': now - 5 * 86400000, 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': now - 5 * 86400000}
    h.seed_doc(a, 'pitches/pt_swisse', {**base, 'brand': 'Swisse', 'owner': F, 'stage': 'proposal'})
    h.seed_doc(a, 'pitches/pt_tata', {**base, 'brand': 'Tata', 'owner': F, 'stage': 'qualified'})
    h.seed_doc(a, 'pitches/pt_nykaa', {**base, 'brand': 'Nykaa', 'owner': F, 'stage': 'lead'})
    h.seed_doc(a, IX, {'v': 1, 'prefs': {'mirror': True}, 'meet': {},
                       'people': {'pp1': person('Meera', 'Swisse', 'pt_swisse'), 'pp2': person('Rahul', 'Tata', 'pt_tata'), 'pp3': person('Priya', 'Nykaa', 'pt_nykaa'), 'pp4': person('Kavya', 'Lakme', ''), 'pp5': person('Anil', 'Titan', ''), 'pp6': person('Riya', 'Bira', '')},
                       'fu': {'fu1': fu('pp1', 'pt_swisse', '', 'talk after the 16th', 'after the 16th'),
                              'fu2': fu('pp2', 'pt_tata', '10:30', 'chase the deck'),
                              'fu4': fu('pp4', '', '22:00', 'late call'),
                              'fu5': fu('pp5', '', '', 'ask about the scope', rang={'k': 'fu:fu5@' + SAT + 'T10:00', 'at': now, 'dev': 'other'}),
                              'fu6': fu('pp6', '', '11:30', 'the creds')}})
    a.wait_for_timeout(300)
    ready(a)
    b = page()
    ready(b)

    # ---- before the hour: quiet; at 10:00 one card across two tabs ----
    ring(a)
    ring(b)
    check(pushed(a) == [] and pushed(b) == [], 'nothing rings before 10:00')
    c.clock.set_fixed_time(at(10, 0, 5))
    a.evaluate('() => M.prospects.ring()')
    b.evaluate('() => M.prospects.ring()')
    # the lock, the mark and the card settle on whichever tab won; both are read after a moment
    a.wait_for_timeout(1200)
    cards = pushed(a) + pushed(b)
    check(len(cards) == 1, 'one card across two tabs: %r' % cards)
    card = cards[0]
    check(card['key'] == 'fu:fu1@' + SAT + 'T10:00' and card['title'] == 'Follow up with Meera' and card['body'] == 'Swisse. You said after the 16th.' and card['href'] == '#prospects/pp1' and card['life'] == 60000, 'the card: %r' % card)
    check(card['away'] == {'title': 'A follow-up is due', 'body': 'Open m360 to see who.'}, 'the away text carries no name: %r' % card['away'])
    sounds = a.evaluate('() => window.__sounds') + b.evaluate('() => window.__sounds')
    check(sounds == ['soft'], 'one soft sound: %r' % sounds)
    rang = (doc(a, IX)['fu']['fu1'].get('rang') or {})
    check(rang.get('k') == card['key'] and rang.get('dev'), 'the index carries rang with the key: %r' % rang)
    mark = a.evaluate('() => localStorage.getItem("m360.fuRang.u_founder")')
    check(card['key'] in (mark or ''), 'the localStorage mark holds the key: %r' % mark)
    check(a.locator('.notice[data-key^="fu:"]').count() + b.locator('.notice[data-key^="fu:"]').count() == 1, 'one black card on screen')
    check(a.locator('.dock-badge').count() == 0 and b.locator('.dock-badge').count() == 0, 'the dock badge never moves for a follow-up')
    # a reload and more passes stay quiet; the one rung elsewhere is skipped
    ready(a)
    ring(a)
    ring(b)
    check(pushed(a) == [] and len(pushed(b)) <= 1, 'a reload and a second pass ring nothing new: %r' % ([pushed(a), pushed(b)],))
    check(not any('Anil' in (x['body'] or '') for x in pushed(b)), 'a follow-up rung on another device is skipped')
    items = a.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "follow").map(i => ({id: i.id, silent: i.silent, hot: i.hot, ref: i.ref, plain: i.plain}))')
    check(len(items) == 2 and all(i['silent'] and not i['hot'] for i in items) and sorted(i['id'] for i in items) == ['fu:fu1:' + SAT, 'fu:fu5:' + SAT] and all(i['ref'].startswith('#prospects/pp') for i in items), 'the inbox carries the due ones, silent, not hot: %r' % items)
    b.close()

    # ---- focus holds the 10:30 ring, then it rings ----
    c.clock.set_fixed_time(at(10, 31))
    a.evaluate('() => M.focus.start("", "Deep work", 25)')
    ring(a)
    check(pushed(a) == [], 'a focus timer holds the ring')
    a.evaluate('() => M.focus.stop()')
    a.wait_for_function('() => window.__pushed.length === 1')
    card = pushed(a)[0]
    check(card['key'] == 'fu:fu2@' + SAT + 'T10:30' and card['title'] == 'Follow up with Rahul' and card['body'] == 'Tata. Chase the deck.', 'the ring comes when focus ends: %r' % card)

    # ---- snooze re-arms ----
    a.evaluate('async () => { await M.prospects.snooze(M.lastCtx, "fu2", {d: "%s", t: "11:00"}); }' % SAT)
    a.wait_for_timeout(400)
    c.clock.set_fixed_time(at(11, 1))
    ring(a)
    a.wait_for_function('() => window.__pushed.length === 2')
    card = pushed(a)[1]
    check(card['key'] == 'fu:fu2@' + SAT + 'T11:00' and card['title'] == 'Follow up with Rahul', 'a snooze arms a new key and rings again: %r' % card)
    f2 = doc(a, IX)['fu']['fu2']
    check(f2['t'] == '11:00' and len(f2['snz']) == 1 and f2['snz'][0]['to'] == SAT + 'T11:00' and f2['rang']['k'] == card['key'], 'the snooze is on record: %r' % f2.get('snz'))

    a.close()

    # ---- a hidden tab: the away text is generic, and it needs two passes ----
    c.clock.set_fixed_time(at(11, 31))
    hp = page(HIDDEN + NOTIFY)
    ready(hp)
    ring(hp)
    check(pushed(hp) == [], 'a hidden tab rings nothing on its first pass: %r' % pushed(hp))
    # the second pass has to come a whole pass later on the page clock
    c.clock.set_fixed_time(at(11, 32))
    hp.evaluate('() => { window.__pnow += 31000; }')
    ring(hp)
    hp.wait_for_function('() => window.__pushed.length >= 1')
    cards = pushed(hp)
    check(len(cards) == 1 and cards[0]['key'] == 'fu:fu6@' + SAT + 'T11:30' and cards[0]['title'] == 'Follow up with Riya', 'the hidden tab rings once it has seen the key twice: %r' % cards)
    notes = hp.evaluate('() => window.__notes')
    check(notes and notes[-1]['title'] == 'A follow-up is due' and notes[-1]['body'] == 'Open m360 to see who.' and 'Riya' not in str(notes), 'the system notice carries the generic away text: %r' % notes)
    hp.close()

    # ---- the quiet span, at 22:05: a time the person said rings as given; a default time set now waits ----
    c.clock.set_fixed_time(at(22, 5))
    q = page()
    ready(q)
    q.wait_for_function('() => window.__pushed.length >= 1')
    card = pushed(q)[0]
    check(len(pushed(q)) == 1 and card['key'] == 'fu:fu4@' + SAT + 'T22:00' and card['title'] == 'Follow up with Kavya', 'a time the person said rings as given: %r' % pushed(q))
    q.evaluate('() => window.__db.set("%s", {...window.__db.get("%s"), fu: {...window.__db.get("%s").fu, fu3: %s}})' % (IX, IX, IX, json.dumps(fu('pp3', 'pt_nykaa', '', 'call back'))))
    q.wait_for_timeout(400)
    ring(q)
    ring(q)
    check(len(pushed(q)) == 1 and not any(x['key'].startswith('fu:fu3') for x in pushed(q)) and (doc(q, IX)['fu']['fu3'].get('rang') is None), 'a default time never rings after 21:00: %r' % pushed(q))
    q.close()

    # ---- the catch-up card on the next open, once a day a device; the missed ones sit as late ----
    c.clock.set_fixed_time(at(9, 15, 0, 19))
    g = page()
    ready(g)
    g.wait_for_function('() => window.__pushed.length >= 1', timeout=15000)
    cards = pushed(g)
    check(len(cards) == 1 and cards[0]['key'] == 'fu:catch@2026-10-19' and cards[0]['title'] == 'A follow-up from Saturday is waiting' and cards[0]['body'] == 'Priya at Nykaa.' and cards[0]['href'] == '#prospects/pp3', 'the catch-up card names what was missed: %r' % cards)
    check(cards[0]['away'] == {'title': 'Follow-ups are waiting', 'body': 'Open m360 to see who.'}, 'its away text carries no name')
    # the index mark lands a moment after the card (the write is not awaited by the watcher)
    g.wait_for_function('() => (((window.__db.get("%s") || {}).fu || {}).fu3 || {}).rang && window.__db.get("%s").fu.fu3.rang.k === "catch@2026-10-19"' % (IX, IX))
    check(g.evaluate('() => localStorage.getItem("m360.fuCatch.u_founder")') == '2026-10-19', 'the day is marked on this device')
    ready(g)
    ring(g)
    check(pushed(g) == [], 'a second open the same day shows no second catch-up card')
    h.seed_doc(g, 'checkin/' + F, {'days': {'2026-10-19': {'in': ms(9, 5, 19), 'out': None, 'mode': 'office', 'loc': {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}, 'outLoc': None}}})
    g.goto(h.url('founder', '#home', noai=True))
    h.ready(g)
    g.wait_for_selector('#followups-card')
    rows = g.evaluate('() => [...document.querySelectorAll("#followups-card .fu-row")].map(r => [r.dataset.fid, r.dataset.late, r.textContent.slice(0, 60)])')
    check(any(r[0] == 'fu3' and r[1] == '1' for r in rows), 'the missed follow-up sits late on Home: %r' % rows)
    items = g.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "follow" && i.hot).map(i => i.id)')
    check('fu:fu3:' + SAT in items, 'and hot in the inbox: %r' % items)
    check(g.evaluate('() => window.__sampleCalls.length') == 0, 'no model call anywhere')
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    print('test_prospects_ring: %d checks passed' % len(checks))


run(test)
