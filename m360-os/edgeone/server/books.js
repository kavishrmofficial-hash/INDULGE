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

/* the model reads mail, attachments and statements for the books; JSON in, JSON out */
const MODEL = 'claude-sonnet-5';
const MINE_SYSTEM = 'BOOKS MINE. You read a company\'s mail about one client and pick out the billing details for that client. Reply with JSON only, one object: {"legalName": "", "address": "", "country": "", "taxId": "", "contactName": "", "contactEmail": "", "currency": "", "termsDays": 0, "po": "", "note": ""}. legalName is the registered name that should print on an invoice to them (the payer, not us). address is their billing address, lines separated by newlines. country is the country of that address. taxId is their GSTIN (India, 15 characters) or VAT or TRN number. contactName and contactEmail are the accounts payable person who receives invoices. currency is the ISO code they pay in. termsDays is the payment terms in days when stated. po is the latest purchase order number. Leave a field empty ("" or 0) when the mail does not say; never guess, never invent, never use our own company details. note is one short sentence on what you read and anything unsure.';
const STATEMENT_SYSTEM = 'BOOKS STATEMENT. You read a bank or card statement and list every transaction. Reply with JSON only: {"rows": [{"date": "yyyy-mm-dd", "vendor": "", "desc": "", "amount": 0, "credit": 0, "method": "bank", "ref": ""}]}. amount is the money out (debit, positive number, 0 when the line is money in); credit is the money in (positive, 0 otherwise). vendor is the merchant or person the line names, cleaned of UPI, NEFT, IMPS, POS prefixes and reference numbers; desc is the narration as printed. method is upi, card, cash or bank from the narration. ref is the transaction or cheque reference. Keep the order of the statement. Skip opening and closing balance lines.';
const CAT_SYSTEM = 'BOOKS CATEGORIES. You sort a marketing agency\'s expenses into categories. The only categories are: Salaries, Rent, Software and tools, Freelancers, Production, Travel, Meals and client, Marketing, Professional fees, Bank and taxes, Equipment, Other. Reply with JSON only: {"categories": ["...", ...]} with exactly one category per row, in the same order as the rows given.';
const jsonOut = txt => { const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } };
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const strip = htmlIn => String(htmlIn || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();

export function booksDesk(h) {
  const {getJ, docKey, listAll, ownerUid, sendMail, writeAs, ymdIST, levelOf, LEVEL, HttpError, env, aiKey, google} = h;
  const MAX_FILE = 3 * 1024 * 1024;
  /* one question to the model, the answer parsed as JSON */
  async function ask(system, content, maxTokens) {
    const key = aiKey ? await aiKey() : null;
    if (!key) throw new HttpError(403, 'not_granted', 'AI is off. Add the key under Admin.');
    const r = await (env.fetch || fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({model: MODEL, max_tokens: maxTokens || 2048, system, messages: [{role: 'user', content}]})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(r.status === 429 ? 429 : 502, r.status === 429 ? 'rate_limited' : 'unavailable', (j && j.error && j.error.message) || 'model error');
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    const out = jsonOut(text);
    if (!out) throw new HttpError(502, 'invalid_json', 'The reading came back scrambled. Try again.');
    return out;
  }
  const owner = async v => { const o = await ownerUid(); if (!v || !o || v.uid !== o) throw new HttpError(403, 'not_granted'); return o; };
  const fileBlock = (mime, data, name) => {
    if (/^application\/pdf/i.test(mime) || /\.pdf$/i.test(name || '')) return {type: 'document', source: {type: 'base64', media_type: 'application/pdf', data}, title: String(name || 'file').slice(0, 80)};
    if (/^image\/(png|jpeg|jpg|gif|webp)/i.test(mime)) return {type: 'image', source: {type: 'base64', media_type: mime.replace('jpg', 'jpeg').toLowerCase(), data}};
    return null;
  };
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

  /* ---------- reading the owner's mail for a client's billing details ---------- */
  actions.booksmine = async function booksmine(v, body) {
    await owner(v);
    if (!google || !google.gapi) throw new HttpError(403, 'google_off', 'Google is not set up.');
    const cid = String(body.clientId || '');
    if (!/^[A-Za-z0-9_.:@+-]{1,120}$/.test(cid)) throw new HttpError(400, 'invalid_argument', 'no client');
    const client = await getJ(docKey('clients/' + cid)).catch(() => null);
    if (!client) throw new HttpError(404, 'not_found', 'That client is not in Accounts');
    const nameQ = '"' + String(client.name || '').replace(/["\\]/g, '').slice(0, 80) + '"';
    const book = (((await getJ(docKey('books/clients')).catch(() => null)) || {}).map || {})[cid] || {};
    const domain = String(book.contactEmail || '').split('@')[1] || String(client.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
    const words = '(invoice OR billing OR GSTIN OR GST OR "purchase order" OR PO OR "vendor registration" OR "bank details" OR "tax invoice" OR payment OR "accounts payable")';
    const queries = [nameQ + ' ' + words + ' newer_than:3y'].concat(domain ? ['from:' + domain + ' ' + words + ' newer_than:3y'] : []);
    const ids = [];
    for (const qq of queries) {
      const list = await google.gapi(v.uid, google.GM + '/messages?' + new URLSearchParams({q: qq, maxResults: '12'}).toString()).catch(() => ({}));
      for (const m of (list.messages || [])) if (!ids.includes(m.id)) ids.push(m.id);
      if (ids.length >= 16) break;
    }
    const content = [];
    const sources = [];
    let files = 0, bytes = 0;
    const header = (m, k) => { const hh = ((m.payload || {}).headers || []).find(x => String(x.name).toLowerCase() === k.toLowerCase()); return hh ? String(hh.value) : ''; };
    for (const id of ids.slice(0, 16)) {
      const m = await google.gapi(v.uid, google.GM + '/messages/' + encodeURIComponent(id) + '?format=full').catch(() => null);
      if (!m) continue;
      let text = '', htmlBody = '';
      const atts = [];
      const walk = p => {
        if (!p) return;
        const mime = String(p.mimeType || '');
        const data = p.body && p.body.data ? strip(atobUrl(p.body.data)) : '';
        if (mime === 'text/plain' && data && !text) text = data;
        else if (mime === 'text/html' && p.body && p.body.data && !htmlBody) htmlBody = strip(atobUrl(p.body.data));
        if (p.filename && p.body && p.body.attachmentId) atts.push({name: p.filename, mime, id: p.body.attachmentId, size: p.body.size || 0});
        (p.parts || []).forEach(walk);
      };
      walk(m.payload);
      const subject = header(m, 'Subject'), from = header(m, 'From'), date = header(m, 'Date');
      const bodyText = (text || htmlBody || m.snippet || '').slice(0, 5000);
      content.push({type: 'text', text: 'MAIL from ' + from + ', ' + date + ', subject: ' + subject + '\n' + bodyText});
      sources.push({subject: subject.slice(0, 80), from: from.slice(0, 80), date: date.slice(0, 40), file: ''});
      for (const a of atts) {
        if (files >= 5 || a.size > MAX_FILE || bytes + a.size > 6 * MAX_FILE) continue;
        if (!/pdf|image/i.test(a.mime) && !/\.(pdf|png|jpe?g)$/i.test(a.name)) continue;
        const att = await google.gapi(v.uid, google.GM + '/messages/' + encodeURIComponent(id) + '/attachments/' + encodeURIComponent(a.id)).catch(() => null);
        if (!att || !att.data) continue;
        const block = fileBlock(a.mime, String(att.data).replace(/-/g, '+').replace(/_/g, '/'), a.name);
        if (!block) continue;
        content.push({type: 'text', text: 'ATTACHMENT ' + a.name + ' from the mail above:'});
        content.push(block);
        files++; bytes += a.size;
        sources.push({subject: subject.slice(0, 80), from: from.slice(0, 80), date: date.slice(0, 40), file: a.name.slice(0, 60)});
      }
    }
    /* Drive, when the connection allows reading files: documents named after the client */
    if (files < 5) {
      const r = await google.gapi(v.uid, google.DRIVE + '/files?' + new URLSearchParams({q: "name contains '" + String(client.name || '').replace(/['\\]/g, '').slice(0, 60) + "' and trashed = false and (mimeType = 'application/pdf' or mimeType contains 'image/')", orderBy: 'modifiedTime desc', pageSize: '6', fields: 'files(id,name,mimeType,size)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'}).toString()).catch(() => null);
      for (const f of ((r && r.files) || [])) {
        if (files >= 5 || Number(f.size) > MAX_FILE) continue;
        const raw = await google.gapi(v.uid, google.DRIVE + '/files/' + encodeURIComponent(f.id) + '?alt=media&supportsAllDrives=true', {raw: true}).catch(() => null);
        if (!raw) continue;
        const block = fileBlock(f.mimeType, raw, f.name);
        if (!block) continue;
        content.push({type: 'text', text: 'DRIVE FILE ' + f.name + ':'});
        content.push(block);
        files++;
        sources.push({subject: 'Drive', from: '', date: '', file: String(f.name).slice(0, 60)});
      }
    }
    if (!content.length) return {found: {}, sources: [], note: 'No mail or file about ' + (client.name || 'this client') + ' mentions billing.'};
    content.unshift({type: 'text', text: 'THE CLIENT: ' + (client.name || '') + (domain ? ' (' + domain + ')' : '') + '. OUR COMPANY (never the answer): Mask Management, Mask360, mask360.agency.'});
    const out = await ask(MINE_SYSTEM, content, 1500);
    const found = {};
    for (const k of ['legalName', 'address', 'country', 'taxId', 'contactName', 'contactEmail', 'currency', 'po']) if (out[k] && typeof out[k] === 'string' && out[k].trim()) found[k] = out[k].trim().slice(0, 400);
    if (Number(out.termsDays) > 0) found.termsDays = Math.min(180, Math.round(Number(out.termsDays)));
    if (found.contactEmail && !MAIL_RE.test(found.contactEmail)) delete found.contactEmail;
    if (found.currency && !/^[A-Z]{3}$/.test(found.currency)) delete found.currency;
    if (found.taxId && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(found.taxId) && !found.country) found.country = 'India';
    return {found, sources, note: String(out.note || '').slice(0, 300)};
  };
  const atobUrl = s => { try { const bin = atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new TextDecoder().decode(u8); } catch (e) { return ''; } };

  /* ---------- a bank statement into rows ---------- */
  actions.bookstatement = async function bookstatement(v, body) {
    await owner(v);
    const data = String(body.data || '');
    const name = String(body.name || 'statement').slice(0, 120);
    const type = String(body.type || '').toLowerCase();
    if (!data || data.length > 5.6 * 1024 * 1024) throw new HttpError(400, 'invalid_argument', 'Statements up to 4 MB.');
    const content = [];
    if (/pdf/.test(type) || /\.pdf$/i.test(name)) content.push({type: 'document', source: {type: 'base64', media_type: 'application/pdf', data}, title: name});
    else if (/image\/(png|jpeg|jpg)/.test(type)) content.push({type: 'image', source: {type: 'base64', media_type: type.replace('jpg', 'jpeg'), data}});
    else {
      let text = '';
      try { text = new TextDecoder().decode(Uint8Array.from(atob(data), c => c.charCodeAt(0))); } catch (e) { text = ''; }
      if (!text.trim()) throw new HttpError(400, 'invalid_argument', 'That file is not a statement m360 can read.');
      content.push({type: 'text', text: 'STATEMENT ' + name + ':\n' + text.slice(0, 120000)});
    }
    content.push({type: 'text', text: 'List every transaction as JSON.'});
    const out = await ask(STATEMENT_SYSTEM, content, 8000);
    const rows = (Array.isArray(out.rows) ? out.rows : []).slice(0, 600).map(r => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')) ? r.date : '', vendor: String(r.vendor || '').slice(0, 120), desc: String(r.desc || '').slice(0, 300),
      amount: Math.max(0, num(r.amount)), credit: Math.max(0, num(r.credit)), method: ['upi', 'card', 'cash', 'bank'].includes(String(r.method)) ? r.method : 'bank', ref: String(r.ref || '').slice(0, 60)
    })).filter(r => r.date && (r.amount > 0 || r.credit > 0));
    return {rows};
  };

  /* ---------- categories for rows the books have not seen ---------- */
  actions.bookscategorize = async function bookscategorize(v, body) {
    await owner(v);
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 200).map(r => ({vendor: String((r && r.vendor) || '').slice(0, 120), desc: String((r && r.desc) || '').slice(0, 200), amount: num(r && r.amount)}));
    if (!rows.length) return {categories: []};
    const out = await ask(CAT_SYSTEM, [{type: 'text', text: 'ROWS:\n' + rows.map((r, i) => (i + 1) + '. ' + r.vendor + (r.desc ? ' | ' + r.desc : '') + ' | ' + r.amount).join('\n')}], 4000);
    const CATS = ['Salaries', 'Rent', 'Software and tools', 'Freelancers', 'Production', 'Travel', 'Meals and client', 'Marketing', 'Professional fees', 'Bank and taxes', 'Equipment', 'Other'];
    const cats = (Array.isArray(out.categories) ? out.categories : []).map(c => CATS.includes(c) ? c : 'Other');
    while (cats.length < rows.length) cats.push('Other');
    return {categories: cats.slice(0, rows.length)};
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
