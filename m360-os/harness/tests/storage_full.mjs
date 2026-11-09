/* A full store and the Google Drive backups (v48). EdgeOne's blob store refuses writes once it holds its 1 GB;
   45 daily backups of a 24 MB workspace filled it. This runs the real server (core.js, safety.js, google.js)
   on an in-memory store with a byte cap and a fake Google Drive, and checks that:
   - with Drive not connected, no backup day is ever let go; a full store frees room from the oversized
     collection cache alone, and saves work again
   - with Drive connected, every day goes up oldest first, one a request, as a gzip the size Drive reports
   - a day here is let go only once Drive holds it whole, and the newest 7 always stay
   - a Drive upload that arrives short lets nothing go
   Run: node harness/tests/storage_full.mjs */
import {createApp} from '../../edgeone/server/core.js';
import {hybridStore, ownKey} from '../../edgeone/server/store-supabase.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

function memStore(cap) {
  const data = new Map();
  const used = () => { let n = 0; for (const [k, v] of data) n += k.length + v.length; return n; };
  return {
    data, used, cap,
    async get(key, opts) { if (!data.has(key)) return null; const v = data.get(key); return opts && opts.type === 'json' ? JSON.parse(v) : v; },
    async set(key, value, opts) {
      const v = String(value);
      if (opts && opts.onlyIfNew && data.has(key)) { const e = new Error('exists'); e.code = 'PRECONDITION_FAILED'; throw e; }
      const old = data.has(key) ? key.length + data.get(key).length : 0;
      /* like the edge store: an empty value always goes in, anything else needs room */
      if (v.length && used() - old + key.length + v.length > this.cap) throw new Error('storage quota exceeded');
      data.set(key, v);
    },
    async delete(key) { data.delete(key); },
    async list(opts) { const p = (opts && opts.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(key => ({key})), directories: []}; }
  };
}

/* a fake Google: the token endpoint, the Drive file list and folder, and resumable uploads */
function fakeGoogle(opts) {
  const files = [];
  const sessions = {};
  let n = 0;
  const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), {status, headers: {'content-type': 'application/json', ...headers}});
  const fetch = async (url, init) => {
    const u = new URL(String(url));
    const method = (init && init.method) || 'GET';
    if (u.host === 'oauth2.googleapis.com') return json({access_token: 'at', refresh_token: 'rt2', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/drive.readonly ' + DRIVE_FILE});
    if (u.host === 'openidconnect.googleapis.com') return json({email: 'owner@example.test'});
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q') || '';
      const m = /'([^']+)' in parents/.exec(q);
      const nm = /name = '([^']+)'/.exec(q);
      let list = m ? files.filter(f => f.parents && f.parents[0] === m[1]) : files.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && !f.parents);
      if (nm) list = list.filter(f => f.name === nm[1]);
      return json({files: list.map(f => ({id: f.id, name: f.name, size: f.size == null ? undefined : String(f.size), appProperties: f.appProperties}))});
    }
    if (u.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(init.body);
      const f = {id: 'f' + (++n), ...meta};
      files.push(f);
      return json({id: f.id});
    }
    if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const id = 's' + (++n);
      sessions[id] = JSON.parse(init.body);
      return new Response('', {status: 200, headers: {location: 'https://www.googleapis.com/upload/session/' + id}});
    }
    if (u.pathname.startsWith('/upload/session/') && method === 'PUT') {
      const meta = sessions[u.pathname.split('/').pop()];
      const body = new Uint8Array(await new Response(init.body).arrayBuffer());
      const size = opts && opts.short ? body.length - 1 : body.length;
      const f = {id: 'f' + (++n), ...meta, size, body};
      files.push(f);
      return json({id: f.id, size: String(size)});
    }
    return json({error: 'unexpected ' + method + ' ' + u.pathname}, 404);
  };
  return {fetch, files};
}

const UID = 'u_owner123456', TOK = 'tok1234567890abc';
const IST = 330 * 60000;
const ymd = ms => new Date(ms + IST).toISOString().slice(0, 10);
const DAY = 86400000;
const BIG = 'x'.repeat(20000);
const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';

function seed(store, days, drive) {
  const now = Date.now();
  const put = (k, v) => store.data.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  put('o/owner', {uid: UID});
  put('p/' + UID, {name: 'Owner', email: 'owner@example.test', at: now});
  put('s/' + TOK, {uid: UID, at: now, last: now});
  put('d/me~' + UID, {name: 'Owner'});
  for (let i = 0; i < 20; i++) put('d/tasks~t' + i, {title: 'Task ' + i, body: BIG.slice(0, 2000)});
  /* the oversized whole-collection cache the Base used to keep */
  put('a/contacts', {docs: {p1: {h: 'x', d: {rows: {r: BIG.repeat(120)}}}}});
  if (drive) {
    put('x/google', {clientId: 'cid', clientSecret: 'secret'});
    put('x/g/' + UID, {refresh: 'rt', access: '', exp: 0, email: 'owner@example.test', scope: 'openid email ' + DRIVE_FILE});
  }
  const list = [];
  for (let i = 1; i <= days; i++) {
    const d = ymd(now - i * DAY);
    list.push(d);
    put('bk/' + d + '/index', {at: now - i * DAY, colls: {tasks: 1}, bytes: 20000, bad: []});
    put('bk/' + d + '/tasks', {docs: {blob: {day: d, body: BIG}}});
  }
  put('bk/index', {days: list, last: now - DAY});
}

async function call(app, a, body) {
  const req = new Request('https://m360.test/api/m360', {method: 'POST', headers: {'content-type': 'application/json', cookie: 'm360s=' + TOK}, body: JSON.stringify({a, ...(body || {})})});
  const r = await app(req);
  let j = {};
  try { j = await r.json(); } catch (e) { /* empty */ }
  return {status: r.status, j};
}
const localDays = store => [...store.data.keys()].filter(k => /^bk\/\d{4}-\d{2}-\d{2}\/index$/.test(k)).map(k => k.slice(3, 13)).sort();
const gunzip = async u8 => new TextDecoder().decode(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());

/* 1: Drive not connected, the store full: no day goes, the oversized cache does, and saves work */
{
  const store = memStore(0);
  seed(store, 45, false);
  store.cap = store.used() + 500;
  check(!(await store.set('probe', 'y'.repeat(2000)).then(() => true, () => false)), 'the seeded store is full (a 2 KB write is refused)');
  const app = createApp({store, env: {}});
  const r = await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'hello'}});
  check(r.status === 200 && !r.j.error, 'without Drive, a save still goes through: ' + JSON.stringify(r).slice(0, 140));
  check(localDays(store).filter(d => d !== ymd(Date.now())).length === 45, 'without Drive, all 45 old days are still here: ' + localDays(store).length);
  check(!store.data.has('a/contacts'), 'the oversized collection cache is gone (it is only a copy)');
}

/* 1b: Drive not connected, full, and a small cache: today's backup cannot fit, leaves no parts behind, and saves work */
{
  const store = memStore(0);
  seed(store, 45, false);
  store.data.set('a/contacts', JSON.stringify({docs: {p1: {h: 'x', d: {rows: {r: BIG.repeat(3)}}}}}));
  store.data.set('d/contacts~p1', JSON.stringify({rows: {r: BIG.repeat(110)}}));
  store.cap = store.used() + 500;
  const app = createApp({store, env: {}});
  await call(app, 'me');
  const today = ymd(Date.now());
  check(![...store.data.keys()].some(k => k.startsWith('bk/' + today + '/')), 'a day that cannot fit leaves no parts behind');
  check(localDays(store).length === 45, 'and every old day is still here: ' + localDays(store).length);
}

/* 2: Drive connected: oldest first, one a request, gzip, the right size; old days go only once on Drive */
{
  const store = memStore(0);
  seed(store, 45, true);
  store.cap = store.used() + 500;
  const gg = fakeGoogle();
  const app = createApp({store, env: {fetch: gg.fetch}});
  const r = await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'hello'}});
  check(r.status === 200, 'with Drive, the first save goes through (' + r.status + ')');
  const up = () => gg.files.filter(f => /^m360-backup-/.test(f.name)).map(f => f.name.slice(12, 22)).sort();
  const oldest = ymd(Date.now() - 45 * DAY);
  check(up()[0] === oldest, 'the oldest day went first: ' + up()[0]);
  for (let i = 0; i < 60; i++) await call(app, 'me');
  const sent = up();
  check(sent.length === 46, 'every day, today included, is on Drive: ' + sent.length);
  const keep = localDays(store);
  check(keep.length === 2 && keep[keep.length - 1] === ymd(Date.now()), 'the newest 2 stay here: ' + keep.join(','));
  check(keep.every(d => sent.includes(d)), 'and those 7 are on Drive too');
  const f = gg.files.find(x => x.name === 'm360-backup-' + oldest + '.json.gz');
  const back = f && JSON.parse(await gunzip(f.body));
  check(!!back && back.kind === 'day' && back.colls.tasks.docs.blob.day === oldest && f.appProperties.bytes === String(f.size), 'a Drive file opens to the whole day, gzip, at the size sent');
  check(gg.files.filter(x => x.mimeType === 'application/vnd.google-apps.folder' && x.name === 'm360 OS backups').length === 1, 'one backup folder');
  const b = await call(app, 'backups');
  check(b.j.drive && b.j.drive.on && b.j.drive.copied === 46 && b.j.drive.pending === 0, 'Backups reports the Drive copy: ' + JSON.stringify(b.j.drive));
}

/* 3: an upload that arrives short lets nothing go */
{
  const store = memStore(1e9);
  seed(store, 10, true);
  const gg = fakeGoogle({short: true});
  const app = createApp({store, env: {fetch: gg.fetch}});
  for (let i = 0; i < 5; i++) await call(app, 'me');
  check(localDays(store).length === 11, 'short uploads: all 10 old days and today stay here: ' + localDays(store).length);
  const b = await call(app, 'backups');
  check(b.j.drive && /did not reach Drive whole/.test(b.j.drive.error || ''), 'and Backups says why: ' + (b.j.drive && b.j.drive.error));
}

/* 4: full store, Google connected read only (before v48): Connect works, and the sign-in itself moves the oldest
   days to Drive to make room for its token; then saves work */
{
  const store = memStore(0);
  seed(store, 45, true);
  store.data.set('x/g/' + UID, JSON.stringify({refresh: 'rt', access: '', exp: 0, email: 'owner@example.test', scope: 'openid email'}));
  store.data.delete('a/contacts');
  /* like live: the four oldest days hold nothing, so moving them frees no room */
  for (let i = 42; i <= 45; i++) { const d = ymd(Date.now() - i * DAY); store.data.set('bk/' + d + '/index', JSON.stringify({at: 0, colls: {}, bytes: 0, bad: []})); store.data.delete('bk/' + d + '/tasks'); }
  store.cap = store.used();
  const gg = fakeGoogle();
  const app = createApp({store, env: {fetch: gg.fetch}});
  const before = await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'x'}});
  check(before.status === 500, 'full and Drive not allowed yet: a save fails (' + before.status + ')');
  const st = await call(app, 'googlestart', {back: '#admin'});
  const state = st.j.url ? new URL(st.j.url).searchParams.get('state') : '';
  check(/^S/.test(state || ''), 'Connect still opens Google, with a signed state: ' + (state || JSON.stringify(st.j)).slice(0, 40));
  const forged = await app.google(new Request('https://m360.test/api/google?code=abc&state=' + encodeURIComponent(state.slice(0, -3) + 'AAA')));
  check(/google=error/.test(forged.headers.get('location') || ''), 'a state with a wrong signature is refused');
  const cb = await app.google(new Request('https://m360.test/api/google?code=abc&state=' + encodeURIComponent(state)));
  check(/google=ok/.test(cb.headers.get('location') || ''), 'the sign-in comes back ok: ' + cb.headers.get('location'));
  const tok = JSON.parse(store.data.get('x/g/' + UID));
  check(String(tok.scope).includes(DRIVE_FILE), 'the token with the backup folder allowed is kept');
  const sent = gg.files.filter(f => /^m360-backup-/.test(f.name)).map(f => f.name.slice(12, 22));
  const here = localDays(store);
  check(sent.length >= 1 && sent.every(d => !here.includes(d) || here.length <= 3), 'the oldest days went to Drive and left here: ' + sent.length + ' sent, ' + here.length + ' here');
  check(here.length + sent.filter(d => !here.includes(d)).length === 45, 'no day is lost: here plus on Drive is all 45');
  const after = await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'saved'}});
  check(after.status === 200, 'and saves work again (' + after.status + ')');
  for (let i = 0; i < 60; i++) await call(app, 'me');
  check(localDays(store).length <= 3 && gg.files.filter(f => /^m360-backup-/.test(f.name)).length >= 45, 'the Drive pass then moves the rest: ' + localDays(store).length + ' here');
}

/* 5: the sign-in returns to the page's own address, never the platform's internal one (v48.2) */
{
  const store = memStore(1e9);
  seed(store, 1, true);
  const app = createApp({store, env: {}});
  const req = new Request('http://pages-pro-20-07f1.pages-scf-sg-pro.qcloudteo.com/api/m360', {method: 'POST',
    headers: {'content-type': 'application/json', cookie: 'm360s=' + TOK, origin: 'https://m360os-wx9u1bqs.edgeone.dev'}, body: JSON.stringify({a: 'googlestart', back: '#admin'})});
  const j = await (await app(req)).json();
  const ru = j.url ? new URL(j.url).searchParams.get('redirect_uri') : '';
  check(ru === 'https://m360os-wx9u1bqs.edgeone.dev/api/google', 'Google is told to come back to the page address: ' + ru);
}

/* 6: the live log: every save is on Drive by the next request, whole, and the queue empties (v49) */
{
  const store = memStore(1e9);
  seed(store, 2, true);
  const gg = fakeGoogle();
  const app = createApp({store, env: {fetch: gg.fetch}});
  await call(app, 'me');
  for (const n of ['one', 'two', 'three']) await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: n}});
  await call(app, 'write', {op: 'delete', path: 'tasks/t3'});
  await call(app, 'me');
  const live = gg.files.filter(f => /^m360-live-/.test(f.name));
  const lines = [];
  for (const f of live) (await gunzip(f.body)).trim().split('\n').forEach(l => lines.push(JSON.parse(l)));
  const notes = lines.filter(l => l.path === 'me/' + UID).map(l => l.doc && l.doc.note);
  check(notes.join(',') === 'one,two,three', 'every save is on Drive, in order, as the whole document: ' + notes.join(','));
  check(lines.some(l => l.op === 'delete' && l.path === 'tasks/t3' && l.doc === null), 'a delete is on Drive too');
  check(![...store.data.keys()].some(k => k.startsWith('jq/')), 'the queue is empty once Drive holds the file');
  const day = gg.files.find(f => f.mimeType === 'application/vnd.google-apps.folder' && /^\d{4}-\d{2}-\d{2}$/.test(f.name));
  const liveF = gg.files.find(f => f.name === 'live');
  check(!!day && !!liveF && day.parents[0] === liveF.id, 'filed under m360 OS backups/live/<day>');
  const b = await call(app, 'backups');
  check(b.j.live && b.j.live.sent >= 4 && b.j.live.waiting === 0 && !b.j.live.error, 'Backups reports the live log: ' + JSON.stringify(b.j.live));
}

/* 6b: Drive not connected: nothing queues */
{
  const store = memStore(1e9);
  seed(store, 1, false);
  const app = createApp({store, env: {}});
  await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'x'}});
  check(![...store.data.keys()].some(k => k.startsWith('jq/')), 'without Drive no change queues');
}

/* 7: two instances on one store send each day once */
{
  const store = memStore(1e9);
  seed(store, 12, true);
  const gg = fakeGoogle();
  const a1 = createApp({store, env: {fetch: gg.fetch}}), a2 = createApp({store, env: {fetch: gg.fetch}});
  for (let i = 0; i < 20; i++) await Promise.all([call(a1, 'me'), call(a2, 'me')]);
  const names = gg.files.filter(f => /^m360-backup-/.test(f.name)).map(f => f.name);
  check(names.length === new Set(names).size && names.length === 13, 'each day went up once: ' + names.length + ' files, ' + new Set(names).size + ' days');
}

/* 8: the move to Supabase (v50): the old store full, the new one roomy. Saves work at once, old data reads
   through, deletes reach both, and migrate copies everything across */
{
  const legacy = memStore(0);
  seed(legacy, 5, false);
  legacy.cap = legacy.used();
  const primary = memStore(1e9);
  const store = hybridStore(primary, legacy);
  const app = createApp({store, env: {}});
  const r = await call(app, 'write', {op: 'merge', path: 'me/' + UID, data: {note: 'moved'}});
  check(r.status === 200 && r.j.doc && r.j.doc.name === 'Owner' && r.j.doc.note === 'moved', 'a save works at once and keeps the old fields: ' + JSON.stringify(r.j).slice(0, 120));
  const t = await call(app, 'write', {op: 'merge', path: 'tasks/t5', data: {title: 'Task 5 edited'}});
  check(t.status === 200 && t.j.doc.body && t.j.doc.title === 'Task 5 edited', 'an old document reads through and saves');
  const d = await call(app, 'write', {op: 'delete', path: 'tasks/t6'});
  check(d.status === 200 && !legacy.data.has('d/tasks~t6') && !primary.data.has('d/tasks~t6'), 'a delete reaches both stores');
  let m = {};
  for (let i = 0; i < 20 && !m.done; i++) m = await store.migrate(5000);
  const left = [...legacy.data.keys()].filter(k => !primary.data.has(k));
  check(m.done && left.length === 0, 'everything is across: ' + left.length + ' left');
  check(JSON.parse(primary.data.get('d/me~' + UID)).note === 'moved', 'the move never overwrites a newer save');
  const before = legacy.data.size;
  legacy.data.set('d/tasks~ghost', '{"title":"ghost"}');
  const g = await store.get('d/tasks~ghost');
  check(g === null && legacy.data.size === before + 1, 'once done, the old store is no longer read');
  const back = await call(app, 'backups');
  check(back.status === 200, 'Backups still answers');
}

/* 9: the server's own key (v50.1): made once as an empty blob, registered while the window is open, the same key
   found again by every later instance, and a stranger's claim refused once it is taken */
{
  const edge = memStore(0);
  edge.cap = edge.used();                       /* full: only empty values go in */
  let kept = null, open = true;
  const fetch = async (url, init) => {
    const h = JSON.parse(init.body).h;
    let ok = false;
    if (kept) ok = kept === h; else if (open && /^[0-9a-f]{64}$/.test(h)) { kept = h; open = false; ok = true; }
    return new Response(JSON.stringify(ok), {status: 200, headers: {'content-type': 'application/json'}});
  };
  const k1 = await ownKey(edge, {url: 'https://db.test', anon: 'pub', fetch});
  check(!!k1 && [...edge.data.keys()].some(k => k === 'ks/m360store~' + k1) && edge.data.get('ks/m360store~' + k1) === '', 'the key is made as an empty blob in a full store, and registered');
  const k2 = await ownKey(edge, {url: 'https://db.test', anon: 'pub', fetch});
  check(k2 === k1 && [...edge.data.keys()].filter(k => k.startsWith('ks/')).length === 1, 'a later instance finds the same key and makes no other');
  const other = memStore(1e9);
  const k3 = await ownKey(other, {url: 'https://db.test', anon: 'pub', fetch});
  check(k3 === '', 'a stranger with its own store is refused once the key is taken');
}

console.log(fails ? 'FAIL ' + fails : 'PASS');
process.exit(fails ? 1 : 0);
