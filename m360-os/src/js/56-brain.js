/* module: brain. Everything the buddy and Ask m360 can look at and do. Two tools carry it all, so the
   set fits any host's cap: look_up(what, q) reads one area of m360 the viewer may see (tasks, a project,
   a client, the calendar, notes, the feed, chat, the handbook, hiring, scores, Radar, the books, mail,
   meetings, Drive, the Base, a web page) and act(action, input) changes things the way the person's
   own hand would (tasks, projects, notes, posts, kudos, messages, leave, check-in, EOD, the week,
   pitches, clients, reminders, bookmarks). Anything that leaves the building or decides for someone
   (mail, a meeting invite, a leave decision, a task approval) is prepared and waits for one tap.
   It also keeps what the person asked it to remember, says hello once a day, and folds a long chat
   into a short summary so the thread never runs out of room. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;

  const today = () => U.todayStr();
  const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
  const norm = s => String(s || '').toLowerCase().trim();
  const has = (hay, q) => !norm(q) || norm(hay).includes(norm(q));
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => live() ? window.M360_API(a, body || {}) : Promise.reject({code: 'unavailable', message: 'only on the team site'});
  const ymdOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const list = (xs, n) => (xs || []).slice(0, n || 40);
  const when = ts => ts ? U.fmtDay(U.ymd(new Date(ts))) + ' ' + U.hhmm(ts) : '';
  const MEMORY_MAX = 40;

  /* ---------- names and matching ---------- */
  const nameOf = (nm, uid) => (nm && nm[uid]) || 'someone';
  const tasksOf = ctx => Object.keys(ctx.coll.tasks.map).map(id => ({id, ...ctx.coll.tasks.map[id]})).filter(t => t && t.title !== undefined);
  const projectsOf = ctx => Object.keys(ctx.coll.projects.map).map(id => ({id, ...ctx.coll.projects.map[id]})).filter(p => p && p.name !== undefined);
  const clientsOf = ctx => Object.keys(ctx.coll.clients.map).map(id => ({id, ...ctx.coll.clients.map[id]})).filter(c => c && c.name !== undefined);
  const pitchesOf = ctx => Object.keys(ctx.coll.pitches.map).map(id => ({id, ...ctx.coll.pitches.map[id]})).filter(p => p && p.brand !== undefined);
  /* the best match for a typed title: exact, then starts with, then contains */
  function pick(items, q, key) {
    const s = norm(q);
    if (!s) return null;
    const val = x => norm(typeof key === 'function' ? key(x) : x[key]);
    return items.find(x => val(x) === s) || items.find(x => val(x).startsWith(s)) || items.find(x => val(x).includes(s)) || null;
  }
  const findTask = (ctx, q) => pick(tasksOf(ctx).sort((a, b) => (a.status === 'done') - (b.status === 'done')), q, 'title') || tasksOf(ctx).find(t => t.id === q) || null;
  const findProject = (ctx, q) => pick(projectsOf(ctx).filter(p => !p.archived), q, 'name') || projectsOf(ctx).find(p => p.id === q) || null;
  const findClient = (ctx, q) => pick(clientsOf(ctx), q, 'name') || clientsOf(ctx).find(c => c.id === q) || null;
  const findPitch = (ctx, q) => pick(pitchesOf(ctx), q, 'brand') || null;
  const projName = (ctx, id) => (ctx.coll.projects.map[id] || {}).name || '';
  const clientName = (ctx, id) => (ctx.coll.clients.map[id] || {}).name || '';
  const member = (ctx, uid) => ctx.members[uid] || {};

  function taskLine(ctx, t, nm) {
    const bits = [t.title, 'owner ' + nameOf(nm, t.owner), t.status];
    if (t.due) bits.push('due ' + t.due + (t.due < today() && t.status !== 'done' ? ' OVERDUE' : ''));
    if (t.priority && t.priority !== 'normal') bits.push(t.priority + ' priority');
    const p = projName(ctx, t.project); if (p) bits.push('project ' + p);
    const c = clientName(ctx, t.client); if (c) bits.push('client ' + c);
    const subs = Object.values(t.subtasks || {});
    if (subs.length) bits.push(subs.filter(s => s && s.done).length + ' of ' + subs.length + ' subtasks done');
    const cm = Object.keys(t.comments || {}).length; if (cm) bits.push(cm + (cm === 1 ? ' comment' : ' comments'));
    if (t.revisions) bits.push(t.revisions + ' revisions');
    return '- ' + bits.join(', ');
  }

  /* ---------- memory: what the person asked it to keep in mind ---------- */
  const aiPath = ctx => 'data/users/' + ctx.uid + '/ai';
  async function readAi(ctx) {
    try { const s = await ctx.db.doc(aiPath(ctx)).get(); return s && s.exists ? (s.data() || {}) : {}; } catch (e) { return {}; }
  }
  const memoryOf = doc => ((doc && doc.memory && doc.memory.items) || []).filter(x => x && x.t).map(x => ({t: String(x.t), at: Number(x.at) || 0}));
  async function remember(ctx, fact) {
    const t = cut(String(fact || '').trim().replace(/\s+/g, ' '), 200);
    if (!t) throw new Error('nothing to remember');
    const items = memoryOf(await readAi(ctx)).filter(x => norm(x.t) !== norm(t));
    items.push({t, at: Date.now()});
    await ctx.W.merge(aiPath(ctx), {memory: {items: items.slice(-MEMORY_MAX), at: Date.now()}});
    return t;
  }
  async function forget(ctx, which) {
    const q = norm(which);
    const items = memoryOf(await readAi(ctx));
    const keep = q === 'everything' || q === 'all' ? [] : items.filter(x => !norm(x.t).includes(q));
    if (keep.length === items.length) throw new Error('nothing remembered matches that');
    await ctx.W.merge(aiPath(ctx), {memory: {items: keep, at: Date.now()}});
    return items.length - keep.length;
  }
  const memoryLines = items => items.length ? 'WHAT YOU REMEMBER ABOUT THEM (they asked you to keep these in mind):\n' + items.map(x => '- ' + x.t).join('\n') : '';

  /* ---------- waiting on a tap: acts that leave the building or decide for someone ---------- */
  const pending = {list: [], subs: new Set()};
  const tell = () => pending.subs.forEach(f => { try { f(); } catch (e) { /* a view went away */ } });
  function hold(label, detail, run) {
    const id = U.uid();
    pending.list = pending.list.concat([{id, label, detail: cut(detail, 400), run, at: Date.now()}]).slice(-6);
    tell();
    return {waiting: true, label, note: 'Prepared. The person must tap "' + label + '" in the bubble to send it. Tell them it is ready and waiting on their tap.'};
  }
  function drop(id) { pending.list = pending.list.filter(p => p.id !== id); tell(); }
  async function approve(id) {
    const p = pending.list.find(x => x.id === id);
    if (!p) return;
    drop(id);
    try { await p.run(); M.toast(p.label + ': done'); } catch (e) { M.toast((e && e.message) || 'That did not go through', true); }
  }
  function PendingActs() {
    const [n, setN] = useState(0);
    useEffect(() => { const f = () => setN(x => x + 1); pending.subs.add(f); return () => { pending.subs.delete(f); }; }, []);
    if (!pending.list.length) return null;
    return html`<div class="stack tight pending-acts" data-n=${n}>
      ${pending.list.map(p => html`<div key=${p.id} class="pending-act">
        <div class="small" style=${{fontWeight: 600}}>${p.label}</div>
        ${p.detail ? html`<div class="tiny clamp3">${p.detail}</div>` : null}
        <div class="row" style=${{gap: '8px', marginTop: '6px'}}>
          <button type="button" class="btn sm" onClick=${() => approve(p.id)}>${p.label}</button>
          <button type="button" class="linky tiny" onClick=${() => drop(p.id)}>Skip</button>
        </div>
      </div>`)}
    </div>`;
  }

  /* ---------- the areas look_up reads ---------- */
  const AREAS = [
    ['me', 'my own day: check-in, open and overdue tasks, the week, the last EOD, flags'],
    ['team', 'everyone: who is in, open and overdue counts, projects, pipeline (the founder sees it all)'],
    ['tasks', 'all tasks, filtered by a word (title, owner, project, client, status)'],
    ['task', 'one task in full: subtasks, comments, link, history'],
    ['projects', 'projects with status, owner, due and progress'],
    ['project', 'one project: sections with their tasks, updates, members'],
    ['clients', 'client pages with status, owner, health and how filled in the brain is'],
    ['client', 'one client in full: memory, approvals, never, links, site, the brain'],
    ['pitches', 'the pipeline: brand, stage, owner, next step and date'],
    ['calendar', 'the next 14 days (or q days): due tasks and projects, leave, holidays, birthdays'],
    ['leave', 'leave requests and their decisions (the founder sees what is waiting)'],
    ['notes', 'private notes, the newest first, or the ones matching a word'],
    ['feed', 'the last posts and kudos on Vibe'],
    ['chat', 'rooms with unread counts; with a room or person name, the last messages there'],
    ['handbook', 'handbook sections, in full when a word matches'],
    ['hiring', 'candidates by stage, with deadlines and panel scores (founder)'],
    ['reviews', 'this week: outcomes, marks, quality, and tasks waiting in review'],
    ['scores', 'the leaderboard for a period (week, month, quarter, all) and the points behind it'],
    ['radar', 'the latest trade press on Radar, by lane (people, accounts, launches, campaigns, awards) (team site)'],
    ['books', 'invoices due and overdue, this month\'s expenses, compliance dates (owner)'],
    ['handshake', 'the LinkedIn DM desk: who is ready, held, waiting on an accept, sent, skipped, flagged'],
    ['break', 'the reset room: sparks this week, the streak, Five (the word of the day), the squads, the care reminders due'],
    ['inbox', 'what is waiting in the inbox'],
    ['online', 'who has m360 open right now and where they are'],
    ['base', 'the Base, the contacts database, for a name, company, city or stage'],
    ['who', 'one teammate: role, pod, profile, today, open tasks'],
    ['web', 'a web page read as text, q is the address (team site)'],
    ['mail', 'the Gmail inbox, q is a Gmail search (team site with Google connected)'],
    ['meetings', 'Google Calendar for the next days, q is a number of days (team site with Google connected)'],
    ['drive', 'Google Drive files whose name contains q (team site with Google connected)'],
    ['memory', 'what you have been asked to remember'],
    ['help', 'this list']
  ];
  const AREA_WHO = {hiring: 'founder', books: 'owner', radar: 'site', web: 'site'};
  function areasFor(ctx) {
    return AREAS.filter(([k]) => {
      const w = AREA_WHO[k];
      if (w === 'founder') return ctx.isFounder;
      if (w === 'owner') return ctx.isOwner;
      if (w === 'site') return live();
      return true;
    });
  }

  async function lookUp(ctx, nm, what, q) {
    const w = norm(what).replace(/[^a-z]/g, '');
    q = String(q || '').trim();
    const td = today();
    const L = [];
    switch (w) {
      case 'me': return M.ai.meSlice(ctx);
      case 'team': return cut(await M.ai.teamSlice(ctx), 12000);
      case 'tasks': {
        const all = tasksOf(ctx).filter(t => !q || has(t.title + ' ' + nameOf(nm, t.owner) + ' ' + projName(ctx, t.project) + ' ' + clientName(ctx, t.client) + ' ' + t.status + ' ' + (t.priority || ''), q));
        const open = all.filter(t => t.status !== 'done').sort((a, b) => String(a.due || '9') < String(b.due || '9') ? -1 : 1);
        const done = all.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        L.push('TASKS' + (q ? ' matching "' + q + '"' : '') + ': ' + open.length + ' open, ' + done.length + ' done');
        list(open, 40).forEach(t => L.push(taskLine(ctx, t, nm)));
        if (done.length) { L.push('DONE (latest):'); list(done, 8).forEach(t => L.push('- ' + t.title + ', ' + nameOf(nm, t.owner) + ', done ' + U.ymd(new Date(t.doneAt || t.updated || 0)))); }
        return L.join('\n');
      }
      case 'task': {
        const t = findTask(ctx, q);
        if (!t) return 'No task matches "' + q + '".';
        L.push('TASK: ' + t.title, taskLine(ctx, t, nm), 'created ' + when(t.created) + ' by ' + nameOf(nm, t.by) + (t.link ? ', link ' + t.link : ''));
        if (t.sentBackNote) L.push('sent back: ' + t.sentBackNote);
        const subs = Object.keys(t.subtasks || {}).map(k => t.subtasks[k]).filter(Boolean).sort((a, b) => (a.o || 0) - (b.o || 0));
        if (subs.length) { L.push('SUBTASKS:'); subs.forEach(s => L.push('- [' + (s.done ? 'x' : ' ') + '] ' + s.t)); }
        const cms = Object.keys(t.comments || {}).map(k => t.comments[k]).filter(Boolean).sort((a, b) => (a.at || 0) - (b.at || 0));
        if (cms.length) { L.push('COMMENTS:'); list(cms, 12).forEach(c => L.push('- ' + nameOf(nm, c.by) + ' (' + when(c.at) + '): ' + cut(c.t, 300))); }
        return L.join('\n');
      }
      case 'projects': {
        const ps = projectsOf(ctx).filter(p => !p.archived && (!q || has(p.name + ' ' + p.status + ' ' + nameOf(nm, p.owner) + ' ' + clientName(ctx, p.client), q)));
        L.push('PROJECTS: ' + ps.length);
        list(ps, 30).forEach(p => {
          const pr = M.projects && M.projects.progress ? M.projects.progress(ctx, p.id) : {done: 0, total: 0, overdue: 0};
          L.push('- ' + p.name + ', ' + (p.kind || '') + ', status ' + p.status + ', owner ' + nameOf(nm, p.owner) + (clientName(ctx, p.client) ? ', client ' + clientName(ctx, p.client) : '') + ', due ' + (p.due || 'none') + ', ' + pr.done + ' of ' + pr.total + ' tasks done, ' + pr.overdue + ' overdue');
        });
        return L.join('\n');
      }
      case 'project': {
        const p = findProject(ctx, q);
        if (!p) return 'No project matches "' + q + '".';
        L.push('PROJECT: ' + p.name + ', status ' + p.status + ', owner ' + nameOf(nm, p.owner) + ', due ' + (p.due || 'none') + ', members ' + (p.members || []).map(u => nameOf(nm, u)).join(', '));
        if (p.desc) L.push('about: ' + cut(p.desc, 600));
        const ts = tasksOf(ctx).filter(t => t.project === p.id);
        (p.sections || []).forEach(s => {
          const mine = ts.filter(t => t.section === s.id);
          L.push('SECTION ' + s.name + ' (' + mine.filter(t => t.status === 'done').length + ' of ' + mine.length + ' done):');
          list(mine, 25).forEach(t => L.push(taskLine(ctx, t, nm)));
        });
        const loose = ts.filter(t => !(p.sections || []).some(s => s.id === t.section));
        if (loose.length) { L.push('OTHER TASKS:'); list(loose, 15).forEach(t => L.push(taskLine(ctx, t, nm))); }
        const ups = Object.values(p.updates || {}).filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0));
        if (ups.length) { L.push('UPDATES:'); list(ups, 5).forEach(u => L.push('- ' + when(u.at) + ' ' + nameOf(nm, u.by) + ', ' + u.status + ': ' + cut(u.text, 240))); }
        return L.join('\n');
      }
      case 'clients': {
        const cs = clientsOf(ctx).filter(c => !q || has(c.name + ' ' + c.status + ' ' + (c.industry || '') + ' ' + nameOf(nm, c.owner), q));
        const fin = (ctx.priv.finance && ctx.priv.finance.data) || {};
        L.push('CLIENTS: ' + cs.length);
        list(cs, 40).forEach(c => {
          const comp = M.clients && M.clients.completeness ? M.clients.completeness(c) : {filled: 0, total: 0};
          const h = M.clients && M.clients.health ? M.clients.health(ctx, c.id) : {level: '', why: ''};
          const mo = ctx.isFounder ? ((fin.clients || {})[c.id] || {}).monthly : null;
          L.push('- ' + c.name + ', ' + c.status + ', owner ' + nameOf(nm, c.owner) + (c.pod ? ', pod ' + c.pod : '') + (mo ? ', ' + U.inr(mo) + ' a month' : '') + ', health ' + h.level + (h.why ? ' (' + h.why + ')' : '') + ', brain ' + comp.filled + ' of ' + comp.total + ' filled');
        });
        return L.join('\n');
      }
      case 'client': {
        const c = findClient(ctx, q);
        if (!c) return 'No client matches "' + q + '".';
        L.push('CLIENT: ' + c.name + ', ' + c.status + ', owner ' + nameOf(nm, c.owner) + (c.pod ? ', pod ' + c.pod : '') + (c.since ? ', since ' + c.since : ''));
        [['website', c.website], ['industry', c.industry], ['hq', c.hq], ['tone', c.tone], ['memory', c.memory], ['approvals', c.approvals], ['never', c.never], ['links', c.links]].forEach(([k, v]) => { if (v) L.push(k + ': ' + cut(v, 500)); });
        const soc = c.socials || {}; const sl = Object.keys(soc).filter(k => soc[k]).map(k => k + ' ' + soc[k]); if (sl.length) L.push('socials: ' + sl.join(', '));
        const b = c.brain || {};
        const keys = (M.clients && M.clients.BRAIN ? M.clients.BRAIN.map(x => x.k) : ['about', 'offers', 'audience', 'voice', 'competitors', 'moves', 'talking', 'risks', 'pitchNext']);
        if (keys.some(k => b[k])) { L.push('BRAIN:'); keys.forEach(k => { if (b[k]) L.push('- ' + k + ': ' + cut(b[k], 400)); }); }
        const open = tasksOf(ctx).filter(t => t.client === c.id && t.status !== 'done');
        L.push('OPEN TASKS: ' + open.length); list(open, 12).forEach(t => L.push(taskLine(ctx, t, nm)));
        const ps = projectsOf(ctx).filter(p => p.client === c.id && !p.archived); if (ps.length) L.push('PROJECTS: ' + ps.map(p => p.name + ' (' + p.status + ')').join('; '));
        return L.join('\n');
      }
      case 'pitches': case 'pipeline': {
        const fin = (ctx.priv.finance && ctx.priv.finance.data) || {};
        const ps = pitchesOf(ctx).filter(p => !q || has(p.brand + ' ' + p.stage + ' ' + nameOf(nm, p.owner), q));
        const m = ctx.isFounder && M.pitches && M.pitches.metrics ? M.pitches.metrics(ctx) : null;
        L.push('PIPELINE: ' + ps.length + ' pitches' + (m ? ', weighted ' + U.inr(m.weighted) + ' a month, win rate 90 days ' + (m.winRate90 == null ? 'n/a' : m.winRate90 + '%') : ''));
        list(ps, 40).forEach(p => {
          const fe = (fin.pitch || {})[p.id] || {};
          L.push('- ' + p.brand + ', stage ' + p.stage + ', owner ' + nameOf(nm, p.owner) + (p.category ? ', ' + p.category : '') + (ctx.isFounder && fe.value ? ', ' + U.inr(fe.value) + ' a month' : '') + (p.next ? ', next: ' + p.next + ' by ' + (p.nextDate || 'no date') + (p.nextDate && p.nextDate < td ? ' OVERDUE' : '') : ', no next step') + (p.lost ? ', lost: ' + p.lost : ''));
        });
        return L.join('\n');
      }
      case 'calendar': {
        const days = Math.max(1, Math.min(60, Number(q) || 14));
        const start = new Date();
        const ts = tasksOf(ctx).filter(t => t.status !== 'done' && t.due);
        const ps = projectsOf(ctx).filter(p => !p.archived && p.due);
        const hol = (ctx.settings.holidays || []);
        L.push('CALENDAR, the next ' + days + ' days:');
        for (let i = 0; i < days; i++) {
          const d = U.ymd(U.addDays(start, i));
          const bits = [];
          if (hol.indexOf(d) >= 0) bits.push('holiday' + (M.holidays && M.holidays.nameOf ? ' ' + (M.holidays.nameOf(d) || '') : ''));
          ts.filter(t => t.due === d).forEach(t => bits.push('task due: ' + t.title + ' (' + nameOf(nm, t.owner) + ')'));
          ps.filter(p => p.due === d).forEach(p => bits.push('project due: ' + p.name));
          ctx.activeMembers.forEach(mb => { if (ctx.onLeave && ctx.onLeave(mb.uid, d)) bits.push(nameOf(nm, mb.uid) + ' on leave'); });
          if (M.trophies && M.trophies.celebrations) M.trophies.celebrations(ctx, d).forEach(c => bits.push(nameOf(nm, c.uid) + ': ' + c.text));
          if (bits.length) L.push('- ' + U.fmtDay(d) + (d === td ? ' (today)' : '') + ': ' + bits.join('; '));
        }
        if (L.length === 1) L.push('- nothing dated in this window');
        return L.join('\n');
      }
      case 'leave': {
        const dec = uid => (ctx.coll.leavedec.map[uid] || {}).d || {};
        const reqs = uid => ((ctx.coll.leave.map[uid] || {}).reqs || []);
        const line = (uid, r) => '- ' + nameOf(nm, uid) + ': ' + r.from + ' to ' + r.to + ', ' + r.type + ', ' + ((dec(uid)[r.id] || {}).status || 'pending') + ', asked ' + when(r.at);
        if (ctx.isFounder) {
          const pend = M.leave && M.leave.pending ? M.leave.pending(ctx) : [];
          L.push('LEAVE WAITING ON A DECISION: ' + pend.length); pend.forEach(x => L.push(line(x.uid, x.req)));
          L.push('RECENT REQUESTS:'); ctx.activeMembers.forEach(mb => list(reqs(mb.uid), 3).forEach(r => L.push(line(mb.uid, r))));
        } else {
          L.push('MY LEAVE REQUESTS:'); list(reqs(ctx.uid), 12).forEach(r => L.push(line(ctx.uid, r)));
          if (L.length === 1) L.push('- none yet');
        }
        return L.join('\n');
      }
      case 'notes': {
        const idx = await ctx.db.doc('data/users/' + ctx.uid + '/notes').get().then(s => s && s.exists ? (s.data() || {}) : {}).catch(() => ({}));
        const items = Object.keys(idx.items || {}).map(id => ({id, ...idx.items[id]})).filter(n => !n.gone).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
        const want = q ? items.filter(n => has(n.title, q)) : items;
        L.push('NOTES: ' + items.length + (q ? ', ' + want.length + ' with "' + q + '" in the title' : ''));
        const open = list(want, q ? 4 : 3);
        for (const n of open) {
          const body = await ctx.db.doc('data/users/' + ctx.uid + '/note.' + n.id).get().then(s => s && s.exists ? (s.data() || {}).text || '' : '').catch(() => '');
          L.push('- ' + (n.title || 'untitled') + (n.pinned ? ' (pinned)' : '') + ', ' + when(n.updated) + ':\n  ' + cut(body, q ? 700 : 300).replace(/\n/g, '\n  '));
        }
        list(want.slice(open.length), 30).forEach(n => L.push('- ' + (n.title || 'untitled') + ', ' + when(n.updated)));
        return L.join('\n');
      }
      case 'feed': case 'vibe': {
        const st = M.feed && M.feed.stream ? M.feed.stream(ctx) : [];
        L.push('VIBE, the latest:');
        list(st.filter(it => !q || has(it.text + ' ' + (it.why || ''), q)), 15).forEach(it => {
          if (it.type === 'kudos') L.push('- kudos from ' + nameOf(nm, it.giver) + ' to ' + nameOf(nm, it.to) + ' (' + when(it.at) + '): ' + cut(it.why, 200));
          else L.push('- ' + it.kind + ' by ' + nameOf(nm, it.author) + ' (' + when(it.at) + ')' + (it.pinned ? ', pinned' : '') + ': ' + cut(it.text, 240) + (it.options ? ' [poll: ' + it.options.join(' / ') + ']' : '') + (it.link ? ' ' + it.link : ''));
        });
        if (L.length === 1) L.push('- nothing yet');
        return L.join('\n');
      }
      case 'chat': {
        if (!M.rooms) return 'Chat is not on this build.';
        const rooms = M.rooms.roomsOf(ctx);
        const dmRoom = () => { const u = M.ai.findMember(ctx, nm, q); return u && u !== ctx.uid ? M.rooms.dmId(ctx.uid, u) : null; };
        const room = q ? (rooms.find(r => norm(r.name) === norm(q) || r.id === norm(q)) || rooms.find(r => has(r.name, q)) || null) : null;
        const id = room ? room.id : dmRoom();
        if (id) {
          const ms = M.rooms.messagesOf(ctx, id).filter(m => !m.del);
          L.push('CHAT in ' + (room ? room.name : 'the DM with ' + nameOf(nm, M.rooms.dmOther(id, ctx.uid))) + ', the last ' + Math.min(15, ms.length) + ' of ' + ms.length + ':');
          ms.slice(-15).forEach(m => L.push('- ' + nameOf(nm, m.by) + ' (' + when(m.at) + '): ' + cut(m.text, 300) + (m.files && m.files.length ? ' [' + m.files.length + ' files]' : '')));
          return L.join('\n');
        }
        L.push('ROOMS:');
        rooms.forEach(r => L.push('- ' + r.name + (r.topic ? ' (' + r.topic + ')' : '') + ', unread ' + M.rooms.unreadIn(ctx, r.id)));
        const dms = ctx.activeMembers.filter(mb => mb.uid !== ctx.uid).map(mb => ({mb, n: M.rooms.unreadIn(ctx, M.rooms.dmId(ctx.uid, mb.uid))})).filter(x => x.n > 0);
        if (dms.length) L.push('UNREAD DMs: ' + dms.map(x => nameOf(nm, x.mb.uid) + ' ' + x.n).join(', '));
        return L.join('\n');
      }
      case 'handbook': {
        const secs = M.handbook && M.handbook.sections ? M.handbook.sections(ctx) : [];
        const fill = t => M.handbook && M.handbook.fillTokens ? M.handbook.fillTokens(t, ctx.settings) : t;
        const hit = q ? secs.filter(s => has(s.title + ' ' + s.body, q)) : [];
        if (hit.length) { list(hit, 3).forEach(s => L.push('HANDBOOK, ' + s.title + ':\n' + cut(fill(s.body), 2500))); return L.join('\n\n'); }
        L.push('HANDBOOK SECTIONS: ' + secs.length + (q ? ', none mention "' + q + '"' : ''));
        secs.forEach(s => L.push('- ' + s.title + ': ' + cut(fill(s.body).replace(/\s+/g, ' '), 140)));
        return L.join('\n');
      }
      case 'hiring': {
        if (!ctx.isFounder || !M.hiring) return 'Hiring is for the founder.';
        const cs = M.hiring.candidatesOf(ctx).filter(c => !q || has(c.name + ' ' + c.role + ' ' + c.stage, q));
        L.push('CANDIDATES: ' + cs.length);
        list(cs, 30).forEach(c => { const s = M.hiring.summary(ctx, c); L.push('- ' + c.name + ', ' + (c.role || '') + ', stage ' + c.stage + (c.deadline ? ', deadline ' + c.deadline : '') + ', panel ' + (c.evaluators || []).map(u => nameOf(nm, u)).join(', ') + ', ' + s.subs + ' of ' + s.n + ' scored' + (s.avg ? ', avg ' + s.avg : '') + (c.decision ? ', decision ' + c.decision : '')); });
        return L.join('\n');
      }
      case 'reviews': case 'week': {
        const wk = U.isoWeek(new Date());
        const who = ctx.isFounder ? ctx.activeMembers.map(m => m.uid) : [ctx.uid];
        L.push('THE WEEK ' + wk + ':');
        who.forEach(uid => {
          const plan = (((ctx.coll.plan.map[uid] || {}).weeks || {})[wk] || {}).items || [];
          const rev = (((ctx.coll.review.map[uid] || {}).weeks || {})[wk]) || {};
          L.push('- ' + nameOf(nm, uid) + ': ' + (plan.length ? plan.map(p => p.text + ((rev.marks || {})[p.id] ? ' [' + rev.marks[p.id] + ']' : '')).join('; ') : 'no outcomes set') + (rev.at ? ', reviewed' + (rev.quality ? ', quality ' + rev.quality + ' of 5' : '') + (rev.note ? ', note: ' + cut(rev.note, 160) : '') : ', not reviewed yet'));
        });
        const qu = M.reviews && M.reviews.queue ? M.reviews.queue(ctx).filter(t => M.reviews.canReview(ctx, t)) : [];
        if (qu.length) { L.push('WAITING IN REVIEW (yours to approve or send back): ' + qu.length); list(qu, 12).forEach(t => L.push(taskLine(ctx, t, nm))); }
        return L.join('\n');
      }
      case 'scores': case 'leaderboard': case 'points': {
        if (!M.points) return 'Points are not on this build.';
        const period = ['week', 'month', 'quarter', 'all'].indexOf(norm(q)) >= 0 ? norm(q) : 'week';
        const br = M.points.boardRange(ctx, period);
        const rows = M.points.leaderboard(ctx, period);
        L.push('LEADERBOARD, ' + (br.label || period) + ':');
        rows.forEach((r, i) => { L.push('- ' + (i + 1) + '. ' + nameOf(nm, r.uid) + ': ' + r.total + ' points' + (r.pace != null ? ', pace ' + r.pace + ' a day' : '') + (r.partial ? ' (joined ' + (r.joined || 'this period') + ')' : '') + (ctx.canSee(r.uid) ? ', output ' + r.output + ', discipline ' + r.discipline : '')); });
        const mine = M.points.pointsFor(ctx, ctx.uid, br.from, br.to);
        if (mine && mine.parts) L.push('MY POINTS IN DETAIL: ' + Object.keys(mine.parts).map(k => k + ' ' + mine.parts[k]).join(', '));
        return L.join('\n');
      }
      case 'radar': case 'news': {
        if (!live()) return 'Radar reads the press on the team site only.';
        const d = await api('news', {});
        let items = (d.items || []).map(it => M.radar && M.radar.enrich ? M.radar.enrich(it) : it);
        const lane = norm(q);
        if (lane && lane !== 'all') items = items.filter(it => (it.lane || '') === lane || has(it.title + ' ' + (it.summary || ''), q));
        L.push('RADAR' + (lane ? ' (' + lane + ')' : '') + ', ' + items.length + ' stories, latest first:');
        list(items.sort((a, b) => (b.at || 0) - (a.at || 0)), 18).forEach(it => L.push('- ' + cut(it.title, 140) + ' (' + (it.source || '') + (it.lane ? ', ' + it.lane : '') + (it.india ? ', India' : '') + ', ' + (it.at ? U.timeAgo(it.at) : '') + ') ' + (it.link || '')));
        return L.join('\n');
      }
      case 'books': case 'invoices': case 'money': {
        if (!ctx.isOwner || !M.books) return 'The books are the owner\'s alone.';
        const b = M.books;
        const inv = b.invoices(ctx);
        const open = inv.filter(i => ['sent', 'overdue', 'part'].indexOf(b.status(i, td)) >= 0);
        L.push('INVOICES OPEN: ' + open.length + ', total due ' + b.money(open.reduce((n, i) => n + b.totals(i).balance, 0), 'INR'));
        list(open.sort((a, c) => String(a.due) < String(c.due) ? -1 : 1), 25).forEach(i => L.push('- ' + i.no + ' ' + (i.clientName || '') + ', ' + b.money(b.totals(i).balance, i.currency) + ' due ' + i.due + ', ' + b.status(i, td) + (b.ageOf && b.status(i, td) === 'overdue' ? ', ' + b.ageOf(i, td) + ' days late' : '')));
        const drafts = inv.filter(i => b.status(i, td) === 'draft'); if (drafts.length) L.push('DRAFTS: ' + drafts.map(i => i.no + ' ' + (i.clientName || '')).join('; '));
        const ex = (b.expenses(ctx) || []).filter(e => String(e.date || '').slice(0, 7) === td.slice(0, 7));
        L.push('EXPENSES THIS MONTH: ' + ex.length + ' rows, ' + b.money(ex.reduce((n, e) => n + (Number(e.amount) || 0), 0), 'INR'));
        const nd = b.nextDates ? b.nextDates(ctx, td) : [];
        if (nd && nd.length) L.push('COMPLIANCE NEXT: ' + list(nd, 6).map(x => x.what + ' on ' + x.date).join('; '));
        return L.join('\n');
      }
      case 'handshake': case 'dm': case 'dms': {
        if (!M.handshake) return 'The DM desk is not on this build.';
        const ps = M.handshake.people(ctx).filter(p => !q || has(p.name + ' ' + p.company + ' ' + p.headline + ' ' + p.state, q));
        const st = {};
        ps.forEach(p => { st[p.state] = (st[p.state] || 0) + 1; });
        L.push('HANDSHAKE: ' + ps.length + ' people, ' + Object.keys(st).map(k => st[k] + ' ' + k).join(', '));
        list(ps.filter(p => p.state !== 'sent').sort((a, b) => (b.updated || 0) - (a.updated || 0)), 25).forEach(p => L.push('- ' + p.name + ', ' + (p.headline || '') + (p.company ? ' at ' + p.company : '') + ', ' + (p.bucket || 'unsorted') + ', ' + p.state + (p.hook && p.hook.line ? ', hook: ' + cut(p.hook.line, 100) : '') + (p.flags && p.flags.length ? ', FLAGS: ' + p.flags.join('; ') : '')));
        return L.join('\n');
      }
      case 'break': case 'play': case 'wellness': {
        if (!M.play) return 'The reset room is not on this build.';
        const me = M.play.mine(ctx);
        L.push('BREAK: ' + me.week + ' sparks this week (last week ' + me.lastWeek + ', ' + me.sparks + ' ever), level ' + me.level.name + ' (' + me.level.weeks + ' weeks shown up), workday streak ' + me.streak + ' (best ' + me.best + '), today: ' + (Object.keys(me.today).join(', ') || 'nothing yet'));
        const d = M.play.docOf(ctx); const f = ((d.days || {})[td] || {}).five; L.push('FIVE (the word of the day): ' + (f ? (f.tries <= 6 ? 'got it in ' + f.tries + ' tries, ' + M.play.fmtMs(f.ms) : 'missed it today') : 'not played yet'));
        L.push('SQUADS THIS WEEK: ' + M.play.squadBoard(ctx).map(s => s.name + ' ' + s.week + (s.mine ? ' (mine)' : '')).join('; '));
        return L.join('\n');
      }
      case 'inbox': {
        const items = M.inbox && M.inbox.items ? M.inbox.items(ctx) : [];
        const seen = M.inbox && M.inbox.seenAt ? M.inbox.seenAt(ctx) : 0;
        L.push('INBOX: ' + items.filter(i => i.at > seen).length + ' unread of ' + items.length);
        list(items, 20).forEach(i => L.push('- ' + (i.at > seen ? 'NEW ' : '') + (i.hot ? 'HOT ' : '') + (typeof i.plain === 'function' ? i.plain(u => nameOf(nm, u)) : cut(i.plain || i.text, 200)) + ' (' + when(i.at) + ')'));
        return L.join('\n');
      }
      case 'online': {
        const on = ctx.online || {};
        const here = ctx.activeMembers.filter(m => on[m.uid]);
        return 'ONLINE NOW: ' + (here.length ? here.map(m => nameOf(nm, m.uid) + ' on ' + (on[m.uid].page || 'home')).join(', ') : 'nobody else') + '. NOT OPEN: ' + ctx.activeMembers.filter(m => !on[m.uid]).map(m => nameOf(nm, m.uid)).join(', ');
      }
      case 'base': case 'contacts': return M.intel && M.intel.slice ? cut(M.intel.slice(ctx, q, nm), 8000) : 'The Base is not on this build.';
      case 'who': {
        const uid = M.ai.findMember(ctx, nm, q);
        if (!uid) return 'No teammate matches "' + q + '".';
        const m = member(ctx, uid);
        const pf = M.profile && M.profile.of ? M.profile.of(ctx, uid) : {};
        const a = M.att && M.att.dayStatus ? M.att.dayStatus(ctx, uid, td) : {status: 'none'};
        const open = tasksOf(ctx).filter(t => t.owner === uid && t.status !== 'done');
        L.push('WHO: ' + nameOf(nm, uid) + ', ' + (m.title || m.role || '') + (m.pod ? ', pod ' + m.pod : '') + (m.joined ? ', joined ' + m.joined : '') + (m.role === 'founder' ? ', the founder' : ''));
        ['pronouns', 'city', 'bio', 'askMe', 'fact', 'birthday'].forEach(k => { if (pf[k]) L.push(k + ': ' + pf[k]); });
        if (ctx.canSee(uid) && pf.phone) L.push('phone: ' + pf.phone);
        L.push('today: ' + (a.in ? a.status + ' from ' + U.hhmm(a.in) + (a.out ? ' to ' + U.hhmm(a.out) : '') : a.status === 'leave' ? 'on leave' : 'not in yet') + (ctx.online && ctx.online[uid] ? ', online now' : ''));
        L.push('OPEN TASKS: ' + open.length + ', overdue ' + open.filter(t => t.due && t.due < td).length); list(open, 10).forEach(t => L.push(taskLine(ctx, t, nm)));
        return L.join('\n');
      }
      case 'web': case 'page': case 'url': {
        if (!live()) return 'Reading a page works on the team site only. Answer from what you know and say so.';
        if (!/^https?:\/\//i.test(q)) q = 'https://' + q.replace(/^\/+/, '');
        const r = await api('readpage', {url: q});
        return 'PAGE ' + (r.title || '') + ' (' + (r.finalUrl || q) + '):\n' + cut(r.text, 7000) + (r.links && r.links.length ? '\nLINKS: ' + list(r.links, 15).map(l => l.label + ' ' + l.href).join('; ') : '');
      }
      case 'mail': case 'gmail': case 'email': {
        if (live()) {
          const r = await api('gmail', {q: q || 'in:inbox', max: 12, pageToken: ''});
          L.push('MAIL' + (q ? ' for "' + q + '"' : ', inbox') + ': ' + (r.messages || []).length + ' shown of about ' + (r.estimate || 0));
          (r.messages || []).forEach(m => L.push('- ' + (m.unread ? 'UNREAD ' : '') + (m.fromName || m.fromAddress || m.from || '') + ': ' + cut(m.subject, 120) + ' (' + (m.date || when(m.at)) + '): ' + cut(m.snippet, 160)));
          return L.join('\n');
        }
        if (ctx.mcp && ctx.mcp.callTool) {
          const r = await ctx.mcp.callTool('Gmail', 'search_threads', {query: q || 'in:inbox', pageSize: 8, view: 'THREAD_VIEW_MINIMAL'});
          const p = (r && r.payload) || r || {};
          L.push('MAIL' + (q ? ' for "' + q + '"' : ', inbox') + ':');
          (p.threads || []).forEach(t => { const m = (t.messages || [])[0] || {}; L.push('- ' + (m.sender || '') + ': ' + cut(m.subject, 120) + ' (' + (m.date || '') + ')'); });
          return L.join('\n');
        }
        return 'Mail is not connected here.';
      }
      case 'meetings': case 'gcal': case 'events': {
        const days = Math.max(1, Math.min(30, Number(q) || 7));
        const from = new Date(); from.setHours(0, 0, 0, 0);
        const to = U.addDays(from, days);
        if (live()) {
          const r = await api('gcal', {from: from.toISOString(), to: to.toISOString()});
          L.push('MEETINGS, the next ' + days + ' days: ' + (r.events || []).length);
          (r.events || []).forEach(e => L.push('- ' + (e.allDay ? String(e.start).slice(0, 10) + ' all day' : when(new Date(e.start).getTime())) + ': ' + cut(e.title, 120) + (e.location ? ' at ' + cut(e.location, 60) : '') + (e.meet ? ' (Meet)' : '') + (e.attendees && e.attendees.length ? ', with ' + e.attendees.slice(0, 5).map(a => a.name || a.addr).join(', ') : '') + (e.myStatus ? ', you ' + e.myStatus : '')));
          return L.join('\n');
        }
        if (ctx.mcp && ctx.mcp.callTool) {
          const r = await ctx.mcp.callTool('Google Calendar', 'list_events', {startTime: U.isoLocal(from), endTime: U.isoLocal(to), orderBy: 'startTime', pageSize: 20});
          const p = (r && r.payload) || r || {};
          L.push('MEETINGS, the next ' + days + ' days:');
          (p.events || []).forEach(e => L.push('- ' + ((e.start && (e.start.dateTime || e.start.date)) || '') + ': ' + cut(e.summary, 120) + (e.conferenceUrl ? ' (video)' : '')));
          return L.join('\n');
        }
        return 'Google Calendar is not connected here.';
      }
      case 'drive': case 'files': {
        if (live()) {
          const r = await api('gdrive', {q: q || ''});
          L.push('DRIVE' + (q ? ' files with "' + q + '"' : '') + ': ' + (r.files || []).length);
          (r.files || []).forEach(f => L.push('- ' + cut(f.name, 120) + ' (' + (f.mime || '').split('.').pop() + ', ' + (f.modified || '') + ') ' + (f.link || '')));
          return L.join('\n');
        }
        if (ctx.mcp && ctx.mcp.callTool) {
          const r = await ctx.mcp.callTool('Google Drive', 'list_recent_files', {orderBy: 'recency', pageSize: 10, excludeContentSnippets: true});
          const p = (r && r.payload) || r || {};
          L.push('DRIVE, recent:');
          (p.files || []).filter(f => !q || has(f.title, q)).forEach(f => L.push('- ' + cut(f.title, 120) + ' (' + (f.modifiedTime || '') + ') ' + (f.viewUrl || '')));
          return L.join('\n');
        }
        return 'Google Drive is not connected here.';
      }
      case 'memory': { const items = memoryOf(await readAi(ctx)); return items.length ? 'REMEMBERED:\n' + items.map(x => '- ' + x.t + ' (since ' + U.ymd(new Date(x.at)) + ')').join('\n') : 'Nothing remembered yet.'; }
      case 'help': case '': return catalog(ctx);
      default: return 'Unknown area "' + what + '". ' + catalog(ctx);
    }
  }

  /* ---------- the actions act runs ---------- */
  const ACTIONS = [
    ['create_task', '{title, owner?, due? YYYY-MM-DD, priority? low|normal|high, project?, client?, subtasks? [text], link?}', 'a task, assigned'],
    ['update_task', '{task, title?, due?, priority?, project?, client?, link?, owner?}', 'change a task'],
    ['set_task_status', '{task, status todo|doing|review|done}', 'move a task'],
    ['reassign_task', '{task, owner}', 'hand a task to someone'],
    ['add_subtask', '{task, text}', 'a subtask'],
    ['tick_subtask', '{task, subtask, done? true}', 'tick or untick a subtask'],
    ['comment_task', '{task, text}', 'a comment on a task, @Name mentions people'],
    ['approve_task', '{task}', 'approve a task in review (waits for a tap)'],
    ['send_back_task', '{task, note}', 'send a task in review back (waits for a tap)'],
    ['create_project', '{name, kind? client|pitch|internal, client?, owner?, due?}', 'a project with its sections'],
    ['project_update', '{project, status on|risk|off|done, text}', 'a status update on a project'],
    ['create_note', '{text}', 'a private note, first line is the title'],
    ['append_note', '{note, text}', 'add lines to a private note, matched by title'],
    ['post_to_feed', '{kind update|win|question|poll|announce, text, options? [..]}', 'a post on Vibe (announce is the founder\'s)'],
    ['give_kudos', '{to, why}', 'kudos to a teammate, three a week'],
    ['send_message', '{to, text}', 'a chat message to a room name or a person (a DM)'],
    ['create_room', '{name, topic?}', 'a chat room'],
    ['request_leave', '{from, to, type casual|sick|swap|other}', 'a leave request'],
    ['decide_leave', '{person, from?, status approved|declined}', 'decide a leave request (founder, waits for a tap)'],
    ['check_in', '{mode office|wfh, place? Office|Client site|Home|Travelling, mood? 1..5}', 'check in for today'],
    ['check_out', '{}', 'check out for today'],
    ['file_eod', '{shipped, next?, blocked?}', 'the end of day line'],
    ['set_week_outcomes', '{items [up to 3 lines]}', 'this week\'s outcomes'],
    ['create_pitch', '{brand, category?, contact?, source?, owner?}', 'a pitch in the pipeline'],
    ['move_pitch', '{pitch, stage? lead|qualified|diagnostic|proposal|negotiation|won|lost, next?, nextDate?, lost?}', 'move a pitch or set its next step'],
    ['update_client', '{client, field, value}', 'set a client field: memory, approvals, never, links, website, industry, hq, tone, or a brain key (about, offers, audience, voice, competitors, moves, talking, risks, pitchNext)'],
    ['remind_me', '{text, when YYYY-MM-DD}', 'a reminder, kept as a task on that day'],
    ['remember', '{fact}', 'keep a fact about them in mind for every future chat'],
    ['forget', '{fact}', 'drop a remembered fact (or "everything")'],
    ['save_bookmark', '{url, title?}', 'a bookmark for the team browser'],
    ['open_web', '{url}', 'open a page in the browser inside m360'],
    ['send_mail', '{to, subject, text, cc?}', 'an email from their Gmail (team site, waits for a tap)'],
    ['add_meeting', '{title, start ISO, end ISO, attendees? [emails], description?, meet? true}', 'a Google Calendar event (team site, waits for a tap)']
  ];
  const ACTION_WHO = {decide_leave: 'founder', send_mail: 'site', add_meeting: 'site'};
  function actionsFor(ctx) {
    return ACTIONS.filter(([k]) => {
      const w = ACTION_WHO[k];
      if (w === 'founder') return ctx.isFounder;
      if (w === 'site') return live();
      return true;
    });
  }

  async function act(ctx, nm, log, action, input) {
    input = input && typeof input === 'object' ? input : {};
    const say = t => { if (log) log(t); };
    const a = norm(action).replace(/[^a-z_]/g, '');
    const now = Date.now();
    const uid = ctx.uid;
    const needTask = () => { const t = findTask(ctx, input.task); if (!t) throw new Error('no task matches "' + input.task + '"'); return t; };
    const who = (typed, fallback) => { const u = M.ai.findMember(ctx, nm, typed); if (!u && typed) throw new Error('no teammate called ' + typed); return u || fallback; };
    switch (a) {
      case 'create_task': {
        const title = cut(String(input.title || '').trim(), 140);
        if (!title) throw new Error('a title is needed');
        const owner = who(input.owner, uid);
        const p = input.project ? findProject(ctx, input.project) : null;
        const c = input.client ? findClient(ctx, input.client) : null;
        const due = ymdOk(input.due) ? input.due : '';
        const subtasks = {};
        (Array.isArray(input.subtasks) ? input.subtasks : []).slice(0, 12).forEach((t, i) => { const s = cut(String(t || '').trim(), 140); if (s) subtasks[U.uid()] = {t: s, done: false, o: now + i}; });
        const id = U.uid();
        await ctx.W.set('tasks/' + id, {title, owner, client: (c && c.id) || (p && p.client) || '', project: (p && p.id) || '', section: (p && p.sections && p.sections[0] && p.sections[0].id) || '',
          due, status: 'todo', priority: ['low', 'normal', 'high'].indexOf(input.priority) >= 0 ? input.priority : 'normal',
          link: cut(String(input.link || '').trim(), 400), revisions: 0, shown20: false, subtasks, comments: {}, by: uid, created: now, updated: now, doneAt: null});
        say('Created "' + title + '" for ' + nameOf(nm, owner) + (due ? ', due ' + U.fmtDay(due) : ''));
        return {ok: true, task: title, owner: nameOf(nm, owner), due: due || null, project: p ? p.name : null};
      }
      case 'update_task': {
        const t = needTask();
        if (t.owner !== uid && t.by !== uid && !ctx.isFounder) throw new Error('only the owner, the person who made it or the founder can change this task');
        const patch = {updated: now};
        if (input.title) patch.title = cut(String(input.title).trim(), 140);
        if (input.due !== undefined) { if (input.due && !ymdOk(input.due)) throw new Error('due must be YYYY-MM-DD'); patch.due = input.due || ''; }
        if (input.priority) { if (['low', 'normal', 'high'].indexOf(input.priority) < 0) throw new Error('priority is low, normal or high'); patch.priority = input.priority; }
        if (input.link !== undefined) patch.link = cut(String(input.link || '').trim(), 400);
        if (input.project) { const p = findProject(ctx, input.project); if (!p) throw new Error('no project matches ' + input.project); patch.project = p.id; patch.section = (p.sections && p.sections[0] && p.sections[0].id) || ''; if (p.client) patch.client = p.client; }
        if (input.client) { const c = findClient(ctx, input.client); if (!c) throw new Error('no client matches ' + input.client); patch.client = c.id; }
        if (input.owner) patch.owner = who(input.owner, t.owner);
        await ctx.W.update('tasks/' + t.id, patch);
        say('Updated "' + t.title + '"');
        return {ok: true, task: patch.title || t.title, changed: Object.keys(patch).filter(k => k !== 'updated')};
      }
      case 'set_task_status': {
        const t = needTask();
        if (t.owner !== uid && !ctx.isFounder) throw new Error('only the owner or the founder can move this task');
        const st = ['todo', 'doing', 'review', 'done'].indexOf(input.status) >= 0 ? input.status : null;
        if (!st) throw new Error('status is todo, doing, review or done');
        const sp = M.tasks && M.tasks.statusPatch ? M.tasks.statusPatch(t, st, uid, ctx) : {patch: {status: st, updated: now, doneAt: st === 'done' ? now : null}, status: st};
        if (M.tasks && M.tasks.commit) await M.tasks.commit(ctx, t.id, sp); else await ctx.W.update('tasks/' + t.id, sp.patch);
        say(sp.status !== st ? 'Sent "' + t.title + '" for sign-off' : 'Moved "' + t.title + '" to ' + st);
        return {ok: true, task: t.title, status: sp.status, note: sp.status !== st ? 'done needs a sign-off from the founder or someone on the project; it is in review' : undefined};
      }
      case 'reassign_task': {
        const t = needTask();
        const owner = who(input.owner, null);
        if (!owner) throw new Error('say who should own it');
        await ctx.W.update('tasks/' + t.id, {owner, updated: now});
        say('Handed "' + t.title + '" to ' + nameOf(nm, owner));
        return {ok: true, task: t.title, owner: nameOf(nm, owner)};
      }
      case 'add_subtask': {
        const t = needTask();
        const text = cut(String(input.text || '').trim(), 140);
        if (!text) throw new Error('the subtask needs text');
        await ctx.W.update('tasks/' + t.id, {subtasks: {[U.uid()]: {t: text, done: false, o: now}}, updated: now});
        say('Added a subtask to "' + t.title + '"');
        return {ok: true, task: t.title, subtask: text};
      }
      case 'tick_subtask': {
        const t = needTask();
        const subs = Object.keys(t.subtasks || {}).map(k => ({id: k, ...t.subtasks[k]}));
        const s = pick(subs, input.subtask, 't');
        if (!s) throw new Error('no subtask matches "' + input.subtask + '" on "' + t.title + '"');
        const done = input.done === undefined ? true : !!input.done;
        await ctx.W.update('tasks/' + t.id, {subtasks: {[s.id]: {done}}, updated: now});
        say((done ? 'Ticked ' : 'Unticked ') + '"' + s.t + '"');
        return {ok: true, task: t.title, subtask: s.t, done};
      }
      case 'comment_task': {
        const t = needTask();
        const text = cut(String(input.text || '').trim(), 1000);
        if (!text) throw new Error('the comment needs text');
        const mentions = ctx.activeMembers.filter(m => { const n = String(nm[m.uid] || ''); return n && (text.includes('@' + n) || text.includes('@' + n.split(' ')[0])); }).map(m => m.uid);
        await ctx.W.update('tasks/' + t.id, {comments: {[U.uid()]: {by: uid, t: text, at: now, mentions}}, updated: now});
        say('Commented on "' + t.title + '"');
        return {ok: true, task: t.title, mentioned: mentions.map(u => nameOf(nm, u))};
      }
      case 'approve_task': case 'send_back_task': {
        const t = needTask();
        if (t.status !== 'review') throw new Error('"' + t.title + '" is not in review');
        if (!(M.reviews && M.reviews.canReview(ctx, t))) throw new Error('only someone on the project, not the task\'s owner, reviews this one');
        if (a === 'approve_task') return hold('Approve "' + cut(t.title, 40) + '"', 'Marks it done, approved by you.', () => ctx.W.update('tasks/' + t.id, {status: 'done', doneAt: Date.now(), approvedBy: uid, approvedAt: Date.now(), updated: Date.now()}).then(() => M.tasks.sign(ctx, t.id)));
        const note = cut(String(input.note || '').trim(), 240);
        return hold('Send back "' + cut(t.title, 40) + '"', note || 'No note.', () => {
          const n = Date.now();
          const patch = {status: 'doing', revisions: (Number(t.revisions) || 0) + 1, sentBackAt: n, sentBackBy: uid, sentBackNote: note, updated: n};
          if (note) patch.comments = {[U.uid()]: {by: uid, t: 'Sent back: ' + note, at: n}};
          return ctx.W.update('tasks/' + t.id, patch);
        });
      }
      case 'create_project': {
        if (!M.projects || !M.projects.create) throw new Error('projects are not on this build');
        const name = cut(String(input.name || '').trim(), 80);
        if (!name) throw new Error('a name is needed');
        const c = input.client ? findClient(ctx, input.client) : null;
        const kind = ['client', 'pitch', 'internal'].indexOf(input.kind) >= 0 ? input.kind : (c ? 'client' : 'internal');
        const id = M.projects.create(ctx, {name, kind, template: kind === 'client' ? 'retainer' : kind === 'pitch' ? 'pitch' : 'campaign', client: c ? c.id : '', owner: who(input.owner, uid), due: ymdOk(input.due) ? input.due : ''});
        say('Made the project "' + name + '"');
        return {ok: true, project: name, id};
      }
      case 'project_update': {
        const p = findProject(ctx, input.project);
        if (!p) throw new Error('no project matches "' + input.project + '"');
        const status = ['on', 'risk', 'off', 'done'].indexOf(input.status) >= 0 ? input.status : p.status;
        const text = cut(String(input.text || '').trim(), 600);
        if (!text) throw new Error('the update needs text');
        await ctx.W.update('projects/' + p.id, {status, updates: {[U.uid()]: {by: uid, status, text, at: now}}});
        say('Posted an update on "' + p.name + '"');
        return {ok: true, project: p.name, status};
      }
      case 'create_note': {
        const text = cut(String(input.text || '').trim(), 60000);
        if (!text) throw new Error('the note needs text');
        const id = U.uid();
        const title = cut((text.split('\n').map(l => l.trim()).find(Boolean) || ''), 80);
        await ctx.W.merge('data/users/' + uid + '/notes', {items: {[id]: {title, updated: now, at: now}}});
        await ctx.W.set('data/users/' + uid + '/note.' + id, {text, updated: now});
        say('Wrote the note "' + title + '"');
        return {ok: true, note: title};
      }
      case 'append_note': {
        const idx = await ctx.db.doc('data/users/' + uid + '/notes').get().then(s => s && s.exists ? (s.data() || {}) : {}).catch(() => ({}));
        const items = Object.keys(idx.items || {}).map(id => ({id, ...idx.items[id]})).filter(n => !n.gone);
        const n = pick(items, input.note, 'title');
        if (!n) throw new Error('no note matches "' + input.note + '"');
        const add = cut(String(input.text || '').trim(), 20000);
        if (!add) throw new Error('nothing to add');
        const body = await ctx.db.doc('data/users/' + uid + '/note.' + n.id).get().then(s => s && s.exists ? (s.data() || {}).text || '' : '').catch(() => '');
        await ctx.W.merge('data/users/' + uid + '/note.' + n.id, {text: cut(body + (body ? '\n' : '') + add, 60000), updated: now});
        await ctx.W.merge('data/users/' + uid + '/notes', {items: {[n.id]: {updated: now}}});
        say('Added to the note "' + n.title + '"');
        return {ok: true, note: n.title};
      }
      case 'post_to_feed': {
        const text = cut(String(input.text || '').trim(), 1200);
        if (!text) throw new Error('the post needs text');
        let kind = ['update', 'win', 'question', 'poll', 'announce'].indexOf(input.kind) >= 0 ? input.kind : 'update';
        if (kind === 'announce' && !ctx.isFounder) kind = 'update';
        const id = U.uid();
        const mine = ctx.coll.feed.map[uid] || {};
        const post = {id, kind, text, at: now};
        if (kind === 'poll') { post.options = (Array.isArray(input.options) ? input.options : []).map(o => cut(String(o || '').trim(), 80)).filter(Boolean).slice(0, 4); if (post.options.length < 2) throw new Error('a poll needs two to four options'); }
        const posts = [post].concat(U.clone(mine.posts || [])).slice(0, 80);
        await ctx.W.merge('feed/' + uid, {posts, pinned: kind === 'announce' ? uid + ':' + id : (mine.pinned || null)});
        say('Posted ' + (kind === 'poll' ? 'a poll' : 'to Vibe'));
        return {ok: true, kind, text: cut(text, 80)};
      }
      case 'give_kudos': {
        const to = who(input.to, null);
        if (!to || to === uid) throw new Error('kudos go to a teammate, by name');
        const why = cut(String(input.why || '').trim(), 300);
        if (!why) throw new Error('say why');
        const given = ((ctx.coll.kudos.map[uid] || {}).given || []);
        const wk = U.isoWeek(new Date());
        const used = given.filter(g => g && U.isoWeek(new Date(g.at || 0)) === wk).length;
        if (used >= 3) throw new Error('three kudos a week is the cap, and they are used');
        await ctx.W.merge('kudos/' + uid, {given: [{id: U.uid(), to, why, at: now}].concat(U.clone(given)).slice(0, 60)});
        say('Kudos to ' + nameOf(nm, to));
        return {ok: true, to: nameOf(nm, to), left: 2 - used};
      }
      case 'send_message': {
        if (!M.rooms) throw new Error('chat is not on this build');
        const text = cut(String(input.text || '').trim(), 4000);
        if (!text) throw new Error('the message needs text');
        const rooms = M.rooms.roomsOf(ctx);
        const r = rooms.find(x => norm(x.name) === norm(input.to) || x.id === norm(input.to)) || null;
        const u = r ? null : M.ai.findMember(ctx, nm, input.to);
        if (!r && (!u || u === uid)) throw new Error('say a room name or a teammate');
        const room = r ? r.id : M.rooms.dmId(uid, u);
        const mentions = ctx.activeMembers.filter(m => { const n = String(nm[m.uid] || ''); return n && (text.includes('@' + n) || text.includes('@' + n.split(' ')[0] + ' ')); }).map(m => m.uid);
        await M.rooms.send(ctx, room, text, mentions);
        say('Sent to ' + (r ? r.name : nameOf(nm, u)));
        return {ok: true, to: r ? r.name : nameOf(nm, u)};
      }
      case 'create_room': {
        if (!M.rooms) throw new Error('chat is not on this build');
        const id = await M.rooms.makeRoom(ctx, String(input.name || ''), String(input.topic || ''));
        say('Made the room ' + input.name);
        return {ok: true, room: input.name, id};
      }
      case 'request_leave': {
        if (!ymdOk(input.from) || !ymdOk(input.to) || input.to < input.from) throw new Error('from and to must be YYYY-MM-DD, to on or after from');
        const type = ['casual', 'sick', 'swap', 'other'].indexOf(input.type) >= 0 ? input.type : 'casual';
        const reqs = [{id: U.uid(), from: input.from, to: input.to, type, at: now}].concat(U.clone((ctx.coll.leave.map[uid] || {}).reqs || [])).slice(0, 60);
        await ctx.W.merge('leave/' + uid, {reqs});
        say('Asked for leave ' + U.fmtDay(input.from) + (input.to !== input.from ? ' to ' + U.fmtDay(input.to) : ''));
        return {ok: true, from: input.from, to: input.to, type, status: 'pending'};
      }
      case 'decide_leave': {
        if (!ctx.isFounder) throw new Error('leave decisions are the founder\'s');
        const u = who(input.person, null);
        if (!u) throw new Error('say whose leave');
        const status = input.status === 'declined' ? 'declined' : 'approved';
        const reqs = ((ctx.coll.leave.map[u] || {}).reqs || []);
        const dec = (ctx.coll.leavedec.map[u] || {}).d || {};
        const open = reqs.filter(r => !dec[r.id]);
        const r = (ymdOk(input.from) ? open.find(x => x.from === input.from) : null) || open[0];
        if (!r) throw new Error('nothing pending for ' + nameOf(nm, u));
        return hold((status === 'approved' ? 'Approve' : 'Decline') + ' ' + nameOf(nm, u) + '\'s leave', r.from + ' to ' + r.to + ', ' + r.type, () => ctx.W.merge('leavedec/' + u, {d: {[r.id]: {status, at: Date.now()}}}));
      }
      case 'check_in': {
        const days = U.clone((ctx.coll.checkin.map[uid] || {}).days || {});
        const td = today();
        if (days[td] && days[td].in && !days[td].out) throw new Error('already checked in today at ' + U.hhmm(days[td].in));
        const st = M.att && M.att.dayStatus ? M.att.dayStatus(ctx, uid, td) : {status: 'none'};
        if (['leave', 'holiday', 'sunday'].indexOf(st.status) >= 0) throw new Error('today is ' + st.status + ', no check-in needed');
        const mode = input.mode === 'wfh' ? 'wfh' : 'office';
        if (mode === 'wfh' && M.att && M.att.wfhUsed && M.att.wfhCapFor) {
          const mon = U.mondayOf(new Date());
          if (M.att.wfhUsed(ctx, uid, mon) >= M.att.wfhCapFor(ctx, uid)) throw new Error('the WFH days for this week are used up');
        }
        const place = (M.att && M.att.PLACES || ['Office', 'Client site', 'Home', 'Travelling']).find(p => norm(p) === norm(input.place)) || (mode === 'wfh' ? 'Home' : 'Office');
        const entry = {in: now, out: null, mode, loc: {lat: null, lng: null, acc: null, dist: null, verified: false, place, src: 'self'}, outLoc: null};
        const mood = Number(input.mood); if (mood >= 1 && mood <= 5) entry.mood = mood;
        days[td] = entry;
        await ctx.W.merge('checkin/' + uid, {days: U.pruneDays(days)});
        say('Checked in, ' + mode + (place ? ', ' + place : ''));
        return {ok: true, mode, place, at: U.hhmm(now), note: 'no GPS from here, so the place is as they said'};
      }
      case 'check_out': {
        const days = U.clone((ctx.coll.checkin.map[uid] || {}).days || {});
        const td = today();
        if (!days[td] || !days[td].in) throw new Error('not checked in today');
        if (days[td].out) throw new Error('already checked out at ' + U.hhmm(days[td].out));
        days[td] = {...days[td], out: now, outLoc: null};
        await ctx.W.merge('checkin/' + uid, {days: U.pruneDays(days)});
        say('Checked out');
        return {ok: true, at: U.hhmm(now)};
      }
      case 'file_eod': {
        const shipped = cut(String(input.shipped || '').trim(), 1000);
        if (!shipped) throw new Error('say what shipped');
        const days = U.clone((ctx.coll.eod.map[uid] || {}).days || {});
        const td = today();
        const old = days[td] || null;
        days[td] = {shipped, next: cut(String(input.next || '').trim(), 600), blocked: cut(String(input.blocked || '').trim(), 600), at: old && old.at ? old.at : now, updated: now};
        await ctx.W.merge('eod/' + uid, {days: U.pruneDays(days)});
        say((old ? 'Updated' : 'Filed') + ' the EOD');
        return {ok: true, shipped: cut(shipped, 80)};
      }
      case 'set_week_outcomes': {
        const wk = U.isoWeek(new Date());
        if ((((ctx.coll.review.map[uid] || {}).weeks || {})[wk] || {}).at) throw new Error('this week is already reviewed, the outcomes are locked');
        const items = (Array.isArray(input.items) ? input.items : [input.items]).map(t => cut(String(t || '').trim(), 160)).filter(Boolean).slice(0, 3);
        if (!items.length) throw new Error('give one to three outcomes');
        const all = U.clone((ctx.coll.plan.map[uid] || {}).weeks || {});
        const old = all[wk] || {};
        const prev = old.items || [];
        all[wk] = {items: items.map(t => ({id: (prev.find(p => p.text === t) || {}).id || U.uid(), text: t})), at: old.at || now, updated: now};
        await ctx.W.merge('plan/' + uid, {weeks: U.pruneWeeks(all)});
        say('Set ' + items.length + ' outcomes for the week');
        return {ok: true, items};
      }
      case 'create_pitch': {
        const brand = cut(String(input.brand || '').trim(), 80);
        if (!brand) throw new Error('a brand is needed');
        const id = U.uid();
        await ctx.W.set('pitches/' + id, {brand, category: cut(String(input.category || '').trim(), 60), contact: cut(String(input.contact || '').trim(), 120), source: cut(String(input.source || '').trim(), 80), owner: who(input.owner, uid), updated: now, stage: 'lead', stageAt: now, next: '', nextDate: '', project: '', lost: '', created: now});
        say('Added ' + brand + ' to the pipeline');
        return {ok: true, pitch: brand, stage: 'lead'};
      }
      case 'move_pitch': {
        const p = findPitch(ctx, input.pitch);
        if (!p) throw new Error('no pitch matches "' + input.pitch + '"');
        const patch = {updated: now};
        if (input.stage) { if (['lead', 'qualified', 'diagnostic', 'proposal', 'negotiation', 'won', 'lost'].indexOf(input.stage) < 0) throw new Error('unknown stage'); if (input.stage !== p.stage) { patch.stage = input.stage; patch.stageAt = now; } }
        if (input.next !== undefined) patch.next = cut(String(input.next || '').trim(), 200);
        if (input.nextDate !== undefined) { if (input.nextDate && !ymdOk(input.nextDate)) throw new Error('nextDate must be YYYY-MM-DD'); patch.nextDate = input.nextDate || ''; }
        if (input.lost !== undefined || patch.stage === 'lost') patch.lost = cut(String(input.lost || '').trim(), 200);
        await ctx.W.update('pitches/' + p.id, patch);
        say((patch.stage ? 'Moved ' + p.brand + ' to ' + patch.stage : 'Updated ' + p.brand));
        return {ok: true, pitch: p.brand, stage: patch.stage || p.stage, next: patch.next !== undefined ? patch.next : p.next};
      }
      case 'update_client': {
        const c = findClient(ctx, input.client);
        if (!c) throw new Error('no client matches "' + input.client + '"');
        const field = String(input.field || '').trim();
        const value = String(input.value || '').trim();
        const brainKeys = M.clients && M.clients.BRAIN ? M.clients.BRAIN.map(b => b.k) : ['about', 'offers', 'audience', 'voice', 'competitors', 'moves', 'talking', 'risks', 'pitchNext'];
        const plain = ['memory', 'approvals', 'never', 'links', 'industry', 'hq', 'tone', 'website'];
        if (brainKeys.indexOf(field) >= 0) await ctx.W.update('clients/' + c.id, {brain: {[field]: cut(value, 400), editedAt: now, editedBy: uid}, updated: now});
        else if (plain.indexOf(field) >= 0) {
          const patch = {updated: now, by: uid};
          if (field === 'website') { const w = M.clients && M.clients.cleanSite ? M.clients.cleanSite(value) : value; if (w === null) throw new Error('that is not a web address'); patch.website = w; patch.domain = M.clients && M.clients.domainFrom ? M.clients.domainFrom(w) : ''; }
          else patch[field] = cut(value, field === 'industry' || field === 'hq' ? 60 : field === 'tone' ? 160 : 2000);
          await ctx.W.update('clients/' + c.id, patch);
        } else throw new Error('field must be one of ' + plain.concat(brainKeys).join(', '));
        say('Updated ' + c.name + ', ' + field);
        return {ok: true, client: c.name, field};
      }
      case 'remind_me': {
        const text = cut(String(input.text || '').trim(), 120);
        if (!text) throw new Error('say what to remind');
        const due = ymdOk(input.when) ? input.when : today();
        const id = U.uid();
        await ctx.W.set('tasks/' + id, {title: 'Reminder: ' + text, owner: uid, client: '', project: '', section: '', due, status: 'todo', priority: 'normal', link: '', revisions: 0, shown20: false, subtasks: {}, comments: {}, by: uid, created: now, updated: now, doneAt: null});
        say('Reminder set for ' + U.fmtDay(due));
        return {ok: true, reminder: text, when: due, note: 'kept as a task on that day; it shows on Home and in the inbox'};
      }
      case 'remember': { const t = await remember(ctx, input.fact || input.text); say('Noted: ' + cut(t, 60)); return {ok: true, remembered: t}; }
      case 'forget': { const n = await forget(ctx, input.fact || input.text || 'everything'); say('Forgot ' + n + (n === 1 ? ' thing' : ' things')); return {ok: true, forgot: n}; }
      case 'save_bookmark': {
        const c = M.web && M.web.clean ? M.web.clean(String(input.url || '')) : String(input.url || '');
        if (!c) throw new Error('that is not an address');
        const cur = await ctx.db.doc('links/team').get().then(x => x && x.exists ? ((x.data() || {}).items || []) : []).catch(() => []);
        const items = [{id: U.uid(), title: cut(String(input.title || (M.web && M.web.hostOf ? M.web.hostOf(c) : c)), 60), url: c, by: uid, at: now}].concat(U.clone(cur)).slice(0, 60);
        await ctx.W.merge('links/team', {items, updated: now});
        say('Bookmarked ' + items[0].title);
        return {ok: true, title: items[0].title, url: c};
      }
      case 'open_web': {
        if (!M.web || !M.web.open) throw new Error('the browser is not on this build');
        const ok = M.web.open(String(input.url || ''));
        say('Opened ' + cut(String(input.url || ''), 60));
        return {ok: true, inside: ok, note: ok ? 'open in the browser inside m360' : 'that site refuses frames, it opened in a new tab'};
      }
      case 'send_mail': {
        if (!live()) throw new Error('mail sends from the team site only');
        const to = String(input.to || '').trim();
        if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+(\s*[,;]\s*[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$/.test(to)) throw new Error('to must be one or more email addresses');
        const subject = cut(String(input.subject || '').trim(), 200);
        const text = cut(String(input.text || '').trim(), 20000);
        if (!subject || !text) throw new Error('a subject and the text are needed');
        return hold('Send the mail to ' + cut(to, 40), subject + '\n' + text, () => api('gmailsend', {to, cc: cut(String(input.cc || '').trim(), 200), subject, text, threadId: '', inReplyTo: ''}));
      }
      case 'add_meeting': {
        if (!live()) throw new Error('meetings are made from the team site only');
        const title = cut(String(input.title || '').trim(), 200);
        const start = new Date(String(input.start || '')), end = new Date(String(input.end || ''));
        if (!title || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw new Error('a title, an ISO start and an ISO end after it are needed');
        const attendees = (Array.isArray(input.attendees) ? input.attendees : String(input.attendees || '').split(/[,;\s]+/)).map(x => String(x || '').trim()).filter(Boolean).slice(0, 30);
        return hold('Add "' + cut(title, 40) + '" to Calendar', when(start.getTime()) + ' to ' + U.hhmm(end.getTime()) + (attendees.length ? ', invites to ' + attendees.join(', ') : ''), () => api('gcalcreate', {title, start: start.toISOString(), end: end.toISOString(), attendees, meet: input.meet !== false, description: cut(String(input.description || ''), 2000)}));
      }
      default: throw new Error('unknown action "' + action + '". The actions are: ' + actionsFor(ctx).map(x => x[0]).join(', '));
    }
  }

  /* ---------- what the prompt says it can do ---------- */
  function catalog(ctx) {
    return 'LOOK UP with look_up(what, q): ' + areasFor(ctx).map(([k, d]) => k + ' (' + d + ')').join('; ') + '.\n' +
      'DO with act(action, input): ' + actionsFor(ctx).map(([k, f, d]) => k + ' ' + f + ', ' + d).join('; ') + '.';
  }
  function tools(ctx, nm, log) {
    const out = [{
      name: 'look_up',
      description: 'Read one area of m360 the person may see, as text. Call it before answering anything the data in the prompt does not already say. Areas: ' + areasFor(ctx).map(([k, d]) => k + ' (' + d + ')').join('; ') + '. q narrows it (a word, a name, a title, a number of days, a period, an address).',
      inputSchema: {type: 'object', properties: {what: {type: 'string', description: 'The area, one word'}, q: {type: 'string', description: 'A word, name, title, address or number to narrow it. Optional.'}}, required: ['what']},
      execute: async input => cut(await lookUp(ctx, nm, input.what, input.q), 9000)
    }, {
      name: 'act',
      description: 'Change something in m360 for the person, the way their own hand would. Actions and their input: ' + actionsFor(ctx).map(([k, f, d]) => k + ' ' + f + ', ' + d).join('; ') + '. People are named by first name ("me" is the person). Tasks, projects, clients, pitches and notes are matched by title. Some actions come back waiting: then the person taps to send, so say it is ready.',
      inputSchema: {type: 'object', properties: {action: {type: 'string', description: 'One action name from the list'}, input: {type: 'object', description: 'The fields for that action'}}, required: ['action']},
      execute: async input => act(ctx, nm, log, input.action, input.input)
    }];
    if (M.intel && M.intel.tools) M.intel.tools(ctx, nm).forEach(t => out.push(t));
    return out;
  }

  /* ---------- the hello, once a day, from the data alone (no model call) ---------- */
  function hello(ctx, nm) {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const first = String(nameOf(nm, ctx.uid)).split(' ')[0];
    const td = today();
    const mine = tasksOf(ctx).filter(t => t.owner === ctx.uid && t.status !== 'done');
    const over = mine.filter(t => t.due && t.due < td);
    const dueToday = mine.filter(t => t.due === td);
    const bits = [];
    if (mine.length) bits.push(mine.length + ' open' + (over.length ? ', ' + over.length + ' overdue' : '') + (dueToday.length ? ', ' + dueToday.length + ' due today' : ''));
    else bits.push('nothing open on you');
    const a = M.att && M.att.dayStatus ? M.att.dayStatus(ctx, ctx.uid, td) : {status: 'none'};
    if (a.status === 'none' && h < 14) bits.push('not checked in yet');
    const cel = M.trophies && M.trophies.today ? M.trophies.today(ctx).filter(c => c.uid !== ctx.uid) : [];
    if (cel.length) bits.push(nameOf(nm, cel[0].uid) + ': ' + cel[0].text);
    if (ctx.isFounder && M.leave && M.leave.pending) { const n = M.leave.pending(ctx).length; if (n) bits.push(n + (n === 1 ? ' leave request' : ' leave requests') + ' waiting on you'); }
    const un = M.inbox && M.inbox.unread ? M.inbox.unread(ctx) : 0;
    if (un) bits.push(un + ' new in the inbox');
    return greet + ', ' + first + '. ' + bits.join('. ').replace(/^./, c => c.toUpperCase()) + '.';
  }

  /* ---------- a long chat folds into a summary, so the thread never runs out of room ---------- */
  const COMPACT_AT = 24, COMPACT_KEEP = 10;
  async function compact(ctx) {
    const chat = M.chat;
    if (!chat || !M.ai.on(ctx) || ctx.viewAs) return false;
    const turns = chat.turns.filter(t => !t.act);
    if (turns.length < COMPACT_AT) return false;
    const old = turns.slice(0, turns.length - COMPACT_KEEP);
    const text = (chat.summary ? 'EARLIER SUMMARY:\n' + chat.summary + '\n\n' : '') + 'CHAT:\n' + old.map(t => (t.role === 'user' ? 'They: ' : 'You: ') + cut(t.content, 1200)).join('\n');
    let summary = '';
    try {
      summary = await M.ai.text(ctx, 'Fold this chat between you (the m360 buddy) and the person into a summary under 150 words, in the third person, keeping names, dates, numbers, decisions, open asks and anything they said to remember. Plain sentences, no headings.\n\n' + cut(text, 30000), {tier: 'quick', cache: false});
    } catch (e) { return false; }
    summary = cut(String(summary || '').trim(), 1500);
    if (!summary) return false;
    const keep = chat.turns.slice(chat.turns.length - Math.min(chat.turns.length, COMPACT_KEEP + 4));
    chat.summary = summary;
    await chat.save(ctx, keep, {summary});
    return true;
  }

  /* ---------- the buddy's own prefs card: memory, hello, follow up ---------- */
  function BuddyPrefs() {
    const ctx = M.useCtx();
    const doc = M.ai.useCache(ctx);
    const items = memoryOf(doc.data);
    const [hello, setHello] = useState(() => M.prefs.get('buddyHello', '1') !== '0');
    const [follow, setFollow] = useState(() => M.prefs.get('buddyFollow', '1') !== '0');
    const [busy, setBusy] = useState('');
    if (!M.ai.on(ctx)) return null;
    const drop = async t => { setBusy(t); try { await forget(ctx, t); } catch (e) { /* gone already */ } setBusy(''); };
    return html`<${UI.Card} id="buddy-prefs" title="The buddy">
      <div class="stack tight">
        <div class="row between">
          <span>Says hello once a day</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${hello ? 'on' : 'off'} ariaLabel="Buddy hello"
            onChange=${v => { M.prefs.set('buddyHello', v === 'on' ? '1' : '0'); setHello(v === 'on'); }}/>
        </div>
        <div class="row between">
          <span>Keeps listening after it answers out loud</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${follow ? 'on' : 'off'} ariaLabel="Buddy follow up"
            onChange=${v => { M.prefs.set('buddyFollow', v === 'on' ? '1' : '0'); setFollow(v === 'on'); }}/>
        </div>
        <div class="stack tight" style=${{marginTop: '4px'}}>
          <div class="row between"><span>What it remembers about you</span><span class="tiny ink62">${items.length} of ${MEMORY_MAX}</span></div>
          ${items.length ? items.slice().reverse().map(x => html`<div key=${x.t} class="row between memory-row">
            <span class="small grow">${x.t}</span>
            <button type="button" class="linky tiny" disabled=${busy === x.t} onClick=${() => drop(x.t)}>Forget</button>
          </div>`) : html`<div class="tiny ink62">Tell it "remember that I..." and it will keep it in mind in every chat.</div>`}
        </div>
      </div>
    <//>`;
  }

  M.brain = {lookUp, act, tools, catalog, areasFor, actionsFor, hello, compact, remember, forget, memoryOf, readAi, memoryLines, pending, hold, approve, drop, findTask, findProject, findClient, COMPACT_AT};
  M.parts.PendingActs = PendingActs;
  M.parts.BuddyPrefs = BuddyPrefs;
})();
