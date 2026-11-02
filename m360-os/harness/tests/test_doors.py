"""The doors (03-z-doors.js): opening the OS walks through a doorway into the page.

- a cold open with a session plays them once: the room dims, the doorway draws, the doors open, the light covers
  the screen, then the page shows and the overlay is gone (about 3 s)
- the line under the threshold reads "Opening the doors to opportunity"
- a second open within 4 hours does not play them; signing in does
- reduced motion never sees them; the page is clickable the whole time; no console errors; the phone fits
Writes harness/out/doors/ frames and a video of each size.
"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from harness.sim.office_env import Office

OUT = os.path.join(os.path.dirname(__file__), '..', 'out', 'doors')
os.makedirs(OUT, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def ctx_for(o, who, w, h, video=False, reduced=False):
    opts = dict(viewport={'width': w, 'height': h}, locale='en-IN', timezone_id='Asia/Kolkata')
    if w < 768:
        opts.update(is_mobile=True, has_touch=True)
    if video:
        opts.update(record_video_dir=OUT, record_video_size={'width': w, 'height': h})
    if reduced:
        opts.update(reduced_motion='reduce')
    c = o._browser.new_context(**opts)
    c.add_cookies([{'name': 'm360s', 'value': o.cookies[who], 'url': o.base}])
    c.add_init_script('window.M360_DOORS = true; window.M360_MONEY_LOCK_OFF = true')
    return c


with Office(users=4, warm=4) as o:
    o.page('founder').close()   # starts the browser
    for w, h in ((1440, 900), (390, 844)):
        c = ctx_for(o, 'founder', w, h, video=True)
        p = c.new_page(); errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        p.goto(o.base + '#hq')
        p.wait_for_selector('#doors', state='attached', timeout=20000)
        t0 = time.time()
        check('Opening the doors to opportunity' in p.inner_text('#doors .dr-say'), '%d: the line reads right' % w)
        shots = []
        for ms in (300, 650, 950, 1250, 1550, 1900, 2250, 2550):
            wait = ms / 1000 - (time.time() - t0)
            if wait > 0:
                p.wait_for_timeout(wait * 1000)
            f = os.path.join(OUT, 'f_%d_%04d.png' % (w, ms)); p.screenshot(path=f); shots.append(f)
        p.wait_for_function('() => !document.getElementById("doors")', timeout=8000)
        took = time.time() - t0
        check(took < 5, '%d: the doors are gone in %.1fs' % (w, took))
        check(p.locator('.app').count() == 1, '%d: the page is there after' % w)
        check(p.locator('#doors-mark').count() == 0, '%d: the flying mark is gone' % w)
        check(p.evaluate('() => [...document.querySelectorAll("#lmS, #lmP")].every(e => e.style.visibility === "")'), '%d: the live mark shows again' % w)
        check(p.evaluate('() => !!localStorage.getItem("m360.doorsAt")'), '%d: the time is kept' % w)
        ov = p.evaluate('() => document.documentElement.scrollWidth - innerWidth')
        check(ov <= 0, '%d: no sideways scroll (%d)' % (w, ov))
        # a second open within 4 hours: no doors
        p.reload(); p.wait_for_selector('.app', timeout=20000); p.wait_for_timeout(1200)
        check(p.locator('#doors').count() == 0, '%d: no doors again within 4 hours' % w)
        check(errs == [], '%d: no console errors: %r' % (w, errs[:3]))
        c.close()

    # signing in plays them even inside the 4 hours: should(true)
    c = ctx_for(o, 'founder', 1280, 800)
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('.app'); p.wait_for_function('() => !document.getElementById("doors")', timeout=8000)
    check(p.evaluate('() => M.doors.should(true)') and not p.evaluate('() => M.doors.should(false)'), 'sign in plays them, a plain open inside 4 hours does not')
    # the page under them takes clicks: the overlay never catches the pointer
    p.evaluate('() => { localStorage.removeItem("m360.doorsAt"); M.doors.play(); }')
    p.wait_for_timeout(300)
    check(p.evaluate('() => getComputedStyle(document.getElementById("doors")).pointerEvents') == 'none', 'the overlay lets taps through')
    c.close()

    # reduced motion: never
    c = ctx_for(o, 'founder', 1280, 800, reduced=True)
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('.app'); p.wait_for_timeout(1500)
    check(p.locator('#doors').count() == 0 and not p.evaluate('() => M.doors.should(true)'), 'reduced motion never sees the doors')
    c.close()

print('PASS' if not fails else 'FAIL %d' % len(fails))
sys.exit(1 if fails else 0)
