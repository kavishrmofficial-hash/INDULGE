#!/usr/bin/env python3
"""Rules engine test. Seeds violations for m1 and a clean record for m2, then asserts the flags.

Run: cd m360-os && M360_MODULES=05-rules.js M360_TAG=rules python3 harness/tests/test_rules.py

The browser clock is fixed at Tuesday 22 Sep 2026, 20:00 IST (past the 19:30 EOD cut) so every
date in the scenario is deterministic. Timers keep running, so snapshots still deliver.
Each browser context has its own localStorage, so the scenario is seeded once per page.
"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
FIXED = datetime.datetime(2026, 9, 22, 20, 0, tzinfo=IST)
WED_1400 = int(datetime.datetime(2026, 9, 23, 14, 0, tzinfo=IST).timestamp() * 1000)
SUN_2000 = int(datetime.datetime(2026, 9, 27, 20, 0, tzinfo=IST).timestamp() * 1000)

SETTINGS = {
    'office': None, 'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00',
    'wfhCap': 2, 'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
    'rules': {'R%02d' % i: True for i in range(1, 17)},
    'points': {}, 'leaderboardIncludesFounder': False, 'updated': 1
}

DATES_JS = '''() => {
  const U = M.U; const now = new Date(); const today = U.ymd(now);
  const back = n => U.ymd(U.addDays(now, -n));
  const at = (d, hh, mm) => { const x = U.parseYmd(d); x.setHours(hh, mm, 0, 0); return x.getTime(); };
  return {today, dow: now.getDay(), hour: now.getHours(), nowMs: now.getTime(),
    mon: back(1), sun: back(2), sat: back(3), fri: back(4), d5: back(5), d7: back(7), d2: back(2),
    plus2: U.ymd(U.addDays(now, 2)), plus20: U.ymd(U.addDays(now, 20)),
    week: U.isoWeek(now), lastWeek: U.isoWeek(U.addDays(now, -7)), twoWeeks: U.isoWeek(U.addDays(now, -14)),
    in1340: at(today, 13, 40)};
}'''

READY_JS = ("() => M.lastCtx && M.lastCtx.coll.tasks.map['t1'] && M.lastCtx.coll.tasks.map['t4'] && M.lastCtx.coll.candidates.map['cand1']"
            " && M.lastCtx.coll.review.map['u_m1'] && M.lastCtx.roster && M.lastCtx.roster.members['u_m2'] && M.lastCtx.settings.updated === 1")

DAY = 86400000

EXPECTED_M1 = {'R02': 'medium', 'R03': 'medium', 'R04': 'medium', 'R07': 'high', 'R08': 'medium', 'R09': 'medium',
               'R10': 'high', 'R11': 'low', 'R12': 'high', 'R13': 'medium', 'R14': 'medium', 'R15': 'low', 'R16': 'medium'}


def by_uid(flags, uid):
    return [f for f in flags if f['uid'] == uid]


def rules_of(flags):
    return sorted({f['rule'] for f in flags})


def one(flags, rule):
    xs = [f for f in flags if f['rule'] == rule]
    assert len(xs) == 1, 'expected exactly one %s flag, got %r' % (rule, xs)
    return xs[0]


def open_fixed(h, ident):
    page = h.open(ident, width=1280, hash='#today', reset=True)
    page.clock.set_fixed_time(FIXED)
    d = page.evaluate(DATES_JS)
    assert d['dow'] == 2 and d['hour'] == 20, 'fixed clock missing: %r' % d
    return page, d


def seed_scenario(h, page, d):
    """Seeds m1 with the violations and m2 with a clean record. Documents go in through the harness store, so a member context seeds too."""
    today, mon, sat, fri, now_ms = d['today'], d['mon'], d['sat'], d['fri'], d['nowMs']
    h.seed_doc(page, 'settings/app', SETTINGS)
    h.roster(page, ('u_m1', 'u_m2'))

    # m1: late office check-in with an unverified location
    h.seed_doc(page, 'checkin/u_m1', {'days': {today: {
        'in': d['in1340'], 'out': None, 'mode': 'office',
        'loc': {'lat': 19.0761, 'lng': 72.8777, 'acc': 40, 'dist': None, 'verified': False, 'place': 'Location captured', 'src': 'gps'}}}})
    # m1: blockers on the last two working days (Monday and Saturday), no EOD today
    h.seed_doc(page, 'eod/u_m1', {'days': {
        mon: {'shipped': 'Reel cut v2', 'next': 'Colour grade', 'blocked': 'Waiting on Swisse approvals', 'at': now_ms - DAY},
        sat: {'shipped': 'Scripts v3', 'next': 'Reel cut', 'blocked': 'Waiting on Swisse approvals', 'at': now_ms - 3 * DAY},
        fri: {'shipped': 'Scripts v2', 'next': 'Scripts v3', 'blocked': '', 'at': now_ms - 4 * DAY}}})
    # m2: clean EOD record, Monday, Saturday and today
    h.seed_doc(page, 'eod/u_m2', {'days': {
        today: {'shipped': 'Deck v4', 'next': 'Send deck', 'blocked': '', 'at': now_ms - 3600000},
        mon: {'shipped': 'Deck v3', 'next': 'Deck v4', 'blocked': '', 'at': now_ms - DAY},
        sat: {'shipped': 'Deck v2', 'next': 'Deck v3', 'blocked': '', 'at': now_ms - 3 * DAY}}})
    # both have this week's plan
    for u in ('u_m1', 'u_m2'):
        h.seed_doc(page, 'plan/' + u, {'weeks': {d['week']: {'items': [{'id': 'a', 'text': 'Ship the reel'}], 'at': now_ms - DAY}}})
    # m1: two misses over the last two weeks; m2: all hits
    h.seed_doc(page, 'review/u_m1', {'weeks': {
        d['lastWeek']: {'marks': {'a': 'miss', 'b': 'hit'}, 'quality': 3, 'note': '', 'at': now_ms - 4 * DAY},
        d['twoWeeks']: {'marks': {'c': 'miss', 'd': 'hit'}, 'quality': 3, 'note': '', 'at': now_ms - 11 * DAY}}})
    h.seed_doc(page, 'review/u_m2', {'weeks': {
        d['lastWeek']: {'marks': {'a': 'hit', 'b': 'hit'}, 'quality': 4, 'note': '', 'at': now_ms - 4 * DAY}}})
    # handbook section updated 3 days ago, read by m2 only
    h.seed_doc(page, 'handbook/house-rules', {'title': 'House rules', 'body': '# Finish it', 'order': 1, 'updated': now_ms - 3 * DAY})
    h.seed_doc(page, 'acks/u_m2', {'s': {'house-rules': now_ms - DAY}})
    # pitches
    h.seed_doc(page, 'pitches/p1', {'brand': 'Fable Foods', 'category': 'FMCG', 'stage': 'proposal', 'stageAt': now_ms - 10 * DAY,
                                    'owner': 'u_m1', 'next': 'Send revised deck', 'nextDate': d['d7'], 'created': now_ms - 20 * DAY, 'updated': now_ms - 8 * DAY})
    h.seed_doc(page, 'pitches/p2', {'brand': 'Nimbus Air', 'category': 'Travel', 'stage': 'lead', 'stageAt': now_ms - DAY,
                                    'owner': 'u_m2', 'next': 'Intro call', 'nextDate': d['plus2'], 'created': now_ms - DAY, 'updated': now_ms - DAY})
    # projects
    h.seed_doc(page, 'projects/pr1', {'name': 'Swisse Q4 campaign', 'kind': 'client', 'client': 'c1', 'owner': 'u_m1', 'members': ['u_m1'],
                                      'status': 'off', 'start': d['d7'], 'due': d['plus20'], 'sections': [], 'updates': {}, 'archived': False, 'by': 'u_m1', 'created': now_ms - 7 * DAY})
    h.seed_doc(page, 'projects/pr2', {'name': 'Nimbus pitch', 'kind': 'pitch', 'pitch': 'p2', 'owner': 'u_m2', 'members': ['u_m2'],
                                      'status': 'on', 'start': d['d7'], 'due': d['plus20'], 'sections': [], 'updates': {}, 'archived': False, 'by': 'u_m2', 'created': now_ms - 7 * DAY})
    # clients
    h.seed_doc(page, 'clients/c1', {'name': 'Swisse Wellness UAE', 'status': 'live', 'pod': 'Pod 1', 'owner': 'u_m1',
                                    'memory': '30 reel shoot with Blah Studio.', 'approvals': '', 'never': 'No medical claims.', 'links': '', 'updated': now_ms - DAY, 'by': 'u_m1'})
    h.seed_doc(page, 'clients/c2', {'name': 'Nimbus Air', 'status': 'live', 'pod': 'Pod 1', 'owner': 'u_m2',
                                    'memory': 'Launch campaign.', 'approvals': 'Omar signs off.', 'never': 'No price talk.', 'links': '', 'updated': now_ms - DAY, 'by': 'u_m2'})
    # hiring: both evaluate cand1, deadline passed, only m2 submitted
    h.seed_doc(page, 'candidates/cand1', {'name': 'Priya S', 'role': 'Producer', 'stage': 'panel', 'links': '', 'notes': '',
                                          'evaluators': ['u_m1', 'u_m2'], 'deadline': d['d2'], 'decision': None, 'decidedAt': None, 'created': now_ms - 9 * DAY})
    h.seed_doc(page, 'evals/u_m2', {'e': {'cand1': {'gwc': {'g': True, 'w': True, 'c': True}, 's': {'craft': 4, 'thinking': 4, 'comms': 3, 'ownership': 4, 'culture': 4},
                                                    'pod': 'yes', 'verdict': 'yes', 'why': 'Ships.', 'risk': 'New to FMCG.', 'at': now_ms - 3 * DAY}}})
    # tasks: t1 overdue 5 days, t2 in review with the 20% check unticked and 2 revisions, t3 and t4 clean for m2
    h.seed_doc(page, 'tasks/t2', {'title': 'Blah Studio call sheet', 'owner': 'u_m1', 'client': 'c1', 'project': 'pr1', 'section': '', 'due': d['plus2'],
                                  'status': 'review', 'priority': 'normal', 'link': '', 'revisions': 2, 'shown20': False, 'subtasks': {}, 'comments': {},
                                  'by': 'u_m1', 'created': now_ms - 6 * DAY, 'updated': now_ms - 2 * DAY, 'doneAt': None})
    h.seed_doc(page, 'tasks/t3', {'title': 'Nimbus deck', 'owner': 'u_m2', 'client': 'c2', 'project': 'pr2', 'section': '', 'due': d['plus2'],
                                  'status': 'done', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': True, 'subtasks': {}, 'comments': {},
                                  'by': 'u_m2', 'created': now_ms - 6 * DAY, 'updated': now_ms - DAY, 'doneAt': now_ms - DAY})
    h.seed_doc(page, 'tasks/t4', {'title': 'Nimbus moodboard', 'owner': 'u_m2', 'client': 'c2', 'project': 'pr2', 'section': '', 'due': d['plus2'],
                                  'status': 'doing', 'priority': 'normal', 'link': '', 'revisions': 1, 'shown20': False, 'subtasks': {}, 'comments': {},
                                  'by': 'u_m2', 'created': now_ms - 6 * DAY, 'updated': now_ms - DAY, 'doneAt': None})
    h.seed_doc(page, 'tasks/t1', {'title': 'Swisse reel scripts', 'owner': 'u_m1', 'client': 'c1', 'project': 'pr1', 'section': '', 'due': d['d5'],
                                  'status': 'doing', 'priority': 'high', 'link': '', 'revisions': 0, 'shown20': False, 'subtasks': {}, 'comments': {},
                                  'by': 'u_m1', 'created': now_ms - 9 * DAY, 'updated': now_ms - 5 * DAY, 'doneAt': None})
    page.wait_for_function(READY_JS)
    page.wait_for_timeout(150)


def check_shape(flags):
    assert isinstance(flags, list) and flags, 'no flags at all'
    for f in flags:
        for k in ('rule', 'uid', 'severity', 'text', 'section', 'ref'):
            assert k in f, 'flag missing %s: %r' % (k, f)
        assert f['severity'] in ('high', 'medium', 'low'), f
        assert f['text'] and isinstance(f['text'], str), f
        assert chr(0x2014) not in f['text'] and chr(0x2013) not in f['text'], 'dash in ' + f['text']


def check_m1(flags):
    m1 = by_uid(flags, 'u_m1')
    assert rules_of(m1) == sorted(EXPECTED_M1), 'm1 rules %r, expected %r' % (rules_of(m1), sorted(EXPECTED_M1))
    for rule, s in EXPECTED_M1.items():
        f = one(m1, rule)
        assert f['severity'] == s, '%s severity %s, expected %s: %r' % (rule, f['severity'], s, f)
    assert one(m1, 'R02')['text'] == 'Checked in 13:40, 3h 10m late', one(m1, 'R02')
    assert one(m1, 'R03')['text'] == 'Office check-in 13:40, location unverified', one(m1, 'R03')
    assert one(m1, 'R04')['text'] == 'No EOD line today, due by 19:30', one(m1, 'R04')
    r07 = one(m1, 'R07')
    assert '5 days overdue' in r07['text'] and 'Swisse reel scripts' in r07['text'], r07
    assert r07['ref'] == '#tasks' and r07['section'] == 'house-rules', r07
    r08 = one(m1, 'R08')
    assert 'Blah Studio call sheet' in r08['text'] and r08['section'] == 'house-rules' and r08['ref'] == '#tasks', r08
    r09 = one(m1, 'R09')
    assert '2 revisions' in r09['text'] and 'cap is 2' in r09['text'] and r09['section'] == 'standards', r09
    r10 = one(m1, 'R10')
    assert '2 working days in a row' in r10['text'] and 'Swisse approvals' in r10['text'] and r10['section'] == 'escalation', r10
    r11 = one(m1, 'R11')
    assert r11['section'] == 'house-rules' and r11['ref'] == '#handbook/house-rules' and 'House rules' in r11['text'], r11
    r12 = one(m1, 'R12')
    assert '2 missed outcomes in 30 days' in r12['text'] and 'A formal warning' in r12['text'] and r12['section'] == 'ladder', r12
    assert r12['ref'] == '#people/u_m1', r12
    r13 = one(m1, 'R13')
    assert 'Fable Foods' in r13['text'] and '7 days overdue' in r13['text'] and r13['ref'] == '#pitches' and r13['section'] == 'pipeline', r13
    r14 = one(m1, 'R14')
    assert 'off track' in r14['text'] and r14['ref'] == '#projects/pr1' and r14['section'] == 'projects', r14
    r15 = one(m1, 'R15')
    assert 'approvals is empty' in r15['text'] and r15['ref'] == '#clients' and r15['section'] == 'clients', r15
    r16 = one(m1, 'R16')
    assert 'Priya S' in r16['text'] and r16['ref'] == '#hiring' and r16['section'] == 'hiring-panel', r16


def test(h):
    page, d = open_fixed(h, 'founder')
    today, now_ms = d['today'], d['nowMs']
    seed_scenario(h, page, d)

    flags = h.ctx(page, 'M.rules.evaluate(ctx, new Date())')
    check_shape(flags)
    check_m1(flags)

    # m2 before leave: no check-in at 20:00 on a working day is the only flag, and it is high
    m2 = by_uid(flags, 'u_m2')
    assert rules_of(m2) == ['R01'], 'm2 rules before leave %r' % [(f['rule'], f['text']) for f in m2]
    r01 = one(m2, 'R01')
    assert r01['severity'] == 'high' and r01['section'] == 'the-week' and r01['ref'] == '#today', r01
    assert 'past 10:30' in r01['text'], r01

    # the founder is on the roster too and gets the same attendance rules
    fo = by_uid(flags, 'u_founder')
    assert 'R01' in rules_of(fo) and 'R04' in rules_of(fo) and 'R11' in rules_of(fo), rules_of(fo)

    # approved leave today switches the attendance rules off for m2
    h.seed_doc(page, 'leave/u_m2', {'reqs': [{'id': 'l1', 'from': today, 'to': today, 'type': 'casual', 'at': now_ms - DAY}]})
    h.seed_doc(page, 'leavedec/u_m2', {'d': {'l1': {'status': 'approved', 'at': now_ms - 3600000}}})
    page.wait_for_function("() => M.lastCtx && M.lastCtx.onLeave('u_m2', '%s')" % today)
    flags = h.ctx(page, 'M.rules.evaluate(ctx, new Date())')
    m2 = by_uid(flags, 'u_m2')
    assert rules_of(m2) == [], 'm2 rules on leave %r' % [(f['rule'], f['text']) for f in m2]
    assert rules_of(by_uid(flags, 'u_m1')) == sorted(EXPECTED_M1), rules_of(by_uid(flags, 'u_m1'))

    # a rule switched off in settings never fires
    off = dict(SETTINGS, rules=dict(SETTINGS['rules'], R07=False), updated=2)
    h.seed_doc(page, 'settings/app', off)
    page.wait_for_function("() => M.lastCtx && M.lastCtx.settings.rules.R07 === false")
    flags = h.ctx(page, 'M.rules.evaluate(ctx, new Date())')
    m1 = by_uid(flags, 'u_m1')
    assert 'R07' not in rules_of(m1) and 'R08' in rules_of(m1), rules_of(m1)
    h.seed_doc(page, 'settings/app', dict(SETTINGS, updated=3))
    page.wait_for_function("() => M.lastCtx && M.lastCtx.settings.rules.R07 === true && M.lastCtx.settings.updated === 3")
    flags = h.ctx(page, 'M.rules.evaluate(ctx, new Date())')
    assert 'R07' in rules_of(by_uid(flags, 'u_m1')), rules_of(by_uid(flags, 'u_m1'))

    # the previous working day branch of R04: on Wednesday 14:00, m1 has no EOD for Tuesday
    flags_wed = h.ctx(page, 'M.rules.evaluate(ctx, new Date(%d))' % WED_1400)
    r04 = one(by_uid(flags_wed, 'u_m1'), 'R04')
    assert r04['text'] == 'No EOD line for Tue 22 Sep, due by 19:30', r04
    # m2 was on leave Tuesday, so the previous working day is Monday, which has an EOD
    assert 'R04' not in rules_of(by_uid(flags_wed, 'u_m2')), rules_of(by_uid(flags_wed, 'u_m2'))
    # a Sunday evening: no attendance flags for anyone
    flags_sun = h.ctx(page, 'M.rules.evaluate(ctx, new Date(%d))' % SUN_2000)
    for f in flags_sun:
        assert f['rule'] not in ('R01', 'R02', 'R05'), f

    # ctx.flags is wired through the state and matches a direct evaluation
    live = h.ctx(page, 'ctx.flags.map(f => f.rule + ":" + f.uid)')
    assert 'R07:u_m1' in live and 'R16:u_m1' in live, live

    # static exports
    names = h.ctx(page, 'M.rules.NAMES')
    assert sorted(names) == ['R%02d' % i for i in range(1, 17)], sorted(names)
    assert names['R01'] == 'Check in by start time' and names['R04'] == 'EOD line by 19:30' and names['R16'] == 'Hiring panel on time', names
    assert h.ctx(page, 'M.rules.name("R04", {eodCut: "18:45"})') == 'EOD line by 18:45'
    assert h.ctx(page, 'M.rules.SECTION_RULES("the-week")') == ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R11']
    assert h.ctx(page, 'M.rules.SECTION_RULES("house-rules")') == ['R07', 'R08', 'R11']
    assert h.ctx(page, 'M.rules.SECTION_RULES("ladder")') == ['R12', 'R11']
    assert h.ctx(page, 'M.rules.SECTION_RULES("hiring-panel")') == ['R16', 'R11']
    assert h.ctx(page, 'M.rules.SECTION_RULES("tool-map")') == ['R11']
    assert h.ctx(page, 'M.rules.evaluate(null, new Date())') == []
    # a sparse context with no documents never throws; only the absence rules can fire
    sparse = h.ctx(page, 'M.rules.evaluate({coll: {}, settings: {}, activeMembers: [{uid: "x"}]}, new Date())')
    assert set(rules_of(sparse)) <= {'R01', 'R04', 'R05'}, rules_of(sparse)
    assert h.ctx(page, 'M.rules.evaluate({coll: {tasks: {ready: true}}, settings: {}, activeMembers: []}, new Date())') == []

    # a member viewer: other evaluators' documents are hidden, so R16 is computed for the viewer only
    page2, d2 = open_fixed(h, 'm1')
    seed_scenario(h, page2, d2)
    assert h.ctx(page2, 'Object.keys(ctx.coll.evals.map)') == [], 'a member reads no other evals'
    f2 = h.ctx(page2, 'M.rules.evaluate(ctx, new Date())')
    check_shape(f2)
    check_m1(f2)
    assert 'R16' not in rules_of(by_uid(f2, 'u_m2')), rules_of(by_uid(f2, 'u_m2'))
    assert rules_of(by_uid(f2, 'u_m2')) == ['R01'], rules_of(by_uid(f2, 'u_m2'))
    my = h.ctx(page2, 'ctx.myFlags.map(f => f.rule)')
    assert sorted(set(my)) == sorted(EXPECTED_M1), my

    errs = h.errors()
    assert not errs, 'console errors: %r' % errs
    for p in (page, page2):
        assert h.overflow(p) == 0, 'overflow %d' % h.overflow(p)
    return True


if __name__ == '__main__':
    try:
        ok = run(test)
    except AssertionError as e:
        import traceback
        traceback.print_exc()
        print('FAIL:', e)
        sys.exit(1)
    if not ok:
        print('FAIL')
        sys.exit(1)
    print('PASS')
