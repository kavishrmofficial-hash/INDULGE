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
      monthly: id && fin[id] ? String(fin[id].monthly || '') : ''
    }));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const owners = ctx.activeMembers.map(m => ({v: m.uid, label: m.title ? m.empId + ' ' + m.title : m.empId}));

    async function save() {
      if (!f.name.trim()) return;
      const cid = id || U.uid();
      const doc = {name: f.name.trim(), status: f.status, pod: f.pod, owner: f.owner,
        memory: f.memory, approvals: f.approvals, never: f.never, links: f.links,
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
      ${ctx.isFounder ? html`<${UI.Input} label="monthly revenue" type="number" value=${f.monthly}
        onChange=${v => set('monthly', v)} hint="Private to you."/>` : null}
    <//>`;
  }

  function Clients() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null); /* id, or 'new' */
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
      ${open ? html`<${ClientDrawer} id=${open === 'new' ? null : open} onClose=${() => setOpen(null)}/>` : null}
    </div>`;
  }

  M.pages.Clients = Clients;
  M.clients = {completeness, shares, openTaskCount, STATUS};
})();
