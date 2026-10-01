/* module: reset. Break, the Reset tab: one tap of breathing, meditation timers with a bell, and five
   creativity resets with the research behind each (the alternative uses test, remote associates, a
   blue minute, doodling, a walk). Each earns sparks once a day. Nothing here needs the model. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const OBJECTS = ['a paperclip', 'a brick', 'a shoe', 'a coffee mug', 'a newspaper', 'a rubber band', 'a plastic bottle', 'a wooden spoon', 'a tote bag', 'a traffic cone', 'an old phone', 'a safety pin', 'a bedsheet', 'a tennis ball', 'a ladder'];
  const TRIADS = [
    [['cottage', 'swiss', 'cake'], 'cheese'], [['cream', 'skate', 'water'], 'ice'], [['loser', 'throat', 'spot'], 'sore'], [['show', 'life', 'row'], 'boat'],
    [['night', 'wrist', 'stop'], 'watch'], [['duck', 'fold', 'dollar'], 'bill'], [['rocking', 'wheel', 'high'], 'chair'], [['dew', 'comb', 'bee'], 'honey'],
    [['fountain', 'baking', 'pop'], 'soda'], [['preserve', 'ranger', 'tropical'], 'forest'], [['aid', 'rubber', 'wagon'], 'band'], [['flake', 'mobile', 'cone'], 'snow'],
    [['cracker', 'fly', 'fighter'], 'fire'], [['safety', 'cushion', 'point'], 'pin'], [['cane', 'daddy', 'plum'], 'sugar'], [['dream', 'break', 'light'], 'day'],
    [['fish', 'mine', 'rush'], 'gold'], [['political', 'surprise', 'line'], 'party'], [['measure', 'worm', 'video'], 'tape'], [['high', 'district', 'house'], 'school'],
    [['sense', 'courtesy', 'place'], 'common'], [['worm', 'shelf', 'end'], 'book'], [['piece', 'mind', 'dating'], 'game'], [['flower', 'friend', 'scout'], 'girl'],
    [['river', 'note', 'account'], 'bank'], [['print', 'berry', 'bird'], 'blue'], [['pie', 'luck', 'belly'], 'pot'], [['date', 'alley', 'fold'], 'blind'],
    [['opera', 'hand', 'dish'], 'soap'], [['cadet', 'capsule', 'ship'], 'space'], [['fur', 'back', 'tail'], 'horse'], [['stick', 'maker', 'point'], 'match']
  ];
  const day = () => U.todayStr();
  const onceToday = (ctx, what) => !!(M.play && M.play.mine(ctx).today[what]);
  const earn = (ctx, what, n) => { if (onceToday(ctx, what)) { M.toast('Already counted today. Still worth it.'); return Promise.resolve(); } return M.play.award(ctx, n || 5, what); };

  /* a countdown with a ring and a bell */
  function Timer({seconds, label, onDone, onStop, prompts}) {
    const [left, setLeft] = useState(seconds);
    const t0 = useRef(Date.now());
    useEffect(() => {
      const id = setInterval(() => {
        const l = Math.max(0, seconds - Math.round((Date.now() - t0.current) / 1000));
        setLeft(l);
        if (l <= 0) { clearInterval(id); M.sound.play('chime'); onDone(); }
      }, 250);
      return () => clearInterval(id);
    }, [seconds]);
    const r = 46, C = 2 * Math.PI * r, p = 1 - left / seconds;
    const prompt = prompts && prompts.length ? prompts[Math.min(prompts.length - 1, Math.floor((seconds - left) / (seconds / prompts.length)))] : '';
    return html`<div class="brk-timer" id="brk-timer">
      <svg viewBox="0 0 100 100" class="brk-ring" aria-hidden="true"><circle class="bg" cx="50" cy="50" r=${r}/><circle class="fg" cx="50" cy="50" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - p)}/></svg>
      <div class="brk-timer-mid"><div class="num brk-left">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div><div class="tiny ink62">${label}</div></div>
      ${prompt ? html`<div class="small brk-prompt">${prompt}</div>` : null}
      <button type="button" class="linky tiny" onClick=${onStop}>Stop</button>
    </div>`;
  }

  function Meditate({ctx}) {
    const [run, setRun] = useState(0);
    if (run) return html`<${Timer} seconds=${run * 60} label=${run + ' minute sit'} onStop=${() => setRun(0)} onDone=${() => { setRun(0); earn(ctx, 'a sit', 5); }}
      prompts=${['Sit back. Shoulders down. Jaw loose.', 'Breathe in through the nose, out through the mouth, slower than feels natural.', 'Thoughts will come. Let them pass like notifications you did not open.', 'Count the breaths from one to ten, then start over.', 'Last stretch. Notice three sounds in the room.', 'Nearly there. Come back slowly.']}/>`;
    return html`<div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
      <${UI.Btn} id="breathe-now" onClick=${() => { if (M.breathe) M.breathe.open(); earn(ctx, 'a breath', 5); }}>Breathe, one minute<//>
      ${[3, 5, 10].map(m => html`<${UI.Btn} key=${m} kind="sec" id=${'sit-' + m} onClick=${() => setRun(m)}>Sit ${m} min<//>`)}
    </div>`;
  }

  /* the alternative uses test: two minutes, one object, every use you can think of */
  function Uses({ctx}) {
    const [obj] = useState(() => OBJECTS[Math.floor(Math.random() * OBJECTS.length)]);
    const [on, setOn] = useState(false);
    const [text, setText] = useState('');
    const [result, setResult] = useState(null);
    const count = text.split('\n').map(l => l.trim()).filter(Boolean).length;
    const finish = () => { setOn(false); setResult(count); earn(ctx, 'thirty uses', 5 + (count >= 10 ? 5 : 0)); };
    return html`<div class="stack tight">
      <div class="small">List every use you can think of for <b>${obj}</b>. Normal ones, weird ones, illegal in some states ones. Fluency first, quality later.</div>
      ${on ? html`<${Timer} seconds=${120} label="uses" onStop=${finish} onDone=${finish}/>` : null}
      ${on || result != null ? html`<textarea class="input" rows="6" id="uses-text" placeholder="One per line" value=${text} onInput=${e => setText(e.target.value)} disabled=${!on}/>` : null}
      <div class="row between">
        ${result == null ? html`<${UI.Btn} id="uses-start" sm=${true} disabled=${on} onClick=${() => { setOn(true); setText(''); M.sound.play('start'); }}>${on ? 'Go' : 'Start two minutes'}<//>` : html`<span class="small"><b class="num">${result}</b> uses. ${result >= 15 ? 'That is a creative brain on a good day.' : result >= 8 ? 'Solid. The second minute is where the weird ones live.' : 'The first few are everyone\'s. Tomorrow, push past them.'}</span>`}
        <span class="tiny ink62 num">${on ? count + ' so far' : ''}</span>
      </div>
    </div>`;
  }

  /* remote associates: three words, one word that goes with all three */
  function Triads({ctx}) {
    const [i, setI] = useState(() => Math.floor(Math.random() * TRIADS.length));
    const [typed, setTyped] = useState('');
    const [got, setGot] = useState(0);
    const [state, setState] = useState('');
    const [words, answer] = TRIADS[i];
    const check = () => {
      if (typed.trim().toLowerCase() === answer) { setState('yes'); setGot(g => g + 1); M.sound.play('done'); if (got + 1 === 3) earn(ctx, 'three triads', 5); }
      else { setState('no'); M.sound.play('tick'); }
    };
    const next = () => { setI(x => (x + 1 + Math.floor(Math.random() * (TRIADS.length - 1))) % TRIADS.length); setTyped(''); setState(''); };
    return html`<div class="stack tight">
      <div class="small">One word goes in front of or behind all three. Mednick's test, 1962: it measures how far your associations reach. Three right earns the sparks.</div>
      <div class="brk-word">${words.map(w => html`<span key=${w} class="brk-tile wide">${w}</span>`)}</div>
      <div class="row nowrap" style=${{gap: '8px'}}>
        <input class="input brk-answer" id="triad-answer" value=${typed} placeholder="The word" autoCapitalize="none" autoComplete="off" aria-label="The word" onInput=${e => { setTyped(e.target.value); setState(''); }} onKeyDown=${e => { if (e.key === 'Enter') (state === 'yes' ? next() : check()); }}/>
        ${state === 'yes' ? html`<${UI.Btn} sm=${true} id="triad-next" onClick=${next}>Next<//>` : html`<${UI.Btn} sm=${true} id="triad-check" disabled=${!typed.trim()} onClick=${check}>Check<//>`}
        <button type="button" class="linky tiny" onClick=${() => { setState('show'); }}>Show me</button>
      </div>
      <div class="tiny ${state === 'no' ? 'flame-t' : 'ink62'}">${state === 'yes' ? 'Yes. ' + answer + '.' : state === 'no' ? 'Not that one.' : state === 'show' ? 'It was ' + answer + '. No sparks for that one, no shame either.' : got + ' of 3 today'}</div>
    </div>`;
  }

  /* a blue minute: blue primes exploratory thinking (Mehta and Zhu, 2009); the eyes go far, then near */
  function BlueMinute({ctx}) {
    const [on, setOn] = useState(false);
    if (!on) return html`<div class="row between"><span class="small">Sixty seconds of blue and a few instructions for the eyes. Blue nudges the brain toward exploring; a far gaze rests the part that has been staring at a screen.</span><${UI.Btn} sm=${true} id="blue-start" kind="sec" onClick=${() => setOn(true)}>Start<//></div>`;
    return html`<div class="brk-sky">
      <${Timer} seconds=${60} label="blue minute" onStop=${() => setOn(false)} onDone=${() => { setOn(false); earn(ctx, 'a blue minute', 5); }}
        prompts=${['Look at the farthest thing you can see. Hold it.', 'Now something at arm\'s length. Then far again.', 'Unfocus. Let the screen blur.', 'Name one thing you can smell and one you can hear.', 'Back to the screen, slowly.']}/>
    </div>`;
  }

  /* doodling for a minute keeps the mind from wandering off entirely (Andrade, 2009) */
  function Doodle({ctx}) {
    const ref = useRef(null);
    const [on, setOn] = useState(false);
    const drawing = useRef(false);
    useEffect(() => {
      if (!on) return;
      const cv = ref.current; if (!cv) return;
      const g = cv.getContext('2d');
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--warm').trim() || '#F7F6F2'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = '#F53901'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      const down = e => { drawing.current = true; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); cv.setPointerCapture(e.pointerId); };
      const move = e => { if (!drawing.current) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); };
      const up = () => { drawing.current = false; };
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      return () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
    }, [on]);
    if (!on) return html`<div class="row between"><span class="small">Draw nothing in particular for a minute. People who doodle through a dull call remember more of it; the hand keeps the mind in the room.</span><${UI.Btn} sm=${true} id="doodle-start" kind="sec" onClick=${() => setOn(true)}>Start<//></div>`;
    return html`<div class="stack tight">
      <canvas ref=${ref} width="600" height="260" class="brk-doodle" id="doodle-canvas" aria-label="Doodle pad"/>
      <${Timer} seconds=${60} label="doodle" onStop=${() => setOn(false)} onDone=${() => { setOn(false); earn(ctx, 'a doodle', 5); }}/>
    </div>`;
  }

  function Walk({ctx}) {
    const [on, setOn] = useState(false);
    if (!on) return html`<div class="row between"><span class="small">Five minutes on your feet. Walking lifts divergent thinking by about sixty percent in the lab (Oppezzo and Schwartz, 2014), and the effect lasts a while after you sit back down.</span><${UI.Btn} sm=${true} id="walk-start" kind="sec" onClick=${() => { setOn(true); M.sound.play('start'); }}>Start<//></div>`;
    return html`<${Timer} seconds=${300} label="walk" onStop=${() => setOn(false)} onDone=${() => { setOn(false); earn(ctx, 'a walk', 5); }} prompts=${['Phone in the pocket. Eyes up.', 'Pick a problem from today and carry it, lightly.', 'Change direction once for no reason.', 'Notice the thing you walk past every day and never look at.', 'Head back. Write down the first idea that showed up.']}/>`;
  }

  function Reset() {
    const ctx = M.useCtx();
    const t = M.play ? M.play.mine(ctx).today : {};
    const did = Object.keys(t).length;
    return html`<div class="stack" style=${{gap: '16px'}} id="break-reset">
      <${UI.Card} id="breathe-card" title="Breathe & reset" action=${html`<span class="tiny ink62">${did ? did + ' today' : 'nothing yet today'}</span>`}>
        <div class="small" style=${{marginBottom: '10px'}}>One tap, one minute of box breathing. Or sit for longer with a bell at the end.</div>
        <${Meditate} ctx=${ctx}/>
      <//>
      <div class="split">
        <${UI.Card} id="uses-card" title="Thirty uses" action=${html`<span class="tiny ink62">Guilford, 1967</span>`}><${Uses} ctx=${ctx}/><//>
        <${UI.Card} id="triads-card" title="Three words" action=${html`<span class="tiny ink62">Mednick, 1962</span>`}><${Triads} ctx=${ctx}/><//>
        <${UI.Card} id="blue-card" title="Blue minute" action=${html`<span class="tiny ink62">Mehta & Zhu, 2009</span>`}><${BlueMinute} ctx=${ctx}/><//>
        <${UI.Card} id="doodle-card" title="Doodle" action=${html`<span class="tiny ink62">Andrade, 2009</span>`}><${Doodle} ctx=${ctx}/><//>
        <${UI.Card} id="walk-card" title="Walk it off" action=${html`<span class="tiny ink62">Oppezzo & Schwartz, 2014</span>`}><${Walk} ctx=${ctx}/><//>
      </div>
      <div class="hint">Each reset earns sparks once a day. The science is real; the sparks are the excuse.</div>
    </div>`;
  }

  M.parts.BreakReset = Reset;
  M.reset = {OBJECTS, TRIADS};
})();
