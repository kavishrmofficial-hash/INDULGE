/* m360 OS service worker: the shell loads offline, the API always goes to the network */
const CACHE = 'm360-8b2a15f+.260928-0114';
const SHELL = ['/', '/index.html', '/vendor/react.js', '/vendor/react-dom.js', '/vendor/htm.js', '/manifest.json', '/icon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  /* the page itself is always asked for afresh (no-cache: the server confirms or replaces it); the rest may come from the HTTP cache */
  const fresh = e.request.mode === 'navigate' || /\/(index\.html|sw\.js|version\.json|manifest\.json)?$/.test(u.pathname);
  e.respondWith(fetch(fresh ? new Request(e.request, {cache: 'no-cache'}) : e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/index.html'))));
});
