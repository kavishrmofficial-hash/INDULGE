#!/usr/bin/env python3
"""A busy office for the testing agents (harness/agents/m360-tester.md). One call gives a local m360 with real
server code, an in-memory store that answers as slowly as the edge, canned AI, and a team that has been working:
office_sim.mjs runs N people for a while first (chat, tasks, talks, proposals, feed, leave, the books), and can
keep running in the background while you test. Three signed-in people are ready: founder (the owner), admin
(a roster founder) and member. Every password here is made up for the test.

    from harness.sim.office_env import Office
    with Office(users=20, warm=40, keep_busy=True) as o:
        pg = o.page('member', width=390)          # a Playwright page, signed in, phone sized
        pg.goto(o.base + '#talks')
        ...
        o.problems(pg)                            # crashes, console errors, server 500s seen on that page
        o.api('founder', 'snapshot', {})          # (status, body) straight from the API
        o.shot(pg, 'talks-phone')                 # harness/out/bugs/shots/talks-phone.png

Run from m360-os/:  ../../.venv/bin/python my_check.py   (or the venv's python from anywhere; paths are absolute)
env OFFICE_NO_BUILD=1 skips the build when edgeone/public/index.html is already fresh."""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
SHOTS = os.path.join(ROOT, 'harness', 'out', 'bugs', 'shots')
NOISE = ('favicon', 'Download the React DevTools', 'net::ERR_ABORTED', 'WebGL', 'GPU stall', 'THREE.WebGLRenderer')
PEOPLE = {'founder': ('Kaavish Test', 'founder.test@mask360.test', 'Test-founder-7731!Qz'),
          'admin': ('Admin Test', 'admin.test@mask360.test', 'Test-admin-5521!Qz'),
          'member': ('Member Test', 'member.test@mask360.test', 'Test-member-5521!Qz')}


def _free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Office:
    def __init__(self, users=20, warm=40, keep_busy=False, lag='15', build=True):
        self.users, self.warm, self.keep_busy, self.lag = users, warm, keep_busy, str(lag)
        self.build = build and not os.environ.get('OFFICE_NO_BUILD')
        self.cookies, self.uids, self._pw, self._browser, self._ctxs = {}, {}, None, None, []
        self.server500 = []

    # ---------- life ----------
    def __enter__(self):
        if self.build:
            import build_edgeone
            build_edgeone.main()
        self.port = _free_port()
        self.base = 'http://localhost:%d/' % self.port
        env = dict(os.environ, MOCK_AI='1', STORE_LAG_MS=self.lag)
        self.srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(self.port), ':memory:'], env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                urllib.request.urlopen(self.base, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        name, email, pw = PEOPLE['founder']
        seconds = self.warm + (600 if self.keep_busy else 0)
        self.load = subprocess.Popen(['node', os.path.join(ROOT, 'harness', 'sim', 'office_sim.mjs')], cwd=ROOT,
                                     env=dict(os.environ, SIM_PORT=str(self.port), SIM_USERS=str(self.users), SIM_SECONDS=str(seconds),
                                              SIM_FOUNDER_EMAIL=email, SIM_FOUNDER_PW=pw),
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(300):
            st, out, tok = self.raw('pw', {'email': email, 'password': pw})
            if st == 200 and tok:
                self.cookies['founder'], self.uids['founder'] = tok, out.get('uid', '')
                break
            time.sleep(0.3)
        assert self.cookies.get('founder'), 'the office never set up its founder'
        # the live site puts the owner on the roster on first open (empId M360-001); the test office does too
        st, out, _ = self.raw('write', {'op': 'merge', 'path': 'roster/team', 'data': {'members': {self.uids['founder']: {
            'role': 'founder', 'empId': 'M360-001', 'title': 'Founder', 'active': True, 'joined': '2026-01-01', 'pod': 'Studio'}}}}, self.cookies['founder'])
        assert st == 200, out
        for who, role in (('admin', 'founder'), ('member', 'member')):
            name, email, pw = PEOPLE[who]
            st, out, tok = self.raw('signup', {'name': name, 'email': email, 'password': pw})
            assert st == 200, out
            self.cookies[who], self.uids[who] = tok, out['uid']
            st, out, _ = self.raw('write', {'op': 'merge', 'path': 'roster/team', 'data': {'members': {out['uid']: {
                'role': role, 'title': who, 'active': True, 'joined': '2026-10-01', 'pod': 'Studio'}}}}, self.cookies['founder'])
            assert st == 200, out
        if self.warm and not self.keep_busy:
            self.load.wait(timeout=self.warm + 300)
        elif self.warm:
            time.sleep(self.warm)
        return self

    def __exit__(self, *a):
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        finally:
            for p in (getattr(self, 'load', None), getattr(self, 'srv', None)):
                if p and p.poll() is None:
                    p.terminate()

    # ---------- the API ----------
    def raw(self, a, body, cookie=''):
        req = urllib.request.Request(self.base + 'api/m360', data=json.dumps(dict(a=a, **body)).encode(), method='POST',
                                     headers={'content-type': 'application/json', 'cookie': 'm360s=' + cookie if cookie else ''})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                sc = r.headers.get('set-cookie') or ''
                tok = sc.split('m360s=')[1].split(';')[0] if 'm360s=' in sc else ''
                return r.status, json.loads(r.read() or b'{}'), tok
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}'), ''

    def api(self, who, a, body=None):
        st, out, _ = self.raw(a, body or {}, self.cookies[who])
        return st, out

    # ---------- the browser ----------
    def page(self, who, width=1280, height=None, mobile=None):
        from playwright.sync_api import sync_playwright
        if not self._pw:
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch()
        mobile = width < 768 if mobile is None else mobile
        opts = dict(viewport={'width': width, 'height': height or (844 if mobile else 900)}, locale='en-IN', timezone_id='Asia/Kolkata')
        if mobile:
            opts.update(is_mobile=True, has_touch=True)
        ctx = self._browser.new_context(**opts)
        ctx.add_cookies([{'name': 'm360s', 'value': self.cookies[who], 'url': self.base}])
        self._ctxs.append(ctx)
        pg = ctx.new_page()
        pg._errs = []
        pg.on('pageerror', lambda e: pg._errs.append('crash: ' + str(e)[:400]))
        pg.on('console', lambda m: pg._errs.append('console: ' + m.text[:400]) if m.type == 'error' and not any(n in m.text for n in NOISE) else None)
        pg.on('response', lambda r: (self.server500.append(r.url + ' ' + str(r.status)), pg._errs.append('server %d: %s' % (r.status, r.url))) if r.status >= 500 else None)
        pg.goto(self.base)
        pg.wait_for_timeout(2000)
        # a new person is offered the buddy's tour once; a person would tap Later
        later = pg.locator('#tour-later')
        if later.count():
            later.first.click()
            pg.wait_for_timeout(400)
        return pg

    def problems(self, pg, clear=True):
        out = list(dict.fromkeys(pg._errs))
        if pg.locator('#page-crash, #app-crash').count():
            out.append('the page showed its crash card')
        if clear:
            pg._errs.clear()
        return out

    def shot(self, pg, name):
        os.makedirs(SHOTS, exist_ok=True)
        path = os.path.join(SHOTS, name.replace('/', '-').replace(' ', '-') + '.png')
        pg.screenshot(path=path)
        return path
