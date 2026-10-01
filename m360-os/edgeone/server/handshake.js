/* handshake: the LinkedIn DM desk's verification step. Before a line is written about a company, the
   server looks it up: the last ninety days of Google News for the name, and the company's own site
   when the desk knows its address (through the Base or a typed domain). Nothing here writes to d/;
   the people and their messages are ordinary documents (dm/<id>) the page writes.

     n/dmv/<hash>    {company, site, news, at}    a lookup, kept twelve hours */

import {parseFeed, hash} from './radar.js';

const TTL = 12 * 60 * 60 * 1000;
const FETCH_MS = 12000;
const NEWS_MAX = 8;
const DAYS = 90;
const GN = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-IN&gl=IN&ceid=IN:en';

export function handshakeActions(h) {
  const {env, getJ, putJ, levelOf, LEVEL, HttpError, peek} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);

  async function get(url) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_MS);
    try {
      const r = await doFetch(url, {signal: ctl.signal, redirect: 'follow', headers: {'user-agent': 'Mozilla/5.0 (compatible; m360-handshake/1.0)', accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5'}});
      if (!r || !r.ok) throw new Error('http ' + (r ? r.status : 0));
      return await r.text();
    } finally { clearTimeout(t); }
  }

  return {
    /* {company, site?}: what the press said in the last ninety days, and the site as text when known */
    async dmverify(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const company = String((body && body.company) || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      if (company.length < 2) throw new HttpError(400, 'invalid_argument', 'a company name is needed');
      const site = String((body && body.site) || '').trim().slice(0, 300);
      const key = 'n/dmv/' + hash(company.toLowerCase() + '|' + site.toLowerCase());
      const cached = await getJ(key).catch(() => null);
      if (cached && Date.now() - (cached.at || 0) < TTL) return {...cached, cached: true};
      const out = {company, site: null, news: [], at: Date.now()};
      const since = Date.now() - DAYS * 86400000;
      try {
        const items = parseFeed(await get(GN('"' + company + '"')), 'Google News');
        out.news = items.filter(it => !it.published || it.published >= since).slice(0, NEWS_MAX)
          .map(it => ({title: it.title, source: it.source, link: it.link, at: it.published || 0, summary: String(it.summary || '').slice(0, 240)}));
      } catch (e) { out.newsError = String((e && e.message) || 'no news').slice(0, 80); }
      if (site && peek) {
        try {
          const p = await peek(v, {url: site});
          out.site = {url: p.url, title: p.title || '', description: p.description || '', text: String(p.text || '').slice(0, 3000)};
        } catch (e) { out.siteError = String((e && e.message) || 'site unreachable').slice(0, 80); }
      }
      await putJ(key, out).catch(() => {});
      return out;
    }
  };
}
