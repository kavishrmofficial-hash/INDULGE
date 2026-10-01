/* module: games. Two things on the Daily tab that are not the puzzle. Doubles, the easy five minute
   game (slide tiles, equal numbers merge, the timer ends it, nobody loses): an easy casual game beat
   guided relaxation for mood in a lab test, so it earns its place as a mood tool and claims nothing
   else. And the reaction check, a three minute psychomotor vigilance test, the instrument sleep
   researchers use: it mirrors how rested you are, never how able, and is compared only with your
   own last two weeks. It lives in your private space. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const today = () => U.todayStr();
  const privPath = ctx => 'data/users/' + ctx.uid + '/break';

  /* ---------- Doubles ---------- */
  const N = 4;
  const GAME = {seconds: 300};
  const empty = () => Array.from({length: N * N}, () => 0);
  const addTile = (b, r) => { const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!free.length) return b; const n = b.slice(); n[free[Math.floor(r() * free.length)]] = r() < 0.9 ? 2 : 4; return n; };
  /* slide one row left, merging pairs once; returns the row and the points scored */
  function slideRow(row) {
    const xs = row.filter(Boolean), out = []; let pts = 0;
    for (let i = 0; i < xs.length; i++) { if (xs[i] === xs[i + 1]) { out.push(xs[i] * 2); pts += xs[i] * 2; i++; } else out.push(xs[i]); }
    while (out.length < N) out.push(0);
    return {row: out, pts};
  }
  function move(b, dir) {
    const get = (r, c) => dir === 'left' ? b[r * N + c] : dir === 'right' ? b[r * N + (N - 1 - c)] : dir === 'up' ? b[c * N + r] : b[(N - 1 - c) * N + r];
    const nb = b.slice(); let pts = 0, moved = false;
    for (let r = 0; r < N; r++) {
      const row = Array.from({length: N}, (_, c) => get(r, c));
      const {row: out, pts: p} = slideRow(row); pts += p;
      for (let c = 0; c < N; c++) {
        const idx = dir === 'left' ? r * N + c : dir === 'right' ? r * N + (N - 1 - c) : dir === 'up' ? c * N + r : (N - 1 - c) * N + r;
        if (nb[idx] !== out[c]) moved = true;
        nb[idx] = out[c];
      }
    }
    return {board: nb, pts, moved};
  }
  const canMove = b => b.some(v => !v) || ['left', 'up'].some(d => move(b, d).moved);
  const shade = v => { const k = Math.min(11, Math.round(Math.log2(v || 2))); return 'hsl(14 96% ' + (94 - k * 4.2).toFixed(0) + '%)'; };

  function Doubles() {
    const ctx = M.useCtx();
    const rec = (M.play.docOf(ctx) || {}).game || {};
    const [board, setBoard] = useState(empty);
    const [score, setScore] = useState(0);
    const [state, setState] = useState('idle');
    const [left, setLeft] = useState(GAME.seconds);
    const r = useRef(null), t0 = useRef(0), touch = useRef(null), stateRef = useRef('idle');
    stateRef.current = state;
    const start = () => {
      r.current = M.play.rng('doubles:' + Date.now());
      setBoard(addTile(addTile(empty(), r.current), r.current)); setScore(0); setLeft(GAME.seconds); t0.current = Date.now(); setState('on'); M.sound.play('start');
    };
    const finish = async (why, sc, b) => {
      setState('over');
      const best = Math.max(Number(rec.best) || 0, sc);
      await ctx.W.merge('play/' + ctx.uid, {game: {best, games: (Number(rec.games) || 0) + 1, last: sc, at: Date.now()}}).catch(() => {});
      if (sc > (Number(rec.best) || 0) && sc > 0) M.rain('🔥', document.getElementById('doubles-board'), {n: 48});
      await M.play.once(ctx, 'a game break', 5);
      void why; void b;
    };
    const go = dir => {
      if (stateRef.current !== 'on') return;
      setBoard(b => {
        const m = move(b, dir);
        if (!m.moved) return b;
        const nb = addTile(m.board, r.current);
        setScore(s => { const ns = s + m.pts; if (!canMove(nb)) setTimeout(() => finish('full', ns, nb), 50); return ns; });
        if (m.pts) M.sound.play('soft');
        return nb;
      });
    };
    useEffect(() => {
      if (state !== 'on') return undefined;
      const id = setInterval(() => {
        const l = Math.max(0, GAME.seconds - Math.round((Date.now() - t0.current) / 1000));
        setLeft(l);
        if (l <= 0) { clearInterval(id); setScore(s => { finish('time', s); return s; }); }
      }, 500);
      const keys = {ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down'};
      const h = e => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; if (keys[e.key]) { e.preventDefault(); go(keys[e.key]); } };
      window.addEventListener('keydown', h);
      return () => { clearInterval(id); window.removeEventListener('keydown', h); };
    }, [state]);
    const down = e => { touch.current = [e.clientX, e.clientY]; };
    const up = e => {
      if (!touch.current) return;
      const dx = e.clientX - touch.current[0], dy = e.clientY - touch.current[1]; touch.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
    return html`<${UI.Card} id="doubles" title="Doubles, five minutes" action=${html`<${UI.Pill} kind="ink">mood, one trial<//>`}>
      <div class="small" style=${{marginBottom: '10px'}}>Slide, merge the equal numbers, see how far you get before the timer calls you back. An easy game for five minutes lifted mood more than guided relaxation in a lab test. It is a mood tool. It trains nothing, and we will not pretend it does.</div>
      <div class="row between" style=${{marginBottom: '8px'}}>
        <span class="small num"><b>${score}</b> points${rec.best ? html` <span class="ink62">· best ${rec.best}</span>` : ''}</span>
        <span class="small num ink62">${state === 'on' ? mm + ':' + ss : rec.games ? rec.games + ' played' : ''}</span>
      </div>
      <div class="dbl-wrap">
        <div class="dbl-board" id="doubles-board" role="grid" aria-label="The board" data-hotkeys=${state === 'on' ? '1' : undefined} onPointerDown=${down} onPointerUp=${up}>
          ${board.map((v, i) => html`<div key=${i} role="gridcell" class=${'dbl-cell num' + (v >= 1024 ? ' big' : '') + (v >= 128 ? ' light' : '')} style=${v ? {background: shade(v)} : null}>${v || ''}</div>`)}
        </div>
        ${state !== 'on' ? html`<div class="dbl-over">
          ${state === 'over' ? html`<div class="small"><b class="num">${score}</b> points. ${score >= (Number(rec.best) || 0) && score > 0 ? 'A new best.' : 'Nice run.'} Back to it.</div>` : html`<div class="small">Arrow keys or swipe.</div>`}
          <${UI.Btn} id="doubles-start" onClick=${start}>${state === 'over' ? 'Once more' : 'Play'}<//>
        </div>` : null}
      </div>
      <div class="row dbl-pad" aria-label="Move">
        ${[['up', 'Up'], ['left', 'Left'], ['down', 'Down'], ['right', 'Right']].map(([d, l]) => html`<button type="button" key=${d} class="key wide" id=${'doubles-' + d} onClick=${() => go(d)}>${l}</button>`)}
      </div>
    <//>`;
  }

  /* ---------- the reaction check ---------- */
  const RT = {seconds: 180, lapse: 355, minGap: 2000, maxGap: 10000};
  function Reaction() {
    const ctx = M.useCtx();
    const priv = M.useDoc(ctx.db, ctx.uid ? privPath(ctx) : '');
    const rt = (priv.data && priv.data.rt) || {};
    const td = today();
    const [state, setState] = useState('idle');
    const [left, setLeft] = useState(RT.seconds);
    const [shown, setShown] = useState(0);
    const [count, setCount] = useState(0);
    const [last, setLast] = useState(null);
    const trials = useRef([]), falses = useRef(0), t0 = useRef(0), timer = useRef(0), stateRef = useRef('idle'), shownRef = useRef(0);
    stateRef.current = state; shownRef.current = shown;
    const schedule = () => {
      const gap = RT.minGap + Math.random() * (RT.maxGap - RT.minGap);
      timer.current = setTimeout(() => { if (stateRef.current === 'on') { setShown(performance.now()); M.sound.play('tick'); } }, gap);
    };
    const start = () => { trials.current = []; falses.current = 0; t0.current = Date.now(); setCount(0); setLast(null); setShown(0); setLeft(RT.seconds); setState('on'); schedule(); };
    const finish = async () => {
      clearTimeout(timer.current); setState('done'); setShown(0);
      const xs = trials.current.slice().sort((a, b) => a - b);
      if (!xs.length) return;
      const mean = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      const med = Math.round(xs[Math.floor(xs.length / 2)]);
      const lapses = xs.filter(x => x > RT.lapse).length;
      const entry = {mean, med, lapses, n: xs.length, falses: falses.current, at: Date.now()};
      const keep = {...rt, [td]: entry};
      const keys = Object.keys(keep).sort();
      while (keys.length > 30) delete keep[keys.shift()];
      await ctx.W.merge(privPath(ctx), {rt: keep, updated: Date.now()}).catch(() => {});
      await M.play.once(ctx, 'a reaction check', 5);
    };
    const tap = () => {
      if (stateRef.current !== 'on') return;
      if (!shownRef.current) { falses.current++; M.sound.play('soft'); return; }
      const ms = Math.round(performance.now() - shownRef.current);
      trials.current.push(ms); setLast(ms); setCount(trials.current.length); setShown(0);
      schedule();
    };
    useEffect(() => {
      if (state !== 'on') return undefined;
      const id = setInterval(() => { const l = Math.max(0, RT.seconds - Math.round((Date.now() - t0.current) / 1000)); setLeft(l); if (l <= 0) { clearInterval(id); finish(); } }, 250);
      const h = e => { if (e.key === ' ' || e.key === 'Enter') { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; e.preventDefault(); tap(); } };
      window.addEventListener('keydown', h);
      return () => { clearInterval(id); window.removeEventListener('keydown', h); clearTimeout(timer.current); };
    }, [state]);
    const days = Object.keys(rt).sort().slice(-14);
    const mine = rt[td];
    const base = days.filter(d => d !== td).map(d => rt[d].mean).sort((a, b) => a - b);
    const baseline = base.length ? base[Math.floor(base.length / 2)] : null;
    const read = mine && baseline ? (mine.mean > baseline * 1.12 ? 'Slower than your usual. Sleep, water, or a walk before the hard thing.' : mine.mean < baseline * 0.92 ? 'Sharper than your usual. Good day for the hard thing.' : 'On your usual.') : mine ? 'First reads build your baseline. Come back tomorrow.' : '';
    return html`<${UI.Card} id="reaction" title="Reaction check" action=${html`<${UI.Pill} kind="ink">the instrument, well validated<//>`}>
      <div class="small" style=${{marginBottom: '10px'}}>Three minutes. Tap the moment the flame appears, as fast as you can. This is the vigilance test sleep labs use: it mirrors how rested you are, not how able. Compared with your own last two weeks only. Nobody else sees it.</div>
      ${state === 'on' ? html`<button type="button" class=${'rt-pad' + (shown ? ' lit' : '')} id="rt-pad" data-hotkeys="1" onClick=${tap} aria-label="Tap when the flame appears">
          <span class="rt-time num">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>
          ${shown ? html`<span class="rt-flame" aria-hidden="true"/>` : html`<span class="rt-wait">wait for it</span>`}
          <span class="tiny num rt-last">${last ? last + ' ms' : ''}${count ? ' · ' + count : ''}</span>
        </button>`
      : html`<div class="row between" style=${{flexWrap: 'wrap', gap: '10px'}}>
          <div class="stack tight">
            ${mine ? html`<div class="small" id="rt-result">Today <b class="num">${mine.mean} ms</b> mean, <span class="num">${mine.lapses}</span> ${mine.lapses === 1 ? 'lapse' : 'lapses'} over ${RT.lapse} ms, <span class="num">${mine.n}</span> taps. ${read}</div>` : html`<div class="small">${days.length ? 'Not checked today.' : 'Nothing yet. One read a day is plenty.'}</div>`}
            ${days.length >= 2 ? html`<div class="row nowrap" style=${{gap: '8px'}}><${UI.Spark} values=${days.map(d => -rt[d].mean)} width=${160} height=${30} hot=${true}/><span class="tiny ink62">last ${days.length} reads, up is faster</span></div>` : null}
          </div>
          <${UI.Btn} id="rt-start" kind=${mine ? 'sec' : undefined} onClick=${start}>${mine ? 'Check again' : 'Start'}<//>
        </div>`}
    <//>`;
  }

  M.parts.Doubles = Doubles;
  M.parts.Reaction = Reaction;
  M.games = {move, slideRow, canMove, GAME, RT, privPath};
})();
