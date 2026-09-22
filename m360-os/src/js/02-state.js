/* m360 OS app state: boot context, subscriptions, derived data. */
'use strict';
(function () {
  const {html, React, U} = M;

  M.Ctx = React.createContext(null);
  M.useCtx = () => React.useContext(M.Ctx);

  M.SETTINGS_DEFAULTS = {
    office: null, start: '10:30', grace: 15, eodCut: '19:30', mondayCut: '12:00',
    wfhCap: 2, revCap: 2, ackHours: 48, blockerDays: 2, holidays: [],
    rules: {}, points: {}, leaderboardIncludesFounder: false
  };
  M.POINTS_DEFAULTS = {
    checkinOnTime: 2, eod: 2, planOnTime: 4, planLate: 1, outcomeHit: 12, outcomeMiss: -6,
    taskOnTime: 6, taskLate: 2, revision: -2, shown20: 2, qualityMult: 4, kudos: 3,
    rockDone: 20, overdueOpen: -2
  };
  M.RULE_IDS = ['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16'];

  const COLLS = ['checkin','eod','plan','review','rocks','feed','reacts','acks','kudos','leave','leavedec',
    'tasks','projects','pitches','clients','handbook','candidates','evals','pulse','ideas','votes','access','onboard','me'];

  /* AppState wraps the whole signed-in app: subscribes once per collection, computes ctx. */
  M.AppState = function AppState({boot, children}) {
    const {db, user, mcp, downloads, permissions, sample, room, me} = boot;
    M.userNs = user;
    const uid = me.id;
    const W = React.useMemo(() => M.makeWrites(db), [db]);

    const rosterDoc = M.useDoc(db, 'roster/team');
    const settingsDoc = M.useDoc(db, 'settings/app');
    const coll = {};
    for (const c of COLLS) coll[c] = M.useColl(db, c);
    /* join requests: only the founder lists them; everyone else reads their own */
    const rm = ((rosterDoc.data || {}).members || {})[uid];
    const founderish = !!me.isOwner || !!(rm && rm.role === 'founder' && rm.active !== false);
    coll.join = M.useColl(db, founderish ? 'join' : null);

    /* founder auto-added to the roster on first open */
    const seeded = React.useRef(false);
    React.useEffect(() => {
      if (!rosterDoc.ready || seeded.current) return;
      if (me.isOwner && !rosterDoc.data) {
        seeded.current = true;
        W.set('roster/team', {
          members: {[uid]: {role: 'founder', empId: 'M360-001', title: 'Founder', pod: '',
            joined: U.todayStr(), start: '', probationEnd: '', active: true}},
          nextEmp: 2, updated: Date.now()
        });
      }
    }, [rosterDoc.ready, rosterDoc.data, me.isOwner, uid, W]);

    const now = M.useNow();
    const online = M.usePresence(room, uid);

    const ctx = React.useMemo(() => {
      const roster = rosterDoc.data || null;
      const members = (roster && roster.members) || {};
      const member = members[uid] || null;
      const isFounder = !!me.isOwner || !!(member && member.role === 'founder' && member.active !== false);
      let founderUid = me.isOwner ? uid : null;
      for (const k of Object.keys(members)) if (members[k].role === 'founder' && members[k].active !== false) { founderUid = founderUid || k; if (!me.isOwner) founderUid = k; }
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
      const onLeave = (u, date) => !!(leaveMap[u] && leaveMap[u].has(date));
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

      return {db, user, mcp, downloads, permissions, sample, room, me, uid, W,
        ready: rosterDoc.ready && settingsDoc.ready,
        roster, members, member, activeMembers, isFounder, founderUid,
        settings, holidays, coll, leaveMap, onLeave, isWorkingDay, startFor, canSee, now, online};
    }, [rosterDoc, settingsDoc, me, uid, W, now, online, coll.join,
      ...COLLS.map(c => coll[c])]);

    /* private per-user docs (own state; founder: keeper and finance) */
    ctx.priv = {
      state: M.useDoc(db, 'data/users/' + uid + '/state'),
      keeper: M.useDoc(db, ctx.isFounder ? 'data/users/' + uid + '/keeper' : null),
      finance: M.useDoc(db, ctx.isFounder ? 'data/users/' + uid + '/finance' : null)
    };

    /* rules engine output, computed each render pass */
    ctx.flags = (M.rules && M.rules.evaluate) ? M.rules.evaluate(ctx, new Date()) : [];
    ctx.myFlags = ctx.flags.filter(f => f.uid === ctx.uid);
    M.lastCtx = ctx;

    return html`<${M.Ctx.Provider} value=${ctx}>${children}<//>`;
  };
})();
