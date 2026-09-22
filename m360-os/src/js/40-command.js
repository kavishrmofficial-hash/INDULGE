/* module: command (BRIEF section 11, Command). The founder's master dashboard. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const PROJ_PILL = {on: {k: 'ink', t: 'On track'}, risk: {k: 'flame-o', t: 'At risk'},
    off: {k: 'flame', t: 'Off track'}, done: {k: 'warm', t: 'Done'}};

  function Tile({label, value, to, flame}) {
    const inner = html`<span class="kpi">
      <span class=${'v num' + (flame ? ' flame-t' : '')}>${value}</span>
      <span class="l">${label}</span>
    </span>`;
    if (!to) return html`<div class="card">${inner}</div>`;
    return html`<button type="button" class="card rowbtn" style=${{cursor: 'pointer'}} onClick=${() => M.nav(to)}>${inner}</button>`;
  }

  /* the previous working day before `date`, Monday to Saturday, skipping holidays */
  function prevWorkingDay(ctx, date) {
    let d = U.addDays(U.parseYmd(date), -1);
    for (let i = 0; i < 14; i++) {
      const s = U.ymd(d);
      if (s !== date && d.getDay() !== 0 && !ctx.holidays.has(s)) return s;
      d = U.addDays(d, -1);
    }
    return U.ymd(d);
  }

  function Command() {
    const ctx = M.useCtx();
    const [rule, setRule] = useState('');
    const today = U.todayStr();
    const members = ctx.activeMembers;
    const att = uid => (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, uid, today) : {status: 'none'};

    const k = useMemo(() => {
      const rows = members.map(m => ({m, d: att(m.uid)}));
      const inToday = rows.filter(r => r.d.status === 'office' || r.d.status === 'wfh');
      const late = inToday.filter(r => r.d.late);
      const office = inToday.filter(r => r.d.status === 'office');
      const verified = office.filter(r => r.d.verified);
      const yday = prevWorkingDay(ctx, today);
      const eodY = members.filter(m => (((ctx.coll.eod.map[m.uid] || {}).days || {})[yday]));
      const eodDue = members.filter(m => ctx.isWorkingDay(yday, m.uid));
      const weekId = U.isoWeek(new Date(ctx.now));
      let hit = 0, planned = 0;
      members.forEach(m => {
        const plan = ((ctx.coll.plan.map[m.uid] || {}).weeks || {})[weekId];
        const rev = ((ctx.coll.review.map[m.uid] || {}).weeks || {})[weekId];
        planned += ((plan && plan.items) || []).length;
        const marks = (rev && rev.marks) || {};
        hit += Object.keys(marks).filter(x => marks[x] === 'hit').length;
      });
      const tasks = ctx.coll.tasks.map;
      const overdue = Object.keys(tasks).filter(id => tasks[id].status !== 'done' && tasks[id].due && tasks[id].due < today).length;
      const high = (ctx.flags || []).filter(f => f.severity === 'high').length;
      const pm = (M.pitches && M.pitches.metrics) ? M.pitches.metrics(ctx) : {weighted: 0, byStage: {}, winRate90: null, overdue: []};
      const sh = (M.clients && M.clients.shares) ? M.clients.shares(ctx) : [];
      const topShare = sh.reduce((n, r) => Math.max(n, r.share || 0), 0);
      const energy = (M.voice && M.voice.energyByWeek) ? M.voice.energyByWeek(ctx, 8) : [];
      const lastEnergy = energy.slice().reverse().find(e => e && e.avg != null);
      return {rows, inToday, late, office, verified, eodY, eodDue, hit, planned, overdue, high, pm, sh, topShare, energy, lastEnergy, yday};
    }, [ctx, members]);

    const names = (M.rules && M.rules.NAMES) || {};
    const flags = (ctx.flags || []).filter(f => !rule || f.rule === rule);
    const groups = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
    const board = (M.points && M.points.leaderboard) ? M.points.leaderboard(ctx, 'week', new Date(ctx.now)).slice(0, 5) : [];
    const projects = ctx.coll.projects.map;
    const projList = Object.keys(projects).map(id => ({id, ...projects[id]})).filter(p => !p.archived && p.status !== 'done');
    const health = {on: 0, risk: 0, off: 0};
    projList.forEach(p => { if (health[p.status] != null) health[p.status]++; });
    const atRisk = projList.filter(p => p.status === 'risk' || p.status === 'off');
    const panel = (M.hiring && M.hiring.panel) ? M.hiring.panel(ctx) : [];
    const Approvals = M.parts.LeaveApprovals;
    const monthId = U.monthId(new Date(ctx.now));
    const keeper = ((ctx.priv.keeper && ctx.priv.keeper.data) || {}).notes || {};
    const clientsMap = ctx.coll.clients.map;
    const latest = (M.voice && M.voice.latest) ? M.voice.latest(ctx, 2) : [];
    const full = {gridColumn: '1 / -1'};

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro=${U.dateLabel(new Date(ctx.now))} title="Command"/>

      <div class="kpi-rail">
        <${Tile} label="in today" value=${k.inToday.length + ' of ' + members.length} to="#week"/>
        <${Tile} label="late today" value=${k.late.length} flame=${k.late.length > 0} to="#week"/>
        <${Tile} label="office verified" value=${k.office.length ? U.pct(k.verified.length, k.office.length) + '%' : 'n/a'}/>
        <${Tile} label="eod yesterday" value=${k.eodY.length + ' of ' + k.eodDue.length} to="#week"/>
        <${Tile} label="outcomes hit this week" value=${k.hit + ' of ' + k.planned} to="#week"/>
      </div>
      <div class="kpi-rail">
        <${Tile} label="tasks overdue" value=${k.overdue} flame=${k.overdue > 0} to="#tasks"/>
        <${Tile} label="high flags" value=${k.high} flame=${k.high > 0}/>
        <${Tile} label="weighted pipeline" value=${U.inr(k.pm.weighted)} to="#pitches"/>
        <${Tile} label="largest client share" value=${k.topShare + '%'} to="#clients"/>
        <${Tile} label="team energy" value=${k.lastEnergy ? k.lastEnergy.avg.toFixed(1) : 'n/a'}
          flame=${!!(k.lastEnergy && k.lastEnergy.avg < 3)} to="#voice"/>
      </div>

      <div class="grid2">
        <div style=${full}><${UI.Card} title="Attendance today" id="attendance">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>id</th><th>person</th><th>status</th><th>in</th><th>place</th><th>out</th><th>hours</th><th>map</th></tr></thead>
            <tbody>
              ${k.rows.map(({m, d}) => html`<tr key=${m.uid}>
                <td class="num tiny">${m.empId || ''}</td>
                <td><span class="row nowrap"><${UI.Avatar} id=${m.uid} size=${24}/><${UI.Name} id=${m.uid}/></span></td>
                <td>${d.status === 'none' ? 'not in yet' : d.status}</td>
                <td class=${'num' + (d.late ? ' flame-t' : '')}>${d.in ? U.hhmm(d.in) : ''}</td>
                <td><span class="row nowrap">${d.place || ''}${d.verified ? html`<${UI.Pill} kind="ink">verified<//>` : null}</span></td>
                <td class="num">${d.out ? U.hhmm(d.out) : ''}</td>
                <td class="num">${d.hours ? U.durText(d.hours) : ''}</td>
                <td>${d.loc && d.loc.lat != null ? html`<a class="linky" target="_blank" rel="noopener"
                  href=${'https://www.google.com/maps?q=' + d.loc.lat + ',' + d.loc.lng}>map</a>` : ''}</td>
              </tr>`)}
            </tbody>
          </table></div>
          ${k.rows.length ? null : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
        <//></div>

        <div style=${full}><${UI.Card} title="Flags"
          action=${html`<select class="input" style=${{width: 'auto', maxWidth: '100%', minWidth: 0, minHeight: '34px'}} value=${rule}
            onChange=${e => setRule(e.target.value)} aria-label="Rule filter">
            <option value="">All rules</option>
            ${Object.keys(names).map(id => html`<option key=${id} value=${id}>${id}</option>`)}
          </select>`}>
          ${flags.length ? groups.map(([sev, label]) => {
            const list = flags.filter(f => f.severity === sev);
            if (!list.length) return null;
            return html`<div key=${sev} style=${{marginBottom: '12px'}}>
              <${UI.Micro}>${label.toLowerCase()}<//>
              <div class="stack tight" style=${{marginTop: '8px'}}>
                ${list.map((f, i) => html`<div class="listrow" key=${f.rule + f.uid + i}>
                  <${UI.Avatar} id=${f.uid} size=${24}/>
                  <div class="grow" style=${{minWidth: 0}}>
                    <div class="small"><span style=${{fontWeight: 500}}><${UI.Name} id=${f.uid}/></span>
                      <span class="ink62"> ${names[f.rule] || f.rule}</span></div>
                    <div class="small ink62">${f.text}</div>
                  </div>
                </div>`)}
              </div>
            </div>`;
          }) : html`<${UI.Empty} text="All clear."/>`}
        <//></div>

        <${UI.Card} title="Leaderboard" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#scores')}>Scores<//>`}>
          ${board.length ? html`<div class="stack tight">
            ${board.map((r, i) => html`<div class="listrow" key=${r.uid}>
              <span class="num ink62" style=${{width: '18px'}}>${i + 1}</span>
              <${UI.Avatar} id=${r.uid} size=${24}/>
              <span class="grow"><${UI.Name} id=${r.uid}/></span>
              <span class="num" style=${{fontWeight: 500}}>${r.total}</span>
            </div>`)}
          </div>` : html`<${UI.Empty} text="No points yet."/>`}
        <//>

        <${UI.Card} title="Pipeline" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#pitches')}>Pitches<//>`}>
          <div class="tbl-wrap"><table class="tbl">
            <tbody>
              ${((M.pitches && M.pitches.STAGES) || []).map(s => {
                const b = (k.pm.byStage || {})[s.v] || {count: 0, value: 0};
                return html`<tr key=${s.v}><td>${s.label}</td>
                  <td class="num" style=${{textAlign: 'right'}}>${b.count}</td>
                  <td class="num" style=${{textAlign: 'right'}}>${U.inr(b.value)}</td></tr>`;
              })}
            </tbody>
          </table></div>
          <div class=${'small' + ((k.pm.overdue || []).length ? ' flame-t' : ' ink62')} style=${{marginTop: '10px'}}>
            ${(k.pm.overdue || []).length} next steps overdue</div>
        <//>

        <${UI.Card} title="Projects health" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#projects')}>Projects<//>`}>
          <div class="grid3">
            <div class="kpi"><span class="v num">${health.on}</span><span class="l">on track</span></div>
            <div class="kpi"><span class="v num">${health.risk}</span><span class="l">at risk</span></div>
            <div class="kpi"><span class="v num">${health.off}</span><span class="l">off track</span></div>
          </div>
          ${atRisk.length ? html`<div class="stack tight" style=${{marginTop: '12px'}}>
            ${atRisk.map(p => html`<div class="listrow" key=${p.id}>
              <span class="grow">${p.name}</span>
              <${UI.Pill} kind=${(PROJ_PILL[p.status] || {}).k}>${(PROJ_PILL[p.status] || {}).t || p.status}<//>
            </div>`)}
          </div>` : null}
        <//>

        <${UI.Card} title="People" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#people')}>People<//>`}>
          ${members.length ? html`<div class="stack tight">
            ${members.map(m => {
              const lad = (M.points && M.points.ladder) ? M.points.ladder(ctx, m.uid, new Date(ctx.now)) : {level: 'clear'};
              const kp = (keeper[m.uid] || {})[monthId];
              const newHire = (M.people && M.people.isNewHire) ? M.people.isNewHire(ctx, m.uid) : false;
              const prog = (M.people && M.people.onboardingProgress) ? M.people.onboardingProgress(ctx, m.uid) : null;
              const off = ((ctx.coll.access.map[m.uid] || {}).offboard);
              return html`<div class="listrow" key=${m.uid}>
                <${UI.Avatar} id=${m.uid} size=${24}/>
                <span class="grow"><${UI.Name} id=${m.uid}/></span>
                <${UI.Pill} kind=${lad.level === 'clear' ? 'ink' : (lad.level === 'note' ? 'flame-o' : 'flame')}>${lad.level}<//>
                ${m.uid === ctx.founderUid ? null : (kp ? html`<${UI.Pill} kind="ink">keeper done<//>` : html`<${UI.Pill} kind="flame-o">keeper due<//>`)}
                ${newHire && prog ? html`<${UI.Pill} kind="warm">${prog.done} of ${prog.total}<//>` : null}
                ${off ? html`<${UI.Pill} kind="flame">offboarding<//>` : null}
              </div>`;
            })}
          </div>` : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
        <//>

        <${UI.Card} title="Hiring" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#hiring')}>Hiring<//>`}>
          ${panel.length ? html`<div class="stack tight">
            ${panel.map(p => html`<div class="listrow" key=${p.id}>
              <span class="grow">${p.candidate}</span>
              <span class="num small">${p.submitted} of ${p.total} submitted</span>
            </div>`)}
          </div>` : html`<${UI.Empty} text="No candidates in panel."/>`}
        <//>

        <div style=${full}>${Approvals ? html`<${Approvals}/>` : null}</div>

        <${UI.Card} title="Voice" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#voice')}>Voice<//>`}>
          <div class="vbars">
            ${(k.energy || []).map(e => html`<div key=${e.week} class=${'vb' + (e.avg != null && e.avg < 3 ? ' low' : '')}
              style=${{height: (e.avg != null ? Math.max(8, Math.round(e.avg / 5 * 76)) : 6) + 'px'}}
              title=${e.week + (e.avg != null ? ', ' + e.avg.toFixed(1) : '')}/>`)}
          </div>
          <div class="stack tight" style=${{marginTop: '12px'}}>
            ${latest.length ? latest.map((r, i) => html`<div class="listrow" key=${i}>
              <${UI.Pill} kind=${r.energy < 3 ? 'flame' : null}>energy ${r.energy}<//>
              <span class="small grow">${r.change || r.broken || r.working || ''}</span>
            </div>`) : html`<${UI.Empty} text="No responses yet."/>`}
          </div>
        <//>

        <${UI.Card} title="Clients" action=${html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => M.nav('#clients')}>Clients<//>`}>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>client</th><th>monthly</th><th>share</th><th>open tasks</th><th>brain</th></tr></thead>
            <tbody>
              ${k.sh.map(r => {
                const c = clientsMap[r.id] || {};
                const comp = (M.clients && M.clients.completeness) ? M.clients.completeness(c) : {filled: 0, total: 3};
                const openN = (M.clients && M.clients.openTaskCount) ? M.clients.openTaskCount(ctx, r.id) : 0;
                return html`<tr key=${r.id}>
                  <td>${r.name}</td><td class="num">${U.inr(r.monthly)}</td>
                  <td class="num">${r.share}%</td><td class="num">${openN}</td>
                  <td class=${'num' + (comp.filled < comp.total ? ' flame-t' : '')}>${comp.filled} of ${comp.total}</td>
                </tr>`;
              })}
            </tbody>
          </table></div>
          ${k.sh.length ? null : html`<${UI.Empty} text="No clients yet."/>`}
        <//>
      </div>
    </div>`;
  }

  M.pages.Command = Command;
})();
