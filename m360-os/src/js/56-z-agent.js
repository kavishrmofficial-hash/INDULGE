/* module: agent. The 360 actions: one registry of everything the buddy, Ask m360, the palette and the
   voice can do, who may do each, and how each runs. "now" runs at once (touches only you, or one
   message to one person) with Undo in the receipt; "tap" waits on one tap or one spoken yes (two or
   more people, settings, the roster, rules, holidays, decisions, bulk changes, the bin); "never" is
   only pointed at. Every run goes through the screen's own write path (ctx.W), and rights are
   checked again at run time against the live roster, so voice can do what the person's own hand
   could and nothing more. A small local grammar turns the common sentences ("flag the people who
   have not checked out and ask them why") into actions with no model call, which keeps voice working
   when the AI is off. Asks to people ride the personal managers' pipes (M.pm), with the same keys,
   caps and quiet hours. Each person's runs land in a private ledger (data/users/<uid>/agent, the
   last 200), listed under History with Undo where it still applies. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;

  const MIN = 60000;
  const AGENT_DEF = {on: true, bulkMax: 12, perSenderDay: 40, spokenYes: true, pressConfirmed: true};
  M.SETTINGS_DEFAULTS.agent = M.SETTINGS_DEFAULTS.agent || {...AGENT_DEF};
  const clampN = (n, a, b, d) => { const x = Math.round(Number(n)); return Number.isFinite(x) && String(n) !== '' && n != null ? Math.max(a, Math.min(b, x)) : d; };
  /* settings.agent, deep merged with its defaults and held to its floors and ceilings */
  function conf(ctx) {
    const s = (ctx && ctx.settings && ctx.settings.agent) || {};
    return {...AGENT_DEF, ...s, on: s.on !== false, spokenYes: s.spokenYes !== false, pressConfirmed: s.pressConfirmed !== false,
      bulkMax: clampN(s.bulkMax, 1, 25, AGENT_DEF.bulkMax), perSenderDay: clampN(s.perSenderDay, 1, 200, AGENT_DEF.perSenderDay)};
  }

  const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
  const norm = s => String(s || '').toLowerCase().trim();
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const ymdOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const hmOk = s => /^\d{1,2}:\d{2}$/.test(String(s || '').trim()) && U.minutes(String(s).trim()) < 1440;
  const today = () => U.todayStr();
  const dayAt = (ymd, hm) => U.parseYmd(ymd).getTime() + U.minutes(hm) * MIN;
  const nameOf = (nm, uid) => (nm && nm[uid]) || 'someone';
  const firstOf = (nm, uid) => String(nameOf(nm, uid)).split(' ')[0];
  const andList = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const WORDS = ['Nobody', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const people = n => n ? (WORDS[n] || String(n)) + (n === 1 ? ' person' : ' people') : 'Nobody';
  const meDoc = (ctx, uid) => (((ctx.coll.me || {}).map || {})[uid]) || {};
  /* the page as it is now: a card tapped minutes after it was made reads and writes today's data */
  const fresh = ctx => M.lastCtx && M.lastCtx.uid === ctx.uid && !M.lastCtx.viewAs === !ctx.viewAs ? M.lastCtx : ctx;

  /* names: the caller usually has them (M.ai.names); the grammar keeps the last set for a sentence
     that arrives without them */
  let nmCache = {};
  async function names(ctx) {
    try { const n = await M.ai.names(ctx); if (n && Object.keys(n).length) nmCache = n; } catch (e) { /* the cache stands */ }
    return nmCache;
  }
  const namesNow = (ctx, nm) => {
    if (nm && Object.keys(nm).length) { nmCache = nm; return nm; }
    if (ctx && ctx.user) names(ctx);
    return nmCache;
  };

  /* a teammate by name, never a guess: two people with that first name ask "Which Shreya" */
  function member(ctx, nm, typed) {
    const q = String(typed || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return M.ai.findMember(ctx, nm, typed);
    const full = (ctx.activeMembers || []).filter(m => String(nm[m.uid] || '').toLowerCase() === q);
    if (full.length === 1) return full[0].uid;
    const same = (ctx.activeMembers || []).filter(m => m.uid !== ctx.uid && String(nm[m.uid] || '').toLowerCase().split(/\s+/)[0] === q);
    if (same.length > 1) throw new Error('which ' + capFirst(q) + ': ' + andList(same.map(m => String(nm[m.uid]))).replace(/ and ([^,]+)$/, ' or $1') + '?');
    return M.ai.findMember(ctx, nm, typed);
  }

  /* ---------- rights ---------- */
  const managerOf = (ctx, u) => M.lines ? M.lines.managerOf(ctx, u) : (u === ctx.founderUid ? null : ctx.founderUid);
  const chainOf = (ctx, u) => M.lines ? M.lines.chainOf(ctx, u) : (u === ctx.founderUid ? [] : [ctx.founderUid]);
  const reportsOf = (ctx, u) => M.lines ? M.lines.reportsOf(ctx, u) : [];
  const leads = ctx => !!ctx.isFounder || (!!M.lines && M.lines.isManager(ctx, ctx.uid));
  /* line: the founder, or the viewer is somewhere above them; mgr: the founder or their direct manager */
  const inLine = (ctx, u) => !!u && u !== ctx.uid && !!ctx.members[u] && (!!ctx.isFounder || chainOf(ctx, u).indexOf(ctx.uid) >= 0);
  const isMgr = (ctx, u) => !!u && u !== ctx.uid && !!ctx.members[u] && (!!ctx.isFounder || (ctx.canSee(u) && managerOf(ctx, u) === ctx.uid));
  /* attendance and quiet are private detail: the direct manager or the founder; task kinds: anyone up the line */
  const ATT = ['noin', 'noout', 'noeod', 'late', 'quiet', 'idle'];
  const mayAsk = (ctx, kind, u) => ATT.indexOf(kind) >= 0 ? isMgr(ctx, u) : inLine(ctx, u);
  const NOT_TEAM = 'not in your team';

  function allowed(ctx, a) {
    if (a.wave && !conf(ctx).on) return false;
    if (a.needs === 'pm' && !(M.pm && M.pm.ask)) return false;
    if (a.needs === 'coo' && !M.coo) return false;
    switch (a.who) {
      case 'line': case 'mgr': return leads(ctx);
      case 'founder': return !!ctx.isFounder;
      case 'owner': return !!ctx.isOwner;
      case 'site': return live();
      default: return true;
    }
  }
  const refusal = a => a.needs === 'coo' && !M.coo ? 'the m360 COO is not on this page yet'
    : a.who === 'founder' ? 'only the founder can do that (' + a.name + ')'
    : a.who === 'owner' ? 'that is the owner\'s alone'
    : a.who === 'site' ? a.name + ' works on the team site only'
    : a.who === 'line' || a.who === 'mgr' ? 'that is for managers, about their own team'
    : a.wave && a.needs === 'pm' ? 'asks arrive with the personal managers, which are not on this page yet' : 'that is switched off here';

  /* ---------- the conditions people_where and the asks read ---------- */
  const COND = {
    noout: {why: 'why they haven\'t checked out', eta: 'when they will check out', about: 'checking out', many: n => people(n) + (n === 1 ? ' is' : ' are') + ' still checked in'},
    noin: {why: 'why they haven\'t checked in', eta: 'when they will be in', about: 'checking in', many: n => people(n) + (n === 1 ? ' has' : ' have') + ' not checked in'},
    noeod: {why: 'why their EOD line is missing', eta: 'when their EOD line will be in', about: 'their EOD line', many: n => people(n) + (n === 1 ? ' has' : ' have') + ' no EOD line yet'},
    overdue: {why: 'why their work is overdue', eta: 'when their overdue work will be in', about: 'their overdue work', many: n => people(n) + (n === 1 ? ' has' : ' have') + ' overdue work'},
    quiet: {why: 'what they are on', eta: 'what they are on', about: 'their quiet stretch', many: n => people(n) + (n === 1 ? ' has' : ' have') + ' gone quiet on m360'},
    idle: {why: 'what is holding their tasks up', eta: 'when their tasks will move', about: 'their tasks', many: n => people(n) + (n === 1 ? ' has' : ' have') + ' not moved a task today'},
    late: {why: 'why they came in late', eta: 'why they came in late', about: 'coming in late', many: n => people(n) + ' came in late'}
  };
  const CONDS = Object.keys(COND);

  /* the last thing a person saved today, from the quiet engine's marks (the check-in itself aside) */
  function lastSave(ctx, uid, ymd) {
    if (!M.quiet || !M.quiet.marks) return null;
    let at = null;
    /* a save marks its five-minute bucket from where it starts; a focus session counts to its end */
    for (const m of M.quiet.marks(ctx, uid, ymd)) { if (m.k === 'in' || m.k === 'out') continue; const t = m.k === 'f' ? m.e : m.s; if (!at || t > at) at = t; }
    return at;
  }
  const workPage = p => !!p && ['break', 'play', 'reset', 'care', 'music', 'reflect'].indexOf(String(p)) < 0;
  /* a leave request still waiting on a decision that covers the day */
  const leaveAsked = (ctx, uid, ymd) => {
    const reqs = (((ctx.coll.leave || {}).map || {})[uid] || {}).reqs || [];
    const dec = ((((ctx.coll.leavedec || {}).map || {})[uid] || {}).d) || {};
    return reqs.some(r => r && r.from && r.to && !dec[r.id] && r.from <= ymd && ymd <= r.to);
  };
  const statusToday = (ctx, uid, ymd) => { const s = meDoc(ctx, uid).status; return s && s.at && s.text && U.ymd(new Date(s.at)) === ymd ? String(s.text) : ''; };
  /* someone else already asked this person about this today: "Kaavish already asked at 20:41" */
  function askedBy(ctx, nm, uid, kind, ymd) {
    const map = (ctx.coll.me || {}).map || {};
    for (const x of Object.keys(map)) {
      if (x === ctx.uid) continue;
      const asks = ((map[x] || {}).pm || {}).asks || {};
      for (const id of Object.keys(asks)) {
        const a = asks[id];
        if (a && !a.withdrawn && a.kind === kind && Array.isArray(a.to) && a.to.indexOf(uid) >= 0 && U.ymd(new Date(a.showAt || a.at || 0)) === ymd) return firstOf(nm, x) + ' already asked at ' + U.hhmm(a.at);
      }
    }
    return '';
  }
  /* a covering answer to the personal manager: an eta still ahead, or a date not yet passed */
  function coveredBy(ctx, uid, kind, now) {
    if (!M.pm || !M.pm.items) return '';
    let items = [];
    try { items = M.pm.items(ctx, uid, {now}) || []; } catch (e) { return ''; }
    const it = items.find(i => i && i.kind === kind && i.ack && i.ack.how === 'onit');
    if (!it) return '';
    const eta = it.ack.eta;
    if (typeof eta === 'number' && eta > now) return 'said on it, by ' + U.hhmm(eta);
    if (ymdOk(eta) && eta >= U.ymd(new Date(now))) return 'said on it, by ' + U.fmtDay(eta);
    return '';
  }

  /* who matches a condition right now: deterministic, with every exclusion and its reason.
     scope is 'everyone' (the founder: everyone; a manager: their line), 'myteam' (direct reports) or
     names. Returns {condition, match: [{uid, facts, line, on, off?, sub?}], left: [{uid, why}], warn} */
  function peopleWhere(ctx, o, nm) {
    o = o || {};
    nm = namesNow(ctx, nm);
    const condition = CONDS.indexOf(o.condition) >= 0 ? o.condition : null;
    const now = Number(o.now) || Date.now();
    const ymd = U.ymd(new Date(now));
    const res = {condition, scope: o.scope || 'everyone', match: [], left: [], warn: '', ymd};
    if (!condition) return res;
    const others = ctx.activeMembers.map(m => m.uid).filter(u => u !== ctx.uid);
    let pool;
    const sc = Array.isArray(o.scope) ? o.scope : norm(o.scope || 'everyone');
    if (Array.isArray(sc) || (typeof sc === 'string' && ['everyone', 'everybody', 'all', 'team', 'the team', 'myteam', 'my team', 'reports', ''].indexOf(sc) < 0)) {
      const list = Array.isArray(sc) ? sc : String(o.scope).split(/\s*(?:,|\band\b)\s*/);
      pool = [];
      for (const n of list) {
        const u = ctx.members[n] ? n : member(ctx, nm, n);
        if (!u || u === ctx.uid) { if (String(n || '').trim()) res.left.push({uid: null, name: String(n).trim(), why: 'no teammate by that name'}); continue; }
        if (pool.indexOf(u) < 0) pool.push(u);
      }
    } else if (sc === 'myteam' || sc === 'my team' || sc === 'reports') pool = reportsOf(ctx, ctx.uid);
    else if (ctx.isFounder) pool = others;
    else if (leads(ctx)) pool = others.filter(u => inLine(ctx, u));
    else pool = others;
    const S = ctx.settings || {};
    const cutM = U.minutes(String(S.eodCut || '19:30'));
    const d0 = U.parseYmd(ymd).getTime();
    const mins = (now - d0) / MIN;
    for (const uid of pool) {
      const m = ctx.members[uid];
      if (!m || m.active === false) continue;
      if (!mayAsk(ctx, condition, uid)) { res.left.push({uid, why: NOT_TEAM}); continue; }
      const a = M.att ? M.att.dayStatus(ctx, uid, ymd) : {status: 'none'};
      if (a.status === 'leave') { res.left.push({uid, why: 'on leave'}); continue; }
      if (a.status === 'holiday') { res.left.push({uid, why: 'a holiday'}); continue; }
      if (a.status === 'sunday') { res.left.push({uid, why: 'Sunday'}); continue; }
      const startHm = String(ctx.startFor(uid) || S.start || '10:30');
      let facts = '', sub = '';
      if (condition === 'noout') {
        if (!a.in) { res.left.push({uid, why: 'not in today'}); continue; }
        if (a.out) { res.left.push({uid, why: 'checked out at ' + U.hhmm(a.out)}); continue; }
        const ls = lastSave(ctx, uid, ymd);
        /* a save in the last quarter hour is named once, in the reason it stays unticked */
        facts = 'in ' + U.hhmm(a.in) + (ls && now - ls <= 15 * MIN ? '' : ', ' + (ls ? (now - ls >= 120 * MIN ? 'nothing saved since ' + U.hhmm(ls) : 'last save ' + U.hhmm(ls)) : 'nothing saved since the check-in'));
      } else if (condition === 'noin') {
        if (a.in) { res.left.push({uid, why: 'checked in at ' + U.hhmm(a.in)}); continue; }
        facts = 'no check-in, start ' + startHm;
      } else if (condition === 'noeod') {
        const e = (((ctx.coll.eod.map[uid] || {}).days) || {})[ymd];
        if (e) { res.left.push({uid, why: 'EOD posted' + (e.at ? ' at ' + U.hhmm(e.at) : '')}); continue; }
        facts = a.in ? 'in ' + U.hhmm(a.in) + ', no EOD line yet' : 'no check-in and no EOD line';
      } else if (condition === 'overdue') {
        const over = Object.keys(ctx.coll.tasks.map).map(id => ({id, ...ctx.coll.tasks.map[id]}))
          .filter(t => t && !t.deleted && t.owner === uid && t.status !== 'done' && t.due && t.due < ymd).sort((x, y) => x.due < y.due ? -1 : 1);
        if (!over.length) { res.left.push({uid, why: 'nothing overdue'}); continue; }
        sub = over[0].id;
        facts = over.length + ' overdue: ' + over.slice(0, 2).map(t => cut(t.title, 40)).join(', ') + (over.length > 2 ? ' and ' + (over.length - 2) + ' more' : '');
      } else if (condition === 'quiet') {
        const q = M.quiet ? M.quiet.day(ctx, uid, ymd, {now}) : null;
        if (!q || q.pending) { res.left.push({uid, why: 'still loading'}); continue; }
        if (!q.live) { const ls = lastSave(ctx, uid, ymd); res.left.push({uid, why: a.in ? (ls ? 'saved at ' + U.hhmm(ls) : 'not quiet') : 'not in today'}); continue; }
        facts = M.quiet.line(q.live);
      } else if (condition === 'idle') {
        if (!a.in) { res.left.push({uid, why: 'not in today'}); continue; }
        const at = Math.max(now, d0 + (14 * 60 + 1) * MIN);
        const f = M.lines ? M.lines.watch(ctx, uid, at).find(x => x.k === 'idle') : null;
        if (!f) { res.left.push({uid, why: 'moved a task today'}); continue; }
        facts = f.text;
      } else if (condition === 'late') {
        if (!a.in) { res.left.push({uid, why: 'not in today'}); continue; }
        if (!a.late) { res.left.push({uid, why: 'on time, in at ' + U.hhmm(a.in)}); continue; }
        facts = 'in at ' + U.hhmm(a.in) + ', start ' + startHm;
      }
      /* working right now, a status set today, or an answer that covers it: unticked, with the reason */
      let off = '';
      if (condition === 'noout' || condition === 'quiet') {
        const ls = lastSave(ctx, uid, ymd);
        if (ls && now - ls <= 15 * MIN) off = 'still working, saved ' + U.hhmm(ls);
        else if (ctx.online && ctx.online[uid] && workPage(ctx.online[uid].page)) off = 'online now';
      }
      const st = statusToday(ctx, uid, ymd);
      if (!off && st) off = 'status: ' + cut(st, 60);
      if (!off && leaveAsked(ctx, uid, ymd)) off = 'asked for leave today';
      if (!off) off = coveredBy(ctx, uid, condition, now);
      const again = askedBy(ctx, nm, uid, condition, ymd);
      if (again) facts += ', ' + again;
      res.match.push({uid, facts, line: nameOf(nm, uid) + ': ' + facts, on: !off, ...(off ? {off} : {}), ...(sub ? {sub} : {})});
    }
    /* time sense: before the moment a condition means anything, say so and ask anyway */
    const hm = U.hhmm(now);
    const st0 = U.minutes(String(S.start || '10:30')) + (Number(S.grace) || 0);
    if (condition === 'noout' && mins < cutM) res.warn = 'It\'s ' + hm + ', before the ' + (S.eodCut || '19:30') + ' cut. Everyone checked in is still working. Ask anyway?';
    else if (condition === 'noeod' && mins < cutM) res.warn = 'It\'s ' + hm + ', before the ' + (S.eodCut || '19:30') + ' cut. EOD lines are not due yet. Ask anyway?';
    else if (condition === 'noin' && mins < st0) res.warn = 'It\'s ' + hm + ', before the ' + (S.start || '10:30') + ' start and its grace. Ask anyway?';
    else if (condition === 'idle' && mins < 14 * 60) res.warn = 'It\'s ' + hm + '. Nobody counts as idle before 14:00. Ask anyway?';
    return res;
  }

  /* the sentence a read of people_where comes back as */
  function whereLine(r, nm) {
    if (!r.condition) return 'Say which condition: not checked in, not checked out, no EOD, overdue, quiet, idle or late.';
    const on = r.match.map(x => firstOf(nm, x.uid));
    const head = r.match.length ? COND[r.condition].many(r.match.length) + ': ' + andList(on) + '.' : 'Nobody matches right now.';
    const skip = r.match.filter(x => x.off).map(x => firstOf(nm, x.uid) + ' (' + x.off + ')');
    return head + (skip.length ? ' Of those, ' + andList(skip) + '.' : '') + (r.warn ? ' ' + r.warn.replace(/ Ask anyway\?$/, '') : '');
  }

  /* ---------- quiet hours for asks: when a recipient's ring window is shut, the preview says when it reaches them ---------- */
  function nextWorkday(ctx, uid, ymd) {
    for (let i = 1; i < 8; i++) {
      const d = U.ymd(U.addDays(U.parseYmd(ymd), i));
      if (!ctx.isWorkingDay || ctx.isWorkingDay(d, uid)) return {d, label: i === 1 ? 'tomorrow' : U.fmtDay(d)};
    }
    return {d: ymd, label: 'on their next working day'};
  }
  function quietLine(ctx, nm, uid, now) {
    const ymd = U.ymd(new Date(now));
    const d0 = U.parseYmd(ymd).getTime();
    const startHm = String(ctx.startFor(uid) || ctx.settings.start || '10:30');
    const cutHm = String(ctx.settings.eodCut || '19:30');
    const mins = (now - d0) / MIN;
    const working = !ctx.isWorkingDay || ctx.isWorkingDay(ymd, uid);
    const mail = live() ? ', and the email waits too' : '';
    const S = ctx.settings || {};
    const lf = hmOk(S.lunchFrom) && hmOk(S.lunchTo) ? [U.minutes(S.lunchFrom), U.minutes(S.lunchTo)] : null;
    if (working && lf && lf[1] > lf[0] && mins >= lf[0] && mins < lf[1]) return firstOf(nm, uid) + ' is at lunch till ' + S.lunchTo + '. It reaches them then' + mail + '.';
    if (working && mins >= U.minutes(startHm) - 30 && mins <= U.minutes(cutHm) + 90) return '';
    if (working && mins < U.minutes(startHm) - 30) return firstOf(nm, uid) + '\'s day starts at ' + startHm + '. It reaches them then' + mail + '.';
    const nx = nextWorkday(ctx, uid, ymd);
    return (working ? firstOf(nm, uid) + '\'s day ended at ' + cutHm : firstOf(nm, uid) + ' is not working today') + '. They see it at ' + startHm + ' ' + nx.label + mail + '.';
  }
  /* "if nobody answers by 21:45, tell me": an hour on, to the next quarter */
  const tellByOf = now => { const q = 15 * MIN; return Math.ceil((now + 60 * MIN) / q) * q; };
  const sentToday = ctx => {
    const asks = ((meDoc(ctx, ctx.uid).pm || {}).asks) || {};
    const td = today();
    return Object.keys(asks).reduce((n, id) => { const a = asks[id]; return n + (a && !a.withdrawn && U.ymd(new Date(a.at || 0)) === td && Array.isArray(a.to) ? a.to.length : 0); }, 0);
  };

  /* ---------- asks: nudge_people and schedule_nudge ---------- */
  const ASKS = ['why', 'eta', 'confirm'];
  const KINDS = CONDS.concat(['task', 'custom']);
  function resolvePeople(ctx, nm, list) {
    const xs = Array.isArray(list) ? list : String(list || '').split(/\s*(?:,|\band\b)\s*/);
    const out = [];
    for (const n of xs) {
      if (!String(n || '').trim()) continue;
      const u = ctx.members[n] ? n : member(ctx, nm, n);
      if (!u || u === ctx.uid) throw new Error('no teammate called ' + n);
      if (out.indexOf(u) < 0) out.push(u);
    }
    return out;
  }
  const isGroupWord = s => ['everyone', 'everybody', 'all', 'team', 'the team', 'myteam', 'my team', 'reports'].indexOf(norm(s)) >= 0;

  async function nudge(ctx, nm, input, io, sched) {
    if (!M.pm || !M.pm.ask) throw new Error('asks arrive with the personal managers, which are not on this page yet');
    const now = Date.now();
    const ask = ASKS.indexOf(input.ask) >= 0 ? input.ask : 'why';
    const note = cut(String(input.note || '').trim(), 280);
    const via = (io.turn && io.turn.via) || 'typed';
    const named = input.people && !(typeof input.people === 'string' && isGroupWord(input.people));
    /* a condition by its kind ("ask Ishaan why he has not checked out") reads the same live facts, exclusions and re-check */
    const condition = CONDS.indexOf(input.condition) >= 0 ? input.condition : named && CONDS.indexOf(input.kind) >= 0 ? input.kind : null;
    let kind, rows = [], left = [], warn = '';
    let showAt = null;
    if (sched) {
      const at = String(input.at || '').trim();
      if (!hmOk(at)) throw new Error('at is HH:MM, later today');
      showAt = dayAt(today(), at);
      if (showAt <= now) throw new Error('that time has passed today');
    }
    if (condition) {
      kind = condition;
      const pw = peopleWhere(ctx, {condition, scope: named ? input.people : (input.scope || input.people || 'everyone'), now}, nm);
      rows = pw.match; left = pw.left; warn = sched ? '' : pw.warn;
      const t = condition === 'overdue' && input.task ? M.brain.findTask(ctx, input.task) : null;
      if (t) rows = rows.map(r => r.uid === t.owner ? {...r, sub: t.id} : r);
    } else if (named) {
      kind = KINDS.indexOf(input.kind) >= 0 ? input.kind : 'custom';
      if (kind === 'custom' && !note) throw new Error('say what to ask them, as note');
      let sub = '';
      if (kind === 'task' || kind === 'overdue') {
        const t = input.task ? M.brain.findTask(ctx, input.task) : null;
        if (!t && kind === 'task') throw new Error('say which task');
        sub = t ? t.id : '';
      }
      for (const u of resolvePeople(ctx, nm, input.people)) {
        if (!mayAsk(ctx, kind, u)) { left.push({uid: u, why: NOT_TEAM}); continue; }
        rows.push({uid: u, facts: '', on: true, ...(sub ? {sub} : {})});
      }
    } else throw new Error('say who to ask (people) or a condition (' + CONDS.join(', ') + '). Fields: ' + byName('nudge_people').sig);
    const cf = conf(ctx);
    const skipped = left.map(x => (x.uid ? firstOf(nm, x.uid) : x.name || 'someone') + ' (' + x.why + ')');
    if (!rows.length) return {ok: true, asked: 0, left: skipped, say: 'Nobody to ask right now.' + (skipped.length ? ' Left out: ' + andList(skipped) + '.' : '')};
    let trimmed = [];
    if (rows.length > cf.bulkMax) { trimmed = rows.slice(cf.bulkMax).map(x => firstOf(nm, x.uid)); rows = rows.slice(0, cf.bulkMax); }
    const room = cf.perSenderDay - sentToday(ctx);
    if (room <= 0) throw new Error('that is ' + cf.perSenderDay + ' asks today, the most one person sends in a day');
    if (rows.length > room) { trimmed = trimmed.concat(rows.slice(room).map(x => firstOf(nm, x.uid))); rows = rows.slice(0, room); }
    const quiet = sched ? [] : rows.map(x => quietLine(ctx, nm, x.uid, now)).filter(Boolean);
    const spec = {kind, condition, ask, note, showAt, via, scope: input.scope || 'everyone'};
    const ticked = rows.filter(x => x.on);
    const c = COND[kind];
    const phrase = c ? (ask === 'eta' ? c.eta : c.why) : (kind === 'task' ? 'about the task' : 'your question');
    const firsts = ticked.map(x => firstOf(nm, x.uid));
    /* one person, nothing unticked, not scheduled: it goes at once, with Undo until the end of the day */
    if (rows.length === 1 && ticked.length === 1 && !sched && !warn && !quiet.length && !io.mustHold) {
      const r = await sendAsk(ctx, nm, spec, [ticked[0].uid], {tellBy: null, note, ringNow: false, via}, io, rows);
      return r;
    }
    const n = ticked.length;
    const title = (sched ? 'At ' + U.hhmm(showAt) + ', ask ' : 'Ask ') + (rows.length === 1 ? firstOf(nm, rows[0].uid) : n + (n === 1 ? ' person' : ' people')) + ' ' + phrase;
    const spoken = c ? COND[kind].many(n) + (n ? ', ' + andList(firsts) : '') + '. Ask them' + (ask === 'eta' ? ' when' : ' why') + '? Say yes to send.' : 'Ask ' + andList(firsts) + '? Say yes to send.';
    const tellBy = sched ? null : tellByOf(now);
    const channels = sched ? ['no DM line for a scheduled ask: each person sees it at ' + U.hhmm(showAt) + ' only if it still holds'] : ['DM', 'bubble and notice', live() ? 'email when away' : 'email: team site only'];
    const detail = rows.map(x => nameOf(nm, x.uid) + (x.facts ? ': ' + x.facts : '')).join('; ') + (trimmed.length ? '. Left for later (the cap): ' + andList(trimmed) : '') + (skipped.length ? '. Left out: ' + andList(skipped) : '');
    const held = M.brain.hold(cut(title, 90), detail, opts => sendAsk(ctx, nm, spec, (opts && opts.people) || ticked.map(x => x.uid), opts || {}, io, rows), {
      turn: io.turn, kind: 'ask', title: cut(title, 90),
      people: rows.map(x => ({uid: x.uid, name: nameOf(nm, x.uid), facts: x.facts, on: x.on, off: x.off || ''})),
      channels, tellBy, warn, quiet, ringNowOk: !!ctx.isFounder && quiet.length > 0, from: io.from || '',
      left: skipped.concat(trimmed.map(t => t + ' (over the cap)'))
    });
    return {...held, say: (warn ? warn.replace(/ Ask anyway\?$/, '') + ' ' : '') + spoken, people: rows.map(x => nameOf(nm, x.uid)), left: skipped};
  }

  /* the send itself: everyone re-checked against live data first, anyone sorted in between dropped and named */
  async function sendAsk(ctx0, nm, spec, uids, opts, io, rows) {
    const ctx = M.lastCtx && M.lastCtx.uid === ctx0.uid && !M.lastCtx.viewAs ? M.lastCtx : ctx0;
    if (!M.pm || !M.pm.ask) throw new Error('asks arrive with the personal managers, which are not on this page yet');
    let keep = (uids || []).filter(u => ctx.members[u] && mayAsk(ctx, spec.kind, u));
    const dropped = [];
    if (spec.condition && !spec.showAt) {
      const pw = peopleWhere(ctx, {condition: spec.condition, scope: keep}, nm);
      const now = keep.filter(u => pw.match.some(m => m.uid === u));
      for (const u of keep) if (now.indexOf(u) < 0) { const l = pw.left.find(x => x.uid === u); dropped.push(firstOf(nm, u) + (l ? ' ' + l.why.replace(/^checked out at/, 'checked out at') : '')); }
      keep = now;
    }
    const dropLine = dropped.length ? andList(dropped) + (dropped.length === 1 ? ', so I left them out.' : ', so I left them out.') : '';
    if (!keep.length) return {ok: false, asked: 0, say: 'Nobody to ask now. ' + dropLine};
    const subOf = u => ((rows || []).find(x => x.uid === u) || {}).sub || '';
    /* overdue asks name each person's own task, so each goes on its own */
    const groups = spec.kind === 'overdue' || spec.kind === 'task' ? keep.map(u => ({to: [u], sub: subOf(u)})) : [{to: keep, sub: ''}];
    const askIds = [], sent = [], skipped = [];
    for (const g of groups) {
      const r = await M.pm.ask(ctx, {kind: spec.kind, to: g.to, ...(g.sub ? {sub: g.sub} : {}), ask: spec.ask, ...(opts.note || spec.note ? {note: cut(opts.note || spec.note, 280)} : {}),
        ...(spec.showAt ? {showAt: spec.showAt} : {}), ...(opts.tellBy ? {tellBy: opts.tellBy} : {}), ...(opts.ringNow && ctx.isFounder ? {ringNow: true} : {}), via: spec.via || 'typed'}) || {};
      if (r.askId) askIds.push(r.askId);
      (r.sent || []).forEach(u => sent.push(u));
      (r.skipped || []).forEach(x => skipped.push(firstOf(nm, x.uid) + (x.why ? ' (' + x.why + ')' : '')));
    }
    const log = io.log;
    if (log) askIds.forEach(id => log({type: 'ask', askId: id, text: 'Asked ' + andList(sent.map(u => firstOf(nm, u)))}));
    const say = (sent.length ? (spec.showAt ? 'Set for ' + U.hhmm(spec.showAt) + '. ' : 'Sent. ') + (spec.showAt ? 'No DM line goes for a scheduled ask.' : 'I will tell you when they answer.') : 'Nothing went out.') +
      (dropLine ? ' ' + dropLine : '') + (skipped.length ? ' Held back: ' + andList(skipped) + '.' : '') + (!live() && sent.length && !spec.showAt ? ' Email only goes from the team site. DMs and bubbles went out.' : '');
    return {ok: sent.length > 0, asked: sent.length, askId: askIds[0] || null, askIds, sent: sent.map(u => nameOf(nm, u)), dropped, skipped, say, _undo: askIds.length ? {k: 'ask', ids: askIds, day: today()} : null};
  }

  /* ---------- the answers, chases and nudges on the personal managers ---------- */
  const needPm = f => { if (!M.pm || typeof M.pm[f] !== 'function') throw new Error('this arrives with the personal managers, which are not on this page yet'); };
  /* "by five", "by 17:30", "in an hour", "end of day", "tomorrow" */
  const NUMW = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, noon: 12};
  function timeFrom(text, now) {
    const s = norm(text);
    now = now || Date.now();
    const td = U.ymd(new Date(now));
    if (/\btomorrow\b/.test(s)) return {ymd: U.ymd(U.addDays(U.parseYmd(td), 1))};
    if (/\b(end of (the )?day|eod|tonight)\b/.test(s)) return {ms: dayAt(td, String((M.lastCtx && M.lastCtx.settings.eodCut) || '19:30'))};
    let m = /\bin (an|a|one|half an|\d+) ?(hour|hours|hr|hrs|minutes|mins|min)\b/.exec(s);
    if (m) { const n = m[1] === 'half an' ? 30 : /^\d+$/.test(m[1]) ? Number(m[1]) : 1; return {ms: now + (/^(hour|hours|hr|hrs)$/.test(m[2]) && m[1] !== 'half an' ? n * 60 : n) * MIN}; }
    m = /\b(\d{1,2})(?::(\d{2}))? ?(am|pm)?\b/.exec(s) || null;
    let h = null, mm = 0, ap = '';
    if (m) { h = Number(m[1]); mm = Number(m[2] || 0); ap = m[3] || ''; }
    else { const w = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon)( thirty)?( ?(am|pm))?\b/.exec(s); if (w) { h = NUMW[w[1]]; mm = w[2] ? 30 : 0; ap = w[4] || ''; } }
    if (h == null || h > 23 || mm > 59) return null;
    if (ap === 'pm' && h < 12) h += 12;
    else if (ap === 'am' && h === 12) h = 0;
    else if (!ap && h <= 8) h += 12;
    return {ms: dayAt(td, U.pad(h) + ':' + U.pad(mm))};
  }
  const HOWS = ['onit', 'blocked', 'wrong', 'leave', 'reply'];
  function howFrom(s) {
    s = norm(s);
    if (HOWS.indexOf(s) >= 0) return s;
    if (/blocked|stuck|waiting on/.test(s)) return 'blocked';
    if (/not right|wrong|mistake|incorrect/.test(s)) return 'wrong';
    if (/off today|on leave|leave/.test(s)) return 'leave';
    if (/reply|message/.test(s)) return 'reply';
    return 'onit';
  }

  /* ---------- open_screen: pages, people, tasks, projects, clients, chat rooms ---------- */
  function screens(ctx) {
    const out = [];
    const add = (label, hash, why) => { if (label && hash && !out.some(x => x.hash === hash && norm(x.label) === norm(label))) out.push({label: String(label), hash, why: why || 'page'}); };
    const S = M.SECTIONS || {};
    for (const k of Object.keys(S)) {
      const s = S[k];
      if ((s.founder && !ctx.isFounder) || (s.owner && !ctx.isOwner)) continue;
      add(s.label, '#' + (s.tabs && s.tabs[0] ? s.tabs[0].route : k));
      (s.tabs || []).forEach(t => { if (t.k === 'hiring' && !ctx.isFounder) return; add(t.label, '#' + t.route); });
    }
    ((M.palette && M.palette.PAGES) || []).forEach(p => { if (!p[3] || ctx.isFounder) add(p[0], '#' + p[1]); });
    [['Inbox', '#home'], ['Admin', '#admin'], ['Corrections', '#me'], ['Settings', '#admin'], ['Team', '#people']].forEach(([l, h]) => { if (h !== '#admin' || ctx.isFounder) add(l, h); });
    return out;
  }
  function findScreen(ctx, nm, q) {
    const s = norm(q).replace(/^(the|my|our)\s+/, '').replace(/\s+(page|screen|tab|section)$/, '');
    if (!s) return null;
    const best = (list, key) => list.find(x => norm(key(x)) === s) || list.find(x => norm(key(x)).startsWith(s)) || list.find(x => norm(key(x)).includes(s)) || null;
    const pg = screens(ctx);
    const exact = pg.find(x => norm(x.label) === s);
    if (exact) return exact;
    const u = M.ai.findMember(ctx, nm, s);
    if (u && s !== 'me') return {label: nameOf(nm, u), hash: '#people/' + u, why: 'person'};
    if (M.rooms && M.rooms.roomsOf) {
      const r = best(M.rooms.roomsOf(ctx), x => x.name || x.id);
      if (r && (norm(r.name) === s || norm(r.name) === s.replace(/^#/, ''))) return {label: '#' + r.name, hash: '#chat/' + r.id, why: 'room'};
    }
    const p = best(pg, x => x.label);
    if (p) return p;
    const t = M.brain.findTask(ctx, s);
    if (t) return {label: t.title, hash: '#tasks/' + t.id, why: 'task'};
    const pj = M.brain.findProject(ctx, s);
    if (pj) return {label: pj.name, hash: '#projects/' + pj.id, why: 'project'};
    const c = M.brain.findClient(ctx, s);
    if (c) return {label: c.name, hash: '#clients/' + c.id, why: 'client'};
    return null;
  }

  /* ---------- settings the founder changes by voice, held to the Admin form's own checks ---------- */
  const SETTING_KEYS = {
    start: 'time', eodCut: 'time', mondayCut: 'time', lunchFrom: 'time', lunchTo: 'time',
    grace: [0, 240], wfhCap: [0, 6], revCap: [0, 20], ackHours: [0, 720], blockerDays: [0, 30], quietMins: [30, 480], signoff: 'bool'
  };
  function settingValue(ctx, key, value) {
    const kind = SETTING_KEYS[key];
    if (!kind) throw new Error('key is one of ' + Object.keys(SETTING_KEYS).join(', '));
    if (kind === 'time') {
      const v = String(value == null ? '' : value).trim();
      if ((key === 'lunchFrom' || key === 'lunchTo') && v === '') return '';
      if (!hmOk(v)) throw new Error(key + ' is a time, HH:MM');
      const hm = U.pad(Math.floor(U.minutes(v) / 60)) + ':' + U.pad(U.minutes(v) % 60);
      if (key === 'lunchFrom' && ctx.settings.lunchTo && U.minutes(ctx.settings.lunchTo) <= U.minutes(hm)) throw new Error('lunch has to end after it starts');
      if (key === 'lunchTo' && ctx.settings.lunchFrom && U.minutes(hm) <= U.minutes(ctx.settings.lunchFrom)) throw new Error('lunch has to end after it starts');
      return hm;
    }
    if (kind === 'bool') return !(value === false || /^(off|no|false|0)$/i.test(String(value)));
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(key + ' is a number');
    return Math.max(kind[0], Math.min(kind[1], Math.round(n)));
  }
  const SETTING_LABEL = {start: 'the start time', eodCut: 'the EOD cut', mondayCut: 'the Monday cutoff', lunchFrom: 'lunch from', lunchTo: 'lunch to', grace: 'grace minutes',
    wfhCap: 'WFH days a week', revCap: 'the revision cap', ackHours: 'the handbook read window', blockerDays: 'blocker days', quietMins: 'the quiet stretch threshold', signoff: 'sign-off for done'};
  const showVal = v => v === true ? 'on' : v === false ? 'off' : v === '' || v == null ? 'none' : String(v);

  /* ---------- the registry ---------- */
  /* a JSON schema from the compact signature, so look_up("action") reads the same thing both ways */
  function schemaOf(sig, required) {
    const props = {};
    String(sig || '').replace(/^\{|\}$/g, '').split(/,\s*(?![^{[]*[\]}])/).forEach(part => {
      const m = /^\s*(\w+)(\?)?\s*(.*)$/.exec(part);
      if (!m || !m[1]) return;
      const hint = (m[3] || '').trim();
      props[m[1]] = /^\[/.test(hint) ? {type: 'array', items: {type: 'string'}, description: hint} : /^\{/.test(hint) ? {type: 'object', description: hint} : {type: /true\b/.test(hint) && !/\|/.test(hint) ? 'boolean' : 'string', ...(hint ? {description: hint} : {})};
    });
    return {type: 'object', properties: props, required: required || []};
  }
  /* the 33 the brain had: their run is the brain's own switch, with who and mode added */
  const LEGACY = [
    ['create_task', 'a task, for anyone', '{title, owner?, due? YYYY-MM-DD, priority? low|normal|high, project?, client?, subtasks? [text], link?}', ['title'], 'self', 'now', 1],
    ['update_task', 'change a task', '{task, title?, due?, priority?, project?, client?, link?, owner?}', ['task'], 'self', 'now'],
    ['set_task_status', 'move a task to a status', '{task, status todo|doing|review|done}', ['task', 'status'], 'self', 'now'],
    ['reassign_task', 'hand a task to someone', '{task, owner}', ['task', 'owner'], 'self', 'now', 1],
    ['add_subtask', 'add a subtask', '{task, text}', ['task', 'text'], 'self', 'now'],
    ['tick_subtask', 'tick or untick a subtask', '{task, subtask, done? true}', ['task', 'subtask'], 'self', 'now'],
    ['comment_task', 'comment on a task, @mentions', '{task, text}', ['task', 'text'], 'self', 'now', 1],
    ['approve_task', 'approve a task in review', '{task}', ['task'], 'self', 'tap'],
    ['send_back_task', 'send a task in review back', '{task, note}', ['task'], 'self', 'tap'],
    ['create_project', 'a project with its sections', '{name, kind? client|pitch|internal, client?, owner?, due?}', ['name'], 'self', 'now'],
    ['project_update', 'a status update on a project', '{project, status on|risk|off|done, text}', ['project', 'text'], 'self', 'now', 1],
    ['create_note', 'a private note', '{text}', ['text'], 'self', 'now'],
    ['append_note', 'add lines to a private note', '{note, text}', ['note', 'text'], 'self', 'now'],
    ['post_to_feed', 'a post on Vibe', '{kind update|win|question|poll|announce, text, options? [..]}', ['text'], 'self', 'now', 1],
    ['give_kudos', 'kudos to a teammate', '{to, why}', ['to', 'why'], 'self', 'now', 1],
    ['send_message', 'one chat message, room or person', '{to, text}', ['to', 'text'], 'self', 'now', 1],
    ['create_room', 'a chat room', '{name, topic?}', ['name'], 'self', 'now'],
    ['request_leave', 'ask for leave', '{from, to, type casual|sick|swap|other}', ['from', 'to'], 'self', 'now'],
    ['decide_leave', 'decide a leave request', '{person, from?, status approved|declined}', ['person'], 'founder', 'tap'],
    ['check_in', 'check in for today', '{mode office|wfh, place? Office|Client site|Home|Travelling, mood? 1..5}', [], 'self', 'now'],
    ['check_out', 'check out for today', '{}', [], 'self', 'now'],
    ['file_eod', 'the end of day line', '{shipped, next?, blocked?}', ['shipped'], 'self', 'now'],
    ['set_week_outcomes', 'this week\'s outcomes', '{items [up to 3 lines]}', ['items'], 'self', 'now'],
    ['create_pitch', 'a pitch in the pipeline', '{brand, category?, contact?, source?, owner?}', ['brand'], 'self', 'now'],
    ['move_pitch', 'move a pitch or set its next step', '{pitch, stage? lead|qualified|diagnostic|proposal|negotiation|won|lost, next?, nextDate?, lost?}', ['pitch'], 'self', 'now'],
    ['update_client', 'set a client field or brain key', '{client, field, value}', ['client', 'field', 'value'], 'self', 'now'],
    ['remind_me', 'a reminder, kept as a task', '{text, when YYYY-MM-DD}', ['text'], 'self', 'now'],
    ['remember', 'keep a fact in mind', '{fact}', [], 'self', 'now'],
    ['forget', 'drop a remembered fact', '{fact}', [], 'self', 'now'],
    ['save_bookmark', 'a bookmark for the team browser', '{url, title?}', ['url'], 'self', 'now'],
    ['open_web', 'open a page inside m360', '{url}', ['url'], 'self', 'now'],
    ['send_mail', 'an email from their Gmail', '{to, subject, text, cc?}', ['to', 'subject', 'text'], 'site', 'tap', 1],
    ['add_meeting', 'a Google Calendar event', '{title, start ISO, end ISO, attendees? [emails], description?, meet? true}', ['title', 'start', 'end'], 'site', 'tap', 1]
  ];
  const ACTIONS = LEGACY.map(([name, gloss, sig, req, who, mode, out]) => ({name, gloss, sig, schema: schemaOf(sig, req), who, mode, out: !!out, legacy: true,
    run: (ctx, nm, input, io) => M.brain.legacy(ctx, nm, io.log, name, input)}));
  const byName = n => ACTIONS.find(a => a.name === n) || null;
  const reg = (name, gloss, sig, req, who, mode, run, more) => ACTIONS.push({name, gloss, sig, schema: schemaOf(sig, req), who, mode, run, wave: 1, ...(more || {})});
  /* a tap card runs on the page as it is when the tap comes, with the rights checked again then */
  const tapHold = (ctx, io, label, detail, run, who) => M.brain.hold(label, detail, () => {
    const c = fresh(ctx);
    if (who === 'founder' && !c.isFounder) throw new Error('only the founder can do that');
    return run(c);
  }, {turn: io.turn, from: io.from || ''});

  /* announcements are a tap now: everyone sees them pinned */
  const postRun = byName('post_to_feed').run;
  byName('post_to_feed').run = (ctx, nm, input, io) => input.kind === 'announce' && ctx.isFounder && !io.approved
    ? tapHold(ctx, io, 'Pin the announcement', cut(input.text, 300), c => postRun(c, nm, input, {...io, approved: true}), 'founder') : postRun(ctx, nm, input, io);

  /* wave 1: people and the day */
  reg('people_where', 'who matches a condition right now', '{condition noin|noout|noeod|overdue|quiet|idle|late, scope? everyone|my team|names}', ['condition'], 'self', 'now', (ctx, nm, input) => {
    if (CONDS.indexOf(input.condition) < 0) throw new Error('condition is one of ' + CONDS.join(', '));
    const r = peopleWhere(ctx, {condition: input.condition, scope: input.scope || 'everyone'}, nm);
    return {ok: true, read: true, condition: r.condition, match: r.match.map(x => ({person: nameOf(nm, x.uid), facts: x.facts, ticked: x.on, ...(x.off ? {why: x.off} : {})})),
      left: r.left.map(x => ({person: x.uid ? nameOf(nm, x.uid) : x.name, why: x.why})), warn: r.warn || undefined, say: whereLine(r, nm)};
  });
  reg('nudge_people', 'ask people about a flag, by DM', '{people? [names] | condition, scope?, kind?, ask? why|eta|confirm, note?, task?, ringNow?}', [], 'line', 'now', (ctx, nm, input, io) => nudge(ctx, nm, input, io, false), {needs: 'pm', out: true});
  reg('schedule_nudge', 'the same ask, later today if it holds', '{people? | condition, scope?, kind?, ask?, note?, at HH:MM}', ['at'], 'line', 'tap', (ctx, nm, input, io) => nudge(ctx, nm, input, {...io, mustHold: true}, true), {needs: 'pm', out: true});
  reg('withdraw_ask', 'take back an ask you sent', '{ask? last|id}', [], 'self', 'now', async (ctx, nm, input) => {
    needPm('withdraw');
    const asks = ((meDoc(ctx, ctx.uid).pm || {}).asks) || {};
    const ids = Object.keys(asks).filter(id => asks[id] && !asks[id].withdrawn).sort((a, b) => (asks[b].at || 0) - (asks[a].at || 0));
    const id = !input.ask || input.ask === 'last' ? ids[0] : (asks[input.ask] ? input.ask : null);
    if (!id) throw new Error('no ask of yours to take back');
    await M.pm.withdraw(ctx, id);
    const to = (asks[id].to || []).map(u => firstOf(nm, u));
    return {ok: true, withdrawn: id, say: 'Taken back. ' + andList(to) + (to.length === 1 ? ' sees' : ' see') + ' it marked withdrawn.'};
  }, {needs: 'pm'});
  reg('nudge_again', 'have a report\'s bot nudge again', '{person, about?}', ['person'], 'mgr', 'now', async (ctx, nm, input) => {
    needPm('handle');
    const u = member(ctx, nm, input.person);
    if (!u || u === ctx.uid) throw new Error('no teammate called ' + input.person);
    if (!isMgr(ctx, u)) throw new Error(firstOf(nm, u) + ' is ' + NOT_TEAM + ': their own manager nudges them');
    const open = (M.pm.items(ctx, u, {now: Date.now()}) || []).filter(i => i && i.state === 'open' && i.source !== 'ask');
    const q = norm(input.about);
    const it = q ? open.find(i => norm(i.kind) === q || norm(i.line).includes(q) || norm(((ctx.coll.tasks.map[i.sub] || {}).title)).includes(q)) : open.length === 1 ? open[0] : null;
    if (!it) throw new Error(open.length ? 'say which one: ' + open.slice(0, 4).map(i => cut(i.line, 60)).join('; ') : 'nothing open for ' + firstOf(nm, u) + ' to nudge about');
    await M.pm.handle(ctx, it.K, 'again');
    return {ok: true, person: nameOf(nm, u), about: it.kind, say: 'Done. ' + firstOf(nm, u) + '\'s bot asks again now, once.'};
  }, {needs: 'pm', out: true});
  reg('chase_task', 'have the owner\'s bot chase a task', '{task, on? true}', ['task'], 'line', 'now', async (ctx, nm, input) => {
    needPm('chase');
    const t = M.brain.findTask(ctx, input.task);
    if (!t) throw new Error('no task matches "' + input.task + '"');
    if (t.status === 'done') throw new Error('"' + t.title + '" is done already');
    if (!inLine(ctx, t.owner)) throw new Error('only someone above ' + firstOf(nm, t.owner) + ' asks their bot to chase');
    const on = input.on !== false && input.on !== 'false';
    await M.pm.chase(ctx, t.id, on);
    return {ok: true, task: t.title, on, say: on ? firstOf(nm, t.owner) + '\'s bot chases "' + cut(t.title, 60) + '" from now until it is done.' : 'Stopped chasing "' + cut(t.title, 60) + '".', _undo: {k: 'chase', id: t.id, on}};
  }, {needs: 'pm', out: true});
  reg('answer_ask', 'answer a bot or an ask to you', '{about?, how onit|blocked|wrong|leave|reply, eta? HH:MM|YYYY-MM-DD, note?}', ['how'], 'self', 'now', async (ctx, nm, input) => {
    needPm('answer');
    const now = Date.now();
    const open = (M.pm.items(ctx, ctx.uid, {now}) || []).filter(i => i && (i.state === 'open' || i.state === 'held'));
    const q = norm(input.about);
    const by = q ? M.ai.findMember(ctx, nm, q) : null;
    const it = q ? open.find(i => (by && (i.from === by || managerOf(ctx, ctx.uid) === by && i.source === 'bot')) || norm(i.kind) === q || norm(i.line).includes(q)) : open.length === 1 ? open[0] : null;
    if (!it) throw new Error(!open.length ? 'nothing is waiting on an answer from you' : q ? 'nothing from ' + input.about + ' is waiting on you' : 'say which one: ' + open.slice(0, 4).map(i => cut(i.line, 60)).join('; '));
    const how = howFrom(input.how);
    let eta = input.eta;
    if (eta && !ymdOk(eta) && typeof eta !== 'number') { const t = timeFrom(String(eta), now); eta = t ? (t.ms || t.ymd) : undefined; }
    await M.pm.answer(ctx, it.K, {how, ...(eta ? {eta} : {}), ...(input.note ? {note: cut(input.note, 280)} : {})});
    return {ok: true, how, say: 'Told ' + (it.from ? firstOf(nm, it.from) : 'them') + ': ' + (how === 'onit' ? 'on it' + (eta ? ', by ' + (typeof eta === 'number' ? U.hhmm(eta) : U.fmtDay(eta)) : '') : how) + '.'};
  }, {needs: 'pm'});
  reg('message_people', 'one DM each to several people', '{people [names] | condition, scope?, text}', ['text'], 'self', 'now', async (ctx, nm, input, io) => {
    if (!M.rooms) throw new Error('chat is not on this build');
    const text = cut(String(input.text || '').trim(), 4000);
    let uids;
    if (CONDS.indexOf(input.condition) >= 0) uids = peopleWhere(ctx, {condition: input.condition, scope: input.people || input.scope || 'everyone'}, nm).match.filter(x => x.on).map(x => x.uid);
    else if (input.people && isGroupWord(input.people)) uids = ctx.isFounder ? ctx.activeMembers.map(m => m.uid).filter(u => u !== ctx.uid) : reportsOf(ctx, ctx.uid);
    else uids = resolvePeople(ctx, nm, input.people);
    if (!uids.length) return {ok: true, sent: 0, say: 'Nobody to message.'};
    const cap = conf(ctx).bulkMax;
    if (uids.length > cap) throw new Error('that is ' + uids.length + ' people; the most at once is ' + cap);
    const send = async list => {
      const items = [];
      for (const u of list) {
        const m = await M.rooms.send(ctx, M.rooms.dmId(ctx.uid, u), text, []);
        if (m && m.id) items.push({room: M.rooms.dmId(ctx.uid, u), id: m.id});
        if (io.log) io.log({group: 'message', who: u, text: 'Messaged ' + firstOf(nm, u)});
      }
      return {ok: true, sent: list.length, say: 'Messaged ' + (list.length === 1 ? firstOf(nm, list[0]) : people(list.length).toLowerCase()) + '.', _undo: items.length ? {k: 'msg', items} : null};
    };
    if (uids.length === 1) return send(uids);
    return M.brain.hold('Message ' + people(uids.length).toLowerCase(), cut(text, 300), opts => send((opts && opts.people) || uids), {turn: io.turn, from: io.from || '', kind: 'message', title: 'Message ' + people(uids.length).toLowerCase(),
      people: uids.map(u => ({uid: u, name: nameOf(nm, u), facts: '', on: true})), channels: ['one DM each, nobody sees who else got it']});
  }, {out: true});
  reg('set_status', 'your status for today', '{text, until? HH:MM}', ['text'], 'self', 'now', async (ctx, nm, input) => {
    const t = timeFrom(String(input.until || ''), Date.now());
    const text = cut(String(input.text || '').trim(), 60) + (input.until && t && t.ms ? ' till ' + U.hhmm(t.ms) : '');
    if (!text.trim()) throw new Error('say the status');
    const prev = meDoc(ctx, ctx.uid).status || null;
    await ctx.W.merge('me/' + ctx.uid, {status: {text, at: Date.now()}});
    return {ok: true, status: text, say: 'Status set: ' + text + '.', _undo: {k: 'status', prev}};
  });
  reg('focus', 'start or stop a focus timer', '{start? 25|45|90, task?, stop? true}', [], 'self', 'now', async (ctx, nm, input) => {
    if (!M.focus) throw new Error('focus is not on this build');
    if (input.stop || (!input.start && M.focus.get())) {
      if (!M.focus.get()) throw new Error('no focus timer is running');
      M.focus.stop();
      return {ok: true, say: 'Focus stopped.'};
    }
    const mins = [25, 45, 90].indexOf(Number(input.start)) >= 0 ? Number(input.start) : 25;
    const t = input.task ? M.brain.findTask(ctx, input.task) : null;
    M.focus.start(t ? t.id : '', t ? t.title : 'Deep work', mins);
    return {ok: true, mins, say: mins + ' minutes of focus' + (t ? ' on "' + cut(t.title, 50) + '"' : '') + '. I will keep quiet.', _undo: {k: 'focus'}};
  });
  reg('open_screen', 'open any screen, person, task or project', '{route, id?}', ['route'], 'self', 'now', async (ctx, nm, input) => {
    const s = findScreen(ctx, nm, input.route + (input.id ? ' ' + input.id : '')) || findScreen(ctx, nm, input.route);
    if (!s) throw new Error('nothing called "' + input.route + '" here');
    M.nav(s.hash);
    return {ok: true, opened: s.label, say: 'Opened ' + s.label + '.'};
  });
  reg('pm_settings', 'your own bot: wait, kinds, a pause', '{on?, wait? minutes, kinds? {kind: on}, pause? {person, until? YYYY-MM-DD}}', [], 'mgr', 'now', async (ctx, nm, input) => {
    needPm('setCfg');
    const P = M.pm.P ? M.pm.P(ctx) : {waitMin: 30, waitMax: 180};
    const patch = {};
    const bits = [];
    if (input.on === false || input.on === 'false' || input.on === 'off') {
      if (!ctx.isFounder) throw new Error('only Kaavish switches a bot off. You can pause it for one person for a day');
      patch.on = false; bits.push('your bot is off');
    } else if (input.on === true || input.on === 'true' || input.on === 'on') { patch.on = true; bits.push('your bot is on'); }
    if (input.wait != null && input.wait !== '') {
      const w = Math.max(Number(P.waitMin) || 30, Math.min(Number(P.waitMax) || 180, Math.round(Number(String(input.wait).replace(/[^\d.]/g, '')) * (/h/.test(String(input.wait)) ? 60 : 1))));
      if (!Number.isFinite(w)) throw new Error('wait is minutes, ' + (P.waitMin || 30) + ' to ' + (P.waitMax || 180));
      patch.wait = w; bits.push('it waits ' + w + ' minutes');
    }
    if (input.kinds && typeof input.kinds === 'object') {
      const k = {};
      Object.keys(input.kinds).forEach(x => { if (KINDS.indexOf(x) >= 0 || ['sentback', 'chase', 'waiton', 'short'].indexOf(x) >= 0) k[x] = !!input.kinds[x]; });
      /* every kind off is the bot off, and only Kaavish switches a bot off */
      const was = (M.pm.cfgOf ? (M.pm.cfgOf(ctx, ctx.uid) || {}).kinds : null) || P.kinds || {};
      const after = {...was, ...k};
      if (!ctx.isFounder && Object.keys(k).length && !Object.keys(after).some(x => after[x])) throw new Error('only Kaavish switches a bot off. Keep at least one kind on, or pause it for one person for a day');
      if (Object.keys(k).length) { patch.kinds = k; bits.push('kinds updated'); }
    }
    if (input.pause && input.pause.person) {
      const u = member(ctx, nm, input.pause.person);
      if (!u || reportsOf(ctx, ctx.uid).indexOf(u) < 0) throw new Error('pause works for your own reports');
      /* a manager pauses one person for today; a longer pause is the bot off, which is Kaavish's */
      const until = ymdOk(input.pause.until) ? input.pause.until : today();
      if (until < today()) throw new Error('until is today or later');
      if (!ctx.isFounder && until !== today()) throw new Error('a pause lasts until the end of today. Only Kaavish switches a bot off for longer');
      patch.pause = {[u]: until}; bits.push('paused for ' + firstOf(nm, u) + ' until the end of ' + U.fmtDay(until) + ' (Kaavish sees every pause)');
    }
    if (!Object.keys(patch).length) throw new Error('say what to change: on, wait, kinds or pause');
    await M.pm.setCfg(ctx, patch);
    return {ok: true, say: 'Done: ' + bits.join(', ') + '. Anything stricter starts tomorrow.'};
  }, {needs: 'pm'});
  reg('undo', 'undo the last thing it did', '{id? last|id}', [], 'self', 'now', async ctx => undo(ctx, 'last'));

  /* wave 2: the founder's controls, each on a tap */
  reg('change_setting', 'a work setting: times, caps, windows', '{key start|grace|eodCut|mondayCut|wfhCap|revCap|ackHours|blockerDays|quietMins|lunchFrom|lunchTo|signoff, value}', ['key', 'value'], 'founder', 'tap', async (ctx, nm, input, io) => {
    const key = String(input.key || '').trim();
    const value = settingValue(ctx, key, input.value);
    const old = ctx.settings[key];
    if (showVal(old) === showVal(value)) return {ok: true, say: SETTING_LABEL[key] + ' is ' + showVal(value) + ' already.'};
    const label = 'Change ' + SETTING_LABEL[key] + ': ' + showVal(old) + ' to ' + showVal(value);
    return tapHold(ctx, io, cut(label, 90), 'The same check as the Admin form. It applies to everyone from the next read.', async c => {
      const was = c.settings[key];
      const v = settingValue(c, key, input.value);
      await c.W.merge('settings/app', {[key]: v, updated: Date.now()});
      return {ok: true, say: label.replace(/^Change/, 'Changed') + '.', _undo: {k: 'settings', patch: {[key]: was === undefined ? null : was}}};
    }, 'founder');
  });
  reg('toggle_rule', 'switch a rule R01 to R17 on or off', '{rule R01..R17, on true|false}', ['rule'], 'founder', 'tap', async (ctx, nm, input, io) => {
    const id = String(input.rule || '').toUpperCase().replace(/^R(\d)$/, 'R0$1');
    if (M.RULE_IDS.indexOf(id) < 0) throw new Error('rule is one of ' + M.RULE_IDS.join(', '));
    const on = !(input.on === false || /^(off|false|no|0)$/i.test(String(input.on)));
    const rules = {...(ctx.settings.rules || {})};
    if ((rules[id] !== false) === on) return {ok: true, say: id + ' is ' + (on ? 'on' : 'off') + ' already.'};
    const nmR = ((M.rules && M.rules.NAMES) || {})[id] || '';
    return tapHold(ctx, io, 'Switch ' + id + (nmR ? ' ' + nmR : '') + (on ? ' on' : ' off'), on ? 'It counts again from now.' : 'Its flags and nudges stop for everyone.', async c => {
      /* only this rule is written, so a switch made elsewhere in the meantime stands */
      const was = ((c.settings.rules || {})[id]) !== false;
      await c.W.merge('settings/app', {rules: {[id]: on}, updated: Date.now()});
      return {ok: true, say: id + ' is ' + (on ? 'on' : 'off') + '.', _undo: {k: 'settings', patch: {rules: {[id]: was}}}};
    }, 'founder');
  });
  const holidayRun = add => async (ctx, nm, input, io) => {
    const d = String(input.date || '').trim();
    if (!ymdOk(d)) throw new Error('date is YYYY-MM-DD');
    const list = (ctx.settings.holidays || []).slice();
    const has = list.indexOf(d) >= 0;
    if (add === has) return {ok: true, say: U.fmtDate(d) + (add ? ' is a holiday already.' : ' is not a holiday.')};
    return tapHold(ctx, io, (add ? 'Add ' : 'Remove ') + U.fmtDay(d) + (add ? ' as a holiday' : ' from the holidays'), add ? 'Nobody is flagged or nudged that day.' : 'It becomes a working day again.', async c => {
      const now = (c.settings.holidays || []).slice();
      const next = add ? (now.indexOf(d) >= 0 ? now : now.concat([d]).sort()) : now.filter(x => x !== d);
      await c.W.merge('settings/app', {holidays: next, updated: Date.now()});
      return {ok: true, say: add ? U.fmtDay(d) + ' is a holiday.' : U.fmtDay(d) + ' is a working day.', _undo: {k: 'settings', patch: {holidays: now}}};
    }, 'founder');
  };
  reg('add_holiday', 'add a holiday', '{date YYYY-MM-DD, name?}', ['date'], 'founder', 'tap', holidayRun(true));
  reg('remove_holiday', 'remove a holiday', '{date YYYY-MM-DD}', ['date'], 'founder', 'tap', holidayRun(false));
  reg('set_reports_to', 'who someone reports to', '{person, manager}', ['person', 'manager'], 'founder', 'tap', async (ctx, nm, input, io) => {
    const u = member(ctx, nm, input.person);
    const mg = member(ctx, nm, input.manager);
    if (!u || !ctx.members[u]) throw new Error('no teammate called ' + input.person);
    if (!mg || !ctx.members[mg]) throw new Error('no teammate called ' + input.manager);
    if (u === mg) throw new Error('nobody reports to themselves');
    if (chainOf(ctx, mg).indexOf(u) >= 0) throw new Error(firstOf(nm, mg) + ' reports up to ' + firstOf(nm, u) + ' already, so that would make a loop');
    if (managerOf(ctx, u) === mg) return {ok: true, say: firstOf(nm, u) + ' reports to ' + firstOf(nm, mg) + ' already.'};
    const label = firstOf(nm, u) + ' will report to ' + firstOf(nm, mg);
    return tapHold(ctx, io, label, label + '. ' + firstOf(nm, mg) + '\'s bot chases them from tomorrow.', async c => {
      if (!c.members[u] || !c.members[mg]) throw new Error('that person is not on the roster now');
      if (chainOf(c, mg).indexOf(u) >= 0) throw new Error(firstOf(nm, mg) + ' reports up to ' + firstOf(nm, u) + ' now, so that would make a loop');
      const prev = c.members[u].reportsTo || '';
      /* written out even for Kaavish: an empty line would fall back to a pod lead */
      await c.W.merge('roster/team', {members: {[u]: {reportsTo: mg}}, updated: Date.now()});
      return {ok: true, say: label.replace('will report', 'reports') + '.', _undo: {k: 'roster', uid: u, prev}};
    }, 'founder');
  });
  reg('post_alert', 'an alert line for everyone', '{text, until? YYYY-MM-DD}', ['text'], 'founder', 'tap', async (ctx, nm, input, io) => {
    const text = cut(String(input.text || '').trim(), 140);
    if (!text) throw new Error('say the alert');
    const until = ymdOk(input.until) && input.until >= today() ? input.until : today();
    const prev = ctx.settings.alert || null;
    return tapHold(ctx, io, 'Show the alert until ' + U.fmtDay(until), text, async c => {
      const was = c.settings.alert || prev;
      await c.W.merge('settings/app', {alert: {text, until, at: Date.now()}, updated: Date.now()});
      return {ok: true, say: 'The alert is up until ' + U.fmtDay(until) + '.', _undo: {k: 'settings', patch: {alert: was}}};
    }, 'founder');
  });
  reg('clear_alert', 'take the alert down', '{}', [], 'founder', 'tap', async (ctx, nm, input, io) => {
    const prev = ctx.settings.alert || null;
    if (!prev) return {ok: true, say: 'No alert is up.'};
    return tapHold(ctx, io, 'Take the alert down', cut(prev.text, 140), async c => {
      const was = c.settings.alert || null;
      if (!was) return {ok: true, say: 'No alert is up.'};
      await c.W.merge('settings/app', {alert: null, updated: Date.now()});
      return {ok: true, say: 'Alert cleared.', _undo: {k: 'settings', patch: {alert: was}}};
    }, 'founder');
  });
  reg('decide_fix', 'approve or decline a correction', '{person, request? words or date, decision approve|decline, note?}', ['person', 'decision'], 'founder', 'tap', async (ctx, nm, input, io) => {
    if (!M.fixes) throw new Error('corrections are not on this build');
    const u = member(ctx, nm, input.person);
    if (!u) throw new Error('no teammate called ' + input.person);
    const q = norm(input.request);
    const open = M.fixes.pending(ctx).filter(x => x.uid === u);
    const x = q ? open.find(r => norm(r.req.date) === q || norm(r.req.want).includes(q) || norm(r.req.kind) === q || norm(r.req.field) === q) : open.length === 1 ? open[0] : null;
    if (!x) throw new Error(!open.length ? 'nothing pending from ' + firstOf(nm, u) : 'say which of ' + firstOf(nm, u) + '\'s ' + open.length + ' corrections, by its date or words');
    const status = /^(decline|declined|no|reject)/i.test(String(input.decision)) ? 'declined' : 'approved';
    const auto = status === 'approved' ? M.fixes.plan(ctx, u, x.req) : null;
    const what = (M.fixes.KIND_LABEL[x.req.kind] || 'other') + (x.req.date ? ', ' + U.fmtDay(x.req.date) : '') + ': ' + cut(x.req.want, 80);
    return tapHold(ctx, io, (status === 'approved' ? 'Approve ' : 'Decline ') + firstOf(nm, u) + '\'s correction', what + (auto ? '. Approving ' + auto.text + '.' : status === 'approved' ? '. Apply it by hand.' : ''), async c => {
      /* decided elsewhere in the meantime: the first decision stands */
      if (!M.fixes.pending(c).some(r => r.uid === u && r.id === x.id)) return {ok: false, say: 'That correction was decided already.'};
      if (auto) await c.W.merge(auto.path, auto.patch);
      await c.W.merge('fixes/' + u, {reqs: {[x.id]: {status, decidedAt: Date.now(), decidedNote: cut(String(input.note || '').trim(), 200)}}});
      return {ok: true, say: status === 'declined' ? 'Declined.' : auto ? 'Approved and applied.' : 'Approved. Apply the change by hand.'};
    }, 'founder');
  });
  reg('pm_policy', 'the personal manager policy', '{on?, wait? minutes, digestAt? HH:MM, perDay?}', [], 'founder', 'tap', async (ctx, nm, input, io) => {
    const cur = {...((M.SETTINGS_DEFAULTS && M.SETTINGS_DEFAULTS.pm) || {}), ...((ctx.settings && ctx.settings.pm) || {})};
    const patch = {};
    const bits = [];
    if (input.on != null) { patch.on = !(input.on === false || /^(off|false|no)$/i.test(String(input.on))); bits.push('personal managers ' + (patch.on ? 'on' : 'off')); }
    if (input.wait != null) { patch.wait = Math.max(Number(cur.waitMin) || 30, Math.min(Number(cur.waitMax) || 180, Math.round(Number(input.wait) || 60))); bits.push('a report has ' + patch.wait + ' minutes'); }
    if (input.digestAt != null) { if (!hmOk(input.digestAt)) throw new Error('digestAt is HH:MM'); patch.digestAt = String(input.digestAt).trim(); bits.push('the note up the line at ' + patch.digestAt); }
    if (input.perDay != null) { patch.perDay = Math.max(1, Math.min(12, Math.round(Number(input.perDay) || 4))); bits.push('at most ' + patch.perDay + ' bubbles a day'); }
    if (!bits.length) throw new Error('say what to change: on, wait, digestAt or perDay');
    return tapHold(ctx, io, cut('Set ' + andList(bits), 90), 'Everyone with a manager reads this policy.', async c => {
      const pm0 = (c.settings && c.settings.pm) || {};
      const was = {};
      Object.keys(patch).forEach(k => { was[k] = pm0[k] === undefined ? null : pm0[k]; });
      await c.W.merge('settings/app', {pm: patch, updated: Date.now()});
      return {ok: true, say: 'Done: ' + andList(bits) + '.', _undo: {k: 'settings', patch: {pm: was}}};
    }, 'founder');
  });

  /* wave 3: work and me */
  const handOk = (ctx, t) => t.owner === ctx.uid || t.by === ctx.uid || !!ctx.isFounder;
  reg('bulk_tasks', 'change many tasks at once', '{filter {owner?, project?, status?, overdue?, dueBefore?}, change {due?, owner?, status?, priority?}}', ['filter', 'change'], 'self', 'tap', async (ctx, nm, input, io) => {
    const f = input.filter && typeof input.filter === 'object' ? input.filter : {};
    const ch = input.change && typeof input.change === 'object' ? input.change : {};
    const td = today();
    const owner = f.owner ? member(ctx, nm, f.owner) : null;
    if (f.owner && !owner) throw new Error('no teammate called ' + f.owner);
    const pj = f.project ? M.brain.findProject(ctx, f.project) : null;
    if (f.project && !pj) throw new Error('no project matches ' + f.project);
    const all = Object.keys(ctx.coll.tasks.map).map(id => ({id, ...ctx.coll.tasks.map[id]})).filter(t => t && !t.deleted && t.title !== undefined);
    const hits = all.filter(t => (!owner || t.owner === owner) && (!pj || t.project === pj.id) && (!f.status ? t.status !== 'done' : t.status === f.status) &&
      (!f.overdue || (t.due && t.due < td && t.status !== 'done')) && (!ymdOk(f.dueBefore) || (t.due && t.due < f.dueBefore)));
    const mine = hits.filter(t => handOk(ctx, t));
    const theirs = hits.length - mine.length;
    if (!mine.length) return {ok: true, say: hits.length ? 'Those tasks are not yours to change: only their owner, the person who made them or Kaavish.' : 'No task matches that.'};
    if (mine.length > 25) throw new Error(mine.length + ' tasks match; the most at once is 25. Narrow the filter');
    const patch = {};
    if (ch.due !== undefined) { if (ch.due && !ymdOk(ch.due)) throw new Error('due is YYYY-MM-DD'); patch.due = ch.due || ''; }
    if (ch.owner) { const u = member(ctx, nm, ch.owner); if (!u) throw new Error('no teammate called ' + ch.owner); patch.owner = u; }
    if (ch.status) { if (['todo', 'doing', 'review', 'done'].indexOf(ch.status) < 0) throw new Error('status is todo, doing, review or done'); patch.status = ch.status; }
    if (ch.priority) { if (['low', 'normal', 'high'].indexOf(ch.priority) < 0) throw new Error('priority is low, normal or high'); patch.priority = ch.priority; }
    if (!Object.keys(patch).length) throw new Error('say what to change: due, owner, status or priority');
    const what = Object.keys(patch).map(k => k + ' ' + (k === 'owner' ? firstOf(nm, patch.owner) : patch[k] || 'none')).join(', ');
    return tapHold(ctx, io, 'Change ' + mine.length + (mine.length === 1 ? ' task' : ' tasks') + ': ' + cut(what, 50), mine.slice(0, 12).map(t => t.title).join('; ') + (mine.length > 12 ? ' and ' + (mine.length - 12) + ' more' : '') + (theirs ? '. ' + theirs + ' others are not yours to change.' : ''), async c => {
      const prev = [];
      let n = 0, kept = 0, gone = 0;
      for (const t0 of mine) {
        /* each task as it is now, still the viewer's to change */
        const t = c.coll.tasks.map[t0.id];
        if (!t || t.deleted || !handOk(c, t)) { gone++; continue; }
        prev.push({id: t0.id, due: t.due || '', owner: t.owner || '', status: t.status || 'todo', priority: t.priority || 'normal'});
        const r = await M.tasks.save(c, t0.id, patch);
        n++; if (r.locked) kept++;
      }
      return {ok: true, changed: n, say: 'Changed ' + n + (n === 1 ? ' task' : ' tasks') + '.' + (kept ? ' ' + kept + ' shipped ones kept their dates and owner.' : '') + (gone ? ' ' + gone + ' had moved on and were left alone.' : ''), _undo: n ? {k: 'tasks', prev} : null};
    });
  });
  reg('bin_task', 'put a task in the bin', '{task}', ['task'], 'self', 'tap', async (ctx, nm, input, io) => {
    const t = M.brain.findTask(ctx, input.task);
    if (!t) throw new Error('no task matches "' + input.task + '"');
    if (t.by !== ctx.uid && !ctx.isFounder) throw new Error('only the person who made it or the founder bins a task');
    return tapHold(ctx, io, 'Bin "' + cut(t.title, 40) + '"', 'It sits in the bin on Admin for thirty days and can come back.', async c => {
      const now = c.coll.tasks.map[t.id];
      if (!now || now.deleted) return {ok: true, say: 'It is in the bin already.'};
      if (now.by !== c.uid && !c.isFounder) throw new Error('only the person who made it or the founder bins a task');
      await M.tasks.binTask(c, t.id);
      return {ok: true, say: 'In the bin.', _undo: {k: 'unbin', id: t.id}};
    });
  });
  reg('archive_project', 'archive a project', '{project}', ['project'], 'self', 'tap', async (ctx, nm, input, io) => {
    const p = M.brain.findProject(ctx, input.project);
    if (!p) throw new Error('no project matches "' + input.project + '"');
    if (p.owner !== ctx.uid && !ctx.isFounder) throw new Error('only the project\'s owner or the founder archives it');
    return tapHold(ctx, io, 'Archive ' + cut(p.name, 50), 'Its tasks and numbers stay.', async c => {
      const now = c.coll.projects.map[p.id];
      if (!now || (now.owner !== c.uid && !c.isFounder)) throw new Error('only the project\'s owner or the founder archives it');
      await c.W.update('projects/' + p.id, {archived: true, archivedAt: Date.now(), updated: Date.now()});
      return {ok: true, say: 'Archived ' + p.name + '.', _undo: {k: 'unarchive', id: p.id}};
    });
  });
  reg('add_project_member', 'add someone to a project', '{project, person}', ['project', 'person'], 'self', 'now', async (ctx, nm, input) => {
    const p = M.brain.findProject(ctx, input.project);
    if (!p) throw new Error('no project matches "' + input.project + '"');
    if (p.owner !== ctx.uid && !ctx.isFounder) throw new Error('only the project\'s owner or the founder adds people');
    const u = member(ctx, nm, input.person);
    if (!u) throw new Error('no teammate called ' + input.person);
    const was = (p.members || []).slice();
    if (was.indexOf(u) >= 0) return {ok: true, say: firstOf(nm, u) + ' is on ' + p.name + ' already.'};
    await ctx.W.update('projects/' + p.id, {members: was.concat([u])});
    return {ok: true, say: 'Added ' + firstOf(nm, u) + ' to ' + p.name + '.', _undo: {k: 'members', id: p.id, prev: was}};
  });
  reg('set_pref', 'theme, sounds, reading replies aloud', '{theme? light|dark|auto, sounds? on|off, speakReplies? on|off}', [], 'self', 'now', async (ctx, nm, input) => {
    const bits = [];
    const onOff = v => !(v === false || /^(off|false|no|0)$/i.test(String(v)));
    if (input.theme) { const t = norm(input.theme); if (['light', 'dark', 'auto'].indexOf(t) < 0) throw new Error('theme is light, dark or auto'); M.theme.set(t); bits.push(t + ' mode'); }
    if (input.sounds != null) { M.sound.set(onOff(input.sounds)); bits.push('sounds ' + (onOff(input.sounds) ? 'on' : 'off')); }
    if (input.speakReplies != null) { M.prefs.set('askAloud', onOff(input.speakReplies) ? '1' : '0'); M.prefs.set('buddyVoice', onOff(input.speakReplies) ? '1' : '0'); bits.push('replies ' + (onOff(input.speakReplies) ? 'read aloud' : 'on screen only')); }
    if (!bits.length) throw new Error('say what to set: theme, sounds or speakReplies');
    return {ok: true, say: 'Set: ' + andList(bits) + '.'};
  });
  reg('request_fix', 'ask Kaavish for a correction', '{kind attendance|leave|task|profile|other, field?, date? YYYY-MM-DD, want, note?}', ['want'], 'self', 'now', async (ctx, nm, input) => {
    const kinds = ['attendance', 'leave', 'task', 'profile', 'other'];
    const kind = kinds.indexOf(input.kind) >= 0 ? input.kind : 'other';
    const want = cut(String(input.want || '').trim(), 200);
    if (!want) throw new Error('say what it should be');
    const id = U.uid();
    const req = {kind, date: ymdOk(input.date) ? input.date : '', field: String(input.field || '').trim().slice(0, 20), want, note: cut(String(input.note || '').trim(), 300), at: Date.now(), status: 'pending', decidedAt: null, decidedNote: ''};
    await ctx.W.merge('fixes/' + ctx.uid, {reqs: {[id]: req}});
    return {ok: true, say: 'Sent to Kaavish.'};
  });
  reg('withdraw_leave', 'withdraw a pending leave request', '{from? YYYY-MM-DD}', [], 'self', 'now', async (ctx, nm, input) => {
    const reqs = ((ctx.coll.leave.map[ctx.uid] || {}).reqs) || [];
    const dec = ((ctx.coll.leavedec.map[ctx.uid] || {}).d) || {};
    const open = reqs.filter(r => r && !dec[r.id]);
    const r = (ymdOk(input.from) ? open.find(x => x.from === input.from) : null) || open[0];
    if (!r) throw new Error('no pending leave request to withdraw');
    await ctx.W.merge('leave/' + ctx.uid, {reqs: U.clone(reqs).filter(x => x.id !== r.id)});
    return {ok: true, say: 'Withdrew the leave request for ' + U.fmtDay(r.from) + (r.to !== r.from ? ' to ' + U.fmtDay(r.to) : '') + '.'};
  });

  /* wave 4: the m360 COO (M.coo). Kaavish's own hand on the bot colleague: stop and pause land at once
     (the kill switch is never a tap away), everything else waits on one tap or one spoken yes. The answers
     come from the COO's ledger and its cards, in the words M.coo.copy gives them, with no model call. A
     member asks only about their own work and what the COO may do. */
  const cooOn = () => !!(M.coo && M.coo.feed);
  const IST_MS = 330 * MIN;
  const istYmd = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);
  const istAt = (ymd, hm) => Date.parse(ymd + 'T00:00:00Z') - IST_MS + U.minutes(hm) * MIN;
  const istAdd = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  /* "till Monday", "until tomorrow", "till 4", "for an hour", "2026-10-12": the moment the pause ends, in IST.
     A day means its 09:00, when the COO's day opens; a clock time is an IST one wherever Kaavish is. Nothing
     said is null (the COO picks tomorrow's start); words it cannot read are undefined */
  const COUNT = {a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
  function cooUntil(text, now) {
    const s = norm(text).replace(/^(till|until|to|for)\s+/, '');
    now = now || Date.now();
    if (!s) return null;
    const td = istYmd(now);
    const dow = new Date(td + 'T00:00:00Z').getUTCDay();
    if (ymdOk(s)) return istAt(s, '09:00');
    if (/^tomorrow( morning)?$/.test(s)) return istAt(istAdd(td, 1), '09:00');
    if (s === 'next week') return istAt(istAdd(td, ((8 - dow) % 7) || 7), '09:00');
    const d = DAYS.findIndex(x => s === x || s === x.slice(0, 3) || s === 'next ' + x);
    if (d >= 0) return istAt(istAdd(td, ((d - dow + 7) % 7) || 7), '09:00');
    /* a stretch: "an hour", "half an hour", "30 minutes", "two days" */
    let m = /^(?:in )?(half an|\d+|[a-z]+) ?(hours?|hrs?|minutes?|mins?|days?)$/.exec(s);
    if (m && (m[1] === 'half an' || /^\d+$/.test(m[1]) || COUNT[m[1]])) {
      const n = m[1] === 'half an' ? 0.5 : /^\d+$/.test(m[1]) ? Number(m[1]) : COUNT[m[1]];
      if (/^d/.test(m[2])) return istAt(istAdd(td, Math.max(1, Math.round(n))), '09:00');
      return now + Math.round(n * (/^h/.test(m[2]) ? 60 : 1)) * MIN;
    }
    m = /^(\d{1,2}|[a-z]+)(?::(\d{2})|( thirty))? ?(am|pm)?$/.exec(s);
    if (m && (/^\d/.test(m[1]) || NUMW[m[1]])) {
      let h = /^\d/.test(m[1]) ? Number(m[1]) : NUMW[m[1]];
      const mm = m[2] ? Number(m[2]) : m[3] ? 30 : 0;
      if (h > 23 || mm > 59) return undefined;
      if (m[4] === 'pm' && h < 12) h += 12;
      else if (m[4] === 'am' && h === 12) h = 0;
      else if (!m[4] && h <= 8) h += 12;
      const t = istAt(td, U.pad(h) + ':' + U.pad(mm));
      return t > now ? t : t + 86400000;
    }
    if (/^(the )?(end of (the )?day|eod|tonight)$/.test(s)) { const t = timeFrom(s, now); if (t && t.ms) return t.ms > now ? t.ms : undefined; }
    return undefined;
  }
  /* the COO's settled rows, newest first: done, would (the practice week) and failed */
  const cooRows = ctx => { try { return (M.coo.feed(ctx, 0) || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)); } catch (e) { return []; } };
  const cooOpen = row => !!row && row.status === 'done' && Number(row.undoUntil) > Date.now();
  const whyCode = row => row && row.why && typeof row.why === 'object' ? row.why.code : row && row.why;
  const cooLine = (ctx, row) => {
    const c = M.coo.copy(row.code, {...(row.args || {}), ...(row.status === 'would' ? {would: true} : {}), why: whyCode(row)}, 'founder', ctx) || {};
    return {line: c.line || ((M.coo.JOBS || {})[row.job] || {}).label || 'An act of mine', why: c.why || ''};
  };
  /* the row a question is about: a person's leave or WFH decision, a task by its title, an id, or the last
     one a "why" answered ("undo that"). For an undo (o.open) a row that can still be put back wins */
  let cooTalk = null;
  const LEAVE_JOBS = ['J10', 'J11'];
  const leaveJobs = kind => kind === 'wfh' ? ['J11'] : kind === 'leave' ? ['J10'] : LEAVE_JOBS;
  /* an approval made before yesterday is off the page's two ledger days, yet undoable until the leave starts:
     its row is read from the day the decision was made */
  async function cooLeaveRow(ctx, u, jobs) {
    const dec = ((ctx.coll.leavedec.map[u] || {}).d) || {};
    const ids = Object.keys(dec).filter(id => dec[id] && dec[id].by === M.coo.UID && dec[id].status === 'approved').sort((a, b) => (dec[b].at || 0) - (dec[a].at || 0));
    for (const id of ids.slice(0, 4)) {
      const day = istYmd(Number(dec[id].at) || 0);
      const doc = await ctx.db.doc('coo/L-' + day).get().then(x => (x && x.exists ? x.data() : null), () => null);
      const acts = (doc && doc.acts) || {};
      const k = Object.keys(acts).find(x => acts[x] && (acts[x].refs || {}).uid === u && (acts[x].refs || {}).req === id && jobs.indexOf(acts[x].job) >= 0 && acts[x].status !== 'running');
      if (k) { const r = acts[k]; return {...r, id: k, ymd: day, args: r.args || {}, refs: r.refs || {}, undoUntil: r.undo && r.status === 'done' ? Number(r.undo.until) || 0 : 0}; }
    }
    return null;
  }
  async function cooRow(ctx, nm, input, o) {
    const rows = cooRows(ctx);
    const best = f => (o && o.open && rows.find(r => f(r) && cooOpen(r))) || rows.find(f) || null;
    const q = String(input.subject || input.task || '').trim();
    if (input.act && input.act !== 'last') return rows.find(r => r.id === input.act) || (cooTalk && cooTalk.id === input.act ? cooTalk.row || null : null);
    if (input.person) {
      const u = member(ctx, nm, input.person);
      if (!u) throw new Error('no teammate called ' + input.person);
      const leave = input.kind === 'leave' || input.kind === 'wfh';
      const jobs = leaveJobs(input.kind);
      const hit = best(r => (r.refs || {}).uid === u && (!leave || jobs.indexOf(r.job) >= 0));
      return hit && (!leave || !o || !o.open || cooOpen(hit)) ? hit : (leave ? (await cooLeaveRow(ctx, u, jobs)) || hit : hit);
    }
    if (q) {
      const t = M.brain.findTask(ctx, q.replace(/^(the|my)\s+/i, ''));
      const hit = t ? best(r => (r.refs || {}).task === t.id) : null;
      if (hit) return hit;
      const w = M.coo.why ? M.coo.why(ctx, q) : null;
      return w ? rows.find(r => r.id === w.id) || {...w, undoUntil: w.undo && w.status === 'done' ? Number(w.undo.until) || 0 : 0} : null;
    }
    if (cooTalk && Date.now() - cooTalk.at < 30 * MIN) return rows.find(r => r.id === cooTalk.id) || cooTalk.row || null;
    return rows.find(cooOpen) || null;
  }
  const said = v => v !== null && v !== undefined && v !== '';
  const checkTxt = k => k.k + (said(k.val) ? ' ' + k.val : '') + (said(k.limit) ? ' (limit ' + k.limit + ')' : '') + (k.ok === false ? ', not met' : '');
  /* the answer to "why did you ...": the line, its reason, the checks with their values, and Undo while it holds */
  function cooWhyLine(ctx, row) {
    const full = (M.coo.why && M.coo.why(ctx, row.id)) || row;
    const c = cooLine(ctx, {...full, ...row});
    const checks = (full.checks || []).filter(k => k && k.k);
    cooTalk = {id: row.id, at: Date.now(), row};
    const tail = cooOpen(row) ? ' Say undo to put it back.' : full.status === 'undone' ? ' You undid it.' : row.status === 'would' ? ' That was the practice week, so nothing changed.' : '';
    return c.line + (c.why ? ' ' + c.why : '') + (checks.length ? ' Checks: ' + checks.slice(0, 8).map(checkTxt).join('; ') + '.' : '') + tail;
  }
  /* a card by its words ("the Swisse follow-up"), by a person ("Riya's leave"), or by its id */
  const MAIL_KINDS = ['client_mail', 'meeting_mail', 'invoice_reminder'];
  const CARD_WORDS = /\b(the|a|an|my|draft|drafted|card|mail|email|note|follow up|followup|follow|up|reminder|confirm|for|to)\b/g;
  function cooCard(ctx, nm, input) {
    const list = M.coo.decisions(ctx) || [];
    if (input.card && list.some(k => k.id === input.card)) return list.find(k => k.id === input.card);
    if (input.person) {
      const u = member(ctx, nm, input.person);
      if (!u) throw new Error('no teammate called ' + input.person);
      const leave = input.kind === 'leave' || input.kind === 'wfh';
      return list.find(k => (k.refs || {}).uid === u && (!leave || k.kind === 'leave' || k.kind === 'wfh')) || null;
    }
    const mail = input.how === 'send' || input.kind === 'mail';
    const words = norm(input.card).replace(CARD_WORDS, ' ').trim().split(/\s+/).filter(w => w.length > 1);
    const pool = list.filter(k => !mail || MAIL_KINDS.indexOf(k.kind) >= 0);
    const text = k => { const d = ((k.payload || {}).draft) || {}; return norm([k.title, k.why, d.to, d.subject].join(' ')); };
    const hits = words.length ? pool.filter(k => words.every(w => text(k).indexOf(w) >= 0)) : pool;
    if (hits.length > 1) throw new Error(hits.length + ' cards match. Say which: ' + hits.slice(0, 3).map(k => cut(k.title, 50)).join('; '));
    return hits[0] || null;
  }
  const HOW = {apply: 'Apply', send: 'Send', decline: 'Decline', later: 'Later'};
  /* the tap's title: short, in whole words. A leave by its person, a move by its task, anything else by its line */
  const clip = (s, n) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '').replace(/[,.;:]$/, '');
  function undoLabel(ctx, nm, row, line) {
    const r = row.refs || {};
    if (LEAVE_JOBS.indexOf(row.job) >= 0 && r.uid) return 'Undo ' + firstOf(nm, r.uid) + '\'s ' + (row.job === 'J11' ? 'WFH' : 'leave') + ' approval';
    const t = r.task ? ctx.coll.tasks.map[r.task] : null;
    if (t && t.title) return 'Put ' + clip(t.title, 60) + ' back';
    return 'Undo: ' + clip(line, 80);
  }

  reg('coo_stop', 'stop the COO at once', '{}', [], 'founder', 'now', async ctx => {
    const r = await M.coo.stop(fresh(ctx)) || {};
    return {ok: r.ok !== false, say: r.say || 'Stopped.'};
  }, {needs: 'coo'});
  reg('coo_pause', 'pause the COO until a time', '{until? a day|tomorrow|HH:MM}', [], 'founder', 'now', async (ctx, nm, input) => {
    const until = cooUntil(input.until, Date.now());
    if (until === undefined) throw new Error('say until when: a day, tomorrow or a time');
    const r = await M.coo.pause(fresh(ctx), until || undefined) || {};
    return {ok: r.ok !== false, until: until || null, say: r.say || 'Paused.'};
  }, {needs: 'coo'});
  reg('coo_resume', 'switch the COO back on', '{}', [], 'founder', 'tap', async (ctx, nm, input, io) =>
    tapHold(ctx, io, 'Switch the COO back on', 'It picks up from the next round, inside the mandate you set.', async c => {
      const r = await M.coo.resume(c) || {};
      return {ok: r.ok !== false, say: r.say || 'Back on.'};
    }, 'founder'), {needs: 'coo'});
  /* a read: it answers at once, and Undo is the tap it offers */
  reg('coo_why', 'why the COO did something', '{subject? a task or a person, person?, kind? leave|wfh}', [], 'founder', 'tap', async (ctx, nm, input) => {
    const row = await cooRow(ctx, nm, input);
    if (!row) return {ok: true, read: true, say: input.person ? 'I have not decided anything for ' + firstOf(nm, member(ctx, nm, input.person)) + ' lately.' : 'I have not moved that lately.'};
    return {ok: true, read: true, act: row.id, say: cooWhyLine(ctx, row)};
  }, {needs: 'coo', read: true});
  reg('coo_undo', 'put back something the COO did', '{act? last|id, task?, person?, kind? leave|wfh}', [], 'founder', 'tap', async (ctx, nm, input, io) => {
    const row = await cooRow(ctx, nm, input, {open: true});
    if (!row) throw new Error('I cannot find that act of mine');
    if (!cooOpen(row)) throw new Error(row.status === 'would' ? 'that was the practice week, so nothing changed' : 'too late to undo that one');
    const line = cooLine(ctx, row).line.replace(/\s*(Undo for 24 hours|Undo until [^.]*)\.\s*$/, '');
    cooTalk = {id: row.id, at: Date.now(), row};
    return tapHold(ctx, io, undoLabel(ctx, nm, row, line), line + ' I put it back as you, field by field, and anyone I told hears it. If someone changed it since, it stays and I say what changed.', async c => {
      const r = await M.coo.undo(c, row.id) || {};
      return {ok: !!r.ok, conflict: !!r.conflict, say: r.say || (r.ok ? 'Put back.' : 'That did not undo.')};
    }, 'founder');
  }, {needs: 'coo'});
  reg('coo_decide', 'settle one of the COO\'s cards', '{card? words or id, person?, kind? leave|wfh|mail, how? apply|send|decline|later, option? number}', [], 'founder', 'tap', async (ctx, nm, input, io) => {
    const how = HOW[input.how] ? input.how : 'apply';
    const card = cooCard(ctx, nm, input);
    if (!card) {
      /* no card for that leave: Kaavish's own decision, as before, on a request of the kind he named (a WFH
         day is never approved for a leave, nor the other way round) */
      if (input.person && how === 'apply' && input.kind !== 'mail') {
        const u = member(ctx, nm, input.person);
        if (!u) throw new Error('no teammate called ' + input.person);
        const dec = ((ctx.coll.leavedec.map[u] || {}).d) || {};
        const wfh = input.kind === 'wfh';
        const r = ((ctx.coll.leave.map[u] || {}).reqs || []).find(x => x && !dec[x.id] && (!input.kind || (x.type === 'wfh') === wfh));
        if (!r) throw new Error('nothing pending for ' + firstOf(nm, u) + (input.kind ? (wfh ? ' on WFH' : ' on leave') : ''));
        return byName('decide_leave').run(ctx, nm, {person: input.person, from: r.from, status: 'approved'}, io);
      }
      throw new Error('no card of mine matches that');
    }
    const d = ((card.payload || {}).draft) || {};
    const mail = MAIL_KINDS.indexOf(card.kind) >= 0 && (how === 'send' || how === 'apply');
    if (mail && !String(d.to || '').trim()) throw new Error('the draft has nobody to send it to yet. Add the address on the card first');
    const opt = input.option != null && input.option !== '' && Number.isFinite(Number(input.option)) ? {option: Number(input.option)} : undefined;
    const who = (card.refs || {}).uid;
    const label = mail ? 'Send to ' + d.to : how === 'apply' && who && (card.kind === 'leave' || card.kind === 'wfh') ? 'Approve ' + firstOf(nm, who) + '\'s ' + (card.kind === 'wfh' ? 'WFH' : 'leave') : HOW[how] + ': ' + card.title;
    const detail = mail ? 'Subject: ' + (d.subject || 'none') + '. It goes from your own mail, in the thread.' : (card.why || card.recommend || '');
    const held = tapHold(ctx, io, cut(label, 90), detail, async c => {
      /* the yes stands for what was read back: a draft edited or redrafted since sends nothing until he looks again */
      if (mail) {
        const k = (M.coo.decisions(c) || []).find(x => x.id === card.id);
        const d2 = k ? ((k.payload || {}).draft) || {} : null;
        if (!d2 || ['to', 'cc', 'subject'].some(f => String(d2[f] || '') !== String(d[f] || ''))) return {ok: false, say: 'The draft changed since I read it to you, so nothing went. Look at the card first.'};
      }
      const r = await M.coo.decide(c, card.id, how === 'later' ? 'snooze' : mail ? 'send' : how, opt) || {};
      return {ok: r.ok !== false, say: r.say || 'Done.'};
    }, 'founder');
    /* client mail reads the recipient and the subject back before the yes */
    return {...held, card: card.id, say: mail ? 'It goes to ' + d.to + (String(d.cc || '').trim() ? ', a copy to ' + d.cc : '') + ', subject "' + cut(d.subject || 'none', 80) + '". Say yes to send.' : held.label + ' is ready. Tap it, or say yes.'};
  }, {needs: 'coo'});
  reg('coo_rebalance_now', 'a rebalance pass now', '{}', [], 'founder', 'tap', async (ctx, nm, input, io) =>
    tapHold(ctx, io, 'Rebalance the load now', 'A fresh load snapshot and one rebalance pass, inside the mandate: internal work only, never a client date.', async c => {
      if (!M.coo.rebalanceNow) throw new Error('rebalance now is not on this build');
      const r = await M.coo.rebalanceNow(c) || {};
      /* off, paused or stuck, or outside the working day: nothing ran, and the answer says why */
      if (r.stopped) return {ok: false, say: r.state === 'paused' ? 'The COO is paused, so nothing moved. Say COO resume first.' : r.state === 'stuck' ? 'The COO is held on a refused write, so nothing moved. Its card says what to look at.' : 'The COO is off, so nothing moved.'};
      const td = istYmd(Date.now()), mins = Math.floor(((Date.now() + IST_MS) % 86400000) / MIN);
      if (!r.acts && (new Date(td + 'T00:00:00Z').getUTCDay() === 0 || ((c.settings || {}).holidays || []).indexOf(td) >= 0 || mins < 540 || mins > 1260)) return {ok: false, say: 'I move work only on working days, 09:00 to 21:00, so nothing moved.'};
      const n = (r.rows || []).filter(x => x && x.job === 'J31' && (x.status === 'done' || x.status === 'would')).length;
      return {ok: true, say: r.practice ? (n ? 'Practice week: I would have made ' + n + (n === 1 ? ' move.' : ' moves.') : 'Practice week: nothing needed moving.')
        : n ? 'Done. I made ' + n + (n === 1 ? ' move' : ' moves') + ', each undoable for 24 hours.' : 'Done. Nothing needed moving.'};
    }, 'founder'), {needs: 'coo'});
  /* a member's own work the COO moved in the last two weeks: from the task logs, never the COO's ledger */
  function cooMine(ctx, nm, q) {
    const uid = ctx.uid, bot = M.coo.UID, since = Date.now() - 14 * 86400000;
    const t0 = q ? M.brain.findTask(ctx, q) : null;
    const out = [];
    for (const id of Object.keys(ctx.coll.tasks.map)) {
      const t = ctx.coll.tasks.map[id];
      if (!t || t.deleted || (t0 && t0.id !== id)) continue;
      const logs = (Array.isArray(t.ownerLog) ? t.ownerLog : []).map(x => ({...x, k: 'owner'})).concat((Array.isArray(t.dueLog) ? t.dueLog : []).map(x => ({...x, k: 'due'})));
      const mine = logs.filter(x => x && x.by === bot && (x.at || 0) >= since && (x.k === 'owner' ? x.from === uid || x.to === uid : t.owner === uid));
      if (!mine.length) continue;
      const last = mine.sort((a, b) => (b.at || 0) - (a.at || 0))[0];
      const note = Object.keys(t.comments || {}).map(k => t.comments[k]).filter(c => c && c.by === bot).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
      const what = last.k === 'due' ? 'moved its date to ' + (last.to ? U.fmtDay(last.to) : 'none') : last.to === uid ? 'handed it to you' : 'handed it to ' + firstOf(nm, last.to);
      out.push({at: last.at, line: cut(t.title, 60) + ': on ' + U.fmtDay(U.ymd(new Date(last.at))) + ' the COO ' + what + '.' + (note ? ' It said: ' + cut(note.t, 200) : '')});
    }
    return out.sort((a, b) => b.at - a.at);
  }
  /* the reads: what waits on Kaavish, what the COO did today (his), its own work (a member's), its charter (anyone) */
  reg('coo_info', 'what the COO is up to, or did to my work', '{what needs|done|can|mine, task?}', ['what'], 'self', 'now', async (ctx, nm, input) => {
    const what = ['needs', 'done', 'can', 'mine'].indexOf(input.what) >= 0 ? input.what : 'can';
    if ((what === 'needs' || what === 'done') && !ctx.isFounder) throw new Error('that is Kaavish\'s to read. Ask what the COO can do, or why it moved your task');
    if (what === 'needs') {
      const list = M.coo.decisions(ctx) || [];
      if (M.nav) M.nav('#coo');
      if (!list.length) return {ok: true, read: true, n: 0, say: 'Nothing needs you right now.'};
      return {ok: true, read: true, n: list.length, say: (list.length === 1 ? 'One thing needs you: ' : list.length + ' things need you. The first ' + Math.min(3, list.length) + ': ') +
        list.slice(0, 3).map(k => cut(k.title, 90).replace(/\.$/, '')).join('; ') + '.'};
    }
    if (what === 'done') {
      const td = istYmd(Date.now());
      const rows = cooRows(ctx).filter(r => istYmd(r.at || 0) === td && (r.status === 'done' || r.status === 'would'));
      if (!rows.length) return {ok: true, read: true, n: 0, say: 'Nothing yet today.'};
      const open = rows.filter(cooOpen).length;
      return {ok: true, read: true, n: rows.length, say: (rows.length === 1 ? 'One thing today. ' : rows.length + ' things today. The latest: ') + rows.slice(0, 3).map(r => cooLine(ctx, r).line).join(' ') +
        (rows.length > 3 ? ' The rest are on the COO tab.' : '') + (open ? ' ' + (open === 1 ? 'One' : open) + ' can still be undone.' : '')};
    }
    if (what === 'mine') {
      const rows = cooMine(ctx, nm, input.task);
      if (!rows.length) return {ok: true, read: true, n: 0, say: 'The COO has not moved ' + (input.task ? 'that task' : 'any of your work') + ' in the last two weeks.'};
      return {ok: true, read: true, n: rows.length, say: rows.slice(0, 3).map(r => r.line).join(' ') + ' If it should go back, ask Kaavish. He can undo it.'};
    }
    const ch = M.coo.charter ? M.coo.charter(ctx) : null;
    const lines = ch ? [ch.alone, ch.tell, ch.draft, ch.propose, ch.never].filter(Boolean) : [];
    /* the charter speaks as the COO, so the line before it does too */
    return {ok: true, read: true, say: 'I am ' + (M.coo.title ? M.coo.title(ctx) : 'm360 COO') + ', a bot that helps Kaavish run the day. ' + (lines.length ? lines.join(' ') : 'My charter is on the COO page.') +
      (ctx.isFounder ? '' : ' Kaavish reads what you send me, and he can undo anything I change.')};
  }, {needs: 'coo', read: true});

  /* never pressed by the agent: these are pointed at, and the person presses them */
  const NEVER = /^(delete|erase|purge|offboard|restore|sign_?out|signout|lock|unlock|run_payroll|payroll|mark_paid|approve_payroll|issue_letter|sign_letter|letter|approve_own|answer_pulse|pulse|score_candidate|prune|export|change_key|set_key|ai_key|mail_key|voice_key)/;

  /* ---------- who sees what ---------- */
  const actionsFor = ctx => ACTIONS.filter(a => allowed(ctx, a));

  /* ---------- the ledger: data/users/<uid>/agent, the last 200 runs, private ---------- */
  const LEDGER_KEEP = 200;
  const UNDO_MS = 10000;
  const ledger = {path: '', runs: null, loading: null, writing: Promise.resolve(), subs: new Set()};
  const ledgerPath = ctx => 'data/users/' + ctx.uid + '/agent';
  const tellLedger = () => ledger.subs.forEach(f => { try { f(); } catch (e) { /* a view went away */ } });
  function loadLedger(ctx) {
    const p = ledgerPath(ctx);
    if (ledger.path === p && ledger.runs) return Promise.resolve(ledger.runs);
    if (ledger.path === p && ledger.loading) return ledger.loading;
    ledger.path = p; ledger.runs = null;
    ledger.loading = ctx.db.doc(p).get().then(s => (s && s.exists ? ((s.data() || {}).runs || []) : []), () => []).then(r => {
      if (ledger.path !== p) return r;
      /* runs recorded while the read was in flight stay, after the stored ones */
      const fresh = (ledger.pendingRuns || []).filter(x => x.path === p).map(x => x.run);
      ledger.pendingRuns = [];
      ledger.runs = (Array.isArray(r) ? r : []).filter(x => !fresh.some(f => f.id === x.id)).concat(fresh).slice(-LEDGER_KEEP);
      ledger.loading = null; tellLedger();
      return ledger.runs;
    });
    return ledger.loading;
  }
  /* the ledger is bookkeeping: it is written quietly (no log line, and no activity stamp, so asking
     m360 for something never counts as saved work or ends a quiet stretch), it stays well inside the
     size one document may have, and runs another tab of the same person wrote are kept */
  const LEDGER_BYTES = 160000;
  const fit = runs => { let out = runs.slice(-LEDGER_KEEP); while (out.length > 1 && JSON.stringify(out).length > LEDGER_BYTES) out = out.slice(Math.max(1, Math.ceil(out.length / 10))); return out; };
  const quietWrite = (db, p, d) => db.doc(p).update(d).catch(e => {
    if (e && (e.code === 'not_found' || (e.code === 'invalid_argument' && /missing/i.test(String(e.message || ''))))) return db.doc(p).set(d);
    throw e;
  });
  function persist(ctx) {
    if (!ctx || ctx.viewAs || !ctx.db) return;
    const p = ledgerPath(ctx);
    ledger.writing = ledger.writing.then(() => loadLedger(ctx)).then(() => ctx.db.doc(p).get().then(s => (s && s.exists ? ((s.data() || {}).runs || []) : []), () => [])).then(stored => {
      if (ledger.path !== p || !ledger.runs) return null;
      const mine = new Set(ledger.runs.map(r => r.id));
      const theirs = (Array.isArray(stored) ? stored : []).filter(r => r && r.id && !mine.has(r.id));
      if (theirs.length) ledger.runs = ledger.runs.concat(theirs).sort((x, y) => (x.at || 0) - (y.at || 0));
      ledger.runs = fit(ledger.runs);
      return quietWrite(ctx.db, p, {runs: ledger.runs, at: Date.now()});
    }).catch(() => {});
    tellLedger();
    return ledger.writing;
  }
  const trimInput = x => { try { const s = JSON.stringify(x || {}); return s.length > 400 ? {text: s.slice(0, 400)} : JSON.parse(s); } catch (e) { return {}; } };
  /* one turn is one run; each act in it is a row */
  function record(ctx, turn, a, input) {
    if (!ctx || ctx.viewAs) return null;
    const p = ledgerPath(ctx);
    const runId = (turn && turn.id) || U.uid();
    const row = {id: U.uid(), action: a.name, input: trimInput(input), result: '', undo: null, status: 'running', at: Date.now()};
    const put = runs => {
      let run = runs.find(r => r.id === runId);
      if (!run) { run = {id: runId, at: Date.now(), said: cut((turn && turn.said) || '', 300), via: (turn && turn.via) || 'typed', acts: []}; runs.push(run); }
      run.acts.push(row);
      return run;
    };
    if (ledger.path === p && ledger.runs) put(ledger.runs);
    else {
      ledger.pendingRuns = ledger.pendingRuns || [];
      let pr = ledger.pendingRuns.find(x => x.run.id === runId && x.path === p);
      if (!pr) { pr = {path: p, run: {id: runId, at: Date.now(), said: cut((turn && turn.said) || '', 300), via: (turn && turn.via) || 'typed', acts: []}}; ledger.pendingRuns.push(pr); }
      pr.run.acts.push(row);
      loadLedger(ctx);
    }
    return row;
  }
  function settle(ctx, row, status, r) {
    if (!row) return;
    row.status = status;
    if (r && typeof r === 'object') {
      row.result = cut(r.say || r.note || r.label || (r.ok ? 'done' : ''), 200);
      if (r._undo) { row.undo = r._undo; row.doneAt = Date.now(); }
    } else if (typeof r === 'string') row.result = cut(r, 200);
    persist(ctx);
  }
  const allRows = () => {
    const out = [];
    (ledger.runs || []).forEach(run => (run.acts || []).forEach(a => out.push({run, a})));
    (ledger.pendingRuns || []).forEach(x => (x.run.acts || []).forEach(a => out.push({run: x.run, a})));
    return out;
  };
  const undoable = row => {
    if (!row || !row.undo || row.status !== 'done') return false;
    if (row.undo.k === 'ask') return row.undo.day === today();
    return Date.now() - (row.doneAt || row.at || 0) <= UNDO_MS;
  };

  /* ---------- run an action: rights, fields, the taint rule, the ledger ---------- */
  async function exec(ctx, nm, name, input, io) {
    io = io || {};
    const key = norm(name).replace(/[^a-z_]/g, '');
    const a = byName(key);
    const turn = io.turn || null;
    const rich = io.rich !== false && !!io.log && !!turn;
    const log = io.log ? (x => io.log(rich || typeof x === 'string' ? x : (x && x.text) || '')) : null;
    if (!a) {
      if (NEVER.test(key)) return {ok: false, never: true, note: 'That one is the person\'s own to press. Point at it on screen and say so.'};
      throw new Error('unknown action "' + name + '". The actions are: ' + actionsFor(ctx).map(x => x.name).join(', '));
    }
    if (!allowed(ctx, a)) throw new Error(refusal(a));
    input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const miss = (a.schema.required || []).filter(k => input[k] === undefined || input[k] === null || input[k] === '');
    if (miss.length) throw new Error(a.name + ' needs ' + miss.join(', ') + '. Its fields: ' + a.sig);
    nm = nm && Object.keys(nm).length ? nm : await names(ctx);
    namesNow(ctx, nm);
    const row = io.row || record(ctx, turn, a, input);
    /* the taint rule: once this turn has read untrusted text, anything outward waits for a tap (handing a task on counts) */
    const outward = a.out || (a.name === 'update_task' && !!input.owner);
    if (turn && turn.tainted && outward && !io.approved) {
      const from = turn.from || 'a message';
      const held = M.brain.hold(a.gloss.replace(/^./, c => c.toUpperCase()), 'From what I read in ' + from + '. ' + cut(JSON.stringify(input), 240),
        () => exec(fresh(ctx), nm, a.name, input, {...io, approved: true, row, turn: {...turn, tainted: false}}), {turn, from});
      settle(ctx, row, 'held', held);
      return held;
    }
    try {
      const r = await a.run(ctx, nm, input, {...io, log, turn, from: turn && turn.tainted ? turn.from : ''});
      /* a card waiting on a tap: its run settles this row when the tap (or the spoken yes) comes */
      const card = r && r.waiting && r.id ? M.brain.pending.list.find(x => x.id === r.id) : null;
      if (card) {
        const run0 = card.run;
        card.run = async o => {
          try { const x = await run0(o); settle(ctx, row, 'done', x); return x; } catch (e) { settle(ctx, row, 'failed', (e && e.message) || 'failed'); throw e; }
        };
      }
      const out = r && typeof r === 'object' ? {...r} : r;
      if (out && out._undo) { out.undoId = row ? row.id : null; out.undoable = true; cooTalk = null; }
      settle(ctx, row, r && r.waiting ? 'held' : 'done', r);
      if (out && typeof out === 'object') delete out._undo;
      return out;
    } catch (e) {
      settle(ctx, row, 'failed', (e && e.message) || 'failed');
      throw e;
    }
  }

  /* ---------- undo, by data, so it works from History after a reload too ---------- */
  async function undoRow(ctx, row) {
    const u = row.undo;
    switch (u.k) {
      case 'ask': needPm('withdraw'); for (const id of u.ids || []) await M.pm.withdraw(ctx, id); return 'Taken back. They see it marked withdrawn.';
      case 'msg':
        if (!M.rooms || !M.rooms.remove) throw new Error('that message stays; delete it in Chat');
        for (const x of u.items || []) await M.rooms.remove(ctx, x.room, x.id);
        return (u.items || []).length === 1 ? 'Message deleted.' : 'Messages deleted.';
      case 'task': await M.tasks.save(fresh(ctx), u.id, u.prev || {}); return 'The task is back as it was.';
      case 'tasks': { const c = fresh(ctx); for (const p of u.prev || []) if (c.coll.tasks.map[p.id]) await M.tasks.save(c, p.id, {due: p.due, owner: p.owner, status: p.status, priority: p.priority}); return 'The tasks are back as they were.'; }
      case 'status': await ctx.W.merge('me/' + ctx.uid, {status: u.prev || null}); return 'Status back as it was.';
      case 'focus': if (M.focus && M.focus.get()) M.focus.stop(); return 'Focus stopped.';
      case 'settings': await ctx.W.merge('settings/app', {...u.patch, updated: Date.now()}); return 'Put back as it was.';
      case 'roster': await ctx.W.merge('roster/team', {members: {[u.uid]: {reportsTo: u.prev || ''}}, updated: Date.now()}); return 'The reporting line is back as it was.';
      case 'chase': needPm('chase'); await M.pm.chase(ctx, u.id, !u.on); return u.on ? 'Stopped chasing it.' : 'Chasing it again.';
      case 'unbin': await ctx.W.update('tasks/' + u.id, {deleted: false, updated: Date.now()}); return 'Out of the bin.';
      case 'unarchive': await ctx.W.update('projects/' + u.id, {archived: false, archivedAt: null, updated: Date.now()}); return 'Back on the list.';
      case 'members': await ctx.W.update('projects/' + u.id, {members: u.prev}); return 'Taken off the project.';
      case 'checkout': await ctx.W.merge('checkin/' + ctx.uid, {days: {[u.ymd]: {out: null, outLoc: null}}}); return 'Checked back in.';
      default: throw new Error('that one cannot be undone');
    }
  }
  async function undo(ctx, id) {
    await loadLedger(ctx);
    const rows = allRows().filter(x => x.a.undo && x.a.status === 'done');
    const hit = !id || id === 'last' ? rows.filter(x => undoable(x.a)).sort((p, q) => (q.a.doneAt || q.a.at) - (p.a.doneAt || p.a.at))[0] : rows.find(x => x.a.id === id);
    if (!hit) {
      const late = !id || id === 'last' ? rows.sort((p, q) => (q.a.doneAt || q.a.at) - (p.a.doneAt || p.a.at))[0] : null;
      throw new Error(late ? 'too late to undo that one: it ran at ' + U.hhmm(late.a.doneAt || late.a.at) : 'nothing to undo');
    }
    if (!undoable(hit.a)) throw new Error('too late to undo that one: it ran at ' + U.hhmm(hit.a.doneAt || hit.a.at));
    const say = await undoRow(ctx, hit.a);
    hit.a.status = 'undone';
    /* the ledger reads undone before Undo says it is done */
    await persist(ctx);
    return {ok: true, undone: hit.a.action, say};
  }

  /* ---------- the local grammar: the common sentences, with no model call ---------- */
  const CONTRACT = [[/\bhaven'?t\b/g, 'have not'], [/\bhasn'?t\b/g, 'has not'], [/\bhadn'?t\b/g, 'had not'], [/\bisn'?t\b/g, 'is not'], [/\baren'?t\b/g, 'are not'],
    [/\bwasn'?t\b/g, 'was not'], [/\bweren'?t\b/g, 'were not'], [/\bdidn'?t\b/g, 'did not'], [/\bdoesn'?t\b/g, 'does not'], [/\bdon't\b/g, 'do not'], [/\bwon't\b/g, 'will not'],
    [/\bcan'?t\b/g, 'cannot'], [/\bcouldn'?t\b/g, 'could not'], [/\bi'm\b/g, 'i am'], [/\bim\b/g, 'i am'], [/\bi'll\b/g, 'i will'], [/\bi've\b/g, 'i have'], [/\bi'd\b/g, 'i would'],
    [/\byou're\b/g, 'you are'], [/\bthey're\b/g, 'they are'], [/\bthey've\b/g, 'they have'], [/\bwho's\b/g, 'who is'], [/\bwhat's\b/g, 'what is'], [/\bit's\b/g, 'it is'],
    [/\bthat's\b/g, 'that is'], [/\blet's\b/g, 'let us'], [/\bshe's\b/g, 'she is'], [/\bhe's\b/g, 'he is'], [/\bthere's\b/g, 'there is']];
  const FOLD = [
    [/\b(checked|checking|checks|check)[\s-]+out\b/g, 'checkout'], [/\bleft (from )?(the )?office\b/g, 'checkout'], [/\b(signed|logged) out\b/g, 'checkout'],
    [/\b(checked|checking|checks)[\s-]+in\b/g, 'checkin'], [/\bcheck[\s-]+in\b/g, 'checkin'],
    [/\b(dms|dm'd|dmed|dming|dm'ing)\b/g, 'dm'], [/\b(sends|sending|sent)\b/g, 'send'], [/\b(pings|pinging|pinged)\b/g, 'ping'], [/\b(nudges|nudging|nudged)\b/g, 'nudge'],
    [/\b(flags|flagging|flagged)\b/g, 'flag'], [/\b(chases|chasing|chased)\b/g, 'chase'], [/\b(reminds|reminding|reminded)\b/g, 'remind'], [/\b(asks|asking|asked)\b/g, 'ask'],
    [/\b(messages|messaging|messaged)\b/g, 'message'], [/\b(notifies|notifying|notified)\b/g, 'notify'], [/\bnotifications\b/g, 'notification'], [/\beods\b/g, 'eod'],
    [/\bend of (the )?day (line|report|update)\b/g, 'eod']
  ];
  function normalise(text) {
    let s = ' ' + String(text || '').toLowerCase().replace(/[‘’`]/g, '\'') + ' ';
    CONTRACT.forEach(([re, to]) => { s = s.replace(re, to); });
    s = s.replace(/(\w)'s\b/g, '$1 s').replace(/[^a-z0-9:' ]+/g, ' ').replace(/'/g, '').replace(/:(?!\d)/g, ' ').replace(/(^|\D):/g, '$1 ');
    FOLD.forEach(([re, to]) => { s = s.replace(re, to); });
    return s.replace(/\s+/g, ' ').trim();
  }
  const CONDITION_RE = [
    ['noout', /\b(not|never|yet to|forgot to|did not|have not|has not) (yet )?checkout\b|\bno checkout\b|\bstill checkin\b|\bstill (in|at) (the )?office\b|\b(have|has|did) not (yet )?left\b|\bnot left (yet)?\b|\bstill on the clock\b/],
    ['noin', /\b(not|never|yet to|did not|have not|has not) (yet )?checkin\b|\bno checkin\b|\bnot in yet\b|\b(have|has|did) not (yet )?(come|came|shown up|arrived)\b|\bnot (yet )?(come|came) in\b|\bmissing checkin\b/],
    ['noeod', /\bno eod\b|\b(not|never|yet to|did not|have not|has not) (yet )?(filed|file|posted|post|send|done|written|write|submitted|submit|put in|given) (in )?(their |an |the |his |her |today s )?eod\b|\beod (is |line is |lines are )?(missing|not in)\b|\bmissing (their |an |the )?eod\b|\bwithout (an |their |the )?eod\b/],
    ['overdue', /\boverdue\b|\bbehind on (their )?(task|tasks|work)\b|\bpast due\b|\blate on (their )?(task|tasks|work)\b/],
    ['quiet', /\b(gone|went|been|go|going) quiet\b|\bnothing on m360\b|\bquiet\b/],
    ['idle', /\bnothing moved\b|\bnot moved (a |any )?(task|tasks)\b|\bidle\b/],
    ['late', /\bcame in late\b|\bcheckin late\b|\b(were|was|came|come|in) late\b|\blate (today|this morning)\b/]
  ];
  const conditionIn = s => { for (const [k, re] of CONDITION_RE) if (re.test(s)) return k; return null; };
  const NUDGE_RE = /\b(flag|nudge|ping|chase|ask|remind|check with|poke|follow up with|message|dm|text|notify|tell)\b/;
  const GROUP_RE = /\b(everyone|everybody|anyone|anybody|all|the team|people|folks|whoever)\b/;
  const MYTEAM_RE = /\bmy (team|reports|direct reports|people|guys)\b/;
  /* teammates named in the sentence, by first name or full name */
  function namedIn(s, ctx, nm) {
    const out = [];
    const words = ' ' + s + ' ';
    for (const m of (ctx.activeMembers || [])) {
      if (m.uid === ctx.uid) continue;
      const full = norm(nm[m.uid]);
      if (!full) continue;
      const first = full.split(/\s+/)[0];
      if ((first.length >= 3 && words.indexOf(' ' + first + ' ') >= 0) || words.indexOf(' ' + full + ' ') >= 0) out.push(m.uid);
    }
    return out;
  }
  const atTime = s => { const m = /\b(?:at|around) (\d{1,2})(?::(\d{2}))? ?(am|pm)?\b/.exec(s); if (!m) return ''; const t = timeFrom(m[0].replace(/^(at|around) /, ''), Date.now()); return t && t.ms ? U.hhmm(t.ms) : ''; };
  const capFirst = s => String(s || '').replace(/^./, c => c.toUpperCase());

  /* the COO's lines: the kill switch, a pause, a resume, rebalance now, what needs me, what it did, why, undo,
     approve a leave, send a draft; for a member, why it moved their own work and what it may do */
  const PERSON = '([a-z]+(?: [a-z]+)?)';
  const COO_STOP = /^(please )?(coo (stop|off)|stop (the )?coo|(switch|turn) (the )?coo off|(switch|turn) off (the )?coo)( now)?$/;
  const COO_PAUSE = /^(?:please )?pause (?:the )?coo(?: (?:till|until|to|for) (.+))?$/;
  const COO_RESUME = /^(please )?(coo (resume|on)|resume (the )?coo|unpause (the )?coo|(switch|turn) (the )?coo (back )?on|(switch|turn) on (the )?coo)$/;
  const COO_WHY_LEAVE = new RegExp('^why did (?:you|the coo) (?:approve|ok|okay|clear) ' + PERSON + ' s (leave|wfh)(?: request| day)?$');
  const COO_WHY_MOVE = /^why did (?:you|the coo) (?:move|shift|reassign|hand|give|change|push) (.+?)(?: away| on| over)?$/;
  const COO_UNDO_LEAVE = new RegExp('^undo (?:the approval (?:of|for) )?' + PERSON + ' s (leave|wfh)(?: approval)?$');
  const COO_APPROVE = new RegExp('^approve ' + PERSON + ' s (leave|wfh)(?: request| day)?$');
  const COO_SEND = /^(?:please )?send (?:the )?(.+? (?:follow up|followup|reminder|confirm note|draft))$/;
  function cooParse(s, ctx) {
    if (!cooOn()) return null;
    const f = !!ctx.isFounder;
    let m;
    if (/^what (can|does) (the )?coo do$|^what is the coo( for)?$/.test(s)) return {action: 'coo_info', input: {what: 'can'}};
    if ((m = COO_WHY_MOVE.exec(s))) {
      const subj = m[1].replace(/ to .+$/, '').trim();
      if (!f || /^(my|me)\b/.test(subj)) { const t = subj.replace(/^my (task|tasks|work|date|due date|deadline)$/, '').replace(/^my /, '').trim(); return {action: 'coo_info', input: {what: 'mine', ...(t ? {task: t} : {})}}; }
      return {action: 'coo_why', input: {subject: subj}};
    }
    if (!f) return null;
    if (COO_STOP.test(s)) return {action: 'coo_stop', input: {}};
    if ((m = COO_PAUSE.exec(s))) return {action: 'coo_pause', input: m[1] ? {until: m[1]} : {}};
    if (COO_RESUME.test(s)) return {action: 'coo_resume', input: {}};
    if (/^(please )?(coo )?rebalance( the (load|work|team))?( now)?$/.test(s)) return {action: 'coo_rebalance_now', input: {}};
    if (/^(coo )?what (needs|is waiting (on|for)) me( today| now)?$/.test(s)) return {action: 'coo_info', input: {what: 'needs'}};
    if (/^(coo )?what (did|have) (you|the coo) (do|done)( today| so far)?$|^what has the coo done( today)?$/.test(s)) return {action: 'coo_info', input: {what: 'done'}};
    if ((m = COO_WHY_LEAVE.exec(s))) return {action: 'coo_why', input: {person: m[1], kind: m[2]}};
    if ((m = /^undo (?:the )?(?:move|shift|handover|date change) of (.+)$/.exec(s))) return {action: 'coo_undo', input: {task: m[1]}};
    if ((m = COO_UNDO_LEAVE.exec(s))) return {action: 'coo_undo', input: {person: m[1], kind: m[2]}};
    /* "undo that" is the COO's row only while one was just discussed; otherwise it is the agent's own undo */
    if (/^(please )?undo (that|it)( please)?$/.test(s) && cooTalk && Date.now() - cooTalk.at < 30 * MIN) return {action: 'coo_undo', input: {act: cooTalk.id}};
    if ((m = COO_APPROVE.exec(s))) return {action: 'coo_decide', input: {person: m[1], kind: m[2], how: 'apply'}};
    /* "send ... reminder" is the COO's only when one of its drafts answers to those words */
    if ((m = COO_SEND.exec(s))) {
      let hit;
      try { hit = !!cooCard(ctx, {}, {card: m[1], kind: 'mail', how: 'send'}); } catch (e) { hit = true; }
      if (hit) return {action: 'coo_decide', input: {card: m[1], kind: 'mail', how: 'send'}};
    }
    return null;
  }

  function parse(text, ctx, nm) {
    const raw = String(text || '').trim();
    if (!raw || !ctx) return null;
    nm = namesNow(ctx, nm);
    const s = normalise(raw);
    if (!s) return null;
    let m;
    const coo = cooParse(s, ctx);
    if (coo) return coo;
    /* undo and withdraw */
    if (/^(please )?undo( that| it| the last( one| thing)?)?( please)?$/.test(s)) return {action: 'undo', input: {id: 'last'}};
    if (/^(withdraw|take back|retract|unsend) (that|it|the ask|my ask|the last ask|my last ask|the nudge)( please)?$/.test(s)) return {action: 'withdraw_ask', input: {ask: 'last'}};
    /* check in and out */
    if (/^(please )?(check me in|checkin|checkin me|checkin for me|i am in|i am here|i am in the office|i am at the office|mark me in)( please| now)?$/.test(s)) return {action: 'check_in', input: {mode: 'office'}};
    if (/^(please )?((check me in|checkin|i am) )?(working from home|wfh)( today)?$/.test(s) || /^i am wfh( today)?$/.test(s)) return {action: 'check_in', input: {mode: 'wfh'}};
    if (/^(please )?(check me out|checkout|checkout me|checkout for me|i am out|i am done for the day|i am heading out|i am leaving|i am logging off|mark me out)( please| now)?$/.test(s)) return {action: 'check_out', input: {}};
    /* focus */
    if ((m = /^(please )?(start|begin)( a)? focus( session| timer)?( for)? ?(25|45|90)?( min| mins| minutes)?$/.exec(s))) return {action: 'focus', input: {start: m[6] ? Number(m[6]) : 25}};
    if (/^(please )?(stop|end|cancel|finish) (the |my )?focus( session| timer)?$/.test(s)) return {action: 'focus', input: {stop: true}};
    /* status */
    if ((m = /^\s*(?:please\s+)?set\s+(?:my\s+)?status\s+(?:to\s+|as\s+)?(.+?)\s*[.]?$/i.exec(raw))) return {action: 'set_status', input: {text: capFirst(m[1])}};
    if ((m = /^i am (on a call|in a meeting|on a shoot|at a shoot|at the shoot|out for lunch|at lunch|travelling|on the road|with a client|at a client)( (till|until|for the next|for) (.+))?$/.exec(s))) {
      const t = m[4] ? timeFrom(m[4], Date.now()) : null;
      return {action: 'set_status', input: {text: capFirst(m[1]), ...(t && t.ms ? {until: U.hhmm(t.ms)} : {})}};
    }
    /* answer a bot: "tell Shreya's bot I'll have it by five" */
    if ((m = /^(?:tell|answer|reply to) (?:(\w+) s|the) bot (?:that )?(.+)$/.exec(s))) {
      const rest = m[2];
      const t = timeFrom(rest, Date.now());
      return {action: 'answer_ask', input: {...(m[1] ? {about: m[1]} : {}), how: howFrom(rest), ...(t ? {eta: t.ms ? U.hhmm(t.ms) : t.ymd} : {})}};
    }
    const cond = conditionIn(s);
    /* a question: who has not checked out */
    if (cond && /^(who|which people|which of|anyone|anybody|is anyone|is anybody|are there people|show me who|list who|tell me who|list people who|list everyone who)\b/.test(s)) {
      const ppl = namedIn(s, ctx, nm);
      return {action: 'people_where', input: {condition: cond, scope: MYTEAM_RE.test(s) ? 'myteam' : ppl.length ? ppl : 'everyone'}};
    }
    /* an ask: flag, nudge, ping, chase, ask, remind or check with, a scope, a condition, why or by when */
    if (cond && NUDGE_RE.test(s)) {
      const ppl = namedIn(s, ctx, nm);
      const scope = MYTEAM_RE.test(s) ? 'myteam' : ppl.length && !GROUP_RE.test(s) ? ppl.map(u => firstOf(nm, u)) : 'everyone';
      const ask = /\bwhy\b|\bwhat happened\b/.test(s) ? 'why' : /\bby when\b|\bwhen will\b|\beta\b|\bhow long\b|\bwhen they\b/.test(s) ? 'eta' : '';
      const at = /\b(later|at|around) \d/.test(s) ? atTime(s) : '';
      const input = {condition: cond, scope: Array.isArray(scope) ? 'names' : scope, ...(Array.isArray(scope) ? {people: scope} : {}), ...(ask ? {ask} : {})};
      if (Array.isArray(scope)) delete input.scope;
      return at ? {action: 'schedule_nudge', input: {...input, at}} : {action: 'nudge_people', input};
    }
    /* open a screen */
    if ((m = /^(?:please )?(?:open|go to|goto|show me|take me to|jump to|navigate to|bring up|pull up)\s+(?:the\s+)?(.+?)(?:\s+(?:page|screen|tab))?$/.exec(s))) {
      const route = m[1].replace(/\s+please$/, '');
      /* "open a new task" is making something, and a name nothing matches goes to the model */
      if (route && !/^(how|who|what|when|why)\b/.test(route) && !/^(a |an )?new\b/.test(route) && findScreen(ctx, nm, route)) return {action: 'open_screen', input: {route}};
    }
    return null;
  }

  /* ---------- routing: the grammar first, then which tier the model runs on ---------- */
  const VERB_RE = /\b(send|dm|message|ping|nudge|flag|chase|ask|remind|tell|create|add|make|move|assign|reassign|give|mark|approve|decline|set|change|update|post|checkin|checkout|check|file|request|book|schedule|withdraw|undo|cancel|start|stop|open|turn|switch|pause|archive|bin|invite|log|draft|record|reply|answer|comment|tick|hand|push|shift|reschedule)\b/;
  const BULK_RE = /\b(all|every|everything|whole)\b.*\b(move|reassign|push|shift|re ?plan|reschedule|hand|give)\b|\b(move|reassign|push|shift|reschedule|replan|re plan)\b.*\b(all|every|everything)\b|\bre ?plan\b/;
  const ORDER = {
    how: ['point_at', 'go_to', 'walk_through', 'click', 'look_up', 'act'],
    task: ['act', 'look_up', 'point_at', 'go_to', 'click', 'search_everything', 'search_base', 'who_do_we_know_at'],
    do: ['point_at', 'go_to', 'click', 'type_into', 'select_option', 'press_key', 'walk_through', 'act', 'look_up'],
    look: ['look_up', 'act', 'search_everything', 'search_base', 'who_do_we_know_at', 'pipeline_for', 'point_at', 'go_to'],
    where: ['point_at', 'go_to', 'click', 'look_up', 'act', 'walk_through', 'search_everything', 'search_base']
  };
  function route(text, ctx, nm) {
    nm = namesNow(ctx, nm);
    const s = normalise(text);
    const grammar = ctx ? parse(text, ctx, nm) : null;
    const named = ctx ? namedIn(s, ctx, nm).length : 0;
    const how = /\b(show me how|how do i|how to|walk me|teach me)\b/.test(s);
    const verb = VERB_RE.test(s) && !/^(who|what|when|where|which|how many|is|are|does|do|did)\b/.test(s);
    const look = /^(who|what|when|where|which|how many|how much|is|are|does|do|did|list|show me|tell me|summar|any)\b/.test(s) || /\?\s*$/.test(String(text || ''));
    const intent = how ? 'how' : grammar && grammar.action === 'open_screen' ? 'do' : verb ? 'task'
      : /\b(open|close|dismiss|switch|fill|type|choose|select|pick|take me|go to|turn on|turn off)\b/.test(s) ? 'do' : look ? 'look' : 'where';
    const tier = BULK_RE.test(s) ? 'complex' : verb || named >= 1 || GROUP_RE.test(s) && VERB_RE.test(s) ? 'default' : look ? 'quick' : 'default';
    return {grammar, intent, tier, order: ORDER[intent].slice()};
  }

  /* a grammar hit, run with no model call: the panel shows text and, for a tap, the card */
  async function runGrammar(ctx, nm, parsed, turn, log) {
    nm = nm && Object.keys(nm).length ? nm : await names(ctx);
    const t = turn || {id: U.uid(), via: 'grammar', tainted: false};
    if (!t.id) t.id = U.uid();
    if (!t.via) t.via = 'grammar';
    if (!parsed || !parsed.action) return {text: 'I did not catch an action there.', error: true};
    try {
      const r = await exec(ctx, nm, parsed.action, parsed.input, {log, turn: t, rich: !!log});
      const text = (r && (r.say || (r.waiting ? r.label + ' is ready. Tap it, or say yes.' : r.note))) || 'Done.';
      return {text, result: r, waiting: !!(r && r.waiting), id: r && r.id, undoId: r && r.undoId};
    } catch (e) {
      return {text: 'I could not: ' + ((e && e.message) || 'that did not go through') + '.', error: true};
    }
  }

  /* ---------- the spoken yes: strict, quick, one card, only after the agent finished speaking ---------- */
  const clean = s => String(s || '').toLowerCase().replace(/[‘’`]/g, '\'').replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const YES = /^(yes|yeah|yep|send|send it|do it|go ahead|confirm|haan|haan bhejo)$/;
  const NO = /^(no|cancel|stop|don't|dont|do not|mat bhejo)$/;
  const isYes = s => YES.test(clean(s));
  const isNo = s => NO.test(clean(s));
  /* o: {turn, at (heard), promptAt (when the question was spoken), micAt (the mic opened), spokeEnd (speech finished)}.
     Returns the id of the one card a yes approves, or null and the words start a new turn */
  function yesFor(ctx, text, o) {
    o = o || {};
    if (!conf(ctx).spokenYes || !isYes(text) || !M.brain) return null;
    const turnId = o.turn && o.turn.id ? o.turn.id : o.turn;
    const list = M.brain.pending.list.filter(p => !p.busy && (!turnId || p.turn === turnId));
    if (list.length !== 1) return null;
    const p = list[0];
    const at = Number(o.at) || Date.now();
    if (at - Math.max(p.at || 0, Number(o.promptAt) || 0) > 15000) return null;
    if (o.micAt != null && o.spokeEnd != null && Number(o.micAt) < Number(o.spokeEnd)) return null;
    return p.id;
  }

  /* ---------- folded receipts: "Messaged 9 people", rows with live status, asks as the PM's receipt ---------- */
  function AgentReceipts({acts}) {
    const ctx = M.useCtx();
    const [open, setOpen] = useState({});
    const items = [];
    for (const x of acts || []) {
      if (x && typeof x === 'object' && x.group) {
        const last = items[items.length - 1];
        if (last && last.group === x.group) last.rows.push(x);
        else items.push({group: x.group, rows: [x]});
      } else items.push({one: x});
    }
    const ids = items.reduce((xs, it) => xs.concat((it.rows || []).map(r => r.who).filter(Boolean)), []);
    const profs = M.useProfiles(ids);
    const first = u => String((profs[u] && profs[u].name) || 'Someone').split(' ')[0];
    return html`<div class="agent-receipts">${items.map((it, i) => {
      if (!it.group) {
        const x = it.one;
        if (x && typeof x === 'object' && x.type === 'ask') return M.parts.PmAskReceipt ? html`<${M.parts.PmAskReceipt} key=${'a' + i} askId=${x.askId}/>` : html`<div key=${'a' + i} class="agent-receipt one tiny">${x.text || 'Asked'}</div>`;
        return html`<div key=${'s' + i} class="agent-receipt one tiny">${typeof x === 'string' ? x : (x && x.text) || ''}</div>`;
      }
      const n = it.rows.length;
      const verb = it.group === 'message' ? 'Messaged' : it.group === 'ask' ? 'Asked' : capFirst(it.group);
      const k = it.group + i;
      const shut = !open[k];
      return html`<div key=${k} class=${'agent-receipt' + (shut ? '' : ' open')} data-group=${it.group}>
        <button type="button" class="agent-receipt-toggle" aria-expanded=${!shut} onClick=${() => setOpen(o => ({...o, [k]: !o[k]}))}>
          <span class="agent-receipt-faces">${it.rows.slice(0, 2).map(r => html`<${UI.Avatar} key=${r.who} id=${r.who} size=${20}/>`)}${n > 2 ? html`<span class="agent-receipt-more tiny">+${n - 2}</span>` : null}</span>
          <span class="grow small">${n === 1 ? it.rows[0].text : verb + ' ' + people(n).toLowerCase()}</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        ${shut ? null : html`<div class="agent-receipt-rows">${it.rows.map((r, j) => html`<div key=${j} class="agent-receipt-row" data-uid=${r.who || ''} style=${{animationDelay: (j * 60) + 'ms'}}>
          <span class="tick" aria-hidden="true"></span><span class="grow tiny">${r.text || first(r.who)}</span>
        </div>`)}</div>`}
      </div>`;
    })}</div>`;
  }

  /* ---------- History: the private ledger, newest first, with Undo where it still applies ---------- */
  function AgentHistory({limit}) {
    const ctx = M.useCtx();
    const [n, setN] = useState(0);
    const [busy, setBusy] = useState('');
    const [only, setOnly] = useState('all');
    useEffect(() => {
      const f = () => setN(x => x + 1);
      ledger.subs.add(f);
      if (ctx.db && !ctx.viewAs) loadLedger(ctx).then(f);
      const t = setInterval(f, 5000);
      return () => { ledger.subs.delete(f); clearInterval(t); };
    }, [ctx.uid]);
    /* the founder can narrow it to what he asked of the COO: stop, pause, undo, its cards, its answers */
    const cooFilter = !!ctx.isFounder && cooOn();
    const isCooRun = run => (run.acts || []).some(a => /^coo_/.test(a.action || ''));
    const runs = ((ledger.path === ledgerPath(ctx) && ledger.runs) || []).slice().reverse().filter(r => !cooFilter || only !== 'coo' || isCooRun(r)).slice(0, limit || 40);
    const doUndo = async id => {
      setBusy(id);
      try { const r = await undo(ctx, id); M.toast(r.say); } catch (e) { M.toast(capFirst((e && e.message) || 'That did not undo'), true); }
      setBusy('');
    };
    return html`<div id="agent-history" class="agent-history" data-n=${n} data-filter=${cooFilter ? only : 'all'}>
      ${cooFilter ? html`<div id="agent-history-filter"><${UI.Seg} sm=${true} ariaLabel="Show" value=${only} onChange=${setOnly} options=${[{v: 'all', label: 'All'}, {v: 'coo', label: 'COO'}]}/></div>` : null}
      ${runs.length ? runs.map(run => html`<div key=${run.id} class="agent-run">
        <div class="row between agent-run-head"><span class="small agent-said">${run.said || (run.acts && run.acts[0] ? run.acts[0].action.replace(/_/g, ' ') : '')}</span>
          <span class="tiny ink62 num">${run.via === 'voice' ? 'by voice, ' : ''}${U.hhmm(run.at)}${U.ymd(new Date(run.at)) !== today() ? ', ' + U.fmtDay(U.ymd(new Date(run.at))) : ''}</span></div>
        ${(run.acts || []).map(a => html`<div key=${a.id} class=${'agent-act ' + a.status} data-action=${a.action}>
          <span class="agent-act-dot" aria-hidden="true"></span>
          <span class="grow tiny">${a.result || a.action.replace(/_/g, ' ')}${a.status === 'undone' ? ', undone' : a.status === 'failed' ? ', did not go through' : a.status === 'held' ? ', waited on a tap' : ''}</span>
          ${undoable(a) ? html`<button type="button" class="linky tiny agent-undo" disabled=${busy === a.id} onClick=${() => doUndo(a.id)}>Undo</button>` : null}
        </div>`)}
      </div>`) : html`<div class="tiny ink62">${only === 'coo' && cooFilter ? 'Nothing you asked of the COO yet. Stop, pause, undo and its cards land here.' : 'Nothing yet. What you ask m360 to do lands here, with Undo while it still applies.'}</div>`}
    </div>`;
  }

  /* ---------- Admin: "Voice and the agent" ---------- */
  function AgentAdminCard() {
    const ctx = M.useCtx();
    const c = conf(ctx);
    const [f, setF] = useState(() => ({on: c.on, bulkMax: String(c.bulkMax), perSenderDay: String(c.perSenderDay), spokenYes: c.spokenYes, pressConfirmed: c.pressConfirmed}));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const save = () => ctx.W.merge('settings/app', {agent: {on: !!f.on, bulkMax: clampN(f.bulkMax, 1, 25, 12), perSenderDay: clampN(f.perSenderDay, 1, 200, 40), spokenYes: !!f.spokenYes, pressConfirmed: !!f.pressConfirmed}, updated: Date.now()})
      .then(() => M.toast('Saved')).catch(() => {});
    const bulk = [3, 6, 12, 18, 25].map(n => ({v: String(n), label: n + ' people'}));
    return html`<${UI.Card} title="Voice and the agent" id="agent-admin" action=${html`<${UI.Pill} kind=${c.on ? 'ink' : 'outline'}>${c.on ? 'on' : 'off'}<//>`}><div class="stack tight">
      <p class="small ink62" style=${{marginTop: 0}}>Voice and chat can do what each person's own hand could, and nothing more. Anything that reaches two or more people, the roster or settings waits for one tap or one spoken yes. Deleting, payroll, letters and keys are only ever pointed at.</p>
      <${UI.Check} label="The 360 actions are on (asks, settings by voice, bulk changes)" checked=${f.on} onChange=${v => set('on', v)}/>
      <div class="grid2">
        <${UI.Select} id="agent-bulk" label="most people in one ask" value=${f.bulkMax} options=${bulk.some(o => o.v === f.bulkMax) ? bulk : bulk.concat([{v: f.bulkMax, label: f.bulkMax + ' people'}])} onChange=${v => set('bulkMax', v)}/>
        <${UI.Input} id="agent-perday" label="most asks one person sends a day" type="number" value=${f.perSenderDay} onChange=${v => set('perSenderDay', v)}/>
      </div>
      <${UI.Check} label="A spoken yes sends a waiting card (within 15 seconds, one card only)" checked=${f.spokenYes} onChange=${v => set('spokenYes', v)}/>
      <${UI.Check} label="Approve, decline and send back become a card to confirm" checked=${f.pressConfirmed} onChange=${v => set('pressConfirmed', v)}/>
      <div class="row"><${UI.Btn} sm=${true} id="agent-save" onClick=${save}>Save<//></div>
    </div><//>`;
  }
  AgentAdminCard.foldTitle = 'Voice and the agent';
  AgentAdminCard.foldSummary = 'what voice and chat may do, the caps, the spoken yes';
  M.adminCards.push(AgentAdminCard);

  /* the palette lists the commands it can run straight away */
  const COMMANDS = [['undo', 'Undo the last thing m360 did', {id: 'last'}], ['withdraw_ask', 'Take back my last ask', {ask: 'last'}], ['focus', 'Stop focus', {stop: true}], ['coo_stop', 'Stop the m360 COO', {}]];
  const commandsFor = ctx => COMMANDS.filter(([n]) => { const a = byName(n); return a && a.mode === 'now' && allowed(ctx, a) && !(a.schema.required || []).length && (n !== 'focus' || (M.focus && M.focus.get())) && (n !== 'coo_stop' || M.coo.on(ctx)); })
    .map(([name, label, input]) => ({name, label, input}));

  /* with the AI off (not granted, rate limited, the day's turns used) the grammar still runs: the panel
     says why in one line (M.ai.errCopy) and offers these */
  const OFFLINE = {line: 'I can still: open a screen, nudge people by a condition, check you in or out, set a status, start focus.',
    chips: ['Who has not checked out?', 'Nudge everyone who has not checked in', 'Check me out', 'Start focus for 25', 'Open the pipeline']};

  M.agent = {OFFLINE, ACTIONS, actionsFor, byName, allowed, parse, normalise, route, peopleWhere, whereLine, runGrammar, exec, isYes, isNo, yesFor, undo, undoable,
    ledger: ctx => loadLedger(ctx), conf, commandsFor, findScreen, timeFrom, cooUntil, COND, CONDS, NEVER, names};
  M.parts.AgentReceipts = AgentReceipts;
  M.parts.AgentHistory = AgentHistory;
  M.parts.AgentAdminCard = AgentAdminCard;
})();
