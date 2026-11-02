/* module: talks. The people we are talking to, in one shared list: who, which company, what was said, when we
   spoke, and when to follow up. One row at the top takes a new name in seconds and saves on Enter; the name
   field searches the database (Base contacts), the clients and the list itself as you type, so a person is
   linked once and found again. A note like "connect after 16 Oct" fills the follow-up date by itself.
   Records: talks/<id> {who, org, note, met, next, nextWhat, owner, done, cid, client, pitch, log, at, updated}. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const NOTE_MAX = 600, NAME_MAX = 80, LOG_MAX = 40;
  const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const YMD = /^\d{4}-\d{2}-\d{2}$/;

  /* ---------- reads ---------- */
  const all = ctx => {
    const map = (ctx.coll.talks && ctx.coll.talks.map) || {};
    return Object.keys(map).map(id => ({id, ...map[id]})).filter(t => t && !t.gone);
  };
  const logOf = t => Object.keys(t.log || {}).map(k => ({id: k, ...t.log[k]})).sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.at || 0) - (a.at || 0));
  const lastSpoke = t => { const l = logOf(t)[0]; return (l && l.d) || t.met || ''; };
  /* due: a follow-up today or earlier; soon: one later; open: no date; done */
  const stateOf = (t, today) => t.done ? 'done' : !t.next ? 'open' : t.next <= today ? 'due' : 'soon';
  const textOf = t => [t.who, t.org, t.note, t.nextWhat].concat(logOf(t).map(l => l.x)).join(' ');
  const matches = (t, q) => { const ws = norm(q).split(' ').filter(Boolean); if (!ws.length) return true; const s = norm(textOf(t)); return ws.every(w => s.indexOf(w) >= 0); };
  const dueFor = (ctx, uid) => { const td = U.todayStr(); return all(ctx).filter(t => stateOf(t, td) === 'due' && (!uid || t.owner === uid)); };
  /* a follow-up date read from the note: "connect after 16 Oct" is the 17th */
  /* read against the day we spoke ("after 16 Oct" said on 7 Oct is this October); a date that lands most of a year
     ahead was a date this year that has already passed, so it is read again from earlier in the year */
  const readDate = (ctx, text, spoke) => {
    if (!text || !M.when || !M.when.parse) return null;
    const base = YMD.test(spoke || '') ? U.parseYmd(spoke).getTime() + 12 * 3600000 : Date.now();
    const one = at => { try { const r = M.when.parse(text, at, ctx.isWorkingDay); return r && r.ymd && YMD.test(r.ymd) ? r : null; } catch (e) { return null; } };
    let r = one(base);
    if (r && U.parseYmd(r.ymd).getTime() - base > 200 * 86400000) { const back = one(base - 250 * 86400000); if (back && back.ymd <= r.ymd) r = back; }
    return r;
  };

  /* ---------- writes ---------- */
  function add(ctx, f) {
    const id = U.uid(), now = Date.now();
    const doc = {who: cut(f.who, NAME_MAX), org: cut(f.org, NAME_MAX), note: cut(f.note, NOTE_MAX), met: YMD.test(f.met || '') ? f.met : U.todayStr(),
      next: YMD.test(f.next || '') ? f.next : '', nextWhat: cut(f.nextWhat, 160), owner: f.owner || ctx.uid, done: false,
      cid: f.cid || '', client: f.client || '', pitch: '', log: {}, at: now, updated: now, by: ctx.uid};
    return ctx.W.set('talks/' + id, doc).then(() => id);
  }
  const patch = (ctx, id, p) => ctx.W.update('talks/' + id, {...p, updated: Date.now()});
  function logTalk(ctx, t, x, d, next) {
    const lid = U.uid();
    const entry = {d: YMD.test(d || '') ? d : U.todayStr(), x: cut(x, NOTE_MAX), by: ctx.uid, at: Date.now()};
    const log = {...(t.log || {}), [lid]: entry};
    /* v39: the update merges, so only the new entry is sent and every entry past the newest 40 goes as null,
       which the store removes */
    const out = {[lid]: entry};
    Object.keys(log).sort((a, b) => (log[b].at || 0) - (log[a].at || 0)).slice(LOG_MAX).forEach(k => { out[k] = null; });
    return ctx.W.update('talks/' + t.id, {log: out, next: next === undefined ? (t.next || '') : next, done: false, updated: Date.now()});
  }
  /* a pitch on the shared pipeline, in Building, linked both ways. v39: its id comes from the person, so two people
     tapping at once write the one pitch */
  function toPipeline(ctx, t, what) {
    const pid = 'tk' + t.id;
    const pm = ctx.coll.pitches.map, lm = (M.lastCtx && M.lastCtx.coll.pitches.map) || {};
    const have = (t.pitch && (pm[t.pitch] || lm[t.pitch])) ? t.pitch : (pm[pid] || lm[pid]) ? pid : '';
    if (have) { if (t.pitch !== have) patch(ctx, t.id, {pitch: have}).catch(() => {}); M.nav('#pitches/' + have); return Promise.resolve(have); }
    const now = Date.now();
    const brand = t.org || t.who || 'New pitch';
    return ctx.W.set('pitches/' + pid, {brand, category: '', contact: t.cid || t.who || '', source: 'talk', owner: t.owner || ctx.uid,
      stage: 'lead', stageAt: now, next: cut(what || t.nextWhat || 'Build the proposal', 120), nextDate: t.next || '', project: '', lost: '', created: now, updated: now, talk: t.id})
      .then(() => patch(ctx, t.id, {pitch: pid}))
      .then(() => { M.toast(brand + ' is in the pipeline'); return pid; });
  }
  /* the viewer's private prospects not yet in the shared list: the same name at the same company counts once.
     v39: the line under the list counts these, so a dropped prospect or one already here is never counted */
  function prospectsToBring(ctx) {
    const P = M.prospects;
    if (!P || !P.data) return [];
    const d = P.data(ctx) || {};
    const have = new Set(all(ctx).map(t => norm(t.who) + '|' + norm(t.org)));
    const out = [];
    for (const pid of Object.keys(d.people || {})) {
      const p = d.people[pid];
      if (!p || p.gone || !p.who) continue;
      const k = norm(p.who) + '|' + norm(p.org);
      if (have.has(k)) continue;
      have.add(k);
      out.push(pid);
    }
    return out;
  }
  /* the viewer's private prospects, copied once into the shared list */
  function bringProspects(ctx) {
    const P = M.prospects;
    if (!P || !P.data) return Promise.resolve(0);
    const d = P.data(ctx);
    const jobs = [];
    for (const pid of prospectsToBring(ctx)) {
      const p = d.people[pid];
      const fid = Object.keys(d.fu || {}).filter(id => d.fu[id] && !d.fu[id].done && d.fu[id].p === pid).sort((a, b) => String(d.fu[a].d).localeCompare(String(d.fu[b].d)))[0];
      const f = fid ? d.fu[fid] : null;
      const met = p.last && p.last.at ? U.ymd(new Date(p.last.at)) : (p.at ? U.ymd(new Date(p.at)) : U.todayStr());
      jobs.push(add(ctx, {who: p.who, org: p.org || '', note: [p.role, f && f.said].filter(Boolean).join('. '), met,
        next: f && YMD.test(f.d || '') ? f.d : '', nextWhat: f ? cut(f.x, 160) : '', cid: p.cid || '', done: p.st === 'done'}));
    }
    return Promise.all(jobs).then(r => r.length);
  }

  /* ---------- the name field: database, clients and this list, as you type ---------- */
  function useDebounced(v, ms) {
    const [d, setD] = useState(v);
    useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return d;
  }
  function useSuggest(ctx, q) {
    const dq = useDebounced(q, 220);
    const on = norm(dq).length >= 2;
    const base = M.base && M.base.useQuery ? M.base.useQuery('contacts', {q: dq, limit: 5}, on) : {rows: []};
    return useMemo(() => {
      if (!on) return [];
      const out = [];
      const n = norm(dq);
      all(ctx).filter(t => norm(t.who + ' ' + t.org).indexOf(n) >= 0).slice(0, 3)
        .forEach(t => out.push({k: 't' + t.id, kind: 'In this list', who: t.who, org: t.org, talk: t.id}));
      (base.rows || []).forEach(c => out.push({k: 'c' + c.id, kind: 'Database', who: c.name || [c.first, c.last].filter(Boolean).join(' '), org: c.orgName || '', cid: c.id, title: c.title || ''}));
      const cm = ctx.coll.clients.map;
      Object.keys(cm).filter(id => norm(cm[id].name).indexOf(n) >= 0).slice(0, 3)
        .forEach(id => out.push({k: 'k' + id, kind: 'Client', who: '', org: cm[id].name, client: id}));
      return out.slice(0, 9);
    }, [on, dq, base.rows, ctx.coll.talks, ctx.coll.clients.map]);
  }

  /* ---------- quick add ---------- */
  function QuickAdd({ctx, onOpen}) {
    const blank = () => ({who: '', org: '', note: '', met: U.todayStr(), next: '', cid: '', client: ''});
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);
    const [focus, setFocus] = useState(false);
    const [hi, setHi] = useState(0);
    const whoRef = useRef(null);
    const sug = useSuggest(ctx, f.who);
    const read = !f.next ? readDate(ctx, f.note, f.met) : null;
    const set = k => v => setF(x => ({...x, [k]: v}));
    const pick = s => {
      if (s.talk) { onOpen(s.talk); setF(blank()); return; }
      /* v39: a client pick fills the company and empties the name, so the typed letters never become a person */
      const isClient = !!s.client && !s.who;
      setF(x => ({...x, who: isClient ? '' : (s.who || x.who), org: s.org || x.org, cid: s.cid || '', client: s.client || (s.org ? clientFor(ctx, s.org) : '') || x.client}));
      setFocus(false);
      if (isClient && whoRef.current) setTimeout(() => { if (whoRef.current) whoRef.current.focus(); }, 0);
    };
    const save = () => {
      if (busy || !f.who.trim()) { if (!f.who.trim()) M.toast('Add a name first', true); return; }
      setBusy(true);
      const next = f.next || (read ? read.ymd : '');
      const client = f.client || clientFor(ctx, f.org);
      add(ctx, {...f, next, client}).then(() => {
        M.toast(f.who.trim() + ' saved' + (next ? ', follow up ' + U.fmtDay(next) : ''));
        setF(blank()); setBusy(false);
        if (whoRef.current) whoRef.current.focus();
      }, () => setBusy(false));
    };
    const onKey = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (focus && sug.length && e.target.id === 'talk-who') pick(sug[hi] || sug[0]); else save(); }
      if (e.target.id === 'talk-who' && sug.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(sug.length - 1, h + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
        if (e.key === 'Escape') setFocus(false);
      }
    };
    useEffect(() => setHi(0), [f.who]);
    return html`<${UI.Card} title="Who did you speak to" className="talk-add">
      <div class="talk-add-grid" onKeyDown=${onKey}>
        <div class="talk-who-wrap">
          <div class="field"><label for="talk-who">name</label>
            <input id="talk-who" ref=${whoRef} class="input" autocomplete="off" value=${f.who} placeholder="Umashan"
              onInput=${e => { set('who')(e.target.value); set('cid')(''); setFocus(true); }} onFocus=${() => setFocus(true)} onBlur=${() => setTimeout(() => setFocus(false), 160)}/>
          </div>
          ${focus && sug.length ? html`<div class="talk-sug" role="listbox" id="talk-sug">
            ${sug.map((s, i) => html`<button key=${s.k} type="button" role="option" aria-selected=${i === hi} class=${'talk-sug-row' + (i === hi ? ' on' : '')}
              onMouseDown=${e => { e.preventDefault(); pick(s); }}>
              <span class="grow"><b><bdi>${s.who || s.org}</bdi></b>${s.who && s.org ? html`<span class="sub"> at <bdi>${s.org}</bdi></span>` : null}${s.title ? html`<span class="sub">, ${s.title}</span>` : null}</span>
              <span class="tiny sub">${s.kind}</span>
            </button>`)}
          </div>` : null}
        </div>
        <${UI.Input} id="talk-org" label="company" value=${f.org} onChange=${set('org')} placeholder="Tank Tailor"/>
        <div class="talk-note"><${UI.Input} id="talk-note" label="what was said" value=${f.note} onChange=${set('note')} placeholder="Asked me to connect after 16 Oct"/></div>
        <${UI.Input} id="talk-met" label="spoke on" type="date" value=${f.met} onChange=${set('met')}/>
        <${UI.Input} id="talk-next" label="follow up on" type="date" value=${f.next} onChange=${set('next')}
          hint=${read ? 'Read from the note: ' + U.fmtDay(read.ymd) : 'Optional'}/>
        <div class="talk-save"><${UI.Btn} id="talk-save" disabled=${busy || !f.who.trim()} onClick=${save}><${icons.plus}/>Save<//></div>
      </div>
      ${f.cid ? html`<div class="tiny sub" style=${{marginTop: '8px'}}>Linked to the database entry for ${f.who}.</div>` : null}
    <//>`;
  }
  const clientFor = (ctx, org) => {
    const k = norm(org);
    if (!k) return '';
    const cm = ctx.coll.clients.map;
    return Object.keys(cm).find(id => norm(cm[id].name) === k) || '';
  };

  /* ---------- one row ---------- */
  function Row({ctx, t, today, onOpen, onLog}) {
    const st = stateOf(t, today);
    const spoke = lastSpoke(t);
    const last = logOf(t)[0];
    return html`<div class=${'talk-row' + (st === 'due' ? ' due' : '') + (t.done ? ' done' : '')} data-talk=${t.id}>
      <button type="button" class="talk-main rowbtn" onClick=${() => onOpen(t.id)} aria-label=${'Open ' + (t.who || 'person')}>
        <div class="row between nowrap">
          <span class="talk-name"><b><bdi>${t.who || 'Someone'}</bdi></b>${t.org ? html`<span class="sub"> <bdi>${t.org}</bdi></span>` : null}</span>
          ${st === 'due' ? html`<span class="pill flame">follow up ${t.next === today ? 'today' : U.fmtDay(t.next)}</span>`
            : st === 'soon' ? html`<span class="pill">follow up ${U.fmtDay(t.next)}</span>`
            : st === 'done' ? html`<span class="pill ink">done</span>` : null}
        </div>
        ${(last && last.x) || t.note ? html`<div class="small ink62 talk-line">${(last && last.x) || t.note}</div>` : null}
        <div class="row tiny sub" style=${{gap: '10px', marginTop: '6px'}}>
          ${spoke ? html`<span>spoke ${U.fmtDay(spoke)}</span>` : null}
          ${t.nextWhat ? html`<span>next: ${t.nextWhat}</span>` : null}
          ${t.cid ? html`<span>in the database</span>` : null}
          ${t.client ? html`<span>client</span>` : null}
          ${t.pitch ? html`<span>in the pipeline</span>` : null}
          <${UI.Avatar} id=${t.owner} size=${18}/>
        </div>
      </button>
      ${t.done ? null : html`<div class="talk-acts row nowrap">
        <button type="button" class="btn ghost sm" onClick=${() => onLog(t.id)}>Log a talk</button>
        <button type="button" class="btn ghost sm" onClick=${() => patch(ctx, t.id, {done: true}).then(() => M.toast('Marked done'))}><${icons.check}/>Done</button>
      </div>`}
    </div>`;
  }

  /* ---------- log a talk ---------- */
  function LogDrawer({ctx, t, onClose}) {
    const [x, setX] = useState('');
    const [d, setD] = useState(U.todayStr());
    const [next, setNextS] = useState(t.next || '');
    const [busy, setBusy] = useState(false);
    /* v39: a date read from what was said moves the follow-up, until the person picks one by hand */
    const byHand = useRef(false);
    const setNext = v => { byHand.current = true; setNextS(v); };
    const read = readDate(ctx, x, d);
    useEffect(() => { if (!byHand.current) setNextS(read ? read.ymd : (t.next || '')); }, [read && read.ymd]);
    const save = () => {
      if (busy || !x.trim()) return;
      setBusy(true);
      logTalk(ctx, t, x, d, next).then(() => { M.toast('Logged'); onClose(); }, () => setBusy(false));
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${'Talk with ' + (t.who || 'them')}
      footer=${html`<${UI.Btn} id="talk-log-save" disabled=${busy || !x.trim()} onClick=${save}>Save the talk<//>`}>
      <div class="stack">
        <${UI.TextArea} id="talk-log-x" label="what was said" value=${x} onChange=${setX} rows=${3} placeholder="Wants the proposal by Friday"/>
        <${UI.Input} id="talk-log-d" label="spoke on" type="date" value=${d} onChange=${setD}/>
        <${UI.Input} id="talk-log-next" label="next follow-up" type="date" value=${next} onChange=${setNext} hint=${read ? 'Read from what was said: ' + U.fmtDay(read.ymd) : 'Clear it to drop the reminder'}/>
      </div>
    <//>`;
  }

  /* ---------- the person drawer ---------- */
  function TalkDrawer({ctx, id, onClose}) {
    const t0 = ctx.coll.talks.map[id];
    /* v39: the copy the form opened on; save sends only what this person changed against it */
    const opened = useRef(null);
    const [f, setF] = useState(() => (opened.current = t0 ? {who: t0.who || '', org: t0.org || '', note: t0.note || '', met: t0.met || '', next: t0.next || '', nextWhat: t0.nextWhat || '', owner: t0.owner || ctx.uid} : null));
    const [busy, setBusy] = useState(false);
    const owners = ctx.activeMembers.map(m => m.uid);
    if (owners.indexOf(ctx.uid) < 0) owners.unshift(ctx.uid);
    /* v39: whoever owns the conversation is always an option, the owner off the active list included */
    if (t0 && t0.owner && owners.indexOf(t0.owner) < 0) owners.push(t0.owner);
    const profs = M.useProfiles(owners);
    if (!t0 || !f) return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Person"><${UI.Empty} text="This person is not on the list any more."/><//>`;
    const t = {id, ...t0};
    const set = k => v => setF(x => ({...x, [k]: v}));
    const clean = x => ({who: cut(x.who, NAME_MAX), org: cut(x.org, NAME_MAX), note: cut(x.note, NOTE_MAX), met: x.met, next: x.next, nextWhat: cut(x.nextWhat, 160), owner: x.owner});
    const save = () => {
      setBusy(true);
      const ch = U.changes(clean(opened.current || f), clean(f));
      const client = t.client || clientFor(ctx, f.org);
      if (client && client !== t.client) ch.client = client;
      patch(ctx, id, ch)
        .then(() => { M.toast('Saved'); onClose(); }, () => setBusy(false));
    };
    const toBase = () => {
      if (!M.base || !M.base.upsertContact) return;
      setBusy(true);
      M.base.upsertContact(ctx, {name: f.who, orgName: f.org, source: 'manual', notes: f.note})
        .then(cid => patch(ctx, id, {cid}))
        .then(() => { M.toast(f.who + ' is in the database'); setBusy(false); }, () => setBusy(false));
    };
    const pitch = t.pitch ? ctx.coll.pitches.map[t.pitch] : null;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${t.who || 'Person'}
      footer=${html`<div class="row between" style=${{width: '100%'}}>
        <${UI.ConfirmBtn} onConfirm=${() => ctx.W.del('talks/' + id).then(() => { M.toast('Removed'); onClose(); })}>Remove<//>
        <${UI.Btn} id="talk-drawer-save" disabled=${busy || !f.who.trim()} onClick=${save}>Save<//>
      </div>`}>
      <div class="stack">
        <div class="grid2">
          <${UI.Input} id="td-who" label="name" value=${f.who} onChange=${set('who')}/>
          <${UI.Input} id="td-org" label="company" value=${f.org} onChange=${set('org')}/>
        </div>
        <${UI.TextArea} id="td-note" label="what it is about" value=${f.note} onChange=${set('note')} rows=${3}/>
        <div class="grid2">
          <${UI.Input} id="td-met" label="first spoke on" type="date" value=${f.met} onChange=${set('met')}/>
          <${UI.Input} id="td-next" label="follow up on" type="date" value=${f.next} onChange=${set('next')}/>
        </div>
        <${UI.Input} id="td-nextwhat" label="what the follow-up is" value=${f.nextWhat} onChange=${set('nextWhat')} placeholder="Send the proposal"/>
        <${UI.Select} id="td-owner" label="whose conversation" value=${f.owner} onChange=${set('owner')} options=${owners.map(u => ({v: u, label: (profs[u] && profs[u].name) || 'Someone'}))}/>
        <div class="row" style=${{gap: '8px'}}>
          ${pitch ? html`<${UI.Btn} kind="sec" sm onClick=${() => M.nav('#pitches/' + t.pitch)}><${icons.pitches}/>Open the pitch<//>`
            : html`<${UI.Btn} kind="sec" sm id="td-pipeline" disabled=${busy} onClick=${() => { setBusy(true); toPipeline(ctx, t).then(() => setBusy(false), () => setBusy(false)); }}><${icons.pitches}/>Send to pipeline<//>`}
          ${t.cid ? html`<${UI.Btn} kind="ghost" sm onClick=${() => M.nav('#base/' + t.cid)}><${icons.database}/>Open in database<//>`
            : html`<${UI.Btn} kind="ghost" sm id="td-base" disabled=${busy || !f.who.trim()} onClick=${toBase}><${icons.database}/>Add to database<//>`}
          ${t.client ? html`<${UI.Btn} kind="ghost" sm onClick=${() => M.nav('#clients/' + t.client)}><${icons.clients}/>Open client<//>` : null}
          ${t.done ? html`<${UI.Btn} kind="ghost" sm onClick=${() => patch(ctx, id, {done: false})}>Open again<//>` : null}
        </div>
        <hr class="hair"/>
        <${UI.Micro}>the talks<//>
        ${logOf(t).length ? logOf(t).map(l => html`<div key=${l.id} class="talk-log-row">
          <div class="row between nowrap"><span class="tiny num sub">${U.fmtDay(l.d)}</span><${UI.Avatar} id=${l.by} size=${18}/></div>
          <div class="small">${l.x}</div>
        </div>`) : html`<${UI.Empty} text=${'First spoke ' + (t.met ? U.fmtDay(t.met) : 'recently') + '. Nothing logged since.'}/>`}
      </div>
    <//>`;
  }

  /* ---------- the page ---------- */
  const FILTERS = [{v: 'due', label: 'Follow up due'}, {v: 'soon', label: 'Coming up'}, {v: 'all', label: 'All'}, {v: 'done', label: 'Done'}];
  function Talks({id}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [flt, setFlt] = useState(null);
    const [mine, setMine] = useState(false);
    const [open, setOpen] = useState(null);
    const [logFor, setLogFor] = useState(null);
    const [busy, setBusy] = useState(false);
    const route = M.useRoute();
    const routeId = ['talks', 'talk', 'conversations', 'accounts'].indexOf(route.page) >= 0 ? route.id : null;
    useEffect(() => { if (routeId && ctx.coll.talks.map[routeId]) setOpen(routeId); }, [routeId, ctx.coll.talks.ready]);
    M.useIntent('talk', () => { const el = document.getElementById('talk-who'); if (el) el.focus(); });
    const today = U.todayStr();
    const list = all(ctx);
    const n = {due: 0, soon: 0, all: 0, done: 0};
    list.forEach(t => { const s = stateOf(t, today); if (s === 'due') n.due++; if (s === 'soon') n.soon++; if (s === 'done') n.done++; else n.all++; });
    const f = flt || (n.due ? 'due' : 'all');
    const shown = list.filter(t => {
      const s = stateOf(t, today);
      if (q.trim()) return matches(t, q) && (!mine || t.owner === ctx.uid);
      if (mine && t.owner !== ctx.uid) return false;
      return f === 'all' ? s !== 'done' : f === 'soon' ? s === 'soon' : s === f;
    }).sort((a, b) => {
      const ka = a.next || '9999', kb = b.next || '9999';
      return f === 'done' ? (b.updated || 0) - (a.updated || 0) : ka.localeCompare(kb) || (b.updated || 0) - (a.updated || 0);
    });
    const pros = prospectsToBring(ctx).length;
    const bring = () => { setBusy(true); bringProspects(ctx).then(k => { M.toast(k ? k + ' brought in' : 'Everyone is already here'); setBusy(false); }, () => setBusy(false)); };
    const close = () => { setOpen(null); if (routeId) M.nav('#talks'); };
    const logT = logFor ? {id: logFor, ...ctx.coll.talks.map[logFor]} : null;
    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro=${n.due ? n.due + ' to follow up' : n.all + ' people'} title="People we are talking to"/>
      <${QuickAdd} ctx=${ctx} onOpen=${setOpen}/>
      <div class="row between" style=${{gap: '10px'}}>
        <label class="talk-search grow">
          <${icons.search}/>
          <input id="talk-q" class="input" type="search" aria-label="Search people" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Search name, company or what was said"/>
        </label>
        <${UI.Seg} sm options=${FILTERS.map(x => ({v: x.v, label: x.label + (n[x.v] ? ' ' + n[x.v] : '')}))} value=${f} onChange=${setFlt} ariaLabel="Show"/>
        <${UI.Check} label="Mine" checked=${mine} onChange=${setMine}/>
      </div>
      ${!ctx.coll.talks.ready ? html`<${UI.Empty} text="Loading."/>`
        : shown.length ? html`<div class="card talk-list">${shown.map(t => html`<${Row} key=${t.id} ctx=${ctx} t=${t} today=${today} onOpen=${setOpen} onLog=${setLogFor}/>`)}</div>`
        : html`<${UI.Card}><${UI.Empty} text=${q.trim() ? 'Nobody matches "' + q.trim() + '".' : f === 'due' ? 'No follow-ups due. Add the next person above.' : 'Nobody here yet. Add the first person above.'}/><//>`}
      ${pros && !ctx.viewAs ? html`<div class="row tiny sub" style=${{gap: '10px'}}>
        <span>${pros === 1 ? '1 person in your private prospects is' : pros + ' people in your private prospects are'} not on this list yet.</span>
        <button type="button" class="linky tiny" id="talk-bring" disabled=${busy} onClick=${bring}>Bring them into this list</button>
      </div>` : null}
      ${open ? html`<${TalkDrawer} key=${open} ctx=${ctx} id=${open} onClose=${close}/>` : null}
      ${logT && logT.who !== undefined ? html`<${LogDrawer} ctx=${ctx} t=${logT} onClose=${() => setLogFor(null)}/>` : null}
    </div>`;
  }

  M.pages.Talks = Talks;
  M.talks = {all, stateOf, dueFor, matches, add, logTalk, toPipeline, bringProspects, readDate, lastSpoke};
})();
