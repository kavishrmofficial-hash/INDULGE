/* module: reviews. The creative approval queue: everything in review, with Approve and Send back.
   The founder reviews all of it; a project owner reviews their project's tasks; everyone sees
   where their own work stands. A send back counts a revision and lands in the owner's inbox. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState} = React;

  const canReview = (ctx, t) => ctx.isFounder || (t.project && ctx.coll.projects.map[t.project] && ctx.coll.projects.map[t.project].owner === ctx.uid);

  function queue(ctx) {
    const map = ctx.coll.tasks.map;
    return Object.keys(map).map(id => ({id, ...map[id]})).filter(t => t.status === 'review')
      .sort((a, b) => (a.reviewAt || a.updated || 0) - (b.reviewAt || b.updated || 0));
  }

  function Row({t, onOpen}) {
    const ctx = M.useCtx();
    const [note, setNote] = useState('');
    const [back, setBack] = useState(false);
    const mine = canReview(ctx, t);
    const href = t.link && /^https?:/i.test(t.link) ? t.link : (t.link ? 'https://' + t.link : null);
    const approve = async () => {
      const now = Date.now();
      await ctx.W.update('tasks/' + t.id, {status: 'done', doneAt: now, approvedBy: ctx.uid, approvedAt: now, updated: now}).catch(() => {});
      M.burst(document.getElementById('rev-' + t.id));
      M.toast('Approved. Shipped.');
    };
    const sendBack = async () => {
      const now = Date.now();
      const revisions = (Number(t.revisions) || 0) + 1;
      const patch = {status: 'doing', revisions, sentBackAt: now, sentBackBy: ctx.uid, sentBackNote: note.trim().slice(0, 240), updated: now};
      if (note.trim()) patch.comments = {[U.uid()]: {by: ctx.uid, t: 'Sent back: ' + note.trim(), at: now}};
      await ctx.W.update('tasks/' + t.id, patch).catch(() => {});
      M.sound.play('soft');
      M.toast('Sent back, revision ' + revisions);
    };
    const pName = t.project && ctx.coll.projects.map[t.project] ? ctx.coll.projects.map[t.project].name : '';
    return html`<div class="rev-row" id=${'rev-' + t.id}>
      <${UI.Avatar} id=${t.owner} size=${34}/>
      <div class="grow" style=${{minWidth: 0}}>
        <div class="row" style=${{gap: '8px'}}>
          <button type="button" class="linky t" onClick=${() => onOpen(t.id)}>${t.title}</button>
          ${Number(t.revisions) > 0 ? html`<span class="pill flame-o">${t.revisions} rev</span>` : null}
          ${t.shown20 ? html`<span class="pill">20% shown</span>` : null}
        </div>
        <div class="tiny ink62"><${UI.Name} id=${t.owner}/>${pName ? ' · ' + pName : ''} · waiting ${U.timeAgo(t.reviewAt || t.updated || ctx.now)}${href ? html` · <a class="linky" href=${href} target="_blank" rel="noopener noreferrer">open the output</a>` : ''}</div>
        ${mine && back ? html`<div class="row" style=${{marginTop: '8px'}}>
          <input class="input" style=${{maxWidth: '360px', minHeight: '38px'}} placeholder="What to change, one line" value=${note} onInput=${e => setNote(e.target.value)} aria-label="Send back note"/>
          <${UI.Btn} kind="flame" sm=${true} onClick=${sendBack}>Send back<//>
          <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setBack(false)}>Cancel<//>
        </div>` : null}
      </div>
      ${mine && !back ? html`<span class="row nowrap">
        <${UI.Btn} sm=${true} onClick=${approve}><${icons.check}/>Approve<//>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setBack(true)}>Send back<//>
      </span>` : null}
    </div>`;
  }

  function Reviews({compact}) {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null);
    const all = queue(ctx);
    const mine = all.filter(t => canReview(ctx, t));
    const theirs = all.filter(t => !canReview(ctx, t) && t.owner === ctx.uid);
    const list = compact ? mine : all;
    const D = M.parts.TaskDrawer;
    if (compact && !mine.length) return null;
    return html`<${UI.Card} id="reviews" title=${compact ? 'Waiting on your review' : 'Reviews'}
      action=${html`<span class=${'pill ' + (mine.length ? 'flame' : 'warm')}>${mine.length} on you</span>`}>
      ${!compact ? html`<p class="small ink62" style=${{marginTop: 0}}>Work in review, oldest first. Approve ships it, send back counts a revision and tells the owner why.</p>` : null}
      ${list.length ? list.map(t => html`<${Row} key=${t.id} t=${t} onOpen=${setOpen}/>`)
        : html`<${UI.Empty} text=${theirs.length ? 'Nothing waiting on you. ' + theirs.length + ' of yours ' + (theirs.length === 1 ? 'is' : 'are') + ' with the reviewers.' : 'Nothing in review right now.'}/>`}
      ${open && D ? html`<${D} taskId=${open} onClose=${() => setOpen(null)}/>` : null}
    <//>`;
  }

  M.reviews = {queue, canReview};
  M.parts.Reviews = Reviews;
})();
