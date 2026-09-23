/* module: fixes. Correction requests: a member asks for a mistake to be put right (a check-in time,
   a leave balance, a task's due date, their title on the roster), the founder approves or declines
   from Admin > Controls > Corrections. Structured approvals apply the change; the rest are recorded
   and applied by hand. Data lives in fixes/<uid>.reqs, ids only, never names. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const KINDS = [
    {v: 'attendance', label: 'Attendance'}, {v: 'leave', label: 'Leave'}, {v: 'task', label: 'Task'},
    {v: 'profile', label: 'Profile'}, {v: 'other', label: 'Other'}
  ];
  const KIND_LABEL = Object.fromEntries(KINDS.map(k => [k.v, k.label.toLowerCase()]));
  const FIELDS = {
    attendance: [{v: 'in', label: 'Check-in time'}, {v: 'out', label: 'Check-out time'}, {v: 'mode', label: 'Office or WFH'}],
    leave: [{v: 'balance', label: 'Leave balance'}, {v: 'request', label: 'A leave request'}],
    task: [{v: 'status', label: 'Status'}, {v: 'due', label: 'Due date'}, {v: 'points', label: 'Points'}],
    profile: [{v: 'title', label: 'Title'}, {v: 'pod', label: 'Pod'}, {v: 'joined', label: 'Joined date'}, {v: 'empId', label: 'Employee id'}],
    other: []
  };
  const FIELD_LABEL = {};
  Object.keys(FIELDS).forEach(k => FIELDS[k].forEach(f => { FIELD_LABEL[f.v] = f.label.toLowerCase(); }));
  const STATUS_KIND = {pending: 'flame-o', approved: 'ink', declined: 'flame'};
  const WANT_MAX = 200, NOTE_MAX = 300, DECIDE_MAX = 200;
  /* each person keeps their newest 40 requests */
  const KEEP = 40;
  const BY_HAND = 'Approved. Apply the change by hand if it is not automatic.';

  /* ---------- pure helpers ---------- */
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && U.ymd(U.parseYmd(s)) === s;
  const okTime = s => /^\d{1,2}:\d{2}$/.test(String(s || '').trim()) && U.minutes(s.trim()) < 1440;
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const reqsOf = (ctx, uid) => (collMap(ctx, 'fixes')[uid] || {}).reqs || {};
  const statusOf = r => (r && (r.status === 'approved' || r.status === 'declined')) ? r.status : 'pending';

  /* every request across every readable fixes document: the founder sees all, a member their own */
  function all(ctx) {
    const out = [];
    const map = collMap(ctx, 'fixes');
    for (const uid of Object.keys(map)) {
      const reqs = (map[uid] || {}).reqs || {};
      for (const id of Object.keys(reqs)) if (reqs[id]) out.push({uid, id, req: reqs[id]});
    }
    return out;
  }
  /* pending requests, oldest first */
  function pending(ctx) {
    return all(ctx).filter(x => statusOf(x.req) === 'pending').sort((a, b) => (a.req.at || 0) - (b.req.at || 0));
  }
  /* decided requests, newest decision first */
  function decided(ctx) {
    return all(ctx).filter(x => statusOf(x.req) !== 'pending').sort((a, b) => (b.req.decidedAt || 0) - (a.req.decidedAt || 0));
  }

  /* what an approval would change on its own, or null when the founder applies it by hand */
  function plan(ctx, uid, req) {
    const want = String(req.want || '').trim();
    if (req.kind === 'attendance' && okDate(req.date)) {
      const field = req.field === 'out' ? 'out' : req.field === 'mode' ? 'mode' : 'in';
      const entry = ((collMap(ctx, 'checkin')[uid] || {}).days || {})[req.date] || null;
      if (field === 'mode') {
        const mode = want.toLowerCase();
        if ((mode === 'office' || mode === 'wfh') && entry) return {path: 'checkin/' + uid, patch: {days: {[req.date]: {mode}}}, text: 'sets ' + req.date + ' to ' + mode};
        return null;
      }
      if (!okTime(want)) return null;
      if (field === 'out' && !entry) return null;
      const ms = U.parseYmd(req.date).getTime() + U.minutes(want) * 60000;
      const day = entry ? {[field]: ms} : {in: ms, out: null, mode: 'office', loc: null, outLoc: null};
      return {path: 'checkin/' + uid, patch: {days: {[req.date]: day}}, text: 'sets the ' + (field === 'out' ? 'check-out' : 'check-in') + ' on ' + U.fmtDate(req.date) + ' to ' + want};
    }
    if (req.kind === 'profile' && (req.field === 'title' || req.field === 'pod') && want && ctx.members && ctx.members[uid]) {
      return {path: 'roster/team', patch: {members: {[uid]: {[req.field]: want.slice(0, 80)}}, updated: Date.now()}, text: 'sets the ' + req.field + ' to ' + want};
    }
    return null;
  }

  /* ---------- deep links: M.fixes.open(kind, date) from anywhere ---------- */
  let openArgs = null;
  function open(kind, date, field) {
    openArgs = {kind: KIND_LABEL[kind] ? kind : 'other', date: okDate(date) ? date : '', field: field || ''};
    M.intend('#me', 'fix');
  }

  /* ---------- member: the request drawer ---------- */
  const blank = () => ({kind: 'attendance', field: 'in', date: '', want: '', note: ''});
  function FixDrawer({onClose, initial}) {
    const ctx = M.useCtx();
    const [f, setF] = useState(() => ({...blank(), ...(initial || {})}));
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setKind = v => setF(x => ({...x, kind: v, field: (FIELDS[v][0] || {v: ''}).v}));
    const fields = FIELDS[f.kind] || [];
    const canSend = !!f.want.trim() && !busy && (!f.date || okDate(f.date));
    const timeHint = f.kind === 'attendance' && f.field !== 'mode' ? 'HH:MM, for example 09:45' : f.kind === 'attendance' ? 'office or wfh' : '';
    const send = () => {
      if (!canSend) return;
      setBusy(true);
      const id = U.uid();
      const req = {kind: f.kind, date: okDate(f.date) ? f.date : '', field: fields.length ? f.field : '',
        want: f.want.trim().slice(0, WANT_MAX), note: f.note.trim().slice(0, NOTE_MAX), at: Date.now(), status: 'pending',
        decidedAt: null, decidedNote: ''};
      const cur = U.clone(reqsOf(ctx, ctx.uid));
      const keep = Object.keys(cur).sort((a, b) => (cur[b].at || 0) - (cur[a].at || 0)).slice(0, KEEP - 1);
      const reqs = {[id]: req};
      keep.forEach(k => { reqs[k] = cur[k]; });
      ctx.W.set('fixes/' + ctx.uid, {reqs})
        .then(() => { M.toast('Sent to Kaavish'); onClose(); })
        .catch(() => setBusy(false));
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Request a correction"
      footer=${html`<${UI.Btn} id="fix-send" disabled=${!canSend} onClick=${send}><${icons.send}/>Send<//>`}>
      <div id="fix-drawer" class="stack">
        <${UI.Field} label="what is wrong">
          <${UI.Seg} options=${KINDS} value=${f.kind} onChange=${setKind} ariaLabel="Kind"/>
        <//>
        ${fields.length ? html`<${UI.Select} id="fix-field" label="which part" value=${f.field} onChange=${v => set('field', v)} options=${fields}/>` : null}
        <${UI.Input} id="fix-date" label="date, if it is about one day" type="date" value=${f.date} onChange=${v => set('date', v)}/>
        <${UI.Input} id="fix-want" label="what it should be" value=${f.want} hint=${timeHint}
          placeholder=${f.kind === 'attendance' && f.field !== 'mode' ? '09:45' : 'The correct value'}
          onChange=${v => set('want', v.slice(0, WANT_MAX))}/>
        <${UI.TextArea} id="fix-note" label="why" value=${f.note} rows=${3} placeholder="What happened, in a line or two"
          onChange=${v => set('note', v.slice(0, NOTE_MAX))}/>
        <div class="sub small">Kaavish sees this and decides. The decision lands in your inbox.</div>
      </div>
    <//>`;
  }

  /* ---------- member: Me > Profile card ---------- */
  function ReqLine({req}) {
    const s = statusOf(req);
    return html`<div class="fix-item">
      <div class="row" style=${{gap: '8px'}}>
        <${UI.Pill}>${KIND_LABEL[req.kind] || 'other'}<//>
        ${req.field && FIELD_LABEL[req.field] ? html`<span class="tiny ink62">${FIELD_LABEL[req.field]}</span>` : null}
        ${req.date ? html`<span class="tiny ink62 num">${U.fmtDate(req.date)}</span>` : null}
        <${UI.Pill} kind=${STATUS_KIND[s]}>${s}<//>
      </div>
      <div class="fix-want">Should be: ${req.want}</div>
      ${req.note ? html`<div class="small ink62">${req.note}</div>` : null}
      ${s !== 'pending' && req.decidedNote ? html`<div class="small fix-note">Kaavish: ${req.decidedNote}</div>` : null}
      <div class="tiny ink62">${s === 'pending' ? 'asked ' + U.timeAgo(req.at || Date.now()) : 'decided ' + U.timeAgo(req.decidedAt || req.at || Date.now())}</div>
    </div>`;
  }

  function RequestFixCard() {
    const ctx = M.useCtx();
    const [drawer, setDrawer] = useState(null);
    M.useIntent('fix', () => { setDrawer(openArgs || {}); openArgs = null; });
    if (!ctx || !ctx.uid) return null;
    const reqs = reqsOf(ctx, ctx.uid);
    const list = Object.keys(reqs).filter(id => reqs[id]).map(id => ({id, req: reqs[id]}))
      .sort((a, b) => (b.req.at || 0) - (a.req.at || 0));
    const withdraw = id => {
      const cur = U.clone(reqs);
      delete cur[id];
      ctx.W.set('fixes/' + ctx.uid, {reqs: cur}).then(() => M.toast('Withdrawn')).catch(() => {});
    };
    return html`<${UI.Card} id="fix-card" title="Something wrong?">
      <p class="small ink62" style=${{marginTop: 0}}>A check-in time, a leave day, a task or your roster line looks off? Ask for a correction and Kaavish decides.</p>
      <div class="row"><${UI.Btn} kind="sec" sm=${true} id="fix-open" onClick=${() => setDrawer({})}><${icons.fix}/>Request a correction<//></div>
      ${list.length ? html`<div class="stack tight" style=${{marginTop: '12px'}}>
        ${list.map(({id, req}) => html`<div class="row nowrap" key=${id} style=${{alignItems: 'flex-start'}}>
          <div class="grow"><${ReqLine} req=${req}/></div>
          ${statusOf(req) === 'pending' ? html`<${UI.ConfirmBtn} onConfirm=${() => withdraw(id)}>Withdraw<//>` : null}
        </div>`)}
      </div>` : null}
      ${drawer ? html`<${FixDrawer} initial=${drawer} onClose=${() => setDrawer(null)}/>` : null}
    <//>`;
  }

  /* ---------- founder: the queue ---------- */
  function QueueRow({uid, id, req}) {
    const ctx = M.useCtx();
    const [mode, setMode] = useState(null);          /* null or 'decline' */
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const auto = plan(ctx, uid, req);
    const decide = async (status, decidedNote) => {
      setBusy(true);
      try {
        if (status === 'approved' && auto) await ctx.W.merge(auto.path, auto.patch);
        await ctx.W.merge('fixes/' + uid, {reqs: {[id]: {status, decidedAt: Date.now(), decidedNote: (decidedNote || '').trim().slice(0, DECIDE_MAX)}}});
        M.toast(status === 'declined' ? 'Declined' : auto ? 'Approved and applied' : BY_HAND);
      } catch (e) { setBusy(false); }
    };
    return html`<div class="fix-row" id=${'fix-' + id}>
      <${UI.Avatar} id=${uid} size=${34}/>
      <div class="grow">
        <div class="row" style=${{gap: '8px'}}>
          <b><${UI.Name} id=${uid}/></b>
          <${UI.Pill}>${KIND_LABEL[req.kind] || 'other'}<//>
          ${req.field && FIELD_LABEL[req.field] ? html`<span class="tiny ink62">${FIELD_LABEL[req.field]}</span>` : null}
          ${req.date ? html`<span class="tiny ink62 num">${U.fmtDate(req.date)}</span>` : null}
        </div>
        <div class="fix-want">Should be: ${req.want}</div>
        ${req.note ? html`<div class="small ink62">Why: ${req.note}</div>` : null}
        <div class="tiny ink62">asked ${U.timeAgo(req.at || Date.now())} · ${auto ? 'approving ' + auto.text : 'approving records the decision for you to apply by hand'}</div>
        ${mode === 'decline' ? html`<div class="row" style=${{marginTop: '8px'}}>
          <input class="input" id=${'fix-decline-' + id} style=${{maxWidth: '360px', minHeight: '38px'}} placeholder="Why, one line" value=${note}
            onInput=${e => setNote(e.target.value.slice(0, DECIDE_MAX))} aria-label="Decline note"/>
          <${UI.Btn} kind="flame" sm=${true} disabled=${busy || !note.trim()} onClick=${() => decide('declined', note)}>Decline<//>
          <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setMode(null)}>Cancel<//>
        </div>` : null}
      </div>
      ${mode ? null : html`<span class="row nowrap acts">
        <${UI.Btn} sm=${true} disabled=${busy} onClick=${() => decide('approved', '')}><${icons.check}/>Approve<//>
        <${UI.Btn} kind="sec" sm=${true} disabled=${busy} onClick=${() => setMode('decline')}>Decline<//>
      </span>`}
    </div>`;
  }

  function FixQueue() {
    const ctx = M.useCtx();
    if (!ctx || !ctx.isFounder) return null;
    const list = pending(ctx);
    const past = decided(ctx).slice(0, 12);
    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.Card} id="fix-queue" title="Corrections"
        action=${list.length ? html`<${UI.Pill} kind="flame-o">${list.length} pending<//>` : null}>
        <p class="small ink62" style=${{marginTop: 0}}>What people say is wrong, oldest first. Approving a check-in time, an office or WFH mark, a title or a pod applies it. Everything else is recorded and you apply it by hand.</p>
        ${list.length ? list.map(x => html`<${QueueRow} key=${x.uid + ':' + x.id} uid=${x.uid} id=${x.id} req=${x.req}/>`)
          : html`<${UI.Empty} text="Nothing waiting."/>`}
      <//>
      ${past.length ? html`<${UI.Card} id="fix-past" title="Decided">
        ${past.map(x => html`<div class="fix-row" key=${x.uid + ':' + x.id}>
          <${UI.Avatar} id=${x.uid} size=${28}/>
          <div class="grow">
            <div class="row" style=${{gap: '8px'}}>
              <b><${UI.Name} id=${x.uid}/></b>
              <${UI.Pill}>${KIND_LABEL[x.req.kind] || 'other'}<//>
              ${x.req.date ? html`<span class="tiny ink62 num">${U.fmtDate(x.req.date)}</span>` : null}
              <${UI.Pill} kind=${STATUS_KIND[statusOf(x.req)]}>${statusOf(x.req)}<//>
            </div>
            <div class="small">Should be: ${x.req.want}</div>
            ${x.req.decidedNote ? html`<div class="small ink62">${x.req.decidedNote}</div>` : null}
            <div class="tiny ink62">decided ${U.timeAgo(x.req.decidedAt || x.req.at || Date.now())}</div>
          </div>
        </div>`)}
      <//>` : null}
    </div>`;
  }

  /* the tab label carries the pending count */
  function TabLabel() {
    const ctx = M.useCtx();
    const n = ctx && ctx.isFounder ? pending(ctx).length : 0;
    return html`<span class="row nowrap" style=${{gap: '6px'}}>Corrections${n ? html`<span class="pill flame" style=${{height: '18px', padding: '0 7px', fontSize: '11px'}}>${n}</span>` : null}</span>`;
  }

  M.meCards.push(RequestFixCard);
  M.deskTabs.push({v: 'fixes', label: html`<${TabLabel}/>`, render: FixQueue});
  M.parts.RequestFixCard = RequestFixCard;
  M.parts.FixQueue = FixQueue;
  M.fixes = {open, pending, decided, all, plan, statusOf, KINDS, KIND_LABEL, FIELD_LABEL, okTime};
})();
