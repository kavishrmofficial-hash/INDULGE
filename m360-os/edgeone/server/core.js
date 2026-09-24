/* m360 OS standalone server: the same contract the page gets from claude.ai (db, user, room, sample),
   served from one EdgeOne Pages cloud function over the project's blob store.

   Storage layout (keys in one store). Every document is its own blob, so two people writing
   different documents never touch the same key; the store has no atomic create, so nothing
   here relies on locks.
     d/<doc path, slashes as ~>          the document                  one blob per document
     a/<collection, slashes as ~>        {docs: {id: {h, data}}}       read cache, rebuilt after writes
     p/<id>                              {name, at}                    people who signed in
     s/<token>                           {uid, at, last, ua}           sessions (cookie m360s); ua is a short device label
     k/<code>                            {uid, until}                  one-time sign-in links (magic: 20 minutes, founder made: 24 hours)
     w/<uid>                             {salt, hash, iter, at, fails, since, until}   the person's password, PBKDF2-SHA256; never sent to a page
     c/<uid>                             {salt, hash, iter, until, tries}   a 6 digit reset code (15 minutes, 5 tries), hashed the same way
     d/log~<YYYY-MM-DD>-<uid>            {e: {id: {at, a, p, s}}}      the activity log, written only by the server, read by admin+
     o/owner                             {uid}                         the founder account
     x/ai                                {key}                         Anthropic key, never sent to a page
     x/mail                              {key, from}                   Resend key and sender, never sent to a page
     e/<email>                           {uid}                         email to person
     i/<code>                            {email, name, title, role, by, until}   pending invites
     r/<uid>~<ms>~<page>                 ""                            presence beacons
*/
import {RULES} from './rules.js';
import {SEED} from './seed.js';
import {radarActions} from './radar.js';
import {safetyActions} from './safety.js';
import {peekActions} from './peek.js';
import {voiceActions} from './voice.js';

const LEVEL = {view: 0, interact: 1, admin: 2, owner: 3};
const SESSION_DAYS = 180;
const LINK_HOURS = 24;          /* a sign-in link made from Me or by the founder */
const MAGIC_MINUTES = 20;       /* a sign-in link sent by email */
const INVITE_DAYS = 7;
const PW_ITER = 150000;         /* PBKDF2-SHA256 rounds for passwords and reset codes */
const PW_MIN = 8, PW_MAX = 200;
const PW_FAILS = 6;             /* wrong passwords in a row before the account waits */
const PW_WAIT_MS = 15 * 60000;
const CODE_MINUTES = 15;        /* a reset code's life */
const CODE_TRIES = 5;
const WEAK = new Set(['password', '12345678']);
const LAST_SEEN_MS = 3600000;   /* a session's last-seen stamp moves at most once an hour */
const PRESENCE_MS = 45000;
const MAX_DOC = 256 * 1024;
const LOG_SOFT_MAX = 200 * 1024; /* a day's log for one person drops its oldest entries past this */
const LOG_MAX_DAYS = 31;
const IST_MS = 330 * 60000;
/* the calendar day in Asia/Kolkata, the agency's clock */
const ymdIST = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const segs = p => String(p || '').split('/').filter(Boolean);
/* segments never carry ~, which joins them in storage keys */
const SEG_OK = /^[A-Za-z0-9_\-.:@+]{1,200}$/;
const docKey = path => 'd/' + segs(path).join('~');
const pathOfKey = key => key.slice(2).split('~').join('/');
const aggKey = coll => 'a/' + segs(coll).join('~');
const collOf = path => segs(path).slice(0, -1).join('/');
const normTag = t => String(t || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
/* a short fingerprint of a collection's state: FNV-1a over sorted id:etag pairs */
function digest(pairs) {
  let h = 0x811c9dc5;
  const str = pairs.sort().join('|');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ':' + pairs.length;
}
const EMPTY_V = digest([]);
const rand = (n = 24) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, n * 1.5);
};
const newId = () => 'u_' + rand(14);
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
function merge(a, b) {
  const out = isObj(a) ? {...a} : {};
  for (const k of Object.keys(b)) {
    const v = b[k];
    if (isObj(v) && isObj(out[k])) out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out;
}
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
const cleanEmail = s => { const e = String(s || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120 ? e : ''; };
const emailKey = e => 'e/' + encodeURIComponent(e);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
/* ---------- passwords and reset codes: PBKDF2-SHA256 through Web Crypto, salted, compared in constant time ---------- */
const b64 = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const unb64 = str => Uint8Array.from(atob(String(str || '')), c => c.charCodeAt(0));
async function derive(secret, salt, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter}, key, 256));
}
function sameBytes(a, b) {
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i % b.length] || 0);
  return d === 0;
}
/* {salt, hash, iter}: what the store keeps of a secret */
async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {salt: b64(salt), hash: b64(await derive(secret, salt, PW_ITER)), iter: PW_ITER};
}
async function checkSecret(secret, rec) {
  if (!rec || typeof rec.salt !== 'string' || typeof rec.hash !== 'string') return false;
  try { return sameBytes(await derive(secret, unb64(rec.salt), Number(rec.iter) || PW_ITER), unb64(rec.hash)); }
  catch (e) { return false; }
}
/* a password the rules accept, or an HttpError that says why */
function checkPassword(pw, email) {
  if (typeof pw !== 'string' || !pw) throw new HttpError(400, 'weak', 'Type a password of at least ' + PW_MIN + ' characters.');
  if (pw.length < PW_MIN) throw new HttpError(400, 'weak', 'Use at least ' + PW_MIN + ' characters.');
  if (pw.length > PW_MAX) throw new HttpError(400, 'weak', 'Keep it under ' + PW_MAX + ' characters.');
  if (WEAK.has(pw.toLowerCase())) throw new HttpError(400, 'weak', 'That one is too easy to guess. Pick something else.');
  if (email && pw.trim().toLowerCase() === email) throw new HttpError(400, 'weak', 'Your email cannot be your password.');
  return pw;
}
const sixDigits = () => { const n = new Uint32Array(1); crypto.getRandomValues(n); return String(n[0] % 1000000).padStart(6, '0'); };
/* a short device label from the user-agent header, for the devices list: "iPhone, Safari", "Windows, Edge" */
function deviceLabel(ua) {
  ua = String(ua || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'Chromebook'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg[eA]?\//.test(ua) || /EdgiOS\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(', ') || 'Browser';
}
/* what a log entry says about a write: a task's or project's title, name and status when present, then the
   top-level keys. At most 120 characters, never the document. */
function summarize(path, data) {
  if (!isObj(data)) return '';
  const keys = Object.keys(data).join(', ');
  const coll = segs(path)[0];
  let s = keys;
  if (coll === 'tasks' || coll === 'projects') {
    const extra = ['title', 'name', 'status'].filter(k => typeof data[k] === 'string' && data[k]).map(k => k + ': ' + data[k].slice(0, 40));
    if (extra.length) s = extra.join(', ') + (keys ? ' · ' + keys : '');
  }
  return s.slice(0, 120);
}

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

/* ---------- access rules: the page's declared rules, evaluated per viewer ---------- */
function ruleAccess(path, uid, level) {
  const s = segs(path);
  if (s[0] === 'data' && s[1] === 'users') {
    const mine = !!uid && s[2] === uid;
    return {read: mine, write: mine};
  }
  let best = null, bestLen = -1;
  for (const r of RULES) {
    const rs = segs(r.path);
    if (rs.length > s.length) continue;
    let ok = true;
    for (let i = 0; i < rs.length; i++) {
      if (rs[i] === '{self}') { if (s[i] !== uid) { ok = false; break; } }
      else if (rs[i] !== s[i]) { ok = false; break; }
    }
    if (ok && rs.length > bestLen) { bestLen = rs.length; best = r; }
  }
  let read = best ? best.read : null, write = best ? best.write : null;
  if (read == null || write == null) {
    const chain = RULES.filter(r => {
      const rs = segs(r.path);
      if (rs.length >= bestLen) return false;
      for (let i = 0; i < rs.length; i++) if (rs[i] !== s[i]) return false;
      return true;
    }).sort((a, b) => segs(b.path).length - segs(a.path).length);
    for (const r of chain) { if (read == null && r.read) read = r.read; if (write == null && r.write) write = r.write; }
  }
  read = read || 'view'; write = write || 'interact';
  const canRead = level >= LEVEL[read];
  /* a {self} subtree under a prefix that reads at admin stays private to its owner */
  return {read: canRead, write: level >= LEVEL[write] && canRead};
}
/* people not on the roster yet see only what the join screen needs */
function guestAccess(path, uid) {
  const s = segs(path);
  if (path === 'roster/team' || path === 'settings/app') return {read: true, write: false};
  if (s[0] === 'join' && s[1] === uid && s.length === 2) return {read: true, write: true};
  if (s[0] === 'data' && s[1] === 'users' && s[2] === uid) return {read: true, write: true};
  return {read: false, write: false};
}

export function createApp({store, env = {}}) {
  const hooks = {};
  /* ---------- store helpers ---------- */
  const getJ = async key => {
    const v = await store.get(key, {type: 'json', consistency: 'strong'});
    return v == null ? null : v;
  };
  const putJ = (key, v) => store.set(key, JSON.stringify(v));
  const listAll = async prefix => ((await store.list({prefix, consistency: 'strong'})) || {}).blobs || [];

  /* ---------- who is asking ---------- */
  function cookieOf(req, name) {
    const c = req.headers.get('cookie') || '';
    for (const part of c.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === name) return decodeURIComponent(v.join('='));
    }
    return '';
  }
  async function viewer(req) {
    const tok = cookieOf(req, 'm360s');
    if (!tok || !/^[a-z0-9]{10,64}$/.test(tok)) return null;
    const s = await getJ('s/' + tok);
    if (!s || !s.uid) return null;
    const now = Date.now();
    if (now - (s.at || 0) > SESSION_DAYS * 86400000) return null;
    /* last seen moves at most once an hour, so a busy page does not rewrite its session on every poll */
    if (now - (s.last || s.at || 0) > LAST_SEEN_MS) await putJ('s/' + tok, {...s, last: now}).catch(() => {});
    return {uid: s.uid, token: tok};
  }
  async function ownerUid() { const o = await getJ('o/owner'); return o && o.uid; }
  async function levelOf(uid) {
    if (!uid) return -1;
    const [owner, team] = await Promise.all([ownerUid(), getJ(docKey('roster/team'))]);
    if (uid === owner) return LEVEL.owner;
    const m = ((team && team.members) || {})[uid];
    if (m && m.active !== false) return m.role === 'founder' ? LEVEL.admin : LEVEL.interact;
    return LEVEL.view;
  }
  function access(path, uid, level) {
    if (level >= LEVEL.interact) return ruleAccess(path, uid, level);
    return guestAccess(path, uid);
  }
  /* someone else's private data, and the activity log (read through the logs action only), never reach a page mirror */
  const hidden = (coll, uid) => { const s = segs(coll); return s[0] === 'log' || (s[0] === 'data' && s[1] === 'users' && s[2] !== uid); };
  /* may this viewer act on that person's sessions and links? Themselves always; admin+ on anyone but the founder */
  async function mayManage(v, target) {
    if (target === v.uid) return true;
    const [lvl, owner] = await Promise.all([levelOf(v.uid), ownerUid()]);
    return lvl >= LEVEL.admin && (target !== owner || v.uid === owner);
  }
  async function appSettings() { return (await getJ(docKey('settings/app')).catch(() => null)) || {}; }

  /* ---------- sessions ---------- */
  /* ua is the short device label the request handler already derived */
  async function startSession(uid, ua) {
    const token = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 40);
    const now = Date.now();
    await putJ('s/' + token, {uid, at: now, last: now, ua: String(ua || 'Browser').slice(0, 40)});
    return token;
  }
  const cookie = token => 'm360s=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (SESSION_DAYS * 86400);
  const CLEAR_COOKIE = 'm360s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  /* every live session of one person; dead ones are dropped on the way */
  async function sessionsOf(uid) {
    const out = [], now = Date.now();
    await Promise.all((await listAll('s/')).map(async b => {
      const s = await getJ(b.key).catch(() => null);
      if (!s || !s.uid) return;
      if (now - (s.at || 0) > SESSION_DAYS * 86400000) { await store.delete(b.key).catch(() => {}); return; }
      if (s.uid === uid) out.push({token: b.key.slice(2), ...s});
    }));
    return out.sort((a, b) => (b.last || b.at || 0) - (a.last || a.at || 0));
  }
  async function endSessions(uid, keep) {
    const list = (await sessionsOf(uid)).filter(s => s.token !== keep);
    await Promise.all(list.map(s => store.delete('s/' + s.token).catch(() => {})));
    return list.length;
  }

  /* ---------- passwords ---------- */
  /* true when the password matches w/<uid>. A miss counts; PW_FAILS misses inside PW_WAIT_MS make the account wait
     (429 slow_down) and a hit clears the count. With no record the work is still done, so timing says nothing. */
  const NO_REC = {salt: 'AAAAAAAAAAAAAAAAAAAAAA==', hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', iter: PW_ITER};
  async function verifyPassword(uid, rec, password) {
    const now = Date.now();
    const has = !!(rec && rec.hash);
    if (has && rec.until > now) throw new HttpError(429, 'slow_down', 'Too many tries. Wait 15 minutes or reset your password.');
    const ok = await checkSecret(password, has ? rec : NO_REC);
    if (!has) return false;
    if (ok) {
      if (rec.fails || rec.until) await putJ('w/' + uid, {salt: rec.salt, hash: rec.hash, iter: rec.iter, at: rec.at}).catch(() => {});
      return true;
    }
    const fresh = !rec.since || now - rec.since > PW_WAIT_MS;
    const fails = fresh ? 1 : (Number(rec.fails) || 0) + 1;
    const next = {salt: rec.salt, hash: rec.hash, iter: rec.iter, at: rec.at, fails, since: fresh ? now : rec.since};
    if (fails >= PW_FAILS) next.until = now + PW_WAIT_MS;
    await putJ('w/' + uid, next).catch(() => {});
    return false;
  }
  /* a fresh reset code for one person: stored hashed under c/<uid>, returned in the clear once */
  async function makeCode(uid) {
    const code = sixDigits();
    await putJ('c/' + uid, {...(await hashSecret(code)), until: Date.now() + CODE_MINUTES * 60000, tries: 0, at: Date.now()});
    return code;
  }

  /* ---------- the activity log: one document per person per day, appended by the server only ----------
     An append is get, merge, set on that one document. Appends to the same document from this function
     instance queue up one after another, so a page firing two writes at once does not lose an entry. */
  const logQueue = new Map();
  async function appendLog(key, id, entry) {
    const cur = (await getJ(key).catch(() => null)) || {};
    const e = isObj(cur.e) ? {...cur.e} : {};
    e[id] = entry;
    let str = JSON.stringify({e});
    if (str.length > LOG_SOFT_MAX) {
      const ids = Object.keys(e).sort();
      while (str.length > LOG_SOFT_MAX && ids.length > 1) { delete e[ids.shift()]; str = JSON.stringify({e}); }
    }
    await store.set(key, str);
  }
  async function log(uid, a, p, s) {
    if (!uid) return;
    try {
      const at = Date.now();
      const id = String(at) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
      const key = docKey('log/' + ymdIST(at) + '-' + uid);
      const entry = {at, a: String(a), p: String(p || ''), s: String(s || '').slice(0, 120)};
      const turn = (logQueue.get(key) || Promise.resolve()).then(() => appendLog(key, id, entry)).catch(() => {});
      logQueue.set(key, turn);
      await turn;
      if (logQueue.get(key) === turn) logQueue.delete(key);
    } catch (x) { /* the log never blocks the action it records */ }
  }

  async function aiKey() { if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY; const x = await getJ('x/ai'); return x && x.key; }
  async function mailConf() {
    if (env.RESEND_API_KEY) return {key: env.RESEND_API_KEY, from: env.MAIL_FROM || 'm360 OS <onboarding@resend.dev>'};
    const x = await getJ('x/mail');
    return x && x.key ? x : null;
  }
  /* one email through Resend; false when mail is not set up, throws when Resend refuses */
  async function sendMail(to, subject, text, htmlBody) {
    const c = await mailConf();
    if (!c) return false;
    const r = await (env.fetch || fetch)('https://api.resend.com/emails', {
      method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + c.key},
      body: JSON.stringify({from: c.from, to: [to], subject, text, html: htmlBody})
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new HttpError(502, 'mail_failed', (j && j.message) || ('mail ' + r.status)); }
    return true;
  }

  /* ---------- documents ---------- */
  /* every document key with its etag, grouped by collection */
  async function inventory() {
    const by = {};
    for (const b of await listAll('d/')) {
      const path = pathOfKey(b.key), s = segs(path);
      if (s.length < 2 || s.length % 2) continue;
      const coll = s.slice(0, -1).join('/');
      (by[coll] = by[coll] || {})[s[s.length - 1]] = normTag(b.etag);
    }
    return by;
  }
  const versionOf = tags => digest(Object.keys(tags || {}).map(id => id + ':' + tags[id]));

  /* a collection's documents, from its cache where the etag still matches, else from the document */
  async function readColl(coll, tags) {
    const agg = (await getJ(aggKey(coll)).catch(() => null)) || {docs: {}};
    const docs = {}, fresh = {};
    let stale = false;
    await Promise.all(Object.keys(tags).map(async id => {
      const hit = agg.docs && agg.docs[id];
      if (hit && hit.h === tags[id]) { docs[id] = hit.d; fresh[id] = hit; return; }
      stale = true;
      const d = await getJ(docKey(coll + '/' + id)).catch(() => null);
      if (d != null) { docs[id] = d; fresh[id] = {h: tags[id], d}; }
    }));
    if (stale || Object.keys(agg.docs || {}).length !== Object.keys(fresh).length) await putJ(aggKey(coll), {docs: fresh}).catch(() => {});
    return docs;
  }
  async function collsFor(uid, level, want) {
    const inv = await inventory();
    const out = {};
    const names = new Set(Object.keys(inv));
    if (want) Object.keys(want).forEach(c => names.add(c));
    await Promise.all(Array.from(names).map(async coll => {
      if (hidden(coll, uid)) return;
      const tags = inv[coll] || {};
      const v = versionOf(tags);
      if (want && want[coll] === v) return;
      if (want && !(coll in want) && !inv[coll]) return;
      const all = inv[coll] ? await readColl(coll, tags) : {};
      const docs = {};
      for (const id of Object.keys(all)) if (access(coll + '/' + id, uid, level).read) docs[id] = all[id];
      out[coll] = {v: inv[coll] ? v : EMPTY_V, docs};
    }));
    return out;
  }

  /* ---------- actions ---------- */
  const actions = {
    async me(v) {
      const [owner, app] = await Promise.all([ownerUid(), appSettings()]);
      const joinOpen = app.joinPolicy !== 'invite';
      if (!v) return {uid: null, setup: !owner, joinOpen};
      const [p, level, ai, mail, w] = await Promise.all([getJ('p/' + v.uid), levelOf(v.uid), aiKey(), mailConf(), getJ('w/' + v.uid)]);
      return {uid: v.uid, name: (p && p.name) || '', email: (p && p.email) || '', isOwner: v.uid === owner, canEdit: level >= LEVEL.admin,
        level, setup: !owner, ai: !!ai, mail: !!mail, joinOpen, locked: app.locked === true, hasPw: !!(w && w.hash)};
    },

    /* the first person to open a fresh deploy becomes the founder, and the workspace is seeded.
       Their email is the super admin login, so name, email and password are all required. */
    async setup(v, body, req) {
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument', 'name needed');
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      const password = checkPassword(body.password, email);
      if (await ownerUid()) throw new HttpError(409, 'taken', 'already set up');
      const uid = newId();
      await putJ('w/' + uid, {...(await hashSecret(password)), at: Date.now()});
      await putJ('p/' + uid, {name, email, at: Date.now()});
      await putJ(emailKey(email), {uid});
      await putJ('o/owner', {uid});
      await Promise.all(Object.keys(SEED).map(path => putJ(docKey(path), SEED[path])));
      const token = await startSession(uid, req.ua);
      await log(uid, 'setup', '', req.ua);
      return {__cookie: cookie(token), uid};
    },

    /* a name, an unused email and a password: the person waits on the join screen until the founder lets them in */
    async signup(v, body, req) {
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument', 'name needed');
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      const password = checkPassword(body.password, email);
      if (!(await ownerUid())) throw new HttpError(409, 'not_setup', 'set up first');
      if ((await appSettings()).joinPolicy === 'invite') throw new HttpError(409, 'closed', 'm360 is invite only right now. Ask Kaavish for an invite.');
      const taken = await getJ(emailKey(email));
      if (taken && taken.uid && (await getJ('p/' + taken.uid))) throw new HttpError(409, 'taken', 'That email is already on m360. Sign in with it instead.');
      const uid = newId();
      await putJ('w/' + uid, {...(await hashSecret(password)), at: Date.now()});
      await putJ('p/' + uid, {name, email, at: Date.now()});
      await putJ(emailKey(email), {uid});
      const token = await startSession(uid, req.ua);
      await log(uid, 'signup', '', req.ua);
      return {__cookie: cookie(token), uid};
    },

    async login(v, body, req) {
      const code = String(body.code || '');
      if (!/^[a-z0-9]{10,64}$/.test(code)) throw new HttpError(400, 'invalid_argument', 'bad link');
      const k = await getJ('k/' + code);
      if (!k || !k.uid || k.until < Date.now()) throw new HttpError(410, 'expired', 'link expired');
      await store.delete('k/' + code).catch(() => {});
      const token = await startSession(k.uid, req.ua);
      await log(k.uid, 'login', '', req.ua);
      return {__cookie: cookie(token), uid: k.uid};
    },

    async logout(v) {
      if (v) { await store.delete('s/' + v.token).catch(() => {}); await log(v.uid, 'logout', '', ''); }
      return {__cookie: CLEAR_COOKIE};
    },

    /* a one-time sign-in link, good for 24 hours: for yourself (another device), or by the founder for anyone */
    async mklink(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const target = body.uid || v.uid;
      if (!(await mayManage(v, target))) throw new HttpError(403, 'invalid_argument');
      if (!(await getJ('p/' + target))) throw new HttpError(404, 'invalid_argument');
      const code = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 32);
      await putJ('k/' + code, {uid: target, until: Date.now() + LINK_HOURS * 3600000});
      await log(v.uid, 'mklink', '', target === v.uid ? 'own device' : target);
      return {code, hours: LINK_HOURS};
    },

    /* the sessions of one person, newest first: the caller's own, or anyone's for admin+ */
    async devices(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const target = body.uid || v.uid;
      if (!(await mayManage(v, target))) throw new HttpError(403, 'invalid_argument');
      const list = await sessionsOf(target);
      return {devices: list.map(s => ({id: s.token.slice(0, 8), ua: s.ua || 'Browser', at: s.at || 0, last: s.last || s.at || 0, current: s.token === v.token}))};
    },
    /* end one session by its short id */
    async signout(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const id = String(body.id || '');
      if (!/^[a-z0-9]{8}$/.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      let gone = 0, mine = false;
      for (const b of await listAll('s/' + id)) {
        const s = await getJ(b.key).catch(() => null);
        if (!s || !s.uid || !(await mayManage(v, s.uid))) continue;
        await store.delete(b.key).catch(() => {});
        gone++;
        if (b.key.slice(2) === v.token) mine = true;
        await log(v.uid, 'signout', '', (s.uid === v.uid ? '' : s.uid + ': ') + (s.ua || 'Browser'));
      }
      if (!gone) throw new HttpError(404, 'invalid_argument', 'That device is already signed out.');
      return mine ? {ok: true, __cookie: CLEAR_COOKIE} : {ok: true};
    },
    /* end every session of one person: the caller's own (keepThis leaves this one), or anyone's for admin+ */
    async signoutall(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const target = body.uid || v.uid;
      if (!(await mayManage(v, target))) throw new HttpError(403, 'invalid_argument');
      const keep = target === v.uid && body.keepThis ? v.token : null;
      const removed = await endSessions(target, keep);
      await log(v.uid, 'signoutall', '', (target === v.uid ? '' : target + ': ') + removed + (removed === 1 ? ' device' : ' devices'));
      return target === v.uid && !keep ? {removed, __cookie: CLEAR_COOKIE} : {removed};
    },

    async rename(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument');
      await putJ('p/' + v.uid, {...(await getJ('p/' + v.uid) || {}), name});
      await log(v.uid, 'rename', '', '');
      return {ok: true};
    },

    async people(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      let ids = (Array.isArray(body.ids) ? body.ids : []).filter(x => typeof x === 'string' && /^u_[A-Za-z0-9]{6,40}$/.test(x)).slice(0, 300);
      /* people not on the team yet resolve only themselves */
      if ((await levelOf(v.uid)) < LEVEL.interact) ids = ids.filter(id => id === v.uid);
      const out = {};
      await Promise.all(ids.map(async id => { const p = await getJ('p/' + id).catch(() => null); out[id] = (p && p.name) || ''; }));
      return {names: out};
    },

    async search(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) return {hits: []};
      const q = String(body.q || '').toLowerCase().trim();
      const blobs = await listAll('p/');
      const all = await Promise.all(blobs.slice(0, 400).map(async b => ({id: b.key.slice(2), name: ((await getJ(b.key).catch(() => null)) || {}).name || ''})));
      return {hits: all.filter(p => p.name && (!q || p.name.toLowerCase().includes(q))).slice(0, 8)};
    },

    /* every collection this viewer may read, with its version */
    async snapshot(v) {
      if (!v) throw new HttpError(401, 'noid');
      const level = await levelOf(v.uid);
      return {colls: await collsFor(v.uid, level, null), level};
    },

    /* only the collections whose version moved since the page's copy */
    async sync(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const have = isObj(body.have) ? body.have : {};
      const level = await levelOf(v.uid);
      return {colls: await collsFor(v.uid, level, have), level};
    },

    async write(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const {op, path, data} = body;
      const s = segs(path);
      if (!s.length || s.length % 2 !== 0 || s.some(x => !SEG_OK.test(x) || x === '.' || x === '..')) throw new HttpError(400, 'invalid_argument', 'bad path');
      if (op !== 'set' && op !== 'update' && op !== 'delete') throw new HttpError(400, 'invalid_argument', 'bad op');
      if (op !== 'delete' && !isObj(data)) throw new HttpError(400, 'invalid_argument', 'body must be an object');
      /* the server writes the log itself; a page never does */
      if (s[0] === 'log') throw new HttpError(403, 'invalid_argument', 'the log is written by the server');
      const level = await levelOf(v.uid);
      if (!access(path, v.uid, level).write) throw new HttpError(403, 'invalid_argument', 'write not allowed');
      /* the founder can freeze the workspace: below admin only your own join request and your own status still go through */
      if (level < LEVEL.admin && (await appSettings()).locked === true) {
        const own = s.length === 2 && s[1] === v.uid && (s[0] === 'join' || s[0] === 'me');
        if (!own) throw new HttpError(423, 'locked', 'm360 is locked for changes right now');
      }
      const key = docKey(path);
      if (op === 'delete') {
        /* nothing is erased outright: safety.js keeps a copy in the trash first */
        if (hooks.beforeDelete) await hooks.beforeDelete(key, path, v.uid).catch(() => {});
        await store.delete(key).catch(() => {});
        await log(v.uid, 'delete', path, '');
        return {ok: true, doc: null};
      }
      let next = data, cur = null;
      if (op === 'update' || path === 'roster/team') cur = await getJ(key);
      if (op === 'update') {
        if (cur == null) throw new HttpError(400, 'invalid_argument', 'update on missing document');
        next = merge(cur, data);
      }
      const str = JSON.stringify(next);
      if (str.length > MAX_DOC) throw new HttpError(400, 'invalid_argument', 'document over 256 KiB');
      /* every move is backed up: safety.js keeps the version being replaced */
      if (hooks.beforeWrite) await hooks.beforeWrite(key, path, v.uid, cur).catch(() => {});
      await store.set(key, str);
      await log(v.uid, op, path, summarize(path, data));
      /* someone taken off the roster is signed out of every device at once */
      if (path === 'roster/team') {
        const was = (cur && cur.members) || {}, now = (next && next.members) || {};
        for (const uid of Object.keys(now)) {
          if (uid === v.uid || !now[uid] || now[uid].active !== false || !was[uid] || was[uid].active === false) continue;
          const n = await endSessions(uid, null);
          await log(v.uid, 'signoutall', '', uid + ': ' + n + (n === 1 ? ' device' : ' devices') + ', deactivated');
        }
      }
      return {ok: true, doc: next};
    },

    /* the activity log between two days (inclusive, at most 31), one document per person per day */
    async logs(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const from = String(body.from || ''), to = String(body.to || from);
      if (!YMD.test(from) || !YMD.test(to) || to < from) throw new HttpError(400, 'invalid_argument', 'from and to as YYYY-MM-DD');
      if ((Date.parse(to) - Date.parse(from)) / 86400000 > LOG_MAX_DAYS - 1) throw new HttpError(400, 'invalid_argument', 'at most 31 days at a time');
      const docs = {};
      await Promise.all((await listAll('d/log~')).map(async b => {
        const id = pathOfKey(b.key).slice(4), day = id.slice(0, 10);
        if (day < from || day > to) return;
        const d = await getJ(b.key).catch(() => null);
        if (d) docs[id] = d;
      }));
      return {docs};
    },
    /* drop log documents older than N days (default 90) */
    async prunelogs(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const days = Math.max(1, Math.min(3650, Math.floor(Number(body.days) || 90)));
      const cutoff = ymdIST(Date.now() - days * 86400000);
      let removed = 0;
      for (const b of await listAll('d/log~')) {
        if (pathOfKey(b.key).slice(4, 14) >= cutoff) continue;
        await store.delete(b.key).catch(() => {});
        removed++;
      }
      await log(v.uid, 'prunelogs', '', removed + (removed === 1 ? ' document' : ' documents') + ' older than ' + days + ' days');
      return {removed};
    },

    /* presence: one beacon key per viewer, listed without reading bodies */
    async presence(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const page = String(body.page || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'home';
      const now = Date.now();
      const peers = [], stale = [];
      for (const b of await listAll('r/')) {
        const [uid, at, pg] = b.key.slice(2).split('~');
        const t = Number(at) || 0;
        if (uid === v.uid || now - t > PRESENCE_MS) { stale.push(b.key); continue; }
        peers.push({presence: {uid, page: pg || '', at: t}, updatedAt: t});
      }
      await store.set('r/' + v.uid + '~' + now + '~' + page, '');
      await Promise.all(stale.slice(0, 40).map(k => store.delete(k).catch(() => {})));
      return {peers};
    },

    /* ---------- email: invites and sign-in links ---------- */
    async mailstatus(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const c = await mailConf();
      return {on: !!c, from: c ? c.from : '', env: !!env.RESEND_API_KEY};
    },
    async mailkey(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const key = String(body.key || '').trim(), from = String(body.from || '').trim().slice(0, 120);
      if (!key) { await store.delete('x/mail').catch(() => {}); await log(v.uid, 'mailkey', '', 'removed'); return {on: !!env.RESEND_API_KEY}; }
      if (!/^re_[A-Za-z0-9_\-]{10,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like a Resend key.');
      await putJ('x/mail', {key, from: from || 'm360 OS <onboarding@resend.dev>', at: Date.now(), by: v.uid});
      await log(v.uid, 'mailkey', '', 'set');
      return {on: true};
    },
    async mailtest(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const p = await getJ('p/' + v.uid);
      if (!p || !p.email) throw new HttpError(400, 'invalid_argument', 'Add your own email first, under Me.');
      await sendMail(p.email, 'm360 OS test', 'Email from m360 OS works. That is all.', '<p>Email from m360 OS works. That is all.</p>');
      return {ok: true};
    },
    async setemail(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      const taken = await getJ(emailKey(email));
      if (taken && taken.uid !== v.uid) throw new HttpError(409, 'taken', 'That email belongs to someone else on the team.');
      const p = (await getJ('p/' + v.uid)) || {};
      if (p.email && p.email !== email) await store.delete(emailKey(p.email)).catch(() => {});
      await putJ('p/' + v.uid, {...p, email});
      await putJ(emailKey(email), {uid: v.uid});
      await log(v.uid, 'setemail', '', '');
      return {ok: true, email};
    },
    /* the founder (or full access) invites by email; the person opens the link, confirms that email, and is on the team */
    async invite(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      const name = cleanName(body.name), title = cleanName(body.title);
      const role = ['member', 'lead', 'founder'].includes(body.role) ? body.role : 'member';
      const code = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 32);
      const inv = {email, name, title, role, by: v.uid, at: Date.now(), until: Date.now() + INVITE_DAYS * 86400000};
      await putJ('i/' + code, inv);
      const link = String(body.base || '').replace(/[#?].*$/, '') + '#invite=' + code;
      let sent = false, why = '';
      try {
        const by = await getJ('p/' + v.uid);
        sent = await sendMail(email, (by && by.name ? by.name : 'Mask360') + ' invited you to m360 OS',
          (name ? 'Hi ' + name + ',\n\n' : 'Hi,\n\n') + (by && by.name ? by.name : 'Mask360') + ' has added you to m360 OS, the Mask360 workspace.\n\nOpen your link, type this email address to confirm it is you, and you are in:\n' + link +
            '\n\nIt works once and is good for ' + INVITE_DAYS + ' days. Open it on the device you use for work; you can add your phone from inside.',
          '<p>' + (name ? 'Hi ' + esc(name) + ',' : 'Hi,') + '</p><p><b>' + esc(by && by.name ? by.name : 'Mask360') + '</b> has added you to <b>m360 OS</b>, the Mask360 workspace.</p>' +
            '<p><a href="' + esc(link) + '" style="display:inline-block;padding:12px 18px;background:#0E0E0E;color:#fff;border-radius:12px;text-decoration:none">Open m360 OS</a></p>' +
            '<p style="color:#666;font-size:13px">Type this email address to confirm it is you. The link works once and is good for ' + INVITE_DAYS + ' days. Open it on the device you use for work; you can add your phone from inside.</p>');
      } catch (e) { why = String((e && e.message) || 'mail failed'); }
      await log(v.uid, 'invite', '', role + (title ? ', ' + title : '') + (sent ? ', emailed' : ', link'));
      return {code, link, sent, why};
    },
    /* what the sign-in screen shows for an invite link: the invited name, never the email */
    async invited(v, body) {
      const code = String(body.code || '');
      if (!/^[a-z0-9]{10,64}$/.test(code)) throw new HttpError(400, 'invalid_argument', 'bad link');
      const inv = await getJ('i/' + code);
      if (!inv || inv.until < Date.now()) throw new HttpError(410, 'expired', 'invite expired');
      return {name: inv.name || '', title: inv.title || '', days: INVITE_DAYS};
    },
    async invites(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const out = [];
      for (const b of await listAll('i/')) {
        const inv = await getJ(b.key).catch(() => null);
        if (!inv) continue;
        if (inv.until < Date.now()) { await store.delete(b.key).catch(() => {}); continue; }
        out.push({code: b.key.slice(2), email: inv.email, name: inv.name, title: inv.title, role: inv.role, at: inv.at, until: inv.until});
      }
      return {invites: out.sort((a, b) => b.at - a.at)};
    },
    async uninvite(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const code = String(body.code || '');
      if (/^[a-z0-9]{10,64}$/.test(code)) await store.delete('i/' + code).catch(() => {});
      await log(v.uid, 'uninvite', '', '');
      return {ok: true};
    },
    /* the invited person opens the link and types the email it went to: then a person and a roster row exist */
    async accept(v, body, req) {
      const code = String(body.code || '');
      if (!/^[a-z0-9]{10,64}$/.test(code)) throw new HttpError(400, 'invalid_argument', 'bad link');
      const inv = await getJ('i/' + code);
      if (!inv || inv.until < Date.now()) throw new HttpError(410, 'expired', 'invite expired');
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'Type the email your invite went to.');
      if (email !== inv.email) throw new HttpError(403, 'mismatch', 'That email does not match this invite.');
      const password = checkPassword(body.password, email);
      const known = await getJ(emailKey(inv.email));
      let uid = known && known.uid;
      if (uid && !(await getJ('p/' + uid))) uid = null;
      if (!uid) {
        uid = newId();
        await putJ('p/' + uid, {name: inv.name || inv.email.split('@')[0], email: inv.email, at: Date.now()});
        await putJ(emailKey(inv.email), {uid});
      }
      /* the invite proved the email, so the password set here replaces any older one */
      await putJ('w/' + uid, {...(await hashSecret(password)), at: Date.now()});
      await store.delete('c/' + uid).catch(() => {});
      const team = (await getJ(docKey('roster/team'))) || {members: {}, nextEmp: 2, updated: 0};
      team.members = team.members || {};
      const cur = team.members[uid];
      if (!cur || cur.active === false) {
        const empId = (cur && cur.empId) || ('M360-' + String(team.nextEmp || 2).padStart(3, '0'));
        team.members[uid] = {...(cur || {}), role: inv.role || 'member', empId, title: inv.title || (cur && cur.title) || '', pod: (cur && cur.pod) || '',
          joined: (cur && cur.joined) || new Date().toISOString().slice(0, 10), start: (cur && cur.start) || '', probationEnd: (cur && cur.probationEnd) || '', active: true};
        if (!cur) team.nextEmp = (team.nextEmp || 2) + 1;
        team.updated = Date.now();
        await store.set(docKey('roster/team'), JSON.stringify(team));
      }
      await store.delete('i/' + code).catch(() => {});
      const token = await startSession(uid, req.ua);
      await log(uid, 'accept', '', (inv.role || 'member') + ', ' + req.ua);
      return {__cookie: cookie(token), uid};
    },
    /* a sign-in link by email for anyone already on the team, good for 20 minutes */
    async magic(v, body) {
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      if (!(await mailConf())) return {sent: false, nomail: true};
      const known = await getJ(emailKey(email));
      if (!known || !known.uid || !(await getJ('p/' + known.uid))) return {sent: true};
      const code = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 32);
      await putJ('k/' + code, {uid: known.uid, until: Date.now() + MAGIC_MINUTES * 60000});
      const link = String(body.base || '').replace(/[#?].*$/, '') + '#login=' + code;
      const life = 'It works once, for ' + MAGIC_MINUTES + ' minutes. If you did not ask for it, ignore this email.';
      await sendMail(email, 'Your m360 OS sign-in link', 'Open this link to sign in to m360 OS:\n' + link + '\n\n' + life,
        '<p><a href="' + esc(link) + '" style="display:inline-block;padding:12px 18px;background:#0E0E0E;color:#fff;border-radius:12px;text-decoration:none">Sign in to m360 OS</a></p><p style="color:#666;font-size:13px">' + life + '</p>');
      await log(known.uid, 'magic', '', 'link sent');
      return {sent: true, minutes: MAGIC_MINUTES};
    },

    /* ---------- passwords ----------
       A wrong password counts against the account; after PW_FAILS in PW_WAIT_MS the account waits that long.
       The answer never says whether the email is known. */
    async pw(v, body, req) {
      const email = cleanEmail(body.email), password = typeof body.password === 'string' ? body.password : '';
      const known = email ? await getJ(emailKey(email)) : null;
      const uid = known && known.uid;
      const rec = uid ? await getJ('w/' + uid) : null;
      const ok = await verifyPassword(uid, rec, password);
      if (!ok || !(await getJ('p/' + uid))) throw new HttpError(401, 'bad_login', 'That email and password do not match.');
      const token = await startSession(uid, req.ua);
      await log(uid, 'pw', '', req.ua);
      return {__cookie: cookie(token), uid};
    },
    /* your own password (the current one when you have one), or the founder setting one for anyone but themselves,
       which ends that person's sessions everywhere */
    async setpw(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const target = body.uid && body.uid !== v.uid ? String(body.uid) : v.uid;
      if (target !== v.uid) {
        if (v.uid !== (await ownerUid())) throw new HttpError(403, 'invalid_argument');
        if (!/^u_[A-Za-z0-9]{6,40}$/.test(target) || !(await getJ('p/' + target))) throw new HttpError(404, 'invalid_argument', 'No such person.');
      }
      const p = (await getJ('p/' + target)) || {};
      const password = checkPassword(body.password, p.email || '');
      if (target === v.uid) {
        const rec = await getJ('w/' + v.uid);
        if (rec && rec.hash) {
          const current = typeof body.current === 'string' ? body.current : '';
          if (!(await verifyPassword(v.uid, rec, current))) throw new HttpError(403, 'bad_current', 'That current password does not match.');
        }
      }
      await putJ('w/' + target, {...(await hashSecret(password)), at: Date.now()});
      await store.delete('c/' + target).catch(() => {});
      if (target !== v.uid) {
        const n = await endSessions(target, null);
        await log(v.uid, 'setpw', '', target + ': ' + n + (n === 1 ? ' device' : ' devices') + ' signed out');
      } else await log(v.uid, 'setpw', '', '');
      return {ok: true};
    },
    /* a 6 digit reset code by email, good for 15 minutes; the answer is the same whether or not the email is known */
    async reset(v, body) {
      const email = cleanEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_argument', 'That email does not look right.');
      if (!(await mailConf())) return {sent: false, nomail: true};
      const known = await getJ(emailKey(email));
      if (!known || !known.uid || !(await getJ('p/' + known.uid))) return {sent: true};
      const code = await makeCode(known.uid);
      const where = String(body.base || '').replace(/[#?].*$/, '');
      const life = 'It works once, for ' + CODE_MINUTES + ' minutes, and ' + CODE_TRIES + ' wrong tries end it. If you did not ask for it, ignore this email.';
      await sendMail(email, 'Your m360 OS reset code', 'Your m360 OS reset code is ' + code + '.\n\nType it on the sign-in screen' + (where ? ' at ' + where : '') + ' together with a new password. ' + life,
        '<p>Your m360 OS reset code is</p><p style="font-size:28px;letter-spacing:.2em;font-weight:600">' + code + '</p><p style="color:#666;font-size:13px">Type it on the sign-in screen' +
          (where ? ' at <a href="' + esc(where) + '">' + esc(where) + '</a>' : '') + ' together with a new password. ' + life + '</p>');
      await log(known.uid, 'reset', '', 'code sent');
      return {sent: true, minutes: CODE_MINUTES};
    },
    /* the code from the email (or from the founder) plus a new password: every other device is signed out, this one is in */
    async resetpw(v, body, req) {
      const email = cleanEmail(body.email), code = String(body.code || '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'invalid_argument', 'The code is 6 digits.');
      const password = checkPassword(body.password, email);
      const known = email ? await getJ(emailKey(email)) : null;
      const uid = known && known.uid;
      const rec = uid ? await getJ('c/' + uid) : null;
      const now = Date.now();
      if (!rec || !(rec.until > now) || !(await getJ('p/' + uid))) throw new HttpError(410, 'expired', 'That code has expired or was never sent. Ask for a new one.');
      if (!(await checkSecret(code, rec))) {
        const tries = (Number(rec.tries) || 0) + 1;
        if (tries >= CODE_TRIES) { await store.delete('c/' + uid).catch(() => {}); throw new HttpError(410, 'expired', 'That code has been tried too many times. Ask for a new one.'); }
        await putJ('c/' + uid, {...rec, tries});
        throw new HttpError(403, 'bad_code', 'That code does not match. ' + (CODE_TRIES - tries) + (CODE_TRIES - tries === 1 ? ' try' : ' tries') + ' left.');
      }
      await putJ('w/' + uid, {...(await hashSecret(password)), at: now});
      await store.delete('c/' + uid).catch(() => {});
      await endSessions(uid, null);
      const token = await startSession(uid, req.ua);
      await log(uid, 'resetpw', '', req.ua);
      return {__cookie: cookie(token), uid};
    },
    /* admin+ makes a reset code for anyone but the founder and hands it over in person; shown once, never stored in the clear */
    async resetcode(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const target = String(body.uid || '');
      if (!/^u_[A-Za-z0-9]{6,40}$/.test(target)) throw new HttpError(400, 'invalid_argument', 'bad id');
      if (target === (await ownerUid())) throw new HttpError(403, 'invalid_argument', 'The founder resets by email or from Me.');
      if (!(await getJ('p/' + target))) throw new HttpError(404, 'invalid_argument', 'No such person.');
      const code = await makeCode(target);
      await log(v.uid, 'resetcode', '', target);
      return {code, minutes: CODE_MINUTES, tries: CODE_TRIES};
    },

    async aistatus(v) { return {on: !!(v && await aiKey())}; },

    async aikey(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const key = String(body.key || '').trim();
      if (!key) { await store.delete('x/ai').catch(() => {}); await log(v.uid, 'aikey', '', 'removed'); return {on: !!env.ANTHROPIC_API_KEY}; }
      if (!/^sk-ant-[A-Za-z0-9_\-]{20,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an Anthropic key.');
      await putJ('x/ai', {key, at: Date.now(), by: v.uid});
      await log(v.uid, 'aikey', '', 'set');
      return {on: true};
    },

    /* one model turn; the page runs its own tools and calls again */
    async ai(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const key = await aiKey();
      if (!key) throw new HttpError(403, 'not_granted', 'AI is off');
      const MODELS = {quick: 'claude-haiku-4-5-20251001', default: 'claude-sonnet-5', complex: 'claude-sonnet-5'};
      const req = {
        model: MODELS[body.tier] || MODELS.default,
        max_tokens: Math.min(Number(body.max_tokens) || 2048, 4096),
        messages: Array.isArray(body.messages) ? body.messages.slice(-40) : []
      };
      if (typeof body.system === 'string' && body.system) req.system = body.system.slice(0, 60000);
      if (Array.isArray(body.tools) && body.tools.length) req.tools = body.tools.slice(0, 20);
      const r = await (env.fetch || fetch)('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
        body: JSON.stringify(req)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new HttpError(r.status === 429 ? 429 : 502, r.status === 429 ? 'rate_limited' : 'unavailable',
        (j && j.error && j.error.message) || 'model error');
      return {content: j.content || [], stop_reason: j.stop_reason || ''};
    }
  };
  /* radar actions (news, awards, watch) live in radar.js and share the store helpers */
  Object.assign(actions, radarActions({store, env, getJ, putJ, listAll, levelOf, ownerUid, LEVEL, HttpError, docKey, isObj}));
  /* safety: trash, daily backups, restore. It may register hooks.beforeDelete and hooks.upkeep. */
  Object.assign(actions, safetyActions({store, env, getJ, putJ, listAll, levelOf, ownerUid, LEVEL, HttpError, docKey, pathOfKey, isObj, hooks, log}));
  Object.assign(actions, peekActions({store, env, getJ, putJ, levelOf, LEVEL, HttpError}));
  Object.assign(actions, voiceActions({store, env, getJ, putJ, levelOf, LEVEL, HttpError, log}));

  const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
    status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', ...extra}
  });

  return async function handle(request) {
    if (request.method !== 'POST') return json({error: {code: 'invalid_argument', message: 'POST only'}}, 405);
    /* JSON only: a cross-site form or text/plain post cannot reach an action */
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json({error: {code: 'invalid_argument', message: 'JSON only'}}, 415);
    let body;
    try { body = await request.json(); } catch (e) { return json({error: {code: 'invalid_argument', message: 'bad json'}}, 400); }
    const fn = actions[body && body.a];
    if (!fn) return json({error: {code: 'invalid_argument', message: 'unknown action'}}, 400);
    try {
      const v = await viewer(request);
      /* once a day: the backup and the trash and backup pruning (safety.js); never fails a request */
      if (hooks.upkeep) await hooks.upkeep().catch(() => {});
      const out = await fn(v, body, {ua: deviceLabel(request.headers.get('user-agent'))});
      const extra = {};
      if (out && out.__cookie) { extra['set-cookie'] = out.__cookie; delete out.__cookie; }
      return json(out || {}, 200, extra);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const code = e instanceof HttpError ? e.code : 'unavailable';
      return json({error: {code, message: e instanceof HttpError ? e.message : 'server error'}}, status);
    }
  };
}
