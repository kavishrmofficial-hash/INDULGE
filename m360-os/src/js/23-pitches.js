/* module: pitches */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

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
  /* v39: the finance doc loads for the owner alone (02-state), so only the owner gets the money fields; a roster
     founder's values went to a doc nobody reads */
  const hasMoney = ctx => !!ctx.isOwner;
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
  /* the founder's figures as the design's number tiles: a rule on top (flame when it needs you), the number, the label;
     members never get this bar */
  function Tile({id, v, l, flame}) {
    const nil = v == null;
    return html`<div id=${id} class=${'kpi' + (flame ? ' hot' : '')}>
      <div class="l">${l}</div>
      <div class=${'v num' + (flame ? ' flame-t' : '') + (nil ? ' nil' : '')}>${nil ? 'not yet' : String(v)}</div>
    </div>`;
  }

  function MetricsBar({m}) {
    const inPlay = OPEN_STAGES.reduce((n, s) => n + m.byStage[s.v].count, 0);
    const od = m.overdue.length;
    return html`<${React.Fragment}>
      <div class="kpi-rail">
        ${m.money ? html`<${Tile} id="kpi-weighted" v=${U.inr(m.weighted)} l="weighted pipeline"/>` : null}
        <${Tile} id="kpi-open" v=${inPlay} l=${inPlay === 1 ? 'pitch in play' : 'pitches in play'}/>
        <${Tile} id="kpi-win" v=${m.winRate90 == null ? null : m.winRate90 + '%'} l="win rate, 90 days"/>
        <${Tile} id="kpi-overdue" v=${od} l=${od === 1 ? 'next step overdue' : 'next steps overdue'} flame=${od > 0}/>
      </div>
      <div class="row stage-counts" id="stage-counts">
        ${STAGES.map(s => html`<span key=${s.v} class=${'pill stage-count' + (m.byStage[s.v].count ? ' warm' : '')}>
          ${s.label} <b class="num">${m.byStage[s.v].count}</b></span>`)}
      </div>
    <//>`;
  }

  /* ---------- board ---------- */
  /* the latest shared send, in one line: "Sent to Meera, 3 days, no reply yet" or "Meera replied" */
  function SendLine({p}) {
    const ctx = M.useCtx();
    const s = M.prospects && M.prospects.latestSend ? M.prospects.latestSend(p) : null;
    /* the Base is asked only for a contact id (c_...) or an id the local index knows, never for a typed name */
    const to = String((s && s.to) || '');
    const cid = s && (/^c_/.test(to) || (/^[A-Za-z0-9_-]{1,40}$/.test(to) && M.search && M.search.contactById && !!M.search.contactById(ctx, to))) ? to : null;
    const got = M.base && M.base.useRow ? M.base.useRow('contacts', cid) : {row: null};
    if (!s || !M.prospectsUi) return null;
    const who = got.row ? String(got.row.name || got.row.first || 'them').split(' ')[0] : /^c_/.test(String(s.to || '')) ? 'them' : (String(s.to || 'them').split(/[,\s]+/)[0] || 'them');
    const line = M.prospectsUi.sendLine(p, who);
    return line ? html`<span class="tiny sub pitch-sent-line">${line}</span>` : null;
  }
  function PitchCard({p, fe, founder, today, now, onOpen, beam}) {
    const days = Math.max(0, Math.floor((now - (p.stageAt || p.created || now)) / DAY));
    const od = isOverdue(p, today);
    const value = founder ? valueOf(fe) : 0;
    const won = stageOf(p).v === 'won';
    /* v40: the design's card (B1 .tk); the pitch whose next step is most overdue carries the flame line, one card only */
    return html`<button type="button" class=${'tcard tk' + (beam ? ' due' : '')} data-pitch=${p.id}
      aria-label=${'Open ' + (p.brand || 'pitch')} onClick=${() => onOpen(p.id)}>
      <span class="t tk-t">${p.brand || 'Untitled'}</span>
      ${p.category || won || value > 0 ? html`<span class="tk-m">
        ${won ? html`<${UI.Pill} kind="ink">won<//>` : null}
        ${p.category ? html`<${UI.Pill} kind="warm">${p.category}<//>` : null}
        ${value > 0 ? html`<${UI.Pill}>${U.inr(value)}<//>` : null}
      </span>` : null}
      ${(p.next || p.nextDate) ? html`<span class="tk-o">
        <span class="grow tk-n">${p.next || 'Next step'}</span>
        ${p.nextDate ? html`<span class=${'tn' + (od ? ' flt flame-t' : '')}>${U.fmtDay(p.nextDate)}</span>` : null}
      </span>` : null}
      <span class="tk-o"><${UI.Avatar} id=${p.owner} size=${22}/><span class="grow">${daysText(days)}</span></span>
      <${SendLine} p=${p}/>
    </button>`;
  }

  function Board({ctx, all, fin, onOpen}) {
    const today = U.todayStr();
    const now = ctx.now || Date.now();
    const hottest = (all.filter(p => isOverdue(p, today)).sort((a, b) => nextKey(a) < nextKey(b) ? -1 : nextKey(a) > nextKey(b) ? 1 : 0)[0] || {}).id || null;
    /* the board opens on its first stage with pitches when that stage sits past the middle of the view */
    const wrapRef = useRef(null);
    const filled = STAGES.filter(s => all.some(p => stageOf(p).v === s.v)).map(s => s.v).join(',');
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
      const col = wrap.querySelector('.colm:not(.empty)');
      if (!col) return;
      const x = col.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
      if (x > wrap.clientWidth * 0.5) wrap.scrollTo({left: x - 6, behavior: 'auto'});
    }, [filled]);
    return html`<div class="board-wrap board pboard" ref=${wrapRef}>
      ${STAGES.map(s => {
        const list = all.filter(p => stageOf(p).v === s.v).sort(sortCol);
        return html`<div class=${'colm col' + (list.length ? '' : ' empty')} key=${s.v} data-stage=${s.v}>
          <div class="col-head col-h"><span>${s.label}</span><span class="num">${list.length}</span></div>
          ${list.length ? list.map(p => html`<${PitchCard} key=${p.id} p=${p} fe=${fin[p.id]} founder=${hasMoney(ctx)} today=${today} now=${now} onOpen=${onOpen} beam=${p.id === hottest}/>`)
            : html`<div class="col-e">Nothing here</div>`}
        </div>`;
      })}
    </div>`;
  }

  /* ---------- drawer ---------- */
  function PitchDrawer({pitchId, onClose}) {
    const ctx = M.useCtx();
    const {W} = ctx;
    const isNew = !pitchId;
    const pitch = pitchId ? ctx.coll.pitches.map[pitchId] : null;
    const finReady = !!(ctx.priv && ctx.priv.finance && ctx.priv.finance.ready);
    const fe = pitchId ? financeOf(ctx)[pitchId] : null;

    /* pitch.contact holds a Base contact id (c_...) when one is picked, else a typed name and role. The id is
       recognised by its shape, so the team site (where the page holds no Base index) reads it the same way;
       an older id is still found through the local index where there is one. */
    const isCid = v => /^c_/.test(String(v || '')) || !!(v && !/\s/.test(String(v)) && M.search && M.search.contactById && M.search.contactById(ctx, v));
    const blank = () => ({brand: '', category: '', contact: '', contactId: '', source: '', stage: 'lead', owner: ctx.uid,
      next: '', nextDate: '', lost: '', value: '', prob: ''});
    const fromDoc = (p, e) => ({
      brand: p.brand || '', category: p.category || '', contact: isCid(p.contact) ? '' : (p.contact || ''), contactId: isCid(p.contact) ? p.contact : '',
      source: p.source || '',
      stage: stageOf(p).v, owner: p.owner || ctx.uid, next: p.next || '', nextDate: p.nextDate || '', lost: p.lost || '',
      value: valueOf(e) > 0 ? String(valueOf(e)) : '', prob: hasProb(e) ? String(Number(e.prob)) : ''
    });
    /* v39: the copy the form opened on; save sends only what this person changed against it */
    const base = useRef(null);
    const [f, setF] = useState(() => { const v = pitch ? fromDoc(pitch, fe) : blank(); base.current = v; return v; });
    const [busy, setBusy] = useState(false);
    /* a deep link can open the drawer before the pitches have loaded, and a picked contact is known only once the
       Base has loaded: the form fills again when either arrives, so "c5" is never read as a typed name */
    const cidKnown = !!(pitch && isCid(pitch.contact));
    useEffect(() => {
      const p = pitchId ? ctx.coll.pitches.map[pitchId] : null;
      const v = p ? fromDoc(p, pitchId ? financeOf(ctx)[pitchId] : null) : blank();
      base.current = v;
      setF(v);
      setBusy(false);
    }, [pitchId, finReady, !!pitch, cidKnown]);
    /* v39: a change someone else saves while the drawer is open shows in every field this person has not touched */
    useEffect(() => {
      if (!pitch || !base.current) return;
      const ob = base.current, nb = fromDoc(pitch, fe);
      base.current = nb;
      setF(x => { const out = {...x}; for (const k of Object.keys(nb)) if (x[k] === ob[k]) out[k] = nb[k]; return out; });
    }, [pitch, fe]);
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
    const cidForBrand = clientFor(ctx, f.brand);
    const cq = M.base && M.base.useQuery ? M.base.useQuery('contacts', {client: cidForBrand || '', limit: 200}) : {rows: []};
    const contactOpts = useMemo(() => cq.rows.map(c => ({v: c.id, label: (c.name || [c.first, c.last].filter(Boolean).join(' ') || 'Someone') + (c.title ? ', ' + c.title : '') + (!cidForBrand && c.orgName ? ' (' + c.orgName + ')' : '')}))
      .sort((a, b) => a.label.localeCompare(b.label)), [cq.rows, cidForBrand]);
    /* the linked contact's name, from its own row: the team site's list may not hold it */
    const contactRow = M.base && M.base.useRow ? M.base.useRow('contacts', f.contactId || null) : {row: null, loading: false};
    const contactName = contactRow.row ? (contactRow.row.name || [contactRow.row.first, contactRow.row.last].filter(Boolean).join(' ') || 'Someone') + (contactRow.row.title ? ', ' + contactRow.row.title : '') : '';
    const pickOpts = useMemo(() => f.contactId && contactName && !contactOpts.some(o => o.v === f.contactId) ? [{v: f.contactId, label: contactName}].concat(contactOpts) : contactOpts, [contactOpts, f.contactId, contactName]);

    const save = () => {
      if (!canSave) return;
      setBusy(true);
      const now = Date.now();
      const id = isNew ? U.uid() : pitchId;
      const orgMatch = (!M.base.remote() && M.base.all) ? (M.base.all(ctx).orgs || []).find(o => !o.archived && String(o.name || '').trim().toLowerCase() === f.brand.trim().toLowerCase()) : null;
      const body = {brand: f.brand.trim(), category: f.category.trim(), contact: f.contactId || f.contact.trim(),
        source: f.source.trim(), owner: f.owner || ctx.uid, updated: now, ...(orgMatch ? {org: orgMatch.id} : {})};
      let p;
      if (isNew) {
        p = W.set('pitches/' + id, {...body, stage: 'lead', stageAt: now, next: f.next.trim(), nextDate: f.nextDate || '', project: '', lost: '', created: now});
      } else {
        /* v39: only the fields this person changed, so a stage move or an edit saved meanwhile is kept */
        const docOf = x => ({brand: x.brand.trim(), category: x.category.trim(), contact: x.contactId || x.contact.trim(), source: x.source.trim(),
          owner: x.owner || ctx.uid, stage: x.stage, next: x.next.trim(), nextDate: x.nextDate || '', lost: x.lost.trim()});
        const ch = U.changes(docOf(base.current || f), docOf(f));
        if ('stage' in ch) ch.stageAt = now;
        /* a next step typed or dated by hand is the team's own again: the bridge (M.prospects, nextBy 'fu')
           never overwrites it from then on */
        const byHand = pitch.nextBy && ('next' in ch || 'nextDate' in ch);
        p = W.update('pitches/' + id, {...ch, updated: now, ...(orgMatch && orgMatch.id !== pitch.org ? {org: orgMatch.id} : {}), ...(byHand ? {nextBy: ''} : {})});
      }
      const ob = base.current || {};
      if (hasMoney(ctx) && (isNew ? (f.value !== '' || f.prob !== '') : (f.value !== ob.value || f.prob !== ob.prob))) {
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
      const now = Date.now();
      const same = M.clients && M.clients.sameName ? M.clients.sameName(ctx, pitch.brand, null) : null;
      if (same) { M.toast('A client called ' + same.name + ' is already here. Linking the pitch to it.'); W.merge('pitches/' + pitchId, {client: same.id, updated: now}).then(() => { onClose(); M.nav('#clients/' + same.id); }, () => setBusy(false)); return; }
      let cid = U.uid();
      let p = pitch.org && M.base && M.base.makeClientFromOrg
        ? M.base.makeClientFromOrg(ctx, pitch.org).then(made => { if (made) cid = made; else return W.set('clients/' + cid, {name: pitch.brand || 'Client', status: 'live', pod: '', owner: pitch.owner || ctx.uid, memory: '', approvals: '', never: '', links: '', updated: now, by: ctx.uid}); })
        : W.set('clients/' + cid, {name: pitch.brand || 'Client', status: 'live', pod: '', owner: pitch.owner || ctx.uid,
          memory: '', approvals: '', never: '', links: '', updated: now, by: ctx.uid});
      p = p.then(() => W.merge('pitches/' + pitchId, {client: cid, updated: now}));
      /* the founder's private monthly revenue starts from the pitch value */
      if (hasMoney(ctx) && valueOf(fe) > 0) p = p.then(() => W.merge(financePath(ctx), {clients: {[cid]: {monthly: valueOf(fe)}}}));
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
    const stagePill = pitch ? (won ? html`<${UI.Pill} kind="ink">${stageOf(pitch).label}<//>` : html`<${UI.Pill} kind=${stageOf(pitch).v === 'lost' ? 'flame' : undefined}>${stageOf(pitch).label}<//>`) : null;
    const stageProb = stageOf({stage: f.stage}).prob;

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New pitch' : 'Pitch'} head=${stagePill} footer=${footer}>
      <${UI.Input} id="pitch-brand" label="brand" value=${f.brand} onChange=${set('brand')} placeholder="Brand name" onEnter=${save}/>
      <${UI.Input} id="pitch-category" label="category" value=${f.category} onChange=${set('category')} placeholder="Fine jewellery, hospitality, wellness"/>
      ${pickOpts.length || f.contactId ? html`<${UI.Select} id="pitch-contact-pick" label="contact from the Base" value=${f.contactId} onChange=${set('contactId')}
        options=${[{v: '', label: f.contact ? 'Typed below' : 'Pick a contact'}].concat(pickOpts)}/>` : null}
      ${f.contactId ? html`<div class="small ink62" id="pitch-contact-name">${contactName || (contactRow.loading ? 'Looking up the contact.' : 'This contact is no longer in the Base.')}${contactRow.row ? html` <button type="button" class="linky tiny" onClick=${() => M.nav('#base/' + f.contactId)}>Open in the Base</button>` : null}</div>` : null}
      ${!f.contactId ? html`<${UI.Input} id="pitch-contact" label=${contactOpts.length ? 'or type a contact, name and role' : 'contact, name and role'} value=${f.contact} onChange=${set('contact')} placeholder="Name and role"/>` : null}
      <${UI.Input} id="pitch-source" label="source" value=${f.source} onChange=${set('source')} placeholder="Referral, inbound, event"/>
      ${!isNew ? html`<${UI.Field} label="stage">
        <${UI.Seg} sm options=${STAGE_OPTS} value=${f.stage} onChange=${set('stage')} ariaLabel="Stage"/>
      <//>` : null}
      <${UI.Select} id="pitch-owner" label="owner" value=${f.owner} onChange=${set('owner')} options=${ownerOpts}/>
      <${UI.Input} id="pitch-next" label="next step" value=${f.next} onChange=${set('next')} placeholder="What happens next"/>
      <${UI.Input} id="pitch-nextdate" label="next date" type="date" value=${f.nextDate} onChange=${set('nextDate')}/>
      ${!isNew ? html`<${React.Fragment}>
        ${M.parts.SentFold ? html`<${M.parts.SentFold} pitchId=${pitchId}/>` : null}
        ${M.parts.PitchNotes ? html`<${M.parts.PitchNotes} pitchId=${pitchId}/>` : null}
        ${f.stage === 'lost' ? html`<${UI.TextArea} id="pitch-lost" label="lost reason" value=${f.lost} onChange=${set('lost')} rows=${3} placeholder="Why it was lost, in one or two lines"/>` : null}
        ${pitch.project ? html`<${UI.Field} label="project">
          <div><${UI.Btn} kind="sec" sm onClick=${() => M.nav('#projects/' + pitch.project)}><${icons.link}/>${project ? (project.name || 'Project') : 'Open project'}<//></div>
        <//>` : null}
        ${M.parts.Connections ? html`<${M.parts.Connections} kind="pitch" id=${pitchId}/>` : null}
      <//>` : null}
      ${hasMoney(ctx) ? html`<${React.Fragment}>
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
    /* the same pitch linked again right after its drawer closed: the close's step back to #pitches and the link
       can land in one render, so routeId never seems to change; every hash change to a pitch opens it */
    useEffect(() => {
      const on = () => { const r = M.parseHash(); if (r.page === 'pitches' && r.id) setOpen(r.id); };
      window.addEventListener('hashchange', on);
      return () => window.removeEventListener('hashchange', on);
    }, []);
    const close = () => { setOpen(null); if (routeId) M.nav('#pitches'); };
    const map = ctx.coll.pitches.map;
    const all = Object.keys(map).map(id => ({id, ...map[id]}));
    const fin = financeOf(ctx);
    const m = ctx.isFounder ? {...metrics(ctx), money: hasMoney(ctx)} : null;
    const nOpen = all.filter(p => !isClosed(p)).length;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${nOpen + ' in play'} title="Pipeline">
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
