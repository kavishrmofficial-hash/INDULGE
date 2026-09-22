/* module: hiring */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const STAGES = [
    {v: 'screen', label: 'Screen'},
    {v: 'test', label: 'Test'},
    {v: 'panel', label: 'Panel'},
    {v: 'offer', label: 'Offer'},
    {v: 'hired', label: 'Hired'},
    {v: 'rejected', label: 'Rejected'}
  ];
  const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.v, s.label]));
  const CRITERIA = [
    {k: 'craft', label: 'Quality of work', short: 'quality'},
    {k: 'thinking', label: 'Thinking and logic', short: 'thinking'},
    {k: 'comms', label: 'Communication', short: 'communication'},
    {k: 'ownership', label: 'Ownership (finishes things)', short: 'ownership'},
    {k: 'culture', label: 'Culture add', short: 'culture add'}
  ];
  const GWC = [
    {k: 'g', q: 'Gets it?', label: 'Gets it'},
    {k: 'w', q: 'Wants it?', label: 'Wants it'},
    {k: 'c', q: 'Capacity to do it?', label: 'Capacity to do it'}
  ];
  const VERDICTS = [
    {v: 'strong-no', label: 'Strong no'},
    {v: 'no', label: 'No'},
    {v: 'yes', label: 'Yes'},
    {v: 'strong-yes', label: 'Strong yes'}
  ];
  const VERDICT_LABEL = Object.fromEntries(VERDICTS.map(v => [v.v, v.label]));
  const YESNO = [{v: 'yes', label: 'Yes'}, {v: 'no', label: 'No'}];
  const SCORES = [1, 2, 3, 4, 5].map(n => ({v: n, label: String(n)}));
  const POD_Q = 'Would you want them in your pod?';
  const NOTE = 'Your evaluation goes to Kaavish only. Nobody else on the panel sees it. Write what you would say to his face.';

  /* ---------- pure helpers ---------- */
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && U.ymd(U.parseYmd(s)) === s;
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const candMap = ctx => collMap(ctx, 'candidates');
  const evaluatorsOf = c => Array.isArray(c && c.evaluators) ? c.evaluators.filter(u => typeof u === 'string' && u) : [];
  const evalOf = (ctx, u, cid) => {
    const e = ((collMap(ctx, 'evals')[u] || {}).e || {})[cid];
    return e && typeof e === 'object' ? e : null;
  };
  /* evaluators whose evaluation is visible to the viewer: every one for the founder, my own for a member */
  const submittedOf = (ctx, c) => evaluatorsOf(c).filter(u => evalOf(ctx, u, c.id));
  const decided = c => !!(c && c.decision);
  const stageKind = s => s === 'hired' ? 'ink' : s === 'rejected' ? 'flame' : undefined;
  const yesNo = v => v === 'yes' || v === 'no';
  const scoreOk = n => Number.isInteger(n) && n >= 1 && n <= 5;
  const safeHref = link => {
    const s = String(link || '').trim();
    if (!s) return null;
    return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
  };
  const linksOf = c => String((c && c.links) || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    .map(s => ({text: s, href: safeHref(s)}));
  const evalWord = n => n === 1 ? 'evaluation' : 'evaluations';
  const dueText = c => okDate(c && c.deadline) ? 'due ' + U.fmtDate(c.deadline) : 'no deadline';
  const dayOf = ts => ts ? U.fmtDate(U.ymd(new Date(ts))) : '';

  /* every candidate: open ones first, soonest deadline first; decided ones after, newest decision first */
  function candidatesOf(ctx) {
    const m = candMap(ctx);
    const list = Object.keys(m).filter(id => m[id] && typeof m[id] === 'object').map(id => ({...m[id], id}));
    list.sort((a, b) => {
      const da = decided(a) ? 1 : 0, db = decided(b) ? 1 : 0;
      if (da !== db) return da - db;
      if (da) return (b.decidedAt || 0) - (a.decidedAt || 0);
      return String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')) || (a.created || 0) - (b.created || 0);
    });
    return list;
  }

  function panel(ctx) {
    return candidatesOf(ctx).filter(c => !decided(c)).map(c => ({
      id: c.id, candidate: String(c.name || 'Candidate'), submitted: submittedOf(ctx, c).length, total: evaluatorsOf(c).length
    }));
  }

  function assignedToMe(ctx) {
    const me = ctx && ctx.uid;
    if (!me) return [];
    return candidatesOf(ctx).filter(c => !decided(c) && evaluatorsOf(c).includes(me) && !evalOf(ctx, me, c.id)).map(c => c.id);
  }

  /* founder summary over the submitted evaluations */
  function summary(ctx, c) {
    const subs = submittedOf(ctx, c).map(u => ({uid: u, e: evalOf(ctx, u, c.id)}));
    const n = subs.length;
    const avg = CRITERIA.map(cr => {
      const vals = subs.map(x => Number(x.e.s && x.e.s[cr.k])).filter(scoreOk);
      return {k: cr.k, short: cr.short, n: vals.length, avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null};
    });
    const gwc = GWC.map(g => ({k: g.k, label: g.label, yes: subs.filter(x => x.e.gwc && x.e.gwc[g.k] === 'yes').length, n}));
    const tally = VERDICTS.slice().reverse()
      .map(v => ({v: v.v, label: v.label, n: subs.filter(x => x.e.verdict === v.v).length}))
      .filter(t => t.n > 0);
    const pod = subs.filter(x => x.e.pod === 'yes').length;
    const whys = subs.filter(x => String(x.e.why || '').trim()).map(x => ({uid: x.uid, text: String(x.e.why).trim()}));
    const risks = subs.filter(x => String(x.e.risk || '').trim()).map(x => ({uid: x.uid, text: String(x.e.risk).trim()}));
    return {subs, n, avg, gwc, tally, pod, whys, risks};
  }
  const tallyText = t => t.length ? t.map(x => x.label + ' ' + x.n).join(', ') : 'No verdicts yet';

  /* names resolved inside this module. M.useProfiles re-renders only the component whose fetch filled the
     shared cache, so this hook keeps its own copy and re-renders once the fetch settles. */
  function useNames(ctx, ids) {
    const key = (ids || []).filter(Boolean).sort().join(',');
    const [ps, setPs] = useState({});
    useEffect(() => {
      const user = ctx && ctx.user;
      if (!user || !key || typeof user.profiles !== 'function') return undefined;
      let live = true;
      Promise.resolve().then(() => user.profiles(key.split(','))).then(r => { if (live && r) setPs(r); }).catch(() => {});
      return () => { live = false; };
    }, [ctx && ctx.user, key]);
    return ps;
  }
  const nameIn = (names, u) => (names[u] && names[u].name) || 'Someone';

  /* ---------- small parts ---------- */
  const StagePill = ({stage}) => html`<${UI.Pill} kind=${stageKind(stage)}>${(STAGE_LABEL[stage] || 'Screen').toLowerCase()}<//>`;
  const VerdictPill = ({v}) => html`<${UI.Pill} kind=${v === 'yes' || v === 'strong-yes' ? 'ink' : 'flame-o'}>${(VERDICT_LABEL[v] || 'No verdict').toLowerCase()}<//>`;
  const YesPill = ({label, v}) => html`<${UI.Pill} kind=${v === 'yes' ? 'ink' : 'flame-o'}>${label}: ${v === 'yes' ? 'yes' : 'no'}<//>`;
  const Links = ({c}) => {
    const links = linksOf(c);
    if (!links.length) return html`<${UI.Empty} text="No links yet."/>`;
    return html`<div class="stack tight">
      ${links.map((l, i) => html`<a key=${i} class="linky small" href=${l.href} target="_blank" rel="noopener noreferrer"
        style=${{overflowWrap: 'anywhere', alignSelf: 'flex-start'}}>${l.text}</a>`)}
    </div>`;
  };
  /* one submitted evaluation, rendered as text and pills */
  const EvalView = ({e}) => html`<div class="stack tight">
    <div class="row">${GWC.map(g => html`<${YesPill} key=${g.k} label=${g.label.toLowerCase()} v=${e.gwc && e.gwc[g.k]}/>`)}</div>
    <div class="row small num">${CRITERIA.map(cr => {
      const v = Number(e.s && e.s[cr.k]);
      return html`<span key=${cr.k}><span class="sub">${cr.short}</span> <b>${scoreOk(v) ? v : '?'}</b></span>`;
    })}</div>
    <div class="row"><${YesPill} label="pod" v=${e.pod}/><${VerdictPill} v=${e.verdict}/></div>
    <div class="small"><span class="sub">reason to hire:</span> ${String(e.why || '')}</div>
    <div class="small"><span class="sub">risk:</span> ${String(e.risk || '')}</div>
  </div>`;

  /* ---------- founder: candidate list card ---------- */
  function CandidateCard({c, ctx, selected}) {
    const subs = submittedOf(ctx, c).length, total = evaluatorsOf(c).length;
    return html`<button type="button" class="rowbtn" id=${'cand-' + c.id} style=${{fontWeight: 300}} aria-pressed=${!!selected}
      aria-label=${'Open ' + (c.name || 'candidate')} onClick=${() => M.nav('#hiring/' + encodeURIComponent(c.id))}>
      <div class="card stack tight">
        <div class="row between nowrap"><b class="grow">${c.name || 'Candidate'}</b><${StagePill} stage=${c.stage}/></div>
        ${c.role ? html`<div class="sub small">${c.role}</div>` : null}
        <div class="row small num">
          <span class="sub">${dueText(c)}</span>
          <span>${subs} of ${total} ${evalWord(total)}</span>
        </div>
      </div>
    </button>`;
  }

  /* ---------- founder: new or edit candidate ---------- */
  const fromCandidate = c => ({
    name: String((c && c.name) || ''), role: String((c && c.role) || ''),
    stage: STAGE_LABEL[c && c.stage] ? c.stage : 'screen',
    links: String((c && c.links) || ''), notes: String((c && c.notes) || ''),
    evaluators: evaluatorsOf(c), deadline: okDate(c && c.deadline) ? c.deadline : ''
  });

  function CandidateDrawer({candidateId, onClose}) {
    const ctx = M.useCtx();
    const isNew = !candidateId;
    const cur = isNew ? null : candMap(ctx)[candidateId];
    const [f, setF] = useState(() => fromCandidate(cur));
    const [busy, setBusy] = useState(false);
    const members = (ctx.activeMembers || []).filter(m => m.uid !== ctx.founderUid && m.role !== 'founder' && m.uid !== ctx.uid);
    const names = useNames(ctx, members.map(m => m.uid));
    const W = ctx.W;
    const set = k => v => setF(x => ({...x, [k]: v}));
    const toggle = (u, on) => setF(x => ({...x, evaluators: on
      ? (x.evaluators.includes(u) ? x.evaluators : [...x.evaluators, u])
      : x.evaluators.filter(y => y !== u)}));

    const save = async () => {
      const name = f.name.trim();
      if (!name) { M.toast('Give the candidate a name.', true); return; }
      setBusy(true);
      const now = Date.now();
      const fin = f.stage === 'hired' || f.stage === 'rejected';
      const decision = fin ? (f.stage === 'hired' ? 'hire' : 'reject') : '';
      const body = {name, role: f.role.trim(), stage: f.stage, links: f.links.trim(), notes: f.notes.trim(),
        evaluators: f.evaluators.slice(), deadline: okDate(f.deadline) ? f.deadline : ''};
      let ok = false, newId = null;
      try {
        if (isNew) {
          newId = U.uid();
          await W.set('candidates/' + newId, {...body, decision, decidedAt: fin ? now : null, created: now});
          M.toast('Candidate added');
        } else {
          const keep = cur && cur.decision === decision && cur.decidedAt;
          await W.update('candidates/' + candidateId, {...body, decision, decidedAt: fin ? (keep || now) : null});
          M.toast('Saved');
        }
        ok = true;
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
      if (ok) { onClose(); if (newId) M.nav('#hiring/' + encodeURIComponent(newId)); }
    };
    const del = async () => {
      try {
        await W.del('candidates/' + candidateId);
        M.toast('Candidate deleted');
        onClose();
        M.nav('#hiring');
      } catch (e) { /* the write layer toasts the failure */ }
    };

    if (!isNew && !cur) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Candidate">
        <${UI.Empty} text="This candidate is gone."/>
      <//>`;
    }
    const footer = html`<${React.Fragment}>
      ${isNew ? null : html`<div class="grow"><${UI.ConfirmBtn} onConfirm=${del}>Delete candidate<//></div>`}
      <${UI.Btn} disabled=${busy} onClick=${save}>${isNew ? 'Add candidate' : 'Save candidate'}<//>
    <//>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New candidate' : 'Edit candidate'} footer=${footer}>
      <${UI.Input} id="cand-name" label="name" value=${f.name} onChange=${set('name')} placeholder="Full name"/>
      <${UI.Input} id="cand-role" label="role" value=${f.role} onChange=${set('role')} placeholder="Brand strategist"/>
      <div class="grid2">
        <${UI.Select} id="cand-stage" label="stage" value=${f.stage} onChange=${set('stage')} options=${STAGES}/>
        <${UI.Input} id="cand-deadline" label="deadline" type="date" value=${f.deadline} onChange=${set('deadline')}/>
      </div>
      <${UI.TextArea} id="cand-links" label="links" value=${f.links} onChange=${set('links')} placeholder="https://"
        hint="Links, one per line: portfolio, the paid two-hour test brief, the submission"/>
      <${UI.TextArea} id="cand-notes" label="notes" value=${f.notes} onChange=${set('notes')} placeholder="What the panel should look for"/>
      <${UI.Field} label="evaluators" hint=${members.length ? 'Each evaluator sees the candidate and their own evaluation only.' : 'Add people to the roster from the Desk first.'}>
        <div class="stack tight">
          ${members.map(m => html`<div key=${m.uid} id=${'cand-ev-' + m.uid}>
            <${UI.Check} label=${nameIn(names, m.uid) + (m.title ? ', ' + m.title : '')} checked=${f.evaluators.includes(m.uid)}
              onChange=${on => toggle(m.uid, on)}/>
          </div>`)}
        </div>
      <//>
    <//>`;
  }

  /* ---------- founder: candidate page (inline section under the list) ---------- */
  function CandidateSection({id, onEdit}) {
    const ctx = M.useCtx();
    const c = candMap(ctx)[id];
    const [busy, setBusy] = useState(false);
    const evaluators = evaluatorsOf(c);
    const names = useNames(ctx, evaluators);
    if (!c) {
      return html`<${UI.Card} title="Candidate" id="hiring-candidate">
        <${UI.Empty} text=${ctx.coll.candidates.ready ? 'This candidate is gone.' : 'Loading.'}/>
      <//>`;
    }
    const cand = {...c, id};
    const sum = summary(ctx, cand);
    const all = sum.n >= evaluators.length;
    const isDec = decided(c);

    const decide = async d => {
      setBusy(true);
      try {
        await ctx.W.update('candidates/' + id, {decision: d, decidedAt: Date.now(), stage: d === 'hire' ? 'hired' : 'rejected'});
        M.toast(d === 'hire' ? 'Marked hired' : 'Marked rejected');
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
    };
    const decision = isDec
      ? html`<div class="row" id="hiring-decision">
          <${StagePill} stage=${c.stage}/>
          <span class="sub small num">decided ${dayOf(c.decidedAt) || 'earlier'}</span>
        </div>`
      : all
        ? html`<div class="row" id="hiring-decision">
            <${UI.Btn} disabled=${busy} onClick=${() => decide('hire')}>Hire<//>
            <${UI.Btn} kind="sec" disabled=${busy} onClick=${() => decide('reject')}>Reject<//>
          </div>`
        : html`<div class="row" id="hiring-decision">
            <${UI.ConfirmBtn} kind="sec" sm=${false} label="Decide without all evaluations" onConfirm=${() => decide('hire')}>Hire<//>
            <${UI.ConfirmBtn} kind="sec" sm=${false} label="Decide without all evaluations" onConfirm=${() => decide('reject')}>Reject<//>
            <span class="sub small num">${sum.n} of ${evaluators.length} ${evalWord(evaluators.length)} in</span>
          </div>`;

    const action = html`<div class="row nowrap">
      <${StagePill} stage=${c.stage}/>
      <${UI.Btn} kind="sec" sm onClick=${onEdit}><${icons.edit}/>Edit<//>
    </div>`;

    return html`<${UI.Card} title=${c.name || 'Candidate'} id="hiring-candidate" action=${action}>
      <div class="stack">
        <div class="sub small num">${c.role ? c.role + ' · ' : ''}${dueText(c)}</div>
        <${UI.Micro} plain>links<//>
        <${Links} c=${c}/>
        ${c.notes ? html`<${React.Fragment}>
          <${UI.Micro} plain>notes<//>
          <div class="small" style=${{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>${String(c.notes)}</div>
        <//>` : null}

        <hr class="hair" style=${{margin: '4px 0'}}/>
        <${UI.Micro} plain>${sum.n} of ${evaluators.length} ${evalWord(evaluators.length)}<//>
        <div class="stack" id="hiring-evals">
          ${evaluators.length ? evaluators.map(u => {
            const e = evalOf(ctx, u, id);
            return html`<div key=${u} class="stack tight" id=${'hiring-eval-' + u}>
              <div class="row">
                <${UI.Avatar} id=${u} size=${28}/>
                <b>${nameIn(names, u)}</b>
                ${e ? html`<${UI.Pill} kind="ink">submitted ${U.timeAgo(e.at || 0)}<//>` : html`<${UI.Pill} kind="flame-o">not submitted<//>`}
              </div>
              ${e ? html`<${EvalView} e=${e}/>` : null}
            </div>`;
          }) : html`<${UI.Empty} text="No evaluators yet. Edit the candidate to pick the panel."/>`}
        </div>

        <hr class="hair" style=${{margin: '4px 0'}}/>
        <${UI.Micro} plain>summary<//>
        ${sum.n ? html`<${React.Fragment}>
          <div class="kpi-rail" id="hiring-avg">
            ${sum.avg.map(a => html`<div class="kpi" key=${a.k}><div class="v num">${a.avg == null ? '0.0' : a.avg}</div><div class="l">${a.short}</div></div>`)}
          </div>
          <div class="row" id="hiring-gwc">
            ${sum.gwc.map(g => html`<${UI.Pill} key=${g.k} kind=${g.n && g.yes === g.n ? 'ink' : 'flame-o'}>${g.label} ${g.yes} of ${g.n}<//>`)}
          </div>
          <div class="row small">
            <span><span class="sub">verdicts:</span> <span class="num" id="hiring-tally">${tallyText(sum.tally)}</span></span>
            <span><span class="sub">pod yes:</span> <span class="num">${sum.pod} of ${sum.n}</span></span>
          </div>
          <div class="grid2">
            <div class="stack tight" id="hiring-whys">
              <${UI.Micro} plain>reasons to hire<//>
              ${sum.whys.length ? sum.whys.map(w => html`<div key=${w.uid} class="small" style=${{overflowWrap: 'anywhere'}}>${w.text} <span class="sub">· ${nameIn(names, w.uid)}</span></div>`)
                : html`<${UI.Empty} text="None given."/>`}
            </div>
            <div class="stack tight" id="hiring-risks">
              <${UI.Micro} plain>risks<//>
              ${sum.risks.length ? sum.risks.map(r => html`<div key=${r.uid} class="small" style=${{overflowWrap: 'anywhere'}}>${r.text} <span class="sub">· ${nameIn(names, r.uid)}</span></div>`)
                : html`<${UI.Empty} text="None given."/>`}
            </div>
          </div>
        <//>` : html`<${UI.Empty} text="No evaluations yet."/>`}

        <hr class="hair" style=${{margin: '4px 0'}}/>
        ${decision}
      </div>
    <//>`;
  }

  /* ---------- evaluator: assigned candidate card ---------- */
  function MyCard({c, ctx, onOpen}) {
    const e = evalOf(ctx, ctx.uid, c.id);
    const isDec = decided(c);
    return html`<button type="button" class="rowbtn" id=${'cand-' + c.id} style=${{fontWeight: 300}}
      aria-label=${'Open ' + (c.name || 'candidate')} onClick=${onOpen}>
      <div class="card stack tight">
        <div class="row between nowrap">
          <b class="grow">${c.name || 'Candidate'}</b>
          ${e ? html`<${UI.Pill} kind="ink">submitted<//>`
            : isDec ? html`<${StagePill} stage=${c.stage}/>`
            : html`<span class="row nowrap small flame-t"><span class="dotflame"/>evaluation due</span>`}
        </div>
        ${c.role ? html`<div class="sub small">${c.role}</div>` : null}
        <div class="row small num"><span class="sub">${dueText(c)}</span>${e && isDec ? html`<${StagePill} stage=${c.stage}/>` : null}</div>
      </div>
    </button>`;
  }

  /* ---------- evaluator: the evaluation drawer ---------- */
  const emptyEval = () => ({gwc: {g: '', w: '', c: ''}, s: {craft: 0, thinking: 0, comms: 0, ownership: 0, culture: 0}, pod: '', verdict: '', why: '', risk: ''});
  const fromEval = e => {
    const f = emptyEval();
    if (!e) return f;
    GWC.forEach(g => { const v = e.gwc && e.gwc[g.k]; if (yesNo(v)) f.gwc[g.k] = v; });
    CRITERIA.forEach(c => { const v = Number(e.s && e.s[c.k]); if (scoreOk(v)) f.s[c.k] = v; });
    if (yesNo(e.pod)) f.pod = e.pod;
    if (VERDICT_LABEL[e.verdict]) f.verdict = e.verdict;
    f.why = String(e.why || '');
    f.risk = String(e.risk || '');
    return f;
  };
  const complete = f => GWC.every(g => yesNo(f.gwc[g.k])) && CRITERIA.every(c => scoreOk(f.s[c.k]))
    && yesNo(f.pod) && !!VERDICT_LABEL[f.verdict] && !!f.why.trim() && !!f.risk.trim();

  function EvalDrawer({candidateId, onClose}) {
    const ctx = M.useCtx();
    const uid = ctx && ctx.uid;
    const c = ctx && candidateId ? candMap(ctx)[candidateId] : null;
    const mine = c && uid ? evalOf(ctx, uid, candidateId) : null;
    const seed = mine ? (mine.at || 0) : -1;
    const [f, setF] = useState(() => fromEval(mine));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setF(fromEval(mine)); setDirty(false); }, [candidateId]);
    /* the stored evaluation arrives or changes: refill the form while nothing has been typed */
    useEffect(() => { if (!dirty) setF(fromEval(mine)); }, [seed]);
    if (!ctx) return null;

    const upd = fn => { setDirty(true); setF(fn); };
    const setG = (k, v) => upd(x => ({...x, gwc: {...x.gwc, [k]: v}}));
    const setS = (k, v) => upd(x => ({...x, s: {...x.s, [k]: v}}));
    const set = k => v => upd(x => ({...x, [k]: v}));

    const submit = async () => {
      if (!complete(f) || busy || !c) return;
      setBusy(true);
      let ok = false;
      try {
        await ctx.W.merge('evals/' + uid, {e: {[candidateId]: {
          gwc: {g: f.gwc.g, w: f.gwc.w, c: f.gwc.c},
          s: {craft: f.s.craft, thinking: f.s.thinking, comms: f.s.comms, ownership: f.s.ownership, culture: f.s.culture},
          pod: f.pod, verdict: f.verdict, why: f.why.trim(), risk: f.risk.trim(), at: Date.now()
        }}});
        ok = true;
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
      if (ok) { setDirty(false); M.toast('Evaluation sent to Kaavish'); onClose(); }
    };

    if (!c) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Candidate">
        <${UI.Empty} text=${ctx.coll.candidates.ready ? 'This candidate is gone.' : 'Loading.'}/>
      <//>`;
    }
    const title = c.name || 'Candidate';
    const meta = html`<div class="sub small num">${c.role ? c.role + ' · ' : ''}${dueText(c)}</div>`;

    if (decided(c)) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${title} head=${html`<${StagePill} stage=${c.stage}/>`}>
        <div class="small" id="eval-decided"><b>Decided.</b> Your evaluation is on record with Kaavish.</div>
        ${meta}
        <${UI.Micro} plain>links<//>
        <${Links} c=${c}/>
        <hr class="hair" style=${{margin: '2px 0'}}/>
        <${UI.Micro} plain>your evaluation<//>
        ${mine ? html`<${EvalView} e=${mine}/>` : html`<${UI.Empty} text="You did not submit one."/>`}
      <//>`;
    }

    const footer = html`<${UI.Btn} disabled=${!complete(f) || busy} onClick=${submit}>Submit evaluation<//>`;
    const segRow = (q, seg) => html`<div class="row between nowrap" style=${{gap: '12px'}}>
      <span class="small">${q}</span><span style=${{flex: 'none'}}>${seg}</span>
    </div>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${title} footer=${footer}>
      <div class="small" id="eval-note">${NOTE}</div>
      ${meta}
      <${UI.Micro} plain>links<//>
      <${Links} c=${c}/>

      <hr class="hair" style=${{margin: '2px 0'}}/>
      <${UI.Micro} plain>gets it, wants it, capacity<//>
      ${GWC.map(g => html`<div key=${g.k}>${segRow(g.q, html`<${UI.Seg} sm options=${YESNO} value=${f.gwc[g.k]} onChange=${v => setG(g.k, v)} ariaLabel=${g.q}/>`)}</div>`)}

      <hr class="hair" style=${{margin: '2px 0'}}/>
      <${UI.Micro} plain>scores, 1 to 5<//>
      ${CRITERIA.map(cr => html`<div key=${cr.k}>${segRow(cr.label, html`<${UI.Seg} sm options=${SCORES} value=${f.s[cr.k]} onChange=${v => setS(cr.k, v)} ariaLabel=${cr.label}/>`)}</div>`)}

      <hr class="hair" style=${{margin: '2px 0'}}/>
      ${segRow(POD_Q, html`<${UI.Seg} sm options=${YESNO} value=${f.pod} onChange=${set('pod')} ariaLabel=${POD_Q}/>`)}
      <${UI.Field} label="verdict">
        <${UI.Seg} options=${VERDICTS} value=${f.verdict} onChange=${set('verdict')} ariaLabel="Verdict"/>
      <//>
      <${UI.Input} id="eval-why" label="one reason to hire" value=${f.why} onChange=${set('why')} placeholder="Required"/>
      <${UI.Input} id="eval-risk" label="one risk" value=${f.risk} onChange=${set('risk')} placeholder="Required"/>
      ${mine ? html`<div class="sub small">Submitted ${U.timeAgo(mine.at || 0)}. Submit again to replace it.</div>`
        : html`<div class="sub small">Every field is required. It stays editable until Kaavish decides.</div>`}
    <//>`;
  }

  /* ---------- page ---------- */
  function Hiring({id}) {
    const ctx = M.useCtx();
    const [drawer, setDrawer] = useState(null);
    const [openId, setOpenId] = useState(id || null);
    useEffect(() => { if (id) setOpenId(id); }, [id]);
    if (!ctx) return null;
    const list = candidatesOf(ctx);
    const ready = !!(ctx.coll.candidates && ctx.coll.candidates.ready);

    if (ctx.isFounder) {
      const open = list.filter(c => !decided(c)).length;
      return html`<${React.Fragment}>
        <${UI.PageHead} micro="team" title="Hiring">
          <${UI.Btn} onClick=${() => setDrawer({candidateId: null})}><${icons.plus}/>New candidate<//>
        <//>
        <${UI.Card} title="Candidates" id="hiring-list" action=${open ? html`<${UI.Pill}>${open} open<//>` : null}>
          ${list.length ? html`<div class="stack tight">
            ${list.map(c => html`<${CandidateCard} key=${c.id} c=${c} ctx=${ctx} selected=${c.id === id}/>`)}
          </div>` : html`<${UI.Empty} text=${ready ? 'No candidates yet.' : 'Loading.'}/>`}
        <//>
        ${id ? html`<${CandidateSection} key=${id} id=${id} onEdit=${() => setDrawer({candidateId: id})}/>` : null}
        ${drawer ? html`<${CandidateDrawer} candidateId=${drawer.candidateId} onClose=${() => setDrawer(null)}/>` : null}
      <//>`;
    }

    const mine = list.filter(c => evaluatorsOf(c).includes(ctx.uid));
    const due = assignedToMe(ctx).length;
    const close = () => { setOpenId(null); if (id) M.nav('#hiring'); };
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="team" title="Hiring"/>
      <${UI.Card} title="Your panel" id="hiring-mine" action=${due ? html`<${UI.Pill} kind="flame-o">${due} due<//>` : null}>
        ${mine.length ? html`<div class="stack tight">
          ${mine.map(c => html`<${MyCard} key=${c.id} c=${c} ctx=${ctx} onOpen=${() => setOpenId(c.id)}/>`)}
        </div>` : html`<${UI.Empty} text=${ready ? 'No evaluations assigned to you.' : 'Loading.'}/>`}
      <//>
      ${openId ? html`<${EvalDrawer} key=${openId} candidateId=${openId} onClose=${close}/>` : null}
    <//>`;
  }

  M.pages.Hiring = Hiring;
  M.parts.EvalDrawer = EvalDrawer;
  M.hiring = {panel, assignedToMe, STAGES, CRITERIA, GWC, VERDICTS, candidatesOf, summary};
})();
