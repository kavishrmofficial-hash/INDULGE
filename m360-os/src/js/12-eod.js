/* module: eod (EOD line and this week's outcomes) */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const OUTCOME_LINE = 'Three outcomes that will exist by Saturday.';
  const LOCK_LINE = 'Reviewed on Friday.';
  const DUE_LINE = 'Due at 19:00.';
  const DUE_HOUR = 18;
  const MAX_OUTCOMES = 3;
  const MARK_PILL = {hit: 'ink', miss: 'flame'};

  /* ---------- pure helpers ---------- */
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const eodDays = (ctx, uid) => (collMap(ctx, 'eod')[uid] || {}).days || {};
  const planWeeks = (ctx, uid) => (collMap(ctx, 'plan')[uid] || {}).weeks || {};
  const reviewWeek = (ctx, uid, weekId) => {
    const doc = collMap(ctx, 'review')[uid];
    return (doc && doc.weeks && doc.weeks[weekId]) || null;
  };
  const trim = s => String(s || '').trim();

  /* user text as text, one div per line so line breaks survive */
  function Lines({text, className, id}) {
    const parts = String(text || '').split('\n');
    return html`<div id=${id} class=${className}>
      ${parts.map((p, i) => html`<div key=${i}>${p || ' '}</div>`)}
    </div>`;
  }

  /* a mounted flag so a write that lands after unmount never sets state */
  function useLive() {
    const live = useRef(true);
    useEffect(() => () => { live.current = false; }, []);
    return live;
  }

  /* ---------- EOD line ---------- */
  function EodCard() {
    const ctx = M.useCtx();
    const ctxRef = useRef(ctx);
    ctxRef.current = ctx;
    const live = useLive();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [shipped, setShipped] = useState('');
    const [next, setNext] = useState('');
    const [blocked, setBlocked] = useState('');
    if (!ctx || !ctx.uid) return null;

    const uid = ctx.uid;
    const now = new Date(ctx.now || Date.now());
    const today = U.ymd(now);
    const entry = eodDays(ctx, uid)[today] || null;
    const working = typeof ctx.isWorkingDay === 'function' ? ctx.isWorkingDay(today, uid) : true;
    const due = !entry && working && now.getHours() >= DUE_HOUR;
    const showForm = !entry || editing;

    const startEdit = () => {
      setShipped(entry ? entry.shipped || '' : '');
      setNext(entry ? entry.next || '' : '');
      setBlocked(entry ? entry.blocked || '' : '');
      setEditing(true);
    };
    const post = () => {
      if (busy || !trim(shipped)) return;
      setBusy(true);
      const c = ctxRef.current;
      const days = U.clone(eodDays(c, uid));
      const old = days[today] || null;
      const at = old && old.at ? old.at : Date.now();
      days[today] = {shipped: trim(shipped), next: trim(next), blocked: trim(blocked), at, updated: Date.now()};
      c.W.merge('eod/' + uid, {days: U.pruneDays(days)})
        .then(() => { M.toast('Posted'); if (live.current) setEditing(false); })
        .catch(() => {})
        .then(() => { if (live.current) setBusy(false); });
    };

    let body;
    if (showForm) {
      body = html`<div class="stack">
        ${due ? html`<div class="flame-t small">${DUE_LINE}</div>` : null}
        <${UI.TextArea} id="eod-shipped" label="shipped" rows=${2} value=${shipped} onChange=${setShipped}
          placeholder="What went out today" hint="Required."/>
        <${UI.TextArea} id="eod-next" label="next" rows=${2} value=${next} onChange=${setNext}
          placeholder="What you pick up tomorrow"/>
        <${UI.TextArea} id="eod-blocked" label="blocked" rows=${2} value=${blocked} onChange=${setBlocked}
          placeholder="What is in the way, if anything"/>
        <div class="row">
          <${UI.Btn} disabled=${busy || !trim(shipped)} onClick=${post}>Post EOD line<//>
          ${entry ? html`<${UI.Btn} kind="ghost" disabled=${busy} onClick=${() => setEditing(false)}>Cancel<//>` : null}
        </div>
      </div>`;
    } else {
      const hasBlocker = !!trim(entry.blocked);
      body = html`<div class="stack">
        <div class="stack tight">
          <${UI.Micro} plain>shipped<//>
          <${Lines} id="eod-line-shipped" text=${entry.shipped}/>
        </div>
        <div class="stack tight">
          <${UI.Micro} plain>next<//>
          ${trim(entry.next) ? html`<${Lines} id="eod-line-next" text=${entry.next}/>`
            : html`<div id="eod-line-next" class="sub small">None.</div>`}
        </div>
        <div class="stack tight">
          <${UI.Micro} plain>blocked<//>
          ${hasBlocker ? html`<${Lines} id="eod-line-blocked" className="flame-t" text=${entry.blocked}/>`
            : html`<div id="eod-line-blocked" class="sub small">None.</div>`}
        </div>
        <div class="sub small num">Posted at ${U.hhmm(entry.at)}.</div>
      </div>`;
    }

    const action = !showForm ? html`<${UI.Btn} kind="sec" sm onClick=${startEdit}>Edit<//>` : null;
    return html`<${UI.Card} title="EOD line" id="eod-card" flame=${due} action=${action}>${body}<//>`;
  }

  /* ---------- this week's outcomes ---------- */
  const emptyRow = () => ({id: null, text: '', orig: ''});
  const rowsFrom = items => {
    const rows = (items || []).slice(0, MAX_OUTCOMES).map(it => ({id: it.id || null, text: it.text || '', orig: trim(it.text)}));
    while (rows.length < MAX_OUTCOMES) rows.push(emptyRow());
    return rows;
  };

  function OutcomesCard() {
    const ctx = M.useCtx();
    const ctxRef = useRef(ctx);
    ctxRef.current = ctx;
    const live = useLive();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [rows, setRows] = useState(() => rowsFrom([]));
    if (!ctx || !ctx.uid) return null;

    const uid = ctx.uid;
    const weekId = U.isoWeek(new Date(ctx.now || Date.now()));
    const weeks = planWeeks(ctx, uid);
    const plan = weeks[weekId] || null;
    const items = (plan && Array.isArray(plan.items)) ? plan.items : [];
    const review = reviewWeek(ctx, uid, weekId);
    const locked = !!(review && review.at);
    const marks = (review && review.marks) || {};
    const showForm = !locked && (items.length === 0 || editing);
    const canSave = rows.some(r => trim(r.text));

    const setText = (i, text) => setRows(rs => rs.map((r, j) => j === i ? {...r, text} : r));
    const startEdit = () => { setRows(rowsFrom(items)); setEditing(true); };
    const save = () => {
      if (busy || !canSave) return;
      setBusy(true);
      const c = ctxRef.current;
      const all = U.clone(planWeeks(c, uid));
      const old = all[weekId] || null;
      /* unchanged rows keep their id; new or rewritten rows get a fresh one */
      const next = rows.filter(r => trim(r.text)).map(r => ({
        id: r.id && trim(r.text) === r.orig ? r.id : U.uid(),
        text: trim(r.text)
      }));
      const at = old && old.at ? old.at : Date.now();
      all[weekId] = {items: next, at, updated: Date.now()};
      c.W.merge('plan/' + uid, {weeks: U.pruneWeeks(all)})
        .then(() => { M.toast('Saved'); if (live.current) setEditing(false); })
        .catch(() => {})
        .then(() => { if (live.current) setBusy(false); });
    };

    let body;
    if (showForm) {
      body = html`<div class="stack">
        <div>${OUTCOME_LINE}</div>
        ${rows.map((r, i) => html`<${UI.Input} key=${i} id=${'outcome-' + (i + 1)} label=${'outcome ' + (i + 1)}
          value=${r.text} onChange=${t => setText(i, t)} placeholder="Something that will exist by Saturday"/>`)}
        <div class="row">
          <${UI.Btn} disabled=${busy || !canSave} onClick=${save}>Save outcomes<//>
          ${items.length ? html`<${UI.Btn} kind="ghost" disabled=${busy} onClick=${() => setEditing(false)}>Cancel<//>` : null}
        </div>
      </div>`;
    } else {
      body = html`<div class="stack tight">
        <div class="sub small">${OUTCOME_LINE}</div>
        ${items.length ? html`<div id="outcomes-list">
          ${items.map(it => {
            const mark = MARK_PILL[marks[it.id]] ? marks[it.id] : 'open';
            return html`<div key=${it.id} class="listrow" data-mark=${mark}>
              <span class="grow">${it.text}</span>
              <${UI.Pill} kind=${MARK_PILL[mark]}>${mark}<//>
            </div>`;
          })}
        </div>` : html`<${UI.Empty} text="No outcomes were posted this week."/>`}
        ${locked ? html`<div id="outcomes-lock" class="sub small">${LOCK_LINE}</div>` : null}
      </div>`;
    }

    const action = (!showForm && !locked) ? html`<${UI.Btn} kind="sec" sm onClick=${startEdit}>Edit<//>` : null;
    return html`<${UI.Card} title="This week's outcomes" id="outcomes-card" action=${action}>${body}<//>`;
  }

  M.parts.EodCard = EodCard;
  M.parts.OutcomesCard = OutcomesCard;
})();
