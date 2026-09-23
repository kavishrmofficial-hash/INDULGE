/* module: safety (standalone only). Admin > Controls > Backups, for the founder: the daily backups the
   server keeps for 45 days (download a day, restore a collection from it), the trash where every
   deleted document waits for 30 days, a health line from the integrity check, and a full download. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect} = React;
  if (!window.M360_STANDALONE) return;
  const api = window.M360_API;

  const MODES = [{v: 'missing', label: 'Only add what is missing'}, {v: 'overwrite', label: 'Overwrite'}];
  const fmtBytes = n => { n = Number(n) || 0; return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 102.4) / 10 + ' KB' : Math.round(n / 104857.6) / 10 + ' MB'; };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const oops = e => M.toast((e && e.message) || 'That did not work. Try again in a moment.', true);

  /* a JSON file to the person: the downloads capability, or a plain link when it is missing */
  async function download(ctx, filename, obj) {
    const data = JSON.stringify(obj, null, 2);
    try {
      if (ctx.downloads && ctx.downloads.save) {
        const r = await ctx.downloads.save({filename, data});
        M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
        return;
      }
      const url = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      M.toast('Downloaded');
    } catch (e) { M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true); }
  }
  /* a whole day, or one file per collection when the day is over the 4 MB the server sends at once */
  async function downloadDay(ctx, ymd) {
    const r = await api('backupget', {ymd});
    if (!r.tooBig) return download(ctx, 'm360-backup-' + ymd + '.json', r);
    M.toast('That day is large, so it comes as one file per collection.');
    for (const coll of Object.keys(r.colls || {})) {
      const part = await api('backupget', {ymd, coll});
      if (part.tooBig) { M.toast(coll + ' is over 4 MB and cannot be downloaded from here.', true); continue; }
      await download(ctx, 'm360-backup-' + ymd + '-' + coll.split('/').join('-') + '.json', part);
    }
  }
  async function downloadAll(ctx) {
    const r = await api('snapshotall');
    const stamp = U.todayStr();
    if (!r.tooBig) return download(ctx, 'm360-everything-' + stamp + '.json', r);
    M.toast('The workspace is large, so it comes as one file per collection.');
    for (const coll of Object.keys(r.colls || {})) {
      const part = await api('snapshotall', {coll});
      if (part.tooBig) { M.toast(coll + ' is over 4 MB and cannot be downloaded from here.', true); continue; }
      await download(ctx, 'm360-everything-' + stamp + '-' + coll.split('/').join('-') + '.json', part);
    }
  }

  /* ---------- status: last backup, health, back up now ---------- */
  function StatusCard({info, onRefresh}) {
    const [health, setHealth] = useState(null);
    const [busy, setBusy] = useState('');
    const check = () => { setBusy('check'); setHealth(null); return api('integrity').then(setHealth, () => setHealth({failed: true})).finally(() => setBusy('')); };
    useEffect(() => { check(); }, []);
    async function backupNow() {
      setBusy('backup');
      try {
        const r = await api('backup', {force: true});
        M.toast(r.skipped ? 'A backup is already running. Look again in a minute.' : 'Backed up ' + plural(Object.keys(r.colls || {}).length, 'collection', 'collections'));
        onRefresh();
      } catch (e) { oops(e); }
      setBusy('');
    }
    let line = null;
    if (health && !health.failed) {
      const n = Object.keys(health.colls || {}).length;
      const problems = [];
      if (health.bad && health.bad.length) problems.push(plural(health.bad.length, 'document cannot be read', 'documents cannot be read') + ': ' + health.bad.map(k => k.slice(2).split('~').join('/')).join(', '));
      if (health.orphans && health.orphans.sessions) problems.push(plural(health.orphans.sessions, 'session belongs', 'sessions belong') + ' to nobody on record');
      const caches = health.caches && health.caches.stale.length ? plural(health.caches.stale.length, 'read cache was', 'read caches were') + ' out of step and rebuilt: ' + health.caches.stale.join(', ') + '.' : '';
      line = html`<div id="bk-health" class=${'small' + (problems.length ? ' flame-t' : '')}>
        ${plural(health.docs || 0, 'document', 'documents')} in ${plural(n, 'collection', 'collections')}${problems.length ? '. ' + problems.join('. ') + '.' : ', all readable.'}
        ${caches ? html` <span class="ink62">${caches}</span>` : null}
      </div>`;
    } else if (health && health.failed) line = html`<div id="bk-health" class="small flame-t">The health check could not run. Try again in a moment.</div>`;
    else line = html`<div id="bk-health" class="small ink62">Checking every document.</div>`;
    const stale = !!(health && health.caches && health.caches.stale.length);
    return html`<${UI.Card} id="bk-status" title="Backups"
      action=${info && info.lastError ? html`<${UI.Pill} kind="flame-o">last run failed<//>` : info && info.last ? html`<${UI.Pill} kind="ink">daily<//>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>Once a day the server copies every document into a backup and keeps ${info ? info.keepDays : 45} days of them. Deleted documents wait in the trash for ${info ? info.trashDays : 30} days.</p>
      <div class="bk-kpis">
        <div class="kpi"><span class="v num" id="bk-last">${info == null ? 'loading' : info.last ? U.timeAgo(info.last) : 'none yet'}</span><span class="l">last backup</span></div>
        <div class="kpi"><span class="v num">${info == null ? '' : info.days.length}</span><span class="l">days kept</span></div>
        <div class="kpi"><span class="v num">${health && !health.failed ? health.docs : ''}</span><span class="l">documents</span></div>
      </div>
      ${info && info.lastError ? html`<div class="small flame-t">The last automatic backup failed ${U.timeAgo(info.lastError.at)}: ${info.lastError.message}</div>` : null}
      ${line}
      <div class="row" style=${{marginTop: '12px'}}>
        <${UI.Btn} id="bk-now" sm=${true} disabled=${busy === 'backup'} onClick=${backupNow}>${busy === 'backup' ? 'Backing up' : 'Back up now'}<//>
        ${stale ? html`<${UI.Btn} id="bk-rebuild" kind="sec" sm=${true} disabled=${busy === 'check'} onClick=${check}>Rebuild caches<//>`
          : html`<${UI.Btn} kind="ghost" sm=${true} disabled=${busy === 'check'} onClick=${check}>Check again<//>`}
      </div>
    <//>`;
  }

  /* ---------- restore one collection from one day ---------- */
  function RestoreDrawer({day, onClose, onDone}) {
    const names = Object.keys(day.colls || {}).sort();
    const [coll, setColl] = useState(names[0] || '');
    const [mode, setMode] = useState('missing');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    async function run() {
      if (!coll || busy) return;
      setBusy(true); setResult(null);
      try {
        const r = await api('restorecoll', {ymd: day.ymd, coll, mode});
        setResult(r);
        M.toast(r.written ? 'Restored ' + plural(r.written, 'document', 'documents') : 'Nothing to restore');
        onDone();
      } catch (e) { oops(e); }
      setBusy(false);
    }
    const opts = names.map(n => ({v: n, label: n + ' (' + day.colls[n] + ')'}));
    const footer = mode === 'overwrite'
      ? html`<${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${run} label="Tap again to overwrite">${busy ? 'Restoring' : 'Overwrite from this backup'}<//>`
      : html`<${UI.Btn} id="bk-restore-run" disabled=${busy || !coll} onClick=${run}>${busy ? 'Restoring' : 'Add the missing documents'}<//>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${'Restore from ' + U.fmtDate(day.ymd)} footer=${footer}>
      <div class="stack" id="bk-restore-drawer">
        <p class="small ink62" style=${{margin: 0}}>Pick a collection from this day's backup. Adding what is missing touches nothing that exists now.</p>
        <${UI.Select} id="bk-restore-coll" label="collection" value=${coll} options=${opts} onChange=${setColl}/>
        <${UI.Field} label="how"><${UI.Seg} options=${MODES} value=${mode} onChange=${setMode} ariaLabel="Restore mode"/><//>
        ${mode === 'overwrite' ? html`<div class="small flame-t" id="bk-restore-warn">Every document in ${coll || 'this collection'} is replaced by the backed up copy. Each current one goes to the trash first, so it can be put back.</div>` : null}
        ${result ? html`<div class="small" id="bk-restore-result">
          <span class="num">${result.written}</span> written, <span class="num">${result.skipped}</span> skipped${result.trashed ? html`, <span class="num">${result.trashed}</span> moved to the trash` : null}.
        </div>` : null}
      </div>
    <//>`;
  }

  /* ---------- the list of days ---------- */
  function BackupList({info, onChanged}) {
    const ctx = M.useCtx();
    const [restore, setRestore] = useState(null);
    const [busy, setBusy] = useState('');
    const dl = async d => { setBusy(d.ymd); try { await downloadDay(ctx, d.ymd); } catch (e) { oops(e); } setBusy(''); };
    return html`<${UI.Card} title="Days">
      ${info == null ? html`<${UI.Empty} text="Loading the list."/>`
        : !info.days.length ? html`<${UI.Empty} text="No backups yet. The first one runs on its own today, or tap Back up now."/>`
        : html`<div class="stack tight" id="bk-list">${info.days.map(d => html`<div class="listrow bk-row" key=${d.ymd} id=${'bk-row-' + d.ymd}>
          <span class="grow">
            <span class="bk-day">${U.fmtDate(d.ymd)}</span>
            <div class="tiny ink62 num">${plural(Object.keys(d.colls).length, 'collection', 'collections')} · ${fmtBytes(d.bytes)} · ${d.at ? U.timeAgo(d.at) : ''}${d.bad ? ' · ' + plural(d.bad, 'unreadable document', 'unreadable documents') : ''}</div>
          </span>
          <span class="row nowrap">
            <${UI.Btn} kind="sec" sm=${true} disabled=${busy === d.ymd} onClick=${() => dl(d)}>Download<//>
            <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setRestore(d)}>Restore<//>
          </span>
        </div>`)}</div>`}
      ${restore ? html`<${RestoreDrawer} day=${restore} onClose=${() => setRestore(null)} onDone=${onChanged}/>` : null}
    <//>`;
  }

  /* ---------- the trash ---------- */
  function TrashCard({tick}) {
    const [items, setItems] = useState(null);
    const [conflict, setConflict] = useState('');
    const load = () => api('trash').then(r => setItems(r.items || []), () => setItems([]));
    useEffect(() => { load(); }, [tick]);
    async function putBack(it, force) {
      try {
        await api('restore', {id: it.id, force: !!force});
        M.toast('Put back ' + it.path);
        setConflict('');
        load();
      } catch (e) {
        if (e && e.status === 409) { setConflict(it.id); M.toast('Something is already at ' + it.path + '. Replace it, or leave both.', true); }
        else oops(e);
      }
    }
    async function empty() {
      try { const r = await api('emptytrash', {days: 30}); M.toast(r.removed ? 'Removed ' + plural(r.removed, 'entry', 'entries') : 'Nothing older than 30 days'); load(); }
      catch (e) { oops(e); }
    }
    return html`<${UI.Card} id="trash-card" title="Trash"
      action=${items && items.length ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${empty} label="Tap again to empty">Empty trash older than 30 days<//>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>Every deleted document lands here first and can be put back for 30 days.</p>
      ${items == null ? html`<${UI.Empty} text="Loading the trash."/>`
        : !items.length ? html`<${UI.Empty} text="The trash is empty."/>`
        : html`<div class="stack tight" id="trash-list">${items.map(it => html`<div class="listrow trash-row" key=${it.id} data-path=${it.path}>
          <span class="grow">
            <span class="num">${it.path}</span>
            <div class="tiny ink62">${it.by ? html`<${UI.Name} id=${it.by}/>` : 'the server'} · ${U.timeAgo(it.at)}</div>
          </span>
          ${conflict === it.id
            ? html`<${UI.ConfirmBtn} kind="flame" onConfirm=${() => putBack(it, true)} label="Tap again to replace">Replace the current one<//>`
            : html`<${UI.ConfirmBtn} kind="sec" onConfirm=${() => putBack(it, false)} label="Tap again to put back">Put back<//>`}
        </div>`)}</div>`}
    <//>`;
  }

  /* ---------- the tab ---------- */
  function BackupsTab() {
    const ctx = M.useCtx();
    const [info, setInfo] = useState(null);
    const [tick, setTick] = useState(0);
    const [busy, setBusy] = useState(false);
    const refresh = () => { api('backups').then(setInfo, () => setInfo({days: [], last: 0, lastError: null, keepDays: 45, trashDays: 30})); setTick(t => t + 1); };
    useEffect(() => { refresh(); }, []);
    if (!ctx.isFounder) return null;
    const all = async () => { setBusy(true); try { await downloadAll(ctx); } catch (e) { oops(e); } setBusy(false); };
    return html`<div class="stack" id="backups-tab" style=${{gap: '18px'}}>
      <${StatusCard} info=${info} onRefresh=${refresh}/>
      <${BackupList} info=${info} onChanged=${refresh}/>
      <${TrashCard} tick=${tick}/>
      <${UI.Card} title="A copy for your own drive">
        <p class="small ink62" style=${{marginTop: 0}}>One JSON file with every document as it is right now. Keep it somewhere safe, away from this server.</p>
        <div class="row"><${UI.Btn} id="bk-all" sm=${true} disabled=${busy} onClick=${all}>Download everything now<//></div>
      <//>
    </div>`;
  }

  M.deskTabs.push({v: 'backups', label: 'Backups', render: BackupsTab});
  M.parts.BackupsTab = BackupsTab;
})();
