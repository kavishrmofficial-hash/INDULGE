/* module: fx. The effects the page ships from the real packages (fx/entry.jsx, bundled into
   00-a-fx.vendor.js and exposed as window.FX): the thinking orbs, the border beam, the voice beam,
   the bot avatars, the liquid metal and the bell. These wrappers pick the house colours and theme,
   and stand down to the plain child when the bundle is missing or the person asked for reduced
   motion, so nothing in the app depends on the bundle being there. */
'use strict';
(function () {
  const {html, React} = M;
  const theme = () => M.theme.resolved();
  const FLAME = '#F53901';
  /* the canvases wait for the page to settle: the plain controls paint first, the effects follow a
     moment later, so a cold start on a phone stays quick */
  let settled = false;
  const subs = new Set();
  setTimeout(() => { settled = true; subs.forEach(fn => fn()); }, 450);
  const useSettled = () => React.useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => settled, () => settled);
  const FX = () => (window.FX && settled) ? window.FX : null;

  /* a small dotted sphere with a state: thinking lines, the orb screen, the phone's button */
  function Orb({state, size, dark, className, style, label}) {
    useSettled();
    const fx = FX();
    if (!fx || M.reduced()) return html`<span class=${'vorb ' + (size >= 64 ? '' : 'mini ') + (state || 'working') + (className ? ' ' + className : '')} style=${style} aria-hidden="true"/>`;
    return html`<${fx.ThinkingOrb} state=${state || 'working'} size=${size === 64 || size === 32 ? size : 20} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} className=${className} style=${style} aria-label=${label || ''}/>`;
  }

  /* a glow that rides the border of a hot card; variant sunset for flame, colorful for the thought.
     A beam repaints its whole border every frame, so it plays when the card comes into view (a few
     laps to draw the eye) and again while a pointer rests on the card, and stays still otherwise. */
  const BEAM_MS = 6000;
  const BEAM_MAX_H = 240;   /* a beam repaints its whole box: past this height it costs frames, so a tall card keeps its flame border still */
  function Beam({on, variant, size, radius, strength, duration, dark, children}) {
    useSettled();
    const host = React.useRef(null);
    const [run, setRun] = React.useState(false);
    const [hover, setHover] = React.useState(false);
    const [tall, setTall] = React.useState(false);
    React.useEffect(() => {
      if (!host.current || typeof ResizeObserver === 'undefined') return undefined;
      const ro = new ResizeObserver(es => { for (const e of es) setTall(e.contentRect.height > BEAM_MAX_H); });
      ro.observe(host.current);
      return () => ro.disconnect();
    }, [host.current]);
    const fx = FX();
    const enabled = !!fx && on !== false && !M.reduced();
    React.useEffect(() => {
      if (!enabled || !host.current || typeof IntersectionObserver === 'undefined') return undefined;
      let timer = 0, seen = false;
      const io = new IntersectionObserver(es => {
        const vis = es.some(e => e.isIntersecting);
        if (vis && !seen) { seen = true; setRun(true); clearTimeout(timer); timer = setTimeout(() => setRun(false), BEAM_MS); }
        if (!vis) { seen = false; clearTimeout(timer); setRun(false); }
      }, {threshold: 0.4});
      io.observe(host.current);
      return () => { io.disconnect(); clearTimeout(timer); };
    }, [enabled]);
    if (!enabled) return children;
    const active = (run || hover) && !tall;
    return html`<span ref=${host} class="beam-host" data-beam-live=${active ? '1' : '0'} data-beam-tall=${tall ? '1' : '0'} onPointerEnter=${e => { if (e.pointerType === 'mouse') setHover(true); }} onPointerLeave=${() => setHover(false)}>
      <${fx.BorderBeam} size=${size || 'md'} colorVariant=${variant || 'sunset'} strength=${strength == null ? 0.9 : strength} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} borderRadius=${radius == null ? 20 : radius} duration=${duration || 2.4} active=${active}>${children}<//>
    </span>`;
  }

  /* liquid metal round a primary control: ink is the dark chromatic pill, paper the light one. The
     metal rests on one still frame and flows only while a pointer is over it, it has focus, or a
     finger is on it (and for a moment after), so a page full of buttons costs nothing while idle. */
  function Metal({kind, circle, strength, children, className}) {
    useSettled();
    const [live, setLive] = React.useState(false);
    const off = React.useRef(0);
    React.useEffect(() => () => clearTimeout(off.current), []);
    const fx = FX();
    if (!fx || M.reduced()) return children;
    const dark = kind === 'paper' ? false : kind === 'ink' ? true : theme() === 'dark';
    const wake = () => { clearTimeout(off.current); setLive(true); };
    const rest = ms => { clearTimeout(off.current); off.current = setTimeout(() => setLive(false), ms || 0); };
    return html`<span class="metal-host" onPointerEnter=${wake} onPointerLeave=${e => rest(e.pointerType === 'touch' ? 1600 : 0)} onPointerDown=${wake} onPointerUp=${e => { if (e.pointerType === 'touch') rest(1600); }}
      onFocusCapture=${wake} onBlurCapture=${() => rest(0)}>
      <${fx.MetalFx} preset="chromatic" variant=${circle ? 'circle' : 'button'} theme=${dark ? 'dark' : 'light'} strength=${strength == null ? 1 : strength} innerShadow=${!!circle} paused=${!live} className=${'metal ' + (dark ? 'metal-ink' : 'metal-paper') + (live ? ' is-live' : '') + (className ? ' ' + className : '')}>${children}<//>
    </span>`;
  }

  /* a sound-reactive beam along the bottom of an input (default), a pill, or a phone screen (mobile) */
  function Voice({on, level, stream, processing, type, variant, children, className}) {
    useSettled();
    const fx = FX();
    if (!fx) return children;
    return html`<${fx.VoiceBeam} type=${type || 'default'} stream=${stream || null} level=${stream ? undefined : (level || 0)} processing=${!!processing} active=${on !== false} theme=${theme()} colorVariant=${variant || 'sunset'} className=${className} borderRadius=${type === 'mobile' ? 0 : 12}>${children}<//>`;
  }

  /* the drawn creature beside the AI's words */
  function Bot({type, state, size, seed, face, label, id, className}) {
    useSettled();
    const fx = FX();
    if (!fx) return M.parts.Bot ? html`<${M.parts.Bot} state=${state} size=${size} seed=${seed} label=${label} id=${id}/>` : null;
    return html`<${fx.BotAvatar} type=${type || 'clover'} state=${state || 'default'} size=${size || 28} seed=${seed || 0} face=${face || 'eyes'} color=${FLAME} theme=${theme()} id=${id} className=${className} aria-label=${label || 'm360'}/>`;
  }

  /* the bell that rings: the notifications pill */
  function Bell(props) {
    useSettled();
    const fx = FX();
    if (!fx) return M.parts.BellToggle ? html`<${M.parts.BellToggle} ...${props}/>` : null;
    return html`<${fx.BellToggle} ...${props}/>`;
  }

  M.fx = {...(M.fx || {}), Orb, Beam, Metal, Voice, Bot, Bell, has: () => !!window.FX, useSettled};
})();
