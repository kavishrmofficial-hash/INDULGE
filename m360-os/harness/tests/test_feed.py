#!/usr/bin/env python3
"""Feed module checks: composer, automatic pin for announcements, reactions, kudos with the weekly cap,
tap-again delete, filters, member limits, at 1280 and 390.

Run: M360_MODULES=20-feed.js M360_TAG=feed python3 harness/tests/test_feed.py
Prints PASS on success and exits non-zero on any failure.

Every view runs in one browser context: each Playwright context gets its own localStorage, so identity and
width switches go through page.goto on the same page to keep the mock database."""
import os
import re
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

UPDATE = 'Swisse reel scripts v3 went to the client at 11:00'
ANN = 'Friday review moves to 16:00 this week'
WIN = 'Blah Studio signed the retainer'
WHY1 = 'Turned the shoot schedule around in one evening'
WHY2 = 'Caught the approvals gap before the client did'
PIN_RE = re.compile(r'^(Pin|Unpin)$')


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def view(h, page, ident, width, hash='#feed'):
    """Switch identity and width on the same page, keeping the shared mock database."""
    page.set_viewport_size({'width': width, 'height': 900})
    page.goto(h.url(ident, hash))
    h.ready(page)
    page.wait_for_selector('h1.pgt:has-text("Feed")')


def layout(h, page, name, results):
    """Record overflow and small text for a view, plus a screenshot."""
    page.wait_for_timeout(120)
    results.append((name, h.overflow(page), h.small_text(page)))
    h.shot(page, 'feed-' + name)


def feed_doc(page, uid):
    return page.evaluate('window.__db.get("feed/%s")' % uid) or {}


def open_kudos(page):
    page.get_by_role('button', name='Give kudos').click()
    page.wait_for_selector('.drawer:has-text("Give kudos")')
    page.wait_for_timeout(150)


def close_drawer(page):
    page.locator('.drawer button[aria-label="Close"]').click()
    page.wait_for_selector('.drawer', state='detached')


def test(h):
    results = []

    # ---- founder at 1280: post an update, then an announcement ----
    page = h.open('founder', width=1280, hash='#feed', reset=True)
    h.roster(page, ('u_m1', 'u_m2'))
    page.wait_for_selector('h1.pgt:has-text("Feed")')
    page.wait_for_selector('#feed-composer')
    check('Nothing posted yet.' in page.inner_text('#feed-stream'), 'empty state missing')
    post = page.get_by_role('button', name='Post', exact=True)
    check(post.is_disabled(), 'Post is enabled with an empty composer')
    page.fill('#feed-text', UPDATE)
    check(post.is_enabled(), 'Post stays disabled with text')
    post.click()
    page.wait_for_selector('.toast:has-text("Posted")')
    page.wait_for_timeout(250)
    doc = feed_doc(page, 'u_founder')
    check(len(doc.get('posts', [])) == 1, 'expected 1 post: %r' % doc)
    up = doc['posts'][0]
    check(up['kind'] == 'update' and up['text'] == UPDATE and up['id'] and up['at'], 'update post wrong: %r' % up)
    check(not doc.get('pinned'), 'an update must never pin: %r' % doc)
    check(page.input_value('#feed-text') == '', 'composer did not clear')
    up_key = 'u_founder:' + up['id']
    up_card = page.locator('#feed-stream .card[data-key="%s"]' % up_key)
    check(up_card.count() == 1, 'update card missing')
    check(up_card.locator('.pill', has_text='update').count() == 1, 'update pill missing')
    check(up_card.locator('.pill.ink, .pill.flame').count() == 0, 'update pill must be outline')

    page.fill('#feed-text', ANN)
    page.locator('[aria-label="Post kind"] .seg-btn', has_text='Announcement').click()
    check('Announcements pin to the top of the feed' in page.inner_text('#feed-composer'), 'announcement hint missing')
    post.click()
    page.wait_for_selector('.toast:has-text("Posted")')
    page.wait_for_timeout(250)
    doc = feed_doc(page, 'u_founder')
    check(len(doc['posts']) == 2 and doc['posts'][0]['kind'] == 'announce' and doc['posts'][0]['text'] == ANN,
          'announcement post wrong: %r' % doc)
    ann_key = 'u_founder:' + doc['posts'][0]['id']
    check(doc.get('pinned') == ann_key, 'announcement did not pin: %r' % doc)
    check(doc['posts'][1]['id'] == up['id'], 'older posts must stay in order')
    check(page.locator('[aria-label="Post kind"] .seg-btn.active').inner_text() == 'Update', 'kind did not reset')

    cards = page.locator('#feed-stream .card')
    check(cards.count() == 2, 'expected 2 cards')
    first = cards.nth(0)
    check(first.get_attribute('data-key') == ann_key, 'the pinned announcement must sort first')
    check(first.locator('.pill.flame', has_text='announcement').count() == 1, 'flame announcement pill missing')
    check(first.locator('.pill', has_text='pinned').count() == 1, 'pinned pill missing')
    check('flame' in (first.get_attribute('class') or '').split(), 'pinned card lacks the flame border')
    check(ANN in first.inner_text(), 'announcement text missing')
    page.wait_for_selector('#feed-stream .card:has-text("Kaavish Ramchandani")')
    check(first.locator('button', has_text=PIN_RE).inner_text() == 'Unpin', 'pinned card must offer Unpin')
    check(cards.nth(1).locator('button', has_text=PIN_RE).inner_text() == 'Pin', 'unpinned card must offer Pin')
    check(cards.nth(1).locator('.pill', has_text='pinned').count() == 0, 'only the pinned post carries the pill')

    # pin the older update: it sorts first; unpin: newest first again
    cards.nth(1).locator('button', has_text=PIN_RE).click()
    page.wait_for_selector('.toast:has-text("Pinned")')
    page.wait_for_timeout(250)
    check(feed_doc(page, 'u_founder').get('pinned') == up_key, 'pin did not move to the update')
    check(cards.nth(0).get_attribute('data-key') == up_key, 'pinned update must sort first')
    check(cards.nth(0).locator('.pill', has_text='pinned').count() == 1, 'pinned pill missing on the update')
    check(cards.nth(1).locator('.pill', has_text='pinned').count() == 0, 'announcement still shows pinned')
    cards.nth(0).locator('button', has_text=PIN_RE).click()
    page.wait_for_selector('.toast:has-text("Unpinned")')
    page.wait_for_timeout(250)
    check(feed_doc(page, 'u_founder').get('pinned') is None, 'unpin did not clear the field')
    check(cards.nth(0).get_attribute('data-key') == ann_key, 'newest first once nothing is pinned')
    check(page.locator('#feed-stream .pill', has_text='pinned').count() == 0, 'pinned pill lingers')
    # pin the announcement again for the rest of the run
    cards.nth(0).locator('button', has_text=PIN_RE).click()
    page.wait_for_selector('.toast:has-text("Pinned")')
    page.wait_for_timeout(250)
    check(feed_doc(page, 'u_founder').get('pinned') == ann_key, 'announcement did not pin again')

    # ---- reactions: 🔥 on, then off ----
    ann_card = page.locator('#feed-stream .card[data-key="%s"]' % ann_key)
    fire = ann_card.locator('.emoji-btn', has_text='🔥')
    check(fire.count() == 1 and ann_card.locator('.emoji-btn').count() == 4, 'expected 4 reaction buttons')
    fire.click()
    page.wait_for_timeout(250)
    reacts = page.evaluate('window.__db.get("reacts/u_founder")')
    check(bool(reacts) and reacts.get('r', {}).get(ann_key) == '🔥', 'reaction missing: %r' % reacts)
    check('on' in (fire.get_attribute('class') or '').split(), 'my reaction lacks class on')
    check(fire.get_attribute('aria-pressed') == 'true', 'aria-pressed missing')
    check('1' in fire.inner_text(), 'count missing')
    # a second emoji replaces the first: one reaction per person per post
    ann_card.locator('.emoji-btn', has_text='👍').click()
    page.wait_for_timeout(250)
    reacts = page.evaluate('window.__db.get("reacts/u_founder")')
    check(reacts['r'].get(ann_key) == '👍', 'reaction did not switch: %r' % reacts)
    check('on' not in (fire.get_attribute('class') or '').split(), 'old reaction still on')
    ann_card.locator('.emoji-btn', has_text='👍').click()
    page.wait_for_timeout(250)
    reacts = page.evaluate('window.__db.get("reacts/u_founder")')
    check(ann_key not in (reacts or {}).get('r', {}), 'reaction did not clear: %r' % reacts)
    check(ann_card.locator('.emoji-btn.on').count() == 0, 'a reaction button is still on')
    check(ann_card.locator('.emoji-btn .num').count() == 0, 'a count lingers')

    # ---- kudos: twice to m1, then the cap ----
    open_kudos(page)
    drawer = page.locator('.drawer')
    check('3 of 3 left this week' in drawer.inner_text(), 'cap line wrong: %r' % drawer.inner_text())
    send = page.get_by_role('button', name='Send kudos')
    check(send.is_disabled(), 'Send kudos enabled with no reason')
    opts = page.evaluate('[...document.querySelectorAll("#kudos-to option")].map(o => [o.value, o.textContent])')
    check([o[0] for o in opts] == ['u_m1', 'u_m2'], 'select must list active members except me: %r' % opts)
    page.wait_for_function('() => [...document.querySelectorAll("#kudos-to option")].every(o => o.textContent.trim().length > 0)')
    opts = page.evaluate('[...document.querySelectorAll("#kudos-to option")].map(o => o.textContent)')
    check(opts == ['Durvesh Patil', 'Aanya Mehta'], 'select labels unresolved: %r' % opts)
    page.select_option('#kudos-to', 'u_m1')
    page.fill('#kudos-why', WHY1)
    check(send.is_enabled(), 'Send kudos stays disabled')
    send.click()
    page.wait_for_selector('.toast:has-text("Kudos sent")')
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(250)
    kd = page.evaluate('window.__db.get("kudos/u_founder")')
    check(bool(kd) and len(kd['given']) == 1, 'expected 1 kudos: %r' % kd)
    g = kd['given'][0]
    check(g['to'] == 'u_m1' and g['why'] == WHY1 and g['id'] and g['at'], 'kudos item wrong: %r' % g)
    open_kudos(page)
    check('2 of 3 left this week' in drawer.inner_text(), 'cap did not drop to 2')
    page.select_option('#kudos-to', 'u_m1')
    page.fill('#kudos-why', WHY2)
    page.get_by_role('button', name='Send kudos').click()
    page.wait_for_selector('.toast:has-text("Kudos sent")')
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(250)
    kd = page.evaluate('window.__db.get("kudos/u_founder")')
    check(len(kd['given']) == 2 and kd['given'][0]['why'] == WHY2 and kd['given'][1]['why'] == WHY1, 'kudos order wrong: %r' % kd)
    open_kudos(page)
    check('1 of 3 left this week' in drawer.inner_text(), 'cap line must read 1 of 3: %r' % drawer.inner_text())
    check(page.get_by_role('button', name='Send kudos').is_disabled(), 'Send kudos enabled before a reason is typed')
    close_drawer(page)

    # kudos cards in the stream, newest first, with the giver and the receiver named
    page.wait_for_selector('#feed-stream .card[data-kind="kudos"]:has-text("Kudos to Durvesh Patil")')
    kcards = page.locator('#feed-stream .card[data-kind="kudos"]')
    check(kcards.count() == 2, 'expected 2 kudos cards')
    ktext = kcards.nth(0).inner_text()
    check(WHY2 in ktext and 'Kaavish Ramchandani' in ktext, 'newest kudos card wrong: %r' % ktext)
    check(kcards.nth(0).locator('.pill.ink', has_text='kudos').count() == 1, 'kudos ink pill missing')
    check(kcards.nth(0).locator('button', has_text=PIN_RE).count() == 0, 'kudos cards carry no Pin')
    check(page.locator('#feed-stream .card').nth(0).get_attribute('data-key') == ann_key, 'pinned announcement must stay first')
    check(WHY2 in page.locator('#feed-stream .card').nth(1).inner_text(), 'newest kudos must follow the pinned post')

    # last week's kudos never count; a third one this week hits the cap
    now = page.evaluate('Date.now()')
    given = kd['given']
    old = {'id': 'kold', 'to': 'u_m2', 'why': 'Old one from last week', 'at': now - 8 * 86400000}
    h.seed_doc(page, 'kudos/u_founder', {'given': given + [old]})
    page.wait_for_timeout(250)
    open_kudos(page)
    check('1 of 3 left this week' in drawer.inner_text(), 'last week must never count')
    close_drawer(page)
    third = {'id': 'k3', 'to': 'u_m2', 'why': 'Third this week', 'at': now - 60000}
    h.seed_doc(page, 'kudos/u_founder', {'given': [third] + given + [old]})
    page.wait_for_timeout(250)
    open_kudos(page)
    check('0 of 3 left this week' in drawer.inner_text(), 'cap line must read 0 of 3')
    page.fill('#kudos-why', 'One more')
    check(page.get_by_role('button', name='Send kudos').is_disabled(), 'Send kudos must disable at the cap')
    page.keyboard.press('Escape')
    page.wait_for_selector('.drawer', state='detached')
    check(page.locator('#feed-stream .card[data-kind="kudos"]').count() == 4, 'expected 4 kudos cards')

    # ---- delete the update with tap-again ----
    up_card = page.locator('#feed-stream .card[data-key="%s"]' % up_key)
    up_card.locator('button', has_text='Delete').click()
    page.wait_for_selector('#feed-stream .card[data-key="%s"] button:has-text("Tap again to confirm")' % up_key)
    page.wait_for_timeout(200)
    check(len(feed_doc(page, 'u_founder')['posts']) == 2, 'one tap must change nothing')
    up_card.locator('button', has_text='Tap again to confirm').click()
    page.wait_for_selector('.toast:has-text("Deleted")')
    page.wait_for_timeout(250)
    doc = feed_doc(page, 'u_founder')
    check(len(doc['posts']) == 1 and doc['posts'][0]['id'] != up['id'], 'delete failed: %r' % doc)
    check(doc.get('pinned') == ann_key, 'deleting another post must keep the pin')
    check(up_card.count() == 0, 'deleted card still shown')

    # ---- filters ----
    filt = page.locator('[aria-label="Filter"] .seg-btn')
    filt.filter(has_text='Kudos').click()
    page.wait_for_timeout(120)
    kinds = page.evaluate('[...document.querySelectorAll("#feed-stream .card")].map(c => c.dataset.kind)')
    check(kinds == ['kudos'] * 4, 'Kudos filter shows other cards: %r' % kinds)
    filt.filter(has_text='Announcements').click()
    page.wait_for_timeout(120)
    kinds = page.evaluate('[...document.querySelectorAll("#feed-stream .card")].map(c => c.dataset.kind)')
    check(kinds == ['announce'], 'Announcements filter wrong: %r' % kinds)
    filt.filter(has_text='Wins').click()
    page.wait_for_timeout(120)
    check(page.locator('#feed-stream .card').count() == 0 and 'No wins yet.' in page.inner_text('#feed-stream'), 'Wins empty state missing')
    filt.filter(has_text='All').click()
    page.wait_for_timeout(120)
    check(page.locator('#feed-stream .card').count() == 5, 'All filter must show every card')
    layout(h, page, 'founder-1280', results)

    # ---- m1 at 1280: no Pin, no Announcement kind, can post a win and react ----
    view(h, page, 'm1', 1280)
    page.wait_for_selector('#feed-stream .card[data-key="%s"]' % ann_key)
    check(page.locator('[aria-label="Post kind"] .seg-btn', has_text='Announcement').count() == 0, 'member sees the Announcement kind')
    check(page.locator('[aria-label="Post kind"] .seg-btn').count() == 4, 'member kinds must be Update, Win, Question, Poll')
    check(page.locator('#feed-stream button', has_text=PIN_RE).count() == 0, 'member sees a Pin button')
    check(page.locator('#feed-stream button', has_text='Delete').count() == 0, 'member sees Delete on posts by others')
    page.wait_for_selector('#feed-stream .card:has-text("Kaavish Ramchandani")')
    page.wait_for_selector('#feed-stream .card:has-text("Kudos to Durvesh Patil")')
    check(page.locator('#feed-stream .card').nth(0).get_attribute('data-key') == ann_key, 'pinned announcement must sort first for members')

    page.fill('#feed-text', WIN)
    page.locator('[aria-label="Post kind"] .seg-btn', has_text='Win').click()
    page.get_by_role('button', name='Post', exact=True).click()
    page.wait_for_selector('.toast:has-text("Posted")')
    page.wait_for_timeout(250)
    m1doc = feed_doc(page, 'u_m1')
    check(len(m1doc['posts']) == 1 and m1doc['posts'][0]['kind'] == 'win' and m1doc['posts'][0]['text'] == WIN, 'win post wrong: %r' % m1doc)
    win_key = 'u_m1:' + m1doc['posts'][0]['id']
    win_card = page.locator('#feed-stream .card[data-key="%s"]' % win_key)
    check(win_card.locator('.pill.ink', has_text='win').count() == 1, 'win ink pill missing')
    check(win_card.locator('button', has_text='Delete').count() == 1, 'author must get Delete')
    check(win_card.locator('button', has_text=PIN_RE).count() == 0, 'member must never get Pin')
    check(page.locator('#feed-stream .card').nth(0).get_attribute('data-key') == ann_key, 'pinned stays first')
    check(page.locator('#feed-stream .card').nth(1).get_attribute('data-key') == win_key, 'newest post follows the pinned one')
    page.wait_for_selector('#feed-stream .card[data-key="%s"]:has-text("Durvesh Patil")' % win_key)

    ann_card = page.locator('#feed-stream .card[data-key="%s"]' % ann_key)
    ann_card.locator('.emoji-btn', has_text='👀').click()
    page.wait_for_timeout(250)
    r1 = page.evaluate('window.__db.get("reacts/u_m1")')
    check(bool(r1) and r1['r'].get(ann_key) == '👀', 'member reaction missing: %r' % r1)
    check('1' in ann_card.locator('.emoji-btn', has_text='👀').inner_text(), 'member count missing')
    page.locator('[aria-label="Filter"] .seg-btn', has_text='Wins').click()
    page.wait_for_timeout(120)
    kinds = page.evaluate('[...document.querySelectorAll("#feed-stream .card")].map(c => c.dataset.kind)')
    check(kinds == ['win'], 'Wins filter wrong for member: %r' % kinds)
    page.locator('[aria-label="Filter"] .seg-btn', has_text='All').click()
    page.wait_for_timeout(120)
    layout(h, page, 'm1-1280', results)

    # ---- 390 wide: member, then founder with the drawer ----
    view(h, page, 'm1', 390)
    page.wait_for_selector('#feed-stream .card[data-key="%s"]' % win_key)
    check(page.locator('#feed-stream .card').count() == 6, 'expected 6 cards at 390')
    check(page.locator('[aria-label="Post kind"] .seg-btn', has_text='Announcement').count() == 0, 'member sees Announcement at 390')
    check(page.locator('#feed-stream button', has_text=PIN_RE).count() == 0, 'member sees Pin at 390')
    page.wait_for_selector('#feed-stream .card:has-text("Kudos to Durvesh Patil")')
    layout(h, page, 'm1-390', results)

    view(h, page, 'founder', 390)
    page.wait_for_selector('#feed-stream .card[data-key="%s"]' % ann_key)
    page.wait_for_selector('#feed-stream .card:has-text("Kaavish Ramchandani")')
    check(page.locator('#feed-stream .card').nth(0).locator('button', has_text=PIN_RE).inner_text() == 'Unpin', 'Unpin missing at 390')
    check(page.locator('#feed-stream .card[data-key="%s"] .emoji-btn.on' % ann_key).count() == 0, 'founder has no reaction on')
    check('1' in page.locator('#feed-stream .card[data-key="%s"] .emoji-btn' % ann_key).filter(has_text='👀').inner_text(), 'count from m1 missing')
    open_kudos(page)
    check('0 of 3 left this week' in page.locator('.drawer').inner_text(), 'cap line wrong at 390')
    h.shot(page, 'feed-founder-390-drawer')
    close_drawer(page)
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
