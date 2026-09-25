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
    list: s => Array.isArray(s) ? s.map(x => norm.text(x)).filter(Boolean)
      : String(s || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean)
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
  function roomIn(ctx, coll, counts) {
    const ix = index(ctx);
    const map = ctx.coll[coll].map;
    const pages = uniq((coll === 'orgs' ? ix.oPages : ix.cPages).concat(counts ? Object.keys(counts) : [])).sort();
    const count = pid => counts && counts[pid] != null ? counts[pid] : Object.keys((map[pid] || {}).rows || {}).length;
    for (let i = pages.length - 1; i >= 0; i--) { if (count(pages[i]) < PAGE_MAX) return {pid: pages[i], n: count(pages[i]), isNew: !map[pages[i]]}; }
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

  /* ---------- writes ---------- */
  function editedOf(patch) {
    const e = {};
    Object.keys(patch).forEach(k => { if (SYS.indexOf(k) < 0 && k !== 'archived') e[k] = true; });
    return e;
  }
  async function upsertContact(ctx, patch) {
    const now = Date.now();
    const ix = index(ctx);
    patch = {...patch};
    if (patch.tags) patch.tags = uniq(norm.list(patch.tags));
    if (patch.id && ix.cById[patch.id]) {
      const id = patch.id; delete patch.id;
      if (patch.org && ix.oById[patch.org]) patch.orgName = ix.oById[patch.org].name;
      await ctx.W.merge('contacts/' + ix.cPage[id], {rows: {[id]: {...patch, edited: editedOf(patch), updated: now, updatedBy: ctx.uid}}});
      return id;
    }
    const id = patch.id || newId('c_');
    const doc = {...blankContact(), ...patch, id, at: now, updated: now, updatedBy: ctx.uid};
    doc.name = norm.text(doc.name || (doc.first + ' ' + doc.last));
    if (!doc.first && !doc.last && doc.name) { const w = doc.name.split(' '); doc.first = w[0]; doc.last = w.slice(1).join(' '); }
    if (doc.org && ix.oById[doc.org]) doc.orgName = ix.oById[doc.org].name;
    const room = roomIn(ctx, 'contacts');
    await ctx.W.merge('contacts/' + room.pid, {rows: {[id]: doc}, n: room.n + 1});
    return id;
  }
  async function upsertOrg(ctx, patch) {
    const now = Date.now();
    const ix = index(ctx);
    patch = {...patch};
    if (patch.tags) patch.tags = uniq(norm.list(patch.tags));
    if (patch.keywords) patch.keywords = uniq(norm.list(patch.keywords));
    if (patch.website && !patch.domain) patch.domain = norm.domain(patch.website);
    if (patch.id && ix.oById[patch.id]) {
      const id = patch.id; delete patch.id;
      await ctx.W.merge('orgs/' + ix.oPage[id], {rows: {[id]: {...patch, edited: editedOf(patch), updated: now, updatedBy: ctx.uid}}});
      /* the company name rides on every contact at the company */
      if (patch.name && patch.name !== ix.oById[id].name) {
        const byPage = {};
        peopleAt(ctx, id).forEach(c => { const p = ix.cPage[c.id]; (byPage[p] = byPage[p] || {})[c.id] = {orgName: patch.name}; });
        for (const p of Object.keys(byPage)) await ctx.W.merge('contacts/' + p, {rows: byPage[p]});
      }
      return id;
    }
    const id = patch.id || newId('o_');
    const doc = {...blankOrg(), ...patch, id, at: now, updated: now, updatedBy: ctx.uid};
    doc.name = norm.text(doc.name);
    const room = roomIn(ctx, 'orgs');
    await ctx.W.merge('orgs/' + room.pid, {rows: {[id]: doc}, n: room.n + 1});
    return id;
  }
  async function archive(ctx, coll, id, on) {
    const pid = pageFor(ctx, coll, id);
    if (!pid) return;
    await ctx.W.merge(coll + '/' + pid, {rows: {[id]: {archived: on !== false, updated: Date.now(), updatedBy: ctx.uid}}});
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
    const o = org(ctx, orgId), c = ctx.coll.clients.map[clientId], pid = pageFor(ctx, 'orgs', orgId);
    if (!o || !c || !pid) return false;
    const now = Date.now();
    if (o.client !== clientId) await ctx.W.merge('orgs/' + pid, {rows: {[orgId]: {client: clientId, updated: now, updatedBy: ctx.uid}}});
    if (c.org !== orgId) await ctx.W.update('clients/' + clientId, {org: orgId, updated: now});
    return true;
  }
  async function unlinkOrg(ctx, orgId) {
    const o = org(ctx, orgId), pid = pageFor(ctx, 'orgs', orgId);
    if (!o || !pid) return;
    const now = Date.now();
    const c = o.client ? ctx.coll.clients.map[o.client] : null;
    await ctx.W.merge('orgs/' + pid, {rows: {[orgId]: {client: '', updated: now, updatedBy: ctx.uid}}});
    if (c && c.org === orgId) await ctx.W.update('clients/' + o.client, {org: '', updated: now});
  }
  async function makeClientFromOrg(ctx, orgId) {
    const o = org(ctx, orgId), pid = pageFor(ctx, 'orgs', orgId);
    if (!o || !pid) return null;
    const now = Date.now();
    const cid = U.uid();
    const doc = {name: o.name || 'Client', status: 'live', pod: '', owner: ctx.uid, memory: '', approvals: '', never: '',
      links: o.website || '', updated: now, by: ctx.uid, org: orgId};
    await ctx.W.set('clients/' + cid, doc);
    await ctx.W.merge('orgs/' + pid, {rows: {[orgId]: {client: cid, updated: now, updatedBy: ctx.uid}}});
    const ix = index(ctx);
    const byPage = {};
    peopleAt(ctx, orgId).forEach(c => {
      if (c.stage === 'client') return;
      const p = ix.cPage[c.id];
      (byPage[p] = byPage[p] || {})[c.id] = {stage: 'client', updated: now, updatedBy: ctx.uid};
    });
    for (const p of Object.keys(byPage)) await ctx.W.merge('contacts/' + p, {rows: byPage[p]});
    return cid;
  }
  /* a client created from Accounts with a matching company name gets linked on the next Base render;
     a client someone unmapped by hand keeps org '' and is left alone */
  function useAutoMap(ctx) {
    const tried = useRef({});
    useEffect(() => {
      if (!ctx.coll.clients.ready || !ctx.coll.orgs.ready) return;
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
        const v = norm.text(row[ci]);
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
    const pages = {contacts: {}, orgs: {}};
    const counts = {contacts: {}, orgs: {}};
    const place = (coll, id, w) => {
      let pid = coll === 'orgs' ? ix.oPage[id] : ix.cPage[id];
      let room = null;
      if (!pid) { room = roomIn(ctx, coll, counts[coll]); pid = room.pid; counts[coll][pid] = (counts[coll][pid] != null ? counts[coll][pid] : room.n) + 1; }
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
  const Mini = ({v, l, hot}) => html`<span class="chipline"><b class=${'num' + (hot ? ' flame-t' : '')}>${v}</b> ${l}</span>`;
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

  async function exportCsv(ctx, kind, rows) {
    if (!ctx.downloads) { M.toast('Downloads are unavailable here', true); return; }
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
    return html`<div class="ai-card" id="contact-intro">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Intro note</div></div>
        <button type="button" class="btn sm" disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking}/>` : html`<span class="spark">✦</span> ${r.text ? 'Draft it again' : 'Draft an intro note'}`}</button>
      </div>
      ${r.text ? html`<div style=${{marginTop: '12px'}}><${M.AIText} text=${r.text}/>
        <button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => navigator.clipboard.writeText(r.text).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here', true))}>Copy</button></div>`
        : html`<div class="small ink62" style=${{marginTop: '8px'}}>${busy ? 'Reading this person and their company.' : 'Ninety words, in the agency voice, from what we know about them.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </div>`;
  }

  /* ---------- the contact drawer ---------- */
  function ContactDrawer({id, onClose, defaults}) {
    const ctx = M.useCtx();
    const ix = index(ctx);
    const existing = id ? ix.cById[id] : null;
    const isNew = !id;
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState(() => {
      const b = {...blankContact(), ...(defaults || {}), ...(existing || {})};
      return {...b, tags: (b.tags || []).join(', ')};
    });
    const set = k => v => setF(x => ({...x, [k]: v}));
    const owners = useOwnerOpts(ctx);
    const orgOpts = useMemo(() => [{v: '', label: f.orgName && !f.org ? 'Typed: ' + f.orgName : 'No company'}]
      .concat(ix.orgs.filter(o => !o.archived || o.id === f.org).map(o => ({v: o.id, label: o.name || o.domain || o.id}))), [ix.orgs, f.orgName, f.org]);
    const o = f.org ? ix.oById[f.org] : null;
    const client = o && o.client ? ctx.coll.clients.map[o.client] : null;
    const projects = client ? Object.keys(ctx.coll.projects.map).map(k => ({id: k, ...ctx.coll.projects.map[k]})).filter(p => p.client === o.client && !p.archived) : [];
    const pn = norm.name(o ? o.name : f.orgName), cn = client ? norm.name(client.name) : '';
    const pitches = Object.keys(ctx.coll.pitches.map).map(k => ({id: k, ...ctx.coll.pitches.map[k]})).filter(p => { if (o && p.org === o.id) return true; const b = norm.name(p.brand); return b && (b === pn || (cn && b === cn)); });

    const pickOrg = v => setF(x => ({...x, org: v, orgName: v && ix.oById[v] ? ix.oById[v].name : x.orgName}));
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
        await upsertContact(ctx, isNew ? {...patch, source: 'manual'} : {...patch, id});
        M.toast(isNew ? 'Added' : 'Saved');
        onClose();
      } catch (e) { setBusy(false); }
    };
    const doArchive = async () => {
      try { await archive(ctx, 'contacts', id, !existing.archived); M.toast(existing.archived ? 'Restored' : 'Archived'); onClose(); } catch (e) { /* toasted */ }
    };
    if (!isNew && !existing) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person"><${UI.Empty} text="This person is gone."/><//>`;
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
        <${UI.Select} id="contact-org" label="company" value=${f.org} onChange=${pickOrg} options=${orgOpts}/>
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
            ${pitches.map(p => html`<div key=${p.id} class="row small"><span class="ink62">pitch</span><button type="button" class="linky" onClick=${() => go('#pitches')}>${p.brand}</button><span class="tiny ink62">${p.stage || ''}</span></div>`)}
          </div>
        <//>` : null}
        ${!isNew && M.parts.Connections ? html`<${M.parts.Connections} kind="contact" id=${existing.id}/>` : null}
        ${!isNew ? html`<${IntroNote} c=${existing} o=${o}/>` : null}
      </div>
    <//>`;
  }

  /* ---------- the company drawer ---------- */
  function OrgDrawer({id, onClose, defaults}) {
    const ctx = M.useCtx();
    const ix = index(ctx);
    const existing = id ? ix.oById[id] : null;
    const isNew = !id;
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState(() => {
      const b = {...blankOrg(), ...(defaults || {}), ...(existing || {})};
      return {...b, tags: (b.tags || []).join(', '), keywords: (b.keywords || []).join(', ')};
    });
    const [pick, setPick] = useState('');
    const set = k => v => setF(x => ({...x, [k]: v}));
    const people = id ? peopleAt(ctx, id) : [];
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
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Company"><${UI.Empty} text="This company is gone."/><//>`;
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
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 120); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (id) setDrawer(id); }, [id]);
    useEffect(() => { setLimit(60); }, [dq, fl]);
    M.useIntent('person', () => setDrawer('new'));
    const ix = index(ctx);
    const res = useMemo(() => find(ctx, dq, {archived: fl.archived}), [ix, dq, fl.archived]);
    const rows = useMemo(() => res.contacts.filter(c => {
      if (fl.archived ? !c.archived : c.archived) return false;
      if (fl.stage && c.stage !== fl.stage) return false;
      if (fl.mine && c.owner !== ctx.uid) return false;
      if (fl.country && c.country !== fl.country) return false;
      if (fl.source && c.source !== fl.source) return false;
      if (fl.tag && (c.tags || []).indexOf(fl.tag) < 0) return false;
      return true;
    }), [res, fl, ctx.uid]);
    const countries = useMemo(() => distinct(ix.contacts, 'country'), [ix]);
    const tags = useMemo(() => uniq(ix.contacts.reduce((a, c) => a.concat(c.tags || []), [])).sort(), [ix]);
    const setF = k => v => setFl(x => ({...x, [k]: v}));
    const close = () => { setDrawer(null); if (id) M.nav('#base'); };
    const openOrg = oid => M.nav('#companies/' + oid);
    const shown = rows.slice(0, limit);
    if (!ctx.coll.contacts.ready) return html`<${UI.Card}><${UI.Empty} text="One moment."/><//>`;
    return html`<div class="stack" style=${{gap: '14px'}} id="base-people">
      <div class="row nowrap bs-searchrow">
        <div class="grow bs-search">
          <${icons.search}/>
          <input id="base-q" class="input" type="search" placeholder="Search people and companies" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Search people and companies"/>
        </div>
        <${UI.Btn} id="base-add" onClick=${() => setDrawer('new')}><${icons.plus}/>Add a person<//>
      </div>
      <div class="bs-chips row">
        <${Chip} on=${fl.mine} onClick=${() => setF('mine')(!fl.mine)}>Mine<//>
        ${STAGES.filter(s => s.v).map(s => html`<${Chip} key=${s.v} on=${fl.stage === s.v} onClick=${() => setF('stage')(fl.stage === s.v ? '' : s.v)}>${s.label}<//>`)}
        <${FilterSelect} id="base-country" label="Country" value=${fl.country} onChange=${setF('country')} options=${[{v: '', label: 'Any country'}].concat(countries.map(c => ({v: c, label: c})))}/>
        <${FilterSelect} id="base-source" label="Source" value=${fl.source} onChange=${setF('source')} options=${[{v: '', label: 'Any source'}].concat(SOURCES)}/>
        ${tags.length ? html`<${FilterSelect} id="base-tag" label="Tag" value=${fl.tag} onChange=${setF('tag')} options=${[{v: '', label: 'Any tag'}].concat(tags.map(t => ({v: t, label: t})))}/>` : null}
        <${Chip} on=${fl.archived} onClick=${() => setF('archived')(!fl.archived)}>Archived<//>
      </div>
      ${dq && res.orgs.length ? html`<div class="row bs-orgstrip" id="base-orgs">
        <span class="tiny ink62">companies</span>
        ${res.orgs.slice(0, 6).map(o => html`<button type="button" key=${o.id} class="chip" onClick=${() => openOrg(o.id)}>${o.name}<span class="num"> ${peopleAt(ctx, o.id).length}</span></button>`)}
      </div>` : null}
      <${UI.Card} className="bs-list">
        <div class="row between" style=${{marginBottom: '6px'}}>
          <span class="small ink62 num" id="base-count">${rows.length} ${rows.length === 1 ? 'person' : 'people'}${dq ? ' for "' + dq + '"' : ''}</span>
          ${ctx.downloads && rows.length ? html`<button type="button" class="linky small" id="base-export" onClick=${() => exportCsv(ctx, 'contacts', rows)}>Export CSV</button>` : null}
        </div>
        ${shown.length ? shown.map(c => html`<${PersonRow} key=${c.id} c=${c} onOpen=${setDrawer} onOrg=${openOrg}/>`)
          : html`<${UI.Empty} text=${ix.contacts.length ? 'Nobody matches that.' : 'Nobody in the database yet. Add a person, or import a CSV from Apollo.'}/>`}
        ${rows.length > shown.length ? html`<div style=${{marginTop: '12px'}}><${UI.Btn} kind="sec" sm id="base-more" onClick=${() => setLimit(limit + 60)}>Show more<//>
          <span class="small ink62 num" style=${{marginLeft: '10px'}}>${shown.length} of ${rows.length}</span></div>` : null}
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
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 120); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (id) setDrawer(id); }, [id]);
    useEffect(() => { setLimit(60); }, [dq, fl]);
    const ix = index(ctx);
    const cm = ctx.coll.clients.map;
    const res = useMemo(() => find(ctx, dq, {archived: fl.archived, contacts: false}), [ix, dq, fl.archived]);
    const counts = useMemo(() => { const c = {}; ix.contacts.forEach(x => { if (x.org && !x.archived) c[x.org] = (c[x.org] || 0) + 1; }); return c; }, [ix]);
    const rows = useMemo(() => res.orgs.filter(o => {
      if (fl.archived ? !o.archived : o.archived) return false;
      if (fl.industry && o.industry !== fl.industry) return false;
      if (fl.country && o.country !== fl.country) return false;
      const mapped = !!(o.client && cm[o.client]);
      if (fl.map === 'yes' && !mapped) return false;
      if (fl.map === 'no' && mapped) return false;
      return true;
    }), [res, fl, cm]);
    const industries = useMemo(() => distinct(ix.orgs, 'industry'), [ix]);
    const countries = useMemo(() => distinct(ix.orgs, 'country'), [ix]);
    const setF = k => v => setFl(x => ({...x, [k]: v}));
    const close = () => { setDrawer(null); if (id) M.nav('#companies'); };
    const shown = rows.slice(0, limit);
    if (!ctx.coll.orgs.ready) return html`<${UI.Card}><${UI.Empty} text="One moment."/><//>`;
    return html`<div class="stack" style=${{gap: '14px'}} id="base-companies">
      <div class="row nowrap bs-searchrow">
        <div class="grow bs-search">
          <${icons.search}/>
          <input id="companies-q" class="input" type="search" placeholder="Search companies" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Search companies"/>
        </div>
        <${UI.Btn} id="companies-add" onClick=${() => setDrawer('new')}><${icons.plus}/>Add a company<//>
      </div>
      <div class="bs-chips row">
        <${Chip} on=${fl.map === 'yes'} onClick=${() => setF('map')(fl.map === 'yes' ? '' : 'yes')}>Mapped to a client<//>
        <${Chip} on=${fl.map === 'no'} onClick=${() => setF('map')(fl.map === 'no' ? '' : 'no')}>Not mapped<//>
        ${industries.length ? html`<${FilterSelect} id="companies-industry" label="Industry" value=${fl.industry} onChange=${setF('industry')} options=${[{v: '', label: 'Any industry'}].concat(industries.map(c => ({v: c, label: c})))}/>` : null}
        <${FilterSelect} id="companies-country" label="Country" value=${fl.country} onChange=${setF('country')} options=${[{v: '', label: 'Any country'}].concat(countries.map(c => ({v: c, label: c})))}/>
        <${Chip} on=${fl.archived} onClick=${() => setF('archived')(!fl.archived)}>Archived<//>
      </div>
      <div class="row between">
        <span class="small ink62 num" id="companies-count">${rows.length} ${rows.length === 1 ? 'company' : 'companies'}${dq ? ' for "' + dq + '"' : ''}</span>
        ${ctx.downloads && rows.length ? html`<button type="button" class="linky small" id="companies-export" onClick=${() => exportCsv(ctx, 'orgs', rows)}>Export CSV</button>` : null}
      </div>
      ${shown.length ? html`<div class="grid2 bs-cards">
        ${shown.map(o => {
          const cl = o.client && cm[o.client] ? cm[o.client] : null;
          const n = counts[o.id] || 0;
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
      </div>` : html`<${UI.Card}><${UI.Empty} text=${ix.orgs.length ? 'No company matches that.' : 'No companies yet. They arrive with people, or add one.'}/><//>`}
      ${rows.length > shown.length ? html`<div><${UI.Btn} kind="sec" sm id="companies-more" onClick=${() => setLimit(limit + 60)}>Show more<//>
        <span class="small ink62 num" style=${{marginLeft: '10px'}}>${shown.length} of ${rows.length}</span></div>` : null}
      ${drawer ? html`<${OrgDrawer} key=${drawer} id=${drawer === 'new' ? null : drawer} onClose=${close}/>` : null}
    </div>`;
  }

  /* ---------- Import ---------- */
  function Import() {
    const ctx = M.useCtx();
    const [parsed, setParsed] = useState(null);
    const [mapping, setMapping] = useState([]);
    const [paste, setPaste] = useState('');
    const [fileName, setFileName] = useState('');
    const [busy, setBusy] = useState(false);
    const [prog, setProg] = useState('');
    const [summary, setSummary] = useState(null);
    const [owners, setOwners] = useState({});
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
    const plan = useMemo(() => parsed ? planImport(ctx, parsed, mapping, ownerOf) : null, [parsed, mapping, ix, owners]);

    if (!ctx.isFounder) {
      return html`<${UI.Card} title="Import"><div class="small">Imports are done by Kaavish. Search People for anyone already in the database.</div><//>`;
    }
    const load = (text, name) => {
      const p = parseCsv(text);
      if (!p.headers.length) { M.toast('That file has no columns', true); return; }
      setParsed(p); setMapping(mapApollo(p.headers)); setSummary(null); setFileName(name || 'pasted text');
    };
    const onFile = e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => load(String(rd.result || ''), file.name);
      rd.onerror = () => M.toast('That file could not be read', true);
      rd.readAsText(file);
    };
    const mappedCols = mapping.filter(m => m.field).length;
    const setField = (i, v) => setMapping(m => m.map((x, j) => j === i ? {...x, field: v} : x));
    const preview = parsed ? parsed.rows.slice(0, 5).map(row => {
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
      } catch (e) { setProg(''); }
      setBusy(false);
    };
    const n = plan ? plan.people : 0;
    return html`<div class="stack" style=${{gap: '16px'}} id="base-import">
      <${UI.Card} title="Import from Apollo" action=${last ? html`<span class="tiny ink62">last import ${U.timeAgo(last.at)}: ${last.added} new, ${last.updated} updated, ${last.orgs} companies</span>` : null}>
        <p class="small ink62" style=${{marginTop: 0}}>Export your contacts from Apollo as a CSV and drop it here. Only the useful columns come through: names, titles, emails, phones, company, city, stage, lists. Hand edits in the database always win over Apollo.</p>
        <div class="row" style=${{alignItems: 'flex-start'}}>
          <div class="field grow">
            <label for="import-file">csv file</label>
            <input id="import-file" class="input bs-file" type="file" accept=".csv,text/csv" onChange=${onFile}/>
          </div>
        </div>
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
          <div class="kpi"><span class="v num">${summary.added}</span><span class="l">new people</span></div>
          <div class="kpi"><span class="v num">${summary.updated}</span><span class="l">updated</span></div>
          <div class="kpi"><span class="v num">${summary.unchanged}</span><span class="l">unchanged</span></div>
          <div class="kpi"><span class="v num">${summary.orgsNew}</span><span class="l">new companies</span></div>
          <div class="kpi"><span class="v num">${summary.mapped}</span><span class="l">mapped to clients</span></div>
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
    const {contacts, orgs} = all(ctx);
    useAutoMap(ctx);
    const cm = ctx.coll.clients.map;
    const live = contacts.filter(c => !c.archived).length;
    const liveOrgs = orgs.filter(o => !o.archived);
    const mapped = liveOrgs.filter(o => o.client && cm[o.client]).length;
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="the database" title="Base" sub="Everyone we know, who we know them through, and what we do with them.">
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${live} l="people"/>
          <${Mini} v=${liveOrgs.length} l="companies"/>
          <${Mini} v=${mapped} l="mapped to clients"/>
        </div>
      <//>
      <${M.SectionTabs} section="base" active=${t}/>
      ${t === 'companies' ? html`<${Companies} id=${id}/>` : t === 'import' ? html`<${Import}/>` : html`<${People} id=${id}/>`}
    </div>`;
  }

  /* ---------- for the client page: the people at this client's company ---------- */
  function PeopleAtClient({clientId, id}) {
    const ctx = M.useCtx();
    const o = orgForClient(ctx, clientId || id);
    const people = o ? peopleAt(ctx, o.id) : [];
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
    makeClientFromOrg, STAGES, norm, parseCsv, mapApollo, planImport, runImport, PAGE_MAX};
})();
