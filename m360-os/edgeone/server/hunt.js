/* hunt: the big brand lane. People and company search on Apollo through the founder's key, which lives
   here and never reaches the page. Enrichment (an email, a phone number) runs on an explicit tap only,
   because Apollo charges credits for it. Phone numbers come back on Apollo's webhook at /api/apollo and
   wait under n/hunt/ph/<id> until the page collects them.

     x/apollo            {key, at, by}                the founder's Apollo API key (APOLLO_API_KEY in env wins)
     n/hunt/pend/<id>    {uid, at}                    a phone reveal the page asked for, so a webhook is expected
     n/hunt/ph/<id>      {phones, at}                 what the webhook delivered

   Nothing here writes to d/. The pursuits themselves are ordinary documents (hunt/<id>) the page writes. */

const APOLLO = 'https://api.apollo.io/api/v1';
const FETCH_MS = 12000;
const PEND_MS = 20 * 60 * 1000;
const PER_PAGE = 25;
const TITLES_MAX = 16;
const KEY_OK = /^[A-Za-z0-9_-]{12,120}$/;
const ID_OK = /^[A-Za-z0-9_-]{6,64}$/;

const s = (x, n) => String(x == null ? '' : x).slice(0, n || 200);
const hostOf = u => { try { return new URL(String(u || '')).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const domainOf = x => String(x || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
const DOMAIN_OK = /^[a-z0-9.-]{3,80}\.[a-z]{2,12}$/;

/* one person, the way the page lists them. A search hit is a preview: first name, an obfuscated surname
   ("S***n"), title, employer name and whether an email or a phone exists; the full record (surname, LinkedIn,
   work email, city) comes from enrichment, which spends a credit. A masked email is dropped. */
export function person(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.match_confidence === 'none') return null;
  const org = p.organization || p.account || {};
  const mail = s(p.email, 160);
  const last = p.last_name || p.last_name_obfuscated || '';
  return {
    id: s(p.id, 64),
    who: s(p.name || ((p.first_name || '') + ' ' + last).trim(), 120),
    preview: !p.last_name && !!p.last_name_obfuscated,
    hasMail: p.has_email === true || (!!mail && !/not_unlocked|@domain\.com$|^no_email@/i.test(mail)),
    hasPhone: p.has_direct_phone === true || String(p.has_direct_phone || '').toLowerCase() === 'yes' || (Array.isArray(p.phone_numbers) && p.phone_numbers.length > 0),
    first: s(p.first_name, 60),
    title: s(p.title, 120),
    headline: s(p.headline, 200),
    seniority: s(p.seniority, 40),
    city: s(p.city, 80),
    country: s(p.country, 80),
    linkedin: /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(String(p.linkedin_url || '')) ? s(p.linkedin_url, 200) : '',
    photo: /^https:\/\//.test(String(p.photo_url || '')) ? s(p.photo_url, 300) : '',
    mailStatus: s(p.email_status, 40),
    mail: mail && !/not_unlocked|@domain\.com$|^no_email@/i.test(mail) && mail.includes('@') ? mail : '',
    phones: phonesOf((Array.isArray(p.phone_numbers) && p.phone_numbers.length ? p.phone_numbers : (p.contact && p.contact.phone_numbers)) || []),
    org: {name: s(org.name, 120), domain: s(org.primary_domain || hostOf(org.website_url), 120), linkedin: s(org.linkedin_url, 200)}
  };
}
/* mobiles first, then the rest; a number Apollo marked invalid is dropped */
export function phonesOf(list) {
  const rows = (Array.isArray(list) ? list : []).map(x => ({
    number: s((x && (x.sanitized_number || x.raw_number)) || '', 40), type: s(x && (x.type || x.type_cd), 30).toLowerCase(), status: s(x && (x.status || x.status_cd), 30).toLowerCase()
  })).filter(x => /^\+?[0-9 ()-]{6,}$/.test(x.number) && !/invalid|no_match|disconnected/.test(x.status));
  return rows.filter(x => x.type === 'mobile').concat(rows.filter(x => x.type !== 'mobile')).slice(0, 6);
}
export function company(o) {
  if (!o || typeof o !== 'object') return null;
  return {
    id: s(o.id, 64), name: s(o.name, 120), domain: s(o.primary_domain || hostOf(o.website_url), 120),
    site: /^https?:\/\//.test(String(o.website_url || '')) ? s(o.website_url, 200) : '',
    linkedin: s(o.linkedin_url, 200), industry: s(o.industry, 80), people: Number(o.estimated_num_employees) || 0,
    city: s(o.city, 80), country: s(o.country, 80), logo: /^https:\/\//.test(String(o.logo_url || '')) ? s(o.logo_url, 300) : ''
  };
}

export function huntActions(h) {
  const {store, env, getJ, putJ, levelOf, LEVEL, HttpError, log} = h;
  const doFetch = (...a) => (env.fetch || fetch)(...a);

  async function conf() {
    if (env.APOLLO_API_KEY) return {key: String(env.APOLLO_API_KEY), fromEnv: true, at: 0};
    const x = await getJ('x/apollo').catch(() => null);
    return x && x.key ? x : null;
  }
  const need = async (v, level) => { if (!v) throw new HttpError(401, 'noid'); const l = await levelOf(v.uid); if (l < level) throw new HttpError(403, 'not_granted', 'not allowed'); return l; };

  /* one Apollo call; the key travels in a header, the answer is JSON or an error the page can read */
  async function call(path, body, method) {
    const c = await conf();
    if (!c) throw new HttpError(409, 'not_configured', 'Paste the Apollo key in Admin first.');
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_MS);
    let r;
    try {
      r = await doFetch(APOLLO + path, {method: method || 'POST', signal: ctl.signal,
        headers: {'content-type': 'application/json', accept: 'application/json', 'cache-control': 'no-cache', 'x-api-key': c.key},
        body: method === 'GET' ? undefined : JSON.stringify(body || {})});
    } catch (e) {
      throw new HttpError(502, 'unavailable', e && e.name === 'AbortError' ? 'Apollo took too long.' : 'Apollo did not answer.');
    } finally { clearTimeout(t); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new HttpError(409, 'not_configured', 'Apollo rejected the key. Paste a current one in Admin.');
    if (r.status === 403) throw new HttpError(409, 'not_configured', 'This Apollo key cannot use ' + path.replace(/^\//, '') + '. Use a Master API key, or add that endpoint to the key\'s scope in Apollo.');
    if (r.status === 402) throw new HttpError(402, 'not_granted', 'Apollo says this plan has no credits left for that.');
    if (r.status === 422) throw new HttpError(400, 'invalid_argument', s((j && (j.error || j.message)) || 'Apollo refused the search.', 160));
    if (r.status === 429) throw new HttpError(429, 'rate_limited', 'Apollo rate limit. Try again in a minute.');
    if (!r.ok) throw new HttpError(502, 'unavailable', 'Apollo answered ' + r.status + '.');
    return j || {};
  }

  const titlesOf = body => (Array.isArray(body.titles) ? body.titles : []).map(x => s(x, 60).trim()).filter(Boolean).slice(0, TITLES_MAX);

  const actions = {
    /* is Apollo wired: anyone on the team may ask, the key itself never leaves */
    async apollostatus(v) {
      await need(v, LEVEL.interact);
      const c = await conf();
      return {configured: !!c, fromEnv: !!(c && c.fromEnv), at: (c && c.at) || 0, hint: c && !c.fromEnv ? (c.key.slice(0, 4) + '...' + c.key.slice(-3)) : ''};
    },
    /* the founder pastes the key; an empty key removes it */
    async apollokey(v, body, req) {
      await need(v, LEVEL.admin);
      const key = s(body.key, 200).trim();
      if (!key) { await store.delete('x/apollo').catch(() => {}); await log(v.uid, 'apollokey', '', 'removed'); return {configured: !!env.APOLLO_API_KEY}; }
      if (!KEY_OK.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an Apollo API key.');
      await putJ('x/apollo', {key, at: Date.now(), by: v.uid});
      await log(v.uid, 'apollokey', '', (req && req.ua) || '');
      return {configured: true};
    },
    /* companies by name: to find the domain the people search needs */
    async huntcompanies(v, body) {
      await need(v, LEVEL.interact);
      const q = s(body.q, 120).trim();
      if (q.length < 2) throw new HttpError(400, 'invalid_argument', 'Type a company name.');
      const j = await call('/mixed_companies/search', {q_organization_name: q, page: 1, per_page: 10});
      const rows = (Array.isArray(j.organizations) ? j.organizations : (Array.isArray(j.accounts) ? j.accounts : [])).map(company).filter(Boolean);
      return {rows};
    },
    /* people at a company by title, India first */
    async huntpeople(v, body) {
      await need(v, LEVEL.interact);
      const domain = domainOf(body.domain);
      const q = s(body.q, 120).trim();
      if (!DOMAIN_OK.test(domain) && q.length < 2) throw new HttpError(400, 'invalid_argument', 'A company domain such as tata.com, or a company name.');
      const titles = titlesOf(body);
      const page = Math.max(1, Math.min(10, Math.round(Number(body.page) || 1)));
      const req = {page, per_page: PER_PAGE};
      if (DOMAIN_OK.test(domain)) req.q_organization_domains_list = [domain];
      else req.q_organization_name = q;
      if (titles.length) req.person_titles = titles;
      if (body.india !== false) req.person_locations = ['India'];
      if (Array.isArray(body.seniorities) && body.seniorities.length) req.person_seniorities = body.seniorities.map(x => s(x, 20)).slice(0, 8);
      const j = await call('/mixed_people/api_search', req);
      const rows = (Array.isArray(j.people) ? j.people : []).concat(Array.isArray(j.contacts) ? j.contacts : []).map(person).filter(p => p && p.id);
      const pg = j.pagination || {};
      await log(v.uid, 'apollo', 'people', domain || q);
      return {rows, page, total: Number(pg.total_entries) || rows.length, pages: Number(pg.total_pages) || 1};
    },
    /* one person in full: the work email, and when asked the phone (which Apollo sends to the webhook later) */
    async huntenrich(v, body, req) {
      await need(v, LEVEL.interact);
      const id = s(body.id, 64);
      if (!ID_OK.test(id)) throw new HttpError(400, 'invalid_argument', 'Which person?');
      const wantPhone = body.phone === true;
      const site = String((req && req.site) || '');
      const payload = {id, reveal_personal_emails: false};
      /* the webhook needs a public https address (the local stand-in is allowed so the flow can be tested);
         Apollo signs nothing, so a one time token rides in the address and the delivery must carry it back */
      const t = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      if (wantPhone && /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site)) { payload.reveal_phone_number = true; payload.webhook_url = site + '/api/apollo?t=' + t; }
      if (wantPhone) await putJ('n/hunt/pend/' + id, {uid: v.uid, at: Date.now(), t});
      const j = await call('/people/match', payload);
      const p = person(j.person || j);
      if (!p) { await log(v.uid, 'apollo', 'enrich', id); return {row: null, phonePending: false, phoneNeedsSite: false}; }
      await log(v.uid, 'apollo', 'enrich', id);
      if (p && p.phones.length) await putJ('n/hunt/ph/' + id, {phones: p.phones, at: Date.now()});
      return {row: p, phonePending: wantPhone && !(p && p.phones.length) && !!payload.webhook_url, phoneNeedsSite: wantPhone && !payload.webhook_url};
    },
    /* the phone numbers the webhook delivered for one person, if any yet */
    async huntphone(v, body) {
      await need(v, LEVEL.interact);
      const id = s(body.id, 64);
      if (!ID_OK.test(id)) throw new HttpError(400, 'invalid_argument', 'Which person?');
      const ph = await getJ('n/hunt/ph/' + id).catch(() => null);
      const pend = await getJ('n/hunt/pend/' + id).catch(() => null);
      return {phones: (ph && ph.phones) || [], at: (ph && ph.at) || 0, pending: !!(pend && Date.now() - pend.at < PEND_MS && !(ph && ph.phones.length))};
    }
  };

  /* POST /api/apollo: Apollo delivers phone numbers here. Only a person the page asked about in the last
     twenty minutes is kept; anything else is answered politely and dropped. */
  async function apolloWebhook(request) {
    const json = (o, status) => new Response(JSON.stringify(o), {status: status || 200, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
    if (request.method !== 'POST') return json({ok: false}, 405);
    let body;
    try { body = await request.json(); } catch (e) { return json({ok: false}, 400); }
    let t = '';
    try { t = new URL(request.url).searchParams.get('t') || ''; } catch (e) { t = ''; }
    const list = Array.isArray(body && body.people) ? body.people : (body && body.person ? [body.person] : (body && body.id ? [body] : []));
    let kept = 0;
    for (const p of list.slice(0, 20)) {
      const id = s(p && p.id, 64);
      if (!ID_OK.test(id)) continue;
      const pend = await getJ('n/hunt/pend/' + id).catch(() => null);
      if (!pend || Date.now() - pend.at > PEND_MS || (pend.t && pend.t !== t)) continue;
      const phones = phonesOf((Array.isArray(p.phone_numbers) && p.phone_numbers.length ? p.phone_numbers : (p.contact && p.contact.phone_numbers)) || []);
      if (!phones.length) continue;
      await putJ('n/hunt/ph/' + id, {phones, at: Date.now()});
      await store.delete('n/hunt/pend/' + id).catch(() => {});
      kept++;
    }
    return json({ok: true, kept});
  }

  return {actions, apolloWebhook};
}
