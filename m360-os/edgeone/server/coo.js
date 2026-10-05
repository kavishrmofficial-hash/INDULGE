/* coo: the m360 COO on the team site (spec v33, parts B, C and I). A bot colleague that runs Mask360's
   operating rhythm for Kaavish, inside the mandate he writes (settings/app.coo), with no page open.

   run(site, {t0, tick}) comes after the personal managers' pass, before every action. A tick (the GitHub
   heartbeat, .github/workflows/coo-tick.yml, every 15 minutes from 09:00 to 21:00 IST, Monday to Saturday)
   always looks; any other request looks only when the last beat is over 20 minutes old between 09:00 and 21:00,
   so page traffic covers a missed tick and runs Sunday's health check. The slot comes from this server's own IST clock, never from the body, and each one is claimed
   once in the store:
     x/coo/lease                     {id, until}                                 one pass at a time across instances
     x/coo/<ymd>/<slot>              {id, at, until, state, cursor, acts, ms}    state running, done, skipped or error
     x/coo/acts/<ymd>/<key>          {id, at, job}                               one act per kind, target and period
     x/coo/mail/<ymd>/<slot>         {id, at, sent?, error?}                     the founder's mail, at most two a day
     x/coo/beat                      {at, slot, build}
     x/coo/index                     {last, lastError}
     n/ai/<ymd>/u_m360coo            {n, at}                                     model calls, against limits.aiPerDay
   so extra, late or forged ticks change nothing. A pass starts only in the first 8 seconds of its request and
   starts no new act after 22; where it stopped is saved as the slot's cursor and the next tick carries on.

   Every write the bot makes goes through cooWrite: the mandate first (guard, the ALLOW list and the NEVER
   list), the ledger row before the change (coo/L-<ymd>), the target read again and skipped when a person moved
   it, only its own fields merged into the fresh document, writeAs('u_m360coo') so the version and the log line
   are the bot's, and the read back. A refused write stops the whole COO (coo/state.stuck) and Kaavish hears.
   coo/now and office/live, the live feed, are the only quiet writes.

   The planner below (PLANNER) is the page's (src/js/10-coo.js) line for line, so a decision is the same
   wherever it is made; test_coo_parity.py holds the two together. The jobs are the page's, read from the
   store. Mail to clients and money stay drafts: coosend (the owner's tap) sends one, from Kaavish's own Gmail
   or the books' reminder path, never from a tick and never as the bot. env COO_OFF=1 stops it all. */
import {policy as pmPolicy, cfgOf as pmCfgOf, key as pmKey} from './pm.js';

export const COO_UID = 'u_m360coo';
const UID = COO_UID;
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const IST_MS = 330 * MIN;

/* the mandate's defaults, the same as M.SETTINGS_DEFAULTS.coo on the page (test_coo_parity.py keeps them equal).
   perType null fails closed: no leave is approved alone until Kaavish sets the days */
export const COO_DEFAULTS = {
  on: false, title: 'm360 COO', pausedUntil: null, practiceUntil: null, version: 1, signedAt: null, signedBy: null,
  caps: {roll: 'alone', nudge: 'alone', leave: 'tell', wfh: 'tell', cover: 'tell', rebalance: 'tell', shift: 'tell', orphans: 'tell', reviews: 'alone', projects: 'tell',
    clientMail: 'draft', meetingMail: 'draft', invoiceMail: 'draft', clientDates: 'propose', memo: 'alone', reviewPrep: 'draft', structure: 'propose'},
  limits: {actsPerDay: 120, tellPerDay: 25, movesPerDay: 8, movesPerPersonDay: 3, movesPerTaskWeek: 1, shiftsPerDay: 12, leaveApprovalsPerDay: 6, asksPerDay: 30,
    asksPerPersonDay: 2, draftsPerDay: 10, draftsPerClientWeek: 1, aiPerDay: 40, foundMailsPerDay: 2},
  leave: {yearStart: '04-01', perType: {casual: null, sick: null, other: null}, maxAutoDays: 2, noticeDays: {casual: 3, sick: 0, other: 7}, probationLop: false,
    maxOutPerDay: 2, maxOutPerPod: 1, blackout: []},
  wfh: {minOffice: 0},
  load: {maxOpen: 12, maxOverdue: 3, margin: 1.5},
  stuck: {lead: 14, qualified: 14, diagnostic: 10, proposal: 7, negotiation: 10},
  digest: {mail: 'away'}, memoDay: 'sat', off: {}
};

/* the rungs, lowest first; the capabilities; the ceilings no setting can raise */
const RUNGS = ['off', 'propose', 'draft', 'tell', 'alone'];
const CAPS = ['roll', 'nudge', 'leave', 'wfh', 'cover', 'rebalance', 'shift', 'orphans', 'reviews', 'projects',
  'clientMail', 'meetingMail', 'invoiceMail', 'clientDates', 'memo', 'reviewPrep', 'structure'];
export const CEIL = Object.freeze({clientMail: 'draft', meetingMail: 'draft', invoiceMail: 'draft', clientDates: 'propose', structure: 'propose'});
const rungAt = r => Math.max(0, RUNGS.indexOf(r));
const lowerOf = (a, b) => RUNGS[Math.min(rungAt(a), rungAt(b))];
/* escalate when unsure: one rung down, never below a card Kaavish can apply */
const escalate = r => r === 'off' || r === 'propose' ? r : RUNGS[rungAt(r) - 1];

/* the station each job works at, as on the page (the office plays the rows by these) */
const JOBS = {
  J01: {station: 'clock', cap: null}, J02: {station: 'desk', cap: 'memo'}, J03: {station: 'attendance', cap: 'roll'}, J04: {station: 'desk', cap: 'roll'},
  J05: {station: 'meeting', cap: 'memo'}, J06: {station: 'meeting', cap: 'memo'}, J07: {station: 'mail', cap: 'memo'},
  J10: {station: 'calendar', cap: 'leave'}, J11: {station: 'calendar', cap: 'wfh'}, J12: {station: 'calendar', cap: 'cover'}, J13: {station: 'tray', cap: 'leave'},
  J14: {station: 'mail', cap: 'nudge'}, J15: {station: 'mail', cap: 'nudge'}, J16: {station: 'review', cap: 'reviews'}, J17: {station: 'mail', cap: 'nudge'},
  J18: {station: 'meeting', cap: 'reviewPrep'}, J19: {station: 'mail', cap: 'nudge'}, J20: {station: 'reception', cap: 'structure'},
  J30: {station: 'board', cap: null}, J31: {station: 'board', cap: 'rebalance'}, J32: {station: 'board', cap: 'orphans'}, J33: {station: 'board', cap: 'shift'},
  J34: {station: 'board', cap: 'nudge'}, J35: {station: 'calendar', cap: 'shift'}, J36: {station: 'desk', cap: 'clientDates'}, J37: {station: 'calendar', cap: 'nudge'},
  J38: {station: 'board', cap: 'projects'}, J40: {station: 'clients', cap: 'nudge'}, J41: {station: 'desk', cap: 'clientMail'}, J42: {station: 'desk', cap: 'meetingMail'},
  J43: {station: 'books', cap: 'invoiceMail'}, J50: {station: 'clock', cap: null}, J51: {station: 'meeting', cap: null}
};

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const clone = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/* a deep merge where null removes the key, the way core.js merges a page's update */
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
function merge(a, b) {
  const out = isObj(a) ? {...a} : {};
  for (const k of Object.keys(b || {})) {
    if (BAD_KEY.has(k)) continue;
    const v = b[k];
    if (v === null) { delete out[k]; continue; }
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out;
}
const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* "Thu 9 Oct", the page's U.fmtDay */
const fmtDay = ymd => DAYS_S[new Date(ymd + 'T00:00:00Z').getUTCDay()] + ' ' + Number(ymd.slice(8, 10)) + ' ' + MON_S[Number(ymd.slice(5, 7)) - 1];

/* ================= PLANNER =================
   Pure functions over a plain state (stateOf builds it on the page; coo.js builds the same shape from the
   store). edgeone/server/coo.js keeps this block line for line, and test_coo_parity.py holds the two to
   the same answers. No M, no ctx, no page clock in here: every time is IST from the state or an argument.

   state: {now, today, cfg (the deep-merged settings.coo), rungs {cap: rung}, founder, members (the
     roster), holidays [ymd], settings {start, grace, eodCut, wfhCap}, tasks {id: task}, projects, pitches,
     clients, leave {uid: reqs[]}, leavedec {uid: {reqId: decision}}, checkin {uid: {ymd: day}},
     holds {subject: untilMs}, seen {leave: {'uid:reqId': snap}}, acts [today's ledger rows],
     slots {holidays, rollAt [HH:MM], eodCut, memoDay}} */
const SINCE = '2026-10-05';   /* M.COO_SINCE: a 'swap' before it is leave, from it on a WFH day */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = n => String(n).padStart(2, '0');
const ymdOf = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);
const dayStart = ymd => Date.parse(ymd + 'T00:00:00Z') - IST_MS;
const minsOf = ms => { const d = new Date(ms + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hmOf = ms => { const d = new Date(ms + IST_MS); return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()); };
const toMins = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmmOf = mins => pad2(Math.floor(mins / 60)) + pad2(mins % 60);
const dowOf = ymd => new Date(ymd + 'T00:00:00Z').getUTCDay();
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const isoWeekOf = ms => {
  const x = new Date(ymdOf(ms) + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 3);
  const fy = x.getUTCFullYear(), f = new Date(Date.UTC(fy, 0, 4));
  return fy + '-W' + pad2(1 + Math.round(((x - f) / DAY - 3 + ((f.getUTCDay() + 6) % 7)) / 7));
};
const DOW = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
const numOr = (v, d) => v === null || v === undefined || v === '' || !isFinite(Number(v)) ? d : Number(v);
const isSet = v => v !== null && v !== undefined && v !== '' && isFinite(Number(v));

/* derived maps, worked out once per state object */
const memo = new WeakMap();
const memoOf = state => { let m = memo.get(state); if (!m) { m = {}; memo.set(state, m); } return m; };
/* after an act changes the state in place (an approval, a move), the derived maps start again */
const forget = state => { memo.delete(state); };

const holiSet = state => { const m = memoOf(state); return m.holi || (m.holi = new Set(state.holidays || [])); };
const isWork = (state, ymd) => dowOf(ymd) !== 0 && !holiSet(state).has(ymd);
const active = (state, u) => !!u && !!(state.members || {})[u] && state.members[u].active !== false;
const activeIds = state => Object.keys(state.members || {}).filter(u => active(state, u)).sort();
const WEIGHT = {low: 1, normal: 2, high: 3};
const weightOf = t => WEIGHT[t && t.priority] || 2;
const openTask = t => !!t && !t.deleted && (t.status === 'todo' || t.status === 'doing' || !t.status);
const tasksList = state => Object.keys(state.tasks || {}).sort().map(id => ({...state.tasks[id], id})).filter(t => !t.deleted);
const held = (state, key) => Number((state.holds || {})[key] || 0) > state.now;

/* who uid reports to: the page's managerFrom (07-lines.js), line for line */
function managerFrom(members, founderUid, uid) {
  const m = members[uid];
  if (!m) return null;
  if (m.reportsTo && m.reportsTo !== uid && members[m.reportsTo] && members[m.reportsTo].active !== false) return m.reportsTo;
  if (m.role === 'founder' || uid === founderUid) return null;
  if (m.pod) {
    const lead = Object.keys(members).find(k => k !== uid && members[k].active !== false && members[k].role === 'lead' && members[k].pod === m.pod);
    if (lead) return lead;
  }
  return founderUid && founderUid !== uid ? founderUid : null;
}

/* approved days per person, from the decision's snap when it has one: leave, and WFH days booked ahead
   (a 'wfh' request, or a 'swap' from SINCE on). The same reading as ctx.leaveMap and ctx.wfhMap */
function daysOff(state) {
  const m = memoOf(state);
  if (m.off) return m.off;
  const leave = {}, wfh = {};
  for (const u of Object.keys(state.leave || {})) {
    const dec = (state.leavedec || {})[u] || {};
    for (const r of state.leave[u] || []) {
      if (!r || !r.id) continue;
      const d = dec[r.id];
      if (!d || d.status !== 'approved') continue;
      const s = d.snap && d.snap.from && d.snap.to ? d.snap : r;
      const type = s.type || r.type;
      let day = s.from;
      for (let i = 0; i < 370 && YMD.test(day || '') && day <= s.to; i++) {
        const into = type === 'wfh' || (type === 'swap' && day >= SINCE) ? wfh : leave;
        (into[u] = into[u] || {})[day] = true;
        day = addDays(day, 1);
      }
    }
  }
  m.off = {leave, wfh};
  return m.off;
}
const isOut = (state, u, ymd) => !!((daysOff(state).leave[u] || {})[ymd]);
const plannedWfh = (state, u, ymd) => !!((daysOff(state).wfh[u] || {})[ymd]);
const nextWork = (state, ymd, u) => {
  let d = ymd;
  for (let i = 0; i < 40; i++) { d = addDays(d, 1); if (isWork(state, d) && !(u && isOut(state, u, d))) return d; }
  return addDays(ymd, 1);
};
const workDaysIn = (state, from, to) => {
  const out = [];
  if (!YMD.test(from || '') || !YMD.test(to || '') || to < from) return out;
  let d = from;
  for (let i = 0; i < 370 && d <= to; i++) { if (isWork(state, d)) out.push(d); d = addDays(d, 1); }
  return out;
};
/* the nth working day after ymd */
const nthWork = (state, ymd, n) => { let d = ymd; for (let i = 0; i < n; i++) d = nextWork(state, d); return d; };
const decided = (state, u, id) => { const d = ((state.leavedec || {})[u] || {})[id]; return !!d && (d.status === 'approved' || d.status === 'declined'); };
const countsAsLeave = (type, ymd) => type !== 'wfh' && !(type === 'swap' && ymd >= SINCE);
/* a request nobody has decided that covers the day and was asked before `before` */
const pendingOn = (state, u, ymd, before) => ((state.leave || {})[u] || []).some(r => r && r.id && !decided(state, u, r.id)
  && YMD.test(r.from || '') && YMD.test(r.to || '') && r.from <= ymd && r.to >= ymd && countsAsLeave(r.type, ymd) && (Number(r.at) || 0) < before);

/* the client-dated rule (B4): the COO never moves these */
function clientDated(state, t) {
  if (!t) return false;
  if (t.dueKind === 'client') return true;
  if (t.dueKind === 'internal') return false;
  if (t.client) return true;
  const p = t.project ? (state.projects || {})[t.project] : null;
  if (p && p.kind === 'client') return true;
  return !!(p && p.due && t.due && t.due === p.due);
}

/* days of this leave type left in the leave year that holds today; null while the policy is not set */
function balance(state, uid, type, yearStart) {
  const per = (((state.cfg || {}).leave || {}).perType || {})[type];
  if (!isSet(per)) return null;
  const ys = /^\d{2}-\d{2}$/.test(String(yearStart || '')) ? yearStart : '04-01';
  const y = Number(state.today.slice(0, 4));
  const from = state.today >= y + '-' + ys ? y + '-' + ys : (y - 1) + '-' + ys;
  const to = addDays((Number(from.slice(0, 4)) + 1) + from.slice(4), -1);
  const dec = (state.leavedec || {})[uid] || {};
  let used = 0;
  for (const r of (state.leave || {})[uid] || []) {
    const d = r && r.id ? dec[r.id] : null;
    if (!d || d.status !== 'approved') continue;
    const s = d.snap && d.snap.from && d.snap.to ? d.snap : r;
    if ((s.type || r.type) !== type) continue;
    used += workDaysIn(state, s.from > from ? s.from : from, s.to < to ? s.to : to).length;
  }
  return Number(per) - used;
}

/* every check on one leave or WFH request, each with its value and limit. A missing policy number fails
   closed and names itself in missing. near marks a check within 10 percent of its limit (unsure: the item
   drops a rung). The COO never declines: a failed check makes a card for Kaavish */
function leaveCheck(state, uid, req, nowMs) {
  const now = nowMs || state.now;
  const today = ymdOf(now);
  const c = (state.cfg || {}).leave || {};
  const type = req.type || 'casual';
  const checks = [], missing = [];
  const add = (k, ok, val, limit, near) => checks.push({k, ok: !!ok, val: val === undefined ? null : val, limit: limit === undefined ? null : limit, near: !!(ok && near)});
  const datesOk = YMD.test(req.from || '') && YMD.test(req.to || '') && req.to >= req.from;
  add('dates', datesOk, datesOk ? req.from + ' ' + req.to : '', 'from before to');
  const days = datesOk ? workDaysIn(state, req.from, req.to) : [];
  const m = (state.members || {})[uid] || {};
  const seen = ((state.seen || {}).leave || {})[uid + ':' + req.id];
  const same = !seen || (seen.from === req.from && seen.to === req.to && seen.type === req.type);
  if (type === 'wfh') return wfhCheck(state, uid, req, today, days, checks, add, same);

  const known = type === 'casual' || type === 'sick' || type === 'other';
  add('type', known, type, 'casual, sick or other');
  const per = known ? (c.perType || {})[type] : null;
  if (known && !isSet(per)) missing.push(type + ' leave days');
  add('policy', known && isSet(per), isSet(per) ? Number(per) : null, 'set');
  const maxDays = numOr(c.maxAutoDays, null);
  if (maxDays === null) missing.push('the most days I approve alone');
  add('days', days.length > 0 && maxDays !== null && days.length <= maxDays, days.length, maxDays);
  const bal = known ? balance(state, uid, type, c.yearStart) : null;
  add('balance', bal !== null && bal >= days.length, bal, days.length, bal !== null && (bal - days.length) < 0.1 * Number(per));
  const prob = YMD.test(m.probationEnd || '') && datesOk && m.probationEnd > req.from;
  add('probation', !prob || (type === 'sick' && c.probationLop === true), prob ? m.probationEnd : '', 'none');
  const need = type === 'sick' ? 0 : numOr((c.noticeDays || {})[type], null);
  if (need === null) missing.push('the notice for ' + type + ' leave');
  const notice = datesOk ? daysBetween(today, req.from) : -1;
  add('notice', need !== null && notice >= need, notice, need);
  /* people out on each day: approved, plus requests asked before this one */
  const at = Number(req.at) || now;
  const maxOut = numOr(c.maxOutPerDay, null), maxPod = numOr(c.maxOutPerPod, null);
  if (maxOut === null) missing.push('how many people can be out a day');
  let worst = 0, podWorst = 0;
  for (const d of days) {
    let n = 0, p = 0;
    for (const u of activeIds(state)) {
      if (u === uid || !(isOut(state, u, d) || pendingOn(state, u, d, at))) continue;
      n++;
      if (m.pod && state.members[u].pod === m.pod) p++;
    }
    worst = Math.max(worst, n); podWorst = Math.max(podWorst, p);
  }
  add('out', maxOut !== null && worst < maxOut, worst, maxOut, maxOut !== null && worst >= 0.9 * maxOut);
  if (m.pod) add('pod', maxPod === null || podWorst < maxPod, podWorst, maxPod);
  const black = (Array.isArray(c.blackout) ? c.blackout : []).find(b => {
    const bf = typeof b === 'string' ? b : (b && b.from) || '', bt = typeof b === 'string' ? b : (b && b.to) || bf;
    return datesOk && YMD.test(bf) && bf <= req.to && bt >= req.from;
  });
  add('blackout', !black, black ? (typeof black === 'string' ? black : black.from) : '', 'none');
  /* no client date of theirs inside the leave: an open client-dated task, or a client project they own */
  let client = 0;
  if (datesOk) {
    for (const t of tasksList(state)) if (t.owner === uid && openTask(t) && t.due && t.due >= req.from && t.due <= req.to && clientDated(state, t)) client++;
    for (const pid of Object.keys(state.projects || {})) {
      const p = state.projects[pid];
      if (p && p.owner === uid && p.kind === 'client' && !p.archived && p.status !== 'done' && p.due && p.due >= req.from && p.due <= req.to) client++;
    }
  }
  add('client', client === 0, client, 0);
  const mgr = managerFrom(state.members || {}, state.founder, uid);
  const mgrOut = !!mgr && days.length > 0 && days.every(d => isOut(state, mgr, d));
  add('manager', !mgrOut, mgrOut ? mgr : '', 'in');
  add('unchanged', same, same ? '' : 'changed', 'as seen');
  return {kind: 'leave', ok: checks.every(x => x.ok), near: checks.some(x => x.near), days: days.length, checks, missing,
    left: bal === null ? null : bal - days.length, out: worst, mgr: mgr || null, probation: prob};
}

/* a WFH day booked ahead: inside the person's weekly allowance (WFH check-ins plus approved planned days),
   not on leave, booked for today or later, and enough people left in the office when minOffice is set */
function wfhCheck(state, uid, req, today, days, checks, add, same) {
  const m = (state.members || {})[uid] || {};
  const cap = m.wfhCap != null && String(m.wfhCap) !== '' && Number(m.wfhCap) >= 0 ? Math.floor(Number(m.wfhCap)) : numOr((state.settings || {}).wfhCap, 0);
  add('ahead', days.length > 0 && req.from >= today, req.from || '', today);
  let worstWeek = 0;
  const weeks = {};
  for (const d of days) { const mon = addDays(d, -((dowOf(d) + 6) % 7)); (weeks[mon] = weeks[mon] || []).push(d); }
  for (const mon of Object.keys(weeks)) {
    const used = new Set();
    for (let i = 0; i < 6; i++) {
      const d = addDays(mon, i);
      const ci = ((state.checkin || {})[uid] || {})[d];
      if ((ci && ci.mode === 'wfh') || plannedWfh(state, uid, d)) used.add(d);
    }
    for (const d of weeks[mon]) used.add(d);
    worstWeek = Math.max(worstWeek, used.size);
  }
  add('cap', worstWeek <= cap, worstWeek, cap);
  add('leave', !days.some(d => isOut(state, uid, d)), days.filter(d => isOut(state, uid, d)).length, 0);
  const minOffice = numOr(((state.cfg || {}).wfh || {}).minOffice, 0);
  if (minOffice > 0) {
    let fewest = Infinity;
    for (const d of days) {
      const inOffice = activeIds(state).filter(u => u !== uid && u !== state.founder && !isOut(state, u, d) && !plannedWfh(state, u, d)).length;
      fewest = Math.min(fewest, inOffice);
    }
    add('office', fewest >= minOffice, fewest === Infinity ? null : fewest, minOffice);
  }
  add('unchanged', same, same ? '' : 'changed', 'as seen');
  return {kind: 'wfh', ok: checks.every(x => x.ok), near: false, days: days.length, checks, missing: [], nth: worstWeek, cap};
}

/* who reviews a task in review: its project's owner when that is someone else, else the founder */
const reviewerOf = (state, t) => {
  const p = t.project ? (state.projects || {})[t.project] : null;
  return p && p.owner && p.owner !== t.owner && active(state, p.owner) ? p.owner : state.founder;
};

/* the load snapshot (J30): score = priority weights of open todo and doing work, plus 2 per overdue task,
   plus 1 per task due within 3 working days. Review items count on the reviewer. cap is maxOpen scaled
   to the working days left this week, net of the person's leave */
function load(state, ymd) {
  const day = ymd || state.today;
  const out = {};
  for (const u of activeIds(state)) out[u] = {score: 0, open: 0, over: 0, soon: 0, review: 0, cap: 0};
  const soonEnd = nthWork(state, day, 3);
  for (const t of tasksList(state)) {
    if (openTask(t) && out[t.owner]) {
      const o = out[t.owner];
      o.open++; o.score += weightOf(t);
      if (t.due && t.due < day) { o.over++; o.score += 2; } else if (t.due && t.due <= soonEnd) { o.soon++; o.score += 1; }
    } else if (t.status === 'review') {
      const rv = reviewerOf(state, t);
      if (out[rv]) { out[rv].review++; out[rv].score += 1; }
    }
  }
  const maxOpen = numOr(((state.cfg || {}).load || {}).maxOpen, 12);
  const mon = addDays(day, -((dowOf(day) + 6) % 7));
  for (const u of Object.keys(out)) {
    let left = 0;
    for (let i = 0; i < 6; i++) { const d = addDays(mon, i); if (d >= day && isWork(state, d) && !isOut(state, u, d)) left++; }
    out[u].cap = Math.round(maxOpen * left / 6);
  }
  return out;
}
const median = (state, ld) => {
  const xs = Object.keys(ld || {}).filter(u => u !== state.founder).map(u => ld[u].score).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const h = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[h] : (xs[h - 1] + xs[h]) / 2;
};
const overLine = (state, ld) => { const L = (state.cfg || {}).load || {}; return Math.max(median(state, ld) * numOr(L.margin, 1.5), numOr(L.maxOpen, 12)); };

/* who could take a task: its project's people first, then the owner's pod; under the team median, not out
   in the next 3 working days, not on a 7 day hold, never the founder. Least loaded first */
function shortlist(state, task, ld, ymd) {
  const day = ymd || state.today;
  const owner = task && task.owner;
  const p = task && task.project ? (state.projects || {})[task.project] : null;
  const pod = owner && (state.members || {})[owner] ? state.members[owner].pod : '';
  const med = median(state, ld);
  const next3 = [day].concat([1, 2].map(n => nthWork(state, day, n))).filter(d => isWork(state, d));
  const ok = u => u !== owner && u !== state.founder && active(state, u) && !!ld[u] && ld[u].score < med
    && !next3.some(d => isOut(state, u, d)) && !held(state, 'uid:' + u);
  const order = list => list.filter((u, i) => list.indexOf(u) === i).filter(ok).sort((a, b) => ld[a].score - ld[b].score || (a < b ? -1 : 1));
  const fromProject = p ? order([p.owner].concat(Array.isArray(p.members) ? p.members : []).filter(Boolean)) : [];
  const fromPod = pod ? order(activeIds(state).filter(u => state.members[u].pod === pod)) : [];
  return fromProject.concat(fromPod.filter(u => fromProject.indexOf(u) < 0));
}

/* may the COO move this task at all: open, internal, nobody moved it by hand in 7 days, inside the
   once-a-week limit per task, not on hold */
function movable(state, t) {
  if (!openTask(t)) return {ok: false, why: 'status'};
  if (clientDated(state, t)) return {ok: false, why: 'client'};
  const since = state.now - 7 * DAY;
  const logs = (Array.isArray(t.ownerLog) ? t.ownerLog : []).concat(Array.isArray(t.dueLog) ? t.dueLog : []).filter(e => e && Number(e.at) > since);
  if (logs.some(e => e.by && e.by !== 'u_m360coo')) return {ok: false, why: 'person'};
  if (logs.filter(e => e.by === 'u_m360coo').length >= numOr(((state.cfg || {}).limits || {}).movesPerTaskWeek, 1)) return {ok: false, why: 'week'};
  if (held(state, 'task:' + t.id)) return {ok: false, why: 'hold'};
  return {ok: true, why: ''};
}

/* what today's acts have used of the day's limits (done, would and running rows all count) */
function used(state) {
  const out = {acts: 0, tell: 0, move: 0, shift: 0, leave: 0, ask: 0, draft: 0, per: {}, asked: {}};
  for (const r of state.acts || []) {
    if (!r || (r.status !== 'done' && r.status !== 'would' && r.status !== 'running')) continue;
    out.acts++;
    if (r.rung === 'tell') out.tell++;
    if (out[r.kind] !== undefined) out[r.kind]++;
    const refs = r.refs || {};
    if (r.kind === 'move') for (const u of [refs.uid, refs.to]) if (u) out.per[u] = (out.per[u] || 0) + 1;
    if (r.kind === 'ask' && refs.uid) out.asked[refs.uid] = (out.asked[refs.uid] || 0) + 1;
  }
  return out;
}
const limitOf = (state, k, d) => numOr((((state.cfg || {}).limits) || {})[k], d);

/* moves for one person's approved leave (J12): their open todo and doing work due inside the leave or one
   working day after it. Each internal task goes to the first shortlist pick, else its date rolls to the
   first working day after they are back. Client-dated work only goes to Kaavish (propose). Loads and caps
   are worked out again after every pick */
function planCover(state, uid, req) {
  const d = ((state.leavedec || {})[uid] || {})[req.id];
  const s = d && d.snap && d.snap.from && d.snap.to ? d.snap : req;
  const out = {moves: [], propose: [], skip: []};
  if (!YMD.test(s.from || '') || !YMD.test(s.to || '')) return out;
  const back = nextWork(state, s.to, uid);
  const ld = load(state);
  const u0 = used(state);
  let moves = limitOf(state, 'movesPerDay', 8) - u0.move, shifts = limitOf(state, 'shiftsPerDay', 12) - u0.shift;
  const per = {...u0.per}, perMax = limitOf(state, 'movesPerPersonDay', 3);
  const list = tasksList(state).filter(t => t.owner === uid && openTask(t) && t.due && t.due >= s.from && t.due <= back)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id < b.id ? -1 : 1));
  for (const t of list) {
    if (clientDated(state, t)) { out.propose.push({task: t.id, uid, due: t.due, why: 'client'}); continue; }
    const mv = movable(state, t);
    if (!mv.ok) { out.skip.push({task: t.id, why: mv.why}); continue; }
    const pick = (per[uid] || 0) < perMax && moves > 0 ? shortlist(state, t, ld, state.today).find(u => (per[u] || 0) < perMax) : null;
    if (pick) {
      out.moves.push({task: t.id, kind: 'owner', from: uid, to: pick, due: t.due, newDue: t.due, why: 'leave'});
      const w = weightOf(t);
      ld[pick].score += w; ld[pick].open++;
      if (ld[uid]) { ld[uid].score -= w; ld[uid].open--; }
      per[pick] = (per[pick] || 0) + 1; per[uid] = (per[uid] || 0) + 1; moves--;
    } else if (t.due < back && shifts > 0) {
      out.moves.push({task: t.id, kind: 'due', from: uid, to: uid, due: t.due, newDue: back, why: 'leave'});
      shifts--;
    } else out.skip.push({task: t.id, why: moves <= 0 && shifts <= 0 ? 'cap' : 'nobody'});
  }
  return out;
}

/* rebalance (J31): someone over max(team median x margin, maxOpen) on this snapshot and the one before
   gives away their lowest-priority internal todo work (and doing work untouched for 24 hours) until they
   are back under the line. An overdue task moves with its date set to the receiver's next working day,
   so the receiver takes no penalty */
function planRebalance(state, ld, prev, ymd) {
  const day = ymd || state.today;
  const out = {moves: [], over: []};
  if (!ld || !prev) return out;
  const line = overLine(state, ld), line0 = overLine(state, prev);
  out.over = Object.keys(ld).filter(u => u !== state.founder && ld[u].score > line && prev[u] && prev[u].score > line0)
    .sort((a, b) => ld[b].score - ld[a].score || (a < b ? -1 : 1));
  const work = JSON.parse(JSON.stringify(ld));
  const u0 = used(state);
  let moves = limitOf(state, 'movesPerDay', 8) - u0.move;
  const per = {...u0.per}, perMax = limitOf(state, 'movesPerPersonDay', 3);
  for (const u of out.over) {
    const list = tasksList(state).filter(t => t.owner === u && (t.status === 'todo' || !t.status || (t.status === 'doing' && (Number(t.updated) || 0) < state.now - DAY)))
      .filter(t => movable(state, t).ok)
      .sort((a, b) => weightOf(a) - weightOf(b) || ((b.due || '') < (a.due || '') ? -1 : (b.due || '') > (a.due || '') ? 1 : 0) || (a.id < b.id ? -1 : 1));
    for (const t of list) {
      if (work[u].score <= line || moves <= 0 || (per[u] || 0) >= perMax) break;
      const pick = shortlist(state, t, work, day).find(x => (per[x] || 0) < perMax);
      if (!pick) continue;
      const overdue = !!t.due && t.due < day;
      const newDue = overdue ? nextWork(state, day, pick) : (t.due || '');
      const w = weightOf(t) + (overdue ? 2 : 0) + (!overdue && t.due && t.due <= nthWork(state, day, 3) ? 1 : 0);
      out.moves.push({task: t.id, kind: 'owner', from: u, to: pick, due: t.due || '', newDue, why: 'overload',
        open: ld[u].open, over: ld[u].over, open2: ld[pick].open});
      work[u].score -= w; work[u].open--; work[pick].open++;
      work[pick].score += weightOf(t) + (newDue && newDue <= nthWork(state, day, 3) ? 1 : 0);
      per[u] = (per[u] || 0) + 1; per[pick] = (per[pick] || 0) + 1; moves--;
    }
  }
  return out;
}

/* the idempotency key for one act: the same kind, target and period always give the same key */
function actKey(kind, target, period) {
  const s = String(kind) + '|' + String(target) + '|' + String(period);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return String(kind).replace(/[^A-Za-z0-9]/g, '').slice(0, 12) + '-' + h.toString(36);
}

/* the house rules on any line a model wrote (and every template, in the tests): no dashes, no exclamation
   marks, no contrast constructions. {ok, why} */
function lint(text) {
  const s = String(text == null ? '' : text);
  const why = !s.trim() ? 'empty'
    : /[\u2013\u2014]/.test(s) || /\s-{1,2}\s/.test(s) ? 'a dash'
    : /!/.test(s) ? 'an exclamation mark'
    : /\brather\s+than\b/i.test(s) ? 'rather than'
    : /\binstead\s+of\b/i.test(s) ? 'instead of'
    : /\bnot\s+[^,.;:]{1,40},\s*but\b/i.test(s) ? 'not X, but' : '';
  return {ok: !why, why};
}

/* the named IST slots of a day (C1). at and late in minutes; late is lateMax, the last minute a slot may
   still start. all: runs on Sundays and holidays too (health only); w: the watch family, where only the
   latest due one runs */
const NAMED = [
  {id: 'open', at: 540, late: 180, all: true}, {id: 'brief', at: 585, late: 180},
  {id: 'r10', at: 600, late: 120}, {id: 'r11', at: 660, late: 120}, {id: 'r12', at: 720, late: 120}, {id: 'm1230', at: 750, late: 90},
  {id: 'r15', at: 900, late: 120}, {id: 'r16', at: 960, late: 120}, {id: 'r1730', at: 1050, late: 120},
  {id: 'close', at: 1260, late: 179, all: true}
];
function slotList(c) {
  const s = (c && c.slots) || c || {};
  const out = NAMED.slice();
  const rolls = Array.from(new Set((Array.isArray(s.rollAt) && s.rollAt.length ? s.rollAt : ['10:45']).map(toMins).filter(x => x !== null))).sort((a, b) => a - b);
  for (const t of rolls) { out.push({id: 'roll' + hhmmOf(t), at: t, late: 120}); out.push({id: 'roll' + hhmmOf(t) + 'b', at: t + 60, late: 120}); }
  const eod = toMins(s.eodCut);
  out.push({id: 'eod', at: eod === null ? 1170 : eod, late: 120});
  out.push({id: 'memo', at: 720, late: 360, dow: DOW[String(s.memoDay || 'sat').slice(0, 3).toLowerCase()]});
  for (let t = 540; t <= 1260; t += 15) out.push({id: 'w' + hhmmOf(t), at: t, late: 14, w: true});
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}
/* which slots are due at nowMs. done: the slots already claimed or settled today (a Set, a list or a map).
   {ymd, work, run [{id, at}], skip [{id, at, why}], next {slot, at}} */
function slotsDue(c, nowMs, done) {
  const s = (c && c.slots) || c || {};
  const ymd = ymdOf(nowMs), mins = minsOf(nowMs);
  const work = dowOf(ymd) !== 0 && (s.holidays || []).indexOf(ymd) < 0;
  const has = id => !!done && (done instanceof Set ? done.has(id) : Array.isArray(done) ? done.indexOf(id) >= 0 : !!done[id]);
  const run = [], skip = [];
  let next = null, w = null;
  for (const x of slotList(s)) {
    if (!work && !x.all) continue;
    if (x.dow !== undefined && dowOf(ymd) !== x.dow) continue;
    const at = dayStart(ymd) + x.at * MIN;
    if (mins < x.at) { if (!next) next = {slot: x.id, at}; continue; }
    if (has(x.id)) continue;
    if (x.w) { if (mins < x.at + x.late) w = {id: x.id, at}; continue; }
    if (mins <= x.at + x.late) run.push({id: x.id, at}); else skip.push({id: x.id, at, why: 'late'});
  }
  if (w) run.push(w);
  run.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return {ymd, work, run, skip, next};
}
/* ================= end PLANNER ================= */

/* ---------- the mandate as it stands ----------
   The server builds a small ctx the same shape as the page's (settings, members, founderUid, coll.<name>.map,
   coo.state, coo.L, names), so cfg, rung, stateOf and copy read it exactly as the page reads its own */
const isCoo = u => u === UID;
const deep = (a, b) => {
  const o = {...(a || {})};
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? deep(o[k], v) : v;
  }
  return o;
};
/* settings.coo over the defaults, deep-merged */
function cfg(ctx) {
  const raw = ctx && ctx.settings && isObj(ctx.settings.coo) ? ctx.settings.coo : {};
  return deep(COO_DEFAULTS, raw);
}
const title = ctx => String(cfg(ctx).title || 'm360 COO').slice(0, 40);
const cooState = ctx => (ctx && ctx.coo && ctx.coo.state) || {};
/* the rung a capability runs at now: the founder's setting, under its ceiling, under any breaker */
function rung(ctx, cap) {
  const c = cfg(ctx);
  let r = RUNGS.indexOf((c.caps || {})[cap]) >= 0 ? c.caps[cap] : 'off';
  if (CEIL[cap]) r = lowerOf(r, CEIL[cap]);
  const b = (cooState(ctx).breakers || {})[cap];
  if (b && b.rung) r = lowerOf(r, b.rung);
  return r;
}
/* the practice week: practiceUntil is its last day (YYYY-MM-DD) */
const practicing = (c, now) => !!c.practiceUntil && (typeof c.practiceUntil === 'number' ? now < c.practiceUntil : ymdOf(now) <= String(c.practiceUntil));
/* off, stuck (a refused write stopped it), paused, practice or on; COO_OFF on the server is off whatever the settings say */
function status(ctx, nowMs, env) {
  const now = nowMs || Date.now();
  const c = cfg(ctx);
  if (!c.on || (env && String(env.COO_OFF || '') === '1')) return 'off';
  if (cooState(ctx).stuck) return 'stuck';
  if (Number(c.pausedUntil) > now) return 'paused';
  return practicing(c, now) ? 'practice' : 'on';
}

const mapOf = (ctx, n) => ((ctx && ctx.coll && ctx.coll[n]) || {}).map || {};
/* the planner's state, from the server's ctx: the page's stateOf, line for line */
function stateOf(ctx, nowMs) {
  const now = nowMs || Date.now();
  const today = ymdOf(now);
  const s = (ctx && ctx.settings) || {};
  const members = (ctx && ctx.members) || {};
  const leave = {}, leavedec = {}, checkin = {};
  for (const u of Object.keys(mapOf(ctx, 'leave'))) leave[u] = (mapOf(ctx, 'leave')[u] || {}).reqs || [];
  for (const u of Object.keys(mapOf(ctx, 'leavedec'))) leavedec[u] = clone((mapOf(ctx, 'leavedec')[u] || {}).d || {});
  for (const u of Object.keys(mapOf(ctx, 'checkin'))) checkin[u] = (mapOf(ctx, 'checkin')[u] || {}).days || {};
  const cs = cooState(ctx);
  const L = ((ctx && ctx.coo && ctx.coo.L) || {})[today];
  const rungs = {};
  for (const k of CAPS) rungs[k] = rung(ctx, k);
  const grace = Number(s.grace) || 0;
  /* the roll call runs at each distinct start plus grace on the roster */
  const rollAt = Array.from(new Set(Object.keys(members).filter(u => members[u].active !== false && u !== (ctx && ctx.founderUid))
    .map(u => { const m = toMins(members[u].start || s.start || '10:30'); return m === null ? null : hmOf(dayStart('2026-01-01') + (m + grace) * MIN); })
    .filter(Boolean))).sort();
  return {
    now, today, cfg: cfg(ctx), rungs, founder: (ctx && ctx.founderUid) || null, members,
    holidays: (s.holidays || []).slice(),
    settings: {start: s.start || '10:30', grace, eodCut: s.eodCut || '19:30', wfhCap: s.wfhCap, mondayCut: s.mondayCut || '12:00'},
    tasks: mapOf(ctx, 'tasks'), projects: mapOf(ctx, 'projects'), pitches: mapOf(ctx, 'pitches'), clients: mapOf(ctx, 'clients'),
    leave, leavedec, checkin, holds: {...(cs.holds || {})}, seen: clone(cs.seen || {}),
    acts: Object.keys((L && L.acts) || {}).map(id => ({...L.acts[id], id})),
    slots: {holidays: (s.holidays || []).slice(), rollAt: rollAt.length ? rollAt : ['10:45'], eodCut: s.eodCut || '19:30', memoDay: cfg(ctx).memoDay || 'sat'}
  };
}

/* ---------- names: first names from p/<uid>, learned once per pass; the COO keeps its whole title ---------- */
const nameOf = (ctx, u) => !u ? 'Someone' : isCoo(u) ? title(ctx) : (((ctx && ctx.names) || {})[u] || 'Someone');

/* ---------- the copy: one source for DMs, cards, the digest and the office bubbles ----------
   founder scope: the full line about the act. team scope: one generic line per station, with no names,
   numbers, reasons, money or clients. dm scope: the words the person receives. Every line passes lint() */
const TEAM = {
  attendance: 'Doing the morning roll call.', board: 'Tidying the task board.', calendar: 'Checking the calendar.',
  desk: 'Writing at its desk.', review: 'Walking work to a reviewer.', mail: 'Sorting the mail.', meeting: 'In the meeting room.',
  reception: 'At reception.', tray: 'In the cabin.', books: 'In the cabin.', clients: 'At the client wall.', clock: 'Checking the clock.',
  night: 'Off for the night. Back at 09:00.'
};
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const dayTxt = ymd => YMD.test(ymd || '') ? fmtDay(ymd) : '';
const rangeTxt = (a, b) => !YMD.test(a || '') ? '' : (!b || b === a ? dayTxt(a) : dayTxt(a) + ' to ' + dayTxt(b));
/* "15:00", "15:00 tomorrow" or "Thu 9 Oct" */
const untilTxt = (ms, now) => {
  if (!ms) return '';
  const d = ymdOf(ms), t = ymdOf(now || Date.now());
  return d === t ? hmOf(ms) : d === addDays(t, 1) ? hmOf(ms) + ' tomorrow' : dayTxt(d);
};
const TYPE_TXT = {casual: 'casual', sick: 'sick', other: '', swap: 'WFH swap'};
const STATUS_TXT = {risk: 'at risk', off: 'off track'};
const waits = n => n ? plural(n, 'thing waits', 'things wait') + ' for you.' : 'Nothing waits for you.';
const outTxt = n => n === 0 ? 'nobody else out' : plural(n, 'other person', 'other people') + ' out';
const nthTxt = n => (['', 'The first', 'The second', 'The third', 'The fourth', 'The fifth', 'The sixth'][n] || 'Number ' + n);

/* the values a line uses, read from the ids at the moment of reading */
function fill(ctx, a) {
  const x = a || {};
  const t = x.task ? (mapOf(ctx, 'tasks')[x.task] || ((((ctx && ctx.coll && ctx.coll.tasks) || {}).trash) || {})[x.task] || null) : null;
  const p = x.project ? mapOf(ctx, 'projects')[x.project] : null;
  const cl = x.client ? mapOf(ctx, 'clients')[x.client] : null;
  const pi = x.pitch ? mapOf(ctx, 'pitches')[x.pitch] : null;
  return {...x,
    name: x.uid ? nameOf(ctx, x.uid) : '', name2: x.to ? nameOf(ctx, x.to) : '',
    title: t ? String(t.title || 'a task') : 'a task',
    proj: p ? String(p.name || 'the project') : 'the project', cl: cl ? String(cl.name || 'the client') : (pi ? String(pi.brand || 'the client') : 'the client'),
    pitchTxt: pi ? String(pi.brand || 'the pitch') : 'the pitch',
    when: rangeTxt(x.d1, x.d2), dueTxt: dayTxt(x.due), due0Txt: dayTxt(x.due0), dayT: dayTxt(x.day),
    untilT: untilTxt(x.until, Date.now()), atTxt: x.at ? hmOf(x.at) : '', typeTxt: TYPE_TXT[x.type] !== undefined ? TYPE_TXT[x.type] : String(x.type || ''),
    statusTxt: STATUS_TXT[x.status] || String(x.status || '')};
}
const COPY = {
  open: {f: () => 'Morning. The office is open.'},
  open_rest: {f: () => 'A day off for the team. I only checked my health.'},
  brief: {f: x => 'Morning. ' + x.leave + ' on leave, ' + x.wfh + ' WFH. Roll call at ' + x.roll + ' and rebalance at 3. ' + waits(x.wait)},
  caught: {f: x => 'I caught up at ' + x.atTxt + '. ' + plural(x.n, 'round', 'rounds') + ' ran late because m360 was closed.'},
  roll: {f: x => 'Roll call. ' + x.n + ' in, ' + x.wfh + ' WFH, ' + x.leave + ' on leave' + (x.notIn === 1 ? ', ' + x.name + ' not in yet' : x.notIn ? ', ' + x.notIn + ' not in yet' : '') + '.'},
  eod: {f: x => x.n + ' of ' + x.of + ' EOD lines in.'},
  close: {f: x => 'Day closed. ' + x.eod + ' of ' + x.of + ' EOD lines in. ' + (x.moves ? 'I made ' + plural(x.moves, 'move', 'moves') + ', still undoable till ' + x.untilT + '. ' : '') + waits(x.wait)},
  memo: {f: x => 'The memo for ' + String(x.week || 'the week').replace('-W', ' week ') + ' is ready.'},
  leave_ok: {f: x => 'I approved ' + x.name + "'s " + (x.typeTxt ? x.typeTxt + ' ' : '') + 'leave on ' + x.when + '. ' + plural(x.left, 'day', 'days') + ' left, ' + outTxt(x.out) + ', no client dates. Undo until ' + x.untilT + '.',
    dm: x => 'Your leave for ' + x.when + ' is approved.'},
  leave_card: {f: x => x.name + ' asked for leave on ' + x.when + '. It needs you.'},
  leave_wait: {f: x => x.name + "'s leave from " + x.when + ' is still waiting on you. Pending leave holds every nudge for ' + x.name + ' that day.'},
  wfh_ok: {f: x => 'Approved ' + x.name + "'s WFH on " + x.when + '. ' + nthTxt(x.nth) + ' this week.', dm: x => 'Your WFH day on ' + x.when + ' is approved.'},
  wfh_card: {f: x => x.name + ' asked to work from home on ' + x.when + '. It needs you.'},
  cover_move: {f: x => x.name + ' is away ' + x.when + '. I moved ' + x.title + ' to ' + x.name2 + '. Internal. Undo for 24 hours.',
    dm: x => 'I handed you ' + x.title + (x.newDue ? ', due ' + dayTxt(x.newDue) : '') + '. ' + x.name + ' is out ' + x.when + '. Kaavish can undo this until ' + x.untilT + '.'},
  cover_away: {f: x => 'Told ' + x.name + ' about ' + x.title + '.', dm: x => 'I handed ' + x.title + ' to ' + x.name2 + ' while you are away. Kaavish can undo this until ' + x.untilT + '.'},
  cover_shift: {f: x => x.name + ' is away ' + x.when + '. I moved ' + x.title + ' to ' + x.dueTxt + '. Undo for 24 hours.',
    dm: x => 'I moved ' + x.title + ' to ' + x.dueTxt + ', after your time away. Kaavish can undo this until ' + x.untilT + '.'},
  cover_client: {f: x => capFirst(x.title) + ' is a client date and ' + x.name + ' is away ' + x.when + '. It needs you.'},
  said_off: {f: x => 'Asked ' + x.name + ' to file the leave they mentioned.', dm: () => 'You said you are off today. File the leave so the bots stay quiet.'},
  outcomes: {f: x => 'Asked ' + x.name + " for this week's outcomes.", dm: x => 'Your outcomes for this week are empty.' + (x.list ? ' From your open work: ' + x.list + '.' : '') + ' Save up to three on Home.'},
  outcomes_mgr: {f: x => 'Told ' + x.name2 + ' that ' + x.name + ' has no outcomes yet.', dm: x => x.name + ' has no outcomes for this week yet.'},
  review_ask: {f: x => 'Asked ' + x.name2 + ' to review ' + x.title + '. It has waited since ' + x.dayT + '.',
    dm: x => capFirst(x.title) + ' has waited for your review since ' + x.dayT + '. ' + x.name + ' is waiting on it.'},
  review_late: {f: x => capFirst(x.title) + ' has waited for review since ' + x.dayT + '. It needs you.'},
  blocked_ask: {f: x => 'Asked ' + x.name2 + ' to unblock ' + x.name + ' on ' + x.title + '.', dm: x => x.name + ' is blocked on ' + x.title + '. Can you unblock it?'},
  blocked_late: {f: x => x.name + ' has been blocked on ' + x.title + ' since ' + x.atTxt + '. It needs you.'},
  review_prep: {f: x => 'Friday review prep is ready for ' + plural(x.n, 'person', 'people') + '.'},
  care: {f: x => 'Sent a care note to ' + x.name + '.', dm: () => 'You have had three long days in a row. Take the evening if you can.'},
  setup_leave: {f: x => 'Set ' + (x.typeTxt ? x.typeTxt + ' ' : '') + 'leave days in Admin, COO. Until then every leave request waits for you.'},
  setup_policy: {f: x => 'Set ' + (x.what || 'the leave policy') + ' in Admin, COO. Until then leave waits for you.'},
  setup_holidays: {f: x => 'No holidays are set for ' + x.year + '. Add them so nobody is chased on a day off.'},
  setup_lines: {f: x => plural(x.n, 'person has', 'people have') + ' no reporting line and fall back to you.'},
  setup_pm: {f: () => 'Personal managers are off. Switch them on so people hear from their own manager first.'},
  setup_join: {f: x => plural(x.n, 'join request is', 'join requests are') + ' waiting.'},
  load: {f: x => 'Load snapshot. ' + (x.n ? plural(x.n, 'person is', 'people are') + ' over the line.' : 'Nobody is over the line.')},
  rebalance: {f: x => 'Moved ' + x.title + ' from ' + x.name + ' to ' + x.name2 + '. ' + x.name + ' has ' + x.open + ' open, ' + x.over + ' overdue. ' + x.name2 + ' has ' + x.open2 + '. Undo for 24 hours.',
    dm: x => 'I handed you ' + x.title + (x.newDue ? ', due ' + dayTxt(x.newDue) : '') + '. Kaavish can undo this until ' + x.untilT + '.'},
  handed_away: {f: x => 'Told ' + x.name + ' about ' + x.title + '.', dm: x => 'I moved ' + x.title + ' to ' + x.name2 + '. Kaavish can undo this until ' + x.untilT + '.'},
  orphan: {f: x => 'Gave ' + x.title + ' to ' + x.name2 + '. ' + (x.left ? 'Its owner left.' : 'It had no owner.') + ' Undo for 24 hours.',
    dm: x => 'I handed you ' + x.title + (x.newDue ? ', due ' + dayTxt(x.newDue) : '') + '. Kaavish can undo this until ' + x.untilT + '.'},
  shift_blocked: {f: x => capFirst(x.title) + ' is blocked, so I moved it to ' + x.dueTxt + '. Undo for 24 hours.',
    dm: x => 'You are blocked on ' + x.title + ', so I moved it to ' + x.dueTxt + '. Kaavish can undo this until ' + x.untilT + '.'},
  eta_ask: {f: x => 'Asked ' + x.name + ' for a date on ' + x.title + '.', dm: x => capFirst(x.title) + ' was due ' + x.due0Txt + '. When will it be in?'},
  eta_shift: {f: x => x.name + ' said ' + x.dueTxt + ' for ' + x.title + ', so I set it. Undo for 24 hours.'},
  pileup: {f: x => x.name + ' had ' + x.n + ' tasks due ' + x.dayT + '. I moved ' + x.title + ' to ' + x.dueTxt + '. Undo for 24 hours.',
    dm: x => 'You had ' + x.n + ' tasks due ' + x.dayT + ', so I moved ' + x.title + ' to ' + x.dueTxt + '. Kaavish can undo this until ' + x.untilT + '.'},
  offday: {f: x => capFirst(x.title) + ' was due on a day ' + x.name + ' is off, so I moved it to ' + x.dueTxt + '. Undo for 24 hours.',
    dm: x => capFirst(x.title) + ' was due on a day you are off, so I moved it to ' + x.dueTxt + '. Kaavish can undo this until ' + x.untilT + '.'},
  pileup_client: {f: x => capFirst(x.title) + ' is a client date on a day ' + x.name + ' is off. It needs you.'},
  client_risk: {f: x => capFirst(x.title) + ' is due ' + x.dueTxt + ' and ' + x.name + ' is ' + (x.state || 'stretched') + '. It needs you.'},
  due_tomorrow: {f: x => 'Reminded ' + x.name + " of tomorrow's work.", dm: x => 'Due tomorrow: ' + (x.list || 'your open work') + '.'},
  project_risk: {f: x => 'Raised ' + x.proj + ' to ' + x.statusTxt + '. ' + x.pct + ' percent done with ' + x.elapsed + ' percent of the time gone' + (x.over ? ', ' + x.over + ' overdue' : '') + '.',
    dm: x => 'I raised ' + x.proj + ' to ' + x.statusTxt + '. ' + x.pct + ' percent done with ' + x.elapsed + ' percent of the time gone.'},
  pitch_ask: {f: x => 'Asked ' + x.name + ' about the next step on ' + x.pitchTxt + '.', dm: x => capFirst(x.pitchTxt) + ' needs a next step. What is it, and when?'},
  pitch_late: {f: x => capFirst(x.pitchTxt) + ' has waited ' + plural(x.n, 'working day', 'working days') + ' for a next step. It needs you.'},
  client_mail: {f: x => 'Drafted a follow-up to ' + x.cl + '. It waits for your tap.'},
  meeting_mail: {f: x => 'Drafted a confirm note for ' + (x.what || "tomorrow's meeting") + '. It waits for your tap.'},
  invoice: {f: x => 'Drafted a reminder for ' + (x.no || 'an invoice') + '. It sends when you tap.'},
  audit: {f: x => x.n ? 'Self audit found ' + plural(x.n, 'thing', 'things') + '. It needs you.' : 'Self audit clean.'},
  cap_hit: {f: x => "I reached today's limit on " + (x.what || 'that') + ', so the rest waits for tomorrow.'},
  breaker: {f: x => 'You undid 2 of my ' + (x.what || 'moves') + ' this week, so I will only suggest ' + (x.what || 'moves') + ' until you say so.'},
  breaker_wrong: {f: x => 'You marked 2 of my ' + (x.what || 'moves') + ' wrong this week, so I will only suggest ' + (x.what || 'moves') + ' until you say so.'},
  fails: {f: x => plural(x.n, 'act', 'acts') + ' failed in one round, so I will only suggest ' + (x.what || 'them') + ' until you say so.'},
  refused: {f: () => 'A write was refused, so I stopped. It needs you.'},
  undone: {f: x => 'Kaavish put ' + x.title + ' back with ' + x.name + '.', dm: x => 'Kaavish put ' + x.title + ' back with ' + x.name + '.'},
  undone_due: {f: x => 'Kaavish put ' + x.title + ' back to ' + x.dueTxt + '.', dm: x => 'Kaavish put ' + x.title + ' back to ' + x.dueTxt + '.'},
  undone_leave: {f: x => 'Kaavish took back the approval for ' + x.when + '.', dm: x => 'Kaavish took back the approval for ' + x.when + '. It is with him now.'},
  hello: {f: x => 'Said hello to ' + x.name + '.',
    dm: x => 'Hi ' + x.name + ', I am ' + x.bot + ', a bot that helps Kaavish run the day. I ask short questions and I explain anything I change. Kaavish reads what you send me. What I can do: #coo'},
  waiting: {f: x => plural(x.n, 'thing needs', 'things need') + ' you.'},
  paused: {f: x => 'Paused by you until ' + x.untilT + '.'},
  off: {f: () => 'The COO is off. Admin, COO to switch it on.'},
  late_beat: {f: x => 'No heartbeat since ' + (x.atTxt || 'this morning') + '. I will catch up on the next round.'},
  page_runner: {f: x => 'I work while m360 is open. Last round ' + (x.atTxt || 'not yet') + '.'},
  mail_off: {f: () => 'Mail is not set up, so the drafts wait. Admin, Mail.'}
};
/* the job behind each copy code (the station comes from the job) */
const CODE_JOB = {open: 'J01', open_rest: 'J01', brief: 'J02', caught: 'J02', roll: 'J03', eod: 'J04', close: 'J05', memo: 'J06',
  leave_ok: 'J10', leave_card: 'J10', wfh_ok: 'J11', wfh_card: 'J11', cover_move: 'J12', cover_away: 'J12', cover_shift: 'J12', cover_client: 'J12',
  leave_wait: 'J13', said_off: 'J14', outcomes: 'J15', outcomes_mgr: 'J15', review_ask: 'J16', review_late: 'J16', blocked_ask: 'J17',
  blocked_late: 'J17', review_prep: 'J18', care: 'J19', setup_leave: 'J20', setup_policy: 'J20', setup_holidays: 'J20', setup_lines: 'J20', setup_pm: 'J20',
  setup_join: 'J20', load: 'J30', rebalance: 'J31', handed_away: 'J31', orphan: 'J32', shift_blocked: 'J33', eta_ask: 'J34', eta_shift: 'J34',
  pileup: 'J35', offday: 'J35', pileup_client: 'J35', client_risk: 'J36', due_tomorrow: 'J37', project_risk: 'J38', pitch_ask: 'J40', pitch_late: 'J40',
  client_mail: 'J41', meeting_mail: 'J42', invoice: 'J43', audit: 'J51', undone: 'J31', undone_due: 'J33', undone_leave: 'J10', hello: 'J50'};
const stationOf = code => { const j = JOBS[code] ? code : CODE_JOB[code]; return (JOBS[j] || JOBS.J01).station; };
/* a practice line: "I would have moved ..." */
const wouldOf = line => {
  const s = String(line).replace(/\s*(Undo for 24 hours|Undo until [^.]*)\./g, '');
  const m = /\b(?:I )?(approved|moved|gave|asked|raised|drafted|reminded|sent|told)\b/i.exec(s);
  if (!m) return 'Practice. ' + s;
  return s.slice(0, m.index) + 'I would have ' + m[1].toLowerCase() + s.slice(m.index + m[0].length);
};
/* the second line of a bubble or card: why, from a why code */
const WHY = {
  leave: 'Inside the leave policy.', wfh: 'Inside the WFH allowance.', overload: 'Evening out the load.', orphan: 'It had nobody on it.',
  blocked: 'Blocked work gets more time.', pileup: 'Too much due on one day.', eta: 'The owner gave a date.', policy: 'Outside what I approve alone.',
  missing: 'A policy number is not set.', client: 'A client date. Only you move those.', unsure: 'Close to a limit, so it waits for you.'
};
/* copy(code, args, scope, ctx): {line, why}. scope 'founder' (the default), 'team' or 'dm'. args.would gives
   the practice line ("I would have ..."), args.why a code for the second line, args.night the team's
   line after the close */
function copy(code, args, scope, ctx) {
  const c = COPY[code];
  const a = args || {};
  if (scope === 'team') return {line: a.night ? TEAM.night : TEAM[stationOf(code)] || TEAM.clock, why: ''};
  if (!c) return {line: '', why: ''};
  const cx = ctx;
  const x = fill(cx, {...a, bot: title(cx)});
  let line = scope === 'dm' && c.dm ? c.dm(x) : c.f(x);
  if (a.would && scope !== 'dm') line = wouldOf(line);
  return {line: String(line).replace(/\s+/g, ' ').trim(), why: WHY[a.why] || ''};
}

/* ---------- the guard: ALLOW and NEVER, before every write the bot makes ---------- */
const NEVER_PATH = /^(review|kudos|points|approvals|payroll|invoices|expenses|hr|roster|settings|access|handbook|onboard|letters|trash|bin|log|data|pulse|evals|join|fixes)(\/|$)|^books\/(?!cooq$)/;
const TASK_FIELDS = new Set(['owner', 'due', 'ownerLog', 'dueLog', 'updatedBy', 'updated', 'comments']);
const DEC_FIELDS = new Set(['status', 'at', 'by', 'why', 'checks', 'snap', 'undoUntil']);
const PROJECT_FIELDS = new Set(['updates', 'status', 'updated']);
const RAISE = {on: 0, risk: 1, off: 2};
const refuse = (path, why) => { const e = new Error('Refused: ' + why + ' (' + path + ').'); e.code = 'refused'; e.path = path; throw e; };
const isPlain = x => !!x && typeof x === 'object' && !Array.isArray(x);
/* guard(path, fields, doc, ctx): true, or it throws {code: 'refused'}. doc is the target as it stands now,
   for the checks that need it (a task's status and client date, a project's status) */
function guard(path, fields, doc, ctx) {
  const p = String(path || '');
  if (!isPlain(fields)) refuse(p, 'no fields');
  if (NEVER_PATH.test(p)) refuse(p, 'never');
  const keys = Object.keys(fields);
  let m = /^tasks\/([^/]+)$/.exec(p);
  if (m) {
    for (const k of keys) if (!TASK_FIELDS.has(k)) refuse(p, 'the field ' + k);
    for (const k of ['ownerLog', 'dueLog']) {
      if (fields[k] === undefined) continue;
      const list = fields[k];
      const last = Array.isArray(list) ? list[list.length - 1] : null;
      if (!last || last.by !== UID || !last.why) refuse(p, k + ' without the bot and a reason');
    }
    if (fields.updatedBy !== undefined && fields.updatedBy !== UID) refuse(p, 'updatedBy');
    for (const c of Object.values(fields.comments || {})) if (!c || c.by !== UID) refuse(p, "a comment in someone else's name");
    if (doc) {
      const moves = 'owner' in fields || 'due' in fields;
      if (!openTask(doc)) refuse(p, 'a task that is not open');
      if (moves && clientDated({projects: mapOf(ctx, 'projects')}, doc)) refuse(p, 'a client date');
      const since = Date.now() - 7 * DAY;
      const human = (Array.isArray(doc.ownerLog) ? doc.ownerLog : []).concat(Array.isArray(doc.dueLog) ? doc.dueLog : []).some(e => e && e.by && e.by !== UID && Number(e.at) > since);
      if (moves && human) refuse(p, 'a task a person moved this week');
    }
    return true;
  }
  m = /^leavedec\/([^/]+)$/.exec(p);
  if (m) {
    if (keys.join() !== 'd' || !isPlain(fields.d)) refuse(p, 'anything but decisions');
    for (const id of Object.keys(fields.d)) {
      const e = fields.d[id];
      if (!isPlain(e) || Object.keys(e).some(k => !DEC_FIELDS.has(k))) refuse(p, 'the decision fields');
      if (e.status !== 'approved') refuse(p, 'anything but an approval');
      if (e.by !== UID) refuse(p, "a decision in someone else's name");
    }
    return true;
  }
  m = /^projects\/([^/]+)$/.exec(p);
  if (m) {
    for (const k of keys) if (!PROJECT_FIELDS.has(k)) refuse(p, 'the field ' + k);
    for (const u of Object.values(fields.updates || {})) if (!u || u.by !== UID) refuse(p, "an update in someone else's name");
    if (fields.status !== undefined) {
      if (!(fields.status in RAISE) || fields.status === 'on') refuse(p, 'a status other than at risk or off track');
      if (doc && RAISE[fields.status] <= (RAISE[doc.status] === undefined ? 0 : RAISE[doc.status])) refuse(p, 'lowering a project');
      if (doc && (doc.status === 'done' || doc.archived)) refuse(p, 'a closed project');
    }
    return true;
  }
  if (p === 'me/' + UID) {
    if (keys.join() !== 'pm' || !isPlain(fields.pm) || Object.keys(fields.pm).some(k => k !== 'asks')) refuse(p, 'anything but its asks');
    return true;
  }
  m = /^chat\/(dm\.[^:/]+):([^:/]+)$/.exec(p);
  if (m) {
    if (m[2] !== UID || m[1].slice(3).split('.').indexOf(UID) < 0) refuse(p, 'a room that is not its own');
    for (const k of keys) if (['msgs', 'room', 'by', 'updated'].indexOf(k) < 0) refuse(p, 'the field ' + k);
    if (fields.by !== undefined && fields.by !== UID) refuse(p, "a line in someone else's name");
    return true;
  }
  if (/^coo\/[^/]+$/.test(p) || p === 'office/live' || p === 'books/cooq') return true;
  return refuse(p, 'outside the mandate');
}

/* ---------- the run: one slot, its acts, its cards ----------
   R.io is the desk's store: read, write (writeAs as the bot), quiet (coo/now and office/live only), the act
   keys and the time budget. Everything else here is the page's run, read from the store */
const plain = x => clone(x);
const norm = v => v === undefined || v === null ? '' : JSON.stringify(v);
const same = (cur, want) => !!want && Object.keys(want).every(k => norm((cur || {})[k]) === norm(want[k]));
/* a target is stored as data, so a row left running by a timeout can be checked on the next tick:
   {path, pick: {field: [[keys...], default]}} */
const pickOf = (doc, pick) => {
  const out = {};
  for (const k of Object.keys(pick || {})) {
    let v = doc;
    for (const s of pick[k][0]) v = v && typeof v === 'object' ? v[s] : undefined;
    out[k] = v === undefined || v === null || v === '' ? pick[k][1] : v;
  }
  return out;
};
const taskTarget = id => ({path: 'tasks/' + id, pick: {owner: [['owner'], ''], due: [['due'], '']}});
const decTarget = (uid, req) => ({path: 'leavedec/' + uid, pick: {status: [['d', req, 'status'], 'pending']}});
const MAIL = new Set(['client_mail', 'meeting_mail', 'invoice_reminder']);
/* the limits that stop a kind for the day (one info card says so); the per-person ones only skip */
const DAY_LIMIT = {move: 'movesPerDay', shift: 'shiftsPerDay', leave: 'leaveApprovalsPerDay', ask: 'asksPerDay', draft: 'draftsPerDay'};
const LIMIT_TXT = {actsPerDay: 'acts', tellPerDay: 'changes I tell you about', movesPerDay: 'task moves', shiftsPerDay: 'date moves',
  leaveApprovalsPerDay: 'leave approvals', asksPerDay: 'asks', draftsPerDay: 'drafts'};
const CAP_TXT = {leave: 'leave approvals', wfh: 'WFH approvals', cover: 'cover moves', rebalance: 'task moves', shift: 'date moves', orphans: 'owner picks',
  nudge: 'asks', reviews: 'review asks', projects: 'project updates', roll: 'roll calls', memo: 'reports'};

function newRun(ctx, io, slot, o) {
  const now = (o && o.now) || Date.now();
  const state = stateOf(ctx, now);
  return {ctx, io, slot, now, t0: Date.now(), ymd: ymdOf(now), state, cfg: state.cfg, practice: practicing(state.cfg, now), work: isWork(state, state.today),
    rows: [], unsaved: [], cards: [], cardPatch: {}, told: [], patch: {}, day: {}, fails: {}, late: (o && o.late) || [], job: null, load: null, prevLoad: null,
    drafts: [], stopped: false, out: false};
}
/* the ledger row, written as it moves: running, then done, would, skipped, conflict, refused or failed. A row
   before a change is written at once; reports, cards and practice rows wait for the next write or the end */
async function keep(R, row, now) {
  if (R.rows.indexOf(row) < 0) { R.rows.push(row); R.state.acts.push(row); }
  if (R.unsaved.indexOf(row) < 0) R.unsaved.push(row);
  if (now) await flush(R);
}
async function flush(R) {
  if (!R.unsaved.length) return;
  const rows = R.unsaved.splice(0);
  const acts = {};
  for (const r of rows) { const {id, ...rest} = r; acts[id] = plain(rest); }
  try { await R.io.ledger(R.ymd, acts); } catch (e) { R.unsaved.unshift(...rows); }
}
function overLimit(R, kind, refs, r) {
  const u = used(R.state);
  const L = k => limitOf(R.state, k, 0);
  if (u.acts >= L('actsPerDay')) return 'actsPerDay';
  if (r === 'tell' && u.tell >= L('tellPerDay')) return 'tellPerDay';
  if (DAY_LIMIT[kind] && u[kind] >= L(DAY_LIMIT[kind])) return DAY_LIMIT[kind];
  if (kind === 'ask' && refs.uid && (u.asked[refs.uid] || 0) >= L('asksPerPersonDay')) return 'asksPerPersonDay';
  if (kind === 'move') for (const x of [refs.uid, refs.to]) if (x && (u.per[x] || 0) >= L('movesPerPersonDay')) return 'movesPerPersonDay';
  return '';
}
const openCards = ctx => {
  const out = [];
  const add = (items, money) => { for (const id of Object.keys(items || {})) { const c = items[id]; if (c && (c.status === 'open' || c.status === 'snoozed' || c.status === 'sending')) out.push({...c, id, money}); } };
  add(((ctx.coo || {}).dec || {}).items, false);
  add(((mapOf(ctx, 'books').cooq) || {}).items, true);
  return out;
};
/* every card that still speaks for its thing: open, or settled by Kaavish (a declined card is never raised
   again). Voided and expired ones may come back */
const liveDedupe = ctx => {
  const out = new Set();
  const add = items => { for (const id of Object.keys(items || {})) { const c = items[id]; if (c && c.dedupe && c.status !== 'void' && c.status !== 'expired') out.add(c.dedupe); } };
  add(((ctx.coo || {}).dec || {}).items);
  add(((mapOf(ctx, 'books').cooq) || {}).items);
  return out;
};
/* one card per thing: a card already raised (or raised in this run) with the same dedupe key wins */
function addCard(R, card) {
  if (liveDedupe(R.ctx).has(card.dedupe) || R.cards.some(c => c.dedupe === card.dedupe)) return false;
  R.cards.push(card);
  return true;
}
function cardOf(R, o, r, row) {
  const c = o.card;
  const t = copy(c.code || o.code, o.args, 'founder', R.ctx);
  return {id: newId(), kind: c.kind, rung: r, title: t.line, why: c.why || t.why || '', recommend: c.recommend || '', checks: o.checks || [],
    options: c.options || (o.apply ? [{label: c.label || 'Apply', action: o.apply.action, input: o.apply.input}] : []),
    payload: {action: o.apply ? o.apply.action : '', input: o.apply ? o.apply.input : {}, draft: c.draft || null},
    sources: c.sources || [], refs: {...(o.refs || {}), actIds: [row.id]}, code: c.code || o.code, args: o.args || {}, urgent: !!c.urgent,
    dedupe: c.dedupe || (c.kind + ':' + (o.subject || row.id) + ':' + R.ymd), by: UID, at: Date.now(),
    expires: c.expires || Date.now() + (MAIL.has(c.kind) ? 3 : 14) * DAY, status: 'open', money: !!c.money};
}
/* an info card straight from the run (limits, breakers, the audit), with no act behind it */
function infoCard(R, code, args, dedupe, urgent) {
  const t = copy(code, args, 'founder', R.ctx);
  addCard(R, {id: newId(), kind: 'info', rung: 'tell', title: t.line, why: t.why, recommend: '', checks: [], options: [{label: 'Got it', action: 'coo.ack', input: {}}],
    payload: {action: 'coo.ack', input: {}, draft: null}, sources: [], refs: {}, code, args: args || {}, urgent: !!urgent, dedupe, by: UID, at: Date.now(),
    expires: Date.now() + 2 * DAY, status: 'open', money: false});
}

/* one act through the mandate: the rung (lowered when unsure), the time budget, the day's limits, the act key,
   the practice week, the ledger row before the change, the target read again, the write (guarded inside
   cooWrite), the read back, the words told and the settled row. o: as on the page, with target as data */
async function act(R, o) {
  const job = JOBS[o.job] || JOBS.J01;
  const cap = o.cap !== undefined ? o.cap : job.cap;
  let r = o.rung || (cap ? R.state.rungs[cap] || 'off' : 'alone');
  if (o.unsure) r = escalate(r);
  if (r === 'off') return {status: 'off'};
  /* no new act once the request has run 22 seconds: the slot keeps its cursor and the next tick carries on */
  if (R.io.late()) { R.out = true; return {status: 'budget'}; }
  /* the mandate is read again before every act: a stop or a pause takes effect at once, a rung Kaavish lowered
     since the round began holds from this act, and a practice week switched on makes the rest would rows */
  const fresh = R.halt ? null : await R.io.mandate();
  if (!fresh || fresh.st === 'off' || fresh.st === 'paused') { R.halt = true; return {status: 'off'}; }
  if (fresh.st === 'practice') R.practice = true;
  if (cap) r = lowerOf(r, rung({settings: fresh.settings, coo: R.ctx.coo}, cap));
  if (r === 'off') return {status: 'off'};
  const writes = !!o.write && (r === 'alone' || r === 'tell');
  const carded = !writes && !!o.card && (r === 'draft' || r === 'propose' || !o.write);
  if (!writes && !carded && o.kind !== 'report') return {status: 'off'};
  const kind = writes ? o.kind : carded ? (MAIL.has(o.card.kind) ? 'draft' : 'card') : 'report';
  const limit = overLimit(R, kind, o.refs || {}, r);
  if (limit) {
    if (limit !== 'asksPerPersonDay' && limit !== 'movesPerPersonDay') infoCard(R, 'cap_hit', {what: LIMIT_TXT[limit]}, 'info:cap:' + limit + ':' + R.ymd);
    return {status: 'cap', limit};
  }
  if (carded && o.card.dedupe && (liveDedupe(R.ctx).has(o.card.dedupe) || R.cards.some(c => c.dedupe === o.card.dedupe))) return {status: 'dupe'};
  /* one act per kind, target and period, whichever instance, tab or retry gets there first. Practice keys are
     their own, so the real act still runs the day Kaavish ends the practice week */
  const key = kind === 'report' ? '' : actKey(o.code, o.subject || o.code, (o.period || R.ymd) + (R.practice ? ':practice' : ''));
  const row = {id: newId(), at: Date.now(), slot: R.slot, job: o.job, code: o.code, cap: cap || null, rung: r, kind, charter: Number(R.cfg.version) || 1,
    subject: o.subject || '', rule: o.rule || '', facts: o.facts || [], checks: o.checks || [], before: o.before || null, after: o.after || null,
    why: {code: o.why || '', args: o.args || {}}, args: o.args || {}, told: [], undo: null, status: 'running', station: job.station, refs: {...(o.refs || {})}, by: 'server'};
  if (key) {
    if (!(await R.io.claimAct(R.ymd, key, row))) return {status: 'dupe'};
    row.key = key;
  }
  if (R.practice) {
    row.status = 'would';
    row.args = {...row.args, would: true};
    await keep(R, row);
    return {status: 'would', row};
  }
  if (kind === 'report') { row.status = 'done'; await keep(R, row); return {status: 'done', row}; }
  if (carded) {
    const card = cardOf(R, o, r, row);
    if (!addCard(R, card)) { await R.io.releaseAct(R.ymd, key); return {status: 'dupe'}; }
    row.status = 'done';
    row.refs.card = card.id;
    if (MAIL.has(card.kind)) R.drafts.push(card);
    await keep(R, row);
    return {status: 'card', row, card};
  }
  if (o.target) row.tgt = o.target;
  await keep(R, row, true);
  if (o.target) {
    const cur = pickOf(await R.io.read(o.target.path), o.target.pick);
    if (!same(cur, o.before)) {
      row.status = 'skipped'; row.note = 'moved';
      await R.io.releaseAct(R.ymd, key);
      await keep(R, row, true);
      return {status: 'skipped', row};
    }
  }
  try {
    R.cur = o.target ? {path: o.target.path, pick: o.target.pick, before: o.before} : null;
    await o.write(row);
  } catch (e) {
    const code = e && e.code;
    row.status = code === 'refused' ? 'refused' : code === 'skip' ? 'skipped' : 'failed';
    row.note = String((e && e.message) || 'failed').slice(0, 200);
    if (row.status !== 'refused') await R.io.releaseAct(R.ymd, key);
    await keep(R, row, true);
    if (row.status === 'refused') await stuck(R, row);
    else if (row.status === 'failed' && cap) { R.fails[cap] = (R.fails[cap] || 0) + 1; if (R.fails[cap] === 3) breaker(R, cap, 'fails'); }
    return {status: row.status, row};
  } finally { R.cur = null; }
  if (o.target) row.status = same(pickOf(await R.io.read(o.target.path), o.target.pick), o.after) ? 'done' : 'conflict';
  else row.status = 'done';
  if (row.status === 'done' && o.target && /^tasks\//.test(o.target.path)) {
    /* the task as it now stands, its logs included, so the rest of the round sees this move (once a week a task) */
    const id = o.target.path.slice(6);
    const t = await R.io.read(o.target.path);
    if (t) { R.state.tasks = {...R.state.tasks, [id]: t}; forget(R.state); }
  }
  if (row.status === 'done') {
    for (const t of o.told || []) {
      const text = copy(t.code, {...row.args, ...(t.args || {})}, 'dm', R.ctx).line;
      try { await say(R, t.uid, text, 'coo.' + row.id + '.' + t.uid, null); row.told.push({uid: t.uid, text, at: Date.now()}); } catch (e) { /* the act stands; the line did not go */ }
    }
    if (o.undo) row.undo = {...o.undo, ...(row.undo || {})};
    if (r === 'tell') R.told.push(row);
  }
  await keep(R, row, true);
  return {status: row.status, row};
}

/* a refused write: the row says so, the whole COO stops (coo/state.stuck) and Kaavish hears at once */
async function stuck(R, row) {
  R.patch.stuck = {at: Date.now(), why: row.note || 'refused', act: row.id};
  R.patch.breakers = {...(R.patch.breakers || {}), [row.cap || 'all']: {at: Date.now(), why: 'refused', rung: escalate(R.state.rungs[row.cap] || 'propose')}};
  infoCard(R, 'refused', {}, 'info:refused:' + R.ymd, true);
  try { await R.io.mergeDoc('coo/state', {stuck: R.patch.stuck}, 'coo stuck'); } catch (e) { /* the next round reads the row */ }
  R.stopped = true;
}
/* a circuit breaker: the capability drops one rung until Kaavish resets it in Admin */
function breaker(R, cap, why) {
  const b = {at: Date.now(), why, rung: escalate(R.state.rungs[cap] || 'off')};
  R.patch.breakers = {...(R.patch.breakers || {}), [cap]: b};
  infoCard(R, why === 'fails' ? 'fails' : 'breaker', {what: CAP_TXT[cap] || 'acts', n: 3}, 'info:breaker:' + cap + ':' + R.ymd, true);
}

/* every write the bot makes: the mandate on the fresh document, only its own fields merged in, under its own
   name (writeAs: a version under ~u_m360coo and a log line "coo <job> <actId>") */
async function cooWrite(R, path, fields, note) {
  const cur = await R.io.read(path);
  /* the act's own target, read at the last moment: a person (or Kaavish) who changed it since the plan wins */
  if (R.cur && R.cur.path === path && !same(pickOf(cur, R.cur.pick), R.cur.before)) { const e = new Error('moved since the plan'); e.code = 'skip'; throw e; }
  guard(path, fields, cur, R.ctx);
  const next = merge(cur || {}, fields);
  await R.io.write(path, next, note);
  return next;
}

/* ---------- the COO's own words to one person: a line in its DM room ----------
   The first line anyone gets from it is the hello. Each line carries an id, so a retry adds nothing */
async function say(R, u, text, xid, extra) {
  if (!u || isCoo(u) || !String(text || '').trim()) return null;
  const room = 'dm.' + [UID, u].sort().join('.');
  const key = room + ':' + UID;
  const cur = (await R.io.read('chat/' + key)) || {};
  const have = Array.isArray(cur.msgs) ? cur.msgs : [];
  const ids = new Set(have.map(m => m && m.id));
  if (xid && ids.has(xid)) return null;
  const add = [];
  if (!ids.has('hello.' + u) && !((cooState(R.ctx).hello || {})[u]) && !((R.patch.hello || {})[u])) {
    add.push({id: 'hello.' + u, at: Date.now(), text: copy('hello', {uid: u}, 'dm', R.ctx).line, mentions: [], via: 'coo'});
    R.patch.hello = {...(R.patch.hello || {}), [u]: Date.now()};
  }
  const m = {id: xid || newId(), at: Date.now() + add.length, text: String(text).trim().slice(0, 4000), mentions: [], via: 'coo'};
  for (const k of ['ask', 'k']) if (extra && extra[k] != null && extra[k] !== '') m[k] = String(extra[k]).slice(0, 120);
  add.push(m);
  let msgs = have.concat(add);
  if (msgs.length > 300) msgs = msgs.slice(msgs.length - 160);
  await cooWrite(R, 'chat/' + key, {msgs, room, by: UID, updated: Date.now()}, 'coo dm ' + m.id);
  return m;
}
/* ids, dates and numbers only ride on an ask record */
const plainArgs = a => { const o = {}; for (const k of Object.keys(a || {})) if (typeof a[k] === 'number' || (typeof a[k] === 'string' && a[k].length <= 80)) o[k] = a[k]; return o; };
const meOf = (ctx, u) => mapOf(ctx, 'me')[u] || {};
const cooAsks = ctx => ((meOf(ctx, UID).pm) || {}).asks || {};
const pmAcks = (ctx, u) => ((meOf(ctx, u).pm) || {}).ack || {};
/* an ask through the personal managers' pipes, as the page's M.pm.ask does it for the COO: the record on its
   own profile (me/u_m360coo.pm.asks) and one line from its DM room. Inside the person's own ask budget for
   the day, never on a day they are off or have leave waiting */
async function sendAsk(R, o) {
  const st = R.state;
  const u = o.to;
  const now = Date.now();
  if (!active(st, u)) return {why: 'not on the team'};
  if (!isWork(st, R.ymd) || isOut(st, u, R.ymd) || pendingOn(st, u, R.ymd, Infinity)) return {why: 'not working today'};
  const mine = cooAsks(R.ctx);
  if (o.kind !== 'custom' && Object.keys(mine).some(id => { const x = mine[id]; return x && !x.withdrawn && x.kind === o.kind && (x.to || []).indexOf(u) >= 0 && ymdOf(Number(x.at) || 0) === R.ymd; })) return {why: 'already asked today'};
  if ((o.kind === 'overdue' || o.kind === 'task') && !(st.tasks[o.sub] && st.tasks[o.sub].owner === u)) return {why: 'not their task'};
  let today = 0;
  for (const x of Object.keys(mapOf(R.ctx, 'me'))) for (const a of Object.values(((meOf(R.ctx, x).pm) || {}).asks || {})) if (a && !a.withdrawn && (a.to || []).indexOf(u) >= 0 && ymdOf(Number(a.at) || 0) === R.ymd) today++;
  if (today >= (Number(pmPolicy(R.ctx.settings).askPerDay) || 3)) return {why: 'their asks for today are used up'};
  const askId = newId();
  const rec = {kind: o.kind, to: [u], ask: ['why', 'eta', 'confirm'].indexOf(o.ask) >= 0 ? o.ask : 'why', at: now, via: 'coo', code: String(o.code).slice(0, 40), args: o.args || {}};
  if (o.sub && (o.kind === 'overdue' || o.kind === 'task')) rec.sub = String(o.sub);
  /* asks past 14 days go with the next one */
  const asks = {[askId]: rec};
  for (const id of Object.keys(mine)) if (mine[id] && (Number(mine[id].at) || 0) < now - 14 * DAY) asks[id] = null;
  const next = await cooWrite(R, 'me/' + UID, {pm: {asks}}, 'coo ask ' + askId);
  R.ctx.coll.me = {map: {...mapOf(R.ctx, 'me'), [UID]: next}};
  const K = pmKey(u, o.kind, o.kind === 'custom' ? askId : rec.sub || '-', R.ymd);
  try { await say(R, u, o.text, 'ask.' + askId + '.' + u, {ask: askId, k: K}); } catch (e) { /* the record stands; the card carries it */ }
  return {askId};
}
/* o: {job, code, rcpt, kind, sub, ask, args, subject, refs, cap} */
function askAct(R, o) {
  const rcpt = o.rcpt || (o.args || {}).uid;
  const args = {...(o.args || {})};
  if (!rcpt || rcpt === R.state.founder || !active(R.state, rcpt)) return Promise.resolve({status: 'off'});
  return act(R, {job: o.job, code: o.code, kind: 'ask', cap: o.cap || 'nudge', subject: o.subject || ('uid:' + rcpt), args, refs: {...(o.refs || {}), uid: rcpt},
    why: o.why || '', undo: {k: 'ask', until: dayStart(R.ymd) + DAY - MIN},
    write: async row => {
      const text = copy(o.code, args, 'dm', R.ctx).line;
      const res = await sendAsk(R, {to: rcpt, kind: o.kind || 'custom', sub: o.sub, ask: o.ask || 'why', code: o.code, args: plainArgs(args), text});
      if (!res.askId) { const e = new Error(res.why || 'not sent'); e.code = 'skip'; throw e; }
      row.refs.ask = res.askId;
      row.told.push({uid: rcpt, text, at: Date.now()});
    }});
}
/* the reason left on the task itself, readable by the team: never a leave type, never "overloaded" */
const commentFor = (why, a, ctx) => {
  const x = fill(ctx, a);
  const base = {leave: 'I moved this while ' + x.name + ' is out ' + x.when + '.', overload: 'I moved this to even out the week.', orphan: 'I gave this an owner.',
    blocked: 'I gave this more time while it is blocked.', pileup: 'I spread out a day with too much due.', eta: 'I set the date the owner gave.'}[why] || 'I moved this.';
  return base + ' Kaavish can undo it until ' + untilTxt(a.until, Date.now()) + '.';
};
/* the COO's move of one task, as the page's M.tasks.save does it for the bot: the owner and the due date only,
   each move in ownerLog and dueLog with its reason, a comment saying why, updatedBy the bot */
const logEntry = (from, to, by, at, why) => why ? {from, to, by, at, why} : {from, to, by, at};
const moveSave = (R, id, patch, why, args) => async row => {
  const task = await R.io.read('tasks/' + id);
  if (!task) { const e = new Error('that task is gone'); e.code = 'skip'; throw e; }
  const now = Date.now();
  const out = {updatedBy: UID, updated: now};
  if (patch.owner !== undefined && (task.owner || '') !== (patch.owner || '')) {
    out.owner = patch.owner || '';
    out.ownerLog = (Array.isArray(task.ownerLog) ? task.ownerLog : []).slice(-9).concat([logEntry(task.owner || '', out.owner, UID, now, why || 'move')]);
  }
  if (patch.due !== undefined && (task.due || '') !== (patch.due || '')) {
    out.due = patch.due || '';
    out.dueLog = (Array.isArray(task.dueLog) ? task.dueLog : []).slice(-9).concat([logEntry(task.due || '', out.due, UID, now, why || 'move')]);
  }
  out.comments = {[newId()]: {by: UID, t: commentFor(why, {...args, until: (row.undo && row.undo.until) || args.until}, R.ctx).slice(0, 600), at: now}};
  await cooWrite(R, 'tasks/' + id, out, 'coo ' + row.job + ' ' + row.id);
};
/* has this job already acted on this subject today */
const didToday = (R, code, subject) => R.state.acts.some(r => r && r.code === code && r.subject === subject && r.status !== 'skipped' && r.status !== 'failed');
const askedWithin = (R, u, code, days, sub) => Object.values(cooAsks(R.ctx)).some(a => a && !a.withdrawn && (a.to || []).indexOf(u) >= 0 && a.code === code
  && (sub === undefined || a.sub === sub) && (Number(a.at) || 0) > Date.now() - days * DAY);
const nonFounders = R => activeIds(R.state).filter(u => u !== R.state.founder);
/* does this person's own manager's bot already chase this kind (M.pm.chases): the COO never asks over it */
function chases(R, u, kind) {
  const P = pmPolicy(R.ctx.settings);
  if (!P.on || P.kinds[kind] === false) return false;
  const mgr = managerFrom(R.state.members || {}, R.state.founder, u);
  if (!mgr || (isObj(P.off) && P.off[mgr])) return false;
  const c = pmCfgOf({settings: R.ctx.settings, me: mapOf(R.ctx, 'me')}, mgr, R.ymd);
  return c.on && c.kinds[kind] !== false;
}
/* a manager's bot key, rep:kind:sub:ymd */
const parseKey = K => { const p = String(K || '').split(':'); return {rep: p[0], kind: p[1], sub: p.slice(2, -1).join(':'), ymd: p[p.length - 1]}; };
const failWhy = chk => {
  const f = chk.checks.find(c => !c.ok);
  if (!f) return chk.near ? WHY.unsure : '';
  const T = {
    dates: 'The dates do not add up.', type: 'A WFH swap always comes to you.', policy: 'A policy number is not set.', days: plural(f.val, 'working day', 'working days') + ', over the ' + f.limit + ' I approve alone.',
    balance: f.val === null ? 'No leave balance is set.' : 'Only ' + plural(f.val, 'day', 'days') + ' left.', probation: 'In probation until ' + dayTxt(f.val) + '.',
    notice: f.limit === null ? 'No notice period is set.' : 'Asked ' + plural(Math.max(0, f.val), 'day', 'days') + ' ahead, and the policy asks for ' + f.limit + '.',
    out: f.limit === null ? 'No limit on people out is set.' : plural(f.val, 'person is', 'people are') + ' already out that day.', pod: 'Their pod is already short that day.',
    blackout: 'A blackout date.', client: 'A client date falls inside it.', manager: 'Their manager is out those days.', unchanged: 'The request changed.',
    ahead: 'Booked for a day already gone.', cap: 'Over their WFH days for the week.', leave: 'They are on leave that day.', office: 'Too few left in the office.'};
  return T[f.k] || '';
};
/* undo windows: a leave approval until the leave starts (12 hours when it starts today) */
const leaveUntil = (from, now) => YMD.test(from || '') && from > ymdOf(now) ? dayStart(from) : now + 12 * HOUR;
const seenLeave = (R, u, req) => {
  const k = u + ':' + req.id;
  const snap = {from: req.from || '', to: req.to || '', type: req.type || ''};
  const cur = ((R.state.seen || {}).leave || {})[k];
  if (!cur || cur.from !== snap.from || cur.to !== snap.to || cur.type !== snap.type) {
    R.patch.seen = R.patch.seen || {leave: {}};
    R.patch.seen.leave[k] = snap;
  }
};
/* every leave request nobody has decided, in a stable order: asked at, then person, then id */
function pendings(state, wfh) {
  const out = [];
  for (const u of Object.keys(state.leave || {}).sort()) {
    if (!active(state, u)) continue;
    for (const r of state.leave[u] || []) if (r && r.id && !decided(state, u, r.id) && ((r.type === 'wfh') === !!wfh)) out.push({uid: u, req: r});
  }
  return out.sort((a, b) => (Number(a.req.at) || 0) - (Number(b.req.at) || 0) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0) || (a.req.id < b.req.id ? -1 : 1));
}
/* one person's day, the page's M.att.dayStatus: approved leave (a self-marked 'leave' counts only with the
   founder's fix), a holiday or Sunday, else the check-in's mode; late past their start plus grace */
function dayStatus(R, u, ymd) {
  const st = R.state;
  const ci = (st.checkin[u] || {})[ymd] || null;
  const mode = ci && (ci.mode === 'office' || ci.mode === 'wfh') ? ci.mode : null;
  let status = 'none';
  if (isOut(st, u, ymd) || (ci && ci.mode === 'leave' && ci.fixedBy)) status = 'leave';
  else if (!isWork(st, ymd)) status = 'off';
  else if (mode) status = mode;
  const start = toMins((st.members[u] || {}).start || st.settings.start) || 630;
  const late = (status === 'office' || status === 'wfh') && !!(ci && ci.in) && minsOf(Number(ci.in)) > start + (Number(st.settings.grace) || 0);
  return {status, late};
}

/* ---------- the jobs (part D of the spec), the page's, read from the store ---------- */
const J = {};

/* J01: the day opens. Health, and the office lights up */
J.J01 = async R => {
  R.day.open = {at: Date.now(), by: 'server', work: R.work};
  await act(R, {job: 'J01', code: R.work ? 'open' : 'open_rest', kind: 'report', cap: null, args: {}});
};

/* J02: the morning brief */
J.J02 = async R => {
  const st = R.state;
  const ids = nonFounders(R);
  const leave = ids.filter(u => isOut(st, u, R.ymd)).length;
  const wfh = ids.filter(u => plannedWfh(st, u, R.ymd) || (((st.checkin[u] || {})[R.ymd]) || {}).mode === 'wfh').length;
  const wait = openCards(R.ctx).length + R.cards.length;
  const roll = (st.slots.rollAt || ['10:45'])[0];
  const late = R.late.filter(x => x.why === 'late');
  R.day.brief = {at: Date.now(), leave, wfh, roll, wait, caught: late.length ? {at: Date.now(), n: late.length, slots: late.map(x => x.id)} : null};
  if (dowOf(R.ymd) === 1) {
    const next = workDaysIn(st, addDays(R.ymd, 7), addDays(R.ymd, 12));
    R.day.brief.ahead = {leave: ids.filter(u => next.some(d => isOut(st, u, d))).length, due: tasksList(st).filter(t => openTask(t) && t.due && t.due >= R.ymd && t.due <= addDays(R.ymd, 5)).length};
  }
  if (late.length) await act(R, {job: 'J02', code: 'caught', kind: 'report', args: {at: Date.now(), n: late.length}});
  await act(R, {job: 'J02', code: 'brief', kind: 'report', args: {leave, wfh, roll, wait}});
};

/* J03: the roll call, a report only (the nudges are the personal managers') */
J.J03 = async R => {
  const out = {in: [], wfh: [], leave: [], notIn: [], late: [], at: Date.now(), slot: R.slot};
  for (const u of nonFounders(R)) {
    const a = dayStatus(R, u, R.ymd);
    if (a.status === 'leave') out.leave.push(u);
    else if (a.status === 'wfh') out.wfh.push(u);
    else if (a.status === 'office') out.in.push(u);
    else if (!plannedWfh(R.state, u, R.ymd)) out.notIn.push(u);
    else out.wfh.push(u);
    if (a.late) out.late.push(u);
  }
  R.day.roll = out;
  await act(R, {job: 'J03', code: 'roll', kind: 'report', args: {n: out.in.length, wfh: out.wfh.length, leave: out.leave.length, notIn: out.notIn.length, uid: out.notIn[0] || ''}});
};

/* J04: the EOD sweep */
J.J04 = async R => {
  const ids = nonFounders(R).filter(u => !isOut(R.state, u, R.ymd));
  const eod = mapOf(R.ctx, 'eod');
  const missing = ids.filter(u => !(((eod[u] || {}).days || {})[R.ymd]));
  R.day.eod = {in: ids.length - missing.length, of: ids.length, missing, at: Date.now()};
  await act(R, {job: 'J04', code: 'eod', kind: 'report', args: {n: ids.length - missing.length, of: ids.length}});
};

/* J05: the close. The report, undo windows and old cards settled, the ledger past 90 days pruned, the close
   mailed to Kaavish when his digest asks for it, the office lights down */
J.J05 = async R => {
  const c = R.ctx;
  const now = Date.now();
  const L = (c.coo && c.coo.L) || {};
  let moves = 0, until = 0;
  for (const ymd of Object.keys(L)) {
    const acts = (L[ymd] && L[ymd].acts) || {};
    const exp = {};
    for (const id of Object.keys(acts)) {
      const r = acts[id];
      if (!r || r.status !== 'done' || !r.undo) continue;
      if (Number(r.undo.until) < now) exp[id] = {status: 'expired'};
      else if (ymd === R.ymd && (r.kind === 'move' || r.kind === 'shift')) { moves++; until = until ? Math.min(until, r.undo.until) : r.undo.until; }
    }
    if (Object.keys(exp).length && !R.practice) { try { await R.io.ledger(ymd, exp); } catch (e) { /* the next close */ } }
  }
  /* cards past their date expire; settled ones older than 30 days move to coo/dec-<yyyy-mm> */
  const items = ((c.coo && c.coo.dec) || {}).items || {};
  const patch = {}, arch = {};
  for (const id of Object.keys(items)) {
    const k = items[id];
    if (!k) continue;
    if ((k.status === 'open' || k.status === 'snoozed') && k.kind !== 'leave' && k.kind !== 'wfh' && Number(k.expires) && k.expires < now) patch[id] = {status: 'expired', decidedAt: now};
    if (k.status !== 'open' && k.status !== 'snoozed' && k.status !== 'sending' && (Number(k.decidedAt || k.at) || 0) < now - 30 * DAY) {
      const mon = ymdOf(Number(k.at) || now).slice(0, 7);
      (arch[mon] = arch[mon] || {})[id] = k; patch[id] = null;
    }
  }
  if (!R.practice) {
    for (const mon of Object.keys(arch)) { try { await R.io.mergeDoc('coo/dec-' + mon, {items: arch[mon]}, 'coo archive ' + mon); } catch (e) { for (const id of Object.keys(arch[mon])) delete patch[id]; } }
    if (Object.keys(patch).length) { try { await R.io.mergeDoc('coo/dec', {items: patch}, 'coo cards'); } catch (e) { /* the next close */ } }
    await R.io.prune(R.ymd).catch(() => {});
  }
  /* its own bookkeeping stays small: holds past their time, cover marks and seen requests past 30 days */
  const cs = cooState(c);
  const cut = now - 30 * DAY;
  const drop = (map, old) => { const o = {}; for (const k of Object.keys(map || {})) if (old(k, map[k])) o[k] = null; return o; };
  const holds = drop(cs.holds, (k, v) => Number(v) < now);
  const cover = drop(cs.cover, (k, v) => Number(v) < cut);
  const seenLeave = drop((cs.seen || {}).leave, k => { const [u, id] = k.split(':'); return !((R.state.leave[u] || []).some(r => r && r.id === id)) || decided(R.state, u, id); });
  if (Object.keys(holds).length) R.patch.holds = {...holds, ...(R.patch.holds || {})};
  if (Object.keys(cover).length) R.patch.cover = {...cover, ...(R.patch.cover || {})};
  if (Object.keys(seenLeave).length) R.patch.seen = {leave: {...seenLeave, ...(((R.patch.seen || {}).leave) || {})}};
  const eod = R.day.eod || (((await R.io.read('coo/day-' + R.ymd)) || {}).eod) || {in: 0, of: 0};
  const wait = openCards(c).filter(k => !patch[k.id]).length + R.cards.length;
  R.day.close = {at: now, eod: eod.in, of: eod.of, moves, until, wait, skipped: R.late.map(x => x.id)};
  await act(R, {job: 'J05', code: 'close', kind: 'report', args: {eod: eod.in, of: eod.of, moves, until, wait}});
  if (!R.practice && R.work) await R.io.founderMail(R, 'close', copy('close', {eod: eod.in, of: eod.of, moves, until, wait}, 'founder', c).line, wait).catch(() => {});
};

/* J06: the weekly memo, numbers by code; the prose by the model when the day's budget allows, else numbers only */
J.J06 = async R => {
  const st = R.state;
  const week = isoWeekOf(R.now);
  const mon = addDays(R.ymd, -((dowOf(R.ymd) + 6) % 7));
  const days = [0, 1, 2, 3, 4, 5].map(i => addDays(mon, i));
  const all = tasksList(st);
  const done = all.filter(t => t.status === 'done' && t.doneAt && ymdOf(Number(t.doneAt)) >= mon && ymdOf(Number(t.doneAt)) <= R.ymd).length;
  const slipped = all.filter(t => openTask(t) && t.due && t.due >= mon && t.due < R.ymd).length;
  const nextWeek = [7, 8, 9, 10, 11, 12].map(i => addDays(mon, i));
  const away = nonFounders(R).filter(u => nextWeek.some(d => isOut(st, u, d))).length;
  let eodIn = 0, eodOf = 0;
  for (const d of days) { const x = await R.io.read('coo/day-' + d); if (x && x.eod) { eodIn += x.eod.in || 0; eodOf += x.eod.of || 0; } }
  const numbers = {done, slipped, away, eodIn, eodOf, acts: st.acts.length};
  let lines = [done + ' tasks shipped this week, ' + slipped + ' slipped past their date.', eodIn + ' of ' + eodOf + ' EOD lines in.',
    away ? plural(away, 'person is', 'people are') + ' away next week.' : 'Nobody is away next week.'];
  const prose = R.practice ? null : await R.io.memoProse(R, numbers, lines).catch(() => null);
  if (prose) lines = [prose].concat(lines);
  if (!R.practice) { try { await R.io.mergeDoc('coo/memo-' + week, {at: Date.now(), week, numbers, lines, by: prose ? 'ai' : 'numbers'}, 'coo memo ' + week); } catch (e) { /* the card still carries it */ } }
  await act(R, {job: 'J06', code: 'memo', kind: 'report', args: {week}});
  await act(R, {job: 'J06', code: 'memo', kind: 'card', rung: 'draft', cap: 'memo', subject: 'memo:' + week, args: {week},
    card: {kind: 'memo', dedupe: 'memo:' + week, why: lines.join(' '),
      options: [{label: 'Post to Feed', action: 'post_to_feed', input: {kind: 'update', text: 'This week at Mask360. ' + lines.join(' ')}}, {label: 'Keep private', action: 'coo.ack', input: {}}]}});
};

/* J07 (team site): the away mail. Cards open over two hours and Kaavish away from m360: one mail, claimed */
J.J07 = async R => {
  if (R.practice) return;
  const old = openCards(R.ctx).filter(k => (k.status === 'open' || k.status === 'sending') && (Number(k.at) || 0) < R.now - 2 * HOUR);
  if (!old.length) return;
  const n = openCards(R.ctx).length;
  await R.io.founderMail(R, R.slot, plural(n, 'thing waits', 'things wait') + ' for you in m360. ' + old.slice(0, 3).map(k => String(k.title || '').trim()).filter(Boolean).join(' '), n, true);
};

/* J10: leave within policy. All checks pass and nothing is unsure: approved, told, undoable until it
   starts. Anything else becomes a card. It never declines */
J.J10 = async R => {
  const st = R.state;
  for (const {uid, req} of pendings(st, false)) {
    if (R.out || R.stopped) return;
    const subject = 'req:' + uid + ':' + req.id;
    const chk = leaveCheck(st, uid, req, R.now);
    seenLeave(R, uid, req);
    if (!chk.checks.find(c => c.k === 'unchanged').ok) continue;
    const unsure = chk.ok && (chk.near || uid === st.founder || chk.probation || held(st, subject) || held(st, 'uid:' + uid));
    const until = leaveUntil(req.from, Date.now());
    const snap = {from: req.from, to: req.to, type: req.type || 'casual', days: chk.days};
    const checks = chk.checks.map(c => ({k: c.k, ok: c.ok, val: c.val, limit: c.limit}));
    const entry = {status: 'approved', at: Date.now(), by: UID, why: 'policy', checks, snap, undoUntil: until};
    const args = {uid, d1: req.from, d2: req.to, type: req.type || 'casual', left: chk.left, out: chk.out, until};
    const why = chk.ok ? (unsure ? 'unsure' : 'leave') : chk.missing.length ? 'missing' : 'policy';
    const res = await act(R, {job: 'J10', code: 'leave_ok', kind: 'leave', rung: chk.ok ? st.rungs.leave : lowerOf(st.rungs.leave, 'propose'), unsure,
      subject, args, refs: {uid, req: req.id}, checks, why, facts: [{k: 'request', val: snap, src: 'leave/' + uid}],
      target: decTarget(uid, req.id), before: {status: 'pending'}, after: {status: 'approved'},
      write: row => cooWrite(R, 'leavedec/' + uid, {d: {[req.id]: entry}}, 'coo J10 ' + row.id),
      apply: {action: 'coo.approve_leave', input: {uid, req: req.id, from: req.from, to: req.to, type: req.type || 'casual'}},
      card: {kind: 'leave', code: 'leave_card', label: 'Approve', urgent: req.from <= addDays(R.ymd, 1), expires: dayStart(req.from || R.ymd), dedupe: 'leave:' + subject,
        why: chk.missing.length ? copy('setup_policy', {what: chk.missing.join(', ')}, 'founder', R.ctx).line : unsure ? (uid === st.founder ? 'Your own leave.' : WHY.unsure) : failWhy(chk)},
      told: [{uid, code: 'leave_ok'}],
      undo: {k: 'leave', uid, req: req.id, fields: ['status'], until}});
    if (res.status === 'done') { st.leavedec[uid] = {...(st.leavedec[uid] || {}), [req.id]: entry}; forget(st); }
  }
};

/* J11: a WFH day booked ahead, inside the allowance */
J.J11 = async R => {
  const st = R.state;
  for (const {uid, req} of pendings(st, true)) {
    if (R.out || R.stopped) return;
    const subject = 'req:' + uid + ':' + req.id;
    const chk = leaveCheck(st, uid, req, R.now);
    seenLeave(R, uid, req);
    if (!chk.checks.find(c => c.k === 'unchanged').ok) continue;
    const unsure = chk.ok && (uid === st.founder || held(st, subject) || held(st, 'uid:' + uid));
    const until = leaveUntil(req.from, Date.now());
    const checks = chk.checks.map(c => ({k: c.k, ok: c.ok, val: c.val, limit: c.limit}));
    const entry = {status: 'approved', at: Date.now(), by: UID, why: 'policy', checks, snap: {from: req.from, to: req.to, type: 'wfh', days: chk.days}, undoUntil: until};
    const args = {uid, d1: req.from, d2: req.to, type: 'wfh', nth: chk.nth, until};
    const res = await act(R, {job: 'J11', code: 'wfh_ok', kind: 'leave', rung: chk.ok ? st.rungs.wfh : lowerOf(st.rungs.wfh, 'propose'), unsure,
      subject, args, refs: {uid, req: req.id}, checks, why: chk.ok ? (unsure ? 'unsure' : 'wfh') : 'policy',
      target: decTarget(uid, req.id), before: {status: 'pending'}, after: {status: 'approved'},
      write: row => cooWrite(R, 'leavedec/' + uid, {d: {[req.id]: entry}}, 'coo J11 ' + row.id),
      apply: {action: 'coo.approve_leave', input: {uid, req: req.id, from: req.from, to: req.to, type: 'wfh'}},
      card: {kind: 'wfh', code: 'wfh_card', label: 'Approve', expires: dayStart(req.from || R.ymd), dedupe: 'wfh:' + subject, why: unsure ? WHY.unsure : failWhy(chk)},
      told: [{uid, code: 'wfh_ok'}],
      undo: {k: 'leave', uid, req: req.id, fields: ['status'], until}});
    if (res.status === 'done') { st.leavedec[uid] = {...(st.leavedec[uid] || {}), [req.id]: entry}; forget(st); }
  }
};

/* J12: cover for approved leave, whoever approved it. Once when the approval is seen, and again in the
   brief for leave starting today or tomorrow */
J.J12 = async R => {
  const st = R.state;
  const done = cooState(R.ctx).cover || {};
  for (const u of Object.keys(st.leave || {}).sort()) {
    if (!active(st, u)) continue;
    for (const req of st.leave[u] || []) {
      if (R.out || R.stopped) return;
      const d = req && req.id ? (st.leavedec[u] || {})[req.id] : null;
      if (!d || d.status !== 'approved') continue;
      const s = d.snap && d.snap.from ? d.snap : req;
      const type = s.type || req.type;
      if (type === 'wfh' || (type === 'swap' && s.from >= SINCE) || !YMD.test(s.to || '') || s.to < R.ymd) continue;
      const key = u + ':' + req.id + (R.slot === 'brief' ? ':' + R.ymd : '');
      if (done[key] || (R.patch.cover || {})[key]) continue;
      if (R.slot === 'brief' && s.from > addDays(R.ymd, 1)) continue;
      /* a practice round plans the cover again each time (its act keys keep the would rows to one a day), so
         the real cover still runs once practice ends */
      if (!R.practice) R.patch.cover = {...(R.patch.cover || {}), [key]: Date.now()};
      const plan = planCover(st, u, req);
      for (const mv of plan.moves) {
        const t = st.tasks[mv.task];
        const until = Date.now() + DAY;
        const owner = mv.kind === 'owner';
        const args = {uid: u, to: owner ? mv.to : '', task: mv.task, d1: s.from, d2: s.to, due: owner ? mv.due : mv.newDue, newDue: mv.newDue, until};
        await act(R, {job: 'J12', code: owner ? 'cover_move' : 'cover_shift', kind: owner ? 'move' : 'shift', cap: 'cover', unsure: u === st.founder,
          subject: 'task:' + mv.task, args, refs: {uid: u, to: owner ? mv.to : '', task: mv.task, req: req.id}, why: 'leave',
          target: taskTarget(mv.task), before: {owner: u, due: t.due || ''}, after: {owner: owner ? mv.to : u, due: owner ? (t.due || '') : mv.newDue},
          write: moveSave(R, mv.task, owner ? {owner: mv.to} : {due: mv.newDue}, 'leave', args),
          apply: {action: 'coo.move_task', input: owner ? {task: mv.task, owner: mv.to, why: 'leave'} : {task: mv.task, due: mv.newDue, why: 'leave'}},
          card: {kind: 'move', code: owner ? 'cover_move' : 'cover_shift', label: 'Move it', dedupe: 'move:task:' + mv.task + ':' + R.ymd},
          told: owner ? [{uid: mv.to, code: 'cover_move'}, {uid: u, code: 'cover_away'}] : [{uid: u, code: 'cover_shift'}],
          undo: {k: 'task', task: mv.task, fields: ['owner', 'due'], until}});
      }
      if (plan.propose.length) {
        const first = plan.propose[0];
        const ld = load(st);
        const opts = plan.propose.slice(0, 4).map(p => { const pick = shortlist(st, st.tasks[p.task], ld, R.ymd)[0]; return pick ? {label: 'Give ' + String((st.tasks[p.task] || {}).title || 'it').slice(0, 40) + ' to ' + nameOf(R.ctx, pick), action: 'coo.move_task', input: {task: p.task, owner: pick, why: 'leave'}} : null; }).filter(Boolean);
        await act(R, {job: 'J12', code: 'cover_client', kind: 'card', cap: 'cover', rung: lowerOf(st.rungs.cover, 'propose'), subject: 'req:' + u + ':' + req.id,
          args: {uid: u, task: first.task, d1: s.from, d2: s.to}, refs: {uid: u, req: req.id, task: first.task},
          card: {kind: 'clientDate', urgent: s.from <= addDays(R.ymd, 1), dedupe: 'clientDate:req:' + u + ':' + req.id, why: plural(plan.propose.length, 'client date falls', 'client dates fall') + ' inside the leave.',
            options: opts.concat([{label: 'Open the board', action: 'coo.open', input: {route: '#tasks'}}])}});
      }
    }
  }
};

/* J13: leave still waiting on Kaavish after a day, or starting within two: the card goes to the top */
J.J13 = async R => {
  const st = R.state;
  const open = openCards(R.ctx);
  for (const {uid, req} of pendings(st, false).concat(pendings(st, true))) {
    const old = (Number(req.at) || R.now) < R.now - DAY;
    const soon = YMD.test(req.from || '') && req.from <= addDays(R.ymd, 2);
    if (!old && !soon) continue;
    const subject = 'req:' + uid + ':' + req.id;
    const has = open.find(c => (c.refs || {}).req === req.id);
    if (has) { if (!has.urgent && !R.practice) R.cardPatch[has.id] = {urgent: true, money: has.money}; continue; }
    await act(R, {job: 'J13', code: 'leave_wait', kind: 'card', cap: 'leave', rung: lowerOf(st.rungs.leave, 'propose'), subject, args: {uid, d1: req.from, d2: req.to},
      refs: {uid, req: req.id}, apply: {action: 'coo.approve_leave', input: {uid, req: req.id, from: req.from, to: req.to, type: req.type || 'casual'}},
      card: {kind: req.type === 'wfh' ? 'wfh' : 'leave', urgent: true, label: 'Approve', dedupe: (req.type === 'wfh' ? 'wfh:' : 'leave:') + subject, expires: dayStart(req.from || R.ymd)}});
  }
};

/* J14: someone answered a bot "off today" and filed no leave */
J.J14 = async R => {
  const st = R.state;
  for (const u of nonFounders(R)) {
    const acks = pmAcks(R.ctx, u);
    const said = Object.keys(acks).some(k => k.endsWith(':' + R.ymd) && acks[k] && acks[k].how === 'leave');
    if (!said || isOut(st, u, R.ymd) || pendingOn(st, u, R.ymd, Infinity) || didToday(R, 'said_off', 'uid:' + u)) continue;
    await askAct(R, {job: 'J14', code: 'said_off', args: {uid: u}, subject: 'uid:' + u});
  }
};

/* J15: Monday outcomes. At noon an ask with up to three ideas from their open work; at three, one line to
   their manager. The person saves their own outcomes; the COO never writes plan/ */
J.J15 = async R => {
  const st = R.state;
  if (dowOf(R.ymd) !== 1 || minsOf(R.now) < (toMins(st.settings.mondayCut) || 720)) return;
  const week = isoWeekOf(R.now);
  const plans = mapOf(R.ctx, 'plan');
  const end = addDays(R.ymd, 5);
  for (const u of nonFounders(R)) {
    if (isOut(st, u, R.ymd)) continue;
    const items = ((((plans[u] || {}).weeks || {})[week]) || {}).items || [];
    if (items.length) continue;
    if (R.slot === 'r12') {
      const ideas = tasksList(st).filter(t => t.owner === u && openTask(t) && t.due && t.due <= end).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 3).map(t => String(t.title || '').slice(0, 60));
      if (!didToday(R, 'outcomes', 'uid:' + u)) await askAct(R, {job: 'J15', code: 'outcomes', args: {uid: u, list: ideas.join('; ')}, subject: 'uid:' + u});
    } else {
      const mgr = managerFrom(st.members, st.founder, u);
      if (mgr && mgr !== st.founder && !didToday(R, 'outcomes_mgr', 'uid:' + u)) await askAct(R, {job: 'J15', code: 'outcomes_mgr', rcpt: mgr, args: {uid: u, to: mgr}, subject: 'uid:' + u});
    }
  }
};

/* J16: work waiting in review for over a working day: an ask to the reviewer; over two, Kaavish hears.
   The COO never approves or sends back */
J.J16 = async R => {
  const st = R.state;
  for (const t of tasksList(st)) {
    if (t.status !== 'review' || !t.reviewAt) continue;
    const since = ymdOf(Number(t.reviewAt));
    const waited = workDaysIn(st, addDays(since, 1), R.ymd).length;
    if (waited < 1) continue;
    const rv = reviewerOf(st, t);
    const args = {uid: t.owner, to: rv, task: t.id, day: since};
    if (rv && rv !== st.founder && !didToday(R, 'review_ask', 'task:' + t.id)) await askAct(R, {job: 'J16', code: 'review_ask', rcpt: rv, cap: 'reviews', args, subject: 'task:' + t.id});
    if (waited >= 2 || rv === st.founder) {
      await act(R, {job: 'J16', code: 'review_late', kind: 'card', cap: 'reviews', rung: lowerOf(st.rungs.reviews, 'propose'), subject: 'task:' + t.id, args, refs: {task: t.id, uid: t.owner},
        card: {kind: 'info', dedupe: 'review:' + t.id + ':' + R.ymd, options: [{label: 'Open reviews', action: 'coo.open', input: {route: '#reviews'}}]}});
    }
  }
};

/* answers of "blocked" to a bot about a task, past the blocker wait: [{u, K, task, at}] */
function blockedNow(R) {
  const out = [];
  const mins = numOr(((R.ctx.settings || {}).pm || {}).blockerMins, 120);
  for (const u of nonFounders(R)) {
    const acks = pmAcks(R.ctx, u);
    for (const K of Object.keys(acks).sort()) {
      const a = acks[K];
      if (!a || a.how !== 'blocked') continue;
      const k = parseKey(K);
      if (k.rep !== u || k.ymd !== R.ymd) continue;
      const t = R.state.tasks[k.sub];
      if (!t || !openTask(t) || t.owner !== u) continue;
      if ((Number(a.at) || 0) > R.now - mins * MIN) continue;
      out.push({u, K, task: {...t, id: k.sub}, at: Number(a.at) || R.now});
    }
  }
  return out;
}
/* J17: someone blocked on a task: an ask to whoever can unblock it; Kaavish after 4 working hours */
J.J17 = async R => {
  const st = R.state;
  for (const b of blockedNow(R)) {
    const t = b.task;
    const p = t.project ? st.projects[t.project] : null;
    const who = [t.by, p && p.owner, t.sentBackBy].find(x => x && x !== b.u && active(st, x)) || st.founder;
    const args = {uid: b.u, to: who, task: t.id, at: b.at};
    if (who !== st.founder && !chases(R, who, 'waiton') && !didToday(R, 'blocked_ask', 'task:' + t.id)) await askAct(R, {job: 'J17', code: 'blocked_ask', rcpt: who, args, subject: 'task:' + t.id});
    if (who === st.founder || R.now - b.at >= 4 * HOUR) {
      await act(R, {job: 'J17', code: 'blocked_late', kind: 'card', cap: 'nudge', rung: lowerOf(st.rungs.nudge, 'propose'), subject: 'task:' + t.id, args, refs: {task: t.id, uid: b.u},
        card: {kind: 'info', dedupe: 'blocked:' + t.id + ':' + R.ymd, options: [{label: 'Open the task', action: 'coo.open', input: {route: '#tasks/' + t.id}}]}});
    }
  }
};

/* J18: Friday review prep, a draft of hit or miss per outcome with the evidence; Kaavish confirms each
   person's marks with one tap, as himself. The COO never writes review/ */
J.J18 = async R => {
  const st = R.state;
  const week = isoWeekOf(R.now);
  const mon = addDays(R.ymd, -((dowOf(R.ymd) + 6) % 7));
  const plans = mapOf(R.ctx, 'plan');
  const words = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  let n = 0;
  for (const u of nonFounders(R)) {
    const items = ((((plans[u] || {}).weeks || {})[week]) || {}).items || [];
    if (!items.length) continue;
    const done = tasksList(st).filter(t => t.owner === u && t.status === 'done' && t.doneAt && ymdOf(Number(t.doneAt)) >= mon);
    const marks = {}, evidence = [];
    for (const it of items) {
      const w = words(it.text);
      const hit = done.find(t => words(t.title).some(x => w.indexOf(x) >= 0));
      marks[it.id] = hit ? 'hit' : 'miss';
      if (hit) evidence.push({item: it.id, task: hit.id});
    }
    const r = await act(R, {job: 'J18', code: 'review_prep', kind: 'card', cap: 'reviewPrep', rung: lowerOf(st.rungs.reviewPrep, 'draft'), subject: 'review:' + u + ':' + week,
      args: {uid: u, n: 1, week}, refs: {uid: u},
      card: {kind: 'review', dedupe: 'review:' + u + ':' + week, why: plural(evidence.length, 'outcome matches', 'outcomes match') + ' shipped work.', sources: evidence.map(e => 'tasks/' + e.task),
        options: [{label: 'Confirm marks', action: 'coo.confirm_marks', input: {uid: u, week, marks}}], draft: {marks, evidence}}});
    if (r.status === 'card' || r.status === 'would') n++;
  }
  if (n) R.day.reviewPrep = {at: Date.now(), n};
};

/* J19: three long days running (over 11 hours each): one warm line, at most once a week. It never reads
   care or break */
J.J19 = async R => {
  const st = R.state;
  for (const u of nonFounders(R)) {
    const days = [];
    let d = R.ymd;
    for (let i = 0; i < 10 && days.length < 3; i++) { if (isWork(st, d)) days.push(d); d = addDays(d, -1); }
    const long = days.length === 3 && days.every(x => { const c = (st.checkin[u] || {})[x]; return c && c.in && c.out && c.out - c.in > 11 * HOUR; });
    if (!long || askedWithin(R, u, 'care', 7) || didToday(R, 'care', 'uid:' + u)) continue;
    await askAct(R, {job: 'J19', code: 'care', args: {uid: u}, subject: 'uid:' + u});
    R.day.care = (R.day.care || 0) + 1;
  }
};

/* J20: structure proposals on Monday: the leave policy, next year's holidays, reporting lines, the
   personal managers, join requests. Kaavish applies each as himself */
J.J20 = async R => {
  const st = R.state;
  const week = isoWeekOf(R.now);
  const card = (code, args, dedupe, options) => act(R, {job: 'J20', code, kind: 'card', cap: 'structure', rung: lowerOf(st.rungs.structure, 'propose'), subject: dedupe, args,
    period: week, card: {kind: 'proposal', dedupe: dedupe + ':' + week, options}});
  const per = (st.cfg.leave || {}).perType || {};
  const unset = ['casual', 'sick', 'other'].filter(k => !isSet(per[k]));
  if (unset.length) await card('setup_leave', {type: unset.length === 1 ? unset[0] : ''}, 'setup:leave', [{label: 'Open Admin', action: 'coo.open', input: {route: '#admin'}}]);
  if (R.ymd.slice(5) >= '11-01') {
    const next = String(Number(R.ymd.slice(0, 4)) + 1);
    if (!(st.holidays || []).some(h => String(h).startsWith(next))) await card('setup_holidays', {year: next}, 'setup:holidays', [{label: 'Open Admin', action: 'coo.open', input: {route: '#admin'}}]);
  }
  const loose = nonFounders(R).filter(u => !st.members[u].reportsTo && managerFrom(st.members, st.founder, u) === st.founder).length;
  if (loose) await card('setup_lines', {n: loose}, 'setup:lines', [{label: 'Open Admin', action: 'coo.open', input: {route: '#admin'}}]);
  if (!pmPolicy(R.ctx.settings).on) await card('setup_pm', {}, 'setup:pm', [{label: 'Switch them on', action: 'pm_policy', input: {on: true}}]);
  const joins = mapOf(R.ctx, 'join');
  const join = Object.keys(joins).filter(k => { const j = joins[k]; return j && (!j.status || j.status === 'pending'); }).length;
  if (join) await card('setup_join', {n: join}, 'setup:join', [{label: 'Open People', action: 'coo.open', input: {route: '#people'}}]);
};

/* J30: the load snapshot, with the one before it for the rebalance */
J.J30 = async R => {
  const st = R.state;
  const ld = load(st);
  const today = await R.io.read('coo/load-' + R.ymd);
  let prev = today && today.snap ? today.snap : null;
  if (!prev) { const y = await R.io.read('coo/load-' + addDays(R.ymd, -1)) || await R.io.read('coo/load-' + addDays(R.ymd, -2)); prev = y && y.snap ? y.snap : null; }
  R.load = ld; R.prevLoad = prev;
  const line = overLine(st, ld);
  const over = Object.keys(ld).filter(u => u !== st.founder && ld[u].score > line).length;
  if (!R.practice) { try { await R.io.setDoc('coo/load-' + R.ymd, {at: Date.now(), by: 'server', snap: ld, prev: prev || null, line}, 'coo load'); } catch (e) { /* the next round */ } }
  await act(R, {job: 'J30', code: 'load', kind: 'report', args: {n: over}});
};

/* J31: rebalance someone over the line on two snapshots running */
J.J31 = async R => {
  const st = R.state;
  if (!R.load) await J.J30(R);
  const plan = planRebalance(st, R.load, R.prevLoad, R.ymd);
  for (const mv of plan.moves) {
    if (R.out || R.stopped) return;
    const t = st.tasks[mv.task];
    const until = Date.now() + DAY;
    const args = {uid: mv.from, to: mv.to, task: mv.task, due: mv.due, newDue: mv.newDue !== mv.due ? mv.newDue : '', open: mv.open, over: mv.over, open2: mv.open2, until};
    const patch = mv.newDue !== (t.due || '') ? {owner: mv.to, due: mv.newDue} : {owner: mv.to};
    await act(R, {job: 'J31', code: 'rebalance', kind: 'move', cap: 'rebalance', subject: 'task:' + mv.task, args, refs: {uid: mv.from, to: mv.to, task: mv.task}, why: 'overload',
      target: taskTarget(mv.task), before: {owner: mv.from, due: t.due || ''}, after: {owner: mv.to, due: patch.due !== undefined ? patch.due : (t.due || '')},
      write: moveSave(R, mv.task, patch, 'overload', args), apply: {action: 'coo.move_task', input: {task: mv.task, ...patch, why: 'overload'}},
      card: {kind: 'move', label: 'Move it', dedupe: 'move:task:' + mv.task + ':' + R.ymd},
      told: [{uid: mv.to, code: 'rebalance'}, {uid: mv.from, code: 'handed_away'}], undo: {k: 'task', task: mv.task, fields: ['owner', 'due'], until}});
  }
};

/* J32: open work with no owner, or an owner who left: the project's owner, else its least loaded member */
J.J32 = async R => {
  const st = R.state;
  const ld = R.load || load(st);
  for (const t of tasksList(st)) {
    if (R.out || R.stopped) return;
    if (!openTask(t) || (t.owner && active(st, t.owner)) || !t.project) continue;
    const p = st.projects[t.project];
    if (!p || p.archived) continue;
    /* never handed to someone away today */
    const here = u => active(st, u) && !isOut(st, u, R.ymd);
    const to = here(p.owner) ? p.owner : (Array.isArray(p.members) ? p.members : []).filter(here).sort((a, b) => ((ld[a] || {}).score || 0) - ((ld[b] || {}).score || 0) || (a < b ? -1 : 1))[0];
    if (!to || !movable(st, t).ok) continue;
    const until = Date.now() + DAY;
    const args = {uid: t.owner || '', to, task: t.id, left: !!t.owner, due: t.due || '', until};
    await act(R, {job: 'J32', code: 'orphan', kind: 'move', cap: 'orphans', subject: 'task:' + t.id, args, refs: {uid: t.owner || '', to, task: t.id}, why: 'orphan',
      target: taskTarget(t.id), before: {owner: t.owner || '', due: t.due || ''}, after: {owner: to, due: t.due || ''},
      write: moveSave(R, t.id, {owner: to}, 'orphan', args), apply: {action: 'coo.move_task', input: {task: t.id, owner: to, why: 'orphan'}},
      card: {kind: 'move', label: 'Give it to them', dedupe: 'move:task:' + t.id + ':' + R.ymd},
      told: [{uid: to, code: 'orphan'}], undo: {k: 'task', task: t.id, fields: ['owner', 'due'], until}});
  }
};

/* J33: a structured "blocked" on a task: its date moves by the working days it has been blocked, once a
   week per task */
J.J33 = async R => {
  const st = R.state;
  for (const b of blockedNow(R)) {
    const t = b.task;
    if (!t.due || t.due > nextWork(st, R.ymd) || clientDated(st, t) || !movable(st, t).ok || didToday(R, 'shift_blocked', 'task:' + t.id)) continue;
    const n = Math.max(1, workDaysIn(st, ymdOf(b.at), R.ymd).length);
    const newDue = nthWork(st, t.due > R.ymd ? t.due : R.ymd, n);
    const until = Date.now() + DAY;
    const args = {uid: t.owner, task: t.id, due: newDue, due0: t.due, until};
    await act(R, {job: 'J33', code: 'shift_blocked', kind: 'shift', cap: 'shift', subject: 'task:' + t.id, args, refs: {uid: t.owner, task: t.id}, why: 'blocked',
      target: taskTarget(t.id), before: {owner: t.owner, due: t.due}, after: {owner: t.owner, due: newDue},
      write: moveSave(R, t.id, {due: newDue}, 'blocked', args), apply: {action: 'coo.move_task', input: {task: t.id, due: newDue, why: 'blocked'}},
      card: {kind: 'move', label: 'Move the date', dedupe: 'shift:task:' + t.id + ':' + R.ymd},
      told: [{uid: t.owner, code: 'shift_blocked'}], undo: {k: 'task', task: t.id, fields: ['owner', 'due'], until}});
  }
};

/* J34: internal work 2 or more working days overdue with no movement and no bot on it: an ask for a date
   (brief). When the owner answers "on it, by <date>", that date becomes the due date (watch rounds) */
J.J34 = async R => {
  const st = R.state;
  if (R.slot === 'brief') {
    for (const t of tasksList(st)) {
      if (!openTask(t) || !t.due || !active(st, t.owner) || t.owner === st.founder || clientDated(st, t)) continue;
      if (workDaysIn(st, addDays(t.due, 1), R.ymd).length < 2 || (Number(t.updated) || 0) > R.now - 2 * DAY) continue;
      if (chases(R, t.owner, 'overdue') || askedWithin(R, t.owner, 'eta_ask', 3, t.id)) continue;
      await askAct(R, {job: 'J34', code: 'eta_ask', kind: 'overdue', sub: t.id, ask: 'eta', args: {uid: t.owner, task: t.id, due0: t.due}, subject: 'task:' + t.id});
    }
    return;
  }
  const asks = cooAsks(R.ctx);
  for (const id of Object.keys(asks).sort()) {
    const a = asks[id];
    if (!a || a.withdrawn || a.code !== 'eta_ask' || !a.sub || (Number(a.at) || 0) < R.now - 3 * DAY) continue;
    const t = st.tasks[a.sub];
    if (!t || !openTask(t)) continue;
    const u = (a.to || [])[0];
    const ack = pmAcks(R.ctx, u)[pmKey(u, 'overdue', a.sub, ymdOf(Number(a.at)))];
    if (!ack || ack.how !== 'onit' || typeof ack.eta !== 'string' || !YMD.test(ack.eta) || ack.eta <= (t.due || '') || t.owner !== u) continue;
    if (!movable(st, {...t, id: a.sub}).ok || didToday(R, 'eta_shift', 'task:' + a.sub)) continue;
    const until = Date.now() + DAY;
    const args = {uid: u, task: a.sub, due: ack.eta, due0: t.due, until};
    await act(R, {job: 'J34', code: 'eta_shift', kind: 'shift', cap: 'shift', subject: 'task:' + a.sub, args, refs: {uid: u, task: a.sub}, why: 'eta',
      target: taskTarget(a.sub), before: {owner: u, due: t.due}, after: {owner: u, due: ack.eta},
      write: moveSave(R, a.sub, {due: ack.eta}, 'eta', args), apply: {action: 'coo.move_task', input: {task: a.sub, due: ack.eta, why: 'eta'}},
      card: {kind: 'move', label: 'Set the date', dedupe: 'shift:task:' + a.sub + ':' + R.ymd}, undo: {k: 'task', task: a.sub, fields: ['owner', 'due'], until}});
  }
};

/* J35: three or more internal tasks due one day for one person spread out; a date on their day off rolls
   to their next working day. Client dates are only reported */
J.J35 = async R => {
  const st = R.state;
  for (const u of nonFounders(R)) {
    const mine = tasksList(st).filter(t => t.owner === u && openTask(t) && t.due && t.due >= R.ymd);
    const count = {};
    for (const t of mine) count[t.due] = (count[t.due] || 0) + 1;
    const moved = {};
    for (const t of mine.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : weightOf(b) - weightOf(a) || (a.id < b.id ? -1 : 1)))) {
      if (R.out || R.stopped) return;
      const off = !isWork(st, t.due) || isOut(st, u, t.due);
      const pile = !off && count[t.due] >= 3 && (moved[t.due] || 0) < count[t.due] - 2 && mine.filter(x => x.due === t.due).indexOf(t) >= 2;
      if (!off && !pile) continue;
      if (clientDated(st, t)) {
        if (off) await act(R, {job: 'J35', code: 'pileup_client', kind: 'card', cap: 'shift', rung: lowerOf(st.rungs.shift, 'propose'), subject: 'task:' + t.id, args: {uid: u, task: t.id},
          refs: {uid: u, task: t.id}, card: {kind: 'clientDate', dedupe: 'clientDate:task:' + t.id + ':' + R.ymd, options: [{label: 'Open the task', action: 'coo.open', input: {route: '#tasks/' + t.id}}]}});
        continue;
      }
      if (!movable(st, t).ok) continue;
      let newDue = nextWork(st, t.due, u);
      while (pile && (count[newDue] || 0) >= 2) newDue = nextWork(st, newDue, u);
      const until = Date.now() + DAY;
      const args = {uid: u, task: t.id, due: newDue, due0: t.due, day: t.due, n: count[t.due], until};
      const res = await act(R, {job: 'J35', code: off ? 'offday' : 'pileup', kind: 'shift', cap: 'shift', subject: 'task:' + t.id, args, refs: {uid: u, task: t.id}, why: 'pileup',
        target: taskTarget(t.id), before: {owner: u, due: t.due}, after: {owner: u, due: newDue},
        write: moveSave(R, t.id, {due: newDue}, 'pileup', args), apply: {action: 'coo.move_task', input: {task: t.id, due: newDue, why: 'pileup'}},
        card: {kind: 'move', label: 'Move the date', dedupe: 'shift:task:' + t.id + ':' + R.ymd},
        told: [{uid: u, code: off ? 'offday' : 'pileup'}], undo: {k: 'task', task: t.id, fields: ['owner', 'due'], until}});
      if (res.status === 'done' || res.status === 'would') { moved[t.due] = (moved[t.due] || 0) + 1; count[newDue] = (count[newDue] || 0) + 1; }
    }
  }
};

/* J36: a client date within two working days whose owner is stretched, away, blocked or not started:
   options for Kaavish, and a drafted ask to the client */
J.J36 = async R => {
  const st = R.state;
  const ld = R.load || load(st);
  const line = overLine(st, ld);
  const end = nthWork(st, R.ymd, 2);
  const blocked = new Set(blockedNow(R).map(b => b.task.id));
  for (const t of tasksList(st)) {
    if (!openTask(t) || !t.due || t.due < R.ymd || t.due > end || !clientDated(st, t) || !t.owner) continue;
    const away = workDaysIn(st, R.ymd, t.due).some(d => isOut(st, t.owner, d));
    const state = away ? 'away' : blocked.has(t.id) ? 'blocked' : (ld[t.owner] && ld[t.owner].score > line) ? 'stretched' : t.status === 'todo' || !t.status ? 'not started' : '';
    if (!state) continue;
    const pick = shortlist(st, t, ld, R.ymd)[0];
    const p = t.project ? st.projects[t.project] : null;
    const helper = pick && p && (p.members || []).indexOf(pick) < 0 ? pick : null;
    const opts = [];
    if (pick) opts.push({label: 'Give it to ' + nameOf(R.ctx, pick), action: 'coo.move_task', input: {task: t.id, owner: pick, why: 'client'}});
    if (helper) opts.push({label: 'Add ' + nameOf(R.ctx, helper) + ' to the project', action: 'add_project_member', input: {project: t.project, person: nameOf(R.ctx, helper)}});
    opts.push({label: 'Ask the client for 2 days', action: 'coo.mail', input: {}});
    await act(R, {job: 'J36', code: 'client_risk', kind: 'card', cap: 'clientDates', rung: lowerOf(st.rungs.clientDates, 'propose'), subject: 'task:' + t.id,
      args: {uid: t.owner, task: t.id, due: t.due, state}, refs: {uid: t.owner, task: t.id, client: t.client || (p && p.client) || ''},
      card: {kind: 'clientDate', urgent: true, dedupe: 'clientDate:task:' + t.id + ':' + R.ymd, options: opts,
        draft: {to: '', cc: '', subject: 'A short extension on ' + String(t.title || 'the work').slice(0, 80),
          text: 'Hi,\n\nWe want to get ' + String(t.title || 'this').slice(0, 80) + ' right, and two more working days would let us do that. Could we move it to ' + dayTxt(nthWork(st, t.due, 2)) + '?\n\nThank you,\nKaavish'}}});
  }
};

/* J37: tomorrow's work, one line per owner */
J.J37 = async R => {
  const st = R.state;
  const tmr = nextWork(st, R.ymd);
  const by = {};
  for (const t of tasksList(st)) if (openTask(t) && t.due === tmr && t.owner) (by[t.owner] = by[t.owner] || []).push(t);
  for (const u of Object.keys(by).sort()) {
    if (u === st.founder || !active(st, u) || isOut(st, u, tmr) || isOut(st, u, R.ymd) || didToday(R, 'due_tomorrow', 'uid:' + u)) continue;
    const list = by[u].slice(0, 3).map(t => String(t.title || 'a task').slice(0, 60)).join('; ') + (by[u].length > 3 ? ', and ' + (by[u].length - 3) + ' more' : '');
    await askAct(R, {job: 'J37', code: 'due_tomorrow', args: {uid: u, list, day: tmr}, subject: 'uid:' + u});
  }
};

/* J38: project health. Behind its own clock, a project is raised to at risk or off track (never
   lowered), with an update, and its owner is told */
J.J38 = async R => {
  const st = R.state;
  for (const pid of Object.keys(st.projects || {}).sort()) {
    if (R.out || R.stopped) return;
    const p = st.projects[pid];
    if (!p || p.archived || !(p.status === 'on' || p.status === 'risk' || !p.status) || !YMD.test(p.start || '') || !YMD.test(p.due || '') || p.due <= p.start) continue;
    const tasks = tasksList(st).filter(t => t.project === pid);
    if (!tasks.length) continue;
    const done = tasks.filter(t => t.status === 'done').length;
    const over = tasks.filter(t => openTask(t) && t.due && t.due < R.ymd).length;
    const pct = Math.round(100 * done / tasks.length);
    const elapsed = Math.max(0, Math.min(100, Math.round(100 * daysBetween(p.start, R.ymd) / daysBetween(p.start, p.due))));
    const gap = elapsed - pct;
    const to = (p.due < R.ymd && done < tasks.length) || gap >= 50 ? 'off' : gap >= 25 && over > 0 ? 'risk' : '';
    if (!to || RAISE[to] <= (RAISE[p.status || 'on'] || 0)) continue;
    const args = {project: pid, status: to, pct, elapsed, over, uid: p.owner};
    const text = copy('project_risk', args, 'dm', R.ctx).line;
    await act(R, {job: 'J38', code: 'project_risk', kind: 'project', cap: 'projects', subject: 'project:' + pid, args, refs: {project: pid, uid: p.owner}, why: '',
      target: {path: 'projects/' + pid, pick: {status: [['status'], 'on']}}, before: {status: p.status || 'on'}, after: {status: to},
      write: row => cooWrite(R, 'projects/' + pid, {updates: {[row.id]: {by: UID, status: to, text, at: Date.now()}}, status: to, updated: Date.now()}, 'coo J38 ' + row.id),
      apply: {action: 'coo.raise_project', input: {project: pid, status: to}}, card: {kind: 'proposal', label: 'Raise it', dedupe: 'project:' + pid + ':' + R.ymd},
      told: p.owner && p.owner !== st.founder ? [{uid: p.owner, code: 'project_risk'}] : [], undo: {k: 'project', project: pid, prev: p.status || 'on', until: Date.now() + DAY}});
  }
};

/* J40: pitches with no next step, an overdue one, or stuck in a stage: an ask to the owner; Kaavish hears at
   2 working days or twice the stage limit. The COO never moves nextDate */
J.J40 = async R => {
  const st = R.state;
  const stuckDays = st.cfg.stuck || {};
  for (const id of Object.keys(st.pitches || {}).sort()) {
    const p = st.pitches[id];
    if (!p || p.archived || !p.owner || ['won', 'lost'].indexOf(p.stage) >= 0) continue;
    const since = ymdOf(Number(p.stageAt || p.created || R.now));
    const inStage = daysBetween(since, R.ymd);
    const late = YMD.test(p.nextDate || '') && p.nextDate < R.ymd ? workDaysIn(st, addDays(p.nextDate, 1), R.ymd).length : 0;
    const none = !p.next && !p.nextDate && inStage >= 2;
    const lim = numOr(stuckDays[p.stage], 0);
    const stuckNow = lim > 0 && inStage > lim;
    if (!late && !none && !stuckNow) continue;
    const args = {uid: p.owner, pitch: id, n: late || inStage};
    if (p.owner !== st.founder && !didToday(R, 'pitch_ask', 'pitch:' + id) && !askedWithin(R, p.owner, 'pitch_ask', 2, undefined)) await askAct(R, {job: 'J40', code: 'pitch_ask', args, subject: 'pitch:' + id, refs: {pitch: id}});
    if (late >= 2 || (lim > 0 && inStage >= 2 * lim) || p.owner === st.founder) {
      await act(R, {job: 'J40', code: 'pitch_late', kind: 'card', cap: 'nudge', rung: lowerOf(st.rungs.nudge, 'propose'), subject: 'pitch:' + id, args, refs: {pitch: id, uid: p.owner},
        period: isoWeekOf(R.now), card: {kind: 'info', dedupe: 'pitch:' + id + ':' + isoWeekOf(R.now), options: [{label: 'Open the pitch', action: 'coo.open', input: {route: '#pitches/' + id}}]}});
    }
  }
};

/* a Base contact's address and first name, from a structured id only (never from free text) */
const contactOf = (R, id) => (id && R.contacts && R.contacts[id]) || null;
const contactMail = (R, id) => { const c = contactOf(R, id); return c ? String(c.mail || c['email'] || '').trim() : ''; };
const firstOf = (R, id) => { const c = contactOf(R, id); return c ? String(c.first || c.name || '').split(' ')[0] : ''; };
/* J41: follow-up drafts. A proposal 5 working days without a reply, and a live client with no work touch in
   21 days. One per client a week, drafts only: nothing leaves until Kaavish taps Send. The model may reword a
   draft afterwards (the desk's drafts step); the template stands when it cannot */
J.J41 = async R => {
  const st = R.state;
  const bucket = Math.floor(daysBetween('2026-01-05', R.ymd) / 7);
  const want = [];
  for (const id of Object.keys(st.pitches || {})) { const p = st.pitches[id]; if (p && p.contact) want.push(p.contact); }
  for (const id of Object.keys(st.clients || {})) { const c = st.clients[id]; if (c && c.contact) want.push(c.contact); }
  R.contacts = want.length ? await R.io.contacts(want) : {};
  /* one draft a client a week, whether its pitch or the client itself is the reason */
  const recent = k => k && k.kind === 'client_mail' && k.refs && k.refs.client && (Number(k.at) || 0) > R.now - 7 * DAY;
  const drafted = new Set(Object.values((((R.ctx.coo || {}).dec) || {}).items || {}).filter(recent).map(k => k.refs.client));
  for (const id of Object.keys(st.pitches || {}).sort()) {
    const p = st.pitches[id];
    if (!p || p.archived || p.stage !== 'proposal' || (p.client && drafted.has(p.client))) continue;
    const since = ymdOf(Number(p.stageAt || p.created || R.now));
    const n = workDaysIn(st, addDays(since, 1), R.ymd).length;
    if (n < 5) continue;
    const to = contactMail(R, p.contact);
    const hi = firstOf(R, p.contact);
    if (p.client) drafted.add(p.client);
    await act(R, {job: 'J41', code: 'client_mail', kind: 'card', cap: 'clientMail', rung: lowerOf(st.rungs.clientMail, 'draft'), subject: 'pitch:' + id, args: {pitch: id, n},
      period: 'w' + bucket, refs: {pitch: id, client: p.client || ''},
      card: {kind: 'client_mail', dedupe: 'client_mail:pitch:' + id + ':' + bucket, why: to ? 'Sent ' + dayTxt(since) + ', no reply in ' + plural(n, 'working day', 'working days') + '.' : 'Add the recipient before you send.',
        sources: ['pitches/' + id], draft: {to, cc: '', subject: 'Following up on our proposal',
          text: 'Hi' + (hi ? ' ' + hi : '') + ',\n\nFollowing up on the proposal we sent on ' + dayTxt(since) + '. Happy to walk you through it or adjust anything. Would a short call this week work?\n\nKaavish', by: 'template'}}});
  }
  const tasks = tasksList(st);
  for (const id of Object.keys(st.clients || {}).sort()) {
    const cl = st.clients[id];
    if (!cl || cl.archived || drafted.has(id) || (cl.status && cl.status !== 'live' && cl.status !== 'active')) continue;
    let touch = 0;
    for (const t of tasks) if (t.client === id) touch = Math.max(touch, Number(t.updated) || 0, Number(t.created) || 0, Number(t.doneAt) || 0);
    for (const pid of Object.keys(st.projects || {})) { const p = st.projects[pid]; if (p && p.client === id) for (const u of Object.values(p.updates || {})) touch = Math.max(touch, Number(u && u.at) || 0); }
    if (!touch || touch > R.now - 21 * DAY) continue;
    const to = contactMail(R, cl.contact);
    const hi = firstOf(R, cl.contact);
    await act(R, {job: 'J41', code: 'client_mail', kind: 'card', cap: 'clientMail', rung: lowerOf(st.rungs.clientMail, 'draft'), subject: 'client:' + id, args: {client: id},
      period: 'w' + bucket, refs: {client: id},
      card: {kind: 'client_mail', dedupe: 'client_mail:client:' + id + ':' + bucket, why: to ? 'No work touch since ' + dayTxt(ymdOf(touch)) + '.' : 'Add the recipient before you send.',
        sources: ['clients/' + id], draft: {to, cc: '', subject: 'Checking in',
          text: 'Hi' + (hi ? ' ' + hi : '') + ',\n\nIt has been a few weeks, so a quick hello from Mask360. Is there anything on your side we can help with this month?\n\nKaavish', by: 'template'}}});
  }
  if (R.drafts.length && !R.practice) await R.io.redraft(R).catch(() => {});
};

/* J42: tomorrow's meetings with people from a client, a pitch or an org: a short confirm note, drafted. The
   team site reads Kaavish's calendar through his Google sign-in; nothing is sent from here */
J.J42 = async R => {
  const tmr = nextWork(R.state, R.ymd);
  const domains = new Set();
  const dom = s => { const m = /@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : ''; };
  const web = s => { const m = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : ''; };
  for (const x of Object.values(mapOf(R.ctx, 'clients'))) if (x) { const d = web(x.website || x.domain || ''); if (d) domains.add(d); }
  const want = Object.values(R.state.pitches || {}).map(p => p && p.contact).filter(Boolean);
  R.contacts = want.length ? await R.io.contacts(want) : {};
  for (const p of Object.values(R.state.pitches || {})) { const d = dom(contactMail(R, p && p.contact)); if (d) domains.add(d); }
  if (!domains.size) return;
  const events = await R.io.events(R.state.founder, dayStart(tmr), dayStart(tmr) + DAY).catch(() => null);
  if (!events) return;
  for (const e of events.slice(0, 10)) {
    const who = (e.attendees || []).map(a => String((a && a['email']) || '')).filter(a => domains.has(dom(a)));
    if (!who.length) continue;
    const what = String(e.summary || 'our meeting').slice(0, 80);
    const at = (e.start && (e.start.dateTime || e.start.date)) || '';
    await act(R, {job: 'J42', code: 'meeting_mail', kind: 'card', cap: 'meetingMail', rung: lowerOf(R.state.rungs.meetingMail, 'draft'), subject: 'event:' + (e.id || what), args: {what},
      refs: {event: String(e.id || '')},
      card: {kind: 'meeting_mail', dedupe: 'meeting_mail:' + (e.id || what) + ':' + tmr, why: 'Tomorrow' + (at.length > 10 ? ' at ' + at.slice(11, 16) : '') + '.',
        draft: {to: who.join(', '), cc: '', subject: 'Confirming tomorrow: ' + what, text: 'Hi all,\n\nLooking forward to ' + what + ' tomorrow. A quick note to confirm we are set. Let me know if anything changes.\n\nKaavish', start: at, event: String(e.id || '')}}});
  }
};

/* J43: overdue invoice reminders on the books chase steps, for the owner only, drafted with the books' own
   reminder text (no model). They wait in books/cooq for a tap */
J.J43 = async R => {
  const b = await R.io.books().catch(() => null);
  if (!b) return;
  const steps = String(((b.settings || {}).chase || {}).days || '3,7,14').split(',').map(Number).filter(n => n > 0).sort((x, y) => x - y);
  for (const inv of b.invoices) {
    const s = b.status(inv, R.ymd);
    if ((s !== 'overdue' && s !== 'part') || !inv.due || inv.due >= R.ymd) continue;
    const late = daysBetween(inv.due, R.ymd);
    const last = steps[steps.length - 1] || 14;
    const due = steps.filter(d => late >= d).length + (late > last ? Math.floor((late - last) / 14) : 0);
    const chased = (inv.chased || []).length;
    if (!due || chased >= due) continue;
    const mail = b.mail(inv, R.ymd);
    const to = String(((b.clients[inv.client] || {}).contactEmail) || (inv.billTo || {}).contactEmail || '').trim();
    await act(R, {job: 'J43', code: 'invoice', kind: 'card', cap: 'invoiceMail', rung: lowerOf(R.state.rungs.invoiceMail, 'draft'), subject: 'invoice:' + inv.fy + ':' + inv.id,
      args: {no: String(inv.no || '').slice(0, 40)}, refs: {invoice: inv.id, client: inv.client || ''}, period: 'step' + due,
      card: {kind: 'invoice_reminder', money: true, dedupe: 'invoice:' + inv.fy + ':' + inv.id + ':' + due, why: plural(late, 'day', 'days') + ' past due, ' + plural(chased, 'reminder', 'reminders') + ' so far.',
        sources: ['invoices/' + inv.fy], draft: {to, cc: String(((b.settings || {}).chase || {}).cc || ''), subject: mail.subject, text: mail.text, fy: inv.fy, invoice: inv.id}}});
  }
};

/* J51: the self audit at the close, every zero-check over today's ledger */
J.J51 = async R => {
  const st = R.state;
  const rows = st.acts.filter(r => r && r.status !== 'would');
  const done = rows.filter(r => r.status === 'done');
  const u = used(st);
  const L = k => limitOf(st, k, 0);
  const twice = {};
  for (const r of done) if (r.kind === 'move' || r.kind === 'shift' || r.kind === 'leave') { const k = r.code + '|' + r.subject; twice[k] = (twice[k] || 0) + 1; }
  const checks = {
    hours: done.filter(r => minsOf(Number(r.at)) < 540 || minsOf(Number(r.at)) > 1260 + 179).length,
    caps: ['move', 'shift', 'leave', 'ask', 'draft'].filter(k => u[k] > L(DAY_LIMIT[k])).length + (u.acts > L('actsPerDay') ? 1 : 0),
    onLeave: done.filter(r => { const x = r.kind === 'move' ? (r.refs || {}).to : r.kind === 'ask' ? (r.refs || {}).uid : ''; return !!x && isOut(st, x, R.ymd); }).length,
    client: done.filter(r => (r.kind === 'move' || r.kind === 'shift') && r.refs && r.refs.task && clientDated(st, st.tasks[r.refs.task])).length,
    double: Object.values(twice).filter(n => n > 1).length,
    refused: rows.filter(r => r.status === 'refused').length,
    focus: 0, mail: 0
  };
  const n = Object.values(checks).reduce((a, b) => a + b, 0);
  const audit = {at: Date.now(), checks, n};
  R.day.audit = audit;
  R.patch.audit = audit;
  await act(R, {job: 'J51', code: 'audit', kind: 'report', args: {n}});
  if (n) infoCard(R, 'audit', {n}, 'info:audit:' + R.ymd, true);
};

/* which jobs a slot runs, in order: the page's list, plus the away mail at 12:30 and 17:30 (team site only) */
function jobsFor(R) {
  const s = R.slot, dow = dowOf(R.ymd);
  if (!R.work) return s === 'open' ? ['J01'] : s === 'close' ? ['J05'] : [];
  if (s === 'open') return ['J01'];
  if (s === 'brief') return ['J30', 'J12', 'J34', 'J32', 'J35', 'J40', 'J36'].concat(dow === 1 ? ['J20'] : []).concat(['J02']);
  if (/^roll\d{4}b?$/.test(s)) return ['J03'];
  if (/^w\d{4}$/.test(s)) return ['J10', 'J11', 'J12', 'J17', 'J33', 'J34'];
  if (s === 'r10') return ['J13'];
  if (s === 'r11') return ['J16'];
  if (s === 'r12') return ['J41', 'J43', 'J14', 'J38'].concat(dow === 1 ? ['J15'] : []);
  if (s === 'm1230') return ['J07'];
  if (s === 'r15') return ['J30', 'J31', 'J14', 'J36'].concat(dow === 1 ? ['J15'] : []);
  if (s === 'r16') return ['J16', 'J42'].concat(dow === 5 ? ['J18'] : []);
  if (s === 'r1730') return ['J37', 'J13', 'J07'];
  if (s === 'eod') return ['J04'];
  if (s === 'close') return ['J19', 'J51', 'J05'];
  if (s === 'memo') return ['J06'];
  return [];
}

/* J50: the live feed. coo/now for the founder, office/live for everyone (team-safe: no uids, names, counts
   of people, reasons or money). Quiet writes: no version, no log line */
async function pub(R, phase) {
  const now = Date.now();
  const last = R.rows.filter(r => r.status !== 'running').slice(-1)[0] || null;
  const job = (last && last.job) || R.job || 'J50';
  const st = phase === 'end' ? (R.stopped ? 'stuck' : R.practice ? 'practice' : R.slot === 'close' ? 'closed' : 'idle') : 'working';
  const next = slotsDue(R.state.slots, now, {}).next || null;
  const prev = (R.ctx.coo && R.ctx.coo.now) || {};
  const recent = R.rows.filter(r => r.status !== 'running').map(r => ({id: r.id, at: r.at, job: r.job, code: r.code, status: r.status}))
    .concat((prev.recent || []).filter(x => x && !R.rows.some(r => r.id === x.id))).sort((a, b) => b.at - a.at).slice(0, 20);
  const station = (JOBS[job] || JOBS.J50).station;
  const nowDoc = {state: st, job, code: last ? last.code : '', station, args: {n: R.rows.length}, actId: last ? last.id : '', at: now,
    pass: {at: now, slot: R.slot, ms: now - R.t0, by: 'server', build: R.io.build}, next, recent, err: R.stopped ? {code: 'refused', at: now} : null};
  const live = {v: 1, state: st, job, station, at: now, next, pass: {at: now, by: 'server'}, seq: now};
  try { await Promise.all([R.io.quiet('coo/now', plain(nowDoc)), R.io.quiet('office/live', plain(live))]); } catch (e) { /* the next round */ }
  R.ctx.coo.now = nowDoc;
}

/* the end of a run: the told card, the cards, its state, the day's report, the feed */
async function finish(R) {
  const c = R.ctx;
  if (R.told.length && !R.practice) {
    const ids = R.told.map(r => r.id);
    const first = R.told[0];
    const t = R.told.length === 1 ? copy(first.code, first.args, 'founder', c).line : 'I made ' + plural(R.told.length, 'change', 'changes') + ' this round. Each one can be undone.';
    addCard(R, {id: newId(), kind: 'told', rung: 'tell', title: t, why: R.told.length === 1 ? copy(first.code, {...first.args, why: first.why && first.why.code}, 'founder', c).why : '',
      recommend: '', checks: [], options: [{label: 'Got it', action: 'coo.ack', input: {}}], payload: {action: 'coo.ack', input: {}, draft: null}, sources: [],
      refs: {actIds: ids}, code: R.told.length === 1 ? first.code : 'told', args: R.told.length === 1 ? first.args : {n: R.told.length}, urgent: false,
      dedupe: 'told:' + R.slot + ':' + R.ymd, by: UID, at: Date.now(), expires: Date.now() + DAY, status: 'open', money: false});
  }
  await flush(R);
  const items = {}, money = {};
  for (const k of R.cards) (k.money ? money : items)[k.id] = plain(k);
  for (const id of Object.keys(R.cardPatch)) { const p = R.cardPatch[id]; const {money: m, ...rest} = p; (m ? money : items)[id] = rest; }
  try {
    if (Object.keys(items).length) await R.io.mergeDoc('coo/dec', {items}, 'coo cards ' + R.slot);
    if (Object.keys(money).length) await R.io.mergeDoc('books/cooq', {items: money}, 'coo cards ' + R.slot);
  } catch (e) { /* the cards come again next round: their dedupe keys hold */ }
  const patch = plain(R.patch);
  delete patch.stuck;
  try {
    if (Object.keys(patch).length) await R.io.mergeDoc('coo/state', patch, 'coo state');
    if (Object.keys(R.day).length) await R.io.mergeDoc('coo/day-' + R.ymd, plain(R.day), 'coo day');
  } catch (e) { /* the next round */ }
  await pub(R, 'end');
}

/* one slot, from its cursor to the end or the time budget */
async function runSlot(ctx, io, slot, o) {
  const R = newRun(ctx, io, slot, o);
  const jobs = jobsFor(R);
  await pub(R, 'start');
  let i = Math.max(0, Math.min(jobs.length, Number(o && o.cursor) || 0));
  for (; i < jobs.length; i++) {
    if (R.stopped || R.out || R.halt) break;
    if (io.late()) { R.out = true; break; }
    const j = jobs[i];
    R.job = j;
    try { await J[j](R); } catch (e) { R.fails[j] = (R.fails[j] || 0) + 1; R.day.errors = (R.day.errors || []).concat([{job: j, at: Date.now(), msg: String((e && e.message) || e).slice(0, 160)}]).slice(-10); }
    /* a job the budget cut short runs again from its start next tick; the act keys skip what it already did */
    if (R.out) break;
  }
  await finish(R);
  return {slot, acts: R.rows.length, ms: Date.now() - R.t0, cursor: i, out: R.out, stopped: R.stopped, practice: R.practice};
}

/* ---------- the desk: the pass on the team site, and its two actions ---------- */
export function cooDesk(h) {
  const {store, getJ, putJ, docKey, listAll, readColl, inventory, ownerUid, appSettings, writeAs, writeQuiet, sendMail, mailOn, aiKey, gapi,
    log, levelOf, LEVEL, HttpError, models, call, books, stampKey} = h;
  const env = h.env || {};
  /* the pause between writing a claim and reading it back, so a second instance's claim made at the same moment
     lands first and only one of them still sees its own id */
  const SETTLE = env.COO_SETTLE_MS != null ? Number(env.COO_SETTLE_MS) : 400;
  const START_MS = 8000, STOP_MS = 22000, LEASE_MS = 45000, BEAT_STALE = 20 * MIN, LOOK_MS = 60000;
  const AI_MS = 14000, MAIL_MS = 8000, GOOGLE_MS = 8000;
  const build = String(env.BUILD || env.M360_BUILD || '');
  let lookAt = 0, busy = false;
  /* after a beat that found nothing due, more ticks on this instance answer from memory until the next slot or
     for a minute, whichever is first, so a flood of forged ticks costs the store nothing */
  let idle = null;
  const cache = {};
  const read = path => getJ(docKey(path)).catch(() => null);
  const doFetch = env.fetch || fetch;
  /* any outgoing call gets its own deadline */
  const timed = async (ms, fn) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try { return await fn(ctl.signal); } finally { clearTimeout(timer); }
  };

  /* collections, read through the store's per-collection markers (x/v/<coll>): unchanged since the last pass on
     this instance, the copy in memory serves */
  async function colls(names) {
    const marks = await Promise.all(names.map(n => getJ('x/v/' + n).catch(() => null)));
    const stale = names.filter((n, i) => !cache[n] || !marks[i] || cache[n].v !== marks[i].v);
    if (stale.length) {
      const inv = inventory ? await inventory() : {};
      await Promise.all(stale.map(async n => {
        const docs = await readColl(n, inv[n] || {});
        cache[n] = {v: (marks[names.indexOf(n)] || {}).v || null, docs};
      }));
    }
    const out = {};
    for (const n of names) out[n] = {map: cache[n].docs};
    return out;
  }
  async function founderOf(team) {
    const members = (team && team.members) || {};
    if (team && team.owner && members[team.owner]) return team.owner;
    const fs = Object.keys(members).filter(k => members[k].role === 'founder' && members[k].active !== false)
      .sort((a, b) => String(members[a].empId || '').localeCompare(String(members[b].empId || '')));
    return fs[0] || (await ownerUid()) || null;
  }
  /* the server's ctx, the page's shape: everything the planner and the jobs read */
  async function loadCtx(settings, now) {
    const team = (await read('roster/team')) || {};
    const members = team.members || {};
    const founderUid = await founderOf(team);
    const ymd = ymdOf(now);
    const [coll, state, dec, cnow, L0, L1, L1b] = await Promise.all([
      colls(['tasks', 'projects', 'pitches', 'clients', 'leave', 'leavedec', 'checkin', 'eod', 'me', 'plan', 'join', 'books']),
      read('coo/state'), read('coo/dec'), read('coo/now'), read('coo/L-' + ymd), read('coo/L-' + addDays(ymd, -1)), read('coo/L-' + ymd + '-2')]);
    const names = {};
    await Promise.all(Object.keys(members).map(async u => { const p = await getJ('p/' + u).catch(() => null); names[u] = String((p && p.name) || '').trim().split(/\s+/)[0] || ''; }));
    const today = L0 || L1b ? {acts: {...((L0 || {}).acts || {}), ...((L1b || {}).acts || {})}} : null;
    return {settings, members, founderUid, isFounder: true, isOwner: true, names, coll,
      coo: {state: state || {}, dec: dec || {items: {}}, now: cnow || {}, L: {[ymd]: today, [addDays(ymd, -1)]: L1}}};
  }

  /* the store, for one pass: reads, the bot's writes, the act keys and the budget */
  function ioFor(t0, site, pass) {
    const io = {
      build, site,
      late: () => Date.now() - t0 > STOP_MS,
      async mandate() { const settings = (await appSettings()) || {}; return {settings, st: status({settings, coo: {state: {}}}, Date.now(), env)}; },
      read,
      write: (path, doc, note) => writeAs(UID, path, doc, note),
      quiet: (path, doc) => writeQuiet(path, doc),
      async mergeDoc(path, fields, note) {
        const cur = await read(path);
        guard(path, fields, cur, null);
        await writeAs(UID, path, merge(cur || {}, fields), note);
      },
      async setDoc(path, doc, note) { guard(path, doc, null, null); await writeAs(UID, path, doc, note); },
      /* the day's ledger; past 200 KB new rows go to coo/L-<ymd>-2 and a row already in the first stays there */
      async ledger(ymd, acts) {
        const path = 'coo/L-' + ymd;
        const cur = (await read(path)) || {acts: {}};
        const big = JSON.stringify(cur).length > 200000;
        const here = {}, over = {};
        for (const id of Object.keys(acts)) ((!big || (cur.acts || {})[id]) ? here : over)[id] = acts[id];
        if (Object.keys(here).length) await writeAs(UID, path, merge(cur, {acts: here}), 'coo ledger');
        if (Object.keys(over).length) { const c2 = (await read(path + '-2')) || {acts: {}}; await writeAs(UID, path + '-2', merge(c2, {acts: over}), 'coo ledger'); }
      },
      async claimAct(ymd, key, row) {
        const k = 'x/coo/acts/' + ymd + '/' + key;
        if (await getJ(k).catch(() => null)) return false;
        await putJ(k, {id: row.id, at: Date.now(), job: row.job});
        return true;
      },
      releaseAct: async (ymd, key) => { if (key) await store.delete('x/coo/acts/' + ymd + '/' + key).catch(() => {}); },
      async prune(ymd) {
        const cutoff = addDays(ymd, -90), keys = addDays(ymd, -14);
        for (const b of await listAll(docKey('coo/x').slice(0, -1))) {
          const m = /^d\/coo~(?:L|load|day)-(\d{4}-\d{2}-\d{2})/.exec(b.key);
          if (!m || m[1] >= cutoff) continue;
          await store.delete(b.key).catch(() => {});
          if (stampKey) await stampKey(b.key, null).catch(() => {});
        }
        for (const b of await listAll('x/coo/')) {
          const m = /^x\/coo\/(?:acts\/|mail\/)?(\d{4}-\d{2}-\d{2})\//.exec(b.key);
          if (m && m[1] < keys) await store.delete(b.key).catch(() => {});
        }
      },
      /* Base contacts by id, for a draft's recipient (structured contacts only) */
      async contacts(ids) {
        const want = new Set(ids);
        const out = {};
        const pages = (await colls(['contacts'])).contacts.map;
        for (const p of Object.keys(pages)) {
          const rows = (pages[p] && pages[p].rows) || {};
          for (const id of Object.keys(rows)) { const r = rows[id]; const rid = (r && r.id) || id; if (r && !r.archived && want.has(rid)) out[rid] = r; }
        }
        return out;
      },
      /* Kaavish's calendar between two moments, through his own Google sign-in */
      async events(uid, from, to) {
        if (!gapi || !uid || !(await getJ('x/g/' + uid).catch(() => null))) return null;
        const q = new URLSearchParams({timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '20'}).toString();
        const r = await timed(GOOGLE_MS, signal => gapi(uid, 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + q, {signal}));
        return ((r && r.items) || []).filter(e => e && e.status !== 'cancelled');
      },
      /* the owner's books, read for the reminder drafts */
      async books() {
        if (!books || !(await ownerUid())) return null;
        const [s, cl] = await Promise.all([read('books/settings'), read('books/clients')]);
        const prefix = docKey('invoices/x').slice(0, -1);
        const invoices = [];
        for (const b of await listAll(prefix)) {
          const fy = String(b.key).slice(prefix.length);
          if (!/^\d{4}-\d{2}$/.test(fy)) continue;
          const d = await getJ(b.key).catch(() => null);
          for (const id of Object.keys((d && d.rows) || {})) if (d.rows[id]) invoices.push({...d.rows[id], id, fy});
        }
        return {settings: books.settingsOf(s), clients: (cl && cl.map) || {}, invoices, status: books.statusOf, mail: (inv, today) => books.reminderMail(s, inv, today)};
      },
      /* one model turn, the only one this pass makes, counted against the COO's own day (n/ai/<ymd>/u_m360coo) */
      async ai(R, system, text, tier, max) {
        if (pass.ai) return null;
        const key = aiKey ? await aiKey() : null;
        if (!key || !models) return null;
        const k = 'n/ai/' + R.ymd + '/' + UID;
        const n = Number(((await getJ(k).catch(() => null)) || {}).n) || 0;
        if (n >= limitOf(R.state, 'aiPerDay', 40)) return null;
        pass.ai = true;
        await putJ(k, {n: n + 1, at: Date.now()});
        R.patch.ai = {[R.ymd]: n + 1};
        try {
          const r = await timed(AI_MS, signal => doFetch('https://api.anthropic.com/v1/messages', {method: 'POST', signal,
            headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
            body: JSON.stringify({model: models[tier] || models.quick, max_tokens: max || 1200, system, messages: [{role: 'user', content: text}]})}));
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return null;
          return (j.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('\n');
        } catch (e) { return null; }
      },
      /* the drafts step: up to five drafts reworded in one call, JSON out; a line that fails the house rules
         keeps the template */
      async redraft(R) {
        const list = R.drafts.filter(k => k.payload && k.payload.draft && k.kind === 'client_mail').slice(0, 5);
        if (!list.length) return;
        const ask = list.map(k => ({id: k.id, subject: k.payload.draft.subject, facts: k.why, template: k.payload.draft.text}));
        const out = await io.ai(R, DRAFT_SYSTEM, 'DRAFTS:\n' + JSON.stringify(ask), 'quick', 1500);
        const m = /\{[\s\S]*\}/.exec(String(out || ''));
        let got = null;
        try { got = m ? JSON.parse(m[0]) : null; } catch (e) { got = null; }
        for (const d of (got && Array.isArray(got.drafts) ? got.drafts : [])) {
          const k = list.find(x => x.id === d.id);
          const text = String((d && d.text) || '').trim().slice(0, 2000);
          if (!k || !lint(text).ok || /@|https?:/i.test(text)) continue;
          k.payload.draft = {...k.payload.draft, text, by: 'ai'};
        }
      },
      async memoProse(R, numbers) {
        const out = await io.ai(R, MEMO_SYSTEM, 'NUMBERS:\n' + JSON.stringify(numbers), 'default', 400);
        const s = String(out || '').replace(/\s+/g, ' ').trim().slice(0, 400);
        return s && lint(s).ok ? s : null;
      },
      /* one mail to Kaavish: the away mail (only when he is away from m360) or the close (by his digest setting).
         At most limits.foundMailsPerDay a day, each claimed first so two instances never send twice */
      async founderMail(R, slot, line, n, awayOnly) {
        const c = R.cfg;
        const how = (c.digest || {}).mail || 'away';
        if (how === 'off' || (awayOnly && !n)) return false;
        if (!(await mailOn())) return false;
        const owner = await ownerUid();
        const p = owner ? await getJ('p/' + owner).catch(() => null) : null;
        if (!p || !p.email) return false;
        if ((awayOnly || how === 'away') && !(await away(R, owner))) return false;
        const day = 'x/coo/mail/' + R.ymd + '/';
        let sent = 0;
        for (const b of await listAll(day)) { const x = await getJ(b.key).catch(() => null); if (x && x.sent) sent++; }
        if (sent >= limitOf(R.state, 'foundMailsPerDay', 2)) return false;
        const k = day + slot;
        if (await getJ(k).catch(() => null)) return false;
        const id = newId();
        await putJ(k, {id, at: Date.now()});
        if (SETTLE > 0) await sleep(SETTLE);
        const again = await getJ(k).catch(() => null);
        if (!again || again.id !== id) return false;
        const link = String(site || '').replace(/\/+$/, '') + '/#coo';
        const subject = awayOnly ? 'm360: ' + n + ' waiting on you' : 'm360: the day is closed';
        const text = line + '\n\nOpen the COO in m360: ' + link;
        const html = '<p>' + escH(line) + '</p><p><a style="color:#0A0A0A;font-weight:600" href="' + escH(link) + '">Open the COO in m360</a></p>';
        try {
          await timed(MAIL_MS, signal => sendMail(p.email, subject, text, html, site, {signal}));
          await putJ(k, {id, at: Date.now(), sent: Date.now()});
          return true;
        } catch (e) {
          await putJ(k, {id, at: Date.now(), error: String((e && e.message) || e).slice(0, 200)}).catch(() => {});
          return false;
        }
      }
    };
    return io;
  }
  /* away from m360: no presence beacon in 2 minutes and no activity bucket in 30 (the personal managers' test) */
  async function away(R, uid) {
    const now = Date.now();
    for (const b of await listAll('r/' + uid + '~')) if ((Number(b.key.split('~')[1]) || 0) > now - 2 * MIN) return false;
    const act = (meOf(R.ctx, uid).act) || {};
    for (const day of Object.keys(act)) {
      if (!YMD.test(day) || !isObj(act[day])) continue;
      for (const bk of Object.keys(act[day])) if (/^\d{4}$/.test(bk) && dayStart(day) + (Number(bk.slice(0, 2)) * 60 + Number(bk.slice(2))) * MIN > now - 30 * MIN) return false;
    }
    return true;
  }

  /* one pass at a time across instances, and one claim per slot per day */
  async function claim(key, ttl, once) {
    const cur = await getJ(key).catch(() => null);
    if (once && cur && cur.state && cur.state !== 'running') return null;
    if (cur && Number(cur.until) > Date.now()) return null;
    const id = newId();
    const rec = {...(cur || {}), id, at: Date.now(), until: Date.now() + ttl, state: 'running'};
    await putJ(key, rec);
    if (SETTLE > 0) await sleep(SETTLE);
    const again = await getJ(key).catch(() => null);
    return again && again.id === id ? rec : null;
  }
  async function note(patch) {
    const cur = (await getJ('x/coo/index').catch(() => null)) || {};
    await putJ('x/coo/index', {...cur, ...patch}).catch(() => {});
  }
  /* the feed at rest (off, paused, stuck), once a day per state */
  async function rest(st, now) {
    const live = await read('office/live');
    if (live && live.state === st && ymdOf(Number(live.at) || 0) === ymdOf(now)) return;
    await writeQuiet('office/live', {v: 1, state: st, job: '', station: st === 'off' || st === 'paused' ? 'desk' : 'clock', at: now, next: null, pass: {at: now, by: 'server'}, seq: now});
    const cur = await read('coo/now');
    await writeQuiet('coo/now', {...(cur || {}), state: st, at: now});
  }
  /* rows a timeout left running: done when the target holds what the COO set, else failed and tried once more */
  async function reconcile(ctx, io, now) {
    for (const ymd of Object.keys(ctx.coo.L)) {
      const acts = (ctx.coo.L[ymd] && ctx.coo.L[ymd].acts) || {};
      const fix = {};
      for (const id of Object.keys(acts)) {
        const r = acts[id];
        if (!r || r.status !== 'running' || (Number(r.at) || 0) > now - LEASE_MS) continue;
        const ok = r.tgt && r.after && same(pickOf(await read(r.tgt.path), r.tgt.pick), r.after);
        fix[id] = ok ? {status: 'done', note: 'settled on the next round'} : {status: 'failed', note: 'did not land', retried: true};
        if (!ok && r.key && !r.retried) await io.releaseAct(ymd, r.key);
      }
      if (Object.keys(fix).length) { await io.ledger(ymd, fix); for (const id of Object.keys(fix)) acts[id] = {...acts[id], ...fix[id]}; }
    }
  }

  async function pass(site, t0, tick) {
    const now = Date.now();
    const ymd = ymdOf(now), mins = minsOf(now);
    const settings = await appSettings();
    const cstate = (await read('coo/state')) || {};
    const st = status({settings, coo: {state: cstate}}, now, env);
    /* at rest the feed says so once a day, from the heartbeat only: page traffic and a site not set up write nothing */
    if (st === 'off' || st === 'paused' || st === 'stuck') {
      if (tick && (await ownerUid())) await rest(st, now);
      return st === 'off' ? null : {slot: '', state: st, acts: 0, ms: Date.now() - t0};
    }
    if (!(await ownerUid())) return null;
    if (!tick) {
      /* Sundays have no heartbeat (founder decisions 2): page traffic runs their health, open and close only */
      if (mins < 540 || mins > 1260) return null;
      const beat = await getJ('x/coo/beat').catch(() => null);
      if (beat && Number(beat.at) > now - BEAT_STALE) return null;
    }
    const lease = await claim('x/coo/lease', 60000);
    if (!lease) return {slot: '', state: 'busy', acts: 0, ms: Date.now() - t0};
    const flags = {ai: false};
    const io = ioFor(t0, site, flags);
    let last = '', acts = 0, out = null;
    try {
      let ctx = await loadCtx(settings, now);
      await reconcile(ctx, io, now);
      const title0 = title(ctx);
      const bot = await getJ('p/' + UID).catch(() => null);
      if (!bot || bot.name !== title0) await putJ('p/' + UID, {name: title0, at: now, bot: true});
      /* which slots are due: first with nothing done, to know which claims to read, then with them */
      const slots = stateOf(ctx, now).slots;
      const look = slotsDue(slots, now, {});
      const ids = look.run.concat(look.skip).map(x => x.id);
      const docs = {};
      await Promise.all(ids.map(async id => { docs[id] = await getJ('x/coo/' + ymd + '/' + id).catch(() => null); }));
      const done = {};
      for (const id of ids) { const d = docs[id]; if (d && (d.state !== 'running' || Number(d.until) > Date.now())) done[id] = true; }
      const due = slotsDue(slots, now, done);
      const late = [];
      for (const x of due.skip) { await putJ('x/coo/' + ymd + '/' + x.id, {state: 'skipped', why: 'late', at: Date.now(), slotAt: x.at}); late.push({id: x.id, at: x.at, why: 'late'}); }
      for (const id of ids) if (docs[id] && docs[id].state === 'skipped') late.push({id, at: docs[id].slotAt || 0, why: 'late'});
      /* the close puts the office to bed: a watch slot at the same minute does not wake it again */
      const closing = due.run.some(x => x.id === 'close');
      for (const x of due.run.filter(y => !(closing && /^w\d{4}$/.test(y.id)))) {
        if (io.late() || Date.now() - t0 > STOP_MS) break;
        const key = 'x/coo/' + ymd + '/' + x.id;
        const c = await claim(key, LEASE_MS, true);
        if (!c) continue;
        out = await runSlot(ctx, io, x.id, {now: Date.now(), late, cursor: c.cursor || 0});
        last = x.id; acts += out.acts;
        const after = out.out ? {...c, state: 'running', until: Date.now(), cursor: out.cursor, acts: (c.acts || 0) + out.acts}
          : {...c, state: out.stopped ? 'error' : 'done', until: Date.now(), cursor: out.cursor, acts: (c.acts || 0) + out.acts, ms: out.ms};
        await putJ(key, after);
        if (out.stopped || out.out) break;
        ctx = await loadCtx(settings, Date.now());
      }
      if (!last) {
        /* nothing due: the clock on the office still moves, so the founder sees the heartbeat */
        const cur = (await read('coo/now')) || {};
        const next = slotsDue(slots, Date.now(), {}).next || null;
        if (tick) idle = {until: Math.min(Date.now() + LOOK_MS, next ? next.at : Infinity), state: st === 'practice' ? 'practice' : 'on'};
        await writeQuiet('coo/now', {...cur, state: cur.state && cur.state !== 'off' && cur.state !== 'paused' ? cur.state : (st === 'practice' ? 'practice' : 'idle'), at: cur.at || Date.now(), next,
          pass: {at: Date.now(), slot: '', ms: Date.now() - t0, by: 'server', build}});
      }
      await putJ('x/coo/beat', {at: Date.now(), slot: last, build});
      await note({last: Date.now()});
      return {slot: last, state: out && out.stopped ? 'stuck' : out && out.out ? 'working' : st === 'practice' ? 'practice' : 'on', acts, ms: Date.now() - t0};
    } catch (e) {
      await note({lastError: {at: Date.now(), message: String((e && e.message) || e).slice(0, 200)}});
      return {slot: last, state: 'error', acts, ms: Date.now() - t0};
    } finally {
      await putJ('x/coo/lease', {id: '', until: 0, state: 'done', at: Date.now()}).catch(() => {});
    }
  }

  /* the pass, called by core.js after the personal managers' pass. Never throws; a tick gets its summary back */
  async function run(site, o) {
    const t0 = (o && o.t0) || Date.now();
    const tick = !!(o && o.tick);
    const now = Date.now();
    if (tick && idle && now < idle.until) return {slot: '', state: idle.state, acts: 0, ms: 0};
    idle = null;
    if (busy || (!tick && now - lookAt < LOOK_MS)) return null;
    lookAt = now;
    /* the daily backup may have used the request's first seconds: a pass starts only inside the first 8 */
    if (now - t0 > START_MS) return tick ? {slot: '', state: 'late', acts: 0, ms: 0} : null;
    busy = true;
    try { return await pass(site, t0, tick); }
    catch (e) { return null; }
    finally { busy = false; }
  }

  const owner = async v => { const o = await ownerUid(); if (!v || !o || v.uid !== o) throw new HttpError(403, 'not_granted', 'Only the owner sends these.'); return o; };
  const actions = {
    /* the owner's tap on a draft: claimed, checked again, through the copy guard, sent from Kaavish's own mail
       (or the books' reminder path, which marks the invoice chased), then marked done in his name */
    async coosend(v, body, req) {
      await owner(v);
      const id = String((body && body.id) || '');
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new HttpError(400, 'invalid_argument', 'Which card?');
      let path = '', card = null;
      for (const p of ['coo/dec', 'books/cooq']) { const d = await read(p); const k = d && d.items && d.items[id]; if (k) { path = p; card = k; break; } }
      if (!card) throw new HttpError(404, 'not_found', 'That card is gone.');
      if (!MAIL.has(card.kind) || !card.payload || !card.payload.draft) throw new HttpError(400, 'failed_precondition', 'There is nothing to send on that card.');
      if (card.status === 'done') throw new HttpError(409, 'already', 'That one has gone out already.');
      const live = card.status === 'open' || card.status === 'snoozed' || (card.status === 'sending' && Number(card.sendingUntil) < Date.now());
      if (!live) throw new HttpError(409, 'stale', 'That card is closed.');
      const set = async (fields, what) => { const cur = (await read(path)) || {items: {}}; await writeAs(v.uid, path, merge(cur, {items: {[id]: fields}}), what); };
      /* the claim: only one tap sends it, whichever device or instance */
      const mine = newId();
      await set({status: 'sending', sendingId: mine, sendingUntil: Date.now() + 60000}, 'coo send ' + id);
      if (SETTLE > 0) await sleep(SETTLE);
      const back = ((await read(path)) || {}).items || {};
      if (!back[id] || back[id].sendingId !== mine) throw new HttpError(409, 'already', 'That one is already on its way.');
      const d = {...(((back[id].payload || {}).draft) || card.payload.draft)};
      const reopen = async (why, status) => { await set({status: status || 'open', sendingId: null, sendingUntil: null, ...(status ? {decidedAt: Date.now(), decidedVia: 'coosend', result: why} : {})}, 'coo send ' + id); };
      const to = String(d.to || '').trim(), subject = String(d.subject || '').trim(), text = String(d.text || '');
      if (!to) { await reopen(''); throw new HttpError(400, 'invalid_argument', 'Add who it goes to first.'); }
      /* the facts again, at the tap */
      let stale = '';
      if (card.kind === 'invoice_reminder' && books) {
        const doc = await read('invoices/' + d.fy);
        const inv = doc && doc.rows ? doc.rows[d.invoice] : null;
        const s = inv ? books.statusOf(inv, ymdOf(Date.now())) : 'gone';
        if (s === 'gone') stale = 'The invoice is gone, so I dropped the reminder.';
        else if (s === 'paid' || s === 'void') stale = 'The invoice was ' + (s === 'paid' ? 'paid' : 'voided') + ', so I dropped the reminder.';
      }
      if (!stale && d.threadId && gapi) {
        const t = await timed(GOOGLE_MS, signal => gapi(v.uid, 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + encodeURIComponent(d.threadId) + '?format=minimal', {signal})).catch(() => null);
        if (t && (t.messages || []).some(m => Number(m.internalDate) > Number(card.at) && (m.labelIds || []).indexOf('SENT') < 0)) stale = 'They wrote back since, so I dropped the draft.';
      }
      if (!stale && card.kind === 'meeting_mail' && d.event && gapi) {
        const e = await timed(GOOGLE_MS, signal => gapi(v.uid, 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(d.event), {signal})).catch(() => null);
        if (e && (e.status === 'cancelled' || (d.start && ((e.start && (e.start.dateTime || e.start.date)) || '') !== d.start))) stale = 'The meeting moved, so I dropped the note.';
      }
      if (stale) { await reopen(stale, 'void'); return {ok: false, say: stale}; }
      /* the copy guard: the house rules on what goes out in Kaavish's name */
      const bad = [lint(subject), lint(text)].find(x => !x.ok);
      if (bad) { await reopen(''); throw new HttpError(400, 'failed_precondition', 'The draft breaks a house rule (' + bad.why + '). Edit it, then send.'); }
      try {
        if (card.kind === 'invoice_reminder') await call('invoicesend', v, {fy: d.fy, id: d.invoice, to, cc: d.cc || '', subject, text, kind: 'remind'}, req);
        else await call('gmailsend', v, {to, cc: d.cc || '', subject, text, threadId: d.threadId || ''}, req);
      } catch (e) {
        await reopen('');
        throw e;
      }
      await set({status: 'done', sendingId: null, sendingUntil: null, decidedAt: Date.now(), decidedVia: 'coosend', result: 'Sent to ' + to.split(/[,;]/)[0].trim()}, 'sent coo draft ' + id);
      return {ok: true, say: card.kind === 'invoice_reminder' ? 'Sent. The invoice is marked chased.' : 'Sent from your mail.'};
    },
    /* the pass's own health, for the COO tab and Admin */
    async coostatus(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const ymd = ymdOf(Date.now());
      const owner0 = await ownerUid();
      const [beat, index, ai, mail, g] = await Promise.all([getJ('x/coo/beat').catch(() => null), getJ('x/coo/index').catch(() => null),
        getJ('n/ai/' + ymd + '/' + UID).catch(() => null), mailOn(), owner0 ? getJ('x/g/' + owner0).catch(() => null) : null]);
      const lastSlots = [];
      for (const b of await listAll('x/coo/' + ymd + '/')) {
        const x = await getJ(b.key).catch(() => null);
        if (x) lastSlots.push({slot: b.key.split('/').pop(), state: x.state || '', at: Number(x.at) || 0, acts: Number(x.acts) || 0, ms: Number(x.ms) || 0});
      }
      lastSlots.sort((a, b) => b.at - a.at);
      return {beat: beat || null, index: index || {}, lastSlots: lastSlots.slice(0, 20), aiUsed: Number((ai || {}).n) || 0, mail: !!mail, google: !!g, runner: 'server', off: String(env.COO_OFF || '') === '1'};
    }
  };
  return {run, actions};
}

/* the model's two jobs, both optional: reword drafts, and the memo's one paragraph */
const DRAFT_SYSTEM = 'COO DRAFTS. You reword short emails that Kaavish Ramchandani, founder of Mask360, a creative agency in Mumbai, may send to a client. ' +
  'Keep the facts of each template, add none, and never add an address or a link. Plain, warm and short: under 90 words, his voice, signed Kaavish. ' +
  'No dashes, no exclamation marks and no contrast phrases. Reply with JSON only: {"drafts": [{"id": "", "text": ""}]}, one per draft given, same ids.';
const MEMO_SYSTEM = 'COO MEMO. You write the opening paragraph of a weekly memo for Kaavish, founder of Mask360, from the numbers given. Two or three plain sentences, ' +
  'warm and factual, no names, no numbers beyond those given. No dashes, no exclamation marks and no contrast phrases. Reply with the paragraph only.';
const escH = s => String(s).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

/* the planner, for test_coo_parity.py: the page's M.coo.plan names */
export const plan = {stateOf, slotsDue, leaveCheck, balance, clientDated, load, shortlist, planCover, planRebalance, actKey, lint};
export {guard, copy, JOBS, RUNGS};
