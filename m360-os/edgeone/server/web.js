/* module: web. Two helpers for the browser inside m360: framecheck asks a site whether it lets itself be
   framed, so the page can say so instead of sitting blank; readpage brings a page's readable text and
   links for the reader view when a site refuses. Both refuse private and local addresses. */
import {publicHost, textOf} from './peek.js';

const PAGE_MAX = 900000;
const READ_TTL = 10 * 60000;
const hashOf = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

/* GET /api/browse?u=<url>: the page, fetched by the server, with the headers that forbid framing gone,
   a <base> so its assets still load from its own site, and every link routed back through here so the
   reader stays inside m360. The page runs sandboxed with an opaque origin, so a link inside asks the
   m360 page to navigate (postMessage go) rather than navigating itself: the sandbox carries no cookies,
   the parent does. No cookies travel to the site either way: this is reading mode, for public pages. */
const BROWSE_MAX = 6 * 1024 * 1024;
const NAV_SCRIPT = `<script>(function(){var P='/api/browse';function go(u){try{parent.postMessage({m360ext:'go',url:String(u)},'*');}catch(e){}}
function targetOf(h){try{var x=new URL(h,location.href);return x.pathname===P?(x.searchParams.get('u')||''):x.href;}catch(e){return '';}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.href||'';if(!/^https?:/i.test(h))return;var t=targetOf(h);if(!t)return;e.preventDefault();e.stopPropagation();go(t);},true);
document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.action||(f.method&&f.method.toLowerCase()==='post'))return;e.preventDefault();var t=targetOf(f.action);if(!t)return;var u=new URL(t);new FormData(f).forEach(function(v,k){if(typeof v==='string')u.searchParams.set(k,v);});go(u.href);},true);
window.open=function(u){if(u)go(String(u));return null;};
try{parent.postMessage({m360ext:'nav',url:document.documentElement.getAttribute('data-m360-url'),title:document.title},'*');}catch(e){}
})();</script>`;
export function browseHandler(h) {
  const {env, levelOf, LEVEL} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const abs = (href, base) => { try { return new URL(href, base).href; } catch (e) { return ''; } };
  const rewrite = (html, pageUrl, self) => {
    let out = html;
    /* meta CSP and frame busters out; a base in, so assets resolve to the site itself */
    out = out.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '');
    if (!/<base\s/i.test(out)) out = out.replace(/<head([^>]*)>/i, '<head$1><base href="' + esc(pageUrl) + '">');
    else out = out.replace(/<base\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/i, m => { const b = abs((/href\s*=\s*["']([^"']*)["']/i.exec(m) || [])[1] || '', pageUrl); return '<base href="' + esc(b || pageUrl) + '">'; });
    /* links come back through here */
    out = out.replace(/(<a\b[^>]*?\shref\s*=\s*)(["'])([^"']*)\2/gi, (m, pre, q, href) => {
      if (/^\s*(#|javascript:|mailto:|tel:)/i.test(href)) return m;
      const target = abs(href, pageUrl);
      return target && /^https?:/i.test(target) ? pre + q + self + '?u=' + encodeURIComponent(target) + q : m;
    });
    out = out.replace(/(<(?:form)\b[^>]*?\saction\s*=\s*)(["'])([^"']*)\2/gi, (m, pre, q, a) => { const t = abs(a, pageUrl); return t && /^https?:/i.test(t) ? pre + q + self + '?u=' + encodeURIComponent(t) + q : m; });
    out = out.replace(/<html([^>]*)>/i, (m, attrs) => '<html' + attrs.replace(/\sdata-m360-url="[^"]*"/, '') + ' data-m360-url="' + esc(pageUrl) + '">');
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, NAV_SCRIPT + '</body>') : out + NAV_SCRIPT;
    return out;
  };
  return async function browse(request, viewerOf) {
    let url;
    try { url = new URL(request.url); } catch (e) { return new Response('bad request', {status: 400}); }
    const v = await viewerOf(request);
    if (!v || (await levelOf(v.uid)) < LEVEL.interact) return new Response('sign in first', {status: 401});
    let target = String(url.searchParams.get('u') || '').trim().slice(0, 2000);
    if (target && !/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) target = 'https://' + target;
    if (!publicHost(target)) return new Response('Give a public web address.', {status: 400});
    const c = new AbortController(); const timer = setTimeout(() => c.abort(), 12000);
    try {
      const r = await doFetch(target, {redirect: 'follow', signal: c.signal, headers: {'user-agent': UA, accept: 'text/html,application/xhtml+xml,image/*,text/css,*/*;q=0.8', 'accept-language': 'en-IN,en;q=0.9'}});
      const type = String(r.headers.get('content-type') || 'text/html');
      const finalUrl = publicHost(r.url || target) ? (r.url || target) : target;
      if (!/text\/html|application\/xhtml/i.test(type)) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > BROWSE_MAX) return new Response('too big', {status: 413});
        return new Response(buf, {status: r.status, headers: {'content-type': type, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff'}});
      }
      let html = await r.text();
      if (html.length > BROWSE_MAX) html = html.slice(0, BROWSE_MAX);
      const self = url.origin + '/api/browse';
      /* the page runs in a sandbox with an opaque origin: its scripts never touch m360's cookies or storage */
      return new Response(rewrite(html, finalUrl, self), {status: r.status >= 400 ? r.status : 200, headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=60', 'x-m360-url': finalUrl,
        'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads', 'x-content-type-options': 'nosniff'}});
    } catch (e) {
      return new Response('<!doctype html><meta charset="utf-8"><body style="font:15px Helvetica,Arial;padding:24px;color:#0a0a0a">That page did not answer in time.</body>', {status: 504, headers: {'content-type': 'text/html; charset=utf-8'}});
    } finally { clearTimeout(timer); }
  };
}

export function webActions(h) {
  const {env, getJ, putJ, levelOf, LEVEL, HttpError} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);
  const need = async v => { if (!v) throw new HttpError(401, 'noid'); if ((await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'invalid_argument'); };
  const cleanUrl = raw => {
    let s = String(raw || '').trim().slice(0, 1500);
    if (s && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    if (!publicHost(s)) throw new HttpError(400, 'invalid_argument', 'Give a public web address.');
    return s;
  };
  const withTimeout = (ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return {signal: c.signal, done: () => clearTimeout(t)}; };
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 m360os';

  return {
    /* does this address let itself sit in a frame? */
    async framecheck(v, body) {
      await need(v);
      const url = cleanUrl(body.url);
      const t = withTimeout(7000);
      try {
        let r = await doFetch(url, {method: 'HEAD', redirect: 'follow', signal: t.signal, headers: {'user-agent': UA, accept: 'text/html,*/*'}}).catch(() => null);
        if (!r || r.status === 405 || r.status === 403 || r.status === 404) r = await doFetch(url, {method: 'GET', redirect: 'follow', signal: t.signal, headers: {'user-agent': UA, accept: 'text/html,*/*', range: 'bytes=0-2048'}});
        const xfo = String(r.headers.get('x-frame-options') || '').trim();
        const csp = String(r.headers.get('content-security-policy') || '');
        const fa = /frame-ancestors\s+([^;]+)/i.exec(csp);
        const ancestors = fa ? fa[1].trim() : '';
        const refuses = !!xfo || (!!ancestors && !/\*/.test(ancestors) && !/^'?self'?$/i.test(ancestors) === true && !/edgeone\.dev|localhost/i.test(ancestors) ? true : (!!ancestors && /^('none'|'self')$/i.test(ancestors)));
        const finalHost = publicHost(r.url || url);
        return {url, finalUrl: r.url || url, status: r.status, frameable: !refuses && !!finalHost, why: xfo ? 'X-Frame-Options ' + xfo : (refuses ? 'frame-ancestors ' + ancestors : ''),
          html: /text\/html/i.test(r.headers.get('content-type') || '')};
      } catch (e) {
        return {url, frameable: true, unknown: true, why: ''};
      } finally { t.done(); }
    },
    /* the readable text of a page, for the reader view */
    async readpage(v, body) {
      await need(v);
      const url = cleanUrl(body.url);
      const key = 'n/rp/' + hashOf(url);
      const cached = await getJ(key).catch(() => null);
      if (cached && Date.now() - (cached.at || 0) < READ_TTL) return {...cached, cached: true};
      const t = withTimeout(9000);
      try {
        const r = await doFetch(url, {redirect: 'follow', signal: t.signal, headers: {'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8'}});
        const html = (await r.text()).slice(0, PAGE_MAX);
        const title = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const text = textOf(html).slice(0, 60000);
        const links = [];
        const seen = new Set();
        const re = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = re.exec(html)) && links.length < 40) {
          let href = m[1].trim();
          try { href = new URL(href, r.url || url).href; } catch (e) { continue; }
          if (!/^https?:/.test(href) || seen.has(href)) continue;
          const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
          if (!label) continue;
          seen.add(href); links.push({href, label});
        }
        const out = {url, finalUrl: r.url || url, status: r.status, title, text, links, at: Date.now()};
        await putJ(key, out).catch(() => {});
        return out;
      } catch (e) {
        throw new HttpError(502, 'unavailable', 'That page did not answer in time.');
      } finally { t.done(); }
    }
  };
}
