/* module: spotify network. Only in the EdgeOne build: the part of the Spotify player that talks to Spotify.
   PKCE sign in on accounts.spotify.com, the token exchange and refresh, calls to the Web API with this
   person's token, and the Web Playback SDK script. Tokens live in this browser's local storage only.
   The page side (src/js/33-spotify.js) never makes a network request itself; it asks this object. */
'use strict';
(function () {
  if (!window.M360_STANDALONE) return;
  const AUTH = 'https://accounts.spotify.com/authorize';
  const TOKEN = 'https://accounts.spotify.com/api/token';
  const API = 'https://api.spotify.com/v1';
  const SDK = 'https://sdk.scdn.co/spotify-player.js';
  const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
  const PREF = 'spotify.tok';
  const SS_V = 'm360.spv', SS_S = 'm360.sps', SS_C = 'm360.spc';
  const redirectUri = () => location.origin + '/';

  const tok = {
    get() { try { const t = JSON.parse(M.prefs.get(PREF, 'null')); return t && t.refresh ? t : null; } catch (e) { return null; } },
    set(t) { M.prefs.set(PREF, JSON.stringify(t)); },
    clear() { try { localStorage.removeItem('m360.' + PREF); } catch (e) { /* private window */ } }
  };
  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join(''); };
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const challengeOf = async verifier => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const form = o => Object.keys(o).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  const listeners = new Set();
  const signedOut = why => { tok.clear(); listeners.forEach(f => { try { f({connected: false, error: why}); } catch (e) { /* page handler */ } }); };

  async function exchange(body) {
    const r = await fetch(TOKEN, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: form(body)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || 'Spotify refused the sign in');
    const cur = tok.get() || {};
    const t = {access: j.access_token, refresh: j.refresh_token || cur.refresh || '', exp: Date.now() + (Number(j.expires_in) || 3600) * 1000, at: Date.now()};
    tok.set(t);
    return t;
  }
  /* a fresh access token, refreshed through the refresh token when the old one is about to expire */
  async function access(clientId) {
    const t = tok.get();
    if (!t) return '';
    if (t.access && t.exp - 60000 > Date.now()) return t.access;
    try { return (await exchange({grant_type: 'refresh_token', refresh_token: t.refresh, client_id: clientId})).access; }
    catch (e) { signedOut('Spotify signed you out. Connect again.'); return ''; }
  }
  async function connect(clientId) {
    const verifier = rand(64), state = rand(16);
    try { sessionStorage.setItem(SS_V, verifier); sessionStorage.setItem(SS_S, state); sessionStorage.setItem(SS_C, clientId); } catch (e) { throw new Error('This browser blocks session storage'); }
    const q = {response_type: 'code', client_id: clientId, scope: SCOPES, redirect_uri: redirectUri(), state, code_challenge_method: 'S256', code_challenge: await challengeOf(verifier)};
    location.assign(AUTH + '?' + form(q));
  }
  /* back from Spotify on the site root with ?code=...&state=...: the verifier from this tab turns it into tokens.
     Resolves null when this load is not a return, else {ok, error}. */
  async function finishReturn() {
    let qs;
    try { qs = new URLSearchParams(location.search); } catch (e) { return null; }
    if ((!qs.has('code') && !qs.has('error')) || !qs.has('state')) return null;
    let verifier = '', state = '', clientId = '';
    try { verifier = sessionStorage.getItem(SS_V) || ''; state = sessionStorage.getItem(SS_S) || ''; clientId = sessionStorage.getItem(SS_C) || ''; } catch (e) { /* no session storage */ }
    /* a return this tab did not start (another tab, the installed app or a different browser began the sign in)
       cannot be finished here: say so instead of staying silent */
    if (!verifier || !state) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* fine */ } return {ok: false, error: 'Spotify sent a sign in back, but this tab has no record of starting it. Press Connect Spotify again from this same tab and browser, and finish the sign in there.'}; }
    if (qs.get('state') !== state) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* fine */ } return {ok: false, error: 'Spotify sent back a sign in that does not match the one this tab started. Press Connect Spotify again.'}; }
    try { sessionStorage.removeItem(SS_V); sessionStorage.removeItem(SS_S); sessionStorage.removeItem(SS_C); } catch (e) { /* fine */ }
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* fine */ }
    if (qs.has('error')) return {ok: false, error: 'Spotify said ' + qs.get('error') + (qs.get('error') === 'access_denied' ? ': the sign in was cancelled, or this Spotify account is not on the app\'s user list in the developer dashboard (development mode admits only the people added there).' : '')};
    try {
      await exchange({grant_type: 'authorization_code', code: qs.get('code'), redirect_uri: redirectUri(), client_id: clientId, code_verifier: verifier});
      return {ok: true, error: ''};
    } catch (e) { return {ok: false, error: (e && e.message) || 'Spotify did not connect'}; }
  }
  /* one Web API call with this person's token; errors carry a message the page can show */
  async function call(clientId, path, opts) {
    const a = await access(clientId);
    if (!a) throw new Error('Connect Spotify first');
    const r = await fetch(API + path, {...(opts || {}), headers: {...((opts && opts.headers) || {}), authorization: 'Bearer ' + a}});
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { signedOut('Spotify signed you out. Connect again.'); throw new Error('Connect Spotify again'); }
    if (r.status === 403 && /premium/i.test(JSON.stringify(j))) { const e = new Error('Spotify Premium is needed to play here'); e.premium = false; throw e; }
    if (r.status === 404 && /device/i.test(JSON.stringify(j))) throw new Error('The player is not ready yet. Try again in a second.');
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Spotify answered ' + r.status));
    return j;
  }
  let sdkP = null;
  function loadSdk() {
    if (window.Spotify && window.Spotify.Player) return Promise.resolve();
    if (sdkP) return sdkP;
    sdkP = new Promise((res, rej) => {
      window.onSpotifyWebPlaybackSDKReady = () => res();
      const s = document.createElement('script');
      s.src = SDK; s.async = true;
      s.onerror = () => { sdkP = null; rej(new Error('The Spotify player script did not load')); };
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.Spotify && window.Spotify.Player)) { sdkP = null; rej(new Error('The Spotify player took too long to load')); } }, 15000);
    });
    return sdkP;
  }

  window.M360_SPOTIFY = {tok, access, connect, finishReturn, call, loadSdk, redirectUri, onSignedOut: f => { listeners.add(f); return () => listeners.delete(f); }};
  /* a return from Spotify is handled as soon as the page loads; the page module hears the outcome */
  finishReturn().then(r => { if (r && M.spotify && M.spotify.returned) M.spotify.returned(r); }).catch(() => {});
})();
