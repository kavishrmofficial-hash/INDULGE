#!/usr/bin/env python3
"""v37 Accounts: three tabs. People we are talking to (quick add, a follow-up read from the note, search,
log a talk, send to pipeline), the five column pipeline (quick add, move, search), and clients (search,
retainer or project, a new client found in the company database first).

Run: cd m360-os && python3 harness/tests/test_talks.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

SHOTS = os.environ.get('SHOTS', '')


def test(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, ('u_m1',))

    # the tabs: People, Pipeline, Clients, in that order
    h.go(p, 'founder', hash='#accounts', width=1280)
    p.wait_for_selector('#talk-who')
    tabs = p.evaluate('() => [...document.querySelectorAll(".sec-tabs button, .tabs button, [role=tablist] button")].map(b => b.innerText.trim().split("\\n")[0])')
    check(any(t.startswith('People') for t in tabs) and any(t.startswith('Pipeline') for t in tabs) and any(t.startswith('Clients') for t in tabs), 'three tabs, got %r' % tabs)
    check(not any(t.startswith('CRM') or t.startswith('Handshake') or t.startswith('Prospects') for t in tabs), 'the old tabs left the bar, got %r' % tabs)
    check(p.locator('#accounts-older').count() == 1, 'the older views sit behind More tools')

    # quick add: the note says "after 16 Oct", so the follow-up is read from it
    p.fill('#talk-who', 'Umashan')
    p.fill('#talk-org', 'Lumen Studio')
    p.fill('#talk-note', 'Asked me to connect after 16 Oct')
    p.wait_for_timeout(100)
    check('Read from the note' in p.inner_text('.talk-add'), 'the follow-up date is read from the note')
    p.locator('#talk-note').press('Enter')
    p.wait_for_function('() => Object.values(M.lastCtx.coll.talks.map).some(t => t.who === "Umashan")')
    t = p.evaluate('() => Object.values(M.lastCtx.coll.talks.map).find(t => t.who === "Umashan")')
    check(t['org'] == 'Lumen Studio' and t['owner'] == 'u_founder' and t['next'].endswith('-10-17') and t['met'], 'saved with the read date, got %r' % t)
    check(p.input_value('#talk-who') == '', 'the row clears for the next name')

    # a second one with a date typed by hand, already due
    p.evaluate('''() => M.talks.add(M.lastCtx, {who: "Tank Tailor", org: "Tank Tailor", note: "Asked for a proposal", met: "2026-10-01", next: "2026-10-02", nextWhat: "Send the proposal"})''')
    p.wait_for_selector('.talk-row.due:has-text("Tank Tailor")')
    # search narrows by what was said
    p.fill('#talk-q', 'proposal')
    p.wait_for_timeout(150)
    names = p.evaluate('() => [...document.querySelectorAll(".talk-row .talk-name b")].map(b => b.innerText)')
    check(names == ['Tank Tailor'], 'search by what was said, got %r' % names)
    p.fill('#talk-q', '')

    # name suggestions come from the list and the clients
    p.fill('#talk-who', 'swis')
    p.wait_for_selector('#talk-sug', timeout=4000)
    check('Swisse' in p.inner_text('#talk-sug'), 'the name field suggests clients, got %r' % p.inner_text('#talk-sug'))
    p.fill('#talk-who', '')

    if SHOTS:
        p.screenshot(path=os.path.join(SHOTS, 'people-1280.png'), full_page=True)

    # log a talk on Tank Tailor, moving the follow-up
    p.locator('.talk-row:has-text("Tank Tailor") button:has-text("Log a talk")').click()
    p.wait_for_selector('#talk-log-x')
    p.fill('#talk-log-x', 'Sent the deck, they reply next week')
    p.fill('#talk-log-next', '2030-01-05')
    p.locator('#talk-log-save').click()
    p.wait_for_function('() => { const t = Object.values(M.lastCtx.coll.talks.map).find(t => t.who === "Tank Tailor"); return t && t.next === "2030-01-05" && Object.keys(t.log || {}).length === 1; }')

    # send to pipeline from the drawer
    tid = p.evaluate('() => Object.keys(M.lastCtx.coll.talks.map).find(k => M.lastCtx.coll.talks.map[k].who === "Tank Tailor")')
    check(p.locator('.talk-row:has-text("Tank Tailor")').count() == 0, 'a follow-up moved to later leaves the due list')
    p.evaluate('(id) => { location.hash = "#talks/" + id; }', tid)
    p.wait_for_selector('#td-pipeline')
    p.locator('#td-pipeline').click()
    p.wait_for_function('() => Object.values(M.lastCtx.coll.pitches.map).some(x => x.brand === "Tank Tailor" && x.stage === "lead" && x.talk)')
    p.keyboard.press('Escape')

    # the pipeline: five columns, quick add lands in Building, a card moves
    h.go(p, 'founder', hash='#pitches', width=1280)
    p.wait_for_selector('#prop-brand')
    cols = p.evaluate('() => [...document.querySelectorAll(".prop-board .colm .col-head span:first-child")].map(x => x.innerText)')
    check([c.lower() for c in cols] == ['building', 'sent', 'waiting on them', 'won', 'lost'], 'five columns, got %r' % cols)
    check(p.locator('.colm[data-col="building"] .prop-card:has-text("Tank Tailor")').count() == 1, 'the pitch from People sits in Building')
    p.fill('#prop-brand', 'Casa Verde')
    p.fill('#prop-next', 'Social retainer, 3 months')
    p.locator('#prop-next').press('Enter')
    p.wait_for_selector('.colm[data-col="building"] .prop-card:has-text("Casa Verde")')
    p.locator('.prop-card:has-text("Casa Verde") button[data-move="sent"]').click()
    p.wait_for_selector('.colm[data-col="sent"] .prop-card:has-text("Casa Verde")')
    check(p.evaluate('() => Object.values(M.lastCtx.coll.pitches.map).find(x => x.brand === "Casa Verde").stage') == 'proposal', 'sent writes the proposal stage')
    p.locator('.prop-card:has-text("Casa Verde") button[data-move="waiting"]').click()
    p.wait_for_selector('.colm[data-col="waiting"] .prop-card:has-text("Casa Verde")')
    p.fill('#prop-q', 'casa')
    p.wait_for_timeout(150)
    check(p.locator('.prop-card').count() == 1, 'search narrows the board')
    p.fill('#prop-q', '')
    if SHOTS:
        p.screenshot(path=os.path.join(SHOTS, 'pipeline-1280.png'), full_page=True)
    # tapping a card opens the full pitch drawer
    p.locator('.prop-card:has-text("Casa Verde") .prop-open').click()
    p.wait_for_selector('.drawer #pitch-brand, .drawer input[value="Casa Verde"]', timeout=4000)
    p.keyboard.press('Escape')

    # clients: search, kind filter, a project kept out of monthly revenue
    h.go(p, 'founder', hash='#clients', width=1280)
    p.wait_for_selector('#client-q')
    total = p.locator('[data-client]').count()
    p.fill('#client-q', 'swisse')
    p.wait_for_timeout(150)
    check(p.locator('[data-client]').count() == 1, 'client search narrows to one, from %d' % total)
    p.fill('#client-q', '')
    cid = p.evaluate('() => Object.keys(M.lastCtx.coll.clients.map).find(k => /swisse/i.test(M.lastCtx.coll.clients.map[k].name))')
    before = p.evaluate('() => M.clients.shares(M.lastCtx).reduce((n, r) => n + r.monthly, 0)')
    p.evaluate('(c) => M.lastCtx.W.merge("data/users/u_founder/finance", {clients: {[c]: {kind: "project", fee: 500000}}})', cid)
    p.wait_for_function('(c) => M.clients.kindOf(M.lastCtx, c) === "project"', arg=cid)
    after = p.evaluate('() => M.clients.shares(M.lastCtx).reduce((n, r) => n + r.monthly, 0)')
    check(after <= before and p.evaluate('(c) => M.clients.shares(M.lastCtx).find(r => r.id === c).monthly', cid) == 0, 'a project never counts in monthly revenue (%r to %r)' % (before, after))
    p.locator('button[role=radio]:has-text("Projects"), .seg button:has-text("Projects")').first.click()
    p.wait_for_timeout(150)
    check(p.locator('[data-client]').count() == 1 and p.locator('[data-kind="project"]').count() == 1, 'the Projects filter shows the project client')

    # a new client starts with a search; nothing matches, so it is added as a new company
    p.locator('#client-new').click()
    p.wait_for_selector('#client-find')
    p.fill('#client-find', 'Nexora Labs Zeta')
    p.wait_for_selector('#client-add-new')
    p.locator('#client-add-new').click()
    p.wait_for_selector('.drawer #client-name')
    check(p.input_value('#client-name') == 'Nexora Labs Zeta', 'the typed name carries into the form')
    p.locator('.drawer .seg button:has-text("Project"), .drawer [role=radio]:has-text("Project")').first.click()
    p.wait_for_selector('#client-fee')
    p.fill('#client-fee', '250000')
    p.locator('.drawer button:has-text("Create client")').click()
    p.wait_for_function('() => Object.values(M.lastCtx.coll.clients.map).some(c => c.name === "Nexora Labs Zeta" && c.billing === "project")')
    nid = p.evaluate('() => Object.keys(M.lastCtx.coll.clients.map).find(k => M.lastCtx.coll.clients.map[k].name === "Nexora Labs Zeta")')
    p.wait_for_function('(c) => { const f = M.lastCtx.priv.finance.data.clients[c]; return f && f.kind === "project" && f.fee === 250000; }', arg=nid)

    # a member: People works, no money anywhere
    h.go(p, 'm1', hash='#talks', width=1280)
    p.wait_for_selector('#talk-who')
    check(p.locator('.talk-row:has-text("Umashan")').count() == 1, 'the list is shared with the team')

    # phone width
    h.go(p, 'founder', hash='#talks', width=390)
    p.wait_for_selector('#talk-who')
    check(not h.overflow(p), 'no sideways scroll at 390 on People')
    if SHOTS:
        p.screenshot(path=os.path.join(SHOTS, 'people-390.png'), full_page=True)
    h.go(p, 'founder', hash='#pitches', width=390)
    p.wait_for_selector('#prop-brand')
    ov = h.overflow(p)
    if ov:
        print('wide:', p.evaluate('() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".board-wrap")).slice(0, 6).map(e => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right))'))
    check(not ov, 'no sideways scroll at 390 on Pipeline')
    if SHOTS:
        p.screenshot(path=os.path.join(SHOTS, 'pipeline-390.png'), full_page=True)

    # v39: the log keeps the newest 40, also after the store merges the update
    lid = p.evaluate('() => M.talks.add(M.lastCtx, {who: "Log Cap", org: "Cap Co"})')
    p.wait_for_function('(id) => !!M.lastCtx.coll.talks.map[id]', arg=lid)
    for i in range(43):
        p.evaluate('([id, i]) => M.talks.logTalk(M.lastCtx, {id, ...M.lastCtx.coll.talks.map[id]}, "talk " + i, "2026-10-29")', [lid, i])
    p.wait_for_function('(id) => Object.values(M.lastCtx.coll.talks.map[id].log || {}).some(l => l.x === "talk 42")', arg=lid)
    n = p.evaluate('(id) => Object.keys(M.lastCtx.coll.talks.map[id].log || {}).length', lid)
    check(n == 40, 'the talk log keeps the newest 40, got %r' % n)
    # v39: two taps on Send to pipeline from the same copy make one pitch
    sid = p.evaluate('() => M.talks.add(M.lastCtx, {who: "Twice", org: "Twice Co"})')
    p.wait_for_function('(id) => !!M.lastCtx.coll.talks.map[id]', arg=sid)
    p.evaluate('(id) => { const t = {id, ...M.lastCtx.coll.talks.map[id]}; return Promise.all([M.talks.toPipeline(M.lastCtx, t), M.talks.toPipeline(M.lastCtx, t)]); }', sid)
    p.wait_for_timeout(300)
    n = p.evaluate('(id) => Object.values(M.lastCtx.coll.pitches.map).filter(x => x.talk === id).length', sid)
    check(n == 1, 'one pitch from two taps on one person, got %r' % n)
    # v39: the shared billing on the client is the one answer for everyone
    p.evaluate('(c) => M.lastCtx.W.update("clients/" + c, {billing: "retainer"})', cid)
    p.wait_for_function('(c) => M.lastCtx.coll.clients.map[c].billing === "retainer"', arg=cid)
    check(p.evaluate('(c) => M.clients.kindOf(M.lastCtx, c)', cid) == 'retainer', 'billing on the client wins over the private kind')
    # v39: picking a client in the name suggestions empties the name
    h.go(p, 'founder', hash='#talks', width=1280)
    p.wait_for_selector('#talk-who')
    p.fill('#talk-who', 'swis')
    p.wait_for_selector('#talk-sug button:has-text("Client")', timeout=4000)
    p.locator('#talk-sug button:has-text("Client")').first.dispatch_event('mousedown')
    p.wait_for_timeout(150)
    check(p.input_value('#talk-who') == '' and 'Swisse' in p.input_value('#talk-org'), 'a client pick fills the company and empties the name, got %r' % [p.input_value('#talk-who'), p.input_value('#talk-org')])

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = run(test)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
