/* module: ask. "Ask m360": a chat with Claude that knows your work and can act on it.
   It looks anything up and does anything through the brain (56-brain.js): tasks, projects, notes,
   posts, kudos, messages, leave, check-in, EOD, the week, pitches, clients, mail and meetings, with the
   outward and deciding acts waiting on one tap. It keeps what you ask it to remember, reads a photo
   or screenshot you attach where the host allows images, and folds a long chat into a summary so
   the thread never runs out of room. Each answer is built from the data this viewer may see. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useRef, useEffect} = React;

  const MEMBER_CHIPS = ['What should I do next?', "What's overdue on me?", 'Summarise my week', 'Add a task for me to follow up with the client tomorrow'];
  const FOUNDER_CHIPS = ["Who's overloaded right now?", "What's slipping this week?", 'Which client needs love?', "Draft Monday's plan meeting agenda", "Who's been late this week?"];

  function instructions(ctx, nmMe) {
    return 'INSTRUCTIONS: You are chatting inside m360 with ' + nmMe + (ctx.isFounder ? ', the founder' : ', a team member') + '. ' +
      'Answer from the data below and from look_up. Be brief: under 120 words unless asked for more, use short bullets when listing. ' +
      'When the data below does not say, call look_up for that area before answering; never guess a number or a name. ' +
      'When asked to do something, do it with act, then confirm in one line; when act comes back waiting, say it is ready for their tap. ' +
      'When they ask you to remember something, act remember. When a photo or screenshot is attached, read it and use it. ' +
      'Never use ids; use names and titles. When the data does not say, say so plainly.\n' +
      (M.brain ? M.brain.catalog(ctx) : '');
  }

  /* one thread per person, kept in their private doc, so the buddy and the full chat share it and it survives a reload */
  const chat = M.chat = {
    path: ctx => 'data/users/' + ctx.uid + '/chat',
    turns: [],
    summary: '',
    ready: false,
    subs: new Set(),
    watched: '',
    un: null,
    watch(ctx) {
      /* in preview the founder is not that person: no thread is read or written */
      const p = ctx.viewAs ? '' : chat.path(ctx);
      if (chat.watched === p || !ctx.db) return;
      if (chat.un) { try { chat.un(); } catch (e) { /* gone */ } chat.un = null; }
      chat.watched = p; chat.turns = []; chat.summary = ''; chat.ready = !p;
      if (!p) { chat.subs.forEach(f => f()); return; }
      try {
        chat.un = ctx.db.doc(p).onSnapshot(d => { if (chat.watched !== p) return; chat.turns = (d.exists && Array.isArray(d.data().turns)) ? d.data().turns : []; chat.summary = d.exists ? String(d.data().summary || '') : ''; chat.ready = true; chat.subs.forEach(f => f()); },
          () => { if (chat.watched === p) { chat.ready = true; chat.subs.forEach(f => f()); } });
      } catch (e) { chat.ready = true; }
    },
    save(ctx, turns, extra) {
      const keep = turns.slice(-40).map(t => ({role: t.role, content: String(t.content || '').slice(0, 4000), ...(t.act ? {act: true} : {}), ...(t.img ? {img: true} : {})}));
      chat.turns = keep; chat.subs.forEach(f => f());
      if (ctx.viewAs) return Promise.resolve();
      return ctx.W.merge(chat.path(ctx), {turns: keep, at: Date.now(), ...(extra || {})}).catch(() => {});
    },
    append: (ctx, more) => chat.save(ctx, chat.turns.concat(more)),
    /* the recent exchange, for a prompt */
    recent: n => chat.turns.filter(t => !t.act).slice(-(n || 6))
  };

  function AskPanel({inline, initial}) {
    const ctx = M.useCtx();
    const [turns, setTurns] = useState(() => M.chat.turns);   /* {role, content, act?} for display */
    useEffect(() => {
      M.chat.watch(ctx);
      const f = () => setTurns(M.chat.turns);
      M.chat.subs.add(f); if (M.chat.ready) f();
      return () => { M.chat.subs.delete(f); };
    }, [ctx.uid, ctx.viewAs]);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [live, setLive] = useState('');
    const [micLive, setMicLive] = useState(false);
    const [imgs, setImgs] = useState([]);           /* {blob, url} attached to the next message */
    const [canImg, setCanImg] = useState(false);
    const ctl = useRef(null);
    const endRef = useRef(null);
    const sentInitial = useRef(false);
    const fileRef = useRef(null);
    const lang = useRef('en');                        /* the language the last spoken question came in */
    const [aloud, setAloud] = useState(() => M.prefs.get('askAloud', '0') === '1');
    const aloudRef = useRef(aloud); aloudRef.current = aloud;
    useEffect(() => { let on = true; if (ctx.sample && ctx.sample.limits) ctx.sample.limits().then(l => { if (on) setCanImg(!!(l && l.images)); }).catch(() => {}); return () => { on = false; }; }, [ctx.sample]);
    const attach = async files => {
      const out = [];
      for (const f of Array.from(files || []).slice(0, 4 - imgs.length)) {
        try { const blob = await M.ai.shrinkImage(f); out.push({blob, url: URL.createObjectURL(blob)}); } catch (e) { M.toast('That file is not an image', true); }
      }
      if (out.length) setImgs(xs => xs.concat(out));
    };

    useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
    useEffect(() => { if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({block: 'nearest'}); }, [turns, live]);
    useEffect(() => { if (initial) { sentInitial.current = initial; send(initial); } }, [initial]);

    async function send(text) {
      const msg = String(text || q).trim();
      const pics = imgs.slice();
      if ((!msg && !pics.length) || busy) return;
      setQ(''); setImgs([]);
      /* "DM:" with screenshots: the Handshake desk reads the names and writes the messages */
      if (/^dm:/i.test(msg) && pics.length && M.handshake && ctx.isFounder) {
        const shown = [...turns, {role: 'user', content: msg, img: true}];
        setTurns(shown); setBusy(true);
        try {
          const r = await M.handshake.fromAsk(ctx, pics.map(p => p.blob), msg);
          M.chat.save(ctx, [...shown, {role: 'assistant', content: 'Handshake has ' + r.added.length + (r.added.length === 1 ? ' new person' : ' new people') + (r.dupes.length ? ' (already in: ' + r.dupes.join(', ') + ')' : '') + '. Writing now; the messages land under Accounts, Handshake.'}]);
        } catch (e) { setTurns(ts => [...ts, {role: 'assistant', content: 'The desk could not read that: ' + ((e && e.message) || 'unknown'), err: true}]); }
        setBusy(false);
        return;
      }
      const history = turns.filter(t => !t.act);
      const shown = msg || 'Look at this.';
      const next = [...turns, {role: 'user', content: shown, ...(pics.length ? {img: true} : {})}];
      setTurns(next); setBusy(true); setLive('');
      M.chat.save(ctx, next);
      const c = new AbortController(); ctl.current = c;
      try {
        const nm = await M.ai.names(ctx);
        const data = ctx.isFounder ? await M.ai.teamSlice(ctx) : (await M.ai.meSlice(ctx)) + '\n\n' + (await M.ai.teamSlice(ctx));
        const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
        const actions = [];
        const toolsAll = lim && lim.tools && M.brain ? M.brain.tools(ctx, nm, a => { actions.push(a); M.chat.save(ctx, [...M.chat.turns, {role: 'assistant', content: a, act: true}]); }) : undefined;
        const tools = toolsAll ? toolsAll.slice(0, (lim.tools.maxCount && lim.tools.maxCount > 0) ? lim.tools.maxCount : toolsAll.length) : undefined;
        const mem = M.brain ? M.brain.memoryLines(M.brain.memoryOf(await M.brain.readAi(ctx))) : '';
        const lead = M.ai.VOICE + instructions(ctx, nm[ctx.uid] || 'a teammate') + (mem ? '\n\n' + mem : '') +
          (M.chat.summary ? '\n\nEARLIER IN THIS CHAT, IN SHORT:\n' + M.chat.summary : '') + '\n\nDATA:\n' + data.slice(0, 30000);
        /* the page keeps the chat; Claude sees the lead turn, the recent turns and the new message */
        const convo = [{role: 'user', content: lead}];
        history.slice(-8).forEach(t => convo.push({role: t.role, content: t.content}));
        convo.push({role: 'user', content: pics.length ? (msg || 'Look at what is attached and tell me what matters.') + ' (' + pics.length + (pics.length === 1 ? ' image attached)' : ' images attached)') : msg});
        const out = await ctx.sample(convo, {signal: c.signal, tools, onText: ({text: t}) => setLive(t), ...(pics.length ? {images: pics.map(p => p.blob)} : {}), ...(tools ? {} : {cache: false})});
        const answer = {role: 'assistant', content: out.text.replace(/\u2014|\u2013/g, ', ')};
        const all = [...M.chat.turns, answer];
        await M.chat.save(ctx, all);
        if (aloudRef.current && M.speech) M.speech.say(answer.content, lang.current).catch(() => {});
        if (M.brain) M.brain.compact(ctx).catch(() => {});
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code !== 'cancelled') setTurns(ts => [...ts, {role: 'assistant', content: (e && e.text ? e.text + '\n\n' : '') + M.ai.errCopy(code), err: true}]);
      }
      setLive(''); setBusy(false);
    }

    const chips = ctx.isFounder ? FOUNDER_CHIPS : MEMBER_CHIPS;
    return html`<div class="stack" style=${{gap: '12px'}}>
      ${!inline ? html`<div class="row" style=${{gap: '8px', alignItems: 'center'}}><${M.Mark} width="54px"/><span class="micro">ask</span></div>` : null}
      ${turns.length === 0 && !busy ? html`<div class="stack tight">
        <div style=${{fontWeight: 600}}>${ctx.isFounder ? 'Ask about anyone, any client, any number. Or tell it to hand out work.' : 'Ask about your work, or tell it to add and move tasks for you.'}</div>
        <div class="row" style=${{gap: '8px'}}>${chips.map(c => html`<button key=${c} type="button" class="chip" onClick=${() => send(c)}>${c}</button>`)}</div>
      </div>` : null}
      <div class="stack" style=${{gap: '10px', maxHeight: inline ? '420px' : 'none', overflowY: inline ? 'auto' : 'visible'}}>
        ${turns.map((t, i) => t.act
          ? html`<div key=${i} class="bubble act">${t.content}</div>`
          : t.role === 'user' ? html`<div key=${i} class="bubble me" style=${t.err ? {borderColor: 'var(--flame)'} : null}>${t.img ? html`<span class="tiny ink62">[image] </span>` : null}${t.content}</div>`
          : html`<div key=${i} class="ask-row">${M.parts.Bot ? html`<${M.parts.Bot} size=${26} seed=${(i % 7) / 7} state="default" label="m360"/>` : null}<div class="bubble ai" style=${t.err ? {borderColor: 'var(--flame)'} : null}><${M.AIText} text=${t.content}/></div></div>`)}
        ${busy ? html`<div class="ask-row">${M.parts.Bot ? html`<${M.parts.Bot} size=${26} state="working" label="m360, working" id="ask-bot"/>` : null}<div class="bubble ai">${live ? html`<${M.AIText} text=${live}/>` : html`<${M.Thinking}/>`}</div></div>` : null}
        ${M.parts.PendingActs ? html`<${M.parts.PendingActs}/>` : null}
        <div ref=${endRef}/>
      </div>
      ${imgs.length ? html`<div class="row" style=${{gap: '8px'}} id=${inline ? 'ask-attached-inline' : 'ask-attached'}>${imgs.map((im, i) => html`<span key=${i} class="ask-thumb"><img src=${im.url} alt="attached"/><button type="button" class="iconbtn" aria-label="Remove image" onClick=${() => setImgs(xs => xs.filter((_, j) => j !== i))}><${M.icons.x}/></button></span>`)}</div>` : null}
      <div class="ask-in vwrap">
        ${M.parts.VoiceGlow ? html`<${M.parts.VoiceGlow} on=${micLive || busy} processing=${busy && !micLive}/>` : null}
        ${canImg ? html`<input ref=${fileRef} type="file" accept="image/*" multiple=${true} style=${{display: 'none'}} id=${inline ? 'ask-file-inline' : 'ask-file'} onChange=${e => { attach(e.target.files); e.target.value = ''; }}/>
          <button type="button" class="iconbtn" aria-label="Attach an image" title="A photo or a screenshot" onClick=${() => fileRef.current && fileRef.current.click()}><${M.icons.plus}/></button>` : null}
        <input id=${inline ? 'ask-inline' : 'ask-input'} class="input" value=${q} placeholder=${ctx.isFounder ? 'Ask HQ anything…' : 'Ask m360 anything…'}
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') send(); }} onPaste=${e => { const fs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type)); if (fs.length && canImg) { e.preventDefault(); attach(fs); } }} aria-label="Ask m360"/>
        ${M.parts.MicButton ? html`<${M.parts.MicButton} sm=${true} label="Talk" onLive=${setMicLive} onText=${(t, lg) => { lang.current = lg || 'en'; send(t); }}/>` : null}
        <button type="button" class=${'iconbtn' + (aloud ? ' on' : '')} id=${inline ? 'ask-aloud-inline' : 'ask-aloud'} aria-pressed=${aloud} aria-label="Read replies aloud" title=${aloud ? 'Replies are read aloud' : 'Read replies aloud'}
          onClick=${() => { const v = !aloud; setAloud(v); M.prefs.set('askAloud', v ? '1' : '0'); if (!v && M.speech) M.speech.stop(); }}><${M.icons.voice}/></button>
        ${busy ? html`<${UI.Btn} kind="sec" onClick=${() => ctl.current && ctl.current.abort()}>Stop<//>`
          : html`<button type="button" class="btn" disabled=${!q.trim() && !imgs.length} onClick=${() => send()}>Ask</button>`}
      </div>
      ${turns.length || M.chat.summary ? html`<button type="button" class="linky tiny" style=${{alignSelf: 'flex-start'}} onClick=${() => { setTurns([]); M.chat.summary = ''; M.chat.save(ctx, [], {summary: ''}); }}>Clear chat</button>` : null}
    </div>`;
  }

  function Ask({onClose, initial}) {
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Ask m360">
      <${AskPanel} initial=${initial || ''}/>
      <div class="hint">Runs on your own Claude account. It sees what you can see in m360, and nothing else. Ask "what can you do" for the list.</div>
    <//>`;
  }

  M.parts.AskPanel = AskPanel;
  M.parts.Ask = Ask;
})();
