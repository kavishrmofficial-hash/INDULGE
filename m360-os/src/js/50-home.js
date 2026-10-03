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
      .then(() => { M.toast(t ? 'Status set' : 'Status cleared'); onClose(); }).catch(() => {});
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
    const phone = M.usePhone();
    const cap = Number(ctx.settings.wfhCap) || 0;
    const used = (M.att && M.att.wfhUsed) ? M.att.wfhUsed(ctx, ctx.uid, new Date()) : 0;
    const wfhFull = used >= cap;

    async function save(loc, m) {
      const days = U.clone((ctx.coll.checkin.map[ctx.uid] || {}).days || {});
      const entry = {in: Date.now(), out: null, mode: m, loc, outLoc: null};
      if (mood) entry.mood = mood;
      days[U.todayStr()] = entry;
      await ctx.W.merge('checkin/' + ctx.uid, {days: U.prunePatch(days)});
      M.burst(document.getElementById('tapin'));
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
    return html`<div class="stack" id="tapin" style=${{gap: '14px'}}>
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
      </div>` : html`<div><${M.fx.Metal} kind="paper" block=${phone}><button type="button" class="btn xl on-dark" disabled=${busy} onClick=${tap}>
        ${busy ? html`<${M.fx.Orb} state="searching" size=${20} dark=${false} label="finding your location"/> Checking in` : (mode === 'wfh' ? 'Check in, WFH' : 'Check in, office')}</button><//></div>`}
      <div class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>WFH days used this week: ${used} of ${cap}. Checking in records the time and your location at that moment. Kaavish can see both.</div>
    </div>`;
  }

  function InNow() {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const a = M.att.dayStatus(ctx, ctx.uid, today);
    const [busy, setBusy] = useState(false);
    /* a check-out pressed by mistake: the founder reopens the day in one tap; everyone else asks Kaavish */
    const reopenSent = a.out && M.fixes && M.fixes.reopenPending ? M.fixes.reopenPending(ctx, ctx.uid, today) : false;
    async function reopen() {
      setBusy(true);
      const days = U.clone((ctx.coll.checkin.map[ctx.uid] || {}).days || {});
      const e = days[today];
      if (e && e.out) { e.out = null; e.outLoc = null; days[today] = e; await ctx.W.merge('checkin/' + ctx.uid, {days: U.prunePatch(days)}).catch(() => {}); }
      setBusy(false);
      M.toast('Day reopened');
    }
    async function out() {
      setBusy(true);
      const pos = await M.getLoc();
      const days = U.clone((ctx.coll.checkin.map[ctx.uid] || {}).days || {});
      const e = days[U.todayStr()] || {};
      e.out = Date.now(); e.outLoc = pos ? M.att.locFrom(pos, ctx.settings.office) : null;
      days[U.todayStr()] = e;
      await ctx.W.merge('checkin/' + ctx.uid, {days: U.prunePatch(days)}).catch(() => {});
      setBusy(false);
      M.sound.play('done');
      M.toast('Checked out. See you tomorrow');
      if (M.dayrate) M.dayrate.open();
    }
    const rated = a.out && M.dayrate ? M.dayrate.todayOf(ctx, ctx.uid) : null;
    return html`<div class="row between" style=${{alignItems: 'flex-end'}}>
      <div>
        <div class="display" style=${{fontSize: '26px'}}>${a.out ? 'Done for today' : 'In since ' + U.hhmm(a.in)}</div>
        <div class="small" style=${{color: 'rgba(255,255,255,.7)', marginTop: '6px'}}>
          ${a.out ? 'In ' + U.hhmm(a.in) + ', out ' + U.hhmm(a.out) + ', ' + U.durText(a.out - a.in) + '. ' : ''}${a.status === 'wfh' ? 'WFH' : 'Office'}, ${(a.place || 'no location').replace(/\.$/, '')}${a.verified ? ', verified' : ''}.
          ${a.late ? html` <span class="flame-t">Late.</span>` : null}
        </div>
      </div>
      ${a.out ? (rated != null ? html`<span class="pill on-dark" id="home-rated" title="How your day went">${M.dayrate.faceFor(rated)[1]} ${M.dayrate.faceFor(rated)[2]}</span>`
        : (M.dayrate ? html`<button type="button" class="btn on-dark sec sm" id="home-rate" onClick=${() => M.dayrate.open()}>How did it go?</button>` : null))
        : html`<button type="button" class="btn on-dark sec sm" disabled=${busy} onClick=${out}>Check out</button>`}
    </div>
    ${a.out ? (reopenSent
      ? html`<div class="small" id="home-reopen-sent" style=${{color: 'rgba(255,255,255,.7)', marginTop: '12px'}}><span class="dotflame"/> Asked Kaavish to reopen the day. It opens again when he approves; the answer lands in your inbox.</div>`
      : html`<div class="row" style=${{marginTop: '12px', gap: '10px'}}>
        <span class="small" style=${{color: 'rgba(255,255,255,.7)'}}>Checked out by mistake?</span>
        ${ctx.isFounder
          ? html`<button type="button" class="btn on-dark sec sm" id="home-reopen" disabled=${busy} onClick=${reopen}>Reopen the day</button>`
          : html`<button type="button" class="btn on-dark sec sm" id="home-reopen" disabled=${busy} onClick=${() => M.fixes && M.fixes.ask({kind: 'attendance', field: 'reopen', date: today})}>Ask Kaavish to reopen the day</button>`}
      </div>`) : null}`;
  }

  function Clock() {
    const t = M.useClock();
    return html`<span class="hero-clock"><span aria-hidden="true">\u00b7</span><span class="clock num">${U.hhmm(t)}</span></span>`;
  }

  /* ---------- the sky: the moment of day the hero speaks to ----------
     Day runs 6:00 to 19:30. The hero carries one small mark in its date line: a flame dot by
     day, a paper ring moon at night. The arc numbers (x, y, size) still describe where the sun
     would stand, for previews and tests; the stylesheet no longer draws it at that size.
     M.hero.at pins the moment for previews and tests. */
  const DAY_FROM = 6 * 60, DAY_TO = 19 * 60 + 30;
  M.hero = {
    at: null,
    mode(d) {
      d = d || (M.hero.at ? new Date(M.hero.at) : new Date());
      const min = d.getHours() * 60 + d.getMinutes();
      const night = min < DAY_FROM || min >= DAY_TO;
      /* px and py place it on a phone, where the sky is a band above the greeting */
      if (night) return {mode: 'night', x: 48, y: 20, px: 84, py: 34, size: 132, greeting: U.greeting(d)};
      const t = (min - DAY_FROM) / (DAY_TO - DAY_FROM);
      const arc = Math.sin(Math.PI * t);
      const x = Math.round(10 + t * 52);
      return {mode: 'day', x, y: Math.round(66 - arc * 54), px: Math.round(12 + t * 76), py: Math.round(70 - arc * 56), size: Math.round(160 + arc * 84), greeting: U.greeting(d)};
    }
  };
  M.heroMode = d => M.hero.mode(d);

  /* ---------- hero ---------- */
  function Hero({onStatus}) {
    const ctx = M.useCtx();
    const clock = M.useClock();
    const now = M.hero.at ? new Date(M.hero.at) : new Date(clock);
    const sky = M.hero.mode(now);
    const night = sky.mode === 'night';
    const chip = 'chipline' + (night ? ' on-dark' : '');
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
    const hol = M.holidays ? M.holidays.tomorrow(ctx) : null;
    const chipInk = night ? '#F2F1EC' : undefined;
    const panel = html`<div class="hero-panel">${special ? html`<div class="display" style=${{fontSize: '24px'}}>${special}</div>`
          : (a.in ? html`<${InNow}/>` : html`<${TapIn}/>`)}</div>`;
    return html`<header class=${'hero home-hero ' + (night ? 'ink night' : 'day')} id="home-hero" data-mode=${sky.mode}
      style=${{'--sx': sky.x + '%', '--sy': sky.y + '%', '--px': sky.px + '%', '--py': sky.py + '%', '--sun': sky.size + 'px'}}>
      <div class="hero-in">
        <div class="hero-greet">
          <${UI.Micro} plain><span class="sky" aria-hidden="true">${night ? html`<span class="moon"/>` : html`<span class="sun"/>`}</span>${U.dateLabel(now)} <${Clock}/><//>
          <h1 class="hi">${sky.greeting},<br/>${first}.</h1>
          <div class="hero-chips">
            <span class=${chip}><b class="num"><${M.fx.MetalText} size=${15} color=${chipInk}>${String(inStreak)}<//></b> day streak</span>
            <span class=${chip}><b class="num">${eodStreak}</b> EOD lines in a row</span>
            <span class=${chip}>level <b class="num"><${M.fx.MetalText} size=${15} color=${chipInk}>${String(lv.lvl)}<//></b></span>
            <button type="button" class=${'chip ' + chip} onClick=${onStatus}><${M.icons.edit}/>${st ? st.text : 'Set a status'}</button>
          </div>
          ${hol ? html`<div class="hero-tomorrow" id="hero-tomorrow"><span class="dotflame"/><span>${M.holidays.line(hol)}</span></div>` : null}
        </div>
        ${panel}
      </div>
    </header>`;
  }

  /* ---------- quiet: the person hears first ----------
     A quiet stretch (M.quiet) reaches the manager's watch at settings.quietMins. Half an hour before
     that (never under 30 minutes in) the person gets one gentle line here, with the three ways to
     answer it. It goes the moment they save anything or set a status, and it never rings. A status
     ends nothing on the manager's watch, it is read beside the flag, and the line says so. Nothing
     shows on leave, holidays, Sundays, before the check-in or after the check-out (M.quiet.day has
     no running gap then), or for anyone without a manager. */
  const MIN = 60000;
  /* a stretch is only as true as the marks behind it: until every collection M.quiet reads has arrived,
     a gap would run from the check-in, so nothing quiet shows on a page still loading */
  const QUIET_FROM = ['checkin', 'eod', 'tasks', 'feed', 'kudos', 'me', 'leave', 'leavedec'];
  const quietReady = ctx => QUIET_FROM.every(k => !ctx.coll[k] || ctx.coll[k].ready);
  function QuietNudge({onStatus}) {
    const ctx = M.useCtx();
    const mgr = M.quiet && M.lines ? M.lines.managerOf(ctx, ctx.uid) : null;
    if (!mgr || !quietReady(ctx)) return null;
    const td = U.todayStr();
    const q = M.quiet.day(ctx, ctx.uid, td, {now: Number(ctx.now) || Date.now()});
    const idle = q.idle;
    /* a mark after the gap began is a save the minute clock has not caught up with */
    if (!idle || q.marks.some(m => m.s > idle.from)) return null;
    /* a status set since answers it too, until the quiet runs on that long again past it */
    const st = todayStatus(ctx, ctx.uid);
    let quiet = idle.quietMs;
    if (st && st.at > idle.from) {
      const d0 = U.parseYmd(td).getTime();
      const l = q.lunch ? Math.max(0, Math.min(idle.to, d0 + q.lunch[1] * MIN) - Math.max(st.at, d0 + q.lunch[0] * MIN)) : 0;
      quiet = Math.max(0, idle.to - st.at - l);
    }
    if (quiet < Math.max(30, q.mins - 30) * MIN) return null;
    const after = q.mins % 60 ? M.quiet.dur(q.mins * MIN) : q.mins / 60 + (q.mins === 60 ? ' hour' : ' hours');
    return html`<section class="card warm quiet-nudge" id="quiet-nudge">
      <div class="row nowrap qn-line"><span class="dotflame"/><span class="grow" style=${{fontWeight: 500}}>Nothing saved since ${U.hhmm(idle.from)}. Move a task, post what you are on, or set a status.</span></div>
      <div class="row qn-act">
        <${UI.Btn} kind="sec" sm=${true} id="qn-board" onClick=${() => M.nav('#tasks')}>Open the board<//>
        <${UI.Btn} kind="sec" sm=${true} id="qn-post" onClick=${() => M.intend('#feed', 'post')}>Post an update<//>
        <${UI.Btn} kind="sec" sm=${true} id="qn-status" onClick=${onStatus}>Set a status<//>
      </div>
      <div class="tiny ink62 qn-why">After ${after} with nothing saved (lunch aside), it reaches ${mgr === ctx.founderUid ? 'Kaavish' : 'your manager and Kaavish'}, with any status you set beside it.</div>
    </section>`;
  }

  /* ---------- add m360 to the home screen: one card, once, on phones in a browser ----------
     Chromium hands over its install prompt through beforeinstallprompt, kept for the Install
     button. iOS has no prompt, so the card says where the option lives. The card never shows
     inside another page (the claude.ai frame) or once the app runs standalone. */
  let installEvt = null;
  try {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; window.dispatchEvent(new CustomEvent('m360:install')); });
  } catch (e) { /* old browser */ }
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => { try { return !!(navigator.standalone || window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; } };
  const framed = () => { try { return window.self !== window.top; } catch (e) { return true; } };
  function InstallHint() {
    const [gone, setGone] = useState(() => M.prefs.get('a2hs', '') === '1');
    const [narrow, setNarrow] = useState(() => window.innerWidth < 700);
    const [, bump] = useState(0);
    React.useEffect(() => {
      const on = () => setNarrow(window.innerWidth < 700);
      const got = () => bump(x => x + 1);
      window.addEventListener('resize', on); window.addEventListener('m360:install', got);
      return () => { window.removeEventListener('resize', on); window.removeEventListener('m360:install', got); };
    }, []);
    if (gone || !narrow || standalone() || framed()) return null;
    const dismiss = () => { M.prefs.set('a2hs', '1'); setGone(true); };
    const install = async () => {
      const e = installEvt;
      if (!e) return;
      installEvt = null;
      try {
        e.prompt();
        const r = await e.userChoice;
        if (r && r.outcome === 'accepted') M.toast('Added. m360 is on your home screen');
      } catch (err) { /* the browser declined to prompt */ }
      dismiss();
    };
    const ios = isIOS();
    const line = ios ? 'Tap Share, then Add to Home Screen. It opens full screen, like an app.'
      : installEvt ? 'One tap and it opens full screen, like an app.'
        : 'Open the browser menu and choose Add to Home screen. It opens full screen, like an app.';
    return html`<section class="card install-hint" id="install-hint">
      <div class="row nowrap" style=${{alignItems: 'flex-start', gap: '12px'}}>
        <span class="ic"><${M.Mark} width="26px"/></span>
        <div class="grow">
          <div style=${{fontWeight: 500}}>Add m360 to your home screen</div>
          <div class="small ink62" style=${{marginTop: '2px'}}>${line}</div>
        </div>
      </div>
      <div class="row" style=${{marginTop: '10px', gap: '6px'}}>
        ${!ios && installEvt ? html`<${UI.Btn} sm=${true} onClick=${install}>Install<//>` : null}
        <${UI.Btn} kind="ghost" sm=${true} onClick=${dismiss}>Not now<//>
      </div>
    </section>`;
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
    return html`<${M.fx.Beam}><section class="card flame">
      <div class="row"><span class="pill flame">announcement</span><${UI.Avatar} id=${au} size=${22}/>
        <span class="small" style=${{fontWeight: 500}}><${UI.Name} id=${au}/></span><span class="tiny ink62">${U.timeAgo(post.at)}</span></div>
      <p style=${{whiteSpace: 'pre-wrap', margin: '10px 0 14px', fontSize: '16px'}}>${post.text}</p>
      <${UI.Btn} sm=${true} onClick=${() => ctx.W.merge('acks/' + ctx.uid, {s: {[ackKey]: Date.now()}}).catch(() => {})}>Got it<//>
    </section><//>`;
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
      await ctx.W.merge('eod/' + ctx.uid, {days: U.prunePatch(days)});
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
    const cutHour = parseInt(String(ctx.settings.eodCut || '19:30'), 10) || 19;
    const late = new Date(ctx.now).getHours() >= cutHour - 1;
    const thinking = r.state === 'thinking' || r.state === 'streaming';
    return html`<section class=${'card' + (late ? ' flame' : '')}>
      <div class="card-head">
        <div class="grow"><h2 class="card-title">EOD line</h2>
          <div class="small ink62">${late ? html`<span class="flame-t">${'Due at ' + ctx.settings.eodCut + '.'}</span>` : 'Three lines before ' + ctx.settings.eodCut + '. Let m360 draft it, then tweak.'}</div></div>
        ${M.ai.on(ctx) ? html`<span class="row nowrap fxh-act"><${M.fx.Bot} feature="writer" state=${thinking ? 'working' : 'default'} size=${30} label=${thinking ? 'm360, writing' : 'm360 writer'}/>
          <button type="button" class="btn sec sm" disabled=${thinking} onClick=${draft}>
          ${thinking ? html`<${M.Thinking} label="Drafting"/>` : html`<span class="spark">${SPARK}</span> Write it for me`}</button></span>` : null}
      </div>
      ${thinking ? html`<div class="row nowrap fxh-drafting"><${M.fx.Orb} state="composing" size=${32} label="m360 is writing"/><span class="small ink62">Writing your three lines from today's work.</span></div>` : null}
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
    const phone = M.usePhone();
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
    const btn = html`<button type="button" class=${'btn sm ' + (text ? 'sec' : '')} disabled=${busy} onClick=${go}>
          ${busy ? html`<${M.Thinking} state="composing"/>` : html`<span class="spark">${SPARK}</span> ${text ? 'Refresh' : 'Brief me'}`}</button>`;
    return html`<${M.fx.Beam} radius=${phone ? 18 : 20}><section class="ai-card fxh-brief">
      <div class="card-head">
        <${M.fx.Bot} feature="brief" state=${busy ? 'working' : 'default'} size=${34} label=${busy ? 'm360, sorting your day' : 'm360 brief'}/>
        <div class="grow"><${UI.Micro}>m360 ai<//><h2 class="card-title" style=${{marginTop: '4px'}}>Your day, sorted</h2></div>
        ${text ? btn : html`<${M.fx.Metal} kind="ink">${btn}<//>`}
      </div>
      ${text ? html`<${M.AIText} text=${text}/>`
        : busy ? html`<div class="row nowrap fxh-drafting"><${M.fx.Orb} state="composing" size=${32} label="m360 is drafting"/><span class="small ink62">Reading your tasks, outcomes and flags.</span></div>`
        : html`<div class="small ink62">One tap and m360 lines up your day from your tasks, deadlines and this week's outcomes.</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </section><//>`;
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

    const complete = t => { const sp = M.tasks.statusPatch(t, 'done', ctx.uid, ctx); return M.tasks.commit(ctx, t.id, sp).then(() => M.toast(sp.status === 'done' ? 'Done. Nice' : 'Sent for sign-off')).catch(() => {}); };
    const reopen = t => ctx.W.update('tasks/' + t.id, M.tasks.statusPatch(t, 'doing', ctx.uid, ctx).patch).catch(() => {});

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
        <${M.fx.Beam} radius=${12} size="sm"><input id="quick-add" class="input" value=${q} aria-label="Add a task"
          placeholder=${M.ai.on(ctx) ? 'Add a task. Try: ask Aanya to cut the teaser by Friday' : 'Add a task'}
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }}/><//>
        <${UI.Btn} disabled=${busy || !q.trim()} onClick=${add}>${busy ? html`<${M.fx.Orb} state=${M.ai.on(ctx) ? 'solving' : 'working'} size=${20} label="adding"/> Adding` : 'Add'}<//>
      </div>
    </section>`;
  }

  /* ---------- your team: each report's day, with the watch flags ---------- */
  /* one flag line. A quiet stretch (M.quiet) keeps a line of its own, keyed by when it began; the one
     still running carries the listening orb, so it reads as happening now. Quiet lines come last, in
     time order, and open the person's day. */
  function TeamFlag({f, uid}) {
    const quiet = f.k === 'quiet';
    const mark = quiet && f.live
      ? html`<span class="tf-live" role="img" aria-label="happening now" title="happening now"><${M.fx.Orb} state="listening" size=${20}/></span>`
      : html`<span class="dotflame" style=${f.hot ? null : {background: 'var(--ink62)'}}/>`;
    return html`<div class=${'small team-flag' + (quiet ? ' quiet' : '')} data-k=${f.k} data-hot=${f.hot ? '1' : '0'} data-live=${quiet ? (f.live ? '1' : '0') : undefined}>
      ${mark}<span class=${'grow' + (f.hot ? '' : ' ink62')} style=${{fontWeight: f.hot ? 500 : 400}}>${U.cap(f.text)}</span>${M.parts.PmFlagChip && uid ? html`<${M.parts.PmFlagChip} uid=${uid} f=${f}/>` : null}${f.ref ? html`<button type="button" class="linky tiny" onClick=${() => M.nav(f.ref)}>${quiet ? 'See the day' : 'Open'}</button>` : null}</div>`;
  }
  const flagOrder = flags => flags.filter(f => f.k !== 'quiet').concat(flags.filter(f => f.k === 'quiet').sort((a, b) => (a.at || 0) - (b.at || 0)));

  function TeamWatch() {
    const ctx = M.useCtx();
    if (!M.lines) return null;
    const ready = quietReady(ctx);
    const board = M.lines.board(ctx, ctx.uid).map(r => ready ? r : {...r, flags: r.flags.filter(f => f.k !== 'quiet')});
    if (!board.length) return null;
    const td = U.todayStr();
    const hot = board.reduce((n, r) => n + r.flags.filter(f => f.hot).length, 0);
    const all = board.reduce((n, r) => n + r.flags.length, 0);
    const F = UI.Fold;
    return html`<${F} title="Your team" summary=${all ? all + (all === 1 ? ' thing to look at' : ' things to look at') : 'all moving'} hot=${hot > 0} open=${all > 0} id="fold-team">
      <${UI.Card} flame=${hot > 0} id="team-watch" title="Your team" action=${html`<span class="row nowrap team-head-acts">${M.parts.PmTeamHead ? html`<${M.parts.PmTeamHead}/>` : null}${all ? html`<span class=${'pill ' + (hot ? 'flame' : 'warm')}>${all}</span>` : html`<span class="pill ink">all moving</span>`}</span>`}>
        <div class="stack tight">${board.map(r => {
          const a = M.att.dayStatus(ctx, r.uid, td);
          const where = a.status === 'office' ? 'in office' : a.status === 'wfh' ? 'WFH' : a.status === 'leave' ? 'on leave' : a.status === 'holiday' ? 'holiday' : a.status === 'sunday' ? 'Sunday' : 'not in yet';
          const rate = M.dayrate ? M.dayrate.todayOf(ctx, r.uid) : null;
          return html`<div class="listrow team-row" key=${r.uid} id=${'team-' + r.uid}>
            <button type="button" class="rowbtn" style=${{width: 'auto'}} aria-label="Open their page" onClick=${() => M.nav('#people/' + r.uid)}><${UI.Avatar} id=${r.uid} size=${30}/></button>
            <div class="grow" style=${{minWidth: 0}}>
              <div class="row between"><span style=${{fontWeight: 500}}><${UI.Name} id=${r.uid}/></span><span class="tiny ink62">${where}${a.in ? ', ' + U.hhmm(a.in) : ''}${a.out ? ' to ' + U.hhmm(a.out) : ''}${rate != null ? ' ' + M.dayrate.faceFor(rate)[1] : ''}</span></div>
              ${r.flags.length ? flagOrder(r.flags).map(f => html`<${TeamFlag} key=${f.key || f.k} f=${f} uid=${r.uid}/>`) : html`<div class="small ink62">Moving along.</div>`}
              ${M.parts.PmTeamExtra ? html`<${M.parts.PmTeamExtra} uid=${r.uid}/>` : null}
            </div>
          </div>`; })}</div>
      <//>
    <//>`;
  }

  /* ---------- rule flags, as a friendly list ---------- */
  function HeadsUp() {
    const ctx = M.useCtx();
    const [all, setAll] = useState(false);
    /* the most pressing first: a running quiet stretch or a missed check-in never hides behind a low reminder */
    const SEV = {high: 0, medium: 1, low: 2};
    const flags = (ctx.myFlags || []).slice().sort((a, b) => (SEV[a.severity] == null ? 1 : SEV[a.severity]) - (SEV[b.severity] == null ? 1 : SEV[b.severity]));
    const names = (M.rules && M.rules.NAMES) || {};
    const list = all ? flags : flags.slice(0, 3);
    return html`<section class="card">
      <div class="card-head"><h2 class="card-title">Rule box</h2>
        ${flags.length ? html`<span class="pill flame">${flags.length}</span>` : html`<span class="pill ink">clear</span>`}</div>
      ${flags.length ? list.map((f, i) => html`<div class="listrow" key=${f.rule + i}>
        <span class="dotflame" style=${f.severity === 'low' ? {background: 'var(--ink62)'} : null}/>
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
    /* points and rank follow the board's week, which stays on last week until Monday is done */
    const br = (M.points && M.points.boardRange) ? M.points.boardRange(ctx, 'week', new Date(ctx.now)) : {from: wk.from, to: wk.to, label: 'this week'};
    const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, ctx.uid, br.from, br.to) : {total: 0};
    const board = (M.points && M.points.leaderboard) ? M.points.leaderboard(ctx, 'week', new Date(ctx.now)) : [];
    const rank = board.findIndex(r => r.uid === ctx.uid) + 1;
    const ptsLabel = rank ? (br.label === 'last week' ? 'last week, rank ' + rank : 'points, rank ' + rank) : 'points ' + (br.label || 'this week');
    const wkId = U.isoWeek(new Date(ctx.now));
    const plan = (((ctx.coll.plan.map[ctx.uid] || {}).weeks || {})[wkId] || {}).items || [];
    const marks = ((((ctx.coll.review.map[ctx.uid] || {}).weeks || {})[wkId]) || {}).marks || {};
    const hit = Object.values(marks).filter(x => x === 'hit').length;
    const overdue = mine.filter(t => t.status !== 'done' && t.due && t.due < U.todayStr()).length;
    const phone = M.usePhone();
    const tile = (v, l, to, hot) => html`<button type="button" class=${'stat' + (hot ? ' hot' : '')} onClick=${() => M.nav(to)}>
      <span class="v num"><${M.fx.MetalText} size=${phone ? 28 : 34} weight=${600} color=${hot ? M.fx.FLAME : undefined}>${String(v)}<//></span><span class="l">${l}</span></button>`;
    return html`<div class="grid4 two">
      ${tile(doneWk.length, 'shipped this week', '#tasks')}
      ${tile(overdue, 'overdue on you', '#tasks', overdue > 0)}
      ${tile(pts.total, ptsLabel, '#scores')}
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
            ${M.dayrate && a.out && M.dayrate.todayOf(ctx, m.uid) != null ? html`<span class="crew-face" title=${'rated the day ' + M.dayrate.faceFor(M.dayrate.todayOf(ctx, m.uid))[2].toLowerCase()} aria-label=${'rated the day ' + M.dayrate.faceFor(M.dayrate.todayOf(ctx, m.uid))[2].toLowerCase()}>${M.dayrate.faceFor(M.dayrate.todayOf(ctx, m.uid))[1]}</span>` : null}
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
      {k: 'focus', label: 'Focus', icon: 'timer', go: () => M.focus && M.focus.open()},
      {k: 'post', label: 'Post an update', icon: 'feed', go: () => M.intend('#feed', 'post')},
      {k: 'kudos', label: 'Give kudos', icon: 'scores', go: () => M.intend('#feed', 'kudos')},
      {k: 'breathe', label: 'Breathe', icon: 'breath', go: () => M.breathe && M.breathe.open()},
      ctx.isFounder ? {k: 'pitch', label: 'New pitch', icon: 'pitches', go: () => M.intend('#pitches', 'pitch')}
        : {k: 'leave', label: 'Request leave', icon: 'leave', go: () => M.nav('#leave')}
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
        <span><i class="k office"/>office</span><span><i class="k wfh"/>WFH</span><span><i class="k late"/>late</span><span><i class="k miss"/>no check-in</span><span><i class="k off"/>leave</span>
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
    const boardLabel = (M.points && M.points.boardRange) ? (M.points.boardRange(ctx, 'week', new Date(ctx.now)).label || 'this week') : 'this week';
    return html`<section class="card" id="buzz">
      <div class="card-head"><h2 class="card-title">Around the studio</h2>
        <button type="button" class="linky small" onClick=${() => M.nav('#feed')}>Open feed</button></div>
      ${items.length ? html`<div class="stack tight">
        ${items.map(it => html`<button type="button" class="listrow rowbtn" key=${it.key} onClick=${() => M.nav('#feed')}>
          <${UI.Avatar} id=${it.type === 'kudos' ? it.giver : it.author} size=${28}/>
          <span class="grow" style=${{minWidth: 0}}>
            <span class="small"><b style=${{fontWeight: 500}}><${UI.Name} id=${it.type === 'kudos' ? it.giver : it.author}/></b>
              ${it.type === 'kudos' ? html` gave kudos to <${UI.Name} id=${it.to}/>` : it.kind === 'win' ? html` shared a win <${M.fx.MetalBadge}>win<//>` : ''}</span>
            <span class="tiny ink62 clamp1">${it.type === 'kudos' ? it.why : it.text}</span>
          </span>
          <span class="tiny ink62 nowrap">${U.timeAgo(it.at)}</span>
        </button>`)}
      </div>` : html`<div class="small ink62">Quiet so far. <button type="button" class="linky small" onClick=${() => M.intend('#feed', 'post')}>Post the first update</button></div>`}
      ${board.length ? html`<div class="topthree">
        <div class="micro plain" style=${{marginBottom: '8px'}}>${'top ' + boardLabel}</div>
        ${board.map((r, i) => html`<button type="button" class="top-row rowbtn" key=${r.uid} onClick=${() => M.nav('#scores')}>
          <span class=${'rank num' + (i === 0 ? ' first' : '')}>${i + 1}</span>
          <${UI.Avatar} id=${r.uid} size=${24}/><span class="grow small"><${UI.Name} id=${r.uid}/></span>
          ${i === 0 ? html`<${M.fx.MetalBadge}>top<//>` : null}
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
    M.useIntent('checkin', () => setTimeout(() => { const el = document.getElementById('tapin') || document.getElementById('home-hero'); if (el) el.scrollIntoView({block: 'center', behavior: M.reduced() ? 'auto' : 'smooth'}); const b = el && el.querySelector('.btn'); if (b) b.focus(); }, 80));
    const Celebrate = M.parts.Celebrate, Reviews = M.parts.Reviews;
    const newHire = (M.people && M.people.isNewHire) ? M.people.isNewHire(ctx, ctx.uid) : false;
    /* one line summaries for the phone folds */
    const F = UI.Fold;
    const myOpen = (M.tasks && M.tasks.open) ? M.tasks.open(ctx).filter(t => t.owner === ctx.uid) : [];
    const myLate = myOpen.filter(t => t.due && t.due < td).length;
    const revN = (M.reviews && M.reviews.queue) ? M.reviews.queue(ctx).filter(t => M.reviews.canReview(ctx, t)).length : 0;
    const pmap = ctx.coll.projects.map;
    const projN = Object.keys(pmap).filter(id => { const p = pmap[id]; return p && !p.archived && p.status !== 'done' && (p.owner === ctx.uid || (p.members || []).includes(ctx.uid)); }).length;
    const flagN = (ctx.myFlags || []).length;
    const inN = ctx.activeMembers.filter(m => { const s = M.att.dayStatus(ctx, m.uid, td).status; return s === 'office' || s === 'wfh'; }).length;
    const wk = U.periodRange('week', new Date(ctx.now));
    const brWk = (M.points && M.points.boardRange) ? M.points.boardRange(ctx, 'week', new Date(ctx.now)) : {from: wk.from, to: wk.to, label: 'this week'};
    const ptsWk = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, ctx.uid, brWk.from, brWk.to).total : 0;
    const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
    /* the personal manager's card takes the quiet nudge's place while the bot chases this person or an ask is open */
    const pmCard = !!(M.parts.PmCard && M.pm && M.pm.loaded(ctx) && (M.pm.chases(ctx, ctx.uid, 'quiet') || M.pm.cardItems(ctx, Number(ctx.now) || Date.now()).length));
    M.useIntent('eod', () => setTimeout(() => { const el = document.getElementById('fold-eod') || document.getElementById('wrap-shipped'); if (el) el.scrollIntoView({block: 'center', behavior: M.reduced() ? 'auto' : 'smooth'}); const f = document.getElementById('wrap-shipped'); if (f) f.focus({preventScroll: true}); }, 80));

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${Hero} onStatus=${() => setStatus(true)}/>
      ${pmCard ? html`<${M.parts.PmCard} onStatus=${() => setStatus(true)}/>` : html`<${QuietNudge} onStatus=${() => setStatus(true)}/>`}
      ${M.parts.NoticePermit ? html`<${M.parts.NoticePermit}/>` : null}
      ${M.parts.JoinBanner ? html`<${M.parts.JoinBanner}/>` : null}
      ${M.parts.FindYourWay ? html`<${M.parts.FindYourWay}/>` : null}
      <${Announcement}/>
      ${Celebrate ? html`<${Celebrate}/>` : null}
      <${Quick} onTask=${() => setTask('new')}/>
      <${TeamWatch}/>
      ${M.parts.Quote ? html`<${M.parts.Quote}/>` : null}
      ${M.parts.PlanToday ? html`<${M.parts.PlanToday}/>` : null}
      ${M.parts.SpotifyMini ? html`<${M.parts.SpotifyMini}/>` : null}
      <${InstallHint}/>
      <div class="split">
        <div class="stack" style=${{gap: '18px'}}>
          ${eodFirst ? html`<${F} title="EOD line" summary=${eodPosted ? 'posted for today' : 'due by ' + (ctx.settings.eodCut || '19:30')} open=${!eodPosted} hot=${!eodPosted} id="fold-eod"><${Wrap}/><//>` : null}
          <${F} title="Today's focus" summary=${n(myOpen.length, 'open task', 'open tasks') + (myLate ? ', ' + n(myLate, 'overdue', 'overdue') : '')} open=${true} hot=${myLate > 0} id="fold-focus"><${Focus} onOpen=${setTask}/><//>
          ${Reviews && revN ? html`<${F} title="Waiting on your review" summary=${n(revN, 'piece', 'pieces')} open=${true} hot=${true} id="fold-reviews"><${Reviews} compact=${true}/><//>` : null}
          ${Outcomes ? html`<${F} title="This week's outcomes" summary="what you said you would ship" id="fold-outcomes"><${Outcomes}/><//>` : null}
          ${!eodFirst && working ? html`<${F} title="EOD line" summary=${'three lines before ' + (ctx.settings.eodCut || '19:30')} id="fold-eod"><${Wrap}/><//>` : null}
          ${newHire && Onboard ? html`<${F} title="Onboarding" summary="your first weeks, step by step" id="fold-onboard"><${Onboard} uid=${ctx.uid} compact=${true}/><//>` : null}
          ${M.ai.on(ctx) ? html`<${F} title="Your day, sorted" summary="an AI plan for the rest of today" id="fold-brief"><${Brief}/><//>` : null}
          <${F} title="My projects" summary=${n(projN, 'active project', 'active projects')} id="fold-projects"><${MyProjects}/><//>
          <${F} title="Around the studio" summary="the feed and this week's ladder" id="fold-buzz"><${Buzz}/><//>
        </div>
        <div class="stack" style=${{gap: '18px'}}>
          <${F} title="My numbers" summary=${ptsWk + ' points ' + (brWk.label || 'this week')} id="fold-numbers"><${Numbers}/><//>
          <${F} title="My week" summary="check-ins and EOD lines, Monday to Saturday" id="fold-week"><${MyWeek}/><//>
          <${F} title="Rule box" summary=${flagN ? n(flagN, 'flag on you', 'flags on you') : 'all clear'} hot=${flagN > 0} open=${flagN > 0} id="fold-rules"><${HeadsUp}/><//>
          <${Nudges}/>
          <${F} title="Who's in today" summary=${inN + ' of ' + ctx.activeMembers.length + ' in'} id="fold-crew"><${Crew}/><//>
          ${Day ? html`<${F} title="Your day" summary="calendar, mail and files" id="fold-day"><${Day}/><//>` : null}
        </div>
      </div>
      ${task && Drawer ? html`<${Drawer} taskId=${task === 'new' ? null : task} defaults=${{owner: ctx.uid}} onClose=${() => setTask(null)}/>` : null}
      ${status ? html`<${StatusPicker} onClose=${() => setStatus(false)}/>` : null}
    </div>`;
  }

  M.pages.Home = Home;
})();
