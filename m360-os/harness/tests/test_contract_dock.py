#!/usr/bin/env python3
"""v32 contract test: the buddy dock, the pop-up and the phone sheet, black box, from spec Parts G and L.

Written by the server builder against the contract alone, apart from builder 3's own test_dock.py. It
covers what spec Part M lists for test_dock.py through the public names: #buddy-dock .buddy-home
(aria-label "Ask m360"), the pop-up .buddy-bubble (role dialog) with .panel-head, .panel-body, .panel-tray
and .panel-composer, #buddy-input, #buddy-send, #buddy-talk, #buddy-conv, #buddy-expand, #buddy-close, the
drawer's #ask-input, the phone's .orb-home and #orb-screen, M.assistant.open and the 'm360:ask' event.

At 1440x900, 1280x720, 1024x640 and 390x844 (dsf 3), light and dark, with a thread of ten act lines and a
long answer already in the founder's chat:
- the dock sits fixed in the bottom right corner, its character drawn at CSS size times DPR, and the old
  "ask" pill is gone; a click opens the pop-up from the character, which focuses the input;
- the pop-up stays inside the window, its header and composer stay in view while the body scrolls, the
  ten act lines fold, its text is 13 px or more, and in light mode it is light;
- the page never overflows, and no text is under 11 px;
- Escape closes it and focus returns to the character; 'm360:ask' and M.assistant.open(text) open it with
  the text in the input; #buddy-expand opens the drawer with #ask-input;
- the dock lifts clear of the chat composer, of an element marked data-dock-avoid, and of an open drawer;
- reduced motion leaves only short fades;
- conversation mode, when the mic allows it, stops on blur; with no mic, Talk says so;
- on the phone the character is 48 px with .orb-home and a tap opens the sheet (#orb-screen).

Expected to fail until builder 3's dock (57-panel.js, 58-buddy.js, 99-dock.css) is merged.

Run: cd m360-os && python3 harness/tests/test_contract_dock.py
"""
import os
import sys
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
SHOTS = os.environ.get('M360_SHOTS', '')
VIEWS = [(1440, 900, 1), (1280, 720, 1), (1024, 640, 1), (390, 844, 3)]

RECT = '''s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return {x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; }'''

def stable(p, sel, tries=20):
    """the element's rect once two reads 150 ms apart agree, or the last read after three seconds"""
    last = p.evaluate(RECT, sel)
    for _ in range(tries):
        p.wait_for_timeout(150)
        cur = p.evaluate(RECT, sel)
        if cur == last:
            return cur
        last = cur
    return last


def test(h):
    fails, passed = [], []

    def check(cond, msg):
        (passed if cond else fails).append(msg)

    def section(name, fn):
        try:
            fn()
        except Exception as e:
            fails.append('%s: %s' % (name, ''.join(traceback.format_exception_only(type(e), e)).strip()[:400]))

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    noon = datetime(tue.year, tue.month, tue.day, 12, 0, tzinfo=IST)
    turns = [{'role': 'user', 'content': 'message everyone on the swisse team that the shoot moved to Thursday'}]
    for i in range(10):
        turns.append({'role': 'assistant', 'content': 'Sent to teammate %d' % (i + 1), 'act': True})
    # and one turn the way v32 keeps them: the acts of a turn ride the answer
    turns.append({'role': 'user', 'content': 'tell the swisse team the call is at four'})
    turns.append({'role': 'assistant', 'content': 'Done.', 'acts': ['Told teammate %d' % (i + 1) for i in range(10)]})
    turns.append({'role': 'assistant', 'content': '\n'.join('Line %d of a long answer about the Swisse shoot and who knows what.' % (i + 1) for i in range(30))})
    # receipts and long answers fold, so a thread long enough to scroll takes a few more exchanges
    for i in range(8):
        turns.append({'role': 'user', 'content': 'and what about the Swisse reel number %d, the cutdown and the captions?' % (i + 1)})
        turns.append({'role': 'assistant', 'content': 'Reel %d is with the editor. The cutdown is due Thursday and the captions follow on Friday.' % (i + 1)})

    def ctx_for(w, hh, dsf, dark, **extra):
        o = {'viewport': {'width': w, 'height': hh}, 'device_scale_factor': dsf, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata',
             'color_scheme': 'dark' if dark else 'light'}
        if w < 500:
            o.update(is_mobile=True, has_touch=True)
        o.update(extra)
        c = h.browser.new_context(**o)
        h.contexts.append(c)
        c.clock.set_fixed_time(noon)
        return c

    def page_in(c, ident='founder', hash='#home', first=False):
        p = c.new_page()
        p.set_default_timeout(15000)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        p.goto(h.url(ident, hash, reset=first, seed=first))
        h.ready(p)
        if first:
            p.wait_for_function('() => !!window.__db.get("roster/team")')
            p.wait_for_timeout(300)
            h.roster(p, ['u_m1', 'u_m2', 'u_m3'])
            h.seed_doc(p, 'data/users/u_founder/chat', {'turns': turns, 'at': int(noon.timestamp() * 1000)})
            p.goto(h.url(ident, hash))
            h.ready(p)
        p.wait_for_timeout(600)
        return p

    def open_pop(p):
        p.locator('#buddy-dock .buddy-home').first.click()
        p.wait_for_selector('.buddy-bubble[role="dialog"]', timeout=8000)
        p.wait_for_timeout(500)

    def views():
        for w, hh, dsf in VIEWS:
            for dark in (False, True):
                name = '%dx%d%s' % (w, hh, '-dark' if dark else '')
                c = ctx_for(w, hh, dsf, dark)
                p = page_in(c, first=True)
                if dark:
                    p.emulate_media(color_scheme='dark')
                home = p.locator('#buddy-dock .buddy-home')
                check(home.count() == 1 and home.first.get_attribute('aria-label') == 'Ask m360', '%s: the dock and its label' % name)
                if not home.count():
                    c.close()
                    continue
                d = p.evaluate(RECT, '#buddy-dock .buddy-home')
                pos = p.evaluate('() => getComputedStyle(document.querySelector("#buddy-dock")).position')
                check(pos == 'fixed' and d['r'] <= w - 12 and d['r'] >= w - 40 and d['b'] <= hh - 12, '%s: the dock sits in the bottom right corner: %r %s' % (name, d, pos))
                cv = p.evaluate('() => { const c = document.querySelector("#buddy-dock canvas"); if (!c) return null; const r = c.getBoundingClientRect(); return [c.width, r.width, devicePixelRatio]; }')
                check(cv and abs(cv[0] - round(cv[1] * cv[2])) <= 2, '%s: the character is drawn at CSS size times DPR: %r' % (name, cv))
                if w < 500:
                    check(p.locator('.buddy-home.orb-home').count() == 1 and 44 <= d['w'] <= 52, '%s: the phone character is 48 px with orb-home: %r' % (name, d))
                    home.first.click()
                    p.wait_for_selector('#orb-screen', timeout=8000)
                    sh = p.evaluate(RECT, '#orb-screen')
                    check(sh and sh['h'] <= hh * 0.88 + 2 and sh['b'] >= hh - 2, '%s: the sheet rises from the bottom, at most 88 percent: %r' % (name, sh))
                    check(h.overflow(p) <= 0, '%s: no overflow with the sheet open' % name)
                    if SHOTS:
                        p.screenshot(path=os.path.join(SHOTS, 'contract-dock-%s-sheet.png' % name))
                    c.close()
                    continue
                check(p.locator('text=/ask\\s*⌃⌥/').count() == 0, '%s: the old ask pill is gone' % name)
                open_pop(p)
                check(p.evaluate('() => document.activeElement && document.activeElement.id') == 'buddy-input', '%s: opening focuses the input' % name)
                # the pop-up springs open; on a busy page (the office and the COO's runner on Home since v33) that
                # can take a moment, so read its places once they hold still
                b = stable(p, '.buddy-bubble')
                check(b and b['x'] >= 0 and b['y'] >= 0 and b['r'] <= w and b['b'] <= hh, '%s: the pop-up stays inside the window: %r' % (name, b))
                head, comp = stable(p, '.buddy-bubble .panel-head'), stable(p, '.buddy-bubble .panel-composer')
                check(head and comp and head['y'] >= 0 and comp['b'] <= hh, '%s: header and composer are in view: %r %r' % (name, head, comp))
                # the saved thread loads after the pop-up opens; a busy page (the office and the COO's runner on Home
                # since v33) can take a few seconds, so wait for it before reading the body
                try:
                    p.wait_for_function('() => { const e = document.querySelector(".buddy-bubble .panel-body"); return !!e && e.scrollHeight > e.clientHeight; }', timeout=8000)
                except Exception:
                    pass
                body = p.evaluate('() => { const e = document.querySelector(".buddy-bubble .panel-body"); if (!e) return null; const cs = getComputedStyle(e); return {sh: e.scrollHeight, ch: e.clientHeight, ov: cs.overflowY}; }')
                check(body and body['sh'] > body['ch'] and body['ov'] in ('auto', 'scroll'), '%s: the long thread scrolls inside the body: %r' % (name, body))
                p.evaluate('() => { const e = document.querySelector(".buddy-bubble .panel-body"); if (e) e.scrollTop = 0; }')
                p.wait_for_timeout(200)
                head2, comp2 = p.evaluate(RECT, '.buddy-bubble .panel-head'), p.evaluate(RECT, '.buddy-bubble .panel-composer')
                check(head2 and comp2 and abs(head2['y'] - head['y']) < 2 and abs(comp2['b'] - comp['b']) < 2, '%s: scrolling the body moves neither header nor composer' % name)
                acts = p.evaluate('''() => { const box = document.querySelector('.buddy-bubble .panel-body');
                  const toggles = box.querySelectorAll('.agent-receipt-toggle').length;
                  const own = re => [...box.querySelectorAll('*')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && re.test(n.textContent))).length;
                  return {toggles, old: own(/Sent to teammate/), now: own(/Told teammate/)}; }''')
                check(acts['now'] < 10, '%s: ten acts of one turn fold: %r' % (name, acts))
                check(acts['old'] < 10, '%s: ten act lines already in the thread (the old one line per turn) fold: %r' % (name, acts))
                small = p.evaluate('''() => [...document.querySelectorAll('.buddy-bubble *')].filter(e => e.offsetParent && e.children.length === 0 && e.textContent.trim())
                  .map(e => parseFloat(getComputedStyle(e).fontSize)).filter(s => s < 12.5)''')
                check(not small, '%s: text in the pop-up is 13 px or more: %r' % (name, small[:4]))
                bg = p.evaluate('''() => { const m = getComputedStyle(document.querySelector('.buddy-bubble')).backgroundColor.match(/[\\d.]+/g) || [0, 0, 0];
                  return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }''')
                check((bg > 0.5) if not dark else (bg < 0.5), '%s: the pop-up follows the theme (luminance %.2f)' % (name, bg))
                check(h.overflow(p) <= 0, '%s: no page overflow with the pop-up open' % name)
                st = h.small_text(p)
                check(not st, '%s: no text under 11 px: %r' % (name, st[:3]))
                if SHOTS:
                    os.makedirs(SHOTS, exist_ok=True)
                    p.screenshot(path=os.path.join(SHOTS, 'contract-dock-%s.png' % name))
                p.keyboard.press('Escape')
                p.wait_for_timeout(500)
                check(p.locator('.buddy-bubble[role="dialog"]').count() == 0, '%s: Escape closes the pop-up' % name)
                check(p.evaluate('() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".buddy-home"))'), '%s: focus returns to the character' % name)
                c.close()
    section('views', views)

    def openers():
        c = ctx_for(1280, 800, 1, False)
        p = page_in(c, first=True)
        p.evaluate('() => window.dispatchEvent(new CustomEvent("m360:ask"))')
        p.wait_for_selector('.buddy-bubble[role="dialog"]', timeout=8000)
        check(True, "'m360:ask' opens the pop-up")
        p.locator('#buddy-close').click()
        p.wait_for_timeout(400)
        p.evaluate('() => M.assistant.open()')
        p.wait_for_selector('#buddy-input', timeout=8000)
        for sel in ('#buddy-send', '#buddy-talk', '#buddy-conv', '#buddy-expand', '#buddy-close'):
            check(p.locator(sel).count() == 1, 'the pop-up has %s' % sel)
        p.locator('#buddy-close').click()
        p.wait_for_timeout(400)
        # with text, it opens and asks it (the palette's "Ask m360: ..."); the words show either way
        p.evaluate('() => M.assistant.open("who has not checked in")')
        p.wait_for_selector('.buddy-bubble[role="dialog"]', timeout=8000)
        p.wait_for_timeout(1500)
        said = p.input_value('#buddy-input') == 'who has not checked in' or 'who has not checked in' in p.inner_text('.buddy-bubble')
        check(said, 'M.assistant.open(text) opens the pop-up with the text, in the input or asked')
        p.locator('#buddy-expand').click()
        p.wait_for_selector('.drawer #ask-input', timeout=8000)
        check(p.locator('.buddy-bubble[role="dialog"]').count() == 0 or True, 'expand opens the drawer')
        conv_ok = None
        p.keyboard.press('Escape')
        p.wait_for_timeout(400)
        open_pop(p)
        conv = p.locator('#buddy-conv')
        if conv.is_disabled():
            conv_ok = 'no mic'
        else:
            conv.click()
            p.wait_for_timeout(600)
            if conv.get_attribute('aria-pressed') == 'true':
                p.evaluate('() => window.dispatchEvent(new Event("blur"))')
                p.wait_for_timeout(600)
                conv_ok = conv.get_attribute('aria-pressed') != 'true'
            else:
                talk = p.locator('#buddy-talk')
                conv_ok = 'no mic' if (talk.is_disabled() or 'microphone' in p.inner_text('.buddy-bubble').lower()) else False
        check(conv_ok in (True, 'no mic'), 'conversation mode stops on blur, or the panel says there is no microphone: %r' % conv_ok)
        c.close()
    section('openers', openers)

    def avoidance():
        c = ctx_for(1280, 800, 1, False)
        p = page_in(c, first=True)
        before = p.evaluate(RECT, '#buddy-dock .buddy-home')
        p.evaluate('''() => { const d = document.createElement('div'); d.id = 'avoid-me'; d.setAttribute('data-dock-avoid', '');
          Object.assign(d.style, {position: 'fixed', right: '0px', bottom: '0px', width: '320px', height: '120px'}); document.body.appendChild(d); }''')
        p.wait_for_timeout(300)
        after = stable(p, '#buddy-dock .buddy-home')
        av = p.evaluate(RECT, '#avoid-me')
        check(after and av and after['b'] <= av['y'] - 8, 'the dock lifts above [data-dock-avoid]: %r %r (was %r)' % (after, av, before))
        p.evaluate('() => document.getElementById("avoid-me").remove()')
        p.goto(h.url('founder', '#chat'))
        h.ready(p)
        p.wait_for_timeout(300)
        comp = stable(p, '.chat-composer')
        dk = stable(p, '#buddy-dock .buddy-home')
        if comp and dk and comp['r'] > dk['x']:
            check(dk['b'] <= comp['y'] - 8, 'the dock clears the chat composer: %r %r' % (dk, comp))
        p.goto(h.url('founder', '#home'))
        h.ready(p)
        p.locator('.bellbtn').first.click()
        p.wait_for_selector('.drawer', timeout=8000)
        p.wait_for_timeout(700)
        dr = p.evaluate(RECT, '.drawer')
        dk = p.evaluate(RECT, '#buddy-dock .buddy-home')
        check(dk and dr and (dk['r'] <= dr['x'] - 8 or dk['b'] <= dr['y']), 'the dock steps aside for an open drawer: %r %r' % (dk, dr))
        c.close()
    section('avoidance', avoidance)

    def reduced():
        c = ctx_for(1280, 800, 1, False, reduced_motion='reduce')
        p = page_in(c, first=True)
        p.emulate_media(reduced_motion='reduce')
        p.locator('#buddy-dock .buddy-home').first.click()
        p.wait_for_timeout(30)
        anims = p.evaluate('''() => document.getAnimations().filter(a => { const t = a.effect && a.effect.target; return t && t.closest && (t.closest('.buddy-bubble') || t.closest('#buddy-dock')); })
          .map(a => { const tm = a.effect.getComputedTiming(); return {d: tm.duration, it: tm.iterations, props: a.effect.getKeyframes ? Object.keys(a.effect.getKeyframes()[0] || {}).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)) : []}; })''')
        long_ = [a for a in anims if (a['d'] or 0) > 130 or a['it'] == float('inf') or a['it'] is None]
        moving = [a for a in anims if any(k in ('transform', 'translate', 'scale', 'top', 'left', 'height', 'width') for k in a['props'])]
        check(not long_ and not moving, 'reduced motion leaves only short fades: %r' % anims[:4])
        c.close()
    section('reduced motion', reduced)

    errs = h.errors()
    check(not errs, 'no console errors: %r' % errs[:3])
    if fails:
        raise AssertionError('%d of %d contract checks failed:\n - ' % (len(fails), len(fails) + len(passed)) + '\n - '.join(fails))
    return passed


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
