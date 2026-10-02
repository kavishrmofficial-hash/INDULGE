/* module: orb. The buddy on a phone. The button in the corner is a small live sphere; a tap opens a
   white screen that listens at once and writes what you say as you say it, word by word, with the
   sphere swelling to your voice. Let go of the talking (tap the sphere, or just stop) and the answer
   streams in under your words and is read aloud. Typing is one tap away at the bottom. The screen is
   the buddy's bubble on a small screen; the buddy keeps its memory, tools and tour. */
'use strict';
(function () {
  const {html, React} = M;
  const {useEffect, useRef, useState} = React;

  const MicIcon = () => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;

  /* the sphere follows the mic: an analyser on its own stream, released when listening ends */
  function useLevel(active, ref) {
    useEffect(() => {
      if (!active || !ref.current || !navigator.mediaDevices || !window.AudioContext && !window.webkitAudioContext) return undefined;
      let gone = false, raf = 0, stream = null, ac = null;
      const AC = window.AudioContext || window.webkitAudioContext;
      navigator.mediaDevices.getUserMedia({audio: true}).then(s => {
        if (gone) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s; ac = new AC();
        const src = ac.createMediaStreamSource(s), an = ac.createAnalyser();
        an.fftSize = 512; src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        let smooth = 0;
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
          const rms = Math.sqrt(sum / buf.length);
          smooth = smooth * 0.75 + Math.min(1, rms * 4) * 0.25;
          if (ref.current) ref.current.style.setProperty('--lvl', smooth.toFixed(3));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }).catch(() => { /* no mic for the meter: the sphere rings without it */ });
      return () => {
        gone = true; cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (ac) { try { ac.close(); } catch (e) { /* closed */ } }
        if (ref.current) ref.current.style.removeProperty('--lvl');
      };
    }, [active]);
  }

  function Words({text, quiet}) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    return html`<div class=${'orb-heard' + (quiet ? ' quiet' : '')} id="orb-heard">${words.map((w, i) => html`<${React.Fragment} key=${i}><span class="orb-w">${w}</span>${i < words.length - 1 ? ' ' : ''}<//>`)}</div>`;
  }

  function OrbScreen({mode, heard, answer, err, acts, followUp, q, setQ, onAsk, onTalk, onStop, onClose, onTour, pending}) {
    const orb = useRef(null);
    const [typing, setTyping] = useState(false);
    const listening = mode === 'listening' || followUp;
    useLevel(listening, orb);
    useEffect(() => { if (mode === 'listening') M.haptic.buzz('tick'); if (mode === 'answer') M.haptic.buzz('done'); }, [mode]);
    useEffect(() => { if (mode === 'asking') setTyping(true); }, [mode]);
    const micro = mode === 'listening' ? 'listening' : mode === 'thinking' ? 'thinking' : followUp ? 'listening for a follow up' : mode === 'answer' ? 'm360' : 'ask m360';
    const hint = mode === 'listening' ? 'Talk. Tap the sphere when you are done.' : mode === 'thinking' ? 'One moment.' : followUp ? 'Say more, or say nothing.' : mode === 'answer' ? 'Tap the sphere to ask again.' : 'Tap the sphere and talk.';
    const tap = () => {
      M.haptic.buzz('tap');
      if (mode === 'listening' || followUp) { onStop(); return; }
      if (mode === 'thinking') return;
      onTalk();
    };
    const PendingActs = M.parts.PendingActs;
    return html`<div class="orb-screen" role="dialog" aria-label="Ask m360" id="orb-screen" data-mode=${mode}>
      <div class="orb-top">
        <span class="micro">${micro}</span>
        <button type="button" class="iconbtn" aria-label="Close" onClick=${onClose}><${M.icons.x}/></button>
      </div>
      <div class="orb-stage">
        <button type="button" class="orb-tap" id="orb-tap" aria-label=${listening ? 'Done talking' : 'Talk'} aria-pressed=${listening} onClick=${tap}>
          <span ref=${orb} class=${'vorb' + (listening ? ' live' : mode === 'thinking' ? ' think' : '')}/>
        </button>
        <div class="orb-hint">${hint}</div>
      </div>
      <div class="orb-body">
        ${heard || mode === 'listening' ? html`<${Words} text=${heard || 'Go ahead.'} quiet=${!heard}/>` : null}
        ${mode === 'thinking' && !answer ? html`<${M.Thinking} label="Looking at your screen"/>` : null}
        ${answer && mode !== 'listening' ? html`<div class="orb-answer" id="orb-answer"><${M.AIText} text=${answer}/></div>` : null}
        ${PendingActs && (mode === 'answer' || mode === 'thinking') ? html`<${PendingActs}/>` : null}
        ${(acts || []).map((a, i) => html`<div key=${i} class="tiny ink62">${a}</div>`)}
        ${err ? html`<div class="small flame-t">${err}</div>` : null}
        ${mode === 'asking' && !heard ? html`<div class="orb-acts">
          ${['What can you do?', 'What is on my calendar this week?', 'Open a new task for me', 'What is overdue on me?'].map(t => html`<button key=${t} type="button" class="orb-pill" onClick=${() => onAsk(t)}>${t}</button>`)}
          <button type="button" class="linky tiny" onClick=${onTour}>Show me around</button>
        </div>` : null}
      </div>
      <div class="orb-foot">
        ${typing || mode === 'asking' || mode === 'answer' ? html`<input id="orb-input" class="input" value=${q} placeholder="Or type it" aria-label="Ask m360" autoFocus=${mode === 'asking'}
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && q.trim()) onAsk(q); }}/>
        <button type="button" class="btn" disabled=${!q.trim()} onClick=${() => onAsk(q)}>Ask</button>` : html`<button type="button" class="btn sec" style=${{flex: '1 1 auto'}} onClick=${() => setTyping(true)}><${MicIcon}/> Type it</button>`}
      </div>
    </div>`;
  }
  M.parts.OrbScreen = OrbScreen;
  M.parts.OrbMark = () => html`<span class="vorb" aria-hidden="true"/>`;
})();
