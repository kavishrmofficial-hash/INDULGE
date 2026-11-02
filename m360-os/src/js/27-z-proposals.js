/* module: proposals. The pipeline in five plain columns over the shared pitches: Building (lead, qualified,
   diagnostic), Sent (proposal), Waiting on them (negotiation), Won and Lost. One row adds a proposal in
   Building; a card moves with one tap; tapping the card opens the full pitch drawer. Nothing new is stored:
   a move writes the pitch's stage and stageAt the way the pitch drawer does. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const COLS = [
    {v: 'building', label: 'Building', stages: ['lead', 'qualified', 'diagnostic'], to: 'lead'},
    {v: 'sent', label: 'Sent', stages: ['proposal'], to: 'proposal'},
    {v: 'waiting', label: 'Waiting on them', stages: ['negotiation'], to: 'negotiation'},
    {v: 'won', label: 'Won', stages: ['won'], to: 'won'},
    {v: 'lost', label: 'Lost', stages: ['lost'], to: 'lost'}
  ];
  const colOf = p => COLS.find(c => c.stages.indexOf((p && p.stage) || 'lead') >= 0) || COLS[0];
  const NEXT = {building: 'sent', sent: 'waiting', waiting: 'won'};
  const MOVE_LABEL = {sent: 'Mark sent', waiting: 'Waiting on them', won: 'Won'};
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const DAY = 86400000;
  const finOf = ctx => { const d = ctx.priv && ctx.priv.finance && ctx.priv.finance.data; return (d && d.pitch) || {}; };
  const valueOf = fe => { const n = Number(fe && fe.value); return isFinite(n) && n > 0 ? n : 0; };

  function move(ctx, p, col) {
    const c = COLS.find(x => x.v === col);
    if (!c) return Promise.resolve();
    if (c.stages.indexOf(p.stage || 'lead') >= 0) return Promise.resolve();
    const now = Date.now();
    return ctx.W.update('pitches/' + p.id, {stage: c.to, stageAt: now, updated: now}).then(() => M.toast((p.brand || 'Pitch') + ': ' + c.label.toLowerCase()));
  }

  function QuickAdd({ctx}) {
    const [f, setF] = useState({brand: '', contact: '', next: ''});
    const [busy, setBusy] = useState(false);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const save = () => {
      if (busy || !f.brand.trim()) return;
      setBusy(true);
      const id = U.uid(), now = Date.now();
      ctx.W.set('pitches/' + id, {brand: f.brand.trim().slice(0, 80), category: '', contact: f.contact.trim().slice(0, 80), source: '', owner: ctx.uid,
        stage: 'lead', stageAt: now, next: f.next.trim().slice(0, 120), nextDate: '', project: '', lost: '', created: now, updated: now})
        .then(() => { M.toast(f.brand.trim() + ' added to Building'); setF({brand: '', contact: '', next: ''}); setBusy(false); }, () => setBusy(false));
    };
    return html`<div class="prop-add" onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}>
      <${UI.Input} id="prop-brand" label="brand" value=${f.brand} onChange=${set('brand')} placeholder="Tank Tailor"/>
      <${UI.Input} id="prop-contact" label="contact" value=${f.contact} onChange=${set('contact')} placeholder="Who asked for it"/>
      <${UI.Input} id="prop-next" label="what the proposal is" value=${f.next} onChange=${set('next')} placeholder="Social retainer, 3 months"/>
      <div class="prop-add-btn"><${UI.Btn} id="prop-save" disabled=${busy || !f.brand.trim()} onClick=${save}><${icons.plus}/>Add proposal<//></div>
    </div>`;
  }

  function Card({ctx, p, fe, today, onOpen}) {
    const c = colOf(p);
    const days = Math.max(0, Math.floor((Date.now() - (p.stageAt || p.created || Date.now())) / DAY));
    const od = !!p.nextDate && p.nextDate < today && c.v !== 'won' && c.v !== 'lost';
    const value = ctx.isFounder ? valueOf(fe) : 0;
    const nx = NEXT[c.v];
    return html`<div class=${'tcard tk prop-card' + (od ? ' due' : '')} data-pitch=${p.id} data-col=${c.v}>
      <button type="button" class="prop-open" onClick=${() => onOpen(p.id)} aria-label=${'Open ' + (p.brand || 'pitch')}>
        <span class="t tk-t">${p.brand || 'Untitled'}</span>
        ${p.next || value ? html`<span class="tk-m">
          ${value ? html`<${UI.Pill}>${U.inrV(value)}<//>` : null}
          ${p.next ? html`<${UI.Pill} kind="warm">${p.next}<//>` : null}
        </span>` : null}
        <span class="tk-o">
          <${UI.Avatar} id=${p.owner} size=${22}/><span class="grow">${days === 0 ? 'today' : days + 'd here'}</span>
          ${p.nextDate ? html`<span class=${'tn' + (od ? ' flt' : '')}>${U.fmtDay(p.nextDate)}</span>` : null}
        </span>
      </button>
      ${nx || c.v !== 'lost' ? html`<div class="row prop-moves">
        ${nx ? html`<button type="button" class="btn ghost sm" data-move=${nx} onClick=${() => move(ctx, p, nx)}>${MOVE_LABEL[nx]}</button>` : null}
        ${c.v !== 'lost' && c.v !== 'won' ? html`<button type="button" class="btn ghost sm" data-move="lost" onClick=${() => move(ctx, p, 'lost')}>Lost</button>` : null}
      </div>` : null}
    </div>`;
  }

  function Proposals() {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(null);
    /* the five columns, or every stage on the full board (the board with the win rate and the sends) */
    const [view, setViewS] = useState(() => M.prefs.get('pipeline.view', 'simple') === 'stages' && M.pages.Pitches ? 'stages' : 'simple');
    const setView = v => { M.prefs.set('pipeline.view', v); setViewS(v); setOpen(null); };
    const simple = useRef(view === 'simple');
    simple.current = view === 'simple';
    M.useIntent('pitch', () => { if (simple.current) setOpen('new'); });
    const route = M.useRoute();
    const routeId = (route.page === 'pitches' || route.page === 'pipeline') ? route.id : null;
    useEffect(() => { if (routeId && simple.current) setOpen(routeId); }, [routeId]);
    useEffect(() => {
      const on = () => { const r = M.parseHash(); if ((r.page === 'pitches' || r.page === 'pipeline') && r.id && simple.current) setOpen(r.id); };
      window.addEventListener('hashchange', on);
      return () => window.removeEventListener('hashchange', on);
    }, []);
    const close = () => { setOpen(null); if (routeId) M.nav('#pitches'); };
    const map = ctx.coll.pitches.map;
    const fin = finOf(ctx);
    const today = U.todayStr();
    const ws = norm(q).split(' ').filter(Boolean);
    const all = Object.keys(map).map(id => ({id, ...map[id]}));
    const shown = all.filter(p => !ws.length || ws.every(w => norm([p.brand, p.category, p.contact, p.next].join(' ')).indexOf(w) >= 0));
    const inPlay = all.filter(p => ['won', 'lost'].indexOf(colOf(p).v) < 0).length;
    const m = ctx.isFounder && M.pitches && M.pitches.metrics ? M.pitches.metrics(ctx) : null;
    const Drawer = M.parts.PitchDrawer;
    const Toggle = html`<div class="row" style=${{justifyContent: 'flex-end'}}>
      <${UI.Seg} sm options=${[{v: 'simple', label: 'Five columns'}, {v: 'stages', label: 'All stages'}]} value=${view} onChange=${setView} ariaLabel="Pipeline view"/>
    </div>`;
    if (view === 'stages' && M.pages.Pitches) return html`<div class="stack" style=${{gap: '24px'}} id="pipeline-stages">${Toggle}<${M.pages.Pitches}/></div>`;
    return html`<div class="stack" style=${{gap: '24px'}}>
      <${UI.PageHead} micro=${inPlay + ' in play' + (m && m.weighted ? ', ' + U.inrV(m.weighted) + ' weighted' : '')} title="Pipeline">
        ${Toggle}
        <${UI.Btn} kind="sec" onClick=${() => setOpen('new')}>Full form<//>
      <//>
      <${UI.Card} title="New proposal"><${QuickAdd} ctx=${ctx}/><//>
      <label class="talk-search">
        <${icons.search}/>
        <input id="prop-q" class="input" type="search" aria-label="Search proposals" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Search brand, contact or proposal"/>
      </label>
      ${!ctx.coll.pitches.ready ? html`<${UI.Empty} text="Loading."/>` : html`<div class="board-wrap prop-wrap board nc prop-board" style=${{'--n': COLS.length}}>
        ${COLS.map(c => {
          const list = shown.filter(p => colOf(p).v === c.v).sort((a, b) => (b.stageAt || 0) - (a.stageAt || 0));
          const total = ctx.isFounder ? list.reduce((n, p) => n + valueOf(fin[p.id]), 0) : 0;
          return html`<div class=${'colm col' + (list.length ? '' : ' empty')} key=${c.v} data-col=${c.v}>
            <div class="col-head col-h"><span>${c.label}</span><span class="num">${list.length}${total ? ' · ' + U.inrV(total) : ''}</span></div>
            ${list.map(p => html`<${Card} key=${p.id} ctx=${ctx} p=${p} fe=${fin[p.id]} today=${today} onOpen=${setOpen}/>`)}
            ${!list.length ? html`<div class="col-e">${ws.length ? 'No match' : 'Nothing here'}</div>` : null}
          </div>`;
        })}
      </div>`}
      ${open && Drawer ? html`<${Drawer} pitchId=${open === 'new' ? null : open} onClose=${close}/>` : null}
    </div>`;
  }

  M.pages.Proposals = Proposals;
  M.proposals = {COLS, colOf, move};
})();
