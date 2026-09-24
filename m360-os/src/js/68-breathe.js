/* module: breathe. Sixty seconds of box breathing, full screen, in ink and flame.
   Four in, four hold, four out, four hold, driven frame by frame so the orb always moves with
   the count. Escape, Skip or a tap on the orb ends it. */
'use strict';
(function () {
  const {html, React} = M;
  const {useState, useEffect, useRef} = React;

  const PHASES = [['Breathe in', .45, .95], ['Hold', .95, .95], ['Breathe out', .95, .45], ['Hold', .45, .45]];
  const STEP = 4000, TOTAL = 60000;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let openFn = null;
  M.breathe = {open: () => { if (openFn) openFn(); }, _bind: fn => { openFn = fn; }, PHASES, STEP, TOTAL};

  /* the state of the minute at a given elapsed time */
  function at(el) {
    const e = Math.max(0, Math.min(TOTAL, el));
    const phase = Math.floor(e / STEP) % 4;
    const into = (e % STEP) / STEP;
    const [label, from, to] = PHASES[phase];
    return {phase, label, k: from + (to - from) * ease(into), count: 4 - Math.floor(into * 4), left: Math.ceil((TOTAL - e) / 1000), done: e >= TOTAL, progress: e / TOTAL};
  }

  function Breathe({onClose}) {
    const [t0, setT0] = useState(() => Date.now());
    const [s, setS] = useState(() => at(0));
    const lastPhase = useRef(-1);
    useEffect(() => {
      let raf = 0;
      const tick = () => {
        const n = at(Date.now() - t0);
        setS(n);
        if (n.phase !== lastPhase.current && !n.done) { lastPhase.current = n.phase; M.sound.play('tick'); }
        if (!n.done) raf = requestAnimationFrame(tick);
        else M.sound.play('chime');
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [t0]);
    useEffect(() => { const esc = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);
    const r = 46, C = 2 * Math.PI * r;
    return html`<div class="breathe" role="dialog" aria-label="Breathe" id="breathe">
      <${M.Mark} width="66px"/>
      <div class="micro">${s.done ? 'done' : s.left + ' seconds'}</div>
      <button type="button" class="orb" aria-label="End the breather" onClick=${onClose} style=${{'--k': s.done ? .7 : s.k}}>
        <svg class="orb-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="bg" cx="50" cy="50" r=${r}/>
          <circle class="fg" cx="50" cy="50" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - (s.done ? 1 : s.progress))}/>
        </svg>
        <span class="orb-label">${s.done ? 'Nice' : s.label}</span>
        ${s.done ? null : html`<span class="orb-count num">${s.count}</span>`}
      </button>
      <div class="orb-dots" aria-hidden="true">${PHASES.map((p, i) => html`<i key=${i} class=${i === s.phase && !s.done ? 'on' : ''}/>`)}</div>
      <h2>${s.done ? 'Back to it.' : 'Slow down for a minute.'}</h2>
      <div class="row" style=${{justifyContent: 'center', gap: '18px'}}>
        ${s.done ? html`<button type="button" class="linky" onClick=${() => { lastPhase.current = -1; setT0(Date.now()); setS(at(0)); }}>Go again</button>` : null}
        <button type="button" class="linky" onClick=${onClose}>${s.done ? 'Done' : 'Skip'}</button>
      </div>
    </div>`;
  }

  function BreatheHost() {
    const [open, setOpen] = useState(false);
    useEffect(() => { M.breathe._bind(() => setOpen(true)); return () => M.breathe._bind(null); }, []);
    return open ? html`<${Breathe} onClose=${() => setOpen(false)}/>` : null;
  }

  M.parts.BreatheHost = BreatheHost;
})();
