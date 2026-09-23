/* module: badges. The trophy case (earned from real work, never handed out) and the celebrations:
   birthdays from each person's profile and work anniversaries from the roster. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect} = React;

  /* ---------- trophies ---------- */
  const DEFS = [
    {id: 'first-in', name: 'First light', desc: 'Your first check-in.', icon: 'today', test: s => s.checkins >= 1},
    {id: 'streak-5', name: 'Five alive', desc: 'Five working days in a row.', icon: 'flame', test: s => s.streak >= 5},
    {id: 'streak-20', name: 'Twenty deep', desc: 'Twenty working days in a row.', icon: 'flame', test: s => s.streak >= 20},
    {id: 'early', name: 'Early bird', desc: 'Checked in before 9:30.', icon: 'sun', test: s => s.early >= 1},
    {id: 'eod-10', name: 'Sign off', desc: 'Ten EOD lines.', icon: 'edit', test: s => s.eods >= 10},
    {id: 'ship-10', name: 'Shipped ten', desc: 'Ten tasks done.', icon: 'tasks', test: s => s.done >= 10},
    {id: 'ship-50', name: 'Shipped fifty', desc: 'Fifty tasks done.', icon: 'tasks', test: s => s.done >= 50},
    {id: 'clean', name: 'Clean pass', desc: 'A task approved with zero revisions.', icon: 'review', test: s => s.cleanPass >= 1},
    {id: 'kudos-give', name: 'Good egg', desc: 'Gave your first kudos.', icon: 'scores', test: s => s.kudosGiven >= 1},
    {id: 'kudos-5', name: 'Magnet', desc: 'Received five kudos.', icon: 'scores', test: s => s.kudosGot >= 5},
    {id: 'focus-10', name: 'Deep worker', desc: 'Ten focus sessions.', icon: 'timer', test: s => s.focus >= 10},
    {id: 'reader', name: 'By the book', desc: 'Read the whole handbook.', icon: 'handbook', test: s => s.readAll},
    {id: 'poll', name: 'Pollster', desc: 'Asked the team a poll.', icon: 'feed', test: s => s.polls >= 1},
    {id: 'night', name: 'Night owl', desc: 'An EOD line after 21:00.', icon: 'moon', test: s => s.night >= 1}
  ];

  function stats(ctx, uid) {
    const days = (ctx.coll.checkin.map[uid] || {}).days || {};
    const eods = (ctx.coll.eod.map[uid] || {}).days || {};
    const ins = Object.keys(days).filter(d => days[d] && days[d].in);
    const early = ins.filter(d => { const t = new Date(days[d].in); return t.getHours() * 60 + t.getMinutes() < 9 * 60 + 30; }).length;
    const night = Object.keys(eods).filter(d => eods[d] && eods[d].at && new Date(eods[d].at).getHours() >= 21).length;
    const tmap = ctx.coll.tasks.map;
    let done = 0, cleanPass = 0;
    for (const id of Object.keys(tmap)) { const t = tmap[id]; if (t && t.owner === uid && t.status === 'done') { done++; if (t.approvedBy && !(Number(t.revisions) > 0)) cleanPass++; } }
    let kudosGot = 0;
    for (const g of Object.keys(ctx.coll.kudos.map)) for (const k of (ctx.coll.kudos.map[g].given || [])) if (k && k.to === uid) kudosGot++;
    const kudosGiven = ((ctx.coll.kudos.map[uid] || {}).given || []).length;
    const polls = ((ctx.coll.feed.map[uid] || {}).posts || []).filter(p => p && p.kind === 'poll').length;
    const unread = M.handbook && M.handbook.unread ? M.handbook.unread(ctx, uid) : [];
    const streak = M.home ? M.home.streak(ctx, uid, d => !!(days[d] && days[d].in)) : 0;
    return {checkins: ins.length, streak, early, eods: Object.keys(eods).length, done, cleanPass, kudosGot, kudosGiven,
      focus: M.focus ? M.focus.sessions(ctx, uid).length : 0, readAll: Object.keys(ctx.coll.handbook.map).length > 0 && unread.length === 0, polls, night};
  }
  function earned(ctx, uid) {
    const s = stats(ctx, uid);
    return DEFS.map(d => ({...d, got: !!d.test(s)}));
  }

  /* ---------- celebrations ---------- */
  const mmdd = s => String(s || '').slice(5);
  function celebrations(ctx, ymd) {
    const out = [];
    const md = mmdd(ymd), y = Number(ymd.slice(0, 4));
    ctx.activeMembers.forEach(m => {
      const bd = (ctx.coll.me.map[m.uid] || {}).birthday;
      if (bd && bd === md) out.push({uid: m.uid, kind: 'birthday', text: 'birthday today'});
      if (m.joined && mmdd(m.joined) === md) {
        const n = y - Number(m.joined.slice(0, 4));
        if (n >= 1) out.push({uid: m.uid, kind: 'anniversary', text: n + (n === 1 ? ' year' : ' years') + ' at Mask360 today'});
      }
    });
    return out;
  }
  const today = ctx => celebrations(ctx, U.todayStr());

  /* ---------- the celebration card, on Home ---------- */
  function Celebrate() {
    const ctx = M.useCtx();
    const list = today(ctx);
    if (!list.length) return null;
    const wish = async c => {
      const given = [{id: U.uid(), to: c.uid, why: c.kind === 'birthday' ? 'Happy birthday. Have the best one.' : 'Happy work anniversary. Thank you for everything.', at: Date.now()}]
        .concat(((ctx.coll.kudos.map[ctx.uid] || {}).given) || []).slice(0, 60);
      await ctx.W.merge('kudos/' + ctx.uid, {given}).catch(() => {});
      M.burst(document.getElementById('celebrate'));
      M.toast('Sent');
    };
    return html`<section class="card flame" id="celebrate">
      ${list.map(c => html`<div class="celebrate" key=${c.uid + c.kind}>
        <span class="cake"><${icons.gift}/></span>
        <div class="grow"><div style=${{fontWeight: 500}}><${UI.Name} id=${c.uid}/></div><div class="small ink62">${c.uid === ctx.uid ? (c.kind === 'birthday' ? 'Happy birthday from all of us.' : 'Happy work anniversary.') : c.text}</div></div>
        ${c.uid !== ctx.uid ? html`<${UI.Btn} sm=${true} onClick=${() => wish(c)}>Send wishes<//>` : null}
      </div>`)}
    </section>`;
  }

  /* ---------- the trophy case, on Me ---------- */
  function Trophies({uid}) {
    const ctx = M.useCtx();
    const who = uid || ctx.uid;
    const list = earned(ctx, who);
    const got = list.filter(t => t.got);
    const seen = ((ctx.coll.me.map[ctx.uid] || {}).badgesSeen) || [];
    const fresh = who === ctx.uid ? got.filter(t => !seen.includes(t.id)).map(t => t.id) : [];
    useEffect(() => {
      if (!fresh.length) return;
      M.burst(document.getElementById('trophies'));
      ctx.W.merge('me/' + ctx.uid, {badgesSeen: seen.concat(fresh)}).catch(() => {});
    }, [fresh.join(',')]);
    return html`<${UI.Card} id="trophies" title="Trophy case" action=${html`<span class="pill ink">${got.length} of ${list.length}</span>`}>
      <div class="trophies">
        ${list.map(t => html`<div key=${t.id} class=${'trophy' + (t.got ? '' : ' locked') + (fresh.includes(t.id) ? ' new' : '')}>
          <span class="ic"><${icons[t.icon] || icons.trophy}/></span>
          <b>${t.name}</b><span class="small">${t.desc}</span>
        </div>`)}
      </div>
    <//>`;
  }

  /* ---------- about you: birthday and a fun fact ---------- */
  function AboutCard() {
    const ctx = M.useCtx();
    const me = ctx.coll.me.map[ctx.uid] || {};
    const [bd, setBd] = useState(me.birthday ? '2000-' + me.birthday : '');
    const [fact, setFact] = useState(me.fact || '');
    useEffect(() => { setBd(me.birthday ? '2000-' + me.birthday : ''); setFact(me.fact || ''); }, [me.birthday, me.fact]);
    const save = () => ctx.W.merge('me/' + ctx.uid, {birthday: bd ? bd.slice(5) : '', fact: fact.trim().slice(0, 120)}).then(() => M.toast('Saved')).catch(() => {});
    return html`<${UI.Card} id="about-card" title="About you">
      <div class="grid2">
        <${UI.Input} label="birthday" type="date" value=${bd} onChange=${setBd} hint="Only the day and month show. The team gets a nudge to wish you."/>
        <${UI.Input} label="one fun fact" value=${fact} onChange=${setFact} placeholder="Makes a mean filter coffee"/>
      </div>
      <div class="row" style=${{marginTop: '10px'}}><${UI.Btn} sm=${true} onClick=${save}>Save<//></div>
    <//>`;
  }

  M.trophies = {DEFS, stats, earned, celebrations, today};
  M.parts.Celebrate = Celebrate;
  M.parts.Trophies = Trophies;
  M.parts.AboutCard = AboutCard;
})();
