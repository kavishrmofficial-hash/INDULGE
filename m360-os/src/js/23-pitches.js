/* module: pitches */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;

  /* stages in board order, each with its default probability in percent */
  const STAGES = [
    {v: 'lead', label: 'Lead', prob: 10},
    {v: 'qualified', label: 'Qualified', prob: 25},
    {v: 'diagnostic', label: 'Diagnostic', prob: 40},
    {v: 'proposal', label: 'Proposal sent', prob: 55},
    {v: 'negotiation', label: 'Negotiation', prob: 75},
    {v: 'won', label: 'Won', prob: 100},
    {v: 'lost', label: 'Lost', prob: 0}
  ];
  const STAGE_OF = {};
  STAGES.forEach(s => { STAGE_OF[s.v] = s; });
  const STAGE_OPTS = STAGES.map(s => ({v: s.v, label: s.label}));
  const OPEN_STAGES = STAGES.filter(s => s.v !== 'won' && s.v !== 'lost');
  const DAY = 86400000;

  const stageOf = p => STAGE_OF[p && p.stage] || STAGE_OF.lead;
  const isClosed = p => { const v = stageOf(p).v; return v === 'won' || v === 'lost'; };
  const isOverdue = (p, today) => !isClosed(p) && !!p.nextDate && p.nextDate < today;

  /* the founder's private finance entries per pitch: {[id]: {value, prob}}; empty for everyone else */
  const financePath = ctx => 'data/users/' + ctx.uid + '/finance';
  const financeOf = ctx => {
    const d = ctx.priv && ctx.priv.finance && ctx.priv.finance.data;
    return (d && d.pitch) || {};
  };
  const valueOf = fe => { const n = Number(fe && fe.value); return isFinite(n) && n > 0 ? n : 0; };
  const hasProb = fe => fe && fe.prob !== null && fe.prob !== undefined && fe.prob !== '' && isFinite(Number(fe.prob));
  /* the probability override when set, else the stage default */
  const probOf = (p, fe) => hasProb(fe) ? Math.max(0, Math.min(100, Number(fe.prob))) : stageOf(p).prob;

  /* Weighted pipeline sums open pitches only. Won and lost pitches sit outside the pipeline, so they add 0 here;
     their value still shows under byStage.won.value and byStage.lost.value. */
  function metrics(ctx) {
    const map = (ctx.coll && ctx.coll.pitches && ctx.coll.pitches.map) || {};
    const fin = financeOf(ctx);
    const today = U.todayStr();
    const cut = (ctx.now || Date.now()) - 90 * DAY;
    const byStage = {};
    STAGES.forEach(s => { byStage[s.v] = {count: 0, value: 0}; });
    let weighted = 0, won = 0, lost = 0;
    const overdue = [];
    for (const id of Object.keys(map)) {
      const p = map[id];
      const st = stageOf(p).v;
      const fe = fin[id];
      const value = valueOf(fe);
      byStage[st].count += 1;
      byStage[st].value += value;
      if (st === 'won' || st === 'lost') {
        if ((p.stageAt || 0) >= cut) { if (st === 'won') won += 1; else lost += 1; }
        continue;
      }
      weighted += value * probOf(p, fe) / 100;
      if (isOverdue(p, today)) overdue.push(id);
    }
    const winRate90 = (won + lost) > 0 ? Math.round(100 * won / (won + lost)) : null;
    return {weighted: Math.round(weighted), byStage, winRate90, overdue};
  }

  /* soonest next date first, then the freshest stage change */
  const nextKey = p => p.nextDate || '9999-99-99';
  const sortCol = (a, b) => {
    const ka = nextKey(a), kb = nextKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (b.stageAt || 0) - (a.stageAt || 0);
  };

  const daysText = n => n === 1 ? '1 day in stage' : n + ' days in stage';

  /* the client page whose name matches this brand, when one exists */
  const clientFor = (ctx, brand) => {
    const map = ctx.coll.clients.map;
    const key = String(brand || '').trim().toLowerCase();
    if (!key) return null;
    return Object.keys(map).find(id => String(map[id].name || '').trim().toLowerCase() === key) || null;
  };

  /* ---------- founder metrics bar ---------- */
  function Tile({id, v, l, flame}) {
    return html`<${UI.Card} id=${id}><div class="kpi">
      <div class=${'v num' + (flame ? ' flame-t' : '')}>${v}</div>
      <div class="l">${l}</div>
    </div><//>`;
  }

  function MetricsBar({m}) {
    const inPlay = OPEN_STAGES.reduce((n, s) => n + m.byStage[s.v].count, 0);
    const od = m.overdue.length;
    return html`<${React.Fragment}>
      <div class="kpi-rail">
        <${Tile} id="kpi-weighted" v=${U.inr(m.weighted)} l="weighted pipeline"/>
        <${Tile} id="kpi-open" v=${inPlay} l="pitches in play"/>
        <${Tile} id="kpi-win" v=${m.winRate90 == null ? 'no data' : m.winRate90 + '%'} l="win rate, 90 days"/>
        <${Tile} id="kpi-overdue" v=${od} l="next steps overdue" flame=${od > 0}/>
      </div>
      <${UI.Card} title="Count by stage" id="stage-counts">
        <div class="row">
          ${STAGES.map(s => html`<${UI.Pill} key=${s.v} kind=${m.byStage[s.v].count ? 'warm' : undefined}>
            ${s.label} <span class="num">${m.byStage[s.v].count}</span><//>`)}
        </div>
      <//>
    <//>`;
  }

  /* ---------- board ---------- */
  function PitchCard({p, fe, founder, today, now, onOpen}) {
    const days = Math.max(0, Math.floor((now - (p.stageAt || p.created || now)) / DAY));
    const od = isOverdue(p, today);
    const value = founder ? valueOf(fe) : 0;
    return html`<button type="button" class="tcard" style=${{fontWeight: 300}} data-pitch=${p.id}
      aria-label=${'Open ' + (p.brand || 'pitch')} onClick=${() => onOpen(p.id)}>
      <span class="t">${p.brand || 'Untitled'}</span>
      ${p.category ? html`<span class="small sub">${p.category}</span>` : null}
      <span class="row between nowrap">
        <span class="row nowrap"><${UI.Avatar} id=${p.owner} size=${22}/><span class="tiny num sub">${daysText(days)}</span></span>
        ${value > 0 ? html`<span class="small num">${U.inr(value)}</span>` : null}
      </span>
      ${(p.next || p.nextDate) ? html`<span class="row between nowrap">
        <span class="small grow" style=${{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>${p.next || 'Next step'}</span>
        ${p.nextDate ? html`<span class=${'tiny num' + (od ? ' flame-t' : ' sub')}>${U.fmtDay(p.nextDate)}</span>` : null}
      </span>` : null}
    </button>`;
  }

  function Board({ctx, all, fin, onOpen}) {
    const today = U.todayStr();
    const now = ctx.now || Date.now();
    return html`<${UI.Card}><div class="board-wrap"><div class="board">
      ${STAGES.map(s => {
        const list = all.filter(p => stageOf(p).v === s.v).sort(sortCol);
        return html`<div class="colm" key=${s.v} data-stage=${s.v}>
          <div class="col-head"><span>${s.label}</span><span class="num">${list.length}</span></div>
          ${list.length ? list.map(p => html`<${PitchCard} key=${p.id} p=${p} fe=${fin[p.id]} founder=${ctx.isFounder} today=${today} now=${now} onOpen=${onOpen}/>`)
            : html`<div style=${{padding: '2px 6px'}}><${UI.Empty} text="No pitches"/></div>`}
        </div>`;
      })}
    </div></div><//>`;
  }

  /* ---------- drawer ---------- */
  function PitchDrawer({pitchId, onClose}) {
    const ctx = M.useCtx();
    const {W} = ctx;
    const isNew = !pitchId;
    const pitch = pitchId ? ctx.coll.pitches.map[pitchId] : null;
    const finReady = !!(ctx.priv && ctx.priv.finance && ctx.priv.finance.ready);
    const fe = pitchId ? financeOf(ctx)[pitchId] : null;

    /* pitch.contact holds a Base contact id when one is picked, else a typed name and role */
    const baseContact = cid => (cid && M.search && M.search.contactById) ? M.search.contactById(ctx, cid) : null;
    const blank = () => ({brand: '', category: '', contact: '', contactId: '', source: '', stage: 'lead', owner: ctx.uid,
      next: '', nextDate: '', lost: '', value: '', prob: ''});
    const fromDoc = (p, e) => ({
      brand: p.brand || '', category: p.category || '', contact: baseContact(p.contact) ? '' : (p.contact || ''), contactId: baseContact(p.contact) ? p.contact : '',
      source: p.source || '',
      stage: stageOf(p).v, owner: p.owner || ctx.uid, next: p.next || '', nextDate: p.nextDate || '', lost: p.lost || '',
      value: valueOf(e) > 0 ? String(valueOf(e)) : '', prob: hasProb(e) ? String(Number(e.prob)) : ''
    });
    const [f, setF] = useState(() => pitch ? fromDoc(pitch, fe) : blank());
    const [busy, setBusy] = useState(false);
    useEffect(() => {
      const p = pitchId ? ctx.coll.pitches.map[pitchId] : null;
      setF(p ? fromDoc(p, pitchId ? financeOf(ctx)[pitchId] : null) : blank());
      setBusy(false);
    }, [pitchId, finReady]);
    const set = k => v => setF(x => ({...x, [k]: v}));

    const memberIds = useMemo(() => {
      const ids = ctx.activeMembers.map(m => m.uid);
      if (!ids.includes(ctx.uid)) ids.unshift(ctx.uid);
      if (pitch && pitch.owner && !ids.includes(pitch.owner)) ids.push(pitch.owner);
      return ids;
    }, [ctx.activeMembers, ctx.uid, pitch && pitch.owner]);
    const profs = M.useProfiles(memberIds);
    const ownerOpts = memberIds.map(u => ({v: u, label: (profs[u] && profs[u].name) || 'Someone'}));

    const project = pitch && pitch.project ? ctx.coll.projects.map[pitch.project] : null;
    const projects = M.projects;
    const canCreateProject = !!(projects && typeof projects.create === 'function');
    const clientId = pitch ? clientFor(ctx, pitch.brand) : null;
    const canSave = !!f.brand.trim() && !busy;

    /* contacts from the Base: the ones at this pitch's client company when it is linked, else everyone */
    const contactOpts = useMemo(() => {
      if (!M.search || !M.search.contacts) return [];
      const all = M.search.contacts(ctx);
      const cid = clientFor(ctx, f.brand);
      const org = cid ? M.search.orgOfClient(ctx, cid) : null;
      const list = org ? all.filter(c => c.org === org.id) : all;
      return list.map(c => ({v: c.id, label: M.search.nameOf(c) + (c.title ? ', ' + c.title : '') + (!org && c.orgName ? ' (' + c.orgName + ')' : '')}))
        .sort((a, b) => a.label.localeCompare(b.label)).slice(0, 200);
    }, [ctx.coll.contacts, ctx.coll.orgs, ctx.coll.clients, f.brand]);

    const save = () => {
      if (!canSave) return;
      setBusy(true);
      const now = Date.now();
      const id = isNew ? U.uid() : pitchId;
      const orgMatch = (M.base && M.base.all) ? (M.base.all(ctx).orgs || []).find(o => !o.archived && String(o.name || '').trim().toLowerCase() === f.brand.trim().toLowerCase()) : null;
      const body = {brand: f.brand.trim(), category: f.category.trim(), contact: f.contactId || f.contact.trim(),
        source: f.source.trim(), owner: f.owner || ctx.uid, updated: now, ...(orgMatch ? {org: orgMatch.id} : {})};
      let p;
      if (isNew) {
        p = W.set('pitches/' + id, {...body, stage: 'lead', stageAt: now, next: '', nextDate: '', project: '', lost: '', created: now});
      } else {
        p = W.update('pitches/' + id, {...body, stage: f.stage,
          stageAt: f.stage !== stageOf(pitch).v ? now : (pitch.stageAt || now),
          next: f.next.trim(), nextDate: f.nextDate || '', lost: f.lost.trim()});
      }
      if (ctx.isFounder && (fe || f.value !== '' || f.prob !== '')) {
        const probNum = f.prob === '' ? null : Math.max(0, Math.min(100, Number(f.prob) || 0));
        const entry = {value: Math.max(0, Number(f.value) || 0), prob: probNum};
        p = p.then(() => W.merge(financePath(ctx), {pitch: {[id]: entry}}));
      }
      p.then(() => { M.toast(isNew ? 'Pitch created' : 'Saved'); onClose(); }, () => setBusy(false));
    };

    const startProject = () => {
      if (!canCreateProject || busy || !pitch) return;
      setBusy(true);
      const pid = projects.create(ctx, {name: (pitch.brand || 'Pitch') + ' pitch', kind: 'pitch', template: 'pitch',
        pitch: pitchId, owner: pitch.owner || ctx.uid});
      Promise.all([
        W.update('pitches/' + pitchId, {project: pid, updated: Date.now()}),
        W.update('projects/' + pid, {pitch: pitchId})
      ]).then(() => { M.toast('Pitch project started'); setBusy(false); }, () => setBusy(false));
    };

    const createClient = () => {
      if (busy || !pitch) return;
      setBusy(true);
      const cid = U.uid(), now = Date.now();
      let p = W.set('clients/' + cid, {name: pitch.brand || 'Client', status: 'live', pod: '', owner: pitch.owner || ctx.uid,
        memory: '', approvals: '', never: '', links: '', updated: now, by: ctx.uid});
      /* the founder's private monthly revenue starts from the pitch value */
      if (ctx.isFounder && valueOf(fe) > 0) p = p.then(() => W.merge(financePath(ctx), {clients: {[cid]: {monthly: valueOf(fe)}}}));
      p.then(() => { M.toast('Client page created'); onClose(); M.nav('#clients'); }, () => setBusy(false));
    };

    const createRetainer = () => {
      if (!canCreateProject || busy || !pitch) return;
      setBusy(true);
      const pid = projects.create(ctx, {name: (pitch.brand || 'Client') + ' retainer', kind: 'client', template: 'retainer',
        client: clientId || '', owner: pitch.owner || ctx.uid});
      M.toast('Retainer project created');
      onClose();
      M.nav('#projects/' + pid);
    };

    if (!isNew && !pitch) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Pitch">
        <${UI.Empty} text=${ctx.coll.pitches.ready ? 'This pitch is gone.' : 'Loading the pitch.'}/>
      <//>`;
    }

    const won = !!pitch && stageOf(pitch).v === 'won';
    const actions = isNew ? null : html`<div class="grow row">
      ${!pitch.project ? html`<${UI.Btn} kind="sec" sm disabled=${!canCreateProject || busy} onClick=${startProject}>Start pitch project<//>` : null}
      ${won ? (clientId
        ? html`<${UI.Btn} kind="sec" sm onClick=${() => M.nav('#clients/' + clientId)}><${icons.link}/>Open client page<//>`
        : html`<${UI.Btn} kind="sec" sm disabled=${busy} onClick=${createClient}>Create client page<//>`) : null}
      ${won ? html`<${UI.Btn} kind="sec" sm disabled=${!canCreateProject || busy} onClick=${createRetainer}>Create retainer project<//>` : null}
    </div>`;
    const footer = html`<${React.Fragment}>
      ${actions}
      <${UI.Btn} disabled=${!canSave} onClick=${save}>${isNew ? 'Create pitch' : 'Save'}<//>
    <//>`;
    const stagePill = pitch ? html`<${UI.Pill} kind=${won ? 'ink' : stageOf(pitch).v === 'lost' ? 'flame' : undefined}>${stageOf(pitch).label}<//>` : null;
    const stageProb = stageOf({stage: f.stage}).prob;

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New pitch' : 'Pitch'} head=${stagePill} footer=${footer}>
      <${UI.Input} id="pitch-brand" label="brand" value=${f.brand} onChange=${set('brand')} placeholder="Brand name" onEnter=${save}/>
      <${UI.Input} id="pitch-category" label="category" value=${f.category} onChange=${set('category')} placeholder="Fine jewellery, hospitality, wellness"/>
      ${contactOpts.length ? html`<${UI.Select} id="pitch-contact-pick" label="contact from the Base" value=${f.contactId} onChange=${set('contactId')}
        options=${[{v: '', label: f.contact ? 'Typed below' : 'Pick a contact'}].concat(contactOpts)}/>` : null}
      ${!f.contactId ? html`<${UI.Input} id="pitch-contact" label=${contactOpts.length ? 'or type a contact, name and role' : 'contact, name and role'} value=${f.contact} onChange=${set('contact')} placeholder="Name and role"/>` : null}
      <${UI.Input} id="pitch-source" label="source" value=${f.source} onChange=${set('source')} placeholder="Referral, inbound, event"/>
      ${!isNew ? html`<${UI.Field} label="stage">
        <${UI.Seg} sm options=${STAGE_OPTS} value=${f.stage} onChange=${set('stage')} ariaLabel="Stage"/>
      <//>` : null}
      <${UI.Select} id="pitch-owner" label="owner" value=${f.owner} onChange=${set('owner')} options=${ownerOpts}/>
      ${!isNew ? html`<${React.Fragment}>
        <${UI.Input} id="pitch-next" label="next step" value=${f.next} onChange=${set('next')} placeholder="What happens next"/>
        <${UI.Input} id="pitch-nextdate" label="next date" type="date" value=${f.nextDate} onChange=${set('nextDate')}/>
        ${f.stage === 'lost' ? html`<${UI.TextArea} id="pitch-lost" label="lost reason" value=${f.lost} onChange=${set('lost')} rows=${3} placeholder="Why it was lost, in one or two lines"/>` : null}
        ${pitch.project ? html`<${UI.Field} label="project">
          <div><${UI.Btn} kind="sec" sm onClick=${() => M.nav('#projects/' + pitch.project)}><${icons.link}/>${project ? (project.name || 'Project') : 'Open project'}<//></div>
        <//>` : null}
        ${M.parts.Connections ? html`<${M.parts.Connections} kind="pitch" id=${pitchId}/>` : null}
      <//>` : null}
      ${ctx.isFounder ? html`<${React.Fragment}>
        <hr class="hair"/>
        <${UI.Micro}>founder only<//>
        <${UI.Input} id="pitch-value" label="monthly value, ₹" type="number" min="0" step="1000" value=${f.value} onChange=${set('value')} placeholder="0"
          hint="Private to you. Shows on the card and feeds the weighted pipeline."/>
        <${UI.Input} id="pitch-prob" label="probability override, %" type="number" min="0" max="100" step="1" value=${f.prob} onChange=${set('prob')} placeholder=${String(stageProb)}
          hint=${'Blank uses the stage default, ' + stageProb + '%.'}/>
      <//>` : null}
    <//>`;
  }

  /* ---------- page ---------- */
  function Pitches() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null);
    M.useIntent('pitch', () => setOpen('new'));
    /* #pitches/<id> opens that pitch (search results and Connections land here) */
    const route = M.useRoute();
    const routeId = route.page === 'pitches' ? route.id : null;
    useEffect(() => { if (routeId) setOpen(routeId); }, [routeId]);
    const close = () => { setOpen(null); if (routeId) M.nav('#pitches'); };
    const map = ctx.coll.pitches.map;
    const all = Object.keys(map).map(id => ({id, ...map[id]}));
    const fin = financeOf(ctx);
    const m = ctx.isFounder ? metrics(ctx) : null;
    const nOpen = all.filter(p => !isClosed(p)).length;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${nOpen + ' in play'} title="Pitches">
        <${UI.Btn} onClick=${() => setOpen('new')}><${icons.plus}/>New pitch<//>
      <//>
      ${m ? html`<${MetricsBar} m=${m}/>` : null}
      ${!ctx.coll.pitches.ready ? html`<${UI.Empty} text="Loading pitches."/>`
        : html`<${Board} ctx=${ctx} all=${all} fin=${fin} onOpen=${setOpen}/>`}
      ${open ? html`<${PitchDrawer} pitchId=${open === 'new' ? null : open} onClose=${close}/>` : null}
    <//>`;
  }

  M.pages.Pitches = Pitches;
  M.parts.PitchDrawer = PitchDrawer;
  M.pitches = {STAGES, metrics, isOverdue, probOf};
})();
