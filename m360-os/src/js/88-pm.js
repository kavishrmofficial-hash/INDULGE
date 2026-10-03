/* module: pm surfaces. Where the personal managers (M.pm, 09-pm.js) show: the watcher that turns a due
   step into one bubble (PmWatch), the person's Home card (PmCard), the manager's chips on Your team
   (PmChip, PmTeamHead, PmTeamExtra), the bot log on a person's page (PmLog), the chase button in the
   task drawer (PmChaseButton), the derived rows in a direct message (PmDmRows), an ask's live receipt
   (PmAskReceipt), the founder's Admin card with the week's audit (PmAdminCard) and the Me card for a
   manager's own bot and the person's own view of theirs (PmMeCard). The bot is the pill body in flame. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;
  const MIN = 60000;

  /* the profiles everyone's lines are written with, handed to the engine */
  function useNames(ctx) {
    const ids = useMemo(() => (ctx.activeMembers || []).map(m => m.uid), [ctx.activeMembers]);
    const profs = M.useProfiles(ids);
    M.pm.learn(profs);
    return id => M.pm.first(ctx, id);
  }
  const Bot = ({size, state, label}) => M.fx && M.fx.Bot ? html`<${M.fx.Bot} type="pill" state=${state || 'default'} size=${size || 28} label=${label || 'the bot'}/>` : null;
  const etaLabel = eta => typeof eta === 'number' ? U.hhmm(eta) : eta === 'eod' ? 'the end of the day' : eta ? U.fmtDay(eta) : '';
  const saidText = a => !a ? '' : a.how === 'onit' ? 'on it' + (a.eta ? ', in by ' + etaLabel(a.eta) : '') : a.how === 'blocked' ? 'blocked' : a.how === 'wrong' ? 'this is not right, a correction is asked'
    : a.how === 'leave' ? 'off today' : a.how === 'reply' ? 'replied in the messages' : a.how;
  const standalone = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');

  /* ---------- the watcher: one bubble per due batch, wherever you are in m360 ---------- */
  let lead = null;
  function PmWatch() {
    const ctx = M.useCtx();
    const me = useRef({});
    /* mounted from the shell and from the inbox watcher: the first one does the work */
    useEffect(() => { if (!lead) lead = me.current; return () => { if (lead === me.current) lead = null; }; }, []);
    useNames(ctx);
    const ref = useRef(ctx);
    ref.current = ctx;
    const seen = useRef(new Map());
    const away = useRef(null);
    const pass = () => {
      const c = ref.current;
      /* the working one went away (its host unmounted): the next one standing takes over */
      if (!lead) lead = me.current;
      if (lead !== me.current || !c || !c.uid || c.viewAs || !c.ready || !M.pm || !M.pm.loaded(c)) return;
      if (c.coll.chat && c.coll.chat.ready === false) return;
      const P = M.pm.P(c);
      const asks = Object.keys(c.coll.me.map || {}).length;
      if (!P.on && !asks) return;
      const uid = c.uid;
      const nowP = performance.now();
      /* first pass on this device, or none for half an hour: what is waiting arrives as one bubble */
      if (away.current == null) { const last = Number(M.prefs.get('pmPass.' + uid, '0')) || 0; away.current = !last || Date.now() - last > 30 * MIN; }
      M.prefs.set('pmPass.' + uid, String(Date.now()));
      autoAck(c);
      const list = M.pm.forMe(c, {now: Date.now()});
      const dev = new Set(M.pm.devList(uid));
      const fresh = list.filter(x => !x.told && !dev.has(x.stepId) && x.step !== '0' && x.item.state !== 'sorted');
      for (const x of fresh) if (!seen.current.has(x.stepId)) seen.current.set(x.stepId, nowP);
      /* due on two passes at least a pass apart; a hidden tab waits longer, so a visible device wins */
      const gap = (document.hidden ? 2.25 : 1) * M.pm.PASS;
      const ready = fresh.filter(x => nowP - seen.current.get(x.stepId) >= gap - 50);
      const ring = ready.filter(x => x.ring);
      /* a blocked answer's step 2 rang as the note's direct message: listed, marked seen, never a second bubble */
      const chat = ready.filter(x => x.chat && !document.hidden);
      if (chat.length) M.pm.told(c, chat.map(x => x.stepId), true);
      if (!ring.length) return;
      /* bubbles at least fifteen minutes apart: what comes due in between waits and rides the next one */
      const lastRing = Number(M.prefs.get('pmRing.' + uid, '0')) || 0;
      if (!away.current && !ring.some(x => x.now) && Date.now() - lastRing < 15 * MIN && Date.now() >= lastRing) return;
      const over = ready.filter(x => !x.ring && !x.inBudget && !x.held);
      const more = over.length;
      const mgrSteps = ring.filter(x => x.step === '2' || x.step === '2b');
      const answers = ring.filter(x => x.step === 'r' || x.step === 't');
      const one = ring[0];
      const n = ring.length;
      const botOf = x => x.step.startsWith('a.') ? M.pm.first(c, (x.item.asks.find(a => x.step === 'a.' + a.id) || x.item.asks[0] || {}).by) + ' asked m360' : x.item.botName || 'Your bot';
      const lineOf = x => (x.step === '2' || x.step === '2b') ? x.item.mgrLine : x.step === 'r' || x.step === 't' || x.step === 'digest' ? x.item.line : x.item.line;
      let title, body;
      if (n === 1) { title = mgrSteps.length || one.step === 'digest' ? 'Your bot' : answers.length ? 'Answers to your ask' : botOf(one); body = lineOf(one); }
      else if (mgrSteps.length === n) { title = 'Your bot'; body = M.pm.COPY.mgrBundle(n); }
      else if (answers.length === n) { title = 'Answers to your ask'; body = ring.map(lineOf).join('. '); }
      else { title = botOf(one); body = away.current ? M.pm.COPY.away(n, botOf(one)) : M.pm.COPY.bundle(n, botOf(one)); }
      if (more) body += ', ' + M.pm.COPY.more(more);
      const href = mgrSteps.length === n ? '#people/' + one.item.rep : answers.length ? one.item.ref : '#home';
      if (M.notices) M.notices.push({key: 'pm:' + one.stepId, title, body, hidden: 'Something new from your bot', href, bot: true, life: 12000});
      M.sound.play('soft');
      try { window.dispatchEvent(new CustomEvent('m360:pm', {detail: {type: answers.length === n ? 'answer' : one.step === 'digest' ? 'digest' : 'step', n}})); } catch (e) { /* old browser */ }
      M.prefs.set('pmRing.' + uid, String(Date.now()));
      away.current = false;
      M.pm.told(c, ring.map(x => x.stepId));
      /* the ones past the day's cap were named in this bubble ("and 2 more"): seen, so no later bubble repeats them */
      if (over.length) M.pm.told(c, over.map(x => x.stepId), true);
    };
    /* a pass on every context change and every M.pm.PASS (20 s); the clock is checked each second, so a
       changed PASS takes at once */
    const last = useRef(0);
    const run = () => { last.current = performance.now(); try { pass(); } catch (e) { /* the watcher never breaks the page */ } };
    useEffect(() => {
      const t = setInterval(() => { if (performance.now() - last.current >= M.pm.PASS) run(); }, 1000);
      const out = setInterval(() => { try { M.pm.flush(ref.current); } catch (e) { /* retried next minute */ } }, 60000);
      return () => { clearInterval(t); clearInterval(out); };
    }, []);
    useEffect(run, [ctx]);
    return null;
  }
  /* a manager who wrote to a blocked report after the "blocked" answers it: the page sees the DM (only
     the pair can read it on the team site) and records that, so the level above is never asked */
  const acked = new Set();
  function autoAck(c) {
    if (!M.rooms || !M.lines) return;
    for (const r of M.lines.reportsOf(c, c.uid)) for (const it of M.pm.items(c, r)) {
      if (!it.ack || it.ack.how !== 'blocked' || acked.has(it.K)) continue;
      const own = (((c.coll.me.map[c.uid] || {}).pm || {}).ack || {})[it.K];
      if (own) continue;
      const t = Number(it.ack.at) || 0;
      if (M.rooms.messagesOf(c, M.rooms.dmId(c.uid, r)).some(m => m.by === c.uid && (m.at || 0) > t)) { acked.add(it.K); M.pm.handle(c, it.K, 'answered').catch(() => acked.delete(it.K)); }
    }
  }

  /* ---------- the person's answers: chips, an eta, a blocked note, a reply ---------- */
  function Answer({it, onStatus, onSaving, compact}) {
    const ctx = M.useCtx();
    const [open, setOpen] = useState('');
    const [note, setNote] = useState('');
    const [time, setTime] = useState('');
    const [date, setDate] = useState('');
    const [busy, setBusy] = useState(false);
    const task = M.pm.TASK_KINDS.has(it.kind);
    const save = async (how, extra) => {
      if (busy) return;
      setBusy(true); if (onSaving) onSaving(true);
      try {
        await M.pm.answer(ctx, it.K, {how, ...(extra || {})});
        M.haptic.buzz('tick');
        setOpen(''); setNote('');
      } catch (e) { M.toast('Not sent. Try again.', true); }
      setBusy(false); if (onSaving) onSaving(false);
    };
    const in_ = mins => Date.now() + mins * MIN;
    const eod = () => U.parseYmd(it.ymd).getTime() + U.minutes(ctx.settings.eodCut || '19:30') * MIN;
    const wrong = () => {
      const field = it.kind === 'noin' ? 'in' : it.kind === 'noout' || it.kind === 'short' ? 'out' : '';
      save('wrong').then(() => { if (M.fixes && M.fixes.ask) M.fixes.ask({kind: field ? 'attendance' : 'other', field: field || '', date: it.ymd, note: 'From the bot: ' + it.label}); });
    };
    const chip = (how, label, fn, cls) => html`<button type="button" key=${how + label} class=${'chip pm-ans' + (cls ? ' ' + cls : '') + (open === how ? ' on' : '')} data-how=${how} disabled=${busy} onClick=${fn}>${label}</button>`;
    const L = it.kind === 'noout' ? {wrong: 'I left at...', onit: 'Still working, done by...', status: 'Out on a shoot', reply: 'Something else'} : {};
    const chips = it.chips.map(c => c === 'onit' ? chip('onit', L.onit || 'On it', () => setOpen(open === 'onit' ? '' : 'onit'))
      : c === 'late' ? chip('onit', 'Running late', () => setOpen(open === 'onit' ? '' : 'onit'))
      : c === 'soon' ? chip('onit', 'Posting in 10 minutes', () => save('onit', {eta: in_(10)}))
      : c === 'leave' ? chip('leave', 'Off today', () => save('leave').then(() => M.nav('#leave')))
      : c === 'status' ? chip('status', L.status || 'Set a status', () => onStatus && onStatus())
      : c === 'blocked' ? chip('blocked', 'Blocked', () => setOpen(open === 'blocked' ? '' : 'blocked'))
      : c === 'wrong' ? chip('wrong', L.wrong || 'Not right', wrong)
      : c === 'reply' ? chip('reply', L.reply || 'Reply', () => setOpen(open === 'reply' ? '' : 'reply')) : null);
    const etas = it.kind === 'noin' ? [['30m', 'In 30 minutes', () => save('onit', {eta: in_(30)})], ['1h', 'In 1 hour', () => save('onit', {eta: in_(60)})]]
      : [['1h', 'In 1 hour', () => save('onit', {eta: in_(60)})], ['eod', 'End of day', () => save('onit', {eta: task ? it.ymd : eod()})]]
        .concat(task ? [['tomorrow', 'Tomorrow', () => save('onit', {eta: U.ymd(U.addDays(U.parseYmd(it.ymd), 1))})]] : []);
    const who = it.source === 'ask' ? M.pm.first(ctx, it.asks[0].by) : it.kind === 'waiton' ? M.pm.first(ctx, it.facts.r) : M.pm.first(ctx, it.mgr);
    return html`<div class=${'pm-answer' + (compact ? ' compact' : '')}>
      <div class="pm-chips row">${chips}</div>
      ${open === 'onit' ? html`<div class="pm-eta row" role="group" aria-label="When">
        ${etas.map(([k, l, fn]) => html`<button type="button" key=${k} class="chip" data-eta=${k} disabled=${busy} onClick=${fn}>${l}</button>`)}
        <label class="pm-pick"><span class="tiny ink62">By</span><input type="time" class="input" data-eta="time" aria-label="By what time" value=${time} onInput=${e => setTime(e.target.value)}/></label>
        ${task ? html`<label class="pm-pick"><span class="tiny ink62">On</span><input type="date" class="input" data-eta="date" aria-label="By what date" value=${date} min=${it.ymd} onInput=${e => setDate(e.target.value)}/></label>` : null}
        ${time || date ? html`<${UI.Btn} sm=${true} kind="sec" disabled=${busy} onClick=${() => save('onit', {eta: date ? date : U.parseYmd(it.ymd).getTime() + U.minutes(time) * MIN})}>Save<//>` : null}
      </div>` : null}
      ${open === 'blocked' || open === 'reply' ? html`<div class="pm-note row nowrap">
        <input class="input grow" data-note=${open} placeholder=${open === 'blocked' ? 'What is in the way?' : 'Your reply'} aria-label=${open === 'blocked' ? 'What is in the way?' : 'Your reply'} value=${note}
          onInput=${e => setNote(e.target.value.slice(0, 1000))} onKeyDown=${e => { if (e.key === 'Enter' && note.trim()) save(open, {note}); }}/>
        <${UI.Btn} sm=${true} kind="sec" disabled=${busy || !note.trim()} onClick=${() => save(open, {note})}>Send<//>
      </div>` : null}
      ${open === 'reply' || open === 'blocked' ? html`<div class="tiny ink62">Goes to ${who} as a message.</div>` : null}
    </div>`;
  }

  /* the ladder line under a row: when the manager hears, or when they did */
  function ladderLine(ctx, it, now) {
    const mgr = M.pm.first(ctx, it.to2 || it.mgr);
    if (it.source === 'ask') return it.asks[0] && it.asks[0].tellBy ? 'If there is no answer by ' + U.hhmm(it.asks[0].tellBy) + ', ' + M.pm.first(ctx, it.asks[0].by) + ' hears about it.' : M.pm.first(ctx, it.asks[0].by) + ' sees your answer.';
    if (it.state === 'held') return M.pm.COPY.held;
    if (it.coach) return M.pm.COPY.coach({until: it.coachUntil ? U.fmtDay(it.coachUntil) : 'soon'});
    if (it.toldMgrAt) return mgr + ' saw it at ' + U.hhmm(it.toldMgrAt) + '.';
    if (it.mgrDueAt && it.mgrDueAt <= now) return mgr + ' was told at ' + U.hhmm(it.mgrDueAt) + '.';
    if (it.hearsAt) return 'If there is no answer by ' + U.hhmm(it.hearsAt) + ', ' + mgr + ' hears about it.';
    return mgr + ' can see this on Your team.';
  }

  /* one row on the card: the line, why, the ladder, the one thing to do, the answers */
  function PmRow({it, onStatus, multi, now, onSaving}) {
    const ctx = M.useCtx();
    const [why, setWhy] = useState(false);
    const [change, setChange] = useState(false);
    const mgrName = it.source === 'ask' ? M.pm.first(ctx, it.asks[0].by) : M.pm.first(ctx, it.mgr);
    const s1 = it.steps.find(s => s.step === '1');
    const early = s1 && s1.state === 'waiting' && it.line0;
    const sorted = it.state === 'sorted';
    const ack = it.ack;
    const go = () => {
      const p = it.primary || {};
      if (p.href) return M.nav(p.href);
      if (p.act === 'status' && onStatus) return onStatus();
      if (p.act === 'eod') { const el = document.getElementById('fold-eod') || document.getElementById('wrap-shipped'); if (el) { el.scrollIntoView({block: 'center', behavior: M.reduced() ? 'auto' : 'smooth'}); const f = document.getElementById('wrap-shipped'); if (f) f.focus({preventScroll: true}); } else M.nav('#home'); return; }
      M.intend('#home', 'checkin');
    };
    const src = it.source === 'ask' ? (it.head || mgrName + ' asked') + (it.asks[0].via === 'voice' ? ', by voice' : '') : multi ? it.botName : '';
    return html`<div class=${'pm-row' + (sorted ? ' sorted' : '')} data-k=${it.K} data-kind=${it.kind} data-state=${it.state}>
      ${src ? html`<div class="tiny ink62 pm-src">${src}</div>` : null}
      ${it.asks.length && it.source !== 'ask' ? html`<div class="tiny ink62 pm-src">${M.pm.first(ctx, it.asks[0].by)} asked about this too${it.asks[0].via === 'voice' ? ', by voice' : ''}</div>` : null}
      <div class="pm-line">${early ? it.line0 : it.line}</div>
      ${sorted ? html`<div class="pm-sorted small">Sorted at ${U.hhmm(it.sortedAt || now)}${it.toldMgrAt ? '.' : ', before ' + mgrName + ' heard.'}</div>` : html`<${React.Fragment}>
        <div class="row pm-meta">
          ${it.why ? html`<button type="button" class="linky tiny pm-whybtn" aria-expanded=${why} onClick=${() => setWhy(!why)}>Why this</button>` : null}
          <span class="pm-ladder tiny ink62">${ladderLine(ctx, it, now)}</span>
        </div>
        ${why ? html`<div class="pm-why small ink62">${it.why}</div>` : null}
        ${it.state === 'held' || it.state === 'letgo' ? null : html`<div class="row pm-acts">
          ${it.primary ? html`<${UI.Btn} sm=${true} onClick=${go}>${it.primary.label}<//>` : null}
        </div>`}
        ${ack && !change && it.state !== 'held' ? html`<div class="pm-said small">You said: ${saidText(ack)}. ${mgrName} can see this.${(ack.n || 1) < 2 ? html` <button type="button" class="linky tiny" onClick=${() => setChange(true)}>Change</button>` : null}</div>`
          : it.state === 'held' || it.state === 'letgo' ? null : html`<${Answer} it=${it} onStatus=${onStatus} onSaving=${onSaving}/>`}
      <//>`}
    </div>`;
  }

  /* ---------- Home: "From Shreya's bot" ---------- */
  const visible = (it, uid, now) => it.steps.some(s => s.to === uid && (s.state === 'due' || s.state === 'told') && (s.step === '0' || s.step === '1' || s.step === '1b' || s.step === '1m' || s.step.startsWith('a.')))
    && it.state !== 'letgo' && (it.state !== 'sorted' || now - (it.sortedAt || 0) < 10 * MIN);
  function cardItems(ctx, now) { return M.pm.items(ctx, ctx.uid, {now}).filter(it => visible(it, ctx.uid, now)); }
  M.pm.cardItems = cardItems;

  function PmCard({onStatus}) {
    const ctx = M.useCtx();
    useNames(ctx);
    const [saving, setSaving] = useState(false);
    const [mirror, setMirror] = useState(false);
    const now = Number(ctx.now) || Date.now();
    const list = M.pm.loaded(ctx) ? cardItems(ctx, now) : [];
    const fm = M.pm.loaded(ctx) ? M.pm.forMe(ctx, {now}) : [];
    const shown = new Set(list.map(it => it.K));
    /* a step the card shows and that will not ring is marked as seen once it is on screen */
    useEffect(() => {
      if (!list.length || document.hidden || ctx.viewAs) return;
      const ids = fm.filter(x => shown.has(x.item.K) && !x.told && !x.ring && !x.held && x.item.state !== 'sorted').map(x => x.stepId);
      if (ids.length) M.pm.told(ctx, ids, true);
    }, [ctx]);
    if (!list.length) return null;
    const fresh = fm.filter(x => shown.has(x.item.K) && !x.told && x.step !== '0').length;
    const sources = new Set(list.map(it => it.source === 'ask' ? 'ask:' + it.asks[0].by : 'bot:' + it.mgr));
    const bots = Array.from(new Set(list.filter(it => it.source !== 'ask').map(it => it.botName)));
    const title = bots.length === 1 ? 'From ' + bots[0] : bots.length ? 'From your bots' : 'From ' + M.pm.first(ctx, list[0].asks[0].by);
    const open = list.filter(it => it.state === 'open').length;
    const hot = list.some(it => it.hearsAt && it.hearsAt - now <= 15 * MIN && it.state === 'open');
    const card = html`<section class="card pm-card" id="pm-card" aria-label=${title}>
      <div class="pm-head row nowrap">
        <span class="pm-bot"><${Bot} size=${32} state=${saving ? 'working' : open ? 'default' : 'sleeping'} label=${title}/></span>
        <h2 class="card-title grow">${title}</h2>
        ${saving ? html`<${M.fx.Orb} state="working" size=${20} label="saving"/>` : null}
        ${fresh ? html`<${M.fx.MetalBadge}>${fresh + ' new'}<//>` : null}
      </div>
      <div class="pm-rows">${list.map(it => html`<${PmRow} key=${it.K} it=${it} onStatus=${onStatus} multi=${sources.size > 1} now=${now} onSaving=${setSaving}/>`)}</div>
      ${M.lines.managerOf(ctx, ctx.uid) ? html`<div class="row between pm-foot">
        <button type="button" class="linky tiny" id="pm-mirror" onClick=${() => setMirror(true)}>See what ${M.pm.first(ctx, M.lines.managerOf(ctx, ctx.uid))} sees</button>
        <span class="tiny ink62">Answers never count toward points.</span>
      </div>` : null}
      ${mirror ? html`<${PmMirror} uid=${ctx.uid} onClose=${() => setMirror(false)}/>` : null}
    </section>`;
    return hot && M.fx && M.fx.Beam ? html`<${M.fx.Beam} on=${true}>${card}<//>` : card;
  }

  /* "See what Shreya sees": the same chips the manager's Home shows about you */
  function PmMirror({uid, onClose}) {
    const ctx = M.useCtx();
    const now = Number(ctx.now) || Date.now();
    const list = M.pm.items(ctx, uid, {now}).filter(it => it.steps.some(s => s.state !== 'waiting'));
    const mgr = M.lines.managerOf(ctx, uid);
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${'What ' + M.pm.first(ctx, mgr) + ' sees'}>
      <div class="stack tight" id="pm-mirror-list">
        ${list.length ? list.map(it => html`<div class="small team-flag pm-flag" key=${it.K}><span class="dotflame"/><span class="grow">${it.mgrLine}</span><${PmChip} it=${it} readOnly=${true}/></div>`)
          : html`<${UI.Empty} text="Nothing about you on their screen today."/>`}
      </div>
      <div class="hint">${M.pm.first(ctx, mgr)} sees the same facts and the same times you do. Their bot never writes its own words.</div>
    <//>`;
  }

  /* ---------- the manager's chip beside a flag, and its menu ---------- */
  function chipOf(ctx, it, now) {
    const a = it.ack, s1 = it.steps.find(s => s.step === '1'), s2 = it.steps.find(s => s.step === '2' || s.step === '2b');
    if (it.state === 'sorted') return ['ink', 'sorted ' + U.hhmm(it.sortedAt || now)];
    if (it.state === 'letgo') return ['ink', 'let go today'];
    if (it.state === 'held') return ['warm', a && a.how === 'leave' ? 'off today' : 'leave asked'];
    if (a && a.how === 'blocked') return ['flame', 'blocked'];
    if (a && a.how === 'wrong') return ['flame', 'says this is not right'];
    if (a && a.how === 'onit') {
      if (typeof a.eta === 'number' && a.eta < now && it.holds) return ['flame', 'said ' + U.hhmm(a.eta) + ', still open'];
      return ['ink', 'on it' + (a.eta ? ', by ' + etaLabel(a.eta) : '')];
    }
    if (a && a.how === 'reply') return ['ink', 'replied'];
    if (it.status) return ['ink', 'status set'];
    if (it.mack && it.mack.how === 'mine') return ['ink', 'with you, you said'];
    if (s2 && (s2.state === 'due' || s2.state === 'told')) return ['flame', 'with ' + (it.to2 === ctx.uid ? 'you' : M.pm.first(ctx, it.to2)) + ' since ' + U.hhmm(s2.at)];
    if (s1 && s1.told) return [s1.state === 'told' && now - s1.told > 30 * MIN ? 'flame' : 'warm', (now - s1.told > 30 * MIN ? 'no answer, seen ' : 'seen ') + U.hhmm(s1.told)];
    if (s1 && s1.state === 'due') {
      if (it.kind === 'noin' && !Object.keys((((ctx.coll.me.map[it.rep] || {}).act) || {})[it.ymd] || {}).length) return ['flame', 'not on m360 today'];
      return ['warm', 'nudged ' + U.hhmm(s1.at)];
    }
    if (s1 && s1.state === 'waiting') return ['warm', 'nudge at ' + U.hhmm(s1.at)];
    if (it.source === 'ask') return ['warm', 'asked ' + U.hhmm(it.asks[0].at)];
    return null;
  }
  const portal = node => (window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(node, document.body) : node);
  function PmChip({it, readOnly}) {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(false);
    const [mailed, setMailed] = useState(null);
    const [pos, setPos] = useState(null);
    const btn = useRef(null);
    /* the menu lives on the page's top layer, so no card clips it; below the chip, or above it near the bottom */
    useEffect(() => {
      if (!open) return undefined;
      const place = () => {
        const r = btn.current && btn.current.getBoundingClientRect();
        if (!r) return;
        const up = window.innerHeight - r.bottom < 300;
        setPos({right: Math.max(8, window.innerWidth - r.right), ...(up ? {bottom: window.innerHeight - r.top + 6} : {top: r.bottom + 6})});
      };
      place();
      /* the keyboard follows the menu in, and Escape brings it back to the chip */
      const t = setTimeout(() => { const first = document.querySelector('.pm-menu[data-for="' + it.K + '"] button:not(:disabled)'); if (first) first.focus({preventScroll: true}); }, 0);
      const off = e => { if (!(e.target.closest && (e.target.closest('.pm-menu') || e.target.closest('.pm-chip-wrap')))) setOpen(false); };
      const key = e => {
        if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); if (btn.current) btn.current.focus({preventScroll: true}); return; }
        const menu = document.querySelector('.pm-menu[data-for="' + it.K + '"]');
        if (!menu || !(e.key === 'ArrowDown' || e.key === 'ArrowUp')) return;
        const list = Array.from(menu.querySelectorAll('button:not(:disabled)'));
        const i = list.indexOf(document.activeElement);
        if (!list.length) return;
        e.preventDefault();
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
      };
      window.addEventListener('pointerdown', off, true);
      window.addEventListener('keydown', key, true);
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
      return () => { clearTimeout(t); window.removeEventListener('pointerdown', off, true); window.removeEventListener('keydown', key, true); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
    }, [open]);
    const now = Number(ctx.now) || Date.now();
    const c = chipOf(ctx, it, now);
    const canAct = !readOnly && it.rep !== ctx.uid && (ctx.isFounder || M.lines.chainOf(ctx, it.rep).indexOf(ctx.uid) >= 0);
    useEffect(() => {
      if (!open || !standalone() || mailed) return;
      window.M360_API('pmmail', {ymd: it.ymd}).then(r => { const row = ((r && r.rows) || []).find(x => (x.keys || []).indexOf(it.K) >= 0); setMailed(row ? row.at : 0); }, () => setMailed(0));
    }, [open]);
    if (!c) return null;
    const mine = (((ctx.coll.me.map[ctx.uid] || {}).pm || {}).ack || {})[it.K] || {};
    const againDone = mine.again && U.ymd(new Date(mine.again)) === U.ymd(new Date(now));
    const act = async (how, o) => {
      try { await M.pm.handle(ctx, it.K, how, o); M.toast(how === 'again' ? 'Nudging again' : how === 'mine' ? 'Yours to handle. It stays off the note up the line.' : 'Let go for today'); } catch (e) { /* toasted */ }
      setOpen(false);
    };
    const copy = () => {
      const t = it.copyText || '';
      try { navigator.clipboard.writeText(t).then(() => M.toast('Copied. Paste it anywhere.'), () => M.toast(t)); } catch (e) { M.toast(t); }
      setOpen(false);
    };
    return html`<span class="pm-chip-wrap">
      <button type="button" ref=${btn} class=${'pm-chip ' + c[0]} data-k=${it.K} aria-expanded=${canAct ? open : undefined} disabled=${!canAct} onClick=${() => canAct && setOpen(!open)}>${mailed ? 'emailed ' + U.hhmm(mailed) : c[1]}</button>
      ${open ? portal(html`<div class="pm-menu" role="menu" data-for=${it.K} style=${pos || {visibility: 'hidden'}}>
        <button type="button" role="menuitem" data-do="again" disabled=${!!againDone || it.state !== 'open'} onClick=${() => act('again')}>${againDone ? 'Nudged again today' : 'Nudge again'}</button>
        <button type="button" role="menuitem" data-do="mine" onClick=${() => act('mine')}>I will handle it</button>
        <button type="button" role="menuitem" data-do="drop" onClick=${() => act('drop', {until: it.ymd})}>Let it go today</button>
        <button type="button" role="menuitem" data-do="message" onClick=${() => { setOpen(false); M.nav('#chat/' + M.rooms.dmId(ctx.uid, it.rep)); }}>Message ${M.pm.first(ctx, it.rep)}</button>
        <button type="button" role="menuitem" data-do="copy" onClick=${copy}>Copy a message</button>
        ${!standalone() ? html`<div class="tiny ink62 pm-menu-note">Email works on the team site.</div>` : null}
      </div>`) : null}
    </span>`;
  }

  /* Your team's header: the bot, and whether it is on */
  function PmTeamHead() {
    const ctx = M.useCtx();
    if (!M.pm || !M.pm.on(ctx)) return null;
    const on = M.pm.botOn(ctx, ctx.uid);
    /* only the founder switches a bot off while the policy holds them on: then there is nothing to turn on here */
    const held = M.pm.P(ctx).require || !!M.pm.P(ctx).off[ctx.uid];
    return html`<span class="pm-team-head row nowrap" id="pm-team-head">
      <${Bot} size=${28} state=${on ? 'default' : 'sleeping'} label="Your bot"/>
      ${on ? html`<span class="tiny ink62">Your bot is on</span>` : held ? html`<span class="tiny ink62">Your bot is off</span>` : html`<button type="button" class="linky tiny" onClick=${() => M.nav('#me')}>Turn on your bot</button>`}
    </span>`;
  }
  /* what the bot holds about a report beyond the watch's flags: sent back work, chases, a blocker
     waiting, yesterday's EOD line, and anyone else's ask */
  function PmTeamExtra({uid}) {
    const ctx = M.useCtx();
    useNames(ctx);
    if (!M.pm || !M.pm.loaded(ctx)) return null;
    const now = Number(ctx.now) || Date.now();
    const row = M.pm.board(ctx, ctx.uid, now).find(r => r.uid === uid);
    const list = row ? row.extra.filter(it => it.steps.some(s => s.state !== 'waiting')) : [];
    if (!list.length) return null;
    return html`${list.map(it => html`<div key=${it.K} class="small team-flag pm-flag" data-k=${it.kind}>
      <span class="dotflame" style=${it.state === 'open' ? null : {background: 'var(--ink62)'}}/>
      <span class="grow">${it.source === 'ask' ? M.pm.first(ctx, it.asks[0].by) + ' asked ' + M.pm.first(ctx, uid) + ' at ' + U.hhmm(it.asks[0].at) + (it.ack ? ' · answered' : '') : it.mgrLine}</span>
      <${PmChip} it=${it}/>
    </div>`)}`;
  }
  /* the chip for one watch flag: the item the bot holds for it */
  function PmFlagChip({uid, f}) {
    const ctx = M.useCtx();
    useNames(ctx);
    if (!M.pm || !M.pm.loaded(ctx) || !M.pm.on(ctx)) return null;
    const now = Number(ctx.now) || Date.now();
    const row = M.pm.board(ctx, ctx.uid, now).find(r => r.uid === uid);
    const fl = row && row.flags.find(x => (x.key || x.k) === (f.key || f.k));
    const its = (fl && fl.items) || [];
    if (!its.length) return null;
    const it = its.find(x => x.state === 'open') || its[0];
    return html`<${PmChip} it=${it}/>`;
  }

  /* ---------- the person page: the bot log ---------- */
  function PmLog({uid}) {
    const ctx = M.useCtx();
    useNames(ctx);
    if (!M.pm || !M.pm.loaded(ctx)) return null;
    const allowed = ctx.isFounder || uid === ctx.uid || M.lines.chainOf(ctx, uid).indexOf(ctx.uid) >= 0;
    if (!allowed) return null;
    /* further up the line, the same as the note up the line: work and blockers, never attendance */
    const sees = r => ctx.isFounder || ctx.canSee(r);
    const fair = (r, it) => sees(r) || M.pm.TASK_KINDS.has(it.kind) || it.kind === 'waiton';
    const days = M.pm.log(ctx, uid, 6).map(d => ({...d, items: d.items.filter(it => fair(uid, it))}));
    const any = days.some(d => d.items.length);
    if (!M.pm.on(ctx) && !any) return null;
    const own = uid === ctx.uid;
    /* for the managers above: the team's items still open with them */
    const team = !own ? M.lines.reportsOf(ctx, uid).flatMap(r => M.pm.items(ctx, r).filter(it => it.mgrDueAt && it.state === 'open' && fair(r, it))) : [];
    return html`<${UI.Card} title="Bot log" id="person-pm" action=${html`<${Bot} size=${28} state=${any ? 'default' : 'sleeping'} label="Bot log"/>`}>
      ${days.map(d => html`<div class="pm-log-day" key=${d.ymd}>
        <div class="micro">${d.ymd === U.todayStr() ? 'today' : U.fmtDay(d.ymd)}</div>
        ${d.items.length ? d.items.map(it => html`<div class="pm-log-row small" key=${it.K} data-k=${it.K}>
          <span class="num tiny ink62 pm-log-t">${U.hhmm(it.s1 || 0)}</span>
          <span class="grow">${own ? it.line : it.mgrLine}</span>
          <${PmChip} it=${it} readOnly=${d.ymd !== U.todayStr()}/>
        </div>`) : html`<div class="tiny ink62">Nothing for the bot.</div>`}
      </div>`)}
      ${team.length ? html`<div class="pm-log-day"><div class="micro">open on ${M.pm.first(ctx, uid)}'s team</div>
        ${team.map(it => html`<div class="pm-log-row small" key=${it.K}><span class="grow">${it.mgrLine}</span><${PmChip} it=${it}/></div>`)}</div>` : null}
      <div class="tiny ink62">Times and answer codes only, kept for 8 days. The bot never reads what was saved.</div>
    <//>`;
  }

  /* ---------- the task drawer: ask the bot to chase ---------- */
  function PmChaseButton({taskId}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    if (!M.pm || !M.pm.on(ctx)) return null;
    const t = (ctx.coll.tasks.map || {})[taskId];
    if (!t || t.status === 'done' || !t.owner || t.owner === ctx.uid) return null;
    if (!(ctx.isFounder || M.lines.chainOf(ctx, t.owner).indexOf(ctx.uid) >= 0)) return null;
    const on = !!((((ctx.coll.me.map[ctx.uid] || {}).pm || {}).chase || {})[taskId]);
    const who = M.pm.first(ctx, t.owner);
    const go = async () => {
      setBusy(true);
      try { await M.pm.chase(ctx, taskId, !on); M.toast(on ? 'The bot stops chasing it' : who + ' hears from the bot in five minutes'); } catch (e) { M.toast('That did not save. Try again.', true); }
      setBusy(false);
    };
    return html`<button type="button" class=${'chip pm-chase' + (on ? ' on' : '')} id="task-chase" aria-pressed=${on} disabled=${busy} onClick=${go}>
      <${Bot} size=${20} state=${on ? 'default' : 'sleeping'} label="chase"/>${on ? 'The bot is chasing ' + who + '. Stop' : 'Ask ' + who + "'s bot to chase this"}</button>`;
  }

  /* ---------- the DM: the bot's automatic lines and the coded answers, derived, never stored ---------- */
  function PmDmRows({room}) {
    const ctx = M.useCtx();
    useNames(ctx);
    if (!M.pm || !M.pm.loaded(ctx) || !M.rooms.isDm(room)) return null;
    const other = M.rooms.dmOther(room, ctx.uid);
    const now = Number(ctx.now) || Date.now();
    const rows = [];
    const take = (it, mineSide) => {
      if (it.source === 'ask' || it.kind === 'digest') return;
      const s1 = it.steps.find(s => s.step === '1' || s.step === '2');
      if (!s1 || s1.state === 'waiting' || s1.state === 'skipped') return;
      rows.push({it, at: s1.at, mine: mineSide});
    };
    for (const it of M.pm.items(ctx, ctx.uid, {now})) if (it.mgr === other || (it.kind === 'waiton' && it.facts.r === other)) take(it, true);
    for (const it of M.pm.items(ctx, other, {now})) if (it.mgr === ctx.uid || (it.kind === 'waiton' && it.facts.r === ctx.uid)) take(it, false);
    if (!rows.length) return null;
    rows.sort((a, b) => a.at - b.at);
    const bots = Array.from(new Set(rows.map(r => r.it.botName).filter(Boolean)));
    return html`<div class="pm-dm" id="pm-dm">
      <div class="pm-dm-label tiny ink62"><${Bot} size=${20} label="bot"/><span>${bots.join(' and ') || 'The bot'}, automatic, only you two see this</span></div>
      ${rows.map(({it, at, mine}) => html`<div class="pm-dm-row" key=${it.K} data-k=${it.K}>
        <span class="tiny ink62 num">${U.hhmm(at)}</span>
        <div class="grow">
          <div class="small">${mine ? it.line : it.mgrLine}</div>
          ${it.ack ? html`<div class="small pm-dm-said"><b>${M.pm.first(ctx, it.rep)}:</b> ${M.pm.COPY.said[it.ack.how] ? M.pm.COPY.said[it.ack.how](it.ack.eta, it.kind) : it.ack.how}</div>` : null}
          ${mine && !it.ack && it.state === 'open' ? html`<${Answer} it=${it} compact=${true} onStatus=${() => M.nav('#home')}/>` : null}
        </div>
      </div>`)}
    </div>`;
  }

  /* ---------- an ask's receipt: who has seen it and what they said, live ---------- */
  function PmAskReceipt({askId}) {
    const ctx = M.useCtx();
    useNames(ctx);
    const [open, setOpen] = useState(false);
    const s = M.pm && M.pm.loaded(ctx) ? M.pm.sent(ctx).find(x => x.askId === askId) : null;
    if (!s) return html`<div class="agent-receipt pm-receipt tiny ink62">The ask is on its way.</div>`;
    const n = s.rows.length;
    const head = (s.withdrawn ? 'Withdrawn: ' : '') + 'Asked ' + (n === 1 ? '1 person' : n + ' people') + ' · ' + s.answered + ' answered' + (s.showAt && s.showAt > Date.now() ? ' · shows at ' + U.hhmm(s.showAt) + ', no message until then' : '');
    return html`<div class="agent-receipt pm-receipt" data-ask=${askId}>
      <button type="button" class="agent-receipt-toggle row nowrap" aria-expanded=${open} onClick=${() => setOpen(!open)}>
        <${UI.AvatarRow} ids=${s.to} size=${20} max=${2}/><span class="grow small">${head}</span><span class=${'pm-chev' + (open ? ' on' : '')}><${icons.chevD}/></span>
      </button>
      ${open ? html`<div class="pm-receipt-rows">
        ${s.rows.map(r => html`<div class="agent-receipt-row small row nowrap" key=${r.uid} data-uid=${r.uid}>
          <span class="grow">${M.pm.first(ctx, r.uid)}${r.seen ? ' · seen ' + U.hhmm(r.seen) : r.waiting ? ' · waiting for its time' : ' · not seen yet'}${r.text ? ' · ' + r.text.replace(M.pm.first(ctx, r.uid) + ': ', '') : r.sorted ? ' · sorted' : ''}</span>
        </div>`)}
        ${!s.withdrawn ? html`<button type="button" class="linky tiny" onClick=${() => M.pm.withdraw(ctx, askId).then(() => M.toast('Withdrawn'), () => {})}>Withdraw</button>` : null}
      </div>` : null}
    </div>`;
  }

  /* ---------- Admin: the founder's policy and the week's audit ---------- */
  const WAITS = [{v: 30, label: '30m'}, {v: 60, label: '1h'}, {v: 120, label: '2h'}, {v: 180, label: '3h'}];
  const KIND_NAME = {noin: 'check-in', noeod: 'EOD line', overdue: 'overdue', sentback: 'sent back', chase: 'chase', quiet: 'quiet', waiton: 'blocker waiting', noout: 'check-out', idle: 'idle', short: 'short day'};
  function PmAdminCard() {
    const ctx = M.useCtx();
    const P = M.pm.P(ctx);
    const [busy, setBusy] = useState(false);
    const [show, setShow] = useState(false);
    if (!ctx.isFounder) return null;
    const raw = (ctx.settings && ctx.settings.pm) || {};
    const save = async patch => {
      setBusy(true);
      try { await ctx.W.merge('settings/app', {pm: patch, updated: Date.now()}); M.toast('Saved'); } catch (e) { /* toasted */ }
      setBusy(false);
    };
    const start = ctx.settings.start || '10:30';
    const g = Number(ctx.settings.grace) || 0;
    const t0 = U.minutes(start) + g;
    const fmt = m => U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60);
    const mailOk = standalone();
    const a = show ? M.pm.audit(ctx) : null;
    const Z = a ? a.zero : null;
    return html`<${UI.Card} id="pm-admin" title="Personal managers" action=${html`<${Bot} size=${28} state=${P.on ? 'default' : 'sleeping'} label="Personal managers"/>`}>
      <p class="small ink62 pm-admin-lede">${M.pm.COPY.admin}</p>
      <div class="stack tight">
        <div class="row between fx-bell-row"><span>Personal managers</span>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="pm-on" size="sm" badge=${false} offLabel="Off for everyone" onLabel="On for every manager" pressed=${P.on} disabled=${busy} onChange=${v => save({on: !!v})}/>`
            : html`<button type="button" class="chip" id="pm-on" aria-pressed=${P.on} onClick=${() => save({on: !P.on})}>${P.on ? 'On' : 'Off'}</button>`}</div>
        <div class="row between"><span>Managers may switch their bot off</span>
          <${UI.Seg} sm=${true} ariaLabel="Managers may switch their bot off" options=${[{v: 'no', label: 'No'}, {v: 'yes', label: 'Yes'}]} value=${P.require ? 'no' : 'yes'} onChange=${v => save({require: v === 'no'})}/></div>
        <div class="row between pm-admin-row"><span>A report has this long to answer before their manager hears</span>
          <span id="pm-wait"><${UI.Seg} sm=${true} ariaLabel="Wait" options=${WAITS.filter(w => w.v >= P.waitMin && w.v <= P.waitMax).map(w => ({v: String(w.v), label: w.label}))} value=${String(P.wait)} onChange=${v => save({wait: Number(v)})}/></span></div>
        <div class="row between pm-admin-row"><span>A manager has this long before it goes a level up</span>
          <span id="pm-carry"><${UI.Seg} sm=${true} ariaLabel="Carry" options=${[60, 120, 180].map(v => ({v: String(v), label: v / 60 + 'h'}))} value=${String(P.carry)} onChange=${v => save({carry: Number(v)})}/></span></div>
        <div class="row between pm-admin-row"><span>The daily note up the line at</span>
          <input type="time" class="input pm-time" id="pm-digest" value=${P.digestAt} aria-label="The daily note up the line at" onChange=${e => /^\d{1,2}:\d{2}$/.test(e.target.value) && save({digestAt: e.target.value})}/></div>
        <div class="row between pm-admin-row"><span>Most bubbles one person gets a day</span>
          <span id="pm-perday"><${UI.Seg} sm=${true} ariaLabel="Bubbles a day" options=${[2, 3, 4, 6].map(v => ({v: String(v), label: String(v)}))} value=${String(P.perDay)} onChange=${v => save({perDay: Number(v)})}/></span></div>
        <div class="pm-admin-row"><div class="small" style=${{marginBottom: '6px'}}>It chases</div>
          <div class="row pm-kinds" id="pm-kinds">${M.pm.BOT_KINDS.map(k => html`<button type="button" key=${k} class=${'pill' + (P.kinds[k] ? ' ink' : '')} data-kind=${k} aria-pressed=${!!P.kinds[k]} onClick=${() => save({kinds: {[k]: !P.kinds[k]}})}>${KIND_NAME[k]}</button>`)}</div></div>
        <div class="row between pm-admin-row"><span>A short day is under</span>
          <span id="pm-short"><${UI.Seg} sm=${true} ariaLabel="Short day" options=${[0, 6, 7, 8].map(v => ({v: String(v), label: v ? v + 'h' : 'off'}))} value=${String(P.minHours)} onChange=${v => save({minHours: Number(v), kinds: {short: Number(v) > 0}})}/></span></div>
        <div class="row between pm-admin-row"><span>New joiners hear only from the bot for</span>
          <span id="pm-coach"><${UI.Seg} sm=${true} ariaLabel="Coach days" options=${[0, 5, 10, 20].map(v => ({v: String(v), label: v ? v + ' days' : 'off'}))} value=${String(P.coachDays)} onChange=${v => save({coachDays: Number(v)})}/></span></div>
        <div class="row between fx-bell-row"><span>Email people who are away</span>
          ${mailOk ? (M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="pm-mail" size="sm" badge=${false} offLabel="No email" onLabel="Email when away" pressed=${P.mail} onChange=${v => save({mail: !!v})}/>` : null)
            : html`<span class="tiny ink62" id="pm-mail">Email works on the team site.</span>`}</div>
        <div class="pm-ladder-strip" aria-label="The ladder">
          <span><b class="num">${start}</b> start</span><span><b class="num">${fmt(t0)}</b> nudge</span><span><b class="num">${fmt(t0 + P.wait)}</b> manager</span><span><b class="num">${P.digestAt}</b> note up the line</span>
        </div>
      </div>
      <div class="pm-audit-wrap">
        <button type="button" class="linky small" aria-expanded=${show} onClick=${() => setShow(!show)}>${show ? 'Hide this week' : 'This week, per manager'}</button>
        ${a ? html`<div id="pm-audit">
          <div class="pm-zero row">${[['hours', 'rang outside hours'], ['budget', 'rang over budget'], ['early', 'a manager heard inside the window'], ['offday', 'rang on a day off'], ['ruleoff', 'chased with its rule off']].map(([k, l]) =>
            html`<span key=${k} class=${'pill ' + (Z[k] ? 'flame' : 'ink')} data-zero=${k}>${l}: ${Z[k]}</span>`)}</div>
          <div class="tbl-wrap"><table class="tbl pm-audit">
            <thead><tr><th>Manager</th><th>Bot</th><th>Nudges</th><th>Sorted first</th><th>Reached them</th><th>Up a level</th><th>Let go</th><th>Again</th><th>Disputes</th><th>Paused</th></tr></thead>
            <tbody>${a.rows.map(r => html`<tr key=${r.uid} data-uid=${r.uid}>
              <td><${UI.Name} id=${r.uid}/><div class="tiny ink62">${r.team} ${r.team === 1 ? 'report' : 'reports'}, waits ${r.wait}m</div></td>
              <td><button type="button" class=${'pill' + (!P.off[r.uid] ? ' ink' : '')} data-bot=${r.uid} aria-pressed=${!P.off[r.uid]} aria-label=${'Bot for this manager: ' + (P.off[r.uid] ? 'off' : 'on')} onClick=${() => save({off: {[r.uid]: P.off[r.uid] ? null : true}})}>${P.off[r.uid] ? 'off' : r.on ? 'on' : !P.on ? 'on with the switch' : 'off by them'}</button></td>
              <td class="num">${r.nudges}</td><td class="num">${r.sorted}</td><td class="num">${r.mgr}</td><td class="num">${r.up}</td><td class="num">${r.letgo}</td><td class="num">${r.again}</td><td class="num">${r.disputes}</td>
              <td class="small">${r.paused.length ? r.paused.map((u, i) => html`<span key=${u}>${i ? ', ' : ''}<${UI.Name} id=${u}/></span>`) : r.coach.length ? html`<span class="ink62">coach days: ${r.coach.length}</span>` : html`<span class="ink62">none</span>`}${r.kindsOff && r.kindsOff.length ? html`<div class="tiny ink62">does not chase: ${r.kindsOff.map(k => KIND_NAME[k]).join(', ')}</div>` : null}</td>
            </tr>`)}</tbody>
          </table></div>
          <div class="tiny ink62">Only you can switch a manager's bot off. Every pause a manager sets shows here.</div>
        </div>` : null}
      </div>
    <//>`;
  }
  PmAdminCard.foldTitle = 'Personal managers';
  PmAdminCard.foldSummary = 'the bots that chase each team';
  M.adminCards.push(PmAdminCard);

  /* ---------- Me: a manager's own bot, and the person's view of the bot that chases them ---------- */
  function PmMeCard() {
    const ctx = M.useCtx();
    useNames(ctx);
    const [busy, setBusy] = useState(false);
    const [pauseWho, setPauseWho] = useState('');
    const [pauseTo, setPauseTo] = useState('');
    if (!M.pm || !M.pm.on(ctx) || !ctx.uid) return null;
    const P = M.pm.P(ctx);
    const reps = M.lines.reportsOf(ctx, ctx.uid);
    const mgr = M.lines.managerOf(ctx, ctx.uid);
    if (!reps.length && !mgr) return null;
    const cfg = M.pm.cfgOf(ctx, ctx.uid);
    const on = M.pm.botOn(ctx, ctx.uid);
    const set = async patch => {
      setBusy(true);
      try { const r = await M.pm.setCfg(ctx, patch); M.toast(r.next ? 'Saved. It starts tomorrow, so nobody is caught out today.' : 'Saved'); } catch (e) { M.toast((e && e.message) || 'That did not save.', true); }
      setBusy(false);
    };
    const nx = cfg.next && cfg.next.from > U.todayStr() ? cfg.next : null;
    const preview = M.pm.COPY[cfg.voice].noin({rep: reps[0] ? M.pm.first(ctx, reps[0]) : 'Prathna', start: ctx.settings.start || '10:30', mgr: M.pm.first(ctx, ctx.uid)});
    const meDoc = ((ctx.coll.me.map[ctx.uid] || {}).pm) || {};
    const theirs = mgr ? M.pm.cfgOf(ctx, mgr) : null;
    const chases = theirs ? M.pm.BOT_KINDS.filter(k => theirs.kinds[k]).map(k => KIND_NAME[k]) : [];
    const log = mgr ? M.pm.log(ctx, ctx.uid, 8).filter(d => d.items.length) : [];
    return html`<${UI.Card} id="pm-me" title=${reps.length ? 'Your bot' : M.pm.botName(ctx, mgr)} action=${html`<${Bot} size=${28} state=${on || !reps.length ? 'default' : 'sleeping'} label="bot"/>`}>
      ${reps.length ? html`<div class="stack tight pm-me-mgr">
        <div class="row between fx-bell-row"><span>Your bot</span>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="pm-bot-on" size="sm" badge=${false} offLabel="Turn on your bot" onLabel="Your bot is on" pressed=${on} disabled=${busy || P.require || !!P.off[ctx.uid]} onChange=${v => set({on: !!v})}/>` : null}</div>
        ${P.require ? html`<div class="tiny ink62">${P.off[ctx.uid] ? 'Kaavish has switched your bot off.' : 'Every manager has one. Only Kaavish can switch it off; you can pause it for one person.'}</div>` : null}
        <div class="pm-admin-row"><div class="small" style=${{marginBottom: '6px'}}>It chases</div>
          <div class="row pm-kinds" id="pm-bot-kinds">${M.pm.BOT_KINDS.filter(k => P.kinds[k]).map(k => html`<button type="button" key=${k} class=${'pill' + (cfg.kinds[k] ? ' ink' : '')} data-kind=${k} aria-pressed=${cfg.kinds[k]} disabled=${busy} onClick=${() => set({kinds: {[k]: !cfg.kinds[k]}})}>${KIND_NAME[k]}</button>`)}</div></div>
        <div class="row between pm-admin-row"><span>It waits before you hear</span>
          <span id="pm-bot-wait"><${UI.Seg} sm=${true} ariaLabel="It waits" options=${WAITS.filter(w => w.v >= P.waitMin && w.v <= P.waitMax).map(w => ({v: String(w.v), label: w.label}))} value=${String(cfg.wait)} onChange=${v => set({wait: Number(v)})}/></span></div>
        <div class="row between pm-admin-row"><span>It sounds</span>
          <span id="pm-bot-voice"><${UI.Seg} sm=${true} ariaLabel="It sounds" options=${[{v: 'warm', label: 'Warm'}, {v: 'brief', label: 'Brief'}]} value=${cfg.voice} onChange=${v => set({voice: v})}/></span></div>
        <div class="pm-preview row nowrap"><${Bot} size=${24} label="preview"/><span class="small">${preview}</span></div>
        ${standalone() ? html`<div class="row between fx-bell-row"><span>Email them when they are away</span>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="pm-bot-mail" size="sm" badge=${false} offLabel="No email" onLabel="Email when away" pressed=${cfg.mail} onChange=${v => set({mail: !!v})}/>` : null}</div>` : null}
        <div class="pm-admin-row"><div class="small" style=${{marginBottom: '6px'}}>${P.require ? 'Pause for a person, today only' : 'Pause for a person until'}</div>
          <div class="row" id="pm-bot-pause">
            <select class="input pm-sel" aria-label="Who" value=${pauseWho} onChange=${e => setPauseWho(e.target.value)}>
              <option value="">Pick a person</option>${reps.map(u => html`<option key=${u} value=${u}>${M.pm.first(ctx, u)}</option>`)}
            </select>
            ${P.require ? null : html`<input type="date" class="input pm-time" aria-label="Until" min=${U.todayStr()} value=${pauseTo} onInput=${e => setPauseTo(e.target.value)}/>`}
            <${UI.Btn} sm=${true} kind="sec" disabled=${busy || !pauseWho || (!P.require && !pauseTo)} onClick=${() => set({pause: {[pauseWho]: P.require ? U.todayStr() : pauseTo}}).then(() => { setPauseWho(''); setPauseTo(''); })}>${P.require ? 'Pause today' : 'Pause'}<//>
          </div>
          ${P.require ? html`<div class="tiny ink62">Kaavish sees every pause.</div>` : null}
          ${Object.keys(cfg.pause).filter(u => cfg.pause[u] >= U.todayStr()).map(u => html`<div class="row between small" key=${u}><span>${M.pm.first(ctx, u)}, paused until ${U.fmtDay(cfg.pause[u])}</span><button type="button" class="linky tiny" onClick=${() => set({pause: {[u]: null}})}>Resume</button></div>`)}
        </div>
        ${nx ? html`<div class="tiny ink62">From ${U.fmtDay(nx.from)}: ${nx.wait ? 'waits ' + nx.wait + ' minutes' : ''}${nx.wait && nx.kinds ? ', ' : ''}${nx.kinds ? 'also chases ' + Object.keys(nx.kinds).map(k => KIND_NAME[k]).join(', ') : ''}.</div>` : null}
        <div class="tiny ink62">Shorter waits and new kinds start tomorrow, so nobody is caught out today. Your team sees every nudge your bot sends, and when you were told.</div>
      </div>` : null}
      ${mgr ? html`<div class="stack tight pm-me-rep" id="pm-me-bot">
        ${reps.length ? html`<div class="micro">${M.pm.botName(ctx, mgr)}</div>` : null}
        <div class="small">It works for ${M.pm.first(ctx, mgr)}. ${chases.length ? 'Chases ' + chases.join(', ') + '. ' : ''}You get ${theirs.wait} minutes. At most ${P.perDay} bubbles a day, never outside your hours.</div>
        ${standalone() ? html`<div class="row between fx-bell-row"><span>Email me when I am away</span>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="pm-mymail" size="sm" badge=${false} offLabel="No email" onLabel="Email when away" pressed=${meDoc.mail !== false} onChange=${v => M.pm.setMail(ctx, !!v).catch(() => {})}/>` : null}</div>`
          : html`<div class="tiny ink62" id="pm-mymail">Email when you are away works on the team site.</div>`}
        <div class="pm-me-log">${log.length ? log.map(d => html`<div key=${d.ymd} class="small"><span class="tiny ink62 num">${U.fmtDay(d.ymd)}</span> ${d.items.map(it => it.label).join(', ')}</div>`) : html`<div class="tiny ink62">Nothing from the bot in the last 8 days.</div>`}</div>
        <div class="tiny ink62">Mute its sound and notices under Your m360. The card and the inbox still show.</div>
      </div>` : null}
    <//>`;
  }
  M.meCards.push(PmMeCard);

  M.parts.PmWatch = PmWatch;
  M.parts.PmCard = PmCard;
  M.parts.PmRow = PmRow;
  M.parts.PmChip = PmChip;
  M.parts.PmFlagChip = PmFlagChip;
  M.parts.PmTeamHead = PmTeamHead;
  M.parts.PmTeamExtra = PmTeamExtra;
  M.parts.PmLog = PmLog;
  M.parts.PmChaseButton = PmChaseButton;
  M.parts.PmDmRows = PmDmRows;
  M.parts.PmMirror = PmMirror;
  M.parts.PmAskReceipt = PmAskReceipt;
  M.parts.PmAdminCard = PmAdminCard;
  M.parts.PmMeCard = PmMeCard;
})();
