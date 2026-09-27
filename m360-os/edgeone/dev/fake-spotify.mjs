/* dev only: Spotify's authorize page as the server side check sees it. The client id the tests use gets
   a redirect to the sign in; any other 32 character id gets Spotify's invalid client page; a redirect URI
   Spotify was not told about gets the invalid redirect page. */
const GOOD = 'abcdef0123456789abcdef0123456789';
const KNOWN_REDIRECTS = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/$/;

const page = (body, status) => new Response('<!DOCTYPE html><html><body>' + body + '</body></html>', {status: status || 200, headers: {'content-type': 'text/html; charset=utf-8'}});

export async function fakeSpotify(url) {
  const u = String(url);
  if (!u.startsWith('https://accounts.spotify.com/authorize')) return null;
  const q = new URL(u).searchParams;
  globalThis.__spotifyChecks = (globalThis.__spotifyChecks || []).concat([{client_id: q.get('client_id'), redirect_uri: q.get('redirect_uri')}]);
  if (q.get('client_id') !== GOOD) return page('<div class="error">INVALID_CLIENT: Invalid client</div>');
  if (!KNOWN_REDIRECTS.test(q.get('redirect_uri') || '')) return page('<div class="error">INVALID_CLIENT: Invalid redirect URI</div>');
  return new Response('', {status: 302, headers: {location: 'https://accounts.spotify.com/login?continue=authorize'}});
}
