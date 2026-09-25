/* module: crm. One table of every account we touch: Base companies, clients and pitch brands, folded into
   one row per company with its stage, owner, people, open pitches, open tasks, next step and last activity.
   Nothing new is stored here: it is the join across Base, Accounts, the pipeline and Work, in one place. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const DAY = 86400000;

  /* every account, one row each: keyed by company id when the Base knows it, else by name */
  function accounts(ctx) {
    const rows = {};
    const byName = {};
    const rowFor = (key, name) => {
      if (!rows[key]) rows[key] = {key, name, org: null, client: null, pitches: [], contacts: 0, tasks: 0, last: 0, next: '', nextText: '', owner: ''};
      return rows[key];
    };
    const ix = M.base && M.base.all ? M.base.all(ctx) : null;
    const orgs = ix && ix.orgs ? ix.orgs : [];
    for (const o of orgs) {
      if (o.archived) continue;
      const r = rowFor('o:' + o.id, o.name);
      r.org = o; byName[norm(o.name)] = r.key;
      r.last = Math.max(r.last, Number(o.updated) || 0);
    }
    const contacts = ix && ix.contacts ? ix.contacts : [];
    for (const c of contacts) {
      if (c.archived) continue;
      const key = c.org && rows['o:' + c.org] ? 'o:' + c.org : (c.orgName && byName[norm(c.orgName)]) || null;
      if (!key) continue;
      rows[key].contacts++;
      rows[key].last = Math.max(rows[key].last, Number(c.updated) || 0);
    }
    const cm = ctx.coll.clients.map;
    for (const id of Object.keys(cm)) {
      const c = {id, ...cm[id]};
      const key = (c.org && rows['o:' + c.org]) ? 'o:' + c.org : (byName[norm(c.name)] || ('c:' + id));
      const r = rowFor(key, c.name);
      r.client = c; r.owner = r.owner || c.owner || '';
      byName[norm(c.name)] = key;
      r.last = Math.max(r.last, Number(c.updated) || 0);
    }
    const pm = ctx.coll.pitches.map;
    for (const id of Object.keys(pm)) {
      const p = {id, ...pm[id]};
      const key = (p.org && rows['o:' + p.org]) ? 'o:' + p.org : (byName[norm(p.brand)] || ('p:' + norm(p.brand)));
      const r = rowFor(key, p.brand);
      r.pitches.push(p); r.owner = r.owner || p.owner || '';
      byName[norm(p.brand)] = key;
      r.last = Math.max(r.last, Number(p.updated) || Number(p.stageAt) || Number(p.created) || 0);
      if (p.stage !== 'won' && p.stage !== 'lost' && p.nextDate && (!r.next || p.nextDate < r.next)) { r.next = p.nextDate; r.nextText = p.next || ''; }
    }
    const tm = ctx.coll.tasks.map;
    for (const id of Object.keys(tm)) {
      const t = tm[id];
      if (!t || t.status === 'done' || !t.client) continue;
      const r = Object.values(rows).find(x => x.client && x.client.id === t.client);
      if (r) { r.tasks++; r.last = Math.max(r.last, Number(t.updated) || 0); }
    }
    return Object.values(rows);
  }

  const stageOf = r => {
    if (r.client) return {label: r.client.status === 'live' ? 'live client' : (r.client.status || 'client'), kind: r.client.status === 'live' ? 'ink' : 'warm'};
    const open = r.pitches.filter(p => p.stage !== 'won' && p.stage !== 'lost');
    if (open.length) { const p = open.sort((a, b) => (b.stageAt || 0) - (a.stageAt || 0))[0]; return {label: 'pitch: ' + (p.stage || 'lead'), kind: 'warm'}; }
    if (r.pitches.some(p => p.stage === 'won')) return {label: 'won', kind: 'ink'};
    if (r.pitches.some(p => p.stage === 'lost')) return {label: 'lost', kind: undefined};
    return {label: 'in the base', kind: undefined};
  };

  function CRM() {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [view, setView] = useState('all');
    const today = U.todayStr();
    const now = ctx.now || Date.now();
    const all = useMemo(() => accounts(ctx), [ctx.coll.orgs, ctx.coll.contacts, ctx.coll.clients, ctx.coll.pitches, ctx.coll.tasks]);
    const fe = ctx.isFounder && ctx.priv && ctx.priv.finance && ctx.priv.finance.data ? (ctx.priv.finance.data.pitch || {}) : {};
    const value = r => r.pitches.filter(p => p.stage !== 'won' && p.stage !== 'lost').reduce((n, p) => n + (Number((fe[p.id] || {}).value) || 0), 0);
    const owners = M.useProfiles(Array.from(new Set(all.map(r => r.owner).filter(Boolean))));
    const list = all.filter(r => {
      if (view === 'clients' && !r.client) return false;
      if (view === 'pipeline' && !r.pitches.some(p => p.stage !== 'won' && p.stage !== 'lost')) return false;
      if (view === 'quiet' && (r.last && now - r.last < 30 * DAY)) return false;
      if (q && !norm(r.name).includes(norm(q)) && !(r.owner && norm((owners[r.owner] || {}).name).includes(norm(q)))) return false;
      return true;
    }).sort((a, b) => (a.next && b.next ? a.next.localeCompare(b.next) : a.next ? -1 : b.next ? 1 : (b.last - a.last)));
    const open = r => {
      if (r.org) M.nav('#companies/' + r.org.id);
      else if (r.client) M.nav('#clients/' + r.client.id);
      else M.nav('#pitches');
    };
    const nextPill = r => {
      if (!r.next) return null;
      const late = r.next < today;
      return html`<${UI.Pill} kind=${late ? 'flame' : 'warm'}>${late ? 'overdue: ' : ''}${U.fmtDay ? U.fmtDay(r.next) : r.next}<//>`;
    };
    const counts = {all: all.length, clients: all.filter(r => r.client).length, pipeline: all.filter(r => r.pitches.some(p => p.stage !== 'won' && p.stage !== 'lost')).length, quiet: all.filter(r => !r.last || now - r.last >= 30 * DAY).length};
    return html`<${UI.Card} title="Every account, connected" id="crm-card"
      action=${html`<span class="tiny ink62">${all.length} accounts</span>`}>
      <p class="small ink62" style=${{marginTop: 0}}>Base companies, clients and pitches folded into one row each. Open a row for its people, pitches, projects and brain.</p>
      <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
        <input id="crm-q" class="input" style=${{flex: '1 1 200px'}} placeholder="Find a company or an owner" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Find an account"/>
        <${UI.Seg} sm=${true} ariaLabel="View" value=${view} onChange=${setView}
          options=${[{v: 'all', label: 'All ' + counts.all}, {v: 'clients', label: 'Clients ' + counts.clients}, {v: 'pipeline', label: 'Pipeline ' + counts.pipeline}, {v: 'quiet', label: 'Quiet ' + counts.quiet}]}/>
      </div>
      ${list.length ? html`<div class="tbl-wrap" style=${{marginTop: '12px'}}><table class="tbl crm-table" id="crm-table">
        <thead><tr><th>account</th><th>stage</th><th>owner</th><th class="num">people</th><th class="num">pitches</th><th class="num">tasks</th><th>next step</th><th>last touch</th>${ctx.isFounder ? html`<th class="num">in play</th>` : null}</tr></thead>
        <tbody>${list.map(r => {
          const st = stageOf(r);
          const openP = r.pitches.filter(p => p.stage !== 'won' && p.stage !== 'lost').length;
          return html`<tr key=${r.key} class="crm-row" onClick=${() => open(r)} style=${{cursor: 'pointer'}}>
            <td data-label="account"><span style=${{fontWeight: 500}}>${r.name}</span>${r.org ? null : html` <span class="tiny ink62">not in Base</span>`}</td>
            <td data-label="stage"><${UI.Pill} kind=${st.kind}>${st.label}<//></td>
            <td data-label="owner">${r.owner ? html`<${UI.Name} id=${r.owner}/>` : html`<span class="ink62">nobody</span>`}</td>
            <td data-label="people" class="num">${r.contacts}</td>
            <td data-label="pitches" class="num">${openP}${r.pitches.length > openP ? html`<span class="tiny ink62"> of ${r.pitches.length}</span>` : null}</td>
            <td data-label="tasks" class="num">${r.tasks}</td>
            <td data-label="next step">${nextPill(r)}${r.nextText ? html` <span class="small">${r.nextText}</span>` : null}</td>
            <td data-label="last touch" class="small ink62">${r.last ? U.timeAgo(r.last) : 'never'}</td>
            ${ctx.isFounder ? html`<td data-label="in play" class="num">${value(r) ? U.inr(value(r)) : ''}</td>` : null}
          </tr>`;
        })}</tbody></table></div>` : html`<${UI.Empty} text="Nothing here yet. Add a client, a pitch, or import the Apollo CSV into Base."/>`}
    </${UI.Card}>`;
  }

  M.crm = {accounts, stageOf};
  M.parts.CRM = CRM;
})();
