/* peek: a company's public website as text, for the client brain (24-clients.js).

   The page cannot reach the web on claude.ai, so the standalone function reads the site: the homepage,
   plus an about page when the homepage links to one. Scripts, styles and tags are stripped, entities
   decoded, and only plain strings leave this file. The result is cached under n/peek/<domain> for a day.
   Only public http(s) addresses are read: localhost, private ranges and link local addresses are refused. */
import {decodeEntities, clean} from './radar.js';

const FETCH_MS = 6000;
const TTL = 24 * 60 * 60 * 1000;
const TEXT_MAX = 12000;
const PAGE_MAX = 800000;
const LINKS_MAX = 8;
const ABOUT = /about|who-we-are|our-story|company|mission|team|story/i;

/* the host of a public site, or '' when the address is private, local or malformed */
export function publicHost(url) {
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  const h = u.hostname.toLowerCase();
  if (!h || h.indexOf('.') < 0 || h[0] === '[' || h.indexOf(':') >= 0) return '';
  if (h === 'localhost' || /\.(localhost|local|internal|home|lan)$/.test(h)) return '';
  /* wildcard DNS services resolve any name to the address inside it, so they can point at private space */
  if (/\.(nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me|traefik\.me)$/.test(h)) return '';
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return '';
    if (a === 169 && b === 254) return '';
    if (a === 172 && b >= 16 && b <= 31) return '';
    if (a === 192 && b === 168) return '';
    if (a === 100 && b >= 64 && b <= 127) return '';
  }
  return h;
}
export const domainOf = url => publicHost(url).replace(/^www\./, '');

/* the readable text of an html page: no scripts, styles, hidden blocks or tags */
export function textOf(html) {
  const s = String(html || '').slice(0, PAGE_MAX)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|iframe|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer|nav)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return clean(s).slice(0, TEXT_MAX);
}
const metaContent = (html, where) => {
  const re = /<meta\s([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (!where.test(attrs)) continue;
    const c = /(?:^|\s)content\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    if (c) return clean(decodeEntities(c[2] != null ? c[2] : c[3]));
  }
  return '';
};
export function headOf(html) {
  const h = String(html || '').slice(0, PAGE_MAX);
  const t = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(h);
  const title = t ? clean(t[1]).slice(0, 200) : '';
  const description = (metaContent(h, /(?:^|\s)name\s*=\s*["']description["']/i) || metaContent(h, /(?:^|\s)property\s*=\s*["']og:description["']/i)).slice(0, 600);
  return {title, description};
}
/* about-ish links on a page, same site only, absolute, at most LINKS_MAX */
export function aboutLinks(html, base) {
  const out = [];
  const host = publicHost(base);
  const re = /<a\s([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(String(html || '').slice(0, PAGE_MAX))) && out.length < LINKS_MAX) {
    const a = /(?:^|\s)href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[1]);
    if (!a) continue;
    const href = decodeEntities(a[2] != null ? a[2] : a[3]).trim();
    const label = clean(m[2]);
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    let u;
    try { u = new URL(href, base); } catch (e) { continue; }
    u.hash = '';
    const abs = u.toString();
    if (publicHost(abs) !== host) continue;
    if (!(ABOUT.test(u.pathname) || ABOUT.test(label))) continue;
    if (u.pathname === '/' || u.pathname === '') continue;
    if (out.indexOf(abs) < 0) out.push(abs);
  }
  return out;
}

export function peekActions(h) {
  const {env, getJ, putJ, levelOf, LEVEL, HttpError} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);

  /* one GET with a hard timeout; html only; the final address must be public too */
  async function get(url) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_MS);
    try {
      const r = await doFetch(url, {signal: ctl.signal, redirect: 'follow',
        headers: {'user-agent': 'Mozilla/5.0 (compatible; m360-peek/1.0)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en-IN,en;q=0.8'}});
      if (!r || !r.ok) throw new Error('http ' + (r ? r.status : 0));
      if (r.url && !publicHost(r.url)) throw new Error('redirected to a private address');
      const ct = String(r.headers && r.headers.get ? r.headers.get('content-type') || '' : '');
      if (ct && !/text\/html|application\/xhtml|text\/plain/i.test(ct)) throw new Error('that address is a file');
      return {html: await r.text(), url: (r.url && publicHost(r.url)) ? r.url : url};
    } finally { clearTimeout(t); }
  }
  const why = e => String((e && (e.name === 'AbortError' ? 'timeout' : e.message)) || 'failed').slice(0, 80);

  async function need(v, level) {
    if (!v) throw new HttpError(401, 'noid');
    const l = await levelOf(v.uid);
    if (l < level) throw new HttpError(403, 'not_granted', 'not allowed');
    return l;
  }

  async function read(url) {
    let home;
    /* an unreachable site answers {error: {code: 'site_unreachable', message}} with a 502, the shape every action failure has */
    try { home = await get(url); } catch (e) { throw new HttpError(502, 'site_unreachable', why(e)); }
    const head = headOf(home.html);
    const links = aboutLinks(home.html, home.url);
    let text = textOf(home.html);
    const sources = [home.url];
    if (links.length && text.length < TEXT_MAX) {
      try {
        const about = await get(links[0]);
        const more = textOf(about.html);
        if (more) { text = (text + '\n\nABOUT PAGE: ' + more).slice(0, TEXT_MAX); sources.push(about.url); }
      } catch (e) { /* the homepage is enough */ }
    }
    return {url: home.url, title: head.title, description: head.description, text, links, sources, fetchedAt: Date.now()};
  }

  return {
    /* {url} or {domain}: the site as text, cached a day per domain; admins may force a fresh read */
    async peek(v, body) {
      const level = await need(v, LEVEL.interact);
      let raw = String((body && (body.url || body.domain)) || '').trim().slice(0, 500);
      if (raw && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
      const host = publicHost(raw);
      if (!host) throw new HttpError(400, 'invalid_argument', 'Give a public web address that starts with http or https.');
      const domain = host.replace(/^www\./, '');
      const key = 'n/peek/' + domain;
      const force = !!(body && body.force) && level >= LEVEL.admin;
      const cached = await getJ(key).catch(() => null);
      if (cached && !force && Date.now() - (cached.fetchedAt || 0) < TTL) return {...cached, cached: true};
      const out = await read(raw);
      await putJ(key, out).catch(() => {});
      return out;
    }
  };
}
