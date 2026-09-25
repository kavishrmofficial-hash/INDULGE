#!/usr/bin/env python3
"""Two people, one workspace, a lagging listing: what one writes, the other sees within seconds.

The dev store answers blob listings from a copy sixty seconds old (LIST_LAG_MS), the way an edge
listing can lag a write. The per-collection markers the server stamps on every change must carry a
new client, an edit to it, and its deletion from Kaavish's page to Durvesh's page anyway.

Run: cd m360-os && python3 harness/tests/test_sync.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import build_edgeone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    env = dict(os.environ, MOCK_AI='1', LIST_LAG_MS='60000')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            k = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); k.set_default_timeout(20000)
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'sync-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar')
            k.wait_for_function('() => location.hash === "#hq"'); k.wait_for_timeout(500)
            api = lambda pg, a, body=None: pg.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code}))', [a, body or {}])
            # Durvesh is invited and comes in on his own device
            inv = api(k, 'invite', {'email': 'durvesh@mask360.agency', 'name': 'Durvesh Patil'})
            d = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); d.set_default_timeout(20000)
            d.goto(inv['r']['link']); d.wait_for_selector("text=You're invited")
            d.fill('#signin-email', 'durvesh@mask360.agency'); d.fill('#signin-pw', 'sync-test-pw-durvesh')
            d.locator('#invite-go').click(); d.wait_for_selector('.sidebar')
            d.goto(base + '#clients'); d.wait_for_selector('.main')
            # Kaavish makes a client; the listing will not show it for a minute, the marker must
            k.evaluate('() => M.lastCtx.W.set("clients/swiss1", {name: "Swiss Arabian", status: "live", pod: "", owner: M.lastCtx.uid, memory: "", approvals: "", never: "", links: "", updated: Date.now(), by: M.lastCtx.uid})')
            d.wait_for_function('() => !!(M.lastCtx.coll.clients.map.swiss1)', timeout=15000)
            check(d.evaluate('() => M.lastCtx.coll.clients.map.swiss1.status') == 'live', 'a new client should reach the other page despite the listing lag')
            # an edit travels too
            k.evaluate('() => M.lastCtx.W.update("clients/swiss1", {status: "paused", updated: Date.now()})')
            d.wait_for_function('() => M.lastCtx.coll.clients.map.swiss1 && M.lastCtx.coll.clients.map.swiss1.status === "paused"', timeout=15000)
            # and the other way round
            d.evaluate('() => M.lastCtx.W.update("clients/swiss1", {status: "live", updated: Date.now()})')
            k.wait_for_function('() => M.lastCtx.coll.clients.map.swiss1 && M.lastCtx.coll.clients.map.swiss1.status === "live"', timeout=15000)
            # a delete leaves both pages
            k.evaluate('() => M.lastCtx.W.del("clients/swiss1")')
            d.wait_for_function('() => !M.lastCtx.coll.clients.map.swiss1', timeout=15000)
            data = json.loads(urllib.request.urlopen(base + '__store').read())
            check('x/v/clients' in data, 'the clients marker should exist')
            mark = json.loads(data['x/v/clients'])
            check('swiss1' not in mark.get('ids', {}) and 'swiss1' in mark.get('gone', {}), 'the marker should record the deletion %r' % mark)
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except Exception:
            pass
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    return fails


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
