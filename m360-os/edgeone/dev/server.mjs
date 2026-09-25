/* Local stand-in for EdgeOne Pages: serves public/ and runs the same API function code against a
   file-backed blob store (etags are content MD5s, like the real store). Dev and tests only.
   node dev/server.mjs [port] [storeFile]   env MOCK_AI=1 answers AI calls locally. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/core.js';
import {fakeRadar} from './fake-radar.mjs';
import {fakePeek} from './fake-peek.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(here, '..', 'public');
const port = Number(process.argv[2] || 8788);
const file = process.argv[3] || path.join(here, '.store.json');

let data = {};
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = {}; }
const views = [];   /* listing snapshots, for LIST_LAG_MS */
const save = () => { fs.writeFileSync(file, JSON.stringify(data)); if (process.env.LIST_LAG_MS) { views.push({at: Date.now(), data: {...data}}); if (views.length > 400) views.shift(); } };
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const store = {
  async get(key, opts) {
    if (!(key in data)) return null;
    return opts && opts.type === 'json' ? JSON.parse(data[key]) : data[key];
  },
  async set(key, value) { data[key] = String(value); save(); },
  async delete(key) { delete data[key]; save(); },
  async list(opts) {
    const p = (opts && opts.prefix) || '';
    /* LIST_LAG_MS: the listing answers from a copy that old, the way an edge listing can lag a write */
    const lag = Number(process.env.LIST_LAG_MS) || 0;
    let view = data;
    /* only document blobs lag (the way a busy prefix does); markers and the rest list fresh */
    if (lag && p.startsWith('d/')) {
      const cut = Date.now() - lag;
      const snap = views.filter(x => x.at <= cut).pop();
      view = snap ? snap.data : {};
    }
    return {blobs: Object.keys(view).filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '&quot;' + md5(view[k]) + '&quot;'})), directories: []};
  }
};

/* a canned Google: one account, a small inbox, a calendar with one meeting, a drive with two files */
globalThis.__google = {sent: [], created: [], modified: [], refreshed: 0, tokens: 0};
const GB64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const GMSGS = {
  gm1: {id: 'gm1', threadId: 'gt1', labelIds: ['UNREAD', 'INBOX'], snippet: 'Can we lock the shoot dates for next week?', internalDate: String(Date.now() - 3600000),
    payload: {mimeType: 'multipart/alternative', headers: [{name: 'From', value: 'Priya Nair <priya@swisse.example>'}, {name: 'To', value: 'kaavish@mask360.agency'}, {name: 'Subject', value: 'Shoot dates'}, {name: 'Date', value: new Date(Date.now() - 3600000).toUTCString()}, {name: 'Message-ID', value: '<abc123@swisse.example>'}],
      parts: [{mimeType: 'text/plain', body: {data: GB64('Hi Kaavish,\n\nCan we lock the shoot dates for next week?\n\nPriya')}}, {mimeType: 'text/html', body: {data: GB64('<p>Hi Kaavish,</p><p>Can we lock the shoot dates for next week?</p><p>Priya</p>')}}]}},
  gm2: {id: 'gm2', threadId: 'gt2', labelIds: ['INBOX'], snippet: 'Invoice 118 attached', internalDate: String(Date.now() - 86400000),
    payload: {mimeType: 'multipart/mixed', headers: [{name: 'From', value: 'accounts@marina.example'}, {name: 'To', value: 'kaavish@mask360.agency'}, {name: 'Subject', value: 'Invoice 118'}, {name: 'Date', value: new Date(Date.now() - 86400000).toUTCString()}, {name: 'Message-ID', value: '<inv118@marina.example>'}],
      parts: [{mimeType: 'text/plain', body: {data: GB64('Invoice 118 attached.')}}, {mimeType: 'application/pdf', filename: 'invoice-118.pdf', body: {attachmentId: 'att1', size: 48213}}]}}
};
async function fakeGoogle(url, init) {
  const j = (obj, status) => new Response(JSON.stringify(obj), {status: status || 200, headers: {'content-type': 'application/json'}});
  if (url.includes('oauth2.googleapis.com/token')) {
    const p = new URLSearchParams(String(init.body || ''));
    if (p.get('client_id') !== '1234567890-abcdefg.apps.googleusercontent.com' || p.get('client_secret') !== 'GOCSPX-test-secret') return j({error: 'invalid_client'}, 401);
    if (p.get('grant_type') === 'authorization_code') {
      if (p.get('code') !== 'fake-code-ok') return j({error: 'invalid_grant'}, 400);
      globalThis.__google.tokens++;
      return j({access_token: 'at_' + globalThis.__google.tokens, refresh_token: 'rt_good', expires_in: 3599, id_token: 'idt', scope: 'openid email'});
    }
    if (p.get('refresh_token') !== 'rt_good') return j({error: 'invalid_grant'}, 400);
    globalThis.__google.refreshed++;
    return j({access_token: 'at_r' + globalThis.__google.refreshed, expires_in: 3599});
  }
  if (url.includes('oauth2.googleapis.com/revoke')) return new Response('', {status: 200});
  if (!/googleapis\.com/.test(url)) return null;
  const auth = (init.headers || {}).authorization || '';
  if (!/^Bearer at_/.test(auth)) return j({error: {code: 401, message: 'Invalid Credentials'}}, 401);
  if (url.includes('openidconnect.googleapis.com/v1/userinfo')) return j({email: 'kaavish@mask360.agency', name: 'Kaavish Ramchandani'});
  const u = new URL(url);
  if (url.includes('gmail.googleapis.com')) {
    const m = /\/messages\/([^/?]+)(?:\/(modify))?/.exec(u.pathname);
    if (u.pathname.endsWith('/messages/send')) { const b = JSON.parse(init.body); globalThis.__google.sent.push({raw: Buffer.from(b.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'), threadId: b.threadId || ''}); return j({id: 'sent' + globalThis.__google.sent.length, threadId: b.threadId || 'gtn'}); }
    if (m && m[2] === 'modify') { const b = JSON.parse(init.body); const msg = GMSGS[m[1]]; if (msg) { msg.labelIds = msg.labelIds.filter(l => !(b.removeLabelIds || []).includes(l)).concat((b.addLabelIds || []).filter(l => !msg.labelIds.includes(l))); } globalThis.__google.modified.push({id: m[1], ...b}); return j({id: m[1], labelIds: msg ? msg.labelIds : []}); }
    if (m) { const msg = GMSGS[m[1]]; return msg ? j(msg) : j({error: {code: 404, message: 'Not Found'}}, 404); }
    const qs = u.searchParams.get('q') || '';
    const terms = qs.toLowerCase().split(/\s+/).filter(t => t && !/^(in|is|label):/.test(t));
    const box = (qs.match(/\b(in|is):([a-z]+)/) || [])[2] || 'inbox';
    const ids = Object.keys(GMSGS).filter(id => {
      const m = GMSGS[id];
      if (box === 'unread' && !m.labelIds.includes('UNREAD')) return false;
      if (box === 'starred' && !m.labelIds.includes('STARRED')) return false;
      if (box === 'sent') return false;
      return terms.every(t => JSON.stringify(m).toLowerCase().includes(t));
    });
    return j({messages: ids.map(id => ({id, threadId: GMSGS[id].threadId})), resultSizeEstimate: ids.length});
  }
  if (url.includes('/calendar/v3/')) {
    if (init.method === 'POST') { const b = JSON.parse(init.body); globalThis.__google.created.push(b); return j({id: 'ev_new', htmlLink: 'https://calendar.google.com/event?eid=new', hangoutLink: b.conferenceData ? 'https://meet.google.com/new-meet-xyz' : '', summary: b.summary}); }
    if (init.method === 'PATCH') { return j({id: 'e1'}); }
    if (/\/events\/e1$/.test(u.pathname)) return j({id: 'e1', attendees: [{email: 'kaavish@mask360.agency', self: true, responseStatus: 'needsAction'}]});
    const in2h = new Date(Date.now() + 7200000), in3h = new Date(Date.now() + 10800000);
    return j({items: [{id: 'e1', summary: 'Swisse creative review', status: 'confirmed', start: {dateTime: in2h.toISOString()}, end: {dateTime: in3h.toISOString()}, hangoutLink: 'https://meet.google.com/abc-defg-hij', htmlLink: 'https://calendar.google.com/event?eid=e1', organizer: {email: 'priya@swisse.example', displayName: 'Priya Nair'}, attendees: [{email: 'kaavish@mask360.agency', self: true, responseStatus: 'needsAction'}, {email: 'priya@swisse.example', responseStatus: 'accepted'}]}]});
  }
  if (url.includes('/drive/v3/files')) return j({files: [{id: 'f1', name: 'Swisse Q4 deck.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', modifiedTime: new Date().toISOString(), webViewLink: 'https://docs.google.com/presentation/d/f1', owners: [{displayName: 'Kaavish'}]}, {id: 'f2', name: 'Rate card 2026', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: new Date(Date.now() - 86400000).toISOString(), webViewLink: 'https://docs.google.com/spreadsheets/d/f2', owners: [{displayName: 'Durvesh'}]}]});
  return null;
}

/* a canned model: plain answers, JSON when asked, and one tool call when a tool fits */
globalThis.__mails = [];
async function fakeFetch(url, init) {
  const fr = await fakeRadar(String(url), init || {});
  if (fr) return fr;
  const fp = await fakePeek(String(url), init || {});
  if (fp) return fp;
  if (String(url).includes('api.elevenlabs.io')) {
    const key = (init.headers || {})['xi-api-key'] || '';
    if (!/^el_/.test(key)) return new Response(JSON.stringify({detail: 'bad key'}), {status: 401});
    if (String(url).endsWith('/v1/voices')) return new Response(JSON.stringify({voices: [{voice_id: 'v_rachel_001', name: 'Rachel', labels: {gender: 'female'}}, {voice_id: 'v_george_002', name: 'George', labels: {gender: 'male'}}]}), {status: 200, headers: {'content-type': 'application/json'}});
    globalThis.__tts = (globalThis.__tts || 0) + 1;
    return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x64]), {status: 200, headers: {'content-type': 'audio/mpeg'}});
  }
  const g = await fakeGoogle(String(url), init || {});
  if (g) return g;
  const body = JSON.parse(init.body);
  if (String(url).includes('api.resend.com')) {
    if (!/^Bearer re_/.test(init.headers.authorization || '')) return new Response(JSON.stringify({message: 'bad key'}), {status: 401});
    globalThis.__mails.push({to: body.to, subject: body.subject, text: body.text, html: body.html || ''});
    return new Response(JSON.stringify({id: 'm' + globalThis.__mails.length}), {status: 200, headers: {'content-type': 'application/json'}});
  }
  const last = body.messages[body.messages.length - 1];
  const text = typeof last.content === 'string' ? last.content : '';
  let content;
  if (Array.isArray(last.content)) content = [{type: 'text', text: 'Done. I took care of it.'}];
  else if (/company brain/i.test(text) && /Reply with JSON only/.test(text)) {
    /* the client brain: what the fake model "read" on the site decides the about line, so a test can tell site text from guesswork */
    const site = /SITE TEXT \(read from/.test(text);
    const brain = {
      about: site && /collagen/i.test(text) ? 'Swisse sells collagen, vitamins and wellness supplements in the UAE.' : 'Not on the site. A wellness brand, from the name.',
      offers: site ? 'Marine collagen, multivitamins and beauty supplements, sold through pharmacies and its own store.' : 'Not on the site.',
      audience: site ? 'Women 25 to 45 who care about skin, sleep and energy.' : 'Not on the site.',
      voice: 'Warm, upbeat, plain words.', competitors: 'Not on the site.', moves: site ? 'Free delivery over AED 150.' : 'Not on the site.',
      talking: 'Pharmacies, clinics and creators in the UAE.', risks: 'Never claim results.', pitchNext: 'A creator led morning ritual series.'
    };
    content = [{type: 'text', text: JSON.stringify(brain)}];
  }
  else if (/Reply with JSON only/.test(text)) content = [{type: 'text', text: '{"summary":"All calm today.","items":[]}'}];
  else if (body.tools && body.tools.some(t => t.name === 'create_task') && /add a task/i.test(text))
    content = [{type: 'tool_use', id: 'tu1', name: 'create_task', input: {title: 'Cut the teaser', owner: 'me'}}];
  else content = [{type: 'text', text: 'Here is your day: finish the hero reel script first.'}];
  const stop = content.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn';
  globalThis.__aiCalls = (globalThis.__aiCalls || 0) + 1;
  return new Response(JSON.stringify({content, stop_reason: stop}), {status: 200, headers: {'content-type': 'application/json'}});
}

const env = {...process.env};
if (process.env.MOCK_AI === '1') { env.ANTHROPIC_API_KEY = 'sk-ant-local-test-key-000000000000'; env.fetch = fakeFetch; }
const app = createApp({store, env});
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/google') {
    const request = new Request(url, {method: req.method, headers: req.headers});
    const out = await app.google(request);
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (url.pathname === '/api/m360') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined});
    const out = await app(request);
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (url.pathname === '/__reset') { data = {}; save(); res.end('ok'); return; }
  if (url.pathname === '/__google') {
    /* tests: what the canned Google saw; ?expire=1 ages every stored access token so the next call must refresh */
    if (url.searchParams.get('expire')) { for (const k of Object.keys(data)) if (k.startsWith('x/g/')) { const t = JSON.parse(data[k]); t.exp = 0; data[k] = JSON.stringify(t); } save(); }
    res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(globalThis.__google)); return;
  }
  if (url.pathname === '/__mails') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(globalThis.__mails)); return; }
  if (url.pathname === '/__store') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(data)); return; }
  /* tests only: overwrite one blob with text that is not JSON, the way a half-written blob would look */
  if (url.pathname === '/__corrupt') { const k = url.searchParams.get('key') || ''; if (k) { data[k] = '{"broken": tru'; save(); } res.end(k ? 'ok' : 'key?'); return; }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const f = path.join(PUB, path.normalize(rel));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('m360 local edge on http://localhost:' + port));
