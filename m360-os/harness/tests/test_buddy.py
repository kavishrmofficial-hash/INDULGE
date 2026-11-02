#!/usr/bin/env python3
"""m360 AI (the buddy): v40 puts no character on the screen. The corner dock is hidden and nothing rides the
cursor; the Ask bar's m360 AI row opens the glass sheet, answers and the tour ring what they point at in flame.
The voice module picks a browser voice or the server voice.
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


ASK = '.pal-item[data-k="a-ai"]'


def ask(p):
    """open the m360 AI sheet the way a person does on a desk: Ctrl+K opens the Ask bar, then its m360 AI row"""
    p.keyboard.press('Control+k')
    p.locator(ASK).click()
    p.wait_for_selector('#buddy-input')


def no_character(p, check, label):
    """v40: nothing of the buddy shows on the screen: the dock is hidden and the pointer never appears"""
    st = p.evaluate('''() => { const h = document.querySelector('#buddy-dock .buddy-home'); const b = document.querySelector('.buddy');
      return {dock: !!(h && h.getClientRects().length), pointer: !!(b && getComputedStyle(b).opacity !== '0'), ride: M.buddy.state().ride}; }''')
    check(not st['dock'] and not st['pointer'] and not st['ride'], '%s: a character shows on the screen: %r' % (label, st))


def mock_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#buddy-dock', state='attached')
    p.wait_for_selector('.buddy', state='attached')
    # v40: no character on the screen, even when the old "ride next to my cursor" pref is set
    p.evaluate('() => { localStorage.setItem("m360.buddyRide", "1"); window.dispatchEvent(new CustomEvent("m360:dockprefs")); }')
    p.mouse.move(300, 300); p.wait_for_timeout(500)
    no_character(p, check, 'idle')
    # the Ask bar's m360 AI row opens the sheet for typing
    ask(p)
    no_character(p, check, 'while asking')
    # ask, get an answer
    p.fill('#buddy-input', 'what is overdue')
    p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble #buddy-answer', timeout=20000)
    no_character(p, check, 'after an answer')
    # the chat thread: expand opens the same thread wide, in the drawer
    p.locator('#buddy-expand').click()
    p.wait_for_selector('.drawer:has-text("what is overdue")')
    check(p.locator('.drawer .bubble.me:has-text("what is overdue")').count() == 1, 'the wide chat should carry the buddy question')
    check(p.locator('.drawer #ask-input').count() == 1 and p.locator('.buddy-bubble').count() == 0, 'expand trades the pop-up for the drawer')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#buddy-dock', state='attached')
    # v40: the buddy has no corner character; m360 AI opens from the Ask bar, with the same thread
    p.keyboard.press('Control+k'); p.locator('.pal-item[data-k=\"a-ai\"]').click()
    p.wait_for_selector('.buddy-bubble:has-text("what is overdue")', timeout=8000)
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    # the pop-up stays where it opened while the mouse moves around
    ask(p)
    p.mouse.move(300, 200); p.wait_for_timeout(900)   # the sheet slides in on a .6s spring
    # v40: it is the glass sheet, 520px, 12px from the right, top and bottom edges, and holds while the mouse moves
    b1 = p.evaluate('() => { const r = document.querySelector(".buddy-bubble").getBoundingClientRect(); return [Math.round(r.right), Math.round(r.bottom)]; }')
    p.mouse.move(700, 500); p.wait_for_timeout(600)
    b2 = p.evaluate('() => { const r = document.querySelector(".buddy-bubble").getBoundingClientRect(); return [Math.round(r.right), Math.round(r.bottom)]; }')
    check(b1 == b2, 'bubble must stay put %r %r' % (b1, b2))
    sh = p.evaluate('''() => { const e = document.querySelector(".buddy-bubble.agent-pop"); const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
      return [Math.round(r.width), Math.round(innerWidth - r.right), Math.round(r.top), Math.round(innerHeight - r.bottom), c.borderTopLeftRadius, c.backdropFilter.indexOf("blur") >= 0]; }''')
    check(sh[0] == 520 and sh[1] == 12 and sh[2] == 12 and sh[3] == 12 and sh[4] == '28px' and sh[5], 'the m360 AI sheet is the glass sheet: %r' % sh)
    check(p.locator('.buddy-bubble .panel-head').count() == 1 and p.locator('.buddy-bubble .panel-composer').count() == 1, 'the pop-up has its head and composer')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    # a how-to becomes a pointed walk with Next between steps, and it never counts as the tour
    p.evaluate('() => localStorage.removeItem("m360.tourSeen")')
    ask(p)
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
    p.wait_for_selector('#buddy-dock', state='attached')
    # it does things: "open new" presses a New button (a sheet opens); a Delete control is only pointed at
    p.evaluate('''() => { window.__spoken = []; M.speech.say = async t => { window.__spoken.push(t); return true; };
      const b = document.createElement('button'); b.textContent = 'Delete this'; b.id = 'risky-btn'; b.onclick = () => { window.__riskyClicked = true; };
      document.querySelector('.main').prepend(b);
      const n = document.createElement('button'); n.textContent = 'New'; n.id = 'new-btn'; n.onclick = () => window.dispatchEvent(new CustomEvent('m360:newtask'));
      document.querySelector('.main').prepend(n); }''')
    ask(p)
    # "open ..." at the start of a sentence is the agent's own grammar (a screen), so the press is asked for in other words
    # v40: the sidebar has no New button (New lives in the Ask bar), so the page gets one: the buddy presses it
    p.fill('#buddy-input', 'click to open new'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("Opened New")', timeout=20000)
    check(p.locator('.drawer:has-text("New task")').count() == 1, 'the New task sheet should be open after the buddy pressed New')
    check(p.locator('.buddy-bubble:has-text("pressed New")').count() == 1, 'the bubble should log the press')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    p.keyboard.press('Escape')
    ask(p)
    p.fill('#buddy-input', 'press delete'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("yours to press")', timeout=20000)
    check(not p.evaluate('() => !!window.__riskyClicked'), 'a risky control must never be pressed by the buddy')
    check(p.locator('.buddy-ring').count() == 1, 'the risky control should be pointed at')
    p.keyboard.press('Escape')
    # it types: into the search field on the Base page
    h.go(p, 'founder', hash='#base', width=1280)
    p.wait_for_selector('#base-q')
    ask(p)
    p.fill('#buddy-input', 'type Swisse into the search'); p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble:has-text("Typed it in")', timeout=20000)
    check(p.input_value('#base-q') == 'Swisse', 'type_into should fill the field, got %r' % p.input_value('#base-q'))
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#buddy-dock', state='attached')
    # the tour: says each stop out loud, opens the section it belongs to, rings each stop, and marks itself done
    p.evaluate('() => { window.__spoken = []; M.speech.say = async t => { window.__spoken.push(t); return false; }; localStorage.setItem("m360.buddyVoice", "1"); }')
    p.evaluate('window.dispatchEvent(new CustomEvent("m360:tour"))')
    p.wait_for_selector('.buddy-bubble.tour')
    p.wait_for_selector('.buddy-ring')
    p.wait_for_timeout(900)
    ring = p.evaluate('() => { const r = document.querySelector(".buddy-ring").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }')
    check(ring[2] > 12 and ring[3] > 12, 'tour: the first stop is not ringed: %r' % ring)
    no_character(p, check, 'on the tour')
    n = p.evaluate('() => M.buddy.tour.count()')
    check(n >= 14, 'founder tour should have every stop, got %r' % n)
    check(p.evaluate('() => window.__spoken.length') == 1 and 'm360' in p.evaluate('() => window.__spoken[0]'), 'first stop should be spoken')
    check('Kaavish' in p.evaluate('() => window.__spoken[0]'), 'the greeting should use their first name')
    for _ in range(6):
        p.locator('.buddy-bubble.tour').get_by_role('button', name='Next').click()
        p.wait_for_timeout(750)
    check(p.evaluate('() => location.hash') == '#chat', 'stop seven should open Chat, got %r' % p.evaluate('() => location.hash'))
    check(p.evaluate('() => window.__spoken.length') == 7, 'every stop should be spoken once, got %r' % p.evaluate('() => window.__spoken.length'))
    check(p.locator('.buddy-bubble.tour:has-text("7 of")').count() == 1, 'progress should read 7 of N')
    p.wait_for_function('() => !M.buddy.state().flying'); p.wait_for_timeout(300)
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
    # v40: the offer is a line in the island; the m360 AI sheet stays shut, and a tap starts the tour
    welcome = '() => /two minute tour/.test((document.getElementById("island") || {}).innerText || "")'
    p.wait_for_function(welcome, timeout=8000)
    check('Hi ' in p.inner_text('#island'), 'welcome should greet by name')
    check(p.locator('.buddy-bubble.agent-pop').count() == 0, 'the welcome must not open the m360 AI sheet over the page')
    p.locator('#island').click()
    p.wait_for_selector('.buddy-bubble.tour', timeout=8000)
    p.locator('.buddy-bubble.tour').get_by_role('button', name='Skip').click()
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#buddy-dock', state='attached'); p.wait_for_timeout(2600)
    check(not p.evaluate(welcome), 'the welcome must not come back once offered')
    p.evaluate('() => localStorage.removeItem("m360.forceWelcome")')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#buddy-dock', state='attached')
    no_character(p, check, 'back on Home')
    # voice: the module exists, picks a voice when the browser has any, and never throws
    v = p.evaluate('() => ({has: !!M.speech, picked: !!M.speech.pick(), n: M.speech.voices().length})')
    check(v['has'], 'M.speech missing')
    p.evaluate('() => M.speech.say("Hello there. This is a test.")')
    p.wait_for_timeout(300)
    p.evaluate('() => M.speech.stop()')
    # the mic button sits in the typed bubble
    ask(p)
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
            f.click('#hq-more')  # v40: HQ opens on Command; the checklist sits under "more from HQ"
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
