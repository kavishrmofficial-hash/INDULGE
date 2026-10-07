/* module: prospects. Who each person is speaking to, who they have a meeting with, what pitch has gone
   where, and when to follow up. The people, the conversations, the notes and the reminders are private
   to the person (data/users/<uid>/prospects, and one touch log a month at data/users/<uid>/prospects.<YYYY-MM>);
   the pitch itself, its stage, its owner and where it was sent stay on the shared pipeline (pitches/<id>.sent).
   A follow-up on a pitch the viewer owns mirrors its date, and only its date, onto the pitch as the next
   step. Reminders reach the person in m360 only: the Home fold, the inbox and one black card on the day,
   rung once per device. Capture is one typed or spoken line, read with no model call. */
'use strict';
(function () {
  const {html, React, U} = M;
  const {useEffect, useRef, useMemo} = React;

  const DAY = 86400000, MIN = 60000;
  const PASS = 30000;               /* the watcher's pass */
  const DEFAULT_T = '10:00';        /* a follow-up with no time rings at ten in the morning, IST */
  const QUIET_FROM = 9 * 60, QUIET_TO = 21 * 60;   /* a default time rings inside this span only */
  const MONTH_MAX = 200000;         /* a month's log past this overflows to prospects.<YYYY-MM>-2 */
  const SENT_MAX = 30;              /* send rows kept on a pitch */
  const PI_MAX = 10;                /* pitches remembered on a person */
  const SNZ_MAX = 5;
  const TALK_DAYS = 21, LOOSE_DAYS = 30, SETTLED_DAYS = 60;
  const PRIVATE_MSG = 'Prospects are private to each person.';
  const YMD = /^\d{4}-\d{2}-\d{2}$/;

  const path = uid => 'data/users/' + uid + '/prospects';
  const month = (uid, ym) => 'data/users/' + uid + '/prospects.' + ym;
  const when = () => M.when;
  const ist = () => M.when.ist;
  const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const esc = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uniq = xs => Array.from(new Set((xs || []).filter(Boolean)));
  const isOpen = f => !!f && !f.done;
  const capWords = s => String(s || '').trim().split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
  const first = s => String(s || '').trim().split(/\s+/)[0] || '';
  const label = (ymd, t) => when().label(ymd, t);
  const todayOf = nowMs => ist().ymd(nowMs || Date.now());
  const workOf = ctx => s => ctx && typeof ctx.isWorkingDay === 'function' ? ctx.isWorkingDay(s) : ist().dow(s) !== 0;

  /* ---------- reads ---------- */
  const EMPTY = Object.freeze({people: Object.freeze({}), fu: Object.freeze({}), meet: Object.freeze({}), prefs: Object.freeze({mirror: true})});
  const dataMemo = new WeakMap();
  const data = ctx => {
    const doc = ctx && ctx.priv && ctx.priv.prospects && ctx.priv.prospects.data;
    if (!doc || ctx.viewAs) return EMPTY;
    let d = dataMemo.get(doc);
    if (!d) { d = {people: doc.people || {}, fu: doc.fu || {}, meet: doc.meet || {}, prefs: {mirror: true, ...(doc.prefs || {})}}; dataMemo.set(doc, d); }
    return d;
  };
  const ready = ctx => !!(ctx && ctx.priv && ctx.priv.prospects && ctx.priv.prospects.ready);
  const can = ctx => !!(ctx && ctx.uid && !ctx.viewAs && ctx.W);
  /* a chip or a button may hold the context it was made with: the writers read the live one for the same person */
  const live = ctx => (ctx && M.lastCtx && M.lastCtx.uid === ctx.uid && !M.lastCtx.viewAs === !ctx.viewAs) ? M.lastCtx : ctx;
  const refuse = () => { M.toast(PRIVATE_MSG, true); return Promise.reject(new Error(PRIVATE_MSG)); };
  const mergeIndex = (ctx, patch) => ctx.W.merge(path(ctx.uid), {v: 1, ...patch});
  const pitchOf = (ctx, id) => (id && ctx && ctx.coll && ctx.coll.pitches && ctx.coll.pitches.map[id]) || null;
  const personOf = (ctx, pid) => (pid && data(ctx).people[pid]) || null;
  const byCid = (ctx, cid) => { if (!cid) return null; const ps = data(ctx).people; const pid = Object.keys(ps).find(id => ps[id] && ps[id].cid === cid && !ps[id].gone); return pid ? {pid, ...ps[pid]} : null; };
  const byPitch = (ctx, pitchId) => { if (!pitchId) return []; const ps = data(ctx).people; return Object.keys(ps).filter(id => ps[id] && !ps[id].gone && (ps[id].pi || []).indexOf(pitchId) >= 0).map(id => ({pid: id, ...ps[id]})); };
  const openFuOf = (d, pid, pi) => Object.keys(d.fu).filter(id => isOpen(d.fu[id]) && ((pid && d.fu[id].p === pid) || (pi && d.fu[id].pi === pi))).sort();
  const openMeetOf = (d, pid) => Object.keys(d.meet).filter(id => d.meet[id] && !d.meet[id].done && d.meet[id].p === pid).sort((a, b) => (d.meet[a].d + (d.meet[a].t || '')).localeCompare(d.meet[b].d + (d.meet[b].t || '')));
  const whoOrg = p => !p ? '' : (p.who || 'Someone') + (p.org ? ' at ' + p.org : '');
  const nameOf = (ctx, u) => (M.pm && M.pm.first ? M.pm.first(ctx, u) : '') || 'Someone';

  async function readDoc(ctx, p) {
    try { const s = await ctx.db.doc(p).get(); return s && s.exists ? U.dropNulls(s.data()) : null; } catch (e) { return null; }
  }
  /* the month doc a new touch goes in: the month's, or its -2 once the first is past 200 KB */
  async function touchPath(ctx, ym) {
    const base = month(ctx.uid, ym);
    const cur = await readDoc(ctx, base);
    return cur && JSON.stringify(cur).length > MONTH_MAX ? base + '-2' : base;
  }

  /* ---------- the ring time ---------- */
  const ringAtOf = f => !f || !YMD.test(f.d || '') ? null : ist().at(f.d, f.t || DEFAULT_T);
  const meetRingAt = m => !m || !YMD.test(m.d || '') ? null : m.t ? ist().at(m.d, m.t) - 30 * MIN : ist().at(m.d, '09:30');
  const ringKey = (fid, f) => 'fu:' + fid + '@' + f.d + 'T' + (f.t || DEFAULT_T);
  const meetKey = (mid, m) => 'mt:' + mid + '@' + m.d;

  /* ---------- status, derived, never stored ---------- */
  function statusOf(ctx, pid) {
    const d = data(ctx);
    const p = d.people[pid];
    if (!p) return '';
    if (p.st === 'done' || p.gone) return 'done';
    const now = Date.now(), today = todayOf(now);
    const fid = openFuOf(d, pid, '')[0];
    const f = fid ? d.fu[fid] : null;
    if (f && f.d < today) return 'late';
    if (openMeetOf(d, pid).length) return 'meeting';
    if (f && f.d > today && ((f.after && f.after >= today) || f.src === 'sent')) return 'waiting';
    if (p.last && now - Number(p.last.at || 0) <= TALK_DAYS * DAY) return 'talking';
    return 'quiet';
  }

  /* ---------- the bridge: a date, and only a date, onto the shared pitch ---------- */
  const mayMirror = (ctx, pitch) => !!pitch && !!ctx && (pitch.owner === ctx.uid || !!ctx.isFounder);
  /* what the bridge would write, or why not. Hand-typed text is never overwritten; the date moves when
     the pitch has none, a past one, one the bridge set, or one later than this follow-up */
  function bridgePlan(ctx, pitch, f, what) {
    if (!pitch) return {ok: false, why: ''};
    if (!mayMirror(ctx, pitch)) return {ok: false, why: nameOf(ctx, pitch.owner) + ' owns the ' + (pitch.brand || 'pitch') + ' pitch. Your date stays with you.'};
    const today = todayOf(Date.now());
    const nd = YMD.test(pitch.nextDate || '') ? pitch.nextDate : '';
    const ours = pitch.nextBy === 'fu';
    const textFree = !pitch.next || ours;
    const dateOk = !nd || nd < today || ours || nd > f.d;
    if (!dateOk) return {ok: false, why: (pitch.brand || 'The pitch') + ' has a next step set by hand, so your date stays with you.'};
    const patch = {nextDate: f.d, nextBy: 'fu', updated: Date.now()};
    if (textFree) patch.next = what ? 'Follow up on ' + cut(what, 60) : 'Follow up';
    return {ok: true, patch, mirror: {nextDate: f.d, next: patch.next || ''}};
  }
  /* the pitch fields come back only while they still hold what the bridge wrote */
  function clearPlan(pitch, mirror, moveTo) {
    if (!pitch || !mirror) return null;
    const patch = {};
    if (mirror.nextDate && pitch.nextDate === mirror.nextDate) patch.nextDate = moveTo || '';
    if (!moveTo && mirror.next && pitch.next === mirror.next) patch.next = '';
    if (!Object.keys(patch).length) return null;
    if (!moveTo && pitch.nextBy === 'fu') patch.nextBy = '';
    patch.updated = Date.now();
    return patch;
  }
  const writePitch = (ctx, id, patch) => ctx.W.merge('pitches/' + id, patch);

  /* ---------- the capture reader: one line in, one structured touch out. No model call ---------- */
  const TALK = /\b(met|meeting with|spoke (?:to|with)|talked (?:to|with)|called|had a call with|on a call with|caught up with|emailed|mailed|whatsapped|messaged|texted|pinged|pitched (?:to)?|dropped (?:in )?(?:on|at))\b/;
  const KIND = [[/\bwhatsapp/, 'wa'], [/\b(emailed|mailed|email)\b/, 'mail'], [/\b(called|call)\b/, 'call'], [/\b(met|meeting|caught up|dropped)\b/, 'meet'], [/\b(spoke|talked|pitched)\b/, 'talk'], [/\b(linkedin|dm)\b/, 'li'], [/\b(texted|messaged|pinged)\b/, 'msg']];
  const ITEMS = 'deck|proposal|creds|credentials|case studies|case study|quote|estimate|rate card|ratecard|moodboard|treatment|scope|sow|contract|pitch|presentation|follow ?up|reel|showreel|portfolio';
  const WA_ITEM = new RegExp('\\b(?:whatsapped|emailed|mailed|sent) (?!the |our |a |an |over |across )([a-z]+)(?: (?:from|at) ([a-z0-9&]+))? (?:the |our )?(' + ITEMS + ')\\b');
  const SENT = new RegExp("\\b(?:i |we |just |have |has )*(?:sent|shared|mailed|emailed|whatsapped|dropped) (?:over |across )?(?:the |our |a |an |my )?(?:([a-z0-9' ]{2,24}?) )?(" + ITEMS + ")(?: v ?(\\d+))?\\b(?: (?:to|with) ([a-z][a-z.' ]{1,40}?))?(?=$|[,.;]| and | he | she | they | at | from | over | on | via | by | yesterday| today|\\s+said)");
  const FOLLOW = /\b(remind me|follow up|followup|chase|ping (?:him|her|them)|call (?:him|her|them) back|get back|circle back|revert|talk|speak|call|connect|meet|catch up)\b[^.]*?\b(after|on|by|next|in|tomorrow|day after|end of|this|parso|agle|ke baad|monday|tuesday|wednesday|thursday|friday|saturday|\d{1,2}(?:st|nd|rd|th))\b/;
  const REPLY = /^\s*([a-z][a-z0-9&' ]{1,30}?) (replied|wrote back|came back|said yes|said no|said later|declined|passed|got back)\b/;
  const MEETF = /\b(?:meeting|meet|call|catch ?up|lunch|coffee) (?:with|w\/) (.+?) (?:on|at|tomorrow|next|this|monday|tuesday|wednesday|thursday|friday|saturday)\b/;
  const STOP = /^(the|a|an|him|her|them|us|me|it|our|their|my|client|team|brand|deck|proposal|everyone|all)$/;
  const COO_SEND = /^(?:please )?send (?:the )?(.+? (?:follow up|followup|follow-up|reminder|confirm note|draft))$/;
  const QUESTION = /^(who|which|what|when|where|how|why|is|are|am|do|does|did|can|could|should|will|would|has|have)\b/;
  function whoIn(str) {
    let m;
    if ((m = /\b([a-z][a-z.']{1,20}(?: [a-z][a-z.']{1,20})?) (?:from|at|of|@) ([a-z0-9][a-z0-9&.' ]{1,30}?)(?=$|[,.;]| and | he | she | they | about | today| yesterday| on | for | after | said | sent | to | the )/.exec(str))) return {who: m[1], org: m[2].trim()};
    if ((m = /\b([a-z0-9&]+)'s ([a-z]+)\b/.exec(str))) return {who: m[2], org: m[1]};
    if ((m = /\b([a-z][a-z.']{1,20}) \(([a-z0-9&.' ]{1,30})\)/.exec(str))) return {who: m[1], org: m[2].trim()};
    return null;
  }
  /* {kind, who, org, sent:{what,to}, when, meet:{d,t}, reply, said, needDate?} or null */
  function read(text, ctx) {
    const raw = String(text || '');
    const s = ' ' + raw.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
    const t = s.trim();
    if (!t || /^coo\b/.test(t) || COO_SEND.test(t) || QUESTION.test(t) || /\?\s*$/.test(t)) return null;
    const now = Date.now();
    const isWork = workOf(ctx);
    const out = {kind: '', who: '', org: '', sent: null, when: null, meet: null, reply: '', said: raw.trim().slice(0, 300)};
    let m, hit = false;
    if ((m = REPLY.exec(t)) && !TALK.test(t)) { out.kind = 'reply'; out.org = m[1].trim(); out.reply = /no|declined|passed/.test(m[2]) ? 'no' : /later/.test(m[2]) ? 'later' : 'replied'; hit = true; }
    if ((m = WA_ITEM.exec(t))) { out.sent = {what: m[3], to: m[1]}; out.who = m[1]; if (m[2]) out.org = m[2]; hit = true; }
    else if ((m = SENT.exec(t))) { out.sent = {what: ((m[1] ? m[1].trim() + ' ' : '') + m[2]).trim() + (m[3] ? ' v' + m[3] : ''), to: m[4] ? m[4].trim() : ''}; out.kind = out.kind || 'sent'; hit = true; }
    if (TALK.test(t)) { hit = true; for (const [re, k] of KIND) if (re.test(t)) { out.kind = k; break; } }
    if ((m = MEETF.exec(t)) && !/\b(met|had)\b/.test(t)) { const w = when().parse(t, now, isWork); if (w && w.ymd) { out.meet = {d: w.ymd, t: w.t || ''}; out.kind = 'meet-plan'; hit = true; } }
    const p = out.who ? null : whoIn(t);
    if (p) { out.who = p.who.replace(/^(to|with|met|called|emailed|mailed|whatsapped|texted|messaged|meeting with) /, ''); out.org = out.org || p.org; }
    else if (!out.who) {
      const n = /\b(?:met|spoke (?:to|with)|talked (?:to|with)|called|emailed|mailed|whatsapped|caught up with|follow up with|chase|remind me to (?:call|ping|chase|mail|email|message|whatsapp)|meeting with) ([a-z][a-z.']{1,20})\b/.exec(t);
      if (n && !STOP.test(n[1])) out.who = n[1];
    }
    if (out.sent && out.sent.to && !out.who) { const q = whoIn(out.sent.to + ' '); out.who = q ? q.who : out.sent.to.split(' ')[0]; if (q) out.org = out.org || q.org; }
    if (!out.org && out.sent) { const b = new RegExp('\\b(?:sent|shared) (?:the |our )?([a-z0-9&]+) (?:' + ITEMS + ')').exec(t); if (b && !/^(new|final|updated|revised|full|v\d|latest)$/.test(b[1])) out.org = b[1]; }
    /* the brand is not part of what was sent: "Swisse proposal" is the proposal */
    if (out.sent && out.org) out.sent.what = out.sent.what.replace(new RegExp('^' + esc(out.org) + ' '), '').replace(new RegExp("^" + esc(out.org) + "'s "), '');
    if (FOLLOW.test(t) || /\b(after|ke baad)\b/.test(t)) {
      /* the date clause follows the follow-up word, so "met Rahul on Monday, talk after the 16th" reads the 16th */
      const cutAt = /\b(remind me|follow up|followup|chase|call (?:him|her|them) back|get back|circle back|revert|talk|speak|connect|catch up|ping)\b(.*)$/.exec(t);
      const w = (cutAt ? when().parse(cutAt[2], now, isWork) : null) || when().parse(t, now, isWork);
      if (w) { out.when = w; hit = true; if (!out.kind) out.kind = 'note'; }
    }
    if (!out.who && out.kind !== 'reply' && (m = /^([a-z]+) (?:said|says|told me|wants|asked)\b/.exec(t)) && !STOP.test(m[1]) && !/^(i|we|he|she|they|you)$/.test(m[1])) out.who = m[1];
    const fwd = /\b(follow up|followup|remind me|chase|circle back)\b/.test(t);
    if (fwd && !out.when && (out.org || out.who) && !out.sent && out.kind !== 'reply') return {...out, kind: '', needDate: true};
    if (/^remind me\b/.test(t) && !out.when) return {...out, kind: '', needDate: true};
    if (!hit) return null;
    return out;
  }
  const isCapture = r => !!r && (!!r.kind || !!r.needDate || (!!r.who && !!(r.when && r.when.ymd)) || /^(remind me|follow ?up)\b/i.test(String(r.said || '')));

  /* ---------- who and which pitch ---------- */
  const OPEN = p => !!p && !p.archived && ['won', 'lost'].indexOf(p.stage) < 0;
  const brandLower = p => String((p && p.brand) || '').trim().toLowerCase();
  function matchPitches(ctx, org) {
    const key = String(org || '').trim().toLowerCase();
    const map = (ctx.coll && ctx.coll.pitches && ctx.coll.pitches.map) || {};
    if (!key) return [];
    const ids = Object.keys(map).sort();
    const pick = list => {
      const exact = list.filter(id => brandLower(map[id]) === key);
      if (exact.length) return exact;
      const re = new RegExp('\\b' + esc(key) + '\\b');
      return list.filter(id => re.test(brandLower(map[id])) || new RegExp('\\b' + esc(brandLower(map[id])) + '\\b').test(key));
    };
    const open = pick(ids.filter(id => OPEN(map[id])));
    return open.length ? open : pick(ids.filter(id => map[id] && !map[id].archived && !OPEN(map[id])));
  }
  const orgOfRow = r => String((r && (r._on || r.orgName)) || '').trim();
  const sameWho = (a, b) => { const x = first(a).toLowerCase(), y = first(b).toLowerCase(); return !!x && x === y; };
  const sameOrg = (a, b) => { const x = String(a || '').toLowerCase().trim(), y = String(b || '').toLowerCase().trim(); return !x || !y || x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0; };
  /* {person:{pid, cid, oid, who, org, role, cands[]}, pitch:{id, cands[]}}: the preset first, then the private
     index, then the Base. Several hits come back as cands for the caller to ask about */
  async function resolve(ctx, r, preset) {
    r = r || {};
    preset = preset || {};
    const d = data(ctx);
    const map = (ctx.coll && ctx.coll.pitches && ctx.coll.pitches.map) || {};
    const out = {person: {pid: '', cid: '', oid: '', who: '', org: '', role: '', cands: []}, pitch: {id: '', cands: []}};
    if (preset.pitch && map[preset.pitch]) out.pitch.id = preset.pitch;
    else if (r.org) {
      const hits = matchPitches(ctx, r.org);
      if (hits.length === 1) out.pitch.id = hits[0];
      else if (hits.length > 1) out.pitch.cands = hits.map(id => ({id, brand: map[id].brand || '', stage: map[id].stage || 'lead'}));
    }
    const brand = out.pitch.id ? String(map[out.pitch.id].brand || '') : '';
    const fill = (pid, p) => { out.person = {pid, cid: p.cid || '', oid: p.oid || '', who: p.who || '', org: p.org || brand, role: p.role || '', cands: []}; };
    if (preset.pid && d.people[preset.pid]) fill(preset.pid, d.people[preset.pid]);
    else if (preset.cid) {
      const mine = byCid(ctx, preset.cid);
      if (mine) fill(mine.pid, mine);
      else {
        let row = null;
        try { const got = M.base && M.base.getRow ? await M.base.getRow(ctx, 'contacts', preset.cid) : null; row = got && got.row; } catch (e) { row = null; }
        out.person = {pid: '', cid: preset.cid, oid: (row && row.org) || '', who: (row && row.name) || capWords(r.who), org: orgOfRow(row) || brand || capWords(r.org), role: (row && row.title) || '', cands: []};
      }
    } else if (r.who) {
      const mine = Object.keys(d.people).filter(pid => { const p = d.people[pid]; return p && !p.gone && sameWho(p.who, r.who) && (!r.org || sameOrg(p.org, r.org) || (brand && sameOrg(p.org, brand))); }).sort();
      if (mine.length === 1) fill(mine[0], d.people[mine[0]]);
      else if (mine.length > 1) out.person.cands = mine.map(pid => ({pid, cid: d.people[pid].cid || '', who: d.people[pid].who, org: d.people[pid].org, role: d.people[pid].role || ''}));
      else {
        let rows = [];
        try {
          if (M.base && M.base.query && (ctx.remoteBase || (ctx.coll.contacts && ctx.coll.contacts.ready))) {
            const res = await M.base.query(ctx, 'contacts', {q: first(r.who), limit: 8});
            rows = ((res && res.rows) || []).filter(x => x && !x.archived && sameWho(x.name, r.who) && (!r.org || sameOrg(orgOfRow(x), r.org) || (brand && sameOrg(orgOfRow(x), brand))));
          }
        } catch (e) { rows = []; }
        if (rows.length === 1) out.person = {pid: '', cid: rows[0].id, oid: rows[0].org || '', who: rows[0].name || capWords(r.who), org: orgOfRow(rows[0]) || brand || capWords(r.org), role: rows[0].title || '', cands: []};
        else if (rows.length > 1) out.person.cands = rows.map(x => ({pid: '', cid: x.id, who: x.name || '', org: orgOfRow(x), role: x.title || ''}));
        else out.person = {pid: '', cid: '', oid: '', who: capWords(r.who), org: brand || capWords(r.org), role: '', cands: []};
      }
    }
    /* a person with one pitch and a line that names none: that pitch */
    if (!out.pitch.id && !out.pitch.cands.length && out.person.pid) { const pi = (d.people[out.person.pid].pi || []).filter(id => OPEN(map[id])); if (pi.length === 1) out.pitch.id = pi[0]; }
    return out;
  }

  /* ---------- the writers. Every one refuses in preview; every one returns a promise ---------- */
  const VIA = {wa: 'whatsapp', mail: 'mail', meet: 'meeting', li: 'linkedin', msg: 'whatsapp', sent: 'mail', talk: 'hand', call: 'hand'};
  const VERB = {meet: 'Met', talk: 'Spoke to', call: 'Called', mail: 'Emailed', wa: 'WhatsApped', msg: 'Messaged', li: 'Messaged'};
  const PROPOSAL = /\b(proposal|quote|estimate|sow)\b/;
  /* the next text kept on a follow-up: the clause from the follow-up word on ("talk after the 16th"), short;
     the month log keeps the whole line */
  const NEXT_CUT = /\b(remind me(?: to)?|follow ?up(?: with)?|chase|call (?:him|her|them) back|get back|circle back|revert|talk|speak|connect|catch up|ping|meet)\b(.*)$/;
  const nextText = line => { const t = String(line || '').trim(); const m = NEXT_CUT.exec(t.toLowerCase()); const s = m ? t.slice(m.index) : t; return cut(s.replace(/^remind me(?: to)?\s*/i, '').replace(/^[,.;\s]+/, ''), 120) || cut(t, 120); };

  async function logTouch(ctx, t) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const at = Number(t.at) || Date.now();
    const ym = todayOf(at).slice(0, 7);
    const p = await touchPath(ctx, ym);
    const tid = 'tt' + U.uid();
    const row = {p: t.p || '', pi: t.pi || '', k: t.k || 'note', x: cut(t.x, 600), at};
    if (t.sid) row.sid = t.sid;
    await ctx.W.merge(p, {t: {[tid]: row}});
    return {tid, path: p, ym};
  }
  function personPatch(ctx, pid, prev, o) {
    const now = o.now || Date.now();
    const ym = todayOf(now).slice(0, 7);
    if (!prev) return {cid: o.cid || '', ...(o.oid ? {oid: o.oid} : {}), who: cut(o.who, 60) || 'Someone', org: cut(o.org, 60), ...(o.role ? {role: cut(o.role, 60)} : {}), pi: uniq([o.pi]).slice(-PI_MAX), st: '', last: {at: now, k: o.k || 'note'}, mo: [ym], at: now, up: now};
    const patch = {last: {at: now, k: o.k || 'note'}, pi: uniq((prev.pi || []).concat([o.pi])).slice(-PI_MAX), mo: uniq((prev.mo || []).concat([ym])).slice(-24), up: now};
    if (o.cid && !prev.cid) { patch.cid = o.cid; patch.oid = o.oid || ''; }
    if (o.who && (!prev.who || prev.who === 'Someone')) patch.who = cut(o.who, 60);
    if (o.org && !prev.org) patch.org = cut(o.org, 60);
    if (o.role && !prev.role) patch.role = cut(o.role, 60);
    return patch;
  }
  async function addPerson(ctx, o) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    o = o || {};
    if (o.cid) { const have = byCid(ctx, o.cid); if (have) return have.pid; }
    const pid = 'pp' + U.uid();
    const now = Date.now();
    await mergeIndex(ctx, {people: {[pid]: {cid: o.cid || '', oid: o.oid || '', who: cut(o.who, 60) || 'Someone', org: cut(o.org, 60), role: cut(o.role, 60), pi: uniq(o.pi || []).slice(-PI_MAX), st: '', last: {at: now, k: 'note'}, mo: [], at: now, up: now}}});
    return pid;
  }
  async function track(ctx, cid) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const have = byCid(ctx, cid);
    if (have) return have.pid;
    let row = null;
    try { const got = M.base && M.base.getRow ? await M.base.getRow(ctx, 'contacts', cid) : null; row = got && got.row; } catch (e) { row = null; }
    return addPerson(ctx, {cid, oid: (row && row.org) || '', who: (row && row.name) || '', org: orgOfRow(row), role: (row && row.title) || ''});
  }
  async function stopTracking(ctx, pid) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const d = data(ctx);
    if (!d.people[pid]) return null;
    const now = Date.now();
    const patch = {people: {[pid]: {st: 'done', gone: now, up: now}}, fu: {}};
    for (const fid of openFuOf(d, pid, '')) { patch.fu[fid] = {done: {at: now, how: 'dropped'}}; await settleMirror(ctx, d.fu[fid], ''); }
    await mergeIndex(ctx, patch);
    await maybeCompact(ctx);
    return {pid, undo: () => mergeIndex(ctx, {people: {[pid]: {st: '', gone: null, up: Date.now()}}})};
  }
  const setMirror = (ctx, on) => can(live(ctx)) ? mergeIndex(live(ctx), {prefs: {mirror: !!on}}) : refuse();

  /* the pitch side of a settled follow-up: cleared, or moved to a new date, only while it still holds what was mirrored */
  async function settleMirror(ctx, f, moveTo) {
    if (!f || !f.mirror || !f.pi) return false;
    const patch = clearPlan(pitchOf(ctx, f.pi), f.mirror, moveTo);
    if (!patch) return false;
    await writePitch(ctx, f.pi, patch);
    return true;
  }
  /* the invariant: one open follow-up a person and one a pitch. The old one closes as 'moved' */
  async function closeOthers(ctx, d, pid, pi, keep, patch) {
    for (const fid of openFuOf(d, pid, pi)) {
      if (fid === keep) continue;
      patch.fu[fid] = {done: {at: Date.now(), how: 'moved'}};
      await settleMirror(ctx, d.fu[fid], '');
    }
  }
  /* {p?, pi?, x, d, t?, after?, said?, src, sid?} gives the fid. The bridge runs unless opts.mirror is false */
  async function setFollow(ctx, f, opts) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    if (!YMD.test(f.d || '')) throw new Error('a day is needed');
    opts = opts || {};
    const d = data(ctx);
    const fid = 'fu' + U.uid();
    const now = Date.now();
    const row = {p: f.p || '', pi: f.pi || '', x: cut(f.x, 200), d: f.d, t: f.t || '', after: f.after || '', said: cut(f.said, 60), src: f.src || 'form', at: now};
    if (f.sid) row.sid = f.sid;
    if (opts.mirror === false) row.nomirror = true;
    const patch = {fu: {[fid]: row}};
    await closeOthers(ctx, d, row.p, row.pi, fid, patch);
    const prevFu = Object.keys(patch.fu).filter(id => id !== fid).map(id => ({id, ...U.clone(d.fu[id])}));
    let bridged = null;
    if (row.pi && opts.mirror !== false && d.prefs.mirror !== false) {
      const plan = bridgePlan(ctx, pitchOf(ctx, row.pi), row, opts.what || '');
      if (plan.ok) { bridged = plan; patch.fu[fid].mirror = plan.mirror; }
      else if (plan.why && opts.out) opts.out.why = plan.why;
    }
    await mergeIndex(ctx, patch);
    if (bridged) {
      const before = pickFields(pitchOf(ctx, row.pi), bridged.patch);
      await writePitch(ctx, row.pi, bridged.patch);
      if (opts.out) opts.out.pitch = {id: row.pi, before, after: pickFields(bridged.patch, bridged.patch)};
    }
    if (opts.out) opts.out.prevFu = prevFu;
    return fid;
  }
  const pickFields = (src, like) => { const o = {}; for (const k of Object.keys(like || {})) if (k !== 'updated') o[k] = src && src[k] !== undefined ? src[k] : ''; return o; };
  async function done(ctx, fid, how) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const d = data(ctx);
    const f = d.fu[fid];
    if (!f || f.done) return null;
    const now = Date.now();
    await mergeIndex(ctx, {fu: {[fid]: {done: {at: now, how: how || 'done'}}}, ...(f.p && d.people[f.p] ? {people: {[f.p]: {last: {at: now, k: how === 'spoke' ? 'talk' : how === 'replied' ? 'reply' : 'done'}, up: now}}} : {})});
    await settleMirror(ctx, f, '');
    const t = await logTouch(ctx, {p: f.p, pi: f.pi, k: how === 'spoke' ? 'talk' : how === 'replied' ? 'reply' : 'done', x: f.x, at: now});
    await maybeCompact(ctx);
    return {fid, tid: t.tid, month: t.path, prev: U.clone(f)};
  }
  const drop = (ctx, fid) => done(ctx, fid, 'dropped');
  /* a new day and time: a new ring key, so it arms again */
  async function snooze(ctx, fid, to) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const d = data(ctx);
    const f = d.fu[fid];
    if (!f || f.done || !YMD.test((to && to.d) || '')) return null;
    const now = Date.now();
    const snz = (f.snz || []).concat([{from: f.d + (f.t ? 'T' + f.t : ''), to: to.d + (to.t ? 'T' + to.t : ''), at: now}]).slice(-SNZ_MAX);
    const patch = {d: to.d, t: to.t || '', snz};
    if (f.mirror && f.mirror.nextDate) {
      const moved = clearPlan(pitchOf(ctx, f.pi), f.mirror, to.d);
      if (moved) { await writePitch(ctx, f.pi, moved); patch.mirror = {...f.mirror, nextDate: to.d}; }
    }
    await mergeIndex(ctx, {fu: {[fid]: patch}});
    await logTouch(ctx, {p: f.p, pi: f.pi, k: 'snooze', x: f.x, at: now});
    return {fid, prev: {d: f.d, t: f.t || ''}};
  }
  /* the fix chips after a capture: a new day, with no snooze on record */
  async function redate(ctx, fid, to) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const f = data(ctx).fu[fid];
    if (!f || f.done || !YMD.test((to && to.d) || '')) return null;
    const patch = {d: to.d, t: to.t || f.t || '', said: cut(to.said != null ? to.said : f.said, 60), after: to.after || ''};
    if (f.mirror && f.mirror.nextDate) {
      const moved = clearPlan(pitchOf(ctx, f.pi), f.mirror, to.d);
      if (moved) { await writePitch(ctx, f.pi, moved); patch.mirror = {...f.mirror, nextDate: to.d}; }
    }
    await mergeIndex(ctx, {fu: {[fid]: patch}});
    return fid;
  }
  /* on: the date goes onto the pitch; off: it comes back, and this follow-up stays private from now on */
  async function bridge(ctx, fid, on) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const f = data(ctx).fu[fid];
    if (!f || f.done || !f.pi) return false;
    if (!on) {
      await settleMirror(ctx, f, '');
      await mergeIndex(ctx, {fu: {[fid]: {mirror: null, nomirror: true}}});
      return true;
    }
    const plan = bridgePlan(ctx, pitchOf(ctx, f.pi), f, '');
    if (!plan.ok) { if (plan.why) M.toast(plan.why); return false; }
    await mergeIndex(ctx, {fu: {[fid]: {mirror: plan.mirror, nomirror: null}}});
    await writePitch(ctx, f.pi, plan.patch);
    return true;
  }
  async function setMeet(ctx, m) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    if (!YMD.test((m && m.d) || '')) throw new Error('a day is needed');
    const mid = 'mt' + U.uid();
    const now = Date.now();
    await mergeIndex(ctx, {meet: {[mid]: {p: m.p || '', pi: m.pi || '', d: m.d, t: m.t || '', where: cut(m.where, 80), x: cut(m.x, 80), at: now}}});
    return mid;
  }
  async function doneMeet(ctx, mid, how) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const m = data(ctx).meet[mid];
    if (!m || m.done) return null;
    const now = Date.now();
    await mergeIndex(ctx, {meet: {[mid]: {done: {at: now}}}, ...(m.p && data(ctx).people[m.p] ? {people: {[m.p]: {last: {at: now, k: 'meet'}, up: now}}} : {})});
    if (how) await logTouch(ctx, {p: m.p, pi: m.pi, k: 'meet', x: how, at: now});
    return mid;
  }

  /* ---------- the shared side: where a pitch was sent ---------- */
  const sendsOf = pitch => Object.keys((pitch && pitch.sent) || {}).map(sid => ({sid, ...pitch.sent[sid]})).filter(r => r && r.at).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  const latestSend = pitch => sendsOf(pitch)[0] || null;
  function sendPatch(pitch, sid, row) {
    const sent = {[sid]: row};
    const have = sendsOf(pitch);
    for (const old of have.slice(SENT_MAX - 1)) sent[old.sid] = null;
    return {sent, updated: Date.now()};
  }
  async function addSend(ctx, pitchId, s) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const p = (await readDoc(ctx, 'pitches/' + pitchId)) || pitchOf(ctx, pitchId);
    if (!p) throw new Error('no such pitch');
    const sid = 'sd' + U.uid();
    await writePitch(ctx, pitchId, sendPatch(p, sid, {to: cut(s.to, 80), via: s.via || 'mail', what: cut(s.what, 60), link: cut(s.link, 300), at: Date.now(), by: ctx.uid, reply: '', replyAt: 0}));
    return sid;
  }
  /* '' | replied | later | no. A reply closes the viewer's own check-back on that pitch */
  async function setReply(ctx, pitchId, sid, reply) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const p = (await readDoc(ctx, 'pitches/' + pitchId)) || pitchOf(ctx, pitchId);
    if (!p) throw new Error('no such pitch');
    if (sid && p.sent && p.sent[sid]) await writePitch(ctx, pitchId, {sent: {[sid]: {reply: reply || '', replyAt: reply ? Date.now() : 0}}, updated: Date.now()});
    if (reply) await closeCheckBacks(ctx, pitchId);
    return true;
  }
  async function closeCheckBacks(ctx, pitchId) {
    const d = data(ctx);
    const patch = {fu: {}};
    for (const fid of openFuOf(d, '', pitchId)) if (d.fu[fid].src === 'sent') { patch.fu[fid] = {done: {at: Date.now(), how: 'replied'}}; await settleMirror(ctx, d.fu[fid], ''); }
    if (Object.keys(patch.fu).length) await mergeIndex(ctx, patch);
    return Object.keys(patch.fu);
  }

  /* ---------- compaction: one set() when the gone and the settled pile up ---------- */
  async function maybeCompact(ctx) {
    ctx = live(ctx);
    if (!can(ctx)) return false;
    const doc = ctx.priv && ctx.priv.prospects && ctx.priv.prospects.data;
    if (!doc) return false;
    const now = Date.now(), cut0 = now - SETTLED_DAYS * DAY, today = todayOf(now);
    const people = doc.people || {}, fu = doc.fu || {}, meet = doc.meet || {};
    const gone = Object.keys(people).filter(id => people[id] && people[id].gone);
    const oldFu = Object.keys(fu).filter(id => fu[id] && fu[id].done && Number(fu[id].done.at || 0) < cut0);
    const oldMeet = Object.keys(meet).filter(id => meet[id] && (meet[id].done || meet[id].d < today) && ist().at(meet[id].d, '00:00') < cut0);
    if (gone.length <= 100 && oldFu.length + oldMeet.length <= 200) return false;
    const next = {v: 1, people: {}, fu: {}, meet: {}, prefs: {mirror: true, ...(doc.prefs || {})}};
    const drop = new Set(gone);
    for (const id of Object.keys(people)) if (!drop.has(id)) next.people[id] = people[id];
    const dropFu = new Set(oldFu), dropMeet = new Set(oldMeet);
    for (const id of Object.keys(fu)) if (!dropFu.has(id)) next.fu[id] = fu[id];
    for (const id of Object.keys(meet)) if (!dropMeet.has(id)) next.meet[id] = meet[id];
    await ctx.W.set(path(ctx.uid), next);
    return true;
  }

  /* ---------- apply: one capture, one burst of writes, one receipt ---------- */
  const saySent = (r, who) => 'Sent the ' + r.sent.what + (who ? ' to ' + who : '') + '.';
  async function apply(ctx, r, preset, choices) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    if (!r) throw new Error('nothing to log');
    preset = preset || {};
    choices = choices || {};
    const d = data(ctx);
    const now = Date.now(), today = todayOf(now);
    const isWork = workOf(ctx);
    let w = r.when || null;
    if (choices.d) w = {ymd: choices.d, t: choices.t || (w && w.t) || '', said: choices.said != null ? choices.said : (w && w.said) || '', after: (w && w.after) || '', rolledFrom: ''};
    const whoWord = capWords(r.who) || capWords(r.org) || 'this';
    if (w && w.festival) return {ask: 'festival', festival: w.festival, say: 'Which day is ' + U.cap(w.festival) + ' this year?', chips: [], hold: [], undo: null};
    if (r.needDate && !w) return {ask: 'date', say: 'When should I remind you about ' + whoWord + '?', chips: [], hold: [], undo: null};
    const res = await resolve(ctx, r, {pitch: choices.pitch || preset.pitch, pid: choices.pid || preset.pid, cid: choices.cid || preset.cid});
    if (res.pitch.cands.length > 1) return {ask: 'pitch', cands: res.pitch.cands, say: 'Which ' + capWords(r.org) + ': ' + res.pitch.cands.map(c => c.brand).join(' or ') + '?', chips: [], hold: [], undo: null};
    if (res.person.cands.length > 1) return {ask: 'person', cands: res.person.cands, say: 'Which ' + capWords(r.who) + ': ' + res.person.cands.map(c => c.who + (c.role ? ', ' + c.role : c.org ? ' at ' + c.org : '')).join(' or ') + '?', chips: [], hold: [], undo: null};
    /* the pitch as stored now: another device, or a capture a moment ago, may have written a send row */
    const pitch = res.pitch.id ? (await readDoc(ctx, 'pitches/' + res.pitch.id)) || pitchOf(ctx, res.pitch.id) : null;
    const pi = pitch ? res.pitch.id : '';
    const brand = pitch ? (pitch.brand || 'the pitch') : capWords(r.org);
    const person = res.person;
    let pid = person.pid;
    const newPerson = !pid && !!(person.who || person.cid);
    if (newPerson) pid = 'pp' + U.uid();
    const prevPerson = pid && !newPerson ? U.clone(d.people[pid]) : null;
    const who = person.who || (prevPerson && prevPerson.who) || '';
    const org = person.org || (prevPerson && prevPerson.org) || brand;
    const k = r.kind === 'meet-plan' || r.kind === 'note' || !r.kind ? 'note' : r.kind;
    const undo = {k: 'pros', at: now, pid: pid || '', newPerson, prev: {person: prevPerson, fu: []}};
    const hold = [];
    const say = [];
    const noShared = !!choices.noShared;

    /* the person, in the private index */
    const patch = {people: {}, fu: {}, meet: {}};
    if (pid) patch.people[pid] = personPatch(ctx, pid, prevPerson, {cid: person.cid, oid: person.oid, who, org, role: person.role, pi, k, now});

    /* the shared send row */
    let sid = '';
    const sendRow = r.sent ? {to: person.cid || who || cut(r.sent.to, 80), via: VIA[r.kind] || 'mail', what: cut(r.sent.what, 60), link: '', at: now, by: ctx.uid, reply: '', replyAt: 0} : null;
    if (sendRow && pitch && !noShared) { sid = 'sd' + U.uid(); undo.sid = sid; }
    else if (sendRow && pitch) hold.push({k: 'send', label: 'Log the send on ' + brand + '?', detail: sendRow.what + (who ? ' to ' + who : ''), run: () => addSend(ctx, pi, sendRow)});
    else if (sendRow && r.org && !pitch) hold.push({k: 'pitch', label: 'Add ' + capWords(r.org) + ' to the pipeline?', detail: 'A new pitch, owned by you, with this send on it.',
      run: async () => { const id = U.uid(); await ctx.W.set('pitches/' + id, {brand: capWords(r.org), category: '', contact: person.cid || '', source: '', owner: ctx.uid, updated: Date.now(), stage: 'lead', stageAt: Date.now(), next: '', nextDate: '', project: '', lost: '', created: Date.now()}); await addSend(ctx, id, sendRow); if (pid) await mergeIndex(ctx, {people: {[pid]: {pi: uniq(((data(ctx).people[pid] || {}).pi || []).concat([id])).slice(-PI_MAX)}}}); return id; }});

    /* the follow-up: the date said, or a check-back after a send */
    let fid = '', fuRow = null;
    const wantFu = !choices.nofu && r.kind !== 'reply';
    if (wantFu && w && w.ymd) { fuRow = {p: pid, pi, x: nextText(r.said), d: w.ymd, t: w.t || '', after: w.after || '', said: cut(w.said, 60), src: choices.src || 'typed', at: now}; if (sid) fuRow.sid = sid; }
    else if (wantFu && sendRow && pitch && sid) {
      const days = PROPOSAL.test(sendRow.what) ? 5 : 3;
      fuRow = {p: pid, pi, x: 'Check ' + (who || 'they') + ' saw the ' + sendRow.what, d: when().workDay(today, days, isWork), t: '', after: '', said: '', src: 'sent', sid, at: now};
    }
    if (fuRow) {
      fid = 'fu' + U.uid();
      undo.fid = fid;
      patch.fu[fid] = fuRow;
      await closeOthers(ctx, d, pid, pi, fid, patch);
      undo.prev.fu = Object.keys(patch.fu).filter(id => id !== fid).map(id => ({id, ...U.clone(d.fu[id])}));
    }
    /* the meeting */
    let mid = '';
    if (r.kind === 'meet-plan' && r.meet && YMD.test(r.meet.d || '')) { mid = 'mt' + U.uid(); undo.mid = mid; patch.meet[mid] = {p: pid, pi, d: r.meet.d, t: r.meet.t || '', where: '', x: cut(r.said, 80), at: now}; }
    /* the reply closes the check-back */
    let replyPatch = null, replied = [];
    if (r.kind === 'reply' && pitch) {
      const ls = latestSend(pitch);
      if (ls && !noShared) { replyPatch = {sent: {[ls.sid]: {reply: r.reply || 'replied', replyAt: now}}}; undo.reply = {id: pi, sid: ls.sid, before: {reply: ls.reply || '', replyAt: ls.replyAt || 0}, after: {reply: r.reply || 'replied', replyAt: now}}; }
      else if (ls) hold.push({k: 'reply', label: 'Mark the ' + brand + ' send as ' + (r.reply === 'no' ? 'declined' : 'replied') + '?', detail: 'The team sees this.', run: () => setReply(ctx, pi, ls.sid, r.reply || 'replied')});
      for (const id of openFuOf(d, '', pi)) if (d.fu[id].src === 'sent') { patch.fu[id] = {done: {at: now, how: 'replied'}}; replied.push({id, ...U.clone(d.fu[id])}); }
      undo.prev.fu = undo.prev.fu.concat(replied);
    }
    /* the bridge: the date onto the pitch the viewer owns */
    let bridgePatch = null, bridgeWhy = '';
    const wantMirror = !!fuRow && !!pitch && d.prefs.mirror !== false && choices.mirror !== false && !noShared;
    if (fuRow && pitch) {
      const plan = bridgePlan(ctx, pitch, fuRow, sendRow ? sendRow.what : '');
      if (wantMirror && plan.ok) { bridgePatch = plan.patch; patch.fu[fid].mirror = plan.mirror; undo.pitch = {id: pi, before: pickFields(pitch, plan.patch), after: pickFields(plan.patch, plan.patch)}; }
      else if (!plan.ok) bridgeWhy = plan.why;
      else if (choices.mirror === false) patch.fu[fid].nomirror = true;
    }

    /* the burst: the index, the month log, the pitch */
    for (const key of ['people', 'fu', 'meet']) if (!Object.keys(patch[key]).length) delete patch[key];
    if (Object.keys(patch).length) await mergeIndex(ctx, patch);
    const t = await logTouch(ctx, {p: pid, pi, k, x: r.said, at: now, sid});
    undo.tid = t.tid; undo.month = t.path;
    if (pitch) {
      const pp = {};
      if (sid) Object.assign(pp, sendPatch(pitch, sid, sendRow));
      if (replyPatch) { pp.sent = {...(pp.sent || {}), ...replyPatch.sent}; pp.updated = now; }
      if (bridgePatch) Object.assign(pp, bridgePatch);
      if (Object.keys(pp).length) await writePitch(ctx, pi, pp);
      for (const id of replied) await settleMirror(ctx, id, '');
      /* a proposal or a quote went out and the stage is behind it */
      if (sendRow && PROPOSAL.test(sendRow.what) && ['lead', 'qualified', 'diagnostic'].indexOf(pitch.stage || 'lead') >= 0)
        hold.push({k: 'stage', label: 'Move ' + brand + ' to Proposal sent?', detail: 'The team sees the stage.', run: () => ctx.W.update('pitches/' + pi, {stage: 'proposal', stageAt: Date.now(), updated: Date.now()})});
    }
    await maybeCompact(ctx);

    /* the receipt */
    const whoAt = who ? who + (org ? ' at ' + org : '') : (org || '');
    if (r.kind === 'reply') say.push('Logged. ' + (brand || capWords(r.org)) + (r.reply === 'no' ? ' said no.' : r.reply === 'later' ? ' said later.' : ' replied.'));
    else if (r.kind === 'meet-plan') say.push('Logged. Meeting with ' + (whoAt || 'them') + ' on ' + label(r.meet.d, r.meet.t) + '. Kept in m360 only.');
    else if (VERB[r.kind]) say.push('Logged. ' + VERB[r.kind] + ' ' + (whoAt || 'them') + (sendRow ? ', ' + sendRow.what + ' sent' : '') + '.');
    else if (r.kind === 'sent' && sendRow) say.push('Logged. ' + saySent({sent: sendRow}, whoAt));
    else if (fuRow) say.push('Noted.');
    else say.push('Logged.');
    if (fuRow && fuRow.src === 'sent') say.push('I will remind you to check on ' + label(fuRow.d) + '.');
    else if (fuRow) say.push('I will remind you on ' + when().readBack({ymd: fuRow.d, t: fuRow.t, rolledFrom: w && w.rolledFrom}) + (fuRow.t ? '.' : ' at ' + DEFAULT_T + '.'));
    if (bridgePatch) say.push(brand + ' next step: ' + label(fuRow.d) + '.');
    else if (fuRow && bridgeWhy) say.push(bridgeWhy);
    if (!pitch && r.org && !sendRow && r.kind !== 'reply') hold.push({k: 'pitch', label: 'Add ' + capWords(r.org) + ' to the pipeline?', detail: 'A new pitch, owned by you.',
      run: async () => { const id = U.uid(); await ctx.W.set('pitches/' + id, {brand: capWords(r.org), category: '', contact: person.cid || '', source: '', owner: ctx.uid, updated: Date.now(), stage: 'lead', stageAt: Date.now(), next: '', nextDate: '', project: '', lost: '', created: Date.now()}); if (pid) await mergeIndex(ctx, {people: {[pid]: {pi: uniq(((data(ctx).people[pid] || {}).pi || []).concat([id])).slice(-PI_MAX)}}}); return id; }});

    /* the chips */
    const chips = [{k: 'undo', label: 'Undo', run: () => undoCapture(ctx, undo)}];
    if (fuRow) {
      const tmr = when().parse('tomorrow', Date.now(), isWork), nw = when().parse('next week', Date.now(), isWork);
      chips.push({k: 'tomorrow', label: 'Tomorrow', run: () => redate(ctx, fid, {d: tmr.ymd, said: 'tomorrow'})});
      chips.push({k: 'nextweek', label: 'Next week', run: () => redate(ctx, fid, {d: nw.ymd, said: 'next week'})});
      if (w && w.next && w.alt) chips.push({k: 'nearer', label: 'Make it ' + label(w.alt), run: () => redate(ctx, fid, {d: w.alt, said: when().DAYS[ist().dow(w.alt)]})});
      chips.push({k: 'pick', label: 'Pick a day', run: to => redate(ctx, fid, to)});
      chips.push({k: 'nofu', label: 'No follow-up', run: () => drop(ctx, fid)});
      if (bridgePatch) chips.push({k: 'private', label: 'Keep the date private', run: () => bridge(ctx, fid, false)});
    }
    if (pid && who && person.cid) chips.push({k: 'notperson', label: 'Not this ' + first(who), run: () => mergeIndex(ctx, {people: {[pid]: {cid: '', oid: '', up: Date.now()}}})});
    if (pid && who && !person.cid && !(prevPerson && prevPerson.cid)) chips.push({k: 'addbase', label: 'Add to the Base', detail: 'The team will see the name, title and company. Your notes stay with you.',
      run: async () => { if (!M.base || !M.base.upsertContact) return ''; const cid = await M.base.upsertContact(ctx, {['name']: who, title: person.role || '', orgName: org, source: 'manual'}); await mergeIndex(ctx, {people: {[pid]: {cid, up: Date.now()}}}); return cid; }});
    return {say: say.join(' '), chips, hold, undo, fid, pid, mid, sid, pitch: pi, bridged: !!bridgePatch};
  }

  /* the capture put back: the touch, the person, the follow-up, the send row and the pitch fields (only while
     they still hold what the capture wrote) */
  async function undoCapture(ctx, u) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    if (!u || u.k !== 'pros') return 'Nothing to undo.';
    if (u.tid && u.month) await ctx.W.merge(u.month, {t: {[u.tid]: null}});
    const patch = {};
    if (u.pid) {
      if (u.newPerson) patch.people = {[u.pid]: null};
      else if (u.prev && u.prev.person) { const p = u.prev.person; patch.people = {[u.pid]: {last: p.last || {at: p.at || 0, k: 'note'}, pi: p.pi || [], mo: p.mo || [], up: p.up || p.at || 0}}; }
    }
    if (u.fid || (u.prev && u.prev.fu && u.prev.fu.length)) {
      patch.fu = {};
      if (u.fid) patch.fu[u.fid] = null;
      for (const f of (u.prev && u.prev.fu) || []) { const {id, ...rest} = f; patch.fu[id] = {...rest, done: null}; }
    }
    if (u.mid) patch.meet = {[u.mid]: null};
    if (Object.keys(patch).length) await mergeIndex(ctx, patch);
    let kept = '';
    const pitchId = (u.pitch && u.pitch.id) || (u.reply && u.reply.id) || '';
    const cur = pitchOf(ctx, pitchId);
    if (cur) {
      const pp = {};
      if (u.sid && cur.sent && cur.sent[u.sid]) pp.sent = {[u.sid]: null};
      if (u.reply && cur.sent && cur.sent[u.reply.sid] && cur.sent[u.reply.sid].reply === u.reply.after.reply) pp.sent = {...(pp.sent || {}), [u.reply.sid]: {reply: u.reply.before.reply || '', replyAt: u.reply.before.replyAt || 0}};
      if (u.pitch) {
        const same = Object.keys(u.pitch.after).every(k2 => (cur[k2] === undefined ? '' : cur[k2]) === u.pitch.after[k2]);
        if (same) Object.assign(pp, u.pitch.before); else kept = (cur.brand || 'The pitch') + "'s next step changed since, so I left it.";
      }
      if (Object.keys(pp).length) { pp.updated = Date.now(); await writePitch(ctx, pitchId, pp); }
    }
    return 'Undone.' + (kept ? ' ' + kept : '');
  }
  /* undo for a done, a drop or a snooze: the row as it was */
  async function undoSettle(ctx, u) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    const f = data(ctx).fu[u.fid];
    if (!f) return 'Nothing to undo.';
    if (u.prev && u.prev.d && !u.prev.src) {
      /* a snooze: the day and time as they were, and the mirrored date back with them */
      const patch = {d: u.prev.d, t: u.prev.t || ''};
      if (f.mirror && f.pi) { const moved = clearPlan(pitchOf(ctx, f.pi), f.mirror, u.prev.d); if (moved) { await writePitch(ctx, f.pi, moved); patch.mirror = {...f.mirror, nextDate: u.prev.d}; } }
      await mergeIndex(ctx, {fu: {[u.fid]: patch}});
    } else {
      /* a done or a drop: open again, and the date back on the pitch where it was mirrored */
      const prev = u.prev || f;
      const patch = {done: null};
      if (prev.mirror && prev.pi) { const plan = bridgePlan(ctx, pitchOf(ctx, prev.pi), prev, ''); if (plan.ok) { patch.mirror = plan.mirror; await writePitch(ctx, prev.pi, plan.patch); } }
      await mergeIndex(ctx, {fu: {[u.fid]: patch}});
    }
    if (u.tid && u.month) await ctx.W.merge(u.month, {t: {[u.tid]: null}});
    return 'Undone.';
  }
  const undo = (ctx, u) => u && u.fid && !u.tid && !u.month && !u.pid ? undoSettle(ctx, u) : u && u.fid && u.prev && !u.k ? undoSettle(ctx, u) : undoCapture(ctx, u);

  /* ---------- views ---------- */
  function rowOf(ctx, d, fid, now) {
    const f = d.fu[fid];
    const p = f.p ? d.people[f.p] : null;
    const today = todayOf(now);
    return {fid, pid: f.p || '', who: p ? p.who : '', org: p ? p.org : (pitchOf(ctx, f.pi) || {}).brand || '', role: p ? p.role || '' : '', d: f.d, t: f.t || '', x: f.x, said: f.said || '', after: f.after || '', src: f.src || '',
      sid: f.sid || '', pi: f.pi || '', ringAt: ringAtOf(f), late: f.d < today ? when().lateDays(f.d, now) : 0, mirror: !!f.mirror, rang: !!f.rang, key: ringKey(fid, f)};
  }
  function meetRow(ctx, d, mid) {
    const m = d.meet[mid];
    const p = m.p ? d.people[m.p] : null;
    return {mid, pid: m.p || '', who: p ? p.who : '', org: p ? p.org : (pitchOf(ctx, m.pi) || {}).brand || '', d: m.d, t: m.t || '', where: m.where || '', x: m.x || '', pi: m.pi || '', ringAt: meetRingAt(m), key: meetKey(mid, m)};
  }
  const byDate = (a, b) => (a.d + (a.t || DEFAULT_T)).localeCompare(b.d + (b.t || DEFAULT_T));
  /* {late, today, meetings, week, waiting, loose, quiet, counts} */
  function day(ctx) {
    const d = data(ctx);
    const now = Date.now(), today = todayOf(now);
    const weekEnd = ist().add(today, 6);
    const out = {late: [], today: [], meetings: [], week: [], waiting: [], loose: [], quiet: [], quietTotal: 0, counts: {late: 0, today: 0, meetings: 0}};
    for (const fid of Object.keys(d.fu)) {
      const f = d.fu[fid];
      if (!isOpen(f) || !YMD.test(f.d || '')) continue;
      const r = rowOf(ctx, d, fid, now);
      if (f.d < today) out.late.push(r);
      else if (f.d === today) out.today.push(r);
      else if ((f.after && f.after >= today) || f.src === 'sent') out.waiting.push(r);
      else if (f.d <= weekEnd) out.week.push(r);
    }
    for (const mid of Object.keys(d.meet)) {
      const m = d.meet[mid];
      if (!m || m.done || !YMD.test(m.d || '') || m.d < today || m.d > weekEnd) continue;
      out.meetings.push(meetRow(ctx, d, mid));
    }
    const withFu = new Set(Object.keys(d.fu).filter(id => isOpen(d.fu[id])).map(id => d.fu[id].p).filter(Boolean));
    const withMeet = new Set(Object.keys(d.meet).filter(id => d.meet[id] && !d.meet[id].done).map(id => d.meet[id].p).filter(Boolean));
    const quiet = [];
    for (const pid of Object.keys(d.people)) {
      const p = d.people[pid];
      if (!p || p.gone || p.st === 'done' || withFu.has(pid) || withMeet.has(pid)) continue;
      const last = Number((p.last || {}).at || 0);
      const row = {pid, who: p.who, org: p.org, role: p.role || '', last, pi: p.pi || []};
      if (last >= now - LOOSE_DAYS * DAY) out.loose.push(row);
      else quiet.push(row);
    }
    out.late.sort(byDate); out.today.sort(byDate); out.week.sort(byDate); out.waiting.sort(byDate); out.meetings.sort(byDate);
    out.loose.sort((a, b) => b.last - a.last);
    quiet.sort((a, b) => b.last - a.last);
    out.quietTotal = quiet.length;
    out.quiet = quiet.slice(0, 5);
    out.counts = {late: out.late.length, today: out.today.length, meetings: out.meetings.length};
    return out;
  }
  /* the follow-up and the meeting rows, due now or late: silent inbox items, hot when late */
  function inboxItems(ctx) {
    const d = data(ctx);
    const now = Date.now(), today = todayOf(now);
    const out = [];
    for (const fid of Object.keys(d.fu)) {
      const f = d.fu[fid];
      if (!isOpen(f) || !YMD.test(f.d || '')) continue;
      const at = ringAtOf(f);
      if (at === null || now < at) continue;
      const r = rowOf(ctx, d, fid, now);
      const whoLine = r.who ? 'Follow up with ' + r.who + (r.org ? ' at ' + r.org : '') : (r.x || 'A reminder');
      const line = whoLine + '.' + (r.said ? ' You said ' + r.said + '.' : '') + (r.late ? ' ' + r.late + (r.late === 1 ? ' day' : ' days') + ' late, since ' + label(f.d) + '.' : '');
      out.push({id: 'fu:' + fid + ':' + f.d, at, line, ref: r.pid ? '#prospects/' + r.pid : '#prospects', hot: r.late > 0, pi: f.pi || '', pid: r.pid, fid, late: r.late, silent: true});
    }
    for (const mid of Object.keys(d.meet)) {
      const m = d.meet[mid];
      if (!m || m.done || m.d !== today) continue;
      const at = meetRingAt(m);
      if (at === null || now < at) continue;
      const r = meetRow(ctx, d, mid);
      out.push({id: 'mt:' + mid + ':' + m.d, at, line: 'Meeting with ' + (r.who || 'them') + (r.org ? ' at ' + r.org : '') + (m.t ? ', ' + m.t : ', today') + '.', ref: r.pid ? '#prospects/' + r.pid : '#prospects', hot: false, pi: m.pi || '', pid: r.pid, mid, silent: true});
    }
    return out.sort((a, b) => b.at - a.at);
  }
  function searchRows(ctx, q) {
    const d = data(ctx);
    const s = String(q || '').trim().toLowerCase();
    if (!s || !d || ctx.viewAs) return [];
    const out = [];
    for (const pid of Object.keys(d.people)) {
      const p = d.people[pid];
      if (!p || p.gone) continue;
      const fid = openFuOf(d, pid, '')[0];
      const next = fid ? d.fu[fid].x || '' : '';
      const blob = [p.who, p.org, p.role, next].join(' ').toLowerCase();
      if (blob.indexOf(s) < 0) continue;
      out.push({pid, who: p.who, org: p.org, role: p.role || '', next, hash: '#prospects/' + pid, status: statusOf(ctx, pid)});
    }
    return out.slice(0, 12);
  }
  function useMonth(ym) {
    const ctx = M.useCtx();
    const on = !!(ctx && ctx.uid && !ctx.viewAs && ctx.db && ym);
    const a = M.useDoc(ctx && ctx.db, on ? month(ctx.uid, ym) : null);
    const b = M.useDoc(ctx && ctx.db, on ? month(ctx.uid, ym) + '-2' : null);
    return useMemo(() => ({ready: !on || (a.ready && b.ready), t: {...((a.data || {}).t || {}), ...((b.data || {}).t || {})}}), [on, a, b]);
  }
  /* every touch of one person, newest first, across the months the index lists */
  async function loadMonths(ctx, pid) {
    const p = personOf(ctx, pid);
    if (!p || !can(ctx)) return [];
    const months = uniq((p.mo || []).concat([todayOf(Date.now()).slice(0, 7)])).sort().reverse();
    const out = [];
    for (const ym of months) {
      for (const suffix of ['', '-2']) {
        const doc = await readDoc(ctx, month(ctx.uid, ym) + suffix);
        const t = (doc && doc.t) || {};
        for (const tid of Object.keys(t)) if (t[tid] && t[tid].p === pid) out.push({tid, ym, ...t[tid]});
      }
    }
    return out.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  }
  /* the index and the month logs, as a file the Import card reads back */
  async function exportMine(ctx) {
    ctx = live(ctx);
    if (!can(ctx)) return refuse();
    if (!ctx.downloads) throw new Error('Downloads are unavailable here.');
    const doc = (ctx.priv && ctx.priv.prospects && ctx.priv.prospects.data) || {v: 1, people: {}, fu: {}, meet: {}, prefs: {mirror: true}};
    const docs = {prospects: doc};
    const months = new Set([todayOf(Date.now()).slice(0, 7)]);
    for (const pid of Object.keys(doc.people || {})) for (const ym of (doc.people[pid].mo || [])) months.add(ym);
    for (const ym of Array.from(months).sort()) for (const suffix of ['', '-2']) { const m = await readDoc(ctx, month(ctx.uid, ym) + suffix); if (m) docs['prospects.' + ym + suffix] = m; }
    const out = {app: 'm360 OS', exported: new Date().toISOString(), colls: {['data/users/' + ctx.uid]: {docs}}};
    return ctx.downloads.save({filename: 'm360-prospects-' + todayOf(Date.now()) + '.json', data: JSON.stringify(out, null, 2)});
  }

  /* ---------- the watcher: the card on the day, once per device ---------- */
  const devId = () => { let v = M.prefs.get('dev', ''); if (!v) { v = Math.random().toString(36).slice(2, 8); M.prefs.set('dev', v); } return v; };
  const RANG = u => 'fuRang.' + u;
  const rangList = u => { try { return JSON.parse(M.prefs.get(RANG(u), '[]')) || []; } catch (e) { return []; } };
  const rangMark = (u, keys) => { M.prefs.set(RANG(u), JSON.stringify(uniq(rangList(u).concat(keys)).slice(-400))); };
  const minsIst = ms => { const d = new Date(ms + 330 * MIN); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  /* what is due now: open follow-ups and meetings for today whose ring time has come and that no device has rung */
  function dueNow(ctx, nowMs) {
    const d = data(ctx);
    const today = todayOf(nowMs);
    const isWork = workOf(ctx);
    const inSpan = minsIst(nowMs) >= QUIET_FROM && minsIst(nowMs) < QUIET_TO;
    const out = [];
    for (const fid of Object.keys(d.fu)) {
      const f = d.fu[fid];
      if (!isOpen(f) || f.d !== today) continue;
      const at = ringAtOf(f);
      if (at === null || nowMs < at) continue;
      /* a default time keeps to the day's span and to working days; a time the person said is kept as given */
      if (!f.t && (!inSpan || !isWork(f.d))) continue;
      const key = ringKey(fid, f);
      if (f.rang && f.rang.k === key) continue;
      out.push({kind: 'fu', id: fid, key, at, row: rowOf(ctx, d, fid, nowMs)});
    }
    for (const mid of Object.keys(d.meet)) {
      const m = d.meet[mid];
      if (!m || m.done || m.d !== today) continue;
      const at = meetRingAt(m);
      if (at === null || nowMs < at) continue;
      const key = meetKey(mid, m);
      if (m.rang && m.rang.k === key) continue;
      out.push({kind: 'mt', id: mid, key, at, row: meetRow(ctx, d, mid)});
    }
    return out;
  }
  /* open follow-ups from earlier days that never rang anywhere: the ones missed while m360 was closed */
  function missed(ctx, nowMs) {
    const d = data(ctx);
    const today = todayOf(nowMs);
    return Object.keys(d.fu).filter(fid => { const f = d.fu[fid]; return isOpen(f) && YMD.test(f.d || '') && f.d < today && !f.rang; }).map(fid => ({kind: 'fu', id: fid, row: rowOf(ctx, d, fid, nowMs)}));
  }
  const namesOf = rows => { const ws = rows.map(r => r.who ? r.who + (r.org ? ' at ' + r.org : '') : (r.x || 'a reminder')); return ws.length <= 3 ? ws.slice(0, -1).join(', ') + (ws.length > 1 ? ' and ' : '') + ws[ws.length - 1] : ws.slice(0, 2).join(', ') + ' and ' + (ws.length - 2) + ' more'; };
  function cardFor(items) {
    const one = items[0].row;
    if (items.length === 1) {
      if (items[0].kind === 'mt') return {title: 'Meeting with ' + (one.who || 'them'), body: (one.org ? one.org + ', ' : '') + (one.t ? one.t : 'today') + (one.where ? ', ' + one.where : '') + '.', href: one.pid ? '#prospects/' + one.pid : '#prospects'};
      return {title: one.who ? 'Follow up with ' + one.who : 'A reminder', body: (one.org ? one.org + '. ' : '') + (one.said ? 'You said ' + one.said + '.' : one.x || ''), href: one.pid ? '#prospects/' + one.pid : '#prospects'};
    }
    return {title: items.length + ' follow-ups today', body: namesOf(items.map(x => x.row)) + '.', href: '#prospects'};
  }
  let lead = null;
  function FollowWatch() {
    const ctx = M.useCtx();
    const me = useRef({});
    useEffect(() => { if (!lead) lead = me.current; return () => { if (lead === me.current) lead = null; }; }, []);
    const ref = useRef(ctx);
    ref.current = ctx;
    const seen = useRef(new Map());
    const doc = ctx && ctx.priv && ctx.priv.prospects;
    const pass = async () => {
      const c = ref.current;
      if (!lead) lead = me.current;
      if (lead !== me.current || !c || !c.uid || c.viewAs || !ready(c) || !M.when || !M.notices) return;
      /* a focus timer holds the ring until it ends */
      if (M.focus && M.focus.get && M.focus.get()) return;
      const uid = c.uid;
      const run = async () => {
        const now = Date.now(), today = todayOf(now), nowP = performance.now();
        const marks = new Set(rangList(uid));
        /* the catch-up: the first open on a later day lists what was missed while m360 was closed, once a day a device */
        const catchKey = 'fuCatch.' + uid;
        if (c.priv.prospects.data && M.prefs.get(catchKey, '') !== today) {
          M.prefs.set(catchKey, today);
          const miss = missed(c, now).filter(x => !marks.has('fu:catch:' + x.id));
          if (miss.length) {
            rangMark(uid, miss.map(x => 'fu:catch:' + x.id));
            const days = uniq(miss.map(x => when().dayName(x.row.d)));
            const from = days.length === 1 ? 'from ' + days[0] : 'from the last few days';
            M.notices.push({key: 'fu:catch@' + today, title: miss.length === 1 ? 'A follow-up ' + from + ' is waiting' : miss.length + ' follow-ups ' + from + ' are waiting', body: namesOf(miss.map(x => x.row)) + '.',
              href: miss.length === 1 && miss[0].row.pid ? '#prospects/' + miss[0].row.pid : '#prospects', icon: 'bell', life: 60000, hidden: 'Follow-ups are waiting', away: {title: 'Follow-ups are waiting', body: 'Open m360 to see who.'}});
            M.sound.play('soft');
            const fu = {};
            for (const x of miss) fu[x.id] = {rang: {k: 'catch@' + today, at: now, dev: devId()}};
            c.W.merge(path(uid), {v: 1, fu}).catch(() => { /* the next pass, or the next device */ });
          }
        }
        const due = dueNow(c, now).filter(x => !marks.has(x.key));
        for (const x of due) if (!seen.current.has(x.key)) seen.current.set(x.key, nowP);
        /* a hidden tab must see a key due on two passes, so a visible device wins */
        const ring = document.hidden ? due.filter(x => nowP - seen.current.get(x.key) >= PASS - 50) : due;
        if (!ring.length) return;
        /* the mark first, then the card, then the index: once per device whatever happens in between */
        rangMark(uid, ring.map(x => x.key));
        const card = cardFor(ring);
        M.notices.push({key: ring[0].key, ...card, icon: 'bell', life: 60000, hidden: 'A follow-up is due',
          away: {title: ring.length === 1 ? 'A follow-up is due' : 'Follow-ups are due', body: 'Open m360 to see who.'}});
        M.sound.play('soft');
        const patch = {};
        for (const x of ring) { const key = x.kind === 'fu' ? 'fu' : 'meet'; patch[key] = patch[key] || {}; patch[key][x.id] = {rang: {k: x.key, at: now, dev: devId()}}; }
        c.W.merge(path(uid), {v: 1, ...patch}).catch(() => { /* the mark on this device still holds */ });
      };
      try {
        if (navigator.locks && typeof navigator.locks.request === 'function') await navigator.locks.request('m360-fu-' + uid, {ifAvailable: true}, lock => lock ? run() : null);
        else await run();
      } catch (e) { /* the watcher never breaks the page */ }
    };
    const busy = useRef(false);
    const go = () => { if (busy.current) return; busy.current = true; pass().catch(() => {}).then(() => { busy.current = false; }); };
    useEffect(() => {
      const t = setInterval(go, PASS);
      const vis = () => go();
      document.addEventListener('visibilitychange', vis);
      const unFocus = M.focus && M.focus.subscribe ? M.focus.subscribe(() => setTimeout(go, 50)) : null;
      M.prospects._go = go;
      return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); if (unFocus) unFocus(); if (M.prospects._go === go) M.prospects._go = null; };
    }, []);
    /* a pass on the index arriving or changing */
    useEffect(() => { go(); }, [doc && doc.ready, doc && doc.data, ctx && ctx.uid, ctx && ctx.viewAs]);
    return null;
  }

  M.parts.FollowWatch = FollowWatch;
  M.prospects = {
    PASS, DEFAULT_T, path, month, data, ready,
    read, isCapture, resolve, apply, undo,
    addPerson, track, stopTracking, setMirror,
    setFollow, done, snooze, drop, bridge, redate,
    setMeet, doneMeet, logTouch, addSend, setReply, closeCheckBacks,
    day, personOf, byCid, byPitch, statusOf, useMonth, loadMonths, sendsOf, latestSend, inboxItems, searchRows, exportMine,
    ringAt: ringAtOf, meetRingAt, ringKey, meetKey, dueNow, missed, bridgePlan, whoOrg, compact: maybeCompact,
    ring: () => { if (M.prospects._go) M.prospects._go(); }, _go: null
  };
})();
