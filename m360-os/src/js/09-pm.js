/* module: pm. Personal managers: every manager gets a bot that chases their reports on what the
   manager's own watch already shows (a missed check-in, a missing EOD line, overdue or sent back work,
   a long quiet stretch, a blocker left waiting). The person hears first and gets a window (wait, an
   hour by default) to answer; then the manager hears; whatever the manager leaves for longer than
   carry goes into one note a day to the level above. Voice and chat asks ride the same pipes: the same
   keys, answers, delivery and Home card.

   Everything here is derived. Open, answered, sorted and escalated are worked out again from the data
   on every device, with the same keys, so each page (and the team site's mail pass) reaches the same
   answer. Only the side effects are stored, on each person's own profile (me/<uid>.pm): their answers
   (ack), the first moment a step reached them (told), a manager's bot settings (cfg), the tasks they
   asked their bot to chase (chase) and the asks they sent (asks). Uids, times and codes only: never a
   name, a reason or a line of text. No model ever writes a nudge: the lines are fixed templates (COPY).

   The founder's switch is settings/app.pm.on, off by default. Each kind also obeys its rule: noin R01,
   noeod R04, overdue, sentback and chase R07, quiet and idle R17. Bot items never feed points, the
   ladder, reviews or anything public. */
'use strict';
(function () {
  const {U} = M;
  const MIN = 60000, DAY = 86400000;
  const KEEP_DAYS = 8, KEEP_MAP = 400, KEEP_ASKS = 60, ASK_DAYS = 14;

  /* the kinds, in the order caps are counted in */
  const ORDER = ['noin', 'overdue', 'sentback', 'chase', 'waiton', 'quiet', 'idle', 'noeod', 'noout', 'short', 'late', 'task', 'custom'];
  const KINDS = {
    noin: {rule: 'R01', att: true, esc: true, label: 'missed check-ins'},
    noeod: {rule: 'R04', att: true, esc: true, label: 'missing EOD lines'},
    overdue: {rule: 'R07', task: true, esc: true, label: 'overdue work'},
    sentback: {rule: 'R07', task: true, esc: true, label: 'work sent back'},
    chase: {rule: 'R07', task: true, esc: true, label: 'tasks you ask it to chase'},
    waiton: {esc: true, label: 'blockers left waiting'},
    quiet: {rule: 'R17', att: true, esc: true, label: 'long quiet stretches'},
    idle: {rule: 'R17', att: true, esc: true, label: 'days nothing moved'},
    noout: {att: true, esc: false, label: 'missed check-outs'},
    short: {att: true, esc: false, label: 'short days'},
    late: {att: true, manual: true}, task: {task: true, manual: true}, custom: {manual: true}
  };
  const BOT_KINDS = ['noin', 'noeod', 'overdue', 'sentback', 'chase', 'quiet', 'waiton', 'noout', 'idle', 'short'];
  const TASK_KINDS = new Set(['overdue', 'sentback', 'chase', 'task']);
  const REP_STEPS = new Set(['0', '1', '1b', '1m']);
  const MGR_STEPS = new Set(['2', '2b']);
  const ordOf = k => { const i = ORDER.indexOf(k); return i < 0 ? ORDER.length : i; };

  /* ---------- the policy and each manager's own bot ---------- */
  const DEF = () => (M.SETTINGS_DEFAULTS && M.SETTINGS_DEFAULTS.pm) || {};
  const pMemo = new WeakMap();
  function P(ctx) {
    const s = (ctx && ctx.settings) || {};
    const raw = s.pm && typeof s.pm === 'object' ? s.pm : {};
    if (pMemo.has(raw)) return pMemo.get(raw);
    const d = DEF();
    const num = (v, dv, lo, hi) => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? Math.max(lo, Math.min(hi, Math.round(n))) : dv; };
    const waitMin = num(raw.waitMin, d.waitMin, 15, 240), waitMax = num(raw.waitMax, d.waitMax, waitMin, 480);
    const out = {...d, ...raw,
      kinds: {...(d.kinds || {}), ...(raw.kinds || {})},
      off: {...(d.off || {}), ...(raw.off || {})},
      on: raw.on === true, require: raw.require == null ? d.require !== false : raw.require !== false, mail: raw.mail == null ? d.mail !== false : raw.mail !== false,
      waitMin, waitMax, wait: num(raw.wait, d.wait, waitMin, waitMax), carry: num(raw.carry, d.carry, 30, 600),
      perDay: num(raw.perDay, d.perDay, 0, 20), mgrPerDay: num(raw.mgrPerDay, d.mgrPerDay, 0, 30), quietMax: num(raw.quietMax, d.quietMax, 0, 10),
      askPerDay: num(raw.askPerDay, d.askPerDay, 0, 20), minHours: num(raw.minHours, d.minHours, 0, 12), coachDays: num(raw.coachDays, d.coachDays, 0, 60),
      blockerMins: num(raw.blockerMins, d.blockerMins, 15, 600),
      digestAt: /^\d{1,2}:\d{2}$/.test(String(raw.digestAt || '')) ? raw.digestAt : d.digestAt};
    pMemo.set(raw, out);
    return out;
  }
  const on = ctx => P(ctx).on;
  const meOf = (ctx, u) => (((ctx && ctx.coll && ctx.coll.me) || {}).map || {})[u] || {};
  const pmOf = (ctx, u) => meOf(ctx, u).pm || {};
  const isFounderUid = (ctx, u) => !!u && (u === ctx.founderUid || ((ctx.members || {})[u] || {}).role === 'founder');
  const ruleOn = (ctx, k) => !(KINDS[k] && KINDS[k].rule && ctx.settings && ctx.settings.rules && ctx.settings.rules[KINDS[k].rule] === false);

  /* a manager's bot as it stands on a day: the stricter changes they made wait in cfg.next until its date */
  function cfgOf(ctx, mgr, ymd) {
    const p = P(ctx);
    const c = pmOf(ctx, mgr).cfg || {};
    const day = ymd || U.ymd(new Date(nowOf(ctx)));
    let wait = Number(c.wait) || p.wait;
    let kinds = {...(c.kinds || {})};
    const nx = c.next;
    if (nx && nx.from && day >= nx.from) {
      if (nx.wait) wait = Number(nx.wait) || wait;
      if (nx.kinds) kinds = {...kinds, ...nx.kinds};
    }
    const eff = {};
    for (const k of BOT_KINDS) eff[k] = !!p.kinds[k] && kinds[k] !== false;
    return {on: c.on !== false, kinds: eff, wait: Math.max(p.waitMin, Math.min(p.waitMax, wait)), voice: c.voice === 'brief' ? 'brief' : 'warm',
      mail: c.mail !== false, pause: {...(c.pause || {})}, next: nx || null};
  }
  /* the founder alone switches a manager's bot off (off map); a manager may only when the policy lets them */
  const botOn = (ctx, mgr) => { const p = P(ctx); return !!mgr && p.on && !p.off[mgr] && (p.require || cfgOf(ctx, mgr).on); };
  const managerOf = (ctx, u) => (M.lines ? M.lines.managerOf(ctx, u) : null);
  /* does the bot chase this person on this kind today: the policy, the manager's bot, no pause, the rule */
  function chases(ctx, rep, kind, ymd) {
    const mgr = managerOf(ctx, rep);
    if (!mgr || !botOn(ctx, mgr)) return false;
    const day = ymd || U.ymd(new Date(nowOf(ctx)));
    const c = cfgOf(ctx, mgr, day);
    return !!c.kinds[kind] && !(c.pause[rep] && c.pause[rep] >= day) && ruleOn(ctx, kind);
  }
  const chainOf = (ctx, u) => (M.lines ? M.lines.chainOf(ctx, u) : []);
  const available = (ctx, u, ymd) => !!u && !!ctx.members[u] && ctx.members[u].active !== false && !(ctx.onLeave && ctx.onLeave(u, ymd));
  /* who hears step 2: the manager, or the next one up while they are on leave or gone */
  function managerFor(ctx, rep, ymd) {
    const chain = chainOf(ctx, rep);
    for (const u of chain) if (available(ctx, u, ymd)) return u;
    return chain[0] || null;
  }
  const key = (rep, kind, sub, ymd) => rep + ':' + kind + ':' + (sub || '-') + ':' + ymd;
  const parseKey = K => { const p = String(K || '').split(':'); return {rep: p[0], kind: p[1], sub: p[2], ymd: p[3]}; };
  const nowOf = ctx => Number(ctx && ctx.now) || Date.now();

  /* names: the components hand over the profiles they hold, so the pure engine can write lines */
  const known = {};
  let namesV = 0;
  function learn(profs) {
    for (const id of Object.keys(profs || {})) {
      const n = profs[id] && profs[id].name;
      if (n && known[id] !== n) { known[id] = n; namesV++; }
    }
  }
  const fullName = (ctx, u) => known[u] || meOf(ctx, u).name || ((ctx.members || {})[u] || {}).name || '';
  /* the m360 COO keeps its whole title: "m360 COO", never "m360" */
  const isCoo = u => !!(M.coo && M.coo.isCoo(u));
  const first = (ctx, u) => isCoo(u) ? M.coo.title(ctx) : U.firstName(fullName(ctx, u)) || 'Someone';
  /* the COO's asks count as the founder's while Kaavish has it on and its asks are not switched off */
  const cooAsks = ctx => !!M.coo && M.coo.on(ctx) && M.coo.rung(ctx, 'nudge') !== 'off';
  const botName = (ctx, mgr) => first(ctx, mgr) + "'s bot";

  /* ---------- small reads ---------- */
  const tasksOf = ctx => ((ctx.coll && ctx.coll.tasks) || {}).map || {};
  const open = t => !!t && !t.deleted && t.status !== 'done';
  const dayAt = (ymd, hm) => U.parseYmd(ymd).getTime() + U.minutes(String(hm || '0:00')) * MIN;
  const startOf = (ctx, u, ymd) => dayAt(ymd, ctx.startFor(u) || ctx.settings.start || '10:30');
  const graceMs = ctx => (Number(ctx.settings.grace) || 0) * MIN;
  const cutOf = (ctx, ymd) => dayAt(ymd, ctx.settings.eodCut || '19:30');
  const hm = ms => U.hhmm(ms);
  const prevWorking = (ctx, u, ymd) => {
    let d = U.parseYmd(ymd);
    for (let i = 0; i < 7; i++) { d = U.addDays(d, -1); const s = U.ymd(d); if (ctx.isWorkingDay(s, u)) return s; }
    return null;
  };
  const nextWorking = (ctx, ymd) => {
    let d = U.parseYmd(ymd);
    for (let i = 0; i < 14; i++) { d = U.addDays(d, 1); const s = U.ymd(d); if (ctx.isWorkingDay(s)) return s; }
    return U.ymd(U.addDays(U.parseYmd(ymd), 1));
  };
  /* a leave request with no decision yet that covers the day (a WFH day booked ahead is not leave) */
  function leavePending(ctx, u, ymd) {
    const reqs = ((((ctx.coll.leave || {}).map || {})[u]) || {}).reqs || [];
    const dec = ((((ctx.coll.leavedec || {}).map || {})[u]) || {}).d || {};
    return reqs.some(r => r && r.type !== 'wfh' && r.from && r.to && r.from <= ymd && r.to >= ymd && !(dec[r.id] && dec[r.id].status && dec[r.id].status !== 'pending'));
  }
  /* the first coachDays working days from "joined": the bot tells the person only */
  function coachUntil(ctx, u) {
    const p = P(ctx);
    const j = ((ctx.members || {})[u] || {}).joined;
    if (!p.coachDays || !/^\d{4}-\d{2}-\d{2}$/.test(String(j || ''))) return null;
    let d = U.parseYmd(j), n = 0;
    for (let i = 0; i < 120; i++) {
      const s = U.ymd(d);
      if (ctx.isWorkingDay(s)) { n++; if (n >= p.coachDays) return s; }
      d = U.addDays(d, 1);
    }
    return null;
  }
  /* the told map of one person: positive values rang (a bubble, a notice), negative ones were shown on a
     card or in the inbox without a sound */
  const toldOf = (ctx, u) => pmOf(ctx, u).told || {};
  const toldAt = (ctx, u, id) => { const v = toldOf(ctx, u)[id]; return v ? Math.abs(Number(v)) : 0; };
  /* the newest answer anyone above the person (or the asker) gave on a key: mine, drop, again, answered */
  function mackOf(ctx, rep, K, extra) {
    let best = null;
    const seen = new Set();
    for (const u of chainOf(ctx, rep).concat(extra || [])) {
      if (!u || seen.has(u)) continue;
      seen.add(u);
      const a = (pmOf(ctx, u).ack || {})[K];
      if (a && (!best || (Number(a.at) || 0) > (Number(best.at) || 0))) best = {...a, by: u};
    }
    return best;
  }
  /* an "on it, by <date>" given on an earlier day keeps covering the same thing until the date passes */
  function carriedAck(ctx, rep, kind, sub, ymd) {
    const acks = pmOf(ctx, rep).ack || {};
    const pre = rep + ':' + kind + ':' + (sub || '-') + ':';
    let best = null;
    for (const k of Object.keys(acks)) {
      if (!k.startsWith(pre) || k.slice(pre.length) >= ymd) continue;
      const a = acks[k];
      if (a && a.how === 'onit' && typeof a.eta === 'string' && a.eta >= ymd && (!best || a.at > best.at)) best = a;
    }
    return best;
  }

  /* ---------- the copy (Part E): fixed templates in two voices, filled from the data ---------- */
  const DAYS_S = U.DAYS_S || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dueDay = ymd => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) ? U.fmtDay(ymd) : 'earlier';
  const the = title => 'the ' + String(title || 'task');
  const etaText = eta => typeof eta === 'number' ? hm(eta) : typeof eta === 'string' ? (eta === 'eod' ? 'the end of the day' : U.fmtDay(eta)) : '';
  const COPY = {
    warm: {
      noin: f => 'Morning ' + f.rep + '. No check-in yet, and your day started at ' + f.start + '. Check in when you are set, or tell ' + f.mgr + ' if today is off.',
      noeod0: f => 'Your EOD line is due at ' + f.cut + '. Shipped, next, blocked.',
      noeod: f => 'It is ' + f.cut + " and today's EOD line is not in. Two lines do it: what shipped, what is next.",
      overdue: f => U.cap(the(f.title)) + ' was due ' + f.due + ' and is still open. When will it be in?',
      sentback: f => f.by + ' sent ' + the(f.title) + ' back at ' + f.at + " and it has not moved since. Is it on today's list?",
      chase: f => f.by + ' asked me to check on ' + the(f.title) + '. Where is it at?',
      quiet: f => 'Nothing recorded on m360 since ' + f.from + '. On a shoot or in a meeting? Set a status so ' + f.mgr + ' knows.',
      idle: f => 'None of your ' + f.n + ' open tasks has moved today. Move one, or tell ' + f.mgr + ' what is holding them up.',
      noout: f => 'You are still checked in from ' + f.in + '. Check out when you are done for the day.',
      short: f => 'Your day ran ' + f.dur + ', check-in to check-out. If some of it was off m360, add a line to your EOD.',
      waiton: f => f.r + ' has been blocked on ' + f.what + ' since ' + f.t + ' and is waiting on you. Reply to ' + f.r + ', or ' + f.up + ' hears at ' + f.hears + '.'
    },
    brief: {
      noin: f => 'No check-in yet. Your day started at ' + f.start + '.',
      noeod0: f => 'EOD line due at ' + f.cut + '.',
      noeod: f => "Today's EOD line is not in yet. Due " + f.cut + '.',
      overdue: f => f.title + ': due ' + f.due + ', still open. When will it be in?',
      sentback: f => f.title + ': sent back by ' + f.by + ' at ' + f.at + ', not moved since.',
      chase: f => f.title + ': ' + f.by + ' asked for an update.',
      quiet: f => 'Nothing recorded since ' + f.from + '. Set a status.',
      idle: f => 'No task moved today. ' + f.n + ' open.',
      noout: f => 'Still checked in from ' + f.in + '.',
      short: f => 'Your day ran ' + f.dur + '.',
      waiton: f => f.r + ' is blocked on ' + f.what + ' since ' + f.t + '. ' + f.up + ' hears at ' + f.hears + '.'
    },
    again1b: f => 'It is ' + f.eta + ', the time you gave' + (f.what ? ' for ' + f.what : '') + ', and it is still open. More time, or is something in the way?',
    again1m: f => f.mgr + ' asked me to check again on ' + f.what + '.',
    bundle: (n, bot) => n + ' things from ' + bot,
    away: (n, bot) => 'While you were away, ' + bot + ' left ' + (n === 1 ? '1 thing.' : n + ' things.'),
    mgrBundle: n => 'Your bot: ' + n + (n === 1 ? ' thing it could not settle' : ' things it could not settle'),
    more: n => 'and ' + n + ' more',
    coach: f => 'You joined recently, so these stay between you and the bot until ' + f.until + '.',
    held: 'Your leave request covers today. This waits for the decision.',
    heldOk: 'Your leave for today is approved. Ignore the line about the check-in.',
    ask: {
      head: f => f.by + ' asked m360 to check with you, ' + f.at,
      noout: f => 'You are still checked in from ' + f.in + (f.last ? ', and nothing has been saved since ' + f.last : '') + '. What happened?',
      noin: f => 'No check-in yet today (start ' + f.start + '). All okay?',
      noeod: () => 'No EOD line for today yet. Two lines are enough.',
      overdue: f => "'" + f.title + "' was due " + f.due + '. Where is it at?',
      task: f => "Where is '" + f.title + "' at?",
      quiet: f => 'Nothing recorded on m360 since ' + f.from + '. What are you on?',
      idle: () => 'Nothing moved on your tasks today. Stuck anywhere?',
      late: f => 'You checked in at ' + f.in + ' today. Anything I should know?',
      short: f => 'Your day ran ' + f.dur + '. Anything I should know?',
      custom: f => f.note || 'Can you give me an update?'
    },
    /* the report's coded answers, as they read in the DM and back to whoever asked */
    said: {
      onit: (eta, kind) => kind === 'noin' ? 'Running late, in by ' + etaText(eta) + '.' : kind === 'noeod' && typeof eta === 'number' ? 'Posting my EOD in ' + Math.max(1, Math.round((eta - Date.now()) / MIN)) + ' minutes.' : 'On it.' + (eta ? ' In by ' + etaText(eta) + '.' : ''),
      blocked: () => 'Blocked. The note is in the messages.',
      wrong: () => 'This is not right. A correction is on its way.',
      leave: () => 'Off today. Leave request on its way.',
      reply: () => 'Replied in the messages.'
    },
    back: {
      onit: (r, eta) => r + ': on it' + (eta ? ', in by ' + etaText(eta) : ''),
      blocked: r => r + ': blocked, the note is in your messages',
      wrong: (r, kind) => r + (kind === 'noout' ? ': left earlier, asked for a fix' : ': says this is not right, asked for a fix'),
      leave: r => r + ': off today, a leave request is on its way',
      reply: r => r + ': replied in your messages',
      none: r => 'No answer from ' + r + ' yet. Nudge again, or leave it?'
    },
    admin: 'Every manager gets a bot that chases their reports: a missed check-in, a missing EOD line, overdue or sent back work, a long quiet stretch. Each nudge goes to the person first, then up one level when it gets no answer. The level above that gets one note a day for whatever is still open.',
    handbook: "Your manager's bot reads the same flags your manager sees on Home. It tells you first and gives you an hour. It keeps when a line reached your screen and your answer code, for 8 days, on your own profile. Your typed words go to your manager as a direct message. Answering never counts toward points, reviews or the ladder."
  };

  /* what one item is about, in a few words: "the Swisse reel cutdown", "your check-in" */
  function whatOf(ctx, kind, sub, extra) {
    if (TASK_KINDS.has(kind)) return the((tasksOf(ctx)[sub] || {}).title);
    if (kind === 'waiton') return extra && extra.what ? extra.what : 'a blocker';
    return {noin: 'the check-in', noeod: 'the EOD line', noout: 'the check-out', quiet: 'the quiet stretch', idle: 'the open tasks', short: 'the short day', late: 'the late check-in', custom: 'the question'}[kind] || 'this';
  }
  /* the short label the hello and the digest read: "no check-in yet", "the Swisse reel cutdown" */
  function labelOf(ctx, it) {
    if (TASK_KINDS.has(it.kind)) return String((tasksOf(ctx)[it.sub] || {}).title || 'a task');
    const y = it.ymd < U.ymd(new Date(nowOf(ctx)));
    return {noin: 'no check-in yet', noeod: y ? 'no EOD line yesterday' : 'no EOD line yet', noout: 'still checked in', quiet: 'a quiet stretch', idle: 'nothing moved today', short: 'a short day', late: 'a late check-in', waiton: 'a blocker waiting on you', custom: 'a question'}[it.kind] || 'one thing';
  }

  /* ---------- items: everything about one person today ---------- */
  const memo = new WeakMap();
  function memoGet(ctx, k, fn) {
    let m = memo.get(ctx);
    if (!m) { m = new Map(); memo.set(ctx, m); }
    const mk = k + '|' + namesV;
    if (m.has(mk)) return m.get(mk);
    if (m.size > 600) m.clear();
    const v = fn();
    m.set(mk, v);
    return v;
  }
  const LOADS = ['me', 'checkin', 'eod', 'tasks', 'leave', 'leavedec', 'feed', 'kudos'];
  const loaded = ctx => !!ctx && !!ctx.coll && !!ctx.settings && !!ctx.members && LOADS.every(k => !ctx.coll[k] || ctx.coll[k].ready !== false);

  function items(ctx, rep, opts) {
    const now = Math.floor((Number(opts && opts.now) || nowOf(ctx)) / MIN) * MIN;
    if (!ctx || !rep || !loaded(ctx)) return [];
    return memoGet(ctx, 'i|' + rep + '|' + now, () => build(ctx, rep, now, new Set()));
  }

  function build(ctx, rep, now, visiting) {
    if (visiting.has(rep)) return [];
    visiting.add(rep);
    const ymd = U.ymd(new Date(now));
    const m = ctx.members[rep];
    if (!m || m.active === false) return [];
    if (m.joined && /^\d{4}-\d{2}-\d{2}$/.test(m.joined) && m.joined > ymd) return [];
    const p = P(ctx);
    const out = [];
    const mgr = managerOf(ctx, rep);
    const working = ctx.isWorkingDay(ymd, rep);
    const held = leavePending(ctx, rep, ymd);
    const coach = coachUntil(ctx, rep);
    const inCoach = !!coach && ymd < coach;
    const mine = pmOf(ctx, rep);
    const acks = mine.ack || {};
    const d0 = U.parseYmd(ymd).getTime();
    const start = startOf(ctx, rep, ymd) + graceMs(ctx);
    const cut = cutOf(ctx, ymd);
    const a = M.att ? M.att.dayStatus(ctx, rep, ymd) : {status: 'none'};
    const tmap = tasksOf(ctx);
    const cfg = mgr ? cfgOf(ctx, mgr, ymd) : null;
    const bot = p.on && !!mgr && botOn(ctx, mgr) && !(cfg.pause[rep] && cfg.pause[rep] >= ymd);
    const kindOn = k => !!cfg && cfg.kinds[k] && ruleOn(ctx, k);
    const flags = working ? M.lines.watch(ctx, rep, now) : [];
    const flag = k => flags.find(f => f.k === k);
    const wait = cfg ? cfg.wait : p.wait;

    /* one item, its ladder worked out */
    const add = (o) => {
      const K = key(rep, o.kind, o.sub, o.ymd || ymd);
      let it = out.find(x => x.K === K);
      if (it && o.ask) { it.asks.push(o.ask); return it; }
      if (it) return it;
      it = {K, rep, kind: o.kind, sub: o.sub || '-', ymd: o.ymd || ymd, source: o.source, from: o.from || mgr, askId: o.ask ? o.ask.id : undefined,
        asks: o.ask ? [o.ask] : [], s1: o.s1, s0: o.s0, holds: o.holds !== false, sortedAt: o.sortedAt || null, facts: o.facts || {}, flag: o.flag || null, mgr, sweep: !!o.sweep};
      out.push(it);
      return it;
    };

    if (p.on && working) {
      /* attendance, from the watch (the same flags the manager reads) and the data that resolves them */
      if (bot && kindOn('noin')) {
        const f = flag('noin');
        if (f) add({kind: 'noin', source: 'bot', s1: start, flag: f, facts: {start: ctx.startFor(rep)}});
        else if (a.in && a.in > start) add({kind: 'noin', source: 'bot', s1: start, holds: false, sortedAt: a.in, facts: {start: ctx.startFor(rep)}});
      }
      if (bot && kindOn('noeod')) {
        const eod = (((ctx.coll.eod.map[rep] || {}).days) || {})[ymd];
        const s0 = cut - 30 * MIN;
        if (now >= s0) {
          if (!eod) add({kind: 'noeod', source: 'bot', s0, s1: cut, flag: flag('noeod'), facts: {cut: ctx.settings.eodCut || '19:30'}});
          else if ((Number(eod.at) || 0) > s0) add({kind: 'noeod', source: 'bot', s0, s1: cut, holds: false, sortedAt: Number(eod.at), facts: {cut: ctx.settings.eodCut || '19:30'}});
        }
      }
      if (bot && kindOn('noout')) {
        const f = flag('noout');
        if (f) add({kind: 'noout', source: 'bot', s1: f.at, flag: f, facts: {in: hm(a.in)}});
        else if (a.in && a.out && a.out > cut + 60 * MIN) add({kind: 'noout', source: 'bot', s1: cut + 60 * MIN, holds: false, sortedAt: a.out, facts: {in: hm(a.in)}});
      }
      if (bot && kindOn('idle')) {
        const f = flag('idle');
        const n = Object.keys(tmap).filter(id => tmap[id] && tmap[id].owner === rep && open(tmap[id])).length;
        if (f) add({kind: 'idle', source: 'bot', s1: f.at, flag: f, facts: {n}});
      }
      if (bot && kindOn('quiet')) {
        const st = meOf(ctx, rep).status;
        for (const f of flags.filter(x => x.k === 'quiet')) {
          const sub = String(f.key || '').replace(/^quiet/, '');
          const covered = st && st.at && st.at > f.from && U.ymd(new Date(st.at)) === ymd;
          if (f.live) add({kind: 'quiet', sub, source: 'bot', s0: Math.max(f.from + 30 * MIN, f.at - 30 * MIN), s1: f.at, flag: f, facts: {from: hm(f.from), status: covered ? st : null}});
          else if (f.at <= now) add({kind: 'quiet', sub, source: 'bot', s0: Math.max(f.from + 30 * MIN, f.at - 30 * MIN), s1: f.at, holds: false, sortedAt: f.to || f.at, flag: f, facts: {from: hm(f.from)}});
        }
      }
      if (bot && kindOn('short') && p.minHours > 0 && a.in && a.out && a.out - a.in < p.minHours * 60 * MIN) {
        add({kind: 'short', source: 'bot', s1: a.out, facts: {dur: U.durText(a.out - a.in).replace(' 0', ' ').replace(/^0h /, '')}});
      }

      /* work: one item per overdue task, sent back work that has not moved, and chases from up the line */
      const R07 = ruleOn(ctx, 'overdue');
      for (const id of Object.keys(tmap)) {
        const t = tmap[id];
        if (!t || t.owner !== rep || t.deleted) continue;
        if (bot && R07 && kindOn('overdue')) {
          if (open(t) && t.due && t.due < ymd) add({kind: 'overdue', sub: id, source: 'bot', s1: start + 30 * MIN, facts: {title: t.title, due: dueDay(t.due), days: U.daysBetween(t.due, ymd)}});
          else if (t.status === 'done' && t.due && t.due < ymd && t.doneAt && U.ymd(new Date(t.doneAt)) === ymd && t.doneAt > start + 30 * MIN) add({kind: 'overdue', sub: id, source: 'bot', s1: start + 30 * MIN, holds: false, sortedAt: t.doneAt, facts: {title: t.title, due: dueDay(t.due)}});
        }
        if (bot && R07 && kindOn('sentback') && t.sentBackAt && t.sentBackBy && t.sentBackBy !== rep) {
          const sb = Number(t.sentBackAt);
          const sbDay = U.ymd(new Date(sb));
          /* four hours after it came back; sent back late in the day, it waits for the next working day */
          const s1 = sbDay < ymd ? start + 30 * MIN : sb + 240 * MIN > cut - 30 * MIN ? Infinity : sb + 240 * MIN;
          const still = (t.status === 'todo' || t.status === 'doing') && (Number(t.updated) || 0) <= sb + 60000;
          const facts = {title: t.title, by: t.sentBackBy, at: hm(sb)};
          if (s1 !== Infinity && still) add({kind: 'sentback', sub: id, source: 'bot', s1, facts});
          else if (s1 !== Infinity && !still && (Number(t.updated) || 0) > s1 && U.ymd(new Date(Number(t.updated))) === ymd) add({kind: 'sentback', sub: id, source: 'bot', s1, holds: false, sortedAt: Number(t.updated), facts});
        }
        if (bot && R07 && kindOn('chase') && open(t)) {
          for (const x of chainOf(ctx, rep)) {
            const c = (pmOf(ctx, x).chase || {})[id];
            if (!c || !c.at) continue;
            const s1 = U.ymd(new Date(c.at)) === ymd ? Number(c.at) + 5 * MIN : start + 30 * MIN;
            add({kind: 'chase', sub: id, source: 'chase', from: x, s1, facts: {title: t.title, by: x}});
            break;
          }
        }
      }
    }

    /* the chain upward: a report's "blocked" this person has not answered reaches this person from
       their own manager's bot */
    if (p.on && working && mgr && botOn(ctx, mgr) && ruleOn(ctx, 'waiton') && cfg.kinds.waiton) {
      for (const r of (M.lines.reportsOf(ctx, rep) || [])) {
        for (const ri of build(ctx, r, now, visiting)) {
          const ra = ri.ack;
          if (!ra || ra.how !== 'blocked' || ri.ymd !== ymd || ri.kind === 'waiton') continue;
          const t = Number(ra.at) || 0;
          const answered = (() => {
            const own = (acks || {})[ri.K];
            if (own && (own.how === 'mine' || own.how === 'answered' || own.how === 'drop')) return true;
            if (M.rooms && ctx.coll.chat) return M.rooms.messagesOf(ctx, M.rooms.dmId(rep, r)).some(x => x.by === rep && (x.at || 0) > t);
            return false;
          })();
          const sub = r + '.' + ri.kind + '.' + ri.sub;
          const s1 = t + p.blockerMins * MIN;
          const what = whatOf(ctx, ri.kind, ri.sub);
          add({kind: 'waiton', sub, source: 'waiton', from: mgr, s1, holds: !answered, sortedAt: answered ? t : null, facts: {r, what, t: hm(t), blockedK: ri.K}});
        }
      }
    }

    /* yesterday's missing EOD line reaches the manager next morning, once */
    if (p.on && working && bot && kindOn('noeod') && mgr) {
      const y = prevWorking(ctx, rep, ymd);
      if (y && !(m.joined && m.joined > y)) {
        const yflags = M.lines.watch(ctx, rep, cutOf(ctx, y) + 90 * MIN);
        const to = managerFor(ctx, rep, ymd);
        if (yflags.some(f => f.k === 'noeod') && to && ctx.isWorkingDay(ymd, to)) {
          add({kind: 'noeod', ymd: y, source: 'bot', sweep: true, s1: startOf(ctx, to, ymd) + graceMs(ctx), facts: {day: U.fmtDay(y)}});
        }
      }
    }

    /* manual asks addressed to this person, from whoever may ask them: the founder, anyone up their line,
       and for attendance their own manager. Anyone can write their own profile, so the record alone
       proves nothing; an ask past those rights never shows or rings */
    const upLine = chainOf(ctx, rep);
    for (const x of Object.keys(ctx.coll.me.map || {})) {
      if (x === rep) continue;
      const fx = isFounderUid(ctx, x) || (isCoo(x) && cooAsks(ctx));
      if (!fx && upLine.indexOf(x) < 0) continue;
      const asks = pmOf(ctx, x).asks || {};
      for (const id of Object.keys(asks)) {
        const ak = asks[id];
        if (!ak || ak.withdrawn || !Array.isArray(ak.to) || ak.to.indexOf(rep) < 0) continue;
        const at = Number(ak.showAt) || Number(ak.at) || 0;
        if (!at || U.ymd(new Date(at)) !== ymd || at > now) continue;
        const kind = KINDS[ak.kind] ? ak.kind : 'custom';
        if (KINDS[kind].att && !fx && mgr !== x) continue;
        let sub = '-', holds = true, facts = {};
        if (kind === 'overdue' || kind === 'task') {
          const t = tmap[ak.sub];
          if (!t) continue;
          sub = ak.sub;
          facts = {title: t.title, due: dueDay(t.due)};
          holds = open(t) && (kind === 'task' || (t.due && t.due < ymd));
          if (kind === 'overdue' && !holds && !(t.status === 'done')) continue;
        } else if (kind === 'custom') {
          sub = id;
        } else if (kind === 'quiet') {
          const f = flags.find(z => z.k === 'quiet' && z.live);
          if (!f) continue;
          sub = String(f.key || '').replace(/^quiet/, '');
          facts = {from: hm(f.from)};
        } else if (kind === 'late') {
          if (!(a.in && a.late)) continue;
          facts = {in: hm(a.in)};
        } else if (kind === 'short') {
          if (!(a.in && a.out)) continue;
          facts = {dur: U.durText(a.out - a.in)};
        } else {
          /* a condition ask shows only while the condition holds for this person right now */
          if (!working || !flags.some(f => f.k === kind)) continue;
          if (kind === 'noout') facts = {in: hm(a.in), last: lastSave(ctx, rep, ymd)};
          if (kind === 'noin') facts = {start: ctx.startFor(rep)};
        }
        add({kind, sub, source: 'ask', from: x, s1: at, holds, facts, ask: {id, by: x, at: Number(ak.at) || at, via: ak.via || 'typed', ask: ak.ask || 'why', tellBy: ak.tellBy || null, ringNow: !!ak.ringNow && fx && !isCoo(x), note: !!ak.note,
          code: isCoo(x) && ak.code ? String(ak.code) : '', args: isCoo(x) && ak.args ? ak.args : null}});
      }
    }

    for (const it of out) ladder(ctx, it, {now, ymd: it.ymd, held, inCoach, coach, wait, acks, mgr});
    out.sort((x, y) => (x.s1 || 0) - (y.s1 || 0) || ordOf(x.kind) - ordOf(y.kind));
    return out;
  }

  /* the last moment the person saved anything today, from their stamps: "17:40" */
  function lastSave(ctx, u, ymd) {
    const act = ((meOf(ctx, u).act || {})[ymd]) || {};
    const b = Object.keys(act).filter(k => /^\d{4}$/.test(k) && act[k] === 1).sort().pop();
    return b ? b.slice(0, 2) + ':' + b.slice(2) : '';
  }

  /* ---------- the ladder for one key (C5) ---------- */
  function ladder(ctx, it, o) {
    const p = P(ctx);
    const {now} = o;
    const rep = it.rep, K = it.K;
    const today = U.ymd(new Date(now));
    const ack = (o.acks || {})[K] || (TASK_KINDS.has(it.kind) ? carriedAck(ctx, rep, it.kind, it.sub, it.ymd) : null);
    const mack = mackOf(ctx, rep, K, it.asks.map(a => a.by));
    it.ack = ack || undefined;
    it.mack = mack || undefined;
    const to2 = managerFor(ctx, rep, today);
    const wait = (it.kind === 'waiton' && it.from ? cfgOf(ctx, it.from, it.ymd).wait : o.wait) * MIN;
    const how = ack && ack.how;
    const etaMs = ack && how === 'onit' && typeof ack.eta === 'number' ? ack.eta : null;
    const etaDay = ack && how === 'onit' && typeof ack.eta === 'string' ? ack.eta : null;
    const status = it.kind === 'quiet' && it.facts.status;
    const letgo = !!(mack && mack.how === 'drop' && (!mack.until || mack.until >= today));
    const mineM = !!(mack && mack.how === 'mine');
    /* the person's answer covers the step to the manager: an eta still ahead, a date for task work, a
       reply today, leave, a dispute; a status covers a quiet stretch. Blocked brings the manager in at once */
    const covered = !!status || how === 'wrong' || how === 'leave' || how === 'reply' ||
      (how === 'onit' && (etaMs != null || (etaDay && (etaDay >= today || etaDay === 'eod'))));
    it.state = (o.held || how === 'leave') ? 'held' : !it.holds ? 'sorted' : letgo ? 'letgo' : how === 'wrong' ? 'disputed' : (ack || status) ? 'answered' : 'open';
    it.coach = !!o.inCoach;
    it.coachUntil = o.coach || null;
    it.status = status || undefined;
    const steps = [];
    const st = (id, step, to, at, skip) => {
      const t = to ? toldAt(ctx, to, id) : 0;
      const s = {id, step, to, at, state: t ? 'told' : skip ? 'skipped' : at > now ? 'waiting' : 'due'};
      if (t) s.told = t;
      steps.push(s);
      return s;
    };
    const off = it.state === 'sorted' || it.state === 'held' || it.state === 'letgo';
    const after = (x, t) => x && (Number(x.at) || 0) >= t;

    if (it.source === 'ask') {
      /* an ask alone: no ladder, the answers go back to whoever asked */
    } else if (it.sweep) {
      /* yesterday's EOD line: straight to the manager at their start */
      st(K + '#2', '2', to2, it.s1, off || covered || mineM || it.coach || !to2);
    } else {
      if (it.s0 != null) st(K + '#0', '0', rep, it.s0, off || !!ack || !!status);
      /* answered before it came due (from the card's heads-up, or an ask): nothing to tell */
      st(K + '#1', '1', rep, it.s1, off || (!!ack && (Number(ack.at) || 0) <= it.s1) || !!status);
      const blocked = how === 'blocked';
      /* "on it, in by 16:00" and the flag still holds at 16:00: one follow-up then */
      let s1b = null;
      if (etaMs != null) s1b = st(K + '#1b', '1b', rep, etaMs, off || blocked);
      if (mack && mack.again) st(K + '#1m', '1m', rep, Number(mack.again), off || blocked || after(ack, Number(mack.again)));
      const esc = KINDS[it.kind] && KINDS[it.kind].esc && !(it.kind === 'noeod');
      if (esc && to2) {
        const at2 = blocked ? Number(ack.at) : it.s1 + wait;
        st(K + '#2', '2', to2, at2, off || (covered && !blocked) || mineM || it.coach);
        if (s1b) {
          const at2b = etaMs + Math.max(30 * MIN, wait / 2);
          st(K + '#2b', '2b', to2, at2b, off || mineM || it.coach || after(ack, etaMs + 1));
        }
      }
    }
    for (const ak of it.asks) st(K + '#a.' + ak.id, 'a.' + ak.id, rep, Math.max(it.source === 'ask' ? it.s1 : 0, Number(ak.at) || 0), off || !!(ack && (Number(ack.at) || 0) >= ak.at));
    it.steps = steps;
    const s2 = steps.find(s => s.step === '2' || s.step === '2b');
    it.hearsAt = s2 && s2.state === 'waiting' ? s2.at : undefined;
    it.toldMgrAt = s2 && s2.told ? s2.told : undefined;
    it.mgrDueAt = s2 && (s2.state === 'due' || s2.state === 'told') ? s2.at : undefined;
    it.to2 = to2;
    it.away = !!(it.mgr && to2 && to2 !== it.mgr);
    words(ctx, it, now);
  }

  /* the lines for one item: the person's, the manager's, "Why this", the primary action and the chips */
  function words(ctx, it, now) {
    const kind = it.kind;
    const bot = it.from || it.mgr;
    const voice = it.mgr ? cfgOf(ctx, it.mgr, it.ymd).voice : 'warm';
    const V = COPY[voice] || COPY.warm;
    const f = {...it.facts, rep: first(ctx, it.rep), mgr: first(ctx, it.mgr), title: it.facts.title || ''};
    if (f.by) f.by = first(ctx, f.by);
    if (f.r) f.r = first(ctx, f.r);
    const t = tasksOf(ctx)[it.sub];
    const what = whatOf(ctx, kind, it.sub, it.facts);
    if (it.source === 'ask') {
      const ak = it.asks[0];
      const A = COPY.ask;
      const g = {...f, by: first(ctx, ak.by), at: hm(ak.at)};
      it.head = isCoo(ak.by) ? first(ctx, ak.by) + ', ' + g.at : A.head(g);
      it.line = (isCoo(ak.by) && ak.code ? M.coo.copy(ak.code, ak.args || {}, 'dm', ctx).line : '') || (A[kind] || A.custom)(g);
      it.botName = first(ctx, ak.by);
      it.why = first(ctx, ak.by) + ' asked ' + (ak.via === 'voice' ? 'by voice' : ak.via === 'button' ? 'with a button' : ak.via === 'coo' ? 'on its round' : 'in m360') + ' at ' + hm(ak.at) + '.';
    } else {
      it.botName = botName(ctx, bot);
      if (it.sweep) it.line = 'No EOD line for ' + f.day + '. Post it when you can.';
      else if (kind === 'waiton') {
        const up = managerFor(ctx, it.rep, U.ymd(new Date(now)));
        it.line = V.waiton({...f, up: up ? first(ctx, up) : 'the level above', hears: hm(it.s1 + cfgOf(ctx, bot, it.ymd).wait * MIN)});
      } else it.line = (V[kind] || COPY.warm[kind] || (() => ''))(f);
      it.line0 = kind === 'noeod' ? V.noeod0(f) : kind === 'quiet' ? 'Nothing saved since ' + f.from + '. Move a task, post what you are on, or set a status.' : '';
      it.why = it.flag ? f.rep + ' ' + it.flag.text + '.' : TASK_KINDS.has(kind) && t ? (kind === 'overdue' ? 'Due ' + dueDay(t.due) + ', still open.' : kind === 'sentback' ? 'Sent back by ' + f.by + ' at ' + f.at + ', not moved since.' : f.by + ' asked the bot to chase it.')
        : kind === 'waiton' ? f.r + ' answered "blocked" at ' + f.t + ' and nothing has come back since.' : '';
    }
    it.what = what;
    it.label = labelOf(ctx, it);
    /* the manager's line, about the person by name, never a pronoun */
    const r = first(ctx, it.rep);
    const ack = it.ack, how = ack && ack.how;
    const nudged = (it.steps.find(s => s.step === '1') || {});
    if (how === 'blocked') it.mgrLine = r + ' is blocked on ' + what + '. The note is in your messages.';
    else if (how === 'wrong') it.mgrLine = r + ' says this is not right and asked for a correction.';
    else if (how === 'onit' && typeof ack.eta === 'number' && ack.eta < now && it.holds) it.mgrLine = r + ' said ' + hm(ack.eta) + ' for ' + what + '. It is ' + hm(now) + ' and it is still open.';
    else if (how === 'onit') it.mgrLine = r + ' is on ' + what + (ack.eta ? ', by ' + etaText(ack.eta) : '') + '.';
    else if (how === 'reply') it.mgrLine = r + ' replied about ' + what + '. It is in your messages.';
    else if (how === 'leave') it.mgrLine = r + ' is off today. A leave request is on its way.';
    else if (it.status) it.mgrLine = r + ' set a status: ' + String(it.status.text || '').slice(0, 80) + '.';
    else if (it.sweep) it.mgrLine = 'From yesterday: no EOD line from ' + r + ' for ' + f.day + '.';
    else if (kind === 'noin') it.mgrLine = r + (Object.keys((meOf(ctx, it.rep).act || {})[it.ymd] || {}).length ? ' has m360 open and has not checked in.' : ' has not opened m360 today.') + ' No check-in since the ' + (f.start || ctx.startFor(it.rep)) + ' start.' + (nudged.told ? ' Nudged at ' + hm(nudged.told) + '.' : '');
    else if (nudged.told) it.mgrLine = r + ' saw the nudge about ' + what + ' at ' + hm(nudged.told) + ' and has not answered.' + (kind === 'overdue' && it.facts.days ? ' It is ' + it.facts.days + (it.facts.days === 1 ? ' day' : ' days') + ' overdue.' : '');
    else if (kind === 'waiton') it.mgrLine = first(ctx, it.facts.r) + ' has been blocked on ' + what + ' since ' + f.t + ', waiting on ' + r + '.';
    else it.mgrLine = r + ': ' + (it.flag ? it.flag.text : what + (kind === 'overdue' ? ', due ' + f.due : '')) + '.';
    if (it.away) it.mgrLine += ' ' + first(ctx, it.mgr) + ' is on leave today.';
    it.copyText = 'Hi ' + r + ', ' + (TASK_KINDS.has(kind) && t ? the(t.title) + (t.due ? ' was due ' + dueDay(t.due) + ' and' : '') + ' m360 still shows it open. When will it be in?'
      : kind === 'noin' ? 'm360 shows no check-in yet today. All okay?' : kind === 'noeod' ? "m360 shows no EOD line yet. Two lines are enough." : kind === 'noout' ? 'm360 still shows you checked in. All done for the day?'
      : kind === 'quiet' ? 'nothing on m360 since ' + f.from + '. What are you on?' : 'can you give me an update on ' + what + '?') + ' ' + first(ctx, it.mgr);
    const dm = M.rooms ? M.rooms.dmId(it.rep, it.source === 'ask' ? it.asks[0].by : (it.kind === 'waiton' ? it.facts.r : it.mgr || it.rep)) : '';
    it.primary = TASK_KINDS.has(kind) ? {label: 'Open the task', href: '#tasks/' + it.sub}
      : kind === 'noin' ? {label: 'Check in', act: 'checkin'} : kind === 'noeod' ? {label: 'Post EOD line', act: 'eod'}
      : kind === 'noout' || kind === 'short' ? {label: 'Check out', act: 'checkin'} : kind === 'quiet' || kind === 'late' ? {label: 'Set a status', act: 'status'}
      : kind === 'idle' ? {label: 'Open the board', href: '#tasks'} : kind === 'waiton' ? {label: 'Message ' + first(ctx, it.facts.r), href: '#chat/' + dm} : {label: 'Reply', href: '#chat/' + dm};
    it.dm = dm;
    it.chips = TASK_KINDS.has(kind) ? ['onit', 'blocked', 'reply'] : kind === 'noin' ? ['late', 'leave', 'wrong', 'reply'] : kind === 'noeod' ? ['soon', 'wrong', 'reply']
      : kind === 'quiet' ? ['status', 'wrong', 'reply'] : kind === 'idle' ? ['onit', 'blocked', 'reply'] : kind === 'noout' ? ['wrong', 'onit', 'status', 'reply']
      : kind === 'short' || kind === 'late' ? ['wrong', 'reply'] : kind === 'waiton' ? ['reply'] : ['onit', 'reply'];
    if (it.sweep) it.chips = ['wrong', 'reply'];
  }

  /* ---------- who the viewer hears from, and when it may interrupt (C6) ---------- */
  function window_(ctx, u, now) {
    const ymd = U.ymd(new Date(now));
    if (!ctx.isWorkingDay(ymd, u)) return {ok: false, why: 'day'};
    const s = startOf(ctx, u, ymd), c = cutOf(ctx, ymd);
    if (now < s - 30 * MIN || now > c + 90 * MIN) return {ok: false, why: 'hours'};
    const S = ctx.settings;
    const ok = x => /^\d{1,2}:\d{2}$/.test(String(x || ''));
    if (ok(S.lunchFrom) && ok(S.lunchTo)) { const lf = dayAt(ymd, S.lunchFrom), lt = dayAt(ymd, S.lunchTo); if (lt > lf && now >= lf && now < lt) return {ok: false, why: 'lunch'}; }
    const a = M.att ? M.att.dayStatus(ctx, u, ymd) : {};
    return {ok: true, in: a.in || null, out: a.out || null};
  }
  function inWindow(ctx, u, now, x) {
    const w = window_(ctx, u, now);
    if (!w.ok) return false;
    if (w.out && !(x.item && x.item.kind === 'short' && now - w.out <= 10 * MIN)) return false;
    if (!w.in && !(x.item && x.item.kind === 'noin' && (REP_STEPS.has(x.step) || x.step.startsWith('a.')))) return false;
    return true;
  }
  const focusOn = () => { try { return !!(M.focus && M.focus.get && M.focus.get() && (!M.focus.left || M.focus.left() > 0)); } catch (e) { return false; } };

  /* every member whose step 2 can reach u: anyone with u up their chain */
  const below = (ctx, u) => (ctx.activeMembers || []).filter(m => m.uid !== u && chainOf(ctx, m.uid).indexOf(u) >= 0).map(m => m.uid);

  function forMe(ctx, opts) {
    const now = Math.floor((Number(opts && opts.now) || nowOf(ctx)) / MIN) * MIN;
    if (!ctx || !ctx.uid || !loaded(ctx)) return [];
    return memoGet(ctx, 'f|' + ctx.uid + '|' + now + '|' + (focusOn() ? 1 : 0), () => mine(ctx, now));
  }
  function mine(ctx, now) {
    const me = ctx.uid, p = P(ctx);
    const ymd = U.ymd(new Date(now));
    const out = [];
    const push = (it, s) => { if (s.to === me && (s.state === 'due' || s.state === 'told')) out.push({stepId: s.id, item: it, step: s.step, at: s.at, told: s.told || toldAt(ctx, me, s.id) || 0}); };
    for (const it of items(ctx, me, {now})) for (const s of it.steps) if (REP_STEPS.has(s.step) || s.step.startsWith('a.')) push(it, s);
    for (const r of below(ctx, me)) for (const it of items(ctx, r, {now})) for (const s of it.steps) if (MGR_STEPS.has(s.step)) push(it, s);
    /* the note up the line */
    const dg = digest(ctx, me, ymd, now);
    if (dg && dg.rows.length && now >= dg.at) out.push({stepId: dg.id, item: {K: dg.id, kind: 'digest', rep: me, line: dg.text, mgrLine: dg.text, label: dg.text, ref: dg.ref, digest: dg, source: 'digest', state: 'open', steps: []}, step: 'digest', at: dg.at, told: toldAt(ctx, me, dg.id)});
    /* answers to the asks the viewer sent, and the ones still waiting at tellBy */
    for (const s of sent(ctx, now)) {
      if (s.withdrawn) continue;
      for (const row of s.rows) {
        if (row.how) {
          const id = 'r:' + s.askId + ':' + row.uid + ':' + row.how;
          out.push({stepId: id, item: {K: row.K, kind: 'answer', rep: row.uid, line: row.text, label: row.text, ref: '#chat/' + (M.rooms ? M.rooms.dmId(me, row.uid) : ''), source: 'answer', state: 'answered', steps: [], ask: s}, step: 'r', at: row.at, told: toldAt(ctx, me, id)});
        } else if (s.tellBy && now >= s.tellBy && !row.sorted) {
          const id = 't:' + s.askId + ':' + row.uid;
          out.push({stepId: id, item: {K: row.K, kind: 'noanswer', rep: row.uid, line: COPY.back.none(first(ctx, row.uid)), label: COPY.back.none(first(ctx, row.uid)), ref: '#chat/' + (M.rooms ? M.rooms.dmId(me, row.uid) : ''), source: 'answer', state: 'open', steps: [], ask: s}, step: 't', at: s.tellBy, told: toldAt(ctx, me, id)});
        }
      }
    }
    /* the budget: the same set rings on every device, sorted by time then kind */
    const pick = (list, n) => new Set(list.slice().sort((x, y) => x.at - y.at || ordOf(x.item.kind) - ordOf(y.item.kind) || (x.stepId < y.stepId ? -1 : 1)).slice(0, n).map(x => x.stepId));
    const autoRep = out.filter(x => REP_STEPS.has(x.step) && x.step !== '0' && x.item.kind !== 'quiet');
    const quietRep = out.filter(x => REP_STEPS.has(x.step) && x.step !== '0' && x.item.kind === 'quiet');
    const okSet = new Set([...pick(autoRep, p.perDay), ...pick(quietRep, Math.min(p.quietMax, p.perDay)),
      ...pick(out.filter(x => MGR_STEPS.has(x.step)), p.mgrPerDay), ...pick(out.filter(x => x.step.startsWith('a.')), p.askPerDay),
      ...pick(out.filter(x => x.step === 'digest'), 1), ...out.filter(x => x.step === 'r' || x.step === 't').map(x => x.stepId)]);
    const focus = focusOn();
    for (const x of out) {
      const ringNow = x.step.startsWith('a.') && x.item.asks.some(a => a.ringNow && isFounderUid(ctx, a.by) && x.step === 'a.' + a.id);
      /* a blocked answer comes with its note as a direct message, which already rang through the chat
         watcher: the manager's step 2 lists it, silently */
      const chatRang = MGR_STEPS.has(x.step) && x.item.ack && x.item.ack.how === 'blocked' && !!M.rooms && !!ctx.coll.chat &&
        M.rooms.messagesOf(ctx, M.rooms.dmId(x.item.rep, me)).some(m => m.by === x.item.rep && m.pm === x.item.K);
      const win = ringNow || inWindow(ctx, me, now, x);
      x.inBudget = okSet.has(x.stepId);
      x.held = focus && win && x.inBudget && !x.told;
      x.ring = !x.told && x.step !== '0' && x.inBudget && win && !focus && x.item.state !== 'sorted' && !chatRang;
      x.chat = chatRang;
      x.now = ringNow;
      x.bundle = null;
    }
    out.sort((x, y) => x.at - y.at || ordOf(x.item.kind) - ordOf(y.item.kind));
    return out;
  }

  /* ---------- the daily note up the line (step 3) ---------- */
  function digest(ctx, g, ymd, nowArg) {
    const now = Number(nowArg) || nowOf(ctx);
    const p = P(ctx);
    if (!p.on || !g || !ctx.members[g]) return null;
    const day = ymd || U.ymd(new Date(now));
    const at = dayAt(day, p.digestAt);
    const mgrs = (M.lines.reportsOf(ctx, g) || []).filter(m => M.lines.isManager(ctx, m) && m !== g);
    if (!mgrs.length) return null;
    const founder = g === ctx.founderUid;
    const rows = [];
    const when = Math.min(now, at);
    for (const r of below(ctx, g)) {
      if (r === g) continue;
      for (const it of items(ctx, r, {now: when})) {
        const s2 = it.steps.find(s => s.step === '2' || s.step === '2b');
        if (!s2 || mgrs.indexOf(s2.to) < 0 || !(s2.state === 'due' || s2.state === 'told')) continue;
        if (s2.at + p.carry * MIN > at) continue;
        if (it.state !== 'open' && it.state !== 'answered') continue;
        if (it.mack && (it.mack.how === 'mine' || it.mack.how === 'drop')) continue;
        if (!founder && !(TASK_KINDS.has(it.kind) || it.kind === 'waiton')) continue;
        rows.push({item: it, mgr: s2.to, since: s2.told || s2.at});
      }
    }
    const id = 'digest:' + g + ':' + day;
    const ms = Array.from(new Set(rows.map(x => x.mgr)));
    const head = rows.length + (rows.length === 1 ? ' thing on ' : ' things on ') + (ms.length === 1 ? first(ctx, ms[0]) + "'s team" : 'your teams') + (rows.length === 1 ? ' is still open.' : ' are still open.');
    const tail = rows.slice(0, 3).map(x => first(ctx, x.item.rep) + ': ' + x.item.label + (x.item.kind === 'overdue' && x.item.facts.days ? ', ' + x.item.facts.days + (x.item.facts.days === 1 ? ' day' : ' days') + ' overdue' : x.item.kind === 'sentback' ? ', sent back ' + x.item.facts.at + ', no move since' : '') + ', with ' + first(ctx, x.mgr) + ' since ' + hm(x.since) + '.');
    return {id, g, ymd: day, at, rows, text: head + (tail.length ? ' ' + tail.join(' ') : ''), ref: '#people/' + (ms[0] || g)};
  }

  /* ---------- the manager's view: the watch with the bot's items beside each flag ---------- */
  function board(ctx, mgr, at) {
    const now = Math.floor((Number(at) || nowOf(ctx)) / MIN) * MIN;
    if (!loaded(ctx)) return [];
    /* one board per context and minute: every chip on Your team reads the same one */
    return memoGet(ctx, 'b|' + mgr + '|' + now, () => M.lines.board(ctx, mgr, now).map(r => {
      const its = items(ctx, r.uid, {now});
      const used = new Set();
      const flags = r.flags.map(f => {
        const k = f.k === 'quiet' ? key(r.uid, 'quiet', String(f.key || '').replace(/^quiet/, ''), U.ymd(new Date(now))) : null;
        const mine = its.filter(it => k ? it.K === k : it.kind === f.k && !it.sweep);
        mine.forEach(it => used.add(it.K));
        return {...f, items: mine};
      });
      return {...r, flags, items: its, extra: its.filter(it => !used.has(it.K) && it.state !== 'sorted')};
    }));
  }

  /* ---------- asks the viewer sent, with each recipient's state ---------- */
  function sent(ctx, nowArg) {
    const now = Number(nowArg) || nowOf(ctx);
    const me = ctx.uid;
    const asks = pmOf(ctx, me).asks || {};
    const ymd = U.ymd(new Date(now));
    const out = [];
    for (const id of Object.keys(asks)) {
      const ak = asks[id];
      if (!ak || !Array.isArray(ak.to)) continue;
      const at = Number(ak.showAt) || Number(ak.at) || 0;
      if (U.ymd(new Date(at)) !== ymd && now - at > DAY) continue;
      const rows = ak.to.map(u => {
        const it = items(ctx, u, {now}).find(x => x.asks.some(y => y.id === id));
        const K = it ? it.K : null;
        const ack = K ? (pmOf(ctx, u).ack || {})[K] : null;
        const live = ack && (Number(ack.at) || 0) >= (Number(ak.at) || 0) ? ack : null;
        const seen = it ? toldAt(ctx, u, K + '#a.' + id) : 0;
        const how = live ? live.how : '';
        const text = how ? (COPY.back[how] ? COPY.back[how](first(ctx, u), how === 'onit' ? live.eta : it && it.kind) : first(ctx, u) + ': answered') : '';
        return {uid: u, K, seen: seen || null, how, eta: live ? live.eta : null, at: live ? Number(live.at) : null, sorted: !!(it && it.state === 'sorted'), text, waiting: !it && Number(ak.showAt) > now};
      });
      out.push({askId: id, kind: ak.kind, sub: ak.sub, at: Number(ak.at) || 0, showAt: ak.showAt || null, tellBy: ak.tellBy || null, via: ak.via || 'typed', withdrawn: !!ak.withdrawn, to: ak.to.slice(), rows,
        answered: rows.filter(r => r.how).length});
    }
    return out.sort((x, y) => y.at - x.at);
  }

  /* ---------- one person's bot log: this week by day ---------- */
  function log(ctx, uid, days) {
    const now = nowOf(ctx);
    const out = [];
    for (let i = 0; i < (days || 6); i++) {
      const d = U.ymd(U.addDays(new Date(now), -i));
      if (!ctx.isWorkingDay(d, uid) && i) continue;
      const end = i ? U.parseYmd(d).getTime() + DAY - MIN : now;
      /* a day gone by shows what reached someone or was answered; a step that came due with nobody told
         (the bots were off then, or nobody opened m360) is not history */
      const list = items(ctx, uid, {now: end}).filter(it => i ? it.steps.some(s => s.state === 'told') || !!it.ack || !!it.mack
        : it.steps.some(s => s.state === 'told' || s.state === 'due') || it.state === 'sorted');
      if (list.length || !i) out.push({ymd: d, items: list});
    }
    return out;
  }

  /* ---------- the inbox lines, the dock's count and the buddy's hello ---------- */
  function inboxItems(ctx) {
    if (!on(ctx) && !Object.keys(pmOf(ctx, ctx.uid).asks || {}).length && !asksTo(ctx)) return [];
    const now = nowOf(ctx);
    const list = forMe(ctx, {now});
    const out = [];
    const by = {};
    for (const x of list) {
      if (x.step === '0' || x.item.state === 'sorted') continue;
      const mgrStep = MGR_STEPS.has(x.step);
      const line = mgrStep ? x.item.mgrLine : x.step === 'r' || x.step === 't' || x.step === 'digest' ? x.item.line : (x.item.botName ? x.item.botName + ': ' : '') + x.item.line;
      const ref = mgrStep ? '#people/' + x.item.rep : x.item.ref || (x.item.primary && x.item.primary.href) || '#home';
      out.push({id: 'pm:' + x.stepId, at: x.at, text: line, plain: line, line, ref, actor: mgrStep || x.step === 'r' ? x.item.rep : null, hot: x.item.state === 'open', bot: true, silent: !x.ring});
      by[x.item.K] = true;
    }
    /* the person's one-tap answers to the viewer's bot, listed quietly */
    for (const r of M.lines.reportsOf(ctx, ctx.uid)) for (const it of items(ctx, r, {now})) {
      if (!it.ack || it.source === 'ask' || by[it.K] || it.ack.how === 'blocked' || it.ack.how === 'reply') continue;
      const said = COPY.back[it.ack.how] ? COPY.back[it.ack.how](first(ctx, r), it.ack.how === 'onit' ? it.ack.eta : it.kind) : '';
      if (said) out.push({id: 'pma:' + it.K + ':' + it.ack.how, at: Number(it.ack.at) || now, text: said + ' (' + it.what + ')', plain: said, line: said + ' (' + it.what + ')', ref: '#people/' + r, actor: r, hot: false, bot: true, silent: true});
    }
    return out;
  }
  const asksTo = ctx => Object.keys(ctx.coll.me.map || {}).some(x => Object.values(pmOf(ctx, x).asks || {}).some(a => a && Array.isArray(a.to) && a.to.indexOf(ctx.uid) >= 0));
  function badge(ctx) {
    if (!ctx || !ctx.uid) return 0;
    const list = forMe(ctx, {now: nowOf(ctx)});
    const open = new Set();
    let n = 0;
    for (const x of list) {
      if (x.step === 'r' || x.step === 't') { if (!x.told) n++; continue; }
      if (x.step === '0' || x.item.state !== 'open') continue;
      open.add(x.item.K);
    }
    return n + open.size;
  }
  function helloLine(ctx, nm) {
    if (!ctx || !ctx.uid) return '';
    const mine = forMe(ctx, {now: nowOf(ctx)}).filter(x => REP_STEPS.has(x.step) || x.step.startsWith('a.')).filter(x => x.item.state === 'open');
    const seen = new Set(), list = [];
    for (const x of mine) if (!seen.has(x.item.K)) { seen.add(x.item.K); list.push(x.item); }
    if (!list.length) return '';
    const bot = list[0].source === 'ask' ? (nm ? nm(list[0].from) : first(ctx, list[0].from)) + ' asked m360' : list[0].botName;
    const labels = list.slice(0, 3).map(it => it.label);
    const joined = labels.length > 1 ? labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1] : labels[0];
    return bot + (list.length === 1 ? ' has 1 thing for you: ' : ' has ' + list.length + ' things for you: ') + joined + '.';
  }

  /* ---------- the founder's audit: this week, per manager, and the checks that should read zero ---------- */
  function audit(ctx, from, to) {
    const p = P(ctx);
    const now = nowOf(ctx);
    const wk = U.periodRange('week', new Date(now));
    const lo = from || wk.from, hi = to || U.ymd(new Date(now));
    const mgrs = (ctx.activeMembers || []).filter(m => M.lines.isManager(ctx, m.uid)).map(m => m.uid);
    const rows = {};
    for (const g of mgrs) {
      const cfg = cfgOf(ctx, g);
      /* every pause this week shows, a resumed one too (the plog marks), and the kinds a manager switched off */
      const plog = Object.keys((pmOf(ctx, g).cfg || {}).plog || {}).map(k => k.split(':')).filter(x => x[1] >= lo && x[1] <= hi).map(x => x[0]);
      const paused = Array.from(new Set(Object.keys(cfg.pause).filter(u => cfg.pause[u] >= U.ymd(new Date(now))).concat(plog)));
      rows[g] = {uid: g, on: botOn(ctx, g), wait: cfg.wait, team: M.lines.reportsOf(ctx, g).length, nudges: 0, sorted: 0, mgr: 0, up: 0, letgo: 0, again: 0, disputes: 0, emails: 0,
        paused, kindsOff: BOT_KINDS.filter(k => p.kinds[k] && !cfg.kinds[k]), coach: M.lines.reportsOf(ctx, g).filter(u => { const c = coachUntil(ctx, u); return c && U.ymd(new Date(now)) < c; })};
    }
    const zero = {hours: 0, budget: 0, early: 0, offday: 0, ruleoff: 0};
    const bad = [];
    const count = {};
    for (const m of ctx.activeMembers || []) {
      const told = toldOf(ctx, m.uid);
      for (const id of Object.keys(told)) {
        const v = Number(told[id]);
        if (!v) continue;
        const at = Math.abs(v);
        const dayT = U.ymd(new Date(at));
        if (dayT < lo || dayT > hi) continue;
        /* a note up the line counts for every manager under whoever got it */
        if (id.startsWith('digest:')) { for (const x of mgrs) if (managerOf(ctx, x) === m.uid) rows[x].up++; continue; }
        const hash = id.indexOf('#');
        if (hash < 0) continue;
        const K = id.slice(0, hash), step = id.slice(hash + 1);
        const k = parseKey(K);
        const mgr = managerOf(ctx, k.rep);
        const row = rows[mgr];
        if (row && step === '1') row.nudges++;
        if (row && (step === '2' || step === '2b') && m.uid !== k.rep) row.mgr++;
        if (v < 0) continue;
        /* what rang (a positive mark) is checked against the engine */
        if (!ctx.isWorkingDay(dayT, m.uid)) { zero.offday++; bad.push(id); }
        const ask = step.startsWith('a.');
        const w = window_(ctx, m.uid, at);
        if (!ask && !w.ok && w.why !== 'lunch') { zero.hours++; bad.push(id); }
        if (KINDS[k.kind] && KINDS[k.kind].rule && ctx.settings.rules && ctx.settings.rules[KINDS[k.kind].rule] === false) { zero.ruleoff++; bad.push(id); }
        const cap = ask ? p.askPerDay : (step === '2' || step === '2b') ? p.mgrPerDay : k.kind === 'quiet' ? p.quietMax : p.perDay;
        const ck = m.uid + '|' + dayT + '|' + (ask ? 'a' : (step === '2' || step === '2b') ? 'm' : k.kind === 'quiet' ? 'q' : 'r');
        count[ck] = (count[ck] || 0) + 1;
        if (count[ck] > cap) { zero.budget++; bad.push(id); }
        if ((step === '2' || step === '2b') && k.ymd === dayT) {
          const it = items(ctx, k.rep, {now: Math.max(at, U.parseYmd(dayT).getTime() + DAY - MIN)}).find(x => x.K === K);
          if (it && step === '2' && !(it.ack && it.ack.how === 'blocked') && !it.sweep && it.kind !== 'waiton' && at < it.s1 + cfgOf(ctx, it.mgr, dayT).wait * MIN - MIN) { zero.early++; bad.push(id); }
        }
      }
      const ack = pmOf(ctx, m.uid).ack || {};
      for (const K of Object.keys(ack)) {
        const a = ack[K];
        const k = parseKey(K);
        if (!a || !k.ymd || k.ymd < lo || k.ymd > hi) continue;
        const row = rows[managerOf(ctx, k.rep)];
        if (!row) continue;
        if (m.uid === k.rep && a.how === 'wrong') row.disputes++;
        if (m.uid !== k.rep && a.how === 'drop') row.letgo++;
        if (m.uid !== k.rep && a.again) row.again++;
      }
    }
    /* sorted before the manager heard: today's items that resolved with step 2 still unsent */
    for (const g of mgrs) for (const r of M.lines.reportsOf(ctx, g)) for (const it of items(ctx, r, {now})) {
      const s2 = it.steps.find(s => s.step === '2');
      if (it.state === 'sorted' && (!s2 || !s2.told)) rows[g].sorted++;
    }
    return {from: lo, to: hi, rows: mgrs.map(g => rows[g]), zero, bad: Array.from(new Set(bad)).slice(0, 20)};
  }

  /* ---------- writes ---------- */
  /* the quiet writer: told marks and outbox retries. No log line, no stamp, no toast; its own queue */
  const QQ = {};
  const viewing = () => !!(M.viewAs && M.viewAs.get && M.viewAs.get());
  const missing = e => e && (e.code === 'not_found' || (e.code === 'invalid_argument' && /missing/i.test(String(e.message || ''))));
  function qmerge(ctx, path, patch) {
    if (viewing() || !ctx || !ctx.db) return Promise.reject({code: 'locked', message: 'preview'});
    if (path !== 'me/' + ctx.uid) return Promise.reject({code: 'refused', message: 'own profile only'});
    const run = () => ctx.db.doc(path).update(patch).catch(e => { if (missing(e)) return ctx.db.doc(path).set(patch); throw e; });
    const pr = (QQ[path] || Promise.resolve()).then(run, run);
    QQ[path] = pr.catch(() => {});
    return pr;
  }
  /* the outbox: every PM patch waits here until the snapshot shows it, and goes again every minute */
  const OUT = u => 'm360.pmOut.' + u;
  const outRead = u => { try { return JSON.parse(localStorage.getItem(OUT(u)) || '[]') || []; } catch (e) { return []; } };
  const outWrite = (u, list) => { try { localStorage.setItem(OUT(u), JSON.stringify(list.slice(-200))); } catch (e) { /* private window */ } };
  function outAdd(ctx, path, patch) {
    const list = outRead(ctx.uid);
    list.push({path, patch, at: Date.now()});
    outWrite(ctx.uid, list);
  }
  /* does the document already hold the patch: told keeps the earliest time, an answer keeps the first at */
  function covers(doc, patch, inTold) {
    /* a newer write on the same thing (a changed answer, a later setting) stands: the older patch is done */
    if (doc && patch && patch.at != null && doc.at != null && Number(doc.at) > Number(patch.at)) return true;
    for (const k of Object.keys(patch || {})) {
      const v = patch[k], d = doc ? doc[k] : undefined;
      if (v === null) { if (d != null) return false; continue; }
      if (v && typeof v === 'object' && !Array.isArray(v)) { if (!covers(d || {}, v, inTold || k === 'told')) return false; continue; }
      if (inTold) { if (d == null) return false; continue; }
      if (k === 'at' && Number(d) >= Number(v)) continue;
      if (JSON.stringify(d) !== JSON.stringify(v)) return false;
    }
    return true;
  }
  function flush(ctx) {
    if (!ctx || !ctx.uid || viewing()) return;
    const list = outRead(ctx.uid);
    if (!list.length) return;
    const doc = meOf(ctx, ctx.uid);
    const keep = [];
    for (const e of list) {
      if (Date.now() - (e.at || 0) > 2 * DAY) continue;
      if (covers(doc, e.patch)) continue;
      keep.push(e);
      qmerge(ctx, e.path, e.patch).catch(() => {});
    }
    outWrite(ctx.uid, keep);
  }
  /* entries past the window and past the caps go as nulls with the next write */
  function prune(ctx, now) {
    const pm = pmOf(ctx, ctx.uid);
    const cut = U.ymd(U.addDays(new Date(now), -KEEP_DAYS));
    const out = {};
    const byTime = (map, timeOf, keep, days) => {
      const dropAt = now - days * DAY;
      const ids = Object.keys(map || {}).filter(k => map[k] != null);
      const stale = ids.filter(k => timeOf(k, map[k]) < dropAt);
      const rest = ids.filter(k => stale.indexOf(k) < 0).sort((x, y) => timeOf(y, map[y]) - timeOf(x, map[x])).slice(keep);
      const patch = {};
      for (const k of stale.concat(rest)) patch[k] = null;
      return Object.keys(patch).length ? patch : null;
    };
    const ymdOf = k => { const p = parseKey(String(k).split('#')[0]); return /^\d{4}-\d{2}-\d{2}$/.test(p.ymd || '') ? p.ymd : ''; };
    const t1 = byTime(pm.told, (k, v) => Math.abs(Number(v)) || 0, KEEP_MAP, KEEP_DAYS); if (t1) out.told = t1;
    const t2 = byTime(pm.ack, (k, v) => { const y = ymdOf(k); return y && y < cut ? 0 : Number(v && v.at) || 0; }, KEEP_MAP, KEEP_DAYS); if (t2) out.ack = t2;
    const t3 = byTime(pm.asks, (k, v) => Number(v && v.at) || 0, KEEP_ASKS, ASK_DAYS); if (t3) out.asks = t3;
    const tm = tasksOf(ctx);
    const ch = {};
    for (const id of Object.keys(pm.chase || {})) if (pm.chase[id] && (!tm[id] || !open(tm[id]))) ch[id] = null;
    if (Object.keys(ch).length) out.chase = ch;
    return out;
  }
  const deep = (a, b) => {
    const o = {...(a || {})};
    for (const k of Object.keys(b || {})) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' ? deep(o[k], b[k]) : b[k];
    return o;
  };
  /* one PM write to the viewer's own profile: through W (a log line, a toast on failure) or quietly */
  function write(ctx, pm, quiet) {
    if (viewing()) { M.toast('Preview mode. Nothing saves.', true); return Promise.reject({code: 'locked'}); }
    const path = 'me/' + ctx.uid;
    const patch = {pm: deep(prune(ctx, Date.now()), pm)};
    outAdd(ctx, path, {pm});
    return quiet ? qmerge(ctx, path, patch) : ctx.W.merge(path, patch);
  }

  /* the person answers their bot (or an ask). Typed words go to the manager as a real DM line */
  async function answer(ctx, K, o) {
    const how = String((o && o.how) || '');
    if (['onit', 'blocked', 'wrong', 'leave', 'reply'].indexOf(how) < 0) throw new Error('bad answer');
    const k = parseKey(K);
    if (k.rep !== ctx.uid) throw new Error('only your own');
    const prev = (pmOf(ctx, ctx.uid).ack || {})[K];
    const a = {at: Date.now(), how, n: (prev && prev.n ? prev.n : 0) + 1};
    if (o.eta != null && o.eta !== '') a.eta = typeof o.eta === 'number' ? o.eta : String(o.eta).slice(0, 10);
    if (o.until) a.until = String(o.until).slice(0, 10);
    await write(ctx, {ack: {[K]: a}});
    const note = String((o && o.note) || '').trim().slice(0, 1000);
    if (note && M.rooms) {
      const it = items(ctx, ctx.uid).find(x => x.K === K);
      const to = it && it.source === 'ask' ? it.asks[0].by : it && it.kind === 'waiton' ? it.facts.r : managerOf(ctx, ctx.uid);
      if (to) await M.rooms.send(ctx, M.rooms.dmId(ctx.uid, to), (how === 'blocked' ? 'Blocked: ' : '') + note, [], null, {pm: K, pmHow: how});
    }
    return a;
  }
  /* the manager (or whoever asked) on a report's key: mine, drop, again, answered */
  async function handle(ctx, K, how, o) {
    if (['mine', 'drop', 'again', 'answered'].indexOf(how) < 0) throw new Error('bad');
    const now = Date.now();
    const cur = (pmOf(ctx, ctx.uid).ack || {})[K];
    let a;
    if (how === 'again') {
      if (cur && cur.again && U.ymd(new Date(cur.again)) === U.ymd(new Date(now))) return cur;
      a = cur && (cur.how === 'mine' || cur.how === 'drop') ? {again: now} : {at: now, how: 'again', again: now};
    } else {
      a = {at: now, how};
      if (o && o.until) a.until = String(o.until).slice(0, 10);
    }
    await write(ctx, {ack: {[K]: a}});
    return a;
  }
  async function chase(ctx, taskId, want) {
    const t = tasksOf(ctx)[taskId];
    if (want && (!t || !open(t))) throw new Error('not open');
    if (want && !(ctx.isFounder || chainOf(ctx, t.owner).indexOf(ctx.uid) >= 0)) throw new Error('not in the line');
    await write(ctx, {chase: {[taskId]: want ? {rep: t.owner, at: Date.now()} : null}});
  }
  /* the manager's own bot. Stricter changes (a shorter wait, a kind switched on) start on the next
     working day, so nobody is caught out today */
  async function setCfg(ctx, patch) {
    const p = P(ctx);
    const cur = pmOf(ctx, ctx.uid).cfg || {};
    const now = cfgOf(ctx, ctx.uid);
    const td = U.ymd(new Date(nowOf(ctx)));
    const out = {at: Date.now()};
    const next = {};
    if (patch.on != null) {
      if (patch.on === false && (p.require || p.off[ctx.uid])) throw new Error('Only Kaavish can switch a bot off.');
      out.on = !!patch.on;
    }
    if (patch.wait != null) {
      const w = Math.max(p.waitMin, Math.min(p.waitMax, Number(patch.wait) || p.wait));
      if (w < now.wait) next.wait = w; else { out.wait = w; if (cur.next && cur.next.wait) next.wait = null; }
    }
    if (patch.kinds) {
      const k = {}, nk = {};
      for (const x of Object.keys(patch.kinds)) {
        if (BOT_KINDS.indexOf(x) < 0) continue;
        if (patch.kinds[x] && !now.kinds[x]) nk[x] = true; else k[x] = !!patch.kinds[x];
      }
      /* switching every kind off is switching the bot off, which only the founder can do */
      const left = BOT_KINDS.filter(x => (x in k ? k[x] : now.kinds[x]) || nk[x]);
      if (p.require && !left.length) throw new Error('Only Kaavish can switch a bot off. Keep one thing on.');
      if (Object.keys(k).length) out.kinds = k;
      if (Object.keys(nk).length) next.kinds = nk;
    }
    if (patch.voice) out.voice = patch.voice === 'brief' ? 'brief' : 'warm';
    if (patch.mail != null) out.mail = !!patch.mail;
    if (patch.pause) {
      /* while managers cannot switch their bot off, a pause lasts the day it is set: a pause running for
         weeks would be the switch by another name. Each one leaves a mark the founder's audit counts */
      out.pause = {};
      const plog = {};
      for (const u of Object.keys(patch.pause)) {
        if (!patch.pause[u]) { out.pause[u] = null; continue; }
        if (M.lines.reportsOf(ctx, ctx.uid).indexOf(u) < 0) continue;
        let until = String(patch.pause[u]).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < td) continue;
        if (p.require && until > td) until = td;
        out.pause[u] = until;
        plog[u + ':' + td] = Date.now();
      }
      const old = U.ymd(U.addDays(U.parseYmd(td), -KEEP_DAYS));
      for (const k of Object.keys(cur.plog || {})) if (k.split(':')[1] < old) plog[k] = null;
      if (Object.keys(plog).length) out.plog = plog;
    }
    if (Object.keys(next).length) out.next = {from: nextWorking(ctx, td), ...next};
    await write(ctx, {cfg: out});
    return {now: out, next: out.next || null};
  }
  async function setMail(ctx, v) { await write(ctx, {mail: !!v}); }

  /* the first time a step reached this person: positive when it rang, negative when a card showed it */
  function told(ctx, stepIds, silent) {
    const ids = (stepIds || []).filter(Boolean);
    if (!ids.length || !ctx || !ctx.uid || viewing()) return Promise.resolve();
    const have = toldOf(ctx, ctx.uid);
    const dev = new Set(devList(ctx.uid));
    const now = Date.now();
    const t = {};
    for (const id of ids) if (!have[id] && !dev.has(id)) t[id] = silent ? -now : now;
    if (!Object.keys(t).length) return Promise.resolve();
    devMark(ctx.uid, Object.keys(t));
    return write(ctx, {told: t}, true).catch(() => {});
  }
  /* this device's own list of what it has shown, read before the snapshot brings the mark back */
  const DEV = u => 'pmTold.' + u;
  const devList = u => { try { return JSON.parse(M.prefs.get(DEV(u), '[]')) || []; } catch (e) { return []; } };
  function devMark(u, ids) { const l = devList(u).concat(ids); M.prefs.set(DEV(u), JSON.stringify(Array.from(new Set(l)).slice(-400))); }

  /* a manual ask (voice, chat, a button): one record on the sender's profile, one DM line each. opts.as
     M.coo.UID sends it as the m360 COO: founder-level rights, its own caps (M.coo counts them), the record
     on its own profile and the line from its own DM room */
  async function ask(ctx, o, opts) {
    /* only the founder's own page speaks as the COO (its runner); anyone else's ask stays their own */
    const bot = !!(opts && opts.as && isCoo(opts.as)) && !!ctx.isFounder && !ctx.viewAs;
    if (opts && opts.as && !bot) return {askId: null, sent: [], skipped: Array.from(new Set(o.to || [])).map(u => ({uid: u, why: 'only the COO asks as the COO'})), already: []};
    const me = bot ? opts.as : ctx.uid;
    const p = P(ctx);
    const ag = {...(((M.SETTINGS_DEFAULTS || {}).agent) || {}), ...((ctx.settings && ctx.settings.agent) || {})};
    const kind = KINDS[o.kind] ? o.kind : 'custom';
    const now = Date.now();
    const ymd = U.ymd(new Date(now));
    const askId = U.uid();
    const showAt = o.showAt && Number(o.showAt) > now ? Number(o.showAt) : null;
    const sentList = [], skipped = [], already = [];
    const mineAsks = pmOf(ctx, me).asks || {};
    let todayN = 0;
    for (const id of Object.keys(mineAsks)) { const x = mineAsks[id]; if (x && !x.withdrawn && U.ymd(new Date(Number(x.at) || 0)) === ymd) todayN += (x.to || []).length; }
    const att = KINDS[kind].att;
    if (bot ? !cooAsks(ctx) : ag.on === false) return {askId: null, sent: [], skipped: Array.from(new Set(o.to || [])).map(u => ({uid: u, why: 'asks are switched off'})), already: []};
    const reach = Math.max(1, Number(ag.bulkMax) || 12);
    for (const u of Array.from(new Set(o.to || []))) {
      const m = ctx.members[u];
      if (!m || m.active === false) { skipped.push({uid: u, why: 'not on the team'}); continue; }
      if (u === me) { skipped.push({uid: u, why: 'that is you'}); continue; }
      const line = bot || ctx.isFounder || chainOf(ctx, u).indexOf(ctx.uid) >= 0;
      const mgr = bot || ctx.isFounder || managerOf(ctx, u) === ctx.uid;
      if (att ? !mgr : !line) { skipped.push({uid: u, why: 'not in your team'}); continue; }
      if (!ctx.isWorkingDay(U.ymd(new Date(showAt || now)), u)) { skipped.push({uid: u, why: 'not working today'}); continue; }
      if (Object.keys(mineAsks).some(id => { const x = mineAsks[id]; return x && !x.withdrawn && x.kind === kind && (x.to || []).indexOf(u) >= 0 && U.ymd(new Date(Number(x.at) || 0)) === ymd && (kind !== 'custom'); })) { skipped.push({uid: u, why: 'already asked today'}); continue; }
      if (!bot && todayN + sentList.length >= ag.perSenderDay) { skipped.push({uid: u, why: 'your asks for today are used up'}); continue; }
      if (sentList.length >= reach) { skipped.push({uid: u, why: 'more than ' + reach + ' people in one ask'}); continue; }
      if ((kind === 'overdue' || kind === 'task') && !(tasksOf(ctx)[o.sub] && tasksOf(ctx)[o.sub].owner === u)) { skipped.push({uid: u, why: 'not their task'}); continue; }
      if (!showAt && ['noin', 'noout', 'noeod', 'quiet', 'idle'].indexOf(kind) >= 0 && !M.lines.watch(ctx, u, now).some(f => f.k === kind && (kind !== 'quiet' || f.live))) { skipped.push({uid: u, why: 'already sorted'}); continue; }
      for (const x of Object.keys(ctx.coll.me.map || {})) {
        if (x === me) continue;
        const ax = pmOf(ctx, x).asks || {};
        for (const id of Object.keys(ax)) { const y = ax[id]; if (y && !y.withdrawn && y.kind === kind && (y.to || []).indexOf(u) >= 0 && U.ymd(new Date(Number(y.at) || 0)) === ymd) already.push({uid: u, by: x, at: Number(y.at)}); }
      }
      sentList.push(u);
    }
    if (!sentList.length) return {askId: null, sent: [], skipped, already};
    const rec = {kind, to: sentList, ask: ['why', 'eta', 'confirm'].indexOf(o.ask) >= 0 ? o.ask : 'why', at: now, via: ['voice', 'typed', 'grammar', 'button', 'coo'].indexOf(o.via) >= 0 ? o.via : 'typed'};
    if (o.sub && (kind === 'overdue' || kind === 'task')) rec.sub = String(o.sub);
    if (showAt) rec.showAt = showAt;
    if (o.tellBy) rec.tellBy = Number(o.tellBy);
    if (o.ringNow && ctx.isFounder && !bot) rec.ringNow = true;
    if (o.note) rec.note = true;
    /* the COO's ask carries its copy code and ids, so the card reads its own line; never the words */
    if (bot && o.code) { rec.code = String(o.code).slice(0, 40); rec.args = o.args || {}; }
    if (bot) await M.coo.writeAsk(ctx, askId, rec);
    else await write(ctx, {asks: {[askId]: rec}});
    /* one real DM line per person, from this page, now (a scheduled ask has none): the sender's own
       words when there are any, else the template. A retry finds the line by its id and adds nothing */
    if (!showAt && M.rooms) {
      for (const u of sentList) {
        const sub = kind === 'custom' ? askId : rec.sub || (kind === 'quiet' ? quietSub(ctx, u, now) : '-');
        const K = key(u, kind, sub, ymd);
        const f = {...factsFor(ctx, u, kind, rec.sub, now), note: o.note ? String(o.note).slice(0, 280) : ''};
        const text = o.note ? String(o.note).trim().slice(0, 280) : (COPY.ask[kind] || COPY.ask.custom)(f);
        try {
          if (bot) await M.coo.say(ctx, u, text, 'ask.' + askId + '.' + u, {ask: askId, k: K});
          else await M.rooms.send(ctx, M.rooms.dmId(ctx.uid, u), text, [], null, {id: 'ask.' + askId + '.' + u, ask: askId, k: K, via: rec.via});
        } catch (e) { /* the record stands; the card carries it */ }
      }
    }
    return {askId, sent: sentList, skipped, already};
  }
  const quietSub = (ctx, u, now) => { const f = M.lines.watch(ctx, u, now).find(x => x.k === 'quiet' && x.live); return f ? String(f.key || '').replace(/^quiet/, '') : '-'; };
  function factsFor(ctx, u, kind, sub, now) {
    const ymd = U.ymd(new Date(now));
    const a = M.att ? M.att.dayStatus(ctx, u, ymd) : {};
    const t = sub ? tasksOf(ctx)[sub] : null;
    const q = M.lines.watch(ctx, u, now).find(x => x.k === 'quiet' && x.live);
    return {in: a.in ? hm(a.in) : '', last: lastSave(ctx, u, ymd), start: ctx.startFor(u), title: t ? t.title : '', due: t ? dueDay(t.due) : '', from: q ? hm(q.from) : '', dur: a.in && a.out ? U.durText(a.out - a.in) : ''};
  }
  async function withdraw(ctx, askId) {
    const ak = (pmOf(ctx, ctx.uid).asks || {})[askId];
    if (!ak) return;
    await write(ctx, {asks: {[askId]: {withdrawn: Date.now()}}});
    if (M.rooms && M.rooms.edit) for (const u of ak.to || []) { try { await M.rooms.edit(ctx, M.rooms.dmId(ctx.uid, u), 'ask.' + askId + '.' + u, 'Withdrawn'); } catch (e) { /* the line stays */ } }
  }

  M.pm = {P, on, cfgOf, botOn, chases, managerFor, key, parseKey, items, forMe, board, sent, digest, log, inboxItems, helloLine, badge, audit,
    answer, handle, chase, ask, withdraw, setCfg, setMail, told, qmerge, flush, covers, devList, learn, first, botName, window: window_, coachUntil, loaded,
    COPY, KINDS, ORDER, BOT_KINDS, TASK_KINDS, PASS: 20000};
})();
