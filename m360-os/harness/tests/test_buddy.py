#!/usr/bin/env python3
"""Cursor buddy: the pointer follows the mouse before, during and after an answer and a tour step,
never gets stuck pinned, and the voice module picks a browser voice or the server voice.
Part one runs on the Claude mock; part two runs the voice actions on the EdgeOne stand-in.

Run: cd m360-os && python3 harness/tests/test_buddy.py
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
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402
import build_edgeone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pointer_xy(p):
    return p.evaluate('''() => { const el = document.querySelector('.buddy'); if (!el) return null;
      const m = /translate3d\\(([-\\d.]+)px, ?([-\\d.]+)px/.exec(el.style.transform || ''); return m ? [Number(m[1]), Number(m[2])] : null; }''')


def follows(p, x, y, check, label):
    p.mouse.move(x, y)
    p.wait_for_timeout(120)
    p.mouse.move(x + 4, y + 2)
    p.wait_for_timeout(700)
    xy = pointer_xy(p)
    ok = bool(xy) and abs(xy[0] - (x + 4 + 16)) < 12 and abs(xy[1] - (y + 2 + 14)) < 12
    check(ok, '%s: pointer at %r for mouse at %r' % (label, xy, (x + 4, y + 2)))


def mock_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    p.wait_for_selector('.buddy')
    # idle: follows
    follows(p, 300, 300, check, 'idle')
    # tap the home button: the bubble opens for typing, and the pointer still follows
    p.locator('.buddy-home').click()
    p.wait_for_selector('#buddy-input')
    follows(p, 520, 260, check, 'while asking')
    # ask, get an answer, and the pointer must follow again afterwards
    p.fill('#buddy-input', 'what is overdue')
    p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("Ask another")', timeout=20000)
    follows(p, 700, 420, check, 'after an answer')
    # the chat thread: the buddy's exchange shows in the full chat, and survives a reload
    p.locator('.buddy-bubble').get_by_role('button', name='Open full chat').click()
    p.wait_for_selector('.drawer:has-text("what is overdue")')
    check(p.locator('.drawer .bubble.me:has-text("what is overdue")').count() == 1, 'the full chat should carry the buddy question')
    check(p.locator('.drawer .mark').count() >= 1, 'the full chat should wear the mark')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    check(p.locator('.buddy-home .mark').count() == 1, 'Ask m360 should wear the mark')
    p.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
    p.wait_for_selector('.drawer:has-text("what is overdue")', timeout=8000)
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    # the bubble stays where it opened while the mouse moves around
    p.keyboard.press('Escape')
    p.locator('.buddy-home').click()
    p.wait_for_selector('#buddy-input')
    p.mouse.move(300, 200); p.wait_for_timeout(400)
    b1 = p.evaluate('() => { const r = document.querySelector(".buddy-bubble").getBoundingClientRect(); return [r.left, r.top]; }')
    p.mouse.move(700, 500); p.wait_for_timeout(600)
    b2 = p.evaluate('() => { const r = document.querySelector(".buddy-bubble").getBoundingClientRect(); return [r.left, r.top]; }')
    check(b1 == b2, 'bubble must stay put %r %r' % (b1, b2))
    check(p.locator('.buddy-bubble .pill').count() >= 3, 'quick prompts missing')
    p.keyboard.press('Escape')
    # a how-to becomes a pointed walk with Next between steps, and it never counts as the tour
    p.evaluate('() => localStorage.removeItem("m360.tourSeen")')
    p.locator('.buddy-home').click(); p.wait_for_selector('#buddy-input')
    p.fill('#buddy-input', 'show me how to request leave'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble.tour', timeout=20000)
    p.wait_for_timeout(900)
    check(p.evaluate('() => location.hash') == '#leave', 'the walk should open Leave, got %r' % p.evaluate('() => location.hash'))
    check(p.locator('.buddy-bubble.tour:has-text("1 of 2")').count() == 1 and 'Pick your dates' in p.inner_text('.buddy-bubble'), 'walk step one')
    check(p.locator('.buddy-ring').count() == 1, 'walk should ring the field')
    p.locator('.buddy-bubble.tour').get_by_role('button', name='Next').click(); p.wait_for_timeout(900)
    check('Then tap Request leave' in p.inner_text('.buddy-bubble'), 'walk step two')
    p.locator('.buddy-bubble.tour').get_by_role('button', name='Done').click()
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    check(p.evaluate('() => localStorage.getItem("m360.tourSeen")') is None, 'a walk must not mark the tour as seen')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    # it does things: "open new" presses the New button (a menu appears); a Delete control is only pointed at
    p.evaluate('''() => { window.__spoken = []; M.speech.say = async t => { window.__spoken.push(t); return true; };
      const b = document.createElement('button'); b.textContent = 'Delete this'; b.id = 'risky-btn'; b.onclick = () => { window.__riskyClicked = true; };
      document.querySelector('.main').prepend(b); }''')
    p.locator('.buddy-home').click(); p.wait_for_selector('#buddy-input')
    p.fill('#buddy-input', 'open new'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("Opened New")', timeout=20000)
    check(p.locator('.new-menu, .new-wrap [role="menu"], .new-wrap .menu').count() >= 1 or p.evaluate('() => !!document.querySelector(".new-trigger[aria-expanded=\'true\']")'), 'the New menu should be open after the buddy pressed it')
    check(p.locator('.buddy-bubble:has-text("pressed New")').count() == 1, 'the bubble should log the press')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.locator('.buddy-home').click(); p.wait_for_selector('#buddy-input')
    p.fill('#buddy-input', 'press delete'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("yours to press")', timeout=20000)
    check(not p.evaluate('() => !!window.__riskyClicked'), 'a risky control must never be pressed by the buddy')
    check(p.locator('.buddy-ring').count() == 1, 'the risky control should be pointed at')
    p.keyboard.press('Escape')
    # it types: into the search field on the Base page
    h.go(p, 'founder', hash='#base', width=1280)
    p.wait_for_selector('#base-q')
    p.locator('.buddy-home').click(); p.wait_for_selector('#buddy-input')
    p.fill('#buddy-input', 'type Swisse into the search'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("Typed it in")', timeout=20000)
    check(p.input_value('#base-q') == 'Swisse', 'type_into should fill the field, got %r' % p.input_value('#base-q'))
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    # the tour: says each stop out loud, opens the section it belongs to, points and rings, and marks itself done
    p.evaluate('() => { window.__spoken = []; M.speech.say = async t => { window.__spoken.push(t); return false; }; localStorage.setItem("m360.buddyVoice", "1"); }')
    p.evaluate('window.dispatchEvent(new CustomEvent("m360:tour"))')
    p.wait_for_selector('.buddy-bubble.tour')
    p.wait_for_selector('.buddy-ring')
    p.wait_for_timeout(900)
    ring = p.evaluate('() => { const r = document.querySelector(".buddy-ring").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }')
    xy = pointer_xy(p)
    check(xy and ring[0] - 10 <= xy[0] <= ring[0] + ring[2] + 10 and ring[1] - 10 <= xy[1] <= ring[1] + ring[3] + 10, 'tour: pointer %r is not on the ring %r' % (xy, ring))
    n = p.evaluate('() => M.buddy.tour.count()')
    check(n >= 14, 'founder tour should have every stop, got %r' % n)
    check(p.evaluate('() => window.__spoken.length') == 1 and 'buddy' in p.evaluate('() => window.__spoken[0]'), 'first stop should be spoken')
    check('Kaavish' in p.evaluate('() => window.__spoken[0]'), 'the greeting should use their first name')
    for _ in range(6):
        p.locator('.buddy-bubble.tour').get_by_role('button', name='Next').click()
        p.wait_for_timeout(750)
    check(p.evaluate('() => location.hash') == '#tasks', 'stop seven should open Work, got %r' % p.evaluate('() => location.hash'))
    check(p.evaluate('() => window.__spoken.length') == 7, 'every stop should be spoken once, got %r' % p.evaluate('() => window.__spoken.length'))
    check(p.locator('.buddy-bubble.tour:has-text("7 of")').count() == 1, 'progress should read 7 of N')
    p.wait_for_function('() => !M.buddy.state().flying'); p.wait_for_timeout(300)
    follows(p, 640, 500, check, 'after a tour step')
    check(p.locator('.buddy-ring').count() == 1, 'the ring stays while the tour bubble is open')
    p.locator('.buddy-bubble.tour').get_by_role('button', name='Back').click(); p.wait_for_timeout(600)
    check(p.locator('.buddy-bubble.tour:has-text("6 of")').count() == 1, 'Back should step back')
    p.locator('.buddy-bubble.tour').get_by_role('button', name='Skip').click()
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    p.wait_for_timeout(400)
    check(p.evaluate('() => localStorage.getItem("m360.tourSeen")') == '1', 'skipping should remember the tour was seen')
    p.wait_for_function('() => !!(window.__db.get("data/users/u_founder/state") || {}).tour')
    # a new person is offered the tour on first sign in, once
    p.evaluate('() => { localStorage.removeItem("m360.tourSeen"); localStorage.setItem("m360.forceWelcome", "1"); }')
    h.roster(p, ('u_m1',))
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#tour-yes', timeout=8000)
    check('Hi ' in p.inner_text('.buddy-bubble'), 'welcome should greet by name')
    p.locator('#tour-later').click()
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home'); p.wait_for_timeout(2600)
    check(p.locator('#tour-yes').count() == 0, 'the welcome must not come back once dismissed')
    p.evaluate('() => localStorage.removeItem("m360.forceWelcome")')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    # a still mouse dims the pointer after a while; any move brings it back
    p.mouse.move(400, 300); p.wait_for_timeout(200); p.mouse.move(402, 300)
    p.wait_for_timeout(4600)
    check(p.evaluate('() => document.querySelector(".buddy").classList.contains("still")'), 'pointer should dim when the mouse rests')
    follows(p, 400, 380, check, 'after resting')
    check(not p.evaluate('() => document.querySelector(".buddy").classList.contains("still")'), 'pointer should wake on a move')
    # voice: the module exists, picks a voice when the browser has any, and never throws
    v = p.evaluate('() => ({has: !!M.speech, picked: !!M.speech.pick(), n: M.speech.voices().length})')
    check(v['has'], 'M.speech missing')
    p.evaluate('() => M.speech.say("Hello there. This is a test.")')
    p.wait_for_timeout(300)
    p.evaluate('() => M.speech.stop()')
    # the mic button sits in the typed bubble
    p.locator('.buddy-home').click()
    p.wait_for_selector('#buddy-input')
    check(p.locator('.buddy-bubble .micbtn').count() == 1, 'mic button missing from the bubble')
    p.keyboard.press('Escape')
    # Me: the buddy voice switch
    h.go(p, 'founder', hash='#me', width=1280)
    p.wait_for_selector('#fold-prefs, #prefs-card')
    if p.locator('#fold-prefs .fold-head').count():
        p.locator('#fold-prefs .fold-head').click()
    p.wait_for_selector('#prefs-card')
    p.locator('#prefs-card').get_by_role('tab', name='Off').nth(1).click()
    check(p.evaluate('() => localStorage.getItem("m360.buddyVoice")') == '0', 'buddy voice pref not stored')
    check(p.locator('#tour-again').count() == 1, 'Show me around missing from Prefs')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e) and 'NotSupportedError' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def standalone_part():
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
            f = c.new_page(); f.set_default_timeout(15000)
            f.goto(base)
            f.wait_for_selector('#signin-name')
            f.fill('#signin-name', 'Kaavish Ramchandani'); f.fill('#signin-email', 'kaavish@mask360.agency'); f.fill('#signin-pw', 'buddy-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            f.wait_for_function('() => location.hash === "#hq"', timeout=20000)
            f.wait_for_selector('#setup-card')
            f.wait_for_timeout(500)
            api = lambda a, body=None: f.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code}))', [a, body or {}])
            check(api('voicestatus')['r']['on'] is False, 'voice should start off')
            check(api('speak', {'text': 'hello'})['status'] == 404, 'speak without a voice should be 404')
            bad = api('voicekey', {'key': 'wrong_key_value_123456'})
            check(not bad['ok'] and bad['status'] in (401, 400), 'a refused key %r' % bad)
            r = api('voicekey', {'key': 'el_test_key_0000000000'})
            check(r['ok'] and r['r']['on'] and r['r']['name'] == 'Rachel' and len(r['r']['voices']) == 2, 'voicekey %r' % r)
            r2 = api('voicekey', {'key': '', 'voice': 'v_george_002', 'keep': True})
            check(r2['ok'] and r2['r']['name'] == 'George', 'change voice keeps the key %r' % r2)
            sp = api('speak', {'text': 'Hey, I am the m360 buddy.'})
            check(sp['ok'] and sp['r']['audio'].startswith('SUQz') and sp['r']['mime'] == 'audio/mpeg', 'speak %r' % str(sp)[:120])
            sp2 = api('speak', {'text': 'Hey, I am the m360 buddy.'})
            check(sp2['ok'] and sp2['r'].get('cached') is True, 'second call should come from the cache')
            data = json.loads(urllib.request.urlopen(base + '__store').read())
            check(any(k.startswith('n/tts/') for k in data), 'tts cache blob missing')
            check('el_test_key' not in json.dumps({k: v for k, v in data.items() if not k.startswith('x/')}), 'key leaked outside x/')
            f.goto(base + '#admin'); f.wait_for_selector('#fold-voice .fold-head, #voice-card')
            if f.locator('#fold-voice .fold-head').count():
                f.locator('#fold-voice .fold-head').click()
            f.wait_for_selector('#voice-card')
            check('George' in f.inner_text('#voice-card'), 'voice card should show the chosen voice')
            check(f.evaluate('() => M.speech.serverOn()') in (True, None), 'M.speech should know the server voice')
            # a member may speak but may not manage the voice
            f.evaluate('() => window.M360_API("logout")')
            m = c.new_page(); m.set_default_timeout(15000); m.goto(base); m.wait_for_selector('#signin-email')
            m.get_by_role('button', name='New here without an invite? Ask to join').click()
            m.wait_for_selector('#signin-name'); m.fill('#signin-name', 'Durvesh Patil'); m.fill('#signin-email', 'durvesh@mask360.agency'); m.fill('#signin-pw', 'buddy-test-pw-durvesh')
            m.get_by_role('button', name='Continue').click()
            m.wait_for_selector('text=Ask to join')
            mapi = lambda a, body=None: m.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code}))', [a, body or {}])
            check(mapi('voicekey', {'key': 'el_x_0000000000000000'})['status'] == 403, 'member must not set the voice')
            check(mapi('voices')['status'] == 403, 'member must not list voices')
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except Exception:
            pass
    return fails


if __name__ == '__main__':
    fails = run(mock_part)
    fails += standalone_part()
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
