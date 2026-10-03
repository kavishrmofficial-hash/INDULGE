/* module: books. The owner's accounting and HR desk: the financial year, invoice numbers, money in
   six currencies, amounts in words, invoice totals and statuses, the printable document frame, the
   Books section with its tabs, the overview and the setup (company, bank, signatory, numbering,
   defaults, auto-chase, compliance, and each client's billing profile). The books collections
   (books, invoices, expenses, payroll, hr) reach the owner's page alone. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  /* a number in metal (metal-fx MetalText) */
  const MetalNum = ({children, size, weight, color}) => html`<span class="fx-num"><${M.fx.MetalText} size=${size} weight=${weight} color=${color}>${children}<//></span>`;
  const {useState, useEffect, useMemo} = React;

  /* ---------- money ---------- */
  const CUR = {
    INR: {sym: '₹', word: 'Rupees', locale: 'en-IN', intl: false},
    AED: {sym: 'AED ', word: 'Dirhams', locale: 'en-US', intl: true},
    USD: {sym: '$', word: 'Dollars', locale: 'en-US', intl: true},
    EUR: {sym: '€', word: 'Euros', locale: 'en-US', intl: true},
    GBP: {sym: '£', word: 'Pounds', locale: 'en-US', intl: true},
    SAR: {sym: 'SAR ', word: 'Riyals', locale: 'en-US', intl: true}
  };
  const CUR_OPTS = Object.keys(CUR).map(k => ({v: k, label: k + ' ' + CUR[k].sym.trim()}));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const fmt = (n, cur) => {
    const c = CUR[cur] || CUR.INR;
    const v = Math.round(num(n) * 100) / 100;
    const whole = Math.abs(v - Math.round(v)) < 0.005;
    return new Intl.NumberFormat(c.locale, {minimumFractionDigits: whole && !c.intl ? 0 : 2, maximumFractionDigits: 2}).format(v);
  };
  const money = (n, cur) => (CUR[cur] || CUR.INR).sym + fmt(n, cur);
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? ' ' + ONES[x % 10] : '');
  const three = x => x >= 100 ? ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x);
  const wordsIn = n => {
    n = Math.round(n); if (!n) return 'Zero';
    let r = '';
    const cr = Math.floor(n / 10000000), lk = Math.floor((n % 10000000) / 100000), th = Math.floor((n % 100000) / 1000), rm = n % 1000;
    if (cr) r += three(cr) + ' Crore ';
    if (lk) r += two(lk) + ' Lakh ';
    if (th) r += two(th) + ' Thousand ';
    if (rm) r += three(rm);
    return r.trim();
  };
  const wordsIntl = n => {
    n = Math.round(n); if (!n) return 'Zero';
    const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
    const parts = []; let i = 0;
    while (n > 0) { const c = n % 1000; if (c) parts.unshift(three(c) + (scales[i] ? ' ' + scales[i] : '')); n = Math.floor(n / 1000); i++; }
    return parts.join(' ').trim();
  };
  const words = (n, cur) => {
    const c = CUR[cur] || CUR.INR;
    const v = Math.round(Math.abs(num(n)) * 100) / 100;
    if (!v) return 'Zero ' + c.word + ' Only';
    const whole = Math.floor(v), frac = Math.round((v - whole) * 100);
    const main = whole ? (c.intl ? wordsIntl(whole) : wordsIn(whole)) + ' ' + c.word : '';
    const small = frac ? two(frac) + (c.intl ? ' Cents' : ' Paise') : '';
    return (main && small ? main + ' and ' + small : main || small) + ' Only';
  };

  /* ---------- the financial year, April to March ---------- */
  const fyOf = ymd => {
    const d = U.parseYmd(ymd || U.todayStr());
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const a = m >= 4 ? y : y - 1;
    return a + '-' + String((a + 1) % 100).padStart(2, '0');
  };
  const fyRange = fy => { const a = Number(String(fy).slice(0, 4)); return {from: a + '-04-01', to: (a + 1) + '-03-31'}; };

  /* ---------- settings, merged over what the invoice builder carried ---------- */
  const DEFAULTS = Object.freeze({
    company: {name: 'Mask Management', brand: 'Mask360', tagline: 'by Mask Management',
      address: '608, Platinum Prive, Upper Juhu Lane, DN Nagar\nAndheri West, Mumbai 400053\nMaharashtra, India', state: 'Maharashtra',
      pan: 'DGFPR0438M', gstin: '', udyam: 'UDYAM-MH-19-0114388', mail: 'accounts@mask360.agency', phone: '+91 9591075100',
      cities: 'Mumbai · Delhi · Bengaluru · Dubai · Abu Dhabi', site: 'mask360.agency'},
    bank: {holder: 'Mask Management', name: 'Axis Bank', branch: 'Khar (W), Linking Road', account: '922020011472266', ifsc: 'UTIB0000186', iban: '', swift: ''},
    signatory: {who: 'Kaavish Ramchandani', title: 'Chief Alchemist · Mask Management'},
    sig: '', seal: '',
    numbering: {prefix: 'MM'},
    defaults: {terms: '15 days from invoice date (Net 15)', termsDays: 15, sac: '998361', currency: 'INR', gstRate: 18, tdsRate: 10,
      notes: 'Retainer billed 50% in advance and 50% on delivery per the Master Services Agreement.\nThis is a computer-generated invoice.',
      exportNote: 'Export of services from India, no Indian GST charged. VAT to be accounted for by the recipient under reverse charge.'},
    chase: {auto: false, days: '3,7,14', cc: ''},
    compliance: {gst: true, tds: true, pf: false},
    /* what the agency gives: each switch shows or hides its line on pay, the run and the payslip */
    payroll: {pf: false, esi: false, pt: true, gratuity: false, insurance: false, insurancePremium: 0, payday: 1, employerCost: false}
  });
  const deep = (a, b) => {
    const out = {...a};
    for (const k of Object.keys(b || {})) {
      const v = b[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') ? deep(a[k], v) : v;
    }
    return out;
  };
  const settings = ctx => deep(DEFAULTS, ((ctx.coll.books && ctx.coll.books.map.settings) || {}));
  const clientBook = ctx => ((ctx.coll.books && ctx.coll.books.map.clients) || {}).map || {};

  /* ---------- invoices ---------- */
  const lineAmt = l => Math.round(num(l.qty) * num(l.rate) * 100) / 100;
  const totals = inv => {
    const sub = (inv.lines || []).reduce((s, l) => s + lineAmt(l), 0);
    const rate = num(inv.gstRate == null ? 18 : inv.gstRate);
    const cgst = inv.gst === 'intra' ? sub * rate / 200 : 0;
    const sgst = inv.gst === 'intra' ? sub * rate / 200 : 0;
    const igst = inv.gst === 'inter' ? sub * rate / 100 : 0;
    const tax = cgst + sgst + igst;
    const total = sub + tax;
    const paid = (inv.payments || []).reduce((s, p) => s + num(p.amount), 0);
    const tds = num(inv.tds);
    const balance = Math.round((total - paid - tds) * 100) / 100;
    return {sub, cgst, sgst, igst, tax, total, paid, tds, balance};
  };
  const status = (inv, today) => {
    if (!inv) return 'draft';
    if (inv.status === 'void') return 'void';
    const t = totals(inv);
    if (t.total > 0 && t.balance <= 0.5) return 'paid';
    if (!inv.sentAt && inv.status !== 'sent') return 'draft';
    if (t.paid > 0) return 'part';
    if (inv.due && inv.due < (today || U.todayStr())) return 'overdue';
    return 'sent';
  };
  const STATUS_PILL = {draft: undefined, sent: 'ink', overdue: 'flame', part: 'flame-o', paid: 'warm', void: undefined};
  const STATUS_TEXT = {draft: 'draft', sent: 'sent', overdue: 'overdue', part: 'part paid', paid: 'paid', void: 'void'};
  const invoices = ctx => {
    const out = [];
    const map = (ctx.coll.invoices && ctx.coll.invoices.map) || {};
    for (const fy of Object.keys(map)) {
      const rows = (map[fy] || {}).rows || {};
      for (const id of Object.keys(rows)) if (rows[id]) out.push({...rows[id], id, fy});
    }
    out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  };
  const codeOf = (ctx, clientId) => {
    const b = clientBook(ctx)[clientId];
    if (b && b.code) return String(b.code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN';
    const c = ctx.coll.clients.map[clientId];
    const nm = (c && c.name) || '';
    const init = nm.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().replace(/[^A-Z]/g, '');
    return init.slice(0, 3) || 'GEN';
  };
  const nextNumber = (ctx, code, fy) => {
    const s = settings(ctx);
    const head = s.numbering.prefix + '/' + fy + '/' + code + '-';
    let max = 0;
    for (const inv of invoices(ctx)) {
      if (inv.fy !== fy || !String(inv.no || '').startsWith(head)) continue;
      const n = Number(String(inv.no).slice(head.length)) || 0;
      if (n > max) max = n;
    }
    return head + String(max + 1).padStart(3, '0');
  };
  const expenses = ctx => {
    const out = [];
    const map = (ctx.coll.expenses && ctx.coll.expenses.map) || {};
    for (const month of Object.keys(map)) {
      const rows = (map[month] || {}).rows || {};
      for (const id of Object.keys(rows)) if (rows[id]) out.push({...rows[id], id, month});
    }
    out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0));
    return out;
  };
  /* days past due, for aging */
  const ageOf = (inv, today) => inv.due ? U.daysBetween(inv.due, today || U.todayStr()) : 0;

  /* ---------- the compliance calendar, India ---------- */
  const NAMES_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const nextDates = (ctx, today) => {
    const s = settings(ctx).compliance;
    const t = U.parseYmd(today || U.todayStr());
    const out = [];
    const push = (ymd, what, on) => { if (on && ymd >= U.ymd(t)) out.push({date: ymd, what}); };
    for (let k = 0; k < 3; k++) {
      const d = new Date(t.getFullYear(), t.getMonth() + k, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const prev = NAMES_MON[(m + 11) % 12];
      const ymd = day => U.ymd(new Date(y, m, day));
      push(ymd(7), 'TDS for ' + prev + ' due', s.tds && !!s.tds);
      push(ymd(11), 'GSTR-1 for ' + prev + ' due', s.gst && !!s.gst);
      push(ymd(15), 'PF and ESI for ' + prev + ' due', !!s.pf);
      push(ymd(20), 'GSTR-3B for ' + prev + ' due', !!s.gst);
      if ([5, 8, 11, 2].includes(m)) push(ymd(15), 'Advance tax instalment due', true);
      if (m === 6) push(ymd(31), 'TDS return for April to June due', !!s.tds);
      if (m === 9) push(ymd(31), 'TDS return for July to September due', !!s.tds);
      if (m === 0) push(ymd(31), 'TDS return for October to December due', !!s.tds);
      if (m === 4) push(ymd(31), 'TDS return for January to March due', !!s.tds);
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.slice(0, 8);
  };

  /* ---------- the printable document ---------- */
  function print(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('doc-print');
    document.body.classList.add('print-doc');
    const done = () => { el.classList.remove('doc-print'); document.body.classList.remove('print-doc'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { done(); }
    setTimeout(done, 60000);
  }
  function DocFrame({id, title, actions, children}) {
    return html`<div class="doc-wrap">
      <div class="row between doc-tools">
        <div class="micro" style=${{textTransform: 'none'}}>${title || 'document'}</div>
        <span class="row nowrap" style=${{gap: '8px'}}>
          ${actions || null}
          <${UI.Btn} sm=${true} onClick=${() => print(id)}><${icons.download || icons.upload}/>Download PDF<//>
        </span>
      </div>
      <div class="doc" id=${id}>
        <div class="doc-band"/>
        ${children}
      </div>
    </div>`;
  }
  /* the letterhead every document opens with */
  function DocHead({ctx, right}) {
    const s = settings(ctx);
    const c = s.company;
    return html`<div class="doc-head">
      <div>
        <${M.Mark} width="118px"/>
        <div class="doc-micro">${c.tagline}</div>
        <div class="doc-addr">${String(c.address || '').split('\n').map((l, i) => html`<div key=${i}>${l}</div>`)}
          <div>${c.pan ? 'PAN: ' + c.pan : ''}${c.pan && c.gstin ? ' · ' : ''}${c.gstin ? 'GSTIN: ' + c.gstin : ''}</div>
          <div>${c.mail}${c.phone ? ' · ' + c.phone : ''}</div>
        </div>
      </div>
      <div class="doc-head-right">${right || null}</div>
    </div>`;
  }
  function DocSign({ctx, label}) {
    const s = settings(ctx);
    return html`<div class="doc-sign">
      ${s.sig ? html`<img class="doc-sig" src=${s.sig} alt=""/>` : html`<div class="doc-sig-space"/>`}
      ${s.seal ? html`<img class="doc-seal" src=${s.seal} alt=""/>` : null}
      <div class="doc-micro">${label || 'Authorised signatory'}</div>
      <div class="doc-sign-who">${s.signatory.who}</div>
      <div class="doc-sub">${s.signatory.title}</div>
    </div>`;
  }
  function DocFoot({ctx}) {
    const c = settings(ctx).company;
    return html`<div class="doc-foot">${c.site} · ${c.mail}${c.phone ? ' · ' + c.phone : ''}${c.cities ? ' · ' + c.cities : ''}</div>`;
  }

  /* ---------- images for the signature and the seal: shrunk in the browser ---------- */
  const IMG_MAX = 90000;
  function shrinkImage(file, side) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const sc = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/png');
        if (out.length > IMG_MAX) out = c.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        out.length > IMG_MAX ? rej(new Error('too big')) : res(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not an image')); };
      img.src = url;
    });
  }

  /* ---------- the section ---------- */
  const TABS = {overview: 'overview', invoices: 'Invoices', expenses: 'Expenses', payroll: 'Payroll', letters: 'Letters', billing: 'billing'};
  function Books({tab, id}) {
    const ctx = M.useCtx();
    const t = TABS[tab] ? tab : 'overview';
    if (!ctx.isOwner) return html`<div class="stack"><${UI.PageHead} micro="the books" title="Books"/><${UI.Empty} text="The books are the owner's alone."/></div>`;
    const Page = t === 'invoices' ? M.pages.Invoices : t === 'expenses' ? M.pages.Expenses : t === 'payroll' ? M.pages.Payroll : t === 'letters' ? M.pages.Letters : null;
    return html`<div class="stack" style=${{gap: '20px'}}>
      <header class="hero ink">
        <div>
          <${UI.Micro}>${U.dateLabel(new Date(ctx.now))}<//>
          <h1 class="hi">Books</h1>
          <div class="sub" style=${{marginTop: '10px'}}>Invoices, expenses, payroll and letters. Yours alone.</div>
        </div>
      </header>
      <${M.SectionTabs} section="books" active=${t}/>
      ${t === 'overview' ? html`<${Overview}/>` : t === 'billing' ? (id && ctx.coll.clients.map[id] ? html`<${BillingPage} clientId=${id}/>` : html`<${Setup}/>`) : Page ? html`<div class="embedded"><${Page} id=${id}/></div>` : html`<${UI.Empty} text="This part of the books is not in this build."/>`}
    </div>`;
  }

  /* ---------- overview ---------- */
  /* the headline total is cast in metal (metal-fx MetalText) and the rest stay plain, flame when they need a call */
  function Tile({v, l, to, hot, metal}) {
    const phone = M.usePhone();
    const nil = v == null;
    const inner = html`<span class=${'v num' + (hot ? ' flame-t' : '') + (nil ? ' nil' : '')}>${nil ? 'not yet' : metal && M.fx ? html`<${MetalNum} size=${phone ? 26 : 30} weight=${600} color=${hot ? M.fx.FLAME : undefined}>${String(v)}<//>` : v}</span><span class="l">${l}</span>`;
    return to ? html`<button type="button" class=${'stat rowbtn' + (hot ? ' hot' : '')} onClick=${() => M.nav(to)}>${inner}</button>` : html`<div class=${'stat' + (hot ? ' hot' : '')}>${inner}</div>`;
  }
  function Overview() {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const fy = fyOf(today), fr = fyRange(fy);
    const month = U.monthId(new Date(ctx.now));
    const list = invoices(ctx);
    const issued = i => !['draft', 'void'].includes(status(i, today));
    const inFy = list.filter(i => issued(i) && i.date >= fr.from && i.date <= fr.to);
    const inrOf = i => (i.currency === 'INR' || !i.currency) ? 1 : num(i.fx) || 0;
    const billed = inFy.reduce((s, i) => s + totals(i).total * inrOf(i), 0);
    const collected = list.reduce((s, i) => s + (i.payments || []).filter(p => p.at && U.ymd(new Date(p.at)) >= fr.from).reduce((x, p) => x + num(p.amount), 0) * inrOf(i), 0);
    const open = list.filter(i => ['sent', 'overdue', 'part'].includes(status(i, today)));
    const outstanding = open.reduce((s, i) => s + totals(i).balance * inrOf(i), 0);
    const overdue = open.filter(i => status(i, today) === 'overdue' || (status(i, today) === 'part' && i.due < today));
    const overdueAmt = overdue.reduce((s, i) => s + totals(i).balance * inrOf(i), 0);
    const exp = expenses(ctx);
    const expMonth = exp.filter(e => e.month === month).reduce((s, e) => s + num(e.amount), 0);
    const collMonth = list.reduce((s, i) => s + (i.payments || []).filter(p => p.at && U.monthId(new Date(p.at)) === month).reduce((x, p) => x + num(p.amount), 0) * inrOf(i), 0);
    const run = (ctx.coll.payroll && ctx.coll.payroll.map[month] && ctx.coll.payroll.map[month].run) || null;
    const payMonth = run ? Object.values(run.rows || {}).reduce((s, r) => s + num(r.net), 0) : 0;
    const buckets = [['0 to 30', 0, 30], ['31 to 60', 31, 60], ['61 to 90', 61, 90], ['over 90', 91, 100000]].map(([l, a, b]) => {
      const rows = open.filter(i => { const d = ageOf(i, today); return d >= a && d <= b; });
      return {l, n: rows.length, amt: rows.reduce((s, i) => s + totals(i).balance * inrOf(i), 0)};
    });
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(ctx.now); d.setDate(1); d.setMonth(d.getMonth() - k);
      const mid = U.monthId(d);
      const b = list.filter(i => issued(i) && String(i.date || '').slice(0, 7) === mid).reduce((s, i) => s + totals(i).total * inrOf(i), 0);
      const c = list.reduce((s, i) => s + (i.payments || []).filter(p => p.at && U.monthId(new Date(p.at)) === mid).reduce((x, p) => x + num(p.amount), 0) * inrOf(i), 0);
      const e = exp.filter(x => x.month === mid).reduce((s, x) => s + num(x.amount), 0);
      months.push({mid, label: NAMES_MON[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2), b, c, e});
    }
    const calls = [];
    for (const i of overdue.slice(0, 6)) calls.push({key: 'inv' + i.id, text: i.no + ', ' + (i.clientName || 'client') + ', ' + money(totals(i).balance, i.currency) + ' due ' + U.fmtDate(i.due) + ', ' + ageOf(i, today) + ' days late', to: '#invoices/' + i.id, hot: true});
    for (const i of list.filter(x => x.auto === 'retainer' && status(x, today) === 'draft').slice(0, 4)) calls.push({key: 'draft' + i.id, text: 'Retainer draft ready: ' + i.no + ', ' + (i.clientName || ''), to: '#invoices/' + i.id});
    const hrMap = (ctx.coll.hr && ctx.coll.hr.map) || {};
    for (const uid of Object.keys(hrMap)) for (const lid of Object.keys((hrMap[uid] || {}).letters || {})) { const l = hrMap[uid].letters[lid]; if (l && l.status === 'draft') calls.push({key: 'let' + lid, text: 'A ' + (l.kind || 'letter') + ' letter is drafted and not issued', to: '#letters/' + uid}); }
    const dates = nextDates(ctx, today);
    const fx = list.some(i => i.currency && i.currency !== 'INR' && !num(i.fx));
    return html`<div class="stack" style=${{gap: '18px'}}>
      <div class="grid4">
        <${Tile} v=${U.inr(billed)} l=${'billed, FY ' + fy} to="#invoices"/>
        <${Tile} v=${U.inr(collected)} l=${'collected, FY ' + fy} to="#invoices"/>
        <${Tile} v=${U.inr(outstanding)} l=${open.length + ' open, outstanding'} to="#invoices" hot=${overdue.length > 0}/>
        <${Tile} v=${overdue.length ? U.inr(overdueAmt) : '0'} l="overdue" to="#invoices" hot=${overdue.length > 0}/>
      </div>
      <div class="grid4">
        <${Tile} v=${U.inr(collMonth)} l="collected this month"/>
        <${Tile} v=${U.inr(expMonth)} l="expenses this month" to="#expenses"/>
        <${Tile} v=${run ? U.inr(payMonth) : null} l="payroll this month" to="#payroll"/>
        <${Tile} v=${U.inr(collMonth - expMonth - payMonth)} l="net this month" hot=${collMonth - expMonth - payMonth < 0} metal=${true}/>
      </div>
      ${fx ? html`<div class="card flame small">An invoice in a foreign currency has no INR rate on it, so the totals above leave it out. Open it and set the rate.</div>` : null}
      <div class="split">
        <div class="stack" style=${{gap: '18px'}}>
          <${UI.Card} title=${M.fx ? html`<span class="row nowrap fx-title-bot"><${M.fx.Bot} feature="books" state=${calls.length ? 'working' : 'sleeping'} size=${26} label="m360 books"/>What needs a call</span>` : 'What needs a call'} id="books-calls">
            ${calls.length ? calls.map(c => html`<button type="button" key=${c.key} class="listrow rowbtn" onClick=${() => M.nav(c.to)}>
              ${c.hot ? html`<span class="dotflame"/>` : html`<span class="pill">next</span>`}<span class="grow">${c.text}</span></button>`)
              : html`<${UI.Empty} text="Nothing waiting on you. Invoices are paid or not yet due, no drafts sit unsent."/>`}
          <//>
          <${UI.Card} title="Six months" id="books-months">
            <div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>month</th><th class="num">billed</th><th class="num">collected</th><th class="num">expenses</th></tr></thead>
              <tbody>${months.map(m => html`<tr key=${m.mid}><td data-label="month">${m.label}</td><td data-label="billed" class="num">${U.inr(m.b)}</td><td data-label="collected" class="num">${U.inr(m.c)}</td><td data-label="expenses" class="num">${U.inr(m.e)}</td></tr>`)}</tbody>
            </table></div>
          <//>
        </div>
        <div class="stack" style=${{gap: '18px'}}>
          <${UI.Card} title="Receivables by age" id="books-aging">
            ${buckets.map(b => html`<div class="listrow" key=${b.l}><span class="grow">${b.l} days</span><span class="tiny ink62 num">${b.n}</span><span class="num" style=${{fontWeight: 500}}>${U.inr(b.amt)}</span></div>`)}
            <div class="listrow fx-total"><b class="grow">Outstanding</b>${M.fx ? html`<${MetalNum} size=${18} weight=${600} color=${overdue.length ? M.fx.FLAME : undefined}>${U.inr(outstanding)}<//>` : html`<b class="num">${U.inr(outstanding)}</b>`}</div>
          <//>
          <${UI.Card} title="Compliance dates" id="books-dates">
            ${dates.length ? dates.map(d => html`<div class="listrow" key=${d.date + d.what}><span class="num tiny ink62" style=${{width: '86px'}}>${U.fmtDay(d.date)}</span><span class="grow">${d.what}</span></div>`)
              : html`<${UI.Empty} text="Switch GST or TDS on under Setup to see the dates."/>`}
            <div class="tiny ink62" style=${{marginTop: '8px'}}>Each date lands in your inbox three days before.</div>
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ---------- setup ---------- */
  const COUNTRIES = ['India', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'Oman', 'United States', 'United Kingdom', 'Singapore', 'Other'];
  function Setup({id}) {
    const ctx = M.useCtx();
    const s = settings(ctx);
    const [f, setF] = useState(() => U.clone(s));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (!dirty) setF(U.clone(settings(ctx))); }, [ctx.coll.books]);
    const set = (path, v) => { setDirty(true); setF(x => { const n = U.clone(x); let o = n; const ks = path.split('.'); for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; return n; }); };
    const save = async () => {
      setBusy(true);
      try { await ctx.W.set('books/settings', {...f, updated: Date.now()}); setDirty(false); M.toast('Saved'); } catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const pick = (key, side) => e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file) return;
      shrinkImage(file, side).then(d => set(key, d)).catch(() => M.toast('Use a PNG or JPEG under about 1 MB', true));
    };
    const In = ({k, label, type, hint}) => html`<${UI.Input} label=${label} type=${type} hint=${hint} value=${String(k.split('.').reduce((o, x) => (o || {})[x], f) == null ? '' : k.split('.').reduce((o, x) => (o || {})[x], f))} onChange=${v => set(k, type === 'number' ? num(v) : v)}/>`;
    return html`<div class="stack" style=${{gap: '18px'}}>
      <${ClientBilling}/>
      <div class="row between">
        <div class="sub small">The company block, the bank and the signatory print on every invoice, payslip and letter.</div>
        <${UI.Btn} id="books-save" disabled=${!dirty || busy} onClick=${save}>Save setup<//>
      </div>
      <div class="grid2">
        <${UI.Card} title="Company">
          <div class="stack tight">
            <${In} k="company.name" label="legal name"/>
            <div class="grid2"><${In} k="company.brand" label="brand on the letterhead"/><${In} k="company.tagline" label="line under the brand"/></div>
            <${UI.TextArea} label="address, one line per row" rows=${3} value=${f.company.address} onChange=${v => set('company.address', v)}/>
            <div class="grid2"><${In} k="company.state" label="state, for GST"/><${In} k="company.gstin" label="GSTIN, blank when not registered"/></div>
            <div class="grid2"><${In} k="company.pan" label="PAN"/><${In} k="company.udyam" label="Udyam"/></div>
            <div class="grid2"><${In} k="company.mail" label="accounts email"/><${In} k="company.phone" label="phone"/></div>
            <div class="grid2"><${In} k="company.site" label="site"/><${In} k="company.cities" label="cities on the footer"/></div>
          </div>
        <//>
        <div class="stack" style=${{gap: '18px'}}>
          <${UI.Card} title="Bank">
            <div class="stack tight">
              <${In} k="bank.holder" label="account holder"/>
              <div class="grid2"><${In} k="bank.name" label="bank"/><${In} k="bank.branch" label="branch"/></div>
              <div class="grid2"><${In} k="bank.account" label="account number"/><${In} k="bank.ifsc" label="IFSC"/></div>
              <div class="grid2"><${In} k="bank.iban" label="IBAN, optional"/><${In} k="bank.swift" label="SWIFT, optional"/></div>
            </div>
          <//>
          <${UI.Card} title="Signatory">
            <div class="stack tight">
              <div class="grid2"><${In} k="signatory.who" label="who signs"/><${In} k="signatory.title" label="title"/></div>
              <div class="row">
                <label class="btn sec sm">${f.sig ? 'Change the signature' : 'Add a signature image'}<input type="file" accept="image/*" style=${{display: 'none'}} onChange=${pick('sig', 420)}/></label>
                ${f.sig ? html`<img src=${f.sig} alt="" style=${{height: '40px'}}/><button type="button" class="linky small" onClick=${() => set('sig', '')}>Remove</button>` : null}
              </div>
              <div class="row">
                <label class="btn sec sm">${f.seal ? 'Change the seal' : 'Add a seal image'}<input type="file" accept="image/*" style=${{display: 'none'}} onChange=${pick('seal', 300)}/></label>
                ${f.seal ? html`<img src=${f.seal} alt="" style=${{height: '40px'}}/><button type="button" class="linky small" onClick=${() => set('seal', '')}>Remove</button>` : null}
              </div>
            </div>
          <//>
        </div>
      </div>
      <div class="grid2">
        <${UI.Card} title="Invoice defaults">
          <div class="stack tight">
            <div class="grid2"><${In} k="numbering.prefix" label="number prefix" hint="MM gives MM/2026-27/HH-001"/>
              <${UI.Select} label="currency" value=${f.defaults.currency} options=${CUR_OPTS} onChange=${v => set('defaults.currency', v)}/></div>
            <div class="grid2"><${In} k="defaults.gstRate" label="GST rate, percent" type="number"/><${In} k="defaults.sac" label="SAC code"/></div>
            <div class="grid2"><${In} k="defaults.termsDays" label="due in days" type="number"/><${In} k="defaults.tdsRate" label="TDS the client deducts, percent" type="number"/></div>
            <${In} k="defaults.terms" label="payment terms line"/>
            <${UI.TextArea} label="notes on every invoice, one per line" rows=${3} value=${f.defaults.notes} onChange=${v => set('defaults.notes', v)}/>
            <${UI.TextArea} label="the export line, for invoices outside India" rows=${2} value=${f.defaults.exportNote} onChange=${v => set('defaults.exportNote', v)}/>
          </div>
        <//>
        <div class="stack" style=${{gap: '18px'}}>
          <${UI.Card} title="Chasing">
            <div class="stack tight">
              <div class="row between"><span>Chase overdue invoices by email on the team site</span>
                <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${f.chase.auto ? 'on' : 'off'} ariaLabel="Auto chase" onChange=${v => set('chase.auto', v === 'on')}/></div>
              <${In} k="chase.days" label="days after the due date, comma separated" hint="3,7,14 sends three reminders; the fourth day lands in your inbox for a call"/>
              <${In} k="chase.cc" label="copy every invoice and reminder to"/>
              <div class="tiny ink62">Every reminder is polite, names the invoice and the amount, and carries the bank details. Nothing goes out for a draft.</div>
            </div>
          <//>
          <${UI.Card} title="Compliance calendar">
            <div class="stack tight">
              ${[['gst', 'GST registered: GSTR-1 by the 11th, GSTR-3B by the 20th'], ['tds', 'TDS deducted on payments: due by the 7th, returns each quarter'], ['pf', 'PF and ESI: due by the 15th']].map(([k, l]) => html`<div class="row between" key=${k}><span class="small">${l}</span>
                <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${f.compliance[k] ? 'on' : 'off'} ariaLabel=${k} onChange=${v => set('compliance.' + k, v === 'on')}/></div>`)}
              <div class="tiny ink62">Advance tax dates (15 June, September, December, March) always show.</div>
            </div>
          <//>
          <${UI.Card} title="Payroll, what the agency gives" id="books-payroll">
            <div class="stack tight">
              ${[['pf', 'Provident fund', '12 percent of basic from the person, capped at 1,800, and the same from the agency'], ['esi', 'ESI', '0.75 percent from the person and 3.25 from the agency, for gross up to 21,000'], ['pt', 'Professional tax, Maharashtra', '200 a month, 300 in February, for gross over 10,000'], ['gratuity', 'Gratuity', 'no deduction; 4.81 percent of basic in the cost to company'], ['insurance', 'Health insurance', 'a premium the agency pays each month']].map(([k, l, h]) => html`<div class="row between" key=${k}><span><span class="small">${l}</span><div class="tiny ink62">${h}</div></span>
                <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${f.payroll[k] ? 'on' : 'off'} ariaLabel=${'Payroll ' + k} onChange=${v => set('payroll.' + k, v === 'on')}/></div>`)}
              ${f.payroll.insurance ? html`<${In} k="payroll.insurancePremium" label="insurance premium a month per person, INR" type="number"/>` : null}
              <div class="grid2"><${In} k="payroll.payday" label="payday, day of the month" type="number"/>
                <${UI.Select} label="cost to company on the payslip" value=${f.payroll.employerCost ? 'on' : 'off'} options=${[{v: 'off', label: 'Hidden'}, {v: 'on', label: 'Shown'}]} onChange=${v => set('payroll.employerCost', v === 'on')}/></div>
              <div class="tiny ink62">A switch that is off hides its line from pay, the month and every payslip.</div>
            </div>
          <//>
        </div>
      </div>
      <${ClientBilling} id=${id}/>
    </div>`;
  }

  /* ---------- each client's billing profile ---------- */
  const blankBilling = () => ({code: '', legalName: '', address: '', country: 'India', taxId: '', currency: 'INR', termsDays: 15, contactName: '', contactEmail: '', cc: '', po: '',
    retainer: {active: false, amount: 0, day: 1, desc: 'Monthly retainer', sac: '998361', gst: 'intra'}});
  const MINE_FIELDS = [['legalName', 'legal name'], ['address', 'billing address'], ['country', 'country'], ['taxId', 'GSTIN or tax id'], ['contactName', 'who receives invoices'], ['contactEmail', 'accounts email'], ['currency', 'currency'], ['termsDays', 'due in days'], ['po', 'PO number']];
  /* a billing profile from what m360 already knows: the client record, the Base's people at that company */
  function draftBilling(ctx, clientId) {
    const c = ctx.coll.clients.map[clientId] || {};
    const b = blankBilling();
    b.legalName = c.name || '';
    b.code = codeOf(ctx, clientId);
    const orgs = (ctx.coll.orgs && ctx.coll.orgs.map) || {};
    const org = Object.keys(orgs).map(k => orgs[k]).find(o => o && o.client === clientId && !o.archived);
    if (org) {
      if (org.legalName) b.legalName = org.legalName;
      if (org.country) b.country = org.country;
      if (org.city || org.hq) b.address = [org.address, org.city || org.hq, org.country].filter(Boolean).join('\n');
    }
    const people = (ctx.coll.contacts && ctx.coll.contacts.map) || {};
    const at = Object.keys(people).map(k => people[k]).filter(x => x && !x.archived && ((org && x.org === org.id) || x.client === clientId));
    const mailOf = x => String(x.mail || x['email'] || '').trim();
    const acct = at.find(x => /account|finance|payable|billing/i.test(x.title || '')) || at.find(x => mailOf(x));
    if (acct) { b.contactName = [acct.first, acct.last].filter(Boolean).join(' ') || acct.name || ''; b.contactEmail = mailOf(acct); }
    if (b.country && b.country !== 'India') { b.currency = /UAE|Emirates|Dubai/i.test(b.country) ? 'AED' : /Saudi/i.test(b.country) ? 'SAR' : /United Kingdom|UK|England/i.test(b.country) ? 'GBP' : /Europe|Germany|France|Netherlands|Italy|Spain/i.test(b.country) ? 'EUR' : 'USD'; b.retainer.gst = 'none'; }
    return b;
  }
  const cleanBilling = f => ({...f, code: String(f.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), termsDays: num(f.termsDays) || 15,
    retainer: {...f.retainer, amount: num(f.retainer.amount), day: Math.min(28, Math.max(1, num(f.retainer.day) || 1))}});
  const siteApi = () => typeof window.M360_API === 'function';
  /* the mail scan for one client: the found fields and where each came from */
  const mine = clientId => window.M360_API('booksmine', {clientId});
  const missing = (cur, found) => MINE_FIELDS.map(([k]) => k).filter(k => found && found[k] && !(cur && String(cur[k] || '').trim()));

  function ClientBilling() {
    const ctx = M.useCtx();
    const book = clientBook(ctx);
    const clients = Object.keys(ctx.coll.clients.map).map(k => ({id: k, ...ctx.coll.clients.map[k]})).filter(c => c.status !== 'lost' && !c.archived).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const [scan, setScan] = useState(null);   /* {at: clientId, done: n, filled: n, total: n, log: []} */
    const scanAll = async () => {
      if (!siteApi() || scan) return;
      const st = {at: '', done: 0, filled: 0, total: clients.length, log: []};
      setScan({...st});
      for (const c of clients) {
        st.at = c.id; setScan({...st});
        try {
          const r = await mine(c.id);
          const cur = book[c.id] || draftBilling(ctx, c.id);
          /* a saved profile keeps what it has; a client without one takes everything the mail says */
          const take = book[c.id] ? missing(cur, r.found) : MINE_FIELDS.map(([k]) => k).filter(k => r.found && r.found[k]);
          if (take.length) {
            const next = {...cur};
            for (const k of take) next[k] = k === 'termsDays' ? num(r.found[k]) || cur.termsDays : String(r.found[k]).slice(0, 400);
            await ctx.W.merge('books/clients', {map: {[c.id]: cleanBilling(next)}, updated: Date.now()});
            st.filled++;
            st.log.push(c.name + ': ' + take.map(k => (MINE_FIELDS.find(x => x[0] === k) || [k, k])[1]).join(', '));
          } else st.log.push(c.name + ': ' + (r.sources && r.sources.length ? 'nothing new' : 'no mail about billing'));
        } catch (e) { st.log.push(c.name + ': ' + ((e && e.message) || 'could not read the mail')); }
        st.done++; setScan({...st});
      }
      st.at = ''; setScan({...st});
      M.toast(st.filled ? 'Filled ' + st.filled + (st.filled === 1 ? ' profile' : ' profiles') + ' from your mail' : 'Nothing new in the mail');
    };
    return html`<${UI.Card} title="Clients, billing" id="billing-clients" action=${siteApi() && clients.length ? html`<${UI.Btn} sm=${true} kind="sec" id="billing-scan" disabled=${!!(scan && scan.at)} onClick=${scanAll}>${scan && scan.at ? 'Reading your mail, ' + scan.done + ' of ' + scan.total : 'Fill from Gmail, every client'}<//>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>What prints on each client's invoice, and the retainer that drafts itself every month. Open a client to fill it in, by hand or from your mail.</p>
      ${clients.length ? html`<div class="tbl-wrap"><table class="tbl" id="billing-table">
        <thead><tr><th>client</th><th>legal name</th><th>tax id</th><th>accounts email</th><th>retainer</th><th></th></tr></thead>
        <tbody>${clients.map(c => {
          const b = book[c.id];
          const full = b && b.legalName && b.contactEmail && (b.country !== 'India' || b.taxId);
          return html`<tr key=${c.id} class="billing-row" style=${{cursor: 'pointer'}} onClick=${() => M.nav('#billing/' + c.id)}>
            <td data-label="client"><b>${c.name}</b>${b && b.code ? html`<span class="tiny ink62"> · ${b.code}</span>` : null}</td>
            <td data-label="legal name">${b && b.legalName ? b.legalName : html`<span class="tiny ink62">not set</span>`}</td>
            <td data-label="tax id">${b && b.taxId ? html`<span class="num">${b.taxId}</span>` : html`<span class="tiny ink62">${b && b.country && b.country !== 'India' ? 'export' : 'not set'}</span>`}</td>
            <td data-label="accounts email">${b && b.contactEmail ? b.contactEmail : html`<span class="tiny ink62">not set</span>`}</td>
            <td data-label="retainer">${b && b.retainer && b.retainer.active ? html`<span class="num">${money(b.retainer.amount, b.currency)}</span><span class="tiny ink62"> on day ${b.retainer.day}</span>` : html`<span class="tiny ink62">none</span>`}</td>
            <td data-label="">${full ? html`<${UI.Pill} kind="ink">ready<//>` : b ? html`<${UI.Pill} kind="flame-o">incomplete<//>` : html`<${UI.Pill}>new<//>`}</td>
          </tr>`;
        })}</tbody>
      </table></div>` : html`<${UI.Empty} text="No clients yet. Add one under Accounts and its billing appears here."/>`}
      ${scan && scan.log.length ? html`<div class="stack tight" style=${{marginTop: '12px'}} id="billing-scan-log">${scan.log.map((l, i) => html`<div class="tiny ink62" key=${i}>${l}</div>`)}</div>` : null}
    <//>`;
  }

  /* the full page for one client's billing */
  function BillingPage({clientId}) {
    const ctx = M.useCtx();
    const c = ctx.coll.clients.map[clientId] || {};
    const saved = clientBook(ctx)[clientId];
    const [f, setF] = useState(() => saved ? deep(blankBilling(), saved) : draftBilling(ctx, clientId));
    const [dirty, setDirty] = useState(!saved);
    const [busy, setBusy] = useState(false);
    const [found, setFound] = useState(null);   /* {found, sources, note, at} */
    const [reading, setReading] = useState(false);
    useEffect(() => { if (!dirty && saved) setF(deep(blankBilling(), saved)); }, [saved]);
    const set = (k, v) => { setDirty(true); setF(x => ({...x, [k]: v})); };
    const setR = (k, v) => { setDirty(true); setF(x => ({...x, retainer: {...x.retainer, [k]: v}})); };
    const save = async () => {
      if (!f.legalName.trim() || busy) return;
      setBusy(true);
      try { await ctx.W.merge('books/clients', {map: {[clientId]: cleanBilling(f)}, updated: Date.now()}); setDirty(false); M.toast('Saved'); }
      catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const read = async () => {
      if (!siteApi() || reading) return;
      setReading(true);
      try { const r = await mine(clientId); setFound({...r, at: Date.now()}); if (!r.sources || !r.sources.length) M.toast('No mail about billing for ' + (c.name || 'this client')); }
      catch (e) { M.toast(e && e.code === 'google_off' ? 'Connect Google under Workspace first' : (e && e.message) || 'Could not read the mail', true); }
      setReading(false);
    };
    const use = k => { const v = found.found[k]; set(k, k === 'termsDays' ? num(v) || f.termsDays : String(v).slice(0, 400)); };
    const useAll = () => { for (const [k] of MINE_FIELDS) if (found.found[k]) use(k); };
    const abroad = f.country && f.country !== 'India';
    return html`<div class="stack" style=${{gap: '16px'}} id="billing-page">
      <div class="row between">
        <button type="button" class="linky nowrap" id="billing-back" onClick=${() => M.nav('#billing')}><${icons.chevL}/>All clients</button>
        <${UI.Btn} id="billing-save" disabled=${busy || !dirty || !f.legalName.trim()} onClick=${save}>${dirty ? 'Save billing' : 'Saved'}<//>
      </div>
      <${UI.PageHead} micro=${saved ? 'billing profile' : 'a new billing profile, drafted from what m360 knows'} title=${c.name || 'Client'}/>
      <div class="split">
        <div class="stack" style=${{gap: '16px'}}>
          <${UI.Card} title="On the invoice" id="billing-drawer">
            <div class="stack tight">
              <div class="grid2"><${UI.Input} id="billing-code" label="client code in the number" value=${f.code} onChange=${v => set('code', v.toUpperCase().slice(0, 4))} hint="HH gives MM/2026-27/HH-001"/>
                <${UI.Select} id="billing-currency" label="currency" value=${f.currency} options=${CUR_OPTS} onChange=${v => set('currency', v)}/></div>
              <${UI.Input} id="billing-legal" label="legal name on the invoice" value=${f.legalName} onChange=${v => set('legalName', v)}/>
              <${UI.TextArea} id="billing-address" label="billing address, one line per row" rows=${3} value=${f.address} onChange=${v => set('address', v)}/>
              <div class="grid2"><${UI.Select} id="billing-country" label="country" value=${f.country} options=${COUNTRIES.map(x => ({v: x, label: x}))} onChange=${v => set('country', v)}/>
                <${UI.Input} id="billing-taxid" label=${abroad ? 'tax registration, TRN' : 'GSTIN'} value=${f.taxId} onChange=${v => set('taxId', v)}/></div>
              <div class="grid2"><${UI.Input} id="billing-terms" label="due in days" type="number" value=${String(f.termsDays)} onChange=${v => set('termsDays', v)}/>
                <${UI.Input} id="billing-po" label="PO number, printed when set" value=${f.po || ''} onChange=${v => set('po', v)}/></div>
              <div class="grid2"><${UI.Input} id="billing-contact" label="who receives invoices" value=${f.contactName} onChange=${v => set('contactName', v)}/>
                <${UI.Input} id="billing-mail" label="their accounts email" value=${f.contactEmail} onChange=${v => set('contactEmail', v)}/></div>
              <${UI.Input} id="billing-cc" label="copy their invoices to, optional" value=${f.cc || ''} onChange=${v => set('cc', v)}/>
            </div>
          <//>
          <${UI.Card} title="Retainer" id="billing-retainer-card">
            <div class="stack tight">
              <div class="row between"><span class="small">Bill a fixed amount every month. The invoice drafts itself on the billing day.</span>
                <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${f.retainer.active ? 'on' : 'off'} ariaLabel="Retainer" onChange=${v => setR('active', v === 'on')}/></div>
              ${f.retainer.active ? html`<div class="stack tight">
                <div class="grid2"><${UI.Input} id="billing-retainer" label=${'amount, ' + f.currency} type="number" value=${String(f.retainer.amount || '')} onChange=${v => setR('amount', v)}/>
                  <${UI.Input} id="billing-day" label="billing day of the month" type="number" value=${String(f.retainer.day)} onChange=${v => setR('day', v)}/></div>
                <div class="grid2"><${UI.Input} label="line on the invoice" value=${f.retainer.desc} onChange=${v => setR('desc', v)}/><${UI.Input} label="SAC" value=${f.retainer.sac} onChange=${v => setR('sac', v)}/></div>
                <${UI.Select} label="tax" value=${f.retainer.gst} options=${[{v: 'intra', label: 'CGST and SGST, same state'}, {v: 'inter', label: 'IGST, another state'}, {v: 'none', label: 'No GST, export or unregistered'}]} onChange=${v => setR('gst', v)}/>
              </div>` : null}
            </div>
          <//>
        </div>
        <${UI.Card} title="From your mail" id="billing-mine">
          ${siteApi() ? html`<div class="stack tight">
            <p class="small ink62" style=${{marginTop: 0}}>m360 reads the mail about ${c.name || 'this client'} in your Gmail (invoices, POs, GST certificates, bank letters, their attachments) and picks out the billing details. You choose what to keep.</p>
            <div><${UI.Btn} kind=${found ? 'sec' : undefined} sm=${true} id="billing-read" disabled=${reading} onClick=${read}>${reading ? 'Reading' : found ? 'Read again' : 'Find billing details in Gmail'}<//></div>
            ${found ? html`<div class="stack tight" id="billing-found">
              ${MINE_FIELDS.filter(([k]) => found.found && found.found[k]).map(([k, l]) => html`<div class="listrow" key=${k}>
                <span class="grow"><div class="tiny ink62">${l}</div><div class="small">${String(found.found[k])}</div></span>
                ${String(f[k] || '') === String(found.found[k]) ? html`<span class="tiny ink62">in use</span>` : html`<${UI.Btn} sm=${true} kind="sec" onClick=${() => use(k)}>Use<//>`}
              </div>`)}
              ${found.found && MINE_FIELDS.some(([k]) => found.found[k]) ? html`<div><${UI.Btn} sm=${true} id="billing-use-all" onClick=${useAll}>Use everything found<//></div>` : html`<div class="small ink62">Nothing about billing turned up.</div>`}
              ${found.note ? html`<div class="tiny ink62">${found.note}</div>` : null}
              ${found.sources && found.sources.length ? html`<div class="tiny ink62" style=${{marginTop: '6px'}}>Read: ${found.sources.slice(0, 6).map(x => x.subject + (x.file ? ' (' + x.file + ')' : '')).join(' · ')}</div>` : null}
            </div>` : null}
          </div>` : html`<div class="small ink62">On the team site, m360 reads your Gmail and fills this in for you.</div>`}
        <//>
      </div>
    </div>`;
  }

  M.books = {CUR, CUR_OPTS, num, fmt, money, words, fyOf, fyRange, settings, clientBook, totals, status, STATUS_PILL, STATUS_TEXT, invoices, expenses, nextNumber, codeOf, ageOf, nextDates, print, shrinkImage, deep, blankBilling, draftBilling, cleanBilling};
  M.parts.DocFrame = DocFrame;
  M.parts.DocHead = DocHead;
  M.parts.DocSign = DocSign;
  M.parts.DocFoot = DocFoot;
  M.parts.BillingPage = BillingPage;
  M.pages.Books = Books;
})();
