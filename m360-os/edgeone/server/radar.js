/* radar: news, awards and watch feeds fetched server side.

   The page cannot reach the internet on claude.ai, so every feed is fetched here, in the function,
   and served from the blob store. Every blob sits under the n/ prefix:
     n/news           {at, items, errors}     the merged news stream, refreshed every 30 minutes
     n/videos         {at, channels, errors}  the latest videos per YouTube channel, 30 minutes
     n/yt/<handle>    {id, at}                a handle resolved to a channel id
   Nothing here writes to d/ except settings (adding or dropping a channel), through docKey.

   The parser is regex based on purpose: the function has no DOMParser. Feed text is never trusted:
   tags are stripped, entities decoded, and only plain strings leave this file. */

const NEWS_TTL = 30 * 60 * 1000;
const FETCH_MS = 6000;
const KEEP = 200;
const SUMMARY_LEN = 220;
const VIDEOS_PER_CHANNEL = 12;

const GN = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-IN&gl=IN&ceid=IN:en';

/* the default sources: Google News queries are the reliable backbone, publisher feeds add depth */
export const DEFAULT_SOURCES = [
  {id: 'gn-agency-india', name: 'Google News: advertising agency India', url: GN('advertising agency India'), tags: ['india', 'business']},
  {id: 'gn-campaign-india', name: 'Google News: brand campaign India', url: GN('brand campaign India'), tags: ['india', 'campaigns']},
  {id: 'gn-cannes', name: 'Google News: Cannes Lions', url: GN('Cannes Lions'), tags: ['awards']},
  {id: 'gn-dandad', name: 'Google News: D&AD awards', url: GN('D&AD awards'), tags: ['awards']},
  {id: 'gn-effie-india', name: 'Google News: Effie India', url: GN('Effie India'), tags: ['awards', 'india']},
  {id: 'gn-goafest', name: 'Google News: Goafest Abby awards', url: GN('Goafest Abby awards'), tags: ['awards', 'india']},
  {id: 'gn-kyoorius', name: 'Google News: Kyoorius awards', url: GN('Kyoorius awards'), tags: ['awards', 'india']},
  {id: 'gn-oneshow', name: 'Google News: One Show awards', url: GN('One Show awards'), tags: ['awards']},
  {id: 'gn-cmo-india', name: 'Google News: marketing India CMO', url: GN('marketing India CMO'), tags: ['india', 'business']},
  {id: 'gn-influencer-india', name: 'Google News: influencer marketing India', url: GN('influencer marketing India'), tags: ['india', 'creators']},
  {id: 'gn-ott-india', name: 'Google News: OTT advertising India', url: GN('OTT advertising India'), tags: ['india', 'platforms']},
  {id: 'gn-ipl', name: 'Google News: IPL sponsorship', url: GN('IPL sponsorship'), tags: ['india', 'business']},
  {id: 'gn-meta-ads', name: 'Google News: Meta ads', url: GN('Meta ads'), tags: ['platforms']},
  {id: 'gn-yt-creators', name: 'Google News: YouTube creators India', url: GN('YouTube creators India'), tags: ['india', 'creators', 'platforms']},
  {id: 'gn-acquisition', name: 'Google News: agency acquisition', url: GN('agency acquisition'), tags: ['business']},
  {id: 'gn-wins', name: 'Google News: creative agency wins account', url: GN('creative agency wins account'), tags: ['business']},
  {id: 'marketingweek', name: 'Marketing Week', url: 'https://www.marketingweek.com/feed/', tags: ['business', 'campaigns']},
  {id: 'creativereview', name: 'Creative Review', url: 'https://www.creativereview.co.uk/feed/', tags: ['campaigns']},
  {id: 'digiday', name: 'Digiday', url: 'https://digiday.com/feed/', tags: ['business', 'platforms']},
  {id: 'marketingdive', name: 'Marketing Dive', url: 'https://www.marketingdive.com/feeds/news/', tags: ['business', 'campaigns']},
  {id: 'adweek', name: 'Adweek', url: 'https://www.adweek.com/feed/', tags: ['campaigns', 'business']},
  {id: 'socialsamosa', name: 'Social Samosa', url: 'https://www.socialsamosa.com/feed/', tags: ['india', 'platforms', 'creators']},
  {id: 'campaignindia', name: 'Campaign India', url: 'https://www.campaignindia.in/rss/', tags: ['india', 'campaigns']},
  {id: 'afaqs', name: 'afaqs', url: 'https://www.afaqs.com/rss/news', tags: ['india', 'campaigns', 'business']},
  {id: 'thedrum', name: 'The Drum', url: 'https://www.thedrum.com/rss.xml', tags: ['campaigns', 'business']}
];

/* YouTube channels worth a weekly look, by handle */
export const DEFAULT_CHANNELS = [
  {handle: 'CannesLions', name: 'Cannes Lions'},
  {handle: 'dandad', name: 'D&AD'},
  {handle: 'TheOneClub', name: 'The One Club'},
  {handle: 'Adweek', name: 'Adweek'},
  {handle: 'AdAge', name: 'Ad Age'},
  {handle: 'thedrum', name: 'The Drum'},
  {handle: 'marketingweek', name: 'Marketing Week'},
  {handle: 'AdsOfBrands', name: 'Ads of Brands'},
  {handle: 'ThinkwithGoogle', name: 'Think with Google'},
  {handle: 'ContagiousCommunications', name: 'Contagious'},
  {handle: 'LBBOnline', name: 'Little Black Book'},
  {handle: 'campaignindia', name: 'Campaign India'},
  {handle: 'afaqs', name: 'afaqs'}
];

const TAGS = ['india', 'awards', 'campaigns', 'business', 'platforms', 'creators'];
const HANDLE_OK = /^[A-Za-z0-9._-]{2,60}$/;
const CHANNEL_OK = /^UC[A-Za-z0-9_-]{22}$/;
const SOURCE_ID_OK = /^[A-Za-z0-9_-]{1,40}$/;

/* ---------- text: entities, tags, whitespace ---------- */
const NAMED = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: ', ', mdash: ', ', hellip: '...', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', copy: '\u00a9', reg: '\u00ae', trade: '\u2122'};
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') {
      const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      if (!isFinite(n) || n < 32 || n > 0x10ffff) return ' ';
      /* the dashes never reach the page */
      if (n === 0x2013 || n === 0x2014) return ', ';
      try { return String.fromCodePoint(n); } catch (x) { return ' '; }
    }
    return k in NAMED ? NAMED[k] : m;
  });
}
const stripTags = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ');
const unwrapCdata = s => { const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(String(s || '')); return m ? {text: m[1], cdata: true} : {text: String(s || ''), cdata: false}; };
/* plain text out of a feed field: unwrap CDATA, decode, strip, decode again (feeds double encode), tidy */
export function clean(raw) {
  const u = unwrapCdata(raw);
  let t = u.cdata ? u.text : decodeEntities(u.text);
  t = decodeEntities(stripTags(t));
  return t.replace(/[\u2013\u2014]/g, ', ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim();
}
const cut = (s, n) => { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n - 1); const sp = c.lastIndexOf(' '); return (sp > n * 0.6 ? c.slice(0, sp) : c).replace(/[\s,.;:]+$/, '') + '\u2026'; };

/* ---------- a tiny XML reader ---------- */
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* inner text of the first <name> element in a block (namespace prefix included in name) */
function tag(block, name) {
  const m = new RegExp('<' + escRe(name) + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + escRe(name) + '\\s*>', 'i').exec(block);
  return m ? m[1] : '';
}
/* the value of one attribute on the first <name ...> element matching `where` (a regex on the attributes) */
function attr(block, name, att, where) {
  const re = new RegExp('<' + escRe(name) + '\\s([^>]*)\\/?>', 'gi');
  let m;
  while ((m = re.exec(block))) {
    const attrs = m[1];
    if (where && !where.test(attrs)) continue;
    const a = new RegExp('(?:^|\\s)' + escRe(att) + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(attrs);
    if (a) return a[2] != null ? a[2] : a[3];
  }
  return '';
}
const blocks = (xml, name) => String(xml || '').match(new RegExp('<' + name + '(?:\\s[^>]*)?>[\\s\\S]*?<\\/' + name + '\\s*>', 'gi')) || [];

const safeUrl = u => { u = decodeEntities(clean(u)).trim(); return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : ''; };
const when = s => { const t = Date.parse(clean(s)); return isFinite(t) && t > 0 ? t : 0; };

/* RSS 2.0 and Atom, one item shape: {title, link, published, source, summary, ytId, thumb} */
export function parseFeed(xml, fallbackSource) {
  const out = [];
  const x = String(xml || '');
  for (const b of blocks(x, 'item')) {
    let title = clean(tag(b, 'title'));
    const link = safeUrl(tag(b, 'link')) || safeUrl(attr(b, 'link', 'href')) || safeUrl(tag(b, 'guid'));
    const src = clean(tag(b, 'source')) || fallbackSource || '';
    /* Google News titles end with " - Publisher"; the source tag already carries it */
    if (src && title.toLowerCase().endsWith(' - ' + src.toLowerCase())) title = title.slice(0, -(src.length + 3)).trim();
    const summary = cut(clean(tag(b, 'description') || tag(b, 'content:encoded') || tag(b, 'media:description')), SUMMARY_LEN);
    const published = when(tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'published') || tag(b, 'updated'));
    if (title && link) out.push({title, link, published, source: src, summary});
  }
  for (const b of blocks(x, 'entry')) {
    const title = clean(tag(b, 'title'));
    const link = safeUrl(attr(b, 'link', 'href', /rel\s*=\s*["']alternate["']/i)) || safeUrl(attr(b, 'link', 'href', /^(?![\s\S]*rel\s*=)/)) || safeUrl(attr(b, 'link', 'href')) || safeUrl(tag(b, 'id'));
    const ytId = clean(tag(b, 'yt:videoId'));
    const summary = cut(clean(tag(b, 'summary') || tag(b, 'media:description') || tag(b, 'content')), SUMMARY_LEN);
    const published = when(tag(b, 'published') || tag(b, 'updated'));
    const it = {title, link, published, source: fallbackSource || clean(tag(b, 'author') ? tag(tag(b, 'author'), 'name') : ''), summary};
    if (/^[A-Za-z0-9_-]{11}$/.test(ytId)) { it.ytId = ytId; it.thumb = 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg'; if (!it.link) it.link = 'https://www.youtube.com/watch?v=' + ytId; }
    if (title && it.link) out.push(it);
  }
  return out;
}

/* ---------- hashing and keys ---------- */
export function hash(s) {
  let h = 0x811c9dc5;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
const normLink = u => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const normTitle = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- keywords: the founder's watchlist ---------- */
export function markHits(items, keywords) {
  const kws = (Array.isArray(keywords) ? keywords : []).map(k => String(k || '').trim()).filter(k => k.length >= 2).slice(0, 40);
  return items.map(it => {
    const hay = (it.title + ' ' + (it.summary || '')).toLowerCase();
    const hits = kws.filter(k => hay.includes(k.toLowerCase()));
    const o = {...it};
    delete o.hot; delete o.hits;
    if (hits.length) { o.hot = true; o.hits = hits; }
    return o;
  });
}

/* ---------- settings: sources and channels the founder added ---------- */
function sourcesFrom(radar) {
  const off = new Set((Array.isArray(radar.off) ? radar.off : []).map(String));
  const extra = (Array.isArray(radar.sources) ? radar.sources : [])
    .filter(s => s && SOURCE_ID_OK.test(String(s.id || '')) && safeUrl(s.url))
    .map(s => ({id: String(s.id), name: String(s.name || s.id).slice(0, 80), url: safeUrl(s.url),
      tags: (Array.isArray(s.tags) ? s.tags : []).filter(t => TAGS.includes(t))}));
  const seen = new Set();
  return DEFAULT_SOURCES.concat(extra).filter(s => { if (seen.has(s.id) || off.has(s.id)) return false; seen.add(s.id); return true; });
}
function channelsFrom(radar) {
  const extra = (Array.isArray(radar.channels) ? radar.channels : [])
    .filter(c => c && (HANDLE_OK.test(String(c.handle || '')) || CHANNEL_OK.test(String(c.id || ''))))
    .map(c => ({handle: HANDLE_OK.test(String(c.handle || '')) ? String(c.handle) : '', id: CHANNEL_OK.test(String(c.id || '')) ? String(c.id) : '', name: String(c.name || c.handle || '').slice(0, 80)}));
  const gone = new Set((Array.isArray(radar.dropped) ? radar.dropped : []).map(h => String(h).toLowerCase()));
  const seen = new Set();
  return DEFAULT_CHANNELS.map(c => ({...c, id: ''})).concat(extra).filter(c => {
    const k = (c.handle || c.id).toLowerCase();
    if (seen.has(k) || gone.has(k)) return false;
    seen.add(k); return true;
  });
}

export function radarActions(h) {
  const {store, env, getJ, putJ, levelOf, LEVEL, HttpError, docKey} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);

  /* one GET with a hard timeout; the caller decides what a failure means */
  async function get(url, accept) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_MS);
    try {
      const r = await doFetch(url, {signal: ctl.signal, redirect: 'follow',
        headers: {'user-agent': 'Mozilla/5.0 (compatible; m360-radar/1.0)', accept: accept || 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'accept-language': 'en-IN,en;q=0.8'}});
      if (!r || !r.ok) throw new Error('http ' + (r ? r.status : 0));
      return await r.text();
    } finally { clearTimeout(t); }
  }
  const why = e => String((e && (e.name === 'AbortError' ? 'timeout' : e.message)) || 'failed').slice(0, 80);

  async function need(v, level) {
    if (!v) throw new HttpError(401, 'noid');
    const l = await levelOf(v.uid);
    if (l < level) throw new HttpError(403, 'not_granted', 'not allowed');
    return l;
  }
  const radarOf = async () => (((await getJ(docKey('settings/app'))) || {}).radar) || {};

  async function fetchSource(s) {
    try {
      const xml = await get(s.url);
      const items = parseFeed(xml, s.name.replace(/^Google News: /, ''));
      return {ok: true, items: items.map(it => ({...it, sourceId: s.id, tags: s.tags}))};
    } catch (e) { return {ok: false, why: why(e)}; }
  }

  async function refreshNews(radar) {
    const sources = sourcesFrom(radar);
    const results = await Promise.all(sources.map(fetchSource));
    const errors = [];
    let all = [];
    results.forEach((r, i) => { if (r.ok) all = all.concat(r.items); else errors.push({id: sources[i].id, why: r.why}); });
    const now = Date.now();
    all.sort((a, b) => (b.published || 0) - (a.published || 0));
    const seen = new Set();
    const items = [];
    for (const it of all) {
      const kl = normLink(it.link), kt = normTitle(it.title);
      if (seen.has('l:' + kl) || (kt && seen.has('t:' + kt))) continue;
      seen.add('l:' + kl); if (kt) seen.add('t:' + kt);
      items.push({id: hash(kl || kt), title: it.title, link: it.link, at: it.published || now, source: it.source || '', sourceId: it.sourceId,
        tags: it.tags || [], summary: it.summary || '', ...(it.ytId ? {ytId: it.ytId} : {})});
      if (items.length >= KEEP) break;
    }
    return {at: now, items, errors};
  }

  /* a handle to a channel id: the handle page carries it; cached for good under n/yt */
  async function resolveHandle(handle) {
    const key = 'n/yt/' + handle.toLowerCase();
    const c = await getJ(key).catch(() => null);
    if (c && CHANNEL_OK.test(c.id || '')) return c.id;
    const page = await get('https://www.youtube.com/@' + encodeURIComponent(handle), 'text/html');
    const m = /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/.exec(page) || /<meta\s+itemprop="identifier"\s+content="(UC[A-Za-z0-9_-]{22})"/i.exec(page)
      || /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(page);
    if (!m) throw new Error('no channel id on the page');
    await putJ(key, {id: m[1], at: Date.now()}).catch(() => {});
    return m[1];
  }
  async function fetchChannel(c) {
    try {
      const id = c.id || await resolveHandle(c.handle);
      const xml = await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id);
      const entries = parseFeed(xml, c.name).filter(e => e.ytId);
      const name = c.name || clean(tag(xml, 'title')) || c.handle;
      entries.sort((a, b) => (b.published || 0) - (a.published || 0));
      return {ok: true, channel: {handle: c.handle, name, id,
        videos: entries.slice(0, VIDEOS_PER_CHANNEL).map(e => ({ytId: e.ytId, title: e.title, at: e.published || 0, thumb: e.thumb}))}};
    } catch (e) { return {ok: false, why: why(e)}; }
  }
  async function refreshChannels(radar) {
    const list = channelsFrom(radar);
    const results = await Promise.all(list.map(fetchChannel));
    const errors = [], channels = [];
    results.forEach((r, i) => { if (r.ok) channels.push(r.channel); else errors.push({id: list[i].handle || list[i].id, why: r.why}); });
    return {at: Date.now(), channels, errors, keys: channelKeys(list)};
  }

  const channelKeys = list => list.map(c => (c.handle || c.id).toLowerCase()).sort().join(',');

  /* the channel list in settings, edited in place under the normal document key */
  async function editChannels(fn) {
    const key = docKey('settings/app');
    const s = (await getJ(key)) || {};
    const radar = s.radar || {};
    const next = fn({channels: Array.isArray(radar.channels) ? radar.channels.slice() : [], dropped: Array.isArray(radar.dropped) ? radar.dropped.slice() : []});
    const str = JSON.stringify({...s, radar: {...radar, channels: next.channels, dropped: next.dropped}, updated: Date.now()});
    await store.set(key, str);
    if (h.stampKey) await h.stampKey(key, str).catch(() => {});
    await store.delete('n/videos').catch(() => {});
    return next;
  }

  return {
    /* the news stream: cached 30 minutes, keyword hits applied at serve time */
    async news(v, body) {
      const level = await need(v, LEVEL.interact);
      const force = !!(body && body.force) && level >= LEVEL.admin;
      const radar = await radarOf();
      const cached = await getJ('n/news').catch(() => null);
      let out = cached, stale = false;
      if (!cached || force || Date.now() - (cached.at || 0) > NEWS_TTL) {
        const fresh = await refreshNews(radar);
        if (fresh.items.length || !cached) { out = fresh; await putJ('n/news', fresh).catch(() => {}); }
        else stale = true;
      }
      return {at: out.at, items: markHits(out.items || [], radar.keywords), errors: out.errors || [], stale,
        sources: sourcesFrom(radar).map(s => ({id: s.id, name: s.name, tags: s.tags}))};
    },

    /* channels and their latest videos: cached 30 minutes */
    async channels(v, body) {
      const level = await need(v, LEVEL.interact);
      const force = !!(body && body.force) && level >= LEVEL.admin;
      const radar = await radarOf();
      const cached = await getJ('n/videos').catch(() => null);
      let out = cached, stale = false;
      /* a channel added or dropped in settings refreshes the list at once */
      const moved = !!cached && cached.keys !== channelKeys(channelsFrom(radar));
      if (!cached || force || moved || Date.now() - (cached.at || 0) > NEWS_TTL) {
        const fresh = await refreshChannels(radar);
        if (fresh.channels.length || !cached) { out = fresh; await putJ('n/videos', fresh).catch(() => {}); }
        else stale = true;
      }
      return {at: out.at, channels: out.channels || [], errors: out.errors || [], stale};
    },

    /* the founder adds a channel by handle: resolved first, so a typo never lands in settings */
    async addchannel(v, body) {
      await need(v, LEVEL.admin);
      const handle = String((body && body.handle) || '').replace(/^@/, '').trim();
      if (!HANDLE_OK.test(handle)) throw new HttpError(400, 'invalid_argument', 'That does not look like a YouTube handle.');
      let id;
      try { id = await resolveHandle(handle); } catch (e) { throw new HttpError(404, 'invalid_argument', 'No channel found for @' + handle + '.'); }
      let name = String((body && body.name) || '').trim().slice(0, 80);
      if (!name) {
        try { name = clean(tag(await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id), 'title')) || handle; } catch (e) { name = handle; }
      }
      const key = handle.toLowerCase();
      await editChannels(x => ({
        channels: x.channels.filter(c => String(c.handle || '').toLowerCase() !== key).concat([{id, handle, name}]),
        dropped: x.dropped.filter(d => String(d).toLowerCase() !== key)
      }));
      return {ok: true, id, handle, name};
    },
    async dropchannel(v, body) {
      await need(v, LEVEL.admin);
      const handle = String((body && body.handle) || '').replace(/^@/, '').trim();
      if (!HANDLE_OK.test(handle)) throw new HttpError(400, 'invalid_argument', 'bad handle');
      const key = handle.toLowerCase();
      const isDefault = DEFAULT_CHANNELS.some(c => c.handle.toLowerCase() === key);
      await editChannels(x => ({
        channels: x.channels.filter(c => String(c.handle || '').toLowerCase() !== key),
        dropped: isDefault && !x.dropped.some(d => String(d).toLowerCase() === key) ? x.dropped.concat([handle]) : x.dropped
      }));
      return {ok: true};
    }
  };
}
