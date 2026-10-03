/* module: tape. HQ's live tape (everything that happened today, newest first), the quiet board
   (everyone's working day as a strip, every quiet stretch in flame, see M.quiet) and the mood
   heatmap (the last three weeks of check-in moods, one row per person). Founder only. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useMemo} = React;
  const MIN = 60000, HOUR = 3600000;
  const LIMIT = 40;
  const NONE = {};

  /* the founder's log as quiet marks for the last seven days (M.ai.quietLog: one read on a visit, shared
     with the AI and kept five minutes); the activity stamps carry today live from there. {} for anyone
     else, or when on is false */
  function useLog(ctx, on) {
    const [log, setLog] = useState(NONE);
    const td = U.todayStr();
    useEffect(() => {
      if (!on || !ctx.isFounder || !M.ai || !M.ai.quietLog) return undefined;
      let live = true;
      M.ai.quietLog(ctx).then(d => { if (live && d) setLog(d); }, () => {});
      return () => { live = false; };
    }, [on, ctx.isFounder, td]);
    return log;
  }

  /* ---------- quiet stretches, as M.quiet reads each day ---------- */
  /* everyone else who checked in on ymd, with their quiet time (the viewer's own day is theirs to read on
     their page). log is the founder's log ({uid: {ymd: [at]}}) so the hours before the stamps read too.
     Quiet now first, then the most quiet time. */
  function quietRows(ctx, ymd, log) {
    if (!M.quiet) return [];
    const now = Number(ctx.now) || Date.now();
    return ctx.activeMembers.filter(m => m.uid !== ctx.uid && ctx.canSee(m.uid)).map(m => {
      const r = M.quiet.day(ctx, m.uid, ymd, {now, extra: ((log || {})[m.uid] || {})[ymd]});
      r.total = r.stretches.reduce((n, x) => n + x.quietMs, 0);
      r.longest = r.stretches.reduce((n, x) => Math.max(n, x.quietMs), 0);
      return r;
    }).filter(r => r.from).sort((a, b) => (!!b.live - !!a.live) || (b.total - a.total) || (a.from - b.from));
  }

  /* the days the board offers: today, yesterday and the earlier working days of the last week */
  function pickDays(ctx) {
    const now = new Date(Number(ctx.now) || Date.now());
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(now, -i), ymd = U.ymd(d);
      if (i && (d.getDay() === 0 || (ctx.holidays && ctx.holidays.has(ymd)))) continue;
      out.push({ymd, label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : U.DAYS_S[d.getDay()] + ' ' + d.getDate()});
    }
    return out;
  }

  /* quiet: today's rows from quietRows (the tape reads without the log when they are missing) */
  function tape(ctx, quiet) {
    const td = U.todayStr(), start = U.parseYmd(td).getTime();
    const out = [];
    const nm = id => html`<${UI.Name} id=${id}/>`;
    const push = (at, text, hot, uid, k) => { if (at >= start) out.push({at, text, hot: !!hot, uid, k}); };
    /* a quiet stretch sits where it began */
    (quiet || quietRows(ctx, td, null)).forEach(r => r.stretches.forEach(st => push(st.from, html`${nm(r.uid)}: ${M.quiet.line(st)}`, true, r.uid, 'quiet')));
    ctx.activeMembers.forEach(m => {
      const e = ((ctx.coll.checkin.map[m.uid] || {}).days || {})[td];
      if (e && e.in) push(e.in, html`${nm(m.uid)} checked in, ${e.mode === 'wfh' ? 'WFH' : 'office'}${e.mood ? ', feeling ' + ['', 'drained', 'low', 'okay', 'good', 'on fire'][e.mood] : ''}`, e.late, m.uid);
      if (e && e.out) push(e.out, html`${nm(m.uid)} checked out`, false, m.uid);
      const eod = ((ctx.coll.eod.map[m.uid] || {}).days || {})[td];
      if (eod && eod.at) push(eod.at, html`${nm(m.uid)} posted an EOD line: ${String(eod.shipped).slice(0, 80)}`, false, m.uid);
    });
    const tmap = ctx.coll.tasks.map;
    for (const id of Object.keys(tmap)) {
      const t = tmap[id];
      if (!t) continue;
      if (t.doneAt) push(t.doneAt, html`${nm(t.owner)} shipped ${t.title}`, false, t.owner);
      if (t.reviewAt) push(t.reviewAt, html`${nm(t.owner)} sent ${t.title} for review`, false, t.owner);
      if (t.sentBackAt) push(t.sentBackAt, html`${nm(t.sentBackBy)} sent ${t.title} back`, true, t.sentBackBy);
      if (t.created && t.by) push(t.created, html`${nm(t.by)} created ${t.title}${t.owner && t.owner !== t.by ? html` for ${nm(t.owner)}` : ''}`, false, t.by);
    }
    for (const a of Object.keys(ctx.coll.feed.map)) for (const p of (ctx.coll.feed.map[a].posts || [])) if (p) push(p.at, html`${nm(a)} posted ${p.kind === 'poll' ? 'a poll' : p.kind === 'announce' ? 'an announcement' : p.kind === 'win' ? 'a win' : 'an update'}: ${String(p.text).slice(0, 70)}`, p.kind === 'announce', a);
    for (const g of Object.keys(ctx.coll.kudos.map)) for (const k of (ctx.coll.kudos.map[g].given || [])) if (k) push(k.at, html`${nm(g)} gave kudos to ${nm(k.to)}`, false, g);
    for (const u of Object.keys(ctx.coll.leave.map)) for (const r of (ctx.coll.leave.map[u].reqs || [])) if (r && r.at) push(r.at, html`${nm(u)} asked for leave`, false, u);
    (M.team ? M.team.requests(ctx) : []).forEach(r => push(r.at, html`${nm(r.uid)} asked to join`, true, r.uid));
    /* the quiet rows matter most: the rest of the day fills what the limit leaves */
    out.sort((a, b) => b.at - a.at);
    const q = out.filter(e => e.k === 'quiet');
    return q.concat(out.filter(e => e.k !== 'quiet').slice(0, Math.max(0, LIMIT - q.length))).sort((a, b) => b.at - a.at);
  }

  function Tape({quiet}) {
    const ctx = M.useCtx();
    const [all, setAll] = useState(false);
    const log = useLog(ctx, !quiet);
    const list = tape(ctx, quiet || quietRows(ctx, U.todayStr(), log));
    /* folded: the newest eight, and every quiet stretch wherever it sits */
    const short = list.filter((e, i) => i < 8 || e.k === 'quiet');
    const shown = all ? list : short;
    return html`<${UI.Card} id="tape" title="The tape" action=${html`<span class="small ink62 num">${list.length} today</span>`}>
      ${list.length ? html`<div class="tape">
        ${shown.map((e, i) => html`<div class=${'tape-row' + (e.k === 'quiet' ? ' quiet' : '')} key=${i} data-k=${e.k || ''} data-hot=${e.hot ? '1' : '0'}>
          <span class="tm num">${U.hhmm(e.at)}</span>
          <span class="nd"><i class=${e.hot ? 'hot' : ''}/></span>
          <span class="tx">${e.text}</span>
        </div>`)}
      </div>` : html`<${UI.Empty} text="Quiet so far today."/>`}
      ${list.length > short.length ? html`<button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => setAll(!all)}>${all ? 'Show less' : 'Show all ' + list.length}</button>` : null}
    <//>`;
  }

  /* ---------- the quiet board: one strip per person, the working day on a time axis ---------- */
  /* whole hours from the earliest check-in (09:00 with nobody in) to the EOD cut (20:00 without one),
     stretched to take in a late check-out or an early mark */
  function axisFor(ctx, ymd, rows) {
    const d0 = U.parseYmd(ymd).getTime();
    const cut = ctx.settings.eodCut ? U.minutes(String(ctx.settings.eodCut)) * MIN : 20 * HOUR;
    let first = 9 * HOUR, last = cut;
    rows.forEach((r, i) => {
      const lo = Math.min(r.from, r.marks.length ? r.marks[0].s : r.from) - d0;
      const hi = Math.max(r.to, r.marks.length ? r.marks[r.marks.length - 1].e : r.to) - d0;
      first = i ? Math.min(first, lo) : lo;
      last = Math.max(last, hi);
    });
    const a = Math.max(6, Math.floor(first / HOUR)), b = Math.max(a + 6, Math.min(24, Math.ceil(last / HOUR)));
    return {d0, a: d0 + a * HOUR, b: d0 + b * HOUR, h0: a, hours: b - a};
  }
  const pct = (x, ax) => Math.max(0, Math.min(100, 100 * (x - ax.a) / (ax.b - ax.a)));
  const span = (s, e, ax) => ({left: pct(s, ax) + '%', width: Math.max(0.4, pct(e, ax) - pct(s, ax)) + '%'});

  function Hours({ax, className}) {
    const step = ax.hours > 12 ? 3 : 2;
    const hs = [];
    for (let h = ax.h0; h <= ax.h0 + ax.hours; h += step) hs.push(h);
    return html`<span class=${'qb-hours ' + (className || '')} aria-hidden="true">${hs.map((h, i) => html`<span key=${h}
      class=${i === 0 ? 'first' : h === ax.h0 + ax.hours ? 'last' : ''} style=${{left: pct(ax.d0 + h * HOUR, ax) + '%'}}>${U.pad(h % 24)}:00</span>`)}</span>`;
  }

  /* the day as a strip: the worked window, a tick per mark, focus under it, lunch shaded, quiet in flame */
  function Strip({r, ax, now, label}) {
    const out = r.marks.find(m => m.k === 'out');
    const lunch = r.lunch ? [ax.d0 + r.lunch[0] * MIN, ax.d0 + r.lunch[1] * MIN] : null;
    /* the part of a stretch inside the lunch hour, as a share of the stretch */
    const inLunch = st => {
      const s = lunch ? Math.max(st.from, lunch[0]) : 0, e = lunch ? Math.min(st.to, lunch[1]) : 0, w = st.to - st.from;
      return e > s ? {left: 100 * (s - st.from) / w + '%', width: 100 * (e - s) / w + '%'} : null;
    };
    const seen = new Set();
    const ticks = r.marks.filter(m => m.k !== 'f' && m.s >= ax.a && m.s <= ax.b).filter(m => {
      const k = m.k + Math.round(pct(m.s, ax) * 2);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return html`<span class="qb-strip" role="img" aria-label=${label} style=${{'--qb-step': (100 / ax.hours) + '%'}}>
      ${lunch ? html`<i class="qb-lunch" style=${span(lunch[0], lunch[1], ax)}/>` : null}
      <i class="qb-day" style=${span(r.from, out ? out.s : r.to, ax)}/>
      ${r.marks.filter(m => m.k === 'f').map((m, i) => html`<i key=${'f' + i} class="qb-f" style=${span(m.s, m.e, ax)}/>`)}
      ${ticks.map((m, i) => html`<i key=${'t' + i} class=${'qb-t k-' + m.k} style=${{left: pct(m.s, ax) + '%'}}/>`)}
      ${r.stretches.map((st, i) => { const l = inLunch(st); return html`<i key=${'q' + i} class=${'qb-q' + (st.live ? ' live' : '')} style=${span(st.from, st.to, ax)}>
        ${l ? html`<i class="qb-ql" style=${l}/>` : null}
        ${(st.to - st.from) / (ax.b - ax.a) >= 0.14 ? html`<b>${M.quiet.dur(st.quietMs)}</b>` : null}</i>`; })}
      ${now && now >= ax.a && now <= ax.b ? html`<i class="qb-now" style=${{left: pct(now, ax) + '%'}}/>` : null}
    </span>`;
  }

  /* the one line on the right: steady, or how many stretches and the longest */
  function sumOf(r) {
    const n = r.stretches.length, d = M.quiet.dur;
    if (!n) return 'steady';
    if (r.live && n === 1) return 'quiet since ' + U.hhmm(r.live.from) + ', ' + d(r.live.quietMs) + ' so far';
    return (n === 1 ? '1 quiet stretch, ' + d(r.longest) : n + ' quiet stretches, longest ' + d(r.longest)) + (r.live ? ', one running now' : '');
  }

  /* log: the founder's log for the picker's days, today: today's rows (HQ reads both once for the page) */
  function QuietBoard({log, today}) {
    const ctx = M.useCtx();
    const days = pickDays(ctx);
    const td = days[0].ymd;
    /* null is today, so the board moves on with the clock at midnight */
    const [pick, setPick] = useState(null);
    const ymd = pick && days.some(d => d.ymd === pick) ? pick : td;
    const own = useLog(ctx, !log);
    const lx = log || own;
    const now = Number(ctx.now) || Date.now();
    const todayRows = useMemo(() => today || quietRows(ctx, td, lx), [ctx, td, lx, today]);
    const rows = useMemo(() => ymd === td ? todayRows : quietRows(ctx, ymd, lx), [ctx, ymd, td, lx, todayRows]);
    const ps = M.useProfiles(rows.map(r => r.uid));
    const c = M.quiet ? M.quiet.cfg(ctx) : {on: false, mins: 120};
    const live = todayRows.filter(r => r.live).length;
    const ax = axisFor(ctx, ymd, rows);
    const isToday = ymd === td;
    const dayWord = isToday ? 'today' : U.fmtDay(ymd);
    const thr = c.mins % 60 ? M.quiet.dur(c.mins * MIN) : c.mins / 60 + 'h';
    const label = r => {
      const out = r.marks.find(m => m.k === 'out');
      return ((ps[r.uid] && ps[r.uid].name) || 'Someone') + ', ' + dayWord + ': in at ' + U.hhmm(r.from) + (out ? ', out at ' + U.hhmm(out.s) : isToday ? ', still in' : ', no check-out') + '. ' +
        (r.stretches.length ? r.stretches.map(st => U.cap(M.quiet.line(st))).join('. ') + '.' : 'No quiet stretches.');
    };
    return html`<${UI.Card} id="quiet-board" title="Quiet stretches" action=${html`<span id="quiet-now" data-n=${live} class=${'pill ' + (live ? 'flame' : '')}>${live ? live + ' quiet now' : 'nobody quiet now'}</span>`}>
      <div class="qb-days" role="group" aria-label="Pick a day">${days.map(d => html`<button key=${d.ymd} type="button" data-ymd=${d.ymd}
        class=${'chip' + (d.ymd === ymd ? ' on' : '')} aria-pressed=${d.ymd === ymd} onClick=${() => setPick(d.ymd === td ? null : d.ymd)}>${d.label}</button>`)}</div>
      ${!c.on ? html`<${UI.Empty} text="The quiet watch is switched off in the rules."/>`
        : !rows.length ? html`<${UI.Empty} text=${!ctx.isWorkingDay(ymd) ? 'A day off, so the quiet watch rests.' : isToday ? 'Nobody has checked in yet today.' : 'Nobody checked in that day.'}/>`
        : html`<div class="qb">
          <div class="qb-axis"><${Hours} ax=${ax}/></div>
          ${rows.map(r => {
            const out = r.marks.find(m => m.k === 'out');
            return html`<button type="button" class="rowbtn qb-row" key=${r.uid} id=${'qb-' + r.uid} data-live=${r.live ? '1' : '0'} onClick=${() => M.nav('#people/' + r.uid)}>
              <span class="qb-who"><${UI.Avatar} id=${r.uid} size=${28}/><span class="qb-nm"><b><${UI.Name} id=${r.uid}/></b>
                <span class="tiny ink62 num">${out ? U.hhmm(r.from) + ' to ' + U.hhmm(out.s) : (isToday ? 'in since ' : 'in at ') + U.hhmm(r.from)}</span></span></span>
              <${Strip} r=${r} ax=${ax} now=${isToday ? now : 0} label=${label(r)}/>
              <${Hours} ax=${ax} className="per"/>
              <span class=${'qb-sum small' + (r.stretches.length ? ' hot' : '')}><span>${sumOf(r)}</span>
                ${r.status ? html`<span class="tiny ink62">status: ${r.status}</span>` : null}</span>
            </button>`; })}
        </div>
        <div class="tiny ink62 qb-key">Flame is ${thr} or more with nothing recorded on m360, the shaded lunch hour aside. Ticks are saved work, tasks, posts, check-in and out and the EOD line; focus runs under the strip.</div>`}
    <//>`;
  }

  function MoodHeat() {
    const ctx = M.useCtx();
    const days = [];
    for (let i = 20; i >= 0; i--) { const d = U.addDays(new Date(ctx.now), -i); if (d.getDay() !== 0) days.push(U.ymd(d)); }
    const rows = ctx.activeMembers.map(m => ({uid: m.uid, cells: days.map(d => { const e = ((ctx.coll.checkin.map[m.uid] || {}).days || {})[d]; return e && e.mood ? e.mood : (e && e.in ? 3 : 0); })}));
    const avg = days.map(d => { const v = ctx.activeMembers.map(m => (((ctx.coll.checkin.map[m.uid] || {}).days || {})[d] || {}).mood).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
    return html`<${UI.Card} id="moodheat" title="Mood, three weeks" action=${html`<${UI.Spark} values=${avg} width=${120} height=${28}/>`}>
      <div class="heat" style=${{'--n': days.length}}>
        <div class="heat-row"><span/>${days.map(d => html`<span key=${d} class="heat-dow">${U.DAYS_S[U.parseYmd(d).getDay()][0]}</span>`)}</div>
        ${rows.map(r => html`<div class="heat-row" key=${r.uid}>
          <span class="nm"><${UI.Name} id=${r.uid}/></span>
          ${r.cells.map((c, i) => html`<span key=${i} class=${'heat-cell ' + (c ? 'm' + c : 'none')} title=${days[i]}/>`)}
        </div>`)}
      </div>
      <div class="tiny ink62" style=${{marginTop: '10px'}}>Flame is low, ink is high, an empty box is a day off or no check-in.</div>
    <//>`;
  }

  M.tape = {tape, quietRows, pickDays, useLog};
  M.parts.Tape = Tape;
  M.parts.QuietBoard = QuietBoard;
  M.parts.MoodHeat = MoodHeat;
})();
