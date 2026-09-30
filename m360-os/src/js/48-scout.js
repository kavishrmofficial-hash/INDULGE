/* module: scout. The founder's business development buddy, with a face. Once a working day, on the
   founder's page, Scout reads the trade press (Radar), picks one Indian brand with a fresh trigger (a
   new marketing head, a mandate that moved, a launch), finds the person on Apollo, reads the brand's
   site, writes the pitch through Hunt (the three line proposition, the LinkedIn note and message, the
   email, the follow ups) and leaves it in the inbox for one tap. It never sends anything by itself: a
   LinkedIn note is copied and pasted, an email goes through Gmail on the founder's say so. On the
   claude.ai page there is no press feed, so Scout writes copy for pursuits that have none and nudges
   the follow ups that are due. State lives in hunt/scout (a document without a brand, so Hunt never lists it): {day, state, log[], name, avatar, paused,
   skipped{}}; the log is what the card shows. Every pursuit it makes carries by: 'scout'. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => live() ? window.M360_API(a, body) : Promise.reject({code: 'unavailable', message: 'no server here'});
  const DEFAULT_NAME = 'Scout';
  const WAIT_MS = 20000;
  const LOG_MAX = 60;
  const GOOD = {newhead: 1, mandate: 1, launch: 1, hiring: 1};
  const LINES = {
    sleep: 'Resting until the next working day.',
    idle: 'Ready. Nothing to do right now.',
    read: 'Reading the trade press for a brand with a fresh trigger.',
    find: 'Finding the marketing person at the brand.',
    think: 'Reading their site and shaping the carve out.',
    write: 'Writing the proposition, the LinkedIn note, the email and the follow ups.',
    deliver: 'A pitch is ready in your inbox.',
    nudge: 'Checking which follow ups are due.',
    rest: 'Done for today.'
  };

  const stateOf = ctx => (ctx.coll.hunt && ctx.coll.hunt.map.scout) || {};
  const nameOf = ctx => String(stateOf(ctx).name || '').trim() || DEFAULT_NAME;
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const today = () => U.todayStr();
  const isWorking = ctx => (typeof ctx.isWorkingDay === 'function') ? ctx.isWorkingDay(today()) : U.parseYmd(today()).getDay() !== 0;
  const mine = ctx => (M.hunt ? M.hunt.pursuits(ctx) : []).filter(p => p.by === 'scout');
  const dueFollowups = ctx => (M.hunt ? M.hunt.pursuits(ctx) : []).filter(p => ['sent', 'replied', 'talking'].includes(p.stage) && p.next && p.next <= today());
  const missingOf = p => (p.copy && Array.isArray(p.copy.missing)) ? p.copy.missing : [];
  const linkedinOf = p => p.linkedin || ('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent([p.who, p.company || p.brand].filter(Boolean).join(' ')));

  /* ---------- the loop ---------- */
  /* acc carries the run's own copy of the log: the page's snapshot may lag a write by a render, so
     reading it back between steps would drop lines */
  async function patch(ctx, s, more, acc) {
    const cur = stateOf(ctx);
    const base = acc ? acc.log : (Array.isArray(cur.log) ? cur.log : []);
    const log = (more && more.line) ? [{at: Date.now(), state: s, line: more.line, ref: more.ref || '', brand: more.brand || ''}].concat(base).slice(0, LOG_MAX) : base;
    if (acc) acc.log = log;
    /* a merge, never a set: the page's copy of the document is a render behind between steps */
    const doc = {state: s, log, updated: Date.now()};
    if (more && more.day) doc.day = more.day;
    if (more && more.skipped) doc.skipped = more.skipped;
    if (more && more.made) doc.made = {...(cur.made || {}), ...more.made};
    if (!(more && more.keepForce)) doc.force = false;
    await ctx.W.merge('hunt/scout', doc);
  }
  /* one brand with a trigger worth a note, out of today's press, not already pursued */
  async function pickSeed(ctx) {
    const st = stateOf(ctx);
    const have = new Set((M.hunt ? M.hunt.pursuits(ctx) : []).map(p => norm(p.brand)));
    const skipped = st.skipped || {};
    const made = st.made || {};
    const cut = Date.now() - 30 * 86400000;
    const cut2 = Date.now() - 60 * 86400000;
    const r = await api('news', {});
    const items = (r && Array.isArray(r.items)) ? r.items : [];
    const enriched = M.radar ? M.radar.withHits(items, []).map(M.radar.enrich) : items;
    const seeds = enriched.filter(it => it && it.title && (it.india !== false)).map(it => ({it, seed: M.hunt.seedFromNews(it)}))
      .filter(x => x.seed.brand && GOOD[x.seed.trigger] && !have.has(norm(x.seed.brand)) && !(skipped[norm(x.seed.brand)] > cut) && !(made[norm(x.seed.brand)] > cut2))
      .sort((a, b) => ((b.it.hot ? 1 : 0) - (a.it.hot ? 1 : 0)) || ((b.it.at || 0) - (a.it.at || 0)));
    return seeds.length ? seeds[0] : null;
  }
  async function findPerson(ctx, seed) {
    const st = await api('apollostatus').catch(() => null);
    if (!st || !st.configured) return null;
    const comp = await api('huntcompanies', {q: seed.brand}).catch(() => null);
    const row = comp && Array.isArray(comp.rows) ? comp.rows[0] : null;
    const domain = (row && row.domain) || seed.domain || '';
    if (!domain) return null;
    const titles = (M.hunt.TITLE_SETS || []).filter(t => t.v === 'head' || t.v === 'social').map(t => t.titles).flat();
    const ppl = await api('huntpeople', {domain, titles, q: ''}).catch(() => null);
    const person = ppl && Array.isArray(ppl.rows) ? ppl.rows[0] : null;
    return {domain, company: (row && row.name) || seed.company || seed.brand, person};
  }
  async function shape(ctx, seed, domain) {
    let site = '';
    if (domain) { try { const r = await api('readpage', {url: 'https://' + domain}); site = String((r && r.text) || '').slice(0, 3000); } catch (e) { site = ''; } }
    const lanes = M.hunt.LANES.map(l => l.v + ': ' + l.label).join('; ');
    const prompt = 'Shape a carve out for an outbound note from Mask360, a Mumbai social first content studio, to ' + seed.brand + ' (trigger: ' + seed.trigger + (seed.triggerNote ? ', ' + seed.triggerNote : '') + ').' +
      (site ? '\n\nTHEIR SITE, first lines: ' + site : '') +
      '\n\nAnswer with JSON only: {"sub": "the sub brand or handle most active on social, or the brand", "platform": "Instagram or LinkedIn or YouTube", "lane": "one key from ' + lanes + '", "competitor": "one named Indian competitor in the same category, or empty", "languages": "languages their audience uses, or empty"}. Never invent numbers; names only.';
    try {
      const j = await M.ai.json(ctx, prompt, {cache: false, tier: 'quick'});
      const lane = M.hunt.LANES.some(l => l.v === j.lane) ? j.lane : (seed.trigger === 'launch' ? 'launch' : 'reels');
      return {sub: String(j.sub || '').slice(0, 60), platform: ['Instagram', 'LinkedIn', 'YouTube', 'X'].includes(j.platform) ? j.platform : 'Instagram', lane, competitor: String(j.competitor || '').slice(0, 60), languages: String(j.languages || '').slice(0, 60)};
    } catch (e) { return {sub: '', platform: 'Instagram', lane: seed.trigger === 'launch' ? 'launch' : 'reels', competitor: '', languages: ''}; }
  }
  async function writeFor(ctx, id) {
    const p = {id, ...ctx.coll.hunt.map[id]};
    const bank = M.hunt.bankOf(ctx);
    let out;
    try { out = await M.hunt.aiCopy(ctx, p, bank); }
    catch (e) { out = M.hunt.writeCopy(p, bank); }
    const copy = {...out.copy, missing: out.missing || []};
    await ctx.W.merge('hunt/' + id, {copy, stage: 'audited', updated: Date.now()});
    return copy;
  }
  /* the day's work, step by step, each step written so the card shows it */
  async function work(ctx) {
    const c = () => M.lastCtx || ctx;
    const day = today();
    const name = nameOf(ctx);
    const acc = {log: Array.isArray(stateOf(ctx).log) ? stateOf(ctx).log.slice() : []};
    try {
      if (live()) {
        await patch(c(), 'read', {line: LINES.read, keepForce: true}, acc);
        const pick = await pickSeed(c());
        if (pick) {
          const seed = {...pick.seed, by: 'scout'};
          await patch(c(), 'find', {line: 'Found a trigger: ' + String(pick.it.title || '').slice(0, 90), ref: pick.it.link || '', brand: seed.brand, keepForce: true}, acc);
          const found = await findPerson(c(), seed).catch(() => null);
          if (found) {
            seed.domain = found.domain; seed.company = found.company || seed.company;
            if (found.person) { const r = found.person; seed.who = r.name || r.first || seed.who; seed.title = r.title || seed.title; seed.linkedin = r.linkedin || ''; seed.apolloId = r.id || ''; seed.mail = r.mail || ''; }
          }
          await patch(c(), 'think', {line: (seed.who ? seed.who + ', ' + (seed.title || 'marketing') + ' at ' + seed.brand : 'Nobody named yet at ' + seed.brand + ', the pitch will carry a blank for the person'), keepForce: true}, acc);
          const s = await shape(c(), seed, seed.domain);
          Object.assign(seed, {sub: s.sub, platform: s.platform, lane: s.lane, audit: {...(seed.audit || {}), competitor: s.competitor, languages: s.languages}});
          await patch(c(), 'write', {line: LINES.write, brand: seed.brand, keepForce: true}, acc);
          const id = await M.hunt.create(c(), seed);
          /* Hunt's blank pursuit keeps its own fields; the maker's mark is added after */
          await c().W.merge('hunt/' + id, {by: 'scout', updated: Date.now()});
          const copy = await writeFor(c(), id);
          const miss = (copy.missing || []).length;
          await patch(c(), 'deliver', {line: 'Pitch for ' + seed.brand + ' is ready' + (miss ? ', ' + miss + (miss === 1 ? ' number' : ' numbers') + ' to count on their handle before it goes' : ''), ref: '#hunt/' + id, brand: seed.brand, keepForce: true, made: {[norm(seed.brand)]: Date.now()}}, acc);
        } else {
          await patch(c(), 'read', {line: 'Nothing new in the press today that is worth a note.', keepForce: true}, acc);
        }
      }
      /* pursuits without copy get theirs, wherever the page runs */
      const bare = M.hunt.pursuits(c()).filter(p => !p.copy && p.brand && ['found', 'audited'].includes(p.stage)).slice(0, 3);
      for (const p of bare) {
        await patch(c(), 'write', {line: 'Writing the pitch for ' + p.brand, brand: p.brand, keepForce: true}, acc);
        const copy = await writeFor(c(), p.id);
        const miss = (copy.missing || []).length;
        await patch(c(), 'deliver', {line: 'Pitch for ' + p.brand + ' is ready' + (miss ? ', ' + miss + (miss === 1 ? ' number' : ' numbers') + ' to count before it goes' : ''), ref: '#hunt/' + p.id, brand: p.brand, keepForce: true}, acc);
      }
      const due = dueFollowups(c());
      if (due.length) await patch(c(), 'nudge', {line: due.length + (due.length === 1 ? ' follow up is due: ' : ' follow ups are due: ') + due.map(p => p.brand).join(', '), ref: '#scout', keepForce: true}, acc);
      await patch(c(), 'rest', {line: name + ' is done for today.', day}, acc);
    } catch (e) {
      await patch(c(), 'rest', {line: 'Stopped: ' + ((e && e.message) || 'something did not answer') + '. Tomorrow again, or Run now.', day}, acc).catch(() => {});
    }
  }

  function ScoutWatch() {
    const ctx = M.useCtx();
    const busy = useRef(false);
    const st = stateOf(ctx);
    const on = !!(ctx && ctx.isFounder && !ctx.viewAs && ctx.ready && ctx.coll.hunt && ctx.coll.hunt.ready && M.hunt && M.ai.on(ctx));
    const dueToday = on && !st.paused && (st.force || (st.day !== today() && isWorking(ctx)));
    useEffect(() => {
      if (!dueToday || busy.current) return;
      const t = setTimeout(async () => {
        if (busy.current) return;
        const c = M.lastCtx || ctx;
        const now = stateOf(c);
        if (now.paused || (!now.force && now.day === today())) return;
        busy.current = true;
        try { await work(c); } finally { busy.current = false; }
      }, st.force ? 800 : WAIT_MS);
      return () => clearTimeout(t);
    }, [dueToday, st.force, st.day]);
    return null;
  }

  /* ---------- the inbox ---------- */
  function inboxItems(ctx, push) {
    if (!ctx.isFounder) return;
    const st = stateOf(ctx);
    const dayStart = U.parseYmd(today()).getTime();
    for (const l of (st.log || [])) {
      if (l.state === 'deliver' && l.at >= dayStart && l.ref) push('scout:' + l.ref, 'scout', l.at, nameOf(ctx) + ': ' + l.line, l.ref, true);
    }
    for (const p of dueFollowups(ctx)) push('scoutdue:' + p.id + ':' + p.next, 'scout', U.parseYmd(p.next).getTime(), 'Follow up due for ' + p.brand + (p.who ? ', ' + p.who : '') + ', day ' + ((M.hunt.LADDER || [3, 7, 14, 30])[Math.max(0, (Number(p.step) || 1) - 1)] || ''), '#hunt/' + p.id);
  }

  /* ---------- the face ---------- */
  function Character({state, avatar}) {
    const s = state || 'idle';
    if (avatar) return html`<div class=${'scout-figure av sc-' + s}><img src=${avatar} alt="" class="scout-avatar"/><span class="scout-badge"><${icons[s === 'write' ? 'edit' : s === 'read' ? 'log' : s === 'find' ? 'search' : s === 'deliver' ? 'send' : 'clock'] || icons.send}/></span></div>`;
    return html`<div class=${'scout-figure sc-' + s} aria-hidden="true">
      <svg viewBox="0 0 120 120" class="scout-svg">
        <ellipse class="sc-shadow" cx="60" cy="108" rx="26" ry="5"/>
        <g class="sc-body-g">
          <path class="sc-body" d="M60 14c-10 16-30 26-30 50a30 30 0 0 0 60 0c0-24-20-34-30-50Z"/>
          <path class="sc-belly" d="M60 46c-6 8-14 14-14 26a14 14 0 0 0 28 0c0-12-8-18-14-26Z"/>
          <g class="sc-eyes">
            <ellipse class="sc-eye" cx="49" cy="66" rx="6" ry="7"/><ellipse class="sc-eye" cx="71" cy="66" rx="6" ry="7"/>
            <circle class="sc-pupil" cx="50" cy="67" r="3"/><circle class="sc-pupil" cx="72" cy="67" r="3"/>
            <path class="sc-lid" d="M43 66h12M65 66h12"/>
          </g>
          <path class="sc-mouth" d="M53 79c4 4 10 4 14 0"/>
          <path class="sc-arm sc-arm-l" d="M32 78c-8 2-12 8-10 14"/>
          <path class="sc-arm sc-arm-r" d="M88 78c8 2 12 8 10 14"/>
        </g>
        <g class="sc-prop sc-paper"><rect x="84" y="70" width="22" height="28" rx="3"/><path d="M89 78h12M89 84h12M89 90h8"/></g>
        <g class="sc-prop sc-pen"><path d="M92 92l14-14"/><path d="M104 76l4 4"/></g>
        <g class="sc-prop sc-bubble"><rect x="78" y="22" width="34" height="20" rx="10"/><circle cx="88" cy="32" r="2"/><circle cx="95" cy="32" r="2"/><circle cx="102" cy="32" r="2"/></g>
        <g class="sc-prop sc-door"><rect x="92" y="52" width="20" height="46" rx="2"/><circle cx="108" cy="76" r="1.6"/></g>
        <g class="sc-prop sc-plane"><path d="M86 40l26-10-8 26-7-9-11-7Z"/></g>
        <g class="sc-prop sc-zzz"><text x="80" y="40" class="sc-z">z</text><text x="90" y="28" class="sc-z2">z</text></g>
        <g class="sc-prop sc-glass"><circle cx="96" cy="66" r="9"/><path d="M103 73l9 9"/></g>
      </svg>
    </div>`;
  }

  /* ---------- the card and the page ---------- */
  function Outputs({ctx, compact}) {
    const rows = mine(ctx).filter(p => p.copy && ['found', 'audited'].includes(p.stage)).sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, compact ? 3 : 20);
    const due = dueFollowups(ctx).slice(0, compact ? 3 : 20);
    const [gmail, setGmail] = useState(null);
    useEffect(() => { if (live() && rows.length) api('googlestatus').then(r => setGmail(!!(r && r.connected)), () => setGmail(false)); }, [rows.length]);
    const copy = async t => { try { await navigator.clipboard.writeText(t); M.toast('Copied'); } catch (e) { M.toast('Select the text and copy it by hand', true); } };
    const sendMail = async p => {
      if (!p.mail) { M.toast('No email for ' + (p.who || 'the person') + ' yet. Add it on the pursuit.', true); return; }
      try {
        await api('gmailsend', {to: p.mail, subject: p.copy.mailSubject, text: p.copy.mailBody});
        await M.hunt.markSent(ctx, p, 'email', 'sent by ' + nameOf(ctx) + ' through Gmail');
      } catch (e) { M.toast((e && e.message) || 'Gmail did not send it', true); }
    };
    if (!rows.length && !due.length) return html`<div class="small ink62" id="scout-empty">Nothing waiting on you. ${nameOf(ctx)} adds a pitch here the moment one is ready.</div>`;
    return html`<div class="stack tight" id="scout-outputs">
      ${rows.map(p => { const miss = missingOf(p); return html`<div class="scout-row" key=${p.id}>
        <div class="row between"><span><b>${p.brand}</b>${p.who ? html`<span class="small ink62"> · ${p.who}${p.title ? ', ' + p.title : ''}</span>` : null}</span>
          <${UI.Pill} kind=${miss.length ? 'flame-o' : 'ink'}>${miss.length ? miss.length + ' to count' : 'ready'}<//></div>
        <div class="tiny ink62 clamp2" style=${{marginTop: '4px'}}>${(p.copy.proposition || [])[0] || ''}</div>
        ${miss.length ? html`<div class="tiny ink62" style=${{marginTop: '4px'}}>Count on their handle first: ${miss.slice(0, 4).join(', ')}.</div>` : null}
        <div class="row" style=${{marginTop: '8px', gap: '6px', flexWrap: 'wrap'}}>
          <${UI.Btn} sm=${true} onClick=${() => M.nav('#hunt/' + p.id)}>Open<//>
          <${UI.Btn} sm=${true} kind="sec" onClick=${() => copy(p.copy.connect)}>Copy the LinkedIn note<//>
          <a class="btn sec sm" href=${linkedinOf(p)} target="_blank" rel="noopener">Open LinkedIn</a>
          ${live() && gmail ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${() => sendMail(p)} label="Tap again to send">Send the email<//>` : html`<${UI.Btn} sm=${true} kind="sec" onClick=${() => copy(p.copy.mailSubject + '\n\n' + p.copy.mailBody)}>Copy the email<//>`}
        </div>
      </div>`; })}
      ${due.map(p => html`<div class="scout-row" key=${'due' + p.id}>
        <div class="row between"><span><b>${p.brand}</b><span class="small ink62"> · follow up due ${U.fmtDay(p.next)}</span></span><${UI.Btn} sm=${true} kind="sec" onClick=${() => M.nav('#hunt/' + p.id)}>Open<//></div>
      </div>`)}
    </div>`;
  }
  function ScoutCard({compact}) {
    const ctx = M.useCtx();
    const st = stateOf(ctx);
    const name = nameOf(ctx);
    const doneToday = st.day === today();
    const running = !!(st.state && !['rest', 'sleep', 'idle'].includes(st.state) && !doneToday);
    const state = st.paused ? 'sleep' : running ? st.state : (doneToday ? 'idle' : (isWorking(ctx) ? 'idle' : 'sleep'));
    const line = st.paused ? 'Paused. ' + name + ' does nothing until you resume.' : running ? (LINES[st.state] || '') : (st.log && st.log[0] && doneToday ? st.log[0].line : LINES[state]);
    const canRun = ctx.isFounder && M.ai.on(ctx) && !running && !st.paused;
    const run = () => ctx.W.merge('hunt/scout', {force: true, updated: Date.now()});
    const pause = v => ctx.W.merge('hunt/scout', {paused: v, updated: Date.now()});
    const dayLog = (st.log || []).filter(l => l.at >= U.parseYmd(today()).getTime()).slice(0, compact ? 4 : 30);
    return html`<${UI.Card} id="scout-card" title=${name} action=${html`<span class="row nowrap" style=${{gap: '6px'}}>
        ${ctx.isFounder ? html`<${UI.Btn} sm=${true} kind="sec" id="scout-run" disabled=${!canRun} onClick=${run}>Run now<//>` : null}
        ${ctx.isFounder ? html`<${UI.Btn} sm=${true} kind="ghost" id="scout-pause" onClick=${() => pause(!st.paused)}>${st.paused ? 'Resume' : 'Pause'}<//>` : null}
        ${!compact ? null : html`<${UI.Btn} sm=${true} kind="ghost" onClick=${() => M.nav('#scout')}>Open<//>`}</span>`}>
      <div class="scout-stage">
        <${Character} state=${state} avatar=${st.avatar || ''}/>
        <div class="scout-side">
          <div class="scout-line" id="scout-line">${line}</div>
          ${!M.ai.on(ctx) ? html`<div class="tiny ink62">${name} needs the AI on to write. Add the key under Admin.</div>` : null}
          ${dayLog.length ? html`<div class="scout-log" id="scout-log">${dayLog.map((l, i) => html`<div class="scout-log-row" key=${i}><span class="tiny ink62 num">${U.hhmm ? U.hhmm(l.at) : ''}</span><span class="small">${l.ref ? html`<button type="button" class="linky" onClick=${() => /^https?:/.test(l.ref) ? window.open(l.ref, '_blank', 'noopener') : M.nav(l.ref)}>${l.line}</button>` : l.line}</span></div>`)}</div>` : null}
        </div>
      </div>
      <div style=${{marginTop: '14px'}}><${UI.Micro}>waiting on you<//><${Outputs} ctx=${ctx} compact=${compact}/></div>
    <//>`;
  }
  function ScoutSettings() {
    const ctx = M.useCtx();
    const st = stateOf(ctx);
    const [name, setName] = useState(st.name || '');
    const pick = e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file || !M.books || !M.books.shrinkImage) return;
      M.books.shrinkImage(file, 360).then(d => ctx.W.merge('hunt/scout', {avatar: d, updated: Date.now()})).then(() => M.toast('That is the face now')).catch(() => M.toast('Use a PNG or JPEG under about 1 MB', true));
    };
    return html`<${UI.Card} title="The buddy" id="scout-settings">
      <p class="small ink62" style=${{marginTop: 0}}>A name and a face. Drop in any character image; without one, the drawn flame stands in.</p>
      <div class="row" style=${{alignItems: 'flex-end', flexWrap: 'wrap'}}>
        <div style=${{maxWidth: '220px'}}><${UI.Input} id="scout-name" label="name" value=${name} placeholder=${DEFAULT_NAME} onChange=${setName}/></div>
        <${UI.Btn} sm=${true} id="scout-name-save" disabled=${(name.trim() || DEFAULT_NAME) === nameOf(ctx)} onClick=${() => ctx.W.merge('hunt/scout', {name: name.trim().slice(0, 24), updated: Date.now()}).then(() => M.toast('Named'))}>Save the name<//>
        <label class="btn sec sm">${st.avatar ? 'Change the face' : 'Add a face image'}<input type="file" accept="image/*" style=${{display: 'none'}} onChange=${pick}/></label>
        ${st.avatar ? html`<button type="button" class="linky small" onClick=${() => ctx.W.merge('hunt/scout', {avatar: '', updated: Date.now()})}>Back to the drawn one</button>` : null}
      </div>
    <//>`;
  }
  function ScoutPage() {
    const ctx = M.useCtx();
    const all = mine(ctx).sort((a, b) => (b.created || 0) - (a.created || 0));
    const st = stateOf(ctx);
    return html`<div class="stack" style=${{gap: '20px'}} id="scout-page">
      <${ScoutCard}/>
      <div class="split">
        <${UI.Card} title="How it works">
          <div class="stack tight small">
            <div><b>Every working day</b>, on your page, ${nameOf(ctx)} reads the trade press on Radar, picks one Indian brand with a fresh trigger (a new marketing head, a mandate that moved, a launch, a hiring post), finds the marketing person on Apollo, reads the brand's site, and writes the pitch through Hunt: the three line proposition, the LinkedIn connect note and message, the email, the WhatsApp line, the call opener and four follow ups.</div>
            <div><b>Nothing goes out by itself.</b> The LinkedIn note is copied and pasted by you (LinkedIn allows no other way without risking the account). The email goes through your Gmail on one tap. The numbers counted on their handle are yours to fill; ${nameOf(ctx)} never invents one.</div>
            <div><b>Follow ups</b> ride Hunt's ladder (day 3, 7, 14, 30) and land here and in the inbox when due.</div>
            <div class="tiny ink62">On the claude.ai page there is no press feed; there ${nameOf(ctx)} writes copy for pursuits that have none and nudges the follow ups.</div>
          </div>
        <//>
        <div class="stack" style=${{gap: '20px'}}>
          <${ScoutSettings}/>
          <${UI.Card} title="Every pitch so far" id="scout-history">
            ${all.length ? html`<div class="stack tight">${all.map(p => html`<div class="listrow" key=${p.id}><span class="grow"><b>${p.brand}</b><span class="tiny ink62"> · ${U.fmtDate(U.ymd(new Date(p.created || Date.now())))}${p.who ? ' · ' + p.who : ''}</span></span><${UI.Pill}>${(M.hunt.STAGES.find(s => s.v === p.stage) || {}).label || p.stage}<//><${UI.Btn} sm=${true} kind="ghost" onClick=${() => M.nav('#hunt/' + p.id)}>Open<//></div>`)}</div>` : html`<${UI.Empty} text="No pitch yet."/>`}
          <//>
          ${(st.log || []).length > 4 ? html`<${UI.Card} title="The log">
            <div class="stack tight">${(st.log || []).slice(0, 30).map((l, i) => html`<div class="scout-log-row" key=${i}><span class="tiny ink62 num">${U.fmtDate(U.ymd(new Date(l.at)))}</span><span class="small">${l.line}</span></div>`)}</div>
          <//>` : null}
        </div>
      </div>
    </div>`;
  }

  M.scout = {stateOf, nameOf, inboxItems, mine, dueFollowups, LINES, DEFAULT_NAME};
  M.parts.ScoutWatch = ScoutWatch;
  M.parts.ScoutCard = ScoutCard;
  M.pages.Scout = ScoutPage;
})();
