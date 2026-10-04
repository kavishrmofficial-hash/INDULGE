/* module: lines. Who reports to whom, and what a manager sees. A person reports to whoever Admin
   names on their roster line; with nobody named, to the pod lead of their pod; with no lead, to
   Kaavish. A manager sees their reports' private detail (check-in times, late marks, scores, leave),
   and gets a watch on each report for the day: not checked in past start and grace, no check-out
   after the EOD cut, no EOD line, nothing moved on their tasks by mid afternoon, overdue work, a
   late check-in, and every quiet stretch (nothing recorded on m360 for settings.quietMins, see
   M.quiet). The watch sits on the manager's Home and lands in their inbox. */
'use strict';
(function () {
  const {U} = M;

  /* who uid reports to, from the roster alone (the context calls this before it exists) */
  const managerFrom = (members, founderUid, uid) => {
    const m = members[uid];
    if (!m) return null;
    if (m.reportsTo && m.reportsTo !== uid && members[m.reportsTo] && members[m.reportsTo].active !== false) return m.reportsTo;
    if (m.role === 'founder' || uid === founderUid) return null;
    if (m.pod) {
      const lead = Object.keys(members).find(k => k !== uid && members[k].active !== false && members[k].role === 'lead' && members[k].pod === m.pod);
      if (lead) return lead;
    }
    return founderUid && founderUid !== uid ? founderUid : null;
  };
  const managerOf = (ctx, uid) => managerFrom(ctx.members || {}, ctx.founderUid, uid);
  const reportsOf = (ctx, uid) => (ctx.activeMembers || []).filter(x => x.uid !== uid && managerOf(ctx, x.uid) === uid).map(x => x.uid);
  const chainOf = (ctx, uid) => { const out = []; let cur = managerOf(ctx, uid); while (cur && out.indexOf(cur) < 0 && out.length < 8) { out.push(cur); cur = managerOf(ctx, cur); } return out; };
  const isManager = (ctx, uid) => reportsOf(ctx, uid).length > 0;

  /* the tasks, read once per version of the map for every watch that follows: each person's own tasks,
     and the last moment they moved anything (their task updated, a task they created or approved, a
     comment of theirs). A task the m360 COO handed over or re-dated last (updatedBy) is not the owner's
     own movement */
  const taskIdx = new WeakMap();
  function tasksBy(tmap) {
    let ix = taskIdx.get(tmap);
    if (ix) return ix;
    ix = {owned: {}, moved: {}};
    const touch = (u, at) => { at = Number(at) || 0; if (u && at > (ix.moved[u] || 0)) ix.moved[u] = at; };
    for (const id of Object.keys(tmap)) {
      const t = tmap[id];
      if (!t || t.deleted) continue;
      if (t.owner) { (ix.owned[t.owner] = ix.owned[t.owner] || []).push(t); if (!(M.coo && M.coo.isCoo(t.updatedBy))) touch(t.owner, t.updated); }
      touch(t.by, t.created);
      touch(t.approvedBy, t.approvedAt);
      const cs = t.comments || {};
      for (const cid of Object.keys(cs)) if (cs[cid]) touch(cs[cid].by, cs[cid].at);
    }
    taskIdx.set(tmap, ix);
    return ix;
  }

  /* the day's watch on one person, as the manager should read it */
  function watch(ctx, uid, at) {
    const now = at ? new Date(at) : new Date(ctx.now || Date.now());
    const ymd = U.ymd(now);
    const out = [];
    if (!ctx.members[uid] || ctx.members[uid].active === false) return out;
    const a = M.att ? M.att.dayStatus(ctx, uid, ymd) : {status: 'none'};
    if (a.status === 'leave' || a.status === 'holiday' || a.status === 'sunday') return out;
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = U.minutes(String(ctx.startFor(uid) || ctx.settings.start || '10:30')) + (Number(ctx.settings.grace) || 0);
    const cut = U.minutes(String(ctx.settings.eodCut || '19:30'));
    const dayStart = U.parseYmd(ymd).getTime();
    const atMin = m => dayStart + m * 60000;   /* each flag carries the moment its condition began, so the inbox counts it once */
    const ref = '#people/' + uid;
    if (!a.in && mins > start) out.push({k: 'noin', hot: true, at: atMin(start), text: 'has not checked in (start ' + ctx.startFor(uid) + ')', ref});
    if (a.in && a.late) out.push({k: 'late', hot: false, at: a.in, text: 'checked in late, at ' + U.hhmm(a.in), ref});
    if (a.in && !a.out && mins > cut + 60) out.push({k: 'noout', hot: false, at: atMin(cut + 60), text: 'has not checked out', ref});
    const eod = ((ctx.coll.eod.map[uid] || {}).days || {})[ymd];
    if (!eod && mins > cut) out.push({k: 'noeod', hot: true, at: atMin(cut), text: 'no EOD line today', ref});
    /* movement: anything of theirs created, moved, finished or commented on today */
    const ix = tasksBy(ctx.coll.tasks.map);
    const moved = (ix.moved[uid] || 0) >= dayStart;
    let overdue = 0, open = 0;
    for (const t of (ix.owned[uid] || [])) if (t.status !== 'done') { open++; if (t.due && t.due < ymd) overdue++; }
    if (!moved && a.in && mins > 14 * 60) out.push({k: 'idle', hot: true, at: atMin(14 * 60), text: 'nothing moved on their tasks today' + (open ? ' (' + open + ' open)' : ''), ref: ref});
    if (overdue) out.push({k: 'overdue', hot: overdue > 1, at: dayStart, text: overdue + (overdue === 1 ? ' overdue task' : ' overdue tasks'), ref: ref});
    /* quiet stretches (M.quiet): one flag per stretch, keyed by when it began so the inbox counts it once,
       from while it runs to after it closes; at is the moment it ran past the threshold, when the flag
       first shows. A stretch still running is hot, a closed one only when it ran past twice the threshold */
    if (M.quiet) {
      const q = M.quiet.day(ctx, uid, ymd, {now: now.getTime()});
      for (const st of q.stretches) out.push({k: 'quiet', key: 'quiet' + U.hhmm(st.from).replace(':', ''), hot: st.live || st.quietMs >= 2 * q.mins * 60000,
        at: st.at || st.from, from: st.from, text: M.quiet.line(st) + (q.status ? ', status: ' + q.status : ''), ref, live: st.live});
    }
    return out;
  }

  /* every report with their watch, for a manager; the founder gets everyone who reports to them */
  const board = (ctx, uid, at) => reportsOf(ctx, uid).map(r => ({uid: r, flags: watch(ctx, r, at)}));

  M.lines = {managerFrom, managerOf, reportsOf, chainOf, isManager, watch, board};
})();
