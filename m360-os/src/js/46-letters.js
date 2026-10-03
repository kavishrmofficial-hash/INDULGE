/* module: letters. The HR desk inside the books: offer, appointment, increment, experience, relieving,
   non-disclosure, warning and blank letters for every active member and for candidates at the offer or
   hired stage. Every piece of a letter is a field the owner can edit by hand: the recipient and the
   address, the date, the place and the reference, the subject, the salutation and the closing, the
   signatory, the kind's own details and the body itself. "Write it" drafts the body from the template;
   after a manual edit it asks before overwriting. An issued letter carries its reference and stays
   editable; a withdrawn one stays in the list and counts for nothing. Letters live in hr/<uid>, the
   owner's alone: hr/<uid>.letters[id] = {kind, at, ref, vars, body, status, issuedAt, editedAt, hand}. */
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
    {v: 'warning', label: 'Warning letter'},
    {v: 'custom', label: 'Letter, blank'}
  ];
  const LABEL = Object.fromEntries(KINDS.map(k => [k.v, k.label]));
  const SUBJECT = {
    offer: 'Offer of employment', appointment: 'Letter of appointment', increment: 'Revision of your compensation',
    experience: 'Experience certificate', relieving: 'Relieving letter', nda: 'Non-disclosure agreement',
    warning: 'Formal warning', custom: ''
  };
  const ACCEPTS = ['offer', 'appointment', 'nda'];
  const YESNO = [{v: 'yes', label: 'Yes'}, {v: 'no', label: 'No'}];
  const DUES = [{v: 'settled', label: 'Settled'}, {v: 'to be settled', label: 'To be settled'}];
  /* the fields every kind carries, in three groups: who, letter, signature */
  const WHO = [
    {k: 'who', label: 'to'},
    {k: 'address', label: 'address, one line per row', area: true},
    {k: 'role', label: 'role'}
  ];
  const LETTER = [
    {k: 'date', label: 'letter date', type: 'date'},
    {k: 'place', label: 'place'},
    {k: 'ref', label: 'reference'},
    {k: 'subject', label: 'subject'}
  ];
  const LETTER_END = [
    {k: 'salutation', label: 'salutation'},
    {k: 'closing', label: 'closing line'}
  ];
  const SIGN = [
    {k: 'signWho', label: 'signed by'},
    {k: 'signTitle', label: 'title'}
  ];
  const COMMON = WHO.concat(LETTER, LETTER_END, SIGN);
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
    ],
    custom: []
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
  const allLetters = ctx => {
    const out = [];
    const map = hrMap(ctx);
    for (const uid of Object.keys(map)) {
      const ls = (map[uid] || {}).letters || {};
      for (const id of Object.keys(ls)) if (ls[id] && typeof ls[id] === 'object') out.push({...ls[id], id, uid});
    }
    return out;
  };
  const allIssued = ctx => allLetters(ctx).filter(l => l.status === 'issued');
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
  const lines = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);
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
  /* the company's city: the line of the address that carries the PIN code, else the first of its cities */
  const cityOf = s => {
    const c = s.company || {};
    for (const l of lines(c.address)) {
      const m = /([A-Za-z][A-Za-z .]*?)\s*[-]?\s*\d{6}\b/.exec(l);
      if (m) { const parts = clean(m[1]).split(',').map(clean).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
    }
    const first = clean(String(c.cities || '').split(String.fromCharCode(183))[0]);
    return first || 'Mumbai';
  };
  const company = ctx => { const s = M.books.settings(ctx); return {name: s.company.name || 'Mask Management', brand: s.company.brand || 'Mask360'}; };
  const salutationFor = (kind, who) => kind === 'experience' ? 'To whom it may concern,' : 'Dear ' + (U.firstName(who) || 'there') + ',';

  /* ---------- the variables, prefilled ---------- */
  function vars(kind, ctx, uid, who) {
    const today = U.todayStr();
    const m = (ctx.members || {})[uid] || {};
    const c = candOf(ctx, uid);
    const sal = ((((ctx.coll.payroll || {}).map || {}).salaries || {}).map || {})[uid] || {};
    const s = M.books.settings(ctx);
    const name = who || (c ? clean(c.name) : nameOf(ctx, uid));
    const v = {
      who: name,
      address: '',
      role: c ? clean(c.role) : (m.title || ''),
      date: today,
      place: cityOf(s),
      ref: '',
      subject: SUBJECT[kind] || '',
      salutation: salutationFor(kind, name),
      closing: 'Warm regards,',
      signWho: s.signatory.who || '',
      signTitle: s.signatory.title || ''
    };
    const joined = okDate(m.joined) ? m.joined : (okDate(m.start) ? m.start : '');
    const ctc = sal.ctc ? n0(sal.ctc) : '';
    if (kind === 'offer' || kind === 'appointment') {
      v.ctc = ctc;
      v.start = joined || (kind === 'offer' ? plusDays(today, 14) : today);
      v.probationMonths = 3;
      v.noticeDays = 30;
      v.reportsTo = s.signatory.who;
      v.location = cityOf(s);
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
  /* the shared fields of an older letter, filled so the document still reads whole */
  function withDefaults(letter, ctx) {
    const v = {...(letter.vars || {})};
    const s = M.books.settings(ctx);
    const first = (String(letter.body || '').split(/\n\s*\n/)[0] || '').trim();
    const opens = /^(Dear\b|To whom)/i.test(first);
    if (v.subject == null) v.subject = SUBJECT[letter.kind] || '';
    if (v.salutation == null) v.salutation = opens ? '' : salutationFor(letter.kind, v.who);
    if (v.closing == null) v.closing = opens ? '' : 'Warm regards,';
    if (v.signWho == null) v.signWho = s.signatory.who || '';
    if (v.signTitle == null) v.signTitle = s.signatory.title || '';
    if (v.place == null) v.place = '';
    if (v.address == null) v.address = '';
    return v;
  }

  /* ---------- the templates: the body alone, in our voice. The salutation and the closing are fields. ---------- */
  const T = {};
  T.offer = (v, co) => [
    'We are glad to offer you the role of ' + v.role + ' at ' + co.brand + '. You met the team, you did the work, and we want you with us.',
    'You will report to ' + v.reportsTo + '. The work you own will sit close to our clients, and you will have the room to run it.',
    'Your annual cost to company will be ' + inr(v.ctc) + ' (' + inWords(v.ctc) + '), which comes to ' + monthly(v.ctc) + ' a month before statutory deductions. The full break up follows in your appointment letter.',
    'Your start date is ' + day(v.start) + ', at our ' + v.location + ' office.',
    'The first ' + n0(v.probationMonths) + ' ' + plural(v.probationMonths, 'month', 'months') + ' are probation. Either side may end the engagement in this period with ' + n0(v.noticeDays) + ' days of notice. After probation, the notice period is ' + n0(v.noticeDays) + ' days on both sides.',
    'Our working hours are ' + v.hours + '.',
    'On day one, bring your PAN card, your Aadhaar card, two passport photos, your last relieving letter and your bank details.',
    'Sign and return this letter by ' + day(v.acceptBy) + ' to accept. After that date the offer lapses.',
    'We are looking forward to building with you.'
  ];
  T.appointment = (v, co) => [
    'This letter confirms your appointment as ' + v.role + ' with ' + co.name + ', effective ' + day(v.start) + '.' + (v.empId ? ' Your employee id is ' + v.empId + '.' : ''),
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
    'Thank you for the work you have put in as ' + v.role + '. It shows in what we ship and in how the team runs.',
    'We are revising your annual cost to company from ' + inr(v.oldCtc) + ' to ' + inr(v.newCtc) + ' (' + inWords(v.newCtc) + '), effective ' + day(v.effective) + '. That comes to ' + monthly(v.newCtc) + ' a month before statutory deductions.',
    clean(v.reason) ? 'This revision recognises ' + clean(v.reason).replace(/[.\s]+$/, '') + '.' : '',
    'All other terms of your employment stay the same. Your revised salary annexure follows.',
    'Keep going. We are glad you are here.'
  ];
  T.experience = (v, co) => [
    'This is to certify that ' + v.who + ' was employed with ' + co.name + ' from ' + day(v.from) + ' to ' + day(v.to) + '. At the time of leaving, ' + v.who + ' held the role of ' + v.lastRole + '.',
    'During this period ' + v.who + ' handled the work with care and ownership, and was a valued member of the team.',
    'We wish ' + v.who + ' every success in what comes next.'
  ];
  T.relieving = (v, co) => [
    'This letter confirms that you have been relieved from your duties as ' + v.role + ' at ' + co.name + ' at the close of business on ' + day(v.lastDay) + '.',
    v.noticeServed === 'yes' ? 'You served your notice period in full.' : 'The shortfall in your notice period is adjusted in your final settlement.',
    v.dues === 'settled' ? 'Your full and final settlement has been made, and no dues remain on either side.' : 'Your full and final settlement will be processed within 30 days of your last working day.',
    'Client work, client data and internal material you came across at ' + co.brand + ' stay confidential after you leave.',
    'Thank you for your time with us. We wish you well.'
  ];
  T.nda = (v, co) => [
    'This agreement is between ' + co.name + ' (' + co.brand + ') and ' + v.who + ', ' + v.role + ', and takes effect on ' + day(v.effective) + '.',
    'In your work with us you will come across confidential information: client briefs, strategies, pricing, creative work before release, internal numbers, access details, and anything marked or clearly meant as private.',
    'You agree to use confidential information only for ' + co.brand + '\'s work, to share it only with people inside the company who need it, and to keep it out of personal accounts, devices and conversations.',
    'Work you produce for ' + co.brand + ' or its clients belongs to ' + co.name + ', or to the client the work was made for.',
    'These obligations run for ' + n0(v.years) + ' ' + plural(v.years, 'year', 'years') + ' after your engagement with ' + co.brand + ' ends, or for as long as the information stays confidential, whichever is longer.',
    'If any confidential information is lost or exposed, you will tell us the same day.',
    'Both parties sign below to confirm the agreement.'
  ];
  T.warning = (v, co) => [
    'This letter is a formal warning, and it goes on your record.',
    'On ' + day(v.when) + ', ' + (clean(v.what) ? clean(v.what).replace(/[.\s]+$/, '') + '.' : 'the matter discussed with you took place.'),
    'This falls short of what we expect from a ' + v.role + ' at ' + co.brand + '.' + (clean(v.expected) ? ' From here we expect ' + endStop(v.expected) : ''),
    'We will review this over the next 30 days. A repeat may lead to further action under the handbook, up to and including termination.',
    'Please sign the copy of this letter to confirm you have received it. If you want to talk it through, come and find me.'
  ];
  T.custom = () => [];
  const template = (kind, v, co) => (T[kind] || T.offer)(v || {}, co || {name: 'Mask Management', brand: 'Mask360'}).filter(p => clean(p)).join('\n\n');

  /* ---------- the reference number: MM/HR/2026-27/001, past every reference already carried that year ---------- */
  const refUsed = (ctx, ref, exceptId) => !!clean(ref) && allLetters(ctx).some(l => l.id !== exceptId && l.status !== 'draft' && clean(l.ref) === clean(ref));
  function nextRef(ctx, fy) {
    const head = M.books.settings(ctx).numbering.prefix + '/HR/' + fy + '/';
    let max = 0;
    for (const l of allLetters(ctx)) {
      if (l.status === 'draft' || !String(l.ref || '').startsWith(head)) continue;
      const n = Number(String(l.ref).slice(head.length)) || 0;
      if (n > max) max = n;
    }
    return head + String(max + 1).padStart(3, '0');
  }
  const fyFor = v => M.books.fyOf(okDate((v || {}).date) ? v.date : U.todayStr());

  const paragraphs = body => String(body || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const STATUS_PILL = {issued: 'ink', withdrawn: 'flame-o'};

  /* ---------- the document ---------- */
  function LetterDoc({letter, who, actions}) {
    const ctx = M.useCtx();
    const Frame = M.parts.DocFrame, Head = M.parts.DocHead, Foot = M.parts.DocFoot;
    const s = M.books.settings(ctx);
    const v = withDefaults(letter, ctx);
    const label = LABEL[letter.kind] || 'Letter';
    const accept = ACCEPTS.includes(letter.kind);
    const withdrawn = letter.status === 'withdrawn';
    const addr = lines(v.address);
    const sign = html`<div class="doc-sign">
      ${s.sig ? html`<img class="doc-sig" src=${s.sig} alt=""/>` : html`<div class="doc-sig-space"/>`}
      ${s.seal ? html`<img class="doc-seal" src=${s.seal} alt=""/>` : null}
      <div class="doc-micro">For ${s.company.name}</div>
      <div class="doc-sign-who">${v.signWho}</div>
      <div class="doc-sub">${v.signTitle}</div>
    </div>`;
    return html`<${Frame} id="letter-doc" title=${label + (withdrawn ? ', withdrawn' : '')} actions=${actions}>
      <${Head} ctx=${ctx} right=${html`<span class="row nowrap" style=${{gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
        ${withdrawn ? html`<span class="doc-pill">Withdrawn</span>` : null}<span class="doc-pill">${label}</span></span>`}/>
      <div class="doc-ref"><span>${letter.ref || clean(v.ref) || 'draft'}</span><span>${(clean(v.place) ? clean(v.place) + ', ' : '') + day(v.date)}</span></div>
      <div class="doc-body">
        <div style=${{marginBottom: '18px', lineHeight: 1.6}}>
          <div style=${{fontWeight: 700}}>${v.who || who || ''}</div>
          ${clean(v.role) ? html`<div>${v.role}</div>` : null}
          ${addr.map((l, i) => html`<div key=${i}>${l}</div>`)}
        </div>
        ${clean(v.subject) ? html`<p style=${{fontWeight: 700}}>Subject: ${v.subject}</p>` : null}
        ${clean(v.salutation) ? html`<p>${v.salutation}</p>` : null}
        ${paragraphs(letter.body).map((p, i) => html`<p key=${i}>${p}</p>`)}
        ${clean(v.closing) ? html`<p style=${{marginTop: '18px'}}>${v.closing}</p>` : null}
        ${accept ? html`<div style=${{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: 'auto'}}>
          <div class="doc-sign" style=${{alignItems: 'flex-start', textAlign: 'left'}}>
            <div class="doc-sig-space"/>
            <div class="doc-micro">Accepted by</div>
            <div class="doc-sign-who">${v.who || who || ''}</div>
            <div class="doc-sub">Accepted on: ____________</div>
          </div>
          ${sign}
        </div>` : sign}
      </div>
      <${Foot} ctx=${ctx}/>
    <//>`;
  }

  /* ---------- the drawer: every field, the body, save or issue ---------- */
  function LetterDrawer({uid, letter, onClose, onChange}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const [live, setLive] = useState(false);
    const ctrl = useRef(null);
    useEffect(() => () => { if (ctrl.current) ctrl.current.abort(); }, []);
    const f = letter;
    const issued = f.status === 'issued';
    const co = company(ctx);
    const setVar = (k, val) => onChange({...f, vars: {...f.vars, [k]: val}});
    const typeBody = b => onChange({...f, body: b, hand: true});
    const writeIt = () => onChange({...f, body: template(f.kind, f.vars, co), hand: false});
    const stored = () => ({kind: f.kind, at: f.at || Date.now(), ref: f.ref || '', vars: {...f.vars}, body: String(f.body || ''),
      status: f.status || 'draft', issuedAt: f.issuedAt || 0, editedAt: f.editedAt || 0, hand: !!f.hand});
    const write = async (doc, said) => {
      setBusy(true);
      try { await ctx.W.merge('hr/' + uid, {letters: {[f.id]: doc}, updated: Date.now()}); onChange({...f, ...doc}); M.toast(said); onClose(); }
      catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const save = () => {
      const doc = stored();
      if (issued) {
        const ref = clean(f.vars.ref) || f.ref;
        if (refUsed(ctx, ref, f.id)) { M.toast('Reference ' + ref + ' is on another letter.', true); return; }
        doc.ref = ref; doc.vars.ref = ref; doc.editedAt = Date.now();
      }
      write(doc, 'Saved');
    };
    const issue = () => {
      if (!clean(f.body)) { M.toast('Write the letter first.', true); return; }
      let ref = clean(f.vars.ref) || nextRef(ctx, fyFor(f.vars));
      if (refUsed(ctx, ref, f.id)) ref = nextRef(ctx, fyFor(f.vars));
      const doc = {...stored(), ref, status: 'issued', issuedAt: Date.now()};
      doc.vars.ref = ref;
      write(doc, 'Issued ' + ref);
    };
    const rewrite = async () => {
      if (!clean(f.body)) { M.toast('Write the letter first.', true); return; }
      if (ctrl.current) ctrl.current.abort();
      const c = new AbortController(); ctrl.current = c;
      setLive(true);
      const before = f.body;
      const tidy = t => String(t || '').replace(new RegExp('[' + String.fromCharCode(8212, 8211) + ']', 'g'), ', ').replace(/!/g, '.');
      const put = b => onChange({...f, body: b, hand: true});
      try {
        const out = await M.ai.text(ctx,
          'Rewrite this letter in our voice. Keep every fact, figure, date and name exactly as written. Short paragraphs, plain words, warm and direct, sentence case. No dashes, no exclamation marks, no legal filler. Return only the letter body, paragraphs separated by a blank line.\n\n' + before,
          {signal: c.signal, cache: false, onText: r => { if (r && r.text) put(tidy(r.text)); }});
        if (clean(out)) put(tidy(out)); else onChange({...f, body: before});
      } catch (e) {
        if (!(e && e.code === 'cancelled')) { M.toast(M.ai.errCopy(e && e.code), true); onChange({...f, body: before}); }
      }
      setLive(false);
    };
    const val = k => String(f.vars[k] == null ? '' : f.vars[k]);
    const control = fd => fd.options
      ? html`<${UI.Select} key=${fd.k} id=${'letter-var-' + fd.k} label=${fd.label} value=${val(fd.k)} options=${fd.options} onChange=${v => setVar(fd.k, v)}/>`
      : fd.area
        ? html`<${UI.TextArea} key=${fd.k} id=${'letter-var-' + fd.k} label=${fd.label} rows=${3} value=${val(fd.k)} onChange=${v => setVar(fd.k, v)}/>`
        : html`<${UI.Input} key=${fd.k} id=${'letter-var-' + fd.k} label=${fd.label} type=${fd.type || 'text'} value=${val(fd.k)}
            onChange=${v => setVar(fd.k, fd.type === 'number' ? (v === '' ? '' : n0(v)) : v)}/>`;
    const own = FIELDS[f.kind] || [];
    const hand = !!f.hand && clean(f.body);
    const canWrite = f.kind !== 'custom';
    const title = (LABEL[f.kind] || 'Letter') + ', ' + (issued ? 'issued' : f.status === 'withdrawn' ? 'withdrawn' : 'draft');
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${title}
      footer=${html`<span class="row nowrap" style=${{gap: '8px'}}>
          <${UI.Btn} kind=${issued ? undefined : 'sec'} id="letter-save" disabled=${busy || live} onClick=${save}>${issued ? 'Save the changes' : 'Save draft'}<//>
          ${issued ? null : html`<span id="letter-issue"><${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${issue}>Issue the letter<//></span>`}
        </span>`}>
      <div class="stack" id="letter-drawer">
        <${UI.Micro}>who<//>
        <div class="grid2">${WHO.map(control)}</div>
        <${UI.Micro}>letter<//>
        <div class="grid2">${LETTER.concat(own, LETTER_END).map(control)}</div>
        <${UI.Micro}>signature<//>
        <div class="grid2">${SIGN.map(control)}</div>
        <hr class="hair"/>
        <div class="row between">
          <span class="row nowrap" style=${{gap: '8px', minWidth: 0}}>
            <span class="sub small">${canWrite ? 'Write the body from the fields, then edit it as you like.' : 'Write the body yourself.'}</span>
            ${hand ? html`<${UI.Pill} kind="warm">edited by hand<//>` : null}
          </span>
          <span class="row nowrap" style=${{gap: '8px'}}>
            ${!canWrite ? null : hand
              ? html`<span id="letter-write"><${UI.ConfirmBtn} kind="sec" label="Tap again to overwrite" onConfirm=${writeIt}>Write it<//></span>`
              : html`<${UI.Btn} kind="sec" sm=${true} id="letter-write" disabled=${live} onClick=${writeIt}>Write it<//>`}
            ${M.ai.on(ctx) && M.fx ? html`<span class="row nowrap fx-writer" style=${{gap: '6px'}}>${live ? html`<${M.fx.Orb} state="composing" size=${20} label="rewriting"/>` : null}<${M.fx.Bot} feature="writer" state=${live ? 'working' : 'default'} size=${26} label=${live ? 'm360, rewriting' : 'm360 writer'}/></span>` : null}
            ${M.ai.on(ctx) ? html`<${UI.Btn} kind="ghost" sm=${true} id="letter-rewrite" disabled=${live || !clean(f.body)} onClick=${rewrite}>${live ? 'Rewriting' : 'Rewrite in our voice'}<//>` : null}
          </span>
        </div>
        <${UI.TextArea} id="letter-body" label="the letter" rows=${18} value=${f.body || ''} onChange=${typeBody}
          placeholder=${canWrite ? 'Tap Write it to draft the body from the fields, or type it here.' : 'Type the letter here, paragraphs separated by a blank line.'}/>
      </div>
    <//>`;
  }

  /* ---------- the page ---------- */
  function Letters({id}) {
    const ctx = M.useCtx();
    const phone = M.usePhone();   /* the list sits above the letter on a phone */
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
    const fresh = (k, v, body) => ({id: U.uid(), kind: k, at: Date.now(), ref: '', vars: {...v, ref: nextRef(ctx, fyFor(v))}, body: body || '', status: 'draft', issuedAt: 0, editedAt: 0, hand: false});
    const startDraft = () => {
      if (!person) return;
      const l = fresh(kind, vars(kind, ctx, person.uid, person.who), '');
      setDraft(l); setOpenId(l.id);
    };
    /* the drawer: a draft opens straight away, an issued letter through Edit */
    const edit = l => {
      const v = {...withDefaults(l, ctx)};
      if (l.status === 'draft' && !clean(v.ref)) v.ref = nextRef(ctx, fyFor(v));
      if (l.status !== 'draft' && !clean(v.ref)) v.ref = l.ref || '';
      setOpenId(l.id); setDraft({...l, vars: v});
    };
    const openLetter = l => { if (l.status === 'draft') edit(l); else { setDraft(null); setOpenId(l.id); } };
    const duplicate = l => {
      if (!person) return;
      const v = {...withDefaults(l, ctx)};
      v.ref = '';
      const d = fresh(l.kind, v, l.body);
      d.hand = !!l.hand;
      setDraft(d); setOpenId(d.id);
    };
    const withdraw = async l => {
      try { await ctx.W.merge('hr/' + person.uid, {letters: {[l.id]: {status: 'withdrawn', withdrawnAt: Date.now()}}, updated: Date.now()}); M.toast('Withdrawn'); }
      catch (e) { M.toast('Could not withdraw', true); }
    };
    const editing = draft && draft.id === openId;
    const actionsFor = l => html`<span class="row nowrap" style=${{gap: '8px', flexWrap: 'wrap'}}>
      ${l.status === 'draft' ? html`<${UI.Btn} kind="sec" sm=${true} id="letter-edit" onClick=${() => edit(l)}>Edit the draft<//>` : null}
      ${l.status === 'issued' ? html`<${UI.Btn} kind="sec" sm=${true} id="letter-edit-issued" onClick=${() => edit(l)}>Edit<//>` : null}
      <${UI.Btn} kind="ghost" sm=${true} id="letter-dup" onClick=${() => duplicate(l)}>Duplicate<//>
      ${l.status === 'issued' ? html`<span id="letter-withdraw"><${UI.ConfirmBtn} kind="ghost" onConfirm=${() => withdraw(l)}>Withdraw<//></span>` : null}
    </span>`;
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
              ${l.status === 'issued' && M.fx ? html`<${M.fx.MetalBadge}>issued<//>` : html`<${UI.Pill} kind=${STATUS_PILL[l.status]}>${l.status === 'issued' ? 'issued' : l.status === 'withdrawn' ? 'withdrawn' : 'draft'}<//>`}
              <${UI.Btn} kind="ghost" sm=${true} onClick=${() => openLetter(l)}>Open<//>
            </div>`) : html`<${UI.Empty} text="No letters yet."/>`}
          ${(() => {
            const pickRow = html`<div class=${'row between' + (M.fx ? ' fx-beam-pad' : '')} style=${{marginTop: M.fx ? 0 : '12px', alignItems: 'flex-end'}}>
              <div class="grow"><${UI.Select} id="letter-kind" label="new letter" value=${kind} options=${KINDS} onChange=${setKind}/></div>
              <${UI.Btn} id="letter-draft" onClick=${startDraft}>Draft the letter<//>
            </div>`;
            return M.fx ? html`<div style=${{marginTop: '12px'}}><${M.fx.Beam} radius=${16}>${pickRow}<//></div>` : pickRow;
          })()}
        <//>` : html`<${UI.Card} title="Letters"><${UI.Empty} text=${phone ? 'Pick a person above.' : 'Pick a person on the left.'}/><//>`}
      </div>
      ${person && shown ? html`<div style=${{gridColumn: '1 / -1'}}>
        ${shown.editedAt ? html`<div class="tiny ink62" style=${{marginBottom: '8px'}}>Edited ${U.timeAgo(shown.editedAt)}</div>` : null}
        <${LetterDoc} letter=${shown} who=${person.who} actions=${editing ? null : actionsFor(shown)}/>
      </div>` : null}
      ${person && editing ? html`<${LetterDrawer} uid=${person.uid} letter=${draft} onClose=${() => setDraft(null)} onChange=${setDraft}/>` : null}
    </div>`;
  }

  M.letters = {KINDS, LABEL, FIELDS, SUBJECT, template, vars, withDefaults, nextRef, refUsed, lettersOf, allIssued, allLetters};
  M.pages.Letters = Letters;
})();
