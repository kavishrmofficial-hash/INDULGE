#!/usr/bin/env python3
"""v33 test: the m360 COO's pass on the team site (edgeone/server/coo.js, spec parts B, C, E3 and I).

The real API function code runs in Node: createApp instances share one in-memory blob store, the way two
EdgeOne instances share the project's store. The clock is pinned (Date.now) to a working Tuesday next week in
IST, people sign in by sessions written straight into the store (no password anywhere), and Resend, Gmail and
the model are stand-ins that record what they were asked (the model answers the way edgeone/dev/server.mjs
does with MOCK_AI=1). Kaavish founds and owns; Aanya, Durvesh and Neel are in Pod 1, Ishaan and Ekta in Pod 2.
The COO is on, past its practice week, with the leave policy set (12 casual and 12 sick days, 2 alone,
notice 3, 2 out a day and 1 a pod). Each world marks the slots it is not about as already run.

Checks:
- two instances tick at once: one pass runs, the watch slot is claimed once (x/coo/<ymd>/w1100), and Ishaan's
  leave inside policy is approved once, by u_m360coo, with its checks, snap and undoUntil; Ekta's four days
  and Neel's swap become leave cards; nobody is ever declined; ticking again changes nothing;
- the tick answer is {ok, at, coo:{slot, state, acts, ms}} with no names; a body naming a slot is ignored;
- the bot's writes keep their versions under ~u_m360coo and their log lines under the bot;
- a late tick at 13:10 runs only what is still inside lateMax and the latest watch slot; the rest is marked
  skipped late;
- the time budget: a pass that runs past 22 seconds stops, leaves the slot running with a cursor, and the
  next tick finishes it with every approval made once;
- rebalance moves only movable internal work, logs why 'overload' under the bot with a comment; a
  client-dated due (dueKind client, or a client project) is never changed, and cover for approved leave
  turns a client-dated task into a card;
- books auto-chase mails the overdue invoice with the COO off and sends nothing while it is on; the reminder
  waits as the owner's draft in books/cooq;
- coosend is the owner's only, voids a stale reminder (the invoice was paid), refuses a card already sent,
  and sends a client follow-up from Kaavish's own Gmail once, logged as his;
- aiPerDay: the drafts take one model call while the day has budget and none once it is spent;
- the COO off, or env COO_OFF=1: no writes but the office's one 'off' line;
- the practice week: rows read 'would' and the leave stays pending;
- a refused write (the task turned client-dated between the plan and the write) stops the whole COO
  (coo/state.stuck), raises an urgent card, and the next tick acts on nothing;
- on edgeone/dev/server.mjs itself with MOCK_AI=1 and its clock pinned (/__clock): a tick at 12:00 runs r12,
  drafts the Swisse follow-up through one model call (/__ai), answers with no names, and a second tick that
  names a slot in its body runs nothing.

Fails until builder 3 (coo.js, its hooks in core.js and books.js) is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_coo_server.py
"""
import json
import os
import re
import socket
import subprocess
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CORE = os.path.join(ROOT, 'edgeone', 'server', 'core.js')
IST = ZoneInfo('Asia/Kolkata')

SCRIPT = r'''
import {createApp} from %(core)s;
const TODAY = %(today)s;
const DAY = 86400000;
const at = (h, m, d) => Date.parse(TODAY + 'T00:00:00Z') - 330 * 60000 + (h * 60 + m) * 60000 + (d || 0) * DAY;
const ymd = d => new Date(Date.parse(TODAY + 'T00:00:00Z') + d * DAY).toISOString().slice(0, 10);
let NOW = at(11, 0);
Date.now = () => NOW;
const fyOf = s => { const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)); const a = m >= 4 ? y : y - 1; return a + '-' + String((a + 1) %% 100).padStart(2, '0'); };

/* the slots of the day, as coo.js lists them for a 10:30 start with 15 minutes' grace */
const NAMED = [['open', 540], ['brief', 585], ['r10', 600], ['r11', 660], ['r12', 720], ['m1230', 750], ['r15', 900], ['r16', 960], ['r1730', 1050], ['close', 1260],
  ['roll1045', 645], ['roll1045b', 705], ['eod', 1170], ['memo', 720]];
for (let t = 540; t <= 1260; t += 15) NAMED.push(['w' + String(Math.floor(t / 60)).padStart(2, '0') + String(t %% 60).padStart(2, '0'), t]);

const lag = () => new Promise(r => setTimeout(r, 1));
const P = {u_f: 'Kaavish Ramchandani', u_a: 'Aanya Mehta', u_d: 'Durvesh Patil', u_n: 'Neel Kapoor', u_i: 'Ishaan Rao', u_e: 'Ekta Nair'};
const POLICY = {yearStart: '04-01', perType: {casual: 12, sick: 12, other: 5}, maxAutoDays: 2, noticeDays: {casual: 3, sick: 0, other: 7}, probationLop: false,
  maxOutPerDay: 2, maxOutPerPod: 1, blackout: []};

function world(o) {
  o = o || {};
  const data = new Map();
  const mails = [], gmail = [], ai = [];
  let slow = null;
  const store = {
    async get(key, x) { await lag(); if (!data.has(key)) return null; const v = data.get(key); return x && x.type === 'json' ? JSON.parse(v) : v; },
    async set(key, value) { await lag(); data.set(key, String(value)); if (slow && slow.test(key)) NOW += 6000; },
    async delete(key) { data.delete(key); },
    async list(x) { const p = (x && x.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '"' + data.get(k).length + '"'})), directories: []}; }
  };
  const ok = j => new Response(JSON.stringify(j), {status: 200, headers: {'content-type': 'application/json'}});
  const fetcher = async (url, init) => {
    const u = String(url);
    if (u.includes('api.resend.com')) { mails.push(JSON.parse(init.body)); return ok({id: 'm' + mails.length}); }
    if (u.includes('gmail.googleapis.com') && u.endsWith('/messages/send')) { gmail.push(JSON.parse(init.body)); return ok({id: 'g' + gmail.length, threadId: 't1'}); }
    if (u.includes('api.anthropic.com')) {
      const body = JSON.parse(init.body);
      ai.push(body.system.slice(0, 12));
      const text = String((body.messages[0] || {}).content || '');
      let list = [];
      try { list = JSON.parse(text.replace(/^DRAFTS:\n/, '')); } catch (e) { list = []; }
      return ok({content: [{type: 'text', text: JSON.stringify({drafts: list.map(d => ({id: d.id, text: 'Hi,\n\nA quick follow-up from Mask360. Happy to walk you through it this week, whenever suits you.\n\nKaavish'}))})}], stop_reason: 'end_turn'});
    }
    return new Response('', {status: 404});
  };
  globalThis.fetch = fetcher;
  /* stand-ins only: the store needs some value where a key would sit, and nothing here reaches a real service */
  const env = {fetch: fetcher, COO_SETTLE_MS: '5', PM_RECHECK_MS: '0', BOOKS_RECHECK_MS: '0', SITE_URL: 'https://m360.example.com', ANTHROPIC_API_KEY: 'standin', ...(o.env || {})};
  const apps = [createApp({store, env}), createApp({store, env})];
  const put = (k, v) => data.set(k, JSON.stringify(v));
  const doc = k => JSON.parse(data.get(k) || 'null');
  const d = path => doc('d/' + path.split('/').join('~'));
  const setDoc = (path, v) => put('d/' + path.split('/').join('~'), v);
  put('o/owner', {uid: 'u_f'});
  for (const u of Object.keys(P)) put('p/' + u, {name: P[u], email: u.slice(2) + '@example.com', at: NOW});
  const mem = (role, x) => ({role, active: true, joined: '2025-01-06', empId: 'M360-' + Math.random().toString().slice(2, 5), start: '', ...(x || {})});
  setDoc('roster/team', {members: {u_f: mem('founder', {empId: 'M360-001'}), u_a: mem('member', {pod: 'Pod 1'}), u_d: mem('member', {pod: 'Pod 1'}), u_n: mem('member', {pod: 'Pod 1'}),
    u_i: mem('member', {pod: 'Pod 2'}), u_e: mem('member', {pod: 'Pod 2'})}});
  const coo = {on: true, signedAt: at(9, 0, -20), signedBy: 'u_f', practiceUntil: null, pausedUntil: null, leave: POLICY, ...(o.coo || {})};
  setDoc('settings/app', {start: '10:30', grace: 15, eodCut: '19:30', holidays: [], rules: {}, pm: {on: false}, coo});
  put('x/mail', {key: 're_standin_for_tests', from: 'm360 <m360@example.com>'});
  const TOK = {};
  for (const u of Object.keys(P)) { TOK[u] = ('sess' + u.replace('_', '') + '0000000000000000').slice(0, 24); put('s/' + TOK[u], {uid: u, at: NOW, last: NOW}); }
  for (const u of Object.keys(P)) {
    setDoc('checkin/' + u, {days: {}}); setDoc('eod/' + u, {days: {}}); setDoc('me/' + u, {name: P[u]});
    setDoc('leave/' + u, {reqs: []}); setDoc('leavedec/' + u, {d: {}});
  }
  const call = async (i, who, body) => {
    const headers = {'content-type': 'application/json'};
    if (who) headers.cookie = 'm360s=' + TOK[who];
    const r = await apps[i](new Request('http://localhost/api/m360', {method: 'POST', headers, body: JSON.stringify(body)}));
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    return {status: r.status, body: j};
  };
  /* the slots this world is not about, marked as already run today */
  const settle = keep => {
    const mins = Math.floor(((NOW + 330 * 60000) %% DAY) / 60000);
    for (const [id, t] of NAMED) if (t <= mins && keep.indexOf(id) < 0) put('x/coo/' + TODAY + '/' + id, {state: 'done', at: NOW, acts: 0});
  };
  const keys = p => [...data.keys()].filter(k => k.startsWith(p)).sort();
  const rows = () => { const L = d('coo/L-' + TODAY); return L ? Object.keys(L.acts || {}).map(id => ({id, ...L.acts[id]})) : []; };
  const cards = () => { const c = d('coo/dec'); return c ? Object.keys(c.items || {}).map(id => ({id, ...c.items[id]})) : []; };
  return {data, mails, gmail, ai, put, doc, d, setDoc, call, settle, keys, rows, cards, slowOn: re => { slow = re; }};
}
const req = (id, from, to, type, atMs) => ({id, from, to, type: type || 'casual', at: atMs || at(9, 0, -2)});
const task = (owner, due, x) => ({title: 'Task', owner, by: 'u_f', due, status: 'todo', priority: 'normal', client: '', project: '', created: at(9, 0, -10), updated: at(9, 0, -10), ...(x || {})});
const brief = r => ({id: r.id, code: r.code, job: r.job, status: r.status, by: r.by, refs: r.refs, why: r.why && r.why.code, undo: !!r.undo});
const out = {today: TODAY};

/* ---------- A. two instances, one claim, one approval; the answer; the forged slot; history ---------- */
{
  NOW = at(11, 0);
  const w = world({});
  w.settle(['w1100']);
  w.setDoc('leave/u_i', {reqs: [req('R1', ymd(8), ymd(8))]});
  w.setDoc('leave/u_e', {reqs: [req('R2', ymd(9), ymd(12))]});
  w.setDoc('leave/u_n', {reqs: [req('R3', ymd(10), ymd(10), 'swap')]});
  const r = await Promise.all([w.call(0, null, {a: 'tick'}), w.call(1, null, {a: 'tick'})]);
  out.A = {ticks: r, slot: w.doc('x/coo/' + TODAY + '/w1100'), claims: w.keys('x/coo/' + TODAY + '/').filter(k => !/done/.test(w.data.get(k))),
    dec: {i: w.d('leavedec/u_i'), e: w.d('leavedec/u_e'), n: w.d('leavedec/u_n')}, rows: w.rows().map(brief), cards: w.cards().map(k => ({kind: k.kind, uid: (k.refs || {}).uid, status: k.status, by: k.by})),
    acts: w.keys('x/coo/acts/' + TODAY + '/').length};
  NOW = at(11, 1);
  const again = await Promise.all([w.call(0, null, {a: 'tick'}), w.call(1, null, {a: 'tick'})]);
  out.A.again = {ticks: again, rows: w.rows().length, dec: w.d('leavedec/u_i')};
  /* a forged slot: the body names the close, the server's own clock says 11:05 */
  NOW = at(11, 5);
  const forged = await w.call(0, null, {a: 'tick', slot: 'close', at: at(21, 0)});
  out.A.forged = {tick: forged, close: w.doc('x/coo/' + TODAY + '/close'), rows: w.rows().length};
  out.A.hist = w.keys('h/leavedec~u_i/');
  const log = w.doc('d/log~' + TODAY + '-u_m360coo');
  out.A.log = log ? Object.values(log.e || {}).map(x => x.s) : [];
  out.A.flog = Object.values((w.doc('d/log~' + TODAY + '-u_f') || {}).e || {}).map(x => x.s);
  out.A.declined = w.keys('d/leavedec~').filter(k => /declined/.test(w.data.get(k)));
}

/* ---------- B. a late tick runs the latest watch slot and what is still inside lateMax ---------- */
{
  NOW = at(13, 10);
  const w = world({});
  const r = await w.call(0, null, {a: 'tick'});
  const slots = {};
  for (const k of w.keys('x/coo/' + TODAY + '/')) slots[k.split('/').pop()] = w.doc(k).state;
  out.B = {tick: r, slots};
}

/* ---------- C. the time budget: a pass that runs long stops, keeps a cursor, and the next tick finishes ---------- */
{
  NOW = at(11, 0);
  const w = world({});
  w.settle(['w1100']);
  [['u_a', 7], ['u_d', 8], ['u_n', 9], ['u_i', 10], ['u_e', 11]].forEach(([u, n], i) => w.setDoc('leave/' + u, {reqs: [req('B' + i, ymd(n), ymd(n), 'casual', at(9, i, -2))]}));
  w.slowOn(/^d\/leavedec~/);
  const t1 = await w.call(0, null, {a: 'tick'});
  const s1 = w.doc('x/coo/' + TODAY + '/w1100');
  const n1 = ['u_a', 'u_d', 'u_n', 'u_i', 'u_e'].filter(u => Object.keys(w.d('leavedec/' + u).d || {}).length).length;
  NOW += 1000;
  const t2 = await w.call(0, null, {a: 'tick'});
  const s2 = w.doc('x/coo/' + TODAY + '/w1100');
  const dec = ['u_a', 'u_d', 'u_n', 'u_i', 'u_e'].map(u => Object.values(w.d('leavedec/' + u).d || {}).map(x => x.status + ':' + x.by));
  out.C = {t1, s1, n1, t2, s2, dec, rows: w.rows().filter(r => r.code === 'leave_ok').map(r => r.status + ':' + r.refs.uid)};
}

/* ---------- D. rebalance and cover: internal work only, never a client date ---------- */
{
  NOW = at(15, 0);
  const w = world({});
  w.settle(['r15', 'w1500']);
  w.setDoc('projects/p_int', {name: 'Studio site', kind: 'internal', owner: 'u_a', members: ['u_a', 'u_d', 'u_n', 'u_i', 'u_e'], due: ymd(30), status: 'on'});
  w.setDoc('projects/p_cl', {name: 'Swisse launch', kind: 'client', owner: 'u_d', members: ['u_d', 'u_a'], due: ymd(9), status: 'on'});
  const T = {};
  for (let i = 0; i < 9; i++) T['t_d' + i] = task('u_d', ymd(10 + i), {priority: i < 3 ? 'low' : 'normal', project: 'p_int', title: 'Studio page ' + i});
  T.t_over = task('u_d', ymd(-3), {project: 'p_int', title: 'Old banner'});
  T.t_cl = task('u_d', ymd(2), {priority: 'low', project: 'p_cl', title: 'Swisse reel'});
  T.t_kind = task('u_d', ymd(3), {priority: 'low', dueKind: 'client', title: 'Client deck'});
  T.t_a = task('u_a', ymd(5), {project: 'p_int', title: 'Aanya one'});
  T.t_n = task('u_n', ymd(6), {priority: 'low', project: 'p_int', title: 'Neel one'});
  T.t_e = task('u_e', ymd(6), {priority: 'low', project: 'p_int', title: 'Ekta one'});
  /* Ishaan is away tomorrow, approved by Kaavish: one internal task due then, one for a client */
  T.t_i1 = task('u_i', ymd(1), {priority: 'low', project: 'p_int', title: 'Studio footer'});
  T.t_i2 = task('u_i', ymd(1), {client: 'cl_sw', title: 'Swisse captions'});
  for (const id of Object.keys(T)) w.setDoc('tasks/' + id, T[id]);
  w.setDoc('leave/u_i', {reqs: [req('L9', ymd(1), ymd(1), 'casual', at(9, 0, -6))]});
  w.setDoc('leavedec/u_i', {d: {L9: {status: 'approved', at: at(10, 0, -5), by: 'u_f'}}});
  /* yesterday's snapshot: Durvesh was over the line then too */
  w.setDoc('coo/load-' + ymd(-1), {at: at(15, 0, -1), snap: {u_a: {score: 2}, u_d: {score: 30}, u_n: {score: 1}, u_i: {score: 4}, u_e: {score: 1}}});
  const r = await w.call(0, null, {a: 'tick'});
  const now = {};
  for (const id of Object.keys(T)) { const t = w.d('tasks/' + id); now[id] = {owner: t.owner, due: t.due, ownerLog: t.ownerLog || [], dueLog: t.dueLog || [], comments: Object.values(t.comments || {}), updatedBy: t.updatedBy || ''}; }
  out.D = {tick: r, before: T, now, rows: w.rows().map(brief), cards: w.cards().map(k => ({kind: k.kind, refs: k.refs, code: k.code, title: k.title}))};
}

/* ---------- E. the books: auto-chase sends with the COO off, nothing while it is on; the owner's draft ---------- */
async function books(on) {
  NOW = at(12, 0);
  const w = world({coo: {on}});
  w.settle(['r12']);
  w.setDoc('books/settings', {chase: {auto: true, days: '3,7,14', cc: ''}});
  w.setDoc('books/clients', {map: {cl_sw: {name: 'Swisse', contactEmail: 'ap@swisse.example'}}});
  const fy = fyOf(TODAY);
  w.setDoc('invoices/' + fy, {rows: {inv1: {no: 'SW-001', client: 'cl_sw', clientName: 'Swisse', status: 'sent', sentAt: at(10, 0, -40), date: ymd(-40), due: ymd(-10),
    gst: 'none', gstRate: 18, currency: 'INR', lines: [{desc: 'Retainer', qty: 1, rate: 100000}], payments: [], chased: [], tds: 0,
    billTo: {legalName: 'Swisse', contactEmail: 'ap@swisse.example', contactName: 'Omar Haddad'}}}});
  const r = await w.call(0, null, {a: 'tick'});
  const inv = w.d('invoices/' + fy).rows.inv1;
  const q = w.d('books/cooq');
  return {w, fy, tick: r, mails: w.mails.map(m => (m.to || [])[0]), chased: (inv.chased || []).length, cooq: q ? Object.keys(q.items || {}).map(id => ({id, ...q.items[id]})) : []};
}
{
  const off = await books(false);
  const on = await books(true);
  out.E = {off: {mails: off.mails, chased: off.chased, cooq: off.cooq.length}, on: {mails: on.mails, chased: on.chased, cooq: on.cooq.map(k => ({kind: k.kind, status: k.status, to: k.payload.draft.to, subject: k.payload.draft.subject}))}};

  /* ---------- F. coosend: the owner's, fresh, once ---------- */
  const w = on.w;
  const card = on.cooq[0];
  const F = {};
  F.member = await w.call(0, 'u_a', {a: 'coosend', id: card ? card.id : 'x'});
  /* the invoice is paid since the draft: the tap voids it */
  const docI = w.d('invoices/' + on.fy);
  docI.rows.inv1.payments = [{amount: 100000, date: ymd(0)}];
  w.setDoc('invoices/' + on.fy, docI);
  F.paid = await w.call(0, 'u_f', {a: 'coosend', id: card ? card.id : 'x'});
  F.paidCard = (w.d('books/cooq').items || {})[card ? card.id : 'x'] || null;
  F.paidMails = w.mails.filter(m => (m.to || [])[0] === 'ap@swisse.example').length;
  /* a client follow-up: sent from Kaavish's own Gmail, once */
  w.put('x/g/u_f', {refresh: 'standin', access: 'standin', exp: NOW + 3600000, email: 'kaavish@example.com', at: NOW});
  const draft = {to: 'priya@swisse.example', cc: '', subject: 'Following up on our proposal', text: 'Hi Priya,\n\nFollowing up on the proposal we sent. Would a short call this week work?\n\nKaavish'};
  const dec = w.d('coo/dec') || {items: {}};
  dec.items = {...(dec.items || {}), c_mail: {kind: 'client_mail', status: 'open', at: NOW - 3600000, by: 'u_m360coo', title: 'Drafted a follow-up to Swisse.', payload: {action: '', input: {}, draft}, refs: {}},
    c_sent: {kind: 'client_mail', status: 'done', at: NOW - 7200000, by: 'u_m360coo', title: 'Sent before.', payload: {action: '', input: {}, draft}, refs: {}}};
  w.setDoc('coo/dec', dec);
  F.sent = await w.call(0, 'u_f', {a: 'coosend', id: 'c_mail'});
  F.sentCard = (w.d('coo/dec').items || {}).c_mail;
  F.gmail = w.gmail.length;
  F.again = await w.call(0, 'u_f', {a: 'coosend', id: 'c_mail'});
  F.done = await w.call(0, 'u_f', {a: 'coosend', id: 'c_sent'});
  F.gmail2 = w.gmail.length;
  F.flog = Object.values((w.doc('d/log~' + TODAY + '-u_f') || {}).e || {}).map(x => x.s);
  F.botlog = Object.values((w.doc('d/log~' + TODAY + '-u_m360coo') || {}).e || {}).map(x => x.s);
  out.F = F;
}

/* ---------- G. aiPerDay: one model call with budget, none once it is spent ---------- */
async function drafts(spent) {
  NOW = at(12, 0);
  const w = world({coo: {limits: {aiPerDay: 3}}});
  w.settle(['r12']);
  w.setDoc('pitches/pt1', {name: 'Swisse launch', stage: 'proposal', stageAt: at(10, 0, -9), owner: 'u_d', client: ''});
  if (spent) w.put('n/ai/' + TODAY + '/u_m360coo', {n: 3, at: NOW - 60000});
  await w.call(0, null, {a: 'tick'});
  return {calls: w.ai.length, n: (w.doc('n/ai/' + TODAY + '/u_m360coo') || {}).n || 0, drafts: w.cards().filter(k => k.kind === 'client_mail').map(k => k.payload.draft.by)};
}
out.G = {fresh: await drafts(false), spent: await drafts(true)};

/* ---------- H. off, and env COO_OFF: no writes but the office's 'off' line ---------- */
async function quiet(o) {
  NOW = at(11, 0);
  const w = world(o);
  w.settle(['w1100']);
  w.setDoc('leave/u_i', {reqs: [req('R1', ymd(8), ymd(8))]});
  const before = new Set(w.data.keys());
  const r = await w.call(0, null, {a: 'tick'});
  const wrote = [...w.data.keys()].filter(k => !before.has(k) && !/^(x\/v\/|a\/|r\/|bk\/)/.test(k));
  return {tick: r, wrote, dec: w.d('leavedec/u_i'), live: w.d('office/live')};
}
out.H = {off: await quiet({coo: {on: false}}), env: await quiet({env: {COO_OFF: '1'}})};

/* ---------- I. the practice week: would, and nothing changes ---------- */
{
  NOW = at(11, 0);
  const w = world({coo: {practiceUntil: ymd(4)}});
  w.settle(['w1100']);
  w.setDoc('leave/u_i', {reqs: [req('R1', ymd(8), ymd(8))]});
  const r = await w.call(0, null, {a: 'tick'});
  out.I = {tick: r, rows: w.rows().map(brief), dec: w.d('leavedec/u_i'), chat: w.keys('d/chat~').length};
}

/* ---------- J. a refused write stops the COO ---------- */
{
  NOW = at(14, 50);
  const w = world({});
  w.settle([]);
  w.setDoc('projects/p_int', {name: 'Studio site', kind: 'internal', owner: 'u_a', members: ['u_a', 'u_d', 'u_n'], due: ymd(30), status: 'on'});
  const T = {};
  for (let i = 0; i < 12; i++) T['t_d' + i] = task('u_d', ymd(10 + i), {priority: i < 3 ? 'low' : 'normal', project: 'p_int', title: 'Studio page ' + i});
  T.t_a = task('u_a', ymd(5), {project: 'p_int', title: 'Aanya one'});
  T.t_n = task('u_n', ymd(6), {priority: 'low', project: 'p_int', title: 'Neel one'});
  for (const [u, n] of [['u_i', 'i'], ['u_e', 'e']]) { T['t_' + n + '1'] = task(u, ymd(12), {title: 'Pod 2 one'}); T['t_' + n + '2'] = task(u, ymd(13), {title: 'Pod 2 two'}); }
  for (const id of Object.keys(T)) w.setDoc('tasks/' + id, T[id]);
  w.setDoc('coo/load-' + ymd(-1), {at: at(15, 0, -1), snap: {u_a: {score: 2}, u_d: {score: 30}, u_n: {score: 0}, u_i: {score: 0}, u_e: {score: 0}}});
  w.put('x/v/tasks', {ids: {}, gone: {}, v: 1});
  /* a quiet round at 14:50 reads the work; then Kaavish marks Durvesh's quick ones as client dates and the
     COO's copy has not caught up when it plans at 15:00 */
  const warm = await w.call(0, null, {a: 'tick'});
  for (let i = 0; i < 3; i++) { const t = w.d('tasks/t_d' + i); t.dueKind = 'client'; w.setDoc('tasks/t_d' + i, t); }
  NOW = at(15, 0);
  w.data.delete('x/coo/' + TODAY + '/r15');
  const r = await w.call(0, null, {a: 'tick'});
  const rows1 = w.rows().map(brief);
  const state = w.d('coo/state');
  const tasks = [0, 1, 2].map(i => { const t = w.d('tasks/t_d' + i); return t.owner + ':' + t.due + ':' + (t.ownerLog || []).length; });
  NOW = at(15, 16);
  const next = await w.call(0, null, {a: 'tick'});
  out.J = {warm, tick: r, rows: rows1, stuck: state && state.stuck, cards: w.cards().filter(k => k.kind === 'info').map(k => ({code: k.code, urgent: k.urgent})),
    tasks, next, rows2: w.rows().length, live: w.d('office/live')};
}
console.log(JSON.stringify(out));
'''

def dev_server(day):
    """the stand-in EdgeOne server, MOCK_AI=1, its clock pinned to 12:00 IST on the Tuesday"""
    def at(h, m, d=0):
        return int((datetime(day.year, day.month, day.day, h, m, tzinfo=IST) + timedelta(days=d)).timestamp() * 1000)
    today = day.isoformat()
    now = at(12, 0)
    dk = lambda path: 'd/' + path.replace('/', '~')
    people = {'u_f': 'Kaavish Ramchandani', 'u_a': 'Aanya Mehta', 'u_d': 'Durvesh Patil'}
    data = {'o/owner': {'uid': 'u_f'}}
    for u, n in people.items():
        data['p/' + u] = {'name': n, 'email': u[2:] + '@example.com', 'at': now}
    data[dk('roster/team')] = {'members': {u: {'role': 'founder' if u == 'u_f' else 'member', 'active': True, 'joined': '2025-01-06', 'pod': 'Pod 1', 'start': ''} for u in people}}
    data[dk('settings/app')] = {'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'holidays': [], 'rules': {}, 'pm': {'on': False},
                                'coo': {'on': True, 'signedAt': at(9, 0, -20), 'signedBy': 'u_f', 'practiceUntil': None}}
    data[dk('pitches/pt1')] = {'name': 'Swisse launch', 'stage': 'proposal', 'stageAt': at(10, 0, -9), 'owner': 'u_d', 'client': ''}
    slots = ['open', 'brief', 'r10', 'r11', 'roll1045', 'roll1045b', 'memo'] + ['w%02d%02d' % divmod(t, 60) for t in range(540, 721, 15)]
    for sl in slots:
        data['x/coo/%s/%s' % (today, sl)] = {'state': 'done', 'at': now, 'acts': 0}
    store = tempfile.mktemp(suffix='.json')
    with open(store, 'w', encoding='utf-8') as f:
        json.dump({k: json.dumps(v) for k, v in data.items()}, f)
    sk = socket.socket()
    sk.bind(('', 0))
    port = sk.getsockname()[1]
    sk.close()
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1', COO_SETTLE_MS='5'),
                           stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://127.0.0.1:%d' % port
    get = lambda p: json.loads(urllib.request.urlopen(base + p, timeout=30).read().decode())

    def tick(body):
        r = urllib.request.Request(base + '/api/m360', data=json.dumps(body).encode(), headers={'content-type': 'application/json'}, method='POST')
        return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())
    try:
        for _ in range(100):
            try:
                get('/__clock?at=%d' % now)
                break
            except Exception:
                time.sleep(0.1)
        first = tick({'a': 'tick'})
        st = get('/__store')
        cards = list((json.loads(st.get(dk('coo/dec'), 'null') or 'null') or {}).get('items', {}).values())
        ai = get('/__ai')
        get('/__clock?at=%d' % (now + 60000))
        second = tick({'a': 'tick', 'slot': 'close'})
        st2 = get('/__store')
        get('/__clock?off=1')
        return {'first': first, 'second': second, 'r12': json.loads(st.get('x/coo/%s/r12' % today, 'null')), 'close': st2.get('x/coo/%s/close' % today),
                'cards': [(c.get('kind'), ((c.get('payload') or {}).get('draft') or {}).get('by')) for c in cards], 'ai': ai,
                'rows': len((json.loads(st2.get(dk('coo/L-' + today), 'null') or 'null') or {}).get('acts', {})),
                'rows1': len((json.loads(st.get(dk('coo/L-' + today), 'null') or 'null') or {}).get('acts', {}))}
    finally:
        srv.terminate()
        srv.wait(timeout=10)


NAMES = re.compile(r'Kaavish|Aanya|Durvesh|Neel|Ishaan|Ekta|u_[a-z]\b|u_m360coo', re.I)


def main():
    if not os.path.exists(os.path.join(ROOT, 'edgeone', 'server', 'coo.js')):
        raise AssertionError('edgeone/server/coo.js is not here: this test runs once builder 3 (the server pass) is merged')
    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'coo_server.mjs')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SCRIPT % {'core': json.dumps('file://' + CORE), 'today': json.dumps(tue.isoformat())})
    p = subprocess.run(['node', path], capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        print(p.stdout[-3000:], p.stderr[-3000:])
        raise SystemExit('node failed')
    out = json.loads(p.stdout.strip().splitlines()[-1])
    if os.environ.get('COO_DEBUG'):
        print(json.dumps(out, indent=1)[:20000])
    today = out['today']
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    # ---- A ----
    A = out['A']
    states = sorted((t['body'].get('coo') or {}).get('state', '') for t in A['ticks'])
    check(all(t['status'] == 200 and t['body'].get('ok') is True for t in A['ticks']) and 'busy' in states, 'two ticks at once: both answer ok, one pass runs: %r' % A['ticks'])
    check(A['slot'] and A['slot'].get('state') == 'done', 'the watch slot is claimed and settled once: %r' % A['slot'])
    ok_rows = [r for r in A['rows'] if r['code'] == 'leave_ok' and r['status'] == 'done' and not r['refs'].get('card')]
    check(len(ok_rows) == 1 and ok_rows[0]['refs']['uid'] == 'u_i' and ok_rows[0]['undo'], 'one approval, for Ishaan, with undo: %r' % A['rows'])
    e = (A['dec']['i'].get('d') or {}).get('R1') or {}
    check(e.get('status') == 'approved' and e.get('by') == 'u_m360coo' and e.get('snap', {}).get('from') == e.get('snap', {}).get('to') and e.get('snap', {}).get('type') == 'casual'
          and e.get('snap', {}).get('days') == 1 and isinstance(e.get('undoUntil'), int) and e['undoUntil'] > 0 and any(c.get('k') == 'notice' for c in e.get('checks', [])),
          'Ishaan\'s leave is approved by u_m360coo with its checks, snap and undoUntil: %r' % e)
    check(not (A['dec']['e'].get('d') or {}) and not (A['dec']['n'].get('d') or {}), 'outside policy is never decided by the COO: %r' % [A['dec']['e'], A['dec']['n']])
    lc = sorted(k['uid'] for k in A['cards'] if k['kind'] == 'leave' and k['status'] == 'open')
    check(lc == ['u_e', 'u_n'], 'four days and a swap become leave cards for Kaavish: %r' % A['cards'])
    check(not A['declined'], 'nobody is declined: %r' % A['declined'])
    check(A['again']['rows'] == len(A['rows']) and A['again']['dec'] == A['dec']['i'], 'ticking again changes nothing: %r' % A['again'])
    answers = A['ticks'] + A['again']['ticks'] + [A['forged']['tick']]
    for t in answers:
        b = t['body']
        check(set(b) <= {'ok', 'at', 'coo'} and set(b.get('coo') or {}) <= {'slot', 'state', 'acts', 'ms'}, 'the tick answer keeps its shape: %r' % b)
    check(not NAMES.search(json.dumps([t['body'] for t in answers])), 'the tick answer carries no names: %r' % [t['body'] for t in answers])
    check(A['forged']['close'] is None and A['forged']['rows'] == len(A['rows']) and (A['forged']['tick']['body'].get('coo') or {}).get('slot', '') == '',
          'a body naming the close is ignored; the server\'s own clock says nothing is due: %r' % A['forged'])
    check(A['hist'] and all(k.endswith('~u_m360coo') for k in A['hist']), 'the history keys read ~u_m360coo: %r' % A['hist'])
    check(any(re.match(r'coo J10 ', s) for s in A['log']) and not any('coo' in s for s in A['flog']), 'the log line is under the bot, never Kaavish: %r' % [A['log'], A['flog']])

    # ---- B ----
    B = out['B']['slots']
    ran = sorted(k for k, v in B.items() if v != 'skipped')
    late = sorted(k for k, v in B.items() if v == 'skipped')
    check([k for k in ran if k.startswith('w')] == ['w1300'], 'a late tick runs only the latest watch slot: %r' % B)
    check(set(ran) == {'r12', 'm1230', 'roll1045b', 'w1300'}, 'and the named slots still inside lateMax: %r' % B)
    check(set(late) >= {'open', 'brief', 'r10', 'r11', 'roll1045'}, 'the ones past lateMax are marked skipped late: %r' % B)

    # ---- C ----
    C = out['C']
    check(C['s1'] and C['s1'].get('state') == 'running' and 'cursor' in C['s1'] and 0 < C['n1'] < 5, 'the budget stops the pass with a cursor: %r' % [C['s1'], C['n1'], C['t1']])
    check(C['s2'] and C['s2'].get('state') == 'done' and all(x == ['approved:u_m360coo'] for x in C['dec']), 'the next tick finishes it: %r' % [C['s2'], C['dec']])
    check(sorted(C['rows']) == sorted(set(C['rows'])) and len([r for r in C['rows'] if r.startswith('done:')]) == 5, 'every approval made once: %r' % C['rows'])

    # ---- D ----
    D = out['D']
    moved = {k: v for k, v in D['now'].items() if v['owner'] != D['before'][k]['owner'] or v['due'] != D['before'][k]['due']}
    rb = [r for r in D['rows'] if r['code'] == 'rebalance' and r['status'] == 'done']
    check(rb and all(r['refs']['task'] in moved for r in rb), 'rebalance moved work: %r' % [rb, list(moved)])
    for r in rb:
        t = D['before'][r['refs']['task']]
        n = D['now'][r['refs']['task']]
        check(t['project'] == 'p_int' and not t['client'] and t.get('dueKind') != 'client', 'only internal work moves: %r' % r)
        lg = n['ownerLog'][-1]
        check(lg['by'] == 'u_m360coo' and lg['why'] == 'overload' and n['updatedBy'] == 'u_m360coo' and any(c['by'] == 'u_m360coo' for c in n['comments']),
              'the move is logged under the bot with why overload and a comment: %r' % n)
    for k in ('t_cl', 't_kind', 't_i2'):
        check(D['now'][k]['owner'] == D['before'][k]['owner'] and D['now'][k]['due'] == D['before'][k]['due'] and not D['now'][k]['dueLog'] and not D['now'][k]['ownerLog'],
              'a client-dated task never moves: %s %r' % (k, D['now'][k]))
    check(any((c['refs'] or {}).get('task') == 't_i2' for c in D['cards']), 'cover turns the client-dated task into a card for Kaavish: %r' % D['cards'])
    check(D['now']['t_i1']['owner'] != 'u_i' or D['now']['t_i1']['due'] != D['before']['t_i1']['due'], 'the internal task Ishaan leaves is covered: %r' % D['now']['t_i1'])

    # ---- E ----
    E = out['E']
    check(E['off']['mails'] == ['ap@swisse.example'] and E['off']['chased'] == 1, 'with the COO off, auto-chase mails the overdue invoice: %r' % E['off'])
    check('ap@swisse.example' not in E['on']['mails'] and E['on']['chased'] == 0, 'with the COO on, auto-chase sends nothing: %r' % E['on'])
    check(len(E['on']['cooq']) == 1 and E['on']['cooq'][0]['kind'] == 'invoice_reminder' and E['on']['cooq'][0]['status'] == 'open' and E['on']['cooq'][0]['to'] == 'ap@swisse.example',
          'the reminder waits as the owner\'s draft: %r' % E['on'])

    # ---- F ----
    F = out['F']
    check(F['member']['status'] == 403, 'coosend is the owner\'s only: %r' % F['member'])
    check(F['paid']['status'] == 200 and F['paid']['body'].get('ok') is False and 'paid' in F['paid']['body'].get('say', '') and F['paidCard']['status'] == 'void' and F['paidMails'] == 0,
          'a stale reminder is voided at the tap, and nothing goes: %r' % [F['paid'], F['paidCard']])
    check(F['sent']['status'] == 200 and F['sent']['body'].get('ok') is True and F['gmail'] == 1 and F['sentCard']['status'] == 'done' and F['sentCard'].get('decidedVia') == 'coosend',
          'the follow-up goes from Kaavish\'s Gmail and the card is done: %r' % [F['sent'], F['sentCard']])
    check(F['again']['status'] == 409 and F['done']['status'] == 409 and F['gmail2'] == 1, 'a sent card is refused, nothing goes twice: %r' % [F['again'], F['done']])
    check(any(s.startswith('sent coo draft c_mail') for s in F['flog']) and not any('sent coo draft' in s for s in F['botlog']), 'the send is logged as Kaavish\'s: %r' % F['flog'])

    # ---- G ----
    G = out['G']
    check(G['fresh']['calls'] == 1 and G['fresh']['n'] == 1 and G['fresh']['drafts'] == ['ai'], 'with budget, one model call rewords the draft: %r' % G['fresh'])
    check(G['spent']['calls'] == 0 and G['spent']['n'] == 3 and G['spent']['drafts'] == ['template'], 'aiPerDay spent: no model call, the template stands: %r' % G['spent'])

    # ---- H ----
    for k, H in out['H'].items():
        check(not (H['dec'].get('d') or {}), 'COO %s: the leave stays pending: %r' % (k, H['dec']))
        check(not [x for x in H['wrote'] if x not in ('d/office~live', 'd/coo~now')], 'COO %s: no writes but the quiet live feed: %r' % (k, H['wrote']))
        check((H['live'] or {}).get('state') == 'off', 'COO %s: the office says off: %r' % (k, H['live']))

    # ---- I ----
    I = out['I']
    w = [r for r in I['rows'] if r['code'] == 'leave_ok']
    check(w and all(r['status'] == 'would' for r in w) and not (I['dec'].get('d') or {}) and I['chat'] == 0, 'practice: rows read would, nothing changes, nobody is told: %r' % I)
    check((I['tick']['body'].get('coo') or {}).get('state') == 'practice', 'the tick says practice: %r' % I['tick'])

    # ---- J ----
    J = out['J']
    check(any(r['status'] == 'refused' for r in J['rows']), 'the write is refused and the row says so: %r' % J['rows'])
    check(J['stuck'] and J['stuck'].get('why'), 'a refused write stops the COO (coo/state.stuck): %r' % J['stuck'])
    check(any(c['code'] == 'refused' and c['urgent'] for c in J['cards']), 'and Kaavish hears at once: %r' % J['cards'])
    check(all(t.endswith(':0') and t.startswith('u_d:') for t in J['tasks']), 'the client dates stay: %r' % J['tasks'])
    check((J['next']['body'].get('coo') or {}).get('state') == 'stuck' and J['rows2'] == len(J['rows']), 'the next tick acts on nothing: %r' % [J['next'], J['rows2']])

    # ---- K: the dev server itself ----
    K = dev_server(tue)
    check(K['first'].get('ok') is True and (K['first'].get('coo') or {}).get('slot') == 'r12' and not NAMES.search(json.dumps(K['first'])),
          'on the dev server a tick at 12:00 runs r12 and answers with no names: %r' % K['first'])
    check(K['r12'] and K['r12'].get('state') == 'done', 'and claims it: %r' % K['r12'])
    check(('client_mail', 'ai') in K['cards'] and len([x for x in K['ai'] if 'COO DRAFTS' in json.dumps(x)]) == 1, 'the follow-up is drafted through MOCK_AI: %r' % [K['cards'], len(K['ai'])])
    check((K['second'].get('coo') or {}).get('slot', '') == '' and K['close'] is None and K['rows'] == K['rows1'], 'a second tick naming the close runs nothing: %r' % K['second'])
    return checks


if __name__ == '__main__':
    out = main()
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
