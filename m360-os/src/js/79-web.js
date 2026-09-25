/* module: web. A browser inside m360: tabs, an address bar with search, back and forward, reload,
   the team's shared bookmarks, and the page in a frame. Before framing, the server asks the site whether
   it allows frames; a site that refuses gets the reader view (its text and links, through the server)
   with one tap to open it outside. The frame helper extension (download below) lets almost every site
   open inside. Bookmarks live in links/team, editable by anyone. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef, useCallback} = React;

  const STARTERS = [
    {title: 'Google', url: 'https://www.google.com/webhp?igu=1'},
    {title: 'Wikipedia', url: 'https://www.wikipedia.org'},
    {title: 'Canva', url: 'https://www.canva.com'},
    {title: 'Apollo', url: 'https://app.apollo.io'},
    {title: 'LinkedIn', url: 'https://www.linkedin.com'},
    {title: 'Notion', url: 'https://www.notion.so'}
  ];
  const standalone = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');
  const helper = () => !!(document.documentElement.dataset && document.documentElement.dataset.m360ext);
  const clean = u => {
    let s = String(u || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = (/\s/.test(s) || !/\./.test(s)) ? 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(s) : 'https://' + s;
    try { const x = new URL(s); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; }
  };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const ALWAYS_REFUSE = /(^|\.)(google\.com|gmail\.com|youtube\.com|meet\.google\.com|docs\.google\.com|linkedin\.com|facebook\.com|instagram\.com|whatsapp\.com|x\.com|twitter\.com)$/i;

  let nextId = 1;
  const newTab = url => ({id: nextId++, url: url || '', hist: url ? [url] : [], at: url ? 0 : -1, title: url ? hostOf(url) : 'New tab', mode: 'frame', check: null, reader: null, key: 0});
  const persist = tabs => { try { sessionStorage.setItem('m360.tabs', JSON.stringify(tabs.map(t => ({url: t.url, title: t.title})))); } catch (e) { /* private */ } };
  const restore = () => { try { const j = JSON.parse(sessionStorage.getItem('m360.tabs') || 'null'); if (Array.isArray(j) && j.length) return j.map(t => newTab(t.url)); } catch (e) { /* none */ } return [newTab('')]; };

  function Web() {
    const ctx = M.useCtx();
    const doc = M.useDoc(ctx.db, 'links/team');
    const marks = (doc.data && Array.isArray(doc.data.items)) ? doc.data.items : [];
    const [tabs, setTabs] = useState(restore);
    const [cur, setCur] = useState(0);
    const [typed, setTyped] = useState('');
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [slow, setSlow] = useState(false);
    const [helperOn, setHelperOn] = useState(helper);
    const timer = useRef(0);
    const tab = tabs[cur] || tabs[0];
    useEffect(() => { persist(tabs); }, [tabs]);
    useEffect(() => { setTyped(tab ? tab.url : ''); }, [cur, tab && tab.url]);
    useEffect(() => { const t = setInterval(() => setHelperOn(helper()), 1500); return () => clearInterval(t); }, []);
    const patch = (id, p) => setTabs(ts => ts.map(t => t.id === id ? {...t, ...(typeof p === 'function' ? p(t) : p)} : t));

    /* open an address in the current tab: ask the server first whether the site allows a frame */
    const go = useCallback(async (u, opts) => {
      const c = clean(u);
      if (!c) { M.toast('That does not look like an address', true); return; }
      const t = tabs[cur];
      if (!t) return;
      const id = t.id;
      patch(id, x => {
        const hist = opts && opts.nohist ? x.hist : x.hist.slice(0, x.at + 1).concat([c]);
        return {url: c, hist, at: opts && opts.nohist ? x.at : hist.length - 1, title: hostOf(c), mode: 'frame', check: null, reader: null, key: x.key + 1};
      });
      setTyped(c); setSlow(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSlow(true), 7000);
      if (!standalone() || helper()) return;
      if (ALWAYS_REFUSE.test(hostOf(c))) { patch(id, {mode: 'refused', check: {why: 'this site never allows frames'}}); readerFor(id, c); return; }
      try {
        const r = await window.M360_API('framecheck', {url: c});
        if (r && r.frameable === false) { patch(id, {mode: 'refused', check: r}); readerFor(id, c); }
      } catch (e) { /* unknown: try the frame */ }
    }, [tabs, cur]);
    const readerFor = async (id, url) => {
      try { const r = await window.M360_API('readpage', {url}); patch(id, {reader: r, title: r.title || hostOf(url)}); }
      catch (e) { patch(id, {reader: {err: (e && e.message) || 'This page did not answer.'}}); }
    };
    const back = () => { const t = tabs[cur]; if (!t || t.at <= 0) return; const at = t.at - 1; patch(t.id, {at}); go(t.hist[at], {nohist: true}); patch(t.id, {at}); };
    const fwd = () => { const t = tabs[cur]; if (!t || t.at >= t.hist.length - 1) return; const at = t.at + 1; patch(t.id, {at}); go(t.hist[at], {nohist: true}); patch(t.id, {at}); };
    const reload = () => { const t = tabs[cur]; if (t && t.url) go(t.url, {nohist: true}); };
    const addTab = url => { const t = newTab(url || ''); setTabs(ts => ts.concat([t])); setCur(tabs.length); if (url) setTimeout(() => go(url), 0); };
    const closeTab = i => { setTabs(ts => { const n = ts.filter((_, k) => k !== i); return n.length ? n : [newTab('')]; }); setCur(c => Math.max(0, Math.min(c, tabs.length - 2))); };
    const loaded = () => { clearTimeout(timer.current); setSlow(false); };
    const openOut = u => { try { window.open(u || (tab && tab.url), '_blank', 'noopener'); } catch (e) { /* blocked */ } };
    const add = async () => {
      const c = clean(tab && tab.url);
      if (!c) return;
      const items = marks.filter(m => m.url !== c).concat([{id: U.uid(), title: (title || hostOf(c)).slice(0, 60), url: c, by: ctx.uid, at: Date.now()}]).slice(-60);
      await ctx.W.merge('links/team', {items, updated: Date.now()}).catch(() => {});
      setAdding(false); setTitle(''); M.toast('Bookmarked for the team');
    };
    const remove = async m => { await ctx.W.merge('links/team', {items: marks.filter(x => x.id !== m.id), updated: Date.now()}).catch(() => {}); };
    const list = marks.length ? marks : STARTERS.map(s => ({...s, id: 's:' + s.title, starter: true}));
    const refused = tab && tab.mode === 'refused';

    return html`<div class="stack web" style=${{gap: '10px'}}>
      <${UI.Card} id="web-card" className="web-bar">
        <div class="web-tabs" role="tablist" id="web-tabs">
          ${tabs.map((t, i) => html`<span key=${t.id} class=${'web-tab' + (i === cur ? ' active' : '')} role="tab" aria-selected=${i === cur}>
            <button type="button" class="web-tab-btn" onClick=${() => setCur(i)}>${t.title || 'New tab'}</button>
            <button type="button" class="web-tab-x" aria-label=${'Close ' + (t.title || 'tab')} onClick=${() => closeTab(i)}><${icons.x}/></button>
          </span>`)}
          <button type="button" class="iconbtn" id="web-newtab" aria-label="New tab" title="New tab" onClick=${() => addTab('')}><${icons.plus}/></button>
        </div>
        <div class="row nowrap" style=${{gap: '6px', marginTop: '8px'}}>
          <button type="button" class="iconbtn" id="web-back" aria-label="Back" title="Back" disabled=${!tab || tab.at <= 0} onClick=${back}><${icons.up}/></button>
          <button type="button" class="iconbtn" id="web-fwd" aria-label="Forward" title="Forward" disabled=${!tab || tab.at >= tab.hist.length - 1} onClick=${fwd}><${icons.down}/></button>
          <button type="button" class="iconbtn" id="web-reload" aria-label="Reload" title="Reload" disabled=${!tab || !tab.url} onClick=${reload}><${icons.clock}/></button>
          <input id="web-url" class="input grow" placeholder="Type an address, or search" value=${typed} onInput=${e => setTyped(e.target.value)}
            onKeyDown=${e => { if (e.key === 'Enter') go(typed); }} onFocus=${e => e.target.select()} aria-label="Address" inputMode="url" autoCapitalize="off" autoCorrect="off"/>
          <${UI.Btn} id="web-go" onClick=${() => go(typed)}>Go<//>
          ${tab && tab.url ? html`<${UI.Btn} kind="sec" id="web-save" onClick=${() => { setTitle(hostOf(tab.url)); setAdding(true); }}>Bookmark<//>` : null}
        </div>
        ${adding ? html`<div class="row" style=${{gap: '8px', marginTop: '10px'}}>
          <input id="web-title" class="input grow" placeholder="Name it" value=${title} onInput=${e => setTitle(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }} aria-label="Bookmark name"/>
          <${UI.Btn} sm=${true} onClick=${add}>Save<//><${UI.Btn} kind="ghost" sm=${true} onClick=${() => setAdding(false)}>Cancel<//>
        </div>` : null}
        <div class="row" style=${{gap: '6px', marginTop: '10px', flexWrap: 'wrap'}} id="web-marks">
          ${list.map(m => html`<span key=${m.id} class="row nowrap" style=${{gap: '2px'}}>
            <button type="button" class="chip" onClick=${() => go(m.url)} title=${m.url}>${m.title}</button>
            ${m.starter ? null : html`<button type="button" class="iconbtn" style=${{width: '26px', height: '26px'}} aria-label=${'Remove ' + m.title} onClick=${() => remove(m)}><${icons.x}/></button>`}
          </span>`)}
        </div>
      <//>
      ${!tab || !tab.url ? html`<${UI.Card}>
        <${UI.Empty} text="Type an address above, or tap a bookmark."/>
        ${standalone() && !helperOn ? html`<${Helper}/>` : null}
      <//>`
      : refused ? html`<${UI.Card} className="web-frame-card" id="web-reader">
        <div class="row between" style=${{gap: '8px', flexWrap: 'wrap'}}>
          <div class="small"><b>${hostOf(tab.url)}</b> refuses to open inside another site${tab.check && tab.check.why ? ' (' + tab.check.why + ')' : ''}. Here is the page as text.</div>
          <span class="row nowrap" style=${{gap: '6px'}}>
            <${UI.Btn} sm=${true} onClick=${() => patch(tab.id, {mode: 'frame', key: tab.key + 1})}>Try the frame anyway<//>
            <${UI.Btn} kind="sec" sm=${true} id="web-out" onClick=${() => openOut()}>Open outside<//>
          </span>
        </div>
        ${!tab.reader ? html`<div style=${{marginTop: '10px'}}><${M.Thinking} label="Reading the page"/></div>`
          : tab.reader.err ? html`<div class="small flame-t" style=${{marginTop: '10px'}}>${tab.reader.err}</div>`
          : html`<div class="reader" style=${{marginTop: '12px'}}>
            <h2 style=${{margin: '0 0 8px'}}>${tab.reader.title || hostOf(tab.url)}</h2>
            <div class="reader-text">${tab.reader.text || 'Nothing readable here.'}</div>
            ${(tab.reader.links || []).length ? html`<div class="micro" style=${{marginTop: '14px'}}>links on this page</div>
              <div class="row" style=${{gap: '6px', flexWrap: 'wrap', marginTop: '6px'}}>${tab.reader.links.map((l, i) => html`<button key=${i} type="button" class="chip" title=${l.href} onClick=${() => go(l.href)}>${l.label}</button>`)}</div>` : null}
          </div>`}
        ${standalone() && !helperOn ? html`<${Helper}/>` : null}
      <//>`
      : html`<${UI.Card} className="web-frame-card">
        ${slow ? html`<div class="row between small" style=${{marginBottom: '8px', gap: '8px'}}><span class="ink62">${hostOf(tab.url)} has not drawn anything yet. Some sites refuse frames without saying so.</span>
          <span class="row nowrap" style=${{gap: '6px'}}><${UI.Btn} sm=${true} onClick=${() => { patch(tab.id, {mode: 'refused', check: {why: 'blank frame'}}); readerFor(tab.id, tab.url); }}>Read it here<//><${UI.Btn} kind="sec" sm=${true} onClick=${() => openOut()}>Open outside<//></span></div>` : null}
        <iframe key=${tab.key} id="web-frame" class="web-frame" src=${tab.url} title=${hostOf(tab.url)} onLoad=${loaded}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" referrerPolicy="no-referrer-when-downgrade" allow="clipboard-write; fullscreen; camera; microphone"/>
      <//>`}
    </div>`;
  }

  /* the frame helper: a tiny browser extension that lets sites open inside m360 */
  function Helper() {
    const [open, setOpen] = useState(false);
    return html`<div class="web-helper" id="web-helper">
      <div class="row between" style=${{gap: '8px', flexWrap: 'wrap'}}>
        <div class="small"><b>Want everything to open inside m360?</b> Install the m360 frame helper in Chrome or Edge (two minutes, once per laptop).</div>
        <span class="row nowrap" style=${{gap: '6px'}}><a class="btn sm" href="m360-frame-helper.zip" download>Download the helper</a><button type="button" class="linky small" onClick=${() => setOpen(x => !x)}>${open ? 'Hide steps' : 'Steps'}</button></span>
      </div>
      ${open ? html`<ol class="small" style=${{margin: '8px 0 0', paddingLeft: '18px'}}>
        <li>Unzip the download. You get a folder called m360-frame-helper.</li>
        <li>In Chrome open chrome://extensions (Edge: edge://extensions). Switch on Developer mode, top right.</li>
        <li>Tap Load unpacked and pick that folder. Done. Reload m360.</li>
        <li>It only touches pages framed inside m360. Google, Meet, LinkedIn and WhatsApp still refuse frames by their own rules; those open outside.</li>
      </ol>` : null}
    </div>`;
  }

  M.pages.Web = Web;
})();
