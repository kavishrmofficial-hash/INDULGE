/* module: desk (BRIEF section 11, Desk). Roster, settings, keeper test, leave, export, cleanup. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;

  const TABS = [{v: 'roster', label: 'Roster'}, {v: 'settings', label: 'Settings'},
    {v: 'keeper', label: 'Keeper test'}, {v: 'leave', label: 'Leave'},
    {v: 'export', label: 'Export'}, {v: 'cleanup', label: 'Cleanup'}];
  const ROLES = [{v: 'member', label: 'Member'}, {v: 'lead', label: 'Pod lead'}];
  const YN = [{v: 'yes', label: 'Yes'}, {v: 'no', label: 'No'}];
  const KEEPER_LINE = 'A no ends it quickly. Documented, paid in full, neutral relieving letter.';
  const THRESHOLDS = [
    {k: 'start', label: 'start time', type: 'time'},
    {k: 'grace', label: 'grace minutes', type: 'number'},
    {k: 'eodCut', label: 'eod cutoff', type: 'time'},
    {k: 'mondayCut', label: 'monday cutoff', type: 'time'},
    {k: 'wfhCap', label: 'wfh cap', type: 'number'},
    {k: 'revCap', label: 'revision cap', type: 'number'},
    {k: 'ackHours', label: 'handbook read window, hours', type: 'number'},
    {k: 'blockerDays', label: 'blocker days', type: 'number'}
  ];
  const POINT_LABELS = {
    checkinOnTime: 'on-time check-in', eod: 'eod line', planOnTime: 'monday outcomes on time',
    planLate: 'monday outcomes late', outcomeHit: 'outcome hit', outcomeMiss: 'outcome miss',
    taskOnTime: 'task on time', taskLate: 'task late', revision: 'revision', shown20: '20% shown',
    qualityMult: 'quality multiplier', kudos: 'kudos received', rockDone: 'rock done', overdueOpen: 'overdue open task'
  };

  /* ---------- roster ---------- */
  function AddDrawer({person, member, onClose}) {
    const ctx = M.useCtx();
    const [f, setF] = useState(() => ({
      title: (member && member.title) || '', pod: (member && member.pod) || '',
      role: (member && member.role === 'lead') ? 'lead' : 'member',
      joined: (member && member.joined) || U.todayStr(),
      start: (member && member.start) || '', probationEnd: (member && member.probationEnd) || ''
    }));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    async function save() {
      const roster = ctx.roster || {members: {}, nextEmp: 2};
      const existing = roster.members[person.id];
      const empId = (existing && existing.empId) || ('M360-' + String(roster.nextEmp || 2).padStart(3, '0'));
      const body = {role: f.role, empId, title: f.title, pod: f.pod, joined: f.joined,
        start: f.start, probationEnd: f.probationEnd, active: true};
      const patch = {members: {[person.id]: body}, updated: Date.now()};
      if (!existing) patch.nextEmp = (roster.nextEmp || 2) + 1;
      await ctx.W.merge('roster/team', patch);
      M.toast(existing ? 'Saved' : 'Added, ' + empId);
      onClose();
    }
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${member ? 'Edit person' : 'Add to roster'}
      footer=${html`<${UI.Btn} onClick=${save}>${member ? 'Save' : 'Add to roster'}<//>`}>
      <div class="row"><${UI.Avatar} id=${person.id} size=${34}/>
        <span style=${{fontWeight: 500}}>${person.name || 'Someone'}</span></div>
      <${UI.Input} id="desk-title" label="title" value=${f.title} onChange=${v => set('title', v)}/>
      <${UI.Input} label="pod" value=${f.pod} onChange=${v => set('pod', v)}/>
      <${UI.Field} label="role"><${UI.Seg} options=${ROLES} value=${f.role} onChange=${v => set('role', v)} ariaLabel="Role"/><//>
      <${UI.Input} label="joined" type="date" value=${f.joined} onChange=${v => set('joined', v)}/>
      <${UI.Input} label="start time, optional" type="time" value=${f.start} onChange=${v => set('start', v)}/>
      <${UI.Input} label="probation end, optional" type="date" value=${f.probationEnd} onChange=${v => set('probationEnd', v)}/>
    <//>`;
  }

  function Roster() {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [hits, setHits] = useState([]);
    const [add, setAdd] = useState(null);
    const members = ctx.members || {};
    const search = async v => {
      setQ(v);
      if (!ctx.user || !ctx.user.search) return;
      const r = await ctx.user.search(v);
      setHits(r || []);
    };
    const rows = Object.keys(members).map(uid => ({uid, ...members[uid]}))
      .sort((a, b) => String(a.empId || '').localeCompare(String(b.empId || '')));
    const onlyFounder = rows.filter(r => r.active !== false).length <= 1;
    const setActive = (uid, active) => ctx.W.merge('roster/team', {members: {[uid]: {active}}, updated: Date.now()})
      .then(() => M.toast(active ? 'Restored' : 'Removed'));

    return html`<div class="stack" style=${{gap: '18px'}}>
      ${onlyFounder ? html`<${UI.Card} title="Getting the team on">
        <div class="stack tight">
          <div>1. Everyone needs a seat in your Claude organisation.</div>
          <div>2. Share this page with them, set to Can interact.</div>
          <div>3. Add them here.</div>
        </div>
      <//>` : null}

      <${UI.Card} title="Add a person">
        <${UI.Input} id="desk-search" label="search the organisation" value=${q} placeholder="Search the organisation"
          onChange=${search} onFocus=${() => search('')}/>
        <div class="stack tight" style=${{marginTop: '10px'}}>
          ${hits.filter(h => !members[h.id]).map(h => html`<div class="listrow" key=${h.id}>
            <${UI.Avatar} id=${h.id} size=${28}/>
            <span class="grow">${h.name || 'Someone'}</span>
            <${UI.Btn} sm=${true} onClick=${() => setAdd({person: h, member: null})}>Add<//>
          </div>`)}
          ${q && !hits.filter(h => !members[h.id]).length ? html`<${UI.Empty} text="Nobody new found."/>` : null}
        </div>
      <//>

      <${UI.Card} title="Roster">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>id</th><th>person</th><th>title</th><th>pod</th><th>role</th><th>status</th><th/></tr></thead>
          <tbody>
            ${rows.map(r => html`<tr key=${r.uid}>
              <td class="num tiny">${r.empId}</td>
              <td><span class="row nowrap"><${UI.Avatar} id=${r.uid} size=${24}/><${UI.Name} id=${r.uid}/></span></td>
              <td>${r.title || ''}</td><td>${r.pod || ''}</td>
              <td><${UI.Pill}>${r.role}<//></td>
              <td>${r.active === false ? html`<${UI.Pill} kind="warm">inactive<//>` : html`<${UI.Pill} kind="ink">active<//>`}</td>
              <td><span class="row nowrap">
                <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setAdd({person: {id: r.uid, name: ''}, member: r})}>Edit<//>
                ${r.uid === ctx.uid ? null : (r.active === false
                  ? html`<${UI.Btn} kind="sec" sm=${true} onClick=${() => setActive(r.uid, true)}>Restore<//>`
                  : html`<${UI.ConfirmBtn} onConfirm=${() => setActive(r.uid, false)}>Remove<//>`)}
              </span></td>
            </tr>`)}
          </tbody>
        </table></div>
      <//>
      ${add ? html`<${AddDrawer} person=${add.person} member=${add.member} onClose=${() => setAdd(null)}/>` : null}
    </div>`;
  }

  /* ---------- settings ---------- */
  function Settings() {
    const ctx = M.useCtx();
    const s = ctx.settings;
    const [f, setF] = useState(() => ({
      lat: s.office ? String(s.office.lat) : '', lng: s.office ? String(s.office.lng) : '',
      label: s.office ? s.office.label : '', radius: s.office ? String(s.office.radius || 200) : '200',
      start: s.start, grace: String(s.grace), eodCut: s.eodCut, mondayCut: s.mondayCut,
      wfhCap: String(s.wfhCap), revCap: String(s.revCap), ackHours: String(s.ackHours), blockerDays: String(s.blockerDays),
      holidays: (s.holidays || []).slice(), rules: {...s.rules}, points: {...s.points},
      leaderboardIncludesFounder: !!s.leaderboardIncludesFounder, newHoliday: ''
    }));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const names = (M.rules && M.rules.NAMES) || {};

    async function useHere() {
      const loc = await M.getLoc();
      if (!loc) return M.toast('Location unavailable', true);
      setF(x => ({...x, lat: String(loc.lat), lng: String(loc.lng)}));
      M.toast('Office set');
    }
    async function save() {
      const office = (f.lat !== '' && f.lng !== '')
        ? {lat: Number(f.lat), lng: Number(f.lng), radius: Number(f.radius) || 200, label: f.label || 'Office'}
        : null;
      const points = {};
      Object.keys(f.points).forEach(k => { points[k] = Number(f.points[k]) || 0; });
      await ctx.W.set('settings/app', {
        office, start: f.start, grace: Number(f.grace) || 0, eodCut: f.eodCut, mondayCut: f.mondayCut,
        wfhCap: Number(f.wfhCap) || 0, revCap: Number(f.revCap) || 0, ackHours: Number(f.ackHours) || 0,
        blockerDays: Number(f.blockerDays) || 0, holidays: f.holidays, rules: f.rules, points,
        leaderboardIncludesFounder: f.leaderboardIncludesFounder, updated: Date.now()
      });
      M.toast('Settings saved');
    }

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.Card} title="Office location">
        <div class="row" style=${{marginBottom: '12px'}}>
          <${UI.Btn} kind="sec" sm=${true} onClick=${useHere}>Set office to where I am now<//>
        </div>
        <div class="grid2">
          <${UI.Input} label="label" value=${f.label} onChange=${v => set('label', v)}/>
          <${UI.Input} label="radius, metres" type="number" value=${f.radius} onChange=${v => set('radius', v)}/>
          <${UI.Input} id="office-lat" label="latitude" value=${f.lat} onChange=${v => set('lat', v)}/>
          <${UI.Input} id="office-lng" label="longitude" value=${f.lng} onChange=${v => set('lng', v)}/>
        </div>
      <//>

      <${UI.Card} title="Thresholds">
        <div class="grid2">
          ${THRESHOLDS.map(t => html`<${UI.Input} key=${t.k} label=${t.label} type=${t.type}
            value=${f[t.k]} onChange=${v => set(t.k, v)}/>`)}
        </div>
      <//>

      <${UI.Card} title="Holidays">
        <div class="row">
          <input class="input" type="date" style=${{maxWidth: '200px'}} value=${f.newHoliday}
            aria-label="Holiday date" onInput=${e => set('newHoliday', e.target.value)}/>
          <${UI.Btn} kind="sec" sm=${true} disabled=${!f.newHoliday}
            onClick=${() => setF(x => ({...x, holidays: x.holidays.indexOf(x.newHoliday) >= 0 ? x.holidays : x.holidays.concat([x.newHoliday]).sort(), newHoliday: ''}))}>Add holiday<//>
        </div>
        <div class="stack tight" style=${{marginTop: '10px'}}>
          ${f.holidays.length ? f.holidays.map(d => html`<div class="listrow" key=${d}>
            <span class="grow num">${U.fmtDate(d)}</span>
            <button type="button" class="iconbtn" aria-label="Remove holiday"
              onClick=${() => setF(x => ({...x, holidays: x.holidays.filter(h => h !== d)}))}><${icons.x}/></button>
          </div>`) : html`<${UI.Empty} text="No holidays set."/>`}
        </div>
      <//>

      <${UI.Card} title="Rule switches">
        <div class="grid2">
          ${M.RULE_IDS.map(id => html`<${UI.Check} key=${id} label=${id + ' ' + (names[id] || '')}
            checked=${f.rules[id] !== false}
            onChange=${v => setF(x => ({...x, rules: {...x.rules, [id]: v}}))}/>`)}
        </div>
      <//>

      <${UI.Card} title="Points weights">
        <div class="grid2">
          ${Object.keys(M.POINTS_DEFAULTS).map(k => html`<${UI.Input} key=${k} label=${POINT_LABELS[k] || k}
            type="number" value=${f.points[k]}
            onChange=${v => setF(x => ({...x, points: {...x.points, [k]: v}}))}/>`)}
        </div>
      <//>

      <${UI.Card} title="Leaderboard">
        <${UI.Check} label="Leaderboard includes the founder" checked=${f.leaderboardIncludesFounder}
          onChange=${v => set('leaderboardIncludesFounder', v)}/>
      <//>

      <div class="row"><${UI.Btn} onClick=${save}>Save settings<//></div>
    </div>`;
  }

  /* ---------- keeper test ---------- */
  function KeeperCard({uid}) {
    const ctx = M.useCtx();
    const monthId = U.monthId(new Date(ctx.now));
    const notes = ((ctx.priv.keeper && ctx.priv.keeper.data) || {}).notes || {};
    const saved = (notes[uid] || {})[monthId];
    const [f, setF] = useState(() => ({fight: (saved && saved.fight) || '', rehire: (saved && saved.rehire) || '', note: (saved && saved.note) || ''}));
    useEffect(() => {
      setF({fight: (saved && saved.fight) || '', rehire: (saved && saved.rehire) || '', note: (saved && saved.note) || ''});
    }, [uid, monthId, saved && saved.at]);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const aNo = f.fight === 'no' || f.rehire === 'no';
    return html`<${UI.Card} title=${html`<${UI.Name} id=${uid}/>`}
      action=${saved ? html`<${UI.Pill} kind="ink">done this month<//>` : null}>
      <div class="stack tight">
        <${UI.Field} label="would I fight to keep them?">
          <${UI.Seg} options=${YN} value=${f.fight} onChange=${v => set('fight', v)} ariaLabel="Fight to keep"/><//>
        <${UI.Field} label="knowing what I know now, would I hire them again?">
          <${UI.Seg} options=${YN} value=${f.rehire} onChange=${v => set('rehire', v)} ariaLabel="Hire again"/><//>
        ${aNo ? html`<div class="small flame-t">${KEEPER_LINE}</div>` : null}
        <${UI.Input} label="note" value=${f.note} onChange=${v => set('note', v)}/>
        <div class="row"><${UI.Btn} sm=${true} onClick=${() => ctx.W.merge('data/users/' + ctx.uid + '/keeper',
          {notes: {[uid]: {[monthId]: {fight: f.fight, rehire: f.rehire, note: f.note, at: Date.now()}}}})
          .then(() => M.toast('Saved'))}>Save keeper note<//></div>
      </div>
    <//>`;
  }

  function Keeper() {
    const ctx = M.useCtx();
    const others = ctx.activeMembers.filter(m => m.uid !== ctx.uid);
    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.Card}><p style=${{margin: 0}}>Private to you. The month is ${U.monthId(new Date(ctx.now))}.</p><//>
      ${others.length ? others.map(m => html`<${KeeperCard} key=${m.uid} uid=${m.uid}/>`)
        : html`<${UI.Card}><${UI.Empty} text="Nobody on the roster yet."/><//>`}
    </div>`;
  }

  /* ---------- export ---------- */
  const COLS = ['date', 'employee_id', 'name', 'status', 'in', 'out', 'late', 'place', 'verified', 'hours', 'on_leave', 'in_probation'];
  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  function Export() {
    const ctx = M.useCtx();
    const [month, setMonth] = useState(() => U.monthId(new Date(ctx.now)));
    const [busy, setBusy] = useState(false);
    if (!ctx.downloads) return html`<${UI.Card} title="Attendance export">
      <${UI.Empty} text="Downloads are unavailable here."/><//>`;

    async function run() {
      setBusy(true);
      try {
        const [y, mm] = month.split('-').map(Number);
        const first = new Date(y, mm - 1, 1), last = new Date(y, mm, 0);
        const uids = ctx.activeMembers.map(m => m.uid);
        const profs = (ctx.user && ctx.user.profiles) ? await ctx.user.profiles(uids) : {};
        const lines = [COLS.map(csvCell).join(',')];
        for (let d = new Date(first); d <= last; d = U.addDays(d, 1)) {
          const date = U.ymd(d);
          for (const m of ctx.activeMembers) {
            const a = (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, m.uid, date) : {status: 'none'};
            const prob = m.probationEnd && m.probationEnd >= date;
            lines.push([
              date, m.empId || '', (profs[m.uid] && profs[m.uid].name) || '', a.status,
              a.in ? U.hhmm(a.in) : '', a.out ? U.hhmm(a.out) : '', a.late ? 'yes' : 'no',
              a.place || '', a.verified ? 'yes' : 'no',
              a.hours ? (Math.round(a.hours / 36000) / 100).toFixed(2) : '',
              ctx.onLeave(m.uid, date) ? 'yes' : 'no', prob ? 'yes' : 'no'
            ].map(csvCell).join(','));
          }
        }
        const r = await ctx.downloads.save({filename: 'attendance-' + month + '.csv', data: lines.join('\n')});
        M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
      } catch (e) {
        M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
      }
      setBusy(false);
    }

    return html`<${UI.Card} title="Attendance export">
      <p class="small ink62" style=${{marginTop: 0}}>This is the payroll input for loss-of-pay days.</p>
      <div class="row">
        <input class="input" type="month" style=${{maxWidth: '200px'}} value=${month} aria-label="Month"
          onInput=${e => setMonth(e.target.value)}/>
        <${UI.Btn} onClick=${run} disabled=${busy}>Download attendance CSV<//>
      </div>
    <//>`;
  }

  /* ---------- cleanup ---------- */
  function Cleanup() {
    const ctx = M.useCtx();
    const now = ctx.now;
    const DAY = 86400000;
    const tasks = ctx.coll.tasks.map, pulse = ctx.coll.pulse.map, pitches = ctx.coll.pitches.map;
    const oldTasks = Object.keys(tasks).filter(id => tasks[id].status === 'done' && tasks[id].doneAt && (now - tasks[id].doneAt) > 60 * DAY);
    const oldPulse = Object.keys(pulse).filter(id => pulse[id].at && (now - pulse[id].at) > 26 * 7 * DAY);
    const oldPitches = Object.keys(pitches).filter(id => pitches[id].stage === 'lost' && (pitches[id].updated || pitches[id].created) && (now - (pitches[id].updated || pitches[id].created)) > 180 * DAY);
    const count = Object.keys(ctx.coll).reduce((n, k) => n + Object.keys(ctx.coll[k].map).length, 0)
      + (ctx.roster ? 1 : 0) + 1;

    const wipe = async (coll, ids) => {
      for (const id of ids) await ctx.W.del(coll + '/' + id);
      M.toast('Deleted ' + ids.length + (ids.length === 1 ? ' document' : ' documents'));
    };

    return html`<${UI.Card} title="Cleanup">
      <p class="small ink62" style=${{marginTop: 0}}>
        <span class="num">${count}</span> of 5,000 documents.</p>
      <div class="stack tight">
        <div class="listrow"><span class="grow">Done tasks older than 60 days <span class="num ink62">${oldTasks.length}</span></span>
          <${UI.ConfirmBtn} kind="sec" onConfirm=${() => wipe('tasks', oldTasks)}>Delete<//></div>
        <div class="listrow"><span class="grow">Pulse responses older than 26 weeks <span class="num ink62">${oldPulse.length}</span></span>
          <${UI.ConfirmBtn} kind="sec" onConfirm=${() => wipe('pulse', oldPulse)}>Delete<//></div>
        <div class="listrow"><span class="grow">Lost pitches older than 180 days <span class="num ink62">${oldPitches.length}</span></span>
          <${UI.ConfirmBtn} kind="sec" onConfirm=${() => wipe('pitches', oldPitches)}>Delete<//></div>
      </div>
    <//>`;
  }

  /* ---------- page ---------- */
  function Desk() {
    const [tab, setTab] = useState('roster');
    const Approvals = M.parts.LeaveApprovals;
    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="founder controls" title="Desk">
        <${UI.Seg} options=${TABS} value=${tab} onChange=${setTab} ariaLabel="Desk section"/>
      <//>
      ${tab === 'roster' ? html`<${Roster}/>` : null}
      ${tab === 'settings' ? html`<${Settings}/>` : null}
      ${tab === 'keeper' ? html`<${Keeper}/>` : null}
      ${tab === 'leave' ? (Approvals ? html`<${Approvals}/>` : null) : null}
      ${tab === 'export' ? html`<${Export}/>` : null}
      ${tab === 'cleanup' ? html`<${Cleanup}/>` : null}
    </div>`;
  }

  M.pages.Desk = Desk;
})();
