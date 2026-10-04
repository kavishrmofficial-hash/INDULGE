/* module: bot. A small drawn creature that stands in for the AI where it speaks: a rounded body in
   the house ink or flame, two bead eyes that look about and blink, a hop now and then. Three states:
   default (looking around, a jump now and then), working (hopping, eyes narrowed in effort), sleeping
   (lids down, slow breaths). Interactive: the eyes follow a pointer nearby and a tap makes it hop.
   Reduced motion keeps a still, friendly face. Inline SVG, no canvas, no WebGL. */
'use strict';
(function () {
  const {html, React} = M;
  const {useEffect, useRef, useState} = React;

  /* body outlines in a 100 by 100 box centred on 50,50 */
  const BODIES = {
    blob: 'M50 8c22 0 40 14 40 36 0 24-14 48-40 48S10 68 10 44C10 22 28 8 50 8z',
    clover: 'M50 12c8 0 14 6 16 14 8-2 18 2 20 12s-4 18-12 20c2 8-2 18-12 20s-16-4-12-12c-8 2-18-2-20-12s4-18 12-20c-2-8 2-18 8-22z',
    drop: 'M50 6c10 18 32 36 32 56 0 18-14 32-32 32S18 80 18 62C18 42 40 24 50 6z',
    pebble: 'M14 52c0-20 18-34 40-34s34 12 34 30-12 36-36 36S14 72 14 52z',
    star: 'M50 8l11 24 26 3-19 18 5 26-23-13-23 13 5-26L13 35l26-3z',
    /* the dock's droid and the office's COO: a soft square head on a short neck, an antenna on top */
    droid: 'M30 22h40c10 0 16 6 16 16v28c0 10-6 16-16 16H30c-10 0-16-6-16-16V38c0-10 6-16 16-16z'
  };
  const EYES = {blob: [38, 44, 62, 44], clover: [40, 46, 60, 46], drop: [40, 58, 60, 58], pebble: [38, 50, 62, 50], star: [41, 46, 59, 46], droid: [38, 50, 62, 50]};

  /* glasses 'square' and a bow tie, in the house ink (paper on a dark ground): the COO's dress when the
     effects bundle is missing */
  function Dress({kind, glasses, bowTie, ink}) {
    const [ex1, ey1, ex2, ey2] = EYES[kind];
    return html`<g class="bot-dress" fill="none" stroke=${ink} stroke-width="2.4" stroke-linejoin="round">
      ${glasses === 'square' ? html`<rect x=${ex1 - 10} y=${ey1 - 9} width="20" height="18" rx="3"/><rect x=${ex2 - 10} y=${ey2 - 9} width="20" height="18" rx="3"/>
        <path d=${'M' + (ex1 + 10) + ' ' + (ey1 - 2) + 'H' + (ex2 - 10)}/>` : null}
      ${bowTie ? html`<path d="M50 86l-10-6v12zM50 86l10-6v12z" fill=${ink}/>` : null}
    </g>`;
  }

  function Bot({type, state, size, seed, color, label, id, glasses, bowTie}) {
    const kind = BODIES[type] ? type : 'blob';
    const st = state === 'working' || state === 'sleeping' ? state : 'default';
    const root = useRef(null);
    const [hop, setHop] = useState(0);
    const [look, setLook] = useState({x: 0, y: 0});
    const px = Number(size) || 40;
    const s = Number(seed) || 0;
    /* looks about on its own; follows a pointer within reach */
    useEffect(() => {
      if (M.reduced() || st === 'sleeping') { setLook({x: 0, y: 0}); return undefined; }
      let timer = 0, near = false;
      const wander = () => { if (!near) setLook({x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 1.2}); timer = setTimeout(wander, 1400 + Math.random() * 2200 + s * 500); };
      timer = setTimeout(wander, 600 + s * 400);
      const move = e => {
        const el = root.current; if (!el) return;
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy);
        if (d < 220) { near = true; setLook({x: Math.max(-1, Math.min(1, dx / 90)), y: Math.max(-1, Math.min(1, dy / 90))}); }
        else if (near) { near = false; }
      };
      window.addEventListener('pointermove', move, {passive: true});
      return () => { clearTimeout(timer); window.removeEventListener('pointermove', move); };
    }, [st, s]);
    /* a jump now and then while idle */
    useEffect(() => {
      if (M.reduced() || st !== 'default') return undefined;
      const t = setInterval(() => setHop(h => h + 1), 9000 + s * 1300);
      return () => clearInterval(t);
    }, [st, s]);
    const [ex1, ey1, ex2, ey2] = EYES[kind];
    const lx = look.x * 3.2, ly = look.y * 2.4;
    const fill = color === 'ink' ? 'var(--ink)' : color === 'paper' ? 'var(--paper)' : 'var(--flame)';
    const eye = color === 'paper' ? 'var(--ink)' : '#fff';
    const pupil = color === 'paper' ? '#fff' : '#0A0A0A';
    const name = label || (st === 'working' ? 'm360, working' : st === 'sleeping' ? 'm360, asleep' : 'm360');
    return html`<span ref=${root} id=${id} class=${'bot ' + st + (color === 'paper' ? ' on-dark' : '')} role="img" aria-label=${name} data-state=${st} style=${{'--sz': px + 'px', '--seed': s}}
      onClick=${() => { if (!M.reduced()) { setHop(h => h + 1); M.haptic.buzz('tap'); } }}>
      <svg key=${hop} class="bot-body" viewBox="0 0 100 100" width=${px} height=${px} aria-hidden="true">
        ${kind === 'droid' ? html`<path d="M50 22V11" stroke=${fill} stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="9" r="4" fill=${fill}/>` : null}
        <path d=${BODIES[kind]} fill=${fill} stroke=${color === 'paper' ? 'var(--line2)' : 'rgba(0,0,0,.08)'} stroke-width="1.5"/>
        <g class="bot-eyes" style=${{transform: 'translate(' + lx + 'px,' + ly + 'px)'}}>
          <ellipse class="bot-eye" cx=${ex1} cy=${ey1} rx="7" ry="8" fill=${eye}/>
          <ellipse class="bot-eye" cx=${ex2} cy=${ey2} rx="7" ry="8" fill=${eye}/>
          <circle class="bot-pupil" cx=${ex1 + lx * 0.6} cy=${ey1 + ly * 0.6} r="3.4" fill=${pupil}/>
          <circle class="bot-pupil" cx=${ex2 + lx * 0.6} cy=${ey2 + ly * 0.6} r="3.4" fill=${pupil}/>
          <circle cx=${ex1 - 2 + lx * 0.6} cy=${ey1 - 3 + ly * 0.6} r="1.2" fill=${eye} opacity=".9"/>
          <circle cx=${ex2 - 2 + lx * 0.6} cy=${ey2 - 3 + ly * 0.6} r="1.2" fill=${eye} opacity=".9"/>
        </g>
        <g class="bot-lids"><rect x=${ex1 - 8} y=${ey1 - 9} width="16" height="18" rx="7" fill=${fill}/><rect x=${ex2 - 8} y=${ey2 - 9} width="16" height="18" rx="7" fill=${fill}/></g>
        ${st === 'working' ? html`<path class="bot-mouth" d=${'M' + (50 - 6) + ' ' + (ey1 + 16) + ' q6 4 12 0'} stroke=${eye} stroke-width="2" fill="none" stroke-linecap="round"/>` : null}
        ${glasses || bowTie ? html`<${Dress} kind=${kind} glasses=${glasses} bowTie=${bowTie} ink=${color === 'ink' ? 'var(--paper)' : 'var(--ink)'}/>` : null}
      </svg>
    </span>`;
  }
  M.parts.Bot = Bot;
  M.bot = {BODIES};
})();
