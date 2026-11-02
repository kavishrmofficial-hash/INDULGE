/* module: fx. The six effects from the real packages (fx/entry.jsx, bundled into 00-a-fx.vendor.js
   and exposed as window.FX), used the way their authors ship them. The one edit is colour: every
   accent is our agency orange, flame #F53901. Each wrapper stands down to the plain child when the
   bundle is missing or the person asked for reduced motion, so nothing depends on the bundle.

     M.fx.Orb       thinking-orbs   ThinkingOrb, any of the nine states, sizes 20 / 32 / 64
     M.fx.Beam      (retired, v7)   the host alone; on=true marks the card inside with the flame line
     M.fx.BeamFx    border-beam     BorderBeam round a card or a control, running while on screen
     M.fx.Voice     voice-glow      VoiceBeam under an input, a recording pill or a phone screen
     M.fx.VoicePill voice-glow      the recording pill round a Talk button while it listens
     M.fx.Bot       (retired, v7)   draws nothing: the design has no robot; the live mark is m360's character
     M.fx.Metal     (retired)       the control itself; the liquid metal is gone (v36.2)
     M.fx.MetalText (retired)       the number or word in plain type at the size asked
     M.fx.MetalBadge (retired)      a flame pill for a small "new" style tag
     M.fx.Bell      React Bits      BellToggle for anything you switch on to be told about */
'use strict';
(function () {
  const {html, React} = M;
  const FLAME = '#F53901';
  /* the voice beam's seven lobes and its bands, in flame and its neighbours */
  const FLAME_LOBES = ['rgb(245,57,1)', 'rgb(255,106,43)', 'rgb(255,138,76)', 'rgb(240,91,27)', 'rgb(255,78,18)', 'rgb(255,160,107)', 'rgb(217,49,0)'];
  const FLAME_BANDS = {core: 'rgb(255,214,190)', above: 'rgb(255,138,76)', mid: 'rgb(245,57,1)', below: 'rgb(217,49,0)'};

  /* the canvases wait for the page to settle: the plain controls paint first, the effects follow a
     moment later, so a cold start on a phone stays quick */
  let settled = false;
  const subs = new Set();
  /* wrapping a control in its effect rebuilds the control, so whatever had focus at that moment (the
     search box opened straight after load, say) gets its focus and caret back */
  setTimeout(() => {
    const a = document.activeElement;
    const id = a && a !== document.body ? a.id : '';
    let caret = null;
    try { caret = id && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null; } catch (e) { caret = null; }
    settled = true;
    subs.forEach(fn => fn());
    if (!id) return;
    const back = () => {
      const b = document.getElementById(id);
      if (!b || b === document.activeElement) return;
      const now = document.activeElement;
      if (now && now !== document.body && now.isConnected) return;
      b.focus({preventScroll: true});
      if (caret) { try { b.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text field */ } }
    };
    Promise.resolve().then(back);
    requestAnimationFrame(back);
  }, 450);
  const useSettled = () => React.useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => settled, () => settled);
  const FX = () => (window.FX && settled) ? window.FX : null;
  const still = () => M.reduced();

  /* while a drawer or the search palette is open, the effects behind its scrim hold still, so the page
     never competes with the task in front; a host inside the open panel keeps its own effect */
  let hushed = false;
  const hushSubs = new Set();
  const MODAL = '.drawer, .pal, .orb-screen, .newmenu';
  try {
    new MutationObserver(() => {
      const now = !!document.querySelector('.scrim, .pal-scrim');
      if (now === hushed) return;
      hushed = now;
      hushSubs.forEach(fn => fn());
    }).observe(document.documentElement, {childList: true, subtree: true});
  } catch (e) { /* old browser */ }
  const useHushed = () => React.useSyncExternalStore(fn => { hushSubs.add(fn); return () => hushSubs.delete(fn); }, () => hushed, () => hushed);
  /* a phone fold already carries the beam and flattens the card inside it (UI.Fold) */
  const FoldCtx = (M.UI && M.UI.FoldCtx) || React.createContext(false);

  /* one bot body per AI feature, all in flame, so each agent is recognisable at a glance */
  const BOTS = {ask: 'clover', buddy: 'droid', brief: 'star', hq: 'mech', radar: 'alien', clients: 'flower', base: 'hexagon', search: 'cat',
    sections: 'blob', handshake: 'ghost', writer: 'drop', notes: 'pebble', empty: 'cloud', care: 'puddle', hiring: 'triangle', books: 'square'};

  /* ThinkingOrb. States: working, searching, solving, listening, connecting, weaving, composing,
     breathing, shaping. Sizes as tuned by the library: 64 (avatar), 32, 20 (inline text). */
  function Orb({state, size, dark, className, style, label}) {
    useSettled();
    const th = M.useResolvedTheme();
    const fx = FX();
    /* the still sphere keeps the orb's own size; the 64 sits on the orb screen, which sizes it */
    const sz = size || 20;
    if (!fx || still()) return html`<span class=${'vorb ' + (sz <= 20 ? 'mini ' : '') + (state || 'working') + (className ? ' ' + className : '')} style=${sz < 64 ? {'--sz': sz + 'px', ...(style || {})} : style} aria-hidden="true"/>`;
    return html`<${fx.ThinkingOrb} state=${state || 'working'} size=${size === 64 || size === 32 ? size : 20} color=${FLAME} theme=${dark == null ? th : (dark ? 'dark' : 'light')} className=${className} style=${style} aria-label=${label || ''}/>`;
  }

  /* BorderBeam, the library's own defaults (size md, strength 0.7) with the sunset palette held on
     its oranges. It runs while the element is on screen. A beam repaints its whole box each frame,
     so on a box taller than BEAM_MAX_H it holds still and the element keeps its own border. Round a
     text field it is the library's line, the bottom glow it draws for inputs, lit while the field
     has focus. */
  const BEAM_MAX_H = 260;
  const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), textarea';
  const isField = (kid, el) => (!!kid && (kid.type === 'input' || kid.type === 'textarea')) ||
    (!!el && !!el.querySelector(TEXT_FIELD) && !el.querySelector('.card, .ai-card, section'));
  /* v7: the border beam is retired. It drew flame as moving tints round a border, and the v7 design keeps
     flame exact (#F53901, never a tint) and still: a card that needs you carries a 2px flame line on its top
     edge (css.css). Beam keeps its host, so every layout built round it holds, and a beam a caller switches
     on by a condition (`on`) marks the card inside as needing you with that line. BeamFx is the old effect,
     kept for a caller that asks for it by name. */
  function Beam({on, children, block}) {
    if (on === false) return children;
    return html`<span class=${'beam-host' + (block === false ? ' inline' : '') + (on === true ? ' need' : '')}>${children}</span>`;
  }
  function BeamFx({on, size, radius, strength, duration, dark, children, block}) {
    useSettled();
    const th = M.useResolvedTheme();
    const hush = useHushed();
    const inFold = React.useContext(FoldCtx);
    const host = React.useRef(null);
    const [vis, setVis] = React.useState(false);
    const [tall, setTall] = React.useState(false);
    const [field, setField] = React.useState(() => isField(children, null));
    const [focus, setFocus] = React.useState(false);
    const [modal, setModal] = React.useState(false);
    const fx = FX();
    /* a card inside a phone fold is drawn flat, and the fold carries the beam */
    const enabled = !!fx && on !== false && !still() && !(inFold && children && children.type === M.UI.Card);
    React.useEffect(() => {
      if (!enabled || !host.current) return undefined;
      setField(isField(children, host.current));
      setModal(!!host.current.closest(MODAL));
      let ro = null, io = null;
      if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(es => { for (const e of es) setTall(e.contentRect.height > BEAM_MAX_H); }); ro.observe(host.current); }
      if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver(es => setVis(es.some(e => e.isIntersecting)), {threshold: 0.05}); io.observe(host.current); } else setVis(true);
      return () => { if (ro) ro.disconnect(); if (io) io.disconnect(); };
    }, [enabled]);
    if (!enabled) return children;
    /* focus is followed on every beam: a field focused as it mounts (the palette) is known to be a field
       only after this first render */
    const active = vis && !tall && (!hush || modal) && (!field || focus);
    return html`<span ref=${host} class=${'beam-host' + (block === false ? ' inline' : '')} data-beam-live=${active ? '1' : '0'} data-beam-tall=${tall ? '1' : '0'}
      onFocus=${() => setFocus(true)} onBlur=${e => setFocus(!!e.relatedTarget && e.currentTarget.contains(e.relatedTarget))}>
      <${fx.BorderBeam} size=${field ? 'line' : (size || 'md')} colorVariant="sunset" staticColors=${true} strength=${strength == null ? 0.7 : strength} theme=${dark == null ? th : (dark ? 'dark' : 'light')} borderRadius=${radius == null ? 20 : radius} duration=${duration} active=${active}>${children}<//>
    </span>`;
  }

  /* The metal (metal-fx) is retired in v36.2. Its chromatic copies drew numbers and words as misaligned
     coloured ghosts, and the liquid buttons cost a WebGL canvas each. The three names stay so every caller
     keeps working, and each draws plain: Metal gives back its control as it is, MetalText the text in the
     house type at the size asked (below 22px it takes the type around it), MetalBadge a flame pill. */
  function Metal({children, kind, className, block}) {
    /* the host keeps the layout the metal had (full width in the sidebar, on a block, in the day rating) and
       its ink or paper class, which sets the flame of a spark inside the button */
    const tone = kind === 'ink' ? ' metal-ink' : kind === 'paper' ? ' metal-paper' : '';
    return html`<span class=${'metal-host' + tone + (block ? ' block' : '') + (className ? ' ' + className : '')}>${children}</span>`;
  }

  const METAL_TEXT_MIN = 22;
  function MetalText({children, size, weight, color, className}) {
    const px = Number(size) || 24;
    const style = px < METAL_TEXT_MIN
      ? {fontSize: 'inherit', fontWeight: 'inherit', color: color || 'inherit'}
      : {fontSize: px + 'px', fontWeight: weight || 600, color: color || 'inherit'};
    return html`<span class=${'metal-text-plain' + (className ? ' ' + className : '')} style=${style}>${children}</span>`;
  }

  function MetalBadge({children, className}) {
    return html`<span class=${'pill flame' + (className ? ' ' + className : '')}>${children}</span>`;
  }

  /* VoiceBeam under an input (default), round a recording pill (pill), or along a phone screen
     (mobile); a live microphone stream drives it, or a level getter */
  function Voice({on, level, stream, processing, type, children, className}) {
    useSettled();
    const th = M.useResolvedTheme();
    const fx = FX();
    if (!fx) return children;
    /* staticColors holds the lobes on flame (no hue drift toward pink); the pill keeps the small button's corners */
    return html`<${fx.VoiceBeam} type=${type || 'default'} stream=${stream || null} level=${stream ? undefined : (level || 0)} processing=${!!processing} active=${on !== false} theme=${th} colors=${FLAME_LOBES} bandColors=${FLAME_BANDS} staticColors=${true} className=${className} borderRadius=${type === 'mobile' ? 0 : type === 'pill' ? 10 : 12}>${children}<//>`;
  }

  /* the recording pill: a Talk button wrapped in the pill beam, fed by its own microphone while live */
  /* the microphone hook is called on every render, settled or not, so the hook order never changes;
     window.FX is fixed for the page's life (the bundle loads before this file) */
  const useMic = window.FX && window.FX.useMicrophone ? window.FX.useMicrophone : () => null;
  function VoicePill({live, children}) {
    useSettled();
    const fx = FX();
    const mic = useMic();
    React.useEffect(() => {
      if (!mic || !fx) return undefined;
      if (live) mic.start().catch(() => {}); else mic.stop();
      return () => mic.stop();
    }, [live, !!mic, !!fx]);
    if (!fx) return children;
    return html`<span class=${'voice-pill' + (live ? ' is-live' : '')}><${Voice} type="pill" on=${!!live} stream=${live && mic ? mic.stream : null}>${children}<//></span>`;
  }

  /* v40: the robot is retired. The design (design/m360-os-v7.html) has one character, the live mark (M.mark), so
     every place that still asks for a bot gets nothing and lays out without it */
  function Bot() { return null; }

  /* BellToggle from React Bits; its count badge is drawn only where a count is passed, so a plain
     switch carries no hidden digits */
  function Bell(props) {
    useSettled();
    const fx = FX();
    const all = {...props, badge: props.badge != null ? props.badge : props.count != null};
    if (!fx) return M.parts.BellToggle ? html`<${M.parts.BellToggle} ...${all}/>` : null;
    return html`<${fx.BellToggle} ...${all}/>`;
  }

  M.fx = {...(M.fx || {}), Orb, Beam, BeamFx, Metal, MetalText, MetalBadge, Voice, VoicePill, Bot, Bell, BOTS, FLAME, has: () => !!window.FX, useSettled, useHushed};
})();
