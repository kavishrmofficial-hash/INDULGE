/* safety: the trash, daily backups, restore and an integrity check. Standalone only.

   Storage it adds to the layout in core.js:
     t/<ms>~<doc key without d/>     {path, by, at, doc}          a document that was deleted, kept 30 days
     bk/index                        {days: [ymd...], last, lastError}   newest first, at most 45 days
     bk/<ymd>/index                  {at, colls: {name: count}, bytes, bad}
     bk/<ymd>/<coll, slashes as ~>   {docs: {id: data}}           one blob per collection per day
     bk/<ymd>/lock                   {at, id}                     best effort guard against two instances backing up at once

   Nothing here erases a d/ blob except restorecoll in overwrite mode, and that copies the current
   document to the trash first through the same hook every delete goes through. */

const TRASH_DAYS = 30;
const BACKUP_DAYS = 45;
const TRASH_LIST = 300;
const RESPONSE_CAP = 4 * 1024 * 1024;
const LOCK_MS = 10 * 60000;
const RECHECK_MS = 5 * 60000;
const CHUNK = 25;
const IST_MS = 330 * 60000;
const ymdIST = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const TRASH_ID = /^\d{10,16}~[A-Za-z0-9_\-.:@+~]{1,600}$/;
const COLL_OK = /^[A-Za-z0-9_\-.:@+]{1,200}(\/[A-Za-z0-9_\-.:@+]{1,200})*$/;
const segs = p => String(p || '').split('/').filter(Boolean);
const normTag = t => String(t || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
const bkKey = (ymd, coll) => 'bk/' + ymd + '/' + segs(coll).join('~');
const collOfKey = key => { const s = key.slice(3).split('/'); return s.slice(1).join('/').split('~').join('/'); };
const aggKey = coll => 'a/' + segs(coll).join('~');
const rand = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* run fn over a list a few at a time, so a big store does not open hundreds of reads at once */
async function eachChunk(list, fn) {
  for (let i = 0; i < list.length; i += CHUNK) await Promise.all(list.slice(i, i + CHUNK).map(fn));
}

export function safetyActions(h) {
  const {store, getJ, putJ, listAll, levelOf, ownerUid, LEVEL, HttpError, docKey, pathOfKey, isObj, hooks, log} = h;
  const raw = key => store.get(key, {type: 'text', consistency: 'strong'});
  const admin = async v => { if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument'); };
  const owner = async v => { if (!v || v.uid !== (await ownerUid())) throw new HttpError(403, 'invalid_argument'); };
  const bigness = obj => JSON.stringify(obj).length;

  /* ---------- the trash ---------- */
  hooks.beforeDelete = async function beforeDelete(key, path, uid) {
    let doc = null;
    try { doc = await getJ(key); }
    catch (e) { const s = await raw(key).catch(() => null); doc = s == null ? null : {raw: String(s)}; }
    if (doc == null) return;
    await putJ('t/' + Date.now() + '~' + key.slice(2), {path, by: uid || '', at: Date.now(), doc});
  };
  const trashMs = key => Number(key.slice(2).split('~')[0]) || 0;
  async function pruneTrash(days) {
    const cutoff = Date.now() - days * 86400000;
    let removed = 0;
    for (const b of await listAll('t/')) {
      if (trashMs(b.key) >= cutoff) continue;
      await store.delete(b.key).catch(() => {});
      removed++;
    }
    return removed;
  }

  /* ---------- every document, read once, grouped by collection ---------- */
  async function readEverything() {
    const colls = {}, bad = [];
    let bytes = 0;
    const blobs = (await listAll('d/')).filter(b => { const s = segs(pathOfKey(b.key)); return s.length >= 2 && s.length % 2 === 0; });
    await eachChunk(blobs, async b => {
      const s = segs(pathOfKey(b.key)), coll = s.slice(0, -1).join('/'), id = s[s.length - 1];
      const str = await raw(b.key).catch(() => null);
      if (str == null) return;
      let data;
      try { data = JSON.parse(String(str)); } catch (e) { bad.push(b.key); return; }
      bytes += String(str).length;
      (colls[coll] = colls[coll] || {})[id] = data;
    });
    return {colls, bad, bytes};
  }

  /* ---------- backups ---------- */
  async function readIndex() {
    const idx = (await getJ('bk/index').catch(() => null)) || {};
    return {...idx, days: Array.isArray(idx.days) ? idx.days.filter(d => YMD.test(d)) : []};
  }
  async function dropDay(ymd) {
    for (const b of await listAll('bk/' + ymd + '/')) await store.delete(b.key).catch(() => {});
  }
  async function runBackup(force) {
    const now = Date.now(), ymd = ymdIST(now);
    const index = await readIndex();
    if (!force && index.days.includes(ymd)) return {ymd, skipped: 'done'};
    const lockKey = 'bk/' + ymd + '/lock';
    const held = await getJ(lockKey).catch(() => null);
    if (!force && held && now - (held.at || 0) < LOCK_MS) return {ymd, skipped: 'locked'};
    const me = rand();
    await putJ(lockKey, {at: now, id: me});
    const again = await getJ(lockKey).catch(() => null);
    if (!force && again && again.id !== me) return {ymd, skipped: 'locked'};
    try {
      const {colls, bad, bytes} = await readEverything();
      const counts = {};
      for (const coll of Object.keys(colls).sort()) {
        counts[coll] = Object.keys(colls[coll]).length;
        await putJ(bkKey(ymd, coll), {docs: colls[coll]});
      }
      const manifest = {at: Date.now(), colls: counts, bytes, bad};
      await putJ('bk/' + ymd + '/index', manifest);
      const cutoff = ymdIST(Date.now() - BACKUP_DAYS * 86400000);
      const days = [ymd].concat(index.days.filter(d => d !== ymd)).sort().reverse();
      for (const d of days) if (d < cutoff) await dropDay(d);
      await putJ('bk/index', {...index, days: days.filter(d => d >= cutoff), last: manifest.at, lastError: null});
      return {ymd, ...manifest};
    } finally {
      await store.delete(lockKey).catch(() => {});
    }
  }

  /* upkeep: at most one look per request, and once a day's backup is known to exist this instance stops looking */
  let upkeepDay = '', upkeepBusy = false, upkeepNext = 0;
  hooks.upkeep = async function upkeep() {
    const now = Date.now(), ymd = ymdIST(now);
    if (upkeepDay === ymd || upkeepBusy || now < upkeepNext) return;
    upkeepBusy = true;
    try {
      const index = await readIndex();
      if (!index.days.includes(ymd)) {
        const r = await runBackup(false);
        if (r.skipped === 'locked') { upkeepNext = now + RECHECK_MS; return; }
        await pruneTrash(TRASH_DAYS).catch(() => {});
      }
      upkeepDay = ymd;
    } catch (e) {
      upkeepNext = now + RECHECK_MS;
      try {
        const index = await readIndex();
        await putJ('bk/index', {...index, lastError: {at: now, message: String((e && e.message) || e).slice(0, 200)}});
      } catch (x) { /* the store itself is unwell; the next request looks again */ }
    } finally { upkeepBusy = false; }
  };

  async function dayManifest(ymd) {
    const m = await getJ('bk/' + ymd + '/index').catch(() => null);
    return m ? {ymd, at: m.at || 0, colls: isObj(m.colls) ? m.colls : {}, bytes: m.bytes || 0, bad: Array.isArray(m.bad) ? m.bad.length : 0} : null;
  }
  const wantYmd = s => { if (!YMD.test(String(s || ''))) throw new HttpError(400, 'invalid_argument', 'day as YYYY-MM-DD'); return String(s); };
  const wantColl = s => { if (!COLL_OK.test(String(s || ''))) throw new HttpError(400, 'invalid_argument', 'bad collection'); return String(s); };
  async function backupColl(ymd, coll) {
    const b = await getJ(bkKey(ymd, coll)).catch(() => null);
    if (!b || !isObj(b.docs)) throw new HttpError(404, 'invalid_argument', 'no backup of ' + coll + ' on ' + ymd);
    return b.docs;
  }

  /* ---------- aggregate caches: a/<coll> against the d/ blobs ---------- */
  async function checkCaches(inv) {
    const stale = [];
    for (const b of await listAll('a/')) {
      const coll = b.key.slice(2).split('~').join('/');
      const agg = await getJ(b.key).catch(() => null);
      const have = (agg && isObj(agg.docs)) ? agg.docs : null;
      const want = inv[coll] || {};
      const ids = Object.keys(want), got = have ? Object.keys(have) : [];
      const off = !have || ids.length !== got.length || ids.some(id => !have[id] || have[id].h !== want[id]);
      if (off) stale.push(coll);
    }
    return stale;
  }
  async function rebuildCache(coll, inv) {
    const tags = inv[coll] || {};
    const fresh = {};
    await eachChunk(Object.keys(tags), async id => {
      const d = await getJ(docKey(coll + '/' + id)).catch(() => null);
      if (d != null) fresh[id] = {h: tags[id], d};
    });
    await putJ(aggKey(coll), {docs: fresh});
  }

  return {
    /* the newest deleted documents, newest first */
    async trash(v) {
      await admin(v);
      const keys = (await listAll('t/')).map(b => b.key).sort((a, b) => trashMs(b) - trashMs(a)).slice(0, TRASH_LIST);
      const items = [];
      await eachChunk(keys, async key => {
        const t = await getJ(key).catch(() => null);
        if (t) items.push({id: key.slice(2), path: t.path || key.slice(2).split('~').slice(1).join('/'), by: t.by || '', at: t.at || trashMs(key)});
      });
      return {items: items.sort((a, b) => b.at - a.at)};
    },
    /* put one deleted document back where it was */
    async restore(v, body) {
      await admin(v);
      const id = String(body.id || '');
      if (!TRASH_ID.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      const t = await getJ('t/' + id).catch(() => null);
      if (!t || !t.path || t.doc == null) throw new HttpError(404, 'invalid_argument', 'That is no longer in the trash.');
      const key = docKey(t.path);
      const cur = await raw(key).catch(() => null);
      if (cur != null && body.force !== true) throw new HttpError(409, 'exists', 'A document is already there.');
      if (cur != null) await hooks.beforeDelete(key, t.path, v.uid);
      if (isObj(t.doc) && typeof t.doc.raw === 'string' && Object.keys(t.doc).length === 1) await store.set(key, t.doc.raw);
      else await store.set(key, JSON.stringify(t.doc));
      await store.delete('t/' + id).catch(() => {});
      await log(v.uid, 'restore', t.path, cur != null ? 'from the trash, replaced the current one' : 'from the trash');
      return {ok: true, path: t.path};
    },
    async emptytrash(v, body) {
      await admin(v);
      const n = Number(body.days);
      const days = body.days == null || !isFinite(n) ? TRASH_DAYS : Math.max(0, Math.min(3650, Math.floor(n)));
      const removed = await pruneTrash(days);
      await log(v.uid, 'emptytrash', '', removed + (removed === 1 ? ' entry' : ' entries') + ' older than ' + days + (days === 1 ? ' day' : ' days'));
      return {removed, days};
    },

    /* every day that has a backup, newest first */
    async backups(v) {
      await admin(v);
      await hooks.upkeep().catch(() => {});
      const index = await readIndex();
      const days = [];
      await eachChunk(index.days, async ymd => { const m = await dayManifest(ymd); if (m) days.push(m); });
      days.sort((a, b) => (a.ymd < b.ymd ? 1 : -1));
      return {days, last: index.last || 0, lastError: index.lastError || null, keepDays: BACKUP_DAYS, trashDays: TRASH_DAYS};
    },
    async backup(v, body) {
      await admin(v);
      const r = await runBackup(body.force !== false);
      await log(v.uid, 'backup', '', r.skipped ? 'skipped, ' + r.skipped : Object.keys(r.colls || {}).length + ' collections');
      return r;
    },
    /* one collection of one day, or the whole day; over 4 MB it says so and lists the collections instead */
    async backupget(v, body) {
      await admin(v);
      const ymd = wantYmd(body.ymd);
      if (body.coll) {
        const coll = wantColl(body.coll);
        const docs = await backupColl(ymd, coll);
        const out = {ymd, coll, docs};
        if (bigness(out) > RESPONSE_CAP) return {ymd, coll, tooBig: true, limit: RESPONSE_CAP, count: Object.keys(docs).length};
        return out;
      }
      const m = await dayManifest(ymd);
      if (!m) throw new HttpError(404, 'invalid_argument', 'no backup on ' + ymd);
      const colls = {};
      for (const coll of Object.keys(m.colls)) colls[coll] = {docs: await backupColl(ymd, coll).catch(() => ({}))};
      const out = {ymd, at: m.at, colls};
      if (bigness(out) > RESPONSE_CAP) return {ymd, at: m.at, tooBig: true, limit: RESPONSE_CAP, colls: m.colls};
      return out;
    },
    /* the founder writes a backed up collection back: only what is missing, or over the top of what is there */
    async restorecoll(v, body) {
      await owner(v);
      const ymd = wantYmd(body.ymd), coll = wantColl(body.coll);
      const mode = body.mode === 'overwrite' ? 'overwrite' : 'missing';
      const docs = await backupColl(ymd, coll);
      let ids = Object.keys(docs);
      if (Array.isArray(body.ids)) { const want = new Set(body.ids.map(String)); ids = ids.filter(id => want.has(id)); }
      let written = 0, skipped = 0, trashed = 0;
      for (const id of ids) {
        const path = coll + '/' + id, key = docKey(path);
        const cur = await raw(key).catch(() => null);
        if (cur != null) {
          if (mode === 'missing') { skipped++; continue; }
          if (cur === JSON.stringify(docs[id])) { skipped++; continue; }
          await hooks.beforeDelete(key, path, v.uid);
          trashed++;
        }
        await store.set(key, JSON.stringify(docs[id]));
        written++;
      }
      await log(v.uid, 'restore', coll, mode + ' from ' + ymd + ': ' + written + ' written, ' + skipped + ' skipped, ' + trashed + ' to the trash');
      return {ymd, coll, mode, written, skipped, trashed};
    },

    /* what is in the store and whether it all reads: counts, newest stamps, unreadable blobs, caches, orphans */
    async integrity(v) {
      await admin(v);
      const {colls, bad} = await readEverything();
      const inv = {};
      for (const b of await listAll('d/')) {
        const s = segs(pathOfKey(b.key));
        if (s.length < 2 || s.length % 2) continue;
        (inv[s.slice(0, -1).join('/')] = inv[s.slice(0, -1).join('/')] || {})[s[s.length - 1]] = normTag(b.etag);
      }
      const out = {}, stamp = d => Math.max(Number(isObj(d) && d.updated) || 0, Number(isObj(d) && d.at) || 0);
      let docs = 0;
      for (const coll of Object.keys(colls).sort()) {
        const ids = Object.keys(colls[coll]);
        docs += ids.length;
        const newest = ids.reduce((m, id) => Math.max(m, stamp(colls[coll][id])), 0);
        out[coll] = {count: ids.length, newest: newest || null};
      }
      const stale = await checkCaches(inv);
      for (const coll of stale) await rebuildCache(coll, inv).catch(() => {});
      const people = new Set((await listAll('p/')).map(b => b.key.slice(2)));
      let orphanSessions = 0;
      await eachChunk(await listAll('s/'), async b => { const s = await getJ(b.key).catch(() => null); if (!s || !s.uid || !people.has(s.uid)) orphanSessions++; });
      const index = await readIndex();
      return {docs, colls: out, bad, caches: {stale, rebuilt: stale.length}, orphans: {sessions: orphanSessions},
        lastBackup: index.last || 0, lastError: index.lastError || null, ok: !bad.length && !stale.length};
    },
    /* everything under d/ as one JSON, or one collection of it when the whole is over 4 MB */
    async snapshotall(v, body) {
      await admin(v);
      const {colls, bad} = await readEverything();
      const at = Date.now();
      if (body.coll) {
        const coll = wantColl(body.coll);
        const out = {app: 'm360 OS', exported: new Date(at).toISOString(), coll, docs: colls[coll] || {}};
        if (bigness(out) > RESPONSE_CAP) return {coll, tooBig: true, limit: RESPONSE_CAP, count: Object.keys(colls[coll] || {}).length};
        return out;
      }
      const wrapped = {};
      const counts = {};
      for (const coll of Object.keys(colls).sort()) { wrapped[coll] = {docs: colls[coll]}; counts[coll] = Object.keys(colls[coll]).length; }
      const out = {app: 'm360 OS', exported: new Date(at).toISOString(), colls: wrapped, bad};
      if (bigness(out) > RESPONSE_CAP) return {tooBig: true, limit: RESPONSE_CAP, colls: counts, bad};
      return out;
    }
  };
}
