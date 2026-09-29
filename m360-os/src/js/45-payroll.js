/* module: payroll. The owner's payroll desk under Books: each person's monthly pay (earnings,
   deductions, bank, PAN, UAN), the monthly run prepared from the roster and attendance (working
   days, loss of pay from days with no check-in and no leave), payslips on the letterhead, and a
   CSV register. Everything is INR. Data lives in payroll/salaries and payroll/<yyyy-mm>, ids only. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState} = React;

  const EARN = [['basic', 'Basic'], ['hra', 'House rent allowance'], ['special', 'Special allowance'], ['allowances', 'Other allowances']];
  const DEDUCT = [['pf', 'Provident fund'], ['tds', 'Tax deducted at source'], ['esi', 'ESI'], ['other', 'Other deductions']];
  const PF_CAP = 1800;
  const NOTE_MAX = 200;

  /* ---------- pure helpers ---------- */
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const okMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
  const monthName = month => { const [y, m] = String(month).split('-').map(Number); return U.cap(U.MONTHS[(m || 1) - 1] || '') + ' ' + y; };
  const daysIn = month => { const [y, m] = String(month).split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const dateIn = (month, d) => month + '-' + U.pad(d);
  const isWorking = (ctx, ymd) => {
    if (U.parseYmd(ymd).getDay() === 0) return false;
    return !(ctx && ctx.holidays && typeof ctx.holidays.has === 'function' && ctx.holidays.has(ymd));
  };
  const salaryMap = ctx => (((ctx.coll.payroll && ctx.coll.payroll.map.salaries) || {}).map) || {};
  const runOf = (ctx, month) => ((ctx.coll.payroll && ctx.coll.payroll.map[month]) || {}).run || null;
  const hasPay = s => !!s && (num(s.basic) > 0 || num(s.hra) > 0 || num(s.special) > 0 || num(s.allowances) > 0 || num(s.ctc) > 0);

  /* Monday to Saturday, minus the holidays */
  function workingDays(ctx, month) {
    if (!okMonth(month)) return 0;
    let n = 0;
    for (let d = 1; d <= daysIn(month); d++) if (isWorking(ctx, dateIn(month, d))) n++;
    return n;
  }
  /* working days up to today with no check-in and no approved leave; a date after today never counts */
  function absentDays(ctx, uid, month, today) {
    if (!okMonth(month)) return 0;
    const t = today || U.todayStr();
    const att = M.att;
    if (!att || typeof att.dayStatus !== 'function') return 0;
    let n = 0;
    for (let d = 1; d <= daysIn(month); d++) {
      const ymd = dateIn(month, d);
      if (ymd > t || !isWorking(ctx, ymd)) continue;
      let s = null;
      try { const r = att.dayStatus(ctx, uid, ymd); s = r ? r.status : null; } catch (e) { s = null; }
      if (s === 'none') n++;
    }
    return n;
  }
  /* the row numbers: each earning prorated by paid days over days, deductions as set */
  function compute(salary, days, lop) {
    const s = salary || {};
    const dd = Math.max(0, Math.round(num(days)));
    const l = Math.min(dd, Math.max(0, Math.round(num(lop))));
    const paidDays = dd - l;
    const ratio = dd > 0 ? paidDays / dd : 0;
    const row = {days: dd, paidDays, lop: l};
    let gross = 0;
    for (const [k] of EARN) { row[k] = Math.round(num(s[k]) * ratio); gross += row[k]; }
    let ded = 0;
    for (const [k] of DEDUCT) { row[k] = Math.round(num(s[k])); ded += row[k]; }
    row.gross = gross;
    row.net = gross - ded;
    return row;
  }
  function monthly(salary) {
    const s = salary || {};
    const gross = EARN.reduce((t, [k]) => t + num(s[k]), 0);
    const deductions = DEDUCT.reduce((t, [k]) => t + num(s[k]), 0);
    return {gross: Math.round(gross), deductions: Math.round(deductions), net: Math.round(gross - deductions)};
  }
  const deductionsOf = row => DEDUCT.reduce((t, [k]) => t + num((row || {})[k]), 0);
  const netOf = row => num((row || {}).gross) - deductionsOf(row);
  /* a split of the CTC: basic half, HRA a fifth, the rest special, PF at 12 percent of basic capped */
  function suggest(ctc) {
    const m = num(ctc) / 12;
    const basic = Math.round(m * 0.5), hra = Math.round(m * 0.2);
    const special = Math.max(0, Math.round(m) - basic - hra);
    return {basic, hra, special, allowances: 0, pf: Math.min(PF_CAP, Math.round(basic * 0.12)), tds: 0, esi: 0, other: 0};
  }
  const mask = acct => { const a = String(acct || '').replace(/\s+/g, ''); return a ? 'xxxx ' + a.slice(-4) : ''; };
  const inr = n => M.books.money(n, 'INR');
  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  /* ---------- the pay drawer ---------- */
  const blank = () => ({ctc: '', basic: '', hra: '', special: '', allowances: '', pf: '', tds: '', esi: '', other: '',
    bank: {holder: '', account: '', ifsc: ''}, pan: '', uan: '', effective: '', note: ''});
  function PayDrawer({uid, onClose}) {
    const ctx = M.useCtx();
    const [f, setF] = useState(() => {
      const cur = salaryMap(ctx)[uid] || {};
      const b = blank();
      for (const k of Object.keys(b)) if (k !== 'bank' && cur[k] != null) b[k] = String(cur[k]);
      b.bank = {...b.bank, ...(cur.bank || {})};
      return b;
    });
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setB = (k, v) => setF(x => ({...x, bank: {...x.bank, [k]: v}}));
    const m = monthly(f);
    const canSuggest = num(f.ctc) > 0 && !num(f.basic) && !num(f.hra) && !num(f.special);
    const applySplit = () => { const s = suggest(f.ctc); setF(x => { const n = {...x}; for (const k of Object.keys(s)) n[k] = String(s[k]); return n; }); };
    const save = async () => {
      setBusy(true);
      const clean = {ctc: num(f.ctc), basic: num(f.basic), hra: num(f.hra), special: num(f.special), allowances: num(f.allowances),
        pf: num(f.pf), tds: num(f.tds), esi: num(f.esi), other: num(f.other),
        bank: {holder: String(f.bank.holder || '').trim().slice(0, 80), account: String(f.bank.account || '').trim().slice(0, 34), ifsc: String(f.bank.ifsc || '').trim().toUpperCase().slice(0, 11)},
        pan: String(f.pan || '').trim().toUpperCase().slice(0, 10), uan: String(f.uan || '').trim().slice(0, 12),
        effective: /^\d{4}-\d{2}-\d{2}$/.test(f.effective) ? f.effective : '', note: String(f.note || '').trim().slice(0, NOTE_MAX)};
      try { await ctx.W.merge('payroll/salaries', {map: {[uid]: clean}, updated: Date.now()}); M.toast('Saved'); onClose(); }
      catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const numIn = (k, label) => html`<${UI.Input} id=${'pay-' + k} label=${label} type="number" min="0" step="1" value=${f[k]} onChange=${v => set(k, v)}/>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Edit pay"
      footer=${html`<${UI.Btn} id="pay-save" disabled=${busy} onClick=${save}>Save pay<//>`}>
      <div class="stack" id="pay-drawer">
        <div class="row nowrap" style=${{gap: '10px'}}><${UI.Avatar} id=${uid} size=${30}/><b><${UI.Name} id=${uid}/></b></div>
        <${UI.Input} id="pay-ctc" label="cost to company, per year" type="number" min="0" step="1" value=${f.ctc} onChange=${v => set('ctc', v)}
          hint=${num(f.ctc) > 0 ? inr(num(f.ctc) / 12) + ' a month' : 'Monthly parts below are what payroll uses'}/>
        ${canSuggest ? html`<div class="row"><${UI.Btn} kind="sec" sm=${true} id="pay-suggest" onClick=${applySplit}>Suggest a split from the CTC<//></div>` : null}
        <${UI.Field} label="monthly earnings">
          <div class="grid2">${EARN.map(([k, l]) => html`<div key=${k}>${numIn(k, l.toLowerCase())}</div>`)}</div>
        <//>
        <${UI.Field} label="monthly deductions">
          <div class="grid2">${DEDUCT.map(([k, l]) => html`<div key=${k}>${numIn(k, l.toLowerCase())}</div>`)}</div>
        <//>
        <div class="listrow" style=${{borderBottom: 0}}>
          <span class="grow small">gross <span class="num">${inr(m.gross)}</span> · deductions <span class="num">${inr(m.deductions)}</span></span>
          <b>net <span class="num" id="pay-net">${inr(m.net)}</span></b>
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
          <${UI.Input} id="pay-uan" label="UAN" value=${f.uan} onChange=${v => set('uan', v)}/>
        </div>
        <${UI.Input} id="pay-effective" label="effective from" type="date" value=${f.effective} onChange=${v => set('effective', v)}/>
        <${UI.TextArea} id="pay-note" label="note" rows=${2} value=${f.note} onChange=${v => set('note', v.slice(0, NOTE_MAX))}/>
      </div>
    <//>`;
  }

  /* ---------- salaries ---------- */
  function Salaries() {
    const ctx = M.useCtx();
    const map = salaryMap(ctx);
    const [open, setOpen] = useState(null);
    const people = ctx.activeMembers || [];
    return html`<${UI.Card} title="Salaries" id="pay-salaries">
      <p class="small ink62" style=${{marginTop: 0}}>Monthly earnings and deductions for each person on the roster. The run below reads these.</p>
      ${people.length ? html`<div class="stack tight">${people.map(p => {
        const s = map[p.uid];
        const m = monthly(s);
        return html`<div class="listrow" key=${p.uid}>
          <${UI.Avatar} id=${p.uid} size=${30}/>
          <span class="grow"><b><${UI.Name} id=${p.uid}/></b>
            <span class="tiny ink62 num"> · ${p.empId || ''}${p.title ? ' · ' + p.title : ''}</span>
            ${hasPay(s) ? html`<div class="small ink62">gross <span class="num">${inr(m.gross)}</span> · deductions <span class="num">${inr(m.deductions)}</span> · net <span class="num">${inr(m.net)}</span></div>`
              : html`<div class="small ink62">no pay set</div>`}
          </span>
          <${UI.Btn} kind="sec" sm=${true} id=${'pay-edit-' + p.uid} onClick=${() => setOpen(p.uid)}><${icons.edit}/>Edit pay<//>
        </div>`;
      })}</div>` : html`<${UI.Empty} text="Nobody on the roster yet."/>`}
      ${open ? html`<${PayDrawer} uid=${open} onClose=${() => setOpen(null)}/>` : null}
    <//>`;
  }

  /* ---------- the monthly run ---------- */
  function totalsOf(rows) {
    const t = {gross: 0, deductions: 0, net: 0, n: 0};
    for (const uid of Object.keys(rows || {})) {
      const r = rows[uid]; if (!r) continue;
      t.n++; t.gross += num(r.gross); t.deductions += deductionsOf(r); t.net += netOf(r);
    }
    return t;
  }
  function Run({month, setMonth}) {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const run = runOf(ctx, month);
    const closed = !!(run && run.closed);
    const map = salaryMap(ctx);
    const [draft, setDraft] = useState(null);      /* {month, rows} while edited */
    const [busy, setBusy] = useState(false);
    const dirty = !!(draft && draft.month === month);
    const rows = dirty ? draft.rows : (run ? run.rows || {} : null);
    const days = workingDays(ctx, month);
    const people = (ctx.activeMembers || []).filter(p => rows && rows[p.uid]);
    const orphans = rows ? Object.keys(rows).filter(u => rows[u] && !people.some(p => p.uid === u)) : [];
    const list = people.map(p => p.uid).concat(orphans);
    const prepare = () => {
      const out = {};
      for (const p of ctx.activeMembers || []) {
        const s = map[p.uid];
        if (!hasPay(s)) continue;
        const lop = absentDays(ctx, p.uid, month, today);
        out[p.uid] = {...compute(s, days, lop), note: '', paidAt: null};
      }
      if (!Object.keys(out).length) { M.toast('Nobody has a salary set yet', true); return; }
      setDraft({month, rows: out});
    };
    const edit = (uid, patch) => setDraft(d => {
      const cur = U.clone(d && d.month === month ? d.rows : (run ? run.rows || {} : {}));
      const r = {...(cur[uid] || {}), ...patch};
      if ('lop' in patch) {
        const s = map[uid];
        if (hasPay(s)) Object.assign(r, compute(s, r.days, patch.lop));
        else { r.lop = Math.min(num(r.days), Math.max(0, Math.round(num(patch.lop)))); r.paidDays = num(r.days) - r.lop; }
      }
      cur[uid] = r;
      return {month, rows: cur};
    });
    const write = async (close) => {
      if (!rows) return;
      setBusy(true);
      const out = U.clone(rows);
      const now = Date.now();
      for (const uid of Object.keys(out)) {
        const r = out[uid]; if (!r) { delete out[uid]; continue; }
        r.note = String(r.note || '').slice(0, NOTE_MAX);
        r.net = netOf(r);
        r.paidAt = close ? now : (r.paidAt || null);
      }
      const doc = {run: {at: (run && run.at) || now, by: (run && run.by) || ctx.uid, closed: !!close, rows: out}, updated: now};
      try { await ctx.W.set('payroll/' + month, doc); setDraft(null); M.toast(close ? 'Month closed' : 'Run saved'); }
      catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const t = totalsOf(rows);
    const paidRow = closed ? Object.values(run.rows || {}).find(x => x && x.paidAt) : null;
    const paidOn = paidRow ? U.fmtDate(U.ymd(new Date(paidRow.paidAt))) : '';
    return html`<${UI.Card} title="Monthly run" id="pay-run" action=${closed ? html`<${UI.Pill} kind="ink">closed<//>` : run ? html`<${UI.Pill}>saved<//>` : null}>
      <div class="row" style=${{alignItems: 'flex-end'}}>
        <div style=${{maxWidth: '200px'}}><${UI.Input} id="pay-month" label="month" type="month" value=${month} onChange=${v => { if (okMonth(v)) { setMonth(v); } }}/></div>
        ${closed ? null : html`<${UI.Btn} id="pay-prepare" kind=${rows ? 'sec' : undefined} disabled=${busy} onClick=${prepare}>${rows ? 'Prepare again' : 'Prepare payroll'}<//>`}
        ${rows && !closed ? html`<${UI.Btn} id="pay-save-run" disabled=${busy || !dirty} onClick=${() => write(false)}>Save the run<//>` : null}
        ${rows && !closed ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${() => write(true)}>Close the month<//>` : null}
      </div>
      <div class="tiny ink62" style=${{marginTop: '6px'}}>${monthName(month)}: <span class="num">${days}</span> working days, Monday to Saturday, minus holidays. Loss of pay starts at the days so far with no check-in and no approved leave.</div>
      ${rows ? html`<div class="tbl-wrap" style=${{marginTop: '12px'}}><table class="tbl" id="pay-rows">
        <thead><tr><th>person</th><th class="num">days</th><th class="num">paid</th><th class="num">lop</th><th class="num">gross</th><th class="num">deductions</th><th class="num">net</th><th>note</th></tr></thead>
        <tbody>${list.map(uid => {
          const r = rows[uid];
          return html`<tr key=${uid}>
            <td data-label="person"><span class="row nowrap" style=${{gap: '8px'}}><${UI.Avatar} id=${uid} size=${22}/><${UI.Name} id=${uid}/></span></td>
            <td data-label="days" class="num">${r.days}</td>
            <td data-label="paid" class="num">${r.paidDays}</td>
            <td data-label="lop" class="num">${closed ? r.lop : html`<input class="input" type="number" min="0" max=${r.days} step="1" style=${{width: '72px', minHeight: '34px'}} aria-label="Loss of pay days"
              value=${String(r.lop)} onInput=${e => edit(uid, {lop: num(e.target.value)})}/>`}</td>
            <td data-label="gross" class="num">${inr(r.gross)}</td>
            <td data-label="deductions" class="num">${inr(deductionsOf(r))}</td>
            <td data-label="net" class="num"><b>${inr(netOf(r))}</b></td>
            <td data-label="note">${closed ? (r.note || '') : html`<input class="input" style=${{minWidth: '160px', minHeight: '34px'}} aria-label="Note" placeholder="Note on the payslip"
              value=${r.note || ''} onInput=${e => edit(uid, {note: e.target.value.slice(0, NOTE_MAX)})}/>`}</td>
          </tr>`;
        })}
        <tr class="dark"><td>${t.n} people</td><td/><td/><td/><td class="num">${inr(t.gross)}</td><td class="num">${inr(t.deductions)}</td><td class="num">${inr(t.net)}</td><td/></tr>
        </tbody>
      </table></div>
      <div class="small ink62" id="pay-totals" style=${{marginTop: '8px'}}>gross <span class="num">${inr(t.gross)}</span> · deductions <span class="num">${inr(t.deductions)}</span> · net <span class="num">${inr(t.net)}</span> · headcount <span class="num">${t.n}</span>${dirty ? ' · unsaved changes' : ''}${paidOn ? ' · paid on ' + paidOn : ''}</div>`
      : html`<div style=${{marginTop: '12px'}}><${UI.Empty} text="No run for this month yet. Prepare it from the salaries and attendance."/></div>`}
    <//>`;
  }

  /* ---------- payslips ---------- */
  function Payslip({uid, month, row}) {
    const ctx = M.useCtx();
    const s = salaryMap(ctx)[uid] || {};
    const m = (ctx.members || {})[uid] || {};
    /* the name as plain text: the kv grid styles every odd span as a label */
    const profs = M.useProfiles([uid]);
    const who = (profs[uid] && profs[uid].name) || 'Someone';
    const net = netOf(row);
    const pairs = EARN.map(([k, l], i) => ({k, l, d: DEDUCT[i]}));
    return html`<${M.parts.DocFrame} id="payslip-doc" title="payslip">
      <${M.parts.DocHead} ctx=${ctx} right=${html`<div><span class="doc-pill">Payslip</span></div><div class="doc-title">${monthName(month)}</div>`}/>
      <div class="doc-grid">
        <div class="doc-kv">
          <span>employee</span><span><b>${who}</b></span>
          <span>employee id</span><span class="num">${m.empId || ''}</span>
          <span>title</span><span>${m.title || ''}</span>
          <span>PAN</span><span class="num">${s.pan || ''}</span>
          <span>UAN</span><span class="num">${s.uan || ''}</span>
          <span>bank account</span><span class="num">${mask((s.bank || {}).account)}</span>
          <span>IFSC</span><span class="num">${(s.bank || {}).ifsc || ''}</span>
        </div>
        <div class="doc-kv">
          <span>month</span><span>${monthName(month)}</span>
          <span>days</span><span class="num">${row.days}</span>
          <span>paid days</span><span class="num">${row.paidDays}</span>
          <span>loss of pay</span><span class="num">${row.lop}</span>
          <span>paid on</span><span class="num">${row.paidAt ? U.fmtDate(U.ymd(new Date(row.paidAt))) : 'pending'}</span>
        </div>
      </div>
      <table class="doc-table">
        <thead><tr><th>earnings</th><th class="n">amount</th><th>deductions</th><th class="n">amount</th></tr></thead>
        <tbody>${pairs.map(p => html`<tr key=${p.k}>
          <td><span class="doc-line">${p.l}</span></td><td class="n"><span class="num">${inr(row[p.k])}</span></td>
          <td><span class="doc-line">${p.d[1]}</span></td><td class="n"><span class="num">${inr(row[p.d[0]])}</span></td>
        </tr>`)}</tbody>
      </table>
      <div class="doc-lower">
        <div>
          <div class="doc-totals">
            <div class="doc-total-row"><span>Gross earnings</span><span class="num">${inr(row.gross)}</span></div>
            <div class="doc-total-row"><span>Deductions</span><span class="num">${inr(deductionsOf(row))}</span></div>
            <div class="doc-total-row grand"><span>Net pay</span><span class="num">${inr(net)}</span></div>
          </div>
          <div class="doc-block" style=${{marginTop: '14px'}}>
            <div class="doc-micro">Net pay in words</div>
            <div class="small"><b>${M.books.words(net, 'INR')}</b></div>
          </div>
          ${row.note ? html`<div class="doc-block"><div class="doc-micro">Note</div><div class="small">${row.note}</div></div>` : null}
        </div>
        <${M.parts.DocSign} ctx=${ctx}/>
      </div>
      <${M.parts.DocFoot} ctx=${ctx}/>
    <//>`;
  }
  function Payslips({month, id}) {
    const ctx = M.useCtx();
    const run = runOf(ctx, month);
    const rows = (run && run.rows) || {};
    const [pick, setPick] = useState(() => (id && rows[id] ? id : null));
    const list = (ctx.activeMembers || []).map(p => p.uid).filter(u => rows[u])
      .concat(Object.keys(rows).filter(u => rows[u] && !(ctx.activeMembers || []).some(p => p.uid === u)));
    const uid = pick && rows[pick] ? pick : null;
    if (!run) return null;
    return html`<${UI.Card} title="Payslips" id="pay-slips" action=${html`<${UI.Pill}>${monthName(month)}<//>`}>
      ${list.length ? html`<div class="stack tight">${list.map(u => html`<div class="listrow" key=${u}>
        <${UI.Avatar} id=${u} size=${28}/>
        <span class="grow"><b><${UI.Name} id=${u}/></b><span class="small ink62"> · net <span class="num">${inr(netOf(rows[u]))}</span>${rows[u].lop ? html` · <span class="num">${rows[u].lop}</span> days loss of pay` : ''}</span></span>
        <${UI.Btn} kind=${uid === u ? undefined : 'sec'} sm=${true} id=${'pay-slip-' + u} onClick=${() => setPick(u)}>Payslip<//>
      </div>`)}</div>` : html`<${UI.Empty} text="The run has no rows."/>`}
      ${uid ? html`<div style=${{marginTop: '16px'}}><${Payslip} uid=${uid} month=${month} row=${rows[uid]}/></div>` : null}
    <//>`;
  }

  /* ---------- the register ---------- */
  const COLS = ['month', 'employee_id', 'name', 'title', 'days', 'paid_days', 'lop', 'basic', 'hra', 'special', 'allowances', 'gross', 'pf', 'tds', 'esi', 'other', 'net', 'account_holder', 'account', 'ifsc', 'pan', 'uan', 'paid_on', 'note'];
  function Register({month}) {
    const ctx = M.useCtx();
    const [busy, setBusy] = useState(false);
    const run = runOf(ctx, month);
    if (!ctx.downloads || !run) return null;
    const go = async () => {
      setBusy(true);
      try {
        const rows = run.rows || {};
        const uids = Object.keys(rows).filter(u => rows[u]);
        const profs = (ctx.user && ctx.user.profiles) ? await ctx.user.profiles(uids) : {};
        const sal = salaryMap(ctx);
        const lines = [COLS.map(csvCell).join(',')];
        for (const u of uids) {
          const r = rows[u], s = sal[u] || {}, m = (ctx.members || {})[u] || {};
          lines.push([month, m.empId || '', (profs[u] && profs[u].name) || '', m.title || '', r.days, r.paidDays, r.lop,
            r.basic, r.hra, r.special, r.allowances, r.gross, r.pf, r.tds, r.esi, r.other, netOf(r),
            (s.bank || {}).holder || '', (s.bank || {}).account || '', (s.bank || {}).ifsc || '', s.pan || '', s.uan || '',
            r.paidAt ? U.ymd(new Date(r.paidAt)) : '', r.note || ''].map(csvCell).join(','));
        }
        const res = await ctx.downloads.save({filename: 'payroll-' + month + '.csv', data: lines.join('\n')});
        M.toast(res && res.status === 'delivered' ? 'Sent' : 'Downloaded');
      } catch (e) {
        M.toast(e && e.code === 'declined' ? 'Download cancelled' : 'That did not download. Try again in a moment.', true);
      }
      setBusy(false);
    };
    return html`<${UI.Btn} kind="sec" sm=${true} id="pay-csv" disabled=${busy} onClick=${go}><${icons.download || icons.upload}/>Download the register<//>`;
  }

  /* ---------- the page ---------- */
  function Payroll({id}) {
    const ctx = M.useCtx();
    const [month, setMonth] = useState(() => okMonth(id) ? id : U.monthId(new Date(ctx.now)));
    if (!ctx.isOwner) return html`<${UI.Empty} text="Payroll is the owner's alone."/>`;
    const run = runOf(ctx, month);
    return html`<div class="stack" style=${{gap: '18px'}} id="pay-page">
      <${Salaries}/>
      <${Run} month=${month} setMonth=${setMonth}/>
      ${run ? html`<div class="row between">
        <span class="small ink62">The register is the CSV for the bank upload and the accountant.</span>
        <${Register} month=${month}/>
      </div>` : null}
      <${Payslips} month=${month} id=${okMonth(id) ? null : id}/>
    </div>`;
  }

  M.pages.Payroll = Payroll;
  M.parts.Payslip = Payslip;
  M.payroll = {workingDays, absentDays, compute, monthly, netOf, suggest, monthName, EARN, DEDUCT};
})();
