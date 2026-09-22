/* module: today (BRIEF 7.2). Everyone's home page. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const SEV_PILL = {high: 'flame', medium: 'flame-o', low: null};
  const STATUS_PILL = {office: {k: 'ink', t: 'In office'}, wfh: {k: null, t: 'WFH'},
    leave: {k: 'warm', t: 'On leave'}, holiday: {k: 'warm', t: 'Holiday'}, sunday: {k: 'warm', t: 'Sunday'}};

  /* ---------- 1. pinned announcement ---------- */
  function Announcement() {
    const ctx = M.useCtx();
    const fd = ctx.coll.feed.map[ctx.founderUid];
    const key = fd && fd.pinned;
    const post = useMemo(() => {
      if (!key) return null;
      const cut = String(key).indexOf(':');
      if (cut < 0) return null;
      const au = key.slice(0, cut), pid = key.slice(cut + 1);
      const doc = ctx.coll.feed.map[au];
      const p = doc && (doc.posts || []).find(x => x && x.id === pid);
      return p ? {...p, author: au} : null;
    }, [key, ctx.coll.feed.map]);
    if (!post) return null;

    const acks = ctx.coll.acks.map;
    const ackKey = 'ann:' + key;
    const mine = ((acks[ctx.uid] || {}).s || {})[ackKey];
    const others = ctx.activeMembers.filter(m => m.uid !== ctx.founderUid);
    const seen = others.filter(m => (((acks[m.uid] || {}).s || {})[ackKey]));

    if (ctx.isFounder) {
      return html`<${UI.Card} flame=${true}>
        <div class="row between">
          <div class="row"><${UI.Pill} kind="flame">announcement<//>
            <span class="tiny ink62">${U.timeAgo(post.at)}</span></div>
          <span class="tiny ink62 num">Seen by ${seen.length} of ${others.length}</span>
        </div>
        <p style=${{whiteSpace: 'pre-wrap', margin: '10px 0 0'}}>${post.text}</p>
        ${seen.length ? html`<div style=${{marginTop: '10px'}}><${UI.AvatarRow} ids=${seen.map(s => s.uid)}/></div>` : null}
      <//>`;
    }
    if (mine) return null;
    return html`<${UI.Card} flame=${true}>
      <div class="row">
        <${UI.Avatar} id=${post.author} size=${28}/>
        <span style=${{fontWeight: 500}}><${UI.Name} id=${post.author}/></span>
        <${UI.Pill} kind="flame">announcement<//>
        <span class="tiny ink62">${U.timeAgo(post.at)}</span>
      </div>
      <p style=${{whiteSpace: 'pre-wrap', margin: '10px 0 14px'}}>${post.text}</p>
      <${UI.Btn} onClick=${() => ctx.W.merge('acks/' + ctx.uid, {s: {[ackKey]: Date.now()}}).then(() => M.toast('Marked as read'))}>Got it<//>
    <//>`;
  }

  /* ---------- 2. rule box ---------- */
  function RuleBox() {
    const ctx = M.useCtx();
    const names = (M.rules && M.rules.NAMES) || {};
    const flags = ctx.myFlags || [];
    return html`<${UI.Card} title="Rule box">
      ${flags.length ? html`<div class="stack tight">
        ${flags.map((f, i) => html`<div class="listrow" key=${f.rule + ':' + (f.key || i)}>
          <div class="grow">
            <div style=${{fontWeight: 500}}>${names[f.rule] || f.rule}</div>
            <div class="small ink62">${f.text}</div>
          </div>
          ${SEV_PILL[f.severity] ? html`<${UI.Pill} kind=${SEV_PILL[f.severity]}>${f.severity}<//>` : html`<${UI.Pill}>${f.severity}<//>`}
          ${f.section ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#handbook/' + f.section)}>Handbook<//>` : null}
        </div>`)}
      </div>` : html`<${UI.Empty} text="All clear."/>`}
    <//>`;
  }

  /* ---------- 7. my open tasks ---------- */
  function MyTasks({onOpen}) {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const rows = useMemo(() => {
      const map = ctx.coll.tasks.map;
      return Object.keys(map).map(id => ({id, ...map[id]}))
        .filter(t => t.owner === ctx.uid && t.status !== 'done')
        .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0)
        .slice(0, 6);
    }, [ctx.coll.tasks.map, ctx.uid]);
    const over = t => (M.tasks && M.tasks.isOverdue) ? M.tasks.isOverdue(t, today) : (!!t.due && t.due < today);
    const projects = ctx.coll.projects.map, clients = ctx.coll.clients.map;
    return html`<${UI.Card} title="My open tasks"
      action=${html`<${UI.Btn} kind="sec" sm=${true} onClick=${() => M.nav('#tasks')}>Board<//>`}>
      ${rows.length ? html`<div class="stack tight">
        ${rows.map(t => html`<button type="button" class="rowbtn listrow" key=${t.id} onClick=${() => onOpen(t.id)}>
          <span class="grow" style=${{fontWeight: 500}}>${t.title}</span>
          ${t.project && projects[t.project] ? html`<${UI.Pill} kind="warm">${projects[t.project].name}<//>` : null}
          ${t.client && clients[t.client] ? html`<${UI.Pill} kind="warm">${clients[t.client].name}<//>` : null}
          ${t.due ? html`<${UI.Pill} kind=${over(t) ? 'flame' : null}>${U.fmtDate(t.due)}<//>` : null}
        </button>`)}
      </div>` : html`<${UI.Empty} text="No open tasks."/>`}
    <//>`;
  }

  /* ---------- 8. evaluations assigned to you ---------- */
  function MyEvals({onOpen}) {
    const ctx = M.useCtx();
    const ids = (M.hiring && M.hiring.assignedToMe) ? M.hiring.assignedToMe(ctx) : [];
    if (!ids.length) return null;
    const map = ctx.coll.candidates.map;
    return html`<${UI.Card} title="Evaluations assigned to you">
      <div class="stack tight">
        ${ids.map(cid => {
          const c = map[cid] || {};
          return html`<div class="listrow" key=${cid}>
            <div class="grow">
              <div style=${{fontWeight: 500}}>${c.name || 'Candidate'}</div>
              <div class="small ink62">${c.role || ''}${c.deadline ? ' · by ' + U.fmtDate(c.deadline) : ''}</div>
            </div>
            <${UI.Btn} sm=${true} onClick=${() => onOpen(cid)}>Evaluate<//>
          </div>`;
        })}
      </div>
    <//>`;
  }

  /* ---------- 10. who's in today ---------- */
  function WhosIn() {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const st = uid => (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, uid, today) : {status: 'none'};
    return html`<${UI.Card} title="Who's in today">
      ${ctx.activeMembers.length ? html`<div class="stack tight">
        ${ctx.activeMembers.map(m => {
          const d = st(m.uid);
          const p = STATUS_PILL[d.status];
          return html`<div class="listrow" key=${m.uid}>
            <${UI.Avatar} id=${m.uid} size=${28}/>
            <span class="grow"><${UI.Name} id=${m.uid}/> <span class="tiny ink62 num">${m.empId || ''}</span></span>
            ${d.in ? html`<span class="small num">${U.hhmm(d.in)}</span>` : null}
            ${d.late && ctx.canSee(m.uid) ? html`<${UI.Pill} kind="flame">late<//>` : null}
            ${p ? html`<${UI.Pill} kind=${p.k}>${p.t}<//>` : html`<${UI.Pill}>Not in yet<//>`}
          </div>`;
        })}
      </div>` : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
    <//>`;
  }

  /* ---------- 11. handbook to read ---------- */
  function ToRead() {
    const ctx = M.useCtx();
    const ids = (M.handbook && M.handbook.unread) ? M.handbook.unread(ctx, ctx.uid) : [];
    if (!ids.length) return null;
    const map = ctx.coll.handbook.map;
    return html`<${UI.Card} title="Handbook to read">
      <div class="stack tight">
        ${ids.map(id => html`<div class="listrow" key=${id}>
          <span class="dotflame"/>
          <span class="grow">${(map[id] || {}).title || id}</span>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => M.nav('#handbook/' + id)}>Read<//>
        </div>`)}
      </div>
    <//>`;
  }

  /* ---------- page ---------- */
  function Today() {
    const ctx = M.useCtx();
    const [task, setTask] = useState(null);
    const [cand, setCand] = useState(null);
    const now = new Date(ctx.now);
    const first = U.firstName(ctx.me.name) || 'there';

    const Checkin = M.parts.CheckinCard, Eod = M.parts.EodCard, Outcomes = M.parts.OutcomesCard,
      Day = M.parts.YourDay, Drawer = M.parts.TaskDrawer, Eval = M.parts.EvalDrawer,
      Onboard = M.parts.Onboarding;
    const newHire = (M.people && M.people.isNewHire) ? M.people.isNewHire(ctx, ctx.uid) : false;

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro=${U.dateLabel(now)} title=${U.greeting(now) + ', ' + first + '.'}/>
      <${Announcement}/>
      <${RuleBox}/>
      ${Checkin ? html`<${Checkin}/>` : null}
      ${Eod ? html`<${Eod}/>` : null}
      ${Outcomes ? html`<${Outcomes}/>` : null}
      ${Day ? html`<${Day}/>` : null}
      <${MyTasks} onOpen=${setTask}/>
      <${MyEvals} onOpen=${setCand}/>
      ${newHire && Onboard ? html`<${Onboard} uid=${ctx.uid} compact=${true}/>` : null}
      <${WhosIn}/>
      <${ToRead}/>
      ${task && Drawer ? html`<${Drawer} taskId=${task} onClose=${() => setTask(null)}/>` : null}
      ${cand && Eval ? html`<${Eval} candidateId=${cand} onClose=${() => setCand(null)}/>` : null}
    </div>`;
  }

  M.pages.Today = Today;
})();
