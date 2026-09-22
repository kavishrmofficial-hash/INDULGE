/* m360 OS shell: gates, navigation, page router. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;

  /* ---------- gates ---------- */
  M.Gate = function Gate({title, line, children}) {
    return html`<div class="gate"><div>
      <${M.Mark} width="110px"/>
      <h1>${title}</h1>
      ${line ? html`<p>${line}</p>` : null}
      ${children ? html`<div class="g-act">${children}</div>` : null}
    </div></div>`;
  };

  const GATES = {
    boot: {t: 'Signing you in', l: 'One moment.'},
    nohost: {t: 'Open this inside Claude', l: 'This page runs on claude.ai. Open the shared link there.'},
    nocap: {t: 'Workspace unavailable', l: 'The workspace could not load. Reload the page in a moment.'},
    noid: {t: 'Sign in to continue', l: 'Sign in to your Claude account, then reload this page.'},
    roster: {t: 'Not on the roster yet', l: "You're signed in, but not on the team roster yet. Kaavish adds you from the Desk."}
  };
  M.GateFor = mode => {
    const g = GATES[mode] || GATES.nocap;
    return html`<${M.Gate} title=${g.t} line=${g.l}/>`;
  };

  /* ---------- navigation model ---------- */
  const NAV = [
    {group: null, items: [{k: 'today', label: 'Today', icon: 'today'}]},
    {group: 'work', items: [
      {k: 'tasks', label: 'My tasks', icon: 'tasks'},
      {k: 'projects', label: 'Projects', icon: 'projects'},
      {k: 'pitches', label: 'Pitches', icon: 'pitches'},
      {k: 'clients', label: 'Clients', icon: 'clients'}
    ]},
    {group: 'team', items: [
      {k: 'feed', label: 'Feed', icon: 'feed'},
      {k: 'week', label: 'The week', icon: 'week'},
      {k: 'scores', label: 'Scores', icon: 'scores'},
      {k: 'people', label: 'People', icon: 'people'},
      {k: 'hiring', label: 'Hiring', icon: 'hiring'},
      {k: 'handbook', label: 'Handbook', icon: 'handbook'},
      {k: 'voice', label: 'Voice', icon: 'voice'},
      {k: 'leave', label: 'Leave', icon: 'leave'}
    ]},
    {group: 'founder', founder: true, items: [
      {k: 'command', label: 'Command', icon: 'command'},
      {k: 'desk', label: 'Desk', icon: 'desk'}
    ]}
  ];
  const WIDE = new Set(['tasks', 'projects', 'pitches', 'week', 'command']);
  const PAGE_KEYS = {today: 'Today', tasks: 'Tasks', projects: 'Projects', pitches: 'Pitches', clients: 'Clients',
    feed: 'Feed', week: 'Week', scores: 'Scores', people: 'People', hiring: 'Hiring', handbook: 'Handbook',
    voice: 'Voice', leave: 'Leave', command: 'Command', desk: 'Desk'};

  /* badge counts, derived live */
  M.badges = function badges(ctx) {
    const out = {};
    /* handbook: unread sections */
    const reads = ((ctx.coll.acks.map[ctx.uid] || {}).s) || {};
    out.handbook = Object.keys(ctx.coll.handbook.map)
      .filter(id => (reads[id] || 0) < (ctx.coll.handbook.map[id].updated || 0)).length;
    /* hiring: evaluations assigned to me, not yet submitted, candidate undecided */
    const myEvals = ((ctx.coll.evals.map[ctx.uid] || {}).e) || {};
    out.hiring = Object.keys(ctx.coll.candidates.map).filter(cid => {
      const c = ctx.coll.candidates.map[cid];
      return (c.evaluators || []).includes(ctx.uid) && !c.decision && !myEvals[cid];
    }).length;
    if (ctx.isFounder) {
      /* desk: pending leave requests */
      let pend = 0;
      for (const lu of Object.keys(ctx.coll.leave.map)) {
        const dec = (ctx.coll.leavedec.map[lu] || {}).d || {};
        for (const r of ((ctx.coll.leave.map[lu] || {}).reqs || [])) if (!dec[r.id]) pend++;
      }
      out.desk = pend;
      out.command = ctx.flags.filter(f => f.severity === 'high').length;
    }
    return out;
  };

  const Badge = ({n}) => n > 0 ? html`<span class="badge">${n > 99 ? '99' : n}</span>` : null;

  /* ---------- shell ---------- */
  M.Shell = function Shell() {
    const ctx = M.useCtx();
    const route = M.useRoute();
    const [moreOpen, setMoreOpen] = React.useState(false);

    /* landing page and access guards */
    React.useEffect(() => {
      const page = route.page;
      if (!page) { M.nav(ctx.isFounder ? '#command' : '#today'); return; }
      if (!ctx.isFounder && (page === 'command' || page === 'desk')) M.nav('#today');
    }, [route.page, ctx.isFounder]);

    const b = M.badges(ctx);
    const page = route.page || (ctx.isFounder ? 'command' : 'today');
    const Page = M.pages[PAGE_KEYS[page]] || M.pages.Today || (() => html`<${UI.Card} title="Not built yet"><${UI.Empty} text="This page is on its way."/><//>`);
    const go = k => { setMoreOpen(false); M.nav('#' + k); };

    const item = it => html`<button key=${it.k} type="button"
      class=${'side-item' + (page === it.k ? ' active' : '')} onClick=${() => go(it.k)}>
      <${icons[it.icon]}/><span class="grow">${it.label}</span><${Badge} n=${b[it.k] || 0}/>
    </button>`;

    const groups = NAV.filter(g => !g.founder || ctx.isFounder);
    const tabItems = [
      {k: 'today', label: 'Today', icon: 'today'},
      {k: 'tasks', label: 'My tasks', icon: 'tasks'},
      {k: 'feed', label: 'Feed', icon: 'feed'},
      {k: 'week', label: 'Week', icon: 'week'}
    ];
    const moreKeys = groups.flatMap(g => g.items).filter(it => !tabItems.some(t => t.k === it.k));
    const moreBadge = moreKeys.reduce((n, it) => n + (b[it.k] || 0), 0);

    return html`<div class="app">
      <aside class="sidebar">
        <div class="side-head"><${M.Mark} width="84px"/><span class="os">os</span></div>
        <nav class="side-scroll">
          ${groups.map((g, i) => html`<div key=${i}>
            ${g.group ? html`<div class="side-group micro plain">${g.group}</div>` : null}
            ${g.items.map(item)}
          </div>`)}
        </nav>
        <div class="side-foot">
          <${UI.Avatar} id=${ctx.uid} size=${34}/>
          <div class="grow">
            <div class="nm"><${UI.Name} id=${ctx.uid} fallback="You"/></div>
            <div class="ti num">${(ctx.member && ctx.member.empId) || ''}${ctx.member && ctx.member.title ? ' · ' + ctx.member.title : ''}</div>
          </div>
        </div>
      </aside>

      <div class="topbar">
        <${M.Mark} width="66px"/>
        <${UI.Avatar} id=${ctx.uid} size=${32}/>
      </div>

      <main class="main">
        <div class=${'content' + (WIDE.has(page) ? ' wide' : '')}>
          <${Page} id=${route.id}/>
        </div>
      </main>

      <nav class="tabbar">
        ${tabItems.map(it => html`<button key=${it.k} type="button"
          class=${'tab-item' + (page === it.k ? ' active' : '')} onClick=${() => go(it.k)}>
          <${icons[it.icon]}/><span>${it.label}</span><${Badge} n=${b[it.k] || 0}/>
        </button>`)}
        <button type="button" class=${'tab-item' + (moreOpen ? ' active' : '')} onClick=${() => setMoreOpen(true)}>
          <${icons.more}/><span>More</span><${Badge} n=${moreBadge}/>
        </button>
      </nav>

      <${UI.Drawer} open=${moreOpen} onClose=${() => setMoreOpen(false)} title="More">
        <div class="stack tight">
          ${moreKeys.map(it => html`<button key=${it.k} type="button" class="side-item" onClick=${() => go(it.k)}>
            <${icons[it.icon]}/><span class="grow">${it.label}</span><${Badge} n=${b[it.k] || 0}/>
          </button>`)}
        </div>
      <//>

      <${M.ToastHost}/>
    </div>`;
  };
})();
