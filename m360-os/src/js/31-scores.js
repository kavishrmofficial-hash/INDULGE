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
    /* v7 (design B1 .brk): one hairline row per source of points, then output, discipline and the total */
    const sign = v => v > 0 ? '+' + v : String(v || 0);
    return html`<${UI.Card} title=${title}>
      ${rows.length ? html`<div class="brk">
        ${rows.map(k => html`<div class="brk-r" key=${k}>
          <span>${LABELS[k] || k} <span class="soft num">${counts[k] || 0}</span></span><b>${sign(parts[k])}</b>
        </div>`)}
        <div class="brk-r"><span class="mut">output</span><b>${p.output}</b></div>
        <div class="brk-r"><span class="mut">discipline</span><b>${p.discipline}</b></div>
        <div class="brk-r tot"><span>total</span><b>${p.total}</b></div>
      </div>` : html`<${WhyZero} p=${p} range=${range}/>`}
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

    return html`<div class="stack sc7" style=${{gap: '16px'}} id="scores-page">
      <${UI.PageHead} micro="points from the work itself" title="Leaderboard">
        <${UI.Seg} options=${PERIODS} value=${period} onChange=${setPeriod} ariaLabel="Period"/>
      <//>

      <p class="sub sc7-lede">${PRINCIPLE}</p>

      ${three.length ? html`<div class="podium" id="podium">
        ${podium.map(r => {
          const p0 = r === three[0];
          const place = p0 ? 1 : r === three[1] ? 2 : 3;
          return html`<div class=${'pod-s' + (p0 ? ' p0' : '')} key=${r.uid}>
            <${UI.Avatar} id=${r.uid} size=${p0 ? 48 : 36}/>
            <b><${UI.Name} id=${r.uid}/></b>
            <span class="pts">${r.total}</span>
            <span class="mut sm">${place === 1 ? 'first' : place === 2 ? 'second' : 'third'}</span>
          </div>`;
        })}
      </div>` : null}

      <${UI.Card} title="Leaderboard" action=${lastWeek ? html`<span class="pill ink">last week</span>` : byPace ? html`<span class="pill ink" id="board-pace">by pace</span>` : null}>
        ${lastWeek ? html`<div class="sm mut" style=${{marginBottom: '10px'}}>Nothing has scored in the new week yet. The board shows last week until someone does.</div>` : null}
        ${byPace ? html`<div class="sm mut" id="board-fair" style=${{marginBottom: '10px'}}>${period === 'all'
          ? 'Everyone is measured from the day they joined: points per working day, with the career total beside it. Time here is not an advantage.'
          : 'Someone joined part way through, so this board ranks by points per working day. The totals stay; the newcomer is not behind for days they were not here.'}</div>` : null}
        ${board.length ? html`<div class="lbs">
          ${board.map((r, i) => {
            const o = Math.max(0, r.output), d = Math.max(0, r.discipline);
            return html`<div class="lb" key=${r.uid}>
              <span class="rank">${i + 1}</span>
              <${UI.Avatar} id=${r.uid} size=${32}/>
              <div class="grow">
                <b><${UI.Name} id=${r.uid}/></b>
                <div class="split" aria-hidden="true"><i class="o" style=${{width: (100 * o / top) + '%'}}/><i class="d" style=${{width: (100 * Math.min(d, Math.max(0, top - o)) / top) + '%'}}/></div>
              </div>
              ${byPace ? html`<span class="sm mut num" title=${r.days + (r.days === 1 ? ' working day' : ' working days') + (r.partial ? ', joined ' + U.fmtDate(r.joined) : '')}>${r.pace}/day</span>` : null}
              <b class="num lb-pts">${r.total}</b>
            </div>`;
          })}
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
