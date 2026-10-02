#!/usr/bin/env python3
"""v27 test: the six effects, drawn in the house style.

The thinking line carries a small sphere with a state read from its label; the bot sits beside the
AI's words in Ask, hops on a tap and works while the answer is on its way; the voice glow under the
Ask input lights while the mic is live and gathers into a beam while processing; a hot card's border
carries a travelling beam; a primary button carries a sheen; the bell toggle rings on a press and
rolls its badge when the count rises; the inbox bell rings when something new lands; reduced motion
stills all of it; on the phone the orb screen glows along its bottom edge while listening.

Run: cd m360-os && python3 harness/tests/test_effects.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_motion as TM  # noqa: E402

# a scratch root: render one component and look at it
SCRATCH = '''(props) => {
  let root = document.getElementById('fx-scratch');
  if (!root) { root = document.createElement('div'); root.id = 'fx-scratch'; document.body.appendChild(root); }
  if (!window.__fxRoot) window.__fxRoot = ReactDOM.createRoot(root);
  const el = M.html`<div>
    <${M.Thinking} label="Looking at your screen"/>
    <${M.Thinking} label="Writing the plan"/>
    <${M.Thinking}/>
    <${M.parts.VoiceGlow} on=${true} processing=${true}/>
    <section class="card flame" id="fx-hot">hot</section>
    <button type="button" class="btn" id="fx-btn">Go</button>
    <${M.parts.BellToggle} id="fx-bell" offLabel="Notify me" onLabel="You'll be notified" count=${props.count} defaultPressed=${false}/>
    <${M.parts.Bot} id="fx-bot" state=${props.bot || 'default'} size=${40}/>
  </div>`;
  window.__fxRoot.render(el);
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
    p.wait_for_function('() => !!window.ReactDOM && !!M.parts.BellToggle')
    p.evaluate(SCRATCH, {'count': 0})
    p.wait_for_selector('#fx-scratch .thinking-line')

    # ---- the thinking line: a small sphere with a state ----
    states = p.evaluate('() => [...document.querySelectorAll("#fx-scratch .thinking-line")].map(l => [l.dataset.state, !!l.querySelector(".vorb.mini")])')
    check(states == [['searching', True], ['composing', True], ['working', True]], 'states from the labels: %r' % states)
    an = p.evaluate('() => getComputedStyle(document.querySelector("#fx-scratch .vorb.searching")).animationName')
    check(an == 'orbsearch', 'the searching sphere sweeps: %r' % an)

    # ---- the voice glow: processing gathers into a beam ----
    vg = p.evaluate('() => { const g = document.querySelector("#fx-scratch .vglow"); return [g.className, g.dataset.on, g.dataset.beam, getComputedStyle(g.querySelector("b")).animationName]; }')
    check(vg[1] == '1' and vg[2] == '1' and 'beam' in vg[0] and vg[3] == 'vtravel', 'the beam travels while processing: %r' % vg)

    # ---- the beam on a hot card, the sheen on a button ----
    beam = p.evaluate('() => { const s = getComputedStyle(document.getElementById("fx-hot"), "::before"); return [s.animationName, s.opacity, s.content]; }')
    check(beam[0] == 'beamspin' and beam[1] == '1', 'a hot card carries the beam: %r' % beam)
    sheen = p.evaluate('() => getComputedStyle(document.getElementById("fx-btn"), "::after").backgroundImage')
    check('linear-gradient' in sheen, 'a primary button carries the sheen: %r' % sheen[:40])

    # ---- the bell toggle: a press rings, the label unfurls, the badge rolls ----
    check(p.get_attribute('#fx-bell', 'data-on') == 'false', 'the bell starts off')
    p.evaluate('() => { window.__haptics = []; }')
    p.click('#fx-bell button')
    p.wait_for_function('() => document.querySelector("#fx-bell").dataset.on === "true"')
    ring = p.evaluate('() => document.querySelector("#fx-bell .bell-toggle-glyph").getAnimations().length')
    check(ring >= 1, 'the bell rings on a press: %r animations' % ring)
    waves = p.evaluate('() => [...document.querySelectorAll("#fx-bell .bell-toggle-wave")].reduce((n, w) => n + w.getAnimations().length, 0)')
    check(waves >= 2, 'sound waves leave the rim: %r' % waves)
    check('pick' in p.evaluate('() => window.__haptics'), 'the press nudged')
    faces = p.evaluate('() => [getComputedStyle(document.querySelector("#fx-bell .bell-toggle-face.on")).opacity, getComputedStyle(document.querySelector("#fx-bell .bell-toggle-face.off")).opacity]')
    p.wait_for_timeout(300)
    faces = p.evaluate('() => [getComputedStyle(document.querySelector("#fx-bell .bell-toggle-face.on")).opacity, getComputedStyle(document.querySelector("#fx-bell .bell-toggle-face.off")).opacity]')
    check(faces[0] == '1' and faces[1] == '0', 'the label unfurled: %r' % faces)
    check(p.get_attribute('#fx-bell .bell-toggle-badge', 'data-show') == '0', 'no badge at zero')
    p.evaluate(SCRATCH, {'count': 3})
    p.wait_for_function('() => document.querySelector("#fx-bell .bell-toggle-badge").dataset.show === "1"')
    check(p.inner_text('#fx-bell .bell-toggle-digit') == '3', 'the badge shows the count')
    p.evaluate(SCRATCH, {'count': 12})
    p.wait_for_function('() => document.querySelector("#fx-bell .bell-toggle-digit").textContent === "9+"')
    check(True, 'a count past nine reads 9+')

    # ---- the bot: looks about, hops on a tap, works ----
    check(p.get_attribute('#fx-bot', 'role') == 'img' and p.get_attribute('#fx-bot', 'aria-label') == 'm360', 'the bot is an image with a name')
    an = p.evaluate('() => getComputedStyle(document.querySelector("#fx-bot .bot-lids")).animationName')
    check(an == 'botblink', 'the bot blinks: %r' % an)
    p.evaluate('() => { window.__haptics = []; }')
    p.click('#fx-bot')
    p.wait_for_timeout(100)
    check('tap' in p.evaluate('() => window.__haptics'), 'a tap on the bot nudged')
    check(p.evaluate('() => getComputedStyle(document.querySelector("#fx-bot svg")).animationName') == 'bothop', 'a tap makes it hop')
    p.evaluate(SCRATCH, {'count': 12, 'bot': 'working'})
    p.wait_for_function('() => document.querySelector("#fx-bot").dataset.state === "working"')
    check(p.evaluate('() => getComputedStyle(document.querySelector("#fx-bot svg")).animationName') == 'botwork' and p.get_attribute('#fx-bot', 'aria-label') == 'm360, working', 'working: it hops along and says so')
    p.evaluate(SCRATCH, {'count': 12, 'bot': 'sleeping'})
    p.wait_for_function('() => document.querySelector("#fx-bot").dataset.state === "sleeping"')
    check(p.evaluate('() => getComputedStyle(document.querySelector("#fx-bot .bot-lids")).opacity') == '1', 'asleep: the lids are down')

    # ---- in Ask: the bot beside the AI's words, the glow under the input ----
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.evaluate(FAKE_SR)
    p.locator('.iconbtn[aria-label="Ask m360"]').first.click()
    p.wait_for_selector('#ask-input')
    check(p.locator('.ask-in.vwrap .vglow').count() == 1 and p.get_attribute('.ask-in .vglow', 'data-on') == '0', 'the glow waits under the input')
    p.get_by_role('button', name='Talk').first.click()
    p.wait_for_function('() => document.querySelector(".ask-in .vglow").dataset.on === "1"')
    check(True, 'the glow lights while the mic is live')
    p.get_by_role('button', name='Listening, tap to stop').first.click()
    p.wait_for_function("() => !!document.querySelector('.ask-row .bot[data-state=\"default\"]')", timeout=20000)
    check(p.locator('.ask-row .bot[data-state="default"]').count() >= 1, 'the bot sits beside the answer')
    p.wait_for_function('() => document.querySelector(".ask-in .vglow").dataset.on === "0"', timeout=20000)
    check(True, 'the glow rests once the answer is in')

    # ---- the inbox bell rings when something new lands ----
    p.goto(h.url('founder', '#home', seed=True))
    h.ready(p)
    p.wait_for_selector('.bellbtn svg')
    p.evaluate('''() => { const now = Date.now(); const d = window.__db.get("kudos/u_m2") || {given: []}; d.given = (d.given || []).concat([{id: 'kfx' + now, to: 'u_founder', why: 'for the beam', at: now}]); window.__db.set("kudos/u_m2", d); }''')
    p.wait_for_function('() => [...document.querySelectorAll(".bellbtn svg")].some(el => el.getAnimations().length > 0)')
    check(True, 'the inbox bell rang')

    # ---- reduced motion stills it all ----
    p.emulate_media(reduced_motion='reduce')
    p.evaluate(SCRATCH, {'count': 1})
    p.wait_for_selector('#fx-hot')
    still = p.evaluate('() => [getComputedStyle(document.getElementById("fx-hot"), "::before").animationName, getComputedStyle(document.querySelector("#fx-bot svg")).animationName, getComputedStyle(document.querySelector("#fx-scratch .vorb")).animationName]')
    check(all(x == 'none' for x in still), 'reduced motion: no beam, no hop, no sphere motion: %r' % still)

    # ---- the phone: the orb screen glows along the bottom while listening ----
    ctx = TM.phone_ctx(h)
    m = TM.open_page(h, ctx, 'founder', '#home', seed=True)
    m.wait_for_function('() => !!M.buddy')
    m.locator('.buddy-home.orb-home').click()
    m.wait_for_selector('#orb-screen .vglow.mobile[data-on="1"]')
    check(True, 'the orb screen glows while listening')
    m.click('#orb-screen button[aria-label="Close"]')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
