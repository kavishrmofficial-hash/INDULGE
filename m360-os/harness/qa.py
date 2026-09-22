#!/usr/bin/env python3
"""Full QA: seed a realistic workspace, then walk every page as founder, member and outsider
at 390, 768 and 1280 wide. Fails on console errors, page overflow, text under 11px, or a page
that rendered nothing. This is the pass that exercises list and table paths with real rows."""
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run  # noqa: E402

F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
PAGES = ['#today', '#tasks', '#projects', '#pitches', '#clients', '#feed', '#week', '#scores',
         '#people', '#hiring', '#handbook', '#voice', '#leave', '#command', '#desk']
MEMBER_PAGES = [p for p in PAGES if p not in ('#command', '#desk')]


# the harness runs the browser in Asia/Kolkata while the container clock is UTC, so every seeded
# date and timestamp is built in the app's timezone; otherwise "today" can differ by one day
IST = timezone(timedelta(hours=5, minutes=30))


def ymd(d):
    return d.strftime('%Y-%m-%d')


def ms(d, h=10, mi=0):
    return int(datetime(d.year, d.month, d.day, h, mi, tzinfo=IST).timestamp() * 1000)


def browser_today(page):
    """The date the app itself calls today, read from the browser clock."""
    s = page.evaluate("() => { const d = new Date(), p = n => String(n).padStart(2,'0');"
                      "return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }")
    return datetime.strptime(s, '%Y-%m-%d')


def seed(h, page):
    """A workspace that looks like a real week at Mask360."""
    now = browser_today(page)
    mon = now - timedelta(days=(now.weekday()))
    week = mon.strftime('%G-W%V')
    quarter = '%d-Q%d' % (now.year, (now.month - 1) // 3 + 1)
    d = lambda n: mon + timedelta(days=n)  # noqa: E731

    h.roster(page, [M1, M2, M3], extra={M1: {'joined': ymd(now - timedelta(days=10)),
                                             'probationEnd': ymd(now + timedelta(days=30))}})
    h.seed_doc(page, 'settings/app', {
        'office': {'lat': 19.076, 'lng': 72.8777, 'radius': 200, 'label': 'Mumbai office'},
        'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00', 'wfhCap': 2,
        'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
        'rules': {'R%02d' % i: True for i in range(1, 17)},
        'points': {'checkinOnTime': 2, 'eod': 2, 'planOnTime': 4, 'planLate': 1, 'outcomeHit': 12,
                   'outcomeMiss': -6, 'taskOnTime': 6, 'taskLate': 2, 'revision': -2, 'shown20': 2,
                   'qualityMult': 4, 'kudos': 3, 'rockDone': 20, 'overdueOpen': -2},
        'leaderboardIncludesFounder': False, 'updated': ms(now)})

    # attendance: office verified, office unverified and late, wfh
    office_ok = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True,
                 'place': 'Mumbai office', 'src': 'gps'}
    office_far = {'lat': 19.2, 'lng': 72.9, 'acc': 40, 'dist': 14000, 'verified': False,
                  'place': 'Outside office, 14.0 km away', 'src': 'gps'}
    home = {'lat': None, 'lng': None, 'acc': None, 'dist': None, 'verified': False,
            'place': 'Home', 'src': 'self'}
    h.seed_doc(page, 'checkin/' + M1, {'days': {
        ymd(d(0)): {'in': ms(d(0), 10, 12), 'out': ms(d(0), 19, 40), 'mode': 'office',
                    'loc': office_ok, 'outLoc': None},
        ymd(d(1)): {'in': ms(d(1), 11, 40), 'out': None, 'mode': 'office',
                    'loc': office_far, 'outLoc': None},
        # today: on time, at the office, verified, with a map link
        ymd(now): {'in': ms(now, 10, 8), 'out': None, 'mode': 'office', 'loc': office_ok, 'outLoc': None}}})
    h.seed_doc(page, 'checkin/' + M2, {'days': {
        ymd(d(0)): {'in': ms(d(0), 10, 5), 'out': ms(d(0), 18, 30), 'mode': 'wfh',
                    'loc': home, 'outLoc': None},
        # today: late, from home, self reported
        ymd(now): {'in': ms(now, 12, 20), 'out': ms(now, 19, 5), 'mode': 'wfh', 'loc': home, 'outLoc': None}}})
    h.seed_doc(page, 'eod/' + M1, {'days': {
        ymd(d(0)): {'shipped': 'Three Swisse scripts to Durvesh.', 'next': 'Storyboard the hero reel.',
                    'blocked': '', 'at': ms(d(0), 19, 10)},
        ymd(d(1)): {'shipped': 'Hero reel storyboard.', 'next': 'Shot list.',
                    'blocked': 'Waiting on the Blah Studio call sheet.', 'at': ms(d(1), 19, 20)}}})
    h.seed_doc(page, 'plan/' + M1, {'weeks': {week: {'items': [
        {'id': 'o1', 'text': '30 reel scripts approved by the client'},
        {'id': 'o2', 'text': 'Shoot schedule locked with Blah Studio'},
        {'id': 'o3', 'text': 'Creator brief out to five creators'}], 'at': ms(d(0), 9, 30)}}})
    h.seed_doc(page, 'review/' + M1, {'weeks': {week: {
        'marks': {'o1': 'hit', 'o2': 'miss'}, 'quality': 4, 'note': 'Strong scripts. Schedule slipped.',
        'at': ms(d(4), 17, 30)}}})
    h.seed_doc(page, 'rocks/' + M1, {'q': {quarter: [
        {'id': 'r1', 'text': 'Pod 1 runs without me', 'state': 'on'},
        {'id': 'r2', 'text': 'Two retainers signed', 'state': 'done'}]}})

    h.seed_doc(page, 'clients/swisse-wellness-uae', {'name': 'Swisse Wellness UAE', 'status': 'live', 'pod': 'Pod 1',
                                        'owner': M1, 'memory': '30 reel shoot with Blah Studio.', 'approvals': 'Omar signs off.',
                                        'never': 'No claims about results.', 'links': '', 'updated': ms(now), 'by': F})
    h.seed_doc(page, 'projects/p1', {'name': 'Swisse 30 reels', 'kind': 'client', 'client': 'swisse-wellness-uae', 'pitch': '',
                                     'owner': M1, 'members': [M1, M2], 'status': 'risk', 'start': ymd(mon),
                                     'due': ymd(now + timedelta(days=2)), 'desc': 'Thirty reels for the UAE launch.',
                                     'sections': [{'id': 's1', 'name': 'Brief'}, {'id': 's2', 'name': 'Strategy'},
                                                  {'id': 's3', 'name': 'Creative'}],
                                     'updates': {'u1': {'by': M1, 'status': 'risk', 'text': 'Schedule is tight.', 'at': ms(d(1))}},
                                     'archived': False, 'by': F, 'created': ms(mon)})
    for i, (title, owner, due, status, sec) in enumerate([
            ('Write hero reel script', M1, ymd(now - timedelta(days=4)), 'doing', 's2'),
            ('Lock the shot list', M1, ymd(now + timedelta(days=1)), 'review', 's3'),
            ('Creator brief', M2, ymd(now - timedelta(days=1)), 'todo', 's1'),
            ('Moodboard', M2, ymd(now - timedelta(days=3)), 'done', 's3')]):
        h.seed_doc(page, 'tasks/t%d' % (i + 1), {
            'title': title, 'owner': owner, 'client': 'swisse-wellness-uae', 'project': 'p1', 'section': sec,
            'due': due, 'status': status, 'priority': 'high' if i == 0 else 'normal', 'link': '',
            'revisions': 2 if i == 1 else 0, 'shown20': i == 3,
            'subtasks': {'st1': {'t': 'First pass', 'done': True, 'o': M1}} if i == 0 else {},
            'comments': {'c1': {'by': M2, 't': 'Looks good.', 'at': ms(d(1))}} if i == 0 else {},
            'by': F, 'created': ms(mon), 'updated': ms(d(2)),
            'doneAt': ms(now - timedelta(days=3), 16, 0) if status == 'done' else None})

    h.seed_doc(page, 'pitches/pi1', {'brand': 'Aurelia Jewels', 'category': 'Luxury retail', 'contact': 'Nisha, marketing head',
                                     'source': 'Referral', 'stage': 'proposal', 'stageAt': ms(now - timedelta(days=6)),
                                     'owner': F, 'next': 'Send the revised scope', 'nextDate': ymd(now - timedelta(days=2)),
                                     'project': '', 'lost': '', 'created': ms(mon), 'updated': ms(d(2))})
    h.seed_doc(page, 'pitches/pi2', {'brand': 'Marina Hotels', 'category': 'Hospitality', 'contact': 'Ravi, brand lead',
                                     'source': 'Inbound', 'stage': 'won', 'stageAt': ms(now - timedelta(days=20)),
                                     'owner': F, 'next': '', 'nextDate': '', 'project': '', 'lost': '',
                                     'created': ms(mon - timedelta(days=40)), 'updated': ms(d(1))})
    h.seed_doc(page, 'data/users/%s/finance' % F, {'pitch': {'pi1': {'value': 450000, 'prob': None},
                                                             'pi2': {'value': 300000, 'prob': None}},
                                                   'clients': {'swisse-wellness-uae': {'monthly': 250000}}})
    h.seed_doc(page, 'data/users/%s/keeper' % F, {'notes': {M1: {now.strftime('%Y-%m'): {
        'fight': 'yes', 'rehire': 'yes', 'note': 'Running Swisse well.', 'at': ms(now)}}}})

    h.seed_doc(page, 'feed/' + F, {'posts': [
        {'id': 'f1', 'kind': 'announce', 'text': 'Swisse shoot moves to the 28th. Blah Studio confirmed.', 'at': ms(d(1), 11, 0)},
        {'id': 'f2', 'kind': 'update', 'text': 'Aurelia proposal goes out tomorrow.', 'at': ms(d(0), 16, 0)}],
        'pinned': F + ':f1'})
    h.seed_doc(page, 'feed/' + M1, {'posts': [
        {'id': 'f3', 'kind': 'win', 'text': 'Client approved all thirty scripts in one pass.', 'at': ms(d(2), 12, 0)}], 'pinned': None})
    h.seed_doc(page, 'reacts/' + M2, {'r': {M1 + ':f3': '\U0001F525'}})
    h.seed_doc(page, 'kudos/' + F, {'given': [{'id': 'k1', 'to': M1, 'why': 'Took the shoot schedule off my plate.', 'at': ms(d(1))}]})
    h.seed_doc(page, 'acks/' + M1, {'s': {'house-rules': ms(d(0)), 'the-week': ms(d(0))}})

    h.seed_doc(page, 'leave/' + M2, {'reqs': [{'id': 'l1', 'from': ymd(now + timedelta(days=7)),
                                               'to': ymd(now + timedelta(days=8)), 'type': 'casual', 'at': ms(d(1))}]})
    h.seed_doc(page, 'candidates/c1', {'name': 'Priya Nair', 'role': 'Brand Strategist', 'stage': 'panel',
                                       'links': 'https://example.com/portfolio', 'notes': 'Strong retail work.',
                                       'evaluators': [M1, M2], 'deadline': ymd(now + timedelta(days=3)),
                                       'decision': '', 'decidedAt': None, 'created': ms(mon)})
    h.seed_doc(page, 'evals/' + M1, {'e': {'c1': {'gwc': {'g': 'yes', 'w': 'yes', 'c': 'no'},
                                                  's': {'craft': 4, 'thinking': 4, 'comms': 3, 'ownership': 4, 'culture': 5},
                                                  'pod': 'yes', 'verdict': 'yes', 'why': 'Sharp strategic thinking.',
                                                  'risk': 'Light on production.', 'at': ms(d(2))}}})
    h.seed_doc(page, 'pulse/px1', {'at': ms(d(1)), 'week': week, 'energy': 4, 'working': 'Clear briefs.',
                                   'broken': 'Too many WhatsApp pings.', 'change': 'Protect the mornings.'})
    h.seed_doc(page, 'pulse/px2', {'at': ms(d(2)), 'week': week, 'energy': 2, 'working': 'Pod structure.',
                                   'broken': 'Approvals take too long.', 'change': 'Faster creative sign-off.'})
    h.seed_doc(page, 'ideas/' + M2, {'items': {'i1': {'t': 'A shared reference library per client.',
                                                      'at': ms(d(1)), 'status': 'open'}}})
    h.seed_doc(page, 'votes/' + M1, {'v': {M2 + ':i1': True}})
    h.seed_doc(page, 'access/' + M1, {'items': {'a1': {'name': 'Swisse client WhatsApp group', 'kind': 'client group',
                                                       'risk': 'high', 'xfer': True, 'added': ms(mon), 'by': M1,
                                                       'revoked': False, 'revokedAt': None}}, 'offboard': None})
    h.seed_doc(page, 'onboard/' + M1, {'done': {'laptop': ms(mon)}})
    page.wait_for_timeout(500)


def qa(h):
    problems = []
    # one context: Playwright isolates localStorage per context, so the seed must live in the
    # same session that walks the pages
    page = h.session('founder', width=1280, hash='#today', reset=True, seed=True)
    seed(h, page)

    for ident, pages in (('founder', PAGES), ('m1', MEMBER_PAGES), ('m2', MEMBER_PAGES)):
        for w in (1280, 768, 390):
            for hsh in pages:
                h.go(page, ident, hash=hsh, width=w, seed=True)
                page.wait_for_timeout(350)
                text = page.evaluate('document.body.innerText').strip()
                if len(text) < 40:
                    problems.append('%s %s %dpx rendered almost nothing' % (ident, hsh, w))
                # real names must resolve: an unresolved profile falls back to "Someone"
                if 'Someone' in text:
                    problems.append('%s %s %dpx shows an unresolved name' % (ident, hsh, w))
                ov = h.overflow(page)
                if ov > 0:
                    problems.append('%s %s %dpx overflow %dpx' % (ident, hsh, w, ov))
                st = h.small_text(page)
                if st:
                    problems.append('%s %s %dpx small text %r' % (ident, hsh, w, st[:2]))
                if w == 1280 and ident == 'founder':
                    h.shot(page, 'qa-' + hsh.strip('#'))

    # the outsider sees the holding screen and no navigation
    h.go(page, 'outsider', hash='#today', width=1280, seed=True)
    page.wait_for_timeout(300)
    body = page.evaluate('document.body.innerText')
    if 'not on the team roster yet' not in body:
        problems.append('outsider does not see the holding screen: %r' % body[:120])
    if page.locator('.sidebar').count():
        problems.append('outsider sees the sidebar')

    # members never reach Command or Desk
    for hsh in ('#command', '#desk'):
        h.go(page, 'm1', hash=hsh, width=1280, seed=True)
        page.wait_for_timeout(500)
        if page.evaluate('location.hash') != '#today':
            problems.append('m1 was not redirected away from %s' % hsh)
        if page.locator('.side-item', has_text='Command').count():
            problems.append('m1 sees Command in the sidebar')

    for e in h.errors():
        problems.append('console %s: %s' % (e[0], str(e[1])[:200]))
    return problems


if __name__ == '__main__':
    probs = run(qa)
    if probs:
        print('QA PROBLEMS (%d):' % len(probs))
        for p in probs:
            print(' -', p)
        sys.exit(1)
    print('qa ok')
