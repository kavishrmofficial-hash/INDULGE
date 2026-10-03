/* module: tasks. The board, the task drawer and the task helpers. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const STATUSES = [
    {v: 'todo', label: 'To do'},
    {v: 'doing', label: 'Doing'},
    {v: 'review', label: 'In review'},
    {v: 'done', label: 'Done'}
  ];
  const PRIORITIES = [{v: 'low', label: 'Low'}, {v: 'normal', label: 'Normal'}, {v: 'high', label: 'High'}];
  const WHO = [{v: 'mine', label: 'Mine'}, {v: 'all', label: 'Everyone'}];
  const DONE_WINDOW_MS = 14 * 86400000;
  const SEL_STYLE = {flex: '1 1 160px', maxWidth: '260px'};

  /* ---------- pure helpers ---------- */
  const isOverdue = (task, todayYmd) =>
    !!(task && task.due && task.status !== 'done' && task.due < (todayYmd || U.todayStr()));

  const byDue = (a, b) => {
    const da = a.due || '9999-12-31', db = b.due || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return (a.created || 0) - (b.created || 0);
  };

  const allTasks = ctx => {
    const map = (ctx && ctx.coll && ctx.coll.tasks && ctx.coll.tasks.map) || {};
    return Object.keys(map).filter(id => map[id]).map(id => ({id, ...map[id]}));
  };

  /* open tasks with id, soonest due first */
  const open = ctx => allTasks(ctx).filter(t => t.status !== 'done').sort(byDue);

  const progress = (ctx, projectId) => {
    const today = U.todayStr();
    const out = {done: 0, total: 0, overdue: 0};
    for (const t of allTasks(ctx)) {
      if (t.project !== projectId) continue;
      out.total++;
      if (t.status === 'done') out.done++;
      else if (isOverdue(t, today)) out.overdue++;
    }
    return out;
  };

  /* "22 Sep" */
  const dueLabel = ymd => U.fmtDay(ymd).split(' ').slice(1).join(' ');

  const subCount = task => {
    const s = (task && task.subtasks) || {};
    const keys = Object.keys(s);
    return {total: keys.length, done: keys.filter(k => s[k] && s[k].done).length};
  };

  const nameOf = (map, id) => (id && map && map[id] && map[id].name) || '';

  const sortedOpts = map => Object.keys(map || {})
    .filter(id => map[id] && !map[id].archived)
    .map(id => ({v: id, label: map[id].name || id}))
    .sort((a, b) => a.label.localeCompare(b.label));

  /* user text becomes a plain https link, so the href only ever carries http or https */
  const safeHref = link => {
    const s = String(link || '').trim();
    if (!s) return null;
    return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
  };

  const revNote = n => n > 0 ? n + (n === 1 ? ' revision' : ' revisions') : 'No revisions yet';

  /* ---------- sign-off: done is a decision, not a self-declaration ----------
     While it is on (Admin > Settings, on by default), only the founder or a reviewer of the task (someone on
     its project who does not own it) marks work done. Anyone else asking for done sends it for sign-off
     instead, and the sign-off makes it done, so points land only on work somebody else has seen. Work done
     before the day sign-off began counts as it was. */
  const SIGNOFF_SINCE = Date.UTC(2026, 9, 1);
  const signoffOn = ctx => !!ctx && !!ctx.settings && ctx.settings.signoff !== false;
  const canSign = (ctx, t) => !!ctx && (ctx.isFounder || !!(M.reviews && M.reviews.canReview(ctx, t || {})));
  const gate = (ctx, t, status) => (status === 'done' && signoffOn(ctx) && !canSign(ctx, t || {owner: ctx.uid})) ? 'review' : status;
  /* the sign-off itself lives in the signer's own approvals document, which nobody else can write; a task's
     approvedBy field alone proves nothing */
  const sign = (ctx, id) => ctx.W.merge('approvals/' + ctx.uid, {ok: {[id]: Date.now()}}).catch(() => {});
  const signedBy = (ctx, who, id) => !!(ctx.coll.approvals && ctx.coll.approvals.map[who] && (ctx.coll.approvals.map[who].ok || {})[id]);
  const mayHaveSigned = (ctx, who, t) => who === ctx.founderUid || (!!t.project && !!ctx.coll.projects.map[t.project] && (ctx.coll.projects.map[t.project].owner === who || (ctx.coll.projects.map[t.project].members || []).indexOf(who) >= 0));
  /* a done task that counts for points: signed off by someone allowed to, or the founder's own, or from before
     sign-off began, or sign-off is off */
  const counted = (ctx, t) => !!t && t.status === 'done' && (!signoffOn(ctx) || t.owner === ctx.founderUid || (Number(t.doneAt) || 0) < SIGNOFF_SINCE
    || (!!t.approvedBy && t.approvedBy !== t.owner && signedBy(ctx, t.approvedBy, t.id) && mayHaveSigned(ctx, t.approvedBy, t)));
  /* one status write with its sign-off recorded */
  const commit = (ctx, id, sp) => ctx.W.update('tasks/' + id, sp.patch).then(r => { if (sp.patch.approvedBy) return sign(ctx, id).then(() => r); return r; });
  /* the status options for one task as this person sees them */
  const statusOpts = (ctx, t) => STATUSES.map(s => s.v === 'done' && signoffOn(ctx) && !canSign(ctx, t || {owner: ctx.uid}) ? {...s, label: 'Sign-off'} : s);

  /* one status change, with the bookkeeping every path shares: the gate, review time, revisions, done
     time, who signed it off. Pass ctx so the gate applies; without it the change is taken as asked. */
  function statusPatch(task, status, uid, ctx) {
    const now = Date.now();
    const prev = (task && task.status) || 'todo';
    const asked = status;
    status = ctx ? gate(ctx, task, status) : status;
    const patch = {status, updated: now};
    let msg = 'Moved to ' + (STATUSES.find(x => x.v === status) || {label: status}).label.toLowerCase();
    if (prev === 'review' && (status === 'doing' || status === 'todo')) {
      patch.revisions = (Number(task && task.revisions) || 0) + 1;
      patch.sentBackAt = now; patch.sentBackBy = uid;
      msg = 'Sent back, revision ' + patch.revisions;
    }
    if (status === 'review' && prev !== 'review') { patch.reviewAt = now; if (asked === 'done') msg = 'Sent for sign-off'; }
    if (status === 'done') {
      if (prev !== 'done' || !(task && task.doneAt)) patch.doneAt = now;
      msg = 'Shipped';
      if (ctx && canSign(ctx, task)) { patch.approvedBy = uid; patch.approvedAt = now; }
    } else { patch.doneAt = null; patch.approvedBy = null; patch.approvedAt = null; }
    return {patch, msg, status};
  }
  async function moveTask(ctx, task, status, el) {
    if (!task || task.status === status) return;
    const sp = statusPatch(task, status, ctx.uid, ctx);
    const {msg, status: st} = sp;
    if (task.status === st) { M.toast(st === 'review' ? 'Waiting for sign-off' : msg); return; }
    await commit(ctx, task.id, sp).catch(() => {});
    if (st === 'done') M.rain('🔥', el || document.body, {n: 56}); else M.sound.play('tick');
    M.toast(msg);
  }
  /* a task is never erased by its owner: it goes to the founder's bin, with who and when, and can come back */
  const binTask = (ctx, id) => ctx.W.update('tasks/' + id, {deleted: true, deletedBy: ctx.uid, deletedAt: Date.now(), updated: Date.now()});

  /* @mentions: names in a comment become ids the inbox can use */
  function useMentions(text, setText) {
    const ctx = M.useCtx();
    const ids = ctx.activeMembers.map(m => m.uid);
    const profs = M.useProfiles(ids);
    const people = ids.map(id => ({id, name: (profs[id] && profs[id].name) || (ctx.members[id] || {}).empId || 'Someone'}));
    const at = /(^|\s)@([\w ]{0,24})$/.exec(text || '');
    const q = at ? at[2].toLowerCase() : null;
    const hits = q == null ? [] : people.filter(p => p.name.toLowerCase().startsWith(q)).slice(0, 5);
    const pick = p => setText(String(text).replace(/(^|\s)@([\w ]{0,24})$/, '$1@' + p.name + ' '));
    const mentionsIn = t => people.filter(p => String(t || '').includes('@' + p.name)).map(p => p.id);
    return {hits, pick, mentionsIn};
  }
  function MentionMenu({hits, pick}) {
    if (!hits.length) return null;
    return html`<div class="mention-menu" style=${{position: 'relative', marginTop: '-4px'}}>
      ${hits.map((p, i) => html`<button type="button" key=${p.id} class=${i === 0 ? 'on' : ''} onMouseDown=${e => { e.preventDefault(); pick(p); }}>
        <${UI.Avatar} id=${p.id} size=${20}/>${p.name}</button>`)}
    </div>`;
  }
  /* comment text with @Name runs shown in flame */
  function CommentText({text, names}) {
    const parts = String(text || '').split(/(@[A-Z][\w]*(?: [A-Z][\w]*)?)/g);
    return html`<span>${parts.map((p, i) => p.startsWith('@') && names.some(n => p === '@' + n) ? html`<span key=${i} class="mention">${p}</span>` : p)}</span>`;
  }

  /* ---------- card ---------- */
  function TaskCard({task, projects, clients, today, onOpen, onDrag, beam}) {
    const pName = nameOf(projects, task.project);
    const cName = nameOf(clients, task.client);
    const overdue = isOverdue(task, today);
    const sc = subCount(task);
    const rev = Number(task.revisions) || 0;
    const down = useRef(null);
    const onDown = e => { if (e.button !== 0 || e.target.closest('.grip')) return; down.current = {x: e.clientX, y: e.clientY, el: e.currentTarget}; };
    const onMove = e => {
      const d = down.current;
      if (!d || !onDrag || e.pointerType !== 'mouse') return;
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 6) { down.current = null; onDrag(task, e, d.el); }
    };
    const onUp = () => { down.current = null; };
    const card = html`<button type="button" class="tcard" data-task=${task.id} onClick=${() => onOpen(task.id)}
      onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
      <div class="row between nowrap" style=${{gap: '6px', alignItems: 'flex-start'}}>
        <div class="t grow">${task.title || 'Untitled'}</div>
        ${onDrag ? html`<span class="grip" aria-label="Drag" onPointerDown=${e => { e.stopPropagation(); onDrag(task, e, e.currentTarget.closest('.tcard')); }}><${icons.grip}/></span>` : null}
      </div>
      ${(pName || cName) ? html`<div class="row" style=${{gap: '6px', overflow: 'hidden'}}>
        ${pName ? html`<${UI.Pill} kind="warm">${pName}<//>` : null}
        ${cName ? html`<${UI.Pill} kind="warm">${cName}<//>` : null}
      </div>` : null}
      <div class="row between nowrap" style=${{gap: '6px'}}>
        <div class="row grow" style=${{gap: '6px'}}>
          ${task.due ? html`<${UI.Pill} kind=${overdue ? 'flame' : undefined}>${overdue ? 'overdue ' : 'due '}${dueLabel(task.due)}<//>` : null}
          ${task.priority === 'high' ? html`<${UI.Pill} kind="flame">high<//>` : null}
          ${rev > 0 ? html`<${UI.Pill} kind="flame-o">${rev} rev<//>` : null}
          ${task.shown20 ? html`<${UI.Pill}>20% shown<//>` : null}
          ${sc.total > 0 ? html`<${UI.Pill} kind=${sc.done === sc.total ? 'ink' : undefined}>${sc.done} of ${sc.total}<//>` : null}
        </div>
        ${task.owner ? html`<${UI.Avatar} id=${task.owner} size=${22}/>` : null}
      </div>
    </button>`;
    /* the most overdue card on the board carries the beam, one card only */
    return beam ? html`<${M.fx.Beam} radius=${14}>${card}<//>` : card;
  }

  /* ---------- drawer ---------- */
  function TaskDrawer({taskId, onClose, defaults}) {
    const ctx = M.useCtx();
    const {W, uid} = ctx;
    const tasksMap = (ctx.coll.tasks && ctx.coll.tasks.map) || {};
    const projects = (ctx.coll.projects && ctx.coll.projects.map) || {};
    const clients = (ctx.coll.clients && ctx.coll.clients.map) || {};
    const task = taskId ? tasksMap[taskId] : null;
    const isNew = !taskId;
    const d = defaults || {};
    const path = 'tasks/' + taskId;

    const init = () => ({
      title: task ? (task.title || '') : '',
      status: task ? (task.status || 'todo') : 'todo',
      owner: task ? (task.owner || '') : (d.owner || uid),
      due: task ? (task.due || '') : (d.due || ''),
      priority: task ? (task.priority || 'normal') : 'normal',
      project: task ? (task.project || '') : (d.project || ''),
      section: task ? (task.section || '') : (d.section || ''),
      client: task ? (task.client || '') : (d.client || ''),
      link: task ? (task.link || '') : '',
      shown20: task ? !!task.shown20 : false
    });
    const [f, setF] = useState(init);
    const [localSubs, setLocalSubs] = useState({});
    const [subText, setSubText] = useState('');
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const mention = useMentions(comment, setComment);
    const memberNames = Object.values(M.useProfiles(ctx.activeMembers.map(m => m.uid))).map(p => p.name).filter(Boolean);
    const mounted = useRef(false);
    const hasTask = !!task;
    useEffect(() => {
      if (!mounted.current) { mounted.current = true; return; }
      setF(init());
      setLocalSubs({});
      setSubText('');
    }, [taskId, hasTask]);

    const set = k => v => setF(x => ({...x, [k]: v}));

    /* owner options: active members, plus the current owner and me when missing */
    const memberIds = ctx.activeMembers.map(m => m.uid);
    if (f.owner && !memberIds.includes(f.owner)) memberIds.push(f.owner);
    if (!memberIds.includes(uid)) memberIds.push(uid);
    const profs = M.useProfiles(memberIds);
    const ownerOpts = [{v: '', label: 'No owner'}].concat(memberIds.map(id => ({
      v: id, label: (profs[id] && profs[id].name) || (ctx.members[id] || {}).empId || 'Someone'
    })));
    const projOpts = [{v: '', label: 'No project'}].concat(sortedOpts(projects));
    const clientOpts = [{v: '', label: 'No client'}].concat(sortedOpts(clients));
    const secs = ((projects[f.project] || {}).sections) || [];
    const secOpts = [{v: '', label: 'No section'}].concat(secs.map(s => ({v: s.id, label: s.name || s.id})));

    const onProject = pid => setF(x => {
      const p = projects[pid];
      const list = (p && p.sections) || [];
      const section = list.some(s => s.id === x.section) ? x.section : '';
      const client = x.client || (p && p.client) || '';
      return {...x, project: pid, section, client};
    });

    /* subtasks stay in local state until the task exists, then every change writes live */
    const subs = isNew ? localSubs : ((task && task.subtasks) || {});
    const subList = Object.keys(subs).filter(k => subs[k]).map(k => ({id: k, ...subs[k]})).sort((a, b) => (a.o || 0) - (b.o || 0));
    const addSub = text => {
      const t = String(text || '').trim();
      if (!t) return;
      const id = U.uid();
      const entry = {t, done: false, o: Date.now()};
      setSubText('');
      if (isNew) setLocalSubs(x => ({...x, [id]: entry}));
      else W.update(path, {subtasks: {[id]: entry}, updated: Date.now()}).catch(() => {});
    };
    const tickSub = (id, done) => {
      if (isNew) setLocalSubs(x => ({...x, [id]: {...x[id], done}}));
      else W.update(path, {subtasks: {[id]: {done}}, updated: Date.now()}).catch(() => {});
    };
    const delSub = id => {
      if (isNew) { setLocalSubs(x => { const y = {...x}; delete y[id]; return y; }); return; }
      const cur = tasksMap[taskId];
      if (!cur) return;
      const doc = U.clone(cur);
      doc.subtasks = doc.subtasks || {};
      delete doc.subtasks[id];
      doc.updated = Date.now();
      W.set(path, doc).catch(() => {});
    };

    /* comments, oldest first */
    const comments = (task && task.comments) || {};
    const cList = Object.keys(comments).filter(k => comments[k]).map(k => ({id: k, ...comments[k]})).sort((a, b) => (a.at || 0) - (b.at || 0));
    const addComment = async () => {
      const t = comment.trim();
      if (!t || isNew) return;
      setBusy(true);
      try {
        await W.update(path, {comments: {[U.uid()]: {by: uid, t, at: Date.now(), mentions: mention.mentionsIn(t)}}, updated: Date.now()});
        setComment('');
        M.sound.play('soft');
        M.toast('Comment added');
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
    };

    const save = async () => {
      const title = f.title.trim();
      if (!title) { M.toast('Give the task a title.', true); return; }
      setBusy(true);
      const now = Date.now();
      let ok = false;
      try {
        if (isNew) {
          const id = U.uid();
          const draft = {owner: f.owner, project: f.project};
          const st = gate(ctx, draft, f.status);
          await W.set('tasks/' + id, {
            title, owner: f.owner, client: f.client, project: f.project, section: f.section, due: f.due,
            status: st, priority: f.priority, link: f.link.trim(), revisions: 0, shown20: !!f.shown20,
            subtasks: localSubs, comments: {}, by: uid, created: now, updated: now,
            doneAt: st === 'done' ? now : null, ...(st === 'done' && canSign(ctx, draft) ? {approvedBy: uid, approvedAt: now} : {}), ...(st === 'review' ? {reviewAt: now} : {})
          });
          if (st === 'done' && canSign(ctx, draft)) await sign(ctx, id);
          M.toast(st === 'review' && f.status === 'done' ? 'Task created, sent for sign-off' : 'Task created');
        } else {
          const prev = (task && task.status) || 'todo';
          const sp = prev === f.status ? {patch: {doneAt: (task && task.doneAt) || null}, msg: 'Saved', status: prev} : statusPatch(task, f.status, uid, ctx);
          /* a shipped task keeps its owner, dates and project unless the founder changes them; the 20% mark is a reviewer's call */
          const locked = task.status === 'done' && !ctx.isFounder;
          const fx = locked ? {owner: task.owner || '', due: task.due || '', project: task.project || '', client: task.client || '', section: task.section || ''} : {owner: f.owner, due: f.due, project: f.project, client: f.client, section: f.section};
          if (locked && (fx.owner !== f.owner || fx.due !== f.due || fx.project !== f.project)) M.toast('A shipped task keeps its owner, due date and project. Ask the founder to change those.');
          const shown20 = canSign(ctx, task) ? !!f.shown20 : !!task.shown20;
          const logs = {};
          if ((task.due || '') !== (fx.due || '')) logs.dueLog = (Array.isArray(task.dueLog) ? task.dueLog : []).slice(-9).concat([{from: task.due || '', to: fx.due || '', by: uid, at: now}]);
          if ((task.owner || '') !== (fx.owner || '')) logs.ownerLog = (Array.isArray(task.ownerLog) ? task.ownerLog : []).slice(-9).concat([{from: task.owner || '', to: fx.owner || '', by: uid, at: now}]);
          await W.update(path, {
            title, ...fx, priority: f.priority, link: f.link.trim(), shown20, ...logs, ...sp.patch, status: sp.status, updated: now
          });
          if (sp.patch.approvedBy) await sign(ctx, taskId);
          if (sp.status === 'done' && prev !== 'done') M.burst(document.querySelector('.drawer-foot'));
          M.toast(sp.msg);
        }
        ok = true;
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
      if (ok) onClose();
    };

    const canDelete = !isNew && !!task && (task.by === uid || ctx.isFounder);
    const delTask = async () => {
      try {
        await binTask(ctx, taskId);
        M.toast(ctx.isFounder ? 'Task deleted. It sits in the bin on Admin for thirty days.' : 'Task deleted. The founder can bring it back.');
        onClose();
      } catch (e) { /* the write layer toasts the failure */ }
    };

    const href = safeHref(f.link);
    const rev = Number(task && task.revisions) || 0;

    const footer = html`<${React.Fragment}>
      ${canDelete ? html`<div class="grow"><${UI.ConfirmBtn} onConfirm=${delTask}>Delete<//></div>` : null}
      <${UI.Btn} disabled=${busy} onClick=${save}>${isNew ? 'Create task' : 'Save'}<//>
    <//>`;

    if (!isNew && !task) {
      return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Task">
        <${UI.Empty} text="This task is gone."/>
      <//>`;
    }

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${isNew ? 'New task' : 'Task'} footer=${footer}>
      <${UI.Input} id="task-title" label="title" value=${f.title} onChange=${set('title')} placeholder="What needs to happen"/>
      <${UI.Field} label="status">
        <${UI.Seg} options=${statusOpts(ctx, isNew ? {owner: f.owner, project: f.project} : task)} value=${f.status} onChange=${set('status')} ariaLabel="Status"/>
      <//>
      <div class="grid2">
        <${UI.Select} id="task-owner" label="owner" value=${f.owner} onChange=${set('owner')} options=${ownerOpts}/>
        <${UI.Input} id="task-due" label="due" type="date" value=${f.due} onChange=${set('due')}/>
      </div>
      <div class="grid2">
        <${UI.Select} id="task-priority" label="priority" value=${f.priority} onChange=${set('priority')} options=${PRIORITIES}/>
        <${UI.Select} id="task-project" label="project" value=${f.project} onChange=${onProject} options=${projOpts}/>
      </div>
      <div class="grid2">
        <${UI.Select} id="task-section" label="section" value=${f.section} onChange=${set('section')} options=${secOpts}/>
        <${UI.Select} id="task-client" label="client" value=${f.client} onChange=${set('client')} options=${clientOpts}/>
      </div>
      <${UI.Input} id="task-link" label="link to the output" value=${f.link} onChange=${set('link')} placeholder="https://"/>
      <${UI.Check} label="Rough direction shown at the 20% check" checked=${f.shown20} onChange=${set('shown20')}/>
      <div class="row between small">
        <span class="sub">${revNote(rev)}</span>
        ${!isNew && M.focus && f.owner === uid && f.status !== 'done' ? html`<button type="button" class="linky" onClick=${() => { onClose(); M.focus.open(taskId); }}>Start focus</button>` : null}
        ${href ? html`<a class="linky" href=${href} target="_blank" rel="noopener noreferrer">Open the output</a>` : null}
      </div>

      <hr class="hair" style=${{margin: '2px 0'}}/>
      <${UI.Micro} plain>subtasks<//>
      <div class="stack tight">
        ${subList.length ? subList.map(s => html`<div key=${s.id} class="row between nowrap">
          <${UI.Check} label=${s.t} checked=${!!s.done} onChange=${v => tickSub(s.id, v)}/>
          <button type="button" class="iconbtn" aria-label="Delete subtask" title="Delete subtask" onClick=${() => delSub(s.id)}><${icons.trash}/></button>
        </div>`) : html`<${UI.Empty} text="No subtasks yet."/>`}
        <${UI.Input} id="task-subtask" value=${subText} onChange=${setSubText} onEnter=${addSub} placeholder="Add a subtask and press Enter"/>
      </div>

      <hr class="hair" style=${{margin: '2px 0'}}/>
      <${UI.Micro} plain>comments<//>
      ${isNew ? html`<${UI.Empty} text="Comments open once the task exists."/>` : html`<div class="stack tight">
        ${cList.length ? cList.map(c => html`<div key=${c.id} class="row nowrap" style=${{alignItems: 'flex-start'}}>
          <${UI.Avatar} id=${c.by} size=${26}/>
          <div class="grow">
            <div class="row" style=${{gap: '8px'}}>
              <b class="small"><${UI.Name} id=${c.by}/></b>
              <span class="sub tiny">${U.timeAgo(c.at || 0)}</span>
            </div>
            <div class="small" style=${{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}><${CommentText} text=${c.t} names=${memberNames}/></div>
          </div>
        </div>`) : html`<${UI.Empty} text="No comments yet."/>`}
        <${UI.TextArea} id="task-comment" value=${comment} onChange=${setComment} rows=${2} placeholder="Write a comment. @ mentions a teammate"/>
        <${MentionMenu} hits=${mention.hits} pick=${mention.pick}/>
        <div class="row" style=${{justifyContent: 'flex-end'}}>
          <${UI.Btn} kind="sec" sm disabled=${busy || !comment.trim()} onClick=${addComment}>Add comment<//>
        </div>
      </div>`}
    <//>`;
  }

  /* ---------- page ---------- */
  function Tasks({id}) {
    const ctx = M.useCtx();
    const [who, setWho] = useState('mine');
    /* a board with nothing of yours on it opens on everyone's work; on the phone it starts at the first column with cards */
    const settled = useRef(false);
    useEffect(() => {
      if (settled.current || !ctx.coll.tasks.ready) return;
      settled.current = true;
      const all = Object.keys(ctx.coll.tasks.map).map(k => ctx.coll.tasks.map[k]);
      if (!all.some(t => t && t.owner === ctx.uid && t.status !== 'done') && all.length) setWho('all');
    }, [ctx.coll.tasks.ready]);
    useEffect(() => {
      const wrap = document.querySelector('.board-wrap');
      if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
      const col = Array.from(wrap.querySelectorAll('.colm')).find(c => c.querySelector('.tcard'));
      if (!col) return;
      /* where the column sits inside the scroller, measured from the wrap and not the offset parent */
      const x = col.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
      if (x > wrap.clientWidth * 0.5) wrap.scrollTo({left: x - 6, behavior: 'auto'});
    }, [who, ctx.coll.tasks.ready]);
    const [proj, setProj] = useState('');
    const [client, setClient] = useState('');
    const [drawer, setDrawer] = useState(() => (id ? {id} : null));
    useEffect(() => { if (id) setDrawer({id}); }, [id]);
    M.useIntent('newtask', () => setDrawer({id: null}));
    const [dueDefault, setDueDefault] = useState('');
    useEffect(() => {
      const on = () => { const m = /^newtask:(\d{4}-\d{2}-\d{2})$/.exec(M._intentPeek ? M._intentPeek() : ''); if (m) { M._intentTake(); setDueDefault(m[1]); setDrawer({id: null}); } };
      on(); window.addEventListener('m360:intent', on);
      return () => window.removeEventListener('m360:intent', on);
    }, []);

    /* drag a card between columns */
    const [over, setOver] = useState(null);
    const drag = useRef(null);
    const onDrag = (task, e, cardEl) => {
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = cardEl ? cardEl.outerHTML : '';
      document.body.appendChild(ghost);
      const move = ev => {
        ghost.style.left = (ev.clientX + 8) + 'px'; ghost.style.top = (ev.clientY + 8) + 'px';
        const col = document.elementsFromPoint(ev.clientX, ev.clientY).map(x => x.closest && x.closest('.colm[data-status]')).find(Boolean);
        setOver(col ? col.getAttribute('data-status') : null);
        drag.current = {task, status: col ? col.getAttribute('data-status') : null};
      };
      const up = ev => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        ghost.remove();
        const d = drag.current; drag.current = null;
        setOver(null);
        if (cardEl) cardEl.classList.remove('dragging');
        if (d && d.status && d.status !== task.status) moveTask(ctx, task, d.status, document.querySelector('.colm[data-status="' + d.status + '"]'));
        suppressClick.current = Date.now();
      };
      if (cardEl) cardEl.classList.add('dragging');
      drag.current = {task, status: null};
      move(e);
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    };
    const suppressClick = useRef(0);

    const projects = (ctx.coll.projects && ctx.coll.projects.map) || {};
    const clients = (ctx.coll.clients && ctx.coll.clients.map) || {};
    const today = U.todayStr();
    const tasks = useMemo(() => allTasks(ctx), [ctx.coll.tasks]);

    const projOpts = [{v: '', label: 'All projects'}].concat(sortedOpts(projects));
    const clientOpts = [{v: '', label: 'All clients'}].concat(sortedOpts(clients));

    const filtered = tasks.filter(t =>
      (who === 'all' || t.owner === ctx.uid) &&
      (!proj || t.project === proj) &&
      (!client || t.client === client));
    const cols = STATUSES.map(s => {
      let list = filtered.filter(t => (t.status || 'todo') === s.v);
      if (s.v === 'done') {
        list = list.filter(t => t.doneAt && ctx.now - t.doneAt <= DONE_WINDOW_MS).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      } else list.sort(byDue);
      return {...s, list};
    });

    /* the single most overdue task on the board as filtered: the oldest due date among the late ones */
    const hottest = (cols.filter(c => c.v !== 'done').reduce((a, c) => a.concat(c.list), []).filter(t => isOverdue(t, today)).sort(byDue)[0] || {}).id || null;
    /* the heading and its count follow the board as filtered */
    const boardOpen = filtered.filter(t => t.status !== 'done');
    const openOverdue = boardOpen.filter(t => isOverdue(t, today)).length;
    const micro = boardOpen.length + ' open' + (openOverdue ? ', ' + openOverdue + ' overdue' : '');
    const title = who === 'mine' ? 'My tasks' : 'Everyone\'s tasks';

    const closeDrawer = () => { setDrawer(null); setDueDefault(''); if (id) M.nav('#tasks'); };
    const openTask = tid => { if (Date.now() - suppressClick.current < 300) return; setDrawer({id: tid}); };

    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${micro} title=${title}>
        <${UI.Btn} onClick=${() => setDrawer({id: null})}><${icons.plus}/>New task<//>
      <//>
      <div class="row between task-filters">
        <${UI.Seg} options=${WHO} value=${who} onChange=${setWho} ariaLabel="Whose tasks"/>
        <div class="row grow" style=${{justifyContent: 'flex-end'}}>
          <div style=${SEL_STYLE}><${UI.Select} id="task-filter-project" ariaLabel="Project" value=${proj} onChange=${setProj} options=${projOpts}/></div>
          <div style=${SEL_STYLE}><${UI.Select} id="task-filter-client" ariaLabel="Client" value=${client} onChange=${setClient} options=${clientOpts}/></div>
        </div>
      </div>
      <${UI.Card}>
        <div class="board-wrap"><div class="board">
          ${cols.map(c => html`<div key=${c.v} class=${'colm' + (over === c.v ? ' over' : '')} data-status=${c.v}>
            <div class="col-head"><span>${c.label}</span><span class="num">${c.list.length}</span></div>
            ${c.list.length
              ? c.list.map(t => html`<${TaskCard} key=${t.id} task=${t} projects=${projects} clients=${clients} today=${today} onOpen=${openTask} onDrag=${onDrag} beam=${t.id === hottest}/>`)
              : html`<div style=${{padding: '2px 6px 6px'}}><${UI.Empty} text="Nothing here."/></div>`}
          </div>`)}
        </div></div>
      <//>
      ${drawer ? html`<${TaskDrawer} key=${drawer.id || 'new'} taskId=${drawer.id} onClose=${closeDrawer}
        defaults=${{project: proj, client, owner: ctx.uid, due: dueDefault}}/>` : null}
    <//>`;
  }

  M.pages.Tasks = Tasks;
  M.parts.TaskDrawer = TaskDrawer;
  M.tasks = {isOverdue, progress, open, STATUSES, PRIORITIES, dueLabel, revNote, moveTask, statusPatch, gate, canSign, counted, signoffOn, statusOpts, binTask, sign, commit, signedBy, SIGNOFF_SINCE};
})();
