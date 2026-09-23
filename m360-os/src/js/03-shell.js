/* m360 OS shell: gates, five simple sections, founder HQ, the floating Ask m360 button. */
'use strict';
(function () {
  const {html, React, U, UI} = M;

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
    nohost: {t: 'Open this inside Claude', l: 'm360 OS runs on claude.ai. Open the shared link there.'},
    nocap: {t: 'Workspace unavailable', l: 'The workspace could not load. Reload in a moment.'},
    noid: {t: 'Sign in to continue', l: 'Sign in to your Claude account, then reload this page.'},
    roster: {t: 'Not on the roster yet', l: "You're signed in, but not on the team roster yet. Kaavish adds you from Admin."}
  };
  M.GateFor = mode => {
    if (mode === 'noid' && M.parts.SignIn) return html`<${M.parts.SignIn}/>`;
    const g = GATES[mode] || GATES.nocap;
    return html`<${M.Gate} title=${g.t} line=${g.l}/>`;
  };

  /* ---------- sections and their tabs ---------- */
  const SECTIONS = {
    home: {label: 'Home', icon: 'today', page: 'Home'},
    work: {label: 'Work', icon: 'tasks', page: 'Work', tabs: [
      {k: 'tasks', label: 'My tasks', route: 'tasks'}, {k: 'projects', label: 'Projects', route: 'projects'},
      {k: 'calendar', label: 'Calendar', route: 'calendar'}, {k: 'reviews', label: 'Reviews', route: 'reviews'},
      {k: 'week', label: 'The week', route: 'week'}]},
    accounts: {label: 'Accounts', icon: 'clients', page: 'Accounts', tabs: [
      {k: 'clients', label: 'Clients', route: 'clients'}, {k: 'pipeline', label: 'Pipeline', route: 'pitches'}]},
    vibe: {label: 'Vibe', icon: 'feed', page: 'Vibe', tabs: [
      {k: 'feed', label: 'Feed', route: 'feed'}, {k: 'crew', label: 'Crew', route: 'people'},
      {k: 'pulse', label: 'Pulse and ideas', route: 'voice'}, {k: 'scores', label: 'Leaderboard', route: 'scores'}]},
    me: {label: 'Me', icon: 'people', page: 'Me', tabs: [
      {k: 'profile', label: 'Profile', route: 'me'}, {k: 'trophies', label: 'Trophies', route: 'trophies'}, {k: 'leave', label: 'Leave', route: 'leave'},
      {k: 'handbook', label: 'Handbook', route: 'handbook'}, {k: 'hiring', label: 'Hiring', route: 'hiring'}]},
    hq: {label: 'HQ', icon: 'command', page: 'HQ', founder: true, tabs: [
      {k: 'brief', label: 'Intelligence', route: 'hq'}, {k: 'dashboard', label: 'Dashboard', route: 'command'},
      {k: 'hiring', label: 'Hiring', route: 'hiring'}]},
    admin: {label: 'Admin', icon: 'desk', page: 'Admin', founder: true}
  };
  M.SECTIONS = SECTIONS;

  /* every hash, old or new, lands in one section and tab */
  function resolve(page, id, isFounder) {
    switch (page) {
      case 'home': case 'today': return {s: 'home'};
      case 'work': return {s: 'work', t: 'tasks'};
      case 'projects': return {s: 'work', t: 'projects', id};
      case 'week': return {s: 'work', t: 'week'};
      case 'calendar': return {s: 'work', t: 'calendar'};
      case 'reviews': case 'review': return {s: 'work', t: 'reviews'};
      case 'trophies': return {s: 'me', t: 'trophies'};
      case 'accounts': case 'clients': return {s: 'accounts', t: 'clients'};
      case 'pitches': case 'pipeline': return {s: 'accounts', t: 'pipeline'};
      case 'vibe': case 'feed': return {s: 'vibe', t: 'feed'};
      case 'people': case 'crew': return {s: 'vibe', t: 'crew', id};
      case 'voice': case 'pulse': return {s: 'vibe', t: 'pulse'};
      case 'scores': return {s: 'vibe', t: 'scores'};
      case 'me': case 'profile': return {s: 'me', t: 'profile'};
      case 'tasks': return {s: 'work', t: 'tasks', id};
      case 'leave': return {s: 'me', t: 'leave'};
      case 'handbook': return {s: 'me', t: 'handbook', id};
      case 'hiring': return isFounder ? {s: 'hq', t: 'hiring', id} : {s: 'me', t: 'hiring', id};
      case 'hq': return isFounder ? {s: 'hq', t: 'brief'} : {s: 'home'};
      case 'command': return isFounder ? {s: 'hq', t: 'dashboard'} : {s: 'home'};
      case 'admin': case 'desk': return isFounder ? {s: 'admin'} : {s: 'home'};
      default: return {s: isFounder ? 'hq' : 'home'};
    }
  }
  M.resolveRoute = resolve;

  /* badge counts, derived live */
  M.badges = function badges(ctx) {
    const out = {};
    const reads = ((ctx.coll.acks.map[ctx.uid] || {}).s) || {};
    const unread = Object.keys(ctx.coll.handbook.map)
      .filter(id => (reads[id] || 0) < (ctx.coll.handbook.map[id].updated || 0)).length;
    const myEvals = ((ctx.coll.evals.map[ctx.uid] || {}).e) || {};
    const evals = Object.keys(ctx.coll.candidates.map).filter(cid => {
      const c = ctx.coll.candidates.map[cid];
      return (c.evaluators || []).includes(ctx.uid) && !c.decision && !myEvals[cid];
    }).length;
    out.handbook = unread; out.hiring = evals; out.me = unread + evals;
    out.reviews = (M.reviews ? M.reviews.queue(ctx).filter(t => M.reviews.canReview(ctx, t)).length : 0);
    out.work = out.reviews;
    out.inbox = M.inbox ? M.inbox.unread(ctx) : 0;
    if (ctx.isFounder) {
      let pend = 0;
      for (const lu of Object.keys(ctx.coll.leave.map)) {
        const dec = (ctx.coll.leavedec.map[lu] || {}).d || {};
        for (const r of ((ctx.coll.leave.map[lu] || {}).reqs || [])) if (!dec[r.id]) pend++;
      }
      out.join = (M.team && M.team.requests) ? M.team.requests(ctx).length : 0;
      out.admin = pend + out.join;
      out.hq = ctx.flags.filter(f => f.severity === 'high').length;
    }
    return out;
  };
  const Badge = ({n}) => n > 0 ? html`<span class="badge">${n > 99 ? '99' : n}</span>` : null;

  /* the tabs a viewer sees in a section (Hiring under Me only for panel members) */
  function visibleTabs(ctx, section, b) {
    return (SECTIONS[section].tabs || []).filter(t => {
      if (section === 'me' && t.k === 'hiring') return !ctx.isFounder && ((b.hiring || 0) > 0 || Object.keys(ctx.coll.candidates.map).some(id => (ctx.coll.candidates.map[id].evaluators || []).includes(ctx.uid)));
      return true;
    });
  }

  /* section tabs, used by every section page (the sidebar lists them on wide screens) */
  M.SectionTabs = function SectionTabs({section, active}) {
    const ctx = M.useCtx();
    const b = M.badges(ctx);
    const tabs = visibleTabs(ctx, section, b);
    if (tabs.length < 2) return null;
    return html`<nav class="tabs section-tabs" aria-label=${SECTIONS[section].label}>
      ${tabs.map(t => html`<button key=${t.k} type="button" class=${'tab' + (t.k === active ? ' active' : '')}
        onClick=${() => M.nav('#' + t.route)}>${t.label}<${Badge} n=${b[t.k] || 0}/></button>`)}
    </nav>`;
  };

  /* ---------- the New menu: every create action in one place ---------- */
  function NewMenu({onClose, onTask, onAsk}) {
    const ctx = M.useCtx();
    const ref = React.useRef(null);
    const [pos, setPos] = React.useState(null);
    React.useLayoutEffect(() => {
      const t = ref.current && ref.current.parentElement.querySelector('.new-trigger');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const w = Math.min(300, window.innerWidth - 32);
      setPos({top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - w - 16)), width: w});
    }, []);
    React.useEffect(() => {
      const away = e => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.new-trigger')) onClose(); };
      const esc = e => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('pointerdown', away);
      document.addEventListener('keydown', esc);
      return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
    }, []);
    const run = fn => () => { onClose(); fn(); };
    const items = [
      {k: 'task', label: 'Task', sub: 'for you or anyone', icon: 'tasks', go: onTask},
      {k: 'post', label: 'Update or win', sub: 'on the feed', icon: 'feed', go: () => M.intend('#feed', 'post')},
      {k: 'kudos', label: 'Kudos', sub: 'thank someone', icon: 'scores', go: () => M.intend('#feed', 'kudos')},
      {k: 'leave', label: 'Leave request', sub: 'days off', icon: 'leave', go: () => M.nav('#leave')},
      {k: 'project', label: 'Project', sub: 'with a template', icon: 'projects', go: () => M.intend('#projects', 'project')},
      ctx.isFounder ? {k: 'pitch', label: 'Pitch', sub: 'into the pipeline', icon: 'pitches', go: () => M.intend('#pitches', 'pitch')} : null,
      {k: 'ask', label: 'Ask m360', sub: 'anything, or hand out work', icon: 'send', go: onAsk}
    ].filter(Boolean);
    return html`<div class="newmenu" ref=${ref} role="menu" aria-label="New"
      style=${pos || {visibility: 'hidden'}}>
      ${items.map(it => html`<button key=${it.k} type="button" role="menuitem" class="newmenu-item" onClick=${run(it.go)}>
        <${M.icons[it.icon]}/><span class="grow"><b>${it.label}</b><span>${it.sub}</span></span>
      </button>`)}
    </div>`;
  }

  /* ---------- the shortcut sheet ---------- */
  function Keys({onClose}) {
    const mod = M.isMac ? '\u2318' : 'Ctrl';
    const rows = [[mod + ' K', 'Search or do anything'], ['/', 'Same, from anywhere'], ['n', 'New task'], ['i', 'Inbox'], ['f', 'Focus timer'], ['b', 'Take a breather'],
      ['g then h', 'Home'], ['g then w', 'Work'], ['g then a', 'Accounts'], ['g then v', 'Vibe'], ['g then m', 'Me'], ['g then c', 'Calendar'], ['g then r', 'Reviews'],
      ['Ctrl + Option, held', 'Talk to the cursor buddy'], ['?', 'This sheet']];
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Keyboard shortcuts">
      <div class="keys">${rows.map(r => html`<${React.Fragment} key=${r[0]}><span class="kbd">${r[0]}</span><span>${r[1]}</span><//>`)}</div>
    <//>`;
  }

  /* ---------- shell ---------- */
  M.Shell = function Shell() {
    const ctx = M.useCtx();
    const route = M.useRoute();
    const [moreOpen, setMoreOpen] = React.useState(false);
    const [askOpen, setAskOpen] = React.useState(false);
    const [newOpen, setNewOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState(false);
    const [palOpen, setPalOpen] = React.useState(false);
    const [inboxOpen, setInboxOpen] = React.useState(false);
    const [keysOpen, setKeysOpen] = React.useState(false);
    const [askInitial, setAskInitial] = React.useState('');
    const theme = M.useTheme();

    React.useEffect(() => {
      if (!route.page) M.nav(ctx.isFounder ? '#hq' : '#home');
      else if (!ctx.isFounder && ['command', 'desk', 'hq', 'admin'].indexOf(route.page) >= 0) M.nav('#home');
    }, [route.page, ctx.isFounder]);

    /* keys: Cmd K for the palette; single letters when nothing is focused */
    React.useEffect(() => {
      let g = 0;
      const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
      const on = e => {
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); setPalOpen(x => !x); return; }
        if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.querySelector('.drawer, .pal, .breathe')) return;
        const k = e.key;
        if (g && Date.now() - g < 900) {
          g = 0;
          const to = {h: '#home', w: '#tasks', a: '#clients', v: '#feed', m: '#me', c: '#calendar', r: '#reviews', q: '#hq'}[k];
          if (to) { e.preventDefault(); M.nav(to); }
          return;
        }
        if (k === 'g') { g = Date.now(); return; }
        if (k === '/') { e.preventDefault(); setPalOpen(true); }
        else if (k === 'n') { e.preventDefault(); setNewTask(true); }
        else if (k === 'i') { e.preventDefault(); setInboxOpen(true); }
        else if (k === 'f') { e.preventDefault(); M.focus && M.focus.open(); }
        else if (k === 'b') { e.preventDefault(); M.breathe && M.breathe.open(); }
        else if (k === '?') { e.preventDefault(); setKeysOpen(true); }
      };
      window.addEventListener('keydown', on);
      const open = () => setAskOpen(true);
      const inbox = () => setInboxOpen(true);
      const keys = () => setKeysOpen(true);
      window.addEventListener('m360:ask', open); window.addEventListener('m360:inbox', inbox); window.addEventListener('m360:keys', keys);
      return () => { window.removeEventListener('keydown', on); window.removeEventListener('m360:ask', open); window.removeEventListener('m360:inbox', inbox); window.removeEventListener('m360:keys', keys); };
    }, []);

    const r = resolve(route.page, route.id, ctx.isFounder);
    const sec = SECTIONS[r.s] || SECTIONS.home;
    const Page = M.pages[sec.page];
    const b = M.badges(ctx);
    const go = k => { setMoreOpen(false); M.nav('#' + k); };

    const mainKeys = ['home', 'work', 'accounts', 'vibe', 'me'];
    const founderKeys = ctx.isFounder ? ['hq', 'admin'] : [];
    const item = k => {
      const s = SECTIONS[k];
      const subs = r.s === k ? visibleTabs(ctx, k, b) : [];
      return html`<${React.Fragment} key=${k}>
        <button type="button"
          class=${'side-item' + (r.s === k ? ' active' : '') + (s.founder ? ' founder' : '')} onClick=${() => go(k)}>
          <${M.icons[s.icon]}/><span class="grow">${s.label}</span><${Badge} n=${b[k] || 0}/>
        </button>
        ${subs.length > 1 ? html`<div class="side-subs">
          ${subs.map(t => html`<button key=${t.k} type="button" class=${'side-sub' + (r.t === t.k ? ' active' : '')}
            onClick=${() => { setMoreOpen(false); M.nav('#' + t.route); }}>
            <span class="grow">${t.label}</span><${Badge} n=${b[t.k] || 0}/></button>`)}
        </div>` : null}
      <//>`;
    };
    const newMenu = where => newOpen === where ? html`<${NewMenu} onClose=${() => setNewOpen(false)}
      onTask=${() => setNewTask(true)} onAsk=${() => setAskOpen(true)}/>` : null;

    const tabKeys = ctx.isFounder ? ['hq', 'work', 'accounts', 'vibe'] : ['home', 'work', 'accounts', 'vibe', 'me'];
    const moreKeys = ctx.isFounder ? ['home', 'me', 'admin'] : [];
    const moreBadge = moreKeys.reduce((n, k) => n + (b[k] || 0), 0);

    return html`<div class="app">
      <aside class="sidebar">
        <div class="side-head"><${M.Mark} width="84px"/><span class="os">os</span></div>
        <div class="side-actions">
          <div class="new-wrap">
            <button type="button" class="btn new-trigger" aria-expanded=${newOpen === 'side' ? 'true' : 'false'}
              onClick=${() => setNewOpen(x => x === 'side' ? false : 'side')}><${M.icons.plus}/>New</button>
            ${newMenu('side')}
          </div>
          <button type="button" class="side-ask" onClick=${() => setPalOpen(true)}>
            <${M.icons.search}/><span class="grow">Search or do anything</span><span class="kbd">${M.isMac ? '\u2318K' : 'Ctrl K'}</span>
          </button>
        </div>
        <div class="side-tools">
          <button type="button" class="iconbtn bellbtn" aria-label="Inbox" title="Inbox (i)" onClick=${() => setInboxOpen(true)}><${M.icons.bell}/><${Badge} n=${b.inbox || 0}/></button>
          <button type="button" class="iconbtn" aria-label="Focus timer" title="Focus (f)" onClick=${() => M.focus && M.focus.open()}><${M.icons.timer}/></button>
          <button type="button" class="iconbtn" aria-label="Ask m360" title="Ask m360" onClick=${() => setAskOpen(true)}><span class="flame-t" aria-hidden="true" style=${{fontSize: '16px'}}>\u2726</span></button>
          <button type="button" class="iconbtn" aria-label=${'Theme: ' + theme} title="Theme" onClick=${() => M.toast('Theme: ' + M.theme.cycle())}>${M.theme.resolved() === 'dark' ? html`<${M.icons.sun}/>` : html`<${M.icons.moon}/>`}</button>
        </div>
        ${M.parts.FocusPill ? html`<${M.parts.FocusPill}/>` : null}
        <nav class="side-scroll">
          ${mainKeys.map(item)}
          ${founderKeys.length ? html`<div class="side-group micro plain">founder</div>` : null}
          ${founderKeys.map(item)}
        </nav>
        <button type="button" class="side-foot rowbtn" style=${{borderRadius: 0}} onClick=${() => go('me')}>
          <${UI.Avatar} id=${ctx.uid} size=${36}/>
          <div class="grow">
            <div class="nm"><${UI.Name} id=${ctx.uid} fallback="You"/></div>
            <div class="ti num">${(ctx.member && ctx.member.empId) || ''}${ctx.member && ctx.member.title ? ' · ' + ctx.member.title : ''}</div>
          </div>
        </button>
      </aside>

      <div class="topbar">
        <${M.Mark} width="66px"/>
        <div class="row nowrap" style=${{gap: '8px'}}>
          ${M.parts.FocusPill ? html`<${M.parts.FocusPill} compact=${true}/>` : null}
          <button type="button" class="iconbtn bellbtn" aria-label="Inbox" onClick=${() => setInboxOpen(true)}><${M.icons.bell}/><${Badge} n=${b.inbox || 0}/></button>
          <button type="button" class="iconbtn" aria-label="Search" onClick=${() => setPalOpen(true)}><${M.icons.search}/></button>
          <div class="new-wrap">
            <button type="button" class="iconbtn new-trigger dark" aria-label="New" onClick=${() => setNewOpen(x => x === 'top' ? false : 'top')}><${M.icons.plus}/></button>
            ${newMenu('top')}
          </div>
          <button type="button" class="rowbtn" style=${{width: 'auto'}} onClick=${() => go('me')} aria-label="Me">
            <${UI.Avatar} id=${ctx.uid} size=${34}/></button>
        </div>
      </div>

      <main class="main">
        <div class=${'content' + (['work', 'accounts', 'hq'].indexOf(r.s) >= 0 ? ' wide' : '')}>
          ${Page ? html`<${Page} tab=${r.t} id=${r.id}/>` : html`<${UI.Card} title="Loading"><${UI.Empty} text="One moment."/><//>`}
        </div>
      </main>

      ${M.parts.Buddy ? html`<${M.parts.Buddy} onOpenChat=${() => setAskOpen(true)}/>` : null}

      <nav class="tabbar">
        ${tabKeys.map(k => html`<button key=${k} type="button"
          class=${'tab-item' + (r.s === k ? ' active' : '')} onClick=${() => go(k)}>
          <${M.icons[SECTIONS[k].icon]}/><span>${SECTIONS[k].label}</span><${Badge} n=${b[k] || 0}/>
        </button>`)}
        ${moreKeys.length ? html`<button type="button" class=${'tab-item' + (moreKeys.indexOf(r.s) >= 0 ? ' active' : '')} onClick=${() => setMoreOpen(true)}>
          <${M.icons.more}/><span>More</span><${Badge} n=${moreBadge}/>
        </button>` : null}
      </nav>

      <${UI.Drawer} open=${moreOpen} onClose=${() => setMoreOpen(false)} title="More">
        <div class="stack tight">${moreKeys.map(item)}</div>
      <//>

      ${askOpen && M.parts.Ask ? html`<${M.parts.Ask} initial=${askInitial} onClose=${() => { setAskOpen(false); setAskInitial(''); }}/>` : null}
      ${palOpen && M.parts.Palette ? html`<${M.parts.Palette} onClose=${() => setPalOpen(false)} onAsk=${q => { setAskInitial(q); setAskOpen(true); }}/>` : null}
      ${inboxOpen && M.parts.Inbox ? html`<${M.parts.Inbox} onClose=${() => setInboxOpen(false)}/>` : null}
      ${keysOpen ? html`<${Keys} onClose=${() => setKeysOpen(false)}/>` : null}
      ${M.parts.FocusHost ? html`<${M.parts.FocusHost}/>` : null}
      ${M.parts.BreatheHost ? html`<${M.parts.BreatheHost}/>` : null}
      ${newTask && M.parts.TaskDrawer ? html`<${M.parts.TaskDrawer} taskId=${null} defaults=${{owner: ctx.uid}} onClose=${() => setNewTask(false)}/>` : null}
      <${M.ToastHost}/>
    </div>`;
  };

  /* shared hero for section pages */
  M.SectionHero = function SectionHero({color, micro, title, sub, children, right}) {
    return html`<header class=${'hero' + (color === 'ink' ? ' ink' : '')} style=${{padding: '24px 26px 22px'}}>
      <div class="row between" style=${{alignItems: 'flex-start'}}>
        <div class="grow">
          ${micro ? html`<${UI.Micro}>${micro}<//>` : null}
          <h1 class="hi" style=${{fontSize: 'clamp(30px,4vw,46px)'}}>${title}</h1>
          ${sub ? html`<div class="sub" style=${{marginTop: '10px', maxWidth: '60ch'}}>${sub}</div>` : null}
        </div>
        ${right || null}
      </div>
      ${children ? html`<div style=${{marginTop: '16px'}}>${children}</div>` : null}
    </header>`;
  };
})();
