#!/usr/bin/env python3
"""v28 and v29 test: the six effects, the real packages, bundled into the page.

window.FX carries thinking-orbs, border-beam, voice-glow, bot-avatars and React Bits' BellToggle.
v36.2 retired metal-fx: its chromatic text drew numbers as misaligned coloured ghosts, so the bundle no
longer carries it and M.fx.Metal, MetalText and MetalBadge draw a plain button, plain text and a flame pill. The thinking line draws the orb on a canvas with a state read from its label; a flame card
and a hot fold carry the v7 flame line on their top edge (the border beam is retired); Ask wraps its input in the voice beam, lit while the mic is live
and travelling while the answer is on its way; v40 retires the robot (M.fx.Bot draws nothing, the design's one character is
the live mark); the notifications pill is
the bell, ringing on a press with its label unfurling; reduced motion drops the beam and keeps the plain
controls; on the phone the orb screen draws the listening orb and the voice beam.

Run: cd m360-os && python3 harness/tests/test_effects.py
"""
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_motion as TM  # noqa: E402

SCRATCH = '''(props) => {
  let root = document.getElementById('fx-scratch');
  /* v40: the glass sidebar is fixed over the left edge, so the scratch sits clear of it */
  if (!root) { root = document.createElement('div'); root.id = 'fx-scratch'; root.style.paddingLeft = '140px'; document.body.appendChild(root); }
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


# Home has no Check in on a Sunday (IST), so that one check waits for a working day
SUNDAY = datetime.now(ZoneInfo('Asia/Kolkata')).weekday() == 6


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
    for k in ('ThinkingOrb', 'BorderBeam', 'VoiceBeam', 'useMicrophone', 'BotAvatar', 'BellToggle'):
        check(k in keys, 'the bundle carries ' + k)
    check(not any(k.startswith('Metal') or k.startswith('useMetal') for k in keys) and 'metal' not in p.evaluate('() => window.FX.version'),
          'the bundle no longer carries metal-fx: %r' % keys)
    check(p.evaluate('() => window.FX.version.orbs') == '0.3.2' and p.evaluate('() => M.fx.has()'), 'the bundle names its versions and the app sees it')

    p.evaluate(SCRATCH, {'count': 0})
    p.wait_for_selector('#fx-scratch .thinking-line canvas')

    # ---- the thinking line: the orb on a canvas, with a state from the label ----
    lines = p.evaluate('() => [...document.querySelectorAll("#fx-scratch .thinking-line")].map(l => [l.dataset.state, !!l.querySelector("canvas")])')
    check([x[0] for x in lines] == ['searching', 'composing', 'working'] and all(x[1] for x in lines), 'three orbs with states: %r' % lines)

    # ---- v7: the border beam is retired. A flame card carries the 2px flame line on its top edge, a plain one none ----
    LINE = '(id) => { const s = getComputedStyle(document.getElementById(id), "::before"); return [s.content !== "none" && s.content !== "", s.height, s.backgroundColor]; }'
    check(p.evaluate(LINE, 'fx-hot') == [True, '2px', 'rgb(245, 57, 1)'], 'a flame card carries the flame line: %r' % p.evaluate(LINE, 'fx-hot'))
    check(not p.evaluate('() => !!document.getElementById("fx-hot").closest("[data-beam]")'), 'and no border beam')
    check(not p.evaluate(LINE, 'fx-cold')[0], 'a plain card has no line')

    # ---- v36.2: the metal is retired; the ink button is the plain button in its layout host ----
    plain = p.evaluate('() => { const b = document.getElementById("fx-btn"); const h = b.parentElement; return [!!b.closest(".metal-fx-root"), h.classList.contains("metal-host"), h.classList.contains("metal-ink"), h.querySelectorAll("canvas").length]; }')
    check(plain == [False, True, True, 0], 'the ink button is plain, in its host, with no canvas: %r' % plain)
    check(p.evaluate('() => getComputedStyle(document.getElementById("fx-btn")).visibility') == 'visible', 'the button is visible from the first paint')
    p.locator('#fx-btn').click()
    check(True, 'and takes a click')

    # ---- MetalText is plain text at the size asked, MetalBadge a flame pill ----
    p.evaluate('''() => { const r = document.createElement('div'); r.id = 'fx-scratch2'; document.body.appendChild(r);
      ReactDOM.createRoot(r).render(M.html`<div><span id="fx-mt"><${M.fx.MetalText} size=${28}>42<//></span><span id="fx-ms"><${M.fx.MetalText} size=${16}>7<//></span><span id="fx-mb"><${M.fx.MetalBadge}>new<//></span></div>`); }''')
    p.wait_for_selector('#fx-mb .pill')
    mt = p.evaluate('() => { const e = document.querySelector("#fx-mt > span"); return [e.textContent, getComputedStyle(e).fontSize, document.querySelectorAll("#fx-mt canvas, #fx-mt svg").length, e.children.length]; }')
    check(mt == ['42', '28px', 0, 0], 'the number reads once, in plain type at 28px, with no canvas and no copies: %r' % mt)
    check(p.evaluate('() => getComputedStyle(document.querySelector("#fx-ms > span")).fontSize') == p.evaluate('() => getComputedStyle(document.getElementById("fx-ms")).fontSize'), 'below 22px it takes the type around it')
    mb = p.evaluate('() => { const e = document.querySelector("#fx-mb .pill"); return [e.className, e.textContent]; }')
    check(mb[0].split() == ['pill', 'flame'] and mb[1] == 'new', 'the badge is a flame pill with its word: %r' % mb)

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

    # ---- v40: the robot is retired; M.fx.Bot draws nothing, working or not ----
    check(p.evaluate('() => document.getElementById("fx-bot") === null'), 'the bot draws nothing')
    p.evaluate(SCRATCH, {'count': 12, 'bot': 'working'})
    p.wait_for_timeout(200)
    check(p.evaluate('() => document.getElementById("fx-bot") === null'), 'nor while it works')

    # ---- Home: nothing on the page is drawn in metal; the sidebar foot is the design's three rows ----
    check(p.evaluate('() => document.querySelectorAll(".metal-fx-root, canvas.metal-fx-canvas, .metal-badge-host").length') == 0, 'no metal anywhere on Home')
    foot = p.evaluate('() => [...document.querySelectorAll("#side .sfoot > .nv")].map(b => b.id || b.className)')
    check(len(foot) == 3 and foot[0] == 'sAsk' and foot[1] == 'sTog' and 'side-foot' in foot[2], 'the sidebar foot is Ask m360, Expand and the profile: %r' % foot)
    # v31: the thought is decorative, so it no longer carries a beam (one moving thing per view)
    check(not p.evaluate('() => document.getElementById("quote-card").parentElement.hasAttribute("data-beam")'), 'the thought sits still, without a beam')

    # ---- Ask: the voice beam under the input, no robot anywhere, Send stays plain ----
    p.evaluate(FAKE_SR)
    p.keyboard.press('Control+k'); p.locator('.pal-item[data-k="a-ai"]').click()
    p.wait_for_selector('#buddy-input')
    check(p.evaluate('() => !!document.querySelector("#buddy-input").closest("[data-voice-beam]")'), 'the input sits inside the voice beam')
    ASK_METAL = '() => { const b = document.querySelector("#buddy-send"); return !!(b && b.closest(".metal-fx-root")); }'
    check(not p.evaluate(ASK_METAL), 'an empty Send is the plain disabled button')
    p.fill('#buddy-input', 'what can you do')
    p.wait_for_function('() => { const b = document.querySelector("#buddy-send"); return b && !b.disabled; }')
    check(not p.evaluate(ASK_METAL), 'the Send button stays plain once there is something to ask')
    p.fill('#buddy-input', '')
    p.locator('#buddy-talk').click()
    p.wait_for_function('() => { const w = document.querySelector("#buddy-input").closest("[data-voice-beam]"); return w && w.hasAttribute("data-active"); }')
    check(True, 'the beam is active while the mic is live')
    check(p.evaluate('() => !!document.querySelector(".panel-composer .voice-pill.is-live")'), 'the Talk button records inside the voice pill')
    p.get_by_role('button', name='Listening, tap to stop').first.click()
    p.wait_for_selector('.buddy-bubble #buddy-answer', timeout=20000)
    check(p.locator('.panel-head canvas').count() == 0 and p.locator('.panel-body canvas').count() == 0, 'no robot in the sheet head or the answers')
    check(p.evaluate('() => document.querySelectorAll("canvas[aria-label=\\"m360\\"], #buddy-dock canvas").length') == 0, 'no robot anywhere on the page')
    p.keyboard.press('Escape')

    # ---- reduced motion: the beam and the metal stand down, the controls stay ----
    p.emulate_media(reduced_motion='reduce')
    p.evaluate(SCRATCH, {'count': 1})
    p.wait_for_selector('#fx-hot')
    still = p.evaluate('() => [document.getElementById("fx-hot").parentElement.hasAttribute("data-beam"), !!document.getElementById("fx-btn").closest(".metal-fx-root"), !!document.querySelector("#fx-scratch .thinking-line .vorb"), !!document.getElementById("fx-btn")]')
    check(still == [False, False, True, True], 'reduced motion: no beam, no metal, the plain sphere, the button itself: %r' % still)

    # ---- the phone: the Ask button's m360 AI row opens the sheet; Talk draws the listening orb and the voice beam ----
    ctx = TM.phone_ctx(h)
    m = TM.open_page(h, ctx, 'founder', '#home', seed=True)
    m.wait_for_function('() => !!M.buddy')
    m.evaluate(FAKE_SR)
    check(m.locator('#buddy-dock canvas').count() == 0, 'no droid on the phone')
    m.locator('#tbAsk').click()
    m.locator('.pal-item[data-k="a-ai"]').click()
    m.wait_for_selector('#orb-screen')
    m.locator('#orb-screen .panel-talk-big').click()
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
