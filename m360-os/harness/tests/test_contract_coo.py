#!/usr/bin/env python3
"""v33 test: the m360 COO's contract between the builders (spec part O1 and B3 to B5).

Checks, on the founder's page:
- M.coo has every name O1 lists, with the right kinds: UID 'u_m360coo', isCoo, title, cfg, on, rung, CEIL,
  STATIONS (the twelve keys), JOBS (every job in part D, each at a known station with a label), ist,
  plan (the eleven pure functions), copy, useLive, feed, decisions, decide, undo, stop, pause, resume,
  endPractice, why, health, moveTask, guard and Runner; M.tasks.save takes opts, ctx.W.as exists, and the
  agent's NEVER list is the v32 one, unchanged;
- ist reads IST whatever the device clock says;
- cfg deep-merges settings.coo over the defaults; the bot's display name is title, never name;
- CEIL: client mail, meeting mail and invoice mail never rise above draft, client dates and structure never
  above propose, whatever settings say; any other capability takes the rung Kaavish sets;
- guard: ALLOW passes (an internal open task's owner and due with the bot's logs and comment, an approved
  leave decision by the bot, a raised project status with its update, the bot's own asks and DM room, coo/*,
  office/live, books/cooq) and NEVER throws (a status, a title, someone else's log line, a client-dated or
  done or deleted task, a task a person moved this week, a decline, a decision in Kaavish's name, a project
  lowered, review, kudos, points, approvals, settings, roster, payroll, invoices, books, data/users, log,
  someone else's me doc);
- every COPY template, in the founder, dm and team scopes and as a practice line, passes the house rules
  (lint, no 'undefined', 'NaN' or 'null'); team lines carry no names and no numbers;
- W.as('coo') writes log under u_m360coo and never stamps Kaavish's activity; quiet writes no log line;
  M.tasks.save with {by: UID, why} writes only the owner, its log with the why, updatedBy and the reason.

Fails until builder 1's M.coo is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_contract_coo.py
"""
import os
import re
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
BOT = 'u_m360coo'
STATIONS = ['attendance', 'calendar', 'board', 'review', 'desk', 'meeting', 'clients', 'mail', 'tray', 'books', 'reception', 'clock']
JOBS = ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J10', 'J11', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18', 'J19', 'J20',
        'J30', 'J31', 'J32', 'J33', 'J34', 'J35', 'J36', 'J37', 'J38', 'J40', 'J41', 'J42', 'J43', 'J50', 'J51']
PLAN = ['stateOf', 'slotsDue', 'leaveCheck', 'balance', 'clientDated', 'load', 'shortlist', 'planCover', 'planRebalance', 'actKey', 'lint']
FUNCS = ['isCoo', 'title', 'cfg', 'on', 'rung', 'copy', 'useLive', 'feed', 'decisions', 'decide', 'undo', 'stop', 'pause', 'resume', 'endPractice',
         'why', 'health', 'moveTask', 'guard', 'Runner']
NEVER_V32 = r'^(delete|erase|purge|offboard|restore|sign_?out|signout|lock|unlock|run_payroll|payroll|mark_paid|approve_payroll|issue_letter|sign_letter|letter|approve_own|answer_pulse|pulse|score_candidate|prune|export|change_key|set_key|ai_key|mail_key|voice_key)'
CAPS = ['roll', 'nudge', 'leave', 'wfh', 'cover', 'rebalance', 'shift', 'orphans', 'reviews', 'projects', 'clientMail', 'meetingMail', 'invoiceMail',
        'clientDates', 'memo', 'reviewPrep', 'structure']


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    page = h.open('founder', hash='#home', reset=True, seed=True, noai=True)
    if not page.evaluate('() => !!(window.M && M.coo && M.coo.UID)'):
        raise AssertionError('M.coo is not on the page: this test runs once builder 1 (10-coo.js) is merged')
    h.roster(page, ['u_m1', 'u_m2', 'u_m3'])
    page.wait_for_timeout(400)

    # ---------- the shape ----------
    shape = page.evaluate('''([funcs, plan]) => ({
      uid: M.coo.UID, missing: funcs.filter(f => typeof M.coo[f] !== 'function'), planMissing: plan.filter(f => typeof (M.coo.plan || {})[f] !== 'function'),
      stations: M.coo.STATIONS, jobs: Object.keys(M.coo.JOBS || {}).sort(),
      badJobs: Object.keys(M.coo.JOBS || {}).filter(k => { const j = M.coo.JOBS[k]; return !j || M.coo.STATIONS.indexOf(j.station) < 0 || !j.label || !('cap' in j); }),
      ist: ['ymd', 'hm', 'isoWeek', 'now'].filter(k => typeof (M.coo.ist || {})[k] !== 'function'),
      ceilFrozen: Object.isFrozen(M.coo.CEIL), ceil: M.coo.CEIL, isCoo: [M.coo.isCoo('u_m360coo'), M.coo.isCoo('u_m1')],
      saveLen: M.tasks.save.length, as: typeof M.lastCtx.W.as, ask: !!(M.pm && M.pm.ask), never: M.agent.NEVER.source,
      defaults: M.SETTINGS_DEFAULTS.coo})''', [FUNCS, PLAN])
    check(shape['uid'] == BOT and shape['isCoo'] == [True, False], 'UID and isCoo: %r' % shape['isCoo'])
    check(not shape['missing'], 'every M.coo function O1 lists is there: missing %r' % shape['missing'])
    check(not shape['planMissing'], 'every planner function: missing %r' % shape['planMissing'])
    check(shape['stations'] == STATIONS, 'the twelve stations, in order: %r' % shape['stations'])
    check(shape['jobs'] == JOBS and not shape['badJobs'], 'every job in part D, at a station, with a label: %r %r' % (sorted(set(JOBS) ^ set(shape['jobs'])), shape['badJobs']))
    check(not shape['ist'], 'ist has ymd, hm, isoWeek and now')
    check(shape['ceilFrozen'] and shape['ceil'] == {'clientMail': 'draft', 'meetingMail': 'draft', 'invoiceMail': 'draft', 'clientDates': 'propose', 'structure': 'propose'}, 'CEIL: %r' % shape['ceil'])
    check(shape['saveLen'] >= 3 and shape['as'] == 'function' and shape['ask'], 'M.tasks.save with opts, ctx.W.as and M.pm.ask are there')
    check(shape['never'] == NEVER_V32, 'the agent NEVER list is the v32 one, unchanged')
    d = shape['defaults']
    check(d['on'] is False and d['title'] == 'm360 COO' and 'name' not in d, 'off by default, the display name is title and never name')
    check(sorted(d['caps']) == sorted(CAPS), 'every capability has a rung')
    L = d['leave']
    check(L['perType'] == {'casual': 12, 'sick': 12, 'other': None} and L['yearStart'] == '04-01' and L['maxAutoDays'] == 2
          and L['noticeDays']['casual'] == 3 and L['maxOutPerDay'] == 2 and L['maxOutPerPod'] == 1,
          "the founder's leave policy (decisions 2): 12 casual, 12 sick, other null so it fails closed to him: %r" % L)

    # ---------- ist ----------
    t = int(datetime(2026, 10, 4, 20, 0, tzinfo=ZoneInfo('UTC')).timestamp() * 1000)
    ist = page.evaluate('t => [M.coo.ist.ymd(t), M.coo.ist.hm(t), M.coo.ist.isoWeek(t)]', t)
    check(ist == ['2026-10-05', '01:30', '2026-W41'], 'IST dates whatever the device says: %r' % ist)

    # ---------- cfg, title and the ceilings ----------
    c = page.evaluate('''() => { const ctx = s => ({settings: {coo: s}, coo: {state: {}}});
      const k = M.coo.cfg(ctx({limits: {movesPerDay: 3}, title: 'Ops desk', name: 'Not this'}));
      const up = {}; ['clientMail', 'meetingMail', 'invoiceMail', 'clientDates', 'structure', 'leave', 'rebalance'].forEach(x => { up[x] = 'alone'; });
      const r = {}; Object.keys(up).forEach(x => { r[x] = M.coo.rung(ctx({caps: up}), x); });
      return {moves: k.limits.movesPerDay, asks: k.limits.asksPerDay, title: M.coo.title(ctx({title: 'Ops desk'})), named: M.coo.title(ctx({name: 'Not this'})), r,
        off: M.coo.rung(ctx({caps: {leave: 'off'}}), 'leave'), on: M.coo.on(ctx({on: true})), offDefault: M.coo.on(ctx({}))}; }''')
    check(c['moves'] == 3 and c['asks'] == 30, 'cfg deep-merges over the defaults: %r' % c)
    check(c['title'] == 'Ops desk' and c['named'] == 'm360 COO', 'the title reads title, never name: %r' % [c['title'], c['named']])
    check(c['r'] == {'clientMail': 'draft', 'meetingMail': 'draft', 'invoiceMail': 'draft', 'clientDates': 'propose', 'structure': 'propose', 'leave': 'alone', 'rebalance': 'alone'},
          'no setting raises a ceiling, the rest take Kaavish\'s rung: %r' % c['r'])
    check(c['off'] == 'off' and c['on'] and not c['offDefault'], 'off is off, and on only when set')

    # ---------- guard: ALLOW and NEVER ----------
    now = int(datetime.now(IST).timestamp() * 1000)
    old = now - 10 * 86400000
    open_task = {'id': 't1', 'title': 'Studio page', 'owner': 'u_m1', 'due': '2030-01-10', 'status': 'todo', 'project': '', 'client': '', 'ownerLog': [], 'dueLog': []}
    log = [{'from': 'u_m1', 'to': 'u_m2', 'by': BOT, 'at': now, 'why': 'overload'}]
    allow = [
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log, 'updatedBy': BOT, 'updated': now, 'comments': {'c1': {'by': BOT, 't': 'Moved to even out the load.', 'at': now}}}, open_task],
        ['tasks/t1', {'due': '2030-01-12', 'dueLog': [{'from': '2030-01-10', 'to': '2030-01-12', 'by': BOT, 'at': now, 'why': 'blocked'}], 'updated': now}, dict(open_task, status='doing')],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, ownerLog=[{'from': 'u_m3', 'to': 'u_m1', 'by': 'u_founder', 'at': old}])],
        ['leavedec/u_m1', {'d': {'r1': {'status': 'approved', 'at': now, 'by': BOT, 'why': 'leave', 'checks': [], 'snap': {'from': '2030-01-10', 'to': '2030-01-10', 'type': 'casual', 'days': 1}, 'undoUntil': now}}}, None],
        ['projects/p1', {'status': 'off', 'updates': {'u1': {'by': BOT, 'status': 'off', 'text': 'Behind.', 'at': now}}, 'updated': now}, {'status': 'risk'}],
        ['me/' + BOT, {'pm': {'asks': {'a1': {'kind': 'custom', 'to': ['u_m1']}}}}, None],
        ['chat/dm.u_m1.u_m360coo:u_m360coo', {'msgs': [], 'by': BOT}, None],
        ['coo/now', {'state': 'working'}, None], ['coo/L-2030-01-10', {'acts': {}}, None], ['office/live', {'state': 'idle'}, None], ['books/cooq', {'items': {}}, None],
    ]
    never = [
        ['tasks/t1', {'status': 'done'}, open_task, 'a status'],
        ['tasks/t1', {'title': 'New'}, open_task, 'a title'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': [dict(log[0], by='u_founder')]}, open_task, 'a log line in someone else\'s name'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': [dict(log[0], why='')]}, open_task, 'a log line with no reason'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, client='cl1'), 'a client-dated task'],
        ['tasks/t1', {'due': '2030-01-12', 'dueLog': [dict(log[0], **{'from': '2030-01-10', 'to': '2030-01-12'})]}, dict(open_task, dueKind='client'), 'a client due'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, status='done'), 'a done task'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, status='review'), 'a task in review'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, deleted=True), 'a deleted task'],
        ['tasks/t1', {'owner': 'u_m2', 'ownerLog': log}, dict(open_task, ownerLog=[{'from': 'u_m3', 'to': 'u_m1', 'by': 'u_founder', 'at': now - 86400000}]), 'a task a person moved this week'],
        ['leavedec/u_m1', {'d': {'r1': {'status': 'declined', 'at': now, 'by': BOT}}}, None, 'a decline'],
        ['leavedec/u_m1', {'d': {'r1': {'status': 'approved', 'at': now, 'by': 'u_founder'}}}, None, 'a decision in Kaavish\'s name'],
        ['projects/p1', {'status': 'on'}, {'status': 'risk'}, 'a project lowered'],
        ['projects/p1', {'status': 'risk'}, {'status': 'off'}, 'a project lowered to risk'],
        ['projects/p1', {'name': 'Renamed'}, {'status': 'on'}, 'a project field'],
        ['me/u_m1', {'pm': {'asks': {}}}, None, 'someone else\'s me doc'],
        ['me/' + BOT, {'status': {'text': 'hi'}}, None, 'anything but its asks'],
    ] + [[p, {'x': 1}, None, p] for p in ('review/u_m1', 'kudos/u_m1', 'points/u_m1', 'approvals/u_m1', 'settings/app', 'roster/team', 'payroll/2026-10',
                                            'invoices/2026', 'books/settings', 'books/clients', 'data/users/u_m1/notes', 'log/u_m1', 'handbook/main', 'access/u_m1', 'fixes/u_m1')]
    g = page.evaluate('''([allow, never]) => {
      const tryIt = (p, f, d) => { try { return M.coo.guard(p, f, d || undefined, M.lastCtx) === true ? 'ok' : 'not true'; } catch (e) { return 'threw ' + (e && e.code); } };
      return {allow: allow.map(([p, f, d]) => [p, tryIt(p, f, d)]), never: never.map(([p, f, d, why]) => [why, tryIt(p, f, d)])}; }''', [allow, never])
    bad_allow = [x for x in g['allow'] if x[1] != 'ok']
    bad_never = [x for x in g['never'] if not x[1].startswith('threw')]
    check(not bad_allow, 'ALLOW passes the guard: %r' % bad_allow)
    check(not bad_never, 'NEVER throws: %r' % bad_never)
    check(all(x[1] == 'threw refused' for x in g['never']), 'a refusal carries code refused: %r' % [x for x in g['never'] if x[1] != 'threw refused'][:3])

    # ---------- COPY: the house rules on every template ----------
    cp = page.evaluate('''() => {
      const codes = M.coo.codes || Object.keys(M.coo.JOBS);
      const day = d => M.U.ymd(new Date(Date.now() + d * 86400000));
      const a = {uid: 'u_m1', to: 'u_m2', task: 'none', project: 'none', client: 'none', pitch: 'none', d1: day(3), d2: day(4), due: day(5), due0: day(-2), newDue: day(6),
        day: day(1), until: Date.now() + 3600000, at: Date.now(), type: 'casual', status: 'risk', n: 3, of: 9, left: 5, out: 1, wfh: 2, leave: 1, roll: '10:45',
        wait: 3, moves: 2, eod: 7, open: 9, over: 3, open2: 3, nth: 2, pct: 40, elapsed: 60, list: 'Reel cut', week: '2026-W42', what: 'moves', no: 'SWS-004',
        year: 2027, state: 'away', notIn: 1, why: 'overload'};
      const out = [];
      for (const code of codes) for (const [scope, extra] of [['founder', {}], ['dm', {}], ['team', {}], ['founder', {would: true}], ['team', {night: true}]]) {
        const r = M.coo.copy(code, {...a, ...extra}, scope, M.lastCtx) || {};
        out.push({code, scope, would: !!extra.would, line: r.line || '', why: r.why || '', lint: M.coo.plan.lint(r.line || '').ok, lintWhy: r.why ? M.coo.plan.lint(r.why).ok : true});
      }
      return {n: codes.length, out}; }''')
    check(cp['n'] >= 40, 'the copy has a template for every code (%d)' % cp['n'])
    empty = [x for x in cp['out'] if x['scope'] == 'founder' and not x['line']]
    check(not empty, 'every code speaks in the founder scope: %r' % [x['code'] for x in empty][:5])
    bad = [x for x in cp['out'] if x['line'] and (not x['lint'] or not x['lintWhy'] or re.search(r'undefined|NaN|\bnull\b|\[object', x['line'] + x['why']))]
    check(not bad, 'every line passes the house rules: %r' % [(x['code'], x['scope'], x['line']) for x in bad][:4])
    banned = re.compile(r'[–—!]|rather than|instead of|\bnot \w+, but\b', re.I)
    check(not [x for x in cp['out'] if banned.search(x['line'] + x['why'])], 'no dash, no exclamation mark, no contrast phrase anywhere')
    team = [x for x in cp['out'] if x['scope'] == 'team']
    check(all(x['line'] and not re.search(r'\d|Durvesh|Aanya|Ishaan|Kaavish|casual|sick|overload|SWS', x['line'][:-len('Back at 09:00.')] if x['line'].endswith('Back at 09:00.') else x['line']) for x in team),
          'team lines carry no names, no numbers, no reasons: %r' % sorted({x['line'] for x in team})[:6])
    would = [x for x in cp['out'] if x['would'] and x['line']]
    check(would and all('would' in x['line'] or x['line'].startswith('Practice') for x in would), 'the practice week speaks as "I would have": %r' % [x['line'] for x in would if 'would' not in x['line']][:3])

    # ---------- the bot's hand ----------
    w = page.evaluate('''async () => { const ctx = M.lastCtx, d = M.U.todayStr();
      const act0 = JSON.stringify(((window.__db.get("me/" + ctx.uid) || {}).act || {})[d] || {});
      await ctx.W.as('coo').merge('coo/state', {seen: {probe: Date.now()}});
      await ctx.W.as('coo', {quiet: true}).set('office/live', {v: 1, state: 'idle', at: Date.now()});
      await new Promise(r => setTimeout(r, 900));
      const act1 = JSON.stringify(((window.__db.get("me/" + ctx.uid) || {}).act || {})[d] || {});
      const botLog = Object.values(((window.__db.get("log/u_m360coo/days/" + d) || {}).e) || {}).map(e => e.p);
      const mine = Object.values(((window.__db.get("log/" + ctx.uid + "/days/" + d) || {}).e) || {}).map(e => e.p);
      return {same: act0 === act1, botLog, mine}; }''')
    check(w['botLog'].count('coo/state') == 1 and 'office/live' not in w['botLog'], 'W.as("coo") logs under the bot; quiet writes no line: %r' % w['botLog'])
    check('coo/state' not in w['mine'] and w['same'], 'and never under Kaavish, nor as his activity: %r' % w['mine'])
    h.seed_doc(page, 'tasks/t_bot', {'title': 'Studio page', 'owner': 'u_m1', 'by': 'u_founder', 'due': '2030-01-10', 'status': 'todo', 'priority': 'low', 'client': '', 'project': '',
                                     'created': old, 'updated': old, 'subtasks': {}, 'comments': {}})
    page.wait_for_timeout(300)
    s = page.evaluate('''async () => { const ctx = M.lastCtx;
      await M.tasks.save(ctx, 't_bot', {owner: 'u_m2'}, {by: M.coo.UID, why: 'overload', comment: 'Moved to even out the load.'});
      await new Promise(r => setTimeout(r, 500)); return window.__db.get('tasks/t_bot'); }''')
    last = (s.get('ownerLog') or [{}])[-1]
    cm = [x for x in (s.get('comments') or {}).values() if x.get('by') == BOT]
    check(s['owner'] == 'u_m2' and last.get('by') == BOT and last.get('why') == 'overload' and s.get('updatedBy') == BOT, 'the bot\'s move logs under it with its why: %r' % last)
    check(s['status'] == 'todo' and s['title'] == 'Studio page' and s['priority'] == 'low' and len(cm) == 1, 'and touches nothing else but its reason: %r' % cm)
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
