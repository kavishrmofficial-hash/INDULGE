/* module: super. The founder's super controls on Admin > Controls > Super: lock the workspace,
   the join policy, an alert for everyone, view the app as someone else, fix anyone's attendance,
   offboard a person, export everything. Nothing here deletes data. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;

  const LOCK_OPTS = [{v: 'open', label: 'Open'}, {v: 'locked', label: 'Locked'}];
  const JOIN_OPTS = [{v: 'open', label: 'Anyone with the link can ask to join'}, {v: 'invite', label: 'Invite only'}];
  const MODE_OPTS = [{v: 'office', label: 'Office'}, {v: 'wfh', label: 'WFH'}];
  const NOTE_MAX = 200;
  const ALERT_MAX = 140;
  const FIX_DAYS = 60;

  /* the write layer already toasts a refusal; callers only need the happy path */
  const after = (p, msg) => p.then(() => { if (msg) M.toast(msg); }, () => {});
  const stamp = () => ({updated: Date.now()});

  /* active people with a display label each, for selects */
  function usePeople(ctx, includeMe) {
    const list = ctx.activeMembers.filter(m => includeMe || m.uid !== ctx.uid);
    const ps = M.useProfiles(list.map(m => m.uid));
    return list.map(m => ({...m, label: ((ps[m.uid] && ps[m.uid].name) || m.empId || 'Teammate') + (m.title ? ', ' + m.title : '')}));
  }

  /* open tasks owned by one person */
  function openTasksFor(ctx, uid) {
    const map = ctx.coll.tasks.map;
    return Object.keys(map).filter(id => map[id] && map[id].owner === uid && map[id].status !== 'done');
  }

  /* ---------- 1. lock the workspace ---------- */
  function LockCard() {
    const ctx = M.useCtx();
    const locked = !!ctx.settings.locked;
    const [note, setNote] = useState(() => String(ctx.settings.lockNote || ''));
    useEffect(() => { setNote(String(ctx.settings.lockNote || '')); }, [ctx.settings.lockNote]);
    const setLock = v => after(ctx.W.merge('settings/app', {locked: v === 'locked', ...stamp()}), v === 'locked' ? 'Locked' : 'Unlocked');
    const saveNote = () => after(ctx.W.merge('settings/app', {lockNote: note.trim().slice(0, ALERT_MAX), ...stamp()}), 'Note saved');
    return html`<${UI.Card} id="super-lock" title="Lock the workspace"
      action=${locked ? html`<${UI.Pill} kind="flame">locked<//>` : html`<${UI.Pill} kind="ink">open<//>`}>
      <p class="small ink62" style=${{marginTop: 0}}>While locked, everyone can look and only you can change anything. Members see a line at the top of every page.</p>
      <div class="stack tight">
        <${UI.Field} label="workspace">
          <${UI.Seg} options=${LOCK_OPTS} value=${locked ? 'locked' : 'open'} onChange=${setLock} ariaLabel="Workspace lock"/>
        <//>
        <${UI.Input} id="super-locknote" label="note shown with the lock, optional" value=${note} placeholder="Payroll run, back by 3pm"
          onChange=${v => setNote(v.slice(0, ALERT_MAX))} onEnter=${saveNote}/>
        <div class="row"><${UI.Btn} kind="sec" sm=${true} onClick=${saveNote}>Save note<//></div>
      </div>
    <//>`;
  }

  /* ---------- 2. join policy ---------- */
  function JoinCard() {
    const ctx = M.useCtx();
    const policy = ctx.settings.joinPolicy === 'invite' ? 'invite' : 'open';
    const setPolicy = v => after(ctx.W.merge('settings/app', {joinPolicy: v === 'invite' ? 'invite' : 'open', ...stamp()}),
      v === 'invite' ? 'Joining is by invite now' : 'Anyone with the link can ask to join');
    return html`<${UI.Card} id="super-join" title="Joining">
      <p class="small ink62" style=${{marginTop: 0}}>${policy === 'invite'
        ? 'People who open the link see that joining is by invite. Your invites still work.'
        : 'Anyone signed in can tap Ask to join. You let them in from the Team tab.'}</p>
      <${UI.Field} label="who can ask to join">
        <${UI.Seg} options=${JOIN_OPTS} value=${policy} onChange=${setPolicy} ariaLabel="Join policy"/>
      <//>
    <//>`;
  }

  /* ---------- 3. alert banner ---------- */
  function AlertCard() {
    const ctx = M.useCtx();
    const a = ctx.settings.alert;
    const today = U.todayStr();
    const live = !!(a && String(a.text || '').trim() && a.until && a.until >= today);
    const [text, setText] = useState(() => (a && a.text) || '');
    const [until, setUntil] = useState(() => (a && a.until && a.until >= today) ? a.until : today);
    const ok = !!text.trim() && !!until && until >= today;
    const show = () => {
      if (!ok) return;
      after(ctx.W.merge('settings/app', {alert: {text: text.trim().slice(0, ALERT_MAX), until, at: Date.now()}, ...stamp()}), 'Alert is up');
    };
    const clear = () => after(ctx.W.merge('settings/app', {alert: null, ...stamp()}), 'Alert cleared');
    return html`<${UI.Card} id="super-alert" title="Alert for everyone"
      action=${live ? html`<${UI.Pill} kind="flame-o">showing until ${U.fmtDate(a.until)}<//>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>One line above every page, for everyone, until the date. Each person can dismiss it for the day.</p>
      <div class="stack tight">
        <${UI.Input} id="super-alert-text" label=${'alert, ' + text.length + ' of ' + ALERT_MAX} value=${text} placeholder="Office shut on Friday for the shoot"
          onChange=${v => setText(v.slice(0, ALERT_MAX))}/>
        <${UI.Input} id="super-alert-until" label="show until" type="date" value=${until} min=${today} onChange=${setUntil}/>
        <div class="row">
          <${UI.Btn} sm=${true} disabled=${!ok} onClick=${show}>Show the alert<//>
          ${a ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${clear}>Clear<//>` : null}
        </div>
      </div>
    <//>`;
  }

  /* ---------- 4. view as ---------- */
  function ViewAsCard() {
    const ctx = M.useCtx();
    const people = usePeople(ctx, false);
    const opts = [{v: '', label: 'Pick a person'}].concat(people.map(m => ({v: m.uid, label: m.label})));
    return html`<${UI.Card} id="super-viewas" title="View as">
      <p class="small ink62" style=${{marginTop: 0}}>See m360 the way one person sees it. A bar at the top stays on until you exit, and nothing saves while you look.</p>
      <${UI.Select} id="super-viewas-who" label="see m360 as" value="" options=${opts}
        onChange=${v => { if (v) M.viewAs.set(v); }}/>
      ${!people.length ? html`<${UI.Empty} text="Nobody else on the roster yet."/>` : null}
    <//>`;
  }

  /* ---------- 5. fix attendance ---------- */
  const toMs = (date, hhmm) => U.parseYmd(date).getTime() + U.minutes(hhmm) * 60000;
  const dayLabel = e => e.mode === 'leave' ? 'marked leave' : e.mode === 'absent' ? 'marked absent' : e.mode === 'wfh' ? 'WFH' : e.mode === 'office' ? 'office' : 'cleared';

  function FixCard() {
    const ctx = M.useCtx();
    const people = usePeople(ctx, true);
    const today = U.todayStr();
    const minDate = U.ymd(U.addDays(new Date(), -FIX_DAYS));
    const [who, setWho] = useState('');
    const [date, setDate] = useState(today);
    const inRange = !!date && date >= minDate && date <= today;
    const entry = who && inRange ? (((ctx.coll.checkin.map[who] || {}).days || {})[date] || null) : null;
    const ds = who && inRange && M.att ? M.att.dayStatus(ctx, who, date) : null;
    const [f, setF] = useState({in: '', out: '', mode: 'office', note: ''});
    const eIn = entry && entry.in, eOut = entry && entry.out, eMode = entry && entry.mode;
    useEffect(() => {
      setF({in: eIn ? U.hhmm(eIn) : '', out: eOut ? U.hhmm(eOut) : '', mode: eMode === 'wfh' ? 'wfh' : 'office', note: ''});
    }, [who, date, eIn, eOut, eMode]);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const note = f.note.trim();
    const canAct = !!who && inRange && !!note;
    const outOk = !f.out || !f.in || U.minutes(f.out) > U.minutes(f.in);
    const canSave = canAct && !!f.in && outOk;

    const write = (day, msg) => after(ctx.W.merge('checkin/' + who, {days: {[date]: day}}), msg);
    const mark = () => ({fixedBy: ctx.uid, fixedAt: Date.now(), fixNote: note.slice(0, NOTE_MAX)});
    const saveTimes = () => {
      if (!canSave) return;
      write({in: toMs(date, f.in), out: f.out ? toMs(date, f.out) : null, mode: f.mode,
        loc: (entry && entry.loc) || null, outLoc: (entry && entry.outLoc) || null, ...mark()}, 'Day saved');
    };
    const markAs = (mode, msg) => () => { if (!canAct) return; write({in: null, out: null, mode, loc: null, outLoc: null, ...mark()}, msg); };

    const opts = [{v: '', label: 'Pick a person'}].concat(people.map(m => ({v: m.uid, label: m.label})));
    let record = null;
    if (who && inRange) {
      record = html`<div class="stack tight" id="super-fix-record">
        <div class="row">
          ${entry ? html`<${UI.Pill} kind=${entry.mode === 'office' || entry.mode === 'wfh' ? 'ink' : 'warm'}>${dayLabel(entry)}<//>` : html`<${UI.Pill}>no record<//>`}
          ${ds && (ds.status === 'leave' || ds.status === 'holiday' || ds.status === 'sunday') ? html`<${UI.Pill} kind="warm">${ds.status}<//>` : null}
          ${ds && ds.late ? html`<${UI.Pill} kind="flame">late<//>` : null}
          ${ds && ds.verified ? html`<${UI.Pill} kind="ink">verified<//>` : null}
        </div>
        <div class="super-day">
          <div class="kpi"><span class="v num">${eIn ? U.hhmm(eIn) : 'none'}</span><span class="l">in</span></div>
          <div class="kpi"><span class="v num">${eOut ? U.hhmm(eOut) : 'none'}</span><span class="l">out</span></div>
          <div class="kpi"><span class="v">${entry && entry.mode ? dayLabel(entry) : 'none'}</span><span class="l">mode</span></div>
          <div class="kpi"><span class="v num">${ds && ds.hours ? U.durText(ds.hours) : 'none'}</span><span class="l">hours</span></div>
        </div>
        ${entry && entry.fixedBy ? html`<div class="small ink62">Fixed by <${UI.Name} id=${entry.fixedBy}/>${entry.fixedAt ? ' on ' + U.fmtDate(U.ymd(new Date(entry.fixedAt))) : ''}${entry.fixNote ? ': ' + entry.fixNote : ''}</div>` : null}
      </div>`;
    }

    return html`<${UI.Card} id="super-fix" title="Fix attendance">
      <p class="small ink62" style=${{marginTop: 0}}>Pick a person and a day in the last ${FIX_DAYS} days. Late is worked out from the saved time, their start time and the grace minutes.</p>
      <div class="grid2">
        <${UI.Select} id="super-fix-who" label="person" value=${who} options=${opts} onChange=${setWho}/>
        <${UI.Input} id="super-fix-date" label="day" type="date" value=${date} min=${minDate} max=${today} onChange=${setDate}/>
      </div>
      ${who && !inRange ? html`<div class="small flame-t">Pick a day in the last ${FIX_DAYS} days.</div>` : null}
      ${record}
      ${who && inRange ? html`<div class="stack tight" style=${{marginTop: '12px'}}>
        <div class="grid2">
          <${UI.Input} id="super-fix-in" label="in" type="time" value=${f.in} onChange=${v => set('in', v)}/>
          <${UI.Input} id="super-fix-out" label="out, optional" type="time" value=${f.out} onChange=${v => set('out', v)}
            hint=${outOk ? '' : 'Out comes after in.'}/>
        </div>
        <${UI.Field} label="mode">
          <${UI.Seg} options=${MODE_OPTS} value=${f.mode} onChange=${v => set('mode', v)} ariaLabel="Mode"/>
        <//>
        <${UI.Input} id="super-fix-note" label=${'reason, ' + note.length + ' of ' + NOTE_MAX} value=${f.note} placeholder="Forgot to tap in, confirmed on WhatsApp"
          onChange=${v => set('note', v.slice(0, NOTE_MAX))}/>
        <div class="row">
          <${UI.Btn} sm=${true} disabled=${!canSave} onClick=${saveTimes}>Save the day<//>
          ${canAct ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${markAs('leave', 'Marked as leave')}>Mark leave<//>
            <${UI.ConfirmBtn} kind="sec" onConfirm=${markAs('absent', 'Marked as absent')}>Mark absent<//>
            <${UI.ConfirmBtn} onConfirm=${markAs(null, 'Day cleared')}>Clear the day<//>`
          : html`<span class="small ink62">A reason is needed before anything saves.</span>`}
        </div>
      </div>` : null}
    <//>`;
  }

  /* ---------- 6. offboard ---------- */
  function OffboardCard() {
    const ctx = M.useCtx();
    const people = usePeople(ctx, false);
    const [who, setWho] = useState('');
    const [busy, setBusy] = useState(false);
    const openIds = who ? openTasksFor(ctx, who) : [];
    const projIds = who ? Object.keys(ctx.coll.projects.map).filter(id => ((ctx.coll.projects.map[id] || {}).members || []).includes(who)) : [];
    const opts = [{v: '', label: 'Pick a person'}].concat(people.map(m => ({v: m.uid, label: m.label})));
    async function offboard() {
      if (!who || busy) return;
      setBusy(true);
      const gone = who;
      try {
        await ctx.W.merge('roster/team', {members: {[gone]: {active: false, left: U.todayStr()}}, ...stamp()});
        for (const id of projIds) {
          const ms = ((ctx.coll.projects.map[id] || {}).members || []).filter(u => u !== gone);
          await ctx.W.merge('projects/' + id, {members: ms});
        }
        if (window.M360_STANDALONE && typeof window.M360_API === 'function') {
          try { await window.M360_API('signoutall', {uid: gone}); } catch (e) { /* the sessions lapse on their own */ }
        }
        M.toast('Offboarded');
        setWho('');
      } catch (e) { /* the write layer toasts the failure */ }
      setBusy(false);
    }
    return html`<${UI.Card} id="super-offboard" title="Offboard">
      <p class="small ink62" style=${{marginTop: 0}}>Marks the person inactive from today, takes them off every project and signs them out everywhere. Their work stays.</p>
      <${UI.Select} id="super-off-who" label="person" value=${who} options=${opts} onChange=${setWho}/>
      ${who ? html`<div class="stack tight" style=${{marginTop: '12px'}}>
        <div class="row"><${UI.Avatar} id=${who} size=${32}/><span style=${{fontWeight: 500}}><${UI.Name} id=${who}/></span></div>
        <div class="small">
          <span class="num">${openIds.length}</span> ${openIds.length === 1 ? 'open task' : 'open tasks'} still assigned to them${openIds.length ? html`, <button type="button" class="linky" onClick=${() => M.nav('#tasks')}>see the tasks</button>` : null}.
          ${' '}On <span class="num">${projIds.length}</span> ${projIds.length === 1 ? 'project' : 'projects'}.
        </div>
        <div class="row"><${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${offboard}>Offboard<//></div>
      </div>` : null}
    <//>`;
  }

  /* ---------- 7. export everything ---------- */
  function ExportCard() {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    if (!ctx.downloads) return html`<${UI.Card} id="super-export" title="Export everything"><${UI.Empty} text="Downloads are unavailable here."/><//>`;
    const count = Object.keys(ctx.coll).reduce((n, k) => n + Object.keys(ctx.coll[k].map).length, 0);
    async function run() {
      setBusy(true);
      try {
        const out = {app: 'm360 OS', exported: new Date().toISOString(), roster: ctx.roster, settings: ctx.settings, collections: {}};
        for (const k of Object.keys(ctx.coll)) out.collections[k] = ctx.coll[k].map;
        const r = await ctx.downloads.save({filename: 'm360-everything-' + U.todayStr() + '.json', data: JSON.stringify(out, null, 2)});
        M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
      } catch (e) {
        M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
      }
      setBusy(false);
    }
    return html`<${UI.Card} id="super-export" title="Export everything">
      <p class="small ink62" style=${{marginTop: 0}}>One JSON file with every collection, the roster and the settings. <span class="num">${count}</span> documents right now. Ids only, no names.</p>
      <div class="row"><${UI.Btn} sm=${true} disabled=${busy} onClick=${run}>Download everything<//></div>
    <//>`;
  }

  /* ---------- 8. danger zone ---------- */
  function DangerZone() {
    return html`<div class="danger" id="super-danger">
      <${UI.Micro}>danger zone<//>
      <p class="small ink62" style=${{margin: '8px 0 0'}}>This tab never deletes anything. Done tasks older than 60 days, old pulse responses and lost pitches go from the Cleanup tab, and each delete asks you to tap twice.</p>
    </div>`;
  }

  /* ---------- the tab ---------- */
  function SuperTab() {
    const ctx = M.useCtx();
    if (!ctx.isFounder) return null;
    return html`<div class="stack" id="super-tab" style=${{gap: '18px'}}>
      <${LockCard}/>
      <${JoinCard}/>
      <${AlertCard}/>
      <${ViewAsCard}/>
      <${FixCard}/>
      <${OffboardCard}/>
      <${ExportCard}/>
      <${DangerZone}/>
    </div>`;
  }

  M.deskTabs.push({v: 'super', label: 'Super', render: SuperTab});
  M.superctl = {openTasksFor};
})();
