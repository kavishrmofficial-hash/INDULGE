/* module: trash. Admin > Controls > Super: the bin. A deleted task is never erased by whoever deleted
   it; it lands here with who and when, the founder brings it back or lets it go, and anything older
   than thirty days is let go on the next visit. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useEffect} = React;
  const KEEP_MS = 30 * 86400000;

  function TrashCard() {
    const ctx = M.useCtx();
    const trash = (ctx.coll.tasks && ctx.coll.tasks.trash) || {};
    const list = Object.keys(trash).map(id => ({id, ...trash[id]})).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    useEffect(() => {
      /* thirty days on, gone for good */
      list.filter(t => (Number(t.deletedAt) || 0) < Date.now() - KEEP_MS).forEach(t => ctx.W.del('tasks/' + t.id).catch(() => {}));
    }, [list.length]);
    if (!ctx.isFounder) return null;
    const restore = t => ctx.W.update('tasks/' + t.id, {deleted: false, deletedBy: null, deletedAt: null, updated: Date.now()}).then(() => M.toast('Back on the board')).catch(() => {});
    const purge = t => ctx.W.del('tasks/' + t.id).then(() => M.toast('Gone for good')).catch(() => {});
    return html`<${UI.Card} id="trash-card" title="Deleted tasks" action=${html`<span class="tiny ink62 num">${list.length} in the bin, thirty days</span>`}>
      ${list.length ? html`<div class="stack tight">
        ${list.map(t => html`<div key=${t.id} class="row between brk-row" id=${'trash-' + t.id}>
          <div class="grow" style=${{minWidth: 0}}>
            <div style=${{overflowWrap: 'anywhere'}}>${t.title}</div>
            <div class="tiny ink62">owner <${UI.Name} id=${t.owner}/> · deleted by <${UI.Name} id=${t.deletedBy}/> ${t.deletedAt ? U.timeAgo(t.deletedAt) : ''}${t.status ? ' · was ' + t.status : ''}${t.due ? ' · due ' + U.fmtDate(t.due) : ''}</div>
          </div>
          <span class="row nowrap">
            <${UI.Btn} sm=${true} kind="sec" onClick=${() => restore(t)}>Restore<//>
            <${UI.ConfirmBtn} sm=${true} kind="ghost" onConfirm=${() => purge(t)}>Delete for good<//>
          </span>
        </div>`)}
      </div>` : html`<div class="small ink62">Nothing deleted. When someone deletes a task it waits here, and your inbox gets a flag.</div>`}
    <//>`;
  }

  function ArchivedClientsCard() {
    const ctx = M.useCtx();
    const arch = (ctx.coll.clients && ctx.coll.clients.archived) || {};
    const list = Object.keys(arch).map(id => ({id, ...arch[id]})).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    if (!ctx.isFounder) return null;
    const restore = c => ctx.W.update('clients/' + c.id, {archived: false, archivedAt: null, archivedBy: null, updated: Date.now()}).then(() => M.toast('Back in Clients')).catch(() => {});
    return html`<${UI.Card} id="archived-clients" title="Archived clients" action=${html`<span class="tiny ink62 num">${list.length}</span>`}>
      ${list.length ? html`<div class="stack tight">
        ${list.map(c => html`<div key=${c.id} class="row between brk-row" id=${'arch-' + c.id}>
          <div class="grow" style=${{minWidth: 0}}><div>${c.name}</div><div class="tiny ink62">archived ${c.archivedAt ? U.timeAgo(c.archivedAt) : ''}${c.archivedBy ? html` by <${UI.Name} id=${c.archivedBy}/>` : ''}</div></div>
          <${UI.Btn} sm=${true} kind="sec" onClick=${() => restore(c)}>Restore<//>
        </div>`)}
      </div>` : html`<div class="small ink62">Nothing archived. A client is archived from its page once nothing open points at it; its history stays.</div>`}
    <//>`;
  }
  M.superCards = (M.superCards || []).concat([TrashCard, ArchivedClientsCard]);
})();
