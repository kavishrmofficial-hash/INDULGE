/* dev only: a canned Apollo. The key must start with "apollo_"; a company search answers two Tata
   companies; a people search answers three people at tata.com (emails masked, the way Apollo masks them);
   enrichment unmasks one email and, when a phone is asked for, posts a phone number to the webhook it was
   given, the way Apollo does, after a short delay. */

const j = (o, status) => new Response(JSON.stringify(o), {status: status || 200, headers: {'content-type': 'application/json'}});

const PEOPLE = [
  {id: 'p_kingshuk_01', first_name: 'Kingshuk', last_name: 'Sen', name: 'Kingshuk Sen', title: 'Head of Digital Marketing', headline: 'Digital at Tata Neu', seniority: 'head',
   city: 'Mumbai', country: 'India', linkedin_url: 'https://www.linkedin.com/in/kingshuk-sen', email_status: 'verified', email: 'email_not_unlocked@domain.com',
   organization: {name: 'Tata Digital', primary_domain: 'tata.com', website_url: 'https://www.tata.com', linkedin_url: 'https://www.linkedin.com/company/tata'}},
  {id: 'p_ananya_02', first_name: 'Ananya', last_name: 'Rao', name: 'Ananya Rao', title: 'Senior Brand Manager', headline: 'Brand at Tata Sampann', seniority: 'manager',
   city: 'Mumbai', country: 'India', linkedin_url: 'https://www.linkedin.com/in/ananya-rao', email_status: 'verified', email: 'email_not_unlocked@domain.com',
   organization: {name: 'Tata Consumer Products', primary_domain: 'tataconsumer.com', website_url: 'https://www.tataconsumer.com'}},
  {id: 'p_rohit_03', first_name: 'Rohit', last_name: 'Menon', name: 'Rohit Menon', title: 'Social Media Lead', headline: '', seniority: 'senior',
   city: 'Bengaluru', country: 'India', linkedin_url: 'https://www.linkedin.com/in/rohit-menon', email_status: 'unavailable', email: '',
   organization: {name: 'Tata Digital', primary_domain: 'tata.com', website_url: 'https://www.tata.com'}}
];

globalThis.__apollo = {calls: [], webhooks: []};

export async function fakeApollo(url, init) {
  const u = String(url);
  if (!u.startsWith('https://api.apollo.io/api/v1/')) return null;
  const key = ((init && init.headers) || {})['x-api-key'] || '';
  const body = init && init.body ? JSON.parse(init.body) : {};
  globalThis.__apollo.calls.push({url: u, body});
  if (!/^apollo_/.test(key)) return j({error: 'Invalid API key'}, 401);
  if (u.endsWith('/mixed_companies/search')) {
    const q = String(body.q_organization_name || '').toLowerCase();
    if (!q.includes('tata')) return j({organizations: [], pagination: {page: 1, per_page: 10, total_entries: 0, total_pages: 0}});
    return j({organizations: [
      {id: 'o_tata_1', name: 'Tata Digital', primary_domain: 'tata.com', website_url: 'https://www.tata.com', linkedin_url: 'https://www.linkedin.com/company/tata-digital', industry: 'internet', estimated_num_employees: 1200, city: 'Mumbai', country: 'India'},
      {id: 'o_tata_2', name: 'Tata Consumer Products', primary_domain: 'tataconsumer.com', website_url: 'https://www.tataconsumer.com', industry: 'food and beverages', estimated_num_employees: 3500, city: 'Mumbai', country: 'India'}
    ], pagination: {page: 1, per_page: 10, total_entries: 2, total_pages: 1}});
  }
  if (u.endsWith('/mixed_people/search')) return j({error: 'This API key is not authorized to access api/v1/mixed_people/search', error_code: 'API_INACCESSIBLE'}, 403);
  if (u.endsWith('/mixed_people/api_search')) {
    const domains = body.q_organization_domains_list || [];
    const titles = (body.person_titles || []).map(t => String(t).toLowerCase());
    let rows = PEOPLE.filter(p => !domains.length || domains.includes(p.organization.primary_domain) || domains.includes('tata.com'));
    if (titles.length) rows = rows.filter(p => titles.some(t => p.title.toLowerCase().includes(t.split(' ')[0])));
    /* a search hit is a preview: no surname, no email, no LinkedIn, no domain */
    const preview = p => ({id: p.id, first_name: p.first_name, last_name_obfuscated: p.last_name[0] + '***' + p.last_name.slice(-1), title: p.title,
      has_email: !!p.email, has_direct_phone: p.id === 'p_kingshuk_01' ? 'Yes' : 'No', last_refreshed_at: '2026-09-01', organization: {name: p.organization.name}});
    return j({people: rows.map(preview), pagination: {page: 1, per_page: 25, total_entries: rows.length, total_pages: 1}});
  }
  if (u.endsWith('/people/match')) {
    const p = PEOPLE.find(x => x.id === body.id);
    if (!p) return j({person: {match_confidence: 'none'}});
    const full = {...p, email: p.id === 'p_kingshuk_01' ? 'kingshuk.sen@tata.example' : ''};
    if (body.reveal_phone_number && body.webhook_url) {
      setTimeout(() => {
        const payload = {people: [{id: p.id, phone_numbers: [{raw_number: '+91 98200 00001', sanitized_number: '+919820000001', type: 'mobile', status: 'valid'}]}]};
        globalThis.__apollo.webhooks.push(body.webhook_url);
        fetch(body.webhook_url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)}).catch(() => {});
      }, 300);
    }
    return j({person: full});
  }
  return j({error: 'unknown endpoint'}, 404);
}
