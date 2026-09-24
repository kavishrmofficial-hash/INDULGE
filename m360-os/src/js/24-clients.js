/* module: clients (BRIEF 7.16). Client brains: the logo, the company brain built from the site (read by
   the EdgeOne function through the peek action), what is in the news, a meeting prep note, a health line,
   and revenue for the founder only. Logos are shrunk in the browser to 128 px and stored on the client. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo, useEffect, useRef} = React;

  const STATUS = [{v: 'live', label: 'Live'}, {v: 'pitch', label: 'Pitch'}, {v: 'paused', label: 'Paused'}];
  const STATUS_PILL = {live: 'ink', pitch: null, paused: 'warm'};
  /* what a complete brain holds: the agency's three notes, two facts, and three brain fields */
  const FIELDS = ['memory', 'approvals', 'never', 'website', 'industry', 'brain.about', 'brain.audience', 'brain.voice'];
  const BRAIN = [
    {k: 'about', label: 'who they are'}, {k: 'offers', label: 'what they sell'}, {k: 'audience', label: 'who buys'},
    {k: 'voice', label: 'how they sound'}, {k: 'competitors', label: 'who they are up against'}, {k: 'moves', label: 'recent moves'},
    {k: 'talking', label: 'what they talk about'}, {k: 'risks', label: 'watch outs'}, {k: 'pitchNext', label: 'what to pitch next'}
  ];
  const BRAIN_MAX = 400;
  const MODEL_LINE = 'From what m360 knows, no site read. Verify before you quote it.';
  const LOGO_PX = 128;
  const LOGO_MAX = 40 * 1024;
  const LIMITS = {industry: 60, hq: 60, since: 20, tone: 160, social: 120, website: 200};
  const SOCIALS = [{k: 'instagram', label: 'instagram', placeholder: '@handle'}, {k: 'linkedin', label: 'linkedin', placeholder: 'company handle'}, {k: 'youtube', label: 'youtube', placeholder: '@channel'}];
  const HEALTH = {ok: {label: 'On track', pill: 'ink'}, watch: {label: 'Watch', pill: 'flame-o'}, risk: {label: 'Off track', pill: 'flame'}};
  const STALE_DAYS = 30;
  const NEWS_TTL = 5 * 60000;
  const GENERIC = ['the', 'group', 'india', 'global', 'brand', 'company', 'studio', 'hotel', 'hotels', 'labs', 'media', 'wellness', 'foods', 'beauty'];

  /* the standalone runtime exists only on the EdgeOne build */
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => live() ? window.M360_API(a, body) : Promise.reject({code: 'unavailable', message: 'no server here'});
  const noDash = s => String(s == null ? '' : s).replace(/[\u2013\u2014]/g, ', ');

  /* ---------- pure helpers ---------- */
  function completeness(client) {
    const c = client || {};
    const get = k => { const p = k.split('.'); return p.length > 1 ? ((c[p[0]] || {})[p[1]]) : c[k]; };
    const missing = FIELDS.filter(f => !String(get(f) || '').trim());
    return {filled: FIELDS.length - missing.length, total: FIELDS.length, missing};
  }
  function financeOf(ctx) {
    const d = (ctx.priv && ctx.priv.finance && ctx.priv.finance.data) || {};
    return d.clients || {};
  }
  function shares(ctx) {
    const map = (ctx.coll && ctx.coll.clients && ctx.coll.clients.map) || {};
    const fin = financeOf(ctx);
    const rows = Object.keys(map).map(id => ({id, name: map[id].name || '', monthly: Number((fin[id] || {}).monthly) || 0}));
    const total = rows.reduce((n, r) => n + r.monthly, 0);
    return rows.map(r => ({...r, share: total > 0 ? Math.round(100 * r.monthly / total) : 0}));
  }
  function openTaskCount(ctx, id) {
    const list = (M.tasks && M.tasks.open) ? M.tasks.open(ctx) : [];
    return list.filter(t => t && t.client === id).length;
  }

  /* the domain in a website or an address: "https://www.swisse.ae/shop" gives "swisse.ae" */
  const domainFrom = s => {
    let d = String(s || '').trim().toLowerCase();
    if (!d) return '';
    d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].split(':')[0];
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : '';
  };
  /* a website worth storing: a host or a full address, always stored with https. null means it will not do. */
  function cleanSite(v) {
    v = String(v || '').trim().slice(0, LIMITS.website);
    if (!v) return '';
    if (/\s/.test(v)) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return null;
    if (!domainFrom(v)) return null;
    return /^https?:\/\//i.test(v) ? v : 'https://' + v;
  }
  /* a social handle or a link, the way profile links are checked */
  function cleanHandle(v) {
    v = String(v || '').trim().slice(0, LIMITS.social);
    if (!v) return '';
    if (M.profile && M.profile.cleanLink) return M.profile.cleanLink(v);
    return /^[\w@.~:/?#&()*+,;=%-]+$/.test(v) ? v : null;
  }
  const BASES = {instagram: 'https://instagram.com/', linkedin: 'https://linkedin.com/company/', youtube: 'https://youtube.com/@'};
  function socialHref(k, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (v[0] !== '@' && v.indexOf('/') >= 0) return 'https://' + v;
    return (BASES[k] || 'https://') + encodeURIComponent(v.replace(/^@/, ''));
  }
  const socialText = v => { v = String(v || '').trim(); return /^https?:\/\//i.test(v) || v.indexOf('/') >= 0 ? v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].slice(0, 32) : '@' + v.replace(/^@/, ''); };
  const orgOf = (ctx, id) => (id && M.base && M.base.orgForClient) ? M.base.orgForClient(ctx, id) : null;
  /* the client's domain: stored, else from the website, else from the linked company in the Base */
  function domainOf(ctx, id, c) {
    c = c || (id && ctx && ctx.coll.clients.map[id]) || {};
    if (c.domain) return c.domain;
    const d = domainFrom(c.website);
    if (d) return d;
    const o = c.org && M.base && M.base.org ? M.base.org(ctx, c.org) : orgOf(ctx, id);
    return o ? (o.domain || domainFrom(o.website)) : '';
  }
  const faviconUrl = domain => 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128';
  const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  /* the first word of a brand name, when it can stand on its own in a headline */
  const brandWord = name => { const w = String(name || '').trim().split(/\s+/)[0] || ''; return w.length >= 4 && GENERIC.indexOf(w.toLowerCase()) < 0 ? w : ''; };

  /* the news that mentions this client: name, domain or its brand word, newest 5 */
  function newsFor(items, name, domain) {
    const needles = [name, domain, brandWord(name)].map(s => String(s || '').toLowerCase().trim()).filter(s => s.length >= 4);
    if (!needles.length) return [];
    return (items || []).filter(it => { const hay = (String(it.title || '') + ' ' + String(it.summary || '')).toLowerCase(); return needles.some(n => hay.indexOf(n) >= 0); })
      .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5);
  }
  /* EOD lines that mention the client, last `days` days, newest first */
  function eodMentions(ctx, name, days) {
    const needle = String(name || '').toLowerCase().trim(), bw = brandWord(name).toLowerCase();
    if (!needle) return [];
    const from = U.ymd(U.addDays(new Date(), -days));
    const out = [];
    const em = (ctx.coll.eod && ctx.coll.eod.map) || {};
    Object.keys(em).forEach(uid => {
      const ds = (em[uid] || {}).days || {};
      Object.keys(ds).forEach(d => {
        if (d < from) return;
        const e = ds[d] || {};
        const t = [e.shipped, e.next, e.blocked].filter(Boolean).join(' ');
        const lo = t.toLowerCase();
        if (lo.indexOf(needle) >= 0 || (bw && lo.indexOf(bw) >= 0)) out.push({uid, date: d, at: e.at || U.parseYmd(d).getTime(), text: t});
      });
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function projectsOf(ctx, id) {
    const pmap = ctx.coll.projects.map;
    return Object.keys(pmap).map(k => ({id: k, ...pmap[k]})).filter(p => p.client === id && !p.archived);
  }
  function tasksOf(ctx, id, projects) {
    const pids = {};
    (projects || projectsOf(ctx, id)).forEach(p => { pids[p.id] = true; });
    const tmap = ctx.coll.tasks.map;
    return Object.keys(tmap).map(k => ({id: k, ...tmap[k]})).filter(t => t.client === id || pids[t.project]);
  }
  const pitchesOf = (ctx, id, name) => {
    const pm = ctx.coll.pitches.map;
    const of = (M.search && M.search.clientOfPitch) ? p => M.search.clientOfPitch(ctx, p) : () => '';
    const lo = String(name || '').toLowerCase().trim();
    return Object.keys(pm).map(k => ({id: k, ...pm[k]})).filter(p => of(p) === id || (lo && String(p.brand || '').toLowerCase().trim() === lo));
  };

  /* health: green when nothing is overdue and the latest project is fine, amber on overdue work or a
     project at risk, red when a project is off track or nothing has moved in 30 days */
  function health(ctx, id) {
    const c = ctx.coll.clients.map[id];
    if (!c) return {level: 'ok', why: ''};
    const td = U.todayStr(), now = Date.now();
    const projects = projectsOf(ctx, id);
    const tasks = tasksOf(ctx, id, projects);
    const isOver = t => (M.tasks && M.tasks.isOverdue) ? M.tasks.isOverdue(t, td) : !!(t.due && t.status !== 'done' && t.due < td);
    const overdue = tasks.filter(isOver);
    const open = projects.filter(p => p.status !== 'done');
    const latest = open.slice().sort((a, b) => (b.created || 0) - (a.created || 0))[0] || null;
    let last = Number(c.updated) || 0;
    const bump = t => { if (t && t > last) last = t; };
    tasks.forEach(t => { bump(t.updated); bump(t.created); bump(t.doneAt); });
    projects.forEach(p => { bump(p.created); Object.keys(p.updates || {}).forEach(k => bump((p.updates[k] || {}).at)); });
    eodMentions(ctx, c.name, STALE_DAYS).forEach(e => bump(e.at));
    const idle = last ? Math.floor((now - last) / 86400000) : null;
    const off = open.filter(p => p.status === 'off');
    const why = [];
    if (off.length) why.push(off[0].name + ' is off track');
    if (idle != null && idle >= STALE_DAYS) why.push('nothing has moved in ' + idle + ' days');
    if (why.length) return {level: 'risk', why: why.join(', ')};
    if (overdue.length) why.push(overdue.length + (overdue.length === 1 ? ' overdue task' : ' overdue tasks'));
    if (latest && latest.status === 'risk') why.push(latest.name + ' at risk');
    if (idle == null) why.push('nothing recorded yet');
    if (why.length) return {level: 'watch', why: why.join(', ')};
    const good = ['no overdue tasks'];
    if (latest) good.push(latest.name + ' on track');
    good.push('moved ' + (idle === 0 ? 'today' : idle + (idle === 1 ? ' day ago' : ' days ago')));
    return {level: 'ok', why: good.join(', ')};
  }

  /* ---------- the logo: cover crop to a square, 128 px, PNG when it stays small, else JPEG ---------- */
  function loadImg(file) {
    return new Promise((res, rej) => {
      let url = '';
      try { url = URL.createObjectURL(file); } catch (e) { rej(new Error('decode')); return; }
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function shrinkLogo(file) {
    return loadImg(file).then(img => {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('decode');
      const s = Math.min(w, h);
      const c = document.createElement('canvas');
      c.width = LOGO_PX; c.height = LOGO_PX;
      c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, LOGO_PX, LOGO_PX);
      let out = '';
      if (/image\/(png|svg\+xml|webp|gif)/.test(file.type || '')) { out = c.toDataURL('image/png'); if (out.length > LOGO_MAX) out = ''; }
      if (!out) {
        const j = document.createElement('canvas');
        j.width = LOGO_PX; j.height = LOGO_PX;
        const g = j.getContext('2d');
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, LOGO_PX, LOGO_PX);
        g.drawImage(c, 0, 0);
        out = j.toDataURL('image/jpeg', 0.82);
        if (out.length > LOGO_MAX) out = j.toDataURL('image/jpeg', 0.7);
      }
      if (out.length > LOGO_MAX) throw new Error('big');
      return out;
    });
  }

  /* the uploaded logo, else the site's favicon once "Use the site's logo" was tapped, else initials */
  function Logo({id, client, size, sm}) {
    const ctx = M.useCtx();
    const c = client || ctx.coll.clients.map[id] || {};
    const [broken, setBroken] = useState('');
    const s = size || (sm ? 36 : 56);
    const domain = domainOf(ctx, id, c);
    const auto = !c.logo && c.useAutoLogo && domain && broken !== domain;
    const cls = 'cl-logo' + (sm ? ' sm' : '');
    const st = {width: s + 'px', height: s + 'px'};
    if (c.logo || auto) {
      return html`<img class=${cls} src=${c.logo || faviconUrl(domain)} alt=${c.name || 'logo'} width=${s} height=${s} style=${st}
        data-logo=${c.logo ? 'upload' : 'auto'} onError=${() => { if (!c.logo) setBroken(domain); }}/>`;
    }
    return html`<span class=${cls + ' cl-initials'} style=${st} data-logo="initials" aria-label=${c.name || ''}>${initials(c.name)}</span>`;
  }

  /* ---------- the news: the Radar stream, filtered to this client (standalone only) ---------- */
  let newsCache = null;
  function useNews(enabled) {
    const [items, setItems] = useState(() => (newsCache ? newsCache.data : null));
    useEffect(() => {
      if (!enabled || !live()) return undefined;
      if (newsCache && Date.now() - newsCache.got < NEWS_TTL) { setItems(newsCache.data); return undefined; }
      let on = true;
      api('news', {}).then(d => { newsCache = {data: (d && d.items) || [], got: Date.now()}; if (on) setItems(newsCache.data); }, () => { if (on) setItems([]); });
      return () => { on = false; };
    }, [enabled]);
    return items;
  }
  function InTheNews({items}) {
    if (!items || !items.length) return null;
    const body = html`<${UI.Card} title="In the news" id="client-news">
      <div class="cl-news">
        ${items.map(it => html`<a key=${it.id || it.link} href=${/^https?:\/\//i.test(it.link || '') ? it.link : '#'} target="_blank" rel="noopener noreferrer">
          <span class="t">${it.title}</span><span class="w num">${it.source ? it.source + ', ' : ''}${U.timeAgo(it.at || Date.now())}</span>
        </a>`)}
      </div>
    <//>`;
    return html`<${UI.Fold} title="In the news" summary=${items.length + (items.length === 1 ? ' story' : ' stories')} id="fold-client-news">${body}<//>`;
  }

  /* ---------- the company brain ---------- */
  const fieldsOf = src => { const o = {}; BRAIN.forEach(b => { const v = src && src[b.k]; o[b.k] = noDash(typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v))).trim().slice(0, BRAIN_MAX); }); return o; };
  function brainPrompt(ctx, id, f, domain, site) {
    const org = f.org && M.base && M.base.org ? M.base.org(ctx, f.org) : orgOf(ctx, id);
    const people = org && M.base && M.base.peopleAt ? M.base.peopleAt(ctx, org.id) : [];
    const pname = p => String(p.name || ((p.first || '') + ' ' + (p.last || ''))).trim();
    return [
      'Build the company brain for the client ' + f.name + ' of Mask360, from the material below.',
      'Return a JSON object with exactly these keys, each a string under ' + BRAIN_MAX + ' characters: ' + BRAIN.map(b => b.k + ' (' + b.label + ')').join(', ') + '.',
      'Write only what the material supports. When the material says nothing about a key, write "Not on the site." for that key. Plain sentences, no lists, no emoji, no dashes.',
      site ? 'SITE TEXT (read from ' + site.url + '):\nTITLE: ' + (site.title || '') + '\nDESCRIPTION: ' + (site.description || '') + '\n' + (site.text || '')
        : 'NO SITE TEXT: this copy of m360 cannot read the web. Build a careful brain from the name, the domain and the agency notes below, and write "Not on the site." for anything the notes do not cover.',
      'CLIENT: name ' + f.name + (domain ? ', domain ' + domain : '') + (f.industry ? ', industry ' + f.industry : '') + (f.hq ? ', hq ' + f.hq : '') + (f.since ? ', client since ' + f.since : ''),
      'AGENCY NOTES: memory: ' + (f.memory || 'none') + '; approvals: ' + (f.approvals || 'none') + '; never: ' + (f.never || 'none') + '; tone: ' + (f.tone || 'none'),
      org ? 'BASE COMPANY: ' + [org.name, org.industry, org.size ? org.size + ' people' : '', [org.city, org.country].filter(Boolean).join(', '), org.website].filter(Boolean).join(', ')
        + (Array.isArray(org.keywords) && org.keywords.length ? '; keywords ' + org.keywords.slice(0, 12).join(', ') : '') : 'BASE COMPANY: none linked',
      'PEOPLE WE KNOW THERE: ' + (people.length ? people.slice(0, 12).map(p => pname(p) + (p.title ? ' (' + p.title + ')' : '')).join(', ') : 'none')
    ].join('\n\n');
  }
  function Sources({list}) {
    const urls = (list || []).filter(s => /^https?:\/\//i.test(String(s)));
    if (!urls.length) return null;
    return html`<div class="cl-src">
      <span>read from</span>
      ${urls.map(u => html`<a key=${u} href=${u} target="_blank" rel="noopener noreferrer">${u.replace(/^https?:\/\//i, '').replace(/^www\./i, '')}</a>`)}
    </div>`;
  }
  function Brain({id, f}) {
    const ctx = M.useCtx();
    const doc = ctx.coll.clients.map[id] || {};
    const saved = doc.brain || null;
    const savedKey = JSON.stringify(saved || {});
    const [d, setD] = useState(() => fieldsOf(saved));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState('');
    const [err, setErr] = useState('');
    const [note, setNote] = useState('');
    const ctl = useRef(null);
    useEffect(() => { if (!dirty) setD(fieldsOf(saved)); }, [savedKey]);
    useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
    const domain = domainOf(ctx, id, {...doc, ...f});
    const canAI = M.ai.on(ctx);
    const fromModel = !!saved && Array.isArray(saved.sources) && saved.sources.indexOf('model') >= 0;

    async function build() {
      if (busy) return;
      if (ctl.current) ctl.current.abort();
      const c = new AbortController(); ctl.current = c;
      setBusy(true); setErr(''); setNote('');
      try {
        let site = null;
        const sources = [];
        if (live() && domain) {
          setStep('Reading ' + domain);
          try {
            const p = await api('peek', {url: f.website || ('https://' + domain)});
            if (p && !p.error && p.text) { site = p; (Array.isArray(p.sources) && p.sources.length ? p.sources : [p.url]).forEach(u => { if (u) sources.push(u); }); }
            else setNote('The site did not answer' + (p && p.error ? ' (' + p.error + ')' : '') + '. Built from what m360 knows.');
          } catch (e) { setNote('The site could not be read' + (e && e.message ? ' (' + e.message + ')' : '') + '. Built from what m360 knows.'); }
        }
        if (c.signal.aborted) return;
        setStep('Thinking');
        const out = await M.ai.json(ctx, brainPrompt(ctx, id, f, domain, site), {signal: c.signal, cache: false});
        if (c.signal.aborted) return;
        const fields = fieldsOf(out);
        const brain = {...fields, sources: sources.length ? sources : ['model'], at: Date.now(), by: ctx.uid};
        await ctx.W.update('clients/' + id, {brain, updated: Date.now()});
        setD(fields); setDirty(false);
        M.toast('Brain built');
      } catch (e) {
        if (!(e && e.code === 'cancelled')) setErr(M.ai.errCopy(e && e.code));
      } finally { setBusy(false); setStep(''); }
    }
    async function saveFields() {
      if (saving) return;
      setSaving(true);
      try {
        const fields = fieldsOf(d);
        await ctx.W.update('clients/' + id, {brain: {...(saved || {sources: [], at: 0, by: ''}), ...fields, editedAt: Date.now(), editedBy: ctx.uid}, updated: Date.now()});
        setDirty(false);
        M.toast('Saved');
      } catch (e) { /* toasted by the write layer */ }
      setSaving(false);
    }
    const edit = (k, v) => { setD(x => ({...x, [k]: String(v || '').slice(0, BRAIN_MAX)})); setDirty(true); };
    const body = html`<section class="ai-card" id="client-brain">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Company brain</div></div>
        ${canAI ? html`<button type="button" class="btn sm" id="brain-build" disabled=${busy} onClick=${build}>
          ${busy ? html`<${M.Thinking} label=${step || 'Thinking'}/>` : html`<span class="spark">\u2726</span> ${saved ? 'Rebuild' : 'Build the brain'}`}</button>` : null}
      </div>
      <div class="small ink62" style=${{marginTop: '8px'}}>
        ${saved && saved.at ? html`<span id="brain-built">Built ${U.timeAgo(saved.at)} by <${UI.Name} id=${saved.by} fallback="m360"/></span>`
          : (live() ? (domain ? 'Reads ' + domain + ' and what m360 knows, then fills the nine fields. Edit anything.' : 'Add a website, then build the brain from the site. Without one it builds from the notes.')
            : 'No site read on this build. The brain comes from the name, the domain and the notes above.')}
      </div>
      ${fromModel ? html`<div class="small" id="brain-model-line" style=${{marginTop: '6px', fontWeight: 500}}>${MODEL_LINE}</div>` : null}
      ${saved ? html`<${Sources} list=${saved.sources}/>` : null}
      ${note ? html`<div class="small ink62" style=${{marginTop: '6px'}}>${note}</div>` : null}
      ${err ? html`<div class="small flame-t" style=${{marginTop: '6px'}}>${err}</div>` : null}
      <div class="cl-grid">
        ${BRAIN.map(b => html`<${UI.TextArea} key=${b.k} id=${'brain-' + b.k} label=${b.label} rows=${2} value=${d[b.k]} onChange=${v => edit(b.k, v)}
          placeholder=${saved ? '' : 'Not built yet'}/>`)}
      </div>
      <div class="row" style=${{marginTop: '12px'}}>
        <${UI.Btn} kind="sec" sm=${true} id="brain-save" disabled=${!dirty || saving} onClick=${saveFields}>Save brain<//>
        ${dirty ? html`<span class="small ink62">Edits are kept on the client.</span>` : null}
      </div>
    </section>`;
    return html`<${UI.Fold} title="Company brain" open=${true} summary=${saved && saved.at ? 'built ' + U.timeAgo(saved.at) : 'not built yet'} id="fold-client-brain">${body}<//>`;
  }

  /* ---------- meeting prep: one screen from everything m360 has on this client ---------- */
  function Prep({id, f, news}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const nm = await M.ai.names(ctx);
      const doc = ctx.coll.clients.map[id] || {};
      const b = doc.brain || {};
      const td = U.todayStr();
      const projects = projectsOf(ctx, id);
      const tasks = tasksOf(ctx, id, projects).filter(t => t.status !== 'done');
      const eods = eodMentions(ctx, f.name, 14).slice(0, 6);
      const pitches = pitchesOf(ctx, id, f.name).filter(p => p.stage !== 'won' && p.stage !== 'lost');
      const org = f.org && M.base && M.base.org ? M.base.org(ctx, f.org) : orgOf(ctx, id);
      const people = org && M.base && M.base.peopleAt ? M.base.peopleAt(ctx, org.id) : [];
      const pname = p => String(p.name || ((p.first || '') + ' ' + (p.last || ''))).trim();
      const h = health(ctx, id);
      const brainLines = BRAIN.map(x => b[x.k] ? '- ' + x.label + ': ' + b[x.k] : '').filter(Boolean);
      const material = [
        'CLIENT: ' + f.name + (f.industry ? ', ' + f.industry : '') + (f.hq ? ', ' + f.hq : '') + (f.since ? ', client since ' + f.since : '') + '. Health: ' + HEALTH[h.level].label.toLowerCase() + ' (' + h.why + ').',
        'BRAIN:\n' + (brainLines.join('\n') || '- not built yet'),
        'AGENCY NOTES: memory: ' + (f.memory || 'none') + '; approvals: ' + (f.approvals || 'none') + '; never: ' + (f.never || 'none') + '; tone: ' + (f.tone || 'none'),
        'PROJECTS:\n' + (projects.map(p => '- ' + p.name + ' (' + p.status + (p.due ? ', due ' + p.due : '') + ', owner ' + (nm[p.owner] || 'none') + ')').join('\n') || '- none'),
        'OPEN TASKS (' + tasks.length + '):\n' + (tasks.slice(0, 20).map(t => '- ' + t.title + ' (' + t.status + (t.due ? ', due ' + t.due + (t.due < td ? ' OVERDUE' : '') : '') + ', ' + (nm[t.owner] || 'unassigned') + ')').join('\n') || '- none'),
        'RECENT EOD LINES MENTIONING THEM:\n' + (eods.map(e => '- ' + e.date + ' ' + (nm[e.uid] || 'someone') + ': ' + e.text.slice(0, 200)).join('\n') || '- none'),
        'OPEN PITCHES:\n' + (pitches.map(p => '- ' + p.brand + ', stage ' + p.stage + (p.next ? ', next: ' + p.next + (p.nextDate ? ' by ' + p.nextDate : '') : '')).join('\n') || '- none'),
        'PEOPLE WE KNOW THERE:\n' + (people.slice(0, 10).map(p => '- ' + pname(p) + (p.title ? ', ' + p.title : '') + (p.stage ? ' (' + p.stage + ')' : '')).join('\n') || '- none'),
        'RECENT NEWS:\n' + ((news || []).slice(0, 5).map(n => '- ' + n.title + (n.source ? ' (' + n.source + ')' : '')).join('\n') || '- none')
      ].join('\n\n');
      return r.run(o => M.ai.text(ctx,
        'Prep me for a meeting with ' + f.name + '. One screen, under 260 words, in this order with bold headers: Who they are, What we are doing for them, Open pitches, People we know, In the news, Three questions to ask, One risk. ' +
        'Use only the material below. When a section has nothing, write "nothing on file" in one line. Short lines, no emoji, no dashes.\n\n' + material,
        {signal: o.signal, onText: o.onText, cache: false}));
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    const body = html`<div class="ai-card" id="client-prep">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Meeting prep</div></div>
        <button type="button" class="btn sm" id="prep-go" disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking}/>` : html`<span class="spark">\u2726</span> ${r.text ? 'Prep me again' : 'Prep me for a meeting'}`}</button>
      </div>
      ${r.text ? html`<div style=${{marginTop: '12px'}}><${M.AIText} text=${r.text}/>
        <button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => navigator.clipboard.writeText(r.text).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here', true))}>Copy the prep</button></div>`
        : html`<div class="small ink62" style=${{marginTop: '8px'}}>${busy ? 'Reading the brain, projects, tasks, pitches, people and news.' : 'Who they are, what we are doing, open pitches, the people, the news, three questions and one risk. One screen.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </div>`;
    return html`<${UI.Fold} title="Meeting prep" summary=${r.text ? 'ready to copy' : 'one tap'} id="fold-client-prep">${body}<//>`;
  }

  function HealthLine({id}) {
    const ctx = M.useCtx();
    const h = health(ctx, id);
    return html`<div class=${'cl-health ' + h.level} id="client-health" data-health=${h.level}><i/><span><b>${HEALTH[h.level].label}</b>${h.why ? ', ' + h.why : ''}</span></div>`;
  }

  /* ---------- the drawer ---------- */
  function ClientDrawer({id, onClose}) {
    const ctx = M.useCtx();
    const existing = id ? ctx.coll.clients.map[id] : null;
    const fin = financeOf(ctx);
    const ex = k => (existing && existing[k]) || '';
    const [f, setF] = useState(() => ({
      name: ex('name'), status: ex('status') || 'live', pod: ex('pod'), owner: (existing && existing.owner) || ctx.uid,
      memory: ex('memory'), approvals: ex('approvals'), never: ex('never'), links: ex('links'), org: ex('org'),
      website: ex('website'), industry: ex('industry'), hq: ex('hq'), since: ex('since'), tone: ex('tone'),
      instagram: (ex('socials') || {}).instagram || '', linkedin: (ex('socials') || {}).linkedin || '', youtube: (ex('socials') || {}).youtube || '',
      logo: ex('logo'), useAutoLogo: !!(existing && existing.useAutoLogo),
      monthly: id && fin[id] ? String(fin[id].monthly || '') : ''
    }));
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const field = (k, v) => set(k, String(v || '').slice(0, LIMITS[k] || 200));
    const owners = ctx.activeMembers.map(m => ({v: m.uid, label: m.title ? m.empId + ' ' + m.title : m.empId}));
    /* the company in the Base this client is, when the Base has companies */
    const orgOpts = useMemo(() => {
      const list = (M.search && M.search.orgs) ? M.search.orgs(ctx) : [];
      return list.map(o => ({v: o.id, label: o.name || o.id})).sort((a, b) => a.label.localeCompare(b.label));
    }, [ctx.coll.orgs]);
    const draft = {...(existing || {}), ...f, socials: {instagram: f.instagram, linkedin: f.linkedin, youtube: f.youtube}};
    const domain = domainOf(ctx, id, draft);
    const news = useNews(!!id);
    const mine = useMemo(() => (id && news ? newsFor(news, f.name, domain) : []), [news, id, f.name, domain]);

    const onFile = e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type || '')) { M.toast('Pick an image file.', true); return; }
      shrinkLogo(file).then(data => { setF(x => ({...x, logo: data, useAutoLogo: false})); },
        err => M.toast(err && err.message === 'big' ? 'That logo stays too big even when shrunk. Try a simpler picture.' : 'That picture did not open. Try another one.', true));
    };

    async function save() {
      if (!f.name.trim() || busy) return;
      const website = cleanSite(f.website);
      if (website === null) { M.toast('Check the website. A web address like swisse.ae works.', true); return; }
      const socials = {};
      for (const s of SOCIALS) {
        const v = cleanHandle(f[s.k]);
        if (v === null) { M.toast('Check the ' + s.label + ' handle. A handle or a link works.', true); return; }
        socials[s.k] = v;
      }
      const org = f.org && M.base && M.base.org ? M.base.org(ctx, f.org) : orgOf(ctx, id);
      const cid = id || U.uid();
      const doc = {name: f.name.trim(), status: f.status, pod: f.pod, owner: f.owner,
        memory: f.memory, approvals: f.approvals, never: f.never, links: f.links, org: f.org || '',
        website, domain: domainFrom(website) || (org ? (org.domain || domainFrom(org.website)) : ''),
        industry: f.industry.trim(), hq: f.hq.trim(), since: f.since.trim(), tone: f.tone.trim(), socials,
        logo: f.logo || '', useAutoLogo: !!f.useAutoLogo,
        updated: Date.now(), by: ctx.uid};
      setBusy(true);
      try {
        if (id) await ctx.W.update('clients/' + id, doc);
        else await ctx.W.set('clients/' + cid, doc);
        if (ctx.isFounder && String(f.monthly).trim() !== '') {
          await ctx.W.merge('data/users/' + ctx.uid + '/finance', {clients: {[cid]: {monthly: Number(f.monthly) || 0}}});
        }
        M.toast('Saved');
        onClose();
      } catch (e) { setBusy(false); }
    }

    const hasLogo = !!f.logo;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${id ? 'Client' : 'New client'}
      footer=${html`<div class="row between grow">
        <div>${id && ctx.isFounder ? html`<${UI.ConfirmBtn} label="Tap again to confirm"
          onConfirm=${() => { ctx.W.del('clients/' + id).then(() => { M.toast('Deleted'); onClose(); }); }}>Delete<//>` : null}</div>
        <${UI.Btn} onClick=${save} disabled=${!f.name.trim() || busy}>${id ? 'Save' : 'Create client'}<//>
      </div>`}>
      <div class="cl-logorow" id="client-logo">
        <${Logo} id=${id} client=${draft}/>
        <div class="grow">
          <div class="cl-title"><span class="nm">${f.name || 'New client'}</span>${domain ? html`<span class="tiny ink62">${domain}</span>` : null}</div>
          <div class="row">
            <input type="file" accept="image/*" id="client-logo-file" class="cl-file" ref=${fileRef} onChange=${onFile} aria-label="Choose a logo"/>
            <${UI.Btn} kind="sec" sm=${true} onClick=${() => fileRef.current && fileRef.current.click()}>Upload a logo<//>
            ${domain && !(f.useAutoLogo && !hasLogo) ? html`<${UI.Btn} kind="ghost" sm=${true} id="client-logo-auto" onClick=${() => setF(x => ({...x, useAutoLogo: true, logo: ''}))}>Use the site's logo<//>` : null}
            ${hasLogo || f.useAutoLogo ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => setF(x => ({...x, useAutoLogo: false, logo: ''}))}>Remove<//>` : null}
          </div>
          <div class="hint">Square works best. Shrunk to 128 px, shown on the card and in search.</div>
        </div>
      </div>
      ${id ? html`<${HealthLine} id=${id}/>` : null}
      <${UI.Input} id="client-name" label="name" value=${f.name} onChange=${v => set('name', v)}/>
      <${UI.Field} label="status"><${UI.Seg} options=${STATUS} value=${f.status} onChange=${v => set('status', v)} ariaLabel="Status"/><//>
      <div class="grid2">
        <${UI.Input} label="pod" value=${f.pod} onChange=${v => set('pod', v)}/>
        <${UI.Select} label="owner" value=${f.owner} onChange=${v => set('owner', v)} options=${[{v: '', label: 'No owner'}].concat(owners)}/>
      </div>
      <${UI.Input} id="client-website" label="website" value=${f.website} onChange=${v => field('website', v)} placeholder="swisse.ae"
        hint=${domain ? 'Domain ' + domain + '. The brain reads this site on the EdgeOne build.' : 'The brain reads this site on the EdgeOne build.'}/>
      <div class="grid2">
        <${UI.Input} id="client-industry" label="industry" value=${f.industry} onChange=${v => field('industry', v)} placeholder="Wellness"/>
        <${UI.Input} id="client-hq" label="hq city" value=${f.hq} onChange=${v => field('hq', v)} placeholder="Dubai"/>
      </div>
      <div class="grid2">
        <${UI.Input} id="client-since" label="client since" value=${f.since} onChange=${v => field('since', v)} placeholder="2024 or 2024-06"/>
        <${UI.Input} id="client-tone" label="tone, one line" value=${f.tone} onChange=${v => field('tone', v)} placeholder="Warm, premium, never salesy"/>
      </div>
      <div class="grid3">
        ${SOCIALS.map(s => html`<${UI.Input} key=${s.k} id=${'client-' + s.k} label=${s.label} value=${f[s.k]} onChange=${v => field(s.k, v)} placeholder=${s.placeholder}/>`)}
      </div>
      ${SOCIALS.some(s => f[s.k]) ? html`<div class="cl-socials">
        ${SOCIALS.filter(s => f[s.k]).map(s => html`<a key=${s.k} class="pill cl-social" href=${socialHref(s.k, f[s.k])} target="_blank" rel="noopener noreferrer"><span class="k">${s.label}</span>${socialText(f[s.k])}</a>`)}
      </div>` : null}
      <${UI.TextArea} id="client-memory" label="brand memory" value=${f.memory} onChange=${v => set('memory', v)}/>
      <${UI.TextArea} id="client-approvals" label="approvals" value=${f.approvals} onChange=${v => set('approvals', v)}/>
      <${UI.TextArea} id="client-never" label="lines never to cross" value=${f.never} onChange=${v => set('never', v)}/>
      <${UI.TextArea} label="links, one per line" value=${f.links} onChange=${v => set('links', v)}/>
      ${orgOpts.length ? html`<${UI.Select} id="client-org" label="company in the Base" value=${f.org} onChange=${v => set('org', v)}
        options=${[{v: '', label: 'Not linked yet'}].concat(orgOpts)} hint="Links this client to its company and people in the Base."/>` : null}
      ${id ? html`<${Brain} id=${id} f=${f}/>` : html`<div class="hint">Create the client, then build its brain from the site.</div>`}
      ${id ? html`<${InTheNews} items=${mine}/>` : null}
      ${id ? html`<${Prep} id=${id} f=${f} news=${mine}/>` : null}
      ${id && M.parts.PeopleAtClient && orgOf(ctx, id) ? html`<${UI.Fold} title="People at this client" id="fold-client-people"><${M.parts.PeopleAtClient} id=${id}/><//>` : null}
      ${id && M.parts.Connections ? html`<${M.parts.Connections} kind="client" id=${id}/>` : null}
      ${id && M.parts.ClientUpdate && M.ai.on(ctx) ? html`<${UI.Fold} title="Client update" summary="a client-ready note" id="fold-client-update"><${M.parts.ClientUpdate} id=${id} name=${f.name}/><//>` : null}
      ${ctx.isFounder ? html`<${UI.Input} label="monthly revenue" type="number" value=${f.monthly}
        onChange=${v => set('monthly', v)} hint="Private to you."/>` : null}
    <//>`;
  }

  /* ---------- the page ---------- */
  function Clients() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null); /* id, or 'new' */
    M.useIntent('client', () => setOpen('new'));
    /* #clients/<id> opens that client (search results and Connections land here) */
    const route = M.useRoute();
    const routeId = route.page === 'clients' ? route.id : null;
    useEffect(() => { if (routeId) setOpen(routeId); }, [routeId]);
    const close = () => { setOpen(null); if (routeId) M.nav('#clients'); };
    const map = ctx.coll.clients.map;
    const sh = useMemo(() => {
      const out = {};
      if (ctx.isFounder) shares(ctx).forEach(r => { out[r.id] = r; });
      return out;
    }, [ctx]);
    const ids = Object.keys(map).sort((a, b) => String(map[a].name || '').localeCompare(String(map[b].name || '')));

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="client brains" title="Clients">
        <${UI.Btn} onClick=${() => setOpen('new')}>New client<//>
      <//>
      ${ids.length ? html`<div class="grid2">
        ${ids.map(id => {
          const c = map[id];
          const comp = completeness(c);
          const s = sh[id];
          const h = health(ctx, id);
          return html`<button type="button" class="card rowbtn" key=${id} data-client=${id} onClick=${() => setOpen(id)}
            style=${{cursor: 'pointer'}}>
            <div class="row between nowrap">
              <span class="cl-title grow"><${Logo} id=${id} client=${c} sm=${true}/><span class="nm">${c.name}</span></span>
              <${UI.Pill} kind=${STATUS_PILL[c.status]}>${c.status || 'live'}<//>
            </div>
            <div class="row small ink62" style=${{marginTop: '8px'}}>
              ${c.industry ? html`<span>${c.industry}</span>` : null}
              ${c.pod ? html`<span>${c.pod}</span>` : null}
              ${c.owner ? html`<${UI.Avatar} id=${c.owner} size=${22}/>` : null}
              <span class="num">${openTaskCount(ctx, id)} open tasks</span>
            </div>
            <div class="row" style=${{marginTop: '10px'}}>
              <span class=${'pill ' + HEALTH[h.level].pill} title=${h.why} data-health=${h.level}>${HEALTH[h.level].label}</span>
              <span class=${'small num' + (comp.filled < comp.total ? ' flame-t' : '')}>${comp.filled} of ${comp.total} fields</span>
              <span class="tiny ink62">updated ${c.updated ? U.timeAgo(c.updated) : 'never'}</span>
            </div>
            ${s ? html`<div class="row small" style=${{marginTop: '8px'}}>
              <span class="num" style=${{fontWeight: 500}}>${U.inr(s.monthly)}</span>
              <span class="ink62 num">${s.share}% of monthly revenue</span>
            </div>` : null}
          </button>`;
        })}
      </div>` : html`<${UI.Card}><${UI.Empty} text="No clients yet."/><//>`}
      ${open ? html`<${ClientDrawer} id=${open === 'new' ? null : open} onClose=${close}/>` : null}
    </div>`;
  }

  /* AI: a client-ready status note from this client's projects and tasks */
  function ClientUpdate({id, name}) {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const nm = await M.ai.names(ctx);
      const td = U.todayStr();
      const projects = Object.keys(ctx.coll.projects.map).map(k => ({id: k, ...ctx.coll.projects.map[k]})).filter(p => p.client === id && !p.archived);
      const tasks = Object.keys(ctx.coll.tasks.map).map(k => ({id: k, ...ctx.coll.tasks.map[k]})).filter(t => t.client === id || projects.some(p => p.id === t.project));
      const lines = tasks.slice(0, 60).map(t => '- ' + t.title + ' (' + t.status + (t.due ? ', due ' + t.due : '') + ', ' + (nm[t.owner] || 'unassigned') + ')');
      const out = await r.run(o => M.ai.text(ctx,
        'Write a short WhatsApp status update for the client ' + name + ' from Mask360, in the agency\'s warm and confident voice. Today is ' + td + '. ' +
        'Structure: one friendly opening line, then "Done" and "Next" as short bullet lists, then one line on what we need from them (or "Nothing needed from your side"). ' +
        'Never mention internal statuses, revisions, lateness or people\'s workloads. Under 120 words. No emoji.\n\nPROJECTS:\n' +
        (projects.map(p => '- ' + p.name + ' (' + p.status + (p.due ? ', due ' + p.due : '') + ')').join('\n') || '- none') + '\n\nTASKS:\n' + (lines.join('\n') || '- none'),
        {signal: o.signal, onText: o.onText, cache: false}));
      return out;
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    return html`<div class="ai-card" id="client-update">
      <div class="row between">
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>Client update</div></div>
        <button type="button" class="btn sm" disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking}/>` : html`<span class="spark">\u2726</span> ${r.text ? 'Write it again' : 'Write an update'}`}</button>
      </div>
      ${r.text ? html`<div style=${{marginTop: '12px'}}><${M.AIText} text=${r.text}/>
        <button type="button" class="linky small" style=${{marginTop: '8px'}} onClick=${() => navigator.clipboard.writeText(r.text).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here', true))}>Copy for WhatsApp</button></div>`
        : html`<div class="small ink62" style=${{marginTop: '8px'}}>${busy ? 'Reading this client\'s projects and tasks.' : 'A client-ready note on what shipped and what is next, in one tap.'}</div>`}
      ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errCopy(r.err)}</div>` : null}
    </div>`;
  }
  M.parts.ClientUpdate = ClientUpdate;
  M.parts.ClientLogo = Logo;

  M.pages.Clients = Clients;
  M.clients = {completeness, shares, openTaskCount, STATUS, FIELDS, BRAIN, HEALTH, health, domainOf, domainFrom, cleanSite, newsFor, eodMentions, brandWord, MODEL_LINE};
})();
