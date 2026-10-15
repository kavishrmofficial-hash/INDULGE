/* module: organic. The launch playbook for organic growth, run per campaign: a fleet of accounts posting
   slideshows at volume, a studio that drafts and exports the slideshows, a posting schedule with what
   each post earned, and the six steps of the playbook as live checks read from that same data.

   Storage, one shared collection `organic` (anyone on the roster reads and writes, every write is logged):
     organic/<cid>                 the campaign: {kind: 'campaign', title, client, launch, target, perDay, waitGoal, waitlist,
                                   accounts {[aid]: {handle, platform, faceless, owner, perDay, removed, at}},
                                   decks {[did]: {title, slides: [text], removed, by, at}},
                                   feature {line, tested}, onboarding {[qid]: {q, at}}, paywallLast, hardPaywall, trialDays,
                                   prices {[pid]: {price, trials, paid}}, ads {cpa, budget}, steps {[k]: {done, by, at}}, by, at, updated}
     organic/<cid>.w.<YYYY-Www>    one week of posts: {kind: 'posts', c, week, posts {[pid]: {a, d, t, k, s, v, l, c, sh, by, at}}}
   A week of posts stays well under the 256 KiB a document may hold (8 accounts at 10 a day is 560 rows).
   Week documents older than KEEP_WEEKS are removed by the next schedule write. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  const KEEP_WEEKS = 13;
  const PLATFORMS = [{v: 'tiktok', label: 'TikTok'}, {v: 'instagram', label: 'Instagram'}, {v: 'youtube', label: 'YouTube Shorts'}];
  const PLAT = {tiktok: 'TikTok', instagram: 'Instagram', youtube: 'Shorts'};
  /* Meta's learning phase: about 50 conversions inside 7 days */
  const LEARN_CONV = 50, LEARN_DAYS = 7;
  const PICK_KEY = 'm360.organic.c';
  const MAX_SLIDES = 10;

  const td = () => U.todayStr();
  const weekId = ymd => U.isoWeek(U.parseYmd(ymd));
  const weekDays7 = monday => [0, 1, 2, 3, 4, 5, 6].map(i => U.ymd(U.addDays(monday, i)));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const short = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'm' : n >= 1e3 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n));
  const live = m => Object.keys(m || {}).filter(k => m[k] && !m[k].removed).map(k => ({id: k, ...m[k]}));

  /* ---------- reads ---------- */
  function campaigns(ctx) {
    const map = (ctx.coll.organic || {}).map || {};
    return Object.keys(map).filter(k => map[k] && map[k].kind === 'campaign' && !map[k].removed)
      .map(k => ({id: k, ...map[k]})).sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function campaign(ctx, cid) { const c = ((ctx.coll.organic || {}).map || {})[cid]; return c && c.kind === 'campaign' ? {id: cid, ...c} : null; }
  /* every post of a campaign, flattened, with the week document it lives in */
  function posts(ctx, cid) {
    const map = (ctx.coll.organic || {}).map || {};
    const out = [];
    const pre = cid + '.w.';
    for (const k of Object.keys(map)) {
      if (k.indexOf(pre) !== 0) continue;
      const ps = (map[k] && map[k].posts) || {};
      for (const pid of Object.keys(ps)) if (ps[pid] && ps[pid].s !== 'skip') out.push({id: pid, doc: k, ...ps[pid]});
    }
    return out.sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : a.d + a.t > b.d + b.t ? 1 : 0));
  }
  function accountsOf(c) { return live(c && c.accounts).sort((a, b) => (a.at || 0) - (b.at || 0)); }
  function decksOf(c) { return live(c && c.decks).sort((a, b) => (b.at || 0) - (a.at || 0)); }

  /* the numbers the playbook and the dashboard read */
  function stats(ctx, c, today) {
    const t = today || td();
    const all = posts(ctx, c.id);
    const accs = accountsOf(c);
    const from7 = U.ymd(U.addDays(U.parseYmd(t), -6));
    const from30 = U.ymd(U.addDays(U.parseYmd(t), -29));
    const posted = all.filter(p => p.s === 'posted');
    const last7 = posted.filter(p => p.d >= from7 && p.d <= t);
    const last30 = posted.filter(p => p.d >= from30 && p.d <= t);
    const sum = (xs, k) => xs.reduce((n, p) => n + num(p[k]), 0);
    const perAcc = accs.length ? last7.length / accs.length / 7 : 0;
    const firstPost = posted.length ? posted[0].d : '';
    const byAcc = {};
    for (const a of accs) byAcc[a.id] = {p7: 0, v30: 0, best: 0};
    for (const p of last7) if (byAcc[p.a]) byAcc[p.a].p7++;
    for (const p of last30) if (byAcc[p.a]) { byAcc[p.a].v30 += num(p.v); byAcc[p.a].best = Math.max(byAcc[p.a].best, num(p.v)); }
    return {
      accounts: accs.length, posts7: last7.length, perAcc: Math.round(perAcc * 10) / 10,
      views: sum(last30, 'v'), likes: sum(last30, 'l'), comments: sum(last30, 'c'), shares: sum(last30, 'sh'),
      posts30: last30.length, firstPost, byAcc, planned: all.filter(p => p.s !== 'posted' && p.d >= t).length,
      dueToday: all.filter(p => p.d === t && p.s !== 'posted')
    };
  }

  /* revenue per trial for each price tested: price times paid over trials */
  function arpu(row) { const tr = num(row.trials); return tr > 0 ? num(row.price) * num(row.paid) / tr : 0; }
  function bestPrice(c) {
    const rows = live(c.prices).filter(r => num(r.trials) > 0);
    let best = null;
    for (const r of rows) if (!best || arpu(r) > arpu(best)) best = r;
    return best;
  }
  /* what Meta's learning phase costs a day at this cost per conversion */
  function adNeed(cpa) { return Math.ceil(LEARN_CONV * num(cpa) / LEARN_DAYS); }

  /* ---------- the six steps ---------- */
  const STEPS = [
    {k: 'volume', n: 1, title: 'Post at volume from day one',
      line: 'Run a fleet of faceless accounts and post 5 to 10 times a day on each. Slideshows carry the volume.'},
    {k: 'feature', n: 2, title: 'Build one great feature',
      line: 'One screen that makes people get it in one look. If your mom would not get it right away, strangers on social will not either.'},
    {k: 'onboarding', n: 3, title: 'Make onboarding the sales pitch',
      line: 'A longer onboarding wins more trials when every question makes the plan feel more personal. The paywall comes last and reads as the next step.'},
    {k: 'price', n: 4, title: 'Price higher than you think',
      line: 'Hard paywall, a 14 day trial, no free tier. Test prices across a wide band and keep the one with the highest revenue per user.'},
    {k: 'prelaunch', n: 5, title: 'Start posting before the product exists',
      line: 'Daily slideshows build the waitlist. The bar is 5,000 people waiting on launch day.'},
    {k: 'ads', n: 6, title: 'Hold paid ads until you can afford to learn',
      line: 'Meta needs about 50 conversions in 7 days to leave learning. Master organic first.'}
  ];

  /* each step's live check: {ok, text} read from the campaign and its posts */
  function check(ctx, c, k, st) {
    const s = st || stats(ctx, c);
    if (k === 'volume') {
      const target = num(c.target) || 8, per = num(c.perDay) || 5;
      const ok = s.accounts >= target && s.perAcc >= per;
      return {ok, text: s.accounts + ' of ' + target + ' accounts, ' + s.perAcc + ' posts a day each over 7 days (target ' + per + ')'};
    }
    if (k === 'feature') {
      const f = c.feature || {};
      if (!f.line) return {ok: false, text: 'Write the one screen in a sentence.'};
      return {ok: !!f.tested, text: f.tested ? 'Tested on someone outside the team.' : 'Show it to someone outside the team.'};
    }
    if (k === 'onboarding') {
      const n = live(c.onboarding).length;
      return {ok: n >= 5 && !!c.paywallLast, text: n + (n === 1 ? ' question' : ' questions') + (c.paywallLast ? ', paywall last' : ', paywall placement open')};
    }
    if (k === 'price') {
      const rows = live(c.prices).filter(r => num(r.trials) > 0);
      const b = bestPrice(c);
      const ok = rows.length >= 2 && !!c.hardPaywall;
      return {ok, text: rows.length < 2 ? rows.length + ' of 2 prices tested' : 'Best: ' + U.inr(num(b.price)) + ' a year, ' + U.inr(Math.round(arpu(b))) + ' per trial'};
    }
    if (k === 'prelaunch') {
      const goal = num(c.waitGoal) || 5000, have = num(c.waitlist);
      const lead = c.launch && s.firstPost ? U.daysBetween(s.firstPost, c.launch) : null;
      return {ok: have >= goal, text: have.toLocaleString('en-IN') + ' of ' + goal.toLocaleString('en-IN') + ' on the waitlist' +
        (lead != null && lead > 0 ? ', posting ' + lead + ' days before launch' : '')};
    }
    if (k === 'ads') {
      const a = c.ads || {};
      if (!num(a.cpa)) return {ok: false, text: 'Add a cost per conversion to see the daily floor.'};
      const need = adNeed(a.cpa), have = num(a.budget);
      return {ok: have >= need, text: 'Learning needs ' + U.inr(need) + ' a day. Budget ' + U.inr(have) + ' a day.'};
    }
    return {ok: false, text: ''};
  }
  function progress(ctx, c) {
    const st = stats(ctx, c);
    const rows = STEPS.map(s => ({...s, ...check(ctx, c, s.k, st), marked: !!((c.steps || {})[s.k] || {}).done}));
    return {rows, done: rows.filter(r => r.ok || r.marked).length, st};
  }

  /* ---------- writes ---------- */
  const path = cid => 'organic/' + cid;
  function upd(ctx, cid, partial) { return ctx.W.update(path(cid), {...partial, updated: Date.now()}); }
  function createCampaign(ctx, {title, client, launch}) {
    const cid = 'oc' + U.uid();
    return ctx.W.set(path(cid), {kind: 'campaign', title: String(title || '').slice(0, 80), client: client || '', launch: launch || '',
      target: 8, perDay: 5, waitGoal: 5000, waitlist: 0, trialDays: 14, hardPaywall: true, paywallLast: false,
      accounts: {}, decks: {}, feature: {line: '', tested: false}, onboarding: {}, prices: {}, ads: {cpa: 0, budget: 0}, steps: {},
      by: ctx.uid, at: Date.now(), updated: Date.now()}).then(() => cid);
  }
  /* slots spread evenly between 09:00 and 21:00 */
  function slotTimes(n) {
    const out = [];
    const span = 12 * 60, start = 9 * 60;
    for (let i = 0; i < n; i++) { const m = start + Math.round(span * (n === 1 ? 0 : i / (n - 1))); out.push(U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60)); }
    return out;
  }
  /* plan the rest of a week: each live account gets its daily target, decks go round robin */
  function planWeek(ctx, c, monday, from) {
    const accs = accountsOf(c), decks = decksOf(c);
    const have = posts(ctx, c.id);
    const days = weekDays7(monday).filter(d => d >= from);
    const wk = U.isoWeek(monday);
    const add = {};
    let k = 0;
    for (const d of days) for (const a of accs) {
      const want = Math.max(1, Math.min(10, num(a.perDay) || num(c.perDay) || 5));
      const taken = new Set(have.filter(p => p.a === a.id && p.d === d).map(p => p.t));
      if (taken.size >= want) continue;
      for (const t of slotTimes(want)) {
        if (taken.has(t)) continue;
        if (taken.size + Object.keys(add).filter(id => add[id].a === a.id && add[id].d === d).length >= want) break;
        add['p' + U.uid()] = {a: a.id, d, t, k: decks.length ? decks[k++ % decks.length].id : '', s: 'planned', by: ctx.uid, at: Date.now()};
      }
    }
    return {wk, add};
  }
  function writePosts(ctx, cid, wk, postsMap) {
    const p = path(cid + '.w.' + wk);
    /* prune week documents past KEEP_WEEKS on the way */
    const cut = U.isoWeek(U.addDays(new Date(), -7 * KEEP_WEEKS));
    const map = (ctx.coll.organic || {}).map || {};
    for (const k of Object.keys(map)) {
      if (k.indexOf(cid + '.w.') !== 0) continue;
      const w = k.slice((cid + '.w.').length);
      if (w < cut) ctx.W.del(path(k));
    }
    return ctx.W.merge(p, {kind: 'posts', c: cid, week: wk, posts: postsMap});
  }

  /* ---------- the slideshow drafts ---------- */
  const FORMATS = [
    {v: 'habits', label: 'Weird habits', hook: (n, t) => n + ' weird ' + t + ' habits that actually work'},
    {v: 'ways', label: 'Ways to', hook: (n, t) => n + ' ways to get better at ' + t},
    {v: 'real', label: 'Realisations', hook: (n, t) => n + ' realisations that changed how I see ' + t},
    {v: 'mistakes', label: 'Mistakes', hook: (n, t) => n + ' ' + t + ' mistakes everyone makes'}
  ];
  /* with the AI off: a hook in the chosen format and numbered slides to fill in */
  function offlineDraft(topic, fmt, n) {
    const f = FORMATS.find(x => x.v === fmt) || FORMATS[0];
    const t = String(topic || 'your topic').trim().toLowerCase();
    const slides = [U.cap(f.hook(n, t))];
    for (let i = 1; i <= n; i++) slides.push(i + '. Write point ' + i + ' here. One idea, under 20 words.');
    slides.push('Follow for part 2.');
    return {title: U.cap(t) + ', ' + f.label.toLowerCase(), slides};
  }
  function cleanDeck(out, fallback) {
    const slides = Array.isArray(out && out.slides) ? out.slides.map(s => String(s || '').replace(/[\u2013\u2014]/g, ',').trim().slice(0, 180)).filter(Boolean).slice(0, MAX_SLIDES) : [];
    if (slides.length < 3) return fallback;
    return {title: String((out && out.title) || fallback.title).replace(/[\u2013\u2014]/g, ',').slice(0, 80), slides};
  }

  /* draw one slide on a 1080 by 1920 canvas in the house look and hand back a PNG blob */
  function tokenColour(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function drawSlide(text, idx, total, dark) {
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1920;
    const g = cv.getContext('2d');
    const ink = tokenColour('--ink') || 'black', paper = tokenColour('--paper') || 'white', flame = tokenColour('--flame') || 'red';
    g.fillStyle = dark ? ink : paper; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = dark ? paper : ink;
    const size = idx === 0 ? 96 : 72;
    g.font = (idx === 0 ? '600 ' : '500 ') + size + 'px "Space Grotesk", system-ui, sans-serif';
    g.textBaseline = 'top';
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 900 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    const lh = size * 1.18;
    let y = (1920 - lines.length * lh) / 2;
    for (const l of lines) { g.fillText(l, 90, y); y += lh; }
    g.fillStyle = flame; g.beginPath(); g.arc(108, 1760, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark ? paper : ink;
    g.font = '400 40px "Space Grotesk", system-ui, sans-serif';
    g.fillText((idx + 1) + ' / ' + total, 140, 1738);
    return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
  }

  /* ---------- small parts ---------- */
  const Stat = ({v, l, hot}) => html`<div class="kpi"><div class=${'v num' + (hot ? ' flame-t' : '')}>${v}</div><div class="l">${l}</div></div>`;
  const ME_NAME = uid => html`<${UI.Name} id=${uid} fallback="Someone"/>`;
  /* a field that keeps its own text and saves once, on blur or Enter, so typing writes nothing */
  function Num({id, label, value, onSave, min, max, placeholder, type}) {
    const shown = value == null ? '' : String(value);
    const [v, setV] = useState(shown);
    useEffect(() => { setV(shown); }, [shown]);
    const commit = () => { if (v !== shown) onSave(v); };
    return html`<${UI.Field} label=${label}><input id=${id} class="input" type=${type || 'number'} min=${min} max=${max} value=${v} placeholder=${placeholder || ''}
      onInput=${e => setV(e.target.value)} onBlur=${commit} onKeyDown=${e => { if (e.key === 'Enter') e.target.blur(); }}/><//>`;
  }
  function Text({id, label, value, onSave, placeholder, rows}) {
    const shown = value || '';
    const [v, setV] = useState(shown);
    useEffect(() => { setV(shown); }, [shown]);
    return html`<${UI.Field} label=${label}><textarea id=${id} class="input" rows=${rows || 2} value=${v} placeholder=${placeholder || ''}
      onInput=${e => setV(e.target.value)} onBlur=${() => { if (v !== shown) onSave(v); }}></textarea><//>`;
  }

  function usePick(ctx) {
    const list = campaigns(ctx);
    const [cid, setCid] = useState(() => { try { return localStorage.getItem(PICK_KEY) || ''; } catch (e) { return ''; } });
    const pick = id => { setCid(id); try { localStorage.setItem(PICK_KEY, id); } catch (e) { /* storage off */ } };
    const c = list.find(x => x.id === cid) || list[0] || null;
    return {list, c, pick};
  }

  function NewCampaign({onClose, onMade}) {
    const ctx = M.useCtx();
    const [title, setTitle] = useState('');
    const [client, setClient] = useState('');
    const [launch, setLaunch] = useState('');
    const [busy, setBusy] = useState(false);
    const clients = Object.keys(ctx.coll.clients.map).map(id => ({v: id, label: ctx.coll.clients.map[id].name || 'Client'}));
    async function save() {
      if (!title.trim()) return;
      setBusy(true);
      try { const cid = await createCampaign(ctx, {title: title.trim(), client, launch}); M.toast('Campaign made'); onMade(cid); onClose(); }
      finally { setBusy(false); }
    }
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="New organic campaign"
      footer=${html`<${UI.Btn} disabled=${busy || !title.trim()} onClick=${save}>Make the campaign<//>`}>
      <div class="stack">
        <${UI.Input} id="org-title" label="Campaign" value=${title} onChange=${setTitle} placeholder="Swisse UAE launch" onEnter=${save}/>
        <${UI.Select} id="org-client" label="Client" value=${client} onChange=${setClient} options=${[{v: '', label: 'Internal or no client yet'}].concat(clients)}/>
        <${UI.Input} id="org-launch" label="Launch date" type="date" value=${launch} onChange=${setLaunch} hint="Posting starts before this day."/>
        <div class="small ink62">The campaign starts with the playbook's numbers: 8 accounts, 5 posts a day each, a 5,000 person waitlist and a 14 day trial. Change any of them on the playbook.</div>
      </div>
    <//>`;
  }

  function Picker({p, onNew}) {
    if (!p.list.length) return null;
    return html`<div class="row" style=${{gap: '8px'}}>
      <select class="input" id="org-pick" aria-label="Campaign" value=${p.c ? p.c.id : ''} onChange=${e => p.pick(e.target.value)} style=${{width: 'auto', minWidth: '200px'}}>
        ${p.list.map(c => html`<option key=${c.id} value=${c.id}>${c.title || 'Campaign'}</option>`)}
      </select>
      <${UI.Btn} kind="sec" sm=${true} onClick=${onNew}><${icons.plus}/>New campaign<//>
    </div>`;
  }

  /* ---------- Playbook ---------- */
  function StepBody({c, k}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [row, setRow] = useState({price: '', trials: '', paid: ''});
    const save = partial => upd(ctx, c.id, partial);
    if (k === 'volume') return html`<div class="row" style=${{gap: '10px'}}>
      <${Num} id="org-target" label="Accounts" min="1" max="30" value=${c.target || 8} onSave=${v => save({target: Math.max(1, Math.min(30, num(v) || 1))})}/>
      <${Num} id="org-perday" label="Posts a day each" min="1" max="10" value=${c.perDay || 5} onSave=${v => save({perDay: Math.max(1, Math.min(10, num(v) || 1))})}/>
      <${UI.Btn} kind="sec" sm=${true} onClick=${() => M.nav('#handles')}>Open accounts<//>
    </div>`;
    if (k === 'feature') return html`<div class="stack tight">
      <${Text} id="org-feature" label="The one screen" value=${(c.feature || {}).line || ''}
        onSave=${v => save({feature: {line: v.slice(0, 280)}})} placeholder="Point the camera at the ball and get the club and the aim for this shot."/>
      <${UI.Check} label="Someone outside the team got it in one look" checked=${!!(c.feature || {}).tested} onChange=${v => save({feature: {tested: v}})}/>
    </div>`;
    if (k === 'onboarding') {
      const qs = live(c.onboarding).sort((a, b) => (a.at || 0) - (b.at || 0));
      const add = () => { const t = q.trim(); if (!t) return; save({onboarding: {['q' + U.uid()]: {q: t.slice(0, 160), at: Date.now()}}}); setQ(''); };
      return html`<div class="stack tight">
        ${qs.length ? html`<ol class="org-qs">${qs.map(x => html`<li key=${x.id} class="row between nowrap">
          <span class="grow">${x.q}</span>
          <button type="button" class="iconbtn" aria-label="Remove question" onClick=${() => save({onboarding: {[x.id]: {removed: true}}})}><${icons.x}/></button></li>`)}</ol>` : html`<${UI.Empty} text="No questions yet. Start with the goal."/>`}
        <div class="row nowrap" style=${{gap: '8px'}}>
          <div class="grow"><${UI.Input} id="org-q" value=${q} onChange=${setQ} placeholder="What is your goal?" onEnter=${add}/></div>
          <${UI.Btn} kind="sec" sm=${true} onClick=${add}>Add question<//>
        </div>
        <${UI.Check} label="The paywall comes after the last question" checked=${!!c.paywallLast} onChange=${v => save({paywallLast: v})}/>
      </div>`;
    }
    if (k === 'price') {
      const rows = live(c.prices);
      const best = bestPrice(c);
      const add = () => { if (!num(row.price)) return; save({prices: {['r' + U.uid()]: {price: num(row.price), trials: num(row.trials), paid: num(row.paid)}}}); setRow({price: '', trials: '', paid: ''}); };
      return html`<div class="stack tight">
        <div class="row" style=${{gap: '14px'}}>
          <${UI.Check} label="Hard paywall, no free tier" checked=${!!c.hardPaywall} onChange=${v => save({hardPaywall: v})}/>
          <${Num} id="org-trial" label="Trial days" min="0" max="30" value=${c.trialDays == null ? 14 : c.trialDays} onSave=${v => save({trialDays: Math.max(0, Math.min(30, num(v)))})}/>
        </div>
        ${rows.length ? html`<div class="tbl-wrap"><table class="tbl org-prices">
          <thead><tr><th>Price a year</th><th>Trials</th><th>Paid</th><th>Per trial</th><th></th></tr></thead>
          <tbody>${rows.map(r => html`<tr key=${r.id} class=${best && best.id === r.id ? 'org-best' : ''}>
            <td class="num">${U.inr(num(r.price))}</td><td class="num">${num(r.trials)}</td><td class="num">${num(r.paid)}</td>
            <td class="num">${num(r.trials) ? U.inr(Math.round(arpu(r))) : 'no trials yet'}${best && best.id === r.id ? html` <${UI.Pill} kind="ink">keep<//>` : null}</td>
            <td><button type="button" class="iconbtn" aria-label="Remove price" onClick=${() => save({prices: {[r.id]: {removed: true}}})}><${icons.x}/></button></td>
          </tr>`)}</tbody></table></div>` : null}
        <div class="row" style=${{gap: '8px', alignItems: 'flex-end'}}>
          <${UI.Input} id="org-price" label="Price a year (₹)" type="number" value=${row.price} onChange=${v => setRow(x => ({...x, price: v}))}/>
          <${UI.Input} id="org-trials" label="Trials started" type="number" value=${row.trials} onChange=${v => setRow(x => ({...x, trials: v}))}/>
          <${UI.Input} id="org-paid" label="Converted to paid" type="number" value=${row.paid} onChange=${v => setRow(x => ({...x, paid: v}))}/>
          <${UI.Btn} kind="sec" sm=${true} onClick=${add}>Add price test<//>
        </div>
      </div>`;
    }
    if (k === 'prelaunch') return html`<div class="row" style=${{gap: '10px'}}>
      <${Num} id="org-wait" label="On the waitlist" min="0" value=${c.waitlist || 0} onSave=${v => save({waitlist: num(v)})}/>
      <${Num} id="org-waitgoal" label="Waitlist goal" min="1" value=${c.waitGoal || 5000} onSave=${v => save({waitGoal: Math.max(1, num(v))})}/>
      <${UI.Input} id="org-launchday" label="Launch date" type="date" value=${c.launch || ''} onChange=${v => save({launch: v})}/>
    </div>`;
    if (k === 'ads') {
      const a = c.ads || {};
      return html`<div class="stack tight">
        <div class="row" style=${{gap: '10px'}}>
          <${Num} id="org-cpa" label="Cost per conversion (₹)" min="0" value=${a.cpa || ''} onSave=${v => save({ads: {cpa: num(v)}})}/>
          <${Num} id="org-budget" label="Budget a day (₹)" min="0" value=${a.budget || ''} onSave=${v => save({ads: {budget: num(v)}})}/>
        </div>
        ${num(a.cpa) ? html`<div class="small">${LEARN_CONV} conversions in ${LEARN_DAYS} days at ${U.inr(num(a.cpa))} each is <b class="num">${U.inr(adNeed(a.cpa))}</b> a day, ${U.inr(adNeed(a.cpa) * LEARN_DAYS)} for the week.</div>` : null}
      </div>`;
    }
    return null;
  }

  function Step({c, r, open, onToggle}) {
    const ctx = M.useCtx();
    const good = r.ok || r.marked;
    const mark = () => upd(ctx, c.id, {steps: {[r.k]: {done: !r.marked, by: ctx.uid, at: Date.now()}}});
    return html`<div class=${'card org-step' + (good ? ' ok' : '')} id=${'org-step-' + r.k} data-ok=${good ? '1' : '0'}>
      <button type="button" class="org-step-head rowbtn" aria-expanded=${open ? 'true' : 'false'} onClick=${onToggle}>
        <span class=${'org-n num' + (good ? ' on' : '')}>${good ? html`<${icons.check}/>` : r.n}</span>
        <span class="grow">
          <span class="org-step-t">${r.title}</span>
          <span class=${'tiny ' + (good ? 'ink62' : 'flame-t')} style=${{display: 'block'}}>${r.text}</span>
        </span>
        <${icons.chevD}/>
      </button>
      ${open ? html`<div class="org-step-body stack tight">
        <div class="small ink62">${r.line}</div>
        <${StepBody} c=${c} k=${r.k}/>
        ${!r.ok ? html`<div><${UI.Btn} kind="ghost" sm=${true} onClick=${mark}>${r.marked ? 'Mark as open' : 'Mark as done'}<//></div>` : null}
      </div>` : null}
    </div>`;
  }

  function Playbook({c}) {
    const ctx = M.useCtx();
    const pr = progress(ctx, c);
    const [open, setOpen] = useState(() => { const f = pr.rows.find(r => !(r.ok || r.marked)); return f ? f.k : ''; });
    const st = pr.st;
    const client = c.client && ctx.coll.clients.map[c.client] ? ctx.coll.clients.map[c.client].name : '';
    return html`<div class="stack" id="org-playbook">
      <${UI.Card} title=${html`<span>${c.title || 'Campaign'}${client ? html` <span class="ink62" style=${{fontWeight: 300}}>· ${client}</span>` : null}</span>`}
        action=${html`<span class="num small">${pr.done} of ${STEPS.length} steps</span>`}>
        <${UI.Bar} a=${pr.done} max=${STEPS.length}/>
        <div class="kpi-rail org-kpis" style=${{marginTop: '14px'}}>
          <${Stat} v=${st.accounts} l="accounts"/>
          <${Stat} v=${st.perAcc} l="posts a day each" hot=${st.accounts > 0 && st.perAcc < (num(c.perDay) || 5)}/>
          <${Stat} v=${short(st.views)} l="views, 30 days"/>
          <${Stat} v=${short(num(c.waitlist))} l="waitlist"/>
          ${c.launch ? html`<${Stat} v=${Math.max(0, U.daysBetween(td(), c.launch))} l="days to launch"/>` : null}
        </div>
      <//>
      ${pr.rows.map(r => html`<${Step} key=${r.k} c=${c} r=${r} open=${open === r.k} onToggle=${() => setOpen(o => o === r.k ? '' : r.k)}/>`)}
      <div class="row between">
        <span class="tiny ink62">Made by ${ME_NAME(c.by)} on ${U.fmtDate(U.ymd(new Date(c.at || Date.now())))}.</span>
        <${UI.ConfirmBtn} label="Tap again to archive" onConfirm=${() => upd(ctx, c.id, {removed: true}).then(() => M.toast('Campaign archived'))}>Archive campaign<//>
      </div>
    </div>`;
  }

  /* ---------- Studio ---------- */
  function SlideFrame({text, idx, total}) {
    return html`<div class=${'org-slide' + (idx === 0 ? ' hook' : '')}>
      <div class="org-slide-t">${text}</div>
      <div class="org-slide-n num"><span class="dotflame"></span>${idx + 1} / ${total}</div>
    </div>`;
  }

  function DeckEditor({c, deck, onClose}) {
    const ctx = M.useCtx();
    const [title, setTitle] = useState(deck ? deck.title : '');
    const [slides, setSlides] = useState(deck ? deck.slides.slice() : ['', '', '']);
    const [topic, setTopic] = useState('');
    const [fmt, setFmt] = useState('habits');
    const [n, setN] = useState('7');
    const [busy, setBusy] = useState(false);
    const r = M.ai.useRun();
    const aiOn = M.ai.on(ctx);
    const setAt = (i, v) => setSlides(s => s.map((x, j) => j === i ? v : x));
    async function draft() {
      const count = Math.max(3, Math.min(8, num(n) || 7));
      const fb = offlineDraft(topic, fmt, count);
      if (!aiOn) { setTitle(fb.title); setSlides(fb.slides); return; }
      const f = FORMATS.find(x => x.v === fmt) || FORMATS[0];
      const client = c.client && ctx.coll.clients.map[c.client] ? ctx.coll.clients.map[c.client] : null;
      const out = await r.run(o => M.ai.json(ctx,
        'Write a short form social slideshow for a faceless account (TikTok and Instagram carousel). ' +
        'Slide 1 is the hook in the format "' + f.hook(count, topic || 'the topic') + '", under 12 words. Then exactly ' + count +
        ' numbered slides, each one idea under 22 words, plain words, no hashtags, no emoji, no dashes. The last slide asks to follow for more. ' +
        (client ? 'The brand behind the account is ' + client.name + (client.memory ? ' (' + String(client.memory).slice(0, 300) + ')' : '') + '. Never name the brand in the slides. ' : '') +
        'Reply with only JSON {"title": "short internal title", "slides": ["hook", "1. ...", "..."]}.\n\nTOPIC: ' + String(topic).slice(0, 300),
        {signal: o.signal, cache: false}));
      const d = cleanDeck(out, fb);
      setTitle(d.title); setSlides(d.slides);
    }
    async function save() {
      const clean = slides.map(s => s.trim()).filter(Boolean).slice(0, MAX_SLIDES);
      if (clean.length < 2) { M.toast('A slideshow needs a hook and at least one slide', true); return; }
      setBusy(true);
      const did = deck ? deck.id : 'd' + U.uid();
      try {
        await upd(ctx, c.id, {decks: {[did]: {title: (title.trim() || clean[0]).slice(0, 80), slides: clean, by: ctx.uid, at: deck ? deck.at : Date.now(), edited: Date.now()}}});
        M.toast('Slideshow saved'); onClose();
      } finally { setBusy(false); }
    }
    const shown = slides.filter(s => s.trim());
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${deck ? 'Edit slideshow' : 'New slideshow'}
      footer=${html`<div class="row" style=${{gap: '8px'}}><${UI.Btn} disabled=${busy} onClick=${save}>Save slideshow<//><${UI.Btn} kind="ghost" onClick=${onClose}>Close<//></div>`}>
      <div class="stack">
        <div class="card org-draft stack tight">
          <${UI.Micro}>draft it${aiOn ? ' with m360 AI' : ''}<//>
          <${UI.Input} id="org-topic" label="Topic" value=${topic} onChange=${setTopic} placeholder="golf, skincare after 30, saving for a house"/>
          <div class="row" style=${{gap: '8px', alignItems: 'flex-end'}}>
            <${UI.Seg} sm=${true} ariaLabel="Format" value=${fmt} onChange=${setFmt} options=${FORMATS.map(f => ({v: f.v, label: f.label}))}/>
            <${UI.Input} id="org-n" label="Points" type="number" min="3" max="8" value=${n} onChange=${setN}/>
          </div>
          <div class="row" style=${{gap: '8px'}}>
            <${UI.Btn} kind="sec" sm=${true} disabled=${r.state === 'thinking' || !topic.trim()} onClick=${draft}>
              ${r.state === 'thinking' ? html`<${M.Thinking} label="Drafting" state="composing"/>` : 'Draft the slides'}<//>
            ${r.state === 'error' ? html`<span class="small flame-t">${M.ai.errCopy(r.err)}</span>` : null}
          </div>
        </div>
        <${UI.Input} id="org-deck-title" label="Title" value=${title} onChange=${setTitle} placeholder="Golf habits, set 1"/>
        ${slides.map((s, i) => html`<div key=${i} class="row nowrap" style=${{gap: '8px', alignItems: 'flex-start'}}>
          <span class="tiny num ink62" style=${{width: '44px', paddingTop: '14px'}}>${i === 0 ? 'hook' : 'slide ' + (i + 1)}</span>
          <div class="grow"><${UI.TextArea} rows=${2} value=${s} onChange=${v => setAt(i, v.slice(0, 180))} placeholder=${i === 0 ? '7 weird golf habits that actually make you better' : 'One idea, under 20 words'}/></div>
          ${slides.length > 2 ? html`<button type="button" class="iconbtn" aria-label="Remove slide" onClick=${() => setSlides(x => x.filter((_, j) => j !== i))}><${icons.x}/></button>` : null}
        </div>`)}
        ${slides.length < MAX_SLIDES ? html`<div><${UI.Btn} kind="ghost" sm=${true} onClick=${() => setSlides(x => x.concat(['']))}><${icons.plus}/>Add a slide<//></div>` : null}
        ${shown.length ? html`<div><${UI.Micro}>preview<//><div class="org-reel">${shown.map((s, i) => html`<${SlideFrame} key=${i} text=${s} idx=${i} total=${shown.length}/>`)}</div></div>` : null}
      </div>
    <//>`;
  }

  function Studio({c}) {
    const ctx = M.useCtx();
    const decks = decksOf(c);
    const [edit, setEdit] = useState(null);
    const ps = posts(ctx, c.id);
    async function download(d) {
      if (!ctx.downloads || !ctx.downloads.save) { M.toast('Downloads are off on this page', true); return; }
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* fonts load on their own */ }
      const base = String(d.title || 'slideshow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'slideshow';
      for (let i = 0; i < d.slides.length; i++) {
        const blob = await drawSlide(d.slides[i], i, d.slides.length, i === 0);
        if (blob) await ctx.downloads.save({filename: base + '-' + U.pad(i + 1) + '.png', data: blob});
      }
      M.toast(d.slides.length + ' slides downloaded');
    }
    function variant(d) {
      const did = 'd' + U.uid();
      upd(ctx, c.id, {decks: {[did]: {title: (d.title + ', variant').slice(0, 80), slides: d.slides.slice(), by: ctx.uid, at: Date.now()}}})
        .then(() => { M.toast('Variant made. Change the hook.'); setEdit({id: did, title: (d.title + ', variant').slice(0, 80), slides: d.slides.slice(), at: Date.now()}); });
    }
    return html`<div class="stack" id="org-studio">
      <div class="row between">
        <div class="small ink62">${decks.length} ${decks.length === 1 ? 'slideshow' : 'slideshows'}. Volume wins early: make variants of what works and change the hook.</div>
        <${UI.Btn} sm=${true} onClick=${() => setEdit('new')}><${icons.plus}/>New slideshow<//>
      </div>
      ${decks.length ? html`<div class="grid2">${decks.map(d => {
        const used = ps.filter(p => p.k === d.id);
        const v = used.filter(p => p.s === 'posted').reduce((n, p) => n + num(p.v), 0);
        return html`<${UI.Card} key=${d.id} className="org-deck" title=${d.title || d.slides[0]}
          action=${html`<span class="tiny num ink62">${d.slides.length} slides</span>`}>
          <div class="org-reel small-reel">${d.slides.slice(0, 3).map((s, i) => html`<${SlideFrame} key=${i} text=${s} idx=${i} total=${d.slides.length}/>`)}</div>
          <div class="tiny ink62" style=${{margin: '10px 0'}}>${used.length ? used.length + ' posts, ' + short(v) + ' views' : 'Not scheduled yet'} · by ${ME_NAME(d.by)}</div>
          <div class="row" style=${{gap: '6px'}}>
            <${UI.Btn} kind="sec" sm=${true} onClick=${() => setEdit(d)}>Edit<//>
            <${UI.Btn} kind="sec" sm=${true} onClick=${() => variant(d)}>Make a variant<//>
            <${UI.Btn} kind="ghost" sm=${true} onClick=${() => download(d)}>Download slides<//>
            <${UI.ConfirmBtn} onConfirm=${() => upd(ctx, c.id, {decks: {[d.id]: {removed: true}}})}>Remove<//>
          </div>
        <//>`;
      })}</div>` : html`<${UI.Card}><${UI.Empty} text="No slideshows yet. Draft the first one from a topic."/><//>`}
      ${edit ? html`<${DeckEditor} c=${c} deck=${edit === 'new' ? null : edit} onClose=${() => setEdit(null)}/>` : null}
    </div>`;
  }

  /* ---------- Accounts ---------- */
  function Handles({c}) {
    const ctx = M.useCtx();
    const accs = accountsOf(c);
    const st = stats(ctx, c);
    const [f, setF] = useState({handle: '', platform: 'tiktok', faceless: true, owner: '', perDay: ''});
    const add = () => {
      const h = f.handle.trim().replace(/^@+/, '');
      if (!h) return;
      if (accs.some(a => a.handle.toLowerCase() === h.toLowerCase() && a.platform === f.platform)) { M.toast('That account is already on the list', true); return; }
      upd(ctx, c.id, {accounts: {['a' + U.uid()]: {handle: h.slice(0, 40), platform: f.platform, faceless: !!f.faceless, owner: f.owner || ctx.uid,
        perDay: Math.max(0, Math.min(10, num(f.perDay))), at: Date.now()}}}).then(() => M.toast('@' + h + ' added'));
      setF(x => ({...x, handle: ''}));
    };
    const profs = M.useProfiles(ctx.activeMembers.map(m => m.uid));
    const people = [{v: '', label: 'Me'}].concat(ctx.activeMembers.filter(m => m.uid !== ctx.uid)
      .map(m => ({v: m.uid, label: (profs[m.uid] && profs[m.uid].name) || m.title || 'Teammate'})));
    const target = num(c.target) || 8;
    return html`<div class="stack" id="org-handles">
      <${UI.Card} title="The fleet" action=${html`<span class="num small">${accs.length} of ${target}</span>`}>
        <${UI.Bar} a=${Math.min(accs.length, target)} max=${target}/>
        ${accs.length ? html`<div class="tbl-wrap" style=${{marginTop: '12px'}}><table class="tbl">
          <thead><tr><th>Account</th><th>Where</th><th>Owner</th><th>A day</th><th>7 days</th><th>Views, 30 days</th><th></th></tr></thead>
          <tbody>${accs.map(a => {
            const s = st.byAcc[a.id] || {p7: 0, v30: 0};
            const want = (num(a.perDay) || num(c.perDay) || 5) * 7;
            return html`<tr key=${a.id}>
              <td><b>@${a.handle}</b>${a.faceless ? html` <${UI.Pill}>faceless<//>` : null}</td>
              <td>${PLAT[a.platform] || a.platform}</td>
              <td>${ME_NAME(a.owner)}</td>
              <td class="num">${num(a.perDay) || num(c.perDay) || 5}</td>
              <td class=${'num' + (s.p7 < want ? ' flame-t' : '')}>${s.p7} of ${want}</td>
              <td class="num">${short(s.v30)}</td>
              <td><${UI.ConfirmBtn} onConfirm=${() => upd(ctx, c.id, {accounts: {[a.id]: {removed: true}}})}>Remove<//></td>
            </tr>`;
          })}</tbody></table></div>` : html`<div style=${{marginTop: '12px'}}><${UI.Empty} text="No accounts yet. The playbook runs 8, each posting 5 to 10 times a day."/></div>`}
      <//>
      <${UI.Card} title="Add an account">
        <div class="row" style=${{gap: '10px', alignItems: 'flex-end'}}>
          <${UI.Input} id="org-handle" label="Handle" value=${f.handle} onChange=${v => setF(x => ({...x, handle: v}))} placeholder="@golftips4" onEnter=${add}/>
          <${UI.Select} id="org-platform" label="Platform" value=${f.platform} onChange=${v => setF(x => ({...x, platform: v}))} options=${PLATFORMS}/>
          <${UI.Select} id="org-owner" label="Who posts" value=${f.owner} onChange=${v => setF(x => ({...x, owner: v}))} options=${people}/>
          <${UI.Input} id="org-acc-perday" label="Posts a day" type="number" min="0" max="10" value=${f.perDay} onChange=${v => setF(x => ({...x, perDay: v}))} placeholder=${String(c.perDay || 5)}/>
        </div>
        <div class="row between" style=${{marginTop: '10px'}}>
          <${UI.Check} label="Faceless account" checked=${f.faceless} onChange=${v => setF(x => ({...x, faceless: v}))}/>
          <${UI.Btn} sm=${true} disabled=${!f.handle.trim()} onClick=${add}>Add account<//>
        </div>
      <//>
    </div>`;
  }

  /* ---------- Schedule ---------- */
  function PostRow({c, p, decks}) {
    const ctx = M.useCtx();
    const [n, setN] = useState({v: p.v || '', l: p.l || '', c: p.c || '', sh: p.sh || ''});
    useEffect(() => { setN({v: p.v || '', l: p.l || '', c: p.c || '', sh: p.sh || ''}); }, [p.id, p.v, p.l, p.c, p.sh]);
    const w = partial => ctx.W.update(path(p.doc), {posts: {[p.id]: partial}});
    const deck = decks.find(d => d.id === p.k);
    const posted = p.s === 'posted';
    return html`<div class=${'org-post' + (posted ? ' done' : '')} data-pid=${p.id}>
      <div class="row between nowrap" style=${{gap: '8px'}}>
        <span class="num"><b>${p.t}</b></span>
        <select class="input" aria-label="Slideshow" value=${p.k || ''} onChange=${e => w({k: e.target.value})} style=${{minHeight: '34px', width: 'auto', maxWidth: '55%'}}>
          <option value="">No slideshow yet</option>
          ${decks.map(d => html`<option key=${d.id} value=${d.id}>${d.title || d.slides[0]}</option>`)}
        </select>
        ${posted ? html`<${UI.Pill} kind="ink">posted<//>` : html`<${UI.Btn} sm=${true} onClick=${() => w({s: 'posted', by: ctx.uid, at: Date.now()}).then(() => M.toast('Marked posted'))}>Mark posted<//>`}
      </div>
      ${posted ? html`<div class="row org-nums" style=${{gap: '6px', marginTop: '8px'}}>
        ${[['v', 'Views'], ['l', 'Likes'], ['c', 'Comments'], ['sh', 'Shares']].map(([k, l]) => html`<label key=${k} class="tiny ink62 org-num">${l}
          <input class="input" type="number" min="0" value=${n[k]} onInput=${e => setN(x => ({...x, [k]: e.target.value}))}
            onBlur=${e => { const v = num(e.target.value); if (v !== num(p[k])) w({[k]: v}); }}/></label>`)}
      </div>` : null}
      ${!posted ? html`<div class="row" style=${{marginTop: '6px', gap: '6px'}}>
        <span class="tiny ink62 grow">${deck ? deck.slides[0] : 'Pick a slideshow before it goes out.'}</span>
        <${UI.ConfirmBtn} onConfirm=${() => w({s: 'skip'})}>Skip<//>
      </div>` : null}
    </div>`;
  }

  function Schedule({c}) {
    const ctx = M.useCtx();
    const today = td();
    const [off, setOff] = useState(0);
    const [cell, setCell] = useState(null);
    const monday = U.addDays(U.mondayOf(new Date()), off * 7);
    const days = weekDays7(monday);
    const accs = accountsOf(c), decks = decksOf(c);
    const all = posts(ctx, c.id);
    const st = stats(ctx, c);
    const inWeek = all.filter(p => p.d >= days[0] && p.d <= days[6]);
    const at = (aid, d) => inWeek.filter(p => p.a === aid && p.d === d);
    async function fill() {
      if (!accs.length) { M.toast('Add an account first', true); return; }
      const {wk, add} = planWeek(ctx, c, monday, off === 0 ? today : days[0]);
      const n = Object.keys(add).length;
      if (!n) { M.toast('This week is already planned'); return; }
      await writePosts(ctx, c.id, wk, add);
      M.toast(n + ' posts planned');
    }
    const due = st.dueToday;
    const cellPosts = cell ? at(cell.a, cell.d) : [];
    const cellAcc = cell ? accs.find(a => a.id === cell.a) : null;
    function addSlot() {
      const taken = new Set(cellPosts.map(p => p.t));
      let t = '09:00';
      for (let h = 9; h <= 22; h++) { const x = U.pad(h) + ':00'; if (!taken.has(x)) { t = x; break; } }
      writePosts(ctx, c.id, weekId(cell.d), {['p' + U.uid()]: {a: cell.a, d: cell.d, t, k: decks.length ? decks[0].id : '', s: 'planned', by: ctx.uid, at: Date.now()}});
    }
    return html`<div class="stack" id="org-schedule">
      <div class="kpi-rail org-kpis">
        <${Stat} v=${short(st.views)} l="views, 30 days"/>
        <${Stat} v=${short(st.likes)} l="likes"/>
        <${Stat} v=${short(st.comments)} l="comments"/>
        <${Stat} v=${short(st.shares)} l="shares"/>
        <${Stat} v=${st.posts30} l="posts, 30 days"/>
      </div>
      ${due.length && off === 0 ? html`<${UI.Card} title="To post today" action=${html`<span class="num small">${due.length}</span>`} flame=${due.some(p => p.t < U.hhmm(Date.now()))}>
        <div class="stack tight">${due.slice(0, 6).map(p => {
          const a = accs.find(x => x.id === p.a);
          return html`<div key=${p.id}><div class="tiny ink62">@${a ? a.handle : 'account'} · ${PLAT[a && a.platform] || ''}</div><${PostRow} c=${c} p=${p} decks=${decks}/></div>`;
        })}${due.length > 6 ? html`<div class="tiny ink62">${due.length - 6} more today in the week grid.</div>` : null}</div>
      <//>` : null}
      <${UI.Card} title="The week" action=${html`<div class="row nowrap" style=${{gap: '6px'}}>
        <button type="button" class="iconbtn" aria-label="Last week" onClick=${() => setOff(o => o - 1)}><${icons.chevL}/></button>
        <span class="small num">${U.fmtDay(days[0])} to ${U.fmtDay(days[6])}</span>
        <button type="button" class="iconbtn" aria-label="Next week" onClick=${() => setOff(o => o + 1)}><${icons.chevR}/></button>
      </div>`}>
        ${accs.length ? html`<div class="tbl-wrap"><table class="tbl org-grid">
          <thead><tr><th>Account</th>${days.map(d => html`<th key=${d} class=${d === today ? 'org-today' : ''}>${U.fmtDay(d).split(' ')[0]} ${U.parseYmd(d).getDate()}</th>`)}</tr></thead>
          <tbody>${accs.map(a => html`<tr key=${a.id}>
            <td><b>@${a.handle}</b></td>
            ${days.map(d => {
              const xs = at(a.id, d);
              const done = xs.filter(p => p.s === 'posted').length;
              const late = d < today && xs.length > 0 && done < xs.length;
              return html`<td key=${d} class=${d === today ? 'org-today' : ''}>
                <button type="button" class=${'org-cell' + (late ? ' late' : '') + (xs.length && done === xs.length ? ' full' : '')} data-acc=${a.id} data-day=${d}
                  aria-label=${'@' + a.handle + ', ' + U.fmtDay(d) + ', ' + done + ' of ' + xs.length + ' posted'} onClick=${() => setCell({a: a.id, d})}>
                  <span class="num">${xs.length ? done + '/' + xs.length : '+'}</span>
                </button></td>`;
            })}
          </tr>`)}</tbody></table></div>
          <div class="row between" style=${{marginTop: '12px'}}>
            <span class="tiny ink62">${inWeek.filter(p => p.s === 'posted').length} posted, ${inWeek.filter(p => p.s !== 'posted').length} planned this week.</span>
            <${UI.Btn} sm=${true} onClick=${fill}>Plan the rest of the week<//>
          </div>` : html`<${UI.Empty} text="Add accounts on the Accounts tab, then plan the week here."/>`}
      <//>
      ${cell && cellAcc ? html`<${UI.Drawer} open=${true} onClose=${() => setCell(null)} title=${'@' + cellAcc.handle + ', ' + U.fmtDay(cell.d)}
        footer=${html`<${UI.Btn} kind="sec" onClick=${addSlot}><${icons.plus}/>Add a post<//>`}>
        <div class="stack tight">${cellPosts.length ? cellPosts.map(p => html`<${PostRow} key=${p.id} c=${c} p=${p} decks=${decks}/>`) : html`<${UI.Empty} text="Nothing planned for this day."/>`}</div>
      <//>` : null}
    </div>`;
  }

  /* ---------- the section ---------- */
  function Organic({tab}) {
    const ctx = M.useCtx();
    const p = usePick(ctx);
    const [making, setMaking] = useState(false);
    const t = tab || 'playbook';
    const c = p.c;
    const pr = c ? progress(ctx, c) : null;
    const st = pr ? pr.st : null;
    const Mini = ({v, l, hot}) => html`<span class="chipline"><b class=${'num' + (hot ? ' flame-t' : '')}>${v}</b> ${l}</span>`;
    return html`<div class="stack" style=${{gap: '20px'}} id="organic">
      <${M.SectionHero} title="Organic" sub="The launch playbook for organic growth: a fleet of faceless accounts, slideshows at volume, and the six steps checked live."
        right=${p.list.length ? null : html`<${UI.Btn} onClick=${() => setMaking(true)}><${icons.plus}/>New campaign<//>`}>
        ${c ? html`<div class="row" style=${{gap: '8px'}}>
          <${Mini} v=${pr.done + '/' + STEPS.length} l="steps"/>
          <${Mini} v=${st.accounts} l="accounts"/>
          <${Mini} v=${st.posts7} l="posts, 7 days"/>
          <${Mini} v=${st.dueToday.length} l="to post today" hot=${st.dueToday.length > 0}/>
        </div>` : null}
      <//>
      <${M.SectionTabs} section="organic" active=${t}/>
      ${p.list.length ? html`<${Picker} p=${p} onNew=${() => setMaking(true)}/>` : null}
      ${!c ? html`<${UI.Card} title="Start a campaign">
        <div class="stack tight">
          <div class="small">One campaign per launch. It holds the accounts, the slideshows, the posting schedule and the six steps.</div>
          <ol class="org-qs">${STEPS.map(s => html`<li key=${s.k}><b>${s.title}.</b> <span class="ink62">${s.line}</span></li>`)}</ol>
          <div><${UI.Btn} onClick=${() => setMaking(true)}><${icons.plus}/>New campaign<//></div>
        </div>
      <//>` : t === 'studio' ? html`<${Studio} c=${c}/>` : t === 'handles' ? html`<${Handles} c=${c}/>` : t === 'schedule' ? html`<${Schedule} c=${c}/>` : html`<${Playbook} key=${c.id} c=${c}/>`}
      ${making ? html`<${NewCampaign} onClose=${() => setMaking(false)} onMade=${p.pick}/>` : null}
    </div>`;
  }

  /* Home: the posts due today on accounts the viewer posts for, across campaigns. Quiet: it lists, it never rings */
  function mineToday(ctx) {
    const t = td(), out = [];
    for (const c of campaigns(ctx)) {
      const accs = {};
      for (const a of accountsOf(c)) if (a.owner === ctx.uid) accs[a.id] = a;
      if (!Object.keys(accs).length) continue;
      for (const p of posts(ctx, c.id)) if (p.d === t && p.s !== 'posted' && accs[p.a]) out.push({c, a: accs[p.a], p});
    }
    return out.sort((x, y) => (x.p.t < y.p.t ? -1 : x.p.t > y.p.t ? 1 : 0));
  }
  function OrganicFold() {
    const ctx = M.useCtx();
    if (ctx.viewAs) return null;
    const rows = mineToday(ctx);
    if (!rows.length) return null;
    const now = U.hhmm(Date.now());
    const late = rows.filter(r => r.p.t < now).length;
    return html`<${UI.Fold} title="Posts to make today" summary=${rows.length + (rows.length === 1 ? ' post' : ' posts') + (late ? ', ' + late + ' past their time' : '')}
      open=${late > 0} hot=${late > 0} id="fold-organic">
      <${UI.Card} id="home-organic" title="Posts to make today" flame=${late > 0} action=${html`<span class="num small">${rows.length}</span>`}>
      <div class="stack tight">
        ${rows.slice(0, 5).map(r => html`<div key=${r.p.id}><div class="tiny ink62">@${r.a.handle} · ${r.c.title || 'Campaign'}</div><${PostRow} c=${r.c} p=${r.p} decks=${decksOf(r.c)}/></div>`)}
        ${rows.length > 5 ? html`<div class="tiny ink62">${rows.length - 5} more on the schedule.</div>` : null}
        <div><${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#posting')}>Open the schedule<//></div>
      </div>
      <//>
    <//>`;
  }

  M.pages.Organic = Organic;
  M.parts.OrganicFold = OrganicFold;
  M.organic = {STEPS, mineToday, campaigns, campaign, posts, stats, check, progress, bestPrice, arpu, adNeed, slotTimes, planWeek, offlineDraft, cleanDeck};
})();
