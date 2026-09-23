/* module: safety card. A small Safety card at the end of Admin > Controls > Super, on both builds.
   On claude.ai: the data lives in the artifact's database; download everything, or import a backup
   file (the Export everything shape, an EdgeOne day backup, or one collection) and add only what is
   missing. On the standalone build: the last backup time and a way into the Backups tab. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const COLL_OK = /^[A-Za-z0-9_\-.:@+]+(\/[A-Za-z0-9_\-.:@+]+)*$/;
  const ID_OK = /^[A-Za-z0-9_\-.:@+]+$/;
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /* the documents in a backup file, as {path: doc}. Understands the Export everything shape
     ({roster, settings, collections}), a day backup ({colls: {name: {docs}}}) and one collection ({coll, docs}). */
  function parseBackup(text) {
    const j = JSON.parse(text);
    if (!isObj(j)) throw new Error('not an object');
    const out = {};
    const add = (coll, id, doc) => { if (isObj(doc) && COLL_OK.test(coll) && ID_OK.test(id)) out[coll + '/' + id] = doc; };
    const addColl = (coll, docs) => { if (isObj(docs)) for (const id of Object.keys(docs)) add(coll, id, docs[id]); };
    if (isObj(j.collections)) for (const coll of Object.keys(j.collections)) addColl(coll, j.collections[coll]);
    if (isObj(j.roster)) add('roster', 'team', j.roster);
    if (isObj(j.settings)) add('settings', 'app', j.settings);
    if (isObj(j.colls)) for (const coll of Object.keys(j.colls)) addColl(coll, isObj(j.colls[coll]) ? j.colls[coll].docs : null);
    if (typeof j.coll === 'string' && isObj(j.docs)) addColl(j.coll, j.docs);
    return out;
  }
  const collOf = path => path.split('/').slice(0, -1).join('/');
  /* the log is the server's, and another person's private notes are theirs */
  const skip = (path, uid) => {
    const s = path.split('/');
    return s[0] === 'log' || (s[0] === 'data' && s[1] === 'users' && s[2] !== uid);
  };

  function ExportPart({ctx}) {
    const [busy, setBusy] = useState(false);
    const count = Object.keys(ctx.coll).reduce((n, k) => n + Object.keys(ctx.coll[k].map).length, 0);
    async function run() {
      setBusy(true);
      try {
        const out = {app: 'm360 OS', exported: new Date().toISOString(), roster: ctx.roster, settings: ctx.settings, collections: {}};
        for (const k of Object.keys(ctx.coll)) out.collections[k] = ctx.coll[k].map;
        const r = await ctx.downloads.save({filename: 'm360-everything-' + U.todayStr() + '.json', data: JSON.stringify(out, null, 2)});
        M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
      } catch (e) { M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true); }
      setBusy(false);
    }
    if (!ctx.downloads) return html`<${UI.Empty} text="Downloads are unavailable here."/>`;
    return html`<div class="row">
      <${UI.Btn} id="safety-export" sm=${true} disabled=${busy} onClick=${run}>Download everything<//>
      <span class="tiny ink62"><span class="num">${count}</span> ${count === 1 ? 'document' : 'documents'} right now. Ids only, no names.</span>
    </div>`;
  }

  function ImportPart({ctx}) {
    const [file, setFile] = useState(null);      /* {name, docs: {path: doc}, counts: {coll: n}, skipped} */
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const input = useRef(null);
    async function pick(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      setErr(''); setDone(null); setFile(null);
      try {
        const docs = parseBackup(await f.text());
        const counts = {};
        let skipped = 0;
        for (const p of Object.keys(docs)) {
          if (skip(p, ctx.uid)) { skipped++; delete docs[p]; continue; }
          counts[collOf(p)] = (counts[collOf(p)] || 0) + 1;
        }
        if (!Object.keys(docs).length) setErr('No documents found in that file.');
        else setFile({name: f.name, docs, counts, skipped});
      } catch (x) { setErr('That file could not be read as an m360 backup.'); }
      if (input.current) input.current.value = '';
    }
    async function run() {
      if (!file || busy) return;
      setBusy(true);
      let written = 0, present = 0, failed = 0;
      for (const path of Object.keys(file.docs).sort()) {
        try {
          const snap = await ctx.db.doc(path).get();
          if (snap && snap.exists) { present++; continue; }
          await ctx.W.set(path, file.docs[path]);
          written++;
        } catch (e) { failed++; }
      }
      setDone({written, present, failed});
      M.toast(written ? 'Added ' + plural(written, 'document', 'documents') : 'Nothing was missing');
      setBusy(false);
    }
    const colls = file ? Object.keys(file.counts).sort() : [];
    return html`<div class="stack tight" id="safety-import">
      <label class="btn sec sm safety-file">
        <input ref=${input} type="file" accept=".json,application/json" aria-label="Import a backup" onChange=${pick}/>
        Import a backup
      </label>
      ${err ? html`<div class="small flame-t">${err}</div>` : null}
      ${file ? html`<div class="small"><b>${file.name}</b>: ${plural(Object.keys(file.docs).length, 'document', 'documents')} in ${plural(colls.length, 'collection', 'collections')}${file.skipped ? ', ' + plural(file.skipped, 'entry', 'entries') + ' left out (the log and other people\'s private notes)' : ''}.</div>
        <div class="safety-counts num" id="safety-counts">${colls.map(c => html`<span key=${c}>${c} <b>${file.counts[c]}</b></span>`)}</div>
        <div class="small ink62">Only documents that do not exist here are added. Nothing is replaced.</div>
        <div class="row">
          <${UI.ConfirmBtn} kind="sec" onConfirm=${run} label="Tap again to add them">${busy ? 'Adding' : 'Add the missing documents'}<//>
          <${UI.Btn} kind="ghost" sm=${true} onClick=${() => { setFile(null); setDone(null); }}>Clear<//>
        </div>` : null}
      ${done ? html`<div class="small" id="safety-import-result"><span class="num">${done.written}</span> added, <span class="num">${done.present}</span> already here${done.failed ? html`, <span class="num">${done.failed}</span> refused` : null}.</div>` : null}
    </div>`;
  }

  /* the standalone build: the server backs up on its own; this card points at the tab */
  function StandalonePart() {
    const [info, setInfo] = useState(null);
    useEffect(() => { window.M360_API('backups').then(setInfo, () => setInfo({days: [], last: 0})); }, []);
    const openTab = () => {
      const tab = Array.from(document.querySelectorAll('.seg [role="tab"]')).find(b => b.textContent.trim() === 'Backups');
      if (tab) tab.click();
    };
    return html`<div class="stack tight">
      <div class="small">Last backup: <span class="num" id="safety-last">${info == null ? 'looking' : info.last ? U.timeAgo(info.last) : 'none yet'}</span>${info && info.days ? ' · ' + plural(info.days.length, 'day', 'days') + ' kept' : ''}</div>
      <div class="row"><${UI.Btn} id="safety-open" kind="sec" sm=${true} onClick=${openTab}>Open Backups<//></div>
    </div>`;
  }

  function SafetyCard() {
    const ctx = M.useCtx();
    if (!ctx.isFounder) return null;
    const standalone = !!window.M360_STANDALONE && typeof window.M360_API === 'function';
    return html`<${UI.Card} id="safety-card" title="Safety">
      <p class="small ink62" style=${{marginTop: 0}}>${standalone
        ? 'Once a day the server copies every document into a backup kept for 45 days, and every deleted document waits in the trash for 30 days. The Backups tab has the list, restore and the trash.'
        : 'Your data lives in this page\'s database on claude.ai. Download a full copy now and then and keep it somewhere safe; a copy can be imported here to add back anything that went missing.'}</p>
      ${standalone ? html`<${StandalonePart}/>` : html`<div class="stack"><${ExportPart} ctx=${ctx}/><${ImportPart} ctx=${ctx}/></div>`}
    <//>`;
  }

  /* at the end of the Super tab; M.adminCards would fold it under the Radar settings heading on phones */
  const superTab = (M.deskTabs || []).find(t => t.v === 'super');
  if (superTab) {
    const Inner = superTab.render;
    superTab.render = function SuperWithSafety() {
      const ctx = M.useCtx();
      return html`<${Inner}/>${ctx.isFounder ? html`<${SafetyCard}/>` : null}`;
    };
  } else M.adminCards.push(SafetyCard);
  M.parts.SafetyCard = SafetyCard;
  M.safety = {parseBackup};
})();
