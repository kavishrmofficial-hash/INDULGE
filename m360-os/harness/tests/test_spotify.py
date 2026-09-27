#!/usr/bin/env python3
"""Spotify inside m360 on the EdgeOne stand-in, with Spotify itself played by Playwright routes: the founder
pastes the client ID in Admin, a person presses Connect (a PKCE sign in on accounts.spotify.com), comes back
with a code the page turns into tokens (kept in this browser only), searches, plays a track through the Web
Playback SDK (a stub script here) and the dock shows the player. Then the claude.ai build, where the card
says the player runs on the team address.

Run: cd m360-os && python3 harness/tests/test_spotify.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402

CLIENT_ID = 'abcdef0123456789abcdef0123456789'
SDK_STUB = """
window.Spotify = {Player: class {
  constructor(o) { this.o = o; this.h = {}; window.__sdk = this; }
  addListener(k, f) { this.h[k] = f; return true; }
  async connect() { this.o.getOAuthToken(t => { window.__sdkToken = t; });
    setTimeout(() => { this.h.ready && this.h.ready({device_id: 'dev_m360_1'}); }, 50); return true; }
  disconnect() {}
  async togglePlay() { this.paused = !this.paused; this.emit(); }
  async nextTrack() { window.__next = (window.__next || 0) + 1; }
  async previousTrack() {}
  async seek(ms) { this.pos = ms; this.emit(); }
  async setVolume(v) { window.__vol = v; }
  async pause() { this.paused = true; this.emit(); }
  emit() { this.h.player_state_changed && this.h.player_state_changed({paused: !!this.paused, position: this.pos || 0, duration: 200000,
    track_window: {current_track: {uri: 'spotify:track:t1', name: 'Kesariya', artists: [{name: 'Pritam'}], album: {name: 'Brahmastra', images: [{url: 'https://i.scdn.co/image/a1'}]}}}}); }
}};
if (window.onSpotifyWebPlaybackSDKReady) window.onSpotifyWebPlaybackSDKReady();
"""


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def edge():
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
    fails, errors, seen = [], [], {'auth': None, 'token': [], 'play': [], 'search': 0, 'transfer': None}

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
            c = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
            f = c.new_page()
            f.set_default_timeout(15000)
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

            # Spotify, played by routes: the sign in page bounces straight back with a code, the token endpoint
            # answers tokens, the SDK is a stub, the API answers a search and accepts a play
            def on_auth(route):
                q = urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query)
                seen['auth'] = q
                route.fulfill(status=302, headers={'location': q['redirect_uri'][0] + '?code=code_abc&state=' + q['state'][0]})

            def on_token(route):
                body = urllib.parse.parse_qs(route.request.post_data or '')
                seen['token'].append(body)
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'access_token': 'acc_' + str(len(seen['token'])), 'refresh_token': 'ref_1', 'expires_in': 3600, 'token_type': 'Bearer'}))

            def on_api(route):
                u = route.request.url
                if u.endswith('/v1/me/player') and route.request.method == 'PUT':
                    seen['transfer'] = {'body': route.request.post_data, 'auth': route.request.headers.get('authorization')}
                    route.fulfill(status=204, body='')
                elif u.endswith('/v1/me/player'):
                    route.fulfill(status=200, content_type='application/json', body=json.dumps({'is_playing': True, 'device': {'id': 'phone1', 'name': 'iPhone'},
                        'item': {'uri': 'spotify:track:t9', 'name': 'Chaleya', 'artists': [{'name': 'Arijit Singh'}], 'album': {'name': 'Jawan', 'images': []}}}))
                elif '/v1/me/player/play' in u:
                    seen['play'].append({'url': u, 'body': route.request.post_data, 'auth': route.request.headers.get('authorization')})
                    route.fulfill(status=204, body='')
                elif '/v1/search' in u:
                    seen['search'] += 1
                    route.fulfill(status=200, content_type='application/json', body=json.dumps({
                        'tracks': {'items': [{'uri': 'spotify:track:t1', 'name': 'Kesariya', 'artists': [{'name': 'Pritam'}], 'album': {'images': [{'url': 'https://i.scdn.co/image/a1'}]}, 'duration_ms': 200000}]},
                        'albums': {'items': []}, 'playlists': {'items': [{'uri': 'spotify:playlist:p1', 'name': 'Monday desk', 'owner': {'display_name': 'Kaavish'}, 'images': []}]}}))
                elif u.endswith('/v1/me'):
                    route.fulfill(status=200, content_type='application/json', body=json.dumps({'product': 'premium', 'display_name': 'Kaavish'}))
                else:
                    route.fulfill(status=404, body='{}')

            c.route('https://accounts.spotify.com/authorize**', on_auth)
            c.route('https://accounts.spotify.com/api/token', on_token)
            c.route('https://sdk.scdn.co/spotify-player.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=SDK_STUB))
            c.route('https://api.spotify.com/**', on_api)
            c.route('https://i.scdn.co/**', lambda r: r.fulfill(status=200, content_type='image/png', body=b''))

            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'spotify-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')

            # ---- off: the Music card says the founder switches it on ----
            f.goto(base + '#music')
            f.wait_for_selector('#spotify-card')
            check('Switch Spotify on in Admin' in f.inner_text('#spotify-card'), 'off copy for the founder')

            # ---- Admin: the client ID ----
            f.goto(base + '#admin')
            f.wait_for_selector('#spotify-settings')
            check(f.inner_text('#spotify-redirect') == base, 'redirect uri shown %r' % f.inner_text('#spotify-redirect'))
            f.fill('#spotify-client-id', 'ffffffffffffffffffffffffffffffff')
            f.locator('#spotify-save').click()
            f.wait_for_selector('#spotify-verdict:has-text("does not recognise")')
            f.fill('#spotify-client-id', 'notanid')
            f.locator('#spotify-save').click()
            f.wait_for_selector('#spotify-verdict:has-text("32 letters and digits")')
            f.fill('#spotify-client-id', CLIENT_ID)
            f.locator('#spotify-save').click()
            f.wait_for_selector('#spotify-verdict:has-text("accepts this client ID")')
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => (JSON.parse(s["d/settings~app"]).spotify || {}).clientId === "%s")' % CLIENT_ID)
            check(store_doc('d/settings~app').get('start') == '10:30', 'settings merge kept the rest')
            checks = json.loads(urllib.request.urlopen(base + '__spotify').read())
            check(len(checks) == 2 and checks[-1]['client_id'] == CLIENT_ID and checks[-1]['redirect_uri'] == base, 'server side checks %r' % checks)

            # ---- Home carries the mini player from the first screen: a Connect button before, the player after ----
            f.goto(base + '#home')
            f.wait_for_selector('#spotify-mini #spotify-mini-connect')

            # ---- connect: PKCE to accounts.spotify.com and back with a code ----
            f.goto(base + '#music')
            f.wait_for_selector('#spotify-connect')
            f.locator('#spotify-connect').click()
            f.wait_for_selector('#spotify-card:has-text("Kaavish")', timeout=20000)
            f.wait_for_function('() => location.hash === "#music" && !location.search')
            q = seen['auth']
            check(q and q['client_id'] == [CLIENT_ID] and q['response_type'] == ['code'] and q['code_challenge_method'] == ['S256'] and len(q['code_challenge'][0]) >= 40
                  and q['redirect_uri'] == [base] and 'streaming' in q['scope'][0], 'authorize query %r' % q)
            t = seen['token'][0]
            check(t['grant_type'] == ['authorization_code'] and t['code'] == ['code_abc'] and t['client_id'] == [CLIENT_ID] and len(t['code_verifier'][0]) == 64 and t['redirect_uri'] == [base], 'token exchange %r' % t)
            tok = json.loads(f.evaluate('() => localStorage.getItem("m360.spotify.tok")'))
            check(tok['access'] == 'acc_1' and tok['refresh'] == 'ref_1' and tok['exp'] > time.time() * 1000, 'stored tokens %r' % tok)
            check('ref_1' not in json.dumps(json.loads(urllib.request.urlopen(base + '__store').read())), 'a token reached the store')
            check('premium' not in f.inner_text('#spotify-card').lower() or 'not Premium' not in f.inner_text('#spotify-card'), 'premium account flagged as not premium')

            # ---- the mini player on Home sees the phone playing and pulls it here ----
            f.goto(base + '#home')
            f.wait_for_selector('#spotify-mini-elsewhere:has-text("Chaleya")')
            check('playing on iPhone' in f.inner_text('#spotify-mini-elsewhere'), 'elsewhere line %r' % f.inner_text('#spotify-mini-elsewhere'))
            f.locator('#spotify-mini-move').click()
            f.wait_for_selector('#music-dock #spotify-pane', timeout=20000)
            check(seen['transfer'] and json.loads(seen['transfer']['body']) == {'device_ids': ['dev_m360_1'], 'play': True}, 'transfer call %r' % seen['transfer'])
            f.evaluate('() => { window.__sdk.paused = false; window.__sdk.emit(); }')
            f.wait_for_selector('#spotify-mini-pane:has-text("Kesariya")')
            f.locator('#music-dock').get_by_role('button', name='Stop').click()
            f.wait_for_function('() => !document.querySelector("#music-dock")')
            f.goto(base + '#music')
            f.wait_for_selector('#spotify-q')

            # ---- search and play through the SDK stub ----
            f.fill('#spotify-q', 'kesariya')
            f.locator('#spotify-search').click()
            f.wait_for_selector('#spotify-results .listrow')
            check(f.locator('#spotify-results .listrow').count() == 2 and 'Kesariya' in f.inner_text('#spotify-results') and 'Monday desk' in f.inner_text('#spotify-results'), 'search rows')
            f.locator('#spotify-results .listrow', has_text='Kesariya').get_by_role('button', name='Play').click()
            f.wait_for_selector('#music-dock #spotify-pane', timeout=20000)
            check(len(seen['play']) == 1 and 'device_id=dev_m360_1' in seen['play'][0]['url'] and json.loads(seen['play'][0]['body']) == {'uris': ['spotify:track:t1']}
                  and seen['play'][0]['auth'] == 'Bearer acc_1', 'play call %r' % seen['play'])
            check(f.evaluate('() => window.__sdkToken') == 'acc_1', 'sdk got the access token')
            f.evaluate('() => { window.__sdk.paused = false; window.__sdk.emit(); }')
            f.wait_for_selector('#music-dock #spotify-pane:has-text("Kesariya")')
            check('Pritam' in f.inner_text('#spotify-pane') and '3:20' in f.inner_text('#spotify-pane'), 'pane shows the track %r' % f.inner_text('#spotify-pane'))
            f.locator('#spotify-pane').get_by_role('button', name='Next').click()
            check(f.evaluate('() => window.__next') == 1, 'next reached the sdk')
            f.locator('#spotify-pane').get_by_role('button', name='Pause').click()
            f.wait_for_selector('#spotify-pane [aria-label="Play"]')
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => Object.keys(s).some(k => k.startsWith("d/me~") && (JSON.parse(s[k]).listening || {}).title === "Kesariya"))')
            check('is listening to' in f.inner_text('#spotify-card') and 'Kesariya' in f.inner_text('#spotify-listening'), 'listening chip')
            # the team list: a Spotify link plays in the page now, a YouTube link keeps its embed
            f.fill('#music-link', 'https://open.spotify.com/track/2Xyz1234567890abcdefgh')
            f.fill('#music-title', 'Tum Hi Ho')
            f.locator('#music-save').click()
            f.wait_for_selector('.music-card:has-text("Tum Hi Ho")')
            f.locator('.music-card', has_text='Tum Hi Ho').get_by_role('button', name='Play').click()
            f.wait_for_function('() => window.__plays === undefined ? true : true')
            f.wait_for_function('() => document.querySelector("#music-dock #spotify-pane") && document.querySelector("#music-dock .music-dock-title").textContent.includes("Tum Hi Ho")')
            check(len(seen['play']) == 2 and json.loads(seen['play'][1]['body']) == {'uris': ['spotify:track:2Xyz1234567890abcdefgh']}, 'list card played through the sdk %r' % seen['play'][-1:])
            f.fill('#music-link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
            f.fill('#music-title', 'A video')
            f.locator('#music-save').click()
            f.wait_for_selector('.music-card:has-text("A video")')
            f.locator('.music-card', has_text='A video').get_by_role('button', name='Play').click()
            f.wait_for_selector('#music-dock iframe.music-frame')
            check(f.locator('#music-dock #spotify-pane').count() == 0, 'sdk pane gone for an embed')
            check(f.evaluate('() => window.__sdk.paused') is True, 'sdk paused when an embed took over')

            # ---- an expired token refreshes on the next call, and disconnect forgets it ----
            f.evaluate('() => { const t = JSON.parse(localStorage.getItem("m360.spotify.tok")); t.exp = Date.now() - 1000; localStorage.setItem("m360.spotify.tok", JSON.stringify(t)); }')
            f.fill('#spotify-q', 'again')
            f.locator('#spotify-search').click()
            f.wait_for_function('n => fetch("/__store").then(() => true)', arg=1)
            f.wait_for_timeout(600)
            check(seen['token'][-1]['grant_type'] == ['refresh_token'] and seen['token'][-1]['refresh_token'] == ['ref_1'], 'refresh %r' % seen['token'][-1])
            f.locator('#spotify-disconnect').click()
            f.wait_for_selector('#spotify-connect')
            check(f.evaluate('() => localStorage.getItem("m360.spotify.tok")') is None, 'token forgotten on disconnect')

            # ---- a member without the client id sees the founder note; phone width holds ----
            f.set_viewport_size({'width': 390, 'height': 800})
            f.goto(base + '#music')
            f.wait_for_selector('#spotify-card')
            ov = f.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow %d' % ov)
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    bad = [e for e in errors if 'Failed to load resource' not in e]
    if bad:
        fails.append('console errors: %r' % bad[:4])
    return fails


def mock(h):
    """The claude.ai build: the card explains, the embed still plays, Admin shows the setup without an address."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#music', reset=True, seed=True)
    h.roster(p)
    h.go(p, 'founder', hash='#music', width=1280)
    p.wait_for_selector('#spotify-card')
    check('runs on the team' in p.inner_text('#spotify-card'), 'claude build copy: ' + p.inner_text('#spotify-card')[:80])
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#quick-add')
    check(p.locator('#spotify-mini').count() == 0, 'mini player shown on the claude build')
    h.go(p, 'founder', hash='#admin', width=1280)
    p.wait_for_selector('#spotify-settings')
    check('trailing slash' in p.inner_text('#spotify-settings'), 'admin copy without a site address')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'mock console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = edge()
    fails += run(mock)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
