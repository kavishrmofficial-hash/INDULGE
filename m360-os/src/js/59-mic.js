/* module: mic. Listening, in one place. M.mic.listen() records through the voice box when the site has
   one (the recording goes to Whisper and comes back as words with the language heard), and otherwise
   through the browser's own speech recognition, which writes the words as they are said. It keeps a
   live level of the microphone for whatever glows with it, and the time the last listening ended.
   The talk button is built on it: tap, speak, tap again, and the words land in a field.
   onText(text, language). */
'use strict';
(function () {
  const {html, React, icons} = M;
  const {useState, useRef, useEffect} = React;
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const MAX_MS = 30000;

  /* the level: an analyser on a live stream, smoothed, 0 to 1 */
  const LEVEL = {v: 0, at: 0};
  function meter(stream) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!stream || !AC) return () => {};
    let ac = null, raf = 0, gone = false;
    try {
      ac = new AC();
      const an = ac.createAnalyser();
      an.fftSize = 512;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let smooth = 0;
      const tick = () => {
        if (gone) return;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        smooth = smooth * 0.75 + Math.min(1, Math.sqrt(sum / buf.length) * 4) * 0.25;
        LEVEL.v = smooth; LEVEL.at = Date.now();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch (e) { /* no audio graph here: nothing glows with the voice, the words still come */ }
    return () => { gone = true; cancelAnimationFrame(raf); LEVEL.v = 0; if (ac) { try { ac.close(); } catch (e) { /* closed */ } } };
  }

  let endedAt = 0;
  let current = null;
  const ended = () => {
    endedAt = Date.now();
    try { window.dispatchEvent(new CustomEvent('m360:mic', {detail: {on: false, at: endedAt}})); } catch (e) { /* none */ }
  };
  const started = () => { try { window.dispatchEvent(new CustomEvent('m360:mic', {detail: {on: true, at: Date.now()}})); } catch (e) { /* none */ } };

  /* o: {onWords(text), onHearing(), onEnd(text, language), onFail(why), cap, silence, meter}
     cap: the longest it listens (30 s); silence: in a follow up, how long a quiet start may last before
     it gives up, and after the first words, how long a pause ends the sentence.
     Returns {stop, abort, kind} or null when nothing here can listen. stop() finishes and sends the
     words on; abort() drops them. */
  function listen(o) {
    o = o || {};
    if (current) { try { current.abort(); } catch (e) { /* gone */ } current = null; }
    const cap = o.cap || MAX_MS;
    const box = !!(M.speech && M.speech.listenOn && M.speech.listenOn());
    if (box) return listenBox(o, cap);
    const S = SR();
    if (!S) return null;
    let words = '', timer = 0, capT = 0, unmeter = () => {}, live = true, out = false;
    const r = new S();
    const h = {kind: 'browser', started: Date.now(),
      stop() { clearTimeout(timer); try { r.stop(); } catch (e) { finish(); } },
      abort() { live = false; clearTimeout(timer); clearTimeout(capT); unmeter(); try { r.abort(); } catch (e) { /* stopped */ } if (current === h) current = null; ended(); }};
    const finish = () => {
      if (out) return;
      out = true; clearTimeout(timer); clearTimeout(capT); unmeter();
      if (current === h) current = null;
      ended();
      if (live && o.onEnd) o.onEnd(words.trim(), 'en');
    };
    const arm = ms => { clearTimeout(timer); timer = setTimeout(() => { try { r.stop(); } catch (e) { finish(); } }, ms); };
    r.lang = 'en-IN'; r.interimResults = true; r.continuous = true;
    r.onresult = ev => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      words = t;
      if (live && o.onWords) o.onWords(t);
      if (o.silence) arm(1800);
    };
    r.onerror = ev => {
      if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture')) {
        live = false; finish(); if (o.onFail) o.onFail('denied');
      }
    };
    r.onend = finish;
    try { r.start(); } catch (e) { return null; }
    current = h; started();
    if (o.silence) arm(o.silence);
    capT = setTimeout(() => { try { r.stop(); } catch (e) { finish(); } }, cap);
    /* the meter wants its own stream: recognition keeps the microphone to itself */
    if (o.meter && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then(s => {
        if (out || !live) { s.getTracks().forEach(t => t.stop()); return; }
        const off = meter(s);
        unmeter = () => { off(); s.getTracks().forEach(t => t.stop()); };
      }).catch(() => { /* the words still come without the glow */ });
    }
    return h;
  }

  /* the box: record, and when it stops, send the recording up. In a follow up the level decides when
     the sentence is over (a pause after speech) and when nobody is going to talk (o.silence) */
  function listenBox(o, cap) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return null;
    let mr = null, stream = null, live = true, unmeter = () => {}, capT = 0, vad = 0;
    const h = {kind: 'box', started: Date.now(),
      stop() { if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch (e) { /* stopped */ } } else { live = false; done(); } },
      abort() { live = false; if (mr) mr.onstop = null; try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (e) { /* stopped */ } done(); }};
    const done = () => {
      clearTimeout(capT); clearInterval(vad); unmeter();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (current === h) { current = null; ended(); }
    };
    current = h; started();
    navigator.mediaDevices.getUserMedia({audio: true}).then(s => {
      stream = s;
      if (!live || current !== h) { done(); return; }
      const parts = [];
      mr = new MediaRecorder(s);
      unmeter = meter(s);
      mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      mr.onstop = async () => {
        done();
        if (!live) return;
        if (o.onHearing) o.onHearing();
        let text = '', lang = 'en';
        try { const out = await M.speech.listen(new Blob(parts, {type: mr.mimeType || 'audio/webm'})); text = out.text; lang = out.language || 'en'; } catch (e) { text = ''; }
        if (o.onEnd) o.onEnd(String(text || '').trim(), lang);
      };
      mr.start();
      capT = setTimeout(() => h.stop(), cap);
      if (o.silence) {
        const t0 = Date.now();
        let spoke = 0, quietSince = 0;
        vad = setInterval(() => {
          const lv = LEVEL.v;
          if (lv > 0.08) { spoke = spoke || Date.now(); quietSince = 0; return; }
          quietSince = quietSince || Date.now();
          if (spoke && Date.now() - quietSince > 1500) h.stop();
          else if (!spoke && Date.now() - t0 > o.silence) { live = false; h.abort(); if (o.onEnd) o.onEnd('', 'en'); }
        }, 120);
      }
    }).catch(() => { live = false; done(); if (o.onFail) o.onFail('denied'); });
    return h;
  }

  M.mic = {
    listen,
    meter,
    /* the live microphone level, 0 to 1, while something listens */
    level: () => (Date.now() - LEVEL.at < 400 ? LEVEL.v : 0),
    /* when listening last ended, for anything that waits on the person to finish */
    endedAt: () => endedAt,
    live: () => !!current,
    stop: () => { if (current) current.stop(); },
    abort: () => { if (current) current.abort(); },
    /* can this browser hear at all: the box with a recorder, or the browser's recognition */
    can: () => !!((M.speech && M.speech.listenOn && M.speech.listenOn()) || SR())
  };

  function MicButton({onText, label, sm, onLive, id}) {
    const [live, setLiveRaw] = useState(false);
    const setLive = v => { setLiveRaw(v); if (onLive) onLive(!!v); };
    const [busy, setBusy] = useState(false);
    const rec = useRef(null);
    useEffect(() => () => { if (rec.current) { try { rec.current.abort(); } catch (e) { /* stopped */ } } }, []);
    const can = M.mic.can();

    const start = () => {
      const h = listen({
        onHearing: () => { setLive(false); setBusy(true); },
        onEnd: (text, lang) => {
          rec.current = null; setLive(false); setBusy(false);
          if (text) { onText(text, lang); M.sound.play('soft'); } else if (h && h.kind === 'box') M.toast('Nothing heard. Try again');
        },
        onFail: () => { rec.current = null; setLive(false); setBusy(false); M.toast('The mic is off in this browser. Type instead', true); }
      });
      if (!h) { M.toast('No microphone here. Type your question.', true); return; }
      rec.current = h; setLive(true);
      if (h.kind === 'box') M.sound.play('start');
    };
    const stop = () => { const r = rec.current; if (r) r.stop(); else setLive(false); };
    const btn = html`<button type="button" id=${id} class=${'btn sec micbtn' + (sm === false ? '' : ' sm') + (live ? ' live' : '')} aria-pressed=${live}
      aria-label=${live ? 'Listening, tap to stop' : !can ? 'No microphone here. Type your question.' : undefined} title=${live ? 'Tap to stop' : !can ? 'No microphone here. Type your question.' : undefined}
      disabled=${busy || !can} onClick=${live ? stop : start}>
      <${icons.voice}/>${live ? (sm === false ? 'Listening, tap to stop' : 'Listening') : busy ? 'Hearing it' : (label || 'Say it')}</button>`;
    /* the recording pill (voice-glow) rides the button while it listens */
    return M.fx && M.fx.VoicePill ? html`<${M.fx.VoicePill} live=${live}>${btn}<//>` : btn;
  }

  M.parts.MicButton = MicButton;
})();
