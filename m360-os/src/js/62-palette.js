/* module: palette. Cmd K is the master search: one box that finds anything (people in the Base and
   on the team, companies, tasks, projects, clients, pitches, posts, handbook, your inbox and leave,
   saved links, the founder's log) and runs anything (check in, new task, focus, breathe, theme), or
   hands the question to m360 AI. Results sit under micro headings, ranked: exact prefix first, then
   word matches, then anything containing the words. Arrow keys move, Enter runs, Escape closes,
   "Show all" opens the Search drawer with every match and filters. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const SPARK = '✦';
  const PAGES = [
    ['Home', 'home', 'today'], ['My tasks', 'tasks', 'tasks'], ['Projects', 'projects', 'projects'], ['The week', 'week', 'week'],
    ['Calendar', 'calendar', 'calendar'], ['Reviews', 'reviews', 'review'], ['Clients', 'clients', 'clients'], ['Pipeline', 'pitches', 'pitches'], ['Prospects', 'prospects', 'people'],
    ['Feed', 'feed', 'feed'], ['Crew', 'people', 'people'], ['Pulse and ideas', 'voice', 'voice'], ['Leaderboard', 'scores', 'scores'],
    ['Base', 'base', 'database'], ['Companies', 'companies', 'database'], ['Radar', 'radar', 'radar'],
    ['Me', 'me', 'people'], ['Leave', 'leave', 'leave'], ['Handbook', 'handbook', 'handbook'], ['Trophies', 'trophies', 'trophy'],
    ['HQ', 'hq', 'command', true], ['Dashboard', 'command', 'command', true], ['Hiring', 'hiring', 'hiring', true], ['Admin', 'admin', 'desk', true],
    ['The office', 'office', 'desk'], ['The m360 COO', 'coo', 'command'],
    ['What\'s in m360', 'map', 'map'], ['Break', 'break', 'breath'], ['Five, the word of the day', 'play', 'breath'], ['Reset', 'reset', 'breath'], ['Care reminders', 'care', 'bell'], ['Reflect', 'reflect', 'review'],
    /* v39: every page in the sidebar has a Go to row; the fifth field marks the owner's own pages */
    ['Chat', 'chat', 'send'], ['Accounts', 'talks', 'clients'], ['Notes', 'notes', 'edit'], ['Music', 'music', 'play'],
    ['Mail', 'mail', 'mail'], ['Meetings', 'gcal', 'cal'], ['Drive', 'drive', 'drive'], ['Web', 'web', 'link'],
    ['Books', 'books', 'log', true, 'owner'], ['Invoices', 'invoices', 'log', true, 'owner'], ['Expenses', 'expenses', 'log', true, 'owner'],
    ['Payroll', 'payroll', 'log', true, 'owner'], ['Bank statement', 'statement', 'log', true, 'owner'], ['Letters', 'letters', 'log', true, 'owner']
  ];
  const canGo = (ctx, p) => (!p[3] || ctx.isFounder) && (p[4] !== 'owner' || ctx.isOwner);
  /* the order headings appear in: a prospect line typed into the box logs first, with no model call.
     v39: actions come next, so "check in" then Enter checks in; talks sits by people */
  const ORDER = ['answer', 'try', 'log it', 'actions', 'people', 'talks', 'prospects', 'companies', 'tasks', 'projects', 'clients', 'pitches', 'posts', 'handbook', 'inbox', 'leave', 'radar', 'log', 'go to', 'more', 'ask'];
  /* a heading reads the search module's label, lowercase like every micro label */
  /* a group the list does not know sits with the other results, never above them */
  const placeOf = g => { const i = ORDER.indexOf(g); return i < 0 ? ORDER.indexOf('log') : i; };
  const headOf = g => String((M.search && M.search.GROUP_LABEL && M.search.GROUP_LABEL[g]) || g).toLowerCase();

  const norm = s => String(s || '').toLowerCase();
  /* every word of the query has to appear somewhere in the text */
  const matches = (q, text) => { const t = norm(text); return q.every(w => t.includes(w)); };

  /* one registry command, run through the agent with its rights and its ledger */
  function runCommand(ctx, c) {
    const live = M.lastCtx && M.lastCtx.uid === ctx.uid ? M.lastCtx : ctx;
    M.agent.exec(live, null, c.name, c.input, {turn: {id: U.uid(), via: 'typed', said: c.label}})
      .then(r => M.toast((r && (r.say || r.note)) || 'Done'), e => M.toast(String((e && e.message) || 'That did not go through').replace(/^./, x => x.toUpperCase()), true));
  }

  /* actions and pages: the palette's own rows; entities come from the search index */
  /* v40: the sidebar's New menu, the inbox and m360 AI live here as rows; with nothing typed these lead */
  const EMPTY_ACTS = ['a-checkin', 'a-inbox', 'a-ai', 'a-newtask', 'a-followup', 'a-post', 'a-kudos', 'a-leave', 'a-project', 'a-pitch'];
  function buildItems(ctx, query, closeThen, ask) {
    const q = norm(query).split(/\s+/).filter(Boolean);
    const out = [];
    const go = (fn, group, label, icon, sub, key) => out.push({key, group, label, icon, sub, run: () => closeThen(fn)});
    const td = U.todayStr();

    /* actions */
    const a = M.att.dayStatus(ctx, ctx.uid, td);
    const checked = a.status === 'office' || a.status === 'wfh';
    const unread = M.inbox && M.inbox.unread ? M.inbox.unread(ctx) : 0;
    const acts = [
      [checked && !a.out ? 'Check out' : 'Check in', 'today', () => M.intend('#home', 'checkin'), 'a-checkin'],
      ['Inbox', 'bell', () => window.dispatchEvent(new CustomEvent('m360:inbox')), 'a-inbox', unread ? unread + ' new' : 'all caught up'],
      ask ? ['m360 AI', 'mic', () => ask(''), 'a-ai', 'ask anything, or hand out work'] : null,
      ['New task', 'tasks', () => window.dispatchEvent(new CustomEvent('m360:newtask')), 'a-newtask', 'for you or anyone'],
      ['New follow-up', 'bell', () => M.intend('#prospects', 'capture'), 'a-followup', 'someone you are talking to'],
      ['Post an update', 'feed', () => M.intend('#feed', 'post'), 'a-post', 'an update or a win, on the feed'],
      ['Give kudos', 'scores', () => M.intend('#feed', 'kudos'), 'a-kudos', 'thank someone'],
      ['Request leave', 'leave', () => M.nav('#leave'), 'a-leave', 'days off'],
      ['New project', 'projects', () => M.intend('#projects', 'project'), 'a-project', 'with a template'],
      ctx.isFounder ? ['New pitch', 'pitches', () => M.intend('#pitches', 'pitch'), 'a-pitch', 'into the pipeline'] : null,
      ['Start a focus session', 'timer', () => M.focus && M.focus.open(), 'a-focus'],
      ['Slow breathing, five minutes', 'breath', () => M.breathe && M.breathe.open('slow'), 'a-breathe'],
      ['Show me around', 'send', () => window.dispatchEvent(new CustomEvent('m360:tour')), 'a-tour'],
      ['Keyboard shortcuts', 'cmd', () => window.dispatchEvent(new CustomEvent('m360:keys')), 'a-keys'],
      [M.theme.resolved() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', M.theme.resolved() === 'dark' ? 'sun' : 'moon', () => M.theme.set(M.theme.resolved() === 'dark' ? 'light' : 'dark'), 'a-theme'],
      M.moneyLock.active() ? (M.moneyLock.hidden() ? ['Show money', 'lock', () => M.moneyLock.unlock(), 'a-money', 'with your fingerprint'] : ['Hide money now', 'lock', () => M.moneyLock.hide(), 'a-money', 'masks every amount']) : null,
      [M.sound.on() ? 'Turn sounds off' : 'Turn sounds on', 'play', () => M.sound.set(!M.sound.on()), 'a-sound'],
      [M.haptic.on() ? 'Turn phone nudges off' : 'Turn phone nudges on', 'play', () => M.haptic.set(!M.haptic.on()), 'a-haptic']
    ].filter(Boolean);
    if (window.M360_STANDALONE) acts.push(['Sign out', 'out', () => window.M360_API('logout').then(() => location.reload(), () => location.reload()), 'a-signout']);
    /* the agent's registry: what it can run straight away, with nothing to fill in */
    if (M.agent && M.agent.commandsFor) M.agent.commandsFor(ctx).forEach((c, i) => acts.push([c.label, 'send', () => runCommand(ctx, c), 'c' + i]));
    const shown = !q.length ? EMPTY_ACTS.map(k => acts.find(x => x[3] === k)).filter(Boolean) : acts.filter(x => matches(q, x[0]));
    shown.forEach(([label, icon, fn, key, sub]) => go(fn, 'actions', label, icon, sub || '', key));
    /* "Spoke to Meera at Swisse, talk after the 16th": the line logs in the viewer's own Prospects, with no model call */
    if (q.length && M.prospects && M.prospects.read && M.prospects.isCapture && M.agent && M.agent.capture && !ctx.viewAs) {
      let r = null;
      try { r = M.prospects.read(query, ctx); } catch (e) { r = null; }
      if (r && M.prospects.isCapture(r)) go(() => {
        const live = M.lastCtx && M.lastCtx.uid === ctx.uid ? M.lastCtx : ctx;
        M.agent.capture(live, query, {}).then(x => M.toast((x && (x.say || x.text)) || 'Logged', !!(x && x.error)));
      }, 'log it', 'Log it: ' + query.trim(), 'bell', 'private to you', 'logit');
    }

    if (!q.length) {
      PAGES.filter(p => canGo(ctx, p)).slice(0, 6).forEach(p => go(() => M.nav('#' + p[1]), 'go to', p[0], p[2], '', 'p' + p[1]));
      return out;
    }
    PAGES.filter(p => canGo(ctx, p) && matches(q, p[0])).forEach(p => go(() => M.nav('#' + p[1]), 'go to', p[0], p[2], '', 'p' + p[1]));
    return out;
  }

  /* the palette's own index while the search module is absent (isolated builds) */
  function localHits(ctx, query, names) {
    const q = norm(query).split(/\s+/).filter(Boolean);
    if (!q.length) return [];
    const out = [];
    const tmap = ctx.coll.tasks.map;
    Object.keys(tmap).map(id => ({id, ...tmap[id]})).filter(t => matches(q, t.title))
      .sort((x, y) => ((y.owner === ctx.uid) - (x.owner === ctx.uid)) || ((x.status === 'done') - (y.status === 'done'))).slice(0, 6)
      .forEach(t => out.push({key: 't' + t.id, group: 'tasks', label: t.title, icon: 'tasks', hash: '#tasks/' + t.id,
        sub: t.status === 'done' ? 'done' : t.due ? 'due ' + M.tasks.dueLabel(t.due) : (t.status || 'to do')}));
    const pmap = ctx.coll.projects.map;
    Object.keys(pmap).filter(id => !pmap[id].archived && matches(q, pmap[id].name)).slice(0, 4)
      .forEach(id => out.push({key: 'pj' + id, group: 'projects', label: pmap[id].name, icon: 'projects', hash: '#projects/' + id, sub: pmap[id].status === 'done' ? 'done' : ''}));
    const cmap = ctx.coll.clients.map;
    Object.keys(cmap).filter(id => matches(q, cmap[id].name)).slice(0, 4)
      .forEach(id => out.push({key: 'c' + id, group: 'clients', label: cmap[id].name, icon: 'clients', hash: '#clients/' + id, sub: cmap[id].status || ''}));
    const hb = ctx.coll.handbook.map;
    Object.keys(hb).filter(id => matches(q, hb[id].title + ' ' + String(hb[id].body || '').slice(0, 400))).slice(0, 3)
      .forEach(id => out.push({key: 'h' + id, group: 'handbook', label: hb[id].title, icon: 'handbook', hash: '#handbook/' + id, sub: ''}));
    ctx.activeMembers.filter(m => matches(q, (names[m.uid] && names[m.uid].name) || '')).slice(0, 4)
      .forEach(m => out.push({key: 'u' + m.uid, group: 'people', label: (names[m.uid] && names[m.uid].name) || 'Someone', icon: 'people', sub: m.title || '', uid: m.uid, hash: '#people/' + m.uid}));
    return out;
  }


  /* ---------- answers: the Ask bar reads the OS and answers in one line (v40) ----------
     Each intent reads this app's own helpers. The answer is the large first row with a flame icon; Enter
     takes you there, glides, rings the thing in flame and the mark looks at it. Teammates' lateness,
     places and money stay the founder's: a member asking gets their own line. */
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const listNames = arr => { const a = arr.filter(Boolean); if (a.length <= 2) return a.join(' and '); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  const showAt = (hash, sel) => () => { if (M.chrome && M.chrome.showAt) M.chrome.showAt(hash, sel); else M.nav(hash); };
  let lastNames = {};
  const working = ctx => (ctx.activeMembers || []).filter(m => m && m.uid && (typeof ctx.isWorkingDay !== 'function' || ctx.isWorkingDay(m.uid, U.todayStr())));
  const INTENTS = [
    {re: /\blate\b|on time/, a(ctx, nm) {
      const td = U.todayStr();
      if (!ctx.isFounder) {
        const a = M.att.dayStatus(ctx, ctx.uid, td);
        if (!a.in) return {ic: 'today', t: 'You have not checked in yet today.', s: 'Check in', run: showAt('#home', '#checkin-card, #home-hero')};
        return {ic: 'today', t: 'You checked in at ' + U.hhmm(a.in) + (M.att.isLate(ctx, ctx.uid, a.in) ? ', after the start.' : ', on time.'), s: 'Today', run: showAt('#home', '#checkin-card, #home-hero')};
      }
      const ins = working(ctx).map(m => [m.uid, M.att.dayStatus(ctx, m.uid, td)]).filter(x => x[1].in);
      const late = ins.filter(x => M.att.isLate(ctx, x[0], x[1].in));
      return {ic: 'today', t: late.length ? late.map(x => nm(x[0]) + ', in at ' + U.hhmm(x[1].in)).join('. ') + '.' : 'Nobody was late today.',
        s: late.length + ' late, ' + ins.length + ' in so far', run: showAt('#command', '#c-att .c-tr.rw, .att-row, #attendance')};
    }},
    {re: /not in|absent|missing|who.?s (in|out|here)|who is (in|out|here)|attendance|who checked/, a(ctx, nm) {
      const td = U.todayStr();
      if (!ctx.isFounder) {
        const a = M.att.dayStatus(ctx, ctx.uid, td);
        return {ic: 'today', t: a.in ? 'You are in, since ' + U.hhmm(a.in) + '.' : 'You are not checked in yet.', s: 'Today', run: showAt('#home', '#checkin-card, #home-hero')};
      }
      const wk = working(ctx);
      const out = wk.filter(m => !M.att.dayStatus(ctx, m.uid, td).in);
      return {ic: 'today', t: out.length ? listNames(out.map(m => nm(m.uid))) + (out.length === 1 ? ' is' : ' are') + ' not in yet.' : (wk.length ? 'Everyone is in.' : 'Nobody is working today.'),
        s: (wk.length - out.length) + ' of ' + wk.length + ' in today', run: showAt('#command', '#c-att .c-tr.rw, .att-row, #attendance')};
    }},
    {re: /\bneeds? me\b|waiting|approv|pending|what needs/, f: 1, a(ctx) {
      const b = M.badges(ctx); const n = (b.admin || 0) + (b.hq || 0) + (b.reviews || 0);
      return {ic: 'command', t: n ? plural(n, 'thing needs you.', 'things need you.') : 'Nothing needs you right now.',
        s: [b.admin ? b.admin + ' in Admin' : '', b.hq ? b.hq + ' high flags' : '', b.reviews ? b.reviews + ' to review' : ''].filter(Boolean).join(', ') || 'Approvals, reviews and high flags',
        run: showAt(b.admin ? '#admin' : b.reviews ? '#reviews' : '#command', '#c-need .c-nc, #c-need .c-clear, .main .card')};
    }},
    {re: /pipeline|\bdeals?\b|proposal|negotiat|sales|weighted/, f: 1, a(ctx) {
      const m = M.pitches.metrics(ctx);
      const open = Object.keys(m.byStage).filter(k => k !== 'won' && k !== 'lost');
      const n = open.reduce((x, k) => x + m.byStage[k].count, 0);
      const top = open.slice().sort((a, b) => m.byStage[b].value - m.byStage[a].value)[0];
      const st = (M.pitches.STAGES.find(x => x.v === top) || {}).label || '';
      return {ic: 'pitches', t: n ? U.inrV(m.weighted) + ' weighted, across ' + plural(n, 'open pitch', 'open pitches') + '.' : 'No open pitches yet.',
        s: n && st ? 'Most of it in ' + st.toLowerCase() : 'Pipeline', run: showAt('#pitches', '.main .card')};
    }},
    {re: /client|revenue|biggest|largest|account/, f: 1, a(ctx) {
      const rows = M.clients.shares(ctx).filter(r => r.monthly > 0).sort((a, b) => b.monthly - a.monthly);
      if (!rows.length) return {ic: 'clients', t: 'No client revenue set yet.', s: 'Set a monthly figure on each client', run: () => M.nav('#clients')};
      const r = rows[0];
      return {ic: 'clients', t: (r.name || 'Client') + ', ' + U.inrV(r.monthly) + ' a month.', s: r.share + '% of revenue' + (r.share > 25 ? ', above the 25% line' : ''), run: () => M.nav('#clients/' + r.id)};
    }},
    {re: /leader|scores?\b|points?\b|\btop\b|best|winning|podium/, a(ctx, nm) {
      const rows = M.points.leaderboard(ctx, 'week');
      if (!rows.length) return {ic: 'scores', t: 'Nobody on the board yet.', s: 'This week', run: () => M.nav('#scores')};
      return {ic: 'scores', t: nm(rows[0].uid) + ' leads with ' + plural(rows[0].total, 'point') + '.', s: rows[1] ? nm(rows[1].uid) + ' second on ' + rows[1].total : 'This week', run: showAt('#scores', '.main .card')};
    }},
    {re: /\bflags?\b|\brules?\b/, a(ctx, nm) {
      const all = ctx.flags || [];
      if (ctx.isFounder) {
        const h = all.filter(x => x.severity === 'high'); const who = [];
        h.forEach(x => { const n = nm(x.uid); if (who.indexOf(n) < 0) who.push(n); });
        return {ic: 'handbook', t: all.length ? plural(all.length, 'flag') + ', ' + h.length + ' high.' : 'No flags. All clear.', s: who.length ? listNames(who.slice(0, 3)) + ' need a look' : 'The rules are quiet', run: showAt('#hq', '#flags, .main .card')};
      }
      const mine = all.filter(x => x.uid === ctx.uid);
      return {ic: 'handbook', t: mine.length ? 'You have ' + plural(mine.length, 'open flag') + '.' : 'Your rule box is clear.', s: mine[0] ? String(mine[0].text || '').slice(0, 60) : 'All clear', run: showAt('#home', '#rules-card, #my-flags, .main .card')};
    }},
    {re: /energy|\bmood\b|\bpulse\b|morale/, f: 1, a(ctx) {
      const wk = M.voice.energyByWeek(ctx, 2).filter(w => w.avg != null).pop();
      return {ic: 'voice', t: wk ? 'Team energy ' + wk.avg.toFixed(1) + ' of 5 in week ' + String(wk.week).split('-W')[1] + '.' : 'No pulse yet.', s: wk ? plural(wk.n, 'reply', 'replies') + ', anonymous' : 'Pulses are anonymous', run: showAt('#voice', '.main .card')};
    }},
    {re: /hir|candidate|interview|panel|evaluat/, a(ctx) {
      const map = ctx.coll.candidates.map; const ids = Object.keys(map).filter(k => map[k] && !map[k].decision);
      if (ctx.isFounder) {
        if (!ids.length) return {ic: 'hiring', t: 'Nobody in the panel.', s: 'Hiring', run: () => M.nav('#hiring')};
        return {ic: 'hiring', t: plural(ids.length, 'candidate') + ' in the panel.', s: 'Hiring', run: showAt('#hiring', '.main .card')};
      }
      const mine = ids.filter(k => (map[k].evaluators || []).includes(ctx.uid));
      const due = M.badges(ctx).hiring || 0;
      return {ic: 'hiring', t: due ? 'You have ' + plural(due, 'evaluation') + ' to write.' : mine.length ? 'Your panel reads are in.' : 'No evaluations assigned to you.', s: 'Hiring panel', run: () => M.nav(mine.length ? '#hiring' : '#me')};
    }},
    {re: /projects?\b|off track|at risk|delivery/, a(ctx) {
      const map = ctx.coll.projects.map; const ks = Object.keys(map).filter(k => map[k] && !map[k].archived && map[k].status !== 'done');
      const ph = {on: 0, risk: 0, off: 0}; ks.forEach(k => { const st = map[k].status || 'on'; ph[st] = (ph[st] || 0) + 1; });
      const worst = ks.filter(k => map[k].status === 'off')[0] || ks.filter(k => map[k].status === 'risk')[0];
      return {ic: 'projects', t: ks.length ? ph.on + ' on track, ' + ph.risk + ' at risk, ' + ph.off + ' off track.' : 'No live projects.',
        s: worst ? (map[worst].name || 'A project') + ' is ' + (map[worst].status === 'off' ? 'off track' : 'at risk') : 'Projects', run: () => M.nav(worst ? '#projects/' + worst : '#projects')};
    }},
    {re: /overdue|my tasks|\btasks?\b|\bdue\b/, a(ctx, nm) {
      const td = U.todayStr(); const map = ctx.coll.tasks.map;
      const all = Object.keys(map).map(id => map[id]).filter(t => t && t.status !== 'done' && !t.deleted && !t.binned);
      if (ctx.isFounder) {
        const od = all.filter(t => M.tasks.isOverdue(t, td)); const who = [];
        od.forEach(t => { const n = nm(t.owner); if (who.indexOf(n) < 0) who.push(n); });
        return {ic: 'tasks', t: od.length ? plural(od.length, 'task') + ' overdue across the team.' : 'Nothing overdue.', s: who.length ? listNames(who.slice(0, 3)) : 'The board is clean', run: showAt('#tasks', '.tcard, .main .card')};
      }
      const mine = all.filter(t => t.owner === ctx.uid); const o = mine.filter(t => M.tasks.isOverdue(t, td)).length;
      return {ic: 'tasks', t: 'You have ' + plural(mine.length, 'open task') + (o ? ', ' + o + ' overdue' : '') + '.', s: 'My tasks', run: showAt('#tasks', '.tcard, .main .card')};
    }},
    {re: /\bleave\b|holiday|day off|time off|vacation/, a(ctx) {
      if (ctx.isFounder) {
        const n = M.leave.pending(ctx).length;
        return {ic: 'leave', t: n ? plural(n, 'leave request') + ' waiting for you.' : 'No leave waiting.', s: 'Leave', run: () => M.nav(n ? '#admin' : '#leave')};
      }
      const reqs = (((ctx.coll.leave.map[ctx.uid] || {}).reqs) || []).filter(x => x && x.id).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      const dec = ((ctx.coll.leavedec.map[ctx.uid] || {}).d) || {};
      const r = reqs[0];
      return {ic: 'leave', t: r ? 'Your last request, ' + M.leave.rangeText(r) + ', is ' + ((dec[r.id] || {}).status || 'pending') + '.' : 'No leave requests yet.', s: 'Leave', run: () => M.nav('#leave')};
    }},
    {re: /\beod\b|end of day|shipped|blocked/, a(ctx) {
      const ed = (((ctx.coll.eod.map[ctx.uid] || {}).days) || {})[U.todayStr()];
      const cut = (ctx.settings && ctx.settings.eodCut) || '19:30';
      return {ic: 'today', t: ed ? 'Your EOD line is in, posted ' + U.hhmm(ed.at || ed.updated || Date.now()) + '.' : 'No EOD line yet today. Cutoff is ' + cut + '.', s: 'End of day', run: showAt('#home', '#fold-eod, #home-eod, #eod-card')};
    }},
    {re: /did i check|when did i check|my check ?in|checked in\?/, a(ctx) {
      const a = M.att.dayStatus(ctx, ctx.uid, U.todayStr());
      return {ic: 'today', t: a.in ? 'You checked in at ' + U.hhmm(a.in) + ', ' + (a.status === 'wfh' ? 'WFH' : 'office') + '.' : 'You have not checked in yet.', s: 'Check in', run: showAt('#home', '#checkin-card, #home-hero')};
    }}
  ];
  /* the first intent that matches, answered against the OS; null when none does */
  function answer(ctx, query, names) {
    const ql = String(query || '').toLowerCase().replace(/[‘’]/g, "'").trim();
    if (!ql || !ctx) return null;
    /* an instruction ("add a task to cut the teaser") goes to m360 AI; the answers are for questions */
    if (/^(add|create|make|new|give|send|post|log|assign|remind|tell|schedule|book|set|move|mark|approve|decline|draft|write|start|open|put|hand|invite)\b/.test(ql) || ql.split(/\s+/).length > 8) return null;
    const nmap = names || lastNames;
    const nm = id => (nmap[id] && nmap[id].name) || (ctx.members && ctx.members[id] && ctx.members[id].name) || 'Someone';
    for (const x of INTENTS) {
      if (x.f && !ctx.isFounder) continue;
      if (!x.re.test(ql)) continue;
      try { const a = x.a(ctx, nm); if (a) return a; } catch (e) { /* a helper missing in this build: no answer */ }
    }
    return null;
  }
  /* suggested asks while the bar is empty */
  const SUGG_F = [['today', 'Who is late today?'], ['command', 'What needs me?'], ['pitches', 'Pipeline this month'], ['clients', 'Biggest client']];
  const SUGG_M = [['today', 'Did I check in?'], ['tasks', 'My tasks'], ['scores', 'Who leads this week?'], ['leave', 'My leave']];

  function Palette({onClose, onAsk, island}) {
    const ctx = M.useCtx();
    const phone = M.usePhone();
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(0);
    const [showAll, setShowAll] = useState(null); /* {q, group} while the Search drawer is open */
    const inp = useRef(null);
    const names = M.useProfiles(ctx.activeMembers.map(m => m.uid));
    const log = M.search ? M.search.useLog(ctx, q) : null;
    const remoteHits = M.search && M.search.useBaseHits ? M.search.useBaseHits(q) : null;
    const closeThen = fn => { onClose(); setTimeout(fn, 20); };
    /* m360 AI: the buddy's pop-up when it is here, the Ask drawer when AI is on */
    const askAI = M.assistant && M.assistant.open ? x => M.assistant.open(x) : (M.ai.on(ctx) ? x => onAsk(x) : null);

    const items = useMemo(() => {
      const own = buildItems(ctx, q, closeThen, askAI);
      const query = q.trim();
      const base = query ? (M.search ? M.search.hits(ctx, query, {names, log}) : localHits(ctx, query, names)) : [];
      const found = base.concat(query && remoteHits ? remoteHits : []);
      const list = own.concat(found.map(h => ({...h, run: h.more ? () => setShowAll({q: query, group: h.more}) : () => closeThen(() => M.nav(h.hash))})));
      /* v39: the count includes what each group held back, so Show all says how many it really has */
      const held = Object.keys(base.overflow || {}).reduce((n, g) => n + (base.overflow[g] || 0), 0);
      const real = found.filter(h => !h.more).length + held;
      if (real > 0 && M.parts.SearchAll) list.push({key: 'more', group: 'more', label: 'Show all ' + real + (real === 1 ? ' result' : ' results'), icon: 'search', more: 'all',
        run: () => setShowAll({q: query, group: 'all'})});
      list.sort((a, b) => placeOf(a.group) - placeOf(b.group));
      /* Ask m360 opens the buddy's pop-up with the words in it; without AI the agent's grammar still runs there */
      const asker = M.assistant && M.assistant.open ? () => M.assistant.open(query) : (M.ai.on(ctx) ? () => onAsk(query) : null);
      if (query && asker) list.push({key: 'ai', group: 'ask', label: 'Ask m360: ' + query, icon: null, ai: true, run: () => closeThen(asker)});
      /* v40: an answer from the OS leads, unless an action is what was typed ("check in" still checks in) */
      const ans = query ? answer(ctx, query, names) : null;
      if (ans) {
        const row = {key: 'ans', group: 'answer', label: ans.t, sub: ans.s, icon: ans.ic, ans: true, run: () => closeThen(ans.run)};
        const ql = query.toLowerCase();
        const exact = list.some(it => it.group === 'actions' && it.label.toLowerCase().indexOf(ql) === 0);
        if (exact) { const at = list.findIndex(it => it.group !== 'actions' && it.group !== 'log it'); list.splice(at < 0 ? list.length : at, 0, row); }
        else list.unshift(row);
      }
      /* empty, in the bar: the design's suggested asks and people, then what the New menu, the inbox and m360 AI did */
      if (!query && island) {
        const sugg = (ctx.isFounder ? SUGG_F : SUGG_M).map((x, i) => ({key: 'q' + i, group: 'try', label: x[1], icon: x[0], ask: x[1], run: () => setQ(x[1])}));
        const ppl = ctx.activeMembers.filter(m => m.uid !== ctx.uid).slice(0, 2).map(m => ({key: 'pp' + m.uid, group: 'people', label: (names[m.uid] && names[m.uid].name) || 'Someone', sub: m.title || '', uid: m.uid, run: () => closeThen(() => M.nav('#people/' + m.uid))}));
        return sugg.concat(ppl).concat(list.filter(it => it.group === 'actions'));
      }
      return list;
    }, [q, ctx, names, log, remoteHits]);
    lastNames = names;

    useEffect(() => { setSel(0); }, [q]);
    useEffect(() => { if (inp.current) inp.current.focus(); }, []);

    const onKey = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) items[sel].run(); }
      else if (e.key === 'Escape') onClose();
    };

    /* the island grows to fit what the list holds */
    useEffect(() => { if (!island || !M.island) return undefined; const t = requestAnimationFrame(() => M.island.fit()); const t2 = setTimeout(() => M.island.fit(), 280); return () => { cancelAnimationFrame(t); clearTimeout(t2); }; }, [items, island]);
    /* Show all leaves the bar for the Search drawer; the island steps back without closing the palette */
    useEffect(() => { if (island && showAll && M.island) M.island.close(true); }, [showAll, island]);
    /* arrows keep the chosen row in view */
    useEffect(() => {
      if (!island) return;
      const l = document.getElementById('pal-list');
      if (!sel) { if (l) l.scrollTop = 0; return; }
      const el = l && l.querySelector('.cbo.hi'); if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest'});
    }, [sel, island]);

    if (showAll && M.parts.SearchAll) return html`<${M.parts.SearchAll} q0=${showAll.q} group0=${showAll.group} onClose=${onClose}/>`;

    /* v40: inside the island, the Ask bar, markup and classes as design/m360-os-v7.html draws it (.cb, .cbr, .cbl,
       .cbh, .cbo). The mic sits in the bar when this browser can hear, the search glyph when it cannot. The rows
       keep the palette's hooks (pal-item, pal-group, .t, data-group) for the tests and the tour */
    if (island) {
      let lastG = '';
      const mic = M.mic && M.mic.can && M.mic.can() && M.island && M.island.listen;
      const Ic = n => { const C = M.chrome && M.chrome.iconFor ? M.chrome.iconFor(n) : icons[n]; return C ? html`<${C}/>` : null; };
      const rowOf = (it, i) => {
        const head = it.group !== lastG && it.group !== 'more' && it.group !== 'answer' ? html`<div class="cbh pal-group" key=${'g' + it.group + i}>${headOf(it.group)}</div>` : null;
        lastG = it.group;
        const right = it.ans ? 'show' : (it.ask || it.ai) ? 'ask' : it.more ? '' : it.group === 'go to' ? 'go' : it.group === 'actions' || it.group === 'log it' ? 'run' : 'open';
        const ini = it.uid && UI.initials ? UI.initials(it.label) : '';
        return html`<${React.Fragment} key=${it.key}>
          ${head}
          <button type="button" role="option" aria-selected=${i === sel ? 'true' : 'false'} data-k=${it.key}
            class=${'cbo pal-item' + (i === sel ? ' hi on' : '') + (it.ai ? ' ai' : '') + (it.more ? ' more' : '') + (it.ans ? ' ans' : '')} data-group=${it.group} onMouseMove=${() => { if (i !== sel) setSel(i); }} onClick=${it.run}>
            <span class="ic">${it.uid ? html`<span class="av2">${ini}</span>` : it.ai ? Ic('mic') : it.icon ? Ic(it.icon) : null}</span>
            <span class="tx"><b class="t">${it.label}</b>${it.sub ? html`<em class="sub">${it.sub}</em>` : null}</span>
            <span class="rt">${right}</span>
          </button>
        <//>`;
      };
      const MIC = M.chrome && M.chrome.icons ? M.chrome.icons.mic : icons.voice;
      const SRCH = M.chrome && M.chrome.icons ? M.chrome.icons.search : icons.search;
      return html`<div class="cb" role="dialog" aria-label="Ask m360">
        <div class="cbr">
          ${mic ? html`<button class="cbm" type="button" aria-label="Speak" onClick=${() => M.island.listen()}><${MIC}/></button>` : html`<${SRCH}/>`}
          <input ref=${inp} id="pal-input" type="text" value=${q} placeholder="Ask m360 or jump to anything" aria-label="Ask m360" autocomplete="off" spellcheck="false"
            onInput=${e => setQ(e.target.value)} onKeyDown=${onKey}/>
          <kbd class="kb cbk">esc</kbd>
        </div>
        <div class="cbl" id="pal-list" role="listbox">
          ${items.length ? items.map(rowOf) : html`<div class="cbe">No match yet. Try a name, a client, a page or who is late.</div>`}
        </div>
      </div>`;
    }

    let lastGroup = '';
    return html`<div class="pal-scrim" onMouseDown=${e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="pal" role="dialog" aria-label="Search">
        <${M.fx.Beam} radius=${22} size="sm"><div class="pal-in">
          ${q.trim() ? html`<${M.fx.Orb} state="searching" size=${20} label="searching"/>` : html`<${icons.search}/>`}
          <input ref=${inp} id="pal-input" value=${q} placeholder="Search anything, or type what you want to do" aria-label="Search or run"
            onInput=${e => setQ(e.target.value)} onKeyDown=${onKey}/>
          ${phone ? html`<button type="button" class="iconbtn" aria-label="Close" onClick=${onClose}><${icons.x}/></button>` : html`<span class="kbd">esc</span>`}
        </div><//>
        <div class="pal-list" id="pal-list">
          ${items.length ? items.map((it, i) => {
            const head = it.group !== lastGroup && it.group !== 'more' ? html`<div class="pal-group" key=${'g' + it.group + i}>${headOf(it.group)}</div>` : null;
            lastGroup = it.group;
            return html`<${React.Fragment} key=${it.key}>
              ${head}
              <button type="button" class=${'pal-item' + (i === sel ? ' on' : '') + (it.ai ? ' ai' : '') + (it.more ? ' more' : '')} data-group=${it.group} onMouseEnter=${() => setSel(i)} onClick=${it.run}>
                ${it.ai ? html`<span class="pal-orb"><${M.fx.Orb} state="working" size=${20} label="m360"/></span><span class="spark">${SPARK}</span>` : it.uid ? html`<${UI.Avatar} id=${it.uid} size=${22}/>` : it.icon && icons[it.icon] ? html`<${icons[it.icon]}/>` : null}
                <span class="t">${it.label}</span>
                ${it.sub ? html`<span class="sub">${it.sub}</span>` : null}
              </button>
            <//>`;
          }) : html`<div class="pal-group">Nothing matches. Ask m360 instead.</div>`}
        </div>
        <div class="pal-foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">enter</span> run</span><span><span class="kbd">${M.isMac ? '⌘K' : 'Ctrl K'}</span> open this</span></div>
      </div>
    </div>`;
  }

  M.parts.Palette = Palette;
  M.palette = {PAGES, answer, INTENTS};
})();
