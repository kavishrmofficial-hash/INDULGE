/* module: breathe. Paced breathing, full screen, in ink and flame, driven frame by frame so the orb
   always moves with the count. Three protocols, each with its evidence: slow breathing at six
   breaths a minute for five minutes (the one with meta-analyses behind it), box breathing before
   something stressful (one randomised trial), and cyclic sighing (one trial, no replication yet).
   Escape, Skip or a tap on the orb ends it early; only a finished round calls onDone. */
'use strict';
(function () {
  const {html, React} = M;
  const {useState, useEffect, useRef} = React;

  /* phases: label, orb size from, orb size to, milliseconds */
  const PROTOCOLS = {
    slow: {k: 'slow', name: 'Slow breathing', seconds: 300, grade: 'well supported', line: 'Four in, six out. Six breaths a minute for five minutes, the pace the heart rate variability trials use.',
      phases: [['Breathe in', .45, .95, 4000], ['Breathe out', .95, .45, 6000]]},
    box: {k: 'box', name: 'Box breathing', seconds: 180, grade: 'one trial', line: 'Four in, hold four, four out, hold four. Blunted the stress response before a hard task in one randomised trial.',
      phases: [['Breathe in', .45, .95, 4000], ['Hold', .95, .95, 4000], ['Breathe out', .95, .45, 4000], ['Hold', .45, .45, 4000]]},
    sigh: {k: 'sigh', name: 'Cyclic sighing', seconds: 300, grade: 'one trial', line: 'Two inhales through the nose, one long exhale through the mouth. Lifted mood most in a four-arm trial; nobody has replicated it yet.',
      phases: [['Breathe in', .45, .8, 2000], ['Top up', .8, .95, 1000], ['Let it out', .95, .45, 6000]]}
  };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let openFn = null;
  M.breathe = {open: (kind, opts) => { if (openFn) openFn(PROTOCOLS[kind] ? kind : 'slow', opts || {}); }, _bind: fn => { openFn = fn; }, PROTOCOLS};

  /* the state of the round at a given elapsed time */
  function at(p, total, el) {
    const cycle = p.phases.reduce((n, ph) => n + ph[3], 0);
    const e = Math.max(0, Math.min(total, el));
    let into = e % cycle, phase = 0;
    while (into >= p.phases[phase][3]) { into -= p.phases[phase][3]; phase++; }
    const [label, from, to, ms] = p.phases[phase];
    const f = into / ms;
    return {phase, label, k: from + (to - from) * ease(f), count: Math.ceil((ms - into) / 1000), left: Math.ceil((total - e) / 1000), done: e >= total, progress: e / total};
  }

  function Breathe({kind, opts, onClose}) {
    const p = PROTOCOLS[kind];
    const total = Math.max(2, Number(opts.seconds) || p.seconds) * 1000;
    const [t0, setT0] = useState(() => Date.now());
    const [s, setS] = useState(() => at(p, total, 0));
    const lastPhase = useRef(-1);
    const fired = useRef(false);
    useEffect(() => {
      let raf = 0;
      const tick = () => {
        const n = at(p, total, Date.now() - t0);
        setS(n);
        if (n.phase !== lastPhase.current && !n.done) { lastPhase.current = n.phase; M.sound.play('tick'); M.haptic.buzz('tick'); }
        if (!n.done) raf = requestAnimationFrame(tick);
        else if (!fired.current) { fired.current = true; M.sound.play('chime'); M.haptic.buzz('done'); if (opts.onDone) opts.onDone(); }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [t0]);
    useEffect(() => { const esc = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);
    const r = 46, C = 2 * Math.PI * r;
    const mm = Math.floor(s.left / 60), ss = String(s.left % 60).padStart(2, '0');
    return html`<div class="breathe" role="dialog" aria-label=${p.name} id="breathe" data-kind=${kind}>
      <${M.Mark} width="66px"/>
      <div class="micro">${s.done ? 'done' : p.name + ' · ' + mm + ':' + ss}</div>
      <button type="button" class="orb" aria-label="End the round" onClick=${onClose} style=${{'--k': s.done ? .7 : s.k}}>
        <svg class="orb-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="bg" cx="50" cy="50" r=${r}/>
          <circle class="fg" cx="50" cy="50" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - (s.done ? 1 : s.progress))}/>
        </svg>
        <span class="orb-label">${s.done ? 'Nice' : s.label}</span>
        ${s.done ? null : html`<span class="orb-count num">${s.count}</span>`}
      </button>
      <div class="orb-dots" aria-hidden="true">${p.phases.map((ph, i) => html`<i key=${i} class=${i === s.phase && !s.done ? 'on' : ''}/>`)}</div>
      <h2>${s.done ? 'Back to it.' : p.line}</h2>
      <div class="row" style=${{justifyContent: 'center', gap: '18px'}}>
        ${s.done ? html`<button type="button" class="linky" onClick=${() => { lastPhase.current = -1; fired.current = false; setT0(Date.now()); setS(at(p, total, 0)); }}>Go again</button>` : null}
        <button type="button" class="linky" onClick=${onClose}>${s.done ? 'Done' : 'Skip'}</button>
      </div>
    </div>`;
  }

  function BreatheHost() {
    const [open, setOpen] = useState(null);
    useEffect(() => { M.breathe._bind((kind, opts) => setOpen({kind, opts})); return () => M.breathe._bind(null); }, []);
    return open ? html`<${Breathe} kind=${open.kind} opts=${open.opts} onClose=${() => setOpen(null)}/>` : null;
  }

  M.parts.BreatheHost = BreatheHost;
})();
