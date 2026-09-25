/* module: google. Google Workspace for each person on m360: one Google sign-in (the OAuth code flow), then
   mail, calendar, meetings and drive come through this server with that person's own tokens.
     x/google        {clientId, clientSecret, at, by}   the OAuth client Kaavish makes in Google Cloud
     x/g/<uid>       {refresh, access, exp, email, at}  one person's tokens, never sent to a page
     c/g/<nonce>     {uid, until, back}                 a sign-in in flight, ten minutes
   The callback (GET /api/google?code&state) lands in googleCallback below. */

const SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];
const STATE_MS = 10 * 60000;
const TZ = 'Asia/Kolkata';
const MAX_LIST = 40;

const form = obj => Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
const q = obj => Object.keys(obj).filter(k => obj[k] != null && obj[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');

/* base64url both ways, over utf-8, without Node's Buffer (the edge runtime has none) */
function b64urlDecode(s) {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '==='.slice(0, (4 - b.length % 4) % 4);
  let bin = '';
  try { bin = atob(pad); } catch (e) { return ''; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try { return new TextDecoder('utf-8').decode(bytes); } catch (e) { return bin; }
}
function b64Encode(str) {
  const bytes = new TextEncoder().encode(String(str || ''));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64url = str => b64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const header = (msg, name) => { const hs = (msg && msg.payload && msg.payload.headers) || []; const h = hs.find(x => String(x.name).toLowerCase() === name.toLowerCase()); return h ? String(h.value) : ''; };
const addressOf = from => { const m = /<([^>]+)>/.exec(String(from || '')); return (m ? m[1] : String(from || '')).trim(); };
const nameOf = from => { const s = String(from || ''); const m = /^\s*"?([^"<]*?)"?\s*</.exec(s); return (m ? m[1] : s.replace(/<[^>]*>/, '')).trim(); };

/* text and html bodies out of a message's part tree */
function bodies(payload) {
  let text = '', htmlBody = '';
  const walk = p => {
    if (!p) return;
    const mime = String(p.mimeType || '');
    const data = p.body && p.body.data ? b64urlDecode(p.body.data) : '';
    if (mime === 'text/plain' && data && !text) text = data;
    else if (mime === 'text/html' && data && !htmlBody) htmlBody = data;
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  if (!text && htmlBody) text = htmlBody.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  return {text, html: htmlBody};
}

/* one message, the way a page lists it */
const summary = m => ({
  id: m.id, threadId: m.threadId, snippet: String(m.snippet || ''),
  from: header(m, 'From'), fromName: nameOf(header(m, 'From')), fromAddress: addressOf(header(m, 'From')),
  to: header(m, 'To'), subject: header(m, 'Subject') || '(no subject)', date: header(m, 'Date'),
  at: Number(m.internalDate) || 0, messageId: header(m, 'Message-ID'),
  unread: (m.labelIds || []).includes('UNREAD'), starred: (m.labelIds || []).includes('STARRED'),
  inbox: (m.labelIds || []).includes('INBOX'), labels: m.labelIds || []
});

/* an RFC 822 message, base64url, for the send endpoint */
function mime({from, to, cc, subject, text, inReplyTo}) {
  const lines = [];
  if (from) lines.push('From: ' + from);
  lines.push('To: ' + to);
  if (cc) lines.push('Cc: ' + cc);
  lines.push('Subject: =?UTF-8?B?' + b64Encode(subject || '') + '?=');
  if (inReplyTo) { lines.push('In-Reply-To: ' + inReplyTo); lines.push('References: ' + inReplyTo); }
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(b64Encode(text || ''));
  return b64url(lines.join('\r\n'));
}

export function googleActions(h) {
  const {store, env, getJ, putJ, levelOf, LEVEL, HttpError, log, rand} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);
  const tokKey = uid => 'x/g/' + uid;

  async function conf() {
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return {clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, fromEnv: true};
    const x = await getJ('x/google').catch(() => null);
    return x && x.clientId && x.clientSecret ? x : null;
  }
  const need = async (v, level) => { if (!v) throw new HttpError(401, 'noid'); const l = await levelOf(v.uid); if (l < level) throw new HttpError(403, 'invalid_argument'); return l; };
  const redirectFor = req => String((req && req.site) || '') + '/api/google';

  /* a fresh access token for this person; refreshes through the refresh token when needed */
  async function accessToken(uid) {
    const t = await getJ(tokKey(uid)).catch(() => null);
    if (!t || !t.refresh) throw new HttpError(403, 'google_off', 'Connect Google first.');
    if (t.access && Number(t.exp) > Date.now() + 60000) return t.access;
    const c = await conf();
    if (!c) throw new HttpError(403, 'google_off', 'Google is not set up.');
    const r = await doFetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: form({client_id: c.clientId, client_secret: c.clientSecret, refresh_token: t.refresh, grant_type: 'refresh_token'})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      if (j && j.error === 'invalid_grant') await store.delete(tokKey(uid)).catch(() => {});
      throw new HttpError(403, 'google_off', 'Google needs you to connect again.');
    }
    await putJ(tokKey(uid), {...t, access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000});
    return j.access_token;
  }

  /* one Google API call as this person */
  async function gapi(uid, url, init) {
    const tok = await accessToken(uid);
    const r = await doFetch(url, {...(init || {}), headers: {...((init || {}).headers || {}), authorization: 'Bearer ' + tok}});
    const text = await r.text();
    let j = {};
    try { j = text ? JSON.parse(text) : {}; } catch (e) { j = {raw: text}; }
    if (!r.ok) {
      if (r.status === 401) { const t = await getJ(tokKey(uid)).catch(() => null); if (t) await putJ(tokKey(uid), {...t, access: '', exp: 0}); }
      const msg = (j && j.error && (j.error.message || j.error)) || ('Google answered ' + r.status);
      throw new HttpError(r.status === 401 || r.status === 403 ? 403 : 502, r.status === 401 ? 'google_off' : 'google_error', String(msg).slice(0, 200));
    }
    return j;
  }

  const GM = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const CAL = 'https://www.googleapis.com/calendar/v3';
  const DRIVE = 'https://www.googleapis.com/drive/v3';

  async function messagesById(uid, ids, fmt) {
    const out = [];
    /* a few at a time, so a fat inbox never fans out into forty calls at once */
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = await Promise.all(ids.slice(i, i + 8).map(id => gapi(uid, GM + '/messages/' + encodeURIComponent(id) + '?' + q({format: fmt || 'metadata', metadataHeaders: fmt ? undefined : 'From'}) +
        (fmt ? '' : '&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To&metadataHeaders=Message-ID')).catch(() => null)));
      chunk.forEach(m => { if (m) out.push(m); });
    }
    return out;
  }

  const actions = {
    /* is Google set up, and is this person connected? */
    async googlestatus(v, body, req) {
      if (!v) throw new HttpError(401, 'noid');
      const c = await conf();
      const t = await getJ(tokKey(v.uid)).catch(() => null);
      const level = await levelOf(v.uid);
      return {configured: !!c, connected: !!(t && t.refresh), who: (t && t.email) || '', redirect: redirectFor(req),
        clientId: level >= LEVEL.admin && c && !c.fromEnv ? c.clientId : '', fromEnv: !!(c && c.fromEnv)};
    },
    /* the admin stores the OAuth client; an empty id removes it */
    async googlekey(v, body) {
      await need(v, LEVEL.admin);
      const clientId = String(body.clientId || '').trim(), clientSecret = String(body.clientKey || body.clientSecret || '').trim();
      if (!clientId) { await store.delete('x/google').catch(() => {}); await log(v.uid, 'googlekey', '', 'removed'); return {configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}; }
      if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(clientId)) throw new HttpError(400, 'invalid_argument', 'That does not look like a Google client ID. It ends in .apps.googleusercontent.com');
      const cur = await getJ('x/google').catch(() => null);
      const secret = clientSecret || (cur && cur.clientSecret) || '';
      if (!secret) throw new HttpError(400, 'invalid_argument', 'Paste the client secret too.');
      await putJ('x/google', {clientId, clientSecret: secret, at: Date.now(), by: v.uid});
      await log(v.uid, 'googlekey', '', 'set');
      return {configured: true};
    },
    /* where to send this person to sign in with Google */
    async googlestart(v, body, req) {
      await need(v, LEVEL.interact);
      const c = await conf();
      if (!c) throw new HttpError(400, 'google_off', 'Google is not set up yet. Kaavish adds the client in Admin.');
      const nonce = rand(32).replace(/[^a-z0-9]/gi, '').slice(0, 32);
      const back = /^#[a-z0-9/_-]*$/i.test(String(body.back || '')) ? String(body.back) : '#mail';
      await putJ('c/g/' + nonce, {uid: v.uid, until: Date.now() + STATE_MS, back});
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + q({client_id: c.clientId, redirect_uri: redirectFor(req), response_type: 'code',
        scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: nonce});
      return {url};
    },
    async googledisconnect(v) {
      await need(v, LEVEL.interact);
      const t = await getJ(tokKey(v.uid)).catch(() => null);
      if (t && t.refresh) await doFetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.refresh), {method: 'POST'}).catch(() => {});
      await store.delete(tokKey(v.uid)).catch(() => {});
      await log(v.uid, 'google', '', 'disconnected');
      return {ok: true};
    },
    /* team emails, for meeting invites */
    async teamemails(v) {
      await need(v, LEVEL.interact);
      const team = (await getJ('d/roster~team').catch(() => null)) || (await getJ(h.docKey('roster/team')).catch(() => null)) || {members: {}};
      const out = {};
      await Promise.all(Object.keys(team.members || {}).filter(u => team.members[u] && team.members[u].active !== false).map(async u => {
        const p = await getJ('p/' + u).catch(() => null);
        if (p && p.email) out[u] = {addr: p.email, name: p.name || ''};
      }));
      return {people: out};
    },

    /* ---------- mail ---------- */
    async gmail(v, body) {
      await need(v, LEVEL.interact);
      const query = String(body.q || '').slice(0, 300);
      const max = Math.max(1, Math.min(MAX_LIST, Number(body.max) || 25));
      const list = await gapi(v.uid, GM + '/messages?' + q({q: query || 'in:inbox', maxResults: max, pageToken: body.pageToken || ''}));
      const ids = (list.messages || []).map(m => m.id);
      const msgs = await messagesById(v.uid, ids);
      return {messages: msgs.map(summary), next: list.nextPageToken || '', estimate: list.resultSizeEstimate || 0};
    },
    async gmailread(v, body) {
      await need(v, LEVEL.interact);
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      const m = await gapi(v.uid, GM + '/messages/' + encodeURIComponent(id) + '?format=full');
      const b = bodies(m.payload);
      if (body.markRead !== false && (m.labelIds || []).includes('UNREAD')) {
        await gapi(v.uid, GM + '/messages/' + encodeURIComponent(id) + '/modify', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({removeLabelIds: ['UNREAD']})}).catch(() => {});
      }
      const attachments = [];
      const walk = p => { if (!p) return; if (p.filename && p.body && p.body.attachmentId) attachments.push({name: p.filename, size: p.body.size || 0, mime: p.mimeType || ''}); (p.parts || []).forEach(walk); };
      walk(m.payload);
      return {...summary(m), unread: false, cc: header(m, 'Cc'), text: b.text, html: b.html, attachments};
    },
    async gmailmark(v, body) {
      await need(v, LEVEL.interact);
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      const add = [], remove = [];
      if (body.unread === true) add.push('UNREAD'); if (body.unread === false) remove.push('UNREAD');
      if (body.starred === true) add.push('STARRED'); if (body.starred === false) remove.push('STARRED');
      if (body.archive === true) remove.push('INBOX');
      await gapi(v.uid, GM + '/messages/' + encodeURIComponent(id) + '/modify', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({addLabelIds: add, removeLabelIds: remove})});
      return {ok: true};
    },
    async gmailsend(v, body) {
      await need(v, LEVEL.interact);
      const to = String(body.to || '').trim().slice(0, 500), subject = String(body.subject || '').trim().slice(0, 300), text = String(body.text || '').slice(0, 20000);
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+(\s*[,;]\s*[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$/.test(to)) throw new HttpError(400, 'invalid_argument', 'Check the To address.');
      if (!text.trim()) throw new HttpError(400, 'invalid_argument', 'Write something first.');
      const t = await getJ(tokKey(v.uid)).catch(() => null);
      const raw = mime({from: t && t.email ? t.email : '', to, cc: String(body.cc || '').trim().slice(0, 500), subject, text, inReplyTo: String(body.inReplyTo || '').slice(0, 300)});
      const payload = {raw};
      if (body.threadId && /^[A-Za-z0-9_-]{1,64}$/.test(String(body.threadId))) payload.threadId = String(body.threadId);
      const r = await gapi(v.uid, GM + '/messages/send', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
      await log(v.uid, 'gmail', '', 'sent to ' + to.split(/[,;]/)[0].trim());
      return {id: r.id, threadId: r.threadId};
    },

    /* ---------- calendar and meetings ---------- */
    async gcal(v, body) {
      await need(v, LEVEL.interact);
      const from = body.from ? new Date(body.from) : new Date();
      const to = body.to ? new Date(body.to) : new Date(from.getTime() + 7 * 86400000);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new HttpError(400, 'invalid_argument', 'bad dates');
      const r = await gapi(v.uid, CAL + '/calendars/primary/events?' + q({timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: 60, timeZone: TZ}));
      const events = (r.items || []).filter(e => e.status !== 'cancelled').map(e => ({
        id: e.id, title: e.summary || '(no title)', description: String(e.description || '').slice(0, 2000), location: e.location || '',
        start: (e.start && (e.start.dateTime || e.start.date)) || '', end: (e.end && (e.end.dateTime || e.end.date)) || '', allDay: !!(e.start && e.start.date && !e.start.dateTime),
        meet: e.hangoutLink || ((e.conferenceData && (e.conferenceData.entryPoints || []).find(p => p.entryPointType === 'video')) || {}).uri || '',
        link: e.htmlLink || '', organizer: (e.organizer && (e.organizer.displayName || e.organizer.email)) || '',
        attendees: (e.attendees || []).map(a => ({addr: a.email, name: a.displayName || '', status: a.responseStatus || '', self: !!a.self})),
        mine: !!(e.organizer && e.organizer.self), myStatus: ((e.attendees || []).find(a => a.self) || {}).responseStatus || ''
      }));
      return {events};
    },
    async gcalcreate(v, body) {
      await need(v, LEVEL.interact);
      const title = String(body.title || '').trim().slice(0, 200);
      if (!title) throw new HttpError(400, 'invalid_argument', 'Give the meeting a name.');
      const start = new Date(String(body.start || '')), end = new Date(String(body.end || ''));
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw new HttpError(400, 'invalid_argument', 'Check the start and end.');
      const attendees = (Array.isArray(body.attendees) ? body.attendees : []).map(a => String(a || '').trim()).filter(a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)).slice(0, 50);
      const ev = {summary: title, description: String(body.description || '').slice(0, 4000), location: String(body.location || '').slice(0, 300),
        start: {dateTime: start.toISOString(), timeZone: TZ}, end: {dateTime: end.toISOString(), timeZone: TZ},
        attendees: attendees.map(email => ({email}))};
      if (body.meet !== false) ev.conferenceData = {createRequest: {requestId: rand(16).replace(/[^a-z0-9]/gi, ''), conferenceSolutionKey: {type: 'hangoutsMeet'}}};
      const r = await gapi(v.uid, CAL + '/calendars/primary/events?' + q({conferenceDataVersion: 1, sendUpdates: attendees.length ? 'all' : 'none'}), {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(ev)});
      await log(v.uid, 'gcal', '', 'meeting: ' + title);
      return {id: r.id, link: r.htmlLink || '', meet: r.hangoutLink || ((r.conferenceData && (r.conferenceData.entryPoints || []).find(p => p.entryPointType === 'video')) || {}).uri || ''};
    },
    async gcalrsvp(v, body) {
      await need(v, LEVEL.interact);
      const id = String(body.id || ''), status = ['accepted', 'declined', 'tentative'].includes(body.status) ? body.status : '';
      if (!id || !status) throw new HttpError(400, 'invalid_argument', 'bad rsvp');
      const e = await gapi(v.uid, CAL + '/calendars/primary/events/' + encodeURIComponent(id));
      const t = await getJ(tokKey(v.uid)).catch(() => null);
      const attendees = (e.attendees || []).map(a => (a.self || (t && a.email === t.email)) ? {...a, responseStatus: status} : a);
      await gapi(v.uid, CAL + '/calendars/primary/events/' + encodeURIComponent(id) + '?sendUpdates=all', {method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify({attendees})});
      return {ok: true};
    },

    /* ---------- drive ---------- */
    async gdrive(v, body) {
      await need(v, LEVEL.interact);
      const query = String(body.q || '').trim().slice(0, 200).replace(/['\\]/g, '');
      const r = await gapi(v.uid, DRIVE + '/files?' + q({q: query ? "name contains '" + query + "' and trashed = false" : 'trashed = false', orderBy: 'modifiedTime desc', pageSize: 30,
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,owners(displayName),size)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'}));
      return {files: (r.files || []).map(f => ({id: f.id, name: f.name, mime: f.mimeType || '', modified: f.modifiedTime || '', link: f.webViewLink || '', icon: f.iconLink || '', owner: ((f.owners || [])[0] || {}).displayName || '', size: Number(f.size) || 0}))};
    }
  };

  /* the browser lands here after Google: code and state, then back into m360 */
  async function googleCallback(request) {
    let url;
    try { url = new URL(request.url); } catch (e) { return new Response('bad request', {status: 400}); }
    /* the address the browser used, so the way back lands on the same host and port */
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = (request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https').split(',')[0].trim();
    const site = host ? proto + '://' + host : url.origin;
    const back = (where, ok, why) => new Response('', {status: 302, headers: {location: site + '/?google=' + (ok ? 'ok' : 'error') + (why ? '&why=' + encodeURIComponent(why) : '') + (where || '#mail'), 'cache-control': 'no-store'}});
    const code = url.searchParams.get('code') || '', state = url.searchParams.get('state') || '';
    if (!/^[a-z0-9]{10,64}$/i.test(state)) return back('', false, 'state');
    const rec = await getJ('c/g/' + state).catch(() => null);
    await store.delete('c/g/' + state).catch(() => {});
    if (!rec || !rec.uid || Number(rec.until) < Date.now()) return back('', false, 'expired');
    if (!code || url.searchParams.get('error')) return back(rec.back, false, url.searchParams.get('error') || 'nocode');
    const c = await conf();
    if (!c) return back(rec.back, false, 'unconfigured');
    const r = await doFetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: form({code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: site + '/api/google', grant_type: 'authorization_code'})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) return back(rec.back, false, (j && j.error) || 'token');
    let email = '';
    try {
      const u = await doFetch('https://openidconnect.googleapis.com/v1/userinfo', {headers: {authorization: 'Bearer ' + j.access_token}});
      const uj = await u.json().catch(() => ({}));
      email = String(uj.email || '');
    } catch (e) { /* the email is a nicety */ }
    const prev = await getJ(tokKey(rec.uid)).catch(() => null);
    const refresh = j.refresh_token || (prev && prev.refresh) || '';
    if (!refresh) return back(rec.back, false, 'norefresh');
    await putJ(tokKey(rec.uid), {refresh, access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000, email, at: Date.now()});
    await log(rec.uid, 'google', '', 'connected ' + email);
    return back(rec.back, true);
  }

  return {actions, googleCallback};
}
