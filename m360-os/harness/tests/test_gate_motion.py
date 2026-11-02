#!/usr/bin/env python3
"""v36.2 test: the sign-in moves the way Apple's does (src/js/03-z-gate.js, src/css/99-gate.css).

On the team site build: the mark is drawn by a pen (v39, 03-z-gate.js) the way the Subject 360 film closes; every
gate React mounts after it (the boot gate, the setup and sign-in gates) joins that motion on the same clock
(its animations share one start time, so nothing starts over); a wrong sign-in shakes the box; Forgot it?
rises in fresh; the first screen after signing in settles in; the watch stops once the app is up; reduced
motion moves nothing and shows everything; a 390 phone has no sideways scroll; the console stays clean.

Run: cd m360-os && python3 harness/tests/test_gate_motion.py
"""
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

INSTRUMENT = '''(() => { const o = Element.prototype.animate; window.__aa = [];
  Element.prototype.animate = function (kf, opt) { const a = o.call(this, kf, opt);
    window.__aa.push([this.tagName + '.' + (this.className && this.className.baseVal != null ? 'svg' : this.className), opt && opt.delay, a]); return a; }; })()'''
CALLS = '() => window.__aa.map(([el, delay, a]) => ({el, delay, start: a.startTime}))'


def main():
    checks, fails = [], []

    def check(cond, msg):
        (checks if cond else fails).append(msg)
        print(('ok ' if cond else 'FAIL ') + msg)

    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store],
                           env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            errs = []

            # ---- first run: setup, joined on one clock ----
            k = browser.new_context(viewport={'width': 1280, 'height': 860}, timezone_id='Asia/Kolkata').new_page()
            k.set_default_timeout(30000)
            k.on('pageerror', lambda e: errs.append(str(e)))
            k.on('console', lambda m: m.type == 'error' and errs.append(m.text))
            k.add_init_script('window.M360_WELCOME_OFF = true')
            k.add_init_script(INSTRUMENT)
            k.goto(base)
            k.wait_for_selector('#signin-name')
            # v39: the pen draws the mark the way the Subject 360 film closes (an SVG mask of brush strokes, a tracer, a nib)
            check(k.evaluate('() => !!document.querySelector(".gate .mark svg.pen mask") && !!document.querySelector(".gate .mark svg.pen path[mask]")'), 'the pen is drawing the mark')
            calls = k.evaluate(CALLS)
            gate = [c for c in calls if c['el'] in ('svg.svg', 'H1.', 'P.', 'DIV.g-act')]
            synced = [c for c in gate if c['delay'] is not None]
            starts = sorted(set(round(c['start'] or 0) for c in synced))
            check(len(starts) <= 1, 'every gate React mounts inside the opening joins one start: %r' % starts)
            check(set(c['delay'] for c in synced) <= {520, 620, 720}, 'each joins at its own beat (title 520, line 620, form 720): %r' % sorted(set(c['delay'] for c in synced)))
            check(len(gate) >= 3, 'React\'s gates take part (%d joined or rose in)' % len(gate))
            k.wait_for_timeout(3600)
            check(k.evaluate('() => !document.querySelector(".gate .mark svg.pen") && !document.querySelector(".gate .mark mask") && document.querySelectorAll(".gate .mark svg path").length === 1'), 'the pen finishes and leaves the plain mark')
            vis = k.evaluate('() => [...document.querySelectorAll(".gate > div > h1, .gate > div > p, .gate > div > .g-act")].map(e => getComputedStyle(e).opacity)')
            check(vis and all(v == '1' for v in vis), 'after the opening everything stands fully in view: %r' % vis)
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'gate-motion-test-2026')
            k.get_by_role('button', name='Set up the workspace').click()
            k.wait_for_selector('.sidebar')
            app = [c for c in k.evaluate(CALLS) if c['el'] == 'DIV.app']
            check(len(app) == 1, 'the first screen after signing in settles in, once: %r' % app)
            k.wait_for_timeout(1200)
            check(k.evaluate('() => document.querySelector("#root > .app").getAnimations().length') == 0, 'and is still afterwards')
            n0 = len(k.evaluate(CALLS))
            k.evaluate('() => { const d = document.createElement("span"); d.textContent = "x"; document.querySelector(".app").appendChild(d); d.remove(); }')
            k.wait_for_timeout(200)
            check(len(k.evaluate(CALLS)) == n0, 'the watch has stopped once the app is up')

            # ---- a second person: a wrong sign-in shakes, Forgot it? rises in fresh ----
            k2 = browser.new_context(viewport={'width': 1280, 'height': 860}).new_page()
            k2.set_default_timeout(30000)
            k2.on('pageerror', lambda e: errs.append('p2 ' + str(e)))
            k2.goto(base); k2.wait_for_selector('#signin-email'); k2.wait_for_timeout(2200)
            k2.fill('#signin-email', 'kaavish@mask360.agency'); k2.fill('#signin-pw', 'not-the-right-one-1')
            k2.click('#signin-go')
            k2.wait_for_selector('.gate [role="alert"]')
            check(k2.evaluate('() => document.querySelector(".gate .join-box").getAnimations().length') >= 1, 'a wrong sign-in shakes the box')
            k2.wait_for_timeout(600)
            k2.click('#pw-forgot'); k2.wait_for_timeout(60)
            sw = k2.evaluate('() => [document.querySelector(".gate .join-box").getAnimations().length, document.querySelector(".gate h1").getAnimations().length, document.querySelector(".gate h1").textContent]')
            check(sw[0] == 1 and sw[1] == 1, 'Forgot it? brings the new title and box in fresh, once each: %r' % sw)

            # ---- reduced motion: nothing moves, everything shows ----
            k3 = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce').new_page()
            k3.goto(base); k3.wait_for_selector('#signin-email'); k3.wait_for_timeout(300)
            r = k3.evaluate('() => [document.getAnimations().length, getComputedStyle(document.querySelector(".gate .mark svg")).maskImage, getComputedStyle(document.querySelector(".gate > div > .g-act")).opacity]')
            check(r == [0, 'none', '1'], 'reduced motion: no motion, no mask, the form in full: %r' % r)

            # ---- the phone: no sideways scroll from the glow ----
            k4 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
            k4.goto(base); k4.wait_for_selector('#signin-email'); k4.wait_for_timeout(1500)
            w = k4.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')
            check(w[0] == w[1], 'the phone has no sideways scroll: %r' % w)

            check(not errs, 'the console stays clean: %r' % errs[:3])
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    if fails:
        print('FAIL %d of %d' % (len(fails), len(fails) + len(checks)))
        sys.exit(1)
    print('PASS %d checks' % len(checks))


if __name__ == '__main__':
    main()
