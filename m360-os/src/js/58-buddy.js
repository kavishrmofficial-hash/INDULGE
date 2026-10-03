/* module: buddy. The m360 buddy lives in the dock, bottom right: a small flame droid that idles, looks
   at your pointer, naps when you have been away, hops when something new is for you, and wears its
   headphones while it listens. Click it and the panel grows out of it (57-panel.js); hold it, or hold
   Ctrl + Option anywhere, and talk, and let go to send. Conversation mode keeps listening after each
   answer until you stop it, go quiet, or leave the tab. Claude reads a map of what is on screen plus
   your work data, answers in the panel (a short line out loud when you spoke), and the pointer flies
   out of the dock to the exact control, rings it, and, when you ask, clicks or types for you. It never
   presses anything destructive (delete, offboard, restore, sign out): those it points at; approve,
   decline and the like wait on a tap. It says hello once a day and gives the onboarding tour (57-tour.js),
   its caption a coach mark beside what it points at. On a phone the dock is a smaller droid and the
   panel is a sheet (85-orb.js). */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef, useCallback} = React;

  const coarse = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const fine = () => { try { return window.matchMedia('(pointer: fine)').matches; } catch (e) { return true; } };
  const reduced = () => M.reduced();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
  const pref = (k, d) => M.prefs.get(k, d);

  const SECTIONS = ['home', 'tasks', 'projects', 'calendar', 'reviews', 'week', 'clients', 'pitches', 'crm', 'feed', 'people', 'voice', 'scores', 'music',
    'chat', 'mail', 'gcal', 'drive', 'web', 'notes', 'break', 'play', 'reset', 'care', 'reflect', 'base', 'companies', 'import', 'radar', 'awards', 'watch', 'me', 'trophies', 'leave', 'handbook', 'hiring',
    'handshake', 'map', 'hq', 'command', 'admin', 'books', 'invoices', 'expenses', 'payroll', 'letters', 'billing'];
  const FOUNDER_ONLY = ['hq', 'command', 'admin', 'hiring'];
  const OWNER_ONLY = ['books', 'invoices', 'expenses', 'payroll', 'letters', 'billing'];
  /* controls the buddy will point at but never press */
  const RISKY = /delete|remove|erase|wipe|trash|offboard|lock|unlock|restore|overwrite|revoke|sign out|log out|approve|reject|decline|pay|revert|clear|withdraw|cancel|send back|reset|\bpaid\b|\bexport|\bdownload|\bprune|\bissue\b/i;
  /* of those, the ones a person cannot take back stay theirs to press; the rest wait on one tap on a card */
  const DESTROY = /delete|remove|erase|wipe|trash|offboard|lock|unlock|restore|overwrite|revoke|sign out|log out|pay|revert|\bpaid\b|\bexport|\bdownload|\bprune|\bissue\b/i;
  /* the pulse is answered by the person alone, never on their behalf */
  const THEIRS = '#pulse-card';
  const STOP_WORDS = /^(stop listening|that s all|thats all|that is all|thanks bye|thank you bye|bye|stop)$/;
  const KEEP_WORDS = /^(keep listening|stay with me|conversation mode|keep going)$/;
  const plainWords = t => String(t || '').toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

  /* ---------- the screen, as Claude sees it ---------- */
  function scan() {
    const sel = 'button, a[href], input, select, textarea, [role="tab"], h1, h2, .card-title, .stat, .tcard';
    const W = window.innerWidth, H = window.innerHeight;
    const out = [];
    let n = 0;
    document.querySelectorAll('[data-ai]').forEach(el => el.removeAttribute('data-ai'));
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('.buddy-bubble, .buddy-home, #buddy-dock, .agent-panel, .tabbar')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H * 2.2 || r.right < 0 || r.left > W) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      let label = el.getAttribute('aria-label') || (el.innerText || '').replace(/\s+/g, ' ').trim() || el.getAttribute('placeholder') || el.value || '';
      label = String(label).slice(0, 70);
      if (!label) continue;
      const tag = el.matches('h1, h2, .card-title') ? 'heading' : el.matches('select') ? 'select' : el.matches('input, textarea') ? 'field'
        : el.getAttribute('role') === 'tab' || el.classList.contains('tab') ? 'tab' : el.tagName === 'A' ? 'link' : 'button';
      /* what state it is in, so answers can read the screen and never guess */
      let st = '';
      if (tag === 'tab' && (el.getAttribute('aria-selected') === 'true' || el.classList.contains('active'))) st = 'selected';
      else if (tag === 'field' && el.type === 'checkbox') st = el.checked ? 'checked' : 'unchecked';
      else if (tag === 'field' && el.value) st = 'value: ' + String(el.value).slice(0, 40);
      else if (tag === 'select' && el.selectedOptions && el.selectedOptions[0]) st = 'value: ' + String(el.selectedOptions[0].textContent).trim().slice(0, 40);
      else if (el.disabled) st = 'disabled';
      else if (el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-expanded') === 'true') st = 'on';
      if (st) label += ' [' + st + ']';
      const box = el.closest('section, header, .card, .drawer, aside, nav');
      const head = box ? (box.querySelector('.card-title, h1, h2, .drawer-head h2') || {}).innerText || '' : '';
      const id = 'e' + (++n);
      el.setAttribute('data-ai', id);
      out.push(id + ' | ' + tag + ' | ' + label + (head && head !== label ? ' | in: ' + String(head).replace(/\s+/g, ' ').slice(0, 40) : '') + (r.top > H ? ' | below the fold' : ''));
      if (n >= 150) break;
    }
    return out.join('\n');
  }
  const findEl = id => document.querySelector('[data-ai="' + String(id).replace(/[^a-z0-9]/gi, '') + '"]');
  const firstVisible = sel => Array.from(document.querySelectorAll(sel)).find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
  const labelOf = el => (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
  const risky = el => {
    if (!el) return true;
    return RISKY.test(labelOf(el)) || /danger|armed/.test(el.className || '') || (el.closest('form') && el.type === 'submit') || !!el.closest(THEIRS);
  };
  const destructive = el => DESTROY.test(labelOf(el)) || /danger|armed/.test(el.className || '') || !!el.closest(THEIRS);
  /* React controlled inputs listen to the native setter, so type through it */
  function setNative(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }

  /* ---------- the pointer: the character's hand ---------- */
  const Face = () => html`<svg viewBox="0 0 28 28" aria-hidden="true">
    <path class="body" d="M5 3.6 23.2 11.5c1 .45.9 1.9-.15 2.25l-7.3 2.2-3 7.1c-.45 1.05-1.95 1-2.3-.1L3.9 5c-.3-.95.35-1.75 1.1-1.4Z"/>
    <g class="eyes">
      <circle class="eye" cx="10.2" cy="9.4" r="2.1"/><circle class="eye" cx="15.2" cy="11.6" r="2.1"/>
      <circle class="pupil" cx="10.4" cy="9.5" r="1"/><circle class="pupil" cx="15.4" cy="11.7" r="1"/>
    </g>
    <path class="mouth" d="M11 15.2c1 .9 2.3 1 3.4.3"/>
  </svg>`;

  /* the dock's corner keeps clear of the chat composer, the music player, a drawer's footer and
     anything marked data-dock-avoid; a drawer moves it beside the drawer */
  /* the tab bar shows on a narrow window with a mouse too; a phone's dock already sits above it */
  const AVOID = '.chat-composer, #music-dock, .drawer-foot, [data-dock-avoid], .tabbar';
  function useDockPlace(on) {
    useEffect(() => {
      if (!on) return undefined;
      let raf = 0, ro = null, watched = [];
      const root = document.documentElement;
      const check = () => {
        raf = 0;
        const W = window.innerWidth, H = window.innerHeight;
        const drawer = document.querySelector('.drawer');
        /* beside a drawer only where the drawer is a side panel (wider than 860) and the pop-up still fits */
        const beside = !!drawer && W > 860;
        const onPhone = !!document.querySelector('#buddy-dock.on-phone');
        const right = beside ? Math.min(480, W) + 16 : (onPhone ? 16 : 24);
        const x1 = W - right, x0 = x1 - 64;
        let lift = 0;
        const seen = [];
        document.querySelectorAll(AVOID).forEach(el => {
          if (el.closest('#buddy-dock, .agent-panel') || (onPhone && el.classList.contains('tabbar'))) return;
          seen.push(el);
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || r.right < x0 || r.left > x1 || r.top < H * 0.35 || r.top > H) return;
          lift = Math.max(lift, H - r.top + 12 - 24);
        });
        root.style.setProperty('--dock-lift', Math.max(0, Math.round(lift)) + 'px');
        root.classList.toggle('dock-beside-drawer', beside);
        /* observe a new set only when it changed: observing reports each size once, which would run this again */
        if (ro && (seen.length !== watched.length || seen.some((el, i) => el !== watched[i]))) {
          ro.disconnect(); seen.forEach(el => ro.observe(el)); watched = seen;
        }
      };
      const soon = () => { if (!raf) raf = requestAnimationFrame(check); };
      if (typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(soon);
      let mo = null;
      try { mo = new MutationObserver(soon); mo.observe(document.body, {childList: true, subtree: true}); } catch (e) { mo = null; }
      window.addEventListener('resize', soon);
      window.addEventListener('scroll', soon, {passive: true});
      check();
      return () => {
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
        window.removeEventListener('resize', soon); window.removeEventListener('scroll', soon);
        root.style.removeProperty('--dock-lift'); root.classList.remove('dock-beside-drawer');
      };
    }, [on]);
  }

  /* the session (57-panel.js), as state */
  function useSession() {
    const [, setN] = useState(0);
    useEffect(() => { const f = () => setN(n => n + 1); M.assistant.subs.add(f); return () => { M.assistant.subs.delete(f); }; }, []);
    return M.assistant.st;
  }

  /* the coach mark sits beside what the tour points at, above or below it near the edges; its height
     is CSS alone (max-height from the edge it hangs on) */
  function coachPlace(ring) {
    if (!ring) return null;
    const W = window.innerWidth, H = window.innerHeight;
    const w = Math.min(320, W - 32);
    const st = {};
    const fitsRight = ring.left + ring.width + 12 + w <= W - 16, fitsLeft = ring.left - 12 - w >= 16;
    const low = ring.top + ring.height / 2 > H / 2;
    if (fitsRight || fitsLeft) {
      st.left = (fitsRight ? ring.left + ring.width + 12 : ring.left - 12 - w) + 'px';
      if (low) st['--bottom'] = Math.max(16, H - ring.top - ring.height) + 'px'; else st['--top'] = Math.max(16, ring.top) + 'px';
    } else {
      st.left = Math.max(16, Math.min(W - w - 16, ring.left)) + 'px';
      if (low) st['--bottom'] = Math.max(16, H - ring.top + 12) + 'px'; else st['--top'] = Math.min(H - 120, ring.top + ring.height + 12) + 'px';
    }
    return st;
  }

  function Buddy() {
    const ctx = M.useCtx();
    const st = useSession();
    const phone = M.usePhone() && coarse() && !fine();
    const [open, setOpen] = useState(false);            /* false, 'pop' or 'sheet' */
    const [closing, setClosing] = useState(false);
    const [initial, setInitial] = useState('');
    const [intro, setIntro] = useState(null);           /* {kind: 'hello'|'welcome', text} */
    const [ring, setRing] = useState(null);             /* {left, top, width, height} */
    const [step, setStep] = useState(-1);               /* tour step, or -1 */
    const [stops, setStops] = useState([]);
    const [tourText, setTourText] = useState('');
    const [auto, setAuto] = useState(() => pref('buddyAuto', '1') !== '0');
    const [talking, setTalking] = useState(false);
    const [live, setLive] = useState(false);            /* the microphone is open */
    const [push, setPush] = useState(false);            /* held: Ctrl + Option, or the character */
    const [follow, setFollow] = useState(false);
    const [conv, setConv] = useState(false);
    const [folded, setFolded] = useState(false);
    const [out, setOut] = useState(false);              /* the pointer is out of the dock */
    const [hop, setHop] = useState(0);
    const [away, setAway] = useState(false);            /* phones: the dock steps down while the page scrolls */
    const [kb, setKb] = useState(false);                /* phones: the keyboard is up */
    const [typing, setTyping] = useState(false);
    const [hiddenTab, setHiddenTab] = useState(false);
    const [idle, setIdle] = useState(false);
    const [hover, setHover] = useState(false);          /* a pointer over the character wakes it */
    const [badge, setBadge] = useState(0);
    const [prefsN, setPrefsN] = useState(0);
    const ride = pref('buddyRide', '0') === '1' && !phone;
    const showDock = pref('dockShow', '1') !== '0' && pref('dockHidden', '') !== U.todayStr();
    const talkKey = pref('talkKey', 'ctrlopt');
    const pointerRef = useRef(null);
    const trailRef = useRef([]);
    const homeRef = useRef(null);
    const mouse = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const pos = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const vel = useRef({x: 0, y: 0});
    const trail = useRef([{x: 0, y: 0}, {x: 0, y: 0}]);
    const pinned = useRef(false);
    const flight = useRef(null);
    const pinAt = useRef(null);
    const still = useRef(0);
    const target = useRef(null);
    const homeT = useRef(0);
    const outRef = useRef(false);
    const mic = useRef(null);
    const pushAt = useRef(0);
    const holdTimer = useRef(0);
    const holdDone = useRef(false);
    const walk = useRef(null);
    const tourRun = useRef(0);
    const lang = useRef('en');
    const convRef = useRef(false);
    const convT = useRef({cap: 0});
    const openRef = useRef(false);
    const closingRef = useRef(false);
    const closeT = useRef(0);
    const opener = useRef(null);
    const stepRef = useRef(-1);
    const stopsRef = useRef(stops);
    const autoRef = useRef(auto);
    const rideRef = useRef(ride);
    const lastInput = useRef(Date.now());
    const ctxRef = useRef(ctx);
    const heardRef = useRef(null);
    ctxRef.current = ctx;
    openRef.current = open; closingRef.current = closing; stepRef.current = step; stopsRef.current = stops; autoRef.current = auto; rideRef.current = ride; convRef.current = conv;

    useEffect(() => { if (M.chat && ctx.db && ctx.uid) M.chat.watch(ctx); }, [ctx.uid]);
    useDockPlace(true);
    useEffect(() => { const f = () => setPrefsN(n => n + 1); window.addEventListener('m360:dockprefs', f); return () => window.removeEventListener('m360:dockprefs', f); }, []);

    /* the mouth moves, and the dock bobs, while a line is being said */
    useEffect(() => {
      const f = e => { const on = !!(e.detail && e.detail.on); setTalking(on); M.assistant.set({speaking: on}); };
      window.addEventListener('m360:speech', f);
      return () => window.removeEventListener('m360:speech', f);
    }, []);

    /* the badge: what the personal managers hold for you, and what waits on your tap */
    useEffect(() => {
      const count = () => {
        let n = M.brain && M.brain.pending ? M.brain.pending.list.length : 0;
        try { n += M.pm && M.pm.badge ? Number(M.pm.badge(ctx)) || 0 : 0; } catch (e) { /* not ready */ }
        setBadge(n);
      };
      count();
      const subs = M.brain && M.brain.pending ? M.brain.pending.subs : null;
      if (subs) subs.add(count);
      return () => { if (subs) subs.delete(count); };
    }, [ctx]);
    /* something new for you: one hop, and it wakes */
    useEffect(() => {
      const f = () => { setHop(n => n + 1); setIdle(false); lastInput.current = Date.now(); };
      window.addEventListener('m360:pm', f);
      return () => window.removeEventListener('m360:pm', f);
    }, []);

    /* still while you type, while the tab is hidden, during focus; asleep after ten quiet minutes */
    useEffect(() => {
      let tt = 0;
      const key = e => {
        lastInput.current = Date.now(); setIdle(false);
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { setTyping(true); clearTimeout(tt); tt = setTimeout(() => setTyping(false), 3000); }
      };
      const poke = () => { lastInput.current = Date.now(); setIdle(false); };
      const vis = () => setHiddenTab(document.visibilityState === 'hidden');
      const tick = setInterval(() => setIdle(Date.now() - lastInput.current > 600000), 30000);
      window.addEventListener('keydown', key, true);
      window.addEventListener('pointerdown', poke, true);
      document.addEventListener('visibilitychange', vis);
      return () => { clearTimeout(tt); clearInterval(tick); window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', poke, true); document.removeEventListener('visibilitychange', vis); };
    }, []);
    const focusOn = !!(M.focus && M.focus.get && M.focus.get());
    /* asleep outside their day: an hour and a half before their start to two and a half after the EOD cut,
       and on leave, a holiday or a Sunday */
    const offHours = (() => {
      const d = new Date(ctx.now || Date.now());
      const mins = d.getHours() * 60 + d.getMinutes();
      const s = ctx.settings || {};
      const start = U.minutes(String((typeof ctx.startFor === 'function' && ctx.startFor(ctx.uid)) || s.start || '10:30'));
      const cut = U.minutes(String(s.eodCut || '19:30'));
      let day = '';
      try { day = M.att && M.att.dayStatus ? (M.att.dayStatus(ctx, ctx.uid, U.todayStr()) || {}).status : ''; } catch (e) { day = ''; }
      return mins < start - 90 || mins >= cut + 150 || day === 'leave' || day === 'holiday' || day === 'sunday';
    })();

    /* ---------- the pointer: rests in the dock, flies out to point; "ride next to my cursor" follows the mouse ---------- */
    const home = () => {
      const el = homeRef.current;
      if (!el) return {x: window.innerWidth - 60, y: window.innerHeight - 60};
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width * 0.3, y: r.top + r.height * 0.3};
    };
    useEffect(() => {
      if (phone && !open && step < 0) return undefined;
      let raf = 0, last = 0;
      const move = e => {
        if (e.pointerType === 'touch') return;
        mouse.current = {x: e.clientX + 16, y: e.clientY + 14};
        still.current = Date.now();
        if (pinned.current && rideRef.current) {
          const a = pinAt.current;
          if (!a || Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y) > 28) { if (flight.current) flight.current.moved = true; else pinned.current = false; }
        }
        if (pointerRef.current) pointerRef.current.classList.remove('still');
      };
      const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const tick = now => {
        const p = pos.current, v = vel.current;
        const f = flight.current;
        const steps = last ? Math.max(1, Math.min(6, Math.round((now - last) / 16.667))) : 1;
        last = now;
        /* resting in the dock, out of sight: nothing to move or measure this frame */
        if (!f && !pinned.current && !rideRef.current && !outRef.current && !target.current && stepRef.current < 0) { raf = requestAnimationFrame(tick); return; }
        if (f) {
          const k = Math.min(1, (performance.now() - f.t0) / f.T), e = ease(k);
          const lift = Math.sin(Math.PI * k) * f.arc;
          p.x = f.x0 + (f.x1 - f.x0) * e; p.y = f.y0 + (f.y1 - f.y0) * e - lift;
          v.x = (f.x1 - f.x0) / f.T * 16; v.y = 0;
          if (k >= 1) {
            flight.current = null; p.x = f.x1; p.y = f.y1;
            if (f.moved) pinned.current = false;
            if (pointerRef.current) { pointerRef.current.classList.remove('flying'); pointerRef.current.classList.add('land'); setTimeout(() => pointerRef.current && pointerRef.current.classList.remove('land'), 420); }
            f.res();
          }
        } else if (!pinned.current) {
          const m = rideRef.current ? mouse.current : home();
          if (rideRef.current) {
            for (let i = 0; i < steps; i++) {
              v.x = (v.x + (m.x - p.x) * .18) * .62; v.y = (v.y + (m.y - p.y) * .18) * .62;
              p.x += v.x; p.y += v.y;
            }
          } else { p.x = m.x; p.y = m.y; v.x = 0; v.y = 0; }
        }
        const tr = trail.current;
        tr[0].x += (p.x - tr[0].x) * .28; tr[0].y += (p.y - tr[0].y) * .28;
        tr[1].x += (tr[0].x - tr[1].x) * .28; tr[1].y += (tr[0].y - tr[1].y) * .28;
        const speed = Math.abs(v.x) + Math.abs(v.y);
        trailRef.current.forEach((el, i) => { if (el) { el.style.opacity = speed > 3 ? String(.28 - i * .1) : '0'; el.style.transform = 'translate3d(' + (tr[i].x + 6) + 'px,' + (tr[i].y + 6) + 'px,0)'; } });
        const el = pointerRef.current;
        if (el) {
          if (rideRef.current && stepRef.current < 0 && still.current && Date.now() - still.current > 4000) el.classList.add('still');
          const tilt = Math.max(-16, Math.min(16, v.x * 1.3));
          const lx = Math.max(-1, Math.min(1, (mouse.current.x - p.x) / 160)), ly = Math.max(-1, Math.min(1, (mouse.current.y - p.y) / 160));
          el.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) rotate(' + tilt + 'deg)';
          el.style.setProperty('--lx', (target.current ? 0 : lx).toFixed(2));
          el.style.setProperty('--ly', (target.current ? .3 : ly).toFixed(2));
        }
        if (target.current && !target.current.isConnected) { target.current = null; setRing(null); }
        if (target.current) {
          const r = target.current.getBoundingClientRect();
          setRing(prev => (prev && Math.abs(prev.left - r.left + 6) < .5 && Math.abs(prev.top - r.top + 6) < .5 && Math.abs(prev.width - r.width - 12) < .5) ? prev
            : {left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12});
        }
        raf = requestAnimationFrame(tick);
      };
      window.addEventListener('pointermove', move, {passive: true});
      window.addEventListener('mousemove', move, {passive: true});
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('mousemove', move); };
    }, [phone, open, step]);

    /* a flight: an arc to the spot, eased, interruptible by the next flight */
    const fly = useCallback((x, y) => new Promise(res => {
      pinned.current = true;
      pinAt.current = {x: mouse.current.x - 16, y: mouse.current.y - 14};
      const el = pointerRef.current;
      if (flight.current) flight.current.res();
      if (!el || reduced()) { pos.current = {x, y}; flight.current = null; res(); return; }
      const d = Math.hypot(x - pos.current.x, y - pos.current.y);
      el.classList.add('flying');
      flight.current = {x0: pos.current.x, y0: pos.current.y, x1: x, y1: y, t0: performance.now(), T: Math.max(360, Math.min(900, 300 + d * .55)), arc: Math.min(70, d * .18), res};
    }), []);
    const goOut = on => { outRef.current = on; setOut(on); };
    /* home again: the pointer flies back into the dock, the panel unfolds */
    const flyHome = useCallback(async () => {
      clearTimeout(homeT.current);
      if (rideRef.current) { pinned.current = false; setFolded(false); return; }
      const h = home();
      await fly(h.x, h.y);
      pinned.current = false;
      goOut(false); setFolded(false);
    }, [fly]);
    const homeSoon = () => { clearTimeout(homeT.current); if (stepRef.current < 0) homeT.current = setTimeout(flyHome, 1200); };

    /* a little press on the spot it is standing on */
    const tap = useCallback(async () => {
      const el = pointerRef.current;
      if (el && !reduced()) { el.classList.add('tap'); await wait(180); el.classList.remove('tap'); }
      M.sound.play('soft');
    }, []);

    const flyTo = useCallback(async el => {
      const g = tourRun.current;
      clearTimeout(homeT.current);
      /* it leaves from wherever the dock is now */
      if (!outRef.current && !rideRef.current && !flight.current) { const h = home(); pos.current = {x: h.x, y: h.y}; }
      goOut(true);
      el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
      await wait(reduced() ? 30 : 300);
      if (g !== tourRun.current) return;
      const r = el.getBoundingClientRect();
      target.current = el;
      /* the ring over the panel: the panel folds to its head while it points */
      const panel = document.querySelector('.buddy-bubble.agent-pop');
      if (panel) {
        const b = panel.getBoundingClientRect();
        if (r.right + 6 > b.left && r.left - 6 < b.right && r.bottom + 6 > b.top && r.top - 6 < b.bottom) setFolded(true);
      }
      await fly(Math.min(window.innerWidth - 30, r.left + Math.min(r.width * .5, 60)), Math.min(window.innerHeight - 24, r.top + r.height * .6));
    }, [fly]);

    /* the ear closes: whatever was half heard is dropped, and the panel goes back to where it was */
    const stopTalk = () => {
      const h = mic.current; mic.current = null;
      if (h) { try { h.abort(); } catch (e) { /* stopped */ } }
      setLive(false); setPush(false); setFollow(false);
      if (['listening', 'hearing'].indexOf(M.assistant.st.phase) >= 0) M.assistant.set({phase: M.chat.turns.length ? 'answer' : 'idle', heard: ''});
    };

    const reset = useCallback(() => {
      tourRun.current++;
      M.assistant.stop();
      stopTalk();
      if (M.speech) M.speech.stop();
      clearTimeout(homeT.current);
      pinned.current = false; flight.current = null; target.current = null;
      setRing(null); setStep(-1); setTourText(''); setIntro(null); setFolded(false);
      if (pointerRef.current) pointerRef.current.classList.remove('flying');
      if (outRef.current && !rideRef.current) { const h = home(); pos.current = {x: h.x, y: h.y}; goOut(false); }
      if (['listening', 'hearing', 'thinking'].indexOf(M.assistant.st.phase) >= 0) M.assistant.set({phase: 'idle', heard: ''});
    }, []);

    const voiceOn = () => pref('buddyVoice', '1') !== '0';
    const speak = async t => {
      if (!voiceOn() || !M.speech) return false;
      return M.speech.say(String(t).replace(/\*\*/g, '').slice(0, 600), lang.current);
    };

    /* ---------- open and close ---------- */
    const openPanel = useCallback((text, o) => {
      o = o || {};
      if (stepRef.current >= 0) { tourRun.current++; setStep(-1); setTourText(''); target.current = null; setRing(null); }
      clearTimeout(closeT.current);
      setClosing(false); closingRef.current = false;
      if (!openRef.current) { const a = document.activeElement; opener.current = a && a !== document.body && !a.closest('.agent-panel') ? a : null; }
      setOpen(phone ? 'sheet' : 'pop');
      if (!o.keepIntro) setIntro(null);
      if (M.assistant.st.phase !== 'thinking' && M.assistant.st.phase !== 'listening' && M.assistant.st.phase !== 'hearing') M.assistant.set({phase: 'idle', err: '', chips: null});
      setInitial(text || '');
    }, [phone]);
    const closePanel = useCallback(wide => {
      if (!openRef.current || closingRef.current) return;
      stopTalk();
      if (M.speech) M.speech.stop();
      /* open wide, an answer on its way carries on in the drawer; closed, it stops */
      if (!wide) M.assistant.stop();
      clearTimeout(homeT.current);
      target.current = null; setRing(null); setFolded(false);
      if (outRef.current && !rideRef.current) flyHome();
      /* the caret goes back to the character, or to whatever opened the panel while the dock is hidden */
      const back = () => {
        const el = homeRef.current && homeRef.current.offsetParent ? homeRef.current : opener.current;
        opener.current = null;
        if (el && el.isConnected && el.focus) el.focus({preventScroll: true});
      };
      const end = () => { setOpen(false); setClosing(false); setInitial(''); setIntro(null); if (!wide) back(); };
      if (wide) { end(); return; }
      setClosing(true); closingRef.current = true;
      clearTimeout(closeT.current);
      closeT.current = setTimeout(end, reduced() ? 120 : 180);
    }, [flyHome]);
    useEffect(() => { M.assistant.opener = openPanel; M.assistant.closer = closePanel; });

    /* ---------- the tour ---------- */
    const showStep = useCallback(async (i, list) => {
      const run = ++tourRun.current;
      const all = list || stopsRef.current;
      if (!all.length) return;
      const j = Math.max(0, Math.min(all.length - 1, i));
      const s = all[j];
      if (M.speech && !(s.custom && j === 0)) M.speech.stop();
      setOpen(false); setClosing(false);
      setStep(j); setTourText(M.tour.line(s, ctx)); setRing(null); target.current = null;
      const saying = s.custom && j === 0 ? Promise.resolve(false) : speak(M.tour.line(s, ctx));
      if (s.go && location.hash.split('?')[0] !== s.go) { M.nav(s.go); await wait(520); }
      if (run !== tourRun.current) return;
      let el = s.el || firstVisible(s.sel);
      if (!el) { await wait(400); el = firstVisible(s.sel); }
      if (run !== tourRun.current) return;
      if (el) await flyTo(el);
      if (run !== tourRun.current) return;
      const said = await saying;
      if (run !== tourRun.current) return;
      /* voice on and nobody touched anything: move on by itself */
      if (said && autoRef.current) {
        await wait(900);
        if (run !== tourRun.current) return;
        if (j + 1 < all.length) showStep(j + 1, all); else finishTour('done');
      }
    }, [flyTo, ctx]);

    const finishTour = useCallback(how => {
      const custom = !!(stopsRef.current[0] && stopsRef.current[0].custom);
      if (!custom) M.tour.mark(ctx, how);
      reset();
      flyHome();
      if (!custom) M.toast(how === 'done' ? 'That is the place. Hold Ctrl and Option to ask me anything' : 'Any time: Me, Prefs, Show me around');
    }, [ctx, reset, flyHome]);

    const startTour = useCallback(() => {
      const list = M.tour.stops(ctx);
      M.tour.mark(ctx, 'asked');
      setStops(list);
      setOpen(false); setIntro(null);
      M.prefs.set('dockHidden', '');
      setTimeout(() => showStep(0, list), 60);
    }, [ctx, showStep]);
    useEffect(() => {
      window.addEventListener('m360:tour', startTour);
      return () => window.removeEventListener('m360:tour', startTour);
    }, [startTour]);

    /* once a day, the first time m360 is open: a hello with their numbers, no model call */
    useEffect(() => {
      if (!ctx.ready || !ctx.member || open || step >= 0) return undefined;
      if (pref('buddyHello', '1') === '0' || pref('buddyHelloDay', '') === U.todayStr()) return undefined;
      if (!M.tour.ready(ctx) || !M.tour.seen(ctx)) return undefined;    /* the welcome comes first, the hello from the next day */
      if (window.M360_WELCOME_OFF && pref('forceHello', '') !== '1') return undefined;
      const t = setTimeout(async () => {
        if (openRef.current || stepRef.current >= 0) return;
        M.prefs.set('buddyHelloDay', U.todayStr());
        const nm = await M.ai.names(ctx).catch(() => ({}));
        const line = M.brain ? M.brain.hello(ctx, nm) : '';
        if (!line || openRef.current) return;
        openPanel('', {keepIntro: true}); setIntro({kind: 'hello', text: line});
        if (voiceOn()) speak(line);
      }, 1500);
      return () => clearTimeout(t);
    }, [ctx.ready, ctx.member, open, step]);

    /* a new person gets offered the tour once, on their first sign in */
    useEffect(() => {
      if (!ctx.ready || !ctx.member || open || step >= 0) return undefined;
      if (!M.tour.ready(ctx) || M.tour.seen(ctx)) return undefined;
      if (window.M360_WELCOME_OFF && pref('forceWelcome', '') !== '1') return undefined;   /* the QA run asks for it per test */
      const t = setTimeout(() => {
        if (openRef.current || stepRef.current >= 0) return;
        const nm = String((ctx.member && ctx.member.name) || (ctx.me && ctx.me.name) || 'there').split(' ')[0];
        openPanel('', {keepIntro: true});
        setIntro({kind: 'welcome', text: 'Hi ' + nm + ', I am your m360 buddy. Want a two minute tour of the place? I will show you where everything lives.'});
      }, 1800);
      return () => clearTimeout(t);
    }, [ctx.ready, ctx.member, M.tour.ready(ctx), open, step]);

    /* ---------- listening ---------- */
    /* kind: 'push' (held), 'tap' (Talk, tap again to send), 'follow' (after a spoken answer), 'conv' */
    const listen = useCallback(kind => {
      if (!M.mic || !M.mic.can()) return false;
      if (M.speech) M.speech.stop();
      /* talking over an answer on its way stops it: one turn at a time */
      if (M.assistant.ctl) M.assistant.stop();
      const micAt = Date.now();
      const h = M.mic.listen({
        cap: 30000,
        silence: kind === 'conv' ? 30000 : kind === 'follow' ? 6000 : 0,
        meter: phone,
        onWords: t => { if (mic.current === h) M.assistant.set({heard: t}); },
        onHearing: () => { if (mic.current === h) M.assistant.set({phase: 'hearing'}); },
        onEnd: (text, lg) => {
          if (mic.current !== h) return;
          mic.current = null; setLive(false); setPush(false); setFollow(false);
          if (text) { lang.current = lg || 'en'; heardRef.current(text, micAt); return; }
          M.assistant.set({phase: M.chat.turns.length ? 'answer' : 'idle', heard: ''});
          if (kind === 'conv') endConv('quiet');
        },
        onFail: () => {
          mic.current = null; setLive(false); setPush(false); setFollow(false);
          M.assistant.set({phase: 'idle', heard: ''});
          if (convRef.current) endConv('mic');
          openPanel('');
          M.toast('The mic is off here. Type instead');
        }
      });
      if (!h) return false;
      mic.current = h; setLive(true); setFollow(kind === 'follow' || kind === 'conv');
      M.assistant.set({phase: 'listening', heard: '', err: '', chips: null});
      return true;
    }, [phone]);

    /* the words are in: a stop or keep phrase, a spoken yes, or a new turn */
    const heard = (text, micAt) => {
      const w = plainWords(text);
      if (convRef.current && STOP_WORDS.test(w)) { endConv('said'); M.assistant.set({phase: M.chat.turns.length ? 'answer' : 'idle', heard: ''}); speak('Okay. I stopped listening.'); return; }
      if (KEEP_WORDS.test(w)) { M.assistant.set({heard: ''}); startConv(); return; }
      if (!openRef.current || closingRef.current) openPanel('');
      M.assistant.send(ctxRef.current, text, {via: 'voice', dock: true, micAt, size: phone ? 'sheet' : 'pop', lang: lang.current});
    };
    heardRef.current = heard;

    /* ---------- conversation mode: visible, capped, and gone when you leave ---------- */
    /* the tab title loses "Listening · " whatever it says now */
    const untitle = () => { if (document.title.indexOf('Listening · ') === 0) document.title = document.title.slice('Listening · '.length); };
    const endConv = useCallback(() => {
      if (!convRef.current) return;
      convRef.current = false; setConv(false); M.assistant.set({conv: false});
      clearTimeout(convT.current.cap);
      untitle();
      if (mic.current) stopTalk();
    }, []);
    const startConv = useCallback(() => {
      if (convRef.current) return;
      if (!M.mic || !M.mic.can()) { M.toast('No microphone here. Type your question.', true); return; }
      convRef.current = true; setConv(true); M.assistant.set({conv: true});
      document.title = 'Listening · ' + document.title.replace(/^Listening · /, '');
      const mins = Number(pref('convMax', '10')) || 10;
      clearTimeout(convT.current.cap);
      convT.current.cap = setTimeout(() => endConv('cap'), Math.min(10, mins) * 60000);
      if (!openRef.current || closingRef.current) openPanel('');
      const ph = M.assistant.st.phase;
      if (!mic.current && ph !== 'thinking' && !(M.speech && M.speech.speaking())) listen('conv');
    }, [listen, openPanel]);
    useEffect(() => {
      const hidden = () => { if (convRef.current && document.visibilityState === 'hidden') endConv('hidden'); };
      const blur = () => { if (convRef.current) endConv('blur'); };
      document.addEventListener('visibilitychange', hidden);
      window.addEventListener('blur', blur);
      return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); };
    }, [endConv]);
    useEffect(() => () => { clearTimeout(convT.current.cap); untitle(); }, []);

    /* ---------- an answer: a walk, a short line out loud, and the ear again ---------- */
    useEffect(() => {
      const f = async e => {
        const d = e.detail || {};
        if (walk.current) {
          const list = walk.current; walk.current = null;
          setStops(list); setTimeout(() => showStep(0, list), 80);
          if (d.dock && voiceOn()) speak(d.text);
          return;
        }
        if (outRef.current) homeSoon();
        if (!d.dock) return;
        let line = d.confirm ? d.text : M.assistant.spoken(d.text);
        if (d.waiting && !/say yes/i.test(line)) line += ' Say yes to send.';
        const said = await speak(line);
        M.assistant.promptAt = Date.now();
        if (M.assistant.st.phase === 'thinking' || mic.current) return;
        if (convRef.current) { if (!iOS()) { await (M.speech && M.speech.done ? M.speech.done() : Promise.resolve()); if (convRef.current && !mic.current) listen('conv'); } return; }
        if (said && pref('buddyFollow', '1') !== '0' && openRef.current) { await (M.speech && M.speech.done ? M.speech.done() : Promise.resolve()); if (!mic.current) listen('follow'); }
      };
      window.addEventListener('m360:answer', f);
      return () => window.removeEventListener('m360:answer', f);
    }, [listen, showStep]);

    /* ---------- the screen tools, for the panel's loop ---------- */
    useEffect(() => {
      M.assistant.screenTools = (tctx, io) => {
        const log = io.log || (() => {});
        let screen = scan();
        const gone = () => { if (io.signal && io.signal.aborted) throw Object.assign(new Error('cancelled'), {code: 'cancelled'}); };
        const point = async (id, say) => {
          gone();
          const el = findEl(id);
          if (!el) throw new Error('no element with that id on screen now');
          await flyTo(el);
          gone();
          if (say) log(String(say).slice(0, 80));
          return el;
        };
        const pressConfirmed = () => { try { return M.agent && M.agent.conf ? M.agent.conf(tctx).pressConfirmed !== false : !(tctx.settings.agent && tctx.settings.agent.pressConfirmed === false); } catch (e) { return true; } };
        const tools = [{
          name: 'point_at',
          description: 'Fly the buddy\'s pointer out of the dock to one element on screen and ring it, with a short caption. Use it to show the person exactly where to look. Returns "pointed".',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'An element id from the SCREEN list, like e12'}, say: {type: 'string', description: 'Caption under 12 words'}}, required: ['id']},
          execute: async input => { await point(input.id, input.say); return 'pointed'; }
        }, {
          name: 'go_to',
          description: 'Open another part of m360 so you can point at or use something there. Returns the new SCREEN list.',
          inputSchema: {type: 'object', properties: {section: {type: 'string', enum: SECTIONS}}, required: ['section']},
          execute: async input => {
            const s = String(input.section || '');
            if (SECTIONS.indexOf(s) < 0) throw new Error('unknown section');
            if (!tctx.isFounder && FOUNDER_ONLY.indexOf(s) >= 0) throw new Error('that section is for the founder only');
            if (!tctx.isOwner && OWNER_ONLY.indexOf(s) >= 0) throw new Error('the books are the owner\'s alone');
            M.nav('#' + s); log('opened ' + s);
            await wait(450);
            screen = scan();
            return screen.slice(0, 9000);
          }
        }, {
          name: 'click',
          description: 'Fly to a button, tab or link and press it for the person, when they asked you to do something (open, create, start, switch). Destructive controls (delete, remove, offboard, restore, sign out, mark paid, export, issue) and the pulse are only pointed at; approve, decline, send back, withdraw, cancel and clear wait on the person\'s tap. Returns the SCREEN list after the click, so you can keep going.',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'An element id from the SCREEN list'}, say: {type: 'string', description: 'What you are doing, under 10 words'}}, required: ['id']},
          execute: async input => {
            const el = await point(input.id, input.say);
            if (risky(el)) {
              if (!destructive(el) && pressConfirmed() && M.brain && M.brain.hold) {
                const what = labelOf(el).slice(0, 40) || 'it';
                const box = el.closest('section, .card, .drawer, aside');
                const head = box ? String((box.querySelector('.card-title, h1, h2, .drawer-head h2') || {}).innerText || '').trim().slice(0, 40) : '';
                const r = M.brain.hold('Press ' + what, head ? 'In ' + head + '.' : '', () => { if (!el.isConnected) throw new Error('That control is gone from the screen'); el.click(); return {say: 'Pressed ' + what + '.'}; }, {turn: M.assistant.turn});
                log('waiting on your tap: press ' + what);
                return 'waiting: a card asks the person to confirm "' + (r && r.label) + '". Tell them it is ready for their tap.';
              }
              log('pointed, this one is for their own hand');
              return 'not pressed: that control is theirs to press. Pointed at it. Tell them to press it.';
            }
            await tap();
            el.click(); log('pressed ' + (labelOf(el).slice(0, 30) || 'it'));
            await wait(480);
            screen = scan();
            return 'pressed. SCREEN now:\n' + screen.slice(0, 9000);
          }
        }, {
          name: 'type_into',
          description: 'Fly to a field and type text into it for the person. Never presses Enter or submits. Returns "typed".',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'A field id from the SCREEN list'}, text: {type: 'string'}}, required: ['id', 'text']},
          execute: async input => {
            const el = await point(input.id, '');
            if (!el.matches('input, textarea')) throw new Error('not a text field');
            await tap();
            el.focus();
            const t = String(input.text || '').slice(0, 400);
            let cur = '';
            for (const ch of t) { cur += ch; setNative(el, cur); if (!reduced()) await wait(14); }
            log('typed into ' + ((el.getAttribute('aria-label') || el.placeholder || 'the field').slice(0, 30)));
            return 'typed';
          }
        }, {
          name: 'select_option',
          description: 'Fly to a select (drop down) and choose an option for the person, by its visible text. Returns "selected" and the SCREEN list.',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'A select id from the SCREEN list'}, option: {type: 'string', description: 'The option text, or part of it'}}, required: ['id', 'option']},
          execute: async input => {
            const el = await point(input.id, '');
            if (!el.matches('select')) throw new Error('not a select');
            const want = String(input.option || '').toLowerCase();
            const opt = Array.from(el.options).find(o => String(o.textContent).trim().toLowerCase() === want) || Array.from(el.options).find(o => String(o.textContent).toLowerCase().includes(want));
            if (!opt) throw new Error('no such option; the options are: ' + Array.from(el.options).map(o => String(o.textContent).trim()).join(', ').slice(0, 300));
            await tap();
            el.value = opt.value; el.dispatchEvent(new Event('change', {bubbles: true})); el.dispatchEvent(new Event('input', {bubbles: true}));
            log('chose ' + String(opt.textContent).trim().slice(0, 30));
            await wait(320);
            screen = scan();
            return 'selected. SCREEN now:\n' + screen.slice(0, 9000);
          }
        }, {
          name: 'press_key',
          description: 'Press Escape (close a drawer or menu) or Enter (submit the field the buddy just typed into, only when they asked to send or save). Returns the SCREEN list.',
          inputSchema: {type: 'object', properties: {key: {type: 'string', enum: ['Escape', 'Enter']}}, required: ['key']},
          execute: async input => {
            const key = String(input.key);
            const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : window;
            const ev = k => new KeyboardEvent(k, {key, code: key, bubbles: true, cancelable: true});
            el.dispatchEvent(ev('keydown')); el.dispatchEvent(ev('keyup'));
            if (key === 'Escape' && el !== window) window.dispatchEvent(ev('keydown'));
            log('pressed ' + key);
            await wait(380);
            screen = scan();
            return 'pressed. SCREEN now:\n' + screen.slice(0, 9000);
          }
        }, {
          name: 'walk_through',
          description: 'Show how to do something in steps, on screen: the pointer goes to each element in turn with your caption and the person taps Next between steps. Use it for "show me how" and multi step how-tos, after any go_to. Two to six steps, ids from the current SCREEN. Returns "walking".',
          inputSchema: {type: 'object', properties: {title: {type: 'string', description: 'Three words, like "request leave"'}, steps: {type: 'array', items: {type: 'object', properties: {id: {type: 'string'}, say: {type: 'string', description: 'One short sentence'}}, required: ['id', 'say']}}}, required: ['steps']},
          execute: async input => {
            const list = (input.steps || []).map(x => ({el: findEl(x.id), say: String(x.say || ''), title: String(input.title || 'how to').slice(0, 40), custom: true})).filter(x => x.el);
            if (!list.length) throw new Error('none of those ids are on screen');
            log('showing ' + list.length + ' steps');
            walk.current = list;
            return 'walking';
          }
        }];
        return {tools, scan: () => screen, walking: () => walk.current};
      };
    });

    /* ---------- the talk key: hold to talk, a quick tap opens the panel, Ctrl + Option + L for conversation ---------- */
    const holdRef = useRef(false);
    const keyOpened = useRef(false);
    useEffect(() => {
      if (talkKey === 'off') return undefined;
      const isKey = e => talkKey === 'ropt' ? e.code === 'AltRight' && !e.ctrlKey : e.ctrlKey && e.altKey && (e.key === 'Control' || e.key === 'Alt');
      const MODS = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'];
      /* the caret in the box, for typing (the panel opened while it listened, so it did not take it) */
      const toType = () => setTimeout(() => { const el = document.getElementById('buddy-input') || document.getElementById('orb-input'); if (el) el.focus({preventScroll: true}); }, 60);
      const down = e => {
        if (e.repeat) return;
        /* by its code: Option + L types a symbol on a Mac keyboard */
        if (e.ctrlKey && e.altKey && (e.code === 'KeyL' || String(e.key).toLowerCase() === 'l') && talkKey === 'ctrlopt') {
          if (holdRef.current) { holdRef.current = false; stopTalk(); }
          if (convRef.current) endConv('key'); else startConv();
          return;
        }
        /* another key while the talk key is held is a shortcut of its own (VoiceOver uses Ctrl + Option):
           the ear closes, and a panel the hold opened goes away again */
        if (holdRef.current && MODS.indexOf(e.key) < 0) {
          holdRef.current = false; setPush(false); stopTalk();
          if (keyOpened.current) { keyOpened.current = false; closePanel(true); }
          return;
        }
        if (!isKey(e) || holdRef.current) return;
        /* the key also interrupts: speech, listening, conversation */
        if (M.speech && M.speech.speaking()) M.speech.stop();
        if (convRef.current) { endConv('key'); return; }
        holdRef.current = true; pushAt.current = Date.now();
        if (stepRef.current >= 0) { tourRun.current++; setStep(-1); setTourText(''); target.current = null; setRing(null); }
        keyOpened.current = !openRef.current || closingRef.current;
        if (!listen('push')) { holdRef.current = false; keyOpened.current = false; openPanel(''); toType(); return; }
        setPush(true);
        if (keyOpened.current) openPanel('');
      };
      const up = e => {
        if (!holdRef.current) return;
        if (talkKey === 'ropt' ? e.code !== 'AltRight' : (e.key !== 'Control' && e.key !== 'Alt')) return;
        holdRef.current = false; keyOpened.current = false;
        setPush(false);
        /* a tap of the key with nothing said: the panel stays open for typing */
        if (Date.now() - pushAt.current < 300 && !M.assistant.st.heard) { stopTalk(); M.assistant.set({phase: 'idle', heard: ''}); toType(); return; }
        if (mic.current) mic.current.stop();
      };
      /* the window loses the keys (a switch to another app): the hold ends, and nothing half heard is sent */
      const blur = () => { if (holdRef.current) { holdRef.current = false; keyOpened.current = false; setPush(false); stopTalk(); } };
      window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
      return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
    }, [talkKey, listen, openPanel, closePanel, startConv, endConv]);

    /* Escape: stop listening first, then conversation, then the tour or the panel. The buddy's own
       press_key never closes the buddy. */
    /* it listens first (capture), so what it handles goes no further: a drawer under the panel stays open */
    useEffect(() => {
      const esc = e => {
        if (e.key !== 'Escape' || !e.isTrusted) return;
        const mine = () => { e.stopPropagation(); };
        if (mic.current) { mine(); stopTalk(); M.assistant.set({phase: M.chat.turns.length ? 'answer' : 'idle', heard: ''}); if (convRef.current) endConv('esc'); return; }
        if (M.speech && M.speech.speaking()) M.speech.stop();
        if (convRef.current) { mine(); endConv('esc'); return; }
        if (stepRef.current >= 0) { mine(); finishTour('skipped'); return; }
        if (openRef.current && !closingRef.current) {
          const a = document.activeElement;
          const inPanel = !!(a && a.closest && a.closest('.buddy-bubble, .agent-sheet'));
          if (document.querySelector('.drawer') && !inPanel) return;
          if (document.querySelector('.buddy-bubble .panel-menu, .agent-sheet .panel-menu')) return;    /* the panel's own menu closes first */
          if (intro && intro.kind === 'welcome') M.tour.mark(ctx, 'asked');
          if (inPanel) mine();
          closePanel();
        }
      };
      window.addEventListener('keydown', esc, true);
      return () => window.removeEventListener('keydown', esc, true);
    }, [finishTour, closePanel, endConv, intro, ctx]);

    /* phones: the dock steps down out of the way while the page scrolls down, and while the keyboard is up */
    useEffect(() => {
      if (!phone) { setAway(false); setKb(false); return undefined; }
      let last = window.scrollY, raf = 0;
      const check = () => {
        raf = 0;
        const y = window.scrollY, left = document.documentElement.scrollHeight - window.innerHeight - y;
        if (y < 120 || left < 160 || y < last) setAway(false);
        else if (y > last) setAway(true);
        last = y;
      };
      const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
      const vv = window.visualViewport;
      const keys = () => setKb(!!vv && vv.height < window.innerHeight - 120);
      window.addEventListener('scroll', onScroll, {passive: true});
      if (vv) vv.addEventListener('resize', keys);
      return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); if (vv) vv.removeEventListener('resize', keys); };
    }, [phone]);

    /* a test and script hook: the tour, an ask, the state */
    const phase = st.phase;
    const mode = step >= 0 ? 'tour' : intro && open && phase === 'idle' ? intro.kind
      : phase === 'listening' || phase === 'hearing' ? 'listening' : phase === 'thinking' ? 'thinking' : !open ? 'idle' : phase === 'answer' ? 'answer' : 'asking';
    useEffect(() => {
      M.buddy = {
        tour: {start: startTour, next: () => showStep(step + 1), stop: () => finishTour('skipped'), step: () => step, count: () => stops.length},
        ask: t => { openPanel(''); return M.assistant.send(ctx, t, {via: 'typed', size: phone ? 'sheet' : 'pop'}); },
        open: openPanel, close: closePanel, reset, scan,
        conv: on => on ? startConv() : endConv('api'),
        state: () => ({mode, step, stops: stops.length, ring: !!ring, talking, followUp: follow, hidden: !showDock, flying: !!flight.current, pinned: pinned.current,
          open, conv, live, push, out: outRef.current, folded, ride, sleeping: dockState === 'sleeping'}),
        pos: () => ({x: pos.current.x, y: pos.current.y})
      };
    });

    /* ---------- the character: tap opens, hold talks, a tap while it talks or listens stops it ---------- */
    const tapHome = () => {
      if (mic.current || (M.speech && M.speech.speaking())) { stopTalk(); if (M.speech) M.speech.stop(); if (convRef.current) endConv('tap'); if (['listening', 'hearing'].indexOf(M.assistant.st.phase) >= 0) M.assistant.set({phase: M.chat.turns.length ? 'answer' : 'idle', heard: ''}); return; }
      if (convRef.current) { endConv('tap'); return; }
      if (stepRef.current >= 0) { finishTour('skipped'); return; }
      if (openRef.current && !closingRef.current) { closePanel(); return; }
      if (phone) {
        /* the sheet listens at once; no mic means it opens to typing */
        M.haptic.buzz('tick');
        openPanel('');
        listen('tap');
        return;
      }
      openPanel('');
    };
    const homeDown = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      holdDone.current = false;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* mouse without capture */ }
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => {
        holdTimer.current = 0;
        if (mic.current) return;
        holdDone.current = true;
        if (!openRef.current || closingRef.current) openPanel('');
        if (listen('push')) { setPush(true); M.sound.play('start'); }
      }, 380);
    };
    const homeUp = () => {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = 0; tapHome(); return; }
      if (holdDone.current && mic.current) { setPush(false); mic.current.stop(); }
      holdDone.current = false;
    };

    const talk = {live, hearing: phase === 'hearing', can: !!(M.mic && M.mic.can()),
      start: () => { if (!listen('tap')) M.toast('No microphone here. Type your question.', true); },
      stop: () => { if (mic.current) mic.current.stop(); }};
    const dockState = phase === 'thinking' ? 'thinking' : live ? 'listening' : talking ? 'speaking'
      : (idle || offHours || focusOn) && !open && step < 0 && !hover ? 'sleeping' : 'idle';
    const botState = dockState === 'thinking' ? 'working' : dockState === 'sleeping' ? 'sleeping' : 'default';
    const paused = hiddenTab || (typing && !open) || focusOn;
    const Bot = M.fx && M.fx.Bot;
    const size = phone ? 48 : 56;
    const stopHere = stops[step];
    const coach = step >= 0 ? coachPlace(ring) : null;
    const Panel = M.parts.AgentPanel;
    const Sheet = M.parts.AgentSheet;

    /* the hello and the welcome, at the top of the panel when it opens on its own */
    const introNode = intro ? (intro.kind === 'hello' ? html`<div class="msg panel-intro">
        <div class="buddy-hello" id="buddy-hello">${intro.text}</div>
        <div class="row" style=${{marginTop: '10px', gap: '8px'}}>
          <${M.fx.Metal}><button type="button" class="btn sm" id="hello-plan" onClick=${() => { setIntro(null); M.assistant.send(ctx, 'Plan my day in three lines from my open tasks and the calendar.', {via: 'typed', size: phone ? 'sheet' : 'pop'}); }}>Plan my day</button><//>
          <button type="button" class="linky tiny" id="hello-later" onClick=${() => closePanel()}>Thanks</button>
        </div>
      </div>` : html`<div class="msg panel-intro">
        <div class="buddy-hello">${intro.text}</div>
        <div class="row" style=${{marginTop: '10px', gap: '8px'}}>
          <${M.fx.Metal}><button type="button" class="btn sm" id="tour-yes" onClick=${startTour}>Show me around</button><//>
          <button type="button" class="linky tiny" id="tour-later" onClick=${() => { M.tour.mark(ctx, 'asked'); closePanel(); }}>Later</button>
        </div>
      </div>`) : null;

    const panelProps = {initial, intro: introNode, talk, conv, onConv: () => conv ? endConv('toggle') : startConv(), onClose: () => { if (intro && intro.kind === 'welcome') M.tour.mark(ctx, 'asked'); closePanel(); },
      onHide: () => { M.prefs.set('dockHidden', U.todayStr()); setPrefsN(n => n + 1); closePanel(); M.toast('The dock is hidden for today. The talk key and the spark still open it.'); },
      botState, folded, onUnfold: () => setFolded(false), closing, onTour: startTour, iosTap: iOS(),
      title: intro && intro.kind === 'hello' ? 'Hello' : intro && intro.kind === 'welcome' ? 'Hello' : ''};
    const showPointer = ride ? !phone : (out || step >= 0);

    return html`<div class="buddy-root" data-prefs=${prefsN}>
      ${ride && !phone ? html`<div ref=${el => { trailRef.current[1] = el; }} class="buddy-trail"/><div ref=${el => { trailRef.current[0] = el; }} class="buddy-trail"/>` : null}
      <div ref=${pointerRef} class=${'buddy' + (showPointer ? '' : ' docked') + (live || follow ? ' listening' : '') + (phase === 'thinking' ? ' thinking' : '') + (talking ? ' talking' : '')} aria-hidden="true"><${Face}/></div>
      ${ring ? html`<div class="buddy-ring" style=${{left: ring.left + 'px', top: ring.top + 'px', width: ring.width + 'px', height: ring.height + 'px'}}/>` : null}
      ${open === 'sheet' && Sheet ? html`<${Sheet} ...${panelProps}/>` : null}
      ${open === 'pop' && Panel ? html`<div class=${'buddy-bubble agent-pop' + (closing ? ' closing' : '') + (folded ? ' folded' : '')} role="dialog" aria-modal="false" aria-label="Ask m360">
        <${Panel} ...${panelProps} size="pop"/>
      </div>` : null}
      ${step >= 0 ? html`<div class=${'buddy-bubble tour' + (coach ? '' : ' at-dock') + (coach && coach['--bottom'] ? ' hang-up' : '')} role="dialog" aria-modal="false" aria-label=${stopHere ? stopHere.title : 'The tour'} style=${coach || undefined}>
        <div class="row between tour-head"><span class="micro">${stopHere ? stopHere.title : 'the tour'}</span>
          <button type="button" class="iconbtn" aria-label="Close" onClick=${() => finishTour('skipped')}><${M.icons.x}/></button></div>
        <div class="tour-line">${tourText}</div>
        <div class="row between tour-foot">
          <span class="tiny ink62">${step + 1} of ${stops.length}</span>
          <span class="row nowrap" style=${{gap: '6px'}}>
            <button type="button" class="linky tiny" aria-pressed=${auto} title="Move on by itself after each line" onClick=${() => { const v = !auto; setAuto(v); M.prefs.set('buddyAuto', v ? '1' : '0'); }}>${auto ? 'Auto on' : 'Auto off'}</button>
            ${step > 0 ? html`<button type="button" class="linky tiny" onClick=${() => showStep(step - 1)}>Back</button>` : null}
            <button type="button" class="linky tiny" onClick=${() => finishTour('skipped')}>Skip</button>
            <${M.fx.Metal}><button type="button" class="btn sm" onClick=${() => step + 1 < stops.length ? showStep(step + 1) : finishTour('done')}>${step + 1 < stops.length ? 'Next' : 'Done'}</button><//>
          </span>
        </div>
      </div>` : null}
      <div id="buddy-dock" class=${'buddy-dock' + (showDock ? '' : ' is-hidden') + (phone ? ' on-phone' : '') + (away && !open ? ' away' : '') + (kb ? ' kb' : '') + (open ? ' is-open' : '')} data-state=${dockState}>
        ${conv ? html`<button type="button" class="dock-chip conv" onClick=${() => endConv('chip')}><span class="dock-dot" aria-hidden="true"/>Listening · Stop</button>`
          : push && live ? html`<span class="dock-chip" role="status"><span class="dock-dot" aria-hidden="true"/>Listening, Esc to stop</span>` : null}
        <button ref=${homeRef} type="button" class=${'buddy-home' + (phone ? ' orb-home' : '') + (live ? ' live' : '')} aria-label="Ask m360" title="Ask m360. Hold Ctrl and Option to talk"
          aria-expanded=${!!open} onPointerEnter=${() => { setHover(true); lastInput.current = Date.now(); setIdle(false); }} onPointerLeave=${() => setHover(false)} onPointerDown=${homeDown} onPointerUp=${homeUp} onPointerCancel=${() => { clearTimeout(holdTimer.current); holdTimer.current = 0; }}
          onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapHome(); } }} onContextMenu=${e => e.preventDefault()}>
          <span key=${hop} class=${'dock-char' + (hop ? ' hop' : '') + (talking ? ' bob' : '')} style=${{'--sz': size + 'px'}}>
            ${live && M.fx && M.fx.VoicePill ? html`<${M.fx.VoicePill} live=${true}><span class="dock-glow"/><//>` : null}
            ${Bot ? html`<${Bot} type="droid" size=${size} state=${botState} headphones=${live || conv} paused=${paused} jumpEvery=${dockState === 'idle' && !paused && !reduced() ? 45 : 0} interactive=${!reduced()} label="m360" className="dock-bot"/>`
              : html`<${M.Mark} width="40px"/>`}
          </span>
          <span class="dock-shadow" aria-hidden="true"/>
          ${badge > 0 ? html`<span class="dock-badge">${M.fx && M.fx.MetalBadge ? html`<${M.fx.MetalBadge}>${String(badge)}<//>` : html`<span class="pill flame">${badge}</span>`}</span>` : null}
        </button>
      </div>
    </div>`;
  }

  /* ---------- Me: "Talking to m360" ---------- */
  const onPref = (k, d) => pref(k, d) !== '0';
  function Toggle({id, label, k, d, offLabel, onLabel, extra, set}) {
    const pressed = k === 'dockShow' ? onPref(k, d) && pref('dockHidden', '') !== U.todayStr() : onPref(k, d);
    return html`<div class="row between dock-pref">
      <span>${label}</span>
      ${M.fx.has() || M.parts.BellToggle ? html`<${M.fx.Bell} id=${id} size="sm" label=${label} offLabel=${offLabel} onLabel=${onLabel} pressed=${pressed} onChange=${v => { set(k, v ? '1' : '0'); if (extra) extra(v); }}/>`
        : html`<${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${pressed ? 'on' : 'off'} ariaLabel=${label} onChange=${v => { set(k, v === 'on' ? '1' : '0'); if (extra) extra(v === 'on'); }}/>`}
    </div>`;
  }
  function DockPrefs() {
    const ctx = M.useCtx();
    const [, setN] = useState(0);
    const set = (k, v) => { M.prefs.set(k, v); setN(n => n + 1); try { window.dispatchEvent(new CustomEvent('m360:dockprefs')); } catch (e) { /* none */ } };
    if (!ctx.member) return null;
    return html`<${UI.Card} id="dock-prefs" title="Talking to m360" action=${M.fx && M.fx.Bot ? html`<${M.fx.Bot} type="droid" size=${32} label="m360, the buddy" className="ai-bot"/>` : null}>
      <div class="stack tight">
        <${Toggle} set=${set} id="dock-show" label="Show the buddy in the corner" k="dockShow" d="1" offLabel="Hidden" onLabel="Shown" extra=${v => { if (v) M.prefs.set('dockHidden', ''); }}/>
        ${coarse() && !fine() ? null : html`<${Toggle} set=${set} id="dock-ride" label="Ride next to my cursor" k="buddyRide" d="0" offLabel="Stays in the dock" onLabel="Rides along"/>`}
        <${Toggle} set=${set} id="dock-speak" label="Speak answers when I talk" k="buddyVoice" d="1" offLabel="Quiet" onLabel="Speaks"/>
        <${Toggle} set=${set} id="dock-follow" label="Keep listening a moment after an answer" k="buddyFollow" d="1" offLabel="Stops after" onLabel="Listens on"/>
        <div class="row between dock-pref"><span>Talk key</span>
          <${UI.Seg} sm=${true} ariaLabel="Talk key" value=${pref('talkKey', 'ctrlopt')} options=${[{v: 'ctrlopt', label: 'Ctrl + Option'}, {v: 'ropt', label: 'Right Option'}, {v: 'off', label: 'Off'}]} onChange=${v => set('talkKey', v)}/></div>
        <div class="row between dock-pref"><span>Conversation stops after</span>
          <${UI.Seg} sm=${true} ariaLabel="Conversation stops after" value=${pref('convMax', '10')} options=${[{v: '2', label: '2 min'}, {v: '5', label: '5 min'}, {v: '10', label: '10 min'}]} onChange=${v => set('convMax', v)}/></div>
        <p class="tiny ink62 dock-note">Hold the talk key anywhere and speak; let go to send. Ctrl + Option is also the VoiceOver key, so with a screen reader set it to Off. Conversation mode (the headphones in the panel) listens after each answer and stops when you go quiet for 30 seconds, leave the tab, or press Esc. There is no wake word and nothing listens in the background. In Chrome, speech is turned into words on Google's servers.</p>
      </div>
    <//>`;
  }
  M.meCards.push(DockPrefs);

  M.parts.Buddy = Buddy;
})();
