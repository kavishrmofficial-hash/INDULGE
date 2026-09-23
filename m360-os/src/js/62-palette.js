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
    ['Calendar', 'calendar', 'calendar'], ['Reviews', 'reviews', 'review'], ['Clients', 'clients', 'clients'], ['Pipeline', 'pitches', 'pitches'],
    ['Feed', 'feed', 'feed'], ['Crew', 'people', 'people'], ['Pulse and ideas', 'voice', 'voice'], ['Leaderboard', 'scores', 'scores'],
    ['Base', 'base', 'database'], ['Companies', 'companies', 'database'], ['Radar', 'radar', 'radar'],
    ['Me', 'me', 'people'], ['Leave', 'leave', 'leave'], ['Handbook', 'handbook', 'handbook'], ['Trophies', 'trophies', 'trophy'],
    ['HQ', 'hq', 'command', true], ['Dashboard', 'command', 'command', true], ['Hiring', 'hiring', 'hiring', true], ['Admin', 'admin', 'desk', true]
  ];
  /* the order headings appear in */
  const ORDER = ['people', 'companies', 'tasks', 'projects', 'clients', 'pitches', 'posts', 'handbook', 'inbox', 'leave', 'radar', 'log', 'go to', 'actions', 'more', 'ask'];

  const norm = s => String(s || '').toLowerCase();
  /* every word of the query has to appear somewhere in the text */
  const matches = (q, text) => { const t = norm(text); return q.every(w => t.includes(w)); };

  /* actions and pages: the palette's own rows; entities come from the search index */
  function buildItems(ctx, query, closeThen) {
    const q = norm(query).split(/\s+/).filter(Boolean);
    const out = [];
    const go = (fn, group, label, icon, sub, key) => out.push({key, group, label, icon, sub, run: () => closeThen(fn)});
    const td = U.todayStr();

    /* actions */
    const a = M.att.dayStatus(ctx, ctx.uid, td);
    const checked = a.status === 'office' || a.status === 'wfh';
    const acts = [
      [checked && !a.out ? 'Check out' : 'Check in', 'today', () => M.intend('#home', 'checkin')],
      ['New task', 'tasks', () => M.intend('#tasks', 'newtask')],
      ['Post an update', 'feed', () => M.intend('#feed', 'post')],
      ['Give kudos', 'scores', () => M.intend('#feed', 'kudos')],
      ['Request leave', 'leave', () => M.nav('#leave')],
      ['Start a focus session', 'timer', () => M.focus && M.focus.open()],
      ['Take a breather', 'breath', () => M.breathe && M.breathe.open()],
      ['Show me around', 'send', () => window.dispatchEvent(new CustomEvent('m360:tour'))],
      ['Inbox', 'bell', () => window.dispatchEvent(new CustomEvent('m360:inbox'))],
      ['Keyboard shortcuts', 'cmd', () => window.dispatchEvent(new CustomEvent('m360:keys'))],
      [M.theme.resolved() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', M.theme.resolved() === 'dark' ? 'sun' : 'moon', () => M.theme.set(M.theme.resolved() === 'dark' ? 'light' : 'dark')],
      [M.sound.on() ? 'Turn sounds off' : 'Turn sounds on', 'play', () => M.sound.set(!M.sound.on())]
    ];
    if (window.M360_STANDALONE) acts.push(['Sign out', 'out', () => window.M360_API('logout').then(() => location.reload(), () => location.reload())]);
    acts.forEach(([label, icon, fn], i) => { if (!q.length ? i < 5 : matches(q, label)) go(fn, 'actions', label, icon, '', 'a' + i); });

    if (!q.length) {
      PAGES.filter(p => !p[3] || ctx.isFounder).slice(0, 6).forEach(p => go(() => M.nav('#' + p[1]), 'go to', p[0], p[2], '', 'p' + p[1]));
      return out;
    }
    PAGES.filter(p => (!p[3] || ctx.isFounder) && matches(q, p[0])).forEach(p => go(() => M.nav('#' + p[1]), 'go to', p[0], p[2], '', 'p' + p[1]));
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

  function Palette({onClose, onAsk}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(0);
    const [showAll, setShowAll] = useState(null); /* {q, group} while the Search drawer is open */
    const inp = useRef(null);
    const names = M.useProfiles(ctx.activeMembers.map(m => m.uid));
    const log = M.search ? M.search.useLog(ctx, q) : null;
    const closeThen = fn => { onClose(); setTimeout(fn, 20); };

    const items = useMemo(() => {
      const own = buildItems(ctx, q, closeThen);
      const query = q.trim();
      const found = query ? (M.search ? M.search.hits(ctx, query, {names, log}) : localHits(ctx, query, names)) : [];
      const list = own.concat(found.map(h => ({...h, run: h.more ? () => setShowAll({q: query, group: h.more}) : () => closeThen(() => M.nav(h.hash))})));
      const real = found.filter(h => !h.more).length;
      if (real > 0 && M.parts.SearchAll) list.push({key: 'more', group: 'more', label: 'Show all ' + real + (real === 1 ? ' result' : ' results'), icon: 'search', more: 'all',
        run: () => setShowAll({q: query, group: 'all'})});
      list.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
      if (query && M.ai.on(ctx)) list.push({key: 'ai', group: 'ask', label: 'Ask m360: ' + query, icon: null, ai: true, run: () => closeThen(() => onAsk(query))});
      return list;
    }, [q, ctx, names, log]);

    useEffect(() => { setSel(0); }, [q]);
    useEffect(() => { if (inp.current) inp.current.focus(); }, []);

    const onKey = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) items[sel].run(); }
      else if (e.key === 'Escape') onClose();
    };

    if (showAll && M.parts.SearchAll) return html`<${M.parts.SearchAll} q0=${showAll.q} group0=${showAll.group} onClose=${onClose}/>`;

    let lastGroup = '';
    return html`<div class="pal-scrim" onMouseDown=${e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="pal" role="dialog" aria-label="Search">
        <div class="pal-in">
          <${icons.search}/>
          <input ref=${inp} id="pal-input" value=${q} placeholder="Search anything, or type what you want to do" aria-label="Search or run"
            onInput=${e => setQ(e.target.value)} onKeyDown=${onKey}/>
          <span class="kbd">esc</span>
        </div>
        <div class="pal-list" id="pal-list">
          ${items.length ? items.map((it, i) => {
            const head = it.group !== lastGroup && it.group !== 'more' ? html`<div class="pal-group" key=${'g' + it.group + i}>${it.group}</div>` : null;
            lastGroup = it.group;
            return html`<${React.Fragment} key=${it.key}>
              ${head}
              <button type="button" class=${'pal-item' + (i === sel ? ' on' : '') + (it.ai ? ' ai' : '') + (it.more ? ' more' : '')} data-group=${it.group} onMouseEnter=${() => setSel(i)} onClick=${it.run}>
                ${it.ai ? html`<span class="spark">${SPARK}</span>` : it.uid ? html`<${UI.Avatar} id=${it.uid} size=${22}/>` : it.icon && icons[it.icon] ? html`<${icons[it.icon]}/>` : null}
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
})();
