#!/usr/bin/env python3
"""v30 test: activity stamps on the standalone server.

The real API function code (edgeone/server/core.js, with the safety module's version history) runs in
Node against an in-memory blob store; two people are signed in by sessions written straight into the
store, so no password is involved. Checks: a stamp-only update of me/<self> (one five-minute bucket on
today, plus nulls for old days) stores the bucket and adds no history version and no log line; act with
another field, a bad bucket key, a value of 2, two buckets at once, a day far off, a bucket an hour ahead
or behind the IST clock, a null on a recent day, or a stamp written with set all take the normal path,
logged and backed up; a stamp on someone else's profile is refused for a member, and the founder's goes
the normal way; a real write is still logged. The pulse mark (data/users/<uid>/state {pulse}) keeps no
log line and no version, so nothing dated sits next to an anonymous answer; any other write there is
logged as ever.

Run: cd m360-os && python3 harness/tests/test_quiet_server.py
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CORE = os.path.join(ROOT, 'edgeone', 'server', 'core.js')

SCRIPT = r'''
import {createApp} from %(core)s;
const data = new Map();
const store = {
  async get(key, opts) { if (!data.has(key)) return null; const v = data.get(key); return opts && opts.type === 'json' ? JSON.parse(v) : v; },
  async set(key, value) { data.set(key, String(value)); },
  async delete(key) { data.delete(key); },
  async list(opts) { const p = (opts && opts.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '"' + data.get(k).length + '"'})), directories: []}; }
};
/* nothing leaves this process */
const offline = async () => new Response('', {status: 404});
globalThis.fetch = offline;
const app = createApp({store, env: {fetch: offline}});

const now = Date.now();
const ymdIST = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
/* the five-minute bucket that holds a moment on the IST clock, as the page writes it: [day, HHMM] */
const bk = ms => { const d = new Date(ms + 330 * 60000); return [ymdIST(ms), String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes() - d.getUTCMinutes() %% 5).padStart(2, '0')]; };
const today = ymdIST(now), old = ymdIST(now - 20 * 86400000), far = ymdIST(now - 40 * 86400000), recent = ymdIST(now - 2 * 86400000);
const [, B] = bk(now), [pd, PB] = bk(now - 5 * 60000), [ad, AB] = bk(now + 60 * 60000), [bd, BB] = bk(now - 60 * 60000);
const put = (k, v) => data.set(k, JSON.stringify(v));
const TOK = {f: 'sessfounder0000000001', a: 'sessmembera0000000001', c: 'sessmemberc0000000001'};
put('o/owner', {uid: 'u_f'});
for (const [u, n] of [['u_f', 'Kaavish'], ['u_a', 'Durvesh'], ['u_b', 'Aanya'], ['u_c', 'Ishaan']]) put('p/' + u, {name: n, email: u + '@example.com', at: now});
put('d/roster~team', {members: {u_f: {role: 'founder', active: true}, u_a: {role: 'member', active: true}, u_b: {role: 'member', active: true}, u_c: {role: 'member', active: true}}});
put('d/me~u_a', {name: 'Durvesh', act: {[old]: {'1100': 1}}});
put('d/me~u_b', {name: 'Aanya'});
put('s/' + TOK.f, {uid: 'u_f', at: now, last: now});
put('s/' + TOK.a, {uid: 'u_a', at: now, last: now});
put('s/' + TOK.c, {uid: 'u_c', at: now, last: now});

const call = async (who, body) => {
  const r = await app(new Request('http://localhost/api/m360', {method: 'POST', headers: {'content-type': 'application/json', cookie: 'm360s=' + TOK[who]}, body: JSON.stringify(body)}));
  return {status: r.status, body: await r.json()};
};
const hist = uid => [...data.keys()].filter(k => k.startsWith('h/me~' + uid + '/')).length;
const logs = (uid, p) => { const d = JSON.parse(data.get('d/log~' + today + '-' + uid) || '{"e":{}}'); return Object.values(d.e).filter(x => !p || x.p === p).length; };
const doc = k => JSON.parse(data.get(k) || 'null');
const snap = (uid, p) => ({hist: hist(uid), logs: logs(uid, p)});
const out = {today, B};
/* a version is keyed by its millisecond: writes here are spaced so two never share one */
const write = async (who, op, path, d) => { await new Promise(r => setTimeout(r, 3)); return call(who, {a: 'write', op, path, data: d}); };

/* the once-a-day upkeep runs on the first call; get it out of the way */
await call('a', {a: 'snapshot'});

/* 1. a stamp-only update: stored, no version, no log line; old days drop with it */
let before = snap('u_a', 'me/u_a');
let r = await write('a', 'update', 'me/u_a', {act: {[today]: {[B]: 1}, [old]: null}});
let after = snap('u_a', 'me/u_a');
out.stamp = {status: r.status, bucket: ((doc('d/me~u_a').act || {})[today] || {})[B], old: old in (doc('d/me~u_a').act || {}), name: doc('d/me~u_a').name, hist: after.hist - before.hist, logs: after.logs - before.logs};
before = after;
/* a focus mark on the bucket before: a device clock a little behind still counts as a stamp */
r = await write('a', 'update', 'me/u_a', {act: {[pd]: {[PB]: 0}}});
after = snap('u_a', 'me/u_a');
out.focus = {status: r.status, now: ((doc('d/me~u_a').act || {})[today] || {})[B], prev: ((doc('d/me~u_a').act || {})[pd] || {})[PB], hist: after.hist - before.hist, logs: after.logs - before.logs};

/* 2. act with another field: the normal path */
before = after;
r = await write('a', 'update', 'me/u_a', {act: {[today]: {'1050': 1}}, status: {text: 'At the shoot', at: now}});
after = snap('u_a', 'me/u_a');
out.mixed = {status: r.status, bucket: doc('d/me~u_a').act[today]['1050'], hist: after.hist - before.hist, logs: after.logs - before.logs};

/* 3. malformed stamps: each saved, each logged and backed up. Each one sits on the current bucket
   unless its fault is the time, so it is refused for the reason it names */
const bad = {
  minute: {act: {[today]: {[B.slice(0, 3) + '7']: 1}}},
  value2: {act: {[today]: {[B]: 2}}},
  twobuckets: {act: {[today]: {[B]: 1, [B === '0000' ? '0005' : '0000']: 1}}},
  extrakey: {act: {[today]: {[B]: 1}}, x: 1},
  badday: {act: {'2026-1-1': {[B]: 1}}},
  farday: {act: {[far]: {[B]: 1}}},
  ahead: {act: {[ad]: {[AB]: 1}}},
  behind: {act: {[bd]: {[BB]: 1}}},
  recentnull: {act: {[today]: {[B]: 1}, [recent]: null}},
  twodays: {act: {[today]: {[B]: 1}, [old]: {[B]: 1}}},
  nullsonly: {act: {[old]: null}},
  notobject: {act: {[today]: 1}}
};
out.bad = {};
for (const k of Object.keys(bad)) {
  before = snap('u_a', 'me/u_a');
  r = await write('a', 'update', 'me/u_a', bad[k]);
  after = snap('u_a', 'me/u_a');
  out.bad[k] = {status: r.status, hist: after.hist - before.hist, logs: after.logs - before.logs};
}

/* 4. someone else's profile: refused for a member, the normal path for the founder */
r = await write('a', 'update', 'me/u_b', {act: {[today]: {[B]: 1}}});
out.other = {status: r.status, code: (r.body.error || {}).code, act: doc('d/me~u_b').act || null};
before = {hist: hist('u_b'), logs: logs('u_f', 'me/u_b')};
r = await write('f', 'update', 'me/u_b', {act: {[today]: {[B]: 1}}});
out.founder = {status: r.status, hist: hist('u_b') - before.hist, logs: logs('u_f', 'me/u_b') - before.logs, logsB: logs('u_b')};

/* 5. the first stamp on a profile that does not exist yet: set, the normal path */
r = await write('c', 'update', 'me/u_c', {act: {[today]: {[B]: 1}}});
out.missing = {status: r.status, code: (r.body.error || {}).code};
r = await write('c', 'set', 'me/u_c', {act: {[today]: {[B]: 1}}});
out.created = {status: r.status, bucket: ((doc('d/me~u_c') || {}).act || {})[today], logs: logs('u_c', 'me/u_c')};

/* 6. a real write is logged as ever */
before = logs('u_a', 'tasks/t1');
r = await write('a', 'set', 'tasks/t1', {title: 'Cut the teaser', owner: 'u_a', by: 'u_a', status: 'todo', created: now, updated: now});
out.task = {status: r.status, logs: logs('u_a', 'tasks/t1') - before};

/* 7. the pulse: the answer and the private mark that follows it leave no line and no version; any other
   write to the same private document is logged as ever */
const SP = 'data/users/u_a/state', stHist = () => [...data.keys()].filter(k => k.startsWith('h/data~users~u_a~state/')).length;
await write('a', 'set', SP, {tour: {done: now}});
before = {hist: stHist(), logs: logs('u_a')};
r = await write('a', 'set', 'pulse/p1', {at: Date.now(), week: '2026-W40', energy: 4, working: '', broken: '', change: ''});
const r2 = await write('a', 'update', SP, {pulse: {'2026-W40': true}});
out.pulse = {status: [r.status, r2.status], mark: (doc('d/data~users~u_a~state') || {}).pulse || null, hist: stHist() - before.hist, logs: logs('u_a') - before.logs};
before = {hist: stHist(), logs: logs('u_a', SP)};
r = await write('a', 'update', SP, {chatRead: {general: now}});
out.state = {status: r.status, hist: stHist() - before.hist, logs: logs('u_a', SP) - before.logs};
console.log(JSON.stringify(out));
'''


def main():
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'quiet_server.mjs')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SCRIPT % {'core': json.dumps('file://' + CORE)})
    p = subprocess.run(['node', path], capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        print(p.stdout[-2000:], p.stderr[-2000:])
        raise SystemExit('node failed')
    out = json.loads(p.stdout.strip().splitlines()[-1])
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    s = out['stamp']
    check(s['status'] == 200 and s['bucket'] == 1 and s['name'] == 'Durvesh', 'a stamp is stored on the profile: %r' % s)
    check(not s['old'], 'the old day goes with the stamp: %r' % s)
    check(s['hist'] == 0 and s['logs'] == 0, 'a stamp keeps no version and no log line: %r' % s)
    f = out['focus']
    check(f['status'] == 200 and f['now'] == 1 and f['prev'] == 0 and f['hist'] == 0 and f['logs'] == 0, 'a focus mark on the bucket before is a stamp too: %r' % f)
    m = out['mixed']
    check(m['status'] == 200 and m['bucket'] == 1 and m['hist'] == 1 and m['logs'] == 1, 'act with another field is logged and backed up: %r' % m)
    check(len(out['bad']) == 12, 'every malformed stamp ran: %r' % sorted(out['bad']))
    for k, v in out['bad'].items():
        check(v['status'] == 200 and v['hist'] == 1 and v['logs'] == 1, 'a malformed stamp (%s) takes the normal path: %r' % (k, v))
    o = out['other']
    check(o['status'] == 403 and o['act'] is None, 'a stamp on someone else is refused: %r' % o)
    fo = out['founder']
    check(fo['status'] == 200 and fo['hist'] == 1 and fo['logs'] == 1 and fo['logsB'] == 0, 'the founder writing another profile goes the normal way: %r' % fo)
    check(out['missing']['status'] == 400 and out['missing']['code'] == 'invalid_argument', 'an update on a missing profile is refused: %r' % out['missing'])
    c = out['created']
    check(c['status'] == 200 and c['bucket'] == {out['B']: 1} and c['logs'] == 1, 'the first stamp creates the profile, logged: %r' % c)
    check(out['task']['status'] == 200 and out['task']['logs'] == 1, 'a real write is logged: %r' % out['task'])
    pu = out['pulse']
    check(pu['status'] == [200, 200] and pu['mark'] == {'2026-W40': True}, 'the pulse and its mark are saved: %r' % pu)
    check(pu['hist'] == 0 and pu['logs'] == 0, 'neither the pulse nor its mark leaves a line or a version: %r' % pu)
    st = out['state']
    check(st['status'] == 200 and st['hist'] == 1 and st['logs'] == 1, 'another write to the private state is logged and backed up: %r' % st)
    return checks


if __name__ == '__main__':
    out = main()
    print('%d checks' % len(out))
    print('PASS')
