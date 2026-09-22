/* Local QA harness: a mock window.claude. Never shipped.
   Query params: as=founder|m1|m2|outsider  reset=1  seed=1
                 mcperr=Gmail:needs_reauth,Google Drive:server_unavailable
                 perm=Gmail:prompt   nomcp=1   nodl=1   nohost=1   noid=1   nocap=1 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (q.get('nohost') === '1') return;

  const AV = (initials, color) => 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="' + color + '"/>' +
    '<text x="20" y="25" font-family="sans-serif" font-size="15" text-anchor="middle" fill="#fff">' + initials + '</text></svg>');
  const IDENT = {
    founder: {id: 'u_founder', name: 'Kaavish Ramchandani', email: 'kaavish@mask360.agency', color: '#0E0E0E', isOwner: true, canEdit: true, avatarUrl: AV('KR', '#0E0E0E')},
    m1: {id: 'u_m1', name: 'Durvesh Patil', email: 'durvesh@mask360.agency', color: '#5A5A5A', isOwner: false, canEdit: false, avatarUrl: AV('DP', '#5A5A5A')},
    m2: {id: 'u_m2', name: 'Aanya Mehta', email: 'aanya@mask360.agency', color: '#8A8A8A', isOwner: false, canEdit: false, avatarUrl: AV('AM', '#8A8A8A')},
    m3: {id: 'u_m3', name: 'Ishaan Rao', email: 'ishaan@mask360.agency', color: '#7A7A7A', isOwner: false, canEdit: false, avatarUrl: AV('IR', '#7A7A7A')},
    outsider: {id: 'u_out', name: 'Rohan Verma', email: 'rohan@mask360.agency', color: '#9A9A9A', isOwner: false, canEdit: false, avatarUrl: AV('RV', '#9A9A9A')}
  };
  const who = IDENT[q.get('as') || 'founder'] || IDENT.founder;
  const ME = q.get('noid') === '1' ? {...who, id: null, name: '', email: null, isOwner: false, canEdit: false} : who;

  /* ---------------- rules (section 5) ---------------- */
  const RULES = [
    {path: '', read: 'interact', write: 'interact'},
    {path: 'roster', read: 'interact', write: 'admin'},
    {path: 'settings', read: 'interact', write: 'admin'},
    {path: 'handbook', read: 'interact', write: 'admin'},
    {path: 'review', read: 'interact', write: 'admin'},
    {path: 'leavedec', read: 'interact', write: 'admin'},
    {path: 'candidates', read: 'interact', write: 'admin'},
    {path: 'evals', read: 'admin', write: 'admin'},
    {path: 'evals/{self}', read: 'interact', write: 'interact'},
    {path: 'checkin', read: 'interact', write: 'admin'}, {path: 'checkin/{self}', write: 'interact'},
    {path: 'eod', read: 'interact', write: 'admin'}, {path: 'eod/{self}', write: 'interact'},
    {path: 'plan', read: 'interact', write: 'admin'}, {path: 'plan/{self}', write: 'interact'},
    {path: 'rocks', read: 'interact', write: 'admin'}, {path: 'rocks/{self}', write: 'interact'},
    {path: 'feed', read: 'interact', write: 'admin'}, {path: 'feed/{self}', write: 'interact'},
    {path: 'reacts', read: 'interact', write: 'admin'}, {path: 'reacts/{self}', write: 'interact'},
    {path: 'acks', read: 'interact', write: 'admin'}, {path: 'acks/{self}', write: 'interact'},
    {path: 'kudos', read: 'interact', write: 'admin'}, {path: 'kudos/{self}', write: 'interact'},
    {path: 'leave', read: 'interact', write: 'admin'}, {path: 'leave/{self}', write: 'interact'},
    {path: 'ideas', read: 'interact', write: 'admin'}, {path: 'ideas/{self}', write: 'interact'},
    {path: 'votes', read: 'interact', write: 'admin'}, {path: 'votes/{self}', write: 'interact'},
    {path: 'access', read: 'interact', write: 'admin'}, {path: 'access/{self}', write: 'interact'},
    {path: 'onboard', read: 'interact', write: 'admin'}, {path: 'onboard/{self}', write: 'interact'}
  ];
  const LEVEL = {view: 0, interact: 1, admin: 2, owner: 3};
  const myLevel = ME.isOwner ? 3 : 1;

  function segs(p) { return p.split('/').filter(Boolean); }
  function checkPath(p, wantDoc) {
    const s = segs(p);
    if (!s.length) throw new TypeError('empty path');
    for (const x of s) if (!/^[A-Za-z0-9_\-.~:@+]+$/.test(x) || x === '.' || x === '..') throw new TypeError('bad segment ' + x);
    if (wantDoc && s.length % 2 !== 0) throw new TypeError('document path needs an even number of segments (' + s.length + ')');
    if (!wantDoc && s.length % 2 !== 1) throw new TypeError('collection path needs an odd number of segments (' + s.length + ')');
  }
  /* returns {read: bool, write: bool} for the current identity */
  function access(path) {
    const s = segs(path);
    if (s[0] === 'data' && s[1] === 'users') {
      const mine = ME.id && s[2] === ME.id;
      return {read: !!mine, write: !!mine};
    }
    let best = null, bestLen = -1;
    for (const r of RULES) {
      const rs = segs(r.path);
      if (rs.length > s.length) continue;
      let ok = true, self = false;
      for (let i = 0; i < rs.length; i++) {
        if (rs[i] === '{self}') { if (s[i] !== ME.id) { ok = false; break; } self = true; }
        else if (rs[i] !== s[i]) { ok = false; break; }
      }
      if (!ok) continue;
      if (rs.length > bestLen) { bestLen = rs.length; best = {...r, self}; }
    }
    /* inherit unset levels from the nearest rule above */
    let read = best.read, write = best.write;
    if (read == null || write == null) {
      const chain = RULES.filter(r => { const rs = segs(r.path); if (rs.length >= bestLen) return false; for (let i = 0; i < rs.length; i++) if (rs[i] !== s[i]) return false; return true; })
        .sort((a, b) => segs(b.path).length - segs(a.path).length);
      for (const r of chain) { if (read == null && r.read) read = r.read; if (write == null && r.write) write = r.write; }
    }
    read = read || 'view'; write = write || 'interact';
    const canRead = myLevel >= LEVEL[read];
    const canWrite = myLevel >= LEVEL[write] && myLevel >= LEVEL[read];
    /* {self} privacy: a sibling's {self} subtree stays hidden unless a prefix rule opens it; every prefix here opens reads */
    return {read: canRead, write: canWrite};
  }

  /* ---------------- store ---------------- */
  const KEY = 'm360db';
  let store = {};
  try { if (q.get('reset') === '1') localStorage.removeItem(KEY); store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { store = {}; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(k => deepFreeze(o[k])); } return o; }
  const clone = x => JSON.parse(JSON.stringify(x));
  function merge(a, b) {
    const out = (a && typeof a === 'object' && !Array.isArray(a)) ? {...a} : {};
    for (const k of Object.keys(b)) {
      const v = b[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = merge(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  const docListeners = new Map();   /* path -> Set(fn) */
  const collListeners = new Map();  /* coll path -> Set(fn) */
  const err = (code, message) => ({code, message});
  const meta = {fromCache: false, hasPendingWrites: false};
  const seenOwnerKeys = new Set();
  window.__dbWrites = [];

  function snapDoc(path) {
    const s = segs(path);
    const a = access(path);
    const data = a.read && store[path] !== undefined ? deepFreeze(clone(store[path])) : undefined;
    return {id: s[s.length - 1], exists: data !== undefined, data: () => data, metadata: meta};
  }
  function collOf(path) { const s = segs(path); return s.slice(0, -1).join('/'); }
  function notify(path) {
    const dl = docListeners.get(path); if (dl) dl.forEach(fn => setTimeout(() => fn(snapDoc(path)), 0));
    const c = collOf(path);
    const cl = collListeners.get(c); if (cl) cl.forEach(fn => setTimeout(() => fn(), 0));
  }
  window.addEventListener('storage', ev => {
    if (ev.key !== KEY) return;
    try { store = JSON.parse(ev.newValue || '{}'); } catch (e) { return; }
    for (const p of docListeners.keys()) notify(p);
    for (const c of collListeners.keys()) { const cl = collListeners.get(c); cl.forEach(fn => setTimeout(() => fn(), 0)); }
  });
  function write(path, data, mode) {
    return new Promise((res, rej) => setTimeout(() => {
      const a = access(path);
      if (!a.write) return rej(err('invalid_argument', 'write not allowed at ' + path));
      if (mode !== 'delete' && (data === null || typeof data !== 'object' || Array.isArray(data))) return rej(err('invalid_argument', 'body must be an object'));
      if (mode === 'update' && store[path] === undefined) return rej(err('invalid_argument', 'update on missing document ' + path));
      if (mode === 'set' && store[path] === undefined && Object.keys(store).length >= 5000) return rej(err('quota_exceeded', 'database holds 5000 documents'));
      if (mode === 'delete') delete store[path];
      else {
        const body = mode === 'update' ? merge(store[path], data) : clone(data);
        if (JSON.stringify(body).length > 256 * 1024) return rej(err('invalid_argument', 'document over 256 KiB'));
        store[path] = body;
      }
      window.__dbWrites.push({path, mode, at: Date.now()});
      persist(); notify(path); res();
    }, 8));
  }

  function docRef(path) {
    checkPath(path, true);
    const s = segs(path);
    return {
      id: s[s.length - 1], path,
      get: () => new Promise(r => setTimeout(() => r(snapDoc(path)), 5)),
      set: d => write(path, d, 'set'),
      update: d => write(path, d, 'update'),
      delete: () => write(path, null, 'delete'),
      acquire: () => Promise.resolve({acquired: true, holder: ME.id}),
      onSnapshot: (next, error) => {
        if (!docListeners.has(path)) docListeners.set(path, new Set());
        docListeners.get(path).add(next);
        setTimeout(() => next(snapDoc(path)), 12);
        return () => { const l = docListeners.get(path); if (l) l.delete(next); };
      },
      collection: sub => collRef(path + '/' + sub)
    };
  }
  function query(path, filters, order, lim) {
    const run = () => {
      const pre = path + '/';
      let docs = Object.keys(store).filter(p => p.startsWith(pre) && segs(p).length === segs(path).length + 1)
        .filter(p => access(p).read).map(p => snapDoc(p));
      for (const f of filters) docs = docs.filter(d => {
        const v = d.data()[f.field];
        switch (f.op) {
          case '==': return v === f.value; case '!=': return v !== f.value;
          case '<': return v < f.value; case '<=': return v <= f.value; case '>': return v > f.value; case '>=': return v >= f.value;
          case 'in': return f.value.includes(v); case 'not-in': return !f.value.includes(v);
          case 'array-contains': return Array.isArray(v) && v.includes(f.value);
          default: return true;
        }
      });
      if (order) docs.sort((a, b) => { const x = a.data()[order.field], y = b.data()[order.field]; const c = x < y ? -1 : x > y ? 1 : 0; return order.dir === 'desc' ? -c : c; });
      else docs.sort((a, b) => a.id < b.id ? -1 : 1);
      if (lim) docs = docs.slice(0, lim);
      return {docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({type: 'added', doc: d, oldIndex: -1, newIndex: i})), metadata: meta};
    };
    const self = {
      where: (field, op, value) => query(path, [...filters, {field, op, value}], order, lim),
      orderBy: (field, dir) => query(path, filters, {field, dir: dir || 'asc'}, lim),
      limit: n => query(path, filters, order, n),
      get: () => new Promise(r => setTimeout(() => r(run()), 5)),
      onSnapshot: (next, error) => {
        const fn = () => next(run());
        if (!collListeners.has(path)) collListeners.set(path, new Set());
        collListeners.get(path).add(fn);
        setTimeout(fn, 12);
        return () => { const l = collListeners.get(path); if (l) l.delete(fn); };
      }
    };
    return self;
  }
  function collRef(path) {
    checkPath(path, false);
    const qq = query(path, [], null, 0);
    return {...qq, path,
      doc: id => docRef(path + '/' + (id || ('d' + Math.random().toString(36).slice(2, 10)))),
      add: d => { const r = docRef(path + '/' + 'd' + Math.random().toString(36).slice(2, 10)); return r.set(d).then(() => r); }
    };
  }
  const db = Object.freeze({doc: docRef, collection: collRef});
  window.__db = {store: () => store, set: (p, d) => { store[p] = clone(d); persist(); notify(p); }, get: p => store[p]};

  /* ---------------- user ---------------- */
  const profOf = id => {
    const p = Object.values(IDENT).find(x => x.id === id);
    if (!p) return {id, name: '', avatarUrl: AV('?', '#BBBBBB'), color: '#BBBBBB', email: null, isMe: id === ME.id};
    return {id: p.id, name: p.name, avatarUrl: p.avatarUrl, color: p.color, email: p.email, isMe: p.id === ME.id};
  };
  const user = Object.freeze({
    isOwner: () => Promise.resolve(ME.isOwner),
    canEdit: () => Promise.resolve(ME.canEdit),
    can: () => Promise.resolve(true),
    me: () => Promise.resolve({id: ME.id, name: ME.name, avatarUrl: ME.avatarUrl, color: ME.color, email: ME.email, isOwner: ME.isOwner, canEdit: ME.canEdit}),
    id: () => Promise.resolve(ME.id),
    name: () => Promise.resolve(ME.name),
    avatarUrl: () => Promise.resolve(ME.avatarUrl),
    email: () => Promise.resolve(ME.email),
    profiles: ids => { const list = typeof ids === 'string' ? [ids] : ids; const out = {}; list.forEach(id => out[id] = profOf(id)); return Promise.resolve(out); },
    search: s => { const qs = String(s || '').toLowerCase(); const all = Object.values(IDENT).map(x => profOf(x.id)); return Promise.resolve(qs ? all.filter(p => p.name.toLowerCase().includes(qs) || (p.email || '').includes(qs)) : all.slice(0, 8)); }
  });

  /* ---------------- mcp ---------------- */
  const mcpErr = {};
  (q.get('mcperr') || '').split(',').filter(Boolean).forEach(kv => { const [s, c] = kv.split(':'); mcpErr[s] = c; });
  const perm = {};
  (q.get('perm') || '').split(',').filter(Boolean).forEach(kv => { const [s, c] = kv.split(':'); perm[s] = c; });
  const now = Date.now();
  const iso = d => new Date(d).toISOString();
  const PAYLOAD = {
    'Google Calendar': {events: [
      {id: 'e1', summary: 'Swisse reel review', start: {dateTime: iso(now + 3600000)}, end: {dateTime: iso(now + 5400000)}, htmlLink: 'https://calendar.google.com/', conferenceUrl: 'https://meet.google.com/abc-defg-hij', eventType: 'default'},
      {id: 'e2', summary: 'Pod stand-up', start: {dateTime: iso(now + 7200000)}, end: {dateTime: iso(now + 9000000)}, htmlLink: 'https://calendar.google.com/', eventType: 'default'}
    ]},
    'Gmail': {threads: [
      {messages: [{subject: 'Blah Studio call sheet', sender: 'Priya at Blah Studio', date: iso(now - 600000)}]},
      {messages: [{subject: 'Swisse UAE approvals', sender: 'Omar Haddad', date: iso(now - 3600000)}]},
      {messages: [{subject: 'Invoice 0921', sender: 'Accounts', date: iso(now - 7200000)}]}
    ], resultCountEstimate: '201'},
    'Google Drive': {files: [
      {title: 'Swisse reel scripts v3', mimeType: 'application/vnd.google-apps.document', viewUrl: 'https://drive.google.com/', modifiedTime: iso(now - 900000)},
      {title: 'Shoot schedule', mimeType: 'application/vnd.google-apps.spreadsheet', viewUrl: 'https://drive.google.com/', modifiedTime: iso(now - 4000000)},
      {title: 'Moodboard.pdf', mimeType: 'application/pdf', viewUrl: 'https://drive.google.com/', modifiedTime: iso(now - 8000000)},
      {title: 'Pitch deck Q4', mimeType: 'application/vnd.google-apps.presentation', viewUrl: 'https://drive.google.com/', modifiedTime: iso(now - 90000000)},
      {title: 'Brand book', mimeType: 'application/pdf', viewUrl: 'https://drive.google.com/', modifiedTime: iso(now - 180000000)}
    ]}
  };
  window.__mcpCalls = [];
  const mcp = Object.freeze({
    watchTool: (server, tool, input, handler, opts) => {
      window.__mcpCalls.push({server, tool, input, opts});
      const code = mcpErr[server];
      let alive = true;
      setTimeout(() => {
        if (!alive) return;
        if (code === 'server_unavailable') {
          handler({type: 'data', result: {content: [], payload: PAYLOAD[server], cache: {storedAt: now - 7200000, revalidating: false}}});
          setTimeout(() => alive && handler({type: 'error', error: {code, server, message: 'upstream unreachable', retryable: true}}), 30);
        } else if (code) handler({type: 'error', error: {code, server, message: 'mock ' + code}});
        else handler({type: 'data', result: {content: [], payload: PAYLOAD[server]}});
      }, 60);
      return () => { alive = false; };
    },
    callTool: (server, tool, input) => Promise.resolve({content: [], payload: PAYLOAD[server]}),
    listTools: () => Promise.resolve({servers: Object.keys(PAYLOAD).map(s => ({server: s, authStatus: 'connected', tools: []}))}),
    server: () => Promise.reject({code: 'server_not_connected', message: 'mock'}),
    invalidate: () => Promise.resolve(),
    describeTool: () => Promise.reject({code: 'bad_request', message: 'mock'})
  });

  const permissions = Object.freeze({
    state: name => Promise.resolve(name ? (perm[(name || '').replace(/^mcp:/, '')] || 'granted') : {db: 'granted', user: 'granted'}),
    request: names => { const o = {}; (names || []).forEach(n => { perm[(n || '').replace(/^mcp:/, '')] = 'granted'; o[n] = 'granted'; }); window.__permRequests = (window.__permRequests || []).concat([names]); return Promise.resolve(o); }
  });
  window.__downloads = [];
  const downloads = Object.freeze({save: ({filename, data}) => { window.__downloads.push({filename, data: typeof data === 'string' ? data : '[binary]'}); return Promise.resolve({status: 'saved'}); }});

  const caps = {db: q.get('nocap') === '1' ? null : db, user: q.get('nocap') === '1' ? null : user,
    mcp: q.get('nomcp') === '1' ? null : mcp, downloads: q.get('nodl') === '1' ? null : downloads, permissions};
  const memo = {};
  window.claude = {use: name => memo[name] || (memo[name] = new Promise(r => setTimeout(() => r(caps[name] === undefined ? null : caps[name]), 40)))};

  /* ---------------- seed (section 13) ---------------- */
  if (q.get('seed') === '1' && !store['settings/app']) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/seed/seed.json', false);
    xhr.send();
    if (xhr.status === 200) {
      const seed = JSON.parse(xhr.responseText);
      for (const p of Object.keys(seed)) store[p] = seed[p];
      persist();
    }
  }
})();
