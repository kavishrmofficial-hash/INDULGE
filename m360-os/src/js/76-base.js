/* module: base. The database: everyone we know (contacts), who we know them through (orgs),
   and what we do with them (clients, projects, pitches). Records live in pages of at most 200
   rows (contacts/p000, orgs/p000, ...) so the database stays fast on both runtimes. A monthly
   Apollo CSV lands through Import and keeps only the columns that matter; hand edits always win
   over Apollo. Companies map to client pages both ways. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const PAGE_MAX = 200;
  const PAGE_BYTES = 160 * 1024;   /* a page document stays well under the server's 256 KiB */
  const LIST_MAX = 40;             /* keywords and tags per record; Apollo sends hundreds */
  const TEXT_MAX = 600;            /* any one text field */
  const STAGES = [{v: '', label: 'No stage'}, {v: 'lead', label: 'Lead'}, {v: 'contacted', label: 'Contacted'},
    {v: 'replied', label: 'Replied'}, {v: 'meeting', label: 'Meeting'}, {v: 'client', label: 'Client'}, {v: 'lost', label: 'Lost'}];
  const STAGE_PILL = {client: 'ink', meeting: 'warm', lost: 'flame-o'};
  const SOURCES = [{v: 'apollo', label: 'Apollo'}, {v: 'manual', label: 'Added by hand'}, {v: 'client', label: 'From a client'}];
  /* fields a person may edit by hand; the rest are system fields */
  const SYS = ['id', 'at', 'updated', 'updatedBy', 'edited', 'source', 'apolloId'];
  const CONTACT_LIST = ['tags'];
  const ORG_LIST = ['keywords', 'tags'];
  const EXPORT_CONTACT = ['name', 'first', 'last', 'title', 'orgName', 'email', 'email2', 'phone', 'mobile', 'linkedin',
    'city', 'state', 'country', 'seniority', 'dept', 'stage', 'tags', 'source', 'notes'];
  const EXPORT_ORG = ['name', 'domain', 'website', 'industry', 'size', 'city', 'state', 'country', 'linkedin', 'phone',
    'keywords', 'tags', 'client', 'notes'];

  const blankContact = () => ({first: '', last: '', name: '', title: '', email: '', email2: '', phone: '', mobile: '', linkedin: '',
    org: '', orgName: '', city: '', state: '', country: '', seniority: '', dept: '', source: 'manual', apolloId: '', tags: [],
    stage: '', owner: '', notes: '', edited: {}, archived: false});
  const blankOrg = () => ({name: '', domain: '', website: '', industry: '', size: '', city: '', state: '', country: '', linkedin: '',
    phone: '', keywords: [], source: 'manual', apolloId: '', client: '', tags: [], notes: '', edited: {}, archived: false});

  /* ---------- normalisers ---------- */
  const SUFFIX = /\s+(pvt ltd|private limited|ltd|limited|llp|inc|llc|co|corp|corporation|company|plc|fze|fzco|fz llc|gmbh|sa|ag)$/;
  const FREE_MAIL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|protonmail|proton|rediffmail|rediff|ymail|msn)\./;
  const norm = {
    text: s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(),
    mail: s => String(s || '').trim().toLowerCase(),
    domain: s => {
      let d = String(s || '').trim().toLowerCase();
      if (!d) return '';
      if (d.indexOf('@') >= 0) d = d.split('@').pop();
      d = d.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].split(':')[0];
      return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : '';
    },
    /* company domain from a website, else from a work email (free mail providers give nothing) */
    orgDomain: (website, email) => {
      const w = norm.domain(website);
      if (w) return w;
      const e = norm.domain(email);
      return e && !FREE_MAIL.test(e) ? e : '';
    },
    name: s => {
      let n = String(s || '').toLowerCase().replace(/[^a-z0-9\s&]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');
      for (let i = 0; i < 4; i++) { const m = n.replace(SUFFIX, '').trim(); if (m === n) break; n = m; }
      return n;
    },
    phone: s => String(s || '').replace(/[^\d+]/g, ''),
    list: s => (Array.isArray(s) ? s.map(x => norm.text(x)).filter(Boolean)
      : String(s || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean)).slice(0, LIST_MAX)
  };
  norm['email'] = norm.mail;
  const uniq = xs => { const seen = {}; return (xs || []).filter(x => { const k = String(x).toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; }); };
  const newId = prefix => {
    let s = '';
    try { const b = new Uint8Array(10); crypto.getRandomValues(b); s = Array.from(b).map(x => (x % 36).toString(36)).join(''); }
    catch (e) { s = ''; }
    while (s.length < 10) s += Math.floor(Math.random() * 36).toString(36);
    return prefix + s.slice(0, 10);
  };
  const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

  /* ---------- the index: every page folded into two sorted lists, memoised on the maps ---------- */
  let ixCache = {c: null, o: null, out: null};
  function index(ctx) {
    const cm = ctx.coll.contacts.map, om = ctx.coll.orgs.map;
    if (ixCache.out && ixCache.c === cm && ixCache.o === om) return ixCache.out;
    const fold = (map, prefix) => {
      const list = [], byId = {}, pageOf = {}, pages = Object.keys(map).sort();
      for (const pid of pages) {
        const rows = (map[pid] || {}).rows || {};
        for (const id of Object.keys(rows)) {
          const r = {...rows[id], id};
          list.push(r); byId[id] = r; pageOf[id] = pid;
        }
      }
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return {list, byId, pageOf, pages};
    };
    const c = fold(cm, 'c'), o = fold(om, 'o');
    /* search blobs, lowercased once */
    c.list.forEach(r => {
      const on = r.org && o.byId[r.org] ? o.byId[r.org].name : r.orgName;
      r._on = on || '';
      r._s = [r.name, r.title, r['email'], r.email2, r.phone, r.mobile, on, r.orgName, r.city, r.country, (r.tags || []).join(' '), r.notes]
        .map(x => String(x || '')).join(' \n ').toLowerCase();
    });
    o.list.forEach(r => {
      r._s = [r.name, r.domain, r.industry, r.city, r.country, (r.tags || []).join(' '), (r.keywords || []).join(' '), r.notes]
        .map(x => String(x || '')).join(' \n ').toLowerCase();
    });
    const out = {contacts: c.list, orgs: o.list, cById: c.byId, oById: o.byId, cPage: c.pageOf, oPage: o.pageOf, cPages: c.pages, oPages: o.pages};
    ixCache = {c: cm, o: om, out};
    return out;
  }
  const all = ctx => { const ix = index(ctx); return {contacts: ix.contacts, orgs: ix.orgs}; };
  const contact = (ctx, id) => index(ctx).cById[id] || null;
  const org = (ctx, id) => index(ctx).oById[id] || null;
  const peopleAt = (ctx, orgId) => orgId ? index(ctx).contacts.filter(c => c.org === orgId && !c.archived) : [];
  const orgForClient = (ctx, clientId) => {
    if (!clientId) return null;
    const c = ctx.coll.clients.map[clientId];
    const ix = index(ctx);
    if (c && c.org && ix.oById[c.org]) return ix.oById[c.org];
    return ix.orgs.find(o => o.client === clientId) || null;
  };
  const pageFor = (ctx, coll, id) => (coll === 'orgs' ? index(ctx).oPage[id] : index(ctx).cPage[id]) || null;
  /* the last page with room, else the next page id */
  const bytesOf = x => JSON.stringify(x === undefined ? null : x).length;
  function roomIn(ctx, coll, counts, bytes, need) {
    const ix = index(ctx);
    const map = ctx.coll[coll].map;
    const pages = uniq((coll === 'orgs' ? ix.oPages : ix.cPages).concat(counts ? Object.keys(counts) : [])).sort();
    const count = pid => counts && counts[pid] != null ? counts[pid] : Object.keys((map[pid] || {}).rows || {}).length;
    const size = pid => { if (bytes && bytes[pid] != null) return bytes[pid]; const b = map[pid] ? bytesOf(map[pid].rows || {}) : 0; if (bytes) bytes[pid] = b; return b; };
    for (let i = pages.length - 1; i >= 0; i--) {
      if (count(pages[i]) < PAGE_MAX && size(pages[i]) + (need || 0) <= PAGE_BYTES) return {pid: pages[i], n: count(pages[i]), isNew: !map[pages[i]]};
    }
    let next = 0;
    for (const p of pages) { const k = parseInt(String(p).slice(1), 10); if (k >= next) next = k + 1; }
    return {pid: 'p' + String(next).padStart(3, '0'), n: 0, isNew: true};
  }

  /* rank: exact name start first, then a word start, then anywhere */
  function rank(r, q) {
    const nm = String(r.name || '').toLowerCase();
    if (nm.indexOf(q) === 0) return 0;
    if (nm.split(/\s+/).some(w => w.indexOf(q) === 0)) return 1;
    return 2;
  }
  function find(ctx, q, opts) {
    opts = opts || {};
    const s = String(q || '').trim().toLowerCase();
    const ix = index(ctx);
    const keep = r => opts.archived ? true : !r.archived;
    const lim = opts.limit || 0;
    let contacts = ix.contacts.filter(keep), orgs = ix.orgs.filter(keep);
    if (s) {
      contacts = contacts.filter(r => r._s.indexOf(s) >= 0).map(r => [rank(r, s), r]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      orgs = orgs.filter(r => r._s.indexOf(s) >= 0).map(r => [rank(r, s), r]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    }
    if (opts.contacts === false) contacts = [];
    if (opts.orgs === false) orgs = [];
    if (lim) { contacts = contacts.slice(0, lim); orgs = orgs.slice(0, lim); }
    return {contacts, orgs};
  }

  /* ---------- the data layer: the server on the team site, the local index elsewhere ----------
     A page never holds 25,000 rows here: lists, search, one row, the people at a company and the counts
     come from the server (basesearch, baseget, basestats), the browser keeps what it shows. On the
     claude.ai page and in tests the same calls run against the local index. */
  const remote = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');
  const api = (a, body) => window.M360_API(a, body || {});
  let tick = 0;
  const tickSubs = new Set();
  const touch = () => { tick++; tickSubs.forEach(f => { try { f(tick); } catch (e) { /* page handler */ } }); };
  const useTick = () => { const [t, setT] = useState(tick); useEffect(() => { tickSubs.add(setT); return () => tickSubs.delete(setT); }, []); return t; };
  const countsByOrg = ix => { const n = {}, last = {}; ix.contacts.forEach(c => { if (c.archived || !c.org) return; n[c.org] = (n[c.org] || 0) + 1; last[c.org] = Math.max(last[c.org] || 0, Number(c.updated) || 0); }); return {n, last}; };
  /* the same answer basesearch gives, from the local index */
  function localQuery(ctx, coll, o) {
    o = o || {};
    const ix = index(ctx);
    const q = String(o.q || '').trim().toLowerCase();
    const ids = Array.isArray(o.ids) ? new Set(o.ids) : null;
    let orgId = o.org || '';
    if (!orgId && o.client) { const org0 = orgForClient(ctx, o.client); if (!org0) return {total: 0, rows: [], facets: {}, orgs: []}; orgId = org0.id; }
    const src = coll === 'orgs' ? ix.orgs : ix.contacts;
    let list = src.filter(r => {
      if (ids) { if (!ids.has(r.id)) return false; } else if (o.archived ? !r.archived : r.archived) return false;
      if (orgId && r.org !== orgId) return false;
      if (o.stage && r.stage !== o.stage) return false;
      if (o.owner && r.owner !== o.owner) return false;
      if (o.country && r.country !== o.country) return false;
      if (o.source && r.source !== o.source) return false;
      if (o.industry && r.industry !== o.industry) return false;
      if (o.tag && (r.tags || []).indexOf(o.tag) < 0) return false;
      if (o.map === 'yes' && !r.client) return false;
      if (o.map === 'no' && r.client) return false;
      if (q && r._s.indexOf(q) < 0) return false;
      return true;
    });
    if (q) list = list.map(r => [rank(r, q), r]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const offset = o.offset || 0, limit = o.limit || 60;
    let rows = list.slice(offset, offset + limit);
    const pc = countsByOrg(ix);
    if (coll === 'orgs') rows = rows.map(r => ({...r, people: pc.n[r.id] || 0, lastPerson: pc.last[r.id] || 0}));
    const facets = coll === 'orgs' ? {industries: distinct(ix.orgs, 'industry'), countries: distinct(ix.orgs, 'country')}
      : {countries: distinct(ix.contacts, 'country'), tags: uniq(ix.contacts.reduce((a, c) => a.concat(c.tags || []), [])).sort()};
    const orgs = coll === 'contacts' && q && !orgId ? ix.orgs.filter(r => !r.archived && r._s.indexOf(q) >= 0).map(r => [rank(r, q), r]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(x => ({id: x[1].id, name: x[1].name, people: pc.n[x[1].id] || 0})) : [];
    return {total: list.length, rows, facets, orgs};
  }
  const query = (ctx, coll, o) => remote() ? api('basesearch', {coll, ...(o || {})}) : Promise.resolve(localQuery(ctx, coll, o));
  /* one full row and its page */
  async function getRow(ctx, coll, id) {
    if (remote()) { const r = await api('baseget', {coll, id}); return r && r.row ? {row: r.row, pid: r.pid, people: r.people} : null; }
    const ix = index(ctx);
    const row = coll === 'orgs' ? ix.oById[id] : ix.cById[id];
    return row ? {row, pid: coll === 'orgs' ? ix.oPage[id] : ix.cPage[id]} : null;
  }
  async function orgForClientAsync(ctx, clientId) {
    if (!clientId) return null;
    if (remote()) { const r = await api('baseget', {coll: 'orgs', client: clientId}); return r && r.row ? {...r.row, pid: r.pid} : null; }
    const o = orgForClient(ctx, clientId);
    return o ? {...o, pid: index(ctx).oPage[o.id]} : null;
  }
  const peopleAtAsync = (ctx, orgId, limit) => orgId ? query(ctx, 'contacts', {org: orgId, limit: limit || 200}).then(r => r.rows) : Promise.resolve([]);
  const statsAsync = ctx => {
    if (remote()) return api('basestats');
    const {contacts, orgs} = all(ctx); const cm = ctx.coll.clients.map;
    return Promise.resolve({people: contacts.filter(c => !c.archived).length, companies: orgs.filter(o => !o.archived).length, mapped: orgs.filter(o => !o.archived && o.client && cm[o.client]).length});
  };
  /* a query as a hook: the answer, and loading while it is on its way; asked again after any write here */
  function useQuery(coll, o, on) {
    const ctx = M.useCtx();
    const t = useTick();
    const key = JSON.stringify(o || {});
    const isRemote = remote();
    const ix = isRemote ? null : index(ctx);
    const local = useMemo(() => (isRemote || on === false) ? null : localQuery(ctx, coll, o), [isRemote, on, ix, key, ctx.coll.clients.map]);
    const [st, setSt] = useState({rows: [], total: 0, facets: {}, orgs: [], loading: true});
    useEffect(() => {
      if (!isRemote || on === false) return;
      let live = true;
      setSt(x => ({...x, loading: true}));
      api('basesearch', {coll, ...(o || {})}).then(r => { if (live) setSt({rows: r.rows || [], total: r.total || 0, facets: r.facets || {}, orgs: r.orgs || [], loading: false, v: r.v}); },
        e => { if (live) setSt(x => ({...x, loading: false, err: (e && e.message) || 'The database did not answer.'})); });
      return () => { live = false; };
    }, [isRemote, on, key, t]);
    if (on === false) return {rows: [], total: 0, facets: {}, orgs: [], loading: false};
    return local ? {...local, loading: false} : st;
  }
  function useRow(coll, id) {
    const ctx = M.useCtx();
    const t = useTick();
    const isRemote = remote();
    const ix = isRemote ? null : index(ctx);
    const local = useMemo(() => {
      if (isRemote || !id) return null;
      const row = coll === 'orgs' ? ix.oById[id] : ix.cById[id];
      return {row: row || null, pid: row ? (coll === 'orgs' ? ix.oPage[id] : ix.cPage[id]) : null, loading: false};
    }, [isRemote, ix, coll, id]);
    const [st, setSt] = useState({row: null, pid: null, loading: !!id});
    useEffect(() => {
      if (!isRemote || !id) return;
      let live = true;
      api('baseget', {coll, id}).then(r => { if (live) setSt({row: r && r.row ? r.row : null, pid: r ? r.pid : null, people: r ? r.people : 0, loading: false}); },
        () => { if (live) setSt({row: null, pid: null, loading: false, err: true}); });
      return () => { live = false; };
    }, [isRemote, coll, id, t]);
    if (!id) return {row: null, pid: null, loading: false};
    return local || st;
  }
  function useOrgForClient(clientId, orgId) {
    const ctx = M.useCtx();
    const t = useTick();
    const isRemote = remote();
    const ix = isRemote ? null : index(ctx);
    const local = useMemo(() => { if (isRemote) return null; const o = (orgId && ix.oById[orgId]) || (clientId ? orgForClient(ctx, clientId) : null); return {org: o ? {...o, pid: ix.oPage[o.id]} : null, loading: false}; }, [isRemote, ix, clientId, orgId]);
    const [st, setSt] = useState({org: null, loading: !!(clientId || orgId)});
    useEffect(() => {
      if (!isRemote || !(clientId || orgId)) return;
      let live = true;
      const p = orgId ? api('baseget', {coll: 'orgs', id: orgId}) : api('baseget', {coll: 'orgs', client: clientId});
      p.then(r => { if (live) setSt({org: r && r.row ? {...r.row, pid: r.pid, people: r.people} : null, loading: false}); }, () => { if (live) setSt({org: null, loading: false}); });
      return () => { live = false; };
    }, [isRemote, clientId, orgId, t]);
    if (!(clientId || orgId)) return {org: null, loading: false};
    return local || st;
  }
  const usePeopleAt = (orgId, limit) => useQuery('contacts', {org: orgId || '', limit: limit || 200}, !!orgId);
  function useStats() {
    const ctx = M.useCtx();
    const t = useTick();
    const isRemote = remote();
    const ix = isRemote ? null : index(ctx);
    const [st, setSt] = useState({people: 0, companies: 0, mapped: 0, loading: true});
    useEffect(() => { if (!isRemote) return; let live = true; api('basestats').then(r => { if (live) setSt({...r, loading: false}); }, () => { if (live) setSt(x => ({...x, loading: false})); }); return () => { live = false; }; }, [isRemote, t, ctx.coll.clients.map]);
    const local = useMemo(() => { if (isRemote) return null; const cm = ctx.coll.clients.map; return {people: ix.contacts.filter(c => !c.archived).length, companies: ix.orgs.filter(o => !o.archived).length, mapped: ix.orgs.filter(o => !o.archived && o.client && cm[o.client]).length, loading: false}; }, [isRemote, ix, ctx.coll.clients.map]);
    return local || st;
  }
  /* the page a new row goes on */
  const roomFor = (ctx, coll, need) => remote() ? api('baseroom', {coll, need: need || 0}) : Promise.resolve(roomIn(ctx, coll, null, null, need));

  /* ---------- writes ---------- */
  function editedOf(patch) {
    const e = {};
    Object.keys(patch).forEach(k => { if (SYS.indexOf(k) < 0 && k !== 'archived') e[k] = true; });
    return e;
  }
  async function upsertContact(ctx, patch) {
    const now = Date.now();
    patch = {...patch};
    if (patch.tags) patch.tags = uniq(norm.list(patch.tags));
    const existing = patch.id ? await getRow(ctx, 'contacts', patch.id) : null;
    if (existing) {
      const id = patch.id; delete patch.id;
      if (patch.org && !patch.orgName) { const o = await getRow(ctx, 'orgs', patch.org); if (o) patch.orgName = o.row.name; }
      await ctx.W.merge('contacts/' + existing.pid, {rows: {[id]: {...patch, edited: editedOf(patch), updated: now, updatedBy: ctx.uid}}});
      touch();
      return id;
    }
    const id = patch.id || newId('c_');
    const doc = {...blankContact(), ...patch, id, at: now, updated: now, updatedBy: ctx.uid};
    doc.name = norm.text(doc.name || (doc.first + ' ' + doc.last));
    if (!doc.first && !doc.last && doc.name) { const w = doc.name.split(' '); doc.first = w[0]; doc.last = w.slice(1).join(' '); }
    if (doc.org && !doc.orgName) { const o = await getRow(ctx, 'orgs', doc.org); if (o) doc.orgName = o.row.name; }
    const room = await roomFor(ctx, 'contacts', bytesOf(doc) + 40);
    await ctx.W.merge('contacts/' + room.pid, {rows: {[id]: doc}, n: room.n + 1});
    touch();
    return id;
  }
  async function upsertOrg(ctx, patch) {
    const now = Date.now();
    patch = {...patch};
    if (patch.tags) patch.tags = uniq(norm.list(patch.tags));
    if (patch.keywords) patch.keywords = uniq(norm.list(patch.keywords));
    if (patch.website && !patch.domain) patch.domain = norm.domain(patch.website);
    const existing = patch.id ? await getRow(ctx, 'orgs', patch.id) : null;
    if (existing) {
      const id = patch.id; delete patch.id;
      await ctx.W.merge('orgs/' + existing.pid, {rows: {[id]: {...patch, edited: editedOf(patch), updated: now, updatedBy: ctx.uid}}});
      /* the company name rides on every contact at the company */
      if (patch.name && patch.name !== existing.row.name) {
        const byPage = {};
        (await peopleAtAsync(ctx, id, 2000)).forEach(c => { const p = c.pid || pageFor(ctx, 'contacts', c.id); if (p) (byPage[p] = byPage[p] || {})[c.id] = {orgName: patch.name}; });
        for (const p of Object.keys(byPage)) await ctx.W.merge('contacts/' + p, {rows: byPage[p]});
      }
      touch();
      return id;
    }
    const id = patch.id || newId('o_');
    const doc = {...blankOrg(), ...patch, id, at: now, updated: now, updatedBy: ctx.uid};
    doc.name = norm.text(doc.name);
    const room = await roomFor(ctx, 'orgs', bytesOf(doc) + 40);
    await ctx.W.merge('orgs/' + room.pid, {rows: {[id]: doc}, n: room.n + 1});
    touch();
    return id;
  }
  async function archive(ctx, coll, id, on) {
    const cur = await getRow(ctx, coll, id);
    if (!cur) return;
    await ctx.W.merge(coll + '/' + cur.pid, {rows: {[id]: {archived: on !== false, updated: Date.now(), updatedBy: ctx.uid}}});
    touch();
  }

  /* ---------- clients: two way mapping ---------- */
  const clientNorm = c => ({name: norm.name(c.name), domain: norm.domain(c.domain || c.website || '')});
  /* the org that matches a client by name or domain (Pvt Ltd, Ltd, LLP, Inc and friends ignored) */
  function orgMatching(orgs, client) {
    const cn = clientNorm(client);
    if (!cn.name && !cn.domain) return null;
    return orgs.find(o => !o.archived && ((cn.domain && o.domain === cn.domain) || (cn.name && norm.name(o.name) === cn.name))) || null;
  }
  function clientMatching(clientsMap, o) {
    const on = norm.name(o.name);
    for (const cid of Object.keys(clientsMap)) {
      const cn = clientNorm(clientsMap[cid]);
      if ((o.domain && cn.domain && o.domain === cn.domain) || (on && cn.name === on)) return cid;
    }
    return null;
  }
  async function linkOrgToClient(ctx, orgId, clientId) {
    const cur = await getRow(ctx, 'orgs', orgId), c = ctx.coll.clients.map[clientId];
    if (!cur || !c) return false;
    const now = Date.now();
    if (cur.row.client !== clientId) await ctx.W.merge('orgs/' + cur.pid, {rows: {[orgId]: {client: clientId, updated: now, updatedBy: ctx.uid}}});
    if (c.org !== orgId) await ctx.W.update('clients/' + clientId, {org: orgId, updated: now});
    touch();
    return true;
  }
  async function unlinkOrg(ctx, orgId) {
    const cur = await getRow(ctx, 'orgs', orgId);
    if (!cur) return;
    const o = cur.row;
    const now = Date.now();
    const c = o.client ? ctx.coll.clients.map[o.client] : null;
    await ctx.W.merge('orgs/' + cur.pid, {rows: {[orgId]: {client: '', updated: now, updatedBy: ctx.uid}}});
    if (c && c.org === orgId) await ctx.W.update('clients/' + o.client, {org: '', updated: now});
    touch();
  }
  async function makeClientFromOrg(ctx, orgId) {
    const cur = await getRow(ctx, 'orgs', orgId);
    if (!cur) return null;
    const o = cur.row;
    const now = Date.now();
    const cid = U.uid();
    const doc = {name: o.name || 'Client', status: 'live', pod: '', owner: ctx.uid, memory: '', approvals: '', never: '',
      links: o.website || '', updated: now, by: ctx.uid, org: orgId};
    await ctx.W.set('clients/' + cid, doc);
    await ctx.W.merge('orgs/' + cur.pid, {rows: {[orgId]: {client: cid, updated: now, updatedBy: ctx.uid}}});
    /* everyone at the company moves to the client stage */
    const byPage = {};
    (await peopleAtAsync(ctx, orgId, 2000)).forEach(c => { const p = c.pid || pageFor(ctx, 'contacts', c.id); if (p && c.stage !== 'client') (byPage[p] = byPage[p] || {})[c.id] = {stage: 'client', updated: now, updatedBy: ctx.uid}; });
    for (const p of Object.keys(byPage)) await ctx.W.merge('contacts/' + p, {rows: byPage[p]});
    touch();
    return cid;
  }
  /* clients that were never mapped find their company by name or domain, once, on the claude.ai page (the server maps at import) */
  function useAutoMap(ctx) {
    const tried = useRef({});
    useEffect(() => {
      if (remote() || !ctx.coll.clients.ready || !ctx.coll.orgs.ready) return;
      const cm = ctx.coll.clients.map;
      const {orgs} = all(ctx);
      for (const cid of Object.keys(cm)) {
        const c = cm[cid];
        /* org missing: never mapped, so look for one. org '': unmapped by hand, so leave it. */
        if (c.org != null || tried.current[cid]) continue;
        const o = orgs.find(x => x.client === cid) || orgMatching(orgs, c);
        if (!o || (o.client && o.client !== cid)) continue;
        tried.current[cid] = true;
        linkOrgToClient(ctx, o.id, cid).catch(() => {});
      }
    }, [ctx.coll.clients.map, ctx.coll.orgs.map]);
  }

  /* ---------- CSV: RFC 4180 in, plain rows out ---------- */
  function parseCsv(text) {
    let s = String(text || '');
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    const rows = [];
    let row = [], cell = '', q = false, i = 0;
    const n = s.length;
    while (i < n) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        row.push(cell); rows.push(row); row = []; cell = ''; i++;
        if (ch === '\r' && s[i] === '\n') i++;
        continue;
      }
      cell += ch; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const clean = rows.filter(r => r.some(c => c.trim() !== ''));
    const headers = (clean.shift() || []).map(h => h.trim());
    return {headers, rows: clean};
  }
  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  /* A CSV file read in slices, so a 140 MB Apollo export never sits in memory as one string. The
     bytes are scanned for rows and cells; only the columns in keep (by index) are decoded, each into
     its own string, so nothing pins a slice of the file in memory. The first five rows keep every
     column for the preview and the mapping table. With no keep given, the columns Apollo names in a
     way we know are kept. Rows are sparse arrays indexed by column, the shape planImport expects. */
  const QUOTE = 34, COMMA = 44, CR = 13, LF = 10;
  async function readCsvFile(file, opts) {
    const keepIn = opts && opts.keep ? new Set(opts.keep) : null;
    const onProgress = opts && opts.onProgress;
    const dec = new TextDecoder('utf-8');
    const SLICE = 4 * 1024 * 1024;
    let headers = null, keep = null;
    const rows = [];
    const cellText = (b, a, z, quoted) => { let t = dec.decode(b.subarray(a, z)); if (quoted) t = t.replace(/""/g, '"'); return t; };
    /* one complete row of bytes [a, z): its cells, kept ones decoded */
    const takeRow = (b, a, z) => {
      const row = [];
      let ci = 0, i = a, any = false;
      const wantAll = !headers || rows.length < 5;
      while (i <= z) {
        let quoted = false, cs = i, ce = i;
        if (i < z && b[i] === QUOTE) {
          quoted = true; cs = i + 1; let j = cs;
          while (j < z) { if (b[j] === QUOTE) { if (b[j + 1] === QUOTE && j + 1 < z) { j += 2; continue; } break; } j++; }
          ce = j; i = j + 1;
          while (i < z && b[i] !== COMMA) i++;
        } else {
          let j = i; while (j < z && b[j] !== COMMA) j++;
          ce = j; i = j;
        }
        if (wantAll || (keep && keep.has(ci))) { const t = cellText(b, cs, ce, quoted); row[ci] = t; if (!any && t.trim() !== '') any = true; }
        else if (!any && ce > cs) any = true;
        ci++;
        if (i >= z) break;
        i++; /* past the comma */
        if (i === z) { if (wantAll || (keep && keep.has(ci))) row[ci] = ''; ci++; break; }
      }
      if (!headers) {
        headers = row.map(h => String(h || '').trim());
        keep = keepIn || new Set(headers.map((h, k) => ALIAS[headerKey(h)] ? k : -1).filter(k => k >= 0));
      } else if (any) rows.push(row);
    };
    let carry = new Uint8Array(0);
    let first = true;
    for (let at = 0; at < file.size; at += SLICE) {
      const fresh = new Uint8Array(await file.slice(at, Math.min(file.size, at + SLICE)).arrayBuffer());
      let b;
      if (carry.length) { b = new Uint8Array(carry.length + fresh.length); b.set(carry); b.set(fresh, carry.length); } else b = fresh;
      let i = 0;
      if (first) { first = false; if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) i = 3; }
      let rowStart = i, q = false, lastEnd = i;
      const n = b.length;
      const last = at + SLICE >= file.size;
      while (i < n) {
        const c = b[i];
        if (q) { if (c === QUOTE) { if (b[i + 1] === QUOTE) { i += 2; continue; } q = false; } i++; continue; }
        if (c === QUOTE) { q = true; i++; continue; }
        if (c === CR || c === LF) {
          if (c === CR && i + 1 >= n && !last) break; /* the LF may be in the next slice */
          takeRow(b, rowStart, i);
          i++; if (c === CR && b[i] === LF) i++;
          rowStart = i; lastEnd = i;
          continue;
        }
        i++;
      }
      if (last) { if (rowStart < n) takeRow(b, rowStart, n); carry = new Uint8Array(0); }
      else carry = b.slice(lastEnd);
      if (onProgress) onProgress(Math.min(1, (at + SLICE) / file.size));
    }
    if (!headers) headers = [];
    return {headers, rows, kept: keep || new Set(), preview: rows.slice(0, 5), file, size: file.size};
  }

  /* ---------- Apollo's columns: the ones that matter, by alias ---------- */
  const ALIAS = {
    'first name': 'first', 'last name': 'last', 'name': 'name', 'full name': 'name', 'title': 'title', 'job title': 'title',
    'company': 'orgName', 'company name': 'orgName', 'company name for emails': 'orgName', 'organization': 'orgName', 'organisation': 'orgName', 'account': 'orgName', 'account name': 'orgName',
    'email': 'email', 'email address': 'email', 'work email': 'email', 'secondary email': 'email2', 'personal email': 'email2',
    'seniority': 'seniority', 'departments': 'dept', 'department': 'dept',
    'work direct phone': 'phone', 'direct phone': 'phone', 'phone': 'phone', 'phone number': 'phone', 'corporate phone': 'phone', 'mobile phone': 'mobile', 'mobile': 'mobile',
    'company phone': 'orgPhone', '# employees': 'orgSize', 'employees': 'orgSize', 'company size': 'orgSize', 'industry': 'orgIndustry', 'keywords': 'orgKeywords',
    'person linkedin url': 'linkedin', 'linkedin url': 'linkedin', 'linkedin': 'linkedin',
    'website': 'orgWebsite', 'company website': 'orgWebsite', 'company domain': 'orgDomain', 'domain': 'orgDomain', 'company linkedin url': 'orgLinkedin',
    'city': 'city', 'state': 'state', 'country': 'country', 'company city': 'orgCity', 'company state': 'orgState', 'company country': 'orgCountry',
    'apollo contact id': 'apolloId', 'contact id': 'apolloId', 'apollo account id': 'orgApolloId', 'account id': 'orgApolloId',
    'stage': 'stage', 'contact stage': 'stage', 'lists': 'tags', 'tags': 'tags', 'contact owner': 'owner', 'owner': 'owner', 'notes': 'notes', 'company notes': 'orgNotes'
  };
  const FIELD_OPTS = [{v: '', label: 'Ignore'},
    ...[['first', 'first name'], ['last', 'last name'], ['name', 'full name'], ['title', 'title'], ['email', 'email'], ['email2', 'second email'],
      ['phone', 'phone'], ['mobile', 'mobile'], ['linkedin', 'linkedin'], ['city', 'city'], ['state', 'state'], ['country', 'country'],
      ['seniority', 'seniority'], ['dept', 'department'], ['stage', 'stage'], ['tags', 'tags'], ['owner', 'owner'], ['apolloId', 'apollo contact id'], ['notes', 'notes']]
      .map(x => ({v: x[0], label: 'person: ' + x[1]})),
    ...[['orgName', 'name'], ['orgDomain', 'domain'], ['orgWebsite', 'website'], ['orgIndustry', 'industry'], ['orgSize', 'size'], ['orgCity', 'city'],
      ['orgState', 'state'], ['orgCountry', 'country'], ['orgLinkedin', 'linkedin'], ['orgPhone', 'phone'], ['orgKeywords', 'keywords'],
      ['orgApolloId', 'apollo account id'], ['orgNotes', 'notes']].map(x => ({v: x[0], label: 'company: ' + x[1]}))];
  const FIELD_LABEL = {};
  FIELD_OPTS.forEach(o => { FIELD_LABEL[o.v] = o.label; });
  const headerKey = h => String(h || '').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
  const mapApollo = headers => (headers || []).map(h => ({h, field: ALIAS[headerKey(h)] || ''}));
  const STAGE_MAP = [[/not interested|unresponsive|do not contact|bad data|lost|unqualified|churn|changed job|closed lost/, 'lost'],
    [/customer|client|won|open deal|closed won|deal/, 'client'], [/meeting|demo|call booked|qualified/, 'meeting'],
    [/replied|interested|engaged|responded/, 'replied'], [/approach|contacted|attempt|working|sequence|in progress/, 'contacted'],
    [/cold|new|lead|prospect/, 'lead']];
  const mapStage = s => { const t = String(s || '').toLowerCase(); if (!t) return ''; if (STAGES.some(x => x.v === t)) return t; for (const [re, v] of STAGE_MAP) if (re.test(t)) return v; return ''; };
  const orgKey = f => f.slice(3).charAt(0).toLowerCase() + f.slice(4);

  /* merge a fresh record into an existing one: empty fields fill, hand edits stay, lists union */
  function mergeRecord(existing, incoming, listFields) {
    const doc = {...existing};
    const changed = [];
    const ed = existing.edited || {};
    for (const k of Object.keys(incoming)) {
      const v = incoming[k];
      if (empty(v)) continue;
      if (listFields.indexOf(k) >= 0) {
        const next = uniq((existing[k] || []).concat(v));
        if (next.length !== (existing[k] || []).length) { doc[k] = next; changed.push(k); }
        continue;
      }
      if (empty(existing[k])) { doc[k] = v; changed.push(k); continue; }
      if (ed[k]) continue;
      if (existing[k] !== v) { doc[k] = v; changed.push(k); }
    }
    return {doc, changed};
  }

  /* the import plan: pure, from the parsed rows, the mapping and the live index */
  function planImport(ctx, parsed, mapping, ownerOf) {
    const ix = index(ctx);
    const now = Date.now();
    const skipped = [], dups = [];
    const oIdx = {apollo: {}, domain: {}, name: {}};
    const cIdx = {apollo: {}, mail: {}, nameOrg: {}};
    const work = {orgs: {}, contacts: {}}; /* id: {doc, isNew, changed: Set} */
    const indexOrg = o => { if (o.apolloId) oIdx.apollo[o.apolloId] = o.id; if (o.domain) oIdx.domain[o.domain] = o.id; const n = norm.name(o.name); if (n) oIdx.name[n] = o.id; };
    const indexContact = c => { if (c.apolloId) cIdx.apollo[c.apolloId] = c.id; const e = norm.mail(c['email']); if (e) cIdx.mail[e] = c.id; const n = norm.name(c.name); if (n) cIdx.nameOrg[n + '|' + (c.org || norm.name(c.orgName))] = c.id; };
    ix.orgs.forEach(indexOrg);
    ix.contacts.forEach(indexContact);
    const touch = (coll, id, existing, incoming, listFields, isNew) => {
      const w = work[coll][id];
      const base = w ? w.doc : existing;
      const {doc, changed} = mergeRecord(base, incoming, listFields);
      if (!w) work[coll][id] = {doc, isNew, changed: new Set(changed), existing};
      else { w.doc = doc; changed.forEach(k => w.changed.add(k)); }
      return work[coll][id].doc;
    };

    parsed.rows.forEach((row, ri) => {
      const p = {}, o = {};
      mapping.forEach((m, ci) => {
        if (!m.field) return;
        const v = norm.text(row[ci]).slice(0, TEXT_MAX);
        if (!v) return;
        if (m.field.indexOf('org') === 0) { const k = orgKey(m.field); if (!o[k]) o[k] = v; }
        else if (!p[m.field]) p[m.field] = v;
      });
      p.name = norm.text(p.name || ((p.first || '') + ' ' + (p.last || '')));
      if (!p.first && !p.last && p.name) { const w = p.name.split(' '); p.first = w[0]; p.last = w.slice(1).join(' '); }
      p['email'] = norm.mail(p['email']); p.email2 = norm.mail(p.email2);
      if (!p.name && !p['email']) { skipped.push({row: ri + 2, reason: 'no name and no email'}); return; }
      if (p.tags) p.tags = norm.list(p.tags);
      if (p.stage) p.stage = mapStage(p.stage);
      if (p.owner) p.owner = (ownerOf && ownerOf(p.owner)) || '';
      if (o.keywords) o.keywords = norm.list(o.keywords);
      o.domain = norm.orgDomain(o.domain || o.website, p['email']);
      if (o.size) o.size = String(o.size);

      /* the company first */
      let oid = '';
      if (o.name || o.domain) {
        oid = (o.apolloId && oIdx.apollo[o.apolloId]) || (o.domain && oIdx.domain[o.domain]) || (o.name && oIdx.name[norm.name(o.name)]) || '';
        if (oid) {
          const doc = touch('orgs', oid, ix.oById[oid], o, ORG_LIST, false);
          indexOrg(doc);
        } else {
          oid = newId('o_');
          const doc = {...blankOrg(), ...o, id: oid, source: 'apollo', at: now};
          work.orgs[oid] = {doc, isNew: true, changed: new Set(Object.keys(o)), existing: null};
          indexOrg(doc);
        }
      }
      p.org = oid;
      p.orgName = oid ? work.orgs[oid].doc.name : (o.name || '');

      /* then the person */
      const nk = norm.name(p.name) + '|' + (oid || norm.name(p.orgName));
      let cid = (p.apolloId && cIdx.apollo[p.apolloId]) || (p['email'] && cIdx.mail[p['email']]) || (p.name && cIdx.nameOrg[nk]) || '';
      if (cid) {
        if (work.contacts[cid] && work.contacts[cid].isNew) dups.push({row: ri + 2, of: cid});
        const doc = touch('contacts', cid, ix.cById[cid], p, CONTACT_LIST, false);
        indexContact(doc);
      } else {
        cid = newId('c_');
        const doc = {...blankContact(), ...p, id: cid, source: 'apollo', at: now};
        work.contacts[cid] = {doc, isNew: true, changed: new Set(Object.keys(p)), existing: null};
        indexContact(doc);
      }
    });

    /* client auto-map for every imported company without one */
    let mapped = 0;
    const clientLinks = [];
    const cm = ctx.coll.clients.map;
    const taken = {};
    Object.keys(cm).forEach(k => { if (cm[k].org) taken[cm[k].org] = k; });
    Object.keys(work.orgs).forEach(oid => {
      const w = work.orgs[oid];
      if (w.doc.client) return;
      const cid = clientMatching(cm, w.doc);
      if (!cid || cm[cid].org === '' || (cm[cid].org && cm[cid].org !== oid)) return;
      w.doc.client = cid; w.changed.add('client');
      if (cm[cid].org !== oid) clientLinks.push({cid, oid});
      mapped++;
    });

    /* pages: existing rows stay where they are, new rows fill the last page with room */
    /* pages: existing rows stay where they are; new rows fill the last page with room, counted in rows and in bytes */
    const pages = {contacts: {}, orgs: {}};
    const counts = {contacts: {}, orgs: {}};
    const bytes = {contacts: {}, orgs: {}};
    const place = (coll, id, w) => {
      let pid = coll === 'orgs' ? ix.oPage[id] : ix.cPage[id];
      let room = null;
      const need = bytesOf(w.doc) + id.length + 4;
      if (!pid) {
        room = roomIn(ctx, coll, counts[coll], bytes[coll], need); pid = room.pid;
        counts[coll][pid] = (counts[coll][pid] != null ? counts[coll][pid] : room.n) + 1;
        bytes[coll][pid] = (bytes[coll][pid] || 0) + need;
      }
      const pg = pages[coll][pid] = pages[coll][pid] || {rows: {}, isNew: !!(room && room.isNew), n: 0};
      if (room && room.isNew) pg.isNew = true;
      pg.rows[id] = w.doc;
    };
    let added = 0, updated = 0, unchanged = 0, orgsNew = 0, orgsUpdated = 0;
    Object.keys(work.orgs).forEach(id => {
      const w = work.orgs[id];
      if (w.isNew) orgsNew++; else if (w.changed.size) orgsUpdated++; else return;
      if (!w.isNew) { w.doc.updated = now; w.doc.updatedBy = ctx.uid; if (!w.doc.apolloId && w.existing && !w.existing.apolloId) { /* keep source */ } }
      else { w.doc.updated = now; w.doc.updatedBy = ctx.uid; }
      place('orgs', id, w);
    });
    Object.keys(work.contacts).forEach(id => {
      const w = work.contacts[id];
      if (w.isNew) added++; else if (w.changed.size) updated++; else { unchanged++; return; }
      w.doc.updated = now; w.doc.updatedBy = ctx.uid;
      place('contacts', id, w);
    });
    Object.keys(pages).forEach(coll => Object.keys(pages[coll]).forEach(pid => {
      const pg = pages[coll][pid];
      const have = Object.keys(((ctx.coll[coll].map[pid] || {}).rows) || {});
      pg.n = counts[coll][pid] != null ? counts[coll][pid] : have.length;
    }));
    return {skipped, dups, added, updated, unchanged, orgsNew, orgsUpdated, mapped, clientLinks, pages,
      people: added + updated + unchanged, rows: parsed.rows.length};
  }

  /* write the plan: one page document per write, then the client links, then the settings note */
  async function runImport(ctx, plan, onProgress) {
    const say = t => { if (onProgress) onProgress(t); };
    const now = Date.now();
    for (const coll of ['orgs', 'contacts']) {
      const pids = Object.keys(plan.pages[coll]).sort();
      for (let i = 0; i < pids.length; i++) {
        const pg = plan.pages[coll][pids[i]];
        say('Writing ' + (coll === 'orgs' ? 'companies' : 'people') + ', page ' + (i + 1) + ' of ' + pids.length);
        if (pg.isNew) await ctx.W.set(coll + '/' + pids[i], {rows: pg.rows, n: pg.n});
        else await ctx.W.merge(coll + '/' + pids[i], {rows: pg.rows, n: pg.n});
      }
    }
    for (const l of plan.clientLinks) {
      say('Linking clients');
      await ctx.W.update('clients/' + l.cid, {org: l.oid, updated: now}).catch(() => {});
    }
    if (ctx.isFounder) {
      await ctx.W.merge('settings/app', {base: {lastImport: {at: now, by: ctx.uid, added: plan.added, updated: plan.updated, orgs: plan.orgsNew}}}).catch(() => {});
    }
    say('');
  }

  /* ---------- small parts ---------- */
  const Mini = ({v, l, hot}) => html`<span class="chipline"><b class=${'num' + (hot ? ' flame-t' : '')}><${M.fx.MetalText} size=${15} weight=${700} color=${hot ? M.fx.FLAME : undefined}>${String(v)}<//></b> ${l}</span>`;
  const Chip = ({on, onClick, children, id}) => html`<button type="button" id=${id} class=${'chip' + (on ? ' on' : '')} aria-pressed=${!!on} onClick=${onClick}>${children}</button>`;
  const Initials = ({name, size}) => html`<span class="bs-av" style=${size ? {width: size + 'px', height: size + 'px'} : null} aria-hidden="true">${initials(name)}</span>`;
  const StagePill = ({stage}) => stage ? html`<${UI.Pill} kind=${STAGE_PILL[stage]}>${stage}<//>` : null;
  const Stamp = ({r}) => r && r.updated ? html`<span class="tiny ink62">updated ${U.timeAgo(r.updated)}${r.updatedBy ? html` by <${UI.Name} id=${r.updatedBy}/>` : ''}</span>` : null;
  const FilterSelect = ({value, onChange, options, label, id}) => html`<select class="input bs-filter" id=${id} aria-label=${label} value=${value} onChange=${e => onChange(e.target.value)}>
    ${options.map(o => html`<option key=${o.v} value=${o.v}>${o.label}</option>`)}</select>`;
  const distinct = (list, key) => uniq(list.map(r => r[key]).filter(Boolean)).sort((a, b) => String(a).localeCompare(String(b)));

  function useOwnerOpts(ctx) {
    const ids = ctx.activeMembers.map(m => m.uid);
    const profs = M.useProfiles(ids);
    return [{v: '', label: 'No owner'}].concat(ctx.activeMembers.map(m => ({v: m.uid, label: (profs[m.uid] && profs[m.uid].name) || m.empId || 'Teammate'})));
  }

  async function exportCsv(ctx, kind, rows, filters) {
    if (!ctx.downloads) { M.toast('Downloads are unavailable here', true); return; }
    if (remote()) {
      try {
        const r = await api('baseexport', {coll: kind, ...(filters || {})});
        const out = await ctx.downloads.save({filename: 'base-' + (kind === 'orgs' ? 'companies' : 'people') + '-' + U.todayStr() + '.csv', data: r.csv});
        M.toast((out && out.status === 'delivered' ? 'Sent' : 'Downloaded') + (r.capped ? ', the first ' + r.rows + ' of ' + r.total : ''));
      } catch (e) { M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true); }
      return;
    }
    const cols = kind === 'orgs' ? EXPORT_ORG : EXPORT_CONTACT;
    const cm = ctx.coll.clients.map;
    const lines = [cols.map(csvCell).join(',')];
    rows.forEach(r => lines.push(cols.map(k => {
      let v = r[k];
      if (k === 'client') v = r.client && cm[r.client] ? cm[r.client].name : '';
      if (k === 'orgName') v = r._on || r.orgName || '';
      if (Array.isArray(v)) v = v.join('; ');
      return csvCell(v);
    }).join(',')));
    try {
      const r = await ctx.downloads.save({filename: 'base-' + (kind === 'orgs' ? 'companies' : 'people') + '-' + U.todayStr() + '.csv', data: lines.join('\n')});
      M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
    } catch (e) {
      M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
    }
  }

  /* ---------- AI: a short intro note for one person ---------- */
  function IntroNote({c, o}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    if (!M.ai.on(ctx)) return null;
    const go = () => r.run(x => M.ai.text(ctx,
      'Draft a short intro note from Mask360 to this person, to send on WhatsApp or email. Warm, specific, one clear ask for a 20 minute call. Under 90 words. Plain text, no subject line, no placeholders.\n\n' +
      'PERSON: ' + c.name + (c.title ? ', ' + c.title : '') + (c.city ? ', ' + c.city : '') + (c.seniority ? ', seniority ' + c.seniority : '') + (c.dept ? ', ' + c.dept : '') + '\n' +
      'COMPANY: ' + (o ? [o.name, o.industry, o.city || o.country, o.size ? o.size + ' people' : '', (o.keywords || []).slice(0, 8).join(', ')].filter(Boolean).join(', ') : (c.orgName || 'unknown')) + '\n' +
      (c.notes ? 'NOTES: ' + String(c.notes).slice(0, 300) + '\n' : '') + 'STAGE: ' + (c.stage || 'none'),
      {signal: x.signal, onText: x.onText, tier: 'quick', cache: false}));
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<${M.fx.Beam}><div class="ai-card" id="contact-intro">
      <div class="row between ai-head">
        <${M.fx.Bot} feature="base" state=${busy ? 'working' : 'default'} size=${36} label="m360, the intro writer" className="ai-bot"/>
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Intro note</div></div>
        <${M.fx.Metal} kind="ink"><button type="button" class="btn sm" disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking} state="composing"/>` : html`<span class="spark">✦</span> ${r.text ? 'Draft it again' : 'Draft an intro note'}`}</button><//>
      </div>
      ${r.text ? html`<div style=${{marginTop: '12px'}}><${M.AIText} text=${r.text}/>
        <button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => navigator.clipboard.writeText(r.text).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here', true))}>Copy</button></div>`
        : html`<div class="small ink62" style=${{marginTop: '8px'}}>${busy ? html`<span class="row nowrap ai-wait"><${M.fx.Orb} state="composing" size=${32} label="Drafting"/><span>Reading this person and their company.</span></span>` : 'Ninety words, in the agency voice, from what we know about them.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </div><//>`;
  }

  /* ---------- a company picker that searches, for the team site ---------- */
  function OrgPicker({value, name, onPick}) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const res = useQuery('orgs', {q, limit: 8}, open && q.trim().length > 0);
    return html`<div class="field bs-orgpick">
      <label>company</label>
      ${value ? html`<div class="row nowrap" style=${{gap: '8px'}}><span class="pill ink" id="contact-org-picked">${name || value}</span><button type="button" class="linky small" onClick=${() => { onPick('', ''); setOpen(true); }}>Change</button></div>`
        : html`<input id="contact-org" class="input" placeholder="Type a company name" value=${q} onInput=${e => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} aria-label="Company"/>`}
      ${open && !value && q.trim() ? html`<div class="bs-orgpick-list" id="contact-org-list">
        ${res.loading ? html`<div class="small ink62 row nowrap" style=${{padding: '6px 8px', gap: '8px'}}><${M.fx.Orb} state="searching" size=${20} label="searching"/><span>Looking</span></div>`
          : res.rows.length ? res.rows.map(o => html`<button type="button" key=${o.id} class="rowbtn listrow" onClick=${() => { onPick(o.id, o.name); setOpen(false); setQ(''); }}><span class="grow">${o.name}</span><span class="tiny ink62">${[o.domain, o.city].filter(Boolean).join(' · ')}</span></button>`)
          : html`<div class="small ink62" style=${{padding: '6px 8px'}}>No company by that name. Type it below and make a new one.</div>`}
      </div>` : null}
    </div>`;
  }

  /* ---------- the contact drawer ---------- */
  function ContactDrawer({id, onClose, defaults}) {
    const ctx = M.useCtx();
    const got = useRow('contacts', id || null);
    const existing = got.row;
    const isNew = !id;
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState(() => {
      const b = {...blankContact(), ...(defaults || {}), ...(existing || {})};
      return {...b, tags: (b.tags || []).join(', ')};
    });
    /* the row arrives after the drawer opens on the team site */
    const filled = useRef(!!existing || isNew);
    useEffect(() => { if (existing && !filled.current) { filled.current = true; setF({...blankContact(), ...existing, tags: (existing.tags || []).join(', ')}); } }, [existing]);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const owners = useOwnerOpts(ctx);
    const isRemote = remote();
    const ix = isRemote ? null : index(ctx);
    const orgOpts = useMemo(() => isRemote ? [] : [{v: '', label: f.orgName && !f.org ? 'Typed: ' + f.orgName : 'No company'}]
      .concat(ix.orgs.filter(o => !o.archived || o.id === f.org).map(o => ({v: o.id, label: o.name || o.domain || o.id}))), [isRemote, ix, f.orgName, f.org]);
    const o = useOrgForClient(null, f.org || null).org;
    const client = o && o.client ? ctx.coll.clients.map[o.client] : null;
    const projects = client ? Object.keys(ctx.coll.projects.map).map(k => ({id: k, ...ctx.coll.projects.map[k]})).filter(p => p.client === o.client && !p.archived) : [];
    const pn = norm.name(o ? o.name : f.orgName), cn = client ? norm.name(client.name) : '';
    /* a pitch whose contact is this person counts too (v34: the pipeline links a Base contact by id) */
    const pitches = Object.keys(ctx.coll.pitches.map).map(k => ({id: k, ...ctx.coll.pitches.map[k]})).filter(p => { if (existing && p.contact === existing.id) return true; if (o && p.org === o.id) return true; const b = norm.name(p.brand); return b && (b === pn || (cn && b === cn)); });

    const pickOrg = (v, name) => setF(x => ({...x, org: v, orgName: v ? (name || (ix && ix.oById[v] ? ix.oById[v].name : x.orgName)) : x.orgName}));
    const newOrg = async () => {
      const nm = norm.text(f.orgName);
      if (!nm) return;
      setBusy(true);
      try {
        const oid = await upsertOrg(ctx, {name: nm, source: 'manual'});
        setF(x => ({...x, org: oid, orgName: nm}));
        M.toast('Company added');
      } catch (e) { /* toasted by the write layer */ }
      setBusy(false);
    };
    const save = async () => {
      const patch = {};
      const cur = existing || blankContact();
      const keys = Object.keys(blankContact()).filter(k => k !== 'edited' && k !== 'archived' && k !== 'source' && k !== 'apolloId');
      for (const k of keys) {
        const v = k === 'tags' ? uniq(norm.list(f.tags)) : norm.text(f[k]);
        const was = k === 'tags' ? (cur.tags || []) : (cur[k] || '');
        if (k === 'tags' ? v.join('|') !== was.join('|') : v !== was) patch[k] = v;
      }
      if (patch.first != null || patch.last != null) {
        const nm = norm.text((patch.first != null ? patch.first : cur.first) + ' ' + (patch.last != null ? patch.last : cur.last));
        if (nm && nm !== norm.text(cur.name) && patch.name == null) patch.name = nm;
      }
      if (isNew && !norm.text(f.name || (f.first + ' ' + f.last)) && !norm.text(f['email'])) return;
      if (!isNew && !Object.keys(patch).length) { onClose(); return; }
      setBusy(true);
      try {
        await upsertContact(ctx, isNew ? {...patch, source: 'manual', orgName: f.orgName} : {...patch, id, ...(patch.org ? {orgName: f.orgName} : {})});
        M.toast(isNew ? 'Added' : 'Saved');
        onClose();
      } catch (e) { setBusy(false); }
    };
    const doArchive = async () => {
      try { await archive(ctx, 'contacts', id, !existing.archived); M.toast(existing.archived ? 'Restored' : 'Archived'); onClose(); } catch (e) { /* toasted */ }
    };
    if (!isNew && !existing) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person">${got.loading ? html`<${M.Thinking} label="Opening" state="connecting"/>` : html`<${UI.Empty} text="This person is gone."/>`}<//>`;
    }
    const canSave = isNew ? !!(norm.text(f.first + ' ' + f.last + ' ' + f.name) || norm.text(f['email'])) : true;
    const footer = html`<div class="row between grow">
      <div>${!isNew ? html`<${UI.ConfirmBtn} onConfirm=${doArchive}>${existing.archived ? 'Restore' : 'Archive'}<//>` : null}</div>
      <${UI.Btn} id="contact-save" disabled=${busy || !canSave} onClick=${save}>${isNew ? 'Add person' : 'Save'}<//>
    </div>`;
    const go = h => { onClose(); M.nav(h); };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New person' : 'Person'} footer=${footer}>
      <div id="contact-drawer" class="stack" style=${{gap: '14px'}}>
        ${!isNew ? html`<div class="row between">
          <div class="row nowrap" style=${{gap: '10px'}}><${Initials} name=${existing.name} size=${40}/>
            <div><div style=${{fontWeight: 500, fontSize: '17px'}}>${existing.name}</div>
              <div class="tiny ink62">${SOURCES.find(s => s.v === existing.source) ? SOURCES.find(s => s.v === existing.source).label : 'Added'}${existing.archived ? ' · archived' : ''}</div></div></div>
          <${Stamp} r=${existing}/>
        </div>` : null}
        <div class="grid2">
          <${UI.Input} id="contact-first" label="first name" value=${f.first} onChange=${set('first')}/>
          <${UI.Input} id="contact-last" label="last name" value=${f.last} onChange=${set('last')}/>
        </div>
        <${UI.Input} id="contact-title" label="title" value=${f.title} onChange=${set('title')}/>
        ${isRemote ? html`<${OrgPicker} value=${f.org} name=${f.orgName} onPick=${pickOrg}/>` : html`<${UI.Select} id="contact-org" label="company" value=${f.org} onChange=${pickOrg} options=${orgOpts}/>`}
        ${!f.org ? html`<div class="row" style=${{alignItems: 'flex-end'}}>
          <div class="grow"><${UI.Input} id="contact-orgname" label="company name, as typed" value=${f.orgName} onChange=${set('orgName')}/></div>
          <${UI.Btn} kind="sec" sm disabled=${busy || !norm.text(f.orgName)} onClick=${newOrg}>New company from this name<//>
        </div>` : null}
        <div class="grid2">
          <${UI.Input} id="contact-email" label="email" type="email" value=${f['email']} onChange=${set('email')}/>
          <${UI.Input} id="contact-email2" label="second email" type="email" value=${f.email2} onChange=${set('email2')}/>
        </div>
        <div class="grid2">
          <${UI.Input} id="contact-phone" label="phone" value=${f.phone} onChange=${set('phone')}/>
          <${UI.Input} id="contact-mobile" label="mobile" value=${f.mobile} onChange=${set('mobile')}/>
        </div>
        <${UI.Input} id="contact-linkedin" label="linkedin" value=${f.linkedin} onChange=${set('linkedin')} placeholder="https://"/>
        <div class="grid2">
          <${UI.Input} id="contact-city" label="city" value=${f.city} onChange=${set('city')}/>
          <${UI.Input} id="contact-country" label="country" value=${f.country} onChange=${set('country')}/>
        </div>
        <div class="grid2">
          <${UI.Input} id="contact-seniority" label="seniority" value=${f.seniority} onChange=${set('seniority')}/>
          <${UI.Input} id="contact-dept" label="department" value=${f.dept} onChange=${set('dept')}/>
        </div>
        <div class="grid2">
          <${UI.Select} id="contact-stage" label="stage" value=${f.stage} onChange=${set('stage')} options=${STAGES}/>
          <${UI.Select} id="contact-owner" label="owner" value=${f.owner} onChange=${set('owner')} options=${owners}/>
        </div>
        <${UI.Input} id="contact-tags" label="tags, comma separated" value=${f.tags} onChange=${set('tags')}/>
        <${UI.TextArea} id="contact-notes" label="notes" value=${f.notes} onChange=${set('notes')} rows=${3}/>
        ${!isNew ? html`<${UI.Fold} title="Where they appear" summary=${client ? client.name : (o ? 'No client yet' : 'No company yet')}>
          <div class="bs-where">
            <${UI.Micro} plain>where they appear<//>
            ${o ? html`<div class="row small"><span class="ink62">company</span><button type="button" class="linky" onClick=${() => go('#companies/' + o.id)}>${o.name}</button></div>` : null}
            ${client ? html`<div class="row small"><span class="ink62">client</span><button type="button" class="linky" onClick=${() => go('#clients')}>${client.name}</button><${UI.Pill} kind="ink">${client.status || 'live'}<//></div>`
              : html`<div class="small ink62">${o ? 'This company is not mapped to a client.' : 'No company on this person yet.'}</div>`}
            ${projects.map(p => html`<div key=${p.id} class="row small"><span class="ink62">project</span><button type="button" class="linky" onClick=${() => go('#projects/' + p.id)}>${p.name}</button><span class="tiny ink62">${p.status || ''}</span></div>`)}
            ${pitches.map(p => html`<div key=${p.id} class="row small"><span class="ink62">pitch</span><button type="button" class="linky" onClick=${() => go('#pitches/' + p.id)}>${p.brand}</button><span class="tiny ink62">${p.stage || ''}</span></div>`)}
          </div>
        <//>` : null}
        ${!isNew && M.parts.Connections ? html`<${M.parts.Connections} kind="contact" id=${existing.id}/>` : null}
        ${!isNew && M.parts.ContactConversations ? html`<${M.parts.ContactConversations} cid=${existing.id} who=${existing.name} org=${o ? o.name : f.orgName} role=${existing.title} oid=${o ? o.id : ''} client=${client && o ? {...client, id: o.client} : null}/>` : null}
        ${!isNew ? html`<${IntroNote} c=${existing} o=${o}/>` : null}
      </div>
    <//>`;
  }

  /* ---------- the company drawer ---------- */
  function OrgDrawer({id, onClose, defaults}) {
    const ctx = M.useCtx();
    const got = useRow('orgs', id || null);
    const existing = got.row;
    const isNew = !id;
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState(() => {
      const b = {...blankOrg(), ...(defaults || {}), ...(existing || {})};
      return {...b, tags: (b.tags || []).join(', '), keywords: (b.keywords || []).join(', ')};
    });
    const filled = useRef(!!existing || isNew);
    useEffect(() => { if (existing && !filled.current) { filled.current = true; setF({...blankOrg(), ...existing, tags: (existing.tags || []).join(', '), keywords: (existing.keywords || []).join(', ')}); } }, [existing]);
    const [pick, setPick] = useState('');
    const set = k => v => setF(x => ({...x, [k]: v}));
    const people = usePeopleAt(id || null).rows;
    const cm = ctx.coll.clients.map;
    const client = existing && existing.client ? cm[existing.client] : null;
    const clientOpts = [{v: '', label: 'Choose a client'}].concat(Object.keys(cm).map(k => ({v: k, label: cm[k].name || k})).sort((a, b) => a.label.localeCompare(b.label)));
    const go = h => { onClose(); M.nav(h); };

    const save = async () => {
      const patch = {};
      const cur = existing || blankOrg();
      const keys = Object.keys(blankOrg()).filter(k => ['edited', 'archived', 'source', 'apolloId', 'client'].indexOf(k) < 0);
      for (const k of keys) {
        const isList = ORG_LIST.indexOf(k) >= 0;
        const v = isList ? uniq(norm.list(f[k])) : norm.text(f[k]);
        const was = isList ? (cur[k] || []) : (cur[k] || '');
        if (isList ? v.join('|') !== was.join('|') : v !== was) patch[k] = v;
      }
      if (isNew && !norm.text(f.name)) return;
      if (!isNew && !Object.keys(patch).length) { onClose(); return; }
      setBusy(true);
      try {
        await upsertOrg(ctx, isNew ? {...patch, source: 'manual'} : {...patch, id});
        M.toast(isNew ? 'Added' : 'Saved');
        onClose();
      } catch (e) { setBusy(false); }
    };
    const doMap = async () => {
      if (!pick) return;
      setBusy(true);
      try { await linkOrgToClient(ctx, id, pick); M.toast('Mapped to ' + (cm[pick] ? cm[pick].name : 'the client')); } catch (e) { /* toasted */ }
      setBusy(false);
    };
    const doUnmap = async () => {
      setBusy(true);
      try { await unlinkOrg(ctx, id); M.toast('Unmapped'); } catch (e) { /* toasted */ }
      setBusy(false);
    };
    const makeClient = async () => {
      setBusy(true);
      try {
        const cid = await makeClientFromOrg(ctx, id);
        if (cid) { M.burst(document.getElementById('org-make-client')); M.toast('Client page created'); }
      } catch (e) { /* toasted */ }
      setBusy(false);
    };
    const doArchive = async () => {
      try { await archive(ctx, 'orgs', id, !existing.archived); M.toast(existing.archived ? 'Restored' : 'Archived'); onClose(); } catch (e) { /* toasted */ }
    };
    if (!isNew && !existing) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Company">${got.loading ? html`<${M.Thinking} label="Opening" state="connecting"/>` : html`<${UI.Empty} text="This company is gone."/>`}<//>`;
    }
    const footer = html`<div class="row between grow">
      <div>${!isNew ? html`<${UI.ConfirmBtn} onConfirm=${doArchive}>${existing.archived ? 'Restore' : 'Archive'}<//>` : null}</div>
      <${UI.Btn} id="org-save" disabled=${busy || (isNew && !norm.text(f.name))} onClick=${save}>${isNew ? 'Add company' : 'Save'}<//>
    </div>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New company' : 'Company'} footer=${footer}>
      <div id="org-drawer" class="stack" style=${{gap: '14px'}}>
        ${!isNew ? html`<div class="row between">
          <div class="row nowrap" style=${{gap: '10px'}}><${Initials} name=${existing.name} size=${40}/>
            <div><div style=${{fontWeight: 500, fontSize: '17px'}}>${existing.name}</div>
              <div class="tiny ink62">${people.length} ${people.length === 1 ? 'person' : 'people'}${existing.domain ? ' · ' + existing.domain : ''}${existing.archived ? ' · archived' : ''}</div></div></div>
          <${Stamp} r=${existing}/>
        </div>` : null}
        ${!isNew ? html`<div class="bs-mapbox" id="org-mapping">
          <${UI.Micro} plain>client mapping<//>
          ${client ? html`<div class="row between" style=${{marginTop: '8px'}}>
              <div class="row nowrap"><${UI.Pill} kind="ink">client<//><button type="button" class="linky" onClick=${() => go('#clients')}>${client.name}</button></div>
              <${UI.ConfirmBtn} onConfirm=${doUnmap} label="Tap again to unmap">Unmap<//>
            </div>`
            : html`<div class="row" style=${{marginTop: '8px', alignItems: 'flex-end'}}>
              <div class="grow"><${UI.Select} id="org-client" label="map to a client" value=${pick} onChange=${setPick} options=${clientOpts}/></div>
              <${UI.Btn} kind="sec" sm id="org-map" disabled=${busy || !pick} onClick=${doMap}>Map<//>
              <${UI.Btn} sm id="org-make-client" disabled=${busy} onClick=${makeClient}>Make this a client<//>
            </div>`}
        </div>` : null}
        <${UI.Input} id="org-name" label="name" value=${f.name} onChange=${set('name')}/>
        <div class="grid2">
          <${UI.Input} id="org-domain" label="domain" value=${f.domain} onChange=${set('domain')} placeholder="brand.com"/>
          <${UI.Input} id="org-website" label="website" value=${f.website} onChange=${set('website')} placeholder="https://"/>
        </div>
        <div class="grid2">
          <${UI.Input} id="org-industry" label="industry" value=${f.industry} onChange=${set('industry')}/>
          <${UI.Input} id="org-size" label="size" value=${f.size} onChange=${set('size')} placeholder="people"/>
        </div>
        <div class="grid2">
          <${UI.Input} id="org-city" label="city" value=${f.city} onChange=${set('city')}/>
          <${UI.Input} id="org-country" label="country" value=${f.country} onChange=${set('country')}/>
        </div>
        <div class="grid2">
          <${UI.Input} id="org-linkedin" label="linkedin" value=${f.linkedin} onChange=${set('linkedin')} placeholder="https://"/>
          <${UI.Input} id="org-phone" label="phone" value=${f.phone} onChange=${set('phone')}/>
        </div>
        <${UI.Input} id="org-keywords" label="keywords, comma separated" value=${f.keywords} onChange=${set('keywords')}/>
        <${UI.Input} id="org-tags" label="tags, comma separated" value=${f.tags} onChange=${set('tags')}/>
        <${UI.TextArea} id="org-notes" label="notes" value=${f.notes} onChange=${set('notes')} rows=${3}/>
        ${!isNew ? html`<${UI.Fold} title="People here" summary=${people.length + (people.length === 1 ? ' person' : ' people')} open=${people.length > 0}>
          <div id="org-people">
            <${UI.Micro} plain>people here<//>
            ${people.length ? people.map(c => html`<button type="button" key=${c.id} class="rowbtn listrow bs-person" onClick=${() => go('#base/' + c.id)}>
              <${Initials} name=${c.name} size=${30}/>
              <span class="grow" style=${{minWidth: 0}}><span class="bs-name">${c.name}</span>${c.title ? html`<span class="small ink62"> · ${c.title}</span>` : null}</span>
              <${StagePill} stage=${c.stage}/>
            </button>`) : html`<${UI.Empty} text="Nobody here yet."/>`}
            <div style=${{marginTop: '10px'}}><${UI.Btn} kind="sec" sm onClick=${() => go('#base')}>Add a person in People<//></div>
          </div>
        <//>` : null}
        ${!isNew && M.parts.Connections ? html`<${M.parts.Connections} kind="org" id=${existing.id}/>` : null}
      </div>
    <//>`;
  }

  /* ---------- People ---------- */
  function PersonRow({c, onOpen, onOrg}) {
    return html`<div class="bs-row listrow" data-contact=${c.id}>
      <button type="button" class="rowbtn bs-main" onClick=${() => onOpen(c.id)}>
        <${Initials} name=${c.name} size=${36}/>
        <span class="grow" style=${{minWidth: 0}}>
          <span class="bs-name">${c.name || c['email'] || 'Someone new'}</span>
          <span class="bs-sub small ink62">${[c.title, !c.org && c._on ? 'at ' + c._on : '', c.city].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      ${c.org && c._on ? html`<button type="button" class="linky small bs-orglink" onClick=${() => onOrg(c.org)}>at ${c._on}</button>` : null}
      <span class="row nowrap bs-meta">
        <${StagePill} stage=${c.stage}/>
        ${c.owner ? html`<${UI.Avatar} id=${c.owner} size=${22}/>` : null}
        ${(c.tags || []).slice(0, 3).map(t => html`<span key=${t} class="pill warm">${t}</span>`)}
      </span>
    </div>`;
  }

  function People({id}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [fl, setFl] = useState({stage: '', mine: false, country: '', source: '', tag: '', archived: false});
    const [limit, setLimit] = useState(60);
    const [drawer, setDrawer] = useState(null);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 160); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (id) setDrawer(id); }, [id]);
    useEffect(() => { setLimit(60); }, [dq, fl]);
    M.useIntent('person', () => setDrawer('new'));
    const res = useQuery('contacts', {q: dq, stage: fl.stage, owner: fl.mine ? ctx.uid : '', country: fl.country, source: fl.source, tag: fl.tag, archived: fl.archived, limit});
    const rows = res.rows;
    const countries = res.facets.countries || [];
    const tags = res.facets.tags || [];
    const setF = k => v => setFl(x => ({...x, [k]: v}));
    const close = () => { setDrawer(null); if (id) M.nav('#base'); };
    const openOrg = oid => M.nav('#companies/' + oid);
    const busy = res.loading && !rows.length;
    const empty = !res.loading && !res.total && !dq && !fl.stage && !fl.mine && !fl.country && !fl.source && !fl.tag && !fl.archived;
    return html`<div class="stack" style=${{gap: '14px'}} id="base-people">
      <div class="row nowrap bs-searchrow">
        <${M.fx.Beam} radius=${16} size="sm"><div class="grow bs-search">
          <${icons.search}/>
          <input id="base-q" class="input" type="search" placeholder="Search people and companies" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Search people and companies"/>
        </div><//>
        <${UI.Btn} id="base-add" onClick=${() => setDrawer('new')}><${icons.plus}/>Add a person<//>
      </div>
      <div class="bs-chips row">
        <${Chip} on=${fl.mine} onClick=${() => setF('mine')(!fl.mine)}>Mine<//>
        ${STAGES.filter(s => s.v).map(s => html`<${Chip} key=${s.v} on=${fl.stage === s.v} onClick=${() => setF('stage')(fl.stage === s.v ? '' : s.v)}>${s.label}<//>`)}
        <${Chip} on=${fl.archived} onClick=${() => setF('archived')(!fl.archived)}>Archived<//>
        <${FilterSelect} id="base-country" label="Country" value=${fl.country} onChange=${setF('country')} options=${[{v: '', label: 'Any country'}].concat(countries.map(c => ({v: c, label: c})))}/>
        <${FilterSelect} id="base-source" label="Source" value=${fl.source} onChange=${setF('source')} options=${[{v: '', label: 'Any source'}].concat(SOURCES)}/>
        ${tags.length ? html`<${FilterSelect} id="base-tag" label="Tag" value=${fl.tag} onChange=${setF('tag')} options=${[{v: '', label: 'Any tag'}].concat(tags.map(t => ({v: t, label: t})))}/>` : null}
      </div>
      ${dq && res.orgs.length ? html`<div class="row bs-orgstrip" id="base-orgs">
        <span class="tiny ink62">companies</span>
        ${res.orgs.map(o => html`<button type="button" key=${o.id} class="chip" onClick=${() => openOrg(o.id)}>${o.name}<span class="num"> ${o.people}</span></button>`)}
      </div>` : null}
      <${UI.Card} className="bs-list">
        <div class="row between" style=${{marginBottom: '6px'}}>
          ${res.loading ? html`<${M.fx.Orb} state="searching" size=${20} label="searching" className="bs-orb"/>` : null}<span class="small ink62 num grow" id="base-count">${res.loading && !rows.length ? 'Looking' : res.total + ' ' + (res.total === 1 ? 'person' : 'people') + (dq ? ' for "' + dq + '"' : '')}</span>
          ${ctx.downloads && res.total ? html`<button type="button" class="linky small" id="base-export" onClick=${() => exportCsv(ctx, 'contacts', rows, {q: dq, stage: fl.stage, owner: fl.mine ? ctx.uid : '', country: fl.country, source: fl.source, tag: fl.tag, archived: fl.archived})}>Export CSV</button>` : null}
        </div>
        ${busy ? html`<${M.Thinking} label="Looking through the database"/>`
          : rows.length ? rows.map(c => html`<${PersonRow} key=${c.id} c=${c} onOpen=${setDrawer} onOrg=${openOrg}/>`)
          : html`<${UI.Empty} text=${res.err ? res.err : empty ? 'Nobody in the database yet. Add a person, or import a CSV from Apollo.' : 'Nobody matches that.'}/>`}
        ${res.total > rows.length ? html`<div style=${{marginTop: '12px'}}><${UI.Btn} kind="sec" sm id="base-more" onClick=${() => setLimit(limit + 60)}>Show more<//>
          <span class="small ink62 num" style=${{marginLeft: '10px'}}>${rows.length} of ${res.total}</span></div>` : null}
      <//>
      ${M.parts.BaseNudges ? html`<${M.parts.BaseNudges}/>` : null}
      ${M.parts.AskBase ? html`<${M.parts.AskBase}/>` : null}
      ${drawer ? html`<${ContactDrawer} key=${drawer} id=${drawer === 'new' ? null : drawer} onClose=${close}/>` : null}
    </div>`;
  }

  /* ---------- Companies ---------- */
  function Companies({id}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [fl, setFl] = useState({industry: '', country: '', map: '', archived: false});
    const [limit, setLimit] = useState(60);
    const [drawer, setDrawer] = useState(null);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 160); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (id) setDrawer(id); }, [id]);
    useEffect(() => { setLimit(60); }, [dq, fl]);
    const cm = ctx.coll.clients.map;
    const res = useQuery('orgs', {q: dq, industry: fl.industry, country: fl.country, map: fl.map, archived: fl.archived, limit});
    const rows = res.rows;
    const industries = res.facets.industries || [];
    const countries = res.facets.countries || [];
    const setF = k => v => setFl(x => ({...x, [k]: v}));
    const close = () => { setDrawer(null); if (id) M.nav('#companies'); };
    const busy = res.loading && !rows.length;
    const empty = !res.loading && !res.total && !dq && !fl.industry && !fl.country && !fl.map && !fl.archived;
    return html`<div class="stack" style=${{gap: '14px'}} id="base-companies">
      <div class="row nowrap bs-searchrow">
        <${M.fx.Beam} radius=${16} size="sm"><div class="grow bs-search">
          <${icons.search}/>
          <input id="companies-q" class="input" type="search" placeholder="Search companies" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Search companies"/>
        </div><//>
        <${UI.Btn} id="companies-add" onClick=${() => setDrawer('new')}><${icons.plus}/>Add a company<//>
      </div>
      <div class="bs-chips row">
        <${Chip} on=${fl.map === 'yes'} onClick=${() => setF('map')(fl.map === 'yes' ? '' : 'yes')}>Mapped to a client<//>
        <${Chip} on=${fl.map === 'no'} onClick=${() => setF('map')(fl.map === 'no' ? '' : 'no')}>Not mapped<//>
        <${Chip} on=${fl.archived} onClick=${() => setF('archived')(!fl.archived)}>Archived<//>
        ${industries.length ? html`<${FilterSelect} id="companies-industry" label="Industry" value=${fl.industry} onChange=${setF('industry')} options=${[{v: '', label: 'Any industry'}].concat(industries.map(c => ({v: c, label: c})))}/>` : null}
        <${FilterSelect} id="companies-country" label="Country" value=${fl.country} onChange=${setF('country')} options=${[{v: '', label: 'Any country'}].concat(countries.map(c => ({v: c, label: c})))}/>
      </div>
      <div class="row between">
        ${res.loading ? html`<${M.fx.Orb} state="searching" size=${20} label="searching" className="bs-orb"/>` : null}<span class="small ink62 num grow" id="companies-count">${res.loading && !rows.length ? 'Looking' : res.total + ' ' + (res.total === 1 ? 'company' : 'companies') + (dq ? ' for "' + dq + '"' : '')}</span>
        ${ctx.downloads && res.total ? html`<button type="button" class="linky small" id="companies-export" onClick=${() => exportCsv(ctx, 'orgs', rows, {q: dq, industry: fl.industry, country: fl.country, map: fl.map, archived: fl.archived})}>Export CSV</button>` : null}
      </div>
      ${busy ? html`<${UI.Card}><${M.Thinking} label="Looking through the database"/><//>`
      : rows.length ? html`<div class="grid2 bs-cards">
        ${rows.map(o => {
          const cl = o.client && cm[o.client] ? cm[o.client] : null;
          const n = o.people || 0;
          return html`<button type="button" key=${o.id} class="card rowbtn bs-card" data-org=${o.id} onClick=${() => setDrawer(o.id)}>
            <div class="row between nowrap" style=${{alignItems: 'flex-start'}}>
              <span class="bs-name" style=${{fontSize: '17px'}}>${o.name}</span>
              ${cl ? html`<${UI.Pill} kind="ink">${cl.name}<//>` : null}
            </div>
            <div class="small ink62" style=${{marginTop: '6px', overflowWrap: 'anywhere'}}>${[o.domain, o.industry, o.city || o.country].filter(Boolean).join(' · ')}</div>
            <div class="row small" style=${{marginTop: '10px'}}>
              <span class="num">${n} ${n === 1 ? 'person' : 'people'}</span>
              ${o.size ? html`<span class="ink62 num">${o.size} employees</span>` : null}
              ${(o.tags || []).slice(0, 2).map(t => html`<span key=${t} class="pill warm">${t}</span>`)}
            </div>
          </button>`;
        })}
      </div>` : html`<${UI.Card}><${UI.Empty} text=${res.err ? res.err : empty ? 'No companies yet. They arrive with people, or add one.' : 'No company matches that.'}/><//>`}
      ${res.total > rows.length ? html`<div><${UI.Btn} kind="sec" sm id="companies-more" onClick=${() => setLimit(limit + 60)}>Show more<//>
        <span class="small ink62 num" style=${{marginLeft: '10px'}}>${rows.length} of ${res.total}</span></div>` : null}
      ${drawer ? html`<${OrgDrawer} key=${drawer} id=${drawer === 'new' ? null : drawer} onClose=${close}/>` : null}
    </div>`;
  }

  /* ---------- Import ---------- */
  function Import() {
    const ctx = M.useCtx();
    M.useBase();
    const [parsed, setParsed] = useState(null);
    const [mapping, setMapping] = useState([]);
    const [paste, setPaste] = useState('');
    const [fileName, setFileName] = useState('');
    const [busy, setBusy] = useState(false);
    const [prog, setProg] = useState('');
    const [summary, setSummary] = useState(null);
    const [owners, setOwners] = useState({});
    const [reading, setReading] = useState('');
    const ix = index(ctx);
    const last = (ctx.settings.base || {}).lastImport;
    /* Apollo owner columns carry an address; it resolves to a teammate id when the profile carries one, else nothing */
    useEffect(() => {
      if (!ctx.isFounder || !ctx.user || !ctx.user.profiles) return;
      const ids = ctx.activeMembers.map(m => m.uid);
      if (!ids.length) return;
      let live = true;
      ctx.user.profiles(ids).then(ps => { if (!live) return; const o = {}; ids.forEach(u => { const e = ps[u] && ps[u]['email']; if (e) o[String(e).toLowerCase()] = u; }); setOwners(o); }).catch(() => {});
      return () => { live = false; };
    }, [ctx.isFounder, ctx.activeMembers.length]);
    const ownerOf = s => owners[String(s || '').trim().toLowerCase()] || '';
    /* the plan is worked out again when the file, the mapping or the database changes; never while its writes are running,
       when every page written would otherwise re-plan the whole file */
    const ixRef = useRef(ix);
    if (!busy) ixRef.current = ix;
    const baseReady = ctx.coll.contacts.ready && ctx.coll.orgs.ready;
    const plan = useMemo(() => parsed && baseReady ? planImport(ctx, parsed, mapping, ownerOf) : null, [parsed, mapping, ixRef.current, owners, baseReady]);

    if (!ctx.isFounder) {
      return html`<${UI.Card} title="Import"><div class="small">Imports are done by Kaavish. Search People for anyone already in the database.</div><//>`;
    }
    /* an import dedupes against everything, so the whole base must be in the page first */
    if (!baseReady) {
      const have = Object.keys(ctx.coll.contacts.map || {}).length + Object.keys(ctx.coll.orgs.map || {}).length;
      return html`<${UI.Card} title="Import from Apollo" id="import-opening"><${M.Thinking} state="connecting" label=${'Opening the whole database for a clean import' + (have ? ', ' + have + ' pages so far' : '')}/><p class="small ink62" style=${{marginTop: '10px'}}>A big base takes half a minute the first time.</p><//>`;
    }
    const load = (text, name) => {
      const p = parseCsv(text);
      if (!p.headers.length) { M.toast('That file has no columns', true); return; }
      setParsed(p); setMapping(mapApollo(p.headers)); setSummary(null); setFileName(name || 'pasted text');
    };
    const readFile = async (file, keep, keepMapping) => {
      setReading('Reading ' + file.name);
      try {
        const p = await readCsvFile(file, {keep, onProgress: f => setReading('Reading ' + file.name + ', ' + Math.round(f * 100) + '%')});
        if (!p.headers.length) { M.toast('That file has no columns', true); setReading(''); return; }
        setParsed(p); if (!keepMapping) setMapping(mapApollo(p.headers)); setSummary(null); setFileName(file.name);
      } catch (e) { M.toast('That file could not be read', true); }
      setReading('');
    };
    const onFile = e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      readFile(file, null, false);
    };
    const mappedCols = mapping.filter(m => m.field).length;
    /* a column mapped after the read was not kept: the file is read again with it */
    const setField = (i, v) => {
      const next = mapping.map((x, j) => j === i ? {...x, field: v} : x);
      setMapping(next);
      if (v && parsed && parsed.file && parsed.kept && !parsed.kept.has(i)) {
        const keep = next.map((m, j) => m.field ? j : -1).filter(j => j >= 0);
        setTimeout(() => readFile(parsed.file, keep, true), 0);
        setMapping(next);
      }
    };
    const preview = parsed ? (parsed.preview || parsed.rows.slice(0, 5)).map(row => {
      const o = {};
      mapping.forEach((m, ci) => { if (m.field && row[ci] && !o[m.field]) o[m.field] = norm.text(row[ci]); });
      return o;
    }) : [];
    const go = async () => {
      if (!plan || busy) return;
      setBusy(true);
      try {
        await runImport(ctx, plan, setProg);
        setSummary(plan);
        setParsed(null); setMapping([]); setPaste('');
        M.burst(document.getElementById('import-go'));
        M.toast('Imported ' + plan.added + ' new ' + (plan.added === 1 ? 'person' : 'people'));
      } catch (e) {
        /* every page written so far is whole; the same file imported again only adds what is missing */
        setProg('Stopped: ' + ((e && e.message) || 'a page could not be written') + '. What went in stays; import the same file again to finish.');
        M.toast('The import stopped. See the note under the button.', true);
      }
      setBusy(false);
    };
    const n = plan ? plan.people : 0;
    return html`<div class="stack" style=${{gap: '16px'}} id="base-import">
      <${UI.Card} title="Import from Apollo" action=${last ? html`<span class="tiny ink62">last import ${U.timeAgo(last.at)}: ${last.added} new, ${last.updated} updated, ${last.orgs} companies</span>` : null}>
        <p class="small ink62" style=${{marginTop: 0}}>Export your contacts from Apollo as a CSV and drop it here. Only the useful columns come through: names, titles, emails, phones, company, city, stage, lists. Hand edits in the database always win over Apollo.</p>
        <div class="row" style=${{alignItems: 'flex-start'}}>
          <div class="field grow">
            <label for="import-file">csv file</label>
            <input id="import-file" class="input bs-file" type="file" accept=".csv,text/csv" onChange=${onFile} disabled=${!!reading}/>
          </div>
        </div>
        ${reading ? html`<div class="row nowrap small ink62" id="import-reading" style=${{gap: '8px', marginTop: '8px'}}><${M.Thinking} label=${reading}/></div>` : null}
        <${UI.Fold} title="Or paste the CSV text" summary="For a small list">
          <div class="stack tight" style=${{marginTop: '10px'}}>
            <${UI.TextArea} id="import-paste" label="or paste csv text" value=${paste} onChange=${setPaste} rows=${4} placeholder="First Name,Last Name,Title,Company,Email"/>
            <div><${UI.Btn} kind="sec" sm id="import-parse" disabled=${!paste.trim()} onClick=${() => load(paste, 'pasted text')}>Use this text<//></div>
          </div>
        <//>
      <//>
      ${parsed ? html`<${UI.Card} title=${'Mapping for ' + fileName} id="import-mapcard">
        <div class="row small" style=${{marginBottom: '10px'}}>
          <span class="num">${parsed.rows.length} rows</span>
          <span class="num ink62">${parsed.headers.length} columns, ${mappedCols} mapped, ${parsed.headers.length - mappedCols} ignored</span>
          <span class="num">${plan.added} new, ${plan.updated} updated, ${plan.unchanged} unchanged</span>
          ${plan.skipped.length ? html`<span class="num flame-t">${plan.skipped.length} skipped</span>` : null}
          ${plan.dups.length ? html`<span class="num ink62">${plan.dups.length} duplicate ${plan.dups.length === 1 ? 'row' : 'rows'} folded in</span>` : null}
        </div>
        <div class="tbl-wrap"><table class="tbl bs-map" id="import-map">
          <thead><tr><th>column in the file</th><th>goes to</th><th>first value</th></tr></thead>
          <tbody>${mapping.map((m, i) => html`<tr key=${i} class=${m.field ? '' : 'bs-ignored'} data-col=${m.h}>
            <td class="lead">${m.h}</td>
            <td data-label="goes to"><select class="input bs-mapsel" aria-label=${'Field for ' + m.h} value=${m.field} onChange=${e => setField(i, e.target.value)}>
              ${FIELD_OPTS.map(o => html`<option key=${o.v} value=${o.v}>${o.label}</option>`)}</select></td>
            <td data-label="first value" class="ink62 bs-sample">${norm.text((parsed.rows[0] || [])[i]).slice(0, 40) || ''}</td>
          </tr>`)}</tbody>
        </table></div>
        <div class="hair"/>
        <${UI.Micro} plain>preview, first ${preview.length} rows<//>
        <div class="stack tight" id="import-preview" style=${{marginTop: '8px'}}>
          ${preview.map((r, i) => html`<div key=${i} class="listrow bs-prev">
            <${Initials} name=${r.name || ((r.first || '') + ' ' + (r.last || ''))} size=${30}/>
            <span class="grow" style=${{minWidth: 0}}>
              <span class="bs-name">${norm.text(r.name || ((r.first || '') + ' ' + (r.last || ''))) || html`<span class="flame-t">no name</span>`}</span>
              <span class="small ink62"> ${[r.title, r.orgName, r['email'], r.city].filter(Boolean).join(' · ')}</span>
            </span>
          </div>`)}
        </div>
        ${plan.skipped.length ? html`<div class="small ink62" style=${{marginTop: '10px'}}>Skipped: ${plan.skipped.slice(0, 8).map(s => 'row ' + s.row + ' (' + s.reason + ')').join(', ')}${plan.skipped.length > 8 ? ' and ' + (plan.skipped.length - 8) + ' more' : ''}</div>` : null}
        <div class="row" style=${{marginTop: '14px'}}>
          <${UI.Btn} id="import-go" disabled=${busy || !n} onClick=${go}><${icons.upload}/>${busy ? 'Importing' : 'Import ' + n + ' ' + (n === 1 ? 'person' : 'people')}<//>
          <${UI.Btn} kind="ghost" sm disabled=${busy} onClick=${() => { setParsed(null); setMapping([]); }}>Clear<//>
          ${prog ? html`<span class="small ink62" id="import-progress" aria-live="polite">${prog}</span>` : null}
        </div>
      <//>` : null}
      ${summary ? html`<${UI.Card} title="Imported" id="import-summary" flame=${true}>
        <div class="grid4 two bs-sum">
          <div class="kpi"><span class="v num"><${M.fx.MetalText} size=${30} weight=${600}>${String(summary.added)}<//></span><span class="l">new people</span></div>
          <div class="kpi"><span class="v num">${summary.updated}</span><span class="l">updated</span></div>
          <div class="kpi"><span class="v num">${summary.unchanged}</span><span class="l">unchanged</span></div>
          <div class="kpi"><span class="v num"><${M.fx.MetalText} size=${30} weight=${600}>${String(summary.orgsNew)}<//></span><span class="l">new companies</span></div>
          <div class="kpi"><span class="v num"><${M.fx.MetalText} size=${30} weight=${600}>${String(summary.mapped)}<//></span><span class="l">mapped to clients</span></div>
          <div class="kpi"><span class="v num">${summary.skipped.length}</span><span class="l">skipped</span></div>
        </div>
        ${summary.skipped.length ? html`<div class="small ink62" style=${{marginTop: '12px'}}>Skipped: ${summary.skipped.slice(0, 12).map(s => 'row ' + s.row + ' (' + s.reason + ')').join(', ')}</div>` : null}
        ${summary.dups.length ? html`<div class="small ink62" style=${{marginTop: '6px'}}>${summary.dups.length} duplicate ${summary.dups.length === 1 ? 'row' : 'rows'} in the file folded into one person.</div>` : null}
        <div class="row" style=${{marginTop: '14px'}}>
          <${UI.Btn} kind="sec" sm onClick=${() => M.nav('#base')}>Open People<//>
          <${UI.Btn} kind="sec" sm onClick=${() => M.nav('#companies')}>Open Companies<//>
        </div>
      <//>` : null}
      <${UI.Card} title="What comes through">
        <div class="small ink62">Person: first and last name, title, email and a second email, direct, mobile and corporate phone, seniority, department, LinkedIn, city, state, country, stage, lists as tags, the Apollo contact id. Company: name, website and domain, industry, size, keywords, company LinkedIn, phone, city, state, country, the Apollo account id. Everything else in the export stays out: opens, bounces, replies, technologies, revenue, funding, social links, intent topics.</div>
        <div class="small ink62" style=${{marginTop: '8px'}}>People match by Apollo id, then email, then name at the same company. Companies match by Apollo id, then domain, then name. A company whose name or domain matches a client page is mapped to it on import. ${ix.contacts.length} people and ${ix.orgs.length} companies are in the database now.</div>
      <//>
    </div>`;
  }

  /* ---------- the section page ---------- */
  function Base({tab, id}) {
    const ctx = M.useCtx();
    const t = tab || 'people';
    const st = useStats();
    useAutoMap(ctx);
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="the database" title="Base" sub="Everyone we know, who we know them through, and what we do with them.">
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${st.people} l="people"/>
          <${Mini} v=${st.companies} l="companies"/>
          <${Mini} v=${st.mapped} l="mapped to clients"/>
        </div>
      <//>
      <${M.SectionTabs} section="base" active=${t}/>
      ${t === 'companies' ? html`<${Companies} id=${id}/>` : t === 'import' ? html`<${Import}/>` : html`<${People} id=${id}/>`}
    </div>`;
  }

  /* ---------- for the client page: the people at this client's company ---------- */
  function PeopleAtClient({clientId, id}) {
    const o = useOrgForClient(clientId || id, null).org;
    const people = usePeopleAt(o ? o.id : null, 50).rows;
    if (!o) return null;
    return html`<${UI.Card} title="People at this client" id="client-people" action=${html`<button type="button" class="linky small" onClick=${() => M.nav('#companies/' + o.id)}>Open in Base</button>`}>
      ${people.length ? people.slice(0, 6).map(c => html`<button type="button" key=${c.id} class="rowbtn listrow bs-person" onClick=${() => M.nav('#base/' + c.id)}>
        <${Initials} name=${c.name} size=${30}/>
        <span class="grow" style=${{minWidth: 0}}><span class="bs-name">${c.name}</span>${c.title ? html`<span class="small ink62"> · ${c.title}</span>` : null}</span>
        <${StagePill} stage=${c.stage}/>
      </button>`) : html`<${UI.Empty} text=${'Nobody from ' + o.name + ' in the database yet.'}/>`}
      ${people.length > 6 ? html`<div class="tiny ink62 num" style=${{marginTop: '6px'}}>${people.length - 6} more in Base</div>` : null}
    <//>`;
  }

  M.pages.Base = Base;
  M.parts.PeopleAtClient = PeopleAtClient;
  M.parts.ContactDrawer = ContactDrawer;
  M.parts.OrgDrawer = OrgDrawer;
  M.base = {all, contact, org, peopleAt, orgForClient, find, upsertContact, upsertOrg, pageFor, linkOrgToClient, unlinkOrg,
    remote, query, getRow, orgForClientAsync, peopleAtAsync, statsAsync, useQuery, useRow, useOrgForClient, usePeopleAt, useStats, touch,
    makeClientFromOrg, STAGES, norm, parseCsv, readCsvFile, mapApollo, planImport, runImport, PAGE_MAX};
})();
