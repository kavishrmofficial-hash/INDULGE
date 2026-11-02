#!/usr/bin/env python3
"""The team site's server rules that a path pattern cannot say (v39): chat lines by their sender only, rooms by
their maker or an admin, the anonymous pulse (members add, the founder reads), the kudos cap, the music list,
reviews private to the person and admins, the lock for everyone but the owner, the office and looks for the
owner alone, the books out of an admin's log, and the sign-in side: the throttle that presence no longer wipes,
setemail, invites and sign-ups that land once, presence and join requests for people not on the team, the
same wait for an unknown email, and authenticators the trash prune leaves alone.

Run: cd m360-os && python3 harness/tests/test_access_rules.py
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_edgeone  # noqa: E402
from test_security import totp  # noqa: E402

PW = 'vermilion-lantern-2026'


class Client:
    def __init__(self, base, ip):
        self.base, self.ip, self.cookie = base, ip, ''

    def call(self, a, **body):
        body['a'] = a
        h = {'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/128 Safari/537.36', 'x-forwarded-for': self.ip}
        if self.cookie:
            h['cookie'] = 'm360s=' + self.cookie
        req = urllib.request.Request(self.base + 'api/m360', data=json.dumps(body).encode(), method='POST', headers=h)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                for line in r.headers.get_all('set-cookie') or []:
                    if line.startswith('m360s='):
                        self.cookie = line.split(';')[0][len('m360s='):]
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b'{}')
            except Exception:
                return e.code, {}

    def w(self, op, path, data=None):
        body = {'op': op, 'path': path}
        if data is not None:
            body['data'] = data
        return self.call('write', **body)[0]

    def docs(self, coll):
        st, j = self.call('snapshot')
        return ((j.get('colls') or {}).get(coll) or {}).get('docs') or {}


def at_once(fns):
    out = [None] * len(fns)

    def run(i):
        out[i] = fns[i]()
    ts = [threading.Thread(target=run, args=(i,)) for i in range(len(fns))]
    [t.start() for t in ts]
    [t.join() for t in ts]
    return out


def main():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
            print('FAIL', msg, flush=True)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), ':memory:'],
                           env=dict(os.environ, MOCK_AI='1', STORE_LAG_MS='15'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    ips = iter('198.51.100.%d' % i for i in range(1, 250))
    C = lambda: Client(base, next(ips))  # noqa: E731
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        k = C()
        st, j = k.call('setup', name='Kaavish Ramchandani', email='kaavish@mask360.agency', password=PW)
        check(st == 200, 'setup %r %r' % (st, j))
        K = j['uid']

        def join(email, name, role):
            st, j = k.call('invite', email=email, name=name, role=role)
            c = C()
            st, j = c.call('accept', code=j['code'], email=email, password=PW + name)
            check(st == 200, 'accept %s %r %r' % (email, st, j))
            return c, j.get('uid')
        a, A = join('arjun@mask360.agency', 'Arjun', 'founder')
        m, Mb = join('priya@mask360.agency', 'Priya', 'member')
        n, N = join('dev@mask360.agency', 'Dev', 'member')
        g = C()
        st, j = g.call('signup', name='Guest Person', email='guest@example.com', password=PW + 'g')
        check(st == 200, 'guest signup %r %r' % (st, j))
        G = j.get('uid')
        now = int(time.time() * 1000)

        # ---- team-2: chat lines by their sender, rooms by their maker or an admin ----
        line = lambda t: {'msgs': [{'id': 'x' + t, 'at': now, 'text': t, 'mentions': []}], 'updated': now}  # noqa: E731
        check(k.w('merge', 'chat/general:' + K, line('founder line')) == 200, 'owner writes own general line')
        check(m.w('merge', 'chat/general:' + K, line('Friday off')) == 403, 'member rewrites the founder line')
        check(m.w('delete', 'chat/general:' + K) == 403, 'member deletes the founder line')
        check(m.w('merge', 'chat/general:' + Mb, line('my line')) == 200, 'member writes own line')
        dm = 'dm.' + '.'.join(sorted([K, Mb]))
        check(m.w('merge', 'chat/' + dm + ':' + K, line('forged')) == 403, 'member forges the founder in their dm')
        check(m.w('merge', 'chat/' + dm + ':' + Mb, line('hi')) == 200, 'member writes own dm line')
        check(a.w('merge', 'chat/' + dm + ':' + A, line('in')) == 403, 'admin writes into a dm that is not theirs')
        check(m.w('set', 'chatlog/general:' + K + ':1', line('x')) == 403, 'member writes the founder chatlog')
        check(m.w('set', 'chatlog/general:' + Mb + ':1', line('x')) == 200, 'member writes own chatlog')
        check(m.w('set', 'chat/general', line('x')) == 403, 'member writes a chat doc with no sender')
        room = lambda by, **x: dict({'name': 'ops', 'by': by, 'at': now}, **x)  # noqa: E731
        check(k.w('merge', 'chatrooms/team', {'rooms': {'ops': room(K)}}) == 200, 'owner makes a room')
        check(m.w('merge', 'chatrooms/team', {'rooms': {'ops': {'gone': True, 'name': 'renamed'}}}) == 403, 'member hides the founder room')
        check(m.w('merge', 'chatrooms/team', {'rooms': {'mine': room(N)}}) == 403, 'member makes a room in another name')
        check(m.w('merge', 'chatrooms/team', {'rooms': {'mine': room(Mb, name='mine')}}) == 200, 'member makes a room')
        check(m.w('merge', 'chatrooms/team', {'rooms': {'mine': {'name': 'mine 2'}}}) == 200, 'member renames own room')
        check(n.w('merge', 'chatrooms/team', {'rooms': {'mine': {'gone': True}}}) == 403, 'another member hides it')
        check(a.w('merge', 'chatrooms/team', {'rooms': {'ops': {'gone': True}}}) == 200, 'admin hides a room')
        check(m.w('delete', 'chatrooms/team') == 403, 'member deletes the room list')

        # ---- team-3: the pulse ----
        p = {'at': now, 'week': '2026-W44', 'energy': 2, 'working': 'w', 'broken': 'my manager shouts', 'change': 'c'}
        check(m.w('set', 'pulse/pm1', p) == 200, 'member sends a pulse')
        check(m.docs('pulse') == {}, 'member reads the pulse: %r' % list(m.docs('pulse')))
        check('pm1' in a.docs('pulse') and 'pm1' in k.docs('pulse'), 'founder and admin read the pulse')
        check(n.w('delete', 'pulse/pm1') == 403, 'member deletes a pulse answer')
        check(n.w('set', 'pulse/pm1', dict(p, energy=5)) == 403, 'member overwrites a pulse answer')
        check(n.w('merge', 'pulse/pm2', p) == 403, 'member merges into the pulse')
        check(k.w('delete', 'pulse/pm1') == 200, 'founder deletes a pulse answer')

        # ---- team-7: kudos, three a week ----
        given = []
        codes = []
        for i in range(4):
            given = [{'id': 'k%d' % i, 'to': K, 'why': 'thanks %d' % i, 'at': int(time.time() * 1000)}] + given
            codes.append(m.w('merge', 'kudos/' + Mb, {'given': given}))
        check(codes == [200, 200, 200, 403], 'kudos one at a time: %r' % codes)
        ten = [{'id': 'z%d' % i, 'to': K, 'why': 'spam', 'at': now} for i in range(10)]
        check(n.w('merge', 'kudos/' + N, {'given': ten}) == 403, 'ten kudos at once')
        old = [{'id': 'o1', 'to': K, 'why': 'backdated', 'at': now - 9 * 86400000}]
        check(n.w('merge', 'kudos/' + N, {'given': old}) == 403, 'a backdated kudos')
        check(n.w('merge', 'kudos/' + N, {'given': ten[:3]}) == 200, 'three kudos at once')
        check(m.w('merge', 'kudos/' + Mb, {'given': given[2:]}) == 200, 'a kudos taken back')

        # ---- team-4: music ----
        item = lambda i, by: {'id': i, 'title': i, 'url': 'https://youtu.be/' + i, 'kind': 'youtube', 'embed': 'x', 'by': by, 'at': now}  # noqa: E731
        check(k.w('merge', 'music/team', {'items': [item('f1', K)]}) == 200, 'owner adds a pick')
        check(m.w('merge', 'music/team', {'items': []}) == 403, 'member wipes the music list')
        check(m.w('delete', 'music/team') == 403, 'member deletes the music list')
        check(m.w('merge', 'music/team', {'items': [item('f1', K), item('p1', Mb)]}) == 200, 'member adds a pick')
        check(m.w('merge', 'music/team', {'items': [item('f1', K), item('p1', Mb), item('x1', K)]}) == 403, 'member adds a pick in the founder name')
        check(m.w('merge', 'music/team', {'items': [item('f1', K)]}) == 200, 'member removes own pick')
        check(a.w('merge', 'music/team', {'items': []}) == 200, 'admin clears the list')

        # ---- work-5: reviews ----
        rev = {'weeks': {'2026-W44': {'marks': {'o1': 'miss'}, 'quality': 2, 'note': 'Deck late', 'at': now}}}
        check(k.w('set', 'review/' + Mb, rev) == 200 and k.w('set', 'review/' + N, rev) == 200, 'founder saves reviews')
        check(sorted(m.docs('review')) == [Mb], 'member reads reviews: %r' % sorted(m.docs('review')))
        check(sorted(a.docs('review')) == sorted([Mb, N]), 'admin reads every review')
        check(m.w('merge', 'review/' + Mb, {'weeks': {'2026-W44': {'quality': 5}}}) == 403, 'member edits own review')

        # ---- office-1: the office and looks are Kaavish's ----
        look = {'look': {'v': 1, 'skin': 's8', 'hair': 'none', 'by': A, 'at': now}}
        check(a.w('merge', 'me/' + Mb, look) == 403, 'admin restyles a member')
        check(a.w('merge', 'me/' + K, look) == 403, 'admin restyles Kaavish')
        check(a.w('merge', 'me/' + K, {'status': {'text': 'x', 'at': now}}) == 403, 'admin writes Kaavish profile')
        check(a.w('merge', 'office/cast', {'v': 1, 'at': now, 'locks': {}}) == 403, 'admin writes office/cast')
        check(a.w('merge', 'office/plan', {'v': 1, 'rev': 1}) == 403, 'admin writes office/plan')
        check(a.w('merge', 'me/' + A, look) == 200, 'admin styles self')
        check(k.w('merge', 'me/' + Mb, dict(look, look=dict(look['look'], by=K))) == 200, 'Kaavish restyles a member')
        check(k.w('merge', 'office/cast', {'v': 1, 'at': now, 'locks': {}}) == 200, 'Kaavish writes office/cast')

        # ---- books-15: the owner's books stay out of an admin's log ----
        check(k.w('set', 'invoices/2026-27', {'items': {}}) == 200 and k.w('set', 'hr/' + Mb, {'letters': {}}) == 200, 'owner writes books')
        day = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 19800))
        paths = lambda c: [e.get('p') for d in (c.call('logs', **{'from': day, 'to': day})[1].get('docs') or {}).values() for e in (d.get('e') or {}).values()]  # noqa: E731
        ap, kp = paths(a), paths(k)
        check(not any(str(x).startswith(('invoices', 'hr/')) for x in ap), 'admin log shows books: %r' % [x for x in ap if str(x).startswith(('invoices', 'hr'))])
        check('invoices/2026-27' in kp and 'hr/' + Mb in kp, 'owner log keeps books')

        # ---- access-8: the lock holds for everyone but the owner ----
        check(k.w('merge', 'settings/app', {'locked': True}) == 200, 'owner locks')
        check(a.w('set', 'tasks/t1', {'title': 'x'}) == 423, 'admin writes while locked')
        check(m.w('merge', 'me/' + Mb, {'status': {'text': 'y', 'at': now}}) == 200, 'member own status while locked')
        check(k.w('set', 'tasks/t1', {'title': 'x'}) == 200, 'owner writes while locked')
        check(a.w('merge', 'settings/app', {'locked': False}) == 200, 'admin lifts the lock')
        check(a.w('set', 'tasks/t2', {'title': 'y'}) == 200, 'admin writes after the lock')

        # ---- access-6 and access-7: people not on the team ----
        st, j = g.call('presence', page='home')
        check(st == 200 and j.get('peers') == [], 'guest presence: %r' % j)
        st, j = m.call('presence', page='home')
        check(st == 200 and G not in [x['presence']['uid'] for x in j.get('peers', [])], 'guest left a beacon')
        check(k.w('merge', 'settings/app', {'joinPolicy': 'invite'}) == 200, 'owner sets invite only')
        check(g.w('set', 'join/' + G, {'at': now}) == 409, 'join request while invite only')
        check(k.w('merge', 'settings/app', {'joinPolicy': 'open'}) == 200 and g.w('set', 'join/' + G, {'at': now}) == 200, 'join request while open')

        # ---- access-3: setemail ----
        st, j = g.call('setemail', email='free@example.com')
        check(st == 403, 'guest setemail: %r' % st)
        st, j = k.call('invite', email='newhire@mask360.agency', name='New Hire', role='member')
        code = j.get('code')
        st, j = m.call('setemail', email='newhire@mask360.agency')
        check(st == 409, 'member takes an invited email: %r %r' % (st, j))
        st, j = m.call('setemail', email='kaavish@mask360.agency')
        check(st == 409, 'member takes the owner email: %r' % st)
        st, j = m.call('setemail', email='priya.s@mask360.agency')
        check(st == 200, 'member changes own email: %r %r' % (st, j))
        st, j = C().call('accept', code=code, email='newhire@mask360.agency', password=PW + 'nh')
        check(st == 200, 'the invite still works: %r %r' % (st, j))

        # ---- access-5 and access-10: once, under the email's lock ----
        before = len((k.docs('roster').get('team') or {}).get('members') or {})
        st, j = k.call('invite', email='double@mask360.agency', name='Double Click', role='member')
        code = j.get('code')
        res = at_once([lambda: C().call('accept', code=code, email='double@mask360.agency', password=PW + 'dd') for _ in range(3)])
        check(sorted(r[0] for r in res) == [200, 410, 410], 'accept x3: %r' % [r[0] for r in res])
        after = len((k.docs('roster').get('team') or {}).get('members') or {})
        check(after == before + 1, 'roster rows after accept x3: %d then %d' % (before, after))
        res = at_once([lambda: C().call('signup', name='Same', email='same@example.com', password=PW + 'ss') for _ in range(3)])
        check(sorted(r[0] for r in res) == [200, 409, 409], 'signup x3: %r' % [r[0] for r in res])

        # ---- access-9: the same wait for any email ----
        def misses(email):
            c = C()
            return [c.call('pw', email=email, password='wrong-%d' % i)[0] for i in range(7)]
        known, unknown = misses('dev@mask360.agency'), misses('nobody@mask360.agency')
        check(known == unknown == [401] * 5 + [401, 429], 'waits: known %r unknown %r' % (known, unknown))

        # ---- access-2: presence no longer wipes the throttle ----
        bad = C()
        codes = [bad.call('pw', email='x%d@example.com' % i, password='nope')[0] for i in range(42)]
        check(codes[-1] == 429, 'throttle: %r' % codes[-3:])
        m.call('presence', page='home')
        st, j = bad.call('pw', email='y@example.com', password='nope')
        check(st == 429, 'throttle after a presence poll: %r' % st)

        # ---- safety: the trash prune leaves authenticators alone ----
        st, j = n.call('totpstart')
        secret = j.get('secret', '')
        st, j = n.call('totpon', code=totp(secret))
        check(st == 200 and j.get('on') is True, 'totpon: %r %r' % (st, j))
        st, j = k.call('emptytrash', days=0)
        check(st == 200, 'emptytrash: %r %r' % (st, j))
        st, j = n.call('totpstate')
        check(st == 200 and j.get('on') is True, 'authenticator after the trash prune: %r' % j)
    finally:
        srv.terminate()
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(main())
