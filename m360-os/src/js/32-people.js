/* module: people. Directory, person page, onboarding checklist, access register and offboarding
   (BRIEF 7.12, 7.17, 7.18). Everything shown is derived from ctx.coll at render time. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;

  const ONBOARD_TOTAL = 13;
  const NEW_HIRE_DAYS = 45;
  const KUDOS_SHOWN = 20;
  const EOD_SHOWN = 5;

  /* ---------- pure helpers ---------- */
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && U.ymd(U.parseYmd(s)) === s;
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const docOf = (ctx, name, uid) => collMap(ctx, name)[uid] || {};
  const hasKeys = o => !!o && typeof o === 'object' && Object.keys(o).length > 0;
  const nowDate = ctx => new Date((ctx && typeof ctx.now === 'number') ? ctx.now : Date.now());
  const todayOf = ctx => U.ymd(nowDate(ctx));
  const quarterNow = ctx => U.quarterId(nowDate(ctx));
  const acksOf = (ctx, uid) => docOf(ctx, 'acks', uid).s || {};
  const okState = s => (s === 'off' || s === 'done') ? s : 'on';
  /* rocks for one quarter, blanks dropped */
  const rocksOf = (ctx, uid, qid) => ((docOf(ctx, 'rocks', uid).q || {})[qid || quarterNow(ctx)] || [])
    .filter(r => r && String(r.text || '').trim());

  const ROCK_STATES = [
    {v: 'on', label: 'On track'},
    {v: 'off', label: 'Off track'},
    {v: 'done', label: 'Done'}
  ];
  const ROCK_PILL = {on: {kind: 'ink', label: 'on track'}, off: {kind: 'flame-o', label: 'off track'}, done: {kind: 'ink', label: 'done'}};
  const LADDER_KIND = {clear: 'ink', note: 'flame-o', warning: 'flame', exit: 'flame'};

  const STATUS = {
    office: {label: 'In office', kind: 'ink'},
    wfh: {label: 'WFH', kind: undefined},
    leave: {label: 'On leave', kind: 'warm'},
    none: {label: 'Not in yet', kind: undefined}
  };
  /* today's status pill. M.att may load later or never, so the checkin document is the fallback. */
  function statusOf(ctx, uid, ymd) {
    let s = null;
    const att = M.att;
    if (att && typeof att.dayStatus === 'function') {
      try { const r = att.dayStatus(ctx, uid, ymd); s = r ? r.status : null; } catch (e) { s = null; }
    }
    if (s == null) {
      if (typeof ctx.onLeave === 'function' && ctx.onLeave(uid, ymd)) s = 'leave';
      else {
        const e = (docOf(ctx, 'checkin', uid).days || {})[ymd];
        s = (e && (e.mode === 'office' || e.mode === 'wfh')) ? e.mode : 'none';
      }
    }
    return STATUS[s] || STATUS.none;
  }

  /* ---------- onboarding model ---------- */
  const AUTO_ITEMS = [
    {key: 'read-house-rules', label: 'Read House rules', done: (ctx, uid) => !!acksOf(ctx, uid)['house-rules']},
    {key: 'read-the-week', label: 'Read The week', done: (ctx, uid) => !!acksOf(ctx, uid)['the-week']},
    {key: 'read-ladder', label: 'Read The ladder', done: (ctx, uid) => !!acksOf(ctx, uid)['ladder']},
    {key: 'read-role', label: 'Read your role card', done: (ctx, uid) => !!acksOf(ctx, uid)['role-brand-strategist']},
    {key: 'first-checkin', label: 'First check-in', done: (ctx, uid) => hasKeys(docOf(ctx, 'checkin', uid).days)},
    {key: 'first-eod', label: 'First EOD line', done: (ctx, uid) => hasKeys(docOf(ctx, 'eod', uid).days)},
    {key: 'first-plan', label: 'First Monday outcomes', done: (ctx, uid) => hasKeys(docOf(ctx, 'plan', uid).weeks)},
    {key: 'rocks-set', label: 'Rocks set for the quarter', done: (ctx, uid) => rocksOf(ctx, uid).length > 0}
  ];
  const MANUAL_ITEMS = [
    {key: 'laptop', label: 'Working laptop confirmed'},
    {key: 'workspace', label: 'Google Workspace account active'},
    {key: 'groups', label: 'Added to client groups'},
    {key: 'access', label: 'Access register filled in'},
    {key: 'brief', label: 'First brief delivered'}
  ];
  /* [{key, label, done, manual}] in checklist order */
  function onboardItems(ctx, uid) {
    if (!ctx || !uid) return [];
    const done = docOf(ctx, 'onboard', uid).done || {};
    const out = AUTO_ITEMS.map(i => ({key: i.key, label: i.label, done: !!i.done(ctx, uid), manual: false}));
    for (const i of MANUAL_ITEMS) out.push({key: i.key, label: i.label, done: !!done[i.key], manual: true});
    return out;
  }
  function onboardingProgress(ctx, uid) {
    return {done: onboardItems(ctx, uid).filter(i => i.done).length, total: ONBOARD_TOTAL};
  }
  function isNewHire(ctx, uid) {
    const m = ctx && ctx.members && ctx.members[uid];
    if (!m || !okDate(m.joined)) return false;
    const d = U.daysBetween(m.joined, todayOf(ctx));
    return d >= 0 && d <= NEW_HIRE_DAYS;
  }

  /* ---------- access model ---------- */
  const KINDS = [
    {v: 'client group', label: 'Client group'},
    {v: 'drive folder', label: 'Drive folder'},
    {v: 'tool seat', label: 'Tool seat'},
    {v: 'social account', label: 'Social account'},
    {v: 'client login', label: 'Client login'},
    {v: 'other', label: 'Other'}
  ];
  const RISKS = [{v: 'normal', label: 'Normal'}, {v: 'high', label: 'High'}];
  /* [{id, name, kind, risk, xfer, added, by, revoked, revokedAt}] oldest first */
  function accessItems(ctx, uid) {
    const items = docOf(ctx, 'access', uid).items || {};
    return Object.keys(items)
      .filter(id => items[id] && typeof items[id] === 'object')
      .map(id => ({id, ...items[id]}))
      .sort((a, b) => (a.added || 0) - (b.added || 0) || String(a.id).localeCompare(String(b.id)));
  }
  const STEPS = [
    {key: 'drive', label: 'Drive file ownership transferred to a Mask360 account'},
    {key: 'groups', label: 'Removed from client groups'},
    {key: 'logins', label: 'Client-side logins rotated by the client owner'},
    {key: 'email', label: 'Email suspended and forwarded'},
    {key: 'handover', label: 'Handover document received'},
    {key: 'settlement', label: 'Full and final settlement released'},
    {key: 'letter', label: 'Relieving letter issued'},
    {key: 'roster', label: 'Removed from the roster'}
  ];

  /* kudos received by uid from every giver, newest first */
  function kudosFor(ctx, uid) {
    const out = [];
    const km = collMap(ctx, 'kudos');
    for (const giver of Object.keys(km)) {
      for (const k of ((km[giver] || {}).given || [])) {
        if (!k || k.to !== uid) continue;
        out.push({id: giver + ':' + (k.id || k.at || out.length), giver, why: String(k.why || ''), at: typeof k.at === 'number' ? k.at : 0});
      }
    }
    out.sort((a, b) => b.at - a.at);
    return out;
  }

  /* names resolved inside this module, so a name next to an avatar for the same id settles on the same render */
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
  const nameIn = (names, uid) => (names[uid] && names[uid].name) || 'Someone';

  /* ---------- small parts ---------- */
  const RockPill = ({state}) => {
    const p = ROCK_PILL[okState(state)];
    return html`<${UI.Pill} kind=${p.kind}>${p.label}<//>`;
  };
  /* a read-only checklist line, same look as UI.Check */
  const ReadCheck = ({label, checked}) => html`<label class="checkline"><input type="checkbox" checked=${!!checked} disabled/><span>${label}</span></label>`;
  const CountText = ({done, total}) => html`<span class="small num sub">${done} of ${total} done</span>`;

  /* ---------- directory ---------- */
  function Directory() {
    const ctx = M.useCtx();
    const today = todayOf(ctx);
    const list = ctx.activeMembers || [];
    const names = useNames(ctx, list.map(m => m.uid));
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="team" title="People"/>
      ${list.length ? html`<div class="grid2" id="people-grid">
        ${list.map(m => {
          const st = statusOf(ctx, m.uid, today);
          const line = [m.title, m.pod].filter(Boolean).join(' · ');
          const city = String(docOf(ctx, 'me', m.uid).city || '').trim();
          return html`<button key=${m.uid} type="button" class="rowbtn" onClick=${() => M.nav('#people/' + m.uid)}>
            <div class="card clickable">
              <div class="row nowrap">
                <${UI.Avatar} id=${m.uid} size=${40}/>
                <div class="grow">
                  <div class="row between nowrap"><b class="grow">${nameIn(names, m.uid)}</b><${UI.Pill} kind=${st.kind}>${st.label}<//></div>
                  <div class="tiny num sub">${m.empId || ''}</div>
                  ${line ? html`<div class="small sub">${line}</div>` : null}
                  ${city ? html`<div class="tiny sub person-city">${city}</div>` : null}
                </div>
              </div>
            </div>
          </button>`;
        })}
      </div>` : html`<${UI.Card}><${UI.Empty} text="Nobody on the roster yet."/><//>`}
    <//>`;
  }

  /* ---------- person page: overview ---------- */
  function RocksForm({ctx, uid, qid}) {
    const saved = rocksOf(ctx, uid, qid);
    const norm = list => JSON.stringify(list.map(r => ({id: r.id || '', text: String(r.text || '').trim(), state: okState(r.state)})));
    const savedKey = norm(saved);
    const fromSaved = () => [0, 1, 2].map(i => saved[i]
      ? {id: saved[i].id || '', text: String(saved[i].text || ''), state: okState(saved[i].state)}
      : {id: '', text: '', state: 'on'});
    const [draft, setDraft] = useState(fromSaved);
    const [busy, setBusy] = useState(false);
    /* the form follows the saved document until the person types */
    useEffect(() => { setDraft(fromSaved()); }, [savedKey]);
    const items = () => draft.filter(r => r.text.trim()).map(r => ({id: r.id || U.uid(), text: r.text.trim(), state: okState(r.state)}));
    const changed = norm(draft.filter(r => r.text.trim())) !== savedKey;
    const upd = (i, patch) => setDraft(d => d.map((r, j) => j === i ? {...r, ...patch} : r));
    const save = () => {
      if (!changed || busy) return;
      setBusy(true);
      ctx.W.merge('rocks/' + uid, {q: {[qid]: items()}})
        .then(() => M.toast('Saved'))
        .catch(() => {})
        .then(() => setBusy(false));
    };
    return html`<div class="stack">
      <div class="sub small">1 to 3 outcomes for the quarter. Keep each one to a line.</div>
      ${draft.map((r, i) => html`<div key=${i} class="stack tight">
        <${UI.Input} id=${'rock-' + (i + 1)} label=${'rock ' + (i + 1)} value=${r.text} placeholder="One outcome for the quarter"
          onChange=${v => upd(i, {text: v})}/>
        <div class="row"><${UI.Seg} sm options=${ROCK_STATES} value=${r.state} onChange=${v => upd(i, {state: v})} ariaLabel=${'Rock ' + (i + 1) + ' state'}/></div>
      </div>`)}
      <div class="row"><${UI.Btn} disabled=${!changed || busy} onClick=${save}>Save rocks<//></div>
    </div>`;
  }

  function Overview({uid}) {
    const ctx = M.useCtx();
    const qid = quarterNow(ctx);
    const mine = ctx.uid === uid;
    const rocks = rocksOf(ctx, uid, qid);
    const eodDays = docOf(ctx, 'eod', uid).days || {};
    const recent = Object.keys(eodDays).filter(okDate).sort().reverse().slice(0, EOD_SHOWN);
    const kudos = kudosFor(ctx, uid).slice(0, KUDOS_SHOWN);
    const names = useNames(ctx, kudos.map(k => k.giver));
    return html`<${React.Fragment}>
      <${UI.Card} title=${'Rocks, ' + qid} id="person-rocks">
        ${mine ? html`<${RocksForm} ctx=${ctx} uid=${uid} qid=${qid}/>`
          : (rocks.length ? rocks.map((r, i) => html`<div class="listrow" key=${r.id || i}>
              <span class="grow">${r.text}</span><${RockPill} state=${r.state}/>
            </div>`) : html`<${UI.Empty} text="No rocks set for this quarter."/>`)}
      <//>
      <div class="grid2">
        <${UI.Card} title="Recent EOD lines" id="person-eod">
          ${recent.length ? recent.map(d => html`<div class="listrow" key=${d}>
            <div class="grow">
              <div class="tiny num sub">${U.fmtDay(d)}</div>
              <div>${String((eodDays[d] && eodDays[d].shipped) || '')}</div>
            </div>
          </div>`) : html`<${UI.Empty} text="No EOD lines yet."/>`}
        <//>
        <${UI.Card} title="Kudos received" id="person-kudos">
          ${kudos.length ? kudos.map(k => html`<div class="listrow" key=${k.id} style=${{alignItems: 'flex-start'}}>
            <${UI.Avatar} id=${k.giver} size=${28}/>
            <div class="grow">
              <div class="row"><b>${nameIn(names, k.giver)}</b>${k.at ? html`<span class="tiny sub">${U.timeAgo(k.at)}</span>` : null}</div>
              <div>${k.why}</div>
            </div>
          </div>`) : html`<${UI.Empty} text="No kudos yet."/>`}
        <//>
      </div>
    <//>`;
  }

  /* ---------- person page: scorecard ---------- */
  function Scorecard({uid}) {
    const ctx = M.useCtx();
    const now = nowDate(ctx);
    const mon0 = U.mondayOf(now);
    const P = M.points;
    const rows = [0, 1, 2, 3].map(i => {
      const mon = U.addDays(mon0, -7 * i);
      let s = null;
      if (P && typeof P.scoreFor === 'function') {
        try { s = P.scoreFor(ctx, uid, mon); } catch (e) { s = null; }
      }
      return {week: U.isoWeek(mon), s};
    });
    const num = (v, suffix) => (typeof v === 'number' && isFinite(v)) ? v + (suffix || '') : 'n/a';
    const hitText = s => {
      if (!s) return 'n/a';
      const t = (s.hit || 0) + (s.miss || 0);
      return t > 0 ? (s.hit || 0) + ' of ' + t : 'n/a';
    };
    let lad = null;
    if (P && typeof P.ladder === 'function') {
      try { lad = P.ladder(ctx, uid, now); } catch (e) { lad = null; }
    }
    const misses = lad ? (lad.misses || 0) : 0;
    return html`<${React.Fragment}>
      <${UI.Card} title="Scorecard, last 4 weeks" id="scorecard">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>week</th><th>on time</th><th>revisions per task</th><th>quality</th><th>outcomes hit</th></tr></thead>
          <tbody>
            ${rows.map(r => html`<tr key=${r.week}>
              <td class="num">${r.week}</td>
              <td class="num">${num(r.s && r.s.onTimePct, '%')}</td>
              <td class="num">${num(r.s && r.s.revPerTask)}</td>
              <td class="num">${num(r.s && r.s.quality)}</td>
              <td class="num">${hitText(r.s)}</td>
            </tr>`)}
          </tbody>
        </table></div>
      <//>
      <${UI.Card} title="Ladder, last 30 days" id="ladder">
        ${lad ? html`<div class="row">
          <${UI.Pill} kind=${LADDER_KIND[lad.level] || 'flame-o'}>${lad.level}<//>
          <span class="small num">${misses} ${misses === 1 ? 'miss' : 'misses'} in the last 30 days</span>
        </div>` : html`<${UI.Empty} text="n/a"/>`}
      <//>
    <//>`;
  }

  /* ---------- onboarding ---------- */
  function Onboarding({uid, compact}) {
    const ctx = M.useCtx();
    if (!ctx || !uid) return null;
    const items = onboardItems(ctx, uid);
    const done = items.filter(i => i.done).length;
    const self = ctx.uid === uid;
    const doneMap = docOf(ctx, 'onboard', uid).done || {};
    const toggle = (key, on) => {
      if (on) { ctx.W.merge('onboard/' + uid, {done: {[key]: Date.now()}}).catch(() => {}); return; }
      const map = U.clone(doneMap) || {};
      delete map[key];
      ctx.W.set('onboard/' + uid, {done: map}).catch(() => {});
    };
    const count = html`<${CountText} done=${done} total=${ONBOARD_TOTAL}/>`;
    if (compact) {
      const open = items.filter(i => !i.done).slice(0, 3);
      return html`<${UI.Card} title="Onboarding" id="onboarding" action=${count}>
        <div class="stack tight">
          <${UI.Bar} a=${done} max=${ONBOARD_TOTAL}/>
          ${open.length ? open.map(i => html`<div key=${i.key} class="row nowrap small"><span class="dotflame"/><span>${i.label}</span></div>`)
            : html`<div class="sub small">All 13 done.</div>`}
        </div>
      <//>`;
    }
    const line = i => (i.manual && self)
      ? html`<${UI.Check} key=${i.key} label=${i.label} checked=${i.done} onChange=${on => toggle(i.key, on)}/>`
      : html`<${ReadCheck} key=${i.key} label=${i.label} checked=${i.done}/>`;
    return html`<${UI.Card} title="Onboarding" id="onboarding" action=${count}>
      <div class="stack">
        <${UI.Bar} a=${done} max=${ONBOARD_TOTAL}/>
        <div class="stack tight">
          <${UI.Micro} plain>from the data<//>
          ${items.filter(i => !i.manual).map(line)}
        </div>
        <div class="stack tight">
          <${UI.Micro} plain>${self ? 'tick these yourself' : 'ticked by hand'}<//>
          ${items.filter(i => i.manual).map(line)}
        </div>
      </div>
    <//>`;
  }

  /* ---------- access register ---------- */
  function AccessRegister({uid}) {
    const ctx = M.useCtx();
    const [name, setName] = useState('');
    const [kind, setKind] = useState(KINDS[0].v);
    const [risk, setRisk] = useState('normal');
    const [xfer, setXfer] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!ctx || !uid) return null;
    const items = accessItems(ctx, uid);
    const canAdd = ctx.uid === uid || !!ctx.isFounder;
    const canSend = !!name.trim() && !busy;
    const add = () => {
      if (!canSend) return;
      setBusy(true);
      const id = U.uid();
      const item = {name: name.trim(), kind, risk, xfer: !!xfer, added: Date.now(), by: ctx.uid, revoked: false, revokedAt: null};
      ctx.W.merge('access/' + uid, {items: {[id]: item}})
        .then(() => { M.toast('Added'); setName(''); setRisk('normal'); setXfer(false); })
        .catch(() => {})
        .then(() => setBusy(false));
    };
    const revoke = id => {
      ctx.W.update('access/' + uid, {items: {[id]: {revoked: true, revokedAt: Date.now()}}})
        .then(() => M.toast('Marked revoked')).catch(() => {});
    };
    const open = items.filter(i => !i.revoked).length;
    return html`<${UI.Card} title="Access register" id="access-register"
        action=${items.length ? html`<${UI.Pill}>${open} open<//>` : null}>
      <div class="stack">
        ${items.length ? html`<div>
          ${items.map(it => html`<div class="listrow" key=${it.id}>
            <div class="grow">
              <div style=${it.revoked ? {textDecoration: 'line-through'} : null}>${String(it.name || '')}</div>
              <div class="row" style=${{marginTop: '4px'}}>
                <${UI.Pill}>${String(it.kind || 'other')}<//>
                ${it.risk === 'high' ? html`<${UI.Pill} kind="flame">high<//>` : null}
                ${it.xfer ? html`<${UI.Pill}>transfer<//>` : null}
                ${it.revoked ? html`<${UI.Pill} kind="warm">revoked<//>` : null}
              </div>
            </div>
            ${!it.revoked && ctx.isFounder ? html`<${UI.Btn} kind="ghost" sm onClick=${() => revoke(it.id)}>Mark revoked<//>` : null}
          </div>`)}
        </div>` : html`<${UI.Empty} text="No access items yet."/>`}
        ${canAdd ? html`<${React.Fragment}>
          <hr class="hair" style=${{margin: '2px 0'}}/>
          <${UI.Input} id="access-name" label="name" value=${name} onChange=${setName} onEnter=${add}
            placeholder="Swisse client WhatsApp group" hint="Names only. Never passwords or codes."/>
          <div class="grid2">
            <${UI.Select} id="access-kind" label="kind" value=${kind} onChange=${setKind} options=${KINDS}/>
            <${UI.Field} label="risk">
              <div class="row"><${UI.Seg} sm options=${RISKS} value=${risk} onChange=${setRisk} ariaLabel="Risk"/></div>
            <//>
          </div>
          <${UI.Check} label="Ownership transfer needed" checked=${xfer} onChange=${setXfer}/>
          <div class="row"><${UI.Btn} disabled=${!canSend} onClick=${add}>Add item<//></div>
        <//>` : null}
      </div>
    <//>`;
  }

  /* ---------- offboarding ---------- */
  function StartOffboarding({uid}) {
    const ctx = M.useCtx();
    const [lastDay, setLastDay] = useState('');
    const ok = okDate(lastDay);
    const start = () => {
      ctx.W.merge('access/' + uid, {offboard: {started: Date.now(), lastDay, steps: {}}})
        .then(() => M.toast('Offboarding started')).catch(() => {});
    };
    return html`<${UI.Card} title="Start offboarding" id="start-offboarding">
      <div class="stack">
        <${UI.Input} id="offboard-lastday" label="last working day" type="date" value=${lastDay} onChange=${setLastDay}/>
        <div class="row">
          ${ok ? html`<${UI.ConfirmBtn} kind="sec" sm=${false} onConfirm=${start}>Start offboarding<//>`
            : html`<${UI.Btn} kind="sec" disabled>Start offboarding<//>`}
        </div>
        <div class="sub small">The checklist replaces onboarding on this page. History stays.</div>
      </div>
    <//>`;
  }

  function Offboarding({uid}) {
    const ctx = M.useCtx();
    if (!ctx || !uid) return null;
    const doc = docOf(ctx, 'access', uid);
    const ob = doc.offboard;
    if (!ob) return html`<${UI.Card} title="Offboarding" id="offboarding"><${UI.Empty} text="Offboarding has not started."/><//>`;
    const steps = ob.steps || {};
    const started = typeof ob.started === 'number' ? ob.started : 0;
    const founder = !!ctx.isFounder;
    const member = ctx.members[uid];
    const active = !!member && member.active !== false;
    /* every item open when offboarding began stays on the list, ticked once revoked */
    const items = accessItems(ctx, uid).filter(it => !it.revoked || !!steps['item:' + it.id] || (typeof it.revokedAt === 'number' && it.revokedAt >= started));
    const lines = items.map(it => ({key: 'item:' + it.id, label: 'Revoke or transfer: ' + String(it.name || ''), done: !!it.revoked || !!steps['item:' + it.id], item: it.id}))
      .concat(STEPS.map(s => ({key: s.key, label: s.label, done: !!steps[s.key], item: null})));
    const done = lines.filter(l => l.done).length;
    const total = lines.length;

    const untick = line => {
      const next = U.clone(doc) || {};
      next.offboard = next.offboard || {};
      next.offboard.steps = next.offboard.steps || {};
      delete next.offboard.steps[line.key];
      if (line.item && next.items && next.items[line.item]) { next.items[line.item].revoked = false; next.items[line.item].revokedAt = null; }
      ctx.W.set('access/' + uid, next).catch(() => {});
    };
    const toggle = (line, on) => {
      if (!on) { untick(line); return; }
      const at = Date.now();
      if (line.item) {
        ctx.W.update('access/' + uid, {items: {[line.item]: {revoked: true, revokedAt: at}}, offboard: {steps: {[line.key]: at}}}).catch(() => {});
      } else {
        ctx.W.merge('access/' + uid, {offboard: {steps: {[line.key]: at}}}).catch(() => {});
      }
    };
    const finish = () => {
      ctx.W.update('roster/team', {members: {[uid]: {active: false}}, updated: Date.now()})
        .then(() => M.toast('Offboarding finished')).catch(() => {});
    };
    return html`<${UI.Card} title="Offboarding" id="offboarding" action=${html`<${CountText} done=${done} total=${total}/>`}>
      <div class="stack">
        <div class="row between">
          <div class="small">Last working day: <span class="num">${okDate(ob.lastDay) ? U.fmtDate(ob.lastDay) : 'n/a'}</span></div>
          ${active ? null : html`<${UI.Pill} kind="warm">off the roster<//>`}
        </div>
        <${UI.Bar} a=${done} max=${total}/>
        <div class="stack tight">
          ${lines.map(l => founder
            ? html`<${UI.Check} key=${l.key} label=${l.label} checked=${l.done} onChange=${on => toggle(l, on)}/>`
            : html`<${ReadCheck} key=${l.key} label=${l.label} checked=${l.done}/>`)}
        </div>
        ${founder && active ? html`<div class="row">
          <${UI.ConfirmBtn} kind="sec" sm=${false} onConfirm=${finish}>Finish offboarding<//>
          <span class="sub small">Sets the roster entry to inactive. History stays.</span>
        </div>` : null}
      </div>
    <//>`;
  }

  /* ---------- person page ---------- */
  function Person({uid}) {
    const ctx = M.useCtx();
    const [tab, setTab] = useState('overview');
    const names = useNames(ctx, [uid]);
    const m = ctx.members[uid];
    const back = html`<${UI.Btn} kind="sec" sm onClick=${() => M.nav('#people')}>All people<//>`;
    if (!m) {
      return html`<${React.Fragment}>
        <${UI.PageHead} micro="team" title="People">${back}<//>
        <${UI.Card}><${UI.Empty} text="Nobody with this id on the roster."/><//>
      <//>`;
    }
    const canSee = !!ctx.canSee(uid);
    const offboarding = !!docOf(ctx, 'access', uid).offboard;
    const opts = [{v: 'overview', label: 'Overview'}];
    if (canSee) {
      opts.push({v: 'scorecard', label: 'Scorecard'}, {v: 'access', label: 'Access'},
        {v: 'board', label: offboarding ? 'Offboarding' : 'Onboarding'});
    }
    const cur = opts.some(o => o.v === tab) ? tab : 'overview';
    const inactive = m.active === false;
    const st = statusOf(ctx, uid, todayOf(ctx));
    const isFounderMember = m.role === 'founder' || uid === ctx.founderUid;
    const line = [m.title, m.pod].filter(Boolean).join(' · ');
    /* what the person chose to share on Me: pronouns, city, bio, links. Private detail stays with canSee. */
    const prof = docOf(ctx, 'me', uid);
    const pronouns = String(prof.pronouns || '').trim();
    const city = String(prof.city || '').trim();
    const Details = M.parts.ProfileDetails;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="team" title="People">${back}<//>
      <${UI.Card} id="person-head">
        <div class="row nowrap" style=${{alignItems: 'flex-start'}}>
          <${UI.Avatar} id=${uid} size=${56}/>
          <div class="grow stack tight" style=${{gap: '3px'}}>
            <div class="row">
              <h2 class="card-title">${nameIn(names, uid)}</h2>
              ${pronouns ? html`<span class="small sub prof-pn" id="person-pronouns">${pronouns}</span>` : null}
              ${inactive ? html`<${UI.Pill} kind="warm">off the roster<//>` : html`<${UI.Pill} kind=${st.kind}>${st.label}<//>`}
              ${!inactive && isNewHire(ctx, uid) ? html`<${UI.Pill} kind="warm">new hire<//>` : null}
            </div>
            <div class="small sub"><span class="num">${m.empId || ''}</span>${line ? (m.empId ? ' · ' : '') + line : ''}</div>
            <div class="small sub">${okDate(m.joined) ? 'Joined ' + U.fmtDate(m.joined) : 'Joined date missing'}${city ? html`<span> · <span id="person-city">${city}</span></span>` : null}</div>
            ${Details ? html`<${Details} uid=${uid}/>` : null}
          </div>
        </div>
      <//>
      ${opts.length > 1 ? html`<div class="row"><${UI.Seg} options=${opts} value=${cur} onChange=${setTab} ariaLabel="Person sections"/></div>` : null}
      ${cur === 'overview' ? html`<${Overview} uid=${uid}/>` : null}
      ${cur === 'scorecard' ? html`<${Scorecard} uid=${uid}/>` : null}
      ${cur === 'access' ? html`<${AccessRegister} uid=${uid}/>` : null}
      ${cur === 'board' && !offboarding ? html`<${React.Fragment}>
        <${Onboarding} uid=${uid}/>
        ${ctx.isFounder && !isFounderMember && !inactive ? html`<${StartOffboarding} uid=${uid}/>` : null}
      <//>` : null}
      ${cur === 'board' && offboarding ? html`<${Offboarding} uid=${uid}/>` : null}
    <//>`;
  }

  function People({id}) {
    if (!id) return html`<${Directory}/>`;
    return html`<${Person} key=${id} uid=${id}/>`;
  }

  M.pages.People = People;
  M.parts.Onboarding = Onboarding;
  M.parts.AccessRegister = AccessRegister;
  M.parts.Offboarding = Offboarding;
  M.people = {isNewHire, onboardingProgress, onboardItems, accessItems, kudosFor, statusOf,
    AUTO_ITEMS, MANUAL_ITEMS, STEPS, KINDS, ONBOARD_TOTAL};
})();
