"""Haptics (00-core M.haptic): each action nudges with a strength that fits it, on Android and on an iPhone.

- Android (vibration motor): a quiet button taps, a primary button ticks, a button with its own nudge plays only
  that one, a delete arms with pick and confirms with warn, an error toast warns, a success toast is done
- iPhone (no vibration API): the same names play as system ticks of a hidden switch, one tick per beat
  (tap 1, done 2, big 3, warn 3), and the switch never stays in the page
- a laptop: nothing plays; the preference off: nothing plays
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from harness.sim.office_env import Office

fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
REC = '''window.__vib = []; if (navigator.vibrate) { const v = navigator.vibrate.bind(navigator); navigator.vibrate = p => { window.__vib.push(p); return true; }; }'''
NO_VIB = '''try { delete Navigator.prototype.vibrate; } catch (e) {} '''
ADD = '''() => { document.querySelectorAll('.hx').forEach(e => e.remove());
  const mk = (id, cls, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'hx ' + cls; b.textContent = id;
    b.style.cssText = 'position:fixed;left:10px;z-index:2147483647;top:' + (60 + document.querySelectorAll('.hx').length * 50) + 'px'; if (fn) b.onclick = fn; document.body.appendChild(b); };
  mk('hx-quiet', 'btn sec'); mk('hx-prime', 'btn'); mk('hx-own', 'btn', () => M.haptic.buzz('done')); }'''


def ctx_for(o, w, h, ua=None, touch=True, init=''):
    opts = dict(viewport={'width': w, 'height': h}, locale='en-IN', timezone_id='Asia/Kolkata', has_touch=touch, is_mobile=touch)
    if ua:
        opts['user_agent'] = ua
    c = o._browser.new_context(**opts)
    c.add_cookies([{'name': 'm360s', 'value': o.cookies['founder'], 'url': o.base}])
    c.add_init_script('window.M360_MONEY_LOCK_OFF = true; window.M360_WELCOME_OFF = true; ' + init)
    return c


def tapnames(p, sel):
    p.evaluate('() => { window.__haptics = []; M.haptic.last = 0; M.haptic.lastRank = -1; }')
    p.click(sel); p.wait_for_timeout(120)
    return p.evaluate('() => window.__haptics')


with Office(users=4, warm=4) as o:
    o.page('founder').close()

    # Android
    c = ctx_for(o, 390, 844, init=REC)
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('.app', timeout=20000); p.wait_for_timeout(800)
    check(p.evaluate('() => M.haptic.kind()') == 'vibrate', 'Android: the motor is found')
    p.evaluate(ADD)
    check(tapnames(p, '#hx-quiet') == ['tap'], 'Android: a quiet button taps')
    check(tapnames(p, '#hx-prime') == ['tick'], 'Android: a primary button ticks')
    check(tapnames(p, '#hx-own') == ['done'], 'Android: a button with its own nudge plays only that')
    p.evaluate('() => { window.__vib = []; window.__haptics = []; M.haptic.last = 0; M.haptic.lastRank = -1; M.toast("Could not save", true); }')
    check(p.evaluate('() => window.__haptics') == ['warn'] and p.evaluate('() => window.__vib') == [[50, 30, 50]], 'Android: an error toast warns with three beats')
    p.evaluate('() => { window.__vib = []; window.__haptics = []; M.haptic.last = 0; M.haptic.lastRank = -1; M.haptic.buzz("big"); M.toast("Payment recorded"); }')
    check(len(p.evaluate('() => window.__vib')) == 1, 'Android: a win then its toast is one nudge')
    p.evaluate('() => { M.haptic.set(false); window.__vib = []; M.haptic.last = 0; M.haptic.lastRank = -1; M.haptic.buzz("big"); }')
    check(p.evaluate('() => window.__vib') == [], 'Android: nudges off plays nothing')
    p.evaluate('() => M.haptic.set(true)')
    c.close()

    # iPhone
    c = ctx_for(o, 390, 844, ua=IPHONE, init=NO_VIB)
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('.app', timeout=20000); p.wait_for_timeout(800)
    check(p.evaluate('() => typeof navigator.vibrate') == 'undefined', 'iPhone: no vibration API, as in Safari')
    check(p.evaluate('() => M.haptic.kind()') == 'tick', 'iPhone: plays system ticks')
    beats = {}
    for name in ('tap', 'pick', 'done', 'big', 'warn'):
        beats[name] = p.evaluate('''async n => { window.__hapticTicks = 0; M.haptic.last = 0; M.haptic.lastRank = -1; M.haptic.buzz(n);
          await new Promise(r => setTimeout(r, 400)); return window.__hapticTicks; }''', name)
    check(beats == {'tap': 1, 'pick': 2, 'done': 2, 'big': 3, 'warn': 3}, 'iPhone: beats per strength %r' % beats)
    check(p.evaluate('() => document.querySelectorAll("input[switch]").length') == 0, 'iPhone: the switch never stays in the page')
    p.evaluate(ADD)
    p.evaluate('() => { window.__hapticTicks = 0; }')
    names = tapnames(p, '#hx-own')
    check(names == ['done'] and p.evaluate('() => window.__hapticTicks') >= 1, 'iPhone: a real tap with its own nudge plays it: %r' % names)
    # a finger tap on a button runs it once, first time, and the page adds nothing under the finger
    p.evaluate('''() => { document.querySelectorAll('.hx2').forEach(e => e.remove()); window.__hits = 0; window.__adds = 0;
      const b = document.createElement('button'); b.type = 'button'; b.id = 'hx-real'; b.className = 'hx2 btn'; b.textContent = 'Real';
      b.style.cssText = 'position:fixed;left:20px;top:200px;z-index:2147483647;width:140px;height:48px'; b.onclick = () => { window.__hits++; };
      document.body.appendChild(b);
      new MutationObserver(m => { window.__adds += m.reduce((n, x) => n + x.addedNodes.length, 0); }).observe(b, {childList: true, subtree: true}); }''')
    p.tap('#hx-real'); p.wait_for_timeout(200); p.tap('#hx-real'); p.wait_for_timeout(200)
    r = p.evaluate('() => [window.__hits, window.__adds]')
    check(r == [2, 0], 'iPhone: two taps run the button twice and nothing is added under the finger: %r' % r)
    # real screens by finger: the phone's tab bar moves between pages, and Me shows the try row
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(o.base + '#hq'); p.wait_for_selector('.app'); p.wait_for_timeout(1200)
    tabs = p.locator('.tab-item')
    moved = []
    for k in range(min(3, tabs.count())):
        before = p.evaluate('() => location.hash')
        tabs.nth(k).tap(); p.wait_for_timeout(500)
        moved.append(p.evaluate('() => location.hash'))
    check(len(set(moved)) >= 2 and p.locator('.hx-tap').count() == 0, 'iPhone: the tab bar works by finger: %r' % moved)
    p.goto(o.base + '#me'); p.wait_for_timeout(1200)
    if p.locator('#haptic-try').count() == 0 and p.locator('#fold-prefs .fold-head').count():
        p.locator('#fold-prefs .fold-head').tap(); p.wait_for_timeout(600)   # a fold head is a button: this tap goes through the label too
    check(p.locator('#haptic-try').count() == 1 and 'iPhone' in p.inner_text('#haptic-try'), 'Me: the try row says what this phone does')
    if p.locator('#haptic-try-strong').count():
        p.evaluate('() => { window.__haptics = []; }')
        p.tap('#haptic-try-strong'); p.wait_for_timeout(300)
        check('big' in p.evaluate('() => window.__haptics'), 'Me: Strong plays the strong nudge')
    check(errs == [], 'iPhone: no page errors: %r' % errs[:2])
    c.close()

    # the sign-in screen (a phone, signed out): a wrong password warns, Forgot it? ticks
    c = o._browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    c.add_init_script('window.M360_MONEY_LOCK_OFF = true; window.M360_WELCOME_OFF = true; ' + REC)
    p = c.new_page(); p.goto(o.base); p.wait_for_selector('#signin-email', timeout=20000); p.wait_for_timeout(2400)
    p.evaluate('() => { window.__haptics = []; window.__vib = []; }')
    p.fill('#signin-email', 'nobody@example.test'); p.fill('#signin-pw', 'not-the-right-one-1')
    p.click('#signin-go'); p.wait_for_selector('.gate [role="alert"]', timeout=20000); p.wait_for_timeout(300)
    h = p.evaluate('() => window.__haptics')
    check('warn' in h and [50, 30, 50] in p.evaluate('() => window.__vib'), 'sign-in: a wrong password warns: %r' % h)
    p.wait_for_timeout(500); p.evaluate('() => { window.__haptics = []; M.haptic.last = 0; M.haptic.lastRank = -1; }')
    p.click('#pw-forgot'); p.wait_for_timeout(300)
    h = p.evaluate('() => window.__haptics')
    check('tick' in h, 'sign-in: the next step arrives with a tick: %r' % h)
    c.close()

    # the doors: two beats as they part, a tick as the mark lands
    c = ctx_for(o, 390, 844, init=REC + ' window.M360_DOORS = true;')
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('#doors', state='attached', timeout=20000)
    p.evaluate('() => { window.__haptics = []; }')
    p.wait_for_function('() => !document.getElementById("doors")', timeout=8000)
    h = p.evaluate('() => window.__haptics')
    check('done' in h and 'tick' in h and h.index('done') < h.index('tick'), 'doors: done as they part, then a tick as the mark lands: %r' % h)
    c.close()

    # laptop
    c = ctx_for(o, 1440, 900, touch=False)
    p = c.new_page(); p.goto(o.base + '#hq'); p.wait_for_selector('.app', timeout=20000)
    check(p.evaluate('() => M.haptic.kind()') == '' and p.evaluate('() => M.haptic.buzz("big")') is False, 'laptop: nothing plays')
    c.close()

print('PASS' if not fails else 'FAIL %d' % len(fails))
sys.exit(1 if fails else 0)
