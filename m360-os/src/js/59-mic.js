/* module: mic. A talk button: tap, speak, tap again, and the words land in a field. With the voice box
   set up on the site the recording goes to Whisper through the server and the words come back with
   the language heard (English, Hindi, Arabic and more); everywhere else the browser's own speech
   recognition does the listening, and says so where it does not exist. onText(text, language). */
'use strict';
(function () {
  const {html, React, icons} = M;
  const {useState, useRef, useEffect} = React;
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const MAX_MS = 30000;

  function MicButton({onText, label, sm, onLive}) {
    const [live, setLiveRaw] = useState(false);
    const setLive = v => { setLiveRaw(v); if (onLive) onLive(!!v); };
    const [busy, setBusy] = useState(false);
    const rec = useRef(null);
    const heard = useRef('');
    useEffect(() => () => { if (rec.current) { try { rec.current.abort(); } catch (e) { /* stopped */ } } }, []);

    /* the box: record, then send the recording up */
    const startBox = async () => {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); }
      catch (e) { M.toast('The mic is off in this browser. Type instead', true); return; }
      const mr = new MediaRecorder(stream);
      const parts = [];
      const r = {abort: () => { mr.onstop = null; try { if (mr.state !== 'inactive') mr.stop(); } catch (e) { /* stopped */ } stream.getTracks().forEach(t => t.stop()); }, stop: () => { try { if (mr.state !== 'inactive') mr.stop(); } catch (e) { /* stopped */ } }};
      mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (rec.current === r) rec.current = null;
        setLive(false); setBusy(true);
        try {
          const out = await M.speech.listen(new Blob(parts, {type: mr.mimeType || 'audio/webm'}));
          if (out.text) { onText(out.text, out.language); M.sound.play('soft'); } else M.toast('Nothing heard. Try again');
        } catch (e) { M.toast(e && e.code === 'voice_off' ? 'Voice is off here. Type instead' : 'The voice box did not answer. Type instead', true); }
        setBusy(false);
      };
      rec.current = r;
      mr.start();
      setLive(true); M.sound.play('start');
      setTimeout(() => { if (rec.current === r) r.stop(); }, MAX_MS);
    };

    /* the browser's own recognition */
    const startBrowser = () => {
      const S = SR();
      if (!S) { M.toast('Voice is off in this browser. Type instead', true); return; }
      try {
        const r = new S();
        r.lang = 'en-IN'; r.interimResults = true; r.continuous = true;
        r.onresult = ev => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; heard.current = t; };
        r.onerror = () => { rec.current = null; setLive(false); M.toast('Voice is off here. Type instead', true); };
        r.onend = () => { if (rec.current === r) { rec.current = null; setLive(false); if (heard.current.trim()) { onText(heard.current.trim(), 'en'); heard.current = ''; } } };
        rec.current = r; heard.current = ''; r.start(); setLive(true);
      } catch (e) { M.toast('Voice is off here. Type instead', true); }
    };

    const stop = () => {
      const r = rec.current;
      if (!r) { setLive(false); return; }
      if (r.abort && !r.lang) { r.stop(); return; }   /* the box recorder finishes in onstop */
      try { r.stop(); } catch (e) { /* stopped */ }
      rec.current = null;
      setLive(false);
      if (heard.current.trim()) { onText(heard.current.trim(), 'en'); M.sound.play('soft'); }
      heard.current = '';
    };
    const start = () => { if (M.speech && M.speech.listenOn && M.speech.listenOn()) startBox(); else startBrowser(); };
    const btn = html`<button type="button" class=${'btn sec micbtn' + (sm === false ? '' : ' sm') + (live ? ' live' : '')} aria-pressed=${live} aria-label=${live ? 'Listening, tap to stop' : undefined} title=${live ? 'Tap to stop' : undefined} disabled=${busy} onClick=${live ? stop : start}>
      <${icons.voice}/>${live ? (sm === false ? 'Listening, tap to stop' : 'Listening') : busy ? 'Hearing it' : (label || 'Say it')}</button>`;
    /* the recording pill (voice-glow) rides the button while it listens */
    return M.fx && M.fx.VoicePill ? html`<${M.fx.VoicePill} live=${live}>${btn}<//>` : btn;
  }

  M.parts.MicButton = MicButton;
})();
