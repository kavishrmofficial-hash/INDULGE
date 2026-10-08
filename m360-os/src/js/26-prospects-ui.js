/* module: prospects-ui. The Prospects tab under Accounts (who am I speaking to, who do I have a meeting with,
   what pitch has gone where, when do I follow up), the person page, the one-line capture, the Home fold
   "Follow-ups today", and the folds other pages carry: the pitch drawer's shared Sent list and private notes,
   the Base contact drawer's conversations. People, conversations, notes and follow-ups are private to each
   member (data/users/<uid>/prospects, read through M.prospects in 25-prospects.js); the pitch, its stage, its
   owner and where it was sent stay on the shared pipeline. Dates read through M.when (08-when.js), IST. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;
  const P = () => M.prospects;
  const DAY = 86400000;
  const EMPTY = {people: {}, fu: {}, meet: {}, prefs: {}};
  const PRIVATE = 'Prospects are private to each person.';
  const NO_DATE = 'I could not read a date there. Try: after the 16th, next Tuesday, in two weeks.';
  const NO_READ = 'I could not read that. Try: Spoke to Meera at Swisse, talk after the 16th.';
  const EMPTY_LINE = 'Nobody here yet. Type who you spoke to, for example: Spoke to Meera at Swisse, talk after the 16th.';
  const KIND = {call: 'Call', meet: 'Met', mail: 'Mail', wa: 'WhatsApp', li: 'LinkedIn', msg: 'Message', talk: 'Spoke', sent: 'Sent', reply: 'They replied', note: 'Note', done: 'Done', snooze: 'Snoozed'};
  const VIA = {mail: 'mail', whatsapp: 'WhatsApp', meeting: 'in a meeting', linkedin: 'LinkedIn', hand: 'by hand'};
  const VIA_OPTS = [{v: 'mail', label: 'Mail'}, {v: 'whatsapp', label: 'WhatsApp'}, {v: 'meeting', label: 'In a meeting'}, {v: 'linkedin', label: 'LinkedIn'}, {v: 'hand', label: 'By hand'}];
  const NEXT_OPTS = [{k: 'tomorrow', label: 'Tomorrow'}, {k: 'week', label: 'Next week'}, {k: 'pick', label: 'Pick a day'}, {k: 'none', label: 'No more'}];
  const SNOOZE_OPTS = [{k: 'hour', label: 'In an hour'}, {k: 'tmrw10', label: 'Tomorrow 10:00'}, {k: 'nextmon', label: 'Next Monday'}, {k: 'pick', label: 'Pick a day'}];
  const LOOSE_OPTS = [{k: 'tomorrow', label: 'Tomorrow'}, {k: 'week', label: 'Next week'}, {k: 'pick', label: 'Pick'}];
  const TRACK_OPTS = [{k: 'tomorrow', label: 'Tomorrow'}, {k: 'week', label: 'Next week'}, {k: 'pick', label: 'Pick a day'}, {k: 'none', label: 'Not yet'}];

  /* ---------- reading the private index ---------- */
  /* ctx.priv.prospects (02-state.js); on a build where that has not landed, the store's own hook */
  function useIndex() {
    const ctx = M.useCtx();
    const own = P() && P().useIndex ? P().useIndex(ctx) : null;
    return (ctx.priv && ctx.priv.prospects) || own || {ready: false, data: null};
  }
  const has = () => !!(P() && M.when && P().day);
  const dataOf = ctx => (has() && P().data ? P().data(ctx) : null) || EMPTY;
  const ist = () => M.when.ist;
  const today = () => M.when ? ist().ymd(Date.now()) : U.todayStr();
  const label = (d, t) => d ? (M.when ? M.when.label(d, t) : U.fmtDay(d) + (t ? ' at ' + t : '')) : '';
  const dayLabel = d => label(d, '');
  const timeOf = fu => fu.t || '10:00';
  const safe = fn => { try { return fn(); } catch (e) { return null; } };
  const isCid = v => /^c_/.test(String(v || ''));
  const initials = s => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const firstOf = s => String(s || '').split(/\s+/)[0] || '';
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  const ymOf = d => String(d || '').slice(0, 7);
  const monthName = ym => { const [y, m] = String(ym).split('-').map(Number); return U.cap(U.MONTHS[m - 1] || '') + ' ' + y; };
  /* a row from day() in any of its shapes: an id, or an object with fid, mid or pid */
  const asRow = (d, x) => {
    if (typeof x === 'string') return d.fu[x] ? {fid: x, fu: d.fu[x], pid: d.fu[x].p} : d.meet[x] ? {mid: x, meet: d.meet[x], pid: d.meet[x].p} : {pid: x};
    const fid = x.fid || (x.fu ? x.id : null), mid = x.mid || (x.meet ? x.id : null);
    const fu = x.fu || (fid && d.fu[fid]) || null, meet = x.meet || (mid && d.meet[mid]) || null;
    return {fid, fu, mid, meet, pid: x.pid || x.p || (fu && fu.p) || (meet && meet.p) || ''};
  };
  const openFus = (d, pid) => Object.keys(d.fu).map(k => ({fid: k, ...d.fu[k]})).filter(f => f.p === pid && !f.done).sort((a, b) => (a.d + timeOf(a)).localeCompare(b.d + timeOf(b)));
  const openMeets = (d, pid) => Object.keys(d.meet).map(k => ({mid: k, ...d.meet[k]})).filter(m => m.p === pid && !m.done).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const lateDays = (ymd, now) => M.when && M.when.lateDays ? M.when.lateDays(ymd, now) : U.daysBetween(ymd, today());
  const lateText = fu => { const k = lateDays(fu.d, Date.now()); return n(k, 'day late', 'days late') + ', since ' + dayLabel(fu.d); };

  /* live names from the Base, in one query; phone and email stay there and never enter the index */
  function useNames(cids) {
    const key = (cids || []).filter(isCid).sort().join(',');
    const ids = useMemo(() => key ? Array.from(new Set(key.split(','))) : [], [key]);
    const q = M.base && M.base.useQuery ? M.base.useQuery('contacts', {ids, limit: ids.length || 1}, ids.length > 0) : {rows: [], loading: false};
    return useMemo(() => { const rows = {}; (q.rows || []).forEach(r => { rows[r.id] = r; }); return {rows, loading: !!q.loading, done: ids.length > 0 && !q.loading}; }, [q.rows, q.loading, ids.length]);
  }
  const nameOf = r => r ? String(r.name || [r.first, r.last].filter(Boolean).join(' ') || '') : '';
  /* the cached who, role and org, or the live Base row when the person is linked and the Base has answered */
  const liveOf = (p, names) => {
    const r = p && p.cid && names && names.rows ? names.rows[p.cid] : null;
    return {who: (r && nameOf(r)) || (p && p.who) || 'Someone', role: (r && r.title) || (p && p.role) || '', org: (r && r.orgName) || (p && p.org) || '', row: r,
      gone: !!(p && p.cid && names && names.done && !r)};
  };
  const roleAt = l => [l.role, l.org].filter(Boolean).join(' at ');

  /* quick dates for the chips: the next day skips Sunday, next week is Monday */
  const nextDow = (from, dow) => { let d = ist().add(from, 1); let i = 0; while (ist().dow(d) !== dow && i++ < 8) d = ist().add(d, 1); return d; };
  const skipSunday = d => ist().dow(d) === 0 ? ist().add(d, 1) : d;
  function whenOf(o) {
    const td = today();
    if (o.k === 'pick') return o.d ? {d: o.d, t: o.t || ''} : null;
    if (o.k === 'tomorrow') return {d: skipSunday(ist().add(td, 1)), t: ''};
    if (o.k === 'tmrw10') return {d: skipSunday(ist().add(td, 1)), t: '10:00'};
    if (o.k === 'week' || o.k === 'nextmon') return {d: nextDow(td, 1), t: ''};
    if (o.k === 'hour') { const ms = Date.now() + 3600000; return {d: ist().ymd(ms), t: ist().hm(ms)}; }
    return null;
  }
  const statusPill = st => st === 'late' ? html`<${UI.Pill} kind="flame">late<//>` : st === 'meeting' ? html`<${UI.Pill} kind="ink">meeting set<//>`
    : st === 'waiting' ? html`<${UI.Pill} kind="warm">waiting on them<//>` : st === 'talking' ? html`<${UI.Pill} kind="warm">talking<//>`
    : st === 'done' ? html`<${UI.Pill}>closed<//>` : html`<${UI.Pill}>quiet<//>`;

  /* ---------- small parts ---------- */
  /* the chips that pick a day: the named ones, and Pick a day with a date and a time */
  function QuickWhen({options, onPick, label: lbl, id}) {
    const [pick, setPick] = useState(false);
    const [d, setD] = useState('');
    const [t, setT] = useState('');
    return html`<span class="pros-when row" role="group" aria-label=${lbl || 'When'} id=${id}>
      ${options.map(o => html`<button key=${o.k} type="button" class="chip" data-when=${o.k} onClick=${() => o.k === 'pick' ? setPick(x => !x) : onPick(o)}>${o.label}</button>`)}
      ${pick ? html`<span class="row nowrap pros-pick">
        <input type="date" class="input num" aria-label="Day" value=${d} min=${today()} onInput=${e => setD(e.target.value)}/>
        <input type="time" class="input num" aria-label="Time" value=${t} onInput=${e => setT(e.target.value)}/>
        <${UI.Btn} sm disabled=${!d} onClick=${() => { onPick({k: 'pick', d, t}); setPick(false); }}>Set<//>
      </span>` : null}
    </span>`;
  }

  function DateChip({fu, meet}) {
    const td = today();
    if (meet) {
      const late = meet.d < td;
      return html`<span class=${'pros-chip num' + (late ? ' late' : '')}>${meet.d === td ? 'Today' + (meet.t ? ' ' + meet.t : '') : dayLabel(meet.d) + (meet.t ? ' ' + meet.t : '')}</span>`;
    }
    if (!fu) return null;
    const late = fu.d < td;
    const k = late ? lateDays(fu.d, Date.now()) : 0;
    return html`<span class=${'pros-chip num' + (late ? ' late' : '')}>${late ? n(k, 'day late', 'days late') : fu.d === td ? 'Today ' + timeOf(fu) : dayLabel(fu.d)}</span>`;
  }

  /* one person: initials, who, role at org, the last touch and the next text, the date on the right,
     up to two pitch chips below. The whole row opens the person; the chips open their pitch. */
  function PersonRow({pid, p, live, fu, meet, sub, onOpen, chips}) {
    const ctx = M.useCtx();
    const pm = ctx.coll.pitches.map;
    const pis = (p.pi || []).filter(id => pm[id]).slice(0, 2);
    const stages = (M.pitches && M.pitches.STAGES) || [];
    const stageOf = id => { const s = stages.find(x => x.v === (pm[id].stage || 'lead')); return s ? s.label : (pm[id].stage || ''); };
    const line = sub != null ? sub : [p.last && p.last.at ? (KIND[p.last.k] || 'Touch') + ' ' + U.timeAgo(p.last.at) : '', fu && fu.x ? fu.x : meet ? 'Meeting' + (meet.where ? ', ' + meet.where : '') : ''].filter(Boolean).join(' · ');
    return html`<div class="pros-row" data-pid=${pid} data-status=${fu && fu.d < today() ? 'late' : ''}>
      <button type="button" class="pros-open rowbtn" onClick=${() => onOpen(pid)} aria-label=${'Open ' + live.who}>
        <span class="pros-av" aria-hidden="true">${initials(live.who)}</span>
        <span class="pros-main">
          <span class="pros-who">${live.who}</span>
          ${roleAt(live) ? html`<span class="pros-role small ink62">${roleAt(live)}</span>` : null}
          ${line ? html`<span class=${'pros-sub small' + (fu && fu.d < today() ? ' flame-t' : '')}>${line}</span>` : null}
        </span>
        <${DateChip} fu=${fu} meet=${meet}/>
      </button>
      ${pis.length || chips ? html`<div class="pros-tail row">
        ${pis.map(id => html`<button key=${id} type="button" class="chip pros-pitch" onClick=${() => M.nav('#pitches/' + id)}>${pm[id].brand || 'Pitch'}<span class="tiny ink62">${stageOf(id)}</span></button>`)}
        ${chips || null}
      </div>` : null}
    </div>`;
  }

  const Group = ({id, title, count, children, hot}) => !count ? null : html`<section class=${'pros-group' + (hot ? ' hot' : '')} id=${id}>
    <div class="pros-gh row nowrap"><span class="micro plain">${title}</span><span class="tiny num ink62">${count}</span></div>
    ${children}
  </section>`;

  /* ---------- the capture line ---------- */
  /* one typed or spoken line. It reads back under the field as he types, with no model call, then Save
     logs it through M.agent.capture (the ledger and Undo) or, on a build without the agent's part,
     through M.prospects.read and apply. The receipt names what it chose, with chips to fix it. */
  function readBack(r) {
    if (!r) return '';
    const parts = [];
    const who = [r.who, r.org].filter(Boolean).join(', ');
    if (who) parts.push(who + '.');
    if (r.kind === 'sent') parts.push((r.also && KIND[r.also] ? KIND[r.also] + ', ' : '') + 'sent the ' + String((r.sent && r.sent.what) || 'deck').toLowerCase() + (r.sent && r.sent.to && !r.who ? ' to ' + r.sent.to : '') + '.');
    else if (r.kind === 'meet-plan' && r.meet && r.meet.d) parts.push('Meeting ' + label(r.meet.d, r.meet.t) + '.');
    else if (r.kind === 'reply') parts.push((r.reply === 'no' ? 'Said no' : r.reply === 'later' ? 'Said later' : 'Replied') + '.');
    else if (r.kind && KIND[r.kind]) parts.push((r.kind === 'call' ? 'A call' : KIND[r.kind]) + ' today.');
    if (r.when && r.when.ymd) parts.push('Follow up ' + (M.when.readBack ? M.when.readBack(r.when) : label(r.when.ymd, r.when.t)) + '.');
    else if (r.when && r.when.festival) parts.push('Which day is ' + U.cap(r.when.festival) + ' this year?');
    else if (r.needDate) parts.push('When should I remind you' + (r.who ? ' about ' + firstOf(r.who) : '') + '?');
    return parts.join(' ');
  }
  function CaptureLine({preset, id, placeholder, compact, autoFocus}) {
    const ctx = M.useCtx();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [out, setOut] = useState(null);
    const ok = has() && P().read;
    const reading = useMemo(() => ok && text.trim() ? safe(() => P().read(text, ctx)) : null, [text, ok]);
    const back = reading ? readBack(reading) : '';
    const can = !!(reading && P().isCapture && P().isCapture(reading));
    const run = async line => {
      const t = String(line == null ? text : line).trim();
      if (!t || busy || !ok) return;
      if (ctx.viewAs) { M.toast(PRIVATE, true); return; }
      setBusy(true);
      try {
        let r;
        if (M.agent && M.agent.capture) r = await M.agent.capture(ctx, t, preset || {});
        else {
          const rd = P().read(t, ctx);
          if (!rd || !P().isCapture(rd)) { setOut({err: NO_READ}); setBusy(false); return; }
          if (rd.when && rd.when.festival) { setOut({err: 'Which day is ' + U.cap(rd.when.festival) + ' this year? Type the date, for example: after 20 Oct.'}); setBusy(false); return; }
          /* a follow-up word with a person and no date: ask when, and log it on the tap */
          if (rd.needDate && !(rd.when && rd.when.ymd)) {
            const withDate = o => { const w = whenOf(o); return w ? P().apply(ctx, {...rd, kind: rd.kind || 'note', needDate: false, when: {ymd: w.d, t: w.t || '', said: o.label.toLowerCase()}}, preset || {}, {}) : null; };
            setOut({text: 'When should I remind you' + (rd.who ? ' about ' + firstOf(rd.who) : '') + '?', chips: NEXT_OPTS.filter(o => o.k !== 'none').map(o => ({label: o.label, run: () => o.k === 'pick' ? Promise.resolve({say: NO_DATE}) : withDate(o)}))});
            setBusy(false); return;
          }
          r = await P().apply(ctx, rd, preset || {}, {});
        }
        if (r && r.ask) { setOut({text: r.ask, chips: r.chips || []}); setBusy(false); return; }
        setOut({text: (r && (r.say || r.text)) || 'Logged.', chips: (r && r.chips) || [], hold: (r && r.hold) || [], undo: r && r.undo, undoId: r && r.undoId});
        setText('');
        M.sound.play('soft');
      } catch (e) { setOut({err: (e && e.message) || 'That did not save. Try again.'}); }
      setBusy(false);
    };
    /* Undo: a run through the agent sits in its ledger (undoId), so the ledger takes it back; the fallback
       path holds the store's own undo record */
    const undoNow = () => {
      if (out && out.undoId && M.agent && M.agent.undo) return M.agent.undo(ctx, out.undoId).then(r => setOut({text: (r && r.say) || 'Undone.'})).catch(e => setOut({err: (e && e.message) || 'That cannot be undone now.'}));
      if (out && out.undo && P().undo) return P().undo(ctx, out.undo).then(s => setOut({text: s || 'Undone.'})).catch(() => {});
      return run('Undo');
    };
    const chip = c => {
      if (typeof c === 'string') { if (c === 'Undo') undoNow(); else run(c); return; }
      if (c && typeof c.run === 'function') Promise.resolve(c.run(ctx)).then(r => { if (r && (r.say || r.text)) setOut({text: r.say || r.text, chips: r.chips || []}); else if (typeof r === 'string') setOut({text: r}); else setOut(x => x ? {...x, chips: (x.chips || []).filter(y => y !== c)} : x); }).catch(() => {});
    };
    const heard = t => { setText(t); const rd = safe(() => P().read(t, ctx)); if (rd && P().isCapture(rd)) run(t); };
    const input = html`<input id=${id ? id + '-in' : undefined} class="input pros-in" value=${text} aria-label="Who did you speak to, and when do you follow up"
      placeholder=${placeholder || 'Met Rahul from Tata, sent the deck, he said talk after the 16th'} disabled=${!!ctx.viewAs}
      onInput=${e => { setText(e.target.value); if (out) setOut(null); }} onKeyDown=${e => { if (e.key === 'Enter') run(); }} autoFocus=${!!autoFocus}/>`;
    return html`<div class=${'pros-cap' + (compact ? ' compact' : '')} id=${id} data-ai="capture a talk or a follow-up">
      <div class="row nowrap pros-cap-row">
        <div class="grow">${M.fx && M.fx.Beam ? html`<${M.fx.Beam} radius=${12} size="sm">${input}<//>` : input}</div>
        ${M.parts.MicButton && !ctx.viewAs ? html`<${M.parts.MicButton} onText=${heard} sm label="Say it"/>` : null}
        <${UI.Btn} sm disabled=${busy || !text.trim() || !!ctx.viewAs} onClick=${() => run()}>${busy ? 'Saving' : 'Save'}<//>
      </div>
      ${ctx.viewAs ? html`<div class="hint">${PRIVATE}</div>` : back ? html`<div class=${'pros-back small' + (can ? '' : ' ink62')} role="status">${back}</div>` : null}
      ${out ? html`<div class="pros-receipt" role="status">
        ${out.err ? html`<div class="small flame-t">${out.err}</div>` : html`<div class="small">${out.text}</div>`}
        ${out.chips && out.chips.length ? html`<div class="row pros-chips">${out.chips.map((c, i) => html`<button key=${i} type="button" class="chip" onClick=${() => chip(c)}>${typeof c === 'string' ? c : c.label}</button>`)}</div>` : null}
        ${(out.hold || []).map((h, i) => html`<div key=${i} class="pros-hold row between">
          <span class="small"><b>${h.label}</b>${h.detail ? html` <span class="ink62">${h.detail}</span>` : null}</span>
          <${UI.Btn} sm onClick=${() => Promise.resolve(h.run(ctx)).then(() => setOut(x => x ? {...x, hold: (x.hold || []).filter(y => y !== h)} : x)).catch(() => {})}>Yes<//>
        </div>`)}
      </div>` : null}
    </div>`;
  }

  /* ---------- a follow-up's buttons: Done then "When next?", Snooze, They replied, Open ---------- */
  /* onDone fires once the follow-up is closed, so a list can keep the row while "When next?" is open;
     onSettled once the chips are answered or waved off */
  function FuActions({fu, fid, pid, onOpen, onDone, onSettled}) {
    const ctx = M.useCtx();
    const [mode, setMode] = useState('');
    const settle = () => { setMode(''); if (onSettled) onSettled(); };
    /* the row is held before the write lands, since the list drops a closed follow-up on the next snapshot */
    const done = how => {
      if (onDone) onDone();
      P().done(ctx, fid, how).then(() => {
        if (how === 'replied' && fu.pi && fu.sid && P().setReply) P().setReply(ctx, fu.pi, fu.sid, 'replied').catch(() => {});
        M.toast(how === 'replied' ? 'Noted, they replied' : 'Done'); setMode('next');
      }).catch(() => { if (onSettled) onSettled(); });
    };
    const next = o => {
      if (o.k === 'none') { settle(); return; }
      const w = whenOf(o); if (!w) return;
      /* a fresh follow-up: the old words ("talk after the 16th") were about the day just done */
      P().setFollow(ctx, {p: pid || '', pi: fu.pi || '', x: 'Follow up', d: w.d, t: w.t || '', src: 'form'}).then(() => { M.toast('Next: ' + label(w.d, w.t)); settle(); }).catch(() => {});
    };
    const snooze = o => { const w = whenOf(o); if (!w) return; P().snooze(ctx, fid, w).then(() => { M.toast('Snoozed to ' + label(w.d, w.t)); setMode(''); }).catch(() => {}); };
    if (mode === 'next') return html`<div class="pros-next"><span class="small">When next?</span><${QuickWhen} label="When next" options=${NEXT_OPTS} onPick=${next}/></div>`;
    if (mode === 'snooze') return html`<div class="pros-next"><span class="small">Snooze until</span><${QuickWhen} label="Snooze until" options=${SNOOZE_OPTS} onPick=${snooze}/><button type="button" class="linky tiny" onClick=${() => setMode('')}>Keep it</button></div>`;
    return html`<div class="row pros-acts">
      <button type="button" class="btn sm fu-done" onClick=${() => done('done')}>Done</button>
      <button type="button" class="btn sm sec fu-snooze" onClick=${() => setMode('snooze')}>Snooze</button>
      ${fu.src === 'sent' || fu.sid ? html`<button type="button" class="btn sm sec fu-replied" onClick=${() => done('replied')}>They replied</button>` : null}
      ${onOpen ? html`<button type="button" class="btn sm ghost fu-open" onClick=${onOpen}>Open</button>` : null}
    </div>`;
  }

  /* a row whose follow-up was just closed leaves the live list at once; this keeps it in place while its
     "When next?" chips are open, so the question has somewhere to sit. keyOf names a row. */
  function useHeld(rows, keyOf) {
    const [held, setHeld] = useState({});
    const keys = new Set(rows.map(keyOf));
    const list = rows.concat(Object.keys(held).filter(k => !keys.has(k)).map(k => held[k]));
    const hold = r => setHeld(h => ({...h, [keyOf(r)]: r}));
    const release = r => setHeld(h => { const k = keyOf(r); if (!(k in h)) return h; const o = {...h}; delete o[k]; return o; });
    return {list, hold, release};
  }

  /* ---------- Home: Follow-ups today ---------- */
  /* late first in flame, today's by time, today's meetings, then the pitches the viewer owns with a
     next date today that no follow-up mirrors. Six rows, then "and 4 more". The capture line last. */
  function todayRows(ctx) {
    const d = dataOf(ctx);
    const day = P().day(ctx);
    const td = today();
    const rows = [];
    const seen = new Set();
    const put = (r, kind) => { const k = r.fid || r.mid || ('pitch:' + r.pitch); if (seen.has(k)) return; seen.add(k); rows.push({...r, kind}); };
    (day.late || []).map(x => asRow(d, x)).filter(r => r.fu).sort((a, b) => a.fu.d.localeCompare(b.fu.d)).forEach(r => put(r, 'late'));
    (day.today || []).map(x => asRow(d, x)).filter(r => r.fu).sort((a, b) => timeOf(a.fu).localeCompare(timeOf(b.fu))).forEach(r => put(r, 'today'));
    Object.keys(d.meet).filter(k => !d.meet[k].done && d.meet[k].d === td).sort((a, b) => (d.meet[a].t || '').localeCompare(d.meet[b].t || '')).forEach(k => put({mid: k, meet: d.meet[k], pid: d.meet[k].p}, 'meet'));
    const pm = ctx.coll.pitches.map;
    const mirrored = new Set(Object.keys(d.fu).filter(k => !d.fu[k].done && d.fu[k].mirror).map(k => d.fu[k].pi));
    Object.keys(pm).filter(id => { const p = pm[id]; return p && p.owner === ctx.uid && p.nextDate === td && p.nextBy !== 'fu' && !mirrored.has(id) && p.stage !== 'won' && p.stage !== 'lost'; })
      .forEach(id => put({pitch: id, p: pm[id]}, 'pitch'));
    const late = rows.filter(r => r.kind === 'late').length, due = rows.filter(r => r.kind === 'today' || r.kind === 'pitch').length, meets = rows.filter(r => r.kind === 'meet').length;
    const anyOpen = Object.keys(d.fu).some(k => !d.fu[k].done) || Object.keys(d.meet).some(k => !d.meet[k].done);
    const parts = [due ? due + ' today' : '', late ? late + ' late' : '', meets ? n(meets, 'meeting', 'meetings') : ''].filter(Boolean);
    return {rows, late, due, meets, show: anyOpen || rows.length > 0, open: rows.length > 0, hot: late > 0, summary: parts.length ? parts.join(', ') : 'nothing due today'};
  }
  function FuRow({r, names, onHold, onRelease}) {
    const ctx = M.useCtx();
    const d = dataOf(ctx);
    const td = today();
    const now = M.useNow();
    const p = r.pid ? d.people[r.pid] : null;
    const live = liveOf(p, names);
    const open = () => M.nav('#prospects/' + r.pid);
    if (r.kind === 'pitch') {
      const pch = r.p;
      return html`<div class="fu-row" data-fid=${'pitch:' + r.pitch} data-kind="pitch">
        <div class="fu-line"><span class="dotflame" style=${{background: 'var(--ink62)'}}/><span class="grow"><b>${pch.brand || 'Pitch'}</b><span class="small ink62"> ${pch.next || 'Next step'}, today. The team sees this.</span></span></div>
        <div class="row pros-acts"><button type="button" class="btn sm ghost fu-open" onClick=${() => M.nav('#pitches/' + r.pitch)}>Open</button></div>
      </div>`;
    }
    if (r.kind === 'meet') {
      const m = r.meet;
      const at = m.t ? ist().at(m.d, m.t) : 0;
      const past = !!(m.t && now > at);
      const doneMeet = () => P().doneMeet(ctx, r.mid).then(() => M.toast('Noted')).catch(() => {});
      return html`<div class="fu-row" data-fid=${r.mid} data-kind="meet">
        <div class="fu-line"><span class="dotflame" style=${{background: 'var(--ink)'}}/><span class="grow">${past ? html`<b>How did it go with ${firstOf(live.who)}?</b>` : html`<b>${live.who}${live.org ? ' at ' + live.org : ''}</b><span class="small ink62">, ${m.t ? m.t : 'today'}${m.where ? ', ' + m.where : ''}</span>`}</span></div>
        <div class="row pros-acts">
          ${past ? html`<button type="button" class="btn sm fu-done" onClick=${open}>Add how it went</button>` : null}
          <button type="button" class="btn sm sec fu-meet-done" onClick=${doneMeet}>${past ? 'Done' : 'It happened'}</button>
          <button type="button" class="btn sm ghost fu-open" onClick=${open}>Open</button>
        </div>
      </div>`;
    }
    const fu = r.fu;
    const late = fu.d < td;
    const dueAt = ist().at(fu.d, timeOf(fu));
    const when = late ? lateText(fu) : now >= dueAt ? 'since ' + timeOf(fu) : timeOf(fu);
    return html`<div class="fu-row" data-fid=${r.fid} data-late=${late ? '1' : '0'}>
      <div class="fu-line"><span class="dotflame" style=${late ? null : {background: 'var(--ink62)'}}/><span class="grow">
        ${p ? html`<b>Follow up with ${firstOf(live.who)}</b><span class="small ink62"> ${[live.org, fu.said ? 'You said ' + fu.said + '.' : fu.x].filter(Boolean).join('. ')}</span>`
          : html`<b>${fu.x || 'A reminder'}</b><span class="small ink62"> A reminder for you.${fu.said ? ' You said ' + fu.said + '.' : ''}</span>`}
        <span class=${'tiny num ' + (late ? 'flame-t' : 'ink62')} style=${{marginLeft: '6px'}}>${when}</span>
      </span></div>
      <${FuActions} fu=${fu} fid=${r.fid} pid=${r.pid} onOpen=${open} onDone=${onHold ? () => onHold(r) : null} onSettled=${onRelease ? () => onRelease(r) : null}/>
    </div>`;
  }
  function FollowupsToday() {
    const ctx = M.useCtx();
    useIndex();
    const t = has() && !ctx.viewAs ? todayRows(ctx) : {rows: []};
    const d = dataOf(ctx);
    const keyOf = r => r.fid || r.mid || ('pitch:' + r.pitch);
    const {list, hold, release} = useHeld(t.rows.slice(0, 6), keyOf);
    const names = useNames(list.map(r => r.pid && d.people[r.pid] ? d.people[r.pid].cid : ''));
    const more = Math.max(0, t.rows.length - 6);
    return html`<section class="card" id="followups-card">
      <div class="card-head"><h2 class="card-title">Follow-ups today</h2>
        <button type="button" class="linky small" onClick=${() => M.nav('#prospects')}>Prospects</button></div>
      ${list.length ? html`<div class="fu-rows">${list.map(r => html`<${FuRow} key=${keyOf(r)} r=${r} names=${names} onHold=${hold} onRelease=${release}/>`)}</div>`
        : html`<div class="small ink62">Nothing due today.</div>`}
      ${more ? html`<div class="small" style=${{marginTop: '8px'}}><button type="button" class="linky" onClick=${() => M.nav('#prospects')}>and ${more} more</button></div>` : null}
      <div class="fu-cap"><${CaptureLine} id="home-capture" compact=${true} placeholder="Spoke to Meera at Swisse, talk after the 16th"/></div>
    </section>`;
  }
  /* the fold Home places after Today's focus; nothing when the viewer has no follow-ups at all */
  function FollowupsFold() {
    const ctx = M.useCtx();
    useIndex();
    const t = has() && !ctx.viewAs ? todayRows(ctx) : {show: false};
    /* once shown, the fold stays for the page's life: the last Done of the day keeps its "When next?" */
    const [seen, setSeen] = useState(false);
    useEffect(() => { if (t.show) setSeen(true); }, [t.show]);
    if (!has() || ctx.viewAs || !(t.show || seen)) return null;
    return html`<${UI.Fold} title="Follow-ups today" summary=${t.summary} open=${t.open} hot=${t.hot} id="fold-followups"><${FollowupsToday}/><//>`;
  }

  /* ---------- the person page ---------- */
  function MonthBlock({ym, pid, extras, first}) {
    const doc = P().useMonth ? P().useMonth(ym) : {ready: true, data: null};
    const t = (doc && doc.t) || {};
    const items = Object.keys(t).filter(k => t[k] && t[k].p === pid).map(k => ({id: k, at: t[k].at || 0, k: t[k].k, x: t[k].x || '', pi: t[k].pi}))
      .concat(extras || []).sort((a, b) => b.at - a.at);
    if (!items.length && !first) return null;
    return html`<div class="pros-month" data-ym=${ym}>
      <div class="micro plain">${monthName(ym)}</div>
      ${items.length ? items.map(it => html`<div key=${it.id} class=${'pros-tl row nowrap' + (it.shared ? ' shared' : '')} data-k=${it.k}>
        <span class="tiny num ink62 pros-tl-at">${U.fmtDay(ist().ymd(it.at))} ${ist().hm(it.at)}</span>
        <span class="grow small">${it.x}</span>
        ${it.shared ? html`<${UI.Pill}>shared<//>` : null}
      </div>`) : html`<div class="small ink62">Nothing logged this month.</div>`}
    </div>`;
  }
  function PersonDrawer({pid, onClose}) {
    const ctx = M.useCtx();
    const ix = useIndex();
    const d = dataOf(ctx);
    const p = d.people[pid] || null;
    const got = M.base && M.base.useRow ? M.base.useRow('contacts', p && p.cid ? p.cid : null) : {row: null, loading: false};
    const names = useMemo(() => ({rows: got.row && p ? {[p.cid]: got.row} : {}, loading: !!got.loading, done: !got.loading && !got.err}), [got.row, got.loading, got.err, p && p.cid]);
    const live = liveOf(p || {}, names);
    const [change, setChange] = useState(false);
    const [note, setNote] = useState('');
    const [noting, setNoting] = useState(false);
    const [stopped, setStopped] = useState(null);
    const [busy, setBusy] = useState(false);
    const cur = ymOf(today());
    const [shown, setShown] = useState([cur]);
    const fus = p ? openFus(d, pid) : [];
    const fu = fus[0] || null;
    const meets = p ? openMeets(d, pid) : [];
    const meet = meets[0] || null;
    const pm = ctx.coll.pitches.map;
    const status = p && P().statusOf ? P().statusOf(ctx, pid) : '';
    /* the timeline: private touches by month, follow-ups set, done and snoozed, meetings, and, marked
       shared, the sends on the pitch whose recipient is this person */
    const extras = useMemo(() => {
      const by = {};
      const put = (at, it) => { const ym = ymOf(ist().ymd(at)); (by[ym] = by[ym] || []).push({at, ...it}); };
      if (!p) return by;
      for (const k of Object.keys(d.fu)) {
        const f = d.fu[k]; if (!f || f.p !== pid) continue;
        if (f.at) put(f.at, {id: 'fu:' + k, k: 'fuset', x: 'Follow-up set for ' + label(f.d, f.t) + (f.said ? ', you said ' + f.said : '') + (f.x ? ': ' + f.x : '')});
        /* a snooze keeps its target as day, or day T time */
        (f.snz || []).forEach((s, i) => { if (s && s.at) put(s.at, {id: 'snz:' + k + i, k: 'snooze', x: 'Snoozed to ' + label(String(s.to || '').slice(0, 10), String(s.to || '').slice(11))}); });
        if (f.done && f.done.at) put(f.done.at, {id: 'done:' + k, k: 'done', x: f.done.how === 'replied' ? 'They replied' : f.done.how === 'dropped' ? 'Dropped the follow-up' : f.done.how === 'moved' ? 'Follow-up moved' : 'Follow-up done'});
      }
      for (const k of Object.keys(d.meet)) { const m = d.meet[k]; if (m && m.p === pid && m.at) put(m.at, {id: 'mt:' + k, k: 'meet', x: 'Meeting ' + label(m.d, m.t) + (m.where ? ', ' + m.where : '')}); }
      if (p.cid && P().sendsOf) for (const id of Object.keys(pm)) for (const s of P().sendsOf(pm[id])) if (s.to === p.cid && s.at) put(s.at, {id: 'sent:' + s.sid, k: 'sent', shared: true, x: (pm[id].brand || 'Pitch') + ': ' + (s.what || 'sent') + ' by ' + (VIA[s.via] || s.via || 'mail') + (s.reply ? ', ' + (s.reply === 'replied' ? 'replied' : s.reply === 'later' ? 'said later' : 'said no') : '')});
      return by;
    }, [d, pid, pm, p && p.cid]);
    const months = useMemo(() => Array.from(new Set([cur].concat(p && p.mo ? p.mo : [], Object.keys(extras)))).sort().reverse(), [p && (p.mo || []).join(), extras, cur]);
    const older = months.filter(m => !shown.includes(m));
    if (!ix.ready && !p) return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person"><${UI.Empty} text="Loading your people."/><//>`;
    if (!p) return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person"><${UI.Empty} text="This person is not on your list."/><//>`;
    const row = live.row || {};
    const tel = String(row.mobile || row.phone || '').trim();
    const wa = tel.replace(/[^\d]/g, '');
    const mail = String(row['email'] || '').trim();
    const pitch = fu && fu.pi ? pm[fu.pi] : null;
    const mayMirror = !!(pitch && (pitch.owner === ctx.uid || ctx.isFounder));
    const setNext = o => {
      if (o.k === 'none') return;
      const w = whenOf(o); if (!w) return;
      setBusy(true);
      P().setFollow(ctx, {p: pid, pi: fu ? fu.pi || '' : (p.pi || [])[0] || '', x: fu ? fu.x : 'Follow up', d: w.d, t: w.t || '', src: 'form'}).then(() => { M.toast('Next: ' + label(w.d, w.t)); setChange(false); }).catch(() => {}).then(() => setBusy(false));
    };
    const howItWent = () => {
      const x = note.trim(); if (!x || !meet) return;
      setBusy(true);
      P().logTouch(ctx, {p: pid, pi: meet.pi || '', k: 'meet', x, at: Date.now()}).then(() => P().doneMeet(ctx, meet.mid)).then(() => { setNote(''); setNoting(false); M.toast('Noted'); }).catch(() => {}).then(() => setBusy(false));
    };
    const stop = () => P().stopTracking(ctx, pid).then(() => setStopped({pid, who: live.who})).catch(() => {});
    const undoStop = () => (P().restore ? P().restore(ctx, pid) : P().addPerson(ctx, {cid: p.cid || '', oid: p.oid || '', who: p.who, org: p.org, role: p.role, pi: p.pi || []})).then(() => setStopped(null)).catch(() => {});
    const addToBase = async () => {
      if (!M.base || !M.base.upsertContact) return;
      setBusy(true);
      try {
        const w = String(live.who).split(/\s+/);
        const cid = await M.base.upsertContact(ctx, {first: w[0] || '', last: w.slice(1).join(' '), title: live.role || '', orgName: live.org || '', source: 'manual'});
        if (P().link) await P().link(ctx, pid, cid); else await ctx.W.merge('data/users/' + ctx.realUid + '/prospects', {people: {[pid]: {cid, up: Date.now()}}});
        M.toast('Added to the Base');
      } catch (e) { /* toasted by the write layer */ }
      setBusy(false);
    };
    const go = h => { onClose(); M.nav(h); };
    const footer = stopped ? html`<div class="row between grow"><span class="small">Stopped tracking ${stopped.who}.</span><${UI.Btn} kind="sec" sm id="person-undo-stop" onClick=${undoStop}>Undo<//></div>`
      : html`<div class="row between grow">
        <${UI.ConfirmBtn} onConfirm=${stop} label="Tap again to stop">Stop tracking<//>
        ${p.cid ? html`<${UI.Btn} kind="sec" sm id="person-base" onClick=${() => go('#base/' + p.cid)}>Open in the Base<//>`
          : html`<${UI.Btn} kind="sec" sm id="person-add-base" disabled=${busy} onClick=${addToBase} title="The team will see the name, title and company. Your notes stay with you.">Add to the Base<//>`}
      </div>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person" head=${statusPill(status)} footer=${footer}>
      <div id="person-drawer" class="stack pros-person" data-pid=${pid}>
        <div class="row nowrap pros-head">
          <span class="pros-av lg" aria-hidden="true">${initials(live.who)}</span>
          <div class="grow">
            <div class="pros-name">${live.who}</div>
            ${roleAt(live) ? html`<div class="small ink62">${roleAt(live)}</div>` : null}
            ${live.gone ? html`<div class="tiny flame-t">No longer in the Base. <button type="button" class="linky tiny" onClick=${addToBase}>Add again</button></div>` : null}
          </div>
        </div>
        ${tel || mail ? html`<div class="row pros-contact" id="person-contact">
          ${tel ? html`<a class="btn sm sec" href=${'tel:' + tel.replace(/\s+/g, '')}>Call</a>` : null}
          ${wa ? html`<a class="btn sm sec" href=${'https://wa.me/' + wa} target="_blank" rel="noopener">WhatsApp</a>` : null}
          ${mail ? html`<a class="btn sm sec" href=${'mailto:' + mail}>Mail</a>` : null}
        </div>` : null}
        <${UI.Card} title="Next step" id="person-next">
          ${fu ? html`<div class="stack tight">
            <div class="pros-next-line"><b class=${fu.d < today() ? 'flame-t' : ''}>${label(fu.d, timeOf(fu))}.</b> ${fu.said ? 'You said ' + fu.said + '.' : ''} ${fu.x && !(fu.said && fu.x.toLowerCase().includes(fu.said.toLowerCase())) ? html`<span class="ink62">${fu.x}</span>` : null}
              ${fu.d < today() ? html`<div class="tiny flame-t">${lateText(fu)}.</div>` : null}</div>
            ${change ? html`<div class="pros-next"><span class="small">Change to</span><${QuickWhen} label="Change to" options=${NEXT_OPTS.filter(o => o.k !== 'none')} onPick=${setNext}/><button type="button" class="linky tiny" onClick=${() => setChange(false)}>Keep it</button></div>`
              : html`<div class="row"><${FuActions} fu=${fu} fid=${fu.fid} pid=${pid}/><button type="button" class="btn sm ghost fu-change" onClick=${() => setChange(true)}>Change</button></div>`}
            ${mayMirror ? html`<label class="checkline pros-mirror"><input type="checkbox" id="person-mirror" checked=${!!fu.mirror} onChange=${e => { const on = e.target.checked; P().bridge(ctx, fu.fid, on).then(ok => { if (on && !ok) M.toast('The pitch next step stays as typed.'); }).catch(() => {}); }}/><span class="small">Also set as the pitch next step. The team sees the date and 'Follow up'.</span></label>` : null}
            ${fus.length > 1 ? html`<div class="tiny ink62">${fus.length - 1} more set: ${fus.slice(1).map(f => dayLabel(f.d)).join(', ')}</div>` : null}
          </div>` : html`<div class="stack tight">
            <div class="small ink62">No next step. When do you next talk?</div>
            <${QuickWhen} label="When do you next talk" options=${NEXT_OPTS.filter(o => o.k !== 'none')} onPick=${setNext}/>
          </div>`}
        <//>
        ${meet ? html`<${UI.Card} title="Meeting" id="person-meet">
          <div class="stack tight">
            <div><b>${label(meet.d, meet.t)}</b>${meet.where ? html`<span class="ink62">, ${meet.where}</span>` : null}${meet.x ? html`<div class="small ink62">${meet.x}</div>` : null}</div>
            ${noting ? html`<div class="row nowrap"><input class="input" aria-label="How it went" placeholder="How it went, in a line" value=${note} onInput=${e => setNote(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') howItWent(); }}/><${UI.Btn} sm disabled=${busy || !note.trim()} onClick=${howItWent}>Save<//></div>`
              : html`<div class="row"><${UI.Btn} kind="sec" sm id="person-meet-went" onClick=${() => setNoting(true)}>Add how it went<//><button type="button" class="linky small" onClick=${() => P().doneMeet(ctx, meet.mid).catch(() => {})}>Clear</button></div>`}
            <div class="hint">Kept in m360 only. It is not added to your calendar.</div>
          </div>
        <//>` : null}
        <${CaptureLine} id="person-capture" preset=${{pid, cid: p.cid || '', who: live.who, org: live.org}} placeholder=${'Spoke to ' + firstOf(live.who) + ', follow up next week'}/>
        <div class="stack tight pros-timeline" id="person-timeline">
          <div class="row between"><span class="micro plain">timeline</span><span class="tiny ink62">Only you see this.</span></div>
          ${shown.map((ym, i) => html`<${MonthBlock} key=${ym} ym=${ym} pid=${pid} extras=${extras[ym] || []} first=${i === 0}/>`)}
          ${older.length ? html`<button type="button" class="linky small" id="person-more" onClick=${() => setShown(s => s.concat([older[0]]))}>Show ${monthName(older[0]).split(' ')[0]}</button>` : null}
        </div>
        ${(p.pi || []).filter(id => pm[id]).length ? html`<div class="stack tight">
          <span class="micro plain">pitches</span>
          <div class="row">${(p.pi || []).filter(id => pm[id]).map(id => html`<button key=${id} type="button" class="chip pros-pitch" onClick=${() => go('#pitches/' + id)}>${pm[id].brand || 'Pitch'}<span class="tiny ink62">${(((M.pitches && M.pitches.STAGES) || []).find(s => s.v === (pm[id].stage || 'lead')) || {}).label || ''}</span></button>`)}</div>
        </div>` : null}
        ${!p.cid ? html`<div class="hint">Add to the Base: the team will see the name, title and company. Your notes stay with you.</div>` : null}
      </div>
    <//>`;
  }

  /* ---------- the page ---------- */
  function AddPerson({onClose}) {
    const ctx = M.useCtx();
    const [f, setF] = useState({who: '', org: '', role: ''});
    const [busy, setBusy] = useState(false);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const save = () => {
      if (!f.who.trim() || busy) return;
      setBusy(true);
      P().addPerson(ctx, {who: f.who.trim().slice(0, 60), org: f.org.trim().slice(0, 60), role: f.role.trim().slice(0, 60)}).then(pid => { M.toast('Added'); onClose(); M.nav('#prospects/' + pid); }, () => setBusy(false));
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Add a person" footer=${html`<${UI.Btn} id="pros-add-save" disabled=${busy || !f.who.trim()} onClick=${save}>Add<//>`}>
      <div class="stack">
        <${UI.Input} id="pros-add-who" label="who" value=${f.who} onChange=${set('who')} placeholder="Meera Shah" onEnter=${save}/>
        <${UI.Input} id="pros-add-org" label="company" value=${f.org} onChange=${set('org')} placeholder="Swisse"/>
        <${UI.Input} id="pros-add-role" label="role" value=${f.role} onChange=${set('role')} placeholder="Brand head"/>
        <div class="hint">Only you see this person here. To share them with the team, add them to the Base from their page.</div>
      </div>
    <//>`;
  }

  function Prospects({id}) {
    const ctx = M.useCtx();
    const ix = useIndex();
    const d = dataOf(ctx);
    const [view, setView] = useState(() => { const v = M.prefs.get('prosView', 'week'); return ['week', 'people', 'sent'].includes(v) ? v : 'week'; });
    const pick = v => { setView(v); M.prefs.set('prosView', v); };
    const [addOpen, setAddOpen] = useState(false);
    const route = M.useRoute();
    const pid = ['prospects', 'followups', 'follow-ups'].includes(route.page) ? (route.id || id || null) : (id || null);
    const close = () => { if (route.id) M.nav('#prospects'); };
    M.useIntent('capture', () => setTimeout(() => { const el = document.querySelector('#pros-capture input'); if (el) { el.scrollIntoView({block: 'center', behavior: M.reduced() ? 'auto' : 'smooth'}); el.focus(); } }, 80));
    const people = Object.keys(d.people).filter(k => d.people[k] && !d.people[k].gone);
    const names = useNames(people.map(k => d.people[k].cid));
    const open = pid0 => M.nav('#prospects/' + pid0);
    if (!has()) return html`<${UI.PageHead} micro="Private to you" title="Prospects"/>`;
    if (ctx.viewAs) return html`<${React.Fragment}><${UI.PageHead} micro="Private to you" title="Prospects"/><${UI.Empty} text=${PRIVATE}/><//>`;
    const day = P().day(ctx);
    const c = day.counts || {late: 0, today: 0, meetings: 0};
    const count = (c.today || 0) + ' today, ' + (c.late || 0) + ' late, ' + n(c.meetings || 0, 'meeting', 'meetings') + ' this week';
    const empty = !people.length && !Object.keys(d.fu).some(k => !d.fu[k].done);
    const exportMine = () => { if (!P().exportMine) return; Promise.resolve(P().exportMine(ctx)).then(() => M.toast('Downloaded')).catch(() => {}); };
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="Private to you" title="Prospects">
        <${UI.Btn} id="pros-add" onClick=${() => setAddOpen(true)}><${icons.plus}/>Add a person<//>
      <//>
      <${UI.Card} className="pros-top">
        <${CaptureLine} id="pros-capture"/>
        <div class="row between pros-count" style=${{marginTop: '12px'}}>
          <span class="small num" id="pros-count">${ix.ready ? count : 'Loading your people.'}</span>
          <div id="pros-seg" data-view=${view}><${UI.Seg} sm options=${[{v: 'week', label: 'This week'}, {v: 'people', label: 'People'}, {v: 'sent', label: 'Sent'}]} value=${view} onChange=${pick} ariaLabel="View"/></div>
        </div>
      <//>
      ${!ix.ready ? html`<${UI.Card}><div class="small ink62" id="pros-loading">Loading your people.</div><//>`
        : empty && view !== 'sent' ? html`<${UI.Card}><${UI.Empty} text=${EMPTY_LINE}/><//>`
        : view === 'people' ? html`<${PeopleView} d=${d} people=${people} names=${names} onOpen=${open}/>`
        : view === 'sent' ? html`<${SentView}/>`
        : html`<${WeekView} d=${d} day=${day} names=${names} onOpen=${open}/>`}
      <div class="row between pros-foot">
        <span class="hint">Only you see this list. Your team sees the pitch, the stage and where it was sent.</span>
        ${ctx.downloads ? html`<button type="button" class="linky small" id="pros-export" onClick=${exportMine}>Download my prospects</button>` : null}
      </div>
      ${addOpen ? html`<${AddPerson} onClose=${() => setAddOpen(false)}/>` : null}
      ${pid ? html`<${PersonDrawer} pid=${pid} onClose=${close}/>` : null}
    <//>`;
  }

  function WeekView({d, day, names, onOpen}) {
    const ctx = M.useCtx();
    const [allQuiet, setAllQuiet] = useState(false);
    const R = x => asRow(d, x);
    const row = (r, o) => { const p = d.people[r.pid]; return p ? html`<${PersonRow} key=${r.fid || r.mid || r.pid} pid=${r.pid} p=${p} live=${liveOf(p, names)} fu=${r.fu} meet=${r.meet} sub=${o && o.sub ? o.sub(r) : undefined} onOpen=${onOpen} chips=${o && o.chips ? o.chips(r) : null}/>` : null; };
    const ownRow = (r, o) => r.fu && !r.pid ? html`<div key=${r.fid} class="pros-row own" data-fid=${r.fid}><div class="pros-open"><span class="pros-av" aria-hidden="true">·</span><span class="pros-main"><span class="pros-who">${r.fu.x || 'Reminder'}</span><span class="small ink62">A reminder for you</span></span><${DateChip} fu=${r.fu}/></div><${FuActions} fu=${r.fu} fid=${r.fid} pid="" onDone=${o && o.hold ? () => o.hold(r) : null} onSettled=${o && o.release ? () => o.release(r) : null}/></div>` : null;
    /* a due row with Done pressed stays until "When next?" is answered (see useHeld) */
    const dueKey = r => r.fid;
    const lateH = useHeld((day.late || []).map(R).filter(r => r.fu).sort((a, b) => a.fu.d.localeCompare(b.fu.d)), dueKey);
    const tdyH = useHeld((day.today || []).map(R).filter(r => r.fu).sort((a, b) => timeOf(a.fu).localeCompare(timeOf(b.fu))), dueKey);
    const late = lateH.list, tdy = tdyH.list;
    const meets = (day.meetings || []).map(R).filter(r => r.meet);
    const week = (day.week || []).map(R).filter(r => r.fu);
    const waiting = (day.waiting || []).map(R).filter(r => r.fu);
    const loose = (day.loose || []).map(R).filter(r => r.pid);
    const quiet = (day.quiet || []).map(R).filter(r => r.pid);
    const waitSub = r => r.fu.after ? 'Talks after ' + dayLabel(r.fu.after) + '.' : r.fu.src === 'sent' ? 'Sent ' + (r.fu.at ? ageOf(r.fu.at) : 'recently') + ', no reply yet.' : r.fu.x;
    const setLoose = (r, o) => { const w = whenOf(o); if (!w) return; P().setFollow(ctx, {p: r.pid, pi: (d.people[r.pid].pi || [])[0] || '', x: 'Follow up', d: w.d, t: w.t || '', src: 'form'}).then(() => M.toast('Next: ' + label(w.d, w.t))).catch(() => {}); };
    const nothing = !late.length && !tdy.length && !meets.length && !week.length && !waiting.length && !loose.length && !quiet.length;
    return html`<div class="stack pros-week" id="pros-week">
      <${Group} id="pros-late" title="late" count=${late.length} hot=${true}>${late.map(r => r.pid ? row(r, {sub: x => lateText(x.fu)}) : ownRow(r, lateH))}<//>
      <${Group} id="pros-today" title="today" count=${tdy.length}>${tdy.map(r => r.pid ? row(r) : ownRow(r, tdyH))}<//>
      <${Group} id="pros-meet" title="meetings, next 7 days" count=${meets.length}>${meets.map(r => row(r))}<//>
      <${Group} id="pros-thisweek" title="this week" count=${week.length}>${week.map(r => r.pid ? row(r) : ownRow(r))}<//>
      <${Group} id="pros-waiting" title="waiting on them" count=${waiting.length}>${waiting.map(r => row(r, {sub: waitSub}))}<//>
      <${Group} id="pros-loose" title="no next step" count=${loose.length}>${loose.map(r => row(r, {chips: x => html`<${QuickWhen} label="Next step" options=${LOOSE_OPTS} onPick=${o => setLoose(x, o)}/>`}))}<//>
      <${Group} id="pros-quiet" title="quiet" count=${quiet.length}>
        ${(allQuiet ? quiet : quiet.slice(0, 5)).map(r => row(r, {sub: x => (x.pid && d.people[x.pid].last && d.people[x.pid].last.at ? 'Last touch ' + U.timeAgo(d.people[x.pid].last.at) : 'No touch yet') + '.'}))}
        ${quiet.length > 5 && !allQuiet ? html`<button type="button" class="linky small" id="pros-quiet-all" onClick=${() => setAllQuiet(true)}>Show all ${quiet.length}</button>` : null}
      <//>
      ${nothing ? html`<${UI.Card}><${UI.Empty} text="Nothing due this week. Everyone you track has a next step."/><//>` : null}
    </div>`;
  }

  function PeopleView({d, people, names, onOpen}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('');
    const td = today();
    const norm = s => String(s || '').toLowerCase();
    const rows = people.map(pid => { const p = d.people[pid]; const live = liveOf(p, names); const fu = openFus(d, pid)[0] || null; const meet = openMeets(d, pid)[0] || null; return {pid, p, live, fu, meet, st: P().statusOf ? P().statusOf(ctx, pid) : ''}; })
      .filter(r => !q.trim() || norm(r.live.who).includes(norm(q)) || norm(r.live.org).includes(norm(q)) || norm(r.p.who).includes(norm(q)) || norm(r.p.org).includes(norm(q)))
      .filter(r => !filter || r.st === filter)
      .sort((a, b) => {
        const la = a.fu && a.fu.d < td ? 0 : 1, lb = b.fu && b.fu.d < td ? 0 : 1;
        if (la !== lb) return la - lb;
        const na = a.fu ? a.fu.d : a.meet ? a.meet.d : '9999', nb = b.fu ? b.fu.d : b.meet ? b.meet.d : '9999';
        if (na !== nb) return na < nb ? -1 : 1;
        return ((b.p.last && b.p.last.at) || 0) - ((a.p.last && a.p.last.at) || 0);
      });
    const chips = [['talking', 'Talking'], ['meeting', 'Meeting set'], ['waiting', 'Waiting'], ['quiet', 'Quiet'], ['done', 'Done']];
    return html`<${UI.Card} id="pros-people">
      <div class="row" style=${{gap: '8px'}}>
        <div class="grow" style=${{flex: '1 1 200px'}}><input id="pros-q" class="input" placeholder="Find a person or a company" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Find a person"/></div>
        <div class="row pros-filters" role="group" aria-label="Filter">
          ${chips.map(([v, l]) => html`<button key=${v} type="button" class=${'chip' + (filter === v ? ' on' : '')} aria-pressed=${filter === v} onClick=${() => setFilter(filter === v ? '' : v)}>${l}</button>`)}
        </div>
      </div>
      <div class="pros-list" style=${{marginTop: '10px'}}>
        ${rows.length ? rows.map(r => html`<${PersonRow} key=${r.pid} pid=${r.pid} p=${r.p} live=${r.live} fu=${r.fu} meet=${r.meet} onOpen=${onOpen}/>`)
          : html`<${UI.Empty} text=${q || filter ? 'Nobody matches that.' : EMPTY_LINE}/>`}
      </div>
    <//>`;
  }

  /* shared send rows across the open pitches, newest first: what the team sees */
  /* a recipient: a Base id resolves to its name; typed text shows as typed */
  const idLike = v => /^[A-Za-z0-9_-]{1,40}$/.test(String(v || ''));
  function ToName({to}) {
    const ctx = M.useCtx();
    /* the Base is asked for a contact id (c_...) or an id the local index knows, never for a typed name */
    const id = isCid(to) || (idLike(to) && M.search && M.search.contactById && !!M.search.contactById(ctx, to)) ? to : null;
    const got = M.base && M.base.useRow ? M.base.useRow('contacts', id) : {row: null};
    if (got.row) return html`<span>${nameOf(got.row)}</span>`;
    return html`<span>${isCid(to) ? 'a contact' : String(to || 'someone')}</span>`;
  }
  const replyWord = s => s.reply === 'replied' ? 'replied' : s.reply === 'later' ? 'said later' : s.reply === 'no' ? 'said no' : 'no reply yet';
  const ageOf = at => { const k = Math.floor((Date.now() - at) / DAY); return k <= 0 ? 'today' : k === 1 ? 'yesterday' : k + ' days ago'; };
  function ReplyChips({pitchId, s}) {
    const ctx = M.useCtx();
    const set = v => P().setReply(ctx, pitchId, s.sid, v).then(() => M.toast('Noted')).catch(() => {});
    if (s.reply) return null;
    return html`<span class="row pros-reply" role="group" aria-label="Reply">
      <button type="button" class="chip" data-reply="replied" onClick=${() => set('replied')}>Replied</button>
      <button type="button" class="chip" data-reply="later" onClick=${() => set('later')}>Said later</button>
      <button type="button" class="chip" data-reply="no" onClick=${() => set('no')}>Said no</button>
    </span>`;
  }
  function SentView() {
    const ctx = M.useCtx();
    /* everyone's sends first: what pitch has gone where is the team's picture */
    const [mine, setMine] = useState('all');
    const pm = ctx.coll.pitches.map;
    const rows = [];
    for (const id of Object.keys(pm)) { const p = pm[id]; if (!p || p.stage === 'won' || p.stage === 'lost' || !P().sendsOf) continue; for (const s of P().sendsOf(p)) rows.push({...s, pitch: id, brand: p.brand || 'Pitch'}); }
    const list = rows.filter(s => mine === 'all' || s.by === ctx.uid).sort((a, b) => (b.at || 0) - (a.at || 0));
    return html`<${UI.Card} id="pros-sent" title="Sent" action=${html`<${UI.Seg} sm options=${[{v: 'mine', label: 'Mine'}, {v: 'all', label: 'Everyone'}]} value=${mine} onChange=${setMine} ariaLabel="Whose sends"/>`}>
      <div class="tiny ink62" style=${{marginBottom: '8px'}}>The team sees this.</div>
      ${list.length ? list.map(s => html`<div key=${s.pitch + s.sid} class="sent-row pros-row" data-sid=${s.sid}>
        <button type="button" class="pros-open rowbtn" onClick=${() => M.nav('#pitches/' + s.pitch)}>
          <span class="pros-main"><span class="pros-who">${s.brand}.</span><span class="small">${U.cap(s.what || 'Sent')} to <${ToName} to=${s.to}/> by ${VIA[s.via] || s.via || 'mail'}, ${ageOf(s.at)}, ${replyWord(s)}.</span></span>
          ${s.reply ? html`<${UI.Pill} kind=${s.reply === 'replied' ? 'ink' : s.reply === 'no' ? 'flame' : 'warm'}>${replyWord(s)}<//>` : null}
        </button>
        <${ReplyChips} pitchId=${s.pitch} s=${s}/>
      </div>`) : html`<${UI.Empty} text=${mine === 'mine' ? 'Nothing you sent is on an open pitch yet. Log one from the pitch, or type: sent the Swisse proposal to Meera.' : 'Nothing sent on an open pitch yet.'}/>`}
    <//>`;
  }

  /* ---------- the pitch drawer's folds ---------- */
  /* the shared Sent list: what went where, by whom, with a reply. Any member may log a send. */
  function SentFold({pitchId}) {
    const ctx = M.useCtx();
    const pitch = ctx.coll.pitches.map[pitchId];
    const sends = pitch && has() && P().sendsOf ? P().sendsOf(pitch) : [];
    const [add, setAdd] = useState(false);
    const [f, setF] = useState({to: '', toId: '', via: 'mail', what: '', link: ''});
    const [offer, setOffer] = useState(false);
    const [busy, setBusy] = useState(false);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const clientId = useMemo(() => { if (!pitch) return null; const map = ctx.coll.clients.map; const key = String(pitch.brand || '').trim().toLowerCase(); return key ? (Object.keys(map).find(cid => String(map[cid].name || '').trim().toLowerCase() === key) || null) : null; }, [pitch && pitch.brand, ctx.coll.clients.map]);
    const cq = M.base && M.base.useQuery ? M.base.useQuery('contacts', {client: clientId || '', limit: 200}, add) : {rows: []};
    const opts = useMemo(() => (cq.rows || []).map(c => ({v: c.id, label: nameOf(c) + (c.title ? ', ' + c.title : '') + (!clientId && c.orgName ? ' (' + c.orgName + ')' : '')})).sort((a, b) => a.label.localeCompare(b.label)), [cq.rows, clientId]);
    const stages = (M.pitches && M.pitches.STAGES) || [];
    const idx = v => stages.findIndex(s => s.v === v);
    const save = async () => {
      const what = f.what.trim().slice(0, 60);
      if (!what || busy || !pitch) return;
      setBusy(true);
      try {
        await P().addSend(ctx, pitchId, {to: f.toId || f.to.trim().slice(0, 60), via: f.via, what, link: f.link.trim()});
        M.toast('Logged. The team sees this.');
        if (/proposal|quote/i.test(what) && idx(pitch.stage || 'lead') < idx('proposal')) setOffer(true);
        setF({to: '', toId: '', via: 'mail', what: '', link: ''}); setAdd(false);
      } catch (e) { /* toasted by the write layer */ }
      setBusy(false);
    };
    const move = () => ctx.W.update('pitches/' + pitchId, {stage: 'proposal', stageAt: Date.now(), updated: Date.now()}).then(() => { setOffer(false); M.toast('Moved to Proposal sent'); }).catch(() => {});
    if (!pitch || !has()) return null;
    return html`<div class="pros-fold" id="pitch-sent">
      <div class="row between"><span class="micro plain">sent</span><span class="tiny ink62">The team sees this.</span></div>
      ${sends.length ? sends.map((s, i) => html`<div key=${s.sid} class="sent-row" data-sid=${s.sid} data-reply=${s.reply || ''}>
        <span class="small grow">${U.cap(s.what || 'Sent')} to <${ToName} to=${s.to}/> ${VIA[s.via] && s.via !== 'meeting' && s.via !== 'hand' ? 'by ' + VIA[s.via] : (VIA[s.via] || 'by ' + (s.via || 'mail'))}${s.link ? html`, <a class="linky" href=${s.link} target="_blank" rel="noopener">link</a>` : null}<span class="tiny ink62 num"> ${ageOf(s.at)}</span></span>
        <${UI.Pill} kind=${s.reply === 'replied' ? 'ink' : s.reply === 'no' ? 'flame' : s.reply === 'later' ? 'warm' : undefined}>${replyWord(s)}<//>
        ${i === 0 ? html`<${ReplyChips} pitchId=${pitchId} s=${s}/>` : null}
      </div>`) : html`<div class="small ink62">Nothing sent yet.</div>`}
      ${offer ? html`<div class="pros-hold row between"><span class="small"><b>Move to Proposal sent?</b></span><span class="row nowrap"><${UI.Btn} sm id="pitch-move-proposal" onClick=${move}>Yes<//><button type="button" class="linky small" onClick=${() => setOffer(false)}>Not yet</button></span></div>` : null}
      ${add ? html`<div class="stack tight pros-addsend" id="pitch-add-send">
        ${opts.length ? html`<${UI.Select} id="pitch-send-pick" label="to, from the Base" value=${f.toId} onChange=${set('toId')} options=${[{v: '', label: f.to ? 'Typed below' : 'Pick a contact'}].concat(opts)}/>` : null}
        ${!f.toId ? html`<${UI.Input} id="pitch-send-to" label=${opts.length ? 'or type who' : 'to'} value=${f.to} onChange=${set('to')} placeholder="Meera, brand head"/>` : null}
        <div class="grid2">
          <${UI.Select} id="pitch-send-via" label="via" value=${f.via} onChange=${set('via')} options=${VIA_OPTS}/>
          <${UI.Input} id="pitch-send-what" label="what" value=${f.what} onChange=${set('what')} placeholder="Proposal v2" onEnter=${save}/>
        </div>
        <${UI.Input} id="pitch-send-link" label="link, optional" value=${f.link} onChange=${set('link')} placeholder="https://"/>
        <div class="row"><${UI.Btn} sm id="pitch-send-save" disabled=${busy || !f.what.trim()} onClick=${save}>Log the send<//><button type="button" class="linky small" onClick=${() => setAdd(false)}>Cancel</button></div>
      </div>` : html`<div><button type="button" class="btn sm sec" id="pitch-add-send" onClick=${() => setAdd(true)}>Add a send</button></div>`}
    </div>`;
  }

  /* the viewer's private notes with the pitch's person: the last three touches, the open follow-up, the capture line */
  function PitchNotes({pitchId}) {
    const ctx = M.useCtx();
    useIndex();
    const d = dataOf(ctx);
    const pitch = ctx.coll.pitches.map[pitchId];
    const pid = useMemo(() => {
      if (!pitch) return '';
      const list = Object.keys(d.people).filter(k => { const p = d.people[k]; return p && !p.gone && ((p.cid && p.cid === pitch.contact) || (p.pi || []).includes(pitchId)); });
      return list.sort((a, b) => (openFus(d, b).length - openFus(d, a).length) || ((d.people[b].last && d.people[b].last.at) || 0) - ((d.people[a].last && d.people[a].last.at) || 0))[0] || '';
    }, [d, pitch && pitch.contact, pitchId]);
    const p = pid ? d.people[pid] : null;
    const got = M.base && M.base.useRow ? M.base.useRow('contacts', p && p.cid ? p.cid : null) : {row: null, loading: false};
    const doc = has() && P().useMonth ? P().useMonth(ymOf(today())) : {data: null};
    /* once Done closes the follow-up the row goes; the question "When next?" stays until answered */
    const [asked, setAsked] = useState(false);
    if (!p || ctx.viewAs || !has()) return null;
    const live = liveOf(p, {rows: got.row ? {[p.cid]: got.row} : {}, loading: !!got.loading, done: false});
    const t = (doc && doc.t) || {};
    const touches = Object.keys(t).filter(k => t[k] && t[k].p === pid).map(k => ({id: k, ...t[k]})).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3);
    const fu = openFus(d, pid)[0] || null;
    const askNext = o => { if (o.k === 'none') { setAsked(false); return; } const w = whenOf(o); if (!w) return; P().setFollow(ctx, {p: pid, pi: pitchId, x: 'Follow up', d: w.d, t: w.t || '', src: 'form'}).then(() => { M.toast('Next: ' + label(w.d, w.t)); setAsked(false); }).catch(() => {}); };
    return html`<div class="pros-fold pros-notes" id="pitch-notes">
      <div class="row between"><span class="micro plain">your notes with ${firstOf(live.who)}</span><span class="tiny ink62">Private to you.</span></div>
      ${touches.length ? touches.map(x => html`<div key=${x.id} class="pros-tl row nowrap" data-k=${x.k}><span class="tiny num ink62 pros-tl-at">${U.fmtDay(ist().ymd(x.at || 0))}</span><span class="grow small">${x.x}</span></div>`) : html`<div class="small ink62">Nothing logged yet.</div>`}
      ${fu ? html`<div class="pros-next-line small"><b class=${fu.d < today() ? 'flame-t' : ''}>${label(fu.d, timeOf(fu))}.</b> ${fu.said ? 'You said ' + fu.said + '.' : fu.x}</div><${FuActions} fu=${fu} fid=${fu.fid} pid=${pid} onOpen=${() => M.nav('#prospects/' + pid)} onDone=${() => setAsked(true)}/>`
        : asked ? html`<div class="pros-next"><span class="small">When next?</span><${QuickWhen} label="When next" options=${NEXT_OPTS} onPick=${askNext}/></div>` : null}
      <${CaptureLine} id="pitch-capture" compact=${true} preset=${{pitch: pitchId, pid, cid: p.cid || '', who: live.who, org: live.org}} placeholder=${'Spoke to ' + firstOf(live.who) + ', follow up next week'}/>
    </div>`;
  }

  /* ---------- the Base contact drawer's fold ---------- */
  function ContactConversations({cid, who, org, role, oid, client}) {
    const ctx = M.useCtx();
    useIndex();
    const d = dataOf(ctx);
    const pid = Object.keys(d.people).find(k => d.people[k] && !d.people[k].gone && d.people[k].cid === cid) || '';
    const p = pid ? d.people[pid] : null;
    const doc = has() && P().useMonth ? P().useMonth(ymOf(today())) : {data: null};
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!has() || ctx.viewAs || !cid) return null;
    /* asking: 'track' right after Track this person, 'next' once Done closes a follow-up */
    const track = () => { setBusy(true); P().addPerson(ctx, {cid, oid: oid || '', who: who || '', org: org || '', role: role || ''}).then(() => { setAsking('track'); M.toast('Tracking ' + firstOf(who)); }).catch(() => {}).then(() => setBusy(false)); };
    const next = o => {
      if (o.k === 'none') { setAsking(false); return; }
      const w = whenOf(o); if (!w) return;
      const pid1 = Object.keys(d.people).find(k => d.people[k] && d.people[k].cid === cid) || pid;
      P().setFollow(ctx, {p: pid1, pi: '', x: 'Follow up', d: w.d, t: w.t || '', src: 'form'}).then(() => { M.toast('Next: ' + label(w.d, w.t)); setAsking(false); }).catch(() => {});
    };
    const makeContact = () => ctx.W.update('clients/' + client.id, {contact: cid, updated: Date.now()}).then(() => M.toast(firstOf(who) + ' is the ' + client.name + ' contact')).catch(() => {});
    const t = (doc && doc.t) || {};
    const touches = pid ? Object.keys(t).filter(k => t[k] && t[k].p === pid).map(k => ({id: k, ...t[k]})).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3) : [];
    const fu = pid ? openFus(d, pid)[0] || null : null;
    /* Done closes the follow-up and asks "When next?" through the same chips as Track */
    const askNext = o => { if (o.k === 'none') { setAsking(false); return; } next(o); };
    return html`<div class="pros-fold pros-notes" id="contact-conversations">
      <div class="row between"><span class="micro plain">your conversations</span><span class="tiny ink62">Private to you.</span></div>
      ${!p ? html`<div class="row"><${UI.Btn} kind="sec" sm id="contact-track" disabled=${busy} onClick=${track}>Track this person<//><span class="tiny ink62">Your notes, follow-ups and reminders stay with you.</span></div>`
        : html`<${React.Fragment}>
          ${touches.length ? touches.map(x => html`<div key=${x.id} class="pros-tl row nowrap" data-k=${x.k}><span class="tiny num ink62 pros-tl-at">${U.fmtDay(ist().ymd(x.at || 0))}</span><span class="grow small">${x.x}</span></div>`) : html`<div class="small ink62">Nothing logged yet.</div>`}
          ${fu ? html`<div class="pros-next-line small"><b class=${fu.d < today() ? 'flame-t' : ''}>${label(fu.d, timeOf(fu))}.</b> ${fu.said ? 'You said ' + fu.said + '.' : fu.x}</div><${FuActions} fu=${fu} fid=${fu.fid} pid=${pid} onOpen=${() => M.nav('#prospects/' + pid)} onDone=${() => setAsking('next')}/>` : null}
          <${CaptureLine} id="contact-capture" compact=${true} preset=${{pid, cid, who, org}} placeholder=${'Spoke to ' + firstOf(who) + ', follow up next week'}/>
          <div><button type="button" class="linky small" onClick=${() => M.nav('#prospects/' + pid)}>Open on Prospects</button></div>
        <//>`}
      ${asking && !fu ? html`<div class="pros-next"><span class="small">${asking === 'next' ? 'When next?' : 'When do you next talk?'}</span><${QuickWhen} label="When do you next talk" options=${TRACK_OPTS} onPick=${askNext}/></div>` : null}
      ${client && client.status === 'live' && !client.contact && client.id ? html`<div><button type="button" class="linky small" id="contact-make" onClick=${makeContact}>Make ${firstOf(who)} the ${client.name} contact</button></div>` : null}
    </div>`;
  }

  M.pages.Prospects = Prospects;
  M.parts.PersonDrawer = PersonDrawer;
  M.parts.CaptureLine = CaptureLine;
  M.parts.FollowupsToday = FollowupsToday;
  M.parts.FollowupsFold = FollowupsFold;
  M.parts.SentFold = SentFold;
  M.parts.PitchNotes = PitchNotes;
  M.parts.ContactConversations = ContactConversations;
  /* the card line on the pitch board, from the latest send: "Sent to Meera, 3 days, no reply yet" */
  M.prospectsUi = {todayRows, readBack, sendLine: (pitch, toName) => {
    const s = has() && P().latestSend ? P().latestSend(pitch) : null;
    if (!s) return '';
    const who = toName || 'them';
    if (s.reply === 'replied') return who + ' replied';
    if (s.reply === 'no') return who + ' said no';
    const k = Math.floor((Date.now() - (s.at || 0)) / DAY);
    return 'Sent to ' + who + ', ' + (k <= 0 ? 'today' : n(k, 'day', 'days')) + ', ' + (s.reply === 'later' ? 'said later' : 'no reply yet');
  }};
})();
