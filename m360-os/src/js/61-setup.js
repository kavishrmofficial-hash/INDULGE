/* module: setup. The founder's "Get m360 ready" checklist on HQ. Every step is one tap,
   and each ticks itself off from live data. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState} = React;

  /* fixed-date public holidays; festivals move every year, so those stay manual */
  const FIXED = [['01-26', 'Republic Day'], ['05-01', 'Maharashtra Day'], ['08-15', 'Independence Day'],
    ['10-02', 'Gandhi Jayanti'], ['12-25', 'Christmas']];
  function fixedHolidays(now) {
    const y = new Date(now).getFullYear(), td = U.todayStr();
    const out = [];
    for (const yr of [y, y + 1]) for (const [md, name] of FIXED) { const d = yr + '-' + md; if (d >= td) out.push({d, name}); }
    return out;
  }

  function steps(ctx) {
    const s = ctx.settings, setup = s.setup || {};
    const clients = Object.keys(ctx.coll.clients.map).length;
    const posted = ((ctx.coll.feed.map[ctx.uid] || {}).posts || []).length > 0;
    const reqs = (M.team && M.team.requests) ? M.team.requests(ctx).length : 0;
    return [
      {k: 'office', done: !!s.office, title: 'Pin the office',
        sub: 'Check-ins within 200 metres count as verified office days.'},
      {k: 'hours', done: !!setup.hours, title: 'Confirm working hours',
        sub: 'Start ' + s.start + ' with ' + s.grace + ' minutes grace, EOD line by ' + s.eodCut + ', ' + s.wfhCap + ' WFH days a week.'},
      {k: 'holidays', done: (s.holidays || []).length > 0, title: 'Add holidays',
        sub: 'Nobody gets flagged on a holiday.'},
      {k: 'team', done: ctx.activeMembers.length > 1 && !reqs, title: reqs ? 'Let your team in' : 'Invite your team',
        sub: reqs ? reqs + (reqs === 1 ? ' person is' : ' people are') + ' waiting to join.' : 'Share the page, send the link, approve each request in one tap.'},
      {k: 'client', done: clients > 0, title: 'Add your first client', sub: 'Projects, tasks and pitches hang off clients.'},
      {k: 'hello', done: posted, title: 'Say hello on the feed', sub: 'Your first post sets the tone for the team.'}
    ];
  }

  function Step({st, children}) {
    return html`<div class=${'setup-step' + (st.done ? ' done' : '')} id=${'setup-' + st.k}>
      <span class="setup-tick" aria-hidden="true">${st.done ? '✓' : ''}</span>
      <div class="grow" style=${{minWidth: 0}}>
        <div style=${{fontWeight: 500}}>${st.title}</div>
        <div class="small ink62">${st.sub}</div>
        ${!st.done && children ? html`<div class="row" style=${{marginTop: '10px'}}>${children}</div>` : null}
      </div>
    </div>`;
  }

  function SetupCard() {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState('');
    const [open, setOpen] = useState(true);
    if (!ctx.isFounder) return null;
    const list = steps(ctx);
    const left = list.filter(x => !x.done).length;
    const setup = ctx.settings.setup || {};
    if (!left || setup.dismissed) return null;

    const merge = (d, msg) => ctx.W.merge('settings/app', {...d, updated: Date.now()}).then(() => msg && M.toast(msg)).catch(() => {});
    async function pin() {
      setBusy('office');
      const loc = await M.getLoc();
      setBusy('');
      if (!loc) return M.toast('Location unavailable. Set it in Admin instead.', true);
      merge({office: {lat: loc.lat, lng: loc.lng, radius: 200, label: 'Office'}}, 'Office pinned');
    }
    const hol = fixedHolidays(ctx.now);
    const addHolidays = () => merge({holidays: Array.from(new Set((ctx.settings.holidays || []).concat(hol.map(h => h.d)))).sort()},
      hol.length + ' holidays added');
    const copyInvite = async () => {
      try { await navigator.clipboard.writeText('You are on m360 OS, the Mask360 workspace. Open ' + M.APP_URL + ', sign in to Claude, tap Ask to join and you are in once Kaavish lets you in.'); M.toast('Invite copied'); }
      catch (e) { M.nav('#admin'); }
    };

    const act = {
      office: html`<${UI.Btn} sm=${true} onClick=${pin} disabled=${busy === 'office'}>${busy === 'office' ? 'Finding you' : "I'm at the office, pin it"}<//>
        <${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.intend('#admin', 'settings')}>Enter it by hand<//>`,
      hours: html`<${UI.Btn} sm=${true} onClick=${() => merge({setup: {hours: true}}, 'Hours confirmed')}>Looks right<//>
        <${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.intend('#admin', 'settings')}>Change<//>`,
      holidays: html`<${UI.Btn} sm=${true} onClick=${addHolidays}>Add ${hol.length} national holidays<//>
        <span class="tiny ink62">${hol.map(h => h.name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}. Add Diwali, Holi and others in Admin.</span>`,
      team: list[3].title === 'Let your team in'
        ? html`<${UI.Btn} sm=${true} onClick=${() => M.nav('#admin')}>Review requests<//>`
        : html`<${UI.Btn} sm=${true} onClick=${copyInvite}>Copy invite message<//>
          <${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#admin')}>How it works<//>`,
      client: html`<${UI.Btn} sm=${true} onClick=${() => M.intend('#clients', 'client')}>Add a client<//>`,
      hello: html`<${UI.Btn} sm=${true} onClick=${() => M.intend('#feed', 'post')}>Write a post<//>`
    };

    const done = list.length - left;
    return html`<section class="card setup" id="setup-card">
      <div class="card-head">
        <div>
          <h2 class="card-title">Get m360 ready</h2>
          <div class="small ink62 num">${done} of ${list.length} done</div>
        </div>
        <div class="row nowrap">
          <button type="button" class="linky small" onClick=${() => setOpen(!open)}>${open ? 'Hide steps' : 'Show steps'}</button>
          <${UI.ConfirmBtn} kind="ghost" onConfirm=${() => merge({setup: {dismissed: true}})} label="Tap again to hide for good">Done for now<//>
        </div>
      </div>
      <${UI.Bar} a=${done} max=${list.length}/>
      ${open ? html`<div class="setup-list">
        ${list.map(st => html`<${Step} key=${st.k} st=${st}>${act[st.k]}<//>`)}
      </div>` : null}
    </section>`;
  }

  M.setup = {steps, fixedHolidays};
  M.parts.SetupCard = SetupCard;
})();
