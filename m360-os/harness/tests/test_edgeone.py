#!/usr/bin/env python3
"""EdgeOne standalone test: the real standalone page against the real API function code, run by the local
stand-in server (edgeone/dev/server.mjs) over a file-backed blob store. Two browser contexts are two devices.

Covers first-run setup (name, email, password), a member signing up and asking to join, the founder letting
them in, live sync between the two, private data, sign-in links, invites that ask for the invited email and a
password, devices and remote sign out, the lock and the join policy, password sign-in with the generic refusal
and the wait after six misses, changing a password from Me, reset codes by email and from the founder, the
founder setting a password for someone, the server activity log, AI through the server with tools, and sign out.
Every password here is made up for the test.

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

    def store_raw():
        return urllib.request.urlopen(base + '__store').read().decode('utf-8')

    def api(body):
        """one API call with no cookie jar: (status, json)"""
        req = urllib.request.Request(base + 'api/m360', data=json.dumps(body).encode('utf-8'), method='POST', headers={'content-type': 'application/json'})
        try:
            r = urllib.request.urlopen(req)
            return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    # made-up passwords, one per person; the test checks that none of them ever lands in the store or the log
    PW = {'k': 'lamp-orbit-9182', 'd': 'desk-river-5531', 'd2': 'desk-river-7742', 'p': 'reel-cutter-3306', 'p2': 'reel-cutter-4417',
          'p3': 'reel-cutter-5528', 'p4': 'reel-cutter-6639', 'a': 'grade-suite-2210'}

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
            check('super admin account' in f.inner_text('.gate'), 'setup does not say it is the super admin account')
            # a weak password never sets the workspace up; the setup needs all three fields
            st, j = api({'a': 'setup', 'name': 'Kaavish Ramchandani', 'email': 'kaavish@mask360.agency', 'password': 'password'})
            check(st == 400 and j['error']['code'] == 'weak', 'weak setup password accepted: %r' % j)
            st, j = api({'a': 'setup', 'name': 'Kaavish Ramchandani', 'email': 'kaavish@mask360.agency', 'password': 'kaavish@mask360.agency'})
            check(st == 400 and j['error']['code'] == 'weak', 'email as password accepted: %r' % j)
            st, j = api({'a': 'setup', 'name': 'Kaavish Ramchandani', 'password': PW['k']})
            check(st == 400, 'setup without an email accepted: %r' % j)
            check(store_doc('o/owner') is None, 'a refused setup made an owner')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            check(f.get_attribute('#signin-pw', 'type') == 'password' and f.get_attribute('#signin-pw', 'autocomplete') == 'new-password', 'setup password field')
            f.fill('#signin-pw', PW['k'])
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            check(f.locator('.side-item', has_text='HQ').count() == 1, 'founder has no HQ')
            f.wait_for_selector('#setup-card')
            check(store_doc('d/roster~team') and len(store_doc('d/roster~team')['members']) == 1, 'founder not on roster')
            check(store_doc('d/clients~swisse-wellness-uae') is not None, 'seed missing')

            # nobody else can claim the workspace now
            st, j = api({'a': 'setup', 'name': 'Intruder', 'email': 'intruder@example.com', 'password': 'intruder-pw-77'})
            check(st == 409, 'second setup status %d' % st)
            me_f = f.evaluate('() => window.M360_API("me")')
            check(me_f.get('hasPw') is True and me_f.get('email') == 'kaavish@mask360.agency', 'me after setup %r' % me_f)

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
            m.wait_for_selector('text=Sign in to m360')
            check(m.locator('text=Set up m360 OS').count() == 0, 'member offered setup')
            check(m.get_attribute('#signin-pw', 'autocomplete') == 'current-password', 'sign-in password field')
            m.get_by_role('button', name='New here without an invite? Ask to join').click()
            m.wait_for_selector('text=Welcome to m360')
            m.fill('#signin-name', 'Durvesh Patil')
            m.fill('#signin-email', 'Durvesh@Mask360.agency')
            m.fill('#signin-pw', '12345678')
            m.get_by_role('button', name='Continue').click()
            m.wait_for_selector('text=too easy to guess')
            m.fill('#signin-pw', PW['d'])
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
            f.keyboard.press('Escape')
            f.wait_for_selector('#signin-link', state='detached')
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

            # ---- invite by email: link only, then through mail ----
            f.goto(base + '#admin')
            f.wait_for_selector('#invite-email')
            f.fill('#inv-email', 'priya@mask360.agency')
            f.fill('#inv-name', 'Priya Nair')
            f.fill('#inv-title', 'Producer')
            f.locator('#invite-email').get_by_role('tab', name='Pod lead').click()
            f.locator('#inv-send').click()
            f.wait_for_selector('#inv-last:has-text("Link for priya@mask360.agency")')
            priya_link = f.inner_text('#inv-last .invite-link').strip()
            check('#invite=' in priya_link, 'invite link %r' % priya_link)
            check(f.locator('#inv-list .listrow').count() == 1, 'pending invite list')
            # switch email on, then an invite goes out by mail
            f.fill('#mail-card input[type="password"]', 're_testkey_1234567890')
            f.locator('#mail-card').get_by_role('button', name='Save').click()
            f.wait_for_selector('#mail-card .pill:has-text("on")')
            f.fill('#inv-email', 'arjun@mask360.agency')
            f.locator('#inv-send').click()
            f.wait_for_selector('#inv-last:has-text("Emailed to")')
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            check(len(mails) == 1 and mails[0]['to'] == ['arjun@mask360.agency'] and '#invite=' in mails[0]['text'], 'invite mail %r' % mails)
            arjun_link = [w for w in mails[0]['text'].split() if '#invite=' in w][0]
            # a revoked invite stops working
            f.fill('#inv-email', 'nope@mask360.agency')
            f.locator('#inv-send').click()
            f.wait_for_selector('#inv-last:has-text("Emailed to nope@")')
            f.wait_for_function('() => document.querySelectorAll("#inv-list .listrow").length === 3')
            row = f.locator('#inv-list .listrow', has_text='nope@mask360.agency')
            row.get_by_role('button', name='Revoke').click()
            row.get_by_role('button', name='Tap again to confirm').click()
            f.wait_for_function('() => document.querySelectorAll("#inv-list .listrow").length === 2')

            # Priya opens her link on a fresh device: nobody is signed in until she types the invited email
            pc, pp = device()
            pp.goto(priya_link)
            pp.wait_for_selector("text=You're invited")
            check(pp.evaluate('() => window.M360_INVITE') == priya_link.split('#invite=')[1], 'shim did not expose the invite code')
            check('Priya Nair' in pp.inner_text('#invite-box'), 'invited name missing')
            check(pp.locator('.sidebar').count() == 0, 'invite signed Priya in by itself')
            pp.fill('#signin-email', 'someone@else.com')
            pp.fill('#signin-pw', PW['p'])
            pp.locator('#invite-go').click()
            pp.wait_for_selector('text=That email does not match this invite.')
            check(not [x for x in store_doc('d/roster~team')['members'].values() if x.get('title') == 'Producer'], 'roster row made before the email matched')
            check(not [k for k in json.loads(urllib.request.urlopen(base + '__store').read()) if k == 'e/priya%40mask360.agency'], 'person made before the email matched')
            pp.fill('#signin-email', ' Priya@Mask360.agency ')
            pp.fill('#signin-pw', 'short')
            pp.locator('#invite-go').click()
            pp.wait_for_selector('text=Use at least 8 characters.')
            check(store_doc('e/priya%40mask360.agency') is None, 'person made before the password was accepted')
            pp.fill('#signin-pw', PW['p'])
            pp.locator('#invite-go').click()
            pp.wait_for_selector('.sidebar')
            check('Priya Nair' in pp.inner_text('.side-foot'), 'invite did not sign Priya in')
            check('#invite=' not in pp.url, 'invite code left in the address bar')
            team = store_doc('d/roster~team')
            priya = [m for m in team['members'].values() if m.get('title') == 'Producer']
            check(priya and priya[0]['role'] == 'lead' and priya[0]['active'] and priya[0]['empId'].startswith('M360-'), 'Priya roster row %r' % priya)
            check(pp.locator('.side-item', has_text='HQ').count() == 0, 'pod lead sees HQ')
            # the same link a second time is dead
            xc, xp = device()
            xp.goto(priya_link)
            xp.wait_for_selector('text=has expired or was already used')
            # Arjun's mailed link works too (no name on the invite), and the pending list clears
            ac, ap = device()
            ap.goto(arjun_link)
            ap.wait_for_selector("text=You're invited")
            ap.fill('#signin-email', 'arjun@mask360.agency')
            ap.fill('#signin-pw', PW['a'])
            ap.locator('#invite-go').click()
            ap.wait_for_selector('.sidebar')
            f.goto(base + '#admin')
            f.wait_for_selector('#invite-email')
            f.wait_for_function('() => !document.querySelector("#inv-list .listrow")', timeout=20000)

            # ---- sign in by email link on another device ----
            zc, zp = device()
            zp.goto(base)
            zp.wait_for_selector('#signin-email')
            zp.locator('#pw-magic').click()
            zp.wait_for_selector('text=Send me a sign-in link')
            zp.fill('#signin-email', 'priya@mask360.agency')
            zp.get_by_role('button', name='Send me a sign-in link').click()
            zp.wait_for_selector('text=Check your email')
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            login = [w for w in mails[-1]['text'].split() if '#login=' in w][0]
            check(mails[-1]['to'] == ['priya@mask360.agency'], 'magic link went to %r' % mails[-1]['to'])
            check('20 minutes' in mails[-1]['text'], 'magic link copy %r' % mails[-1]['text'])
            zp.goto(login)
            zp.wait_for_selector('.sidebar')
            check('Priya Nair' in zp.inner_text('.side-foot'), 'magic link signed in the wrong person')

            # ---- devices: Priya sees both of hers, signs out everywhere else, and the first one drops to the sign-in screen ----
            zp.goto(base + '#me')
            zp.wait_for_selector('#device-card .devlist')
            zp.wait_for_function('() => document.querySelectorAll("#device-card .devlist .listrow").length === 2')
            devs = zp.evaluate('() => window.M360_API("devices").then(r => r.devices)')
            check(len(devs) == 2 and sum(1 for x in devs if x['current']) == 1
                  and all(x['ua'] and x['at'] and x['last'] and len(x['id']) == 8 for x in devs), 'devices %r' % devs)
            check(all(x['ua'] == 'Linux, Chrome' for x in devs), 'device label %r' % [x['ua'] for x in devs])
            zp.locator('#device-card').get_by_role('button', name='Sign out everywhere else').click()
            zp.locator('#device-card').get_by_role('button', name='Tap again to sign them out').click()
            zp.wait_for_function('() => document.querySelectorAll("#device-card .devlist .listrow").length === 1')
            pp.wait_for_selector('text=Sign in to m360', timeout=20000)
            # the founder sees Priya's devices from the roster and can sign her out everywhere
            f.goto(base + '#admin')
            f.locator('tr', has_text='Priya Nair').get_by_role('button', name='Devices').click()
            f.wait_for_selector('#member-devices .listrow')
            check(f.locator('#member-devices .listrow').count() == 1, 'admin device list')
            f.locator('.drawer').get_by_role('button', name='Sign out everywhere').click()
            f.locator('.drawer').get_by_role('button', name='Tap again to sign them out').click()
            f.wait_for_selector('#member-devices:has-text("No devices signed in.")')
            f.keyboard.press('Escape')
            f.wait_for_selector('.drawer', state='detached')
            zp.wait_for_selector('text=Sign in to m360', timeout=20000)
            # a member cannot list or end someone else's sessions
            res4 = m.evaluate('fu => Promise.all([window.M360_API("devices", {uid: fu}).then(() => "ok", e => e.status), window.M360_API("signoutall", {uid: fu}).then(() => "ok", e => e.status)])', fuid)
            check(res4 == [403, 403], 'member touched founder sessions %r' % res4)

            # ---- lock: the founder freezes changes; a member's write is refused, their own status still goes through ----
            f.evaluate('() => window.M360_API("write", {op: "update", path: "settings/app", data: {locked: true}})')
            res5 = m.evaluate('''async () => {
              const uid = (await window.M360_API('me')).uid, out = {};
              try { await window.M360_API('write', {op: 'set', path: 'feed/' + uid, data: {posts: []}}); out.feed = 'wrote'; } catch (e) { out.feed = e.code + ':' + e.status + ':' + e.message; }
              try { await window.M360_API('write', {op: 'set', path: 'me/' + uid, data: {status: 'here'}}); out.me = 'wrote'; } catch (e) { out.me = e.code; }
              try { await window.M360_API('write', {op: 'set', path: 'log/2026-01-01-' + uid, data: {e: {}}}); out.log = 'wrote'; } catch (e) { out.log = e.code + ':' + e.status; }
              return out;
            }''')
            check(res5 == {'feed': 'locked:423:m360 is locked for changes right now', 'me': 'wrote', 'log': 'invalid_argument:403'}, 'lock %r' % res5)
            f.evaluate('() => window.M360_API("write", {op: "update", path: "settings/app", data: {locked: false}})')
            check((store_doc('d/settings~app') or {}).get('locked') is False, 'lock did not clear')

            # ---- join policy: invite only closes signup and hides Ask to join ----
            f.evaluate('() => window.M360_API("write", {op: "update", path: "settings/app", data: {joinPolicy: "invite"}})')
            jc, jp = device()
            jp.goto(base)
            jp.wait_for_selector('#join-closed')
            check(jp.locator('text=New here without an invite? Ask to join').count() == 0, 'join button shown while invite only')
            st, j = api({'a': 'signup', 'name': 'Walk In', 'email': 'walkin@example.com', 'password': 'walk-in-pw-31'})
            check(st == 409 and j['error']['code'] == 'closed', 'signup status %d %r' % (st, j))
            f.evaluate('() => window.M360_API("write", {op: "update", path: "settings/app", data: {joinPolicy: "open"}})')
            jp.reload()
            jp.wait_for_selector('text=New here without an invite? Ask to join')
            # an unknown email gets the same calm answer and no mail
            n_before = len(json.loads(urllib.request.urlopen(base + '__mails').read()))
            yc, yp = device()
            yp.goto(base)
            yp.locator('#pw-magic').click()
            yp.fill('#signin-email', 'stranger@example.com')
            yp.get_by_role('button', name='Send me a sign-in link').click()
            yp.wait_for_selector('text=Check your email')
            check(len(json.loads(urllib.request.urlopen(base + '__mails').read())) == n_before, 'mail sent to a stranger')
            # a signup with an email already on the team is refused
            st, j = api({'a': 'signup', 'name': 'Twin', 'email': 'durvesh@mask360.agency', 'password': 'twin-pw-2020'})
            check(st == 409 and j['error']['code'] == 'taken', 'duplicate signup %r' % j)
            # Durvesh's email from signup is on Me already
            d.goto(base + '#me')
            d.wait_for_selector('#email-card')
            check(d.input_value('#email-card input[type="email"]') == 'durvesh@mask360.agency', 'signup email not on Me')
            check(store_doc('e/durvesh%40mask360.agency') is not None, 'signup email not indexed')

            # ---- passwords: sign in from a fresh device, the generic refusal, the wait after six misses ----
            wc, wp = device()
            wp.goto(base)
            wp.wait_for_selector('#signin-go')
            wp.fill('#signin-email', 'kaavish@mask360.agency')
            wp.fill('#signin-pw', 'wrong-lamp-0000')
            wp.locator('#signin-go').click()
            wp.wait_for_selector('text=That email and password do not match.')
            check(wp.locator('.sidebar').count() == 0, 'wrong password signed in')
            wp.fill('#signin-pw', PW['k'])
            wp.locator('#signin-go').click()
            wp.wait_for_selector('.sidebar')
            check('Kaavish' in wp.inner_text('.side-foot') and wp.locator('.side-item', has_text='HQ').count() == 1, 'founder password sign-in')
            wc.close()
            st, j = api({'a': 'pw', 'email': 'nobody@mask360.agency', 'password': PW['k']})
            check(st == 401 and j['error']['message'] == 'That email and password do not match.', 'unknown email answer %r' % j)
            st, j = api({'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': PW['k']})
            check(st == 401 and j['error']['message'] == 'That email and password do not match.', 'wrong password answer %r' % j)
            check(api({'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': PW['d']})[0] == 200, 'Durvesh password sign-in')
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p']})[0] == 200, 'Priya password sign-in')
            check(api({'a': 'pw', 'email': 'arjun@mask360.agency', 'password': PW['a']})[0] == 200, 'Arjun password sign-in')
            for i in range(6):
                st, j = api({'a': 'pw', 'email': 'arjun@mask360.agency', 'password': 'wrong-grade-%d' % i})
                check(st == 401, 'miss %d status %d' % (i, st))
            st, j = api({'a': 'pw', 'email': 'arjun@mask360.agency', 'password': PW['a']})
            check(st == 429 and j['error']['code'] == 'slow_down' and j['error']['message'] == 'Too many tries. Wait 15 minutes or reset your password.', 'no wait after six misses: %d %r' % (st, j))
            warj = store_doc('w/' + store_doc('e/arjun%40mask360.agency')['uid'])
            check(warj and warj.get('fails') == 6 and warj.get('until', 0) > time.time() * 1000, 'miss counter %r' % warj)

            # ---- Durvesh changes his password from Me; the old one stops working ----
            d.wait_for_selector('#pw-card')
            check(d.locator('#pw-current').count() == 1 and d.get_attribute('#pw-current', 'type') == 'password', 'current password field')
            d.fill('#pw-current', 'not-my-pw-1')
            d.fill('#pw-new', PW['d2'])
            d.locator('#pw-save').click()
            d.wait_for_selector('#pw-card:has-text("That current password does not match.")')
            check(api({'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': PW['d']})[0] == 200, 'password changed on a wrong current')
            d.fill('#pw-current', PW['d'])
            d.fill('#pw-new', PW['d2'])
            d.locator('#pw-save').click()
            d.wait_for_selector('text=Password changed')
            check(api({'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': PW['d']})[0] == 401, 'old password still works')
            check(api({'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': PW['d2']})[0] == 200, 'new password refused')
            d.reload()
            d.wait_for_selector('.sidebar')
            check('Durvesh Patil' in d.inner_text('.side-foot'), 'changing a password ended this session')

            # ---- reset by email: a code, a new password, every other device signed out ----
            p1c, p1 = device()
            p1.goto(base)
            p1.fill('#signin-email', 'priya@mask360.agency')
            p1.fill('#signin-pw', PW['p'])
            p1.locator('#signin-go').click()
            p1.wait_for_selector('.sidebar')
            n_before = len(json.loads(urllib.request.urlopen(base + '__mails').read()))
            st, j = api({'a': 'reset', 'email': 'stranger@example.com', 'base': base})
            check(st == 200 and j == {'sent': True}, 'reset for a stranger %r' % j)
            check(len(json.loads(urllib.request.urlopen(base + '__mails').read())) == n_before, 'reset mail sent to a stranger')
            p2c, p2 = device(390)
            p2.goto(base)
            p2.locator('#pw-forgot').click()
            p2.wait_for_selector('#reset-email')
            p2.fill('#reset-email', 'priya@mask360.agency')
            p2.locator('#reset-send').click()
            p2.wait_for_selector('#reset-code')
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            check(len(mails) == n_before + 1 and mails[-1]['to'] == ['priya@mask360.agency'] and 'reset code is ' in mails[-1]['text'], 'reset mail %r' % mails[-1:])
            code = mails[-1]['text'].split('reset code is ')[1][:6]
            check(code.isdigit() and len(code) == 6 and '15 minutes' in mails[-1]['text'], 'reset code shape %r' % code)
            p2.fill('#reset-code', '000000' if code != '000000' else '000001')
            p2.fill('#reset-pw', PW['p2'])
            p2.locator('#reset-go').click()
            p2.wait_for_selector('text=That code does not match.')
            p2.fill('#reset-code', code)
            p2.locator('#reset-go').click()
            p2.wait_for_selector('.topbar')
            check('Priya' in p2.inner_text('.topbar') or p2.locator('.tabbar').count() == 1, 'reset did not sign Priya in')
            p1.wait_for_selector('text=Sign in to m360', timeout=20000)
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p']})[0] == 401, 'old password survives a reset')
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p2']})[0] == 200, 'reset password refused')
            st, j = api({'a': 'resetpw', 'email': 'priya@mask360.agency', 'code': code, 'password': PW['p3']})
            check(st == 410 and j['error']['code'] == 'expired', 'reset code worked twice %r' % j)
            ov = p2.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow after reset %d' % ov)
            p1.fill('#signin-email', 'priya@mask360.agency')
            p1.fill('#signin-pw', PW['p2'])
            p1.locator('#signin-go').click()
            p1.wait_for_selector('.sidebar')

            # ---- reset with email off: the screen says so and still takes a code; the founder makes one from the roster ----
            check(api({'a': 'mailkey', 'key': ''})[0] == 403, 'mail key changed without a session')
            f.evaluate('() => window.M360_API("mailkey", {key: ""})')
            st, j = api({'a': 'reset', 'email': 'priya@mask360.agency', 'base': base})
            check(st == 200 and j.get('nomail') is True and j.get('sent') is False, 'reset with mail off %r' % j)
            p3c, p3 = device(390)
            p3.goto(base)
            p3.locator('#pw-forgot').click()
            p3.fill('#reset-email', 'priya@mask360.agency')
            p3.locator('#reset-send').click()
            p3.wait_for_selector('#reset-nomail')
            check(p3.inner_text('#reset-nomail').strip() == 'Email is off here. Ask Kaavish for a reset code.', 'nomail line %r' % p3.inner_text('#reset-nomail'))
            check(p3.locator('#reset-code').count() == 1 and p3.locator('#reset-pw').count() == 1, 'code fields hidden when mail is off')
            ov = p3.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow on reset %d' % ov)
            # a member cannot make a code; the founder cannot make one for themselves
            puid = store_doc('e/priya%40mask360.agency')['uid']
            r5 = p1.evaluate('u => window.M360_API("resetcode", {uid: u}).then(() => "made", e => e.status)', puid)
            check(r5 == 403, 'member made a reset code: %r' % r5)
            r6 = f.evaluate('u => window.M360_API("resetcode", {uid: u}).then(() => "made", e => e.status)', fuid)
            check(r6 == 403, 'founder made a reset code for themselves: %r' % r6)
            f.goto(base + '#admin')
            f.locator('tr', has_text='Priya Nair').get_by_role('button', name='Devices').click()
            f.wait_for_selector('#member-pw')
            f.locator('#member-pw').get_by_role('button', name='Reset code').click()
            f.locator('#member-pw').get_by_role('button', name='Tap again to make a code').click()
            f.wait_for_selector('#reset-code-out')
            code2 = f.inner_text('#reset-code-out').strip()
            check(code2.isdigit() and len(code2) == 6, 'founder code %r' % code2)
            p3.fill('#reset-code', code2)
            p3.fill('#reset-pw', PW['p3'])
            p3.locator('#reset-go').click()
            p3.wait_for_selector('.topbar')
            p2.wait_for_selector('text=Sign in to m360', timeout=20000)
            p1.wait_for_selector('text=Sign in to m360', timeout=20000)
            st, j = api({'a': 'resetpw', 'email': 'priya@mask360.agency', 'code': code2, 'password': PW['p4']})
            check(st == 410, 'founder code worked twice %r' % j)
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p3']})[0] == 200, 'code-set password refused')

            # ---- the founder sets a password for Priya: she is signed out everywhere and the new one works ----
            f.fill('#member-pw-new', 'short')
            f.locator('#member-pw').get_by_role('button', name='Set a password for them').click()
            f.locator('#member-pw').get_by_role('button', name='Tap again to set it').click()
            f.wait_for_selector('#member-pw:has-text("Use at least 8 characters.")')
            f.fill('#member-pw-new', PW['p4'])
            f.locator('#member-pw').get_by_role('button', name='Set a password for them').click()
            f.locator('#member-pw').get_by_role('button', name='Tap again to set it').click()
            f.wait_for_selector('text=Password set. They are signed out everywhere.')
            p3.wait_for_selector('text=Sign in to m360', timeout=20000)
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p3']})[0] == 401, 'old password survives the founder setting one')
            check(api({'a': 'pw', 'email': 'priya@mask360.agency', 'password': PW['p4']})[0] == 200, 'founder-set password refused')
            f.keyboard.press('Escape')
            f.wait_for_selector('.drawer', state='detached')
            # a member cannot set anyone else's password, and the founder's own needs the current one
            r7 = d.evaluate('u => window.M360_API("setpw", {uid: u, password: "member-set-1234"}).then(() => "set", e => e.status)', puid)
            check(r7 == 403, 'member set a password for someone else: %r' % r7)
            r8 = f.evaluate('() => window.M360_API("setpw", {password: "founder-new-1234"}).then(() => "set", e => e.code)')
            check(r8 == 'bad_current', 'founder changed their own password without the current one: %r' % r8)
            check(api({'a': 'pw', 'email': 'kaavish@mask360.agency', 'password': PW['k']})[0] == 200, 'founder password changed by mistake')
            for c in (p1c, p2c, p3c):
                c.close()
            # the store never holds a password or a code in the clear; every w/ blob is a salted hash
            raw = store_raw()
            for name, pw in PW.items():
                check(pw not in raw, 'password %s in the store' % name)
            wrecs = [json.loads(v) for k, v in json.loads(raw).items() if k.startswith('w/')]
            check(len(wrecs) >= 4 and all(set(('salt', 'hash', 'iter', 'at')) <= set(w) and w['iter'] == 150000 and len(w['salt']) == 24 and len(w['hash']) == 44 for w in wrecs), 'w blobs %r' % [sorted(w) for w in wrecs][:2])
            check(not [k for k in json.loads(raw) if k.startswith('c/')], 'a used reset code is still stored')
            # mail back on for the rest
            f.evaluate('() => window.M360_API("mailkey", {key: "re_testkey_1234567890"})')

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
            d.locator('#device-card').get_by_role('button', name='Sign out', exact=True).last.click()
            d.locator('#device-card').get_by_role('button', name='Tap again to sign out').click()
            d.wait_for_selector('text=Sign in to m360')

            # ---- the activity log: the founder reads today and sees writes and sign-ins; members cannot ----
            today = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 19800))
            logs = f.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(r => r.docs)', today)
            muid = m.evaluate('() => window.M360_API("me").then(x => x.uid)')
            mine = (logs.get(today + '-' + fuid) or {}).get('e') or {}
            ents = list(mine.values())
            check(ents and all(isinstance(x['at'], int) and isinstance(x['a'], str) and isinstance(x['p'], str) and isinstance(x['s'], str) and len(x['s']) <= 120 for x in ents), 'log shape %r' % ents[:2])
            check(all(k.startswith(str(v['at'])) and len(k) == len(str(v['at'])) + 4 for k, v in mine.items()), 'log ids %r' % list(mine)[:3])
            check(any(x['a'] == 'update' and x['p'] == 'settings/app' and 'joinPolicy' in x['s'] for x in ents), 'settings write not logged: %r' % [x for x in ents if x['a'] == 'update'][:3])
            check(any(x['a'] == 'update' and x['p'] == 'roster/team' and x['s'].startswith('members, updated') for x in ents), 'roster write not logged')
            for a in ('setup', 'invite', 'uninvite', 'mailkey', 'mklink', 'signoutall'):
                check(any(x['a'] == a for x in ents), a + ' not logged: %r' % sorted(set(x['a'] for x in ents)))
            dents = list(((logs.get(today + '-' + muid) or {}).get('e') or {}).values())
            check(any(x['a'] == 'login' for x in dents), 'login not logged: %r' % sorted(set(x['a'] for x in dents)))
            check(any(x['a'] == 'logout' for x in dents), 'logout not logged: %r' % sorted(set(x['a'] for x in dents)))
            check(any(x['a'] == 'signup' for x in dents), 'signup not logged')
            check(any(x['a'] == 'set' and x['p'].startswith('tasks/') and 'title: Cut the teaser' in x['s'] for x in dents), 'task write summary: %r' % [x['s'] for x in dents if x['a'] == 'set'][:4])
            every = [x for doc in logs.values() for x in (doc.get('e') or {}).values()]
            check(not any('@' in x['s'] or 'Priya' in x['s'] or 'Durvesh' in x['s'] for x in every), 'a name or email in the log')
            check(any(x['a'] == 'accept' for x in every) and any(x['a'] == 'magic' for x in every), 'accept or magic not logged')
            for a in ('pw', 'setpw', 'reset', 'resetpw', 'resetcode'):
                check(any(x['a'] == a for x in every), a + ' not logged: %r' % sorted(set(x['a'] for x in every)))
            check(any(x['a'] == 'setpw' and x['s'].endswith('signed out') for x in ents) and any(x['a'] == 'resetcode' for x in ents), 'founder controls not in the founder log')
            blob = json.dumps(logs)
            check(not any(pw in blob for pw in PW.values()) and code not in blob and code2 not in blob, 'a password or code in the log')
            r4 = m.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(() => "read", e => e.code + ":" + e.status)', today)
            check(r4 == 'invalid_argument:403', 'member read logs %r' % r4)
            check('log' not in m.evaluate('() => window.M360_API("snapshot")')['colls'], 'log in member snapshot')
            check('log' not in f.evaluate('() => window.M360_API("snapshot")')['colls'], 'log in founder snapshot')
            check(f.evaluate('() => window.M360_API("logs", {from: "2026-01-01", to: "2026-03-01"}).then(() => "ok", e => e.code)') == 'invalid_argument', 'range over 31 days accepted')
            check(f.evaluate('() => window.M360_API("prunelogs", {})') == {'removed': 0}, 'prune removed fresh logs')
            check(f.evaluate('() => M.logs.read(null, {from: "%s", to: "%s"}).then(d => Object.keys(d).length)' % (today, today)) == len(logs), 'M.logs.read')

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
            m.goto(base + '#me')
            m.wait_for_selector('#pw-card')
            ov = m.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow on Me %d' % ov)
            m.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'edgeone-me-390.png'), full_page=False)

            # ---- taken off the roster: every device of theirs is signed out at once ----
            f.goto(base + '#admin')
            row = f.locator('tr', has_text='Durvesh Patil')
            row.get_by_role('button', name='Remove').click()
            row.get_by_role('button', name='Tap again to confirm').click()
            m.wait_for_selector('text=Sign in to m360', timeout=20000)
            sess = [json.loads(v) for k, v in json.loads(urllib.request.urlopen(base + '__store').read()).items() if k.startswith('s/')]
            check(not [x for x in sess if x['uid'] == muid], 'deactivated member still has sessions')
            check(all('ua' in x and 'last' in x and 'at' in x for x in sess), 'session shape %r' % sess[:1])
            logs = f.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(r => r.docs)', today)
            ents = list(((logs.get(today + '-' + fuid) or {}).get('e') or {}).values())
            check(any(x['a'] == 'signoutall' and 'deactivated' in x['s'] for x in ents), 'deactivation sign-out not logged')
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
