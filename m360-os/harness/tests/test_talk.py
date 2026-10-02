#!/usr/bin/env python3
"""The m360 voice on the site: the standalone page against the real function code, with the dev stand-in
faking the voice box at https://voice.example and Chromium's fake microphone. The status says the box
is on and listens; speak returns wav in the language asked and caches a short line; listen turns a
recording into words with the language heard; the Ask chat takes a spoken question through the Talk
button and reads the reply aloud; the buddy's hold-to-talk records and asks; the Admin card refuses a
wrong key, takes a new voice name and falls back to the environment when removed.

Run: cd m360-os && python3 harness/tests/test_talk.py
"""
import base64
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

KEY = 'vb_test_key_1234567890'


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
    env = dict(os.environ, MOCK_AI='1', VOICE_URL='https://voice.example', VOICE_API_KEY=KEY, VOICE_NAME='m360')
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

    def voice():
        return json.loads(urllib.request.urlopen(base + '__voice').read())

    def store_raw():
        return urllib.request.urlopen(base + '__store').read().decode('utf-8')

    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
            browser = pw.chromium.launch(executable_path=exe, args=args) if exe else pw.chromium.launch(args=args)
            c = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata', permissions=['microphone'])
            f = c.new_page()
            f.set_default_timeout(15000)
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'lamp-orbit-9182')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            f.wait_for_selector('#setup-card')

            # ---- the status, and speaking in Hindi through the box ----
            st = f.evaluate('() => window.M360_API("voicestatus")')
            check(st.get('on') is True and st.get('engine') == 'box' and st.get('listen') is True and st.get('name') == 'm360', 'voicestatus: %r' % st)
            f.evaluate('() => M.speech.refresh()')
            check(f.evaluate('() => M.speech.listenOn()') is True, 'the page knows the box listens')
            sp = f.evaluate('() => window.M360_API("speak", {text: "नमस्ते, आज तीन पिच हैं।", lang: "hi"})')
            check(sp.get('mime') == 'audio/wav' and len(sp.get('audio', '')) > 100 and sp.get('lang') == 'hi' and not sp.get('cached'), 'speak in Hindi: %r' % {k: v for k, v in sp.items() if k != 'audio'})
            v = voice()
            check(v['tts'] == 1 and v['last']['language'] == 'hi' and v['last']['voice'] == 'm360' and v['last']['input'].startswith('नमस्ते'), 'the box was asked in Hindi with the m360 voice: %r' % v)
            sp2 = f.evaluate('() => window.M360_API("speak", {text: "नमस्ते, आज तीन पिच हैं।", lang: "hi"})')
            check(sp2.get('cached') is True and voice()['tts'] == 1, 'the same line comes from the cache')
            bad = f.evaluate('() => window.M360_API("speak", {text: "x".repeat(10), lang: "english"}).then(r => r.lang)')
            check(bad == 'en', 'a bad language code falls back to English: %r' % bad)
            check(f.evaluate('() => M.speech.say("Hi there.", "en")') in (True, False) and voice()['tts'] == 3, 'M.speech.say goes through the box: %r' % voice()['tts'])

            # ---- listening: a recording in, the words out ----
            fake = base64.b64encode(b'\x1a\x45\xdf\xa3' + b'\x00' * 400).decode('ascii')
            heard = f.evaluate('b => window.M360_API("listen", {audio: b, mime: "audio/webm;codecs=opus"})', fake)
            check(heard.get('text') == 'What is overdue on me?' and heard.get('language') == 'en', 'listen: %r' % heard)
            v = voice()
            check(v['stt'] == 1 and v['lastStt']['name'] == 'in.webm' and v['lastStt']['type'] == 'audio/webm' and v['lastStt']['size'] == 404, 'the recording reached the box as a file: %r' % v.get('lastStt'))
            huge = f.evaluate('() => window.M360_API("listen", {audio: "A".repeat(5600000), mime: "audio/webm"}).then(() => "ok", e => e.code)')
            check(huge == 'invalid_argument', 'an oversized recording is refused: %r' % huge)
            check(KEY not in store_raw(), 'the environment key never lands in the store')

            # ---- the Ask chat: Talk, the words land, the reply is read aloud ----
            f.locator('.iconbtn[aria-label="Ask m360"]').click()
            f.wait_for_selector('#ask-input')
            f.click('#ask-aloud')
            check(f.get_attribute('#ask-aloud', 'aria-pressed') == 'true', 'the aloud toggle is on')
            f.locator('.drawer button:has-text("Talk")').click()
            f.wait_for_selector('.drawer button[aria-label="Listening, tap to stop"]')
            f.wait_for_timeout(900)
            f.locator('.drawer button[aria-label="Listening, tap to stop"]').click()
            f.wait_for_selector('.drawer .bubble.me:has-text("What is overdue on me?")')
            f.wait_for_selector('.drawer .bubble.ai:has-text("Here is your day")', timeout=20000)
            f.wait_for_function('n => M.speech.said() >= n', arg=1)
            v = voice()
            check(v['stt'] == 2 and v['tts'] >= 3 and 'Here is your day' in (v['last'] or {}).get('input', ''), 'the reply went to the box to be spoken: %r' % {k: v[k] for k in ('stt', 'tts')})
            check(f.get_attribute('#ask-aloud', 'aria-pressed') == 'true' and f.evaluate('() => localStorage.getItem("m360.askAloud")') == '1', 'aloud is kept')
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.wait_for_timeout(400)

            # ---- the buddy: hold Ctrl + Alt, talk, let go ----
            f.wait_for_function('() => !!M.buddy')
            f.keyboard.down('Control')
            f.keyboard.down('Alt')
            f.wait_for_function('() => M.buddy.state().mode === "listening"')
            f.wait_for_timeout(900)
            f.keyboard.up('Alt')
            f.keyboard.up('Control')
            try:
                f.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
            except Exception:
                fails.append('the buddy never answered: state %r, bubble %r, box %r, errors %r' % (f.evaluate('() => M.buddy.state()'), (f.inner_text('.buddy-bubble') if f.locator('.buddy-bubble').count() else '')[:120], voice(), errors[:3]))
            else:
                check('Here is your day' in f.inner_text('.buddy-bubble'), 'the buddy answered the spoken question: %r' % f.inner_text('.buddy-bubble')[:80])
                check(voice()['stt'] == 3, 'the buddy sent its recording to the box')
            f.keyboard.press('Escape')

            # ---- Admin: the voice box card ----
            f.goto(base + '#admin')
            f.get_by_role('tab', name='Super').click()
            f.wait_for_selector('#voicebox-card')
            check('on, voice m360' in f.inner_text('#voicebox-status'), 'the card shows the environment box: %r' % f.inner_text('#voicebox-status'))
            f.fill('#voicebox-url', 'https://voice.example')
            f.fill('#voicebox-key', 'wrong-key-0000000000')
            f.click('#voicebox-save')
            f.wait_for_selector('#voicebox-err')
            check('refused' in f.inner_text('#voicebox-err'), 'a wrong key is refused: %r' % f.inner_text('#voicebox-err'))
            f.fill('#voicebox-key', KEY)
            f.fill('#voicebox-voice', 'nobody')
            f.click('#voicebox-save')
            f.wait_for_selector('#voicebox-err:has-text("no voice called nobody")')
            f.fill('#voicebox-key', KEY)
            f.fill('#voicebox-voice', 'default')
            f.click('#voicebox-save')
            f.wait_for_selector('#voicebox-status:has-text("on, voice default")')
            check('cuda' in f.inner_text('#voicebox-info') and 'multilingual on' in f.inner_text('#voicebox-info'), 'the card shows the box: %r' % f.inner_text('#voicebox-info'))
            st = f.evaluate('() => window.M360_API("voicestatus")')
            check(st.get('name') == 'default', 'the saved voice wins over the environment: %r' % st)
            f.click('#voicebox-remove')
            f.wait_for_selector('#voicebox-status:has-text("on, voice m360")')
            check(f.evaluate('() => window.M360_API("voicestatus").then(r => r.name)') == 'm360', 'removing the saved box falls back to the environment')
            # a member may not set the box
            st2 = f.evaluate('() => window.M360_API("voicebox", {url: "https://voice.example", key: "%s"}).then(() => "ok", e => e.code)' % KEY)
            check(st2 == 'ok', 'the founder can set the box')
            errs = [e for e in errors if 'AudioContext' not in e and 'play()' not in e and 'NotAllowedError' not in e and 'status of 400' not in e]
            check(not errs, 'console errors: %r' % errs[:3])
            browser.close()
    finally:
        srv.terminate()
        try:
            os.unlink(store)
        except OSError:
            pass
    if fails:
        for x in fails:
            print('FAIL', x)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
