#!/usr/bin/env python3
"""Google Workspace on the EdgeOne stand-in: the admin stores the OAuth client, a person signs in with
Google (the callback turns the code into tokens on the server), and mail, calendar, meetings and drive
come through the m360 API with that person's tokens. Members never see the client secret or any token.

Run: cd m360-os && python3 harness/tests/test_google.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import build_edgeone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_ID = '1234567890-abcdefg.apps.googleusercontent.com'


def main():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    env = dict(os.environ, MOCK_AI='1')
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
            c = browser.new_context(viewport={'width': 1280, 'height': 900})
            f = c.new_page(); f.set_default_timeout(20000)
            f.goto(base); f.wait_for_selector('#signin-name')
            f.fill('#signin-name', 'Kaavish Ramchandani'); f.fill('#signin-email', 'kaavish@mask360.agency'); f.fill('#signin-pw', 'google-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click(); f.wait_for_selector('.sidebar')
            f.wait_for_function('() => location.hash === "#hq"'); f.wait_for_timeout(500)
            api = lambda pg, a, body=None: pg.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code, msg: e.message}))', [a, body or {}])
            st = api(f, 'googlestatus')['r']
            check(st['configured'] is False and st['connected'] is False and st['redirect'] == base.rstrip('/') + '/api/google', 'fresh status %r' % st)
            # the Workspace page says so
            f.goto(base + '#mail'); f.wait_for_selector('#google-unconfigured')
            # Admin sets the client
            f.goto(base + '#admin'); f.wait_for_selector('#fold-google .fold-head, #google-card')
            if f.locator('#fold-google .fold-head').count():
                f.locator('#fold-google .fold-head').click()
            f.wait_for_selector('#google-card')
            check(base.rstrip('/') + '/api/google' in f.inner_text('#google-redirect'), 'the card shows the redirect address')
            bad = api(f, 'googlekey', {'clientId': 'nope', 'clientKey': 'x'})
            check(not bad['ok'] and bad['status'] == 400, 'a bad client id is refused %r' % bad)
            f.fill('#google-id', CLIENT_ID); f.fill('#google-key', 'GOCSPX-test-secret')
            f.locator('#google-save').click()
            f.wait_for_selector('#google-card .pill:has-text("on")')
            # the person connects: start gives Google's address with our redirect and a state the callback honours
            f.goto(base + '#mail'); f.wait_for_selector('#google-go')
            r = api(f, 'googlestart', {'back': '#mail'})
            check(r['ok'] and 'accounts.google.com' in r['r']['url'] and ('redirect_uri=' + urllib.request.quote(base.rstrip('/') + '/api/google', safe='')) in r['r']['url'] and 'client_id=' + urllib.request.quote(CLIENT_ID, safe='') in r['r']['url'], 'start url %r' % r)
            state = r['r']['url'].split('state=')[1].split('&')[0]
            # a wrong code fails softly; the right one lands the tokens
            f.goto(base + 'api/google?code=wrong&state=' + state)
            f.wait_for_selector('.sidebar')
            check('google=error' in f.evaluate('() => location.search') or api(f, 'googlestatus')['r']['connected'] is False, 'a bad code must not connect')
            r2 = api(f, 'googlestart', {'back': '#mail'})
            state2 = r2['r']['url'].split('state=')[1].split('&')[0]
            f.goto(base + 'api/google?code=fake-code-ok&state=' + state2)
            f.wait_for_selector('#mail-list', timeout=20000)
            st2 = api(f, 'googlestatus')['r']
            check(st2['connected'] is True and st2['who'] == 'kaavish@mask360.agency', 'connected status %r' % st2)
            # a used state is dead: the callback sends the browser back with an error, never a second connection
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, *a, **k):
                    return None
            opener = urllib.request.build_opener(NoRedirect)
            try:
                opener.open(base + 'api/google?code=fake-code-ok&state=' + state2)
                where = ''
            except urllib.error.HTTPError as e:
                where = e.headers.get('location') or ''
            check('google=error' in where, 'a state works once %r' % where)
            # mail: the list, unread first, open marks read, reply goes through the thread
            rows = f.evaluate('() => [...document.querySelectorAll("#mail-list .mail-row")].map(r => ({t: r.innerText, unread: r.classList.contains("unread")}))')
            check(len(rows) == 2 and rows[0]['unread'] and 'Shoot dates' in rows[0]['t'], 'mail rows %r' % rows)
            f.locator('#mail-list .mail-row').first.click()
            f.wait_for_selector('.drawer:has-text("Shoot dates")')
            f.wait_for_selector('.drawer .mail-frame, .drawer .mail-body')
            check(f.locator('#mail-list .mail-row.unread').count() == 0, 'opening should mark the message read')
            f.locator('#mail-reply').click(); f.wait_for_selector('#mail-text')
            f.fill('#mail-text', 'Yes, Tuesday and Wednesday work.'); f.locator('#mail-send').click()
            f.wait_for_function('() => !document.querySelector("#mail-text")', timeout=15000)
            sent = f.evaluate('() => window.M360_API("gmail", {q: "in:sent"}).then(r => r.messages.length)')
            data_sent = None
            for _ in range(20):
                data_sent = json.loads(urllib.request.urlopen(base + '__store').read())
                break
            # what left the building
            raw = f.evaluate('() => fetch("/__google").then(r => r.json())')
            check(len(raw['sent']) == 1 and 'To: priya@swisse.example' in raw['sent'][0]['raw'] and 'In-Reply-To: <abc123@swisse.example>' in raw['sent'][0]['raw'] and raw['sent'][0]['threadId'] == 'gt1', 'reply mime %r' % (raw['sent'][:1]))
            check(any(m['id'] == 'gm1' and 'UNREAD' in (m.get('removeLabelIds') or []) for m in raw['modified']), 'read mark should reach Google %r' % raw['modified'])
            # new mail with a bad address is refused before Google sees it
            bad2 = api(f, 'gmailsend', {'to': 'not an address', 'subject': 'x', 'text': 'y'})
            check(not bad2['ok'] and bad2['status'] == 400, 'bad address refused %r' % bad2)
            # search narrows
            f.fill('#mail-q', 'invoice'); f.wait_for_timeout(600)
            f.wait_for_function('() => document.querySelectorAll("#mail-list .mail-row").length === 1')
            # calendar: today's meeting with a Meet link, a new meeting with a link, rsvp
            f.goto(base + '#gcal'); f.wait_for_selector('#cal-card .cal-ev')
            check('Join Meet' in f.inner_text('#cal-card') and 'Swisse creative review' in f.inner_text('#cal-card'), 'calendar shows the meeting with Meet')
            f.locator('#cal-card .cal-ev .chip:has-text("Yes")').first.click()
            f.wait_for_timeout(400)
            f.locator('#cal-new').click(); f.wait_for_selector('#cal-title')
            f.fill('#cal-title', 'Marina kickoff'); f.fill('#cal-who', 'ops@marina.example')
            f.locator('#cal-make').click()
            f.wait_for_function('() => !document.querySelector("#cal-title")', timeout=15000)
            raw = f.evaluate('() => fetch("/__google").then(r => r.json())')
            ev = raw['created'][-1] if raw['created'] else {}
            check(ev.get('summary') == 'Marina kickoff' and ev.get('conferenceData') and ev['attendees'][0]['email'] == 'ops@marina.example', 'meeting made with Meet %r' % ev)
            # drive
            f.goto(base + '#drive'); f.wait_for_selector('#drive-list .listrow')
            check(f.locator('#drive-list .listrow').count() == 2, 'drive files')
            # the token refresh path: expire the access token, the next call refreshes through the refresh token
            f.evaluate('() => fetch("/__google?expire=1")')
            r3 = api(f, 'gcal')
            raw = f.evaluate('() => fetch("/__google").then(r => r.json())')
            check(r3['ok'] and raw['refreshed'] >= 1, 'an expired access token should refresh %r %r' % (r3.get('ok'), raw['refreshed']))
            # nothing secret leaks to a page
            data = json.loads(urllib.request.urlopen(base + '__store').read())
            snap = api(f, 'snapshot')['r']
            blob = json.dumps(snap)
            check('rt_good' not in blob and 'GOCSPX' not in blob and 'x/g/' not in blob, 'tokens must never reach a page')
            check(any(k.startswith('x/g/') for k in data), 'tokens should be stored under x/g/')
            # a member cannot set the client or read the founder's Google; their own is separate
            inv = api(f, 'invite', {'email': 'durvesh@mask360.agency', 'name': 'Durvesh Patil'})
            d = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); d.set_default_timeout(20000)
            d.goto(inv['r']['link']); d.wait_for_selector("text=You're invited")
            d.fill('#signin-email', 'durvesh@mask360.agency'); d.fill('#signin-pw', 'google-test-pw-durvesh')
            d.locator('#invite-go').click(); d.wait_for_selector('.sidebar')
            check(api(d, 'googlekey', {'clientId': CLIENT_ID, 'clientKey': 'x'})['status'] == 403, 'a member must not set the client')
            std = api(d, 'googlestatus')['r']
            check(std['configured'] is True and std['connected'] is False and std.get('clientId', '') == '', 'a member sees configured, not connected, no client id %r' % std)
            check(api(d, 'gmail')['code'] == 'google_off', 'mail without a connection is google_off')
            d.goto(base + '#mail'); d.wait_for_selector('#google-go')
            # disconnect
            api(f, 'googledisconnect')
            check(api(f, 'googlestatus')['r']['connected'] is False, 'disconnect should clear the connection')
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
