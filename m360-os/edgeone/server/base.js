/* module: base. The database, searched and listed on the server: a page gets the rows it shows, never the
   25,000 it does not. A compact row per person and per company (the fields lists and search need, plus
   the page it lives on) sits in n/bx/<coll>, rebuilt when the collection's version moves and kept in
   module memory between requests. Full rows come one at a time from their page document. */

const LITE_C = ['name', 'first', 'last', 'title', 'org', 'orgName', 'email', 'city', 'country', 'stage', 'source', 'tags', 'owner', 'archived', 'updated', 'seniority', 'dept'];
const LITE_O = ['name', 'domain', 'website', 'industry', 'city', 'country', 'client', 'size', 'tags', 'archived', 'updated'];
const COLL_OK = {contacts: LITE_C, orgs: LITE_O};
const LIMIT_MAX = 20000;
const EXPORT_MAX = 5000;
const EXPORT_C = ['name', 'first', 'last', 'title', 'orgName', 'email', 'email2', 'phone', 'mobile', 'linkedin', 'city', 'state', 'country', 'seniority', 'dept', 'stage', 'tags', 'source', 'notes'];
const EXPORT_O = ['name', 'domain', 'website', 'industry', 'size', 'city', 'state', 'country', 'linkedin', 'phone', 'keywords', 'tags', 'client', 'notes'];
const SUFFIX = /\s+(pvt ltd|private limited|ltd|limited|llp|inc|llc|co|corp|corporation|company|plc|fze|fzco|fz llc|gmbh|sa|ag)$/;
const normName = s => { let n = String(s || '').toLowerCase().replace(/[^a-z0-9\s&]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, ''); for (let i = 0; i < 4; i++) { const m = n.replace(SUFFIX, '').trim(); if (m === n) break; n = m; } return n; };
const normDomain = s => { let d = String(s || '').trim().toLowerCase(); if (!d) return ''; if (d.indexOf('@') >= 0) d = d.split('@').pop(); d = d.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].split(':')[0]; return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : ''; };
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

export function baseActions(h) {
  const {getJ, putJ, levelOf, LEVEL, HttpError, inventory, readColl, versionOf, docKey} = h;
  const mem = {};
  const need = async v => { if (!v) throw new HttpError(401, 'noid'); if ((await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'invalid_argument'); };
  const collOf = s => { if (!COLL_OK[s]) throw new HttpError(400, 'invalid_argument', 'bad collection'); return s; };
  const lite = (coll, pid, id, r) => {
    const o = {id, pid};
    for (const k of COLL_OK[coll]) { const x = r[k]; if (x === undefined || x === '' || x === null || (Array.isArray(x) && !x.length) || x === false) continue; o[k] = x; }
    return o;
  };
  const blob = (coll, r) => (coll === 'orgs'
    ? [r.name, r.domain, r.industry, r.city, r.country, (r.tags || []).join(' ')]
    : [r.name, r.title, r.email, r.orgName, r.city, r.country, (r.tags || []).join(' '), r.seniority, r.dept]).map(x => String(x || '')).join(' \n ').toLowerCase();

  /* the compact index of one collection, fresh for its current version */
  async function indexOf(coll, inv) {
    inv = inv || await inventory();
    const tags = inv[coll] || {};
    const v = versionOf(tags);
    if (mem[coll] && mem[coll].v === v) return mem[coll];
    let stored = await getJ('n/bx/' + coll).catch(() => null);
    if (!stored || stored.v !== v || !Array.isArray(stored.rows)) {
      const docs = Object.keys(tags).length ? await readColl(coll, tags) : {};
      const rows = [];
      for (const pid of Object.keys(docs).sort()) {
        const rs = (docs[pid] && docs[pid].rows) || {};
        for (const id of Object.keys(rs)) if (rs[id] && typeof rs[id] === 'object') rows.push(lite(coll, pid, id, rs[id]));
      }
      rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      stored = {v, rows, at: Date.now()};
      await putJ('n/bx/' + coll, stored).catch(() => {});
    }
    const rows = stored.rows;
    const s = rows.map(r => blob(coll, r));
    const facets = {};
    const count = (key, list) => { const m = {}; list.forEach(x => { if (x) m[x] = (m[x] || 0) + 1; }); return Object.keys(m).sort((a, b) => a.localeCompare(b)); };
    if (coll === 'contacts') {
      facets.countries = count('country', rows.map(r => r.country));
      facets.tags = count('tags', rows.flatMap(r => r.tags || []));
    } else {
      facets.industries = count('industry', rows.map(r => r.industry));
      facets.countries = count('country', rows.map(r => r.country));
    }
    mem[coll] = {v, rows, s, facets, byId: Object.fromEntries(rows.map(r => [r.id, r]))};
    return mem[coll];
  }
  /* people per company, from the contacts index */
  async function peopleCounts(inv) {
    const c = await indexOf('contacts', inv);
    if (c.counts) return c.counts;
    const n = {}, last = {};
    for (const r of c.rows) { if (r.archived || !r.org) continue; n[r.org] = (n[r.org] || 0) + 1; last[r.org] = Math.max(last[r.org] || 0, Number(r.updated) || 0); }
    c.counts = {n, last};
    return c.counts;
  }
  const rank = (r, q) => { const nm = String(r.name || '').toLowerCase(); if (nm.indexOf(q) === 0) return 0; if (nm.split(/\s+/).some(w => w.indexOf(q) === 0)) return 1; return 2; };
  const matches = (blobStr, q, words) => blobStr.indexOf(q) >= 0 || (words.length > 1 && words.every(w => blobStr.indexOf(w) >= 0));

  async function orgForClient(cid, inv) {
    const o = await indexOf('orgs', inv);
    const hit = o.rows.find(r => r.client === cid && !r.archived);
    if (hit) return hit;
    const c = await getJ(docKey('clients/' + cid)).catch(() => null);
    if (!c) return null;
    const cn = normName(c.name), cd = normDomain(c.domain || c.website || '');
    if (!cn && !cd) return null;
    return o.rows.find(r => !r.archived && ((cd && r.domain === cd) || (cn && normName(r.name) === cn))) || null;
  }

  const actions = {
    /* {coll, q, stage, owner, country, source, tag, archived, industry, map, org, client, ids, offset, limit} */
    async basesearch(v, body) {
      await need(v);
      const coll = collOf(String(body.coll || 'contacts'));
      const inv = await inventory();
      const ix = await indexOf(coll, inv);
      const q = String(body.q || '').trim().toLowerCase().slice(0, 120);
      const words = q.split(/\s+/).filter(Boolean);
      const archived = !!body.archived;
      const ids = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null;
      let orgId = String(body.org || '');
      if (!orgId && body.client) { const o = await orgForClient(String(body.client), inv); if (!o) return {v: ix.v, total: 0, rows: [], facets: ix.facets, orgs: []}; orgId = o.id; }
      const tag = String(body.tag || ''), stage = String(body.stage || ''), owner = String(body.owner || ''), country = String(body.country || ''), source = String(body.source || ''), industry = String(body.industry || ''), map = String(body.map || '');
      const out = [];
      for (let i = 0; i < ix.rows.length; i++) {
        const r = ix.rows[i];
        if (ids) { if (!ids.has(r.id)) continue; } else if (archived ? !r.archived : r.archived) continue;
        if (orgId && r.org !== orgId) continue;
        if (stage && r.stage !== stage) continue;
        if (owner && r.owner !== owner) continue;
        if (country && r.country !== country) continue;
        if (source && r.source !== source) continue;
        if (industry && r.industry !== industry) continue;
        if (tag && (r.tags || []).indexOf(tag) < 0) continue;
        if (map === 'yes' && !r.client) continue;
        if (map === 'no' && r.client) continue;
        if (q && !matches(ix.s[i], q, words)) continue;
        out.push(r);
      }
      if (q) out.sort((a, b) => rank(a, q) - rank(b, q) || (Number(b.updated) || 0) - (Number(a.updated) || 0));
      const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
      const limit = Math.max(1, Math.min(LIMIT_MAX, Math.floor(Number(body.limit) || 60)));
      let rows = out.slice(offset, offset + limit);
      if (coll === 'orgs') { const pc = await peopleCounts(inv); rows = rows.map(r => ({...r, people: pc.n[r.id] || 0, lastPerson: pc.last[r.id] || 0})); }
      let orgs = [];
      if (coll === 'contacts' && q && !orgId) {
        const o = await indexOf('orgs', inv);
        const pc = await peopleCounts(inv);
        orgs = o.rows.filter((r, i) => !r.archived && matches(o.s[i], q, words)).sort((a, b) => rank(a, q) - rank(b, q)).slice(0, 6).map(r => ({id: r.id, name: r.name, people: pc.n[r.id] || 0}));
      }
      return {v: ix.v, total: out.length, rows, facets: ix.facets, orgs};
    },
    /* one full row with its page: {coll, id} or, for the company of a client, {coll: 'orgs', client} */
    async baseget(v, body) {
      await need(v);
      const coll = collOf(String(body.coll || 'contacts'));
      const inv = await inventory();
      let hit = null;
      if (body.client) hit = await orgForClient(String(body.client), inv);
      else { const ix = await indexOf(coll, inv); hit = ix.byId[String(body.id || '')] || null; }
      if (!hit) return {row: null, pid: null};
      const page = await getJ(docKey(coll + '/' + hit.pid)).catch(() => null);
      const row = page && page.rows && page.rows[hit.id];
      if (!row) return {row: null, pid: null};
      const out = {row: {...row, id: hit.id}, pid: hit.pid};
      if (coll === 'orgs') { const pc = await peopleCounts(inv); out.people = pc.n[hit.id] || 0; }
      return out;
    },
    async basestats(v) {
      await need(v);
      const inv = await inventory();
      const c = await indexOf('contacts', inv), o = await indexOf('orgs', inv);
      return {people: c.rows.filter(r => !r.archived).length, companies: o.rows.filter(r => !r.archived).length, mapped: o.rows.filter(r => !r.archived && r.client).length, v: c.v + '|' + o.v};
    },
    /* the page a new row goes on: the last page under 200 rows and 160 KB, else the next page id */
    async baseroom(v, body) {
      await need(v);
      const coll = collOf(String(body.coll || 'contacts'));
      const ix = await indexOf(coll);
      const counts = {};
      ix.rows.forEach(r => { counts[r.pid] = (counts[r.pid] || 0) + 1; });
      const pages = Object.keys(counts).sort();
      for (let i = pages.length - 1; i >= Math.max(0, pages.length - 3); i--) {
        const pid = pages[i];
        if (counts[pid] >= 200) continue;
        const page = await getJ(docKey(coll + '/' + pid)).catch(() => null);
        if (page && JSON.stringify(page).length + (Number(body.need) || 2000) <= 160 * 1024) return {pid, n: counts[pid], isNew: false};
      }
      let next = 0;
      for (const p of pages) { const k = parseInt(String(p).slice(1), 10); if (k >= next) next = k + 1; }
      return {pid: 'p' + String(next).padStart(3, '0'), n: 0, isNew: true};
    },
    /* a CSV of the rows that match, up to EXPORT_MAX */
    async baseexport(v, body) {
      await need(v);
      const coll = collOf(String(body.coll || 'contacts'));
      const r = await actions.basesearch(v, {...body, offset: 0, limit: EXPORT_MAX});
      const cols = coll === 'orgs' ? EXPORT_O : EXPORT_C;
      const byPage = {};
      r.rows.forEach(x => { (byPage[x.pid] = byPage[x.pid] || []).push(x.id); });
      const clients = coll === 'orgs' ? await getJ('a/clients').catch(() => null) : null;
      const lines = [cols.map(csvCell).join(',')];
      for (const pid of Object.keys(byPage).sort()) {
        const page = await getJ(docKey(coll + '/' + pid)).catch(() => null);
        for (const id of byPage[pid]) {
          const row = page && page.rows && page.rows[id];
          if (!row) continue;
          lines.push(cols.map(k => { let x = row[k]; if (k === 'client' && x && clients && clients.docs && clients.docs[x]) x = clients.docs[x].d ? clients.docs[x].d.name : x; if (Array.isArray(x)) x = x.join('; '); return csvCell(x); }).join(','));
        }
      }
      return {csv: lines.join('\n'), rows: r.rows.length, total: r.total, capped: r.total > EXPORT_MAX};
    }
  };
  return {actions};
}
