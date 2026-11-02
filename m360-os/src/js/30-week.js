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
    const late = d.late && ctx.canSee(uid);
    /* v40: the design's week cell (B1 .wg-c): the status as a word, the time in (flame when late), the EOD key */
    return html`<button type="button" class=${'wg-c' + (future ? ' fut' : '')} onClick=${() => onOpen({uid, date})}
      aria-label=${U.fmtDay(date)}>
      ${future ? null : p ? html`<span class=${'st st-' + d.status}>${p.t}</span>` : working ? html`<span class="st st-none">not in</span>` : null}
      ${d.in ? html`<span class=${'tn' + (late ? ' flt' : '')}>${U.hhmm(d.in)}${late ? ' late' : ''}</span>` : null}
      ${!future && (e || (past && working))
        ? (e
          ? (String(e.blocked || '').trim()
            ? html`<span class="eodk bl">blocked</span>`
            : html`<span class="eodk">eod</span>`)
          : html`<span class="eodk miss">no eod</span>`)
        : null}
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
     writes them as Kaavish's own (M.cooUi.confirmReview). A mark he set, saved or not yet, always stays his. */
  function Ghost({ghost, uid, items, marks}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const open = items.filter(it => !marks[it.id] && ghost.marks[it.id]).length;
    const ev = ghost.evidence.map(e => M.cooUi.evidenceLine(ctx, e)).filter(Boolean);
    const confirm = async () => {
      setBusy(true);
      try { await M.cooUi.confirmReview(ctx, ghost.card, marks); M.toast('Marks saved as yours'); } catch (e) { M.toast((e && e.message) || 'Those marks did not save.', true); }
      setBusy(false);
    };
    return html`<div class="coo-ghost-head" data-uid=${uid}>
      <div class="row nowrap" style=${{gap: '8px'}}>${M.parts.CooFace ? html`<${M.parts.CooFace} size=${22}/>` : null}
        <span class="small grow">${M.cooUi.titleOf(ctx)} suggests ${open ? 'marks from the work shipped this week' : 'marks, and yours are all in'}.</span></div>
      ${ev.length ? html`<ul class="tiny ink62 coo-ghost-ev">${ev.slice(0, 4).map((e, i) => html`<li key=${i}>${e}</li>`)}</ul>` : null}
      <div class="row"><button type="button" class="btn sec sm coo-ghost-confirm" data-act="confirm" disabled=${busy} onClick=${confirm}>Confirm <${UI.Name} id=${uid}/>'s marks</button></div>
    </div>`;
  }

  function ReviewCard({uid, weekId, ghost}) {
    const ctx = M.useCtx();
    const plan = ((ctx.coll.plan.map[uid] || {}).weeks || {})[weekId];
    const items = (plan && plan.items) || [];
    const mine = uid === ctx.uid;
    /* v39 (BRIEF 7.10): a teammate's card shows their outcomes only. Marks, quality and the note are for the
       person and the founder, and this page reads a review only for a card it may show it on */
    const rev = ctx.isFounder || mine ? ((ctx.coll.review.map[uid] || {}).weeks || {})[weekId] : null;
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
    const hits = items.filter(it => (marks[it.id] || '') === 'hit').length;
    /* v40: the design's review card (B1 .card-h, .tl, .mk, .rv-q and .qn); your own card carries the flame line */
    return html`<section class=${'card rv-card' + (mine ? ' flame' : '')}>
      <div class="card-h">
        <span class="row nowrap" style=${{gap: '10px'}}><${UI.Avatar} id=${uid} size=${28}/><h3 class="card-title"><${UI.Name} id=${uid}/></h3></span>
        ${items.length ? html`<span class="pill">${ctx.isFounder || mine ? hits + ' of ' + items.length + ' hit' : items.length + (items.length === 1 ? ' outcome' : ' outcomes')}</span>` : null}
      </div>
      ${g ? html`<${Ghost} ghost=${g} uid=${uid} items=${items} marks=${marks}/>` : null}
      ${items.length ? html`<ul class="tl">
        ${items.map(it => html`<li key=${it.id}>
          <span class="tl-t">${it.text}</span>
          ${g && !marks[it.id] && g.marks[it.id] ? html`<span class="pill coo-ghost" data-ghost=${g.marks[it.id]} title="Suggested by the COO">${g.marks[it.id]}, suggested</span>` : null}
          ${ctx.isFounder
            ? html`<span class="rv-marks" role="group" aria-label="Mark">${MARKS.map(o => html`<button key=${o.v} type="button"
                class=${'mk' + (marks[it.id] === o.v ? ' ' + o.v : '')} aria-pressed=${marks[it.id] === o.v}
                onClick=${() => setMarks(m => ({...m, [it.id]: m[it.id] === o.v ? '' : o.v}))}>${o.label}</button>`)}</span>`
            : !mine ? null
            : ((rev && rev.marks && rev.marks[it.id])
              ? html`<${UI.Pill} kind=${MARK_PILL[rev.marks[it.id]]}>${rev.marks[it.id]}<//>`
              : html`<${UI.Pill}>open<//>`)}
        </li>`)}
      </ul>` : html`<${UI.Empty} text="No outcomes posted."/>`}

      ${ctx.isFounder ? html`<div>
        ${isOwnFounderCard ? null : html`<div class="rv-q" role="group" aria-label="Quality">
          <span class="rv-lab">quality, 1 to 5</span>
          ${QUALITY.map(o => html`<button key=${o.v} type="button" class=${'qn' + (quality === o.v ? ' on' : '')} aria-pressed=${quality === o.v}
            onClick=${() => setQuality(q => q === o.v ? '' : o.v)}>${o.label}</button>`)}
        </div>`}
        <div class="stack tight" style=${{marginTop: isOwnFounderCard ? '16px' : '0'}}>
          <${UI.Input} label="note" value=${note} onChange=${setNote}/>
          <div class="row"><${UI.Btn} sm=${true} onClick=${save}>Save review<//></div>
        </div>
      </div>` : (mine && rev ? html`<div class="stack tight" style=${{marginTop: '16px'}}>
        ${rev.quality != null ? html`<div class="row"><span class="small ink62">quality</span>
          <span class="num" style=${{fontWeight: 500}}>Quality ${rev.quality} of 5</span></div>` : null}
        ${rev.note ? html`<div class="small">${rev.note}</div>` : null}
      </div>` : null)}
    </section>`;
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

    return html`<div class="stack" style=${{gap: '24px'}}>
      <${UI.PageHead} micro=${weekId.toLowerCase() + ', ' + range.toLowerCase()} title="The week">
        <div class="row nowrap">
          <${UI.Btn} kind="sec" sm=${true} ariaLabel="Previous week" onClick=${() => setOffset(o => o - 1)}><${icons.chevL}/><//>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => setOffset(0)}>This week<//>
          <${UI.Btn} kind="sec" sm=${true} ariaLabel="Next week" disabled=${offset >= 0} onClick=${() => setOffset(o => Math.min(0, o + 1))}><${icons.chevR}/><//>
        </div>
      <//>

      <section class="card pad0 wk-card">
        <div class="wk-scroll"><div class="wg wk-table" role="table">
          <div class="wg-h" role="columnheader">person</div>
          ${days.map(d => html`<div key=${d} class=${'wg-h' + (d === today ? ' td' : '')} role="columnheader">${U.fmtDay(d).split(' ')[0].toLowerCase()}<span>${Number(d.slice(8))}</span></div>`)}
          ${ctx.activeMembers.map(m => html`<${React.Fragment} key=${m.uid}>
            <div class="wg-p" role="rowheader"><${UI.Avatar} id=${m.uid} size=${28}/><span><${UI.Name} id=${m.uid}/></span></div>
            ${days.map(d => html`<${Cell} key=${d} uid=${m.uid} date=${d} today=${today} onOpen=${setCell}/>`)}
          <//>`)}
        </div></div>
        ${ctx.activeMembers.length ? null : html`<div style=${{padding: '0 24px 24px'}}><${UI.Empty} text="Nobody on the roster yet."/></div>`}
      </section>

      <${UI.SectionHead} n=${2} label="outcomes and review"/>
      ${ctx.activeMembers.map(m => html`<${ReviewCard} key=${m.uid + weekId} uid=${m.uid} weekId=${weekId} ghost=${cards.length ? M.cooUi.ghostOf(cards, m.uid, weekId) : null}/>`)}
      ${cell ? html`<${CellDrawer} cell=${cell} onClose=${() => setCell(null)}/>` : null}
    </div>`;
  }

  M.pages.Week = Week;
})();
