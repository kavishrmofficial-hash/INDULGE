/* module: buddy. The m360 cursor buddy: a small flame character with a face that rides next to your
   cursor. Hold Ctrl + Option (Ctrl + Alt) and talk, hold the Ask m360 button on a phone, or tap it and
   type. Claude reads a map of what is on screen plus your work data, answers in a bubble (out loud when
   you spoke), flies the pointer to the exact control, and, when you ask it to, clicks or types for you.
   It never presses anything risky (delete, offboard, restore, sign out): those it points at.
   It also gives the onboarding tour (57-tour.js): spoken, pointed, section by section. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useRef, useCallback} = React;

  const SPARK = '✦';
  const store = {
    get: k => { try { return localStorage.getItem('m360.' + k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem('m360.' + k, v); } catch (e) { /* private window */ } }
  };
  const coarse = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const fine = () => { try { return window.matchMedia('(pointer: fine)').matches; } catch (e) { return true; } };
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const SECTIONS = ['home', 'tasks', 'projects', 'calendar', 'reviews', 'week', 'clients', 'pitches', 'feed', 'people', 'voice', 'scores',
    'base', 'companies', 'import', 'radar', 'awards', 'watch', 'me', 'trophies', 'leave', 'handbook', 'hiring', 'hq', 'command', 'admin'];
  const FOUNDER_ONLY = ['hq', 'command', 'admin'];
  /* controls the buddy will point at but never press */
  const RISKY = /delete|remove|erase|wipe|trash|offboard|lock|unlock|restore|overwrite|revoke|sign out|log out|approve|reject|decline|pay|revert/i;

  /* ---------- the screen, as Claude sees it ---------- */
  function scan() {
    const sel = 'button, a[href], input, select, textarea, [role="tab"], h1, h2, .card-title, .stat, .tcard';
    const W = window.innerWidth, H = window.innerHeight;
    const out = [];
    let n = 0;
    document.querySelectorAll('[data-ai]').forEach(el => el.removeAttribute('data-ai'));
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('.buddy-bubble, .buddy-home, .tabbar')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H * 2.2 || r.right < 0 || r.left > W) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      let label = el.getAttribute('aria-label') || (el.innerText || '').replace(/\s+/g, ' ').trim() || el.getAttribute('placeholder') || el.value || '';
      label = String(label).slice(0, 70);
      if (!label) continue;
      const tag = el.matches('h1, h2, .card-title') ? 'heading' : el.matches('select') ? 'select' : el.matches('input, textarea') ? 'field'
        : el.getAttribute('role') === 'tab' || el.classList.contains('tab') ? 'tab' : el.tagName === 'A' ? 'link' : 'button';
      /* what state it is in, so answers can read the screen instead of guessing */
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
  const risky = el => {
    if (!el) return true;
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
    return RISKY.test(t) || /danger|armed/.test(el.className || '') || (el.closest('form') && el.type === 'submit');
  };
  /* React controlled inputs listen to the native setter, so type through it */
  function setNative(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }

  /* ---------- the character ---------- */
  const Face = () => html`<svg viewBox="0 0 28 28" aria-hidden="true">
    <path class="body" d="M5 3.6 23.2 11.5c1 .45.9 1.9-.15 2.25l-7.3 2.2-3 7.1c-.45 1.05-1.95 1-2.3-.1L3.9 5c-.3-.95.35-1.75 1.1-1.4Z"/>
    <g class="eyes">
      <circle class="eye" cx="10.2" cy="9.4" r="2.1"/><circle class="eye" cx="15.2" cy="11.6" r="2.1"/>
      <circle class="pupil" cx="10.4" cy="9.5" r="1"/><circle class="pupil" cx="15.4" cy="11.7" r="1"/>
    </g>
    <path class="mouth" d="M11 15.2c1 .9 2.3 1 3.4.3"/>
  </svg>`;

  function Buddy({onOpenChat}) {
    const ctx = M.useCtx();
    const on = M.ai.on(ctx);
    const [hidden, setHidden] = useState(() => store.get('buddyHidden') === '1');
    const [mode, setMode] = useState('idle');          /* idle, asking, listening, thinking, answer, tour, welcome */
    const [q, setQ] = useState('');
    const [heard, setHeard] = useState('');
    const [answer, setAnswer] = useState('');
    const [acts, setActs] = useState([]);
    const [err, setErr] = useState('');
    const [anchor, setAnchor] = useState(null);         /* {x, y} the bubble sits by */
    const [ring, setRing] = useState(null);             /* {left, top, width, height} */
    const [step, setStep] = useState(-1);               /* tour step, or -1 */
    const [stops, setStops] = useState([]);
    const [auto, setAuto] = useState(() => store.get('buddyAuto') !== '0');
    const [talking, setTalking] = useState(false);
    const [followUp, setFollowUp] = useState(false);
    const pointerRef = useRef(null);
    const trailRef = useRef([]);
    const mouse = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const pos = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const vel = useRef({x: 0, y: 0});
    const trail = useRef([{x: 0, y: 0}, {x: 0, y: 0}]);
    const pinned = useRef(false);        /* only while flying, and until the mouse moves again afterwards */
    const flight = useRef(null);         /* {x0, y0, x1, y1, t0, T, res} while flying */
    const pinAt = useRef(null);
    const still = useRef(0);
    const target = useRef(null);
    const ctl = useRef(null);
    const rec = useRef(null);
    const spoke = useRef(false);
    const homeRef = useRef(null);
    const askRef = useRef(null);
    const history = useRef([]);
    const modeRef = useRef('idle');
    const tourRun = useRef(0);
    const holdTimer = useRef(0);
    const walk = useRef(null);
    modeRef.current = mode;

    /* the mouth moves while a line is being said */
    useEffect(() => {
      const f = e => setTalking(!!(e.detail && e.detail.on));
      window.addEventListener('m360:speech', f);
      return () => window.removeEventListener('m360:speech', f);
    }, []);

    /* follow the cursor on a spring. While the buddy flies to a control it holds still, and it lets go
       the moment the mouse moves again, so it never gets stuck after an answer or a tour step. */
    useEffect(() => {
      if ((!on && mode !== 'tour' && mode !== 'welcome') || hidden) return;
      let raf = 0;
      const move = e => {
        if (e.pointerType === 'touch') return;
        mouse.current = {x: e.clientX + 16, y: e.clientY + 14};
        still.current = Date.now();
        if (pinned.current) {
          const a = pinAt.current;
          if (!a || Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y) > 28) { if (flight.current) flight.current.moved = true; else pinned.current = false; }
        }
        if (pointerRef.current) pointerRef.current.classList.remove('still');
      };
      const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const tick = () => {
        const p = pos.current, v = vel.current;
        const f = flight.current;
        if (f) {
          const k = Math.min(1, (performance.now() - f.t0) / f.T), e = ease(k);
          const lift = Math.sin(Math.PI * k) * f.arc;
          p.x = f.x0 + (f.x1 - f.x0) * e; p.y = f.y0 + (f.y1 - f.y0) * e - lift;
          v.x = (f.x1 - f.x0) / f.T * 16; v.y = 0;
          if (k >= 1) { flight.current = null; p.x = f.x1; p.y = f.y1; if (f.moved) pinned.current = false; if (pointerRef.current) { pointerRef.current.classList.remove('flying'); pointerRef.current.classList.add('land'); setTimeout(() => pointerRef.current && pointerRef.current.classList.remove('land'), 420); } f.res(); }
        } else if (!pinned.current) {
          const m = mouse.current;
          v.x = (v.x + (m.x - p.x) * .18) * .62; v.y = (v.y + (m.y - p.y) * .18) * .62;
          p.x += v.x; p.y += v.y;
        }
        /* the ghosts behind it, a beat later each */
        const tr = trail.current;
        tr[0].x += (p.x - tr[0].x) * .28; tr[0].y += (p.y - tr[0].y) * .28;
        tr[1].x += (tr[0].x - tr[1].x) * .28; tr[1].y += (tr[0].y - tr[1].y) * .28;
        const speed = Math.abs(v.x) + Math.abs(v.y);
        trailRef.current.forEach((el, i) => { if (el) { el.style.opacity = speed > 3 ? String(.28 - i * .1) : '0'; el.style.transform = 'translate3d(' + (tr[i].x + 6) + 'px,' + (tr[i].y + 6) + 'px,0)'; } });
        const el = pointerRef.current;
        if (el) {
          if (modeRef.current === 'idle' && still.current && Date.now() - still.current > 4000) el.classList.add('still');
          /* lean into the move, look where it is going */
          const tilt = Math.max(-16, Math.min(16, v.x * 1.3));
          const lx = Math.max(-1, Math.min(1, (mouse.current.x - p.x) / 160)), ly = Math.max(-1, Math.min(1, (mouse.current.y - p.y) / 160));
          el.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) rotate(' + tilt + 'deg)';
          el.style.setProperty('--lx', (target.current ? 0 : lx).toFixed(2));
          el.style.setProperty('--ly', (target.current ? .3 : ly).toFixed(2));
        }
        if (target.current) {
          const r = target.current.getBoundingClientRect();
          setRing(prev => (prev && Math.abs(prev.left - r.left) < .5 && Math.abs(prev.top - r.top) < .5) ? prev
            : {left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12});
        }
        raf = requestAnimationFrame(tick);
      };
      window.addEventListener('pointermove', move, {passive: true});
      window.addEventListener('mousemove', move, {passive: true});
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('mousemove', move); };
    }, [on, hidden, mode]);

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

    /* a little press on the spot it is standing on */
    const tap = useCallback(async () => {
      const el = pointerRef.current;
      if (el && !reduced()) { el.classList.add('tap'); await wait(180); el.classList.remove('tap'); }
      M.sound.play('soft');
    }, []);

    const flyTo = useCallback(async el => {
      const g = tourRun.current;
      el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
      await wait(reduced() ? 30 : 300);
      if (g !== tourRun.current) return;   /* closed meanwhile */
      const r = el.getBoundingClientRect();
      target.current = el;
      await fly(Math.min(window.innerWidth - 30, r.left + Math.min(r.width * .5, 60)), Math.min(window.innerHeight - 24, r.top + r.height * .6));
      setAnchor({x: pos.current.x, y: pos.current.y});
    }, [fly]);

    const stopListening = () => { if (rec.current) { try { rec.current.abort(); } catch (e) { /* stopped */ } rec.current = null; } };

    const reset = useCallback(() => {
      tourRun.current++;
      if (ctl.current) ctl.current.abort();
      stopListening();
      if (M.speech) M.speech.stop();
      pinned.current = false; flight.current = null; target.current = null;
      setRing(null); setMode('idle'); setAnswer(''); setActs([]); setErr(''); setHeard(''); setQ(''); setStep(-1); setFollowUp(false);
      if (pointerRef.current) pointerRef.current.classList.remove('flying');
    }, []);

    const voiceOn = () => store.get('buddyVoice') !== '0';
    const speak = async t => {
      if (!voiceOn() || !M.speech) return false;
      return M.speech.say(String(t).replace(/\*\*/g, '').slice(0, 600));
    };

    /* ---------- the tour ---------- */
    const showStep = useCallback(async (i, list) => {
      const run = ++tourRun.current;
      const all = list || stops;
      if (!all.length) return;
      let j = Math.max(0, Math.min(all.length - 1, i));
      const s = all[j];
      if (M.speech) M.speech.stop();
      setStep(j); setMode('tour'); setAnswer(M.tour.line(s, ctx)); setErr(''); setActs([]); setRing(null); target.current = null;
      const saying = s.custom && j === 0 ? Promise.resolve(false) : speak(M.tour.line(s, ctx));
      if (s.go && location.hash.split('?')[0] !== s.go) { M.nav(s.go); await wait(520); }
      if (run !== tourRun.current) return;
      let el = s.el || firstVisible(s.sel);
      if (!el) { await wait(400); el = firstVisible(s.sel); }
      if (run !== tourRun.current) return;
      if (el) await flyTo(el);
      else setAnchor({x: pos.current.x, y: pos.current.y});
      if (run !== tourRun.current) return;
      const said = await saying;
      if (run !== tourRun.current) return;
      /* voice on and nobody touched anything: move on by itself */
      if (said && auto) {
        await wait(900);
        if (run !== tourRun.current) return;
        if (j + 1 < all.length) showStep(j + 1, all); else finishTour('done');
      }
    }, [stops, auto, flyTo, ctx]);

    const finishTour = useCallback(how => {
      const custom = !!(stops[0] && stops[0].custom);
      if (!custom) M.tour.mark(ctx, how);
      reset();
      if (!custom) M.toast(how === 'done' ? 'That is the place. Hold Ctrl and Option to ask me anything' : 'Any time: Me, Prefs, Show me around');
    }, [ctx, reset, stops]);

    const startTour = useCallback(() => {
      const list = M.tour.stops(ctx);
      setStops(list); setHidden(false); store.set('buddyHidden', '0');
      history.current = [];
      setTimeout(() => showStep(0, list), 60);
    }, [ctx, showStep]);
    useEffect(() => {
      window.addEventListener('m360:tour', startTour);
      return () => window.removeEventListener('m360:tour', startTour);
    }, [startTour]);

    /* a new person gets offered the tour once, on their first sign in */
    useEffect(() => {
      if (!ctx.ready || !ctx.member || hidden || mode !== 'idle') return;
      if (!M.tour.ready(ctx) || M.tour.seen(ctx)) return;
      if (window.M360_WELCOME_OFF && store.get('forceWelcome') !== '1') return;   /* the QA run asks for it per test */
      const t = setTimeout(() => {
        if (modeRef.current !== 'idle') return;
        const r = homeRef.current ? homeRef.current.getBoundingClientRect() : {left: window.innerWidth - 200, top: window.innerHeight - 80};
        setAnchor({x: r.left, y: r.top - 10}); setMode('welcome');
        const nm = String((ctx.member && ctx.member.name) || (ctx.me && ctx.me.name) || 'there').split(' ')[0];
        setAnswer('Hi ' + nm + ', I am your m360 buddy. Want a two minute tour of the place? I will show you where everything lives.');
      }, 1800);
      return () => clearTimeout(t);
    }, [ctx.ready, ctx.member, M.tour.ready(ctx), hidden, mode]);

    const openAt = (x, y) => {
      setAnchor({x, y}); setMode('asking'); setAnswer(''); setActs([]); setErr(''); setFollowUp(false);
    };

    /* ---------- listening: hold to talk, and the follow up after an answer ---------- */
    const listen = useCallback(({follow}) => {
      const S = SR();
      if (!S) return false;
      stopListening();
      let finalText = '', timer = 0;
      const arm = ms => { clearTimeout(timer); timer = setTimeout(() => { if (rec.current === r) { try { r.stop(); } catch (e) { /* stopped */ } } }, ms); };
      const r = new S();
      r.lang = 'en-IN'; r.interimResults = true; r.continuous = true;
      r.onresult = ev => {
        let t = '';
        for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        finalText = t; setHeard(t);
        if (M.speech && M.speech.speaking()) M.speech.stop();   /* they cut in: let them */
        if (follow) arm(1800);
      };
      r.onerror = ev => {
        if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture')) {
          spoke.current = false; rec.current = null; openAt(pos.current.x, pos.current.y);
          M.toast('Voice is off here. Type instead');
        }
      };
      r.onend = () => {
        clearTimeout(timer);
        if (rec.current !== r) return;
        rec.current = null;
        if (finalText.trim()) { spoke.current = true; askRef.current(finalText); }
        else if (follow) { setFollowUp(false); setHeard(''); }
        else setMode('asking');
      };
      try { rec.current = r; r.start(); } catch (e) { rec.current = null; return false; }
      if (follow) { setFollowUp(true); arm(6000); } else { setMode('listening'); setHeard(''); }
      return true;
    }, []);

    /* ---------- ask ---------- */
    async function ask(text) {
      const question = String(text || '').trim();
      if (!question) { setMode('asking'); return; }
      stopListening();
      if (M.speech) M.speech.stop();
      setMode('thinking'); setAnswer(''); setActs([]); setErr(''); setRing(null); setFollowUp(false); target.current = null;
      const c = new AbortController(); ctl.current = c;
      try {
        const nm = await M.ai.names(ctx);
        const data = ctx.isFounder ? await M.ai.teamSlice(ctx) : await M.ai.meSlice(ctx);
        const here = M.resolveRoute ? M.resolveRoute(M.parseHash().page, null, ctx.isFounder) : {s: ''};
        let screen = scan();
        const log = a => setActs(xs => [...xs, a]);
        const point = async (id, say) => {
          const el = findEl(id);
          if (!el) throw new Error('no element with that id on screen now');
          await flyTo(el);
          if (say) setAnswer(String(say));
          return el;
        };
        const tools = [{
          name: 'point_at',
          description: 'Fly the cursor buddy to one element on screen and ring it, with a short caption. Use it to show the person exactly where to look. Returns "pointed".',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'An element id from the SCREEN list, like e12'}, say: {type: 'string', description: 'Caption under 12 words'}}, required: ['id']},
          execute: async input => { await point(input.id, input.say); return 'pointed'; }
        }, {
          name: 'go_to',
          description: 'Open another part of m360 so you can point at or use something there. Returns the new SCREEN list.',
          inputSchema: {type: 'object', properties: {section: {type: 'string', enum: SECTIONS}}, required: ['section']},
          execute: async input => {
            const s = String(input.section || '');
            if (SECTIONS.indexOf(s) < 0) throw new Error('unknown section');
            if (!ctx.isFounder && FOUNDER_ONLY.indexOf(s) >= 0) throw new Error('that section is for Kaavish only');
            M.nav('#' + s); log('opened ' + s);
            await wait(450);
            screen = scan();
            return screen.slice(0, 9000);
          }
        }, {
          name: 'click',
          description: 'Fly to a button, tab or link and press it for the person, when they asked you to do something (open, create, start, switch). Risky controls (delete, remove, offboard, restore, approve, sign out) are only pointed at, never pressed. Returns the SCREEN list after the click, so you can keep going.',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'An element id from the SCREEN list'}, say: {type: 'string', description: 'What you are doing, under 10 words'}}, required: ['id']},
          execute: async input => {
            const el = await point(input.id, input.say);
            if (risky(el)) { log('pointed, this one is for their own hand'); return 'not pressed: that control is theirs to press. Pointed at it. Tell them to press it.'; }
            await tap();
            el.click(); log('pressed ' + ((el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30) || 'it'));
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
            if (key === 'Escape') window.dispatchEvent(ev('keydown'));
            log('pressed ' + key);
            await wait(380);
            screen = scan();
            return 'pressed. SCREEN now:\n' + screen.slice(0, 9000);
          }
        }, {
          name: 'walk_through',
          description: 'Show how to do something in steps, on screen: the buddy points at each element in turn with your caption and the person taps Next between steps. Use it for "show me how" and multi step how-tos, after any go_to. Two to six steps, ids from the current SCREEN. Returns "walking".',
          inputSchema: {type: 'object', properties: {title: {type: 'string', description: 'Three words, like "request leave"'}, steps: {type: 'array', items: {type: 'object', properties: {id: {type: 'string'}, say: {type: 'string', description: 'One short sentence'}}, required: ['id', 'say']}}}, required: ['steps']},
          execute: async input => {
            const list = (input.steps || []).map(x => ({el: findEl(x.id), say: String(x.say || ''), title: String(input.title || 'how to').slice(0, 40), custom: true})).filter(x => x.el);
            if (!list.length) throw new Error('none of those ids are on screen');
            log('showing ' + list.length + ' steps');
            walk.current = list;
            return 'walking';
          }
        }];
        const aiTools = M.ai.tools(ctx, nm, log);
        /* what they want decides which tools ride along first and how hard the model thinks */
        const doing = /\b(open|create|start|switch|fill|type|make|add|move|do it|set|choose|pick|show me how|how do i|walk me|take me|go to)\b/i.test(question);
        const looking = /\b(who|how many|what is|what's|whats|overdue|pipeline|know at|find|search|slipping|late|points|score|balance|client|contact|company)\b/i.test(question);
        const ordered = (doing || !looking) ? tools.concat(aiTools) : aiTools.concat(tools);
        const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
        const past = history.current.slice(-6).map(h => (h.role === 'user' ? 'They: ' : 'You: ') + h.content).join('\n');
        const prompt = M.ai.VOICE +
          'You are the m360 cursor buddy. You live next to the person\'s mouse cursor inside the m360 OS and help them use it. ' +
          'They are ' + (nm[ctx.uid] || 'a teammate') + (ctx.isFounder ? ', the founder' : '') + '. They are on the ' + (here.s || 'home') + ' section.\n' +
          'Rules: answer the way a sharp, warm colleague would say it out loud: one to three short sentences, contractions, plain words, a little warmth, no lists, no headings, no markdown. ' +
          'When the answer lives on screen, or they ask where or how, call point_at FIRST with the best element id, then answer. If it lives in another section, call go_to, then point_at. ' +
          'When they ask you to do something (open, create, start, switch, fill, choose), do it: click, type_into, select_option and press_key, step by step, reading the SCREEN each tool returns, then tell them in one line what you did. ' +
          'When they ask how to do something with more than one step, go_to the right section if needed, then call walk_through with the steps, then answer in one line. ' +
          'Read the [state] tags on screen (selected, value, checked, on) before answering about what is set. ' +
          'Never press a risky control; point at it and say so. Never invent ids. ' +
          'When they ask you to create or move a task, use those tools and confirm in one line.\n\n' +
          (past ? 'EARLIER IN THIS CHAT:\n' + past + '\n\n' : '') +
          'SCREEN (id | kind | label | area):\n' + screen.slice(0, 9000) + '\n\nTHEIR DATA:\n' + data.slice(0, 16000) + '\n\nTHEY SAID: ' + question;
        const out = await ctx.sample(prompt, {signal: c.signal, modelTier: doing ? 'default' : 'quick', tools: lim && lim.tools ? ordered.slice(0, (lim.tools.maxCount && lim.tools.maxCount > 0) ? lim.tools.maxCount : ordered.length) : undefined,
          onText: ({text: t}) => setAnswer(t.replace(/\u2014|\u2013/g, ', '))});
        const final = out.text.replace(/\u2014|\u2013/g, ', ');
        history.current.push({role: 'user', content: question}, {role: 'assistant', content: final.slice(0, 300)});
        if (walk.current) {
          /* a how-to: the answer becomes a short pointed walk, one step per Next */
          const list = walk.current; walk.current = null;
          setStops(list); setTimeout(() => showStep(0, list), 80);
          if (spoke.current && voiceOn()) speak(final);
          return;
        }
        setAnswer(final); setMode('answer');
        if (spoke.current && voiceOn()) {
          const said = await speak(final);
          /* they spoke to it, so it keeps an ear open for a follow up */
          if (said && modeRef.current === 'answer' && store.get('buddyFollow') !== '0') listen({follow: true});
        }
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code === 'cancelled') return;
        setErr(M.ai.errCopy(code)); setMode('answer');
      }
    }
    askRef.current = ask;

    /* ---------- voice: hold Ctrl + Option (Ctrl + Alt) ---------- */
    useEffect(() => {
      if (!on || hidden) return;
      let holding = false;
      const start = () => {
        holding = true; spoke.current = true;
        reset();
        setAnchor({x: pos.current.x, y: pos.current.y});
        if (!listen({follow: false})) { spoke.current = false; openAt(pos.current.x, pos.current.y); }
      };
      const stop = () => {
        if (!holding) return;
        holding = false;
        if (rec.current) { try { rec.current.stop(); } catch (e) { /* stopped */ } }
      };
      const down = e => { if (e.ctrlKey && e.altKey && !holding && !e.repeat && (e.key === 'Control' || e.key === 'Alt')) { e.preventDefault(); start(); } };
      const up = e => { if (holding && (e.key === 'Control' || e.key === 'Alt')) stop(); };
      const esc = e => { if (e.key === 'Escape') reset(); };
      window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('keydown', esc);
      return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('keydown', esc); };
    }, [on, hidden, reset, listen]);

    /* a test and script hook: M.buddy.run('click', {id}) etc, and the tour */
    useEffect(() => {
      M.buddy = {
        tour: {start: startTour, next: () => showStep(step + 1), stop: () => finishTour('skipped'), step: () => step, count: () => stops.length},
        ask: t => askRef.current(t),
        reset,
        scan,
        state: () => ({mode, step, stops: stops.length, ring: !!ring, talking, followUp, hidden, flying: !!flight.current, pinned: pinned.current}),
        pos: () => ({x: pos.current.x, y: pos.current.y})
      };
    });

    if (!on && mode !== 'tour' && mode !== 'welcome') return null;

    /* the button: tap to type; hold (phones, or anyone) to talk */
    const homeDown = e => {
      if (mode !== 'idle') return;
      holdTimer.current = setTimeout(() => {
        holdTimer.current = 0;
        spoke.current = true;
        const r = homeRef.current ? homeRef.current.getBoundingClientRect() : {left: window.innerWidth - 200, top: window.innerHeight - 80};
        setAnchor({x: r.left, y: r.top - 10});
        if (!listen({follow: false})) { spoke.current = false; openAt(r.left, r.top - 10); }
        M.sound.play('start');
      }, 380);
    };
    const homeUp = () => {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = 0; tapHome(); return; }
      if (rec.current && mode === 'listening') { try { rec.current.stop(); } catch (e) { /* stopped */ } }
    };
    const tapHome = () => {
      if (mode !== 'idle') { reset(); return; }
      spoke.current = false;
      const r = homeRef.current ? homeRef.current.getBoundingClientRect() : {left: window.innerWidth - 200, top: window.innerHeight - 80};
      openAt(r.left, r.top - 10);
    };

    /* bubble placement, kept inside the viewport */
    const bw = Math.min(340, window.innerWidth - 32);
    const ax = anchor ? anchor.x : window.innerWidth - bw - 20, ay = anchor ? anchor.y : window.innerHeight - 200;
    const left = Math.max(16, Math.min(window.innerWidth - bw - 16, ax + 22));
    const below = ay + 30;
    const top = below + 190 > window.innerHeight ? Math.max(16, ay - 200) : below;
    const showPointer = !hidden && !(coarse() && !fine() && mode === 'idle');
    const cls = 'buddy' + (mode === 'listening' || followUp ? ' listening' : '') + (mode === 'thinking' ? ' thinking' : '') + (talking ? ' talking' : '');
    const stopHere = stops[step];

    return html`<div>
      ${showPointer ? html`<div ref=${el => { trailRef.current[1] = el; }} class="buddy-trail"/><div ref=${el => { trailRef.current[0] = el; }} class="buddy-trail"/>` : null}
      ${showPointer ? html`<div ref=${pointerRef} class=${cls}><${Face}/></div>` : null}
      ${ring ? html`<div class="buddy-ring" style=${{left: ring.left + 'px', top: ring.top + 'px', width: ring.width + 'px', height: ring.height + 'px'}}/>` : null}
      ${mode !== 'idle' ? html`<div class=${'buddy-bubble' + (mode === 'tour' ? ' tour' : '')} role="dialog" aria-label="Ask m360" style=${{left: left + 'px', top: top + 'px'}}>
        <div class="row between" style=${{marginBottom: '8px'}}>
          <span class="micro">${mode === 'listening' ? 'listening, let go to send' : mode === 'thinking' ? 'thinking' : mode === 'tour' ? (stopHere ? stopHere.title : 'the tour') : mode === 'welcome' ? 'hello' : followUp ? 'listening for a follow up' : 'ask m360'}</span>
          <button type="button" class="iconbtn" style=${{color: '#fff', width: '26px', height: '26px'}} aria-label="Close" onClick=${mode === 'tour' ? () => finishTour('skipped') : mode === 'welcome' ? () => { M.tour.mark(ctx, 'asked'); reset(); } : reset}><${M.icons.x}/></button>
        </div>
        ${mode === 'listening' ? html`<div style=${{fontWeight: 500, minHeight: '22px'}}>${heard || 'Go ahead, I\'m listening.'}</div>` : null}
        ${mode === 'asking' ? html`<div class="stack tight">
          <input id="buddy-input" class="input" value=${q} autoFocus=${true} placeholder="Where do I check in? Open a new task for me."
            onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') ask(q); }} aria-label="Ask m360"/>
          <div class="row between"><span class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>${coarse() && !fine() ? 'Hold the button to talk' : 'Hold Ctrl + Option to talk'}</span>
            <span class="row nowrap">
              ${M.parts.MicButton ? html`<${M.parts.MicButton} sm=${true} label="Talk" onText=${t => { spoke.current = true; ask(t); }}/>` : null}
              <button type="button" class="btn on-dark sm" disabled=${!q.trim()} onClick=${() => ask(q)}>Ask</button>
            </span></div>
          <div class="row" style=${{gap: '6px', flexWrap: 'wrap'}}>
            ${['Where do I check in?', 'Open a new task for me', 'Show me how to request leave', ctx.isFounder ? 'Who is slipping this week?' : 'What is overdue on me?'].map(t => html`<button key=${t} type="button" class="pill ghost-dark" onClick=${() => { spoke.current = false; ask(t); }}>${t}</button>`)}
          </div>
          <button type="button" class="linky tiny" style=${{alignSelf: 'flex-start'}} onClick=${startTour}>Show me around</button>
        </div>` : null}
        ${mode === 'thinking' && !answer ? html`<${M.Thinking} label="Looking at your screen"/>` : null}
        ${answer && mode !== 'listening' ? html`<${M.AIText} text=${answer}/>` : null}
        ${mode === 'tour' ? html`<div class="row between" style=${{marginTop: '10px'}}>
          <span class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>${step + 1} of ${stops.length}</span>
          <span class="row nowrap" style=${{gap: '6px'}}>
            <button type="button" class="linky tiny" aria-pressed=${auto} title="Move on by itself after each line" onClick=${() => { const v = !auto; setAuto(v); store.set('buddyAuto', v ? '1' : '0'); }}>${auto ? 'Auto on' : 'Auto off'}</button>
            ${step > 0 ? html`<button type="button" class="linky tiny" onClick=${() => showStep(step - 1)}>Back</button>` : null}
            <button type="button" class="linky tiny" onClick=${() => finishTour('skipped')}>Skip</button>
            <button type="button" class="btn on-dark sm" onClick=${() => step + 1 < stops.length ? showStep(step + 1) : finishTour('done')}>${step + 1 < stops.length ? 'Next' : 'Done'}</button>
          </span>
        </div>` : null}
        ${mode === 'welcome' ? html`<div class="row" style=${{marginTop: '10px', gap: '8px'}}>
          <button type="button" class="btn on-dark sm" id="tour-yes" onClick=${startTour}>Show me around</button>
          <button type="button" class="linky tiny" id="tour-later" onClick=${() => { M.tour.mark(ctx, 'asked'); reset(); }}>Later</button>
        </div>` : null}
        ${acts.map((a, i) => html`<div key=${i} class="tiny" style=${{marginTop: '6px'}}><span class="spark">${SPARK}</span> ${a}</div>`)}
        ${err ? html`<div class="small flame-t" style=${{marginTop: '6px'}}>${err}</div>` : null}
        ${followUp ? html`<div class="tiny" style=${{marginTop: '6px', color: 'rgba(255,255,255,.7)'}}>${heard || 'Say more, or say nothing.'}</div>` : null}
        ${mode === 'answer' ? html`<div class="row" style=${{marginTop: '10px', gap: '14px'}}>
          <button type="button" class="linky tiny" onClick=${() => { stopListening(); setFollowUp(false); setQ(''); setMode('asking'); }}>Ask another</button>
          <button type="button" class="linky tiny" onClick=${() => { reset(); onOpenChat && onOpenChat(); }}>Open full chat</button>
          <button type="button" class="linky tiny" onClick=${() => { store.set('buddyHidden', hidden ? '0' : '1'); setHidden(!hidden); reset(); }}>${hidden ? 'Show pointer' : 'Hide pointer'}</button>
        </div>` : null}
      </div>` : null}
      <button ref=${homeRef} type="button" class=${'buddy-home' + (mode === 'listening' ? ' live' : '')} aria-label="Ask m360"
        onPointerDown=${homeDown} onPointerUp=${homeUp} onPointerCancel=${() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = 0; } }}
        onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapHome(); } }} onContextMenu=${e => e.preventDefault()}>
        <span style=${{color: 'var(--flame)', fontSize: '16px'}} aria-hidden="true">${SPARK}</span> <span class="lbl">Ask m360</span> <span class="k">${coarse() && !fine() ? 'hold to talk' : 'hold ⌃⌥'}</span>
      </button>
    </div>`;
  }

  M.parts.Buddy = Buddy;
})();
