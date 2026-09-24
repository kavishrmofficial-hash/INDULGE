/* module: log. The activity log: every write the page makes lands in log/<YYYY-MM-DD>-<uid>
   (see M.logWrite in the core), the standalone server writes the same shape and adds sign-ins.
   The founder reads it from Admin > Controls > Log: a day range, a person, a kind, a search,
   CSV export and a prune. The collection is never subscribed for good, it is read on demand. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo} = React;

  const PAGE = 500;
  const PRUNE_DAYS = 90;
  const RANGES = [{v: '1', label: 'Today'}, {v: '7', label: '7 days'}, {v: '30', label: '30 days'}];
  const KINDS = [{v: 'writes', label: 'Writes'}, {v: 'signins', label: 'Sign-ins'}, {v: 'all', label: 'All'}];
  const SIGNIN = {login: 'signed in', logout: 'signed out', signup: 'asked to join', accept: 'joined by invite', setup: 'set the workspace up', link: 'made a sign-in link'};
  const VERB = {set: 'added', update: 'changed', delete: 'removed', merge: 'changed', prune: 'pruned', ...SIGNIN};
  const TARGET = {
    tasks: 'task', projects: 'project', clients: 'client', pitches: 'pitch', candidates: 'candidate', handbook: 'handbook section',
    checkin: 'check-in', eod: 'EOD line', plan: 'monday outcomes', review: 'weekly review', rocks: 'rocks', feed: 'feed post',
    reacts: 'reaction', acks: 'handbook read', kudos: 'kudos', leave: 'leave request', leavedec: 'leave decision',
    evals: 'evaluation', pulse: 'pulse response', ideas: 'idea', votes: 'vote', access: 'access register', onboard: 'onboarding',
    me: 'profile', join: 'join request', fixes: 'correction request', roster: 'roster', settings: 'settings',
    data: 'private note', log: 'log', invites: 'invite', sessions: 'session'
  };
  const TITLED = {tasks: 'title', projects: 'name', clients: 'name', pitches: 'brand', candidates: 'name', handbook: 'title'};

  /* ---------- reading: subscribe once, resolve, unsubscribe ---------- */
  M.logs = M.logs || {};
  M.logs.read = M.logs.read || function read(ctx, range) {
    const from = (range && range.from) || '0000-00-00', to = (range && range.to) || '9999-12-31';
    /* one subscription per person on the roster (plus the viewer), each read once and released */
    const people = Array.from(new Set(Object.keys(ctx.members || {}).concat([ctx.uid]).filter(Boolean)));
    const one = uid => new Promise(res => {
      let un = null, done = false;
      const stop = () => setTimeout(() => { try { if (un) un(); } catch (e) { /* gone */ } }, 0);
      const finish = out => { if (done) return; done = true; stop(); res(out); };
      try {
        un = ctx.db.collection('log/' + uid + '/days').onSnapshot(q => {
          const out = {};
          (q.docs || []).forEach(d => {
            if (!d.exists) return;
            const date = String(d.id).slice(0, 10);
            if (date >= from && date <= to) out[date + '-' + uid] = d.data();
          });
          finish(out);
        }, () => finish({}));
      } catch (e) { finish({}); }
      setTimeout(() => finish({}), 8000);
    });
    return Promise.all(people.map(one)).then(parts => Object.assign({}, ...parts));
  };
  /* a log document id (<ymd>-<uid>) back to its path */
  M.logs.pathOf = id => { const s = String(id); return 'log/' + s.slice(11) + '/days/' + s.slice(0, 10); };

  /* flat rows out of {docId: {e: {id: entry}}}, newest first */
  function rows(docs) {
    const out = [];
    for (const id of Object.keys(docs || {})) {
      const uid = String(id).slice(11);
      const es = (docs[id] && docs[id].e) || {};
      for (const k of Object.keys(es)) {
        const e = es[k];
        if (!e || !e.at) continue;
        out.push({id: id + ':' + k, uid, at: Number(e.at) || 0, a: String(e.a || ''), p: String(e.p || ''), s: String(e.s || '')});
      }
    }
    out.sort((a, b) => b.at - a.at);
    return out;
  }
  const isSignin = a => !!SIGNIN[a];

  /* "task Lock the shot list", "check-in for Durvesh", "settings" */
  function target(ctx, row) {
    const segs = row.p.split('/').filter(Boolean);
    const coll = segs[0] || '', id = segs[1] || '';
    if (!coll) return null;
    const base = TARGET[coll] || coll;
    const field = TITLED[coll];
    const doc = field && ctx.coll[coll] && ctx.coll[coll].map[id];
    if (doc && doc[field]) return html`${base} <b>${String(doc[field]).slice(0, 60)}</b>`;
    if (id && ctx.members && ctx.members[id] && id !== row.uid) return html`${base} for <${UI.Name} id=${id}/>`;
    return base;
  }
  const verbOf = row => VERB[row.a] || row.a || 'touched';

  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  /* ---------- the tab ---------- */
  function LogTab() {
    const ctx = M.useCtx();
    const [range, setRange] = useState('7');
    const [who, setWho] = useState('');
    const [kind, setKind] = useState('writes');
    const [q, setQ] = useState('');
    const [docs, setDocs] = useState(null);
    const [err, setErr] = useState(false);
    const [limit, setLimit] = useState(PAGE);
    const [tick, setTick] = useState(0);
    const [busy, setBusy] = useState(false);
    const [hist, setHist] = useState('');
    const uids = (ctx.activeMembers || []).map(m => m.uid);
    const profs = M.useProfiles(uids);
    const today = U.todayStr();
    const from = U.ymd(U.addDays(new Date(), -(Number(range) - 1)));

    useEffect(() => {
      let live = true;
      setDocs(null); setErr(false); setLimit(PAGE);
      M.logs.read(ctx, {from, to: today}).then(d => { if (live) setDocs(d || {}); }, () => { if (live) { setErr(true); setDocs({}); } });
      return () => { live = false; };
    }, [from, today, tick]);

    const all = useMemo(() => rows(docs), [docs]);
    const list = useMemo(() => {
      const needle = q.trim().toLowerCase();
      return all.filter(r => (!who || r.uid === who)
        && (kind === 'all' || (kind === 'signins' ? isSignin(r.a) : !isSignin(r.a)))
        && (!needle || r.p.toLowerCase().includes(needle) || r.s.toLowerCase().includes(needle)));
    }, [all, who, kind, q]);
    const shown = list.slice(0, limit);

    /* day headers between rows */
    const grouped = [];
    let day = '';
    for (const r of shown) {
      const d = U.ymd(new Date(r.at));
      if (d !== day) { day = d; grouped.push({head: d}); }
      grouped.push(r);
    }

    async function exportCsv() {
      const lines = [['date', 'time', 'person', 'action', 'target', 'summary'].map(csvCell).join(',')];
      for (const r of list) {
        const d = new Date(r.at);
        lines.push([U.ymd(d), U.hhmm(r.at), (profs[r.uid] && profs[r.uid].name) || r.uid, r.a, r.p, r.s].map(csvCell).join(','));
      }
      const data = lines.join('\n'), filename = 'log-' + from + '-to-' + today + '.csv';
      try {
        if (ctx.downloads && ctx.downloads.save) {
          const r = await ctx.downloads.save({filename, data});
          M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
          return;
        }
        const url = URL.createObjectURL(new Blob([data], {type: 'text/csv'}));
        const a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        M.toast('Downloaded');
      } catch (e) {
        M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
      }
    }

    async function prune() {
      setBusy(true);
      const cut = U.ymd(U.addDays(new Date(), -PRUNE_DAYS));
      try {
        if (window.M360_STANDALONE && typeof window.M360_API === 'function') {
          const r = await window.M360_API('prunelogs', {days: PRUNE_DAYS});
          M.toast('Cleared ' + ((r && r.deleted) || 0) + ' days of log');
        } else {
          const old = await M.logs.read(ctx, {from: '0000-00-00', to: cut});
          const ids = Object.keys(old || {}).filter(id => id.slice(0, 10) < cut);
          for (const id of ids) await ctx.W.del(M.logs.pathOf(id)).catch(() => {});
          M.toast('Cleared ' + ids.length + (ids.length === 1 ? ' day of log' : ' days of log'));
        }
      } catch (e) { M.toast('That did not clear. Try again in a moment.', true); }
      setBusy(false);
      setTick(t => t + 1);
    }

    const people = [{v: '', label: 'Everyone'}].concat(uids.map(u => ({v: u, label: (profs[u] && profs[u].name) || u})));
    return html`<${UI.Card} id="log-tab" title="Log"
      action=${html`<span class="row nowrap">
        <${UI.Btn} kind="sec" sm=${true} id="log-export" disabled=${!list.length} onClick=${exportCsv}>Export CSV<//>
        <${UI.ConfirmBtn} kind="sec" onConfirm=${prune}>${busy ? 'Clearing' : 'Clear logs older than 90 days'}<//>
      </span>`}>
      <p class="small ink62" style=${{marginTop: 0}}>Every save, change and delete the page makes, with who made it. Sign-ins show up on the standalone build.</p>
      <div class="log-bar">
        <${UI.Seg} sm=${true} options=${RANGES} value=${range} onChange=${setRange} ariaLabel="Days"/>
        <${UI.Seg} sm=${true} options=${KINDS} value=${kind} onChange=${setKind} ariaLabel="Kind"/>
        <${UI.Select} id="log-who" value=${who} onChange=${setWho} options=${people}/>
        <div class="field search"><input id="log-q" class="input" value=${q} placeholder="Search paths and summaries" aria-label="Search the log"
          onInput=${e => setQ(e.target.value)}/></div>
        <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setTick(t => t + 1)}>Refresh<//>
      </div>
      <div class="tiny ink62 num" style=${{marginTop: '8px'}}>${docs == null ? 'Loading.' : list.length + (list.length === 1 ? ' entry' : ' entries') + ' from ' + U.fmtDate(from) + ' to ' + U.fmtDate(today)}</div>
      ${err ? html`<${UI.Empty} text="The log could not be read here."/>` : null}
      ${docs != null && !list.length && !err ? html`<${UI.Empty} text="Nothing logged in this range."/>` : null}
      <div id="log-rows" style=${{marginTop: '6px'}}>
        ${grouped.map(r => r.head
          ? html`<div class="micro plain log-day" key=${'h' + r.head}>${U.fmtDay(r.head)}</div>`
          : html`<div class="log-row" key=${r.id} data-path=${r.p}>
              <span class="tm">${U.hhmm(r.at)}</span>
              <${UI.Avatar} id=${r.uid} size=${24}/>
              <div class="tx">
                <div><${UI.Name} id=${r.uid}/> ${verbOf(r)} ${target(ctx, r) || ''}</div>
                ${r.s ? html`<div class="s">${r.s}</div>` : null}
                <div class="p">${r.p}${window.M360_STANDALONE && M.parts.HistoryDrawer && r.p && (r.a === 'set' || r.a === 'update' || r.a === 'delete' || r.a === 'revert') ? html` <button type="button" class="linky tiny log-versions" onClick=${() => setHist(r.p)}>Versions</button>` : null}</div>
              </div>
            </div>`)}
      </div>
      ${hist && M.parts.HistoryDrawer ? html`<${M.parts.HistoryDrawer} path=${hist} onClose=${() => setHist('')}/>` : null}
      ${list.length > limit ? html`<div class="row" style=${{marginTop: '10px'}}>
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setLimit(n => n + PAGE)}>Show more<//>
        <span class="tiny ink62 num">${limit} of ${list.length}</span></div>` : null}
    <//>`;
  }

  M.deskTabs.push({v: 'log', label: 'Log', render: LogTab});
  M.parts.LogTab = LogTab;
  M.logs.rows = rows;
  M.logs.target = target;
  M.logs.verb = verbOf;
})();
