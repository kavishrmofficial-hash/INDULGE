/* spotify: what the server can say about a client ID before anyone signs in, which is only its shape.
   Checked from a GitHub runner on 27 Sep 2026: Spotify's authorize page answers every request, a bogus
   client ID included, with a 303 to its sign in and validates the client only after the sign in; its
   token endpoint answers an unknown client and a wrong secret with the same "Invalid client secret".
   So this check reads the format and explains what Spotify's own errors mean. Nothing is stored. */

const CLIENT_OK = /^[a-f0-9]{32}$/i;

export function spotifyActions(h) {
  const {levelOf, LEVEL, HttpError} = h;
  const need = async (v, level) => { if (!v) throw new HttpError(401, 'noid'); const l = await levelOf(v.uid); if (l < level) throw new HttpError(403, 'not_granted', 'not allowed'); return l; };

  const actions = {
    async spotifycheck(v, body, req) {
      await need(v, LEVEL.interact);
      const clientId = String(body.clientId || '').trim();
      const site = String((req && req.site) || '');
      const redirect = site + '/';
      if (!CLIENT_OK.test(clientId)) return {ok: false, why: 'A Spotify client ID is 32 letters and digits. This one is ' + clientId.length + ' characters. Copy the Client ID from the top of the app page, above the other key.', redirect};
      return {ok: true, why: 'The format is right. Spotify confirms a client ID only after someone signs in. If Spotify then says INVALID_CLIENT: Invalid client, this ID belongs to no app in its dashboard; if it says Invalid redirect URI, the app must list exactly ' + redirect + ' under Redirect URIs, saved.', redirect};
    }
  };
  return {actions};
}
