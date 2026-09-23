/* dev only: canned answers for the feeds radar fetches. Return a Response, or null to fall through.
   Two publisher feeds (RSS), one Google News query (RSS with source tags), one publisher that answers 500,
   a YouTube handle page carrying a channelId, and a videos.xml (Atom) with two entries. Every other feed
   or handle gets an empty feed, so the only error on the news stream is the one meant to be there. */

const H = 3600000;
const rfc = ms => new Date(ms).toUTCString();
const iso = ms => new Date(ms).toISOString();
const now = () => Date.now();

const xml = (body, status) => new Response(body, {status: status || 200, headers: {'content-type': 'application/xml; charset=utf-8'}});
const page = body => new Response(body, {status: 200, headers: {'content-type': 'text/html; charset=utf-8'}});

const rss = (title, items) => '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>' + title + '</title>' +
  items.map(i => '<item><title>' + i.title + '</title><link>' + i.link + '</link><guid>' + i.link + '</guid><pubDate>' + rfc(i.at) + '</pubDate>' +
    (i.source ? '<source url="https://example.com">' + i.source + '</source>' : '') + '<description>' + i.desc + '</description></item>').join('') +
  '</channel></rss>';

const MARKETING_WEEK = () => rss('Marketing Week', [
  {title: 'Cannes Lions 2026: the Grand Prix winners every strategist should study', link: 'https://www.marketingweek.com/cannes-lions-grand-prix-2026/', at: now() - 2 * H,
   desc: '<![CDATA[<p>From film to creative effectiveness, the work that took the top prize this year &amp; why the juries picked it.</p>]]>'},
  {title: 'Why CMOs are moving media budgets into creators', link: 'https://www.marketingweek.com/cmo-creator-budgets/', at: now() - 26 * H,
   desc: 'Creator partnerships now take a bigger share of brand budgets than display &#8211; the numbers behind the shift.'},
  {title: 'Unilever reviews its global creative agency roster', link: 'https://www.marketingweek.com/unilever-agency-review/', at: now() - 50 * H,
   desc: 'A review that could move billions in billings across networks and independents.'}
]);

const CREATIVE_REVIEW = () => rss('Creative Review', [
  {title: 'Swisse launches a wellness campaign built around Mumbai creators', link: 'https://www.creativereview.co.uk/swisse-mumbai-creators/', at: now() - 5 * H,
   desc: '&lt;p&gt;The supplement brand Swisse leans on short video and a &quot;morning ritual&quot; idea for its India push.&lt;/p&gt;'},
  {title: 'The best packaging design of the month', link: 'https://www.creativereview.co.uk/packaging-month/', at: now() - 30 * H,
   desc: 'Six pieces of packaging that made us look twice.'},
  {title: 'D&amp;AD announces this year\'s jury presidents', link: 'https://www.creativereview.co.uk/dandad-jury-presidents/', at: now() - 70 * H,
   desc: 'The people who will decide the Pencils.'}
]);

const GOOGLE_NEWS = () => rss('"advertising agency India" - Google News', [
  {title: 'Independent agency wins the Tata Neu creative account - Campaign India', link: 'https://news.google.com/rss/articles/CBMiTata', at: now() - 1 * H,
   source: 'Campaign India', desc: 'Independent agency wins the Tata Neu creative account&nbsp;&nbsp;Campaign India'},
  {title: 'Mumbai agency picks up two Effie India golds - afaqs', link: 'https://news.google.com/rss/articles/CBMiEffie', at: now() - 8 * H,
   source: 'afaqs', desc: 'Mumbai agency picks up two Effie India golds&nbsp;&nbsp;afaqs'},
  {title: 'IPL 2027 sponsorship rates climb 20 percent - Economic Times', link: 'https://news.google.com/rss/articles/CBMiIPL', at: now() - 40 * H,
   source: 'Economic Times', desc: 'IPL 2027 sponsorship rates climb 20 percent&nbsp;&nbsp;Economic Times'}
]);

const CANNES_NEWS = () => rss('"Cannes Lions" - Google News', [
  {title: 'Cannes Lions opens entries for 2027 with two new Lions - The Drum', link: 'https://news.google.com/rss/articles/CBMiCannes', at: now() - 12 * H,
   source: 'The Drum', desc: 'Cannes Lions opens entries for 2027 with two new Lions&nbsp;&nbsp;The Drum'}
]);

const EMPTY_RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>empty</title></channel></rss>';
const EMPTY_ATOM = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>empty</title></feed>';

const CANNES_ID = 'UCcannes000000000000000000'.slice(0, 24);
const channelIdFor = handle => handle.toLowerCase() === 'canneslions' ? CANNES_ID : ('UC' + (handle.toLowerCase().replace(/[^a-z0-9]/g, '') + 'x'.repeat(22)).slice(0, 22));

const VIDEOS = () => '<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">' +
  '<title>Cannes Lions</title><yt:channelId>' + CANNES_ID + '</yt:channelId>' +
  '<entry><id>yt:video:dQw4w9WgXcQ</id><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>' + CANNES_ID + '</yt:channelId><title>Grand Prix winners 2026: the full film</title>' +
  '<link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/><author><name>Cannes Lions</name></author><published>' + iso(now() - 20 * H) + '</published>' +
  '<media:group><media:title>Grand Prix winners 2026: the full film</media:title><media:description>Every Grand Prix from the festival &amp; the juries on why.</media:description></media:group></entry>' +
  '<entry><id>yt:video:9bZkp7q19f0</id><yt:videoId>9bZkp7q19f0</yt:videoId><yt:channelId>' + CANNES_ID + '</yt:channelId><title>How to write a case film that wins</title>' +
  '<link rel="alternate" href="https://www.youtube.com/watch?v=9bZkp7q19f0"/><author><name>Cannes Lions</name></author><published>' + iso(now() - 90 * H) + '</published>' +
  '<media:group><media:title>How to write a case film that wins</media:title><media:description>Three jurors on structure, proof and restraint.</media:description></media:group></entry>' +
  '</feed>';

export async function fakeRadar(url, init) {
  const u = String(url);
  if (u.startsWith('https://www.marketingweek.com/feed')) return xml(MARKETING_WEEK());
  if (u.startsWith('https://www.creativereview.co.uk/feed')) return xml(CREATIVE_REVIEW());
  if (u.startsWith('https://digiday.com/feed')) return new Response('upstream broke', {status: 500});
  if (u.startsWith('https://news.google.com/rss/search')) {
    const q = decodeURIComponent(u);
    return xml(q.includes('advertising agency India') ? GOOGLE_NEWS() : q.includes('q=Cannes Lions&') ? CANNES_NEWS() : EMPTY_RSS);
  }
  if (u.startsWith('https://www.youtube.com/feeds/videos.xml?channel_id=')) {
    const id = u.split('channel_id=')[1];
    if (id === CANNES_ID) return xml(VIDEOS());
    const label = id.slice(2).replace(/x+$/, '') || 'channel';
    return xml('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>' + label + ' channel</title></feed>');
  }
  const m = /^https:\/\/www\.youtube\.com\/@([^/?#]+)/.exec(u);
  if (m) {
    const handle = decodeURIComponent(m[1]);
    if (handle.toLowerCase() === 'nosuchchannel') return new Response('not found', {status: 404});
    return page('<!DOCTYPE html><html><head><meta itemprop="identifier" content="' + channelIdFor(handle) + '"><title>' + handle + ' - YouTube</title></head>' +
      '<body><script>var ytInitialData = {"metadata":{"channelMetadataRenderer":{"channelId":"' + channelIdFor(handle) + '"}}};</script></body></html>');
  }
  /* any other feed a source list may point at: a valid, empty feed */
  if (/\.(xml|rss)(\?|$)|\/feeds?\/|\/rss\/?/.test(u) && !u.includes('api.anthropic.com') && !u.includes('api.resend.com')) return xml(EMPTY_RSS);
  return null;
}
