/* module: expenses. What the company spends, with three ways in: a sheet you type straight into
   (Tab, Enter and the arrows move like a spreadsheet, a paste from Excel or Sheets fills across and
   down), the single-row drawer for phones and receipts, and a bank statement (CSV, XLSX or PDF)
   that the page reads, cleans, categorises and dedupes before it lands in the books. Rows live in
   expenses/<yyyy-mm>.rows. Owner only. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  /* a number in metal (metal-fx MetalText) */
  const MetalNum = ({children, size, weight, color}) => html`<span class="fx-num"><${M.fx.MetalText} size=${size} weight=${weight} color=${color}>${children}<//></span>`;
  const {useState, useEffect, useMemo, useRef} = React;

  const CATS = ['Salaries', 'Rent', 'Software and tools', 'Freelancers', 'Production', 'Travel', 'Meals and client', 'Marketing', 'Professional fees', 'Bank and taxes', 'Equipment', 'Other'];
  const METHODS = [{v: 'bank', label: 'Bank transfer'}, {v: 'card', label: 'Card'}, {v: 'upi', label: 'UPI'}, {v: 'cash', label: 'Cash'}, {v: 'due', label: 'Not paid yet'}];
  const REPEATS = [{v: '', label: 'Once'}, {v: 'monthly', label: 'Every month'}];
  const B = () => M.books;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = mid => { const [y, m] = mid.split('-').map(Number); return MON[m - 1] + ' ' + y; };
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const hasApi = () => typeof window.M360_API === 'function';
  const num = v => B().num(v);

  const blank = () => ({date: U.todayStr(), vendor: '', category: 'Software and tools', desc: '', amount: '', gstInput: '', method: 'bank', recurring: '', receipt: null});

  /* ---------- reading text: dates, amounts, categories ---------- */
  const MONS = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12};
  const mk = (y, m, d) => {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += 2000;
    if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    return y + '-' + U.pad(m) + '-' + U.pad(d);
  };
  const serial = n => { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000); return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1) + '-' + U.pad(d.getUTCDate()); };
  function parseDate(v) {
    if (v == null) return '';
    if (typeof v === 'number') return v > 20000 && v < 80000 ? serial(v) : '';
    const s = String(v).trim();
    if (!s) return '';
    let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return mk(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) return mk(m[3], m[2], m[1]);
    if ((m = s.match(/^(\d{1,2})[\s\-\/]*([a-z]{3,9})[\s\-\/,]*(\d{2,4})/i)) && MONS[m[2].toLowerCase().slice(0, 3)]) return mk(m[3], MONS[m[2].toLowerCase().slice(0, 3)], m[1]);
    if ((m = s.match(/^([a-z]{3,9})[\s\-\/]+(\d{1,2})[\s,\-\/]+(\d{2,4})/i)) && MONS[m[1].toLowerCase().slice(0, 3)]) return mk(m[3], MONS[m[1].toLowerCase().slice(0, 3)], m[2]);
    if (/^\d{5}(\.\d+)?$/.test(s)) return serial(Number(s));
    return '';
  }
  /* an amount cell from a statement: "1,23,456.78", "(1,234)", "1,234 Dr", "-1234" */
  function amt(v) {
    if (typeof v === 'number') return {v, tag: ''};
    const s = String(v == null ? '' : v).trim();
    if (!s) return {v: 0, tag: ''};
    const tag = (s.match(/\b(dr|cr|debit|credit)\b\.?$/i) || [])[1] || '';
    const neg = /^\(.*\)$/.test(s) || /^-|-\s*$/.test(s.replace(/[a-z.]/gi, '').trim());
    const n = Number(s.replace(/[^0-9.]/g, ''));
    return {v: Number.isFinite(n) ? (neg ? -n : n) : 0, tag: tag.toLowerCase().slice(0, 2)};
  }
  const cleanAmount = v => { const n = amt(v).v; return n ? String(Math.abs(n)) : ''; };
  function snapCat(text) {
    const t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return undefined;
    return CATS.find(c => c.toLowerCase() === t) || CATS.find(c => c.toLowerCase().startsWith(t))
      || CATS.find(c => c.toLowerCase().split(/\s+/).some(w => w !== 'and' && (w === t || w.startsWith(t) || t.startsWith(w)))) || 'Other';
  }
  function snapMethod(text) {
    const t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return undefined;
    const m = METHODS.find(x => x.v === t || x.label.toLowerCase() === t || x.label.toLowerCase().startsWith(t));
    if (m) return m.v;
    if (/neft|imps|rtgs|transfer|net ?bank|account/.test(t)) return 'bank';
    if (/card|visa|master|amex|rupay|pos/.test(t)) return 'card';
    if (/upi|gpay|phonepe|paytm/.test(t)) return 'upi';
    if (/cash/.test(t)) return 'cash';
    if (/due|unpaid|not paid|pending|later/.test(t)) return 'due';
    return undefined;
  }
  function snapRepeat(text) {
    const t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return undefined;
    if (/month|yes|recur|repeat|every|true/.test(t)) return 'monthly';
    if (/once|no|one|false|never/.test(t)) return '';
    return undefined;
  }
  const guessMethod = s => { const t = String(s || '').toLowerCase(); return /\bupi\b|gpay|phonepe|paytm|bhim|@/.test(t) ? 'upi' : /\bpos\b|card|visa|master|rupay|amex|ecom|e-com/.test(t) ? 'card' : /\batm\b|cash wdl|cash withdrawal/.test(t) ? 'cash' : 'bank'; };

  /* the merchant or the name out of a bank narration: prefixes, reference numbers and codes go */
  const STOP = new Set(['upi', 'neft', 'imps', 'rtgs', 'pos', 'ach', 'nach', 'ecs', 'atm', 'bil', 'tpt', 'inf', 'mmt', 'ft', 'chq', 'emi', 'ib', 'mb', 'dr', 'cr', 'payment', 'payments', 'paid', 'transfer', 'to', 'from', 'by', 'ref', 'txn', 'utr', 'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yesb', 'yes', 'idfc', 'indb', 'bank', 'oth', 'p2m', 'p2a', 'okaxis', 'okhdfcbank', 'okicici', 'oksbi', 'ybl', 'ptaxis', 'ptyes', 'apl', 'fbl', 'in', 'ind', 'india', 'pvt', 'ltd', 'limited', 'private']);
  const codeish = w => /^\d+$/.test(w) || /x{3,}/i.test(w) || (/\d/.test(w) && /[a-z]/i.test(w) && w.length >= 6) || w.includes('@');
  function cleanVendor(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const parts = s.split(/\s*[\/|\-:~]\s*/).map(p => p.trim()).filter(Boolean);
    /* codes go anywhere; bank words and legal suffixes go only from the edges, so a name keeps its middle */
    const stop = w => STOP.has(w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const score = p => {
      const words = p.split(/\s+/).filter(w => w && !codeish(w));
      while (words.length && stop(words[0])) words.shift();
      while (words.length && stop(words[words.length - 1])) words.pop();
      return words.join(' ');
    };
    let best = '';
    for (const p of parts) {
      if (/@/.test(p) || /^\d+$/.test(p)) continue;
      const w = score(p);
      if (w && /[a-z]{2}/i.test(w) && w.length > best.length && best.length < 4) best = w;
      if (best.length >= 4) break;
    }
    if (!best) best = score(s) || s;
    best = best.replace(/[.,;]+$/, '').replace(/\s+/g, ' ').trim().slice(0, 48);
    if (best && best === best.toUpperCase()) best = best.toLowerCase().replace(/(^|\s)([a-z])/g, (a, sp, ch) => sp + ch.toUpperCase());
    return best || s.slice(0, 48);
  }
  const vendorKey = v => cleanVendor(v).toLowerCase().replace(/[^a-z0-9]/g, '');

  const KEYWORDS = [
    [/google ads|meta ads|facebook ads|adwords|instagram ads|linkedin ads|sponsor|advert|promot/, 'Marketing'],
    [/\brent\b|landlord|lease|coworking|wework|awfis/, 'Rent'],
    [/adobe|figma|canva|google|notion|slack|zoom|microsoft|openai|anthropic|github|dropbox|apple\.com|chatgpt|midjourney|envato|godaddy|hostinger|namecheap|cloudflare|vercel|netlify|jiofiber|airtel|vodafone|broadband|aws|amazon web|hubspot|mailchimp|apollo|ahrefs|semrush|elevenlabs|runway|frame\.io|vimeo|wix|squarespace/, 'Software and tools'],
    [/salary|salaries|payroll|wages|stipend/, 'Salaries'],
    [/uber|\bola\b|indigo|air ?india|vistara|akasa|spicejet|irctc|hotel|\boyo\b|makemytrip|\bmmt\b|goibibo|cleartrip|redbus|rapido|ixigo|airport|taxi|\bcab\b|airline|flight/, 'Travel'],
    [/zomato|swiggy|restaurant|cafe|coffee|starbucks|domino|pizza|\bfood\b|dine|kitchen|bakery|blinkit|zepto|bar\b|brewery|eatery/, 'Meals and client'],
    [/\bgst\b|\btds\b|income tax|bank charge|bank chg|service charge|sms chg|annual fee|late fee|penalty|\binterest\b|cgst|sgst|igst|advance tax|\bchrg|\bcharges\b|professional tax|\bpt\b|\bepf|\besic|challan/, 'Bank and taxes'],
    [/freelanc|upwork|fiverr|contractor|editor|photograph|videograph|voice ?over|writer|designer/, 'Freelancers'],
    [/\bca\b|chartered|legal|advocate|lawyer|consult|audit|accountant|registrar|\bmca\b|trademark|notary/, 'Professional fees'],
    [/croma|reliance digital|apple store|\bdell\b|\bhp\b|lenovo|laptop|monitor|macbook|iphone|electronics|amazon|flipkart|furniture|ikea/, 'Equipment'],
    [/print|studio|shoot|rental|props|production|location|crew|makeup|stylist|talent|model/, 'Production'],
  ];
  const keywordCat = (vendor, desc) => { const t = (String(vendor || '') + ' ' + String(desc || '')).toLowerCase(); const hit = KEYWORDS.find(k => k[0].test(t)); return hit ? hit[1] : ''; };

  /* ---------- delimited text: paste and CSV ---------- */
  function parseDelimited(text, delim) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim()));
  }
  function sniffDelim(text) {
    const head = text.split(/\r?\n/).slice(0, 25).join('\n');
    const n = ch => (head.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
    if (n('\t')) return '\t';
    return n(';') > n(',') ? ';' : ',';
  }
  /* pasted text: null for a single value (the browser pastes it), else a grid */
  function gridOf(text) {
    const t = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!t) return null;
    if (t.includes('\t')) return t.split('\n').map(l => l.split('\t'));
    if (!t.includes('\n')) return null;
    return parseDelimited(t, sniffDelim(t));
  }

  /* ---------- a statement table: which column is which ---------- */
  const HEAD = [
    ['drcr', /dr\s*\/\s*cr|cr\s*\/\s*dr|^type$|^dr\s*cr$|debit\s*\/\s*credit|^\s*d\s*\/\s*c\s*$/i],
    ['balance', /balance|\bbal\b/i],
    ['date', /\bdate\b|\bdt\b/i],
    ['debit', /debit|withdraw|paid\s*out|money\s*out|outflow|\bdr\b/i],
    ['credit', /credit|deposit|paid\s*in|money\s*in|inflow|\bcr\b/i],
    ['amount', /amount|\bamt\b|\bvalue\b/i],
    ['desc', /desc|narration|particular|detail|remark|memo|payee|merchant|transaction|beneficiary/i],
    ['ref', /\bref|cheque|chq|\butr\b|txn\s*id|transaction\s*id|\bid\b/i],
  ];
  function findColumns(cells) {
    const cols = {};
    cells.forEach((c, i) => {
      const t = String(c == null ? '' : c).trim();
      if (!t) return;
      for (const [k, re] of HEAD) {
        if (!re.test(t)) continue;
        if (k === 'date' && cols.date != null && !/txn|trans|posting/i.test(t)) return;
        if (k === 'date' && cols.date != null) { cols.date = i; return; }
        if (cols[k] == null) cols[k] = i;
        return;
      }
    });
    if (cols.date == null || cols.desc == null || (cols.debit == null && cols.amount == null)) return null;
    return cols;
  }
  /* rows of cells (strings or numbers) to statement lines; null when the columns cannot be found */
  function linesFromTable(rows) {
    let head = -1, cols = null;
    for (let i = 0; i < Math.min(rows.length, 40) && !cols; i++) { cols = findColumns(rows[i]); if (cols) head = i; }
    if (!cols) return null;
    const out = [];
    let signed = false;
    for (const cells of rows.slice(head + 1)) {
      const date = parseDate(cells[cols.date]);
      if (!date) continue;
      const desc = String(cells[cols.desc] == null ? '' : cells[cols.desc]).replace(/\s+/g, ' ').trim();
      let debit = 0, credit = 0, fromAmount = false;
      if (cols.debit != null) debit = Math.abs(amt(cells[cols.debit]).v);
      if (cols.credit != null) credit = Math.abs(amt(cells[cols.credit]).v);
      if (!debit && !credit && cols.amount != null) {
        const a = amt(cells[cols.amount]);
        const tag = (cols.drcr != null ? String(cells[cols.drcr] == null ? '' : cells[cols.drcr]) : a.tag).trim().toLowerCase();
        fromAmount = true;
        if (/^(dr|debit|d|withdrawal|out|w)\b/.test(tag)) { debit = Math.abs(a.v); signed = true; }
        else if (/^(cr|credit|c|deposit|in)\b/.test(tag)) { credit = Math.abs(a.v); signed = true; }
        else if (a.v < 0) { debit = -a.v; signed = true; }
        else credit = a.v;
      }
      if (!debit && !credit) continue;
      out.push({date, desc, amount: debit, credit, fromAmount, ref: cols.ref != null ? String(cells[cols.ref] == null ? '' : cells[cols.ref]).trim() : ''});
    }
    /* an amount column with no sign anywhere is a card statement: every line is money out */
    if (!signed) for (const l of out) if (l.fromAmount && l.credit && !l.amount) { l.amount = l.credit; l.credit = 0; }
    return out.map(l => ({date: l.date, vendor: cleanVendor(l.desc), desc: l.desc, amount: l.amount, credit: l.credit, method: guessMethod(l.desc), ref: l.ref}));
  }

  /* ---------- XLSX on the page: the zip, the shared strings, the first sheet ---------- */
  async function inflate(bytes, method) {
    if (method === 0) return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream !== 'function') throw new Error('no inflate');
    const ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
  }
  async function unzip(buf, wanted) {
    const b = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip');
    const count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    const entries = [];
    let p = cdOff;
    for (let i = 0; i < count && p + 46 <= b.length; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
      entries.push({name, method, csize, loc});
      p += 46 + nlen + elen + clen;
    }
    const out = {};
    for (const e of entries) {
      if (!wanted(e.name)) continue;
      const ln = dv.getUint16(e.loc + 26, true), le = dv.getUint16(e.loc + 28, true), start = e.loc + 30 + ln + le;
      out[e.name] = await inflate(b.subarray(start, start + e.csize), e.method);
    }
    return out;
  }
  const unxml = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (a, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
  const colIndex = ref => { let n = 0; for (const ch of (ref.match(/^[A-Z]+/) || [''])[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return Math.max(0, n - 1); };
  async function parseXlsx(buf) {
    const files = await unzip(buf, n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    const sheetName = Object.keys(files).filter(n => n.startsWith('xl/worksheets/')).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))[0];
    if (!sheetName) throw new Error('no sheet');
    const shared = [];
    for (const m of String(files['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unxml((m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
    const rows = [];
    for (const rm of files[sheetName].matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const cm of rm[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = cm[1], inner = cm[2] || '';
        const ref = (at.match(/\br="([A-Z]+)\d+"/) || [])[1] || '';
        const type = (at.match(/\bt="([^"]+)"/) || [])[1] || 'n';
        let v = '';
        if (type === 's') v = shared[Number((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1])] || '';
        else if (type === 'inlineStr') v = unxml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
        else { const raw = unxml((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || ''); v = type === 'n' && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw; }
        cells[ref ? colIndex(ref) : cells.length] = v;
      }
      if (cells.some(c => c !== undefined && String(c).trim() !== '')) rows.push(Array.from(cells, c => c === undefined ? '' : c));
    }
    return rows;
  }
  const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(file); });

  /* ---------- the sheet ---------- */
  const COLS = ['date', 'vendor', 'category', 'desc', 'amount', 'gstInput', 'method', 'recurring'];
  const COL_LABEL = {date: 'date', vendor: 'paid to', category: 'category', desc: 'what for', amount: 'amount', gstInput: 'GST paid', method: 'paid by', recurring: 'repeats'};
  const COL_W = {date: '110px', category: '138px', amount: '96px', gstInput: '84px', method: '118px', recurring: '96px'};
  const CELL = {padding: '6px 8px', minHeight: '34px', fontSize: '13px', borderRadius: '8px', fontWeight: 400};
  const CELL_SEL = {...CELL, paddingRight: '24px', backgroundPosition: 'right 6px center'};
  const CELL_NUM = {...CELL, textAlign: 'right'};
  const norm = (f, v) => f === 'amount' || f === 'gstInput' ? num(v) : String(v == null ? '' : v).trim();
  const coerce = (f, v) => f === 'date' ? (parseDate(v) || String(v).trim()) : f === 'category' ? snapCat(v) : f === 'method' ? snapMethod(v) : f === 'recurring' ? snapRepeat(v)
    : (f === 'amount' || f === 'gstInput') ? cleanAmount(v) : String(v == null ? '' : v).trim();
  const isBlank = r => !String(r.vendor || '').trim() && !num(r.amount);
  const isValid = r => !!(String(r.vendor || '').trim() && num(r.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')));

  function Sheet({month, saved, vendors, onDirty}) {
    const ctx = M.useCtx();
    const phone = M.usePhone();
    const seq = useRef(0);
    const root = useRef(null);
    const pending = useRef(null);
    const newKey = () => '+' + (++seq.current);
    const [edits, setEdits] = useState({});
    const [extra, setExtra] = useState(() => [newKey(), newKey(), newKey()]);
    const [busy, setBusy] = useState(false);
    const today = U.todayStr();
    const defaultDate = today.slice(0, 7) === month ? today : month + '-01';
    const savedMap = useMemo(() => { const m = {}; for (const r of saved) m[r.id] = r; return m; }, [saved]);
    const keys = saved.map(r => r.id).concat(extra);
    const rowOf = key => { const s = savedMap[key]; const e = edits[key] || {}; return s ? {...s, ...e} : {...blank(), date: defaultDate, ...e, id: null}; };
    const changed = key => { const s = savedMap[key]; const e = edits[key] || {}; if (!s) return !isBlank(rowOf(key)); return Object.keys(e).some(f => norm(f, e[f]) !== norm(f, s[f])); };
    const dirty = keys.filter(changed);
    useEffect(() => { onDirty && onDirty(dirty.length); }, [dirty.length]);
    /* always three blank rows waiting at the bottom; the updater counts against the latest state, so
       a burst of keystrokes adds rows once */
    const editsRef = useRef(edits); editsRef.current = edits;
    useEffect(() => {
      setExtra(x => { const e = editsRef.current; const empty = x.filter(k => isBlank(e[k] || {})).length; return empty >= 3 ? x : x.concat(Array.from({length: 3 - empty}, newKey)); });
    }, [edits, extra]);
    useEffect(() => { if (pending.current) { const p = pending.current; pending.current = null; focusCell(p.r, p.c); } });

    const setCell = (key, f, v) => setEdits(prev => ({...prev, [key]: {...(prev[key] || {}), [f]: v}}));
    const revert = (key, f) => setEdits(prev => { const cur = {...(prev[key] || {})}; delete cur[f]; return {...prev, [key]: cur}; });
    const dropRow = key => { setEdits(prev => { const n = {...prev}; delete n[key]; return n; }); setExtra(x => x.filter(k => k !== key)); };
    const focusCell = (r, c) => {
      c = Math.max(0, Math.min(COLS.length - 1, c));
      if (r < 0) return;
      const el = root.current && root.current.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
      if (el) { el.focus(); if (el.tagName === 'INPUT') el.select(); return; }
      if (r >= keys.length) { pending.current = {r, c}; setExtra(x => x.concat(Array.from({length: r - keys.length + 1}, newKey))); }
    };
    const onKey = (e, r, c, key, f) => {
      const t = e.target, sel = t.tagName === 'SELECT', k = e.key;
      if (k === 'Tab') {
        if (e.shiftKey) { if (c > 0) { e.preventDefault(); focusCell(r, c - 1); } else if (r > 0) { e.preventDefault(); focusCell(r - 1, COLS.length - 1); } }
        else { e.preventDefault(); if (c < COLS.length - 1) focusCell(r, c + 1); else focusCell(r + 1, 0); }
        return;
      }
      if (k === 'Enter') { e.preventDefault(); focusCell(r + 1, c); return; }
      if (k === 'Escape') { e.preventDefault(); revert(key, f); return; }
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); focusCell(r + (k === 'ArrowDown' ? 1 : -1), c); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        if (!sel) { const s = t.selectionStart, en = t.selectionEnd; if (s !== en) return; if (k === 'ArrowLeft' && s > 0) return; if (k === 'ArrowRight' && en < t.value.length) return; }
        e.preventDefault(); focusCell(r, c + (k === 'ArrowRight' ? 1 : -1));
      }
    };
    const fill = (r0, c0, grid) => {
      const ks = keys.slice(), fresh = [];
      while (ks.length < r0 + grid.length) { const k = newKey(); ks.push(k); fresh.push(k); }
      setEdits(prev => {
        const nx = {...prev};
        grid.forEach((line, i) => {
          const key = ks[r0 + i]; const cur = {...(nx[key] || {})};
          line.forEach((v, j) => { const c = c0 + j; if (c >= COLS.length) return; const val = coerce(COLS[c], v); if (val !== undefined) cur[COLS[c]] = val; });
          nx[key] = cur;
        });
        return nx;
      });
      if (fresh.length) setExtra(x => x.concat(fresh));
    };
    const onPaste = (e, r, c, key, f) => {
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!text) return;
      const grid = gridOf(text);
      if (!grid) { if (e.target.tagName === 'SELECT' || f === 'date' || f === 'amount' || f === 'gstInput') { e.preventDefault(); const v = coerce(f, text); if (v !== undefined) setCell(key, f, v); } return; }
      e.preventDefault(); fill(r, c, grid);
    };
    const save = async () => {
      if (busy || !dirty.length) return;
      const byMonth = {};
      let n = 0, skipped = 0;
      const now = Date.now();
      const done = [];
      for (const key of dirty) {
        const r = rowOf(key);
        if (isBlank(r)) continue;
        if (!isValid(r)) { skipped++; continue; }
        const s = savedMap[key];
        const mid = r.date.slice(0, 7);
        const id = s ? s.id : U.uid();
        if (s && s.month !== mid) { byMonth[s.month] = byMonth[s.month] || {}; byMonth[s.month][id] = null; }
        const doc = {date: r.date, vendor: String(r.vendor).trim(), category: CATS.includes(r.category) ? r.category : 'Other', desc: String(r.desc || '').trim(), amount: num(r.amount), gstInput: num(r.gstInput),
          method: r.method || 'bank', paid: r.method !== 'due', recurring: r.recurring === 'monthly' ? 'monthly' : '', receipt: (s && s.receipt) || null, at: (s && s.at) || now, updatedAt: now};
        if (s && s.recurFrom) doc.recurFrom = s.recurFrom;
        if (s && s.source) doc.source = s.source;
        if (s && s.ref) doc.ref = s.ref;
        byMonth[mid] = byMonth[mid] || {}; byMonth[mid][id] = doc;
        done.push(key); n++;
      }
      if (!n) { M.toast(skipped ? 'Each row needs a name in paid to and an amount' : 'Nothing to save', true); return; }
      setBusy(true);
      try {
        for (const mid of Object.keys(byMonth)) await ctx.W.merge('expenses/' + mid, {rows: byMonth[mid], updated: now});
        setEdits(prev => { const nx = {...prev}; for (const k of done) delete nx[k]; return nx; });
        setExtra(x => x.filter(k => !done.includes(k)));
        M.toast('Saved ' + n + (n === 1 ? ' row' : ' rows') + (skipped ? '. Skipped ' + skipped + (skipped === 1 ? ' row that needs' : ' rows that need') + ' a name and an amount' : ''), !!skipped);
      } catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const remove = async key => { const s = savedMap[key]; if (!s) return; try { await ctx.W.merge('expenses/' + s.month, {rows: {[key]: null}, updated: Date.now()}); } catch (e) { return; } dropRow(key); M.toast('Removed'); };

    const cellProps = (r, c, key, f) => ({'data-r': r, 'data-c': c, onKeyDown: e => onKey(e, r, c, key, f), onPaste: e => onPaste(e, r, c, key, f)});
    /* phones: 16px type and a thumb's height, so iOS never zooms the page into a field */
    const PH = {fontSize: '16px', minHeight: '44px', padding: '10px 12px'};
    const cell = phone ? {...CELL, ...PH} : CELL;
    const cellSel = phone ? {...CELL_SEL, ...PH, paddingRight: '28px'} : CELL_SEL;
    const cellNum = phone ? {...CELL_NUM, ...PH} : CELL_NUM;
    const input = (r, c, key, row, f) => {
      const p = cellProps(r, c, key, f);
      const v = row[f];
      if (f === 'category') return html`<select class="input" style=${cellSel} value=${v} aria-label=${COL_LABEL[f]} ...${p} onChange=${e => setCell(key, f, e.target.value)}>${CATS.map(x => html`<option key=${x} value=${x}>${x}</option>`)}</select>`;
      if (f === 'method') return html`<select class="input" style=${cellSel} value=${v || 'bank'} aria-label=${COL_LABEL[f]} ...${p} onChange=${e => setCell(key, f, e.target.value)}>${METHODS.map(x => html`<option key=${x.v} value=${x.v}>${x.label}</option>`)}</select>`;
      if (f === 'recurring') return html`<select class="input" style=${cellSel} value=${v || ''} aria-label=${COL_LABEL[f]} ...${p} onChange=${e => setCell(key, f, e.target.value)}>${REPEATS.map(x => html`<option key=${x.v} value=${x.v}>${x.label}</option>`)}</select>`;
      const money = f === 'amount' || f === 'gstInput';
      const shown = v == null ? '' : (money && v === 0 ? '' : String(v));
      return html`<input class=${'input' + (money ? ' num' : '')} style=${money ? cellNum : cell} type="text" inputMode=${money ? 'decimal' : undefined}
        list=${f === 'vendor' ? 'exp-vendors' : undefined} placeholder=${f === 'date' ? 'yyyy-mm-dd' : f === 'vendor' ? 'paid to' : f === 'desc' ? 'what for' : ''} value=${shown} aria-label=${COL_LABEL[f]} ...${p}
        onInput=${e => setCell(key, f, e.target.value)} onBlur=${f === 'date' ? e => { const d = parseDate(e.target.value); if (d && d !== e.target.value) setCell(key, f, d); } : undefined}/>`;
    };
    const rows = keys.map((key, r) => { const row = rowOf(key); const isDirty = changed(key); return {key, r, row, isDirty, bad: isDirty && !isBlank(row) && !isValid(row), saved: !!savedMap[key]}; });
    const shownTotal = rows.reduce((s, x) => s + (isBlank(x.row) ? 0 : num(x.row.amount)), 0);
    const shownGst = rows.reduce((s, x) => s + (isBlank(x.row) ? 0 : num(x.row.gstInput)), 0);
    const count = rows.filter(x => !isBlank(x.row)).length;
    const trash = x => x.saved ? html`<${UI.ConfirmBtn} kind="ghost" label="Sure?" onConfirm=${() => remove(x.key)}><${icons.trash}/><//>`
      : x.isDirty ? html`<button type="button" class="iconbtn" tabIndex=${-1} title="Clear this row" aria-label="Clear this row" onClick=${() => dropRow(x.key)}><${icons.x}/></button>` : null;
    const saveBtn = html`<${UI.Btn} sm=${true} id="exp-sheet-save" disabled=${!dirty.length || busy} onClick=${save}>${dirty.length ? 'Save ' + dirty.length + (dirty.length === 1 ? ' change' : ' changes') : 'Save changes'}<//>`;
    const foot = html`<div class="row between" style=${{marginTop: '12px', gap: '8px'}}>
      <span class="small">${count ? html`<span class="ink62">${count + (count === 1 ? ' row' : ' rows') + ' in ' + monthLabel(month) + ', total '}</span><b class="num">${U.inr(shownTotal)}</b>${shownGst ? html`<span class="ink62">, GST paid <span class="num">${U.inr(shownGst)}</span></span>` : null}` : html`<span class="ink62">Type into the blank rows, or paste rows from Excel or Google Sheets.</span>`}</span>
      ${saveBtn}
    </div>
    <datalist id="exp-vendors">${vendors.map(v => html`<option key=${v} value=${v}/>`)}</datalist>`;

    if (phone) return html`<div ref=${root} id="exp-sheet" class="stack">
      ${rows.map(x => html`<div key=${x.key} class="stack tight" style=${{border: '1px solid var(--line)', borderLeft: x.bad ? '3px solid var(--flame)' : '1px solid var(--line)', borderRadius: '14px', padding: '12px'}}>
        <div style=${{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
          <div class="field"><label>date</label>${input(x.r, 0, x.key, x.row, 'date')}</div>
          <div class="field"><label>amount</label>${input(x.r, 4, x.key, x.row, 'amount')}</div>
        </div>
        <div class="field"><label>paid to</label>${input(x.r, 1, x.key, x.row, 'vendor')}</div>
        <div style=${{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
          <div class="field"><label>category</label>${input(x.r, 2, x.key, x.row, 'category')}</div>
          <div class="field"><label>paid by</label>${input(x.r, 6, x.key, x.row, 'method')}</div>
        </div>
        <div class="field"><label>what for</label>${input(x.r, 3, x.key, x.row, 'desc')}</div>
        <div style=${{display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end'}}>
          <div class="field"><label>GST paid</label>${input(x.r, 5, x.key, x.row, 'gstInput')}</div>
          <div class="field"><label>repeats</label>${input(x.r, 7, x.key, x.row, 'recurring')}</div>
          <div>${trash(x)}</div>
        </div>
      </div>`)}
      ${foot}
    </div>`;

    return html`<div ref=${root} id="exp-sheet">
      <div class="tbl-wrap"><table class="tbl" style=${{minWidth: '860px', tableLayout: 'fixed'}}>
        <thead><tr>${COLS.map(f => html`<th key=${f} class=${f === 'amount' || f === 'gstInput' ? 'num' : ''} style=${{width: COL_W[f], padding: '6px 4px', textAlign: f === 'amount' || f === 'gstInput' ? 'right' : 'left'}}>${COL_LABEL[f]}</th>`)}<th style=${{width: '46px', padding: '6px 4px'}}></th></tr></thead>
        <tbody>${rows.map(x => html`<tr key=${x.key}>
          ${COLS.map((f, c) => html`<td key=${f} data-label=${COL_LABEL[f]} style=${{padding: '4px 3px', borderLeft: c === 0 ? (x.bad ? '3px solid var(--flame)' : '3px solid transparent') : undefined}}>${input(x.r, c, x.key, x.row, f)}</td>`)}
          <td style=${{padding: '4px 3px', textAlign: 'center'}}>${trash(x)}</td>
        </tr>`)}</tbody>
      </table></div>
      ${foot}
    </div>`;
  }

  /* ---------- the single-row drawer: phones and receipts ---------- */
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
      if (f.recurFrom) doc.recurFrom = f.recurFrom;
      try {
        if (row && row.month && row.month !== month) await ctx.W.merge('expenses/' + row.month, {rows: {[id]: null}, updated: Date.now()});
        await ctx.W.merge('expenses/' + month, {rows: {[id]: doc}, updated: Date.now()});
        M.toast('Saved'); onClose();
      } catch (e) { M.toast('Could not save', true); setBusy(false); }
    };
    const remove = async () => { try { await ctx.W.merge('expenses/' + row.month, {rows: {[row.id]: null}, updated: Date.now()}); } catch (e) { return; } M.toast('Removed'); onClose(); };
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
          <${UI.Select} label="repeats" value=${f.recurring} options=${REPEATS} onChange=${v => set('recurring', v)}/></div>
        <div class="row">
          <label class="btn sec sm">${f.receipt ? 'Change the receipt' : 'Attach a receipt'}<input type="file" accept="image/*,.pdf" style=${{display: 'none'}} onChange=${attach}/></label>
          ${f.receipt ? html`<span class="small">${f.receipt.filename || 'receipt'}</span><button type="button" class="linky small" onClick=${() => set('receipt', null)}>Remove</button>` : null}
        </div>
      </div>
    <//>`;
  }

  /* ---------- a bank statement in ---------- */
  const monthsText = mids => {
    const byYear = {};
    for (const m of Array.from(new Set(mids)).sort()) { const y = m.slice(0, 4); (byYear[y] = byYear[y] || []).push(MON[Number(m.slice(5, 7)) - 1]); }
    const join = xs => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
    return join(Object.keys(byYear).map(y => join(byYear[y]) + ' ' + y));
  };
  function ImportDrawer({all, onClose}) {
    const ctx = M.useCtx();
    const [st, setSt] = useState('pick');
    const [note, setNote] = useState('');
    const [lines, setLines] = useState([]);
    const [credits, setCredits] = useState([]);
    const [summary, setSummary] = useState('');
    const [busy, setBusy] = useState(false);
    const known = useMemo(() => {
      const m = {};
      for (const e of all) { const k = vendorKey(e.vendor); if (k && !m[k] && CATS.includes(e.category)) m[k] = e.category; }
      return m;
    }, [all]);
    const savedKeys = useMemo(() => new Set(all.map(e => e.date + '|' + num(e.amount) + '|' + vendorKey(e.vendor))), [all]);

    const prepare = async rows => {
      const debits = rows.filter(r => num(r.amount) > 0);
      const ins = rows.filter(r => !(num(r.amount) > 0) && num(r.credit) > 0);
      let unknown = [];
      const out = debits.map((r, i) => {
        const vendor = r.vendor || cleanVendor(r.desc) || 'Unknown';
        const dup = savedKeys.has(r.date + '|' + num(r.amount) + '|' + vendorKey(vendor));
        let category = known[vendorKey(vendor)] || keywordCat(vendor, r.desc);
        if (!category) { unknown.push(i); category = 'Other'; }
        return {i, date: r.date, vendor, desc: r.desc || '', amount: num(r.amount), method: r.method || guessMethod(r.desc), ref: r.ref || '', category, on: !dup, dup};
      });
      let line = '';
      if (unknown.length && hasApi()) {
        try {
          const batch = unknown.slice(0, 200);
          const res = await window.M360_API('bookscategorize', {rows: batch.map(i => ({vendor: out[i].vendor, desc: out[i].desc, amount: out[i].amount}))});
          const cats = (res && res.categories) || [];
          batch.forEach((i, j) => { if (CATS.includes(cats[j])) out[i].category = cats[j]; });
          unknown = unknown.filter(i => out[i].category === 'Other');
        } catch (e) { line = 'The categoriser did not answer, so ' + unknown.length + ' rows are filed under Other for now.'; }
      } else if (unknown.length) line = unknown.length + (unknown.length === 1 ? ' row is' : ' rows are') + ' filed under Other. Pick a category here, or upload on the team site and AI names them.';
      setLines(out); setCredits(ins); setNote(line); setSt('review');
    };
    const server = async file => {
      if (!hasApi()) { setNote(file.name.toLowerCase().endsWith('.pdf') ? 'PDF statements read on the team site' : 'These columns are not ones the page can read. The team site reads it with AI.'); setSt('pick'); return; }
      if (file.size > 4 * 1024 * 1024) { setNote('Statements up to 4 MB.'); setSt('pick'); return; }
      const data = await toBase64(file);
      const res = await window.M360_API('bookstatement', {name: file.name, type: file.type || '', data});
      const rows = (res && res.rows) || [];
      if (!rows.length) { setNote('Nothing readable in that file.'); setSt('pick'); return; }
      await prepare(rows.map(r => ({date: parseDate(r.date) || '', vendor: r.vendor || '', desc: r.desc || '', amount: num(r.amount), credit: num(r.credit), method: r.method || '', ref: r.ref || ''})).filter(r => r.date));
    };
    const pick = async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file) return;
      setSt('busy'); setNote(''); setSummary('');
      const lower = file.name.toLowerCase();
      try {
        let rows = null;
        if (lower.endsWith('.csv') || lower.endsWith('.txt') || /csv|text\/plain/.test(file.type || '')) {
          const text = await file.text();
          rows = linesFromTable(parseDelimited(text.replace(/^﻿/, ''), sniffDelim(text)));
        } else if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
          try { rows = linesFromTable(await parseXlsx(await file.arrayBuffer())); } catch (err) { rows = null; }
        }
        if (rows && rows.length) await prepare(rows);
        else await server(file);
      } catch (err) { setNote('Could not read that file.'); setSt('pick'); }
    };
    const setLine = (i, patch) => setLines(ls => ls.map(l => l.i === i ? {...l, ...patch} : l));
    const picked = lines.filter(l => l.on);
    const save = async () => {
      if (busy || !picked.length) return;
      setBusy(true);
      const now = Date.now();
      const byMonth = {};
      for (const l of picked) {
        const mid = l.date.slice(0, 7);
        byMonth[mid] = byMonth[mid] || {};
        byMonth[mid][U.uid()] = {date: l.date, vendor: String(l.vendor).trim() || 'Unknown', category: CATS.includes(l.category) ? l.category : 'Other', desc: l.desc, amount: l.amount, gstInput: 0, method: l.method, paid: true, recurring: '', receipt: null, source: 'statement', ref: l.ref, at: now, updatedAt: now};
      }
      try {
        for (const mid of Object.keys(byMonth)) await ctx.W.merge('expenses/' + mid, {rows: byMonth[mid], updated: now});
        const mids = Object.keys(byMonth);
        setSummary('Added ' + picked.length + (picked.length === 1 ? ' expense' : ' expenses') + (mids.length === 1 ? ' to ' : ' across ') + monthsText(mids) + '.');
        setSt('done'); M.toast('Added ' + picked.length + ' to the books');
      } catch (e) { M.toast('Could not save', true); }
      setBusy(false);
    };
    const total = picked.reduce((s, l) => s + l.amount, 0);
    const pickBtn = html`<label class="btn sec sm">Choose a file<input type="file" id="exp-import-file" accept=".csv,.xlsx,.xlsm,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style=${{display: 'none'}} onChange=${pick}/></label>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Upload a bank statement" head=${M.fx ? html`<span class="fx-head-bot"><${M.fx.Bot} feature="books" state=${st === 'busy' ? 'working' : 'default'} size=${28} label=${st === 'busy' ? 'm360, reading' : 'm360 books'}/></span>` : null}
      footer=${st === 'review' ? html`<div class="row between grow"><span class="small ink62">${picked.length} ticked, <span class="num">${U.inr(total)}</span></span><${UI.Btn} id="exp-import-save" disabled=${!picked.length || busy} onClick=${save}>Add ${picked.length} ${picked.length === 1 ? 'expense' : 'expenses'}<//></div>` : html`<${UI.Btn} kind="sec" onClick=${onClose}>Close<//>`}>
      <div class="stack" id="exp-import-drawer">
        ${st === 'pick' ? html`<div class="stack tight">
          <div class="small">A CSV or XLSX export from net banking is read right here. A PDF statement, or a CSV the page cannot follow, goes to the team site where AI reads it.</div>
          <div class="row">${pickBtn}</div>
          ${note ? html`<div class="small flame-t">${note}</div>` : null}
          <div class="tiny ink62">Money out becomes expenses. Money in is listed apart and never added. A line already in the books stays unticked.</div>
        </div>` : null}
        ${st === 'busy' ? html`<div class="small ink62 row nowrap" style=${{gap: '8px'}}>${M.fx ? html`<${M.fx.Orb} state="searching" size=${20} label="reading"/>` : null}<span>Reading the statement</span></div>` : null}
        ${st === 'review' ? html`<div class="stack tight">
          <div class="row between"><span class="small">${lines.length} ${lines.length === 1 ? 'payment' : 'payments'} found. Untick what should stay out.</span>${pickBtn}</div>
          ${note ? html`<div class="tiny ink62">${note}</div>` : null}
          <div id="exp-import-rows">
            ${lines.length ? lines.map(l => html`<div class="listrow" key=${l.i} data-key=${l.i} style=${{alignItems: 'flex-start', opacity: l.on ? 1 : 0.62}}>
              <label class="checkline" style=${{paddingTop: '8px'}}><input type="checkbox" checked=${l.on} onChange=${e => setLine(l.i, {on: e.target.checked})}/><span class="tiny num ink62" style=${{minWidth: '84px'}}>${U.fmtDate(l.date)}</span></label>
              <div class="grow stack tight" style=${{gap: '6px'}}>
                <div class="row nowrap" style=${{gap: '8px'}}>
                  <input class="input" style=${CELL} value=${l.vendor} aria-label="paid to" onInput=${e => setLine(l.i, {vendor: e.target.value})}/>
                  <b class="num" style=${{whiteSpace: 'nowrap'}}>${U.inr(l.amount)}</b>
                </div>
                <div class="row nowrap" style=${{gap: '8px'}}>
                  <select class="input" style=${CELL_SEL} value=${l.category} aria-label="category" onChange=${e => setLine(l.i, {category: e.target.value})}>${CATS.map(c => html`<option key=${c} value=${c}>${c}</option>`)}</select>
                  <select class="input" style=${{...CELL_SEL, maxWidth: '140px'}} value=${l.method} aria-label="paid by" onChange=${e => setLine(l.i, {method: e.target.value})}>${METHODS.filter(m => m.v !== 'due').map(m => html`<option key=${m.v} value=${m.v}>${m.label}</option>`)}</select>
                </div>
                <div class="tiny ink62" style=${{overflowWrap: 'anywhere'}}>${l.desc}${l.dup ? html` <${UI.Pill} kind="flame-o">already in the books<//>` : null}</div>
              </div>
            </div>`) : html`<${UI.Empty} text="No money out in this statement."/>`}
          </div>
          ${credits.length ? html`<div class="stack tight" style=${{marginTop: '8px'}}>
            <${UI.Micro} plain=${true}>money in, not expenses<//>
            ${credits.map((c, i) => html`<div class="listrow" key=${i} style=${{padding: '6px 0'}}><span class="tiny num ink62" style=${{minWidth: '84px'}}>${U.fmtDate(c.date)}</span><span class="grow tiny" style=${{overflowWrap: 'anywhere'}}>${c.vendor || cleanVendor(c.desc)}</span><span class="num small">${U.inr(c.credit)}</span></div>`)}
          </div>` : null}
        </div>` : null}
        ${st === 'done' ? html`<div class="stack tight"><div id="exp-import-summary" class="small">${summary}</div><div class="row">${pickBtn}</div></div>` : null}
      </div>
    <//>`;
  }

  /* ---------- the page ---------- */
  function Expenses({id}) {
    const ctx = M.useCtx();
    const b = B();
    const all = b.expenses(ctx);
    const [month, setMonth] = useState(() => U.monthId(new Date(ctx.now)));
    const [open, setOpen] = useState(null);
    const [importing, setImporting] = useState(false);
    const [dirtyN, setDirtyN] = useState(0);
    const phone = M.usePhone();
    if (!ctx.isOwner) return html`<${UI.Empty} text="The books are the owner's alone."/>`;
    const nowMid = U.monthId(new Date(ctx.now));
    const prev = new Date(ctx.now); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
    const months = Array.from(new Set(all.map(e => e.month).concat([nowMid, U.monthId(prev)]))).sort().reverse();
    const list = all.filter(e => e.month === month).sort((x, y) => String(x.date).localeCompare(String(y.date)) || (x.at || 0) - (y.at || 0));
    const total = list.reduce((s, e) => s + b.num(e.amount), 0);
    const gst = list.reduce((s, e) => s + b.num(e.gstInput), 0);
    const byCat = {};
    for (const e of list) byCat[e.category] = (byCat[e.category] || 0) + b.num(e.amount);
    const cats = Object.keys(byCat).sort((x, y) => byCat[y] - byCat[x]);
    const vendors = Array.from(new Set(all.map(e => String(e.vendor || '').trim()).filter(Boolean))).sort();
    const csv = async () => {
      const lines = [['date', 'paid to', 'category', 'what for', 'amount', 'gst paid', 'paid by', 'paid', 'repeats'].join(',')]
        .concat(list.map(e => [e.date, e.vendor, e.category, e.desc, e.amount, e.gstInput || 0, e.method, e.paid ? 'yes' : 'no', e.recurring || ''].map(csvCell).join(',')));
      const r = await ctx.downloads.save({filename: 'expenses-' + month + '.csv', data: lines.join('\n')});
      M.toast(r && r.status === 'delivered' ? 'Sent' : 'Downloaded');
    };
    return html`<div class="stack" style=${{gap: '16px'}}>
      <${UI.PageHead} micro=${monthLabel(month) + ', ' + U.inr(total) + (gst ? ', GST paid ' + U.inr(gst) : '')} title="Expenses">
        <${UI.Btn} kind="sec" id="exp-import" onClick=${() => setImporting(true)}><${icons.upload}/>Upload a bank statement<//>
        <${UI.Btn} id="exp-new" onClick=${() => setOpen({})}><${icons.plus}/>New expense<//>
      <//>
      <div class="row between">
        <${UI.Seg} sm=${true} options=${months.slice(0, 8).map(m => ({v: m, label: monthLabel(m)}))} value=${month} onChange=${setMonth} ariaLabel="Month"/>
        ${ctx.downloads && list.length ? html`<${UI.Btn} kind="sec" sm=${true} id="exp-csv" onClick=${csv}>Download the month<//>` : null}
      </div>
      <${UI.Card} id="exp-list" title=${phone ? undefined : 'The sheet'} action=${phone ? undefined : html`<div class="row" style=${{gap: '8px'}}><span class="tiny ink62">Tab, Enter and the arrows move. Paste rows from Excel or Sheets.</span>${dirtyN ? html`<${UI.Pill} kind="flame-o">${dirtyN} unsaved<//>` : null}</div>`}>
        <${Sheet} key=${month} month=${month} saved=${list} vendors=${vendors} onDirty=${setDirtyN}/>
      <//>
      <div class="grid2">
        <${UI.Card} title="By category" id="exp-cats">
          ${cats.length ? cats.map(c => html`<div class="listrow" key=${c}><span class="grow">${c}</span><span class="num" style=${{fontWeight: 500}}>${U.inr(byCat[c])}</span></div>`) : html`<${UI.Empty} text="Nothing saved this month yet. Salaries land here from a closed payroll run; rent and tools can repeat every month."/>`}
          ${cats.length ? html`<div class="listrow"><b class="grow">Total</b>${M.fx ? html`<${MetalNum} size=${22} weight=${600}>${U.inr(Object.values(byCat).reduce((s, v) => s + v, 0))}<//>` : html`<b class="num">${U.inr(Object.values(byCat).reduce((s, v) => s + v, 0))}</b>`}</div>` : null}
        <//>
        <${UI.Card} title="Three ways in">
          <div class="listrow"><span class="grow small"><b>Type it.</b> The sheet above takes rows straight in. Tab moves right, Enter moves down, Escape puts a cell back.</span></div>
          <div class="listrow"><span class="grow small"><b>Paste it.</b> Copy rows from Excel or Google Sheets and paste into any cell. Dates like 12/09/2026 and categories typed as words are read.</span></div>
          <div class="listrow"><span class="grow small"><b>Upload the statement.</b> A CSV or XLSX from net banking is read here. A PDF goes to the team site, where AI names each line.</span></div>
        <//>
      </div>
      ${open ? html`<${ExpenseDrawer} row=${open.id ? open : null} onClose=${() => setOpen(null)}/>` : null}
      ${importing ? html`<${ImportDrawer} all=${all} onClose=${() => setImporting(false)}/>` : null}
    </div>`;
  }

  M.expenses = {CATS, METHODS, blank, monthLabel, parseDate, cleanVendor, snapCat, linesFromTable, parseDelimited, sniffDelim, gridOf};
  M.pages.Expenses = Expenses;
})();
