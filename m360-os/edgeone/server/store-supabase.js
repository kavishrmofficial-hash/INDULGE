/* module: the store on Supabase (v50). The EdgeOne blob store refused every write from 9 November 2026 (its
   1 GB free quota, counted by EdgeOne, with the OS holding about 216 MB). The same keys now live in one
   Postgres table on Supabase, public.m360_blobs {key, value, at}, reached through its REST API:
     apikey       the project's publishable key (env M360_STORE_ANON)
     x-m360-key   the OS server's own key (env M360_STORE_KEY); the table's row policy lets a request in only
                  when its SHA-256 matches the one the database keeps. Nothing else can read or write a row.
   It answers the store contract core.js uses: get(key, {type}), set(key, value, {onlyIfNew}), delete(key),
   list({prefix}) -> {blobs: [{key}]}.

   hybridStore moves an existing site across without a pause: writes go to Supabase, a read that Supabase
   cannot answer yet falls back to the old store (and copies the key up), a delete goes from both, a listing is
   both together, and migrate() copies what is left a few seconds at a time until everything is across. */

const likeEsc = s => String(s).replace(/[\\%_]/g, m => '\\' + m);

export function supabaseStore({url, anon, key, fetch: f}) {
  const base = String(url || '').replace(/\/+$/, '') + '/rest/v1/m360_blobs';
  const doFetch = (...a) => (f || fetch)(...a);
  const H = extra => ({apikey: anon, authorization: 'Bearer ' + anon, 'x-m360-key': key, ...(extra || {})});
  const enc = encodeURIComponent;
  async function call(path, init, okStatus) {
    const r = await doFetch(base + path, {...init, headers: H(init && init.headers)});
    if (!r.ok && !(okStatus && okStatus.includes(r.status))) {
      const t = await r.text().catch(() => '');
      const e = new Error('store ' + r.status + ': ' + t.slice(0, 200));
      e.status = r.status;
      throw e;
    }
    return r;
  }
  return {
    kind: 'supabase',
    async get(k, opts) {
      const r = await call('?select=value&key=eq.' + enc(k), {headers: {accept: 'application/json'}});
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) return null;
      const v = rows[0].value;
      return opts && opts.type === 'json' ? JSON.parse(v) : v;
    },
    async set(k, v, opts) {
      const body = JSON.stringify({key: String(k), value: String(v), at: new Date().toISOString()});
      if (opts && opts.onlyIfNew) {
        const r = await call('', {method: 'POST', headers: {'content-type': 'application/json', prefer: 'return=minimal'}, body}, [409]);
        if (r.status === 409) { const e = new Error('conditional write failed (key already exists)'); e.code = 'PRECONDITION_FAILED'; throw e; }
        return;
      }
      await call('?on_conflict=key', {method: 'POST', headers: {'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal'}, body});
    },
    async delete(k) {
      await call('?key=eq.' + enc(k), {method: 'DELETE', headers: {prefer: 'return=minimal'}});
    },
    async list(opts) {
      const p = (opts && opts.prefix) || '';
      const out = [];
      let after = '';
      for (let page = 0; page < 1000; page++) {
        let q = '?select=key&order=key.asc&limit=1000';
        if (p) q += '&key=like.' + enc(likeEsc(p) + '*');
        if (after) q += '&key=gt.' + enc(after);
        const rows = await (await call(q, {headers: {accept: 'application/json'}})).json();
        for (const row of rows) out.push({key: row.key});
        if (rows.length < 1000) break;
        after = rows[rows.length - 1].key;
      }
      return {blobs: out, directories: []};
    }
  };
}

/* writes to primary; reads fall back to legacy until the move is done; deletes from both; listings from both */
export function hybridStore(primary, legacy) {
  const DONE = 'mig/done';
  let done = null;              /* null: not looked yet */
  const isDone = async () => {
    if (done === true) return true;
    done = !!(await primary.get(DONE).catch(() => null));
    return done;
  };
  const store = {
    kind: 'hybrid',
    async get(k, opts) {
      const v = await primary.get(k, opts);
      if (v != null || await isDone()) return v;
      const old = await legacy.get(k, {type: 'text'}).catch(() => null);
      if (old == null) return null;
      await primary.set(k, old).catch(() => {});
      return opts && opts.type === 'json' ? JSON.parse(old) : old;
    },
    async set(k, v, opts) {
      if (opts && opts.onlyIfNew && !(await isDone())) {
        /* a key only the old store has is not new */
        const old = await legacy.get(k, {type: 'text'}).catch(() => null);
        if (old != null && (await primary.get(k).catch(() => null)) == null) { const e = new Error('conditional write failed (key already exists)'); e.code = 'PRECONDITION_FAILED'; throw e; }
      }
      return primary.set(k, v, opts);
    },
    async delete(k) {
      await primary.delete(k);
      if (!(await isDone())) await legacy.delete(k).catch(() => {});
    },
    async list(opts) {
      const a = await primary.list(opts);
      if (await isDone()) return a;
      const b = await legacy.list(opts).catch(() => ({blobs: []}));
      const seen = new Set((a.blobs || []).map(x => x.key));
      const blobs = (a.blobs || []).slice();
      for (const x of b.blobs || []) if (!seen.has(x.key)) { seen.add(x.key); blobs.push({key: x.key}); }
      blobs.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
      return {blobs, directories: []};
    },
    /* copy what the new store does not have yet, for about budgetMs; marks the move done when nothing is left */
    async migrate(budgetMs) {
      if (await isDone()) return {done: true};
      const t0 = Date.now();
      const have = new Set(((await primary.list({})).blobs || []).map(x => x.key));
      const old = ((await legacy.list({}).catch(() => ({blobs: []}))).blobs || []).map(x => x.key).filter(k => !have.has(k));
      let copied = 0;
      for (const k of old) {
        if (Date.now() - t0 > (budgetMs || 5000)) break;
        const v = await legacy.get(k, {type: 'text'}).catch(() => null);
        if (v != null) { await primary.set(k, v, {onlyIfNew: true}).catch(() => {}); copied++; }
      }
      const left = old.length - copied;
      if (!left) { await primary.set(DONE, JSON.stringify({at: Date.now()})); done = true; }
      return {done: !left, copied, left};
    }
  };
  return store;
}

/* the server's own key (v50.1): an empty blob named ks/m360store~<key> in the old store. The first instance
   makes one; every instance tries the names it finds against the database's m360_claim(h), which keeps the
   first SHA-256 it is given while its claim window is open and answers whether a hash is the kept one */
const sha256hex = async s => {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
};
export async function ownKey(edge, {url, anon, fetch: f}) {
  const doFetch = (...a) => (f || fetch)(...a);
  const P = 'ks/m360store~';
  const claim = async k => {
    const r = await doFetch(String(url).replace(/\/+$/, '') + '/rest/v1/rpc/m360_claim', {method: 'POST',
      headers: {apikey: anon, authorization: 'Bearer ' + anon, 'content-type': 'application/json'}, body: JSON.stringify({h: await sha256hex(k)})});
    return r.ok && (await r.json().catch(() => false)) === true;
  };
  const names = async () => ((await edge.list({prefix: P}).catch(() => ({blobs: []}))).blobs || []).map(b => String(b.key).slice(P.length)).filter(Boolean).sort();
  for (const k of await names()) if (await claim(k)) return k;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const k = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await edge.set(P + k, '');
  if (await claim(k)) return k;
  /* another instance made one at the same moment and won: use that one */
  for (const n of await names()) if (n !== k && await claim(n)) return n;
  return '';
}
