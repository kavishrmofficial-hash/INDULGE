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
    locked: false, lockNote: '', joinPolicy: 'open', alert: null
  };

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
  M.RULE_IDS = ['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16'];

  const COLLS = ['checkin','eod','plan','review','rocks','feed','reacts','acks','kudos','leave','leavedec',
    'tasks','projects','pitches','clients','handbook','candidates','evals','pulse','ideas','votes','access','onboard','me','fixes','contacts','orgs'];

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

    const rosterDoc = M.useDoc(db, 'roster/team');
    const settingsDoc = M.useDoc(db, 'settings/app');
    const coll = {};
    for (const c of COLLS) coll[c] = M.useColl(db, c);
    /* join requests: only the founder lists them; everyone else reads their own */
    const rm = ((rosterDoc.data || {}).members || {})[realUid];
    const founderish = !!me.isOwner || !!(rm && rm.role === 'founder' && rm.active !== false);
    coll.join = M.useColl(db, founderish ? 'join' : null);

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
      return {set: wrap(baseW.set), update: wrap(baseW.update), merge: wrap(baseW.merge), del: wrap(baseW.del)};
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

      /* approved leave dates per person */
      const leaveMap = {};
      for (const lu of Object.keys(coll.leave.map)) {
        const reqs = (coll.leave.map[lu] || {}).reqs || [];
        const dec = (coll.leavedec.map[lu] || {}).d || {};
        const set = new Set();
        for (const r of reqs) {
          if (!r || !r.from || !r.to) continue;
          if ((dec[r.id] || {}).status !== 'approved') continue;
          let d = U.parseYmd(r.from);
          const end = U.parseYmd(r.to);
          let guard = 0;
          while (d <= end && guard++ < 370) { set.add(U.ymd(d)); d = U.addDays(d, 1); }
        }
        leaveMap[lu] = set;
      }
      const onLeave = (u, date) => !!((leaveMap[u] && leaveMap[u].has(date)) ||
        (coll.checkin && ((((coll.checkin.map[u] || {}).days || {})[date] || {}).mode === 'leave')));
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
      const canSee = u => isFounder || u === uid;

      return {db, user, mcp, downloads, permissions, sample, room, me, uid, realUid, viewAs, W,
        priv: {state: privState, keeper: isFounder ? privKeeper : {ready: true, data: null}, finance: isFounder ? privFinance : {ready: true, data: null}},
        ready: rosterDoc.ready && settingsDoc.ready,
        roster, members, member, activeMembers, isFounder, founderUid, locked,
        settings, holidays, coll, leaveMap, onLeave, isWorkingDay, startFor, canSee, now, online};
    }, [rosterDoc, settingsDoc, me, uid, realUid, viewAs, isFounder, locked, W, now, online, coll.join,
      privState, privKeeper, privFinance, ...COLLS.map(c => coll[c])]);

    /* rules engine output, computed each render pass */
    ctx.flags = (M.rules && M.rules.evaluate) ? M.rules.evaluate(ctx, new Date()) : [];
    ctx.myFlags = ctx.flags.filter(f => f.uid === ctx.uid);
    M.lastCtx = ctx;

    return html`<${M.Ctx.Provider} value=${ctx}>${children}<//>`;
  };
})();
