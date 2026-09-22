#!/usr/bin/env python3
"""Voice module checks: anonymous weekly pulse, the founder's team energy view, ideas box with votes and status.

Run: M360_MODULES=35-voice.js M360_TAG=voice python3 harness/tests/test_voice.py
Prints PASS on success and exits non-zero on any failure.

Every view runs in one browser context: each Playwright context gets its own localStorage, so identity and
width switches go through page.goto on the same page to keep the mock database."""
import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

WORKING = 'The Swisse shoot ran on time'
BROKEN = 'Review notes arrive after 21:00'
CHANGE = 'Reply to blockers before noon'
IDEA = 'Give every pod a Loom seat'
IDEA2 = 'Second idea from Aanya'


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def view(h, page, ident, width, hash='#voice'):
    """Switch identity and width on the same page, keeping the shared mock database."""
    page.set_viewport_size({'width': width, 'height': 900})
    page.goto(h.url(ident, hash))
    h.ready(page)


def layout(h, page, name, results):
    """Record overflow and small text for a view, plus a screenshot."""
    page.wait_for_timeout(120)
    results.append((name, h.overflow(page), h.small_text(page)))
    h.shot(page, 'voice-' + name)


def test(h):
    results = []

    # ---- m1 at 1280: send a pulse, post an idea ----
    page = h.open('m1', width=1280, hash='#voice', reset=True, seed=True)
    h.roster(page, ('u_m1',))
    page.wait_for_selector('#pulse-working')
    check(page.locator('.card-title', has_text='Team energy').count() == 0, 'member sees the Team energy card')
    check('Anonymous. Your name is never stored with it.' in page.inner_text('#pulse-card'), 'anonymity line missing')
    send = page.locator('button', has_text='Send pulse')
    check(send.is_disabled(), 'Send pulse is enabled before energy is chosen')
    page.locator('[aria-label="Energy this week"] .seg-btn', has_text='4').click()
    check(send.is_enabled(), 'Send pulse stays disabled after energy is chosen')
    page.fill('#pulse-working', WORKING)
    page.fill('#pulse-broken', BROKEN)
    page.fill('#pulse-change', CHANGE)
    send.click()
    page.wait_for_selector('text=Sent for this week.')
    page.wait_for_timeout(250)

    store = page.evaluate('window.__db.store()')
    pulses = {k: v for k, v in store.items() if k.startswith('pulse/')}
    check(len(pulses) == 1, 'expected 1 pulse doc, got %d' % len(pulses))
    pid, pdoc = next(iter(pulses.items()))
    check('u_m1' not in json.dumps(pulses), 'pulse doc or id carries the user id: %r' % pulses)
    week = h.ctx(page, 'M.U.isoWeek(new Date())')
    check(pdoc.get('energy') == 4 and pdoc.get('week') == week and pdoc.get('working') == WORKING
          and pdoc.get('broken') == BROKEN and pdoc.get('change') == CHANGE and pdoc.get('at'),
          'pulse doc fields wrong: %r' % pdoc)
    state = page.evaluate('window.__db.get("data/users/u_m1/state")')
    check(bool(state) and state.get('pulse', {}).get(week) is True, 'private state pulse flag missing: %r' % state)
    check(page.locator('#pulse-working').count() == 0, 'pulse form still shown after sending')

    ebw = h.ctx(page, 'M.voice.energyByWeek(ctx, 8)')
    check(len(ebw) == 8 and ebw[-1]['week'] == week and ebw[-1]['avg'] == 4 and ebw[-1]['n'] == 1
          and ebw[0]['avg'] is None and ebw[0]['n'] == 0 and ebw[0]['week'] < ebw[-1]['week'],
          'energyByWeek wrong: %r' % ebw)
    lat = h.ctx(page, 'M.voice.latest(ctx, 5)')
    check(len(lat) == 1 and lat[0]['working'] == WORKING and 'u_m1' not in json.dumps(lat), 'latest wrong: %r' % lat)

    page.fill('#idea-text', IDEA)
    page.locator('button', has_text='Post idea').click()
    page.wait_for_selector('#ideas-card .listrow:has-text("%s")' % IDEA)
    page.wait_for_timeout(250)
    ideas = page.evaluate('window.__db.get("ideas/u_m1")')
    items = (ideas or {}).get('items', {})
    check(len(items) == 1, 'expected 1 idea item, got %r' % ideas)
    iid, item = next(iter(items.items()))
    check(item.get('t') == IDEA and item.get('status') == 'open' and item.get('at'), 'idea item wrong: %r' % item)
    check(page.input_value('#idea-text') == '', 'idea input did not clear')
    row = page.locator('#ideas-card .listrow', has_text=IDEA)
    check('Durvesh Patil' in row.inner_text(), 'idea row lacks the author name')
    check(row.locator('.pill', has_text='open').count() == 1, 'open pill missing')
    check(row.locator('[aria-label="Idea status"]').count() == 0, 'member sees the status control')
    layout(h, page, 'm1-1280', results)

    # ---- founder at 1280: team energy, vote, status ----
    view(h, page, 'founder', 1280)
    page.wait_for_selector('#team-energy-card')
    page.wait_for_selector('#team-energy-card .listrow')
    te = page.locator('#team-energy-card')
    check(te.locator('.vbars .vb').count() == 8, 'expected 8 bars')
    hts = page.evaluate('[...document.querySelectorAll("#team-energy-card .vbars .vb")].map(e => e.getBoundingClientRect().height)')
    check(hts[-1] > 40 and all(x <= 7 for x in hts[:-1]), 'bar heights wrong: %r' % hts)
    check(te.locator('.vb.low').count() == 0, 'an energy 4 week is marked low')
    text = te.inner_text()
    for s in (WORKING, BROKEN, CHANGE, 'energy 4', str(int(week.split('-W')[1]))):
        check(s in text, 'Team energy card missing %r' % s)
    check('Durvesh' not in text and 'u_m1' not in text, 'Team energy card shows a name or id')
    check(page.locator('#pulse-working').count() == 1, 'founder has no pulse form')

    # a low week two weeks back turns its bar and pill flame; responses stay newest first
    low_week = h.ctx(page, 'M.U.isoWeek(M.U.addDays(new Date(), -14))')
    low_at = h.ctx(page, 'Date.now() - 14 * 86400000')
    h.seed_doc(page, 'pulse/seedlow', {'at': low_at, 'week': low_week, 'energy': 2, 'working': '', 'broken': 'Late briefs', 'change': ''})
    page.wait_for_timeout(250)
    check(te.locator('.vb.low').count() == 1, 'low week bar missing')
    check(te.locator('.pill.flame', has_text='energy 2').count() == 1, 'flame energy pill missing')
    check('energy 4' in te.locator('.listrow').first.inner_text(), 'responses are out of order')
    ebw = h.ctx(page, 'M.voice.energyByWeek(ctx, 8)')
    check(ebw[-3]['week'] == low_week and ebw[-3]['avg'] == 2 and ebw[-3]['n'] == 1, 'energyByWeek missed the low week: %r' % ebw)

    row = page.locator('#ideas-card .listrow', has_text=IDEA)
    btn = row.locator('.emoji-btn')
    key = 'u_m1:' + iid
    btn.click()
    page.wait_for_timeout(250)
    votes = page.evaluate('window.__db.get("votes/u_founder")')
    check(bool(votes) and votes.get('v', {}).get(key) is True, 'vote missing: %r' % votes)
    check('on' in (btn.get_attribute('class') or '').split(), 'vote button lacks class on')
    check('1 vote' in row.inner_text(), 'vote count missing')
    btn.click()
    page.wait_for_timeout(250)
    votes = page.evaluate('window.__db.get("votes/u_founder")')
    check(key not in (votes or {}).get('v', {}), 'vote did not clear: %r' % votes)
    check('on' not in (btn.get_attribute('class') or '').split(), 'vote button still on')
    check('0 votes' in row.inner_text(), 'vote count did not drop to 0')
    btn.click()
    page.wait_for_timeout(250)
    votes = page.evaluate('window.__db.get("votes/u_founder")')
    check(votes.get('v', {}).get(key) is True, 'second vote missing: %r' % votes)

    row.locator('[aria-label="Idea status"] .seg-btn', has_text='Doing').click()
    page.wait_for_timeout(250)
    ideas = page.evaluate('window.__db.get("ideas/u_m1")')
    check(ideas['items'][iid]['status'] == 'doing', 'status is off: %r' % ideas)
    check(ideas['items'][iid]['t'] == IDEA, 'status write clobbered the idea text')
    check(row.locator('.pill.ink', has_text='doing').count() == 1, 'doing pill missing')

    # a newer idea with no votes sorts after the voted one
    h.seed_doc(page, 'ideas/u_m2', {'items': {'i2': {'t': IDEA2, 'at': low_at + 20 * 86400000, 'status': 'parked'}}})
    page.wait_for_timeout(250)
    rows = page.locator('#ideas-card .listrow')
    check(rows.count() == 2 and IDEA in rows.nth(0).inner_text() and IDEA2 in rows.nth(1).inner_text(), 'ideas out of vote order')
    check(rows.nth(1).locator('.pill.warm', has_text='parked').count() == 1, 'parked pill missing')
    check('Durvesh Patil' in rows.nth(0).inner_text() and 'Aanya Mehta' in rows.nth(1).inner_text(),
          'author names unresolved: %r' % page.inner_text('#ideas-card'))
    layout(h, page, 'founder-1280', results)

    # ---- 390 wide: member and founder ----
    view(h, page, 'm1', 390)
    page.wait_for_selector('#pulse-card')
    check('Sent for this week.' in page.inner_text('#pulse-card'), 'state flag did not keep Sent for this week.')
    check(page.locator('#pulse-working').count() == 0, 'form shown after sending at 390')
    check(page.locator('#team-energy-card').count() == 0, 'member sees Team energy at 390')
    check(page.locator('#ideas-card .listrow').count() == 2, 'ideas missing at 390')
    layout(h, page, 'm1-390', results)

    view(h, page, 'founder', 390)
    page.wait_for_selector('#team-energy-card .listrow')
    check(page.locator('#team-energy-card .vbars .vb').count() == 8, 'expected 8 bars at 390')
    check(page.locator('#team-energy-card .vb.low').count() == 1, 'low bar missing at 390')
    page.wait_for_selector('#ideas-card .listrow:has-text("Aanya Mehta")')
    check('Durvesh Patil' in page.locator('#ideas-card .listrow').nth(0).inner_text(), 'author name unresolved at 390')
    layout(h, page, 'founder-390', results)

    # ---- every view opened: no overflow, no small text, no console errors ----
    for name, ov, st in results:
        check(ov == 0, '%s: horizontal overflow %dpx' % (name, ov))
        check(not st, '%s: text under 11px %r' % (name, st[:3]))
    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    print('views checked:', ', '.join(n for n, _, _ in results))


if __name__ == '__main__':
    try:
        run(test)
    except Exception:
        traceback.print_exc()
        print('FAIL')
        sys.exit(1)
    print('PASS')
