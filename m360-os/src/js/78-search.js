/* module: search. The master search under Cmd K: one index across contacts, companies, tasks,
   projects, clients, pitches, posts, handbook, inbox, leave, saved links and the founder's log.
   Also the Search drawer (every match, filters by group), the Connections block every entity
   shows, and the Base intelligence: Ask the base, quiet leads and nudges, plus the tools the
   model gets. Everything here is client side and instant; the model is only asked when tapped. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;

  const SPARK = '✦';
  const CAP = 8;
  const DAY = 86400000;
  const norm = s => String(s || '').toLowerCase();
  const pick = (o, k) => (o && o[k] != null) ? String(o[k]) : '';
  const words = q => norm(q).trim().split(/\s+/).filter(Boolean);
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };

  /* 3: the text starts with the whole query. 2: every word starts a word of the text. 1: every word appears. 0: no. */
  function rankOf(qs, ws, text) {
    const t = norm(text);
    if (!ws.length || !ws.every(w => t.includes(w))) return 0;
    if (t.startsWith(qs)) return 3;
    const parts = t.split(/[^a-z0-9@.]+/);
    if (ws.every(w => parts.some(p => p.startsWith(w)))) return 2;
    return 1;
  }

  /* ---------- the Base: contacts and orgs live in page documents, flattened here ---------- */
  const flatCache = new WeakMap();
  function rowsOf(ctx, name) {
    try {
      const r = (M.base && typeof M.base.all === 'function') ? M.base.all(ctx, name) : null;
      if (Array.isArray(r)) return r;
    } catch (e) { /* the Base module keeps its own shape; fall through to ours */ }
    const coll = ctx && ctx.coll && ctx.coll[name];
    const map = (coll && coll.map) || {};
    if (flatCache.has(map)) return flatCache.get(map);
    const out = [];
    for (const page of Object.keys(map).sort()) {
      const rows = (map[page] && map[page].rows) || {};
      for (const id of Object.keys(rows)) {
        const r = rows[id];
        if (!r || r.archived) continue;
        out.push({...r, id: r.id || id});
      }
    }
    flatCache.set(map, out);
    return out;
  }
  const contacts = ctx => rowsOf(ctx, 'contacts');
  const orgs = ctx => rowsOf(ctx, 'orgs');
  const orgById = (ctx, id) => id ? orgs(ctx).find(o => o.id === id) || null : null;
  const contactById = (ctx, id) => id ? contacts(ctx).find(c => c.id === id) || null : null;
  const nameOf = c => c ? (c.name || [c.first, c.last].filter(Boolean).join(' ') || 'Someone') : '';
  const domainOf = c => { const e = pick(c, 'email'); return e.includes('@') ? e.split('@')[1] : ''; };
  const orgNameOf = (ctx, c) => { const o = orgById(ctx, c.org); return (o && o.name) || c.orgName || ''; };
  const contactSub = (ctx, c) => [c.title, orgNameOf(ctx, c)].filter(Boolean).join(', ');
  const stampOf = r => Number(r.updated || r.at || 0);

  /* companies whose name or domain match a typed company */
  function orgsMatching(ctx, q) {
    const s = norm(q).trim();
    if (!s) return [];
    return orgs(ctx).filter(o => norm(o.name).includes(s) || norm(o.domain).includes(s) || norm(o.website).includes(s));
  }
  function clientsMatching(ctx, q) {
    const s = norm(q).trim();
    const map = ctx.coll.clients.map;
    return s ? Object.keys(map).filter(id => norm(map[id].name).includes(s)) : [];
  }
  /* the client a pitch belongs to: the brand's client page, or the contact's company's client */
  function clientOfPitch(ctx, p) {
    if (!p) return '';
    const key = norm(p.brand).trim();
    const map = ctx.coll.clients.map;
    const byName = key ? Object.keys(map).find(id => norm(map[id].name).trim() === key) : '';
    if (byName) return byName;
    const c = contactById(ctx, p.contact);
    const o = c ? orgById(ctx, c.org) : null;
    return (o && o.client) || '';
  }
  const orgOfClient = (ctx, cid) => {
    const c = ctx.coll.clients.map[cid];
    if (c && c.org) { const o = orgById(ctx, c.org); if (o) return o; }
    return orgs(ctx).find(o => o.client === cid) || null;
  };
  const peopleAt = (ctx, oid) => oid ? contacts(ctx).filter(c => c.org === oid) : [];
  const mentions = (text, name) => { const n = norm(name).trim(); return !!n && n.length > 2 && norm(text).includes(n); };

  /* the inbox writes rich lines (names as elements); this reads them back as text */
  function flat(node, names) {
    if (node == null || node === false) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(n => flat(n, names)).join('');
    if (node.props) {
      if (node.type === UI.Name) { const p = names[node.props.id]; return (p && p.name) || ''; }
      return flat(node.props.children, names);
    }
    return '';
  }

  /* ---------- the index ---------- */
  const GROUPS = ['people', 'companies', 'tasks', 'projects', 'clients', 'pitches', 'posts', 'handbook', 'inbox', 'leave', 'radar', 'log'];
  const GROUP_LABEL = {people: 'People', companies: 'Companies', tasks: 'Tasks', projects: 'Projects', clients: 'Clients', pitches: 'Pitches',
    posts: 'Posts', handbook: 'Handbook', inbox: 'Inbox', leave: 'Leave', radar: 'Saved links', log: 'Log'};
  const GROUP_ICON = {people: 'people', companies: 'database', tasks: 'tasks', projects: 'projects', clients: 'clients', pitches: 'pitches',
    posts: 'feed', handbook: 'handbook', inbox: 'bell', leave: 'leave', radar: 'radar', log: 'log'};

  /* every hit across every group, ranked and capped. opts: {names, cap, log, groups} */
  function hits(ctx, query, opts) {
    opts = opts || {};
    const names = opts.names || {};
    const cap = opts.cap || CAP;
    const only = opts.groups || null;
    const qs = norm(query).trim();
    const ws = words(query);
    if (!ws.length) return [];
    const out = [];
    const overflow = {};
    const want = g => !only || only.indexOf(g) >= 0;
    const take = (group, list, more) => {
      const ranked = list.filter(x => x.rank > 0).sort((a, b) => b.rank - a.rank || (a.order || 0) - (b.order || 0));
      const shown = ranked.slice(0, cap);
      shown.forEach(x => out.push({...x, group, icon: x.icon || GROUP_ICON[group]}));
      if (ranked.length > shown.length) overflow[group] = ranked.length - shown.length;
      if (more && ranked.length > shown.length) out.push({key: group + ':more', group, label: more.label, sub: (ranked.length - shown.length) + ' more', icon: 'search', more: more.group || group, rank: 0});
    };
    const rk = text => rankOf(qs, ws, text);

    if (want('people')) {
      const team = ctx.activeMembers.map((m, i) => {
        const nm = (names[m.uid] && names[m.uid].name) || '';
        return {key: 'u' + m.uid, label: nm || 'Someone', sub: m.title || '', uid: m.uid, hash: '#people/' + m.uid, rank: nm ? rk(nm + ' ' + (m.title || '')) : 0, order: i};
      }).filter(x => x.rank > 0).slice(0, 3);
      const cs = contacts(ctx).map((c, i) => ({key: 'c' + c.id, label: nameOf(c), sub: contactSub(ctx, c), hash: '#base/' + c.id, cid: c.id, order: 1000 - Math.min(999, Math.floor(stampOf(c) / DAY)) + i * 0.001,
        rank: Math.max(rk(nameOf(c)), Math.min(2, rk(nameOf(c) + ' ' + (c.title || '') + ' ' + orgNameOf(ctx, c) + ' ' + pick(c, 'email') + ' ' + (c.city || ''))))}));
      const ranked = cs.filter(x => x.rank > 0).sort((a, b) => b.rank - a.rank || a.order - b.order);
      const slots = Math.max(0, cap - team.length);
      team.forEach(x => out.push({...x, group: 'people', icon: 'people'}));
      ranked.slice(0, slots).forEach(x => out.push({...x, group: 'people', icon: 'people'}));
      if (ranked.length > slots) { overflow.people = ranked.length - slots; out.push({key: 'people:more', group: 'people', label: 'Show all in Base', sub: (ranked.length - slots) + ' more', icon: 'search', more: 'people', rank: 0}); }
    }
    if (want('companies')) take('companies', orgs(ctx).map((o, i) => ({key: 'o' + o.id, label: o.name || 'Company', sub: [o.industry, o.city].filter(Boolean).join(', '), hash: '#companies/' + o.id, order: i,
      rank: Math.max(rk(o.name), Math.min(2, rk((o.name || '') + ' ' + (o.domain || '') + ' ' + (o.industry || '') + ' ' + (o.city || ''))))})), {label: 'Show all companies'});
    if (want('tasks')) {
      const tmap = ctx.coll.tasks.map;
      take('tasks', Object.keys(tmap).map(id => ({id, ...tmap[id]})).map(t => ({key: 't' + t.id, label: t.title || 'Task', hash: '#tasks/' + t.id, rank: rk(t.title),
        order: (t.owner === ctx.uid ? 0 : 1) + (t.status === 'done' ? 2 : 0),
        sub: t.status === 'done' ? 'done' : t.due ? 'due ' + (M.tasks && M.tasks.dueLabel ? M.tasks.dueLabel(t.due) : t.due) : (t.status || 'to do')})));
    }
    if (want('projects')) {
      const pmap = ctx.coll.projects.map;
      take('projects', Object.keys(pmap).filter(id => !pmap[id].archived).map(id => ({key: 'pj' + id, label: pmap[id].name || 'Project', hash: '#projects/' + id, rank: rk(pmap[id].name), sub: pmap[id].status === 'done' ? 'done' : ''})));
    }
    if (want('clients')) {
      const cmap = ctx.coll.clients.map;
      take('clients', Object.keys(cmap).map(id => ({key: 'cl' + id, label: cmap[id].name || 'Client', hash: '#clients/' + id, rank: rk(cmap[id].name), sub: cmap[id].status || ''})));
    }
    if (want('pitches')) {
      const pi = ctx.coll.pitches.map;
      const st = (M.pitches && M.pitches.STAGES) || [];
      take('pitches', Object.keys(pi).map(id => { const p = pi[id]; const s = st.find(x => x.v === p.stage); const c = contactById(ctx, p.contact);
        return {key: 'pi' + id, label: p.brand || 'Pitch', hash: '#pitches/' + id, sub: (s && s.label) || p.stage || '',
          rank: Math.max(rk(p.brand), Math.min(2, rk((p.brand || '') + ' ' + (p.category || '') + ' ' + (c ? nameOf(c) : p.contact || ''))))}; }));
    }
    if (want('posts') && M.feed && M.feed.stream) {
      take('posts', M.feed.stream(ctx).filter(x => x.type === 'post').map((x, i) => ({key: 'po' + x.key, label: cut(x.text, 80), hash: '#feed', order: i,
        sub: (names[x.author] && names[x.author].name) || '', rank: rk(x.text)})));
    }
    if (want('handbook')) {
      const hb = ctx.coll.handbook.map;
      take('handbook', Object.keys(hb).map(id => ({key: 'h' + id, label: hb[id].title || 'Section', hash: '#handbook/' + id, rank: Math.max(rk(hb[id].title), Math.min(2, rk((hb[id].title || '') + ' ' + String(hb[id].body || '').slice(0, 400))))})));
    }
    if (want('inbox') && M.inbox && M.inbox.items) {
      take('inbox', M.inbox.items(ctx).map((it, i) => { const t = flat(it.text, names); return {key: 'in' + it.id, label: cut(t, 80), hash: it.ref || '#home', sub: U.timeAgo(it.at || 0), order: i, rank: rk(t), icon: 'bell'}; }));
    }
    if (want('leave')) {
      /* only the viewer's own requests: leave is private to the person and the founder */
      const reqs = ((ctx.coll.leave.map[ctx.uid] || {}).reqs || []).filter(r => r && r.id);
      const dec = ((ctx.coll.leavedec.map[ctx.uid] || {}).d) || {};
      const range = r => (M.leave && M.leave.rangeText) ? M.leave.rangeText(r) : (r.from + ' to ' + r.to);
      take('leave', reqs.map((r, i) => { const d = dec[r.id]; const status = d && (d.status === 'approved' || d.status === 'declined') ? d.status : 'pending';
        return {key: 'lv' + r.id, label: 'Leave ' + range(r), sub: status, hash: '#leave', order: i, rank: rk('leave ' + (r.type || '') + ' ' + range(r) + ' ' + status)}; }));
    }
    if (want('radar')) {
      const saved = ((ctx.coll.me.map[ctx.uid] || {}).saved) || {};
      const host = l => { try { return new URL(String(l)).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
      take('radar', Object.keys(saved).map((id, i) => ({key: 'sv' + id, label: cut(saved[id].title || saved[id].link, 80), sub: host(saved[id].link), hash: '#radar', order: -(saved[id].at || 0), rank: rk((saved[id].title || '') + ' ' + host(saved[id].link))})));
    }
    if (want('log') && ctx.isFounder && opts.log) {
      const rows = [];
      for (const id of Object.keys(opts.log)) {
        const e = (opts.log[id] && opts.log[id].e) || {};
        for (const k of Object.keys(e)) rows.push({...e[k], uid: String(id).slice(11)});
      }
      take('log', rows.sort((a, b) => (b.at || 0) - (a.at || 0)).map((e, i) => { const who = (names[e.uid] && names[e.uid].name) || '';
        const text = (e.a || '') + ' ' + (e.p || '') + ' ' + (e.s || '') + ' ' + who;
        return {key: 'lg' + (e.at || i) + i, label: cut((e.a || 'write') + ' ' + (e.p || ''), 70), sub: (who ? who + ', ' : '') + U.timeAgo(e.at || 0), hash: '#admin', order: i, rank: rk(text)}; }));
    }
    out.overflow = overflow;
    return out;
  }

  /* the founder's last 7 days of log entries, read once per palette open and only for 3+ character queries */
  function useLog(ctx, q) {
    const [docs, setDocs] = useState(null);
    const want = !!(ctx.isFounder && String(q || '').trim().length >= 3 && M.logs && M.logs.read);
    useEffect(() => {
      if (!want || docs) return undefined;
      let live = true;
      const to = U.todayStr(), from = U.ymd(U.addDays(new Date(), -7));
      M.logs.read(ctx, {from, to}).then(d => { if (live) setDocs(d || {}); }, () => { if (live) setDocs({}); });
      return () => { live = false; };
    }, [want]);
    return want ? docs : null;
  }

  /* ---------- the Search drawer: every match, filters by group ---------- */
  function SearchAll({q0, group0, onClose}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState(q0 || '');
    const [group, setGroup] = useState(group0 || 'all');
    const names = M.useProfiles(ctx.activeMembers.map(m => m.uid));
    const log = useLog(ctx, q);
    const all = useMemo(() => hits(ctx, q, {names, cap: 60, log}), [ctx, q, names, log]);
    const rows = all.filter(x => !x.more);
    const counts = {};
    rows.forEach(x => { counts[x.group] = (counts[x.group] || 0) + 1; });
    const groupsHere = GROUPS.filter(g => counts[g]);
    const shown = rows.filter(x => group === 'all' || x.group === group);
    const go = x => { onClose(); setTimeout(() => M.nav(x.hash), 20); };
    let last = '';
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Search">
      <div id="search-all" class="stack">
        <${UI.Input} id="search-all-input" value=${q} onChange=${setQ} placeholder="Search across everything"/>
        ${groupsHere.length ? html`<div class="srch-chips" role="tablist" aria-label="Filter results">
          <button type="button" role="tab" class=${'chip' + (group === 'all' ? ' on' : '')} aria-selected=${group === 'all'} onClick=${() => setGroup('all')}>All <span class="num">${rows.length}</span></button>
          ${groupsHere.map(g => html`<button key=${g} type="button" role="tab" class=${'chip' + (group === g ? ' on' : '')} aria-selected=${group === g} onClick=${() => setGroup(g)}>${GROUP_LABEL[g]} <span class="num">${counts[g]}</span></button>`)}
        </div>` : null}
        <div class="srch-list">
          ${shown.length ? shown.map(x => {
            const head = x.group !== last ? html`<${UI.Micro} key=${'g' + x.group}>${GROUP_LABEL[x.group]}<//>` : null;
            last = x.group;
            return html`<${React.Fragment} key=${x.key}>${head}
              <button type="button" class="conn-row" onClick=${() => go(x)}>
                ${x.uid ? html`<${UI.Avatar} id=${x.uid} size=${20}/>` : icons[x.icon] ? html`<${icons[x.icon]}/>` : null}
                <span class="t">${x.label}</span>${x.sub ? html`<span class="sub">${x.sub}</span>` : null}
              </button><//>`;
          }) : html`<${UI.Empty} text=${words(q).length ? 'Nothing matches that.' : 'Type to search across everything.'}/>`}
        </div>
        ${M.ai.on(ctx) ? html`<${AskBase} initial=${''} compact=${true}/>` : null}
      </div>
    <//>`;
  }

  /* ---------- Connections: what this thing is linked to ---------- */
  function connectionsOf(ctx, kind, id) {
    const rows = [];
    const add = (group, key, label, sub, hash, extra) => { if (!rows.some(r => r.key === key)) rows.push({group, key, label, sub: sub || '', hash, ...(extra || {})}); };
    const cmap = ctx.coll.clients.map, pmap = ctx.coll.projects.map, tmap = ctx.coll.tasks.map, pimap = ctx.coll.pitches.map;
    const st = (M.pitches && M.pitches.STAGES) || [];
    const stage = p => { const s = st.find(x => x.v === p.stage); return (s && s.label) || p.stage || ''; };
    const addClient = cid => { const c = cid && cmap[cid]; if (c) add('client', 'cl' + cid, c.name || 'Client', c.status || '', '#clients/' + cid, {icon: 'clients'}); };
    const addOrg = o => { if (o) add('company', 'o' + o.id, o.name || 'Company', [o.industry, o.city].filter(Boolean).join(', '), '#companies/' + o.id, {icon: 'database'}); };
    const addPerson = c => { if (c) add('people', 'c' + c.id, nameOf(c), [c.title, c.stage].filter(Boolean).join(', '), '#base/' + c.id, {icon: 'people'}); };
    const addPitch = (pid, p) => add('pitches', 'pi' + pid, p.brand || 'Pitch', stage(p), '#pitches/' + pid, {icon: 'pitches'});
    const addProject = (pid, p) => add('projects', 'pj' + pid, p.name || 'Project', p.status === 'done' ? 'done' : (p.due ? 'due ' + U.fmtDate(p.due) : ''), '#projects/' + pid, {icon: 'projects'});
    const addTask = (tid, t) => add('tasks', 't' + tid, t.title || 'Task', t.status === 'done' ? 'done' : (t.due ? 'due ' + U.fmtDate(t.due) : t.status || ''), '#tasks/' + tid, {icon: 'tasks'});
    const posts = () => (M.feed && M.feed.stream) ? M.feed.stream(ctx).filter(x => x.type === 'post') : [];
    const addPosts = (name, n) => posts().filter(x => mentions(x.text, name)).slice(0, n || 4).forEach(x => add('posts', 'po' + x.key, cut(x.text, 80), U.timeAgo(x.at), '#feed', {icon: 'feed', uid: x.author}));
    const projectsOfClient = cid => Object.keys(pmap).filter(pid => pmap[pid].client === cid && !pmap[pid].archived);
    const pitchesOfClient = cid => Object.keys(pimap).filter(pid => clientOfPitch(ctx, pimap[pid]) === cid);

    if (kind === 'client') {
      const c = cmap[id];
      if (!c) return rows;
      const o = orgOfClient(ctx, id);
      addOrg(o);
      if (o) peopleAt(ctx, o.id).slice(0, 8).forEach(addPerson);
      projectsOfClient(id).forEach(pid => addProject(pid, pmap[pid]));
      pitchesOfClient(id).forEach(pid => addPitch(pid, pimap[pid]));
      Object.keys(tmap).filter(tid => tmap[tid].client === id && tmap[tid].status !== 'done').slice(0, 6).forEach(tid => addTask(tid, tmap[tid]));
      addPosts(c.name);
    } else if (kind === 'contact') {
      const c = contactById(ctx, id);
      if (!c) return rows;
      const o = orgById(ctx, c.org);
      addOrg(o);
      if (o && o.client) addClient(o.client);
      const nm = nameOf(c);
      Object.keys(pimap).filter(pid => pimap[pid].contact === id || mentions(pimap[pid].contact, nm)).forEach(pid => addPitch(pid, pimap[pid]));
      Object.keys(tmap).filter(tid => mentions(tmap[tid].title, nm) || Object.values(tmap[tid].comments || {}).some(x => mentions(x && x.t, nm))).slice(0, 6).forEach(tid => addTask(tid, tmap[tid]));
      addPosts(nm);
    } else if (kind === 'org') {
      const o = orgById(ctx, id);
      if (!o) return rows;
      if (o.client) addClient(o.client);
      peopleAt(ctx, id).slice(0, 12).forEach(addPerson);
      const ids = new Set(peopleAt(ctx, id).map(c => c.id));
      Object.keys(pimap).filter(pid => { const p = pimap[pid]; return ids.has(p.contact) || norm(p.brand).trim() === norm(o.name).trim() || (o.client && clientOfPitch(ctx, p) === o.client); }).forEach(pid => addPitch(pid, pimap[pid]));
      if (o.client) projectsOfClient(o.client).forEach(pid => addProject(pid, pmap[pid]));
    } else if (kind === 'project') {
      const p = pmap[id];
      if (!p) return rows;
      addClient(p.client);
      const o = p.client ? orgOfClient(ctx, p.client) : null;
      addOrg(o);
      if (o) peopleAt(ctx, o.id).slice(0, 8).forEach(addPerson);
      if (p.pitch && pimap[p.pitch]) addPitch(p.pitch, pimap[p.pitch]);
    } else if (kind === 'pitch') {
      const p = pimap[id];
      if (!p) return rows;
      const cid = clientOfPitch(ctx, p);
      addClient(cid);
      const c = contactById(ctx, p.contact);
      const o = (c && orgById(ctx, c.org)) || (cid ? orgOfClient(ctx, cid) : null) || orgs(ctx).find(x => norm(x.name).trim() === norm(p.brand).trim()) || null;
      addOrg(o);
      addPerson(c);
    }
    return rows;
  }
  const CONN_LABEL = {company: 'company', client: 'client', people: 'people', pitches: 'pitches', projects: 'projects', tasks: 'open tasks', posts: 'on the feed'};

  function Connections({kind, id}) {
    const ctx = M.useCtx();
    const rows = useMemo(() => connectionsOf(ctx, kind, id), [ctx, kind, id]);
    if (!rows.length) return null;
    const order = ['company', 'client', 'people', 'pitches', 'projects', 'tasks', 'posts'];
    const groups = order.filter(g => rows.some(r => r.group === g));
    const body = html`<section class="card conn" id="connections">
      <div class="card-head"><h2 class="card-title">Connections</h2></div>
      ${groups.map(g => html`<div key=${g} class="conn-group">
        <${UI.Micro}>${CONN_LABEL[g]}<//>
        ${rows.filter(r => r.group === g).map(r => html`<button key=${r.key} type="button" class="conn-row" data-conn=${r.key} onClick=${() => M.nav(r.hash)}>
          ${r.uid ? html`<${UI.Avatar} id=${r.uid} size=${20}/>` : icons[r.icon] ? html`<${icons[r.icon]}/>` : null}
          <span class="t">${r.label}</span>${r.sub ? html`<span class="sub">${r.sub}</span>` : null}
        </button>`)}
      </div>`)}
    </section>`;
    return html`<${UI.Fold} title="Connections" summary=${rows.length + (rows.length === 1 ? ' link' : ' links')} id="fold-connections">${body}<//>`;
  }

  /* ---------- intelligence: quiet leads, nudges, the model's tools ---------- */
  const QUIET_STAGES = ['contacted', 'replied', 'meeting'];
  function quietLeads(ctx, days) {
    const n = days == null ? 21 : Number(days);
    const cutAt = (ctx.now || Date.now()) - n * DAY;
    return contacts(ctx).filter(c => QUIET_STAGES.indexOf(c.stage) >= 0 && stampOf(c) > 0 && stampOf(c) < cutAt)
      .sort((a, b) => stampOf(a) - stampOf(b));
  }
  const listNames = (arr, n) => { const nm = arr.slice(0, n || 3).map(x => nameOf(x)); const rest = arr.length - nm.length; return nm.join(', ') + (rest > 0 ? ' and ' + rest + ' more' : ''); };
  function suggestions(ctx) {
    const out = [];
    const quiet = quietLeads(ctx, 21);
    if (quiet.length) out.push({k: 'quiet', text: (quiet.length === 1 ? '1 lead has' : quiet.length + ' leads have') + ' gone quiet for 3 weeks or more: ' + listNames(quiet) + '. A short follow up keeps them warm.', hash: '#base/' + quiet[0].id, n: quiet.length});
    const noClient = orgs(ctx).filter(o => !o.client && peopleAt(ctx, o.id).length >= 2).sort((a, b) => peopleAt(ctx, b.id).length - peopleAt(ctx, a.id).length);
    noClient.slice(0, 3).forEach(o => out.push({k: 'org:' + o.id, text: o.name + ' has ' + peopleAt(ctx, o.id).length + ' contacts in the Base and no client page yet. Worth a pitch.', hash: '#companies/' + o.id, n: peopleAt(ctx, o.id).length}));
    const cmap = ctx.coll.clients.map;
    const bare = Object.keys(cmap).filter(cid => { const o = orgOfClient(ctx, cid); return !o || !peopleAt(ctx, o.id).length; });
    bare.slice(0, 3).forEach(cid => out.push({k: 'client:' + cid, text: (cmap[cid].name || 'A client') + ' has no contact on file. Add the people you talk to.', hash: '#clients/' + cid, n: 0}));
    return out;
  }

  /* what the model may know about a contact: never the full address, only its domain */
  function contactForModel(ctx, c, nm) {
    const o = orgById(ctx, c.org);
    return {name: nameOf(c), title: c.title || '', company: (o && o.name) || c.orgName || '', domain: domainOf(c) || (o && o.domain) || '', city: c.city || '',
      stage: c.stage || '', owner: (c.owner && ctx.canSee(c.owner) && nm) ? (nm[c.owner] || '') : '', lastTouch: stampOf(c) ? U.timeAgo(stampOf(c)) : ''};
  }
  function orgForModel(ctx, o) {
    return {name: o.name || '', domain: o.domain || '', industry: o.industry || '', city: o.city || '', people: peopleAt(ctx, o.id).length,
      client: o.client && ctx.coll.clients.map[o.client] ? (ctx.coll.clients.map[o.client].name || 'yes') : ''};
  }
  const STOP = ['who', 'do', 'we', 'know', 'at', 'the', 'and', 'our', 'which', 'what', 'have', 'has', 'gone', 'quiet', 'best', 'to', 'this', 'month', 'summarise', 'summarize', 'contacts', 'companies', 'people', 'leads', 'pitch', 'reels', 'in', 'for', 'with', 'a', 'an', 'of', 'is', 'are', 'me', 'my'];
  /* the top records the question points at, as prompt lines; the freshest 40 when nothing matches */
  function slice(ctx, q, nm) {
    const ws = words(q).filter(w => w.length >= 3 && STOP.indexOf(w) < 0);
    const score = text => ws.reduce((n, w) => n + (norm(text).includes(w) ? 1 : 0), 0);
    const cs = contacts(ctx).map(c => ({c, s: score(nameOf(c) + ' ' + (c.title || '') + ' ' + orgNameOf(ctx, c) + ' ' + (c.city || '') + ' ' + (c.country || '') + ' ' + (c.stage || '') + ' ' + (c.tags || []).join(' ')), t: stampOf(c)}));
    const os = orgs(ctx).map(o => ({o, s: score((o.name || '') + ' ' + (o.industry || '') + ' ' + (o.city || '') + ' ' + (o.country || '') + ' ' + (o.keywords || []).join(' ')), t: stampOf(o)}));
    const any = cs.some(x => x.s) || os.some(x => x.s);
    const by = (a, b) => (b.s - a.s) || (b.t - a.t);
    const topC = cs.filter(x => !any || x.s).sort(by).slice(0, 28);
    const topO = os.filter(x => !any || x.s).sort(by).slice(0, 12);
    const lines = ['BASE: ' + contacts(ctx).length + ' contacts, ' + orgs(ctx).length + ' companies. Top matches for this question:'];
    topO.forEach(({o}) => { const r = orgForModel(ctx, o); lines.push('- Company ' + r.name + (r.industry ? ', ' + r.industry : '') + (r.city ? ', ' + r.city : '') + ', ' + r.people + ' contacts' + (r.client ? ', client: ' + r.client : ', no client page')); });
    topC.forEach(({c}) => { const r = contactForModel(ctx, c, nm); lines.push('- ' + r.name + (r.title ? ', ' + r.title : '') + (r.company ? ' at ' + r.company : '') + (r.city ? ', ' + r.city : '') + (r.stage ? ', stage ' + r.stage : '') + (r.owner ? ', owner ' + r.owner : '') + (r.lastTouch ? ', last touch ' + r.lastTouch : '')); });
    const quiet = quietLeads(ctx, 21);
    if (quiet.length) lines.push('QUIET LEADS (no touch in 21 days): ' + quiet.slice(0, 12).map(c => nameOf(c) + ' (' + c.stage + ', ' + U.timeAgo(stampOf(c)) + ')').join('; '));
    return lines.join('\n');
  }

  function tools(ctx, nm) {
    nm = nm || {};
    return [{
      name: 'search_base',
      description: 'Search the Base, the agency contacts database, for people or companies by name, title, company, city or stage. Returns up to 12 matches.',
      inputSchema: {type: 'object', properties: {q: {type: 'string', description: 'What to look for'}, kind: {type: 'string', enum: ['people', 'companies'], description: 'Optional: only people or only companies'}}, required: ['q']},
      execute: async input => {
        const q = String(input.q || '').trim();
        const kind = input.kind === 'people' || input.kind === 'companies' ? input.kind : '';
        const list = hits(ctx, q, {names: {}, cap: 12, groups: kind ? [kind] : ['people', 'companies']}).filter(x => !x.more && (x.cid || x.group === 'companies'));
        const people = list.filter(x => x.cid).map(x => contactForModel(ctx, contactById(ctx, x.cid), nm));
        const companies = list.filter(x => x.group === 'companies').map(x => orgForModel(ctx, orgById(ctx, x.key.slice(1))));
        return {people: people.slice(0, 12), companies: companies.slice(0, 12 - Math.min(12, people.length))};
      }
    }, {
      name: 'search_everything',
      description: 'Search across everything in m360: people, companies, tasks, projects, clients, pitches, posts and the handbook. Returns compact hits with a kind and a title.',
      inputSchema: {type: 'object', properties: {q: {type: 'string'}}, required: ['q']},
      execute: async input => hits(ctx, String(input.q || ''), {names: nm ? Object.fromEntries(Object.keys(nm).map(k => [k, {name: nm[k]}])) : {}, cap: 4, groups: ['people', 'companies', 'tasks', 'projects', 'clients', 'pitches', 'posts', 'handbook']})
        .filter(x => !x.more).slice(0, 24).map(x => ({kind: x.group, title: x.label, detail: x.sub || ''}))
    }, {
      name: 'who_do_we_know_at',
      description: 'List the contacts we have at a company, matched by company name or domain. Returns their names, titles and stages.',
      inputSchema: {type: 'object', properties: {company: {type: 'string'}}, required: ['company']},
      execute: async input => {
        const q = String(input.company || '').trim();
        const os = orgsMatching(ctx, q);
        const ids = new Set(os.map(o => o.id));
        const people = contacts(ctx).filter(c => ids.has(c.org) || norm(c.orgName).includes(norm(q))).slice(0, 20).map(c => contactForModel(ctx, c, nm));
        return {companies: os.slice(0, 5).map(o => orgForModel(ctx, o)), people};
      }
    }, {
      name: 'pipeline_for',
      description: 'The pitches and projects for a company or client, matched by name. Returns the client page, pitches with stages and next steps, and projects with status.',
      inputSchema: {type: 'object', properties: {company: {type: 'string'}}, required: ['company']},
      execute: async input => {
        const q = String(input.company || '').trim();
        const cmap = ctx.coll.clients.map, pmap = ctx.coll.projects.map, pimap = ctx.coll.pitches.map;
        const cids = new Set(clientsMatching(ctx, q));
        orgsMatching(ctx, q).forEach(o => { if (o.client && cmap[o.client]) cids.add(o.client); });
        const pitches = Object.keys(pimap).filter(pid => cids.has(clientOfPitch(ctx, pimap[pid])) || norm(pimap[pid].brand).includes(norm(q)))
          .map(pid => { const p = pimap[pid]; return {brand: p.brand || '', stage: p.stage || '', next: p.next || '', nextDate: p.nextDate || '', owner: nm[p.owner] || ''}; });
        const projects = Object.keys(pmap).filter(pid => cids.has(pmap[pid].client) && !pmap[pid].archived)
          .map(pid => { const p = pmap[pid]; return {name: p.name || '', status: p.status || '', due: p.due || '', owner: nm[p.owner] || ''}; });
        return {clients: Array.from(cids).map(id => ({name: cmap[id].name || '', status: cmap[id].status || ''})), pitches: pitches.slice(0, 12), projects: projects.slice(0, 12)};
      }
    }];
  }

  /* ---------- Ask the base ---------- */
  const BASE_CHIPS = ['Who do we know at Tata', 'Which leads have gone quiet', 'Best companies to pitch reels to this month', 'Summarise our contacts in Dubai'];
  function AskBase({initial, compact}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const [q, setQ] = useState(initial || '');
    const [asked, setAsked] = useState('');
    if (!M.ai.on(ctx)) return null;
    const busy = r.state === 'thinking' || r.state === 'streaming';
    async function go(text) {
      const msg = String(text || q).trim();
      if (!msg || busy) return;
      setAsked(msg); setQ('');
      const nm = await M.ai.names(ctx);
      const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
      const tl = lim && lim.tools ? tools(ctx, nm) : undefined;
      const prompt = 'INSTRUCTIONS: You are answering a question about the Base, the agency contacts database, for ' + (nm[ctx.uid] || 'a teammate') + '. ' +
        'Answer from the records below and your tools: search_base, who_do_we_know_at, pipeline_for and search_everything. ' +
        'Be brief: under 120 words, short bullets when listing people. Names and companies, never ids. When the Base does not say, say so plainly.\n\n' +
        slice(ctx, msg, nm) + '\n\nTHEY SAID: ' + msg;
      await r.run(o => M.ai.text(ctx, prompt, {signal: o.signal, onText: o.onText, tools: tl, cache: false}));
    }
    return html`<div class=${'ai-card askbase' + (compact ? ' compact' : '')} id="ask-base">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Ask the base</div></div>
      </div>
      ${!asked ? html`<div class="row" style=${{gap: '8px', marginTop: '10px'}}>${BASE_CHIPS.map(c => html`<button key=${c} type="button" class="chip" onClick=${() => go(c)}>${c}</button>`)}</div>` : null}
      ${asked ? html`<div class="bubble me" style=${{marginTop: '10px'}}>${asked}</div>` : null}
      ${busy || r.text ? html`<div class="bubble ai" style=${{marginTop: '8px', maxWidth: '100%'}}>${r.text ? html`<${M.AIText} text=${r.text}/>` : html`<${M.Thinking} label="Reading the base"/>`}</div>` : null}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
      <div class="ask-in" style=${{marginTop: '10px'}}>
        <input id="ask-base-input" class="input" value=${q} placeholder="Ask about anyone or any company in the base" aria-label="Ask the base"
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') go(); }}/>
        ${busy ? html`<${UI.Btn} kind="sec" onClick=${r.stop}>Stop<//>` : html`<button type="button" class="btn" disabled=${!q.trim()} onClick=${() => go()}><span class="spark">${SPARK}</span> Ask</button>`}
      </div>
    </div>`;
  }

  /* nudges: quiet leads, companies worth a pitch, clients with nobody on file */
  function BaseNudges() {
    const ctx = M.useCtx();
    const list = useMemo(() => suggestions(ctx), [ctx]);
    const body = html`<section class="card" id="base-nudges">
      <div class="card-head"><h2 class="card-title">Nudges from the base</h2></div>
      ${list.length ? list.map(s => html`<button key=${s.k} type="button" class="conn-row nudge" onClick=${() => M.nav(s.hash)}>
        <span class="spark" aria-hidden="true">${SPARK}</span><span class="t" style=${{whiteSpace: 'normal'}}>${s.text}</span>
      </button>`) : html`<${UI.Empty} text="Nothing to nudge. Every lead is warm and every client has someone on file."/>`}
    </section>`;
    return html`<${UI.Fold} title="Nudges from the base" summary=${list.length ? list.length + (list.length === 1 ? ' nudge' : ' nudges') : 'all quiet'} open=${list.length > 0} hot=${list.some(s => s.k === 'quiet')} id="fold-nudges">${body}<//>`;
  }

  M.search = {hits, rankOf, GROUPS, GROUP_LABEL, GROUP_ICON, useLog, contacts, orgs, contactById, orgById, nameOf, orgOfClient, peopleAt, clientOfPitch, connectionsOf};
  M.intel = {quietLeads, suggestions, tools, slice};
  M.parts.SearchAll = SearchAll;
  M.parts.Connections = Connections;
  M.parts.AskBase = AskBase;
  M.parts.BaseNudges = BaseNudges;
})();
