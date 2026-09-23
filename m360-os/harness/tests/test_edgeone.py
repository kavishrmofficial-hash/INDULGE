#!/usr/bin/env python3
"""EdgeOne standalone test: the real standalone page against the real API function code, run by the local
stand-in server (edgeone/dev/server.mjs) over a file-backed blob store. Two browser contexts are two devices.

Covers first-run setup, a member signing up and asking to join, the founder letting them in, live sync
between the two, private data, sign-in links, AI through the server with tools, and sign out.

Run: cd m360-os && python3 harness/tests/test_edgeone.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def main():
    from playwright.sync_api import sync_playwright
    build_edgeone.main()
    port = free_port()
    store = tempfile.mktemp(suffix='.json')
    env = dict(os.environ, MOCK_AI='1')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    for _ in range(50):
        try:
            urllib.request.urlopen(base, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    fails, errors = [], []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def store_doc(key):
        data = json.loads(urllib.request.urlopen(base + '__store').read())
        return json.loads(data[key]) if key in data else None

    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

            def device(width=1280):
                c = browser.new_context(viewport={'width': width, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
                pg = c.new_page()
                pg.set_default_timeout(12000)
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
                return c, pg

            # ---- first run: the first visitor sets it up and becomes the founder ----
            fc, f = device()
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            check(f.locator('.side-item', has_text='HQ').count() == 1, 'founder has no HQ')
            f.wait_for_selector('#setup-card')
            check(store_doc('d/roster~team') and len(store_doc('d/roster~team')['members']) == 1, 'founder not on roster')
            check(store_doc('d/clients~swisse-wellness-uae') is not None, 'seed missing')

            # nobody else can claim the workspace now
            r = urllib.request.Request(base + 'api/m360', data=b'{"a":"setup","name":"Intruder"}', method='POST', headers={'content-type': 'application/json'})
            try:
                urllib.request.urlopen(r)
                fails.append('second setup allowed')
            except urllib.error.HTTPError as e:
                check(e.code == 409, 'second setup status %d' % e.code)

            # a text/plain post (what a cross-site form can send) never reaches an action
            r2 = urllib.request.Request(base + 'api/m360', data=b'{"a":"me"}', method='POST', headers={'content-type': 'text/plain'})
            try:
                urllib.request.urlopen(r2)
                fails.append('text/plain accepted')
            except urllib.error.HTTPError as e:
                check(e.code == 415, 'text/plain status %d' % e.code)

            # ---- a teammate signs up on their phone and asks to join ----
            mc, m = device(390)
            m.goto(base)
            m.wait_for_selector('text=Welcome to m360')
            check(m.locator('text=Set up m360 OS').count() == 0, 'member offered setup')
            m.fill('#signin-name', 'Durvesh Patil')
            m.get_by_role('button', name='Continue').click()
            m.wait_for_selector('text=Ask to join')
            m.fill('#join-title', 'Brand Strategist')
            m.get_by_role('button', name='Ask to join').click()
            m.wait_for_selector('text=Request sent')
            # a guest reads nothing beyond the roster and settings
            snap = m.evaluate('() => window.M360_API("snapshot")')
            seen = sorted(snap['colls'].keys())
            check(all(c in ('roster', 'settings', 'join') or c.startswith('data/users/') for c in seen if snap['colls'][c]['docs']), 'guest sees %r' % seen)
            check(not snap['colls'].get('handbook', {}).get('docs'), 'guest reads the handbook')

            # ---- the founder sees the request live and lets them in ----
            f.wait_for_selector('.join-banner:has-text("Durvesh Patil wants to join the team")', timeout=15000)
            f.click('.join-banner')
            f.wait_for_selector('#join-requests')
            f.locator('#join-requests').get_by_role('button', name='Let them in').click()
            check(f.input_value('#desk-title') == 'Brand Strategist', 'title not carried over')
            f.get_by_role('button', name='Add to the team').click()
            f.wait_for_function('() => !document.querySelector("#join-requests")')

            # the member's waiting screen opens into the app by itself
            m.wait_for_selector('.topbar', timeout=15000)
            m.wait_for_selector('text=Good', timeout=15000)
            check(m.locator('.tabbar .tab-item', has_text='Home').count() == 1, 'member tabbar missing')

            # ---- rules hold on the server ----
            res = m.evaluate('''async () => {
              const db = await window.claude.use('db');
              const out = {};
              try { await db.doc('roster/team').update({hacked: true}); out.roster = 'wrote'; } catch (e) { out.roster = e.code; }
              try { await db.doc('settings/app').update({start: '09:00'}); out.settings = 'wrote'; } catch (e) { out.settings = e.code; }
              try { await db.doc('feed/' + (await (await window.claude.use('user')).id())).set({posts: []}); out.feed = 'ok'; } catch (e) { out.feed = e.code; }
              try { await db.doc('feed/u_someoneelse00').set({posts: []}); out.other = 'wrote'; } catch (e) { out.other = e.code; }
              return out;
            }''')
            check(res == {'roster': 'invalid_argument', 'settings': 'invalid_argument', 'feed': 'ok', 'other': 'invalid_argument'}, 'rules %r' % res)
            check(not (store_doc('d/roster~team') or {}).get('hacked'), 'roster was changed by a member')
            fsnap = f.evaluate('() => window.M360_API("snapshot")')
            msnap = m.evaluate('() => window.M360_API("snapshot")')
            fuid = f.evaluate('() => window.M360_API("me").then(x => x.uid)')
            check(not any(c.startswith('data/users/' + fuid) for c in msnap['colls']), 'member sees founder private data')
            check('handbook' in msnap['colls'] and msnap['colls']['handbook']['docs'], 'member cannot read handbook')

            # a member cannot mint a sign-in link for the founder, or read names before joining
            res2 = m.evaluate('fu => window.M360_API("mklink", {uid: fu}).then(() => "made", e => e.code)', fuid)
            check(res2 == 'invalid_argument', 'member made a link for the founder: %r' % res2)

            # ---- live sync: the member posts, the founder sees it ----
            m.goto(base + '#feed')
            m.wait_for_selector('#feed-text')
            m.fill('#feed-text', 'Scripts approved in one pass.')
            m.get_by_role('button', name='Post').click()
            f.goto(base + '#feed')
            f.wait_for_selector('text=Scripts approved in one pass.', timeout=15000)

            # ---- sign-in link: the founder makes one, a new device uses it ----
            f.goto(base + '#admin')
            f.locator('tr', has_text='Durvesh Patil').get_by_role('button', name='Sign-in link').click()
            f.wait_for_selector('#signin-link')
            link = f.inner_text('#signin-link').strip()
            check('#login=' in link, 'link %r' % link)
            dc, d = device()
            d.goto(link)
            d.wait_for_selector('.sidebar')
            check('Durvesh Patil' in d.inner_text('.side-foot'), 'link signed in as someone else')
            check('#login=' not in d.url, 'login code left in the address bar')
            d.goto(link)
            d.wait_for_selector('.sidebar')
            ec, e2 = device()
            e2.goto(link)
            e2.wait_for_selector('text=has expired or was already used')

            # ---- AI runs through the server, tools run in the page ----
            d.goto(base + '#home')
            d.get_by_role('button', name='Brief me').click()
            d.wait_for_selector('text=finish the hero reel script', timeout=15000)
            before = len([k for k in json.loads(urllib.request.urlopen(base + '__store').read()) if k.startswith('d/tasks~')])
            # the palette hands a question to Ask m360
            d.keyboard.press('Control+k')
            d.wait_for_selector('#pal-input')
            d.fill('#pal-input', 'add a task to cut the teaser')
            d.wait_for_selector('.pal-item.ai')
            d.keyboard.press('Enter')
            d.wait_for_selector('.drawer:has-text("Ask m360")')
            d.wait_for_function('n => fetch("/__store").then(r => r.json()).then(s => Object.keys(s).filter(k => k.startsWith("d/tasks~")).length > n)', arg=before, timeout=15000)

            # ---- sign out ----
            d.keyboard.press('Escape')
            d.wait_for_function('() => !document.querySelector(".scrim")')
            d.goto(base + '#me')
            d.wait_for_selector('#device-card')
            d.locator('#device-card').get_by_role('button', name='Sign out').click()
            d.locator('#device-card').get_by_role('button', name='Tap again to sign out').click()
            d.wait_for_selector('text=Welcome to m360')

            # ---- AI key card is founder only; the phone layout holds ----
            f.goto(base + '#admin')
            f.wait_for_selector('#ai-key')
            m.goto(base + '#home')
            m.wait_for_selector('.quick')
            ov = m.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow %d' % ov)
            os.makedirs(os.path.join(ROOT, 'harness', 'shots'), exist_ok=True)
            f.goto(base + '#hq')
            f.wait_for_selector('#setup-card')
            f.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'edgeone-hq.png'), full_page=False)
            m.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'edgeone-home-390.png'), full_page=False)
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    bad = [e for e in errors if 'Failed to load resource' not in e]
    check(not bad, 'console errors: %r' % bad[:4])
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))


if __name__ == '__main__':
    main()
