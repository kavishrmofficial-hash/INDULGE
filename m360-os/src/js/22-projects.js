/* module: projects */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const TEMPLATES = {
    campaign: {label: 'Campaign', sections: ['Brief', 'Strategy', 'Creative', 'Production', 'Live', 'Report']},
    retainer: {label: 'Retainer month', sections: ['Plan', 'Create', 'Approve', 'Publish', 'Report']},
    pitch: {label: 'Pitch', sections: ['Research', 'Diagnostic', 'Strategy', 'Proposal', 'Follow-up']},
    internal: {label: 'Internal', sections: ['To do', 'Doing', 'Done']}
  };
  const STATUS = {
    on: {label: 'On track', pill: 'ink'},
    risk: {label: 'At risk', pill: 'flame-o'},
    off: {label: 'Off track', pill: 'flame'},
    done: {label: 'Done', pill: 'warm'}
  };
  const STATUS_OPTS = ['on', 'risk', 'off', 'done'].map(v => ({v, label: STATUS[v].label}));
  const KINDS = [{v: 'client', label: 'Client'}, {v: 'pitch', label: 'Pitch'}, {v: 'internal', label: 'Internal'}];
  const KIND_FILTER = [{v: 'all', label: 'All'}].concat(KINDS);
  const SCOPES = [{v: 'active', label: 'Active'}, {v: 'done', label: 'Done'}, {v: 'all', label: 'All'}];
  const TABS = [{v: 'list', label: 'List'}, {v: 'board', label: 'Board'}, {v: 'overview', label: 'Overview'}];
  const TASK_STATUS = {
    todo: {label: 'To do', pill: 'outline'},
    doing: {label: 'Doing', pill: 'warm'},
    review: {label: 'In review', pill: 'flame-o'},
    done: {label: 'Done', pill: 'ink'}
  };
  const TPL_OPTS = Object.keys(TEMPLATES).map(k => ({v: k, label: TEMPLATES[k].label}));

  /* ids of projects whose first write is still in flight, so the page shows a loading line */
  const fresh = new Set();

  /* swallow a rejected write: the core already toasts the failure */
  const after = (p, msg) => p.then(() => { if (msg) M.toast(msg); }, () => {});

  /* a checkbox shows the tapped state while its write is in flight, then follows the document */
  function useOptimistic(value) {
    const [opt, setOpt] = useState(null);
    useEffect(() => { setOpt(null); }, [value]);
    return [opt == null ? value : opt, setOpt];
  }

  function create(ctx, {name, kind, template, client, pitch, owner, due}) {
    const id = U.uid();
    const k = KINDS.some(x => x.v === kind) ? kind : 'internal';
    const tpl = TEMPLATES[template] || TEMPLATES[k] || TEMPLATES.campaign;
    const own = owner || ctx.uid;
    const doc = {
      name: String(name || '').trim(), kind: k,
      client: k === 'client' ? (client || '') : '',
      pitch: k === 'pitch' ? (pitch || '') : '',
      owner: own, members: [own], status: 'on', start: U.todayStr(), due: due || '', desc: '',
      sections: tpl.sections.map(n => ({id: U.uid(), name: n})),
      updates: {}, archived: false, by: ctx.uid, created: Date.now()
    };
    fresh.add(id);
    const settle = () => fresh.delete(id);
    ctx.W.set('projects/' + id, doc).then(settle, settle);
    return id;
  }

  /* ---------- task helpers, with fallbacks while the tasks module is absent ---------- */
  const tasksOf = (ctx, pid) => Object.keys(ctx.coll.tasks.map)
    .map(id => ({id, ...ctx.coll.tasks.map[id]}))
    .filter(t => t.project === pid);
  const localOverdue = (t, today) => t.status !== 'done' && !!t.due && t.due < today;
  const overdueFn = () => (M.tasks && M.tasks.isOverdue) || localOverdue;
  function progressOf(ctx, pid) {
    if (M.tasks && M.tasks.progress) {
      const r = M.tasks.progress(ctx, pid) || {};
      return {done: r.done || 0, total: r.total || 0, overdue: r.overdue || 0};
    }
    const today = U.todayStr();
    const isOd = overdueFn();
    const ts = tasksOf(ctx, pid);
    return {done: ts.filter(t => t.status === 'done').length, total: ts.length, overdue: ts.filter(t => isOd(t, today)).length};
  }
  const dueKey = x => x.due || '9999-99-99';
  const sortByDue = (a, b) => dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : String(a.name || '').localeCompare(String(b.name || ''));
  const sortTasks = (a, b) => dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : (a.created || 0) - (b.created || 0);

  /* the client or pitch a project belongs to, as display text */
  function linkName(ctx, p) {
    if (p.kind === 'client') { const c = p.client && ctx.coll.clients.map[p.client]; return c ? (c.name || 'Client') : 'Client'; }
    if (p.kind === 'pitch') { const x = p.pitch && ctx.coll.pitches.map[p.pitch]; return x ? (x.brand || 'Pitch') : 'Pitch'; }
    return 'Internal';
  }

  const StatusPill = ({status}) => { const s = STATUS[status] || STATUS.on; return html`<${UI.Pill} kind=${s.pill}>${s.label}<//>`; };
  const TaskPill = ({status}) => { const s = TASK_STATUS[status] || TASK_STATUS.todo; return html`<${UI.Pill} kind=${s.pill}>${s.label}<//>`; };
  const Progress = ({prog}) => html`<div class="row nowrap">
    <${UI.Bar} a=${prog.done} max=${prog.total}/>
    <span class="tiny num sub">${prog.done} of ${prog.total} tasks</span>
    ${prog.overdue > 0 ? html`<span class="tiny num flame-t">${prog.overdue} overdue</span>` : null}
  </div>`;

  /* ---------- list ---------- */
  function ProjectCard({p, ctx, today}) {
    const prog = progressOf(ctx, p.id);
    const late = p.status !== 'done' && !!p.due && p.due < today;
    return html`<button type="button" class="rowbtn" style=${{fontWeight: 300}} aria-label=${'Open ' + p.name}
      onClick=${() => M.nav('#projects/' + p.id)}>
      <div class="card stack tight">
        <div class="row between nowrap"><b class="grow">${p.name}</b><${StatusPill} status=${p.status}/></div>
        <div class="sub small">${linkName(ctx, p)}</div>
        <div class="row">
          <${UI.Avatar} id=${p.owner} size=${24}/>
          <span class=${'small num' + (late ? ' flame-t' : ' sub')}>${p.due ? 'due ' + U.fmtDate(p.due) : 'no due date'}</span>
        </div>
        <${Progress} prog=${prog}/>
      </div>
    </button>`;
  }

  function NewProjectDrawer({open, onClose}) {
    const ctx = M.useCtx();
    const blank = () => ({name: '', kind: 'client', template: 'campaign', client: '', pitch: '', owner: ctx.uid, due: ''});
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (open) { setF(blank()); setBusy(false); } }, [open]);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setKind = k => setF(x => ({...x, kind: k, template: TEMPLATES[k] ? k : 'campaign'}));
    const memberIds = useMemo(() => {
      const ids = ctx.activeMembers.map(m => m.uid);
      if (!ids.includes(ctx.uid)) ids.unshift(ctx.uid);
      return ids;
    }, [ctx.activeMembers, ctx.uid]);
    const profs = M.useProfiles(memberIds);
    const ownerOpts = memberIds.map(u => ({v: u, label: (profs[u] && profs[u].name) || 'Someone'}));
    const byLabel = (a, b) => a.label.localeCompare(b.label);
    const clientOpts = [{v: '', label: 'Choose a client'}].concat(Object.keys(ctx.coll.clients.map)
      .map(id => ({v: id, label: ctx.coll.clients.map[id].name || id})).sort(byLabel));
    const pitchOpts = [{v: '', label: 'Choose a pitch'}].concat(Object.keys(ctx.coll.pitches.map)
      .map(id => ({v: id, label: ctx.coll.pitches.map[id].brand || id})).sort(byLabel));
    const canSave = !!f.name.trim() && !busy;
    const submit = () => {
      if (!canSave) return;
      setBusy(true);
      const id = create(ctx, f);
      M.toast('Project created');
      onClose();
      M.nav('#projects/' + id);
    };
    const tpl = TEMPLATES[f.template] || TEMPLATES.campaign;
    return html`<${UI.Drawer} open=${open} onClose=${onClose} title="New project"
      footer=${html`<${UI.Btn} disabled=${!canSave} onClick=${submit}>Create project<//>`}>
      <${UI.Input} id="proj-name" label="Name" value=${f.name} onChange=${v => set('name', v)} placeholder="Swisse Q4 campaign" onEnter=${submit}/>
      <${UI.Select} id="proj-kind" label="Kind" value=${f.kind} onChange=${setKind} options=${KINDS}/>
      <${UI.Select} id="proj-template" label="Template" value=${f.template} onChange=${v => set('template', v)} options=${TPL_OPTS}
        hint=${'Sections: ' + tpl.sections.join(', ')}/>
      ${f.kind === 'client' ? html`<${UI.Select} id="proj-client" label="Client" value=${f.client} onChange=${v => set('client', v)} options=${clientOpts}/>` : null}
      ${f.kind === 'pitch' ? html`<${UI.Select} id="proj-pitch" label="Pitch" value=${f.pitch} onChange=${v => set('pitch', v)} options=${pitchOpts}/>` : null}
      <${UI.Select} id="proj-owner" label="Owner" value=${f.owner} onChange=${v => set('owner', v)} options=${ownerOpts}/>
      <${UI.Input} id="proj-due" label="Due date" type="date" value=${f.due} onChange=${v => set('due', v)}/>
    <//>`;
  }

  function ProjectsList() {
    const ctx = M.useCtx();
    const [scope, setScope] = useState('active');
    const [kind, setKind] = useState('all');
    const [open, setOpen] = useState(false);
    const today = U.todayStr();
    const all = Object.keys(ctx.coll.projects.map).map(id => ({id, ...ctx.coll.projects.map[id]}));
    const isActive = p => p.status !== 'done' && !p.archived;
    const list = all.filter(p => {
      if (scope === 'active' && !isActive(p)) return false;
      if (scope === 'done' && p.status !== 'done') return false;
      if (kind !== 'all' && p.kind !== kind) return false;
      return true;
    }).sort(sortByDue);
    const nActive = all.filter(isActive).length;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${nActive + ' active'} title="Projects">
        <${UI.Btn} onClick=${() => setOpen(true)}><${icons.plus}/>New project<//>
      <//>
      <div class="row">
        <${UI.Seg} options=${SCOPES} value=${scope} onChange=${setScope} ariaLabel="Show"/>
        <${UI.Seg} options=${KIND_FILTER} value=${kind} onChange=${setKind} ariaLabel="Kind"/>
      </div>
      ${!ctx.coll.projects.ready ? html`<${UI.Empty} text="Loading projects."/>`
        : list.length ? html`<div class="grid2">${list.map(p => html`<${ProjectCard} key=${p.id} p=${p} ctx=${ctx} today=${today}/>`)}</div>`
        : html`<${UI.Empty} text=${all.length ? 'No projects match these filters.' : 'No projects yet.'}/>`}
      <${NewProjectDrawer} open=${open} onClose=${() => setOpen(false)}/>
    <//>`;
  }

  /* ---------- project page: list tab ---------- */
  function AddTask({ctx, project, section}) {
    const [v, setV] = useState('');
    const add = raw => {
      const title = String(raw == null ? v : raw).trim();
      if (!title) return;
      const now = Date.now(), id = U.uid();
      after(ctx.W.set('tasks/' + id, {
        title, owner: ctx.uid, client: project.client || '', project: project.id, section: section.id,
        due: '', status: 'todo', priority: 'normal', link: '', revisions: 0, shown20: false,
        subtasks: {}, comments: {}, by: ctx.uid, created: now, updated: now
      }), 'Task added');
      setV('');
    };
    return html`<div class="row nowrap" style=${{marginTop: '8px'}}>
      <div class="grow"><${UI.Input} id=${'add-task-' + section.id} value=${v} onChange=${setV} placeholder="Add task" onEnter=${add}/></div>
      <${UI.Btn} kind="sec" sm disabled=${!v.trim()} onClick=${() => add()}>Add task<//>
    </div>`;
  }

  function TaskRow({t, ctx, today, isOd, onOpen}) {
    const done = t.status === 'done';
    const [shown, setShown] = useOptimistic(done);
    const od = !done && isOd(t, today);
    const toggle = checked => {
      const now = Date.now();
      setShown(checked);
      ctx.W.update('tasks/' + t.id, checked ? {status: 'done', doneAt: now, updated: now} : {status: 'todo', doneAt: null, updated: now})
        .then(() => M.toast(checked ? 'Task done' : 'Task reopened'), () => setShown(null));
    };
    return html`<div class="listrow">
      <label class="checkline"><input type="checkbox" data-task=${t.id} checked=${shown} aria-label=${'Done: ' + t.title}
        onChange=${e => toggle(e.target.checked)}/></label>
      <button type="button" class=${'rowbtn grow' + (done ? ' sub' : '')} onClick=${() => onOpen(t)}>${t.title}</button>
      <${UI.Avatar} id=${t.owner} size=${22}/>
      ${t.due ? html`<span class=${'tiny num' + (od ? ' flame-t' : ' sub')}>${U.fmtDay(t.due)}</span>` : null}
      <${TaskPill} status=${t.status}/>
    </div>`;
  }

  function ListTab({ctx, project, tasks, onOpen}) {
    const today = U.todayStr();
    const isOd = overdueFn();
    const secs = project.sections || [];
    const known = new Set(secs.map(s => s.id));
    const orphans = tasks.filter(t => !known.has(t.section));
    const group = (s, ts, extra) => html`<${UI.Card} key=${s.id} id=${'sec-' + s.id}>
      <div class="row between"><${UI.Micro}>${s.name}<//><span class="tiny num sub">${ts.length}</span></div>
      ${ts.map(t => html`<${TaskRow} key=${t.id} t=${t} ctx=${ctx} today=${today} isOd=${isOd} onOpen=${onOpen}/>`)}
      ${extra || null}
    <//>`;
    return html`<${React.Fragment}>
      ${secs.map(s => group(s, tasks.filter(t => t.section === s.id), html`<${AddTask} ctx=${ctx} project=${project} section=${s}/>`))}
      ${orphans.length ? group({id: 'none', name: 'no section'}, orphans) : null}
      ${!secs.length ? html`<${UI.Empty} text="Add a section under Overview to start listing tasks."/>` : null}
    <//>`;
  }

  /* ---------- project page: board tab ---------- */
  function TaskCard({t, ctx, today, isOd, next, onOpen}) {
    const od = t.status !== 'done' && isOd(t, today);
    const move = () => after(ctx.W.update('tasks/' + t.id, {section: next.id, updated: Date.now()}), 'Moved to ' + next.name);
    return html`<div class="tcard">
      <button type="button" class="rowbtn t" onClick=${() => onOpen(t)}>${t.title}</button>
      <div class="row between nowrap">
        <span class="row nowrap"><${UI.Avatar} id=${t.owner} size=${22}/>
          ${t.due ? html`<span class=${'tiny num' + (od ? ' flame-t' : ' sub')}>${U.fmtDay(t.due)}</span>` : null}</span>
        <${TaskPill} status=${t.status}/>
      </div>
      ${next ? html`<div><${UI.Btn} kind="sec" sm onClick=${move}>Move to next section<//></div>` : null}
    </div>`;
  }

  function BoardTab({ctx, project, tasks, onOpen}) {
    const today = U.todayStr();
    const isOd = overdueFn();
    const secs = project.sections || [];
    if (!secs.length) return html`<${UI.Card}><${UI.Empty} text="Add a section under Overview to start the board."/><//>`;
    return html`<${UI.Card}><div class="board-wrap"><div class="board">
      ${secs.map((s, i) => {
        const ts = tasks.filter(t => t.section === s.id);
        return html`<div class="colm" key=${s.id} data-section=${s.id}>
          <div class="col-head"><span>${s.name}</span><span class="num">${ts.length}</span></div>
          ${ts.length ? ts.map(t => html`<${TaskCard} key=${t.id} t=${t} ctx=${ctx} today=${today} isOd=${isOd} next=${secs[i + 1]} onOpen=${onOpen}/>`)
            : html`<div style=${{padding: '2px 6px'}}><${UI.Empty} text="No tasks"/></div>`}
        </div>`;
      })}
    </div></div><//>`;
  }

  /* ---------- project page: overview tab ---------- */
  function DescCard({ctx, project}) {
    const [v, setV] = useState(project.desc || '');
    useEffect(() => { setV(project.desc || ''); }, [project.desc]);
    const save = () => after(ctx.W.update('projects/' + project.id, {desc: v.trim()}), 'Saved');
    return html`<${UI.Card} title="Description">
      <${UI.TextArea} id="proj-desc" value=${v} onChange=${setV} rows=${4} placeholder="What this project delivers, for whom, by when."/>
      <div class="row" style=${{marginTop: '10px'}}>
        <${UI.Btn} kind="sec" sm disabled=${v.trim() === (project.desc || '')} onClick=${save}>Save description<//>
      </div>
    <//>`;
  }

  function UpdatesCard({ctx, project}) {
    const [status, setStatus] = useState(project.status || 'on');
    const [text, setText] = useState('');
    useEffect(() => { setStatus(project.status || 'on'); }, [project.status]);
    const can = !!text.trim() || status !== project.status;
    const post = () => {
      if (!can) return;
      const now = Date.now(), id = U.uid();
      after(ctx.W.update('projects/' + project.id, {status, updates: {[id]: {by: ctx.uid, status, text: text.trim(), at: now}}}), 'Posted');
      setText('');
    };
    const ups = Object.keys(project.updates || {}).map(k => ({id: k, ...project.updates[k]})).sort((a, b) => (b.at || 0) - (a.at || 0));
    void ctx.now;
    return html`<${UI.Card} title="Status update">
      <div class="stack">
        <${UI.Seg} options=${STATUS_OPTS} value=${status} onChange=${setStatus} ariaLabel="Project status"/>
        <${UI.TextArea} id="proj-update" value=${text} onChange=${setText} rows=${3} placeholder="What moved, what is stuck, what you need."/>
        <div class="row"><${UI.Btn} disabled=${!can} onClick=${post}>Post update<//></div>
      </div>
      <hr class="hair"/>
      ${ups.length ? ups.map(u => html`<div class="listrow" key=${u.id} style=${{alignItems: 'flex-start'}}>
        <${UI.Avatar} id=${u.by} size=${28}/>
        <div class="grow stack" style=${{gap: '4px'}}>
          <div class="row"><b class="small"><${UI.Name} id=${u.by}/></b><${StatusPill} status=${u.status}/><span class="tiny sub num">${U.timeAgo(u.at || 0)}</span></div>
          ${u.text ? html`<div class="small">${u.text}</div>` : null}
        </div>
      </div>`) : html`<${UI.Empty} text="No updates yet."/>`}
    <//>`;
  }

  function MemberCheck({u, checked, onToggle}) {
    const [shown, setShown] = useOptimistic(checked);
    const change = on => {
      const p = onToggle(u, on);
      if (!p) return;
      setShown(on);
      p.then(null, () => setShown(null));
    };
    return html`<${UI.Check} label=${html`<${UI.Name} id=${u}/>`} checked=${shown} onChange=${change}/>`;
  }

  function MembersCard({ctx, project}) {
    const ids = ctx.activeMembers.map(m => m.uid);
    const members = project.members || [];
    /* people on the project who left the roster still show, so they can be removed */
    const all = ids.concat(members.filter(u => !ids.includes(u)));
    const toggle = (u, on) => {
      if (u === project.owner && !on) { M.toast('The owner stays on the project.', true); return null; }
      const next = on ? (members.includes(u) ? members : members.concat([u])) : members.filter(x => x !== u);
      return ctx.W.update('projects/' + project.id, {members: next});
    };
    return html`<${UI.Card} title="Members">
      <div class="stack tight">
        ${all.map(u => html`<${MemberCheck} key=${u} u=${u} checked=${members.includes(u)} onToggle=${toggle}/>`)}
        ${!all.length ? html`<${UI.Empty} text="No active members on the roster."/>` : null}
      </div>
    <//>`;
  }

  function SectionRow({s, i, n, count, onRename, onUp, onDown, onDelete}) {
    const [v, setV] = useState(s.name);
    const sent = useRef(null);
    useEffect(() => { setV(s.name); sent.current = null; }, [s.name]);
    const commit = () => {
      const name = v.trim();
      if (!name) { setV(s.name); return; }
      if (name === s.name || name === sent.current) return;
      sent.current = name;
      onRename(name);
    };
    return html`<div class="row nowrap">
      <input id=${'sec-name-' + s.id} class="input grow" value=${v} aria-label="Section name"
        onInput=${e => setV(e.target.value)} onBlur=${commit}
        onKeyDown=${e => { if (e.key === 'Enter') commit(); }}/>
      <span class="tiny num sub" style=${{width: '22px', textAlign: 'right'}}>${count}</span>
      <${UI.Btn} kind="ghost" sm disabled=${i === 0} onClick=${onUp} ariaLabel="Move up"><${icons.up}/><//>
      <${UI.Btn} kind="ghost" sm disabled=${i === n - 1} onClick=${onDown} ariaLabel="Move down"><${icons.down}/><//>
      ${count ? html`<${UI.Btn} kind="ghost" sm disabled title="Move its tasks first" ariaLabel="Delete section"><${icons.trash}/><//>`
        : html`<${UI.ConfirmBtn} onConfirm=${onDelete} label="Tap again to delete"><${icons.trash}/><//>`}
    </div>`;
  }

  function SectionsCard({ctx, project, tasks}) {
    const secs = project.sections || [];
    const [nv, setNv] = useState('');
    const write = next => ctx.W.update('projects/' + project.id, {sections: next});
    const rename = (i, name) => { const next = U.clone(secs); next[i] = {...next[i], name}; after(write(next), 'Section renamed'); };
    const swap = (i, j) => {
      if (j < 0 || j >= secs.length) return;
      const next = U.clone(secs); const t = next[i]; next[i] = next[j]; next[j] = t;
      after(write(next));
    };
    const remove = i => { const next = U.clone(secs); next.splice(i, 1); after(write(next), 'Section removed'); };
    const add = raw => {
      const name = String(raw == null ? nv : raw).trim();
      if (!name) return;
      after(write(secs.concat([{id: U.uid(), name}])), 'Section added');
      setNv('');
    };
    const counts = {};
    tasks.forEach(t => { counts[t.section] = (counts[t.section] || 0) + 1; });
    return html`<${UI.Card} title="Sections">
      <div class="stack tight">
        ${secs.map((s, i) => html`<${SectionRow} key=${s.id} s=${s} i=${i} n=${secs.length} count=${counts[s.id] || 0}
          onRename=${name => rename(i, name)} onUp=${() => swap(i, i - 1)} onDown=${() => swap(i, i + 1)} onDelete=${() => remove(i)}/>`)}
        ${!secs.length ? html`<${UI.Empty} text="No sections yet."/>` : null}
      </div>
      <div class="row nowrap" style=${{marginTop: '10px'}}>
        <div class="grow"><${UI.Input} id="add-section" value=${nv} onChange=${setNv} placeholder="Add section" onEnter=${add}/></div>
        <${UI.Btn} kind="sec" sm disabled=${!nv.trim()} onClick=${() => add()}>Add section<//>
      </div>
    <//>`;
  }

  function OverviewTab({ctx, project, tasks}) {
    return html`<div class="grid2">
      <div class="stack"><${DescCard} ctx=${ctx} project=${project}/><${UpdatesCard} ctx=${ctx} project=${project}/></div>
      <div class="stack"><${MembersCard} ctx=${ctx} project=${project}/><${SectionsCard} ctx=${ctx} project=${project} tasks=${tasks}/></div>
    </div>`;
  }

  /* ---------- project page ---------- */
  function ProjectPage({id}) {
    const ctx = M.useCtx();
    const [tab, setTab] = useState('list');
    const [openTask, setOpenTask] = useState(null);
    useEffect(() => { setOpenTask(null); }, [id]);
    const p = ctx.coll.projects.map[id];
    const back = html`<${UI.Btn} kind="sec" sm onClick=${() => M.nav('#projects')}><${icons.chevL}/>All projects<//>`;
    if (!p) {
      const waiting = !ctx.coll.projects.ready || fresh.has(id);
      return html`<${React.Fragment}>
        <${UI.PageHead} micro="projects" title="Project">${back}<//>
        <${UI.Empty} text=${waiting ? 'Loading the project.' : 'No project with this link.'}/>
      <//>`;
    }
    const project = {id, ...p};
    const tasks = tasksOf(ctx, id).sort(sortTasks);
    const prog = progressOf(ctx, id);
    const today = U.todayStr();
    const late = project.status !== 'done' && !!project.due && project.due < today;
    const client = project.client ? ctx.coll.clients.map[project.client] : null;
    const pitch = project.pitch ? ctx.coll.pitches.map[project.pitch] : null;
    const onOpen = t => {
      if (M.parts.TaskDrawer) setOpenTask({taskId: t.id, section: t.section});
      else M.toast('Task details are on their way.');
    };
    const D = M.parts.TaskDrawer;
    const view = tab === 'board' ? BoardTab : tab === 'overview' ? OverviewTab : ListTab;
    return html`<${React.Fragment}>
      <${UI.PageHead} micro=${linkName(ctx, project)} title=${project.name}>${back}<//>
      <${UI.Card}>
        <div class="stack">
          <div class="row">
            <${StatusPill} status=${project.status}/>
            <span class="row nowrap small"><${UI.Avatar} id=${project.owner} size=${24}/><${UI.Name} id=${project.owner}/></span>
            <${UI.AvatarRow} ids=${project.members || []} size=${24}/>
            <span class=${'small num' + (late ? ' flame-t' : ' sub')}>${project.due ? 'due ' + U.fmtDate(project.due) : 'no due date'}</span>
            ${client ? html`<${UI.Btn} kind="ghost" sm onClick=${() => M.nav('#clients')}><${icons.link}/>${client.name || 'Client'}<//>` : null}
            ${pitch ? html`<${UI.Btn} kind="ghost" sm onClick=${() => M.nav('#pitches')}><${icons.link}/>${pitch.brand || 'Pitch'}<//>` : null}
          </div>
          <${Progress} prog=${prog}/>
          <${UI.Seg} options=${TABS} value=${tab} onChange=${setTab} ariaLabel="Project view"/>
        </div>
      <//>
      <${view} ctx=${ctx} project=${project} tasks=${tasks} onOpen=${onOpen}/>
      ${(D && openTask) ? html`<${D} taskId=${openTask.taskId} onClose=${() => setOpenTask(null)}
        defaults=${{project: id, section: openTask.section, client: project.client || '', owner: ctx.uid}}/>` : null}
    <//>`;
  }

  function Projects({id}) {
    return id ? html`<${ProjectPage} id=${id}/>` : html`<${ProjectsList}/>`;
  }

  M.pages.Projects = Projects;
  M.projects = {TEMPLATES, STATUS, create, tasksOf, progress: progressOf};
})();
