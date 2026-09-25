/* module: checkin */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef} = React;

  const PLACES = ['Office', 'Client site', 'Home', 'Travelling'];
  const MODE_LABEL = {office: 'office', wfh: 'WFH'};
  const CONSENT = 'Checking in records the time and your location at that moment. Kaavish can see both.';
  const DEFAULT_RADIUS = 200;
  const MAX_ACC = 1000;

  /* ---------- pure helpers ---------- */
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const daysOf = (ctx, uid) => (collMap(ctx, 'checkin')[uid] || {}).days || {};
  const settingsOf = ctx => (ctx && ctx.settings) || {};

  /* epoch ms of start plus grace on the given date, for this person */
  function cutoffMs(ctx, uid, ymd) {
    const s = settingsOf(ctx);
    const start = (ctx && typeof ctx.startFor === 'function' && ctx.startFor(uid)) || s.start || '10:30';
    const grace = Number(s.grace) || 0;
    return U.parseYmd(ymd).getTime() + (U.minutes(start) + grace) * 60000;
  }

  /* a check-in is late when it lands after start plus grace on its own date */
  function isLate(ctx, uid, inMs) {
    if (!inMs) return false;
    return inMs > cutoffMs(ctx, uid, U.ymd(new Date(inMs)));
  }

  /* one day of attendance for one person, with the special day precedence applied */
  function dayStatus(ctx, uid, ymd) {
    const entry = daysOf(ctx, uid)[ymd] || null;
    const mode = entry && (entry.mode === 'office' || entry.mode === 'wfh') ? entry.mode : null;
    let status = 'none';
    if (entry && entry.mode === 'leave') status = 'leave';   /* marked as leave from Admin */
    else if (ctx && typeof ctx.onLeave === 'function' && ctx.onLeave(uid, ymd)) status = 'leave';
    else if (ctx && ctx.holidays && typeof ctx.holidays.has === 'function' && ctx.holidays.has(ymd)) status = 'holiday';
    else if (U.parseYmd(ymd).getDay() === 0) status = 'sunday';
    else if (mode) status = mode;
    const inMs = entry && entry.in ? entry.in : null;
    const out = entry && entry.out ? entry.out : null;
    const loc = (entry && entry.loc) || null;
    const outLoc = (entry && entry.outLoc) || null;
    const working = status === 'office' || status === 'wfh';
    return {
      status,
      in: inMs,
      out,
      late: working && isLate(ctx, uid, inMs),
      verified: !!(loc && loc.verified),
      place: (loc && loc.place) || '',
      loc,
      outLoc,
      hours: inMs && out ? Math.max(0, out - inMs) : null,
      entry
    };
  }

  /* WFH check-ins Monday to Saturday of the week that holds mondayDate */
  /* WFH days a week for one person: their own allowance when set on the roster, else the team default */
  function wfhCapFor(ctx, uid) {
    const m = (ctx && ctx.members && ctx.members[uid]) || {};
    if (m.wfhCap != null && String(m.wfhCap) !== '' && Number(m.wfhCap) >= 0) return Math.floor(Number(m.wfhCap));
    return Number(ctx && ctx.settings && ctx.settings.wfhCap) || 0;
  }
  function wfhUsed(ctx, uid, mondayDate) {
    const days = daysOf(ctx, uid);
    const mon = U.mondayOf(mondayDate || new Date());
    return U.weekDays(mon).filter(d => days[d] && days[d].mode === 'wfh').length;
  }

  /* metres to a short distance: '640 m away' or '3.4 km away' */
  function distText(m) {
    const r = Math.round(m);
    return r < 1000 ? r + ' m away' : (m / 1000).toFixed(1) + ' km away';
  }

  /* a Loc from a gps fix, judged against the office when one is set */
  function locFrom(pos, office) {
    const hasOffice = !!(office && isFinite(office.lat) && isFinite(office.lng));
    const dist = hasOffice ? U.haversine(pos, office) : null;
    const verified = hasOffice && dist <= (Number(office.radius) || DEFAULT_RADIUS) && pos.acc <= MAX_ACC;
    const place = verified ? (office.label || 'Office')
      : hasOffice ? 'Outside office, ' + distText(dist)
      : 'Location captured';
    return {lat: pos.lat, lng: pos.lng, acc: pos.acc, dist: dist == null ? null : Math.round(dist), verified, place, src: 'gps'};
  }

  const selfLoc = place => ({lat: null, lng: null, acc: null, dist: null, verified: false, place, src: 'self'});

  /* the sentence after the time: 'Verified at Mumbai office.' or 'Outside office, 3.4 km away.' */
  function placeText(loc) {
    if (!loc) return 'No location.';
    if (loc.verified) return 'Verified at ' + (loc.place || 'the office') + '.';
    if (loc.src === 'self') return (loc.place || 'Somewhere') + ', self reported.';
    return (loc.place || 'Location captured') + '.';
  }

  const modeLabel = mode => MODE_LABEL[mode] || String(mode || '');

  /* ---------- the card ---------- */
  function CheckinCard() {
    const ctx = M.useCtx();
    const ctxRef = useRef(ctx);
    ctxRef.current = ctx;
    const live = useRef(true);
    useEffect(() => () => { live.current = false; }, []);
    const [busy, setBusy] = useState(false);
    const [pick, setPick] = useState(null);
    if (!ctx || !ctx.uid) return null;

    const uid = ctx.uid;
    const today = U.todayStr();
    const ds = dayStatus(ctx, uid, today);
    const cap = wfhCapFor(ctx, uid);
    const used = wfhUsed(ctx, uid, new Date());
    const atCap = used >= cap;

    const done = () => { if (live.current) setBusy(false); };
    const writeDay = (entry, msg) => {
      const c = ctxRef.current;
      const days = U.pruneDays({...U.clone(daysOf(c, uid)), [today]: entry});
      return c.W.merge('checkin/' + uid, {days}).then(() => M.toast(msg)).catch(() => {});
    };
    const checkIn = mode => {
      if (busy) return;
      setBusy(true);
      M.getLoc().then(pos => {
        if (!live.current) return;
        if (!pos) { setPick(mode); done(); return; }
        const loc = locFrom(pos, ctxRef.current.settings.office);
        return writeDay({in: Date.now(), out: null, mode, loc, outLoc: null}, 'Checked in').then(done);
      });
    };
    const pickPlace = place => {
      if (busy || !pick) return;
      setBusy(true);
      writeDay({in: Date.now(), out: null, mode: pick, loc: selfLoc(place), outLoc: null}, 'Checked in')
        .then(() => { if (live.current) setPick(null); done(); });
    };
    const checkOut = () => {
      if (busy) return;
      const current = daysOf(ctxRef.current, uid)[today];
      if (!current || !current.in) return;
      setBusy(true);
      M.getLoc().then(pos => {
        if (!live.current) return;
        const outLoc = pos ? locFrom(pos, ctxRef.current.settings.office) : null;
        const entry = {...U.clone(current), out: Date.now(), outLoc};
        return writeDay(entry, 'Checked out').then(done);
      });
    };

    const consent = html`<div class="sub small">${CONSENT}</div>`;
    const finding = busy ? html`<div class="sub small">Finding your location.</div>` : null;
    const latePill = ds.late ? html`<${UI.Pill} kind="flame">late<//>` : null;

    let body;
    if (ds.status === 'leave') {
      body = html`<div>You're on approved leave today.</div>`;
    } else if (ds.status === 'holiday') {
      body = html`<div>Today is a holiday.</div>`;
    } else if (ds.status === 'sunday') {
      body = html`<div>Sunday. The OS rests too.</div>`;
    } else if (!ds.in) {
      body = html`<div class="stack">
        ${pick ? html`<div class="stack tight" id="checkin-picker">
          <div>Where are you checking in from?</div>
          <div class="row">
            ${PLACES.map(p => html`<${UI.Btn} key=${p} kind="sec" sm disabled=${busy} onClick=${() => pickPlace(p)}>${p}<//>`)}
            <${UI.Btn} kind="ghost" sm disabled=${busy} onClick=${() => setPick(null)}>Cancel<//>
          </div>
          <div class="sub small">Location could not be captured. The place you pick is saved as self reported.</div>
        </div>` : html`<div class="row">
          <${UI.Btn} disabled=${busy} onClick=${() => checkIn('office')}>Check in, office<//>
          <${UI.Btn} kind="sec" disabled=${busy || atCap} onClick=${() => checkIn('wfh')}>Check in, WFH<//>
        </div>`}
        <div class="sub small num">WFH days used this week: ${used} of ${cap}</div>
        ${finding}
        ${consent}
      </div>`;
    } else if (!ds.out) {
      body = html`<div class="stack">
        <div class="row">
          <span class="num">Checked in at ${U.hhmm(ds.in)}, ${modeLabel(ds.entry.mode)}. ${placeText(ds.loc)}</span>
          ${latePill}
        </div>
        <div class="row"><${UI.Btn} disabled=${busy} onClick=${checkOut}>Check out<//></div>
        ${finding}
        ${consent}
      </div>`;
    } else {
      body = html`<div class="stack">
        <div class="row">
          <span class="num">In ${U.hhmm(ds.in)}, out ${U.hhmm(ds.out)}, ${U.durText(ds.hours)}.</span>
          ${latePill}
        </div>
        <div class="sub small">${U.cap(modeLabel(ds.entry.mode))}. ${placeText(ds.loc)}</div>
        ${consent}
      </div>`;
    }

    return html`<${UI.Card} title="Check in" id="checkin-card">${body}<//>`;
  }

  M.parts.CheckinCard = CheckinCard;
  M.att = {dayStatus, isLate, wfhUsed, wfhCapFor, locFrom, placeText, distText, modeLabel, PLACES};
})();
