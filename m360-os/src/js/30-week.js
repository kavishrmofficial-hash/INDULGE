/* module: week (BRIEF 7.10). The attendance grid, EOD cells, outcomes and the Friday review. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useMemo} = React;

  const STATUS_PILL = {office: {k: 'ink', t: 'office'}, wfh: {k: null, t: 'wfh'},
    leave: {k: 'warm', t: 'leave'}, holiday: {k: 'warm', t: 'holiday'}};
  const MARK_PILL = {hit: 'ink', miss: 'flame'};
  const QUALITY = [1, 2, 3, 4, 5].map(n => ({v: String(n), label: String(n)}));
  const MARKS = [{v: 'hit', label: 'Hit'}, {v: 'miss', label: 'Miss'}];

  const noCoo = () => null;

  function eodOf(ctx, uid, date) {
    return ((ctx.coll.eod.map[uid] || {}).days || {})[date] || null;
  }

  function Cell({uid, date, today, onOpen}) {
    const ctx = M.useCtx();
    const d = (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, uid, date) : {status: 'none'};
    const e = eodOf(ctx, uid, date);
    const past = date < today;
    const working = ctx.isWorkingDay(date, uid);
    const p = STATUS_PILL[d.status];
    const future = date > today;
    return html`<button type="button" class="rowbtn" onClick=${() => onOpen({uid, date})}
      style=${{padding: '4px 2px', minWidth: '96px'}}>
      <div class="stack tight" style=${{gap: '4px', alignItems: 'flex-start'}}>
        ${future ? html`<span class="tiny ink62">to come</span>`
          : html`<div class="row" style=${{gap: '5px'}}>
            ${p ? html`<${UI.Pill} kind=${p.k}>${p.t}<//>` : html`<span class="tiny ink62">${working ? 'not in' : ''}</span>`}
          </div>`}
        ${d.in ? html`<div class="row" style=${{gap: '5px'}}>
          <span class="tiny num">${U.hhmm(d.in)}</span>
          ${d.late && ctx.canSee(uid) ? html`<${UI.Pill} kind="flame">late<//>` : null}
        </div>` : null}
        ${!future && (e || (past && working))
          ? (e
            ? (String(e.blocked || '').trim()
              ? html`<${UI.Pill} kind="flame">blocked<//>`
              : html`<${UI.Pill} kind="ink">eod<//>`)
            : html`<span class="pill" style=${{borderStyle: 'dashed'}}>no eod</span>`)
          : null}
      </div>
    </button>`;
  }

  function CellDrawer({cell, onClose}) {
    const ctx = M.useCtx();
    const {uid, date} = cell;
    const e = eodOf(ctx, uid, date);
    const d = (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, uid, date) : {status: 'none'};
    const ps = M.useProfiles([uid]);
    const nm = (ps[uid] && ps[uid].name) || 'Someone';
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${nm + ', ' + U.fmtDay(date)}>
      ${e ? html`<div class="stack tight">
        <${UI.Micro}>shipped<//><p style=${{margin: 0, whiteSpace: 'pre-wrap'}}>${e.shipped}</p>
        ${e.next ? html`<${UI.Micro}>next<//><p style=${{margin: 0, whiteSpace: 'pre-wrap'}}>${e.next}</p>` : null}
        ${e.blocked ? html`<${UI.Micro}>blocked<//><p class="flame-t" style=${{margin: 0, whiteSpace: 'pre-wrap'}}>${e.blocked}</p>` : null}
      </div>` : html`<${UI.Empty} text="No EOD line that day."/>`}
      ${ctx.canSee(uid) && d.in ? html`<div>
        <hr class="hair"/>
        <${UI.Micro}>check-in<//>
        <div class="stack tight" style=${{marginTop: '8px'}}>
          <div class="row"><span class="small ink62">in</span><span class="num">${U.hhmm(d.in)}</span>
            ${d.late ? html`<${UI.Pill} kind="flame">late<//>` : null}</div>
          ${d.out ? html`<div class="row"><span class="small ink62">out</span><span class="num">${U.hhmm(d.out)}</span></div>` : null}
          ${d.place ? html`<div class="row"><span class="small ink62">place</span><span>${d.place}</span>
            ${d.verified ? html`<${UI.Pill} kind="ink">verified<//>` : html`<${UI.Pill} kind="flame-o">unverified<//>`}</div>` : null}
        </div>
      </div>` : null}
    <//>`;
  }

  /* the COO's Friday suggestion for one person: a ghost beside each mark not set yet, and one tap that
     writes them as Kaavish's own (M.cooUi.confirmReview). A mark he set always stays his. */
  function Ghost({ghost, uid, items, marks}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const open = items.filter(it => !marks[it.id] && ghost.marks[it.id]).length;
    const confirm = async () => {
      setBusy(true);
      try { await M.cooUi.confirmReview(ctx, ghost.card); M.toast('Marks saved as yours'); } catch (e) { M.toast((e && e.message) || 'Those marks did not save.', true); }
      setBusy(false);
    };
    return html`<div class="coo-ghost-head" data-uid=${uid}>
      <div class="row nowrap" style=${{gap: '8px'}}>${M.parts.CooFace ? html`<${M.parts.CooFace} size=${22}/>` : null}
        <span class="small grow">${M.cooUi.titleOf(ctx)} suggests ${open ? 'marks from the work shipped this week' : 'marks, and yours are all in'}.</span></div>
      ${ghost.evidence.length ? html`<ul class="tiny ink62 coo-ghost-ev">${ghost.evidence.slice(0, 4).map((e, i) => html`<li key=${i}>${typeof e === 'string' ? e : e.text || e.label || ''}</li>`)}</ul>` : null}
      <div class="row"><button type="button" class="btn sec sm coo-ghost-confirm" data-act="confirm" disabled=${busy} onClick=${confirm}>Confirm <${UI.Name} id=${uid}/>'s marks</button></div>
    </div>`;
  }

  function ReviewCard({uid, weekId, ghost}) {
    const ctx = M.useCtx();
    const plan = ((ctx.coll.plan.map[uid] || {}).weeks || {})[weekId];
    const rev = ((ctx.coll.review.map[uid] || {}).weeks || {})[weekId];
    const items = (plan && plan.items) || [];
    const mine = uid === ctx.uid;
    const isOwnFounderCard = ctx.isFounder && uid === ctx.uid;
    const [marks, setMarks] = useState(() => ({...((rev && rev.marks) || {})}));
    const [quality, setQuality] = useState(() => (rev && rev.quality != null ? String(rev.quality) : ''));
    const [note, setNote] = useState(() => (rev && rev.note) || '');
    React.useEffect(() => {
      setMarks({...((rev && rev.marks) || {})});
      setQuality(rev && rev.quality != null ? String(rev.quality) : '');
      setNote((rev && rev.note) || '');
    }, [weekId, uid, rev && rev.at]);

    async function save() {
      const weeks = U.clone(((ctx.coll.review.map[uid] || {}).weeks) || {});
      weeks[weekId] = {marks, quality: isOwnFounderCard ? null : (quality === '' ? null : Number(quality)), note, at: Date.now()};
      await ctx.W.merge('review/' + uid, {weeks: U.prunePatch(weeks, 26, true)});
      M.toast('Review saved');
    }

    const g = ctx.isFounder && ghost && items.length ? ghost : null;
    const card = html`<${UI.Card} title=${html`<${UI.Name} id=${uid}/>`}>
      ${g ? html`<${Ghost} ghost=${g} uid=${uid} items=${items} marks=${marks}/>` : null}
      ${items.length ? html`<div class="stack tight">
        ${items.map(it => html`<div class="listrow" key=${it.id}>
          <span class="grow">${it.text}</span>
          ${g && !marks[it.id] && g.marks[it.id] ? html`<span class="pill coo-ghost" data-ghost=${g.marks[it.id]} title="Suggested by the COO">${g.marks[it.id]}, suggested</span>` : null}
          ${ctx.isFounder
            ? html`<${UI.Seg} sm=${true} options=${MARKS} value=${marks[it.id] || ''}
                onChange=${v => setMarks(m => ({...m, [it.id]: v}))} ariaLabel="Mark"/>`
            : ((rev && rev.marks && rev.marks[it.id])
              ? html`<${UI.Pill} kind=${MARK_PILL[rev.marks[it.id]]}>${rev.marks[it.id]}<//>`
              : html`<${UI.Pill}>open<//>`)}
        </div>`)}
      </div>` : html`<${UI.Empty} text="No outcomes posted."/>`}

      ${ctx.isFounder ? html`<div class="stack tight" style=${{marginTop: '14px'}}>
        ${isOwnFounderCard ? null : html`<${UI.Field} label="quality, 1 to 5">
          <${UI.Seg} sm=${true} options=${QUALITY} value=${quality} onChange=${setQuality} ariaLabel="Quality"/><//>`}
        <${UI.Input} label="note" value=${note} onChange=${setNote}/>
        <div class="row"><${UI.Btn} sm=${true} onClick=${save}>Save review<//></div>
      </div>` : (mine && rev ? html`<div class="stack tight" style=${{marginTop: '14px'}}>
        ${rev.quality != null ? html`<div class="row"><span class="small ink62">quality</span>
          <span class="num" style=${{fontWeight: 500}}>Quality ${rev.quality} of 5</span></div>` : null}
        ${rev.note ? html`<div class="small">${rev.note}</div>` : null}
      </div>` : null)}
    <//>`;
    /* your own outcomes card carries the beam: the one card on this page that is yours to act on */
    return mine ? html`<${M.fx.Beam}>${card}<//>` : card;
  }

  function Week() {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const [offset, setOffset] = useState(0);
    const [cell, setCell] = useState(null);
    const monday = useMemo(() => U.addDays(U.mondayOf(new Date(ctx.now)), offset * 7), [offset, ctx.now]);
    const weekId = U.isoWeek(monday);
    const days = U.weekDays(monday);
    const range = U.fmtDate(days[0]) + ' to ' + U.fmtDate(days[5]);
    /* the founder's open review cards from the COO, read once for the page */
    const coo = (M.cooUi ? M.cooUi.useLive : noCoo)(ctx);
    const cards = M.cooUi && ctx.isFounder ? M.cooUi.openCards(coo).filter(c => c.kind === 'review') : [];

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro=${weekId.toLowerCase() + ', ' + range.toLowerCase()} title="The week">
        <div class="row nowrap">
          <${UI.Btn} kind="sec" sm=${true} ariaLabel="Previous week" onClick=${() => setOffset(o => o - 1)}><${icons.chevL}/><//>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => setOffset(0)}>This week<//>
          <${UI.Btn} kind="sec" sm=${true} ariaLabel="Next week" disabled=${offset >= 0} onClick=${() => setOffset(o => Math.min(0, o + 1))}><${icons.chevR}/><//>
        </div>
      <//>

      <${UI.Card}>
        <div class="tbl-wrap"><table class="tbl wk-table">
          <thead><tr><th>person</th>${days.map(d => html`<th key=${d}>${U.fmtDay(d).toLowerCase()}</th>`)}</tr></thead>
          <tbody>
            ${ctx.activeMembers.map(m => html`<tr key=${m.uid}>
              <td class="lead"><span class="row nowrap"><${UI.Avatar} id=${m.uid} size=${26}/><${UI.Name} id=${m.uid}/></span></td>
              ${days.map(d => html`<td key=${d} class="wk-cell" data-label=${U.fmtDay(d).toLowerCase().slice(0, 3)}>
                <${Cell} uid=${m.uid} date=${d} today=${today} onOpen=${setCell}/></td>`)}
            </tr>`)}
          </tbody>
        </table></div>
        ${ctx.activeMembers.length ? null : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
      <//>

      <${UI.Micro}>outcomes and review<//>
      ${ctx.activeMembers.map(m => html`<${ReviewCard} key=${m.uid + weekId} uid=${m.uid} weekId=${weekId} ghost=${cards.length ? M.cooUi.ghostOf(cards, m.uid, weekId) : null}/>`)}
      ${cell ? html`<${CellDrawer} cell=${cell} onClose=${() => setCell(null)}/>` : null}
    </div>`;
  }

  M.pages.Week = Week;
})();
