/* module: invoices. The invoice book: the list by financial year, the builder (client, number, dates,
   GST mode, lines with SAC, TDS, notes, a foreign currency with its INR rate), the printed document
   in the Mask360 letterhead, sending by email (the team site sends through Resend; the claude.ai page
   opens the mail app with the text ready), payments, reminders and void. Rows live in
   invoices/<FY>.rows. Owner only. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  /* a number in metal (metal-fx MetalText) */
  const MetalNum = ({children, size, weight, color}) => html`<span class="fx-num"><${M.fx.MetalText} size=${size} weight=${weight} color=${color}>${children}<//></span>`;
  const {useState, useEffect, useMemo} = React;

  const GST_OPTS = [{v: 'intra', label: 'CGST and SGST, same state'}, {v: 'inter', label: 'IGST, another state'}, {v: 'none', label: 'No GST, export or unregistered'}];
  const FILTERS = [{v: 'open', label: 'Open'}, {v: 'overdue', label: 'Overdue'}, {v: 'draft', label: 'Drafts'}, {v: 'paid', label: 'Paid'}, {v: 'all', label: 'All'}];
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const B = () => M.books;
  /* the status tag: paid wears a metal badge (metal-fx), every other state its pill */
  const InvBeam = ({children}) => M.fx ? html`<${M.fx.Beam} radius=${20}>${children}<//>` : children;
  const StatusTag = ({st}) => st === 'paid' && M.fx ? html`<${M.fx.MetalBadge} className="inv-paid">paid<//>` : html`<${UI.Pill} kind=${B().STATUS_PILL[st]}>${B().STATUS_TEXT[st]}<//>`;

  /* ---------- a new invoice from the client's billing profile ---------- */
  function fresh(ctx, clientId) {
    const b = B();
    const s = b.settings(ctx);
    const prof = clientId ? b.clientBook(ctx)[clientId] : null;
    const client = clientId ? ctx.coll.clients.map[clientId] : null;
    const today = U.todayStr();
    const days = prof && prof.termsDays ? b.num(prof.termsDays) : s.defaults.termsDays;
    const abroad = prof && prof.country && prof.country !== 'India';
    const fy = b.fyOf(today);
    const d = new Date(ctx.now);
    return {
      no: clientId ? b.nextNumber(ctx, b.codeOf(ctx, clientId), fy) : '',
      client: clientId || '', clientName: (prof && prof.legalName) || (client && client.name) || '',
      billTo: {legalName: (prof && prof.legalName) || (client && client.name) || '', address: (prof && prof.address) || '', country: (prof && prof.country) || 'India', taxId: (prof && prof.taxId) || '', contactEmail: (prof && prof.contactEmail) || '', contactName: (prof && prof.contactName) || ''},
      date: today, due: U.ymd(U.addDays(U.parseYmd(today), days)), period: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear(),
      currency: (prof && prof.currency) || s.defaults.currency, gst: abroad ? 'none' : (prof && prof.retainer && prof.retainer.gst) || 'intra', gstRate: s.defaults.gstRate, reverse: !!abroad,
      place: abroad ? (prof.country) : (s.company.state || ''),
      lines: [{desc: (prof && prof.retainer && prof.retainer.active) ? prof.retainer.desc : '', note: '', sac: (prof && prof.retainer && prof.retainer.sac) || s.defaults.sac, qty: 1, rate: (prof && prof.retainer && prof.retainer.active) ? prof.retainer.amount : ''}],
      tds: 0, tdsNote: '', status: 'draft', sentAt: null, sentTo: '', payments: [], chased: [],
      notes: s.defaults.notes, terms: days === s.defaults.termsDays ? s.defaults.terms : days + ' days from invoice date (Net ' + days + ')',
      fx: '', auto: '', createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  /* ---------- the email for an invoice or a reminder: subject, plain text and html ---------- */
  function mailFor(ctx, inv, kind) {
    const b = B();
    const s = b.settings(ctx);
    const t = b.totals(inv);
    const who = inv.billTo && inv.billTo.contactName ? inv.billTo.contactName.split(' ')[0] : 'there';
    const amt = b.money(kind === 'remind' ? t.balance : t.total, inv.currency);
    const late = inv.due ? b.ageOf(inv, U.todayStr()) : 0;
    const subject = kind === 'remind'
      ? 'Reminder: invoice ' + inv.no + ', ' + amt + (late > 0 ? ', ' + late + ' days past due' : '')
      : 'Invoice ' + inv.no + ' from ' + s.company.name + ', ' + amt;
    const lines = (inv.lines || []).filter(l => l.desc).map(l => '• ' + l.desc + ': ' + b.money(b.num(l.qty) * b.num(l.rate), inv.currency));
    const bank = ['A/C name: ' + s.bank.holder, 'Bank: ' + s.bank.name + (s.bank.branch ? ', ' + s.bank.branch : ''), 'A/C no: ' + s.bank.account, 'IFSC: ' + s.bank.ifsc].concat(s.bank.iban ? ['IBAN: ' + s.bank.iban] : []).concat(s.bank.swift ? ['SWIFT: ' + s.bank.swift] : []);
    const text = kind === 'remind'
      ? ['Hi ' + who + ',', '', 'A gentle reminder that invoice ' + inv.no + ' for ' + amt + ' was due on ' + U.fmtDate(inv.due) + (late > 0 ? ' and is ' + late + ' days past due.' : '.'), 'Could you let us know when it is scheduled for payment? If it has already gone out, please share the reference and we will close it on our side.', '', 'Bank details for the transfer:', ...bank, '', 'Thank you,', s.signatory.who, s.signatory.title, s.company.mail].join('\n')
      : ['Hi ' + who + ',', '', 'Please find invoice ' + inv.no + ' for ' + amt + ', due on ' + U.fmtDate(inv.due) + '.', '', ...lines, '', 'Bank details for the transfer:', ...bank, '', 'The invoice is attached as a page below. Reply here with any question.', '', 'Thank you,', s.signatory.who, s.signatory.title, s.company.mail].join('\n');
    const rows = (inv.lines || []).filter(l => l.desc).map(l => '<tr><td style="padding:6px 8px;border-bottom:1px solid #EFEDE7">' + esc(l.desc) + (l.note ? '<div style="color:#BBBBBB;font-size:12px">' + esc(l.note) + '</div>' : '') + '</td><td style="padding:6px 8px;border-bottom:1px solid #EFEDE7;text-align:right;white-space:nowrap">' + esc(b.money(b.num(l.qty) * b.num(l.rate), inv.currency)) + '</td></tr>').join('');
    const tot = [['Subtotal', t.sub]].concat(inv.gst === 'intra' ? [['CGST', t.cgst], ['SGST', t.sgst]] : inv.gst === 'inter' ? [['IGST', t.igst]] : []).concat(t.tds ? [['TDS deductible', -t.tds]] : []).concat([['Total due', t.total]]).concat(t.paid ? [['Paid', -t.paid], ['Balance', t.balance]] : []);
    const totHtml = tot.map(([l, v], i) => '<tr><td style="padding:5px 8px;color:' + (i === tot.length - 1 || l === 'Total due' ? '#0E0E0E;font-weight:700' : '#0E0E0E') + '">' + esc(l) + '</td><td style="padding:5px 8px;text-align:right;white-space:nowrap' + (l === 'Total due' ? ';font-weight:700' : '') + '">' + esc(b.money(v, inv.currency)) + '</td></tr>').join('');
    const htmlBody = '<p>' + esc(text.split('\n\n')[0]) + '</p><p>' + esc(text.split('\n\n')[1]) + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0"><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #0E0E0E">Invoice ' + esc(inv.no) + '</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #0E0E0E">' + esc(inv.currency) + '</th></tr>' + rows + '</table>' +
      '<table style="margin-left:auto;font-size:14px;border-collapse:collapse">' + totHtml + '</table>' +
      '<p style="margin-top:14px"><b>Bank details</b><br>' + bank.map(esc).join('<br>') + '</p>' +
      '<p>' + (kind === 'remind' ? 'If it has already gone out, please share the reference and we will close it on our side.' : 'Reply here with any question.') + '</p>' +
      '<p>' + esc(s.signatory.who) + '<br><span style="color:#BBBBBB">' + esc(s.signatory.title) + ' · ' + esc(s.company.mail) + '</span></p>';
    return {subject, text, html: htmlBody};
  }

  /* ---------- the document ---------- */
  function InvoiceDoc({inv}) {
    const ctx = M.useCtx();
    const b = B();
    const s = b.settings(ctx);
    const t = b.totals(inv);
    const c = s.company;
    const to = inv.billTo || {};
    const abroad = to.country && to.country !== 'India';
    const taxType = inv.gst === 'intra' ? 'CGST and SGST (same state)' : inv.gst === 'inter' ? 'IGST (another state)' : 'Not applicable';
    const lines = (inv.lines || []).filter(l => l.desc || b.num(l.rate));
    const st = b.status(inv, U.todayStr());
    return html`<${M.parts.DocFrame} id="invoice-doc" title=${'invoice ' + inv.no}>
      <${M.parts.DocHead} ctx=${ctx} right=${html`<div>
        <span class="doc-pill">${inv.gst === 'none' ? 'Invoice' : 'Tax invoice'}</span>
        <div class="doc-title" style=${{marginTop: '16px'}}>${inv.no}</div>
        <div class="doc-micro">Invoice number${st === 'paid' ? ' · paid' : st === 'void' ? ' · void' : ''}</div>
      </div>`}/>
      <div class="doc-cells">
        <div class="doc-cell"><div class="doc-micro">Invoice date</div><div class="v num">${U.fmtDate(inv.date)}</div></div>
        <div class="doc-cell"><div class="doc-micro">Due date</div><div class="v num due">${inv.due ? U.fmtDate(inv.due) : 'on receipt'}</div></div>
        <div class="doc-cell"><div class="doc-micro">Period of service</div><div class="v">${inv.period || '·'}</div></div>
        <div class="doc-cell"><div class="doc-micro">Currency</div><div class="v">${inv.currency} ${(b.CUR[inv.currency] || b.CUR.INR).sym.trim()}</div></div>
      </div>
      <div class="doc-parties">
        <div class="doc-party">
          <div class="doc-micro">Billed from</div>
          <div class="doc-party-name">${c.name}</div>
          <div class="doc-addr">${String(c.address || '').split('\n').map((l, i) => html`<div key=${i}>${l}</div>`)}</div>
          ${c.udyam ? html`<span class="doc-tag">Udyam: ${c.udyam}</span>` : null}
          ${c.gstin ? html`<span class="doc-tag" style=${{marginLeft: '6px'}}>GSTIN: ${c.gstin}</span>` : null}
        </div>
        <div class="doc-party">
          <div class="doc-micro">Billed to</div>
          <div class="doc-party-name">${to.legalName || inv.clientName}</div>
          <div class="doc-addr">${String(to.address || '').split('\n').filter(Boolean).map((l, i) => html`<div key=${i}>${l}</div>`)}${to.country ? html`<div>${to.country}</div>` : null}</div>
          ${to.taxId ? html`<span class="doc-tag">${abroad ? 'Tax reg / TRN: ' : 'GSTIN: '}${to.taxId}</span>` : null}
          <div class="doc-kv" style=${{marginTop: '10px'}}>
            <span>Place of supply</span><span>${inv.place || '·'}</span>
            <span>Tax type</span><span>${taxType}</span>
            <span>Reverse charge</span><span>${inv.reverse ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
      <table class="doc-table">
        <thead><tr><th>#</th><th>Description of services</th><th class="slim">SAC</th><th class="n slim">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
        <tbody>${lines.map((l, i) => html`<tr key=${i}>
          <td class="num">${String(i + 1).padStart(2, '0')}</td>
          <td><div class="doc-line">${l.desc}</div>${l.note ? html`<div class="doc-note">${l.note}</div>` : null}</td>
          <td class="num slim">${l.sac || '·'}</td>
          <td class="n num slim">${b.fmt(l.qty, 'INR')}</td>
          <td class="n num">${b.fmt(l.rate, inv.currency)}</td>
          <td class="n num">${b.fmt(b.num(l.qty) * b.num(l.rate), inv.currency)}</td>
        </tr>`)}</tbody>
      </table>
      <div class="doc-words"><span class="doc-micro">Amount in words</span><b>${b.words(t.total, inv.currency)}</b></div>
      <div class="doc-lower">
        <div>
          <div class="doc-block"><div class="doc-micro">Payment terms</div><div class="small">${inv.terms || s.defaults.terms}</div></div>
          <div class="doc-block"><div class="doc-micro">Notes</div><div class="small">
            ${inv.currency !== 'INR' ? html`<div>All amounts are in ${b.CUR[inv.currency] ? b.CUR[inv.currency].word : inv.currency} (${inv.currency}).</div>` : null}
            ${inv.gst === 'none' && abroad ? html`<div>${s.defaults.exportNote}${to.taxId ? ' Recipient tax registration ' + to.taxId + '.' : ''}</div>` : null}
            ${String(inv.notes || '').split('\n').filter(Boolean).map((l, i) => html`<div key=${i}>${l}</div>`)}
          </div></div>
          <div class="doc-block"><div class="doc-micro">Bank details</div>
            <div class="doc-kv">
              <span>A/C name</span><span>${s.bank.holder}</span>
              <span>Bank</span><span>${s.bank.name}</span>
              ${s.bank.branch ? html`<span>Branch</span><span>${s.bank.branch}</span>` : null}
              <span>A/C no</span><span class="num">${s.bank.account}</span>
              <span>IFSC</span><span>${s.bank.ifsc}</span>
              ${s.bank.iban ? html`<span>IBAN</span><span>${s.bank.iban}</span>` : null}
              ${s.bank.swift ? html`<span>SWIFT</span><span>${s.bank.swift}</span>` : null}
            </div>
          </div>
        </div>
        <div>
          <div class="doc-totals">
            <div class="doc-total-row"><span>Subtotal (taxable value)</span><span class="num">${b.money(t.sub, inv.currency)}</span></div>
            ${inv.gst === 'intra' ? html`<div class="doc-total-row"><span>CGST @ ${b.num(inv.gstRate) / 2}%</span><span class="num">${b.money(t.cgst, inv.currency)}</span></div>
              <div class="doc-total-row"><span>SGST @ ${b.num(inv.gstRate) / 2}%</span><span class="num">${b.money(t.sgst, inv.currency)}</span></div>` : null}
            ${inv.gst === 'inter' ? html`<div class="doc-total-row"><span>IGST @ ${b.num(inv.gstRate)}%</span><span class="num">${b.money(t.igst, inv.currency)}</span></div>` : null}
            ${t.tds ? html`<div class="doc-total-row"><span>TDS deductible${inv.tdsNote ? ' (' + inv.tdsNote + ')' : ''}</span><span class="num">${b.money(t.tds, inv.currency)}</span></div>` : null}
            <div class="doc-total-row grand"><span>Total due</span><span class="num">${b.money(t.total, inv.currency)}</span></div>
            ${t.paid ? html`<div class="doc-total-row"><span>Received</span><span class="num">${b.money(t.paid, inv.currency)}</span></div>
              <div class="doc-total-row"><span>Balance</span><span class="num">${b.money(t.balance, inv.currency)}</span></div>` : null}
          </div>
          <div class="doc-block" style=${{marginTop: '16px'}}><div class="doc-micro">Declaration</div><div class="small">We hereby declare that this invoice shows the actual price of the services described and that all particulars are true and correct to the best of our knowledge.</div></div>
          <${M.parts.DocSign} ctx=${ctx} label="Authorised signatory"/>
        </div>
      </div>
      <${M.parts.DocFoot} ctx=${ctx}/>
    <//>`;
  }

  /* ---------- the builder ---------- */
  function Builder({inv, onClose, onSaved}) {
    const ctx = M.useCtx();
    const b = B();
    const [f, setF] = useState(() => U.clone(inv));
    const [busy, setBusy] = useState(false);
    const clients = Object.keys(ctx.coll.clients.map).map(k => ({v: k, label: ctx.coll.clients.map[k].name || k})).sort((x, y) => x.label.localeCompare(y.label));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setTo = (k, v) => setF(x => ({...x, billTo: {...(x.billTo || {}), [k]: v}}));
    const setLine = (i, k, v) => setF(x => { const lines = x.lines.map((l, j) => j === i ? {...l, [k]: v} : l); return {...x, lines}; });
    const addLine = () => setF(x => ({...x, lines: x.lines.concat([{desc: '', note: '', sac: b.settings(ctx).defaults.sac, qty: 1, rate: ''}])}));
    const dropLine = i => setF(x => ({...x, lines: x.lines.length > 1 ? x.lines.filter((l, j) => j !== i) : x.lines}));
    const pickClient = id => { const n = fresh(ctx, id); setF(x => ({...n, id: x.id, lines: x.lines.some(l => l.desc) ? x.lines : n.lines, notes: x.notes || n.notes, createdAt: x.createdAt || n.createdAt})); };
    const t = b.totals(f);
    const abroad = f.billTo && f.billTo.country && f.billTo.country !== 'India';
    const canSave = !!(f.no && f.date && (f.lines || []).some(l => l.desc && b.num(l.rate) > 0));
    const save = async (andSend) => {
      if (!canSave || busy) return;
      setBusy(true);
      const fy = b.fyOf(f.date);
      const id = f.id || U.uid();
      const row = {...f, tds: b.num(f.tds), gstRate: b.num(f.gstRate), fx: f.currency === 'INR' ? '' : (b.num(f.fx) || ''), updatedAt: Date.now()};
      delete row.id; delete row.fy;
      if (andSend && !row.sentAt) { row.sentAt = Date.now(); row.status = 'sent'; }
      try {
        if (inv.fy && inv.fy !== fy) await ctx.W.merge('invoices/' + inv.fy, {rows: {[id]: null}, updated: Date.now()});
        await ctx.W.merge('invoices/' + fy, {rows: {[id]: row}, updated: Date.now()});
        M.toast(andSend ? 'Saved and marked sent' : 'Saved');
        onSaved(id);
      } catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${inv.id ? 'Edit ' + inv.no : 'New invoice'}
      footer=${html`<div class="row between grow"><span class="num" style=${{fontWeight: 600}}>${b.money(t.total, f.currency)}</span>
        <span class="row nowrap" style=${{gap: '8px'}}>
          ${!inv.sentAt ? html`<${UI.Btn} kind="sec" id="inv-save-sent" disabled=${!canSave || busy} onClick=${() => save(true)}>Save, mark sent<//>` : null}
          <${UI.Btn} id="inv-save" disabled=${!canSave || busy} onClick=${() => save(false)}>Save<//></span></div>`}>
      <div class="stack" id="inv-drawer">
        <${UI.Select} id="inv-client" label="client" value=${f.client} options=${[{v: '', label: 'Pick a client'}].concat(clients)} onChange=${pickClient}/>
        <div class="grid2"><${UI.Input} id="inv-no" label="invoice number" value=${f.no} onChange=${v => set('no', v)}/>
          <${UI.Select} label="currency" value=${f.currency} options=${b.CUR_OPTS} onChange=${v => set('currency', v)}/></div>
        <div class="grid2"><${UI.Input} id="inv-date" label="invoice date" type="date" value=${f.date} onChange=${v => set('date', v)}/>
          <${UI.Input} id="inv-due" label="due date" type="date" value=${f.due} onChange=${v => set('due', v)}/></div>
        <div class="grid2"><${UI.Input} label="period of service" value=${f.period} onChange=${v => set('period', v)}/>
          <${UI.Input} label="place of supply" value=${f.place} onChange=${v => set('place', v)}/></div>
        <div class="grid2"><${UI.Select} id="inv-gst" label="tax" value=${f.gst} options=${GST_OPTS} onChange=${v => set('gst', v)}/>
          <${UI.Input} label="GST rate, percent" type="number" value=${String(f.gstRate)} onChange=${v => set('gstRate', v)}/></div>
        ${abroad ? html`<${UI.Check} label="Reverse charge: the recipient accounts for VAT" checked=${!!f.reverse} onChange=${v => set('reverse', v)}/>` : null}
        <${UI.Field} label="billed to">
          <div class="stack tight">
            <${UI.Input} id="inv-legal" label="legal name" value=${(f.billTo || {}).legalName || ''} onChange=${v => setTo('legalName', v)}/>
            <${UI.TextArea} label="address, one line per row" rows=${2} value=${(f.billTo || {}).address || ''} onChange=${v => setTo('address', v)}/>
            <div class="grid2"><${UI.Input} label="country" value=${(f.billTo || {}).country || ''} onChange=${v => setTo('country', v)}/>
              <${UI.Input} label=${abroad ? 'tax registration, TRN' : 'GSTIN'} value=${(f.billTo || {}).taxId || ''} onChange=${v => setTo('taxId', v)}/></div>
            <${UI.Input} label="their accounts email" value=${(f.billTo || {}).contactEmail || ''} onChange=${v => setTo('contactEmail', v)}/>
          </div>
        <//>
        <${UI.Field} label="lines">
          <div class="stack tight inv-lines">
            ${f.lines.map((l, i) => html`<div class="card" key=${i} style=${{padding: '12px 14px'}}>
              <div class="stack tight">
                <div class="row between"><${UI.Micro} plain>line ${i + 1}<//>${f.lines.length > 1 ? html`<button type="button" class="linky small" onClick=${() => dropLine(i)}>Remove</button>` : null}</div>
                <${UI.Input} id=${'inv-line-desc-' + i} label="service" value=${l.desc} onChange=${v => setLine(i, 'desc', v)} placeholder="Monthly retainer, September"/>
                <${UI.Input} label="description, optional" value=${l.note || ''} onChange=${v => setLine(i, 'note', v)}/>
                <div class="grid2" style=${{gridTemplateColumns: '1fr 1fr 1.4fr'}}>
                  <${UI.Input} label="SAC" value=${l.sac || ''} onChange=${v => setLine(i, 'sac', v)}/>
                  <${UI.Input} label="qty" type="number" value=${String(l.qty)} onChange=${v => setLine(i, 'qty', v)}/>
                  <${UI.Input} id=${'inv-line-rate-' + i} label=${'rate, ' + f.currency} type="number" value=${String(l.rate)} onChange=${v => setLine(i, 'rate', v)}/>
                </div>
                <div class="tiny ink62 num">${b.money(b.num(l.qty) * b.num(l.rate), f.currency)}</div>
              </div>
            </div>`)}
            <div><${UI.Btn} kind="sec" sm=${true} id="inv-add-line" onClick=${addLine}><${icons.plus}/>Add a line<//></div>
          </div>
        <//>
        <div class="grid2"><${UI.Input} id="inv-tds" label=${'TDS the client deducts, ' + f.currency} type="number" value=${String(f.tds || '')} onChange=${v => set('tds', v)} hint="Shown on the invoice and expected short of the total"/>
          <${UI.Input} label="TDS section, optional" value=${f.tdsNote || ''} onChange=${v => set('tdsNote', v)} placeholder="194J at 10%"/></div>
        ${f.currency !== 'INR' ? html`<${UI.Input} id="inv-fx" label=${'INR per ' + f.currency + ', for the books'} type="number" value=${String(f.fx || '')} onChange=${v => set('fx', v)} hint="The overview and GST figures use this rate"/>` : null}
        <${UI.Input} label="payment terms line" value=${f.terms} onChange=${v => set('terms', v)}/>
        <${UI.TextArea} label="notes, one per line" rows=${3} value=${f.notes} onChange=${v => set('notes', v)}/>
        <div class="card" style=${{padding: '12px 14px'}}>
          <div class="stack tight small">
            <div class="row between"><span>Subtotal</span><span class="num">${b.money(t.sub, f.currency)}</span></div>
            ${t.tax ? html`<div class="row between"><span>GST</span><span class="num">${b.money(t.tax, f.currency)}</span></div>` : null}
            <div class="row between"><b>Total due</b><b class="num">${b.money(t.total, f.currency)}</b></div>
            <div class="tiny ink62">${b.words(t.total, f.currency)}</div>
          </div>
        </div>
      </div>
    <//>`;
  }

  /* ---------- one invoice, opened ---------- */
  function PayDrawer({inv, onClose}) {
    const ctx = M.useCtx();
    const b = B();
    const t = b.totals(inv);
    const [f, setF] = useState({amount: String(Math.max(0, t.balance) || ''), date: U.todayStr(), ref: '', note: ''});
    const [busy, setBusy] = useState(false);
    const save = async () => {
      if (!b.num(f.amount) || busy) return;
      setBusy(true);
      const payments = (inv.payments || []).concat([{at: U.parseYmd(f.date).getTime() + 43200000, amount: b.num(f.amount), ref: f.ref.trim(), note: f.note.trim()}]);
      try { await ctx.W.merge('invoices/' + inv.fy, {rows: {[inv.id]: {payments, updatedAt: Date.now()}}, updated: Date.now()}); M.toast('Payment recorded'); onClose(); }
      catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${'Payment on ' + inv.no}
      footer=${html`<${UI.Btn} id="inv-pay-record" disabled=${busy || !b.num(f.amount)} onClick=${save}>Record the payment<//>`}>
      <div class="stack" id="inv-pay-drawer">
        <div class="grid2"><${UI.Input} id="inv-pay-amount" label=${'amount received, ' + inv.currency} type="number" value=${f.amount} onChange=${v => setF(x => ({...x, amount: v}))}/>
          <${UI.Input} label="received on" type="date" value=${f.date} onChange=${v => setF(x => ({...x, date: v}))}/></div>
        <${UI.Input} label="reference, UTR or cheque" value=${f.ref} onChange=${v => setF(x => ({...x, ref: v}))}/>
        <${UI.Input} label="note, optional" value=${f.note} onChange=${v => setF(x => ({...x, note: v}))}/>
        <div class="small ink62">Balance before this payment: <span class="num">${b.money(t.balance, inv.currency)}</span>${t.tds ? ', after TDS of ' + b.money(t.tds, inv.currency) : ''}.</div>
      </div>
    <//>`;
  }

  function SendDrawer({inv, kind, onClose}) {
    const ctx = M.useCtx();
    const b = B();
    const s = b.settings(ctx);
    const m = useMemo(() => mailFor(ctx, inv, kind), [inv, kind]);
    const [to, setTo] = useState((inv.billTo && inv.billTo.contactEmail) || '');
    const [cc, setCc] = useState(s.chase.cc || '');
    const [subject, setSubject] = useState(m.subject);
    const [text, setText] = useState(m.text);
    const [busy, setBusy] = useState(false);
    const site = typeof window.M360_API === 'function';
    const mark = async (via) => {
      const patch = {updatedAt: Date.now()};
      if (kind === 'remind') patch.chased = (inv.chased || []).concat([{at: Date.now(), step: 'hand', via}]);
      else { patch.sentAt = inv.sentAt || Date.now(); patch.status = 'sent'; patch.sentTo = to; }
      await ctx.W.merge('invoices/' + inv.fy, {rows: {[inv.id]: patch}, updated: Date.now()}).catch(() => {});
    };
    const send = async () => {
      if (!to.trim() || busy) return;
      setBusy(true);
      try {
        /* the server sends the mail and marks the invoice in the same breath */
        await window.M360_API('invoicesend', {fy: inv.fy, id: inv.id, to: to.trim(), cc: cc.trim(), subject, text, html: m.html.replace(esc(m.text.split('\n\n')[0]), esc(text.split('\n\n')[0])), kind});
        M.toast(kind === 'remind' ? 'Reminder sent' : 'Invoice sent');
        onClose();
      } catch (e) { M.toast((e && e.message) || 'Could not send', true); setBusy(false); }
    };
    const openMail = async () => {
      const href = 'mailto:' + encodeURIComponent(to.trim()) + '?' + (cc.trim() ? 'cc=' + encodeURIComponent(cc.trim()) + '&' : '') + 'subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      try { window.open(href, '_self'); } catch (e) { /* no mail app */ }
      await mark('mailto');
      M.toast(kind === 'remind' ? 'Reminder marked as sent' : 'Marked as sent');
      onClose();
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${kind === 'remind' ? 'Chase ' + inv.no : 'Send ' + inv.no}
      footer=${site ? html`<${UI.Btn} id="send-go" disabled=${busy || !to.trim()} onClick=${send}><${icons.send}/>${kind === 'remind' ? 'Send the reminder' : 'Send the invoice'}<//>`
        : html`<${UI.Btn} id="send-mailto" disabled=${!to.trim()} onClick=${openMail}><${icons.send}/>Open in the mail app<//>`}>
      <div class="stack" id="send-drawer">
        <div class="grid2"><${UI.Input} id="send-to" label="to" value=${to} onChange=${setTo}/><${UI.Input} label="copy" value=${cc} onChange=${setCc}/></div>
        <${UI.Input} label="subject" value=${subject} onChange=${setSubject}/>
        <${UI.TextArea} id="send-text" label="the email" rows=${14} value=${text} onChange=${setText}/>
        <div class="tiny ink62">${site ? 'Sent from the team site through Resend, with the invoice table and the bank details laid out, and marked as sent here.' : 'The claude.ai page hands the text to your mail app and marks the invoice as sent. The team site sends it for you.'}</div>
      </div>
    <//>`;
  }

  function InvoiceView({inv, onBack}) {
    const ctx = M.useCtx();
    const b = B();
    const today = U.todayStr();
    const st = b.status(inv, today);
    const t = b.totals(inv);
    const [edit, setEdit] = useState(false);
    const [pay, setPay] = useState(false);
    const [send, setSend] = useState(null);
    const patch = p => ctx.W.merge('invoices/' + inv.fy, {rows: {[inv.id]: {...p, updatedAt: Date.now()}}, updated: Date.now()});
    const dup = async () => {
      const n = {...U.clone(inv), no: b.nextNumber(ctx, b.codeOf(ctx, inv.client), b.fyOf(today)), date: today, due: U.ymd(U.addDays(U.parseYmd(today), Math.max(0, U.daysBetween(inv.date, inv.due) || 15))), status: 'draft', sentAt: null, sentTo: '', payments: [], chased: [], auto: '', createdAt: Date.now(), updatedAt: Date.now()};
      delete n.id; delete n.fy;
      const id = U.uid();
      await ctx.W.merge('invoices/' + b.fyOf(today), {rows: {[id]: n}, updated: Date.now()}).catch(() => {});
      M.nav('#invoices/' + id);
    };
    const remove = async () => { try { await ctx.W.merge('invoices/' + inv.fy, {rows: {[inv.id]: null}, updated: Date.now()}); } catch (e) { return; } M.toast('Draft deleted'); onBack(); };
    return html`<div class="stack" style=${{gap: '16px'}}>
      <div class="row between">
        <button type="button" class="linky nowrap" id="inv-back" onClick=${onBack}><${icons.chevL}/>All invoices</button>
        <span class="row nowrap" style=${{gap: '8px'}}><${StatusTag} st=${st}/>${inv.auto === 'retainer' ? html`<${UI.Pill}>retainer, drafted for you<//>` : null}</span>
      </div>
      <div class="split">
        <${InvoiceDoc} inv=${inv}/>
        <div class="stack" style=${{gap: '14px'}}>
          <${InvBeam}><${UI.Card} title="This invoice" id="inv-side">
            <div class="stack tight">
              <div class="row between"><span class="small ink62">Total</span><span class="num" style=${{fontWeight: 600}}>${b.money(t.total, inv.currency)}</span></div>
              ${t.tds ? html`<div class="row between"><span class="small ink62">TDS the client deducts</span><span class="num">${b.money(t.tds, inv.currency)}</span></div>` : null}
              <div class="row between"><span class="small ink62">Received</span><span class="num">${b.money(t.paid, inv.currency)}</span></div>
              <div class="row between"><b>Balance</b>${M.fx ? html`<${MetalNum} size=${22} weight=${600} color=${st === 'overdue' ? M.fx.FLAME : undefined}>${b.money(t.balance, inv.currency)}<//>` : html`<b class="num">${b.money(t.balance, inv.currency)}</b>`}</div>
              ${inv.sentAt ? html`<div class="tiny ink62">Sent ${U.timeAgo(inv.sentAt)}${inv.sentTo ? ' to ' + inv.sentTo : ''}${(inv.chased || []).length ? ' · chased ' + inv.chased.length + (inv.chased.length === 1 ? ' time' : ' times') + ', last ' + U.timeAgo(inv.chased[inv.chased.length - 1].at) : ''}</div>` : html`<div class="tiny ink62">A draft. Nothing goes to the client until you send it or mark it sent.</div>`}
              ${st === 'overdue' ? html`<div class="small flame-t">${b.ageOf(inv, today)} days past due.</div>` : null}
            </div>
          <//><//>
          <${UI.Card} title="Do">
            <div class="stack tight">
              ${st !== 'void' && st !== 'paid' ? html`<div class="row">
                ${st === 'draft' ? html`<${UI.Btn} id="inv-send" onClick=${() => setSend('send')}><${icons.send}/>Send to the client<//><${UI.Btn} kind="sec" id="inv-mark-sent" onClick=${() => patch({sentAt: Date.now(), status: 'sent'}).then(() => M.toast('Marked sent'))}>Mark sent<//>`
                  : html`<${UI.Btn} id="inv-chase" onClick=${() => setSend('remind')}><${icons.send}/>Chase now<//><${UI.Btn} kind="sec" id="inv-resend" onClick=${() => setSend('send')}>Send again<//>`}
              </div>` : null}
              <div class="row">
                ${st !== 'void' ? html`<${UI.Btn} kind="sec" sm=${true} id="inv-pay" onClick=${() => setPay(true)}>Record a payment<//>` : null}
                <${UI.Btn} kind="sec" sm=${true} id="inv-edit" onClick=${() => setEdit(true)}>${st === 'draft' ? 'Edit' : 'Edit the details'}<//>
                <${UI.Btn} kind="ghost" sm=${true} id="inv-dup" onClick=${dup}>Duplicate<//>
              </div>
              <div class="row">
                ${st === 'draft' ? html`<${UI.ConfirmBtn} sm=${true} kind="ghost" onConfirm=${remove}>Delete the draft<//>`
                  : st !== 'void' ? html`<${UI.ConfirmBtn} sm=${true} kind="ghost" onConfirm=${() => patch({status: 'void'}).then(() => M.toast('Voided'))}>Void<//>`
                  : html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => patch({status: inv.sentAt ? 'sent' : 'draft'})}>Undo the void<//>`}
              </div>
            </div>
          <//>
          ${(inv.payments || []).length ? html`<${UI.Card} title="Payments">
            ${inv.payments.map((p, i) => html`<div class="listrow" key=${i}><span class="num tiny ink62" style=${{width: '86px'}}>${U.fmtDate(U.ymd(new Date(p.at)))}</span><span class="grow">${p.ref || 'no reference'}${p.note ? ' · ' + p.note : ''}</span><span class="num" style=${{fontWeight: 500}}>${b.money(p.amount, inv.currency)}</span></div>`)}
          <//>` : null}
        </div>
      </div>
      ${edit ? html`<${Builder} inv=${inv} onClose=${() => setEdit(false)} onSaved=${() => setEdit(false)}/>` : null}
      ${pay ? html`<${PayDrawer} inv=${inv} onClose=${() => setPay(false)}/>` : null}
      ${send ? html`<${SendDrawer} inv=${inv} kind=${send} onClose=${() => setSend(null)}/>` : null}
    </div>`;
  }

  /* ---------- the list ---------- */
  function Invoices({id}) {
    const ctx = M.useCtx();
    const b = B();
    const today = U.todayStr();
    const all = b.invoices(ctx);
    const [filter, setFilter] = useState('open');
    const [fy, setFy] = useState('all');
    const [draft, setDraft] = useState(null);
    if (!ctx.isOwner) return html`<${UI.Empty} text="The books are the owner's alone."/>`;
    const open = id ? all.find(i => i.id === id) : null;
    if (id && open) return html`<${InvoiceView} inv=${open} onBack=${() => M.nav('#invoices')}/>`;
    const fys = Array.from(new Set(all.map(i => i.fy))).sort().reverse();
    const list = all.filter(i => (fy === 'all' || i.fy === fy)).filter(i => {
      const st = b.status(i, today);
      if (filter === 'all') return true;
      if (filter === 'open') return ['sent', 'overdue', 'part'].includes(st);
      if (filter === 'overdue') return st === 'overdue' || (st === 'part' && i.due < today);
      return st === filter;
    });
    const sum = list.reduce((s, i) => s + (i.currency === 'INR' || !i.currency ? b.totals(i).balance : b.totals(i).balance * (b.num(i.fx) || 0)), 0);
    const noClients = !Object.keys(ctx.coll.clients.map).length;
    return html`<div class="stack" style=${{gap: '16px'}}>
      <${UI.PageHead} micro=${list.length + (list.length === 1 ? ' invoice' : ' invoices') + (filter === 'open' || filter === 'overdue' ? ', ' + U.inr(sum) + ' outstanding' : '')} title="Invoices">
        <${UI.Btn} id="inv-new" disabled=${noClients} onClick=${() => setDraft(fresh(ctx, ''))}><${icons.plus}/>New invoice<//>
      <//>
      ${(filter === 'open' || filter === 'overdue') && list.length && M.fx ? html`<div class="row nowrap fx-headline" id="inv-outstanding"><span class="micro">${filter === 'overdue' ? 'overdue' : 'outstanding'}</span><${MetalNum} size=${30} weight=${600} color=${filter === 'overdue' ? M.fx.FLAME : undefined}>${U.inr(sum)}<//></div>` : null}
      ${noClients ? html`<div class="card small">Add a client under Accounts first; the invoice takes its legal name, address and currency from the client's billing profile under Setup.</div>` : null}
      <div class="row between">
        <${UI.Seg} sm=${true} options=${FILTERS} value=${filter} onChange=${setFilter} ariaLabel="Which invoices"/>
        ${fys.length > 1 ? html`<${UI.Seg} sm=${true} options=${[{v: 'all', label: 'All years'}].concat(fys.map(x => ({v: x, label: 'FY ' + x})))} value=${fy} onChange=${setFy} ariaLabel="Financial year"/>` : null}
      </div>
      <${UI.Card} id="inv-list">
        ${list.length ? html`<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>number</th><th>client</th><th>date</th><th>due</th><th class="num">total</th><th class="num">balance</th><th>status</th></tr></thead>
          <tbody>${list.map(i => { const st = b.status(i, today), t = b.totals(i); return html`<tr key=${i.id} class="inv-row" style=${{cursor: 'pointer'}} onClick=${() => M.nav('#invoices/' + i.id)}>
            <td data-label="number" class="no">${i.no}</td>
            <td data-label="client">${i.clientName || (i.billTo && i.billTo.legalName) || 'client'}</td>
            <td data-label="date" class="num">${U.fmtDate(i.date)}</td>
            <td data-label="due" class=${'num' + (st === 'overdue' ? ' flame-t' : '')}>${i.due ? U.fmtDate(i.due) : ''}</td>
            <td data-label="total" class="num">${b.money(t.total, i.currency)}</td>
            <td data-label="balance" class="num">${st === 'paid' || st === 'void' ? '' : b.money(t.balance, i.currency)}</td>
            <td data-label="status"><${StatusTag} st=${st}/></td>
          </tr>`; })}</tbody>
        </table></div>` : html`<${UI.Empty} text=${filter === 'all' ? 'No invoices yet. Press New invoice, or set a retainer under Setup and the first of the month drafts it for you.' : 'Nothing here.'}/>`}
      <//>
      ${draft ? html`<${Builder} inv=${draft} onClose=${() => setDraft(null)} onSaved=${nid => { setDraft(null); M.nav('#invoices/' + nid); }}/>` : null}
    </div>`;
  }

  M.invoices = {fresh, mailFor};
  M.parts.InvoiceDoc = InvoiceDoc;
  M.pages.Invoices = Invoices;
})();
