/* module: focus. A focus timer that rides in the sidebar: pick a task, pick 25, 45 or 90 minutes,
   and m360 counts you down. Finished sessions land in me/<uid>.focus as deep work hours. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const LENS = [25, 45, 90];
  const KEEP = 120;
  const subs = new Set();
  let state = null;   /* {task, title, mins, start} */
  try { const s = JSON.parse(localStorage.getItem('m360.focus') || 'null'); if (s && s.start) state = s; } catch (e) { state = null; }
  const persist = () => { try { localStorage.setItem('m360.focus', JSON.stringify(state)); } catch (e) { /* private window */ } };
  const emit = () => subs.forEach(fn => fn(state));
  let openFn = null;

  const focus = M.focus = {
    get: () => state,
    subscribe: fn => { subs.add(fn); return () => subs.delete(fn); },
    open: task => { if (openFn) openFn(task || null); },
    _bind: fn => { openFn = fn; },
    start(task, title, mins) {
      state = {task: task || '', title: String(title || 'Deep work').slice(0, 80), mins: LENS.includes(mins) ? mins : 25, start: Date.now()};
      persist(); emit(); M.sound.play('start');
    },
    stop() { state = null; persist(); emit(); },
    left() { if (!state) return 0; return Math.max(0, state.mins * 60000 - (Date.now() - state.start)); },
    /* a finished session: written once, then the timer clears */
    async finish(ctx) {
      if (!state) return;
      const s = state;
      state = null; persist(); emit();
      const doc = ctx.coll.me.map[ctx.uid] || {};
      const sessions = [{task: s.task, mins: s.mins, at: Date.now()}].concat(((doc.focus || {}).sessions) || []).slice(0, KEEP);
      try { await ctx.W.merge('me/' + ctx.uid, {focus: {sessions}}); } catch (e) { /* toasted */ }
      M.burst(document.querySelector('.focus-pill') || document.body);
      M.toast('Session done. ' + s.mins + ' minutes of deep work banked.');
    },
    /* minutes of deep work in an inclusive date range */
    minutes(ctx, uid, from, to) {
      const list = (((ctx.coll.me.map[uid] || {}).focus || {}).sessions) || [];
      return list.filter(x => { const d = U.ymd(new Date(x.at)); return d >= from && d <= to; }).reduce((n, x) => n + (x.mins || 0), 0);
    },
    sessions(ctx, uid) { return (((ctx.coll.me.map[uid] || {}).focus || {}).sessions) || []; }
  };

  function useFocus() {
    const [s, set] = useState(state);
    const now = M.useClock();
    useEffect(() => focus.subscribe(set), []);
    return {s, left: s ? Math.min(s.mins * 60000, Math.max(0, s.mins * 60000 - (now - s.start))) : 0};
  }
  const mmss = ms => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  /* the sidebar pill and the phone chip */
  function FocusPill({compact}) {
    const ctx = M.useCtx();
    const {s, left} = useFocus();
    useEffect(() => { if (s && left <= 0) focus.finish(ctx); }, [s, left <= 0]);
    if (!s) return null;
    const total = s.mins * 60000, k = 1 - left / total;
    if (compact) return html`<button type="button" class="focus-chip" onClick=${() => focus.open()}><${icons.timer}/><span class="num">${mmss(left)}</span></button>`;
    const r = 24, C = 2 * Math.PI * r;
    return html`<div class="focus-pill" id="focus-pill">
      <svg class="focus-ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="bg" cx="28" cy="28" r=${r}/><circle class="fg" cx="28" cy="28" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - k)}/></svg>
      <div class="grow" style=${{minWidth: 0}}>
        <div class="num">${mmss(left)}</div>
        <div class="l">${s.title}</div>
      </div>
      <button type="button" class="iconbtn" aria-label="Stop focus" onClick=${() => { focus.stop(); M.toast('Focus stopped'); }}><${icons.stop}/></button>
    </div>`;
  }

  /* the picker: which task, how long */
  function FocusDrawer({task, onClose}) {
    const ctx = M.useCtx();
    const {s, left} = useFocus();
    const open = M.tasks.open(ctx).filter(t => t.owner === ctx.uid).slice(0, 12);
    const [pick, setPick] = useState(task || (open[0] ? open[0].id : ''));
    const [mins, setMins] = useState(25);
    const wk = U.periodRange('week', new Date(ctx.now));
    const banked = focus.minutes(ctx, ctx.uid, wk.from, wk.to);
    const title = pick ? ((ctx.coll.tasks.map[pick] || {}).title || 'Deep work') : 'Deep work';
    const r = 100, C = 2 * Math.PI * r;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Focus">
      ${s ? html`<div class="focus-big">
        <svg class="ring" viewBox="0 0 220 220" aria-hidden="true"><circle class="bg" cx="110" cy="110" r=${r}/><circle class="fg" cx="110" cy="110" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (left / (s.mins * 60000))}/></svg>
        <div class="time num">${mmss(left)}</div>
        <div style=${{fontWeight: 500}}>${s.title}</div>
        <div class="row">
          <${UI.Btn} kind="sec" onClick=${() => { focus.stop(); M.toast('Focus stopped'); }}>Stop<//>
          <${UI.Btn} onClick=${() => { focus.finish(ctx); onClose(); }}>Done early<//>
        </div>
      </div>` : html`<div class="stack">
        <p class="small ink62" style=${{margin: 0}}>Pick what you are on. m360 keeps the time, quietly, and banks it as deep work.</p>
        ${open.length ? html`<${UI.Select} id="focus-task" label="on" value=${pick} onChange=${setPick}
          options=${[{v: '', label: 'Deep work, no task'}].concat(open.map(t => ({v: t.id, label: t.title})))}/>` : null}
        <${UI.Field} label="for">
          <div class="lens">${LENS.map(m => html`<button key=${m} type="button" class=${m === mins ? 'on' : ''} onClick=${() => setMins(m)}>${m} min</button>`)}</div>
        <//>
        <${UI.Btn} onClick=${() => { focus.start(pick, title, mins); onClose(); }}><${icons.play}/>Start ${mins} minutes<//>
      </div>`}
      <hr class="hair"/>
      <div class="row between"><span class="small ink62">Deep work this week</span><span class="num" style=${{fontWeight: 600}}>${Math.round(banked / 6) / 10}h</span></div>
    <//>`;
  }

  function FocusHost() {
    const [open, setOpen] = useState(null);
    useEffect(() => { focus._bind(task => setOpen({task})); return () => focus._bind(null); }, []);
    return open ? html`<${FocusDrawer} task=${open.task} onClose=${() => setOpen(null)}/>` : null;
  }

  M.parts.FocusPill = FocusPill;
  M.parts.FocusHost = FocusHost;
})();
