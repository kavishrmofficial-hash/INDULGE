#!/usr/bin/env python3
"""Pitches module checks: create, stage moves, founder finance, overdue, pitch project, won actions, phone width.

Run:  cd m360-os && M360_MODULES=23-pitches.js M360_TAG=pitches python3 harness/tests/test_pitches.py
The Start pitch project action calls M.projects.create, so this test adds 22-projects.js to the build
when M360_MODULES leaves it out. Prints PASS and exits 0 on success, prints FAIL and exits 1 otherwise.
"""
import os
import sys
import traceback
from datetime import date, timedelta

mods = [m.strip() for m in os.environ.get('M360_MODULES', '').split(',') if m.strip()]
if mods and '22-projects.js' not in mods:
    os.environ['M360_MODULES'] = ','.join(mods + ['22-projects.js'])

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

BRAND = 'Aurelia Jewels'
PITCH_SECTIONS = ['Research', 'Diagnostic', 'Strategy', 'Proposal', 'Follow-up']
RETAINER_SECTIONS = ['Plan', 'Create', 'Approve', 'Publish', 'Report']
FIN = 'data/users/u_founder/finance'


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def doc(page, path):
    return page.evaluate('p => window.__db.get(p) || null', path)


def docs_with_prefix(page, prefix):
    return page.evaluate('''pre => {
      const s = window.__db.store(); const out = {};
      for (const k of Object.keys(s)) if (k.startsWith(pre)) out[k.slice(pre.length)] = s[k];
      return out;
    }''', prefix)


def no_overflow(h, page, where, checks):
    ov = h.overflow(page)
    check(ov == 0, '%s: horizontal overflow %dpx' % (where, ov))
    st = h.small_text(page)
    check(not st, '%s: text under 11px %r' % (where, st[:3]))
    checks.append(where)


def open_card(page, brand):
    page.locator('.tcard', has_text=brand).first.click()
    page.wait_for_selector('.drawer')
    page.wait_for_timeout(150)


def close_drawer(page):
    page.keyboard.press('Escape')
    page.wait_for_selector('.drawer', state='detached')


def save(page):
    page.locator('.drawer-foot').get_by_role('button', name='Save', exact=True).click()
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(300)


def set_stage(page, label):
    page.locator('.drawer').get_by_role('tab', name=label, exact=True).click()
    page.wait_for_timeout(80)


def tile(page, tid):
    return page.locator('#' + tid + ' .v').inner_text().strip()


def other_page(h, page, ident, width, hash):
    p = page.context.new_page()
    p.set_viewport_size({'width': width, 'height': 900})
    p.set_default_timeout(8000)
    p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.goto(h.url(ident, hash))
    h.ready(p)
    p.wait_for_timeout(250)
    return p


def test(h):
    checks = []
    page = h.open('founder', width=1280, hash='#pitches', reset=True, seed=True)
    h.roster(page, ('u_m1', 'u_m2'))
    page.wait_for_timeout(250)
    check('Pitches' in page.locator('h1.pgt').inner_text(), 'page title')
    check(page.locator('.colm').count() == 7, 'seven stage columns')
    check(tile(page, 'kpi-weighted') == '₹0', 'weighted tile starts at zero, got %r' % tile(page, 'kpi-weighted'))
    check(tile(page, 'kpi-win') == 'no data', 'win rate tile reads no data without closed pitches')
    check(tile(page, 'kpi-overdue') == '0', 'overdue tile starts at 0')
    check(page.locator('#stage-counts .pill', has_text='Lead 0').count() == 1, 'stage count pill Lead 0')
    stages = h.ctx(page, 'M.pitches.STAGES.map(s => s.v + ":" + s.prob).join(",")')
    check(stages == 'lead:10,qualified:25,diagnostic:40,proposal:55,negotiation:75,won:100,lost:0', 'STAGES export: ' + stages)
    no_overflow(h, page, 'empty board 1280', checks)

    # 1. create a pitch through the drawer
    page.get_by_role('button', name='New pitch').click()
    page.wait_for_selector('.drawer')
    page.fill('#pitch-brand', BRAND)
    page.fill('#pitch-category', 'Fine jewellery')
    page.fill('#pitch-contact', 'Meera Shah, marketing head')
    page.fill('#pitch-source', 'Referral')
    page.select_option('#pitch-owner', 'u_founder')
    no_overflow(h, page, 'new pitch drawer 1280', checks)
    page.get_by_role('button', name='Create pitch').click()
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(300)
    pitches = docs_with_prefix(page, 'pitches/')
    check(len(pitches) == 1, 'one pitch stored, found %d' % len(pitches))
    pid, p = list(pitches.items())[0]
    check(p['brand'] == BRAND and p['category'] == 'Fine jewellery' and p['contact'] == 'Meera Shah, marketing head' and p['source'] == 'Referral', 'pitch text fields')
    check(p['stage'] == 'lead' and p['stageAt'] > 0 and p['owner'] == 'u_founder', 'stage lead, stageAt, owner')
    check(p['next'] == '' and p['nextDate'] == '' and p['project'] == '' and p['lost'] == '', 'empty next, nextDate, project, lost')
    check(p['created'] > 0 and p['updated'] == p['created'], 'created and updated stamps')
    check(page.locator('.colm[data-stage="lead"] .tcard', has_text=BRAND).count() == 1, 'card in the Lead column')
    check('0 days in stage' in page.locator('.colm[data-stage="lead"]').inner_text(), 'days in stage on the card')
    check(page.locator('#stage-counts .pill', has_text='Lead 1').count() == 1, 'stage count pill Lead 1')
    check('1 in play' in page.inner_text('.page-head'), 'page micro counts the open pitch')

    # 2. move the stage through the Seg, saving each time; stageAt increases every move
    prev = p['stageAt']
    for v, label in (('qualified', 'Qualified'), ('diagnostic', 'Diagnostic'), ('proposal', 'Proposal sent'), ('negotiation', 'Negotiation')):
        open_card(page, BRAND)
        set_stage(page, label)
        save(page)
        p = doc(page, 'pitches/' + pid)
        check(p['stage'] == v, 'stage %s stored' % v)
        check(p['stageAt'] > prev, 'stageAt increased on %s (%d > %d)' % (v, p['stageAt'], prev))
        check(p['updated'] >= p['stageAt'], 'updated stamped with the save')
        prev = p['stageAt']
        check(page.locator('.colm[data-stage="%s"] .tcard' % v, has_text=BRAND).count() == 1, 'card moved to %s' % label)
    # saving without a stage change keeps stageAt
    open_card(page, BRAND)
    page.fill('#pitch-next', 'Send the deck')
    save(page)
    p = doc(page, 'pitches/' + pid)
    check(p['stageAt'] == prev and p['next'] == 'Send the deck', 'stageAt kept when the stage is unchanged')
    check('Send the deck' in page.locator('.colm[data-stage="negotiation"]').inner_text(), 'next step on the card')

    # 3. founder finance: value 100000, prob blank, weighted 75% at negotiation
    open_card(page, BRAND)
    page.fill('#pitch-value', '100000')
    page.fill('#pitch-prob', '')
    save(page)
    fin = doc(page, FIN)
    check(fin is not None and fin['pitch'][pid]['value'] == 100000, 'finance value stored: %r' % fin)
    check(fin['pitch'][pid].get('prob') is None, 'blank prob stored as null')
    check(tile(page, 'kpi-weighted') == '₹75,000', 'weighted tile at negotiation: %r' % tile(page, 'kpi-weighted'))
    check(page.locator('.colm[data-stage="negotiation"] .tcard', has_text='₹1,00,000').count() == 1, 'monthly value on the card')
    m = h.ctx(page, 'M.pitches.metrics(ctx)')
    check(m['weighted'] == 75000 and m['byStage']['negotiation'] == {'count': 1, 'value': 100000} and m['winRate90'] is None and m['overdue'] == [], 'metrics(): %r' % m)
    check(m['byStage']['lead'] == {'count': 0, 'value': 0}, 'byStage carries every stage')
    # probability override wins over the stage default
    open_card(page, BRAND)
    page.fill('#pitch-prob', '50')
    save(page)
    check(doc(page, FIN)['pitch'][pid]['prob'] == 50, 'prob override stored')
    check(tile(page, 'kpi-weighted') == '₹50,000', 'weighted tile with the override: %r' % tile(page, 'kpi-weighted'))
    open_card(page, BRAND)
    check(page.input_value('#pitch-prob') == '50', 'override prefilled in the drawer')
    page.fill('#pitch-prob', '')
    save(page)
    check(doc(page, FIN)['pitch'][pid]['prob'] is None and tile(page, 'kpi-weighted') == '₹75,000', 'override cleared')
    no_overflow(h, page, 'board with a pitch 1280', checks)

    # 4. next date last week: flame date on the card, overdue tile 1
    last_week = (date.today() - timedelta(days=7)).isoformat()
    open_card(page, BRAND)
    page.fill('#pitch-nextdate', last_week)
    save(page)
    p = doc(page, 'pitches/' + pid)
    check(p['nextDate'] == last_week, 'nextDate stored')
    fmt = h.ctx(page, 'U.fmtDay(%r)' % last_week)
    card = page.locator('.colm[data-stage="negotiation"] .tcard', has_text=BRAND)
    check(card.locator('.flame-t', has_text=fmt).count() == 1, 'overdue next date in flame on the card')
    check(tile(page, 'kpi-overdue') == '1', 'overdue tile 1')
    check(page.locator('#kpi-overdue .v.flame-t').count() == 1, 'overdue tile value in flame')
    check(h.ctx(page, 'M.pitches.metrics(ctx).overdue') == [pid], 'metrics().overdue lists the pitch')

    # 5. start a pitch project, linked both ways
    open_card(page, BRAND)
    page.locator('.drawer-foot').get_by_role('button', name='Start pitch project').click()
    page.wait_for_timeout(500)
    p = doc(page, 'pitches/' + pid)
    check(bool(p['project']), 'pitch stores its project id')
    proj = doc(page, 'projects/' + p['project'])
    check(proj is not None and proj['pitch'] == pid, 'project stores the pitch id')
    check(proj['kind'] == 'pitch' and proj['name'] == BRAND + ' pitch' and proj['owner'] == 'u_founder', 'project kind, name, owner')
    check([s['name'] for s in proj['sections']] == PITCH_SECTIONS, 'pitch template sections: %r' % [s['name'] for s in proj['sections']])
    check(page.locator('.drawer-foot').get_by_role('button', name='Start pitch project').count() == 0, 'start button gone once linked')
    check(page.locator('.drawer').get_by_role('button', name=BRAND + ' pitch').count() == 1, 'project link button in the drawer')
    page.locator('.drawer').get_by_role('button', name=BRAND + ' pitch').click()
    page.wait_for_function("() => /^#projects\\/.+/.test(location.hash)")
    page.wait_for_timeout(250)
    check(page.evaluate('location.hash') == '#projects/' + p['project'], 'project link navigates to the project page')
    check(BRAND + ' pitch' in page.locator('h1.pgt').inner_text(), 'project page opens')
    no_overflow(h, page, 'linked project page 1280', checks)
    page.evaluate("location.hash = '#pitches'")
    page.wait_for_timeout(300)

    # 6. lost reason shows only when Lost is picked
    open_card(page, BRAND)
    check(page.locator('#pitch-lost').count() == 0, 'lost reason hidden while in play')
    set_stage(page, 'Lost')
    check(page.locator('#pitch-lost').count() == 1, 'lost reason shown on Lost')
    set_stage(page, 'Negotiation')
    check(page.locator('#pitch-lost').count() == 0, 'lost reason hidden again')
    check(page.locator('.drawer-foot').get_by_role('button', name='Create client page').count() == 0, 'no client action before Won')
    close_drawer(page)

    # 7. Won: create the client page from the drawer
    open_card(page, BRAND)
    set_stage(page, 'Won')
    save(page)
    p = doc(page, 'pitches/' + pid)
    check(p['stage'] == 'won' and p['stageAt'] > prev, 'won stored with a fresh stageAt')
    check(page.locator('.colm[data-stage="won"] .tcard', has_text=BRAND).count() == 1, 'card in the Won column')
    check(tile(page, 'kpi-weighted') == '₹0', 'won pitch leaves the weighted pipeline')
    check(tile(page, 'kpi-win') == '100%', 'win rate 100% after one win: %r' % tile(page, 'kpi-win'))
    check(tile(page, 'kpi-overdue') == '0', 'won pitch is no longer overdue')
    check('0 in play' in page.inner_text('.page-head'), 'page micro drops the won pitch')
    open_card(page, BRAND)
    check(page.locator('.drawer .pill.ink', has_text='Won').count() == 1, 'won pill in ink in the drawer head')
    check(page.locator('.drawer-foot').get_by_role('button', name='Create retainer project').count() == 1, 'retainer action offered on Won')
    page.locator('.drawer-foot').get_by_role('button', name='Create client page').click()
    page.wait_for_function("() => location.hash === '#clients'")
    page.wait_for_timeout(300)
    clients = docs_with_prefix(page, 'clients/')
    mine = [(cid, c) for cid, c in clients.items() if c['name'] == BRAND]
    check(len(mine) == 1, 'one client named after the brand, found %d' % len(mine))
    cid, c = mine[0]
    check(c['status'] == 'live' and c['pod'] == '' and c['owner'] == 'u_founder' and c['by'] == 'u_founder', 'client status, pod, owner, by')
    check(c['memory'] == '' and c['approvals'] == '' and c['never'] == '' and c['links'] == '' and c['updated'] > 0, 'client brain fields start empty')
    check(doc(page, FIN)['clients'][cid]['monthly'] == 100000, 'client monthly prefilled from the pitch value')
    check(doc(page, FIN)['pitch'][pid]['value'] == 100000, 'pitch finance entry kept')

    # 8. back on pitches: the client exists now, so the drawer links to it; retainer project from the template
    page.evaluate("location.hash = '#pitches'")
    page.wait_for_timeout(300)
    open_card(page, BRAND)
    check(page.locator('.drawer-foot').get_by_role('button', name='Open client page').count() == 1, 'client link once the page exists')
    page.locator('.drawer-foot').get_by_role('button', name='Create retainer project').click()
    page.wait_for_function("() => /^#projects\\/.+/.test(location.hash)")
    page.wait_for_timeout(300)
    rid = page.evaluate('location.hash.split("/")[1]')
    r = doc(page, 'projects/' + rid)
    check(r is not None and r['kind'] == 'client' and r['client'] == cid and r['name'] == BRAND + ' retainer', 'retainer project kind, client, name')
    check([s['name'] for s in r['sections']] == RETAINER_SECTIONS, 'retainer template sections')
    no_overflow(h, page, 'retainer project page 1280', checks)

    # 9. phone width: the board scrolls inside its card, no page overflow
    page.evaluate("location.hash = '#pitches'")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    no_overflow(h, page, 'board 390', checks)
    scroll = page.evaluate('() => { const b = document.querySelector(".board-wrap"); return [b.scrollWidth, b.clientWidth]; }')
    check(scroll[0] > scroll[1], 'board scrolls inside its card at 390: %r' % scroll)
    page.get_by_role('button', name='New pitch').click()
    page.wait_for_selector('.drawer')
    page.wait_for_timeout(200)
    no_overflow(h, page, 'new pitch drawer 390', checks)
    close_drawer(page)
    open_card(page, BRAND)
    no_overflow(h, page, 'pitch drawer 390', checks)
    close_drawer(page)
    h.shot(page, 'pitches-390')

    # 10. a member sees the board, no metrics bar and no value
    page.set_viewport_size({'width': 1280, 'height': 900})
    m1 = other_page(h, page, 'm1', 1280, '#pitches')
    check('Pitches' in m1.locator('h1.pgt').inner_text(), 'member opens pitches')
    check(m1.locator('.kpi-rail').count() == 0, 'no metrics bar for a member')
    check(m1.locator('.tcard', has_text=BRAND).count() == 1, 'member sees the card')
    check('₹' not in m1.inner_text('body'), 'no value shown to a member')
    mm = h.ctx(m1, 'M.pitches.metrics(ctx)')
    check(mm['weighted'] == 0 and mm['byStage']['won'] == {'count': 1, 'value': 0}, 'metrics without the finance doc counts value 0')
    open_card(m1, BRAND)
    check(m1.locator('#pitch-value').count() == 0 and m1.locator('#pitch-prob').count() == 0, 'founder fields hidden from a member')
    close_drawer(m1)
    no_overflow(h, m1, 'member board 1280', checks)
    # a member creates a pitch owned by themselves
    m1.get_by_role('button', name='New pitch').click()
    m1.fill('#pitch-brand', 'Casa Verde Hotels')
    m1.get_by_role('button', name='Create pitch').click()
    m1.wait_for_selector('.drawer', state='detached')
    m1.wait_for_timeout(300)
    theirs = [x for x in docs_with_prefix(m1, 'pitches/').values() if x['brand'] == 'Casa Verde Hotels']
    check(len(theirs) == 1 and theirs[0]['owner'] == 'u_m1' and theirs[0]['stage'] == 'lead', 'member pitch owned by the member')
    check(m1.locator('.colm[data-stage="lead"] .tcard', has_text='Casa Verde Hotels').count() == 1, 'member pitch on the board')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    return checks


if __name__ == '__main__':
    try:
        checks = run(test)
    except Exception:
        traceback.print_exc()
        print('FAIL')
        sys.exit(1)
    print('overflow and text size checked on: ' + ', '.join(checks))
    print('PASS')
