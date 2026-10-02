/* module: payroll. The owner's payroll desk under Books: pay for the month (each active person with
   pay set, working days, absences from the check-ins, an editable loss of pay count, gross, deductions,
   net, paid or not, one button to mark a person paid and one to pay everyone), each person's pay
   (earnings, deductions the policy in Setup allows, bank, PAN, UAN), payslips on the letterhead and
   the bank CSV. The switches (PF, ESI, professional tax, gratuity, insurance, cost to company) come
   from M.books.settings(ctx).payroll and a switch that is off hides its line everywhere. Everything is
   INR. Data lives in payroll/salaries (map[uid]) and payroll/<yyyy-mm> ({at, by, closed, rows}), ids
   only. When the last person is paid the month lands in expenses as one Salaries row. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  /* a number in metal (metal-fx MetalText); a quiet copy of the text holds its place while the metal readies */
  const MetalNum = ({children, size, weight, color}) => html`<span class="fx-num"><span class="fx-num-copy" aria-hidden="true">${children}</span><${M.fx.MetalText} size=${size} weight=${weight} color=${color}>${children}<//></span>`;
  const {useState} = React;

  const EARN = [['basic', 'Basic'], ['hra', 'House rent allowance'], ['special', 'Special allowance'], ['allowances', 'Other allowances']];
  const DEDUCT = [['pf', 'Provident fund'], ['esi', 'ESI'], ['pt', 'Professional tax'], ['tds', 'Tax deducted at source'], ['other', 'Other deductions']];
  const PF_CAP = 1800, PF_RATE = 0.12;
  const ESI_LIMIT = 21000, ESI_EMPLOYEE = 0.0075, ESI_EMPLOYER = 0.0325;
  const PT_LIMIT = 10000, PT = 200, PT_FEB = 300;
  const GRATUITY = 0.0481;
  const NOTE_MAX = 200;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const POLICY0 = Object.freeze({pf: false, esi: false, pt: true, gratuity: false, insurance: false, insurancePremium: 0, payday: 1, employerCost: false});

  /* ---------- pure helpers ---------- */
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const okMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
  const monthName = month => { const [y, m] = String(month).split('-').map(Number); return U.cap(U.MONTHS[(m || 1) - 1] || '') + ' ' + y; };
  const monthShort = month => { const [y, m] = String(month).split('-').map(Number); return (MON[(m || 1) - 1] || '') + ' ' + y; };
  const isFeb = month => String(month || '').slice(5, 7) === '02';
  const daysIn = month => { const [y, m] = String(month).split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const dateIn = (month, d) => month + '-' + U.pad(d);
  const isWorking = (ctx, ymd) => {
    if (U.parseYmd(ymd).getDay() === 0) return false;
    return !(ctx && ctx.holidays && typeof ctx.holidays.has === 'function' && ctx.holidays.has(ymd));
  };
  const policyOf = ctx => {
    let p = null;
    try { p = M.books && typeof M.books.settings === 'function' ? M.books.settings(ctx).payroll : null; } catch (e) { p = null; }
    return {...POLICY0, ...(p || {})};
  };
  const salaryMap = ctx => (((ctx.coll.payroll && ctx.coll.payroll.map.salaries) || {}).map) || {};
  const runOf = (ctx, month) => ((ctx.coll.payroll && ctx.coll.payroll.map[month]) || {}).run || null;
  const hasPay = s => !!s && (num(s.basic) > 0 || num(s.hra) > 0 || num(s.special) > 0 || num(s.allowances) > 0 || num(s.ctc) > 0);
  /* the deduction lines the policy allows: TDS and other always, the statutory ones by their switch */
  const allowed = (k, policy) => (k === 'tds' || k === 'other') ? true : !!(policy || POLICY0)[k];
  const lines = policy => DEDUCT.filter(([k]) => allowed(k, policy));
  const pfOf = (basic, policy) => (policy && policy.pf) ? Math.min(PF_CAP, Math.round(num(basic) * PF_RATE)) : 0;
  const esiOf = (gross, policy) => (policy && policy.esi && num(gross) <= ESI_LIMIT) ? Math.round(num(gross) * ESI_EMPLOYEE) : 0;
  const ptOf = (gross, policy, month) => (policy && policy.pt && num(gross) > PT_LIMIT) ? (isFeb(month) ? PT_FEB : PT) : 0;

  /* Monday to Saturday, minus the holidays */
  function workingDays(ctx, month) {
    if (!okMonth(month)) return 0;
    let n = 0;
    for (let d = 1; d <= daysIn(month); d++) if (isWorking(ctx, dateIn(month, d))) n++;
    return n;
  }
  /* the month so far: working days with no check-in and no approved leave, and the check-ins; a date after today never counts */
  function attendance(ctx, uid, month, today) {
    const out = {absent: 0, present: 0};
    if (!okMonth(month)) return out;
    const t = today || U.todayStr();
    const att = M.att;
    if (!att || typeof att.dayStatus !== 'function') return out;
    for (let d = 1; d <= daysIn(month); d++) {
      const ymd = dateIn(month, d);
      if (ymd > t || !isWorking(ctx, ymd)) continue;
      let s = null;
      try { const r = att.dayStatus(ctx, uid, ymd); s = r ? r.status : null; } catch (e) { s = null; }
      if (s === 'none') out.absent++;
      else if (s === 'office' || s === 'wfh') out.present++;
    }
    return out;
  }
  const absentDays = (ctx, uid, month, today) => attendance(ctx, uid, month, today).absent;
  /* the row numbers: each earning prorated by paid days over days, deductions as set on the pay and
     allowed by the policy; a statutory PF or ESI left at its auto value follows the prorated basic or
     gross, a typed one stays as typed; the professional tax of 200 becomes 300 in February */
  function compute(salary, days, lop, policy, month) {
    const s = salary || {};
    const p = policy || POLICY0;
    const dd = Math.max(0, Math.round(num(days)));
    const l = Math.min(dd, Math.max(0, Math.round(num(lop))));
    const paidDays = dd - l;
    const ratio = dd > 0 ? paidDays / dd : 0;
    const row = {days: dd, paidDays, lop: l};
    let gross = 0;
    for (const [k] of EARN) { row[k] = Math.round(num(s[k]) * ratio); gross += row[k]; }
    let ded = 0;
    for (const [k] of DEDUCT) {
      row[k] = allowed(k, p) ? Math.round(num(s[k])) : 0;
      if (k === 'pf' && p.pf && row.pf === pfOf(s.basic, p)) row.pf = pfOf(row.basic, p);
      if (k === 'esi' && p.esi && row.esi === esiOf(EARN.reduce((t, [e]) => t + num(s[e]), 0), p)) row.esi = esiOf(gross, p);
      if (k === 'pt' && row.pt === PT && isFeb(month)) row.pt = PT_FEB;
      ded += row[k];
    }
    row.gross = gross;
    row.net = gross - ded;
    return row;
  }
  function monthly(salary, policy) {
    const s = salary || {};
    const gross = EARN.reduce((t, [k]) => t + num(s[k]), 0);
    const deductions = lines(policy).reduce((t, [k]) => t + num(s[k]), 0);
    return {gross: Math.round(gross), deductions: Math.round(deductions), net: Math.round(gross - deductions)};
  }
  const deductionsOf = row => DEDUCT.reduce((t, [k]) => t + num((row || {})[k]), 0);
  const netOf = row => num((row || {}).gross) - deductionsOf(row);
  /* what the agency pays on top of the gross: PF employer the same as the employee's, ESI employer
     3.25 percent of a gross within the limit, gratuity 4.81 percent of basic, the insurance premium */
  function employerCost(row, policy) {
    const r = row || {};
    const p = policy || POLICY0;
    const out = {pf: 0, esi: 0, gratuity: 0, insurance: 0, extra: 0, total: 0};
    if (!p.employerCost) { out.total = num(r.gross); return out; }
    out.pf = p.pf ? num(r.pf) : 0;
    out.esi = p.esi && num(r.gross) <= ESI_LIMIT ? Math.round(num(r.gross) * ESI_EMPLOYER) : 0;
    out.gratuity = p.gratuity ? Math.round(num(r.basic) * GRATUITY) : 0;
    out.insurance = p.insurance ? Math.round(num(p.insurancePremium)) : 0;
    out.extra = out.pf + out.esi + out.gratuity + out.insurance;
    out.total = num(r.gross) + out.extra;
    return out;
  }
  /* a split of the CTC: basic half, HRA a fifth, the rest special; the deductions the policy asks for */
  function suggest(ctc, policy, month) {
    const p = policy || POLICY0;
    const m = num(ctc) / 12;
    const basic = Math.round(m * 0.5), hra = Math.round(m * 0.2);
    const special = Math.max(0, Math.round(m) - basic - hra);
    const gross = basic + hra + special;
    return {basic, hra, special, allowances: 0, pf: pfOf(basic, p), esi: esiOf(gross, p), pt: ptOf(gross, p, month || U.monthId(new Date())), tds: 0, other: 0};
  }
  const mask = acct => { const a = String(acct || '').replace(/\s+/g, ''); return a ? 'xxxx ' + a.slice(-4) : ''; };
  const inr = n => M.books.money(n, 'INR');
  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lastMonths = (now, n) => {
    const out = [];
    for (let k = n - 1; k >= 0; k--) { const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - k); out.push(U.monthId(d)); }
    return out;
  };
  const dayOf = ms => U.ymd(new Date(ms));

  /* ---------- the pay drawer ---------- */
  const blank = () => ({ctc: '', basic: '', hra: '', special: '', allowances: '', pf: '', esi: '', pt: '', tds: '', other: '',
    bank: {holder: '', account: '', ifsc: ''}, pan: '', uan: '', effective: '', note: ''});
  const AUTO = {pf: (f, p) => pfOf(f.basic, p), esi: (f, p) => esiOf(monthly(f, p).gross, p), pt: (f, p) => ptOf(monthly(f, p).gross, p, U.monthId(new Date()))};
  function PayDrawer({uid, policy, onClose}) {
    const ctx = M.useCtx();
    const [f, setF] = useState(() => {
      const cur = salaryMap(ctx)[uid] || {};
      const b = blank();
      for (const k of Object.keys(b)) if (k !== 'bank' && cur[k] != null) b[k] = String(cur[k]);
      b.bank = {...b.bank, ...(cur.bank || {})};
      return b;
    });
    /* a statutory line follows the earnings until the owner types into it */
    const [auto, setAuto] = useState(() => {
      const cur = salaryMap(ctx)[uid] || {};
      const a = {};
      for (const k of Object.keys(AUTO)) a[k] = cur[k] == null || num(cur[k]) === AUTO[k](cur, policy);
      return a;
    });
    const [busy, setBusy] = useState(false);
    const withAuto = x => { const n = {...x}; for (const k of Object.keys(AUTO)) if (auto[k] && policy[k]) n[k] = String(AUTO[k](n, policy)); return n; };
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setEarn = (k, v) => setF(x => withAuto({...x, [k]: v}));
    const setDed = (k, v) => { if (AUTO[k]) setAuto(a => ({...a, [k]: false})); set(k, v); };
    const setB = (k, v) => setF(x => ({...x, bank: {...x.bank, [k]: v}}));
    const m = monthly(f, policy);
    const applySplit = () => {
      const s = suggest(f.ctc, policy);
      setF(x => { const n = {...x}; for (const k of Object.keys(s)) n[k] = String(s[k]); return n; });
      setAuto({pf: true, esi: true, pt: true});
    };
    const save = async () => {
      setBusy(true);
      const clean = {ctc: num(f.ctc), basic: num(f.basic), hra: num(f.hra), special: num(f.special), allowances: num(f.allowances),
        pf: num(f.pf), esi: num(f.esi), pt: num(f.pt), tds: num(f.tds), other: num(f.other),
        bank: {holder: String(f.bank.holder || '').trim().slice(0, 80), account: String(f.bank.account || '').trim().slice(0, 34), ifsc: String(f.bank.ifsc || '').trim().toUpperCase().slice(0, 11)},
        pan: String(f.pan || '').trim().toUpperCase().slice(0, 10), uan: String(f.uan || '').trim().slice(0, 12),
        effective: /^\d{4}-\d{2}-\d{2}$/.test(f.effective) ? f.effective : '', note: String(f.note || '').trim().slice(0, NOTE_MAX)};
      try { await ctx.W.merge('payroll/salaries', {map: {[uid]: clean}, updated: Date.now()}); M.toast('Pay saved'); onClose(); }
      catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const HINT = {pf: '12 percent of basic, capped at ' + M.books.fmt(PF_CAP, 'INR'), esi: '0.75 percent of gross up to ' + M.books.fmt(ESI_LIMIT, 'INR'),
      pt: M.books.fmt(PT, 'INR') + ' a month, ' + M.books.fmt(PT_FEB, 'INR') + ' in February, above ' + M.books.fmt(PT_LIMIT, 'INR')};
    const earnIn = (k, label) => html`<${UI.Input} id=${'pay-' + k} label=${label} type="number" min="0" step="1" value=${f[k]} onChange=${v => setEarn(k, v)}/>`;
    const dedIn = (k, label) => html`<${UI.Input} id=${'pay-' + k} label=${label} type="number" min="0" step="1" value=${f[k]} onChange=${v => setDed(k, v)} hint=${HINT[k] || null}/>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Edit pay"
      footer=${html`<${UI.Btn} id="pay-save" disabled=${busy} onClick=${save}>Save pay<//>`}>
      <div class="stack" id="pay-drawer">
        <div class="row nowrap" style=${{gap: '10px'}}><${UI.Avatar} id=${uid} size=${30}/><b><${UI.Name} id=${uid}/></b></div>
        <${UI.Input} id="pay-ctc" label="cost to company, per year" type="number" min="0" step="1" value=${f.ctc} onChange=${v => set('ctc', v)}
          hint=${num(f.ctc) > 0 ? inr(num(f.ctc) / 12) + ' a month' : 'The monthly parts below are what the pay uses'}/>
        ${num(f.ctc) > 0 ? html`<div class="row"><${UI.Btn} kind="sec" sm=${true} id="pay-suggest" onClick=${applySplit}>Suggest a split from the CTC<//></div>` : null}
        <${UI.Field} label="monthly earnings">
          <div class="grid2">${EARN.map(([k, l]) => html`<div key=${k}>${earnIn(k, l.toLowerCase())}</div>`)}</div>
        <//>
        <${UI.Field} label="monthly deductions" hint=${lines(policy).length < DEDUCT.length ? 'Lines switched off in Setup stay hidden and count as 0.' : null}>
          <div class="grid2">${lines(policy).map(([k, l]) => html`<div key=${k}>${dedIn(k, k === 'esi' ? 'ESI' : l.toLowerCase())}</div>`)}</div>
        <//>
        <div class="listrow" style=${{borderBottom: 0}}>
          <span class="grow small">gross <span class="num">${inr(m.gross)}</span> · deductions <span class="num">${inr(m.deductions)}</span></span>
          <b class="row nowrap" style=${{gap: '6px'}}>net <span class="num" id="pay-net">${M.fx ? html`<${MetalNum} size=${20} weight=${600}>${inr(m.net)}<//>` : inr(m.net)}</span></b>
        </div>
        <${UI.Field} label="bank">
          <div class="stack tight">
            <${UI.Input} id="pay-holder" label="account holder" value=${f.bank.holder} onChange=${v => setB('holder', v)}/>
            <div class="grid2">
              <${UI.Input} id="pay-account" label="account number" value=${f.bank.account} onChange=${v => setB('account', v)}/>
              <${UI.Input} id="pay-ifsc" label="IFSC" value=${f.bank.ifsc} onChange=${v => setB('ifsc', v.toUpperCase())}/>
            </div>
          </div>
        <//>
        <div class="grid2">
          <${UI.Input} id="pay-pan" label="PAN" value=${f.pan} onChange=${v => set('pan', v.toUpperCase())}/>
          ${policy.pf ? html`<${UI.Input} id="pay-uan" label="UAN" value=${f.uan} onChange=${v => set('uan', v)}/>` : null}
        </div>
        <${UI.Input} id="pay-effective" label="effective from" type="date" value=${f.effective} onChange=${v => set('effective', v)}/>
        <${UI.TextArea} id="pay-note" label="note" rows=${2} value=${f.note} onChange=${v => set('note', v.slice(0, NOTE_MAX))}/>
      </div>
    <//>`;
  }

  /* ---------- pay for the month ---------- */
  const COLS_A = ['month', 'employee_id', 'employee', 'title', 'days', 'paid_days', 'lop', 'basic', 'hra', 'special', 'allowances', 'gross'];
  const COLS_B = ['net', 'account_holder', 'account', 'ifsc', 'pan'];
  function BankFile({month, rows, policy}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const go = async () => {
      setBusy(true);
      try {
        const uids = rows.map(r => r.uid);
        const profs = (ctx.user && ctx.user.profiles) ? await ctx.user.profiles(uids) : {};
        const sal = salaryMap(ctx);
        const ded = lines(policy).map(([k]) => k);
        const cols = COLS_A.concat(ded, COLS_B, policy.pf ? ['uan'] : [], ['paid_on', 'note']);
        const out = [cols.map(csvCell).join(',')];
        for (const x of rows) {
          const r = x.row, s = sal[x.uid] || {}, mem = (ctx.members || {})[x.uid] || {};
          const cells = [month, mem.empId || '', (profs[x.uid] && profs[x.uid].name) || '', mem.title || '', r.days, r.paidDays, r.lop,
            r.basic, r.hra, r.special, r.allowances, r.gross].concat(ded.map(k => num(r[k])),
            [netOf(r), (s.bank || {}).holder || '', (s.bank || {}).account || '', (s.bank || {}).ifsc || '', s.pan || ''],
            policy.pf ? [s.uan || ''] : [], [r.paidAt ? dayOf(r.paidAt) : '', r.note || '']);
          out.push(cells.map(csvCell).join(','));
        }
        const res = await ctx.downloads.save({filename: 'payroll-' + month + '.csv', data: out.join('\n')});
        M.toast(res && res.status === 'delivered' ? 'Sent' : 'Downloaded');
      } catch (e) {
        M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
      }
      setBusy(false);
    };
    return html`<${UI.Btn} kind="sec" sm=${true} id="pay-csv" disabled=${busy} onClick=${go}><${icons.download || icons.upload}/>Download the bank file<//>`;
  }

  function MonthCard({month, setMonth, policy, onEdit}) {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const run = runOf(ctx, month);
    const saved = (run && run.rows) || {};
    const map = salaryMap(ctx);
    const days = workingDays(ctx, month);
    const [lops, setLops] = useState({});      /* {month:uid: the typed loss of pay days} until paid */
    const [busy, setBusy] = useState(false);
    const people = ctx.activeMembers || [];
    const withPay = people.filter(p => hasPay(map[p.uid]));
    const noPay = people.filter(p => !hasPay(map[p.uid]));
    const rows = withPay.map(p => {
      const paid = saved[p.uid] && saved[p.uid].paidAt ? saved[p.uid] : null;
      const att = attendance(ctx, p.uid, month, today);
      const key = month + ':' + p.uid;
      const lopIn = lops[key] != null ? lops[key] : String(att.absent);
      const row = paid || compute(map[p.uid], days, num(lopIn), policy, month);
      return {uid: p.uid, paid, att, lopIn, row, cost: employerCost(row, policy)};
    });
    /* paid rows of people since gone from the roster still count for the month */
    for (const uid of Object.keys(saved)) {
      if (saved[uid] && saved[uid].paidAt && !withPay.some(p => p.uid === uid)) rows.push({uid, paid: saved[uid], att: {absent: 0, present: 0}, lopIn: '', row: saved[uid], cost: employerCost(saved[uid], policy)});
    }
    const unpaid = rows.filter(r => !r.paid);
    const paidRows = rows.filter(r => r.paid);
    const t = {gross: 0, deductions: 0, net: 0, pf: 0, esi: 0, gratuity: 0, insurance: 0, cost: 0};
    for (const r of rows) {
      t.gross += num(r.row.gross); t.deductions += deductionsOf(r.row); t.net += netOf(r.row);
      t.pf += r.cost.pf; t.esi += r.cost.esi; t.gratuity += r.cost.gratuity; t.insurance += r.cost.insurance; t.cost += r.cost.total;
    }
    const unpaidNet = unpaid.reduce((s, r) => s + netOf(r.row), 0);
    const logExpense = async (total) => {
      const now = Date.now();
      const ex = (((ctx.coll.expenses && ctx.coll.expenses.map[month]) || {}).rows) || {};
      const prev = ex['payroll-' + month];
      await ctx.W.merge('expenses/' + month, {rows: {['payroll-' + month]: {date: today, vendor: 'Salaries', category: 'Salaries', desc: 'Payroll for ' + monthName(month),
        amount: total, gstInput: 0, method: 'bank', paid: true, recurring: '', receipt: null, source: 'payroll', at: (prev && prev.at) || now, updatedAt: now}}, updated: now});
    };
    const pay = async (uids) => {
      if (!uids.length || busy) return;
      setBusy(true);
      const now = Date.now();
      const patch = {};
      for (const r of rows) if (uids.includes(r.uid)) patch[r.uid] = {...U.clone(r.row), note: String(r.row.note || '').slice(0, NOTE_MAX), paidAt: now};
      const all = rows.every(r => r.paid || uids.includes(r.uid));
      try {
        await ctx.W.merge('payroll/' + month, {run: {at: (run && run.at) || now, by: (run && run.by) || ctx.uid, closed: all, rows: patch}, updated: now});
        if (all) {
          const total = rows.reduce((s, r) => s + netOf(patch[r.uid] || r.row), 0);
          await logExpense(total);
          M.toast('Everyone paid. Salaries are in expenses');
        } else M.toast('Marked paid');
        setLops(x => { const n = {...x}; for (const u of uids) delete n[month + ':' + u]; return n; });
      } catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const undo = async (uid) => {
      if (busy) return;
      setBusy(true);
      try { await ctx.W.merge('payroll/' + month, {run: {closed: false, rows: {[uid]: null}}, updated: Date.now()}); M.toast('Undone'); }
      catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const opts = lastMonths(ctx.now, 6).map(mid => ({v: mid, label: monthShort(mid)}));
    return html`<${UI.Card} title=${'Pay for ' + monthName(month)} id="pay-month-card"
      action=${run && run.closed ? (M.fx ? html`<${M.fx.MetalBadge}>everyone paid<//>` : html`<${UI.Pill} kind="ink">everyone paid<//>`) : paidRows.length ? html`<${UI.Pill}>${paidRows.length} of ${rows.length} paid<//>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>Salaries from each person's pay, attendance from check-ins. Change the loss of pay days if a day was worked, then mark paid.</p>
      <div id="pay-month"><${UI.Seg} sm=${true} options=${opts} value=${month} onChange=${setMonth} ariaLabel="Month"/></div>
      <div class="tiny ink62" style=${{marginTop: '8px'}}><span class="num">${days}</span> working days, Monday to Saturday, minus holidays. Absences are the days so far with no check-in and no approved leave.</div>
      ${rows.length ? html`<div class="tbl-wrap" style=${{marginTop: '12px'}}><table class="tbl" id="pay-rows">
        <thead><tr><th>person</th><th class="num">days</th><th class="num">loss of pay</th><th class="num">gross</th><th class="num">deductions</th><th class="num">net</th><th>state</th><th></th></tr></thead>
        <tbody>${rows.map(r => {
          const sameDay = r.paid && dayOf(r.paid.paidAt) === today;
          return html`<tr key=${r.uid}>
            <td data-label="person" class="lead"><span class="row nowrap" style=${{gap: '8px'}}><${UI.Avatar} id=${r.uid} size=${22}/>
              <span><${UI.Name} id=${r.uid}/>${r.att.absent ? html` <span class="tiny ink62 num" title=${r.att.present + ' check-ins this month'}>${r.att.absent} absent</span>` : null}</span></span></td>
            <td data-label="days" class="num">${r.row.days}</td>
            <td data-label="loss of pay" class="num">${r.paid ? r.row.lop : html`<input class="input" id=${'pay-lop-' + r.uid} type="number" min="0" max=${r.row.days} step="1" style=${{width: '72px', minHeight: '34px'}} aria-label="Loss of pay days"
              value=${r.lopIn} onInput=${e => { const v = e.target.value; setLops(x => ({...x, [month + ':' + r.uid]: v})); }}/>`}</td>
            <td data-label="gross" class="num">${inr(r.row.gross)}</td>
            <td data-label="deductions" class="num">${inr(deductionsOf(r.row))}</td>
            <td data-label="net" class="num"><b>${inr(netOf(r.row))}</b></td>
            <td data-label="state">${r.paid ? (M.fx ? html`<span class="row nowrap fx-paid" style=${{gap: '6px'}}><${M.fx.MetalBadge}>paid<//><span class="num">${U.fmtDate(dayOf(r.paid.paidAt))}</span></span>` : html`<span class="num">paid ${U.fmtDate(dayOf(r.paid.paidAt))}</span>`) : html`<span class="ink62">not paid</span>`}</td>
            <td>${r.paid ? (sameDay ? html`<button type="button" class="linky small" id=${'pay-undo-' + r.uid} disabled=${busy} onClick=${() => undo(r.uid)}>Undo</button>` : null)
              : html`<${UI.Btn} sm=${true} id=${'pay-paid-' + r.uid} disabled=${busy} onClick=${() => pay([r.uid])}>Mark paid<//>`}</td>
          </tr>`;
        })}</tbody>
      </table></div>
      <div class="small ink62" id="pay-totals" style=${{marginTop: '10px'}}>gross <span class="num">${inr(t.gross)}</span> · deductions <span class="num">${inr(t.deductions)}</span> · net ${M.fx ? html`<${MetalNum} size=${20} weight=${600}>${inr(t.net)}<//>` : html`<b class="num">${inr(t.net)}</b>`} · <span class="num">${rows.length}</span> people${paidRows.length ? html` · paid <span class="num">${inr(paidRows.reduce((s, r) => s + netOf(r.row), 0))}</span>` : null}</div>
      ${policy.employerCost ? html`<div class="small ink62" id="pay-cost" style=${{marginTop: '4px'}}>cost to company this month <b class="num">${inr(t.cost)}</b>${policy.pf ? html` · PF employer <span class="num">${inr(t.pf)}</span>` : null}${policy.esi ? html` · ESI employer <span class="num">${inr(t.esi)}</span>` : null}${policy.gratuity ? html` · gratuity <span class="num">${inr(t.gratuity)}</span>` : null}${policy.insurance ? html` · insurance <span class="num">${inr(t.insurance)}</span>` : null}</div>` : null}
      <div class="row" style=${{marginTop: '12px'}}>
        ${unpaid.length ? html`<span id="pay-all"><${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${() => pay(unpaid.map(r => r.uid))}>Pay everyone, ${inr(unpaidNet)}<//></span>` : null}
        ${ctx.downloads && paidRows.length ? html`<${BankFile} month=${month} rows=${paidRows} policy=${policy}/>` : null}
      </div>`
      : html`<div style=${{marginTop: '12px'}}><${UI.Empty} text=${people.length ? 'Nobody has pay set yet. Add it below and this month fills in.' : 'Nobody on the roster yet.'}/></div>`}
      ${noPay.length && rows.length ? html`<div class="stack tight" id="pay-nopay" style=${{marginTop: '12px'}}>${noPay.map(p => html`<div class="listrow" key=${p.uid}>
        <${UI.Avatar} id=${p.uid} size=${22}/>
        <span class="grow small"><${UI.Name} id=${p.uid}/><span class="ink62">, no pay set yet, </span><button type="button" class="linky" id=${'pay-add-' + p.uid} onClick=${() => onEdit(p.uid)}>add it below</button></span>
      </div>`)}</div>` : null}
    <//>`;
  }

  /* ---------- pay ---------- */
  function PayCard({policy, onEdit}) {
    const ctx = M.useCtx();
    const map = salaryMap(ctx);
    const people = ctx.activeMembers || [];
    return html`<${UI.Card} title="Pay" id="pay-salaries">
      <p class="small ink62" style=${{marginTop: 0}}>Monthly earnings and deductions for each person on the roster. The month above reads these.${lines(policy).length < DEDUCT.length ? ' Benefits and deductions are switched on in Setup.' : ''}</p>
      ${people.length ? html`<div class="stack tight">${people.map(p => {
        const s = map[p.uid];
        const m = monthly(s, policy);
        return html`<div class="listrow" key=${p.uid}>
          <${UI.Avatar} id=${p.uid} size=${30}/>
          <span class="grow"><b><${UI.Name} id=${p.uid}/></b>
            <span class="tiny ink62 num"> · ${p.empId || ''}${p.title ? ' · ' + p.title : ''}</span>
            ${hasPay(s) ? html`<div class="small ink62">gross <span class="num">${inr(m.gross)}</span> · deductions <span class="num">${inr(m.deductions)}</span> · net <span class="num">${inr(m.net)}</span></div>`
              : html`<div class="small ink62">no pay set</div>`}
          </span>
          <${UI.Btn} kind="sec" sm=${true} id=${'pay-edit-' + p.uid} onClick=${() => onEdit(p.uid)}><${icons.edit}/>Edit pay<//>
        </div>`;
      })}</div>` : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
    <//>`;
  }

  /* ---------- payslips ---------- */
  function Payslip({uid, month, row, policy}) {
    const ctx = M.useCtx();
    const pol = policy || policyOf(ctx);
    const s = salaryMap(ctx)[uid] || {};
    const mem = (ctx.members || {})[uid] || {};
    /* the name as plain text: the kv grid styles every odd span as a label */
    const profs = M.useProfiles([uid]);
    const who = (profs[uid] && profs[uid].name) || 'Someone';
    const r = row || {};
    const net = netOf(r);
    const earn = EARN.filter(([k]) => k === 'basic' || num(r[k]) > 0);
    const ded = lines(pol).filter(([k]) => (k !== 'tds' && k !== 'other') || num(r[k]) > 0);
    const n = Math.max(earn.length, ded.length, 1);
    const pairs = [];
    for (let i = 0; i < n; i++) pairs.push({e: earn[i] || null, d: ded[i] || null});
    const cost = employerCost(r, pol);
    return html`<${M.parts.DocFrame} id="payslip-doc" title="payslip">
      <${M.parts.DocHead} ctx=${ctx} right=${html`<div><span class="doc-pill">Payslip</span></div><div class="doc-title">${monthName(month)}</div>`}/>
      <div class="doc-grid">
        <div class="doc-kv">
          <span>employee</span><span><b>${who}</b></span>
          <span>employee id</span><span class="num">${mem.empId || ''}</span>
          <span>title</span><span>${mem.title || ''}</span>
          <span>PAN</span><span class="num">${s.pan || ''}</span>
          ${pol.pf ? html`<span>UAN</span><span class="num">${s.uan || ''}</span>` : null}
          <span>bank account</span><span class="num">${mask((s.bank || {}).account)}</span>
          <span>IFSC</span><span class="num">${(s.bank || {}).ifsc || ''}</span>
        </div>
        <div class="doc-kv">
          <span>month</span><span>${monthName(month)}</span>
          <span>days</span><span class="num">${r.days}</span>
          <span>paid days</span><span class="num">${r.paidDays}</span>
          <span>loss of pay</span><span class="num">${r.lop}</span>
          <span>paid on</span><span class="num">${r.paidAt ? U.fmtDate(dayOf(r.paidAt)) : 'pending'}</span>
        </div>
      </div>
      <table class="doc-table">
        <thead><tr><th>earnings</th><th class="n">amount</th><th>deductions</th><th class="n">amount</th></tr></thead>
        <tbody>${pairs.map((p, i) => html`<tr key=${i}>
          <td>${p.e ? html`<span class="doc-line">${p.e[1]}</span>` : null}</td><td class="n">${p.e ? html`<span class="num">${inr(r[p.e[0]])}</span>` : null}</td>
          <td>${p.d ? html`<span class="doc-line">${p.d[1]}</span>` : null}</td><td class="n">${p.d ? html`<span class="num">${inr(r[p.d[0]])}</span>` : null}</td>
        </tr>`)}</tbody>
      </table>
      <div class="doc-lower">
        <div>
          <div class="doc-totals">
            <div class="doc-total-row"><span>Gross earnings</span><span class="num">${inr(r.gross)}</span></div>
            <div class="doc-total-row"><span>Deductions</span><span class="num">${inr(deductionsOf(r))}</span></div>
            <div class="doc-total-row grand"><span>Net pay</span><span class="num">${inr(net)}</span></div>
          </div>
          <div class="doc-block" style=${{marginTop: '14px'}}>
            <div class="doc-micro">Net pay in words</div>
            <div class="small"><b>${M.books.words(net, 'INR')}</b></div>
          </div>
          ${pol.employerCost ? html`<div class="doc-block"><div class="doc-micro">Cost to company</div>
            <div class="small"><span class="num">${inr(cost.total)}</span> this month${cost.pf ? html`, PF employer <span class="num">${inr(cost.pf)}</span>` : null}${cost.esi ? html`, ESI employer <span class="num">${inr(cost.esi)}</span>` : null}${cost.gratuity ? html`, gratuity <span class="num">${inr(cost.gratuity)}</span>` : null}${cost.insurance ? html`, insurance <span class="num">${inr(cost.insurance)}</span>` : null}</div></div>` : null}
          ${r.note ? html`<div class="doc-block"><div class="doc-micro">Note</div><div class="small">${r.note}</div></div>` : null}
        </div>
        <${M.parts.DocSign} ctx=${ctx}/>
      </div>
      <${M.parts.DocFoot} ctx=${ctx}/>
    <//>`;
  }
  function Payslips({month, policy, id}) {
    const ctx = M.useCtx();
    const run = runOf(ctx, month);
    const rows = (run && run.rows) || {};
    const isPaid = u => !!(rows[u] && rows[u].paidAt);
    const [pick, setPick] = useState(() => (id && isPaid(id) ? id : null));
    const list = (ctx.activeMembers || []).map(p => p.uid).filter(isPaid)
      .concat(Object.keys(rows).filter(u => isPaid(u) && !(ctx.activeMembers || []).some(p => p.uid === u)));
    const uid = pick && isPaid(pick) ? pick : null;
    return html`<${UI.Card} title="Payslips" id="pay-slips" action=${html`<${UI.Pill}>${monthName(month)}<//>`}>
      ${list.length ? html`<div class="stack tight">${list.map(u => html`<div class="listrow" key=${u}>
        <${UI.Avatar} id=${u} size=${28}/>
        <span class="grow"><b><${UI.Name} id=${u}/></b><span class="small ink62"> · net <span class="num">${inr(netOf(rows[u]))}</span>${rows[u].lop ? html` · <span class="num">${rows[u].lop}</span> days loss of pay` : ''}</span></span>
        <${UI.Btn} kind=${uid === u ? undefined : 'sec'} sm=${true} id=${'pay-slip-' + u} onClick=${() => setPick(u)}>Payslip<//>
      </div>`)}</div>` : html`<${UI.Empty} text="A payslip appears here for each person once they are marked paid."/>`}
      ${uid ? html`<div style=${{marginTop: '16px'}}><${Payslip} uid=${uid} month=${month} row=${rows[uid]} policy=${policy}/></div>` : null}
    <//>`;
  }

  /* ---------- the page ---------- */
  function Payroll({id}) {
    const ctx = M.useCtx();
    const [month, setMonth] = useState(() => okMonth(id) ? id : U.monthId(new Date(ctx.now)));
    const [edit, setEdit] = useState(null);
    if (!ctx.isOwner) return html`<${UI.Empty} text="Payroll is the owner's alone."/>`;
    const policy = policyOf(ctx);
    return html`<div class="stack" style=${{gap: '18px'}} id="pay-page">
      <${MonthCard} month=${month} setMonth=${setMonth} policy=${policy} onEdit=${setEdit}/>
      <${PayCard} policy=${policy} onEdit=${setEdit}/>
      <${Payslips} month=${month} policy=${policy} id=${okMonth(id) ? null : id}/>
      ${edit ? html`<${PayDrawer} uid=${edit} policy=${policy} onClose=${() => setEdit(null)}/>` : null}
    </div>`;
  }

  M.pages.Payroll = Payroll;
  M.parts.Payslip = Payslip;
  M.payroll = {workingDays, absentDays, attendance, compute, monthly, netOf, suggest, monthName, EARN, DEDUCT, employerCost, lines};
})();
