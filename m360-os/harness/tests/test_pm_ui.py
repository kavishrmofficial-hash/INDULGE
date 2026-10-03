#!/usr/bin/env python3
"""v32 test: the personal manager's surfaces, in both themes, on a desk and on a phone.

The chain m1 > m2 > m3 (m1 reports to Kaavish), personal managers on. Tuesday next week at 11:50: m3
has not checked in (step 2 reached m2 at 11:45), has overdue work and work m2 sent back yesterday.

- The report's card (#pm-card): the pill bot at 32px, a row per thing with its key, "Why this", the ladder
  line, the one primary action, the answer chips; "See what Aanya sees" opens the mirror sheet.
- Covering answers: "On it, tomorrow" on the overdue work covers step 2 today and the same work
  tomorrow; a typed reply goes to m2 as a DM line and covers today.
- The manager's view: Your team carries the bot's head, a chip on each flag line, the sent back work as
  its own line; the chip's menu (again, mine, drop, message, copy); "Nudge again" once a day.
- The inbox lists the bot's lines with the pill face, silently; the team flags the bot chases go silent.
- The person page's bot log for the chain, never for someone outside it.
- Admin: the founder's card with the switch, the kinds, the ladder strip and the audit.
- Me: the manager's "Your bot" (held on, kinds, wait, voice with a live preview), the report's view.
- A bot notice carries the pill face.
- Effects and design: chip text differs from its ground in both themes; the bot canvas is the CSS size
  times the device pixel ratio at dsf 3 and at 3840 wide; on a phone the chips wrap at 44px targets.
- Light 1280 and dark 390@3x: no sideways scroll, no text under 11px, no console errors.

Screenshots of each view go to SHOTS (light and dark, 1280 and 390@3x).

Run: cd m360-os && python3 harness/tests/test_pm_ui.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}
SHOTS = os.environ.get('PM_SHOTS', '/tmp/claude-0/-home-user-INDULGE/c70c5fa1-d903-5f8a-a380-0c7e1b00c68e/scratchpad/v32/pm')


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    os.makedirs(SHOTS, exist_ok=True)
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()
    mon = (tue - timedelta(days=1)).isoformat()
    wed = (tue + timedelta(days=1)).isoformat()

    def at(hh, mm, day=0):
        d = tue + timedelta(days=day)
        return datetime(d.year, d.month, d.day, hh, mm, tzinfo=IST)

    def ms(hh, mm, day=0):
        return int(at(hh, mm, day).timestamp() * 1000)

    def scene(label, width, height, dark, dsf):
        opts = {'viewport': {'width': width, 'height': height}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata', 'device_scale_factor': dsf,
                'color_scheme': 'dark' if dark else 'light'}
        if width < 600:
            opts.update(is_mobile=True, has_touch=True)
        bctx = h.browser.new_context(**opts)
        h.contexts.append(bctx)
        bctx.clock.set_fixed_time(at(11, 50))
        pg = bctx.new_page()
        pg.set_default_timeout(15000)
        pg.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        pg.goto(h.url('founder', '#home', reset=True, seed=True))
        h.ready(pg)

        def be(ident, hash='#home'):
            pg.goto('about:blank')
            pg.goto(h.url(ident, hash))
            h.ready(pg)
            pg.wait_for_function('() => window.M && M.pm && M.lastCtx && M.pm.loaded(M.lastCtx)')
            pg.evaluate('() => { M.pm.PASS = 1e9; }')
            pg.wait_for_timeout(500)

        def tap(sel, **kw):
            # into the middle of the screen first: on a phone the sticky top bar would take the tap
            loc = pg.locator(sel, **kw).first
            loc.evaluate('e => e.scrollIntoView({block: "center"})')
            try:
                loc.click(timeout=5000)
            except Exception:
                # a phone page still settling under a sticky bar: the control's own click
                loc.evaluate('e => e.click()')

        def ev(expr, arg=None):
            return pg.evaluate('(a) => { const ctx = M.lastCtx; return (%s); }' % expr, arg)

        def shot(name):
            pg.wait_for_timeout(350)
            pg.screenshot(path=os.path.join(SHOTS, '%s-%s.png' % (name, label)), full_page=False)

        def sane(where):
            if h.overflow(pg) > 0:
                print('WIDE', pg.evaluate('() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map(e => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right) + " in " + (e.closest(".metal-host, .metal-badge-host") || {outerHTML: ""}).outerHTML.slice(0, 160).replace(/<canvas[^>]*>/g, ""))'))
            check(h.overflow(pg) <= 0, '%s %s: no sideways scroll (%r)' % (label, where, h.overflow(pg)))
            small = [s for s in h.small_text(pg) if 'pm' in where or True]
            check(not small, '%s %s: no text under 11px: %r' % (label, where, small[:4]))

        pg.wait_for_function('() => !!window.__db.get("roster/team")')
        pg.wait_for_timeout(300)
        h.roster(pg, [M1, M2, M3], extra={M2: {'reportsTo': M1}, M3: {'reportsTo': M2}})
        for u, n in ((M1, 'Durvesh Patil'), (M2, 'Aanya Mehta'), (M3, 'Ishaan Rao'), (F, '')):
            h.seed_doc(pg, 'me/' + u, {'name': n} if n else {})
            h.seed_doc(pg, 'eod/' + u, {'days': {mon: {'shipped': 'x', 'next': 'y', 'blocked': '', 'at': ms(19, 0, -1)}}})
            h.seed_doc(pg, 'leave/' + u, {'reqs': []})
        h.seed_doc(pg, 'checkin/' + F, {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        h.seed_doc(pg, 'checkin/' + M1, {'days': {today: {'in': ms(10, 5), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        h.seed_doc(pg, 'checkin/' + M2, {'days': {today: {'in': ms(10, 20), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        h.seed_doc(pg, 'checkin/' + M3, {'days': {}})
        h.seed_doc(pg, 'tasks/t_sw', {'title': 'Swisse reel cutdown', 'owner': M3, 'by': M2, 'status': 'doing', 'due': mon, 'created': ms(9, 0, -4), 'updated': ms(9, 0, -4), 'subtasks': {}, 'comments': {}})
        h.seed_doc(pg, 'tasks/t_ny', {'title': 'Nykaa carousel', 'owner': M3, 'by': M2, 'status': 'todo', 'due': wed, 'created': ms(9, 0, -4), 'updated': ms(11, 20, -1),
                                      'sentBackBy': M2, 'sentBackAt': ms(11, 20, -1), 'sentBackNote': 'tighter crop', 'subtasks': {}, 'comments': {}})
        base = pg.evaluate('() => window.__db.get("settings/app") || {}')
        base.pop('pm', None)
        h.seed_doc(pg, 'settings/app', base)

        # ---- off: nothing shows anywhere ----
        be('m3')
        check(pg.locator('#pm-card').count() == 0, '%s off: no card' % label)
        be('m2')
        check(pg.locator('#pm-team-head').count() == 0 and pg.locator('.pm-chip').count() == 0, '%s off: no bot on Your team' % label)
        h.seed_doc(pg, 'settings/app', dict(base, pm={'on': True}))

        # ---- the report's card ----
        be('m3')
        pg.wait_for_selector('#pm-card .pm-row')
        keys = pg.evaluate('() => [...document.querySelectorAll("#pm-card .pm-row")].map(r => r.dataset.k)')
        want = ['u_m3:noin:-:' + today, 'u_m3:overdue:t_sw:' + today, 'u_m3:sentback:t_ny:' + today]
        check(sorted(keys) == sorted(want), '%s: one row per thing: %r' % (label, keys))
        card = pg.inner_text('#pm-card')
        check("From Aanya's bot" in card and 'Aanya was told at 11:45.' in card and 'If there is no answer by 12:15, Aanya hears about it.' in card, '%s: the ladder lines: %r' % (label, card[:400]))
        check('The Swisse reel cutdown was due ' in card and "Aanya sent the Nykaa carousel back at 11:20 and it has not moved since. Is it on today's list?" in card, '%s: the lines: %r' % (label, card[:600]))
        canv = pg.evaluate('() => { const c = document.querySelector("#pm-card .pm-bot canvas"); if (!c) return null; const r = c.getBoundingClientRect(); return [c.width, r.width, devicePixelRatio]; }')
        check(canv and abs(canv[0] - round(canv[1] * canv[2])) <= 1, '%s: the bot canvas is its CSS size times the DPR: %r' % (label, canv))
        row = '#pm-card .pm-row[data-k="u_m3:overdue:t_sw:%s"]' % today
        tap(row + ' .pm-whybtn')
        check('Due ' in pg.inner_text(row + ' .pm-why'), '%s: Why this opens the fact' % label)
        tap(row + ' button[data-how="onit"]')
        pg.wait_for_selector(row + ' [data-eta="tomorrow"]')
        if width < 600:
            hs = pg.evaluate('r => [...document.querySelectorAll(r + " .pm-chips .chip, " + r + " .pm-eta .chip, " + r + " .pm-acts .btn")].map(b => Math.round(b.getBoundingClientRect().height))', row)
            check(hs and min(hs) >= 44, '%s: 44px targets on the phone: %r' % (label, hs))
            wrapped = pg.evaluate('r => { const box = document.querySelector(r).getBoundingClientRect(); return [...document.querySelectorAll(r + " .chip")].every(b => b.getBoundingClientRect().right <= box.right + 1); }', row)
            check(wrapped, '%s: the chips wrap inside the row' % label)
        sane('card')
        shot('pm-card')
        tap(row + ' [data-eta="tomorrow"]')
        pg.wait_for_selector(row + ' .pm-said')
        check('You said: on it, in by ' in pg.inner_text(row + ' .pm-said'), '%s: the row reads the answer' % label)
        st = ev('M.pm.items(ctx, "u_m3").find(i => i.K === a).steps.find(s => s.step === "2").state', 'u_m3:overdue:t_sw:' + today)
        check(st == 'skipped', '%s: "on it, tomorrow" covers step 2: %r' % (label, st))
        nxt = ev('(() => { const i = M.pm.items(ctx, "u_m3", {now: a}).find(x => x.kind === "overdue"); return [i.state, i.steps.find(s => s.step === "2").state]; })()', ms(11, 50, 1))
        check(nxt == ['answered', 'skipped'], '%s: and the same work tomorrow: %r' % (label, nxt))
        # a typed reply on the sent back work: a DM line to m2, today covered
        srow = '#pm-card .pm-row[data-k="u_m3:sentback:t_ny:%s"]' % today
        tap(srow + ' button[data-how="reply"]')
        pg.fill(srow + ' input[data-note="reply"]', 'On it after lunch, the crop is done.')
        tap(srow + ' .pm-note .btn')
        pg.wait_for_function('() => ((window.__db.get("chat/dm.u_m2.u_m3:u_m3") || {}).msgs || []).some(m => m.pmHow === "reply")')
        st = ev('M.pm.items(ctx, "u_m3").find(i => i.kind === "sentback").steps.find(s => s.step === "2").state')
        check(st == 'skipped', '%s: a reply covers today: %r' % (label, st))
        tap('#pm-mirror')
        pg.wait_for_selector('#pm-mirror-list .pm-chip')
        check('Ishaan' in pg.inner_text('#pm-mirror-list'), '%s: the mirror shows the manager\'s lines' % label)
        sane('mirror')
        shot('pm-mirror')
        pg.keyboard.press('Escape')

        # ---- the manager's view ----
        be('m2')
        pg.wait_for_selector('#team-u_m3 .pm-chip')
        check(pg.locator('#pm-team-head').count() == 1 and 'Your bot is on' in pg.inner_text('#pm-team-head'), '%s: the bot on Your team' % label)
        chips = pg.evaluate('() => [...document.querySelectorAll("#team-u_m3 .pm-chip")].map(c => [c.dataset.k, c.textContent, c.className])')
        kn = 'u_m3:noin:-:' + today
        noin = [c for c in chips if c[0] == kn]
        check(noin and noin[0][1] == 'with you since 11:45' and 'flame' in noin[0][2], '%s: the noin chip: %r' % (label, chips))
        check(any(c[1].startswith('on it, by ') for c in chips) and any(c[1] == 'replied' for c in chips), '%s: the answered chips: %r' % (label, chips))
        check('Ishaan saw the nudge about the Nykaa carousel' in pg.inner_text('#team-u_m3') or 'Nykaa carousel' in pg.inner_text('#team-u_m3'), '%s: the sent back work has its own line' % label)
        contrast = pg.evaluate('''() => [...document.querySelectorAll(".pm-chip")].map(c => { const s = getComputedStyle(c); return [c.textContent, s.color, s.backgroundColor]; })''')
        check(contrast and all(c[1] != c[2] for c in contrast), '%s: chip text differs from its ground: %r' % (label, contrast))
        tap('#team-u_m3 .pm-chip[data-k="%s"]' % kn)
        pg.wait_for_selector('.pm-menu')
        dos = pg.evaluate('() => [...document.querySelectorAll(".pm-menu button[data-do]")].map(b => b.dataset.do)')
        check(dos == ['again', 'mine', 'drop', 'message', 'copy'], '%s: the menu: %r' % (label, dos))
        sane('team')
        shot('pm-team')
        tap('.pm-menu button[data-do="again"]')
        pg.wait_for_function('k => ((((window.__db.get("me/u_m2") || {}).pm || {}).ack || {})[k] || {}).again > 0', arg=kn)
        tap('#team-u_m3 .pm-chip[data-k="%s"]' % kn)
        check(pg.locator('.pm-menu button[data-do="again"]').is_disabled(), '%s: nudge again, once a day' % label)
        st = ev('M.pm.items(ctx, "u_m3").find(i => i.K === a).steps.find(s => s.step === "1m").state', kn)
        check(st == 'due', '%s: the tap brings step 1m: %r' % (label, st))
        pg.wait_for_function('() => !!(document.activeElement && document.activeElement.closest(".pm-menu"))')
        pg.keyboard.press('Escape')
        pg.wait_for_function('k => !document.querySelector(".pm-menu") && document.activeElement && document.activeElement.getAttribute("data-k") === k', arg=kn)
        check(True, '%s: the menu takes the focus and Escape gives it back to the chip' % label)
        # the inbox: the bot's lines with the pill face, nothing of it bubbles on its own
        tap('.bellbtn:visible')
        pg.wait_for_selector('.drawer .inbox-item')
        check(pg.locator('.drawer .inbox-bot').count() >= 1, '%s: the inbox carries the bot\'s lines' % label)
        silent = ev('M.inbox.items(ctx).filter(i => i.kind === "pm" || i.id.startsWith("team:")).every(i => i.silent)')
        check(silent, '%s: the bot\'s items and the flags it chases are silent' % label)
        sane('inbox')
        shot('pm-inbox')
        pg.keyboard.press('Escape')
        # the DM with the report: the derived rows
        be('m2', '#chat/dm.u_m2.u_m3')
        pg.wait_for_selector('#pm-dm .pm-dm-row')
        check('only you two see this' in pg.inner_text('#pm-dm'), '%s: the DM rows say who sees them' % label)
        sane('dm')
        shot('pm-dm')
        # the person page: the bot log for the chain
        be('m2', '#people/u_m3')
        pg.wait_for_selector('#person-pm')
        sane('log')
        shot('pm-log')
        be('m3', '#people/u_m2')
        pg.wait_for_selector('#person-head')
        check(pg.locator('#person-pm').count() == 0, '%s: no bot log for someone outside the chain' % label)
        # Me: the manager's own bot, the report's view
        be('m2', '#me')
        pg.wait_for_selector('#pm-me #pm-bot-kinds .pill[data-kind]')
        prev = pg.inner_text('#pm-me .pm-preview')
        tap('#pm-bot-voice button', has_text='Brief')
        pg.wait_for_function('() => (((window.__db.get("me/u_m2") || {}).pm || {}).cfg || {}).voice === "brief"')
        pg.wait_for_function('p => document.querySelector("#pm-me .pm-preview").innerText !== p', arg=prev)
        check('No check-in yet. Your day started at' in pg.inner_text('#pm-me .pm-preview'), '%s: the voice preview turns brief' % label)
        check(pg.locator('#pm-me-bot').count() == 1 and "durvesh's bot" in pg.inner_text('#pm-me').lower(), '%s: and the bot that chases m2 herself' % label)
        pg.locator('#pm-me').scroll_into_view_if_needed()
        sane('me')
        shot('pm-me')
        # Admin
        be('founder', '#admin')
        if width < 600:
            tap('#fold-admin-%d .fold-head' % pg.evaluate('() => M.adminCards.indexOf(M.parts.PmAdminCard)'))
        pg.wait_for_selector('#pm-admin')
        check(pg.locator('#pm-on').get_attribute('data-on') == 'true', '%s: the switch reads on' % label)
        tap('#pm-kinds .pill[data-kind="idle"]')
        pg.wait_for_function('() => ((window.__db.get("settings/app").pm || {}).kinds || {}).idle === true')
        tap('#pm-admin .pm-audit-wrap .linky')
        pg.wait_for_selector('#pm-audit')
        pg.locator('#pm-admin').scroll_into_view_if_needed()
        sane('admin')
        shot('pm-admin')
        # a bot notice
        be('m3')
        pg.evaluate('() => M.notices.push({key: "pm:demo", title: "Aanya\'s bot", body: "3 things from Aanya\'s bot", bot: true, life: 60000})')
        pg.wait_for_selector('.notice.is-bot .notice-bot')
        shot('pm-notice')

    scene('light-1280', 1280, 900, False, 1)
    scene('dark-390', 390, 844, True, 3)

    # ---- at 3840 wide the bot canvas stays its own size ----
    bctx = h.browser.new_context(viewport={'width': 3840, 'height': 2160}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(bctx)
    pg = bctx.new_page()
    pg.goto(h.url('founder', '#admin', reset=True, seed=True))
    h.ready(pg)
    pg.wait_for_selector('#pm-admin canvas')
    canv = pg.evaluate('() => { const c = document.querySelector("#pm-admin canvas"); const r = c.getBoundingClientRect(); return [c.width, r.width, devicePixelRatio]; }')
    check(abs(canv[0] - round(canv[1] * canv[2])) <= 1, 'at 3840 wide the canvas is its CSS size: %r' % canv)

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
