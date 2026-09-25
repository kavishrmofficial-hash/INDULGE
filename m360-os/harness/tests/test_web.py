#!/usr/bin/env python3
"""The browser inside m360: tabs, spaces, full screen inside the shell, links from the rest of m360
opening here, the frame helper's messages (a popped out link comes back in, the address follows the
frame), and the desktop bridge (window.m360desktop) driving native views.

Run: cd m360-os && python3 harness/tests/test_web.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

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


if __name__ == '__main__':
    fails = run(test)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
