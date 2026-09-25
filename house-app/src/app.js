/* Atenx House members app. Plain ES2020, no framework, one screen at a time. */
(function () {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I = {
  home: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  form: svg('<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>'),
  book: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  events: svg('<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2.5"/>'),
  connect: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/>'),
  key: svg('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18"/><path d="M7 15.5h4"/>'),
  bell: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  more: svg('<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
  heart: svg('<path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/>'),
  comment: svg('<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.5L4.5 21z"/>'),
  send: svg('<path d="M21 3 10 14"/><path d="M21 3 14 21l-4-7-7-4z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  check: svg('<path d="m5 12 4.5 4.5L19 7"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  guest: svg('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>'),
  concierge: svg('<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 11V8"/><path d="M10 8h4"/>'),
  star: svg('<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sync: svg('<path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M4 6v3h3M20 18v-3h-3"/>'),
  pin: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  settings: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  house: svg('<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>'),
  credit: svg('<path d="M7 5h10M7 9h10"/><path d="M7 5c5 0 6 1.5 6 3.5S12 13 7 13l6 6"/>'),
  lab: svg('<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>'),
  table: svg('<path d="M3 10h18"/><path d="M5 10v9M19 10v9"/><path d="M8 10V6h8v4"/>'),
  door: svg('<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>'),
  edit: svg('<path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
  car: svg('<path d="M4 12l2-5h12l2 5"/><rect x="3" y="12" width="18" height="6" rx="2"/><circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="16.5" cy="18" r="1.5" fill="currentColor" stroke="none"/>'),
  signout: svg('<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>'),
  question: svg('<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  nominate: svg('<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/>'),
  messages: svg('<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.5L4.5 21z"/><path d="M8 9h8M8 12.5h5"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>')
};

/* ---------- state ---------- */
const KEY = 'atenx-house.v1';
function fresh() {
  return {
    unlocked: false, view: 'gate', param: null, stack: [],
    rsvp: {track: 'going'}, likes: {}, posts: [], comments: {},
    bookings: D.bookings.map(b => Object.assign({}, b)),
    follows: {zara: true, kabir: true, meher: true, riya: true, vikram: true},
    tables: {t1: true}, guests: [{name: 'Kunal Mehta', when: 'Sat 19 Sep, 20:00', where: 'The Dining Room', past: true}],
    passes: D.me.passes, credits: D.me.credits, nominations: [{name: 'R. Kapoor', what: 'Sports physician', status: 'Under review'}],
    settings: {directory: true, coach: true, quiet: false, source: 'WHOOP'},
    threads: JSON.parse(JSON.stringify(D.threads)),
    day: 6, interest: {}, notifRead: false,
    bookSeg: 'train', bookDate: 0, connectSeg: 'feed', eventFilter: 'all', dirQuery: '', dirFilter: 'all', checkedIn: false
  };
}
let S = fresh();
function load() { try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {} }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------- helpers ---------- */
const member = id => id === 'me' ? D.me : D.members.find(m => m.id === id);
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const av = (id, cls = '') => { const m = member(id); if (!m) return ''; return `<span class="av ${cls}" style="--g:${m.g}" title="${esc(m.name)}">${initials(m.name)}</span>`; };
const avHouse = (cls = '') => `<span class="av house ${cls}">H</span>`;
const first = id => member(id).name.split(' ')[0];
const band = r => r >= 67 ? 'good' : r >= 34 ? 'warn' : 'bad';
const bandName = r => r >= 67 ? 'Green' : r >= 34 ? 'Amber' : 'Red';
const bandColor = r => ({good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)'})[band(r)];
const hm = h => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;
const inr = n => '₹' + n.toLocaleString('en-IN');
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const greeting = () => { const h = D.club.today.getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = i => { const d = new Date(D.club.today); d.setDate(d.getDate() + i); return {dow: DOW[d.getDay()], n: d.getDate(), full: `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`}; };
const names = ids => ids.map(first);
const listNames = ids => { const n = names(ids); if (n.length <= 3) return n.join(n.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1'); return `${n[0]}, ${n[1]}, ${n[2]} and ${n.length - 3} others`; };

/* ---------- routing ---------- */
const TABS = ['today', 'form', 'book', 'events', 'connect', 'key'];
const NOTAB = ['gate', 'application', 'event', 'profile', 'thread'];
let sheetOpen = false;
function go(view, param = null, opts = {}) {
  closeSheet();
  if (!TABS.includes(view) && !opts.replace && S.view !== view) {
    const v = document.querySelector('.view'); S.stack.push({view: S.view, param: S.param, scroll: v ? v.scrollTop : 0});
    if (S.stack.length > 12) S.stack.shift();
  }
  if (TABS.includes(view)) S.stack = [];
  S.view = view; S.param = param; save(); render('enter');
}
function back() {
  closeSheet();
  const prev = S.stack.pop();
  if (!prev) { S.view = S.unlocked ? 'today' : 'gate'; S.param = null; }
  else { S.view = prev.view; S.param = prev.param; }
  save(); render('enter-back', prev && prev.scroll);
}

/* ---------- render ---------- */
const V = {};
function render(dir = '', scroll = 0) {
  const app = document.getElementById('app');
  const view = S.unlocked || ['gate', 'application'].includes(S.view) ? S.view : 'gate';
  const fn = V[view] || V.today;
  const showTab = !NOTAB.includes(view);
  app.innerHTML = `<div class="view ${dir}">${fn(S.param)}</div>${showTab ? tabbar(view) : ''}`;
  const v = app.querySelector('.view'); if (v && scroll) v.scrollTop = scroll;
  const idx = document.getElementById('idx'); if (idx) [...idx.querySelectorAll('button')].forEach(b => b.classList.toggle('on', b.dataset.go === view || (b.dataset.go || '').split(':')[0] === view));
  afterRender(view);
}
function tabbar(cur) {
  const t = [['today', 'Today', I.home], ['form', 'Form', I.form], ['book', 'Book', I.book], ['events', "What's on", I.events], ['connect', 'Connect', I.connect], ['key', 'Key', I.key]];
  return `<nav class="tabbar">${t.map(([id, l, ic]) => `<button class="tab ${cur === id ? 'on' : ''}" data-tab="${id}" aria-label="${l}">${ic}<span>${l}</span></button>`).join('')}</nav>`;
}
function topbar(title, right = '', backBtn = true) {
  return `<div class="topbar"><div class="l">${backBtn ? `<button class="iconbtn" data-back aria-label="Back">${I.back}</button>` : ''}${title ? `<h2 class="h-display h3">${title}</h2>` : ''}</div><div class="r">${right}</div></div>`;
}

/* ---------- gate ---------- */
V.gate = () => `
  <div class="gate">
    <div class="window atm atm-dawn"><div class="fig"></div><div class="fade"></div>
      <div class="wordmark">${D.club.mark}<small>${esc(D.club.cobrand)}</small></div>
      <p class="micro" style="color:rgba(255,255,255,.85)">House No. 1 · Gurugram · MMXXVI</p>
    </div>
    <div class="below">
      <div class="stack g16">
        <h1 class="big">This House is <span class="ital">by invitation.</span></h1>
        <p class="sub">Enter the code on your invitation to present yourself at the door.</p>
        <form class="code" data-form="gate" autocomplete="off"><input id="code" placeholder="GGN-0041" spellcheck="false" aria-label="Invitation code"><button class="go" type="submit" aria-label="Present">${I.arrow}</button></form>
      </div>
      <div class="foot"><p class="small sub">Membership is granted by application, interview and committee review. Capacity is capped. <button class="link" data-go="application">Track an application</button></p></div>
    </div>
  </div>`;

V.application = () => `
  <div class="pad">
    ${topbar('', `<span class="micro">Application 2026-0187</span>`)}
    <h1 class="h-display h1">Your application is <span class="ital">with the House.</span></h1>
    <div class="card">
      <div class="tl">
        <div class="st done"><div class="dot">${I.check}</div><div><div class="t">Invitation received</div><div class="s">8 September, nominated by a founding member</div></div></div>
        <div class="st done"><div class="dot">${I.check}</div><div><div class="t">Application submitted</div><div class="s">14 September</div></div></div>
        <div class="st now"><div class="dot"></div><div><div class="t">Interview</div><div class="s">Tuesday 29 September, 11:00, at House No. 1. Come as you are.</div></div></div>
        <div class="st"><div class="dot"></div><div><div class="t">Committee</div><div class="s">Sits on the first Monday of each month</div></div></div>
        <div class="st"><div class="dot"></div><div><div class="t">Decision</div><div class="s">Within a week of the committee. The House does not explain its decisions.</div></div></div>
      </div>
    </div>
    <div class="card raised stack g12">
      <p class="micro brass">What the committee looks for</p>
      <p>People who train seriously, keep confidences, and add something to the room. Standing outside the House is not a qualification inside it.</p>
    </div>
    <button class="btn primary block" data-act="toast:Confirmed. See you on the 29th at 11:00.">Confirm the interview</button>
    <button class="btn line block" data-act="toast:Sent. The House replies within a day.">Write to the House</button>
  </div>`;

/* ---------- today ---------- */
const skyClass = () => { const h = D.club.today.getHours(); return h < 11 ? 'morning' : h < 17 ? 'day' : ''; };
V.today = () => {
  const t = D.days[6]; const nxt = S.bookings.find(b => !b.done && b.date === dateLabel(0).full);
  const wk = D.events.slice(0, 4); const here = D.inHouseNow;
  return `
  <div class="sky ${skyClass()}"></div>
  <div class="pad">
    <div class="topbar">
      <div class="l"><div class="wordmark">${D.club.mark}<small>${D.club.house}</small></div></div>
      <div class="r"><button class="iconbtn glass" data-go="notifications" aria-label="Notifications">${I.bell}${S.notifRead ? '' : '<span class="badge">3</span>'}</button><button data-go="profile:me" aria-label="Your profile">${av('me')}</button></div>
    </div>
    <div class="stack g4">
      <h1 class="h-display h1">${greeting()}, <span class="ital">${D.me.first}.</span></h1>
      <p class="micro" style="letter-spacing:.12em">${D.club.today.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long'})} · Doors until 23:00</p>
    </div>
    <div class="section-h" style="margin-top:0"><h3 class="h4">In the House now</h3><button class="link" data-go="connect">${here.length} members</button></div>
    <div class="strip">${here.slice(0, 9).map(id => `<button data-go="profile:${id}">${av(id, 'lg')}</button>`).join('')}<button class="av lg" style="--g:var(--paper-2);color:var(--ink-50);font-size:13px;font-weight:500" data-go="connect">+${here.length - 9}</button></div>
    ${nxt ? `
    <div class="hero-card atm atm-plunge" data-go="book">
      <div class="fig"></div>
      <div class="top"><span class="pill glass">Next at the House</span><span class="pill glass">${nxt.time}</span></div>
      <div class="glass">
        <div class="title">${esc(nxt.name)}</div>
        <div class="meta">${esc(nxt.sub)} · 2 of 4 places</div>
        <div class="row mt12">
          <button class="btn primary sm grow" data-act="checkin">${S.checkedIn ? I.check + ' Checked in' : 'Check in'}</button>
          <button class="btn ghost sm" data-go="book">Change</button>
        </div>
      </div>
    </div>` : ''}
    <div class="section-h"><h3 class="h4">Your form this morning</h3><button class="link" data-go="form">Form</button></div>
    <div class="tiles">
      <button class="tile link" data-go="form"><span class="micro tight" style="letter-spacing:.12em">Recovery</span><span class="v ${band(t.recovery)}-t">${t.recovery}<small>%</small></span><span class="small sub">${bandName(t.recovery)} day</span></button>
      <button class="tile link" data-go="form"><span class="micro tight" style="letter-spacing:.12em">Sleep</span><span class="v">${hm(t.sleep)}</span><span class="small sub">${Math.round(t.sleep / t.need * 100)}% of need</span></button>
      <button class="tile link" data-go="form"><span class="micro tight" style="letter-spacing:.12em">Strain</span><span class="v cool-t">${t.strain.toFixed(1)}</span><span class="small sub">Room for more</span></button>
    </div>
    <div class="section-h"><h3 class="h4">This week</h3><button class="link" data-tab="events">What’s on</button></div>
    <div class="chips" style="gap:12px">${wk.map(e => `
      <div class="hero-card short atm ${e.atm}" style="flex:none;width:250px" data-go="event:${e.id}">
        <div class="fig"></div>
        <div class="top"><span class="pill glass">${e.date}</span>${S.rsvp[e.id] === 'going' ? `<span class="pill on">Going</span>` : ''}</div>
        <div class="glass"><div class="title" style="font-size:20px">${esc(e.title)}</div><div class="meta">${e.time} · ${esc(e.place.split(',')[0])}</div></div>
      </div>`).join('')}</div>
    <div class="card stack g12">
      <p class="micro brass">From the House</p>
      <div class="notice"><p>The sauna closes on Tuesday morning for cedar maintenance. Back at 12:00.</p></div>
      <div class="notice"><p>Gandhi Jayanti hours on Friday 2 October: doors from 05:30, the bar until midnight.</p></div>
    </div>
    <div class="grid2">
      ${[['book', I.book, 'Book a room', 'Train, recover, courts, the table'], ['guests', I.guest, 'Bring a guest', `${S.passes} of ${D.me.passesTotal} passes left`], ['thread:concierge', I.concierge, 'Concierge', 'Always on, always discreet'], ['nominate', I.nominate, 'Nominate', 'Two a year, to the committee']].map(([g, ic, t, s]) => `
      <button class="card stack" data-go="${g}" style="text-align:left;gap:14px"><span class="ico brass">${ic}</span><span><b style="font-weight:500;display:block">${t}</b><span class="small sub">${s}</span></span></button>`).join('')}
    </div>
  </div>`;
};

/* ---------- form ---------- */
V.form = () => {
  const d = D.days[S.day]; const r = d.recovery; const c = bandColor(r);
  const circ = 2 * Math.PI * 66; const off = circ * (1 - r / 100);
  const perf = Math.round(d.sleep / d.need * 100);
  const read = r >= 67 && d.strain < 12 ? 'Room for a hard session. The track, or a heavy block on the floor.' : r >= 67 ? 'You have earned today’s strain. Eat, and be in bed by ten.' : r >= 34 ? 'Keep it to skill work and mobility. The sauna will help more than the floor.' : 'Rest. Recovery this low means the body is fighting something. Priya can see you.';
  const coach = r >= 67 ? `HRV ${d.hrv} against a baseline of ${D.baseline.hrv}. ${d.today ? 'Saturday' : 'The next day'} can be hard: 6 × 400 at the track, 90 seconds off. I will hold a lane.` : r >= 34 ? `HRV is ${d.hrv}, under your ${D.baseline.hrv} baseline. Skip intensity. Forty minutes of mobility in the studio and the sauna after.` : `Recovery ${r}%. No training today. Sleep, fluids, and message me if the resting HR is still up tomorrow.`;
  const tot = d.deep + d.rem + d.light + d.awake;
  return `
  <div class="pad">
    <div class="topbar"><div class="l"><h2 class="h-display h2">Form</h2></div><div class="r"><span class="pill">${I.sync.replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.8"')} 06:12 · ${esc(S.settings.source)}</span></div></div>
    <div class="days">${D.days.map((x, i) => `<button class="${i === S.day ? 'on' : ''}" data-act="day:${i}" style="--c:${bandColor(x.recovery)}"><span>${x.d}</span><b>${x.n}</b><i></i></button>`).join('')}</div>
    <div class="card">
      <div class="ring-wrap">
        <div class="ring"><svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="66"/><circle class="arc" cx="75" cy="75" r="66" stroke="${c}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" data-off="${off}"/></svg>
          <div class="c"><span class="micro" style="font-size:10px">Recovery</span><span class="v">${r}<small>%</small></span><span class="small" style="color:${c}">${bandName(r)}</span></div></div>
        <div class="kv">
          <div><div class="k">HRV</div><div class="v">${d.hrv}<small>ms</small><span class="delta ${d.hrv >= D.baseline.hrv ? 'good-t' : 'warn-t'}">${d.hrv >= D.baseline.hrv ? '↑' : '↓'} ${Math.abs(d.hrv - D.baseline.hrv)}</span></div></div>
          <div><div class="k">Resting HR</div><div class="v">${d.rhr}<small>bpm</small><span class="delta ${d.rhr <= D.baseline.rhr ? 'good-t' : 'warn-t'}">${d.rhr <= D.baseline.rhr ? '↓' : '↑'} ${Math.abs(d.rhr - D.baseline.rhr)}</span></div></div>
          <div><div class="k">Sleep</div><div class="v">${hm(d.sleep)}<span class="delta sub">${perf}% of need</span></div></div>
        </div>
      </div>
    </div>
    <div class="card stack g12">
      <div class="row between"><span class="micro">Day strain</span><span class="num small sub">target 12 to 15</span></div>
      <div class="row" style="align-items:baseline;gap:6px"><span class="h-display h2 cool-t">${d.strain.toFixed(1)}</span><span class="small sub">of 21</span></div>
      <div class="gauge"><span class="band" style="left:${12 / 21 * 100}%;width:${3 / 21 * 100}%"></span><span class="fill" style="width:0" data-w="${d.strain / 21 * 100}"></span></div>
      <div class="scale"><span>0</span><span>7</span><span>14</span><span>21</span></div>
      <p class="small">${read}</p>
    </div>
    <div class="card stack g12">
      <div class="row between"><span class="micro">Sleep</span><span class="num small sub">need ${hm(d.need)}</span></div>
      <div class="row" style="align-items:baseline;gap:6px"><span class="h-display h2">${hm(d.sleep)}</span><span class="small ${perf >= 90 ? 'good-t' : 'warn-t'}">${perf}%</span></div>
      <div class="stages"><i style="width:${d.deep / tot * 100}%;background:#5E86B0"></i><i style="width:${d.rem / tot * 100}%;background:var(--cool)"></i><i style="width:${d.light / tot * 100}%;background:rgba(147,180,218,.45)"></i><i style="width:${d.awake / tot * 100}%;background:var(--ink-15)"></i></div>
      <div class="legend"><span><i style="background:#5E86B0"></i>Deep ${hm(d.deep)}</span><span><i style="background:var(--cool)"></i>REM ${hm(d.rem)}</span><span><i style="background:rgba(147,180,218,.45)"></i>Light ${hm(d.light)}</span><span><i style="background:var(--ink-15)"></i>Awake ${Math.round(d.awake * 60)}m</span></div>
    </div>
    <div class="card stack g12">
      <div class="row between"><span class="micro">Seven days</span><span class="num small sub">avg ${Math.round(D.days.reduce((a, x) => a + x.recovery, 0) / 7)}%</span></div>
      <div class="bars">${D.days.map((x, i) => `<button class="b ${i === S.day ? 'on' : ''}" data-act="day:${i}" style="--c:${bandColor(x.recovery)}"><i style="height:0" data-h="${x.recovery}"></i><span>${x.d}</span></button>`).join('')}</div>
    </div>
    <div class="card raised stack g12">
      <div class="row">${av('riya')}<div><div class="t" style="font-weight:500">Riya’s read</div><div class="small sub">House coach · this morning</div></div></div>
      <p>${coach}</p>
      <button class="btn ghost sm" data-go="thread:riya">Reply to Riya</button>
    </div>
    <div class="card stack g12">
      <div class="row between"><span class="micro brass">The Lab</span><span class="small sub">${D.assessment.date}</span></div>
      <div class="lab">${D.assessment.rows.map(x => `<div><div class="k">${x.k}</div><div class="v">${x.v}<small>${x.u}</small></div><div class="d ${x.good ? 'good-t' : 'warn-t'}">${x.d} since June</div></div>`).join('')}</div>
      <div class="hair"></div>
      <div class="row between"><span class="small sub">Next assessment ${D.assessment.next}</span><button class="btn ghost xs" data-act="booklab">Book the lab</button></div>
    </div>
    <div class="card stack g12">
      <div class="row between"><div><div style="font-weight:500">Share with Riya and Priya</div><div class="small sub">Your coach and physio see this screen. Other members never do.</div></div><button class="switch ${S.settings.coach ? 'on' : ''}" data-toggle="coach" aria-label="Share with coach"></button></div>
    </div>
  </div>`;
};

/* ---------- book ---------- */
function avail(room, dateIdx, time) { const h = hash(room + dateIdx + time); if (h % 6 === 0) return 0; return 1 + (h % 4); }
V.book = () => {
  const rooms = D.rooms[S.bookSeg]; const dl = dateLabel(S.bookDate);
  const mine = S.bookings.filter(b => !b.done);
  return `
  <div class="pad">
    <div class="topbar"><div class="l"><h2 class="h-display h2">Book</h2></div><div class="r"><span class="micro">Doors 05:30 to 23:00</span></div></div>
    <div class="segs">${[['train', 'Train'], ['recover', 'Recover'], ['courts', 'Courts'], ['table', 'The table']].map(([k, l]) => `<button class="seg ${S.bookSeg === k ? 'on' : ''}" data-act="bookseg:${k}">${l}</button>`).join('')}</div>
    <div class="datestrip">${[0, 1, 2, 3, 4, 5, 6].map(i => { const x = dateLabel(i); return `<button class="${S.bookDate === i ? 'on' : ''}" data-act="bookdate:${i}"><span>${x.dow}</span><b>${x.n}</b></button>`; }).join('')}</div>
    <div class="card" style="padding:4px 18px">
      ${rooms.map(rm => `
      <div class="room">
        <div class="head"><div class="thumb atm ${rm.atm}"></div><div class="grow"><div style="font-weight:500">${esc(rm.name)}</div><div class="small sub">${esc(rm.sub)}</div></div><span class="micro">${rm.cap === 1 ? '1 to 1' : rm.cap + ' places'}</span></div>
        <div class="slots">${D.slotTimes.map(t => {
          const b = S.bookings.find(x => x.room === rm.id && x.date === dl.full && x.time === t && !x.done);
          const left = b ? 0 : Math.min(rm.cap, avail(rm.id, S.bookDate, t));
          const full = !b && left === 0;
          return `<button class="slot ${full ? 'full' : ''} ${b ? 'mine' : ''}" ${full ? 'disabled' : `data-act="slot:${rm.id}:${t}"`}><b>${t}</b><span>${b ? 'Yours' : full ? 'Full' : rm.cap === 1 ? 'Open' : left + ' left'}</span></button>`; }).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="section-h"><h3 class="h4">Your reservations</h3><span class="small sub">${mine.length}</span></div>
    <div class="card" style="padding:4px 18px">
      ${mine.length ? mine.map(b => `<div class="li"><span class="ico">${I.clock}</span><div class="grow"><div class="t">${esc(b.name)} · ${b.time}</div><div class="s">${b.date} · ${esc(b.sub)}</div></div><button class="btn line xs" data-act="cancel:${b.id}">Cancel</button></div>`).join('') : '<div class="empty">Nothing booked. The floor is yours.</div>'}
    </div>
    <div class="card raised stack">
      <p class="micro brass">Other Houses</p>
      <p class="small">Six reciprocal visits a year across the network, from 2027. Today, House No. 1 is the only door.</p>
      <button class="btn ghost sm" data-go="houses" style="align-self:flex-start">The ten Houses</button>
    </div>
  </div>`;
};

/* ---------- events ---------- */
V.events = () => {
  const f = S.eventFilter;
  const list = D.events.filter(e => f === 'all' || e.tag === f || (f === 'going' && S.rsvp[e.id] === 'going'));
  return `
  <div class="pad">
    <div class="topbar"><div class="l"><h2 class="h-display h2">What’s on</h2></div><div class="r"><span class="micro">October</span></div></div>
    <div class="chips">${[['all', 'All'], ['going', 'Going'], ['neeraj', 'With Neeraj'], ['tables', 'Tables'], ['train', 'Train'], ['recover', 'Recover'], ['talks', 'Talks']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="evfilter:${k}">${l}</button>`).join('')}</div>
    ${list.length ? list.map((e, i) => `
    <div class="hero-card ${i === 0 ? 'tall' : ''} atm ${e.atm}" data-go="event:${e.id}">
      <div class="fig"></div>
      <div class="top"><span class="pill glass">${e.date}${e.time ? ' · ' + e.time : ''}</span>${S.rsvp[e.id] ? `<span class="pill ${S.rsvp[e.id] === 'going' ? 'on' : ''}">${S.rsvp[e.id] === 'going' ? 'Going' : S.rsvp[e.id] === 'maybe' ? 'Maybe' : 'Not going'}</span>` : e.cap ? `<span class="pill glass">${e.cap - e.going.length} places</span>` : ''}</div>
      <div class="glass"><div class="title">${esc(e.title)}</div><div class="meta">${esc(e.place)} · with ${first(e.host)}</div></div>
    </div>`).join('') : '<div class="empty">Nothing here yet.</div>'}
  </div>`;
};

V.event = id => {
  const e = D.events.find(x => x.id === id); if (!e) return V.events();
  const h = member(e.host); const r = S.rsvp[id]; const going = e.going.concat(r === 'going' ? ['me'] : []);
  const guestsOk = /guest/i.test(e.note) && !/not admitted|members only/i.test(e.note);
  return `
  <div class="bleed">
    <div class="atm ${e.atm}"><div class="fig"></div></div>
    <div class="overlay-bar"><button class="iconbtn glass" data-back aria-label="Close">${I.close}</button><button class="iconbtn glass" data-act="toast:Shared with the concierge." aria-label="More">${I.more}</button></div>
    <div class="scroll">
      <div class="veil"></div>
      <div class="body">
        <div class="title-block">
          <h1 class="h-display h1">${esc(e.title)}</h1>
          <p class="sub">${e.when}<br>${esc(e.place)}</p>
        </div>
        ${e.cap ? `
        <div class="rsvp">
          <button class="going ${r === 'going' ? 'on' : ''}" data-act="rsvp:${id}:going">${I.check}Going</button>
          <button class="${r === 'no' ? 'on' : ''}" data-act="rsvp:${id}:no">${I.x}Not going</button>
          <button class="${r === 'maybe' ? 'on' : ''}" data-act="rsvp:${id}:maybe">${I.question}Maybe</button>
        </div>` : `<button class="btn primary block" data-act="booklab">Book a slot in the Lab</button>`}
        <div class="glass-card stack g12 center" style="align-items:center">
          <button class="row" data-go="profile:${h.id}" style="gap:8px;align-items:center">${av(h.id, 'sm')}<span class="small">Hosted by <b style="font-weight:500">${esc(h.name)}</b></span></button>
          <p>${esc(e.blurb)}</p>
          <p class="small sub">${esc(e.note)}</p>
        </div>
        ${e.cap ? `
        <div class="glass-card stack g12">
          <div class="row between"><span class="micro">Who is going</span><span class="num small sub">${going.length} of ${e.cap}</span></div>
          <div class="row"><span class="av-stack">${going.slice(0, 6).map(x => av(x, 'sm')).join('')}</span><span class="small sub grow">${going.length ? listNames(going) : 'No one yet'}</span></div>
        </div>` : ''}
        <div class="row">
          ${guestsOk ? `<button class="btn ghost grow" data-act="guestsheet:${esc(e.title)}">${I.guest}Bring a guest</button>` : ''}
          <button class="btn ghost grow" data-act="toast:Added to your calendar.">${I.calendar}Add to calendar</button>
        </div>
        <p class="micro center" style="margin-top:8px">Members only. Nothing from the House is posted outside it.</p>
      </div>
    </div>
  </div>`;
};

/* ---------- connect ---------- */
const CLOUD = [[6, 66, 'sm'], [17, 102, ''], [30, 56, 'sm'], [25, 126, 'xs'], [40, 108, ''], [56, 108, ''], [66, 58, 'sm'], [75, 120, 'xs'], [84, 70, ''], [91, 110, 'sm'], [4, 118, 'xs'], [46, 6, 'xs'], [88, 24, 'xs'], [13, 22, 'sm']];
V.connect = () => {
  const seg = S.connectSeg;
  const unread = S.threads.reduce((a, t) => a + (t.msgs[t.msgs.length - 1].who === 'them' && !t.read ? 1 : 0), 0);
  let body = '';
  if (seg === 'feed') {
    const posts = S.posts.concat(D.posts);
    body = `
      <button class="composer" data-act="postsheet">${av('me', 'sm')}<span class="ph">Say something to the House</span>${I.edit.replace('<svg', '<svg style="width:18px;height:18px;stroke:var(--ink-50);fill:none;stroke-width:1.5"')}</button>
      <div class="card" style="padding:2px 18px">
        ${posts.map(p => { const m = member(p.who); const liked = !!S.likes[p.id]; const likes = p.likes + (liked ? 1 : 0); const cm = p.comments + (S.comments[p.id] || 0); return `
        <div class="post">
          <button class="who" data-go="profile:${p.who}">${av(p.who)}<div><div class="n">${esc(m.name)}</div><div class="h">@${m.handle} · ${p.ago}</div></div></button>
          ${p.img ? `<div class="img atm ${p.img}"><div class="fig"></div><span class="cap">${esc(p.cap)}</span></div>` : ''}
          <p class="txt">${esc(p.text)}</p>
          <div class="acts"><button class="${liked ? 'on' : ''}" data-act="like:${p.id}">${I.heart}<span class="num">${likes}</span></button><button data-act="comment:${p.id}">${I.comment}<span class="num">${cm}</span></button><button data-act="toast:Sent to the concierge to pass on." style="margin-left:auto">${I.send}</button></div>
          ${likes ? `<div class="likedby">liked by <b>${(liked ? ['you'] : []).concat(p.likedBy).slice(0, 2).join(', ')}</b>${likes > 2 ? ` and ${likes - 2} others` : ''}</div>` : ''}
        </div>`; }).join('')}
      </div>`;
  } else if (seg === 'tables') {
    body = `
      <p class="small sub">Small standing groups, made by members. Join one, or start your own. The House seats the rest.</p>
      <div class="card" style="padding:4px 18px">
        ${D.tables.map(t => { const inIt = !!S.tables[t.id]; const n = t.in.length + (inIt && !t.in.includes('me') ? 1 : 0); return `
        <div class="li"><span class="av-stack">${t.in.slice(0, 3).map(x => av(x, 'sm')).join('')}</span><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${t.when} · ${esc(t.where)} · ${n} of ${t.cap}</div></div><button class="btn ${inIt ? 'on' : 'line'} xs" data-act="table:${t.id}">${inIt ? 'In' : n >= t.cap ? 'Full' : 'Join'}</button></div>`; }).join('')}
      </div>
      <button class="btn ghost block" data-act="tablesheet">${I.plus}Start a table</button>`;
  } else {
    const q = S.dirQuery.toLowerCase(); const f = S.dirFilter;
    const list = D.members.filter(m => !m.founder).filter(m => f === 'all' || (f === 'staff' ? m.staff : m.city === f)).filter(m => !q || (m.name + m.discipline + m.work + m.city).toLowerCase().includes(q));
    body = `
      <div class="input"><span style="color:var(--ink-35);display:grid">${I.search.replace('<svg', '<svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.6"')}</span><input id="dirq" data-input="dir" placeholder="Name, sport, work" value="${esc(S.dirQuery)}" aria-label="Search members"></div>
      <div class="chips">${[['all', 'Everyone'], ['Gurugram', 'Gurugram'], ['New Delhi', 'Delhi'], ['Mumbai', 'Mumbai'], ['staff', 'The team']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="dirfilter:${k}">${l}</button>`).join('')}</div>
      <div class="card" style="padding:4px 18px" id="dirlist">${dirList(list)}</div>
      <p class="micro center">Only members who chose to be visible appear here.</p>`;
  }
  return `
  <div class="sky ${skyClass()}"></div>
  <div class="pad">
    <div class="topbar"><div class="l"><h2 class="h-display h2">Connect</h2></div><div class="r"><button class="iconbtn" data-act="connectseg:directory" aria-label="Search members">${I.search}</button><button class="iconbtn" data-go="messages" aria-label="Messages">${I.messages}${unread ? `<span class="badge">${unread}</span>` : ''}</button></div></div>
    <div class="cloud">
      ${D.inHouseNow.slice(0, CLOUD.length).map((id, i) => { const [x, y, sz] = CLOUD[i]; return `<button style="left:${x}%;top:${y}px" data-go="profile:${id}">${av(id, sz)}</button>`; }).join('')}
      <button class="me" data-go="profile:me"><span class="av lg ring" style="--g:${D.me.g}">${initials(D.me.name)}<span class="plus">+</span></span></button>
    </div>
    <p class="micro center" style="margin-top:-6px">${D.inHouseNow.length} members in the House now</p>
    <div class="segs">${[['feed', 'The room'], ['tables', 'Tables'], ['directory', 'Members']].map(([k, l]) => `<button class="seg ${seg === k ? 'on' : ''}" data-act="connectseg:${k}">${l}</button>`).join('')}</div>
    ${body}
  </div>`;
};
function dirList(list) {
  return list.length ? list.map(m => `<div class="li"><button data-go="profile:${m.id}">${av(m.id)}</button><button class="grow" data-go="profile:${m.id}" style="text-align:left"><div class="t">${esc(m.name)}${m.staff ? ' <span class="pill brass" style="height:20px;font-size:9px;margin-left:6px">' + esc(m.role) + '</span>' : ''}</div><div class="s">${esc(m.discipline)} · ${esc(m.city)}</div></button><button class="btn ${S.follows[m.id] ? 'on' : 'line'} xs" data-act="follow:${m.id}">${S.follows[m.id] ? 'Following' : 'Follow'}</button></div>`).join('') : '<div class="empty">No one by that name in this House.</div>';
}

V.profile = id => {
  const m = member(id); if (!m) return V.connect();
  const me = id === 'me'; const f = !!S.follows[id];
  const ev = D.events.find(e => e.host === id || e.going.includes(id));
  const tiles = me ? [['atm-track', 'The Track, 06:40'], ['atm-plunge', 'The Plunge']] : [[ev ? ev.atm : 'atm-floor', ev ? ev.title : 'The Floor'], ['atm-lab', 'The Lab']];
  return `
  <div class="bleed">
    <div class="atm ${m.atm}"><div class="fig"></div></div>
    <div class="overlay-bar"><button class="iconbtn glass" data-back aria-label="Close">${I.close}</button><button class="iconbtn glass" data-act="${me ? 'go:settings' : 'toast:Reported to the House, quietly.'}" aria-label="More">${me ? I.settings : I.more}</button></div>
    <div class="scroll">
      <div class="veil" style="height:340px"></div>
      <div class="body" style="min-height:calc(100% - 340px)">
        <div class="title-block">
          <h1 class="h-display h1">${esc(m.name)}</h1>
          <p class="micro tight" style="letter-spacing:.1em">@${m.handle}${m.role ? ' · ' + esc(m.role) : ''}</p>
        </div>
        <div class="row">
          ${me ? `<button class="btn primary grow" data-go="settings">Edit profile</button><button class="iconbtn" data-go="key" aria-label="Your key" style="width:50px;height:50px">${I.key}</button>`
               : `<button class="btn ${f ? 'ghost' : 'primary'} grow" data-act="follow:${id}">${f ? 'Following' : 'Follow'}</button><button class="iconbtn" data-go="thread:${id}" aria-label="Message" style="width:50px;height:50px">${I.messages}</button>`}
        </div>
        <div class="stats">
          <div><div class="v">${m.following}</div><div class="k">Following</div></div>
          <div><div class="v">${m.followers >= 1000 ? (m.followers / 1000).toFixed(1) + 'K' : m.followers + (f && !me ? 1 : 0)}</div><div class="k">Followers</div></div>
          <div><div class="v">${m.staff || m.founder ? 'Team' : m.sessions}</div><div class="k">Sessions</div></div>
        </div>
        <div class="glass-card stack g4">
          <p>${esc(m.bio)}</p>
          <p class="small sub">${esc(m.work)} · ${esc(m.city)} · ${m.since === 'Founding team' ? 'Founding team' : 'Member since ' + m.since}</p>
        </div>
        <div class="grid2">${tiles.map(([a, l]) => `<div class="atm ${a}"><div class="fig"></div><span>${esc(l)}</span></div>`).join('')}</div>
        ${me ? '' : `<p class="micro center">${esc(m.name.split(' ')[0])}’s form is private. Only the House sees it.</p>`}
      </div>
    </div>
  </div>`;
};

/* ---------- messages ---------- */
V.messages = () => `
  <div class="pad">
    ${topbar('Messages', `<button class="iconbtn" data-act="toast:Pick a member from the directory to write to them." aria-label="New message">${I.edit}</button>`)}
    <div class="card" style="padding:4px 18px">
      ${S.threads.map(t => { const last = t.msgs[t.msgs.length - 1]; return `<button class="li link" data-go="thread:${t.id}" style="width:100%">${t.house ? avHouse() : av(t.id)}<div class="grow" style="text-align:left"><div class="row between"><span class="t">${esc(t.name)}</span><span class="micro tight">${esc(last.t)}</span></div><div class="s" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${last.who === 'me' ? 'You: ' : ''}${esc(last.text)}</div></div></button>`; }).join('')}
    </div>
    <p class="micro center">Messages stay inside the House. Nothing is forwarded or exported.</p>
  </div>`;

V.thread = id => {
  let t = S.threads.find(x => x.id === id);
  if (!t) { const m = member(id); if (!m) return V.messages(); t = {id, name: m.name, sub: m.discipline, msgs: []}; S.threads.push(t); }
  t.read = true;
  return `
  <div class="chat">
    <div class="pad" style="padding-bottom:10px;flex:none">
      <div class="topbar"><div class="l"><button class="iconbtn" data-back aria-label="Back">${I.back}</button><button class="row" ${t.house ? 'data-go="key"' : `data-go="profile:${id}"`}>${t.house ? avHouse() : av(id)}<div style="text-align:left"><div style="font-weight:500">${esc(t.name)}</div><div class="small sub">${esc(t.sub || '')}</div></div></button></div></div>
    </div>
    <div class="scroll" id="thread" style="padding:0 var(--gutter)">
      <div class="thread">${t.msgs.length ? t.msgs.map(m => `<div class="msg ${m.who}">${esc(m.text)}<span class="t">${esc(m.t)}</span></div>`).join('') : `<div class="empty">Say hello. ${esc(t.name.split(' ')[0])} will see it when they are next in the House.</div>`}</div>
    </div>
    ${t.house ? `<div class="quick">${D.quickAsks.map(q => `<button class="chip" data-act="say:${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
    <form class="compose-bar" data-form="say"><div class="input"><input id="say" placeholder="${t.house ? 'Ask the House' : 'Write to ' + esc(t.name.split(' ')[0])}" autocomplete="off" aria-label="Message"></div><button class="iconbtn dark" type="submit" aria-label="Send">${I.send}</button></form>
  </div>`;
};

/* ---------- notifications ---------- */
V.notifications = () => { S.notifRead = true; save(); return `
  <div class="pad">
    ${topbar('Notifications')}
    <div class="card" style="padding:4px 18px">
      ${D.notifications.map(n => `<button class="li link" data-go="${n.go}" style="width:100%;text-align:left"><span class="ico">${I[n.ico] || I.bell}</span><div class="grow"><div class="t" style="font-weight:400">${esc(n.t)}</div><div class="s">${n.s}</div></div><span class="chev">${I.chev}</span></button>`).join('')}
    </div>
    <p class="micro center">Quiet between 22:00 and 06:00${S.settings.quiet ? '' : ', if you turn it on in Settings'}.</p>
  </div>`; };

/* ---------- key ---------- */
function doorcode(big = false) { const n = big ? 81 : 81; const seed = hash(D.me.number + Math.floor(Date.now() / 30000)); let out = ''; for (let i = 0; i < n; i++) out += `<i class="${((seed >> (i % 28)) ^ (i * 2654435761)) % 3 === 0 ? 'on' : ''}"></i>`; return `<div class="doorcode ${big ? 'big' : ''}">${out}</div>`; }
V.key = () => `
  <div class="pad">
    <div class="topbar"><div class="l"><h2 class="h-display h2">Key</h2></div><div class="r"><button class="iconbtn" data-go="settings" aria-label="Settings">${I.settings}</button></div></div>
    <div class="key" id="keycard">
      <div class="sheen"></div>
      <div class="row between" style="align-items:flex-start"><div class="wm">${D.club.mark}<small>${esc(D.club.cobrand)}</small></div><div class="no">No. 1<br>Gurugram</div></div>
      <span class="emv"></span>
      <div><div class="name">${esc(D.me.name)}</div><div class="meta"><span>Member ${D.me.number}</span><span>${esc(D.me.tier)}</span><span>2026 to 2027</span></div></div>
    </div>
    <button class="btn primary block" data-act="doorsheet">${I.door}Show at the door</button>
    <div class="tiles">
      <button class="tile link" data-go="guests"><span class="micro tight" style="letter-spacing:.12em">Guest passes</span><span class="v">${S.passes}<small>of ${D.me.passesTotal}</small></span><span class="small sub">This quarter</span></button>
      <button class="tile link" data-go="ledger"><span class="micro tight" style="letter-spacing:.12em">House credit</span><span class="v" style="font-size:22px">${inr(S.credits)}</span><span class="small sub">Of ${inr(D.me.creditsTotal)}</span></button>
      <button class="tile link" data-go="nominate"><span class="micro tight" style="letter-spacing:.12em">Nominate</span><span class="v">${Math.max(0, 2 - S.nominations.length)}<small>left</small></span><span class="small sub">This year</span></button>
    </div>
    <div class="section-h"><h3 class="h4">The network</h3><button class="link" data-go="houses">All ten Houses</button></div>
    <div class="card" style="padding:2px 18px">
      ${D.houses.slice(0, 3).map(h => `<div class="house"><span class="n">${h.n}</span><div class="thumb atm ${h.atm}"></div><div class="grow"><div class="t">${esc(h.city)}</div><div class="s">${esc(h.place)}</div></div><span class="pill ${h.open ? 'good' : ''}">${h.open ? '<span class="d"></span>Open' : h.status}</span></div>`).join('')}
    </div>
    <div class="section-h"><h3 class="h4">Your House</h3></div>
    <div class="card stack g12">
      <div class="row"><span class="ico">${I.pin}</span><div><div style="font-weight:500">House No. 1</div><div class="small sub">${esc(D.club.address)}</div></div></div>
      <div class="row"><span class="ico">${I.clock}</span><div><div style="font-weight:500">Doors ${D.club.hours}</div><div class="small sub">The bar until midnight on Fridays</div></div></div>
      <div class="row"><span class="ico">${I.concierge}</span><div><div style="font-weight:500">Concierge</div><div class="small sub num">+91 124 000 0001 · always on</div></div><button class="btn ghost xs" data-go="thread:concierge" style="margin-left:auto">Write</button></div>
    </div>
    <div class="section-h"><h3 class="h4">The Ledger</h3><button class="link" data-go="ledger">Everything included</button></div>
    <div class="card" style="padding:4px 18px">
      ${D.ledger.slice(0, 3).map(x => `<div class="li"><span class="ico brass">${I[x.ico] || I.star}</span><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></div></div>`).join('')}
    </div>
    <div class="card" style="padding:4px 18px">
      <button class="li link" data-go="profile:me" style="width:100%">${av('me')}<div class="grow" style="text-align:left"><div class="t">${esc(D.me.name)}</div><div class="s">${esc(D.me.tier)} · since ${D.me.since}</div></div><span class="chev">${I.chev}</span></button>
      <div class="li"><span class="ico">${I.calendar}</span><div class="grow"><div class="t">Renews ${D.me.renews}</div><div class="s">${esc(D.club.fee)}, by committee</div></div></div>
      <button class="li link" data-act="signout" style="width:100%"><span class="ico">${I.signout}</span><div class="grow" style="text-align:left"><div class="t">Leave the House</div><div class="s">Sign out on this phone</div></div></button>
    </div>
  </div>`;

V.guests = () => `
  <div class="pad">
    ${topbar('Guests', `<span class="micro">${S.passes} of ${D.me.passesTotal} left</span>`)}
    <p class="sub">One guest per visit, signed in by you and met at the door. Guests use your credit, keep to your rooms, and leave when you do. Six passes a quarter.</p>
    <button class="btn primary block" data-act="guestsheet:" ${S.passes ? '' : 'disabled'}>${I.guest}Sign in a guest</button>
    <div class="card" style="padding:4px 18px">
      ${S.guests.length ? S.guests.map(g => `<div class="li"><span class="ico ${g.past ? '' : 'brass'}">${I.person}</span><div class="grow"><div class="t">${esc(g.name)}</div><div class="s">${esc(g.when)} · ${esc(g.where)}</div></div><span class="pill ${g.past ? '' : 'brass'}">${g.past ? 'Visited' : 'Expected'}</span></div>`).join('') : '<div class="empty">No guests yet.</div>'}
    </div>
    <p class="micro center">Track night and the Library are members only.</p>
  </div>`;

V.ledger = () => `
  <div class="pad">
    ${topbar('The Ledger')}
    <div class="card brassline stack g12">
      <div class="row between"><span class="micro brass">House credit</span><span class="small sub">resets 1 September</span></div>
      <div class="row" style="align-items:baseline;gap:8px"><span class="h-display h1">${inr(S.credits)}</span><span class="small sub">of ${inr(D.me.creditsTotal)}</span></div>
      <div class="gauge"><span class="fill" style="width:${S.credits / D.me.creditsTotal * 100}%;background:linear-gradient(90deg,var(--brass),var(--brass-2))"></span></div>
      <div class="list ledger">
        ${[['The Dining Room, the table for four', 'Sat 19 Sep', 4200], ['The Lab, quarterly assessment', '12 Sep', 0], ['Guest, Kunal Mehta', 'Sat 19 Sep', 0], ['The Bar', 'Fri 11 Sep', 2800], ['Physio, two sessions', '3 and 10 Sep', 4500]].map(([t, s, n]) => `<div class="li"><div class="grow"><div class="t" style="font-weight:400">${t}</div><div class="s">${s}</div></div><span class="num">${n ? '−' + inr(n) : 'Included'}</span></div>`).join('')}
      </div>
    </div>
    <div class="section-h"><h3 class="h4">What membership carries</h3></div>
    <div class="card" style="padding:4px 18px">
      ${D.ledger.map(x => `<div class="li"><span class="ico brass">${I[x.ico] || I.star}</span><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></div></div>`).join('')}
    </div>
  </div>`;

V.houses = () => `
  <div class="pad">
    ${topbar('The Houses')}
    <h1 class="h-display h2">Ten Houses, <span class="ital">seven cities.</span></h1>
    <p class="sub">A finite network. When the tenth House opens, no more will be built. Members of any House may visit any other, six times a year.</p>
    <div class="card" style="padding:2px 18px">
      ${D.houses.map(h => `<div class="house"><span class="n">${h.n}</span><div class="thumb atm ${h.atm}"></div><div class="grow"><div class="t">${esc(h.city)}</div><div class="s">${esc(h.place)} · ${h.open ? 'Doors ' + D.club.hours : h.status}</div></div>${h.open ? '<span class="pill good"><span class="d"></span>Open</span>' : `<button class="btn ${S.interest[h.n] ? 'on' : 'line'} xs" data-act="interest:${h.n}">${S.interest[h.n] ? 'Noted' : 'Interest'}</button>`}</div>`).join('')}
    </div>
  </div>`;

V.nominate = () => `
  <div class="pad">
    ${topbar('Nominate', `<span class="micro">${Math.max(0, 2 - S.nominations.length)} of 2 left</span>`)}
    <h1 class="h-display h2">Who belongs <span class="ital">in the room?</span></h1>
    <p class="sub">Every member may put two names a year to the committee. A nomination is an invitation to apply, and nothing more. The committee decides.</p>
    <div class="card" style="padding:4px 18px">
      ${S.nominations.map(n => `<div class="li"><span class="ico brass">${I.nominate}</span><div class="grow"><div class="t">${esc(n.name)}</div><div class="s">${esc(n.what)}</div></div><span class="pill brass">${esc(n.status)}</span></div>`).join('')}
    </div>
    ${S.nominations.length < 2 ? `
    <form class="card stack g12" data-form="nominate">
      <div class="field"><label for="nn">Name</label><div class="input"><input id="nn" required placeholder="Full name"></div></div>
      <div class="field"><label for="nw">What they do</label><div class="input"><input id="nw" required placeholder="Work, sport"></div></div>
      <div class="field"><label for="ny">Why they belong</label><div class="input area"><textarea id="ny" required placeholder="Two or three sentences the committee will read"></textarea></div></div>
      <button class="btn primary block" type="submit">Send to the committee</button>
    </form>` : '<p class="micro center">You have used both nominations for this year.</p>'}
  </div>`;

V.settings = () => `
  <div class="pad">
    ${topbar('Settings')}
    <div class="card" style="padding:4px 18px">
      ${[['directory', 'Visible to members', 'Your name and sport in the directory and in the room'], ['coach', 'Share form with the House', 'Riya and Priya see your recovery, sleep and strain'], ['quiet', 'Quiet hours', 'No notifications between 22:00 and 06:00']].map(([k, t, s]) => `<div class="li"><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><button class="switch ${S.settings[k] ? 'on' : ''}" data-toggle="${k}" aria-label="${t}"></button></div>`).join('')}
    </div>
    <div class="card stack g12">
      <p class="micro">Form comes from</p>
      <div class="segs">${['WHOOP', 'Apple Health', 'Garmin'].map(s => `<button class="seg ${S.settings.source === s ? 'on' : ''}" data-act="source:${s}">${s}</button>`).join('')}</div>
      <p class="small sub">Synced every hour while the app is open. Raw data stays with your device and the House.</p>
    </div>
    <div class="card stack g12">
      <p class="micro brass">Discretion</p>
      <p class="small">Your form is never shown to other members. The House does not sell, share or advertise with member data. Photographs of members inside the House are not taken without asking.</p>
    </div>
    <div class="card" style="padding:4px 18px">
      <div class="li"><div class="grow"><div class="t">${esc(D.me.tier)}</div><div class="s">${esc(D.club.fee)} · renews ${D.me.renews}</div></div></div>
      <button class="li link" data-act="signout" style="width:100%"><span class="ico">${I.signout}</span><div class="grow" style="text-align:left"><div class="t">Leave the House</div><div class="s">Sign out on this phone</div></div></button>
    </div>
  </div>`;

/* ---------- sheets and toasts ---------- */
function sheet(html) { const host = document.getElementById('sheet'); host.innerHTML = `<div class="sheet-wrap"><div class="bg" data-act="closesheet"></div><div class="sheet">${html}</div></div>`; sheetOpen = true; }
function closeSheet() { const host = document.getElementById('sheet'); if (host) host.innerHTML = ''; sheetOpen = false; }
let toastTimer;
function toast(msg) { const host = document.getElementById('toast'); host.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toastTimer); toastTimer = setTimeout(() => host.innerHTML = '', 2400); }

const roomNote = {plunge: 'Three minutes at 6°C, then the sauna. Priya is on the floor.', floor: 'A coach programs the block. Come with a goal.', track: 'Six lanes, spikes allowed. Lane 3 is Riya’s.', studio: 'Mobility and breath. No shoes.', coach: 'Sixty minutes with Riya. Say what you are training for.', sauna: 'Cedar, 85°C. Fifteen minutes is enough.', physio: 'Priya’s table. Sixty minutes.', hbot: 'Sixty minutes at 1.5 ATA. Bring a book.', sleep: 'Forty minutes. Phones stay in the locker.', padel1: 'Rackets on the court. Bring three friends or ask a table.', padel2: 'Rackets on the court.', squash: 'Glass back. Sixty minutes.', dine: 'The House seats you. Say who is coming.', bar: 'Members and guests.'};
function slotSheet(roomId, time) {
  const rm = Object.values(D.rooms).flat().find(r => r.id === roomId); const dl = dateLabel(S.bookDate); const left = Math.min(rm.cap, avail(roomId, S.bookDate, time));
  sheet(`
    <div class="hero-card short atm ${rm.atm}" style="cursor:default;height:120px"><div class="fig"></div><div class="glass"><div class="title" style="font-size:22px">${esc(rm.name)}</div><div class="meta">${dl.full} · ${time} · ${rm.cap === 1 ? 'one to one' : left + ' of ' + rm.cap + ' places'}</div></div></div>
    <p>${roomNote[roomId] || ''}</p>
    <div class="field"><label for="bnote">A note for the floor</label><div class="input"><input id="bnote" placeholder="Optional"></div></div>
    <button class="btn primary block" data-act="reserve:${roomId}:${time}">Reserve</button>
    <button class="btn line block" data-act="closesheet">Not now</button>`);
}
function guestSheet(where) {
  sheet(`
    <h3 class="h-display h3">Sign in a guest</h3>
    <p class="small sub">${S.passes} of ${D.me.passesTotal} passes left this quarter. Your guest is met at the door and stays with you.</p>
    <form class="stack g12" data-form="guest">
      <div class="field"><label for="gn">Guest’s name</label><div class="input"><input id="gn" required placeholder="Full name"></div></div>
      <div class="field"><label for="gw">When</label><div class="input"><input id="gw" required placeholder="Sat 3 Oct, 20:00" value="${where ? '' : 'Tonight, 20:00'}"></div></div>
      <div class="field"><label for="gh">Where</label><div class="input"><input id="gh" required placeholder="The Dining Room" value="${esc(where)}"></div></div>
      <button class="btn primary block" type="submit" ${S.passes ? '' : 'disabled'}>Issue a guest pass</button>
    </form>`);
}
function postSheet() {
  sheet(`
    <div class="row">${av('me')}<div><div style="font-weight:500">${esc(D.me.name)}</div><div class="small sub">To the room. Members only.</div></div></div>
    <form class="stack g12" data-form="post">
      <div class="input area"><textarea id="pt" required placeholder="What happened at the House today?" rows="4"></textarea></div>
      <button class="btn primary block" type="submit">Post to the room</button>
    </form>`);
}
function tableSheet() {
  sheet(`
    <h3 class="h-display h3">Start a table</h3>
    <p class="small sub">A standing group, weekly or so. The House seats it and keeps the list.</p>
    <form class="stack g12" data-form="table">
      <div class="field"><label for="tt">What</label><div class="input"><input id="tt" required placeholder="Thursday hill repeats"></div></div>
      <div class="field"><label for="tw">When and where</label><div class="input"><input id="tw" required placeholder="Thursdays, 06:00, the Aravalli trail"></div></div>
      <button class="btn primary block" type="submit">Open the table</button>
    </form>`);
}
function doorSheet() {
  sheet(`
    <p class="micro center brass">Hold to the reader</p>
    <div id="dc">${doorcode(true)}</div>
    <div class="center stack g4"><div class="h-display h3">${esc(D.me.name)}</div><p class="micro">Member ${D.me.number} · House No. 1 · <span id="dcount">refreshes in 30</span></p></div>
    <button class="btn line block" data-act="closesheet">Done</button>`);
  let n = 30; const tick = setInterval(() => { const el = document.getElementById('dcount'); if (!el) return clearInterval(tick); n = n > 1 ? n - 1 : 30; el.textContent = `refreshes in ${n}`; if (n === 30) document.getElementById('dc').innerHTML = doorcode(true); }, 1000);
}

/* ---------- actions ---------- */
const A = {
  toast: msg => toast(msg),
  go: v => { const [view, param] = v.split(':'); go(view, param || null); },
  closesheet: () => closeSheet(),
  checkin: () => { S.checkedIn = true; save(); toast('Checked in. The floor knows you are coming.'); render(); },
  day: i => { S.day = +i; save(); render(); },
  booklab: () => { if (!S.bookings.find(b => b.room === 'lab')) S.bookings.push({id: 'lab' + Date.now(), room: 'lab', name: 'The Lab', sub: 'Quarterly assessment, fasted', date: 'Tue 20 Oct', time: '08:00'}); save(); toast('The Lab, Tuesday 20 October at 08:00. Come fasted.'); },
  bookseg: k => { S.bookSeg = k; save(); render(); },
  bookdate: i => { S.bookDate = +i; save(); render(); },
  slot: (room, time) => slotSheet(room, time),
  reserve: (room, time) => { const rm = Object.values(D.rooms).flat().find(r => r.id === room); S.bookings.push({id: 'b' + Date.now(), room, name: rm.name, sub: rm.sub, date: dateLabel(S.bookDate).full, time}); save(); closeSheet(); toast(`Reserved. ${rm.name}, ${dateLabel(S.bookDate).full} at ${time}.`); render(); },
  cancel: id => { S.bookings = S.bookings.filter(b => b.id !== id); save(); toast('Released. Someone else will take it.'); render(); },
  evfilter: k => { S.eventFilter = k; save(); render(); },
  rsvp: (id, v) => { const e = D.events.find(x => x.id === id); if (v === 'going' && e.going.length >= e.cap) { S.rsvp[id] = 'maybe'; save(); render(); return toast('Full. You are first on the list if a place opens.'); } S.rsvp[id] = S.rsvp[id] === v ? null : v; save(); render(); if (v === 'going' && S.rsvp[id]) toast(`You are going. ${first(e.host)} has the list.`); },
  connectseg: k => { S.connectSeg = k; save(); render(); if (k === 'directory') { const q = document.getElementById('dirq'); if (q) q.focus(); } },
  like: id => { S.likes[id] = !S.likes[id]; save(); render(); },
  comment: id => { S.comments[id] = (S.comments[id] || 0) + 1; save(); toast('Noted. Comments open in the next build.'); render(); },
  postsheet: () => postSheet(),
  tablesheet: () => tableSheet(),
  table: id => { const t = D.tables.find(x => x.id === id); if (!S.tables[id] && t.in.length >= t.cap) return toast('That table is full.'); S.tables[id] = !S.tables[id]; save(); render(); toast(S.tables[id] ? `You are in. ${first(t.host)} will see you ${t.when.split(',')[0].toLowerCase()}.` : 'You left the table.'); },
  dirfilter: k => { S.dirFilter = k; save(); render(); },
  follow: id => { S.follows[id] = !S.follows[id]; save(); render(); },
  say: text => send(text),
  doorsheet: () => doorSheet(),
  guestsheet: where => guestSheet(where || ''),
  interest: n => { S.interest[n] = !S.interest[n]; save(); render(); if (S.interest[n]) toast('Noted. You will hear first.'); },
  source: s => { S.settings.source = s; save(); render(); },
  signout: () => { S.unlocked = false; S.stack = []; S.view = 'gate'; save(); render(); }
};

function send(text) {
  const id = S.param; const t = S.threads.find(x => x.id === id); if (!t || !text.trim()) return;
  const now = new Date(D.club.today); now.setMinutes(now.getMinutes() + t.msgs.length);
  const stamp = d => d.toTimeString().slice(0, 5);
  t.msgs.push({who: 'me', text: text.trim(), t: stamp(now)}); save(); render();
  const th = document.getElementById('thread'); if (th) { th.innerHTML += '<div class="msg them typing"><i></i><i></i><i></i></div>'; th.scrollTop = th.scrollHeight; }
  setTimeout(() => {
    const cur = S.threads.find(x => x.id === id); if (!cur) return;
    let reply;
    if (cur.house) reply = /car/i.test(text) ? 'A car will be at your door at 17:45. Black, plate ending 0041.' : /physio|priya/i.test(text) ? 'Priya has Sunday at 10:00. I have moved it and told her.' : /table|dinner|two/i.test(text) ? 'A table for two at 20:00, by the window. The kitchen knows.' : /dairy|eat|allerg/i.test(text) ? 'Noted for Saturday. Meher has it.' : /sauna|open|tomorrow/i.test(text) ? 'The sauna is open from 05:30 tomorrow. Tuesday morning it closes for cedar.' : D.conciergeReplies[hash(text) % D.conciergeReplies.length];
    else if (id === 'riya') reply = /yes|ok|sure|7|lane/i.test(text) ? 'Lane 3 at 07:00 then. Eat something first.' : 'Noted. We will talk on the floor.';
    else if (id === 'zara') reply = /yes|going|track/i.test(text) ? 'Good. I am taking lane 5, far from the curse.' : 'Ha. See you on the 2nd.';
    else reply = 'Got it. See you at the House.';
    now.setMinutes(now.getMinutes() + 1);
    cur.msgs.push({who: 'them', text: reply, t: stamp(now)}); save();
    if (S.view === 'thread' && S.param === id) render();
  }, 1400);
}

/* ---------- forms ---------- */
const F = {
  gate: f => {
    const code = f.querySelector('#code').value.trim().toUpperCase();
    const box = f; if (!code) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); return; }
    if (code.startsWith('APP')) return go('application');
    const app = document.getElementById('app');
    app.insertAdjacentHTML('beforeend', `<div class="unlock"><div class="center stack g12"><h1 class="h-display h1">Welcome back, <span class="ital">${D.me.first}.</span></h1><p class="micro">House No. 1 · doors open until 23:00</p></div><div class="doors"><i></i><i></i></div></div>`);
    setTimeout(() => { S.unlocked = true; S.stack = []; go('today'); }, 2300);
  },
  say: f => { const i = f.querySelector('#say'); const v = i.value; i.value = ''; send(v); },
  nominate: f => { S.nominations.push({name: f.querySelector('#nn').value.trim(), what: f.querySelector('#nw').value.trim(), status: 'Sent'}); save(); toast('Sent to the committee. They sit on the first Monday.'); render(); },
  guest: f => { const name = f.querySelector('#gn').value.trim(); S.guests.unshift({name, when: f.querySelector('#gw').value.trim(), where: f.querySelector('#gh').value.trim()}); S.passes = Math.max(0, S.passes - 1); save(); closeSheet(); toast(`Pass issued. ${name.split(' ')[0]} is expected at the door.`); render(); },
  post: f => { const text = f.querySelector('#pt').value.trim(); if (!text) return; S.posts.unshift({id: 'u' + Date.now(), who: 'me', ago: 'now', text, likes: 0, likedBy: [], comments: 0}); save(); closeSheet(); toast('Posted to the room.'); render(); },
  table: f => { D.tables.unshift({id: 'u' + Date.now(), title: f.querySelector('#tt').value.trim(), when: f.querySelector('#tw').value.trim().split(',')[0], where: f.querySelector('#tw').value.trim().split(',').slice(1).join(',').trim() || 'The House', host: 'me', cap: 6, in: ['me']}); closeSheet(); toast('Your table is open. The House will seat it.'); render(); }
};

/* ---------- after render: animations, tilt ---------- */
function afterRender(view) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.arc[data-off]').forEach(a => a.style.strokeDashoffset = a.dataset.off);
    document.querySelectorAll('.fill[data-w]').forEach(a => a.style.width = a.dataset.w + '%');
    document.querySelectorAll('.bars i[data-h]').forEach(a => a.style.height = a.dataset.h + '%');
  }));
  const th = document.getElementById('thread'); if (th) th.scrollTop = th.scrollHeight;
  const k = document.getElementById('keycard');
  if (k) {
    const move = e => { const r = k.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; k.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`; k.style.setProperty('--sx', `${x * 120}%`); };
    k.addEventListener('pointermove', move); k.addEventListener('pointerleave', () => { k.style.transform = ''; k.style.setProperty('--sx', '-60%'); });
  }
  if (view === 'gate') { const c = document.getElementById('code'); if (c && window.matchMedia('(min-width:901px)').matches) c.focus(); }
}

/* ---------- events ---------- */
function bind() {
  const root = document.querySelector('.screen');
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tab],[data-go],[data-back],[data-act],[data-toggle]'); if (!t) return;
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.hasAttribute('data-back')) return back();
    if (t.dataset.go) { const [v, p] = t.dataset.go.split(':'); return go(v, p || null); }
    if (t.dataset.toggle) { S.settings[t.dataset.toggle] = !S.settings[t.dataset.toggle]; save(); render(); return; }
    if (t.dataset.act) { const [name, ...args] = t.dataset.act.split(':'); const fn = A[name]; if (fn) fn(...(name === 'toast' || name === 'say' ? [args.join(':')] : args)); }
  });
  root.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); const fn = F[f.dataset.form]; if (fn) fn(f); });
  root.addEventListener('input', e => { if (e.target.dataset.input === 'dir') { S.dirQuery = e.target.value; save(); const q = S.dirQuery.toLowerCase(); const f = S.dirFilter; const list = D.members.filter(m => !m.founder).filter(m => f === 'all' || (f === 'staff' ? m.staff : m.city === f)).filter(m => !q || (m.name + m.discipline + m.work + m.city).toLowerCase().includes(q)); const el = document.getElementById('dirlist'); if (el) el.innerHTML = dirList(list); } });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
  const idx = document.getElementById('idx');
  if (idx) idx.addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (!b) return; const [v, p] = b.dataset.go.split(':'); if (v === 'gate') { S.unlocked = false; S.stack = []; S.view = 'gate'; save(); return render(); } if (!S.unlocked) { S.unlocked = true; } S.stack = []; S.view = v; S.param = p || null; save(); render('enter'); });
  const reset = document.getElementById('reset'); if (reset) reset.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) {} S = fresh(); render(); });
}

/* ---------- boot ---------- */
function start(data) {
  load();
  if (data && data.S) S = Object.assign(fresh(), data.S);
  bind(); render();
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({S})); } catch (e) {}
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
