/* module: break. "Take a break": the reset room, rebuilt on what replicates. Sparks are the wellness
   score; they count feedback, never prizes. The engagement rules come from the field trials: a weekly
   budget that resets every Monday (the fresh start effect), a streak that counts workdays only and
   covers one missed day a week for you, squads of three or four that compete as teams (the step-count
   trials: comparison between small groups moved people, support alone did not), levels earned by weeks
   shown up, every number hideable in one tap, and no claim anywhere that any of it makes anyone
   smarter. This file holds the engine, the hero and the section page; the daily puzzles, the games and
   the resets live in their own files. Nothing here touches work points: sparks are their own thing. */
'use strict';
(function () {
  const {html, React, U, UI} = M;

  const today = () => U.todayStr();
  const weekOf = ymd => U.isoWeek(U.parseYmd(ymd));
  const WEEK_GOAL = 30;
  /* levels are weeks shown up (thirty sparks or more in a week), not lifetime points */
  const LEVELS = [[0, 'Spark'], [2, 'Ember'], [5, 'Flame'], [12, 'Blaze'], [26, 'Supernova']];
  const SQUAD_NAMES = ['Embers', 'Comets', 'Lanterns', 'Flares', 'Beacons', 'Sparklers'];

  /* ---------- seeded randomness: the same puzzle for everyone, every day ---------- */
  function rng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- workdays: a streak that ignores the weekend ---------- */
  /* Monday to Saturday count (the studio works Saturdays); a Sunday folds into the Saturday before it */
  const workdayIndex = ymd => {
    const d = U.parseYmd(ymd);
    const mon = U.mondayOf(d);
    const week = Math.round(mon.getTime() / 604800000);
    return week * 6 + Math.min((d.getDay() + 6) % 7, 5);
  };
  const workdayBack = (ymd, n) => { let d = U.parseYmd(ymd); let left = n; while (left > 0) { d = U.addDays(d, -1); if (d.getDay() !== 0) left--; } return U.ymd(d); };

  /* ---------- the engine ---------- */
  const docOf = (ctx, uid) => (ctx.coll.play && ctx.coll.play.map[uid || ctx.uid]) || {};
  const weeksShown = d => Object.keys(d.weeks || {}).filter(w => (Number(d.weeks[w]) || 0) >= WEEK_GOAL).length;
  const level = weeks => {
    let cur = LEVELS[0], next = null;
    for (let i = 0; i < LEVELS.length; i++) { if (weeks >= LEVELS[i][0]) cur = LEVELS[i]; else { next = LEVELS[i]; break; } }
    return {name: cur[1], at: cur[0], next: next ? next[1] : '', nextAt: next ? next[0] : null, weeks};
  };
  /* where the streak stands if today counts: continues, covers one missed workday, or starts over */
  function nextStreak(d, td) {
    const cur = Number(d.streak) || 0;
    if (!d.lastDay) return {streak: 1};
    const gap = workdayIndex(td) - workdayIndex(d.lastDay);
    if (gap <= 0) return {streak: Math.max(1, cur)};
    if (gap === 1) return {streak: cur + 1};
    const wk = weekOf(td);
    if (gap === 2 && !(d.repairs || {})[wk]) return {streak: cur + 2, repaired: workdayBack(td, 1)};
    return {streak: 1};
  }
  const streakAlive = (d, td) => !!d.lastDay && workdayIndex(td) - workdayIndex(d.lastDay) <= 1;
  /* +n sparks, the week's total and the streak, in one write; `what` is the thing that earned them */
  async function award(ctx, n, what) {
    const d = U.clone(docOf(ctx));
    const td = today(), wk = weekOf(td);
    const {streak, repaired} = nextStreak(d, td);
    const best = Math.max(Number(d.best) || 0, streak);
    const weeks = {...(d.weeks || {})};
    weeks[wk] = (Number(weeks[wk]) || 0) + n;
    const wkeys = Object.keys(weeks).sort();
    while (wkeys.length > 60) delete weeks[wkeys.shift()];
    const log = {...(d.log || {})};
    log[td] = {...(log[td] || {}), [what]: ((log[td] || {})[what] || 0) + 1};
    const keys = Object.keys(log).sort();
    while (keys.length > 120) delete log[keys.shift()];
    const patch = {sparks: (Number(d.sparks) || 0) + n, weeks, streak, best, lastDay: td, log, updated: Date.now()};
    if (repaired) patch.repairs = {...(d.repairs || {}), [wk]: repaired};
    await ctx.W.merge('play/' + ctx.uid, patch);
    M.sound.play('done');
    M.toast('+' + n + ' sparks, ' + what + (repaired ? '. We covered ' + U.fmtDay(repaired) + ' for you, streak intact.' : ''));
    return streak;
  }
  /* sparks once a day for a thing; false when it already counted */
  const once = async (ctx, what, n) => {
    if ((mine(ctx).today || {})[what]) { M.toast('Already counted today. Still worth it.'); return false; }
    await award(ctx, n || 5, what);
    return true;
  };
  function mine(ctx, uid) {
    const d = docOf(ctx, uid);
    const td = today(), wk = weekOf(td), lastWk = U.isoWeek(U.addDays(U.mondayOf(new Date()), -7));
    const weeks = d.weeks || {};
    return {sparks: Number(d.sparks) || 0, week: Number(weeks[wk]) || 0, lastWeek: Number(weeks[lastWk]) || 0, level: level(weeksShown(d)),
      streak: streakAlive(d, td) ? (Number(d.streak) || 0) : 0, best: Number(d.best) || 0, today: (d.log || {})[td] || {},
      covered: (d.repairs || {})[wk] || '', hide: !!d.hide, lastDay: d.lastDay || ''};
  }
  const board = ctx => ctx.activeMembers.map(m => ({uid: m.uid, ...mine(ctx, m.uid)})).sort((a, b) => b.week - a.week || b.streak - a.streak);

  /* ---------- squads: three or four people, drawn fresh every month, scored by the week ---------- */
  function squads(ctx, ym) {
    const ids = shuffle(ctx.activeMembers.map(m => m.uid).sort(), rng('squad:' + (ym || U.monthId(new Date()))));
    const n = ids.length;
    if (n < 6) return [{name: 'Everyone', ids}];
    const count = Math.max(2, Math.round(n / 3.5));
    const names = shuffle(SQUAD_NAMES, rng('names:' + (ym || U.monthId(new Date()))));
    const out = Array.from({length: count}, (_, i) => ({name: names[i % names.length], ids: []}));
    ids.forEach((id, i) => out[i % count].ids.push(id));
    return out;
  }
  const squadBoard = ctx => squads(ctx).map(s => ({...s, week: s.ids.reduce((n, id) => n + mine(ctx, id).week, 0), mine: s.ids.indexOf(ctx.uid) >= 0}))
    .sort((a, b) => b.week - a.week);
  const setHide = (ctx, hide) => ctx.W.merge('play/' + ctx.uid, {hide: !!hide}).catch(() => {});

  /* ---------- the hero: this week, the streak, the level, the squad ---------- */
  function Sparks() {
    const ctx = M.useCtx();
    const me = mine(ctx);
    const care = html`<${M.fx.Bot} feature="care" size=${30} label="m360 care"/>`;
    if (me.hide) return html`<div class="brk-sparks row" id="sparks" style=${{gap: '12px', alignItems: 'center'}}>
      ${care}<span class="tiny ink62">Scoreboard hidden. Everything still counts.</span>
      <button type="button" class="linky tiny" id="sparks-show" onClick=${() => setHide(ctx, false)}>Show it</button>
    </div>`;
    const sq = squadBoard(ctx);
    const my = sq.find(s => s.mine), pos = sq.indexOf(my);
    const place = pos === 0 ? 'leading' : pos === 1 ? 'second' : pos === 2 ? 'third' : 'fourth';
    return html`<div class="brk-sparks row" style=${{gap: '14px', flexWrap: 'wrap', alignItems: 'center'}} id="sparks">
      ${care}
      <span class="chipline"><b class="num"><${M.fx.MetalText} size=${15} color=${M.fx.FLAME}>${String(me.week)}<//></b> sparks this week <span class="tiny ink62 num">${me.lastWeek ? 'last week ' + me.lastWeek : WEEK_GOAL + ' shows up'}</span></span>
      <span class="chipline"><b class="num"><${M.fx.MetalText} size=${15}>${String(me.streak)}<//></b> workday streak${me.covered ? html` <span class="tiny ink62">${U.fmtDay(me.covered).split(' ')[0]} covered</span>` : me.best > me.streak ? html` <span class="tiny ink62 num">best ${me.best}</span>` : ''}</span>
      <span class="chipline"><b><${M.fx.MetalText} size=${15}>${me.level.name}<//></b> <span class="tiny ink62 num">${me.level.weeks} ${me.level.weeks === 1 ? 'week' : 'weeks'} shown up${me.level.next ? ', ' + me.level.next + ' at ' + me.level.nextAt : ''}</span></span>
      ${my && sq.length > 1 ? html`<span class="chipline" id="squad-chip"><b>${my.name}</b> <span class="tiny ink62 num">${my.week} sparks, ${place}</span></span>` : null}
      <button type="button" class="linky tiny" id="sparks-hide" onClick=${() => setHide(ctx, true)}>Hide</button>
    </div>`;
  }

  /* the squads this month, this week's totals; a person sees their own squad's members, never a ranking of people */
  function Squads() {
    const ctx = M.useCtx();
    const sq = squadBoard(ctx);
    if (sq.length < 2) return html`<${UI.Card} title="The team this week" id="squads">
      <div class="row nowrap fxh-talk"><${M.fx.Bot} feature="care" size=${28} label="m360 care"/><div class="small">Squads start at six people. Until then it is everyone against the week: <b class="num"><${M.fx.MetalText} size=${15}>${String(sq[0] ? sq[0].week : 0)}<//></b> sparks so far.</div></div>
    <//>`;
    return html`<${UI.Card} title="Squads this week" id="squads" action=${html`<span class="tiny ink62">drawn fresh every month, reset every Monday</span>`}>
      <div class="stack tight">
        ${sq.map((s, i) => html`<div key=${s.name} class=${'row between brk-row' + (s.mine ? ' mine' : '')}>
          <span class="row nowrap"><b class="num">${i + 1}.</b> <b>${s.name}</b>${s.mine ? html` <${M.fx.MetalBadge}>yours<//>` : null} <${UI.AvatarRow} ids=${s.ids} size=${20}/></span>
          <span class="num">${s.mine ? html`<${M.fx.MetalText} size=${15} color=${M.fx.FLAME}>${String(s.week)}<//>` : s.week}</span>
        </div>`)}
      </div>
    <//>`;
  }

  /* ---------- the section ---------- */
  const TABS = [{k: 'play', label: 'Daily', route: 'play'}, {k: 'reset', label: 'Reset', route: 'reset'}, {k: 'care', label: 'Care', route: 'care'}, {k: 'reflect', label: 'Reflect', route: 'reflect'}];
  function Break({tab}) {
    const t = tab || 'play';
    const P = M.parts;
    return html`<div class="stack" style=${{gap: '20px'}} id="break">
      <${M.SectionHero} micro="the reset room" title="Break" sub="One shared puzzle, a five minute game, a breath that is actually five minutes, a walk with a problem in your pocket. Built on the trials that replicated, with the grade on every card.">
        <${Sparks}/>
      <//>
      <${M.SectionTabs} section="break" active=${t}/>
      ${t === 'reset' && P.BreakReset ? html`<${P.BreakReset}/>` : t === 'care' && P.BreakCare ? html`<${P.BreakCare}/>` : t === 'reflect' && P.BreakReflect ? html`<${P.BreakReflect}/>`
        : html`<div class="stack" style=${{gap: '18px'}} id="break-daily">
            ${P.Daily ? html`<${P.Daily}/>` : null}
            <div class="split">${P.Doubles ? html`<${P.Doubles}/>` : null}${P.Reaction ? html`<${P.Reaction}/>` : null}</div>
            <${Squads}/>
          </div>`}
    </div>`;
  }

  M.play = {LEVELS, WEEK_GOAL, level, award, once, board, squads, squadBoard, mine, docOf, rng, shuffle, fmtMs, TABS, weekOf, workdayIndex, workdayBack, nextStreak, setHide};
  M.pages.Break = Break;
})();
