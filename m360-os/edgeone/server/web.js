/* module: web. Two helpers for the browser inside m360: framecheck asks a site whether it lets itself be
   framed, so the page can say so instead of sitting blank; readpage brings a page's readable text and
   links for the reader view when a site refuses. Both refuse private and local addresses. */
import {publicHost, textOf} from './peek.js';

const PAGE_MAX = 900000;
const READ_TTL = 10 * 60000;
const hashOf = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

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
