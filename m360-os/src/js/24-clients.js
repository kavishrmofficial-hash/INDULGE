/* module: clients (BRIEF 7.16). Client brains, and revenue for the founder only. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo, useEffect} = React;

  const STATUS = [{v: 'live', label: 'Live'}, {v: 'pitch', label: 'Pitch'}, {v: 'paused', label: 'Paused'}];
  const STATUS_PILL = {live: 'ink', pitch: null, paused: 'warm'};
  const FIELDS = ['memory', 'approvals', 'never'];

  function completeness(client) {
    const c = client || {};
    const missing = FIELDS.filter(f => !String(c[f] || '').trim());
    return {filled: FIELDS.length - missing.length, total: FIELDS.length, missing};
  }

  function financeOf(ctx) {
    const d = (ctx.priv && ctx.priv.finance && ctx.priv.finance.data) || {};
    return d.clients || {};
  }

  function shares(ctx) {
    const map = (ctx.coll && ctx.coll.clients && ctx.coll.clients.map) || {};
    const fin = financeOf(ctx);
    const rows = Object.keys(map).map(id => ({
      id, name: map[id].name || '', monthly: Number((fin[id] || {}).monthly) || 0
    }));
    const total = rows.reduce((n, r) => n + r.monthly, 0);
    return rows.map(r => ({...r, share: total > 0 ? Math.round(100 * r.monthly / total) : 0}));
  }

  function openTaskCount(ctx, id) {
    const list = (M.tasks && M.tasks.open) ? M.tasks.open(ctx) : [];
    return list.filter(t => t && t.client === id).length;
  }

  function ClientDrawer({id, onClose}) {
    const ctx = M.useCtx();
    const existing = id ? ctx.coll.clients.map[id] : null;
    const fin = financeOf(ctx);
    const [f, setF] = useState(() => ({
      name: (existing && existing.name) || '', status: (existing && existing.status) || 'live',
      pod: (existing && existing.pod) || '', owner: (existing && existing.owner) || ctx.uid,
      memory: (existing && existing.memory) || '', approvals: (existing && existing.approvals) || '',
      never: (existing && existing.never) || '', links: (existing && existing.links) || '',
      org: (existing && existing.org) || '',
      monthly: id && fin[id] ? String(fin[id].monthly || '') : ''
    }));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const owners = ctx.activeMembers.map(m => ({v: m.uid, label: m.title ? m.empId + ' ' + m.title : m.empId}));
    /* the company in the Base this client is, when the Base has companies */
    const orgOpts = useMemo(() => {
      const list = (M.search && M.search.orgs) ? M.search.orgs(ctx) : [];
      return list.map(o => ({v: o.id, label: o.name || o.id})).sort((a, b) => a.label.localeCompare(b.label));
    }, [ctx.coll.orgs]);

    async function save() {
      if (!f.name.trim()) return;
      const cid = id || U.uid();
      const doc = {name: f.name.trim(), status: f.status, pod: f.pod, owner: f.owner,
        memory: f.memory, approvals: f.approvals, never: f.never, links: f.links, org: f.org || '',
        updated: Date.now(), by: ctx.uid};
      if (id) await ctx.W.update('clients/' + id, doc);
      else await ctx.W.set('clients/' + cid, doc);
      if (ctx.isFounder && String(f.monthly).trim() !== '') {
        await ctx.W.merge('data/users/' + ctx.uid + '/finance', {clients: {[cid]: {monthly: Number(f.monthly) || 0}}});
      }
      M.toast('Saved');
      onClose();
    }

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${id ? 'Client' : 'New client'}
      footer=${html`<div class="row between grow">
        <div>${id && ctx.isFounder ? html`<${UI.ConfirmBtn} label="Tap again to confirm"
          onConfirm=${() => { ctx.W.del('clients/' + id).then(() => { M.toast('Deleted'); onClose(); }); }}>Delete<//>` : null}</div>
        <${UI.Btn} onClick=${save} disabled=${!f.name.trim()}>${id ? 'Save' : 'Create client'}<//>
      </div>`}>
      <${UI.Input} id="client-name" label="name" value=${f.name} onChange=${v => set('name', v)}/>
      <${UI.Field} label="status"><${UI.Seg} options=${STATUS} value=${f.status} onChange=${v => set('status', v)} ariaLabel="Status"/><//>
      <${UI.Input} label="pod" value=${f.pod} onChange=${v => set('pod', v)}/>
      <${UI.Select} label="owner" value=${f.owner} onChange=${v => set('owner', v)}
        options=${[{v: '', label: 'No owner'}].concat(owners)}/>
      <${UI.TextArea} label="brand memory" value=${f.memory} onChange=${v => set('memory', v)}/>
      <${UI.TextArea} label="approvals" value=${f.approvals} onChange=${v => set('approvals', v)}/>
      <${UI.TextArea} label="lines never to cross" value=${f.never} onChange=${v => set('never', v)}/>
      <${UI.TextArea} label="links, one per line" value=${f.links} onChange=${v => set('links', v)}/>
      ${orgOpts.length ? html`<${UI.Select} id="client-org" label="company in the Base" value=${f.org} onChange=${v => set('org', v)}
        options=${[{v: '', label: 'Not linked yet'}].concat(orgOpts)} hint="Links this client to its company and people in the Base."/>` : null}
      ${id && M.parts.PeopleAtClient ? html`<${M.parts.PeopleAtClient} id=${id}/>` : null}
      ${id && M.parts.Connections ? html`<${M.parts.Connections} kind="client" id=${id}/>` : null}
      ${id && M.parts.ClientUpdate ? html`<${M.parts.ClientUpdate} id=${id} name=${f.name}/>` : null}
      ${ctx.isFounder ? html`<${UI.Input} label="monthly revenue" type="number" value=${f.monthly}
        onChange=${v => set('monthly', v)} hint="Private to you."/>` : null}
    <//>`;
  }

  function Clients() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null); /* id, or 'new' */
    M.useIntent('client', () => setOpen('new'));
    /* #clients/<id> opens that client (search results and Connections land here) */
    const route = M.useRoute();
    const routeId = route.page === 'clients' ? route.id : null;
    useEffect(() => { if (routeId) setOpen(routeId); }, [routeId]);
    const close = () => { setOpen(null); if (routeId) M.nav('#clients'); };
    const map = ctx.coll.clients.map;
    const sh = useMemo(() => {
      const out = {};
      if (ctx.isFounder) shares(ctx).forEach(r => { out[r.id] = r; });
      return out;
    }, [ctx]);
    const ids = Object.keys(map).sort((a, b) => String(map[a].name || '').localeCompare(String(map[b].name || '')));

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="client brains" title="Clients">
        <${UI.Btn} onClick=${() => setOpen('new')}>New client<//>
      <//>
      ${ids.length ? html`<div class="grid2">
        ${ids.map(id => {
          const c = map[id];
          const comp = completeness(c);
          const s = sh[id];
          return html`<button type="button" class="card rowbtn" key=${id} onClick=${() => setOpen(id)}
            style=${{cursor: 'pointer'}}>
            <div class="row between">
              <span style=${{fontWeight: 500, fontSize: '17px'}}>${c.name}</span>
              <${UI.Pill} kind=${STATUS_PILL[c.status]}>${c.status || 'live'}<//>
            </div>
            <div class="row small ink62" style=${{marginTop: '8px'}}>
              ${c.pod ? html`<span>${c.pod}</span>` : null}
              ${c.owner ? html`<${UI.Avatar} id=${c.owner} size=${22}/>` : null}
              <span class="num">${openTaskCount(ctx, id)} open tasks</span>
            </div>
            <div class="row" style=${{marginTop: '10px'}}>
              <span class=${'small num' + (comp.filled < comp.total ? ' flame-t' : '')}>${comp.filled} of ${comp.total} fields</span>
              <span class="tiny ink62">updated ${c.updated ? U.timeAgo(c.updated) : 'never'}</span>
            </div>
            ${s ? html`<div class="row small" style=${{marginTop: '8px'}}>
              <span class="num" style=${{fontWeight: 500}}>${U.inr(s.monthly)}</span>
              <span class="ink62 num">${s.share}% of monthly revenue</span>
            </div>` : null}
          </button>`;
        })}
      </div>` : html`<${UI.Card}><${UI.Empty} text="No clients yet."/><//>`}
      ${open ? html`<${ClientDrawer} id=${open === 'new' ? null : open} onClose=${close}/>` : null}
    </div>`;
  }

  /* AI: a client-ready status note from this client's projects and tasks */
  function ClientUpdate({id, name}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const nm = await M.ai.names(ctx);
      const td = U.todayStr();
      const projects = Object.keys(ctx.coll.projects.map).map(k => ({id: k, ...ctx.coll.projects.map[k]})).filter(p => p.client === id && !p.archived);
      const tasks = Object.keys(ctx.coll.tasks.map).map(k => ({id: k, ...ctx.coll.tasks.map[k]})).filter(t => t.client === id || projects.some(p => p.id === t.project));
      const lines = tasks.slice(0, 60).map(t => '- ' + t.title + ' (' + t.status + (t.due ? ', due ' + t.due : '') + ', ' + (nm[t.owner] || 'unassigned') + ')');
      const out = await r.run(o => M.ai.text(ctx,
        'Write a short WhatsApp status update for the client ' + name + ' from Mask360, in the agency\'s warm and confident voice. Today is ' + td + '. ' +
        'Structure: one friendly opening line, then "Done" and "Next" as short bullet lists, then one line on what we need from them (or "Nothing needed from your side"). ' +
        'Never mention internal statuses, revisions, lateness or people\'s workloads. Under 120 words. No emoji.\n\nPROJECTS:\n' +
        (projects.map(p => '- ' + p.name + ' (' + p.status + (p.due ? ', due ' + p.due : '') + ')').join('\n') || '- none') + '\n\nTASKS:\n' + (lines.join('\n') || '- none'),
        {signal: o.signal, onText: o.onText, cache: false}));
      return out;
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<div class="ai-card" id="client-update">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Client update</div></div>
        <button type="button" class="btn sm" disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking}/>` : html`<span class="spark">\u2726</span> ${r.text ? 'Write it again' : 'Write an update'}`}</button>
      </div>
      ${r.text ? html`<div style=${{marginTop: '12px'}}><${M.AIText} text=${r.text}/>
        <button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => navigator.clipboard.writeText(r.text).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here', true))}>Copy for WhatsApp</button></div>`
        : html`<div class="small ink62" style=${{marginTop: '8px'}}>${busy ? 'Reading this client\'s projects and tasks.' : 'A client-ready note on what shipped and what is next, in one tap.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </div>`;
  }
  M.parts.ClientUpdate = ClientUpdate;

  M.pages.Clients = Clients;
  M.clients = {completeness, shares, openTaskCount, STATUS};
})();
