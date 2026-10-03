#!/usr/bin/env python3
"""v26 test: the OS answers every touch.

On a phone (390 wide, a touch pointer, a vibration motor): a tab tap nudges the phone and slides the
tab mark; every button nudges; the preference turns nudges off and on. The orb: a tap on the sphere
opens the sheet, it listens at once, the words land as they are said, a second tap sends them,
the answer streams in under the words and the screen closes. The day rating: a check-out from Home
takes over the screen; the keyboard and a drag move the meter, the face and the ground change with it,
the value lands in the day's check-in entry and Home reads it back; Not now records nothing. The
thought for the day: one line on Home, the same for the founder and a member, Another shows the next.
Reduced motion keeps the nudge and drops the rain. On the laptop the check-out does the same.

Run: cd m360-os && python3 harness/tests/test_motion.py
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

OFFICE = (19.076, 72.8777, 30)

# a phone: a vibration motor, a touch pointer, and speech recognition that hears one sentence word by word
PHONE = '''(function () {
  window.__vib = [];
  try { navigator.vibrate = function (p) { window.__vib.push(p); return true; }; } catch (e) {}
  try { Object.defineProperty(navigator, 'maxTouchPoints', {get: function () { return 1; }, configurable: true}); } catch (e) {}
  var mm = window.matchMedia.bind(window);
  var fake = function (m) { return {matches: m, media: '', addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {}}; };
  window.matchMedia = function (q) { if (q === '(pointer: coarse)') return fake(true); if (q === '(pointer: fine)') return fake(false); return mm(q); };
  var WORDS = 'what is on my calendar this week'.split(' ');
  window.__srStarts = 0;
  window.SpeechRecognition = function () { this.onresult = null; this.onend = null; this.onerror = null; this._t = 0; this._i = 0; };
  window.SpeechRecognition.prototype.start = function () {
    var self = this; window.__srStarts++;
    if (window.__srStarts > 1) return;   /* a follow up hears silence */
    var step = function () {
      self._i++;
      var tr = WORDS.slice(0, self._i).join(' ');
      if (self.onresult) self.onresult({results: [[{transcript: tr}]]});
      if (self._i < WORDS.length) self._t = setTimeout(step, 110);
    };
    self._t = setTimeout(step, 110);
  };
  window.SpeechRecognition.prototype.stop = function () { clearTimeout(this._t); var self = this; setTimeout(function () { if (self.onend) self.onend(); }, 20); };
  window.SpeechRecognition.prototype.abort = function () { clearTimeout(this._t); };
})();'''


def phone_ctx(h, geo=None):
    opts = {'viewport': {'width': 390, 'height': 844}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata', 'has_touch': True}
    if geo:
        opts['geolocation'] = {'latitude': geo[0], 'longitude': geo[1], 'accuracy': geo[2]}
        opts['permissions'] = ['geolocation']
    ctx = h.browser.new_context(**opts)
    h.contexts.append(ctx)
    ctx.add_init_script(PHONE)
    return ctx


def open_page(h, ctx, ident, hash, **params):
    page = ctx.new_page()
    page.set_default_timeout(8000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hash, **params))
    h.ready(page)
    return page


def today(page):
    return page.evaluate('() => M.U.todayStr()')


def seed_in(h, page, uid):
    """The person checked in three hours ago and is still in."""
    now = page.evaluate('() => Date.now()')
    h.seed_doc(page, 'checkin/' + uid, {'days': {today(page): {'in': now - 3 * 3600000, 'out': None, 'mode': 'office',
                                                               'loc': {'lat': 19.076, 'lng': 72.8777, 'acc': 30, 'dist': 0, 'verified': True, 'place': 'Mumbai office'}, 'outLoc': None}}})


def rgb(page, sel):
    v = page.evaluate('s => getComputedStyle(document.querySelector(s)).backgroundColor', sel)
    nums = [int(x) for x in v.replace('rgba(', '').replace('rgb(', '').rstrip(')').split(',')[:3]]
    return nums


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    # ---------- the phone ----------
    ctx = phone_ctx(h, geo=OFFICE)
    p = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)
    seed(h, p)
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    check(p.evaluate('() => M.haptic.can()'), 'the phone reports a motor')
    check(p.locator('.content.view').count() == 1, 'the view wrapper is on the page')

    # a tab tap nudges and moves the mark
    p.locator('.tabbar .tab-item', has_text='Work').click()
    p.wait_for_timeout(300)
    hap = p.evaluate('() => window.__haptics || []')
    check('tick' in hap, 'a tab tap nudged: %r' % hap)
    check(len(p.evaluate('() => window.__vib')) >= 1, 'the motor ran')
    ti = p.evaluate('() => getComputedStyle(document.querySelector(".tabbar")).getPropertyValue("--ti").trim()')
    idx = p.evaluate('() => [...document.querySelectorAll(".tabbar .tab-item")].findIndex(b => b.classList.contains("active"))')
    check(ti == str(idx) and idx >= 0, 'the tab mark sits under the active tab: --ti %r, active %r' % (ti, idx))
    # a button nudges; the preference turns it off
    n0 = p.evaluate('() => window.__vib.length')
    p.locator('.main .btn').first.click()
    p.wait_for_timeout(200)
    check(p.evaluate('() => window.__vib.length') > n0, 'a button nudged')
    p.evaluate('() => M.haptic.set(false)')
    check(p.evaluate('() => M.haptic.buzz("tap")') is False, 'nudges off: no buzz')
    n1 = p.evaluate('() => window.__vib.length')
    p.evaluate('() => M.haptic.buzz("done")')
    check(p.evaluate('() => window.__vib.length') == n1, 'nudges off: the motor stays still')
    p.evaluate('() => M.haptic.set(true)')
    check(p.evaluate('() => M.haptic.buzz("tap")') is True, 'nudges back on')

    # ---------- the orb ----------
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.wait_for_function('() => !!M.buddy')
    orb = p.locator('.buddy-home.orb-home')
    check(orb.count() == 1, 'the buddy button is the phone dock')
    check(orb.locator('.dock-char canvas, .dock-char .mark').count() == 1, 'the dock carries the character')
    box = orb.bounding_box()
    check(box and box['height'] >= 44, 'the orb is a thumb target: %r' % box)
    orb.click()
    p.wait_for_selector('#orb-screen')
    p.wait_for_function('() => M.buddy.state().mode === "listening"')
    check(p.get_attribute('#orb-screen', 'data-mode') == 'listening', 'the screen opens listening')
    check(p.locator('#orb-screen .orb-big.is-live canvas, #orb-screen .vorb.live').count() == 1, 'the big sphere is live')
    p.wait_for_function('() => /calendar this week/.test((document.querySelector("#orb-heard") || {}).textContent || "")')
    check(p.locator('#orb-heard .orb-w').count() == 7, 'the words landed one by one: %r' % p.inner_text('#orb-heard'))
    check(p.evaluate('() => window.__srStarts') == 1, 'one recognition started')
    p.click('#orb-tap')   # done talking
    p.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
    check(p.locator('#orb-answer').count() == 1 and len(p.inner_text('#orb-answer').strip()) > 0, 'the answer sits under the words: %r' % p.inner_text('#orb-answer')[:60])
    check('calendar this week' in p.inner_text('#orb-heard'), 'the words stay on screen with the answer')
    hap = p.evaluate('() => window.__haptics || []')
    check('done' in hap, 'the answer nudged: %r' % hap[-6:])
    p.click('#orb-screen button[aria-label="Close"]')
    p.wait_for_selector('#orb-screen', state='detached')
    check(p.evaluate('() => M.buddy.state().mode') == 'idle', 'closed back to idle')
    # typing on the orb screen
    p.evaluate('() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; }')
    orb.click()
    p.wait_for_selector('#orb-screen')
    p.wait_for_function('() => M.buddy.state().mode === "asking"')
    check(p.get_attribute('#orb-screen', 'data-mode') == 'asking', 'no recognition: the screen opens to typing')
    p.fill('#orb-input', 'What can you do?')
    p.press('#orb-input', 'Enter')
    p.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
    check(p.locator('#orb-answer').count() == 1, 'a typed question is answered on the orb screen')
    p.click('#orb-screen button[aria-label="Close"]')
    p.wait_for_selector('#orb-screen', state='detached')

    # ---------- the day rating, on the phone ----------
    seed_in(h, p, 'u_founder')
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.wait_for_selector('#home-hero button:has-text("Check out")')
    p.click('#home-hero button:has-text("Check out")')
    p.wait_for_selector('#dayrate', timeout=15000)
    check(p.get_attribute('#dayrate', 'data-face') == 'okay', 'the meter starts in the middle, an okay face')
    check(p.locator('#dayrate-save').is_disabled(), 'nothing to save before a move')
    check('Drag the dot' in p.inner_text('#dayrate-word'), 'the word asks for a move')
    # the keyboard: End is the top, Home the bottom
    p.focus('#dayrate-knob')
    p.keyboard.press('End')
    p.wait_for_timeout(120)
    check(p.get_attribute('#dayrate', 'data-face') == 'great' and p.get_attribute('#dayrate', 'data-value') == '100', 'End: the top, a great face')
    r, g, b = rgb(p, '#dayrate')
    check(g > r and g > b, 'the ground is green at the top: %r' % ((r, g, b),))
    p.keyboard.press('Home')
    p.wait_for_timeout(120)
    check(p.get_attribute('#dayrate', 'data-face') == 'rough' and p.get_attribute('#dayrate', 'data-value') == '0', 'Home: the bottom, a rough face')
    r, g, b = rgb(p, '#dayrate')
    check(r > g and r > b, 'the ground is red at the bottom: %r' % ((r, g, b),))
    # a drag: from the left edge to the far right, in steps
    tr = p.locator('.dayrate-track').bounding_box()
    y = tr['y'] + tr['height'] / 2
    p.mouse.move(tr['x'] + 2, y)
    p.mouse.down()
    for k in range(1, 11):
        p.mouse.move(tr['x'] + tr['width'] * (0.02 + 0.095 * k), y)
        p.wait_for_timeout(30)
    p.mouse.move(tr['x'] + tr['width'] * 0.93, y)
    p.mouse.up()
    p.wait_for_timeout(150)
    v = int(p.get_attribute('#dayrate', 'data-value'))
    check(v >= 85, 'the drag reached the top band: %d' % v)
    check(p.get_attribute('#dayrate', 'data-face') == 'great', 'a great face after the drag')
    check('Great' in p.inner_text('#dayrate-word'), 'the word says Great')
    hap = p.evaluate('() => window.__haptics || []')
    check('pick' in hap, 'each face change nudged: %r' % hap[-8:])
    r, g, b = rgb(p, '#dayrate')
    check(g > r, 'the ground went green with the drag')
    ground = p.evaluate('() => getComputedStyle(document.querySelector("#dayrate")).backgroundColor')
    check(p.get_attribute('#dayrate-knob', 'aria-valuenow') == str(v) and p.get_attribute('#dayrate-knob', 'aria-valuetext') == 'Great', 'the slider is a slider for a screen reader')
    p.click('#dayrate-save')
    p.wait_for_selector('#dayrate', state='detached')
    doc = p.evaluate('() => window.__db.get("checkin/u_founder")')
    e = doc['days'][today(p)]
    check(e.get('dayRate') == v and e.get('dayRateAt') and e.get('out'), 'the rating landed in the day entry: %r' % {k: e.get(k) for k in ('dayRate', 'out')})
    p.wait_for_selector('#home-rated')
    check('😄' in p.inner_text('#home-rated') and 'Great' in p.inner_text('#home-rated'), 'Home reads the rating back: %r' % p.inner_text('#home-rated'))
    # the crew list shows the face beside anyone who rated the day
    p.wait_for_timeout(200)
    if p.locator('#fold-crew').count() and h.ctx(p, 'ctx.activeMembers.some(m => m.uid === "u_founder")'):
        if p.locator('#fold-crew .fold-head').count() and not p.locator('#fold-crew.open').count():
            p.locator('#fold-crew .fold-head').click()
        p.wait_for_selector('#fold-crew .crew-face')
        check(p.locator('.crew-face').count() >= 1, 'the crew list shows the face')
    # Not now records nothing, and the ground colour is a real colour
    check(ground.startswith('rgb'), 'the ground is a computed colour')
    seed_in(h, p, 'u_founder')
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.click('#home-hero button:has-text("Check out")')
    p.wait_for_selector('#dayrate', timeout=15000)
    p.click('#dayrate-skip')
    p.wait_for_selector('#dayrate', state='detached')
    e = p.evaluate('() => window.__db.get("checkin/u_founder")')['days'][today(p)]
    check('dayRate' not in e and e.get('out'), 'Not now: checked out, nothing rated')
    p.wait_for_selector('#home-rate')
    p.click('#home-rate')
    p.wait_for_selector('#dayrate')
    p.keyboard.press('Escape')
    p.wait_for_selector('#dayrate', state='detached')
    check(True, 'the rating can be opened again from Home and closed with Escape')
    h.shot(p, 'motion-home-390')

    # ---------- the thought ----------
    line = p.inner_text('#quote-line').strip()
    lines = p.evaluate('() => M.quote.lines')
    check(line in lines, 'a thought on Home: %r' % line[:50])
    check(p.locator('#quote-line .quote-w').count() == len(line.split(' ')), 'the words are set one by one')
    bad = [x for x in lines if '—' in x or '–' in x or '!' in x or 'rather than' in x or 'instead of' in x]
    check(not bad, 'every thought keeps the house style: %r' % bad[:2])
    check(len(set(lines)) == len(lines) and len(lines) >= 80, '%d distinct thoughts' % len(lines))
    p.click('#quote-next')
    p.wait_for_timeout(200)
    line2 = p.inner_text('#quote-line').strip()
    check(line2 != line and line2 in lines, 'Another shows the next thought')
    check('another thought' in p.inner_text('#quote-card'), 'the micro says it is another')
    # a member sees the same line today
    m = open_page(h, ctx, 'm1', '#home', seed=True)
    check(m.inner_text('#quote-line').strip() == line, 'the member reads the same thought today')

    # ---------- reduced motion: the nudge stays, the rain goes ----------
    m.emulate_media(reduced_motion='reduce')
    check(m.evaluate('() => M.reduced()'), 'reduced motion is on')
    m.evaluate('() => { window.__haptics = []; M.rain("🔥", document.body); }')
    m.wait_for_timeout(100)
    check(m.locator('.rain').count() == 0, 'no rain under reduced motion')
    check('big' in m.evaluate('() => window.__haptics'), 'the nudge still lands under reduced motion')

    # ---------- the laptop: the same rating after a check-out from Home ----------
    big = h.session('founder', width=1280, height=900, geo=OFFICE, reset=True, seed=True, hash='#home')
    seed(h, big)
    seed_in(h, big, 'u_m1')
    h.go(big, 'm1', hash='#home')
    big.click('#home-hero button:has-text("Check out")')
    big.wait_for_selector('#dayrate', timeout=15000)
    check(big.locator('.buddy-home.orb-home').count() == 0, 'the laptop keeps the pointer buddy, no orb')
    tr = big.locator('.dayrate-track').bounding_box()
    y = tr['y'] + tr['height'] / 2
    big.mouse.move(tr['x'] + tr['width'] * 0.5, y)
    big.mouse.down()
    big.mouse.move(tr['x'] + tr['width'] * 0.3, y, steps=6)
    big.mouse.up()
    big.wait_for_timeout(120)
    check(big.get_attribute('#dayrate', 'data-face') == 'meh', 'a drag to 30 is a meh face: %r' % big.get_attribute('#dayrate', 'data-value'))
    r, g, b = rgb(big, '#dayrate')
    check(r > b and g < 200, 'amber-ish ground at 30: %r' % ((r, g, b),))
    big.click('#dayrate-save')
    big.wait_for_selector('#dayrate', state='detached')
    e = big.evaluate('() => window.__db.get("checkin/u_m1")')['days'][today(big)]
    check(20 <= e.get('dayRate', -1) <= 40, 'the laptop rating landed: %r' % e.get('dayRate'))
    check('😕' in big.inner_text('#home-rated'), 'Home on the laptop reads it back')
    h.shot(big, 'motion-home-1280')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
