/* module: ask. "Ask m360": a chat with Claude that knows your work and can act on it.
   It can create tasks, move them, and for the founder reassign them. Each answer is built
   from the data this viewer may see, so members never get teammates' private detail. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useRef, useEffect} = React;

  const MEMBER_CHIPS = ['What should I do next?', "What's overdue on me?", 'Summarise my week', 'Add a task for me to follow up with the client tomorrow'];
  const FOUNDER_CHIPS = ["Who's overloaded right now?", "What's slipping this week?", 'Which client needs love?', "Draft Monday's plan meeting agenda", "Who's been late this week?"];

  function instructions(ctx, nmMe) {
    return 'INSTRUCTIONS: You are chatting inside m360 with ' + nmMe + (ctx.isFounder ? ', the founder' : ', a team member') + '. ' +
      'Answer from the data below only. Be brief: under 120 words unless asked for more, use short bullets when listing. ' +
      'You can act with your tools: create tasks and assign them, move a task\'s status' + (ctx.isFounder ? ', and reassign tasks' : ' (their own tasks)') + '. ' +
      'When asked to do something, do it with a tool, then confirm in one line. When the data does not say, say so plainly.';
  }

  function AskPanel({inline, initial}) {
    const ctx = M.useCtx();
    const [turns, setTurns] = useState([]);   /* {role, content, act?} for display */
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [live, setLive] = useState('');
    const ctl = useRef(null);
    const endRef = useRef(null);
    const sentInitial = useRef(false);

    useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
    useEffect(() => { if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({block: 'nearest'}); }, [turns, live]);
    useEffect(() => { if (initial && !sentInitial.current) { sentInitial.current = true; send(initial); } }, [initial]);

    async function send(text) {
      const msg = String(text || q).trim();
      if (!msg || busy) return;
      setQ('');
      const history = turns.filter(t => !t.act);
      const next = [...turns, {role: 'user', content: msg}];
      setTurns(next); setBusy(true); setLive('');
      const c = new AbortController(); ctl.current = c;
      try {
        const nm = await M.ai.names(ctx);
        const data = ctx.isFounder ? await M.ai.teamSlice(ctx) : (await M.ai.meSlice(ctx)) + '\n\n' + (await M.ai.teamSlice(ctx));
        const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
        const actions = [];
        const tools = lim && lim.tools ? M.ai.tools(ctx, nm, a => { actions.push(a); setTurns(ts => [...ts, {role: 'assistant', content: a, act: true}]); }) : undefined;
        const lead = M.ai.VOICE + instructions(ctx, nm[ctx.uid] || 'a teammate') + '\n\nDATA:\n' + data.slice(0, 40000);
        /* the page keeps the chat; Claude sees the lead turn, the recent turns and the new message */
        const convo = [{role: 'user', content: lead}];
        history.slice(-8).forEach(t => convo.push({role: t.role, content: t.content}));
        convo.push({role: 'user', content: msg});
        const out = await ctx.sample(convo, {signal: c.signal, tools, onText: ({text: t}) => setLive(t), ...(tools ? {} : {cache: false})});
        setTurns(ts => [...ts, {role: 'assistant', content: out.text.replace(/\u2014|\u2013/g, ', ')}]);
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code !== 'cancelled') setTurns(ts => [...ts, {role: 'assistant', content: (e && e.text ? e.text + '\n\n' : '') + M.ai.errCopy(code), err: true}]);
      }
      setLive(''); setBusy(false);
    }

    const chips = ctx.isFounder ? FOUNDER_CHIPS : MEMBER_CHIPS;
    return html`<div class="stack" style=${{gap: '12px'}}>
      ${turns.length === 0 && !busy ? html`<div class="stack tight">
        <div style=${{fontWeight: 600}}>${ctx.isFounder ? 'Ask about anyone, any client, any number. Or tell it to hand out work.' : 'Ask about your work, or tell it to add and move tasks for you.'}</div>
        <div class="row" style=${{gap: '8px'}}>${chips.map(c => html`<button key=${c} type="button" class="chip" onClick=${() => send(c)}>${c}</button>`)}</div>
      </div>` : null}
      <div class="stack" style=${{gap: '10px', maxHeight: inline ? '420px' : 'none', overflowY: inline ? 'auto' : 'visible'}}>
        ${turns.map((t, i) => t.act
          ? html`<div key=${i} class="bubble act">${t.content}</div>`
          : html`<div key=${i} class=${'bubble ' + (t.role === 'user' ? 'me' : 'ai')} style=${t.err ? {borderColor: 'var(--flame)'} : null}>
              ${t.role === 'user' ? t.content : html`<${M.AIText} text=${t.content}/>`}</div>`)}
        ${busy ? html`<div class="bubble ai">${live ? html`<${M.AIText} text=${live}/>` : html`<${M.Thinking}/>`}</div>` : null}
        <div ref=${endRef}/>
      </div>
      <div class="ask-in">
        <input id=${inline ? 'ask-inline' : 'ask-input'} class="input" value=${q} placeholder=${ctx.isFounder ? 'Ask HQ anything…' : 'Ask m360 anything…'}
          onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') send(); }} aria-label="Ask m360"/>
        ${busy ? html`<${UI.Btn} kind="sec" onClick=${() => ctl.current && ctl.current.abort()}>Stop<//>`
          : html`<button type="button" class="btn" disabled=${!q.trim()} onClick=${() => send()}>Ask</button>`}
      </div>
      ${turns.length ? html`<button type="button" class="linky tiny" style=${{alignSelf: 'flex-start'}} onClick=${() => setTurns([])}>Clear chat</button>` : null}
    </div>`;
  }

  function Ask({onClose, initial}) {
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Ask m360">
      <${AskPanel} initial=${initial || ''}/>
      <div class="hint">Runs on your own Claude account. It sees what you can see in m360, and nothing else.</div>
    <//>`;
  }

  M.parts.AskPanel = AskPanel;
  M.parts.Ask = Ask;
})();
