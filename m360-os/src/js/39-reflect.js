/* module: reflect. Break, the Reflect tab: your last month, three months, six months or year, read
   back to you. The numbers come from your own records (tasks shipped and on time, kudos in and out,
   points, outcomes hit, EODs filed, the sparks and streaks); the era title comes from the numbers; the
   write-up comes from the model when it is on, in the house voice, and is kept in your private space
   for the day. Share one line to Vibe if you feel like it. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;

  const PERIODS = [{k: 'month', label: 'This month', days: 30}, {k: 'quarter', label: 'Three months', days: 90}, {k: 'half', label: 'Six months', days: 180}, {k: 'year', label: 'The year', days: 365}];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function stats(ctx, period) {
    const p = PERIODS.find(x => x.k === period) || PERIODS[0];
    const to = U.todayStr(), from = U.ymd(U.addDays(new Date(), -(p.days - 1)));
    const inRange = ts => { const d = U.ymd(new Date(ts)); return d >= from && d <= to; };
    const uid = ctx.uid;
    const tasks = Object.keys(ctx.coll.tasks.map).map(id => ({id, ...ctx.coll.tasks.map[id]})).filter(t => t && t.owner === uid);
    const shipped = tasks.filter(t => t.status === 'done' && t.doneAt && inRange(t.doneAt));
    const onTime = shipped.filter(t => !t.due || U.ymd(new Date(t.doneAt)) <= t.due).length;
    const revisions = shipped.reduce((n, t) => n + (Number(t.revisions) || 0), 0);
    const byDay = {}; shipped.forEach(t => { const d = new Date(t.doneAt).getDay(); byDay[d] = (byDay[d] || 0) + 1; });
    const bestDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
    const byProj = {}; shipped.forEach(t => { if (t.project) byProj[t.project] = (byProj[t.project] || 0) + 1; });
    const topProj = Object.keys(byProj).sort((a, b) => byProj[b] - byProj[a])[0];
    const kudosIn = [], kudosOut = [];
    Object.keys(ctx.coll.kudos.map).forEach(giver => ((ctx.coll.kudos.map[giver] || {}).given || []).forEach(g => {
      if (!g || !g.at || !inRange(g.at)) return;
      if (g.to === uid) kudosIn.push({from: giver, why: g.why});
      if (giver === uid) kudosOut.push({to: g.to});
    }));
    const eods = Object.keys((ctx.coll.eod.map[uid] || {}).days || {}).filter(d => d >= from && d <= to).length;
    let working = 0; for (let d = U.parseYmd(from); U.ymd(d) <= to; d = U.addDays(d, 1)) if (ctx.isWorkingDay ? ctx.isWorkingDay(U.ymd(d), uid) : d.getDay() !== 0) working++;
    const weeks = (ctx.coll.review.map[uid] || {}).weeks || {};
    let hit = 0, miss = 0; Object.keys(weeks).forEach(w => { const mk = (weeks[w] || {}).marks || {}; Object.values(mk).forEach(v => { if (v === 'hit') hit++; else if (v === 'miss') miss++; }); });
    const pts = M.points && M.points.pointsFor ? M.points.pointsFor(ctx, uid, from, to) : null;
    const checkins = Object.keys((ctx.coll.checkin.map[uid] || {}).days || {}).filter(d => d >= from && d <= to).length;
    const play = (M.play ? M.play.docOf(ctx) : {}) || {};
    const log = play.log || {};
    const playDays = Object.keys(log).filter(d => d >= from && d <= to);
    const puzzles = Object.keys(play.days || {}).filter(d => d >= from && d <= to).length;
    const breaths = playDays.reduce((n, d) => n + (log[d]['a breath'] || 0) + (log[d]['a sit'] || 0), 0);
    const s = {period: p, from, to, shipped: shipped.length, onTime, onTimePct: shipped.length ? Math.round(100 * onTime / shipped.length) : null, revisions, bestDay: bestDay != null ? DAYS[bestDay] : '',
      topProject: topProj ? (ctx.coll.projects.map[topProj] || {}).name || '' : '', topProjectN: topProj ? byProj[topProj] : 0, kudosIn: kudosIn.length, kudosOut: kudosOut.length,
      kudosFrom: Array.from(new Set(kudosIn.map(k => k.from))), eods, working, hit, miss, points: pts ? pts.total : 0, checkins, playDays: playDays.length, puzzles, breaths, streakBest: Number(play.best) || 0};
    s.era = eraOf(s);
    return s;
  }
  /* the title the numbers earn */
  function eraOf(s) {
    if (!s.shipped && !s.kudosIn && !s.eods && !s.playDays) return {title: 'Quiet era', line: 'Not much on the record yet. The next one is yours to write.'};
    const score = [
      [s.shipped >= 12 && s.onTimePct >= 80 ? 3 : s.shipped >= 6 ? 2 : s.shipped ? 1 : 0, {title: 'Shipping era', line: 'Things left your desk and did not come back.'}],
      [s.kudosIn >= 4 ? 3 : s.kudosIn >= 2 ? 2 : s.kudosIn ? 1 : 0, {title: 'Team glue era', line: 'People noticed, and said so.'}],
      [s.working && s.eods / s.working >= .85 && s.checkins / s.working >= .85 ? 3 : s.working && s.eods / s.working >= .6 ? 2 : s.eods ? 1 : 0, {title: 'Locked in era', line: 'Showed up, wrote it down, every day it counted.'}],
      [s.playDays >= 12 ? 3 : s.playDays >= 5 ? 2 : s.playDays ? 1 : 0, {title: 'Soft life era', line: 'Took the breaks. The work got better for it.'}],
      [s.hit >= 6 && s.hit > s.miss * 2 ? 3 : s.hit >= 3 ? 2 : s.hit ? 1 : 0, {title: 'Said it, did it era', line: 'The outcomes you wrote on Monday were the ones you hit.'}]
    ].sort((a, b) => b[0] - a[0]);
    return score[0][0] ? score[0][1] : {title: 'Warm up era', line: 'A few things on the board. The streak starts now.'};
  }

  function narrativePrompt(s, name) {
    return 'Write a short reflection for ' + name + ' on their last ' + s.period.label.toLowerCase() + ' at Mask360, from these numbers only. Voice: warm, playful, a little Gen Z (lowkey, no cap, main character, era), never cringe, never corporate, no emoji, no exclamation marks, no bullet points, no headings. Four to six sentences, under 110 words. Name the era once. Be honest about a soft spot without being harsh, and end on one specific thing to do next.\n\n' +
      'ERA: ' + s.era.title + '\nSHIPPED: ' + s.shipped + ' tasks, ' + (s.onTimePct == null ? 'none dated' : s.onTimePct + '% on time') + ', ' + s.revisions + ' revisions\n' +
      (s.bestDay ? 'BUSIEST DAY: ' + s.bestDay + '\n' : '') + (s.topProject ? 'BIGGEST PROJECT: ' + s.topProject + ' (' + s.topProjectN + ' tasks)\n' : '') +
      'KUDOS: ' + s.kudosIn + ' received, ' + s.kudosOut + ' given\nEODS: ' + s.eods + ' of ' + s.working + ' working days\nCHECK-INS: ' + s.checkins + '\nOUTCOMES: ' + s.hit + ' hit, ' + s.miss + ' missed\nPOINTS: ' + s.points + '\n' +
      'BREAKS: ' + s.playDays + ' days in the reset room, ' + s.puzzles + ' puzzles, ' + s.breaths + ' breaths, best streak ' + s.streakBest;
  }
  function fallback(s, first) {
    const bits = [first + ', this was your ' + s.era.title.toLowerCase() + '. ' + s.era.line];
    if (s.shipped) bits.push('You shipped ' + s.shipped + (s.shipped === 1 ? ' task' : ' tasks') + (s.onTimePct != null ? ', ' + s.onTimePct + ' percent on time' : '') + (s.topProject ? ', most of it on ' + s.topProject : '') + '.');
    if (s.kudosIn) bits.push(s.kudosIn + (s.kudosIn === 1 ? ' kudos came your way' : ' kudos came your way') + (s.kudosOut ? ' and you sent ' + s.kudosOut : '') + '.');
    if (s.working) bits.push('EODs on ' + s.eods + ' of ' + s.working + ' working days' + (s.eods / s.working >= .8 ? ', which is the habit doing its job.' : ', so that is the one to tighten.'));
    if (s.playDays) bits.push(s.playDays + (s.playDays === 1 ? ' day' : ' days') + ' in the reset room. Keep that.');
    return bits.join(' ');
  }

  function Reflect() {
    const ctx = M.useCtx();
    const [period, setPeriod] = useState('month');
    const s = stats(ctx, period);
    const cache = M.ai.useCache(ctx);
    const cached = cache.data && cache.data.reflect && cache.data.reflect[period];
    const fresh = cached && cached.date === U.todayStr() && cached.text;
    const r = M.ai.useRun();
    const [first, setFirst] = useState('');
    useEffect(() => { M.ai.names(ctx).then(nm => setFirst(String(nm[ctx.uid] || '').split(' ')[0] || 'you')).catch(() => setFirst('you')); }, [ctx.uid]);
    const write = () => r.run(o => M.ai.text(ctx, narrativePrompt(s, first || 'this person'), {signal: o.signal, onText: o.onText, tier: 'quick', cache: false}).then(t => { const text = String(t || '').replace(/\u2014|\u2013/g, ', ').replace(/!/g, '.'); M.ai.saveCache(ctx, 'reflect', {...((cache.data || {}).reflect || {}), [period]: {text, date: U.todayStr()}}); return text; }));
    const text = r.text || fresh || '';
    const share = () => {
      const line = (text || fallback(s, first)).split(/(?<=\.)\s/)[0];
      const id = U.uid();
      const mine = ctx.coll.feed.map[ctx.uid] || {};
      ctx.W.merge('feed/' + ctx.uid, {posts: [{id, kind: 'win', text: s.era.title + ': ' + line, at: Date.now()}].concat(U.clone(mine.posts || [])).slice(0, 80), pinned: mine.pinned || null}).then(() => M.toast('Posted to Vibe')).catch(() => {});
    };
    const tile = (v, l) => html`<div class="brk-tile-stat"><b class="num">${v}</b><span class="tiny ink62">${l}</span></div>`;
    return html`<div class="stack" style=${{gap: '16px'}} id="break-reflect">
      <${UI.Seg} ariaLabel="Period" value=${period} onChange=${v => { setPeriod(v); r.setText(''); }} options=${PERIODS.map(p => ({v: p.k, label: p.label}))}/>
      <${UI.Card} id="reflect-era" flame=${true} title=${html`<span>${s.era.title}</span>`} action=${html`<span class="tiny ink62 num">${U.fmtDate(s.from)} to ${U.fmtDate(s.to)}</span>`}>
        <div class="small" style=${{marginBottom: '12px'}}>${s.era.line}</div>
        <div class="brk-stats">
          ${tile(s.shipped, 'shipped')}${tile(s.onTimePct == null ? 'n/a' : s.onTimePct + '%', 'on time')}${tile(s.kudosIn, 'kudos in')}${tile(s.kudosOut, 'kudos out')}
          ${tile(s.eods + '/' + s.working, 'EODs')}${tile(s.hit + '/' + (s.hit + s.miss), 'outcomes hit')}${tile(s.points, 'points')}${tile(s.playDays, 'break days')}
        </div>
        ${s.topProject ? html`<div class="tiny ink62" style=${{marginTop: '8px'}}>Biggest project: ${s.topProject}, ${s.topProjectN} tasks.${s.bestDay ? ' Busiest day: ' + s.bestDay + '.' : ''}${s.kudosFrom.length ? html` Kudos from ${s.kudosFrom.map((u, i) => html`<span key=${u}>${i ? ', ' : ''}<${UI.Name} id=${u}/></span>`)}.` : ''}</div>` : null}
      <//>
      <${UI.Card} id="reflect-text" title="The read">
        ${text ? html`<${M.AIText} text=${text}/>` : html`<div class="small">${fallback(s, first || 'Hey')}</div>`}
        <div class="row" style=${{gap: '10px', marginTop: '12px', flexWrap: 'wrap'}}>
          ${M.ai.on(ctx) ? html`<${UI.Btn} sm=${true} id="reflect-write" disabled=${r.state === 'thinking' || r.state === 'streaming'} onClick=${write}>${r.state === 'thinking' || r.state === 'streaming' ? 'Writing' : text ? 'Write it again' : 'Write it for me'}<//>` : null}
          <${UI.Btn} sm=${true} kind="sec" id="reflect-share" onClick=${share}>Share one line to Vibe<//>
          ${r.state === 'error' ? html`<span class="tiny flame-t">${M.ai.errCopy(r.err)}</span>` : null}
        </div>
      <//>
      <div class="hint">Numbers from your own records only; nobody else's. The era is earned, the write-up is for you.</div>
    </div>`;
  }

  M.parts.BreakReflect = Reflect;
  M.reflect = {PERIODS, stats, eraOf};
})();
