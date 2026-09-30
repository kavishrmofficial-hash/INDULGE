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
import {fakeSpotify} from './fake-spotify.mjs';
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
  gm3: {id: 'gm3', threadId: 'gt3', labelIds: ['CATEGORY_UPDATES'], snippet: 'Vendor registration for Swisse Wellness UAE', internalDate: String(Date.now() - 3 * 86400000),
    payload: {mimeType: 'multipart/mixed', headers: [{name: 'From', value: 'Omar Haddad <ap@swisse.example>'}, {name: 'To', value: 'kaavish@mask360.agency'}, {name: 'Subject', value: 'Swisse Wellness UAE: billing details and PO 4471'}, {name: 'Date', value: new Date(Date.now() - 3 * 86400000).toUTCString()}, {name: 'Message-ID', value: '<po4471@swisse.example>'}],
      parts: [{mimeType: 'text/plain', body: {data: GB64('Hi Kaavish,\n\nPlease invoice Swisse Wellness Middle East FZ LLC, Office 1204, Dubai Science Park, Dubai, United Arab Emirates. TRN 100234567800003. Payment terms 30 days. Invoices go to ap@swisse.example (Omar Haddad, accounts payable). PO 4471 attached.\n\nOmar')}}, {mimeType: 'application/pdf', filename: 'PO-4471.pdf', body: {attachmentId: 'attpo', size: 1200}}]}},
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
    if (m && /\/attachments\//.test(u.pathname)) { return j({size: 1200, data: GB64('%PDF-1.4 fake purchase order 4471 for Swisse Wellness Middle East FZ LLC, TRN 100234567800003')}); }
    if (m && m[2] === 'modify') { const b = JSON.parse(init.body); const msg = GMSGS[m[1]]; if (msg) { msg.labelIds = msg.labelIds.filter(l => !(b.removeLabelIds || []).includes(l)).concat((b.addLabelIds || []).filter(l => !msg.labelIds.includes(l))); } globalThis.__google.modified.push({id: m[1], ...b}); return j({id: m[1], labelIds: msg ? msg.labelIds : []}); }
    if (m) { const msg = GMSGS[m[1]]; return msg ? j(msg) : j({error: {code: 404, message: 'Not Found'}}, 404); }
    const qs = u.searchParams.get('q') || '';
    /* a small reading of Gmail's query language: words outside parentheses must all appear, words inside an
       (a OR b) group need one, from: names the sender, quotes and newer_than are ignored */
    const groups = []; const plain = qs.toLowerCase().replace(/\([^)]*\)/g, g => { groups.push(g.slice(1, -1).split(/\s+or\s+/).map(x => x.replace(/["()]/g, '').trim()).filter(Boolean)); return ' '; });
    const terms = plain.replace(/"/g, '').split(/\s+/).filter(t => t && !/^(in|is|label|newer_than|older_than|has):/.test(t));
    const box = (qs.match(/\b(in|is):([a-z]+)/) || [])[2] || '';
    const ids = Object.keys(GMSGS).filter(id => {
      const m = GMSGS[id];
      if (box === 'inbox' && !m.labelIds.includes('INBOX')) return false;
      if (box === 'unread' && !m.labelIds.includes('UNREAD')) return false;
      if (box === 'starred' && !m.labelIds.includes('STARRED')) return false;
      if (box === 'sent') return false;
      const blob = JSON.stringify(m).toLowerCase();
      const from = ((m.payload.headers.find(h => h.name === 'From') || {}).value || '').toLowerCase();
      return terms.every(t => t.startsWith('from:') ? from.includes(t.slice(5)) : blob.includes(t)) && groups.every(g => g.some(t => blob.includes(t)));
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
/* the DM desk's writer: a bucket from the headline, a message in five beats that passes the copy rules */
function handshakeWrite(prompt) {
  const people = [];
  const re = /PERSON \d+: (.+)\nHEADLINE: (.+)\nCOMPANY: (.+)\nCONNECTION: (\w+)([\s\S]*?)(?=\n\nPERSON |\n\nReply with JSON)/g;
  let m, i = 0;
  while ((m = re.exec(prompt))) {
    const [, name, headline, company, , rest] = m;
    const first = name.split(' ')[0];
    const hasNews = /news:/.test(rest);
    const senior = /SENIOR: ([^(\n]+)/.exec(rest);
    const opener = i % 2 ? 'Good to connect' : 'Thanks for connecting';
    let bucket = /founder|ceo|cmo|cbo|head of|managing director|\bmd\b/i.test(headline) ? 'decision' : /brand manager|social|comms|marketing/i.test(headline) ? 'marketer' : /agency|studio|pr /i.test(headline) ? 'partner' : /talent acquisition|recruit/i.test(headline) ? 'skip' : 'marketer';
    let message = '';
    if (bucket !== 'skip') {
      const hook = hasNews ? 'the Wipro deal puts DERMATOUCH in every chemist by Diwali' : 'your run at ' + company.replace(/\(none\)/, 'the brand') + ' stood out on the headline';
      const ask = bucket === 'decision' ? 'Worth 20 minutes next week?' : bucket === 'marketer' ? 'Up for a quick call this week?' : 'Coffee some time?';
      message = opener + ', ' + first + '. ' + hook.replace(/^./, c => c.toUpperCase()) + ' — that is a lot of shelf to feed with content. ' +
        'Mask360 runs creator and content engines for premium brands across India and UAE, so the feed keeps pace with the distribution. ' +
        (senior ? 'I have reached out to ' + senior[1].trim() + ' on the founder side too. ' : 'DRINK BUBZ and THE WHOLE TRUTH run on the same engine. ') + ask;
    }
    people.push({name, bucket, why: bucket === 'skip' ? 'a recruiter' : 'from the headline', hookKind: hasNews ? 'news' : 'company', hookLine: hasNews ? 'the Wipro deal' : 'their run at ' + company, proof: bucket === 'skip' ? '' : 'FMCG', message, flags: /quaffine/i.test(company) ? ['possible IONIQ investor'] : [], skip: bucket === 'skip' ? 'a recruiter, no fit' : ''});
    i++;
  }
  return {people};
}

async function fakeFetch(url, init) {
  if (String(url).startsWith('https://api.pwnedpasswords.com/range/')) {
    const prefix = String(url).slice(-5).toUpperCase();
    const known = ['password1234', 'Passw0rd2026'].map(p => crypto.createHash('sha1').update(p).digest('hex').toUpperCase());
    const lines = known.filter(h => h.startsWith(prefix)).map(h => h.slice(5) + ':1203');
    return new Response(lines.join('\r\n'), {status: 200, headers: {'content-type': 'text/plain'}});
  }
  const fr = await fakeRadar(String(url), init || {});
  if (fr) return fr;
  const fs = await fakeSpotify(String(url));
  if (fs) return fs;
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
  /* a file (a PDF) on a host that refuses frames: reading mode says it is a file and hands it outside */
  if (/^https?:\/\/files\.example\//.test(String(url))) {
    const hdr = {'content-type': 'application/pdf', 'x-frame-options': 'DENY', 'content-length': '120000'};
    if ((init.method || 'GET').toUpperCase() === 'HEAD') return new Response('', {status: 200, headers: hdr});
    return new Response(new Uint8Array(120000), {status: 200, headers: hdr});
  }
  /* a page far past the cap: reading mode says it is too big */
  if (/^https?:\/\/huge\.example\//.test(String(url))) {
    const hdr = {'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY'};
    if ((init.method || 'GET').toUpperCase() === 'HEAD') return new Response('', {status: 200, headers: hdr});
    return new Response('<!doctype html><html><body>' + 'x'.repeat(3000000) + '</body></html>', {status: 200, headers: hdr});
  }
  /* a site that refuses frames and then never delivers its page: reading mode has to say so */
  if (/^https?:\/\/down\.example\//.test(String(url))) {
    if ((init.method || 'GET').toUpperCase() === 'HEAD') return new Response('', {status: 200, headers: {'content-type': 'text/html', 'x-frame-options': 'DENY'}});
    throw new Error('socket hang up');
  }
  /* a site that refuses frames, with links, for reading mode */
  if (/^https?:\/\/blocked\.example\//.test(String(url))) {
    const u = new URL(String(url));
    const page = u.pathname === '/two' ? '<!doctype html><html><head><title>Page two</title></head><body><h1>Second page</h1><a href="/">Back home</a></body></html>'
      : '<!doctype html><html><head><title>Blocked home</title><meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'"></head><body><h1>Blocked home</h1><p>Only reading mode shows this inside.</p><a href="/two">Go to page two</a> <a href="https://blocked.example/img.png">a picture</a></body></html>';
    return new Response(page, {status: 200, headers: {'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'"}});
  }
  const body = JSON.parse(init.body);
  if (String(url).includes('api.resend.com')) {
    if (!/^Bearer re_/.test(init.headers.authorization || '')) return new Response(JSON.stringify({message: 'bad key'}), {status: 401});
    globalThis.__mails.push({to: body.to, subject: body.subject, text: body.text, html: body.html || ''});
    return new Response(JSON.stringify({id: 'm' + globalThis.__mails.length}), {status: 200, headers: {'content-type': 'application/json'}});
  }
  const last = body.messages[body.messages.length - 1];
  const text = typeof last.content === 'string' ? last.content : (Array.isArray(last.content) ? last.content.filter(c => c.type === 'text').map(c => c.text).join('\n') : '');
  const images = Array.isArray(last.content) ? last.content.filter(c => c.type === 'image').map(c => ({type: c.source && c.source.media_type, bytes: c.source && c.source.data ? c.source.data.length : 0})) : [];
  globalThis.__aiReqs = (globalThis.__aiReqs || []).concat([{model: body.model, fallbacks: body.fallbacks || null, beta: (init.headers || {})['anthropic-beta'] || '', effort: body.output_config ? body.output_config.effort : null, tools: (body.tools || []).map(t => t.name), images, system: String(body.system || '').slice(0, 40), max_tokens: body.max_tokens}]).slice(-40);
  const toolNames = (body.tools || []).map(t => t.name);
  const said = text.split('THEY SAID: ').pop();   /* the question itself, not the chat carried in the prompt */
  let content;
  if (/^BOOKS MINE/.test(body.system || '')) content = [{type: 'text', text: JSON.stringify({legalName: 'Swisse Wellness Middle East FZ LLC', address: 'Office 1204, Dubai Science Park\nDubai', country: 'United Arab Emirates', taxId: '100234567800003', contactName: 'Omar Haddad', contactEmail: 'ap@swisse.example', currency: 'AED', termsDays: 30, po: '4471', note: 'From the vendor registration mail and PO 4471.'})}];
  else if (/^BOOKS STATEMENT/.test(body.system || '')) content = [{type: 'text', text: JSON.stringify({rows: [{date: '2026-09-03', vendor: 'Adobe', desc: 'POS ADOBE SYSTEMS', amount: 4999, credit: 0, method: 'card', ref: 'P1'}, {date: '2026-09-05', vendor: 'Titan Company', desc: 'NEFT CR TITAN COMPANY LTD', amount: 0, credit: 295000, method: 'bank', ref: 'N2'}, {date: '2026-09-09', vendor: 'Uber', desc: 'UPI/UBER INDIA/9091', amount: 640, credit: 0, method: 'upi', ref: 'U3'}]})}];
  else if (/^BOOKS CATEGORIES/.test(body.system || '')) { const n = ((text.match(/^\d+\. /gm) || []).length) || 1; content = [{type: 'text', text: JSON.stringify({categories: Array.from({length: n}, (_, i) => /uber|ola|indigo/i.test((text.split('\n')[i + 1] || '')) ? 'Travel' : /adobe|figma|notion/i.test((text.split('\n')[i + 1] || '')) ? 'Software and tools' : 'Other')})}]; }
  else if (Array.isArray(last.content) && last.content.some(c => c.type === 'tool_result')) {
    /* the round after a tool: read what came back and say it */
    const res = last.content.filter(c => c.type === 'tool_result').map(c => String(c.content || '')).join('\n');
    const i = res.indexOf('CALENDAR');
    content = [{type: 'text', text: i >= 0 ? 'Your calendar: ' + res.slice(i, i + 300).replace(/\\n/g, ' ') : 'Done. I took care of it.'}];
  }
  else if (/^HANDSHAKE READ/.test(said)) content = [{type: 'text', text: JSON.stringify({people: [
    {name: 'Priya Mehta', headline: 'Brand Manager at DERMATOUCH', company: 'Dermatouch', status: '1st'},
    {name: 'Arjun Rao', headline: 'Founder & CEO, Dermatouch', company: 'Dermatouch', status: '1st'},
    {name: 'Neha Kapoor', headline: 'Talent Acquisition Partner', company: 'Hirewell', status: '1st'},
    {name: 'Rohit Shah', headline: 'Head of Marketing, QUAFFINE', company: 'Quaffine', status: 'pending'}]})}];
  else if (/^HANDSHAKE WRITE/.test(said)) content = [{type: 'text', text: JSON.stringify(handshakeWrite(said))}];
  else if (images.length) content = [{type: 'text', text: 'I see ' + images.length + (images.length === 1 ? ' image' : ' images') + ', ' + images.map(i => i.type).join(', ') + '. Looks like a screenshot of a task list.'}];
  else if (toolNames.includes('act') && /remember that (.+)/i.test(said)) content = [{type: 'tool_use', id: 'tu_rem', name: 'act', input: {action: 'remember', input: {fact: /remember that (.+)/i.exec(said)[1].replace(/[.?!]$/, '')}}}];
  else if (toolNames.includes('act') && /post (?:to the feed|on vibe)[:\s]+(.+)/i.test(said)) content = [{type: 'tool_use', id: 'tu_post', name: 'act', input: {action: 'post_to_feed', input: {kind: 'update', text: /post (?:to the feed|on vibe)[:\s]+(.+)/i.exec(said)[1]}}}];
  else if (toolNames.includes('act') && /check me in/i.test(said)) content = [{type: 'tool_use', id: 'tu_ci', name: 'act', input: {action: 'check_in', input: {mode: 'office'}}}];
  else if (toolNames.includes('look_up') && /calendar/i.test(said)) content = [{type: 'tool_use', id: 'tu_cal', name: 'look_up', input: {what: 'calendar', q: '7'}}];
  else if (toolNames.includes('act') && /add a task/i.test(said)) content = [{type: 'tool_use', id: 'tu1', name: 'act', input: {action: 'create_task', input: {title: 'Cut the teaser', owner: 'me'}}}];
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
  else if (body.tools && body.tools.some(t => t.name === 'create_task') && /add a task/i.test(said))
    content = [{type: 'tool_use', id: 'tu1', name: 'create_task', input: {title: 'Cut the teaser', owner: 'me'}}];
  else content = [{type: 'text', text: 'Here is your day: finish the hero reel script first.'}];
  const stop = content.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn';
  globalThis.__aiCalls = (globalThis.__aiCalls || 0) + 1;
  return new Response(JSON.stringify({content, stop_reason: stop}), {status: 200, headers: {'content-type': 'application/json'}});
}

const env = {...process.env};
if (process.env.MOCK_AI === '1') { env.ANTHROPIC_API_KEY = 'sk-ant-local-test-key-000000000000'; env.fetch = fakeFetch; }
const CFG_HEADERS = (() => { try { return JSON.parse(fs.readFileSync(path.join(PUB, '..', 'edgeone.json'), 'utf8')).headers || []; } catch (e) { return []; } })();
const app = createApp({store, env});
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/file' || url.pathname === '/api/browse') {
    const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {method: req.method, headers: req.headers});
    const out = await (url.pathname === '/api/file' ? app.file(request) : app.browse(request));
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (url.pathname === '/__spotify') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(globalThis.__spotifyChecks || [])); return; }
  if (url.pathname === '/__ai') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(globalThis.__aiReqs || [])); return; }
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
  /* the same headers the platform answers with (edgeone.json), so the browser under test enforces the site's CSP */
  const hdrs = {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'};
  for (const h of CFG_HEADERS) if (h.source === url.pathname || (h.source === '/*' && url.pathname !== '/') || (h.source === '/' && rel === 'index.html')) for (const x of h.headers || []) hdrs[x.key.toLowerCase()] = x.value;
  /* the tests stand in for outside sites with local http pages; the live policy allows them over https only */
  if (hdrs['content-security-policy']) hdrs['content-security-policy'] = hdrs['content-security-policy'].replace(/(frame-src|img-src|media-src|connect-src)([^;]*)/g, '$1$2 http://localhost:* http://127.0.0.1:*');
  res.writeHead(200, hdrs);
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('m360 local edge on http://localhost:' + port));
