#!/usr/bin/env python3
"""The browser inside m360: tabs, spaces, full screen inside the shell, links from the rest of m360
opening here, the frame helper's messages (a popped out link comes back in, the address follows the
frame), the desktop bridge (window.m360desktop) driving native views; then on the EdgeOne stand-in,
reading mode: a site that refuses frames is fetched by the server and shown inside, its links stay
inside, the address and the title follow, and no helper nag anywhere.

Run: cd m360-os && python3 harness/tests/test_web.py
"""
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

FAKE_DESKTOP = '''
window.__native = {calls: [], updates: null, news: null, seq: 0};
window.m360desktop = {
  version: 1,
  open: url => { window.__native.calls.push(['open', url]); return Promise.resolve(++window.__native.seq); },
  activate: id => { window.__native.calls.push(['activate', id]); return Promise.resolve(); },
  hide: () => { window.__native.calls.push(['hide']); return Promise.resolve(); },
  close: id => { window.__native.calls.push(['close', id]); return Promise.resolve(); },
  navigate: (id, url) => { window.__native.calls.push(['navigate', id, url]); return Promise.resolve(); },
  back: id => { window.__native.calls.push(['back', id]); return Promise.resolve(); },
  forward: id => { window.__native.calls.push(['forward', id]); return Promise.resolve(); },
  reload: id => { window.__native.calls.push(['reload', id]); return Promise.resolve(); },
  setBounds: b => { window.__native.bounds = b; window.__native.calls.push(['bounds']); return Promise.resolve(); },
  outside: url => { window.__native.calls.push(['outside', url]); return Promise.resolve(); },
  onUpdate: cb => { window.__native.updates = cb; return () => { window.__native.updates = null; }; },
  onNew: cb => { window.__native.news = cb; return () => { window.__native.news = null; }; }
};
'''


def test(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, height=820, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, ('u_m1',))
    # the layout: a rail with spaces and tabs, a stage
    h.go(p, 'founder', hash='#web', width=1280)
    p.wait_for_selector('#web-rail')
    check(p.locator('#web-helper').count() == 0, 'no helper nag in the rail')
    check(p.locator('#web-marks .web-space:not(.add)').count() >= 4, 'starter spaces')
    check(p.locator('#web-tabs .web-tab').count() == 1, 'one empty tab to begin with')
    p.fill('#web-url', 'example.com'); p.keyboard.press('Enter')
    p.wait_for_selector('#web-frame')
    check(p.evaluate('() => document.querySelector("#web-frame").src') == 'https://example.com/', 'the frame takes the address')
    check('example.com' in p.inner_text('#web-tabs .web-tab.active'), 'the tab is named after the host')
    # a second tab, then back to the first
    p.locator('#web-newtab').click()
    p.wait_for_function('() => document.querySelectorAll("#web-tabs .web-tab").length === 2')
    p.fill('#web-url', 'wikipedia.org'); p.keyboard.press('Enter')
    p.wait_for_function('() => document.querySelector("#web-frame") && document.querySelector("#web-frame").src.includes("wikipedia")')
    p.locator('#web-tabs .web-tab-btn').first.click()
    p.wait_for_function('() => document.querySelector("#web-frame").src === "https://example.com/"')
    check(p.input_value('#web-url') == 'https://example.com/', 'the address follows the tab')
    # full screen inside m360: the shell steps aside, the stage fills the window, Escape returns
    p.locator('#web-focus').click()
    p.wait_for_function('() => document.body.classList.contains("web-focus")')
    check(not p.locator('.sidebar').is_visible(), 'the sidebar should hide in full screen')
    r = p.evaluate('() => document.querySelector("#web").getBoundingClientRect().height')
    check(r >= 800, 'the browser should take the whole window, got %r' % r)
    st = p.evaluate('() => { const r = document.querySelector(".web-stage").getBoundingClientRect(); return [Math.round(r.height), Math.round(r.right)]; }')
    check(st[0] >= 780 and st[1] >= 1270, 'the stage should fill the window, got %r' % st)
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.body.classList.contains("web-focus")')
    check(p.locator('.sidebar').is_visible(), 'the sidebar returns')
    # a link elsewhere in m360 that would have opened a browser tab opens here
    h.go(p, 'founder', hash='#chat', width=1280)
    p.wait_for_selector('#chat-input')
    p.fill('#chat-input', 'brief is at https://brief.example/deck'); p.keyboard.press('Enter')
    p.wait_for_selector('.chat-text a')
    p.locator('.chat-text a').click()
    p.wait_for_function('() => location.hash === "#web"')
    p.wait_for_function('() => document.querySelector("#web-frame") && document.querySelector("#web-frame").src === "https://brief.example/deck"')
    n = p.locator('#web-tabs .web-tab').count()
    check(n >= 3, 'the link should open in a new tab here, got %r tabs' % n)
    # the helper: a popped out link comes back in; the frame's own navigation moves the address
    p.evaluate('() => window.postMessage({m360ext: "open", url: "https://popped.example/page"}, "*")')
    p.wait_for_function('() => document.querySelector("#web-frame") && document.querySelector("#web-frame").src === "https://popped.example/page"')
    p.evaluate('() => window.postMessage({m360ext: "nav", url: "https://popped.example/page/two"}, "*")')
    p.wait_for_function('() => document.querySelector("#web-url").value === "https://popped.example/page/two"')
    check(p.locator('#web-back').is_enabled(), 'a reported navigation should make Back possible')
    p.locator('#web-back').click()
    p.wait_for_function('() => document.querySelector("#web-frame").src === "https://popped.example/page"')
    # a site that never allows frames stays outside, so nothing here breaks
    check(p.evaluate('() => M.web.open("https://www.linkedin.com/in/kaavish")') is False, 'a refusing site is not queued')
    # spaces are shared with the team
    p.locator('#web-save').click(); p.wait_for_selector('#web-title'); p.fill('#web-title', 'Popped'); p.keyboard.press('Enter')
    p.wait_for_selector('#web-marks .web-space:has-text("Popped")')
    h.go(p, 'm1', hash='#web', width=1280)
    p.wait_for_selector('#web-marks .web-space:has-text("Popped")')
    # phone: no sideways scroll, tabs in a row
    h.go(p, 'm1', hash='#web', width=390)
    p.wait_for_selector('#web-rail')
    check(p.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, 'no sideways scroll on the phone')
    # the desktop bridge: tabs become native views that follow the stage
    d = p.context.new_page(); d.set_default_timeout(8000)
    d.add_init_script(FAKE_DESKTOP)
    d.set_viewport_size({'width': 1280, 'height': 820}); d.goto(h.url('founder', '#web')); h.ready(d)
    d.wait_for_selector('#web-rail')
    d.fill('#web-url', 'https://app.apollo.io/'); d.keyboard.press('Enter')
    d.wait_for_function('() => window.__native.calls.some(c => c[0] === "open" && c[1] === "https://app.apollo.io/")')
    d.wait_for_selector('#web-slot')
    d.wait_for_function('() => window.__native.calls.some(c => c[0] === "activate") && window.__native.bounds && window.__native.bounds.width > 300')
    check(d.locator('#web-frame').count() == 0, 'no iframe on the desktop, the native view takes the stage')
    d.evaluate('() => window.__native.updates({id: 1, url: "https://app.apollo.io/#/home", title: "Apollo home", loading: false, canBack: true, canFwd: false})')
    d.wait_for_function('() => document.querySelector("#web-tabs .web-tab.active .web-tab-title").textContent === "Apollo home"')
    check(d.input_value('#web-url') == 'https://app.apollo.io/#/home', 'the address follows the native view')
    check(d.locator('#web-back').is_enabled(), 'Back follows the native history')
    d.locator('#web-back').click()
    check(d.evaluate('() => window.__native.calls.some(c => c[0] === "back")'), 'Back drives the native view')
    d.evaluate('() => window.__native.news({id: 2, url: "https://popup.example/"})')
    d.wait_for_function('() => document.querySelectorAll("#web-tabs .web-tab").length === 2')
    check('popup.example' in d.inner_text('#web-tabs .web-tab.active'), 'a native popup becomes a tab here')
    d.close()
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e) and 'favicons' not in str(e) and 'net::' not in str(e)]
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
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
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
            errs = []
            k.on('pageerror', lambda e: errs.append(str(e)))
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'web-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(400)
            k.goto(base + '#web'); k.wait_for_selector('#web-rail')
            check(k.locator('#web-helper').count() == 0, 'no helper nag on the team site')
            check(k.locator('#web-foot').count() == 1 and 'Desktop' in k.inner_text('#web-foot'), 'the rail points at m360 Desktop instead')
            # a site that refuses frames opens in reading mode, inside
            k.fill('#web-url', 'blocked.example'); k.keyboard.press('Enter')
            k.wait_for_selector('#web-frame[data-mode="proxy"]')
            src = k.evaluate('() => document.querySelector("#web-frame").getAttribute("src")')
            check(src.startswith('/api/browse?') and 'u=https%3A%2F%2Fblocked.example' in src, 'the frame goes through the server, got %r' % src)
            fr = k.frame_locator('#web-frame')
            fr.locator('h1:has-text("Blocked home")').wait_for()
            k.wait_for_function('() => document.querySelector("#web-tabs .web-tab.active .web-tab-title").textContent === "Blocked home"')
            check('reading mode' in k.inner_text('.web-note'), 'the note says it is reading mode')
            # a link inside stays inside; the address and the title follow; Back returns
            fr.locator('a:has-text("Go to page two")').click()
            fr.locator('h1:has-text("Second page")').wait_for()
            k.wait_for_function('() => document.querySelector("#web-url").value === "https://blocked.example/two"')
            check(k.evaluate('() => document.querySelector("#web-tabs .web-tab.active .web-tab-title").textContent') == 'Page two', 'the title follows the frame')
            check(k.locator('#web-back').is_enabled(), 'Back is possible after a link inside')
            k.locator('#web-back').click()
            fr.locator('h1:has-text("Blocked home")').wait_for()
            k.wait_for_function('() => document.querySelector("#web-url").value === "https://blocked.example/"')
            # the page runs in a sandbox: no cookies, no reach into m360
            sb = k.evaluate('() => document.querySelector("#web-frame").getAttribute("sandbox") || ""')
            check('allow-same-origin' not in sb, 'the reading frame must not share the origin')
            hdr = k.evaluate('() => fetch("/api/browse?u=https%3A%2F%2Fblocked.example%2F").then(r => r.headers.get("content-security-policy") || "")')
            check(hdr.startswith('sandbox'), 'the served page carries its own sandbox, got %r' % hdr)
            # just the text, and back to reading mode
            k.locator('#web-text').click()
            k.wait_for_selector('#web-reader .reader-text')
            check('Only reading mode shows this inside' in k.inner_text('#web-reader'), 'the text view shows the page text')
            # a private address is refused by the server
            st = k.evaluate('() => fetch("/api/browse?u=http%3A%2F%2F127.0.0.1%3A81%2F").then(r => r.status)')
            check(st == 400, 'a private address is refused, got %r' % st)
            check(not errs, 'page errors: %r' % errs[:3])
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except Exception:
            pass
    return fails


if __name__ == '__main__':
    fails = run(test)
    fails += standalone_part()
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
