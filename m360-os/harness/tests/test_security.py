#!/usr/bin/env python3
"""The team site's security: the headers and the content security policy, the breach check on a new
password, two-step sign-in with an authenticator (the challenge after the password, a wrong code, the
right code, a replayed code, a recovery code), the new-device mail, the per-address throttle, and the
security log the founder sees.

Run: cd m360-os && python3 harness/tests/test_security.py
"""
import base64
import hashlib
import hmac
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402


def totp(secret, at=None, drift=0):
    key = base64.b32decode(secret + '=' * ((8 - len(secret) % 8) % 8))
    step = int((at or time.time()) // 30) + drift
    mac = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest()
    o = mac[-1] & 15
    code = ((mac[o] & 127) << 24 | mac[o + 1] << 16 | mac[o + 2] << 8 | mac[o + 3]) % 1000000
    return '%06d' % code


LAST = {'step': 0}


def fresh(secret):
    """A code the server has not seen: a step is accepted once, so the next code is a step ahead when the
    window has not moved (one step of drift is allowed), else the current one; waits for the window when needed."""
    cur = int(time.time() // 30)
    step = max(cur, LAST['step'] + 1)
    if step > cur + 1:
        time.sleep((step - 1) * 30 - time.time() + 0.2)
        cur = int(time.time() // 30)
        step = max(cur, LAST['step'] + 1)
    LAST['step'] = step
    return totp(secret, drift=step - cur)


class Client:
    """A browser-shaped caller: keeps its session cookie (a Secure cookie, which a browser sends to localhost
    and urllib would not), sends a user agent and an address."""
    def __init__(self, base, ua, ip):
        self.base, self.ua, self.ip = base, ua, ip
        self.cookie = ''

    @property
    def signed(self):
        return bool(self.cookie)

    def _take(self, headers):
        for line in headers.get_all('set-cookie') or []:
            if line.startswith('m360s='):
                v = line.split(';')[0][len('m360s='):]
                self.cookie = v

    def call(self, a, **body):
        body['a'] = a
        h = {'content-type': 'application/json', 'user-agent': self.ua, 'x-forwarded-for': self.ip}
        if self.cookie:
            h['cookie'] = 'm360s=' + self.cookie
        req = urllib.request.Request(self.base + 'api/m360', data=json.dumps(body).encode(), method='POST', headers=h)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                self._take(r.headers)
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b'{}')
            except Exception:
                return e.code, {}


def main():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store],
                           env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        # the headers on the page
        with urllib.request.urlopen(base) as r:
            h = {k.lower(): v for k, v in r.headers.items()}
        csp = h.get('content-security-policy', '')
        check("default-src 'self'" in csp and "object-src 'none'" in csp and "frame-ancestors 'none'" in csp and 'sha256-' in csp and "'unsafe-eval'" not in csp, 'csp: %r' % csp[:200])
        check(h.get('x-frame-options') == 'DENY' and h.get('x-content-type-options') == 'nosniff' and 'max-age=31536000' in h.get('strict-transport-security', '') and h.get('referrer-policy') == 'strict-origin-when-cross-origin', 'security headers: %r' % {k: h.get(k) for k in ('x-frame-options', 'x-content-type-options', 'strict-transport-security', 'referrer-policy')})
        with urllib.request.urlopen(base + 'version.json') as r:
            check(r.headers.get('x-content-type-options') == 'nosniff', 'the headers should cover every path')
        # setup refuses a breached password, then takes a sound one
        k = Client(base, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/128 Safari/537.36', '203.0.113.10')
        st, j = k.call('setup', name='Kaavish Ramchandani', email='kaavish@mask360.agency', password='password1234')
        check(st == 400 and j.get('error', {}).get('code') == 'weak' and 'breach' in j['error']['message'], 'breached password at setup: %r %r' % (st, j))
        st, j = k.call('setup', name='Kaavish Ramchandani', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        check(st == 200 and j.get('uid'), 'setup: %r %r' % (st, j))
        uid = j.get('uid')
        k.call('mailkey', key='re_securitytestkey000000')
        # two-step: start, a wrong code, the right code, recovery codes
        st, j = k.call('totpstate')
        check(st == 200 and j.get('on') is False, 'totpstate before: %r' % j)
        st, j = k.call('totpstart')
        check(st == 200 and len(j.get('secret', '')) == 32 and j.get('uri', '').startswith('otpauth://totp/m360%20OS:') and 'secret=' + j.get('secret', '') in j.get('uri', ''), 'totpstart: %r' % j)
        secret = j['secret']
        st, j = k.call('totpon', code='000000')
        check(st == 403 and j.get('error', {}).get('code') == 'bad_code', 'a wrong code should be refused: %r %r' % (st, j))
        st, j = k.call('totpon', code=fresh(secret))
        check(st == 200 and j.get('on') is True and len(j.get('recovery', [])) == 8 and all(len(c) == 11 and c[5] == '-' for c in j['recovery']), 'totpon: %r %r' % (st, j))
        recovery = j.get('recovery', [])
        st, j = k.call('totpstate')
        check(j.get('on') is True and j.get('recovery') == 8, 'totpstate after: %r' % j)
        # a fresh device: the password alone is not enough
        d2 = Client(base, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', '198.51.100.7')
        st, j = d2.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        check(st == 200 and j.get('needCode') is True and j.get('tmp') and not d2.signed, 'the password should answer with a challenge: %r %r' % (st, j))
        tmp = j.get('tmp')
        st, j = d2.call('me')
        check(st == 200 and not j.get('uid'), 'no session before the code')
        st, j = d2.call('pw2', tmp=tmp, code='123456')
        check(st == 403 and j.get('error', {}).get('code') == 'bad_code', 'a wrong sign-in code: %r %r' % (st, j))
        code = fresh(secret)
        st, j = d2.call('pw2', tmp=tmp, code=code)
        check(st == 200 and j.get('uid') == uid and d2.signed, 'the right code signs in: %r %r' % (st, j))
        st, j = d2.call('me')
        check(st == 200 and j.get('uid') == uid, 'signed in after the code: %r' % j)
        # the new device got a mail; the same code cannot be used twice
        mails = json.loads(urllib.request.urlopen(base + '__mails').read())
        note = [m for m in mails if m['subject'] == 'New sign-in to m360']
        check(len(note) == 1 and 'kaavish@mask360.agency' in note[0]['to'] and 'iPhone' in note[0]['text'] and '198.51.x.x' in note[0]['text'], 'new device mail: %r' % [(m['to'], m['subject'], m['text'][:80]) for m in note])
        d3 = Client(base, 'Mozilla/5.0 (Windows NT 10.0) Chrome/128', '192.0.2.9')
        st, j = d3.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        st, j = d3.call('pw2', tmp=j.get('tmp'), code=code)
        check(st == 403, 'a replayed code should be refused: %r %r' % (st, j))
        # a recovery code works once
        st, j = d3.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        st, j = d3.call('pw2', tmp=j.get('tmp'), code=recovery[0])
        check(st == 200 and j.get('uid') == uid, 'a recovery code signs in: %r %r' % (st, j))
        st, j = d3.call('totpstate')
        check(j.get('recovery') == 7, 'the recovery code should be spent: %r' % j)
        d4 = Client(base, 'Mozilla/5.0 (Windows NT 10.0) Chrome/128', '192.0.2.9')
        st, j = d4.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        st, j = d4.call('pw2', tmp=j.get('tmp'), code=recovery[0])
        check(st == 403, 'a spent recovery code should be refused: %r' % st)
        # a sign-in link meets the same challenge
        st, j = k.call('mklink')
        st, j = d4.call('login', code=j.get('code'))
        check(st == 200 and j.get('needCode') is True, 'a sign-in link should ask for the code too: %r %r' % (st, j))
        # the throttle: one address hammering the sign-in
        bad = Client(base, 'curl/8', '10.9.9.9')
        codes = []
        for i in range(43):
            st, j = bad.call('pw', email='nobody@mask360.agency', password='wrong-' + str(i))
            codes.append(st)
        check(codes[0] == 401 and 429 in codes and codes[-1] == 429 and codes.index(429) >= 35, 'throttle statuses: first %r, 429 from %r' % (codes[0], codes.index(429) if 429 in codes else None))
        st, j = bad.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        check(st == 429 and j.get('error', {}).get('code') == 'slow_down', 'a throttled address is refused even with the right password: %r' % st)
        st, j = d2.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        check(st == 200 and j.get('needCode'), 'other addresses are not throttled: %r %r' % (st, j))
        # the founder's log
        st, j = k.call('securityinfo')
        kinds = [e['kind'] for e in j.get('events', [])]
        check(st == 200 and 'signin' in kinds and 'code_fail' in kinds and 'throttled' in kinds and 'totp_on' in kinds and j.get('people', {}).get(uid, {}).get('totp') is True, 'securityinfo: %r %r' % (st, kinds[:12]))
        check(all(e.get('ip', '') in ('', '203.0.113.10'[:0]) or e['ip'].endswith('.x.x') or ':' in e['ip'] for e in j.get('events', []) if e.get('ip')), 'addresses in the log should be masked: %r' % [e.get('ip') for e in j.get('events', [])][:5])
        # a member sees no log, and cannot reset anyone's authenticator
        st, j = k.call('invite', name='Durvesh Patil', role='member', email='durvesh@mask360.agency')
        code = j.get('code')
        m = Client(base, 'Mozilla/5.0 (Android 14) Chrome/128', '203.0.113.44')
        if code:
            st, j = m.call('accept', code=code, email='durvesh@mask360.agency', password='cobalt-orchard-9182')
            check(st == 200 and j.get('uid'), 'accept: %r %r' % (st, j))
            muid = j.get('uid')
            st, j = m.call('securityinfo')
            check(st == 403, 'a member should not read the security log: %r' % st)
            st, j = m.call('totpreset', uid=uid)
            check(st == 403, 'a member should not reset an authenticator: %r' % st)
            st, j = m.call('totpstart')
            st, j = m.call('totpon', code=totp(j.get('secret', 'A' * 32)))
            check(st == 200 and j.get('on'), 'a member can turn two-step on: %r %r' % (st, j))
            st, j = k.call('totpreset', uid=muid)
            check(st == 200 and j.get('ok'), 'the owner can reset a lost phone: %r %r' % (st, j))
            st, j = m.call('totpstate')
            check(j.get('on') is False, 'the reset should turn it off: %r' % j)
        else:
            fails.append('could not invite a member to test the member view: %r' % (j,))
        # turning it off needs a current code
        st, j = k.call('totpoff', code='000000')
        check(st == 403, 'off with a wrong code: %r' % st)
        st, j = k.call('totpoff', code=fresh(secret))
        check(st == 200 and j.get('on') is False, 'off with a fresh code: %r %r' % (st, j))
        st, j = d2.call('pw', email='kaavish@mask360.agency', password='vermilion-lantern-2026')
        check(st == 200 and not j.get('needCode') and j.get('uid') == uid, 'no challenge once it is off: %r %r' % (st, j))
        # a body over the limit is refused early
        req = urllib.request.Request(base + 'api/m360', data=b'{}', method='POST', headers={'content-type': 'application/json', 'content-length': str(7 * 1024 * 1024)})
        try:
            urllib.request.urlopen(req, timeout=5); big = 200
        except urllib.error.HTTPError as e:
            big = e.code
        except Exception:
            big = 'cut'
        check(big in (413, 'cut'), 'an oversized body: %r' % big)
    finally:
        srv.terminate()
    if fails:
        for f in fails:
            print('FAIL', f)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
