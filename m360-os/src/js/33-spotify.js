/* module: spotify. A real Spotify player inside m360, on the EdgeOne build: each person connects their own
   Spotify once (PKCE in the browser, nothing shared), the Web Playback SDK turns this tab into a Spotify
   device, and the dock plays full tracks with search, play, pause, next and previous. Tokens stay in this
   browser's local storage and never touch the database. What is playing is shared as me/<uid>.listening so
   the team can see it. Premium is needed for the in page player; without it the links play as embeds. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const SHARE_MS = 10 * 60000;
  /* the network side lives in the EdgeOne build only (src/standalone/71-spotify.js); without it there is no player here */
  const net = () => window.M360_SPOTIFY || null;
  const standalone = () => !!net();
  const clientIdOf = ctx => String(((ctx && ctx.settings || {}).spotify || {}).clientId || '').trim();
  const redirectUri = () => (net() ? net().redirectUri() : location.origin + '/');
  const tok = {get: () => (net() ? net().tok.get() : null), clear: () => { if (net()) net().tok.clear(); }};
  const access = clientId => (net() ? net().access(clientId) : Promise.resolve(''));
  async function connect(clientId) {
    if (!clientId) { M.toast('The founder switches Spotify on in Admin first', true); return; }
    if (!net()) { M.toast('The Spotify player runs on the team site', true); return; }
    try { await net().connect(clientId); } catch (e) { M.toast((e && e.message) || 'Spotify did not open', true); }
  }
  /* the outcome of a return from Spotify, reported by the network side when the page loads */
  function returned(r) {
    if (r.ok) { setState({connected: true, error: ''}); M.toast('Spotify connected'); }
    else { setState({error: r.error || 'Spotify did not connect'}); M.toast('Spotify did not connect', true); }
    location.hash = '#music';
  }
  function disconnect() {
    tok.clear();
    if (player) { try { player.disconnect(); } catch (e) { /* gone */ } player = null; deviceId = ''; }
    setState({connected: false, ready: false, track: null, paused: true, position: 0, duration: 0, active: false, premium: null, error: ''});
  }

  /* ---------- the Web API, through the network side ---------- */
  async function call(clientId, path, opts) {
    if (!net()) throw new Error('The Spotify player runs on the team site');
    try { return await net().call(clientId, path, opts); }
    catch (e) { if (e && e.premium === false) setState({premium: false}); throw e; }
  }
  async function search(clientId, q) {
    const j = await call(clientId, '/search?q=' + encodeURIComponent(q) + '&type=track,album,playlist&limit=8&market=from_token');
    const tracks = (((j.tracks || {}).items) || []).filter(Boolean).map(t => ({kind: 'track', uri: t.uri, name: t.name, by: (t.artists || []).map(a => a.name).join(', '), art: art(t.album), ms: t.duration_ms}));
    const albums = (((j.albums || {}).items) || []).filter(Boolean).map(a => ({kind: 'album', uri: a.uri, name: a.name, by: (a.artists || []).map(x => x.name).join(', '), art: art(a)}));
    const lists = (((j.playlists || {}).items) || []).filter(Boolean).map(p => ({kind: 'playlist', uri: p.uri, name: p.name, by: (p.owner && p.owner.display_name) || '', art: art(p)}));
    return tracks.concat(albums, lists);
  }
  const art = o => { const im = (o && o.images) || []; const s = im[im.length - 1] || im[0]; return s ? s.url : ''; };
  async function whoAmI(clientId) {
    const j = await call(clientId, '/me');
    setState({premium: j.product === 'premium', who: j.display_name || ''});
    return j;
  }

  /* ---------- the player in this tab ---------- */
  let player = null, deviceId = '', ticker = null, shared = '';
  let st = {connected: false, ready: false, track: null, paused: true, position: 0, duration: 0, active: false, volume: 0.6, premium: null, who: '', error: '', shuffle: false, repeat: 0, liked: null};
  const subs = new Set();
  function setState(patch) { st = {...st, ...patch}; subs.forEach(f => { try { f(st); } catch (e) { /* page handler */ } }); }
  const loadSdk = () => (net() ? net().loadSdk() : Promise.reject(new Error('The Spotify player runs on the team site')));
  function tick() {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => { if (st.active && !st.paused && st.duration) setState({position: Math.min(st.duration, st.position + 1000)}); }, 1000);
  }
  async function ensurePlayer(ctx) {
    const clientId = clientIdOf(ctx);
    if (player && deviceId) return;
    if (!tok.get()) throw new Error('Connect Spotify first');
    await loadSdk();
    if (!player) {
      player = new window.Spotify.Player({name: 'm360 OS', volume: st.volume, getOAuthToken: cb => access(clientId).then(a => cb(a || ''))});
      player.addListener('ready', ({device_id}) => { deviceId = device_id; setState({ready: true, error: ''}); });
      player.addListener('not_ready', () => { deviceId = ''; setState({ready: false}); });
      player.addListener('initialization_error', ({message}) => setState({error: 'This browser cannot run the player: ' + message}));
      player.addListener('authentication_error', () => { tok.clear(); setState({connected: false, ready: false, error: 'Spotify signed you out. Connect again.'}); });
      player.addListener('autoplay_failed', () => setState({error: 'The browser blocked autoplay. Press play once.'}));
      player.addListener('account_error', () => setState({premium: false, error: 'Spotify Premium is needed for the in page player'}));
      player.addListener('player_state_changed', s => {
        if (!s) { setState({active: false, paused: true}); return; }
        const t = (s.track_window && s.track_window.current_track) || null;
        const track = t ? {uri: t.uri, name: t.name, by: (t.artists || []).map(a => a.name).join(', '), art: art(t.album), album: (t.album && t.album.name) || ''} : null;
        const changed = !st.track || !track || st.track.uri !== track.uri;
        setState({active: !!track, track, paused: !!s.paused, position: s.position || 0, duration: s.duration || 0, shuffle: !!s.shuffle, repeat: Number(s.repeat_mode) || 0, liked: changed ? null : st.liked});
        if (track && changed) likedOf(ctx, track.uri);
        if (track && !s.paused && shared !== track.uri) { shared = track.uri; share(ctx, track); }
      });
      tick();
      const ok = await player.connect();
      if (!ok) { player = null; throw new Error('The player could not connect'); }
    }
    const until = Date.now() + 8000;
    while (!deviceId && Date.now() < until) await new Promise(r => setTimeout(r, 200));
    if (!deviceId) throw new Error('The player is not ready yet. Try again in a second.');
  }
  /* what is playing, shared with the team as me/<uid>.listening */
  function share(ctx, track) {
    if (!ctx || !ctx.W) return;
    ctx.W.merge('me/' + ctx.uid, {listening: {title: String(track.name).slice(0, 120), by: String(track.by).slice(0, 120), uri: track.uri, at: Date.now()}}).catch(() => {});
  }
  async function playUri(ctx, uri, label) {
    return play(ctx, /^spotify:track:/.test(uri) ? {uris: [uri]} : {context_uri: uri}, label, uri);
  }
  /* is the current track in Liked Songs; a like or unlike from the pane */
  async function likedOf(ctx, uri) {
    const id = String(uri || '').split(':')[2];
    if (!id || !hasScope('user-library-read')) return;
    try { const r = await call(clientIdOf(ctx), '/me/tracks/contains?ids=' + encodeURIComponent(id)); if (st.track && st.track.uri === uri) setState({liked: !!(Array.isArray(r) && r[0])}); } catch (e) { /* stays unknown */ }
  }
  async function setLiked(ctx, uri, on) {
    const id = String(uri || '').split(':')[2];
    if (!id) return;
    await call(clientIdOf(ctx), '/me/tracks?ids=' + encodeURIComponent(id), {method: on ? 'PUT' : 'DELETE'});
    if (st.track && st.track.uri === uri) setState({liked: on});
    M.toast(on ? 'Added to Liked Songs' : 'Removed from Liked Songs');
  }
  /* the permissions this connection was granted; the library needs more than the first version asked for */
  const hasScope = name => { const t = tok.get(); return !!(t && String(t.scope || '').split(' ').includes(name)); };
  const NEED = ['user-library-read', 'playlist-read-private', 'user-read-recently-played', 'user-top-read', 'user-follow-read'];
  const fullScope = () => NEED.every(hasScope);
  /* play a body Spotify understands: {uris: [...]} or {context_uri, offset} */
  async function play(ctx, body, label, id) {
    if (player && player.activateElement) { try { player.activateElement().catch(() => {}); } catch (e) { /* older sdk */ } }
    await ensurePlayer(ctx);
    if (player && player.activateElement) { try { player.activateElement().catch(() => {}); } catch (e) { /* older sdk */ } }
    await call(clientIdOf(ctx), '/me/player/play?device_id=' + encodeURIComponent(deviceId), {method: 'PUT', body: JSON.stringify(body), headers: {'content-type': 'application/json'}});
    setState({active: true, paused: false, error: ''});
    M.music.play({id: 'sdk:' + (id || 'play'), title: label || 'Spotify', kind: 'sdk', embed: '', url: linkOf(id || '')});
  }
  async function queueAdd(ctx, uri) {
    await ensurePlayer(ctx);
    await call(clientIdOf(ctx), '/me/player/queue?uri=' + encodeURIComponent(uri) + '&device_id=' + encodeURIComponent(deviceId), {method: 'POST'});
    M.toast('Added to the queue');
  }
  /* what this person's Spotify is playing right now, on any device: {device, track, playing} or null */
  async function nowPlaying(clientId) {
    const j = await call(clientId, '/me/player');
    if (!j || !j.item) return null;
    const it = j.item;
    return {device: (j.device && j.device.name) || '', deviceId: (j.device && j.device.id) || '', playing: !!j.is_playing,
      track: {uri: it.uri, name: it.name, by: (it.artists || []).map(a => a.name).join(', '), art: art(it.album), album: (it.album && it.album.name) || ''}};
  }
  /* pull what is playing elsewhere into this tab */
  async function moveHere(ctx, label) {
    await ensurePlayer(ctx);
    await call(clientIdOf(ctx), '/me/player', {method: 'PUT', body: JSON.stringify({device_ids: [deviceId], play: true}), headers: {'content-type': 'application/json'}});
    setState({active: true, paused: false, error: ''});
    M.music.play({id: 'sdk:here', title: label || 'Spotify', kind: 'sdk', embed: '', url: ''});
  }
  const uriOf = url => { const m = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(String(url || '')); return m ? 'spotify:' + m[1] + ':' + m[2] : ''; };
  const linkOf = uri => { const m = /^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]+)$/.exec(String(uri || '')); return m ? 'https://open.spotify.com/' + m[1] + '/' + m[2] : ''; };
  const canPlayHere = ctx => standalone() && !!clientIdOf(ctx) && !!tok.get() && st.premium !== false;
  const ctl = {
    toggle: () => player && player.togglePlay().catch(() => {}),
    next: () => player && player.nextTrack().catch(() => {}),
    prev: () => player && player.previousTrack().catch(() => {}),
    seek: ms => player && player.seek(ms).catch(() => {}),
    volume: v => { setState({volume: v}); if (player) player.setVolume(v).catch(() => {}); },
    stop: () => { if (player) player.pause().catch(() => {}); setState({active: false, paused: true}); },
    shuffle: (ctx, on) => call(clientIdOf(ctx), '/me/player/shuffle?state=' + (on ? 'true' : 'false') + '&device_id=' + encodeURIComponent(deviceId), {method: 'PUT'}).then(() => setState({shuffle: on})).catch(e => M.toast((e && e.message) || 'Spotify did not change shuffle', true)),
    repeat: (ctx, mode) => call(clientIdOf(ctx), '/me/player/repeat?state=' + ['off', 'context', 'track'][mode] + '&device_id=' + encodeURIComponent(deviceId), {method: 'PUT'}).then(() => setState({repeat: mode})).catch(e => M.toast((e && e.message) || 'Spotify did not change repeat', true))
  };

  M.spotify = {
    state: () => st, on: f => { subs.add(f); return () => subs.delete(f); },
    connected: () => !!tok.get(), canPlayHere, connect, disconnect, returned, search, playUri, play, queueAdd, setLiked, hasScope, fullScope, call, clientIdOf, art, uriOf, linkOf, whoAmI, nowPlaying, moveHere, ctl,
    /* a team list card: play it in the page when this person can, else let the embed handle it */
    tryPlay(ctx, item) {
      if (!item || item.kind !== 'spotify' || !canPlayHere(ctx)) return false;
      const uri = uriOf(item.url);
      if (!uri || /^spotify:(episode|show|artist):/.test(uri)) return false;
      playUri(ctx, uri, item.title).catch(e => { M.toast((e && e.message) || 'Spotify did not play', true); M.music.play({...item}); });
      return true;
    }
  };
  /* the network side loads after this module: pick up the stored connection and hear a sign out */
  setTimeout(() => { if (net()) { setState({connected: !!tok.get()}); net().onSignedOut(p => setState(p)); } }, 0);

  /* ---------- the dock pane while the SDK plays ---------- */
  const fmt = ms => { const s = Math.floor((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const PAUSE = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
  const PREV = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM18 5v14l-9-7z"/></svg>`;
  const NEXT = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM6 5v14l9-7z"/></svg>`;
  const SHUF = html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`;
  const REP = html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  const REP1 = html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>`;
  const HEART = html`<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-8.6C.6 8.7 2.6 4.5 6.6 4.5c2 0 3.5 1 4.4 2.4a5.2 5.2 0 0 1 4.4-2.4c4 0 6 4.2 3.9 7.9C19 16.4 12 21 12 21Z"/></svg>`;
  function Pane({id}) {
    const ctx = M.useCtx();
    const [s, setS] = useState(st);
    useEffect(() => M.spotify.on(setS), []);
    const t = s.track;
    const pct = s.duration ? Math.min(100, 100 * s.position / s.duration) : 0;
    return html`<div class="sp-pane" id=${id || 'spotify-pane'}>
      ${s.error ? html`<div class="tiny flame-t" style=${{padding: '0 10px 6px'}}>${s.error}</div>` : null}
      <div class="row nowrap" style=${{gap: '10px', padding: '2px 10px 8px'}}>
        ${t && t.art ? html`<img class="sp-art" src=${t.art} alt="" width="52" height="52"/>` : html`<span class="sp-art"/>`}
        <div class="grow" style=${{minWidth: 0}}>
          <div class="music-title">${t ? t.name : (s.ready ? 'Ready' : 'Starting the player')}</div>
          <div class="tiny ink62" style=${{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>${t ? t.by : 'Spotify'}</div>
        </div>
      </div>
      <div class="sp-bar" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin="0" aria-valuemax="100" onClick=${e => { const r = e.currentTarget.getBoundingClientRect(); if (s.duration) ctl.seek(Math.round(s.duration * (e.clientX - r.left) / r.width)); }}><i style=${{width: pct + '%'}}/></div>
      <div class="row between nowrap" style=${{padding: '4px 8px 8px'}}>
        <span class="tiny sub num">${fmt(s.position)} / ${fmt(s.duration)}</span>
        <span class="row nowrap" style=${{gap: '2px'}}>
          <button type="button" class=${'iconbtn sp-tog' + (s.shuffle ? ' on' : '')} aria-label=${s.shuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed=${s.shuffle} onClick=${() => ctl.shuffle(ctx, !s.shuffle)}>${SHUF}</button>
          <button type="button" class="iconbtn" aria-label="Previous" onClick=${ctl.prev}>${PREV}</button>
          <button type="button" class="iconbtn sp-play" aria-label=${s.paused ? 'Play' : 'Pause'} onClick=${ctl.toggle}>${s.paused ? html`<${icons.play}/>` : PAUSE}</button>
          <button type="button" class="iconbtn" aria-label="Next" onClick=${ctl.next}>${NEXT}</button>
          <button type="button" class=${'iconbtn sp-tog' + (s.repeat ? ' on' : '')} aria-label=${['Repeat off', 'Repeat all', 'Repeat one'][s.repeat] || 'Repeat'} onClick=${() => ctl.repeat(ctx, (s.repeat + 1) % 3)}>${s.repeat === 2 ? REP1 : REP}</button>
          ${t ? html`<button type="button" class=${'iconbtn sp-tog' + (s.liked ? ' on' : '')} aria-label=${s.liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'} disabled=${s.liked === null} onClick=${() => setLiked(ctx, t.uri, !s.liked).catch(e => M.toast((e && e.message) || 'That did not save', true))}>${HEART}</button>` : null}
        </span>
        <input type="range" class="sp-vol" min="0" max="100" value=${Math.round(s.volume * 100)} aria-label="Volume" onInput=${e => ctl.volume(Number(e.target.value) / 100)}/>
      </div>
    </div>`;
  }
  M.parts.SpotifyDock = Pane;

  /* ---------- the Music page card ---------- */
  function SpotifyCard() {
    const ctx = M.useCtx();
    const [s, setS] = useState(st);
    const [q, setQ] = useState('');
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState('');
    const clientId = clientIdOf(ctx);
    useEffect(() => M.spotify.on(setS), []);
    useEffect(() => { if (standalone() && clientId && tok.get() && s.premium === null) whoAmI(clientId).catch(() => {}); }, [clientId]);
    const go = async () => {
      if (!q.trim()) return;
      setBusy('search');
      try { setRows(await search(clientId, q.trim())); } catch (e) { M.toast((e && e.message) || 'Search failed', true); }
      setBusy('');
    };
    const play = async r => {
      setBusy(r.uri);
      try { await playUri(ctx, r.uri, r.name + (r.by ? ', ' + r.by : '')); } catch (e) { M.toast((e && e.message) || 'Spotify did not play', true); }
      setBusy('');
    };
    const listening = Object.keys(ctx.coll.me.map).map(u => ({u, l: ctx.coll.me.map[u].listening})).filter(x => x.l && x.l.uri && ctx.now - (x.l.at || 0) < SHARE_MS).sort((a, b) => b.l.at - a.l.at);
    const on = standalone() && !!clientId;
    return html`<${UI.Card} title="Spotify in m360" id="spotify-card" action=${on ? html`<${UI.Pill} kind=${s.connected ? 'ink' : 'outline'}>${s.connected ? (s.who ? s.who : 'connected') : 'not connected'}<//>` : null}>
      ${!standalone() ? html`<p class="small ink62" style=${{margin: 0}}>The in page player runs on the team's EdgeOne address. Here, Spotify links play as embeds in the dock.</p>`
      : !clientId ? html`<p class="small ink62" style=${{margin: 0}}>${ctx.isFounder ? 'Switch Spotify on in Admin: paste the client ID from your Spotify developer app and everyone connects their own account here.' : 'The founder has not switched the Spotify player on yet. Links still play as embeds in the dock.'}</p>`
      : !s.connected ? html`<div class="stack tight">
          <p class="small" style=${{margin: 0}}>Connect your own Spotify once and the dock plays full tracks inside m360, with search, next and previous. Spotify Premium is needed for that; without it, links keep playing as embeds.</p>
          <div class="row" style=${{gap: '8px'}}><${UI.Btn} id="spotify-connect" onClick=${() => connect(clientId)}>Connect Spotify<//></div>
          ${s.error ? html`<div class="small flame-t" id="spotify-error">${s.error}${/client|redirect|credential/i.test(s.error) ? ' The founder can run Check with Spotify in Admin to see which of the client ID or the redirect URI Spotify rejects.' : ''}</div>` : null}
        </div>`
      : html`<div class="stack" style=${{gap: '10px'}}>
          ${s.premium === false ? html`<div class="small flame-t">This Spotify account is not Premium, so the in page player cannot play. Links still play as embeds.</div>` : null}
          ${!fullScope() ? html`<div class="row between" id="spotify-rescope"><span class="small">Your library, playlists and history need a permission this connection did not ask for yet.</span><${UI.Btn} sm=${true} onClick=${() => connect(clientId)}>Reconnect for the full library<//></div>` : null}
          ${M.parts.SpotifyBrowser ? html`<${M.parts.SpotifyBrowser}/>` : html`<div class="row nowrap" style=${{gap: '8px'}}>
            <div class="grow"><${UI.Input} id="spotify-q" value=${q} onChange=${setQ} onEnter=${go} placeholder="Search a track, an album or a playlist"/></div>
            <${UI.Btn} kind="sec" disabled=${busy === 'search' || !q.trim()} onClick=${go} id="spotify-search">Search<//>
          </div>`}
          ${rows.length ? html`<div class="stack tight" id="spotify-results">${rows.map(r => html`<div class="listrow" key=${r.uri}>
            ${r.art ? html`<img class="sp-art sm" src=${r.art} alt="" width="36" height="36"/>` : html`<span class="sp-art sm"/>`}
            <span class="grow" style=${{minWidth: 0}}><span class="music-title">${r.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${r.kind}${r.by ? ' · ' + r.by : ''}</span></span>
            <${UI.Btn} sm=${true} disabled=${!!busy} onClick=${() => play(r)}>${busy === r.uri ? 'Starting' : 'Play'}<//>
          </div>`)}</div>` : null}
          <div class="row between">
            <span class="tiny ink62">${s.ready ? 'This tab is a Spotify device called m360 OS.' : 'The player starts with the first Play.'}</span>
            <button type="button" class="linky small" onClick=${disconnect} id="spotify-disconnect">Disconnect</button>
          </div>
        </div>`}
      ${listening.length ? html`<div class="row" style=${{gap: '6px', marginTop: '10px'}} id="spotify-listening">
        ${listening.map(x => html`<span key=${x.u} class="chipline rd-watch"><${UI.Avatar} id=${x.u} size=${18}/><${UI.Name} id=${x.u}/> is listening to <b>${x.l.title}</b>${x.l.by ? ', ' + x.l.by : ''}</span>`)}
      </div>` : null}
    <//>`;
  }
  M.parts.SpotifyCard = SpotifyCard;

  /* ---------- the mini player on Home: there from the first screen after sign in ---------- */
  function SpotifyMini() {
    const ctx = M.useCtx();
    const [s, setS] = useState(st);
    const [q, setQ] = useState('');
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState('');
    const [now, setNow] = useState(null);
    const clientId = clientIdOf(ctx);
    const on = standalone() && !!clientId;
    useEffect(() => M.spotify.on(setS), []);
    /* what is playing elsewhere, refreshed while this card is on screen and nothing plays here */
    useEffect(() => {
      if (!on || !s.connected || s.active) return;
      let gone = false;
      const look = () => nowPlaying(clientId).then(x => { if (!gone) setNow(x); }).catch(() => {});
      look();
      const t = setInterval(look, 30000);
      return () => { gone = true; clearInterval(t); };
    }, [on, s.connected, s.active, clientId]);
    if (!on) return null;
    const go = async () => {
      if (!q.trim()) return;
      setBusy('search');
      try { setRows((await search(clientId, q.trim())).slice(0, 5)); } catch (e) { M.toast((e && e.message) || 'Search failed', true); }
      setBusy('');
    };
    const play = async r => {
      setBusy(r.uri);
      try { await playUri(ctx, r.uri, r.name + (r.by ? ', ' + r.by : '')); setRows([]); setQ(''); } catch (e) { M.toast((e && e.message) || 'Spotify did not play', true); }
      setBusy('');
    };
    const pull = async () => {
      setBusy('move');
      try { await moveHere(ctx, now && now.track ? now.track.name + (now.track.by ? ', ' + now.track.by : '') : 'Spotify'); } catch (e) { M.toast((e && e.message) || 'Could not move it here', true); }
      setBusy('');
    };
    return html`<section class="card sp-mini" id="spotify-mini">
      <div class="row between" style=${{marginBottom: s.connected ? '8px' : '0'}}>
        <div class="row nowrap" style=${{gap: '8px'}}><span class="music-eq" aria-hidden="true"><i/><i/><i/></span><span class="card-title" style=${{fontSize: '15px'}}>Spotify</span>
          ${s.connected && s.ready ? html`<span class="tiny sub">playing here as m360 OS</span>` : null}</div>
        ${s.connected ? html`<button type="button" class="linky small" onClick=${() => M.nav('#music')}>Music</button>` : html`<${UI.Btn} sm=${true} id="spotify-mini-connect" onClick=${() => connect(clientId)}>Connect Spotify<//>`}
      </div>
      ${!s.connected ? null : s.active && s.track ? html`<${Pane} id="spotify-mini-pane"/>` : html`<div class="stack tight">
        ${now && now.track ? html`<div class="row nowrap" style=${{gap: '10px'}} id="spotify-mini-elsewhere">
          ${now.track.art ? html`<img class="sp-art sm" src=${now.track.art} alt="" width="36" height="36"/>` : html`<span class="sp-art sm"/>`}
          <span class="grow" style=${{minWidth: 0}}><span class="music-title">${now.track.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${now.track.by}${now.device ? ', ' + (now.playing ? 'playing on ' : 'paused on ') + now.device : ''}</span></span>
          <${UI.Btn} sm=${true} kind="sec" disabled=${!!busy} onClick=${pull} id="spotify-mini-move">${busy === 'move' ? 'Moving' : 'Play here'}<//>
        </div>` : html`<div class="tiny ink62">${s.premium === false ? 'This Spotify account is not Premium, so the player cannot play here.' : 'Nothing playing yet. Search and press Play, or start something on your phone and pull it here.'}</div>`}
        <div class="row nowrap" style=${{gap: '8px'}}>
          <div class="grow"><${UI.Input} id="spotify-mini-q" value=${q} onChange=${setQ} onEnter=${go} placeholder="Search Spotify"/></div>
          <${UI.Btn} kind="sec" sm=${true} disabled=${busy === 'search' || !q.trim()} onClick=${go} id="spotify-mini-search">Search<//>
        </div>
        ${rows.length ? html`<div class="stack tight" id="spotify-mini-results">${rows.map(r => html`<div class="listrow" key=${r.uri}>
          ${r.art ? html`<img class="sp-art sm" src=${r.art} alt="" width="36" height="36"/>` : html`<span class="sp-art sm"/>`}
          <span class="grow" style=${{minWidth: 0}}><span class="music-title">${r.name}</span><span class="tiny ink62" style=${{display: 'block'}}>${r.kind}${r.by ? ' · ' + r.by : ''}</span></span>
          <${UI.Btn} sm=${true} disabled=${!!busy} onClick=${() => play(r)}>${busy === r.uri ? 'Starting' : 'Play'}<//>
        </div>`)}</div>` : null}
      </div>`}
    </section>`;
  }
  M.parts.SpotifyMini = SpotifyMini;

  /* ---------- Admin: the Spotify app's client ID ---------- */
  function SpotifySettings() {
    const ctx = M.useCtx();
    const cur = clientIdOf(ctx);
    const [id, setId] = useState(cur);
    const [verdict, setVerdict] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setId(cur); }, [cur]);
    if (!ctx.isFounder) return null;
    /* the server asks Spotify whether it knows this client ID and this site's redirect URI */
    const check = async value => {
      if (!standalone() || !value) { setVerdict(null); return; }
      setBusy(true);
      try { setVerdict(await window.M360_API('spotifycheck', {clientId: value})); }
      catch (e) { setVerdict({ok: null, why: (e && e.message) || 'The check did not run.'}); }
      setBusy(false);
    };
    const save = async () => {
      const value = id.trim();
      try { await ctx.W.merge('settings/app', {spotify: {clientId: value}, updated: Date.now()}); } catch (e) { return; }
      M.toast(value ? 'Saved' : 'Spotify player switched off');
      await check(value);
    };
    const copy = () => { try { navigator.clipboard.writeText(redirectUri()); M.toast('Copied'); } catch (e) { /* by hand */ } };
    return html`<${UI.Card} id="spotify-settings" title="Spotify" action=${html`<${UI.Pill} kind=${cur ? 'ink' : 'outline'}>${cur ? 'on' : 'off'}<//>`}>
      <ol class="small" style=${{paddingLeft: '18px', margin: '0 0 10px'}}>
        <li>Open developer.spotify.com/dashboard with the Mask360 Spotify account and create an app called m360 OS. Tick Web Playback SDK and Web API.</li>
        <li>Under Redirect URIs paste exactly:
          <div class="row nowrap" style=${{gap: '6px', marginTop: '4px'}}><code class="grow" style=${{overflow: 'auto'}} id="spotify-redirect">${standalone() ? redirectUri() : 'the team site address, with a trailing slash'}</code>${standalone() ? html`<${UI.Btn} kind="sec" sm=${true} onClick=${copy}>Copy<//>` : null}</div></li>
        <li>Paste the client ID below. There is no client key to paste; each person signs in to their own Spotify.</li>
        <li>A new Spotify app runs in development mode: add each teammate's Spotify email under User Management, up to 25 people. Full playback in the page needs Spotify Premium on their account.</li>
      </ol>
      <div class="row" style=${{gap: '8px', alignItems: 'end'}}>
        <div class="grow" style=${{maxWidth: '520px'}}><${UI.Input} id="spotify-client-id" label="client id (the 32 character Client ID at the top of the app page, above the other key)" value=${id} onChange=${v => { setId(v); setVerdict(null); }} placeholder="32 letters and digits"/></div>
        <${UI.Btn} id="spotify-save" disabled=${id.trim() === cur || busy} onClick=${save}>${cur ? 'Save' : 'Switch Spotify on'}<//>
        ${standalone() && cur ? html`<${UI.Btn} kind="sec" id="spotify-check" disabled=${busy} onClick=${() => check(cur)}>${busy ? 'Checking' : 'Check the ID'}<//>` : null}
      </div>
      ${verdict ? html`<div class=${'small' + (verdict.ok === false ? ' flame-t' : verdict.ok ? '' : ' ink62')} id="spotify-verdict" style=${{marginTop: '8px'}}>${verdict.why}</div>` : null}
      ${standalone() && cur ? html`<div style=${{marginTop: '12px'}}>
        <${UI.Micro} plain>what m360 sends to Spotify when someone presses Connect<//>
        <div class="row nowrap" style=${{gap: '6px', marginTop: '4px'}}><code class="grow" style=${{overflow: 'auto', fontSize: '12px'}} id="spotify-signin-link">${'https://accounts.spotify.com/authorize?client_id=' + cur + '&response_type=code&redirect_uri=' + encodeURIComponent(redirectUri()) + '&scope=streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state'}</code>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => { try { navigator.clipboard.writeText('client_id=' + cur + ' redirect_uri=' + redirectUri()); M.toast('Copied'); } catch (e) { /* by hand */ } }}>Copy<//></div>
        <div class="tiny ink62" style=${{marginTop: '4px'}}>The client ID and the redirect URI in this link must match the app page in the Spotify dashboard character for character.</div>
      </div>` : null}
    <//>`;
  }
  SpotifySettings.foldTitle = 'Spotify';
  SpotifySettings.foldSummary = 'the player inside m360';
  M.adminCards.push(SpotifySettings);
})();
