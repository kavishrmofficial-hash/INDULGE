/* module: rules. The live rule box engine from BRIEF section 8. Pure functions, no components. */
'use strict';
(function () {
  const {U} = M;

  const DAY = 86400000;

  /* rule names, exactly as the table in BRIEF section 8 states them; {{tokens}} follow the handbook convention */
  const TEMPLATES = Object.freeze({
    R01: 'Check in by start time',
    R02: 'On time',
    R03: 'Office check-ins are verified',
    R04: 'EOD line by {{eodCut}}',
    R05: 'Monday outcomes',
    R06: 'WFH cap',
    R07: 'Finish it',
    R08: 'Show it at 20%',
    R09: 'Revision cap',
    R10: 'Escalate blockers',
    R11: 'Read the handbook',
    R12: 'The ladder',
    R13: 'Pitch next steps',
    R14: 'Projects on track',
    R15: 'Client brain kept current',
    R16: 'Hiring panel on time'
  });

  /* handbook section per rule; R11 carries the section it is about */
  const SECTION_OF = Object.freeze({
    R01: 'the-week', R02: 'the-week', R03: 'the-week', R04: 'the-week', R05: 'the-week', R06: 'the-week',
    R07: 'house-rules', R08: 'house-rules', R09: 'standards', R10: 'escalation', R11: null, R12: 'ladder',
    R13: 'pipeline', R14: 'projects', R15: 'clients', R16: 'hiring-panel'
  });

  const REF_OF = Object.freeze({
    R01: '#today', R02: '#today', R03: '#today', R04: '#today', R05: '#today', R06: '#today',
    R07: '#tasks', R08: '#tasks', R09: '#tasks', R10: '#week', R11: '#handbook', R12: '#people',
    R13: '#pitches', R14: '#projects', R15: '#clients', R16: '#hiring'
  });

  /* live tokens in a rule name, filled from settings */
  function name(id, settings) {
    const s = settings || (M.lastCtx && M.lastCtx.settings) || M.SETTINGS_DEFAULTS || {};
    return String(TEMPLATES[id] || id).replace(/\{\{(\w+)\}\}/g, (m, k) => (s[k] != null && s[k] !== '' ? String(s[k]) : m));
  }

  /* NAMES reads like a plain map; R04 fills its token from the live settings */
  const NAMES = {};
  for (const id of Object.keys(TEMPLATES)) {
    if (TEMPLATES[id].indexOf('{{') >= 0) Object.defineProperty(NAMES, id, {enumerable: true, get: () => name(id)});
    else NAMES[id] = TEMPLATES[id];
  }
  Object.freeze(NAMES);

  function SECTION_RULES(sectionId) {
    const linked = Object.keys(SECTION_OF).filter(id => SECTION_OF[id] && SECTION_OF[id] === sectionId);
    linked.push('R11');
    return linked;
  }

  /* ---------- small text helpers ---------- */
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const trunc = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3).trim() + '...' : s; };
  const joinList = xs => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const minsOf = d => d.getHours() * 60 + d.getMinutes();
  const agoText = (ts, nowMs) => {
    const m = Math.max(1, Math.round((nowMs - ts) / 60000));
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
    return Math.round(d / 30) + 'mo ago';
  };

  /* ---------- the engine ---------- */
  function evaluate(ctx, now) {
    const out = [];
    if (!ctx || !ctx.coll || !ctx.settings) return out;
    now = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();

    const S = ctx.settings;
    const switches = S.rules || {};
    const on = id => switches[id] !== false;
    const coll = key => (ctx.coll[key] && ctx.coll[key].map) || {};

    const today = U.ymd(now);
    const nowMs = now.getTime();
    const nowMin = minsOf(now);
    const dow = now.getDay();
    const grace = Number(S.grace) || 0;
    const ackMs = (Number(S.ackHours) || 0) * 3600000;
    const back30 = U.ymd(U.addDays(now, -30));

    const isWD = (d, u) => {
      if (typeof ctx.isWorkingDay === 'function') return !!ctx.isWorkingDay(d, u);
      if (U.parseYmd(d).getDay() === 0) return false;
      if (ctx.holidays && typeof ctx.holidays.has === 'function' && ctx.holidays.has(d)) return false;
      if (typeof ctx.onLeave === 'function' && ctx.onLeave(u, d)) return false;
      return true;
    };
    const startOf = u => (typeof ctx.startFor === 'function' && ctx.startFor(u)) || S.start || '10:30';
    /* the last working day for u before `from`, at most 14 days back and never before the person joined */
    const prevWorkingDay = (from, u, joined) => {
      const base = U.parseYmd(from);
      for (let i = 1; i <= 14; i++) {
        const d = U.ymd(U.addDays(base, -i));
        if (joined && d < joined) return null;
        if (isWD(d, u)) return d;
      }
      return null;
    };

    const checkin = coll('checkin'), eod = coll('eod'), plan = coll('plan'), review = coll('review'), acks = coll('acks');
    const tasks = coll('tasks'), projects = coll('projects'), pitches = coll('pitches'), clients = coll('clients');
    const handbook = coll('handbook'), candidates = coll('candidates'), evals = coll('evals');

    const dayOf = (map, u, d) => { const doc = map[u]; return (doc && doc.days && doc.days[d]) || null; };
    const hasEod = (u, d) => { const e = dayOf(eod, u, d); return !!(e && (e.at || String(e.shipped || '').trim())); };
    const blockedOn = (u, d) => { const e = dayOf(eod, u, d); return e ? String(e.blocked || '').trim() : ''; };

    /* one pass over each shared collection, bucketed by owner */
    const byOwner = map => {
      const b = {};
      for (const id of Object.keys(map)) {
        const d = map[id];
        if (!d || typeof d !== 'object' || !d.owner) continue;
        (b[d.owner] = b[d.owner] || []).push({id, d});
      }
      return b;
    };
    const tasksBy = byOwner(tasks), projectsBy = byOwner(projects), pitchesBy = byOwner(pitches), clientsBy = byOwner(clients);
    const progress = {};
    for (const id of Object.keys(tasks)) {
      const t = tasks[id];
      if (!t || !t.project) continue;
      const p = progress[t.project] = progress[t.project] || {done: 0, total: 0};
      p.total++;
      if (t.status === 'done') p.done++;
    }
    const sections = Object.keys(handbook)
      .map(id => ({id, doc: handbook[id] || {}}))
      .filter(s => Number(s.doc.updated) > 0)
      .sort((a, b) => (Number(a.doc.order) || 0) - (Number(b.doc.order) || 0));
    const candidateIds = Object.keys(candidates);

    const push = (rule, u, severity, text, section, ref, key) => out.push({
      rule, uid: u, severity, text,
      section: section || SECTION_OF[rule] || null,
      ref: ref || REF_OF[rule],
      key: rule + ':' + u + (key ? ':' + key : '')
    });

    const members = Array.isArray(ctx.activeMembers) ? ctx.activeMembers : [];
    for (const m of members) {
      const u = m && m.uid;
      if (!u) continue;
      const joined = m.joined || '';
      /* a broken document for one person never blocks the others */
      const run = (id, fn) => { if (!on(id)) return; try { fn(); } catch (e) { console.warn('rules ' + id + ' skipped for ' + u, e); } };

      /* R01: a working day, past start plus grace, no check-in today */
      run('R01', () => {
        if (!isWD(today, u)) return;
        const startMin = U.minutes(startOf(u));
        const cut = startMin + grace;
        if (nowMin <= cut) return;
        const ci = dayOf(checkin, u, today);
        if (ci && ci.in) return;
        push('R01', u, nowMin - cut >= 120 ? 'high' : 'medium',
          'No check-in yet, ' + U.durText((nowMin - startMin) * 60000) + ' past ' + startOf(u));
      });

      /* R02: today's check-in landed after start plus grace */
      run('R02', () => {
        if (!isWD(today, u)) return;
        const ci = dayOf(checkin, u, today);
        if (!ci || !ci.in) return;
        const startMin = U.minutes(startOf(u));
        const inMin = minsOf(new Date(Number(ci.in)));
        if (inMin <= startMin + grace) return;
        push('R02', u, 'medium', 'Checked in ' + U.hhmm(Number(ci.in)) + ', ' + U.durText((inMin - startMin) * 60000) + ' late');
      });

      /* R03: an office check-in today with an unverified location */
      run('R03', () => {
        const ci = dayOf(checkin, u, today);
        if (!ci || !ci.in || ci.mode !== 'office') return;
        if (ci.loc && ci.loc.verified === true) return;
        push('R03', u, 'medium', 'Office check-in ' + U.hhmm(Number(ci.in)) + ', location unverified');
      });

      /* R04: past eodCut with no EOD today, or the previous working day has no EOD */
      run('R04', () => {
        const missing = [];
        const prev = prevWorkingDay(today, u, joined);
        if (prev && !hasEod(u, prev)) missing.push(U.fmtDay(prev));
        if (isWD(today, u) && nowMin > U.minutes(S.eodCut) && !hasEod(u, today)) missing.push('today');
        if (!missing.length) return;
        const what = missing.length === 1 && missing[0] === 'today' ? 'today' : 'for ' + missing.join(' or ');
        push('R04', u, 'medium', 'No EOD line ' + what + ', due by ' + S.eodCut);
      });

      /* R05: no plan this week, once Monday's cut has passed */
      run('R05', () => {
        if (dow === 0) return;
        if (dow === 1 && nowMin <= U.minutes(S.mondayCut)) return;
        const wk = U.isoWeek(now);
        const doc = plan[u];
        const p = doc && doc.weeks && doc.weeks[wk];
        const items = (p && Array.isArray(p.items)) ? p.items : [];
        if (items.some(i => i && String(i.text || '').trim())) return;
        /* a week with no working day so far for this person asks for no plan yet */
        const mon = U.mondayOf(now);
        let any = false;
        for (let i = 0; i < dow; i++) if (isWD(U.ymd(U.addDays(mon, i)), u)) any = true;
        if (!any) return;
        push('R05', u, 'medium', 'No outcomes for week ' + Number(wk.split('-W')[1]) + ' yet, due Monday by ' + S.mondayCut);
      });

      /* R06: WFH check-ins this week over the cap */
      run('R06', () => {
        const own = (ctx.members && ctx.members[u]) || {};
        const cap = (own.wfhCap != null && String(own.wfhCap) !== '' && Number(own.wfhCap) >= 0) ? Math.floor(Number(own.wfhCap)) : Number(S.wfhCap);
        if (!(cap >= 0)) return;
        let n = 0;
        for (const d of U.weekDays(U.mondayOf(now))) {
          const ci = dayOf(checkin, u, d);
          if (ci && ci.in && ci.mode === 'wfh') n++;
        }
        if (n <= cap) return;
        push('R06', u, 'low', n + ' WFH check-ins this week, cap is ' + cap);
      });

      /* R07: open tasks past due, soonest due first */
      run('R07', () => {
        const list = (tasksBy[u] || []).filter(x => x.d.status !== 'done' && x.d.due && x.d.due < today)
          .sort((a, b) => (a.d.due < b.d.due ? -1 : a.d.due > b.d.due ? 1 : 0));
        for (const {id, d: t} of list) {
          const n = U.daysBetween(t.due, today);
          if (!(n > 0)) continue;
          push('R07', u, n > 3 ? 'high' : 'medium', trunc(t.title, 60) + ', ' + plural(n, 'day', 'days') + ' overdue', null, null, id);
        }
      });

      /* R08: reached review or done in the last 14 days with the 20% check unticked */
      run('R08', () => {
        for (const {id, d: t} of (tasksBy[u] || [])) {
          if (t.status !== 'review' && t.status !== 'done') continue;
          if (t.shown20) continue;
          const at = Number(t.doneAt || t.updated || t.created || 0);
          if (!at || at < nowMs - 14 * DAY) continue;
          push('R08', u, 'medium', trunc(t.title, 60) + ' reached ' + (t.status === 'done' ? 'done' : 'review') + ', 20% check unticked', null, null, id);
        }
      });

      /* R09: revisions at or above the cap, on open tasks and tasks done in the last 14 days */
      run('R09', () => {
        const cap = Number(S.revCap);
        if (!(cap > 0)) return;
        for (const {id, d: t} of (tasksBy[u] || [])) {
          const rev = Number(t.revisions) || 0;
          if (rev < cap) continue;
          if (t.status === 'done') {
            const at = Number(t.doneAt || t.updated || 0);
            if (!at || at < nowMs - 14 * DAY) continue;
          }
          push('R09', u, 'medium', trunc(t.title, 60) + ', ' + plural(rev, 'revision', 'revisions') + ', cap is ' + cap, null, null, id);
        }
      });

      /* R10: a blocker line on blockerDays working days in a row, ending today or the last working day */
      run('R10', () => {
        const need = Number(S.blockerDays);
        if (!(need > 0)) return;
        const end = (isWD(today, u) && hasEod(u, today)) ? today : prevWorkingDay(today, u, joined);
        if (!end) return;
        let n = 0, d = U.parseYmd(end);
        for (let guard = 0; guard < 60; guard++) {
          const s = U.ymd(d);
          if (isWD(s, u)) {
            if (!blockedOn(u, s)) break;
            n++;
          }
          d = U.addDays(d, -1);
        }
        if (n < need) return;
        push('R10', u, 'high', 'Blocker reported ' + plural(n, 'working day', 'working days') + ' in a row: ' + trunc(blockedOn(u, end), 80));
      });

      /* R11: a section updated more than ackHours ago with no read since */
      run('R11', () => {
        const reads = (acks[u] && acks[u].s) || {};
        for (const s of sections) {
          const upd = Number(s.doc.updated);
          if (!(upd < nowMs - ackMs)) continue;
          if (Number(reads[s.id] || 0) >= upd) continue;
          push('R11', u, 'low', 'Unread: ' + trunc(s.doc.title || s.id, 60) + ', updated ' + agoText(upd, nowMs), s.id, '#handbook/' + s.id, s.id);
        }
      });

      /* R12: missed outcomes in weeks whose Monday falls within the last 30 days */
      run('R12', () => {
        const weeks = (review[u] && review[u].weeks) || {};
        let n = 0;
        for (const wk of Object.keys(weeks)) {
          if (!/^\d{4}-W\d{1,2}$/.test(wk)) continue;
          const mon = U.mondayOfWeekId(wk);
          if (isNaN(mon.getTime())) continue;
          const my = U.ymd(mon);
          if (my < back30 || my > today) continue;
          const marks = (weeks[wk] && weeks[wk].marks) || {};
          for (const k of Object.keys(marks)) if (marks[k] === 'miss') n++;
        }
        if (n < 1) return;
        const step = n >= 3 ? 'Exit' : n === 2 ? 'A formal warning' : 'A written note';
        push('R12', u, n >= 2 ? 'high' : 'medium', plural(n, 'missed outcome', 'missed outcomes') + ' in 30 days. ' + step, null, '#people/' + u);
      });

      /* R13: a pitch with its next step date in the past, still in play */
      run('R13', () => {
        const list = (pitchesBy[u] || []).filter(x => {
          const st = String(x.d.stage || '').toLowerCase();
          return st !== 'won' && st !== 'lost' && x.d.nextDate && x.d.nextDate < today;
        }).sort((a, b) => (a.d.nextDate < b.d.nextDate ? -1 : 1));
        for (const {id, d: p} of list) {
          const n = U.daysBetween(p.nextDate, today);
          if (!(n > 0)) continue;
          push('R13', u, 'medium', trunc(p.brand || 'Pitch', 50) + ', next step due ' + U.fmtDay(p.nextDate) + ', ' + plural(n, 'day', 'days') + ' overdue', null, null, id);
        }
      });

      /* R14: a project off track, or due within 3 days with progress under 70% */
      run('R14', () => {
        for (const {id, d: p} of (projectsBy[u] || [])) {
          if (p.archived || p.status === 'done') continue;
          const pr = progress[id] || {done: 0, total: 0};
          const pct = U.pct(pr.done, pr.total);
          let text = null;
          if (p.status === 'off') text = trunc(p.name || 'Project', 50) + ' is off track, ' + pct + '% done';
          else if (p.due && U.daysBetween(today, p.due) <= 3 && pct < 70) text = trunc(p.name || 'Project', 50) + ', due ' + U.fmtDay(p.due) + ', ' + pct + '% done';
          if (!text) continue;
          push('R14', u, 'medium', text, null, '#projects/' + id, id);
        }
      });

      /* R15: a live client with an empty brain field, or untouched for 60 days */
      run('R15', () => {
        for (const {id, d: c} of (clientsBy[u] || [])) {
          if (c.status !== 'live') continue;
          const empty = [];
          if (!String(c.memory || '').trim()) empty.push('memory');
          if (!String(c.approvals || '').trim()) empty.push('approvals');
          if (!String(c.never || '').trim()) empty.push('lines never to cross');
          const upd = Number(c.updated) || 0;
          const stale = upd > 0 && upd < nowMs - 60 * DAY;
          if (!empty.length && !stale) continue;
          const parts = [];
          if (empty.length) parts.push(joinList(empty) + (empty.length === 1 ? ' is empty' : ' are empty'));
          if (stale) parts.push('last updated ' + Math.floor((nowMs - upd) / DAY) + ' days ago');
          push('R15', u, 'low', trunc(c.name || 'Client', 50) + ': ' + parts.join(', '), null, null, id);
        }
      });

      /* R16: an evaluation still missing after the candidate deadline.
         Another evaluator's document is hidden from a member, so a member computes this for themselves only. */
      run('R16', () => {
        if (!(ctx.isFounder || u === ctx.uid)) return;
        const mine = (evals[u] && evals[u].e) || {};
        for (const id of candidateIds) {
          const c = candidates[id];
          if (!c || !Array.isArray(c.evaluators) || c.evaluators.indexOf(u) < 0) continue;
          if (c.decision || c.stage === 'hired' || c.stage === 'rejected') continue;
          if (!c.deadline || c.deadline >= today) continue;
          if (mine[id]) continue;
          push('R16', u, 'medium', trunc(c.name || 'Candidate', 50) + ', evaluation was due ' + U.fmtDay(c.deadline), null, null, id);
        }
      });
    }
    return out;
  }

  M.rules = {evaluate, NAMES, SECTION_RULES, name, TEMPLATES, SECTION_OF, RULE_IDS: Object.keys(TEMPLATES)};
})();
