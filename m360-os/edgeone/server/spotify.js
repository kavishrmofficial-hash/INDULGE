/* spotify: one server side check so Admin can say whether Spotify accepts the client ID and the site's
   redirect URI before anyone presses Connect. Spotify's authorize page answers a bad client or a redirect
   it does not know with an error page (INVALID_CLIENT: Invalid client, INVALID_CLIENT: Invalid redirect
   URI) and a good pair with a redirect to its sign in. Nothing is stored and no token is involved. */

const AUTH = 'https://accounts.spotify.com/authorize';
const FETCH_MS = 8000;
const CLIENT_OK = /^[a-f0-9]{32}$/i;

export function spotifyActions(h) {
  const {env, levelOf, LEVEL, HttpError} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);
  const need = async (v, level) => { if (!v) throw new HttpError(401, 'noid'); const l = await levelOf(v.uid); if (l < level) throw new HttpError(403, 'not_granted', 'not allowed'); return l; };

  const actions = {
    async spotifycheck(v, body, req) {
      await need(v, LEVEL.interact);
      const clientId = String(body.clientId || '').trim();
      const site = String((req && req.site) || '');
      const redirect = site + '/';
      if (!CLIENT_OK.test(clientId)) return {ok: false, why: 'A Spotify client ID is 32 letters and digits. This one is ' + clientId.length + ' characters. Copy the Client ID from the top of the app page, above the client secret.', redirect};
      const q = 'client_id=' + encodeURIComponent(clientId) + '&response_type=code&redirect_uri=' + encodeURIComponent(redirect) +
        '&scope=streaming&state=m360check&code_challenge_method=S256&code_challenge=' + encodeURIComponent('m360-check-challenge-0123456789abcdefghijklmnopqrstuv');
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), FETCH_MS);
      let r, text = '';
      try {
        r = await doFetch(AUTH + '?' + q, {method: 'GET', redirect: 'manual', signal: ctl.signal, headers: {'user-agent': 'Mozilla/5.0 (compatible; m360/1.0)', accept: 'text/html'}});
        text = await r.text().catch(() => '');
      } catch (e) { return {ok: null, why: 'Spotify did not answer the check. Try Connect anyway.', redirect}; }
      finally { clearTimeout(t); }
      const status = r ? r.status : 0;
      const m = /INVALID_CLIENT:?\s*([^<\n"]{3,80})/i.exec(text);
      if (m) {
        const why = m[1].trim();
        return {ok: false, why: /redirect/i.test(why) ? 'Spotify does not know this site as a redirect URI. In the app settings add exactly ' + redirect + ' (with the slash) and save.' : 'Spotify does not recognise this client ID: ' + why + '. Copy the Client ID from the top of the app page, above the client secret.', redirect, status};
      }
      if (status >= 300 && status < 400) return {ok: true, why: 'Spotify accepts this client ID and the redirect URI ' + redirect + '.', redirect, status};
      if (status === 200 && /spotify/i.test(text) && !/error/i.test(text.slice(0, 4000))) return {ok: true, why: 'Spotify accepts this client ID and the redirect URI ' + redirect + '.', redirect, status};
      return {ok: null, why: 'Spotify answered ' + status + ' without a clear verdict. Try Connect; the Music page will show what Spotify says.', redirect, status};
    }
  };
  return {actions};
}
