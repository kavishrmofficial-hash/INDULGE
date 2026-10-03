#!/usr/bin/env python3
"""v32 test: the personal managers' mail pass on the standalone server (edgeone/server/pm.js).

The real API function code runs in Node: two createApp instances share one in-memory blob store, the way
two EdgeOne instances share the project's store. The clock is pinned (Date.now) to a working Tuesday in
IST, people sign in by sessions written straight into the store (no password anywhere), and Resend is a
stand-in that records each mail. Aanya reports to Kaavish; Ishaan, Prathna, Rohan, Ekta, Sana and Vir report
to Aanya; Neel's manager Maya switched her bot's mail off; Lata is on approved leave.

Checks:
- at 11:40 both instances tick at once: Ishaan (no check-in, away, s1 10:45) gets exactly one mail, claimed
  in x/pm/<ymd>/u_i/am and marked sent; ticking again sends nothing more;
- a present person (beacon 30 s old) and one who saved 10 minutes ago are not mailed; an answer on K, a told
  mark on the step, mail switched off by the person, a manager's cfg.mail off and approved leave each stop it;
- the words: the subject and body from spec Part E, the site link, no dashes or exclamation marks;
- tick needs no sign-in and runs the pass: at 20:00 a signed-out tick sends Ishaan's evening mail (the EOD
  line, not the check-in again), and Aanya's one 'esc' mail for the step 2 items nobody answered; a later
  tick sends no third mail to Ishaan and no second 'esc';
- pmmail is scoped: Ishaan sees his own rows, Aanya sees her reports' and her own, Kaavish sees all, Prathna
  sees only hers; pmstatus is the founder's only and counts the mails;
- no mail and no claim without mail set up, or with settings.pm.mail off; with the bots off (pm.on false)
  nothing automatic goes, and a voice ask still mails ("Kaavish asked about your check-out");
- a told-only write of me/<self> keeps no version and no log line; a write mixing told with an answer, a
  told value that is not a time, and the founder writing someone else's told marks keep both.

Run: cd m360-os && python3 harness/tests/test_pm_server.py
"""
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CORE = os.path.join(ROOT, 'edgeone', 'server', 'core.js')
IST = ZoneInfo('Asia/Kolkata')

SCRIPT = r'''
import {createApp} from %(core)s;
const TODAY = %(today)s;
const at = (h, m) => Date.parse(TODAY + 'T00:00:00Z') - 330 * 60000 + (h * 60 + m) * 60000;
let NOW = at(11, 40);
Date.now = () => NOW;

/* one world: a store, two instances on it, and the mail the stand-in Resend took */
function world(opts) {
  const data = new Map();
  const sent = [];
  const store = {
    async get(key, o) { if (!data.has(key)) return null; const v = data.get(key); return o && o.type === 'json' ? JSON.parse(v) : v; },
    async set(key, value) { data.set(key, String(value)); },
    async delete(key) { data.delete(key); },
    async list(o) { const p = (o && o.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '"' + data.get(k).length + '"'})), directories: []}; }
  };
  const fetcher = async (url, init) => {
    if (String(url).includes('api.resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({id: 'm' + sent.length}), {status: 200, headers: {'content-type': 'application/json'}}); }
    return new Response('', {status: 404});
  };
  globalThis.fetch = fetcher;
  const env = {fetch: fetcher, PM_RECHECK_MS: '0', SITE_URL: 'https://m360.example.com'};
  const apps = [createApp({store, env}), createApp({store, env})];
  const put = (k, v) => data.set(k, JSON.stringify(v));
  const doc = k => JSON.parse(data.get(k) || 'null');
  const P = {u_f: 'Kaavish Ramchandani', u_a: 'Aanya Mehta', u_i: 'Ishaan Rao', u_p: 'Prathna Shah', u_r: 'Rohan Iyer', u_e: 'Ekta Nair',
    u_s: 'Sana Khan', u_v: 'Vir Das', u_m: 'Maya Joshi', u_n: 'Neel Kapoor', u_l: 'Lata Menon'};
  put('o/owner', {uid: 'u_f'});
  for (const u of Object.keys(P)) put('p/' + u, {name: P[u], email: u.slice(2) + '@example.com', at: NOW});
  const mem = (role, extra) => ({role, active: true, joined: '2025-01-06', empId: 'M360-' + Math.random().toString().slice(2, 5), pod: '', start: '', ...(extra || {})});
  put('d/roster~team', {members: {
    u_f: mem('founder', {empId: 'M360-001'}), u_a: mem('member'), u_m: mem('member'),
    u_i: mem('member', {reportsTo: 'u_a'}), u_p: mem('member', {reportsTo: 'u_a'}), u_r: mem('member', {reportsTo: 'u_a'}),
    u_e: mem('member', {reportsTo: 'u_a'}), u_s: mem('member', {reportsTo: 'u_a'}), u_v: mem('member', {reportsTo: 'u_a'}),
    u_n: mem('member', {reportsTo: 'u_m'}), u_l: mem('member', {reportsTo: 'u_a'})}});
  const pm = {on: true, mail: true, ...(opts.pm || {})};
  put('d/settings~app', {start: '10:30', grace: 15, eodCut: '19:30', holidays: [], rules: {}, pm});
  if (opts.mail !== false) put('x/mail', {key: 're_standin_for_tests', from: 'm360 <m360@example.com>'});
  const TOK = {};
  for (const u of Object.keys(P)) { TOK[u] = ('sess' + u.replace('_', '') + '0000000000000000').slice(0, 24); put('s/' + TOK[u], {uid: u, at: NOW, last: NOW}); }
  for (const u of Object.keys(P)) { put('d/checkin~' + u, {days: {}}); put('d/eod~' + u, {days: {}}); put('d/me~' + u, {name: P[u]}); }
  const call = async (i, who, body) => {
    const headers = {'content-type': 'application/json'};
    if (who) headers.cookie = 'm360s=' + TOK[who];
    const r = await apps[i](new Request('http://localhost/api/m360', {method: 'POST', headers, body: JSON.stringify(body)}));
    return {status: r.status, body: await r.json()};
  };
  return {data, sent, put, doc, call, TOK};
}
const to = (sent, u) => sent.filter(m => (m.to || [])[0] === u.slice(2) + '@example.com');
const ledger = data => [...data.keys()].filter(k => k.startsWith('x/pm/' + TODAY + '/')).sort();
const out = {today: TODAY};
const K = (u, kind, sub) => u + ':' + kind + ':' + (sub || '-') + ':' + TODAY;

/* ---------- A. the morning: who is mailed, and only once across two instances ---------- */
{
  const w = world({});
  const {put} = w;
  /* Prathna is on m360 right now; Rohan saved something ten minutes ago */
  put('r/u_p~' + (NOW - 30000) + '~home', '');
  const bk = ms => { const d = new Date(ms + 330 * 60000); return String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes() - d.getUTCMinutes() %% 5).padStart(2, '0'); };
  put('d/me~u_r', {name: 'Rohan Iyer', act: {[TODAY]: {[bk(NOW - 10 * 60000)]: 1}}});
  /* Ekta answered on K; Sana's step was shown on her phone; Vir switched his mail off */
  put('d/me~u_e', {name: 'Ekta Nair', pm: {ack: {[K('u_e', 'noin')]: {at: at(10, 50), how: 'onit', eta: at(12, 0)}}}});
  put('d/me~u_s', {name: 'Sana Khan', pm: {told: {[K('u_s', 'noin') + '#1']: at(10, 46)}}});
  put('d/me~u_v', {name: 'Vir Das', pm: {mail: false}});
  /* Maya's bot does not email her team; Lata is on approved leave */
  put('d/me~u_m', {name: 'Maya Joshi', pm: {cfg: {mail: false}}});
  put('d/leave~u_l', {reqs: [{id: 'L1', from: TODAY, to: TODAY, kind: 'casual'}]});
  put('d/leavedec~u_l', {d: {L1: {status: 'approved', by: 'u_f'}}});
  /* everyone else checked in except the people the bot chases */
  for (const u of ['u_f', 'u_a', 'u_m']) {
    put('d/checkin~' + u, {days: {[TODAY]: {in: at(10, 20), out: null, mode: 'office'}}});
    put('d/eod~' + u, {days: {[TODAY]: {shipped: 'Decks', next: 'Shoot', at: at(18, 0)}}});
  }

  /* both instances look at the same moment */
  const r = await Promise.all([w.call(0, null, {a: 'tick'}), w.call(1, null, {a: 'tick'})]);
  out.tick = r.map(x => [x.status, x.body]);
  out.morning = {
    ishaan: to(w.sent, 'u_i').length, prathna: to(w.sent, 'u_p').length, rohan: to(w.sent, 'u_r').length, ekta: to(w.sent, 'u_e').length,
    sana: to(w.sent, 'u_s').length, vir: to(w.sent, 'u_v').length, neel: to(w.sent, 'u_n').length, lata: to(w.sent, 'u_l').length,
    aanya: to(w.sent, 'u_a').length, total: w.sent.length, ledger: ledger(w.data)
  };
  const row = w.doc('x/pm/' + TODAY + '/u_i/am');
  out.row = row && {to: row.to, slot: row.slot, keys: row.keys, steps: row.steps, sent: !!row.sent};
  const m = to(w.sent, 'u_i')[0] || {};
  out.mail = {subject: m.subject, text: m.text, html: m.html || ''};
  /* again, on both: nothing new */
  NOW = at(11, 55);
  put('r/u_p~' + (NOW - 20000) + '~home', '');
  await Promise.all([w.call(0, 'u_f', {a: 'snapshot'}), w.call(1, null, {a: 'tick'})]);
  out.again = w.sent.length;

  /* ---------- B. the evening: tick signed out, the second slot, the manager's one mail ---------- */
  NOW = at(20, 0);
  put('d/checkin~u_a', {days: {[TODAY]: {in: at(10, 20), out: at(18, 0), mode: 'office'}}});
  const t = await w.call(1, null, {a: 'tick'});
  out.evening = {status: t.status, body: t.body, ishaan: to(w.sent, 'u_i').map(x => x.subject), ishaanText: (to(w.sent, 'u_i')[1] || {}).text || '',
    aanya: to(w.sent, 'u_a').map(x => x.subject), aanyaText: (to(w.sent, 'u_a')[0] || {}).text || '', aanyaHtml: (to(w.sent, 'u_a')[0] || {}).html || '', ledger: ledger(w.data)};
  const esc = w.doc('x/pm/' + TODAY + '/u_a/esc');
  out.esc = esc && {keys: esc.keys, steps: esc.steps, sent: !!esc.sent};
  /* a new ask to Ishaan later: he already had his two mails today */
  NOW = at(20, 30);
  const askAt = at(20, 5);
  put('d/me~u_f', {name: 'Kaavish Ramchandani', pm: {asks: {k1: {kind: 'custom', to: ['u_i'], ask: 'why', at: askAt, via: 'voice'}}}});
  await Promise.all([w.call(0, null, {a: 'tick'}), w.call(1, null, {a: 'tick'})]);
  out.capped = {ishaan: to(w.sent, 'u_i').length, aanya: to(w.sent, 'u_a').length};

  /* ---------- C. who reads the ledger ---------- */
  const rows = async who => { const r = await w.call(0, who, {a: 'pmmail', ymd: TODAY}); return r.status === 200 ? r.body.rows.map(x => x.to + '/' + x.slot).sort() : r.status; };
  out.pmmail = {ishaan: await rows('u_i'), aanya: await rows('u_a'), founder: await rows('u_f'), prathna: await rows('u_p'), neel: await rows('u_n'),
    signedOut: (await w.call(0, null, {a: 'pmmail'})).status, bad: (await w.call(0, 'u_f', {a: 'pmmail', ymd: 'today'})).status};
  const st = await w.call(0, 'u_f', {a: 'pmstatus'});
  out.pmstatus = {founder: st.status, mails: st.body.mails, mail: st.body.mail, member: (await w.call(0, 'u_i', {a: 'pmstatus'})).status};

  /* ---------- D. told marks are bookkeeping ---------- */
  const hist = u => [...w.data.keys()].filter(k => k.startsWith('h/me~' + u + '/')).length;
  const logs = u => { const d = JSON.parse(w.data.get('d/log~' + TODAY + '-' + u) || '{"e":{}}'); return Object.values(d.e).filter(x => x.p === 'me/u_i').length; };
  const write = async (who, d, path) => { NOW += 7; return w.call(0, who, {a: 'write', op: 'update', path: path || 'me/u_i', data: d}); };
  let b = {h: hist('u_i'), l: logs('u_i')};
  let wr = await write('u_i', {pm: {told: {[K('u_i', 'noin') + '#1']: NOW, [K('u_i', 'old') + '#1']: null}}});
  out.told = {status: wr.status, kept: typeof ((w.doc('d/me~u_i').pm || {}).told || {})[K('u_i', 'noin') + '#1'] === 'number', hist: hist('u_i') - b.h, logs: logs('u_i') - b.l};
  b = {h: hist('u_i'), l: logs('u_i')};
  wr = await write('u_i', {pm: {told: {[K('u_i', 'noeod') + '#1']: NOW}, ack: {[K('u_i', 'noeod')]: {at: NOW, how: 'onit', eta: TODAY}}}});
  out.mixed = {status: wr.status, hist: hist('u_i') - b.h, logs: logs('u_i') - b.l};
  b = {h: hist('u_i'), l: logs('u_i')};
  wr = await write('u_i', {pm: {told: {x: 'soon'}}});
  out.text = {status: wr.status, hist: hist('u_i') - b.h, logs: logs('u_i') - b.l};
  b = {h: hist('u_i'), l: logs('u_f')};
  wr = await write('u_f', {pm: {told: {y: NOW}}});
  out.other = {status: wr.status, hist: hist('u_i') - b.h, logs: logs('u_f') - b.l};
  wr = await write('u_i', {pm: {told: {}}});
  out.empty = {status: wr.status};
}

/* ---------- E. no mail set up, mail off, bots off ---------- */
for (const [name, opts] of [['nomail', {mail: false}], ['mailoff', {pm: {mail: false}}]]) {
  NOW = at(11, 40);
  const w = world(opts);
  await w.call(0, null, {a: 'tick'});
  out[name] = {sent: w.sent.length, ledger: ledger(w.data)};
}
{
  NOW = at(20, 30);
  const w = world({pm: {on: false}});
  w.put('d/checkin~u_i', {days: {[TODAY]: {in: at(10, 8), out: null, mode: 'office'}}});
  w.put('d/me~u_f', {name: 'Kaavish Ramchandani', pm: {asks: {a1: {kind: 'noout', to: ['u_i', 'u_p'], ask: 'why', at: at(20, 10), via: 'voice'}}}});
  await w.call(0, null, {a: 'tick'});
  const m = to(w.sent, 'u_i')[0] || {};
  out.botsOff = {sent: w.sent.map(x => x.to[0]).sort(), subject: m.subject || '', text: m.text || '', html: m.html || '', ledger: ledger(w.data)};
}
console.log(JSON.stringify(out));
'''


def main():
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'pm_server.mjs')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SCRIPT % {'core': json.dumps('file://' + CORE), 'today': json.dumps(tue.isoformat())})
    p = subprocess.run(['node', path], capture_output=True, text=True, timeout=180)
    if p.returncode != 0:
        print(p.stdout[-3000:], p.stderr[-3000:])
        raise SystemExit('node failed')
    out = json.loads(p.stdout.strip().splitlines()[-1])
    today = out['today']
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    check(all(s == 200 and b == {'ok': True} for s, b in out['tick']), 'tick answers ok with no sign-in: %r' % out['tick'])
    mo = out['morning']
    check(mo['ishaan'] == 1, 'Ishaan, away with no check-in, gets exactly one mail across two instances: %r' % mo)
    check(mo['prathna'] == 0, 'someone on m360 right now is not mailed: %r' % mo)
    check(mo['rohan'] == 0, 'someone who saved ten minutes ago is not mailed: %r' % mo)
    check(mo['ekta'] == 0, 'an answer on K stops the mail: %r' % mo)
    check(mo['sana'] == 0, 'a step already shown (told) is not mailed: %r' % mo)
    check(mo['vir'] == 0, 'mail switched off by the person stops it: %r' % mo)
    check(mo['neel'] == 0, "a manager's cfg.mail off stops mail to their team: %r" % mo)
    check(mo['lata'] == 0, 'approved leave stops it: %r' % mo)
    check(mo['aanya'] == 0, 'no step 2 mail before the wait has passed: %r' % mo)
    check('x/pm/%s/u_i/am' % today in mo['ledger'], 'the mail is claimed in the ledger: %r' % mo['ledger'])
    check(not any('/u_p/' in k or '/u_e/' in k or '/u_v/' in k for k in mo['ledger']), 'nothing is claimed for people not mailed: %r' % mo['ledger'])
    r = out['row']
    check(r and r['to'] == 'u_i' and r['slot'] == 'am' and r['sent'] and r['keys'] == ['u_i:noin:-:' + today] and r['steps'] == ['u_i:noin:-:%s#1' % today],
          'the ledger row carries the keys and step ids the page uses: %r' % r)
    m = out['mail']
    check(m['subject'] == "1 thing from Aanya's bot", 'the subject: %r' % m['subject'])
    check(m['text'].startswith("Hi Ishaan, Aanya's bot in m360 has 1 thing for you today.") and '1. No check-in yet. Your day started at 10:30.' in m['text'],
          'the body opens with the line from spec Part E: %r' % m['text'])
    check('https://m360.example.com/#home' in m['text'] and 'Aanya reads your answers there.' in m['text'] and 'at most twice a day' in m['text'] and 'Turn it off under Me.' in m['text'],
          'the body links home and says how often it mails: %r' % m['text'])
    for s in (m['subject'], m['text']):
        check(not re.search('[–—!]', s), 'no dashes or exclamation marks in the mail: %r' % s)
    check(out['again'] == mo['total'], 'ticking again sends nothing new: %r vs %r' % (out['again'], mo['total']))

    ev = out['evening']
    check(ev['status'] == 200 and ev['body'] == {'ok': True}, 'a signed-out tick runs the pass: %r' % ev)
    check(len(ev['ishaan']) == 2 and 'x/pm/%s/u_i/pm' % today in ev['ledger'], 'the evening slot sends Ishaan a second mail: %r' % ev)
    check("EOD line is not in" in ev['ishaanText'] and 'No check-in yet' not in ev['ishaanText'], 'the evening mail carries the EOD line and not the check-in again: %r' % ev['ishaanText'])
    check(len(ev['aanya']) == 1 and ev['aanya'][0].startswith('Your bot: ') and ev['aanya'][0].endswith('it could not settle'), "Aanya's one 'esc' mail: %r" % ev['aanya'])
    check('No check-in from Ishaan since the 10:30 start. The nudge has not been seen yet.' in ev['aanyaText'] and 'No check-in from Sana since the 10:30 start. Nudged at 10:46.' in ev['aanyaText'] and 'Ekta said 12:00 for the check-in. It is 20:00 and there is no check-in yet.' in ev['aanyaText'], 'the manager mail names the report and the start: %r' % ev['aanyaText'])
    e = out['esc']
    check(e and e['sent'] and 'u_i:noin:-:%s#2' % today in e['steps'] and 'u_e:noin:-:%s#2b' % today in e['steps'],
          'the esc row holds step 2 for Ishaan and 2b for Ekta, whose time passed: %r' % e)
    check('u_s:noin:-:%s#2' % today in e['steps'], 'a step shown to the report still reaches the manager when unanswered: %r' % e)
    check(not any(s.startswith('u_n:') for s in e['steps']), "another manager's report is not in Aanya's mail: %r" % e)
    check(out['capped'] == {'ishaan': 2, 'aanya': 1}, 'at most two mails a person a day and one esc: %r' % out['capped'])

    pm = out['pmmail']
    check(pm['ishaan'] == ['u_i/am', 'u_i/pm'], 'Ishaan reads his own rows: %r' % pm)
    check('u_a/esc' in pm['aanya'] and 'u_i/am' in pm['aanya'] and all(x.split('/')[0] in ('u_a', 'u_i', 'u_p', 'u_r', 'u_e', 'u_s', 'u_v', 'u_l') for x in pm['aanya']),
          "Aanya reads her own and her reports' rows: %r" % pm)
    check(set(pm['founder']) >= set(pm['aanya']) and len(pm['founder']) >= len(pm['aanya']), 'Kaavish reads every row: %r' % pm)
    check(all(x.startswith('u_p/') for x in pm['prathna']) and all(x.startswith('u_n/') for x in pm['neel']), 'a report sees only their own rows: %r' % pm)
    check(pm['signedOut'] == 401 and pm['bad'] == 400, 'pmmail needs a sign-in and a day: %r' % pm)
    st = out['pmstatus']
    check(st['founder'] == 200 and st['mails'] == len(pm['founder']) and st['mail'] is True and st['member'] == 403, 'pmstatus is the founder\'s and counts the mails: %r' % st)

    t = out['told']
    check(t['status'] == 200 and t['kept'] and t['hist'] == 0 and t['logs'] == 0, 'a told-only write keeps no version and no log line: %r' % t)
    for k in ('mixed', 'text'):
        check(out[k]['status'] == 200 and out[k]['hist'] == 1 and out[k]['logs'] == 1, 'a %s write goes the normal way: %r' % (k, out[k]))
    check(out['other']['status'] == 200 and out['other']['hist'] == 1 and out['other']['logs'] == 1, "the founder writing someone else's told marks goes the normal way: %r" % out['other'])
    check(out['empty']['status'] == 200, 'an empty told map is still a fine write: %r' % out['empty'])

    check(out['nomail'] == {'sent': 0, 'ledger': []}, 'no mail and no claim without mail set up: %r' % out['nomail'])
    check(out['mailoff'] == {'sent': 0, 'ledger': []}, 'no mail and no claim with pm.mail off: %r' % out['mailoff'])
    bo = out['botsOff']
    check(bo['sent'] == ['i@example.com'], 'with the bots off only the ask goes, and only to who is still checked in: %r' % bo)
    check(bo['subject'] == 'Kaavish asked about your check-out', 'the ask subject: %r' % bo)
    check('Kaavish asked m360 to check with you, 20:10.' in bo['text'] and 'You are still checked in from 10:08.' in bo['text'], 'the ask lines: %r' % bo['text'])
    return checks


if __name__ == '__main__':
    out = main()
    print('%d checks' % len(out))
    print('PASS')
