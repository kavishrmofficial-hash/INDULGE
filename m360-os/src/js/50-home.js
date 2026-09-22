/* module: home. Every person's own dashboard. The dark hero carries the greeting and the one
   thing to do right now; below it, focus, the AI brief, numbers and the crew. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const SPARK = '✦';
  const MOODS = [{v: 1, t: 'drained'}, {v: 2, t: 'low'}, {v: 3, t: 'okay'}, {v: 4, t: 'good'}, {v: 5, t: 'on fire'}];
  const STATUSES = ['Deep work', 'On a shoot', 'In a meeting', 'Travelling', 'At lunch', 'Free to chat', 'Under the weather'];
  const PLACES = [{v: 'Office', mode: 'office'}, {v: 'Client site', mode: 'office'}, {v: 'Home', mode: 'wfh'}, {v: 'Travelling', mode: 'wfh'}];

  /* consecutive working days, back from today, where `has(date)` holds */
  function streak(ctx, uid, has) {
    let d = new Date(), n = 0, guard = 0;
    if (!has(U.ymd(d))) d = U.addDays(d, -1);
    while (guard++ < 90) {
      const s = U.ymd(d);
      if (ctx.isWorkingDay(s, uid)) { if (has(s)) n++; else break; }
      d = U.addDays(d, -1);
    }
    return n;
  }
  function todayStatus(ctx, uid) {
    const s = ((ctx.coll.me.map[uid] || {}).status) || null;
    return s && s.at && s.text && U.ymd(new Date(s.at)) === U.todayStr() ? s : null;
  }
  function level(ctx, uid) {
    const q = U.periodRange('quarter');
    const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, uid, q.from, q.to) : {total: 0, badges: []};
    return {pts, lvl: 1 + Math.floor(Math.max(0, pts.total) / 60)};
  }
  M.home = {streak, status: todayStatus, level};

  /* ---------- status ---------- */
  function StatusPicker({onClose}) {
    const ctx = M.useCtx();
    const set = t => ctx.W.merge('me/' + ctx.uid, {status: t ? {text: t, at: Date.now()} : null})
      .then(() => { M.toast(t ? 'Status set' : 'Status cleared'); onClose(); });
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Set your status">
      <div class="stack tight">
        ${STATUSES.map(s => html`<button key=${s} type="button" class="focus rowbtn" onClick=${() => set(s)}>
          <span class="dotflame"/><span class="grow" style=${{fontWeight: 500}}>${s}</span></button>`)}
      </div>
      <div class="row"><${UI.Btn} kind="sec" sm=${true} onClick=${() => set(null)}>Clear status<//></div>
      <div class="hint">Your status shows next to your name until the end of today.</div>
    <//>`;
  }

  /* ---------- the one thing to do right now ---------- */
  function TapIn() {
    const ctx = M.useCtx();
    const [mode, setMode] = useState('office');
    const [mood, setMood] = useState(0);
    const [busy, setBusy] = useState(false);
    const [pick, setPick] = useState(false);
    const cap = Number(ctx.settings.wfhCap) || 0;
    const used = (M.att && M.att.wfhUsed) ? M.att.wfhUsed(ctx, ctx.uid, new Date()) : 0;
    const wfhFull = used >= cap;

    async function save(loc, m) {
      const days = U.clone((ctx.coll.checkin.map[ctx.uid] || {}).days || {});
      const entry = {in: Date.now(), out: null, mode: m, loc, outLoc: null};
      if (mood) entry.mood = mood;
      days[U.todayStr()] = entry;
      await ctx.W.merge('checkin/' + ctx.uid, {days: U.pruneDays(days)});
      M.toast('Checked in at ' + U.hhmm(entry.in));
    }
    async function tap() {
      setBusy(true);
      const pos = await M.getLoc();
      if (!pos) { setBusy(false); setPick(true); return; }
      await save(M.att.locFrom(pos, ctx.settings.office), mode).catch(() => {});
      setBusy(false);
    }
    async function manual(p) {
      setBusy(true);
      await save({lat: null, lng: null, acc: null, dist: null, verified: false, place: p.v, src: 'self'}, mode).catch(() => {});
      setBusy(false); setPick(false);
    }
    return html`<div class="stack" style=${{gap: '14px'}}>
      <div class="row between">
        <div style=${{fontWeight: 500}}>Start is ${ctx.startFor(ctx.uid)}. How's today?</div>
        <${UI.Seg} options=${[{v: 'office', label: 'Office'}, {v: 'wfh', label: 'WFH'}]} value=${mode} ariaLabel="Where"
          onChange=${v => { if (v === 'wfh' && wfhFull) { M.toast('WFH days used up this week', true); return; } setMode(v); }}/>
      </div>
      <div class="moods">${MOODS.map(m => html`<button key=${m.v} type="button" class=${'mood' + (mood === m.v ? ' on' : '')}
        aria-pressed=${mood === m.v} onClick=${() => setMood(mood === m.v ? 0 : m.v)}>${m.t}</button>`)}</div>
      ${pick ? html`<div>
        <div style=${{fontWeight: 500, marginBottom: '8px'}}>Where are you checking in from?</div>
        <div class="row">${PLACES.map(p => html`<button key=${p.v} type="button" class="btn on-dark sec sm" disabled=${busy} onClick=${() => manual(p)}>${p.v}</button>`)}</div>
      </div>` : html`<div><button type="button" class="btn xl on-dark" disabled=${busy} onClick=${tap}>
        ${busy ? 'Checking in' : (mode === 'wfh' ? 'Check in, WFH' : 'Check in, office')}</button></div>`}
      <div class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>WFH days used this week: ${used} of ${cap}. Checking in records the time and your location at that moment. Kaavish can see both.</div>
    </div>`;
  }

  function InNow() {
    const ctx = M.useCtx();
    const a = M.att.dayStatus(ctx, ctx.uid, U.todayStr());
    const [busy, setBusy] = useState(false);
    async function out() {
      setBusy(true);
      const pos = await M.getLoc();
      const days = U.clone((ctx.coll.checkin.map[ctx.uid] || {}).days || {});
      const e = days[U.todayStr()] || {};
      e.out = Date.now(); e.outLoc = pos ? M.att.locFrom(pos, ctx.settings.office) : null;
      days[U.todayStr()] = e;
      await ctx.W.merge('checkin/' + ctx.uid, {days: U.pruneDays(days)}).catch(() => {});
      setBusy(false);
      M.toast('Checked out. See you tomorrow');
    }
    return html`<div class="row between" style=${{alignItems: 'flex-end'}}>
      <div>
        <div class="display" style=${{fontSize: '26px'}}>${a.out ? 'Done for today' : 'In since ' + U.hhmm(a.in)}</div>
        <div class="small" style=${{color: 'rgba(255,255,255,.7)', marginTop: '6px'}}>
          ${a.out ? 'In ' + U.hhmm(a.in) + ', out ' + U.hhmm(a.out) + ', ' + U.durText(a.out - a.in) + '. ' : ''}${a.status === 'wfh' ? 'WFH' : 'Office'}, ${(a.place || 'no location').replace(/\.$/, '')}${a.verified ? ', verified' : ''}.
          ${a.late ? html` <span class="flame-t">Late.</span>` : null}
        </div>
      </div>
      ${a.out ? null : html`<button type="button" class="btn on-dark sec sm" disabled=${busy} onClick=${out}>Check out</button>`}
    </div>`;
  }

  /* ---------- hero ---------- */
  function Hero({onStatus}) {
    const ctx = M.useCtx();
    const now = new Date(ctx.now);
    const first = U.firstName(ctx.me.name) || 'there';
    const td = U.todayStr();
    const a = M.att.dayStatus(ctx, ctx.uid, td);
    const days = (ctx.coll.checkin.map[ctx.uid] || {}).days || {};
    const eods = (ctx.coll.eod.map[ctx.uid] || {}).days || {};
    const inStreak = streak(ctx, ctx.uid, d => !!(days[d] && days[d].in));
    const eodStreak = streak(ctx, ctx.uid, d => !!eods[d]);
    const lv = level(ctx, ctx.uid);
    const st = todayStatus(ctx, ctx.uid);
    const special = a.status === 'leave' ? "You're on approved leave today. Log off."
      : a.status === 'holiday' ? 'Today is a holiday.' : a.status === 'sunday' ? 'Sunday. The OS rests too.' : '';
    return html`<header class="hero ink">
      <span class="ring" style=${{width: '340px', height: '340px', right: '-120px', top: '-150px'}}/>
      <span class="ring" style=${{width: '220px', height: '220px', right: '-60px', top: '-90px'}}/>
      <span class="dot" style=${{right: '96px', top: '58px'}}/>
      <div class="split" style=${{position: 'relative', alignItems: 'end'}}>
        <div>
          <${UI.Micro}>${U.dateLabel(now)}<//>
          <h1 class="hi">${U.greeting(now)},<br/>${first}.</h1>
          <div class="row" style=${{marginTop: '20px', gap: '8px'}}>
            <span class="chipline on-dark"><b class="flame-t num">${inStreak}</b> day streak</span>
            <span class="chipline on-dark"><b class="num">${eodStreak}</b> EOD lines in a row</span>
            <span class="chipline on-dark">level <b class="num">${lv.lvl}</b></span>
            <button type="button" class="chipline on-dark" onClick=${onStatus}>${st ? html`<span class="dotflame"/>${st.text}` : 'Set a status'}</button>
          </div>
        </div>
        <div>${special ? html`<div class="display" style=${{fontSize: '24px'}}>${special}</div>`
          : (a.in ? html`<${InNow}/>` : html`<${TapIn}/>`)}</div>
      </div>
    </header>`;
  }

  /* ---------- pinned announcement ---------- */
  function Announcement() {
    const ctx = M.useCtx();
    const fd = ctx.coll.feed.map[ctx.founderUid];
    const key = fd && fd.pinned;
    if (!key || ctx.isFounder) return null;
    const cut = String(key).indexOf(':');
    const au = key.slice(0, cut), pid = key.slice(cut + 1);
    const post = ((ctx.coll.feed.map[au] || {}).posts || []).find(p => p && p.id === pid);
    if (!post) return null;
    const ackKey = 'ann:' + key;
    if ((((ctx.coll.acks.map[ctx.uid] || {}).s) || {})[ackKey]) return null;
    return html`<section class="card flame">
      <div class="row"><span class="pill flame">announcement</span><${UI.Avatar} id=${au} size=${22}/>
        <span class="small" style=${{fontWeight: 500}}><${UI.Name} id=${au}/></span><span class="tiny ink62">${U.timeAgo(post.at)}</span></div>
      <p style=${{whiteSpace: 'pre-wrap', margin: '10px 0 14px', fontSize: '16px'}}>${post.text}</p>
      <${UI.Btn} sm=${true} onClick=${() => ctx.W.merge('acks/' + ctx.uid, {s: {[ackKey]: Date.now()}})}>Got it<//>
    </section>`;
  }

  /* ---------- EOD with an AI draft ---------- */
  function Wrap() {
    const ctx = M.useCtx();
    const td = U.todayStr();
    const eods = (ctx.coll.eod.map[ctx.uid] || {}).days || {};
    const posted = eods[td];
    const [edit, setEdit] = useState(false);
    const [f, setF] = useState(() => ({shipped: (posted && posted.shipped) || '', next: (posted && posted.next) || '', blocked: (posted && posted.blocked) || ''}));
    const r = M.ai.useRun();
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    async function draft() {
      const slice = await M.ai.meSlice(ctx);
      const out = await r.run(o => M.ai.json(ctx,
        'Draft this person\'s end of day line from their work data below. Reply with only JSON: ' +
        '{"shipped": "what went out today, one or two short lines", "next": "what they pick up tomorrow", "blocked": "a real blocker or empty string"}. ' +
        'Only claim what the data supports. Keep each field under 160 characters.\n\n' + slice, {signal: o.signal, tier: 'quick', cache: false}));
      if (out && typeof out === 'object') setF({shipped: String(out.shipped || ''), next: String(out.next || ''), blocked: String(out.blocked || '')});
    }
    async function post() {
      if (!f.shipped.trim()) return;
      const days = U.clone(eods);
      days[td] = {shipped: f.shipped.trim(), next: f.next.trim(), blocked: f.blocked.trim(), at: Date.now()};
      await ctx.W.merge('eod/' + ctx.uid, {days: U.pruneDays(days)});
      setEdit(false);
      M.toast('Posted');
    }
    if (posted && !edit) {
      return html`<section class="card">
        <div class="card-head"><h2 class="card-title">EOD line</h2>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => { setF({shipped: posted.shipped, next: posted.next || '', blocked: posted.blocked || ''}); setEdit(true); }}>Edit<//></div>
        <div class="stack tight">
          <div><span class="micro plain">shipped</span>${posted.shipped}</div>
          ${posted.next ? html`<div><span class="micro plain">next</span>${posted.next}</div>` : null}
          ${posted.blocked ? html`<div class="flame-t"><span class="micro plain">blocked</span>${posted.blocked}</div>` : null}
        </div>
      </section>`;
    }
    const late = new Date(ctx.now).getHours() >= 18;
    const thinking = r.state === 'thinking' || r.state === 'streaming';
    return html`<section class=${'card' + (late ? ' flame' : '')}>
      <div class="card-head">
        <div class="grow"><h2 class="card-title">EOD line</h2>
          <div class="small ink62">${late ? html`<span class="flame-t">Due at 19:00.</span>` : 'Three lines before ' + ctx.settings.eodCut + '. Let m360 draft it, then tweak.'}</div></div>
        ${M.ai.on(ctx) ? html`<button type="button" class="btn sec sm" disabled=${thinking} onClick=${draft}>
          ${thinking ? html`<${M.Thinking} label="Drafting"/>` : html`<span class="spark">${SPARK}</span> Write it for me`}</button>` : null}
      </div>
      ${r.state === 'error' ? html`<div class="small flame-t">${M.ai.errCopy(r.err)}</div>` : null}
      <div class="stack tight">
        <${UI.TextArea} id="wrap-shipped" label="shipped" rows=${2} value=${f.shipped} onChange=${v => set('shipped', v)} placeholder="What went out today"/>
        <${UI.Input} id="wrap-next" label="next" value=${f.next} onChange=${v => set('next', v)} placeholder="What you pick up tomorrow"/>
        <${UI.Input} id="wrap-blocked" label="blocked" value=${f.blocked} onChange=${v => set('blocked', v)} placeholder="Leave empty when nothing is in the way"/>
        <div class="row"><${UI.Btn} disabled=${!f.shipped.trim()} onClick=${post}>Post EOD line<//>
          ${edit ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => setEdit(false)}>Cancel<//>` : null}</div>
      </div>
    </section>`;
  }

  /* ---------- AI brief ---------- */
  function Brief() {
    const ctx = M.useCtx();
    const cache = M.ai.useCache(ctx);
    const r = M.ai.useRun();
    const cached = cache.data && cache.data.brief && cache.data.brief.date === U.todayStr() ? cache.data.brief.text : '';
    const text = r.text || cached;
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const slice = await M.ai.meSlice(ctx);
      const out = await r.run(o => M.ai.text(ctx,
        'Write this person a short plan for the rest of today from their data below. Format: one bold opening line ' +
        'with the single most important thing, then 3 to 5 bullets in priority order (overdue first, then what is due soonest, ' +
        'then this week\'s outcomes), then one line of encouragement. Under 110 words. Mention real task names.\n\n' + slice,
        {signal: o.signal, onText: o.onText, cache: false}));
      if (typeof out === 'string' && out) M.ai.saveCache(ctx, 'brief', {text: out});
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<section class="ai-card">
      <div class="card-head">
        <div class="grow"><${UI.Micro}>m360 ai<//><h2 class="card-title" style=${{marginTop: '4px'}}>Your day, sorted</h2></div>
        <button type="button" class=${'btn sm ' + (text ? 'sec' : '')} disabled=${busy} onClick=${go}>
          ${busy ? html`<${M.Thinking}/>` : html`<span class="spark">${SPARK}</span> ${text ? 'Refresh' : 'Brief me'}`}</button>
      </div>
      ${text ? html`<${M.AIText} text=${text}/>`
        : html`<div class="small ink62">${busy ? 'Reading your tasks, outcomes and flags.' : 'One tap and m360 lines up your day from your tasks, deadlines and this week\'s outcomes.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </section>`;
  }

  /* ---------- focus list ---------- */
  function Focus({onOpen}) {
    const ctx = M.useCtx();
    const td = U.todayStr();
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const rows = useMemo(() => {
      const map = ctx.coll.tasks.map;
      const mine = Object.keys(map).map(id => ({id, ...map[id]})).filter(t => t.owner === ctx.uid);
      const open = mine.filter(t => t.status !== 'done').sort((a, b) => {
        const ao = a.due && a.due < td ? 0 : 1, bo = b.due && b.due < td ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if ((a.due || '9') !== (b.due || '9')) return String(a.due || '9') < String(b.due || '9') ? -1 : 1;
        return (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1);
      });
      const doneToday = mine.filter(t => t.status === 'done' && t.doneAt && U.ymd(new Date(t.doneAt)) === td);
      return {open: open.slice(0, 6), more: Math.max(0, open.length - 6), doneToday};
    }, [ctx.coll.tasks.map, ctx.uid, td]);

    const complete = t => ctx.W.update('tasks/' + t.id, {status: 'done', doneAt: Date.now(), updated: Date.now()}).then(() => M.toast('Done. Nice'));
    const reopen = t => ctx.W.update('tasks/' + t.id, {status: 'doing', doneAt: null, updated: Date.now()});

    async function add() {
      const text = q.trim();
      if (!text) return;
      setBusy(true);
      let task = {title: text, owner: ctx.uid, due: '', priority: 'normal'};
      if (M.ai.on(ctx)) {
        try {
          const nm = await M.ai.names(ctx);
          const roster = ctx.activeMembers.map(m => (nm[m.uid] || '') + ' (' + (m.title || '') + ')').join(', ');
          const out = await M.ai.json(ctx, 'Turn this note into one task. Team: ' + roster + '. Today is ' + td + ' (' + U.DAYS[new Date().getDay()] + '). ' +
            'Reply with only JSON {"title": "short task starting with a verb", "owner": "first name or me", "due": "YYYY-MM-DD or empty", "priority": "low|normal|high"}.\n\nNote: ' + text,
            {tier: 'quick', cache: false});
          if (out && out.title) task = {title: String(out.title).slice(0, 140), owner: M.ai.findMember(ctx, nm, out.owner) || ctx.uid,
            due: /^\d{4}-\d{2}-\d{2}$/.test(String(out.due || '')) ? out.due : '', priority: ['low', 'normal', 'high'].indexOf(out.priority) >= 0 ? out.priority : 'normal'};
        } catch (e) { if (e && e.code && !M.ai.isOff(e.code)) M.toast(M.ai.errCopy(e.code), true); }
      }
      await ctx.W.set('tasks/' + U.uid(), {...task, client: '', project: '', section: '', status: 'todo', link: '', revisions: 0, shown20: false,
        subtasks: {}, comments: {}, by: ctx.uid, created: Date.now(), updated: Date.now(), doneAt: null}).catch(() => {});
      setQ(''); setBusy(false);
      M.toast(task.owner === ctx.uid ? 'Added to your list' : 'Task sent');
    }

    return html`<section class="card">
      <div class="card-head"><h2 class="card-title">Today's focus</h2>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => M.nav('#tasks')}>Board<//></div>
      ${rows.open.length ? rows.open.map(t => {
        const over = t.due && t.due < td;
        return html`<div class="focus" key=${t.id}>
          <button type="button" class="tick" aria-label=${'Mark ' + t.title + ' done'} onClick=${() => complete(t)}/>
          <button type="button" class="rowbtn grow" onClick=${() => onOpen(t.id)}>
            <div class="ft" style=${{fontWeight: 500}}>${t.title}</div>
            <div class="row" style=${{gap: '6px', marginTop: '5px'}}>
              ${t.due ? html`<span class=${'pill ' + (over ? 'flame' : '')}>${over ? 'overdue, ' : 'due '}${U.fmtDay(t.due)}</span>` : null}
              ${t.priority === 'high' ? html`<span class="pill flame-o">high</span>` : null}
              ${t.status === 'review' ? html`<span class="pill warm">in review</span>` : t.status === 'doing' ? html`<span class="pill">doing</span>` : null}
            </div>
          </button>
        </div>`;
      }) : html`<div class="focus"><span class="grow">Nothing open on you. Pick something from the board.</span></div>`}
      ${rows.more ? html`<div class="small ink62" style=${{marginTop: '10px'}}>${rows.more} more on your board</div>` : null}
      ${rows.doneToday.length ? html`<div style=${{marginTop: '14px'}}>
        <div class="micro" style=${{marginBottom: '8px'}}>done today, ${rows.doneToday.length}</div>
        ${rows.doneToday.slice(0, 4).map(t => html`<div class="focus done" key=${t.id}>
          <button type="button" class="tick done" aria-label=${'Reopen ' + t.title} onClick=${() => reopen(t)}>✓</button>
          <span class="ft grow">${t.title}</span></div>`)}
      </div>` : null}
      <div class="ask-in" style=${{marginTop: '14px'}}>
        <input id="quick-add" class="input" value=${q} aria-label="Add a task"
          placeholder=${M.ai.on(ctx) ? 'Add a task. Try: ask Aanya to cut the teaser by Friday' : 'Add a task'}
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }}/>
        <${UI.Btn} disabled=${busy || !q.trim()} onClick=${add}>${busy ? 'Adding' : 'Add'}<//>
      </div>
    </section>`;
  }

  /* ---------- rule flags, as a friendly list ---------- */
  function HeadsUp() {
    const ctx = M.useCtx();
    const [all, setAll] = useState(false);
    const flags = ctx.myFlags || [];
    const names = (M.rules && M.rules.NAMES) || {};
    const list = all ? flags : flags.slice(0, 3);
    return html`<section class="card">
      <div class="card-head"><h2 class="card-title">Rule box</h2>
        ${flags.length ? html`<span class="pill flame">${flags.length}</span>` : html`<span class="pill ink">clear</span>`}</div>
      ${flags.length ? list.map((f, i) => html`<div class="listrow" key=${f.rule + i}>
        <span class="dotflame" style=${f.severity === 'low' ? {background: 'var(--line2)'} : null}/>
        <div class="grow"><div style=${{fontWeight: 500}}>${names[f.rule] || f.rule}</div><div class="small ink62">${f.text}</div></div>
        ${f.ref ? html`<button type="button" class="linky small" onClick=${() => M.nav(f.ref)}>Open</button>` : null}
      </div>`) : html`<div class="small ink62">All clear.</div>`}
      ${flags.length > 3 ? html`<button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => setAll(!all)}>${all ? 'Show less' : 'Show all ' + flags.length}</button>` : null}
    </section>`;
  }

  /* ---------- my numbers ---------- */
  function Numbers() {
    const ctx = M.useCtx();
    const wk = U.periodRange('week', new Date(ctx.now));
    const map = ctx.coll.tasks.map;
    const mine = Object.keys(map).map(id => map[id]).filter(t => t.owner === ctx.uid);
    const doneWk = mine.filter(t => t.status === 'done' && t.doneAt && U.ymd(new Date(t.doneAt)) >= wk.from);
    const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, ctx.uid, wk.from, wk.to) : {total: 0};
    const board = (M.points && M.points.leaderboard) ? M.points.leaderboard(ctx, 'week', new Date(ctx.now)) : [];
    const rank = board.findIndex(r => r.uid === ctx.uid) + 1;
    const wkId = U.isoWeek(new Date(ctx.now));
    const plan = (((ctx.coll.plan.map[ctx.uid] || {}).weeks || {})[wkId] || {}).items || [];
    const marks = ((((ctx.coll.review.map[ctx.uid] || {}).weeks || {})[wkId]) || {}).marks || {};
    const hit = Object.values(marks).filter(x => x === 'hit').length;
    const overdue = mine.filter(t => t.status !== 'done' && t.due && t.due < U.todayStr()).length;
    const tile = (v, l, to, hot) => html`<button type="button" class=${'stat' + (hot ? ' hot' : '')} onClick=${() => M.nav(to)}>
      <span class="v num">${v}</span><span class="l">${l}</span></button>`;
    return html`<div class="grid4 two">
      ${tile(doneWk.length, 'shipped this week', '#tasks')}
      ${tile(overdue, 'overdue on you', '#tasks', overdue > 0)}
      ${tile(pts.total, rank ? 'points, rank ' + rank : 'points this week', '#scores')}
      ${tile(hit + '/' + plan.length, 'outcomes hit', '#week')}
    </div>`;
  }

  /* ---------- the crew right now ---------- */
  function Crew() {
    const ctx = M.useCtx();
    const td = U.todayStr();
    const people = ctx.activeMembers;
    const inCount = people.filter(m => { const a = M.att.dayStatus(ctx, m.uid, td); return a.status === 'office' || a.status === 'wfh'; }).length;
    const onlineCount = Object.keys(ctx.online || {}).length;
    return html`<section class="card">
      <div class="card-head"><h2 class="card-title">Who's in today</h2>
        <span class="small ink62 num">${inCount} of ${people.length} in${onlineCount ? ', ' + onlineCount + ' online' : ''}</span></div>
      <div class="stack tight">
        ${people.map(m => {
          const a = M.att.dayStatus(ctx, m.uid, td);
          const st = todayStatus(ctx, m.uid);
          const where = a.status === 'office' ? 'In office' : a.status === 'wfh' ? 'WFH' : a.status === 'leave' ? 'On leave' : 'Not in yet';
          return html`<button type="button" class="listrow rowbtn" key=${m.uid} onClick=${() => M.nav('#people/' + m.uid)}>
            <span class="av-wrap"><${UI.Avatar} id=${m.uid} size=${30}/>${ctx.online && ctx.online[m.uid] ? html`<span class="live" title="online now"/>` : null}</span>
            <span class="grow"><span style=${{fontWeight: 500}}><${UI.Name} id=${m.uid}/></span>
              <div class="tiny ink62">${st ? st.text : where}${a.in ? ', ' + U.hhmm(a.in) : ''}</div></span>
            ${a.late && ctx.canSee(m.uid) ? html`<span class="pill flame-o">late</span>` : null}
            <span class=${'pill ' + (a.status === 'office' ? 'ink' : a.status === 'leave' ? 'warm' : '')}>${where}</span>
          </button>`;
        })}
      </div>
    </section>`;
  }

  function Nudges() {
    const ctx = M.useCtx();
    const unread = (M.handbook && M.handbook.unread) ? M.handbook.unread(ctx, ctx.uid) : [];
    const evals = (M.hiring && M.hiring.assignedToMe) ? M.hiring.assignedToMe(ctx) : [];
    if (!unread.length && !evals.length) return null;
    return html`<section class="card warm" style=${{padding: '14px 18px'}}>
      <div class="stack tight">
        ${evals.length ? html`<button type="button" class="rowbtn row" onClick=${() => M.nav('#hiring')}>
          <span class="dotflame"/><span class="grow" style=${{fontWeight: 500}}>${evals.length} ${evals.length === 1 ? 'evaluation' : 'evaluations'} assigned to you</span><span aria-hidden="true">→</span></button>` : null}
        ${unread.length ? html`<button type="button" class="rowbtn row" onClick=${() => M.nav('#handbook/' + unread[0])}>
          <span class="dotflame"/><span class="grow" style=${{fontWeight: 500}}>${unread.length} handbook ${unread.length === 1 ? 'section' : 'sections'} to read</span><span aria-hidden="true">→</span></button>` : null}
      </div>
    </section>`;
  }

  /* ---------- quick actions ---------- */
  function Quick({onTask}) {
    const ctx = M.useCtx();
    const items = [
      {k: 'task', label: 'New task', icon: 'tasks', go: onTask},
      {k: 'post', label: 'Post an update', icon: 'feed', go: () => M.intend('#feed', 'post')},
      {k: 'kudos', label: 'Give kudos', icon: 'scores', go: () => M.intend('#feed', 'kudos')},
      {k: 'leave', label: 'Request leave', icon: 'leave', go: () => M.nav('#leave')},
      {k: 'project', label: 'New project', icon: 'projects', go: () => M.intend('#projects', 'project')},
      ctx.isFounder ? {k: 'pitch', label: 'New pitch', icon: 'pitches', go: () => M.intend('#pitches', 'pitch')}
        : {k: 'book', label: 'Handbook', icon: 'handbook', go: () => M.nav('#handbook')}
    ];
    return html`<nav class="quick" aria-label="Quick actions">
      ${items.map(it => html`<button key=${it.k} type="button" class="quick-btn" onClick=${it.go}>
        <${M.icons[it.icon]}/><span>${it.label}</span></button>`)}
    </nav>`;
  }

  /* ---------- my week: attendance and EOD, Monday to Saturday ---------- */
  function MyWeek() {
    const ctx = M.useCtx();
    const td = U.todayStr();
    const days = U.weekDays(U.mondayOf(new Date(ctx.now)));
    const eods = (ctx.coll.eod.map[ctx.uid] || {}).days || {};
    let onTime = 0, worked = 0, eodN = 0;
    const cells = days.map(d => {
      const a = M.att.dayStatus(ctx, ctx.uid, d);
      const future = d > td;
      const inDay = a.status === 'office' || a.status === 'wfh';
      if (inDay) { worked++; if (!a.late) onTime++; }
      if (eods[d]) eodN++;
      const cls = future ? 'future' : a.status === 'leave' || a.status === 'holiday' ? 'off'
        : inDay ? (a.late ? 'late' : a.status) : d === td ? 'today' : 'miss';
      const label = future ? '' : a.status === 'leave' ? 'leave' : a.status === 'holiday' ? 'holiday'
        : inDay ? (a.status === 'wfh' ? 'WFH' : 'in') + (a.in ? ' ' + U.hhmm(a.in) : '') : d === td ? 'not in yet' : 'no check-in';
      return {d, cls, label, eod: !!eods[d], today: d === td};
    });
    return html`<section class="card" id="my-week">
      <div class="card-head"><h2 class="card-title">My week</h2>
        <span class="small ink62 num">${onTime} of ${worked} on time · ${eodN} EOD</span></div>
      <div class="week-strip">
        ${cells.map(c => html`<div key=${c.d} class=${'wk-day ' + c.cls + (c.today ? ' is-today' : '')} title=${c.label}>
          <span class="wk-dow">${U.fmtDay(c.d).split(' ')[0]}</span>
          <span class="wk-dot"/>
          <span class="wk-eod">${c.eod ? '\u2713 EOD' : ''}</span>
        </div>`)}
      </div>
      <div class="wk-key tiny ink62">
        <span><i class="k office"/>office</span><span><i class="k wfh"/>WFH</span><span><i class="k late"/>late</span><span><i class="k off"/>leave</span>
      </div>
    </section>`;
  }

  /* ---------- my projects ---------- */
  function MyProjects() {
    const ctx = M.useCtx();
    const map = ctx.coll.projects.map;
    const mine = Object.keys(map).map(id => ({id, ...map[id]}))
      .filter(p => !p.archived && p.status !== 'done' && (p.owner === ctx.uid || (p.members || []).includes(ctx.uid)))
      .sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const ST = (M.projects && M.projects.STATUS) || {};
    return html`<section class="card" id="my-projects">
      <div class="card-head"><h2 class="card-title">My projects</h2>
        <button type="button" class="linky small" onClick=${() => M.nav('#projects')}>All projects</button></div>
      ${mine.length ? html`<div class="stack tight">
        ${mine.slice(0, 4).map(p => {
          const pr = (M.projects && M.projects.progress) ? M.projects.progress(ctx, p.id) : {done: 0, total: 0, overdue: 0};
          const st = ST[p.status] || {label: 'On track', pill: 'ink'};
          const client = p.client && ctx.coll.clients.map[p.client] ? ctx.coll.clients.map[p.client].name : '';
          return html`<button type="button" class="listrow rowbtn proj-row" key=${p.id} onClick=${() => M.nav('#projects/' + p.id)}>
            <span class="grow">
              <span class="row between nowrap"><b style=${{fontWeight: 500}}>${p.name}</b><span class=${'pill ' + st.pill}>${st.label}</span></span>
              <span class="tiny ink62">${client ? client + ' · ' : ''}${pr.done} of ${pr.total} done${pr.overdue ? ', ' + pr.overdue + ' overdue' : ''}${p.due ? ' · due ' + U.fmtDay(p.due) : ''}</span>
              <${UI.Bar} a=${pr.done} max=${pr.total || 1} thin=${true}/>
            </span>
          </button>`;
        })}
      </div>` : html`<div class="small ink62">Nothing on you right now. <button type="button" class="linky small" onClick=${() => M.intend('#projects', 'project')}>Start a project</button></div>`}
    </section>`;
  }

  /* ---------- latest on the feed, and this week's top three ---------- */
  function Buzz() {
    const ctx = M.useCtx();
    const items = (M.feed && M.feed.stream) ? M.feed.stream(ctx).filter(i => !i.pinned).slice(0, 3) : [];
    const board = (M.points && M.points.leaderboard) ? M.points.leaderboard(ctx, 'week', new Date(ctx.now)).slice(0, 3) : [];
    return html`<section class="card" id="buzz">
      <div class="card-head"><h2 class="card-title">Around the studio</h2>
        <button type="button" class="linky small" onClick=${() => M.nav('#feed')}>Open feed</button></div>
      ${items.length ? html`<div class="stack tight">
        ${items.map(it => html`<button type="button" class="listrow rowbtn" key=${it.key} onClick=${() => M.nav('#feed')}>
          <${UI.Avatar} id=${it.type === 'kudos' ? it.giver : it.author} size=${28}/>
          <span class="grow" style=${{minWidth: 0}}>
            <span class="small"><b style=${{fontWeight: 500}}><${UI.Name} id=${it.type === 'kudos' ? it.giver : it.author}/></b>
              ${it.type === 'kudos' ? html` gave kudos to <${UI.Name} id=${it.to}/>` : it.kind === 'win' ? ' shared a win' : ''}</span>
            <span class="tiny ink62 clamp1">${it.type === 'kudos' ? it.why : it.text}</span>
          </span>
          <span class="tiny ink62 nowrap">${U.timeAgo(it.at)}</span>
        </button>`)}
      </div>` : html`<div class="small ink62">Quiet so far. <button type="button" class="linky small" onClick=${() => M.intend('#feed', 'post')}>Post the first update</button></div>`}
      ${board.length ? html`<div class="topthree">
        <div class="micro plain" style=${{marginBottom: '8px'}}>top this week</div>
        ${board.map((r, i) => html`<button type="button" class="top-row rowbtn" key=${r.uid} onClick=${() => M.nav('#scores')}>
          <span class=${'rank num' + (i === 0 ? ' first' : '')}>${i + 1}</span>
          <${UI.Avatar} id=${r.uid} size=${24}/><span class="grow small"><${UI.Name} id=${r.uid}/></span>
          <span class="num small">${r.total} pts</span>
        </button>`)}
      </div>` : null}
    </section>`;
  }

  /* ---------- page ---------- */
  function Home() {
    const ctx = M.useCtx();
    const [task, setTask] = useState(null);
    const [status, setStatus] = useState(false);
    const td = U.todayStr();
    const a = M.att.dayStatus(ctx, ctx.uid, td);
    const hour = new Date(ctx.now).getHours();
    const eodPosted = !!(((ctx.coll.eod.map[ctx.uid] || {}).days || {})[td]);
    const working = a.status !== 'leave' && a.status !== 'holiday' && a.status !== 'sunday';
    const eodFirst = working && (hour >= 16 || !!a.out || eodPosted);
    const Drawer = M.parts.TaskDrawer, Outcomes = M.parts.OutcomesCard, Day = M.parts.YourDay, Onboard = M.parts.Onboarding;
    const newHire = (M.people && M.people.isNewHire) ? M.people.isNewHire(ctx, ctx.uid) : false;

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${Hero} onStatus=${() => setStatus(true)}/>
      ${M.parts.JoinBanner ? html`<${M.parts.JoinBanner}/>` : null}
      <${Announcement}/>
      <${Quick} onTask=${() => setTask('new')}/>
      <div class="split">
        <div class="stack" style=${{gap: '18px'}}>
          ${eodFirst ? html`<${Wrap}/>` : null}
          <${Focus} onOpen=${setTask}/>
          <${Brief}/>
          <${MyProjects}/>
          ${Outcomes ? html`<${Outcomes}/>` : null}
          ${!eodFirst && working ? html`<${Wrap}/>` : null}
          ${newHire && Onboard ? html`<${Onboard} uid=${ctx.uid} compact=${true}/>` : null}
        </div>
        <div class="stack" style=${{gap: '18px'}}>
          <${Numbers}/>
          <${MyWeek}/>
          <${HeadsUp}/>
          <${Nudges}/>
          <${Crew}/>
          <${Buzz}/>
          ${Day ? html`<${Day}/>` : null}
        </div>
      </div>
      ${task && Drawer ? html`<${Drawer} taskId=${task === 'new' ? null : task} defaults=${{owner: ctx.uid}} onClose=${() => setTask(null)}/>` : null}
      ${status ? html`<${StatusPicker} onClose=${() => setStatus(false)}/>` : null}
    </div>`;
  }

  M.pages.Home = Home;
})();
