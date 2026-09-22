"""Local QA harness: build, serve over 127.0.0.1, drive with Playwright. Never shipped.

Usage from a test:
    from harness.lib import run
    def test(h):
        page = h.open('founder', width=1280, hash='#today', reset=True, seed=True)
        ...
    run(test)

Isolated module builds (so parallel work never collides):
    M360_MODULES=10-today.js,11-checkin.js M360_TAG=today python3 harness/tests/test_today.py
builds core plus the listed modules only, into dist/index.today.html and harness/out/index.today.html.
The localStorage database is per origin and shared by every test on the same port; pass reset=True on the
first open of a scenario. Identities: founder (owner), m1, m2, m3 (members once added to the roster), outsider.
Helpers on the page: window.__db.set(path, doc) / window.__db.get(path) seed or inspect documents directly,
window.__downloads records downloads.save calls, window.__mcpCalls records connector watches, M.lastCtx is the
live app context (see h.ctx). h.roster(page, uids) puts members on the roster; h.seed_doc(page, path, doc) writes
one document. After seeding, wait ~200 ms for snapshots to deliver before asserting on the DOM.
"""
import http.server
import os
import socketserver
import sys
import threading
import functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import build as builder  # noqa: E402

WRAP_HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
             '<meta name="color-scheme" content="light">'
             '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
             'body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style>'
             '<script src="/harness/mock.js"></script></head><body>')
WRAP_TAIL = '</body></html>'


def build_all():
    out = builder.build()
    page = open(out, encoding='utf-8').read()
    # the sandboxed browser has no CDN access; serve pinned local copies of the same UMD builds
    for url, local in ((builder.CDN[0], '/harness/vendor/react.js'), (builder.CDN[1], '/harness/vendor/react-dom.js'),
                       (builder.CDN[2], '/harness/vendor/htm.js')):
        assert url in page, 'CDN tag missing: ' + url
        page = page.replace(url, local)
    wrapped = WRAP_HEAD + page + WRAP_TAIL
    os.makedirs(os.path.join(ROOT, 'harness', 'out'), exist_ok=True)
    with open(os.path.join(ROOT, 'harness', 'out', out_name()), 'w', encoding='utf-8') as f:
        f.write(wrapped)


def out_name():
    tag = os.environ.get('M360_TAG', '')
    return 'index%s.html' % ('.' + tag if tag else '')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Harness:
    def __init__(self, port, browser, headless=True):
        self.port = port
        self.browser = browser
        self.contexts = []
        self.console = []

    def url(self, ident='founder', hash='', **params):
        p = {'as': ident}
        p.update({k: v for k, v in params.items() if v is not None and v is not False})
        for k in list(p):
            if p[k] is True:
                p[k] = '1'
        qs = '&'.join('%s=%s' % (k, v) for k, v in p.items())
        return 'http://127.0.0.1:%d/harness/out/%s?%s%s' % (self.port, out_name(), qs, hash)

    def open(self, ident='founder', width=1280, height=900, hash='', geo=None, reset=False, seed=False, wait=True, **params):
        """Open a fresh browser context (own localStorage is shared across contexts only via the same origin, so
        pass reset=True on the first open of a scenario). geo=(lat, lng, accuracy) grants geolocation."""
        opts = {'viewport': {'width': width, 'height': height}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata'}
        if geo:
            opts['geolocation'] = {'latitude': geo[0], 'longitude': geo[1], 'accuracy': geo[2] if len(geo) > 2 else 30}
            opts['permissions'] = ['geolocation']
        ctx = self.browser.new_context(**opts)
        self.contexts.append(ctx)
        page = ctx.new_page()
        page.set_default_timeout(8000)
        page.on('console', lambda m: self.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: self.console.append(('pageerror', str(e))))
        page.goto(self.url(ident, hash, reset=reset, seed=seed, **params))
        if wait:
            self.ready(page)
        return page

    def roster(self, page, uids=('u_m1', 'u_m2', 'u_m3'), extra=None):
        """Seed roster/team with the founder plus the given member ids (harness shortcut, bypasses rules).
        extra = {uid: {field: value}} overrides per member (joined, probationEnd, start, role, pod, title)."""
        members = {'u_founder': {'role': 'founder', 'empId': 'M360-001', 'title': 'Founder', 'pod': '', 'joined': '2024-01-01',
                                 'start': '', 'probationEnd': '', 'active': True}}
        titles = {'u_m1': ('Brand Strategist', 'Pod 1'), 'u_m2': ('Creative Lead', 'Pod 1'), 'u_m3': ('Producer', 'Pod 2')}
        n = 2
        for u in uids:
            t = titles.get(u, ('Member', ''))
            members[u] = {'role': 'member', 'empId': 'M360-%03d' % n, 'title': t[0], 'pod': t[1], 'joined': '2026-01-05',
                          'start': '', 'probationEnd': '', 'active': True}
            members[u].update((extra or {}).get(u, {}))
            n += 1
        page.evaluate('m => window.__db.set("roster/team", {members: m, nextEmp: %d, updated: Date.now()})' % n, members)
        page.wait_for_timeout(150)

    def seed_doc(self, page, path, doc):
        page.evaluate('([p, d]) => window.__db.set(p, d)', [path, doc])
        page.wait_for_timeout(120)

    def ctx(self, page, expr):
        """Evaluate an expression against the live app context, e.g. h.ctx(page, 'M.rules.evaluate(ctx, new Date())')."""
        return page.evaluate('() => { const ctx = M.lastCtx; return (%s); }' % expr)

    def ready(self, page):
        page.wait_for_function("() => !document.querySelector('.gate') || !/Signing you in/.test(document.body.innerText)")
        page.wait_for_timeout(120)

    def errors(self):
        return [c for c in self.console if c[0] in ('error', 'pageerror')]

    def overflow(self, page):
        return page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')

    def small_text(self, page):
        return page.evaluate('''() => {
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            if (!el.textContent || !el.textContent.trim()) continue;
            if (!['DIV','SPAN','P','H1','H2','H3','LABEL','BUTTON','TD','TH','A','LI','SMALL','I','B','STRONG','INPUT','TEXTAREA','SELECT','OPTION'].includes(el.tagName)) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const fs = parseFloat(cs.fontSize);
            if (fs < 11) out.push([el.tagName, fs, el.textContent.trim().slice(0, 40)]);
          }
          return out.slice(0, 20);
        }''')

    def shot(self, page, name):
        os.makedirs(os.path.join(ROOT, 'harness', 'shots'), exist_ok=True)
        page.screenshot(path=os.path.join(ROOT, 'harness', 'shots', name + '.png'), full_page=True)

    def close(self):
        for c in self.contexts:
            try:
                c.close()
            except Exception:
                pass


def run(fn, headless=True, build=True):
    """Build, serve and run fn(harness) with a Chromium browser. Returns fn's result."""
    from playwright.sync_api import sync_playwright
    if build:
        build_all()
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler) as httpd:
        port = httpd.server_address[1]
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        with sync_playwright() as p:
            exe = os.environ.get('PW_CHROMIUM')
            browser = p.chromium.launch(headless=headless, executable_path=exe) if exe else p.chromium.launch(headless=headless)
            h = Harness(port, browser)
            try:
                return fn(h)
            finally:
                h.close()
                browser.close()
                httpd.shutdown()
