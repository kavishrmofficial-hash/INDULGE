/* m360 OS app state: boot context, subscriptions, derived data. */
'use strict';
(function () {
  const {html, React, U} = M;

  M.Ctx = React.createContext(null);
  M.useCtx = () => React.useContext(M.Ctx);

  M.SETTINGS_DEFAULTS = {
    office: null, start: '10:30', grace: 15, eodCut: '19:30', mondayCut: '12:00',
    wfhCap: 2, revCap: 2, ackHours: 48, blockerDays: 2, holidays: [],
    rules: {}, points: {}, leaderboardIncludesFounder: false,
    locked: false, lockNote: '', joinPolicy: 'open', alert: null, signoff: true,
    quietMins: 120, lunchFrom: '13:30', lunchTo: '14:30',
    /* personal managers (M.pm): every manager's bot chases their reports, the person first, then the
       manager, then one note a day up the line. Off until the founder switches it on in Admin; a manager
       cannot switch their own bot off (require), only the founder can (off: {<uid>: true}). A nested
       object: readers deep-merge it through M.pm.P */
    pm: {
      on: false, require: true, off: {},
      kinds: {noin: true, noeod: true, overdue: true, sentback: true, chase: true, quiet: true, waiton: true, noout: true, idle: false, short: false},
      wait: 60, waitMin: 30, waitMax: 180, carry: 120, digestAt: '17:30',
      perDay: 4, mgrPerDay: 6, quietMax: 2, askPerDay: 3, minHours: 0, coachDays: 10, blockerMins: 120, mail: true
    },
    /* voice and chat commands: how far one ask reaches and what needs a tap */
    agent: {on: true, bulkMax: 12, perSenderDay: 40, spokenYes: true, pressConfirmed: true},
    /* the m360 COO (M.coo): off until the founder switches it on. caps hold the rung for each capability
       (alone, tell, draft, propose, off); the policy numbers the founder has not set stay null, and a null
       fails closed (a card asks for the number). A nested object: readers deep-merge it through M.coo.cfg.
       The bot's display name is title, never name. edgeone/server/coo.js keeps COO_DEFAULTS equal to this */
    coo: {
      on: false, title: 'm360 COO', pausedUntil: null, practiceUntil: null, version: 1, signedAt: null, signedBy: null,
      caps: {roll: 'alone', nudge: 'alone', leave: 'tell', wfh: 'tell', cover: 'tell', rebalance: 'tell', shift: 'tell', orphans: 'tell', reviews: 'alone', projects: 'tell',
        clientMail: 'draft', meetingMail: 'draft', invoiceMail: 'draft', clientDates: 'propose', memo: 'alone', reviewPrep: 'draft', structure: 'propose'},
      limits: {actsPerDay: 120, tellPerDay: 25, movesPerDay: 8, movesPerPersonDay: 3, movesPerTaskWeek: 1, shiftsPerDay: 12, leaveApprovalsPerDay: 6, asksPerDay: 30,
        asksPerPersonDay: 2, draftsPerDay: 10, draftsPerClientWeek: 1, aiPerDay: 40, foundMailsPerDay: 2},
      leave: {yearStart: '04-01', perType: {casual: 12, sick: 12, other: null}, maxAutoDays: 2, noticeDays: {casual: 3, sick: 0, other: 7}, probationLop: false,
        maxOutPerDay: 2, maxOutPerPod: 1, blackout: []},
      wfh: {minOffice: 0},
      load: {maxOpen: 12, maxOverdue: 3, margin: 1.5},
      stuck: {lead: 14, qualified: 14, diagnostic: 10, proposal: 7, negotiation: 10},
      digest: {mail: 'away'}, memoDay: 'sat', off: {}
    }
  };
  /* the day v33 shipped: a 'swap' leave request before it keeps its old meaning (a day off, so past payroll
     stands); from it on, an approved swap is a WFH day */
  M.COO_SINCE = '2026-10-05';

  /* view as: the founder previews the app as one member. Held in memory only, never persisted. */
  let viewAsUid = null;
  const viewAsSubs = new Set();
  M.viewAs = {
    get: () => viewAsUid,
    set(uid) {
      const next = uid ? String(uid) : null;
      if (next === viewAsUid) return;
      viewAsUid = next;
      viewAsSubs.forEach(fn => fn());
    },
    subscribe(fn) { viewAsSubs.add(fn); return () => { viewAsSubs.delete(fn); }; }
  };
  const LOCK_MSG = 'm360 is locked right now. Try again later.';
  const PREVIEW_MSG = 'Preview mode. Nothing saves.';
  M.POINTS_DEFAULTS = {
    checkinOnTime: 2, eod: 2, planOnTime: 4, planLate: 1, outcomeHit: 12, outcomeMiss: -6,
    taskOnTime: 6, taskLate: 2, revision: -2, shown20: 2, qualityMult: 4, kudos: 3,
    rockDone: 20, overdueOpen: -2
  };
  M.RULE_IDS = ['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16','R17'];

  const COLLS = ['checkin','eod','plan','review','rocks','feed','reacts','acks','kudos','leave','leavedec',
    'tasks','projects','pitches','clients','handbook','candidates','evals','pulse','ideas','votes','access','onboard','me','fixes','contacts','orgs','chat','chatrooms','dm','play','approvals'];

  /* the books (invoices, expenses, payroll, HR letters, billing setup): the owner's alone, subscribed by nobody else */
  const BOOK_COLLS = ['books', 'invoices', 'expenses', 'payroll', 'hr'];
  const OFF_COLL = Object.freeze({ready: false, map: Object.freeze({}), off: true});
  /* AppState wraps the whole signed-in app: subscribes once per collection, computes ctx. */
  M.AppState = function AppState({boot, children}) {
    const {db, user, mcp, downloads, permissions, sample, room, me} = boot;
    M.userNs = user;
    /* the signed-in person, and the person the page renders as (the same unless the founder previews) */
    const realUid = me.id;
    const viewAs = React.useSyncExternalStore(M.viewAs.subscribe, M.viewAs.get, M.viewAs.get);
    const uid = viewAs || realUid;
    const baseW = React.useMemo(() => M.makeWrites(db), [db]);
    /* private per-user docs (own state; founder: keeper and finance); part of ctx so a change re-renders */
    const privState = M.useDoc(db, 'data/users/' + uid + '/state');
    const privKeeper = M.useDoc(db, me.isOwner ? 'data/users/' + uid + '/keeper' : null);
    const privFinance = M.useDoc(db, me.isOwner ? 'data/users/' + uid + '/finance' : null);
    /* prospects (M.prospects): every member's own people, follow-ups and meetings, on the signed-in person's
       id whatever the preview shows; never a collection, so the COO and the office never read it */
    const privPros = M.useDoc(db, viewAs ? null : 'data/users/' + realUid + '/prospects');

    const rosterDoc = M.useDoc(db, 'roster/team');
    const settingsDoc = M.useDoc(db, 'settings/app');
    /* on the team site the Base is searched on the server; the page holds it only while something needs all of it */
    const remoteBase = !!window.M360_STANDALONE;
    const [baseOn, setBaseOn] = React.useState(() => !remoteBase || M.baseNeed.n > 0);
    React.useEffect(() => { if (!remoteBase) return; const f = n => { if (n > 0) setBaseOn(true); }; M.baseNeed.subs.add(f); return () => M.baseNeed.subs.delete(f); }, []);
    const coll = {};
    for (const c of COLLS) coll[c] = M.useColl(db, (c === 'contacts' || c === 'orgs') && !baseOn ? null : c);
    /* a deleted task leaves every list and sits in the bin (coll.tasks.trash) until the founder settles it */
    const rawTasks = coll.tasks;
    coll.tasks = React.useMemo(() => {
      const map = {}, trash = {};
      for (const id of Object.keys(rawTasks.map || {})) { const t = rawTasks.map[id]; if (t && t.deleted) trash[id] = t; else map[id] = t; }
      return {...rawTasks, map, trash};
    }, [rawTasks]);
    /* an archived client leaves every list and sits with the founder (coll.clients.archived) */
    const rawClients = coll.clients;
    coll.clients = React.useMemo(() => {
      const map = {}, archived = {};
      for (const id of Object.keys(rawClients.map || {})) { const c = rawClients.map[id]; if (c && c.archived) archived[id] = c; else map[id] = c; }
      return {...rawClients, map, archived};
    }, [rawClients]);
    if (!baseOn) { coll.contacts = OFF_COLL; coll.orgs = OFF_COLL; }
    /* join requests: only the founder lists them; everyone else reads their own */
    const rm = ((rosterDoc.data || {}).members || {})[realUid];
    const founderish = !!me.isOwner || !!(rm && rm.role === 'founder' && rm.active !== false);
    coll.join = M.useColl(db, founderish ? 'join' : null);
    for (const c of BOOK_COLLS) coll[c] = M.useColl(db, me.isOwner ? c : null);

    /* who the page renders as: in preview the founder becomes a plain member */
    const members0 = (rosterDoc.data || {}).members || {};
    const member0 = members0[uid] || null;
    /* a roster founder who is not the owner only gets the founder view where the host lets them write admin paths */
    const isFounder = !viewAs && (!!me.isOwner || !!(member0 && member0.role === 'founder' && member0.active !== false && (window.M360_STANDALONE || me.canEdit !== false)));
    const locked = !!(settingsDoc.data && settingsDoc.data.locked);

    /* writes: refused client side while the workspace is locked (members) or a preview is on (everyone) */
    const W = React.useMemo(() => {
      if (!viewAs && !(locked && !isFounder)) return baseW;
      const msg = viewAs ? PREVIEW_MSG : LOCK_MSG;
      const allowed = p => !viewAs && (p === 'me/' + uid || p === 'join/' + uid);
      const refuse = () => { M.toast(msg, true); return Promise.reject({code: 'locked', message: msg}); };
      const wrap = fn => (p, d) => allowed(p) ? fn(p, d) : refuse();
      const as = (who, o) => { const b = baseW.as(who, o); return {set: wrap(b.set), update: wrap(b.update), merge: wrap(b.merge)}; };
      return {set: wrap(baseW.set), update: wrap(baseW.update), merge: wrap(baseW.merge), del: wrap(baseW.del), as};
    }, [baseW, locked, isFounder, uid, viewAs]);

    /* profile photos ride in me/<uid>.photo; avatars everywhere read M.photos */
    React.useEffect(() => {
      const next = {};
      let changed = false;
      for (const id of Object.keys(coll.me.map)) { const ph = coll.me.map[id] && coll.me.map[id].photo; if (ph) next[id] = ph; }
      const cur = M.photos || {};
      if (Object.keys(cur).length !== Object.keys(next).length || Object.keys(next).some(k => cur[k] !== next[k])) changed = true;
      if (changed) { M.photos = next; if (M.profilesBump) M.profilesBump(); }
    }, [coll.me]);

    /* founder auto-added to the roster on first open */
    const seeded = React.useRef(false);
    React.useEffect(() => {
      if (!rosterDoc.ready || seeded.current) return;
      if (me.isOwner && !rosterDoc.data && !rosterDoc.err) {
        seeded.current = true;
        baseW.set('roster/team', {
          members: {[realUid]: {role: 'founder', empId: 'M360-001', title: 'Founder', pod: '',
            joined: U.todayStr(), start: '', probationEnd: '', active: true}},
          nextEmp: 2, updated: Date.now(), owner: realUid
        });
      }
    }, [rosterDoc.ready, rosterDoc.data, me.isOwner, realUid, baseW]);

    const now = M.useNow();
    const online = M.usePresence(room, realUid);

    /* the COO (M.coo): office/live for everyone; coo/now, the decisions, today's and yesterday's ledger and
       its state for the founder only. IST days, as the COO keeps them; the collection is never subscribed whole */
    const cooDays = [0, 1].map(n => new Date(now + 330 * 60000 - n * 86400000).toISOString().slice(0, 10));
    const cooLive = M.useDoc(db, 'office/live');
    const cooNow = M.useDoc(db, isFounder ? 'coo/now' : null);
    const cooDec = M.useDoc(db, isFounder ? 'coo/dec' : null);
    const cooL0 = M.useDoc(db, isFounder ? 'coo/L-' + cooDays[0] : null);
    const cooL1 = M.useDoc(db, isFounder ? 'coo/L-' + cooDays[1] : null);
    const cooState = M.useDoc(db, isFounder ? 'coo/state' : null);

    const ctx = React.useMemo(() => {
      const roster = rosterDoc.data || null;
      const members = (roster && roster.members) || {};
      const member = members[uid] || null;
      /* the founder everyone reads shared founder docs from: the owner, else the first founder on the roster */
      let founderUid = me.isOwner ? realUid : ((roster && roster.owner) || null);
      if (!founderUid) {
        const fs = Object.keys(members).filter(k => members[k].role === 'founder' && members[k].active !== false)
          .sort((a, b) => String(members[a].empId || '').localeCompare(String(members[b].empId || '')));
        founderUid = fs[0] || null;
      }
      const s0 = settingsDoc.data || {};
      const settings = {...M.SETTINGS_DEFAULTS, ...s0,
        rules: {...Object.fromEntries(M.RULE_IDS.map(r => [r, true])), ...(s0.rules || {})},
        points: {...M.POINTS_DEFAULTS, ...(s0.points || {})}};
      const holidays = new Set(settings.holidays || []);

      const activeMembers = Object.keys(members)
        .filter(k => members[k].active !== false)
        .map(k => ({uid: k, ...members[k]}))
        .sort((a, b) => String(a.empId || '').localeCompare(String(b.empId || '')));

      /* approved leave dates per person, and approved WFH days booked ahead. The dates come from the
         decision's snap when it has one (what was approved, whatever the request says now); a 'wfh' request
         is never leave, and a 'swap' is leave only before M.COO_SINCE, a WFH day from it on */
      const leaveMap = {}, wfhMap = {};
      for (const lu of Object.keys(coll.leave.map)) {
        const reqs = (coll.leave.map[lu] || {}).reqs || [];
        const dec = (coll.leavedec.map[lu] || {}).d || {};
        const set = new Set(), wfh = new Set();
        for (const r of reqs) {
          if (!r || !r.id) continue;
          const dd = dec[r.id] || {};
          if (dd.status !== 'approved') continue;
          const sn = dd.snap && dd.snap.from && dd.snap.to ? dd.snap : r;
          const type = sn.type || r.type;
          if (!sn.from || !sn.to) continue;
          let d = U.parseYmd(sn.from);
          const end = U.parseYmd(sn.to);
          let guard = 0;
          while (d <= end && guard++ < 370) {
            const day = U.ymd(d);
            if (type === 'wfh' || (type === 'swap' && day >= M.COO_SINCE)) wfh.add(day); else set.add(day);
            d = U.addDays(d, 1);
          }
        }
        leaveMap[lu] = set;
        if (wfh.size) wfhMap[lu] = wfh;
      }
      /* a check-in day marked leave counts only when the founder's fix set it (fixedBy): a person cannot mark
         their own day as leave */
      const onLeave = (u, date) => !!((leaveMap[u] && leaveMap[u].has(date)) ||
        (coll.checkin && (d => d.mode === 'leave' && !!d.fixedBy)((((coll.checkin.map[u] || {}).days || {})[date] || {}))));
      const isWorkingDay = (date, u) => {
        const d = U.parseYmd(date);
        if (d.getDay() === 0) return false;
        if (holidays.has(date)) return false;
        if (u && onLeave(u, date)) return false;
        return true;
      };
      const startFor = u => {
        const m = members[u];
        return (m && m.start) || settings.start;
      };

      /* private detail (locations, exact times, late marks, scores, leave) shows to the founder and the person only */
      const canSee = u => isFounder || u === uid || !!(M.lines && M.lines.managerFrom(members, founderUid, u) === uid);

      /* the COO's documents: the team-safe office feed for everyone, the rest for the founder alone */
      const coo = {live: cooLive.data || null, ready: cooLive.ready};
      if (isFounder) Object.assign(coo, {now: cooNow.data, dec: cooDec.data, state: cooState.data, L: {[cooDays[0]]: cooL0.data, [cooDays[1]]: cooL1.data},
        ready: cooNow.ready && cooDec.ready && cooL0.ready && cooState.ready});

      return {db, user, mcp, downloads, permissions, sample, room, me, uid, realUid, viewAs, W, coo, wfhMap,
        priv: {state: privState, keeper: isFounder ? privKeeper : {ready: true, data: null}, finance: isFounder ? privFinance : {ready: true, data: null},
          prospects: viewAs ? {ready: true, data: null} : privPros},
        ready: rosterDoc.ready && settingsDoc.ready,
        roster, members, member, activeMembers, isFounder, isOwner: !viewAs && !!me.isOwner, founderUid, locked, remoteBase, baseOn,
        settings, holidays, coll, leaveMap, onLeave, isWorkingDay, startFor, canSee, now, online};
    }, [rosterDoc, settingsDoc, me, uid, realUid, viewAs, isFounder, locked, W, now, online, coll.join,
      privState, privKeeper, privFinance, privPros, cooLive, cooNow, cooDec, cooL0, cooL1, cooState, ...COLLS.map(c => coll[c]), ...BOOK_COLLS.map(c => coll[c])]);

    /* rules engine output, computed once per context (the context changes with every snapshot and each minute) */
    const flags = React.useMemo(() => (M.rules && M.rules.evaluate) ? M.rules.evaluate(ctx, new Date()) : [], [ctx]);
    ctx.flags = flags;
    ctx.myFlags = flags.filter(f => f.uid === ctx.uid);
    M.lastCtx = ctx;

    return html`<${M.Ctx.Provider} value=${ctx}>${children}<//>`;
  };
})();
