/* module: sections. Work, Accounts, Vibe, Me and Admin: a colourful hero with live numbers,
   simple tabs, and the working screens underneath. Plus the AI tools that deploy work. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const Embed = ({page, id}) => {
    const P = M.pages[page];
    return P ? html`<div class="embedded"><${P} id=${id || null}/></div>` : null;
  };
  const Mini = ({v, l, hot}) => html`<span class="chipline"><b class=${'num' + (hot ? ' flame-t' : '')}>${v}</b> ${l}</span>`;
  const SPARK = '\u2726';

  /* ---------- AI: turn a brief into assigned tasks ---------- */
  function BriefToTasks({onClose}) {
    const ctx = M.useCtx();
    const [brief, setBrief] = useState('');
    const [project, setProject] = useState('');
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const r = M.ai.useRun();
    const projects = Object.keys(ctx.coll.projects.map).map(id => ({id, ...ctx.coll.projects.map[id]})).filter(p => !p.archived && p.status !== 'done');
    const people = ctx.activeMembers;
    const profs = M.useProfiles(people.map(m => m.uid));

    async function breakDown() {
      const nm = await M.ai.names(ctx);
      const tasks = ctx.coll.tasks.map;
      const load = people.map(m => {
        const open = Object.keys(tasks).filter(id => tasks[id].owner === m.uid && tasks[id].status !== 'done').length;
        return '- ' + nm[m.uid] + ', ' + (m.title || m.role) + (m.pod ? ', ' + m.pod : '') + ', ' + open + ' open tasks' + (ctx.onLeave(m.uid, U.todayStr()) ? ', on leave today' : '');
      }).join('\n');
      const p = project ? ctx.coll.projects.map[project] : null;
      const out = await r.run(o => M.ai.json(ctx,
        'Break this brief into 4 to 10 concrete tasks a boutique luxury agency team would ship. Assign each to the best fit ' +
        'by role and current load (spread the work, never pile onto one person). Set realistic due dates from today (' + U.todayStr() + '), ' +
        'working days are Monday to Saturday. ' + (p ? 'Use these project sections where they fit: ' + (p.sections || []).map(s => s.name).join(', ') + '. ' : '') +
        'Reply with only a JSON array of {"title": "starts with a verb", "owner": "first name", "due": "YYYY-MM-DD", "section": "section name or empty", "why": "under 12 words"}.\n\n' +
        'TEAM AND LOAD:\n' + load + '\n\nBRIEF:\n' + brief.slice(0, 6000), {signal: o.signal, cache: false}));
      if (Array.isArray(out)) {
        setRows(out.slice(0, 12).map((t, i) => {
          const owner = M.ai.findMember(ctx, nm, t.owner) || ctx.uid;
          const sec = p ? ((p.sections || []).find(s => String(s.name).toLowerCase() === String(t.section || '').toLowerCase()) || (p.sections || [])[0] || {}).id || '' : '';
          return {k: i, on: true, title: String(t.title || '').slice(0, 140), owner, due: /^\d{4}-\d{2}-\d{2}$/.test(String(t.due || '')) ? t.due : '', section: sec, why: String(t.why || '')};
        }).filter(x => x.title));
      }
    }
    async function create(ev) {
      const pick = (rows || []).filter(x => x.on);
      if (!pick.length) return;
      setBusy(true);
      const p = project ? ctx.coll.projects.map[project] : null;
      for (const t of pick) {
        await ctx.W.set('tasks/' + U.uid(), {title: t.title, owner: t.owner, client: (p && p.client) || '', project: project || '', section: t.section || '',
          due: t.due, status: 'todo', priority: 'normal', link: '', revisions: 0, shown20: false, subtasks: {}, comments: {},
          by: ctx.uid, created: Date.now(), updated: Date.now(), doneAt: null}).catch(() => {});
      }
      setBusy(false);
      M.toast(pick.length + ' tasks sent to the team');
      onClose();
    }
    const upd = (k, patch) => setRows(rs => rs.map(x => x.k === k ? {...x, ...patch} : x));
    const thinking = r.state === 'thinking' || r.state === 'streaming';

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Brief to tasks"
      footer=${rows ? html`<${UI.Btn} disabled=${busy || !rows.some(x => x.on)} onClick=${create}>Send ${rows.filter(x => x.on).length} tasks<//>` : null}>
      ${!rows ? html`<div class="stack">
        <div class="small" style=${{fontWeight: 500}}>Paste a client brief, a call summary or a WhatsApp dump. m360 breaks it into tasks, picks owners by role and workload, and sets dates. You review before anything is sent.</div>
        <${UI.TextArea} id="brief-text" label="the brief" rows=${8} value=${brief} onChange=${setBrief}
          placeholder="Swisse wants 10 more reels for Diwali, live by 20 Oct. Hindi and English. Two creators, one studio day..."/>
        <${UI.Select} label="project, optional" value=${project} onChange=${setProject}
          options=${[{v: '', label: 'No project'}].concat(projects.map(p => ({v: p.id, label: p.name})))}/>
        <button type="button" class="btn" disabled=${thinking || brief.trim().length < 12} onClick=${breakDown}>
          ${thinking ? html`<${M.Thinking} label="Breaking it down"/>` : html`<span class="spark">${SPARK}</span> Break it down`}</button>
        ${r.state === 'error' ? html`<div class="small flame-t">${M.ai.errCopy(r.err)}</div>` : null}
      </div>` : html`<div class="stack tight">
        <div class="small" style=${{fontWeight: 500}}>Untick anything you don't want. Change owners or dates, then send.</div>
        ${rows.map(t => html`<div class="focus" key=${t.k} style=${{alignItems: 'flex-start', flexWrap: 'wrap'}}>
          <input type="checkbox" checked=${t.on} onChange=${e => upd(t.k, {on: e.target.checked})} style=${{width: '20px', height: '20px', marginTop: '3px', accentColor: '#111'}} aria-label="Include"/>
          <div class="grow" style=${{minWidth: '200px'}}>
            <input class="input" value=${t.title} onInput=${e => upd(t.k, {title: e.target.value})} style=${{minHeight: '38px', fontWeight: 600}} aria-label="Task title"/>
            <div class="row" style=${{marginTop: '6px', gap: '6px'}}>
              <select class="input" value=${t.owner} onChange=${e => upd(t.k, {owner: e.target.value})} style=${{minHeight: '34px', width: 'auto'}} aria-label="Owner">
                ${people.map(m => html`<option key=${m.uid} value=${m.uid}>${(profs[m.uid] && profs[m.uid].name) || m.title || 'Teammate'}</option>`)}
              </select>
              <input class="input" type="date" value=${t.due} onInput=${e => upd(t.k, {due: e.target.value})} style=${{minHeight: '34px', width: 'auto'}} aria-label="Due"/>
            </div>
            ${t.why ? html`<div class="tiny ink62" style=${{marginTop: '4px'}}>${t.why}</div>` : null}
          </div>
        </div>`)}
        <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setRows(null)}>Start over<//>
      </div>`}
    <//>`;
  }
  M.parts.BriefToTasks = BriefToTasks;

  /* ---------- Work ---------- */
  function Work({tab, id}) {
    const ctx = M.useCtx();
    const [b2t, setB2t] = useState(false);
    const td = U.todayStr();
    const wkEnd = U.periodRange('week').to;
    const map = ctx.coll.tasks.map;
    const all = Object.keys(map).map(k => map[k]);
    const mineOpen = all.filter(t => t.owner === ctx.uid && t.status !== 'done');
    const over = mineOpen.filter(t => t.due && t.due < td).length;
    const dueWk = mineOpen.filter(t => t.due && t.due >= td && t.due <= wkEnd).length;
    const review = all.filter(t => t.status === 'review').length;
    const t = tab || 'tasks';
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="work" title="Work"
        right=${M.ai.on(ctx) ? html`<button type="button" class="btn" onClick=${() => setB2t(true)}><span class="spark">${SPARK}</span> Brief to tasks</button>` : null}>
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${mineOpen.length} l="open on you"/>
          <${Mini} v=${over} l="overdue" hot=${over > 0}/>
          <${Mini} v=${dueWk} l="due this week"/>
          <${Mini} v=${review} l="in review across the team"/>
        </div>
      <//>
      <${M.SectionTabs} section="work" active=${t}/>
      ${t === 'projects' ? html`<${Embed} page="Projects" id=${id}/>` : t === 'week' ? html`<${Embed} page="Week"/>` : html`<${Embed} page="Tasks"/>`}
      ${b2t ? html`<${BriefToTasks} onClose=${() => setB2t(false)}/>` : null}
    </div>`;
  }

  /* ---------- Accounts ---------- */
  function Accounts({tab}) {
    const ctx = M.useCtx();
    const clients = Object.keys(ctx.coll.clients.map).map(k => ctx.coll.clients.map[k]);
    const live = clients.filter(c => c.status === 'live').length;
    const pitches = Object.keys(ctx.coll.pitches.map).map(k => ctx.coll.pitches.map[k]);
    const inPlay = pitches.filter(p => p.stage !== 'won' && p.stage !== 'lost').length;
    const pm = ctx.isFounder && M.pitches && M.pitches.metrics ? M.pitches.metrics(ctx) : null;
    const sh = ctx.isFounder && M.clients && M.clients.shares ? M.clients.shares(ctx) : [];
    const mrr = sh.reduce((n, r) => n + (r.monthly || 0), 0);
    const t = tab || 'clients';
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="accounts" title="Accounts">
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${live} l="live clients"/>
          <${Mini} v=${inPlay} l="pitches in play"/>
          ${pm ? html`<${Mini} v=${U.inr(pm.weighted)} l="weighted pipeline"/>` : null}
          ${ctx.isFounder ? html`<${Mini} v=${U.inr(mrr)} l="monthly revenue"/>` : null}
        </div>
      <//>
      <${M.SectionTabs} section="accounts" active=${t}/>
      ${t === 'pipeline' ? html`<${Embed} page="Pitches"/>` : html`<${Embed} page="Clients"/>`}
    </div>`;
  }

  /* ---------- Vibe: weekly wrapped by AI ---------- */
  function Wrapped() {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const cache = M.ai.useCache(ctx);
    const wk = U.isoWeek(new Date());
    const cached = cache.data && cache.data.wrapped && cache.data.wrapped.week === wk ? cache.data.wrapped.text : '';
    const text = r.text || cached;
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const nm = await M.ai.names(ctx);
      const from = U.periodRange('week').from;
      const fromMs = U.parseYmd(from).getTime();
      const posts = [];
      Object.keys(ctx.coll.feed.map).forEach(u => ((ctx.coll.feed.map[u] || {}).posts || []).forEach(p => { if (p.at >= fromMs) posts.push('- ' + (nm[u] || 'someone') + ' (' + p.kind + '): ' + String(p.text).slice(0, 200)); }));
      const kudos = [];
      Object.keys(ctx.coll.kudos.map).forEach(u => ((ctx.coll.kudos.map[u] || {}).given || []).forEach(k => { if (k.at >= fromMs) kudos.push('- ' + (nm[u] || 'someone') + ' to ' + (nm[k.to] || 'someone') + ': ' + String(k.why).slice(0, 160)); }));
      const map = ctx.coll.tasks.map;
      const shipped = {};
      Object.keys(map).forEach(id => { const t = map[id]; if (t.status === 'done' && t.doneAt >= fromMs) shipped[t.owner] = (shipped[t.owner] || 0) + 1; });
      const ship = Object.keys(shipped).map(u => '- ' + (nm[u] || 'someone') + ': ' + shipped[u] + ' tasks shipped');
      const out = await r.run(o => M.ai.text(ctx,
        'Write this week\'s team "Wrapped" for the agency feed, in the style of Spotify Wrapped. Fun, specific, celebratory, ' +
        'no emoji. Structure: a bold headline, then 4 to 6 bullets (biggest wins, shoutouts by name, who shipped most, a fun stat), ' +
        'then one line hyping next week. Under 140 words. Only use facts below.\n\nPOSTS:\n' + (posts.join('\n') || '- none') +
        '\n\nKUDOS:\n' + (kudos.join('\n') || '- none') + '\n\nSHIPPED:\n' + (ship.join('\n') || '- none'),
        {signal: o.signal, onText: o.onText, cache: false}));
      if (typeof out === 'string' && out) M.ai.saveCache(ctx, 'wrapped', {text: out, week: wk});
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<section class="ai-card">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>This week, wrapped</div></div>
        <button type="button" class=${'btn sm ' + (text ? 'sec' : '')} disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking}/>` : html`<span class="spark">${SPARK}</span> ${text ? 'Write it again' : 'Wrap the week'}`}</button>
      </div>
      <div style=${{marginTop: '12px'}}>
        ${text ? html`<${M.AIText} text=${text}/>` : html`<div class="small" style=${{fontWeight: 500}}>Wins, shoutouts and who shipped the most, written up by m360.</div>`}
        ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
      </div>
    </section>`;
  }

  function Vibe({tab, id}) {
    const ctx = M.useCtx();
    const from = U.parseYmd(U.periodRange('week').from).getTime();
    let posts = 0, kudos = 0;
    Object.keys(ctx.coll.feed.map).forEach(u => ((ctx.coll.feed.map[u] || {}).posts || []).forEach(p => { if (p.at >= from) posts++; }));
    Object.keys(ctx.coll.kudos.map).forEach(u => ((ctx.coll.kudos.map[u] || {}).given || []).forEach(k => { if (k.at >= from) kudos++; }));
    const online = Object.keys(ctx.online || {}).length;
    const t = tab || 'feed';
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="vibe" title="Vibe">
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${posts} l="posts this week"/>
          <${Mini} v=${kudos} l="kudos this week"/>
          <${Mini} v=${online} l="online now"/>
        </div>
      <//>
      <${M.SectionTabs} section="vibe" active=${t}/>
      ${t === 'feed' ? html`<${Wrapped}/>` : null}
      ${t === 'crew' ? html`<${Embed} page="People" id=${id}/>` : t === 'pulse' ? html`<${Embed} page="Voice"/>` : t === 'scores' ? html`<${Embed} page="Scores"/>` : html`<${Embed} page="Feed"/>`}
    </div>`;
  }

  /* ---------- Me ---------- */
  function Me({tab, id}) {
    const ctx = M.useCtx();
    const days = (ctx.coll.checkin.map[ctx.uid] || {}).days || {};
    const eods = (ctx.coll.eod.map[ctx.uid] || {}).days || {};
    const inStreak = M.home ? M.home.streak(ctx, ctx.uid, d => !!(days[d] && days[d].in)) : 0;
    const eodStreak = M.home ? M.home.streak(ctx, ctx.uid, d => !!eods[d]) : 0;
    const q = U.periodRange('quarter');
    const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, ctx.uid, q.from, q.to) : {total: 0, badges: []};
    const level = 1 + Math.floor(Math.max(0, pts.total) / 60);
    const t = tab || 'profile';
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro=${(ctx.member && ctx.member.empId) || 'me'}
        title=${html`<${UI.Name} id=${ctx.uid} fallback="You"/>`}
        sub=${(ctx.member && ctx.member.title) ? ctx.member.title + (ctx.member.pod ? ', ' + ctx.member.pod : '') : null}
        right=${html`<${UI.Avatar} id=${ctx.uid} size=${72}/>`}>
        <div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${'Level ' + level} l=${pts.total + ' points this quarter'}/>
          <${Mini} v=${inStreak} l="day streak"/>
          <${Mini} v=${eodStreak} l="EOD lines in a row"/>
          ${(pts.badges || []).map(b => html`<span key=${b} class="pill ink">${b}</span>`)}
        </div>
      <//>
      <${M.SectionTabs} section="me" active=${t}/>
      ${t === 'leave' ? html`<${Embed} page="Leave"/>` : t === 'handbook' ? html`<${Embed} page="Handbook" id=${id}/>`
        : t === 'hiring' ? html`<${Embed} page="Hiring" id=${id}/>` : html`<${Embed} page="People" id=${ctx.uid}/>`}
    </div>`;
  }

  /* ---------- Admin ---------- */
  function Admin() {
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} color="ink" micro="founder" title="Admin"
        sub="Roster, rules, office location, keeper test, payroll export and cleanup."/>
      <${Embed} page="Desk"/>
    </div>`;
  }

  M.pages.Work = Work;
  M.pages.Accounts = Accounts;
  M.pages.Vibe = Vibe;
  M.pages.Me = Me;
  M.pages.Admin = Admin;
})();
