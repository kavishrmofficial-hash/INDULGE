/* module: quiet. Quiet stretches: long spells inside someone's working day with nothing recorded on
   m360. A day runs from the check-in to the check-out (or the EOD cut, or now). Everything the OS
   holds about what the person did that day marks it: their activity stamps (me/<uid>.act, every save
   in five-minute buckets, see M.stamp), a running or finished focus timer, the check-in and check-out,
   the EOD line, tasks they created, finished, sent for review, approved or sent back, comments, feed
   posts and kudos; for the founder, the log adds every write of the day, so days before the stamps read
   too. A gap between marks that runs past settings.quietMins (lunch aside) is a quiet stretch. Leave,
   holidays, Sundays and days without a check-in carry none. Rule R17 switches the whole watch off. */
'use strict';
(function () {
  const {U} = M;
  const MIN = 60000;
  const BUCKET = 5 * MIN;
  const FOCUS_MAX = 180;
  const SIGNIN = new Set(['login', 'logout', 'signup', 'accept', 'setup', 'link', 'signoutall', 'invited', 'magic', 'pw', 'pw2', 'reset', 'resetpw']);
  const counts = p => (M.stamp && M.stamp.counts ? M.stamp.counts(p) : !!p && !/^(log|pulse|me|play|music|spotify)(\/|$)/.test(String(p)));
  const arr = x => Array.isArray(x) ? x : [];
  /* the five-minute grid the stamps live on, counted from the day's midnight */
  const off5 = (ms, d0) => ((ms - d0) % BUCKET + BUCKET) % BUCKET;
  const floor5 = (ms, d0) => ms - off5(ms, d0);
  const ceil5 = (ms, d0) => off5(ms, d0) ? floor5(ms, d0) + BUCKET : ms;

  /* the settings: the threshold in minutes (30 to 480, 120 by default) and the lunch hour left out */
  function cfg(ctx) {
    const S = (ctx && ctx.settings) || M.SETTINGS_DEFAULTS || {};
    const mins = Math.max(30, Math.min(480, Math.round(Number(S.quietMins) || 120)));
    const ok = t => /^\d{1,2}:\d{2}$/.test(String(t || ''));
    const lf = ok(S.lunchFrom) ? U.minutes(S.lunchFrom) : null, lt = ok(S.lunchTo) ? U.minutes(S.lunchTo) : null;
    return {on: !(S.rules && S.rules.R17 === false), mins, lunch: lf != null && lt != null && lt > lf ? [lf, lt] : null};
  }

  const dur = ms => {
    const m = Math.max(0, Math.round(ms / MIN));
    return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + U.pad(m % 60) + 'm';
  };

  /* what everyone did on the tasks, read in one pass per version of the tasks map: {uid: {ymd: [at...]}}
     for tasks created, finished, sent for review, sent back, approved, and comments */
  const taskIdx = new WeakMap();
  function taskMarks(tasks) {
    let ix = taskIdx.get(tasks);
    if (ix) return ix;
    ix = {};
    const put = (u, at) => {
      at = Number(at) || 0;
      if (!u || !at) return;
      const d = U.ymd(new Date(at));
      ((ix[u] = ix[u] || {})[d] = ix[u][d] || []).push(at);
    };
    for (const id of Object.keys(tasks)) {
      const t = tasks[id];
      if (!t || typeof t !== 'object') continue;
      put(t.by, t.created);
      /* a sign-off by someone else stamps doneAt in the same move: that moment is the signer's */
      const signed = t.approvedBy && t.approvedBy !== t.owner && Math.abs((Number(t.approvedAt) || 0) - (Number(t.doneAt) || 0)) < MIN;
      if (!signed) put(t.owner, t.doneAt);
      put(t.owner, t.reviewAt);
      put(t.sentBackBy, t.sentBackAt);
      put(t.approvedBy, t.approvedAt);
      const cs = t.comments || {};
      for (const c of Object.keys(cs)) if (cs[c]) put(cs[c].by, cs[c].at);
    }
    taskIdx.set(tasks, ix);
    return ix;
  }

  /* every mark of one person's day, oldest first: {s, e, k} with k one of w (saved work), f (focus),
     in, out, eod, task, post, kudos, log */
  function marks(ctx, uid, ymd, extra) {
    const d0 = U.parseYmd(ymd).getTime(), d1 = d0 + 86400000;
    const out = [];
    const add = (s, e, k) => {
      s = Number(s) || 0; e = Number(e) || s;
      if (!s || e < d0 || s >= d1) return;
      out.push({s: Math.max(s, d0), e: Math.min(Math.max(e, s), d1 - 1), k});
    };
    const coll = key => (ctx.coll && ctx.coll[key] && ctx.coll[key].map) || {};
    const me = coll('me')[uid] || {};
    const act = (me.act && me.act[ymd]) || {};
    for (const b of Object.keys(act)) {
      if (!/^\d{4}$/.test(b) || act[b] == null) continue;
      const s = d0 + (Number(b.slice(0, 2)) * 60 + Number(b.slice(2))) * MIN;
      add(s, s + BUCKET, act[b] === 0 ? 'f' : 'w');
    }
    /* a finished focus session covers its minutes, never more than the longest timer (a bad value never hides the day) */
    for (const x of arr(me.focus && me.focus.sessions)) if (x && x.at) add(Number(x.at) - Math.min(FOCUS_MAX, Math.max(0, Number(x.mins) || 0)) * MIN, x.at, 'f');
    const ci = ((coll('checkin')[uid] || {}).days || {})[ymd];
    if (ci && ci.in) add(ci.in, ci.in, 'in');
    if (ci && ci.out) add(ci.out, ci.out, 'out');
    const eod = ((coll('eod')[uid] || {}).days || {})[ymd];
    if (eod && eod.at) add(eod.at, eod.at, 'eod');
    for (const at of ((taskMarks(coll('tasks'))[uid] || {})[ymd] || [])) add(at, at, 'task');
    for (const p of arr((coll('feed')[uid] || {}).posts)) if (p) add(p.at, p.at, 'post');
    for (const k of arr((coll('kudos')[uid] || {}).given)) if (k) add(k.at, k.at, 'kudos');
    for (const at of arr(extra)) add(at, at, 'log');
    out.sort((a, b) => a.s - b.s || a.e - b.e);
    return out;
  }

  /* minutes of [s, e] inside the lunch hour of the day that starts at d0 */
  const lunchMs = (c, d0, s, e) => {
    if (!c.lunch) return 0;
    const ls = d0 + c.lunch[0] * MIN, le = d0 + c.lunch[1] * MIN;
    return Math.max(0, Math.min(e, le) - Math.max(s, ls));
  };
  /* the moment a stretch that began at s ran past the threshold, the lunch hour paused on the way */
  const crossAt = (c, d0, s) => {
    const t = s + c.mins * MIN;
    if (!c.lunch) return t;
    const ls = d0 + c.lunch[0] * MIN, le = d0 + c.lunch[1] * MIN;
    return t <= ls || s >= le ? t : t + le - Math.max(s, ls);
  };

  /* one person's day: its window, marks and quiet stretches. opts.now (ms) and opts.extra (log times).
     The walk runs on the five-minute grid of the stamps: every mark covers the buckets it touches, so a
     stretch begins on a bucket edge and keeps the same start (and the same inbox key) whichever mark of
     that bucket syncs first. Each stretch carries at, the moment it ran past the threshold. The answer
     is kept per context, so every card and the inbox reading the same day walk it once. */
  const dayMemo = new WeakMap();
  function day(ctx, uid, ymd, opts) {
    opts = opts || {};
    const nowMs = Number(opts.now) || Number(ctx && ctx.now) || Date.now();
    const memo = ctx && typeof ctx === 'object' && !opts.extra ? (dayMemo.get(ctx) || new Map()) : null;
    const mk = uid + '|' + ymd + '|' + nowMs;
    if (memo && memo.has(mk)) return memo.get(mk);
    const res = walk(ctx, uid, ymd, nowMs, opts.extra);
    if (memo) {
      if (memo.size > 400) memo.clear();
      memo.set(mk, res);
      dayMemo.set(ctx, memo);
    }
    return res;
  }
  function walk(ctx, uid, ymd, nowMs, extra) {
    const c = cfg(ctx);
    const res = {uid, ymd, on: c.on, mins: c.mins, lunch: c.lunch, from: null, to: null, marks: [], stretches: [], live: null, idle: null, status: ''};
    if (!c.on || !ctx || !ctx.members || !ctx.members[uid] || ctx.members[uid].active === false || !ctx.settings) return res;
    const a = M.att ? M.att.dayStatus(ctx, uid, ymd) : null;
    if (!a || !a.in || (a.status !== 'office' && a.status !== 'wfh')) return res;
    const d0 = U.parseYmd(ymd).getTime();
    const cut = d0 + U.minutes(String(ctx.settings.eodCut || '19:30')) * MIN;
    const from = a.in;
    const to = Math.min(nowMs, a.out || Infinity, Math.max(cut, from));
    const st = (((ctx.coll.me || {}).map || {})[uid] || {}).status || null;
    res.status = st && st.at && st.text && U.ymd(new Date(st.at)) === ymd ? String(st.text) : '';
    res.marks = marks(ctx, uid, ymd, extra);
    res.from = from; res.to = to;
    if (!(to > from)) return res;
    /* walk the marks: every stretch between them that runs past the threshold, lunch aside */
    let cursor = ceil5(from, d0);
    const gaps = [];
    for (const m of res.marks) {
      const s = floor5(m.s, d0), e = m.e > m.s ? ceil5(m.e, d0) : s + BUCKET;
      if (e <= cursor) continue;
      if (s >= to) break;
      if (s > cursor) gaps.push([cursor, s, false]);
      cursor = Math.max(cursor, e);
    }
    const open = to === nowMs;
    if (to > cursor) gaps.push([cursor, to, open]);
    for (const [s, e, live] of gaps) {
      const lunch = lunchMs(c, d0, s, e);
      const q = (e - s) - lunch;
      const stretch = {uid, ymd, from: s, to: e, ms: e - s, quietMs: q, lunch: lunch > 0, live, at: crossAt(c, d0, s)};
      if (live) res.idle = stretch;
      if (q >= c.mins * MIN) { res.stretches.push(stretch); if (live) res.live = stretch; }
    }
    return res;
  }

  /* Monday to the given day (never past today): each working day's stretches */
  function week(ctx, uid, ymd, opts) {
    const end = ymd || U.ymd(new Date(Number(ctx && ctx.now) || Date.now()));
    const mon = U.mondayOf(U.parseYmd(end));
    const out = [];
    for (let i = 0; i < 6; i++) {
      const d = U.ymd(U.addDays(mon, i));
      if (d > end) break;
      const r = day(ctx, uid, d, {now: opts && opts.now, extra: opts && opts.extra && opts.extra[d]});
      if (!r.from) continue;
      const total = r.stretches.reduce((n, x) => n + x.quietMs, 0);
      const longest = r.stretches.reduce((n, x) => Math.max(n, x.quietMs), 0);
      out.push({ymd: d, stretches: r.stretches, total, longest});
    }
    return out;
  }

  /* the sentence a manager reads after the person's name */
  function line(st) {
    const lunch = st.lunch ? ', lunch aside' : '';
    if (st.live) return 'nothing recorded on m360 since ' + U.hhmm(st.from) + ' (' + dur(st.quietMs) + ' so far' + lunch + ')';
    return 'nothing recorded on m360 from ' + U.hhmm(st.from) + ' to ' + U.hhmm(st.to) + ' (' + dur(st.quietMs) + lunch + ')';
  }

  /* the admin's extra marks out of the log: {uid: {ymd: [at...]}}, from M.logs.read documents
     ({'<ymd>-<uid>': {e: {id: {at, a, p}}}}); sign-ins and non-work paths are left out */
  function fromLog(docs) {
    const out = {};
    for (const id of Object.keys(docs || {})) {
      const ymd = String(id).slice(0, 10), uid = String(id).slice(11);
      const es = (docs[id] && docs[id].e) || {};
      for (const k of Object.keys(es)) {
        const x = es[k];
        if (!x || !x.at || SIGNIN.has(String(x.a)) || !counts(x.p)) continue;
        ((out[uid] = out[uid] || {})[ymd] = out[uid][ymd] || []).push(Number(x.at));
      }
    }
    return out;
  }

  /* the founder's log for a run of days, read once and again every five minutes while today is in it */
  function useLog(ctx, from, to) {
    const React = M.React;
    const [docs, setDocs] = React.useState({});
    const admin = !!(ctx && ctx.isFounder && M.logs && M.logs.read);
    const today = U.todayStr();
    React.useEffect(() => {
      if (!admin || !from) return undefined;
      let live = true;
      const pull = () => M.logs.read(ctx, {from, to: to || from}).then(d => { if (live) setDocs(fromLog(d || {})); }, () => {});
      pull();
      const t = (to || from) >= today ? setInterval(pull, 5 * MIN) : null;
      return () => { live = false; if (t) clearInterval(t); };
    }, [admin, from, to]);
    return docs;
  }

  /* a running focus timer marks its five-minute buckets: deep work counts even with m360 in the background.
     A timer that ran out without being banked (closed page, failed save) marks nothing */
  setInterval(() => {
    try {
      const c = M.lastCtx;
      if (c && c.db && c.uid && M.focus && M.focus.get && M.focus.get() && (!M.focus.left || M.focus.left() > 0)) M.stamp(c.db, c.uid, null, true);
    } catch (e) { /* the timer never breaks the page */ }
  }, MIN);

  M.quiet = {cfg, marks, day, week, line, dur, fromLog, useLog};
})();
