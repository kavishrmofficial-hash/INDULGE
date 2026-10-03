/* module: orb. The buddy on a phone. A tap on the character in the corner raises a sheet, up to 88% of
   the screen, that listens at once when the microphone is allowed and writes what you say as you say
   it, word by word, over a sphere that swells with your voice. Stop talking (tap the sphere, or just
   stop) and the answer streams in under your words. The sheet is the same panel as the pop-up on a
   laptop (57-panel.js): the whole thread, the cards that wait on a tap, the receipts. Drag the handle
   down to put it away. A long press on the character is push to talk: let go and it sends. */
'use strict';
(function () {
  const {html, React} = M;
  const {useEffect, useRef} = React;

  /* the sound-reactive glow along the bottom edge of a wrapper (.vwrap): live while the mic is on,
     gathered into a travelling beam while the answer is on its way */
  function VoiceGlow({on, processing, mobile}) {
    const ref = useRef(null);
    useEffect(() => {
      if (!on || processing || !ref.current) return undefined;
      let raf = 0;
      const tick = () => { if (ref.current) ref.current.style.setProperty('--lvl', (M.mic ? M.mic.level() : 0).toFixed(3)); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); if (ref.current) ref.current.style.removeProperty('--lvl'); };
    }, [on, processing]);
    return html`<span ref=${ref} class=${'vglow' + (on ? ' on' : '') + (processing ? ' beam' : '') + (mobile ? ' mobile' : '')} aria-hidden="true" data-on=${on ? '1' : '0'} data-beam=${processing ? '1' : '0'}><i/><b/></span>`;
  }
  M.parts.VoiceGlow = VoiceGlow;
  M.fx = {...(M.fx || {}), level: () => (M.mic ? M.mic.level() : 0)};

  const SWIPE = 90;
  const modeOf = st => st.phase === 'listening' || st.phase === 'hearing' ? 'listening' : st.phase === 'thinking' ? 'thinking' : st.phase === 'answer' ? 'answer' : 'asking';

  /* props as for the panel, plus onClose; the dock owns the talking */
  function AgentSheet(props) {
    const {onClose} = props;
    const ref = useRef(null);
    const drag = useRef(null);
    const [, setN] = React.useState(0);
    useEffect(() => { const f = () => setN(n => n + 1); M.assistant.subs.add(f); return () => { M.assistant.subs.delete(f); }; }, []);
    const mode = modeOf(M.assistant.st);
    useEffect(() => { if (mode === 'listening') M.haptic.buzz('tick'); if (mode === 'answer') M.haptic.buzz('done'); }, [mode]);

    /* the head is the handle: drag it down past the line and the sheet goes */
    const down = e => {
      if (!e.target.closest || !e.target.closest('.panel-head') || e.target.closest('button')) return;
      drag.current = {y: e.clientY, dy: 0};
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
      if (ref.current) ref.current.style.transition = 'none';
    };
    const move = e => {
      const d = drag.current;
      if (!d || !ref.current) return;
      d.dy = Math.max(0, e.clientY - d.y);
      ref.current.style.transform = 'translateY(' + d.dy + 'px)';
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!ref.current) return;
      if (d && d.dy > SWIPE) { onClose(); return; }
      ref.current.style.transition = M.reduced() ? '' : 'transform .18s ease';
      ref.current.style.transform = '';
    };
    const Panel = M.parts.AgentPanel;
    return html`<div class="agent-sheet-wrap">
      <div class="scrim agent-sheet-scrim" onClick=${onClose}/>
      <div ref=${ref} class="orb-screen agent-sheet" id="orb-screen" role="dialog" aria-modal="true" aria-label="Ask m360" data-mode=${mode}
        onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        ${Panel ? html`<${Panel} ...${props} size="sheet"/>` : null}
      </div>
    </div>`;
  }
  M.parts.AgentSheet = AgentSheet;

  /* the character's mark on a phone, kept for anything that still asks for it */
  M.parts.OrbMark = () => M.fx && M.fx.Bot ? html`<span class="orb-mark"><${M.fx.Bot} type="droid" size=${32} label="m360"/></span>` : html`<span class="vorb" aria-hidden="true"/>`;
})();
