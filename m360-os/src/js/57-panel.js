/* module: panel. The one Ask m360 panel, in three sizes: the pop-up that grows out of the buddy in the
   dock, the drawer when you expand it, and the sheet on a phone. All three show the same thread
   (M.chat) and run the same loop, M.assistant.ask: the agent's own grammar first, with no model call
   (nudge people by a condition, open a screen, check in or out, set a status, focus, undo), and
   otherwise one prompt with the screen, the person's data and every tool they may use. A sticky head
   (the character, what it is doing, conversation, expand, the menu, close), a body that scrolls on its
   own with long answers and long receipt lists folded, a tray for what waits on a tap, and a sticky
   composer. Sizes come from CSS alone (99-dock.css), so a resize or a zoom never leaves it stale. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef, useLayoutEffect} = React;

  const MEMBER_CHIPS = ['What should I do next?', "What's overdue on me?", 'Summarise my week', 'Add a task for me to follow up with the client tomorrow'];
  const FOUNDER_CHIPS = ["Who's overloaded right now?", "What's slipping this week?", 'Which client needs love?', "Draft Monday's plan meeting agenda", "Who's been late this week?"];
  const OFFLINE_LINE = 'I can still: open a screen, nudge people by a condition, check you in or out, set a status, start focus.';
  const OFFLINE_CHIPS = ['Who has not checked out?', 'Nudge everyone who has not checked in', 'Check me out', 'Start focus for 25'];

  /* ids per size, so tests and the tour can find each control: buddy- for the pop-up, ask- for the
     drawer, orb- for the phone sheet; HQ's inline card keeps the -inline suffix */
  const PREFIX = {pop: 'buddy', drawer: 'ask', inline: 'ask', sheet: 'orb'};
  const idFor = (size, k) => size === 'inline' ? 'ask-' + k + '-inline' : PREFIX[size] + '-' + k;

  /* ---------- icons the panel alone needs ---------- */
  const svg = d => () => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const Speaker = svg(html`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.3 6.6a7.6 7.6 0 0 1 0 10.8"/>`);
  const Phones = svg(html`<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.6"/><rect x="16.5" y="14" width="4" height="6" rx="1.6"/>`);
  const Expand = svg(html`<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>`);
  const Down = svg(html`<path d="M12 5v14M6 13l6 6 6-6"/>`);
  const Mic = svg(html`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>`);

  /* ---------- the session: one turn in flight at a time, shared by every size ---------- */
  const S = M.assistant = M.assistant || {};
  Object.assign(S, {
    st: {phase: 'idle', heard: '', live: '', acts: [], err: '', chips: null, conv: false, speaking: false, announce: '', title: ''},
    subs: new Set(),
    turn: null,
    promptAt: 0,
    ctl: null,
    set(patch) { S.st = {...S.st, ...patch}; S.subs.forEach(f => { try { f(); } catch (e) { /* a view went away */ } }); },
    /* the dock (58-buddy.js) registers these; without it, Ask opens wide */
    opener: null,
    closer: null,
    open(initial) {
      if (S.opener) return S.opener(initial || '');
      try { window.dispatchEvent(new CustomEvent('m360:askwide', {detail: {initial: initial || ''}})); } catch (e) { /* none */ }
    },
    close() { if (S.closer) S.closer(); },
    expand() {
      if (S.closer) S.closer(true);
      try { window.dispatchEvent(new CustomEvent('m360:askwide', {detail: {initial: ''}})); } catch (e) { /* none */ }
    },
    /* the turn in flight stops, and no longer counts as in flight: a new one may start at once */
    stop() { const c = S.ctl; S.ctl = null; if (c) c.abort(); },
    /* a spoken line stays short: twelve words, or the first sentence and a pointer to the screen */
    spoken(text) {
      const t = String(text || '').replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim();
      const words = t.split(' ');
      if (words.length <= 12) return t;
      const first = (/^.+?[.?]\s/.exec(t + ' ') || [''])[0].trim();
      return (first && first.split(' ').length <= 20 ? first : words.slice(0, 12).join(' ') + '.') + ' The rest is on screen.';
    }
  });
  const useSession = () => {
    const [, setN] = useState(0);
    useEffect(() => { const f = () => setN(n => n + 1); S.subs.add(f); return () => { S.subs.delete(f); }; }, []);
    return S.st;
  };

  /* without the agent (an older page), the tier and the tool order come from a few words */
  const ORDER = {
    how: ['point_at', 'go_to', 'walk_through', 'click', 'look_up', 'act'],
    task: ['act', 'look_up', 'point_at', 'go_to', 'click', 'search_everything', 'search_base', 'who_do_we_know_at'],
    do: ['point_at', 'go_to', 'click', 'type_into', 'select_option', 'press_key', 'walk_through', 'act', 'look_up'],
    look: ['look_up', 'act', 'search_everything', 'search_base', 'who_do_we_know_at', 'pipeline_for', 'point_at', 'go_to'],
    where: ['point_at', 'go_to', 'click', 'look_up', 'act', 'walk_through', 'search_everything', 'search_base']
  };
  function plainRoute(text) {
    const q = String(text || '').toLowerCase();
    const intent = /show me how|how do i|how to|walk me|teach me/.test(q) ? 'how'
      : /\b(task|assign|remind|remember|note|post|kudos|message|tell |dm|send|check me|eod|leave|pitch|client|meeting|mail|approve)\b/.test(q) ? 'task'
      : /\b(open|close|create|start|switch|fill|type|make|add|set|choose|select|go to|turn on|turn off)\b/.test(q) ? 'do'
      : /\b(who|how many|what|when|overdue|find|search|summar|help)\b/.test(q) ? 'look' : 'where';
    return {grammar: null, intent, tier: intent === 'look' ? 'quick' : 'default', order: ORDER[intent].slice()};
  }

  function instructions(ctx, me, here) {
    return 'You are m360, the assistant that lives in the dock of the m360 OS, next to the person\'s work. ' +
      'They are ' + me + (ctx.isFounder ? ', the founder' : '') + '. They are on the ' + (here || 'home') + ' section.\n' +
      'Rules: answer the way a sharp, warm colleague would say it: plain words, contractions, a little warmth. One to three short sentences; short bullets only when you list; no headings. ' +
      'When the answer lives on screen, or they ask where or how, call point_at first with the best element id, then answer. If it lives in another section, call go_to, then point_at. ' +
      'When they ask you to do something on screen (open, close, switch, fill, choose), do it with click, type_into, select_option and press_key, step by step, reading the SCREEN each tool returns, then say in one line what you did. ' +
      'When they ask you to make or change something (a task, a note, a post, kudos, a message, an ask to people, leave, check-in, EOD, the week, a pitch, a client, a reminder, mail, a meeting, a setting) use act; when act comes back waiting, say it is ready for their tap or a spoken yes. ' +
      'When they ask about anything THEIR DATA does not say, call look_up first; never guess a number or a name. ' +
      'When they say remember, act remember; the things you remember are below, use them. ' +
      'When they ask how to do something with more than one step, go_to the right section if needed, then call walk_through with the steps, then answer in one line. ' +
      'Read the [state] tags on screen (selected, value, checked, on) before answering about what is set. ' +
      'Never press a risky control; point at it and say so. Never invent ids; use names and titles. When a photo or screenshot is attached, read it and use it. When they ask what you can do, say it in two sentences from the list below.\n' +
      (M.brain ? M.brain.catalog(ctx) : '');
  }

  /* the COO's answers this session, by their words (the saved thread keeps the words alone) */
  const cooSaid = new Set();

  /* ---------- the loop: one ask, any size ---------- */
  /* o: {via: 'typed'|'voice', size, onText(text), onAct(line), signal, images}. Resolves {text, turn,
     grammar?, waiting?, chips?, err?}; a cancelled turn rejects with code 'cancelled' */
  async function ask(ctx, text, o) {
    o = o || {};
    const question = String(text || '').trim();
    const nm = await M.ai.names(ctx).catch(() => ({}));
    const turn = {id: U.uid(), via: o.via === 'voice' ? 'voice' : 'typed', tainted: false, said: question.slice(0, 300)};
    S.turn = turn;
    S.turnIds = (S.turnIds || []).concat([turn.id]).slice(-40);
    const pics = o.images || [];
    const route = M.agent && M.agent.route ? M.agent.route(question, ctx, nm) : plainRoute(question);
    /* the grammar runs with no model call, with the AI on or off */
    if (route.grammar && M.agent.runGrammar && !pics.length) {
      const g = await M.agent.runGrammar(ctx, nm, route.grammar, turn, o.onAct);
      if (o.onText) o.onText(g.text);
      /* an answer the m360 COO gave carries its face in the thread */
      const coo = /^coo_/.test(route.grammar.action) && !g.error;
      if (coo) cooSaid.add(g.text);
      return {text: g.text, turn, grammar: true, waiting: !!g.waiting, err: !!g.error, coo};
    }
    if (!M.ai.on(ctx)) return {text: '', turn, err: M.ai.errCopy('not_declared') + ' ' + OFFLINE_LINE, chips: offline()};
    const gone = () => { if (o.signal && o.signal.aborted) throw Object.assign(new Error('cancelled'), {code: 'cancelled'}); };
    const data = ctx.isFounder ? await M.ai.teamSlice(ctx) : (await M.ai.meSlice(ctx)) + '\n\n' + (await M.ai.teamSlice(ctx));
    const here = M.resolveRoute ? M.resolveRoute(M.parseHash().page, null, ctx.isFounder) : {s: ''};
    const scr = S.screenTools ? S.screenTools(ctx, {log: o.onAct || (() => {}), signal: o.signal, size: o.size}) : null;
    const screen = scr ? scr.scan() : '';
    const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
    gone();
    const brainTools = M.brain ? M.brain.tools(ctx, nm, o.onAct || (() => {}), turn) : M.ai.tools(ctx, nm, o.onAct || (() => {}));
    const all = (scr ? scr.tools : []).concat(brainTools);
    const first = route.order.map(n => all.find(t => t.name === n)).filter(Boolean);
    const ordered = first.concat(all.filter(t => first.indexOf(t) < 0));
    const max = lim && lim.tools ? (lim.tools.maxCount && lim.tools.maxCount > 0 ? lim.tools.maxCount : ordered.length) : 0;
    const mem = M.brain ? M.brain.memoryLines(M.brain.memoryOf(await M.brain.readAi(ctx))) : '';
    gone();
    const past = M.chat.recent(8).filter(t => t.content !== question).slice(-6).map(t => (t.role === 'user' ? 'They: ' : 'You: ') + String(t.content).slice(0, 300)).join('\n');
    const prompt = M.ai.VOICE + instructions(ctx, nm[ctx.uid] || 'a teammate', here.s) + '\n\n' +
      (mem ? mem + '\n\n' : '') + (M.chat.summary ? 'EARLIER, IN SHORT:\n' + M.chat.summary + '\n\n' : '') +
      (past ? 'EARLIER IN THIS CHAT:\n' + past + '\n\n' : '') +
      (screen ? 'SCREEN (id | kind | label | area):\n' + screen.slice(0, 9000) + '\n\n' : '') +
      'THEIR DATA:\n' + data.slice(0, 22000) + '\n\n' +
      'THEY SAID: ' + (pics.length ? (question || 'Look at what is attached and tell me what matters.') + ' (' + pics.length + (pics.length === 1 ? ' image attached)' : ' images attached)') : question);
    const out = await ctx.sample(prompt, {signal: o.signal, modelTier: route.tier, tools: max ? ordered.slice(0, max) : undefined,
      onText: ({text: t}) => { if (o.onText) o.onText(clean(t)); }, ...(pics.length ? {images: pics} : {}), ...(max ? {} : {cache: false})});
    return {text: clean(out.text), turn, walk: scr && scr.walking ? scr.walking() : null};
  }
  const clean = t => String(t || '').replace(/\u2014|\u2013/g, ', ');
  const offline = () => (M.agent && M.agent.OFFLINE ? M.agent.OFFLINE.chips : OFFLINE_CHIPS).slice(0, 4);

  /* ---------- send: the thread, the live state and the receipts around one ask ---------- */
  /* o: {via, size, images: [blob], dock (the dock speaks and listens again), micAt} */
  async function send(ctx, text, o) {
    o = o || {};
    const msg = String(text || '').trim();
    const pics = o.images || [];
    if ((!msg && !pics.length) || S.st.phase === 'thinking' || S.ctl) return null;
    const voice = o.via === 'voice';
    const before = M.chat.turns.slice();
    /* a spoken yes or no answers the one card this turn left waiting, and nothing else */
    if (voice && M.agent && M.brain && M.brain.pending) {
      /* the Talk button of the wide drawer does not say when it opened: the microphone does */
      const micAt = o.micAt != null ? o.micAt : M.mic && M.mic.startedAt ? M.mic.startedAt() : 0;
      const yes = M.agent.yesFor ? M.agent.yesFor(ctx, msg, {turn: S.turn, at: Date.now(), promptAt: S.promptAt, micAt, spokeEnd: M.speech && M.speech.endedAt ? M.speech.endedAt() : 0}) : null;
      const mine = S.turn ? M.brain.pending.list.filter(p => !p.busy && p.turn === S.turn.id) : [];
      const no = !yes && M.agent.isNo && M.agent.isNo(msg) && mine.length === 1 && Date.now() - Math.max(mine[0].at || 0, S.promptAt) < 15000;
      if (yes || no) {
        M.chat.save(ctx, before.concat([{role: 'user', content: msg, via: 'voice'}]));
        let line = 'Cancelled. Nothing went out.';
        /* the card's own words when it has them; a plain Done otherwise (a pressed control sent nothing) */
        let acts = [];
        if (yes) { const r = await M.brain.approve(yes, 'voice'); line = (r && typeof r === 'object' && r.say) || 'Done.'; acts = receiptsOf(r); }
        else M.brain.drop(mine[0].id);
        await M.chat.append(ctx, [{role: 'assistant', content: line, ...(acts.length ? {acts} : {})}]);
        S.set({phase: 'answer', heard: '', announce: line});
        done({text: line, via: o.via, dock: o.dock, confirm: true});
        return {text: line};
      }
    }
    const shown = msg || 'Look at this.';
    M.chat.save(ctx, before.concat([{role: 'user', content: shown, ...(pics.length ? {img: true} : {}), ...(voice ? {via: 'voice'} : {})}]));
    /* "DM:" with screenshots: the Handshake desk reads the names and writes the messages */
    if (/^dm:/i.test(msg) && pics.length && M.handshake && ctx.isFounder) {
      S.set({phase: 'thinking', live: '', err: '', chips: null});
      try {
        const r = await M.handshake.fromAsk(ctx, pics, msg);
        await M.chat.append(ctx, [{role: 'assistant', content: 'Handshake has ' + r.added.length + (r.added.length === 1 ? ' new person' : ' new people') + (r.dupes.length ? ' (already in: ' + r.dupes.join(', ') + ')' : '') + '. Writing now; the messages land under Accounts, Handshake.'}]);
        S.set({phase: 'answer'});
      } catch (e) { S.set({phase: 'answer', err: 'The desk could not read that: ' + ((e && e.message) || 'unknown')}); }
      return null;
    }
    const c = new AbortController();
    S.ctl = c;
    const acts = [];
    const onAct = a => { if (a == null || a === '') return; acts.push(a); S.set({acts: acts.slice()}); };
    S.set({phase: 'thinking', live: '', acts: [], err: '', chips: null, announce: ''});
    try {
      const r = await ask(ctx, msg, {via: o.via, size: o.size, images: pics, signal: c.signal, onAct, onText: t => { if (S.ctl === c) S.set({live: t}); }});
      /* stopped while the answer came back: what it already did stays on record */
      if (S.ctl !== c) { if (acts.length) await M.chat.append(ctx, [{role: 'assistant', content: 'Stopped.', acts}]); return null; }
      S.ctl = null;
      if (r.err && !r.text) {
        S.set({phase: 'answer', live: '', acts: [], err: r.err, chips: r.chips || null, announce: r.err});
        done({text: r.err, via: o.via, dock: o.dock, err: true});
        return r;
      }
      await M.chat.append(ctx, [{role: 'assistant', content: r.text || 'Done.', ...(acts.length ? {acts} : {})}]);
      S.set({phase: 'answer', live: '', acts: [], announce: r.text || 'Done.'});
      if (!r.grammar && M.brain) M.brain.compact(ctx).catch(() => {});
      if (!o.dock && M.prefs.get('askAloud', '0') === '1' && M.speech) M.speech.say(r.text, o.lang || 'en').catch(() => {});
      done({text: r.text, via: o.via, dock: o.dock, walk: r.walk, waiting: r.waiting, turn: r.turn});
      return r;
    } catch (e) {
      const code = (e && e.code) || 'upstream_error';
      const mine = S.ctl === c;
      if (mine) S.ctl = null;
      if (acts.length) await M.chat.append(ctx, [{role: 'assistant', content: code === 'cancelled' || !mine ? 'Stopped.' : '', acts}]);
      /* stopped: the state is only put back when nothing new (listening, another turn) has taken over */
      if (code === 'cancelled' || !mine) { if (S.st.phase === 'thinking' && !S.ctl) S.set({phase: 'answer', live: '', acts: []}); return null; }
      const off = M.ai.isOff(code) || code === 'rate_limited' || /limit|quota|cap/.test(code);
      const line = (e && e.text ? e.text + '\n\n' : '') + M.ai.errCopy(code) + (off ? ' ' + OFFLINE_LINE : '');
      S.set({phase: 'answer', live: '', acts: [], err: line, chips: off ? offline() : null, announce: line});
      done({text: line, via: o.via, dock: o.dock, err: true});
      return null;
    }
  }
  const done = detail => { try { window.dispatchEvent(new CustomEvent('m360:answer', {detail})); } catch (e) { /* none */ } };
  S.ask = ask;
  S.send = send;

  /* ---------- pieces of the thread ---------- */
  /* the words as they are said, rising one by one */
  function Words({text, quiet, id}) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    return html`<div class=${'orb-heard panel-heard msg' + (quiet ? ' quiet' : '')} id=${id} aria-live="off">${words.map((w, i) => html`<${React.Fragment} key=${i}><span class="orb-w">${w}</span>${i < words.length - 1 ? ' ' : ''}<//>`)}</div>`;
  }

  /* an answer longer than twelve lines shows eight, and Show all */
  function Answer({text, id, coo}) {
    const ref = useRef(null);
    const [long, setLong] = useState(false);
    const [open, setOpen] = useState(false);
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 21;
      setLong(el.scrollHeight > lh * 12.5);
    }, [text]);
    const Face = coo && M.parts.CooFace;
    return html`<div class=${'bubble ai panel-answer msg' + (long && !open ? ' folded' : '')} id=${id} data-coo=${coo ? '1' : undefined}>
      ${Face ? html`<div class="row nowrap tiny ink62 panel-coo"><${Face} size=${22}/><span>${M.coo.title(M.lastCtx)}</span></div>` : null}
      <div ref=${ref} class="panel-answer-in"><${M.AIText} text=${text}/></div>
      ${long ? html`<button type="button" class="linky tiny panel-more" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? 'Show less' : 'Show all'}</button>` : null}
    </div>`;
  }

  /* the words while they stream: what was already there stays, the new words fade up */
  function Streaming({text}) {
    const prev = useRef('');
    const old = text.startsWith(prev.current) ? prev.current : '';
    useEffect(() => { prev.current = text; });
    return html`<div class="bubble ai panel-answer streaming msg"><span>${old}</span><span key=${text.length} class="fresh">${text.slice(old.length)}</span></div>`;
  }

  /* what a card sent, as receipts for the thread: an ask is the personal manager's live receipt */
  function receiptsOf(r) {
    if (!r || typeof r !== 'object' || r.ok === false) return [];
    const ids = Array.isArray(r.askIds) ? r.askIds : r.askId ? [r.askId] : [];
    return ids.map(askId => ({type: 'ask', askId, text: 'Asked'}));
  }
  /* a card a panel turn made, approved by a tap: its line and receipt join the thread under that turn */
  window.addEventListener('m360:approved', e => {
    const d = (e && e.detail) || {};
    if (d.how !== 'tap' || !d.turn || !M.chat || !M.lastCtx || (S.turnIds || []).indexOf(d.turn) < 0) return;
    const acts = receiptsOf(d.result);
    const say = d.result && typeof d.result === 'object' && d.result.say ? String(d.result.say) : '';
    if (!acts.length && !say) return;
    M.chat.append(M.lastCtx, [{role: 'assistant', content: say, ...(acts.length ? {acts} : {})}]);
  });

  /* receipts, folded by group: the agent's own view when it is here, the same shape otherwise */
  function Receipts({acts}) {
    const R = M.parts.AgentReceipts;
    /* the agent's view folds groups; past three plain lines the panel's own fold takes over */
    const plain = (acts || []).filter(x => !(x && typeof x === 'object' && (x.group || x.type === 'ask'))).length;
    if (R && plain <= 3) return html`<div class="msg panel-receipts"><${R} acts=${acts}/></div>`;
    return html`<div class="msg panel-receipts"><${Folded} acts=${acts}/></div>`;
  }
  function Folded({acts}) {
    const [open, setOpen] = useState({});
    const items = [];
    for (const x of acts || []) {
      if (x && typeof x === 'object' && x.group) {
        const last = items[items.length - 1];
        if (last && last.group === x.group) last.rows.push(x); else items.push({group: x.group, rows: [x]});
      } else items.push({one: x});
    }
    /* plain lines past three fold too, so ten acts never push the composer away */
    const lines = items.filter(it => !it.group);
    const many = lines.length > 3;
    const shut = k => !open[k];
    const flip = k => setOpen(o => ({...o, [k]: !o[k]}));
    const one = (x, i) => x && typeof x === 'object' && x.type === 'ask' && M.parts.PmAskReceipt
      ? html`<${M.parts.PmAskReceipt} key=${'a' + i} askId=${x.askId}/>`
      : html`<div key=${'s' + i} class="agent-receipt one tiny"><span class="spark">✦</span> ${typeof x === 'string' ? x : (x && x.text) || ''}</div>`;
    return html`<div class="agent-receipts">
      ${many ? html`<div class=${'agent-receipt' + (shut('lines') ? '' : ' open')} data-group="lines">
        <button type="button" class="agent-receipt-toggle" aria-expanded=${!shut('lines')} onClick=${() => flip('lines')}>
          <span class="grow small">${'Did ' + lines.length + ' things'}</span><span class="chev" aria-hidden="true"><${M.icons.chevD}/></span></button>
        ${shut('lines') ? null : html`<div class="agent-receipt-rows">${lines.map((it, j) => html`<div key=${j} class="agent-receipt-row" style=${{animationDelay: (j * 60) + 'ms'}}>${one(it.one, j)}</div>`)}</div>`}
      </div>` : lines.map((it, i) => one(it.one, i))}
      ${items.filter(it => it.group).map((it, i) => {
        const k = it.group + i, n = it.rows.length;
        return html`<div key=${k} class=${'agent-receipt' + (shut(k) ? '' : ' open')} data-group=${it.group}>
          <button type="button" class="agent-receipt-toggle" aria-expanded=${!shut(k)} onClick=${() => flip(k)}>
            <span class="agent-receipt-faces">${it.rows.slice(0, 2).map(r => html`<${UI.Avatar} key=${r.who} id=${r.who} size=${20}/>`)}${n > 2 ? html`<span class="agent-receipt-more tiny">+${n - 2}</span>` : null}</span>
            <span class="grow small">${n === 1 ? it.rows[0].text : (it.group === 'message' ? 'Messaged ' : it.group === 'ask' ? 'Asked ' : it.group + ' ') + n + ' people'}</span>
            <span class="chev" aria-hidden="true"><${M.icons.chevD}/></span></button>
          ${shut(k) ? null : html`<div class="agent-receipt-rows">${it.rows.map((r, j) => html`<div key=${j} class="agent-receipt-row" data-uid=${r.who || ''} style=${{animationDelay: (j * 60) + 'ms'}}><span class="tick" aria-hidden="true"/><span class="grow tiny">${r.text || ''}</span></div>`)}</div>`}
        </div>`;
      })}
    </div>`;
  }

  /* one wrapper for the whole page's life, so the composer is never remounted (and the caret never lost) */
  const Plain = ({children}) => children;

  /* the Talk button the dock drives (push to talk, conversation), in the same pill as the plain one */
  function TalkButton({id, talk}) {
    const can = talk.can;
    const btn = html`<button type="button" id=${id} class=${'btn sec micbtn sm' + (talk.live ? ' live' : '')} aria-pressed=${!!talk.live}
      aria-label=${talk.live ? 'Listening, tap to stop' : !can ? 'No microphone here. Type your question.' : 'Talk'} title=${!can ? 'No microphone here. Type your question.' : talk.live ? 'Tap to stop' : 'Talk. Hold Ctrl and Option anywhere to talk'}
      disabled=${!can || talk.hearing} onClick=${() => talk.live ? talk.stop() : talk.start()}><${M.icons.voice}/>${talk.live ? 'Listening' : talk.hearing ? 'Hearing it' : 'Talk'}</button>`;
    return M.fx && M.fx.VoicePill ? html`<${M.fx.VoicePill} live=${!!talk.live}>${btn}<//>` : btn;
  }

  /* ---------- the panel ---------- */
  /* size: 'pop' | 'drawer' | 'sheet' | 'inline'. The dock passes: talk {live, hearing, can, start, stop},
     conv and onConv, onHide, intro (the hello, the welcome), botState, title, onClose. */
  function AgentPanel({size, initial, onClose, onBusy, intro, talk, conv, onConv, onHide, botState, title, onTour, folded, onUnfold, closing, iosTap}) {
    const ctx = M.useCtx();
    const sz = size || 'pop';
    const id = k => idFor(sz, k);
    const st = useSession();
    const phone = M.usePhone();
    const [turns, setTurns] = useState(() => M.chat.turns);
    useEffect(() => {
      M.chat.watch(ctx);
      const f = () => setTurns(M.chat.turns);
      M.chat.subs.add(f); if (M.chat.ready) f();
      return () => { M.chat.subs.delete(f); };
    }, [ctx.uid, ctx.viewAs]);
    const [q, setQ] = useState('');
    const [view, setView] = useState('chat');
    const [menu, setMenu] = useState(false);
    const [imgs, setImgs] = useState([]);
    const [canImg, setCanImg] = useState(false);
    const [aloud, setAloud] = useState(() => M.prefs.get('askAloud', '0') === '1');
    const [atEnd, setAtEnd] = useState(true);
    const [scrolled, setScrolled] = useState(false);
    const [opening, setOpening] = useState(true);
    const body = useRef(null);
    const input = useRef(null);
    const fileRef = useRef(null);
    const root = useRef(null);
    const busy = st.phase === 'thinking';
    const listening = st.phase === 'listening' || (talk && talk.live);
    const hearing = st.phase === 'hearing';
    const wide = sz === 'drawer' || sz === 'inline';

    useEffect(() => { const t = setTimeout(() => setOpening(false), 420); return () => clearTimeout(t); }, []);
    useEffect(() => { let on = true; if (wide && ctx.sample && ctx.sample.limits) ctx.sample.limits().then(l => { if (on) setCanImg(!!(l && l.images)); }).catch(() => {}); return () => { on = false; }; }, [ctx.sample]);
    useEffect(() => { if (onBusy) onBusy(busy); }, [busy]);
    useEffect(() => { if (initial) go(initial); }, [initial]);
    /* opening puts the caret in the box, unless the dock opened it to listen, or it opened on its own
       with the hello (whatever they were typing keeps the caret) */
    useEffect(() => {
      if (sz === 'inline' || listening || intro) return undefined;
      const t = setTimeout(() => { if (input.current && !(phone && sz === 'sheet')) input.current.focus({preventScroll: true}); }, sz === 'drawer' ? 60 : 30);
      return () => clearTimeout(t);
    }, []);
    useEffect(() => {
      if (!menu) return undefined;
      const f = e => { if (!e.target.closest || !e.target.closest('.panel-menu, .panel-menu-btn')) setMenu(false); };
      /* Escape closes the menu first, and the panel on the next press */
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); } };
      window.addEventListener('pointerdown', f); window.addEventListener('keydown', k, true);
      return () => { window.removeEventListener('pointerdown', f); window.removeEventListener('keydown', k, true); };
    }, [menu]);

    /* the newest line stays in view while the reader is at the end; scrolled up, it leaves them be */
    const onScroll = () => {
      const b = body.current;
      if (!b) return;
      setAtEnd(b.scrollHeight - b.scrollTop - b.clientHeight < 40);
      setScrolled(b.scrollTop > 4);
    };
    useLayoutEffect(() => { const b = body.current; if (b && atEnd) b.scrollTop = b.scrollHeight; }, [turns, st.live, st.acts, st.heard, st.err, view]);
    const jump = () => { const b = body.current; if (b) { b.scrollTo({top: b.scrollHeight, behavior: M.reduced() ? 'auto' : 'smooth'}); setAtEnd(true); } };

    /* height changes ease over 220ms (the content grows; the box follows) */
    const lastH = useRef(0);
    useLayoutEffect(() => {
      const el = root.current;
      if (!el || sz !== 'pop' || M.reduced() || !el.animate) return;
      const h = el.getBoundingClientRect().height;
      if (lastH.current && Math.abs(h - lastH.current) > 8 && !opening) {
        try { el.animate([{height: lastH.current + 'px'}, {height: h + 'px'}], {duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)'}); } catch (e) { /* no WAAPI */ }
      }
      lastH.current = h;
    });

    const go = t => {
      const text = String(t == null ? q : t);
      if (busy || (!text.trim() && !imgs.length)) return;
      setQ(''); setView('chat');
      const pics = imgs.map(p => p.blob);
      setImgs([]);
      setAtEnd(true);
      send(ctx, text, {via: 'typed', size: sz, images: pics});
    };
    const attach = async files => {
      const out = [];
      for (const f of Array.from(files || []).slice(0, 4 - imgs.length)) {
        try { const blob = await M.ai.shrinkImage(f); out.push({blob, url: URL.createObjectURL(blob)}); } catch (e) { M.toast('That file is not an image', true); }
      }
      if (out.length) setImgs(xs => xs.concat(out));
    };
    const flipAloud = () => { const v = !aloud; setAloud(v); M.prefs.set('askAloud', v ? '1' : '0'); if (!v && M.speech) M.speech.stop(); };

    /* the thread: older turns as bubbles, the last exchange with ids the sizes share */
    const lastUser = turns.map(t => t.role).lastIndexOf('user');
    let lastAi = -1;
    turns.forEach((t, i) => { if (t.role === 'assistant' && !t.act && t.content) lastAi = i; });
    const showWords = sz === 'sheet';
    /* on the phone the last thing said stays big until new words come in */
    const liveWords = (listening || hearing) && (!!st.heard || hearing || lastUser < 0);
    const rows = [];
    turns.forEach((t, i) => {
      /* an older thread kept one act per turn: a run of them folds as one receipt */
      if (t.act) {
        if (i > 0 && turns[i - 1].act) return;
        let j = i;
        while (j < turns.length && turns[j].act) j++;
        rows.push(html`<${Receipts} key=${'r' + i} acts=${turns.slice(i, j).map(x => x.content)}/>`);
        return;
      }
      if (t.role === 'user') {
        if (showWords && i === lastUser && !liveWords) rows.push(html`<${Words} key=${'u' + i} text=${t.content} id=${id('heard')}/>`);
        else rows.push(html`<div key=${'u' + i} class="bubble me msg">${t.img ? html`<span class="tiny panel-img">[image] </span>` : null}${t.content}${t.via === 'voice' ? html`<span class="panel-via" title="said out loud"><${Mic}/></span>` : null}</div>`);
        return;
      }
      if (t.content) rows.push(html`<${Answer} key=${'a' + i} text=${t.content} coo=${cooSaid.has(t.content)} id=${i === lastAi && !busy ? id('answer') : undefined}/>`);
      if (t.acts && t.acts.length) rows.push(html`<${Receipts} key=${'k' + i} acts=${t.acts}/>`);
    });
    const empty = !turns.length && !busy && !st.err;
    const chips = ctx.isFounder ? FOUNDER_CHIPS : MEMBER_CHIPS;
    const hasTable = sz === 'pop' && lastAi >= 0 && /^\s*\|.+\|\s*$/m.test(turns[lastAi].content);

    const state = title || (listening ? 'Listening' : hearing ? 'Hearing it' : busy ? 'Thinking' : st.speaking ? 'Speaking' : 'm360');
    const Bot = M.fx && M.fx.Bot;
    const head = sz === 'pop' || sz === 'sheet' ? html`<div class="panel-head">
      ${sz === 'sheet' ? html`<div class="sheet-handle panel-grab" aria-hidden="true"><i/></div>` : null}
      <span class="panel-who">
        ${sz === 'sheet' && !(listening && empty) && M.fx && M.fx.Orb && (listening || busy) ? html`<${M.fx.Orb} state=${listening ? 'listening' : 'working'} size=${32} label=${listening ? 'listening' : 'thinking'}/>`
          : Bot ? html`<${Bot} type="droid" size=${32} state=${busy ? 'working' : botState === 'sleeping' ? 'sleeping' : 'default'} headphones=${!!(conv || listening)} label="m360" className="panel-bot"/>` : null}
        <span class="panel-state micro" aria-live="off">${state}</span>
      </span>
      <span class="panel-tools">
        ${onConv ? html`<button type="button" class=${'iconbtn panel-conv' + (conv ? ' on' : '')} id=${id('conv')} aria-pressed=${!!conv} aria-label="Conversation mode" title=${conv ? 'Conversation is on. It listens after each answer.' : 'Conversation: it listens again after each answer'} onClick=${onConv}><${Phones}/></button>` : null}
        ${sz === 'pop' ? html`<button type="button" class="iconbtn" id=${id('expand')} aria-label="Open wide" title="Open wide" onClick=${() => S.expand()}><${Expand}/></button>` : null}
        <span class="panel-menu-wrap">
          <button type="button" class="iconbtn panel-menu-btn" id=${id('more')} aria-label="More" aria-haspopup="menu" aria-expanded=${menu} onClick=${() => setMenu(m => !m)}><${M.icons.more}/></button>
          ${menu ? html`<div class="panel-menu" role="menu">
            <button type="button" role="menuitem" id=${id('history-btn')} onClick=${() => { setMenu(false); setView(v => v === 'history' ? 'chat' : 'history'); }}>${view === 'history' ? 'Back to the chat' : 'History'}</button>
            ${onHide ? html`<button type="button" role="menuitem" id=${id('hide')} onClick=${() => { setMenu(false); onHide(); }}>Hide for today</button>` : null}
            <button type="button" role="menuitem" id=${id('prefs')} onClick=${() => { setMenu(false); if (onClose) onClose(); M.nav('#me'); setTimeout(() => { const el = document.getElementById('dock-prefs'); if (el) el.scrollIntoView({block: 'start', behavior: M.reduced() ? 'auto' : 'smooth'}); }, 500); }}>Prefs</button>
            ${turns.length || M.chat.summary ? html`<button type="button" role="menuitem" onClick=${() => { setMenu(false); M.chat.clear(ctx); S.set({err: '', chips: null}); }}>Clear chat</button>` : null}
          </div>` : null}
        </span>
        <button type="button" class="iconbtn" id=${id('close')} aria-label="Close" onClick=${onClose}><${M.icons.x}/></button>
      </span>
    </div>` : null;

    const History = M.parts.AgentHistory;
    const VoiceWrap = M.fx && M.fx.has() ? M.fx.Voice : Plain;
    const sendBtn = busy ? html`<button type="button" class="btn sec sm panel-stop" onClick=${() => S.stop()}>Stop</button>`
      : html`<${M.fx.Metal} kind=${sz === 'drawer' || sz === 'inline' ? 'ink' : undefined}><button type="button" class="btn sm panel-send" id=${sz === 'drawer' ? 'ask-go' : sz === 'inline' ? 'ask-go-inline' : id('send')} disabled=${!q.trim() && !imgs.length} onClick=${() => go()}>Send</button><//>`;
    const aloudBtn = html`<button type="button" class=${'iconbtn panel-aloud' + (aloud ? ' on' : '')} id=${id('aloud')} aria-pressed=${aloud} aria-label="Read replies aloud" title=${aloud ? 'Replies are read aloud' : 'Read replies aloud'} onClick=${flipAloud}><${Speaker}/></button>`;
    const talkBtn = talk ? html`<${TalkButton} id=${id('talk')} talk=${talk}/>`
      : M.parts.MicButton ? html`<${M.parts.MicButton} id=${id('talk')} sm=${true} label="Talk" onLive=${v => S.set({phase: v ? 'listening' : (S.st.phase === 'listening' ? 'idle' : S.st.phase)})} onText=${(t, lg) => send(ctx, t, {via: 'voice', size: sz, lang: lg})}/>` : null;
    const composer = html`<div class="panel-composer">
      ${imgs.length ? html`<div class="row panel-attached" style=${{gap: '8px'}} id=${id('attached')}>${imgs.map((im, i) => html`<span key=${i} class="ask-thumb"><img src=${im.url} alt="attached"/><button type="button" class="iconbtn" aria-label="Remove image" onClick=${() => setImgs(xs => xs.filter((_, j) => j !== i))}><${M.icons.x}/></button></span>`)}</div>` : null}
      <${VoiceWrap} on=${listening || busy} processing=${busy && !listening} className="ask-voice"><div class="ask-in vwrap">
        ${!(M.fx && M.fx.has()) && M.parts.VoiceGlow ? html`<${M.parts.VoiceGlow} on=${listening || busy} processing=${busy && !listening}/>` : null}
        ${canImg ? html`<input ref=${fileRef} type="file" accept="image/*" multiple=${true} style=${{display: 'none'}} id=${id('file')} onChange=${e => { attach(e.target.files); e.target.value = ''; }}/>
          <button type="button" class="iconbtn" aria-label="Attach an image" title="A photo or a screenshot" onClick=${() => fileRef.current && fileRef.current.click()}><${M.icons.plus}/></button>` : null}
        <input ref=${input} id=${sz === 'inline' ? 'ask-inline' : id('input')} class="input" value=${q} placeholder=${listening ? 'Listening' : 'Ask m360 anything'} autoComplete="off"
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }}
          onPaste=${e => { const fs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type)); if (fs.length && canImg) { e.preventDefault(); attach(fs); } }} aria-label="Ask m360"/>
        ${sz === 'sheet' ? null : talkBtn}
        ${aloudBtn}
        ${sendBtn}
      </div><//>
    </div>`;

    const thinking = busy && !st.live ? html`<div class="msg panel-thinking"><${M.Thinking} label=${sz === 'sheet' || sz === 'pop' ? 'Looking at your screen' : 'Thinking'}/></div>` : null;
    const stage = sz === 'sheet' && listening && empty ? html`<div class="orb-stage">
      <button type="button" class="orb-tap" id="orb-tap" aria-label="Done talking" aria-pressed="true" onClick=${() => talk && talk.stop()}>
        <span class=${'orb-big is-live'}>${M.fx && M.fx.has() ? html`<${M.fx.Orb} state="listening" size=${64} dark=${false} label="listening"/>` : html`<span class="vorb live"/>`}</span>
      </button>
      <div class="orb-hint">Talk. Tap the sphere when you are done.</div>
    </div>` : null;

    return html`<div ref=${root} class=${'agent-panel size-' + sz + (scrolled ? ' scrolled' : '') + (opening ? ' opening' : '') + (folded ? ' is-folded' : '') + (closing ? ' closing' : '')}
      data-phase=${st.phase}>
      ${head}
      ${folded ? html`<button type="button" class="panel-unfold tiny" onClick=${onUnfold}>Pointing at it. Tap to bring the chat back.</button>` : null}
      <div class="panel-body" ref=${body} onScroll=${onScroll} tabIndex="-1">
        ${view === 'history' ? html`<div class="msg panel-history">${History ? html`<${History}/>` : html`<div id="agent-history" class="tiny ink62">Nothing yet.</div>`}</div>` : html`<${React.Fragment}>
          ${intro || null}
          ${empty && !intro && !listening ? html`<div class="msg panel-empty stack tight">
            <div class="panel-lead">${ctx.isFounder ? 'Ask about anyone, any client, any number. Or tell it to hand out work, or to nudge people.' : 'Ask about your work, or tell it to add and move tasks for you.'}</div>
            <div class="row panel-chips">${chips.map(c => html`<button key=${c} type="button" class="chip" onClick=${() => go(c)}>${c}</button>`)}</div>
            ${onTour ? html`<button type="button" class="linky tiny" style=${{alignSelf: 'flex-start'}} onClick=${onTour}>Show me around</button>` : null}
          </div>` : null}
          ${rows}
          ${stage}
          ${listening || hearing ? (showWords ? (liveWords ? html`<${Words} text=${hearing && !st.heard ? 'Hearing it.' : st.heard || 'Go ahead.'} quiet=${!st.heard} id=${id('heard')}/>` : html`<div class="msg tiny ink62 panel-listening">Listening. Say more, or say nothing.</div>`)
            : html`<div class="msg bubble me panel-live-words" id=${id('heard')}>${st.heard ? st.heard : html`<span class="ink62">${hearing ? 'Hearing it.' : 'Go ahead, I am listening.'}</span>`}</div>`) : null}
          ${busy && st.live ? html`<${Streaming} text=${st.live}/>` : null}
          ${busy && st.acts.length ? html`<${Receipts} acts=${st.acts}/>` : null}
          ${thinking}
          ${st.err ? html`<div class="msg bubble ai panel-err" role="status"><${M.AIText} text=${st.err}/></div>` : null}
          ${st.chips ? html`<div class="msg row panel-chips">${st.chips.map(c => html`<button key=${c} type="button" class="chip" onClick=${() => go(c)}>${c}</button>`)}</div>` : null}
          ${hasTable ? html`<button type="button" class="linky tiny msg panel-wide-link" onClick=${() => S.expand()}>Open it wide to read the table</button>` : null}
          ${iosTap && conv && !listening && !busy ? html`<div class="msg tiny ink62 panel-ios">On this phone each turn needs a tap. Tap Talk to talk again.</div>` : null}
          ${!atEnd && (busy || turns.length > 2) ? html`<button type="button" class="panel-jump msg" onClick=${jump}><${Down}/>Jump to latest</button>` : null}
        <//>`}
      </div>
      <div class="panel-tray">${M.parts.PendingActs ? html`<${M.parts.PendingActs}/>` : null}</div>
      ${composer}
      ${sz === 'sheet' ? html`<div class="orb-foot panel-sheet-talk">
        ${talk ? html`<button type="button" class=${'btn ' + (listening ? '' : 'sec ') + 'panel-talk-big'} id=${stage ? 'orb-talk' : 'orb-tap'} aria-pressed=${!!listening} disabled=${!talk.can || hearing}
          onClick=${() => listening ? talk.stop() : talk.start()}><${Mic}/>${!talk.can ? 'No microphone here' : listening ? 'Done' : hearing ? 'Hearing it' : 'Talk'}</button>` : null}
      </div>` : null}
      ${sz === 'sheet' && M.fx && M.fx.has() ? html`<${M.fx.Voice} type="mobile" variant="colorful" on=${listening || busy} processing=${busy} level=${() => M.mic ? M.mic.level() : 0} className="orb-voice"><div class="orb-voice-in"/><//>`
        : sz === 'sheet' && M.parts.VoiceGlow ? html`<${M.parts.VoiceGlow} on=${listening || busy} processing=${busy} mobile=${true}/>` : null}
      <div class="panel-live" aria-live="polite" role="status">${st.phase === 'answer' ? st.announce : ''}</div>
      ${wide && (turns.length || M.chat.summary) ? html`<button type="button" class="linky tiny panel-clear" onClick=${() => { M.chat.clear(ctx); S.set({err: '', chips: null}); }}>Clear chat</button>` : null}
      ${sz === 'drawer' ? html`<div class="hint panel-hint">Runs on ${window.M360_STANDALONE ? 'the team account' : 'your own Claude account'}. It sees what you can see in m360, and nothing else. Ask "what can you do" for the list.</div>` : null}
    </div>`;
  }

  M.parts.AgentPanel = AgentPanel;
  M.parts.AgentWords = Words;
})();
