/* The 100-person office: a full working day squeezed into a few minutes against the real server code.
   Starts its own local server (in memory, canned AI, a store that answers as slowly as the edge's), then
   1 founder, 4 admins and 95 staff sign up and work at once: check in, post, chat, react, run tasks, log
   talks, move proposals, ask the AI, search, set status and emotes, request leave. The founder approves,
   runs the books and the bank statement. Every page polls the way the real page does.

   At the end it checks the work itself, not just the status codes:
     - lost writes: every comment, talk note, chat line and status that was saved is still there
     - sync: every person's page copy matches the store (no stale or missing documents)
     - errors and timings per action
   Writes harness/out/office_sim.json and prints a summary.

   node harness/sim/office_sim.mjs            (env SIM_USERS=100 SIM_SECONDS=240 STORE_LAG_MS=20 SIM_PORT) */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const N = Number(process.env.SIM_USERS) || 100;
const SECONDS = Number(process.env.SIM_SECONDS) || 240;
const LAG = process.env.STORE_LAG_MS || '20';
const ADMINS = Math.min(4, N - 1);

const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];
const rid = (n = 10) => Array.from({length: n}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/* ---------- the server ---------- */
const port = Number(process.env.SIM_PORT) || await freePort();
const BASE = 'http://localhost:' + port;
let srv = null;
if (!process.env.SIM_PORT) {
  srv = spawn('node', [path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), String(port), ':memory:'], {
    env: {...process.env, MOCK_AI: '1', STORE_LAG_MS: LAG}, stdio: ['ignore', 'pipe', 'pipe']});
  let errBuf = '';
  srv.stderr.on('data', d => { errBuf += d; if (errBuf.length > 20000) errBuf = errBuf.slice(-20000); });
  process.on('exit', () => { try { srv.kill(); } catch (e) { /* gone */ } });
  for (let i = 0; i < 100; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await sleep(100); } }
}

/* ---------- the record ---------- */
const stats = {};          /* action -> {n, ms[], errors: {code: n}} */
const unexpected = [];     /* error bodies worth reading */
const saved = [];          /* writes that came back ok, for the lost-write check */
function note(action, ms, status, body) {
  const s = stats[action] = stats[action] || {n: 0, ms: [], errors: {}};
  s.n++; s.ms.push(ms);
  if (status !== 200) {
    const code = status + ' ' + ((body && body.error && body.error.code) || '');
    s.errors[code] = (s.errors[code] || 0) + 1;
    if (unexpected.length < 400) unexpected.push({action, status, body: body && body.error, at: Date.now()});
  }
}

class Person {
  constructor(i, role) {
    this.i = i; this.role = role; this.uid = ''; this.cookie = '';
    this.name = role === 'founder' ? 'Kaavish Sim' : (role === 'admin' ? 'Admin ' : 'Staff ') + i;
    this.email = 'sim' + i + '.' + rid(4) + '@mask360.test';
    this.tags = {}; this.docs = {};      /* the page's copy */
    this.mine = {tasks: [], talks: [], pitches: [], posts: []};
    this.busy = false;
  }
  async call(a, body = {}, label, missingOk) {
    const t = Date.now();
    let status = 0, out = null;
    try {
      const r = await fetch(BASE + '/api/m360', {method: 'POST', headers: {'content-type': 'application/json', cookie: this.cookie ? 'm360s=' + this.cookie : '', 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/130 sim'}, body: JSON.stringify({a, ...body})});
      status = r.status;
      const sc = r.headers.get('set-cookie');
      if (sc) { const m = /m360s=([^;]*)/.exec(sc); if (m) this.cookie = m[1]; }
      out = await r.json().catch(() => null);
    } catch (e) { status = 599; out = {error: {code: 'network', message: String(e.message || e)}}; }
    const createPath = missingOk && status === 400 && out && out.error && /missing/.test(out.error.message || '');
    note(label || a, Date.now() - t, createPath ? 200 : status, out);
    return {status, out};
  }
  /* the page's write: update first, set when missing (M.makeWrites' merge) */
  async write(op, p, data, label) {
    /* a merge's first try on a document that does not exist yet is the page's normal create path, not an error */
    /* SIM_OLD_MERGE=1 replays the pre-v38 page (update, then set when missing); otherwise the one-step merge */
    const old = process.env.SIM_OLD_MERGE === '1';
    let r = await this.call('write', {op: op === 'merge' && old ? 'update' : op, path: p, data}, label || ('write ' + p.split('/')[0]), op === 'merge');
    if (op === 'merge' && r.status === 400 && r.out && r.out.error && /missing/.test(r.out.error.message || '')) r = await this.call('write', {op: 'set', path: p, data}, label || ('write ' + p.split('/')[0]));
    if (r.status === 200) {
      saved.push({by: this.uid, op, path: p, data, at: Date.now()});
      this.applyDoc(p, r.out.doc);
    }
    return r;
  }
  applyDoc(p, doc) {
    const s = p.split('/'); const id = s.pop(); const coll = s.join('/');
    if (!doc) return;
    (this.docs[coll] = this.docs[coll] || {})[id] = doc;
  }
  async sync() {
    for (let k = 0; k < 6; k++) {
      const r = await this.call('sync', {tags: this.tags, lazy: ['orgs', 'contacts']}, 'sync (page poll)');
      if (r.status !== 200 || !r.out || !r.out.colls) return;
      for (const [coll, c] of Object.entries(r.out.colls)) {
        const t = this.tags[coll] = this.tags[coll] || {};
        const d = this.docs[coll] = this.docs[coll] || {};
        for (const [id, tag] of Object.entries(c.tags || {})) t[id] = tag;
        for (const [id, doc] of Object.entries(c.docs || {})) d[id] = doc;
        for (const id of c.gone || []) { delete t[id]; delete d[id]; }
      }
      if (!r.out.more) return;
    }
  }
}

/* ---------- the day's moves ---------- */
const HOT_TASKS = [];      /* a few tasks the whole office piles onto */
const HOT_TALKS = [];
const ROOMS = ['general', 'creative', 'sales', 'random'];
const EMOJI = ['wave', 'five', 'coffee', 'party', 'think'];

const moves = {
  async checkin(p) {
    const days = {[today()]: {in: Date.now(), loc: pick(['office', 'home'])}};
    await p.write('merge', 'checkin/' + p.uid, {days}, 'check in');
  },
  async status(p) {
    const text = pick(['On the Swisse deck', 'In a shoot', 'Lunch', 'Deep work', 'Client call']) + ' ' + rid(3);
    p.lastStatus = text;
    await p.write('merge', 'me/' + p.uid, {status: {text, at: Date.now()}}, 'set status');
  },
  async emote(p) {
    await p.write('merge', 'me/' + p.uid, {emote: {e: pick(EMOJI), at: Date.now()}}, 'office emote');
  },
  async post(p) {
    const mine = (p.docs.feed || {})[p.uid] || {};
    const post = {id: rid(), kind: 'post', text: 'Update ' + rid(6), at: Date.now()};
    p.mine.posts.push(post.id);
    await p.write('merge', 'feed/' + p.uid, {posts: [post].concat(mine.posts || []).slice(0, 80), pinned: mine.pinned || null}, 'feed post');
  },
  async react(p) {
    const feeds = Object.entries(p.docs.feed || {}).filter(([, d]) => d && d.posts && d.posts.length);
    if (!feeds.length) return;
    const [au, d] = pick(feeds);
    await p.write('merge', 'reacts/' + p.uid, {r: {[au + ':' + pick(d.posts).id]: pick(EMOJI)}}, 'react');
  },
  async chat(p) {
    const room = pick(ROOMS);
    const key = room + ':' + p.uid;
    const cur = ((p.docs.chat || {})[key] || {}).msgs || [];
    const m = {id: rid(), at: Date.now(), text: 'hey ' + rid(5), mentions: []};
    p.lastChat = p.lastChat || {}; (p.lastChat[key] = p.lastChat[key] || []).push(m.id);
    await p.write('merge', 'chat/' + key, {msgs: cur.concat([m]).slice(-200), room, by: p.uid, updated: Date.now()}, 'chat send');
  },
  async taskNew(p) {
    const id = 't' + rid();
    const now = Date.now();
    const r = await p.write('set', 'tasks/' + id, {title: 'Task ' + rid(5), owner: p.uid, client: '', project: '', section: '', due: today(), status: 'todo', priority: 'normal', link: '', revisions: 0, subtasks: [], comments: {}, by: p.uid, created: now, updated: now, doneAt: null}, 'task create');
    if (r.status === 200) { p.mine.tasks.push(id); if (HOT_TASKS.length < 5) HOT_TASKS.push(id); }
  },
  async taskMove(p) {
    const id = pick(p.mine.tasks.length ? p.mine.tasks : HOT_TASKS.length ? HOT_TASKS : [null]);
    if (!id) return;
    await p.write('update', 'tasks/' + id, {status: pick(['todo', 'doing', 'review']), updated: Date.now()}, 'task move');
  },
  async taskComment(p) {
    /* most comments land on the five hot tasks: the whole office on one card at once */
    const pool = Math.random() < 0.7 && HOT_TASKS.length ? HOT_TASKS : Object.keys(p.docs.tasks || {});
    if (!pool.length) return;
    const id = pick(pool), cid = 'c' + rid();
    await p.write('update', 'tasks/' + id, {comments: {[cid]: {by: p.uid, text: 'note ' + rid(4), at: Date.now()}}, updated: Date.now()}, 'task comment');
  },
  async talkNew(p) {
    const id = 'k' + rid(), now = Date.now();
    const r = await p.write('set', 'talks/' + id, {who: 'Contact ' + rid(4), org: pick(['Tank Tailor', 'Soho House', 'Swisse', 'Junco']), note: 'asked to connect', met: today(), next: '', nextWhat: '', owner: p.uid, done: false, cid: '', client: '', pitch: '', log: {}, at: now, updated: now, by: p.uid}, 'talk add');
    if (r.status === 200) { p.mine.talks.push(id); if (HOT_TALKS.length < 3) HOT_TALKS.push(id); }
  },
  async talkLog(p) {
    const pool = Math.random() < 0.5 && HOT_TALKS.length ? HOT_TALKS : p.mine.talks;
    if (!pool.length) return;
    const id = pick(pool), lid = 'l' + rid();
    await p.write('update', 'talks/' + id, {log: {[lid]: {at: Date.now(), by: p.uid, text: 'spoke ' + rid(4)}}, done: false, updated: Date.now()}, 'talk log');
  },
  async pitchNew(p) {
    const id = 'p' + rid(), now = Date.now();
    const r = await p.write('set', 'pitches/' + id, {brand: 'Brand ' + rid(4), category: '', contact: '', source: '', owner: p.uid, updated: now, stage: 'lead', stageAt: now, next: '', nextDate: '', project: '', lost: '', created: now}, 'proposal add');
    if (r.status === 200) p.mine.pitches.push(id);
  },
  async pitchMove(p) {
    const all = Object.keys(p.docs.pitches || {});
    if (!all.length) return;
    await p.write('update', 'pitches/' + pick(all), {stage: pick(['lead', 'proposal', 'negotiation', 'won']), stageAt: Date.now(), updated: Date.now()}, 'proposal move');
  },
  async kudos(p) {
    const mine = (p.docs.kudos || {})[p.uid] || {};
    const to = pick(people).uid;
    await p.write('merge', 'kudos/' + p.uid, {given: [{id: rid(), to, why: 'great work', at: Date.now()}].concat(mine.given || []).slice(0, 60)}, 'kudos');
  },
  async leave(p) {
    /* the page keeps a person's requests as a list (36-leave.js) */
    const mine = ((p.docs.leave || {})[p.uid] || {}).reqs || [];
    const req = {id: 'lv' + rid(6), type: 'leave', from: today(), to: today(), why: 'errand', at: Date.now()};
    await p.write('merge', 'leave/' + p.uid, {reqs: mine.concat([req]).slice(-30)}, 'leave request');
  },
  async ai(p) {
    await p.call('ai', {tier: 'quick', messages: [{role: 'user', content: 'Summarise my day in one line.'}]}, 'ai chat');
  },
  async search(p) { await p.call('search', {q: pick(['staff', 'admin', 'kaav', '1'])}, 'search people'); },
  async people(p) { await p.call('people', {ids: people.slice(0, 50).map(x => x.uid)}, 'people names'); }
};
const STAFF_MENU = [['chat', 18], ['status', 6], ['emote', 6], ['post', 5], ['react', 8], ['taskNew', 6], ['taskMove', 6], ['taskComment', 10], ['talkNew', 4], ['talkLog', 6], ['pitchNew', 3], ['pitchMove', 4], ['kudos', 2], ['leave', 1], ['ai', 5], ['search', 3], ['people', 2], ['checkin', 2]];
const weighted = menu => { const tot = menu.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot; for (const [k, w] of menu) { r -= w; if (r <= 0) return k; } return menu[0][0]; };

/* the founder's own work: clients (retainer and project), the books, the bank statement, the AI check */
const founderMoves = {
  async client(p) {
    const id = 'c' + rid(), project = Math.random() < 0.4;
    await p.write('set', 'clients/' + id, {name: 'Client ' + rid(4), status: 'active', billing: project ? {kind: 'project', fee: 250000} : {kind: 'retainer', monthly: 150000}, created: Date.now(), updated: Date.now()}, 'client add');
  },
  async expense(p) {
    const id = 'e' + rid();
    await p.write('merge', 'expenses/' + id, {amount: 1200 + Math.floor(Math.random() * 9000), party: pick(['Starbucks', 'Soho House', 'Uber', 'AWS']), date: today(), cat: 'travel', at: Date.now()}, 'expense add');
  },
  async statement(p) {
    const id = 's' + rid();
    const lines = Array.from({length: 120}, (_, k) => ({d: today(), p: pick(['STARBUCKS COFFEE', 'SOHO HOUSE MUMBAI', 'JUNCO HOSPITALITY', 'NEFT CLIENT A']) + ' ' + k, amt: Math.floor(Math.random() * 20000), dir: Math.random() < 0.2 ? 'in' : 'out'}));
    await p.write('set', 'statements/' + id, {name: 'HDFC Oct', from: today(), to: today(), lines, at: Date.now()}, 'bank statement save');
  },
  async parties(p) { await p.call('bookparties', {names: ['STARBUCKS COFFEE 1', 'SOHO HOUSE MUMBAI 2', 'JUNCO HOSPITALITY 3']}, 'bank party AI'); },
  async aicheck(p) { await p.call('aicheck', {}, 'AI check'); },
  async approveLeave(p) {
    const reqs = Object.entries(p.docs.leave || {});
    if (!reqs.length) return;
    const [uid, d] = pick(reqs);
    const ids = ((d && d.reqs) || []).map(x => x && x.id).filter(Boolean);
    if (!ids.length) return;
    await p.write('merge', 'leavedec/' + uid, {d: {[pick(ids)]: {status: 'approved', by: p.uid, at: Date.now()}}}, 'leave approve');
  }
};
const FOUNDER_MENU = [['client', 3], ['expense', 4], ['statement', 1], ['parties', 1], ['aicheck', 1], ['approveLeave', 3]];

/* ---------- the day ---------- */
const people = [];
const founder = new Person(0, 'founder');
people.push(founder);
for (let i = 1; i < N; i++) people.push(new Person(i, i <= ADMINS ? 'admin' : 'staff'));

const log = (...a) => console.log('[sim]', ...a);
const t0 = Date.now();
/* SIM_FOUNDER_EMAIL / SIM_FOUNDER_PW let the browser walk (office_walk.py) sign in as the same founder */
if (process.env.SIM_FOUNDER_EMAIL) founder.email = process.env.SIM_FOUNDER_EMAIL;
let r = await founder.call('setup', {name: founder.name, email: founder.email, password: process.env.SIM_FOUNDER_PW || ('Sim-' + rid(16) + '!Q9')});
if (r.status !== 200) { log('setup failed', r.status, JSON.stringify(r.out)); process.exit(1); }
founder.uid = r.out.uid;
log('founder set up in', Date.now() - t0, 'ms');

/* everyone signs up at once, the way a team gets the link in one message */
const t1 = Date.now();
await Promise.all(people.slice(1).map(async p => {
  const s = await p.call('signup', {name: p.name, email: p.email, password: 'Sim-' + rid(16) + '!Q9'});
  if (s.status === 200) p.uid = s.out.uid;
  else log('signup failed', p.i, s.status, JSON.stringify(s.out));
}));
log((N - 1) + ' sign-ups in', Date.now() - t1, 'ms');

/* the founder lets everyone in, one save per person the way Desk does it, several at a time */
await founder.sync();
const t2 = Date.now();
let nextEmp = 2;
const joined = people.slice(1).filter(p => p.uid);
for (let k = 0; k < joined.length; k += 10) {
  await Promise.all(joined.slice(k, k + 10).map(p => {
    const emp = 'M360-' + String(nextEmp++).padStart(3, '0');
    return founder.write('merge', 'roster/team', {members: {[p.uid]: {role: p.role === 'admin' ? 'founder' : 'member', empId: emp, title: p.role, pod: pick(['Creative', 'Growth', 'Studio']), joined: today(), active: true}}, nextEmp, updated: Date.now()}, 'approve joiner');
  }));
}
const snap = await founder.call('snapshot', {}, 'snapshot');
if (snap.status !== 200) log('snapshot failed', snap.status, JSON.stringify(snap.out));
const roster = ((((snap.out || {}).colls) || {}).roster || {}).docs || {};
const inRoster = Object.keys((roster.team && roster.team.members) || {});
const missingFromRoster = joined.filter(p => !inRoster.includes(p.uid));
log('approvals in', Date.now() - t2, 'ms;', inRoster.length, 'on the roster,', missingFromRoster.length, 'dropped');
/* anyone the racing approvals dropped is approved again, so the day can run; the drop is still reported */
for (const p of missingFromRoster) await founder.write('merge', 'roster/team', {members: {[p.uid]: {role: p.role === 'admin' ? 'founder' : 'member', title: p.role, active: true}}, updated: Date.now()}, 'approve joiner (retry)');

/* the working day: every page polls, beacons presence, and does its work */
const until = Date.now() + SECONDS * 1000;
const loops = people.filter(p => p.uid).map(async p => {
  await p.sync();
  await moves.checkin(p);
  let nextPoll = Date.now(), nextPresence = Date.now();
  while (Date.now() < until) {
    const now = Date.now();
    if (now >= nextPoll) { await p.sync(); nextPoll = now + 3000 * (0.8 + Math.random() * 0.4); }
    if (now >= nextPresence) { await p.call('presence', {page: pick(['office', 'today', 'tasks', 'chat'])}, 'presence beacon'); nextPresence = now + 10000; }
    try {
      if (p.role === 'founder' && Math.random() < 0.5) await founderMoves[weighted(FOUNDER_MENU)](p);
      else await moves[weighted(STAFF_MENU)](p);
    } catch (e) { unexpected.push({action: 'sim', body: String(e.stack || e)}); }
    /* a person acts every 1.5 to 4 seconds: a day's clicks in a few minutes */
    await sleep(1500 + Math.random() * 2500);
  }
});
const tick = setInterval(() => log(Math.round((until - Date.now()) / 1000) + 's left,', Object.values(stats).reduce((a, s) => a + s.n, 0), 'calls'), 30000);
await Promise.all(loops);
clearInterval(tick);
log('day over; settling');

/* ---------- the checks ---------- */
await sleep(1500);
const raw = await (await fetch(BASE + '/__dump?prefix=d/')).json();
/* how much the day stored, by key family (every page poll lists all of d/) */
const census = {};
for (const k of Object.keys(await (await fetch(BASE + '/__dump?prefix=')).json())) { const f = k.split('/')[0] + '/' + (k.startsWith('d/') ? k.slice(2).split('~')[0] : ''); census[f] = (census[f] || 0) + 1; }
const truth = {};
for (const [k, v] of Object.entries(raw)) truth[k.slice(2).split('~').join('/')] = JSON.parse(v);

/* lost writes: each saved comment, talk note, chat line, status, roster member still there */
const lost = {};
const lose = (kind, detail) => { (lost[kind] = lost[kind] || []).push(detail); };
const lastStatus = {};
for (const w of saved) {
  const d = truth[w.path];
  if (w.label === undefined && w.op !== 'set' && !d) { lose('document vanished', w.path); continue; }
  if (w.path.startsWith('tasks/') && w.data.comments) for (const cid of Object.keys(w.data.comments)) if (!d || !d.comments || !d.comments[cid]) lose('task comment', w.path + ' ' + cid);
  if (w.path.startsWith('talks/') && w.data.log) for (const lid of Object.keys(w.data.log)) if (!d || !d.log || !d.log[lid]) lose('talk note', w.path + ' ' + lid);
  if (w.path === 'roster/team') for (const uid of Object.keys(w.data.members || {})) if (!d || !d.members || !d.members[uid]) lose('roster member', uid);
  if (w.path.startsWith('chat/')) for (const m of w.data.msgs.slice(-1)) if (!d || !(d.msgs || []).some(x => x.id === m.id)) lose('chat line', w.path + ' ' + m.id);
  if (w.path.startsWith('me/') && w.data.status) lastStatus[w.path] = w.data.status.text;
}
for (const [pth, text] of Object.entries(lastStatus)) if (!truth[pth] || !truth[pth].status || truth[pth].status.text !== text) lose('status (last one written)', pth);

/* sync: one last poll each, then every page's copy against the store */
await Promise.all(people.filter(p => p.uid).map(p => p.sync()));
const SHARED = ['tasks', 'talks', 'pitches', 'feed', 'chat', 'me', 'checkin', 'reacts', 'kudos', 'roster', 'clients'];
const stale = {}, missing = {};
for (const p of people.filter(x => x.uid)) {
  for (const coll of SHARED) {
    for (const [pth, d] of Object.entries(truth)) {
      if (!pth.startsWith(coll + '/') || pth.split('/').length !== 2) continue;
      if (coll === 'clients' && p.role === 'staff') continue;
      const id = pth.split('/')[1];
      const mine = (p.docs[coll] || {})[id];
      if (mine === undefined) { if (p.tags[coll] && id in p.tags[coll]) continue; missing[coll] = (missing[coll] || 0) + 1; }
      else if (JSON.stringify(mine) !== JSON.stringify(d)) stale[coll] = (stale[coll] || 0) + 1;
    }
  }
}

const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const table = Object.entries(stats).map(([a, s]) => ({action: a, calls: s.n, p50: pct(s.ms, 0.5), p95: pct(s.ms, 0.95), max: Math.max(...s.ms), errors: s.errors})).sort((x, y) => y.calls - x.calls);
const report = {users: people.filter(p => p.uid).length, seconds: SECONDS, storeLagMs: Number(LAG), calls: table.reduce((a, r) => a + r.calls, 0),
  writesSaved: saved.length, rosterDropped: missingFromRoster.length, lost: Object.fromEntries(Object.entries(lost).map(([k, v]) => [k, {count: v.length, sample: v.slice(0, 5)}])),
  syncStale: stale, syncMissing: missing, census, table, errorSamples: unexpected.slice(0, 60)};
fs.mkdirSync(path.join(ROOT, 'harness', 'out'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'harness', 'out', 'office_sim.json'), JSON.stringify(report, null, 1));

console.log('\n=== office simulation: ' + report.users + ' people, ' + SECONDS + ' s, ' + report.calls + ' calls, ' + saved.length + ' saves ===');
console.log('roster approvals dropped by racing saves:', missingFromRoster.length);
console.log('lost writes:', Object.keys(lost).length ? Object.entries(lost).map(([k, v]) => k + ' ' + v.length).join(', ') : 'none');
console.log('page copies stale:', JSON.stringify(stale), ' missing:', JSON.stringify(missing));
console.log('stored keys:', Object.values(census).reduce((a, n) => a + n, 0), JSON.stringify(Object.fromEntries(Object.entries(census).sort((x, y) => y[1] - x[1]).slice(0, 12))));
console.log('\naction'.padEnd(26), 'calls'.padStart(6), 'p50'.padStart(6), 'p95'.padStart(6), 'max'.padStart(7), ' errors');
for (const r of table) console.log(r.action.padEnd(25), String(r.calls).padStart(6), String(r.p50).padStart(6), String(r.p95).padStart(6), String(r.max).padStart(7), ' ' + (Object.keys(r.errors).length ? JSON.stringify(r.errors) : ''));
if (srv) srv.kill();
process.exit(0);
