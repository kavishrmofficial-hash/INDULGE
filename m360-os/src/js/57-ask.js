/* module: ask. "Ask m360", wide: the expanded size of the buddy's panel, in a drawer. It is the same
   panel and the same thread as the pop-up at the dock and the sheet on a phone (57-panel.js); here it
   keeps the room for long answers and tables, a photo or screenshot attached where the host allows
   images, and Clear chat. The thread itself lives here: one per person, in their private doc, so every
   size shows the same conversation and it survives a reload. Each answer is built from the data this
   viewer may see. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState} = React;

  /* a receipt kept with an answer: a plain line, or {group, who, text} folded by group, or an ask */
  const KEEP = ['group', 'who', 'text', 'type', 'askId'];
  const keepAct = a => {
    if (typeof a === 'string') return a.slice(0, 200);
    if (!a || typeof a !== 'object') return null;
    const o = {};
    KEEP.forEach(k => { if (typeof a[k] === 'string' && a[k]) o[k] = a[k].slice(0, 200); });
    return Object.keys(o).length ? o : null;
  };

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
      const keep = turns.slice(-40).map(t => {
        const acts = Array.isArray(t.acts) ? t.acts.map(keepAct).filter(Boolean).slice(0, 40) : null;
        return {role: t.role, content: String(t.content || '').slice(0, 4000), ...(t.act ? {act: true} : {}), ...(t.img ? {img: true} : {}),
          ...(t.via === 'voice' ? {via: 'voice'} : {}), ...(acts && acts.length ? {acts} : {})};
      });
      chat.turns = keep; chat.subs.forEach(f => f());
      if (ctx.viewAs) return Promise.resolve();
      return ctx.W.merge(chat.path(ctx), {turns: keep, at: Date.now(), ...(extra || {})}).catch(() => {});
    },
    append: (ctx, more) => chat.save(ctx, chat.turns.concat(more)),
    clear: ctx => { chat.summary = ''; return chat.save(ctx, [], {summary: ''}); },
    /* the recent exchange, for a prompt */
    recent: n => chat.turns.filter(t => !t.act).slice(-(n || 6))
  };

  /* HQ's inline card: the same panel, in the card */
  function AskPanel({inline, initial}) {
    const Panel = M.parts.AgentPanel;
    return Panel ? html`<${Panel} size=${inline ? 'inline' : 'drawer'} initial=${initial || ''}/>` : null;
  }

  function Ask({onClose, initial}) {
    const [busy, setBusy] = useState(false);
    const Panel = M.parts.AgentPanel;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Ask m360"
      head=${html`<${M.fx.Bot} feature="ask" state=${busy ? 'working' : 'default'} size=${34} label="m360, ask" id="ask-head-bot" className="ai-bot"/>`}>
      ${Panel ? html`<${Panel} size="drawer" initial=${initial || ''} onBusy=${setBusy} onClose=${onClose}/>` : null}
    <//>`;
  }

  M.parts.AskPanel = AskPanel;
  M.parts.Ask = Ask;
})();
