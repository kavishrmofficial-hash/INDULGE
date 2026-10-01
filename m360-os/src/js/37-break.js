/* module: break. "Take a break": the reset room. Sparks are the wellness score (a daily puzzle, a run,
   a breath, a creativity reset, the care list all earn them), a streak counts the days you showed up
   for yourself, and levels name the climb. This file holds the engine, the section page and the Play
   tab: one original daily puzzle (Scramble, a word with a clue on odd days; Pixel, a five by five
   picture from number clues on even days) with the team's times, and Flame Run, the endless runner.
   Nothing here touches work points: sparks are their own thing. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef, useMemo} = React;

  const today = () => U.todayStr();
  const yesterday = () => U.ymd(U.addDays(new Date(), -1));
  const LEVELS = [[0, 'Spark'], [50, 'Ember'], [150, 'Flame'], [400, 'Blaze'], [1000, 'Supernova']];
  const RUN_DAY_CAP = 5;

  /* ---------- the engine ---------- */
  const docOf = (ctx, uid) => (ctx.coll.play && ctx.coll.play.map[uid || ctx.uid]) || {};
  const level = n => {
    let cur = LEVELS[0], next = null;
    for (let i = 0; i < LEVELS.length; i++) { if (n >= LEVELS[i][0]) cur = LEVELS[i]; else { next = LEVELS[i]; break; } }
    return {name: cur[1], at: cur[0], next: next ? next[1] : '', nextAt: next ? next[0] : null, pct: next ? Math.round(100 * (n - cur[0]) / (next[0] - cur[0])) : 100};
  };
  /* +n sparks and the streak, in one write; what counts the day as shown up */
  async function award(ctx, n, what) {
    const d = U.clone(docOf(ctx));
    const td = today();
    const streak = d.lastDay === td ? (d.streak || 1) : d.lastDay === yesterday() ? (d.streak || 0) + 1 : 1;
    const best = Math.max(Number(d.best) || 0, streak);
    const log = {...(d.log || {})};
    log[td] = {...(log[td] || {}), [what]: ((log[td] || {})[what] || 0) + 1};
    const keys = Object.keys(log).sort();
    while (keys.length > 120) delete log[keys.shift()];
    await ctx.W.merge('play/' + ctx.uid, {sparks: (Number(d.sparks) || 0) + n, streak, best, lastDay: td, log, updated: Date.now()});
    M.sound.play('done');
    M.toast('+' + n + ' sparks, ' + what);
    return streak;
  }
  const board = ctx => ctx.activeMembers.map(m => { const d = docOf(ctx, m.uid); return {uid: m.uid, sparks: Number(d.sparks) || 0, streak: d.lastDay === today() || d.lastDay === yesterday() ? (Number(d.streak) || 0) : 0, best: Number(d.best) || 0, level: level(Number(d.sparks) || 0).name}; })
    .sort((a, b) => b.sparks - a.sparks || b.streak - a.streak);
  const mine = ctx => { const d = docOf(ctx); const s = Number(d.sparks) || 0; return {sparks: s, level: level(s), streak: d.lastDay === today() || d.lastDay === yesterday() ? (Number(d.streak) || 0) : 0, best: Number(d.best) || 0, today: (d.log || {})[today()] || {}}; };

  /* ---------- seeded randomness: the same puzzle for everyone, every day ---------- */
  function rng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const dayNumber = ymd => Math.round(U.parseYmd(ymd).getTime() / 86400000);
  const kindFor = ymd => dayNumber(ymd) % 2 ? 'word' : 'pixel';

  /* ---------- Scramble: a word from the trade, with a clue ---------- */
  const WORDS = [
    ['storyboard', 'the film drawn frame by frame before anyone shoots'], ['moodboard', 'a wall of references that sets the vibe'], ['typography', 'the art of making letters behave'],
    ['brandbook', 'the rules a logo lives by'], ['retainer', 'a client who pays every month, not per job'], ['deliverable', 'the thing the client actually receives'],
    ['campaign', 'one big idea, many pieces, one window'], ['tagline', 'four words that outlive the ad'], ['influencer', 'a person whose feed is a channel'],
    ['engagement', 'the likes, saves and shares, counted'], ['analytics', 'the numbers after the post'], ['briefing', 'the meeting before the meeting'],
    ['moodfilm', 'a cut of other people\'s footage to sell a feeling'], ['callsheet', 'who is where at what hour on a shoot day'], ['voiceover', 'the words you hear but never see'],
    ['storytelling', 'the oldest trick in marketing'], ['copywriting', 'words that have to earn their place'], ['narrative', 'the arc that holds a campaign together'],
    ['audience', 'the people the work is actually for'], ['benchmark', 'the number to beat'], ['milestone', 'a date the project leans on'],
    ['prototype', 'the rough version that answers the question'], ['wireframe', 'boxes before beauty'], ['keyframe', 'the pose the motion passes through'],
    ['colourway', 'one design, a different palette'], ['lookbook', 'the collection, photographed'], ['packshot', 'the product, lit, alone'],
    ['hashtag', 'a word with a fence in front'], ['carousel', 'swipe, swipe, swipe'], ['thumbnail', 'the tiny picture that decides the click'],
    ['premiere', 'the first showing'], ['teaser', 'the ad for the ad'], ['billboard', 'the ad you cannot scroll past'],
    ['sponsorship', 'a brand attached to someone else\'s moment'], ['activation', 'the brand, in the real world, for a weekend'], ['experiential', 'marketing you can walk into'],
    ['luxury', 'the thing Mask360 knows best'], ['premium', 'a notch under luxury, a notch over everyone'], ['heritage', 'a brand\'s past, used as a selling point'],
    ['artisan', 'made by hand, priced accordingly'], ['bespoke', 'made for one person'], ['curation', 'choosing, as a craft'],
    ['penthouse', 'the top floor, in a brochure'], ['concierge', 'the person who gets you the table'], ['hospitality', 'the business of making people feel looked after'],
    ['vineyard', 'where the wine starts'], ['distillery', 'where the whisky starts'], ['sommelier', 'the one who picks the bottle'],
    ['fragrance', 'the invisible product'], ['skincare', 'the morning ritual, sold in steps'], ['jewellery', 'small, shiny, expensive'],
    ['horology', 'the study of watches'], ['tourbillon', 'the fancy cage inside a fancy watch'], ['automotive', 'cars, as an industry'],
    ['mandate', 'the account, once it is yours'], ['pitch', 'the meeting where you win or you don\'t'], ['proposal', 'the pitch, written down'],
    ['retention', 'keeping the client you already have'], ['churn', 'the clients who leave'], ['pipeline', 'every deal that might happen'],
    ['invoice', 'the paper that asks for the money'], ['payroll', 'everyone\'s salary, on a date'], ['compliance', 'the rules you file by'],
    ['creativity', 'the thing this room is for'], ['momentum', 'what Monday morning needs'], ['discipline', 'doing it on the days you do not feel it'],
    ['focus', 'the opposite of the feed'], ['clarity', 'what a good brief has'], ['brevity', 'the soul of the tagline'],
    ['resonance', 'when the message lands and stays'], ['authentic', 'the word every brand overuses'], ['aesthetic', 'the vibe, as a noun'],
    ['minimalism', 'less, on purpose'], ['maximalism', 'more, on purpose'], ['contrast', 'what makes the headline pop'],
    ['composition', 'where things sit in the frame'], ['lighting', 'the real product on a shoot'], ['continuity', 'the glass is full in every take'],
    ['montage', 'time, compressed to music'], ['sequence', 'the shots in order'], ['transition', 'how one shot becomes the next'],
    ['playlist', 'the mood, in songs'], ['cadence', 'how often you post'], ['consistency', 'posting on the days you said you would'],
    ['deadline', 'the date that makes the work exist'], ['feedback', 'what the client says after the first look'], ['revision', 'the second look'],
    ['approval', 'the yes'], ['handover', 'the day it stops being yours'], ['launch', 'the day the public sees it']
  ];
  function wordPuzzle(ymd) {
    const r = rng('scramble:' + ymd);
    const [word, clue] = WORDS[Math.floor(r() * WORDS.length)];
    let letters = word.split('');
    for (let tries = 0; tries < 20; tries++) {
      for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
      if (letters.join('') !== word) break;
    }
    return {kind: 'word', word, clue, letters, title: 'Scramble', how: 'Unscramble the word. The clue is the trade.'};
  }

  /* ---------- Pixel: a five by five picture from number clues ---------- */
  const N = 5;
  const cluesOf = grid => {
    const run = cells => { const out = []; let n = 0; cells.forEach(c => { if (c) n++; else if (n) { out.push(n); n = 0; } }); if (n) out.push(n); return out.length ? out : [0]; };
    return {rows: grid.map(run), cols: Array.from({length: N}, (_, c) => run(grid.map(row => row[c])))};
  };
  function pixelPuzzle(ymd) {
    const r = rng('pixel:' + ymd);
    let grid;
    for (let tries = 0; tries < 50; tries++) {
      grid = Array.from({length: N}, () => Array.from({length: N}, () => r() < .55 ? 1 : 0));
      const ok = grid.every(row => row.some(Boolean)) && Array.from({length: N}, (_, c) => grid.some(row => row[c])).every(Boolean);
      if (ok) break;
    }
    return {kind: 'pixel', grid, clues: cluesOf(grid), title: 'Pixel', how: 'Fill the squares so every row and column matches its numbers. A 2 1 means a run of two, a gap, then one.'};
  }
  const puzzleFor = ymd => kindFor(ymd) === 'word' ? wordPuzzle(ymd) : pixelPuzzle(ymd);
  const sameClues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function finish(ctx, puzzle, ms, hints) {
    const td = today();
    const score = ms + hints * 20000;
    await ctx.W.merge('play/' + ctx.uid, {days: {[td]: {kind: puzzle.kind, ms: score, hints, at: Date.now()}}, updated: Date.now()});
    const fast = score < 120000 && !hints;
    await award(ctx, fast ? 15 : 10, fast ? 'puzzle, clean and quick' : 'puzzle');
  }
  const fmtMs = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; };

  function Scramble({puzzle, done, onDone}) {
    const [typed, setTyped] = useState('');
    const [reveal, setReveal] = useState(0);
    const [t0, setT0] = useState(0);
    const [wrong, setWrong] = useState(0);
    const [solved, setSolved] = useState(false);
    const start = () => { if (!t0) setT0(Date.now()); };
    const check = () => {
      start();
      if (typed.trim().toLowerCase() === puzzle.word) { setSolved(true); onDone(Date.now() - (t0 || Date.now()), reveal); }
      else { setWrong(w => w + 1); M.sound.play('tick'); }
    };
    const hint = () => { start(); setReveal(r => Math.min(puzzle.word.length - 1, r + 1)); };
    if (done || solved) return html`<div class="stack tight" id="puzzle-done">
      <div class="brk-word">${puzzle.word.split('').map((ch, i) => html`<span key=${i} class="brk-tile on">${ch}</span>`)}</div>
      <div class="small">${puzzle.clue}. ${done ? 'Solved in ' + fmtMs(done.ms) + (done.hints ? ' with ' + done.hints + (done.hints === 1 ? ' hint' : ' hints') : ', no hints') + '.' : 'Got it.'}</div>
    </div>`;
    return html`<div class="stack tight">
      <div class="brk-word" aria-label="Scrambled letters">${puzzle.letters.map((ch, i) => html`<span key=${i} class="brk-tile">${ch}</span>`)}</div>
      <div class="small ink62">${puzzle.clue}${reveal ? html`. Starts with <b>${puzzle.word.slice(0, reveal)}</b>` : ''}</div>
      <div class="row nowrap" style=${{gap: '8px'}}>
        <input class="input brk-answer" id="scramble-answer" value=${typed} placeholder="Your answer" autoCapitalize="none" autoComplete="off" aria-label="Your answer"
          onFocus=${start} onInput=${e => { start(); setTyped(e.target.value); }} onKeyDown=${e => { if (e.key === 'Enter') check(); }}/>
        <${UI.Btn} id="scramble-check" disabled=${!typed.trim()} onClick=${check}>Check<//>
        <button type="button" class="linky tiny" id="scramble-hint" onClick=${hint}>Hint (+20s)</button>
      </div>
      ${wrong ? html`<div class="tiny flame-t">Not it. ${wrong > 2 ? 'The hint is right there.' : 'Go again.'}</div>` : null}
    </div>`;
  }

  function Pixel({puzzle, done, onDone}) {
    const [grid, setGrid] = useState(() => Array.from({length: N}, () => Array(N).fill(0)));
    const [t0, setT0] = useState(0);
    const [hints, setHints] = useState(0);
    const [solved, setSolved] = useState(false);
    const start = () => { if (!t0) setT0(Date.now()); };
    const toggle = (r, c) => {
      if (solved || done) return;
      start();
      const g = grid.map(row => row.slice()); g[r][c] = g[r][c] ? 0 : 1; setGrid(g);
      if (sameClues(cluesOf(g), puzzle.clues)) { setSolved(true); M.sound.play('chime'); onDone(Date.now() - (t0 || Date.now()), hints); }
      else M.sound.play('soft');
    };
    const hint = () => {
      if (solved || done) return;
      start();
      const r = grid.findIndex((row, i) => row.join('') !== puzzle.grid[i].join(''));
      if (r < 0) return;
      const g = grid.map(row => row.slice()); g[r] = puzzle.grid[r].slice(); setGrid(g); setHints(h => h + 1);
      if (sameClues(cluesOf(g), puzzle.clues)) { setSolved(true); onDone(Date.now() - (t0 || Date.now()), hints + 1); }
    };
    const show = done || solved ? puzzle.grid : grid;
    return html`<div class="stack tight">
      <div class="brk-pixel" role="grid" aria-label="Pixel">
        <div class="brk-corner"/>
        ${puzzle.clues.cols.map((cl, c) => html`<div key=${'c' + c} class="brk-clue col num">${cl.join(' ')}</div>`)}
        ${show.map((row, r) => html`<${React.Fragment} key=${'r' + r}>
          <div class="brk-clue row num">${puzzle.clues.rows[r].join(' ')}</div>
          ${row.map((v, c) => html`<button key=${c} type="button" role="gridcell" class=${'brk-cell' + (v ? ' on' : '')} aria-pressed=${!!v} aria-label=${'row ' + (r + 1) + ' column ' + (c + 1)} onClick=${() => toggle(r, c)}/>`)}
        <//>`)}
      </div>
      ${done || solved ? html`<div class="small" id="puzzle-done">${done ? 'Solved in ' + fmtMs(done.ms) + (done.hints ? ' with ' + done.hints + (done.hints === 1 ? ' hint' : ' hints') : ', no hints') + '.' : 'Picture complete.'}</div>`
        : html`<div class="row between"><span class="tiny ink62">Tap a square to fill it.</span><button type="button" class="linky tiny" id="pixel-hint" onClick=${hint}>Hint, one row (+20s)</button></div>`}
    </div>`;
  }

  function DailyPuzzle() {
    const ctx = M.useCtx();
    const td = today();
    const puzzle = useMemo(() => puzzleFor(td), [td]);
    const done = (docOf(ctx).days || {})[td] || null;
    const onDone = (ms, hints) => finish(ctx, puzzle, ms, hints).catch(() => {});
    const rows = ctx.activeMembers.map(m => ({uid: m.uid, d: (docOf(ctx, m.uid).days || {})[td]})).filter(x => x.d).sort((a, b) => a.d.ms - b.d.ms);
    return html`<${UI.Card} id="daily-puzzle" title=${html`<span class="row nowrap" style=${{gap: '8px'}}>${puzzle.title}<${UI.Pill}>today's puzzle<//></span>`} action=${html`<span class="tiny ink62">${puzzle.how}</span>`}>
      ${puzzle.kind === 'word' ? html`<${Scramble} puzzle=${puzzle} done=${done} onDone=${onDone}/>` : html`<${Pixel} puzzle=${puzzle} done=${done} onDone=${onDone}/>`}
      <div class="stack tight" style=${{marginTop: '14px'}} id="puzzle-board">
        <div class="row between"><span class="micro">today's times</span><span class="tiny ink62">${rows.length ? rows.length + ' solved' : 'nobody yet, be first'}</span></div>
        ${rows.map((r, i) => html`<div key=${r.uid} class="row between brk-row">
          <span class="row nowrap"><span class="num tiny ink62" style=${{width: '20px'}}>${i + 1}</span><${UI.Avatar} id=${r.uid} size=${22}/><${UI.Name} id=${r.uid}/></span>
          <span class="num small">${fmtMs(r.d.ms)}${r.d.hints ? html` <span class="tiny ink62">${r.d.hints}h</span>` : ''}</span>
        </div>`)}
      </div>
    <//>`;
  }

  /* ---------- Flame Run: the endless runner ---------- */
  function Runner() {
    const ctx = M.useCtx();
    const canvasRef = useRef(null);
    const state = useRef(null);
    const [score, setScore] = useState(0);
    const [over, setOver] = useState(false);
    const [running, setRunning] = useState(false);
    const me = docOf(ctx).runner || {};
    const best = Number(me.best) || 0;
    const W = 360, H = 160, GROUND = 128;
    const reset = () => ({t: 0, x: 0, y: GROUND, vy: 0, speed: 180, obs: [], next: 900, score: 0, alive: true, last: 0});
    const jump = () => { const s = state.current; if (!s || !s.alive) return; if (s.y >= GROUND - 0.5) { s.vy = -420; M.sound.play('soft'); } };
    const start = () => { state.current = reset(); setScore(0); setOver(false); setRunning(true); M.sound.play('start'); };
    useEffect(() => {
      if (!running) return;
      const cv = canvasRef.current; if (!cv) return;
      const g = cv.getContext('2d');
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#0E0E0E';
      const paper = getComputedStyle(document.documentElement).getPropertyValue('--warm').trim() || '#F7F6F2';
      let raf = 0;
      const frame = now => {
        const s = state.current; if (!s) return;
        const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0; s.last = now;
        if (s.alive) {
          s.t += dt; s.speed = 180 + s.t * 9; s.score += dt * s.speed / 10;
          s.vy += 1400 * dt; s.y = Math.min(GROUND, s.y + s.vy * dt); if (s.y >= GROUND) s.vy = 0;
          s.next -= dt * s.speed;
          if (s.next <= 0) { const h = 18 + Math.random() * 22, w = 12 + Math.random() * 16; s.obs.push({x: W + 20, w, h}); s.next = 220 + Math.random() * 360; }
          s.obs.forEach(o => { o.x -= s.speed * dt; });
          s.obs = s.obs.filter(o => o.x + o.w > -10);
          const fx = 48, fr = 12;
          for (const o of s.obs) { if (fx + fr > o.x && fx - fr < o.x + o.w && s.y + 2 > GROUND - o.h) { s.alive = false; M.sound.play('tick'); } }
          if (!s.alive) {
            setOver(true); setRunning(false);
            const sc = Math.floor(s.score);
            const d = U.clone(docOf(ctx).runner || {});
            const td = today();
            const games = d.day === td ? (Number(d.games) || 0) + 1 : 1;
            ctx.W.merge('play/' + ctx.uid, {runner: {best: Math.max(Number(d.best) || 0, sc), day: td, games, last: sc, at: Date.now()}, updated: Date.now()}).catch(() => {});
            if (games <= RUN_DAY_CAP) award(ctx, sc > (Number(d.best) || 0) ? 4 : 2, sc > (Number(d.best) || 0) ? 'a new best run' : 'a run').catch(() => {});
          }
          setScore(Math.floor(s.score));
        }
        /* draw */
        g.fillStyle = paper; g.fillRect(0, 0, W, H);
        g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, GROUND + 1); g.lineTo(W, GROUND + 1); g.stroke();
        g.fillStyle = ink; s.obs.forEach(o => g.fillRect(o.x, GROUND - o.h, o.w, o.h));
        const fx = 48, fy = s.y;
        g.fillStyle = '#F53901';
        g.beginPath(); g.moveTo(fx, fy - 34); g.quadraticCurveTo(fx + 16, fy - 16, fx + 11, fy - 6); g.arc(fx, fy - 8, 11, 0.3, Math.PI - 0.3, false); g.quadraticCurveTo(fx - 16, fy - 16, fx, fy - 34); g.fill();
        g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(fx - 4, fy - 12, 2.2, 0, Math.PI * 2); g.arc(fx + 4, fy - 12, 2.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = ink; g.font = '600 13px Space Grotesk, sans-serif'; g.textAlign = 'right'; g.fillText(String(Math.floor(s.score)), W - 10, 20);
        if (s.alive) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      const key = e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
      window.addEventListener('keydown', key);
      const hide = () => { const s = state.current; if (s && document.hidden) s.last = 0; };
      document.addEventListener('visibilitychange', hide);
      return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hide); };
    }, [running]);
    const rows = ctx.activeMembers.map(m => ({uid: m.uid, best: Number((docOf(ctx, m.uid).runner || {}).best) || 0})).filter(r => r.best > 0).sort((a, b) => b.best - a.best).slice(0, 6);
    return html`<${UI.Card} id="flame-run" title="Flame Run" action=${html`<span class="tiny ink62 num">best ${best}</span>`}>
      <div class="brk-run" onPointerDown=${e => { e.preventDefault(); if (!running) start(); else jump(); }}>
        <canvas ref=${canvasRef} width=${W} height=${H} id="run-canvas" aria-label="Flame Run"/>
        ${!running ? html`<div class="brk-run-over">
          <div class="small" style=${{fontWeight: 600}}>${over ? 'Run over at ' + score + (score > best && best ? ', new best' : '') : 'Tap or press space to jump the blocks.'}</div>
          <${UI.Btn} sm=${true} id="run-start" onClick=${e => { e.stopPropagation(); start(); }}>${over ? 'Run again' : 'Run'}<//>
        </div>` : null}
      </div>
      <div class="row between" style=${{marginTop: '8px'}}><span class="tiny ink62">Five runs a day earn sparks, the rest are for the love of it.</span>
        ${rows.length ? html`<span class="tiny num ink62">${rows.map(r => html`<span key=${r.uid}><${UI.Name} id=${r.uid}/> ${r.best}</span>`).reduce((a, b) => [a, ' · ', b])}</span>` : null}</div>
    <//>`;
  }

  /* ---------- the section ---------- */
  const TABS = [{k: 'play', label: 'Play', route: 'play'}, {k: 'reset', label: 'Reset', route: 'reset'}, {k: 'care', label: 'Care', route: 'care'}, {k: 'reflect', label: 'Reflect', route: 'reflect'}];
  function Sparks() {
    const ctx = M.useCtx();
    const me = mine(ctx);
    const rows = board(ctx).slice(0, 5);
    return html`<div class="brk-sparks row" style=${{gap: '14px', flexWrap: 'wrap', alignItems: 'center'}} id="sparks">
      <span class="chipline"><b class="num">${me.sparks}</b> sparks</span>
      <span class="chipline"><b>${me.level.name}</b>${me.level.next ? html` <span class="tiny ink62 num">${me.level.nextAt - me.sparks} to ${me.level.next}</span>` : ''}</span>
      <span class="chipline"><b class="num">${me.streak}</b> day streak${me.best > me.streak ? html` <span class="tiny ink62 num">best ${me.best}</span>` : ''}</span>
      ${rows.length ? html`<span class="tiny ink62 brk-board">${rows.map((r, i) => html`<span key=${r.uid} class="nowrap">${i + 1}. <${UI.Name} id=${r.uid}/> <span class="num">${r.sparks}</span></span>`).reduce((a, b) => [a, ' · ', b])}</span>` : null}
    </div>`;
  }
  function Break({tab}) {
    const t = tab || 'play';
    const P = M.parts;
    return html`<div class="stack" style=${{gap: '20px'}} id="break">
      <${M.SectionHero} micro="the reset room" title="Break" sub="Play a little, breathe a little, drink the water. Your brain does better work after, and the sparks prove you showed up.">
        <${Sparks}/>
      <//>
      <${M.SectionTabs} section="break" active=${t}/>
      ${t === 'reset' && P.BreakReset ? html`<${P.BreakReset}/>` : t === 'care' && P.BreakCare ? html`<${P.BreakCare}/>` : t === 'reflect' && P.BreakReflect ? html`<${P.BreakReflect}/>`
        : html`<div class="split"><${DailyPuzzle}/><${Runner}/></div>`}
    </div>`;
  }

  M.play = {LEVELS, level, award, board, mine, docOf, puzzleFor, cluesOf, rng, kindFor, WORDS, fmtMs, TABS};
  M.pages.Break = Break;
})();
