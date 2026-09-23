/* module: tape. HQ's live tape (everything that happened today, newest first) and the mood
   heatmap (the last three weeks of check-in moods, one row per person). Founder only. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState} = React;

  function tape(ctx) {
    const td = U.todayStr(), start = U.parseYmd(td).getTime();
    const out = [];
    const nm = id => html`<${UI.Name} id=${id}/>`;
    const push = (at, text, hot, uid) => { if (at >= start) out.push({at, text, hot: !!hot, uid}); };
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
    out.sort((a, b) => b.at - a.at);
    return out.slice(0, 40);
  }

  function Tape() {
    const ctx = M.useCtx();
    const [all, setAll] = useState(false);
    const list = tape(ctx);
    const shown = all ? list : list.slice(0, 8);
    return html`<${UI.Card} id="tape" title="The tape" action=${html`<span class="small ink62 num">${list.length} today</span>`}>
      ${list.length ? html`<div class="tape">
        ${shown.map((e, i) => html`<div class="tape-row" key=${i}>
          <span class="tm num">${U.hhmm(e.at)}</span>
          <span class="nd"><i class=${e.hot ? 'hot' : ''}/></span>
          <span class="tx">${e.text}</span>
        </div>`)}
      </div>` : html`<${UI.Empty} text="Quiet so far today."/>`}
      ${list.length > 8 ? html`<button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => setAll(!all)}>${all ? 'Show less' : 'Show all ' + list.length}</button>` : null}
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

  M.tape = {tape};
  M.parts.Tape = Tape;
  M.parts.MoodHeat = MoodHeat;
})();
