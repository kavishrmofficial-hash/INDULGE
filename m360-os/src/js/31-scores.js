/* module: scores (BRIEF 7.11 and section 9). Points, podium, leaderboard, breakdowns. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const PRINCIPLE = 'Output earns about three times what discipline earns. Showing up is the floor. Shipping is what scores.';
  const PERIODS = [{v: 'week', label: 'Week'}, {v: 'month', label: 'Month'}, {v: 'quarter', label: 'Quarter'}, {v: 'all', label: 'Since joining'}];
  const LABELS = {
    checkinOnTime: 'on-time check-ins', eod: 'eod lines', planOnTime: 'monday outcomes on time',
    planLate: 'monday outcomes late', outcomeHit: 'outcomes hit', outcomeMiss: 'outcomes missed',
    taskOnTime: 'tasks on time', taskLate: 'tasks late', revision: 'revisions', shown20: '20% shown',
    qualityMult: 'quality', kudos: 'kudos', rockDone: 'rocks done', overdueOpen: 'overdue open'
  };
  const ORDER = ['outcomeHit', 'outcomeMiss', 'taskOnTime', 'taskLate', 'revision', 'shown20', 'qualityMult',
    'kudos', 'rockDone', 'overdueOpen', 'checkinOnTime', 'eod', 'planOnTime', 'planLate'];

  /* a zero that explains itself: what the range covered and what was found in it */
  function WhyZero({p, range}) {
    const i = p.info || {};
    const cut = i.start ? i.start + (i.grace ? ' plus ' + i.grace + ' min grace' : '') : 'the start time';
    const seen = i.days ? (i.checkins + ' check-in' + (i.checkins === 1 ? '' : 's') + ' and ' + i.eods + ' EOD line' + (i.eods === 1 ? '' : 's') + ' across ' + i.days + ' working day' + (i.days === 1 ? '' : 's') + ' from ' + U.fmtDate(range.from) + ' to ' + U.fmtDate(range.to)) : 'no working day in this range yet';
    return html`<div class="stack tight" id="why-zero">
      <div class="small">No points in this range: ${seen}.</div>
      <div class="small ink62">Points come from a check-in on Home before ${cut}, an EOD line before 10:00 the next morning, Monday outcomes set and hit, tasks done by their due date, kudos and rocks. A check-in after the cut or an EOD filed late counts for attendance and not for points.</div>
    </div>`;
  }

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
      </table></div>` : html`<${WhyZero} p=${p} range=${range}/>`}
      ${(p.badges || []).length ? html`<div class="row" style=${{marginTop: '12px'}}>
        ${p.badges.map(b => html`<${UI.Pill} key=${b}>${b}<//>`)}</div>` : null}
    <//>`;
  }

  function Scores() {
    const ctx = M.useCtx();
    const [period, setPeriod] = useState('week');
    /* the same range the board scores: on Monday that is the week that just closed */
    const range = useMemo(() => (M.points && M.points.boardRange)
      ? M.points.boardRange(ctx, period, new Date(ctx.now)) : {...U.periodRange(period, new Date(ctx.now)), label: ''}, [ctx, period]);
    const lastWeek = range.label === 'last week';
    const board = useMemo(() => (M.points && M.points.leaderboard)
      ? M.points.leaderboard(ctx, period, new Date(ctx.now)) : [], [ctx, period]);
    /* one profiles call for the whole page: hooks never run inside a loop */
    const profs = M.useProfiles(board.map(r => r.uid));
    const byPace = !!(board.length && board[0].ranked === 'pace');
    const top = board.length ? Math.max(1, ...board.map(r => r.total)) : 1;
    const three = board.slice(0, 3);
    /* podium order: second, first, third */
    const podium = three.length === 3 ? [three[1], three[0], three[2]] : three;

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="points from the work itself" title="Leaderboard">
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
              <div class="small po-name" style=${{fontWeight: 500, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}><${UI.Name} id=${r.uid}/></div>
              ${isFirst ? html`<${M.fx.MetalBadge} className="po-top">top<//>` : null}
              <div class="plinth num" style=${{height: h + 'px'}}><${M.fx.MetalText} key=${String(r.total)} size=${isFirst ? 22 : 18} weight=${600} color=${isFirst ? 'var(--on-ink)' : undefined}>${String(r.total)}<//></div>
            </div>`;
          })}
        </div>
      <//>` : null}

      <${UI.Card} title="Leaderboard" action=${lastWeek ? html`<span class="pill ink">last week</span>` : byPace ? html`<span class="pill ink" id="board-pace">by pace</span>` : null}>
        ${lastWeek ? html`<div class="small ink62" style=${{marginBottom: '10px'}}>Nothing has scored in the new week yet. The board shows last week until someone does.</div>` : null}
        ${byPace ? html`<div class="small ink62" id="board-fair" style=${{marginBottom: '10px'}}>${period === 'all'
          ? 'Everyone is measured from the day they joined: points per working day, with the career total beside it. Time here is not an advantage.'
          : 'Someone joined part way through, so this board ranks by points per working day. The totals stay; the newcomer is not behind for days they were not here.'}</div>` : null}
        ${board.length ? html`<div class="stack tight">
          ${board.map((r, i) => html`<div class="listrow nowrap lb-row" key=${r.uid}>
            <span class="num ink62" style=${{width: '20px', flex: 'none'}}>${i + 1}</span>
            <${UI.Avatar} id=${r.uid} size=${28}/>
            <span class="lb-name" style=${{flex: '1 1 120px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}><${UI.Name} id=${r.uid}/></span>
            <${UI.Bar} a=${Math.max(0, r.output)} b=${Math.max(0, r.discipline)} max=${top}/>
            ${byPace ? html`<span class="tiny ink62 num" style=${{width: '74px', textAlign: 'right', flex: 'none'}} title=${r.days + (r.days === 1 ? ' working day' : ' working days') + (r.partial ? ', joined ' + U.fmtDate(r.joined) : '')}>${r.pace}/day</span>` : null}
            <span class="num" style=${{fontWeight: 500, width: '46px', textAlign: 'right', flex: 'none'}}>${i === 0 ? html`<${M.fx.MetalText} key=${String(r.total)} size=${16} weight=${600}>${String(r.total)}<//>` : r.total}</span>
          </div>`)}
        </div>` : html`<${UI.Empty} text="No points yet."/>`}
      <//>

      ${ctx.isFounder
        ? (board.length ? board.map(r => html`<${Breakdown} key=${r.uid} uid=${r.uid} range=${range}
            title=${((profs[r.uid] || {}).name) || 'Points'}/>`) : null)
        : html`<${Breakdown} uid=${ctx.uid} range=${range} title="Your points"/>`}
    </div>`;
  }

  M.pages.Scores = Scores;
})();
