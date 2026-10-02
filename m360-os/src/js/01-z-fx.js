/* module: fx. The effects the page ships from the real packages (fx/entry.jsx, bundled into
   00-a-fx.vendor.js and exposed as window.FX): the thinking orbs, the border beam, the voice beam,
   the bot avatars, the liquid metal and the bell. These wrappers pick the house colours and theme,
   and stand down to the plain child when the bundle is missing or the person asked for reduced
   motion, so nothing in the app depends on the bundle being there. */
'use strict';
(function () {
  const {html, React} = M;
  const FX = () => window.FX || null;
  const theme = () => M.theme.resolved();
  const FLAME = '#F53901';

  /* a small dotted sphere with a state: thinking lines, the orb screen, the phone's button */
  function Orb({state, size, dark, className, style, label}) {
    const fx = FX();
    if (!fx || M.reduced()) return html`<span class=${'vorb ' + (size >= 64 ? '' : 'mini ') + (state || 'working') + (className ? ' ' + className : '')} style=${style} aria-hidden="true"/>`;
    return html`<${fx.ThinkingOrb} state=${state || 'working'} size=${size === 64 || size === 32 ? size : 20} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} className=${className} style=${style} aria-label=${label || ''}/>`;
  }

  /* a glow that rides the border of a hot card; variant sunset for flame, colorful for the thought */
  function Beam({on, variant, size, radius, strength, duration, dark, children}) {
    const fx = FX();
    if (!fx || on === false || M.reduced()) return children;
    return html`<${fx.BorderBeam} size=${size || 'md'} colorVariant=${variant || 'sunset'} strength=${strength == null ? 0.9 : strength} theme=${dark == null ? theme() : (dark ? 'dark' : 'light')} borderRadius=${radius == null ? 20 : radius} duration=${duration || 2.4}>${children}<//>`;
  }

  /* liquid metal round a primary control: ink is the dark chromatic pill, paper the light one */
  function Metal({kind, circle, strength, children, className}) {
    const fx = FX();
    if (!fx || M.reduced()) return children;
    const dark = kind === 'paper' ? false : kind === 'ink' ? true : theme() === 'dark';
    return html`<${fx.MetalFx} preset="chromatic" variant=${circle ? 'circle' : 'button'} theme=${dark ? 'dark' : 'light'} strength=${strength == null ? 1 : strength} innerShadow=${!!circle} className=${'metal ' + (dark ? 'metal-ink' : 'metal-paper') + (className ? ' ' + className : '')}>${children}<//>`;
  }

  /* a sound-reactive beam along the bottom of an input (default), a pill, or a phone screen (mobile) */
  function Voice({on, level, stream, processing, type, variant, children, className}) {
    const fx = FX();
    if (!fx) return children;
    return html`<${fx.VoiceBeam} type=${type || 'default'} stream=${stream || null} level=${stream ? undefined : (level || 0)} processing=${!!processing} active=${on !== false} theme=${theme()} colorVariant=${variant || 'sunset'} className=${className} borderRadius=${type === 'mobile' ? 0 : 12}>${children}<//>`;
  }

  /* the drawn creature beside the AI's words */
  function Bot({type, state, size, seed, face, label, id, className}) {
    const fx = FX();
    if (!fx) return M.parts.Bot ? html`<${M.parts.Bot} state=${state} size=${size} seed=${seed} label=${label} id=${id}/>` : null;
    return html`<${fx.BotAvatar} type=${type || 'clover'} state=${state || 'default'} size=${size || 28} seed=${seed || 0} face=${face || 'eyes'} color=${FLAME} theme=${theme()} id=${id} className=${className} aria-label=${label || 'm360'}/>`;
  }

  /* the bell that rings: the notifications pill */
  function Bell(props) {
    const fx = FX();
    if (!fx) return M.parts.BellToggle ? html`<${M.parts.BellToggle} ...${props}/>` : null;
    return html`<${fx.BellToggle} ...${props}/>`;
  }

  M.fx = {...(M.fx || {}), Orb, Beam, Metal, Voice, Bot, Bell, has: () => !!FX()};
})();
