/* module: dayrate. How did the day go? One screen that takes over after a check-out, on the phone and
   on the laptop: a meter you drag from left to right, a face that changes as you go and a ground
   that moves from a deep red through amber to green. The number lands in your own check-in entry
   for the day (dayRate, 0 to 100, with the moment), where Home reads it back the next morning and
   Kaavish's team view reads the week. Skipping is one tap and nothing is recorded. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef, useCallback} = React;

  /* the face and its word from a value; thresholds climb so the top face takes some reaching */
  const FACES = [[0, '😞', 'Rough', 'rough'], [25, '😕', 'Meh', 'meh'], [45, '😐', 'Okay', 'okay'], [65, '🙂', 'Good', 'good'], [85, '😄', 'Great', 'great']];
  const faceFor = v => { let f = FACES[0]; for (const x of FACES) if (v >= x[0]) f = x; return f; };
  /* the ground: a deep red at 0, a warm yellow at 50, a clear green at 100; hue, saturation and
     lightness each move through the yellow stop so the middle reads as yellow, never as olive */
  const mix = (a, b, k) => a + (b - a) * k;
  const stop = v => v < 50 ? [mix(8, 46, v / 50), mix(78, 92, v / 50), mix(46, 50, v / 50)] : [mix(46, 142, (v - 50) / 50), mix(92, 62, (v - 50) / 50), mix(50, 40, (v - 50) / 50)];
  const hue = v => stop(v)[0];
  const ground = v => { const [h, s, l] = stop(v); return 'hsl(' + h.toFixed(0) + ' ' + s.toFixed(0) + '% ' + l.toFixed(0) + '%)'; };

  function DayRate({onClose}) {
    const ctx = M.useCtx();
    const [v, setV] = useState(62);
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const track = useRef(null);
    const last = useRef(-1);
    const face = faceFor(v);

    const setFrom = useCallback(x => {
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const n = Math.round(Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width))) * 100);
      if (n === last.current) return;
      const fx = faceFor(n), was = faceFor(last.current < 0 ? n : last.current);
      if (fx !== was) M.haptic.buzz('pick'); else if (Math.floor(n / 10) !== Math.floor(last.current / 10)) M.haptic.buzz('tap');
      last.current = n;
      setV(n); setTouched(true);
    }, []);
    const down = e => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* mouse */ } e.preventDefault(); setFrom(e.clientX); };
    const move = e => { if (e.buttons === 0) return; setFrom(e.clientX); };
    const key = e => {
      const step = e.shiftKey ? 10 : 5;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(100, v + step); last.current = n; setV(n); setTouched(true); M.haptic.buzz('tap'); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.max(0, v - step); last.current = n; setV(n); setTouched(true); M.haptic.buzz('tap'); }
      if (e.key === 'Home') { e.preventDefault(); setV(0); setTouched(true); }
      if (e.key === 'End') { e.preventDefault(); setV(100); setTouched(true); }
    };
    useEffect(() => { const esc = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onClose]);
    useEffect(() => { M.haptic.buzz('tick'); const t = setTimeout(() => { const k = document.getElementById('dayrate-knob'); if (k) k.focus(); }, 200); return () => clearTimeout(t); }, []);

    const save = () => {
      if (busy) return;
      setBusy(true);
      const today = U.todayStr();
      ctx.W.merge('checkin/' + ctx.uid, {days: {[today]: {dayRate: v, dayRateAt: Date.now()}}})
        .then(() => { M.haptic.buzz('done'); M.sound.play('chime'); if (v >= 85) M.rain('✨', document.getElementById('dayrate-face'), {n: 40, sound: false}); onClose(); })
        .catch(() => { setBusy(false); M.toast('That did not save. Try once more', true); });
    };

    return html`<div class="dayrate" id="dayrate" role="dialog" aria-label="How did your day go" data-face=${face[3]} data-value=${v} style=${{'--ground': ground(v), '--k': v / 100}}>
      <div class="dayrate-in">
        <div class="dayrate-top"><${M.Mark} width="66px"/><button type="button" class="iconbtn on-dark" aria-label="Not now" onClick=${onClose}><${M.icons.x}/></button></div>
        <div class="micro plain dayrate-micro">done for today</div>
        <h1 class="dayrate-q">How did your day go?</h1>
        <div class="dayrate-face" id="dayrate-face" key=${face[1]} aria-hidden="true">${face[1]}</div>
        <div class="dayrate-word" id="dayrate-word" aria-live="polite">${touched ? face[2] : 'Drag the dot'}</div>
        <div class="dayrate-track" ref=${track} onPointerDown=${down} onPointerMove=${move}>
          <div class="dayrate-fill"/>
          <div class="dayrate-knob" id="dayrate-knob" role="slider" tabIndex="0" aria-label="How your day went" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${v} aria-valuetext=${face[2]} onKeyDown=${key}/>
          <div class="dayrate-ends" aria-hidden="true"><span>rough</span><span>great</span></div>
        </div>
        <div class="dayrate-acts">
          <button type="button" class="btn xl on-dark" id="dayrate-save" disabled=${busy || !touched} onClick=${save}>${busy ? 'Saving' : 'That was my day'}</button>
          <button type="button" class="linky dayrate-skip" id="dayrate-skip" onClick=${onClose}>Not now</button>
        </div>
      </div>
    </div>`;
  }

  /* the host: the check-out paths call M.dayrate.open(); a stale open (someone already rated today) is skipped */
  let openFn = null;
  M.dayrate = {
    open: () => { if (openFn) openFn(); },
    faceFor, ground, FACES,
    todayOf: (ctx, uid) => { const e = ((ctx.coll.checkin.map[uid] || {}).days || {})[U.todayStr()]; return e && typeof e.dayRate === 'number' ? e.dayRate : null; },
    rateOf: (ctx, uid, ymd) => { const e = ((ctx.coll.checkin.map[uid] || {}).days || {})[ymd]; return e && typeof e.dayRate === 'number' ? e.dayRate : null; }
  };
  function DayRateHost() {
    const [open, setOpen] = useState(false);
    useEffect(() => { openFn = () => setOpen(true); return () => { openFn = null; }; }, []);
    const close = useCallback(() => setOpen(false), []);
    if (!open) return null;
    return html`<${DayRate} onClose=${close}/>`;
  }
  M.parts.DayRateHost = DayRateHost;

  /* a compact strip of the week's ratings, read by Home and the team view: a dot per day, the ground colour of its value */
  M.parts.RateStrip = function RateStrip({uid, days}) {
    const ctx = M.useCtx();
    const list = (days || [5, 4, 3, 2, 1, 0].map(i => U.ymd(U.addDays(new Date(), -i)))).map(d => ({d, v: M.dayrate.rateOf(ctx, uid, d)}));
    if (!list.some(x => x.v != null)) return null;
    return html`<span class="ratestrip" aria-label="Day ratings this week">
      ${list.map(x => html`<i key=${x.d} title=${x.d + (x.v == null ? '' : ': ' + faceFor(x.v)[2])} style=${x.v == null ? null : {background: ground(x.v)}} class=${x.v == null ? 'none' : ''}/>`)}
    </span>`;
  };
})();
