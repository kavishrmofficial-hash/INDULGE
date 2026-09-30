/* security: the second factor, the throttle, the breach check, the new-device mail and the security log.
     t/<uid>          {secret, on, at, lastStep, recovery: [{salt, hash}], pending}   a person's authenticator; the secret never reaches a page after setup
     c2/<nonce>       {uid, until, ua, ip, tries, via}                                a password sign-in waiting for its code, five minutes
     r/<iphash>       {n, since}                                                      sign-in attempts from one address in the window
     dv/<uid>         {seen: {key: at}}                                               devices a person has signed in from
     sec/events       {events: [{at, uid, kind, ua, ip, note}]}                       the last 300 security events, for Admin
   The code is RFC 6238 TOTP: SHA-1, 30 second steps, six digits, one step of drift either way, a step never accepted twice. */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30000;
const CHALLENGE_MS = 5 * 60000;
const CHALLENGE_TRIES = 5;
const THROTTLE_MAX = 40;         /* sign-in shaped calls from one address inside THROTTLE_MS */
const THROTTLE_MS = 15 * 60000;
const EVENTS_MAX = 300;
const RECOVERY_N = 8;

function b32enc(u8) {
  let bits = 0, val = 0, out = '';
  for (const b of u8) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(s) {
  const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const out = [];
  let bits = 0, val = 0;
  for (const c of clean) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
async function hotp(secretBytes, counter) {
  const key = await crypto.subtle.importKey('raw', secretBytes, {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = sig[sig.length - 1] & 15;
  const code = ((sig[o] & 127) << 24) | (sig[o + 1] << 16) | (sig[o + 2] << 8) | sig[o + 3];
  return String(code % 1000000).padStart(6, '0');
}
const hex = u8 => Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))); }
async function sha1hex(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(s))))).toUpperCase(); }
const randWord = n => { const u8 = new Uint8Array(n); crypto.getRandomValues(u8); return u8; };
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const maskIp = ip => { const s = String(ip || ''); if (!s) return ''; if (s.includes(':')) return s.split(':').slice(0, 3).join(':') + ':…'; const p = s.split('.'); return p.length === 4 ? p[0] + '.' + p[1] + '.x.x' : s; };
/* a recovery code the person can type: ten letters and digits in two groups */
const recoveryCode = () => { const u8 = randWord(10); const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (const b of u8) s += A[b % A.length]; return s.slice(0, 5) + '-' + s.slice(5); };

export function securityActions(h) {
  const {store, env, getJ, putJ, ownerUid, levelOf, LEVEL, HttpError, log, sendMail, rand} = h;
  const nowMs = () => (env && env.NOW_MS ? Number(env.NOW_MS) : Date.now());

  /* ---------- the log ---------- */
  async function event(kind, uid, req, note) {
    try {
      const cur = (await getJ('sec/events').catch(() => null)) || {events: []};
      const e = {at: Date.now(), uid: String(uid || ''), kind: String(kind), ua: String((req && req.ua) || '').slice(0, 40), ip: maskIp(req && req.ip), note: String(note || '').slice(0, 120)};
      const events = [e].concat(Array.isArray(cur.events) ? cur.events : []).slice(0, EVENTS_MAX);
      await putJ('sec/events', {events, updated: Date.now()});
    } catch (e) { /* the log never blocks the action */ }
  }

  /* ---------- the throttle: sign-in shaped calls per address ---------- */
  async function throttle(req) {
    const ip = String((req && req.ip) || '');
    if (!ip) return;
    const key = 'r/' + (await sha256hex(ip)).slice(0, 32);
    const now = Date.now();
    const rec = (await getJ(key).catch(() => null)) || {n: 0, since: now};
    const fresh = !rec.since || now - rec.since > THROTTLE_MS;
    const n = fresh ? 1 : (Number(rec.n) || 0) + 1;
    await putJ(key, {n, since: fresh ? now : rec.since}).catch(() => {});
    if (n > THROTTLE_MAX) {
      if (n === THROTTLE_MAX + 1) await event('throttled', '', req, 'more than ' + THROTTLE_MAX + ' sign-in calls in 15 minutes');
      throw new HttpError(429, 'slow_down', 'Too many tries from this connection. Wait 15 minutes.');
    }
  }

  /* ---------- the breach check (k-anonymity: five characters of the hash leave the server, never the password) ---------- */
  async function breached(password) {
    try {
      const sha = await sha1hex(password);
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const t = ctrl ? setTimeout(() => ctrl.abort(), 3000) : null;
      const r = await (env.fetch || fetch)('https://api.pwnedpasswords.com/range/' + sha.slice(0, 5), {headers: {'add-padding': 'true'}, signal: ctrl ? ctrl.signal : undefined});
      if (t) clearTimeout(t);
      if (!r.ok) return false;
      const text = await r.text();
      const tail = sha.slice(5);
      for (const line of text.split(/\r?\n/)) {
        const [suf, cnt] = line.trim().split(':');
        if (suf && suf.toUpperCase() === tail && Number(cnt) > 0) return true;
      }
      return false;
    } catch (e) { return false; }
  }
  async function checkBreach(password) {
    if (await breached(password)) throw new HttpError(400, 'weak', 'That password has shown up in a data breach. Pick another one.');
  }

  /* ---------- the second factor ---------- */
  const recKey = 't/';
  async function totpRec(uid) { return (await getJ(recKey + uid).catch(() => null)) || null; }
  async function codeOk(rec, code, now) {
    const c = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(c) || !rec || !rec.secret) return 0;
    const secret = b32dec(rec.secret);
    const step = Math.floor(now / STEP);
    for (const d of [0, -1, 1]) {
      const s = step + d;
      if (rec.lastStep && s <= rec.lastStep) continue;
      if (same(await hotp(secret, s), c)) return s;
    }
    return 0;
  }
  async function recoveryOk(rec, code) {
    const c = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (c.length < 8 || !rec || !Array.isArray(rec.recovery)) return -1;
    for (let i = 0; i < rec.recovery.length; i++) {
      const r = rec.recovery[i];
      if (!r || !r.hash) continue;
      if (same(await sha256hex(r.salt + ':' + c), r.hash)) return i;
    }
    return -1;
  }
  /* a second factor accepted: the time code, or one recovery code (spent on use). Throws on a miss. */
  async function verify(uid, code, what) {
    const rec = await totpRec(uid);
    if (!rec || !rec.on) return true;
    const now = nowMs();
    const step = await codeOk(rec, code, now);
    if (step) { await putJ(recKey + uid, {...rec, lastStep: step}).catch(() => {}); return true; }
    const i = await recoveryOk(rec, code);
    if (i >= 0) {
      const recovery = rec.recovery.slice(); recovery.splice(i, 1);
      await putJ(recKey + uid, {...rec, recovery}).catch(() => {});
      await log(uid, 'recovery', '', what || 'a recovery code was used');
      return true;
    }
    throw new HttpError(403, 'bad_code', 'That code does not match. Open your authenticator and try the current one.');
  }
  async function isOn(uid) { const rec = await totpRec(uid); return !!(rec && rec.on); }

  /* after a password (or a link, or a reset): the session now, or a challenge when the person has a second factor */
  async function gate(uid, req, via) {
    if (!(await isOn(uid))) return null;
    const nonce = rand(24).replace(/[^a-z0-9]/g, '').slice(0, 32);
    await putJ('c2/' + nonce, {uid, until: Date.now() + CHALLENGE_MS, ua: String((req && req.ua) || ''), ip: String((req && req.ip) || ''), tries: 0, via: String(via || 'pw'), at: Date.now()});
    return {needCode: true, tmp: nonce};
  }
  async function answer(body, req) {
    const nonce = String(body.tmp || '');
    if (!/^[a-z0-9]{16,40}$/.test(nonce)) throw new HttpError(400, 'invalid_argument', 'bad challenge');
    const c = await getJ('c2/' + nonce).catch(() => null);
    if (!c || !c.uid || Number(c.until) < Date.now()) throw new HttpError(410, 'expired', 'That sign-in timed out. Start again.');
    const tries = (Number(c.tries) || 0) + 1;
    if (tries > CHALLENGE_TRIES) { await store.delete('c2/' + nonce).catch(() => {}); await event('code_fail', c.uid, req, 'too many code tries'); throw new HttpError(410, 'expired', 'Too many wrong codes. Sign in again.'); }
    await putJ('c2/' + nonce, {...c, tries});
    try { await verify(c.uid, body.code, 'sign-in'); }
    catch (e) { await event('code_fail', c.uid, req, 'wrong code'); throw e; }
    await store.delete('c2/' + nonce).catch(() => {});
    return {uid: c.uid, via: c.via};
  }

  /* ---------- devices: a mail when a sign-in comes from somewhere new ---------- */
  async function noteSignin(uid, req, via, site) {
    const ua = String((req && req.ua) || 'Browser');
    const ip = String((req && req.ip) || '');
    await event('signin', uid, req, via);
    try {
      const key = (await sha256hex(ua + '|' + ip)).slice(0, 16);
      const cur = (await getJ('dv/' + uid).catch(() => null)) || {seen: {}};
      const seen = cur.seen && typeof cur.seen === 'object' ? cur.seen : {};
      const first = !Object.keys(seen).length;
      const known = !!seen[key];
      seen[key] = Date.now();
      const keys = Object.keys(seen).sort((a, b) => seen[b] - seen[a]).slice(0, 30);
      const kept = {}; for (const k of keys) kept[k] = seen[k];
      await putJ('dv/' + uid, {seen: kept});
      if (first || known) return;
      const p = await getJ('p/' + uid).catch(() => null);
      if (!p || !p.email) return;
      const when = new Date(Date.now() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16) + ' IST';
      const line = 'A new sign-in to your m360 account: ' + ua + (ip ? ', from ' + maskIp(ip) : '') + ', at ' + when + '.';
      const tail = 'If this was you, nothing to do. If not, open Me on m360, sign out everywhere and change your password.';
      await sendMail(p.email, 'New sign-in to m360', line + '\n\n' + tail, '<p>' + line + '</p><p>' + tail + '</p>', site).catch(() => {});
    } catch (e) { /* the mail is a courtesy */ }
  }

  const actions = {
    /* the state of your second factor */
    async totpstate(v) {
      if (!v) throw new HttpError(401, 'noid');
      const rec = await totpRec(v.uid);
      return {on: !!(rec && rec.on), since: rec && rec.on ? rec.at || 0 : 0, recovery: rec && rec.on ? (rec.recovery || []).length : 0};
    },
    /* start: a fresh secret, shown once, not yet on */
    async totpstart(v) {
      if (!v) throw new HttpError(401, 'noid');
      const rec = await totpRec(v.uid);
      if (rec && rec.on) throw new HttpError(409, 'failed_precondition', 'Your authenticator is already on. Turn it off first to set up a new one.');
      const secret = b32enc(randWord(20));
      const p = await getJ('p/' + v.uid).catch(() => null);
      const who = encodeURIComponent(String((p && p.email) || (p && p.name) || v.uid).slice(0, 80));
      await putJ(recKey + v.uid, {secret, on: false, at: Date.now(), pending: true});
      return {secret, uri: 'otpauth://totp/m360%20OS:' + who + '?secret=' + secret + '&issuer=m360%20OS&algorithm=SHA1&digits=6&period=' + (STEP / 1000)};
    },
    /* on: the first code from the app proves the secret landed; the recovery codes are shown once */
    async totpon(v, body, req) {
      if (!v) throw new HttpError(401, 'noid');
      const rec = await totpRec(v.uid);
      if (!rec || !rec.secret || rec.on) throw new HttpError(400, 'failed_precondition', 'Start the setup first.');
      const step = await codeOk(rec, body.code, nowMs());
      if (!step) throw new HttpError(403, 'bad_code', 'That code does not match. Check the clock on your phone and try the current one.');
      const plain = Array.from({length: RECOVERY_N}, recoveryCode);
      const recovery = [];
      for (const c of plain) { const salt = rand(12); recovery.push({salt, hash: await sha256hex(salt + ':' + c.replace(/[^a-z0-9]/g, ''))}); }
      await putJ(recKey + v.uid, {secret: rec.secret, on: true, at: Date.now(), lastStep: step, recovery});
      await log(v.uid, 'totp', '', 'on');
      await event('totp_on', v.uid, req, '');
      return {on: true, recovery: plain};
    },
    /* off: a current code (or a recovery code) and, when you have one, your password */
    async totpoff(v, body, req) {
      if (!v) throw new HttpError(401, 'noid');
      const rec = await totpRec(v.uid);
      if (!rec || !rec.on) { await store.delete(recKey + v.uid).catch(() => {}); return {on: false}; }
      await verify(v.uid, body.code, 'turning the authenticator off');
      await store.delete(recKey + v.uid).catch(() => {});
      await log(v.uid, 'totp', '', 'off');
      await event('totp_off', v.uid, req, '');
      return {on: false};
    },
    /* fresh recovery codes, with a current code */
    async totprecovery(v, body, req) {
      if (!v) throw new HttpError(401, 'noid');
      const rec = await totpRec(v.uid);
      if (!rec || !rec.on) throw new HttpError(400, 'failed_precondition', 'Your authenticator is not on.');
      const step = await codeOk(rec, body.code, nowMs());
      if (!step) throw new HttpError(403, 'bad_code', 'That code does not match.');
      const plain = Array.from({length: RECOVERY_N}, recoveryCode);
      const recovery = [];
      for (const c of plain) { const salt = rand(12); recovery.push({salt, hash: await sha256hex(salt + ':' + c.replace(/[^a-z0-9]/g, ''))}); }
      await putJ(recKey + v.uid, {...rec, lastStep: step, recovery});
      await event('recovery_new', v.uid, req, '');
      return {recovery: plain};
    },
    /* the founder's view: the last events, who has a second factor, who does not */
    async securityinfo(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'not_granted');
      const cur = (await getJ('sec/events').catch(() => null)) || {events: []};
      const team = (await getJ('d/roster~team').catch(() => null)) || {};
      const members = team.members || {};
      const owner = await ownerUid();
      const people = {};
      for (const uid of Object.keys(members).concat(owner ? [owner] : [])) {
        if (people[uid] || (members[uid] && members[uid].active === false)) continue;
        people[uid] = {totp: await isOn(uid)};
      }
      return {events: (cur.events || []).slice(0, 120), people};
    },
    /* the founder can turn someone's authenticator off when their phone is gone (they get a mail) */
    async totpreset(v, body, req) {
      const owner = await ownerUid();
      if (!v || v.uid !== owner) throw new HttpError(403, 'not_granted');
      const uid = String(body.uid || '');
      if (!uid || uid === owner) throw new HttpError(400, 'invalid_argument', 'Not for your own account; use a recovery code.');
      await store.delete(recKey + uid).catch(() => {});
      await log(v.uid, 'totp', '', 'off for ' + uid);
      await event('totp_reset', uid, req, 'by the owner');
      return {ok: true};
    }
  };

  return {actions, event, throttle, checkBreach, gate, answer, noteSignin, isOn, verify};
}
