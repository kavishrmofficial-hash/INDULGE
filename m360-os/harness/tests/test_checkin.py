#!/usr/bin/env python3
"""Check-in module test: verified office check-in, outside office with a late mark, the self-reported picker
when location is unavailable, check-out, the WFH cap, special days, at 1280 and 390.

Run: M360_MODULES=11-checkin.js M360_TAG=checkin python3 harness/tests/test_checkin.py

No page renders the card yet (10-today.js is a later module), so every context here gets an init script
that registers a tiny M.pages.Today holding M.parts.CheckinCard. The browser clock is pinned to this week's
Wednesday, so the day is a working day and the times in the assertions hold whichever day the test runs.
"""
import math
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1 = 'u_founder', 'u_m1'
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'radius': 200, 'label': 'Mumbai office'}
FAR = (19.2, 72.9, 30)
SETTINGS = {'office': OFFICE, 'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00',
            'wfhCap': 2, 'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
            'rules': {'R%02d' % i: True for i in range(1, 17)}, 'points': {},
            'leaderboardIncludesFounder': False, 'updated': 0}
CONSENT = 'Checking in records the time and your location at that moment. Kaavish can see both.'

# registers a test page around the card before the app boots
TODAY_PAGE = '''(function () {
  Object.defineProperty(window, 'M', {configurable: true, enumerable: true,
    get: function () { return undefined; },
    set: function (v) {
      Object.defineProperty(window, 'M', {configurable: true, enumerable: true, writable: true, value: v});
      v.pages.Today = function TestToday() { return v.React.createElement(v.parts.CheckinCard); };
    }});
})();'''


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def ymd(d):
    return d.strftime('%Y-%m-%d')


def at(day, hh, mm):
    return datetime(day.year, day.month, day.day, hh, mm, tzinfo=IST)


def haversine(a, b):
    R = 6371000.0
    r = math.radians
    d_lat, d_lng = r(b[0] - a[0]), r(b[1] - a[1])
    h = math.sin(d_lat / 2) ** 2 + math.cos(r(a[0])) * math.cos(r(b[0])) * math.sin(d_lng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def new_ctx(h, fixed, geo=None):
    """A browser context with the test page installed, the clock pinned and optional geolocation."""
    opts = {'viewport': {'width': 1280, 'height': 900}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata'}
    if geo:
        opts['geolocation'] = {'latitude': geo[0], 'longitude': geo[1], 'accuracy': geo[2]}
        opts['permissions'] = ['geolocation']
    ctx = h.browser.new_context(**opts)
    h.contexts.append(ctx)
    ctx.add_init_script(TODAY_PAGE)
    ctx.clock.set_fixed_time(fixed)
    return ctx


def open_page(h, ctx, ident, width, reset=False):
    page = ctx.new_page()
    page.set_viewport_size({'width': width, 'height': 900})
    page.set_default_timeout(8000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, '#today', reset=reset))
    h.ready(page)
    return page


def seed_team(h, page):
    h.seed_doc(page, 'settings/app', SETTINGS)
    h.roster(page, (M1,))
    page.wait_for_function('() => M.lastCtx && M.lastCtx.settings.office && M.lastCtx.settings.office.label === "Mumbai office"'
                           ' && M.lastCtx.members["u_m1"]')
    page.wait_for_selector('#checkin-card')
    page.wait_for_timeout(150)


def card(page):
    return page.inner_text('#checkin-card')


def btn(page, name):
    return page.get_by_role('button', name=name, exact=True)


def test(h):
    real_now = datetime.now(IST)
    mon = (real_now - timedelta(days=real_now.weekday())).date()
    tue, wed, sun = mon + timedelta(days=1), mon + timedelta(days=2), mon + timedelta(days=6)
    today = ymd(wed)
    t_in, t_late, t_out = at(wed, 10, 12), at(wed, 11, 0), at(wed, 19, 40)
    opened = []

    # ---- founder at the office, 1280: verified check-in, then check-out ----
    ctx_a = new_ctx(h, t_in, geo=(OFFICE['lat'], OFFICE['lng'], 30))
    pf = open_page(h, ctx_a, 'founder', 1280, reset=True)
    opened.append(('founder 1280', pf))
    seed_team(h, pf)
    check(pf.evaluate('new Date().getDay()') == 3 and pf.evaluate('new Date().getHours()') == 10, 'clock is not Wednesday 10:12')
    check(pf.evaluate('typeof M.att.dayStatus + typeof M.att.isLate + typeof M.att.wfhUsed') == 'functionfunctionfunction',
          'M.att exports missing')
    text = card(pf)
    check('WFH days used this week: 0 of 2' in text, 'wfh line missing: ' + text)
    check(CONSENT in text, 'consent line missing: ' + text)
    check(btn(pf, 'Check in, office').is_enabled() and btn(pf, 'Check in, WFH').is_enabled(), 'both buttons start enabled')
    check(h.ctx(pf, 'M.att.dayStatus(ctx, "u_founder", "%s").status' % today) == 'none', 'status before check-in')
    h.shot(pf, 'checkin-founder-before-1280')

    btn(pf, 'Check in, office').click()
    pf.wait_for_selector('.toast:has-text("Checked in")')
    pf.wait_for_selector('#checkin-card:has-text("Verified at Mumbai office")')
    text = card(pf)
    check('Checked in at 10:12, office. Verified at Mumbai office.' in text, 'checked in line: ' + text)
    check(CONSENT in text, 'consent line must stay after check-in')
    check(pf.locator('#checkin-card .pill.flame').count() == 0, 'no late mark at 10:12')
    doc = pf.evaluate('window.__db.get("checkin/u_founder")')
    e = doc['days'][today]
    check(e['mode'] == 'office' and e['out'] is None and e['outLoc'] is None and e['in'], 'entry shape %r' % e)
    check(e['loc']['verified'] is True and e['loc']['src'] == 'gps', 'loc %r' % e['loc'])
    check(e['loc']['place'] == 'Mumbai office' and e['loc']['dist'] == 0 and e['loc']['acc'] == 30, 'loc detail %r' % e['loc'])
    check(abs(e['loc']['lat'] - OFFICE['lat']) < 1e-4 and abs(e['loc']['lng'] - OFFICE['lng']) < 1e-4, 'loc coords %r' % e['loc'])
    ds = h.ctx(pf, 'M.att.dayStatus(ctx, "u_founder", "%s")' % today)
    check(ds['status'] == 'office' and ds['verified'] is True and ds['late'] is False and ds['hours'] is None
          and ds['place'] == 'Mumbai office' and ds['in'] == e['in'], 'dayStatus after check-in %r' % ds)
    check(h.ctx(pf, 'M.att.isLate(ctx, "u_founder", %d)' % e['in']) is False, 'isLate at 10:12')
    check(h.ctx(pf, 'M.att.isLate(ctx, "u_founder", %d)' % int(at(wed, 10, 46).timestamp() * 1000)) is True, 'isLate at 10:46')
    check(h.ctx(pf, 'M.att.isLate(ctx, "u_founder", %d)' % int(at(wed, 10, 45).timestamp() * 1000)) is False, 'isLate at 10:45')

    ctx_a.clock.set_fixed_time(t_out)
    check(pf.evaluate('new Date().getHours()') == 19, 'clock did not move to 19:40')
    btn(pf, 'Check out').click()
    pf.wait_for_selector('.toast:has-text("Checked out")')
    pf.wait_for_selector('#checkin-card:has-text("In 10:12, out 19:40, 9h 28m.")')
    text = card(pf)
    check('Office. Verified at Mumbai office.' in text, 'place line after check-out: ' + text)
    check(pf.locator('#checkin-card button').count() == 0, 'no buttons after check-out')
    e = pf.evaluate('window.__db.get("checkin/u_founder")')['days'][today]
    check(e['out'] and e['outLoc'] and e['outLoc']['verified'] is True and e['outLoc']['src'] == 'gps', 'check-out entry %r' % e)
    ds = h.ctx(pf, 'M.att.dayStatus(ctx, "u_founder", "%s")' % today)
    check(ds['hours'] == (9 * 60 + 28) * 60000 and ds['out'] == e['out'], 'dayStatus hours %r' % ds)
    h.shot(pf, 'checkin-founder-out-1280')

    # ---- m1 far from the office, late: outside office and a late mark ----
    ctx_a.set_geolocation({'latitude': FAR[0], 'longitude': FAR[1], 'accuracy': FAR[2]})
    ctx_a.clock.set_fixed_time(t_late)
    pm = open_page(h, ctx_a, 'm1', 1280)
    opened.append(('m1 1280', pm))
    pm.wait_for_selector('#checkin-card button:has-text("Check in, office")')
    btn(pm, 'Check in, office').click()
    pm.wait_for_selector('.toast:has-text("Checked in")')
    pm.wait_for_selector('#checkin-card:has-text("Outside office")')
    text = card(pm)
    check('Checked in at 11:00, office. Outside office, ' in text and 'km away.' in text, 'outside line: ' + text)
    check(pm.locator('#checkin-card .pill.flame:has-text("late")').count() == 1, 'late mark at 11:00')
    e = pm.evaluate('window.__db.get("checkin/u_m1")')['days'][today]
    check(e['loc']['verified'] is False and e['loc']['src'] == 'gps', 'far loc %r' % e['loc'])
    want = haversine((FAR[0], FAR[1]), (OFFICE['lat'], OFFICE['lng']))
    check(abs(e['loc']['dist'] - want) <= 1, 'dist %r, expected about %d' % (e['loc']['dist'], want))
    check(e['loc']['place'] == 'Outside office, %.1f km away' % (want / 1000), 'place %r' % e['loc']['place'])
    ds = h.ctx(pm, 'M.att.dayStatus(ctx, "u_m1", "%s")' % today)
    check(ds['status'] == 'office' and ds['late'] is True and ds['verified'] is False, 'm1 dayStatus %r' % ds)
    h.shot(pm, 'checkin-m1-late-1280')

    # phone width on the same store: checked-in state for m1, checked-out state for the founder
    pm390 = open_page(h, ctx_a, 'm1', 390)
    opened.append(('m1 390', pm390))
    pm390.wait_for_selector('#checkin-card:has-text("Outside office")')
    pf390 = open_page(h, ctx_a, 'founder', 390)
    opened.append(('founder 390', pf390))
    pf390.wait_for_selector('#checkin-card:has-text("9h 28m")')
    h.shot(pm390, 'checkin-m1-390')
    h.shot(pf390, 'checkin-founder-390')

    # ---- m1 without geolocation on a fresh day: the picker, then check-out without a location ----
    ctx_c = new_ctx(h, t_in)
    pc = open_page(h, ctx_c, 'm1', 390, reset=True)
    opened.append(('m1 nogeo 390', pc))
    seed_team(h, pc)
    h.seed_doc(pc, 'checkin/' + M1, {'days': {}})
    pc.wait_for_selector('#checkin-card button:has-text("Check in, WFH")')
    btn(pc, 'Check in, WFH').click()
    pc.wait_for_selector('#checkin-picker:has-text("Where are you checking in from?")', timeout=15000)
    for name in ('Office', 'Client site', 'Home', 'Travelling'):
        check(btn(pc, name).count() == 1, 'picker button missing: ' + name)
    check(pc.locator('#checkin-card button:has-text("Check in, office")').count() == 0, 'picker replaces the check-in buttons')
    check(CONSENT in card(pc), 'consent line stays under the picker')
    h.shot(pc, 'checkin-picker-390')
    btn(pc, 'Home').click()
    pc.wait_for_selector('.toast:has-text("Checked in")')
    pc.wait_for_selector('#checkin-card:has-text("Checked in at 10:12, WFH. Home, self reported.")')
    e = pc.evaluate('window.__db.get("checkin/u_m1")')['days'][today]
    check(e['mode'] == 'wfh' and e['loc']['src'] == 'self' and e['loc']['place'] == 'Home', 'self loc %r' % e)
    check(e['loc']['verified'] is False and e['loc']['lat'] is None and e['loc']['lng'] is None
          and e['loc']['acc'] is None and e['loc']['dist'] is None, 'self loc nulls %r' % e['loc'])
    check(pc.locator('#checkin-card .pill.flame').count() == 0, 'no late mark at 10:12')
    ds = h.ctx(pc, 'M.att.dayStatus(ctx, "u_m1", "%s")' % today)
    check(ds['status'] == 'wfh' and ds['verified'] is False and ds['place'] == 'Home', 'wfh dayStatus %r' % ds)
    check(h.ctx(pc, 'M.att.wfhUsed(ctx, "u_m1", new Date())') == 1, 'wfhUsed after a wfh check-in')

    ctx_c.clock.set_fixed_time(t_out)
    btn(pc, 'Check out').click()
    pc.wait_for_selector('.toast:has-text("Checked out")', timeout=15000)
    pc.wait_for_selector('#checkin-card:has-text("In 10:12, out 19:40, 9h 28m.")')
    check('WFH. Home, self reported.' in card(pc), 'place line after wfh check-out: ' + card(pc))
    e = pc.evaluate('window.__db.get("checkin/u_m1")')['days'][today]
    check(e['out'] and e['outLoc'] is None, 'check-out without location %r' % e)

    # ---- WFH cap: two wfh days earlier this week disable the WFH button ----
    ctx_c.clock.set_fixed_time(t_in)
    stamp = lambda d, hh: int(at(d, hh, 0).timestamp() * 1000)  # noqa: E731
    h.seed_doc(pc, 'checkin/' + M1, {'days': {
        ymd(mon): {'in': stamp(mon, 10), 'out': stamp(mon, 19), 'mode': 'wfh', 'loc': None, 'outLoc': None},
        ymd(tue): {'in': stamp(tue, 10), 'out': None, 'mode': 'wfh', 'loc': None, 'outLoc': None}}})
    pc.wait_for_selector('#checkin-card:has-text("WFH days used this week: 2 of 2")')
    check(btn(pc, 'Check in, WFH').is_disabled(), 'WFH button must be disabled at the cap')
    check(btn(pc, 'Check in, office').is_enabled(), 'office button stays enabled at the cap')
    check(h.ctx(pc, 'M.att.wfhUsed(ctx, "u_m1", new Date())') == 2, 'wfhUsed counts two')
    check(h.ctx(pc, 'M.att.wfhUsed(ctx, "u_m1", new Date(%d))' % stamp(mon - timedelta(days=7), 12)) == 0, 'wfhUsed last week')
    ds = h.ctx(pc, 'M.att.dayStatus(ctx, "u_m1", "%s")' % ymd(mon))
    check(ds['status'] == 'wfh' and ds['hours'] == 9 * 3600000 and ds['loc'] is None and ds['place'] == '', 'seeded day %r' % ds)
    h.shot(pc, 'checkin-cap-390')

    # ---- special days: holiday, approved leave, Sunday ----
    h.seed_doc(pc, 'settings/app', dict(SETTINGS, holidays=[today], updated=1))
    pc.wait_for_selector('#checkin-card:has-text("Today is a holiday.")')
    check(pc.locator('#checkin-card button').count() == 0, 'holiday replaces the buttons')
    check(h.ctx(pc, 'M.att.dayStatus(ctx, "u_m1", "%s").status' % today) == 'holiday', 'holiday status')
    h.seed_doc(pc, 'leave/' + M1, {'reqs': [{'id': 'l1', 'from': today, 'to': today, 'type': 'casual', 'at': stamp(mon, 9)}]})
    h.seed_doc(pc, 'leavedec/' + M1, {'d': {'l1': {'status': 'approved', 'at': stamp(mon, 10)}}})
    pc.wait_for_selector('#checkin-card:has-text("You\'re on approved leave today.")')
    check(h.ctx(pc, 'M.att.dayStatus(ctx, "u_m1", "%s").status' % today) == 'leave', 'leave wins over holiday')
    check(h.ctx(pc, 'M.att.dayStatus(ctx, "u_m1", "%s").status' % ymd(sun)) == 'sunday', 'sunday status')
    ctx_c.clock.set_fixed_time(at(sun, 10, 12))
    h.seed_doc(pc, 'settings/app', dict(SETTINGS, updated=2))  # any snapshot re-renders the card on the new day
    pc.wait_for_selector('#checkin-card:has-text("Sunday. The OS rests too.")')
    check(pc.locator('#checkin-card button').count() == 0, 'Sunday replaces the buttons')

    # ---- layout and console on every page opened ----
    for label, page in opened:
        ov = h.overflow(page)
        check(ov == 0, '%s: horizontal overflow %dpx' % (label, ov))
        st = h.small_text(page)
        check(not st, '%s: text under 11px %r' % (label, st[:3]))
    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    return True


if __name__ == '__main__':
    try:
        ok = run(test)
    except AssertionError as e:
        print('FAIL:', e)
        sys.exit(1)
    if not ok:
        print('FAIL')
        sys.exit(1)
    print('PASS')
