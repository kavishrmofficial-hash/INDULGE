/* pm: the personal managers on the team site. The page (src/js/09-pm.js) does all the chasing in the
   app; this pass only covers the closed case, with email to someone who is away from m360.

   run(site) looks at most every ten minutes per instance (env.PM_RECHECK_MS), on IST working days
   between 09:30 and 21:30, and only when settings/app.pm.mail is on and mail is set up. It reads the
   roster, settings, me/*, checkin/*, eod/*, tasks/*, leave/*, leavedec/* and the presence beacons,
   and derives the same items as the page, with the same keys (K = rep:kind:sub:ymd, steps K#1 and
   K#a.<askId>), for the kinds a server can judge without the page: noin, noeod, overdue, sentback and
   chase, plus manual asks about a check-in, a check-out, an EOD line, an overdue task, a task and a
   custom question. Asks go out even while the bots are switched off (the founder's call, 3 October).

   A report hears by mail when the step is at least 15 minutes old, nobody marked it told, there is no
   answer on K, no manager took it (mine) or let it go (drop), they are away (no beacon in 2 minutes and
   no activity bucket in 30), it is inside their ring window (their hours, never over lunch or after they
   checked out), and nobody switched the mail off. An ask counts only from someone with the right to make
   it: the founder, or up the person's line (attendance: their direct manager). A manager hears once a day
   ('esc') when a step 2 is due and they are away. Every mail is claimed first:
     x/pm/<ymd IST>/<uid>/<slot>      {at, id, to, slot, keys, steps, sent?, error?}   slot am, pm or esc
     x/pm/index                       {last, mails, lastError}
   written, read back, and sent only when the claim is still ours, so two instances never send twice.
   Nothing here writes to a page's documents: the "emailed 11:00" chip reads the ledger (pmmail). */

const IST_MS = 330 * 60000;
const MIN = 60000;
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/* the m360 COO (coo.js): its asks count as the founder's while Kaavish has it on and its asks are not off */
const COO_UID = 'u_m360coo';
const cooAsks = settings => {
  const c = isObj(settings && settings.coo) ? settings.coo : {};
  return c.on === true && (!isObj(c.caps) || c.caps.nudge !== 'off');
};

/* the policy defaults, the same as M.SETTINGS_DEFAULTS.pm on the page (with the founder's launch calls:
   off until switched on in Admin, and a manager cannot switch their own bot off) */
export const PM_DEFAULTS = {
  on: false, require: true,
  kinds: {noin: true, noeod: true, overdue: true, sentback: true, chase: true, quiet: true, waiton: true, noout: true, idle: false, short: false},
  wait: 60, waitMin: 30, waitMax: 180, carry: 120, digestAt: '17:30', perDay: 4, mgrPerDay: 6, quietMax: 2, askPerDay: 3,
  minHours: 0, coachDays: 10, blockerMins: 120, mail: true
};
/* each kind also obeys its rule switch */
const RULE_OF = {noin: 'R01', noeod: 'R04', overdue: 'R07', sentback: 'R07', chase: 'R07'};
/* the kinds a manual ask can carry that this pass can judge */
const ASK_KINDS = new Set(['noin', 'noout', 'noeod', 'overdue', 'task', 'custom']);
/* the kinds that reach the manager when nobody answers (noeod goes in the morning sweep, on the page) */
const ESCALATES = new Set(['noin', 'overdue', 'sentback', 'chase']);

/* ---------- the IST clock ---------- */
const ymdOf = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);
const dayStart = ymd => Date.parse(ymd + 'T00:00:00Z') - IST_MS;
const minsOf = ms => { const d = new Date(ms + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hhmm = ms => { const d = new Date(ms + IST_MS); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const toMins = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const dowOf = ymd => new Date(ymd + 'T00:00:00Z').getUTCDay();
const fmtDay = ymd => YMD.test(ymd || '') ? DAYS[dowOf(ymd)] + ' ' + Number(ymd.slice(8, 10)) + ' ' + MONS[Number(ymd.slice(5, 7)) - 1] : String(ymd || '');
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/* ---------- reporting lines: the page's managerFrom, line for line ---------- */
export function managerFrom(members, founderUid, uid) {
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
export function chainOf(members, founderUid, uid) {
  const out = [];
  let cur = managerFrom(members, founderUid, uid);
  while (cur && out.indexOf(cur) < 0 && out.length < 8) { out.push(cur); cur = managerFrom(members, founderUid, cur); }
  return out;
}

/* the policy: settings/app.pm over the defaults, kinds included */
export function policy(settings) {
  const pm = isObj(settings && settings.pm) ? settings.pm : {};
  return {...PM_DEFAULTS, ...pm, kinds: {...PM_DEFAULTS.kinds, ...(isObj(pm.kinds) ? pm.kinds : {})}};
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/* a manager's own bot on a day: cfg, with stricter changes from cfg.next once their day comes */
export function cfgOf(state, mgr, ymd) {
  const P = policy(state.settings);
  const pm = (state.me[mgr] || {}).pm || {};
  let cfg = isObj(pm.cfg) ? {...pm.cfg} : {};
  const next = isObj(cfg.next) ? cfg.next : null;
  if (next && next.from && next.from <= ymd) {
    if (next.wait != null) cfg.wait = next.wait;
    if (isObj(next.kinds)) cfg.kinds = {...(cfg.kinds || {}), ...next.kinds};
  }
  const lo = Number(P.waitMin) || 30, hi = Number(P.waitMax) || 180;
  return {
    on: P.require ? true : cfg.on !== false,
    kinds: isObj(cfg.kinds) ? cfg.kinds : {},
    wait: clamp(Number(cfg.wait) || Number(P.wait) || 60, lo, hi),
    voice: cfg.voice === 'brief' ? 'brief' : 'warm',
    mail: cfg.mail !== false,
    pause: isObj(cfg.pause) ? cfg.pause : {}
  };
}
/* the founder's own switch for one manager's bot (Admin), when the page keeps one */
const offByFounder = (P, mgr) => isObj(P.off) && !!P.off[mgr];
export const key = (rep, kind, sub, ymd) => rep + ':' + kind + ':' + (sub || '-') + ':' + ymd;

/* ---------- one person's day, read the way the page reads it ---------- */
function leaveState(state, uid, ymd) {
  const reqs = ((state.leave[uid] || {}).reqs) || [];
  const dec = ((state.leavedec[uid] || {}).d) || {};
  let approved = false, pending = false;
  for (const r of Array.isArray(reqs) ? reqs : []) {
    if (!r || !r.from || !r.to || r.from > ymd || r.to < ymd) continue;
    const st = (dec[r.id] || {}).status;
    if (st === 'approved') approved = true;
    else if (!st || st === 'pending') pending = true;
  }
  const ci = (((state.checkin[uid] || {}).days) || {})[ymd] || null;
  if (ci && ci.mode === 'leave') approved = true;
  return {approved, pending};
}
const holidaysOf = settings => new Set(Array.isArray(settings && settings.holidays) ? settings.holidays : []);
export const isWorkingDay = (settings, ymd) => dowOf(ymd) !== 0 && !holidaysOf(settings).has(ymd);
/* a person's start (their own on the roster, else the team's), and with the grace added: the moment noin begins */
function rawStart(state, uid) {
  const s = state.settings || {};
  const m = state.members[uid] || {};
  return toMins(m.start) != null ? toMins(m.start) : (toMins(s.start) != null ? toMins(s.start) : 630);
}
function startMins(state, uid) {
  const s = state.settings || {};
  return rawStart(state, uid) + (s.grace != null ? (Number(s.grace) || 0) : 15);
}
const startLabel = (state, uid) => toMins((state.members[uid] || {}).start) != null ? state.members[uid].start : ((state.settings || {}).start || '10:30');
const cutMins = settings => toMins(settings && settings.eodCut) != null ? toMins(settings.eodCut) : 1170;
const ruleOn = (settings, k) => !RULE_OF[k] || !isObj(settings && settings.rules) || settings.rules[RULE_OF[k]] !== false;
const openTask = t => t && !t.deleted && t.status !== 'done';
/* the first N working days after "joined": the bot tells the person only */
function inCoach(state, rep, ymd, P) {
  const joined = (state.members[rep] || {}).joined;
  const n = Number(P.coachDays) || 0;
  if (!n || !YMD.test(joined || '') || joined > ymd) return false;
  /* the page's coachUntil: the Nth working day from "joined" (that day counted) is the first one out */
  let d = joined, count = 0;
  for (let i = 0; i < 120 && d <= ymd; i++, d = addDays(d, 1)) if (isWorkingDay(state.settings, d)) count++;
  return count < n;
}
const isFounder = (state, u) => !!u && (u === state.founderUid || ((state.members[u] || {}).role === 'founder' && state.members[u].active !== false));
/* who may ask rep at all: the founder, or someone up rep's line; about attendance only the founder or the
   direct manager (canSee). The agent checks the same when the ask is made, so an ask written by hand into
   someone's own me doc outside these rights is never mailed */
function mayAsk(state, x, rep, kind) {
  if (x === COO_UID) return cooAsks(state.settings) && !!state.members[rep] && state.members[rep].active !== false;
  if (!x || x === rep || !state.members[x] || state.members[x].active === false) return false;
  if (isFounder(state, x)) return true;
  if (kind === 'noin' || kind === 'noout' || kind === 'noeod') return managerFrom(state.members, state.founderUid, rep) === x;
  return chainOf(state.members, state.founderUid, rep).indexOf(x) >= 0;
}

/* every item about rep today that this pass can judge: [{K, rep, kind, sub, ymd, s1, step, source, from, askId?, mgr, t?}] */
export function items(state, rep, now) {
  const out = [];
  const members = state.members || {};
  const m = members[rep];
  if (!m || m.active === false) return out;
  const ymd = ymdOf(now);
  if (!isWorkingDay(state.settings, ymd)) return out;
  if (m.joined && YMD.test(m.joined) && m.joined > ymd) return out;
  /* approved leave clears the day; a pending request holds it (the page's "held"), asks included */
  const lv = leaveState(state, rep, ymd);
  if (lv.approved || lv.pending) return out;
  const P = policy(state.settings);
  const d0 = dayStart(ymd), mins = minsOf(now);
  const start = startMins(state, rep), cut = cutMins(state.settings);
  const ci = (((state.checkin[rep] || {}).days) || {})[ymd] || null;
  const eod = (((state.eod[rep] || {}).days) || {})[ymd] || null;
  const tasks = state.tasks || {};
  const mgr = managerFrom(members, state.founderUid, rep);
  const cfg = mgr ? cfgOf(state, mgr, ymd) : null;
  const paused = cfg && cfg.pause[rep] && String(cfg.pause[rep]) >= ymd;
  const auto = !!(mgr && P.on && cfg.on && !offByFounder(P, mgr) && !paused);
  const kindOn = k => P.kinds[k] !== false && (!cfg || cfg.kinds[k] !== false) && ruleOn(state.settings, k);
  const push = (kind, sub, s1, extra) => out.push({K: key(rep, kind, sub, ymd), rep, kind, sub: sub || '-', ymd, s1, step: '1', source: 'bot', from: mgr, mgr, ...extra});
  if (auto) {
    if (kindOn('noin') && !(ci && ci.in) && mins > start) push('noin', '', d0 + start * MIN);
    if (kindOn('noeod') && !eod && mins > cut) push('noeod', '', d0 + cut * MIN);
    for (const id of Object.keys(tasks).sort()) {
      const t = tasks[id];
      if (!openTask(t) || t.owner !== rep) continue;
      if (kindOn('overdue') && t.due && t.due < ymd) push('overdue', id, d0 + (start + 30) * MIN, {t});
      if (kindOn('sentback') && t.sentBackBy && t.sentBackBy !== rep && (t.status === 'todo' || t.status === 'doing') &&
        Number(t.sentBackAt) > 0 && (Number(t.updated) || 0) <= Number(t.sentBackAt) + MIN) {
        const back = Number(t.sentBackAt);
        let s1 = null;
        if (ymdOf(back) === ymd) { if (back + 240 * MIN <= d0 + (cut - 30) * MIN) s1 = back + 240 * MIN; }
        else if (back < d0) s1 = d0 + (start + 30) * MIN;
        if (s1 != null) push('sentback', id, s1, {t, by: t.sentBackBy});
      }
    }
    if (kindOn('chase')) {
      /* the nearest one up the line who asked for the task wins, the way the page reads it */
      const chain = chainOf(members, state.founderUid, rep);
      for (const id of Object.keys(tasks).sort()) {
        const t = tasks[id];
        if (!openTask(t) || t.owner !== rep) continue;
        for (const x of chain) {
          const c = ((((state.me[x] || {}).pm) || {}).chase || {})[id];
          if (!c || !Number(c.at)) continue;
          const at = Number(c.at);
          push('chase', id, ymdOf(at) === ymd ? at + 5 * MIN : d0 + (start + 30) * MIN, {t, by: x});
          break;
        }
      }
    }
  }
  /* manual asks, from anyone, to rep: only while the condition they ask about still holds */
  for (const x of Object.keys(state.me).sort()) {
    const asks = (((state.me[x] || {}).pm) || {}).asks || {};
    for (const askId of Object.keys(asks).sort()) {
      const a = asks[askId];
      if (!isObj(a) || a.withdrawn || !Array.isArray(a.to) || a.to.indexOf(rep) < 0 || !ASK_KINDS.has(a.kind) || !mayAsk(state, x, rep, a.kind)) continue;
      const at = Number(a.showAt || a.at) || 0;
      if (!at || ymdOf(at) !== ymd || at > now) continue;
      const t = a.sub ? tasks[a.sub] : null;
      /* attendance holds from the moment the manager's watch shows it, as on the page */
      let holds = true, sub = '';
      if (a.kind === 'noin') holds = !(ci && ci.in) && mins > start;
      else if (a.kind === 'noout') holds = !!(ci && ci.in && !ci.out) && mins > cut + 60;
      else if (a.kind === 'noeod') holds = !eod && mins > cut;
      else if (a.kind === 'overdue') { holds = !!(openTask(t) && t.due && t.due < ymd); sub = a.sub; }
      else if (a.kind === 'task') { holds = openTask(t); sub = a.sub; }
      else if (a.kind === 'custom') sub = askId;
      if (!holds) continue;
      out.push({K: key(rep, a.kind, sub, ymd), rep, kind: a.kind, sub: sub || '-', ymd, s1: at, step: 'a.' + askId, source: 'ask', from: x, askId, mgr,
        askAt: Number(a.at) || at, ringNow: !!a.ringNow && isFounder(state, x), t, ci});
    }
  }
  for (const it of out) it.id = it.K + '#' + it.step;
  return out;
}

/* is K answered or taken? acks read across the 8 days the page keeps */
function reportCovered(state, it, ymd) {
  const ack = (((state.me[it.rep] || {}).pm) || {}).ack || {};
  if (ack[it.K]) return true;
  /* an "on it" with a date covers the same item on later days until the date passes */
  const stem = it.rep + ':' + it.kind + ':' + it.sub + ':';
  for (const k of Object.keys(ack)) {
    const a = ack[k];
    if (k.indexOf(stem) === 0 && a && a.how === 'onit' && typeof a.eta === 'string' && a.eta >= ymd) return true;
  }
  return false;
}
function takenByManager(state, it, ymd) {
  const stem = it.rep + ':' + it.kind + ':' + it.sub + ':';
  for (const x of Object.keys(state.me)) {
    if (x === it.rep) continue;
    const ack = (((state.me[x] || {}).pm) || {}).ack || {};
    const a = ack[it.K];
    if (a && (a.how === 'mine' || a.how === 'drop' || a.how === 'answered')) return true;
    /* "Let it go" until a date */
    for (const k of Object.keys(ack)) if (k.indexOf(stem) === 0 && ack[k] && ack[k].how === 'drop' && typeof ack[k].until === 'string' && ack[k].until >= ymd) return true;
  }
  return false;
}
const toldOf = (state, uid) => (((state.me[uid] || {}).pm) || {}).told || {};
const ackOf = (state, uid) => (((state.me[uid] || {}).pm) || {}).ack || {};

/* when step 2 is due for an automatic item, or null when it does not escalate */
function escAt(state, it, ymd, P) {
  if (it.source !== 'bot' || !ESCALATES.has(it.kind) || inCoach(state, it.rep, ymd, P)) return null;
  const wait = cfgOf(state, it.mgr, ymd).wait;
  const a = ((((state.me[it.rep] || {}).pm) || {}).ack || {})[it.K];
  if (!a) return reportCovered(state, it, ymd) ? null : {at: it.s1 + wait * MIN, step: '2'};
  if (a.how === 'blocked') return {at: Number(a.at) || it.s1, step: '2'};
  if (a.how === 'onit' && typeof a.eta === 'number') return {at: a.eta + Math.max(30, wait / 2) * MIN, step: '2b'};
  return null;
}

/* the manager who hears step 2: past one on leave or inactive that day */
function managerFor(state, rep, ymd) {
  const ch = chainOf(state.members, state.founderUid, rep);
  for (const u of ch) if ((state.members[u] || {}).active !== false && !leaveState(state, u, ymd).approved) return u;
  return ch[0] || null;
}

/* the people who have been nowhere near m360 for a while */
function awayOf(state, uid, now, beacons) {
  if ((beacons[uid] || 0) > now - 2 * MIN) return false;
  const act = ((state.me[uid] || {}).act) || {};
  for (const day of Object.keys(act)) {
    if (!YMD.test(day) || !isObj(act[day])) continue;
    for (const b of Object.keys(act[day])) {
      if (!/^\d{4}$/.test(b)) continue;
      const at = dayStart(day) + (Number(b.slice(0, 2)) * 60 + Number(b.slice(2))) * MIN;
      if (at > now - 30 * MIN) return false;
    }
  }
  return true;
}
/* the page's ring window (C6), less the focus timer only a device knows: a working day they are not on leave,
   from their start minus 30 to the EOD cut plus 90, never over lunch, nothing once they have checked out, and
   before they check in only the check-in itself */
function inWindow(state, uid, now, kind) {
  const ymd = ymdOf(now), mins = minsOf(now);
  if (!isWorkingDay(state.settings, ymd) || leaveState(state, uid, ymd).approved) return false;
  if (mins < rawStart(state, uid) - 30 || mins > cutMins(state.settings) + 90) return false;
  const s = state.settings || {};
  const lf = toMins(s.lunchFrom != null ? s.lunchFrom : '13:30'), lt = toMins(s.lunchTo != null ? s.lunchTo : '14:30');
  if (lf != null && lt != null && lt > lf && mins >= lf && mins < lt) return false;
  const ci = (((state.checkin[uid] || {}).days) || {})[ymd] || null;
  if (ci && ci.out) return false;
  return !!(ci && ci.in) || kind === 'noin';
}

/* ---------- the words (spec Part E) ---------- */
const first = s => String(s || '').trim().split(/\s+/)[0] || '';
/* who asked: a first name, or the COO's whole title */
const asker = (nameOf, u) => u === COO_UID ? (nameOf(u) || 'm360 COO') : first(nameOf(u));
function reportLine(state, it, nameOf) {
  const t = it.t || {}, title = t.title || 'that task';
  const mgr = first(nameOf(it.mgr));
  if (it.source === 'ask') {
    const head = asker(nameOf, it.from) + ' asked m360 to check with you, ' + hhmm(it.s1) + '. ';
    const ci = it.ci || {};
    if (it.kind === 'noout') return head + 'You are still checked in from ' + (ci.in ? hhmm(ci.in) : 'this morning') + '. What happened?';
    if (it.kind === 'noin') return head + 'No check-in yet today (start ' + startLabel(state, it.rep) + '). All okay?';
    if (it.kind === 'noeod') return head + 'No EOD line for today yet. Two lines are enough.';
    if (it.kind === 'overdue') return head + "'" + title + "' was due " + fmtDay(t.due) + '. Where is it at?';
    if (it.kind === 'task') return head + "It is about '" + title + "'. Where is it at?";
    return head + 'Their words are in your messages on m360.';
  }
  if (it.kind === 'noin') return 'No check-in yet. Your day started at ' + startLabel(state, it.rep) + '.';
  if (it.kind === 'noeod') return "Today's EOD line is not in. Two lines do it: what shipped, what is next.";
  if (it.kind === 'overdue') return 'The ' + title + ' was due ' + fmtDay(t.due) + ' and is still open.';
  if (it.kind === 'sentback') return first(nameOf(it.by)) + ' sent the ' + title + ' back at ' + hhmm(t.sentBackAt) + ' and it has not moved since.';
  if (it.kind === 'chase') return (first(nameOf(it.by)) || mgr) + ' asked the bot to check on the ' + title + '. Where is it at?';
  return '';
}
function managerLine(state, it, nameOf, esc, now) {
  const t = it.t || {}, title = t.title || 'that task', who = first(nameOf(it.rep));
  const thing = it.kind === 'noin' ? 'the check-in' : 'the ' + title;
  /* a told mark is negative when the page showed the step without a sound */
  const nudged = Math.abs(Number(toldOf(state, it.rep)[it.id]) || 0);
  const seen = nudged ? ' Nudged at ' + hhmm(nudged) + '.' : ' The nudge has not been seen yet.';
  const a = ((((state.me[it.rep] || {}).pm) || {}).ack || {})[it.K];
  if (a && a.how === 'blocked') return who + ' is blocked on ' + thing + '.';
  if (esc.step === '2b' && a) return who + ' said ' + hhmm(a.eta) + ' for ' + thing + '. It is ' + hhmm(now) + (it.kind === 'noin' ? ' and there is no check-in yet.' : ' and it is still open.');
  if (it.kind === 'noin') return 'No check-in from ' + who + ' since the ' + startLabel(state, it.rep) + ' start.' + seen;
  const days = t.due ? Math.max(1, Math.round((dayStart(it.ymd) - dayStart(t.due)) / 86400000)) : 0;
  if (it.kind === 'overdue') return who + ' has not answered about the ' + title + '. It is ' + days + (days === 1 ? ' day' : ' days') + ' overdue.' + seen;
  if (it.kind === 'sentback') return who + ' has not answered about the ' + title + ', sent back at ' + hhmm(t.sentBackAt) + '.' + seen;
  return who + ' has not answered about the ' + title + ', which the bot was asked to chase.' + seen;
}
const ASK_SUBJECT = {noout: 'your check-out', noin: 'your check-in', noeod: 'your EOD line', overdue: 'a task', task: 'a task', custom: 'something'};
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const escH = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function reportMail(state, rep, list, nameOf, site) {
  const who = first(nameOf(rep)) || 'there';
  const bots = list.filter(it => it.source === 'bot'), asks = list.filter(it => it.source === 'ask');
  const bot = bots.length ? first(nameOf(bots[0].mgr)) + "'s bot" : '';
  let subject;
  if (!asks.length) subject = plural(list.length, 'thing', 'things') + ' from ' + bot;
  else if (!bots.length && list.length === 1) subject = asker(nameOf, asks[0].from) + ' asked about ' + ASK_SUBJECT[asks[0].kind];
  else subject = plural(list.length, 'thing', 'things') + ' waiting for you in m360';
  const lead = !asks.length ? 'Hi ' + who + ', ' + bot + ' in m360 has ' + plural(list.length, 'thing', 'things') + ' for you today.'
    : 'Hi ' + who + ', m360 has ' + plural(list.length, 'thing', 'things') + ' for you today.';
  const lines = list.map((it, i) => (i + 1) + '. ' + reportLine(state, it, nameOf));
  const readers = Array.from(new Set(list.map(it => it.source === 'ask' && it.from === COO_UID ? first(nameOf(state.founderUid)) : asker(nameOf, it.source === 'ask' ? it.from : it.mgr)).filter(Boolean)));
  const link = String(site || '').replace(/\/+$/, '') + '/#home';
  const tail = ['Answer in m360: ' + link + '. ' + (readers.length ? readers.join(' and ') + ' ' + (readers.length === 1 ? 'reads' : 'read') + ' your answers there.' : ''),
    'It emails you at most twice a day, only when you are away from m360. Turn it off under Me.'];
  const text = [lead].concat(lines, [''], tail).join('\n');
  const html = '<p>' + escH(lead) + '</p><ol>' + list.map(it => '<li>' + escH(reportLine(state, it, nameOf)) + '</li>').join('') + '</ol>' +
    '<p><a style="color:#0A0A0A;font-weight:600" href="' + escH(link) + '">Answer in m360</a>. ' + escH(tail[0].replace(/^Answer in m360: \S+ /, '')) + '</p><p style="color:#8A8A8A;font-size:13px">' + escH(tail[1]) + '</p>';
  return {subject, text, html};
}
export function managerMail(state, mgr, list, nameOf, site, now) {
  const who = first(nameOf(mgr)) || 'there';
  const reps = Array.from(new Set(list.map(x => x.it.rep)));
  const subject = reps.length === 1 && list.length === 1 ? first(nameOf(reps[0])) + ' has not answered your bot' : 'Your bot: ' + plural(list.length, 'thing', 'things') + ' it could not settle';
  const lines = list.map((x, i) => (i + 1) + '. ' + managerLine(state, x.it, nameOf, x.esc, now));
  const link = String(site || '').replace(/\/+$/, '') + '/#home';
  const lead = 'Hi ' + who + ', your bot in m360 could not settle ' + (list.length === 1 ? 'this one' : 'these') + ' with your team today.';
  const tail = ['Open Your team in m360: ' + link + '. You can nudge again, take it on, or let it go there.', 'This comes at most once a day, only when you are away from m360.'];
  const text = [lead].concat(lines, [''], tail).join('\n');
  const html = '<p>' + escH(lead) + '</p><ol>' + list.map(x => '<li>' + escH(managerLine(state, x.it, nameOf, x.esc, now)) + '</li>').join('') + '</ol>' +
    '<p><a style="color:#0A0A0A;font-weight:600" href="' + escH(link) + '">Open Your team in m360</a>. You can nudge again, take it on, or let it go there.</p><p style="color:#8A8A8A;font-size:13px">' + escH(tail[1]) + '</p>';
  return {subject, text, html};
}

/* what this pass would mail right now: [{to, slot, items}] for reports and [{to, slot: 'esc', items: [{it, esc}]}] for managers */
export function plan(state, now, ctx) {
  const {beacons = {}, emailOf = () => '', mailed = {}} = ctx || {};
  const ymd = ymdOf(now);
  const P = policy(state.settings);
  const out = [];
  const esc = {};
  const none = {slots: new Set(), keys: new Set()};
  for (const rep of Object.keys(state.members).sort()) {
    const list = items(state, rep, now);
    if (!list.length) continue;
    const told = toldOf(state, rep);
    const mine = (((state.me[rep] || {}).pm) || {});
    const done = mailed[rep] || none;
    /* an answer covers an ask only when it came after the ask, as on the page */
    const covered = it => it.source === 'ask' ? (Number((ackOf(state, it.rep)[it.K] || {}).at) || 0) >= it.askAt : reportCovered(state, it, ymd);
    const seenK = new Set();
    const due = list.filter(it => now >= it.s1 + 15 * MIN && !told[it.id] && !covered(it) && !takenByManager(state, it, ymd) &&
      (it.source === 'ask' || cfgOf(state, it.mgr, ymd).mail) && !done.keys.has(it.K) && (it.ringNow || inWindow(state, rep, now, it.kind)))
      /* the bot's step and an ask on the same key make one line in the mail */
      .filter(it => !seenK.has(it.K) && seenK.add(it.K));
    if (due.length && mine.mail !== false && emailOf(rep) && awayOf(state, rep, now, beacons)) {
      /* the slot: a check-in and anything due before 15:00 go in the morning one, the EOD line and later ones in the evening */
      const slotOf = it => it.kind === 'noin' ? 'am' : it.kind === 'noeod' ? 'pm' : (minsOf(it.s1) < 15 * 60 ? 'am' : 'pm');
      const slots = Array.from(new Set(due.map(slotOf))).filter(s => !done.slots.has(s));
      if (slots.length && ['am', 'pm'].filter(x => done.slots.has(x)).length < 2) out.push({to: rep, slot: slots.includes('am') ? 'am' : 'pm', items: due});
    }
    /* step 2, gathered per manager */
    for (const it of list) {
      if (it.source !== 'bot' || takenByManager(state, it, ymd)) continue;
      const e = escAt(state, it, ymd, P);
      if (!e || now < e.at + 15 * MIN) continue;
      const g = managerFor(state, rep, ymd);
      if (!g || toldOf(state, g)[it.K + '#' + e.step]) continue;
      (esc[g] = esc[g] || []).push({it, esc: e});
    }
  }
  for (const g of Object.keys(esc).sort()) {
    const done = mailed[g] || none;
    if (done.slots.has('esc') || ((state.me[g] || {}).pm || {}).mail === false || !emailOf(g) || !awayOf(state, g, now, beacons) || !inWindow(state, g, now, 'esc')) continue;
    out.push({to: g, slot: 'esc', items: esc[g]});
  }
  return out;
}

export function pmDesk(h) {
  const {getJ, putJ, docKey, listAll, readColl, inventory, ownerUid, appSettings, mailOn, sendMail, env, levelOf, LEVEL, HttpError} = h;
  const EVERY = env && env.PM_RECHECK_MS != null ? Number(env.PM_RECHECK_MS) : 600000;
  /* the pause between writing a claim and reading it back, so a second instance's claim made at the same
     moment lands first and only one of them still sees its own id */
  const SETTLE = env && env.PM_SETTLE_MS != null ? Number(env.PM_SETTLE_MS) : 400;
  let nextAt = 0, busy = false;

  async function coll(inv, name) {
    if (inventory && readColl) return readColl(name, inv[name] || {});
    const out = {};
    for (const b of await listAll(docKey(name) + '~')) {
      const id = b.key.slice(docKey(name).length + 1);
      if (id.indexOf('~') >= 0) continue;
      const d = await getJ(b.key).catch(() => null);
      if (d != null) out[id] = d;
    }
    return out;
  }
  async function founderOf(team) {
    const members = (team && team.members) || {};
    if (team && team.owner && members[team.owner]) return team.owner;
    const fs = Object.keys(members).filter(k => members[k].role === 'founder' && members[k].active !== false)
      .sort((a, b) => String(members[a].empId || '').localeCompare(String(members[b].empId || '')));
    return fs[0] || (await ownerUid()) || null;
  }
  /* everything the items need, from the store */
  async function load(settings) {
    const inv = inventory ? await inventory() : {};
    const team = (await getJ(docKey('roster/team')).catch(() => null)) || {};
    const [me, checkin, eod, tasks, leave, leavedec] = await Promise.all(['me', 'checkin', 'eod', 'tasks', 'leave', 'leavedec'].map(c => coll(inv, c)));
    return {members: team.members || {}, founderUid: await founderOf(team), settings, me, checkin, eod, tasks, leave, leavedec};
  }
  async function beaconsNow() {
    const out = {};
    for (const b of await listAll('r/')) {
      const [uid, at] = b.key.slice(2).split('~');
      const t = Number(at) || 0;
      if (uid && t > (out[uid] || 0)) out[uid] = t;
    }
    return out;
  }
  const ledgerKey = (ymd, uid, slot) => 'x/pm/' + ymd + '/' + uid + '/' + slot;
  async function ledger(ymd) {
    const rows = [];
    for (const b of await listAll('x/pm/' + ymd + '/')) {
      const r = await getJ(b.key).catch(() => null);
      if (r && r.to) rows.push(r);
    }
    return rows;
  }
  async function note(patch) {
    const cur = (await getJ('x/pm/index').catch(() => null)) || {};
    await putJ('x/pm/index', {...cur, ...patch}).catch(() => {});
  }

  /* the pass */
  async function run(site) {
    if (Date.now() < nextAt || busy) return;
    busy = true;
    try {
      nextAt = Date.now() + EVERY;
      const now = Date.now(), ymd = ymdOf(now), mins = minsOf(now);
      if (mins < 9 * 60 + 30 || mins > 21 * 60 + 30) return;
      const settings = await appSettings();
      if (!isWorkingDay(settings, ymd)) return;
      const P = policy(settings);
      /* with the mail switched off or not set up, nothing is read and nothing is claimed */
      if (P.mail === false || !(await mailOn())) return;
      const state = await load(settings);
      const people = {};
      await Promise.all(Object.keys(state.members).concat([COO_UID]).map(async u => { people[u] = (await getJ('p/' + u).catch(() => null)) || {}; }));
      const nameOf = u => (people[u] && people[u].name) || ((state.me[u] || {}).name) || '';
      const emailOf = u => (people[u] && people[u].email) || '';
      const mailed = {};
      for (const u of Object.keys(state.members)) mailed[u] = {slots: new Set(), keys: new Set()};
      for (const r of await ledger(ymd)) {
        const m = mailed[r.to] || (mailed[r.to] = {slots: new Set(), keys: new Set()});
        m.slots.add(r.slot);
        if (r.slot !== 'esc') (r.keys || []).forEach(k => m.keys.add(k));
      }
      const todo = plan(state, now, {beacons: await beaconsNow(), emailOf, mailed});
      for (const job of todo) {
        const k = ledgerKey(ymd, job.to, job.slot);
        if (await getJ(k).catch(() => null)) continue;
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const its = job.slot === 'esc' ? job.items.map(x => x.it) : job.items;
        const row = {at: now, id, to: job.to, slot: job.slot, keys: its.map(it => it.K), steps: job.slot === 'esc' ? job.items.map(x => x.it.K + '#' + x.esc.step) : its.map(it => it.id)};
        await putJ(k, row);
        if (SETTLE > 0) await new Promise(r => setTimeout(r, SETTLE));
        const again = await getJ(k).catch(() => null);
        if (!again || again.id !== id) continue;
        const m = job.slot === 'esc' ? managerMail(state, job.to, job.items, nameOf, site, now) : reportMail(state, job.to, job.items, nameOf, site);
        try {
          const ok = await sendMail(emailOf(job.to), m.subject, m.text, m.html, site);
          if (!ok) throw new Error('mail is not set up');
          await putJ(k, {...row, sent: Date.now()});
          const cur = (await getJ('x/pm/index').catch(() => null)) || {};
          await note({last: Date.now(), mails: (Number(cur.mails) || 0) + 1});
        } catch (e) {
          const msg = String((e && e.message) || e).slice(0, 200);
          await putJ(k, {...row, error: msg}).catch(() => {});
          await note({last: Date.now(), lastError: {at: Date.now(), to: job.to, slot: job.slot, message: msg}});
        }
      }
    } catch (e) { /* the next look tries again */ }
    finally { busy = false; }
  }

  const actions = {
    /* the heartbeat's way in (.github/workflows/coo-tick.yml): the passes run before every action, this one only
       answers. While the m360 COO is on, the answer carries its pass, with no names: {slot, state, acts, ms} */
    async tick(v, body, req) {
      const c = req && req.coo;
      if (!c) return {ok: true};
      return {ok: true, at: Date.now(), coo: {slot: String(c.slot || ''), state: String(c.state || ''), acts: Number(c.acts) || 0, ms: Number(c.ms) || 0}};
    },
    /* the day's mail ledger, the rows the viewer may see: their own, their reports' down the line, or all for the founder */
    async pmmail(v, body) {
      if (!v) throw new HttpError(401, 'noid');
      const ymd = String((body && body.ymd) || ymdOf(Date.now()));
      if (!YMD.test(ymd)) throw new HttpError(400, 'invalid_argument', 'ymd as YYYY-MM-DD');
      const level = await levelOf(v.uid);
      if (level < LEVEL.interact) throw new HttpError(403, 'invalid_argument');
      const team = (await getJ(docKey('roster/team')).catch(() => null)) || {};
      const members = team.members || {}, founder = await founderOf(team);
      const all = level >= LEVEL.admin;
      const rows = (await ledger(ymd)).filter(r => all || r.to === v.uid || chainOf(members, founder, r.to).indexOf(v.uid) >= 0)
        .map(r => ({to: r.to, slot: r.slot, at: r.at, sent: r.sent || null, failed: !!r.error, keys: r.keys || [], steps: r.steps || []}))
        .sort((a, b) => a.at - b.at);
      return {ymd, rows};
    },
    /* the pass's own health, for the Admin card */
    async pmstatus(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const [ix, mail] = await Promise.all([getJ('x/pm/index').catch(() => null), mailOn()]);
      return {...(ix || {}), mail: !!mail};
    }
  };
  return {run, actions};
}
