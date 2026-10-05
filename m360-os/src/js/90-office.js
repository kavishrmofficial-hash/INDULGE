/* module: office. The virtual office (v33): a calm, truthful, live drawing of the studio and of the m360 COO
   at work. One inline SVG floor plan in the house tokens (ink line on paper, flame accents), a DOM overlay
   of buttons (every station and every desk, so the buddy's scan can point at them), and exactly one plush
   droid on a canvas, moved by the Web Animations API along the walkways. Every walk and bubble comes from
   a settled ledger row (M.coo.feed) or from coo/now and office/live; between rounds it rests at its desk.
   No per-frame script here: transforms and opacity only, the minute ticker, and the data snapshots.

     M.pages.Office({scope})             the #office page: the scene, the rail, Office or List
     M.parts.OfficeWindow({mode, scope}) a camera on the scene for HQ, Home and the COO tab
     M.office {layout, desks, path, queue, STATION_POS}

   The COO's words come from M.coo.copy only: rows carry codes, ids and args, and each viewer gets the
   founder line or the team's generic line. Members never see late, quiet, leave types, reasons or money. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback} = React;

  const MIN = 60000, IST_MS = 330 * MIN;
  /* plan units: a 1600 by 1000 floor, 260 more for each row of benches past two */
  const PLAN_W = 1600, PLAN_H = 1000, GROW = 260;
  const BENCH_W = 360, BENCH_H = 160, DESK_W = 120, COLS = [300, 760], ROW0 = 250;
  const SPEED = 240;                              /* plan units a second, a walk clamped to 1.2 to 3.5 s */
  const EASE = 'cubic-bezier(.2,.7,.2,1)';
  const BURST = 6;                                /* animated steps per arrival batch */
  const LIVE_MS = 2 * MIN;                        /* younger rows play as live, older ones say when */
  const SETTLED = {done: 1, would: 1, failed: 1};
  const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const C = () => M.coo || null;
  const isCoo = u => (C() && C().isCoo ? C().isCoo(u) : u === 'u_m360coo');

  /* ---------- IST, whatever the device clock says ---------- */
  const istYmd = ms => (C() && C().ist ? C().ist.ymd(ms) : new Date(ms + IST_MS).toISOString().slice(0, 10));
  const istHm = ms => (C() && C().ist ? C().ist.hm(ms) : new Date(ms + IST_MS).toISOString().slice(11, 16));
  const istMins = ms => { const d = new Date(ms + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const istDayStart = ms => Date.parse(istYmd(ms) + 'T00:00:00Z') - IST_MS;
  /* the office day: closed on Sundays and holidays, lights down after the 21:00 close and before 09:00 */
  function dayOf(ctx, now) {
    const ymd = istYmd(now), mins = istMins(now), dow = new Date(now + IST_MS).getUTCDay();
    const holiday = !!(ctx && ctx.holidays && ctx.holidays.has && ctx.holidays.has(ymd));
    const closed = dow === 0 || holiday;
    /* after the close, does it open again in the morning (not a Sunday or a holiday tomorrow) */
    const next = istYmd(now + 86400000);
    const opens = mins < 540 || (dow !== 6 && !(ctx && ctx.holidays && ctx.holidays.has && ctx.holidays.has(next)));
    return {ymd, mins, dow, holiday, closed, opens, night: closed || mins < 540 || mins >= 1260};
  }

  /* ---------- the floor plan ---------- */
  /* the walkway crossings and the stations shift down with the plan as it grows (anything below y 700) */
  const sy = (L, y) => (y >= 700 ? y + L.grow : y);
  const at = (L, p) => ({x: p[0], y: sy(L, p[1])});
  /* where the COO stands at each station (x, y), the aisle point it leaves the walkways from (via), and
     the doorways it passes on the way in (door) */
  const STATION_POS = {
    attendance: {x: 232, y: 662, via: [250, 662]},
    calendar: {x: 460, y: 200, via: [460, 200]},
    board: {x: 810, y: 200, via: [810, 200]},
    review: {x: 1140, y: 410, via: [1140, 410]},
    desk: {x: 410, y: 862, via: [410, 780], seat: true},
    meeting: {x: 1400, y: 266, via: [1140, 200], door: [[1214, 206]]},
    clients: {x: 250, y: 340, via: [250, 340]},
    mail: {x: 630, y: 866, via: [630, 780]},
    tray: {x: 1172, y: 662, via: [1140, 662]},
    books: {x: 1496, y: 900, via: [1140, 662], door: [[1214, 650], [1300, 860]]},
    reception: {x: 206, y: 760, via: [250, 760]},
    clock: {x: 1140, y: 200, via: [1140, 200]}
  };
  /* the places it goes between rounds, and on the open and close walks */
  const SPOTS = {
    door: {x: 44, y: 862, via: [250, 780]},
    founder: {x: 1330, y: 748, via: [1140, 662], door: [[1214, 650]]},
    coffee: {x: 900, y: 866, via: [900, 780]},
    window: {x: 300, y: 200, via: [300, 200]},
    plant: {x: 500, y: 850, via: [500, 780]},
    lampsA: {x: 710, y: 460, via: [710, 460]},
    lampsB: {x: 1140, y: 460, via: [1140, 460]}
  };
  const spotOf = (L, k) => {
    const s = STATION_POS[k] || SPOTS[k] || STATION_POS.desk;
    return {key: k, ...at(L, [s.x, s.y]), via: at(L, s.via || [s.x, s.y]), door: (s.door || []).map(d => at(L, d)), seat: !!s.seat};
  };
  /* the hit areas of the stations, in plan units: x, y, w, h */
  const AREA = {
    clock: [1130, 30, 100, 100], calendar: [320, 20, 280, 150], board: [660, 20, 300, 150], clients: [24, 204, 182, 286],
    attendance: [150, 600, 90, 90], reception: [30, 720, 160, 92], review: [1150, 290, 50, 240], meeting: [1200, 150, 400, 370],
    tray: [1212, 676, 64, 50], books: [1520, 892, 76, 96], desk: [300, 850, 220, 120], mail: [556, 892, 148, 80]
  };
  const STATION_LABEL = {
    attendance: 'Attendance desk', calendar: 'Calendar wall', board: 'Task board', review: 'Review wall', desk: 'The COO\'s desk',
    meeting: 'Meeting room', clients: 'Client wall', mail: 'Mail room', tray: 'Your tray', books: 'Books cabinet', reception: 'Reception', clock: 'The clock'
  };
  const STATIONS = () => (C() && C().STATIONS) || Object.keys(STATION_LABEL);

  /* who sits where: active members by pod (no pod is the Studio), pods by name, the lead first, then by
     joining date and id, six to a bench, two benches a row. A bench fills across its two sides in turn, so
     a small pod has room for its tags. The founder has the cabin; the COO has no desk */
  const SEAT_ORDER = [[0, true], [1, false], [2, true], [0, false], [1, true], [2, false]];
  const layoutMemo = new WeakMap();
  const NONE = {};
  function layout(ctx) {
    const key = (ctx && ctx.roster) || NONE;
    const hit = layoutMemo.get(key);
    if (hit && hit.founder === (ctx && ctx.founderUid)) return hit;
    const fu = (ctx && ctx.founderUid) || null;
    const people = ((ctx && ctx.activeMembers) || []).filter(m => m.uid !== fu && !isCoo(m.uid) && (m.role || '') !== 'founder');
    const pods = {};
    for (const m of people) { const p = String(m.pod || '').trim() || 'Studio'; (pods[p] = pods[p] || []).push(m); }
    const benches = [];
    for (const p of Object.keys(pods).sort((a, b) => a.localeCompare(b))) {
      const list = pods[p].slice().sort((a, b) => ((b.role === 'lead') - (a.role === 'lead')) || String(a.joined || '').localeCompare(String(b.joined || '')) || String(a.uid).localeCompare(String(b.uid)));
      for (let i = 0; i < list.length; i += 6) benches.push({pod: p, ids: list.slice(i, i + 6).map(m => m.uid), first: i === 0});
    }
    const rows = Math.max(2, Math.ceil(benches.length / 2));
    const grow = (rows - 2) * GROW;
    const seats = {};
    benches.forEach((b, i) => {
      b.i = i; b.x = COLS[i % 2]; b.y = ROW0 + Math.floor(i / 2) * GROW;
      b.ids.forEach((u, j) => {
        const [col, top] = SEAT_ORDER[j];
        seats[u] = {uid: u, x: b.x + col * DESK_W + DESK_W / 2, y: top ? b.y - 8 : b.y + BENCH_H + 8, top, bench: i, pod: b.pod, j};
      });
      /* the room a tag has: up to the next person on the same side of the bench */
      b.ids.forEach(u => {
        const me = seats[u];
        const near = b.ids.filter(v => v !== u && seats[v].top === me.top).map(v => Math.abs(seats[v].x - me.x));
        me.room = near.length ? Math.min(...near) : BENCH_W - DESK_W / 2;
      });
    });
    /* the bench places nobody sits at yet are drawn as spare desks, so the floor reads as a real one */
    const spare = [];
    for (let i = benches.length; i < rows * 2; i++) spare.push({x: COLS[i % 2], y: ROW0 + Math.floor(i / 2) * GROW, ids: []});
    const out = {W: PLAN_W, H: PLAN_H + grow, grow, rows, benches, spare, seats, founder: fu};
    if (fu) out.seats[fu] = {uid: fu, x: 1450, y: 712 + grow, top: true, bench: -1, pod: '', cabin: true, room: 200};
    layoutMemo.set(key, out);
    return out;
  }

  /* the walkways: a back aisle, one between each row of benches, a front aisle, crossed by aisles at the
     left wall, between the bench columns and at the right wall */
  function aisles(L) {
    const hs = [200];
    for (let r = 0; r < L.rows - 1; r++) hs.push(460 + r * GROW);
    hs.push(780 + L.grow);
    return {hs, vs: [250, 710, 1140], top: 200, bottom: 780 + L.grow, left: 250, right: 1140};
  }
  /* the shortest way between two aisle points, over the crossings (never across a desk) */
  function walkway(L, a, b) {
    const A = aisles(L);
    const nodes = [];
    const node = p => { let n = nodes.find(q => Math.abs(q.x - p.x) < .5 && Math.abs(q.y - p.y) < .5); if (!n) { n = {x: p.x, y: p.y, e: []}; nodes.push(n); } return n; };
    A.hs.forEach(y => A.vs.forEach(x => node({x, y})));
    const na = node(a), nb = node(b);
    const chain = list => list.forEach((n, i) => { if (i) { n.e.push(list[i - 1]); list[i - 1].e.push(n); } });
    A.hs.forEach(y => chain(nodes.filter(n => Math.abs(n.y - y) < .5 && n.x >= A.left - .5 && n.x <= A.right + .5).sort((p, q) => p.x - q.x)));
    A.vs.forEach(x => chain(nodes.filter(n => Math.abs(n.x - x) < .5 && n.y >= A.top - .5 && n.y <= A.bottom + .5).sort((p, q) => p.y - q.y)));
    /* a point off every aisle (bad data): straight to its nearest crossing */
    for (const n of [na, nb]) {
      if (n.e.length) continue;
      const c = nodes.filter(q => q !== na && q !== nb).sort((p, q) => dist(p, n) - dist(q, n))[0];
      if (c) { n.e.push(c); c.e.push(n); }
    }
    const d = new Map([[na, 0]]), prev = new Map(), open = new Set(nodes);
    while (open.size) {
      let u = null;
      for (const n of open) if (d.has(n) && (!u || d.get(n) < d.get(u))) u = n;
      if (!u || u === nb) break;
      open.delete(u);
      for (const v of u.e) { const nd = d.get(u) + dist(u, v); if (!d.has(v) || nd < d.get(v)) { d.set(v, nd); prev.set(v, u); } }
    }
    const out = [];
    for (let c = nb; c; c = prev.get(c)) out.unshift({x: c.x, y: c.y});
    return out.length && out[0].x === na.x && out[0].y === na.y ? out : [{x: a.x, y: a.y}, {x: b.x, y: b.y}];
  }
  /* path(L, from, to): the waypoints from one station or spot to another, in plan units. Through the
     doorways, along the walkways, with straight runs folded into one leg */
  function path(L, from, to) {
    const A = spotOf(L, from), B = spotOf(L, to);
    if (A.key === B.key) return [{x: B.x, y: B.y}];
    const pts = [{x: A.x, y: A.y}].concat(A.door.slice().reverse(), [A.via], walkway(L, A.via, B.via), [B.via], B.door, [{x: B.x, y: B.y}]);
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < .5 && Math.abs(last.y - p.y) < .5) continue;
      const prev = out[out.length - 2];
      /* three in a line: the middle one goes */
      if (prev && last && ((Math.abs(prev.x - last.x) < .5 && Math.abs(last.x - p.x) < .5) || (Math.abs(prev.y - last.y) < .5 && Math.abs(last.y - p.y) < .5))) out.pop();
      out.push({x: p.x, y: p.y});
    }
    return out;
  }

  /* ---------- the queue: what to play from a batch of settled rows ---------- */
  /* at most BURST animated steps, oldest first; the rest become one summary bubble */
  function queue(rows, o) {
    const cap = (o && o.cap) || BURST;
    const list = (rows || []).filter(r => r && SETTLED[r.status]).slice().sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    const rest = list.slice(cap);
    return {steps: list.slice(0, cap), more: rest.length, since: rest.length ? Number(rest[0].at) || 0 : 0, total: list.length};
  }

  /* ---------- the desks and their states ---------- */
  const STATUS_AWAY = {'In a meeting': 'meeting', 'On a shoot': 'shoot', 'Travelling': 'travel'};
  const MEET_SEATS = [[1350, 304], [1450, 304], [1350, 430], [1450, 430], [1282, 366], [1518, 366]];
  const LUNCH_SEATS = [[1030, 890], [1110, 890], [1070, 848], [1070, 934], [850, 896], [900, 896], [950, 896]];
  const toMins = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  /* desks(ctx, nowMs, viewer): one entry a person, the first state that matches wins: closed, leave, out,
     elsewhere, wfh, office, notin. viewer {uid, scope, see(uid), founder} decides the private detail */
  const deskMemo = new WeakMap();
  function viewerOf(ctx, scope) {
    const team = !ctx.isFounder || scope === 'team';
    const see = ctx.isFounder && !team ? () => true : u => u === ctx.uid || (!ctx.isFounder && typeof ctx.canSee === 'function' && ctx.canSee(u));
    return {uid: ctx.uid, scope: team ? 'team' : scope, founder: !team, see};
  }
  function desks(ctx, nowMs, viewer) {
    const now = Number(nowMs) || Date.now();
    const v = viewer || viewerOf(ctx, ctx.isOwner ? 'owner' : ctx.isFounder ? 'founder' : 'team');
    const coll = ctx.coll || {};
    const anchor = coll.checkin || NONE;
    const key = Math.floor(now / MIN) + '|' + v.uid + '|' + v.scope;
    const deps = [ctx.roster, coll.checkin, coll.me, coll.eod, coll.tasks, coll.leave, coll.leavedec, ctx.online, ctx.settings];
    const hit = deskMemo.get(anchor);
    if (hit && hit.key === key && hit.deps.every((d, i) => d === deps[i])) return hit.out;
    const L = layout(ctx);
    const day = dayOf(ctx, now);
    const s = ctx.settings || {};
    const lunch = [toMins(s.lunchFrom), toMins(s.lunchTo)];
    const atLunch = lunch[0] != null && lunch[1] != null && day.mins >= lunch[0] && day.mins < lunch[1];
    const d0 = istDayStart(now);
    const tasks = Object.keys((coll.tasks && coll.tasks.map) || {}).map(id => coll.tasks.map[id]).filter(t => t && !t.deleted && t.status !== 'done');
    const out = [];
    let meet = 0, lunchN = 0;
    for (const u of Object.keys(L.seats)) {
      const seat = L.seats[u];
      const m = (ctx.members || {})[u] || {};
      const me = ((coll.me && coll.me.map) || {})[u] || {};
      const a = M.att ? M.att.dayStatus(ctx, u, day.ymd) : {status: 'none'};
      const see = v.see(u);
      const st0 = M.home && M.home.status ? M.home.status(ctx, u) : null;
      const away = st0 && STATUS_AWAY[st0.text] ? st0.text : '';
      const startAt = d0 + ((toMins(ctx.startFor ? ctx.startFor(u) : s.start) || 630) + (Number(s.grace) || 0)) * MIN;
      let state = 'notin', tag = '', hot = false;
      if (day.closed) state = 'closed';
      else if (a.status === 'leave') { state = 'leave'; tag = 'Away today'; }
      else if (a.in && a.out) { state = 'out'; tag = see ? 'Out at ' + istHm(a.out) : 'Out'; }
      else if (away) { state = 'elsewhere'; tag = away; }
      else if (a.status === 'wfh' && a.in) { state = 'wfh'; tag = 'WFH'; }
      else if (a.in) { state = 'office'; tag = see ? 'In, ' + istHm(a.in) : 'In'; }
      else if (see && now > startAt && !seat.cabin && (v.founder || u !== v.uid)) { tag = 'Not in yet'; hot = true; }
      /* Kaavish does not check in: with m360 open, he is in the cabin */
      if (seat.cabin && state === 'notin' && ctx.online && ctx.online[u]) state = 'office';
      const live = state === 'office' || state === 'wfh' || state === 'elsewhere';
      /* focus protects the person, so everyone sees it: a running focus session, else the newest activity
         bucket of the last ten minutes marked as focus */
      let focus = false;
      const fn = me.focusNow;
      if (live && fn && Number(fn.start) && now < Number(fn.start) + (Number(fn.mins) || 25) * MIN) focus = true;
      else if (live) {
        const act = (me.act && me.act[day.ymd]) || {};
        const b = Object.keys(act).filter(k => /^\d{4}$/.test(k) && act[k] != null).sort().pop();
        if (b) { const t = d0 + (Number(b.slice(0, 2)) * 60 + Number(b.slice(2))) * MIN; if (now - t <= 10 * MIN && act[b] === 0) focus = true; }
      }
      let quiet = '';
      if (see && live && M.quiet && M.quiet.day) {
        try { const q = M.quiet.day(ctx, u, day.ymd, {now}); const st = (q.stretches || []).find(x => x.live); if (st) quiet = 'Quiet since ' + istHm(st.from); } catch (e) { quiet = ''; }
      }
      const online = !!(ctx.online && ctx.online[u]);
      let x = seat.x, y = seat.y, place = seat.cabin ? 'cabin' : 'desk';
      if (state === 'elsewhere' && away === 'In a meeting' && meet < MEET_SEATS.length) { [x, y] = MEET_SEATS[meet++]; place = 'meeting'; }
      else if (state === 'office' && atLunch && online && lunchN < LUNCH_SEATS.length) { [x, y] = LUNCH_SEATS[lunchN++]; y = sy(L, y); place = 'lunch'; }
      /* paper piles: the founder, and a manager for their reports */
      const pileOn = v.founder || (M.lines && M.lines.managerOf && M.lines.managerOf(ctx, u) === v.uid);
      const mine = pileOn ? tasks.filter(t => t.owner === u) : [];
      const joined = m.joined && /^\d{4}-\d{2}-\d{2}$/.test(m.joined) ? Math.round((Date.parse(day.ymd) - Date.parse(m.joined)) / 86400000) : 99;
      out.push({uid: u, pod: seat.pod, x, y, seatX: seat.x, seatY: seat.y, top: seat.top, cabin: !!seat.cabin, room: place === 'desk' ? seat.room : 120, place, state, tag, hot,
        focus, quiet, late: see && !!a.late && (state === 'office' || state === 'wfh'), online, page: v.founder && online ? String(ctx.online[u].page || '') : '',
        arrival: !!a.in && !a.out && now - a.in < 2 * MIN, newHire: joined >= 0 && joined <= 1,
        pile: Math.min(12, mine.length), overdue: mine.some(t => t.due && t.due < day.ymd), inAt: see ? a.in || 0 : 0});
    }
    deskMemo.set(anchor, {key, deps, out});
    return out;
  }
  /* the public words for a desk's state, for its label and the list view */
  const STATE_WORD = {closed: 'office closed', leave: 'away today', out: 'out', wfh: 'WFH', office: 'in', notin: 'not in yet'};
  const stateWord = d => d.state === 'elsewhere' ? String(d.tag || '').toLowerCase() : d.state === 'notin' && !d.hot ? (d.cabin ? 'not in the cabin' : 'desk empty')
    : d.cabin && d.state === 'office' ? 'in the cabin' : STATE_WORD[d.state] || '';

  /* ---------- the COO's words (M.coo.copy only) ---------- */
  function say(ctx, code, args, scope) {
    const c = C();
    if (!c || !c.copy || !code) return {line: '', why: ''};
    try { const r = c.copy(code, args || {}, scope === 'team' ? 'team' : 'founder', ctx) || {}; return {line: String(r.line || ''), why: String(r.why || '')}; } catch (e) { return {line: '', why: ''}; }
  }
  const NEEDS = /needs? you|for your tap|when you tap|waits? for you|wait on you/i;
  /* "At 10:45, approved ...": the first word keeps its capital when it is a name, I, or an acronym */
  const lowerFirst = (s, names) => { const w = String(s).split(/[\s,.']/)[0]; return w === 'I' || /^[A-Z0-9]{2,}$/.test(w) || (names && names.has(w)) ? s : s.charAt(0).toLowerCase() + s.slice(1); };
  function rowBubble(ctx, r, scope, names) {
    const t = say(ctx, r.code || r.job, {...(r.args || {}), would: r.status === 'would', why: r.why && r.why.code}, scope);
    if (!t.line) return null;
    const old = Date.now() - (Number(r.at) || 0) >= LIVE_MS;
    return {id: r.id, line: old && scope !== 'team' ? 'At ' + istHm(r.at) + ', ' + lowerFirst(t.line, names) : t.line, why: t.why,
      needs: NEEDS.test(t.line), failed: r.status === 'failed', would: r.status === 'would',
      undoUntil: scope !== 'team' && r.status === 'done' && Number(r.undoUntil) > Date.now() ? Number(r.undoUntil) : 0};
  }
  const teamLine = (ctx, station, night) => say(ctx, Object.keys((C() && C().JOBS) || {}).find(j => C().JOBS[j].station === station) || 'J50', {night}, 'team').line;

  /* what each row does on the floor */
  const MOVE = {rebalance: 1, cover_move: 1, orphan: 1, handed_away: 1, cover_away: 1};
  const SHIFT = {shift_blocked: 1, eta_shift: 1, pileup: 1, offday: 1, cover_shift: 1};
  const ASK = {said_off: 1, outcomes: 1, outcomes_mgr: 1, blocked_ask: 1, care: 1, due_tomorrow: 1, eta_ask: 1, hello: 1};
  const DRAFT = {client_mail: 1, meeting_mail: 1};
  const BOARDROOM = {memo: 1, review_prep: 1, audit: 1};
  const DRAFT_JOBS = {J02: 1, J06: 1, J36: 1, J41: 1, J42: 1};
  function choreo(r, line) {
    const code = r.code || '';
    if (code === 'open' || code === 'open_rest') return {kind: 'open', station: 'desk'};
    if (code === 'close') return {kind: 'close', station: 'meeting'};
    if (code === 'roll') return {kind: 'roll', station: 'attendance'};
    if (code === 'leave_ok' || code === 'wfh_ok') return {kind: 'stamp', station: 'calendar'};
    if (MOVE[code]) return {kind: 'arc', station: 'board'};
    if (SHIFT[code]) return {kind: 'slide', station: 'board'};
    if (code === 'invoice') return {kind: 'books', station: 'books'};
    if (DRAFT[code]) return {kind: 'draft', station: 'desk'};
    if (BOARDROOM[code]) return {kind: 'whiteboard', station: 'meeting'};
    if (code === 'pitch_ask' || code === 'pitch_late') return {kind: 'pitch', station: 'clients'};
    if (code === 'review_ask') return {kind: 'pin', station: 'review'};
    if (ASK[code]) return {kind: 'plane', station: 'mail'};
    return {kind: NEEDS.test(line || '') ? 'tray' : 'plain', station: r.station && STATION_POS[r.station] ? r.station : 'desk'};
  }

  /* where an approved card's action is done: its station when the event names one, else by the kind of
     action, else the tray */
  const ACTION_AT = [[/leave|wfh/, 'calendar'], [/review/, 'review'], [/task|owner|assign|due|rebalance|move/, 'board'], [/invoice|books/, 'books'],
    [/pitch|client/, 'clients'], [/mail|draft|send/, 'desk'], [/ask|nudge|chase/, 'mail'], [/holiday|setting|reports|roster|pm_policy/, 'reception']];
  function approvedAt(d) {
    if (d.station && STATION_POS[d.station]) return d.station;
    const nm = String(d.name || d.action || d.kind || '').toLowerCase();
    const hit = nm ? ACTION_AT.find(([re]) => re.test(nm)) : null;
    return hit ? hit[1] : 'tray';
  }

  /* ---------- small shared hooks ---------- */
  const NOLIVE = {pub: null, now: null, ledger: [], dec: [], health: null};
  /* M.coo is there for the page's whole life or not at all, so the hook order never changes */
  const useLive = ctx => (C() && C().useLive ? C().useLive(ctx) || NOLIVE : NOLIVE);
  const useHushed = () => (M.fx && M.fx.useHushed ? M.fx.useHushed() : false);
  function useMedia(q) {
    const get = () => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
    const [v, set] = useState(get);
    useEffect(() => {
      let m = null;
      try { m = window.matchMedia(q); } catch (e) { return undefined; }
      const on = () => set(m.matches);
      try { m.addEventListener('change', on); } catch (e) { m.addListener(on); }
      return () => { try { m.removeEventListener('change', on); } catch (e) { m.removeListener(on); } };
    }, [q]);
    return v;
  }
  const useReduced = () => useMedia('(prefers-reduced-motion: reduce)') || M.reduced();
  const useVisible = () => {
    const [v, set] = useState(() => document.visibilityState !== 'hidden');
    useEffect(() => { const f = () => set(document.visibilityState !== 'hidden'); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
    return v;
  };
  /* lite: a small device, Save-Data, or the main thread busy (long tasks adding up past a second in two) */
  let liteNow = (() => { try { return (navigator.hardwareConcurrency || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } })();
  const liteSubs = new Set();
  function useLite() {
    const [v, set] = useState(liteNow);
    useEffect(() => {
      liteSubs.add(set);
      let po = null;
      if (!liteNow && typeof PerformanceObserver === 'function') {
        let spent = [];
        try {
          po = new PerformanceObserver(list => {
            const t = performance.now();
            spent = spent.filter(e => t - e[0] < 2000).concat(list.getEntries().map(e => [e.startTime + e.duration, e.duration]));
            if (spent.reduce((s, e) => s + e[1], 0) > 1000 && !liteNow) { liteNow = true; liteSubs.forEach(f => f(true)); }
          });
          po.observe({type: 'longtask', buffered: false});
        } catch (e) { po = null; }
      }
      return () => { liteSubs.delete(set); if (po) po.disconnect(); };
    }, []);
    return v;
  }
  const prefOn = (k, d) => M.prefs.get(k, d ? '1' : '0') !== '0';

  /* ---------- the data every view of the office reads ---------- */
  function useData(scopeProp) {
    const ctx = M.useCtx();
    const scope = !ctx.isFounder || scopeProp === 'team' ? 'team' : (ctx.isOwner ? 'owner' : 'founder');
    const founder = scope !== 'team';
    const live = useLive(ctx);
    const L = layout(ctx);
    const viewer = useMemo(() => viewerOf(ctx, scope), [ctx.uid, ctx.isFounder, ctx.canSee, scope]);
    const D = desks(ctx, ctx.now, viewer);
    const day = dayOf(ctx, ctx.now || Date.now());
    const d0 = istDayStart(ctx.now || Date.now());
    const rows = useMemo(() => (founder && C() && C().feed ? C().feed(ctx, d0 - 1) : []), [founder, live.ledger, d0]);
    const ids = useMemo(() => Object.keys(L.seats), [L]);
    const profs = M.useProfiles(ids);
    const names = useMemo(() => new Set(ids.map(u => U.firstName ? U.firstName((profs[u] || {}).name || '') : String((profs[u] || {}).name || '').split(' ')[0]).filter(Boolean)), [profs, ids]);
    const dec = founder ? (live.dec || []) : [];
    const pub = live.pub || null;
    const nowDoc = founder ? live.now || null : null;
    const health = founder ? live.health || null : null;
    const rest = restOf(ctx, {founder, pub, nowDoc, health, dec, day});
    /* the ledger has arrived: what is in it then was already there when the person looked */
    const ready = !!(ctx.coo && ctx.coo.ready);
    return {ctx, scope, founder, live, L, D, rows, dec, pub, nowDoc, health, day, rest, profs, names, ready};
  }

  /* where the COO is between rounds, and how it looks there */
  function restOf(ctx, o) {
    const {founder, pub, nowDoc, health, dec, day} = o;
    const now = Date.now();
    const c = C();
    const st = !c ? 'off' : founder && c.status ? c.status(ctx, now) : (pub && (pub.state === 'off' || pub.state === 'paused' || pub.state === 'stuck' || pub.state === 'practice') ? pub.state : (pub ? 'on' : 'off'));
    const cur = nowDoc || pub || {};
    const lastAt = Number((cur.pass && cur.pass.at) || cur.at) || 0;
    const page = typeof window.M360_API !== 'function';
    /* on the artifact the COO works only while m360 is open: thirty minutes with no round, it sleeps */
    const idleLong = page && (!lastAt || now - lastAt > 30 * MIN);
    const working = cur.state === 'working' && now - (Number(cur.at) || 0) < 10 * MIN;
    const out = {station: 'desk', state: 'default', seat: true, card: '', dot: false, orb: false, jump: 0, bubble: null, asleep: false, working: false};
    const line = (code, args) => { const t = say(ctx, code, args, 'founder'); return t.line ? {line: t.line, why: t.why, needs: NEEDS.test(t.line), rest: true} : null; };
    if (st === 'off' || st === 'paused' || day.night || idleLong) {
      Object.assign(out, {state: 'sleeping', asleep: true, card: st === 'paused' ? 'Paused' : ''});
      /* "Back at 09:00" only when it is: by day an off COO just sleeps, and a day off has the sign on the door */
      const night = day.night && !day.closed && day.opens && st !== 'off' && st !== 'paused' ? {line: teamLine(ctx, 'desk', true), why: '', rest: true} : null;
      if (founder) out.bubble = st === 'off' ? line('off') : st === 'paused' ? line('paused', {until: Number(((c.cfg && c.cfg(ctx)) || {}).pausedUntil) || 0}) : idleLong && !day.night ? line('page_runner', {at: lastAt}) : night;
      else out.bubble = night;
      return out;
    }
    if (st === 'stuck') { Object.assign(out, {dot: true}); if (founder) out.bubble = line('refused'); return out; }
    if (st === 'practice') out.card = 'Practice';
    if (working && cur.station && STATION_POS[cur.station]) {
      const drafting = DRAFT_JOBS[cur.job];
      Object.assign(out, {working: true, station: drafting ? 'desk' : cur.station, seat: !!drafting || cur.station === 'desk', state: 'working', orb: !!drafting});
      if (!founder) out.bubble = {line: teamLine(ctx, cur.station, false), why: '', rest: true};
      return out;
    }
    if (founder && health && health.stale) { out.dot = true; out.bubble = page ? line('page_runner', {at: lastAt}) : line('late_beat', {at: lastAt}); return out; }
    if (founder && dec.length) { Object.assign(out, {station: 'tray', seat: false, jump: 40, bubble: line('waiting', {n: dec.length})}); return out; }
    return out;
  }
  const clockLine = (ctx, data) => {
    const cur = data.nowDoc || data.pub || {};
    const last = Number((cur.pass && cur.pass.at) || 0);
    const next = cur.next && cur.next.at ? Number(cur.next.at) : 0;
    if (!last) return 'No round yet today.';
    return 'Last round ' + istHm(last) + (next ? ', next ' + istHm(next) : '');
  };

  /* ---------- easing, read back: when a walk on EASE reaches each corner ---------- */
  const bez = (() => {
    const x1 = .2, y1 = .7, x2 = .2, y2 = 1;
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, syb = t => ((ay * t + by) * t + cy) * t;
    const prog = x => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (sx(t) < x) lo = t; else hi = t; } return syb(t); };
    return y => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (prog(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; };
  })();
  /* the droid looks the way it walks: a turn on a sideways leg, straight on an up or down one */
  const yawOf = (a, b) => (!a || !b || Math.abs(b.x - a.x) <= Math.abs(b.y - a.y) ? 0 : (b.x > a.x ? .45 : -.45));
  const tr = (L, p) => 'translate3d(' + (p.x / L.W * 100).toFixed(3) + '%,' + (p.y / L.H * 100).toFixed(3) + '%,0)';
  const pc = (v, of) => (v / of * 100).toFixed(3) + '%';

  /* ---------- the director: plays rows, rests between rounds, wanders now and then ---------- */
  function useDirector(env) {
    const E = useRef(env);
    E.current = env;
    const {data} = env;
    const [view, setView] = useState(() => ({spot: data.rest.station, walking: false, state: data.rest.state, carry: '', pose: null, bubble: null, fx: {}, flights: [], speed: null, lights: 0}));
    const track = useRef(null);
    const pos = useRef(data.rest.station);
    const anims = useRef(new Set());
    const q = useRef([]);
    const busy = useRef(false);
    const alive = useRef(true);
    const seen = useRef(null);
    const flightDone = useRef({});
    const lastWander = useRef(Date.now());
    const set = patch => { if (alive.current) setView(v => ({...v, ...(typeof patch === 'function' ? patch(v) : patch)})); };
    /* a beat on the floor: the stamp and the whiteboard lines stay, the rest (the books drawer, a card on
       the move, a pin, a pitch lit up) go back after a few seconds, so nothing reads as still happening */
    const BEAT = {slide: 1, pin: 1, pitch: 1, books: 1};
    const fxOn = (k, x) => {
      const key = Date.now() + Math.random();
      set(v => ({fx: {...v.fx, [k]: {...(x || {}), k: key}}}));
      if (BEAT[k]) setTimeout(() => set(v => (v.fx[k] && v.fx[k].k === key ? {fx: {...v.fx, [k]: null}} : {})), 4000);
    };

    useEffect(() => () => { alive.current = false; anims.current.forEach(a => { try { a.cancel(); } catch (e) { /* gone */ } }); }, []);
    /* a hidden tab holds the walk where it is; back again, it jumps to where it was going */
    useEffect(() => {
      const f = () => anims.current.forEach(a => { try { if (document.visibilityState === 'hidden') a.pause(); else a.finish(); } catch (e) { /* gone */ } });
      document.addEventListener('visibilitychange', f);
      return () => document.removeEventListener('visibilitychange', f);
    }, []);
    const shown = () => document.visibilityState !== 'hidden' ? Promise.resolve() : new Promise(res => {
      const f = () => { if (document.visibilityState !== 'hidden') { document.removeEventListener('visibilitychange', f); res(); } };
      document.addEventListener('visibilitychange', f);
    });
    const still = () => { const e = E.current; return e.reduced || !e.onScreen || document.visibilityState === 'hidden'; };

    async function walk(to, carry) {
      const e = E.current, L = e.data.L;
      const from = pos.current;
      if (from === to) return;
      pos.current = to;
      const el = track.current;
      if (!el || !e.onScreen || document.visibilityState === 'hidden') { set({spot: to, walking: false, carry: '', pose: null}); return; }
      if (e.reduced) {
        /* no walking: a short fade out and in at the new place */
        const inner = el.firstElementChild;
        if (inner && inner.animate) { const a = inner.animate([{opacity: 1}, {opacity: 0}], {duration: 120, fill: 'forwards'}); anims.current.add(a); try { await a.finished; } catch (x) { /* cancelled */ } anims.current.delete(a); set({spot: to}); await sleep(30); const b = inner.animate([{opacity: 0}, {opacity: 1}], {duration: 120}); anims.current.add(b); a.cancel(); try { await b.finished; } catch (x) { /* cancelled */ } anims.current.delete(b); }
        else set({spot: to});
        return;
      }
      const pts = path(L, from, to);
      let len = 0;
      const offs = [0];
      for (let i = 1; i < pts.length; i++) { len += dist(pts[i - 1], pts[i]); offs.push(len); }
      if (len < 1) { set({spot: to}); return; }
      const dur = clamp(1200, 3500, len / SPEED * 1000);
      const frames = pts.map((p, i) => ({transform: tr(L, p), offset: offs[i] / len}));
      set({walking: true, carry: carry || '', pose: {yaw: yawOf(pts[0], pts[1])}, state: 'default', speed: null, zWalk: Math.max(...pts.map(p => p.y))});
      const a = el.animate(frames, {duration: dur, easing: EASE, fill: 'forwards'});
      anims.current.add(a);
      const timers = pts.slice(1, -1).map((p, i) => setTimeout(() => set({pose: {yaw: yawOf(p, pts[i + 2])}}), bez(offs[i + 1] / len) * dur));
      try { await a.finished; } catch (x) { /* cancelled */ }
      timers.forEach(clearTimeout);
      if (!alive.current) return;
      el.style.transform = tr(L, pts[pts.length - 1]);
      a.cancel();
      anims.current.delete(a);
      set({spot: to, walking: false, carry: '', pose: null, zWalk: 0});
    }
    /* an item on the fly() arc, from one plan point to another; resolves when it lands */
    function fly(item, from, to) {
      const e = E.current;
      if (still() || e.lite || !from || !to) return Promise.resolve();
      const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return new Promise(res => { flightDone.current[id] = res; set(v => ({flights: v.flights.concat([{id, item, from, to}])})); setTimeout(() => { if (flightDone.current[id]) land(id); }, 1600); });
    }
    function land(id) {
      const r = flightDone.current[id];
      delete flightDone.current[id];
      set(v => ({flights: v.flights.filter(f => f.id !== id)}));
      if (r) r();
    }
    const deskAt = u => { const d = (E.current.data.D || []).find(x => x.uid === u); return d ? {x: d.x, y: d.y, focus: d.focus} : null; };
    const spotPt = k => spotOf(E.current.data.L, k);
    const bubble = b => {
      if (!b) return;
      const id = b.id || ('b' + Date.now());
      set({bubble: {...b, id, fold: false}});
      setTimeout(() => set(v => (v.bubble && v.bubble.id === id ? {bubble: {...v.bubble, fold: true}} : {})), 6000);
      if (E.current.onSay) E.current.onSay(b);
    };

    async function play(step) {
      const e = E.current;
      if (step.kind === 'summary') { bubble(step.bubble); await sleep(1200); return; }
      if (step.kind === 'go') { await walk(step.station); return; }
      const r = step.row;
      const b = rowBubble(e.data.ctx, r, e.data.scope, e.data.names);
      const ch = choreo(r, b && b.line);
      if (ch.kind === 'open') {
        pos.current = 'door'; set({spot: 'door', lights: Date.now()});
        await sleep(60);
        await walk('desk', 'mug');
      } else await walk(ch.station, ch.kind === 'pin' ? 'card' : '');
      set({state: 'working', speed: null});
      const args = r.args || {}, refs = r.refs || {};
      const who = refs.uid || args.uid, to = refs.to || args.to;
      if (ch.kind === 'roll') fxOn('roll');
      else if (ch.kind === 'stamp') fxOn('stamp', {id: r.id});
      else if (ch.kind === 'slide') fxOn('slide');
      else if (ch.kind === 'pin') fxOn('pin');
      else if (ch.kind === 'pitch') fxOn('pitch');
      else if (ch.kind === 'books') fxOn('books');
      else if (ch.kind === 'whiteboard' || ch.kind === 'close') fxOn('board');
      else if (ch.kind === 'draft') fxOn('orb');
      bubble(b);
      if (ch.kind === 'arc' && who && to) await fly('card', deskAt(who), deskAt(to));
      else if (ch.kind === 'plane' && who) {
        const d = deskAt(who);
        /* never into a focus desk: the plane waits at the mail room */
        if (d && !d.focus) { await fly('plane', spotPt('mail'), d); fxOn('asked', {uid: who, at: r.at}); }
      }
      await sleep(1600);
      set({state: r.status === 'failed' ? 'default' : 'default', speed: .6, failed: r.status === 'failed'});
      if (ch.kind === 'draft') await fly('envelope', spotPt('desk'), spotPt('tray'));
      else if (ch.kind === 'whiteboard') { await sleep(500); await fly('page', spotPt('meeting'), spotPt('tray')); }
      else if (ch.kind === 'tray') await walk('tray', 'card');
      else if (ch.kind === 'close') {
        /* the close: round the room switching off lamps, the report on the founder's desk, then its seat */
        await walk('lampsA'); await walk('lampsB'); await walk('founder', 'page'); await sleep(300); await walk('desk');
      }
      await sleep(e.reduced ? 600 : 900);
    }

    async function pump() {
      if (busy.current) return;
      busy.current = true;
      try {
        while (alive.current) {
          await shown();
          const step = q.current.shift();
          if (!step) break;
          await play(step);
          lastWander.current = Date.now();
        }
        /* between rounds it goes back to rest (a tray with cards waiting, or its desk) */
        const rest = E.current.data.rest;
        if (alive.current && pos.current !== rest.station) await walk(rest.station);
        if (alive.current) set({state: rest.state, speed: null, failed: false});
      } finally { busy.current = false; }
    }

    /* new settled rows: the first look after a gap is one "since you were away" bubble, later ones play */
    const rows = data.rows;
    useEffect(() => {
      const e = E.current;
      if (!e.data.founder || !e.data.ready) return;
      const ids = new Set(rows.map(r => r.id));
      if (seen.current === null) {
        seen.current = ids;
        const since = Number(M.prefs.get('office.seen', '0')) || 0;
        const fresh = rows.filter(r => (Number(r.at) || 0) > since);
        const last = rows.reduce((m, r) => Math.max(m, Number(r.at) || 0), since);
        if (fresh.length && since) {
          const latest = rowBubble(e.data.ctx, fresh[fresh.length - 1], e.data.scope, e.data.names);
          q.current.push({kind: 'summary', bubble: {line: fresh.length === 1 && latest ? latest.line : 'Since ' + istHm(fresh[0].at) + ', ' + fresh.length + ' acts. See today\'s run.', why: fresh.length === 1 && latest ? latest.why : (latest ? latest.line : ''), summary: true}});
          pump();
        }
        if (last) M.prefs.set('office.seen', String(last));
        return;
      }
      const fresh = rows.filter(r => !seen.current.has(r.id));
      if (!fresh.length) return;
      fresh.forEach(r => seen.current.add(r.id));
      M.prefs.set('office.seen', String(rows.reduce((m, r) => Math.max(m, Number(r.at) || 0), 0)));
      const b = queue(fresh);
      /* a new batch replaces whatever of the last one has not played yet */
      q.current = b.steps.map(row => ({kind: 'row', row}));
      if (b.more) q.current.push({kind: 'summary', bubble: {line: 'And ' + b.more + ' more since ' + istHm(b.since) + '. See today\'s run.', why: '', summary: true}});
      if (E.current.onWake) E.current.onWake();
      pump();
    }, [rows, data.ready]);

    /* the rest place moved (cards waiting, a working round, the night): it goes there when free */
    const restKey = data.rest.station + '|' + data.rest.state;
    useEffect(() => {
      if (busy.current) return;
      if (pos.current !== data.rest.station) pump();
      else set({state: data.rest.state});
    }, [restKey]);

    /* the founder approved a card the agent made: it goes to the station of that action. Asleep (off,
       paused, the night, a day off) it stays asleep: an off COO is never seen at work */
    useEffect(() => {
      const f = ev => { const d = E.current.data; if (!d.founder || d.rest.asleep) return; q.current.push({kind: 'go', station: approvedAt((ev && ev.detail) || {})}); pump(); };
      window.addEventListener('m360:approved', f);
      return () => window.removeEventListener('m360:approved', f);
    }, []);
    /* the personal managers' bots send a paper plane to your desk */
    useEffect(() => {
      const f = () => { const e = E.current; const d = deskAt(e.data.ctx.uid); if (d && !d.focus) fly('plane', spotPt('mail'), d); };
      window.addEventListener('m360:pm', f);
      return () => window.removeEventListener('m360:pm', f);
    }, []);

    /* idle life: at most one wander in five minutes, never hidden, never under reduced motion, never
       in lite mode, never at night, and off when the person switches it off. No bubble on a wander */
    useEffect(() => {
      const t = setInterval(() => {
        const e = E.current, d = e.data;
        if (busy.current || still() || e.lite || !prefOn('office.wander', true) || d.rest.asleep || d.rest.working || d.rest.station !== 'desk') return;
        const now = Date.now();
        if (now - lastWander.current < 5 * MIN) return;
        lastWander.current = now;
        const next = Number(((d.nowDoc || d.pub || {}).next || {}).at) || 0;
        const s = d.ctx.settings || {};
        const lunch = [toMins(s.lunchFrom), toMins(s.lunchTo)];
        const atLunch = lunch[0] != null && d.day.mins >= lunch[0] && d.day.mins < lunch[1];
        let k;
        if (next && next - now > 0 && next - now <= 2 * MIN) k = 'clock';
        else {
          const pick = ['board', 'plant', 'window', atLunch ? 'plant' : 'coffee'];
          let h = 0;
          for (const ch of String(d.ctx.uid || '') + Math.floor(now / (5 * MIN))) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
          k = pick[h % pick.length];
        }
        q.current.push({kind: 'go', station: k}, {kind: 'go', station: d.rest.station});
        pump();
      }, 30000);
      return () => clearInterval(t);
    }, []);

    return {view, track, land, pos};
  }

  /* ---------- the static floor plan: one inline SVG, re-made only when the layout changes ---------- */
  const Mon = ({x, y, w}) => html`<use href="#of-mon" x=${x} y=${y} width=${w || 28} height=${(w || 28) * 18 / 28}/>`;
  const Plant = ({x, y, s}) => html`<use href="#of-plant" x=${x} y=${y} width=${s || 34} height=${s || 34}/>`;
  function Plan({L, owner}) {
    const g = L.grow, H = L.H, y = v => sy(L, v);
    const benches = L.benches.concat(L.spare || []);
    return html`<svg class="office-plan" viewBox=${'0 0 ' + PLAN_W + ' ' + H} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="of-mon" viewBox="0 0 28 18"><rect class="of-screen" x="1" y="1" width="26" height="12" rx="2"/><path class="of-fine" d="M10 17h8M14 13v4"/></symbol>
        <symbol id="of-plant" viewBox="0 0 34 34"><path class="of-fine" d="M17 22C11 18 7 12 8 5M17 22c4-6 9-9 15-9M17 22c-1-7 1-13 5-17"/><circle class="of-flame" cx="22" cy="6" r="3"/><rect class="of-front" x="10" y="22" width="14" height="11" rx="2"/></symbol>
        <symbol id="of-lamp" viewBox="0 0 14 14"><circle class="of-top" cx="7" cy="7" r="5.5"/><circle class="of-ink" cx="7" cy="7" r="1.6"/></symbol>
      </defs>
      <rect class="of-floor" x="0" y="0" width=${PLAN_W} height=${H}/>
      <g class="of-wallband">
        <rect class="of-wall" x="0" y="0" width=${PLAN_W} height="150"/>
        <path class="of-ln" d="M0 150H1200M1600 150"/>
        <rect class="of-sky" x="24" y="22" width="272" height="100" rx="4"/>
        <path class="of-fine" d="M24 122V100H44V86H58V104H74V70H92V104H108V92H126V60H132V50H138V60H146V104H164V88H182V100H200V78H220V100H236V94H252V82H270V104H296"/>
        <rect class="of-sky" x="1240" y="22" width="336" height="100" rx="4"/>
        <path class="of-fine" d="M1240 108H1576M1350 108V66M1460 108V66M1350 70L1290 108M1350 70L1410 108M1460 70L1400 108M1460 70L1520 108M1240 100H1270V84H1284V100"/>
        <path class="of-ln" d="M24 22h272v100H24zM160 22v100M1240 22h336v100H1240zM1408 22v100"/>
        <rect class="of-top" x="320" y="24" width="280" height="112" rx="6"/>
        <rect class="of-front" x="320" y="24" width="280" height="20" rx="6"/>
        <path class="of-fine" d="M360 44V136M400 44V136M440 44V136M480 44V136M520 44V136M560 44V136M320 90H600"/>
        <rect class="of-top" x="660" y="24" width="300" height="112" rx="6"/>
        <path class="of-fine" d="M760 32V114M860 32V114M668 122H952M708 118v8M748 118v8M788 118v8M828 118v8M868 118v8M908 118v8"/>
        <rect class="of-card" x="672" y="40" width="74" height="18" rx="3"/><rect class="of-card" x="672" y="64" width="74" height="18" rx="3"/><rect class="of-card" x="672" y="88" width="74" height="18" rx="3"/>
        <rect class="of-card" x="772" y="40" width="74" height="18" rx="3"/><rect class="of-card" x="772" y="64" width="74" height="18" rx="3"/>
        <rect class="of-card" x="872" y="40" width="74" height="18" rx="3"/>
        <circle class="of-top" cx="1180" cy="80" r="44"/>
        <path class="of-fine" d="M1180 40v8M1180 112v8M1140 80h8M1212 80h8M1208 52l-5 5M1152 108l5-5M1208 108l-5-5M1152 52l5 5"/>
      </g>
      <path class="of-ln" d=${'M20 150V' + y(820) + 'M20 ' + y(900) + 'V' + H}/>
      <path class="of-fine of-dash" d=${'M20 ' + y(820) + 'L90 ' + y(842) + 'M90 ' + y(842) + 'A74 74 0 0 1 20 ' + y(900)}/>
      <rect class="of-top" x="30" y="210" width="170" height="260" rx="8"/>
      <rect class="of-front" x="30" y="470" width="170" height="14" rx="4"/>
      ${[[46, 228], [118, 228], [46, 300], [118, 300], [46, 372], [118, 372]].map(([cx, cy], i) => html`<g key=${i}><rect class="of-card" x=${cx} y=${cy} width="62" height="54" rx="4"/><circle class="of-flame" cx=${cx + 31} cy=${cy + 6} r="3"/></g>`)}
      <rect class="of-top" x="166" y="618" width="40" height="34" rx="4"/>
      <rect class="of-front" x="166" y="652" width="40" height="10" rx="3"/>
      <rect class="of-screen" x="172" y="623" width="28" height="22" rx="3"/>
      <rect class="of-top" x="40" y=${y(728)} width="140" height="62" rx="8"/>
      <rect class="of-front" x="40" y=${y(790)} width="140" height="16" rx="4"/>
      <${Plant} x=${44} y=${y(732)} s=${30}/>
      ${benches.map((b, i) => html`<g key=${'b' + i}>
        <rect class="of-top" x=${b.x} y=${b.y} width=${BENCH_W} height=${BENCH_H} rx="6"/>
        <rect class="of-front" x=${b.x} y=${b.y + BENCH_H} width=${BENCH_W} height="18" rx="4"/>
        <path class="of-fine" d=${'M' + b.x + ' ' + (b.y + 80) + 'H' + (b.x + BENCH_W) + 'M' + (b.x + 120) + ' ' + b.y + 'V' + (b.y + BENCH_H) + 'M' + (b.x + 240) + ' ' + b.y + 'V' + (b.y + BENCH_H)}/>
        ${[0, 1, 2].map(j => html`<g key=${j}>
          <${Mon} x=${b.x + j * 120 + 46} y=${b.y + 40}/><${Mon} x=${b.x + j * 120 + 46} y=${b.y + 104}/>
          <use href="#of-lamp" x=${b.x + j * 120 + 96} y=${b.y + 12} width="14" height="14"/><use href="#of-lamp" x=${b.x + j * 120 + 96} y=${b.y + 134} width="14" height="14"/>
          ${b.ids.length ? null : html`<rect class="of-chair" x=${b.x + j * 120 + 47} y=${b.y - 19} width="26" height="18" rx="8"/><rect class="of-chair" x=${b.x + j * 120 + 47} y=${b.y + BENCH_H + 1} width="26" height="18" rx="8"/>`}
        </g>`)}
      </g>`)}
      <rect class="of-top" x="1164" y="300" width="28" height="220" rx="4"/>
      ${[316, 346, 376, 406, 436].map(v => html`<rect key=${v} class="of-card" x="1168" y=${v} width="20" height="18" rx="2"/>`)}
      <rect class="of-glass" x="1200" y="150" width="400" height="370"/>
      <path class="of-ln" d="M1200 150V176M1200 236V520H1600"/>
      <rect class="of-top" x="1290" y="160" width="220" height="62" rx="4"/>
      <rect class="of-top" x="1300" y="318" width="200" height="84" rx="40"/>
      <rect class="of-front" x="1300" y="400" width="200" height="12" rx="6"/>
      ${MEET_SEATS.map(([cx, cy], i) => html`<rect key=${'m' + i} class="of-chair" x=${cx - 13} y=${cy - 9} width="26" height="18" rx="8"/>`)}
      <rect class="of-rug" x="1200" y="560" width="400" height=${H - 560}/>
      <path class="of-ln" d=${'M1200 560H1600M1200 560V615M1200 685V' + H}/>
      <rect class="of-top" x="1360" y=${y(724)} width="180" height="66" rx="6"/>
      <rect class="of-front" x="1360" y=${y(790)} width="180" height="14" rx="4"/>
      <${Mon} x=${1430} y=${y(734)} w=${40}/>
      <${Plant} x=${1550} y=${574} s=${38}/>
      <rect class="of-top" x="1222" y="688" width="54" height="34" rx="4"/>
      <rect class="of-screen" x="1230" y="694" width="38" height="20" rx="3"/>
      ${owner ? html`<g><rect class="of-top" x="1528" y=${y(900)} width="60" height="84" rx="4"/><path class="of-fine" d=${'M1528 ' + y(928) + 'H1588M1528 ' + y(956) + 'H1588M1552 ' + y(914) + 'h12M1552 ' + y(942) + 'h12M1552 ' + y(970) + 'h12'}/></g>` : null}
      <rect class="of-top" x="300" y=${y(872)} width="220" height="80" rx="8"/>
      <rect class="of-front" x="300" y=${y(952)} width="220" height="16" rx="4"/>
      <${Mon} x=${348} y=${y(880)} w=${44}/><${Mon} x=${402} y=${y(880)} w=${44}/>
      <use href="#of-lamp" x="484" y=${y(882)} width="18" height="18"/>
      <rect class="of-top" x="318" y=${y(924)} width="16" height="16" rx="5"/>
      <${Plant} x=${468} y=${y(912)} s=${34}/>
      <rect class="of-top" x="560" y=${y(904)} width="140" height="60" rx="4"/>
      <path class="of-fine" d=${'M595 ' + y(904) + 'V' + y(964) + 'M630 ' + y(904) + 'V' + y(964) + 'M665 ' + y(904) + 'V' + y(964) + 'M560 ' + y(934) + 'H700'}/>
      <rect class="of-top" x="820" y=${y(910)} width="160" height="54" rx="6"/>
      <rect class="of-front" x="820" y=${y(964)} width="160" height="12" rx="4"/>
      <rect class="of-screen" x="836" y=${y(916)} width="34" height="34" rx="4"/>
      <circle class="of-top" cx="1070" cy=${y(890)} r="36"/>
      ${[[1030, 890], [1110, 890], [1070, 848], [1070, 934]].map(([cx, cy], i) => html`<circle key=${'s' + i} class="of-chair" cx=${cx} cy=${y(cy)} r="10"/>`)}
      <${Plant} x=${1114} y=${y(940)} s=${36}/>
      <path class="of-ln" d=${'M0 ' + (H - 8) + 'H1200'}/>
    </svg>`;
  }
  const PlanMemo = React.memo(Plan, (a, b) => a.L === b.L && a.owner === b.owner);

  /* ---------- the live layer: chairs, lamps, piles, the walls' moving parts, the lights ---------- */
  function Live({L, D, fx, day, scope, joins, late}) {
    const H = L.H;
    const lampOf = d => ({x: d.seatX + 43, y: d.top ? d.seatY + 27 : d.seatY - 27});
    const hm = new Date(Date.now() + IST_MS);
    const hr = (hm.getUTCHours() % 12 + hm.getUTCMinutes() / 60) * 30, mn = hm.getUTCMinutes() * 6;
    const hand = (deg, r) => 'M1180 80L' + (1180 + Math.sin(deg * Math.PI / 180) * r).toFixed(1) + ' ' + (80 - Math.cos(deg * Math.PI / 180) * r).toFixed(1);
    const wd = (day.dow + 6) % 7;
    const lit = D.filter(d => !d.cabin && (d.state === 'office' || d.state === 'elsewhere') && d.place !== 'lunch' && d.place !== 'meeting');
    return html`<svg class="office-live" viewBox=${'0 0 ' + PLAN_W + ' ' + H} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      ${D.filter(d => !d.cabin).map(d => {
        const away = d.state === 'leave' || d.state === 'out' || d.state === 'closed' || d.state === 'wfh';
        const off = d.top ? -8 : 8;
        const cy = d.seatY + (away ? -off : off * 0.2) + (d.top ? -2 : 2);
        return html`<g key=${'c' + d.uid}>
          <rect class=${'of-chair' + (d.state === 'notin' ? ' out' : '')} x=${d.seatX - 13 + (d.state === 'notin' ? 6 : 0)} y=${cy - 9 + (d.state === 'notin' ? (d.top ? -10 : 10) : 0)} width="26" height="18" rx="8"/>
          ${d.state === 'leave' ? html`<g><rect class="of-card" x=${d.seatX - 14} y=${d.top ? d.seatY + 14 : d.seatY - 44} width="28" height="24" rx="3"/><rect class="of-flame" x=${d.seatX - 14} y=${d.top ? d.seatY + 14 : d.seatY - 44} width="28" height="6" rx="2"/></g>` : null}
          ${d.state === 'out' ? html`<rect class="of-card" x=${d.seatX - 30} y=${d.top ? d.seatY + 20 : d.seatY - 36} width="16" height="20" rx="2"/>` : null}
          ${d.pile ? html`<g class=${'of-pile' + (d.overdue ? ' hot' : '')}>${Array.from({length: Math.ceil(d.pile / 3)}, (_, i) => html`<rect key=${i} x=${d.seatX - 50} y=${(d.top ? d.seatY + 46 : d.seatY - 30) - i * 4} width="20" height="14" rx="1"/>`)}</g>` : null}
        </g>`;
      })}
      <rect class="of-today" x=${320 + wd * 40} y="44" width="40" height="46"/>
      ${(fx.stamp ? [0] : []).map(() => html`<path key=${fx.stamp.k} class="of-tick" d=${'M' + (328 + wd * 40) + ' 66l8 9 16-18'}/>`)}
      ${fx.slide ? html`<rect key=${fx.slide.k} class="of-slide" x="708" y="112" width="34" height="18" rx="3"/>` : null}
      ${fx.pin ? html`<rect key=${fx.pin.k} class="of-pin" x="1168" y="466" width="20" height="18" rx="2"/>` : null}
      ${fx.pitch ? html`<rect key=${fx.pitch.k} class="of-beat" x="118" y="300" width="62" height="54" rx="4"/>` : null}
      ${fx.books && scope === 'owner' ? html`<g key=${fx.books.k} class="of-drawer"><rect class="of-top" x="1500" y=${sy(L, 930)} width="34" height="24" rx="2"/><rect class="of-flame" x="1500" y=${sy(L, 930)} width="8" height="24" rx="2"/></g>` : null}
      ${fx.board ? html`<g key=${fx.board.k} class="of-strokes"><path d="M1306 178h120"/><path d="M1306 194h160"/><path d="M1306 210h90"/></g>` : null}
      ${joins ? html`<g class="of-visitor"><circle cx="90" cy=${sy(L, 842)} r="11"/><path d=${'M72 ' + sy(L, 880) + 'c2-14 10-20 18-20s16 6 18 20z'}/></g>` : null}
      <circle class=${'of-dial' + (late ? ' late' : '')} cx="1180" cy="80" r="44"/>
      <path class="of-hand" d=${hand(hr, 24) + hand(mn, 34)}/>
      <rect class="of-night" x="0" y="0" width=${PLAN_W} height=${H}/>
      <g class="of-lit"><rect x="78" y="80" width="6" height="8"/><rect x="129" y="66" width="4" height="7"/><rect x="168" y="94" width="6" height="6"/><rect x="204" y="86" width="6" height="8"/><rect x="256" y="90" width="6" height="6"/></g>
      ${lit.map(d => { const p = lampOf(d); return html`<circle key=${'g' + d.uid} class=${'of-glow' + (d.quiet ? ' dim' : '')} cx=${p.x} cy=${p.y} r="34"/>`; })}
    </svg>`;
  }

  /* ---------- the moving parts of the overlay ---------- */
  const ITEM = {
    card: html`<svg viewBox="0 0 20 16" aria-hidden="true"><rect x="1" y="1" width="18" height="14" rx="2" class="oi-paper"/><path d="M4 6h12M4 10h8" class="oi-ln"/></svg>`,
    envelope: html`<svg viewBox="0 0 20 16" aria-hidden="true"><rect x="1" y="2" width="18" height="12" rx="2" class="oi-paper"/><path d="M1.5 3l8.5 6 8.5-6" class="oi-ln"/></svg>`,
    page: html`<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M2 1h8l4 4v14H2z" class="oi-paper"/><path d="M5 8h6M5 11h6M5 14h4" class="oi-ln"/></svg>`,
    plane: html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 9l18-7-6 16-3-7z" class="oi-paper"/><path d="M10 11l9-9" class="oi-ln"/></svg>`,
    mug: html`<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 5h9v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" class="oi-paper"/><path d="M12 7h2a2 2 0 0 1 0 4h-2" class="oi-ln"/></svg>`
  };
  /* one item on the arc: T = clamp(360, 900, 300 + d * .55), lifted min(70, d * .18), twelve keyframes */
  function Flight({f, L, ppu, onDone}) {
    const ref = useRef(null);
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el || !el.animate) { onDone(f.id); return undefined; }
      const dpx = dist(f.from, f.to) * ppu;
      const T = clamp(360, 900, 300 + dpx * .55), arc = Math.min(70, dpx * .18) / Math.max(ppu, .01);
      const frames = [];
      for (let i = 0; i < 12; i++) {
        const t = i / 11, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        frames.push({transform: tr(L, {x: f.from.x + (f.to.x - f.from.x) * e, y: f.from.y + (f.to.y - f.from.y) * e - Math.sin(Math.PI * t) * arc}), offset: t});
      }
      const a = el.animate(frames, {duration: T, fill: 'forwards'});
      a.finished.then(() => onDone(f.id), () => onDone(f.id));
      return () => { try { a.cancel(); } catch (e) { /* gone */ } };
    }, []);
    return html`<div ref=${ref} class="office-flight" style=${{transform: tr(L, f.from)}} aria-hidden="true"><span class=${'office-item ' + f.item}>${ITEM[f.item] || ITEM.card}</span></div>`;
  }

  /* the bubble: what (bold), why (ink62), a flame dot when it needs Kaavish; the founder's row of
     Undo until hh:mm and Open. Full for six seconds, then a one-line pill. Not a live region itself: the
     scene's one polite region speaks for it, at most once a minute and not at all when Kaavish mutes it */
  function Bubble({b, side, below, founder, onUndo, big, className}) {
    if (!b || !b.line) return null;
    const fold = b.fold && !big;
    return html`<div class=${'office-bubble' + (fold ? ' fold' : '') + (b.needs ? ' needs' : '') + (b.failed ? ' failed' : '') + (big ? ' big' : '') + (below ? ' below' : '') + (side ? ' ' + side : '') + (className ? ' ' + className : '')}
      data-id=${b.id || ''}>
      <div class="ob-what">${b.needs || b.failed ? html`<i class="ob-dot" aria-hidden="true"/>` : null}<b>${b.line}</b></div>
      ${b.why && !fold ? html`<div class="ob-why">${b.why}</div>` : null}
      ${founder && !fold && (b.undoUntil || b.id) && !b.rest && !b.summary ? html`<div class="ob-acts">
        ${b.undoUntil ? html`<button type="button" class="pill ob-btn" onClick=${() => onUndo && onUndo(b.id)}>Undo until ${istHm(b.undoUntil)}</button>` : null}
        <button type="button" class="pill ob-btn" onClick=${() => M.nav('#coo')}>Open</button>
      </div>` : null}
    </div>`;
  }

  /* the COO itself: the plush droid (square glasses, a bow tie), what it carries, its desk cards */
  const LISTEN = {yaw: .45};   /* turned toward the dock; one object, so the droid is not handed a new pose each render */
  function Mascot({view, rest, size, still, paused, listening, dark, onOpen, label}) {
    const Bot = M.fx && M.fx.Bot;
    const walking = view.walking;
    const seated = !walking && view.spot === 'desk' && rest.seat !== false;
    const st = walking ? 'default' : rest.asleep && view.spot === rest.station ? 'sleeping' : view.state === 'working' ? 'working' : (view.state === 'sleeping' ? 'sleeping' : 'default');
    const waiting = !walking && view.spot === 'tray' && rest.station === 'tray';
    const pose = walking && view.pose ? view.pose : (listening && !walking ? LISTEN : null);
    const props = {type: 'droid', glasses: 'square', bowTie: true, accessoryColor: dark ? '#F2F1EC' : '#0E0E0E', label: 'm360 COO', size,
      state: st, paused: paused && !walking, headphones: !!listening, jumpEvery: still ? 0 : (waiting ? 40 : 0), interactive: !still && !walking,
      pose: pose || undefined, speed: view.speed || undefined, className: 'office-bot'};
    return html`<div class=${'office-mascot' + (walking ? ' walking' : '') + (seated ? ' seated' : '')} data-state=${walking ? 'walking' : st} data-spot=${view.spot} style=${{'--bot': size + 'px'}}>
      <span class="office-shadow" aria-hidden="true"/>
      <span class="office-bob">${Bot ? html`<${Bot} ...${props}/>` : html`<${M.Mark} width="40px"/>`}</span>
      ${view.carry && ITEM[view.carry] ? html`<span class=${'office-item carry ' + view.carry} aria-hidden="true">${ITEM[view.carry]}</span>` : null}
      ${(rest.orb || (view.fx.orb && Date.now() - view.fx.orb.k < 2400)) && seated && M.fx && M.fx.Orb ? html`<span class="office-orb" aria-hidden="true"><${M.fx.Orb} state="composing" size=${20}/></span>` : null}
      ${(rest.dot || view.failed) && !walking ? html`<i class="office-flamedot" aria-hidden="true"/>` : null}
      <button type="button" class="office-mascot-hit" aria-label=${label} onClick=${onOpen}/>
    </div>`;
  }

  /* one desk: the photo, the tag, focus, the live dot, late and quiet for those who may see them */
  const House = html`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 6L6 2l4.5 4M3 5.2V10h6V5.2"/></svg>`;
  const Phones = html`<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M2 9V7a6 6 0 0 1 12 0v2"/><rect x="1" y="6" width="3" height="4" rx="1"/><rect x="12" y="6" width="3" height="4" rx="1"/></svg>`;
  function Desk({d, L, ppu, name, label, avatar, tags, tab, lit, litDelay, onOpen, onKey, asked}) {
    const ref = useRef(null);
    /* a check-in under two minutes old walks in from the door, past the attendance desk */
    useLayoutEffect(() => {
      const el = ref.current;
      if (!d.arrival || !el || !el.animate || M.reduced()) return undefined;
      const host = el.parentElement;
      const r = host ? host.getBoundingClientRect() : null;
      if (!r || !r.width) return undefined;
      const k = r.width / L.W;
      const from = {x: (44 - d.x) * k, y: (sy(L, 862) - d.y) * k};
      const via = {x: (232 - d.x) * k, y: (662 - d.y) * k};
      const base = getComputedStyle(el).transform;
      const a = el.animate([{transform: 'translate(' + from.x + 'px,' + from.y + 'px) ' + (base === 'none' ? '' : base), opacity: 0}, {transform: 'translate(' + via.x + 'px,' + via.y + 'px) ' + (base === 'none' ? '' : base), opacity: 1, offset: .45}, {transform: base === 'none' ? 'none' : base, opacity: 1}], {duration: 800, easing: EASE});
      return () => { try { a.cancel(); } catch (e) { /* gone */ } };
    }, [d.arrival]);
    /* the person is drawn where they are: at the desk, on a call tile from home, in the meeting room */
    const show = d.state === 'office' || d.state === 'wfh' || (d.state === 'elsewhere' && d.place === 'meeting');
    /* Kaavish's own seat in the cabin is not a desk on the floor */
    return html`<button ref=${ref} type="button" class=${(d.cabin ? 'office-founder cabin' : 'office-desk') + (d.top ? ' top' : '') + (lit ? ' lit' : '')} data-uid=${d.uid} data-state=${d.state} data-place=${d.place}
      tabIndex=${tab} aria-label=${label} title=${name} onClick=${onOpen} onKeyDown=${onKey}
      style=${{left: pc(d.x, L.W), top: pc(d.y, L.H), zIndex: 10 + Math.round(d.y), '--d': (litDelay || 0) + 'ms', '--room': Math.max(44, Math.round((d.room || 120) * ppu) - 8) + 'px'}}>
      ${show ? html`<span class=${'od-face' + (d.state === 'wfh' ? ' call' : '')}>${avatar}${d.state === 'wfh' ? html`<i class="od-house">${House}</i>` : null}</span>` : html`<span class="od-empty" aria-hidden="true"/>`}
      ${d.focus ? html`<i class="od-focus" aria-hidden="true">${Phones}</i>` : null}
      ${d.online && show ? html`<i class="od-live" aria-hidden="true" title=${d.page ? 'On ' + d.page : ''}/>` : null}
      ${d.newHire ? html`<span class="od-new" aria-hidden="true">New</span>` : null}
      ${tags && (d.tag || d.quiet || asked) ? html`<span class="od-tag" key=${lit || 'tag'}>
        ${d.hot ? html`<i class="od-hot" aria-hidden="true"/>` : null}${d.late ? html`<span class="od-late">Late</span>` : null}<span>${asked ? 'Asked ' + istHm(asked) : (d.quiet || d.tag)}</span></span>` : null}
    </button>`;
  }

  /* the stations a viewer has: the tray is Kaavish's, the books cabinet the owner's, and the client wall the
     founder's and the account owners' (a member who owns a pitch or a client) */
  function shownStations(ctx, scope) {
    const team = scope === 'team';
    const mine = n => { const m = (ctx.coll && ctx.coll[n] && ctx.coll[n].map) || {}; return Object.keys(m).some(id => m[id] && m[id].owner === ctx.uid); };
    return STATIONS().filter(k => AREA[k] && (k !== 'books' || scope === 'owner') && (k !== 'tray' || !team) && (k !== 'clients' || !team || mine('pitches') || mine('clients')));
  }

  /* ---------- the scene: plan, live layer, overlay and the COO, through a camera ---------- */
  function Scene({data, mode, follow, phone, whole, focusKey, onSay, onOpenStation, onOpenDesk, onOpenCoo, onFrame}) {
    const {ctx, L, D, scope, founder, day, rest} = data;
    const host = useRef(null);
    const reduced = useReduced();
    const lite = useLite();
    const hushed = useHushed();
    const visible = useVisible();
    const dark = M.useResolvedTheme() === 'dark';
    const [onScreen, setOnScreen] = useState(true);
    const [w, setW] = useState(0);
    const [doze, setDoze] = useState(false);
    const [listening, setListening] = useState(false);
    const [announce, setAnnounce] = useState('');
    const lastSaid = useRef(0), held = useRef(0);
    const poke = useRef(Date.now());
    const wake = useCallback(() => { poke.current = Date.now(); setDoze(false); }, []);

    /* the size of the box, settled for 150 ms (the plan scale, the COO's size) */
    useEffect(() => {
      const el = host.current;
      if (!el) return undefined;
      let t = 0;
      const measure = () => { clearTimeout(t); t = setTimeout(() => setW(el.getBoundingClientRect().width), 150); };
      setW(el.getBoundingClientRect().width);
      let ro = null, io = null;
      if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el); }
      if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver(es => setOnScreen(es.some(e => e.isIntersecting)), {threshold: .02}); io.observe(el); }
      return () => { clearTimeout(t); if (ro) ro.disconnect(); if (io) io.disconnect(); };
    }, []);
    /* dozing: two quiet minutes and the droid holds still until something new, a hover or a focus */
    useEffect(() => {
      const t = setInterval(() => { if (Date.now() - poke.current > 2 * MIN) setDoze(true); }, 20000);
      return () => clearInterval(t);
    }, []);
    useEffect(() => { wake(); }, [data.rows.length, data.pub && data.pub.seq, data.pub && data.pub.at]);
    /* listening: while the assistant listens or thinks, headphones on and it turns toward the dock */
    useEffect(() => {
      const S = M.assistant;
      if (!S || !S.subs) return undefined;
      const f = () => { const st = S.st || {}; setListening(['listening', 'hearing', 'thinking'].indexOf(st.phase) >= 0 || !!st.speaking); };
      f();
      S.subs.add(f);
      return () => { S.subs.delete(f); };
    }, []);

    /* the polite live region: the COO's acts, at most once a minute, summarised */
    const sayLine = useCallback(b => {
      if (!b || !b.line || b.rest || (founder && M.prefs.get('office.mute', '0') === '1')) return;
      const now = Date.now();
      if (now - lastSaid.current < MIN) { held.current++; return; }
      lastSaid.current = now;
      const more = held.current;
      held.current = 0;
      setAnnounce('m360 COO: ' + b.line + (more ? ' And ' + more + ' more.' : ''));
    }, [founder]);

    const still = reduced;
    const dir = useDirector({data, reduced, lite, onScreen: onScreen && visible, onSay: sayLine, onWake: wake});
    const {view} = dir;
    const bubble = view.bubble || (rest.bubble ? {...rest.bubble, fold: true, id: 'rest'} : null);
    useEffect(() => { if (onSay) onSay(bubble); }, [bubble && bubble.line, bubble && bubble.fold]);

    /* the camera: whole floor, or framing the COO's station at twice the scale */
    const planAR = L.H / L.W;
    const viewAR = whole ? planAR : (phone ? 3 / 4 : 9 / 16);
    const z = whole ? 1 : 2;
    const target = focusKey ? spotOf(L, focusKey) : spotOf(L, dir.pos.current || view.spot);
    const r = viewAR / planAR;
    const tx = whole ? 0 : clamp(1 - z, 0, .5 - z * target.x / L.W);
    const ty = whole ? 0 : clamp(r - z, 0, r / 2 - z * target.y / L.H);
    const ppu = w ? w / L.W * z : .5;
    const size = mode === 'page' && whole && !phone ? clamp(56, 96, Math.round(148 * ppu)) : phone ? 40 : (mode === 'page' ? 56 : 44);
    const showTags = ppu >= .4 || !whole;
    /* where the bubble sits: it flips to keep clear of a focus desk, and of the scene's edges */
    const me = spotOf(L, view.spot);
    const focusNear = D.some(d => d.focus && Math.abs(d.x - me.x) < 260 && d.y < me.y && me.y - d.y < 320);
    const side = me.x > L.W * .72 ? 'left' : me.x < L.W * .2 ? 'right' : (focusNear ? (D.find(d => d.focus && Math.abs(d.x - me.x) < 260).x > me.x ? 'left' : 'right') : '');
    const below = me.y < 340;
    /* is the COO in frame (a window's footer mirrors the bubble when it is not) */
    const fx0 = tx + z * me.x / L.W, fy0 = (ty + z * me.y / L.H) / r;
    const off = !whole && (fx0 < .06 || fx0 > .94 || fy0 < .1 || fy0 > 1.02);
    useEffect(() => { if (onFrame) onFrame(off); }, [off]);

    const paused = !visible || !onScreen || hushed || doze || (lite && !view.walking);
    const names = data.profs;
    const nm = u => ((names[u] || {}).name) || 'Someone';
    const asked = (view.fx.asked && Date.now() - (Number(view.fx.asked.at) || 0) < 10 * MIN) ? view.fx.asked : null;
    /* keyboard: the stations first, then the desks, one tab stop a pod with the arrows inside it */
    const [rove, setRove] = useState({});
    const pods = useMemo(() => {
      const out = {};
      D.forEach(d => { const k = d.cabin ? 'cabin' : d.pod; (out[k] = out[k] || []).push(d.uid); });
      return out;
    }, [D]);
    const keyDesk = (d, ev) => {
      const k = d.cabin ? 'cabin' : d.pod;
      const list = pods[k] || [];
      const i = list.indexOf(d.uid);
      const n = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? i + 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? i - 1 : null;
      if (n === null) return;
      ev.preventDefault();
      const next = list[(n + list.length) % list.length];
      setRove(x => ({...x, [k]: next}));
      const el = host.current && host.current.querySelector('[data-uid="' + next + '"]:is(.office-desk, .office-founder)');
      if (el) el.focus();
    };
    const tabFor = d => { const k = d.cabin ? 'cabin' : d.pod; return (rove[k] || (pods[k] || [])[0]) === d.uid ? 0 : -1; };
    const stationKeys = shownStations(ctx, scope);
    const counts = useMemo(() => { const c = {}; data.rows.forEach(x => { const s = x.station || 'desk'; c[s] = (c[s] || 0) + 1; }); return c; }, [data.rows]);
    const stLabel = k => STATION_LABEL[k] + '.' + (founder && counts[k] ? ' ' + counts[k] + (counts[k] === 1 ? ' act' : ' acts') + ' today.' : '') + (k === 'tray' && data.dec.length ? ' ' + data.dec.length + ' waiting on you.' : '');
    const cooLabel = 'm360 COO. ' + (bubble && bubble.line ? bubble.line : rest.asleep ? 'Asleep.' : 'At ' + (STATION_LABEL[view.spot] || 'its desk').replace(/^The /, 'the ').replace(/^Your /, 'your ') + '.');
    const roll = view.fx.roll;
    const joins = founder && M.team && M.team.requests ? M.team.requests(ctx).length : 0;
    const late = founder ? !!(data.health && data.health.stale) : false;

    return html`<div ref=${host} class=${'office' + (day.night ? ' is-night' : '') + (day.closed ? ' is-closed' : '') + (whole ? ' whole' : ' follow') + (phone ? ' on-phone' : '') + (lite ? ' lite' : '') + (paused ? ' is-paused' : '')}
      data-scope=${scope} data-mode=${mode} data-night=${day.night ? '1' : '0'} data-lite=${lite ? '1' : '0'} data-paused=${paused ? '1' : '0'}
      role="region" aria-label="The office" onPointerEnter=${wake} onFocus=${wake}>
      <div class="office-view" style=${{aspectRatio: String(1 / viewAR)}}>
        <div class="office-cam" style=${{transform: 'translate(' + (tx * 100).toFixed(3) + '%,' + (ty * 100).toFixed(3) + '%) scale(' + z + ')', aspectRatio: L.W + ' / ' + L.H, '--inv': String(1 / z)}}>
          <${PlanMemo} L=${L} owner=${scope === 'owner'}/>
          <${Live} L=${L} D=${D} fx=${view.fx} day=${day} scope=${scope} joins=${joins} late=${late}/>
          <div class="office-overlay">
            <span class="office-mark" style=${{left: pc(1050, L.W), top: pc(80, L.H)}} aria-hidden="true"><${M.Mark}/></span>
            ${day.closed ? html`<span class="office-sign" style=${{left: pc(70, L.W), top: pc(sy(L, 816), L.H)}}>Office closed</span>` : null}
            ${rest.card ? html`<span class="office-card" style=${{left: pc(330, L.W), top: pc(sy(L, 918), L.H)}}>${rest.card}</span>` : null}
            ${stationKeys.map(k => {
              const a = AREA[k];
              return html`<button key=${k} type="button" class=${'office-station' + (k === 'clock' && late ? ' late' : '')} data-key=${k} aria-label=${stLabel(k)}
                style=${{left: pc(a[0], L.W), top: pc(sy(L, a[1]), L.H), width: pc(a[2], L.W), height: pc(a[3], L.H)}} onClick=${() => onOpenStation && onOpenStation(k)}>
                <span class="os-label">${STATION_LABEL[k]}</span>
                ${k === 'tray' && data.dec.length ? html`<span class="os-count">${M.fx && M.fx.MetalBadge ? html`<${M.fx.MetalBadge}>${String(data.dec.length)}<//>` : html`<span class="pill flame">${data.dec.length}</span>`}</span>` : null}
              </button>`;
            })}
            ${D.map((d, i) => html`<${Desk} key=${d.uid} d=${d} L=${L} ppu=${ppu} name=${nm(d.uid)} tags=${showTags} tab=${tabFor(d)}
              lit=${roll && d.state !== 'closed' ? roll.k : 0} litDelay=${Math.min(i, 12) * 80} asked=${asked && asked.uid === d.uid ? asked.at : 0}
              label=${nm(d.uid) + ', ' + stateWord(d) + (d.focus ? ', in focus' : '') + '.'}
              avatar=${html`<${UI.Avatar} id=${d.uid} size=${phone && whole ? 22 : 28}/>`}
              onOpen=${() => onOpenDesk && onOpenDesk(d.uid)} onKey=${ev => keyDesk(d, ev)}/>`)}
            ${view.flights.map(f => html`<${Flight} key=${f.id} f=${f} L=${L} ppu=${ppu} onDone=${dir.land}/>`)}
            <div ref=${dir.track} class="office-track" style=${{transform: tr(L, me), zIndex: 10 + Math.round(view.walking && view.zWalk ? view.zWalk : me.y) + 1}}>
              <div class="office-anchor">
                ${!phone ? html`<${Bubble} b=${bubble} side=${side} below=${below} founder=${founder} onUndo=${id => undoRow(ctx, id)}/>` : null}
                <${Mascot} view=${view} rest=${rest} size=${size} still=${still} paused=${paused} listening=${listening} dark=${dark} label=${cooLabel} onOpen=${onOpenCoo}/>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${phone ? html`<div class="office-under" data-dock-avoid="">${bubble ? html`<${Bubble} b=${{...bubble, fold: false}} founder=${founder} onUndo=${id => undoRow(ctx, id)} big=${true}/>` : null}</div>` : null}
      <div class="office-sr" aria-live="polite">${announce}</div>
    </div>`;
  }

  async function undoRow(ctx, id) {
    const c = C();
    if (!c || !c.undo || !id) return null;
    try {
      const r = await c.undo(M.lastCtx || ctx, id);
      M.toast((r && r.say) || (r && r.ok ? 'Put back' : 'Could not undo'), !(r && r.ok));
      return r;
    } catch (e) { M.toast(String((e && e.message) || 'That did not go through'), true); return null; }
  }

  /* ---------- the text twin: now, today's run, the desks, what waits ---------- */
  function RunList({data, id, limit}) {
    const {ctx, rows, founder, scope, names} = data;
    if (!founder) return html`<p class="sub small">The COO's run is Kaavish's to read. What it does in general: <a href="#coo">the charter</a>.</p>`;
    const list = rows.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(0, limit || 60);
    if (!list.length) return html`<${UI.Empty} text="Nothing yet today."/>`;
    return html`<ol class="office-run" id=${id}>
      ${list.map(r => {
        const t = say(ctx, r.code || r.job, {...(r.args || {}), would: r.status === 'would', why: r.why && r.why.code}, scope);
        const undo = r.status === 'done' && Number(r.undoUntil) > Date.now();
        return html`<li key=${r.id} class=${'or-row ' + r.status} data-id=${r.id}>
          <span class="or-time num">${istHm(r.at)}</span>
          <span class="or-text"><b>${t.line || (C() && C().JOBS && C().JOBS[r.job] ? C().JOBS[r.job].label : r.job)}</b>${t.why ? html`<span class="sub small">${t.why}</span>` : null}
            ${r.status === 'would' ? html`<span class="pill">Practice</span>` : r.status === 'failed' ? html`<span class="pill flame-o">Did not go through</span>` : null}</span>
          ${undo ? html`<button type="button" class="btn sec sm" onClick=${() => undoRow(ctx, r.id)}>Undo</button>` : null}
        </li>`;
      })}
    </ol>`;
  }
  function DeskList({data}) {
    const {D, profs} = data;
    const byPod = {};
    D.forEach(d => { const k = d.cabin ? 'The cabin' : d.pod; (byPod[k] = byPod[k] || []).push(d); });
    const keys = Object.keys(byPod);
    if (!keys.length) return html`<${UI.Empty} text="Nobody on the roster yet."/>`;
    return html`<div class="office-desklist">${keys.map(k => html`<div key=${k} class="odl-pod">
      <div class="micro plain">${k}</div>
      <ul>${byPod[k].map(d => html`<li key=${d.uid} data-uid=${d.uid}><${UI.Avatar} id=${d.uid} size=${22}/><span class="grow">${((profs[d.uid] || {}).name) || 'Someone'}</span>
        <span class="sub small">${d.tag || stateWord(d)}${d.focus ? ', in focus' : ''}</span></li>`)}</ul>
    </div>`)}</div>`;
  }
  function Waiting({data}) {
    const {dec} = data;
    if (!dec.length) return html`<p class="sub small">Nothing waits on you.</p>`;
    return html`<ul class="office-wait">${dec.slice(0, 6).map(c => html`<li key=${c.id}>${c.urgent ? html`<i class="ob-dot" aria-hidden="true"/>` : null}<span class="grow">${c.title || 'A card'}</span></li>`)}
      ${dec.length > 6 ? html`<li class="sub small">And ${dec.length - 6} more.</li>` : null}
      <li><${UI.Btn} kind="sec" sm=${true} onClick=${() => M.nav('#coo')}>Open Needs you<//></li></ul>`;
  }
  function Rail({data, now, id, list}) {
    return html`<div class=${'office-rail' + (list ? ' as-list' : '')} id=${id}>
      <section class="card or-card"><div class="card-head"><h2 class="card-title">Now</h2></div>
        ${now && now.line ? html`<${Bubble} b=${{...now, fold: false}} founder=${data.founder} big=${true} onUndo=${x => undoRow(data.ctx, x)}/>`
          : html`<p class="small">${data.rest.asleep ? 'Asleep at its desk.' : 'Between rounds, at its ' + (data.rest.station === 'tray' ? 'tray' : 'desk') + '.'}</p>`}
        <p class="tiny sub" style=${{marginTop: '8px'}}>${clockLine(data.ctx, data)}</p></section>
      ${data.founder ? html`<section class="card or-card"><div class="card-head"><h2 class="card-title">Waiting on you</h2></div><${Waiting} data=${data}/></section>` : null}
      ${data.founder ? html`<section class="card or-card"><div class="card-head"><h2 class="card-title">Today's run</h2></div><${RunList} data=${data} limit=${list ? 200 : 20}/></section>` : null}
      <section class="card or-card"><div class="card-head"><h2 class="card-title">Desks</h2></div><${DeskList} data=${data}/></section>
      ${!data.founder ? html`<p class="sub small">The COO is a bot that helps Kaavish run the day. <a href="#coo">What it does</a>.</p>` : null}
      <${Prefs} founder=${data.founder}/>
    </div>`;
  }
  /* this device's own choices: the walks between rounds, and (Kaavish) the spoken line for screen readers */
  function Prefs({founder}) {
    const [, bump] = useState(0);
    const flip = (k, on) => { M.prefs.set(k, on ? '1' : '0'); bump(n => n + 1); };
    return html`<div class="office-prefs stack">
      <${UI.Check} label="Let the COO wander between rounds" checked=${prefOn('office.wander', true)} onChange=${v => flip('office.wander', v)}/>
      ${founder ? html`<${UI.Check} label="Read its acts out to a screen reader" checked=${M.prefs.get('office.mute', '0') !== '1'} onChange=${v => flip('office.mute', !v)}/>` : null}
    </div>`;
  }

  /* ---------- the drawers: a station, a desk, the COO ---------- */
  const NAV = {attendance: ['#people', 'Open Crew'], calendar: ['#leave', 'Open Leave'], board: ['#tasks', 'Open tasks'], review: ['#reviews', 'Open Reviews'],
    desk: ['#coo', 'Open the COO'], meeting: ['#week', 'Open the week'], clients: ['#pitches', 'Open the pipeline'], mail: ['#coo', 'Open the COO'],
    tray: ['#coo', 'Open Needs you'], books: ['#invoices', 'Open invoices'], reception: ['#admin', 'Open Admin'], clock: ['#coo', 'Open the COO']};
  function StationDrawer({k, data, onClose}) {
    const {ctx, founder, rows, D, profs, scope} = data;
    const nm = u => ((profs[u] || {}).name) || 'Someone';
    const here = rows.filter(r => (r.station || 'desk') === k);
    const nav = NAV[k];
    const nav2 = founder || ['attendance', 'calendar', 'board', 'review', 'meeting'].indexOf(k) >= 0 ? nav : (k === 'desk' || k === 'mail' || k === 'clock' ? ['#coo', 'What the COO does'] : k === 'reception' ? null : nav);
    let body = null;
    if (k === 'attendance') {
      const grp = (st, label) => { const l = D.filter(d => d.state === st && !d.cabin); return l.length ? html`<li key=${st}><b>${label}</b> <span class="sub">${l.map(d => nm(d.uid)).join(', ')}</span></li>` : null; };
      const hotOnes = D.filter(d => d.hot);
      const lateOnes = D.filter(d => d.late);
      body = html`<ul class="office-list">${grp('office', 'In')}${grp('wfh', 'WFH')}${grp('elsewhere', 'Out and about')}${grp('leave', 'Away')}${grp('out', 'Gone for the day')}
        ${lateOnes.length ? html`<li><b>Late</b> <span class="sub">${lateOnes.map(d => nm(d.uid)).join(', ')}</span></li>` : null}
        ${hotOnes.length ? html`<li><b>Not in yet</b> <span class="sub">${hotOnes.map(d => nm(d.uid)).join(', ')}</span></li>` : null}</ul>`;
    } else if (k === 'calendar') {
      const days = [];
      let d = U.parseYmd(data.day.ymd);
      for (let i = 0; i < 14; i++) { const ymd = U.ymd(d); const who = Object.keys(ctx.leaveMap || {}).filter(u => ctx.leaveMap[u].has(ymd) && L0(ctx).seats[u]); if (who.length) days.push([ymd, who]); d = U.addDays(d, 1); }
      body = days.length ? html`<ul class="office-list">${days.map(([ymd, who]) => html`<li key=${ymd}><b>${U.fmtDay(ymd)}</b> <span class="sub">${who.map(nm).join(', ')}</span></li>`)}</ul>` : html`<p class="sub small">Nobody is out in the next two weeks.</p>`;
    } else if (k === 'board') {
      const see = viewerOf(ctx, scope).see;
      const open = {};
      Object.keys(ctx.coll.tasks.map).forEach(id => { const t = ctx.coll.tasks.map[id]; if (t && !t.deleted && t.status !== 'done' && t.owner) { const o = open[t.owner] = open[t.owner] || [0, 0]; o[0]++; if (t.due && t.due < data.day.ymd) o[1]++; } });
      const mine = D.filter(x => (founder || (see(x.uid) && x.uid !== ctx.uid)) && open[x.uid]);
      body = mine.length ? html`<ul class="office-list">${mine.map(x => html`<li key=${x.uid}><b>${nm(x.uid)}</b> <span class="sub">${open[x.uid][0]} open${open[x.uid][1] ? ', ' + open[x.uid][1] + ' overdue' : ''}</span></li>`)}</ul>` : null;
    } else if (k === 'review') {
      const qd = M.reviews ? M.reviews.queue(ctx) : [];
      body = qd.length ? html`<ul class="office-list">${qd.slice(0, 8).map(t => html`<li key=${t.id || t.title}>${t.title || 'A task'}</li>`)}</ul>` : html`<p class="sub small">Nothing waits for review.</p>`;
    } else if (k === 'tray' || (k === 'desk' && founder)) {
      const cards = k === 'desk' ? data.dec.filter(c => /mail|invoice/.test(c.kind || '')) : data.dec;
      /* titles only: a card is applied, sent or declined in Needs you, never from an office click */
      body = cards.length ? html`<ul class="office-list">${cards.slice(0, 10).map(c => html`<li key=${c.id}>${c.urgent ? html`<i class="ob-dot" aria-hidden="true"/>` : null}${c.title || 'A card'}</li>`)}
        ${cards.length > 10 ? html`<li class="sub small">And ${cards.length - 10} more.</li>` : null}</ul>` : html`<p class="sub small">${k === 'desk' ? 'No drafts wait for you.' : 'Nothing waits on you.'}</p>`;
    } else if (k === 'reception' && founder) {
      const n = M.team && M.team.requests ? M.team.requests(ctx).length : 0;
      body = html`<p class="sub small">${n ? n + (n === 1 ? ' person waits to join.' : ' people wait to join.') : 'Nobody waits to join.'}</p>`;
    } else if (k === 'clock') {
      const h = data.health;
      body = html`<div class="stack"><p>${clockLine(ctx, data)}</p>
        ${founder && h ? html`<ul class="office-list"><li><b>Runner</b> <span class="sub">${h.runner === 'server' ? 'The team site, every 15 minutes' : 'This page, while m360 is open'}</span></li>
          ${h.ai ? html`<li><b>AI used</b> <span class="sub">${h.ai.used} of ${h.ai.cap}</span></li>` : null}
          ${h.stale ? html`<li><b>Late</b> <span class="sub">No round for a while. The next one catches up.</span></li>` : null}</ul>` : null}</div>`;
    } else if (k === 'books') body = html`<p class="sub small">Reminders wait here as drafts for your tap. Nothing pays from the office.</p>`;
    const team = !founder ? teamLine(ctx, k, false) : '';
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${STATION_LABEL[k]}
      footer=${nav2 ? html`<${UI.Btn} kind="sec" onClick=${() => { onClose(); M.nav(nav2[0]); }}>${nav2[1]}<//>` : null}>
      <div class="stack office-drawer" data-station=${k}>
        ${team ? html`<p class="sub">${team}</p>` : null}
        ${body}
        ${founder && here.length ? html`<div><div class="micro plain">Today here</div><${RunList} data=${{...data, rows: here}} limit=${20}/></div>` : null}
      </div>
    <//>`;
  }
  const L0 = ctx => layout(ctx);
  /* the person's one-tap answer to a manager's bot, in the chips' own words */
  const ANSWER = {onit: 'on it', blocked: 'blocked', wrong: 'not right', leave: 'off today', reply: 'replied in the messages'};
  function DeskDrawer({uid, data, onClose}) {
    const {ctx, D, profs, founder, scope} = data;
    const d = D.find(x => x.uid === uid);
    if (!d) return null;
    const name = ((profs[uid] || {}).name) || 'Someone';
    const see = viewerOf(ctx, scope).see(uid);
    let open = 0, over = 0;
    if (see) Object.keys(ctx.coll.tasks.map).forEach(id => { const t = ctx.coll.tasks.map[id]; if (t && !t.deleted && t.status !== 'done' && t.owner === uid) { open++; if (t.due && t.due < data.day.ymd) over++; } });
    const first = String(name).split(' ')[0];
    /* the last thing a personal manager's bot asked today, and the answer (the manager's own line) */
    let pm = '';
    if (see && (founder || uid !== ctx.uid) && M.pm && M.pm.log) {
      try {
        const it = (((M.pm.log(ctx, uid, 1) || [])[0] || {}).items || []).slice(-1)[0];
        const how = it && it.ack ? ANSWER[it.ack.how] : '';
        pm = it ? String(it.mgrLine || it.line || '') + (how ? ' Answered: ' + how + '.' : it.ack ? '' : ' No answer yet.') : '';
      } catch (e) { pm = ''; }
    }
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${name}
      footer=${html`<div class="row"><${UI.Btn} kind="sec" onClick=${() => { onClose(); M.nav('#people/' + uid); }}>Open profile<//>
        ${uid !== ctx.uid && M.assistant && M.assistant.open ? html`<${UI.Btn} kind="sec" onClick=${() => { onClose(); M.assistant.open('Ask ' + first + ' '); }}>Ask<//>` : null}</div>`}>
      <div class="stack office-drawer" data-uid=${uid}>
        <div class="row"><${UI.Avatar} id=${uid} size=${44}/><div class="grow"><b>${capital(stateWord(d))}</b>${d.focus ? html`<div class="sub small">In focus. Best not to interrupt.</div>` : null}</div></div>
        ${see && (founder || uid !== ctx.uid) ? html`<ul class="office-list">
          ${d.inAt ? html`<li><b>Checked in</b> <span class="sub">${istHm(d.inAt)}${d.late ? ', late' : ''}</span></li>` : null}
          ${d.quiet ? html`<li><b>Quiet</b> <span class="sub">${d.quiet.replace(/^Quiet /, '')}</span></li>` : null}
          <li><b>Open work</b> <span class="sub">${open} open${over ? ', ' + over + ' overdue' : ''}</span></li>
          ${pm ? html`<li><b>Last ask</b> <span class="sub">${pm}</span></li>` : null}</ul>` : null}
      </div>
    <//>`;
  }
  const capital = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  function CooDrawer({data, now, onClose, onRun}) {
    const {ctx, founder, rows} = data;
    const last = rows.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(0, 5);
    const c = C();
    const title = c && c.title ? c.title(ctx) : 'm360 COO';
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${title}
      footer=${html`<div class="row">
        ${founder ? html`<${UI.Btn} kind="sec" onClick=${() => { onClose(); onRun(); }}>Today's run<//>` : html`<${UI.Btn} kind="sec" onClick=${() => { onClose(); M.nav('#coo'); }}>What the COO does<//>`}
        ${founder && c && c.pause && c.status && c.status(ctx) !== 'off' && c.status(ctx) !== 'paused' ? html`<${UI.Btn} kind="sec" onClick=${() => c.pause(M.lastCtx || ctx).then(r => M.toast((r && r.say) || 'Paused'), () => M.toast('That did not go through', true))}>Pause until tomorrow<//>` : null}
        ${M.assistant && M.assistant.open ? html`<${UI.Btn} kind="sec" onClick=${() => { onClose(); M.assistant.open('COO, '); }}>Ask the COO<//>` : null}
      </div>`}>
      <div class="stack office-drawer" data-coo="1">
        ${now && now.line ? html`<${Bubble} b=${{...now, fold: false}} founder=${founder} big=${true} onUndo=${x => undoRow(ctx, x)}/>` : html`<p class="sub">${clockLine(ctx, data)}</p>`}
        ${founder ? (last.length ? html`<div><div class="micro plain">The last five</div><${RunList} data=${{...data, rows: last}} limit=${5}/></div>` : null)
          : html`<p class="sub small">A bot that helps Kaavish run the day. It asks short questions and explains anything it changes.</p>`}
      </div>
    <//>`;
  }

  /* the drawers a scene opens, shared by the page and the windows */
  function useDrawers(data, onRun) {
    const [open, setOpen] = useState(null);
    const close = () => setOpen(null);
    const node = !open ? null : open.k === 'station' ? html`<${StationDrawer} k=${open.v} data=${data} onClose=${close}/>`
      : open.k === 'desk' ? html`<${DeskDrawer} uid=${open.v} data=${data} onClose=${close}/>` : html`<${CooDrawer} data=${data} now=${open.now} onClose=${close} onRun=${onRun || (() => M.nav('#office'))}/>`;
    return {node, station: k => setOpen({k: 'station', v: k}), desk: u => setOpen({k: 'desk', v: u}), coo: now => setOpen({k: 'coo', now})};
  }

  /* ---------- the #office page ---------- */
  function Office({scope}) {
    const data = useData(scope);
    const phone = useMedia('(max-width: 700px)');
    const [mode, setMode] = useState(() => M.prefs.get('office.view', 'office'));
    const [cam, setCam] = useState(() => M.prefs.get('office.cam', 'floor'));
    const [pick, setPick] = useState(null);
    const [now, setNow] = useState(null);
    const toList = () => { setMode('list'); M.prefs.set('office.view', 'list'); };
    const dr = useDrawers(data, toList);
    const whole = phone ? cam === 'floor-phone' : cam !== 'follow';
    const counts = {};
    data.rows.forEach(r => { const s = r.station || 'desk'; counts[s] = (counts[s] || 0) + 1; });
    const chips = shownStations(data.ctx, data.scope);
    const scene = html`<${Scene} data=${data} mode="page" follow=${!whole} phone=${phone} whole=${whole} focusKey=${pick}
      onSay=${setNow} onOpenStation=${k => { setPick(phone ? k : null); dr.station(k); }} onOpenDesk=${dr.desk} onOpenCoo=${() => dr.coo(now)}/>`;
    return html`<div class="office-page stack" data-scope=${data.scope}>
      <div class="office-head">
        <div class="grow"><h2 class="office-title">The office</h2><div class="sub small">${clockLine(data.ctx, data)}</div></div>
        <div class="row office-ctl">
          <${UI.Seg} sm=${true} ariaLabel="View" value=${mode} onChange=${v => { setMode(v); M.prefs.set('office.view', v); }} options=${[{v: 'office', label: 'Office'}, {v: 'list', label: 'List'}]}/>
          ${mode === 'office' ? html`<${UI.Seg} sm=${true} ariaLabel="Camera" value=${phone ? (cam === 'floor-phone' ? 'floor-phone' : 'follow') : (cam === 'follow' ? 'follow' : 'floor')}
            onChange=${v => { setCam(v); setPick(null); M.prefs.set('office.cam', v); }}
            options=${[{v: 'follow', label: 'Follow COO'}, {v: phone ? 'floor-phone' : 'floor', label: 'Whole floor'}]}/>` : null}
        </div>
      </div>
      ${mode === 'list' ? html`<${Rail} data=${data} now=${now} id="office-run" list=${true}/>` : phone ? html`<div class="stack">
          <div class="office-chips" role="toolbar" aria-label="Stations">${chips.map(k => html`<button key=${k} type="button" class=${'chip office-chip' + (pick === k ? ' active' : '')} data-key=${k}
            onClick=${() => { setPick(k); dr.station(k); }}>${STATION_LABEL[k].replace(/^The /, '')}${data.founder && (k === 'tray' ? data.dec.length : counts[k]) ? html`<b class="num">${k === 'tray' ? data.dec.length : counts[k]}</b>` : null}</button>`)}</div>
          ${scene}
          ${data.founder ? html`<section class="card or-card"><div class="card-head"><h2 class="card-title">Today's run</h2></div><${RunList} data=${data} limit=${20}/></section>` : null}
          <section class="card or-card"><div class="card-head"><h2 class="card-title">Desks</h2></div><${DeskList} data=${data}/></section>
        </div>` : html`<div class="office-grid">${scene}<${Rail} data=${data} now=${now}/></div>`}
      ${dr.node}
    </div>`;
  }

  /* ---------- the live window: HQ's brief, Home, the COO tab ---------- */
  function OfficeWindow({mode, scope}) {
    const data = useData(scope);
    const phone = useMedia('(max-width: 700px)');
    const [now, setNow] = useState(null);
    const [off, setOff] = useState(false);
    const dr = useDrawers(data);
    return html`<div class="office-window" data-mode=${mode || 'hq'}>
      <${Scene} data=${data} mode=${mode || 'hq'} follow=${true} phone=${phone} whole=${false} onSay=${setNow} onFrame=${setOff}
        onOpenStation=${dr.station} onOpenDesk=${dr.desk} onOpenCoo=${() => dr.coo(now)}/>
      <div class="office-foot">
        <span class="tiny sub grow">${clockLine(data.ctx, data)}</span>
        ${off && now && now.line && !phone ? html`<span class="office-mirror tiny">${now.line}</span>` : null}
        <button type="button" class="btn sec sm" onClick=${() => M.nav('#office')}>Open the office</button>
      </div>
      ${dr.node}
    </div>`;
  }

  M.pages.Office = Office;
  M.parts.OfficeWindow = OfficeWindow;
  M.office = {layout, desks, path, queue, STATION_POS, choreo, viewerOf};
})();
