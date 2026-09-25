/* module: web. The browser inside m360, laid out like Arc: a rail on the left with the address, the team's
   spaces (bookmarks as app tiles) and the open tabs; the page on the right. Full screen mode hides the
   rest of m360 and gives the page the whole window (Escape brings it back). Links anywhere in m360 that
   would have opened a new browser tab open here instead (M.web.open). A site that refuses frames opens
   in reading mode: the team site fetches the page itself (/api/browse), links inside it stay inside, and
   the address bar follows. Inside m360 Desktop (window.m360desktop) every tab is a real Chromium view:
   no site can refuse, logins work, and the same rail drives it. Bookmarks live in links/team. */
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
  const native = () => (window.m360desktop && typeof window.m360desktop.open === 'function') ? window.m360desktop : null;
  const helper = () => !!(document.documentElement.dataset && document.documentElement.dataset.m360ext);
  const clean = u => {
    let s = String(u || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = (/\s/.test(s) || !/\./.test(s)) ? 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(s) : 'https://' + s;
    try { const x = new URL(s); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; }
  };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const pathOf = u => { try { const x = new URL(u); return (x.pathname === '/' ? '' : x.pathname).replace(/\/$/, ''); } catch (e) { return ''; } };
  const ALWAYS_REFUSE = /(^|\.)(google\.com|gmail\.com|youtube\.com|meet\.google\.com|docs\.google\.com|linkedin\.com|facebook\.com|instagram\.com|whatsapp\.com|x\.com|twitter\.com)$/i;
  const refusesForSure = u => !native() && ALWAYS_REFUSE.test(hostOf(u));
  /* reading mode: the team site fetches the page and serves it from here, links routed back through it */
  const QS = () => { try { return location.search && location.search.length > 1 ? location.search.slice(1) + '&' : ''; } catch (e) { return ''; } };
  const proxyUrl = u => '/api/browse?' + QS() + 'u=' + encodeURIComponent(u);
  const DESKTOP_URL = 'https://github.com/kavishrmofficial-hash/indulge/releases/latest';

  /* ---------- the queue other parts of m360 drop links into ---------- */
  const queue = [];
  const listeners = new Set();
  M.web = {
    /* open an address inside m360: the Web section picks it up, now or when it mounts */
    open(url, opts) {
      const c = clean(url);
      if (!c) return false;
      if (!native() && refusesForSure(c) && !(opts && opts.force)) { try { window.open(c, '_blank', 'noopener'); } catch (e) { /* blocked */ } return false; }
      queue.push({url: c, at: Date.now()});
      listeners.forEach(f => { try { f(); } catch (e) { /* page handler */ } });
      if (!/^#(web|browser)\b/.test(location.hash)) M.nav('#web');
      return true;
    },
    take: () => queue.splice(0),
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    clean, hostOf, refusesForSure
  };
  /* a link in m360 that would have opened a browser tab opens here instead */
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.getAttribute('target') !== '_blank' || a.dataset.out === '1') return;
    if (a.closest('.web')) return;
    const href = a.href;
    if (!/^https?:/i.test(href)) return;
    if (M.web.open(href)) e.preventDefault();
  }, true);

  let nextId = 1;
  const newTab = url => ({id: nextId++, url: url || '', hist: url ? [url] : [], at: url ? 0 : -1, title: url ? hostOf(url) : 'New tab', icon: '', mode: 'frame', check: null, reader: null, key: 0, loading: false, nid: null, canBack: false, canFwd: false});
  const persist = tabs => { try { sessionStorage.setItem('m360.tabs', JSON.stringify(tabs.map(t => ({url: t.url, title: t.title})))); } catch (e) { /* private */ } };
  const restore = () => { try { const j = JSON.parse(sessionStorage.getItem('m360.tabs') || 'null'); if (Array.isArray(j) && j.length) return j.map(t => { const x = newTab(t.url); if (t.title) x.title = t.title; return x; }); } catch (e) { /* none */ } return [newTab('')]; };
  /* favicons come from Google's service on the team site and the desktop; the claude.ai page keeps letter tiles */
  const Favicon = ({url, title}) => {
    const [bad, setBad] = useState(false);
    const h = hostOf(url);
    if (!h || bad || !(standalone() || native())) return html`<span class="web-letter">${(title || h || '?').slice(0, 1).toUpperCase()}</span>`;
    return html`<img class="web-ico" alt="" src=${'https://www.google.com/s2/favicons?sz=32&domain=' + encodeURIComponent(h)} onError=${() => setBad(true)}/>`;
  };

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
    const [focus, setFocus] = useState(() => { try { return sessionStorage.getItem('m360.webFocus') === '1'; } catch (e) { return false; } });
    const timer = useRef(0);
    const urlRef = useRef(null);
    const slotRef = useRef(null);
    const tabsRef = useRef(tabs);
    const curRef = useRef(cur);
    tabsRef.current = tabs; curRef.current = cur;
    const tab = tabs[cur] || tabs[0];
    const phone = M.usePhone();
    const nat = native();
    useEffect(() => { persist(tabs); }, [tabs]);
    useEffect(() => { setTyped(tab ? tab.url : ''); }, [cur, tab && tab.url]);
    /* full screen inside m360: the rest of the shell steps aside */
    useEffect(() => {
      document.body.classList.toggle('web-focus', focus);
      try { sessionStorage.setItem('m360.webFocus', focus ? '1' : '0'); } catch (e) { /* private */ }
      return () => document.body.classList.remove('web-focus');
    }, [focus]);
    const patch = (id, p) => setTabs(ts => ts.map(t => t.id === id ? {...t, ...(typeof p === 'function' ? p(t) : p)} : t));

    /* open an address in a tab: ask the server first whether the site allows a frame (not needed with the helper or the desktop) */
    const go = useCallback(async (u, opts) => {
      const c = clean(u);
      if (!c) { M.toast('That does not look like an address', true); return; }
      const ts = tabsRef.current, t = ts[curRef.current];
      if (!t) return;
      const id = t.id;
      if (nat) {
        if (t.nid == null) { const nid = await nat.open(c); patch(id, {nid, url: c, title: hostOf(c), loading: true}); nat.activate(nid); }
        else nat.navigate(t.nid, c);
        patch(id, x => ({url: c, hist: opts && opts.nohist ? x.hist : x.hist.slice(0, x.at + 1).concat([c]), at: opts && opts.nohist ? x.at : x.hist.length, mode: 'frame'}));
        setTyped(c);
        return;
      }
      /* already reading this site through the server: the next page of it stays in reading mode */
      const stay = standalone() && (t.mode === 'proxy' || t.mode === 'reader') && hostOf(c) === hostOf(t.url) && !(opts && opts.frame);
      patch(id, x => {
        const hist = opts && opts.nohist ? x.hist : x.hist.slice(0, x.at + 1).concat([c]);
        return {url: c, hist, at: opts && opts.nohist ? x.at : hist.length - 1, title: hostOf(c), mode: stay ? 'proxy' : 'frame', check: stay ? x.check : null, reader: null, key: x.key + 1, loading: true};
      });
      setTyped(c); setSlow(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSlow(true), 7000);
      if (stay || !standalone() || helper()) return;
      if (ALWAYS_REFUSE.test(hostOf(c))) { patch(id, {mode: 'proxy', check: {why: 'this site never allows frames', signin: true}, loading: true}); return; }
      try {
        const r = await window.M360_API('framecheck', {url: c});
        if (r && r.frameable === false) patch(id, x => x.url === c ? {mode: 'proxy', check: r, loading: true} : {});
      } catch (e) { /* unknown: try the frame */ }
    }, [nat]);
    const readerFor = async (id, url) => {
      patch(id, {mode: 'reader', reader: null, loading: false});
      try { const r = await window.M360_API('readpage', {url}); patch(id, {reader: r, title: r.title || hostOf(url)}); }
      catch (e) { patch(id, {reader: {err: (e && e.message) || 'This page did not answer.'}}); }
    };
    const openNew = useCallback((url, opts) => {
      const t = newTab('');
      setTabs(ts => ts.concat([t]));
      const idx = tabsRef.current.length;
      setCur(idx);
      if (url) setTimeout(() => { curRef.current = idx; go(url, opts); }, 0);
    }, [go]);
    const closeTab = i => {
      const t = tabsRef.current[i];
      if (t && t.nid != null && nat) nat.close(t.nid);
      setTabs(ts => { const n = ts.filter((_, k) => k !== i); return n.length ? n : [newTab('')]; });
      setCur(c => Math.max(0, Math.min(c > i ? c - 1 : c, tabsRef.current.length - 2)));
    };
    const back = () => { const t = tabsRef.current[curRef.current]; if (!t) return; if (nat && t.nid != null) { nat.back(t.nid); return; } if (t.at <= 0) return; const at = t.at - 1; go(t.hist[at], {nohist: true}); patch(t.id, {at}); };
    const fwd = () => { const t = tabsRef.current[curRef.current]; if (!t) return; if (nat && t.nid != null) { nat.forward(t.nid); return; } if (t.at >= t.hist.length - 1) return; const at = t.at + 1; go(t.hist[at], {nohist: true}); patch(t.id, {at}); };
    const reload = () => { const t = tabsRef.current[curRef.current]; if (!t || !t.url) return; if (nat && t.nid != null) { nat.reload(t.nid); return; } go(t.url, {nohist: true}); };
    const loaded = () => { clearTimeout(timer.current); setSlow(false); patch(tab.id, {loading: false}); };
    const openOut = u => { const target = u || (tab && tab.url); if (!target) return; try { if (helper()) window.postMessage({m360ext: 'allow-next'}, '*'); window.open(target, '_blank', 'noopener'); } catch (e) { /* blocked */ } };
    const add = async () => {
      const c = clean(tab && tab.url);
      if (!c) return;
      const items = marks.filter(m => m.url !== c).concat([{id: U.uid(), title: (title || hostOf(c)).slice(0, 60), url: c, by: ctx.uid, at: Date.now()}]).slice(-60);
      await ctx.W.merge('links/team', {items, updated: Date.now()}).catch(() => {});
      setAdding(false); setTitle(''); M.toast('Added to the team\'s spaces');
    };
    const remove = async m => { await ctx.W.merge('links/team', {items: marks.filter(x => x.id !== m.id), updated: Date.now()}).catch(() => {}); };

    /* links dropped in from the rest of m360, the helper, or the desktop */
    useEffect(() => {
      const drain = () => { for (const q of M.web.take()) openNew(q.url); };
      drain();
      const un = M.web.on(drain);
      const onMsg = e => {
        const d = e.data;
        if (!d || typeof d !== 'object' || !d.m360ext) return;
        if (d.m360ext === 'open' && d.url) openNew(String(d.url));
        /* a link inside reading mode: the m360 page navigates the frame, so the request carries the session */
        if (d.m360ext === 'go' && d.url) { const t = tabsRef.current[curRef.current]; if (t && (t.mode === 'proxy' || t.mode === 'reader')) go(String(d.url)); }
        /* the frame moved on its own (a link inside it): the address and history follow */
        if (d.m360ext === 'nav' && d.url) {
          const t = tabsRef.current[curRef.current];
          const ttl = String(d.title || '').trim().slice(0, 80);
          if (t && t.url !== d.url) patch(t.id, x => ({url: String(d.url), title: ttl || (hostOf(d.url) + pathOf(d.url)), hist: x.hist.slice(0, x.at + 1).concat([String(d.url)]), at: x.at + 1, loading: false}));
          else if (t) patch(t.id, {loading: false, title: ttl || t.title});
          setTyped(String(d.url));
          clearTimeout(timer.current); setSlow(false);
        }
      };
      window.addEventListener('message', onMsg);
      return () => { un(); window.removeEventListener('message', onMsg); };
    }, [openNew, go]);

    /* the desktop: native views follow the slot, the active tab, and report back */
    useEffect(() => {
      if (!nat) return;
      const un1 = nat.onUpdate(p => {
        setTabs(ts => ts.map(t => t.nid === p.id ? {...t, url: p.url || t.url, title: p.title || t.title, icon: p.favicon || t.icon, loading: !!p.loading, canBack: !!p.canBack, canFwd: !!p.canFwd} : t));
        const t = tabsRef.current[curRef.current];
        if (t && t.nid === p.id && p.url) setTyped(p.url);
      });
      const un2 = nat.onNew ? nat.onNew(p => { const t = newTab(p.url || ''); t.nid = p.id; t.title = hostOf(p.url || '') || 'New tab'; setTabs(ts => ts.concat([t])); setCur(tabsRef.current.length); nat.activate(p.id); }) : () => {};
      return () => { un1 && un1(); un2 && un2(); nat.hide && nat.hide(); };
    }, [nat]);
    useEffect(() => {
      if (!nat || !slotRef.current) return;
      const el = slotRef.current;
      const report = () => { const r = el.getBoundingClientRect(); nat.setBounds({x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height)}); };
      report();
      const ro = new ResizeObserver(report); ro.observe(el);
      window.addEventListener('scroll', report, true); window.addEventListener('resize', report);
      return () => { ro.disconnect(); window.removeEventListener('scroll', report, true); window.removeEventListener('resize', report); };
    }, [nat, focus, phone, tab && tab.mode, tab && tab.url, tab && tab.nid]);
    useEffect(() => { if (nat && tab && tab.nid != null) nat.activate(tab.nid); else if (nat && nat.hide) nat.hide(); }, [nat, cur, tab && tab.nid]);

    /* keys: Cmd L the address, Cmd T a tab, Cmd W close, Escape leaves full screen */
    useEffect(() => {
      const onKey = e => {
        const mod = e.metaKey || e.ctrlKey;
        const typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target.id !== 'web-url';
        if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); if (urlRef.current) { urlRef.current.focus(); urlRef.current.select(); } }
        else if (mod && e.key.toLowerCase() === 't' && !typing) { e.preventDefault(); openNew(''); setTimeout(() => urlRef.current && urlRef.current.focus(), 30); }
        else if (mod && e.key.toLowerCase() === 'w' && !typing) { e.preventDefault(); closeTab(curRef.current); }
        else if (e.key === 'Escape' && document.body.classList.contains('web-focus') && !document.querySelector('.drawer, .buddy-bubble')) setFocus(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [openNew]);

    const list = marks.length ? marks : STARTERS.map(s => ({...s, id: 's:' + s.title, starter: true}));
    const proxied = tab && tab.mode === 'proxy' && !nat;
    const reading = tab && tab.mode === 'reader' && !nat;
    const canBack = tab && (nat ? tab.canBack : tab.at > 0), canFwd = tab && (nat ? tab.canFwd : tab.at < tab.hist.length - 1);

    const rail = html`<aside class="web-rail" id="web-rail">
      <div class="web-address">
        <input ref=${urlRef} id="web-url" class="input" placeholder="Search or type an address" value=${typed} onInput=${e => setTyped(e.target.value)}
          onKeyDown=${e => { if (e.key === 'Enter') go(typed); }} onFocus=${e => e.target.select()} aria-label="Address" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck="false"/>
        <${UI.Btn} sm=${true} id="web-go" onClick=${() => go(typed)}>Go<//>
      </div>
      <div class="micro" style=${{marginTop: '10px'}}>spaces</div>
      <div class="web-spaces" id="web-marks">
        ${list.map(m => html`<button key=${m.id} type="button" class="web-space" title=${m.url} onClick=${() => go(m.url)}>
          <${Favicon} url=${m.url} title=${m.title}/><span>${m.title}</span>
          ${m.starter ? null : html`<span class="web-space-x" role="button" aria-label=${'Remove ' + m.title} onClick=${e => { e.stopPropagation(); remove(m); }}><${icons.x}/></span>`}
        </button>`)}
        ${tab && tab.url ? html`<button type="button" class="web-space add" id="web-save" onClick=${() => { setTitle(hostOf(tab.url)); setAdding(true); }}><span class="web-letter">+</span><span>Add this</span></button>` : null}
      </div>
      ${adding ? html`<div class="row nowrap" style=${{gap: '6px', marginTop: '8px'}}>
        <input id="web-title" class="input grow" placeholder="Name it" value=${title} onInput=${e => setTitle(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }} aria-label="Space name"/>
        <${UI.Btn} sm=${true} onClick=${add}>Save<//></div>` : null}
      <div class="row between" style=${{marginTop: '14px'}}><span class="micro">tabs</span><button type="button" class="linky tiny" id="web-newtab" onClick=${() => { openNew(''); setTimeout(() => urlRef.current && urlRef.current.focus(), 30); }}>New tab</button></div>
      <div class="web-tabs" role="tablist" id="web-tabs">
        ${tabs.map((t, i) => html`<div key=${t.id} class=${'web-tab' + (i === cur ? ' active' : '') + (t.loading ? ' loading' : '')} role="tab" aria-selected=${i === cur}>
          <button type="button" class="web-tab-btn" onClick=${() => setCur(i)}>
            ${t.url ? (t.icon ? html`<img class="web-ico" alt="" src=${t.icon}/>` : html`<${Favicon} url=${t.url} title=${t.title}/>`) : html`<span class="web-letter">+</span>`}
            <span class="web-tab-title">${t.title || 'New tab'}</span>
          </button>
          <button type="button" class="web-tab-x" aria-label=${'Close ' + (t.title || 'tab')} onClick=${() => closeTab(i)}><${icons.x}/></button>
        </div>`)}
      </div>
      ${nat ? html`<div class="tiny ink62" style=${{marginTop: '12px'}}>m360 Desktop: every site opens here.</div>`
        : standalone() && !phone ? html`<div class="tiny ink62 web-foot" id="web-foot">Sites that need a sign-in, like Google or LinkedIn, open in <a href=${DESKTOP_URL} target="_blank" rel="noopener" data-out="1">m360 Desktop</a>.</div>` : null}
    </aside>`;

    const toolbar = html`<div class="web-toolbar">
      <button type="button" class="iconbtn" id="web-back" aria-label="Back" title="Back" disabled=${!canBack} onClick=${back}><${icons.up}/></button>
      <button type="button" class="iconbtn" id="web-fwd" aria-label="Forward" title="Forward" disabled=${!canFwd} onClick=${fwd}><${icons.down}/></button>
      <button type="button" class="iconbtn" id="web-reload" aria-label="Reload" title="Reload" disabled=${!tab || !tab.url} onClick=${reload}><${icons.clock}/></button>
      <div class="web-pill grow" title=${tab && tab.url || ''} onClick=${() => { if (urlRef.current) { urlRef.current.focus(); urlRef.current.select(); } }}>
        ${tab && tab.url ? html`<${Favicon} url=${tab.url} title=${tab.title}/><span class="web-pill-host">${hostOf(tab.url)}</span><span class="web-pill-path">${pathOf(tab.url)}</span>` : html`<span class="ink62">Search or type an address (Cmd L)</span>`}
        ${tab && tab.loading ? html`<span class="web-spin" aria-hidden="true"/>` : null}
      </div>
      <button type="button" class="iconbtn" id="web-focus" aria-label=${focus ? 'Leave full screen' : 'Full screen'} title=${focus ? 'Leave full screen (Escape)' : 'Full screen inside m360'} onClick=${() => setFocus(f => !f)}><${focus ? icons.x : icons.more}/></button>
      ${tab && tab.url ? html`<button type="button" class="linky tiny" id="web-out" onClick=${() => openOut()}>Outside</button>` : null}
    </div>`;

    const stage = !tab || !tab.url ? html`<div class="web-stage-empty" id="web-empty">
        <div class="web-hello"><${M.Mark} width="120px"/><div class="ink62" style=${{marginTop: '10px'}}>Search or type an address on the left. Your spaces are the team's shared apps.</div></div>
      </div>`
      : nat ? html`<div ref=${slotRef} class="web-slot" id="web-slot"/>`
      : proxied ? html`<div class="web-frame-wrap" id="web-proxy-wrap">
        <div class="web-note row between small"><span class="ink62"><b>${hostOf(tab.url)}</b> refuses frames, so this is reading mode: the page as m360 fetched it. ${tab.check && tab.check.signin ? 'Signing in needs m360 Desktop.' : 'Public pages only.'}</span>
          <span class="row nowrap" style=${{gap: '6px'}}><button type="button" class="linky tiny" id="web-text" onClick=${() => readerFor(tab.id, tab.url)}>Just the text</button><button type="button" class="linky tiny" onClick=${() => patch(tab.id, {mode: 'frame', check: null, key: tab.key + 1, loading: true})}>Try the frame</button><button type="button" class="linky tiny" onClick=${() => openOut()}>Outside</button></span></div>
        <iframe key=${'p' + tab.key} id="web-frame" class="web-frame" data-mode="proxy" src=${proxyUrl(tab.url)} title=${hostOf(tab.url)} onLoad=${loaded}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerPolicy="no-referrer"/>
      </div>`
      : reading ? html`<div class="web-reader" id="web-reader">
        <div class="web-note row between small"><span class="ink62">The text of <b>${hostOf(tab.url)}</b>.</span>
          <span class="row nowrap" style=${{gap: '6px'}}><button type="button" class="linky tiny" onClick=${() => patch(tab.id, {mode: 'proxy', key: tab.key + 1, loading: true})}>Reading mode</button><button type="button" class="linky tiny" onClick=${() => openOut()}>Outside</button></span></div>
        <div class="web-reader-body">
          ${!tab.reader ? html`<${M.Thinking} label="Reading the page"/>`
            : tab.reader.err ? html`<div class="small flame-t">${tab.reader.err}</div>`
            : html`<div class="reader">
              <h2 style=${{margin: '0 0 8px'}}>${tab.reader.title || hostOf(tab.url)}</h2>
              <div class="reader-text">${tab.reader.text || 'Nothing readable here.'}</div>
              ${(tab.reader.links || []).length ? html`<div class="micro" style=${{marginTop: '14px'}}>links on this page</div>
                <div class="row" style=${{gap: '6px', flexWrap: 'wrap', marginTop: '6px'}}>${tab.reader.links.map((l, i) => html`<button key=${i} type="button" class="chip" title=${l.href} onClick=${() => go(l.href)}>${l.label}</button>`)}</div>` : null}
            </div>`}
        </div>
      </div>`
      : html`<div class="web-frame-wrap">
        ${slow ? html`<div class="web-slow row between small"><span class="ink62">${hostOf(tab.url)} has not drawn anything yet. Some sites refuse frames without saying so.</span>
          <span class="row nowrap" style=${{gap: '6px'}}>${standalone() ? html`<${UI.Btn} sm=${true} id="web-readmode" onClick=${() => patch(tab.id, {mode: 'proxy', check: {why: 'blank frame'}, key: tab.key + 1, loading: true})}>Reading mode<//>` : null}<${UI.Btn} kind="sec" sm=${true} onClick=${() => openOut()}>Open outside<//></span></div>` : null}
        <iframe key=${tab.key} id="web-frame" class="web-frame" src=${tab.url} title=${hostOf(tab.url)} onLoad=${loaded}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" referrerPolicy="no-referrer-when-downgrade" allow="clipboard-write; fullscreen; camera; microphone"/>
      </div>`;

    return html`<div class=${'web' + (focus ? ' full' : '') + (phone ? ' phone' : '')} id="web">
      ${rail}
      <section class="web-stage">${toolbar}${stage}</section>
    </div>`;
  }

  /* Admin: how the browser reaches sites that refuse frames. Reading mode is automatic; the desktop app
     and the frame helper are the two ways to get every site, logins included. */
  function BrowserCard() {
    return html`<${UI.Card} id="browser-card" title="The browser">
      <div class="stack tight small">
        <div><b>Reading mode</b> is on for everyone: a site that refuses frames is fetched by the team site and shown here, links included. Public pages only; nothing to install.</div>
        <div><b>m360 Desktop</b> is the real thing: every site, every login, inside the same m360. Mac and Windows installers are on the <a href=${DESKTOP_URL} target="_blank" rel="noopener" data-out="1">releases page</a> (a GitHub sign-in with access to the repo is needed to download).</div>
        <div><b>The frame helper</b> is a small Chrome or Edge extension for laptops that stay in the browser: sites that only refuse by header open in the frame, and their pop-out links come back inside. <a href="m360-frame-helper.zip" download data-out="1">Download</a>, unzip, then in chrome://extensions switch on Developer mode, tap Load unpacked and pick the folder. Google, Meet, LinkedIn and WhatsApp still refuse by their own rules.</div>
      </div>
    <//>`;
  }
  M.parts.BrowserCard = BrowserCard;

  M.pages.Web = Web;
})();
