/* module: fx. The six effects from the real packages (fx/entry.jsx, bundled into 00-a-fx.vendor.js
   and exposed as window.FX), used the way their authors ship them. The one edit is colour: every
   accent is our agency orange, flame #F53901. Each wrapper stands down to the plain child when the
   bundle is missing or the person asked for reduced motion, so nothing depends on the bundle.

     M.fx.Orb       thinking-orbs   ThinkingOrb, any of the nine states, sizes 20 / 32 / 64
     M.fx.Beam      border-beam     BorderBeam round a card or a control, running while on screen
     M.fx.Voice     voice-glow      VoiceBeam under an input, a recording pill or a phone screen
     M.fx.VoicePill voice-glow      the recording pill round a Talk button while it listens
     M.fx.Bot       bot-avatars     BotAvatar, one body per AI feature (M.fx.BOTS)
     M.fx.Metal     metal-fx        MetalFx round a primary button or an icon circle
     M.fx.MetalText metal-fx        MetalText for a headline word or a number
     M.fx.MetalBadge metal-fx       MetalBadge for a small "new" style tag
     M.fx.Bell      React Bits      BellToggle for anything you switch on to be told about */
'use strict';
(function () {
  const {html, React} = M;
  const theme = () => M.theme.resolved();
  const FLAME = '#F53901';
  /* the voice beam's seven lobes and its bands, in flame and its neighbours */
  const FLAME_LOBES = ['rgb(245,57,1)', 'rgb(255,106,43)', 'rgb(255,138,76)', 'rgb(240,91,27)', 'rgb(255,78,18)', 'rgb(255,160,107)', 'rgb(217,49,0)'];
  const FLAME_BANDS = {core: 'rgb(255,214,190)', above: 'rgb(255,138,76)', mid: 'rgb(245,57,1)', below: 'rgb(217,49,0)'};

  /* the canvases wait for the page to settle: the plain controls paint first, the effects follow a
     moment later, so a cold start on a phone stays quick */
  let settled = false;
  const subs = new Set();
  setTimeout(() => { settled = true; subs.forEach(fn => fn()); }, 450);
  const useSettled = () => React.useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => settled, () => settled);
  const FX = () => (window.FX && settled) ? window.FX : null;
  const still = () => M.reduced();

  /* one bot body per AI feature, all in flame, so each agent is recognisable at a glance */
  const BOTS = {ask: 'clover', buddy: 'droid', brief: 'star', hq: 'mech', radar: 'alien', clients: 'flower', base: 'hexagon', search: 'cat',
    sections: 'blob', handshake: 'ghost', writer: 'drop', notes: 'pebble', empty: 'cloud', care: 'puddle', hiring: 'triangle', books: 'square'};

  /* ThinkingOrb. States: working, searching, solving, listening, connecting, weaving, composing,
     breathing, shaping. Sizes as tuned by the library: 64 (avatar), 32, 20 (inline text). */
  function Orb({state, size, dark, className, style, label}) {
    useSettled();
    const fx = FX();
    if (!fx || still()) return html`<span class=${'vorb ' + (size >= 64 ? '' : 'mini ') + (state || 'working') + (className ? ' ' + className : '')} style=${style} aria-hidden="true"/>`;
    return html`<${fx.ThinkingOrb} state=${state || 'working'} size=${size === 64 || size === 32 ? size : 20} color=${FLAME} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} className=${className} style=${style} aria-label=${label || ''}/>`;
  }

  /* BorderBeam, the library's own defaults (size md, strength 0.7) with the sunset palette held on
     its oranges. It runs while the element is on screen. A beam repaints its whole box each frame,
     so on a box taller than BEAM_MAX_H it holds still and the element keeps its own border. */
  const BEAM_MAX_H = 260;
  function Beam({on, size, radius, strength, duration, dark, children, block}) {
    useSettled();
    const host = React.useRef(null);
    const [vis, setVis] = React.useState(false);
    const [tall, setTall] = React.useState(false);
    const fx = FX();
    const enabled = !!fx && on !== false && !still();
    React.useEffect(() => {
      if (!enabled || !host.current) return undefined;
      let ro = null, io = null;
      if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(es => { for (const e of es) setTall(e.contentRect.height > BEAM_MAX_H); }); ro.observe(host.current); }
      if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver(es => setVis(es.some(e => e.isIntersecting)), {threshold: 0.05}); io.observe(host.current); } else setVis(true);
      return () => { if (ro) ro.disconnect(); if (io) io.disconnect(); };
    }, [enabled]);
    if (!enabled) return children;
    const active = vis && !tall;
    return html`<span ref=${host} class=${'beam-host' + (block === false ? ' inline' : '')} data-beam-live=${active ? '1' : '0'} data-beam-tall=${tall ? '1' : '0'}>
      <${fx.BorderBeam} size=${size || 'md'} colorVariant="sunset" staticColors=${true} strength=${strength == null ? 0.7 : strength} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} borderRadius=${radius == null ? 20 : radius} duration=${duration} active=${active}>${children}<//>
    </span>`;
  }

  /* MetalFx, chromatic, flowing as the library ships it (it pauses itself off screen) */
  function Metal({kind, circle, strength, children, className, block}) {
    useSettled();
    const fx = FX();
    if (!fx || still()) return children;
    const dark = kind === 'paper' ? false : kind === 'ink' ? true : theme() === 'dark';
    return html`<span class=${'metal-host' + (block ? ' block' : '')}>
      <${fx.MetalFx} preset="chromatic" variant=${circle ? 'circle' : 'button'} theme=${dark ? 'dark' : 'light'} strength=${strength == null ? 1 : strength} innerShadow=${!!circle} className=${'metal ' + (dark ? 'metal-ink' : 'metal-paper') + (className ? ' ' + className : '')}>${children}<//>
    </span>`;
  }

  /* MetalText: a headline word or a number cast in metal; the plain text stands in without the bundle */
  function MetalText({children, size, weight, color, className}) {
    useSettled();
    const fx = FX();
    const px = Number(size) || 24;
    if (!fx || still()) return html`<span class=${'metal-text-plain' + (className ? ' ' + className : '')} style=${{fontSize: px + 'px', fontWeight: weight || 600}}>${children}</span>`;
    return html`<${fx.MetalText} font=${(weight || 600) + ' ' + px + "px/1.15 'Space Grotesk', system-ui, sans-serif"} color=${color || (theme() === 'dark' ? '#F2F1EC' : '#0E0E0E')} theme=${theme()} className=${className}>${children}<//>`;
  }

  /* MetalBadge: a small tag in metal */
  function MetalBadge({children, className}) {
    useSettled();
    const fx = FX();
    if (!fx || still()) return html`<span class=${'pill flame' + (className ? ' ' + className : '')}>${children}</span>`;
    return html`<span class=${'metal-badge-host' + (className ? ' ' + className : '')}><${fx.MetalBadge} theme=${theme()}>${children}<//></span>`;
  }

  /* VoiceBeam under an input (default), round a recording pill (pill), or along a phone screen
     (mobile); a live microphone stream drives it, or a level getter */
  function Voice({on, level, stream, processing, type, children, className}) {
    useSettled();
    const fx = FX();
    if (!fx) return children;
    return html`<${fx.VoiceBeam} type=${type || 'default'} stream=${stream || null} level=${stream ? undefined : (level || 0)} processing=${!!processing} active=${on !== false} theme=${theme()} colors=${FLAME_LOBES} bandColors=${FLAME_BANDS} className=${className} borderRadius=${type === 'mobile' ? 0 : type === 'pill' ? 22 : 12}>${children}<//>`;
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

  /* BotAvatar: the library's plush fabric shading, bodies by feature, all in flame */
  function Bot({type, feature, state, size, seed, face, label, id, className}) {
    useSettled();
    const fx = FX();
    const body = type || BOTS[feature] || 'clover';
    if (!fx) return M.parts.Bot ? html`<${M.parts.Bot} state=${state} size=${size} seed=${seed} label=${label} id=${id}/>` : null;
    return html`<${fx.BotAvatar} type=${body} state=${state || 'default'} size=${size || 28} seed=${seed || 0} face=${face || 'eyes'} color=${FLAME} theme=${theme()} id=${id} className=${className} aria-label=${label || 'm360'}/>`;
  }

  /* BellToggle from React Bits */
  function Bell(props) {
    useSettled();
    const fx = FX();
    if (!fx) return M.parts.BellToggle ? html`<${M.parts.BellToggle} ...${props}/>` : null;
    return html`<${fx.BellToggle} ...${props}/>`;
  }

  M.fx = {...(M.fx || {}), Orb, Beam, Metal, MetalText, MetalBadge, Voice, VoicePill, Bot, Bell, BOTS, FLAME, has: () => !!window.FX, useSettled};
})();
