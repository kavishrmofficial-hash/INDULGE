#!/usr/bin/env python3
"""v33 test: the COO planner's pure functions on the page (M.coo.plan, src/js/10-coo.js).

Every case is a plain state from harness/tests/coo_world.py, handed to the planner as JSON, so nothing
on the page (the clock, the store, the roster) leaks in. Checks:
- slotsDue: at 09:20 the open slot and only the latest watch slot run; at 12:30 the open slot and r10 are
  past their lateMax and listed as skipped 'late' while brief, the roll call, r11 and r12 run, with one
  watch slot; a claimed slot never runs twice; a Sunday and a holiday run only open and close; the memo
  runs on a Saturday only;
- leaveCheck: the plain request passes; days, balance, probation, notice, people out, pod out, blackout,
  a client date, the manager away and a changed request each fail alone; a null perType fails closed and
  names what is missing; a pending request asked earlier counts, one asked later does not; sick leave with
  probationLop passes the probation check; a swap or a WFH day is never leave (a swap before the v33 date
  still is);
- balance: per leave year from yearStart, by type, never counting WFH;
- clientDated: dueKind client, the client field, a client project, the project's own due; dueKind
  internal wins; a plain internal task is not;
- load: priority weight, +2 overdue, +1 due within 3 working days, review on the reviewer, done not at all,
  and the cap scaled to the working days left net of leave;
- shortlist: project people under the median, least loaded first; never someone on leave in the next 3
  working days, on a hold, over the median, the owner or the founder;
- planCover: internal work moves (owner, or the date after return), client-dated work is proposed, review
  and done work is never touched, and the per-person and per-day caps hold;
- planRebalance: only someone over the line on both snapshots gives work away, only movable internal todo
  work moves (never client, review, done or doing touched today), lowest priority first, inside the caps; an
  overdue task arrives with the receiver's next working day;
- actKey is stable and changes with the period; lint refuses dashes, '!', 'rather than', 'instead of' and
  'not X, but', and passes a plain line.

Fails until builder 1's M.coo is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_coo_plan.py
"""
import copy
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness.lib import run  # noqa: E402
import coo_world as W  # noqa: E402
from coo_world import F, M1, M2, M3, M4, M5, M6, ymd, ms  # noqa: E402


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    page = h.open('founder', hash='#home', reset=True, seed=True, noai=True)
    has = page.evaluate('() => !!(window.M && M.coo && M.coo.plan && M.SETTINGS_DEFAULTS && M.SETTINGS_DEFAULTS.coo)')
    if not has:
        raise AssertionError('M.coo.plan is not on the page: this test runs once builder 1 (10-coo.js) is merged')
    D = page.evaluate('() => JSON.parse(JSON.stringify(M.SETTINGS_DEFAULTS.coo))')
    since = page.evaluate('() => M.COO_SINCE || M.coo.SINCE || "2026-10-05"')

    def P(fn, *args):
        return page.evaluate('([f, a]) => M.coo.plan[f](...a)', [fn, list(args)])

    def failed(r):
        return sorted(c['k'] for c in r['checks'] if not c['ok'])

    # ---------- slotsDue ----------
    slots = {'holidays': [], 'rollAt': ['10:45'], 'eodCut': '19:30', 'memoDay': 'sat'}
    a = P('slotsDue', slots, ms(9, 20), {})
    ids = [x['id'] for x in a['run']]
    check(ids == ['open', 'w0915'], 'at 09:20 the open slot and the latest watch slot run: %r' % ids)
    check(a['work'] and a['next'] and a['next']['at'] > ms(9, 20), 'a working day, with the next slot ahead: %r' % a['next'])
    b = P('slotsDue', slots, ms(12, 30), {})
    run_ = [x['id'] for x in b['run']]
    skip = {x['id']: x.get('why') for x in b['skip']}
    check(skip.get('open') == 'late' and skip.get('r10') == 'late', 'past lateMax open and r10 are skipped late: %r' % skip)
    check(all(x in run_ for x in ('brief', 'roll1045', 'r11', 'r12')), 'brief, the roll call, r11 and r12 still run at 12:30: %r' % run_)
    check([x for x in run_ if x.startswith('w')] == ['w1230'], 'only the latest watch slot: %r' % run_)
    c = P('slotsDue', slots, ms(12, 30), {'brief': 1, 'r11': 1, 'w1230': 1})
    check(not any(x['id'] in ('brief', 'r11', 'w1230') for x in c['run']), 'a claimed slot never runs again: %r' % c['run'])
    sun = W.TUE + timedelta(days=5)
    s1 = P('slotsDue', slots, ms(10, 0, base=sun), {})
    check([x['id'] for x in s1['run']] == ['open'] and not s1['work'], 'a Sunday runs the open slot only, for health: %r' % s1['run'])
    hol = dict(slots, holidays=[W.TUE.isoformat()])
    s2 = P('slotsDue', hol, ms(21, 5), {})
    check([x['id'] for x in s2['run']] == ['close'] and not s2['work'], 'a holiday runs the close only at 21:05: %r' % s2['run'])
    sat = W.TUE + timedelta(days=4)
    s3 = P('slotsDue', slots, ms(12, 30, base=sat), {})
    check('memo' in [x['id'] for x in s3['run']] and 'memo' not in run_ + list(skip), 'the memo runs on Saturday and not on Tuesday')

    # ---------- leaveCheck ----------
    base = W.state(D)
    req = {'id': 'R9', 'from': ymd(7), 'to': ymd(7), 'type': 'casual', 'at': ms(9, 0)}
    ok = P('leaveCheck', base, M1, req, base['now'])
    check(ok['ok'] and not failed(ok) and ok['days'] == 1, 'the plain request passes every check: %r' % [(c['k'], c['ok'], c['val']) for c in ok['checks']])
    keys = {c['k'] for c in ok['checks']}
    check({'policy', 'days', 'balance', 'probation', 'notice', 'out', 'pod', 'blackout', 'client', 'manager', 'unchanged'} <= keys, 'every check carries a key, a value and a limit: %r' % sorted(keys))
    check(all('val' in c and 'limit' in c for c in ok['checks']), 'each check has val and limit')

    def only(name, st, uid, r, msg):
        res = P('leaveCheck', st, uid, r, st['now'])
        check(not res['ok'] and failed(res) == [name], '%s fails alone: %r' % (msg, failed(res)))
        return res

    only('days', W.state(D), M1, dict(req, to=ymd(9)), 'three working days over the two allowed')
    yr = W.TUE.year if W.TUE >= date(W.TUE.year, 4, 1) else W.TUE.year - 1
    may = date(yr, 5, 4)
    while may.weekday() != 0:
        may += timedelta(days=1)
    st = W.state(D)
    W.approve(st, M1, 'Ma', may.isoformat(), (may + timedelta(days=12)).isoformat())
    r = only('balance', st, M1, req, 'no casual days left after twelve taken in May')
    check(next(c for c in r['checks'] if c['k'] == 'balance')['val'] == 0, 'the balance is the year\'s days less the approved ones')
    only('probation', W.state(D), M5, req, 'a person in probation')
    st = W.state(D)
    st['cfg']['leave']['probationLop'] = True
    sick = P('leaveCheck', st, M5, dict(req, type='sick', **{'from': ymd(1), 'to': ymd(1)}), st['now'])
    check(sick['ok'], 'sick leave in probation passes with probationLop, and needs no notice: %r' % failed(sick))
    only('notice', W.state(D), M1, dict(req, **{'from': ymd(1), 'to': ymd(1)}), 'one day of notice for casual leave')
    st = W.state(D)
    W.approve(st, M3, 'A3', ymd(7), ymd(7))
    W.approve(st, M4, 'A4', ymd(7), ymd(7))
    only('out', st, M1, req, 'two people out already')
    st = W.state(D)
    W.approve(st, M2, 'A2', ymd(7), ymd(7))
    only('pod', st, M1, req, 'someone from the pod out')
    st = W.state(D)
    W.ask(st, M3, 'P3', ymd(7), ymd(7), at=ms(8, 0))
    W.approve(st, M4, 'A4', ymd(7), ymd(7))
    only('out', st, M1, req, 'an earlier pending request counts as out')
    st = W.state(D)
    W.ask(st, M3, 'P3', ymd(7), ymd(7), at=ms(10, 0))
    W.approve(st, M4, 'A4', ymd(7), ymd(7))
    later = P('leaveCheck', st, M1, req, st['now'])
    check(later['ok'], 'a request asked later does not count: %r' % failed(later))
    st = W.state(D)
    st['cfg']['leave']['blackout'] = [ymd(7)]
    only('blackout', st, M1, req, 'a blackout date')
    st = W.state(D)
    st['tasks'] = {'tc': W.task(M1, due=ymd(7), client='cl_sw')}
    only('client', st, M1, req, 'a client date of theirs inside the leave')
    st = W.state(D)
    st['projects'] = {'pc': {'name': 'Swisse', 'kind': 'client', 'owner': M1, 'members': [M1], 'due': ymd(7), 'status': 'on'}}
    only('client', st, M1, req, 'a client project of theirs due inside the leave')
    st = W.state(D)
    st['members'][M1]['reportsTo'] = M6
    st['cfg']['leave']['maxOutPerPod'] = 2
    W.approve(st, M6, 'A6', ymd(7), ymd(7))
    only('manager', st, M1, req, 'the manager away on every day')
    st = W.state(D)
    st['seen'] = {'leave': {M1 + ':R9': {'from': ymd(8), 'to': ymd(8), 'type': 'casual'}}}
    only('unchanged', st, M1, req, 'a request changed since it was seen')
    st = W.state(D)
    st['cfg']['leave']['perType']['casual'] = None
    nul = P('leaveCheck', st, M1, req, st['now'])
    check(not nul['ok'] and 'policy' in failed(nul) and nul['missing'], 'a null perType fails closed and names what is missing: %r' % nul['missing'])
    sw = P('leaveCheck', W.state(D), M1, dict(req, type='swap'), base['now'])
    check(not sw['ok'] and 'type' in failed(sw), 'a swap always goes to Kaavish: %r' % failed(sw))

    # swap and wfh are never leave; a swap before the v33 date still is
    st = W.state(D)
    W.approve(st, M2, 'W2', ymd(7), ymd(7), typ='wfh')
    W.approve(st, M3, 'S3', ymd(7), ymd(7), typ='swap')
    W.approve(st, M4, 'C4', ymd(7), ymd(7))
    st['cfg']['leave']['maxOutPerPod'] = 2
    wf = P('leaveCheck', st, M1, req, st['now'])
    check(wf['ok'] and next(c for c in wf['checks'] if c['k'] == 'out')['val'] == 1, 'a WFH day and a swap are not out: %r' % [(c['k'], c['val']) for c in wf['checks']])
    sd = date.fromisoformat(since)
    pre = sd - timedelta(days=2)
    while pre.weekday() == 6:
        pre -= timedelta(days=1)
    then = pre - timedelta(days=5)
    while then.weekday() == 6:
        then -= timedelta(days=1)
    st = W.state(D, now=ms(11, 0, base=then))
    W.approve(st, M3, 'S3', pre.isoformat(), pre.isoformat(), typ='swap')
    old = P('leaveCheck', st, M1, dict(req, **{'from': pre.isoformat(), 'to': pre.isoformat(), 'at': ms(9, 0, base=then)}), st['now'])
    check(next(c for c in old['checks'] if c['k'] == 'out')['val'] == 1, 'a swap before %s is still a day off: %r' % (since, [(c['k'], c['val']) for c in old['checks']]))

    # ---------- balance ----------
    st = W.state(D)
    W.approve(st, M1, 'Mar', '%d-03-23' % yr, '%d-03-24' % yr)
    W.approve(st, M1, 'May', '%d-05-05' % yr, '%d-05-07' % yr)
    W.approve(st, M1, 'Sk', '%d-06-02' % yr, '%d-06-02' % yr, typ='sick')
    W.approve(st, M1, 'Wf', '%d-06-03' % yr, '%d-06-05' % yr, typ='wfh')
    def wd(a_, b_):
        a0, b0 = date.fromisoformat(a_), date.fromisoformat(b_)
        return sum(1 for i in range((b0 - a0).days + 1) if (a0 + timedelta(days=i)).weekday() != 6)
    mar, mayd = wd('%d-03-23' % yr, '%d-03-24' % yr), wd('%d-05-05' % yr, '%d-05-07' % yr)
    b1 = P('balance', st, M1, 'casual', '04-01')
    b2 = P('balance', st, M1, 'sick', '04-01')
    b3 = P('balance', st, M1, 'casual', '01-01')
    check(b1 == 12 - mayd and b2 == 12 - wd('%d-06-02' % yr, '%d-06-02' % yr), 'from 1 April only this year\'s casual days count, sick apart, WFH never: %r' % [b1, b2])
    check(b3 == (12 - mayd - mar if W.TUE.year == yr else 12), 'a leave year from 1 January holds March too: %r' % b3)
    st['cfg']['leave']['perType']['other'] = None
    check(P('balance', st, M1, 'other', '04-01') is None, 'an unset type has no balance (fails closed)')

    # ---------- clientDated ----------
    st = W.state(D)
    st['projects'] = {'pc': {'kind': 'client', 'due': ymd(9)}, 'pi': {'kind': 'internal', 'due': ymd(9)}}
    cases = [
        (W.task(M1, due=ymd(3), dueKind='client'), True, 'dueKind client'),
        (W.task(M1, due=ymd(3), client='cl1'), True, 'the client field'),
        (W.task(M1, due=ymd(3), project='pc'), True, 'a client project'),
        (W.task(M1, due=ymd(9), project='pi'), True, 'the project\'s own due'),
        (W.task(M1, due=ymd(9), project='pi', client='cl1', dueKind='internal'), False, 'dueKind internal wins'),
        (W.task(M1, due=ymd(3), project='pi'), False, 'a plain internal task'),
    ]
    for t, want, msg in cases:
        check(P('clientDated', st, t) is want, 'clientDated: %s is %s' % (msg, want))

    # ---------- load ----------
    st = W.state(D)
    st['projects'] = {'pr': {'kind': 'internal', 'owner': M2, 'members': [M1, M2], 'due': ymd(30)}}
    st['tasks'] = {'a': W.task(M1, due=ymd(1), priority='high'), 'b': W.task(M1, due=ymd(-2)), 'c': W.task(M1, status='doing', priority='low'),
                   'd': W.task(M1, due=ymd(-2), status='done'), 'e': W.task(M1, due=ymd(1), status='review', project='pr'), 'f': W.task(M1, due=ymd(10))}
    W.approve(st, M3, 'L3', ymd(1), ymd(1))
    ld = P('load', st, st['today'])
    check(ld[M1]['score'] == 11 and ld[M1]['open'] == 4 and ld[M1]['over'] == 1 and ld[M1]['soon'] == 1, 'the score: 3+1, 2+2, 1, 2, and nothing for done: %r' % ld[M1])
    check(ld[M2]['review'] == 1 and ld[M2]['score'] >= 1 and ld[M1]['review'] == 0, 'review work counts on the reviewer: %r' % ld[M2])
    check(ld[M1]['cap'] == 10 and ld[M3]['cap'] == 8, 'the cap is maxOpen over the working days left, net of leave: %r' % [ld[M1]['cap'], ld[M3]['cap']])

    # ---------- shortlist ----------
    bw = W.busy_world(D)
    ld = P('load', bw, bw['today'])
    sl = P('shortlist', bw, dict(bw['tasks']['t_d0'], id='t_d0'), ld, bw['today'])
    check(sl == [M6, M2], 'project people under the median, least loaded first: %r (scores %r)' % (sl, {u: ld[u]['score'] for u in ld}))
    check(M3 not in sl and M4 not in sl and M5 not in sl and M1 not in sl and F not in sl, 'never on leave soon, on a hold, over the median, the owner or the founder')

    # ---------- planCover ----------
    cw = W.cover_world(D)
    rq = cw['leave'][M1][0]
    pc = P('planCover', cw, M1, rq)
    moved = {m['task'] for m in pc['moves']}
    check(moved <= {'t1', 't5', 't6'} and 't1' in moved and [p['task'] for p in pc['propose']] == ['t2'], 'internal work moves, the client date is proposed: %r' % pc)
    check(not ({'t3', 't4'} & (moved | {x['task'] for x in pc['skip']})), 'review and done work is never touched')
    check(all(m['why'] == 'leave' for m in pc['moves']) and all(m['to'] in (M2, M6) for m in pc['moves'] if m['kind'] == 'owner'), 'owner moves go to the shortlist, with why leave: %r' % pc['moves'])
    cw1 = W.cover_world(D)
    cw1['cfg']['limits']['movesPerPersonDay'] = 1
    p1 = P('planCover', cw1, M1, rq)
    owners = [m for m in p1['moves'] if m['kind'] == 'owner']
    shifts = [m for m in p1['moves'] if m['kind'] == 'due']
    check(len(owners) == 1 and all(m['newDue'] == ymd(8) for m in shifts), 'one hand-on a person a day, the rest roll to the day back: %r' % p1['moves'])
    cw0 = W.cover_world(D)
    cw0['cfg']['limits']['movesPerDay'] = 0
    cw0['cfg']['limits']['shiftsPerDay'] = 0
    p0 = P('planCover', cw0, M1, rq)
    check(not p0['moves'] and {x['why'] for x in p0['skip']} == {'cap'} and len(p0['propose']) == 1, 'no moves past the day\'s caps: %r' % p0)

    # ---------- planRebalance ----------
    bw = W.busy_world(D)
    ld = P('load', bw, bw['today'])
    rb = P('planRebalance', bw, ld, ld, bw['today'])
    tasks = bw['tasks']
    check(rb['over'] == [M1] and rb['moves'], 'Durvesh is over the line on both snapshots: %r' % rb['over'])
    check(all(m['task'].startswith('t_d') for m in rb['moves']), 'only movable internal todo work moves (never client, review, done or fresh doing): %r' % [m['task'] for m in rb['moves']])
    check(tasks[rb['moves'][0]['task']]['priority'] == 'low' and all(m['why'] == 'overload' and m['from'] == M1 for m in rb['moves']), 'lowest priority first, why overload')
    check(len(rb['moves']) <= 3 and all(m['to'] not in (M3, M4, F) for m in rb['moves']), 'inside movesPerPersonDay, never to leave, a hold or the founder: %r' % rb['moves'])
    under = copy.deepcopy(ld)
    under[M1]['score'] = 1
    check(not P('planRebalance', bw, ld, under, bw['today'])['moves'], 'over on one snapshot only: nothing moves')
    bw1 = W.busy_world(D)
    bw1['cfg']['limits']['movesPerDay'] = 1
    check(len(P('planRebalance', bw1, ld, ld, bw1['today'])['moves']) == 1, 'movesPerDay 1: one move')
    bo = W.busy_world(D)
    for k in [k for k in bo['tasks'] if k.startswith('t_d')]:
        del bo['tasks'][k]
    bo['cfg']['load'].update({'maxOpen': 2, 'margin': 1.0})
    lo = P('load', bo, bo['today'])
    ro = P('planRebalance', bo, lo, lo, bo['today'])
    check([m['task'] for m in ro['moves']] == ['t_over'] and ro['moves'][0]['newDue'] == ymd(1), 'an overdue task arrives due the receiver\'s next working day: %r' % ro['moves'])

    # ---------- actKey and lint ----------
    k1, k2, k3 = P('actKey', 'move', 't1', '2026-W42'), P('actKey', 'move', 't1', '2026-W42'), P('actKey', 'move', 't1', '2026-W43')
    check(isinstance(k1, str) and k1 == k2 and k1 != k3, 'actKey is stable and changes with the period: %r' % [k1, k3])
    bad = ['Moved it – sorry', 'Moved it — sorry', 'Moved it - sorry', 'Done!', 'I asked Riya rather than Arjun.', 'Moved it instead of waiting.', 'It is not late, but it is close.', '']
    res = [P('lint', x)['ok'] for x in bad]
    check(not any(res), 'lint refuses dashes, exclamation marks and the contrast phrases: %r' % list(zip(bad, res)))
    check(P('lint', 'Moved the reel cut from Riya to Arjun. Undo for 24 hours.')['ok'], 'and passes a plain line')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
