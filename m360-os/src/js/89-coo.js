/* module: coo surfaces. What Kaavish and the team see of the m360 COO, the bot colleague that runs the
   day inside a written mandate (M.coo, 10-coo.js): the HQ tab (the hero with the live office and the
   switch, the decisions that need him, today's ledger with its reasons and undo, what it watches, the
   week, its health, stop and undo), the decision cards, the Admin card with the rungs and the policy, the
   charter the team reads, the static face, the morning digest, the studio window on Home and the
   runner's mount. Nothing here decides: every tap goes through M.coo, which rebuilds the facts before it
   acts, and every write Kaavish makes here is his own. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useContext} = React;

  /* ---------- small helpers ---------- */
  const has = () => !!M.coo;
  const isCoo = id => !!(id && M.coo && M.coo.isCoo && M.coo.isCoo(id));
  const cfgOf = ctx => (M.coo && M.coo.cfg ? M.coo.cfg(ctx) : (ctx && ctx.settings && ctx.settings.coo)) || {};
  const titleOf = ctx => (M.coo && M.coo.title && ctx ? M.coo.title(ctx) : '') || 'm360 COO';
  const nowOf = ctx => Number(ctx && ctx.now) || Date.now();
  const site = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');
  /* a list from an array or an id keyed map */
  const list = x => Array.isArray(x) ? x.filter(Boolean) : x && typeof x === 'object' ? Object.keys(x).filter(k => x[k]).map(k => ({id: k, ...x[k]})) : [];
  /* the day runs on IST wherever the founder is: M.coo's helpers, or the same fixed +330 minutes */
  const shift = ms => new Date(Number(ms) + 330 * 60000);
  const ymdIST = ms => (M.coo && M.coo.ist ? M.coo.ist.ymd(ms) : shift(ms).toISOString().slice(0, 10));
  const hm = ms => (M.coo && M.coo.ist ? M.coo.ist.hm(ms) : shift(ms).toISOString().slice(11, 16));
  const atIST = (ymd, hhmm) => Date.parse(ymd + 'T' + hhmm + ':00+05:30');
  const dayName = ms => U.DAYS_S[shift(ms).getUTCDay()];
  const and = xs => xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  /* practiceUntil and pausedUntil as a time, whether stored as a time or as an IST day */
  const until = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? atIST(v, '23:59') : Number(v) || 0;
  const stateOf = (c, now) => !c.on ? 'off' : until(c.pausedUntil) > now ? 'paused' : until(c.practiceUntil) > now ? 'practice' : 'on';

  /* the live feed: M.coo's hook, or nothing on a build without it (picked at render, the same one every time) */
  const EMPTY = {pub: null, now: null, ledger: [], dec: [], health: null};
  const noLive = () => EMPTY;
  /* the founder's latest feed is kept here too, with a version that moves when a card or a row does: the
     inbox is worked out once per context and reads it, so a new card reaches it without a new context */
  let last = null, ver = 0, sig = '';
  const sigOf = l => list(l.dec).map(c => c.id + c.status).join() + '|' + list(l.ledger).map(r => r.id + r.status + undoBy(r)).join();
  function useLive(ctx) {
    const live = ((M.coo && M.coo.useLive) || noLive)(ctx) || EMPTY;
    if (ctx && ctx.isFounder && live !== EMPTY) { const k = sigOf(live); if (k !== sig) { sig = k; ver++; } last = live; }
    return live;
  }
  const LiveCtx = React.createContext(null);

  /* a row or a card speaks through M.coo.copy, the one source of every line; rows carry codes and args */
  const codeOf = r => (r && (r.code || (r.why && r.why.code) || r.job)) || '';
  const argsOf = r => (r && (r.args || (r.why && r.why.args))) || {};
  function say(ctx, r, scope) {
    let out = null;
    try { out = M.coo && M.coo.copy && codeOf(r) ? M.coo.copy(codeOf(r), argsOf(r), scope || 'founder', ctx) : null; } catch (e) { out = null; }
    return {line: (out && out.line) || r.line || r.title || '', why: (out && out.why) || (typeof r.why === 'string' ? r.why : '') || ''};
  }
  const OPEN = {open: true, sending: true};
  const openCards = live => list(live && live.dec).filter(c => !c.status || OPEN[c.status])
    .sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.at || 0) - (b.at || 0));
  const rowsOf = live => list(live && live.ledger).sort((a, b) => (a.at || 0) - (b.at || 0));
  const undoBy = r => Number((r && r.undo && r.undo.until) || (r && r.undoUntil)) || 0;
  const canUndo = (r, now) => !!r && r.status === 'done' && undoBy(r) > now;
  const BRIEF = /^(J02|brief)$/;
  const briefOf = (ctx, rows) => rows.filter(r => BRIEF.test(String(r.job || '')) || BRIEF.test(String(r.code || ''))).filter(r => ymdIST(r.at || 0) === ymdIST(nowOf(ctx))).pop() || null;

  /* the stations as glyphs from the icon set */
  const GLYPH = {attendance: 'check', calendar: 'calendar', board: 'tasks', review: 'review', desk: 'edit', meeting: 'week',
    clients: 'clients', mail: 'send', tray: 'bell', books: 'log', reception: 'people', clock: 'clock'};
  const stationOf = r => (r && r.station) || (M.coo && M.coo.JOBS && M.coo.JOBS[codeOf(r)] ? M.coo.JOBS[codeOf(r)].station : '') || (M.coo && M.coo.JOBS && M.coo.JOBS[r.job] ? M.coo.JOBS[r.job].station : '') || 'desk';
  const Glyph = ({st}) => { const I = icons[GLYPH[st]] || icons.clock; return html`<span class="coo-glyph" data-station=${st} title=${st}><${I}/></span>`; };

  /* the named slots of the day, in words */
  const SLOT = {open: 'Open, 09:00', brief: 'Morning brief', roll: 'Roll call', roll2: 'Second roll call', eod: 'EOD sweep', close: 'Close', memo: 'Weekly memo', now: 'Just now'};
  function slotName(s) {
    if (SLOT[s]) return SLOT[s];
    const m = /^[rwm](\d{1,2})(\d{2})?$/.exec(String(s || ''));
    return m ? 'Round ' + U.pad(Number(m[1])) + ':' + (m[2] || '00') : 'Other';
  }

  /* settings: the founder's own write */
  const saveCoo = (ctx, patch) => ctx.W.merge('settings/app', {coo: patch, updated: Date.now()});
  /* six working days ahead, IST, Monday to Saturday outside the holidays: the practice week */
  function practiceEnd(ctx, from) {
    let d = from, n = 0, guard = 0;
    while (n < 6 && guard++ < 40) {
      d += 86400000;
      const y = ymdIST(d);
      if (shift(d).getUTCDay() !== 0 && !ctx.holidays.has(y)) n++;
    }
    return atIST(ymdIST(d), '23:59');
  }
  const tomorrowAt9 = now => atIST(ymdIST(now + 86400000), '09:00');
  async function switchOn(ctx) {
    const c = cfgOf(ctx);
    const patch = {on: true, pausedUntil: null, signedAt: Date.now(), signedBy: ctx.realUid || ctx.uid};
    if (!c.signedAt && !c.practiceUntil) patch.practiceUntil = practiceEnd(ctx, Date.now());
    await saveCoo(ctx, patch);
    M.toast(patch.practiceUntil ? 'On, in practice until ' + dayName(patch.practiceUntil) + '. Nothing changes until then.' : 'On');
  }
  /* a call into M.coo that answers {ok, say}: the answer becomes the toast */
  async function act(fn, done) {
    try {
      const r = await fn();
      if (r && r.say) M.toast(r.say, r.ok === false || !!r.conflict);
      else if (r && r.ok === false) M.toast('That did not go through.', true);
      else if (done) M.toast(done);
      return r || {ok: true};
    } catch (e) { M.toast((e && e.message) || 'That did not go through.', true); return {ok: false}; }
  }

  /* ---------- the face: a static droid head with square glasses and a bow tie, for lines and lists ---------- */
  function CooFace({size, label}) {
    const s = size || 24;
    return html`<svg class="coo-face" width=${s} height=${s} viewBox="0 0 32 32" role="img" aria-label=${label || 'm360 COO'}>
      <path class="cf-ant" d="M16 3.6v3.2"/><circle class="cf-tip" cx="16" cy="3.2" r="1.7"/>
      <rect class="cf-ear" x="2.4" y="12.2" width="2.8" height="5.6" rx="1.4"/><rect class="cf-ear" x="26.8" y="12.2" width="2.8" height="5.6" rx="1.4"/>
      <rect class="cf-head" x="5" y="6.6" width="22" height="17.4" rx="6.6"/>
      <rect class="cf-lens" x="7.6" y="10.8" width="7.4" height="6.4" rx="1.3"/><rect class="cf-lens" x="17" y="10.8" width="7.4" height="6.4" rx="1.3"/>
      <path class="cf-bridge" d="M15 13.4h2"/>
      <circle class="cf-eye" cx="11.3" cy="14" r="1.25"/><circle class="cf-eye" cx="20.7" cy="14" r="1.25"/>
      <path class="cf-mouth" d="M13.4 19.9q2.6 1.7 5.2 0"/>
      <path class="cf-tie" d="M16 27.4 10.6 24.6v5.6Zm0 0 5.4-2.8v5.6Z"/><circle class="cf-knot" cx="16" cy="27.4" r="1.5"/>
    </svg>`;
  }

  /* ---------- the office: builder five's live window, or the face and the current line where it is absent ---------- */
  function OfficeSlot({mode, scope}) {
    const ctx = M.useCtx();
    const live = useContext(LiveCtx) || EMPTY;
    const W = M.parts.OfficeWindow;
    const sc = scope || (ctx.isFounder ? 'founder' : 'team');
    if (W) return html`<${W} mode=${mode} scope=${sc}/>`;
    const pub = live.pub || {};
    const off = !has() || pub.state === 'off' || pub.state === 'closed';
    const line = off ? 'Off for the night. Back at 09:00.' : pub.job ? say(ctx, pub, 'team').line : 'At its desk.';
    return html`<div class="office-window coo-office-still" data-mode=${mode}>
      <${CooFace} size=${44} label=${titleOf(ctx)}/>
      <div class="small">${line || 'At its desk.'}</div>
    </div>`;
  }

  /* ---------- the decision cards ---------- */
  const KIND = {leave: 'leave', wfh: 'wfh', move: 'a move', told: 'done, telling you', clientDate: 'client date', client_mail: 'client mail',
    meeting_mail: 'meeting nudge', invoice_reminder: 'invoice reminder', review: 'friday review', memo: 'weekly memo', proposal: 'proposal', setting: 'setting', info: 'note'};
  const MAIL = {client_mail: true, meeting_mail: true, invoice_reminder: true};
  const BATCH = {move: ['move', 'moves'], proposal: ['proposal', 'proposals'], setting: ['setting change', 'setting changes']};
  const CHECK = {policy: 'policy set', type: 'leave type', days: 'working days', balance: 'days left', probation: 'probation', notice: 'notice',
    out: 'people out', pod: 'pod out', blackout: 'blackout', client: 'client dates', manager: 'manager in', changed: 'unchanged'};
  const docOf = card => card.kind === 'invoice_reminder' ? 'books/cooq' : 'coo/dec';
  const mailto = d => 'mailto:' + encodeURIComponent(d.to || '').replace(/%40/g, '@').replace(/%2C/g, ',') + '?' +
    [d.cc ? 'cc=' + encodeURIComponent(d.cc) : '', 'subject=' + encodeURIComponent(d.subject || ''), 'body=' + encodeURIComponent(d.text || '')].filter(Boolean).join('&');
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); M.toast('Copied'); return; } catch (e) { /* the old way below */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); M.toast('Copied');
    } catch (e) { M.toast('Could not copy here. Select the text and copy it.', true); }
  }

  /* Friday review marks: Kaavish confirms them as his own, and the card settles */
  async function confirmReview(ctx, card) {
    const input = (card.payload && card.payload.input) || {};
    const uid = (card.refs && card.refs.uid) || input.uid;
    const weekId = input.weekId || input.week || card.week;
    const marks = input.marks || card.marks || {};
    if (!uid || !weekId) throw new Error('That suggestion has no week on it.');
    const weeks = U.clone(((ctx.coll.review.map[uid] || {}).weeks) || {});
    const prev = weeks[weekId] || {quality: null, note: ''};
    /* a mark Kaavish already set stays his */
    weeks[weekId] = {...prev, marks: {...marks, ...(prev.marks || {})}, at: Date.now()};
    await ctx.W.merge('review/' + uid, {weeks: U.prunePatch(weeks, 26, true)});
    await ctx.W.merge(docOf(card), {items: {[card.id]: {status: 'done', decidedAt: Date.now(), decidedVia: 'week', result: 'confirmed'}}});
  }
  const ghostOf = (cards, uid, weekId) => {
    const c = cards.find(x => x.kind === 'review' && ((x.refs && x.refs.uid) || (x.payload && x.payload.input && x.payload.input.uid)) === uid &&
      ((x.payload && x.payload.input && (x.payload.input.weekId || x.payload.input.week)) || x.week) === weekId);
    return c ? {card: c, marks: (c.payload && c.payload.input && c.payload.input.marks) || c.marks || {}, evidence: list(c.evidence || (c.payload && c.payload.input && c.payload.input.evidence))} : null;
  };

  function Draft({d, onChange}) {
    return html`<div class="coo-edit stack tight">
      <${UI.Input} label="to" value=${d.to} onChange=${v => onChange({...d, to: v})}/>
      <${UI.Input} label="cc" value=${d.cc} onChange=${v => onChange({...d, cc: v})}/>
      <${UI.Input} label="subject" value=${d.subject} onChange=${v => onChange({...d, subject: v})}/>
      <${UI.TextArea} label="the mail" rows=${7} value=${d.text} onChange=${v => onChange({...d, text: v})}/>
    </div>`;
  }

  function Card({card, live}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState('');
    const [edit, setEdit] = useState(null);
    const [note, setNote] = useState(null);
    const [pick, setPick] = useState(0);
    const [opened, setOpened] = useState(false);
    const c = card;
    const now = nowOf(ctx);
    const d0 = (c.payload && c.payload.draft) || null;
    const draft = d0 ? {to: d0.to || '', cc: d0.cc || '', subject: d0.subject || '', text: d0.text || ''} : null;
    const mail = !!(MAIL[c.kind] && draft);
    const opts = list(c.options);
    const checks = list(c.checks);
    const acts = list(c.refs && c.refs.actIds).map(id => (typeof id === 'string' ? id : id.id));
    const rows = rowsOf(live);
    const late = c.expires && Number(c.expires) < now;
    const run = async (how, edits) => {
      setBusy(how);
      await act(() => M.coo.decide(ctx, c.id, how, edits));
      setBusy('');
    };
    const send = async () => {
      if (site()) {
        setBusy('send');
        try { const r = await window.M360_API('coosend', {id: c.id}); M.toast((r && r.say) || 'Sent from your Gmail, in the thread.'); }
        catch (e) { M.toast((e && e.message) || 'Not sent. The draft is still here.', true); }
        setBusy('');
        return;
      }
      /* the claude.ai page sends nothing itself: the mail app opens with the draft, and Kaavish marks it sent */
      const a = document.createElement('a');
      a.href = mailto(draft); a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setOpened(true);
    };
    const saveEdit = async () => {
      setBusy('edit');
      try {
        await ctx.W.merge(docOf(c), {items: {[c.id]: {payload: {draft: {to: edit.to.trim(), cc: edit.cc.trim(), subject: edit.subject.trim(), text: edit.text}}, editedAt: Date.now()}}});
        setEdit(null); M.toast('Draft saved');
      } catch (e) { /* toasted */ }
      setBusy('');
    };
    const confirm = async () => {
      setBusy('apply');
      try { await confirmReview(ctx, c); M.toast('Marks saved as yours'); } catch (e) { M.toast((e && e.message) || 'Those marks did not save.', true); }
      setBusy('');
    };
    const undo = async id => { setBusy('undo:' + id); await act(() => M.coo.undo(ctx, id)); setBusy(''); };

    const quiet = c.kind === 'info' || c.kind === 'told';
    const primary = mail ? {act: 'send', label: site() ? 'Send' : 'Open in mail', go: send}
      : c.kind === 'review' ? {act: 'apply', label: 'Confirm marks', go: confirm}
      : c.kind === 'memo' ? {act: 'apply', label: 'Post to Feed', go: () => run('apply')}
      : quiet ? {act: 'apply', label: 'Got it', go: () => run('apply')}
      : {act: 'apply', label: c.kind === 'leave' || c.kind === 'wfh' ? 'Approve' : 'Apply', go: () => run('apply', opts.length ? {option: pick} : undefined)};
    const noTo = mail && !draft.to.trim();
    return html`<article class=${'coo-card' + (c.urgent ? ' urgent' : '')} data-kind=${c.kind || 'info'} data-id=${c.id}>
      <div class="coo-card-head row between nowrap">
        <span class="micro">${KIND[c.kind] || 'note'}</span>
        <span class="tiny ink62 num">${c.urgent ? html`<span class="dotflame"/> ` : null}${c.at ? hm(c.at) : ''}</span>
      </div>
      <div class="coo-card-title">${c.title || say(ctx, c).line}</div>
      ${c.why ? html`<div class="small ink62">${typeof c.why === 'string' ? c.why : say(ctx, c).why}</div>` : null}
      ${late && (c.kind === 'leave' || c.kind === 'wfh') ? html`<div class="small flame-t">Decide now, it has started.</div>` : null}
      ${checks.length ? html`<div class="coo-checks row">${checks.map((k, i) => html`<span key=${i} class=${'coo-check' + (k.ok === false ? ' no' : '')}>
        <b>${k.ok === false ? '×' : '✓'}</b> ${CHECK[k.k] || k.k}${k.val != null ? ' ' + k.val : ''}${k.limit != null ? ' of ' + k.limit : ''}</span>`)}</div>` : null}
      ${c.recommend ? html`<div class="small coo-rec">I suggest: ${c.recommend}</div>` : null}
      ${opts.length ? html`<div class="coo-opts" role="radiogroup" aria-label="Options">${opts.map((o, i) => html`<label key=${i} class="checkline">
        <input type="radio" name=${'opt-' + c.id} checked=${pick === i} onChange=${() => setPick(i)}/><span>${o.label}</span></label>`)}</div>` : null}
      ${mail && !edit ? html`<div class="coo-draft">
        <div class="tiny ink62">To <b class=${noTo ? 'flame-t' : ''}>${draft.to || 'nobody yet, fill it in'}</b>${draft.cc ? ', cc ' + draft.cc : ''}</div>
        <div class="small coo-draft-subject">${draft.subject}</div>
        <div class="small coo-draft-text">${draft.text}</div>
      </div>` : null}
      ${edit ? html`<${Draft} d=${edit} onChange=${setEdit}/>` : null}
      ${acts.length ? html`<div class="coo-told stack tight">${acts.map(id => {
        const r = rows.find(x => x.id === id);
        const s = r ? say(ctx, r) : {line: 'One act', why: ''};
        return html`<div class="row between nowrap coo-told-row" key=${id}>
          <span class="small grow">${s.line}</span>
          ${r && canUndo(r, now) ? html`<button type="button" class="btn sec sm" data-act="undo" disabled=${!!busy} onClick=${() => undo(id)}>Undo</button>`
            : r && r.status === 'undone' ? html`<span class="tiny ink62">undone</span>` : null}
        </div>`;
      })}</div>` : null}
      ${note != null ? html`<div class="row nowrap coo-note">
        <input class="input grow" placeholder="A note, if you like" aria-label="A note, if you like" value=${note} onInput=${e => setNote(e.target.value)}/>
        <${UI.Btn} kind="sec" sm=${true} disabled=${!!busy} onClick=${() => run('decline', note.trim() ? {note: note.trim()} : undefined)}>${c.kind === 'memo' ? 'Keep private' : 'Decline'}<//>
        <button type="button" class="linky tiny" onClick=${() => setNote(null)}>Back</button>
      </div>` : edit ? html`<div class="row coo-acts">
        <button type="button" class="btn sm" disabled=${!!busy} onClick=${saveEdit}>Save the draft</button>
        <button type="button" class="linky small" onClick=${() => setEdit(null)}>Cancel</button>
      </div>` : html`<div class="row coo-acts">
        <button type="button" class="btn sm" data-act=${primary.act} disabled=${!!busy || noTo} onClick=${primary.go}>${busy === primary.act ? 'One moment' : primary.label}</button>
        ${opened && !site() ? html`<button type="button" class="btn sec sm" data-act="sent" disabled=${!!busy} onClick=${() => run('send', draft)}>Mark sent</button>` : null}
        ${mail && !site() ? html`<button type="button" class="btn sec sm" data-act="copy" onClick=${() => copyText((draft.to ? 'To: ' + draft.to + '\n' : '') + 'Subject: ' + draft.subject + '\n\n' + draft.text)}>Copy</button>` : null}
        ${draft ? html`<button type="button" class="btn sec sm" data-act="edit" disabled=${!!busy} onClick=${() => setEdit(draft)}>Edit</button>` : null}
        ${quiet ? null : html`<button type="button" class="btn sec sm" data-act="decline" disabled=${!!busy} onClick=${() => c.kind === 'memo' ? run('decline') : setNote('')}>${c.kind === 'memo' ? 'Keep private' : 'Decline'}</button>`}
        ${quiet ? null : html`<button type="button" class="linky small" data-act="later" disabled=${!!busy} onClick=${() => run('snooze')}>Later</button>`}
      </div>`}
      ${list(c.sources).length ? html`<div class="tiny ink62 coo-src">From ${list(c.sources).map(s => typeof s === 'string' ? s : s.label || s.path).join(', ')}</div>` : null}
    </article>`;
  }

  function CardList({live, filter, empty}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const f = typeof filter === 'function' ? filter : filter ? (x => x.kind === filter) : () => true;
    const cards = openCards(live).filter(f);
    if (!cards.length) return html`<${UI.Empty} text=${empty || 'Nothing waits for you.'}/>`;
    /* internal proposals of one kind can go together; client mail and leave never do */
    const kinds = {};
    cards.forEach(x => { if (BATCH[x.kind]) kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
    const batch = Object.keys(kinds).find(k => kinds[k] > 1);
    const all = async () => {
      setBusy(true);
      for (const x of cards.filter(y => y.kind === batch)) await act(() => M.coo.decide(ctx, x.id, 'apply'));
      setBusy(false);
    };
    return html`<div class="coo-cards stack tight">
      ${batch ? html`<div class="row between coo-batch"><span class="small ink62">${plural(kinds[batch], BATCH[batch][0], BATCH[batch][1])}, all internal</span>
        <button type="button" class="btn sec sm" data-act="apply-all" disabled=${busy} onClick=${all}>Apply all ${kinds[batch]}</button></div>` : null}
      ${cards.map(x => html`<${Card} key=${x.id} card=${x} live=${live}/>`)}
    </div>`;
  }
  function CardsLive(props) {
    const ctx = M.useCtx();
    const live = useLive(ctx);
    return html`<${CardList} ...${props} live=${live}/>`;
  }
  /* the cards anywhere: inside the COO tab they read its feed, elsewhere their own */
  function CooCards(props) {
    const live = useContext(LiveCtx);
    if (!has()) return null;
    return live ? html`<${CardList} ...${props} live=${live}/>` : html`<${CardsLive} ...${props}/>`;
  }

  /* ---------- the charter: generated from the rungs, first person, always true ---------- */
  const CAPS = [
    ['roll', 'Roll call', () => 'take the morning roll call'],
    ['nudge', 'Short asks', () => 'send short asks through the team bots, at most two a day to anyone'],
    ['leave', 'Leave', c => 'approve leave of up to ' + plural(Number((c.leave || {}).maxAutoDays) || 0, 'working day', 'working days') + ' when there are days left, the team is covered and no client date is in the way'],
    ['wfh', 'WFH', () => 'approve WFH days booked ahead, inside the weekly cap'],
    ['cover', 'Cover', () => 'hand internal work to a teammate while someone is away'],
    ['rebalance', 'Rebalance', () => 'move internal work off someone who has too much on'],
    ['shift', 'Due dates', () => 'move internal due dates for leave, blocked work and pile-ups'],
    ['orphans', 'Orphans', () => 'give work with no owner an owner'],
    ['reviews', 'Reviews', () => 'ask reviewers when work waits'],
    ['projects', 'Projects', () => 'post project notes and raise a project to at risk'],
    ['clientMail', 'Client mail', () => 'client follow-ups'],
    ['meetingMail', 'Meeting nudges', () => 'meeting nudges'],
    ['invoiceMail', 'Invoice reminders', () => 'invoice reminders'],
    ['clientDates', 'Client dates', () => 'what to do when a client deadline is at risk'],
    ['memo', 'Reports', () => 'write the morning brief, the close and the weekly memo'],
    ['reviewPrep', 'Friday review', () => 'Friday review marks'],
    ['structure', 'Structure', () => 'changes to the team, roles, lines, access and settings']
  ];
  const RUNGS = ['alone', 'tell', 'draft', 'propose', 'off'];
  const RUNG_LABEL = {alone: 'Alone', tell: 'Tell', draft: 'Draft', propose: 'Propose', off: 'Off'};
  const policySet = c => ['casual', 'sick', 'other'].some(k => ((c.leave || {}).perType || {})[k] != null);
  function charterLines(ctx, team) {
    const c = cfgOf(ctx);
    const caps = c.caps || {};
    const you = team ? 'Kaavish' : 'you';
    const g = {alone: [], tell: [], draft: [], propose: [], off: []};
    for (const [k, , what] of CAPS) {
      let r = RUNGS.indexOf(caps[k]) >= 0 ? caps[k] : 'off';
      let text = what(c);
      /* fail closed: with no leave days set, leave and WFH only ever reach Kaavish as a proposal */
      if ((k === 'leave' || k === 'wfh') && (r === 'alone' || r === 'tell') && !policySet(c)) { r = 'propose'; text = k === 'leave' ? 'leave decisions, until the leave days are set' : 'WFH decisions, until the leave days are set'; }
      g[r].push(text);
    }
    const out = [];
    if (g.alone.length) out.push({k: 'alone', t: 'What I do on my own: ' + and(g.alone) + '.'});
    if (g.tell.length) out.push({k: 'tell', t: 'What I do and then tell ' + you + ': ' + and(g.tell) + '. ' + (team ? 'He' : 'You') + ' can undo any of it.'});
    if (g.draft.length) out.push({k: 'draft', t: 'What I only draft: ' + and(g.draft) + '. Nothing leaves the team until ' + (team ? 'Kaavish taps Send' : 'you tap Send') + '.'});
    if (g.propose.length) out.push({k: 'propose', t: 'What I only propose: ' + and(g.propose) + '.'});
    if (g.off.length) out.push({k: 'off', t: 'What I leave alone for now: ' + and(g.off) + '.'});
    out.push({k: 'never', t: 'What I never do: move or pay money, decline leave, move a client deadline, mark work done, score anyone, read private notes or direct messages, or delete anything.'});
    return out;
  }
  function CharterText({team}) {
    const ctx = M.useCtx();
    return html`<div class="coo-charter-text stack tight">${charterLines(ctx, team).map(l => html`<p key=${l.k} class=${'coo-charter-line' + (l.k === 'never' ? ' never' : '')} data-rung=${l.k}>${l.t}</p>`)}</div>`;
  }

  /* the team's view, Me > COO: what it does, what it never does, how to ask for an undo */
  function CooCharter() {
    const ctx = M.useCtx();
    const c = cfgOf(ctx);
    const st = stateOf(c, nowOf(ctx));
    const name = titleOf(ctx);
    const status = {off: 'Switched off right now.', paused: 'Paused right now.', practice: 'In its practice week: it plans and changes nothing.', on: 'On, working the day.'}[st];
    return html`<section class="card coo-charter" id="coo-charter">
      <div class="row nowrap coo-charter-head">
        <${CooFace} size=${56} label=${name}/>
        <div class="grow">
          <div class="micro">the charter</div>
          <h2 class="card-title coo-charter-title">${name} <span class="pill coo-pill">bot</span></h2>
          <div class="small ink62">A bot that helps Kaavish run the day. ${status}</div>
        </div>
      </div>
      <${CharterText} team=${!ctx.isFounder}/>
      <div class="coo-charter-foot stack tight">
        <div class="small"><b>If it changed something of yours.</b> Every move comes with a note on the task and a message from it. Ask Kaavish and he can put it back, until the window closes.</div>
        <div class="small"><b>What it reads.</b> Tasks, check-ins, leave and the calendar. Never your notes, Care, Break or your direct messages with others. Kaavish reads what you send it.</div>
      </div>
    </section>`;
  }

  /* ---------- the morning digest ---------- */
  function CooDigest({live, compact, onDone}) {
    const ctx = M.useCtx();
    const own = useContext(LiveCtx);
    const L = live || own || EMPTY;
    if (!ctx.isFounder || !has()) return null;
    const row = briefOf(ctx, rowsOf(L));
    if (!row) return null;
    const cards = openCards(L);
    const s = say(ctx, row);
    return html`<section class=${'coo-digest' + (compact ? ' compact' : ' card')} id=${compact ? 'coo-digest-pop' : 'coo-digest'}>
      <div class="row nowrap coo-digest-head"><${CooFace} size=${compact ? 24 : 28} label=${titleOf(ctx)}/>
        <span class="micro grow">morning brief, ${hm(row.at)}</span>
        ${onDone ? html`<button type="button" class="iconbtn" aria-label="Done with the brief" onClick=${onDone}><${icons.x}/></button>` : null}</div>
      <div class="coo-digest-line">${s.line}</div>
      ${cards.length ? html`<ul class="coo-digest-list small">${cards.slice(0, 3).map(x => html`<li key=${x.id}>${x.title || say(ctx, x).line}</li>`)}</ul>` : null}
      <div class="row">
        <button type="button" class="btn sm" onClick=${() => { if (onDone) onDone(); M.nav('#coo'); }}>${cards.length ? 'Open Needs you' : 'Open the COO'}</button>
      </div>
    </section>`;
  }

  /* ---------- the COO tab ---------- */
  function Hero({live}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const c = cfgOf(ctx);
    const now = nowOf(ctx);
    const st = stateOf(c, now);
    const N = live.now || {};
    const cur = N.code || N.job ? say(ctx, N) : null;
    const last = Number((N.pass && N.pass.at) || (live.health && live.health.beat && (live.health.beat.at || live.health.beat))) || 0;
    const next = Number(N.next && N.next.at) || 0;
    const h = Number(hm(now).slice(0, 2));
    const stale = st !== 'off' && st !== 'paused' && site() && h >= 9 && h < 21 && (!last || now - last > 30 * 60000);
    const clock = st === 'off' ? 'Off. Switch me on here or in Admin.'
      : st === 'paused' ? 'Paused by you until ' + dayName(until(c.pausedUntil)) + ' ' + hm(until(c.pausedUntil)) + '.'
      : !site() ? 'I work while m360 is open on your device.' + (last ? ' Last round ' + hm(last) + '.' : '')
      : (last ? 'Last round ' + hm(last) + '.' : 'No round yet today.') + (next ? ' Next ' + hm(next) + '.' : '');
    const value = st === 'off' ? 'off' : st === 'paused' ? 'pause' : 'on';
    const set = async v => {
      if (v === value) return;
      setBusy(true);
      if (v === 'off') await act(() => M.coo.stop(ctx), 'Off. Open undo windows stay open.');
      else if (v === 'pause') await act(() => M.coo.pause(ctx, tomorrowAt9(now)), 'Paused until tomorrow 09:00');
      else if (st === 'paused') await act(() => M.coo.resume(ctx), 'Back on');
      else await switchOn(ctx).catch(() => {});
      setBusy(false);
    };
    const pend = until(c.practiceUntil);
    return html`<header class="hero ink coo-hero">
      <div class="coo-hero-grid">
        <div class="coo-hero-office"><${OfficeSlot} mode="coo"/></div>
        <div class="coo-hero-side stack">
          <div class="row nowrap coo-hero-name"><${CooFace} size=${40} label=${titleOf(ctx)}/>
            <div><${UI.Micro}>${'the ' + titleOf(ctx).toLowerCase() + ', ' + {off: 'off', paused: 'paused', practice: 'practice', on: 'working'}[st]}<//>
              <h1 class="hi coo-hero-title">${titleOf(ctx)}</h1></div></div>
          ${cur && cur.line ? html`<div class="coo-bubble" role="status"><b>${cur.line}</b>${cur.why ? html`<span>${cur.why}</span>` : null}</div>` : null}
          <div class=${'small coo-clock' + (stale ? ' late' : '')} id="coo-clock">${stale && last ? 'No heartbeat since ' + hm(last) + '. I will catch up on the next round.' : clock}</div>
          <div class="coo-switch" id="coo-switch" aria-busy=${busy}>
            <${UI.Seg} options=${[{v: 'on', label: 'On'}, {v: 'pause', label: 'Pause until tomorrow'}, {v: 'off', label: 'Off'}]} value=${value} onChange=${set} ariaLabel="The COO"/>
          </div>
          ${st === 'practice' ? html`<div class="coo-practice" id="coo-practice">
            <div class="small">Practice week. I plan everything and change nothing until ${U.DAYS[shift(pend).getUTCDay()].replace(/^./, x => x.toUpperCase())}.</div>
            <button type="button" class="btn sm on-dark" id="coo-end-practice" onClick=${() => act(() => M.coo.endPractice(ctx), 'Practice is over. I act from the next round.')}>End practice now</button>
          </div>` : null}
        </div>
      </div>
    </header>`;
  }

  function RowDrawer({row, onClose}) {
    const ctx = M.useCtx();
    const s = say(ctx, row);
    const keys = o => o && typeof o === 'object' ? Object.keys(o) : [];
    const val = v => v == null || v === '' ? 'none' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    const checks = list(row.checks), facts = list(row.facts), told = list(row.told);
    const fields = Array.from(new Set(keys(row.before).concat(keys(row.after))));
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${s.line || 'One act'}>
      <div class="stack coo-row-drawer" id="coo-row-drawer">
        ${s.why ? html`<div class="small">${s.why}</div>` : null}
        <div class="tiny ink62">${slotName(row.slot)}, ${hm(row.at)}${row.rung ? ', rung ' + row.rung : ''}${row.charter ? ', charter v' + row.charter : ''}${row.status ? ', ' + row.status : ''}</div>
        ${checks.length ? html`<div><${UI.Micro}>checks<//><table class="tbl coo-tbl"><tbody>${checks.map((k, i) => html`<tr key=${i}>
          <td>${k.ok === false ? html`<b class="flame-t">×</b>` : '✓'}</td><td>${CHECK[k.k] || k.k}</td><td class="num">${val(k.val)}</td><td class="num ink62">${k.limit != null ? 'limit ' + val(k.limit) : ''}</td></tr>`)}</tbody></table></div>` : null}
        ${facts.length ? html`<div><${UI.Micro}>facts<//><table class="tbl coo-tbl"><tbody>${facts.map((k, i) => html`<tr key=${i}>
          <td>${k.k}</td><td class="num">${val(k.val)}</td><td class="tiny ink62">${k.src || ''}</td></tr>`)}</tbody></table></div>` : null}
        ${fields.length ? html`<div><${UI.Micro}>before and after<//><table class="tbl coo-tbl"><tbody>${fields.map(k => html`<tr key=${k}>
          <td>${k}</td><td class="num">${val((row.before || {})[k])}</td><td class="num"><b>${val((row.after || {})[k])}</b></td></tr>`)}</tbody></table></div>` : null}
        ${told.length ? html`<div><${UI.Micro}>who was told<//><div class="stack tight">${told.map((t, i) => html`<div class="coo-told-line" key=${i}>
          <div class="tiny ink62"><${UI.Name} id=${t.uid}/>${t.at ? ', ' + hm(t.at) : ''}</div><div class="small">${t.text}</div></div>`)}</div></div>` : null}
      </div>
    <//>`;
  }

  function Today({live, onRow}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState('');
    const now = nowOf(ctx);
    const rows = rowsOf(live);
    if (!rows.length) return html`<${UI.Empty} text="Nothing yet today. The day opens at 09:00."/>`;
    const groups = [];
    for (const r of rows) {
      const k = r.slot || 'now';
      let g = groups.find(x => x.k === k);
      if (!g) { g = {k, rows: []}; groups.push(g); }
      g.rows.push(r);
    }
    const undo = async id => { setBusy(id); await act(() => M.coo.undo(ctx, id)); setBusy(''); };
    return html`<div class="coo-today">${groups.map(g => html`<div class="coo-slot" key=${g.k}>
      <div class="micro plain coo-slot-name">${slotName(g.k)}</div>
      <ol class="coo-rows">${g.rows.map(r => {
        const s = say(ctx, r);
        return html`<li class=${'coo-row' + (r.status === 'would' ? ' would' : '') + (r.status === 'failed' || r.status === 'conflict' || r.status === 'refused' ? ' bad' : '')} key=${r.id} data-id=${r.id} data-status=${r.status || ''}>
          <button type="button" class="coo-row-main rowbtn" onClick=${() => onRow(r)}>
            <${Glyph} st=${stationOf(r)}/>
            <span class="grow"><span class="coo-row-line">${s.line || codeOf(r)}</span>${s.why ? html`<span class="coo-row-why tiny ink62">${s.why}</span>` : null}</span>
            <span class="tiny ink62 num">${hm(r.at)}</span>
          </button>
          ${canUndo(r, now) ? html`<button type="button" class="btn sec sm" data-act="undo" disabled=${busy === r.id} onClick=${() => undo(r.id)}>Undo until ${hm(undoBy(r))}</button>`
            : r.status === 'undone' ? html`<span class="tiny ink62 coo-undone">Undone by <${UI.Name} id=${r.undoneBy || ctx.founderUid} fallback="Kaavish"/> ${hm(Number(r.undoneAt || (r.undone && r.undone.at)) || r.at)}</span>`
            : r.status === 'would' ? html`<span class="pill">practice</span>`
            : r.status === 'conflict' ? html`<span class="tiny flame-t">Changed since, kept as it is</span>` : null}
        </li>`;
      })}</ol>
    </div>`)}</div>`;
  }

  function Watching({live}) {
    const ctx = M.useCtx();
    let items = [];
    try { items = list((M.coo.watching ? M.coo.watching(ctx) : null) || (live.now && live.now.watch)); } catch (e) { items = []; }
    const next = live.now && live.now.next;
    return html`<div class="stack tight coo-watch" id="coo-watching">
      ${next && next.at ? html`<div class="row nowrap small"><${Glyph} st="clock"/><span class="grow">${/^Round /.test(slotName(next.slot)) ? 'Next round at ' + hm(next.at) : 'Next: ' + slotName(next.slot) + ' at ' + hm(next.at)}.</span></div>` : null}
      ${items.length ? items.map((w, i) => { const s = say(ctx, w); return html`<div class="row nowrap small" key=${w.id || i}><${Glyph} st=${stationOf(w)}/><span class="grow">${s.line}${s.why ? html` <span class="ink62">${s.why}</span>` : null}</span>${w.at ? html`<span class="tiny ink62 num">${dayName(w.at)} ${hm(w.at)}</span>` : null}</div>`; })
        : html`<${UI.Empty} text="Nothing on the watch list right now."/>`}
    </div>`;
  }

  function Memo() {
    const ctx = M.useCtx();
    const wk = M.coo && M.coo.ist && M.coo.ist.isoWeek ? M.coo.ist.isoWeek(nowOf(ctx)) : U.isoWeek(shift(nowOf(ctx)));
    const doc = M.useDoc(ctx.db, ctx.isFounder ? 'coo/memo-' + wk : null);
    const m = doc.data;
    const day = U.cap(cfgOf(ctx).memoDay || 'sat');
    if (!m) return html`<${UI.Empty} text=${'The weekly memo lands on ' + day + ' at 12:00.'}/>`;
    const nums = m.numbers && typeof m.numbers === 'object' ? Object.keys(m.numbers) : [];
    const text = m.text || m.prose || list(m.lines).map(l => (typeof l === 'string' ? l : l.text)).join('\n');
    return html`<div class="stack tight coo-memo" id="coo-memo">
      ${nums.length ? html`<div class="row coo-memo-nums">${nums.map(k => html`<span key=${k} class="pill"><b class="num">${m.numbers[k]}</b> ${k}</span>`)}</div>` : null}
      ${text ? html`<div class="small coo-memo-text">${text}</div>` : null}
      <${CooCards} filter="memo" empty="No memo waits for a tap."/>
    </div>`;
  }

  const ZERO = {hours: 'acts outside hours', caps: 'over a cap', leave: 'on someone on leave', client: 'on client-dated work', double: 'done twice',
    refused: 'refused writes', focus: 'asks during focus', mail: 'client mail without your tap'};
  function Health({live}) {
    const ctx = M.useCtx();
    const [st, setSt] = useState(null);
    useEffect(() => {
      if (!site() || !ctx.isFounder) return undefined;
      let on = true;
      window.M360_API('coostatus', {}).then(r => { if (on) setSt(r || null); }, () => {});
      return () => { on = false; };
    }, []);
    let h = null;
    try { h = (M.coo.health ? M.coo.health(ctx) : null) || live.health || null; } catch (e) { h = live.health || null; }
    h = {...(h || {}), ...(st || {})};
    const now = nowOf(ctx);
    const beat = Number((h.beat && h.beat.at) || h.beat) || 0;
    const ai = h.ai || (h.aiUsed != null ? {used: h.aiUsed, cap: (cfgOf(ctx).limits || {}).aiPerDay} : null);
    const runner = h.runner || (site() ? 'server' : 'page');
    const okWord = v => v === true || v === 'ok' || v === 'on' || v === 'set';
    const zero = h.zero && typeof h.zero === 'object' ? h.zero : null;
    const rows = [
      ['beat', runner === 'server' ? 'Heartbeat' : 'Runner', beat ? 'last round ' + hm(beat) + ', ' + U.timeAgo(beat) : 'no round yet today', !beat || now - beat > 30 * 60000],
      ['runner', 'Runs on', runner === 'server' ? 'the server, every 15 minutes, 09:00 to 21:00' : 'this page, while it is open on your device', false],
      ai ? ['ai', 'AI used today', (ai.used || 0) + ' of ' + (ai.cap || 40), (ai.used || 0) >= (ai.cap || 40)] : null,
      h.mail != null ? ['mail', 'Mail', okWord(h.mail) ? 'set up' : 'not set up, so drafts wait. Admin, Email sending.', !okWord(h.mail)] : null,
      h.google != null ? ['google', 'Google', okWord(h.google) ? 'connected' : 'not connected. Admin, Google Workspace.', !okWord(h.google)] : null
    ].filter(Boolean);
    return html`<div class="stack tight coo-health" id="coo-health">
      ${rows.map(([k, l, v, hot]) => html`<div class="row between nowrap small" key=${k} data-k=${k}><span>${l}</span><span class=${'coo-health-v' + (hot ? ' flame-t' : '')}>${v}</span></div>`)}
      ${zero ? html`<div class="row coo-zero">${Object.keys(ZERO).filter(k => zero[k] != null).map(k => html`<span key=${k} class=${'pill' + (zero[k] ? ' flame' : '')} data-zero=${k}>${ZERO[k]}: ${zero[k]}</span>`)}</div>` : null}
    </div>`;
  }

  /* K4: switch off and put today's undoable acts back, each one checked against what is there now */
  function StopAll({live, onClose}) {
    const ctx = M.useCtx();
    const now = nowOf(ctx);
    const rows = rowsOf(live).filter(r => canUndo(r, now));
    const [ticked, setTicked] = useState(() => new Set(rows.map(r => r.id)));
    const [busy, setBusy] = useState(false);
    const go = async () => {
      setBusy(true);
      await act(() => M.coo.stop(ctx));
      let ok = 0, held = 0;
      for (const r of rows.filter(x => ticked.has(x.id))) {
        try { const res = await M.coo.undo(ctx, r.id); if (res && res.ok !== false && !res.conflict) ok++; else held++; } catch (e) { held++; }
      }
      setBusy(false);
      M.toast('The COO is off. ' + plural(ok, 'act', 'acts') + ' put back' + (held ? ', ' + held + ' changed since and kept' : '') + '.', held > 0);
      onClose();
    };
    const flip = id => setTicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Stop and undo today"
      footer=${html`<button type="button" class="btn flame" id="coo-stop-go" disabled=${busy} onClick=${go}>${rows.length ? 'Switch off and undo ' + ticked.size : 'Switch off'}</button>`}>
      <div class="stack tight" id="coo-stop">
        <div class="small">This switches the COO off and puts back what it changed today. Anything a person changed since stays as they left it.</div>
        ${rows.length ? rows.map(r => html`<${UI.Check} key=${r.id} checked=${ticked.has(r.id)} onChange=${() => flip(r.id)} label=${say(ctx, r).line || codeOf(r)}/>`)
          : html`<${UI.Empty} text="Nothing to undo today."/>`}
      </div>
    <//>`;
  }

  function Coo() {
    const ctx = M.useCtx();
    const live = useLive(ctx);
    const [row, setRow] = useState(null);
    const [charter, setCharter] = useState(false);
    const [stop, setStop] = useState(false);
    if (!ctx.isFounder) return html`<${CooCharter}/>`;
    if (!has()) return html`<div id="coo-tab"><${UI.Card} title="m360 COO"><${UI.Empty} text="The COO is not part of this build."/><//></div>`;
    const cards = openCards(live);
    const done = rowsOf(live).filter(r => r.status === 'done' || r.status === 'would').length;
    const needs = html`<section class="card coo-needs" id="coo-needs">
      <div class="card-head"><h2 class="card-title">Needs you</h2>${cards.length ? html`<span class="pill flame-o">${cards.length} waiting</span>` : null}</div>
      <${CardList} live=${live}/>
    </section>`;
    return html`<${LiveCtx.Provider} value=${live}><div class="stack coo-page" id="coo-tab">
      <${Hero} live=${live}/>
      <${CooDigest} live=${live}/>
      ${M.fx && M.fx.Beam ? html`<${M.fx.Beam} on=${cards.length > 0 && cards.length <= 3}>${needs}<//>` : needs}
      <div class="split">
        <div class="stack">
          <${UI.Fold} title="Today" summary=${plural(done, 'act', 'acts') + ' so far'} open=${true} id="fold-coo-today"><section class="card" id="coo-today">
            <div class="card-head"><h2 class="card-title">Today</h2><span class="tiny ink62">tap a line for the checks and who was told</span></div>
            <${Today} live=${live} onRow=${setRow}/>
          </section><//>
          <${UI.Fold} title="This week" summary="the weekly memo" id="fold-coo-week"><section class="card"><div class="card-head"><h2 class="card-title">This week</h2></div><${Memo}/></section><//>
        </div>
        <div class="stack">
          <${UI.Fold} title="Watching" summary="what comes next, and when" id="fold-coo-watch"><section class="card"><div class="card-head"><h2 class="card-title">Watching</h2></div><${Watching} live=${live}/></section><//>
          <${UI.Fold} title="Health" summary="heartbeat, AI, mail and the zero checks" id="fold-coo-health"><section class="card"><div class="card-head"><h2 class="card-title">Health</h2></div><${Health} live=${live}/></section><//>
          <section class="card coo-ends">
            <div class="row between"><span class="small">The charter, in plain words</span><button type="button" class="linky small" id="coo-charter-open" onClick=${() => setCharter(true)}>Read it</button></div>
            <div class="row between"><span class="small">Switch off and put today back</span><button type="button" class="btn sec sm" id="coo-stop-open" onClick=${() => setStop(true)}>Stop and undo today</button></div>
          </section>
        </div>
      </div>
      ${row ? html`<${RowDrawer} row=${row} onClose=${() => setRow(null)}/>` : null}
      ${charter ? html`<${UI.Drawer} open=${true} onClose=${() => setCharter(false)} title="The charter"><${CooCharter}/><//>` : null}
      ${stop ? html`<${StopAll} live=${live} onClose=${() => setStop(false)}/>` : null}
    </div><//>`;
  }

  /* ---------- Admin: the mandate and the policy ---------- */
  /* a number field that saves when it loses focus; empty means not set */
  function Num({value, onSave, label, step, id}) {
    const [v, setV] = useState(value == null ? '' : String(value));
    useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
    const commit = () => {
      const t = String(v).trim();
      const n = t === '' ? null : Number(t);
      if (n !== null && !isFinite(n)) { setV(value == null ? '' : String(value)); return; }
      if (n !== (value == null ? null : Number(value))) onSave(n);
    };
    return html`<input class="input coo-num num" type="number" min="0" step=${step || 1} id=${id} aria-label=${label} placeholder="not set" value=${v}
      onInput=${e => setV(e.target.value)} onBlur=${commit} onKeyDown=${e => { if (e.key === 'Enter') e.target.blur(); }}/>`;
  }
  const LIMITS = [['actsPerDay', 'acts a day'], ['tellPerDay', 'tell acts a day'], ['movesPerDay', 'task moves a day'], ['movesPerPersonDay', 'moves per person a day'],
    ['shiftsPerDay', 'due date moves a day'], ['leaveApprovalsPerDay', 'leave approvals a day'], ['asksPerDay', 'asks a day'], ['asksPerPersonDay', 'asks per person a day'],
    ['draftsPerDay', 'drafts a day'], ['aiPerDay', 'AI calls a day']];
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function Rungs({c, save, breakers}) {
    const ctx = M.useCtx();
    const ceil = (M.coo && M.coo.CEIL) || {};
    const caps = c.caps || {};
    const reset = k => ctx.W.merge('coo/state', {breakers: {[k]: null}}).then(() => M.toast('Reset'), () => {});
    return html`<div class="coo-rungs" id="coo-rungs">${CAPS.map(([k, label]) => {
      const top = ceil[k] ? RUNGS.indexOf(ceil[k]) : 0;
      const b = breakers && breakers[k];
      return html`<div class="coo-rung-row" key=${k} data-cap=${k}>
        <span class="small coo-rung-name">${label}</span>
        <div class="seg sm coo-rung" role="radiogroup" aria-label=${label}>${RUNGS.map((r, i) => html`<button key=${r} type="button" role="radio" data-rung=${r}
          aria-checked=${caps[k] === r} class=${'seg-btn' + (caps[k] === r ? ' active' : '')} disabled=${i < top}
          title=${i < top ? 'Held at ' + ceil[k] + ' in code' : ''} onClick=${() => caps[k] !== r && save({caps: {[k]: r}})}>${RUNG_LABEL[r]}</button>`)}</div>
        ${b ? html`<div class="tiny flame-t coo-breaker">Lowered on ${b.at ? U.fmtDay(ymdIST(b.at)) : 'a recent day'}${b.why ? ': ' + b.why : ''}. <button type="button" class="linky tiny" onClick=${() => reset(k)}>Reset</button></div>` : null}
      </div>`;
    })}</div>`;
  }
  function Setup({c}) {
    const ctx = M.useCtx();
    const [seen, setSeen] = useState(() => M.prefs.get('cooClientDated', '') === '1');
    const yr = String(shift(nowOf(ctx)).getUTCFullYear());
    const hol = (ctx.settings.holidays || []).some(d => String(d).startsWith(yr));
    const pm = !!(ctx.settings.pm && ctx.settings.pm.on);
    let h = null;
    try { h = M.coo && M.coo.health ? M.coo.health(ctx) : null; } catch (e) { h = null; }
    const ok = v => v === true || v === 'ok' || v === 'on' || v === 'set';
    const steps = [
      {k: 'leave', done: policySet(c), t: 'Leave days per type', d: 'Until they are set, every leave and WFH request comes to you.', go: () => { const el = document.getElementById('coo-leave'); if (el) el.scrollIntoView({block: 'center'}); }},
      {k: 'holidays', done: hol, t: 'Holidays for ' + yr, d: 'Working days come from the holidays list.', go: () => M.nav('#admin')},
      {k: 'client', done: seen, t: 'Client dates are never moved', d: 'A task with a client, on a client project, or due on its project date counts as client dated until you mark it internal in the task.', go: () => { M.prefs.set('cooClientDated', '1'); setSeen(true); }, label: 'Got it'},
      {k: 'pm', done: true, t: 'Personal managers are ' + (pm ? 'on' : 'off'), d: pm ? 'The COO never asks about what a manager\'s bot already chases.' : 'The COO reports and proposes switching them on, once a week.'},
      ctx.isOwner ? {k: 'chase', done: true, t: 'Invoice chasing waits for you', d: 'While the COO is on, reminders wait as drafts for your tap.'} : null,
      site() ? {k: 'mail', done: !!(h && ok(h.mail)), t: 'Mail set up', d: 'Sends and the away note go through it.'} : null,
      site() ? {k: 'google', done: !!(h && ok(h.google)), t: 'Google connected', d: 'Meeting nudges read your calendar.'} : null
    ].filter(Boolean);
    return html`<div class="coo-setup stack tight" id="coo-setup">${steps.map(s => html`<div class=${'coo-step row nowrap' + (s.done ? ' done' : '')} key=${s.k} data-step=${s.k}>
      <span class="coo-step-tick">${s.done ? '✓' : ''}</span>
      <span class="grow"><b class="small">${s.t}</b><span class="tiny ink62 coo-step-d">${s.d}</span></span>
      ${!s.done && s.go ? html`<button type="button" class="linky tiny" onClick=${s.go}>${s.label || 'Set it'}</button>` : null}
    </div>`)}</div>`;
  }
  function AdminCard() {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const st = M.useDoc(ctx.db, ctx.isFounder && has() ? 'coo/state' : null);
    if (!ctx.isFounder || !has()) return null;
    const c = cfgOf(ctx);
    const now = nowOf(ctx);
    const s = stateOf(c, now);
    const save = async patch => { setBusy(true); try { await saveCoo(ctx, patch); M.toast('Saved'); } catch (e) { /* toasted */ } setBusy(false); };
    const L = c.leave || {}, P = L.perType || {}, N = L.noticeDays || {}, lim = c.limits || {}, ld = c.load || {};
    const practice = until(c.practiceUntil) > now;
    const master = async v => { setBusy(true); if (v) await switchOn(ctx).catch(() => {}); else await act(() => M.coo.stop(ctx), 'Off'); setBusy(false); };
    return html`<${UI.Card} id="coo-admin" title=${titleOf(ctx)} action=${html`<${CooFace} size=${28} label=${titleOf(ctx)}/>`}>
      <p class="small ink62">A bot colleague that runs the day inside the mandate below. It only ever lowers itself; only you raise a rung.</p>
      <div class="stack tight">
        <div class="row between fx-bell-row"><span>The COO</span>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="coo-on" size="sm" badge=${false} offLabel="Off" onLabel=${s === 'paused' ? 'On, paused' : 'On'} pressed=${!!c.on} disabled=${busy} onChange=${v => master(!!v)}/>`
            : html`<button type="button" class="chip" id="coo-on" aria-pressed=${!!c.on} onClick=${() => master(!c.on)}>${c.on ? 'On' : 'Off'}</button>`}</div>
        <div class="row between"><span>Practice week ${practice ? html`<span class="tiny ink62">until ${dayName(until(c.practiceUntil))}</span>` : null}</span>
          <${UI.Seg} sm=${true} ariaLabel="Practice week" options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${practice ? 'on' : 'off'}
            onChange=${v => v === 'on' ? save({practiceUntil: practiceEnd(ctx, now)}) : act(() => M.coo.endPractice(ctx), 'Practice is over')}/></div>
        <div class="row between"><span>Runs on</span><span class="small ink62" id="coo-runner">${site() ? 'the server heartbeat' : 'this page, while it is open'}</span></div>
        <div class="row between coo-title-row"><span>Its name</span>
          <input class="input coo-title-in" aria-label="Its name" value=${c.title || ''} placeholder="m360 COO"
            onBlur=${e => { const t = e.target.value.trim().slice(0, 40); if (t && t !== c.title) save({title: t}); }}/></div>
      </div>

      <div class="coo-sec"><div class="micro">what it may do</div>
        <div class="tiny ink62">Alone: does it and logs it. Tell: does it, tells you why, undo for a day. Draft: you tap to send. Propose: you apply it as yourself. The grey rungs are held in code.</div>
        <${Rungs} c=${c} save=${save} breakers=${st.data && st.data.breakers}/></div>

      <div class="coo-sec" id="coo-leave"><div class="micro">leave policy</div>
        <div class="coo-grid">
          ${['casual', 'sick', 'other'].map(k => html`<label class="coo-field" key=${k}><span class="small">${U.cap(k)} days a year</span><${Num} id=${'coo-days-' + k} label=${U.cap(k) + ' days a year'} value=${P[k]} onSave=${n => save({leave: {perType: {[k]: n}}})}/></label>`)}
          ${['casual', 'sick', 'other'].map(k => html`<label class="coo-field" key=${'n' + k}><span class="small">${U.cap(k)} notice, days</span><${Num} label=${U.cap(k) + ' notice in days'} value=${N[k]} onSave=${n => save({leave: {noticeDays: {[k]: n == null ? 0 : n}}})}/></label>`)}
          <label class="coo-field"><span class="small">Most working days it approves</span><${Num} label="Most working days it approves" value=${L.maxAutoDays} onSave=${n => save({leave: {maxAutoDays: n == null ? 0 : n}})}/></label>
          <label class="coo-field"><span class="small">Most people out a day</span><${Num} label="Most people out a day" value=${L.maxOutPerDay} onSave=${n => save({leave: {maxOutPerDay: n == null ? 0 : n}})}/></label>
          <label class="coo-field"><span class="small">Most out per pod</span><${Num} label="Most out per pod" value=${L.maxOutPerPod} onSave=${n => save({leave: {maxOutPerPod: n == null ? 0 : n}})}/></label>
          <label class="coo-field"><span class="small">The leave year starts</span><input class="input coo-num" aria-label="The leave year starts" placeholder="04-01" value=${L.yearStart || ''}
            onBlur=${e => /^\d{2}-\d{2}$/.test(e.target.value.trim()) && e.target.value.trim() !== L.yearStart && save({leave: {yearStart: e.target.value.trim()}})}/></label>
        </div>
        <div class="row between"><span class="small">Sick leave in probation, unpaid</span>
          <${UI.Seg} sm=${true} ariaLabel="Sick leave in probation" options=${[{v: 'no', label: 'To you'}, {v: 'yes', label: 'Allowed'}]} value=${L.probationLop ? 'yes' : 'no'} onChange=${v => save({leave: {probationLop: v === 'yes'}})}/></div>
        <label class="coo-field wide"><span class="small">Blackout dates, comma separated</span><input class="input" aria-label="Blackout dates" placeholder="2026-12-24, 2026-12-31" value=${list(L.blackout).join(', ')}
          onBlur=${e => { const ds = e.target.value.split(',').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)); if (ds.join(',') !== list(L.blackout).join(',')) save({leave: {blackout: ds}}); }}/></label>
        <label class="coo-field"><span class="small">WFH: fewest people in the office (0 is off)</span><${Num} label="Fewest people in the office" value=${(c.wfh || {}).minOffice} onSave=${n => save({wfh: {minOffice: n == null ? 0 : n}})}/></label>
      </div>

      <div class="coo-sec"><div class="micro">load lines</div>
        <div class="coo-grid">
          <label class="coo-field"><span class="small">Open tasks a person carries</span><${Num} label="Open tasks a person carries" value=${ld.maxOpen} onSave=${n => save({load: {maxOpen: n == null ? 12 : n}})}/></label>
          <label class="coo-field"><span class="small">Overdue a person carries</span><${Num} label="Overdue a person carries" value=${ld.maxOverdue} onSave=${n => save({load: {maxOverdue: n == null ? 3 : n}})}/></label>
          <label class="coo-field"><span class="small">Margin over the team median</span><${Num} label="Margin over the team median" step="0.1" value=${ld.margin} onSave=${n => save({load: {margin: n == null ? 1.5 : n}})}/></label>
        </div></div>

      <div class="coo-sec"><div class="micro">limits</div>
        <div class="coo-grid">${LIMITS.map(([k, l]) => html`<label class="coo-field" key=${k}><span class="small">${U.cap(l)}</span><${Num} label=${U.cap(l)} value=${lim[k]} onSave=${n => n != null && save({limits: {[k]: n}})}/></label>`)}</div></div>

      <div class="coo-sec"><div class="micro">reports</div>
        <div class="row between"><span class="small">The close by email</span>
          <${UI.Seg} sm=${true} ariaLabel="The close by email" options=${[{v: 'away', label: 'When away'}, {v: 'always', label: 'Always'}, {v: 'off', label: 'Off'}]} value=${(c.digest || {}).mail || 'away'} onChange=${v => save({digest: {mail: v}})}/></div>
        <div class="row between"><span class="small">The weekly memo on</span>
          <${UI.Seg} sm=${true} ariaLabel="The weekly memo on" options=${DAYS.map(d => ({v: d, label: U.cap(d)}))} value=${c.memoDay || 'sat'} onChange=${v => save({memoDay: v})}/></div>
      </div>

      <div class="coo-sec"><div class="micro">setup</div><${Setup} c=${c}/></div>
      <div class="coo-sec"><div class="micro">the charter, as it reads today</div><${CharterText}/></div>
    <//>`;
  }
  AdminCard.foldTitle = 'm360 COO';
  AdminCard.foldSummary = 'the mandate, the policy and the charter';
  M.adminCards.push(AdminCard);

  /* ---------- Home: the studio now, and the founder's digest ---------- */
  function StudioNow() {
    const ctx = M.useCtx();
    const inFold = useContext(UI.FoldCtx);
    const [open, setOpen] = useState(() => ctx.isFounder || M.prefs.get('studioOpen', '0') === '1');
    const show = open || inFold;
    return html`<section class="card coo-studio" id="studio-now">
      <div class="card-head"><h2 class="card-title">The studio now</h2>
        ${show && !inFold && !ctx.isFounder ? html`<button type="button" class="linky small" onClick=${() => { M.prefs.set('studioOpen', '0'); setOpen(false); }}>Close</button>` : null}
        ${!show ? html`<button type="button" class="linky small" id="studio-look" onClick=${() => { M.prefs.set('studioOpen', '1'); setOpen(true); }}>Look in</button>` : null}</div>
      ${show ? html`<${OfficeSlot} mode="home"/>` : html`<div class="small ink62">The office, live: who is in, and what the COO is doing.</div>`}
    </section>`;
  }
  function HomeDigest() {
    const ctx = M.useCtx();
    const live = useLive(ctx);
    const td = ymdIST(nowOf(ctx));
    const [gone, setGone] = useState(() => M.prefs.get('cooDigestHome', '') === td);
    if (gone || !ctx.isFounder) return null;
    return html`<${CooDigest} live=${live} onDone=${() => { M.prefs.set('cooDigestHome', td); setGone(true); }}/>`;
  }

  /* the runner: M.coo's own component, mounted once on HQ and Home; it draws nothing */
  function CooRunner() {
    const R = M.coo && M.coo.Runner;
    return R ? html`<${R}/>` : null;
  }

  /* ---------- for the inbox, the dock and the week ---------- */
  /* the founder's ringing lines: an urgent card, the morning brief once, undo windows closing within the hour */
  function founderItems(ctx) {
    if (!has() || !ctx.isFounder) return [];
    const out = [];
    const now = nowOf(ctx);
    let cards = [], rows = [];
    if (last) { cards = openCards(last); rows = rowsOf(last); }
    else {
      try { cards = list(M.coo.decisions ? M.coo.decisions(ctx) : []).filter(c => !c.status || OPEN[c.status]); } catch (e) { cards = []; }
      try { rows = list(M.coo.feed ? M.coo.feed(ctx, atIST(ymdIST(now), '00:00')) : []); } catch (e) { rows = []; }
    }
    for (const c of cards) if (c.urgent) out.push({id: 'coo:' + c.id, at: Number(c.at) || now, line: c.title || say(ctx, c).line, ref: '#coo', hot: true});
    const b = briefOf(ctx, rows);
    if (b) out.push({id: 'coo:brief:' + ymdIST(b.at), at: Number(b.at), line: say(ctx, b).line, ref: '#coo', hot: false});
    const closing = rows.filter(r => r.status === 'done' && undoBy(r) > now && undoBy(r) - now <= 3600000);
    if (closing.length) {
      const first = Math.min(...closing.map(undoBy));
      out.push({id: 'coo:lock:' + ymdIST(first) + ':' + hm(first), at: first - 3600000, line: plural(closing.length, 'move locks', 'moves lock') + ' at ' + hm(first) + '. Look now?', ref: '#coo', hot: true});
    }
    return out;
  }

  M.cooUi = {version: () => ver, useLive, openCards, rowsOf, briefOf, say, confirmReview, ghostOf, founderItems, isCoo, titleOf, ymdIST, hm};
  M.parts.CooFace = CooFace;
  M.parts.CooCards = CooCards;
  M.parts.CooDigest = CooDigest;
  M.parts.HomeDigest = HomeDigest;
  M.parts.StudioNow = StudioNow;
  M.parts.OfficeSlot = OfficeSlot;
  M.parts.CooRunner = CooRunner;
  M.parts.CooAdminCard = AdminCard;
  M.pages.Coo = Coo;
  M.pages.CooCharter = CooCharter;
})();
