/* module: map. "What's here": the whole of m360 on one page, in plain words. Every section and every
   tab with one line on what it is for, who it is for, a live number where one is cheap, and an Open
   button; the things that are always around (Ask m360, the buddy, search, the inbox, focus, New); and
   a day-one list for whoever just joined. The same lines ride on the section heroes ("What's in Work"),
   as tooltips on the tab strips and the sidebar, in the palette, and on Home for the first two weeks. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useEffect, useRef, useState} = React;

  const td = () => U.todayStr();
  const size = m => Object.keys(m || {}).length;
  const tasks = ctx => Object.keys(ctx.coll.tasks.map).map(id => ctx.coll.tasks.map[id]).filter(Boolean);
  const week = ctx => { const r = U.periodRange('week', new Date(ctx.now || Date.now())); return {from: r.from, to: r.to}; };

  /* the catalogue: one line per place, in the sidebar's order */
  const MAP = [
    {k: 'home', label: 'Home', icon: 'today', route: 'home', blurb: 'Your day on one page: check in, what is on you today, the EOD line, the week\'s outcomes and what the team posted.',
      tabs: []},
    {k: 'work', label: 'Work', icon: 'tasks', route: 'work', blurb: 'Where the work lives: tasks, projects, the calendar, reviews and the week.', tabs: [
      {k: 'tasks', label: 'My tasks', route: 'tasks', blurb: 'Every task on you, by due date. Drag between to do, doing, review and done; subtasks, comments and links inside.', signal: ctx => { const n = tasks(ctx).filter(t => t.owner === ctx.uid && t.status !== 'done').length; return n ? n + ' open on you' : ''; }},
      {k: 'projects', label: 'Projects', route: 'projects', blurb: 'Campaigns, retainers and internal work, each with sections, tasks, members and progress.', signal: ctx => { const n = Object.values(ctx.coll.projects.map).filter(p => p && !p.archived && p.status !== 'done').length; return n ? n + ' live' : ''; }},
      {k: 'calendar', label: 'Calendar', route: 'calendar', blurb: 'The month: due tasks and projects, leave, holidays and birthdays, all on one grid.'},
      {k: 'reviews', label: 'Reviews', route: 'reviews', blurb: 'Work waiting for a yes from anyone on the project: approve it or send it back with a note.', signal: ctx => { const n = M.reviews ? M.reviews.queue(ctx).filter(t => M.reviews.canReview(ctx, t)).length : 0; return n ? n + ' waiting on you' : ''; }},
      {k: 'week', label: 'The week', route: 'week', blurb: 'Monday\'s three outcomes for everyone and Friday\'s review, side by side.'}]},
    {k: 'accounts', label: 'Accounts', icon: 'clients', route: 'accounts', blurb: 'Clients, the pipeline, every account we touch, and the LinkedIn desk.', tabs: [
      {k: 'clients', label: 'Clients', route: 'clients', blurb: 'One page per client: memory, approvals, never-dos, links, the brain and the news.', signal: ctx => { const n = Object.values(ctx.coll.clients.map).filter(c => c && c.status === 'live').length; return n ? n + ' live' : ''; }},
      {k: 'pipeline', label: 'Pipeline', route: 'pitches', blurb: 'Every pitch by stage with its next step and date; won ones become clients.', signal: ctx => { const n = Object.values(ctx.coll.pitches.map).filter(p => p && p.stage !== 'won' && p.stage !== 'lost').length; return n ? n + ' in play' : ''; }},
      {k: 'crm', label: 'CRM', route: 'crm', blurb: 'Every account in one table: contacts, pitches, tasks, last touch and next step.'},
      {k: 'handshake', label: 'Handshake', route: 'handshake', blurb: 'The LinkedIn DM desk: screenshots in, verified and written messages out, in five beats.', signal: ctx => { const n = M.handshake ? M.handshake.people(ctx).filter(p => p.state === 'ready').length : 0; return n ? n + ' ready to send' : ''; }}]},
    {k: 'vibe', label: 'Vibe', icon: 'feed', route: 'vibe', blurb: 'The team side: the feed, the crew, the pulse, the leaderboard and music.', tabs: [
      {k: 'feed', label: 'Feed', route: 'feed', blurb: 'Updates, wins, questions, polls, kudos and the founder\'s announcements.', signal: ctx => { const w = week(ctx); const n = (M.feed ? M.feed.stream(ctx) : []).filter(it => U.ymd(new Date(it.at)) >= w.from).length; return n ? n + ' this week' : ''; }},
      {k: 'crew', label: 'Crew', route: 'people', blurb: 'Everyone on the team, their profiles, pods and who is in today.', signal: ctx => ctx.activeMembers.length + ' people'},
      {k: 'pulse', label: 'Pulse and ideas', route: 'voice', blurb: 'The anonymous weekly pulse (what is broken, what to change) and the ideas board with votes.'},
      {k: 'scores', label: 'Leaderboard', route: 'scores', blurb: 'Points by week, month, quarter and since joining, with what earned them.'},
      {k: 'music', label: 'Music', route: 'music', blurb: 'Spotify inside m360: search, play, playlists, the dock at the bottom.'}]},
    {k: 'base', label: 'Base', icon: 'database', route: 'base', blurb: 'The contacts database: everyone we know and the companies they work at.', tabs: [
      {k: 'people', label: 'People', route: 'base', blurb: 'Every contact, searchable by name, title, company, city or stage; anyone can edit, every edit is logged.', signal: ctx => { const n = size(ctx.coll.contacts.map); return n ? n + ' contacts' : ''; }},
      {k: 'companies', label: 'Companies', route: 'companies', blurb: 'The companies behind the people, mapped to client pages both ways.'},
      {k: 'import', label: 'Import', route: 'import', blurb: 'The monthly Apollo CSV: mapped, merged, never overwriting a hand edit.'}]},
    {k: 'chat', label: 'Chat', icon: 'send', route: 'chat', blurb: 'Rooms and direct messages with files, mentions and previews. General is always there.', tabs: [],
      signal: ctx => { const n = M.rooms ? M.rooms.unreadRooms(ctx).length : 0; return n ? n + ' unread' : ''; }},
    {k: 'workspace', label: 'Workspace', icon: 'mail', route: 'mail', blurb: 'Google inside m360, once it is connected.', tabs: [
      {k: 'mail', label: 'Mail', route: 'mail', blurb: 'Your Gmail inbox: read, star, archive, reply, write.'},
      {k: 'gcal', label: 'Calendar', route: 'gcal', blurb: 'Google Calendar: the week, RSVP, a new meeting with a Meet link.'},
      {k: 'drive', label: 'Drive', route: 'drive', blurb: 'Find a file in Drive by name and open it.'}]},
    {k: 'web', label: 'Web', icon: 'link', route: 'web', blurb: 'A browser inside m360 with the team\'s bookmarks and a reading mode for sites that refuse frames.', tabs: []},
    {k: 'radar', label: 'Radar', icon: 'radar', route: 'radar', blurb: 'The outside world, India first: who moved, who won what, what launched.', tabs: [
      {k: 'news', label: 'News', route: 'radar', blurb: 'The trade press in lanes: people moves, account moves, launches, campaigns, awards.'},
      {k: 'awards', label: 'Awards', route: 'awards', blurb: 'The award shows and their entry dates.'},
      {k: 'watch', label: 'Watch', route: 'watch', blurb: 'The YouTube channels and sources we follow.'}]},
    {k: 'me', label: 'Me', icon: 'people', route: 'me', blurb: 'Your own corner: profile, notes, trophies, leave, the handbook.', tabs: [
      {k: 'profile', label: 'Profile', route: 'me', blurb: 'Your details and photo, the look, sounds, the buddy, notices and shortcuts.'},
      {k: 'notes', label: 'Notes', route: 'notes', blurb: 'Private notes, yours alone; the first line is the title.'},
      {k: 'trophies', label: 'Trophies', route: 'trophies', blurb: 'Badges you have earned and the ones coming up; birthdays and anniversaries.'},
      {k: 'leave', label: 'Leave', route: 'leave', blurb: 'Ask for leave, see the decision, withdraw while it is pending.', signal: ctx => { const n = ctx.isFounder && M.leave ? M.leave.pending(ctx).length : 0; return n ? n + ' waiting on you' : ''; }},
      {k: 'handbook', label: 'Handbook', route: 'handbook', blurb: 'How we work, section by section; the founder edits, everyone reads.', signal: ctx => { const n = M.handbook ? M.handbook.unread(ctx, ctx.uid).length : 0; return n ? n + ' unread' : ''; }},
      {k: 'hiring', label: 'Hiring', route: 'hiring', member: true, blurb: 'Candidates you were asked to evaluate, with the scorecard.'}]},
    {k: 'hq', label: 'HQ', icon: 'command', route: 'hq', founder: true, blurb: 'The founder\'s desk: the brief, the numbers and hiring.', tabs: [
      {k: 'brief', label: 'Intelligence', route: 'hq', blurb: 'The daily brief: risks, wins, people, money, the actions to take, and Ask HQ.'},
      {k: 'dashboard', label: 'Dashboard', route: 'command', blurb: 'The company in numbers: attendance, output, pipeline, revenue, the ladder.'},
      {k: 'hiring', label: 'Hiring', route: 'hiring', blurb: 'Candidates by stage, the panel, the scorecards and the decision.', signal: ctx => { const n = M.hiring ? M.hiring.candidatesOf(ctx).filter(c => !c.decision).length : 0; return n ? n + ' open' : ''; }}]},
    {k: 'admin', label: 'Admin', icon: 'desk', route: 'admin', founder: true, blurb: 'The team, invites, the keys (AI, mail, voice, Google), holidays, security, backups, the tour.', tabs: []},
    {k: 'books', label: 'Books', icon: 'log', route: 'books', owner: true, blurb: 'The owner\'s accounting and HR desk.', tabs: [
      {k: 'overview', label: 'Overview', route: 'books', blurb: 'Money in, money out, what is due and the compliance calendar.'},
      {k: 'invoices', label: 'Invoices', route: 'invoices', blurb: 'GST invoices with numbering, sending, reminders and payments.', signal: ctx => { const n = M.books ? M.books.invoices(ctx).filter(i => ['sent', 'overdue', 'part'].indexOf(M.books.status(i, td())) >= 0).length : 0; return n ? n + ' open' : ''; }},
      {k: 'expenses', label: 'Expenses', route: 'expenses', blurb: 'An expenses sheet, a bank statement import, categories by AI.'},
      {k: 'payroll', label: 'Payroll', route: 'payroll', blurb: 'Salaries, attendance, loss of pay, payslips.'},
      {k: 'letters', label: 'Letters', route: 'letters', blurb: 'Offer, appointment, increment, experience and relieving letters, fully editable.'},
      {k: 'billing', label: 'Setup', route: 'billing', blurb: 'Company details, defaults, the logo, client billing profiles.'}]}
  ];
  const ALWAYS = [
    {label: 'Ask m360', blurb: 'Ask anything, tell it to do anything: the spark in the sidebar, or the buddy bottom right (hold Ctrl and Option to talk).', act: () => window.dispatchEvent(new CustomEvent('m360:ask')), key: '✦'},
    {label: 'Search anything', blurb: 'People, companies, tasks, projects, clients, posts, the handbook, and every page.', act: () => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', ctrlKey: true, bubbles: true})), key: M.isMac ? '⌘K' : 'Ctrl K'},
    {label: 'Inbox', blurb: 'What needs you: assignments, reviews, mentions, kudos, decisions, announcements.', act: () => window.dispatchEvent(new CustomEvent('m360:inbox')), key: 'i'},
    {label: 'New', blurb: 'A task, project, pitch, client, post, kudos or note from one button.', act: () => M.intend('#tasks', 'newtask'), key: '+'},
    {label: 'Focus timer', blurb: 'A deep work session that counts toward your week.', act: () => M.focus && M.focus.open(), key: 'f'},
    {label: 'Breathe', blurb: 'A minute to reset.', act: () => M.breathe && M.breathe.open(), key: ''},
    {label: 'The tour', blurb: 'The buddy walks you through the place, out loud.', act: () => window.dispatchEvent(new CustomEvent('m360:tour')), key: ''},
    {label: 'Keyboard shortcuts', blurb: 'The whole sheet.', act: () => window.dispatchEvent(new CustomEvent('m360:keys')), key: '?'}
  ];
  const DAY_ONE = [
    ['Check in on Home', 'home', 'Office or WFH, once a day. It counts.'],
    ['Set the week\'s three outcomes', 'week', 'Monday before noon.'],
    ['Post a hello on Vibe', 'feed', 'The team reads it.'],
    ['Read the handbook', 'handbook', 'How we work, in twenty minutes.'],
    ['File the EOD line', 'home', 'Three lines before the cut, every working day.'],
    ['Take the tour', 'tour', 'The buddy shows you around in two minutes.']
  ];

  const allowed = (ctx, s) => !(s.founder && !ctx.isFounder) && !(s.owner && !ctx.isOwner) && !(s.member && ctx.isFounder);
  const visible = ctx => MAP.filter(s => allowed(ctx, s)).map(s => ({...s, tabs: s.tabs.filter(t => allowed(ctx, t))}));
  const blurbOf = (section, tab) => {
    const s = MAP.find(x => x.k === section);
    if (!s) return '';
    if (!tab) return s.blurb;
    const t = s.tabs.find(x => x.k === tab);
    return t ? t.blurb : '';
  };
  const keyFor = title => { const s = MAP.find(x => x.label.toLowerCase() === String(title || '').toLowerCase()); return s ? s.k : ''; };
  const sig = (ctx, x) => { try { return x.signal ? String(x.signal(ctx) || '') : ''; } catch (e) { return ''; } };

  function Section({s, ctx, open}) {
    return html`<${UI.Card} id=${'map-' + s.k} className=${'map-card' + (open ? ' open' : '')} title=${html`<span class="row nowrap" style=${{gap: '8px'}}><${icons[s.icon] || icons.today}/>${s.label}${s.founder || s.owner ? html`<${UI.Pill}>${s.owner ? 'owner' : 'founder'}<//>` : null}</span>`}
      action=${html`<${UI.Btn} sm=${true} kind="sec" onClick=${() => M.nav('#' + s.route)}>Open<//>`}>
      <div class="small" style=${{marginBottom: s.tabs.length ? '10px' : 0}}>${s.blurb}${!s.tabs.length && sig(ctx, s) ? html` <span class="num ink62">· ${sig(ctx, s)}</span>` : null}</div>
      ${s.tabs.length ? html`<div class="map-tabs">${s.tabs.map(t => html`<button key=${t.k} type="button" class="map-tab" onClick=${() => M.nav('#' + t.route)}>
        <span class="row between" style=${{gap: '8px'}}><b>${t.label}</b>${sig(ctx, t) ? html`<span class="tiny num flame-t">${sig(ctx, t)}</span>` : null}</span>
        <span class="tiny ink62">${t.blurb}</span>
      </button>`)}</div>` : null}
    <//>`;
  }

  function MapPage({id}) {
    const ctx = M.useCtx();
    const list = visible(ctx);
    const scrolled = useRef('');
    useEffect(() => {
      if (!id || scrolled.current === id) return;
      const el = document.getElementById('map-' + id);
      if (el) { el.scrollIntoView({block: 'start', behavior: M.reduced() ? 'auto' : 'smooth'}); scrolled.current = id; }
    }, [id, list.length]);
    const joined = ctx.member && ctx.member.joined ? U.daysBetween(ctx.member.joined, td()) : 999;
    return html`<div class="stack" style=${{gap: '18px'}} id="map">
      <${M.SectionHero} micro="the map" title="What's in m360" sub="Every place, in one line each. Tap a name to go there; the numbers are live. The buddy bottom right answers anything this page does not.">
        <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
          ${list.map(s => html`<button key=${s.k} type="button" class="chip" onClick=${() => { const el = document.getElementById('map-' + s.k); if (el) el.scrollIntoView({block: 'start', behavior: M.reduced() ? 'auto' : 'smooth'}); }}>${s.label}</button>`)}
        </div>
      <//>
      ${joined <= 30 ? html`<${UI.Card} id="map-day-one" title="Your first days, in order" flame=${true}>
        <div class="map-tabs">${DAY_ONE.map(([label, route, why]) => html`<button key=${label} type="button" class="map-tab" onClick=${() => route === 'tour' ? window.dispatchEvent(new CustomEvent('m360:tour')) : M.nav('#' + route)}>
          <b>${label}</b><span class="tiny ink62">${why}</span></button>`)}</div>
      <//>` : null}
      <${UI.Card} id="map-always" title="Always around, from anywhere">
        <div class="map-tabs">${ALWAYS.map(a => html`<button key=${a.label} type="button" class="map-tab" onClick=${a.act}>
          <span class="row between" style=${{gap: '8px'}}><b>${a.label}</b>${a.key ? html`<span class="kbd">${a.key}</span>` : null}</span>
          <span class="tiny ink62">${a.blurb}</span></button>`)}</div>
      <//>
      <div class="map-grid">${list.map(s => html`<${Section} key=${s.k} s=${s} ctx=${ctx} open=${id === s.k}/>`)}</div>
      <div class="hint">Something you cannot find here? Ask the buddy: "where do I request leave", "what can you do".</div>
    </div>`;
  }

  /* on Home for the first two weeks, or until closed: the way in */
  function FindYourWay() {
    const ctx = M.useCtx();
    const [gone, setGone] = useState(() => M.prefs.get('mapSeen', '') === '1');
    const joined = ctx.member && ctx.member.joined ? U.daysBetween(ctx.member.joined, td()) : 999;
    if (gone || joined > 14) return null;
    return html`<${UI.Card} id="find-your-way" title="New here? Here is what is where" flame=${true}
      action=${html`<button type="button" class="iconbtn" aria-label="Close" onClick=${() => { M.prefs.set('mapSeen', '1'); setGone(true); }}><${icons.x}/></button>`}>
      <div class="small" style=${{marginBottom: '10px'}}>m360 has a page for everything: work, clients, the team, the outside world, and you. One page lists all of it in plain words, and the buddy bottom right answers any question about the place.</div>
      <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
        <${UI.Btn} sm=${true} onClick=${() => M.nav('#map')}>See what's here<//>
        <${UI.Btn} sm=${true} kind="sec" onClick=${() => window.dispatchEvent(new CustomEvent('m360:tour'))}>Show me around<//>
        <${UI.Btn} sm=${true} kind="sec" onClick=${() => window.dispatchEvent(new CustomEvent('m360:ask'))}>Ask the buddy<//>
      </div>
    <//>`;
  }

  M.map = {MAP, ALWAYS, DAY_ONE, visible, blurbOf, keyFor};
  M.pages.Map = MapPage;
  M.parts.FindYourWay = FindYourWay;
})();
