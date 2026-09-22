/* module: scores (BRIEF 7.11 and section 9). Points, podium, leaderboard, breakdowns. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const PRINCIPLE = 'Output earns about three times what discipline earns. Showing up is the floor. Shipping is what scores.';
  const PERIODS = [{v: 'week', label: 'Week'}, {v: 'month', label: 'Month'}, {v: 'quarter', label: 'Quarter'}];
  const LABELS = {
    checkinOnTime: 'on-time check-ins', eod: 'eod lines', planOnTime: 'monday outcomes on time',
    planLate: 'monday outcomes late', outcomeHit: 'outcomes hit', outcomeMiss: 'outcomes missed',
    taskOnTime: 'tasks on time', taskLate: 'tasks late', revision: 'revisions', shown20: '20% shown',
    qualityMult: 'quality', kudos: 'kudos', rockDone: 'rocks done', overdueOpen: 'overdue open'
  };
  const ORDER = ['outcomeHit', 'outcomeMiss', 'taskOnTime', 'taskLate', 'revision', 'shown20', 'qualityMult',
    'kudos', 'rockDone', 'overdueOpen', 'checkinOnTime', 'eod', 'planOnTime', 'planLate'];

  function Breakdown({uid, range, title}) {
    const ctx = M.useCtx();
    const p = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, uid, range.from, range.to) : null;
    if (!p) return null;
    const parts = p.parts || {}, counts = p.counts || {};
    const rows = ORDER.filter(k => (counts[k] || 0) !== 0 || (parts[k] || 0) !== 0);
    return html`<${UI.Card} title=${title}>
      ${rows.length ? html`<div class="tbl-wrap"><table class="tbl">
        <tbody>
          ${rows.map(k => html`<tr key=${k}>
            <td>${LABELS[k] || k}</td>
            <td class="num ink62" style=${{textAlign: 'right'}}>${counts[k] || 0}</td>
            <td class="num" style=${{textAlign: 'right', fontWeight: 500}}>${parts[k] > 0 ? '+' + parts[k] : (parts[k] || 0)}</td>
          </tr>`)}
          <tr><td>output</td><td/><td class="num" style=${{textAlign: 'right', fontWeight: 500}}>${p.output}</td></tr>
          <tr><td>discipline</td><td/><td class="num" style=${{textAlign: 'right', fontWeight: 500}}>${p.discipline}</td></tr>
          <tr class="dark"><td>total</td><td/><td class="num" style=${{textAlign: 'right', fontWeight: 500}}>${p.total}</td></tr>
        </tbody>
      </table></div>` : html`<${UI.Empty} text="No points yet."/>`}
      ${(p.badges || []).length ? html`<div class="row" style=${{marginTop: '12px'}}>
        ${p.badges.map(b => html`<${UI.Pill} key=${b}>${b}<//>`)}</div>` : null}
    <//>`;
  }

  function Scores() {
    const ctx = M.useCtx();
    const [period, setPeriod] = useState('week');
    const range = useMemo(() => U.periodRange(period, new Date(ctx.now)), [period, ctx.now]);
    const board = useMemo(() => (M.points && M.points.leaderboard)
      ? M.points.leaderboard(ctx, period, new Date(ctx.now)) : [], [ctx, period]);
    const top = board.length ? Math.max(1, board[0].total) : 1;
    const three = board.slice(0, 3);
    /* podium order: second, first, third */
    const podium = three.length === 3 ? [three[1], three[0], three[2]] : three;

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="points from the work itself" title="Scores">
        <${UI.Seg} options=${PERIODS} value=${period} onChange=${setPeriod} ariaLabel="Period"/>
      <//>

      <${UI.Card}><p style=${{margin: 0}}>${PRINCIPLE}</p><//>

      ${three.length ? html`<${UI.Card} title="Top 3">
        <div class="podium">
          ${podium.map((r, i) => {
            const isFirst = r === three[0];
            const h = isFirst ? 92 : (r === three[1] ? 70 : 54);
            return html`<div class=${'po' + (isFirst ? ' first' : '')} key=${r.uid}>
              <${UI.Avatar} id=${r.uid} size=${isFirst ? 44 : 36}/>
              <div class="small" style=${{fontWeight: 500, textAlign: 'center'}}><${UI.Name} id=${r.uid}/></div>
              <div class="plinth num" style=${{height: h + 'px'}}>${r.total}</div>
            </div>`;
          })}
        </div>
      <//>` : null}

      <${UI.Card} title="Leaderboard">
        ${board.length ? html`<div class="stack tight">
          ${board.map((r, i) => html`<div class="listrow" key=${r.uid}>
            <span class="num ink62" style=${{width: '20px'}}>${i + 1}</span>
            <${UI.Avatar} id=${r.uid} size=${28}/>
            <span style=${{minWidth: '120px'}}><${UI.Name} id=${r.uid}/></span>
            <${UI.Bar} a=${Math.max(0, r.output)} b=${Math.max(0, r.discipline)} max=${top}/>
            <span class="num" style=${{fontWeight: 500, width: '46px', textAlign: 'right'}}>${r.total}</span>
          </div>`)}
        </div>` : html`<${UI.Empty} text="No points yet."/>`}
      <//>

      ${ctx.isFounder
        ? (board.length ? board.map(r => html`<${Breakdown} key=${r.uid} uid=${r.uid} range=${range}
            title=${((M.useProfiles([r.uid])[r.uid] || {}).name) || 'Points'}/>`) : null)
        : html`<${Breakdown} uid=${ctx.uid} range=${range} title="Your points"/>`}
    </div>`;
  }

  M.pages.Scores = Scores;
})();
