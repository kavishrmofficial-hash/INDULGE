/* module: browse network. Only in the EdgeOne build: the one request the Web section makes for reading
   mode, the server's copy of a page (/api/browse). The page side (src/js/79-web.js) asks this object and
   never makes a network request itself. Resolves {ok, status, blob} and never throws. */
'use strict';
(function () {
  if (!window.M360_STANDALONE) return;
  async function fetchPage(url) {
    let r;
    try { r = await fetch(url, {credentials: 'same-origin'}); }
    catch (e) { return {ok: false, status: 0, blob: null}; }
    if (!r.ok) return {ok: false, status: r.status, blob: null};
    const kind = r.headers.get('x-m360-kind') || '';
    const blob = await r.blob().catch(() => null);
    return {ok: !!blob, status: r.status, blob, kind, url: r.headers.get('x-m360-url') || '', type: r.headers.get('x-m360-type') || ''};
  }
  window.M360_BROWSE = {fetchPage};
})();
