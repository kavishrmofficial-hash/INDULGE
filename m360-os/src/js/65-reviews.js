/* module: reviews. The creative approval queue: everything in review, with Approve and Send back.
   The founder reviews all of it; a project owner reviews their project's tasks; everyone sees
   where their own work stands. A send back counts a revision and lands in the owner's inbox. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useRef} = React;

  /* the founder, or anyone on the task's project (its owner or a member) who does not own the task */
  const canReview = (ctx, t) => {
    if (ctx.isFounder) return true;
    if (!t || t.owner === ctx.uid || !t.project) return false;
    const p = ctx.coll.projects.map[t.project];
    return !!p && (p.owner === ctx.uid || (Array.isArray(p.members) && p.members.indexOf(ctx.uid) >= 0));
  };

  /* the newest copy of a task this page can get: a fresh read where the store gives one, else the synced copy */
  const latest = (ctx, id) => Promise.resolve()
    .then(() => ctx.db.doc('tasks/' + id).get())
    .then(s => (s && s.exists ? U.dropNulls(s.data()) : null), () => null)
    .then(d => d || ctx.coll.tasks.map[id] || null);
  const stateLine = cur => !cur || cur.deleted ? 'This task is gone.'
    : cur.status === 'done' ? 'Already approved. It stays shipped.'
    : 'Already sent back. It is with the owner.';

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
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const href = t.link && /^https?:/i.test(t.link) ? t.link : (t.link ? 'https://' + t.link : null);
    /* v39: one decision per task. A double tap writes once, and a task another reviewer already moved out of
       review is left as it is, with a line saying so */
    const decide = async fn => {
      if (busyRef.current) return;
      busyRef.current = true; setBusy(true);
      try {
        const cur = await latest(ctx, t.id);
        if (!cur || cur.status !== 'review') { M.toast(stateLine(cur), true); return; }
        await fn(cur);
      } catch (e) { /* the write layer toasts the failure */ } finally { busyRef.current = false; setBusy(false); }
    };
    const approve = () => decide(async () => {
      const now = Date.now();
      await ctx.W.update('tasks/' + t.id, {status: 'done', doneAt: now, approvedBy: ctx.uid, approvedAt: now, updated: now});
      await M.tasks.sign(ctx, t.id);
      M.burst(document.getElementById('rev-' + t.id));
      M.toast('Approved. Shipped.');
    });
    const sendBack = () => decide(async cur => {
      const sp = M.tasks.statusPatch(cur, 'doing', ctx.uid);
      const now = sp.patch.updated;
      const patch = {...sp.patch, sentBackNote: note.trim().slice(0, 240)};
      if (note.trim()) patch.comments = {[U.uid()]: {by: ctx.uid, t: 'Sent back: ' + note.trim(), at: now}};
      await ctx.W.update('tasks/' + t.id, patch);
      M.sound.play('soft');
      M.toast('Sent back, revision ' + sp.patch.revisions);
    });
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
          <${UI.Btn} kind="flame" sm=${true} disabled=${busy} onClick=${sendBack}>Send back<//>
          <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setBack(false)}>Cancel<//>
        </div>` : null}
      </div>
      ${mine && !back ? html`<span class="row nowrap">
        <button type="button" class="btn sm" disabled=${busy} onClick=${approve}><${icons.check}/>Approve</button>
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
    /* while work waits on you, the card itself carries the beam */
    return html`<${UI.Card} id="reviews" flame=${mine.length > 0} title=${compact ? 'Waiting on your review' : 'Reviews'}
      action=${html`<span class=${'pill ' + (mine.length ? 'flame' : 'warm')}>${mine.length} on you</span>`}>
      ${!compact ? html`<p class="small ink62" style=${{marginTop: 0}}>Work in review, oldest first. Approve ships it, send back counts a revision and tells the owner why.${M.tasks && M.tasks.signoffOn(ctx) ? ' Sign-off is on: nothing counts as done until someone here approves it.' : ''}</p>` : null}
      ${list.length ? list.map(t => html`<${Row} key=${t.id} t=${t} onOpen=${setOpen}/>`)
        : html`<${UI.Empty} text=${theirs.length ? 'Nothing waiting on you. ' + theirs.length + ' of yours ' + (theirs.length === 1 ? 'is' : 'are') + ' with the reviewers.' : 'Nothing in review right now.'}/>`}
      ${open && D ? html`<${D} taskId=${open} onClose=${() => setOpen(null)}/>` : null}
    <//>`;
  }

  M.reviews = {queue, canReview};
  M.parts.Reviews = Reviews;
})();
