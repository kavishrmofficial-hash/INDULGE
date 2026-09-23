/* module: mic. A talk button: tap, speak, tap again, and the words land in a field.
   Uses the browser's speech recognition where it exists; says so where it does not. */
'use strict';
(function () {
  const {html, React, UI, icons} = M;
  const {useState, useRef, useEffect} = React;
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function MicButton({onText, label, sm}) {
    const [live, setLive] = useState(false);
    const rec = useRef(null);
    const heard = useRef('');
    useEffect(() => () => { if (rec.current) { try { rec.current.abort(); } catch (e) { /* stopped */ } } }, []);
    const stop = () => {
      if (rec.current) { try { rec.current.stop(); } catch (e) { /* stopped */ } rec.current = null; }
      setLive(false);
      if (heard.current.trim()) { onText(heard.current.trim()); M.sound.play('soft'); }
      heard.current = '';
    };
    const start = () => {
      const S = SR();
      if (!S) { M.toast('Voice is off in this browser. Type instead', true); return; }
      try {
        const r = new S();
        r.lang = 'en-IN'; r.interimResults = true; r.continuous = true;
        r.onresult = ev => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; heard.current = t; };
        r.onerror = () => { rec.current = null; setLive(false); M.toast('Voice is off here. Type instead', true); };
        r.onend = () => { if (rec.current === r) { rec.current = null; setLive(false); if (heard.current.trim()) { onText(heard.current.trim()); heard.current = ''; } } };
        rec.current = r; heard.current = ''; r.start(); setLive(true);
      } catch (e) { M.toast('Voice is off here. Type instead', true); }
    };
    return html`<button type="button" class=${'btn sec micbtn' + (sm === false ? '' : ' sm') + (live ? ' live' : '')} aria-pressed=${live} onClick=${live ? stop : start}>
      <${icons.voice}/>${live ? 'Listening, tap to stop' : (label || 'Say it')}</button>`;
  }

  M.parts.MicButton = MicButton;
})();
