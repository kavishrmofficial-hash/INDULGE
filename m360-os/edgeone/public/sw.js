/* m360 OS service worker: the shell loads offline, the API always goes to the network */
const CACHE = 'm360-4879cfd.261007-2030';
const SHELL = ['/', '/index.html', '/vendor/react.js', '/vendor/react-dom.js', '/vendor/htm.js', '/manifest.json', '/icon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  /* the page itself is always asked for afresh (no-cache: the server confirms or replaces it); the rest may come from the HTTP cache */
  const fresh = e.request.mode === 'navigate' || /\/(index\.html|sw\.js|version\.json|manifest\.json)?$/.test(u.pathname);
  const cacheable = /^\/(vendor\/|icons\/|icon\.svg$|manifest\.json$|index\.html$|$)/.test(u.pathname) && !u.search;
  e.respondWith(fetch(fresh ? new Request(e.request, {cache: 'no-cache'}) : e.request).then(r => { if (r.ok && cacheable) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
/* a tap on a notification m360 showed (60-notices.js, data.href like '#home'): an open m360 comes forward and
   goes there, else m360 opens on that screen */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const raw = String((e.notification.data && e.notification.data.href) || '');
  const href = /^#[A-Za-z0-9_\-\/.:=~]*$/.test(raw) ? raw : '#home';
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    if (open) return open.focus().catch(() => open).then(c => { (c || open).postMessage({href}); });
    return self.clients.openWindow('/' + href);
  }));
});
