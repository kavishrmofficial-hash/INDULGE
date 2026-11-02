/* module: command (BRIEF section 11, Command). The founder dashboard in the approved v7 layout
   (design/m360-os-v7.html, the Command page), on this app's live data: a header that talks, 01 needs you,
   02 numbers, 03 attendance and 04 flags in a warm band, 05 to 07 in the dark band, 08 to 10 the team,
   11 clients, and a counter rail on the right edge. Money shows to the owner only. */
'use strict';
(function () {
  const {html, React, U} = M;
  const {useState, useMemo, useEffect, useRef} = React;

  const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const cls = (...a) => a.filter(Boolean).join(' ');
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_L = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const okYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const dm = s => { const d = U.parseYmd(s); return d.getDate() + ' ' + MON_S[d.getMonth()]; };
  const rangeShort = r => {
    if (!okYmd(r.from)) return '';
    if (!okYmd(r.to) || r.to === r.from) return dm(r.from);
    const a = U.parseYmd(r.from), b = U.parseYmd(r.to);
    return a.getMonth() === b.getMonth() ? a.getDate() + ' to ' + dm(r.to) : dm(r.from) + ' to ' + dm(r.to);
  };
  const LEAVE_T = {casual: 'Casual leave', sick: 'Sick leave', wfh: 'WFH day', swap: 'WFH swap', other: 'Leave'};
  const LEAVE_TAG = {swap: 'WFH swap', wfh: 'WFH day'};
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const minOf = ms => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  const pad = n => (n < 10 ? '0' : '') + n;
  const hm = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const nav = h => M.nav(h);

  const CK = html`<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`;
  const CMDK = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>`;
  const CHEV = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg>`;
  const Go = () => html`<i class="c-go" aria-hidden="true"></i>`;
  const Head = ({n, t, children}) => html`<div class="c-sh"><span class="c-eb"><i>${n}</i>${t}</span>${children || null}</div>`;

  /* the previous working day before `date`, Monday to Saturday, skipping holidays */
  function prevWorkingDay(ctx, date) {
    let d = U.addDays(U.parseYmd(date), -1);
    for (let i = 0; i < 14; i++) {
      const s = U.ymd(d);
      if (d.getDay() !== 0 && !ctx.holidays.has(s)) return s;
      d = U.addDays(d, -1);
    }
    return U.ymd(d);
  }

  /* glide to a section of this page and ring what it points at */
  function glideTo(id, sel) {
    const el = document.getElementById(id);
    if (!el) return;
    if (M.chrome && M.chrome.glideTo) M.chrome.glideTo(el, () => {
      const els = sel ? Array.from(document.querySelectorAll(sel)).filter(e => e.getClientRects().length).slice(0, 6) : [];
      if (els.length) { M.chrome.flash(els); if (M.mark) M.mark.lookAt(els[0], 2200); }
    });
    else el.scrollIntoView({behavior: RM() ? 'auto' : 'smooth'});
  }

  /* ---------- motion parts ---------- */
  /* a number counts up the first time it is seen, and again from where it was when it changes */
  function CountUp({to, fmt, className, block}) {
    const ref = useRef(null);
    const [v, setV] = useState(RM() ? to : 0);
    const st = useRef({seen: false, from: 0, raf: 0});
    useEffect(() => {
      const s = st.current;
      const run = () => {
        cancelAnimationFrame(s.raf);
        const from = s.from, d = 1200;
        let t0 = 0;
        if (RM() || from === to) { s.from = to; setV(to); return; }
        const f = t => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / d), q = 1 - Math.pow(1 - k, 4); setV(from + (to - from) * q); if (k < 1) s.raf = requestAnimationFrame(f); else s.from = to; };
        s.raf = requestAnimationFrame(f);
      };
      if (s.seen) { run(); return () => cancelAnimationFrame(s.raf); }
      if (!('IntersectionObserver' in window) || RM()) { s.seen = true; s.from = to; setV(to); return undefined; }
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); s.seen = true; run(); } }, {rootMargin: '0px 0px -6% 0px'});
      if (ref.current) io.observe(ref.current);
      return () => { io.disconnect(); cancelAnimationFrame(s.raf); };
    }, [to]);
    const txt = fmt === 'inr' ? U.inr(v) : Math.round(v);
    return block ? html`<div ref=${ref} class=${className || null}>${txt}</div>` : html`<span ref=${ref} class=${className || null}>${txt}</span>`;
  }

  /* a big number rolls: the old value leaves upward, the new one springs in from below */
  function Roll({k, i, long, word, children}) {
    const r = useRef({k, kids: children, n: 0, old: null});
    const [, force] = useState(0);
    if (r.current.k !== k) { r.current.old = r.current.kids; r.current.n += 1; r.current.k = k; }
    r.current.kids = children;
    const n = r.current.n;
    useEffect(() => {
      if (!r.current.old) return undefined;
      const t = setTimeout(() => { r.current.old = null; force(x => x + 1); }, 780);
      return () => clearTimeout(t);
    }, [n]);
    const c = cls('c-num', long && 'long', word && 'word');
    return html`<span class="c-kv">
      ${r.current.old ? html`<span key=${'o' + n} class=${c + ' old'} aria-hidden="true">${r.current.old}</span>` : null}
      <span key=${'n' + n} class=${cls(c, n > 0 && 'nu')} style=${{'--i': i}}>${children}</span>
    </span>`;
  }

  /* a caption that changes fades in its new words */
  function Cap({text}) {
    const r = useRef({t: text, n: 0});
    if (r.current.t !== text) { r.current.t = text; r.current.n += 1; }
    return html`<span key=${r.current.n} class=${cls('c-kn', r.current.n > 0 && 'swap')}>${text}</span>`;
  }

  /* the live line: the newest news rolls in every five seconds */
  function Ticker({lines}) {
    const ref = useRef(null);
    const st = useRef({i: 0, lines: [], top: ''});
    const to = t => {
      const box = ref.current;
      if (!box) return;
      const olds = Array.from(box.querySelectorAll('span'));
      if (olds.length === 1 && olds[0].textContent === t) return;
      const n = document.createElement('span');
      n.textContent = t; n.className = 'dn'; box.appendChild(n); n.getBoundingClientRect();
      olds.forEach(o => { o.classList.add('up'); setTimeout(() => { if (o.parentNode) o.remove(); }, 650); });
      n.classList.remove('dn');
    };
    useEffect(() => {
      const s = st.current;
      s.lines = lines.length ? lines : ['Synced, all quiet'];
      if (s.lines[0] !== s.top) { s.top = s.lines[0]; s.i = 0; to(s.lines[0]); }
    }, [lines.join('\n')]);
    useEffect(() => {
      const t = setInterval(() => {
        const s = st.current;
        if (document.hidden || s.lines.length < 2) return;
        s.i = (s.i + 1) % s.lines.length; to(s.lines[s.i]);
      }, 5000);
      return () => clearInterval(t);
    }, []);
    return html`<span class="c-tick" id="c-tick" ref=${ref} aria-live="polite"></span>`;
  }

  /* ---------- 01 needs you: one tap acts, the card closes up, undo sits in the island ---------- */
  function flip(grid, mut) {
    const els = grid ? Array.from(grid.querySelectorAll('.c-ncw')).filter(w => !w.classList.contains('gone')) : [];
    const first = els.map(w => w.getBoundingClientRect());
    mut();
    els.forEach((w, i) => {
      if (w.classList.contains('gone')) return;
      const b = w.getBoundingClientRect(), dx = first[i].left - b.left, dy = first[i].top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      w.style.transition = 'none'; w.style.translate = dx + 'px ' + dy + 'px'; w.getBoundingClientRect(); w.style.transition = ''; w.style.translate = '';
    });
  }

  function NeedCard({n, j, grid}) {
    const wref = useRef(null), cref = useRef(null);
    const tm = useRef([]);
    useEffect(() => () => tm.current.forEach(clearTimeout), []);
    const later = (fn, ms) => tm.current.push(setTimeout(fn, ms));

    function reset() {
      const w = wref.current, c = cref.current;
      if (!w || !c) return;
      tm.current.forEach(clearTimeout); tm.current = [];
      const acts = c.querySelector('.c-acts'), ap = c.querySelector('.c-btn');
      acts.classList.remove('fin'); ap.classList.remove('done'); ap.style.width = ''; ap.style.opacity = '';
      c.classList.remove('settled'); c.style.translate = ''; c.style.opacity = ''; c.style.transition = '';
      if (w.classList.contains('gone')) { w.classList.add('going'); flip(grid.current, () => w.classList.remove('gone')); w.getBoundingClientRect(); requestAnimationFrame(() => w.classList.remove('going', 'sl', 'sr')); }
      else w.classList.remove('going', 'sl', 'sr');
    }
    /* acts in place (leave, dismiss): the card morphs, the island confirms with UNDO, the write lands as it closes up */
    function act(ok, fly) {
      const a = ok ? n.ok : n.no;
      if (!a) return;
      if (a.go) { a.go(); return; }
      const w = wref.current, c = cref.current;
      if (!w || !c || c.classList.contains('settled')) return;
      c.classList.add('settled');
      const acts = c.querySelector('.c-acts'), ap = c.querySelector('.c-btn');
      acts.classList.add('fin');
      if (ok) { ap.style.width = ap.offsetWidth + 'px'; ap.getBoundingClientRect(); ap.classList.add('done'); ap.style.width = '36px'; if (M.mark) M.mark.happy(); }
      else { ap.style.opacity = '.25'; if (M.mark) M.mark.nod(); }
      if (fly && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* no buzz */ } }
      if (fly) { c.style.transition = 'translate .45s var(--ease),opacity .35s var(--ease)'; c.style.translate = (ok ? '115%' : '-115%') + ' 0'; c.style.opacity = '0'; }
      let undone = false, wrote = null;
      const undo = () => {
        undone = true;
        if (wrote) wrote.then(okW => { if (okW !== false && a.undo) a.undo(); });
        reset(); if (M.mark) M.mark.pop();
      };
      later(() => { if (M.island) M.island.confirm(a.msg, n.sub, undo); else M.toast(a.msg); }, fly ? 120 : 380);
      later(() => w.classList.add('going'), fly ? 360 : 1100);
      later(() => {
        flip(grid.current, () => w.classList.add('gone'));
        if (undone) return;
        wrote = Promise.resolve().then(a.run).then(() => true, () => { reset(); return false; });
      }, fly ? 640 : 1480);
    }

    /* swipe on touch: right acts, left takes the other way */
    useEffect(() => {
      const w = wref.current, c = cref.current;
      if (!n.swipe || !w || !c) return undefined;
      let x0 = 0, y0 = 0, dx = 0, drag = false, dec = false, armed = false;
      const down = e => { if (e.pointerType !== 'touch' || e.target.closest('.c-acts button') || c.classList.contains('settled')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = true; dec = false; armed = false; };
      const move = e => {
        if (!drag) return;
        const mx = e.clientX - x0, my = e.clientY - y0;
        if (!dec) {
          if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { dec = true; c.style.transition = 'none'; try { c.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } }
          else if (Math.abs(my) > 8) { drag = false; return; } else return;
        }
        dx = mx; c.style.translate = dx + 'px 0'; w.classList.toggle('sl', dx > 0); w.classList.toggle('sr', dx < 0);
        const arm = Math.abs(dx) > w.offsetWidth * 0.32;
        if (arm !== armed) { armed = arm; w.classList.toggle('arm', arm); if (arm && navigator.vibrate) { try { navigator.vibrate(8); } catch (er) { /* fine */ } } }
      };
      const end = () => {
        if (!drag) return; drag = false; c.style.transition = ''; w.classList.remove('arm');
        if (dec && armed) actRef.current(dx > 0, true);
        else { c.style.translate = ''; setTimeout(() => w.classList.remove('sl', 'sr'), 400); }
      };
      c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', end); c.removeEventListener('pointercancel', end); };
    }, [n.swipe]);
    const actRef = useRef(act);
    actRef.current = act;

    return html`<div class="c-ncw" ref=${wref} data-id=${n.k} data-kind=${n.kind}>
      ${n.swipe ? html`<span class="c-nsw c-nsw-l cap" aria-hidden="true">${n.ok.label}</span><span class="c-nsw c-nsw-r cap" aria-hidden="true">${n.no ? n.no.label : ''}</span>` : null}
      <article class="c-card c-nc lift spot" ref=${cref} style=${{'--j': j}}>
        <div class="c-nt"><span class="cap">${n.tag}</span><span class="cap">${n.when}</span></div>
        <h3 class="c-who">${n.whoGo ? html`<button type="button" class="c-pn" onClick=${n.whoGo}>${n.who}</button>` : n.who}</h3>
        <p class="c-ndt">${n.detail}</p>
        <div class="c-acts">
          <button class="c-btn cap" type="button" data-a="ok" onClick=${() => act(true)}><span class="lb">${n.ok.label}</span>${CK}</button>
          ${n.no ? html`<button class="c-lnkb cap" type="button" data-a="no" onClick=${() => act(false)}>${n.no.label}</button>` : null}
        </div>
      </article>
    </div>`;
  }

  /* ---------- the page ---------- */
  function Command() {
    const ctx = M.useCtx();
    const root = useRef(null), grid = useRef(null);
    const [attF, setAttF] = useState('');
    const [rule, setRule] = useState('');
    const [sev, setSev] = useState('');
    const [allF, setAllF] = useState(false);
    const today = U.todayStr();
    const now = new Date(ctx.now || Date.now());
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const members = ctx.activeMembers || [];
    const money = !!ctx.isOwner;
    const S = ctx.settings || {};

    /* names, once for the page: people on the roster and anyone asking to join */
    const joins = (M.team && M.team.requests) ? M.team.requests(ctx) : [];
    const ids = useMemo(() => members.map(m => m.uid).concat(joins.map(j => j.uid)), [members, joins.map(j => j.uid).join(',')]);
    const profs = M.useProfiles(ids);
    const nm = id => (profs[id] && profs[id].name) || (ctx.members[id] && ctx.members[id].name) || 'Someone';
    const first = id => nm(id).split(/\s+/)[0];
    const person = id => () => nav(id === ctx.uid ? '#today' : '#people/' + id);

    const startMin = U.minutes(S.start || '10:30');
    const grace = Number(S.grace) || 0;
    const afterCut = nowMin > startMin + grace;

    /* ---- attendance ---- */
    const byId = (a, b) => (a.empId ? 0 : 1) - (b.empId ? 0 : 1) || String(a.empId || '').localeCompare(String(b.empId || ''), undefined, {numeric: true}) || nm(a.uid).localeCompare(nm(b.uid));
    const att = members.slice().sort(byId).map(m => {
      const d = (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, m.uid, today) : {status: 'none'};
      const wk = ctx.isWorkingDay(today, m.uid);
      const f = [];
      if (d.status === 'office') f.push('off'); else if (d.status === 'wfh') f.push('wfh');
      if (d.late) f.push('late');
      if (d.status === 'leave') f.push('leave');
      if (d.status === 'none' && wk) f.push('out');
      return {m, d, wk, f};
    });
    const working = att.filter(r => r.wk || r.d.status === 'office' || r.d.status === 'wfh');
    const inT = att.filter(r => r.d.status === 'office' || r.d.status === 'wfh');
    const notIn = att.filter(r => r.f.indexOf('out') >= 0);
    const late = inT.filter(r => r.d.late);
    const office = inT.filter(r => r.d.status === 'office');
    const verified = office.filter(r => r.d.verified);
    const lv = att.filter(r => r.d.status === 'leave');

    /* the morning clock: an hour before start to now, at least three hours */
    const A0 = Math.floor((startMin - 60) / 60) * 60;
    let A1 = Math.max(A0 + 180, Math.min(1440, Math.ceil((nowMin + 30) / 60) * 60));
    if (A1 - A0 > 720) A1 = A0 + 720;
    const apos = m => clamp((m - A0) / (A1 - A0) * 100, 0, 100);
    const pct = x => x.toFixed(3) + '%';
    const nowOn = nowMin >= A0 && nowMin <= A1;
    const labs = [[A0, hm(A0), ''], [startMin, S.start || '10:30', ''], ...(nowOn ? [[nowMin, 'NOW', 'al']] : []), [A1, hm(A1), '']].sort((a, b) => a[0] - b[0]);
    const keep = [];
    labs.forEach(lb => { const p = keep[keep.length - 1]; if (!p || apos(lb[0]) - apos(p[0]) >= 14) keep.push(lb); else if (lb[2] === 'al') keep[keep.length - 1] = lb; });

    /* ---- the rest of the numbers ---- */
    const k = useMemo(() => {
      const yday = prevWorkingDay(ctx, today);
      const yWork = members.filter(m => ctx.isWorkingDay(yday, m.uid) && (!okYmd(m.joined) || m.joined <= yday));
      const yEod = yWork.filter(m => (((ctx.coll.eod.map[m.uid] || {}).days || {})[yday]));
      const weekId = U.isoWeek(now);
      const marks = [];
      members.forEach(m => {
        const plan = ((ctx.coll.plan.map[m.uid] || {}).weeks || {})[weekId];
        const rev = ((ctx.coll.review.map[m.uid] || {}).weeks || {})[weekId];
        const mk = (rev && rev.marks) || {};
        ((plan && plan.items) || []).forEach(it => marks.push(mk[it && it.id] === 'hit' ? '' : mk[it && it.id] === 'miss' ? 'f' : 'g'));
      });
      const tasks = ctx.coll.tasks.map;
      const overdue = Object.keys(tasks).filter(id => tasks[id] && tasks[id].status !== 'done' && tasks[id].due && tasks[id].due < today).map(id => tasks[id]);
      const pm = (M.pitches && M.pitches.metrics) ? M.pitches.metrics(ctx) : {weighted: 0, byStage: {}, overdue: []};
      const sh = (money && M.clients && M.clients.shares) ? M.clients.shares(ctx) : [];
      const total = sh.reduce((n, r) => n + (r.monthly || 0), 0);
      const top = sh.slice().sort((a, b) => (b.monthly || 0) - (a.monthly || 0))[0];
      const energy = (M.voice && M.voice.energyByWeek) ? M.voice.energyByWeek(ctx, 8) : [];
      const lastE = energy.slice().reverse().find(e => e && e.avg != null) || null;
      return {yday, yWork, yEod, marks, overdue, pm, sh, total, top, lastE};
    }, [ctx, members, today]);

    const flagsAll = ctx.flags || [];
    const high = flagsAll.filter(f => f.severity === 'high');

    /* ---- needs you ---- */
    const needs = [];
    if (M.leave && M.leave.pending) {
      M.leave.pending(ctx).forEach(({uid, req}) => {
        const days = (M.leave.dayCount ? M.leave.dayCount(req) : 1) || 1;
        const sub = nm(uid) + ', ' + rangeShort(req) + ', ' + String(LEAVE_T[req.type] || 'Leave').toLowerCase();
        const decide = status => () => {
          const r = ((((ctx.coll.leave.map[uid] || {}).reqs) || []).find(x => x && x.id === req.id)) || req;
          const snap = status === 'approved' ? {snap: {from: r.from || '', to: r.to || '', type: r.type || 'casual'}} : {};
          return ctx.W.merge('leavedec/' + uid, {d: {[req.id]: {status, at: Date.now(), by: ctx.uid, ...snap}}});
        };
        const back = () => ctx.W.merge('leavedec/' + uid, {d: {[req.id]: null}});
        needs.push({k: 'lv:' + uid + ':' + req.id, kind: 'leave', swipe: true, tag: LEAVE_TAG[req.type] || 'Leave request', when: plural(days, 'day'),
          who: nm(uid), whoGo: person(uid), detail: (LEAVE_T[req.type] || 'Leave') + ', ' + rangeShort(req), sub,
          ok: {label: 'Approve', msg: 'Approved', run: decide('approved'), undo: back},
          no: {label: 'Decline', msg: 'Declined', run: decide('declined'), undo: back}});
      });
    }
    joins.forEach(j => needs.push({k: 'jr:' + j.uid, kind: 'join', tag: 'Join request', when: 'asked ' + U.timeAgo(j.at || Date.now()),
      who: nm(j.uid), detail: j.title ? j.title + ', wants to join m360' : 'Wants to join m360', sub: nm(j.uid) + ', join request',
      ok: {label: 'Add', go: () => nav('#admin')},
      no: {label: 'Dismiss', msg: 'Dismissed', run: () => M.team.clear(ctx, j.uid), undo: () => ctx.W.set('join/' + j.uid, {at: j.at || Date.now(), title: j.title || ''})}}));
    const H = M.hiring;
    const cands = (H && H.candidatesOf) ? H.candidatesOf(ctx) : [];
    const candOf = id => cands.find(c => c.id === id) || {};
    const panel = (H && H.panel) ? H.panel(ctx) : [];
    panel.filter(p => p.total > 0 && p.submitted >= p.total).forEach(p => {
      const c = candOf(p.id);
      needs.push({k: 'hd:' + p.id, kind: 'decide', tag: 'Hire', when: 'panel done', who: p.candidate,
        detail: (c.role ? c.role + ', ' : '') + p.submitted + ' of ' + p.total + ' reads in', ok: {label: 'Decide', go: () => nav('#hiring/' + p.id)}});
    });
    ((H && H.assignedToMe) ? H.assignedToMe(ctx) : []).forEach(id => {
      const c = candOf(id);
      needs.push({k: 'ev:' + id, kind: 'eval', tag: 'Panel read', when: okYmd(c.deadline) ? 'by ' + dm(c.deadline) : 'due', who: c.name || 'Candidate',
        detail: (c.role ? c.role + ', ' : '') + 'your read is due', ok: {label: 'Evaluate', go: () => nav('#hiring/' + id)}});
    });
    high.forEach((f, i) => needs.push({k: 'fl:' + (f.key || f.rule + f.uid + i), kind: 'flag', tag: 'High flag', when: f.rule, who: f.uid === ctx.uid ? 'You' : nm(f.uid),
      whoGo: f.uid ? person(f.uid) : null, detail: f.text,
      ok: {label: 'Open', go: f.uid && f.uid !== ctx.uid ? person(f.uid) : () => nav(f.ref || '#today')},
      no: {label: 'Rule', go: () => nav(f.section ? '#handbook/' + f.section : (f.ref || '#handbook'))}}));
    const shown = needs.slice(0, 8);

    /* ---- flags ---- */
    const names = (M.rules && M.rules.NAMES) || {};
    const ruleIds = (M.rules && M.rules.RULE_IDS) || Object.keys(names);
    const byRule = flagsAll.filter(f => !rule || f.rule === rule);
    const fl = byRule.filter(f => !sev || f.severity === sev);
    const sevN = s => byRule.filter(f => !s || f.severity === s).length;

    /* ---- business ---- */
    const board = (M.points && M.points.leaderboard) ? M.points.leaderboard(ctx, 'week', now).slice().sort((a, b) => b.total - a.total).slice(0, 5) : [];
    const lbMax = Math.max(1, ...board.map(r => Math.max(0, r.total)));
    const stages = ((M.pitches && M.pitches.STAGES) || []).filter(s => s.v !== 'won' && s.v !== 'lost');
    const pmap = ctx.coll.pitches.map;
    const openN = stages.reduce((n, s) => n + (((k.pm.byStage || {})[s.v] || {}).count || 0), 0);
    const stW = s => { const b = (k.pm.byStage || {})[s.v] || {count: 0, value: 0}; return money ? b.value : b.count; };
    const stMax = Math.max(1, ...stages.map(stW));
    const monthStart = U.ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const wonMonth = Object.keys(pmap).filter(id => pmap[id] && pmap[id].stage === 'won' && pmap[id].stageAt && U.ymd(new Date(pmap[id].stageAt)) >= monthStart).length;
    const nextOver = (k.pm.overdue || []).length;
    const projMap = ctx.coll.projects.map;
    const projs = Object.keys(projMap).map(id => ({id, ...projMap[id]})).filter(p => p && !p.archived && p.status !== 'done');
    const ph = {on: 0, risk: 0, off: 0};
    projs.forEach(p => { const s = ph[p.status] != null ? p.status : 'on'; ph[s]++; });
    const shaky = projs.filter(p => p.status === 'risk' || p.status === 'off').sort((a, b) => (a.status === 'off' ? 0 : 1) - (b.status === 'off' ? 0 : 1)).slice(0, 5);
    const progOf = p => { const r = (M.projects && M.projects.progress) ? M.projects.progress(ctx, p.id) : {done: 0, total: 0}; return r.total ? Math.round(100 * r.done / r.total) : 0; };

    /* ---- team ---- */
    const crew = members.filter(m => m.uid !== ctx.founderUid);
    const monthId = U.monthId(now);
    const keeper = ((ctx.priv.keeper && ctx.priv.keeper.data) || {}).notes || {};
    const LAD = {clear: 'Clear', note: 'Written note', warning: 'Warning', exit: 'Exit talk'};
    const pulses = (M.voice && M.voice.latest) ? M.voice.latest(ctx).filter(x => x.change || x.broken || x.working).slice(0, 2) : [];

    /* ---- clients ---- */
    const cmap = ctx.coll.clients.map;
    const shareOf = {};
    k.sh.forEach(r => { shareOf[r.id] = r; });
    const cids = Object.keys(cmap).filter(id => cmap[id])
      .sort((a, b) => ((shareOf[b] || {}).monthly || 0) - ((shareOf[a] || {}).monthly || 0) || String(cmap[a].name || '').localeCompare(String(cmap[b].name || '')));
    const brainOf = c => ['memory', 'approvals', 'never'].filter(f => String((c && c[f]) || '').trim()).length;
    const openOf = id => (M.clients && M.clients.openTaskCount) ? M.clients.openTaskCount(ctx, id) : 0;
    const topPct = k.total && k.top ? Math.round(100 * (k.top.monthly || 0) / k.total) : null;
    const paid = cids.filter(id => (shareOf[id] || {}).monthly > 0);

    /* ---- the header ---- */
    const hr = now.getHours();
    const meFirst = first(ctx.uid);
    const greet = (hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (meFirst && meFirst !== 'Someone' ? ', ' + meFirst : '') + '.';
    /* the LIVE line reads the island's own news (02-z-chrome.js M.chrome.events), newest first, the last day */
    const dayAgo = Date.now() - 24 * 3600000;
    const lines = (M.chrome && M.chrome.events ? M.chrome.events(ctx, id => nm(id) || 'Someone') : []).filter(e => (e.at || 0) > dayAgo).slice(0, 6).map(e => e.text);

    /* ---- motion: reveal on scroll, the dark band opens, the rail follows, a soft light follows the pointer ---- */
    const SEC = [['c-need', 'needs you'], ['c-nums', 'numbers'], ['c-att', 'attendance'], ['c-flg', 'flags'], ['c-biz', 'business'], ['c-team', 'team'], ['c-cli', 'clients']];
    const railRef = useRef(null);
    useEffect(() => {
      const el = root.current;
      if (!el) return undefined;
      const rvs = Array.from(el.querySelectorAll('.c-rv'));
      let io = null;
      if ('IntersectionObserver' in window && !RM()) {
        io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -6% 0px', threshold: 0});
        rvs.forEach(r => { if (!r.classList.contains('in')) io.observe(r); });
      } else rvs.forEach(r => r.classList.add('in'));
      return () => { if (io) io.disconnect(); };
    }, []);
    useEffect(() => {
      let ticking = false;
      const frame = () => {
        ticking = false;
        const vh = window.innerHeight, dark = document.getElementById('c-biz'), rail = railRef.current;
        if (dark) {
          const r = dark.getBoundingClientRect();
          dark.style.setProperty('--e', (RM() ? 1 : clamp((vh - r.top) / (vh * 0.7), 0, 1)).toFixed(4));
          if (rail) rail.classList.toggle('dk', r.top < vh / 2 + 120 && r.bottom > vh / 2 - 120);
        }
        if (!rail) return;
        const line = vh * 0.32;
        const tops = SEC.map(s => { const e = document.getElementById(s[0]); return e ? e.getBoundingClientRect().top - line : 1e9; });
        let idx = 0;
        tops.forEach((t, i) => { if (t <= 0) idx = i; });
        let p = idx;
        if (idx < tops.length - 1) { const a = tops[idx], b = tops[idx + 1]; if (b !== a) p = idx + clamp(-a / (b - a), 0, 1); }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) { idx = tops.length - 1; p = idx; }
        const fill = rail.querySelector('.c-rtr i');
        if (fill) fill.style.transform = 'scaleY(' + (p / (tops.length - 1)).toFixed(4) + ')';
        rail.querySelectorAll('.c-ri').forEach((b, i) => { b.classList.toggle('on', i === idx); b.classList.toggle('past', i < idx); });
      };
      const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
      const spot = e => {
        const s = e.target.closest && e.target.closest('.cmd7 .spot');
        if (!s) return;
        const r = s.getBoundingClientRect();
        s.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); s.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      };
      window.addEventListener('scroll', on, {passive: true});
      window.addEventListener('resize', on);
      document.addEventListener('pointermove', spot, {passive: true});
      frame(); const t = setTimeout(frame, 400);
      return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); document.removeEventListener('pointermove', spot); clearTimeout(t); };
    }, []);
    /* while something waits the mark clears its throat now and then */
    const needRef = useRef(0);
    needRef.current = needs.length;
    useEffect(() => {
      const t = setInterval(() => { if (needRef.current && !document.hidden && M.mark) M.mark.ahem(); }, 16000);
      return () => clearInterval(t);
    }, []);
    /* clients: rows and the share line light each other up */
    const [hl, setHl] = useState(null);
    const hlOn = id => () => setHl(id), hlOff = () => setHl(null);

    /* ---- the numbers ---- */
    const vb = (arr, dense) => html`<span class=${cls('c-viz vb', (dense || arr.length > 14) && 'dense')}>${arr.slice(0, 40).map((c, i) => html`<i key=${i} class=${c || null} style=${{'--j': i}}></i>`)}</span>`;
    const T0v = startMin - 60, T1v = startMin + 120;
    const vpos = m => pct(clamp((m - T0v) / (T1v - T0v) * 100, 0, 100));
    const lateViz = html`<span class="c-viz vt"><i class="t0" style=${{left: vpos(startMin)}}></i>${inT.slice(0, 30).map((r, i) => html`<i key=${r.m.uid} class=${cls('d', r.d.late && 'f')} style=${{left: vpos(minOf(r.d.in)), '--j': i + 1}}></i>`)}</span>`;
    const e = k.lastE;
    const eFull = e ? Math.floor(e.avg) : 0, eFrac = e ? e.avg - eFull : 0;
    const energyViz = html`<span class="c-viz ve">${[0, 1, 2, 3, 4].map(i => {
      const part = i === eFull && eFrac > 0;
      return html`<i key=${i} class=${i < eFull || part ? null : 'g'} style=${{'--j': i, ...(part ? {background: 'linear-gradient(to top,var(--ink) ' + Math.round(eFrac * 100) + '%,var(--g12) ' + Math.round(eFrac * 100) + '%)'} : {})}}></i>`;
    })}</span>`;
    const pipeViz = html`<span class="c-viz vs">${k.pm.weighted ? stages.filter(s => ((k.pm.byStage || {})[s.v] || {}).value > 0).map((s, i) => {
      const v = ((k.pm.byStage || {})[s.v] || {}).value || 0;
      return html`<i key=${s.v} style=${{flex: v, '--a': (0.18 + 0.74 * (s.prob || 10) / 75).toFixed(2), '--j': i}}></i>`;
    }) : html`<i style=${{flex: 1, '--a': 0.12}}></i>`}</span>`;
    const meter = (p, hot) => html`<span class="c-viz vm"><i class=${cls('fill', hot && 'f')} style=${{width: clamp(p || 0, 0, 100) + '%'}}></i><i class="mk25" style=${{left: '25%'}}></i><i class="vml" style=${{left: 'calc(25% + 8px)'}}>cap 25%</i></span>`;
    const yLab = 'eod ' + DAY_L[U.parseYmd(k.yday).getDay()];
    const missedN = k.marks.filter(x => x === 'f').length;
    const hitN = k.marks.filter(x => x === '').length;

    const T = [
      {g: 'people', k: 'in', l: 'in today', v: [String(inT.length) + '/' + working.length, html`<b>${inT.length}</b><span>/${working.length}</span>`],
        viz: vb(working.map(r => (r.d.status === 'office' || r.d.status === 'wfh') ? '' : (afterCut ? 'f' : 'g'))),
        c: notIn.length ? (afterCut ? 'Not in: ' : 'Still to come: ') + notIn.map(r => nm(r.m.uid)).join(', ') : lv.length ? 'Everyone else is in' : working.length ? 'Everyone is in' : 'Nobody working today',
        hot: afterCut && notIn.length > 0, go: () => { setAttF(afterCut && notIn.length ? 'out' : ''); glideTo('c-att', '#c-att .c-tr.c-rw'); }},
      {g: 'people', k: 'late', l: 'late today', v: [String(late.length), html`<b>${late.length}</b>`], viz: lateViz,
        c: late.length === 1 ? nm(late[0].m.uid) + ', ' + U.hhmm(late[0].d.in) : late.length ? late.map(r => first(r.m.uid) + ' ' + U.hhmm(r.d.in)).join(', ') : 'Nobody late',
        hot: late.length > 0, go: () => { setAttF(late.length ? 'late' : ''); glideTo('c-att', '#c-att .c-tr.c-rw'); }},
      {g: 'people', k: 'ver', l: 'office verified', v: office.length ? [String(Math.round(100 * verified.length / office.length)), html`<b>${Math.round(100 * verified.length / office.length)}</b><span>%</span>`] : ['none', 'none yet'], word: !office.length,
        viz: vb(office.map(r => r.d.verified ? '' : 'f')), c: office.length ? verified.length + ' of ' + office.length : 'No office check-ins yet',
        hot: office.length > 0 && verified.length < office.length, go: () => { setAttF(office.length ? 'off' : ''); glideTo('c-att', '#c-att .c-tr.c-rw'); }},
      {g: 'people', k: 'eod', l: yLab, v: [k.yEod.length + '/' + k.yWork.length, html`<b>${k.yEod.length}</b><span>/${k.yWork.length}</span>`],
        viz: vb(k.yWork.map(m => (((ctx.coll.eod.map[m.uid] || {}).days || {})[k.yday]) ? '' : 'g')),
        c: k.yWork.length && k.yEod.length < k.yWork.length ? 'Missing: ' + k.yWork.filter(m => !(((ctx.coll.eod.map[m.uid] || {}).days || {})[k.yday])).map(m => nm(m.uid)).join(', ') : k.yWork.length ? 'Everyone filed' : 'Nobody worked that day',
        hot: false, go: () => nav('#week')},
      {g: 'mood', k: 'mood', l: 'team energy', v: e ? [e.avg.toFixed(1), html`<b>${e.avg.toFixed(1)}</b><span>/5</span>`] : ['none', 'none yet'], word: !e, viz: energyViz,
        c: e ? 'Week ' + Number(String(e.week).split('-W')[1]) + ', ' + plural(e.n, 'reply', 'replies') : 'No pulse yet', hot: !!(e && e.avg < 3), go: () => glideTo('c-vox', '#c-vox .c-q')},
      {g: 'work', k: 'out', l: 'outcomes hit', v: [hitN + '/' + k.marks.length, html`<b>${hitN}</b><span>/${k.marks.length}</span>`], viz: vb(k.marks, true),
        c: k.marks.length ? 'This week' + (missedN ? ', ' + missedN + ' missed' : '') : 'No outcomes posted yet', hot: false, go: () => nav('#week')},
      {g: 'work', k: 'due', l: 'tasks overdue', v: [String(k.overdue.length), html`<b>${k.overdue.length}</b>`], viz: vb(k.overdue.map(() => 'f'), true),
        c: k.overdue.length ? 'Across the team' : 'Nothing overdue', hot: k.overdue.length > 0, go: () => nav('#tasks')},
      {g: 'work', k: 'hf', l: 'high flags', v: [String(high.length), html`<b>${high.length}</b>`], viz: vb(flagsAll.map(f => f.severity === 'high' ? 'f' : f.severity === 'low' ? 'g' : ''), true),
        c: plural(flagsAll.length, 'flag') + ' in total', hot: high.length > 0, go: () => { setSev(high.length ? 'high' : ''); glideTo('c-flg', '#c-flg .c-fl'); }}
    ].concat(money ? [
      {g: 'money', k: 'pipe', l: 'weighted pipeline', v: [U.inr(k.pm.weighted), html`<b>${U.inr(k.pm.weighted)}</b>`], long: true, viz: pipeViz,
        c: plural(openN, 'open deal') + ', a month', hot: false, go: () => glideTo('c-ppl', '#c-ppl .c-ppr')},
      {g: 'money', k: 'cl', l: 'largest client', v: topPct != null ? [String(topPct), html`<b>${topPct}</b><span>%</span>`] : ['none', 'none yet'], word: topPct == null,
        viz: meter(topPct || 0, topPct != null && topPct > 25), c: topPct != null ? (cmap[k.top.id] ? cmap[k.top.id].name : 'Client') + ', share of revenue' : 'No revenue set',
        hot: topPct != null && topPct > 25, go: () => glideTo('c-cli', topPct != null ? '#c-cli .c-ct.c-rw[data-id="' + k.top.id + '"]' : null)}
    ] : []);
    const seenG = {};
    const tile = (o, i) => {
      const firstOf = !seenG[o.g]; seenG[o.g] = 1;
      return html`<button type="button" key=${o.k} class=${cls('c-kp', o.hot && 'hot')} data-k=${o.k} onClick=${o.go}>
        ${firstOf ? html`<i class="c-kgl">${o.g}</i>` : null}
        <span class="c-kl"><span class="cap">${o.l}</span><${Go}/></span>
        <${Roll} k=${o.v[0]} i=${i} long=${o.long} word=${o.word}>${o.v[1]}<//>
        ${o.viz}
        <${Cap} text=${o.c}/>
      </button>`;
    };

    /* ---- attendance rows ---- */
    const statusText = r => r.d.status === 'office' ? 'In office' : r.d.status === 'wfh' ? 'WFH' : r.d.status === 'leave' ? 'On leave' : r.d.status === 'holiday' ? 'Holiday'
      : r.d.status === 'sunday' || !r.wk ? 'Off today' : 'Not in yet';
    const attCount = {'': att.length, off: office.length, wfh: inT.length - office.length, late: late.length, out: notIn.length, leave: lv.length};
    const chips = [['', 'All'], ['off', 'In office'], ['wfh', 'WFH'], ['late', 'Late'], ['out', 'Not in'], ['leave', 'Leave']];
    const rowsShown = att.filter(r => !attF || r.f.indexOf(attF) >= 0);
    const dayCell = (r, i) => {
      const parts = [html`<i key="g" class="g10" style=${{left: pct(apos(startMin))}}></i>`];
      if (nowOn) parts.push(html`<i key="n" class="gn" style=${{left: pct(apos(nowMin))}}></i>`);
      if (r.d.in) {
        const a = minOf(r.d.in), b = r.d.out ? minOf(r.d.out) : nowMin;
        parts.push(html`<i key="b" class=${cls('b', !r.d.out && 'live')} style=${{left: pct(apos(a)), width: pct(Math.max(0.6, apos(b) - apos(a))), '--j': i}}></i>`);
        parts.push(html`<i key="o" class="ot" style=${{left: pct(apos(a))}}>in ${U.hhmm(r.d.in)}${r.d.out ? ', out ' + U.hhmm(r.d.out) : ''}</i>`);
        if (r.d.late) parts.push(html`<i key="l" class="lt" style=${{left: pct(apos(a))}}></i>`);
      } else if (r.f.indexOf('out') >= 0 && afterCut && nowOn) parts.push(html`<i key="d" class="nd" style=${{left: pct(apos(nowMin))}}></i>`);
      return html`<span class="c-day">${parts}</span>`;
    };
    const place = r => {
      const l = r.d.loc;
      if (!r.d.in) return '';
      if (r.d.status === 'wfh' && !(l && l.place)) return 'Home';
      const map = l && l.lat != null && !l.verified ? html`<a class="c-map" href=${'https://www.google.com/maps?q=' + l.lat + ',' + l.lng} target="_blank" rel="noopener noreferrer" onClick=${ev => ev.stopPropagation()}>map</a>` : null;
      return html`${(l && l.place) || r.d.place || (r.d.status === 'wfh' ? 'Home' : 'No location')}${r.d.status === 'office' ? html`<span class=${cls('c-vf', !r.d.verified && 'al')}>${r.d.verified ? 'verified' : 'unverified'}</span>` : null}${map}`;
    };

    /* export: today's attendance as a CSV file, the rows the filter shows */
    const exportAtt = () => {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const rows = [['ID', 'Person', 'Status', 'Place', 'Verified', 'In', 'Out', 'Late']].concat(rowsShown.map(r => [r.m.empId || '', nm(r.m.uid), statusText(r),
        (r.d.loc && r.d.loc.place) || r.d.place || '', r.d.status === 'office' ? (r.d.verified ? 'yes' : 'no') : '', r.d.in ? U.hhmm(r.d.in) : '', r.d.out ? U.hhmm(r.d.out) : '', r.d.late ? 'yes' : '']));
      const blob = new Blob([rows.map(r => r.map(q).join(',')).join('\n')], {type: 'text/csv'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'attendance-' + today + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (M.island) M.island.toast('Attendance exported');
    };
    const needN = needs.length;
    return html`<div class="cmd7" id="cmd7" ref=${root}>
      <header class="c-top" id="c-top">
        <div class="c-tl">
          <span class="c-lab">${U.dateLabel(now)}</span>
          <h1>Command<i class="c-fd">.</i></h1>
          <p class="c-lede"><span id="c-greet">${greet}</span>${needN
            ? html`<a class="c-needl" id="c-needl" href="#command" onClick=${ev => { ev.preventDefault(); glideTo('c-need', '#c-need .c-ncw:not(.gone) .c-nc'); }}><b>${needN}</b> ${needN === 1 ? 'thing needs you' : 'things need you'}<i class="ar"></i></a>`
            : html`<span class="c-needl ok" id="c-needl">All clear.</span>`}</p>
        </div>
        <div class="c-tr2">
          <button class="c-askf" id="c-ask" type="button" aria-label="Ask m360 anything"><span class="c-wv" aria-hidden="true"><i style=${{'--k': 0}}></i><i style=${{'--k': 1}}></i><i style=${{'--k': 2}}></i><i style=${{'--k': 3}}></i></span><span class="c-ph">Ask m360 anything</span><kbd class="c-kb">${CMDK}K</kbd></button>
          <div class="c-live"><span class="c-chip"><i></i>live</span><${Ticker} lines=${lines}/></div>
        </div>
      </header>

      <section class="c-sec" id="c-need">
        <${Head} n="01" t="needs you"><span class=${cls('c-pl tn', needN > 0 && 'hot')} id="c-np">${needN ? needN + ' waiting' : 'all clear'}</span><//>
        ${shown.length ? html`<div class="c-ngrid" id="c-ngrid" ref=${grid}>${shown.map((n, i) => html`<${NeedCard} key=${n.k} n=${n} j=${i} grid=${grid}/>`)}</div>` : null}
        ${shown.length ? null : html`<div class="c-clear" id="c-nclear"><span class="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span><div><b>All clear.</b><p>Nothing needs you right now.</p></div></div>`}
      </section>

      <section class="c-sec" id="c-nums">
        <${Head} n="02" t="numbers, today"><span class="c-pl tn">${'week ' + Number(U.isoWeek(now).split('-W')[1])}</span><//>
        <div class="c-kpis" id="c-kpis">
          <div class="c-kg" style=${{gridColumn: 'span 4'}}>people</div><div class="c-kg">mood</div>
          ${T.slice(0, 5).map((o, i) => tile(o, i))}
          <div class="c-kg k2" style=${{gridColumn: money ? 'span 3' : 'span 5'}}>work</div>${money ? html`<div class="c-kg k2" style=${{gridColumn: 'span 2'}}>money</div>` : null}
          ${T.slice(5).map((o, i) => tile(o, i + 5))}
        </div>
      </section>

      <section class="c-band warm c-ops">
        <div class="c-card c-rv" id="c-att">
          <${Head} n="03" t=${hr < 12 ? 'attendance, this morning' : 'attendance, today'}><button class="c-pl" type="button" id="c-export" onClick=${exportAtt}>export</button><//>
          <div class="c-fcs" id="c-attF" role="group" aria-label="Filter attendance">
            ${chips.map(c => html`<button key=${c[0] || 'all'} class=${cls('c-fc', attF === c[0] && 'on')} type="button" data-f=${c[0]} aria-pressed=${attF === c[0] ? 'true' : 'false'} onClick=${() => setAttF(c[0])}>${c[1]} <b class=${cls('tn', ((c[0] === 'late' && attCount.late > 0) || (c[0] === 'out' && attCount.out > 0 && afterCut)) && 'al')}>${attCount[c[0]]}</b></button>`)}
          </div>
          <div class="c-atb" role="table" aria-label="Attendance today">
            <div class="c-tr hd cap" role="row"><span class="c-id">ID</span><span>PERSON</span><span>STATUS</span><span class="c-plc">PLACE</span><span>IN</span><span class="c-dh">${keep.map(lb => html`<i key=${lb[1]} class=${lb[2] || null} style=${{left: pct(apos(lb[0]))}}>${lb[1]}</i>`)}</span></div>
            ${rowsShown.map((r, i) => html`<div class="c-tr c-rw c-lnk c-fresh" role="row" key=${r.m.uid + ':' + attF} data-id=${r.m.uid} data-f=${r.f.join(' ')} tabIndex="0" onClick=${person(r.m.uid)} onKeyDown=${ev => { if (ev.key === 'Enter') person(r.m.uid)(); }}>
              <span class="c-id cap c-soft tn">${r.m.empId || ''}</span>
              <span><span class="c-nm">${nm(r.m.uid)}</span></span>
              <span class=${cls('c-stt', r.f.indexOf('out') >= 0 && afterCut && 'c-al')}>${statusText(r)}</span>
              <span class="c-plc">${place(r)}</span>
              <span class=${cls('tn', r.d.late && 'c-al')}>${r.d.in ? U.hhmm(r.d.in) : ''}</span>
              ${dayCell(r, i)}<${Go}/>
            </div>`)}
          </div>
          ${rowsShown.length ? null : html`<p class="c-empty">${att.length ? 'Nobody here.' : 'Nobody on the roster yet.'}</p>`}
        </div>

        <div class="c-card c-rv" id="c-flg">
          <${Head} n="04" t="flags">
            <label class="c-sel"><select aria-label="Rule filter" value=${rule} onChange=${ev => setRule(ev.target.value)}>
              <option value="">all rules</option>
              ${ruleIds.map(id => html`<option key=${id} value=${id}>${names[id] || id}</option>`)}
            </select>${CHEV}</label>
          <//>
          <div class="c-fcs" id="c-flgF" role="group" aria-label="Filter flags">
            ${[['', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(c => html`<button key=${c[0] || 'all'} class=${cls('c-fc', sev === c[0] && 'on')} type="button" data-f=${c[0]} aria-pressed=${sev === c[0] ? 'true' : 'false'} onClick=${() => setSev(c[0])}>${c[1]} <b class=${cls('tn', c[0] === 'high' && sevN('high') > 0 && 'al')}>${sevN(c[0])}</b></button>`)}
          </div>
          ${fl.length ? html`<div class="c-fls">${fl.slice(0, allF ? 200 : 8).map((f, i) => html`<button type="button" class="c-fl c-row c-lnk c-fresh" key=${(f.key || f.rule + f.uid) + ':' + i} data-rule=${f.rule} data-f=${f.severity}
              onClick=${f.uid ? person(f.uid) : () => nav(f.ref || '#today')}>
              <span class=${cls('c-sev', f.severity === 'high' && 'h', f.severity === 'medium' && 'm')}></span>
              <span><b><span class="c-nm">${f.uid === ctx.uid ? 'You' : nm(f.uid)}</span>, ${names[f.rule] || f.rule}</b><p>${f.text}</p></span><${Go}/>
            </button>`)}</div>
            ${fl.length > 8 ? html`<div class="c-all"><button type="button" class="c-pl" onClick=${() => setAllF(x => !x)}>${allF ? 'show 8' : 'show all ' + fl.length}</button></div>` : null}`
            : html`<p class="c-empty">All clear.</p>`}
        </div>
      </section>

      <section class="c-band dark spot" id="c-biz">
        <div class="c-g543">
          <div class="c-rv" id="c-lbd">
            <${Head} n="05" t="leaderboard, this week"><button class="c-pl" type="button" onClick=${() => nav('#scores')}>scores</button><//>
            ${board.length ? board.map((r, i) => html`<button type="button" class=${cls('c-lbr c-row c-lnk', i === 0 && 'first')} key=${r.uid} onClick=${person(r.uid)}>
              <span class="rk c-dsoft tn">${i + 1}</span>
              <span class="whom"><span class="c-nm">${nm(r.uid)}</span><i class="ln" style=${{'--w': Math.max(4, Math.round(100 * Math.max(0, r.total) / lbMax)) + '%'}}></i></span>
              <${CountUp} to=${r.total} className="c-pts"/><${Go}/>
            </button>`) : html`<p class="c-empty">No points yet.</p>`}
          </div>
          <div class="c-rv" id="c-ppl">
            <${Head} n="06" t="pipeline"><button class="c-pl" type="button" onClick=${() => nav('#pitches')}>open</button><//>
            <div class="c-pls">${money ? html`<${CountUp} to=${k.pm.weighted} fmt="inr" className="v tn" block=${true}/>` : html`<${CountUp} to=${openN} className="v tn" block=${true}/>`}
              <div class="cap">${money ? plural(openN, 'open deal') + ', a month' : plural(openN, 'open pitch', 'open pitches')}</div></div>
            ${stages.map((s, i) => {
              const b = (k.pm.byStage || {})[s.v] || {count: 0, value: 0};
              return html`<button type="button" class="c-ppr c-row c-lnk" key=${s.v} style=${{'--j': i}} onClick=${() => nav('#pitches')}>
                <span class="c-ppt"><span>${s.label}</span><b>${b.count}${money && b.value ? ', ' + U.inr(b.value) : ''}</b></span>
                <span class="c-ppb"><i style=${{'--w': Math.round(100 * stW(s) / stMax) + '%', '--a': (0.3 + 0.65 * (s.prob || 10) / 75).toFixed(2), '--j': i}}></i></span><${Go}/>
              </button>`;
            })}
            <div class="c-kvr c-row"><span class="c-dsoft">Won this month</span><span class="tn">${wonMonth}</span></div>
            <div class="c-kvr c-row"><span class="c-dsoft">Next steps overdue</span><span class=${cls('tn', nextOver > 0 && 'c-al')}>${nextOver}</span></div>
          </div>
          <div class="c-rv" id="c-pjc">
            <${Head} n="07" t="projects"><button class="c-pl" type="button" onClick=${() => nav('#projects')}>open</button><//>
            <div class="c-pjs">
              <div><${CountUp} to=${ph.on} className="v" block=${true}/><div class="cap">ON TRACK</div></div>
              <div><${CountUp} to=${ph.risk} className="v" block=${true}/><div class="cap">AT RISK</div></div>
              <div><${CountUp} to=${ph.off} className=${cls('v', ph.off > 0 && 'c-al')} block=${true}/><div class="cap">${ph.off ? html`<i class="adot"></i>` : null}OFF</div></div>
            </div>
            ${shaky.length ? shaky.map(p => { const g = progOf(p), off = p.status === 'off';
              return html`<button type="button" class="c-pjr c-row c-lnk" key=${p.id} onClick=${() => nav('#projects/' + p.id)}>
                <span class="c-pjt"><span class="grow c-nm">${p.name || 'Project'}</span><span class="tn pp">${g}%</span></span>
                <span class="c-pjb"><i class=${off ? 'off' : null} style=${{'--p': g + '%'}}></i></span>
                <span class=${cls('c-pst', off ? 'c-al' : 'c-dsoft')}>${off ? 'Off track' : 'At risk'}</span><${Go}/>
              </button>`; }) : html`<p class="c-empty">${projs.length ? 'Every live project is on track.' : 'No live projects.'}</p>`}
          </div>
        </div>
      </section>

      <section class="c-sec" id="c-team">
        <div class="c-g444">
          <div class="c-rv" id="c-ppl8">
            <${Head} n="08" t="people"><button class="c-pl" type="button" onClick=${() => nav('#admin')}>desk</button><//>
            ${crew.length ? crew.map(m => {
              const lad = (M.points && M.points.ladder) ? M.points.ladder(ctx, m.uid, now) : {level: 'clear'};
              const kd = (keeper[m.uid] || {})[monthId];
              const nh = (M.people && M.people.isNewHire) ? M.people.isNewHire(ctx, m.uid) : false;
              const pr = nh && M.people.onboardingProgress ? M.people.onboardingProgress(ctx, m.uid) : null;
              const off = (ctx.coll.access && (ctx.coll.access.map[m.uid] || {}).offboard);
              const hot = lad.level !== 'clear';
              return html`<button type="button" class="c-per c-row c-lnk" key=${m.uid} onClick=${person(m.uid)}>
                <span class="c-nm">${nm(m.uid)}</span>
                <span class="c-tags"><span class=${hot ? 'al' : null}>${LAD[lad.level] || 'Clear'}</span>${off ? html` · <span class="al">Offboarding</span>`
                  : pr ? html` · <span class="k">Onboarding ${Math.round(100 * pr.done / Math.max(1, pr.total))}%</span>`
                  : kd ? html` <span class="k">· Keeper done</span>` : ' · Keeper due'}</span><${Go}/>
              </button>`;
            }) : html`<p class="c-empty">Just you so far.</p>`}
          </div>
          <div class="c-rv" id="c-hir">
            <${Head} n="09" t="hiring"><button class="c-pl" type="button" onClick=${() => nav('#hiring')}>open</button><//>
            ${panel.length ? panel.slice(0, 6).map(p => html`<button type="button" class="c-hir c-row c-lnk" key=${p.id} onClick=${() => nav('#hiring/' + p.id)}>
              <span><span class="c-nm">${p.candidate}</span><span class="c-sub">${candOf(p.id).role || ''}</span></span>
              <span class="c-ev"><span class="c-ticks">${Array.from({length: Math.max(1, p.total)}, (x, i) => html`<i key=${i} class=${i < p.submitted ? 'on' : null}></i>`)}</span><span class="tn">${p.submitted}/${p.total}</span></span><${Go}/>
            </button>`) : html`<p class="c-empty">Nobody in the panel.</p>`}
          </div>
          <div class="c-rv" id="c-vox">
            <${Head} n="10" t="voice"><button class="c-pl" type="button" onClick=${() => nav('#voice')}>open</button><//>
            ${pulses.length ? pulses.map((x, i) => html`<div class="c-q c-row" key=${x.id || i}><blockquote>${'“' + String(x.change || x.broken || x.working).trim() + '”'}</blockquote><div class="c-sub">Energy ${x.energy} of 5, anonymous</div></div>`)
              : html`<p class="c-empty">No pulse yet.</p>`}
          </div>
        </div>
      </section>

      <section class=${'c-band warm' + (hl ? ' dim' : '')} id="c-cli">
        <div class="c-card c-rv" id="c-clic">
          <${Head} n="11" t="clients"><button class="c-pl" type="button" onClick=${() => nav('#clients')}>open</button><//>
          ${money ? html`<div class="c-share" aria-hidden="true">${paid.length ? paid.map((id, i) => {
            const v = shareOf[id].monthly, p = 100 * v / k.total;
            return html`<i key=${id} class=${hl === id ? 'hl' : null} onPointerEnter=${hlOn(id)} onPointerLeave=${hlOff}
              style=${{flex: v, background: i === 0 && p > 25 ? 'var(--flame)' : 'rgba(var(--c-ink-rgb),' + Math.max(0.14, 0.92 - i * 0.24).toFixed(2) + ')'}}></i>`;
          }) : html`<i style=${{flex: 1, background: 'var(--g12)'}}></i>`}</div>` : null}
          ${cids.length ? html`
            <div class=${cls('c-ct hd cap', !money && 'nomoney')}><span>CLIENT</span>${money ? html`<span>MONTHLY</span><span>SHARE</span>` : null}<span class="c-op">OPEN</span><span class="c-br">BRAIN</span></div>
            ${cids.map(id => {
              const c = cmap[id], r = shareOf[id] || {}, br = brainOf(c), o = openOf(id);
              const p = money && k.total ? Math.round(100 * (r.monthly || 0) / k.total) : 0;
              return html`<div class=${cls('c-ct c-rw c-lnk', !money && 'nomoney', hl === id && 'hl')} key=${id} data-id=${id} role="button" tabIndex="0"
                onPointerEnter=${hlOn(id)} onPointerLeave=${hlOff} onClick=${() => nav('#clients/' + id)} onKeyDown=${ev => { if (ev.key === 'Enter') nav('#clients/' + id); }}>
                <span><span class="c-nm">${c.name || 'Client'}</span></span>
                ${money ? html`<span class="rvn">${r.kind === 'project' ? (r.fee ? U.inr(r.fee) : 'project') : U.inr(r.monthly || 0)}</span><span class=${cls('tn', p > 25 && 'c-al')}>${p}%</span>` : null}
                <span class="tn c-op">${o}</span><span class=${cls('tn c-br', br < 2 && 'c-al')}>${br}/3</span><${Go}/>
              </div>`;
            })}
            <div class=${cls('c-ct tot', !money && 'nomoney')}><span class="cap">${money ? 'TOTAL, A MONTH' : 'TOTAL'}</span>${money ? html`<span class="rvn">${U.inr(k.total)}</span><span class="tn">${k.total ? '100%' : '0%'}</span>` : null}<span class="tn c-op">${cids.reduce((n, id) => n + openOf(id), 0)}</span><span class="c-br"></span></div>`
            : html`<p class="c-empty">No clients yet.</p>`}
        </div>
      </section>

      ${window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(html`<nav class="c-rail" id="c-rail" ref=${railRef} aria-label="On this page"><span class="c-rtr" aria-hidden="true"><i></i></span>
        ${SEC.map((s, i) => html`<button key=${s[0]} type="button" class="c-ri" style=${{'--k': i}} aria-label=${s[1]} onClick=${() => glideTo(s[0])}><span class="c-rl">${s[1]}</span></button>`)}
      </nav>`, document.body) : null}
    </div>`;
  }

  M.pages.Command = Command;
  M.command = {prevWorkingDay};
})();
