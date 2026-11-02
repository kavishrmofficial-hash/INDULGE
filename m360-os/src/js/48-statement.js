/* module: statement. The Bank tab in Books. A current account statement (a month, a quarter or a whole financial
   year) comes in as CSV, XLSX, PDF or a photo. Every line is read: money in is the business's income, money out is
   spent. Lines are grouped by party (every Starbucks line under Starbucks, Soho House and Junco Hospitality under one
   name), each party is named once by AI with a kind, a category and one line on what it is, and the owner's own
   edits to a party always win. Statements live in statements/<id> (rows as short arrays, split into <id>.p2 and on
   when a document grows past 200 KB); what each party is lives in statements/_parties. Owner only. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useMemo} = React;

  const PARTIES = 'statements/_parties';
  const DOC_MAX = 200000;          /* a statement document stays well under the server's 256 KiB */
  const NARR_MAX = 80;
  const WINDOW = 2;                /* PDF pages read per call */
  const PAR = 3;                   /* calls in flight at once */
  const PAGE_CAP = 80;
  const PARTY_BATCH = 60;          /* parties named per AI call */
  const OUT_CATS = ['Salaries', 'Rent', 'Software and tools', 'Freelancers', 'Production', 'Travel', 'Meals and client', 'Marketing', 'Professional fees', 'Bank and taxes', 'Equipment', 'Other'];
  const IN_CATS = ['Client payment', 'Refund', 'Interest', 'Own funds', 'Other income'];
  const KINDS = [{v: 'income', label: 'Income'}, {v: 'expense', label: 'Expense'}, {v: 'transfer', label: 'Own transfer'}, {v: 'refund', label: 'Refund'}, {v: 'tax', label: 'Tax'}, {v: 'salary', label: 'Salary'}];
  const KIND_OF = {}; KINDS.forEach(k => { KIND_OF[k.v] = k.label; });
  const hasApi = () => typeof window.M360_API === 'function';
  const X = () => M.expenses;
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const r2 = n => Math.round(n * 100) / 100;

  /* ---------- parties: one key per business ---------- */
  const SUFFIX = /(private|pvt|limited|ltd|llp|india|inc|co|company|corp|the|and)$/;
  function keyOf(name) {
    let k = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    k = k.replace(/\d{3,}$/, '');
    for (let i = 0; i < 3; i++) { const k2 = k.replace(SUFFIX, ''); if (k2 === k || k2.length < 3) break; k = k2; }
    return k || 'unknown';
  }
  const partyName = r => {
    const v = String(r.vendor || '').trim();
    return v || (X() ? X().cleanVendor(r.desc) : '') || 'Unknown';
  };
  /* "starbuckscoffee" joins "starbucks": a longer key that starts with a shorter one of 5 or more letters */
  function aliasMap(keys) {
    const sorted = Array.from(new Set(keys)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const out = {};
    const roots = [];
    for (const k of sorted) {
      const root = roots.find(r => r.length >= 5 && k.startsWith(r));
      if (root) out[k] = root; else { roots.push(k); out[k] = k; }
    }
    return out;
  }

  /* ---------- reading the store ---------- */
  function readAll(ctx) {
    const map = (ctx.coll.statements && ctx.coll.statements.map) || {};
    const book = (map._parties && map._parties.map) || {};
    const stm = {};
    for (const id of Object.keys(map)) {
      if (id === '_parties') continue;
      const d = map[id] || {};
      const sid = d.of || id;
      if (!stm[sid]) stm[sid] = {id: sid, rows: []};
      if (!d.of) Object.assign(stm[sid], {name: d.name, bank: d.bank, from: d.from, to: d.to, at: d.at, n: d.n, parts: d.parts});
      stm[sid].rows = stm[sid].rows.concat((d.rows || []).map(a => ({sid, date: a[0], key: a[1], out: num(a[2]), inn: num(a[3]), desc: a[4] || '', name: a[5] || ''})));
    }
    const list = Object.values(stm).filter(s => s.name).sort((a, b) => String(b.to || '').localeCompare(String(a.to || '')) || (b.at || 0) - (a.at || 0));
    return {list, book};
  }
  /* the party a key resolves to, following merges the owner made */
  function infoOf(book, key) {
    let k = key, seen = 0;
    while (book[k] && book[k].into && book[k].into !== k && seen++ < 6) k = book[k].into;
    return {key: k, ...(book[k] || {})};
  }

  /* group rows into parties for one direction, the label deciding the group (two keys AI named alike join) */
  function groups(rows, book, dir) {
    const g = {};
    for (const r of rows) {
      const amount = dir === 'in' ? r.inn : r.out;
      if (!(amount > 0)) continue;
      const p = infoOf(book, r.key);
      const label = p.label || r.name || p.key;
      const gid = label.toLowerCase().replace(/[^a-z0-9]+/g, '') || p.key;
      if (!g[gid]) g[gid] = {gid, label, key: p.key, keys: new Set(), kind: p.kind || (dir === 'in' ? 'income' : 'expense'), cat: p.cat || '', what: p.what || '', by: p.by || '', total: 0, n: 0, rows: []};
      const x = g[gid];
      x.keys.add(p.key); x.total += amount; x.n++; x.rows.push(r);
      if (!x.cat && p.cat) x.cat = p.cat;
      if (!x.what && p.what) x.what = p.what;
      if (p.by === 'you') { x.kind = p.kind || x.kind; x.cat = p.cat || x.cat; x.what = p.what || x.what; x.by = 'you'; }
    }
    return Object.values(g).sort((a, b) => b.total - a.total);
  }
  const counted = x => x.kind !== 'transfer';

  /* ---------- reading a file ---------- */
  async function pdfPages(buf) {
    try {
      const s = new TextDecoder('latin1').decode(new Uint8Array(buf));
      let best = 0;
      for (const m of s.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) best = Math.max(best, Number(m[1] || m[2]) || 0);
      if (!best) best = (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
      return best > 0 && best <= 400 ? best : 0;
    } catch (e) { return 0; }
  }
  async function readFile(file, say) {
    const x = X();
    const lower = file.name.toLowerCase();
    let rows = null;
    if (lower.endsWith('.csv') || lower.endsWith('.txt') || /csv|text\/plain/.test(file.type || '')) {
      const text = await file.text();
      rows = x.linesFromTable(x.parseDelimited(text.replace(/^﻿/, ''), x.sniffDelim(text)));
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
      try { rows = x.linesFromTable(await x.parseXlsx(await file.arrayBuffer())); } catch (e) { rows = null; }
    }
    if (rows && rows.length) return rows;
    if (!hasApi()) throw new Error(lower.endsWith('.pdf') ? 'A PDF statement reads on the team site. Here, upload the CSV or XLSX export.' : 'These columns are not ones the page can read.');
    if (file.size > 4 * 1024 * 1024) throw new Error('Statements up to 4 MB. Split a long year into two files.');
    const data = await x.toBase64(file);
    const type = file.type || (lower.endsWith('.pdf') ? 'application/pdf' : '');
    const isPdf = /pdf/.test(type) || lower.endsWith('.pdf');
    const call = (from, to) => window.M360_API('bookstatement', {name: file.name, type, data, pageFrom: from, pageTo: to});
    if (!isPdf) { say('Reading the statement'); const r = await call(0, 0); return (r && r.rows) || []; }
    let pages = await pdfPages(await file.arrayBuffer());
    const got = {};
    say(pages ? 'Reading pages 1 to ' + Math.min(WINDOW, pages) + ' of ' + pages : 'Reading the first pages');
    const first = await call(1, WINDOW);
    got[1] = (first && first.rows) || [];
    if (!pages) pages = Math.min(PAGE_CAP, Number(first && first.pages) || 0);
    if (pages) {
      const starts = [];
      for (let p = 1 + WINDOW; p <= Math.min(pages, PAGE_CAP); p += WINDOW) starts.push(p);
      let done = WINDOW;
      for (let i = 0; i < starts.length; i += PAR) {
        const batch = starts.slice(i, i + PAR);
        say('Reading pages ' + batch[0] + ' to ' + Math.min(pages, batch[batch.length - 1] + WINDOW - 1) + ' of ' + pages);
        const res = await Promise.all(batch.map(p => call(p, Math.min(pages, p + WINDOW - 1)).catch(e => ({err: e}))));
        res.forEach((r, j) => { if (r && r.err) throw r.err; got[batch[j]] = (r && r.rows) || []; });
        done += batch.length * WINDOW;
      }
    } else {
      /* no count anywhere: windows until one comes back empty */
      for (let p = 1 + WINDOW; p <= PAGE_CAP; p += WINDOW) {
        say('Reading pages ' + p + ' to ' + (p + WINDOW - 1));
        const r = await call(p, p + WINDOW - 1);
        const rows2 = (r && r.rows) || [];
        if (!rows2.length) break;
        got[p] = rows2;
      }
    }
    return Object.keys(got).map(Number).sort((a, b) => a - b).reduce((all, p) => all.concat(got[p]), [])
      .map(r => ({date: x.parseDate(r.date) || '', vendor: r.vendor || '', desc: r.desc || '', amount: num(r.amount), credit: num(r.credit), ref: r.ref || ''}));
  }

  /* ---------- naming the parties ---------- */
  async function nameParties(ctx, parties, say) {
    const out = {};
    if (!parties.length) return out;
    const ask = async batch => {
      const payload = batch.map(p => ({name: p.name, samples: p.samples, out: Math.round(p.out), in: Math.round(p.inn)}));
      if (hasApi()) return ((await window.M360_API('bookparties', {parties: payload})) || {}).parties || [];
      /* the claude.ai page: the same question through the page's AI */
      const res = await M.ai.json(ctx, 'You help the owner of an Indian marketing agency read their bank statement. For each party give a clean label (the same label for two names that are one business), kind (income, expense, transfer, refund, tax or salary), category (for money out one of ' + OUT_CATS.join(', ') + '; for money in one of ' + IN_CATS.join(', ') + ') and what (one plain sentence, at most 12 words). Reply with only a JSON array of {"label","kind","category","what"} in the same order.\n\n' + JSON.stringify(payload), {cache: false});
      return Array.isArray(res) ? res : [];
    };
    for (let i = 0; i < parties.length; i += PARTY_BATCH) {
      const batch = parties.slice(i, i + PARTY_BATCH);
      say('Working out who ' + (i + 1) + ' to ' + (i + batch.length) + ' of ' + parties.length + ' parties are');
      let res = [];
      try { res = await ask(batch); } catch (e) { if (e && M.ai.isDown(e.code)) throw e; res = []; }
      batch.forEach((p, j) => {
        const a = res[j] || {};
        const kinds = KINDS.map(k => k.v);
        const cats = OUT_CATS.concat(IN_CATS);
        out[p.key] = {label: String(a.label || '').trim().slice(0, 60) || p.name, kind: kinds.includes(a.kind) ? a.kind : (p.inn > p.out ? 'income' : 'expense'),
          cat: cats.includes(a.category) ? a.category : '', what: String(a.what || '').trim().slice(0, 120), by: 'ai', at: Date.now()};
      });
    }
    return out;
  }
  /* what the page knows without AI: the keyword categories for money out, client payment for money in */
  const guess = p => ({label: p.name, kind: p.inn > p.out ? 'income' : 'expense', cat: p.inn > p.out ? 'Client payment' : ((X() && X().keywordCat(p.name, p.samples[0])) || ''), what: '', by: 'page', at: Date.now()});

  /* ---------- saving ---------- */
  function packs(rows) {
    const out = [];
    let cur = [], size = 0;
    for (const r of rows) {
      const a = [r.date, r.key, r.out, r.inn, String(r.desc || '').replace(/\s+/g, ' ').slice(0, NARR_MAX), r.name.slice(0, 40)];
      const n = JSON.stringify(a).length + 1;
      if (size + n > DOC_MAX && cur.length) { out.push(cur); cur = []; size = 0; }
      cur.push(a); size += n;
    }
    if (cur.length || !out.length) out.push(cur);
    return out;
  }

  /* ---------- the upload ---------- */
  function Upload({ctx, have, book}) {
    const [busy, setBusy] = useState(false);
    const [line, setLine] = useState('');
    const [bank, setBank] = useState('');
    const pick = async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file || busy) return;
      setBusy(true); setLine('Reading ' + file.name);
      try {
        const raw = (await readFile(file, setLine)).filter(r => r.date && (num(r.amount) > 0 || num(r.credit) > 0));
        if (!raw.length) throw new Error('Nothing readable in that file.');
        /* a line already in another statement stays out, so overlapping months never count twice */
        const seen = new Set(have.map(r => r.date + '|' + r.out + '|' + r.inn + '|' + keyOf(r.desc).slice(0, 24)));
        const named = raw.map(r => ({date: r.date, name: partyName(r), desc: r.desc || '', out: r2(num(r.amount)), inn: r2(num(r.amount) > 0 ? 0 : num(r.credit))}));
        const fresh = named.filter(r => !seen.has(r.date + '|' + r.out + '|' + r.inn + '|' + keyOf(r.desc).slice(0, 24)));
        const skipped = named.length - fresh.length;
        if (!fresh.length) throw new Error('Every line in that file is already here.');
        const alias = aliasMap(fresh.map(r => keyOf(r.name)).concat(Object.keys(book)));
        for (const r of fresh) r.key = alias[keyOf(r.name)] || keyOf(r.name);
        /* the parties no one has named yet */
        const byKey = {};
        for (const r of fresh) {
          if (book[r.key]) continue;
          const p = byKey[r.key] || (byKey[r.key] = {key: r.key, name: r.name, samples: [], out: 0, inn: 0});
          if (p.samples.length < 2 && r.desc) p.samples.push(r.desc);
          p.out += r.out; p.inn += r.inn;
        }
        const unknown = Object.values(byKey).sort((a, b) => (b.out + b.inn) - (a.out + a.inn));
        let namedParties = {}, note = '';
        try { namedParties = await nameParties(ctx, unknown, setLine); }
        catch (err) { note = ' AI did not answer, so parties keep the bank\'s names for now.'; }
        const patch = {};
        for (const p of unknown) patch[p.key] = namedParties[p.key] || guess(p);
        const dates = fresh.map(r => r.date).sort();
        const id = U.uid();
        const parts = packs(fresh);
        const now = Date.now();
        setLine('Saving ' + fresh.length + ' lines');
        if (Object.keys(patch).length) await ctx.W.merge(PARTIES, {map: patch, updated: now});
        for (let i = 1; i < parts.length; i++) await ctx.W.set('statements/' + id + '.p' + (i + 1), {of: id, part: i + 1, rows: parts[i], at: now});
        await ctx.W.set('statements/' + id, {name: file.name.slice(0, 80), bank: bank.trim().slice(0, 40), from: dates[0], to: dates[dates.length - 1], n: fresh.length, parts: parts.length, rows: parts[0], at: now});
        setLine('Read ' + fresh.length + (fresh.length === 1 ? ' line' : ' lines') + ' from ' + U.fmtDate(dates[0]) + ' to ' + U.fmtDate(dates[dates.length - 1]) + '.' + (skipped ? ' ' + skipped + ' already here stayed out.' : '') + note);
        M.toast('Statement read');
      } catch (err) {
        setLine(err && M.ai.isDown(err.code) ? M.ai.errLine(err.code, M.ai.why(err)) : (err && err.message) || 'Could not read that file.');
      }
      setBusy(false);
    };
    return html`<${UI.Card} title="Upload a statement" id="stm-upload">
      <div class="stack tight">
        <div class="small">A month, a quarter or the whole financial year from your current account. CSV and XLSX read right here; a PDF or a photo is read by AI on the team site, two pages at a time.</div>
        <div class="row" style=${{gap: '10px'}}>
          <input class="input" style=${{maxWidth: '220px'}} id="stm-bank" placeholder="Account, for example Axis current" value=${bank} onInput=${e => setBank(e.target.value)}/>
          <label class=${'btn' + (busy ? ' disabled' : '')}>${icons.upload ? html`<${icons.upload}/>` : null}${busy ? 'Reading' : 'Choose a file'}<input type="file" id="stm-file" disabled=${busy} accept=".csv,.xlsx,.xlsm,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style=${{display: 'none'}} onChange=${pick}/></label>
        </div>
        ${line ? html`<div class="small ink62" id="stm-line">${line}</div>` : null}
        <div class="tiny ink62">Money in counts as income. Money out is grouped by who it went to. Own transfers are listed and left out of both totals.</div>
      </div>
    <//>`;
  }

  /* ---------- one party, edited ---------- */
  function PartyDrawer({ctx, g, dir, all, onClose}) {
    const [f, setF] = useState({label: g.label, kind: g.kind, cat: g.cat, what: g.what, into: ''});
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const cats = (dir === 'in' ? IN_CATS : OUT_CATS).concat(dir === 'in' ? OUT_CATS : IN_CATS);
    const others = all.filter(x => x.gid !== g.gid);
    const save = async () => {
      if (busy) return;
      setBusy(true);
      const now = Date.now();
      const patch = {};
      if (f.into) {
        const target = others.find(x => x.gid === f.into);
        for (const k of g.keys) if (target && k !== target.key) patch[k] = {into: target.key, by: 'you', at: now};
      } else {
        for (const k of g.keys) patch[k] = {label: f.label.trim().slice(0, 60) || g.label, kind: f.kind, cat: f.cat, what: f.what.trim().slice(0, 120), into: '', by: 'you', at: now};
      }
      try { await ctx.W.merge(PARTIES, {map: patch, updated: now}); M.toast(f.into ? 'Merged' : 'Saved'); onClose(); } catch (e) { setBusy(false); }
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${g.label}
      footer=${html`<div class="row between grow"><span class="small ink62">${g.n} ${g.n === 1 ? 'line' : 'lines'}, <span class="num">${U.inr(g.total)}</span></span><${UI.Btn} id="stm-party-save" disabled=${busy} onClick=${save}>${f.into ? 'Merge into it' : 'Save'}<//></div>`}>
      <div class="stack" id="stm-party">
        <${UI.Input} label="name" id="stm-party-label" value=${f.label} onChange=${v => set('label', v)}/>
        <${UI.Select} label="kind" value=${f.kind} onChange=${v => set('kind', v)} options=${KINDS}/>
        <${UI.Select} label="category" value=${f.cat} onChange=${v => set('cat', v)} options=${[{v: '', label: 'Not set'}].concat(cats.map(c => ({v: c, label: c})))}/>
        <${UI.Input} label="what this is" id="stm-party-what" value=${f.what} onChange=${v => set('what', v)} placeholder="One line"/>
        ${others.length ? html`<${UI.Select} label="same business as" hint="Every line moves under the party you pick, now and on the next upload" value=${f.into} onChange=${v => set('into', v)}
          options=${[{v: '', label: 'Keep it apart'}].concat(others.slice(0, 200).map(x => ({v: x.gid, label: x.label})))}/>` : null}
        <div class="stack tight">
          <${UI.Micro} plain=${true}>the lines<//>
          ${g.rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((r, i) => html`<div class="listrow" key=${i} style=${{padding: '6px 0'}}>
            <span class="tiny num ink62" style=${{minWidth: '84px'}}>${U.fmtDate(r.date)}</span>
            <span class="grow tiny" style=${{overflowWrap: 'anywhere'}}>${r.desc}</span>
            <span class="num small">${U.inr(dir === 'in' ? r.inn : r.out)}</span>
          </div>`)}
        </div>
      </div>
    <//>`;
  }

  /* ---------- a table of parties ---------- */
  function PartyTable({id, title, list, dir, total, onOpen}) {
    const [open, setOpen] = useState({});
    const [more, setMore] = useState(false);
    const shown = more ? list : list.slice(0, 25);
    return html`<${UI.Card} title=${title} id=${id} action=${html`<span class="pill pl tn">${U.inr(total)}</span>`}>
      ${list.length ? html`<div class="tbl-wrap"><table class="tbl stm-tbl">
        <thead><tr><th>party</th><th class="num">lines</th><th class="num">total</th><th class="num">share</th><th>category</th><th>what it is</th></tr></thead>
        <tbody>${shown.map(g => html`<${React.Fragment} key=${g.gid}>
          <tr class="stm-row" data-party=${g.label}>
            <td><button type="button" class="linky" onClick=${() => setOpen(o => ({...o, [g.gid]: !o[g.gid]}))}>${g.label}</button>${g.kind !== (dir === 'in' ? 'income' : 'expense') ? html` <${UI.Pill} kind=${g.kind === 'transfer' ? undefined : 'warm'}>${KIND_OF[g.kind] || g.kind}<//>` : null}</td>
            <td class="num">${g.n}</td>
            <td class="num"><b>${U.inr(g.total)}</b></td>
            <td class="num ink62">${counted(g) && total ? U.pct(g.total, total) + '%' : ''}</td>
            <td>${g.cat || html`<span class="ink62">not set</span>`}</td>
            <td class="small"><span class="ink62">${g.what}</span> <button type="button" class="linky tiny" onClick=${() => onOpen(g, dir)}>Edit</button></td>
          </tr>
          ${open[g.gid] ? g.rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((r, i) => html`<tr key=${g.gid + i} class="stm-line">
            <td class="tiny ink62 num">${U.fmtDate(r.date)}</td><td></td><td class="num small">${U.inr(dir === 'in' ? r.inn : r.out)}</td><td></td><td colspan="2" class="tiny ink62" style=${{overflowWrap: 'anywhere'}}>${r.desc}</td>
          </tr>`) : null}
        <//>`)}</tbody>
      </table></div>
      ${list.length > 25 ? html`<button type="button" class="linky small" style=${{marginTop: '10px'}} onClick=${() => setMore(!more)}>${more ? 'Show the top 25' : 'Show all ' + list.length}</button>` : null}`
      : html`<${UI.Empty} text=${dir === 'in' ? 'No money in for this view.' : 'No money out for this view.'}/>`}
    <//>`;
  }

  /* ---------- the page ---------- */
  function Statement() {
    const ctx = M.useCtx();
    const [pick, setPick] = useState('all');
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState(null);
    const [adding, setAdding] = useState(false);
    const {list, book} = useMemo(() => readAll(ctx), [ctx.coll.statements]);
    const allRows = useMemo(() => list.reduce((a, s) => a.concat(s.rows), []), [list]);
    if (!ctx.isOwner) return html`<${UI.Empty} text="The books are the owner's alone."/>`;
    const cur = pick === 'all' ? null : list.find(s => s.id === pick) || null;
    const base = cur ? cur.rows : allRows;
    const ql = q.trim().toLowerCase();
    const rows = !ql ? base : base.filter(r => {
      const p = infoOf(book, r.key);
      return [p.label, r.name, r.desc, p.cat, p.what, KIND_OF[p.kind]].some(t => String(t || '').toLowerCase().includes(ql));
    });
    const ins = groups(rows, book, 'in'), outs = groups(rows, book, 'out');
    const inTotal = ins.filter(counted).reduce((s, g) => s + g.total, 0);
    const outTotal = outs.filter(counted).reduce((s, g) => s + g.total, 0);
    const moved = ins.concat(outs).filter(g => !counted(g)).reduce((s, g) => s + g.total, 0);
    const byCat = {};
    for (const g of outs.filter(counted)) byCat[g.cat || 'Not set'] = (byCat[g.cat || 'Not set'] || 0) + g.total;
    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    const span = rows.length ? (() => { const d = rows.map(r => r.date).sort(); return U.fmtDate(d[0]) + ' to ' + U.fmtDate(d[d.length - 1]); })() : '';

    /* the expense lines of this view into the Expenses ledger, once each */
    const toExpenses = async () => {
      if (adding) return;
      setAdding(true);
      const x = X(), b = M.books;
      /* v39: a line from a statement is known by its date, amount and narration, so a renamed party is still the same
         line; anything typed by hand by its date, amount and payee. Each saved expense stands for one line, so two real
         lines alike both land */
      const have = {};
      const bump = k => { have[k] = (have[k] || 0) + 1; };
      const take = k => { if (have[k] > 0) { have[k]--; return true; } return false; };
      for (const e of b.expenses(ctx)) bump(e.source === 'statement' && x.narrKey(e.desc) ? e.date + '|' + num(e.amount) + '|n' + x.narrKey(e.desc) : e.date + '|' + num(e.amount) + '|v' + x.vendorKey(e.vendor));
      const now = Date.now();
      const byMonth = {};
      let n = 0;
      for (const g of outs) {
        if (!counted(g)) continue;
        for (const r of g.rows) {
          if ((x.narrKey(r.desc) && take(r.date + '|' + r.out + '|n' + x.narrKey(r.desc))) || take(r.date + '|' + r.out + '|v' + x.vendorKey(g.label))) continue;
          const mid = r.date.slice(0, 7);
          (byMonth[mid] = byMonth[mid] || {})[U.uid()] = {date: r.date, vendor: g.label, category: OUT_CATS.includes(g.cat) ? g.cat : (g.kind === 'salary' ? 'Salaries' : g.kind === 'tax' ? 'Bank and taxes' : 'Other'),
            desc: r.desc, amount: r.out, gstInput: 0, method: x.guessMethod(r.desc), paid: true, recurring: '', receipt: null, source: 'statement', ref: '', at: now, updatedAt: now};
          n++;
        }
      }
      try {
        for (const mid of Object.keys(byMonth)) await ctx.W.merge('expenses/' + mid, {rows: byMonth[mid], updated: now});
        M.toast(n ? 'Added ' + n + (n === 1 ? ' expense' : ' expenses') + ' to the books' : 'Every line is already in Expenses');
      } catch (e) { /* the write toasts */ }
      setAdding(false);
    };
    const remove = async s => {
      for (let i = 2; i <= (s.parts || 1); i++) await ctx.W.del('statements/' + s.id + '.p' + i);
      await ctx.W.del('statements/' + s.id);
      if (pick === s.id) setPick('all');
      M.toast('Statement removed');
    };

    return html`<div class="stack" style=${{gap: '24px'}} id="stm-page">
      <${UI.SectionHead} label="bank" pill=${list.length ? list.length + (list.length === 1 ? ' statement' : ' statements') + (span ? ', ' + span : '') : 'your current account'}/>
      <${Upload} ctx=${ctx} have=${allRows} book=${book}/>
      ${list.length ? html`<${React.Fragment}>
        <div class="row between" style=${{gap: '10px'}}>
          <select class="input" id="stm-pick" style=${{maxWidth: '360px'}} value=${pick} aria-label="Statement" onChange=${e => setPick(e.target.value)}>
            <option value="all">Every statement</option>
            ${list.map(s => html`<option key=${s.id} value=${s.id}>${(s.bank ? s.bank + ', ' : '') + U.fmtDate(s.from) + ' to ' + U.fmtDate(s.to)}</option>`)}
          </select>
          <input class="input" id="stm-q" type="search" style=${{maxWidth: '280px'}} placeholder="Search party, narration, category" value=${q} onInput=${e => setQ(e.target.value)}/>
        </div>
        <div class="kpis" id="stm-kpis">
          <div class="kp" style=${{'--i': 0}}><div class="kl"><span class="cap">money in</span></div><div class="kv"><span class="bignum money" id="stm-in"><b>${U.inr(Math.round(inTotal))}</b></span></div><div class="kn">${ins.length} ${ins.length === 1 ? 'party' : 'parties'}</div></div>
          <div class="kp" style=${{'--i': 1}}><div class="kl"><span class="cap">money out</span></div><div class="kv"><span class="bignum money" id="stm-out"><b>${U.inr(Math.round(outTotal))}</b></span></div><div class="kn">${outs.length} ${outs.length === 1 ? 'party' : 'parties'}</div></div>
          <div class=${'kp' + (inTotal - outTotal < 0 ? ' hot' : '')} style=${{'--i': 2}}><div class="kl"><span class="cap">net</span></div><div class="kv"><span class="bignum money" id="stm-net"><b>${U.inr(Math.round(inTotal - outTotal))}</b></span></div><div class="kn">${inTotal - outTotal < 0 ? 'More out than in' : 'In less out'}</div></div>
          ${moved ? html`<div class="kp" style=${{'--i': 3}}><div class="kl"><span class="cap">own transfers</span></div><div class="kv"><span class="bignum money"><b>${U.inr(Math.round(moved))}</b></span></div><div class="kn">Left out of the totals</div></div>` : null}
        </div>
        <${UI.Band} tone="warm"><div class="stack">
          <${PartyTable} id="stm-ins" title="Money in, by party" list=${ins} dir="in" total=${inTotal} onOpen=${(g, d) => setEdit({g, d})}/>
          <${PartyTable} id="stm-outs" title="Money out, by party" list=${outs} dir="out" total=${outTotal} onOpen=${(g, d) => setEdit({g, d})}/>
        </div><//>
        <div class="grid2">
          <${UI.Card} title="Money out, by category" id="stm-cats">
            ${cats.length ? cats.map(c => html`<div class="listrow" key=${c}><span class="grow">${c}</span><span class="tiny ink62" style=${{minWidth: '42px', textAlign: 'right'}}>${U.pct(byCat[c], outTotal)}%</span><span class="num" style=${{fontWeight: 500, minWidth: '110px', textAlign: 'right'}}>${U.inr(Math.round(byCat[c]))}</span></div>`) : html`<${UI.Empty} text="Nothing spent in this view."/>`}
          <//>
          <${UI.Card} title="Into the books" id="stm-actions">
            <div class="stack tight">
              <div class="small">Adds every money out line in this view to Expenses, filed under its party and category. A line already there stays out.</div>
              <div class="row"><${UI.Btn} kind="sec" id="stm-to-exp" disabled=${adding || !outs.length} onClick=${toExpenses}>Add to Expenses<//></div>
              ${cur ? html`<div class="row between" style=${{marginTop: '8px'}}><span class="tiny ink62">${cur.name}, ${cur.n || cur.rows.length} lines</span><${UI.ConfirmBtn} label="Tap again to remove" onConfirm=${() => remove(cur)}>Remove this statement<//></div>` : html`<div class="tiny ink62">Pick one statement above to remove it.</div>`}
            </div>
          <//>
        </div>
      <//>` : html`<${UI.Empty} text="No statement yet. Upload one above and every line lands here, grouped by party."/>`}
      ${edit ? html`<${PartyDrawer} ctx=${ctx} g=${edit.g} dir=${edit.d} all=${edit.d === 'in' ? ins : outs} onClose=${() => setEdit(null)}/>` : null}
    </div>`;
  }

  M.statement = {keyOf, aliasMap, groups, readAll, infoOf, pdfPages};
  M.pages.Statement = Statement;
})();
