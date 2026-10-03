#!/usr/bin/env python3
"""v32 test: the page's nudge engine (M.pm, src/js/09-pm.js) and the team site's mail pass
(edgeone/server/pm.js) derive the same items, with the same keys and the same s1 times.

One fixture on a working Tuesday: m1 reports to Kaavish by fallback, m2 to m1, m3 to m2 with his own
11:00 start. m2 is in at 10:30, m3 is not in; m2 owes an overdue task and has one chased by m1 at 12:00;
m3 owes an overdue task and one m2 sent back at 11:00; a done task that was overdue counts for nothing.
Kaavish has five asks out: a check-out ask to m2 and m3 at 19:50, a custom ask to m3 at 12:10, a task ask
to m2 at 13:00, an overdue ask to m3 at 11:20 and a check-in ask to m3 at 11:05. The bots are on.

At 11:30 and at 20:00 the page's M.pm.items(ctx, rep, {now}) and pm.js items(state, rep, now) are read for
m1, m2 and m3. Every step 1 and every ask step (K#1, K#a.<askId>) for noin, noeod, overdue, sentback,
chase and the asks the server judges must carry the same id and the same time on both sides. The fixture
is written once into the page's store and read back from it, so both sides see the same documents.

Fails until builder 1's M.pm is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_pm_parity.py
"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
PM_JS = os.path.join(ROOT, 'edgeone', 'server', 'pm.js')
KINDS = ('noin', 'noeod', 'overdue', 'sentback', 'chase')
ASKS = ('noin', 'noout', 'noeod', 'overdue', 'task', 'custom')

NODE = r'''
import {items} from %(pm)s;
const {state, reps, times, kinds, asks} = JSON.parse(%(fixture)s);
const out = {};
for (const now of times) {
  out[now] = {};
  for (const rep of reps) out[now][rep] = items(state, rep, now)
    .filter(it => it.source === 'ask' ? asks.includes(it.kind) : kinds.includes(it.kind))
    .map(it => [it.id, it.s1]).sort();
}
console.log(JSON.stringify(out));
'''

PAGE = r'''([reps, times, kinds, asks]) => {
  if (!window.M || !M.pm || typeof M.pm.items !== 'function') return {missing: true};
  const ctx = M.lastCtx, out = {};
  for (const now of times) {
    out[now] = {};
    for (const rep of reps) {
      const rows = [];
      for (const it of M.pm.items(ctx, rep, {now}) || []) {
        const ask = it.source === 'ask' || !!it.askId;
        if (ask ? !asks.includes(it.kind) : !kinds.includes(it.kind)) continue;
        for (const s of it.steps || []) {
          const st = String(s.step);
          if (st === '1' || st.indexOf('a.') === 0) rows.push([s.id || (it.K + '#' + st), s.at]);
        }
      }
      out[now][rep] = rows.sort();
    }
  }
  return out;
}'''


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()

    def ms(hh, mm, day=0):
        return int((datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)).timestamp() * 1000)

    def ymd(day):
        return (tue + timedelta(days=day)).isoformat()

    ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(ctx)
    ctx.clock.set_fixed_time(datetime(tue.year, tue.month, tue.day, 20, 0, tzinfo=IST))
    pg = ctx.new_page()
    pg.set_default_timeout(15000)
    pg.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    pg.goto(h.url('founder', '#home', reset=True, seed=True))
    h.ready(pg)
    pg.wait_for_function('() => !!window.__db.get("roster/team")')
    pg.wait_for_timeout(300)
    h.roster(pg, [M1, M2, M3], extra={M1: {'pod': ''}, M2: {'pod': '', 'reportsTo': M1}, M3: {'pod': '', 'reportsTo': M2, 'start': '11:00'}})
    settings = pg.evaluate('() => window.__db.get("settings/app")') or {}
    settings = dict(settings, pm=dict(settings.get('pm') or {}, on=True), holidays=[], rules={})
    docs = {
        'settings/app': settings,
        'checkin/' + F: {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office'}}},
        'checkin/' + M1: {'days': {today: {'in': ms(10, 20), 'out': None, 'mode': 'office'}}},
        'checkin/' + M2: {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'office'}}},
        'checkin/' + M3: {'days': {}},
        'eod/' + F: {'days': {today: {'shipped': 'Plans', 'next': 'Reviews', 'at': ms(18, 0)}}},
        'eod/' + M1: {'days': {today: {'shipped': 'Decks', 'next': 'Shoot', 'at': ms(18, 30)}}},
        'eod/' + M2: {'days': {}},
        'eod/' + M3: {'days': {}},
        'tasks/t1': {'title': 'Swisse reel cutdown', 'owner': M3, 'by': M2, 'status': 'doing', 'due': ymd(-2), 'created': ms(10, 0, -6), 'updated': ms(12, 0, -3)},
        'tasks/t2': {'title': 'Nykaa carousel copy', 'owner': M2, 'by': M1, 'status': 'todo', 'due': ymd(-1), 'created': ms(10, 0, -6), 'updated': ms(12, 0, -3)},
        'tasks/t3': {'title': 'Tanishq pitch deck', 'owner': M3, 'by': M2, 'status': 'doing', 'due': ymd(1), 'created': ms(10, 0, -4),
                     'updated': ms(11, 0), 'sentBackAt': ms(11, 0), 'sentBackBy': M2, 'sentBackNote': 'Tighten the open'},
        'tasks/t4': {'title': 'Hero reel script', 'owner': M2, 'by': M1, 'status': 'todo', 'due': ymd(1), 'created': ms(10, 0, -2), 'updated': ms(10, 0, -2)},
        'tasks/t5': {'title': 'Old moodboard', 'owner': M3, 'by': M2, 'status': 'done', 'due': ymd(-3), 'created': ms(10, 0, -8), 'updated': ms(10, 0, -2), 'doneAt': ms(10, 0, -2)},
        'me/' + M1: {'name': 'Durvesh Patil', 'pm': {'chase': {'t4': {'rep': M2, 'at': ms(12, 0)}}}},
        'me/' + M2: {'name': 'Aanya Mehta'},
        'me/' + M3: {'name': 'Ishaan Rao'},
        'me/' + F: {'name': 'Kaavish Ramchandani', 'pm': {'asks': {
            'a1': {'kind': 'noout', 'to': [M2, M3], 'ask': 'why', 'at': ms(19, 50), 'via': 'voice'},
            'a2': {'kind': 'custom', 'to': [M3], 'ask': 'why', 'at': ms(12, 10), 'via': 'typed'},
            'a3': {'kind': 'task', 'sub': 't4', 'to': [M2], 'ask': 'eta', 'at': ms(13, 0), 'via': 'grammar'},
            'a4': {'kind': 'overdue', 'sub': 't1', 'to': [M3], 'ask': 'eta', 'at': ms(11, 20), 'via': 'voice'},
            'a5': {'kind': 'noin', 'to': [M3], 'ask': 'why', 'at': ms(11, 5), 'via': 'button'}}}},
    }
    for path, d in docs.items():
        pg.evaluate('([p, d]) => window.__db.set(p, d)', [path, d])
    for c in ('leave', 'leavedec'):
        for u in (F, M1, M2, M3):
            pg.evaluate('p => window.__db.del(p)', c + '/' + u)
    # the open above carried reset and seed: come back without them, so the store stays as written
    pg.goto(h.url('founder', '#people'))
    h.ready(pg)
    pg.wait_for_timeout(1500)

    # both sides read the same documents: read them back from the page's store
    back = pg.evaluate('''() => {
      const get = p => window.__db.get(p);
      return {roster: get('roster/team'), settings: get('settings/app')};
    }''')
    state = {'members': back['roster']['members'], 'founderUid': F, 'settings': back['settings'],
             'me': {}, 'checkin': {}, 'eod': {}, 'tasks': {}, 'leave': {}, 'leavedec': {}}
    for path in docs:
        coll, did = path.split('/')
        if coll in state:
            state[coll][did] = pg.evaluate('p => window.__db.get(p)', path)
    times = [ms(11, 30), ms(20, 0)]
    reps = [M1, M2, M3]
    fixture = json.dumps({'state': state, 'reps': reps, 'times': times, 'kinds': list(KINDS), 'asks': list(ASKS)})
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'pm_parity.mjs')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(NODE % {'pm': json.dumps('file://' + PM_JS), 'fixture': json.dumps(fixture)})
    p = subprocess.run(['node', path], capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        print(p.stdout[-2000:], p.stderr[-2000:])
        raise SystemExit('node failed')
    srv = json.loads(p.stdout.strip().splitlines()[-1])

    # the server side on its own: the fixture says what it should say
    def ids(now, rep):
        return [x[0] for x in srv[str(now)][rep]]
    at = {x[0]: x[1] for now in times for rep in reps for x in srv[str(now)][rep]}
    K = lambda rep, kind, sub='-': '%s:%s:%s:%s' % (rep, kind, sub, today)  # noqa: E731
    m = ids(times[0], M3)
    check(K(M3, 'noin') + '#1' in m and at[K(M3, 'noin') + '#1'] == ms(11, 15), 'server: m3 noin at his own start plus grace: %r' % m)
    check(K(M3, 'overdue', 't1') + '#1' in m and at[K(M3, 'overdue', 't1') + '#1'] == ms(11, 45), 'server: overdue at start plus grace plus 30: %r' % m)
    check(K(M3, 'overdue', 't1') + '#a.a4' in m and K(M3, 'noin') + '#a.a5' in m and K(M3, 'custom', 'a2') + '#a.a2' not in m, 'server: asks show from their time: %r' % m)
    check(not any(':t5:' in x for x in m), 'server: a done task is never overdue: %r' % m)
    e2, e3 = ids(times[1], M2), ids(times[1], M3)
    check(K(M2, 'noeod') + '#1' in e2 and at[K(M2, 'noeod') + '#1'] == ms(19, 30), 'server: noeod at the cut: %r' % e2)
    check(K(M2, 'chase', 't4') + '#1' in e2 and at[K(M2, 'chase', 't4') + '#1'] == ms(12, 5), 'server: chase five minutes after the ask: %r' % e2)
    check(K(M2, 'noout') + '#a.a1' in e2 and K(M3, 'noout') + '#a.a1' not in e3, 'server: a check-out ask holds only for who is checked in: %r %r' % (e2, e3))
    check(K(M3, 'sentback', 't3') + '#1' in e3 and at[K(M3, 'sentback', 't3') + '#1'] == ms(15, 0), 'server: sent back plus four hours: %r' % e3)
    check(K(M2, 'task', 't4') + '#a.a3' in e2 and K(M3, 'custom', 'a2') + '#a.a2' in e3, 'server: task and custom asks: %r %r' % (e2, e3))
    check(ids(times[1], M1) == [], 'server: m1, in and posted, has nothing: %r' % ids(times[1], M1))

    page = pg.evaluate(PAGE, [reps, times, list(KINDS), list(ASKS)])
    if page.get('missing'):
        raise AssertionError('M.pm.items is not in this build (builder 1, src/js/09-pm.js). The server expects: %s' % json.dumps(srv, indent=1))
    for now in times:
        for rep in reps:
            a = [list(x) for x in page[str(now)][rep]]
            b = [list(x) for x in srv[str(now)][rep]]
            only_page = [x for x in a if x not in b]
            only_srv = [x for x in b if x not in a]
            check(not only_page and not only_srv, 'parity for %s at %s: page only %r, server only %r' % (rep, datetime.fromtimestamp(now / 1000, IST).strftime('%H:%M'), only_page, only_srv))
    errs = [e for e in h.errors() if 'pageerror' in e[0]]
    check(not errs, 'no page errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
