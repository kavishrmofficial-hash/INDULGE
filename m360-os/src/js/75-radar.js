/* module: radar. The outside world, India first: who won which account, who joined where, what launched,
   what campaign broke, and awards season, the way exchange4media or afaqs would list it. Feeds are fetched
   by the EdgeOne function (edgeone/server/radar.js), sorted into lanes there and cached; on claude.ai the
   page cannot reach the web, so it shows the directories and the awards table. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useCallback, useRef} = React;

  const SPARK = '✦';
  const KEEP_SAVED = 100;
  const KEEP_POSTS = 80;
  const WATCH_WINDOW = 40 * 60000;
  const CLIENT_TTL = 5 * 60000;

  /* the standalone runtime exists only on the EdgeOne build */
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => live() ? window.M360_API(a, body) : Promise.reject({code: 'unavailable', message: 'no server here'});

  /* ---------- the directory: mirrors the server defaults, so the claude.ai copy can list them ---------- */
  const GN = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-IN&gl=IN&ceid=IN:en';
  const SITE = d => GN('site:' + d);
  const SOURCES = [
    {id: 'gn-agency-india', name: 'Google News: advertising agency India', url: GN('advertising agency India'), tags: ['india', 'accounts']},
    {id: 'gn-wins-india', name: 'Google News: agency wins mandate India', url: GN('agency wins mandate India'), tags: ['india', 'accounts']},
    {id: 'gn-mandate-india', name: 'Google News: creative and media mandates', url: GN('"creative mandate" OR "media mandate" OR "digital mandate" OR "social media mandate" India'), tags: ['india', 'accounts']},
    {id: 'gn-appoints-agency', name: 'Google News: brand appoints agency', url: GN('appoints agency India brand'), tags: ['india', 'accounts']},
    {id: 'gn-cmo-india', name: 'Google News: CMO appointed India', url: GN('"appointed" OR "joins as" OR "named" "chief marketing officer" India'), tags: ['india', 'people']},
    {id: 'gn-marketing-head-india', name: 'Google News: head of marketing moves', url: GN('"head of marketing" OR "marketing head" OR "vice president marketing" joins OR appointed India'), tags: ['india', 'people']},
    {id: 'gn-creative-chief-india', name: 'Google News: creative chiefs', url: GN('"chief creative officer" OR "executive creative director" OR "national creative director" appointed OR joins OR elevated India'), tags: ['india', 'people']},
    {id: 'gn-agency-ceo-india', name: 'Google News: agency leadership', url: GN('agency "managing director" OR CEO OR "chief business officer" appointed OR joins advertising OR media India'), tags: ['india', 'people']},
    {id: 'gn-brand-launch-india', name: 'Google News: brand launches India', url: GN('launches new brand India'), tags: ['india', 'launches']},
    {id: 'gn-campaign-india', name: 'Google News: brand campaign India', url: GN('brand campaign India'), tags: ['india', 'campaigns']},
    {id: 'gn-ad-film-india', name: 'Google News: new ad film India', url: GN('"ad film" OR TVC OR "brand film" India'), tags: ['india', 'campaigns']},
    {id: 'gn-festive-india', name: 'Google News: festive campaign India', url: GN('festive campaign India brand'), tags: ['india', 'campaigns']},
    {id: 'gn-ipl', name: 'Google News: IPL sponsorship', url: GN('IPL sponsorship'), tags: ['india', 'business']},
    {id: 'gn-influencer-india', name: 'Google News: influencer marketing India', url: GN('influencer marketing India'), tags: ['india', 'creators']},
    {id: 'gn-d2c-india', name: 'Google News: D2C brands India', url: GN('D2C brand India marketing'), tags: ['india', 'business']},
    {id: 'gn-cannes', name: 'Google News: Cannes Lions', url: GN('Cannes Lions'), tags: ['awards']},
    {id: 'gn-effie-india', name: 'Google News: Effie India', url: GN('Effie India'), tags: ['awards', 'india']},
    {id: 'gn-goafest', name: 'Google News: Goafest Abby awards', url: GN('Goafest Abby awards'), tags: ['awards', 'india']},
    {id: 'gn-kyoorius', name: 'Google News: Kyoorius awards', url: GN('Kyoorius awards'), tags: ['awards', 'india']},
    {id: 'gn-emvies', name: 'Google News: Emvies', url: GN('Emvies awards'), tags: ['awards', 'india']},
    {id: 'gn-spikes', name: 'Google News: Spikes Asia', url: GN('"Spikes Asia" India'), tags: ['awards', 'india']},
    {id: 'gn-e4m', name: 'exchange4media', url: SITE('exchange4media.com'), tags: ['india', 'business']},
    {id: 'gn-bmi', name: 'BestMediaInfo', url: SITE('bestmediainfo.com'), tags: ['india', 'business']},
    {id: 'gn-campaignindia', name: 'Campaign India', url: SITE('campaignindia.in'), tags: ['india', 'campaigns']},
    {id: 'gn-adgully', name: 'Adgully', url: SITE('adgully.com'), tags: ['india', 'business']},
    {id: 'gn-storyboard18', name: 'Storyboard18', url: SITE('storyboard18.com'), tags: ['india', 'business']},
    {id: 'gn-marketingmind', name: 'Marketing Mind', url: SITE('marketingmind.in'), tags: ['india', 'campaigns']},
    {id: 'afaqs', name: 'afaqs', url: 'https://www.afaqs.com/rss/news', tags: ['india', 'campaigns', 'business']},
    {id: 'be-top', name: 'ET Brand Equity', url: 'https://brandequity.economictimes.indiatimes.com/rss/topstories', tags: ['india', 'business']},
    {id: 'be-marketing', name: 'ET Brand Equity: marketing', url: 'https://brandequity.economictimes.indiatimes.com/rss/marketing', tags: ['india', 'campaigns']},
    {id: 'be-advertising', name: 'ET Brand Equity: advertising', url: 'https://brandequity.economictimes.indiatimes.com/rss/advertising', tags: ['india', 'campaigns']},
    {id: 'be-brands', name: 'ET Brand Equity: business of brands', url: 'https://brandequity.economictimes.indiatimes.com/rss/business-of-brands', tags: ['india', 'business', 'launches']},
    {id: 'be-people', name: 'ET Brand Equity: the people report', url: 'https://brandequity.economictimes.indiatimes.com/rss/the-people-report', tags: ['india', 'people']},
    {id: 'be-digital', name: 'ET Brand Equity: digital', url: 'https://brandequity.economictimes.indiatimes.com/rss/digital', tags: ['india', 'platforms']},
    {id: 'mn4u', name: 'MediaNews4U', url: 'https://www.medianews4u.com/feed/', tags: ['india', 'business']},
    {id: 'mn4u-people', name: 'MediaNews4U: people', url: 'https://www.medianews4u.com/category/people/feed/', tags: ['india', 'people']},
    {id: 'mn4u-advertising', name: 'MediaNews4U: advertising', url: 'https://www.medianews4u.com/category/advertising/feed/', tags: ['india', 'campaigns']},
    {id: 'agencyreporter', name: 'Agency Reporter', url: 'https://www.agencyreporter.com/feed/', tags: ['india', 'business']},
    {id: 'mediasamosa', name: 'Media Samosa', url: 'https://mediasamosa.com/feed/', tags: ['india', 'campaigns']},
    {id: 'socialsamosa', name: 'Social Samosa', url: 'https://www.socialsamosa.com/rss', tags: ['india', 'platforms', 'creators']},
    {id: 'mediabrief', name: 'MediaBrief', url: 'https://mediabrief.com/feed/', tags: ['india', 'campaigns']},
    {id: 'indiantelevision', name: 'Indian Television', url: 'https://www.indiantelevision.com/feed', tags: ['india', 'platforms']},
    {id: 'marketingweek', name: 'Marketing Week', url: 'https://www.marketingweek.com/feed/', tags: ['world', 'business', 'campaigns']},
    {id: 'creativereview', name: 'Creative Review', url: 'https://www.creativereview.co.uk/feed/', tags: ['world', 'campaigns']},
    {id: 'digiday', name: 'Digiday', url: 'https://digiday.com/feed/', tags: ['world', 'business', 'platforms']},
    {id: 'marketingdive', name: 'Marketing Dive', url: 'https://www.marketingdive.com/feeds/news/', tags: ['world', 'business', 'campaigns']},
    {id: 'adweek', name: 'Adweek', url: 'https://www.adweek.com/feed/', tags: ['world', 'campaigns', 'business']},
    {id: 'gn-dandad', name: 'Google News: D&AD awards', url: GN('D&AD awards'), tags: ['awards', 'world']},
    {id: 'gn-oneshow', name: 'Google News: One Show awards', url: GN('One Show awards'), tags: ['awards', 'world']}
  ];
  const CHANNELS = [
    {handle: 'CannesLions', name: 'Cannes Lions'}, {handle: 'dandad', name: 'D&AD'}, {handle: 'TheOneClub', name: 'The One Club'},
    {handle: 'Adweek', name: 'Adweek'}, {handle: 'AdAge', name: 'Ad Age'}, {handle: 'thedrum', name: 'The Drum'},
    {handle: 'marketingweek', name: 'Marketing Week'}, {handle: 'AdsOfBrands', name: 'Ads of Brands'}, {handle: 'ThinkwithGoogle', name: 'Think with Google'},
    {handle: 'ContagiousCommunications', name: 'Contagious'}, {handle: 'LBBOnline', name: 'Little Black Book'},
    {handle: 'campaignindia', name: 'Campaign India'}, {handle: 'afaqs', name: 'afaqs'}
  ];
  const TAGS = [{v: 'india', label: 'India'}, {v: 'world', label: 'World'}, {v: 'people', label: 'People moves'}, {v: 'accounts', label: 'Account moves'},
    {v: 'launches', label: 'Launches'}, {v: 'campaigns', label: 'Campaigns'}, {v: 'awards', label: 'Awards'},
    {v: 'business', label: 'Business'}, {v: 'platforms', label: 'Platforms'}, {v: 'creators', label: 'Creators'}];
  /* the lanes a story is sorted into, the same rules as the server (edgeone/server/radar.js), applied here
     again for a stream cached before the lanes existed */
  const LANES = [{v: 'people', label: 'People moves', empty: 'No marketing person moved this week, as far as the feeds know.'},
    {v: 'accounts', label: 'Account moves', empty: 'No agency won or lost a mandate in the stream right now.'},
    {v: 'launches', label: 'Launches', empty: 'No brand launch in the stream right now.'},
    {v: 'campaigns', label: 'Campaigns', empty: 'No campaign broke in the stream right now.'},
    {v: 'awards', label: 'Awards', empty: 'No awards story in the stream right now.'}];
  const LANE_LABEL = {}; LANES.forEach(l => { LANE_LABEL[l.v] = l.label; });
  const CHIPS = [{v: 'all', label: 'All'}].concat(LANES.map(l => ({v: l.v, label: l.label})), [{v: 'hot', label: 'Watchlist hits'}, {v: 'saved', label: 'Saved'}, {v: 'world', label: 'World'}]);
  /* a people move needs a role word: a brand that joins hands with another is not a person moving */
  const ROLE = '(?:cmo|chief marketing officer|marketing (?:head|director|lead|chief|manager)|head of (?:marketing|brand|digital|social|growth|content|e-?commerce|d2c)|vp|vice president|brand (?:head|director|manager)|chief (?:brand|digital|growth|creative|executive|business|content|revenue) officer|ceo|cco|managing director|executive creative director|national creative director|creative (?:head|director)|director,? marketing|general manager,? marketing)';
  const LANE_RULES = [
    ['people', new RegExp('\\b(?:appoint(?:ed|s)?|names?|named|elevat(?:es|ed)|promot(?:es|ed)|hires?|ropes? in|onboards?|brings? in|welcomes?)\\b[^.]{0,60}\\b(?:as |to |its |their |the |new )?' + ROLE + '\\b' +
      '|\\b(?:joins?|moves? to|quits|exits|steps? down|steps? up|takes? (?:charge|over)|takes? on|returns? to|leaves|departs?|resigns?|retires?)\\b[^.]{0,60}\\b(?:as |from |the |its )?' + ROLE + '\\b' +
      '|\\b(?:new|former|outgoing|incoming) ' + ROLE + '\\b' +
      '|\\b' + ROLE + '\\b[^.]{0,40}\\b(?:steps? down|quits|exits|resigns?|retires?|leaves|departs?|moves? to|joins?)\\b', 'i')],
    ['awards', /\b(award|awards|cannes|lions?|d&ad|pencil|effie|abby|goafest|kyoorius|one show|clio|spikes|adfest|shortlist|grand prix|gold|silver|bronze)\b/i],
    ['accounts', /\b(wins?|bags?|retains?|awarded|picks|selects|appoints|onboards|hands|assigns)\b[^.]{0,60}\b(account|mandate|business|duties|agency|aor|agency of record)\b|\b(creative|media|digital|social media|influencer|pr) (?:mandate|duties|account|aor)\b|\bagency of record\b|\bpitch(?:es)? (?:worth|for)\b/i],
    ['campaigns', /\b(campaign|ad film|tvc|brand film|anthem|ropes? in|brand ambassador|face of|festive|diwali|ipl|world cup|celebrates|out of home|ooh|billboard|jingle|spot)\b/i],
    ['launches', /\b(launch(?:es|ed)?|unveils?|introduces?|debuts?|rolls? out|enters?|forays?|opens? (?:its )?(?:first|new)|rebrands?|new brand|new range|new collection|new store|new product)\b/i]
  ];
  function laneOf(title, summary) {
    const hay = String(title || '') + '. ' + String(summary || '');
    for (const [lane, re] of LANE_RULES) if (re.test(hay)) return lane;
    return 'other';
  }
  const INDIA_RE = /\b(india|indian|bharat|mumbai|delhi|bengaluru|bangalore|gurugram|gurgaon|hyderabad|chennai|kolkata|pune|noida|ahmedabad|jaipur|kochi|goa|rs\.?|rupee|crore|lakh|ipl|bollywood|diwali|dussehra|holi|navratri|tata|reliance|jio|hul|godrej|mahindra|marico|dabur|amul|zomato|swiggy|flipkart|myntra|nykaa|paytm|phonepe|ola|bajaj|hero motocorp|maruti|titan|aditya birla|itc|britannia|parle|emami|boat|mamaearth|lenskart|meesho|cred|dream11|byju|upgrad|physicswallah|zerodha|groww|razorpay|jsw|adani|vedanta|infosys|wipro|tcs|hdfc|icici|sbi|axis bank|kotak|airtel|vi\b|bsnl|starbucks india|ajio|tanishq|caratlane|voltas|blue star|havells|bajaj electricals|hindustan)\b/i;
  function isIndia(it) {
    const tags = it.tags || [];
    const text = String(it.title || '') + ' ' + String(it.summary || '');
    if (tags.includes('world')) return INDIA_RE.test(text);
    if (tags.includes('india')) return true;
    if (/\.in$/i.test(hostOf(it.link))) return true;
    return INDIA_RE.test(text + ' ' + String(it.source || ''));
  }
  /* a stream item with its lane and its India flag, whichever build of the server wrote it */
  const enrich = it => ({...it, lane: it.lane || laneOf(it.title, it.summary), india: typeof it.india === 'boolean' ? it.india : isIndia(it)});

  /* awards season: typical timing only; the site has this year's dates */
  const AWARDS = [
    {name: 'Cannes Lions', what: 'Creative excellence across every discipline, the global benchmark', when: 'usually June', site: 'https://www.canneslions.com'},
    {name: 'D&AD', what: 'Design and advertising craft, the Pencils', when: 'usually May', site: 'https://www.dandad.org'},
    {name: 'The One Show', what: 'Creative ideas and craft across advertising and design', when: 'usually May', site: 'https://www.oneshow.org'},
    {name: 'Clio Awards', what: 'Creative work across advertising, design, sports, music and more', when: 'usually spring', site: 'https://clios.com'},
    {name: 'Effie India', what: 'Marketing effectiveness: campaigns that moved the numbers', when: 'usually late in the year', site: 'https://www.effie.org'},
    {name: 'Goafest with the Abby Awards', what: 'Creative, media and digital work from India', when: 'usually May', site: 'https://www.goafest.com'},
    {name: 'Kyoorius Creative Awards', what: 'Creative and design work from India', when: 'usually late in the year', site: 'https://www.kyoorius.com'},
    {name: 'Spikes Asia', what: 'Creative work from Asia Pacific', when: 'usually early in the year', site: 'https://www.spikes.asia'},
    {name: 'ADFEST', what: 'Creative work from Asia Pacific, held in Thailand', when: 'usually March', site: 'https://www.adfest.com'},
    {name: 'Webby Awards', what: 'Excellence on the internet: sites, video, social and apps', when: 'usually May', site: 'https://www.webbyawards.com'},
    {name: 'Ad Stars', what: 'Creative work with open global entry, held in Busan', when: 'usually August', site: 'https://www.adstars.org'},
    {name: 'London International Awards', what: 'Creative and production craft worldwide', when: 'usually October', site: 'https://www.liaawards.com'},
    {name: 'Epica Awards', what: 'Creative work judged by the trade press', when: 'usually November', site: 'https://www.epica-awards.com'},
    {name: 'Emvies', what: 'Media planning and innovation in India', when: 'usually late in the year', site: ''}
  ];

  /* ---------- pure helpers ---------- */
  const safeUrl = u => /^https?:\/\/[^\s<>"']+$/i.test(String(u || '')) ? String(u) : '';
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const radarOf = ctx => (ctx && ctx.settings && ctx.settings.radar) || {};
  /* every source the founder can switch on or off: defaults plus the ones added in Admin */
  function sourcesOf(ctx) {
    const r = radarOf(ctx);
    const off = new Set(Array.isArray(r.off) ? r.off : []);
    const extra = (Array.isArray(r.sources) ? r.sources : []).filter(s => s && s.id && safeUrl(s.url))
      .map(s => ({id: String(s.id), name: String(s.name || s.id), url: s.url, tags: Array.isArray(s.tags) ? s.tags : [], added: true}));
    const seen = new Set();
    return SOURCES.concat(extra).filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; }).map(s => ({...s, on: !off.has(s.id)}));
  }
  function channelsOf(ctx) {
    const r = radarOf(ctx);
    const gone = new Set((Array.isArray(r.dropped) ? r.dropped : []).map(h => String(h).toLowerCase()));
    const extra = (Array.isArray(r.channels) ? r.channels : []).filter(c => c && (c.handle || c.id))
      .map(c => ({handle: String(c.handle || ''), id: String(c.id || ''), name: String(c.name || c.handle || c.id), added: true}));
    const seen = new Set();
    return CHANNELS.map(c => ({...c, id: ''})).concat(extra).filter(c => {
      const k = (c.handle || c.id).toLowerCase();
      if (seen.has(k) || gone.has(k)) return false;
      seen.add(k); return true;
    });
  }
  const ytUrl = c => c.handle ? 'https://www.youtube.com/@' + c.handle : 'https://www.youtube.com/channel/' + c.id;
  /* a handle out of whatever was pasted: @handle, youtube.com/@handle/videos, a /channel/UC... link, or a bare name */
  function handleFrom(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const ch = /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i.exec(t);
    if (ch) return {id: ch[1], handle: ''};
    const at = /@([A-Za-z0-9._-]{2,60})/.exec(t);
    if (at) return {id: '', handle: at[1]};
    const bare = /^([A-Za-z0-9._-]{2,60})$/.exec(t);
    return bare ? {id: '', handle: bare[1]} : null;
  }
  const keywordsOf = ctx => (Array.isArray(radarOf(ctx).keywords) ? radarOf(ctx).keywords : []).map(k => String(k || '').trim()).filter(k => k.length >= 2);
  /* keyword hits, applied again here so a keyword saved a second ago lights up at once */
  function withHits(items, keywords) {
    return items.map(it => {
      const hay = (String(it.title) + ' ' + String(it.summary || '')).toLowerCase();
      const hits = keywords.filter(k => hay.includes(k.toLowerCase()));
      const all = Array.from(new Set((it.hits || []).concat(hits)));
      return all.length ? {...it, hot: true, hits: all} : {...it, hot: false, hits: []};
    });
  }
  const savedOf = ctx => ((ctx.coll.me.map[ctx.uid] || {}).saved) || {};

  /* ---------- writes ---------- */
  async function toggleSave(ctx, it) {
    const uid = ctx.uid;
    const saved = {...savedOf(ctx)};
    /* every change is a merge of the saved map alone: a null removes an entry, so the rest of the
       profile (the bot's answers and marks, the status, the stamps) is never rewritten from a snapshot */
    if (saved[it.id]) {
      await ctx.W.merge('me/' + uid, {saved: {[it.id]: null}});
      M.toast('Removed from saved');
      return;
    }
    const entry = {title: String(it.title).slice(0, 200), link: it.link, at: Date.now()};
    const ids = Object.keys(saved).sort((a, b) => (saved[b].at || 0) - (saved[a].at || 0));
    const patch = {[it.id]: entry};
    if (ids.length >= KEEP_SAVED) ids.slice(KEEP_SAVED - 1).forEach(k => { patch[k] = null; });
    await ctx.W.merge('me/' + uid, {saved: patch});
    M.sound.play('tick');
    M.toast('Saved');
  }
  /* a link post on the feed, by the current person */
  async function postLink(ctx, text, link) {
    const uid = ctx.uid;
    const mine = ((ctx.coll.feed.map[uid] || {}).posts || []).filter(p => p && p.id);
    const posts = [{id: U.uid(), kind: 'link', text: String(text).slice(0, 300), link: safeUrl(link), at: Date.now()}, ...U.clone(mine)].slice(0, KEEP_POSTS);
    await ctx.W.merge('feed/' + uid, {posts});
    M.sound.play('soft');
  }
  async function setWatching(ctx, v) {
    try { await ctx.W.merge('me/' + ctx.uid, {watching: {ytId: v.ytId, title: String(v.title).slice(0, 160), at: Date.now()}}); } catch (e) { /* toasted already */ }
  }
  /* the founder's channel list: the server resolves the handle when it can, settings hold the list either way */
  async function addChannel(ctx, text) {
    const h = handleFrom(text);
    if (!h) { M.toast('Paste a YouTube handle or channel link', true); return false; }
    if (live() && h.handle) {
      const r = await api('addchannel', {handle: h.handle});
      M.toast('Added ' + (r.name || ('@' + h.handle)));
      return true;
    }
    const r = radarOf(ctx);
    const key = (h.handle || h.id).toLowerCase();
    const list = (Array.isArray(r.channels) ? r.channels : []).filter(c => c && String(c.handle || c.id).toLowerCase() !== key);
    const row = {id: h.id, handle: h.handle};
    row.name = h.handle || h.id;
    const dropped = (Array.isArray(r.dropped) ? r.dropped : []).filter(d => String(d).toLowerCase() !== key);
    await ctx.W.merge('settings/app', {radar: {channels: list.concat([row]), dropped}, updated: Date.now()});
    M.toast('Added ' + (h.handle ? '@' + h.handle : 'the channel'));
    return true;
  }
  async function dropChannel(ctx, c) {
    const key = (c.handle || c.id).toLowerCase();
    if (live() && c.handle) { await api('dropchannel', {handle: c.handle}); M.toast('Removed'); return; }
    const r = radarOf(ctx);
    const list = (Array.isArray(r.channels) ? r.channels : []).filter(x => x && String(x.handle || x.id).toLowerCase() !== key);
    let dropped = Array.isArray(r.dropped) ? r.dropped.slice() : [];
    if (!c.added && !dropped.some(d => String(d).toLowerCase() === key)) dropped = dropped.concat([c.handle || c.id]);
    await ctx.W.merge('settings/app', {radar: {channels: list, dropped}, updated: Date.now()});
    M.toast('Removed');
  }

  /* ---------- remote data with a short in-page cache ---------- */
  const cache = {};
  function useRemote(action, enabled) {
    const [s, set] = useState(() => cache[action] ? {state: 'ok', data: cache[action].data} : {state: live() ? 'loading' : 'off'});
    const load = useCallback(async body => {
      if (!live()) return;
      set(x => ({...x, state: x.data ? 'refreshing' : 'loading', err: null}));
      try {
        const d = await api(action, body || {});
        cache[action] = {data: d, got: Date.now()};
        set({state: 'ok', data: d});
      } catch (e) { set(x => ({...x, state: 'error', err: (e && e.message) || (e && e.code) || 'failed'})); }
    }, [action]);
    useEffect(() => {
      if (!live() || !enabled) return;
      if (!cache[action] || Date.now() - cache[action].got > CLIENT_TTL) load();
    }, [action, load, enabled]);
    return {...s, load};
  }

  /* ---------- small parts ---------- */
  const Chip = ({v, l, hot}) => html`<span class="chipline"><b class=${'num' + (hot ? ' flame-t' : '')}><${M.fx.MetalText} size=${15} weight=${700} color=${hot ? M.fx.FLAME : undefined}>${String(v)}<//></b> ${l}</span>`;
  const NewTab = ({href, children, className}) => html`<a class=${className} href=${safeUrl(href) || '#'} target="_blank" rel="noopener">${children}</a>`;

  /* the claude.ai copy cannot fetch: say so once, in ink */
  function OffCard({what}) {
    return html`<section class="card ink" id="radar-off">
      <${UI.Micro}>live feeds<//>
      <div class="card-title" style=${{marginTop: '6px'}}>Live feeds run on your EdgeOne address</div>
      <p class="small" style=${{margin: '8px 0 0', color: 'rgba(255,255,255,.72)', maxWidth: '60ch'}}>This copy of m360 runs inside claude.ai and has no way to reach the web. Open m360 on the EdgeOne address for the ${what}. The directory below is the same list it reads.</p>
    </section>`;
  }

  /* ---------- Why it matters: two lines from the model, inline ---------- */
  function WhyItMatters({it}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const go = () => r.run(o => M.ai.text(ctx,
      'In two short lines, say what this piece of news means for Mask360, a Mumbai content and advertising agency for premium brands. ' +
      'Be concrete: an angle to pitch, a client to call, a format to try, or a risk. No preamble, no headline.\n\n' +
      'TITLE: ' + it.title + '\nSOURCE: ' + (it.source || '') + '\nSUMMARY: ' + (it.summary || '') + '\nDATE: ' + U.fmtDate(U.ymd(new Date(it.at || Date.now()))),
      {signal: o.signal, onText: o.onText, tier: 'quick', cache: false}));
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<${React.Fragment}>
      <button type="button" class="btn ghost sm" disabled=${busy} onClick=${go}>${busy ? html`<${M.fx.Orb} state="composing" size=${20} label="writing"/>` : html`<span class="spark">${SPARK}</span>`} ${busy ? 'Thinking' : (r.text ? 'Ask again' : 'Why it matters')}</button>
      ${r.text ? html`<div class="rd-why small"><${M.AIText} text=${r.text}/></div>` : null}
      ${r.state === 'error' ? html`<div class="tiny flame-t" style=${{width: '100%'}}>${M.ai.errCopy(r.err)}</div>` : null}
    <//>`;
  }

  /* ---------- one story ---------- */
  function NewsItem({it, saved, names, top}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState('');
    const src = it.source || (names && names[it.sourceId]) || hostOf(it.link) || 'source';
    const act = async (k, fn) => { if (busy) return; setBusy(k); try { await fn(); } catch (e) { /* toasted by the write layer */ } setBusy(''); };
    return html`<article class=${'card rd-item' + (it.hot ? ' hot' : '')} data-id=${it.id} data-hot=${it.hot ? '1' : '0'}>
      <div class="row" style=${{gap: '8px'}}>
        <${UI.Pill}>${src}<//>
        ${it.lane && LANE_LABEL[it.lane] ? html`<${UI.Pill} kind="ink">${LANE_LABEL[it.lane]}<//>` : null}
        ${it.india === false ? html`<${UI.Pill}>world<//>` : null}
        <span class="tiny sub num">${U.timeAgo(it.at)}</span>
        ${it.hot ? html`<${M.fx.MetalBadge}>hot<//>` : top && it.at && Date.now() - it.at < 3 * 3600000 ? html`<${M.fx.MetalBadge}>new<//>` : null}
        ${(it.hits || []).map(k => html`<${UI.Pill} key=${k} kind="flame-o">${k}<//>`)}
        ${it.saved ? html`<${UI.Pill} kind="warm">saved ${U.timeAgo(it.savedAt)}<//>` : null}
      </div>
      <${NewTab} className="rd-title" href=${it.link}>${it.title}<//>
      ${it.summary ? html`<p class="rd-sum small ink62">${it.summary}</p>` : null}
      <div class="row rd-acts">
        <button type="button" class=${'btn sm ' + (saved ? 'sec' : 'ghost')} disabled=${busy === 'save'} onClick=${() => act('save', () => toggleSave(ctx, it))}>
          ${saved ? html`<${icons.check}/> Saved` : 'Save'}</button>
        <button type="button" class="btn ghost sm" disabled=${busy === 'share'} onClick=${() => act('share', async () => { await postLink(ctx, it.title, it.link); M.toast('Shared to the feed'); })}>
          <${icons.feed}/> Share to Vibe</button>
        ${M.ai.on(ctx) ? html`<${WhyItMatters} it=${it}/>` : null}
      </div>
    </article>`;
  }

  /* ---------- the weekly brief ---------- */
  function Brief({items}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const today = U.todayStr();
    const cached = useMemo(() => { try { const c = JSON.parse(M.prefs.get('radar.brief', 'null')); return c && c.date === today ? c.text : ''; } catch (e) { return ''; } }, [today]);
    const text = r.text || cached;
    if (!M.ai.on(ctx)) return null;
    const top = items.slice(0, 12);
    async function go() {
      const out = await r.run(o => M.ai.text(ctx,
        'Write "What moved this week" for the Mask360 team from the headlines below: exactly 5 bullets, each one line, each ending with why it matters to a ' +
        'Mumbai content and advertising agency for premium brands (a pitch angle, a client to call, a format to try, or a risk). Only use the headlines given. No intro, no outro.\n\nHEADLINES:\n' +
        (top.map(it => '- ' + it.title + ' (' + (it.source || '') + (it.summary ? ': ' + it.summary : '') + ')').join('\n') || '- none'),
        {signal: o.signal, onText: o.onText, cache: false}));
      if (typeof out === 'string' && out) M.prefs.set('radar.brief', JSON.stringify({date: today, text: out}));
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    const btn = html`<button type="button" class=${'btn sm' + (text ? ' sec' : '')} disabled=${busy || !top.length} onClick=${go}>${busy ? html`<${M.Thinking} state="composing"/>` : html`<span class="spark">${SPARK}</span> ${text ? 'Write it again' : 'What moved this week'}`}</button>`;
    return html`<${M.fx.Beam}><section class="ai-card" id="radar-brief">
      <div class="row between ai-head">
        <${M.fx.Bot} feature="radar" state=${busy ? 'working' : 'default'} size=${36} label="m360, the radar brief" className="ai-bot"/>
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Radar brief</div></div>
        ${text ? btn : html`<${M.fx.Metal} kind="ink">${btn}<//>`}
      </div>
      <div style=${{marginTop: '12px'}}>
        ${text ? html`<${M.AIText} text=${text}/>` : html`<div class="small" style=${{fontWeight: 500}}>Five bullets on the top ${Math.min(12, top.length) || 12} stories and what each one means for us. Written once a day, cached on this device.</div>`}
        ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
      </div>
    </section><//>`;
  }

  /* ---------- News ---------- */
  function News({news, onlyTag}) {
    const ctx = M.useCtx();
    const [chip, setChip] = useState(onlyTag || 'all');
    const [q, setQ] = useState('');
    const isLive = live();
    const sources = sourcesOf(ctx);
    const names = useMemo(() => { const m = {}; sources.forEach(s => { m[s.id] = s.name; }); ((news.data && news.data.sources) || []).forEach(s => { m[s.id] = s.name; }); return m; }, [sources, news.data]);
    const keywords = keywordsOf(ctx);
    const saved = savedOf(ctx);
    const raw = (news.data && Array.isArray(news.data.items)) ? news.data.items : [];
    const items = useMemo(() => withHits(raw, keywords).map(enrich), [raw, keywords.join('|')]);
    const india = useMemo(() => items.filter(it => it.india), [items]);
    const savedItems = useMemo(() => Object.keys(saved).map(id => ({id, title: saved[id].title, link: saved[id].link, at: saved[id].at, savedAt: saved[id].at, source: hostOf(saved[id].link), tags: [], summary: '', saved: true, hits: []}))
      .sort((a, b) => (b.at || 0) - (a.at || 0)), [saved]);
    const needle = q.trim().toLowerCase();
    const match = it => !needle || (String(it.title) + ' ' + String(it.summary || '') + ' ' + String(it.source || '')).toLowerCase().includes(needle);
    const pool = chip === 'saved' ? savedItems : chip === 'hot' ? items.filter(it => it.hot) : chip === 'world' ? items.filter(it => !it.india)
      : chip === 'all' ? india : india.filter(it => it.lane === chip);
    const shown = pool.filter(match);
    const errors = (news.data && news.data.errors) || [];
    const busy = news.state === 'loading' || news.state === 'refreshing';
    const counts = {hot: items.filter(i => i.hot).length, saved: savedItems.length, world: items.length - india.length};
    LANES.forEach(l => { counts[l.v] = india.filter(it => it.lane === l.v).length; });
    const laneEmpty = (LANES.find(l => l.v === chip) || {}).empty;
    const dir = sources.filter(s => s.on && (chip === 'all' || chip === 'hot' || chip === 'saved' || s.tags.includes(chip)) && (!needle || s.name.toLowerCase().includes(needle)));

    return html`<div class="stack" style=${{gap: '14px'}}>
      ${isLive ? html`<${Brief} items=${india.length ? india : items}/>` : html`<${OffCard} what="live stream"/>`}
      <div class="rd-chips" role="group" aria-label="Filter">
        ${CHIPS.map(c => html`<button key=${c.v} type="button" class=${'chip' + (chip === c.v ? ' on' : '')} aria-pressed=${chip === c.v} onClick=${() => setChip(c.v)}>
          ${c.label}${counts[c.v] ? html`<span class="num">${counts[c.v]}</span>` : null}</button>`)}
      </div>
      <div class="row between">
        <div class="grow" style=${{maxWidth: '360px'}}><${UI.Input} id="radar-search" value=${q} onChange=${setQ} placeholder="Search the stream"/></div>
        ${isLive ? html`<div class="row nowrap" style=${{gap: '10px'}}>
          ${busy ? html`<${M.fx.Orb} state="searching" size=${20} label="fetching"/>` : null}
          <span class="tiny sub num" id="radar-updated">${news.data && news.data.at ? 'updated ' + U.timeAgo(news.data.at) : (busy ? 'fetching' : '')}${news.data && news.data.stale ? ', feeds slow' : ''}</span>
          <${UI.Btn} kind="sec" sm disabled=${busy} onClick=${() => news.load({force: true})} id="radar-refresh">${busy ? 'Refreshing' : 'Refresh'}<//>
        </div>` : null}
      </div>
      ${errors.length ? html`<div class="tiny ink62" id="radar-errors">${errors.length} ${errors.length === 1 ? 'source' : 'sources'} did not answer: ${errors.map(e => names[e.id] || e.id).join(', ')}.</div>` : null}
      ${news.state === 'error' ? html`<div class="small flame-t">The stream did not load: ${news.err}. Tap Refresh to try again.</div>` : null}
      ${isLive || chip === 'saved' ? html`<div class="stack" id="radar-stream">
        ${shown.length ? shown.map((it, i) => it.hot && shown.findIndex(x => x.hot) === i
            ? html`<${M.fx.Beam} key=${it.id}><${NewsItem} it=${it} saved=${!!saved[it.id]} names=${names} top=${i < 4}/><//>`
            : html`<${NewsItem} key=${it.id} it=${it} saved=${!!saved[it.id]} names=${names} top=${i < 4}/>`)
          : html`<${UI.Empty} text=${busy ? 'Fetching the stream.' : needle ? 'Nothing matches that search.' : chip === 'saved' ? 'Nothing saved yet. Save a story from the stream.' : chip === 'hot' ? (keywords.length ? 'No story matches your watch keywords right now.' : 'Add watch keywords in Admin to light up stories here.') : laneEmpty || (chip === 'world' ? 'Nothing from outside India right now.' : 'Nothing in the stream yet.')}/>`}
      </div>` : html`<${UI.Card} title="Sources" id="radar-sources">
        <div class="stack tight">${dir.map(s => html`<div class="listrow" key=${s.id}>
          <span class="grow"><${NewTab} className="linky" href=${s.url}>${s.name}<//></span>
          <span class="row nowrap" style=${{gap: '4px'}}>${s.tags.map(t => html`<${UI.Pill} key=${t}>${t}<//>`)}</span>
        </div>`)}
        ${!dir.length ? html`<${UI.Empty} text="No source matches."/>` : null}</div>
      <//>`}
    </div>`;
  }

  /* ---------- Awards ---------- */
  function Awards({news}) {
    const ctx = M.useCtx();
    const keywords = keywordsOf(ctx);
    const saved = savedOf(ctx);
    const raw = (news.data && Array.isArray(news.data.items)) ? news.data.items : [];
    const items = useMemo(() => withHits(raw, keywords).map(enrich).filter(it => it.lane === 'awards' || (it.tags || []).includes('awards')), [raw, keywords.join('|')]);
    const sources = sourcesOf(ctx);
    const names = useMemo(() => { const m = {}; sources.forEach(s => { m[s.id] = s.name; }); return m; }, [sources]);
    return html`<div class="stack" style=${{gap: '14px'}}>
      <${UI.Card} title="Awards season" id="awards-card" action=${html`<span class="tiny sub">Typical timing. Check the site for this year's dates.</span>`}>
        <div class="tbl-wrap rd-awards"><table class="tbl" id="awards-table">
          <thead><tr><th>award</th><th>recognises</th><th>usually</th><th>site</th></tr></thead>
          <tbody>${AWARDS.map(a => html`<tr key=${a.name}>
            <td style=${{fontWeight: 500}}>${a.name}</td><td>${a.what}</td><td class="num">${a.when}</td>
            <td>${a.site ? html`<${NewTab} className="linky" href=${a.site}>${hostOf(a.site)}<//>` : html`<span class="ink62">ask the team</span>`}</td>
          </tr>`)}</tbody>
        </table></div>
      <//>
      ${live() ? html`<div class="stack" id="awards-stream">
        <${UI.Micro}>awards in the news<//>
        ${items.length ? items.map(it => html`<${NewsItem} key=${it.id} it=${it} saved=${!!saved[it.id]} names=${names}/>`)
          : html`<${UI.Empty} text=${news.state === 'loading' ? 'Fetching the stream.' : 'No awards stories in the stream right now.'}/>`}
      </div>` : html`<${OffCard} what="awards stream"/>`}
    </div>`;
  }

  /* ---------- Watch ---------- */
  function VideoDrawer({v, onClose}) {
    const ctx = M.useCtx();
    const src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.ytId) + '?autoplay=1';
    const others = Object.keys(ctx.coll.me.map).filter(u => u !== ctx.uid).map(u => ({u, w: ctx.coll.me.map[u].watching}))
      .filter(x => x.w && x.w.ytId === v.ytId && ctx.now - (x.w.at || 0) < WATCH_WINDOW);
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${v.title}
      footer=${html`<${NewTab} className="btn sec" href=${'https://www.youtube.com/watch?v=' + encodeURIComponent(v.ytId)}><${icons.out}/> Open on YouTube<//>`}>
      <div class="rd-embed"><iframe src=${src} title=${v.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen=${true} referrerPolicy="strict-origin-when-cross-origin"/></div>
      <div class="small ink62">${v.channel ? v.channel + ' · ' : ''}${v.at ? U.timeAgo(v.at) : ''}. If the player stays blank here, open it on YouTube.</div>
      ${others.length ? html`<div class="row" style=${{gap: '6px'}}>${others.map(x => html`<span key=${x.u} class="chipline rd-watch"><${UI.Avatar} id=${x.u} size=${18}/><${UI.Name} id=${x.u}/> is watching too</span>`)}</div>` : null}
    <//>`;
  }

  function ChannelCard({c, live: isLive, onOpen, onDrop, founder}) {
    const vids = (c.videos || []).slice(0, 4);
    return html`<section class="card rd-ch" data-handle=${c.handle || c.id}>
      <div class="row between" style=${{marginBottom: vids.length ? '10px' : '0'}}>
        <div class="grow">
          <div style=${{fontWeight: 500}}>${c.name || c.handle}</div>
          <${NewTab} className="tiny ink62 linky" href=${ytUrl(c)}>${c.handle ? '@' + c.handle : 'YouTube channel'}<//>
        </div>
        ${founder ? html`<${UI.ConfirmBtn} onConfirm=${() => onDrop(c)}>Remove<//>` : null}
      </div>
      ${isLive ? (vids.length ? html`<div class="rd-vids">${vids.map(v => html`<button type="button" key=${v.ytId} class="rd-vid" onClick=${() => onOpen({...v, channel: c.name})}>
          <span class="rd-thumb">${v.thumb ? html`<img src=${v.thumb} alt="" loading="lazy"/>` : null}<span class="rd-play"><${icons.play}/></span></span>
          <span class="grow"><span class="rd-vt">${v.title}</span><span class="tiny sub num">${v.at ? U.timeAgo(v.at) : ''}</span></span>
        </button>`)}</div>` : html`<${UI.Empty} text="No videos fetched yet."/>`) : null}
    </section>`;
  }

  function Watch({channels}) {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null);
    const [add, setAdd] = useState('');
    const [busy, setBusy] = useState(false);
    const isLive = live();
    const dir = channelsOf(ctx);
    const fetched = (channels.data && Array.isArray(channels.data.channels)) ? channels.data.channels : [];
    /* the directory order, with fetched videos joined on handle or id */
    const list = dir.map(c => {
      const f = fetched.find(x => (c.handle && x.handle && x.handle.toLowerCase() === c.handle.toLowerCase()) || (c.id && x.id === c.id));
      return f ? {...c, ...f, name: f.name || c.name} : c;
    });
    const errors = (channels.data && channels.data.errors) || [];
    const watching = Object.keys(ctx.coll.me.map).map(u => ({u, w: ctx.coll.me.map[u].watching}))
      .filter(x => x.w && x.w.ytId && ctx.now - (x.w.at || 0) < WATCH_WINDOW).sort((a, b) => b.w.at - a.w.at);
    const openVideo = v => { setOpen(v); setWatching(ctx, v); };
    const busyList = channels.state === 'loading' || channels.state === 'refreshing';

    /* on the team site the server keeps the channel list, so anyone adds or drops one; on the claude.ai page the settings document is the founder's, so members suggest */
    const canEdit = ctx.isFounder || isLive;
    async function submit() {
      if (!add.trim() || busy) return;
      setBusy(true);
      try {
        if (canEdit) { if (await addChannel(ctx, add)) { setAdd(''); if (isLive) channels.load({force: true}); } }
        else {
          const h = handleFrom(add);
          if (!h) M.toast('Paste a YouTube handle or channel link', true);
          else { await postLink(ctx, 'Channel suggestion for Radar: ' + (h.handle ? '@' + h.handle : 'a YouTube channel'), h.handle ? 'https://www.youtube.com/@' + h.handle : 'https://www.youtube.com/channel/' + h.id); setAdd(''); M.toast('Suggested on the feed'); }
        }
      } catch (e) { M.toast((e && e.message) || 'That did not work.', true); }
      setBusy(false);
    }
    return html`<div class="stack" style=${{gap: '14px'}}>
      ${isLive ? null : html`<${OffCard} what="latest videos"/>`}
      ${watching.length ? html`<div class="row" id="radar-watching" style=${{gap: '6px'}}>
        ${watching.map(x => html`<button key=${x.u} type="button" class="chipline rd-watch" onClick=${() => openVideo({ytId: x.w.ytId, title: x.w.title, at: 0})}>
          <${UI.Avatar} id=${x.u} size=${18}/><${UI.Name} id=${x.u}/> is watching <b>${x.w.title}</b></button>`)}
      </div>` : null}
      <div class="row between">
        <div class="row nowrap grow" style=${{gap: '8px', maxWidth: '520px'}}>
          <div class="grow"><${UI.Input} id="radar-channel" value=${add} onChange=${setAdd} onEnter=${submit} placeholder=${canEdit ? 'Handle or channel link, then Add' : 'Handle or channel link, then Suggest'}/></div>
          <${UI.Btn} kind="sec" disabled=${busy || !add.trim()} onClick=${submit} id="radar-channel-go">${canEdit ? 'Add a channel' : 'Suggest a channel'}<//>
        </div>
        ${isLive ? html`<div class="row nowrap" style=${{gap: '10px'}}>
          ${busyList ? html`<${M.fx.Orb} state="searching" size=${20} label="fetching"/>` : null}
          <span class="tiny sub num">${channels.data && channels.data.at ? 'updated ' + U.timeAgo(channels.data.at) : (busyList ? 'fetching' : '')}</span>
          <${UI.Btn} kind="sec" sm disabled=${busyList} onClick=${() => channels.load({force: true})}>${busyList ? 'Refreshing' : 'Refresh'}<//>
        </div>` : null}
      </div>
      ${errors.length ? html`<div class="tiny ink62" id="watch-errors">${errors.length} ${errors.length === 1 ? 'channel' : 'channels'} did not answer: ${errors.map(e => '@' + e.id).join(', ')}.</div>` : null}
      ${channels.state === 'error' ? html`<div class="small flame-t">The channels did not load: ${channels.err}. Tap Refresh to try again.</div>` : null}
      <div class="rd-channels" id="radar-channels">
        ${list.map(c => html`<${ChannelCard} key=${c.handle || c.id} c=${c} live=${isLive} founder=${canEdit} onOpen=${openVideo}
          onDrop=${x => dropChannel(ctx, x).then(() => { if (isLive) channels.load({force: true}); }).catch(() => {})}/>`)}
      </div>
      ${open ? html`<${VideoDrawer} v=${open} onClose=${() => setOpen(null)}/>` : null}
    </div>`;
  }

  /* ---------- the page ---------- */
  function Radar({tab}) {
    const ctx = M.useCtx();
    const t = tab || 'news';
    const news = useRemote('news', t !== 'watch');
    const channels = useRemote('channels', t === 'watch');
    const items = (news.data && Array.isArray(news.data.items)) ? withHits(news.data.items, keywordsOf(ctx)).map(enrich) : [];
    const india = items.filter(i => i.india);
    const hot = items.filter(i => i.hot).length;
    const moves = india.filter(i => i.lane === 'people' || i.lane === 'accounts').length;
    const savedN = Object.keys(savedOf(ctx)).length;
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="the outside world, India first" title="Radar" sub="Who won which account, who joined where, what launched, what campaign broke, and awards season.">
        <div class="row" style=${{gap: '8px'}}>
          ${live() ? html`<${Chip} v=${india.length} l="India stories"/>` : null}
          ${live() ? html`<${Chip} v=${moves} l="moves"/>` : null}
          ${live() ? html`<${Chip} v=${hot} l="watchlist hits" hot=${hot > 0}/>` : null}
          <${Chip} v=${savedN} l="saved"/>
          <${Chip} v=${channelsOf(ctx).length} l="channels"/>
        </div>
      <//>
      <${M.SectionTabs} section="radar" active=${t}/>
      ${t === 'awards' ? html`<${Awards} news=${news}/>` : t === 'watch' ? html`<${Watch} channels=${channels}/>` : html`<${News} news=${news}/>`}
    </div>`;
  }

  /* ---------- Admin: keywords, sources, channels ---------- */
  function RadarSettings() {
    const ctx = M.useCtx();
    const r = radarOf(ctx);
    const [kw, setKw] = useState((Array.isArray(r.keywords) ? r.keywords : []).join(', '));
    const [showSrc, setShowSrc] = useState(false);
    const [src, setSrc] = useState({name: '', url: '', tag: 'business'});
    const [ch, setCh] = useState('');
    const [busy, setBusy] = useState(false);
    const savedKw = (Array.isArray(r.keywords) ? r.keywords : []).join(', ');
    useEffect(() => { setKw(savedKw); }, [savedKw]);
    if (!ctx.isFounder) return null;
    const sources = sourcesOf(ctx);
    const channels = channelsOf(ctx);
    const patch = (d, msg) => ctx.W.merge('settings/app', {radar: d, updated: Date.now()}).then(() => msg && M.toast(msg)).catch(() => {});
    const saveKw = () => patch({keywords: Array.from(new Set(kw.split(',').map(s => s.trim()).filter(s => s.length >= 2))).slice(0, 40)}, 'Keywords saved');
    const toggle = (s, on) => {
      const off = new Set(Array.isArray(r.off) ? r.off : []);
      if (on) off.delete(s.id); else off.add(s.id);
      patch({off: Array.from(off)});
    };
    const addSource = () => {
      const url = safeUrl(src.url.trim());
      if (!src.name.trim() || !url) return M.toast('A name and an https feed address are needed', true);
      const id = 'src-' + U.uid();
      const row = {id, url, tags: [src.tag]};
      row.name = src.name.trim().slice(0, 80);
      const list = (Array.isArray(r.sources) ? r.sources : []).concat([row]);
      patch({sources: list}, 'Source added. It joins the next refresh.').then(() => setSrc({name: '', url: '', tag: 'business'}));
    };
    const dropSource = s => patch({sources: (Array.isArray(r.sources) ? r.sources : []).filter(x => x && x.id !== s.id)}, 'Source removed');
    const addCh = async () => {
      if (!ch.trim() || busy) return;
      setBusy(true);
      try { if (await addChannel(ctx, ch)) setCh(''); } catch (e) { M.toast((e && e.message) || 'That did not work.', true); }
      setBusy(false);
    };
    const on = sources.filter(s => s.on).length;
    return html`<${UI.Card} id="radar-settings" title="Radar" action=${html`<span class="pill">${on} of ${sources.length} sources on</span>`}>
      <div class="stack" style=${{gap: '16px'}}>
        <div>
          <${UI.Micro} plain>watch keywords<//>
          <div class="row" style=${{marginTop: '6px'}}>
            <div class="grow" style=${{maxWidth: '520px'}}><${UI.Input} id="radar-keywords" value=${kw} onChange=${setKw} onEnter=${saveKw} placeholder="Swisse, Tata Neu, Cannes, creator economy" hint="Comma separated. Stories that mention one light up on Radar."/></div>
            <${UI.Btn} sm disabled=${kw.trim() === savedKw.trim()} onClick=${saveKw} id="radar-keywords-save">Save keywords<//>
          </div>
        </div>
        <div>
          <div class="row between">
            <${UI.Micro} plain>sources<//>
            <button type="button" class="linky small" onClick=${() => setShowSrc(x => !x)}>${showSrc ? 'Hide the list' : 'Show the list'}</button>
          </div>
          ${showSrc ? html`<div class="stack tight" id="radar-source-list" style=${{marginTop: '6px'}}>
            ${sources.map(s => html`<div class="listrow" key=${s.id}>
              <span class="grow"><span style=${{fontWeight: s.on ? 500 : 300}}>${s.name}</span> <span class="tiny ink62">${s.tags.join(', ')}</span></span>
              <${UI.Seg} sm options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${s.on ? 'on' : 'off'} onChange=${v => toggle(s, v === 'on')} ariaLabel=${'Source ' + s.name}/>
              ${s.added ? html`<${UI.ConfirmBtn} onConfirm=${() => dropSource(s)}>Remove<//>` : null}
            </div>`)}
          </div>` : null}
          <div class="grid3" style=${{marginTop: '10px', alignItems: 'end'}}>
            <${UI.Input} id="radar-src-name" label="add a source" value=${src.name} onChange=${v => setSrc(x => ({...x, name: v}))} placeholder="Name"/>
            <${UI.Input} id="radar-src-url" label="rss address" value=${src.url} onChange=${v => setSrc(x => ({...x, url: v}))} placeholder="https://example.com/feed/"/>
            <div class="row nowrap" style=${{gap: '8px'}}>
              <div class="grow"><${UI.Select} label="tag" value=${src.tag} onChange=${v => setSrc(x => ({...x, tag: v}))} options=${TAGS}/></div>
              <${UI.Btn} kind="sec" onClick=${addSource} id="radar-src-add" disabled=${!src.name.trim() || !src.url.trim()}>Add<//>
            </div>
          </div>
        </div>
        <div>
          <${UI.Micro} plain>channels<//>
          <div class="row" style=${{marginTop: '6px', gap: '6px'}} id="radar-channel-list">
            ${channels.map(c => html`<span key=${c.handle || c.id} class="chipline">${c.handle ? '@' + c.handle : c.name}
              <button type="button" class="iconbtn" style=${{width: '22px', height: '22px', margin: '0 -6px 0 0'}} aria-label=${'Remove ' + (c.handle || c.name)} onClick=${() => dropChannel(ctx, c).catch(() => {})}><${icons.x}/></button></span>`)}
          </div>
          <div class="row" style=${{marginTop: '8px'}}>
            <div class="grow" style=${{maxWidth: '420px'}}><${UI.Input} id="radar-add-channel" value=${ch} onChange=${setCh} onEnter=${addCh} placeholder="@handle or a youtube.com link"/></div>
            <${UI.Btn} sm kind="sec" disabled=${busy || !ch.trim()} onClick=${addCh}>Add channel<//>
          </div>
        </div>
      </div>
    <//>`;
  }

  M.pages.Radar = Radar;
  M.adminCards.push(RadarSettings);
  M.radar = {SOURCES, CHANNELS, AWARDS, LANES, sourcesOf, channelsOf, handleFrom, withHits, postLink, laneOf, isIndia, enrich};
})();
