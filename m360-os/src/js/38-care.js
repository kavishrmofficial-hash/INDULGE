/* module: care. Break, the Care tab: the small reminders that hold a day together (breakfast, lunch,
   water, supplements, dinner, anything else), set by the person, kept in their private space. A watcher
   rings each one when it is due: a notice in m360, the browser's notification when the tab is away,
   a sound. Snooze pushes it fifteen minutes; Done ticks it. A day with every reminder done earns sparks. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const path = ctx => 'data/users/' + ctx.uid + '/care';
  const USUAL = [['Breakfast', '09:00'], ['Supplements', '09:30'], ['Water', '11:30'], ['Lunch', '13:30'], ['Water', '16:00'], ['Dinner', '20:30']];
  const SNOOZE_MS = 15 * 60000;
  const okTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
  const dueAt = (ymd, time) => { const [h, m] = time.split(':').map(Number); const d = U.parseYmd(ymd); d.setHours(h, m, 0, 0); return d.getTime(); };
  const items = doc => (doc && Array.isArray(doc.items) ? doc.items : []).filter(x => x && x.id && okTime(x.time));
  const todayLog = (doc, ymd) => ((doc && doc.log) || {})[ymd] || {};
  /* the state of one reminder right now */
  function stateOf(it, log, now, ymd) {
    const l = log[it.id] || {};
    if (l.done) return 'done';
    const due = Math.max(dueAt(ymd, it.time), Number(l.snooze) || 0);
    return now >= due ? 'due' : (l.snooze ? 'snoozed' : 'later');
  }
  async function mark(ctx, doc, id, patch) {
    const ymd = U.todayStr();
    const log = {...((doc && doc.log) || {})};
    log[ymd] = {...(log[ymd] || {}), [id]: {...((log[ymd] || {})[id] || {}), ...patch}};
    const keys = Object.keys(log).sort();
    while (keys.length > 60) delete log[keys.shift()];
    await ctx.W.merge(path(ctx), {log, updated: Date.now()});
    /* every reminder done: the day is cared for */
    const on = items(doc).filter(x => x.on !== false);
    if (patch.done && on.length && on.every(x => x.id === id || (log[ymd][x.id] || {}).done) && M.play) {
      if (!M.play.mine(ctx).today['the care list']) await M.play.award(ctx, 5, 'the care list');
    }
  }
  async function save(ctx, doc, list) {
    await ctx.W.merge(path(ctx), {items: list.map(x => ({id: x.id, label: String(x.label || '').trim().slice(0, 40), time: x.time, on: x.on !== false})), updated: Date.now()});
  }

  /* rings what is due, once per due moment, while m360 is open anywhere */
  const rung = new Set();
  function CareWatch() {
    const ctx = M.useCtx();
    const doc = M.useDoc(ctx.db, ctx.uid ? path(ctx) : '');
    useEffect(() => {
      if (!doc.ready || !doc.data || ctx.viewAs) return;
      const check = () => {
        const now = Date.now(), ymd = U.todayStr();
        const log = todayLog(doc.data, ymd);
        for (const it of items(doc.data)) {
          if (it.on === false || stateOf(it, log, now, ymd) !== 'due') continue;
          const key = 'care:' + it.id + ':' + ymd + ':' + (Number((log[it.id] || {}).snooze) || 0);
          if (rung.has(key)) continue;
          rung.add(key);
          if (M.notices) M.notices.push({key, title: it.label, body: 'Time for ' + it.label.toLowerCase() + '. Tap to tick it off or snooze.', href: '#care', icon: 'bell', life: 60000});
          M.sound.play('chime');
        }
      };
      check();
      const id = setInterval(check, 30000);
      return () => clearInterval(id);
    }, [doc.ready, doc.data, ctx.uid, ctx.viewAs]);
    return null;
  }

  function Care() {
    const ctx = M.useCtx();
    const doc = M.useDoc(ctx.db, path(ctx));
    const [label, setLabel] = useState('');
    const [time, setTime] = useState('');
    const [tick, setTick] = useState(0);
    useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(id); }, []);
    const list = items(doc.data);
    const ymd = U.todayStr(), now = Date.now();
    const log = todayLog(doc.data, ymd);
    const rows = list.map(it => ({it, st: stateOf(it, log, now, ymd), l: log[it.id] || {}})).sort((a, b) => a.it.time.localeCompare(b.it.time));
    const done = rows.filter(r => r.it.on !== false && r.st === 'done').length, on = rows.filter(r => r.it.on !== false).length;
    const add = () => {
      if (!label.trim() || !okTime(time)) { M.toast('A name and a time, like 13:30', true); return; }
      save(ctx, doc.data, list.concat([{id: U.uid(), label: label.trim(), time, on: true}])).then(() => { setLabel(''); setTime(''); M.sound.play('soft'); });
    };
    const usual = () => save(ctx, doc.data, list.concat(USUAL.filter(([l, t]) => !list.some(x => x.label === l && x.time === t)).map(([l, t]) => ({id: U.uid(), label: l, time: t, on: true}))));
    const notif = M.notices ? M.notices.state() : 'none';
    /* the effects: the care bot heads the day (working while something is due, asleep once all is
       done), a beam round the first reminder that is due, bells for the reminders themselves */
    const fx = M.fx || null;
    const live = rows.filter(r => r.it.on !== false);
    const firstDue = (live.find(r => r.st === 'due') || {it: {}}).it.id;
    const botState = live.some(r => r.st === 'due') ? 'working' : on && done === on ? 'sleeping' : 'default';
    const title = fx ? html`<span class="row nowrap fx-title-bot"><${fx.Bot} feature="care" state=${botState} size=${28} label="m360 care"/>Today</span>` : 'Today';
    const row = r => html`<div key=${r.it.id} class=${'row between care-row ' + r.st} data-state=${r.st}>
            <span class="row nowrap"><span class=${'care-dot ' + r.st}/><span class=${r.st === 'done' ? 'ink62' : ''} style=${r.st === 'done' ? {textDecoration: 'line-through'} : null}>${r.it.label}</span><span class="tiny num ink62">${r.it.time}${r.st === 'snoozed' ? ', until ' + U.hhmm(r.l.snooze) : ''}</span></span>
            ${r.st === 'done' ? html`<button type="button" class="linky tiny" onClick=${() => mark(ctx, doc.data, r.it.id, {done: null})}>Undo</button>`
              : html`<span class="row nowrap" style=${{gap: '6px'}}>
                ${r.st === 'due' || r.st === 'snoozed' ? html`<button type="button" class="linky tiny" id=${'care-snooze-' + r.it.id} onClick=${() => mark(ctx, doc.data, r.it.id, {snooze: Date.now() + SNOOZE_MS})}>Snooze 15</button>` : null}
                <${UI.Btn} sm=${true} kind=${r.st === 'due' ? undefined : 'sec'} id=${'care-done-' + r.it.id} onClick=${() => mark(ctx, doc.data, r.it.id, {done: Date.now(), snooze: null})}>Done<//>
              </span>`}
          </div>`;
    return html`<div class="stack" style=${{gap: '16px'}} id="break-care">
      <${UI.Card} id="care-today" title=${title} action=${html`<span class="tiny ink62 num" data-tick=${tick}>${on ? done + ' of ' + on + ' done' : ''}</span>`}>
        ${!list.length ? html`<div class="stack tight">
          <div class="small">Nothing set yet. The usual five take one tap, then change the times to yours.</div>
          <div><${UI.Btn} sm=${true} id="care-usual" onClick=${usual}>Add the usual<//></div>
        </div>` : html`<div class="stack tight">
          ${live.map(r => fx && r.it.id === firstDue ? html`<${fx.Beam} key=${r.it.id} radius=${14}><div class="fx-care-due">${row(r)}</div><//>` : row(r))}
        </div>`}
        ${notif === 'default' ? html`<div class="row between" style=${{marginTop: '10px'}}><span class="tiny ink62">Let the browser ring these when m360 is in another tab.</span>${fx ? html`<${fx.Bell} id="care-allow" size="sm" badge=${false} offLabel="Allow" onLabel="Allowed" pressed=${false} onChange=${() => M.notices.ask()}/>` : html`<button type="button" class="linky tiny" onClick=${() => M.notices.ask()}>Allow</button>`}</div>` : null}
      <//>
      <${UI.Card} id="care-setup" title="The reminders">
        <div class="stack tight">
          ${list.map(it => html`<div key=${it.id} class="row between">
            <span class="row nowrap"><input class="input" style=${{width: '150px', minHeight: '34px'}} value=${it.label} aria-label="Reminder name" onChange=${e => save(ctx, doc.data, list.map(x => x.id === it.id ? {...x, label: e.target.value} : x))}/>
              <input class="input num" type="time" style=${{width: '110px', minHeight: '34px'}} value=${it.time} aria-label="Reminder time" onChange=${e => { if (okTime(e.target.value)) save(ctx, doc.data, list.map(x => x.id === it.id ? {...x, time: e.target.value} : x)); }}/></span>
            <span class="row nowrap" style=${{gap: '8px'}}>
              ${fx ? html`<${fx.Bell} size="sm" badge=${false} label=${it.label + ' on or off'} offLabel="Silent" onLabel="Rings" pressed=${it.on !== false} onChange=${v => save(ctx, doc.data, list.map(x => x.id === it.id ? {...x, on: !!v} : x))}/>`
                : html`<${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${it.on === false ? 'off' : 'on'} ariaLabel=${it.label + ' on or off'} onChange=${v => save(ctx, doc.data, list.map(x => x.id === it.id ? {...x, on: v === 'on'} : x))}/>`}
              <button type="button" class="iconbtn" aria-label=${'Remove ' + it.label} onClick=${() => save(ctx, doc.data, list.filter(x => x.id !== it.id))}><${icons.x}/></button>
            </span>
          </div>`)}
          <div class="row nowrap" style=${{gap: '8px'}}>
            <input class="input" id="care-label" placeholder="Water, a stretch, the 4pm walk" value=${label} aria-label="New reminder" onInput=${e => setLabel(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }}/>
            <input class="input num" id="care-time" type="time" style=${{width: '120px'}} value=${time} aria-label="New reminder time" onInput=${e => setTime(e.target.value)}/>
            <${UI.Btn} sm=${true} id="care-add" onClick=${add}>Add<//>
          </div>
          ${list.length && USUAL.some(([l, t]) => !list.some(x => x.label === l && x.time === t)) ? html`<button type="button" class="linky tiny" style=${{alignSelf: 'flex-start'}} onClick=${usual}>Add the usual five</button>` : null}
        </div>
      <//>
      <div class="hint">Yours alone: nobody else sees the list. A day with every reminder done earns five sparks.</div>
    </div>`;
  }

  M.parts.BreakCare = Care;
  M.parts.CareWatch = CareWatch;
  M.care = {path, items, stateOf, USUAL, SNOOZE_MS};
})();
