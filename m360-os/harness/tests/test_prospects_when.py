#!/usr/bin/env python3
"""v34 test: the date reader (M.when, src/js/08-when.js), with no model call.

At a frozen Mon 5 Oct 2026 10:00 IST the D1 table reads as the spec says: "after the 16th", "talk after 16th"
and "after 16 oct" give Sat 17 Oct after Fri 16 Oct; "on the 16th" and "by the 16th" give the 16th itself;
"tuesday" is Tue 6 Oct and "next tuesday" Tue 13 Oct with the nearer day offered; "this friday", "next week"
and "agle hafte", "in two weeks", "in 10 days", "in a month", "end of month", "tomorrow", "day after tomorrow"
and "parso", "16/10", "oct 20", "after the 4th" (the 4th has passed, so November), "after monday", "on 18th"
(a Sunday, rolled to Monday with the reason), "after the 31st" (rolled from Sun 1 Nov), "after diwali" (a
question, never a guess), and "kal" reads as nothing. Then: a Saturday, the 16th itself, the 17th, a month end,
a holiday roll, times ("at 4" is 16:00, "11am" is 11:00), labels and read backs, late days, and a device in
America/New_York that still gets IST days, 10:00 IST and labels marked IST. window.__sampleCalls stays empty.

Fails until builder 1's 08-when.js is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_when.py
"""
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
MON = datetime(2026, 10, 5, 10, 0, tzinfo=IST)

# said on Mon 5 Oct 2026 at 10:00 IST: phrase, the day, the after day, the rolled-from day
TABLE = [
    ('after the 16th', '2026-10-17', '2026-10-16', ''), ('talk after 16th', '2026-10-17', '2026-10-16', ''), ('after 16 oct', '2026-10-17', '2026-10-16', ''),
    ('on the 16th', '2026-10-16', '', ''), ('by the 16th', '2026-10-16', '', ''),
    ('tuesday', '2026-10-06', '', ''), ('next tuesday', '2026-10-13', '', ''), ('this friday', '2026-10-09', '', ''),
    ('next week', '2026-10-12', '', ''), ('agle hafte', '2026-10-12', '', ''),
    ('in two weeks', '2026-10-19', '', ''), ('in 10 days', '2026-10-15', '', ''), ('in a month', '2026-11-05', '', ''),
    ('end of month', '2026-10-31', '', ''),
    ('tomorrow', '2026-10-06', '', ''), ('day after tomorrow', '2026-10-07', '', ''), ('parso', '2026-10-07', '', ''),
    ('16/10', '2026-10-16', '', ''), ('oct 20', '2026-10-20', '', ''),
    ('after the 4th', '2026-11-05', '2026-11-04', ''), ('after monday', '2026-10-13', '2026-10-12', ''),
    ('on 18th', '2026-10-19', '', '2026-10-18'), ('after the 31st', '2026-11-02', '2026-10-31', '2026-11-01'),
]


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    def ctx_at(when, tz='Asia/Kolkata'):
        c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id=tz)
        h.contexts.append(c)
        c.clock.set_fixed_time(when)
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx)')
        return p

    p = ctx_at(MON)
    if not p.evaluate('() => !!(M.when && M.when.parse && M.when.ist)'):
        raise AssertionError('M.when is not on the page: this test runs once builder 1 (08-when.js) is merged')
    now_ms = int(MON.timestamp() * 1000)
    check(p.evaluate('n => M.when.ist.ymd(n)', now_ms) == '2026-10-05' and p.evaluate('n => M.when.ist.hm(n)', now_ms) == '10:00', 'the frozen clock is Mon 5 Oct 2026 10:00 IST')
    check(p.evaluate('() => M.when.ist.dow("2026-10-05")') == 1 and p.evaluate('() => M.when.ist.add("2026-10-31", 2)') == '2026-11-02', 'ist.dow and ist.add')

    # ---- the D1 table ----
    out = p.evaluate('([n, rows]) => rows.map(r => M.when.parse(r[0], n, null))', [now_ms, TABLE])
    for (phrase, ymd, after, rolled), r in zip(TABLE, out):
        check(r and r.get('ymd') == ymd, '%r reads %s: %r' % (phrase, ymd, r))
        check((r.get('after') or '') == after, '%r after %r: %r' % (phrase, after, r))
        check((r.get('rolledFrom') or '') == rolled, '%r rolled from %r: %r' % (phrase, rolled, r))
        check(not r.get('t'), '%r carries no time: %r' % (phrase, r))
    nxt = p.evaluate('n => M.when.parse("next tuesday", n, null)', now_ms)
    check(nxt.get('next') is True and nxt.get('alt') == '2026-10-06', 'next tuesday offers the nearer Tue 6 Oct: %r' % nxt)
    by = p.evaluate('n => M.when.parse("he will revert by friday", n, null)', now_ms)
    check(by and by['ymd'] == '2026-10-09' and by.get('by') == '2026-10-09', 'by friday is Friday itself: %r' % by)
    fest = p.evaluate('n => M.when.parse("after diwali", n, null)', now_ms)
    check(fest == {'festival': 'diwali'}, 'a festival is a question: %r' % fest)
    check(p.evaluate('n => M.when.readBack(M.when.parse("after diwali", n, null))', now_ms) == 'Which day is Diwali this year?', 'the festival read back asks')
    check(p.evaluate('n => M.when.parse("kal", n, null)', now_ms) is None, 'kal reads as nothing')
    check(p.evaluate('n => M.when.parse("post the deck today", n, null)', now_ms) is not None and p.evaluate('n => M.when.parse("post the deck", n, null)', now_ms) is None, 'post is a verb unless a date follows it')

    # ---- the days around the 16th ----
    sat = int(datetime(2026, 10, 10, 11, 0, tzinfo=IST).timestamp() * 1000)
    r = p.evaluate('n => M.when.parse("tomorrow", n, null)', sat)
    check(r['ymd'] == '2026-10-12' and r['rolledFrom'] == '2026-10-11', 'on Saturday, tomorrow is a Sunday and rolls to Mon 12 Oct: %r' % r)
    check(p.evaluate('n => M.when.readBack(M.when.parse("tomorrow", n, null))', sat) == 'Mon 12 Oct, the 11th is a Sunday', 'the roll reads back with its reason')
    the16 = int(datetime(2026, 10, 16, 15, 0, tzinfo=IST).timestamp() * 1000)
    r = p.evaluate('n => M.when.parse("after the 16th", n, null)', the16)
    check(r['ymd'] == '2026-10-17' and r['after'] == '2026-10-16', 'said on the 16th, after the 16th is still Sat 17 Oct: %r' % r)
    the17 = int(datetime(2026, 10, 17, 9, 0, tzinfo=IST).timestamp() * 1000)
    r = p.evaluate('n => M.when.parse("after the 16th", n, null)', the17)
    check(r['ymd'] == '2026-11-17' and r['after'] == '2026-11-16', 'said on the 17th, the 16th has passed, so November: %r' % r)
    end = int(datetime(2026, 10, 31, 12, 0, tzinfo=IST).timestamp() * 1000)
    r = p.evaluate('n => M.when.parse("end of month", n, null)', end)
    check(r['ymd'] == '2026-10-31', 'on the 31st, end of month is today: %r' % r)
    nov = int(datetime(2026, 11, 2, 12, 0, tzinfo=IST).timestamp() * 1000)
    r = p.evaluate('n => M.when.parse("end of month", n, null)', nov)
    check(r['ymd'] == '2026-11-30', 'in November the month ends on Mon 30 Nov: %r' % r)
    # a holiday on Tue 20 Oct: a default-time date rolls past it and says so
    r = p.evaluate('n => M.when.parse("oct 20", n, s => s !== "2026-10-20" && M.when.ist.dow(s) !== 0)', now_ms)
    check(r['ymd'] == '2026-10-21' and r['rolledFrom'] == '2026-10-20', 'a holiday rolls forward: %r' % r)
    check(p.evaluate('n => M.when.readBack(M.when.parse("oct 20", n, s => s !== "2026-10-20" && M.when.ist.dow(s) !== 0))', now_ms) == 'Wed 21 Oct, the 20th is a holiday', 'the holiday read back')
    r = p.evaluate('n => M.when.parse("on the 31st", n, null)', int(datetime(2026, 11, 3, 12, 0, tzinfo=IST).timestamp() * 1000))
    check(r and r['ymd'] == '2026-12-31', 'a day missing from the month goes to the next month that has it: %r' % r)
    r = p.evaluate('n => M.when.parse("next monday", n, null)', sat)
    check(r['ymd'] == '2026-10-12', 'on Saturday, next monday is Mon 12 Oct: %r' % r)

    # ---- times, labels, read backs, late days ----
    times = p.evaluate('() => ["at 4", "11am", "at 4:30 pm", "at 9", "at 8", "3pm", "noon-ish"].map(s => M.when.time(s))')
    check(times == ['16:00', '11:00', '16:30', '09:00', '20:00', '15:00', ''], 'times: %r' % times)
    r = p.evaluate('n => M.when.parse("call on thursday at 4", n, null)', now_ms)
    check(r['ymd'] == '2026-10-08' and r['t'] == '16:00', 'a day with a time: %r' % r)
    check(p.evaluate('() => [M.when.label("2026-10-17"), M.when.label("2026-10-17", "10:00"), M.when.label("bad")]') == ['Sat 17 Oct', 'Sat 17 Oct at 10:00', ''], 'labels on an IST device')
    check(p.evaluate('() => M.when.readBack({ymd: "2026-10-19", rolledFrom: "2026-10-18"})') == 'Mon 19 Oct, the 18th is a Sunday', 'the read back with a Sunday reason')
    check(p.evaluate('() => M.when.readBack({ymd: "2026-10-17", t: "16:00"})') == 'Sat 17 Oct at 16:00', 'the read back with a time')
    check(p.evaluate('n => [M.when.lateDays("2026-10-03", n), M.when.lateDays("2026-10-05", n), M.when.lateDays("2026-10-07", n)]', now_ms) == [2, 0, -2], 'late days count IST days')
    check(p.evaluate('n => M.when.workDay("2026-10-09", 3, null)', now_ms) == '2026-10-13', 'three working days on from Fri 9 Oct skip the Sunday')
    check(p.evaluate('() => M.when.ist.at("2026-10-17", "10:00")') == int(datetime(2026, 10, 17, 10, 0, tzinfo=IST).timestamp() * 1000), 'ist.at names the IST moment')
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call for any of it')

    # ---- a device in New York: 11pm on the 5th there is the 6th in IST, and 10:00 means 10:00 IST ----
    ny = datetime(2026, 10, 5, 23, 0, tzinfo=ZoneInfo('America/New_York'))
    q = ctx_at(ny, tz='America/New_York')
    ny_ms = int(ny.timestamp() * 1000)
    check(q.evaluate('n => M.when.ist.ymd(n)', ny_ms) == '2026-10-06', 'the IST day on a New York device')
    r = q.evaluate('n => M.when.parse("tomorrow", n, null)', ny_ms)
    check(r['ymd'] == '2026-10-07', 'tomorrow counts from the IST day: %r' % r)
    check(q.evaluate('() => M.when.ist.at("2026-10-17", "10:00")') == int(datetime(2026, 10, 17, 10, 0, tzinfo=IST).timestamp() * 1000), 'the ring moment is 10:00 IST wherever the device is')
    check(q.evaluate('() => M.when.label("2026-10-17", "10:00")') == 'Sat 17 Oct at 10:00 IST', 'a time off IST is labelled IST')
    check(q.evaluate('() => M.when.label("2026-10-17")') == 'Sat 17 Oct', 'a day alone needs no zone')
    check(q.evaluate('() => window.__sampleCalls.length') == 0, 'no model call on the other device either')

    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    print('test_prospects_when: %d checks passed' % len(checks))


run(test)
