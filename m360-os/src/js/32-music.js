/* module: music. The team's playlist and a player that keeps playing while you move around m360.
   Paste a Spotify, Apple Music or YouTube link: it becomes a card in the shared list (music/team), and
   Play puts it in the dock at the bottom, which stays mounted across every section. Full songs on
   Spotify and Apple need you signed in to that service in this browser; otherwise you get previews.
   YouTube plays in full. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;

  const DOC = 'music/team';
  const subs = new Set();
  let now = null;   /* {id, title, kind, embed, url, by} */
  let open = true;
  const emit = () => subs.forEach(f => { try { f({now, open}); } catch (e) { /* page handler */ } });

  /* a public link into an embeddable player */
  function embedOf(url) {
    let u;
    try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'open.spotify.com') {
      const m = /^\/(intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(u.pathname);
      if (m) return {kind: 'spotify', embed: 'https://open.spotify.com/embed/' + m[2] + '/' + m[3] + '?utm_source=m360', label: m[2]};
    }
    if (h === 'music.apple.com') {
      return {kind: 'apple', embed: 'https://embed.music.apple.com' + u.pathname + u.search, label: (u.pathname.split('/')[2] || 'music')};
    }
    if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be' || h === 'music.youtube.com') {
      const id = h === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : (u.searchParams.get('v') || (/^\/(embed|shorts)\/([^/?]+)/.exec(u.pathname) || [])[2] || '');
      const list = u.searchParams.get('list');
      if (id) return {kind: 'youtube', embed: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0' + (list ? '&list=' + encodeURIComponent(list) : ''), label: 'video'};
      if (list) return {kind: 'youtube', embed: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(list) + '&autoplay=1', label: 'playlist'};
    }
    if (h === 'soundcloud.com') return {kind: 'soundcloud', embed: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u.href) + '&auto_play=true', label: 'track'};
    return null;
  }

  M.music = {
    embedOf,
    play(item) { now = item; open = true; emit(); },
    stop() { now = null; emit(); },
    toggle() { open = !open; emit(); },
    state: () => ({now, open}),
    on: f => { subs.add(f); return () => subs.delete(f); }
  };

  /* ---------- the page: the team's list ---------- */
  function Music() {
    const ctx = M.useCtx();
    const doc = M.useDoc(ctx.db, DOC);
    const items = (doc.data && Array.isArray(doc.data.items)) ? doc.data.items : [];
    const [link, setLink] = useState('');
    const [title, setTitle] = useState('');
    const [st, setSt] = useState(M.music.state());
    useEffect(() => M.music.on(setSt), []);
    const probe = useMemo(() => embedOf(link), [link]);
    const ids = useMemo(() => Array.from(new Set(items.map(i => i.by).filter(Boolean))), [items]);
    const profs = M.useProfiles(ids);
    const add = async () => {
      const e = embedOf(link);
      if (!e) { M.toast('Paste a Spotify, Apple Music, YouTube or SoundCloud link', true); return; }
      const item = {id: U.uid(), title: (title.trim() || (e.kind + ' ' + e.label)).slice(0, 80), url: link.trim(), kind: e.kind, embed: e.embed, by: ctx.uid, at: Date.now()};
      await ctx.W.merge(DOC, {items: items.concat([item]).slice(-200), updated: Date.now()}).catch(() => {});
      setLink(''); setTitle(''); M.toast('Added to the team list');
    };
    const remove = async it => { await ctx.W.merge(DOC, {items: items.filter(x => x.id !== it.id), updated: Date.now()}).catch(() => {}); };
    const kindPill = k => html`<${UI.Pill} kind=${k === 'spotify' ? 'ink' : 'warm'}>${k}<//>`;
    return html`<div class="stack" style=${{gap: '14px'}}>
      <${UI.Card} title="Add to the team list" id="music-add">
        <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
          <input id="music-link" class="input" style=${{flex: '2 1 260px'}} placeholder="Paste a Spotify, Apple Music, YouTube or SoundCloud link" value=${link} onInput=${e => setLink(e.target.value)} aria-label="Music link"/>
          <input id="music-title" class="input" style=${{flex: '1 1 160px'}} placeholder="Name it, optional" value=${title} onInput=${e => setTitle(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') add(); }} aria-label="Name"/>
          <${UI.Btn} id="music-save" disabled=${!probe} onClick=${add}>Add<//>
        </div>
        <p class="tiny ink62" style=${{margin: '8px 0 0'}}>Full songs on Spotify and Apple Music need you signed in to that service in this browser; otherwise you hear previews. YouTube plays in full.</p>
      <//>
      <${UI.Card} title="The team's list" id="music-list" action=${html`<span class="tiny ink62">${items.length} ${items.length === 1 ? 'pick' : 'picks'}</span>`}>
        ${!items.length ? html`<${UI.Empty} text="Nothing yet. Paste the first link above."/>` : html`<div class="music-grid">
          ${items.slice().reverse().map(it => html`<div key=${it.id} class=${'music-card' + (st.now && st.now.id === it.id ? ' playing' : '')}>
            <div class="row between nowrap" style=${{gap: '8px'}}>
              <div style=${{minWidth: 0}}><div class="music-title">${it.title}</div><div class="tiny ink62">${kindPill(it.kind)} <${UI.Name} id=${it.by}/> · ${U.timeAgo(it.at)}</div></div>
              <span class="row nowrap" style=${{gap: '4px'}}>
                <${UI.Btn} sm=${true} onClick=${() => M.music.play(it)}>${st.now && st.now.id === it.id ? 'Playing' : 'Play'}<//>
                ${it.by === ctx.uid || ctx.isFounder ? html`<button type="button" class="iconbtn" aria-label="Remove" onClick=${() => remove(it)}><${icons.x}/></button>` : null}
              </span>
            </div>
          </div>`)}
        </div>`}
      <//>
    </div>`;
  }

  /* ---------- the dock: stays mounted, keeps playing ---------- */
  function MusicDock() {
    const [st, setSt] = useState(M.music.state());
    useEffect(() => M.music.on(setSt), []);
    if (!st.now) return null;
    const n = st.now;
    const tall = n.kind === 'youtube' ? 200 : n.kind === 'apple' ? 175 : 152;
    return html`<div class=${'music-dock' + (st.open ? '' : ' folded')} id="music-dock">
      <div class="row between nowrap music-dock-head">
        <button type="button" class="music-dock-title" onClick=${() => M.music.toggle()} title=${st.open ? 'Fold the player' : 'Show the player'} aria-label=${(st.open ? 'Fold the player: ' : 'Show the player: ') + n.title}>
          <span class="music-eq" aria-hidden="true"><i/><i/><i/></span><span class="grow" style=${{minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>${n.title}</span>
        </button>
        <span class="row nowrap" style=${{gap: '2px'}}>
          <button type="button" class="iconbtn" aria-label="Open the list" title="The team's list" onClick=${() => M.nav('#music')}><${icons.more}/></button>
          <button type="button" class="iconbtn" aria-label="Stop" title="Stop" onClick=${() => M.music.stop()}><${icons.x}/></button>
        </span>
      </div>
      <iframe class="music-frame" style=${{height: tall + 'px'}} src=${n.embed} title=${n.title} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms" referrerPolicy="strict-origin-when-cross-origin"/>
    </div>`;
  }

  M.pages.Music = Music;
  M.parts.Music = Music;
  M.parts.MusicDock = MusicDock;
})();
