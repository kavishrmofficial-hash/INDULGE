/* module: points. Points, scorecard, ladder and leaderboard (BRIEF sections 9 and 7.12).
   Pure functions only. Nothing here renders and nothing here writes. Every number is
   derived from ctx.coll at call time; nothing is stored. */
'use strict';
(function () {
  const {U} = M;

  /* every weight key from settings.points, in breakdown order */
  const KEYS = ['checkinOnTime', 'eod', 'planOnTime', 'planLate', 'outcomeHit', 'outcomeMiss',
    'taskOnTime', 'taskLate', 'revision', 'shown20', 'qualityMult', 'kudos', 'rockDone', 'overdueOpen'];
  const OUTPUT_KEYS = ['outcomeHit', 'outcomeMiss', 'taskOnTime', 'taskLate', 'revision', 'shown20',
    'qualityMult', 'kudos', 'rockDone', 'overdueOpen'];
  const DISCIPLINE_KEYS = ['checkinOnTime', 'eod', 'planOnTime', 'planLate'];
  const KUDOS_WEEK_CAP = 5;
  const EOD_NEXT_DAY_CUT = '10:00';

  /* ---------- small helpers ---------- */
  const isNum = x => typeof x === 'number' && isFinite(x);
  const toDate = x => x instanceof Date ? x : (isNum(x) ? new Date(x) : (typeof x === 'string' && x ? U.parseYmd(x) : null));
  const nowDate = (ctx, now) => toDate(now) || new Date((ctx && isNum(ctx.now)) ? ctx.now : Date.now());
  const ymdOf = ts => U.ymd(new Date(ts));
  /* epoch ms of "HH:MM" on a local date */
  const cutMs = (ymd, hhmm) => U.parseYmd(ymd).getTime() + U.minutes(hhmm) * 60000;
  const inRange = (ymd, from, to) => !!ymd && ymd >= from && ymd <= to;
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const docOf = (ctx, name, uid) => collMap(ctx, name)[uid] || {};
  const weightsOf = ctx => ({...M.POINTS_DEFAULTS, ...(((ctx && ctx.settings) || {}).points || {})});
  const settingOf = (ctx, key) => {
    const s = (ctx && ctx.settings) || {};
    return s[key] != null ? s[key] : M.SETTINGS_DEFAULTS[key];
  };
  const zeroMap = () => { const o = {}; KEYS.forEach(k => { o[k] = 0; }); return o; };

  /* Mondays (as Date) whose ymd falls inside [from, to] */
  function mondaysIn(from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    let d = U.mondayOf(U.parseYmd(from));
    if (U.ymd(d) < from) d = U.addDays(d, 7);
    let guard = 0;
    while (U.ymd(d) <= to && guard++ < 120) { out.push(d); d = U.addDays(d, 7); }
    return out;
  }

  /* working days for uid from `from` up to `to` (both inclusive) */
  function workingDays(ctx, uid, from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    const isWorking = (ctx && typeof ctx.isWorkingDay === 'function') ? ctx.isWorkingDay : (d => U.parseYmd(d).getDay() !== 0);
    let d = U.parseYmd(from);
    let guard = 0;
    while (U.ymd(d) <= to && guard++ < 400) {
      const s = U.ymd(d);
      if (isWorking(s, uid)) out.push(s);
      d = U.addDays(d, 1);
    }
    return out;
  }

  /* tasks owned by uid, as [{id, ...task}] */
  function ownedTasks(ctx, uid) {
    const map = collMap(ctx, 'tasks');
    const out = [];
    for (const id of Object.keys(map)) {
      const t = map[id];
      if (t && t.owner === uid) out.push({id, ...t});
    }
    return out;
  }
  const isDone = t => t.status === 'done';
  const doneYmd = t => isNum(t.doneAt) ? ymdOf(t.doneAt) : null;
  /* a done task is on time when it has no due date, or its done day is on or before the due day */
  const doneOnTime = t => !t.due || !doneYmd(t) || doneYmd(t) <= t.due;

  /* quarters fully covered by [from, to], as quarter ids */
  function wholeQuartersIn(from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    let d = U.parseYmd(from);
    let guard = 0;
    while (U.ymd(d) <= to && guard++ < 40) {
      const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
      const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
      if (U.ymd(qStart) >= from && U.ymd(qEnd) <= to) out.push(U.quarterId(qStart));
      d = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
    }
    return out;
  }

  /* ---------- pointsFor ---------- */
  /* {total, output, discipline, parts, counts, badges}. parts[key] = weights[key] * counts[key] for every
     weight key. counts.qualityMult is the sum of weekly quality scores in range. */
  function pointsFor(ctx, uid, fromYmd, toYmd) {
    const w = weightsOf(ctx);
    const counts = zeroMap();
    const parts = zeroMap();
    const badges = [];
    const from = String(fromYmd || '');
    const to = String(toYmd || '');
    const finish = () => {
      KEYS.forEach(k => { parts[k] = (Number(w[k]) || 0) * counts[k]; });
      const sum = keys => keys.reduce((n, k) => n + parts[k], 0);
      const output = sum(OUTPUT_KEYS);
      const discipline = sum(DISCIPLINE_KEYS);
      return {total: output + discipline, output, discipline, parts, counts, badges};
    };
    if (!ctx || !uid || !from || !to || from > to) return finish();

    const today = U.ymd(nowDate(ctx));
    const end = to < today ? to : today;           /* never beyond today */
    const grace = Number(settingOf(ctx, 'grace')) || 0;
    const mondayCut = settingOf(ctx, 'mondayCut') || '12:00';
    const start = (typeof ctx.startFor === 'function' && ctx.startFor(uid)) || settingOf(ctx, 'start') || '10:30';

    /* discipline: check-ins and EOD lines per working day, up to today */
    const days = workingDays(ctx, uid, from, end);
    const checkDays = docOf(ctx, 'checkin', uid).days || {};
    const eodDays = docOf(ctx, 'eod', uid).days || {};
    let eodExists = 0;
    for (const d of days) {
      const c = checkDays[d];
      if (c && isNum(c.in) && c.in <= cutMs(d, start) + grace * 60000) counts.checkinOnTime++;
      const e = eodDays[d];
      if (e) {
        eodExists++;
        if (isNum(e.at) && e.at < cutMs(U.ymd(U.addDays(U.parseYmd(d), 1)), EOD_NEXT_DAY_CUT)) counts.eod++;
      }
    }
    if (days.length > 0 && eodExists === days.length) badges.push('Every EOD');

    /* per ISO week whose Monday is in range: plan timing, outcome marks, quality */
    const planWeeks = docOf(ctx, 'plan', uid).weeks || {};
    const reviewWeeks = docOf(ctx, 'review', uid).weeks || {};
    let marks = 0;
    for (const mon of mondaysIn(from, to)) {
      const wk = U.isoWeek(mon);
      const p = planWeeks[wk];
      if (p && isNum(p.at)) {
        if (p.at <= cutMs(U.ymd(mon), mondayCut)) counts.planOnTime++;
        else counts.planLate++;
      }
      const r = reviewWeeks[wk];
      if (r) {
        for (const v of Object.values(r.marks || {})) {
          if (v === 'hit') { counts.outcomeHit++; marks++; }
          else if (v === 'miss') { counts.outcomeMiss++; marks++; }
        }
        if (isNum(r.quality)) counts.qualityMult += r.quality;
      }
    }
    if (marks > 0 && counts.outcomeMiss === 0) badges.push('Clean sweep');

    /* tasks owned: done in range, revisions on those, 20% shown, open overdue at the end */
    let dueInRangeDone = 0, dueInRangeLate = 0;
    for (const t of ownedTasks(ctx, uid)) {
      const done = isDone(t);
      const dy = doneYmd(t);
      if (done && inRange(dy, from, to)) {
        if (doneOnTime(t)) counts.taskOnTime++; else counts.taskLate++;
        counts.revision += Math.max(0, Math.round(Number(t.revisions) || 0));
      }
      if ((done || t.status === 'review') && t.shown20) {
        const ref = (done && isNum(t.doneAt)) ? t.doneAt : (isNum(t.updated) ? t.updated : t.created);
        if (isNum(ref) && inRange(ymdOf(ref), from, to)) counts.shown20++;
      }
      if (!done && t.due && t.due < end) counts.overdueOpen++;
      if (done && inRange(t.due, from, to)) {
        dueInRangeDone++;
        if (!doneOnTime(t)) dueInRangeLate++;
      }
    }
    if (dueInRangeDone > 0 && dueInRangeLate === 0) badges.push('On time');

    /* kudos received, 5 counted per ISO week at most */
    const perWeek = {};
    const kudosMap = collMap(ctx, 'kudos');
    for (const giver of Object.keys(kudosMap)) {
      for (const k of ((kudosMap[giver] || {}).given || [])) {
        if (!k || k.to !== uid || !isNum(k.at)) continue;
        if (!inRange(ymdOf(k.at), from, to)) continue;
        const wk = U.isoWeek(new Date(k.at));
        perWeek[wk] = (perWeek[wk] || 0) + 1;
      }
    }
    for (const wk of Object.keys(perWeek)) counts.kudos += Math.min(KUDOS_WEEK_CAP, perWeek[wk]);

    /* rocks marked done, only when the range covers a whole quarter */
    const rockQ = docOf(ctx, 'rocks', uid).q || {};
    for (const qid of wholeQuartersIn(from, to)) {
      for (const r of (rockQ[qid] || [])) if (r && r.state === 'done') counts.rockDone++;
    }

    return finish();
  }

  /* ---------- scoreFor: one ISO week ---------- */
  /* {due, onTimePct, revPerTask, quality, hit, miss, planned, weekId}. The week runs Monday to Sunday. */
  function scoreFor(ctx, uid, mondayDate) {
    const d = toDate(mondayDate) || nowDate(ctx);
    const mon = U.mondayOf(d);
    const weekId = U.isoWeek(mon);
    const from = U.ymd(mon);
    const to = U.ymd(U.addDays(mon, 6));
    const out = {due: 0, onTimePct: null, revPerTask: null, quality: null, hit: 0, miss: 0, planned: 0, weekId};
    if (!ctx || !uid) return out;

    let dueOnTime = 0, doneN = 0, revs = 0;
    for (const t of ownedTasks(ctx, uid)) {
      if (inRange(t.due, from, to)) {
        out.due++;
        if (isDone(t) && doneOnTime(t)) dueOnTime++;
      }
      if (isDone(t) && inRange(doneYmd(t), from, to)) {
        doneN++;
        revs += Math.max(0, Math.round(Number(t.revisions) || 0));
      }
    }
    if (out.due > 0) out.onTimePct = U.pct(dueOnTime, out.due);
    if (doneN > 0) out.revPerTask = Math.round(100 * revs / doneN) / 100;

    const r = (docOf(ctx, 'review', uid).weeks || {})[weekId];
    if (r) {
      if (isNum(r.quality)) out.quality = r.quality;
      for (const v of Object.values(r.marks || {})) {
        if (v === 'hit') out.hit++;
        else if (v === 'miss') out.miss++;
      }
    }
    const p = (docOf(ctx, 'plan', uid).weeks || {})[weekId];
    out.planned = (p && Array.isArray(p.items)) ? p.items.length : 0;
    return out;
  }

  /* ---------- ladder: misses in weeks whose Monday falls within the last 30 days ---------- */
  function ladder(ctx, uid, now) {
    const today = U.ymd(nowDate(ctx, now));
    const cut = U.ymd(U.addDays(U.parseYmd(today), -30));
    let misses = 0;
    const weeks = (ctx && uid) ? (docOf(ctx, 'review', uid).weeks || {}) : {};
    for (const wk of Object.keys(weeks)) {
      if (!/^\d{4}-W\d{2}$/.test(wk)) continue;
      const mon = U.ymd(U.mondayOfWeekId(wk));
      if (mon < cut || mon > today) continue;
      for (const v of Object.values((weeks[wk] || {}).marks || {})) if (v === 'miss') misses++;
    }
    const level = misses >= 3 ? 'exit' : misses === 2 ? 'warning' : misses === 1 ? 'note' : 'clear';
    return {misses, level};
  }

  /* ---------- leaderboard ---------- */
  /* [{uid, total, output, discipline, badges, parts, counts}] ranked by total, then output.
     The founder is left out unless settings.leaderboardIncludesFounder. */
  function leaderboard(ctx, period, now) {
    if (!ctx) return [];
    const range = U.periodRange(period || 'week', nowDate(ctx, now));
    const withFounder = !!settingOf(ctx, 'leaderboardIncludesFounder');
    const members = Array.isArray(ctx.activeMembers) ? ctx.activeMembers : [];
    const rows = [];
    for (const m of members) {
      if (!m || !m.uid) continue;
      const founder = m.role === 'founder' || m.uid === ctx.founderUid;
      if (founder && !withFounder) continue;
      const p = pointsFor(ctx, m.uid, range.from, range.to);
      rows.push({uid: m.uid, total: p.total, output: p.output, discipline: p.discipline, badges: p.badges, parts: p.parts, counts: p.counts});
    }
    const order = {};
    members.forEach((m, i) => { if (m && m.uid) order[m.uid] = i; });
    rows.sort((a, b) => (b.total - a.total) || (b.output - a.output) || (order[a.uid] - order[b.uid]));
    return rows;
  }

  M.points = {pointsFor, scoreFor, ladder, leaderboard, KEYS, OUTPUT_KEYS, DISCIPLINE_KEYS};
})();
