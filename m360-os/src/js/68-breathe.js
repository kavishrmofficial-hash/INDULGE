/* module: breathe. Sixty seconds of box breathing, full screen, in ink and flame.
   Four in, four hold, four out, four hold. Escape or Done ends it. */
'use strict';
(function () {
  const {html, React} = M;
  const {useState, useEffect} = React;

  const PHASES = [['Breathe in', .95], ['Hold', .95], ['Breathe out', .45], ['Hold', .45]];
  const STEP = 4000, TOTAL = 60000;
  let openFn = null;
  M.breathe = {open: () => { if (openFn) openFn(); }, _bind: fn => { openFn = fn; }};

  function Breathe({onClose}) {
    const [t0] = useState(() => Date.now());
    const now = M.useClock();
    const el = Math.min(TOTAL, now - t0);
    const phase = Math.floor(el / STEP) % 4;
    const left = Math.max(0, Math.ceil((TOTAL - el) / 1000));
    const done = el >= TOTAL;
    useEffect(() => { const esc = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);
    useEffect(() => { if (done) M.sound.play('chime'); }, [done]);
    return html`<div class="breathe" role="dialog" aria-label="Breathe" id="breathe">
      <div class="micro">${done ? 'done' : left + ' seconds'}</div>
      <div class="orb" style=${{'--k': done ? .7 : PHASES[phase][1]}}><span>${done ? 'Nice' : PHASES[phase][0]}</span></div>
      <h2>${done ? 'Back to it.' : 'Slow down for a minute.'}</h2>
      <button type="button" class="linky" onClick=${onClose}>${done ? 'Done' : 'Skip'}</button>
    </div>`;
  }

  function BreatheHost() {
    const [open, setOpen] = useState(false);
    useEffect(() => { M.breathe._bind(() => setOpen(true)); return () => M.breathe._bind(null); }, []);
    return open ? html`<${Breathe} onClose=${() => setOpen(false)}/>` : null;
  }

  M.parts.BreatheHost = BreatheHost;
})();
