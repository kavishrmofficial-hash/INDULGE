/* safety: the trash, daily backups, restore and an integrity check. Standalone only.

   Storage it adds to the layout in core.js:
     t/<ms>~<doc key without d/>     {path, by, at, doc}          a document that was deleted, kept 30 days
     bk/index                        {days: [ymd...], last, lastError}   newest first; the newest 7 stay, older ones once Drive holds them
     bk/<ymd>/index                  {at, colls: {name: count}, bytes, bad}
     bk/<ymd>/<coll, slashes as ~>   {docs: {id: data}}           one blob per collection per day
     bk/<ymd>/lock                   {at, id}                     best effort guard against two instances backing up at once
     bk/site/latest                  the site backup (see below)   written once a day after the daily backup, at most 8 MB
     bk/site/index                   {at, bytes, digest, lastError}   when it was written and the d/ inventory it matches

   The site backup is the whole workspace in one JSON, made for moving m360 from one address to
   another: every document plus the people, their emails, the owner and the password hashes.
     {app: 'm360', kind: 'site', exported, colls: {name: {docs}}, identity: {people, emails, owner, passwords}, settingsKeys: {ai, mail}}
   Sessions, sign-in links, invites, reset codes and the AI and mail keys never travel; the founder
   re-enters the keys after a move. siterestore writes it into a store with no owner yet (a fresh
   deployment, nobody signed in) or, for the owner, merges it into a live site.

   Nothing here erases a d/ blob except restorecoll in overwrite mode and siterestore in replace mode,
   and both copy the current document to the trash first through the same hook every delete goes through. */

const TRASH_DAYS = 30;
const HIST_DAYS = 30;              /* versions kept per document */
const HIST_MAX = 30;
const HIST_ID = /^\d{10,16}~(u_[A-Za-z0-9]{6,40}|server)$/;
/* v48: the newest 7 days stay in this store; every day also goes to Google Drive for good (below). 45 full days
   of a 24 MB workspace here filled the store's 1 GB, after which no write went through at all */
const BACKUP_DAYS = 7;
const TRASH_LIST = 300;
const RESPONSE_CAP = 4 * 1024 * 1024;
const SITE_CAP = 8 * 1024 * 1024;
const SITE_FRESH_MS = 3600000;    /* a cached site backup younger than this, over an unchanged inventory, is served as is */
const SITE_BODY_MAX = 32 * 1024 * 1024;
const DOC_MAX = 256 * 1024;       /* the same document cap core.js applies to writes */
const UID_OK = /^u_[A-Za-z0-9]{6,40}$/;
const SEG_OK = /^[A-Za-z0-9_\-.:@+]{1,200}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  const {store, env, getJ, putJ, listAll, levelOf, ownerUid, LEVEL, HttpError, docKey, pathOfKey, isObj, hooks, log} = h;
  const stampKey = h.stampKey || (async () => {});
  /* every document put back here is stamped, so every open page sees it at once */
  const putDoc = async (key, str) => { await store.set(key, str); await stampKey(key, str).catch(() => {}); };
  const raw = key => store.get(key, {type: 'text', consistency: 'strong'});
  const admin = async v => { if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument'); };
  const owner = async v => { if (!v || v.uid !== (await ownerUid())) throw new HttpError(403, 'invalid_argument'); };
  /* private per-person docs (data/users/<uid>/...) are that person's and the owner's, never another admin's */
  const privateOf = p => { const sg = String(p || '').split('/'); return sg[0] === 'data' && sg[1] === 'users' ? sg[2] || '' : ''; };
  /* a person's prospects (data/users/<uid>/prospects, the month logs prospects.<YYYY-MM> and their -2 overflow)
     are that person's alone, the owner included: the history, the versions, the trash and the backup reads leave
     them out for anyone else. So are the agent's ledger (agent) and the buddy thread (chat), which carry the
     same words once a line is typed there. The daily backup still keeps them, so a restore brings them back whole */
  const PROSPECTS = /^(prospects(\.\d{4}-\d{2}(-2)?)?|agent|chat)$/;
  const prospectsOf = p => { const sg = String(p || '').split('/'); return sg[0] === 'data' && sg[1] === 'users' && sg.length === 4 && PROSPECTS.test(sg[3]) ? sg[2] || '' : ''; };
  const hiddenFrom = (v, p) => { const who = prospectsOf(p); return !!who && who !== v.uid; };
  /* the docs of one collection, with another person's prospects left out */
  const dropProspects = (v, coll, docs) => {
    const who = privateOf(coll);
    if (!who || who === v.uid || !docs || typeof docs !== 'object') return docs;
    const out = {};
    for (const id of Object.keys(docs)) if (!PROSPECTS.test(id)) out[id] = docs[id];
    return out;
  };
  /* the books are the owner's alone, whatever the caller's level; so are the m360 COO's ledger, cards and state */
  const OWNER_ONLY = new Set(['books', 'invoices', 'expenses', 'payroll', 'hr', 'statements', 'coo']);
  const ownerOnly = p => OWNER_ONLY.has(String(p || '').split('/')[0]);
  const mayPeek = async (v, p) => { if (ownerOnly(p) && v.uid !== (await ownerUid())) return false; if (hiddenFrom(v, p)) return false; const who = privateOf(p); return !who || who === v.uid || v.uid === (await ownerUid()); };
  const peekOrRefuse = async (v, p) => { if (!(await mayPeek(v, p))) throw new HttpError(403, 'invalid_argument', 'private'); };
  const dropPrivate = async (v, colls) => {
    if (v.uid === (await ownerUid())) return colls;
    const out = {};
    for (const c of Object.keys(colls || {})) { if (ownerOnly(c)) continue; const who = privateOf(c); if (!who || who === v.uid) out[c] = colls[c]; }
    return out;
  };
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
  /* v39: t/ is shared with the authenticators (security.js t/<uid>): only t/<ms>~<key> is the trash */
  const isTrash = key => /^t\/\d{10,16}~/.test(key);

  /* ---------- version history: the document as it was before each write ----------
     h/<key without d/>/<ms>~<uid>  holds the replaced version; the key carries when and who, so a listing
     needs no reads. Kept HIST_DAYS days and HIST_MAX versions per document, pruned as each new one lands. */
  const histPrefix = key => 'h/' + key.slice(2) + '/';
  const histMs = k => Number(k.split('/').pop().split('~')[0]) || 0;
  const histBy = k => String(k.split('/').pop().split('~')[1] || '');
  hooks.beforeWrite = async function beforeWrite(key, path, uid, cur) {
    if (String(path || '').split('/')[0] === 'log') return;
    let doc = cur;
    if (doc == null) {
      try { doc = await getJ(key); }
      catch (e) { const s = await raw(key).catch(() => null); doc = s == null ? null : {raw: String(s)}; }
    }
    if (doc == null) return;
    const at = Date.now();
    await putJ(histPrefix(key) + at + '~' + (uid || 'server'), {path, by: uid || '', at, doc});
    /* prune this document's older versions */
    try {
      const keys = (await listAll(histPrefix(key))).map(b => b.key).sort((a, b) => histMs(b) - histMs(a));
      const cutoff = at - HIST_DAYS * 86400000;
      for (let i = 0; i < keys.length; i++) if (i >= HIST_MAX || histMs(keys[i]) < cutoff) await store.delete(keys[i]).catch(() => {});
    } catch (e) { /* pruning waits for the next write */ }
  };

  async function pruneTrash(days) {
    const cutoff = Date.now() - days * 86400000;
    let removed = 0;
    for (const b of await listAll('t/')) {
      if (!isTrash(b.key) || trashMs(b.key) >= cutoff) continue;
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

  /* ---------- the site backup: documents plus identity ---------- */
  /* who is on this site: people with a record, their email index entries, the owner and the password hashes.
     Only the fields a fresh site needs; lockout counters (fails, since, until) stay behind. */
  async function readIdentity() {
    const people = {}, emails = {}, passwords = {};
    await eachChunk(await listAll('p/'), async b => {
      const uid = b.key.slice(2);
      if (!UID_OK.test(uid)) return;
      const p = await getJ(b.key).catch(() => null);
      if (!p) return;
      people[uid] = {name: String(p.name || ''), email: String(p.email || ''), at: Number(p.at) || 0};
    });
    await eachChunk(await listAll('e/'), async b => {
      const e = await getJ(b.key).catch(() => null);
      if (e && e.uid && people[e.uid]) emails[b.key.slice(2)] = {uid: e.uid};
    });
    await eachChunk(await listAll('w/'), async b => {
      const uid = b.key.slice(2);
      if (!people[uid]) return;
      const w = await getJ(b.key).catch(() => null);
      if (w && typeof w.salt === 'string' && typeof w.hash === 'string') passwords[uid] = {salt: w.salt, hash: w.hash, iter: Number(w.iter) || 0, at: Number(w.at) || 0};
    });
    const o = await getJ('o/owner').catch(() => null);
    return {people, emails, owner: o && o.uid && people[o.uid] ? {uid: o.uid} : {}, passwords};
  }
  async function settingsKeys() {
    const [ai, mail] = await Promise.all([getJ('x/ai').catch(() => null), getJ('x/mail').catch(() => null)]);
    return {ai: !!(env && env.ANTHROPIC_API_KEY) || !!(ai && ai.key), mail: !!(env && env.RESEND_API_KEY) || !!(mail && mail.key)};
  }
  /* a fingerprint of every d/ blob and its etag: the same inventory gives the same digest */
  async function siteDigest() {
    const pairs = (await listAll('d/')).map(b => b.key + ':' + normTag(b.etag)).sort();
    const str = pairs.join('|');
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16) + ':' + pairs.length;
  }
  const wrapColls = colls => { const out = {}; for (const c of Object.keys(colls).sort()) out[c] = {docs: colls[c]}; return out; };
  const countColls = colls => { const out = {}; for (const c of Object.keys(colls).sort()) out[c] = Object.keys(colls[c]).length; return out; };
  async function buildSite(colls, bad) {
    const [identity, keys] = await Promise.all([readIdentity(), settingsKeys()]);
    return {app: 'm360', kind: 'site', exported: new Date().toISOString(), colls: wrapColls(colls), identity, settingsKeys: keys, bad: bad || []};
  }
  /* bk/site/latest from a site already built; over the cap it is skipped and bk/site/index says so. Never throws. */
  async function keepSite(site) {
    const index = (await getJ('bk/site/index').catch(() => null)) || {};
    try {
      const str = JSON.stringify(site);
      if (str.length > SITE_CAP) {
        await putJ('bk/site/index', {...index, lastError: {at: Date.now(), message: 'The site backup is over 8 MB (' + str.length + ' bytes), so it was not kept. Download it per collection.'}});
        return false;
      }
      const digest = await siteDigest();
      await store.set('bk/site/latest', str);
      await putJ('bk/site/index', {at: Date.now(), bytes: str.length, digest, lastError: null});
      return true;
    } catch (e) {
      await putJ('bk/site/index', {...index, lastError: {at: Date.now(), message: String((e && e.message) || e).slice(0, 200)}}).catch(() => {});
      return false;
    }
  }
  const writeSiteLatest = async (colls, bad) => keepSite(await buildSite(colls, bad));
  /* the newest site backup: the daily copy when it is under an hour old and no document changed since, else a fresh
     read that also refreshes the copy. Identity and the key flags are always read live, so a rename or a new password
     from the last hour is in. */
  async function currentSite() {
    const index = (await getJ('bk/site/index').catch(() => null)) || {};
    if (index.at && Date.now() - index.at < SITE_FRESH_MS && index.digest && index.digest === (await siteDigest())) {
      const cached = await getJ('bk/site/latest').catch(() => null);
      if (cached && cached.kind === 'site' && isObj(cached.colls)) {
        const [identity, keys] = await Promise.all([readIdentity(), settingsKeys()]);
        return {site: {...cached, identity, settingsKeys: keys}, counts: null};
      }
    }
    const {colls, bad} = await readEverything();
    const site = await buildSite(colls, bad);
    if (!(await keepSite(site))) return {site: null, counts: countColls(colls)};
    return {site, counts: null};
  }

  /* ---------- checking a site backup before a single write ---------- */
  const bad400 = why => new HttpError(400, 'invalid_argument', 'That is not an m360 site backup: ' + why);
  const goodPath = path => { const s = segs(path); return s.length >= 2 && s.length % 2 === 0 && s.every(x => SEG_OK.test(x) && x !== '.' && x !== '..'); };
  /* the backup as the restore will write it, or a 400 naming the first thing wrong */
  function checkSite(backup) {
    if (!isObj(backup)) throw bad400('no backup in the request');
    if (backup.kind !== 'site') throw bad400('kind is not site');
    const colls = isObj(backup.colls) ? backup.colls : {};
    const identity = isObj(backup.identity) ? backup.identity : {};
    const people = isObj(identity.people) ? identity.people : {};
    const emails = isObj(identity.emails) ? identity.emails : {};
    const passwords = isObj(identity.passwords) ? identity.passwords : {};
    const owner = isObj(identity.owner) ? identity.owner : {};
    for (const uid of Object.keys(people)) {
      const p = people[uid];
      if (!UID_OK.test(uid) || !isObj(p) || typeof p.name !== 'string' || typeof p.email !== 'string') throw bad400('a person record is off');
      if (p.email && (!EMAIL_OK.test(p.email) || p.email.length > 120)) throw bad400('a person has an email that does not look right');
    }
    for (const key of Object.keys(emails)) {
      const e = emails[key];
      let plain = '';
      try { plain = decodeURIComponent(key); } catch (x) { throw bad400('an email index key is off'); }
      if (!EMAIL_OK.test(plain) || plain.length > 120 || encodeURIComponent(plain) !== key) throw bad400('an email index key is off');
      if (!isObj(e) || !UID_OK.test(String(e.uid)) || !people[e.uid]) throw bad400('an email points at nobody');
    }
    for (const uid of Object.keys(passwords)) {
      const w = passwords[uid];
      if (!UID_OK.test(uid) || !people[uid]) throw bad400('a password entry belongs to nobody');
      if (!isObj(w) || typeof w.salt !== 'string' || typeof w.hash !== 'string' || !w.salt || !w.hash || w.salt.length > 200 || w.hash.length > 200 || !(Number(w.iter) > 0)) throw bad400('a password entry is off');
    }
    if (Object.keys(owner).length && (!UID_OK.test(String(owner.uid)) || !people[owner.uid])) throw bad400('the owner is nobody on the list');
    const docs = {};
    let count = 0;
    for (const coll of Object.keys(colls)) {
      const c = colls[coll];
      if (!isObj(c) || !isObj(c.docs)) throw bad400('a collection is off');
      for (const id of Object.keys(c.docs)) {
        const path = coll + '/' + id;
        if (!goodPath(path)) throw bad400('a document path is off');
        if (!isObj(c.docs[id])) throw bad400('a document is not an object');
        const str = JSON.stringify(c.docs[id]);
        if (str.length > DOC_MAX) throw bad400('a document is over 256 KiB');
        docs[path] = str;
        count++;
      }
    }
    return {people, emails, passwords, owner, docs, count};
  }

  /* ---------- backups ---------- */
  async function readIndex() {
    const idx = (await getJ('bk/index').catch(() => null)) || {};
    return {...idx, days: Array.isArray(idx.days) ? idx.days.filter(d => YMD.test(d)) : []};
  }
  async function dropDay(ymd) {
    for (const b of await listAll('bk/' + ymd + '/')) await store.delete(b.key).catch(() => {});
  }
  /* ---------- Google Drive: every day kept for good (v48) ----------
     Each day's backup also goes to the owner's Google Drive, one file a day in a folder m360 makes:
       m360 OS backups/m360-backup-<ymd>.json.gz     {app: 'm360', kind: 'day', ymd, at, colls: {name: {docs}}}
     Drive keeps every day for good. This store keeps the newest 7 days for quick restores, and lets an older
     day go only once Drive holds it at the right size. With Drive not connected for writing, nothing here is
     ever let go: the store fills, and the page says so. */
  const DRIVE_FOLDER = 'm360 OS backups';
  const DR = 'https://www.googleapis.com/drive/v3/files';
  const UP = 'https://www.googleapis.com/upload/drive/v3/files';
  const g = h.google || null;
  const doFetch = (...a) => (env.fetch || fetch)(...a);
  let folder = '';
  let driveState = {on: false, at: 0, copied: 0, pending: 0, last: '', error: null};
  let driveBusy = false, driveNext = 0;
  async function driveUid() {
    if (!g || !g.driveWriter) return null;
    const uid = await ownerUid();
    return uid && (await g.driveWriter(uid)) ? uid : null;
  }
  let tokenNow = '';   /* a token handed in by the sign-in itself, while the store is too full to keep it */
  async function gfetch(uid, url, init) {
    const tok = tokenNow || await g.accessToken(uid);
    return doFetch(url, {...(init || {}), headers: {...((init && init.headers) || {}), authorization: 'Bearer ' + tok}});
  }
  async function folderId(uid) {
    if (folder) return folder;
    const qs = "name = '" + DRIVE_FOLDER + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    let r = await gfetch(uid, DR + '?q=' + encodeURIComponent(qs) + '&fields=files(id)&pageSize=1');
    let j = await r.json().catch(() => ({}));
    if (r.ok && j.files && j.files[0] && j.files[0].id) return (folder = j.files[0].id);
    r = await gfetch(uid, DR + '?fields=id', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder'})});
    j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error('Drive would not make the backup folder (' + r.status + ')');
    return (folder = j.id);
  }
  /* the days Drive holds whole: ymd -> {id, size}. A file counts only when its size is the one m360 sent */
  async function driveDays(uid) {
    const fid = await folderId(uid);
    const out = {};
    let page = '';
    do {
      const qs = "'" + fid + "' in parents and trashed = false";
      const r = await gfetch(uid, DR + '?q=' + encodeURIComponent(qs) + '&fields=nextPageToken,files(id,name,size,appProperties)&pageSize=1000' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('Drive would not list the backups (' + r.status + ')');
      for (const f of j.files || []) {
        const m = /^m360-backup-(\d{4}-\d{2}-\d{2})\.json(\.gz)?$/.exec(String(f.name || ''));
        const sent = Number(f.appProperties && f.appProperties.bytes);
        if (m && Number(f.size) > 0 && sent === Number(f.size)) out[m[1]] = {id: f.id, size: Number(f.size)};
      }
      page = j.nextPageToken || '';
    } while (page);
    return out;
  }
  /* what Drive holds, or nothing when Drive is not connected for writing */
  async function onDrive() {
    const uid = await driveUid().catch(() => null);
    if (!uid) return {};
    return driveDays(uid).catch(() => ({}));
  }
  /* one day as the file Drive keeps; a collection that cannot be read stops it, so no part day is ever sent */
  async function dayFile(ymd) {
    const m = await getJ('bk/' + ymd + '/index').catch(() => null);
    if (!m) return null;
    const colls = {};
    for (const coll of Object.keys(isObj(m.colls) ? m.colls : {})) colls[coll] = {docs: await backupColl(ymd, coll)};
    const raw = new TextEncoder().encode(JSON.stringify({app: 'm360', kind: 'day', ymd, at: m.at || 0, colls}));
    let body = raw, gz = false;
    if (typeof CompressionStream === 'function') {
      try { body = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); gz = true; } catch (e) { body = raw; }
    }
    return {body, gz, raw: raw.length};
  }
  async function upload(uid, ymd, f) {
    const fid = await folderId(uid);
    const mime = f.gz ? 'application/gzip' : 'application/json';
    const meta = {name: 'm360-backup-' + ymd + (f.gz ? '.json.gz' : '.json'), parents: [fid], mimeType: mime,
      appProperties: {app: 'm360', ymd, bytes: String(f.body.length), raw: String(f.raw)}};
    const start = await gfetch(uid, UP + '?uploadType=resumable&fields=id,size', {method: 'POST',
      headers: {'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': mime, 'x-upload-content-length': String(f.body.length)}, body: JSON.stringify(meta)});
    const at = start.headers.get('location');
    if (!start.ok || !at) throw new Error('Drive would not take the backup of ' + ymd + ' (' + start.status + ')');
    const r = await doFetch(at, {method: 'PUT', headers: {'content-type': mime}, body: f.body});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id || Number(j.size) !== f.body.length) throw new Error('The backup of ' + ymd + ' did not reach Drive whole (' + r.status + ')');
    return {id: j.id, size: Number(j.size)};
  }
  /* one pass: the oldest day Drive does not hold yet goes up (one a pass, a day is 24 MB to read), then the days
     past the newest 7 that Drive holds are let go here */
  async function drivePass() {
    if (driveBusy || Date.now() < driveNext) return driveState;
    const uid = await driveUid().catch(() => null);
    if (!uid) { driveState = {...driveState, on: false}; return driveState; }
    driveBusy = true;
    try {
      const index = await readIndex();
      const have = await driveDays(uid);
      const todo = index.days.filter(d => !have[d]).sort();
      if (todo.length) {
        const f = await dayFile(todo[0]);
        if (f) { have[todo[0]] = await upload(uid, todo[0], f); driveState.last = todo[0]; }
      }
      const keep = index.days.slice().sort().reverse().slice(0, BACKUP_DAYS);
      const go = index.days.filter(d => keep.indexOf(d) < 0 && have[d]);
      for (const d of go) await dropDay(d);
      if (go.length) {
        const now = await readIndex();
        await putJ('bk/index', {...now, days: now.days.filter(d => go.indexOf(d) < 0)}).catch(() => {});
      }
      const pending = index.days.filter(d => !have[d]).length;
      driveState = {on: true, at: Date.now(), copied: Object.keys(have).length, pending, last: driveState.last, error: null};
      /* more to send: the next request carries on; all sent: look again in half an hour */
      driveNext = pending ? 0 : Date.now() + 30 * 60000;
    } catch (e) {
      driveState = {...driveState, on: true, at: Date.now(), error: String((e && e.message) || e).slice(0, 200)};
      driveNext = Date.now() + 2 * 60000;
    } finally { driveBusy = false; }
    return driveState;
  }
  /* a full store and Google just connected (google.js): with the token from the sign-in, the oldest days past
     the newest 7 go to Drive and, once Drive holds each whole, leave this store. About 20 seconds' worth,
     at least one day: that is the room the token and the next saves need. The Drive pass carries on after */
  hooks.driveRescue = async (token, uid) => {
    if (!token || !uid) return {gone: 0, freed: 0};
    tokenNow = token;
    const t0 = Date.now();
    let freed = 0;
    try {
      const index = await readIndex();
      const keep = index.days.slice().sort().reverse().slice(0, BACKUP_DAYS);
      const old = index.days.filter(d => keep.indexOf(d) < 0).sort();
      const have = await driveDays(uid);
      const gone = [];
      /* days with nothing in them free nothing: keep going until real room is made (2 MB), or 18 seconds pass */
      for (const d of old) {
        if (freed > 2 * 1024 * 1024 || (gone.length && Date.now() - t0 > 18000)) break;
        const m = await getJ('bk/' + d + '/index').catch(() => null);
        if (!have[d]) {
          const f = await dayFile(d);
          if (!f) continue;
          have[d] = await upload(uid, d, f);
        }
        await dropDay(d);
        gone.push(d);
        freed += Number(m && m.bytes) || 0;
      }
      if (gone.length) await putJ('bk/index', {...index, days: index.days.filter(d => gone.indexOf(d) < 0)}).catch(() => {});
      driveState = {on: true, at: Date.now(), copied: Object.keys(have).length, pending: index.days.filter(d => !have[d]).length, last: gone[gone.length - 1] || '', error: null};
      return {gone: gone.length, freed};
    } finally { tokenNow = ''; }
  };

  /* a cached copy of a collection over the size core.js caches now (the Base) is only a copy: it goes, which
     frees room in a full store without touching a document or a backup */
  let cachesTrimmed = false;
  async function trimCaches() {
    if (cachesTrimmed) return;
    cachesTrimmed = true;
    for (const b of await listAll('a/')) {
      const str = await raw(b.key).catch(() => null);
      if (str != null && String(str).length > 2 * 1024 * 1024) await store.delete(b.key).catch(() => {});
    }
  }

  async function runBackup(force) {
    const now = Date.now(), ymd = ymdIST(now);
    const index = await readIndex();
    if (!force && index.days.includes(ymd)) return {ymd, skipped: 'done'};
    /* room first (v48): days past the newest 7 go before anything of today's is written, so a full store frees
       itself; the old order (write, then prune) could never get past the first write. A day goes only when
       Drive holds it */
    const have = await onDrive();
    let days = index.days.filter(d => d !== ymd).sort().reverse();
    const old = days.slice(BACKUP_DAYS - 1).filter(d => have[d]);
    for (const d of old) await dropDay(d);
    days = days.filter(d => old.indexOf(d) < 0);
    if (old.length) await putJ('bk/index', {...index, days}).catch(() => {});
    /* a write that still finds no room lets go of the oldest day Drive holds and tries again */
    const roomy = async (k, val) => {
      for (;;) {
        try { return await putJ(k, val); } catch (e) {
          const spare = days.slice().reverse().find(d => have[d]);
          if (!spare) throw new Error('The store is full and no day can go yet: connect Google Drive in Backups so the old days can move there');
          await dropDay(spare);
          days = days.filter(d => d !== spare);
          await putJ('bk/index', {...index, days}).catch(() => {});
        }
      }
    };
    const lockKey = 'bk/' + ymd + '/lock';
    const held = await getJ(lockKey).catch(() => null);
    if (!force && held && now - (held.at || 0) < LOCK_MS) return {ymd, skipped: 'locked'};
    const me = rand();
    await roomy(lockKey, {at: now, id: me});
    const again = await getJ(lockKey).catch(() => null);
    if (!force && again && again.id !== me) return {ymd, skipped: 'locked'};
    try {
      const {colls, bad, bytes} = await readEverything();
      const counts = {};
      for (const coll of Object.keys(colls).sort()) {
        counts[coll] = Object.keys(colls[coll]).length;
        await roomy(bkKey(ymd, coll), {docs: colls[coll]});
      }
      const manifest = {at: Date.now(), colls: counts, bytes, bad};
      await roomy('bk/' + ymd + '/index', manifest);
      await putJ('bk/index', {...index, days: [ymd].concat(days), last: manifest.at, lastError: null});
      /* the site backup rides on the same read; its own index records a skip when it is over the cap */
      await writeSiteLatest(colls, bad);
      return {ymd, ...manifest};
    } catch (e) {
      /* a day that could not be written whole leaves nothing behind: its parts would only fill the room saves need */
      if (!index.days.includes(ymd)) await dropDay(ymd).catch(() => {});
      throw e;
    } finally {
      await store.delete(lockKey).catch(() => {});
    }
  }

  /* upkeep: at most one look per request. The Drive pass runs first (it frees room), then today's backup once a day */
  let upkeepDay = '', upkeepBusy = false, upkeepNext = 0;
  hooks.upkeep = async function upkeep() {
    const now = Date.now(), ymd = ymdIST(now);
    if (upkeepBusy) return;
    upkeepBusy = true;
    try {
      await trimCaches().catch(() => {});
      await drivePass().catch(() => {});
      if (upkeepDay === ymd || now < upkeepNext) return;
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

  /* ---------- aggregate caches: a/<coll> against the d/ blobs ----------
     A read checks every cached entry's tag against the inventory before serving it, so a cache that
     lags behind a write or a restore never serves the wrong document: it is refreshed on the next read.
     Stale means worse: an entry whose tag matches but whose data differs from the document, or a cache
     blob that cannot be read. Both are rebuilt; lagging caches are rebuilt too, and counted apart. */
  async function checkCaches(inv, colls) {
    const stale = [], lagging = [];
    for (const b of await listAll('a/')) {
      const coll = b.key.slice(2).split('~').join('/');
      const agg = await getJ(b.key).catch(() => null);
      const have = (agg && isObj(agg.docs)) ? agg.docs : null;
      if (!have) { stale.push(coll); continue; }
      const want = inv[coll] || {};
      const real = (colls && colls[coll]) || {};
      const ids = Object.keys(want), got = Object.keys(have);
      const wrong = got.some(id => want[id] && have[id] && have[id].h === want[id] && real[id] !== undefined && JSON.stringify(have[id].d) !== JSON.stringify(real[id]));
      if (wrong) stale.push(coll);
      else if (ids.length !== got.length || ids.some(id => !have[id] || have[id].h !== want[id])) lagging.push(coll);
    }
    return {stale, lagging};
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
    /* every version a document had before each write, newest first */
    async history(v, body) {
      await admin(v);
      const path = String(body.path || '');
      if (!goodPath(path)) throw new HttpError(400, 'invalid_argument', 'bad path');
      await peekOrRefuse(v, path);
      const keys = (await listAll(histPrefix(docKey(path)))).map(b => b.key).sort((a, b) => histMs(b) - histMs(a));
      return {path, versions: keys.map(k => ({id: k.split('/').pop(), at: histMs(k), by: histBy(k) === 'server' ? '' : histBy(k)}))};
    },
    /* one earlier version, in full */
    async version(v, body) {
      await admin(v);
      const path = String(body.path || ''), id = String(body.id || '');
      if (!goodPath(path) || !HIST_ID.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      await peekOrRefuse(v, path);
      const h = await getJ(histPrefix(docKey(path)) + id).catch(() => null);
      if (!h || h.doc == null) throw new HttpError(404, 'invalid_argument', 'That version is gone.');
      return {path, id, at: h.at, by: h.by || '', doc: h.doc};
    },
    /* put an earlier version back: the current one is kept as a version too, so a revert can be undone */
    async revert(v, body) {
      await admin(v);
      const path = String(body.path || ''), id = String(body.id || '');
      if (!goodPath(path) || !HIST_ID.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      await peekOrRefuse(v, path);
      const key = docKey(path);
      const h = await getJ(histPrefix(key) + id).catch(() => null);
      if (!h || h.doc == null) throw new HttpError(404, 'invalid_argument', 'That version is gone.');
      await hooks.beforeWrite(key, path, v.uid, null);
      if (isObj(h.doc) && typeof h.doc.raw === 'string' && Object.keys(h.doc).length === 1) await putDoc(key, h.doc.raw);
      else await putDoc(key, JSON.stringify(h.doc));
      await store.delete('a/' + key.slice(2).split('~').slice(0, -1).join('~')).catch(() => {});
      await log(v.uid, 'revert', path, 'to the version from ' + new Date(h.at || histMs(id)).toISOString());
      return {ok: true, path, at: h.at};
    },
    /* the newest deleted documents, newest first */
    async trash(v) {
      await admin(v);
      const keys = (await listAll('t/')).map(b => b.key).filter(isTrash).sort((a, b) => trashMs(b) - trashMs(a)).slice(0, TRASH_LIST);
      const items = [];
      await eachChunk(keys, async key => {
        const t = await getJ(key).catch(() => null);
        if (t) items.push({id: key.slice(2), path: t.path || key.slice(2).split('~').slice(1).join('/'), by: t.by || '', at: t.at || trashMs(key)});
      });
      const isOwner = v.uid === (await ownerUid());
      return {items: items.filter(it => (isOwner || !privateOf(it.path) || privateOf(it.path) === v.uid) && !hiddenFrom(v, it.path)).sort((a, b) => b.at - a.at)};
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
      if (isObj(t.doc) && typeof t.doc.raw === 'string' && Object.keys(t.doc).length === 1) await putDoc(key, t.doc.raw);
      else await putDoc(key, JSON.stringify(t.doc));
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
      const site = (await getJ('bk/site/index').catch(() => null)) || {};
      return {days, last: index.last || 0, lastError: index.lastError || null, keepDays: BACKUP_DAYS, trashDays: TRASH_DAYS, drive: driveState,
        site: {at: site.at || 0, bytes: site.bytes || 0, lastError: site.lastError || null, cap: SITE_CAP}};
    },

    /* ---------- moving to a new address: the whole site as one JSON, and writing one back ---------- */
    /* the owner's site backup: every document plus identity; over 8 MB it says so and lists the collections,
       so the page fetches them one at a time through snapshotall and the identity through siteidentity */
    async sitebackup(v) {
      await owner(v);
      const {site, counts} = await currentSite();
      if (!site) { await log(v.uid, 'sitebackup', '', 'over the cap, per collection'); return {tooBig: true, limit: SITE_CAP, colls: counts}; }
      await log(v.uid, 'sitebackup', '', Object.keys(site.identity.people).length + ' people, ' + Object.keys(site.colls).length + ' collections');
      return site;
    },
    /* the identity part alone, in the same shape with no documents, for a site over the cap */
    async siteidentity(v) {
      await owner(v);
      const [identity, keys] = await Promise.all([readIdentity(), settingsKeys()]);
      await log(v.uid, 'siteidentity', '', Object.keys(identity.people).length + ' people');
      return {app: 'm360', kind: 'site', exported: new Date().toISOString(), colls: {}, identity, settingsKeys: keys, bad: []};
    },
    /* a site backup written into this store. With no owner yet (a fresh deployment) anyone may, and only what is
       missing is written; on a live site only the owner may, adding what is missing or replacing documents (each
       current copy goes to the trash first) and overwriting people, emails and password hashes. The owner pointer is
       written only when there is none, so a merge never hands the site to someone else. Nothing is written until the
       whole file has been checked. Read caches for the touched collections are dropped; core rebuilds them on the next read. */
    async siterestore(v, body) {
      const ownerNow = await ownerUid();
      if (ownerNow && (!v || v.uid !== ownerNow)) throw new HttpError(403, 'invalid_argument');
      const mode = ownerNow && body.mode === 'replace' ? 'replace' : 'missing';
      if (JSON.stringify(body.backup === undefined ? null : body.backup).length > SITE_BODY_MAX) throw new HttpError(400, 'invalid_argument', 'That backup is over 32 MB. Restore it per collection.');
      const site = checkSite(body.backup);
      const by = (v && v.uid) || (site.owner.uid || '');
      let people = 0, docs = 0, skipped = 0, trashed = 0;
      const exists = async key => (await raw(key).catch(() => null)) != null;
      for (const uid of Object.keys(site.people)) {
        if (mode === 'missing' && await exists('p/' + uid)) { skipped++; continue; }
        await putJ('p/' + uid, site.people[uid]);
        people++;
      }
      for (const key of Object.keys(site.emails)) {
        if (mode === 'missing' && await exists('e/' + key)) continue;
        await putJ('e/' + key, site.emails[key]);
      }
      if (!ownerNow && site.owner.uid) await putJ('o/owner', {uid: site.owner.uid});
      for (const uid of Object.keys(site.passwords)) {
        if (mode === 'missing' && await exists('w/' + uid)) continue;
        await putJ('w/' + uid, site.passwords[uid]);
      }
      const touched = new Set();
      for (const path of Object.keys(site.docs).sort()) {
        const key = docKey(path);
        const cur = await raw(key).catch(() => null);
        if (cur != null) {
          /* the activity log is history the server appends to: a merge adds missing days and never rolls one back */
          if (mode === 'missing' || cur === site.docs[path] || segs(path)[0] === 'log') { skipped++; continue; }
          await hooks.beforeDelete(key, path, by);
          trashed++;
        }
        await putDoc(key, site.docs[path]);
        touched.add(segs(path).slice(0, -1).join('/'));
        docs++;
      }
      for (const coll of touched) await store.delete(aggKey(coll)).catch(() => {});
      const colls = touched.size;
      await log(by, 'restore', '', 'site, ' + mode + (ownerNow ? '' : ', fresh site') + ': ' + people + (people === 1 ? ' person' : ' people') + ', ' + docs + (docs === 1 ? ' document' : ' documents') +
        ' in ' + colls + (colls === 1 ? ' collection' : ' collections') + ', ' + skipped + ' skipped' + (trashed ? ', ' + trashed + ' to the trash' : ''));
      return {mode, people, docs, colls, skipped, trashed, fresh: !ownerNow};
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
        await peekOrRefuse(v, coll + '/x');
        const docs = dropProspects(v, coll, await backupColl(ymd, coll));
        const out = {ymd, coll, docs};
        if (bigness(out) > RESPONSE_CAP) return {ymd, coll, tooBig: true, limit: RESPONSE_CAP, count: Object.keys(docs).length};
        return out;
      }
      const m = await dayManifest(ymd);
      if (!m) throw new HttpError(404, 'invalid_argument', 'no backup on ' + ymd);
      const colls = {};
      for (const coll of Object.keys(await dropPrivate(v, m.colls))) colls[coll] = {docs: dropProspects(v, coll, await backupColl(ymd, coll).catch(() => ({})))};
      const out = {ymd, at: m.at, colls};
      if (bigness(out) > RESPONSE_CAP) return {ymd, at: m.at, tooBig: true, limit: RESPONSE_CAP, colls: m.colls};
      return out;
    },
    /* the founder writes a backed up collection back: only what is missing, or over the top of what is there */
    async restorecoll(v, body) {
      await owner(v);
      const ymd = wantYmd(body.ymd), coll = wantColl(body.coll);
      await peekOrRefuse(v, coll + '/x');
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
        await putDoc(key, JSON.stringify(docs[id]));
        written++;
      }
      await log(v.uid, 'restore', coll, mode + ' from ' + ymd + ': ' + written + ' written, ' + skipped + ' skipped, ' + trashed + ' to the trash');
      return {ymd, coll, mode, written, skipped, trashed};
    },

    /* what is in the store and whether it all reads: counts, newest stamps, unreadable blobs, caches, orphans */
    async integrity(v) {
      await admin(v);
      const {colls, bad} = await readEverything();
      /* the same tags sync uses (markers over the listing), so a cache written from a marker is never called stale */
      let inv = {};
      if (h.inventory) inv = await h.inventory();
      else for (const b of await listAll('d/')) {
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
      const {stale, lagging} = await checkCaches(inv, colls);
      for (const coll of stale.concat(lagging)) await rebuildCache(coll, inv).catch(() => {});
      const people = new Set((await listAll('p/')).map(b => b.key.slice(2)));
      let orphanSessions = 0;
      await eachChunk(await listAll('s/'), async b => { const s = await getJ(b.key).catch(() => null); if (!s || !s.uid || !people.has(s.uid)) orphanSessions++; });
      const index = await readIndex();
      return {docs, colls: out, bad, caches: {stale, lagging, rebuilt: stale.length + lagging.length}, orphans: {sessions: orphanSessions},
        lastBackup: index.last || 0, lastError: index.lastError || null, ok: !bad.length && !stale.length};
    },
    /* everything under d/ as one JSON, or one collection of it when the whole is over 4 MB */
    async snapshotall(v, body) {
      await admin(v);
      const {colls: colls0, bad} = await readEverything();
      const colls = await dropPrivate(v, colls0);
      const at = Date.now();
      if (body.coll) {
        const coll = wantColl(body.coll);
        await peekOrRefuse(v, coll + '/x');
        const docs = dropProspects(v, coll, colls[coll] || {});
        const out = {app: 'm360 OS', exported: new Date(at).toISOString(), coll, docs};
        if (bigness(out) > RESPONSE_CAP) return {coll, tooBig: true, limit: RESPONSE_CAP, count: Object.keys(docs).length};
        return out;
      }
      const wrapped = {};
      const counts = {};
      for (const coll of Object.keys(colls).sort()) { const docs = dropProspects(v, coll, colls[coll]); wrapped[coll] = {docs}; counts[coll] = Object.keys(docs).length; }
      const out = {app: 'm360 OS', exported: new Date(at).toISOString(), colls: wrapped, bad};
      if (bigness(out) > RESPONSE_CAP) return {tooBig: true, limit: RESPONSE_CAP, colls: counts, bad};
      return out;
    }
  };
}
