/* module: calendar. A month of everything with a date: task due dates, project deadlines,
   approved leave, holidays, birthdays and work anniversaries. Tap a day for the list. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useMemo} = React;

  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* {ymd: [{kind, text, ref, hot, uid}]} for one month plus padding days */
  function events(ctx, first, last, mineOnly) {
    const out = {};
    const add = (d, e) => { if (d >= first && d <= last) (out[d] = out[d] || []).push(e); };
    const td = U.todayStr();
    const tmap = ctx.coll.tasks.map;
    for (const id of Object.keys(tmap)) {
      const t = tmap[id];
      if (!t || !t.due || (mineOnly && t.owner !== ctx.uid)) continue;
      add(t.due, {kind: 'task', text: t.title, ref: '#tasks/' + id, hot: t.status !== 'done' && t.due < td, done: t.status === 'done', uid: t.owner});
    }
    const pmap = ctx.coll.projects.map;
    for (const id of Object.keys(pmap)) {
      const p = pmap[id];
      if (p && p.due && !p.archived && (!mineOnly || p.owner === ctx.uid || (p.members || []).includes(ctx.uid))) add(p.due, {kind: 'project', text: p.name + ' due', ref: '#projects/' + id, hot: p.status !== 'done' && p.due < td});
    }
    for (const uid of Object.keys(ctx.leaveMap || {})) {
      if (mineOnly && uid !== ctx.uid) continue;
      ctx.leaveMap[uid].forEach(d => add(d, {kind: 'leave', text: '', uid, ref: '#leave'}));
    }
    (ctx.settings.holidays || []).forEach(d => add(d, {kind: 'holiday', text: 'Holiday', ref: '#admin'}));
    if (M.trophies && M.trophies.celebrations) {
      let d = U.parseYmd(first);
      const end = U.parseYmd(last);
      while (d <= end) { const s = U.ymd(d); M.trophies.celebrations(ctx, s).forEach(c => add(s, {kind: 'bday', text: c.text, uid: c.uid, ref: '#people/' + c.uid})); d = U.addDays(d, 1); }
    }
    return out;
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
    const label = e => e.kind === 'leave' ? ((names[e.uid] && names[e.uid].name) || 'Someone') + ' on leave' : e.text;
    const dayList = day ? (ev[day] || []) : [];

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
            const shown = list.slice(0, 3);
            return html`<button type="button" key=${d} class=${'cal-day' + (pad ? ' pad' : '') + (off ? ' off' : '') + (d === td ? ' today' : '')} onClick=${() => setDay(d)}>
              <span class="d"><span>${Number(d.slice(8))}</span>${list.length > 3 ? html`<span class="pill">${list.length}</span>` : null}</span>
              ${shown.map((e, i) => html`<span key=${i} class=${'cal-ev ' + (e.hot ? 'hot' : '') + (e.kind === 'leave' || e.kind === 'holiday' ? ' leave' : '') + (e.kind === 'bday' ? ' bday' : '')}
                style=${e.done ? {textDecoration: 'line-through', opacity: .6} : null}>${label(e)}</span>`)}
              ${list.length > 3 ? html`<span class="cal-more">+${list.length - 3} more</span>` : null}
              <span class="dots">${list.slice(0, 5).map((e, i) => html`<i key=${i} class=${e.hot ? 'hot' : ''}/>`)}</span>
            </button>`;
          })}
        </div>
      <//>
      ${day ? html`<${UI.Drawer} open=${true} onClose=${() => setDay(null)} title=${U.fmtDay(day) + (day === td ? ', today' : '')}>
        ${dayList.length ? html`<div class="stack tight">${dayList.map((e, i) => html`<button type="button" key=${i} class="listrow rowbtn" onClick=${() => { setDay(null); M.nav(e.ref); }}>
          ${e.uid ? html`<${UI.Avatar} id=${e.uid} size=${26}/>` : html`<span class="dotflame"/>`}
          <span class="grow" style=${e.done ? {textDecoration: 'line-through', color: 'var(--ink62)'} : null}>${label(e)}</span>
          <span class="pill">${e.kind}</span>
        </button>`)}</div>` : html`<${UI.Empty} text="Nothing on this day."/>`}
        <div class="row" style=${{marginTop: '8px'}}><${UI.Btn} sm=${true} onClick=${() => { setDay(null); M.intend('#tasks', 'newtask:' + day); }}>New task due this day<//></div>
      <//>` : null}
    </div>`;
  }

  M.pages.Calendar = Calendar;
})();
