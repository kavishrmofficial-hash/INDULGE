/* module: inbox. Everything that happened to you, derived live from the data you can already see:
   tasks handed to you, work sent back or approved, kudos, mentions, leave decisions, announcements,
   people asking to join (founder), correction requests and their decisions. Nothing is stored except when you last looked (me/<uid>.inboxSeen). */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const KEEP_DAYS = 21;

  function items(ctx) {
    const out = [];
    const me = ctx.uid, since = ctx.now - KEEP_DAYS * 86400000;
    const push = (id, kind, at, text, ref, actor, hot) => { if (at >= since) out.push({id, kind, at, text, ref, actor, hot: !!hot}); };
    const nm = id => html`<${UI.Name} id=${id}/>`;

    /* tasks */
    const tmap = ctx.coll.tasks.map;
    for (const id of Object.keys(tmap)) {
      const t = tmap[id];
      if (!t) continue;
      const mine = t.owner === me;
      if (mine && t.by && t.by !== me) push('assign:' + id, 'tasks', t.created || 0, html`${nm(t.by)} handed you ${t.title}`, '#tasks/' + id, t.by);
      if (mine && t.status === 'done' && t.doneAt && t.approvedBy && t.approvedBy !== me) push('ok:' + id, 'review', t.doneAt, html`${nm(t.approvedBy)} approved ${t.title}`, '#tasks/' + id, t.approvedBy);
      if (mine && t.sentBackAt && t.sentBackBy && t.sentBackBy !== me) push('back:' + id, 'review', t.sentBackAt, html`${nm(t.sentBackBy)} sent ${t.title} back${t.sentBackNote ? ': ' + t.sentBackNote : ''}`, '#tasks/' + id, t.sentBackBy, true);
      if (!mine && t.status === 'review' && t.reviewAt && (ctx.isFounder || (t.project && ctx.coll.projects.map[t.project] && ctx.coll.projects.map[t.project].owner === me)))
        push('rev:' + id, 'review', t.reviewAt, html`${nm(t.owner)} put ${t.title} up for review`, '#reviews', t.owner);
      const cs = t.comments || {};
      for (const cid of Object.keys(cs)) {
        const c = cs[cid];
        if (!c || c.by === me) continue;
        const mentioned = (c.mentions || []).includes(me);
        if (mentioned || mine) push('cm:' + cid, 'feed', c.at || 0, html`${nm(c.by)}${mentioned ? ' mentioned you on ' : ' commented on '}${t.title}`, '#tasks/' + id, c.by, mentioned);
      }
    }
    /* kudos to me */
    const kmap = ctx.coll.kudos.map;
    for (const giver of Object.keys(kmap)) for (const k of (kmap[giver].given || [])) {
      if (k && k.to === me && giver !== me) push('k:' + k.id, 'scores', k.at || 0, html`${nm(giver)} gave you kudos: ${k.why}`, '#feed', giver, true);
    }
    /* leave decisions on my requests */
    const dec = ((ctx.coll.leavedec.map[me] || {}).d) || {};
    const reqs = ((ctx.coll.leave.map[me] || {}).reqs) || [];
    for (const r of reqs) {
      const d = r && dec[r.id];
      if (d && d.at) push('lv:' + r.id, 'leave', d.at, html`Leave ${U.fmtDate(r.from)}${r.to !== r.from ? ' to ' + U.fmtDate(r.to) : ''} ${d.status}`, '#leave', null, d.status === 'declined');
    }
    /* announcements */
    const fmap = ctx.coll.feed.map;
    for (const author of Object.keys(fmap)) for (const p of (fmap[author].posts || [])) {
      if (p && p.kind === 'announce' && author !== me) push('an:' + p.id, 'feed', p.at || 0, html`${nm(author)} announced: ${String(p.text).slice(0, 90)}`, '#feed', author, true);
      if (p && p.kind === 'poll' && author !== me && !((p.votes || {})[me]) && ((((ctx.coll.votes || {}).map || {})[me] || {}).polls || {})[author + ':' + p.id] === undefined) push('poll:' + p.id, 'feed', p.at || 0, html`${nm(author)} asked: ${String(p.text).slice(0, 80)}`, '#feed', author);
    }
    /* chat: direct messages and mentions since the read mark */
    if (M.rooms && ctx.coll.chat) {
      const myName = ((ctx.coll.me.map[me] || {}).name) || '';
      for (const it of M.rooms.inboxItems(ctx, myName)) push(it.id, 'chat', it.m.at || 0, html`${nm(it.m.by)}${it.dm ? '' : ' in #' + it.room}: ${String(it.m.text).slice(0, 90)}`, '#chat/' + it.room, it.m.by, it.dm);
    }
    /* founder: joins and leave requests */
    if (ctx.isFounder) {
      (M.team ? M.team.requests(ctx) : []).forEach(r => push('join:' + r.uid, 'people', r.at, html`${nm(r.uid)} wants to join the team`, '#admin', r.uid, true));
      if (M.leave && M.leave.pending) M.leave.pending(ctx).forEach(({uid, req}) => push('lvr:' + req.id, 'leave', req.at || 0, html`${nm(uid)} asked for leave, ${M.leave.rangeText(req)}`, '#admin', uid));
    }
    /* corrections: the founder sees each pending request, the person sees the decision */
    if (M.fixes && M.fixes.pending) {
      const kl = M.fixes.KIND_LABEL || {};
      if (ctx.isFounder) M.fixes.pending(ctx).forEach(({uid, id, req}) => { if (uid !== me) push('fix:' + id, 'fix', req.at || 0, html`${nm(uid)} asked for a correction: ${kl[req.kind] || 'other'}`, '#admin', uid); });
      const mine = ((ctx.coll.fixes.map[me] || {}).reqs) || {};
      for (const id of Object.keys(mine)) {
        const r = mine[id];
        if (!r || !r.decidedAt || M.fixes.statusOf(r) === 'pending') continue;
        push('fixd:' + id, 'fix', r.decidedAt, html`Correction ${r.status}, ${kl[r.kind] || 'other'}${r.date ? ' ' + U.fmtDate(r.date) : ''}${r.decidedNote ? ': ' + r.decidedNote : ''}`, '#me', null, r.status === 'declined');
      }
    }
    /* celebrations */
    if (M.trophies && M.trophies.today) M.trophies.today(ctx).forEach(c => { if (c.uid !== me) push('cel:' + c.uid + c.kind, 'gift', U.parseYmd(U.todayStr()).getTime(), html`${nm(c.uid)}: ${c.text}`, '#home', c.uid); });
    out.sort((a, b) => b.at - a.at);
    return out.slice(0, 60);
  }

  const seenAt = ctx => Number(((ctx.coll.me.map[ctx.uid] || {}).inboxSeen) || 0);
  const unread = ctx => items(ctx).filter(i => i.at > seenAt(ctx)).length;

  const KIND_ICON = {tasks: 'tasks', review: 'review', feed: 'feed', scores: 'scores', leave: 'leave', people: 'people', gift: 'gift', fix: 'fix', chat: 'send'};

  function Inbox({onClose}) {
    const ctx = M.useCtx();
    const list = items(ctx);
    const seen = seenAt(ctx);
    const [was] = useState(seen);
    useEffect(() => {
      if (list.some(i => i.at > seen)) ctx.W.merge('me/' + ctx.uid, {inboxSeen: Date.now()}).catch(() => {});
    }, []);
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Inbox">
      ${list.length ? html`<div class="stack" style=${{gap: 0}}>
        ${list.map(i => html`<button type="button" key=${i.id} class=${'inbox-item' + (i.at > was ? ' unread' : '')} onClick=${() => { onClose(); M.nav(i.ref); }}>
          ${i.actor ? html`<${UI.Avatar} id=${i.actor} size=${34}/>` : html`<span class=${'inbox-kind' + (i.hot ? ' hot' : '')}><${icons[KIND_ICON[i.kind] || 'feed']}/></span>`}
          <span class="grow">
            <div class="t">${i.text}</div>
            <div class="tiny ink62">${U.timeAgo(i.at)}</div>
          </span>
          ${i.at > was ? html`<span class="dotflame"/>` : null}
        </button>`)}
      </div>` : html`<${UI.Empty} text="Nothing yet. Assignments, kudos, mentions and decisions land here."/>`}
    <//>`;
  }

  M.inbox = {items, unread, seenAt};
  M.parts.Inbox = Inbox;
})();
