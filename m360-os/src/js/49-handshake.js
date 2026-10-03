/* module: handshake. The LinkedIn DM desk, the founder's. Screenshots of a connection list (or pasted
   lines) come in; every name is read with its headline, company and connection state and checked
   against the people already messaged. Each person lands in one bucket (decision maker, brand-side
   marketer, partner, creator, talent, skip), the company is looked up before a line is written about
   it (Google News for the last ninety days, the site when the Base knows it), one hook is picked from
   strongest to weakest, the proof is matched to the category, and the message is written in five beats
   under the copy rules, then checked by code. The founder at a company goes first and the rest wait
   48 hours; two people at one company get different angles; a pending connection waits for the accept.
   Every message ships as the name in bold with the text in a copy block, then the skip list and the
   flags. Nothing is sent from here: Copy, paste into LinkedIn, tap Sent. The desk is the team's: each
   message is written as the person running it, and the founder's own proof lines stay his. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const SETTINGS = 'dm/settings';
  const HOLD_H = 48;
  const BUCKETS = [
    {v: 'decision', label: 'Decision maker', who: 'founders, MDs, CMOs, CBOs, brand heads', ask: '20 minutes'},
    {v: 'marketer', label: 'Brand-side marketer', who: 'brand managers, social or comms leads at a named company', ask: 'a quick call'},
    {v: 'partner', label: 'Partner', who: 'agencies, PR firms, production houses, NPD studios', ask: 'a coffee, the angle is referral or collaboration'},
    {v: 'creator', label: 'Creator', who: 'creators and talent with an audience', ask: 'a media kit'},
    {v: 'talent', label: 'Talent', who: 'people who fit a role at Mask360', ask: 'a CV'},
    {v: 'skip', label: 'Skip', who: 'recruiters, job seekers with no fit, people selling the same service, no headline', ask: 'none'}
  ];
  const RANK = {decision: 0, marketer: 1, partner: 2, creator: 3, talent: 4, skip: 9};
  const HOOKS = ['news', 'company', 'career', 'role', 'question'];
  const HOOK_LABEL = {news: 'fresh news', company: 'their company', career: 'their career run', role: 'their role', question: 'a question'};
  const DEFAULTS = {
    proofs: [
      {k: 'fmcg', label: 'FMCG and beverage', line: 'DRINK BUBZ, PICKLE SODA, THE WHOLE TRUTH, KLAW, JIMMY\'S, MEE MEE'},
      {k: 'jewellery', label: 'Jewellery', line: 'the ZORÁE Middle East mandate'},
      {k: 'realestate', label: 'Real estate', line: 'I come from real estate on the builder side', personal: true},
      {k: 'luxury', label: 'Luxury, alcobev and wealth', line: 'the experiential arm: small rooms, UHNI and HNI experiences'},
      {k: 'unilever', label: 'Unilever and big FMCG', line: 'the Unilever creator stat'}
    ],
    always: 'India & UAE',
    about: 'Mask360 is a boutique 360 marketing and creative agency for luxury and premium brands, Mumbai and the UAE.',
    hold: HOLD_H
  };
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  /* what the headline says about seniority, used before the model has sorted the batch */
  const guessRank = h => /founder|co-founder|\bceo\b|\bcmo\b|\bcbo\b|\bcoo\b|managing director|\bmd\b|head of|director|\bvp\b|president|owner|partner\b/i.test(String(h || '')) ? 0 : /recruit|talent acquisition/i.test(String(h || '')) ? 9 : 1;
  const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => window.M360_API(a, body || {});

  /* ---------- the records ---------- */
  const people = ctx => Object.keys(ctx.coll.dm.map).filter(id => id !== 'settings').map(id => ({id, ...ctx.coll.dm.map[id]})).filter(p => p && p.name);
  const settings = ctx => ({...DEFAULTS, ...((ctx.coll.dm.map.settings) || {})});
  /* the lines a person may claim: the founder's own history stays his */
  const proofsFor = (ctx, s) => (s.proofs || []).filter(x => ctx.isFounder || !(x.personal || (DEFAULTS.proofs.find(d => d.k === x.k) || {}).personal));
  const sameCompany = (a, b) => norm(a) && norm(a) === norm(b);
  const messaged = (ctx, name) => people(ctx).find(p => norm(p.name) === norm(name) && (p.state === 'sent' || p.message));

  /* ---------- the copy rules, checked by code ---------- */
  const CONTRAST = [/\brather than\b/i, /\binstead of\b/i, /\bnot\s+[^.,;]{1,40},\s*but\b/i, /\bnot\s+(?:just|only|merely)\b/i];
  function check(msg, person) {
    const t = String(msg || '').trim();
    const out = [];
    if (!t) return ['empty'];
    const sentences = t.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 1);
    const words = t.split(/\s+/).filter(Boolean).length;
    if (sentences.length < 3 || sentences.length > 5) out.push(sentences.length + ' sentences (3 to 5)');
    if (words < 40 || words > 70) out.push(words + ' words (40 to 70)');
    if (/\u2014|\u2013/.test(t)) out.push('a dash');
    if (/\s-\s/.test(t)) out.push('a spaced hyphen');
    CONTRAST.forEach(re => { if (re.test(t)) out.push('a contrast pair: "' + (re.exec(t) || [''])[0] + '"'); });
    if (/https?:\/\/|www\.|\.com\b|\.in\b|\.ae\b/i.test(t)) out.push('a link');
    if (/₹|\$|\bAED\b|\bINR\b|\bprice|pricing|per month|a month|retainer of/i.test(t)) out.push('pricing');
    if (/\bdeck\b|\bcredentials\b|\bportfolio link\b/i.test(t)) out.push('a deck');
    if (/open to work|opentowork|#open/i.test(t)) out.push('the Open to Work badge');
    if (/\band\b/.test(t)) out.push('"and" (use &)');
    if (/!/.test(t)) out.push('an exclamation mark');
    if ((t.match(/\?/g) || []).length > 1) out.push('two questions');
    if (/\b(hope this finds you|i wanted to reach out|touch base|synergy|leverage|circle back|game.changer|unlock)\b/i.test(t)) out.push('template talk');
    if (person && person.name && !new RegExp('\\b' + norm(person.name).split(' ')[0] + '\\b', 'i').test(t) && !/^(thanks for connecting|good to connect)/i.test(t)) out.push('no opener');
    return out;
  }
  /* the deterministic part of the rules, applied before the check */
  const polish = t => String(t || '').replace(/\u2014|\u2013/g, ',').replace(/\s-\s/g, ', ').replace(/\band\b/g, '&').replace(/\s{2,}/g, ' ').replace(/\s,/g, ',').trim();

  /* ---------- intake: names off the screenshots, or pasted lines ---------- */
  function parseLines(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split('|').map(x => x.trim());
      if (parts.length >= 2) return {name: parts[0], headline: parts[1] || '', company: parts[2] || '', status: /pend/i.test(parts[3] || '') ? 'pending' : '1st'};
      return null;
    }).filter(Boolean);
  }
  async function readImages(ctx, images) {
    if (!ctx.sample || !ctx.sample.json) throw new Error('AI is off here');
    const prompt = 'HANDSHAKE READ: These are screenshots of a LinkedIn connections list or invitations page. List every person shown, exactly as printed: full name, headline (the line under the name, whole), the company named in the headline or the badge (empty when none), and the connection state: "pending" when the screenshot shows the invite is still waiting (Pending, Withdraw, Sent), else "1st". Skip ads, "People you may know" and anyone without a name. Reply with JSON only: {"people": [{"name": "", "headline": "", "company": "", "status": "pending|1st"}]}';
    const out = await ctx.sample.json(prompt, {images, cache: false, modelTier: 'default'});
    const list = Array.isArray(out) ? out : (out && out.people) || [];
    return list.map(p => ({name: cut(String(p.name || '').trim(), 80), headline: cut(String(p.headline || '').trim(), 200), company: cut(String(p.company || '').trim(), 80), status: p.status === 'pending' ? 'pending' : '1st'})).filter(p => p.name);
  }
  async function intake(ctx, {images, text, note}) {
    const found = [];
    if (images && images.length) found.push(...await readImages(ctx, images));
    if (text) found.push(...parseLines(text));
    const seen = new Set();
    const added = [], dupes = [];
    const batch = U.uid();
    for (const p of found) {
      const k = norm(p.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const was = people(ctx).find(x => norm(x.name) === k);
      if (was) { dupes.push(p.name + (was.state === 'sent' ? ' (messaged ' + U.fmtDay(U.ymd(new Date(was.sentAt || was.updated || 0))) + ')' : ' (already in)')); continue; }
      const id = U.uid();
      const doc = {name: p.name, headline: p.headline, company: p.company, status: p.status, bucket: '', why: '', hook: null, proof: '', message: '', flags: [], skip: '', verified: null,
        state: 'new', holdUntil: 0, senior: '', batch, note: cut(String(note || ''), 300), created: Date.now(), updated: Date.now(), by: ctx.uid, sentAt: null};
      await ctx.W.set('dm/' + id, doc);
      added.push({id, ...doc});
    }
    return {added, dupes, batch};
  }

  /* ---------- verify: the press and the site, before a line is written ---------- */
  function siteFor(ctx, company) {
    if (!company || !M.base || !M.base.find) return '';
    try {
      const r = M.base.find(ctx, company, {contacts: false, limit: 3});
      const o = (r.orgs || []).find(x => norm(x.name) === norm(company)) || (r.orgs || [])[0];
      if (!o) return '';
      return o.website || (o.domain ? 'https://' + o.domain : '');
    } catch (e) { return ''; }
  }
  async function verify(ctx, p) {
    if (!p.company) return {none: true, at: Date.now()};
    if (!live()) return {none: true, at: Date.now(), why: 'no lookup on this build'};
    try {
      const r = await api('dmverify', {company: p.company, site: siteFor(ctx, p.company)});
      return {news: (r.news || []).slice(0, 6), site: r.site ? {title: r.site.title, description: r.site.description, text: cut(r.site.text, 1500)} : null, at: Date.now(), none: !(r.news || []).length && !r.site};
    } catch (e) { return {none: true, at: Date.now(), why: (e && e.message) || 'lookup failed'}; }
  }

  /* ---------- write: triage, hook, proof, five beats, one ask ---------- */
  function rules(s, who) {
    return [
      'You write LinkedIn DMs for ' + who.name + ', ' + who.title + ' at Mask360, in the first person as them. ' + s.about,
      'BUCKETS decide the message: decision (founders, MDs, CMOs, CBOs, brand heads: ask for 20 minutes), marketer (brand managers, social or comms leads at a named company: ask for a quick call), partner (agencies, PR firms, production houses, NPD studios: the angle is referral or collaboration, ask for a coffee), creator (ask for a media kit), talent (open-to-work profiles that fit Mask360: ask for a CV), skip (recruiters, job seekers with no fit, people selling the same service as Mask360, profiles with no headline).',
      'VERIFY: a fact from their own headline can be used as is. Anything beyond the headline must appear in the VERIFIED block for that person (news or site); when it does not, do not name it and ask a question in its place ("Which brand are you on?"). Flag conflicts: a possible IONIQ investor, a competitor to Kaavish\'s own ventures, someone clearly on their way out.',
      'HOOK, one, strongest first: 1 fresh news (a deal, a round, an appointment from VERIFIED); 2 a true specific line about their company (from VERIFIED or the headline); 3 their career run (from the headline); 4 their role; 5 a question, when nothing can be verified.',
      'PROOF, one line, only when it fits the category: ' + who.proofs.map(x => x.label + ': ' + x.line).join('; ') + '. Always: ' + s.always + '. Only claim work that exists in that list.',
      'FIVE BEATS: 1 opener, "thanks for connecting" or "good to connect", alternate them across the batch; 2 the hook, one line about them; 3 the bridge, their problem in one line then what Mask360 does for it; 4 the proof, one line, only if it fits; 5 one ask set by the bucket.',
      'COPY RULES: 3 to 5 sentences, 40 to 70 words. Proper case, brand names in CAPS, & for and. No em dashes, no en dashes, no hyphen used as a dash. No "X, not Y", no "rather than", no "instead of", no parallel contrast pairs. One idea and one ask. Never invent a number: numbers come from their headline or VERIFIED only. No pricing, decks or links. Never mention Open to Work badges, health or anything personal. Their company is the hero; Mask360 gets one sentence. Plain sentences in ' + who.name.split(' ')[0] + '\'s voice, first person, nothing that sounds like a template or a LinkedIn guru. No exclamation marks. No emoji.',
      'SEQUENCE: when SENIOR names someone at the same company, this is the junior message: a different angle from the senior\'s, and it names the senior once ("I have reached out to Saransh on the Mumbai side too").',
      'For a skip, write no message and give the reason in skip.'
    ].join('\n');
  }
  async function write(ctx, ids) {
    if (!ctx.sample || !ctx.sample.json) throw new Error('AI is off here');
    const s = settings(ctx);
    const nm = await M.ai.names(ctx).catch(() => ({}));
    const who = {name: nm[ctx.uid] || (ctx.member && ctx.member.name) || 'the sender', title: (ctx.member && ctx.member.title) || (ctx.isFounder ? 'founder' : 'team member'), proofs: proofsFor(ctx, s)};
    const all = people(ctx);
    const batch = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
    if (!batch.length) return [];
    /* the senior at each company in this batch or already in the desk: the founder goes first. Before the
       model has sorted a batch, the headline says who is senior; after, the bucket does. */
    const rankOf = p => RANK[p.bucket] != null ? RANK[p.bucket] : guessRank(p.headline);
    const seniorOf = (p, pool) => {
      if (!p.company) return null;
      const peers = (pool || all).filter(x => x.id !== p.id && sameCompany(x.company, p.company) && x.bucket !== 'skip' && x.state !== 'skipped');
      const best = peers.sort((a, b) => rankOf(a) - rankOf(b))[0];
      return best && rankOf(best) < rankOf(p) ? best : null;
    };
    const block = batch.map((p, i) => {
      const v = p.verified || {};
      const vb = v.none ? 'VERIFIED: nothing found online for ' + (p.company || 'this company') + '. Use the headline only, or ask.'
        : 'VERIFIED for ' + p.company + ':' + (v.site ? '\n  site: ' + [v.site.title, v.site.description, cut(v.site.text, 600)].filter(Boolean).join(' | ') : '') + ((v.news || []).length ? '\n  news: ' + v.news.map(n => (n.at ? U.ymd(new Date(n.at)) + ' ' : '') + n.title + ' (' + n.source + ')' + (n.summary ? ': ' + cut(n.summary, 160) : '')).join('\n  news: ') : '');
      const sr = (p.senior ? all.find(x => x.id === p.senior) : null) || seniorOf(p);
      return 'PERSON ' + (i + 1) + ': ' + p.name + '\nHEADLINE: ' + (p.headline || '(none)') + '\nCOMPANY: ' + (p.company || '(none)') + '\nCONNECTION: ' + p.status + (p.note ? '\nNOTE FROM THE SENDER: ' + p.note : '') + (p.bucket ? '\nBUCKET SET BY THE SENDER: ' + p.bucket : '') + '\n' + vb + (sr ? '\nSENIOR: ' + sr.name + ' (' + (sr.headline || sr.bucket) + ') is being messaged first at this company.' : '');
    }).join('\n\n');
    const prompt = 'HANDSHAKE WRITE:\n' + rules(s, who) + '\n\nOPENERS: alternate "Thanks for connecting" and "Good to connect" starting with ' + (people(ctx).filter(p => p.message).length % 2 ? '"Good to connect"' : '"Thanks for connecting"') + '.\n\n' + block +
      '\n\nReply with JSON only: {"people": [{"name": "", "bucket": "decision|marketer|partner|creator|talent|skip", "why": "one line on the bucket", "hookKind": "news|company|career|role|question", "hookLine": "the one line about them", "proof": "the proof line used or empty", "message": "the DM, or empty for a skip", "flags": ["conflict or caution, or none"], "skip": "reason when bucket is skip"}]}';
    const out = await ctx.sample.json(prompt, {cache: false, modelTier: 'complex'});
    const list = Array.isArray(out) ? out : (out && out.people) || [];
    const done = [];
    for (const p of batch) {
      const r = list.find(x => norm(x.name) === norm(p.name)) || list[batch.indexOf(p)];
      if (!r) continue;
      const bucket = BUCKETS.some(b => b.v === r.bucket) ? r.bucket : (p.bucket || 'marketer');
      const message = bucket === 'skip' ? '' : polish(r.message);
      const flags = (Array.isArray(r.flags) ? r.flags : [r.flags]).map(f => cut(String(f || '').trim(), 160)).filter(f => f && !/^none$/i.test(f));
      const qc = message ? check(message, p) : [];
      const patch = {bucket, why: cut(r.why, 200), hook: {kind: HOOKS.indexOf(r.hookKind) >= 0 ? r.hookKind : 'question', line: cut(r.hookLine, 240)}, proof: cut(r.proof, 200), message, flags, qc, skip: bucket === 'skip' ? cut(r.skip || r.why, 200) : '', updated: Date.now()};
      done.push({id: p.id, patch});
    }
    /* the sequence: seniors first, juniors held, pending waits for the accept */
    const patched = done.map(d => ({...all.find(p => p.id === d.id), ...d.patch}));
    const pool = all.map(p => patched.find(x => x.id === p.id) || p);
    for (const d of done) {
      const p = patched.find(x => x.id === d.id);
      const sr = seniorOf(p, pool);
      if (p.bucket === 'skip') d.patch.state = 'skipped';
      else if (p.status === 'pending') d.patch.state = 'waiting';
      else if (sr) { d.patch.state = 'hold'; d.patch.holdUntil = Math.max(Date.now(), Number(sr.sentAt) || 0) + (s.hold || HOLD_H) * 3600000; d.patch.senior = sr.id; }
      else d.patch.state = 'ready';
      await ctx.W.update('dm/' + d.id, d.patch);
    }
    return done;
  }
  /* the whole flow for a set of ids: verify, then write in batches of six */
  async function run(ctx, ids, onStep) {
    /* the records were just written: read them from the live context once they have landed */
    const fresh = () => M.lastCtx || ctx;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 40 && !ids.every(id => fresh().coll.dm.map[id]); i++) await wait(100);
    const todo = ids.map(id => people(fresh()).find(p => p.id === id)).filter(Boolean);
    for (const p of todo) {
      if (onStep) onStep('Checking ' + (p.company || p.name));
      const v = await verify(fresh(), p);
      await fresh().W.update('dm/' + p.id, {verified: v, updated: Date.now()});
    }
    await wait(150);
    for (let i = 0; i < todo.length; i += 6) {
      if (onStep) onStep('Writing ' + Math.min(6, todo.length - i) + (todo.length > 6 ? ' of ' + todo.length : '') + ' messages');
      await write(fresh(), todo.slice(i, i + 6).map(p => p.id));
      await wait(150);
    }
  }
  /* from Ask m360: "DM:" with screenshots */
  async function fromAsk(ctx, images, note) {
    const r = await intake(ctx, {images, note: String(note || '').replace(/^dm:\s*/i, '')});
    M.nav('#handshake');
    if (r.added.length) run(ctx, r.added.map(p => p.id)).catch(e => M.toast((e && e.message) || 'The desk could not write', true));
    return r;
  }

  /* ---------- the page ---------- */
  const STATE_LABEL = {ready: 'Ready to send', hold: 'Held for the senior\'s reply', waiting: 'Waiting on the accept', sent: 'Sent', skipped: 'Skipped', new: 'Not written yet'};
  function Person({p, ctx, all}) {
    const [edit, setEdit] = useState(false);
    const [text, setText] = useState(p.message || '');
    const [busy, setBusy] = useState('');
    useEffect(() => { setText(p.message || ''); }, [p.message]);
    const sr = p.senior ? all.find(x => x.id === p.senior) : null;
    const copy = () => navigator.clipboard.writeText(p.message).then(() => M.toast('Copied. Paste it into LinkedIn'), () => M.toast('Copy is blocked here', true));
    const patch = d => ctx.W.update('dm/' + p.id, {...d, updated: Date.now()});
    const rewrite = async () => { setBusy('rewrite'); try { await run(ctx, [p.id]); } catch (e) { M.toast((e && e.message) || 'Could not rewrite', true); } setBusy(''); };
    const held = p.state === 'hold' && p.holdUntil > Date.now();
    const bucket = BUCKETS.find(b => b.v === p.bucket);
    const search = 'https://www.linkedin.com/search/results/all/?keywords=' + encodeURIComponent(p.name + (p.company ? ' ' + p.company : ''));
    return html`<div class=${'hs-person' + (p.flags && p.flags.length ? ' flagged' : '')} data-state=${p.state} id=${'hs-' + p.id}>
      <div class="row between" style=${{alignItems: 'flex-start', gap: '10px'}}>
        <div class="grow">
          <div class="row" style=${{gap: '8px', flexWrap: 'wrap', alignItems: 'baseline'}}>
            <b class="hs-name">${p.name}</b>
            ${bucket ? html`<${UI.Pill} kind=${p.bucket === 'decision' ? 'flame' : 'ink'}>${bucket.label}<//>` : null}
            ${p.status === 'pending' ? html`<${UI.Pill}>pending<//>` : null}
            ${p.by && p.by !== ctx.uid ? html`<span class="tiny ink62">by <${UI.Name} id=${p.by}/></span>` : null}
            ${p.hook && p.hook.kind ? html`<span class="tiny ink62">hook: ${HOOK_LABEL[p.hook.kind] || p.hook.kind}</span>` : null}
          </div>
          <div class="small ink62">${p.headline || 'no headline'}${p.company ? ' · ' + p.company : ''}</div>
          ${p.why ? html`<div class="tiny ink62">${p.why}</div>` : null}
        </div>
        <a class="linky tiny" href=${search} target="_blank" rel="noopener" data-out="1">Open LinkedIn</a>
      </div>
      ${held ? html`<div class="tiny flame-t">Waits for ${sr ? sr.name : 'the senior'} to answer, until ${U.fmtDay(U.ymd(new Date(p.holdUntil)))} ${U.hhmm(p.holdUntil)}. <button type="button" class="linky tiny" onClick=${() => patch({state: 'ready', holdUntil: 0})}>Release now</button></div>` : null}
      ${p.state === 'waiting' ? html`<div class="tiny ink62">The DM goes after they accept. <button type="button" class="linky tiny" id=${'hs-accept-' + p.id} onClick=${() => patch({status: '1st', state: 'ready'})}>They accepted</button></div>` : null}
      ${p.state === 'skipped' ? html`<div class="small">Skip: ${p.skip || p.why || 'no fit'} <button type="button" class="linky tiny" onClick=${() => patch({state: 'new', bucket: '', skip: ''})}>Bring back</button></div>` : null}
      ${p.message ? html`<div class="hs-copy-wrap">
        ${edit ? html`<textarea class="input hs-edit" rows="5" value=${text} onInput=${e => setText(e.target.value)} aria-label="The message"/>`
          : html`<pre class="hs-copy" id=${'hs-msg-' + p.id}>${p.message}</pre>`}
        ${p.qc && p.qc.length ? html`<div class="tiny flame-t">QC: ${p.qc.join('; ')}</div>` : null}
        <div class="row" style=${{gap: '8px', flexWrap: 'wrap', marginTop: '6px'}}>
          ${edit ? html`<${UI.Btn} sm=${true} onClick=${() => { const m = polish(text); patch({message: m, qc: check(m, p)}); setEdit(false); }}>Save<//><button type="button" class="linky tiny" onClick=${() => { setEdit(false); setText(p.message); }}>Cancel</button>`
            : html`<${UI.Btn} sm=${true} onClick=${copy} id=${'hs-copy-' + p.id}>Copy<//>
              ${p.state !== 'sent' ? html`<${UI.Btn} sm=${true} kind="sec" id=${'hs-sent-' + p.id} onClick=${() => patch({state: 'sent', sentAt: Date.now()})}>Sent<//>` : html`<span class="tiny ink62">sent ${U.fmtDay(U.ymd(new Date(p.sentAt || 0)))}</span>`}
              <button type="button" class="linky tiny" onClick=${() => setEdit(true)}>Edit</button>
              ${busy === 'rewrite' ? html`<${M.fx.Orb} state="composing" size=${20} label="writing"/>` : null}<button type="button" class="linky tiny" disabled=${busy === 'rewrite'} onClick=${rewrite}>${busy === 'rewrite' ? 'Writing' : 'Rewrite'}</button>
              ${p.state !== 'skipped' && p.state !== 'sent' ? html`<button type="button" class="linky tiny" onClick=${() => patch({state: 'skipped', skip: 'skipped by hand'})}>Skip</button>` : null}`}
        </div>
      </div>` : null}
      ${p.flags && p.flags.length ? html`<div class="row" style=${{gap: '6px', flexWrap: 'wrap', marginTop: '6px'}}>${p.flags.map((f, i) => html`<${UI.Pill} key=${i} kind="flame">${f}<//>`)}</div>` : null}
    </div>`;
  }

  function Intake({ctx}) {
    const [text, setText] = useState('');
    const [note, setNote] = useState('');
    const [imgs, setImgs] = useState([]);
    const [canImg, setCanImg] = useState(false);
    const [busy, setBusy] = useState('');
    const [last, setLast] = useState(null);
    const fileRef = useRef(null);
    useEffect(() => { let on = true; if (ctx.sample && ctx.sample.limits) ctx.sample.limits().then(l => { if (on) setCanImg(!!(l && l.images)); }).catch(() => {}); return () => { on = false; }; }, [ctx.sample]);
    const attach = async files => {
      const out = [];
      for (const f of Array.from(files || []).slice(0, 4 - imgs.length)) {
        try { const blob = await M.ai.shrinkImage(f, 1800); out.push({blob, url: URL.createObjectURL(blob)}); } catch (e) { M.toast('That file is not an image', true); }
      }
      if (out.length) setImgs(xs => xs.concat(out));
    };
    const go = async () => {
      if (!imgs.length && !text.trim()) return;
      setBusy('Reading the names');
      try {
        const r = await intake(ctx, {images: imgs.map(i => i.blob), text, note});
        setLast(r); setImgs([]); setText('');
        if (r.added.length) await run(ctx, r.added.map(p => p.id), setBusy);
        M.toast(r.added.length ? r.added.length + ' written' : 'Nobody new in that batch');
      } catch (e) { M.toast((e && e.message) || 'The desk could not read that', true); }
      setBusy('');
    };
    return html`<${UI.Card} id="hs-intake" title="Intake" action=${html`<${M.fx.Bot} feature="handshake" state=${busy ? 'working' : 'default'} size=${36} label="m360, the handshake desk" className="ai-bot"/>`}>
      <div class="stack tight">
        <div class="small ink62">${canImg ? 'Drop the LinkedIn screenshots here, or paste lines: Name | headline | company | pending or 1st.' : 'Paste one person per line: Name | headline | company | pending or 1st. Screenshots need a build that takes images.'}</div>
        ${canImg ? html`<div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
          <input ref=${fileRef} type="file" accept="image/*" multiple=${true} style=${{display: 'none'}} id="hs-file" onChange=${e => { attach(e.target.files); e.target.value = ''; }}/>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => fileRef.current && fileRef.current.click()}><${icons.upload}/> Screenshots<//>
          ${imgs.map((im, i) => html`<span key=${i} class="ask-thumb"><img src=${im.url} alt="screenshot"/><button type="button" class="iconbtn" aria-label="Remove" onClick=${() => setImgs(xs => xs.filter((_, j) => j !== i))}><${icons.x}/></button></span>`)}
        </div>` : null}
        <${M.fx.Beam} radius=${12} size="sm"><textarea class="input" rows="4" id="hs-lines" placeholder="Priya Mehta | Brand Manager at DERMATOUCH | Dermatouch | 1st" value=${text} onInput=${e => setText(e.target.value)} onPaste=${e => { const fs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type)); if (fs.length && canImg) { e.preventDefault(); attach(fs); } }} aria-label="People, one per line"/><//>
        <input class="input" id="hs-note" placeholder="A note for the writer, optional: who to hold, what to lead with" value=${note} onInput=${e => setNote(e.target.value)} aria-label="A note for the writer"/>
        <div class="row between">
          <span class="tiny ink62 row nowrap" style=${{gap: '8px'}}>${busy ? html`<${M.fx.Orb} state=${/read/i.test(busy) ? 'searching' : 'composing'} size=${20} label="working"/>` : null}${busy || (last ? last.added.length + ' added' + (last.dupes.length ? ', skipped as already in: ' + last.dupes.join(', ') : '') : '')}</span>
          <${UI.Btn} id="hs-run" disabled=${!!busy || (!imgs.length && !text.trim()) || !M.ai.on(ctx)} onClick=${go}>${busy ? 'Working' : 'Read & write'}<//>
        </div>
      </div>
    <//>`;
  }

  function Setup({ctx}) {
    const s = settings(ctx);
    const [f, setF] = useState(() => ({proofs: s.proofs.map(x => ({...x})), always: s.always, about: s.about, hold: s.hold}));
    const save = () => ctx.W.merge(SETTINGS, {proofs: f.proofs.map(x => ({k: x.k, label: cut(x.label, 60), line: cut(x.line, 300)})), always: cut(f.always, 80), about: cut(f.about, 300), hold: Math.max(0, Math.min(240, Number(f.hold) || HOLD_H)), updated: Date.now()}).then(() => M.toast('Saved'));
    return html`<${UI.Fold} title="The proof bank & the rules" summary="what may be claimed, the hold" id="hs-setup">
      <div class="stack tight">
        ${f.proofs.map((x, i) => html`<${UI.Input} key=${x.k} label=${x.label} value=${x.line} onChange=${v => setF(o => ({...o, proofs: o.proofs.map((y, j) => j === i ? {...y, line: v} : y)}))}/>`)}
        <${UI.Input} label="Always" value=${f.always} onChange=${v => setF(o => ({...o, always: v}))}/>
        <${UI.Input} label="Mask360 in one sentence" value=${f.about} onChange=${v => setF(o => ({...o, about: v}))}/>
        <${UI.Input} label="Hold the team's DMs for (hours) after the senior's" type="number" value=${f.hold} onChange=${v => setF(o => ({...o, hold: v}))}/>
        <div><${UI.Btn} sm=${true} onClick=${save}>Save<//></div>
      </div>
    <//>`;
  }

  function Handshake() {
    const ctx = M.useCtx();
    const [tick, setTick] = useState(0);
    const [showSent, setShowSent] = useState(false);
    const all = people(ctx);
    useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(t); }, []);
    /* a hold that has run out is ready now */
    useEffect(() => { all.filter(p => p.state === 'hold' && p.holdUntil && p.holdUntil <= Date.now()).forEach(p => ctx.W.update('dm/' + p.id, {state: 'ready', updated: Date.now()}).catch(() => {})); }, [tick, all.length]);
    const by = st => all.filter(p => p.state === st).sort((a, b) => (RANK[a.bucket] == null ? 5 : RANK[a.bucket]) - (RANK[b.bucket] == null ? 5 : RANK[b.bucket]) || (b.updated || 0) - (a.updated || 0));
    const ready = by('ready'), hold = by('hold'), waiting = by('waiting'), fresh = by('new'), skipped = by('skipped'), sent = by('sent').sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
    const flagged = all.filter(p => p.flags && p.flags.length && p.state !== 'sent');
    const group = (title, list, id) => list.length ? html`<${UI.Card} title=${title + ' (' + list.length + ')'} id=${id}>
      <div class="stack">${list.map(p => html`<${Person} key=${p.id} p=${p} ctx=${ctx} all=${all}/>`)}</div>
    <//>` : null;
    return html`<div class="stack" style=${{gap: '16px'}} id="handshake">
      <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
        <span class="chipline"><b class="num"><${M.fx.MetalText} size=${15} weight=${600}>${String(ready.length)}<//></b> ready</span>
        <span class="chipline"><b class="num">${hold.length}</b> held</span>
        <span class="chipline"><b class="num">${waiting.length}</b> waiting on accepts</span>
        <span class="chipline"><b class="num"><${M.fx.MetalText} size=${15} weight=${700}>${String(sent.length)}<//></b> sent</span>
      </div>
      ${!M.ai.on(ctx) ? html`<div class="hint">The desk writes with m360 ai. Turn it on in Admin.</div>` : null}
      <${Intake} ctx=${ctx}/>
      ${group('Ready to send', ready, 'hs-ready')}
      ${group('Held for the senior\'s reply', hold, 'hs-hold')}
      ${group('Waiting on the accept', waiting, 'hs-waiting')}
      ${fresh.length ? html`<${UI.Card} title=${'Not written yet (' + fresh.length + ')'} id="hs-new">
        <div class="stack tight">
          ${fresh.map(p => html`<div key=${p.id} class="row between"><span><b>${p.name}</b> <span class="small ink62">${p.headline}</span></span></div>`)}
          <div><${UI.Btn} sm=${true} id="hs-write-new" onClick=${() => run(ctx, fresh.map(p => p.id)).catch(e => M.toast((e && e.message) || 'Could not write', true))}>Write these<//></div>
        </div>
      <//>` : null}
      ${skipped.length ? html`<${UI.Card} title=${'Skip list (' + skipped.length + ')'} id="hs-skipped">
        <div class="stack tight">${skipped.map(p => html`<div key=${p.id} class="row between hs-skip"><span><b>${p.name}</b> <span class="small ink62">${p.skip || p.why || 'no fit'}</span></span><button type="button" class="linky tiny" onClick=${() => ctx.W.update('dm/' + p.id, {state: 'new', bucket: '', skip: '', updated: Date.now()})}>Bring back</button></div>`)}</div>
      <//>` : null}
      ${flagged.length ? html`<${UI.Card} title=${'Flags (' + flagged.length + ')'} id="hs-flags" flame=${true}>
        <div class="stack tight">${flagged.map(p => html`<div key=${p.id} class="small"><b>${p.name}</b>: ${p.flags.join('; ')}</div>`)}</div>
      <//>` : null}
      ${sent.length ? html`<${UI.Card} title=${'Sent (' + sent.length + ')'} id="hs-sent" action=${html`<button type="button" class="linky tiny" onClick=${() => setShowSent(x => !x)}>${showSent ? 'Hide' : 'Show'}</button>`}>
        ${showSent ? html`<div class="stack">${sent.map(p => html`<${Person} key=${p.id} p=${p} ctx=${ctx} all=${all}/>`)}</div>` : html`<div class="small ink62">${sent.slice(0, 8).map(p => p.name).join(', ')}${sent.length > 8 ? ' & ' + (sent.length - 8) + ' more' : ''}</div>`}
      <//>` : null}
      ${!all.length ? html`<${UI.Empty} text="Nobody in the desk yet. Drop the screenshots above."/>` : null}
      ${ctx.isFounder ? html`<${Setup} ctx=${ctx}/>` : null}
      <div class="hint">The flow: intake, triage into a bucket, verify the company online, pick one hook, match the proof, write in five beats, sequence (the founder first, the team held ${settings(ctx).hold} hours, pending connections after the accept), QC, then Copy and paste into LinkedIn and tap Sent. Ask m360 takes "DM:" with screenshots too.</div>
    </div>`;
  }

  M.handshake = {BUCKETS, HOOKS, DEFAULTS, people, settings, check, polish, parseLines, intake, verify, write, run, fromAsk, messaged};
  M.pages.Handshake = Handshake;
})();
