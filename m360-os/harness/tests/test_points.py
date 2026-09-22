#!/usr/bin/env python3
"""Points module test: pointsFor, scoreFor, ladder and leaderboard against seeded documents.

Run: M360_MODULES=06-points.js M360_TAG=points python3 harness/tests/test_points.py

The browser clock is fixed at Thursday 15:00 IST of the current week, so "this week" has four working
days up to today (Monday to Thursday) and the arithmetic below holds on any day the test runs.
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
M1, M2, F = 'u_m1', 'u_m2', 'u_founder'

POINTS = {'checkinOnTime': 2, 'eod': 2, 'planOnTime': 4, 'planLate': 1, 'outcomeHit': 12, 'outcomeMiss': -6,
          'taskOnTime': 6, 'taskLate': 2, 'revision': -2, 'shown20': 2, 'qualityMult': 4, 'kudos': 3,
          'rockDone': 20, 'overdueOpen': -2}
SETTINGS = {'office': None, 'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00',
            'wfhCap': 2, 'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
            'rules': {'R%02d' % i: True for i in range(1, 17)}, 'points': POINTS,
            'leaderboardIncludesFounder': False, 'updated': 0}


def ymd(d):
    return d.strftime('%Y-%m-%d')


def week_id(d):
    iso = d.isocalendar()
    return '%d-W%02d' % (iso[0], iso[1])


def ms(day, hh, mm=0):
    """epoch ms of hh:mm IST on the given date"""
    return int(datetime(day.year, day.month, day.day, hh, mm, tzinfo=IST).timestamp() * 1000)


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def test(h):
    real_now = datetime.now(IST)
    mon = (real_now - timedelta(days=real_now.weekday())).date()
    tue, wed, thu, sat = mon + timedelta(days=1), mon + timedelta(days=2), mon + timedelta(days=3), mon + timedelta(days=5)
    fixed = datetime(thu.year, thu.month, thu.day, 15, 0, tzinfo=IST)
    wk = week_id(mon)
    last_mon = mon - timedelta(days=7)
    old_mon = mon - timedelta(days=42)
    q_start = datetime(mon.year, 3 * ((mon.month - 1) // 3) + 1, 1).date()
    q_end_month = q_start.month + 3
    q_end = (datetime(q_start.year + (1 if q_end_month > 12 else 0), (q_end_month - 1) % 12 + 1, 1) - timedelta(days=1)).date()
    q_id = '%d-Q%d' % (mon.year, (mon.month - 1) // 3 + 1)
    week_from, week_to = ymd(mon), ymd(sat)

    page = h.open('founder', width=1280, hash='#scores', reset=True, seed=True)
    page.context.clock.set_fixed_time(fixed)
    page.reload()
    h.ready(page)
    check(page.evaluate('new Date().getDay()') == 4, 'browser clock is not on Thursday')
    check(page.evaluate('new Date().getHours()') == 15, 'browser clock is not at 15:00')
    check(page.evaluate('typeof M.points.pointsFor') == 'function', 'M.points.pointsFor missing')

    h.seed_doc(page, 'settings/app', SETTINGS)
    h.roster(page, (M1, M2))

    # check-ins: start 10:30 plus grace 15 makes 10:45 the cut
    h.seed_doc(page, 'checkin/' + M1, {'days': {
        ymd(mon): {'in': ms(mon, 10, 20), 'out': ms(mon, 19, 30), 'mode': 'office', 'loc': None, 'outLoc': None},
        ymd(tue): {'in': ms(tue, 11, 30), 'out': None, 'mode': 'wfh', 'loc': None, 'outLoc': None},
        ymd(wed): {'in': ms(wed, 10, 45), 'out': None, 'mode': 'office', 'loc': None, 'outLoc': None},
        ymd(thu): {'in': ms(thu, 10, 46), 'out': None, 'mode': 'office', 'loc': None, 'outLoc': None}}})
    h.seed_doc(page, 'checkin/' + M2, {'days': {
        ymd(mon): {'in': ms(mon, 12, 0), 'out': None, 'mode': 'office', 'loc': None, 'outLoc': None},
        ymd(tue): {'in': ms(tue, 10, 30), 'out': None, 'mode': 'office', 'loc': None, 'outLoc': None}}})

    # EOD lines: counted when posted before 10:00 the next day; Saturday lies beyond today
    h.seed_doc(page, 'eod/' + M1, {'days': {
        ymd(mon): {'shipped': 'Reel 1', 'next': '', 'blocked': '', 'at': ms(mon, 19, 0)},
        ymd(tue): {'shipped': 'Reel 2', 'next': '', 'blocked': '', 'at': ms(wed, 9, 59)},
        ymd(wed): {'shipped': 'Reel 3', 'next': '', 'blocked': '', 'at': ms(thu, 10, 0)},
        ymd(thu): {'shipped': 'Reel 4', 'next': '', 'blocked': '', 'at': ms(thu, 14, 30)},
        ymd(sat): {'shipped': 'Reel 5', 'next': '', 'blocked': '', 'at': ms(sat, 19, 0)}}})
    h.seed_doc(page, 'eod/' + M2, {'days': {
        ymd(mon): {'shipped': 'Deck', 'next': '', 'blocked': '', 'at': ms(tue, 11, 0)},
        ymd(tue): {'shipped': 'Deck v2', 'next': '', 'blocked': '', 'at': ms(tue, 19, 30)}}})

    # plans: m1 on Monday 09:00 (on time), m2 on Wednesday (late)
    h.seed_doc(page, 'plan/' + M1, {'weeks': {wk: {'items': [
        {'id': 'p1', 'text': 'Scripts signed off'}, {'id': 'p2', 'text': 'Shoot day 1 wrapped'},
        {'id': 'p3', 'text': 'Edit plan shared'}], 'at': ms(mon, 9, 0)}}})
    h.seed_doc(page, 'plan/' + M2, {'weeks': {wk: {'items': [
        {'id': 'a', 'text': 'Deck out'}, {'id': 'b', 'text': 'Moodboard done'}], 'at': ms(wed, 9, 0)}}})

    # reviews: m1 two hits and a miss, quality 4; m2 two misses this week plus an old miss outside 30 days
    h.seed_doc(page, 'review/' + M1, {'weeks': {
        wk: {'marks': {'p1': 'hit', 'p2': 'miss', 'p3': 'hit'}, 'quality': 4, 'note': '', 'at': ms(thu, 14, 0)}}})
    h.seed_doc(page, 'review/' + M2, {'weeks': {
        wk: {'marks': {'a': 'miss', 'b': 'miss'}, 'quality': 3, 'note': '', 'at': ms(thu, 14, 0)},
        week_id(old_mon): {'marks': {'z': 'miss'}, 'quality': 2, 'note': '', 'at': ms(old_mon, 17, 0)}}})

    def task(tid, owner, due, status, done_at=None, revisions=0, shown20=False, updated=None):
        h.seed_doc(page, 'tasks/' + tid, {
            'title': 'Task ' + tid, 'owner': owner, 'client': '', 'project': '', 'section': '', 'due': due,
            'status': status, 'priority': 'normal', 'link': '', 'revisions': revisions, 'shown20': shown20,
            'subtasks': {}, 'comments': {}, 'by': owner, 'created': ms(last_mon, 10, 0),
            'updated': updated or done_at or ms(mon, 10, 0), 'doneAt': done_at})

    task('t1', M1, ymd(tue), 'done', done_at=ms(tue, 16, 0), shown20=True)                 # on time, shown
    task('t2', M1, ymd(mon), 'done', done_at=ms(wed, 11, 0), revisions=1)                  # late, one revision
    task('t3', M1, ymd(mon), 'doing')                                                      # open, overdue
    task('t4', M1, ymd(sat), 'todo')                                                       # open, due after today
    task('t5', M1, '', 'done', done_at=ms(thu, 12, 0), shown20=True)                       # no due: on time, shown
    task('t6', M1, ymd(wed), 'review', shown20=True, updated=ms(wed, 15, 0))               # in review, shown, overdue
    task('t7', M2, ymd(thu), 'done', done_at=ms(thu, 10, 0))                               # m2 on time
    task('t8', M1, ymd(last_mon + timedelta(days=2)), 'done', done_at=ms(last_mon + timedelta(days=2), 12, 0))  # last week

    # kudos: 7 to m1 this week (cap 5), 1 to m1 last week, 1 to m2 this week
    given_f = [{'id': 'k%d' % i, 'to': M1, 'why': 'Great reel', 'at': ms(mon + timedelta(days=i % 4), 12, i)} for i in range(4)]
    given_f.append({'id': 'kold', 'to': M1, 'why': 'Old', 'at': ms(last_mon, 12, 0)})
    h.seed_doc(page, 'kudos/' + F, {'given': given_f})
    given_m2 = [{'id': 'm%d' % i, 'to': M1, 'why': 'Thanks', 'at': ms(thu, 9, i)} for i in range(3)]
    h.seed_doc(page, 'kudos/' + M2, {'given': given_m2})
    h.seed_doc(page, 'kudos/' + M1, {'given': [{'id': 'x1', 'to': M2, 'why': 'Deck', 'at': ms(tue, 12, 0)}]})

    # rocks: one done rock for m1 this quarter (counts only over a whole quarter)
    h.seed_doc(page, 'rocks/' + M1, {'q': {q_id: [
        {'id': 'r1', 'text': 'Pod 1 runs without me', 'state': 'done'},
        {'id': 'r2', 'text': 'Two retainers signed', 'state': 'on'}]}})

    page.wait_for_function('''() => {
      const c = M.lastCtx; if (!c) return false;
      const has = (n, id) => !!(c.coll[n] && c.coll[n].map[id]);
      return c.settings.points.kudos === 3 && c.members['u_m2'] && has('checkin', 'u_m2') && has('eod', 'u_m2')
        && has('plan', 'u_m2') && has('review', 'u_m2') && has('tasks', 't8') && has('kudos', 'u_m1')
        && has('rocks', 'u_m1') && c.coll.kudos.map['u_founder'].given.length === 5;
    }''')

    # ---- pointsFor, m1, this week ----
    p1 = h.ctx(page, 'M.points.pointsFor(ctx, "u_m1", "%s", "%s")' % (week_from, week_to))
    expect_counts = {'checkinOnTime': 2, 'eod': 3, 'planOnTime': 1, 'planLate': 0, 'outcomeHit': 2, 'outcomeMiss': 1,
                     'taskOnTime': 2, 'taskLate': 1, 'revision': 1, 'shown20': 3, 'qualityMult': 4, 'kudos': 5,
                     'rockDone': 0, 'overdueOpen': 2}
    for k, n in expect_counts.items():
        check(p1['counts'][k] == n, 'm1 counts.%s = %r, expected %d' % (k, p1['counts'].get(k), n))
        check(p1['parts'][k] == POINTS[k] * n, 'm1 parts.%s = %r, expected %d' % (k, p1['parts'].get(k), POINTS[k] * n))
    discipline = 2 * 2 + 3 * 2 + 1 * 4 + 0 * 1                                    # 14
    output = 2 * 12 + 1 * -6 + 2 * 6 + 1 * 2 + 1 * -2 + 3 * 2 + 4 * 4 + 5 * 3 + 0 * 20 + 2 * -2   # 63
    check(p1['discipline'] == discipline, 'm1 discipline %r, expected %d' % (p1['discipline'], discipline))
    check(p1['output'] == output, 'm1 output %r, expected %d' % (p1['output'], output))
    check(p1['total'] == output + discipline == 77, 'm1 total %r, expected 77' % p1['total'])
    check(p1['badges'] == ['Every EOD'], 'm1 badges %r, expected [Every EOD]' % p1['badges'])

    # ---- pointsFor, m2, this week ----
    p2 = h.ctx(page, 'M.points.pointsFor(ctx, "u_m2", "%s", "%s")' % (week_from, week_to))
    check(p2['counts']['checkinOnTime'] == 1 and p2['counts']['eod'] == 1 and p2['counts']['planLate'] == 1
          and p2['counts']['planOnTime'] == 0, 'm2 discipline counts %r' % p2['counts'])
    check(p2['counts']['outcomeMiss'] == 2 and p2['counts']['outcomeHit'] == 0 and p2['counts']['qualityMult'] == 3
          and p2['counts']['taskOnTime'] == 1 and p2['counts']['kudos'] == 1, 'm2 output counts %r' % p2['counts'])
    check(p2['discipline'] == 2 + 2 + 1 == 5, 'm2 discipline %r' % p2['discipline'])
    check(p2['output'] == 2 * -6 + 3 * 4 + 6 + 3 == 9, 'm2 output %r, expected 9' % p2['output'])
    check(p2['total'] == 14, 'm2 total %r, expected 14' % p2['total'])
    check(p2['badges'] == ['On time'], 'm2 badges %r, expected [On time]' % p2['badges'])

    # ---- rocks count over the whole quarter only, and an empty or reversed range yields zero ----
    pq = h.ctx(page, 'M.points.pointsFor(ctx, "u_m1", "%s", "%s")' % (ymd(q_start), ymd(q_end)))
    check(pq['counts']['rockDone'] == 1 and pq['parts']['rockDone'] == 20, 'quarter rockDone %r' % pq['counts'])
    q_kudos = 5 + (1 if ymd(last_mon) >= ymd(q_start) else 0)
    check(pq['counts']['kudos'] == q_kudos, 'quarter kudos %r, expected %d' % (pq['counts']['kudos'], q_kudos))
    p0 = h.ctx(page, 'M.points.pointsFor(ctx, "u_m1", "%s", "%s")' % (week_to, week_from))
    check(p0['total'] == 0 and p0['badges'] == [], 'reversed range should score zero')
    pn = h.ctx(page, 'M.points.pointsFor(ctx, "u_m3", "%s", "%s")' % (week_from, week_to))
    check(pn['total'] == 0 and pn['counts']['eod'] == 0, 'unknown person should score zero')

    # ---- scoreFor, m1, this week ----
    s1 = h.ctx(page, 'M.points.scoreFor(ctx, "u_m1", new Date(%d))' % ms(mon, 0, 0))
    check(s1['due'] == 5, 'scoreFor due %r, expected 5' % s1['due'])
    check(s1['onTimePct'] == 20, 'scoreFor onTimePct %r, expected 20' % s1['onTimePct'])
    check(s1['revPerTask'] == 0.33, 'scoreFor revPerTask %r, expected 0.33' % s1['revPerTask'])
    check(s1['quality'] == 4 and s1['hit'] == 2 and s1['planned'] == 3, 'scoreFor %r' % s1)
    s_old = h.ctx(page, 'M.points.scoreFor(ctx, "u_m1", new Date(%d))' % ms(old_mon, 0, 0))
    check(s_old['due'] == 0 and s_old['onTimePct'] is None and s_old['revPerTask'] is None
          and s_old['quality'] is None and s_old['planned'] == 0, 'empty week scoreFor %r' % s_old)

    # ---- ladder ----
    l1 = h.ctx(page, 'M.points.ladder(ctx, "u_m1", new Date())')
    l2 = h.ctx(page, 'M.points.ladder(ctx, "u_m2", new Date())')
    lf = h.ctx(page, 'M.points.ladder(ctx, "u_founder", new Date())')
    check(l1 == {'misses': 1, 'level': 'note'}, 'm1 ladder %r' % l1)
    check(l2 == {'misses': 2, 'level': 'warning'}, 'm2 ladder %r, expected warning from 2 misses' % l2)
    check(lf == {'misses': 0, 'level': 'clear'}, 'founder ladder %r' % lf)

    # ---- leaderboard ----
    lb = h.ctx(page, 'M.points.leaderboard(ctx, "week", new Date())')
    check([r['uid'] for r in lb] == [M1, M2], 'leaderboard order %r, expected m1 then m2 without the founder' % [r['uid'] for r in lb])
    check(lb[0]['total'] == 77 and lb[1]['total'] == 14, 'leaderboard totals %r' % [(r['uid'], r['total']) for r in lb])
    check(lb[0]['badges'] == ['Every EOD'] and 'parts' in lb[0] and lb[0]['output'] == 63, 'leaderboard row %r' % lb[0])

    h.seed_doc(page, 'settings/app', dict(SETTINGS, leaderboardIncludesFounder=True, updated=1))
    page.wait_for_function('() => M.lastCtx && M.lastCtx.settings.leaderboardIncludesFounder === true')
    lb2 = h.ctx(page, 'M.points.leaderboard(ctx, "week", new Date())')
    check([r['uid'] for r in lb2] == [M1, M2, F], 'leaderboard with founder %r' % [r['uid'] for r in lb2])

    # ---- the pages this test opened stay clean ----
    check(h.overflow(page) == 0, 'horizontal overflow on the founder page: %d' % h.overflow(page))
    # a new browser context starts with its own empty store, so the member page is seeded again
    page2 = h.open('m1', width=390, hash='#today', seed=True)
    h.roster(page2, (M1, M2))
    h.seed_doc(page2, 'review/' + M1, {'weeks': {
        wk: {'marks': {'p1': 'hit', 'p2': 'miss', 'p3': 'hit'}, 'quality': 4, 'note': '', 'at': ms(thu, 14, 0)}}})
    page2.wait_for_function('() => M.lastCtx && M.lastCtx.coll.review.map["u_m1"] && M.lastCtx.members["u_m1"]')
    page2.wait_for_timeout(200)
    check(h.overflow(page2) == 0, 'horizontal overflow on the member page at 390: %d' % h.overflow(page2))
    check(h.ctx(page2, 'M.points.ladder(ctx, "u_m1", new Date()).level') == 'note', 'member context ladder')
    check(h.ctx(page2, 'M.points.scoreFor(ctx, "u_m1", new Date(%d)).hit' % ms(mon, 0, 0)) == 2, 'member context scoreFor')
    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    return True


if __name__ == '__main__':
    try:
        run(test)
    except AssertionError as e:
        print('FAIL:', e)
        sys.exit(1)
    print('PASS')
