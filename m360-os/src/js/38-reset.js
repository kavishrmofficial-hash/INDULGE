/* module: reset. Break, the Reset tab: the things with real trials behind them, each with its grade on
   the card. Paced breathing at six breaths a minute for five minutes (meta-analyses of randomised
   trials; the sessions under five minutes were the ones that did nothing). One if-then plan for the
   day (the largest cheap effect in the self-regulation literature). A free walk for energy, or a walk
   with a problem in your pocket for ideas (replicated across labs for idea generation). Park it, the
   incubation protocol with a light filler (a meta-analysis of 117 studies). The two-gear sprint, which
   uses the oldest trick in creativity research: being told to be creative. Eyes off the screen for
   five minutes. A ten minute nap, where there is a quiet spot. Nothing here claims to make anyone
   smarter; it claims to make the next hour better, which is what the trials measured. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const today = () => U.todayStr();
  const privPath = ctx => 'data/users/' + ctx.uid + '/break';
  const earn = (ctx, what, n) => M.play.once(ctx, what, n);
  const BRIEFS = ['twenty five wrong ways to launch a sunscreen', 'a reel that stops the scroll for a bank nobody likes', 'how a dentist gets ten thousand followers without dancing', 'a store opening nobody can ignore', 'a tagline for a watch brand for people who are always late', 'a campaign for a water bottle that is just a water bottle', 'what a hotel posts on a day with nothing to post', 'merch for a client that sells cement'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lines = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean);

  /* a countdown with a ring and a bell; quick mode (tests) makes every timer two seconds */
  function Timer({seconds, label, onDone, onStop, prompts, id, orb}) {
    const total = M.reset.quick ? 2 : seconds;
    const [left, setLeft] = useState(total);
    const t0 = useRef(Date.now());
    const fired = useRef(false);
    useEffect(() => {
      const tick = setInterval(() => {
        const l = Math.max(0, total - Math.round((Date.now() - t0.current) / 1000));
        setLeft(l);
        if (l <= 0 && !fired.current) { fired.current = true; clearInterval(tick); M.sound.play('chime'); onDone(); }
      }, 250);
      return () => clearInterval(tick);
    }, [total]);
    const r = 46, C = 2 * Math.PI * r, p = 1 - left / total;
    const prompt = prompts && prompts.length ? prompts[Math.min(prompts.length - 1, Math.floor((total - left) / (total / prompts.length)))] : '';
    return html`<div class="brk-timer" id=${id || 'brk-timer'}>
      <svg viewBox="0 0 100 100" class="brk-ring" aria-hidden="true"><circle class="bg" cx="50" cy="50" r=${r}/><circle class="fg" cx="50" cy="50" r=${r} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - p)}/></svg>
      <div class="brk-timer-mid"><div class="num brk-left">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div><div class="tiny ink62">${label}</div></div>
      ${orb ? html`<span class="brk-orb"><${M.fx.Orb} state=${orb} size=${32} label=${label}/></span>` : null}
      ${prompt ? html`<div class="small brk-prompt">${prompt}</div>` : null}
      ${onStop ? html`<button type="button" class="linky tiny" onClick=${onStop}>Stop</button>` : null}
    </div>`;
  }
  const Grade = ({g}) => html`<${UI.Pill} kind=${g === 'well supported' ? 'flame' : 'ink'}>${g}<//>`;
  const keep = (ctx, priv, kind, brief, text) => {
    const list = (((priv && priv.data) || {}).catches || []).concat([{at: Date.now(), kind, brief: String(brief || '').slice(0, 140), text: String(text || '').slice(0, 2000)}]).slice(-30);
    return ctx.W.merge(privPath(ctx), {catches: list, updated: Date.now()});
  };

  /* ---------- breathing: three protocols, the full screen orb ---------- */
  function Breathe({ctx}) {
    const [done, setDone] = useState('');
    const P = M.breathe.PROTOCOLS;
    const open = k => M.breathe.open(k, {onDone: () => { setDone(k); earn(ctx, P[k].name.toLowerCase(), k === 'slow' ? 10 : 5); }});
    const t = M.play.mine(ctx).today;
    return html`<${M.fx.Beam}><${UI.Card} id="breathe-card" title="Breathe" action=${html`<${Grade} g="well supported"/>`}>
      <div class="row nowrap fxh-talk" style=${{marginBottom: '10px', alignItems: 'flex-start'}}><${M.fx.Orb} state="breathing" size=${32} label="breathe with the orb"/><div class="small">Sit back, feet flat, hands loose, nose breathing. Five minutes is the dose: the trials that used under five found nothing. Slow breathing has meta-analyses behind it; the other two have one trial each, so they carry their grade.</div></div>
      <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
        <${UI.Btn} id="breathe-slow" onClick=${() => open('slow')}>Slow breathing, 5:00${t['slow breathing'] ? ' ✓' : ''}<//>
        <${UI.Btn} id="breathe-box" kind="sec" onClick=${() => open('box')}>Before a pitch, box 3:00${t['box breathing'] ? ' ✓' : ''}<//>
        <${UI.Btn} id="breathe-sigh" kind="sec" onClick=${() => open('sigh')}>Cyclic sighing, 5:00${t['cyclic sighing'] ? ' ✓' : ''}<//>
      </div>
      <div class="tiny ink62" style=${{marginTop: '8px'}}>${done ? 'Stay seated for thirty seconds before you stand.' : 'Four in, six out, follow the orb. Press b anywhere in m360 for the slow one.'}</div>
    <//><//>`;
  }

  /* ---------- one if-then for the day ---------- */
  function IfThen({ctx, priv}) {
    const plan = ((priv && priv.data) || {}).plan;
    const mine = plan && plan.day === today() ? plan : null;
    const [when, setWhen] = useState(mine ? mine.when : '');
    const [where, setWhere] = useState(mine ? mine.where : '');
    const [will, setWill] = useState(mine ? mine.will : '');
    const [editing, setEditing] = useState(!mine);
    useEffect(() => { if (mine && !editing) { setWhen(mine.when); setWhere(mine.where); setWill(mine.will); } }, [mine && mine.at]);
    const ok = when.trim() && will.trim();
    const save = async () => {
      if (!ok) return;
      await ctx.W.merge(privPath(ctx), {plan: {day: today(), when: when.trim().slice(0, 80), where: where.trim().slice(0, 80), will: will.trim().slice(0, 160), at: Date.now()}, updated: Date.now()}).catch(() => {});
      setEditing(false);
      earn(ctx, 'an if-then', 5);
    };
    return html`<${UI.Card} id="ifthen" title="One if-then" action=${html`<${Grade} g="well supported"/>`}>
      <div class="small" style=${{marginBottom: '10px'}}>The one task you most want to start today, written as a trigger and a first move under five minutes. Ninety four studies, a medium to large effect, and it costs two minutes. The sentence shape matters, so keep it.</div>
      ${!editing && mine ? html`<div class="brk-plan" id="ifthen-plan"><b>If</b> it is ${mine.when}${mine.where ? html` <b>and</b> I am ${mine.where}` : ''}, <b>then</b> I will ${mine.will}.</div>
        <div class="row" style=${{marginTop: '8px'}}><button type="button" class="linky tiny" onClick=${() => setEditing(true)}>Change it</button></div>`
      : html`<div class="stack tight">
        <div class="row nowrap brk-sentence"><span class="small">If it is</span><input class="input" id="ifthen-when" placeholder="11:00, or right after standup" value=${when} onInput=${e => setWhen(e.target.value)} aria-label="When"/></div>
        <div class="row nowrap brk-sentence"><span class="small">and I am</span><input class="input" id="ifthen-where" placeholder="at my desk, coffee in hand" value=${where} onInput=${e => setWhere(e.target.value)} aria-label="Where"/></div>
        <div class="row nowrap brk-sentence"><span class="small">then I will</span><input class="input" id="ifthen-will" placeholder="open the deck and write the first slide title" value=${will} onInput=${e => setWill(e.target.value)} aria-label="What" onKeyDown=${e => { if (e.key === 'Enter') save(); }}/></div>
        <div class="row between"><span class="tiny ink62">Private. Shown back to you here and on Home.</span><${UI.Btn} id="ifthen-save" sm=${true} disabled=${!ok} onClick=${save}>Keep it<//></div>
      </div>`}
    <//>`;
  }

  /* ---------- walk: for energy, or with a problem in your pocket ---------- */
  function Walk({ctx, priv}) {
    const [mode, setMode] = useState('energy');
    const [mins, setMins] = useState(5);
    const [brief, setBrief] = useState('');
    const [step, setStep] = useState('idle');
    const [text, setText] = useState('');
    const energy = (((priv && priv.data) || {}).energy || {})[today()] || [];
    const rate = async n => {
      const all = {...(((priv && priv.data) || {}).energy || {})};
      all[today()] = energy.concat([n]).slice(-6);
      const keys = Object.keys(all).sort(); while (keys.length > 30) delete all[keys.shift()];
      await ctx.W.merge(privPath(ctx), {energy: all, updated: Date.now()}).catch(() => {});
      setStep('idle'); earn(ctx, 'a walk', 5);
    };
    const keepIdeas = async () => { await keep(ctx, priv, 'walk', brief, text).catch(() => {}); setStep('idle'); setText(''); earn(ctx, 'a walk with a problem', 10); };
    const b = brief.trim() || pick(BRIEFS);
    return html`<${UI.Card} id="walk" title="Walk" action=${html`<${Grade} g="well supported"/>`}>
      ${step === 'idle' ? html`<div class="stack tight">
        <${UI.Seg} sm=${true} ariaLabel="Walk mode" value=${mode} onChange=${setMode} options=${[{v: 'energy', label: 'For energy'}, {v: 'dump', label: 'With a problem'}]}/>
        ${mode === 'energy' ? html`<div class="small">Five to ten minutes, any route, your pace, no destination, no reading the phone. Stairs count. Short walks lift energy and mood for under an hour in the trials; a sharper brain needs eleven to twenty minutes.</div>
          <div class="row between" style=${{flexWrap: 'wrap', gap: '8px'}}>
            <${UI.Seg} sm=${true} ariaLabel="Minutes" value=${String(mins)} onChange=${v => setMins(Number(v))} options=${[{v: '5', label: '5 min'}, {v: '10', label: '10 min'}]}/>
            <${UI.Btn} id="walk-start" sm=${true} onClick=${() => { setStep('walk'); M.sound.play('start'); }}>Start<//>
          </div>
          ${energy.length ? html`<div class="tiny ink62 num">Energy after walks today: ${energy.join(', ')} of 5</div>` : null}`
        : html`<div class="small">Read the problem, then walk eight minutes with it, no fixed loop, no screen, ideas out loud if you like. Type everything the moment you sit down. Free walking lifted idea generation in four experiments and the labs that followed; it does nothing for judging or editing, so use it for generating only.</div>
          <input class="input" id="walk-brief" placeholder=${'The problem. Or we pick one: ' + BRIEFS[0]} value=${brief} onInput=${e => setBrief(e.target.value)} aria-label="The problem"/>
          <div class="row between"><span class="tiny ink62">8:00 walking, 3:00 typing</span><${UI.Btn} id="walk-dump-start" sm=${true} onClick=${() => { if (!brief.trim()) setBrief(b); setStep('walk'); M.sound.play('start'); }}>Start<//></div>`}
      </div>`
      : step === 'walk' ? html`<div class="stack tight">
        ${mode === 'dump' ? html`<div class="small brk-plan">${b}</div>` : null}
        <${Timer} id="walk-timer" orb=${mode === 'energy' ? 'breathing' : 'weaving'} seconds=${mode === 'energy' ? mins * 60 : 480} label=${mode === 'energy' ? 'walk' : 'walk with it'} onStop=${() => setStep('idle')} onDone=${() => setStep(mode === 'energy' ? 'rate' : 'type')}
          prompts=${mode === 'energy' ? ['Phone in the pocket. Eyes up.', 'Change direction once for no reason.', 'Notice the thing you pass every day and never look at.', 'Head back when the bell goes.'] : ['Carry it lightly. Say the wrong answers out loud.', 'What would the laziest version be. The most expensive. The illegal one.', 'Who else has this problem and solved it badly.', 'Head back. Keep whatever is in your head.']}/>
      </div>`
      : step === 'rate' ? html`<div class="stack tight" id="walk-rate">
        <div class="small">Energy now, one to five.</div>
        <div class="row" style=${{gap: '6px'}}>${[1, 2, 3, 4, 5].map(n => html`<button type="button" key=${n} class="key wide num" id=${'walk-energy-' + n} onClick=${() => rate(n)}>${n}</button>`)}</div>
      </div>`
      : html`<div class="stack tight">
        <div class="small brk-plan">${b}</div>
        <${Timer} id="walk-type-timer" orb="composing" seconds=${180} label="type everything" onDone=${() => {}}/>
        <textarea class="input" rows="6" id="walk-text" aria-label="Ideas" placeholder="One per line. Wrong ones welcome." value=${text} onInput=${e => setText(e.target.value)}/>
        <div class="row between"><span class="tiny ink62 num">${lines(text).length} so far</span><${UI.Btn} id="walk-keep" sm=${true} disabled=${!text.trim()} onClick=${keepIdeas}>Keep these<//></div>
      </div>`}
    <//>`;
  }

  /* ---------- shades: a light, wordless filler for the incubation gap ---------- */
  function Shades() {
    const make = () => M.play.shuffle(Array.from({length: 12}, (_, i) => 40 + i * 4.5), M.play.rng('shades:' + Date.now()));
    const [tiles, setTiles] = useState(make);
    const [sel, setSel] = useState(-1);
    const sorted = tiles.every((v, i) => !i || v >= tiles[i - 1]);
    const tap = i => {
      if (sorted) return;
      if (sel < 0) { setSel(i); return; }
      const t = tiles.slice(); [t[sel], t[i]] = [t[i], t[sel]]; setTiles(t); setSel(-1); M.sound.play('soft');
    };
    return html`<div class="stack tight" id="shades">
      <div class="tiny ink62">${sorted ? 'Sorted. Shuffle and go again, or just sit.' : 'Tap two tiles to swap them. Light to dark, left to right. No rush.'}</div>
      <div class="shade-grid">${tiles.map((l, i) => html`<button type="button" key=${i} class=${'shade-tile' + (sel === i ? ' sel' : '')} style=${{background: 'hsl(14 96% ' + l + '%)'}} onClick=${() => tap(i)} aria-label=${'tile ' + (i + 1)}/>`)}</div>
      ${sorted ? html`<button type="button" class="linky tiny" onClick=${() => { setTiles(make()); setSel(-1); }}>Shuffle</button>` : null}
    </div>`;
  }

  /* ---------- park it: read the brief, do something light, come back ---------- */
  function ParkIt({ctx, priv}) {
    const [brief, setBrief] = useState('');
    const [step, setStep] = useState('idle');
    const [text, setText] = useState('');
    const b = brief.trim() || pick(BRIEFS);
    const done = async () => { await keep(ctx, priv, 'park', b, text).catch(() => {}); setStep('idle'); setText(''); earn(ctx, 'parking it', 10); };
    return html`<${UI.Card} id="park" title="Park it" action=${html`<${Grade} g="well supported"/>`}>
      ${step === 'idle' ? html`<div class="stack tight">
        <div class="small">Read the brief for a minute without solving it. Then five minutes of something light and wordless. Then back to it, ideas, go. A light filler beat both rest and hard work for incubation across 117 studies. Mind wandering is not the mechanism, so we do not sell it as one.</div>
        <textarea class="input" rows="2" id="park-brief" aria-label="The brief" placeholder=${'The brief, in a few lines. Or we pick one: ' + BRIEFS[1]} value=${brief} onInput=${e => setBrief(e.target.value)}/>
        <div class="row between"><span class="tiny ink62">1:00 read, 5:00 filler, 3:00 back</span><${UI.Btn} id="park-start" sm=${true} onClick=${() => { if (!brief.trim()) setBrief(b); setStep('read'); M.sound.play('start'); }}>Start<//></div>
      </div>`
      : step === 'read' ? html`<div class="stack tight">
        <div class="small brk-plan">${b}</div>
        <${Timer} id="park-read" orb="solving" seconds=${60} label="read, do not solve" onStop=${() => setStep('idle')} onDone=${() => setStep('filler')} prompts=${['What is the real question under it.', 'Who is it for, really.', 'Leave it here. Something light now.']}/>
      </div>`
      : step === 'filler' ? html`<div class="stack tight">
        <${Timer} id="park-filler" orb="shaping" seconds=${300} label="something light" onStop=${() => setStep('idle')} onDone=${() => setStep('back')}/>
        <${Shades}/>
      </div>`
      : html`<div class="stack tight">
        <div class="small brk-plan">${b}</div>
        <${Timer} id="park-back" orb="composing" seconds=${180} label="back to it, ideas, go" onDone=${() => {}}/>
        <textarea class="input" rows="6" id="park-text" aria-label="Ideas" placeholder="One per line." value=${text} onInput=${e => setText(e.target.value)}/>
        <div class="row between"><span class="tiny ink62 num">${lines(text).length} so far</span><${UI.Btn} id="park-keep" sm=${true} disabled=${!text.trim()} onClick=${done}>Keep these<//></div>
      </div>`}
    <//>`;
  }

  /* ---------- the two-gear sprint: quantity, then be creative ---------- */
  function TwoGear({ctx, priv}) {
    const [brief, setBrief] = useState('');
    const [step, setStep] = useState('idle');
    const [one, setOne] = useState('');
    const [two, setTwo] = useState('');
    const b = brief.trim() || pick(BRIEFS);
    const done = async () => { await keep(ctx, priv, 'sprint', b, 'Gear one:\n' + one + '\n\nGear two:\n' + two).catch(() => {}); setStep('idle'); setOne(''); setTwo(''); earn(ctx, 'a two gear sprint', 10); };
    return html`<${UI.Card} id="sprint" title="Two-gear sprint" action=${html`<${Grade} g="well supported"/>`}>
      ${step === 'idle' ? html`<div class="stack tight">
        <div class="small">Three minutes of as many angles as you can, no judging. Then three minutes of only the unusual, clever, uncommon ones, quality over quantity. Being told to be creative is the oldest effect in the field and one of the largest; the first gear clears the obvious out of the way.</div>
        <input class="input" id="sprint-brief" placeholder=${'The brief. Or we pick one: ' + BRIEFS[2]} value=${brief} onInput=${e => setBrief(e.target.value)} aria-label="The brief"/>
        <div class="row between"><span class="tiny ink62">3:00 and 3:00</span><${UI.Btn} id="sprint-start" sm=${true} onClick=${() => { if (!brief.trim()) setBrief(b); setStep('one'); M.sound.play('start'); }}>Start<//></div>
      </div>`
      : step === 'one' ? html`<div class="stack tight">
        <div class="small brk-plan"><b>Gear one.</b> ${b}. As many angles as you can. Quantity only. Do not judge.</div>
        <${Timer} id="sprint-one" orb="weaving" seconds=${180} label="gear one, quantity" onStop=${() => setStep('idle')} onDone=${() => { setStep('two'); M.sound.play('start'); }}/>
        <textarea class="input" rows="6" id="sprint-one-text" aria-label="Gear one ideas" placeholder="One per line. Obvious is fine here." value=${one} onInput=${e => setOne(e.target.value)}/>
        <div class="tiny ink62 num">${lines(one).length} so far</div>
      </div>`
      : html`<div class="stack tight">
        <div class="small brk-plan"><b>Gear two.</b> ${b}. Now only unusual, clever, uncommon, surprising ones. Fewer is fine. Think the way an eccentric poet would.</div>
        <${Timer} id="sprint-two" orb="composing" seconds=${180} label="gear two, be creative" onDone=${() => {}}/>
        <textarea class="input" rows="6" id="sprint-two-text" aria-label="Gear two ideas" placeholder="One per line. Weird is the brief." value=${two} onInput=${e => setTwo(e.target.value)}/>
        <div class="row between"><span class="tiny ink62 num">${lines(one).length} in gear one, ${lines(two).length} in gear two</span><${UI.Btn} id="sprint-keep" sm=${true} disabled=${!two.trim()} onClick=${done}>Keep these<//></div>
      </div>`}
    <//>`;
  }

  /* ---------- eyes off, and the nap ---------- */
  function EyesOff({ctx}) {
    const [on, setOn] = useState(false);
    return html`<${UI.Card} id="eyes" title="Eyes off" action=${html`<${Grade} g="well supported"/>`}>
      ${on ? html`<div class="brk-dim"><${Timer} id="eyes-timer" orb="breathing" seconds=${300} label="eyes off the screen" onStop=${() => setOn(false)} onDone=${() => { setOn(false); earn(ctx, 'eyes off', 5); }}
          prompts=${['Look at the farthest thing you can see.', 'Window if there is one. Outside if you can.', 'No phone. That is the whole exercise.', 'Let the eyes wander. Notice what catches them.', 'Back when the bell goes.']}/></div>`
      : html`<div class="row between" style=${{gap: '10px'}}><span class="small">Five minutes of passive rest, no screen, no task. Rest restores vigilance better than switching to another task, and short breaks lift energy with a medium effect across 22 studies. It does not raise output. It makes the next hour less of a slog.</span><${UI.Btn} id="eyes-start" sm=${true} kind="sec" onClick=${() => { setOn(true); M.sound.play('start'); }}>Start<//></div>`}
    <//>`;
  }
  function Nap({ctx}) {
    const [on, setOn] = useState(false);
    const wake = () => { setOn(false); M.sound.play('chime'); setTimeout(() => M.sound.play('chime'), 700); setTimeout(() => M.sound.play('chime'), 1400); earn(ctx, 'a nap', 5); };
    return html`<${UI.Card} id="nap" title="Ten minute nap" action=${html`<${Grade} g="one lab, several trials"/>`}>
      ${on ? html`<div class="brk-dim"><${Timer} id="nap-timer" orb="breathing" seconds=${600} label="sleep opportunity" onStop=${() => setOn(false)} onDone=${wake}/></div>`
      : html`<div class="row between" style=${{gap: '10px'}}><span class="small">Only with a quiet, dim spot. Lie back, eyes closed, ten minutes, hard wake up. Ten helped for over two hours in the trials; twenty to thirty left people groggy for half an hour or more. The bell is loud.</span><${UI.Btn} id="nap-start" sm=${true} kind="sec" onClick=${() => { setOn(true); M.sound.play('start'); }}>Start<//></div>`}
    <//>`;
  }

  /* ---------- what you kept: the last few catches ---------- */
  function Catches({priv}) {
    const list = (((priv && priv.data) || {}).catches || []).slice(-5).reverse();
    if (!list.length) return null;
    const KIND = {walk: 'walk', park: 'parked', sprint: 'sprint'};
    return html`<${UI.Card} id="catches" title="Kept from your resets" action=${html`<span class="tiny ink62">private, last five</span>`}>
      <div class="stack tight">
        ${list.map(c => html`<div key=${c.at} class="brk-row">
          <div class="tiny ink62 num">${KIND[c.kind] || c.kind} · ${U.timeAgo(c.at)}${c.brief ? ' · ' + c.brief : ''}</div>
          <div class="small" style=${{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>${lines(c.text).slice(0, 6).join('\n')}${lines(c.text).length > 6 ? '\n…' : ''}</div>
        </div>`)}
      </div>
    <//>`;
  }

  function Reset() {
    const ctx = M.useCtx();
    const priv = M.useDoc(ctx.db, ctx.uid ? privPath(ctx) : '');
    const did = Object.keys(M.play.mine(ctx).today).length;
    return html`<div class="stack" style=${{gap: '16px'}} id="break-reset">
      <div class="row between"><span class="row nowrap fxh-talk"><${M.fx.Bot} feature="care" size=${30} label="m360 care"/><span class="small ink62">Each reset earns sparks once a day. The grade on the card is the honest one.</span></span><span class="tiny ink62 num">${did ? did + ' today' : 'nothing yet today'}</span></div>
      <${Breathe} ctx=${ctx}/>
      <div class="split"><${IfThen} ctx=${ctx} priv=${priv}/><${Walk} ctx=${ctx} priv=${priv}/></div>
      <div class="split"><${ParkIt} ctx=${ctx} priv=${priv}/><${TwoGear} ctx=${ctx} priv=${priv}/></div>
      <div class="split"><${EyesOff} ctx=${ctx}/><${Nap} ctx=${ctx}/></div>
      <${Catches} priv=${priv}/>
    </div>`;
  }

  /* the day's if-then, shown back on Home until the day is over */
  function PlanToday() {
    const ctx = M.useCtx();
    const priv = M.useDoc(ctx.db, ctx.uid ? privPath(ctx) : '');
    const plan = priv.data && priv.data.plan;
    if (!plan || plan.day !== today()) return null;
    return html`<div class="brk-plan" id="plan-today"><span class="tiny ink62">your if-then · </span><b>If</b> it is ${plan.when}${plan.where ? html` <b>and</b> I am ${plan.where}` : ''}, <b>then</b> I will ${plan.will}. <button type="button" class="linky tiny" onClick=${() => M.nav('#reset')}>Change</button></div>`;
  }
  M.parts.PlanToday = PlanToday;
  M.parts.BreakReset = Reset;
  M.reset = {BRIEFS, earn, privPath, quick: false, Timer};
})();
