/* m360 OS standalone runtime: gives the page the same window.claude contract it has on claude.ai
   (db, user, room, sample, downloads, permissions), backed by the EdgeOne function at /api/m360. */
(function () {
  'use strict';
  window.M360_STANDALONE = true;
  let meInfo = null;         /* the me answer, once it is in */

  /* anonymous EdgeOne previews carry an access token in the query; every call must keep it. A return from a
     sign in elsewhere (Spotify's code and state) is not part of it. */
  const QS = (() => { try { const p = new URLSearchParams(location.search || ''); p.delete('code'); p.delete('state'); p.delete('error'); const s = p.toString(); return s ? '?' + s : ''; } catch (e) { return location.search || ''; } })();
  const API = '/api/m360' + QS;
  /* actions the sign-in screen calls before anyone is signed in: a 401 from these is an answer, never a lost session */
  const OPEN = new Set(['me', 'setup', 'signup', 'login', 'accept', 'invited', 'magic', 'pw', 'pw2', 'reset', 'resetpw']);
  async function call(a, body) {
    let r;
    try {
      r = await fetch(API, {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'},
        body: JSON.stringify(Object.assign({a}, body || {}))});
    } catch (e) { throw {code: 'unavailable', message: 'offline'}; }
    let j = {};
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok || j.error) {
      /* a signed-in page that gets a 401 anywhere has lost its session: back to the sign-in screen */
      if (r.status === 401 && !OPEN.has(a) && meInfo && meInfo.uid) kick();
      throw {code: (j.error && j.error.code) || 'unavailable', message: (j.error && j.error.message) || ('http ' + r.status), status: r.status};
    }
    return j;
  }
  window.M360_API = call;
  /* the session ended under the page (signed out from another device, or taken off the roster): back to the sign-in screen */
  let kicked = false;
  function kick() { if (kicked) return; kicked = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* keep going */ } location.reload(); }

  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(k => freeze(o[k])); } return o; };
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  function merge(a, b) {
    const out = isObj(a) ? Object.assign({}, a) : {};
    for (const k of Object.keys(b)) {
      const v = b[k];
      out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
    }
    return out;
  }
  const segs = p => String(p || '').split('/').filter(Boolean);

  /* ---------- who is here ---------- */
  /* a sign-in link: #login=<code> signs this browser in, then the hash is cleared.
     An invite link #invite=<code> signs nobody in by itself: the sign-in screen asks for the invited email first (window.M360_INVITE). */
  const loginCode = (/^#login=([a-z0-9]{10,64})$/.exec(location.hash || '') || [])[1];
  const inviteCode = (/^#invite=([a-z0-9]{10,64})$/.exec(location.hash || '') || [])[1];
  if (inviteCode) window.M360_INVITE = inviteCode;
  /* a sign-in or invite link opened on top of an already loaded page: start over so it is honoured */
  window.addEventListener('hashchange', () => { if (/^#(login|invite)=[a-z0-9]{10,64}$/.test(location.hash || '')) location.reload(); });
  const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* keep going */ } };
  const signedIn = loginCode
    ? call('login', {code: loginCode}).then(r => { if (r && r.needCode) window.M360_CODE_TMP = r.tmp; }).catch(() => { window.M360_LOGIN_ERR = 'That sign-in link has expired or was already used. Ask for a new one.'; }).then(clearHash)
    : Promise.resolve();
  const meReady = signedIn.then(() => call('me')).then(m => { meInfo = m; if (inviteCode) clearHash(); return m; }).catch(() => { meInfo = {uid: null, down: true}; return meInfo; });

  /* ---------- db: a local mirror of every readable collection, kept fresh by polling ---------- */
  const colls = {};          /* path -> {v, docs, tags, complete} */
  /* the Base (contacts, orgs) is searched on the server; a page holds it only when something subscribes (the founder's Import) */
  const LAZY = new Set(['contacts', 'orgs']);
  const wanted = new Set();
  const frozen = new WeakMap(); /* a doc object -> its frozen copy, so an unchanged doc is never cloned twice */
  const docSubs = new Map(); /* doc path -> Set(fn) */
  const collSubs = new Map();/* coll path -> Set(fn) */
  let loaded = false;
  const waiters = [];
  const meta = {fromCache: false, hasPendingWrites: false};
  const metaOf = path => { const c = colls[path]; const partial = c ? c.complete === false : LAZY.has(path); return partial ? {fromCache: false, hasPendingWrites: false, partial: true} : meta; };

  function snapDoc(path) {
    const s = segs(path);
    const c = colls[s.slice(0, -1).join('/')];
    const d = c && c.docs[s[s.length - 1]];
    let data;
    if (d !== undefined) {
      if (d && typeof d === 'object') { data = frozen.get(d); if (!data) { data = freeze(d); frozen.set(d, data); } }
      else data = d;
    }
    return {id: s[s.length - 1], exists: data !== undefined, data: () => data, metadata: meta};
  }
  function snapColl(path) {
    const c = colls[path];
    const docs = c ? Object.keys(c.docs).map(id => snapDoc(path + '/' + id)) : [];
    return {docs, size: docs.length, empty: !docs.length, metadata: metaOf(path), forEach: fn => docs.forEach(fn)};
  }
  function notifyColl(coll) {
    const cs = collSubs.get(coll);
    if (cs) cs.forEach(fn => setTimeout(() => fn(snapColl(coll)), 0));
    for (const [p, set] of docSubs) {
      const s = segs(p);
      if (s.slice(0, -1).join('/') === coll) set.forEach(fn => setTimeout(() => fn(snapDoc(p)), 0));
    }
  }
  const inflight = {};       /* coll -> writes not yet confirmed; a sync never overwrites them */
  /* the server answers with deltas (the docs that moved, the ids gone, the tags now held) or, from an
     older server, whole collections; either way an unchanged doc keeps its object, so nothing re-renders for it */
  function applyColls(next) {
    for (const coll of Object.keys(next || {})) {
      if (inflight[coll]) continue;
      const n = next[coll];
      if (n.delta) {
        const c = colls[coll] || (colls[coll] = {v: '', docs: {}, tags: {}, complete: false});
        for (const id of n.gone || []) { delete c.docs[id]; delete c.tags[id]; }
        for (const id of Object.keys(n.docs || {})) c.docs[id] = n.docs[id];
        for (const id of Object.keys(n.tags || {})) c.tags[id] = n.tags[id];
        const wasComplete = c.complete;
        if (!n.partial) { c.v = n.v; c.complete = true; }
        if ((n.gone || []).length || Object.keys(n.docs || {}).length || (c.complete && !wasComplete)) notifyColl(coll);
        continue;
      }
      colls[coll] = {v: n.v, docs: n.docs || {}, tags: {}, complete: true};
      notifyColl(coll);
    }
  }
  const tagsHeld = () => {
    const t = {};
    Object.keys(colls).forEach(k => { if (!LAZY.has(k) || wanted.has(k)) t[k] = colls[k].tags || {}; });
    wanted.forEach(k => { if (!(k in t)) t[k] = {}; });
    return t;
  };
  const lazyList = () => Array.from(LAZY);
  async function loadAll() {
    for (let round = 0; round < 60; round++) {
      const r = await call('snapshot', {tags: tagsHeld(), lazy: lazyList()});
      applyColls(r.colls);
      if (!r.more) break;
    }
    loaded = true;
    waiters.splice(0).forEach(fn => fn());
  }
  const whenLoaded = () => loaded ? Promise.resolve() : new Promise(res => waiters.push(res));
  let syncing = false;
  async function sync() {
    if (syncing || !loaded) return;
    syncing = true;
    try {
      for (let round = 0; round < 60; round++) {
        const r = await call('sync', {tags: tagsHeld(), lazy: lazyList()});
        applyColls(r.colls);
        /* a level change means other documents may be readable now: hold no tags, so everything is asked for again */
        if (r.level != null && meInfo && r.level !== meInfo.level) { meInfo.level = r.level; Object.keys(colls).forEach(k => { colls[k].tags = {}; }); }
        if (!r.more) break;
      }
    } catch (e) { if (e && e.status === 401) kick(); /* else next tick */ }
    syncing = false;
  }
  function loop() {
    const ms = document.hidden ? 20000 : 3000;
    setTimeout(() => { sync().finally(loop); }, ms);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

  async function write(op, path, data) {
    const s = segs(path);
    if (!s.length || s.length % 2) throw {code: 'invalid_argument', message: 'document path needs an even number of segments'};
    await whenLoaded();
    const coll = s.slice(0, -1).join('/'), id = s[s.length - 1];
    if (LAZY.has(coll) && !wanted.has(coll)) {
      const r = await call('write', {op, path, data: op === 'delete' ? undefined : data}).catch(e => { if (e && e.status === 401) kick(); throw e; });
      return r;
    }
    const c = colls[coll] || (colls[coll] = {v: '', docs: {}, tags: {}, complete: !LAZY.has(coll)});
    const before = c.docs[id];
    if (op === 'update' && before === undefined) throw {code: 'invalid_argument', message: 'update on missing document'};
    /* optimistic: the page sees its own write at once */
    if (op === 'delete') delete c.docs[id];
    else c.docs[id] = op === 'update' ? merge(before, clone(data)) : clone(data);
    notifyColl(coll);
    inflight[coll] = (inflight[coll] || 0) + 1;
    try {
      const r = await call('write', {op, path, data: op === 'delete' ? undefined : data});
      inflight[coll]--;
      if (op !== 'delete' && r.doc) c.docs[id] = r.doc;
      /* the tag of this doc is unknown until the next sync brings it, so only this doc is asked for again */
      c.v = ''; if (op === 'delete') delete c.tags[id]; else c.tags[id] = '';
      setTimeout(sync, 400);
    } catch (e) {
      inflight[coll]--;
      if (before === undefined) delete c.docs[id]; else c.docs[id] = before;
      notifyColl(coll);
      if (e && e.status === 401) kick();
      throw e;
    }
  }

  function docRef(path) {
    return {
      id: segs(path).pop(), path,
      get: () => whenLoaded().then(() => snapDoc(path)),
      set: d => write('set', path, d),
      update: d => write('update', path, d),
      delete: () => write('delete', path),
      onSnapshot(fn, onErr) {
        if (!docSubs.has(path)) docSubs.set(path, new Set());
        docSubs.get(path).add(fn);
        whenLoaded().then(() => fn(snapDoc(path)), onErr);
        return () => { const s = docSubs.get(path); if (s) s.delete(fn); };
      }
    };
  }
  function collRef(path) {
    return {
      path,
      doc: id => docRef(path + '/' + id),
      get: () => whenLoaded().then(() => snapColl(path)),
      onSnapshot(fn, onErr) {
        if (!collSubs.has(path)) collSubs.set(path, new Set());
        collSubs.get(path).add(fn);
        /* the first subscriber to a lazy collection asks for it; it arrives over the next sync rounds */
        if (LAZY.has(path) && !wanted.has(path)) { wanted.add(path); if (!colls[path]) colls[path] = {v: '', docs: {}, tags: {}, complete: false}; whenLoaded().then(() => setTimeout(sync, 0)); }
        whenLoaded().then(() => fn(snapColl(path)), onErr);
        return () => { const s = collSubs.get(path); if (s) s.delete(fn); };
      }
    };
  }
  const db = Object.freeze({doc: docRef, collection: collRef});

  /* ---------- user: names live on the server, avatars are drawn here ---------- */
  const GREYS = ['#0E0E0E', '#3A3A3A', '#5A5A5A', '#6E6E6E', '#7A7A7A', '#8A8A8A', '#9A9A9A'];
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const initials = n => (String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2) || '?').toUpperCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function avatar(id, name) {
    const color = GREYS[hash(id || 'x') % GREYS.length];
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="' + color + '"/>' +
      '<text x="20" y="25" font-family="sans-serif" font-size="15" text-anchor="middle" fill="#fff">' + esc(initials(name)) + '</text></svg>';
    return {color, url: 'data:image/svg+xml,' + encodeURIComponent(svg)};
  }
  const names = {};
  let pending = null, pendingIds = new Set();
  function fetchNames(ids) {
    ids.forEach(id => pendingIds.add(id));
    if (!pending) {
      pending = new Promise(res => setTimeout(async () => {
        const batch = Array.from(pendingIds); pendingIds = new Set(); pending = null;
        try { const r = await call('people', {ids: batch}); Object.assign(names, r.names || {}); } catch (e) { /* names stay blank */ }
        res();
      }, 20));
    }
    return pending;
  }
  function profile(id) {
    const name = names[id] || '';
    const a = avatar(id, name);
    return {id, name, avatarUrl: a.url, color: a.color, email: null, isMe: !!meInfo && id === meInfo.uid, guest: false};
  }
  const user = Object.freeze({
    isOwner: () => meReady.then(m => !!m.isOwner),
    canEdit: () => meReady.then(m => !!m.canEdit),
    can: n => meReady.then(m => n === 'data.write' ? !!m.uid : false),
    me: () => meReady.then(m => {
      if (m.uid) names[m.uid] = m.name || names[m.uid] || '';
      const a = avatar(m.uid || 'x', m.name);
      return {id: m.uid || null, name: m.name || '', avatarUrl: a.url, color: a.color, email: null, isOwner: !!m.isOwner, canEdit: !!m.canEdit};
    }),
    id: () => meReady.then(m => m.uid || null),
    name: () => meReady.then(m => m.name || ''),
    avatarUrl: () => meReady.then(m => avatar(m.uid || 'x', m.name).url),
    email: () => Promise.resolve(null),
    profiles: async ids => {
      const list = (typeof ids === 'string' ? [ids] : (ids || [])).filter(Boolean);
      const miss = list.filter(id => !(id in names));
      if (miss.length) await fetchNames(miss);
      const out = {};
      list.forEach(id => { out[id] = profile(id); });
      return out;
    },
    search: async q => {
      try {
        const r = await call('search', {q: String(q || '')});
        (r.hits || []).forEach(h => { names[h.id] = h.name; });
        return (r.hits || []).map(h => profile(h.id));
      } catch (e) { return []; }
    }
  });

  /* ---------- room: presence by polling ---------- */
  function makeRoom() {
    let mine = null, fns = new Set(), timer = null;
    async function beat() {
      if (!mine) return;
      try {
        const r = await call('presence', {page: mine.page || ''});
        const peers = (r.peers || []).concat([{presence: mine, updatedAt: Date.now(), self: true}]);
        fns.forEach(fn => { try { fn({peers}); } catch (e) { /* page handler */ } });
      } catch (e) { if (e && e.status === 401) kick(); /* else offline */ }
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(() => { beat().finally(schedule); }, document.hidden ? 40000 : 15000); }
    return Object.freeze({
      presence(p) { mine = Object.assign({}, p); beat(); schedule(); return Promise.resolve(); },
      onPeers(fn) { fns.add(fn); return () => fns.delete(fn); },
      emit: () => Promise.resolve(), on: () => () => {}
    });
  }

  /* ---------- sample: a model turn per call, tools run here ---------- */
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const IMAGE_MAX = 1600000;   /* bytes per image; the page shrinks photos before they get here */
  const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej({code: 'image_rejected', message: 'unreadable image'}); r.readAsDataURL(blob); });
  async function imageBlocks(images) {
    const list = images ? (images instanceof Blob ? [images] : Array.from(images)) : [];
    if (list.length > 4) throw {code: 'image_rejected', message: 'at most four images'};
    const out = [];
    for (const b of list) {
      if (!(b instanceof Blob) || IMAGE_TYPES.indexOf(b.type) < 0) throw {code: 'image_rejected', message: 'not an image'};
      if (b.size > IMAGE_MAX) throw {code: 'image_rejected', message: 'image too large'};
      out.push({type: 'image', source: {type: 'base64', media_type: b.type, data: await toB64(b)}});
    }
    return out;
  }
  function makeSample() {
    async function run(input, opts) {
      opts = opts || {};
      let messages = typeof input === 'string' ? [{role: 'user', content: input}]
        : (Array.isArray(input) ? input.map(t => ({role: t.role, content: t.content})) : []);
      if (!messages.length) throw {code: 'invalid_request', message: 'empty input'};
      /* images ride with the last user turn, before its text */
      const imgs = await imageBlocks(opts.images);
      if (imgs.length) {
        const last = messages[messages.length - 1];
        last.content = imgs.concat([{type: 'text', text: typeof last.content === 'string' ? last.content : ''}]);
      }
      const tools = Array.isArray(opts.tools) ? opts.tools : [];
      const toolDefs = tools.map(t => ({name: t.name, description: t.description || '', input_schema: t.inputSchema || {type: 'object', properties: {}}}));
      let text = '';
      const ROUNDS = 10;
      for (let round = 0; round < ROUNDS; round++) {
        if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'cancelled'};
        /* the last round must answer: the tools stay defined (earlier turns refer to them) but none may be called */
        const r = await call('ai', {messages, tools: toolDefs, noTools: round === ROUNDS - 1, tier: opts.modelTier || 'default', max_tokens: opts.maxTokens || 4096});
        const blocks = r.content || [];
        const said = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
        if (said) { text += (text ? '\n' : '') + said; if (opts.onText) opts.onText({text, delta: said}); }
        const uses = blocks.filter(b => b.type === 'tool_use');
        if (!uses.length || r.stop_reason !== 'tool_use') break;
        messages = messages.concat([{role: 'assistant', content: blocks}]);
        const results = [];
        for (const u of uses) {
          if (opts.signal && opts.signal.aborted) throw {code: 'cancelled', message: 'cancelled'};
          const t = tools.find(x => x.name === u.name);
          let out, isErr = false;
          try { out = t ? await t.execute(u.input || {}, {signal: opts.signal}) : {error: 'unknown tool'}; } catch (e) { out = {error: String((e && e.message) || e)}; isErr = true; }
          const body = JSON.stringify(out === undefined ? null : out);
          results.push({type: 'tool_result', tool_use_id: u.id, content: body.length > 20000 ? body.slice(0, 20000) + '"... (cut)' : body, is_error: isErr});
        }
        messages = messages.concat([{role: 'user', content: results}]);
      }
      return {text, truncated: false};
    }
    const sample = (input, opts) => run(input, opts);
    sample.json = async (input, opts) => {
      const ask = typeof input === 'string' ? input + '\n\nReply with JSON only, no prose and no code fences.' : input;
      const r = await run(ask, opts);
      const t = String(r.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      const a = t.indexOf('{') >= 0 && (t.indexOf('[') < 0 || t.indexOf('{') < t.indexOf('[')) ? t.indexOf('{') : t.indexOf('[');
      const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      try { return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t); }
      catch (e) { throw {code: 'invalid_output', message: 'The model did not return JSON.', text: r.text}; }
    };
    sample.limits = () => Promise.resolve({maxPromptBytes: 400000, tools: {maxCount: 32}, images: {maxCount: 4, maxBytes: IMAGE_MAX, mediaTypes: IMAGE_TYPES.slice()}});
    return sample;
  }

  /* ---------- downloads ---------- */
  const downloads = Object.freeze({
    save({filename, data}) {
      const blob = data instanceof Blob ? data : new Blob([data], {type: 'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'download';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return Promise.resolve({status: 'saved'});
    }
  });
  const permissions = Object.freeze({state: () => Promise.resolve('granted'), request: () => Promise.resolve({})});

  /* ---------- installable: the shell caches itself ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  /* a newer build on the server: say so, once, with a reload; checked on load, when the tab comes back, and every ten minutes */
  let toldBuild = false;
  async function checkBuild() {
    if (toldBuild || !window.M360_BUILD) return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), {cache: 'no-store', credentials: 'same-origin'});
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.build && j.build !== window.M360_BUILD) { toldBuild = true; window.M360_NEWER = j.build; window.dispatchEvent(new CustomEvent('m360:newer', {detail: j.build})); }
    } catch (e) { /* offline, or an older server */ }
  }
  setTimeout(checkBuild, 8000);
  setInterval(checkBuild, 600000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkBuild(); });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.M360_INSTALL = e; window.dispatchEvent(new CustomEvent('m360:installable')); });

  /* ---------- the contract ---------- */
  let roomNs = null, sampleNs = null, started = false;
  window.claude = Object.freeze({
    use: async name => {
      const m = await meReady;
      if (name === 'user') return user;
      if (name === 'downloads') return downloads;
      if (name === 'permissions') return permissions;
      if (name === 'mcp') return null;
      if (!m.uid) return name === 'db' ? db : null;
      if (name === 'db') {
        /* the page never runs on an empty copy: a failed first load is retried until it lands */
        if (!started) { started = true; const boot = () => loadAll().then(loop, () => setTimeout(boot, 2500)); boot(); }
        return db;
      }
      if (name === 'room') return roomNs || (roomNs = makeRoom());
      if (name === 'sample') return m.ai ? (sampleNs || (sampleNs = makeSample())) : null;
      return null;
    }
  });
})();
