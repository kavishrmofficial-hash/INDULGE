#!/usr/bin/env python3
"""v28 test: the six effects, the real packages, bundled into the page.

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
    hot = p.evaluate('() => { const w = document.getElementById("fx-hot").parentElement; return [w.hasAttribute("data-beam"), w.hasAttribute("data-active")]; }')
    check(hot[0] and hot[1], 'a flame card sits inside an active border beam: %r' % hot)
    check(p.evaluate('() => !document.getElementById("fx-cold").parentElement.hasAttribute("data-beam")'), 'a plain card has no beam')

    # ---- liquid metal round a button ----
    metal = p.evaluate('() => { const r = document.getElementById("fx-btn").closest(".metal-fx-root"); return r ? [r.dataset.variant, r.dataset.theme, !!r.querySelector("canvas.metal-fx-canvas")] : null; }')
    check(metal and metal[0] == 'button' and metal[1] == 'dark' and metal[2], 'the ink button is a dark metal pill with its own canvas: %r' % metal)

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
    p.wait_for_timeout(250)
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
    check(p.evaluate('() => document.getElementById("quote-card").parentElement.hasAttribute("data-beam")'), 'the thought rides a beam')

    # ---- Ask: the voice beam under the input, bots beside the answers, metal on Ask ----
    p.evaluate(FAKE_SR)
    p.locator('.iconbtn[aria-label="Ask m360"]').first.click()
    p.wait_for_selector('#ask-input')
    check(p.evaluate('() => !!document.querySelector("#ask-input").closest("[data-voice-beam]")'), 'the input sits inside the voice beam')
    check(p.evaluate('() => { const b = [...document.querySelectorAll(".ask-in .btn")].find(x => x.textContent.trim() === "Ask"); return !!(b && b.closest(".metal-fx-root")); }'), 'the Ask button is metal')
    p.get_by_role('button', name='Talk').first.click()
    p.wait_for_function('() => { const w = document.querySelector("#ask-input").closest("[data-voice-beam]"); return w && w.hasAttribute("data-active"); }')
    check(True, 'the beam is active while the mic is live')
    p.get_by_role('button', name='Listening, tap to stop').first.click()
    p.wait_for_function("() => !!document.querySelector('.ask-row canvas')", timeout=20000)
    check(p.locator('.ask-row canvas').count() >= 1, 'a bot sits beside the answer')
    check(p.evaluate('() => document.querySelector(".ask-row canvas").getAttribute("aria-label")') == 'm360', 'the bot is named m360')
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
    m.wait_for_selector('.buddy-home.orb-home .orb-mark canvas')
    check(m.locator('.buddy-home.orb-home .orb-mark canvas').count() == 1, 'the phone button carries a breathing orb')
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
