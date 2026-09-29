/* module: expenses. What the company spends: a row per expense (date, vendor, category, amount, GST
   paid on it, how it was paid), recurring rows the first of the month copies forward, a receipt
   attached on the team site, totals by month and category, and a CSV. Rows live in
   expenses/<yyyy-mm>.rows. Owner only. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useMemo} = React;

  const CATS = ['Salaries', 'Rent', 'Software and tools', 'Freelancers', 'Production', 'Travel', 'Meals and client', 'Marketing', 'Professional fees', 'Bank and taxes', 'Equipment', 'Other'];
  const METHODS = [{v: 'bank', label: 'Bank transfer'}, {v: 'card', label: 'Card'}, {v: 'upi', label: 'UPI'}, {v: 'cash', label: 'Cash'}, {v: 'due', label: 'Not paid yet'}];
  const B = () => M.books;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = mid => { const [y, m] = mid.split('-').map(Number); return MON[m - 1] + ' ' + y; };
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  const blank = () => ({date: U.todayStr(), vendor: '', category: 'Software and tools', desc: '', amount: '', gstInput: '', method: 'bank', recurring: '', receipt: null});

  function ExpenseDrawer({row, onClose}) {
    const ctx = M.useCtx();
    const b = B();
    const [f, setF] = useState(() => row ? {...blank(), ...row} : blank());
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const canSave = !!(f.vendor.trim() && b.num(f.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.date));
    const save = async () => {
      if (!canSave || busy) return;
      setBusy(true);
      const month = f.date.slice(0, 7);
      const id = f.id || U.uid();
      const doc = {date: f.date, vendor: f.vendor.trim(), category: f.category, desc: String(f.desc || '').trim(), amount: b.num(f.amount), gstInput: b.num(f.gstInput),
        method: f.method, paid: f.method !== 'due', recurring: f.recurring || '', receipt: f.receipt || null, at: f.at || Date.now(), updatedAt: Date.now()};
      try {
        if (row && row.month && row.month !== month) await ctx.W.merge('expenses/' + row.month, {rows: {[id]: null}, updated: Date.now()});
        await ctx.W.merge('expenses/' + month, {rows: {[id]: doc}, updated: Date.now()});
        M.toast('Saved'); onClose();
      } catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const remove = async () => { await ctx.W.merge('expenses/' + row.month, {rows: {[row.id]: null}, updated: Date.now()}).catch(() => {}); M.toast('Removed'); onClose(); };
    const attach = e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file || !M.files || !M.files.upload) { M.toast('Receipts attach on the team site', true); return; }
      M.files.upload(file, 'books').then(r => set('receipt', {id: r.id, url: r.url, type: r.type, size: r.size, filename: file.name})).catch(() => M.toast('Could not attach', true));
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${row ? 'Edit expense' : 'New expense'}
      footer=${html`<div class="row between grow">${row ? html`<${UI.ConfirmBtn} sm=${true} kind="ghost" onConfirm=${remove}>Remove<//>` : html`<span/>`}<${UI.Btn} id="exp-save" disabled=${!canSave || busy} onClick=${save}>Save<//></div>`}>
      <div class="stack" id="exp-drawer">
        <div class="grid2"><${UI.Input} id="exp-date" label="date" type="date" value=${f.date} onChange=${v => set('date', v)}/>
          <${UI.Input} id="exp-amount" label="amount, INR" type="number" value=${String(f.amount)} onChange=${v => set('amount', v)}/></div>
        <${UI.Input} id="exp-vendor" label="paid to" value=${f.vendor} onChange=${v => set('vendor', v)} placeholder="Adobe, the landlord, a freelancer"/>
        <div class="grid2"><${UI.Select} id="exp-cat" label="category" value=${f.category} options=${CATS.map(c => ({v: c, label: c}))} onChange=${v => set('category', v)}/>
          <${UI.Select} label="paid by" value=${f.method} options=${METHODS} onChange=${v => set('method', v)}/></div>
        <${UI.Input} label="what for, optional" value=${f.desc} onChange=${v => set('desc', v)}/>
        <div class="grid2"><${UI.Input} label="GST paid on it, INR" type="number" value=${String(f.gstInput || '')} onChange=${v => set('gstInput', v)} hint="Input credit, when the vendor charged GST"/>
          <${UI.Select} label="repeats" value=${f.recurring} options=${[{v: '', label: 'Once'}, {v: 'monthly', label: 'Every month'}]} onChange=${v => set('recurring', v)}/></div>
        <div class="row">
          <label class="btn sec sm">${f.receipt ? 'Change the receipt' : 'Attach a receipt'}<input type="file" accept="image/*,.pdf" style=${{display: 'none'}} onChange=${attach}/></label>
          ${f.receipt ? html`<span class="small">${f.receipt.filename || 'receipt'}</span><button type="button" class="linky small" onClick=${() => set('receipt', null)}>Remove</button>` : null}
        </div>
      </div>
    <//>`;
  }

  function Expenses({id}) {
    const ctx = M.useCtx();
    const b = B();
    const all = b.expenses(ctx);
    const [month, setMonth] = useState(() => U.monthId(new Date(ctx.now)));
    const [cat, setCat] = useState('all');
    const [open, setOpen] = useState(null);
    if (!ctx.isOwner) return html`<${UI.Empty} text="The books are the owner's alone."/>`;
    const months = Array.from(new Set(all.map(e => e.month).concat([U.monthId(new Date(ctx.now))]))).sort().reverse();
    const list = all.filter(e => e.month === month && (cat === 'all' || e.category === cat));
    const total = list.reduce((s, e) => s + b.num(e.amount), 0);
    const gst = list.reduce((s, e) => s + b.num(e.gstInput), 0);
    const byCat = {};
    for (const e of all.filter(x => x.month === month)) byCat[e.category] = (byCat[e.category] || 0) + b.num(e.amount);
    const cats = Object.keys(byCat).sort((x, y) => byCat[y] - byCat[x]);
    const csv = async () => {
      const lines = [['date', 'paid to', 'category', 'what for', 'amount', 'gst paid', 'paid by', 'paid', 'repeats'].join(',')]
        .concat(list.map(e => [e.date, e.vendor, e.category, e.desc, e.amount, e.gstInput || 0, e.method, e.paid ? 'yes' : 'no', e.recurring || ''].map(csvCell).join(',')));
      const r = await ctx.downloads.save({filename: 'expenses-' + month + '.csv', data: lines.join('\n')});
      M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
    };
    return html`<div class="stack" style=${{gap: '16px'}}>
      <${UI.PageHead} micro=${monthLabel(month) + ', ' + U.inr(total) + (gst ? ', GST paid ' + U.inr(gst) : '')} title="Expenses">
        <${UI.Btn} id="exp-new" onClick=${() => setOpen({})}><${icons.plus}/>New expense<//>
      <//>
      <div class="row between">
        <${UI.Seg} sm=${true} options=${months.slice(0, 8).map(m => ({v: m, label: monthLabel(m)}))} value=${month} onChange=${setMonth} ariaLabel="Month"/>
        ${ctx.downloads && list.length ? html`<${UI.Btn} kind="sec" sm=${true} id="exp-csv" onClick=${csv}>Download the month<//>` : null}
      </div>
      <div class="split">
        <${UI.Card} id="exp-list">
          ${cats.length > 1 ? html`<div style=${{marginBottom: '10px'}}><${UI.Seg} sm=${true} options=${[{v: 'all', label: 'All'}].concat(cats.map(c => ({v: c, label: c})))} value=${cat} onChange=${setCat} ariaLabel="Category"/></div>` : null}
          ${list.length ? html`<div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>date</th><th>paid to</th><th>category</th><th class="num">amount</th><th>paid by</th></tr></thead>
            <tbody>${list.map(e => html`<tr key=${e.id} style=${{cursor: 'pointer'}} onClick=${() => setOpen(e)}>
              <td data-label="date" class="num">${U.fmtDate(e.date)}</td>
              <td data-label="paid to"><b>${e.vendor}</b>${e.desc ? html`<span class="tiny ink62"> · ${e.desc}</span>` : null}${e.recurring ? html` <${UI.Pill}>monthly<//>` : null}${e.receipt ? html` <span class="tiny ink62">receipt</span>` : null}</td>
              <td data-label="category">${e.category}</td>
              <td data-label="amount" class="num">${U.inr(e.amount)}</td>
              <td data-label="paid by">${e.paid ? (METHODS.find(m => m.v === e.method) || {}).label || e.method : html`<span class="flame-t">not paid</span>`}</td>
            </tr>`)}</tbody>
          </table></div>` : html`<${UI.Empty} text="Nothing logged this month. Salaries land here from a closed payroll run; rent and tools can repeat every month."/>`}
        <//>
        <${UI.Card} title="By category" id="exp-cats">
          ${cats.length ? cats.map(c => html`<div class="listrow" key=${c}><span class="grow">${c}</span><span class="num" style=${{fontWeight: 500}}>${U.inr(byCat[c])}</span></div>`) : html`<${UI.Empty} text="Nothing yet."/>`}
          ${cats.length ? html`<div class="listrow"><b class="grow">Total</b><b class="num">${U.inr(Object.values(byCat).reduce((s, v) => s + v, 0))}</b></div>` : null}
        <//>
      </div>
      ${open ? html`<${ExpenseDrawer} row=${open.id ? open : null} onClose=${() => setOpen(null)}/>` : null}
    </div>`;
  }

  M.expenses = {CATS, METHODS, blank, monthLabel};
  M.pages.Expenses = Expenses;
})();
