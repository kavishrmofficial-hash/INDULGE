"""Capture the real m360 screens for the keynote film.

Builds m360 OS, runs it on the project's local harness (mock window.claude), seeds a demo week for a
fictional team (so no real client or teammate appears in the film), and screenshots the real pages.

python3 capture.py survey            # full pages of every route, 1x, for choosing shots
python3 capture.py shots             # the film's shots at 2x into ./shots
"""
import os
import re
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
M360 = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'm360-os'))
sys.path.insert(0, M360)
from harness.lib import run  # noqa: E402

F, RI, AR, ME, KA, TA = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4', 'u_m5'
IST = timezone(timedelta(hours=5, minutes=30))
CLIENT = 'tara-foods'


def av(i, c):
    return ("'data:image/svg+xml,' + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\">"
            "<rect width=\"40\" height=\"40\" fill=\"%s\"/><text x=\"20\" y=\"25\" font-family=\"sans-serif\" font-size=\"15\" "
            "text-anchor=\"middle\" fill=\"#fff\">%s</text></svg>')" % (c, i))


IDENT = ("const IDENT = {\n"
         "    founder: {id: 'u_founder', name: 'Rohan Kapoor', email: 'rohan@m360.agency', color: '#0E0E0E', isOwner: true, canEdit: true, avatarUrl: AV('RK', '#0E0E0E')},\n"
         "    m1: {id: 'u_m1', name: 'Riya Shah', email: 'riya@m360.agency', color: '#F53901', isOwner: false, canEdit: false, avatarUrl: AV('RS', '#F53901')},\n"
         "    m2: {id: 'u_m2', name: 'Arjun Nair', email: 'arjun@m360.agency', color: '#3A3A3A', isOwner: false, canEdit: false, avatarUrl: AV('AN', '#3A3A3A')},\n"
         "    m3: {id: 'u_m3', name: 'Meher Joshi', email: 'meher@m360.agency', color: '#6A6A6A', isOwner: false, canEdit: false, avatarUrl: AV('MJ', '#6A6A6A')},\n"
         "    m4: {id: 'u_m4', name: 'Kabir Sen', email: 'kabir@m360.agency', color: '#8A8A8A', isOwner: false, canEdit: false, avatarUrl: AV('KS', '#8A8A8A')},\n"
         "    m5: {id: 'u_m5', name: 'Tanvi Mehta', email: 'tanvi@m360.agency', color: '#B03000', isOwner: false, canEdit: false, avatarUrl: AV('TM', '#B03000')},\n"
         "    outsider: {id: 'u_out', name: 'Guest', email: 'guest@m360.agency', color: '#9A9A9A', isOwner: false, canEdit: false, avatarUrl: AV('G', '#9A9A9A')}\n"
         "  };")


def demo_mock():
    src = open(os.path.join(M360, 'harness', 'mock.js'), encoding='utf-8').read()
    src = re.sub(r'const IDENT = \{.*?\n  \};', lambda m: IDENT, src, count=1, flags=re.S)
    for a, b in (('Durvesh', 'Riya'), ('Aanya', 'Arjun'), ('Ishaan', 'Meher'), ('Kaavish', 'Rohan'), ('Swisse', 'Tara Foods'),
                 ('Blah Studio', 'the studio'), ('Aurelia', 'Luma')):
        src = src.replace(a, b)
    return src


def ymd(d):
    return d.strftime('%Y-%m-%d')


def ms(d, h=10, mi=0):
    return int(datetime(d.year, d.month, d.day, h, mi, tzinfo=IST).timestamp() * 1000)


def today(page):
    s = page.evaluate("() => { const d = new Date(), p = n => String(n).padStart(2,'0');"
                      "return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }")
    return datetime.strptime(s, '%Y-%m-%d')


def seed(h, page):
    now = today(page)
    mon = now - timedelta(days=now.weekday())
    lmon = mon - timedelta(days=7)
    week, lweek = mon.strftime('%G-W%V'), lmon.strftime('%G-W%V')
    quarter = '%d-Q%d' % (now.year, (now.month - 1) // 3 + 1)
    s = h.seed_doc
    titles = {RI: ('Designer', 'Pod 1'), AR: ('Brand Strategist', 'Pod 1'), ME: ('Account Lead', 'Pod 2'),
              KA: ('Video Editor', 'Pod 2'), TA: ('Content Associate', 'Pod 1')}
    members = {F: {'role': 'founder', 'empId': 'M360-001', 'title': 'Founder', 'pod': '', 'joined': '2023-04-03',
                   'start': '', 'probationEnd': '', 'active': True}}
    for n, u in enumerate([RI, AR, ME, KA, TA]):
        members[u] = {'role': 'member', 'empId': 'M360-%03d' % (n + 2), 'title': titles[u][0], 'pod': titles[u][1],
                      'joined': ymd(now) if u == TA else ('2024-%02d-%02d' % (now.month, now.day) if u == AR else '2025-02-10'),
                      'start': '', 'probationEnd': ymd(now + timedelta(days=90)) if u == TA else '', 'active': True}
    page.evaluate('m => window.__db.set("roster/team", {members: m, nextEmp: 8, owner: "u_founder", updated: Date.now()})', members)
    page.wait_for_timeout(150)
    s(page, 'settings/app', {
        'office': {'lat': 19.076, 'lng': 72.8777, 'radius': 200, 'label': 'Mumbai office'},
        'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00', 'wfhCap': 2,
        'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
        'rules': {'R%02d' % i: True for i in range(1, 17)},
        'points': {'checkinOnTime': 2, 'eod': 2, 'planOnTime': 4, 'planLate': 1, 'outcomeHit': 12, 'outcomeMiss': -6,
                   'taskOnTime': 6, 'taskLate': 2, 'revision': -2, 'shown20': 2, 'qualityMult': 4, 'kudos': 3,
                   'rockDone': 20, 'overdueOpen': -2},
        'leaderboardIncludesFounder': False, 'setup': {'dismissed': True}, 'updated': ms(lmon)})
    ok = {'lat': 19.0761, 'lng': 72.8776, 'acc': 20, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}
    home = {'lat': None, 'lng': None, 'acc': None, 'dist': None, 'verified': False, 'place': 'Home', 'src': 'self'}
    work = [lmon + timedelta(days=i) for i in range(6)] + [mon + timedelta(days=i) for i in range((now - mon).days)]
    moods = {RI: 5, AR: 4, ME: 5, KA: 3, TA: 4}
    ins = {RI: (10, 4), AR: (10, 22), ME: (9, 48), KA: (10, 35), TA: (10, 10)}
    for u in (RI, AR, ME, KA):
        days, eods = {}, {}
        for i, d in enumerate(work):
            wfh = d.weekday() == 5
            hh, mm = ins[u]
            days[ymd(d)] = {'in': ms(d, hh, mm + (i % 3) * 3), 'out': ms(d, 19, 40), 'mode': 'wfh' if wfh else 'office',
                            'loc': home if wfh else ok, 'outLoc': None, 'mood': moods[u] - (1 if i % 4 == 3 else 0)}
            eods[ymd(d)] = {'shipped': ['Six reel covers for Tara Foods', 'Launch carousel, round two', 'Pitch deck story', 'Reel 12 edit'][i % 4],
                            'next': 'Storyboard the festive film', 'blocked': 'Logo files from the brand' if (u == RI and i >= len(work) - 2) else '',
                            'at': ms(d, 19, 5 if u != KA else 21)}
        if u != RI:
            days[ymd(now)] = {'in': ms(now, *ins[u]), 'out': None, 'mode': 'office', 'loc': ok, 'outLoc': None, 'mood': moods[u]}
        s(page, 'checkin/' + u, {'days': days})
        s(page, 'eod/' + u, {'days': eods})
    s(page, 'checkin/' + TA, {'days': {ymd(now): {'in': ms(now, 10, 10), 'out': None, 'mode': 'office', 'loc': ok, 'outLoc': None, 'mood': 4}}})
    outs = {RI: ['Six reel covers approved', 'Launch carousel locked', 'Festive moodboard to the client'],
            AR: ['Tara Foods Q4 strategy signed off', 'Pitch deck for the new brand', 'Creator shortlist of ten'],
            ME: ['30 reel scripts locked with the client', 'Invoice cycle closed', 'Monthly report sent'],
            KA: ['Reel 12 to 18 edited', 'Brand film rough cut', 'Sound library cleaned up']}
    marks = {RI: ('hit', 'hit', 'miss'), AR: ('hit', 'miss', 'hit'), ME: ('hit', 'hit', 'hit'), KA: ('hit', 'hit', 'miss')}
    for u, items in outs.items():
        its = [{'id': 'o%d' % i, 'text': t} for i, t in enumerate(items)]
        s(page, 'plan/' + u, {'weeks': {lweek: {'items': its, 'at': ms(lmon, 10, 40)}, week: {'items': its, 'at': ms(mon, 10, 50)}}})
        s(page, 'review/' + u, {'weeks': {week: {'marks': {'o%d' % i: m for i, m in enumerate(marks[u])}, 'quality': 4, 'note': '', 'at': ms(now, 9, 0)}, lweek: {'marks': {'o%d' % i: m for i, m in enumerate(marks[u])},
                                                  'quality': 5 if u == ME else 4, 'note': 'Strong week.', 'at': ms(lmon + timedelta(days=4), 17, 30)}}})
    s(page, 'rocks/' + RI, {'q': {quarter: [{'id': 'r1', 'text': 'Own the Tara Foods look', 'state': 'on'},
                                            {'id': 'r2', 'text': 'Design system for reels', 'state': 'done'}]}})

    s(page, 'clients/' + CLIENT, {'name': 'Tara Foods', 'status': 'live', 'pod': 'Pod 1', 'owner': ME,
                                  'memory': 'Loves clean white space. Real people, real kitchens. Warm, never loud.',
                                  'approvals': '30 reel concept, v2. Nikhil signs off on anything that goes live.',
                                  'never': 'Never use yellow on this brand. No health claims.', 'links': 'https://tarafoods.in',
                                  'website': 'https://tarafoods.in', 'industry': 'Food and beverage',
                                  'updated': ms(now), 'by': ME})
    s(page, 'clients/luma-beauty', {'name': 'Luma Beauty', 'status': 'live', 'pod': 'Pod 2', 'owner': AR,
                                    'memory': 'Skincare for Indian skin. Science first.', 'approvals': 'Founder approves every film.',
                                    'never': 'No before and after.', 'links': '', 'updated': ms(now - timedelta(days=3)), 'by': AR})
    s(page, 'projects/p1', {'name': 'Tara Foods 30 reels', 'kind': 'client', 'client': CLIENT, 'pitch': '', 'owner': ME,
                            'members': [RI, AR, ME, KA], 'status': 'on', 'start': ymd(lmon), 'due': ymd(now + timedelta(days=9)),
                            'desc': 'Thirty reels for the festive launch.',
                            'sections': [{'id': 's1', 'name': 'Brief'}, {'id': 's2', 'name': 'Strategy'}, {'id': 's3', 'name': 'Creative'},
                                         {'id': 's4', 'name': 'Production'}],
                            'updates': {'u1': {'by': ME, 'status': 'on', 'text': 'Scripts locked. Shoot on Thursday.', 'at': ms(mon)}},
                            'archived': False, 'by': F, 'created': ms(lmon)})
    s(page, 'projects/p2', {'name': 'Luma Beauty launch film', 'kind': 'client', 'client': 'luma-beauty', 'pitch': '', 'owner': AR,
                            'members': [AR, KA], 'status': 'risk', 'start': ymd(lmon), 'due': ymd(now + timedelta(days=3)),
                            'desc': 'The launch film and cut downs.', 'sections': [{'id': 's1', 'name': 'Script'}, {'id': 's2', 'name': 'Edit'}],
                            'updates': {}, 'archived': False, 'by': F, 'created': ms(lmon)})
    tasks = [('Launch carousel', RI, 1, 'review', 's3', 1, 'p1', True), ('Six reel covers', RI, -2, 'done', 's3', 0, 'p1', True),
             ('Festive moodboard', RI, 2, 'doing', 's3', 0, 'p1', False), ('Reel 12 edit', KA, 0, 'doing', 's4', 0, 'p1', True),
             ('Caption bank', TA, 3, 'todo', 's2', 0, 'p1', False), ('Q4 strategy deck', AR, -1, 'done', 's2', 0, 'p1', True),
             ('Launch film rough cut', KA, 2, 'review', 's2', 0, 'p2', True), ('Creator shortlist', AR, 4, 'todo', 's1', 0, 'p2', False),
             ('Monthly report', ME, 1, 'doing', 's1', 0, 'p1', False), ('Shoot call sheet', ME, -3, 'done', 's4', 0, 'p1', True)]
    for i, (title, owner, due, status, sec, rev, proj, s20) in enumerate(tasks):
        s(page, 'tasks/t%d' % i, {'title': title, 'owner': owner, 'client': CLIENT if proj == 'p1' else 'luma-beauty', 'project': proj,
                                  'section': sec, 'due': ymd(now + timedelta(days=due)), 'status': status,
                                  'priority': 'high' if i == 0 else 'normal', 'link': '', 'revisions': rev, 'shown20': s20,
                                  'subtasks': {'a': {'t': 'First pass', 'done': True, 'o': owner}, 'b': {'t': 'Client round', 'done': False, 'o': owner}} if i == 0 else {},
                                  'comments': {}, 'by': F, 'created': ms(lmon), 'updated': ms(now - timedelta(days=1)),
                                  'doneAt': ms(now + timedelta(days=due - 1), 16, 0) if status == 'done' else None,
                                  'approvedBy': F if status == 'done' else None})
    for pid, brand, cat, stage, val, nxt in (('pi1', 'Tara Foods', 'Food', 'won', 350000, ''), ('pi2', 'Luma Beauty', 'Beauty', 'won', 280000, ''),
                                            ('pi3', 'Ocean Hotels', 'Hospitality', 'proposal', 450000, 'Send the revised scope'),
                                            ('pi4', 'Kite Motors', 'Auto', 'diagnostic', 600000, 'Audit their handles'),
                                            ('pi5', 'Pebble Tea', 'Beverage', 'qualified', 180000, 'Intro call'),
                                            ('pi6', 'Nova Fintech', 'Fintech', 'lead', 250000, 'Connect on LinkedIn')):
        s(page, 'pitches/' + pid, {'brand': brand, 'category': cat, 'contact': 'Marketing head', 'source': 'Referral', 'stage': stage,
                                   'stageAt': ms(now - timedelta(days=5)), 'owner': F if pid in ('pi3', 'pi4') else AR, 'next': nxt,
                                   'nextDate': ymd(now + timedelta(days=2)) if nxt else '', 'project': '', 'lost': '',
                                   'created': ms(lmon), 'updated': ms(now)})
    s(page, 'data/users/%s/finance' % F, {'pitch': {'pi3': {'value': 450000}, 'pi4': {'value': 600000}, 'pi5': {'value': 180000},
                                                    'pi6': {'value': 250000}},
                                          'clients': {CLIENT: {'monthly': 350000}, 'luma-beauty': {'monthly': 280000}}})
    s(page, 'feed/' + F, {'posts': [{'id': 'f1', 'kind': 'announce', 'text': 'Tara Foods shoot is Thursday. Call time 8 am.', 'at': ms(now, 9, 30)}],
                          'pinned': F + ':f1'})
    s(page, 'feed/' + ME, {'posts': [{'id': 'f2', 'kind': 'win', 'text': 'Tara Foods reels went live. 1.2M views in the first day.', 'at': ms(now, 11, 0)}], 'pinned': None})
    s(page, 'feed/' + AR, {'posts': [{'id': 'f3', 'kind': 'poll', 'text': 'Friday lunch?', 'opts': ['Biryani', 'Pizza', 'Dosa'], 'at': ms(now, 12, 0)}], 'pinned': None})
    for u, e in ((RI, '\U0001F525'), (AR, '\U0001F525'), (KA, '\U0001F44D'), (TA, '\U0001F525'), (F, '✅')):
        s(page, 'reacts/' + u, {'r': {ME + ':f2': e}})
    s(page, 'kudos/' + RI, {'given': [{'id': 'k1', 'to': KA, 'why': 'Stayed back till midnight to land the edit.', 'at': ms(now, 10, 20)}]})
    s(page, 'kudos/' + F, {'given': [{'id': 'k2', 'to': ME, 'why': 'Closed the Tara Foods campaign with zero revisions.', 'at': ms(lmon + timedelta(days=4))}]})
    s(page, 'kudos/' + AR, {'given': [{'id': 'k3', 'to': ME, 'why': 'Saved the client call.', 'at': ms(lmon + timedelta(days=2))}]})
    s(page, 'me/' + TA, {'birthday': now.strftime('%m-%d'), 'bio': 'Words and reels.'})
    s(page, 'me/' + RI, {'bio': 'Designer. Type nerd.', 'status': {'text': 'Deep work', 'at': ms(now, 10, 30)},
                         'focus': {'sessions': [{'at': ms(now - timedelta(days=i)), 'mins': 45, 'task': 't2'} for i in range(12)]}})
    for i, e in enumerate([4, 5, 4, 2, 4, 5]):
        s(page, 'pulse/px%d' % i, {'at': ms(now - timedelta(days=i)), 'week': week, 'energy': e, 'working': 'Clear briefs.',
                                   'broken': 'Too many WhatsApp pings.', 'change': 'Protect the mornings.'})
    s(page, 'ideas/' + AR, {'items': {'i1': {'t': 'A shared reference library per client.', 'at': ms(now), 'status': 'open'}}})
    s(page, 'leave/' + KA, {'reqs': [{'id': 'l1', 'from': ymd(now + timedelta(days=7)), 'to': ymd(now + timedelta(days=8)), 'type': 'casual', 'at': ms(now)}]})
    s(page, 'candidates/c1', {'name': 'Sara Ali', 'role': 'Brand Strategist', 'stage': 'panel', 'links': 'https://example.com/portfolio',
                              'notes': 'Strong FMCG work.', 'evaluators': [AR, ME], 'deadline': ymd(now + timedelta(days=3)),
                              'decision': '', 'decidedAt': None, 'created': ms(mon)})
    s(page, 'evals/' + AR, {'e': {'c1': {'gwc': {'g': 'yes', 'w': 'yes', 'c': 'yes'}, 's': {'craft': 4, 'thinking': 5, 'comms': 4, 'ownership': 4, 'culture': 5},
                                         'pod': 'yes', 'verdict': 'strongyes', 'why': 'Sharp thinking.', 'risk': 'Light on production.', 'at': ms(now)}}})
    for u, lines in ((RI, [(0, 'Cut is up, have a look'), (2, 'This is so good. Sending now.')]), (KA, [(1, 'Uploading final_cut_v3.mp4')])):
        s(page, 'chat/general:' + u, {'msgs': [{'id': 'm%d' % i, 'at': ms(now, 11, 10 + i), 'text': t, 'mentions': []} for i, t in lines],
                                      'room': 'general', 'by': u, 'updated': ms(now, 11, 20)})
    s(page, 'music/team', {'items': [
        {'id': 'x1', 'url': 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'title': 'Shoot day mix', 'by': KA, 'at': ms(now, 9, 0)},
        {'id': 'x2', 'url': 'https://www.youtube.com/watch?v=jfKfPfyJRdk', 'title': 'Lofi for deep work', 'by': RI, 'at': ms(now, 9, 5)}]})
    orgs = {'o1': ('Tara Foods', 'tarafoods.in', 'Food and beverage', CLIENT), 'o2': ('Luma Beauty', 'lumabeauty.in', 'Beauty', 'luma-beauty'),
            'o3': ('Ocean Hotels', 'oceanhotels.in', 'Hospitality', ''), 'o4': ('Kite Motors', 'kitemotors.in', 'Automotive', '')}
    DAY = 86400000
    t0 = ms(now)
    orows = {k: {'id': k, 'name': v[0], 'domain': v[1], 'website': 'https://' + v[1], 'industry': v[2], 'size': '500', 'city': 'Mumbai',
                 'state': '', 'country': 'India', 'linkedin': '', 'phone': '', 'keywords': [], 'source': 'apollo', 'apolloId': k,
                 'client': v[3], 'tags': [], 'notes': '', 'edited': {}, 'at': t0 - 30 * DAY, 'updated': t0, 'updatedBy': F, 'archived': False}
             for k, v in orgs.items()}
    people = [('c1', 'Nikhil', 'Shah', 'Chief Marketing Officer', 'o1', 'lead'), ('c2', 'Sana', 'Kapoor', 'Head of Marketing', 'o1', 'client'),
              ('c3', 'Vikram', 'Rao', 'Brand Manager', 'o1', 'replied'), ('c4', 'Isha', 'Menon', 'Founder', 'o2', 'client'),
              ('c5', 'Dev', 'Arora', 'Marketing Director', 'o3', 'meeting'), ('c6', 'Leela', 'Iyer', 'Head of Brand', 'o4', 'contacted')]
    crows = {}
    for cid, fi, la, ti, org, stage in people:
        crows[cid] = {'id': cid, 'first': fi, 'last': la, 'name': fi + ' ' + la, 'title': ti, 'email': (fi + '@' + orgs[org][1]).lower(),
                      'email2': '', 'phone': '', 'mobile': '', 'linkedin': '', 'org': org, 'orgName': orgs[org][0], 'city': 'Mumbai',
                      'state': '', 'country': 'India', 'seniority': 'director', 'dept': 'marketing', 'source': 'apollo', 'apolloId': 'p' + cid,
                      'tags': [], 'stage': stage, 'owner': F, 'notes': '', 'edited': {}, 'at': t0 - 5 * DAY, 'updated': t0, 'updatedBy': F, 'archived': False}
    s(page, 'contacts/p000', {'rows': crows, 'n': len(crows)})
    s(page, 'orgs/p000', {'rows': orows, 'n': len(orows)})
    page.evaluate('() => window.__db.del("clients/swisse-wellness-uae")')
    page.wait_for_timeout(600)


ROUTES = ['#home', '#tasks', '#projects', '#projects/p1', '#calendar', '#reviews', '#week', '#clients', '#clients/' + CLIENT, '#pitches',
          '#crm', '#hunt', '#feed', '#people', '#voice', '#scores', '#music', '#base', '#companies', '#chat', '#mail', '#gcal', '#drive',
          '#web', '#radar', '#awards', '#watch', '#me', '#notes', '#trophies', '#leave', '#handbook', '#hiring', '#hq', '#command', '#admin']


def session(h, ident, width, height, dpr=1, tz='Asia/Kolkata'):
    ctx = h.browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr, locale='en-IN',
                                timezone_id=tz, geolocation={'latitude': 19.0761, 'longitude': 72.8776, 'accuracy': 20},
                                permissions=['geolocation'])
    h.contexts.append(ctx)
    mock = demo_mock()
    ctx.route('**/harness/mock.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=mock))
    page = ctx.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    return page


def survey(h):
    out = os.path.join(HERE, 'survey')
    os.makedirs(out, exist_ok=True)
    page = session(h, 'founder', 1440, 900)
    h.go(page, 'founder', hash='#home', reset=True, seed=True)
    seed(h, page)
    for ident, routes in (('founder', ROUTES), ('m1', ['#home', '#trophies', '#scores', '#me'])):
        for r in routes:
            h.go(page, ident, hash=r, seed=True, online='u_m2')
            page.wait_for_timeout(700)
            page.screenshot(path=os.path.join(out, '%s-%s.png' % (ident, r.strip('#').replace('/', '_'))), full_page=True)
    return [e for e in h.errors()][:10]


NEWS = [
    ('New CMO joins Tara Foods from a global beauty major', 'Nikhil Shah takes charge of marketing across India.', 'afaqs'),
    ('Kite Motors appoints a new creative agency after a three way pitch', 'The digital mandate moves in Mumbai.', 'exchange4media'),
    ('Luma Beauty launches a new range in six Indian cities', 'The D2C label enters offline retail.', 'Social Samosa'),
    ('Festive ad film for a tea brand crosses 20 million views', 'The Diwali campaign film leads the week.', 'ET Brand Equity'),
    ('Pebble Tea names a new head of marketing in Bengaluru', 'The beverage brand strengthens its team.', 'MediaBrief'),
    ('Shortlists announced for the Kyoorius creative awards', 'Indian agencies lead the craft categories.', 'Campaign India'),
]


def fake_api(page):
    items = [{'id': 'n%d' % i, 'title': t, 'summary': sm, 'link': 'https://example.in/story%d' % i, 'source': src,
              'at': 0, 'tags': ['india']} for i, (t, sm, src) in enumerate(NEWS)]
    page.evaluate("""items => { const now = Date.now(); items.forEach((it, i) => { it.at = now - (i + 1) * 3600e3; });
      window.M360_STANDALONE = true;
      window.M360_API = (a, b) => a === 'news' ? Promise.resolve({items, at: now}) : Promise.reject({code: 'unavailable', message: 'demo'}); }""", items)


def shots(h):
    out = os.path.join(HERE, 'shots')
    os.makedirs(out, exist_ok=True)
    boxes = {}
    page = session(h, "founder", 1440, 900, dpr=int(os.environ.get("CAP_DPR", "2")), tz=os.environ.get('CAP_TZ', 'Asia/Kolkata'))
    h.go(page, 'founder', hash='#home', reset=True, seed=True)
    seed(h, page)

    def go(ident, hsh, wait=900):
        h.go(page, ident, hash=hsh, online='u_m2')
        page.wait_for_timeout(wait)
        page.evaluate('window.scrollTo(0, 0)')

    def snap(name, focus=None, full=False):
        """focus: {key: css or text=...} bounding boxes saved for the film's zooms (CSS px, 1440x900 page)."""
        page.mouse.move(1430, 890)
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(out, name + '.png'), full_page=full)
        b = {}
        for k, sel in (focus or {}).items():
            try:
                bb = page.locator(sel).first.bounding_box(timeout=1500)
                if bb:
                    b[k] = [round(bb['x']), round(bb['y']), round(bb['width']), round(bb['height'])]
            except Exception as e:  # noqa: BLE001
                b[k] = None
        boxes[name] = b
        print('shot', name, b, flush=True)

    def tryit(fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            print('  skipped:', str(e).splitlines()[0][:160], flush=True)

    def scroll_to(sel):
        page.locator(sel).first.scroll_into_view_if_needed(timeout=3000)
        page.evaluate('window.scrollBy(0, -80)')
        page.wait_for_timeout(300)

    # the day, live: Riya checks in, picks a mood, writes her EOD line
    go('m1', '#home')
    snap('day-before', {'hero': '#home-hero', 'card': '#home-hero .hero-card, #home-hero .card, #home-hero form', 'checkin': 'text=Check in, office', 'mood': 'text=on fire'})
    tryit(lambda: page.get_by_role('button', name='on fire').first.click())
    page.wait_for_timeout(300)
    snap('day-mood', {'hero': '#home-hero', 'mood': 'text=on fire', 'checkin': 'text=Check in, office'})
    tryit(lambda: page.get_by_role('button', name='Check in, office').first.click())
    page.wait_for_timeout(1500)
    snap('day-after', {'hero': '#home-hero', 'in': 'text=In since', 'verified': 'text=verified'})
    def eod():
        scroll_to('text=EOD line')
        page.get_by_placeholder('What went out today').fill('Six reel covers for Tara Foods')
        page.get_by_placeholder('What you pick up tomorrow').fill('Launch carousel, round two')
        page.get_by_placeholder('Leave empty when nothing is in the way').fill('Logo files from the brand')
        page.wait_for_timeout(300)
    tryit(eod)
    snap('day-eod', {'eod': '#eod-card', 'blocked': '#eod-blocked', 'post': 'text=Post EOD line'})
    tryit(lambda: scroll_to('text=Rule box'))
    snap('day-rules', {'rules': 'section.card:has(h2:text-is("Rule box"))', 'esc': 'text=Escalate blockers'})
    tryit(lambda: scroll_to("text=This week's outcomes"))
    snap('week-outcomes', {'outcomes': '#outcomes-card', 'miss': 'text=miss'})
    go('m1', '#home')
    snap('home-riya', {'hero': '#home-hero', 'bday': 'section.card:has-text("birthday today")', 'points': 'text=points, rank'})
    go('m1', '#trophies')
    snap('trophies', {'case': '#trophies', 'chips': 'text=points this quarter', 'hero': '.hero, header'})

    # the week and the work
    for name, hsh in (('week', '#week'), ('reviews', '#reviews'), ('board', '#tasks'), ('projects', '#projects'),
                      ('project', '#projects/p1'), ('calendar', '#calendar'), ('pipeline', '#pitches'), ('crm', '#crm'),
                      ('feed', '#feed'), ('crew', '#people'), ('chat', '#chat'), ('music', '#music'), ('base', '#base'),
                      ('companies', '#companies'), ('mail', '#mail'), ('gcal', '#gcal'), ('drive', '#drive'), ('web', '#web'),
                      ('leave', '#leave'), ('hiring', '#hiring'), ('handbook', '#handbook'), ('hq', '#hq'), ('command', '#command'),
                      ('clients', '#clients'), ('hunt', '#hunt'), ('awards', '#awards')):
        go('founder', hsh)
        if name == 'board':
            tryit(lambda: page.get_by_text('Everyone', exact=True).first.click())
            page.wait_for_timeout(400)
        F = {'board': {'card': '.tcard:has-text(\"Launch carousel\")', 'shown': '.tcard:has-text(\"Launch carousel\") >> text=20% shown', 'cols': '.board, .cols, main'},
             'reviews': {'rev': 'text=1 rev', 'row': 'text=Launch carousel', 'approve': 'text=Approve'},
             'chat': {'msgs': 'text=Uploading final_cut_v3.mp4', 'pane': '#chat-list', 'send': 'text=Send'},
             'music': {'list': '#music-list'},
             'hq': {'rail': 'header.hero', 'tiles': 'header.hero .kpi, header.hero .stat, header.hero .tile'},
             'command': {'att': '#attendance', 'flags': 'section.card:has(h2:text-is(\"Flags\"))', 'riya': 'text=Escalate blockers'},
             'week': {'grid': 'section.card:has-text(\"person\")', 'riya': 'text=Riya Shah'},
             'mail': {'day': 'section.card:has-text(\"Your day\")'}, 'gcal': {'day': 'section.card:has-text(\"Your day\")'},
             'drive': {'day': 'section.card:has-text(\"Your day\")'},
             'base': {'search': 'text=Search people and companies', 'nikhil': 'text=Nikhil Shah'},
             'calendar': {'month': 'text=september'}, 'project': {'list': 'text=Tara Foods 30 reels'},
             'pipeline': {'stages': 'text=Count by stage'}, 'crm': {'table': 'text=Every account, connected'},
             'crew': {'people': 'section.card:has-text(\"Riya Shah\")'}, 'hiring': {'c': 'text=Sara Ali'},
             'leave': {'req': 'text=Request leave'}, 'handbook': {'rules': 'text=Results and culture'},
             'clients': {'tara': 'section.card:has-text(\"Tara Foods\"), article:has-text(\"Tara Foods\")'},
             'web': {'rail': 'text=spaces'}}
        snap(name, F.get(name))
    go('founder', '#scores')
    snap('scores', {'top': 'section.card:has(.podium)', 'podium': '.podium', 'line': 'text=Output earns', 'board': 'section.card:has(h2:text-is("Leaderboard"))'})
    go('founder', '#voice')
    tryit(lambda: page.evaluate('() => { const e = document.getElementById("team-energy-card"); e.scrollIntoView({block: "start"}); window.scrollBy(0, -60); }'))
    page.wait_for_timeout(400)
    snap('pulse', {'energy': '#team-energy-card'})
    go('founder', '#hq')
    tryit(lambda: page.evaluate('() => { const e = document.getElementById("fold-mood"); e.scrollIntoView({block: "start"}); window.scrollBy(0, -40); }'))
    page.wait_for_timeout(400)
    snap('hq-tape', {'mood': '#moodheat', 'tape': '#fold-tape'})
    go('founder', '#command')
    tryit(lambda: page.evaluate('() => { const e = document.querySelector("#attendance"); e.scrollIntoView({block: "start"}); window.scrollBy(0, -40); }'))
    page.wait_for_timeout(400)
    snap('command-att', {'att': '#attendance'})
    tryit(lambda: page.evaluate('() => { const e = [...document.querySelectorAll("b, strong, span, div")].find(x => x.childElementCount === 0 && /Escalate blockers/.test(x.textContent)); e.scrollIntoView({block: "center"}); }'))
    page.wait_for_timeout(400)
    snap('command-flags', {'riya': 'text=Escalate blockers', 'flags': 'section.card:has(h2:text-is("Flags"))'})
    go('founder', '#feed')
    tryit(lambda: scroll_to('text=Kudos to'))
    snap('feed-kudos', {'kudos': 'section.card[data-kind="kudos"]', 'win': 'section.card[data-kind="win"]', 'poll': 'section.card[data-kind="poll"]'})
    go('founder', '#clients/' + CLIENT)
    tryit(lambda: scroll_to('text=never'))
    snap('client-brain', {'never': 'text=Never use yellow', 'drawer': '.drawer', 'brain': 'text=Loves clean white space'})
    go('founder', '#notes')
    def note():
        page.get_by_role('button', name='New').first.click()
        page.wait_for_timeout(400)
        page.keyboard.type('Tara Foods festive ideas\\nA kitchen table series. Real families, one dish each night of Diwali.')
        page.wait_for_timeout(500)
    snap('notes', {'notes': 'text=Find a note'})

    # radar with a demo stream, then Pursue into Hunt
    page.keyboard.press('Escape')
    go('founder', '#home')
    page.keyboard.press('Escape')
    fake_api(page)
    page.evaluate("location.hash = '#radar'")
    page.wait_for_timeout(1500)
    snap('radar', {'first': '.rd-item', 'stream': '#radar-stream', 'pursue': '.rd-item >> text=Pursue', 'chips': 'text=People moves'})
    def pursue():
        page.locator('.rd-item').first.get_by_text('Pursue', exact=True).click()
        page.wait_for_timeout(1800)
    tryit(pursue)
    snap('pursue', {'drawer': '.drawer', 'trigger': '#hunt-trigger', 'write': '#hunt-write'})
    page.evaluate('() => { delete window.M360_STANDALONE; delete window.M360_API; }')

    go('founder', '#home')
    tryit(lambda: page.get_by_text('Focus', exact=True).first.click())
    page.wait_for_timeout(700)
    snap('focus', {'drawer': '.drawer'})
    page.keyboard.press('Escape')

    # the buddy's tour, and the palette
    go('m5', '#home')
    page.evaluate("window.dispatchEvent(new CustomEvent('m360:tour'))")
    for i in range(4):
        page.wait_for_timeout(1400 if i == 0 else 2600)
        snap('buddy-%d' % i, {'bubble': '.buddy-bubble', 'buddy': '.buddy', 'ring': '.buddy-ring'})
    go('founder', '#home')
    page.keyboard.press('Control+k')
    page.wait_for_timeout(400)
    page.keyboard.type('Tara', delay=40)
    page.wait_for_timeout(900)
    snap('palette', {'pal': '.pal', 'nikhil': 'text=Nikhil Shah'})
    page.keyboard.press('Escape')
    go('founder', '#home')
    snap('home-founder', {'hero': '#home-hero'})

    with open(os.path.join(out, 'boxes.json'), 'w') as f:
        import json
        json.dump(boxes, f, indent=1)
    return [e for e in h.errors()][:10]


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'survey'
    print(run({'survey': survey, 'shots': shots}[mode]))
