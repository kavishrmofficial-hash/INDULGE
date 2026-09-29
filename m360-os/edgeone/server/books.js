/* books: the part of the owner's accounting desk that runs on the server. Two things:
   1. invoicesend: the owner's page hands over a finished invoice mail (or a reminder) and the server
      sends it through Resend and marks the invoice (sent, or one more chase) in the owner's name.
   2. run(): a pass every ten minutes per instance, at the first request after the wait. On a
      retainer's billing day it drafts that month's invoice (one per client per month, the client
      and the period stamped on the draft so no page or instance drafts it twice) and tells the
      owner by mail. When auto-chase is on it sends the reminder steps for overdue invoices, one
      step a day, marking the invoice before the mail goes out.
   The page keeps the same numbers and words (src/js/42-books.js and 43-invoices.js); the defaults
   here are the same defaults, kept short. */

const DEFAULTS = {
  company: {name: 'Mask Management', state: 'Maharashtra', mail: 'accounts@mask360.agency'},
  bank: {holder: 'Mask Management', name: 'Axis Bank', branch: 'Khar (W), Linking Road', account: '922020011472266', ifsc: 'UTIB0000186', iban: '', swift: ''},
  signatory: {who: 'Kaavish Ramchandani', title: 'Chief Alchemist · Mask Management'},
  numbering: {prefix: 'MM'},
  defaults: {terms: '15 days from invoice date (Net 15)', termsDays: 15, sac: '998361', currency: 'INR', gstRate: 18,
    notes: 'Retainer billed 50% in advance and 50% on delivery per the Master Services Agreement.\nThis is a computer-generated invoice.'},
  chase: {auto: false, days: '3,7,14', cc: ''}
};
const CUR = {INR: {sym: '₹', intl: false}, AED: {sym: 'AED ', intl: true}, USD: {sym: '$', intl: true}, EUR: {sym: '€', intl: true}, GBP: {sym: '£', intl: true}, SAR: {sym: 'SAR ', intl: true}};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const deep = (a, b) => {
  const out = {...a};
  for (const k of Object.keys(b || {})) out[k] = (isObj(b[k]) && isObj(a[k])) ? deep(a[k], b[k]) : b[k];
  return out;
};
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/* money the way the page prints it: Indian grouping for rupees, thousands elsewhere */
function fmt(n, cur) {
  const c = CUR[cur] || CUR.INR;
  const v = Math.round(num(n) * 100) / 100;
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  const neg = v < 0;
  const s = (whole && !c.intl ? String(Math.round(Math.abs(v))) : Math.abs(v).toFixed(2));
  const [i, f] = s.split('.');
  let head = i;
  if (!c.intl && i.length > 3) head = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3);
  else head = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + head + (f ? '.' + f : '');
}
const money = (n, cur) => (CUR[cur] || CUR.INR).sym + fmt(n, cur);
const dayMs = ymd => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400000);
const addDays = (ymd, n) => new Date(dayMs(ymd) + n * 86400000).toISOString().slice(0, 10);
const fmtDate = ymd => { if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd || ''; return Number(ymd.slice(8, 10)) + ' ' + MON[Number(ymd.slice(5, 7)) - 1] + ' ' + ymd.slice(0, 4); };
const fyOf = ymd => { const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7)); const a = m >= 4 ? y : y - 1; return a + '-' + String((a + 1) % 100).padStart(2, '0'); };
const lineAmt = l => num(l.qty) * num(l.rate);
function totals(inv) {
  const sub = (inv.lines || []).reduce((s, l) => s + lineAmt(l), 0);
  const rate = num(inv.gstRate == null ? 18 : inv.gstRate);
  const cgst = inv.gst === 'intra' ? sub * rate / 200 : 0, sgst = cgst;
  const igst = inv.gst === 'inter' ? sub * rate / 100 : 0;
  const total = sub + cgst + sgst + igst;
  const paid = (inv.payments || []).reduce((s, p) => s + num(p.amount), 0);
  const tds = num(inv.tds);
  return {sub, cgst, sgst, igst, total, paid, tds, balance: Math.round((total - paid - tds) * 100) / 100};
}
function statusOf(inv, today) {
  if (!inv) return 'draft';
  if (inv.status === 'void') return 'void';
  const t = totals(inv);
  if (t.total > 0 && t.balance <= 0.5) return 'paid';
  if (!inv.sentAt && inv.status !== 'sent') return 'draft';
  if (t.paid > 0) return 'part';
  if (inv.due && inv.due < today) return 'overdue';
  return 'sent';
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function booksDesk(h) {
  const {getJ, docKey, listAll, ownerUid, sendMail, writeAs, ymdIST, levelOf, LEVEL, HttpError, env} = h;
  const EVERY = env && env.BOOKS_RECHECK_MS != null ? Number(env.BOOKS_RECHECK_MS) : 600000;
  let nextAt = 0, busy = false;

  const settings = async () => deep(DEFAULTS, (await getJ(docKey('books/settings')).catch(() => null)) || {});
  const clientBook = async () => (((await getJ(docKey('books/clients')).catch(() => null)) || {}).map) || {};
  /* every invoice document, by financial year */
  const PREFIX = docKey('invoices/x').slice(0, -1);
  async function invoiceDocs() {
    const out = {};
    for (const b of await listAll(PREFIX)) {
      const fy = String(b.key).slice(PREFIX.length);
      if (!/^\d{4}-\d{2}$/.test(fy)) continue;
      const d = await getJ(b.key).catch(() => null);
      if (d && isObj(d.rows)) out[fy] = d;
    }
    return out;
  }
  const flat = docs => { const out = []; for (const fy of Object.keys(docs)) for (const id of Object.keys(docs[fy].rows)) if (docs[fy].rows[id]) out.push({...docs[fy].rows[id], id, fy}); return out; };
  const codeOf = (prof, client) => {
    if (prof && prof.code) return String(prof.code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN';
    const init = String((client && client.name) || '').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().replace(/[^A-Z]/g, '');
    return init.slice(0, 3) || 'GEN';
  };
  const nextNumber = (s, all, code, fy) => {
    const head = s.numbering.prefix + '/' + fy + '/' + code + '-';
    let max = 0;
    for (const inv of all) { if (inv.fy !== fy || !String(inv.no || '').startsWith(head)) continue; const n = Number(String(inv.no).slice(head.length)) || 0; if (n > max) max = n; }
    return head + String(max + 1).padStart(3, '0');
  };

  /* the reminder mail, the same words the page uses */
  function reminder(s, inv, today) {
    const t = totals(inv);
    const who = inv.billTo && inv.billTo.contactName ? String(inv.billTo.contactName).split(' ')[0] : 'there';
    const amt = money(t.balance, inv.currency);
    const late = inv.due ? daysBetween(inv.due, today) : 0;
    const subject = 'Reminder: invoice ' + inv.no + ', ' + amt + (late > 0 ? ', ' + late + ' days past due' : '');
    const bank = ['A/C name: ' + s.bank.holder, 'Bank: ' + s.bank.name + (s.bank.branch ? ', ' + s.bank.branch : ''), 'A/C no: ' + s.bank.account, 'IFSC: ' + s.bank.ifsc].concat(s.bank.iban ? ['IBAN: ' + s.bank.iban] : []).concat(s.bank.swift ? ['SWIFT: ' + s.bank.swift] : []);
    const p1 = 'A gentle reminder that invoice ' + inv.no + ' for ' + amt + ' was due on ' + fmtDate(inv.due) + (late > 0 ? ' and is ' + late + ' days past due.' : '.');
    const p2 = 'Could you let us know when it is scheduled for payment? If it has already gone out, please share the reference and we will close it on our side.';
    const text = ['Hi ' + who + ',', '', p1, p2, '', 'Bank details for the transfer:', ...bank, '', 'Thank you,', s.signatory.who, s.signatory.title, s.company.mail].join('\n');
    const html = '<p>' + esc('Hi ' + who + ',') + '</p><p>' + esc(p1) + '</p><p>' + esc(p2) + '</p>' +
      '<p><b>Bank details</b><br>' + bank.map(esc).join('<br>') + '</p>' +
      '<p>' + esc(s.signatory.who) + '<br><span style="color:#BBBBBB">' + esc(s.signatory.title) + ' · ' + esc(s.company.mail) + '</span></p>';
    return {subject, text, html};
  }

  const actions = {
    /* the owner's page sends an invoice or a reminder; the server mails it and marks the invoice */
    async invoicesend(v, body, req) {
      const owner = await ownerUid();
      if (!v || !owner || v.uid !== owner) throw new HttpError(403, 'not_granted');
      const fy = String(body.fy || ''), id = String(body.id || '');
      if (!/^\d{4}-\d{2}$/.test(fy) || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new HttpError(400, 'invalid_argument', 'no invoice');
      const to = String(body.to || '').trim();
      if (!MAIL_RE.test(to)) throw new HttpError(400, 'invalid_argument', 'Enter the address to send it to');
      const cc = String(body.cc || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => x && x !== to && MAIL_RE.test(x)).slice(0, 5);
      const subject = String(body.subject || '').trim().slice(0, 200);
      const text = String(body.text || '').slice(0, 20000);
      const htmlBody = String(body.html || '').slice(0, 80000);
      const kind = body.kind === 'remind' ? 'remind' : 'send';
      if (!subject || !text) throw new HttpError(400, 'invalid_argument', 'The mail needs a subject and a body');
      const doc = await getJ(docKey('invoices/' + fy)).catch(() => null);
      const inv = doc && isObj(doc.rows) ? doc.rows[id] : null;
      if (!inv) throw new HttpError(404, 'not_found', 'That invoice is not in the books');
      if (inv.status === 'void') throw new HttpError(400, 'failed_precondition', 'A void invoice does not go out');
      const sent = await sendMail(to, subject, text, htmlBody || '<pre style="white-space:pre-wrap;font:inherit">' + esc(text) + '</pre>', req && req.site, {cc});
      if (!sent) throw new HttpError(400, 'failed_precondition', 'Mail is not set up. Add the Resend key under Setup.');
      const now = Date.now();
      const row = {...inv, updatedAt: now};
      if (kind === 'remind') row.chased = (Array.isArray(inv.chased) ? inv.chased : []).concat([{at: now, step: 'hand', via: 'mail', to}]);
      else { row.sentAt = inv.sentAt || now; row.sentTo = to; if (!inv.status || inv.status === 'draft') row.status = 'sent'; }
      await writeAs(owner, 'invoices/' + fy, {...doc, rows: {...doc.rows, [id]: row}, updated: now}, (kind === 'remind' ? 'reminder for ' : 'sent ') + (inv.no || id));
      return {ok: true, sentAt: row.sentAt || null, chased: (row.chased || []).length};
    }
  };

  /* the daily pass: retainer drafts and auto-chase */
  async function run(site) {
    if (Date.now() < nextAt || busy) return;
    busy = true;
    try {
      nextAt = Date.now() + EVERY;
      const owner = await ownerUid();
      if (!owner) return;
      const today = ymdIST(Date.now());
      const [s, book] = await Promise.all([settings(), clientBook()]);
      const ids = Object.keys(book).filter(cid => { const r = book[cid] && book[cid].retainer; return r && r.active && num(r.amount) > 0; });
      const chase = s.chase && s.chase.auto;
      if (!ids.length && !chase) return;
      const docs = await invoiceDocs();
      const all = flat(docs);
      const mid = today.slice(0, 7), day = Number(today.slice(8, 10));
      const ownerP = await getJ('p/' + owner).catch(() => null);
      /* retainer drafts */
      for (const cid of ids.slice(0, 12)) {
        const p = book[cid], r = p.retainer;
        if (day < Math.min(28, Math.max(1, num(r.day) || 1))) continue;
        if (all.some(i => i.client === cid && i.auto === 'retainer' && i.autoPeriod === mid)) continue;
        const client = await getJ(docKey('clients/' + cid)).catch(() => null);
        if (!client) continue;
        const fy = fyOf(today);
        const days = p.termsDays ? num(p.termsDays) : s.defaults.termsDays;
        const abroad = !!(p.country && p.country !== 'India');
        const period = MON[Number(mid.slice(5, 7)) - 1] + ' ' + mid.slice(0, 4);
        const inv = {
          no: nextNumber(s, all, codeOf(p, client), fy), client: cid, clientName: p.legalName || client.name || '',
          billTo: {legalName: p.legalName || client.name || '', address: p.address || '', country: p.country || 'India', taxId: p.taxId || '', contactEmail: p.contactEmail || '', contactName: p.contactName || ''},
          date: today, due: addDays(today, days), period, currency: p.currency || s.defaults.currency,
          gst: abroad ? 'none' : (r.gst || 'intra'), gstRate: s.defaults.gstRate, reverse: abroad, place: abroad ? p.country : (s.company.state || ''),
          lines: [{desc: r.desc || 'Monthly retainer', note: period, sac: r.sac || s.defaults.sac, qty: 1, rate: num(r.amount)}],
          tds: 0, tdsNote: '', status: 'draft', sentAt: null, sentTo: '', payments: [], chased: [], notes: s.defaults.notes,
          terms: days === s.defaults.termsDays ? s.defaults.terms : days + ' days from invoice date (Net ' + days + ')',
          fx: '', auto: 'retainer', autoPeriod: mid, createdAt: Date.now(), updatedAt: Date.now()
        };
        /* the freshest copy of the year's document, so a draft the page made a moment ago stays */
        const cur = (await getJ(docKey('invoices/' + fy)).catch(() => null)) || {rows: {}};
        const rows = isObj(cur.rows) ? cur.rows : {};
        if (Object.keys(rows).some(k => rows[k] && rows[k].client === cid && rows[k].auto === 'retainer' && rows[k].autoPeriod === mid)) continue;
        const id = uid();
        await writeAs(owner, 'invoices/' + fy, {...cur, rows: {...rows, [id]: inv}, updated: Date.now()}, 'retainer draft ' + inv.no);
        all.push({...inv, id, fy});
        docs[fy] = {...cur, rows: {...rows, [id]: inv}};
        if (ownerP && ownerP.email) {
          const line = 'Retainer invoice ' + inv.no + ' for ' + inv.clientName + ', ' + money(totals(inv).total, inv.currency) + ', is drafted for ' + period + '. Open the books, check it, send it.';
          await sendMail(ownerP.email, 'Retainer invoice drafted: ' + inv.clientName, line, '<p>' + esc(line) + '</p>', site).catch(() => {});
        }
      }
      /* auto-chase: one step a day per overdue invoice, the mark before the mail */
      if (chase) {
        const steps = String(s.chase.days || '').split(/[,\s]+/).map(x => num(x)).filter(x => x > 0).sort((a, b) => a - b);
        const cc = String(s.chase.cc || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => MAIL_RE.test(x)).slice(0, 5);
        let sentToday = 0;
        for (const inv of all) {
          if (sentToday >= 20 || !steps.length) break;
          const st = statusOf(inv, today);
          if (st !== 'overdue' && !(st === 'part' && inv.due && inv.due < today)) continue;
          const to = inv.billTo && inv.billTo.contactEmail;
          if (!to || !MAIL_RE.test(to)) continue;
          const late = daysBetween(inv.due, today);
          const chased = Array.isArray(inv.chased) ? inv.chased : [];
          if (chased.some(c => c && ymdIST(num(c.at)) === today)) continue;
          const done = new Set(chased.filter(c => c && c.step !== 'hand').map(c => num(c.step)));
          const step = steps.filter(x => x <= late && !done.has(x)).pop();
          if (!step) continue;
          const cur = (await getJ(docKey('invoices/' + inv.fy)).catch(() => null)) || {rows: {}};
          const live = isObj(cur.rows) ? cur.rows[inv.id] : null;
          if (!live || statusOf(live, today) === 'paid' || live.status === 'void') continue;
          const now = Date.now();
          const row = {...live, chased: (Array.isArray(live.chased) ? live.chased : []).concat([{at: now, step, via: 'auto', to}]), updatedAt: now};
          await writeAs(owner, 'invoices/' + inv.fy, {...cur, rows: {...cur.rows, [inv.id]: row}, updated: now}, 'auto chase ' + step + ' for ' + (inv.no || inv.id));
          const m = reminder(s, live, today);
          await sendMail(to, m.subject, m.text, m.html, site, {cc}).catch(() => {});
          sentToday++;
        }
      }
    } catch (e) { if (env && env.BOOKS_DEBUG) console.error('books pass', e); /* the next pass tries again */ }
    finally { busy = false; }
  }

  return {actions, run};
}
