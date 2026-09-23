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

  /* one status change, with the bookkeeping every path shares: review time, revisions, done time */
  function statusPatch(task, status, uid) {
    const now = Date.now();
    const prev = (task && task.status) || 'todo';
    const patch = {status, updated: now};
    let msg = 'Moved to ' + (STATUSES.find(x => x.v === status) || {label: status}).label.toLowerCase();
    if (prev === 'review' && (status === 'doing' || status === 'todo')) {
      patch.revisions = (Number(task && task.revisions) || 0) + 1;
      patch.sentBackAt = now; patch.sentBackBy = uid;
      msg = 'Sent back, revision ' + patch.revisions;
    }
    if (status === 'review' && prev !== 'review') patch.reviewAt = now;
    if (status === 'done') { if (prev !== 'done' || !(task && task.doneAt)) patch.doneAt = now; msg = 'Shipped'; }
    else patch.doneAt = null;
    return {patch, msg};
  }
  async function moveTask(ctx, task, status, el) {
    if (!task || task.status === status) return;
    const {patch, msg} = statusPatch(task, status, ctx.uid);
    await ctx.W.update('tasks/' + task.id, patch).catch(() => {});
    if (status === 'done') M.burst(el || document.body); else M.sound.play('tick');
    M.toast(msg);
  }

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
  function TaskCard({task, projects, clients, today, onOpen, onDrag}) {
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
    return html`<button type="button" class="tcard" data-task=${task.id} onClick=${() => onOpen(task.id)}
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
          ${task.due ? html`<${UI.Pill} kind=${overdue ? 'flame' : undefined}>due ${dueLabel(task.due)}<//>` : null}
          ${task.priority === 'high' ? html`<${UI.Pill} kind="flame">high<//>` : null}
          ${rev > 0 ? html`<${UI.Pill} kind="flame-o">${rev} rev<//>` : null}
          ${task.shown20 ? html`<${UI.Pill}>20% shown<//>` : null}
          ${sc.total > 0 ? html`<${UI.Pill} kind=${sc.done === sc.total ? 'ink' : undefined}>${sc.done} of ${sc.total}<//>` : null}
        </div>
        ${task.owner ? html`<${UI.Avatar} id=${task.owner} size=${22}/>` : null}
      </div>
    </button>`;
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
          await W.set('tasks/' + id, {
            title, owner: f.owner, client: f.client, project: f.project, section: f.section, due: f.due,
            status: f.status, priority: f.priority, link: f.link.trim(), revisions: 0, shown20: !!f.shown20,
            subtasks: localSubs, comments: {}, by: uid, created: now, updated: now,
            doneAt: f.status === 'done' ? now : null
          });
          M.toast('Task created');
        } else {
          const prev = (task && task.status) || 'todo';
          const sp = prev === f.status ? {patch: {doneAt: (task && task.doneAt) || null}, msg: 'Saved'} : statusPatch(task, f.status, uid);
          await W.update(path, {
            title, owner: f.owner, client: f.client, project: f.project, section: f.section, due: f.due,
            status: f.status, priority: f.priority, link: f.link.trim(), shown20: !!f.shown20, ...sp.patch, updated: now
          });
          if (f.status === 'done' && prev !== 'done') M.burst(document.querySelector('.drawer-foot'));
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
        await W.del(path);
        M.toast('Task deleted');
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
        <${UI.Seg} options=${STATUSES} value=${f.status} onChange=${set('status')} ariaLabel="Status"/>
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

    const mine = tasks.filter(t => t.owner === ctx.uid && t.status !== 'done');
    const myOverdue = mine.filter(t => isOverdue(t, today)).length;
    const micro = mine.length + ' open' + (myOverdue ? ', ' + myOverdue + ' overdue' : '');

    const closeDrawer = () => { setDrawer(null); setDueDefault(''); if (id) M.nav('#tasks'); };
    const openTask = tid => { if (Date.now() - suppressClick.current < 300) return; setDrawer({id: tid}); };

    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${micro} title="My tasks">
        <${UI.Btn} onClick=${() => setDrawer({id: null})}><${icons.plus}/>New task<//>
      <//>
      <div class="row between">
        <${UI.Seg} options=${WHO} value=${who} onChange=${setWho} ariaLabel="Whose tasks"/>
        <div class="row grow" style=${{justifyContent: 'flex-end'}}>
          <div style=${SEL_STYLE}><${UI.Select} id="task-filter-project" value=${proj} onChange=${setProj} options=${projOpts}/></div>
          <div style=${SEL_STYLE}><${UI.Select} id="task-filter-client" value=${client} onChange=${setClient} options=${clientOpts}/></div>
        </div>
      </div>
      <${UI.Card}>
        <div class="board-wrap"><div class="board">
          ${cols.map(c => html`<div key=${c.v} class=${'colm' + (over === c.v ? ' over' : '')} data-status=${c.v}>
            <div class="col-head"><span>${c.label}</span><span class="num">${c.list.length}</span></div>
            ${c.list.length
              ? c.list.map(t => html`<${TaskCard} key=${t.id} task=${t} projects=${projects} clients=${clients} today=${today} onOpen=${openTask} onDrag=${onDrag}/>`)
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
  M.tasks = {isOverdue, progress, open, STATUSES, PRIORITIES, dueLabel, revNote, moveTask, statusPatch};
})();
