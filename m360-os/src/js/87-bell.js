/* module: bell. A bell that rings. M.fx.ring(el) swings any element from its crown with a decaying
   peal (five half swings in 820 ms by default) through the Web Animations API, so the inbox bell
   rings when something new lands. BellToggle is the pill that asks for notifications: a bell, a
   label that unfurls from "Notify me" to "You'll be notified" as the pill grows, sound waves leaving
   the rim on every swing, and a count badge that rolls when it rises. Keyboard presses crossfade
   only; reduced motion gets the crossfade and nothing else. */
'use strict';
(function () {
  const {html, React} = M;
  const {useEffect, useLayoutEffect, useRef, useState} = React;
  const EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const WARP = 0.6;
  const passOffset = (k, passes) => 1 - Math.pow(1 - (k + 2 / 3) / (passes + 1), WARP);
  const liveAngle = el => {
    try { const tf = getComputedStyle(el).transform; if (!tf || tf === 'none') return 0; const m = new DOMMatrix(tf); return Math.atan2(m.b, m.a) * 180 / Math.PI; } catch (e) { return 0; }
  };
  const frames = (from, amplitude, passes, decay) => {
    const out = [{transform: 'rotate(' + from + 'deg)', offset: 0, easing: EASE}];
    for (let k = 0; k < passes; k++) {
      const angle = amplitude * Math.pow(1 - k / passes, decay) * (k % 2 ? 1 : -1);
      out.push({transform: 'rotate(' + angle.toFixed(2) + 'deg)', offset: passOffset(k, passes), easing: EASE});
    }
    out.push({transform: 'rotate(0deg)', offset: 1});
    return out;
  };
  /* ring an element: amplitude in degrees, passes (half swings), duration ms, decay (1 even) */
  function ring(el, o) {
    if (!el || !el.animate || M.reduced()) return null;
    const opt = o || {};
    try { el.getAnimations().forEach(a => a.cancel()); } catch (e) { /* no animations */ }
    el.style.transformOrigin = '50% ' + (opt.pivot == null ? 16 : opt.pivot) + '%';
    return el.animate(frames(liveAngle(el), opt.amplitude || 17, opt.passes || 5, opt.decay || 1), {duration: opt.duration || 820, easing: 'linear'});
  }
  const waveFrames = strength => [{opacity: 0, transform: 'scale(0.55)'}, {opacity: 0.9 * strength, offset: 0.3}, {opacity: 0, transform: 'scale(1.25)'}];

  function BellToggle({offLabel, onLabel, pressed, defaultPressed, onChange, count, badge, disabled, id, size}) {
    const [inner, setInner] = useState(!!defaultPressed);
    const on = pressed == null ? inner : !!pressed;
    const glyph = useRef(null), left = useRef(null), right = useRef(null), offRef = useRef(null), onRef = useRef(null), root = useRef(null);
    const input = useRef('pointer');
    const prevCount = useRef(count || 0);
    const [widths, setWidths] = useState([0, 0]);
    useLayoutEffect(() => {
      const measure = () => setWidths([offRef.current ? offRef.current.offsetWidth : 0, onRef.current ? onRef.current.offsetWidth : 0]);
      measure();
      let ro = null;
      try { ro = new ResizeObserver(measure); if (offRef.current) ro.observe(offRef.current); if (onRef.current) ro.observe(onRef.current); } catch (e) { /* no observer */ }
      try { document.fonts.ready.then(measure); } catch (e) { /* no fonts api */ }
      return () => { if (ro) ro.disconnect(); };
    }, [offLabel, onLabel]);
    const swing = (amp, passes, dur) => {
      ring(glyph.current, {amplitude: amp, passes, duration: dur});
      for (let k = 0; k < passes; k++) {
        const side = k % 2 ? right.current : left.current;
        if (!side || !side.animate) continue;
        side.animate(waveFrames(Math.pow(1 - k / passes, 1)), {duration: 380, delay: passOffset(k, passes) * dur, easing: 'ease-out'});
      }
    };
    const first = useRef(true);
    useEffect(() => {
      if (first.current) { first.current = false; return; }
      if (on && input.current === 'pointer' && !M.reduced()) { swing(17, 5, 820); M.haptic.buzz('pick'); }
    }, [on]);
    useEffect(() => {
      const was = prevCount.current; prevCount.current = count || 0;
      if ((count || 0) > was && on && !M.reduced()) swing(7, 3, 420);
    }, [count]);
    const toggle = () => { if (disabled) return; if (pressed == null) setInner(!on); if (onChange) onChange(!on); };
    const wide = Math.max(widths[0], widths[1]);
    const clip = wide - (on ? widths[1] : widths[0]);
    const showBadge = badge !== false && on && (count || 0) > 0;
    return html`<span ref=${root} class=${'bell-toggle' + (size === 'sm' ? ' sm' : '') + (disabled ? ' off' : '')} data-on=${on ? 'true' : 'false'} id=${id} style=${{'--bt-clip': clip + 'px', '--bt-wide': wide + 'px'}}>
      <button type="button" class="bell-toggle-btn" aria-pressed=${on} aria-label=${offLabel} disabled=${!!disabled}
        onPointerDown=${() => { input.current = 'pointer'; }} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') input.current = 'keyboard'; }} onClick=${toggle}>
        <span class="bell-toggle-bell" aria-hidden="true">
          <span ref=${glyph} class="bell-toggle-glyph"><${M.icons.bell}/></span>
          <svg ref=${left} class="bell-toggle-wave l" viewBox="0 0 14 14"><path d="M14 8a6 6 0 0 0-6 6"/><path d="M14 4A10 10 0 0 0 4 14"/></svg>
          <svg ref=${right} class="bell-toggle-wave r" viewBox="0 0 14 14"><path d="M0 8a6 6 0 0 1 6 6"/><path d="M0 4a10 10 0 0 1 10 10"/></svg>
          <span class="bell-toggle-badge" data-show=${showBadge ? '1' : '0'}><span key=${count || 0} class="bell-toggle-digit">${(count || 0) > 9 ? '9+' : (count || 0)}</span></span>
        </span>
        <span class="bell-toggle-say" aria-hidden="true">
          <span ref=${offRef} class="bell-toggle-face off">${offLabel}</span>
          <span ref=${onRef} class="bell-toggle-face on">${onLabel}</span>
        </span>
      </button>
    </span>`;
  }
  M.parts.BellToggle = BellToggle;
  M.fx = {...(M.fx || {}), ring};
})();
