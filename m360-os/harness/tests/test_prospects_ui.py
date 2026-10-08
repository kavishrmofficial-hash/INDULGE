#!/usr/bin/env python3
"""v34 test: the Prospects surfaces (src/js/26-prospects-ui.js and the folds it adds to Home, the inbox, the pitch
drawer, the Base contact drawer and the CRM).

A frozen Mon 5 Oct 2026 10:00 IST on the claude.ai mock, as Kaavish, with six people tracked (one late, one due
today, one with a meeting and a date this week, one waiting on them, one with no next step, one quiet), an own
reminder, a shared send on the Swisse pitch and a COO draft on it. Checks:
- the Prospects page: the capture line, the count line, the groups late, today, meetings, this week, waiting,
  no next step and quiet with their rows, the row anatomy (who, org, the date chip, a pitch chip), the People
  view with search, the Sent view with reply chips, the remembered view, the privacy footer;
- the person page: the live name from the Base, the contact actions, the next step card with Done, Snooze,
  Change and the mirror toggle, the timeline with the shared send marked, Open in the Base, Stop tracking;
- Home: fold-followups sits right after fold-focus in the left column, fold-studio stays in the right one, the
  rows read late first with their buttons, the capture line last;
- the inbox: kind follow is silent, hot when late, and quiet with the COO's draft on the same pitch;
- the pitch drawer: the Sent fold and its rows, Add a send, the private notes fold, the card line on the board,
  and next and next date on a new pitch;
- the Base contact drawer: Your conversations, Track this person with "When do you next talk", pitch links to
  #pitches/<id>; the CRM: a pitch-only row opens its pitch;
- 390 wide with no sideways scroll, dark mode, screenshots.
Then on the team site (edgeone/dev/server.mjs): the pitch drawer shows the contact's name, never 'c_...'.
window.__sampleCalls stays empty.

Fails until builders 1 and 2 are merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_ui.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
MON = datetime(2026, 10, 5, 10, 0, tzinfo=IST)
NOW = int(MON.timestamp() * 1000)
DAY = 86400000
IX = 'data/users/u_founder/prospects'
SHOTS = os.environ.get('PROS_SHOTS') or os.path.join(ROOT, 'harness', 'shots', 'prospects')


def contact(cid, first, last, title, mail):
    return {'id': cid, 'first': first, 'last': last, 'name': first + ' ' + last, 'title': title, 'email': mail, 'email2': '', 'phone': '', 'mobile': '+971500000001', 'linkedin': '',
            'org': 'o2', 'orgName': 'Swisse Wellness UAE', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'seniority': 'head', 'dept': 'marketing', 'source': 'manual', 'apolloId': '', 'tags': [],
            'stage': 'lead', 'owner': F, 'notes': '', 'edited': {}, 'at': NOW - 30 * DAY, 'updated': NOW - 30 * DAY, 'updatedBy': F, 'archived': False}


ORG = {'id': 'o2', 'name': 'Swisse Wellness UAE', 'domain': 'swisse.ae', 'website': '', 'industry': 'Wellness', 'size': '', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'linkedin': '', 'phone': '',
       'keywords': [], 'source': 'manual', 'apolloId': '', 'client': '', 'tags': [], 'notes': '', 'edited': {}, 'at': NOW - 30 * DAY, 'updated': NOW - 30 * DAY, 'updatedBy': F, 'archived': False}


def person(who, org, pi, cid='', last_days=2):
    return {'cid': cid, 'oid': 'o2' if cid else '', 'who': who, 'org': org, 'role': 'Brand head' if cid else '', 'pi': [pi] if pi else [], 'st': '', 'last': {'at': NOW - last_days * DAY, 'k': 'talk'}, 'mo': ['2026-10'], 'at': NOW - 40 * DAY, 'up': NOW - last_days * DAY}


def fu(p, pi, d, x, t='', said='', after='', **k):
    return {'p': p, 'pi': pi, 'x': x, 'd': d, 't': t, 'after': after, 'said': said, 'src': 'typed', 'at': NOW - 2 * DAY, **k}


def mock_part(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(MON)
    p = c.new_page()
    p.set_default_timeout(20000)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)

    def go(hash, ident='founder', width=None):
        if width:
            p.set_viewport_size({'width': width, 'height': 900})
        p.goto(h.url(ident, hash, noai=True))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.prospects && M.lastCtx.activeMembers.length >= 3 && M.lastCtx.priv.prospects.ready)')
        p.wait_for_timeout(400)

    doc = lambda path: p.evaluate('k => window.__db.get(k)', path)  # noqa: E731

    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    if not p.evaluate('() => !!(M.prospects && M.pages.Prospects && M.parts.FollowupsToday)'):
        raise AssertionError('the Prospects page is not on the build: this test runs once builders 1 and 2 are merged')
    h.roster(p, [M1, M2, M3])
    base = {'category': '', 'contact': '', 'source': '', 'updated': NOW, 'stageAt': NOW - 5 * DAY, 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': NOW - 5 * DAY}
    h.seed_doc(p, 'pitches/pt_tata', {**base, 'brand': 'Tata', 'owner': F, 'stage': 'qualified'})
    # the pitch names its Base company (org), so the contact drawer lists it under Where they appear
    h.seed_doc(p, 'pitches/pt_swisse', {**base, 'brand': 'Swisse', 'owner': M1, 'stage': 'proposal', 'contact': 'c_meera', 'org': 'o2',
                                         'sent': {'sd1': {'to': 'c_meera', 'via': 'mail', 'what': 'Proposal v2', 'link': '', 'at': NOW - 3 * DAY, 'by': M1, 'reply': '', 'replyAt': 0}}})
    h.seed_doc(p, 'pitches/pt_nykaa', {**base, 'brand': 'Nykaa', 'owner': F, 'stage': 'lead'})
    h.seed_doc(p, 'pitches/pt_lone', {**base, 'brand': 'Bira', 'owner': F, 'stage': 'lead'})
    h.seed_doc(p, 'contacts/p000', {'rows': {'c_meera': contact('c_meera', 'Meera', 'Shah', 'Brand head', 'meera@swisse.ae'), 'c_omar': contact('c_omar', 'Omar', 'Haddad', 'Brand director', 'omar@swisse.ae')}, 'n': 2})
    h.seed_doc(p, 'orgs/p000', {'rows': {'o2': ORG}, 'n': 1})
    h.seed_doc(p, IX, {'v': 1, 'prefs': {'mirror': True},
                       'people': {'pp1': person('Meera Shah', 'Swisse Wellness UAE', 'pt_swisse', 'c_meera'), 'pp2': person('Rahul', 'Tata', 'pt_tata'), 'pp3': person('Priya', 'Nykaa', 'pt_nykaa'),
                                  'pp4': person('Kavya', 'Lakme', ''), 'pp5': person('Anil', 'Titan', '', '', 25), 'pp6': person('Riya', 'Bira', '', '', 40)},
                       'fu': {'fu1': fu('pp1', 'pt_swisse', '2026-10-03', 'talk after the 2nd', '', 'after the 2nd', '2026-10-02'),
                              'fu2': fu('pp2', 'pt_tata', '2026-10-05', 'chase the deck', '15:00'),
                              'fu3': fu('pp3', 'pt_nykaa', '2026-10-08', 'call back'),
                              'fu4': fu('pp4', '', '2026-10-20', 'talk after the 19th', '', 'after the 19th', '2026-10-19'),
                              'fuown': fu('', '', '2026-10-05', 'Renew the domain', src='remind')},
                       'meet': {'mt1': {'p': 'pp3', 'pi': 'pt_nykaa', 'd': '2026-10-07', 't': '16:00', 'where': 'Lakme office', 'x': 'meeting with Priya', 'at': NOW - 2 * DAY}}})
    h.seed_doc(p, 'data/users/u_founder/prospects.2026-10', {'t': {'tt1': {'p': 'pp1', 'pi': 'pt_swisse', 'k': 'call', 'x': 'Spoke to Meera about the deck', 'at': NOW - 2 * DAY}}})
    card = {'id': 'c_mail', 'kind': 'client_mail', 'rung': 'draft', 'title': 'Drafted a follow-up to Swisse. It waits for your tap.', 'code': 'client_mail', 'args': {}, 'why': '', 'recommend': '', 'checks': [], 'options': [], 'sources': [],
            'payload': {'action': '', 'input': {}, 'draft': {'to': 'meera@swisse.ae', 'cc': '', 'subject': 'Following up on the Swisse proposal', 'text': 'Hi Meera, a quick follow-up on our proposal.'}},
            'refs': {'pitch': 'pt_swisse'}, 'dedupe': 'client_mail:pitch:pt_swisse', 'urgent': False, 'by': 'u_m360coo', 'at': NOW - 3600000, 'expires': NOW + 3 * DAY, 'status': 'open', 'money': False}
    h.seed_doc(p, 'coo/dec', {'items': {'c_mail': card}})
    p.wait_for_timeout(300)

    # ---- the page ----
    go('#prospects')
    p.wait_for_selector('#pros-capture-in')
    check('Private to you' in p.inner_text('.pagehead, .page-head, h1, main') or p.locator('text=Private to you').count() > 0, 'the page says it is private')
    check(p.inner_text('#pros-count').strip() == '2 today, 1 late, 1 meeting this week', 'the count line counts the own reminder too: %r' % p.inner_text('#pros-count'))
    groups = {}
    for g in ('late', 'today', 'meet', 'thisweek', 'waiting', 'loose', 'quiet'):
        groups[g] = p.evaluate('g => [...document.querySelectorAll("#pros-" + g + " .pros-row")].map(r => r.dataset.pid || r.dataset.fid)', g)
    check(groups['late'] == ['pp1'] and groups['today'] == ['fuown', 'pp2'] and groups['meet'] == ['pp3'] and groups['thisweek'] == ['pp3'] and groups['waiting'] == ['pp4'] and groups['loose'] == ['pp5'] and groups['quiet'] == ['pp6'],
          'the groups hold the right rows, today by time (the 10:00 reminder before the 15:00 call): %r' % groups)
    late = p.locator('#pros-late .pros-row[data-pid="pp1"]')
    txt = late.inner_text()
    check('Meera Shah' in txt and 'days late, since Sat 3 Oct' in txt, 'the late row names the person and the days: %r' % txt)
    check(late.locator('.pros-who').count() == 1 and late.locator('a[href="#pitches/pt_swisse"], button').count() >= 1, 'who in bold and a pitch chip')
    heights = p.evaluate('() => [...document.querySelectorAll("#pros-week .pros-row")].map(r => r.getBoundingClientRect().height)')
    check(heights and min(heights) >= 56, 'rows are at least 56px: %r' % heights)
    waiting = p.inner_text('#pros-waiting')
    check('after Mon 19 Oct' in waiting, 'waiting reads the after date: %r' % waiting)
    check(p.locator('#pros-loose .chip, #pros-loose button').count() >= 2, 'no next step rows carry chips')
    foot = p.inner_text('.pros-foot')
    check('Only you see this list. Your team sees the pitch, the stage and where it was sent.' in foot and p.locator('#pros-export').count() == 1, 'the privacy footer and the export: %r' % foot)
    os.makedirs(SHOTS, exist_ok=True)
    p.screenshot(path=os.path.join(SHOTS, 'prospects-1280.png'), full_page=True)
    # People and Sent
    p.get_by_role('radio', name='People').or_(p.locator('#pros-seg button', has_text='People')).first.click()
    p.wait_for_selector('#pros-people')
    p.fill('#pros-q', 'rahul')
    p.wait_for_timeout(300)
    rows = p.evaluate('() => [...document.querySelectorAll("#pros-people .pros-row")].map(r => r.dataset.pid)')
    check(rows == ['pp2'], 'the People search finds Rahul: %r' % rows)
    p.locator('#pros-seg button', has_text='Sent').first.click()
    p.wait_for_selector('#pros-sent')
    mine = p.inner_text('#pros-sent')
    check('The team sees this' in mine and p.locator('#pros-sent .sent-row').count() == 0, 'the Sent view opens on Mine, and Durvesh\'s send is not the founder\'s: %r' % mine[:200])
    p.locator('#pros-sent button', has_text='Everyone').first.click()
    p.wait_for_selector('#pros-sent .sent-row')
    sent = p.inner_text('#pros-sent')
    check('Proposal v2' in sent and p.locator('#pros-sent .sent-row').count() == 1, 'Everyone lists the shared send: %r' % sent[:200])
    check(p.locator('#pros-sent .chip, #pros-sent button', has_text='Replied').count() >= 1, 'the reply chips')
    check(p.evaluate('() => M.prefs.get("prosView", "")') == 'sent', 'the view is remembered')
    p.locator('#pros-seg button', has_text='This week').first.click()

    # ---- the person page ----
    go('#prospects/pp1')
    p.wait_for_selector('#person-drawer[data-pid="pp1"]')
    head = p.inner_text('#person-drawer')
    check('Meera Shah' in head and 'Brand head' in head and 'late' in head.lower(), 'the person head with the live Base name and a status: %r' % head[:160])
    check(p.locator('#person-contact a[href^="mailto:"]').count() == 1 and p.locator('#person-contact a[href^="tel:"], #person-contact a[href*="wa.me"]').count() >= 1, 'contact actions from the Base row')
    nxt = p.inner_text('#person-next')
    check('Sat 3 Oct' in nxt and 'You said after the 2nd' in nxt and p.locator('#person-next .fu-done').count() == 1 and p.locator('#person-next .fu-snooze').count() == 1 and p.locator('#person-next .fu-change').count() == 1, 'the next step card: %r' % nxt)
    check(p.locator('#person-mirror').count() == 1 and 'The team sees the date' in nxt, 'the mirror toggle for a pitch-linked follow-up')
    # the month log arrives a moment after the drawer: wait for the touch, then read the whole timeline
    p.wait_for_function('() => /Spoke to Meera about the deck/.test((document.querySelector("#person-timeline") || {}).textContent || "")')
    tl = p.inner_text('#person-timeline')
    check('Spoke to Meera about the deck' in tl and 'Proposal v2' in tl and p.locator('#person-timeline .pros-tl.shared').count() == 1, 'the timeline merges the shared send: %r' % tl[:200])
    check(p.locator('#person-base').count() == 1 and p.locator('#person-capture-in').count() == 1 and p.get_by_role('button', name='Stop tracking').count() == 1, 'Open in the Base, the capture line and Stop tracking')
    p.screenshot(path=os.path.join(SHOTS, 'person-1280.png'))

    # ---- Home (checked in, so the day's folds render under the hero) ----
    h.seed_doc(p, 'checkin/' + F, {'days': {'2026-10-05': {'in': NOW - 20 * 60000, 'out': None, 'mode': 'office', 'loc': {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}, 'outLoc': None}}})
    # the folds carry their ids on the phone (UI.Fold is a plain card on a desktop): the order is checked at 390
    go('#home', width=390)
    p.wait_for_selector('#fold-followups')
    # a hot fold sits inside the fx beam's host, so each fold is taken up to the stack's own child
    order = p.evaluate('''() => { const q = s => document.querySelector(s); const focus = q("#fold-focus"), follow = q("#fold-followups"), studio = q("#fold-studio");
      const col = focus && focus.parentElement; const top = el => { let x = el; while (x && x.parentElement !== col) x = x.parentElement; return x; };
      const kids = col ? [...col.children] : []; return {fi: kids.indexOf(top(focus)), si: kids.indexOf(top(follow)), ids: kids.map(x => x.id || x.className), studio: studio && col ? !col.contains(studio) : "none"}; }''')
    check(order['fi'] >= 0 and order['si'] == order['fi'] + 1, 'fold-followups sits right after fold-focus: %r' % order)
    check(order['studio'] is True, 'fold-studio stays in the other column: %r' % order['studio'])
    summary = p.inner_text('#fold-followups .fold-sum')
    check(summary.strip() == '2 today, 1 late', 'the fold summary counts today and late (the meeting is on Wednesday): %r' % summary)
    p.screenshot(path=os.path.join(SHOTS, 'home-followups-390.png'))
    go('#home', width=1280)
    p.wait_for_selector('#followups-card')
    rows = p.evaluate('() => [...document.querySelectorAll("#followups-card .fu-row")].map(r => [r.dataset.fid, r.dataset.late || r.dataset.kind || ""])')
    check(rows[0] == ['fu1', '1'] and ['fu2', '0'] in rows and ['fuown', '0'] in rows, 'late first, then today: %r' % rows)
    check(p.locator('#followups-card .fu-done').count() >= 2 and p.locator('#followups-card .fu-snooze').count() >= 2 and p.locator('#home-capture-in').count() == 1, 'row buttons and the capture line')
    p.screenshot(path=os.path.join(SHOTS, 'home-followups-1280.png'))

    # ---- the inbox ----
    items = p.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "follow").map(i => ({id: i.id, silent: i.silent, hot: i.hot, plain: typeof i.plain === "function" ? i.plain(() => "") : i.plain, ref: i.ref}))')
    by = {i['id']: i for i in items}
    check('fu:fu1:2026-10-03' in by and 'fu:fuown:2026-10-05' in by and 'fu:fu2:2026-10-05' not in by, 'the due and late ones are in, the 15:00 one is not yet: %r' % sorted(by))
    check(all(i['silent'] for i in items), 'follow items are silent')
    one = by['fu:fu1:2026-10-03']
    check(one['plain'].endswith('The COO has a draft for this too.') and not one['hot'], 'the COO dedupe line, not hot: %r' % one)
    check(by['fu:fuown:2026-10-05']['plain'].startswith('Renew the domain') and by['fu:fuown:2026-10-05']['ref'] == '#prospects', 'an own reminder reads its words')
    h.seed_doc(p, 'coo/dec', {'items': {'c_mail': {**card, 'status': 'done'}}})
    p.wait_for_timeout(400)
    hot = p.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "follow" && i.id === "fu:fu1:2026-10-03").map(i => i.hot)')
    check(hot == [True], 'without the COO card the late one is hot: %r' % hot)

    # ---- the pitch drawer and the board ----
    go('#pitches')
    p.wait_for_selector('.pitch-sent-line')
    line = p.inner_text('.pitch-sent-line')
    check('Meera' in line and 'no reply' in line and 'c_' not in line, 'the card line reads the latest send with a name: %r' % line)
    go('#pitches/pt_swisse')
    p.wait_for_selector('#pitch-sent')
    sent = p.inner_text('#pitch-sent')
    check('Proposal v2' in sent and p.locator('#pitch-sent .sent-row').count() == 1 and p.locator('#pitch-add-send').count() == 1, 'the Sent fold: %r' % sent[:200])
    notes = p.inner_text('#pitch-notes')
    check('Spoke to Meera about the deck' in notes and p.locator('#pitch-notes .fu-done').count() == 1 and p.locator('#pitch-capture-in').count() == 1, 'the private notes fold: %r' % notes[:200])
    check(p.inner_text('#pitch-contact-name').startswith('Meera Shah'), 'the contact resolves to a name: %r' % p.inner_text('#pitch-contact-name'))
    p.locator('#pitch-add-send').click()
    p.wait_for_selector('#pitch-send-what')
    p.fill('#pitch-send-what', 'Case studies')
    p.locator('#pitch-send-save').click()
    p.wait_for_function('() => Object.keys((window.__db.get("pitches/pt_swisse") || {}).sent || {}).length === 2')
    p.keyboard.press('Escape')
    p.evaluate('() => M.intend("#pitches", "pitch")')
    p.wait_for_selector('#pitch-brand')
    check(p.locator('#pitch-next').count() == 1 and p.locator('#pitch-nextdate').count() == 1, 'a new pitch shows next and next date')
    p.keyboard.press('Escape')

    # ---- the Base contact drawer and the CRM ----
    go('#base/c_meera')
    p.wait_for_selector('#contact-conversations')
    conv = p.inner_text('#contact-conversations')
    check('Spoke to Meera about the deck' in conv and 'Sat 3 Oct' in conv and p.locator('#contact-capture-in').count() == 1, 'Your conversations on the contact: %r' % conv[:200])
    # the pitch row's own link (the org link reads "at Swisse Wellness UAE"), pressed in place
    p.locator('button.linky:text-is("Swisse")').first.evaluate('b => b.click()')
    p.wait_for_function('() => location.hash === "#pitches/pt_swisse"')
    check(True, 'the pitch link opens #pitches/<id>')
    go('#base/c_omar')
    p.wait_for_selector('#contact-track')
    p.locator('#contact-track').click()
    p.wait_for_function('() => Object.values((window.__db.get("data/users/u_founder/prospects") || {}).people || {}).some(x => x && x.cid === "c_omar")')
    p.wait_for_selector('text=When do you next talk?')
    p.locator('#contact-conversations button', has_text='Tomorrow').first.click()
    p.wait_for_function('() => Object.values((window.__db.get("data/users/u_founder/prospects") || {}).fu || {}).some(f => f && !f.done && f.d === "2026-10-06")')
    omar = [x for x in doc(IX)['people'].values() if x.get('cid') == 'c_omar'][0]
    check(omar['who'] == 'Omar Haddad' and omar['org'] == 'Swisse Wellness UAE' and 'email' not in omar, 'Track creates the person with caches only: %r' % omar)
    go('#crm')
    p.wait_for_selector('.crm-row')
    p.locator('.crm-row', has_text='Bira').first.click()
    p.wait_for_function('() => location.hash === "#pitches/pt_lone"')
    check(True, 'a pitch-only CRM row opens its pitch')

    # ---- 390 and dark ----
    go('#prospects', width=390)
    p.wait_for_selector('#pros-capture-in')
    check(h.overflow(p) <= 0, 'no sideways scroll at 390: %d' % h.overflow(p))
    check(p.evaluate('() => parseFloat(getComputedStyle(document.querySelector("#pros-capture-in")).fontSize)') >= 16, 'the capture input is 16px on the phone')
    small = h.small_text(p)
    check(not small, 'no text under 11px: %r' % small[:3])
    p.screenshot(path=os.path.join(SHOTS, 'prospects-390.png'), full_page=True)
    go('#prospects/pp1', width=390)
    p.wait_for_selector('#person-drawer')
    check(h.overflow(p) <= 0, 'the person sheet fits 390')
    p.screenshot(path=os.path.join(SHOTS, 'person-390.png'))
    p.set_viewport_size({'width': 1280, 'height': 900})
    go('#prospects')
    light = p.evaluate('() => getComputedStyle(document.body).backgroundColor')
    p.emulate_media(color_scheme='dark')
    p.wait_for_timeout(400)
    dark = p.evaluate('() => getComputedStyle(document.body).backgroundColor')
    late_colour = p.evaluate('() => getComputedStyle(document.querySelector("#pros-late .pros-row")).color')
    check(light != dark and late_colour, 'dark mode comes through the tokens: %r vs %r' % (light, dark))
    p.screenshot(path=os.path.join(SHOTS, 'prospects-1280-dark.png'), full_page=True)
    p.emulate_media(color_scheme='light')
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call anywhere')
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    return checks


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def site_part():
    """the team site: the pitch drawer shows the Base contact's name through the server, never its id"""
    from playwright.sync_api import sync_playwright
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    build_edgeone.main()
    port = free_port()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    for _ in range(50):
        try:
            urllib.request.urlopen(base, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
            f = ctx.new_page()
            f.set_default_timeout(15000)
            errors = []
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'prospects-ui-test-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            fuid = f.evaluate('() => window.M360_API("me").then(x => x.uid)')
            f.evaluate('([o, c]) => Promise.all([window.M360_API("write", {op: "set", path: "orgs/p000", data: {rows: {o2: o}, n: 1}}), window.M360_API("write", {op: "set", path: "contacts/p000", data: {rows: {c_meera: c}, n: 1}})])',
                       [ORG, contact('c_meera', 'Meera', 'Shah', 'Brand head', 'meera@swisse.ae')])
            now = int(time.time() * 1000)
            f.evaluate('u => window.M360_API("write", {op: "set", path: "pitches/pt_sw", data: {brand: "Swisse", category: "", contact: "c_meera", source: "", owner: u, updated: Date.now(), stage: "proposal", stageAt: Date.now(), next: "", nextDate: "", project: "", lost: "", created: Date.now(),'
                       ' sent: {sd1: {to: "c_meera", via: "mail", what: "Proposal v2", link: "", at: Date.now() - 2 * 86400000, by: u, reply: "", replyAt: 0}}}})', fuid)
            f.goto(base + '#pitches/pt_sw')
            f.wait_for_selector('#pitch-contact-name')
            f.wait_for_function('() => /Meera Shah/.test(document.querySelector("#pitch-contact-name").textContent)')
            name = f.inner_text('#pitch-contact-name')
            check(name.startswith('Meera Shah') and 'c_meera' not in name, 'the team site shows the contact name: %r' % name)
            f.wait_for_selector('#pitch-sent .sent-row')
            row = f.inner_text('#pitch-sent .sent-row')
            check('Meera' in row and 'c_meera' not in row, 'the send row names the recipient: %r' % row)
            f.keyboard.press('Escape')
            f.goto(base + '#pitches')
            f.wait_for_selector('.pitch-sent-line')
            line = f.inner_text('.pitch-sent-line')
            check('Meera' in line and 'c_' not in line and 'no reply' in line, 'the board line on the team site: %r' % line)
            check(not [e for e in errors if 'favicon' not in e], 'no page errors on the site: %r' % errors[:2])
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    return checks


if __name__ == '__main__':
    a = run(mock_part)
    b = site_part()
    print('test_prospects_ui: %d checks passed (%d on the mock, %d on the team site)' % (len(a) + len(b), len(a), len(b)))
