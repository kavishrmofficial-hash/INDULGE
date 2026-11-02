/* m360 OS shell: gates, the sections, founder HQ, the v7 frame (glass sidebar, island, phone capsule and tab bar), the buddy in its dock. */
'use strict';
(function () {
  const {html, React, U, UI} = M;

  /* ---------- gates ---------- */
  M.Gate = function Gate({title, line, children}) {
    return html`<div class="gate"><div>
      <${M.Mark} width="150px"/>
      <h1>${title}</h1>
      ${line ? html`<p>${line}</p>` : null}
      ${children ? html`<div class="g-act">${children}</div>` : null}
    </div></div>`;
  };
  /* v38: a page that throws while it draws shows this card, with the menu still there, never a white screen.
     One odd document from anyone must not take the app down for everyone. Moving to another page resets it */
  class Crash extends React.Component {
    constructor(p) { super(p); this.state = {bad: false}; }
    static getDerivedStateFromError() { return {bad: true}; }
    componentDidCatch(e) { try { console.error('m360 page stopped:', e && e.message ? e.message : e); } catch (x) { /* quiet */ } }
    render() {
      if (!this.state.bad) return this.props.children;
      const card = html`<div class="crash-card" role="alert" id="page-crash">
        <h2>This page did not load</h2>
        <p>Your work is saved. Reload to try again, or open another page.</p>
        <button type="button" class="btn" onClick=${() => location.reload()}>Reload</button>
      </div>`;
      return this.props.whole ? html`<${M.Gate} title="m360 did not load" line="Your work is saved. Reload to try again."><button type="button" class="btn" onClick=${() => location.reload()}>Reload</button><//>` : card;
    }
  }
  M.Crash = Crash;
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
    /* v40: the design's labels where a section matches its place (design/m360-os-v7.html): Home reads Today, HQ reads Command; routes and ids stay */
    home: {label: 'Today', alias: 'Home', icon: 'today', page: 'Home'},
    work: {label: 'Work', icon: 'tasks', page: 'Work', tabs: [
      {k: 'tasks', label: 'My tasks', route: 'tasks'}, {k: 'projects', label: 'Projects', route: 'projects'},
      {k: 'calendar', label: 'Calendar', route: 'calendar'}, {k: 'reviews', label: 'Reviews', route: 'reviews'},
      {k: 'week', label: 'The week', route: 'week'}]},
    /* v37: three tabs. People we are talking to, proposals in the pipeline, clients we work for. The older
       views (prospects, crm, handshake) still open by their own hash and sit behind "More tools" */
    accounts: {label: 'Accounts', icon: 'clients', page: 'Accounts', tabs: [
      {k: 'talks', label: 'People', route: 'talks'}, {k: 'pipeline', label: 'Pipeline', route: 'pitches'},
      {k: 'clients', label: 'Clients', route: 'clients'}]},
    vibe: {label: 'Vibe', icon: 'feed', page: 'Vibe', tabs: [
      {k: 'feed', label: 'Feed', route: 'feed'}, {k: 'crew', label: 'Crew', route: 'people'},
      {k: 'pulse', label: 'Pulse and ideas', route: 'voice'}, {k: 'scores', label: 'Leaderboard', route: 'scores'}, {k: 'music', label: 'Music', route: 'music'},
      /* the office, team scope (the founder's own office is under HQ) */
      {k: 'office', label: 'Office', route: 'office', member: true}]},
    break: {label: 'Break', icon: 'breath', page: 'Break', tabs: [
      {k: 'play', label: 'Daily', route: 'play'}, {k: 'reset', label: 'Reset', route: 'reset'}, {k: 'care', label: 'Care', route: 'care'}, {k: 'reflect', label: 'Reflect', route: 'reflect'}]},
    base: {label: 'Base', icon: 'database', page: 'Base', tabs: [
      {k: 'people', label: 'People', route: 'base'}, {k: 'companies', label: 'Companies', route: 'companies'}, {k: 'import', label: 'Import', route: 'import'}]},
    chat: {label: 'Chat', icon: 'send', page: 'Chat'},
    workspace: {label: 'Workspace', icon: 'mail', page: 'Workspace', tabs: [
      {k: 'mail', label: 'Mail', route: 'mail'}, {k: 'gcal', label: 'Calendar', route: 'gcal'}, {k: 'drive', label: 'Drive', route: 'drive'}]},
    web: {label: 'Web', icon: 'link', page: 'Web'},
    radar: {label: 'Radar', icon: 'radar', page: 'Radar', tabs: [
      {k: 'news', label: 'News', route: 'radar'}, {k: 'awards', label: 'Awards', route: 'awards'}, {k: 'watch', label: 'Watch', route: 'watch'}]},
    me: {label: 'Me', icon: 'people', page: 'Me', tabs: [
      {k: 'profile', label: 'Profile', route: 'me'}, {k: 'character', label: 'Character', route: 'character'}, {k: 'notes', label: 'Notes', route: 'notes'}, {k: 'trophies', label: 'Trophies', route: 'trophies'}, {k: 'leave', label: 'Leave', route: 'leave'},
      {k: 'handbook', label: 'Handbook', route: 'handbook'}, {k: 'hiring', label: 'Hiring', route: 'hiring'},
      /* what the m360 COO does, read only (the founder runs it from HQ) */
      {k: 'coo', label: 'COO', route: 'coo', member: true}]},
    hq: {label: 'Command', alias: 'HQ', icon: 'command', page: 'HQ', founder: true, tabs: [
      /* v40: HQ opens on Command (40-command.js); the brief and the rest sit under its "more from HQ" (55-hq.js) */
      {k: 'brief', label: 'Command', route: 'hq'},
      {k: 'coo', label: 'COO', route: 'coo'}, {k: 'office', label: 'Office', route: 'office'},
      {k: 'hiring', label: 'Hiring', route: 'hiring'}]},
    admin: {label: 'Admin', icon: 'desk', page: 'Admin', founder: true},
    books: {label: 'Books', icon: 'log', page: 'Books', founder: true, owner: true, tabs: [
      {k: 'overview', label: 'Overview', route: 'books'}, {k: 'invoices', label: 'Invoices', route: 'invoices'},
      {k: 'statement', label: 'Bank', route: 'statement'}, {k: 'expenses', label: 'Expenses', route: 'expenses'}, {k: 'payroll', label: 'Payroll', route: 'payroll'},
      {k: 'letters', label: 'Letters', route: 'letters'}, {k: 'billing', label: 'Setup', route: 'billing'}]},
    map: {label: 'What\'s here', icon: 'map', page: 'Map'}
  };
  M.SECTIONS = SECTIONS;

  /* every hash, old or new, lands in one section and tab */
  function resolve(page, id, isFounder, isOwner) {
    switch (page) {
      case 'books': case 'accounts-books': case 'ledger': return isOwner ? {s: 'books', t: 'overview'} : {s: 'home'};
      case 'invoices': case 'invoice': return isOwner ? {s: 'books', t: 'invoices', id} : {s: 'home'};
      case 'expenses': case 'expense': return isOwner ? {s: 'books', t: 'expenses', id} : {s: 'home'};
      case 'payroll': case 'payslips': return isOwner ? {s: 'books', t: 'payroll', id} : {s: 'home'};
      case 'letters': case 'letter': return isOwner ? {s: 'books', t: 'letters', id} : {s: 'home'};
      case 'billing': return isOwner ? {s: 'books', t: 'billing', id} : {s: 'home'};
      case 'statement': case 'statements': case 'bank': return isOwner ? {s: 'books', t: 'statement', id} : {s: 'home'};
      case 'home': case 'today': return {s: 'home'};
      case 'map': case 'explore': case 'whats-here': case 'help': return {s: 'map', id};
      case 'break': case 'wellness': case 'games': case 'play': case 'daily': case 'five': return {s: 'break', t: 'play'};
      case 'reset': case 'meditate': case 'breathe': return {s: 'break', t: 'reset'};
      case 'care': case 'reminders': return {s: 'break', t: 'care'};
      case 'reflect': case 'wrapped': return {s: 'break', t: 'reflect'};
      case 'work': return {s: 'work', t: 'tasks'};
      case 'projects': return {s: 'work', t: 'projects', id};
      case 'week': return {s: 'work', t: 'week'};
      case 'calendar': return {s: 'work', t: 'calendar'};
      case 'reviews': case 'review': return {s: 'work', t: 'reviews'};
      case 'trophies': return {s: 'me', t: 'trophies'};
      case 'character': case 'avatar': case 'look': return {s: 'me', t: 'character'};
      case 'clients': return {s: 'accounts', t: 'clients', id};
      case 'accounts': case 'talks': case 'talk': case 'conversations': return {s: 'accounts', t: 'talks', id};
      case 'pitches': case 'pipeline': return {s: 'accounts', t: 'pipeline'};
      case 'prospects': case 'followups': case 'follow-ups': return {s: 'accounts', t: 'prospects', id};
      case 'crm': return {s: 'accounts', t: 'crm'};
      case 'handshake': case 'dm': case 'dms': return {s: 'accounts', t: 'handshake', id};
      case 'web': case 'browser': return {s: 'web'};
      case 'chat': case 'dm': return {s: 'chat', id};
      case 'mail': case 'gmail': case 'workspace': return {s: 'workspace', t: 'mail'};
      case 'gcal': case 'meetings': return {s: 'workspace', t: 'gcal'};
      case 'drive': return {s: 'workspace', t: 'drive'};
      case 'vibe': case 'feed': return {s: 'vibe', t: 'feed'};
      case 'people': case 'crew': return {s: 'vibe', t: 'crew', id};
      case 'voice': case 'pulse': return {s: 'vibe', t: 'pulse'};
      case 'scores': return {s: 'vibe', t: 'scores'};
      case 'music': case 'playlist': return {s: 'vibe', t: 'music'};
      case 'notes': case 'note': return {s: 'me', t: 'notes', id};
      case 'base': case 'contacts': case 'people-base': return {s: 'base', t: 'people', id};
      case 'companies': case 'orgs': return {s: 'base', t: 'companies', id};
      case 'import': return {s: 'base', t: 'import'};
      case 'radar': case 'news': return {s: 'radar', t: 'news'};
      case 'awards': return {s: 'radar', t: 'awards'};
      case 'watch': return {s: 'radar', t: 'watch'};
      case 'me': case 'profile': return {s: 'me', t: 'profile'};
      case 'tasks': return {s: 'work', t: 'tasks', id};
      case 'leave': return {s: 'me', t: 'leave'};
      case 'handbook': return {s: 'me', t: 'handbook', id};
      case 'hiring': return isFounder ? {s: 'hq', t: 'hiring', id} : {s: 'me', t: 'hiring', id};
      case 'hq': return isFounder ? {s: 'hq', t: 'brief'} : {s: 'home'};
      case 'command': case 'dashboard': return isFounder ? {s: 'hq', t: 'brief'} : {s: 'home'};
      /* the m360 COO: the founder's tab under HQ, the charter under Me for everyone else */
      case 'coo': return isFounder ? {s: 'hq', t: 'coo'} : {s: 'me', t: 'coo'};
      /* the virtual office: the founder's under HQ, the team's under Vibe */
      case 'office': case 'studio': case 'coo-office': return isFounder ? {s: 'hq', t: 'office'} : {s: 'vibe', t: 'office'};
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
    out.chat = (M.rooms && ctx.coll.chat) ? M.rooms.unreadRooms(ctx) : 0;
    if (ctx.isFounder) {
      let pend = 0;
      for (const lu of Object.keys(ctx.coll.leave.map)) {
        const dec = (ctx.coll.leavedec.map[lu] || {}).d || {};
        for (const r of ((ctx.coll.leave.map[lu] || {}).reqs || [])) if (!dec[r.id]) pend++;
      }
      out.join = (M.team && M.team.requests) ? M.team.requests(ctx).length : 0;
      if (ctx.isOwner && M.books) { const td = U.todayStr(); out.books = M.books.invoices(ctx).filter(i => { const st = M.books.status(i, td); return st === 'overdue' || (st === 'part' && i.due && i.due < td); }).length; }
      /* the Admin item counts leave waiting, corrections waiting and people waiting to join */
      out.admin = pend + (M.fixes && M.fixes.pending ? M.fixes.pending(ctx).length : 0) + (out.join || 0);
      out.hq = ctx.flags.filter(f => f.severity === 'high').length;
    }
    return out;
  };
  const Badge = ({n}) => n > 0 ? html`<span class="badge">${n > 99 ? '99' : n}</span>` : null;

  /* the tabs a viewer sees in a section (Hiring under Me only for panel members) */
  function visibleTabs(ctx, section, b) {
    return (SECTIONS[section].tabs || []).filter(t => {
      if (section === 'me' && t.k === 'hiring') return !ctx.isFounder && ((b.hiring || 0) > 0 || Object.keys(ctx.coll.candidates.map).some(id => (ctx.coll.candidates.map[id].evaluators || []).includes(ctx.uid)));
      if (t.founder) return !!ctx.isFounder;
      if (t.member) return !ctx.isFounder;
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
      ${tabs.map(t => html`<button key=${t.k} type="button" class=${'tab' + (t.k === active ? ' active' : '')} title=${M.map ? M.map.blurbOf(section, t.k) : ''}
        onClick=${() => M.nav('#' + t.route)}>${t.label}<${Badge} n=${b[t.k] || 0}/></button>`)}
    </nav>`;
  };

  /* ---------- banners above the page: lock, alert, preview ---------- */
  /* everyone but the owner sees the lock line while settings.locked is on (v39: admins are locked too) */
  function LockBanner() {
    const ctx = M.useCtx();
    if (!ctx.locked || ctx.isOwner) return null;
    const note = String(ctx.settings.lockNote || '').trim();
    return html`<div class="lockbar" id="lock-banner" role="status">
      <span>m360 is locked for changes right now.${note ? ' ' + note : ''}</span>
    </div>`;
  }
  /* the founder's alert, shown to everyone until its date, dismissable for the day on this device */
  const alertKey = a => String(a.at || 0) + ':' + U.todayStr();
  function AlertBanner() {
    const ctx = M.useCtx();
    const [hidden, setHidden] = React.useState(() => M.prefs.get('alertSeen', ''));
    const a = ctx.settings.alert;
    if (!a || !String(a.text || '').trim()) return null;
    if (!a.until || a.until < U.todayStr()) return null;
    if (hidden === alertKey(a)) return null;
    const dismiss = () => { M.prefs.set('alertSeen', alertKey(a)); setHidden(alertKey(a)); };
    return html`<div class="alertbar" id="alert-banner" role="status">
      <span class="grow">${String(a.text).slice(0, 140)}</span>
      <button type="button" class="iconbtn" aria-label="Dismiss" title="Dismiss for today" onClick=${dismiss}><${M.icons.x}/></button>
    </div>`;
  }
  /* view as: a sticky ink bar while the founder previews the app as someone else */
  function PreviewBar() {
    const ctx = M.useCtx();
    if (!ctx.viewAs) return null;
    return html`<div class="previewbar" id="preview-bar" role="status">
      <${UI.Avatar} id=${ctx.viewAs} size=${26}/>
      <span class="grow">Viewing as <b><${UI.Name} id=${ctx.viewAs}/></b>. Preview only, nothing saves.</span>
      <button type="button" class="btn sm" onClick=${() => M.viewAs.set(null)}>Exit</button>
    </div>`;
  }
  M.parts.LockBanner = LockBanner;
  M.parts.AlertBanner = AlertBanner;
  M.parts.PreviewBar = PreviewBar;

  /* ---------- the shortcut sheet ---------- */
  function Keys({onClose}) {
    const mod = M.isMac ? '\u2318' : 'Ctrl';
    const rows = [[mod + ' K', 'Search or do anything'], ['/', 'Same, from anywhere'], ['n', 'New task'], ['i', 'Inbox'], ['f', 'Focus timer'], ['b', 'Slow breathing, five minutes'],
      ['g then h', 'Home'], ['g then w', 'Work'], ['g then a', 'Accounts'], ['g then v', 'Vibe'], ['g then m', 'Me'], ['g then c', 'Calendar'], ['g then r', 'Reviews'],
      ['Ctrl + Option, held', 'Talk to m360, let go to send'], ['Ctrl + Option + L', 'Conversation mode, on and off'], ['?', 'This sheet']];
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Keyboard shortcuts">
      <div class="keys">${rows.map(r => html`<${React.Fragment} key=${r[0]}><span class="kbd">${r[0]}</span><span>${r[1]}</span><//>`)}</div>
    <//>`;
  }

  /* ---------- shell ---------- */
  /* v40: the v7 frame, markup and classes as design/m360-os-v7.html draws them. A glass sidebar (aside.side,
     slim 80px icons, 248px with names, [ toggles it, remembered per browser): the live mark at its top, the
     pages in labelled groups with a black pill under the open one, a flame tick and flame badges, and a foot of
     exactly Ask m360 with its key, Expand or Collapse, and the profile. On a phone a glass capsule (the mark,
     the page pill, the menu button), the jump list of the page's tabs, a full screen menu, and a glass tab bar
     with a black lens and the round Ask button. Hooks the tests and other modules read ride along as extra
     classes and ids (sidebar, side-item, side-foot, side-map, topbar, tab-item) */
  const LiveMark = props => (M.parts.LiveMark ? html`<${M.parts.LiveMark} ...${props}/>` : html`<${M.Mark} width="76px"/>`);
  const DI = k => (M.chrome && M.chrome.icons && M.chrome.icons[k]) || M.icons[k] || M.icons.today;
  const Ico = ({k}) => { const C = DI(k); return html`<${C}/>`; };
  /* each place in the design's own icon set */
  const SEC_IC = {hq: 'command', admin: 'desk', books: 'handbook', home: 'today', work: 'tasks', accounts: 'clients', chat: 'voice', workspace: 'week',
    base: 'people', radar: 'pitches', web: 'search', vibe: 'feed', break: 'leave', me: 'hiring', map: 'projects'};
  const Bd = ({n, cls}) => n > 0 ? html`<b class=${'bd' + (cls ? ' ' + cls : '')}>${n > 99 ? '99' : n}</b>` : null;
  const two = n => ('0' + n).slice(-2);
  /* Command's sections (40-command.js ids) for the capsule's picker, in the design's words */
  const CMD_SECS = [['c-need', 'needs you'], ['c-nums', 'numbers'], ['c-att', 'attendance'], ['c-flg', 'flags'], ['c-biz', 'business'], ['c-team', 'team'], ['c-cli', 'clients']];

  /* the groups the sidebar and the menu list, in the design's order: founder, work, team, then help */
  function navGroups(ctx) {
    const g = [];
    if (ctx.isFounder) g.push({g: 'founder', items: ctx.isOwner ? ['hq', 'admin', 'books'] : ['hq', 'admin']});
    g.push({g: 'work', items: ['home', 'work', 'accounts', 'chat', 'workspace', 'base', 'radar', 'web']});
    g.push({g: 'team', items: ['vibe', 'break', 'me']});
    g.push({g: 'help', items: ['map']});
    return g;
  }

  /* a part that fades in and out: in the page from the moment it opens until its fade has run after it closes,
     so nothing hidden lingers for a screen reader or a test to find */
  function useShown(open, ms) {
    const [mounted, setMounted] = React.useState(open);
    const [on, setOn] = React.useState(false);
    React.useEffect(() => {
      if (open) {
        setMounted(true);
        const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
        return () => cancelAnimationFrame(r);
      }
      setOn(false);
      const t = setTimeout(() => setMounted(false), M.reduced && M.reduced() ? 0 : ms);
      return () => clearTimeout(t);
    }, [open]);
    return [mounted, on];
  }

  /* the full screen menu on a phone (design .menu): every place, grouped, staggering in */
  function Menu({open, groups, active, badges, onGo, onClose}) {
    const [mounted, on] = useShown(open, 420);
    React.useEffect(() => {
      if (!open) return undefined;
      document.documentElement.classList.add('mn-open');
      const f = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
      window.addEventListener('keydown', f);
      return () => { document.documentElement.classList.remove('mn-open'); window.removeEventListener('keydown', f); };
    }, [open]);
    if (!mounted) return null;
    let j = 0;
    return html`<div class=${'menu' + (on ? ' open' : '')} id="menu" aria-hidden=${open ? 'false' : 'true'} role="dialog" aria-modal="true" aria-label="Menu">
      <div class="menu-top"><span class="cap"><b>M360 OS</b></span><button class="cap lnkb" id="menuClose" type="button" onClick=${onClose}>CLOSE</button></div>
      <div class="menu-list" id="menuList">
        ${groups.map(g => html`<${React.Fragment} key=${g.g}>
          <div class="grp">${g.g}</div>
          ${g.items.map(k => { const s = SECTIONS[k]; const jj = j++; return html`<button key=${k} type="button" class=${'nv' + (active === k ? ' on' : '')} data-k=${k} style=${{'--j': jj}}
            aria-current=${active === k ? 'page' : null} onClick=${() => { onGo(k); setTimeout(onClose, 180); }}>
            <${Ico} k=${SEC_IC[k]}/><span class="nl">${s.label}</span><${Bd} n=${badges[k] || 0}/></button>`; })}
        <//>`)}
      </div>
    </div>`;
  }

  /* the capsule's jump list (design .jump): the page's tabs with their flame numbers */
  function Jump({open, tabs, at, onGo}) {
    const [mounted, on] = useShown(open, 520);
    if (!mounted) return html`<div class="jump lg" id="jump" aria-hidden="true"></div>`;
    return html`<div class=${'jump lg' + (on ? ' open' : '')} id="jump" aria-hidden=${open ? 'false' : 'true'}>
      ${tabs.map((t, i) => html`<button key=${t.k} type="button" data-s=${t.k} class=${i === at ? 'on' : ''} onClick=${() => onGo(t)}><i>${two(i + 1)}</i>${t.label}</button>`)}
    </div>`;
  }

  M.Shell = function Shell() {
    const ctx = M.useCtx();
    const route = M.useRoute();
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [jumpOpen, setJumpOpen] = React.useState(false);
    /* Command's sections as the page scrolls: which are drawn, and the one under the reading line */
    const [cmdAt, setCmdAt] = React.useState({id: '', ids: []});
    const [askOpen, setAskOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState(false);
    const [palOpen, setPalOpen] = React.useState(false);
    const [inboxOpen, setInboxOpen] = React.useState(false);
    const [keysOpen, setKeysOpen] = React.useState(false);
    const [askInitial, setAskInitial] = React.useState('');
    const [sbx, setSbx] = React.useState(() => document.documentElement.classList.contains('sbx'));
    const sideRef = React.useRef(null), tabRef = React.useRef(null);
    const meProf = M.useProfiles(ctx.uid ? [ctx.uid] : [])[ctx.uid];
    const askAt = initial => { if (M.assistant && M.assistant.open) M.assistant.open(initial || ''); else { setAskInitial(initial || ''); setAskOpen(true); } };
    /* the Ask bar: the island grows into it when the island is here, the palette opens as before when not */
    const isl = M.island;
    const openBar = from => { if (isl) isl.cmd('', from); else setPalOpen(true); };
    const toggleBar = () => { if (isl) { if (isl.isCmd()) isl.close(); else isl.cmd(''); } else setPalOpen(x => !x); };
    React.useEffect(() => {
      if (!isl) return undefined;
      isl.onCmd(open => setPalOpen(!!open));
      return () => isl.onCmd(null);
    }, []);
    React.useEffect(() => { if (!palOpen && isl && isl.isCmd()) isl.close(); }, [palOpen]);
    React.useEffect(() => (M.chrome ? M.chrome.sb.on(setSbx) : undefined), []);
    /* the jump list folds away when the page scrolls, the way the design's does */
    React.useEffect(() => { if (M.chrome && M.chrome.fx.onScrollClose) M.chrome.fx.onScrollClose(() => setJumpOpen(false)); }, []);

    React.useEffect(() => {
      if (!route.page) M.nav(ctx.isFounder ? '#hq' : '#home');
      else if (!ctx.isFounder && ['command', 'desk', 'hq', 'admin'].indexOf(route.page) >= 0) M.nav('#home');
    }, [route.page, ctx.isFounder]);

    /* keys: Cmd K and / for the Ask bar; single letters when nothing is focused ([ lives with the sidebar) */
    React.useEffect(() => {
      let g = 0;
      const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
      const on = e => {
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); toggleBar(); return; }
        if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.querySelector('.drawer, .pal, #island.cmd, .breathe, .menu.open, [data-hotkeys]')) return;
        const k = e.key;
        if (g && Date.now() - g < 900) {
          g = 0;
          const to = {h: '#home', w: '#tasks', a: '#clients', v: '#feed', m: '#me', c: '#calendar', r: '#reviews', q: '#hq'}[k];
          if (to) { e.preventDefault(); M.nav(to); }
          return;
        }
        if (k === 'g') { g = Date.now(); return; }
        if (k === '/') { e.preventDefault(); openBar(); }
        else if (k === 'n') { e.preventDefault(); setNewTask(true); }
        else if (k === 'i') { e.preventDefault(); setInboxOpen(true); }
        else if (k === 'f') { e.preventDefault(); M.focus && M.focus.open(); }
        else if (k === 'b') { e.preventDefault(); M.breathe && M.breathe.open('slow'); }
        else if (k === '?') { e.preventDefault(); setKeysOpen(true); }
      };
      window.addEventListener('keydown', on);
      /* Ask m360 opens the buddy's pop-up at the dock; only its expand button opens the wide drawer */
      const open = e => askAt(e && e.detail && e.detail.initial);
      const wide = e => { setAskInitial((e && e.detail && e.detail.initial) || ''); setAskOpen(true); };
      const inbox = () => setInboxOpen(true);
      const keys = () => setKeysOpen(true);
      const task = () => setNewTask(true);
      window.addEventListener('m360:ask', open); window.addEventListener('m360:askwide', wide); window.addEventListener('m360:inbox', inbox); window.addEventListener('m360:keys', keys); window.addEventListener('m360:newtask', task);
      return () => { window.removeEventListener('keydown', on); window.removeEventListener('m360:ask', open); window.removeEventListener('m360:askwide', wide); window.removeEventListener('m360:inbox', inbox); window.removeEventListener('m360:keys', keys); window.removeEventListener('m360:newtask', task); };
    }, []);

    /* v39: an open inbox or search holds one history entry, so the phone's back button closes it and leaves the page as it is */
    const ovOpen = palOpen || inboxOpen;
    const ovRef = React.useRef(false), ovWas = React.useRef(false);
    ovRef.current = ovOpen;
    React.useEffect(() => {
      if (ovOpen) {
        ovWas.current = true;
        try { if (!(history.state && history.state.m360ov)) history.pushState({m360ov: 1}, '', location.href); } catch (e) { /* framed: no history */ }
        return undefined;
      }
      if (!ovWas.current) return undefined;
      ovWas.current = false;
      /* closed from inside: give the entry back, unless a row opened a page, which then sits after it */
      const t = setTimeout(() => { try { if (!ovRef.current && history.state && history.state.m360ov) history.back(); } catch (e) { /* fine */ } }, 120);
      return () => clearTimeout(t);
    }, [ovOpen]);
    React.useEffect(() => {
      const on = e => {
        const ours = !!(e.state && e.state.m360ov);
        if (ovRef.current && !ours) { setPalOpen(false); setInboxOpen(false); }
        else if (!ovRef.current && ours) { try { history.back(); } catch (err) { /* fine */ } }
      };
      window.addEventListener('popstate', on);
      return () => window.removeEventListener('popstate', on);
    }, []);

    const r = resolve(route.page, route.id, ctx.isFounder, ctx.isOwner);
    /* Command is the page: HQ's first view (40-command.js) */
    const onCmd = r.s === 'hq' && (r.t || 'brief') === 'brief' && !!M.pages.Command;
    const sec = SECTIONS[r.s] || SECTIONS.home;
    const Page = M.pages[sec.page];
    const b = M.badges(ctx);
    const go = k => { setMenuOpen(false); setJumpOpen(false); M.nav('#' + k); };

    /* the mark's mood follows the day: alert at four or more things waiting, calm at none */
    const waiting = ctx.isFounder ? (b.hq || 0) + (b.admin || 0) : (ctx.flags || []).filter(f => f.uid === ctx.uid && f.severity !== 'low').length;
    React.useEffect(() => { if (M.mark) M.mark.mood(waiting); }, [waiting]);
    /* the pill slides to the page, the lens to the tab; the mark nods when the page changes */
    const where = r.s + '/' + (r.t || '');
    const whereWas = React.useRef(where);
    React.useEffect(() => {
      if (M.chrome) { M.chrome.sb.mount(sideRef.current); M.chrome.sb.place(false); M.chrome.tb.place(tabRef.current); }
      if (whereWas.current !== where) {
        /* a new section opens at its top; a tab inside the same section keeps the place */
        if (whereWas.current.split('/')[0] !== r.s) window.scrollTo(0, 0);
        whereWas.current = where; setJumpOpen(false); if (M.mark && M.chrome && M.chrome.phone()) M.mark.nod();
      }
    });
    React.useEffect(() => {
      const f = () => { if (M.chrome) M.chrome.tb.place(tabRef.current, true); };
      window.addEventListener('resize', f);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(f);
      return () => window.removeEventListener('resize', f);
    }, []);

    React.useEffect(() => {
      if (!onCmd) { if (cmdAt.ids.length) setCmdAt({id: '', ids: []}); return undefined; }
      let tk = false;
      const spy = () => {
        tk = false;
        const els = CMD_SECS.map(x => document.getElementById(x[0])).filter(Boolean);
        if (!els.length) return;
        const line = M.chrome && M.chrome.phone() ? 110 : window.innerHeight * 0.32;
        let id = els[0].id;
        els.forEach(e => { if (e.getBoundingClientRect().top - line <= 0) id = e.id; });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = els[els.length - 1].id;
        if (lockSec.current) id = lockSec.current;
        const ids = els.map(e => e.id);
        setCmdAt(was => (was.id === id && was.ids.join() === ids.join() ? was : {id, ids}));
      };
      const on = () => { if (!tk) { tk = true; requestAnimationFrame(spy); } };
      spy(); const t = setTimeout(spy, 500), t2 = setTimeout(spy, 1500);
      window.addEventListener('scroll', on, {passive: true}); window.addEventListener('resize', on);
      return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
    }, [onCmd]);
    const lockSec = React.useRef('');
    /* the jump list glides to a section, the way the design's goTo does */
    const goSec = id => {
      const el = document.getElementById(id); if (!el) return;
      lockSec.current = id; setCmdAt(was => ({id, ids: was.ids}));
      const off = M.chrome && M.chrome.phone() ? 80 : 28, y = el.getBoundingClientRect().top + window.scrollY - off;
      const done = () => { lockSec.current = ''; };
      if (M.chrome) M.chrome.glide(y, done); else { window.scrollTo(0, y); done(); }
    };

    const groups = navGroups(ctx);
    const home = () => { if (M.mark) M.mark.spin(); if (M.chrome) M.chrome.glide(0); else window.scrollTo(0, 0); };
    let j = 0;
    const item = k => {
      const s = SECTIONS[k];
      const on = r.s === k;
      const jj = j++;
      return html`<button key=${k} type="button" data-k=${k} data-t=${s.label} style=${{'--j': jj}} aria-current=${on ? 'page' : null} id=${k === 'map' ? 'side-map' : null}
        class=${'nv side-item' + (on ? ' on active' : '')} onClick=${() => go(k)}>
        <${Ico} k=${SEC_IC[k]}/><span class="nl">${s.label}</span><${Bd} n=${b[k] || 0}/>
      </button>`;
    };

    /* phone tabs: the four places each role opens most, then the round Ask button */
    const tabKeys = ctx.isFounder ? ['hq', 'home', 'work', 'chat'] : ['home', 'work', 'chat', 'vibe'];
    const ti = tabKeys.indexOf(r.s);
    /* the capsule's pill: the open tab of this page with its flame number, the jump list holds the others */
    const tabs = visibleTabs(ctx, r.s, b);
    const tIdx = tabs.length > 1 ? tabs.findIndex(t => t.k === r.t) : -1;
    const cmdSecs = onCmd ? CMD_SECS.filter(x => cmdAt.ids.indexOf(x[0]) >= 0) : [];
    const ci = onCmd && cmdSecs.length ? Math.max(0, cmdSecs.findIndex(x => x[0] === cmdAt.id)) : -1;
    const wl = ci >= 0 ? cmdSecs[ci][1] : tIdx >= 0 ? tabs[tIdx].label : sec.label;
    const meName = (meProf && meProf.name) || (ctx.members && ctx.members[ctx.uid] && ctx.members[ctx.uid].name) || 'You';
    const meSub = [(ctx.member && ctx.member.empId) || '', (ctx.member && ctx.member.title) || ''].filter(Boolean).join(', ');

    return html`<div class=${'app' + (sbx ? ' is-sbx' : '')}>
      <aside class="side sidebar" id="side" ref=${sideRef} aria-label="Main">
        <div class="sbt"><${LiveMark} id="lmS" onGo=${home}/></div>
        <nav class="snav" id="snav" aria-label="Pages">
          <span class="sp sp-h" aria-hidden="true"></span><span class="sp sp-a" aria-hidden="true"></span><span class="here" aria-hidden="true"></span>
          ${groups.map(g => html`<${React.Fragment} key=${g.g}><div class="sgl"><span>${g.g}</span></div>${g.items.map(item)}<//>`)}
        </nav>
        <div class="sfoot">
          ${M.parts.FocusPill ? html`<${M.parts.FocusPill}/>` : null}
          <button class="nv" id="sAsk" type="button" data-t="Ask m360" style=${{'--j': j++}} onClick=${e => openBar(e.currentTarget)}>
            <${Ico} k="mic"/><span class="nl">Ask m360</span><kbd class="kb nl"><${Ico} k="cmdkey"/>K</kbd></button>
          <button class="nv" id="sTog" type="button" data-t=${sbx ? 'Collapse' : 'Expand'} aria-expanded=${sbx ? 'true' : 'false'} style=${{'--j': j++}}
            onClick=${() => { if (M.chrome) M.chrome.sb.toggle(); }}><${Ico} k="panel"/><span class="nl">${sbx ? 'Collapse' : 'Expand'}</span></button>
          <button class="nv side-foot" type="button" data-t=${meName} style=${{'--j': j++}} onClick=${() => go('me')}>
            <${UI.Avatar} id=${ctx.uid} size=${22}/><span class="nl"><span class="nm"><${UI.Name} id=${ctx.uid} fallback="You"/></span>${meSub ? html`<small>${meSub}</small>` : null}</span>
          </button>
        </div>
      </aside>

      <header class="pbar lg topbar" id="pbar">
        <span class="pm"><${LiveMark} id="lmP" onGo=${home}/></span>
        <button class="where" id="where" type="button" aria-haspopup="true" aria-expanded=${jumpOpen || menuOpen ? 'true' : 'false'}
          onClick=${() => { if (ci >= 0) setJumpOpen(x => !x); else setMenuOpen(true); }}>
          ${ci >= 0 ? html`<i class="wi">${two(ci + 1)}</i>` : null}<span class="wl">${wl}</span><${Ico} k="chev"/></button>
        <button class="mbtn" id="menuBtn" type="button" aria-label="Menu" aria-controls="menu" aria-expanded=${menuOpen ? 'true' : 'false'}
          onClick=${() => { setJumpOpen(false); setMenuOpen(true); }}><span class="burger"><i></i><i></i></span></button>
      </header>
      <${Jump} open=${jumpOpen && ci >= 0} tabs=${cmdSecs.map(x => ({k: x[0], label: x[1]}))} at=${ci} onGo=${t => { setJumpOpen(false); goSec(t.k); }}/>

      <main class="main" id="main">
        <div key=${r.s} class=${'content view' + (['work', 'accounts', 'hq'].indexOf(r.s) >= 0 ? ' wide' : '')}>
          <${PreviewBar}/>
          <${AlertBanner}/>
          <${LockBanner}/>
          ${Page ? html`<${Crash} key=${r.s + '/' + (r.t || '') + '/' + (r.id || '')}><${Page} tab=${r.t} id=${r.id}/><//>` : html`<${UI.Card} title="Loading"><${UI.Empty} text="One moment."/><//>`}
        </div>
      </main>

      ${M.parts.Buddy ? html`<${M.parts.Buddy}/>` : null}

      <${Menu} open=${menuOpen} groups=${groups} active=${r.s} badges=${b} onGo=${go} onClose=${() => setMenuOpen(false)}/>

      <nav class="tabbar" id="tabbar" ref=${tabRef} aria-label="Tabs" style=${{'--tn': tabKeys.length, '--ti': Math.max(0, ti)}} data-mark=${ti >= 0 ? '1' : '0'}>
        <div class="tbg lg" id="tb"><span class="lens" aria-hidden="true"></span>
          ${tabKeys.map(k => html`<button key=${k} type="button" aria-current=${r.s === k ? 'page' : null}
            class=${'tab tab-item' + (r.s === k ? ' on active' : '')} onClick=${() => { M.haptic.buzz('tick'); go(k); }}>
            <${Ico} k=${SEC_IC[k]}/><span>${SECTIONS[k].label}</span><${Bd} n=${b[k] || 0} cls="tbd"/>
          </button>`)}
        </div>
        <button class="tb-ask lg" id="tbAsk" type="button" aria-label="Ask m360" onClick=${e => openBar(e.currentTarget)}><${Ico} k="mic"/></button>
      </nav>

      ${askOpen && M.parts.Ask ? html`<${M.parts.Ask} initial=${askInitial} onClose=${() => { setAskOpen(false); setAskInitial(''); }}/>` : null}
      ${palOpen && M.parts.Palette ? (isl && window.ReactDOM && window.ReactDOM.createPortal
        ? window.ReactDOM.createPortal(html`<${M.parts.Palette} island=${true} onClose=${() => setPalOpen(false)} onAsk=${q => askAt(q)}/>`, isl.slot())
        : html`<${M.parts.Palette} onClose=${() => setPalOpen(false)} onAsk=${q => askAt(q)}/>`) : null}
      ${inboxOpen && M.parts.Inbox ? html`<${M.parts.Inbox} onClose=${() => setInboxOpen(false)}/>` : null}
      ${keysOpen ? html`<${Keys} onClose=${() => setKeysOpen(false)}/>` : null}
      ${M.parts.FocusHost ? html`<${M.parts.FocusHost}/>` : null}
      ${M.parts.HolidayWatch ? html`<${M.parts.HolidayWatch}/>` : null}
      ${M.parts.FixHost ? html`<${M.parts.FixHost}/>` : null}
      ${M.parts.BooksWatch ? html`<${M.parts.BooksWatch}/>` : null}
      ${M.parts.CareWatch ? html`<${M.parts.CareWatch}/>` : null}
      ${M.parts.FollowWatch ? html`<${M.parts.FollowWatch}/>` : null}
      ${M.parts.BreatheHost ? html`<${M.parts.BreatheHost}/>` : null}
      ${M.parts.DayRateHost ? html`<${M.parts.DayRateHost}/>` : null}
      ${M.parts.ChatWatch ? html`<${M.parts.ChatWatch}/>` : null}
      ${M.parts.InboxWatch ? html`<${M.parts.InboxWatch}/>` : null}
      ${M.parts.PmWatch ? html`<${M.parts.PmWatch}/>` : null}
      ${M.parts.LiveWatch ? html`<${M.parts.LiveWatch}/>` : null}
      <${NewerBuild}/>
      ${M.parts.MusicDock ? html`<${M.parts.MusicDock}/>` : null}
      ${newTask && M.parts.TaskDrawer ? html`<${M.parts.TaskDrawer} taskId=${null} defaults=${{owner: ctx.uid}} onClose=${() => setNewTask(false)}/>` : null}
      <${M.ToastHost}/>
    </div>`;
  };
  /* the server has a newer build than this tab: one line at the top, with a reload */
  function NewerBuild() {
    const [b, setB] = React.useState(window.M360_NEWER || '');
    React.useEffect(() => { const f = e => setB(e.detail || 'new'); window.addEventListener('m360:newer', f); return () => window.removeEventListener('m360:newer', f); }, []);
    if (!b) return null;
    return html`<div class="newer" id="newer-build" role="status">
      <span>A newer m360 is up (build ${b}). Reload to get it.</span>
      <button type="button" class="btn sm on-dark" onClick=${() => location.reload()}>Reload</button>
      <button type="button" class="iconbtn on-dark" aria-label="Later" onClick=${() => setB('')}><${M.icons.x}/></button>
    </div>`;
  }

  /* shared hero for section pages */
  /* phones: a short hero (no sub line) and one sideways row of stats, so the page starts above the fold.
     v40: the design's header carries no map link; the map opens from the Ask bar and the sidebar's help group */
  M.SectionHero = function SectionHero({color, micro, title, sub, children, right}) {
    const phone = M.usePhone();
    /* v40: size and padding come from the CSS (48px title, flame full stop; 36px on a phone) */
    return html`<header class=${'hero section-hero' + (color === 'ink' ? ' ink' : '')}>
      <div class="row between" style=${{alignItems: 'flex-start'}}>
        <div class="grow">
          ${micro ? html`<${UI.Micro}>${micro}<//>` : null}
          <h1 class="hi">${title}</h1>
          ${sub && !phone ? html`<div class="sub" style=${{marginTop: '10px', maxWidth: '60ch'}}>${sub}</div>` : null}
        </div>
        ${right || null}
      </div>
      ${children ? html`<div style=${{marginTop: '16px'}}>${children}</div>` : null}
    </header>`;
  };
})();
