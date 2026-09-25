/* module: web. A browser inside m360: an address bar, the team's shared bookmarks, and the page in a frame.
   Some sites refuse to be framed (banks, Google apps, most logins); those open in a new tab with one tap,
   and the frame says so instead of sitting blank. Bookmarks live in links/team, editable by anyone. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const STARTERS = [
    {title: 'Google', url: 'https://www.google.com/webhp?igu=1'},
    {title: 'Wikipedia', url: 'https://www.wikipedia.org'},
    {title: 'Canva', url: 'https://www.canva.com'},
    {title: 'Apollo', url: 'https://app.apollo.io'},
    {title: 'LinkedIn', url: 'https://www.linkedin.com'},
    {title: 'Notion', url: 'https://www.notion.so'}
  ];
  const clean = u => {
    let s = String(u || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = (/\s/.test(s) || !/\./.test(s)) ? 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(s) : 'https://' + s;
    try { const x = new URL(s); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; }
  };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  function Web() {
    const ctx = M.useCtx();
    const doc = M.useDoc(ctx.db, 'links/team');
    const marks = (doc.data && Array.isArray(doc.data.items)) ? doc.data.items : [];
    const [typed, setTyped] = useState('');
    const [url, setUrl] = useState(() => { try { return sessionStorage.getItem('m360.web') || ''; } catch (e) { return ''; } });
    const [slow, setSlow] = useState(false);
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const timer = useRef(0);
    useEffect(() => { try { if (url) sessionStorage.setItem('m360.web', url); } catch (e) { /* private */ } }, [url]);
    const go = u => {
      const c = clean(u);
      if (!c) { M.toast('That does not look like an address', true); return; }
      setUrl(c); setTyped(c); setSlow(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSlow(true), 6000);
    };
    const loaded = () => { clearTimeout(timer.current); setSlow(false); };
    const openTab = u => { try { window.open(u || url, '_blank', 'noopener'); } catch (e) { /* blocked */ } };
    const add = async () => {
      const c = clean(url);
      if (!c) return;
      const items = marks.filter(m => m.url !== c).concat([{id: U.uid(), title: (title || hostOf(c)).slice(0, 60), url: c, by: ctx.uid, at: Date.now()}]).slice(-60);
      await ctx.W.merge('links/team', {items, updated: Date.now()}).catch(() => {});
      setAdding(false); setTitle(''); M.toast('Bookmarked for the team');
    };
    const remove = async m => {
      await ctx.W.merge('links/team', {items: marks.filter(x => x.id !== m.id), updated: Date.now()}).catch(() => {});
    };
    const list = marks.length ? marks : STARTERS.map(s => ({...s, id: 's:' + s.title, starter: true}));
    return html`<div class="stack" style=${{gap: '14px'}}>
      <${UI.Card} id="web-card">
        <div class="row nowrap" style=${{gap: '8px'}}>
          <button type="button" class="iconbtn" aria-label="Back" title="Back" onClick=${() => history.back()}><${icons.up}/></button>
          <input id="web-url" class="input grow" placeholder="Type an address, or search" value=${typed} onInput=${e => setTyped(e.target.value)}
            onKeyDown=${e => { if (e.key === 'Enter') go(typed); }} aria-label="Address" inputMode="url" autoCapitalize="off" autoCorrect="off"/>
          <${UI.Btn} id="web-go" onClick=${() => go(typed)}>Go<//>
          ${url ? html`<${UI.Btn} kind="sec" id="web-tab" onClick=${() => openTab()}>New tab<//>` : null}
          ${url ? html`<${UI.Btn} kind="sec" id="web-save" onClick=${() => { setTitle(hostOf(url)); setAdding(true); }}>Bookmark<//>` : null}
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
      ${url ? html`<${UI.Card} className="web-frame-card">
        ${slow ? html`<div class="row between small" style=${{marginBottom: '8px'}}><span class="ink62">${hostOf(url)} has not drawn anything yet. Sites that refuse a frame open in a new tab.</span>
          <${UI.Btn} sm=${true} onClick=${() => openTab()}>Open in a new tab<//></div>` : null}
        <iframe id="web-frame" class="web-frame" src=${url} title=${hostOf(url)} onLoad=${loaded}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerPolicy="no-referrer-when-downgrade" allow="clipboard-write; fullscreen"/>
      <//>` : html`<${UI.Card}><${UI.Empty} text="Type an address above, or tap a bookmark. Save the pages the team lives in, so nobody has to leave m360."/><//>`}
    </div>`;
  }

  M.pages.Web = Web;
})();
