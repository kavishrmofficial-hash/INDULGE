/* m360 OS standalone server: the same contract the page gets from claude.ai (db, user, room, sample),
   served from one EdgeOne Pages cloud function over the project's blob store.

   Storage layout (keys in one store). Every document is its own blob, so two people writing
   different documents never touch the same key; the store has no atomic create, so nothing
   here relies on locks.
     d/<doc path, slashes as ~>          the document                  one blob per document
     a/<collection, slashes as ~>        {docs: {id: {h, data}}}       read cache, rebuilt after writes
     p/<id>                              {name, at}                    people who signed in
     s/<token>                           {uid, at}                     sessions (cookie m360s)
     k/<code>                            {uid, until}                  one-time sign-in links
     o/owner                             {uid}                         the founder account
     x/ai                                {key}                         Anthropic key, never sent to a page
     r/<uid>~<ms>~<page>                 ""                            presence beacons
*/
import {RULES} from './rules.js';
import {SEED} from './seed.js';

const LEVEL = {view: 0, interact: 1, admin: 2, owner: 3};
const SESSION_DAYS = 180;
const LINK_DAYS = 7;
const PRESENCE_MS = 45000;
const MAX_DOC = 256 * 1024;

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
    if (Date.now() - (s.at || 0) > SESSION_DAYS * 86400000) return null;
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
  const hidden = (coll, uid) => { const s = segs(coll); return s[0] === 'data' && s[1] === 'users' && s[2] !== uid; };

  async function startSession(uid) {
    const token = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 40);
    await putJ('s/' + token, {uid, at: Date.now()});
    return token;
  }
  const cookie = token => 'm360s=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (SESSION_DAYS * 86400);

  async function aiKey() { if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY; const x = await getJ('x/ai'); return x && x.key; }

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
      const owner = await ownerUid();
      if (!v) return {uid: null, setup: !owner};
      const [p, level, ai] = await Promise.all([getJ('p/' + v.uid), levelOf(v.uid), aiKey()]);
      return {uid: v.uid, name: (p && p.name) || '', isOwner: v.uid === owner, canEdit: level >= LEVEL.admin,
        level, setup: !owner, ai: !!ai};
    },

    /* the first person to open a fresh deploy becomes the founder, and the workspace is seeded */
    async setup(v, body) {
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument', 'name needed');
      if (await ownerUid()) throw new HttpError(409, 'taken', 'already set up');
      const uid = newId();
      await putJ('p/' + uid, {name, at: Date.now()});
      await putJ('o/owner', {uid});
      await Promise.all(Object.keys(SEED).map(path => putJ(docKey(path), SEED[path])));
      const token = await startSession(uid);
      return {__cookie: cookie(token), uid};
    },

    async signup(v, body) {
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument', 'name needed');
      if (!(await ownerUid())) throw new HttpError(409, 'not_setup', 'set up first');
      const uid = newId();
      await putJ('p/' + uid, {name, at: Date.now()});
      const token = await startSession(uid);
      return {__cookie: cookie(token), uid};
    },

    async login(v, body) {
      const code = String(body.code || '');
      if (!/^[a-z0-9]{10,64}$/.test(code)) throw new HttpError(400, 'invalid_argument', 'bad link');
      const k = await getJ('k/' + code);
      if (!k || !k.uid || k.until < Date.now()) throw new HttpError(410, 'expired', 'link expired');
      await store.delete('k/' + code).catch(() => {});
      const token = await startSession(k.uid);
      return {__cookie: cookie(token), uid: k.uid};
    },

    async logout(v) {
      if (v) await store.delete('s/' + v.token).catch(() => {});
      return {__cookie: 'm360s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'};
    },

    /* a one-time sign-in link: for yourself (another device), or by the founder for anyone */
    async mklink(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const target = body.uid || v.uid;
      if (target !== v.uid) {
        /* the founder makes links for anyone; full access makes links for anyone but the founder */
        const [lvl, owner] = await Promise.all([levelOf(v.uid), ownerUid()]);
        if (lvl < LEVEL.admin || (target === owner && v.uid !== owner)) throw new HttpError(403, 'invalid_argument');
      }
      if (!(await getJ('p/' + target))) throw new HttpError(404, 'invalid_argument');
      const code = rand(32).replace(/[^a-z0-9]/g, '').slice(0, 32);
      await putJ('k/' + code, {uid: target, until: Date.now() + LINK_DAYS * 86400000});
      return {code, days: LINK_DAYS};
    },

    async rename(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'invalid_argument');
      await putJ('p/' + v.uid, {...(await getJ('p/' + v.uid) || {}), name});
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
      const level = await levelOf(v.uid);
      if (!access(path, v.uid, level).write) throw new HttpError(403, 'invalid_argument', 'write not allowed');
      const key = docKey(path);
      if (op === 'delete') { await store.delete(key).catch(() => {}); return {ok: true, doc: null}; }
      let next = data;
      if (op === 'update') {
        const cur = await getJ(key);
        if (cur == null) throw new HttpError(400, 'invalid_argument', 'update on missing document');
        next = merge(cur, data);
      }
      const str = JSON.stringify(next);
      if (str.length > MAX_DOC) throw new HttpError(400, 'invalid_argument', 'document over 256 KiB');
      await store.set(key, str);
      return {ok: true, doc: next};
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

    async aistatus(v) { return {on: !!(v && await aiKey())}; },

    async aikey(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const key = String(body.key || '').trim();
      if (!key) { await store.delete('x/ai').catch(() => {}); return {on: !!env.ANTHROPIC_API_KEY}; }
      if (!/^sk-ant-[A-Za-z0-9_\-]{20,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an Anthropic key.');
      await putJ('x/ai', {key, at: Date.now(), by: v.uid});
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
      const out = await fn(v, body);
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
