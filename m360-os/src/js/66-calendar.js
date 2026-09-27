/* module: calendar. A month of everything with a date: task due dates, project deadlines,
   approved leave, WFH days, holidays, birthdays and work anniversaries. Every cell is the same
   height and shows two lines at most; tap a day for the whole list, grouped, with a way to add a task. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useMemo} = React;

  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const SHOW = 2;
  const KINDS = [
    {k: 'task', label: 'Tasks due'}, {k: 'project', label: 'Project deadlines'}, {k: 'leave', label: 'Away'},
    {k: 'wfh', label: 'Working from home'}, {k: 'bday', label: 'Celebrations'}, {k: 'holiday', label: 'Holidays'}
  ];

  /* {ymd: [{kind, text, ref, hot, uid, done, status}]} for one month plus padding days */
  function events(ctx, first, last, mineOnly) {
    const out = {};
    const add = (d, e) => { if (d >= first && d <= last) (out[d] = out[d] || []).push(e); };
    const td = U.todayStr();
    const tmap = ctx.coll.tasks.map;
    for (const id of Object.keys(tmap)) {
      const t = tmap[id];
      if (!t || !t.due || (mineOnly && t.owner !== ctx.uid)) continue;
      add(t.due, {kind: 'task', text: t.title, ref: '#tasks/' + id, hot: t.status !== 'done' && t.due < td, done: t.status === 'done', uid: t.owner, status: t.status, client: t.client || ''});
    }
    const pmap = ctx.coll.projects.map;
    for (const id of Object.keys(pmap)) {
      const p = pmap[id];
      if (p && p.due && !p.archived && (!mineOnly || p.owner === ctx.uid || (p.members || []).includes(ctx.uid))) add(p.due, {kind: 'project', text: p.name + ' due', ref: '#projects/' + id, hot: p.status !== 'done' && p.due < td, uid: p.owner, status: p.status});
    }
    for (const uid of Object.keys(ctx.leaveMap || {})) {
      if (mineOnly && uid !== ctx.uid) continue;
      ctx.leaveMap[uid].forEach(d => add(d, {kind: 'leave', text: '', uid, ref: '#leave'}));
    }
    const cmap = (ctx.coll.checkin && ctx.coll.checkin.map) || {};
    for (const uid of Object.keys(cmap)) {
      if (mineOnly && uid !== ctx.uid) continue;
      const days = (cmap[uid] || {}).days || {};
      for (const d of Object.keys(days)) {
        if (d < first || d > last || !days[d]) continue;
        if (days[d].mode === 'wfh') add(d, {kind: 'wfh', text: '', uid, ref: '#people/' + uid});
        else if (days[d].mode === 'leave' && !(ctx.leaveMap && ctx.leaveMap[uid] && ctx.leaveMap[uid].has(d))) add(d, {kind: 'leave', text: '', uid, ref: '#leave'});
      }
    }
    (ctx.settings.holidays || []).forEach(d => add(d, {kind: 'holiday', text: 'Holiday', ref: '#admin'}));
    if (M.trophies && M.trophies.celebrations) {
      let d = U.parseYmd(first);
      const end = U.parseYmd(last);
      while (d <= end) { const s = U.ymd(d); M.trophies.celebrations(ctx, s).forEach(c => add(s, {kind: 'bday', text: c.text, uid: c.uid, ref: '#people/' + c.uid})); d = U.addDays(d, 1); }
    }
    /* overdue and open work first, then the rest, so the two lines a cell shows are the ones that matter */
    const rank = e => (e.hot ? 0 : e.kind === 'task' || e.kind === 'project' ? (e.done || e.status === 'done' ? 3 : 1) : e.kind === 'bday' ? 2 : 4);
    for (const d of Object.keys(out)) out[d].sort((a, b) => rank(a) - rank(b));
    return out;
  }

  /* the list for one day, grouped by kind, each row a link to the thing */
  function DayList({day, list, label, names, onGo}) {
    const groups = KINDS.map(k => ({...k, rows: list.filter(e => e.kind === k.k)})).filter(g => g.rows.length);
    if (!groups.length) return null;
    return html`<div class="stack" id="cal-daylist">
      ${groups.map(g => html`<div key=${g.k} class="cal-group">
        <${UI.Micro} plain>${g.label} (${g.rows.length})<//>
        <div class="stack tight" style=${{marginTop: '4px'}}>
          ${g.rows.map((e, i) => html`<button type="button" key=${i} class="listrow rowbtn" onClick=${() => onGo(e.ref)}>
            ${e.uid ? html`<${UI.Avatar} id=${e.uid} size=${26}/>` : html`<span class="dotflame"/>`}
            <span class="grow" style=${{minWidth: 0}}>
              <span style=${e.done ? {textDecoration: 'line-through', color: 'var(--ink62)'} : null}>${label(e)}</span>
              ${e.uid && (e.kind === 'task' || e.kind === 'project') ? html`<span class="tiny ink62" style=${{display: 'block'}}>${(names[e.uid] && names[e.uid].name) || 'Unassigned'}${e.client ? ', ' + e.client : ''}</span>` : null}
            </span>
            ${e.hot ? html`<${UI.Pill} kind="flame-o">overdue<//>` : e.status ? html`<${UI.Pill}>${e.status}<//>` : null}
          </button>`)}
        </div>
      </div>`)}
    </div>`;
  }

  function Calendar() {
    const ctx = M.useCtx();
    const [m, setM] = useState(() => { const d = new Date(ctx.now); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [mine, setMine] = useState(!ctx.isFounder);
    const [day, setDay] = useState(null);
    const td = U.todayStr();
    const start = U.mondayOf(m);
    const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const cells = [];
    for (let d = new Date(start); cells.length < 42; d = U.addDays(d, 1)) { cells.push(U.ymd(d)); if (d > monthEnd && d.getDay() === 0) break; }
    const ev = useMemo(() => events(ctx, cells[0], cells[cells.length - 1], mine), [ctx, cells[0], cells[cells.length - 1], mine]);
    const mid = U.monthId(m);
    const title = U.MONTHS[m.getMonth()] + ' ' + m.getFullYear();
    const names = M.useProfiles(Object.values(ev).flat().map(e => e.uid).filter(Boolean));
    const who = e => (names[e.uid] && names[e.uid].name) || 'Someone';
    const label = e => e.kind === 'leave' ? who(e) + ' on leave' : e.kind === 'wfh' ? who(e) + ' at home' : e.text;
    const dayList = day ? (ev[day] || []) : [];
    const monthN = cells.filter(d => d.startsWith(mid)).reduce((n, d) => n + (ev[d] || []).filter(e => e.kind === 'task' && !e.done).length, 0);
    const go = ref => { setDay(null); M.nav(ref); };

    return html`<div class="stack" style=${{gap: '14px'}}>
      <${UI.PageHead} micro="everything with a date" title=${title}>
        <${UI.Seg} options=${[{v: 'mine', label: 'Mine'}, {v: 'all', label: 'Everyone'}]} value=${mine ? 'mine' : 'all'} onChange=${v => setMine(v === 'mine')} ariaLabel="Whose calendar"/>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} ariaLabel="Previous month"><${icons.chevL}/><//>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => { const d = new Date(ctx.now); setM(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today<//>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} ariaLabel="Next month"><${icons.chevR}/><//>
      <//>
      <${UI.Card}>
        <div class="cal" id="calendar">
          ${DOW.map(d => html`<div key=${d} class="cal-dow">${d}</div>`)}
          ${cells.map(d => {
            const list = ev[d] || [];
            const pad = !d.startsWith(mid);
            const off = !ctx.isWorkingDay(d);
            const shown = list.slice(0, SHOW);
            const more = list.length - shown.length;
            return html`<button type="button" key=${d} class=${'cal-day' + (pad ? ' pad' : '') + (off ? ' off' : '') + (d === td ? ' today' : '')} onClick=${() => setDay(d)}
              aria-label=${U.fmtDay(d) + (list.length ? ', ' + list.length + (list.length === 1 ? ' item' : ' items') : '')} data-count=${list.length}>
              <span class="d"><span>${Number(d.slice(8))}</span>${list.length > SHOW ? html`<span class="pill">${list.length}</span>` : null}</span>
              ${shown.map((e, i) => html`<span key=${i} class=${'cal-ev' + (e.hot ? ' hot' : '') + (e.kind === 'leave' || e.kind === 'holiday' || e.kind === 'wfh' ? ' leave' : '') + (e.kind === 'bday' ? ' bday' : '') + (e.done ? ' done' : '')}>${label(e)}</span>`)}
              ${more > 0 ? html`<span class="cal-more">+${more} more</span>` : null}
              <span class="dots">${list.slice(0, 5).map((e, i) => html`<i key=${i} class=${e.hot ? 'hot' : ''}/>`)}</span>
            </button>`;
          })}
        </div>
        <div class="cal-key"><span><i/>task or deadline</span><span><i class="hot"/>overdue</span><span><i class="leave"/>away, at home, holiday</span><span><i class="bday"/>celebration</span><span class="grow"/><span class="num">${monthN} open ${monthN === 1 ? 'task' : 'tasks'} due this month</span></div>
      <//>
      ${day ? html`<${UI.Drawer} open=${true} onClose=${() => setDay(null)} title=${U.fmtDay(day) + (day === td ? ', today' : '')}
        footer=${html`<${UI.Btn} kind="sec" onClick=${() => setDay(null)}>Close<//><${UI.Btn} onClick=${() => { setDay(null); M.intend('#tasks', 'newtask:' + day); }}>New task due this day<//>`}>
        <div class="small ink62">${dayList.length ? dayList.length + (dayList.length === 1 ? ' thing' : ' things') + ' on this day' + (mine ? ', yours' : ', everyone') : (mine ? 'Nothing of yours on this day.' : 'Nothing on this day.')}</div>
        <${DayList} day=${day} list=${dayList} label=${label} names=${names} onGo=${go}/>
      <//>` : null}
    </div>`;
  }

  M.pages.Calendar = Calendar;
})();
