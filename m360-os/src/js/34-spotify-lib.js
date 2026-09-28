/* module: spotify browser. Spotify inside the Music page, the way the app lays it out: Home (recently
   played, new releases, your top tracks), Search, Your library (playlists, liked songs, albums, artists,
   top, recent), a playlist, an album or an artist opened in place, the queue and the devices. Every row
   plays here through the player in 33-spotify.js; a track can be queued or liked. Spotify keeps its own
   editorial playlists (charts, Discover Weekly) away from new developer apps, so a saved one plays but
   its track list stays with Spotify. Data goes through M.spotify.call and is cached for two minutes. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const TTL = 2 * 60000;
  const cache = {};
  const S = () => M.spotify;
  const art = o => S().art(o);
  const by = list => (list || []).map(a => a.name).join(', ');
  const track = (t, extra) => t ? {kind: 'track', uri: t.uri, id: t.id, name: t.name, by: by(t.artists), art: art(t.album || (extra && extra.album)), ms: t.duration_ms || 0, album: (t.album && t.album.name) || (extra && extra.album && extra.album.name) || ''} : null;
  const album = a => a ? {kind: 'album', uri: a.uri, id: a.id, name: a.name, by: by(a.artists), art: art(a), sub: (a.album_type || 'album') + (a.release_date ? ', ' + String(a.release_date).slice(0, 4) : '') + (a.total_tracks ? ', ' + a.total_tracks + ' tracks' : '')} : null;
  const playlist = p => p ? {kind: 'playlist', uri: p.uri, id: p.id, name: p.name, by: (p.owner && p.owner.display_name) || '', art: art(p), sub: (p.tracks && p.tracks.total ? p.tracks.total + ' tracks' : 'playlist') + (p.owner && p.owner.id === 'spotify' ? ', by Spotify' : ''), spotifyOwned: !!(p.owner && p.owner.id === 'spotify')} : null;
  const artist = a => a ? {kind: 'artist', uri: a.uri, id: a.id, name: a.name, by: (a.genres || []).slice(0, 2).join(', '), art: art(a), sub: a.followers && a.followers.total ? U.compact ? U.compact(a.followers.total) + ' followers' : a.followers.total + ' followers' : 'artist'} : null;
  const fmt = ms => { const s = Math.floor((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* one page of one list; {rows, next} where next is the offset to ask for more, or null */
  async function load(ctx, key, offset) {
    const cid = S().clientIdOf(ctx);
    const k = key + '@' + (offset || 0);
    const hit = cache[k];
    if (hit && Date.now() - hit.at < TTL) return hit.v;
    const call = p => S().call(cid, p);
    let v;
    const off = '&offset=' + (offset || 0);
    if (key === 'recent') { const j = await call('/me/player/recently-played?limit=50'); const seen = new Set(); v = {rows: (j.items || []).map(i => track(i.track)).filter(t => t && !seen.has(t.uri) && seen.add(t.uri)), next: null}; }
    else if (key === 'new') { const j = await call('/browse/new-releases?limit=50' + off); v = {rows: ((j.albums || {}).items || []).map(album).filter(Boolean), next: (j.albums || {}).next ? (offset || 0) + 50 : null}; }
    else if (key === 'toptracks') { const j = await call('/me/top/tracks?limit=50&time_range=short_term'); v = {rows: (j.items || []).map(t => track(t)).filter(Boolean), next: null}; }
    else if (key === 'topartists') { const j = await call('/me/top/artists?limit=50&time_range=short_term'); v = {rows: (j.items || []).map(artist).filter(Boolean), next: null}; }
    else if (key === 'playlists') { const j = await call('/me/playlists?limit=50' + off); v = {rows: (j.items || []).map(playlist).filter(Boolean), next: j.next ? (offset || 0) + 50 : null}; }
    else if (key === 'liked') { const j = await call('/me/tracks?limit=50' + off); v = {rows: (j.items || []).map(i => track(i.track)).filter(Boolean), next: j.next ? (offset || 0) + 50 : null, total: j.total || 0}; }
    else if (key === 'albums') { const j = await call('/me/albums?limit=50' + off); v = {rows: (j.items || []).map(i => album(i.album)).filter(Boolean), next: j.next ? (offset || 0) + 50 : null}; }
    else if (key === 'artists') { const j = await call('/me/following?type=artist&limit=50'); v = {rows: ((j.artists || {}).items || []).map(artist).filter(Boolean), next: null}; }
    else if (key.startsWith('playlist:')) { const j = await call('/playlists/' + encodeURIComponent(key.slice(9)) + '/tracks?limit=100' + off); v = {rows: (j.items || []).map(i => track(i.track)).filter(Boolean), next: j.next ? (offset || 0) + 100 : null}; }
    else if (key.startsWith('album:')) { const j = await call('/albums/' + encodeURIComponent(key.slice(6)) + '/tracks?limit=50' + off); v = {rows: (j.items || []).map(t => track(t)).filter(Boolean), next: j.next ? (offset || 0) + 50 : null}; }
    else if (key.startsWith('artisttop:')) { const j = await call('/artists/' + encodeURIComponent(key.slice(10)) + '/top-tracks?market=from_token'); v = {rows: (j.tracks || []).map(t => track(t)).filter(Boolean), next: null}; }
    else if (key.startsWith('artistalbums:')) { const j = await call('/artists/' + encodeURIComponent(key.slice(13)) + '/albums?limit=50&include_groups=album,single&market=from_token' + off); v = {rows: (j.items || []).map(album).filter(Boolean), next: j.next ? (offset || 0) + 50 : null}; }
    else if (key.startsWith('search:')) {
      const j = await call('/search?q=' + encodeURIComponent(key.slice(7)) + '&type=track,artist,album,playlist&limit=10&market=from_token');
      v = {rows: [].concat(((j.tracks || {}).items || []).map(t => track(t)), ((j.artists || {}).items || []).map(artist), ((j.albums || {}).items || []).map(album), ((j.playlists || {}).items || []).map(playlist)).filter(Boolean), next: null};
    }
    else if (key === 'queue') { const j = await call('/me/player/queue'); v = {rows: (j.queue || []).map(t => track(t)).filter(Boolean), now: track(j.currently_playing), next: null}; }
    else if (key === 'devices') { const j = await call('/me/player/devices'); v = {rows: (j.devices || []).map(d => ({kind: 'device', id: d.id, name: d.name, sub: d.type + (d.is_active ? ', playing now' : ''), active: !!d.is_active})), next: null}; }
    else v = {rows: [], next: null};
    cache[k] = {at: Date.now(), v};
    return v;
  }
  const forget = prefix => { Object.keys(cache).forEach(k => { if (k.startsWith(prefix)) delete cache[k]; }); };

  /* a list that loads itself, with a Load more */
  function useList(ctx, key, on) {
    const [s, setS] = useState({rows: [], next: null, busy: false, err: '', extra: null});
    const keyRef = useRef(key);
    keyRef.current = key;
    const fetchMore = async offset => {
      setS(x => ({...x, busy: true, err: ''}));
      try {
        const v = await load(ctx, key, offset);
        if (keyRef.current !== key) return;
        setS(x => ({rows: offset ? x.rows.concat(v.rows) : v.rows, next: v.next, busy: false, err: '', extra: v}));
      } catch (e) { if (keyRef.current === key) setS(x => ({...x, busy: false, err: (e && e.message) || 'Spotify did not answer'})); }
    };
    useEffect(() => { if (on && key) { setS({rows: [], next: null, busy: true, err: '', extra: null}); fetchMore(0); } }, [key, on]);
    return {...s, more: () => s.next !== null && fetchMore(s.next), reload: () => { forget(key); fetchMore(0); }};
  }

  /* ---------- rows ---------- */
  function Row({r, onOpen, onPlay, onQueue, busy, index}) {
    const openable = r.kind === 'playlist' || r.kind === 'album' || r.kind === 'artist';
    return html`<div class=${'listrow sp-row' + (openable ? ' openable' : '')} data-kind=${r.kind} data-uri=${r.uri || r.id}>
      ${index !== undefined ? html`<span class="tiny sub num sp-idx">${index + 1}</span>` : null}
      ${r.art ? html`<img class=${'sp-art sm' + (r.kind === 'artist' ? ' round' : '')} src=${r.art} alt="" width="36" height="36" loading="lazy"/>` : html`<span class=${'sp-art sm' + (r.kind === 'artist' ? ' round' : '')}/>`}
      ${openable ? html`<button type="button" class="grow sp-open" onClick=${() => onOpen(r)} style=${{minWidth: 0}}>
          <span class="music-title">${r.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${[r.kind, r.by, r.sub].filter(Boolean).join(' · ')}</span></button>`
        : html`<span class="grow" style=${{minWidth: 0}}><span class="music-title">${r.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${[r.by, r.album, r.ms ? fmt(r.ms) : ''].filter(Boolean).join(' · ')}</span></span>`}
      ${r.kind === 'track' && onQueue ? html`<button type="button" class="iconbtn" aria-label=${'Queue ' + r.name} title="Add to the queue" onClick=${() => onQueue(r)}><${icons.plus}/></button>` : null}
      ${r.kind === 'device' ? html`<${UI.Btn} sm=${true} kind=${r.active ? 'ghost' : 'sec'} disabled=${!!busy || r.active} onClick=${() => onPlay(r)}>${r.active ? 'Playing there' : 'Play there'}<//>`
        : html`<${UI.Btn} sm=${true} disabled=${!!busy} onClick=${() => onPlay(r)}>${busy === (r.uri || r.id) ? 'Starting' : 'Play'}<//>`}
    </div>`;
  }
  function List({ctx, list, onOpen, onPlay, onQueue, busy, empty, numbered}) {
    return html`<div class="stack tight sp-list">
      ${list.err ? html`<div class="small flame-t">${list.err}</div>` : null}
      ${list.rows.map((r, i) => html`<${Row} key=${(r.uri || r.id) + i} r=${r} onOpen=${onOpen} onPlay=${onPlay} onQueue=${onQueue} busy=${busy} index=${numbered ? i : undefined}/>`)}
      ${!list.rows.length && !list.busy && !list.err ? html`<${UI.Empty} text=${empty || 'Nothing here yet.'}/>` : null}
      ${list.busy ? html`<div class="tiny sub">Loading</div>` : null}
      ${list.next !== null && !list.busy ? html`<div><${UI.Btn} kind="sec" sm=${true} onClick=${list.more}>Load more<//></div>` : null}
    </div>`;
  }

  /* ---------- the browser ---------- */
  const NAV = [{v: 'home', label: 'Home'}, {v: 'search', label: 'Search'}, {v: 'library', label: 'Your library'}, {v: 'queue', label: 'Queue'}];
  const LIB = [{v: 'playlists', label: 'Playlists'}, {v: 'liked', label: 'Liked songs'}, {v: 'albums', label: 'Albums'}, {v: 'artists', label: 'Artists'}, {v: 'toptracks', label: 'Top tracks'}, {v: 'topartists', label: 'Top artists'}, {v: 'recent', label: 'Recent'}];

  function Browser() {
    const ctx = M.useCtx();
    const [nav, setNav] = useState(() => M.prefs.get('spotify.nav', 'home'));
    const [lib, setLib] = useState(() => M.prefs.get('spotify.lib', 'playlists'));
    const [open, setOpen] = useState(null);      /* {kind, id, name, uri, by, art, spotifyOwned} */
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState('');
    const full = S().fullScope();
    useEffect(() => { M.prefs.set('spotify.nav', nav); }, [nav]);
    useEffect(() => { M.prefs.set('spotify.lib', lib); }, [lib]);

    const listKey = open ? (open.kind === 'playlist' ? 'playlist:' + open.id : open.kind === 'album' ? 'album:' + open.id : 'artisttop:' + open.id)
      : nav === 'home' ? 'recent' : nav === 'search' ? (query ? 'search:' + query : '') : nav === 'library' ? lib : nav === 'queue' ? 'queue' : '';
    const main = useList(ctx, listKey, !!listKey && (full || !/^(recent|playlists|liked|albums|artists|toptracks|topartists|queue)$/.test(listKey)));
    const news = useList(ctx, 'new', nav === 'home' && !open);
    const top = useList(ctx, 'toptracks', nav === 'home' && !open && full);
    const discog = useList(ctx, open && open.kind === 'artist' ? 'artistalbums:' + open.id : '', !!(open && open.kind === 'artist'));
    const devices = useList(ctx, 'devices', nav === 'queue' && !open);

    const fail = e => M.toast((e && e.message) || 'Spotify did not do that', true);
    const label = r => r.name + (r.by ? ', ' + r.by : '');
    /* a track plays from its place in the list it sits in, so the rest follows; a container plays whole */
    const playRow = async r => {
      setBusy(r.uri || r.id);
      try {
        if (r.kind === 'device') { await S().call(S().clientIdOf(ctx), '/me/player', {method: 'PUT', body: JSON.stringify({device_ids: [r.id], play: true}), headers: {'content-type': 'application/json'}}); M.toast('Playing on ' + r.name); forget('devices'); devices.reload(); }
        else if (r.kind === 'track') {
          if (open && (open.kind === 'playlist' || open.kind === 'album')) await S().play(ctx, {context_uri: open.uri, offset: {uri: r.uri}}, label(r), r.uri);
          else { const i = main.rows.findIndex(x => x.uri === r.uri); const uris = (i >= 0 ? main.rows.slice(i) : [r]).filter(x => x.kind === 'track').map(x => x.uri).slice(0, 50); await S().play(ctx, {uris}, label(r), r.uri); }
        }
        else await S().play(ctx, {context_uri: r.uri}, label(r), r.uri);
      } catch (e) { fail(e); }
      setBusy('');
    };
    const queue = r => S().queueAdd(ctx, r.uri).then(() => { forget('queue'); }).catch(fail);
    const openRow = r => { setOpen(r); };
    const back = () => setOpen(null);
    const goSearch = () => { setQuery(q.trim()); setOpen(null); };

    const head = open ? html`<div class="row nowrap sp-head" style=${{gap: '12px'}}>
        <button type="button" class="iconbtn" aria-label="Back" onClick=${back}><${icons.chevL}/></button>
        ${open.art ? html`<img class=${'sp-art' + (open.kind === 'artist' ? ' round' : '')} src=${open.art} alt="" width="52" height="52"/>` : html`<span class="sp-art"/>`}
        <span class="grow" style=${{minWidth: 0}}><span class="card-title" style=${{fontSize: '16px'}}>${open.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${[open.kind, open.by, open.sub].filter(Boolean).join(' · ')}</span></span>
        <${UI.Btn} sm=${true} disabled=${!!busy} onClick=${() => playRow(open)} id="spotify-open-play">Play ${open.kind === 'artist' ? 'artist' : 'all'}<//>
      </div>` : null;

    return html`<div class="sp-browser" id="spotify-browser">
      <div class="row between" style=${{gap: '8px'}}>
        <${UI.Seg} sm=${true} ariaLabel="Spotify" value=${nav} onChange=${v => { setNav(v); setOpen(null); }} options=${NAV}/>
        ${nav === 'library' && !open ? html`<${UI.Seg} sm=${true} ariaLabel="Library" value=${lib} onChange=${v => { setLib(v); setOpen(null); }} options=${LIB}/>` : null}
      </div>
      ${head}
      ${open ? html`
        ${open.spotifyOwned ? html`<div class="tiny ink62">Spotify keeps its own playlists' track lists away from apps like this one; Play all still plays it.</div>` : null}
        <${List} ctx=${ctx} list=${main} onOpen=${openRow} onPlay=${playRow} onQueue=${queue} busy=${busy} numbered=${open.kind !== 'artist'} empty=${open.spotifyOwned ? 'No track list from Spotify for this one.' : 'Nothing in here.'}/>
        ${open.kind === 'artist' ? html`<div style=${{marginTop: '10px'}}><${UI.Micro} plain>albums and singles<//><${List} ctx=${ctx} list=${discog} onOpen=${openRow} onPlay=${playRow} busy=${busy} empty="No albums listed."/></div>` : null}`
      : nav === 'home' ? html`
        ${!full ? html`<div class="tiny ink62">Recently played and your top tracks appear after you reconnect with the full permissions.</div>` : null}
        ${full ? html`<div><${UI.Micro} plain>recently played<//><${List} ctx=${ctx} list=${main} onOpen=${openRow} onPlay=${playRow} onQueue=${queue} busy=${busy} empty="Nothing played recently."/></div>` : null}
        <div style=${{marginTop: '10px'}}><${UI.Micro} plain>new releases<//><${List} ctx=${ctx} list=${news} onOpen=${openRow} onPlay=${playRow} busy=${busy} empty="No new releases listed."/></div>
        ${full ? html`<div style=${{marginTop: '10px'}}><${UI.Micro} plain>your top tracks, last four weeks<//><${List} ctx=${ctx} list=${top} onOpen=${openRow} onPlay=${playRow} onQueue=${queue} busy=${busy} empty="Not enough listening yet."/></div>` : null}`
      : nav === 'search' ? html`
        <div class="row nowrap" style=${{gap: '8px'}}>
          <div class="grow"><${UI.Input} id="spotify-q" value=${q} onChange=${setQ} onEnter=${goSearch} placeholder="Tracks, artists, albums, playlists"/></div>
          <${UI.Btn} kind="sec" disabled=${!q.trim()} onClick=${goSearch} id="spotify-search">Search<//>
        </div>
        ${query ? html`<${List} ctx=${ctx} list=${main} onOpen=${openRow} onPlay=${playRow} onQueue=${queue} busy=${busy} empty="Nothing matches."/>` : null}`
      : nav === 'library' ? html`
        ${!full ? html`<div class="tiny ink62">Reconnect above for the library.</div>` : html`<${List} ctx=${ctx} list=${main} onOpen=${openRow} onPlay=${playRow} onQueue=${queue} busy=${busy} numbered=${lib === 'liked' || lib === 'toptracks'} empty=${lib === 'liked' ? 'No liked songs yet.' : 'Nothing here yet.'}/>`}`
      : html`
        ${main.extra && main.extra.now ? html`<div class="tiny ink62">Now: ${main.extra.now.name}${main.extra.now.by ? ', ' + main.extra.now.by : ''}</div>` : null}
        <${List} ctx=${ctx} list=${main} onOpen=${openRow} onPlay=${playRow} busy=${busy} numbered=${true} empty="The queue is empty. Add tracks with the plus on any row."/>
        <div style=${{marginTop: '10px'}}><${UI.Micro} plain>devices<//><${List} ctx=${ctx} list=${devices} onOpen=${openRow} onPlay=${playRow} busy=${busy} empty="No Spotify device is on right now."/></div>`}
    </div>`;
  }
  M.parts.SpotifyBrowser = Browser;
})();
