/* module: letters. The HR desk inside the books: offer, appointment, increment, experience, relieving,
   non-disclosure and warning letters for every active member and for candidates at the offer or hired
   stage. Each letter is a set of variables, a body the owner drafts from a template (or has the model
   rewrite), and a status: a draft stays editable, an issued letter carries a reference number and is
   read only. Letters live in hr/<uid>, the owner's alone. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  /* ---------- the kinds ---------- */
  const KINDS = [
    {v: 'offer', label: 'Offer letter'},
    {v: 'appointment', label: 'Appointment letter'},
    {v: 'increment', label: 'Increment letter'},
    {v: 'experience', label: 'Experience letter'},
    {v: 'relieving', label: 'Relieving letter'},
    {v: 'nda', label: 'Non-disclosure agreement'},
    {v: 'warning', label: 'Warning letter'}
  ];
  const LABEL = Object.fromEntries(KINDS.map(k => [k.v, k.label]));
  const ACCEPTS = ['offer', 'appointment', 'nda'];
  const YESNO = [{v: 'yes', label: 'Yes'}, {v: 'no', label: 'No'}];
  const DUES = [{v: 'settled', label: 'Settled'}, {v: 'to be settled', label: 'To be settled'}];
  /* the variables of each kind, after the three every letter carries: who, role, date */
  const COMMON = [
    {k: 'who', label: 'to'},
    {k: 'role', label: 'role'},
    {k: 'date', label: 'letter date', type: 'date'}
  ];
  const FIELDS = {
    offer: [
      {k: 'ctc', label: 'annual CTC, INR', type: 'number'},
      {k: 'start', label: 'start date', type: 'date'},
      {k: 'probationMonths', label: 'probation, months', type: 'number'},
      {k: 'noticeDays', label: 'notice, days', type: 'number'},
      {k: 'reportsTo', label: 'reports to'},
      {k: 'location', label: 'location'},
      {k: 'hours', label: 'working hours'},
      {k: 'acceptBy', label: 'accept by', type: 'date'}
    ],
    appointment: [
      {k: 'ctc', label: 'annual CTC, INR', type: 'number'},
      {k: 'start', label: 'start date', type: 'date'},
      {k: 'probationMonths', label: 'probation, months', type: 'number'},
      {k: 'noticeDays', label: 'notice, days', type: 'number'},
      {k: 'reportsTo', label: 'reports to'},
      {k: 'location', label: 'location'},
      {k: 'empId', label: 'employee id'}
    ],
    increment: [
      {k: 'oldCtc', label: 'current CTC, INR', type: 'number'},
      {k: 'newCtc', label: 'revised CTC, INR', type: 'number'},
      {k: 'effective', label: 'effective from', type: 'date'},
      {k: 'reason', label: 'reason, one line'}
    ],
    experience: [
      {k: 'from', label: 'employed from', type: 'date'},
      {k: 'to', label: 'employed to', type: 'date'},
      {k: 'lastRole', label: 'last role held'}
    ],
    relieving: [
      {k: 'lastDay', label: 'last working day', type: 'date'},
      {k: 'noticeServed', label: 'notice served', options: YESNO},
      {k: 'dues', label: 'dues', options: DUES}
    ],
    nda: [
      {k: 'effective', label: 'effective from', type: 'date'},
      {k: 'years', label: 'runs for, years after leaving', type: 'number'}
    ],
    warning: [
      {k: 'what', label: 'what happened, one line'},
      {k: 'when', label: 'when', type: 'date'},
      {k: 'expected', label: 'what we expect from here, one line'}
    ]
  };
  const fieldsOf = kind => COMMON.concat(FIELDS[kind] || []);

  /* ---------- small helpers ---------- */
  const isCand = uid => String(uid || '').startsWith('cand:');
  const candIdOf = uid => String(uid).slice(5);
  const candOf = (ctx, uid) => isCand(uid) ? (((ctx.coll.candidates || {}).map || {})[candIdOf(uid)] || null) : null;
  const hrMap = ctx => (ctx.coll.hr && ctx.coll.hr.map) || {};
  const lettersOf = (ctx, uid) => {
    const m = ((hrMap(ctx)[uid] || {}).letters) || {};
    return Object.keys(m).filter(id => m[id] && typeof m[id] === 'object').map(id => ({...m[id], id}))
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  };
  const allIssued = ctx => {
    const out = [];
    const map = hrMap(ctx);
    for (const uid of Object.keys(map)) {
      const ls = (map[uid] || {}).letters || {};
      for (const id of Object.keys(ls)) if (ls[id] && ls[id].status === 'issued') out.push({...ls[id], id, uid});
    }
    return out;
  };
  const issuedCount = (ctx, uid) => lettersOf(ctx, uid).filter(l => l.status === 'issued').length;
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const day = s => okDate(s) ? U.fmtDate(s) : (s ? String(s) : '');
  const plusDays = (ymd, n) => U.ymd(U.addDays(U.parseYmd(ymd), n));
  const n0 = v => M.books.num(v);
  const inr = v => M.books.money(n0(v), 'INR');
  const inWords = v => M.books.words(n0(v), 'INR');
  const monthly = v => inr(Math.round(n0(v) / 12));
  const plural = (n, one, many) => n0(n) === 1 ? one : many;
  const clean = s => String(s || '').trim();
  const endStop = s => { const t = clean(s).replace(/[.\s]+$/, ''); return t ? t + '.' : ''; };
  /* a display name for the roster or a candidate: the profile, then the me doc, then the title */
  const nameOf = (ctx, uid, profiles) => {
    const c = candOf(ctx, uid);
    if (c) return clean(c.name) || 'Candidate';
    const p = profiles && profiles[uid];
    if (p && p.name) return p.name;
    const me = ((ctx.coll.me && ctx.coll.me.map) || {})[uid];
    if (me && me.name) return String(me.name);
    const m = (ctx.members || {})[uid];
    return (m && m.title) || 'Teammate';
  };

  /* ---------- the variables, prefilled ---------- */
  function vars(kind, ctx, uid, who) {
    const today = U.todayStr();
    const m = (ctx.members || {})[uid] || {};
    const c = candOf(ctx, uid);
    const sal = ((((ctx.coll.payroll || {}).map || {}).salaries || {}).map || {})[uid] || {};
    const s = M.books.settings(ctx);
    const v = {
      who: who || (c ? clean(c.name) : nameOf(ctx, uid)),
      role: c ? clean(c.role) : (m.title || ''),
      date: today
    };
    const joined = okDate(m.joined) ? m.joined : (okDate(m.start) ? m.start : '');
    const ctc = sal.ctc ? n0(sal.ctc) : '';
    if (kind === 'offer' || kind === 'appointment') {
      v.ctc = ctc;
      v.start = joined || (kind === 'offer' ? plusDays(today, 14) : today);
      v.probationMonths = 3;
      v.noticeDays = 30;
      v.reportsTo = s.signatory.who;
      v.location = 'Mumbai';
      if (kind === 'offer') { v.hours = '10:30 to 19:30, Monday to Saturday'; v.acceptBy = plusDays(today, 7); }
      else v.empId = m.empId || '';
    } else if (kind === 'increment') {
      v.oldCtc = ctc; v.newCtc = ''; v.effective = today; v.reason = '';
    } else if (kind === 'experience') {
      v.from = joined; v.to = today; v.lastRole = m.title || (c ? clean(c.role) : '');
    } else if (kind === 'relieving') {
      v.lastDay = today; v.noticeServed = 'yes'; v.dues = 'settled';
    } else if (kind === 'nda') {
      v.effective = joined || today; v.years = 2;
    } else if (kind === 'warning') {
      v.what = ''; v.when = today; v.expected = '';
    }
    return v;
  }

  /* ---------- the templates: plain letters in our voice ---------- */
  const T = {};
  T.offer = v => [
    'Dear ' + v.who + ',',
    'We are glad to offer you the role of ' + v.role + ' at Mask360. You met the team, you did the work, and we want you with us.',
    'You will report to ' + v.reportsTo + '. The work you own will sit close to our clients, and you will have the room to run it.',
    'Your annual cost to company will be ' + inr(v.ctc) + ' (' + inWords(v.ctc) + '), which comes to ' + monthly(v.ctc) + ' a month before statutory deductions. The full break up follows in your appointment letter.',
    'Your start date is ' + day(v.start) + ', at our ' + v.location + ' office.',
    'The first ' + n0(v.probationMonths) + ' ' + plural(v.probationMonths, 'month', 'months') + ' are probation. Either side may end the engagement in this period with ' + n0(v.noticeDays) + ' days of notice. After probation, the notice period is ' + n0(v.noticeDays) + ' days on both sides.',
    'Our working hours are ' + v.hours + '.',
    'On day one, bring your PAN card, your Aadhaar card, two passport photos, your last relieving letter and your bank details.',
    'Sign and return this letter by ' + day(v.acceptBy) + ' to accept. After that date the offer lapses.',
    'We are looking forward to building with you.'
  ];
  T.appointment = v => [
    'Dear ' + v.who + ',',
    'This letter confirms your appointment as ' + v.role + ' with Mask Management, effective ' + day(v.start) + '.' + (v.empId ? ' Your employee id is ' + v.empId + '.' : ''),
    'You will report to ' + v.reportsTo + ' and work from our ' + v.location + ' office.',
    'Your annual cost to company is ' + inr(v.ctc) + ' (' + inWords(v.ctc) + '), paid monthly as ' + monthly(v.ctc) + ' less statutory deductions. The salary structure is set out in your salary annexure.',
    'The first ' + n0(v.probationMonths) + ' ' + plural(v.probationMonths, 'month', 'months') + ' of your employment are probation. On confirmation, you become a permanent member of the team.',
    'The notice period is ' + n0(v.noticeDays) + ' days on both sides. Notice is served in full, and any shortfall is adjusted against your final settlement.',
    'Client work, client data and the company\'s internal material stay confidential, during your employment and after it.',
    'The policies in the handbook apply to you. They may change from time to time, with notice.',
    'Please sign the duplicate copy of this letter to accept these terms.',
    'We are glad to have you with us.'
  ];
  T.increment = v => [
    'Dear ' + v.who + ',',
    'Thank you for the work you have put in as ' + v.role + '. It shows in what we ship and in how the team runs.',
    'We are revising your annual cost to company from ' + inr(v.oldCtc) + ' to ' + inr(v.newCtc) + ' (' + inWords(v.newCtc) + '), effective ' + day(v.effective) + '. That comes to ' + monthly(v.newCtc) + ' a month before statutory deductions.',
    clean(v.reason) ? 'This revision recognises ' + clean(v.reason).replace(/[.\s]+$/, '') + '.' : '',
    'All other terms of your employment stay the same. Your revised salary annexure follows.',
    'Keep going. We are glad you are here.'
  ];
  T.experience = v => [
    'To whom it may concern,',
    'This is to certify that ' + v.who + ' was employed with Mask Management from ' + day(v.from) + ' to ' + day(v.to) + '. At the time of leaving, ' + v.who + ' held the role of ' + v.lastRole + '.',
    'During this period ' + v.who + ' handled the work with care and ownership, and was a valued member of the team.',
    'We wish ' + v.who + ' every success in what comes next.'
  ];
  T.relieving = v => [
    'Dear ' + v.who + ',',
    'This letter confirms that you have been relieved from your duties as ' + v.role + ' at Mask Management at the close of business on ' + day(v.lastDay) + '.',
    v.noticeServed === 'yes' ? 'You served your notice period in full.' : 'The shortfall in your notice period is adjusted in your final settlement.',
    v.dues === 'settled' ? 'Your full and final settlement has been made, and no dues remain on either side.' : 'Your full and final settlement will be processed within 30 days of your last working day.',
    'Client work, client data and internal material you came across at Mask360 stay confidential after you leave.',
    'Thank you for your time with us. We wish you well.'
  ];
  T.nda = v => [
    'This agreement is between Mask Management (Mask360) and ' + v.who + ', ' + v.role + ', and takes effect on ' + day(v.effective) + '.',
    'In your work with us you will come across confidential information: client briefs, strategies, pricing, creative work before release, internal numbers, access details, and anything marked or clearly meant as private.',
    'You agree to use confidential information only for Mask360\'s work, to share it only with people inside the company who need it, and to keep it out of personal accounts, devices and conversations.',
    'Work you produce for Mask360 or its clients belongs to Mask Management, or to the client the work was made for.',
    'These obligations run for ' + n0(v.years) + ' ' + plural(v.years, 'year', 'years') + ' after your engagement with Mask360 ends, or for as long as the information stays confidential, whichever is longer.',
    'If any confidential information is lost or exposed, you will tell us the same day.',
    'Both parties sign below to confirm the agreement.'
  ];
  T.warning = v => [
    'Dear ' + v.who + ',',
    'This letter is a formal warning, and it goes on your record.',
    'On ' + day(v.when) + ', ' + (clean(v.what) ? clean(v.what).replace(/[.\s]+$/, '') + '.' : 'the matter discussed with you took place.'),
    'This falls short of what we expect from a ' + v.role + ' at Mask360.' + (clean(v.expected) ? ' From here we expect ' + endStop(v.expected) : ''),
    'We will review this over the next 30 days. A repeat may lead to further action under the handbook, up to and including termination.',
    'Please sign the copy of this letter to confirm you have received it. If you want to talk it through, come and find me.'
  ];
  const template = (kind, v) => (T[kind] || T.offer)(v || {}).filter(p => clean(p)).join('\n\n');

  /* ---------- the reference number: MM/HR/2026-27/001, over every issued letter that year ---------- */
  function nextRef(ctx, fy) {
    const head = M.books.settings(ctx).numbering.prefix + '/HR/' + fy + '/';
    let max = 0;
    for (const l of allIssued(ctx)) {
      if (!String(l.ref || '').startsWith(head)) continue;
      const n = Number(String(l.ref).slice(head.length)) || 0;
      if (n > max) max = n;
    }
    return head + String(max + 1).padStart(3, '0');
  }

  const paragraphs = body => String(body || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  /* ---------- the document ---------- */
  function LetterDoc({letter, who}) {
    const ctx = M.useCtx();
    const Frame = M.parts.DocFrame, Head = M.parts.DocHead, Sign = M.parts.DocSign, Foot = M.parts.DocFoot;
    const v = letter.vars || {};
    const label = LABEL[letter.kind] || 'Letter';
    const accept = ACCEPTS.includes(letter.kind);
    return html`<${Frame} id="letter-doc" title=${label}>
      <${Head} ctx=${ctx} right=${html`<span class="doc-pill">${label}</span>`}/>
      <div class="doc-ref"><span>${letter.ref || 'draft'}</span><span>${day(v.date)}</span></div>
      <div class="doc-body">
        <div class="doc-h">${label}</div>
        ${paragraphs(letter.body).map((p, i) => html`<p key=${i}>${p}</p>`)}
        ${accept ? html`<div style=${{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: 'auto'}}>
          <div class="doc-sign" style=${{alignItems: 'flex-start', textAlign: 'left'}}>
            <div class="doc-sig-space"/>
            <div class="doc-micro">Accepted by</div>
            <div class="doc-sign-who">${v.who || who || ''}</div>
            <div class="doc-sub">Accepted on: ____________</div>
          </div>
          <${Sign} ctx=${ctx} label="For Mask Management"/>
        </div>` : html`<${Sign} ctx=${ctx} label="For Mask Management"/>`}
      </div>
      <${Foot} ctx=${ctx}/>
    <//>`;
  }

  /* ---------- the drawer: variables, the body, save or issue ---------- */
  function LetterDrawer({uid, letter, onClose, onChange}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const [live, setLive] = useState(false);
    const ctrl = useRef(null);
    useEffect(() => () => { if (ctrl.current) ctrl.current.abort(); }, []);
    const f = letter;
    const setVar = (k, val) => onChange({...f, vars: {...f.vars, [k]: val}});
    const setBody = b => onChange({...f, body: b});
    const writeIt = () => setBody(template(f.kind, f.vars));
    const stored = () => ({kind: f.kind, at: f.at || Date.now(), ref: f.ref || '', vars: {...f.vars}, body: String(f.body || ''), status: f.status || 'draft', issuedAt: f.issuedAt || 0});
    const save = async () => {
      setBusy(true);
      try { await ctx.W.merge('hr/' + uid, {letters: {[f.id]: stored()}, updated: Date.now()}); M.toast('Saved'); onClose(); }
      catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const issue = async () => {
      if (!clean(f.body)) { M.toast('Write the letter first.', true); return; }
      setBusy(true);
      const ref = nextRef(ctx, M.books.fyOf(okDate(f.vars.date) ? f.vars.date : U.todayStr()));
      const doc = {...stored(), ref, status: 'issued', issuedAt: Date.now()};
      try { await ctx.W.merge('hr/' + uid, {letters: {[f.id]: doc}, updated: Date.now()}); onChange({...f, ...doc}); M.toast('Issued ' + ref); onClose(); }
      catch (e) { M.toast('Could not issue', true); setBusy(false); }
    };
    const rewrite = async () => {
      if (!clean(f.body)) { M.toast('Write the letter first.', true); return; }
      if (ctrl.current) ctrl.current.abort();
      const c = new AbortController(); ctrl.current = c;
      setLive(true);
      const before = f.body;
      const tidy = t => String(t || '').replace(new RegExp('[' + String.fromCharCode(8212, 8211) + ']', 'g'), ', ').replace(/!/g, '.');
      try {
        const out = await M.ai.text(ctx,
          'Rewrite this letter in our voice. Keep every fact, figure, date and name exactly as written. Short paragraphs, plain words, warm and direct, sentence case. No dashes, no exclamation marks, no legal filler. Return only the letter body, paragraphs separated by a blank line.\n\n' + before,
          {signal: c.signal, cache: false, onText: r => { if (r && r.text) setBody(tidy(r.text)); }});
        if (clean(out)) setBody(tidy(out)); else setBody(before);
      } catch (e) {
        if (!(e && e.code === 'cancelled')) { M.toast(M.ai.errCopy(e && e.code), true); setBody(before); }
      }
      setLive(false);
    };
    const fields = fieldsOf(f.kind);
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${(LABEL[f.kind] || 'Letter') + ', draft'}
      footer=${html`<span class="row nowrap" style=${{gap: '8px'}}>
          <${UI.Btn} kind="sec" id="letter-save" disabled=${busy || live} onClick=${save}>Save draft<//>
          <span id="letter-issue"><${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${issue}>Issue the letter<//></span>
        </span>`}>
      <div class="stack" id="letter-drawer">
        <div class="grid2">
          ${fields.map(fd => fd.options
            ? html`<${UI.Select} key=${fd.k} id=${'letter-var-' + fd.k} label=${fd.label} value=${String(f.vars[fd.k] == null ? '' : f.vars[fd.k])} options=${fd.options} onChange=${val => setVar(fd.k, val)}/>`
            : html`<${UI.Input} key=${fd.k} id=${'letter-var-' + fd.k} label=${fd.label} type=${fd.type || 'text'}
                value=${String(f.vars[fd.k] == null ? '' : f.vars[fd.k])} onChange=${val => setVar(fd.k, fd.type === 'number' ? (val === '' ? '' : n0(val)) : val)}/>`)}
        </div>
        <div class="row between">
          <span class="sub small">Fill the fields, then write the body from the template. Edit it as you like.</span>
          <span class="row nowrap" style=${{gap: '8px'}}>
            <${UI.Btn} kind="sec" sm=${true} id="letter-write" disabled=${live} onClick=${writeIt}>Write it<//>
            ${M.ai.on(ctx) ? html`<${UI.Btn} kind="ghost" sm=${true} id="letter-rewrite" disabled=${live || !clean(f.body)} onClick=${rewrite}>${live ? 'Rewriting' : 'Rewrite in our voice'}<//>` : null}
          </span>
        </div>
        <${UI.TextArea} id="letter-body" label="the letter" rows=${18} value=${f.body || ''} onChange=${setBody} placeholder="Tap Write it to draft the body from the template."/>
      </div>
    <//>`;
  }

  /* ---------- the page ---------- */
  function Letters({id}) {
    const ctx = M.useCtx();
    const [sel, setSel] = useState(id || '');
    const [kind, setKind] = useState('offer');
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);
    useEffect(() => { if (id) { setSel(id); setOpenId(null); setDraft(null); } }, [id]);
    const members = ctx.activeMembers || [];
    const memberIds = members.map(m => m.uid);
    const profiles = M.useProfiles(memberIds);
    const cands = useMemo(() => {
      const m = ((ctx.coll.candidates || {}).map) || {};
      return Object.keys(m).filter(cid => m[cid] && (m[cid].stage === 'offer' || m[cid].stage === 'hired')).map(cid => ({uid: 'cand:' + cid, c: m[cid]}));
    }, [ctx.coll.candidates]);
    if (!ctx.isOwner) return html`<${UI.Empty} text="Letters are the owner's alone."/>`;
    const people = members.map(m => ({uid: m.uid, who: nameOf(ctx, m.uid, profiles), sub: m.title || m.role || '', cand: false}))
      .concat(cands.map(x => ({uid: x.uid, who: nameOf(ctx, x.uid, profiles), sub: clean(x.c.role), cand: true})));
    const person = people.find(p => p.uid === sel) || null;
    const list = person ? lettersOf(ctx, person.uid) : [];
    const stored = openId ? list.find(l => l.id === openId) : null;
    const shown = draft && draft.id === openId ? draft : stored;
    const pick = uid => { setSel(uid); setOpenId(null); setDraft(null); M.nav('#letters/' + encodeURIComponent(uid)); };
    const startDraft = () => {
      if (!person) return;
      const l = {id: U.uid(), kind, at: Date.now(), ref: '', vars: vars(kind, ctx, person.uid, person.who), body: '', status: 'draft', issuedAt: 0};
      setDraft(l); setOpenId(l.id);
    };
    const openLetter = l => { setOpenId(l.id); setDraft(l.status === 'issued' ? null : {...l, vars: {...(l.vars || {})}}); };
    const editing = draft && draft.id === openId;
    return html`<div class="split" id="letters-page">
      <div class="stack" style=${{gap: '18px'}}>
        <${UI.Card} title="Who" id="letters-people">
          ${people.length ? people.map(p => html`<button type="button" key=${p.uid} class="listrow rowbtn" aria-pressed=${p.uid === sel}
              style=${{fontWeight: p.uid === sel ? 500 : 300}} onClick=${() => pick(p.uid)}>
              <${UI.Avatar} id=${p.cand ? '' : p.uid} size=${24}/>
              <span class="grow" style=${{minWidth: 0}}>${p.who}${p.sub ? html`<span class="tiny ink62"> · ${p.sub}</span>` : null}</span>
              ${p.cand ? html`<${UI.Pill}>candidate<//>` : null}
              <span class="tiny ink62 num">${issuedCount(ctx, p.uid)} issued</span>
            </button>`) : html`<${UI.Empty} text="No active members and no candidates at offer or hired yet."/>`}
        <//>
      </div>
      <div class="stack" style=${{gap: '18px'}}>
        ${person ? html`<${UI.Card} title=${'Letters, ' + person.who} id="letters-list">
          ${list.length ? list.map(l => html`<div class="listrow" key=${l.id}>
              <span class="grow" style=${{minWidth: 0}}><b>${LABEL[l.kind] || 'Letter'}</b><span class="tiny ink62"> · ${l.ref || 'no ref'} · ${day((l.vars || {}).date) || day(U.ymd(new Date(l.at || Date.now())))}</span></span>
              <${UI.Pill} kind=${l.status === 'issued' ? 'ink' : undefined}>${l.status === 'issued' ? 'issued' : 'draft'}<//>
              <${UI.Btn} kind="ghost" sm=${true} onClick=${() => openLetter(l)}>Open<//>
            </div>`) : html`<${UI.Empty} text="No letters yet."/>`}
          <div class="row between" style=${{marginTop: '12px', alignItems: 'flex-end'}}>
            <div class="grow"><${UI.Select} id="letter-kind" label="new letter" value=${kind} options=${KINDS} onChange=${setKind}/></div>
            <${UI.Btn} id="letter-draft" onClick=${startDraft}>Draft the letter<//>
          </div>
        <//>` : html`<${UI.Card} title="Letters"><${UI.Empty} text="Pick a person on the left."/><//>`}
      </div>
      ${person && shown ? html`<div style=${{gridColumn: '1 / -1'}}>
        ${editing || shown.status === 'issued' ? null : html`<div class="row" style=${{marginBottom: '10px'}}><${UI.Btn} kind="sec" sm=${true} onClick=${() => openLetter(shown)}>Edit the draft<//></div>`}
        <${LetterDoc} letter=${shown} who=${person.who}/>
      </div>` : null}
      ${person && editing ? html`<${LetterDrawer} uid=${person.uid} letter=${draft} onClose=${() => setDraft(null)} onChange=${setDraft}/>` : null}
    </div>`;
  }

  M.letters = {KINDS, LABEL, FIELDS, template, vars, nextRef, lettersOf, allIssued};
  M.pages.Letters = Letters;
})();
