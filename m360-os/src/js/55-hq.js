/* module: hq. The founder's power screen: live numbers, the daily AI intelligence brief with
   one tap actions, workload balancing, who is online, and ask anything about the company. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const PAGE_NAMES = {home: 'Home', today: 'Home', work: 'Work', tasks: 'Tasks', projects: 'Projects', week: 'The week',
    accounts: 'Accounts', clients: 'Clients', pitches: 'Pipeline', vibe: 'Vibe', feed: 'Feed', people: 'Crew', voice: 'Pulse',
    scores: 'Leaderboard', me: 'Me', leave: 'Leave', handbook: 'Handbook', hiring: 'Hiring', hq: 'HQ', command: 'HQ', admin: 'Admin', desk: 'Admin'};

  const SPARK = '\u2726';
  function Tile({v, l, to, hot}) {
    return html`<button type="button" class=${'stat glass' + (hot ? ' hot' : '')} onClick=${() => to && M.nav(to)}>
      <span class="v num" style=${hot ? {color: 'var(--flame)'} : null}>${v}</span><span class="l">${l}</span></button>`;
  }

  function useNumbers(ctx) {
    return useMemo(() => {
      const td = U.todayStr();
      const people = ctx.activeMembers;
      const att = people.map(m => M.att.dayStatus(ctx, m.uid, td));
      const inNow = att.filter(a => a.status === 'office' || a.status === 'wfh');
      const late = inNow.filter(a => a.late).length;
      const map = ctx.coll.tasks.map;
      const overdue = Object.keys(map).filter(id => map[id].status !== 'done' && map[id].due && map[id].due < td).length;
      const pm = (M.pitches && M.pitches.metrics) ? M.pitches.metrics(ctx) : {weighted: 0};
      const sh = (M.clients && M.clients.shares) ? M.clients.shares(ctx) : [];
      const mrr = sh.reduce((n, r) => n + (r.monthly || 0), 0);
      const en = (M.voice && M.voice.energyByWeek) ? M.voice.energyByWeek(ctx, 8) : [];
      const lastEn = en.slice().reverse().find(e => e && e.avg != null);
      const moods = people.map(m => ((((ctx.coll.checkin.map[m.uid] || {}).days || {})[td]) || {}).mood).filter(Boolean);
      const moodAvg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
      return {people, inNow: inNow.length, late, overdue, pm, mrr, lastEn, moodAvg, high: ctx.flags.filter(f => f.severity === 'high').length};
    }, [ctx]);
  }

  /* ---------- the daily intelligence brief ---------- */
  function IntelBrief() {
    const ctx = M.useCtx();
    const cache = M.ai.useCache(ctx);
    const r = M.ai.useRun();
    const [assigned, setAssigned] = useState({});
    const cached = cache.data && cache.data.hq && cache.data.hq.date === U.todayStr() ? cache.data.hq.data : null;
    const data = (r.state === 'done' && r.data) || cached;
    const busy = r.state === 'thinking' || r.state === 'streaming';
    if (!M.ai.on(ctx)) return html`<section class="card"><div class="card-title">Intelligence brief</div>
      <div class="small ink62" style=${{marginTop: '8px'}}>AI is off for this page. Everything below still updates live.</div></section>`;

    async function go() {
      const slice = await M.ai.teamSlice(ctx);
      const out = await r.run(o => M.ai.json(ctx,
        'You are briefing Kaavish, the founder, at the start of his day. Read the company data and tell him what matters. ' +
        'Be specific: names, clients, numbers. Prioritise what needs his decision or a nudge today. ' +
        'Reply with only JSON: {"headline": "one punchy sentence", "pulse": "one line on attendance and mood", ' +
        '"risks": [{"title": "short", "detail": "one sentence"}] (up to 4), "wins": ["short"] (up to 3), ' +
        '"people": [{"name": "first name", "note": "nudge, praise or help, one sentence"}] (up to 4), "money": ["short"] (up to 3), ' +
        '"actions": [{"title": "task starting with a verb", "owner": "first name", "due": "YYYY-MM-DD", "why": "short"}] (up to 4)}.\n\n' + slice,
        {signal: o.signal, cache: false}));
      if (out && typeof out === 'object') M.ai.saveCache(ctx, 'hq', {data: out});
    }
    async function assign(a, i, ev) {
      const nm = await M.ai.names(ctx);
      const owner = M.ai.findMember(ctx, nm, a.owner) || ctx.uid;
      await ctx.W.set('tasks/' + U.uid(), {title: String(a.title).slice(0, 140), owner, client: '', project: '', section: '',
        due: /^\d{4}-\d{2}-\d{2}$/.test(String(a.due || '')) ? a.due : '', status: 'todo', priority: 'high', link: '', revisions: 0,
        shown20: false, subtasks: {}, comments: {}, by: ctx.uid, created: Date.now(), updated: Date.now(), doneAt: null});
      setAssigned(x => ({...x, [i]: true}));
      M.toast('Sent to ' + (nm[owner] || 'the team'));
    }
    const list = (arr) => Array.isArray(arr) ? arr : [];

    return html`<section class="ai-card dark">
      <div class="row between">
        <div class="row"><div>
          <${UI.Micro}>m360 ai<//><div class="card-title" style=${{color: '#fff', marginTop: '4px'}}>Today's intelligence</div>
          <div class="tiny ink62">${cached && !r.data ? 'generated ' + U.timeAgo(cache.data.hq.at) : 'reads every task, check-in, EOD, pitch and pulse'}</div></div></div>
        <button type="button" class=${'btn sm on-dark' + (data ? ' sec' : '')} disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking} label="Reading the company"/>` : html`<span class="spark">${SPARK}</span> ${data ? 'Refresh' : 'Brief me'}`}</button>
      </div>
      ${r.state === 'error' ? html`<div class="small" style=${{marginTop: '10px', color: 'var(--flame)'}}>${M.ai.errCopy(r.err)}</div>` : null}
      ${!data && !busy ? html`<div style=${{marginTop: '14px', fontWeight: 500}}>One tap and m360 reads the whole company: who's slipping, which client needs love, where the money is, and what to hand out today.</div>` : null}
      ${busy && !data ? html`<div class="small ink62" style=${{marginTop: '14px'}}>Scanning attendance, workload, blockers, pipeline and team energy…</div>` : null}
      ${data ? html`<div class="stack" style=${{marginTop: '16px', gap: '16px'}}>
        <div class="display" style=${{fontSize: '30px'}}>${data.headline || ''}</div>
        ${data.pulse ? html`<div style=${{fontWeight: 500}}>${data.pulse}</div>` : null}
        <div class="grid2">
          ${list(data.risks).length ? html`<div><div class="micro" style=${{marginBottom: '8px'}}>risks</div>
            ${list(data.risks).map((x, i) => html`<div key=${i} style=${{marginBottom: '8px'}}><b><span class="dotflame" style=${{marginRight: '8px', verticalAlign: 'middle'}}/>${x.title}</b><div class="small ink62">${x.detail}</div></div>`)}</div>` : null}
          ${list(data.people).length ? html`<div><div class="micro" style=${{marginBottom: '8px'}}>people</div>
            ${list(data.people).map((x, i) => html`<div key=${i} style=${{marginBottom: '8px'}}><b>${x.name}</b><div class="small ink62">${x.note}</div></div>`)}</div>` : null}
          ${list(data.wins).length ? html`<div><div class="micro" style=${{marginBottom: '8px'}}>wins</div>
            ${list(data.wins).map((x, i) => html`<div key=${i} class="small" style=${{marginBottom: '6px'}}>${x}</div>`)}</div>` : null}
          ${list(data.money).length ? html`<div><div class="micro" style=${{marginBottom: '8px'}}>money</div>
            ${list(data.money).map((x, i) => html`<div key=${i} class="small" style=${{marginBottom: '6px'}}>${x}</div>`)}</div>` : null}
        </div>
        ${list(data.actions).length ? html`<div><div class="micro" style=${{marginBottom: '10px'}}>hand these out today</div>
          <div class="stack tight">${list(data.actions).map((a, i) => html`<div key=${i} class="focus" style=${{background: 'rgba(255,255,255,.06)', color: '#fff'}}>
            <div class="grow"><div style=${{fontWeight: 700}}>${a.title}</div>
              <div class="tiny ink62">${a.owner || 'someone'}${a.due ? ' · by ' + U.fmtDay(a.due) : ''}${a.why ? ' · ' + a.why : ''}</div></div>
            ${assigned[i] ? html`<span class="pill on-dark">sent</span>` : html`<button type="button" class="btn on-dark sm" onClick=${e => assign(a, i, e)}>Assign</button>`}
          </div>`)}</div></div>` : null}
      </div>` : null}
    </section>`;
  }

  /* ---------- workload and one tap rebalancing ---------- */
  function Workload() {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const [moves, setMoves] = useState(null);
    const [done, setDone] = useState({});
    const td = U.todayStr(), wkEnd = U.periodRange('week').to;
    const map = ctx.coll.tasks.map;
    const rows = ctx.activeMembers.map(m => {
      const open = Object.keys(map).map(id => ({id, ...map[id]})).filter(t => t.owner === m.uid && t.status !== 'done');
      return {m, open: open.length, over: open.filter(t => t.due && t.due < td).length,
        week: open.filter(t => t.due && t.due >= td && t.due <= wkEnd).length, a: M.att.dayStatus(ctx, m.uid, td)};
    }).sort((a, b) => (b.open + b.over * 2) - (a.open + a.over * 2));
    const max = Math.max(4, ...rows.map(x => x.open));

    async function rebalance() {
      const slice = await M.ai.teamSlice(ctx);
      const out = await r.run(o => M.ai.json(ctx,
        'Suggest up to 5 task moves that balance the team\'s workload. Only move OPEN tasks away from people who are overloaded ' +
        '(many open or overdue tasks, or on leave) to people with capacity and a fitting role. Keep client relationships in mind. ' +
        'Reply with only a JSON array of {"task": "exact task title from the data", "to": "first name", "why": "under 12 words"}. ' +
        'Reply [] if the load is already fair.\n\n' + slice, {signal: o.signal, cache: false}));
      if (Array.isArray(out)) setMoves(out.slice(0, 5));
    }
    async function apply(mv, i, ev) {
      const nm = await M.ai.names(ctx);
      const to = M.ai.findMember(ctx, nm, mv.to);
      const q = String(mv.task || '').toLowerCase();
      const id = Object.keys(map).find(k => String(map[k].title).toLowerCase() === q) || Object.keys(map).find(k => String(map[k].title).toLowerCase().indexOf(q) >= 0);
      if (!to || !id) { M.toast('Could not find that task or person', true); return; }
      await ctx.W.update('tasks/' + id, {owner: to, updated: Date.now()});
      setDone(x => ({...x, [i]: true}));
      M.toast('Moved to ' + nm[to]);
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';

    return html`<section class="card">
      <div class="card-head">
        <h2 class="card-title">Workload</h2>
        ${M.ai.on(ctx) ? html`<button type="button" class="btn sec sm" disabled=${busy} onClick=${rebalance}>${busy ? html`<${M.Thinking} label="Balancing"/>` : html`<span class="spark">${SPARK}</span> Rebalance`}</button>` : null}
      </div>
      <div class="stack tight">
        ${rows.map(x => html`<div class="listrow" key=${x.m.uid}>
          <span class="av-wrap"><${UI.Avatar} id=${x.m.uid} size=${30}/>${ctx.online[x.m.uid] ? html`<span class="live"/>` : null}</span>
          <span style=${{minWidth: '120px', fontWeight: 600}}><${UI.Name} id=${x.m.uid}/></span>
          <span class="grow" style=${{minWidth: '120px'}}><span class="bar"><i class=${x.over ? 'hot' : ''} style=${{width: Math.min(100, 100 * x.open / max) + '%'}}/></span></span>
          <span class="small num" style=${{minWidth: '150px', textAlign: 'right'}}>${x.open} open · ${x.week} this wk${x.over ? html` · <b class="flame-t">${x.over} late</b>` : ''}</span>
        </div>`)}
      </div>
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '10px'}}>${M.ai.errCopy(r.err)}</div>` : null}
      ${moves ? html`<div style=${{marginTop: '14px'}}>
        ${moves.length ? moves.map((mv, i) => html`<div class="focus" key=${i}>
          <div class="grow"><div style=${{fontWeight: 700}}>${mv.task} → ${mv.to}</div><div class="tiny ink62">${mv.why}</div></div>
          ${done[i] ? html`<span class="pill ink">moved</span>` : html`<${UI.Btn} sm=${true} onClick=${e => apply(mv, i, e)}>Move it<//>`}
        </div>`) : html`<div class="focus"><span style=${{fontWeight: 500}}>Load looks fair. Nothing to move.</span></div>`}
      </div>` : null}
    </section>`;
  }

  /* ---------- who is online and where ---------- */
  function LiveNow() {
    const ctx = M.useCtx();
    const on = Object.keys(ctx.online || {}).filter(u => ctx.members[u]);
    return html`<section class="card">
      <div class="card-head"><h2 class="card-title">Live now</h2>
        <span class="pill ink"><span class="dotflame"/>${on.length} online</span></div>
      ${on.length ? html`<div class="stack tight">${on.map(u => html`<div class="listrow" key=${u}>
        <${UI.Avatar} id=${u} size=${28}/><span class="grow" style=${{fontWeight: 600}}><${UI.Name} id=${u}/></span>
        <span class="pill">${PAGE_NAMES[ctx.online[u].page] || 'm360'}</span></div>`)}</div>`
        : html`<div class="small ink62">Nobody has m360 open right now.</div>`}
    </section>`;
  }

  function Embed({page, id}) {
    const P = M.pages[page];
    return P ? html`<div class="embedded"><${P} id=${id || null}/></div>` : null;
  }

  /* ---------- page ---------- */
  function HQ({tab, id}) {
    const ctx = M.useCtx();
    const n = useNumbers(ctx);
    const t = tab || 'brief';
    const Panel = M.parts.AskPanel;
    return html`<div class="stack" style=${{gap: '20px'}}>
      <header class="hero ink">
        <span class="ring" style=${{width: '380px', height: '380px', right: '-140px', top: '-190px'}}/>
        <span class="ring" style=${{width: '240px', height: '240px', right: '-70px', top: '-120px'}}/>
        <span class="dot" style=${{right: '110px', top: '48px'}}/>
        <div style=${{position: 'relative'}}>
          <${UI.Micro}>${U.dateLabel(new Date(ctx.now))}<//>
          <h1 class="hi">HQ</h1>
          <div class="sub" style=${{marginTop: '10px'}}>Everything at Mask360, live.</div>
        </div>
        <div class="grid4" style=${{marginTop: '20px', position: 'relative'}}>
          <${Tile} v=${n.inNow + '/' + n.people.length} l="in today" to="#command"/>
          <${Tile} v=${Object.keys(ctx.online).length} l="online now"/>
          <${Tile} v=${n.late} l="late today" to="#command" hot=${n.late > 0}/>
          <${Tile} v=${n.overdue} l="tasks overdue" to="#tasks" hot=${n.overdue > 0}/>
          <${Tile} v=${U.inr(n.pm.weighted)} l="weighted pipeline" to="#pitches"/>
          <${Tile} v=${U.inr(n.mrr)} l="monthly revenue" to="#clients"/>
          <${Tile} v=${n.lastEn ? n.lastEn.avg.toFixed(1) + '/5' : 'n/a'} l="team energy" to="#voice" hot=${!!(n.lastEn && n.lastEn.avg < 3)}/>
          <${Tile} v=${n.moodAvg ? n.moodAvg.toFixed(1) + '/5' : 'n/a'} l="mood at check-in"/>
        </div>
      </header>
      <${M.SectionTabs} section="hq" active=${t}/>
      ${t === 'dashboard' ? html`<${Embed} page="Command"/>` : t === 'hiring' ? html`<${Embed} page="Hiring" id=${id}/>` : html`<div class="stack" style=${{gap: '20px'}}>
        <${IntelBrief}/>
        <div class="split">
          <div class="stack" style=${{gap: '20px'}}>
            <${Workload}/>
            ${Panel && M.ai.on(ctx) ? html`<section class="card"><div class="card-head"><h2 class="card-title">Ask HQ anything</h2></div><${Panel} inline=${true}/></section>` : null}
          </div>
          <div class="stack" style=${{gap: '20px'}}>
            <${LiveNow}/>
            ${M.parts.LeaveApprovals ? html`<${M.parts.LeaveApprovals}/>` : null}
          </div>
        </div>
      </div>`}
    </div>`;
  }

  M.pages.HQ = HQ;
})();
