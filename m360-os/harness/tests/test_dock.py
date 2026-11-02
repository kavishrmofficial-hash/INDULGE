#!/usr/bin/env python3
"""v32 test, v40 rewrite: the m360 AI sheet, the phone sheet and voice mode.

v40 puts no character on the screen: the corner dock is hidden, nothing is drawn in it at any hour, and
m360 AI opens from the Ask bar's m360 AI row (Ctrl+K) as the glass sheet, a 520px panel 12px from the
right, top and bottom edges that slides in on a spring; the input takes the caret and Escape puts it away.
With a long answer and ten receipts in the thread the sheet fits the window at 1280x720 and 1440x900 in
both themes: the head and the composer stay in view, the body scrolls, the answer folds to eight lines
and the receipts to one line. Over an open drawer it opens above the scrim. Hold Ctrl + Option to talk:
the chip, the live words, let go to send, a short line said back. A quick tap of the keys opens the
sheet to type. Escape stops listening before it closes anything. Conversation mode shows in the head and
the tab title, listens after each answer, stops on "that's all" and when the window loses focus. Narrow
windows get it as a bottom sheet; the phone (390, 3x) opens it from the tab bar's Ask, Talk listens, and
a swipe puts it away. Reduced motion keeps fades only. Screenshots land in the scratchpad when DOCK_SHOTS is set.

Run: cd m360-os && python3 harness/tests/test_dock.py
"""
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
SHOTS = os.environ.get('DOCK_SHOTS', '')

# speech recognition that says, per start, the next line in window.__sayQ, word by word; silence when empty
SR = '''(function () {
  window.__sayQ = window.__sayQ || [];
  window.__srStarts = 0;
  window.SpeechRecognition = function () { this.onresult = null; this.onend = null; this.onerror = null; this._t = 0; this._i = 0; };
  window.SpeechRecognition.prototype.start = function () {
    var self = this; window.__srStarts++;
    var line = (window.__sayQ || []).shift();
    if (!line) return;
    var words = line.split(' ');
    var step = function () {
      self._i++;
      if (self.onresult) self.onresult({results: [[{transcript: words.slice(0, self._i).join(' ')}]]});
      if (self._i < words.length) self._t = setTimeout(step, 90);
    };
    self._t = setTimeout(step, 90);
  };
  window.SpeechRecognition.prototype.stop = function () { clearTimeout(this._t); var self = this; setTimeout(function () { if (self.onend) self.onend(); }, 20); };
  window.SpeechRecognition.prototype.abort = function () { clearTimeout(this._t); };
  window.webkitSpeechRecognition = window.SpeechRecognition;
})();'''

TOUCH = '''(function () {
  try { navigator.vibrate = function () { return true; }; } catch (e) {}
  try { Object.defineProperty(navigator, 'maxTouchPoints', {get: function () { return 1; }, configurable: true}); } catch (e) {}
  var mm = window.matchMedia.bind(window);
  var fake = function (m) { return {matches: m, media: '', addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {}}; };
  window.matchMedia = function (q) { if (q === '(pointer: coarse)') return fake(true); if (q === '(pointer: fine)') return fake(false); return mm(q); };
})();'''

# a long answer and ten acts on one turn: what a busy afternoon leaves in the thread
LONG = '\n'.join('- Line %d of a long answer about who is behind, what is slipping and what to do next.' % i for i in range(1, 31))


def thread():
    acts = [{'group': 'message', 'who': u, 'text': 'Sent to ' + n} for u, n in
            (('u_m1', 'Durvesh'), ('u_m2', 'Aanya'), ('u_m3', 'Ishaan'), ('u_m4', 'Ekta'))] * 2
    acts += ['opened tasks', 'pressed New']
    earlier = []
    for i in range(6):
        earlier += [{'role': 'user', 'content': 'question %d about the Swisse reel' % (i + 1)}, {'role': 'assistant', 'content': 'Answer %d: the cut is with Durvesh and due Friday.' % (i + 1)}]
    return {'turns': earlier + [
        {'role': 'user', 'content': 'who is behind this week?'},
        {'role': 'assistant', 'content': LONG},
        {'role': 'user', 'content': 'message everyone about the Friday review'},
        {'role': 'assistant', 'content': 'Done. Everyone has the Friday review in their DMs.', 'acts': acts},
    ], 'at': 1}


def new_ctx(h, width, height, dsf=1, touch=False, dark=False, reduced=False, fixed=None):
    opts = {'viewport': {'width': width, 'height': height}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata', 'device_scale_factor': dsf}
    if touch:
        opts['has_touch'] = True
    if dark:
        opts['color_scheme'] = 'dark'
    if reduced:
        opts['reduced_motion'] = 'reduce'
    ctx = h.browser.new_context(**opts)
    h.contexts.append(ctx)
    ctx.add_init_script(SR)
    if touch:
        ctx.add_init_script(TOUCH)
    if fixed:
        ctx.clock.set_fixed_time(fixed)
    return ctx


def open_page(h, ctx, ident, hash, **params):
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hash, seed=True, **params))
    h.ready(page)
    return page


def shot(page, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, name + '.png'))


def rect(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; }', sel)


def mode(page):
    return page.evaluate('() => M.buddy.state().mode')


def open_ai(page):
    """v40: m360 AI opens from the Ask bar's m360 AI row"""
    page.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)')
    page.keyboard.press('Control+k')
    page.locator('.pal-item[data-k="a-ai"]').click()
    page.wait_for_selector('.buddy-bubble.agent-pop, #orb-screen')


NO_CHARACTER = '() => { const b = document.querySelector("#buddy-dock .buddy-home"); return !(b && b.getClientRects().length) && !document.querySelector("#buddy-dock canvas"); }'


def quiet_voice(page, said=True):
    page.evaluate('v => { window.__spoken = []; M.speech.say = async t => { window.__spoken.push(t); return v; }; }', said)


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    # ---------- the m360 AI sheet fits, light and dark, at 1280x720 and 1440x900 ----------
    for (w, ht) in ((1280, 720), (1440, 900)):
        for dark in (False, True):
            ctx = new_ctx(h, w, ht, dark=dark)
            p = open_page(h, ctx, 'founder', '#home')
            h.seed_doc(p, 'data/users/u_founder/chat', thread())
            p.wait_for_selector('#buddy-dock', state='attached')
            tag = '%dx%d %s' % (w, ht, 'dark' if dark else 'light')
            if w == 1280 and not dark:
                check(p.evaluate(NO_CHARACTER), 'no character in the corner')
                shot(p, 'dock-closed-1280-light')
            open_ai(p)
            p.wait_for_selector('.buddy-bubble.agent-pop .panel-composer')
            if w == 1280 and not dark:
                names = p.evaluate('() => document.querySelector(".buddy-bubble.agent-pop").getAnimations().map(a => a.animationName)')
                check('gsin' in names, 'the sheet slides in from the right: %r' % names)
                p.wait_for_function('() => document.activeElement && document.activeElement.id === "buddy-input"')
                check(True, 'opening puts the caret in the box')
            p.wait_for_timeout(700)
            pop = rect(p, '.buddy-bubble.agent-pop')
            head = rect(p, '.buddy-bubble .panel-head')
            comp = rect(p, '.buddy-bubble .panel-composer')
            check(abs(pop['w'] - 520) < 1 and abs(w - pop['r'] - 12) < 1 and abs(pop['t'] - 12) < 1 and abs(ht - pop['b'] - 12) < 1, tag + ': the glass sheet, 520px, 12px from the edges %r' % pop)
            check(head['t'] >= pop['t'] - 1 and head['h'] >= 50 and comp['b'] <= pop['b'] + 1 and comp['t'] > head['b'], tag + ': head and composer in view %r %r' % (head, comp))
            sc = p.evaluate('() => { const b = document.querySelector(".buddy-bubble .panel-body"); return [b.scrollHeight, b.clientHeight, b.scrollTop]; }')
            check(sc[0] > sc[1] and sc[2] + sc[1] >= sc[0] - 2, tag + ': the body scrolls and starts at the latest %r' % sc)
            check(p.locator('.buddy-bubble .panel-answer.folded').count() >= 1 and p.locator('.buddy-bubble .panel-more:has-text("Show all")').count() >= 1, tag + ': the long answer folds to eight lines')
            check(p.locator('.buddy-bubble .agent-receipt-toggle[aria-expanded="false"]').count() >= 1 and p.locator('.buddy-bubble .agent-receipt-row').count() == 0, tag + ': the receipts fold')
            check(p.evaluate('() => { const e = document.querySelector(".buddy-bubble .agent-receipt-toggle"); return e.textContent; }').lower().find('messaged') >= 0, tag + ': the fold names the group')
            shot(p, 'pop-%dx%d-%s' % (w, ht, 'dark' if dark else 'light'))
            if w == 1280 and not dark:
                # open the receipts: rows land, the head and the composer hold
                p.locator('.buddy-bubble .agent-receipt-toggle').first.click()
                p.wait_for_selector('.buddy-bubble .agent-receipt-row[data-uid]')
                check(p.locator('.buddy-bubble .agent-receipt-row[data-uid]').count() == 8, 'the group opens to its eight rows')
                pop2 = rect(p, '.buddy-bubble.agent-pop')
                check(pop2['t'] >= 0 and rect(p, '.buddy-bubble .panel-composer')['b'] <= ht, 'open receipts keep the composer in view %r' % pop2)
                # scrolled up: the top fade and Jump to latest
                p.evaluate('() => { const b = document.querySelector(".buddy-bubble .panel-body"); b.scrollTop = 0; b.dispatchEvent(new Event("scroll")); }')
                p.evaluate('() => { const b = document.querySelector(".buddy-bubble .panel-body"); b.scrollTop = 60; b.dispatchEvent(new Event("scroll")); }')
                p.wait_for_selector('.buddy-bubble .panel-jump')
                check(p.locator('.buddy-bubble .agent-panel.scrolled').count() == 1, 'a soft fade at the top once scrolled')
                p.locator('.buddy-bubble .panel-jump').click()
                p.wait_for_function('() => { const b = document.querySelector(".buddy-bubble .panel-body"); return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; }')
                check(True, 'Jump to latest goes to the end')
                p.locator('.buddy-bubble .panel-more').first.click()
                check(p.locator('.buddy-bubble .panel-answer.folded').count() == 0, 'Show all unfolds the answer')
                # the menu: History, Hide for today, Prefs
                p.click('#buddy-more')
                check(p.locator('.panel-menu [role="menuitem"]').count() >= 2, 'the menu lists History and Prefs')
                p.click('#buddy-history-btn')
                p.wait_for_selector('.buddy-bubble #agent-history')
                check(True, 'History shows in the panel')
                p.click('#buddy-more'); p.click('#buddy-history-btn')
                p.wait_for_selector('.buddy-bubble .panel-answer')
            check(h.overflow(p) == 0, tag + ': no sideways scroll')
            small = [x for x in h.small_text(p) if x]
            check(not [x for x in small if 'agent-panel' in str(x)], tag + ': no tiny text %r' % small[:3])
            # Escape: the sheet slides away
            p.keyboard.press('Escape')
            p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
            check(True, tag + ': Escape puts the sheet away')
            p.close()

    # ---------- talking: push to talk, a quick tap, Escape first, conversation ----------
    ctx = new_ctx(h, 1280, 800)
    p = open_page(h, ctx, 'founder', '#home')
    p.wait_for_selector('#buddy-dock', state='attached')
    p.evaluate('() => M.chat.clear(M.lastCtx)')
    p.wait_for_timeout(200)
    quiet_voice(p, said=False)
    p.evaluate('() => { window.__sayQ = ["what can you do"]; }')
    p.keyboard.down('Control'); p.keyboard.down('Alt')
    p.wait_for_selector('#buddy-dock[data-state="listening"]')
    check(p.locator('#buddy-dock .dock-chip:has-text("Listening, Esc to stop")').count() == 1, 'holding the keys shows the listening chip')
    check(p.evaluate('() => M.buddy.state().live && M.buddy.state().push'), 'the hold opened the microphone')
    p.wait_for_function('() => /what can you do/.test((document.querySelector("#buddy-heard") || {}).textContent || "")')
    check(True, 'the words rise in the pop-up as they are said')
    shot(p, 'pop-listening-1280-light')
    p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
    check(p.locator('.buddy-bubble .bubble.me:has-text("what can you do") .panel-via').count() == 1, 'the spoken turn is marked as said out loud')
    p.wait_for_function('() => window.__spoken.length >= 1')
    line = p.evaluate('() => window.__spoken[0]')
    check(len(line.split()) <= 12 or line.endswith('The rest is on screen.'), 'what it says back is short: %r' % line)
    check(p.locator('#buddy-dock .dock-chip').count() == 0, 'the chip goes when the microphone closes')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    # a quick tap of the keys with nothing said: the panel opens for typing
    p.keyboard.down('Control'); p.keyboard.down('Alt'); p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_selector('#buddy-input')
    p.wait_for_timeout(300)
    check(mode(p) == 'asking' and not p.evaluate('() => M.buddy.state().live'), 'a quick tap of the keys opens the panel to type: %r' % mode(p))
    # Escape stops listening first, then closes
    p.evaluate('() => { window.__sayQ = ["hold on a second"]; }')
    p.click('#buddy-talk')
    p.wait_for_function('() => M.buddy.state().live')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !M.buddy.state().live')
    check(p.locator('.buddy-bubble.agent-pop').count() == 1, 'Escape stopped listening and left the panel open')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    check(True, 'a second Escape closes it')
    # conversation mode: the head toggle, the dock chip, the tab title; it listens after each answer and stops on "that's all"
    quiet_voice(p, said=True)
    title0 = p.title()
    open_ai(p)
    p.wait_for_selector('#buddy-conv')
    p.evaluate('() => { window.__sayQ = ["what can you do", "that\'s all"]; }')
    p.click('#buddy-conv')
    p.wait_for_function('() => M.buddy.state().conv')
    check(p.get_attribute('#buddy-conv', 'aria-pressed') == 'true', 'the head toggle is pressed')
    check(p.locator('#buddy-dock .dock-chip.conv:has-text("Listening")').count() == 1, 'the dock shows Listening, Stop')
    check(p.title().startswith('Listening · '), 'the tab title says it is listening: %r' % p.title())
    shot(p, 'pop-conversation-1280-light')
    p.wait_for_function('() => [...document.querySelectorAll(".buddy-bubble .bubble.me")].some(b => /what can you do/.test(b.textContent))', timeout=20000)
    p.wait_for_function('() => !M.buddy.state().conv', timeout=30000)
    check(p.evaluate('() => window.__srStarts') >= 2, 'it listened again after the answer')
    check(p.title() == title0 and p.locator('#buddy-dock .dock-chip').count() == 0, 'saying that is all ends it: title %r' % p.title())
    # on again, then the window loses focus: it stops
    p.evaluate('() => { window.__sayQ = []; }')
    p.click('#buddy-conv')
    p.wait_for_function('() => M.buddy.state().conv && M.buddy.state().live')
    p.evaluate('() => window.dispatchEvent(new Event("blur"))')
    p.wait_for_function('() => !M.buddy.state().conv && !M.buddy.state().live')
    check(p.title() == title0, 'leaving the window ends conversation mode')
    # Ctrl + Option + L turns it on from anywhere
    p.keyboard.down('Control'); p.keyboard.down('Alt'); p.keyboard.press('l'); p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_function('() => M.buddy.state().conv')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !M.buddy.state().conv')
    check(True, 'Ctrl + Option + L starts it and Escape stops it')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')

    # ---------- with the agent on the page: the grammar runs with no model, the tray holds a card, a spoken yes sends it ----------
    if p.evaluate('() => !!(M.agent && M.agent.yesFor && M.brain && M.brain.hold)'):
        quiet_voice(p, said=True)
        open_ai(p)
        p.wait_for_selector('#buddy-input')
        n0 = p.evaluate('() => window.__sampleCalls.length')
        p.fill('#buddy-input', 'set my status to at the Swisse shoot')
        p.keyboard.press('Enter')
        p.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
        check(p.evaluate('() => window.__sampleCalls.length') == n0, 'a grammar hit runs with no model call')
        p.evaluate('''() => { window.__ran = 0; for (let i = 0; i < 3; i++) M.brain.hold('Send it ' + i, 'A card that waits on a tap, with a line of detail to read first.', () => { window.__ran++; return {say: 'Sent.'}; }, {turn: i === 2 ? M.assistant.turn : {id: 'another-turn'}}); M.assistant.promptAt = Date.now(); }''')
        p.wait_for_selector('.buddy-bubble .panel-tray .pending-act')
        p.wait_for_timeout(300)
        pop = rect(p, '.buddy-bubble.agent-pop'); tray = rect(p, '.buddy-bubble .panel-tray'); comp = rect(p, '.buddy-bubble .panel-composer')
        check(tray['h'] <= pop['h'] * 0.4 + 1 and comp['b'] <= pop['b'] + 1 and pop['t'] >= 0, 'the tray keeps to two fifths and the composer stays %r %r' % (tray, pop))
        shot(p, 'pop-tray-1280-light')
        # a yes for the one card this turn left waiting
        p.evaluate('() => { window.__sayQ = ["yes"]; }')
        p.keyboard.down('Control'); p.keyboard.down('Alt')
        p.wait_for_function('() => /yes/.test((document.querySelector("#buddy-heard") || {}).textContent || "")')
        p.keyboard.up('Alt'); p.keyboard.up('Control')
        p.wait_for_function('() => window.__ran === 1', timeout=10000)
        check(p.locator('.pending-act').count() == 2, 'a spoken yes sent only the card from its own turn')
        p.evaluate('() => M.brain.pending.list.slice().forEach(x => M.brain.drop(x.id))')
        # it listens a moment after its spoken answer: the first Escape stops that, the next closes
        for _ in range(3):
            if not p.locator('.buddy-bubble').count():
                break
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
        p.wait_for_function('() => !document.querySelector(".buddy-bubble")')

    # ---------- v40: no dock to place; the Ask bar sits at the top of the canvas ----------
    p.keyboard.press('Control+k')
    p.wait_for_selector('#island.cmd #pal-input')
    p.wait_for_timeout(900)
    isl = rect(p, '#island')
    check(isl and isl['t'] <= 16, 'the Ask bar sits at the top of the canvas: %r' % isl)
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector("#island.cmd")')
    # v40: the dock has no Hide for today (nothing shows to hide); the menu keeps History and Prefs
    h.go(p, 'founder', hash='#home')
    open_ai(p)
    p.click('#buddy-more')
    check(p.locator('#buddy-hide').count() == 0 and p.locator('#buddy-prefs').count() == 1, 'the sheet menu has no Hide for today')
    p.keyboard.press('Escape')
    for _ in range(2):
        if p.locator('.buddy-bubble').count():
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
    # Me: "Talking to m360"; the talk key can be switched off
    h.go(p, 'founder', hash='#me')
    p.wait_for_selector('#dock-prefs')
    p.locator('#dock-prefs').get_by_role('tab', name='Off').click()
    check(p.evaluate('() => localStorage.getItem("m360.talkKey")') == 'off', 'the talk key pref is kept')
    p.keyboard.down('Control'); p.keyboard.down('Alt'); p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_timeout(500)
    check(p.locator('.buddy-bubble').count() == 0 and not p.evaluate('() => M.buddy.state().live'), 'with the talk key off the keys do nothing')
    p.evaluate('() => localStorage.setItem("m360.talkKey", "ctrlopt")')
    p.close()

    # ---------- v40: no character at any hour (the robot is retired) ----------
    late = datetime(2026, 9, 30, 23, 10, tzinfo=IST)
    ctx = new_ctx(h, 1280, 800, fixed=late)
    p = open_page(h, ctx, 'founder', '#home')
    p.wait_for_selector('#buddy-dock', state='attached')
    check(p.evaluate(NO_CHARACTER), 'nothing drawn in the corner out of hours')
    p.close()

    # ---------- reduced motion: fades only ----------
    ctx = new_ctx(h, 1280, 800, reduced=True)
    p = open_page(h, ctx, 'founder', '#home')
    open_ai(p)
    p.wait_for_selector('.buddy-bubble.agent-pop')
    names = p.evaluate('() => document.querySelector(".buddy-bubble.agent-pop").getAnimations().map(a => a.animationName)')
    check('gsin' not in names and names in ([], ['fade']), 'reduced motion: no slide %r' % names)
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    p.close()

    # ---------- a drawer, a narrow window, the keys and what is never pressed ----------
    ctx = new_ctx(h, 1280, 800)
    p = open_page(h, ctx, 'founder', '#home')
    p.wait_for_selector('#buddy-dock', state='attached')
    # over a drawer the sheet stands above the scrim: a tap reaches it
    p.keyboard.press('?')
    p.wait_for_selector('.drawer')
    p.wait_for_timeout(400)
    on_top = '''s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(30, r.height / 2)); return !!(x && x.closest(s)); }'''
    p.evaluate('() => M.assistant.open("")')
    p.wait_for_selector('.buddy-bubble.agent-pop')
    p.wait_for_timeout(500)
    check(p.locator('.drawer').count() == 1 and p.evaluate(on_top, '.buddy-bubble.agent-pop'), 'the pop-up opens over the scrim, the drawer stays')
    p.wait_for_function('() => document.activeElement && document.activeElement.id === "buddy-input"')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    check(p.locator('.drawer').count() == 1, 'Escape in the pop-up closes the pop-up and leaves the drawer open')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    h.go(p, 'founder', hash='#home')
    p.wait_for_selector('#buddy-dock', state='attached')
    # Ctrl + Option + L by its key code: on a Mac, Option + L types a symbol
    p.evaluate('''() => window.dispatchEvent(new KeyboardEvent('keydown', {key: '\\u00ac', code: 'KeyL', ctrlKey: true, altKey: true}))''')
    p.wait_for_function('() => M.buddy.state().conv')
    check(True, 'Ctrl + Option + L works on a Mac keyboard')
    p.keyboard.press('Escape'); p.wait_for_function('() => !M.buddy.state().conv')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    # a shortcut of its own (VoiceOver's Ctrl + Option + arrows): the ear closes and the panel goes again
    p.evaluate('() => { window.__sayQ = []; }')
    p.keyboard.down('Control'); p.keyboard.down('Alt')
    p.wait_for_function('() => M.buddy.state().live')
    p.keyboard.press('ArrowRight')
    p.wait_for_function('() => !M.buddy.state().live && !document.querySelector(".buddy-bubble")')
    p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_timeout(300)
    check(p.locator('.buddy-bubble').count() == 0, 'Ctrl + Option + another key is left to that shortcut')
    # held, then the window loses the keys: nothing half heard is sent
    n0 = p.evaluate('() => M.chat.turns.length')
    p.evaluate('() => { window.__sayQ = ["send this anyway"]; }')
    p.keyboard.down('Control'); p.keyboard.down('Alt')
    p.wait_for_function('() => /send this anyway/.test((document.querySelector("#buddy-heard") || {}).textContent || "")')
    p.evaluate('() => window.dispatchEvent(new Event("blur"))')
    p.wait_for_function('() => !M.buddy.state().live')
    p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_timeout(600)
    check(p.evaluate('() => M.chat.turns.length') == n0, 'a hold that loses the window sends nothing')
    for _ in range(2):
        if p.locator('.buddy-bubble').count():
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
    # a quick tap of the keys puts the caret in the box
    p.keyboard.down('Control'); p.keyboard.down('Alt'); p.keyboard.up('Alt'); p.keyboard.up('Control')
    p.wait_for_function('() => document.activeElement && document.activeElement.id === "buddy-input"')
    check(True, 'a quick tap of the keys is ready for typing')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".buddy-bubble")')
    # never pressed for them: marking pay as paid, an export, the pulse (at the top of the page: Home is taller
    # since v33, so the pointing above may have scrolled it)
    p.evaluate('''() => { const box = document.createElement('div'); box.id = 'pulse-card';
      const a = document.createElement('button'); a.textContent = 'Mark paid'; a.onclick = () => { window.__pressed = (window.__pressed || 0) + 1; };
      const b = document.createElement('button'); b.textContent = 'Export CSV'; b.onclick = a.onclick;
      const c = document.createElement('button'); c.textContent = 'Great week'; c.onclick = a.onclick; box.appendChild(c);
      document.querySelector('.main').prepend(a, b, box); window.scrollTo(0, 0); }''')
    said = p.evaluate('''async () => { const t = M.assistant.screenTools(M.lastCtx, {log: () => {}}); const click = t.tools.find(x => x.name === 'click');
      const out = []; for (const label of ['Mark paid', 'Export CSV', 'Great week']) { t.scan();
        const el = [...document.querySelectorAll('[data-ai]')].find(e => e.textContent.trim() === label);
        out.push(await click.execute({id: el.getAttribute('data-ai')})); }
      return out; }''')
    check(not p.evaluate('() => window.__pressed') and all(s.startswith('not pressed') for s in said), 'paid, export and the pulse are pointed at, never pressed: %r' % said)
    p.close()

    # ---------- a narrow window with a mouse: the sheet is a bottom sheet, and it fits over a drawer ----------
    ctx = new_ctx(h, 800, 700)
    p = open_page(h, ctx, 'founder', '#home')
    p.wait_for_selector('#buddy-dock', state='attached')
    p.wait_for_timeout(500)
    p.keyboard.press('?')
    p.wait_for_selector('.drawer')
    p.evaluate('() => M.assistant.open("")')
    p.wait_for_selector('.buddy-bubble.agent-pop')
    p.wait_for_timeout(600)
    pop = rect(p, '.buddy-bubble.agent-pop')
    check(pop['l'] == 0 and pop['r'] == 800 and pop['t'] >= 0 and abs(pop['b'] - 700) < 1 and p.evaluate(on_top, '.buddy-bubble.agent-pop'), 'a bottom sheet in a narrow window, over a drawer: %r' % pop)
    p.close()

    # ---------- the phone: the sheet at 390, 3x, light and dark ----------
    for dark in (False, True):
        ctx = new_ctx(h, 390, 844, dsf=3, touch=True, dark=dark)
        m = open_page(h, ctx, 'founder', '#home')
        m.wait_for_selector('#buddy-dock', state='attached')
        check(m.evaluate(NO_CHARACTER), 'no droid on the phone')
        quiet_voice(m, said=False)   # nothing said back, so no follow-up listening races the swipe
        m.evaluate('() => { window.__sayQ = ["what is on my calendar this week"]; }')
        # the tab bar's round Ask opens the Ask bar; its m360 AI row raises the sheet; Talk listens
        m.locator('#tbAsk').click()
        m.locator('.pal-item[data-k="a-ai"]').click()
        m.wait_for_selector('#orb-screen')
        m.locator('#orb-screen .panel-talk-big').click()
        m.wait_for_function('() => M.buddy.state().mode === "listening"')
        check(m.get_attribute('#orb-screen', 'data-mode') == 'listening', 'Talk sets the sheet listening')
        sh = rect(m, '#orb-screen')
        check(sh['h'] <= 844 * 0.88 + 1 and abs(sh['b'] - 844) < 1, 'the sheet rises to at most 88%% of the screen: %r' % sh)
        check(m.locator('#orb-screen .panel-grab').count() == 1, 'the sheet has its handle')
        m.wait_for_function('() => /calendar this week/.test((document.querySelector("#orb-heard") || {}).textContent || "")')
        m.click('#orb-tap')
        m.wait_for_function('() => M.buddy.state().mode === "answer"', timeout=20000)
        check(m.locator('#orb-answer').count() == 1 and 'calendar this week' in m.inner_text('#orb-heard'), 'the answer sits under the words: %r' % m.evaluate('() => [document.querySelectorAll("#orb-answer").length, (document.querySelector("#orb-heard") || {}).textContent, M.buddy.state().mode]'))
        m.wait_for_timeout(400)
        check(h.overflow(m) == 0, 'the sheet never scrolls sideways')
        shot(m, 'phone-sheet-390-%s' % ('dark' if dark else 'light'))
        # drag the head down: it goes
        hd = rect(m, '#orb-screen .panel-state')
        m.mouse.move(hd['l'] + 4, hd['t'] + 4)
        m.mouse.down()
        m.mouse.move(hd['l'] + 4, hd['t'] + 80, steps=4)
        m.mouse.move(hd['l'] + 4, hd['t'] + 200, steps=4)
        m.mouse.up()
        m.wait_for_selector('#orb-screen', state='detached')
        check(mode(m) == 'idle', 'a swipe down puts the sheet away: %r' % mode(m))
        m.close()

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
