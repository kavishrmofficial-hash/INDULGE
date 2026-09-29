/* module: books watch. The part of the books that runs by itself on the owner's page: a retainer
   drafts its invoice on the billing day, the first of the month copies recurring expenses forward,
   and the owner's inbox carries what the books need a call on (an invoice past due, a retainer draft
   waiting, a compliance date three days out, a letter drafted and not issued). The team site does
   the same drafting on the server and mails the reminders (edgeone/server/books.js); this page marks
   nothing twice because every draft carries the client and the period it is for. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useEffect} = React;

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periodOf = mid => { const [y, m] = mid.split('-').map(Number); return MON[m - 1] + ' ' + y; };

  /* the retainer invoices due for drafting today: one per client per month, on or after the billing day */
  function retainerDrafts(ctx, today) {
    const b = M.books;
    const out = [];
    const book = b.clientBook(ctx);
    const mid = today.slice(0, 7);
    const day = Number(today.slice(8, 10));
    const have = b.invoices(ctx);
    for (const clientId of Object.keys(book)) {
      const p = book[clientId];
      const r = p && p.retainer;
      if (!r || !r.active || !b.num(r.amount) || !ctx.coll.clients.map[clientId]) continue;
      if (day < Math.min(28, Math.max(1, b.num(r.day) || 1))) continue;
      if (have.some(i => i.client === clientId && i.auto === 'retainer' && i.autoPeriod === mid)) continue;
      out.push({clientId, mid});
    }
    return out;
  }
  function draftRetainer(ctx, clientId, mid) {
    const b = M.books;
    const inv = M.invoices.fresh(ctx, clientId);
    const p = b.clientBook(ctx)[clientId];
    inv.period = periodOf(mid);
    inv.lines = [{desc: p.retainer.desc || 'Monthly retainer', note: periodOf(mid), sac: p.retainer.sac || b.settings(ctx).defaults.sac, qty: 1, rate: b.num(p.retainer.amount)}];
    inv.gst = (p.country && p.country !== 'India') ? 'none' : (p.retainer.gst || 'intra');
    inv.auto = 'retainer'; inv.autoPeriod = mid;
    const id = U.uid();
    return ctx.W.merge('invoices/' + b.fyOf(inv.date), {rows: {[id]: inv}, updated: Date.now()});
  }
  /* recurring expenses: the first month without a copy gets one, dated the first */
  function recurringDue(ctx, today) {
    const b = M.books;
    const mid = today.slice(0, 7);
    const all = b.expenses(ctx);
    const out = [];
    const seen = new Set(all.filter(e => e.month === mid).map(e => e.recurFrom || e.id));
    const prev = [...new Set(all.filter(e => e.recurring === 'monthly' && e.month < mid).map(e => e.recurFrom || e.id))];
    for (const key of prev) {
      if (seen.has(key)) continue;
      const src = all.filter(e => (e.recurFrom || e.id) === key).sort((x, y) => y.month.localeCompare(x.month))[0];
      if (src) out.push({key, src, mid});
    }
    return out;
  }

  function BooksWatch() {
    const ctx = M.useCtx();
    const on = !!(ctx && ctx.isOwner && ctx.ready && ctx.coll.books && ctx.coll.books.ready && ctx.coll.invoices && ctx.coll.invoices.ready && ctx.coll.expenses && ctx.coll.expenses.ready && ctx.coll.clients.ready);
    const today = U.todayStr();
    useEffect(() => {
      if (!on || !M.books || !M.invoices) return;
      /* a short wait, so the team site's own pass (which writes the same drafts) lands first */
      const t = setTimeout(async () => {
        const c = M.lastCtx || ctx;
        try {
          for (const d of retainerDrafts(c, today).slice(0, 6)) await draftRetainer(c, d.clientId, d.mid);
          for (const r of recurringDue(c, today).slice(0, 12)) {
            const e = r.src;
            const row = {date: r.mid + '-01', vendor: e.vendor, category: e.category, desc: e.desc || '', amount: e.amount, gstInput: e.gstInput || 0, method: e.method, paid: e.method !== 'due', recurring: 'monthly', receipt: null, recurFrom: r.key, at: Date.now(), updatedAt: Date.now()};
            await c.W.merge('expenses/' + r.mid, {rows: {[U.uid()]: row}, updated: Date.now()});
          }
        } catch (e) { /* the next load tries again */ }
      }, 12000);
      return () => clearTimeout(t);
    }, [on, today, ctx.coll.books, ctx.coll.invoices, ctx.coll.expenses]);
    return null;
  }

  /* the owner's inbox lines from the books */
  function inboxItems(ctx, push) {
    if (!ctx.isOwner || !M.books) return;
    const b = M.books;
    const today = U.todayStr();
    for (const inv of b.invoices(ctx)) {
      const st = b.status(inv, today);
      if (st === 'overdue' || (st === 'part' && inv.due && inv.due < today)) {
        const days = b.ageOf(inv, today);
        if ([1, 3, 7, 14, 30, 45, 60, 90].includes(days) || days > 90) push('bkdue:' + inv.id + ':' + Math.min(days, 91), 'books', U.parseYmd(today).getTime(), 'Invoice ' + inv.no + ', ' + (inv.clientName || 'client') + ', ' + b.money(b.totals(inv).balance, inv.currency) + ' is ' + days + (days === 1 ? ' day' : ' days') + ' past due', '#invoices/' + inv.id, true);
      }
      if (st === 'draft' && inv.auto === 'retainer') push('bkdraft:' + inv.id, 'books', inv.createdAt || 0, 'Retainer invoice ' + inv.no + ' for ' + (inv.clientName || 'client') + ' is drafted. Open it, check it, send it', '#invoices/' + inv.id);
    }
    for (const d of b.nextDates(ctx, today)) {
      const gap = U.daysBetween(today, d.date);
      if (gap >= 0 && gap <= 3) push('bkdate:' + d.date + d.what, 'books', U.parseYmd(today).getTime(), d.what + (gap === 0 ? ' today' : gap === 1 ? ' tomorrow' : ' in ' + gap + ' days') + ', ' + U.fmtDay(d.date), '#books');
    }
    const hrMap = (ctx.coll.hr && ctx.coll.hr.map) || {};
    for (const uid of Object.keys(hrMap)) for (const lid of Object.keys((hrMap[uid] || {}).letters || {})) {
      const l = hrMap[uid].letters[lid];
      if (l && l.status === 'draft' && Date.now() - (l.at || 0) > 86400000) push('bklet:' + lid, 'books', l.at || 0, 'A ' + (l.kind || 'letter') + ' letter for ' + ((l.vars && l.vars.who) || 'someone') + ' has waited a day unsigned', '#letters/' + uid.replace(/^cand:/, ''));
    }
    if (today.slice(8) === '01' || today.slice(8) === '02') {
      const d = U.parseYmd(today); d.setDate(0);
      const mid = U.monthId(d);
      const inFy = b.invoices(ctx).filter(i => !['draft', 'void'].includes(b.status(i, today)) && String(i.date || '').slice(0, 7) === mid);
      const billed = inFy.reduce((s, i) => s + b.totals(i).total * (i.currency === 'INR' || !i.currency ? 1 : b.num(i.fx) || 0), 0);
      const exp = b.expenses(ctx).filter(e => e.month === mid).reduce((s, e) => s + b.num(e.amount), 0);
      push('bkmonth:' + mid, 'books', U.parseYmd(today).getTime(), 'Books for ' + periodOf(mid) + ': billed ' + U.inr(billed) + ', spent ' + U.inr(exp) + '. Open the books for the rest', '#books');
    }
  }

  M.booksWatch = {retainerDrafts, draftRetainer, recurringDue, inboxItems, periodOf};
  M.parts.BooksWatch = BooksWatch;
})();
