#!/usr/bin/env python3
"""v28 and v29 test: the six effects, the real packages, bundled into the page.

window.FX carries thinking-orbs, border-beam, voice-glow, bot-avatars, metal-fx and React Bits'
BellToggle. The thinking line draws the orb on a canvas with a state read from its label; a flame card
and a hot fold ride the border beam; Ask wraps its input in the voice beam, lit while the mic is live
and travelling while the answer is on its way, with a bot avatar beside every answer and the Ask button
in liquid metal; the New button and the check-in button are metal too; the notifications pill is the
bell, ringing on a press with its label unfurling; reduced motion drops the beam and the metal and
keeps the plain controls; on the phone the orb screen draws the listening orb and the voice beam.

Run: cd m360-os && python3 harness/tests/test_effects.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_motion as TM  # noqa: E402

SCRATCH = '''(props) => {
  let root = document.getElementById('fx-scratch');
  if (!root) { root = document.createElement('div'); root.id = 'fx-scratch'; document.body.appendChild(root); }
  if (!window.__fxRoot) window.__fxRoot = ReactDOM.createRoot(root);
  window.__fxRoot.render(M.html`<div>
    <${M.Thinking} label="Looking at your screen"/>
    <${M.Thinking} label="Writing the plan"/>
    <${M.Thinking}/>
    <${M.UI.Card} flame=${true} id="fx-hot" title="Hot">hot<//>
    <${M.UI.Card} id="fx-cold" title="Cold">cold<//>
    <${M.fx.Metal} kind="ink"><button type="button" class="btn" id="fx-btn">Go</button><//>
    <${M.fx.Bell} id="fx-bell" offLabel="Notify me" onLabel="You'll be notified" count=${props.count} defaultPressed=${false}/>
    <${M.fx.Bot} id="fx-bot" state=${props.bot || 'default'} size=${40} label="m360"/>
  </div>`);
  return true;
}'''

FAKE_SR = '''() => {
  window.SpeechRecognition = function () { this.onresult = null; this.onend = null; this.onerror = null; };
  window.SpeechRecognition.prototype.start = function () { const self = this; this._t = setTimeout(() => { if (self.onresult) self.onresult({results: [[{transcript: 'what can you do'}]]}); }, 150); };
  window.SpeechRecognition.prototype.stop = function () { clearTimeout(this._t); const self = this; setTimeout(() => { if (self.onend) self.onend(); }, 10); };
  window.SpeechRecognition.prototype.abort = function () { clearTimeout(this._t); };
  window.webkitSpeechRecognition = window.SpeechRecognition;
}'''


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    p = h.session('founder', width=1280, height=900, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#home', seed=True)
    p.wait_for_function('() => !!window.FX && !!window.ReactDOM')
    keys = p.evaluate('() => Object.keys(window.FX)')
    for k in ('ThinkingOrb', 'BorderBeam', 'VoiceBeam', 'useMicrophone', 'BotAvatar', 'MetalFx', 'MetalText', 'MetalBadge', 'BellToggle'):
        check(k in keys, 'the bundle carries ' + k)
    check(p.evaluate('() => window.FX.version.orbs') == '0.3.2' and p.evaluate('() => M.fx.has()'), 'the bundle names its versions and the app sees it')

    p.evaluate(SCRATCH, {'count': 0})
    p.wait_for_selector('#fx-scratch .thinking-line canvas')

    # ---- the thinking line: the orb on a canvas, with a state from the label ----
    lines = p.evaluate('() => [...document.querySelectorAll("#fx-scratch .thinking-line")].map(l => [l.dataset.state, !!l.querySelector("canvas")])')
    check([x[0] for x in lines] == ['searching', 'composing', 'working'] and all(x[1] for x in lines), 'three orbs with states: %r' % lines)

    # ---- the beam on a flame card, none on a plain one ----
    check(p.evaluate('() => document.getElementById("fx-hot").parentElement.hasAttribute("data-beam")'), 'a flame card sits inside a border beam')
    p.locator('#fx-hot').scroll_into_view_if_needed()
    p.wait_for_function('() => document.getElementById("fx-hot").parentElement.hasAttribute("data-active")')
    check(True, 'the beam plays when the card comes into view')
    p.wait_for_timeout(4000)
    check(p.evaluate('() => document.getElementById("fx-hot").parentElement.hasAttribute("data-active")'), 'and keeps running while it is on screen, as the library ships it')
    check(p.evaluate('() => !document.getElementById("fx-cold").parentElement.hasAttribute("data-beam")'), 'a plain card has no beam')

    # ---- liquid metal round a button ----
    metal = p.evaluate('() => { const r = document.getElementById("fx-btn").closest(".metal-fx-root"); return r ? [r.dataset.variant, r.dataset.theme, !!r.querySelector("canvas.metal-fx-canvas")] : null; }')
    check(metal and metal[0] == 'button' and metal[1] == 'dark' and metal[2], 'the ink button is a dark metal pill with its own canvas: %r' % metal)
    check(p.evaluate('() => getComputedStyle(document.getElementById("fx-btn")).visibility') == 'visible', 'the button inside the metal is visible from the first paint')
    p.locator('#fx-btn').click()
    check(True, 'and takes a click')

    # ---- metal text and the metal badge ----
    p.evaluate('''() => { const r = document.createElement('div'); r.id = 'fx-scratch2'; document.body.appendChild(r);
      ReactDOM.createRoot(r).render(M.html`<div><span id="fx-mt"><${M.fx.MetalText} size=${28}>42<//></span><span id="fx-mb"><${M.fx.MetalBadge}>new<//></span></div>`); }''')
    p.wait_for_selector('#fx-mt .metal-fx-root')
    check('42' in p.inner_text('#fx-mt'), 'metal text reads its number')
    p.wait_for_selector('#fx-mb .metal-badge-host')
    check('new' in p.inner_text('#fx-mb').lower(), 'the metal badge reads its word')

    # ---- the bell: a press rings and unfurls, the badge rolls ----
    check(p.get_attribute('#fx-bell', 'data-on') == 'false', 'the bell starts off')
    p.click('#fx-bell .bell-toggle__button')
    p.wait_for_function('() => document.querySelector("#fx-bell").dataset.on === "true"')
    ring = p.evaluate('() => document.querySelector("#fx-bell .bell-toggle__glyph").getAnimations().length')
    check(ring >= 1, 'the bell rings on a press: %r' % ring)
    waves = p.evaluate('() => [...document.querySelectorAll("#fx-bell .bell-toggle__wave")].reduce((n, w) => n + w.getAnimations().length, 0)')
    check(waves >= 2, 'sound waves leave the rim: %r' % waves)
    p.wait_for_timeout(350)
    faces = p.evaluate('() => [getComputedStyle(document.querySelector("#fx-bell .bell-toggle__face--on")).opacity, getComputedStyle(document.querySelector("#fx-bell .bell-toggle__face--off")).opacity]')
    check(faces[0] == '1' and faces[1] == '0', 'the label unfurled: %r' % faces)
    p.mouse.move(5, 5)   # off the pill: a hovering pointer mixes a little paper into the flame
    try:   # the hover tint fades out; wait for it to land on flame
        p.wait_for_function('() => { const c = getComputedStyle(document.querySelector("#fx-bell .bell-toggle__button")).backgroundColor; return c === "rgb(245, 57, 1)" || c.startsWith("color(srgb 0.96"); }', timeout=4000)
    except Exception:
        pass
    bg = p.evaluate('() => getComputedStyle(document.querySelector("#fx-bell .bell-toggle__button")).backgroundColor')
    check(bg == 'rgb(245, 57, 1)' or bg.startswith('color(srgb 0.96'), 'on, the pill is flame: %r' % bg)
    check(not p.evaluate('() => document.querySelector("#fx-bell .bell-toggle__badge").hasAttribute("data-show")'), 'no badge at zero')
    p.evaluate(SCRATCH, {'count': 3})
    p.wait_for_function('() => document.querySelector("#fx-bell .bell-toggle__badge").hasAttribute("data-show")')
    check(p.inner_text('#fx-bell .bell-toggle__digit') == '3', 'the badge shows the count')
    p.evaluate(SCRATCH, {'count': 12})
    p.wait_for_function('() => document.querySelector("#fx-bell .bell-toggle__digit").textContent === "9+"')
    check(True, 'a count past nine reads 9+')

    # ---- the bot: a drawn canvas with a name ----
    bot = p.evaluate('() => { const b = document.getElementById("fx-bot"); return [b.tagName, b.getAttribute("role"), b.getAttribute("aria-label")]; }')
    check(bot[0] == 'CANVAS' and bot[1] == 'img', 'the bot is a drawn canvas image: %r' % bot)
    p.evaluate(SCRATCH, {'count': 12, 'bot': 'working'})
    p.wait_for_timeout(200)
    check(bool(p.evaluate('() => document.getElementById("fx-bot").getAttribute("aria-label")')), 'the working bot carries a label')

    # ---- Home: the New button and Check in are metal, the thought has its beam ----
    newm = p.evaluate('() => { const b = document.querySelector(".sidebar .btn.new-trigger"); return b && b.closest(".metal-fx-root") ? b.closest(".metal-fx-root").dataset.theme : null; }')
    check(newm == 'dark', 'the New button is dark metal: %r' % newm)
    checkin = p.evaluate('() => { const b = document.querySelector("#tapin .btn.xl"); return b && b.closest(".metal-fx-root") ? b.closest(".metal-fx-root").dataset.theme : null; }')
    check(checkin == 'light', 'the check-in button is light metal on the dark panel: %r' % checkin)
    # v31: the thought is decorative, so it no longer carries a beam (one moving thing per view)
    check(not p.evaluate('() => document.getElementById("quote-card").parentElement.hasAttribute("data-beam")'), 'the thought sits still, without a beam')

    # ---- Ask: the voice beam under the input, the droid in the dock and the panel head, metal on Send ----
    p.evaluate(FAKE_SR)
    p.locator('.iconbtn[aria-label="Ask m360"]').first.click()
    p.wait_for_selector('#buddy-input')
    check(p.evaluate('() => !!document.querySelector("#buddy-input").closest("[data-voice-beam]")'), 'the input sits inside the voice beam')
    ASK_METAL = '() => { const b = document.querySelector("#buddy-send"); return !!(b && b.closest(".metal-fx-root")); }'
    check(not p.evaluate(ASK_METAL), 'an empty Send is the plain disabled button, no metal')
    p.fill('#buddy-input', 'what can you do')
    p.wait_for_function(ASK_METAL)
    check(True, 'the Send button turns metal once there is something to ask')
    p.fill('#buddy-input', '')
    p.locator('#buddy-talk').click()
    p.wait_for_function('() => { const w = document.querySelector("#buddy-input").closest("[data-voice-beam]"); return w && w.hasAttribute("data-active"); }')
    check(True, 'the beam is active while the mic is live')
    check(p.evaluate('() => !!document.querySelector(".panel-composer .voice-pill.is-live")'), 'the Talk button records inside the voice pill')
    check(p.evaluate('() => !!document.querySelector("#buddy-dock .voice-pill.is-live")'), 'the character glows in the dock while it listens')
    p.get_by_role('button', name='Listening, tap to stop').first.click()
    p.wait_for_selector('.buddy-bubble #buddy-answer', timeout=20000)
    check(p.evaluate('() => [...document.querySelectorAll(".panel-head canvas")].some(c => c.getAttribute("aria-label") === "m360")'), 'the droid sits in the panel head, named m360')
    check(p.locator('.panel-body canvas').count() == 0, 'the answers carry no repeated avatar')
    check(p.evaluate('() => [...document.querySelectorAll("#buddy-dock canvas")].some(c => c.getAttribute("aria-label") === "m360")'), 'the droid lives in the dock')
    p.keyboard.press('Escape')

    # ---- reduced motion: the beam and the metal stand down, the controls stay ----
    p.emulate_media(reduced_motion='reduce')
    p.evaluate(SCRATCH, {'count': 1})
    p.wait_for_selector('#fx-hot')
    still = p.evaluate('() => [document.getElementById("fx-hot").parentElement.hasAttribute("data-beam"), !!document.getElementById("fx-btn").closest(".metal-fx-root"), !!document.querySelector("#fx-scratch .thinking-line .vorb"), !!document.getElementById("fx-btn")]')
    check(still == [False, False, True, True], 'reduced motion: no beam, no metal, the plain sphere, the button itself: %r' % still)

    # ---- the phone: the orb screen draws the listening orb and the voice beam ----
    ctx = TM.phone_ctx(h)
    m = TM.open_page(h, ctx, 'founder', '#home', seed=True)
    m.wait_for_function('() => !!M.buddy')
    m.wait_for_selector('.buddy-home.orb-home .dock-char canvas')
    check(m.locator('.buddy-home.orb-home .dock-char canvas').count() == 1, 'the phone dock carries the droid')
    m.locator('.buddy-home.orb-home').click()
    m.wait_for_selector('#orb-screen .orb-big.is-live canvas')
    check(m.evaluate('() => document.querySelector("#orb-screen .orb-big canvas").getAttribute("aria-label")') == 'listening', 'the big orb listens')
    check(m.evaluate('() => !!document.querySelector("#orb-screen [data-voice-beam][data-active]")'), 'the voice beam lights the bottom of the screen')
    m.click('#orb-screen button[aria-label="Close"]')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
