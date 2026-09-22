/* module: leave */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState} = React;

  const TYPES = [
    {v: 'casual', label: 'Casual'},
    {v: 'sick', label: 'Sick'},
    {v: 'swap', label: 'WFH swap'},
    {v: 'other', label: 'Other'}
  ];
  const TYPE_LABEL = Object.fromEntries(TYPES.map(t => [t.v, t.label]));
  const STATUS_KIND = {pending: 'flame-o', approved: 'ink', declined: 'flame'};
  /* each person keeps their newest 60 requests; older ones fall off on the next write */
  const KEEP = 60;

  /* ---------- pure helpers ---------- */
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && U.ymd(U.parseYmd(s)) === s;
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const reqsOf = (ctx, uid) => ((collMap(ctx, 'leave')[uid] || {}).reqs || []).filter(r => r && r.id);
  const decOf = (ctx, uid) => (collMap(ctx, 'leavedec')[uid] || {}).d || {};
  const statusOf = (ctx, uid, id) => {
    const d = decOf(ctx, uid)[id];
    return d && (d.status === 'approved' || d.status === 'declined') ? d.status : 'pending';
  };
  const dayCount = r => (okDate(r.from) && okDate(r.to) && r.to >= r.from) ? U.daysBetween(r.from, r.to) + 1 : 0;
  const rangeText = r => {
    if (!okDate(r.from) || !okDate(r.to)) return '';
    return r.from === r.to ? U.fmtDate(r.from) : U.fmtDate(r.from) + ' to ' + U.fmtDate(r.to);
  };
  const dayText = n => n === 1 ? '1 day' : n + ' days';

  /* every request with no decision yet, across every leave document, soonest first */
  function pending(ctx) {
    const out = [];
    const leave = collMap(ctx, 'leave');
    for (const uid of Object.keys(leave)) {
      for (const req of reqsOf(ctx, uid)) if (statusOf(ctx, uid, req.id) === 'pending') out.push({uid, req});
    }
    out.sort((a, b) => String(a.req.from || '').localeCompare(String(b.req.from || '')) || (a.req.at || 0) - (b.req.at || 0));
    return out;
  }

  /* names resolved inside this module. M.useProfiles re-renders only the component whose fetch filled
     the shared cache, so a UI.Name next to a UI.Avatar for the same id can keep its fallback until the
     next tree render. This hook holds its own copy and always re-renders once the fetch settles. */
  function useNames(ctx, ids) {
    const key = (ids || []).filter(Boolean).sort().join(',');
    const [ps, setPs] = useState({});
    React.useEffect(() => {
      const user = ctx && ctx.user;
      if (!user || !key || typeof user.profiles !== 'function') return undefined;
      let live = true;
      Promise.resolve().then(() => user.profiles(key.split(','))).then(r => { if (live && r) setPs(r); }).catch(() => {});
      return () => { live = false; };
    }, [ctx && ctx.user, key]);
    return ps;
  }

  /* ---------- small parts ---------- */
  const TypePill = ({t}) => html`<${UI.Pill}>${(TYPE_LABEL[t] || 'Other').toLowerCase()}<//>`;
  const StatusPill = ({s}) => html`<${UI.Pill} kind=${STATUS_KIND[s] || 'flame-o'}>${s}<//>`;
  const ReqLine = ({req, tail}) => {
    const n = dayCount(req);
    return html`<div class="sub small num">${rangeText(req)}${n ? ' · ' + dayText(n) : ''}${tail ? ' · ' + tail : ''}</div>`;
  };

  /* ---------- founder: pending requests with Approve and Decline inline ---------- */
  function LeaveApprovals() {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(null);
    const list = ctx && ctx.isFounder ? pending(ctx) : [];
    const names = useNames(ctx, list.map(x => x.uid));
    if (!ctx || !ctx.isFounder) return null;
    const nameOf = uid => (names[uid] && names[uid].name) || 'Someone';
    const decide = (uid, id, status) => {
      setBusy(id);
      ctx.W.merge('leavedec/' + uid, {d: {[id]: {status, at: Date.now()}}})
        .then(() => M.toast(status === 'approved' ? 'Approved' : 'Declined'))
        .catch(() => {})
        .then(() => setBusy(null));
    };
    return html`<${UI.Card} title="Approvals" id="leave-approvals"
        action=${list.length ? html`<${UI.Pill} kind="flame-o">${list.length} pending<//>` : null}>
      ${list.length ? list.map(({uid, req}) => html`<div class="listrow" key=${uid + ':' + req.id}>
        <div class="row between grow">
          <div class="row nowrap">
            <${UI.Avatar} id=${uid} size=${32}/>
            <div>
              <div class="row"><b>${nameOf(uid)}</b><${TypePill} t=${req.type}/></div>
              <${ReqLine} req=${req} tail=${req.at ? 'asked ' + U.timeAgo(req.at) : ''}/>
            </div>
          </div>
          <div class="row nowrap">
            <${UI.Btn} sm disabled=${busy === req.id} onClick=${() => decide(uid, req.id, 'approved')}>Approve<//>
            <${UI.Btn} kind="sec" sm disabled=${busy === req.id} onClick=${() => decide(uid, req.id, 'declined')}>Decline<//>
          </div>
        </div>
      </div>`) : html`<${UI.Empty} text="No leave requests waiting."/>`}
    <//>`;
  }

  /* ---------- page ---------- */
  function Leave() {
    const ctx = M.useCtx();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [type, setType] = useState('casual');
    const [busy, setBusy] = useState(false);
    const uid = ctx.uid;
    const today = U.todayStr();
    const member = ctx.member;
    const probation = member && okDate(member.probationEnd) && member.probationEnd > today ? member.probationEnd : null;
    const mine = reqsOf(ctx, uid).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    const canSend = okDate(from) && okDate(to) && to >= from && !busy;

    /* the to date follows the from date until the person picks a later one */
    const onFrom = v => {
      setFrom(v);
      if (!okDate(to) || (okDate(v) && to < v)) setTo(v);
    };
    const send = () => {
      if (!canSend) return;
      setBusy(true);
      const req = {id: U.uid(), from, to, type, at: Date.now()};
      const reqs = [req, ...U.clone(reqsOf(ctx, uid))].slice(0, KEEP);
      ctx.W.merge('leave/' + uid, {reqs})
        .then(() => { M.toast('Requested'); setFrom(''); setTo(''); setType('casual'); })
        .catch(() => {})
        .then(() => setBusy(false));
    };
    const withdraw = id => {
      const reqs = U.clone(reqsOf(ctx, uid)).filter(r => r.id !== id);
      ctx.W.merge('leave/' + uid, {reqs}).then(() => M.toast('Withdrawn')).catch(() => {});
    };

    const Approvals = M.parts.LeaveApprovals;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="team" title="Leave"/>
      ${ctx.isFounder && Approvals ? html`<${Approvals}/>` : null}
      <div class="grid2">
        <${UI.Card} title="Request leave" id="leave-request">
          ${probation ? html`<div class="row nowrap small" style=${{alignItems: 'flex-start', marginBottom: '12px'}}>
            <span class="dotflame" style=${{marginTop: '7px'}}/>
            <span>You're in probation until ${U.fmtDate(probation)}. Leave in probation is loss of pay.</span>
          </div>` : null}
          <div class="stack">
            <div class="grid2">
              <${UI.Input} id="leave-from" label="from" type="date" value=${from} onChange=${onFrom}/>
              <${UI.Input} id="leave-to" label="to" type="date" value=${to} min=${okDate(from) ? from : undefined} onChange=${setTo}/>
            </div>
            <${UI.Select} id="leave-type" label="type" value=${type} onChange=${setType} options=${TYPES}/>
            <div class="row">
              <${UI.Btn} disabled=${!canSend} onClick=${send}>Request leave<//>
            </div>
            <div class="sub small">Details go to Kaavish directly.</div>
          </div>
        <//>
        <${UI.Card} title="Your requests" id="leave-mine">
          ${mine.length ? mine.map(r => {
            const s = statusOf(ctx, uid, r.id);
            const d = decOf(ctx, uid)[r.id];
            const tail = s === 'pending' ? (r.at ? 'asked ' + U.timeAgo(r.at) : '')
              : (d && d.at ? 'decided ' + U.fmtDate(U.ymd(new Date(d.at))) : '');
            return html`<div class="listrow" key=${r.id}>
              <div class="row between grow">
                <div>
                  <div class="row"><span class="num">${rangeText(r)}</span><${TypePill} t=${r.type}/><${StatusPill} s=${s}/></div>
                  <div class="sub small">${dayText(dayCount(r))}${tail ? ' · ' + tail : ''}</div>
                </div>
                ${s === 'pending' ? html`<${UI.ConfirmBtn} onConfirm=${() => withdraw(r.id)}>Withdraw<//>` : null}
              </div>
            </div>`;
          }) : html`<${UI.Empty} text="No requests yet."/>`}
        <//>
      </div>
    <//>`;
  }

  M.pages.Leave = Leave;
  M.parts.LeaveApprovals = LeaveApprovals;
  M.leave = {pending, TYPES, okDate, dayCount, rangeText};
})();
