#!/usr/bin/env python3
"""v33 test: the COO decides the same on the page and on the server.

The page's planner (M.coo.plan, src/js/10-coo.js) and the server's (plan in edgeone/server/coo.js) run one
battery on the same plain states from coo_world.py: the slots due at seven moments (a working morning, a
late noon, the close, a Sunday, a holiday, a Saturday, with some slots claimed), leaveCheck on eleven
requests (each check failing in turn, a null policy, a swap, a WFH day), balance, load, clientDated on
every task, the shortlist for each of Durvesh's tasks, planCover (plain and at both caps), planRebalance
(plain, one snapshot under, the overdue case), actKey and lint. Every answer must be identical, value for
value. M.SETTINGS_DEFAULTS.coo must equal COO_DEFAULTS too, so both builds read the same mandate.

Fails until builders 1 and 3 are merged; the message says which side is missing.

Run: cd m360-os && python3 harness/tests/test_coo_parity.py
"""
import copy
import json
import os
import subprocess
import sys
import tempfile
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness.lib import run  # noqa: E402
import coo_world as W  # noqa: E402
from coo_world import M1, M3, M4, M5, M6, ymd, ms  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COO_JS = os.path.join(ROOT, 'edgeone', 'server', 'coo.js')

# one battery, run as it is by both sides: plan is the planner, fx the fixtures
BATTERY = r'''(plan, fx) => {
  const out = {};
  const J = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
  const fresh = s => JSON.parse(JSON.stringify(s));
  out.slots = fx.slots.map(([c, now, done]) => J(plan.slotsDue(c, now, done)));
  out.leave = fx.leave.map(([s, uid, req]) => J(plan.leaveCheck(fresh(s), uid, req, s.now)));
  out.balance = fx.balance.map(([s, uid, type, ys]) => J(plan.balance(fresh(s), uid, type, ys)));
  out.load = fx.load.map(s => J(plan.load(fresh(s), s.today)));
  out.client = fx.client.map(s => Object.keys(s.tasks).sort().map(id => [id, plan.clientDated(fresh(s), {...s.tasks[id], id})]));
  out.short = fx.short.map(s => { const st = fresh(s); const ld = plan.load(st, st.today);
    return Object.keys(st.tasks).sort().map(id => [id, J(plan.shortlist(fresh(s), {...st.tasks[id], id}, ld, st.today))]); });
  out.cover = fx.cover.map(([s, uid, req]) => J(plan.planCover(fresh(s), uid, req)));
  out.rebalance = fx.rebalance.map(([s, prevUnder]) => { const st = fresh(s); const ld = plan.load(st, st.today);
    const prev = JSON.parse(JSON.stringify(ld)); if (prevUnder) prev[prevUnder].score = 1;
    return J(plan.planRebalance(fresh(s), ld, prev, st.today)); });
  out.keys = fx.keys.map(k => plan.actKey(k[0], k[1], k[2]));
  out.lint = fx.lint.map(t => J(plan.lint(t)));
  return out;
}'''

NODE = r'''
import {plan, COO_DEFAULTS} from %(coo)s;
const fx = JSON.parse(%(fx)s);
const battery = %(battery)s;
console.log(JSON.stringify({defaults: COO_DEFAULTS, out: battery(plan, fx)}));
'''


def fixtures(D):
    req = {'id': 'R9', 'from': ymd(7), 'to': ymd(7), 'type': 'casual', 'at': ms(9, 0)}
    slots = {'holidays': [], 'rollAt': ['10:45', '11:15'], 'eodCut': '19:30', 'memoDay': 'sat'}
    sun, sat = W.TUE + timedelta(days=5), W.TUE + timedelta(days=4)
    fx = {'slots': [
        [slots, ms(9, 20), {}], [slots, ms(12, 30), {}], [slots, ms(12, 30), {'brief': 1, 'r11': 1}], [slots, ms(21, 5), {}],
        [slots, ms(10, 0, base=sun), {}], [dict(slots, holidays=[W.TUE.isoformat()]), ms(21, 5), {}], [slots, ms(12, 30, base=sat), {}]]}
    leave = []
    base = W.state(D)
    leave.append([base, M1, req])
    leave.append([base, M1, dict(req, to=ymd(9))])
    leave.append([base, M5, req])
    leave.append([base, M1, dict(req, **{'from': ymd(1), 'to': ymd(1)})])
    st = W.state(D); W.approve(st, M3, 'A3', ymd(7), ymd(7)); W.approve(st, M4, 'A4', ymd(7), ymd(7)); leave.append([st, M1, req])
    st = W.state(D); W.ask(st, M3, 'P3', ymd(7), ymd(7), at=ms(8, 0)); W.approve(st, M4, 'A4', ymd(7), ymd(7)); leave.append([st, M1, req])
    st = W.state(D); st['cfg']['leave']['blackout'] = [ymd(7)]; leave.append([st, M1, req])
    st = W.state(D); st['tasks'] = {'tc': W.task(M1, due=ymd(7), client='cl_sw')}; leave.append([st, M1, req])
    st = W.state(D); st['cfg']['leave']['perType']['casual'] = None; leave.append([st, M1, req])
    leave.append([base, M1, dict(req, type='swap')])
    st = W.state(D); W.approve(st, 'u_m2', 'W2', ymd(7), ymd(7), typ='wfh'); leave.append([st, M1, dict(req, type='wfh')])
    fx['leave'] = leave
    st = W.state(D)
    W.approve(st, M1, 'May', '%d-05-05' % W.TUE.year, '%d-05-07' % W.TUE.year)
    W.approve(st, M1, 'Wf', ymd(-6), ymd(-5), typ='wfh')
    fx['balance'] = [[st, M1, 'casual', '04-01'], [st, M1, 'casual', '01-01'], [st, M1, 'sick', '04-01']]
    bw, cw = W.busy_world(D), W.cover_world(D)
    fx['load'] = [bw, cw]
    fx['client'] = [bw, cw]
    fx['short'] = [bw]
    rq = cw['leave'][M1][0]
    c1, c0 = copy.deepcopy(cw), copy.deepcopy(cw)
    c1['cfg']['limits']['movesPerPersonDay'] = 1
    c0['cfg']['limits'].update({'movesPerDay': 0, 'shiftsPerDay': 0})
    fx['cover'] = [[cw, M1, rq], [c1, M1, rq], [c0, M1, rq]]
    bo = copy.deepcopy(bw)
    for k in [k for k in bo['tasks'] if k.startswith('t_d')]:
        del bo['tasks'][k]
    bo['cfg']['load'].update({'maxOpen': 2, 'margin': 1.0})
    fx['rebalance'] = [[bw, None], [bw, M1], [bo, None]]
    fx['keys'] = [['move', 't1', '2026-W42'], ['leave', M1 + ':R9', ymd(0)], ['ask', M6, ymd(0) + ':r11']]
    fx['lint'] = ['Moved the reel cut from Riya to Arjun.', 'Done!', 'It is not late, but close.', 'A pause \u2014 then more.']
    return fx


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    page = h.open('founder', hash='#home', reset=True, seed=True, noai=True)
    if not page.evaluate('() => !!(window.M && M.coo && M.coo.plan && M.SETTINGS_DEFAULTS.coo)'):
        raise AssertionError('M.coo.plan is not on the page: this test runs once builder 1 (10-coo.js) is merged')
    if not os.path.exists(COO_JS):
        raise AssertionError('edgeone/server/coo.js is missing: this test runs once builder 3 is merged')
    D = page.evaluate('() => JSON.parse(JSON.stringify(M.SETTINGS_DEFAULTS.coo))')
    fx = fixtures(D)
    mine = page.evaluate('([b, fx]) => (0, eval)("(" + b + ")")(M.coo.plan, fx)', [BATTERY, fx])
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as f:
        f.write(NODE % {'coo': json.dumps('file://' + COO_JS), 'fx': json.dumps(json.dumps(fx)), 'battery': BATTERY})
        path = f.name
    try:
        r = subprocess.run(['node', path], capture_output=True, text=True, timeout=120, env={**os.environ, 'TZ': 'Asia/Kolkata'})
    finally:
        os.unlink(path)
    if r.returncode != 0:
        raise AssertionError('coo.js did not run in node: %s' % r.stderr[-800:])
    srv = json.loads(r.stdout.strip().splitlines()[-1])
    check(srv['defaults'] == D, 'SETTINGS_DEFAULTS.coo equals COO_DEFAULTS: %r' % {k: (D.get(k), srv['defaults'].get(k)) for k in set(D) | set(srv['defaults']) if D.get(k) != srv['defaults'].get(k)})
    theirs = srv['out']
    for k in ('slots', 'leave', 'balance', 'load', 'client', 'short', 'cover', 'rebalance', 'keys', 'lint'):
        a, b = mine.get(k), theirs.get(k)
        if a != b:
            i = next((i for i, (x, y) in enumerate(zip(a or [], b or [])) if x != y), None)
            raise AssertionError('%s differs at case %r:\npage   %s\nserver %s' % (k, i, json.dumps(a[i] if i is not None else a)[:900], json.dumps(b[i] if i is not None else b)[:900]))
        check(True, '%s: %d cases, the same on both sides' % (k, len(a)))
    # the battery says something: the fixtures do reach every branch the plan test covers
    check(any(x['run'] for x in mine['slots']) and any(x['skip'] for x in mine['slots']), 'slots run and skip in the battery')
    check(any(x['ok'] for x in mine['leave']) and any(not x['ok'] for x in mine['leave']), 'requests pass and fail in the battery')
    check(any(x['moves'] for x in mine['cover']) and any(x['moves'] for x in mine['rebalance']), 'moves are planned in the battery')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
