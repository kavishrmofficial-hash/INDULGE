/* m360 OS core: namespace, utils, boot, writes, hooks, toasts. */
'use strict';
const M = window.M = {pages:{}, parts:{}, icons:{}};
M.React = React;
const html = M.html = htm.bind(React.createElement);

/* ---------- utils ---------- */
const U = M.U = (() => {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const [y, m, d] = String(s || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const isoWeek = d => {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dn = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dn + 3);
    const fy = x.getUTCFullYear(), f = new Date(Date.UTC(fy, 0, 4));
    return fy + '-W' + pad(1 + Math.round(((x - f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7));
  };
  const mondayOfWeekId = wk => {
    const [y, w] = wk.split('-W').map(Number);
    const j4 = new Date(y, 0, 4); const mon = mondayOf(j4);
    return addDays(mon, (w - 1) * 7);
  };
  const quarterId = d => d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
  const monthId = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const isoLocal = d => {
    const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o);
    return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00' + s + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  };
  const haversine = (a, b) => {
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const hhmm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const minutes = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const durText = ms => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate = s => { const d = parseYmd(s); return d.getDate() + ' ' + MON_S[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtDay = s => { const d = parseYmd(s); return DAYS_S[d.getDay()] + ' ' + d.getDate() + ' ' + MON_S[d.getMonth()]; };
  const timeAgo = ts => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
    return Math.round(d / 30) + 'mo ago';
  };
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  const todayStr = () => ymd(new Date());
  const pct = (a, b) => b > 0 ? Math.round(100 * a / b) : 0;
  /* Monday to Saturday of the week that starts on `monday` */
  const weekDays = monday => [0, 1, 2, 3, 4, 5].map(i => ymd(addDays(monday, i)));
  /* rolling documents: keep 150 days of daily entries, 26 weeks of weekly entries */
  const pruneDays = (days, keep) => {
    const cut = ymd(addDays(new Date(), -(keep || 150)));
    const out = {};
    for (const k of Object.keys(days || {})) if (k >= cut) out[k] = days[k];
    return out;
  };
  const pruneWeeks = (weeks, keep) => {
    const cut = isoWeek(addDays(new Date(), -7 * (keep || 26)));
    const out = {};
    for (const k of Object.keys(weeks || {})) if (k >= cut) out[k] = weeks[k];
    return out;
  };
  /* inclusive ymd range for a scoring period */
  const periodRange = (period, d) => {
    d = d || new Date();
    if (period === 'month') {
      return {from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))};
    }
    if (period === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) * 3;
      return {from: ymd(new Date(d.getFullYear(), q, 1)), to: ymd(new Date(d.getFullYear(), q + 3, 0))};
    }
    const mon = mondayOf(d);
    return {from: ymd(mon), to: ymd(addDays(mon, 5))};
  };
  const greeting = d => { const h = (d || new Date()).getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  /* "tuesday 22 september, week 39" */
  const dateLabel = d => { d = d || new Date(); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ', week ' + Number(isoWeek(d).split('-W')[1]); };
  const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
  return {pad, ymd, parseYmd, mondayOf, addDays, isoWeek, mondayOfWeekId, quarterId, monthId, isoLocal,
    haversine, hhmm, minutes, durText, fmtDate, fmtDay, timeAgo, inr, uid, clone, cap, daysBetween, todayStr, pct,
    weekDays, pruneDays, pruneWeeks, periodRange, greeting, dateLabel, firstName, MONTHS, DAYS, DAYS_S};
})();

/* ---------- boot ---------- */
M.boot = async function boot() {
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') return {mode: 'nohost'};
  const [db, user, mcp, downloads, permissions] = await Promise.all(
    ['db', 'user', 'mcp', 'downloads', 'permissions'].map(n => cl.use(n)));
  if (!db || !user) return {mode: 'nocap'};
  const me = await user.me();
  if (!me.id) return {mode: 'noid'};
  return {mode: 'ok', db, user, mcp, downloads, permissions, me, owner: !!me.isOwner};
};

/* ---------- toasts ---------- */
const toastListeners = new Set();
let toastSeq = 0;
M.toast = (msg, isErr) => {
  const t = {id: ++toastSeq, msg: String(msg), err: !!isErr};
  toastListeners.forEach(fn => fn(t));
};
M.ToastHost = function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const on = t => {
      setItems(x => [...x, t]);
      setTimeout(() => setItems(x => x.filter(i => i.id !== t.id)), 3200);
    };
    toastListeners.add(on);
    return () => toastListeners.delete(on);
  }, []);
  return html`<div class="toasts" aria-live="polite">
    ${items.map(t => html`<div key=${t.id} class=${'toast' + (t.err ? ' err' : '')}>${t.msg}</div>`)}
  </div>`;
};

/* ---------- serialized writes ---------- */
const Q = {};
function queued(path, fn) { const p = (Q[path] || Promise.resolve()).then(fn, fn); Q[path] = p.catch(() => {}); return p; }
const WRITE_MSG = {
  quota_exceeded: 'The workspace is full. Ask Kaavish to run cleanup on the Desk.',
  invalid_argument: 'That could not be saved here.',
  revoked: 'Your access changed. Reload the page.'
};
M.makeWrites = db => {
  const fail = e => { M.toast(WRITE_MSG[e && e.code] || 'That did not save. Try again in a moment.', true); throw e; };
  return {
    set: (p, d) => queued(p, () => db.doc(p).set(d)).catch(fail),
    update: (p, d) => queued(p, () => db.doc(p).update(d)).catch(fail),
    /* merge-or-create: update first, set when the document is missing */
    merge: (p, d) => queued(p, () => db.doc(p).update(d).catch(e => {
      if (e && e.code === 'invalid_argument') return db.doc(p).set(d);
      throw e;
    })).catch(fail),
    del: p => queued(p, () => db.doc(p).delete()).catch(fail)
  };
};

/* ---------- data hooks ---------- */
M.useColl = function useColl(db, path) {
  const [s, set] = React.useState({ready: false, map: {}});
  React.useEffect(() => {
    if (!db) return;
    let un;
    try {
      un = db.collection(path).onSnapshot(q => {
        const m = {};
        q.docs.forEach(d => { if (d.exists) m[d.id] = d.data(); });
        set({ready: true, map: m});
      }, e => set(x => ({...x, ready: true, err: e && e.code})));
    } catch (e) { set({ready: true, map: {}}); }
    return () => { if (un) un(); };
  }, [db, path]);
  return s;
};
M.useDoc = function useDoc(db, path) {
  const [s, set] = React.useState({ready: false, data: null});
  React.useEffect(() => {
    if (!db || !path) return;
    let un;
    try {
      un = db.doc(path).onSnapshot(d => set({ready: true, data: d.exists ? d.data() : null}),
        e => set(x => ({...x, ready: true, err: e && e.code})));
    } catch (e) { set({ready: true, data: null}); }
    return () => { if (un) un(); };
  }, [db, path]);
  return s;
};

/* ---------- profiles ---------- */
const profCache = {};
M.useProfiles = function useProfiles(ids) {
  const user = M.userNs;
  const key = (ids || []).filter(Boolean).sort().join(',');
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!user || !key) return;
    let live = true;
    user.profiles(key.split(',')).then(ps => {
      if (!live) return;
      let changed = false;
      Object.keys(ps).forEach(id => {
        const p = ps[id];
        const c = profCache[id];
        if (!c || c.name !== p.name || c.avatarUrl !== p.avatarUrl) { profCache[id] = p; changed = true; }
      });
      if (changed) force();
    });
    return () => { live = false; };
  }, [user, key]);
  const out = {};
  (key ? key.split(',') : []).forEach(id => {
    out[id] = profCache[id] || {id, name: '', avatarUrl: AV_FALLBACK, color: '#EFEDE7', email: null, isMe: false};
  });
  return out;
};
const AV_FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#EFEDE7"/><circle cx="20" cy="16" r="7" fill="#0E0E0E" opacity=".25"/><path d="M6 38c2-8 8-11 14-11s12 3 14 11" fill="#0E0E0E" opacity=".25"/></svg>');
M.AV_FALLBACK = AV_FALLBACK;

/* ---------- location ---------- */
M.getLoc = function getLoc() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; res(null); } }, 11000);
    try {
      navigator.geolocation.getCurrentPosition(p => {
        if (done) return; done = true; clearTimeout(t);
        res({lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4), acc: Math.round(p.coords.accuracy)});
      }, () => { if (done) return; done = true; clearTimeout(t); res(null); },
      {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
    } catch (e) { if (!done) { done = true; clearTimeout(t); res(null); } }
  });
};

/* ---------- mcp watch ---------- */
M.useWatch = function useWatch(mcp, server, tool, input, ms) {
  const [s, set] = React.useState({state: mcp ? 'loading' : 'none'});
  const key = JSON.stringify(input);
  React.useEffect(() => {
    if (!mcp) { set({state: 'none'}); return; }
    const DENY = ['needs_reauth', 'server_not_connected', 'blocked_by_policy', 'approval_required',
      'not_in_manifest', 'selection_required', 'not_granted', 'capability_disabled', 'capability_removed', 'consent_required'];
    let un;
    try {
      un = mcp.watchTool(server, tool, input, ev => {
        if (ev.type === 'data') {
          set({state: 'ok', data: ev.result.payload, at: (ev.result.cache && ev.result.cache.storedAt) || Date.now()});
        } else {
          const c = ev.error && ev.error.code;
          if (DENY.includes(c)) set({state: 'denied', code: c});
          else set(x => x.state === 'ok' ? {...x, stale: true, code: c} : {state: 'error', code: c, msg: ev.error && ev.error.message});
        }
      }, {refetchInterval: ms});
    } catch (e) { set({state: 'error', code: 'bad_request'}); }
    return () => { if (un) un(); };
  }, [mcp, server, tool, key, ms]);
  return s;
};

/* ---------- hash routing ---------- */
M.parseHash = () => {
  const h = (location.hash || '').replace(/^#/, '');
  const [page, id] = h.split('/');
  return {page: page || '', id: id ? decodeURIComponent(id) : null};
};
M.nav = h => { location.hash = h; };
M.useRoute = function useRoute() {
  const [r, set] = React.useState(M.parseHash());
  React.useEffect(() => {
    const on = () => set(M.parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
};

/* ---------- clock (one re-render a minute) ---------- */
M.useNow = function useNow() {
  const [n, set] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => set(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  return n;
};
