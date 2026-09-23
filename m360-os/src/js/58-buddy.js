/* module: buddy. The m360 cursor buddy: a flame pointer that rides next to your cursor.
   Hold Ctrl + Option (Ctrl + Alt) and talk, or tap Ask m360 and type. Claude reads a map of
   what is on screen plus your work data, answers in a bubble (out loud when you spoke), and
   flies the pointer to the exact control you need. It can open another section to show you,
   and create or move tasks. It never clicks anything for you. */
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
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

  /* the guided tour: where things live, in order */
  const TOUR = [
    {sel: '.side-item, .tabbar .tab-item', say: 'Home is your day: check in, your focus, your numbers.'},
    {sel: '.sidebar .new-trigger, .topbar .new-trigger', say: 'New makes anything: a task, a post, kudos, a project.'},
    {sel: '.side-ask, .topbar .iconbtn[aria-label="Search"]', say: 'Search or do anything from here. Cmd K opens it too.'},
    {sel: '.bellbtn', say: 'Your inbox: assignments, kudos, mentions and decisions.'},
    {sel: '.side-tools .iconbtn[aria-label="Focus timer"], .quick-btn', say: 'Focus runs a timer on a task and banks deep work.'},
    {sel: '.side-item:nth-child(2), .tabbar .tab-item:nth-child(2)', say: 'Work: tasks, projects, the calendar and reviews.'},
    {sel: '.buddy-home', say: 'And that is me. Hold Ctrl and Option to talk, or tap here. Enjoy.'}
  ];

  const SECTIONS = ['home', 'tasks', 'projects', 'week', 'clients', 'pitches', 'feed', 'people', 'voice', 'scores', 'me', 'leave', 'handbook', 'hiring', 'hq', 'command', 'admin'];

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
      const tag = el.matches('h1, h2, .card-title') ? 'heading' : el.matches('input, textarea, select') ? 'field'
        : el.getAttribute('role') === 'tab' || el.classList.contains('tab') ? 'tab' : el.tagName === 'A' ? 'link' : 'button';
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

  /* ---------- the pointer ---------- */
  const Pointer = () => html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 3.2 19.6 10c.9.4.8 1.7-.1 2l-6.3 1.9-2.6 6.1c-.4.9-1.7.9-2-.1L3.1 4.4c-.3-.8.3-1.5.9-1.2Z" fill="#F53901" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;

  function Buddy({onOpenChat}) {
    const ctx = M.useCtx();
    const on = M.ai.on(ctx);
    const [hidden, setHidden] = useState(() => store.get('buddyHidden') === '1');
    const [mode, setMode] = useState('idle');          /* idle, asking, listening, thinking, answer */
    const [q, setQ] = useState('');
    const [heard, setHeard] = useState('');
    const [answer, setAnswer] = useState('');
    const [acts, setActs] = useState([]);
    const [err, setErr] = useState('');
    const [anchor, setAnchor] = useState(null);         /* {x, y} the bubble sits by */
    const [ring, setRing] = useState(null);             /* {left, top, width, height} */
    const [step, setStep] = useState(-1);               /* tour step, or -1 */
    const pointerRef = useRef(null);
    const mouse = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const pos = useRef({x: window.innerWidth - 90, y: window.innerHeight - 90});
    const pinned = useRef(false);
    const target = useRef(null);
    const ctl = useRef(null);
    const rec = useRef(null);
    const spoke = useRef(false);
    const homeRef = useRef(null);
    const askRef = useRef(null);

    /* follow the cursor with a little lag; stays put while pointing */
    useEffect(() => {
      if ((!on && mode !== 'tour') || hidden) return;
      let raf = 0;
      const move = e => { mouse.current = {x: e.clientX + 16, y: e.clientY + 14}; };
      const tick = () => {
        if (!pinned.current && !coarse()) {
          const p = pos.current, m = mouse.current;
          p.x += (m.x - p.x) * .22; p.y += (m.y - p.y) * .22;
        }
        if (target.current) {
          const el = target.current;
          const r = el.getBoundingClientRect();
          setRing(prev => (prev && Math.abs(prev.left - r.left) < .5 && Math.abs(prev.top - r.top) < .5) ? prev
            : {left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12});
        }
        if (pointerRef.current) pointerRef.current.style.transform = 'translate3d(' + pos.current.x + 'px,' + pos.current.y + 'px,0)';
        raf = requestAnimationFrame(tick);
      };
      window.addEventListener('pointermove', move, {passive: true});
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); };
    }, [on, hidden, mode === 'tour']);


    const fly = useCallback((x, y) => new Promise(res => {
      pinned.current = true;
      const el = pointerRef.current;
      if (!el || reduced()) { pos.current = {x, y}; res(); return; }
      el.classList.add('flying');
      pos.current = {x, y};
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      setTimeout(() => { el.classList.remove('flying'); res(); }, 660);
    }), []);

    const reset = useCallback(() => {
      if (ctl.current) ctl.current.abort();
      if (rec.current) { try { rec.current.abort(); } catch (e) { /* stopped */ } rec.current = null; }
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no voice */ }
      pinned.current = false; target.current = null;
      setRing(null); setMode('idle'); setAnswer(''); setActs([]); setErr(''); setHeard(''); setQ('');
    }, []);

    /* ---------- the tour ---------- */
    const showStep = useCallback(async i => {
      let j = i;
      let el = null;
      while (j < TOUR.length && !el) { el = Array.from(document.querySelectorAll(TOUR[j].sel)).find(x => x.getBoundingClientRect().width > 0) || null; if (!el) j++; }
      if (!el) { reset(); M.toast('That is the tour. Hold Ctrl and Option to ask me anything'); return; }
      setStep(j); setMode('tour'); setAnswer(TOUR[j].say); setErr(''); setActs([]);
      el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
      await new Promise(r => setTimeout(r, reduced() ? 30 : 260));
      const r = el.getBoundingClientRect();
      target.current = el;
      pinned.current = true;
      await fly(Math.min(window.innerWidth - 30, r.left + Math.min(r.width * .5, 60)), r.top + r.height * .6);
      setAnchor({x: pos.current.x, y: pos.current.y});
    }, [fly]);
    useEffect(() => {
      const start = () => { setHidden(false); store.set('buddyHidden', '0'); setTimeout(() => showStep(0), 60); };
      window.addEventListener('m360:tour', start);
      return () => window.removeEventListener('m360:tour', start);
    }, [showStep]);

    const speak = t => {
      if (!spoke.current || store.get('buddyVoice') === '0') return;
      try {
        const u = new SpeechSynthesisUtterance(String(t).replace(/\*\*/g, '').slice(0, 400));
        u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      } catch (e) { /* no voice here */ }
    };

    const openAt = (x, y) => {
      setAnchor({x, y}); setMode('asking'); setAnswer(''); setActs([]); setErr('');
    };

    /* ---------- ask ---------- */
    async function ask(text) {
      const question = String(text || '').trim();
      if (!question) { setMode('asking'); return; }
      setMode('thinking'); setAnswer(''); setActs([]); setErr(''); setRing(null); target.current = null;
      const c = new AbortController(); ctl.current = c;
      try {
        const nm = await M.ai.names(ctx);
        const data = ctx.isFounder ? await M.ai.teamSlice(ctx) : await M.ai.meSlice(ctx);
        const here = M.resolveRoute ? M.resolveRoute(M.parseHash().page, null, ctx.isFounder) : {s: ''};
        let screen = scan();
        const log = a => setActs(xs => [...xs, a]);
        const tools = [{
          name: 'point_at',
          description: 'Fly the cursor buddy to one element on screen and ring it, with a short caption. Use it to show the person exactly where to look or click. Returns "pointed".',
          inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'An element id from the SCREEN list, like e12'}, say: {type: 'string', description: 'Caption under 12 words'}}, required: ['id']},
          execute: async (input) => {
            const el = findEl(input.id);
            if (!el) throw new Error('no element with that id on screen now');
            el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
            await new Promise(r => setTimeout(r, reduced() ? 30 : 320));
            const r = el.getBoundingClientRect();
            target.current = el;
            await fly(Math.min(window.innerWidth - 30, r.left + Math.min(r.width * .5, 60)), r.top + r.height * .6);
            setAnchor({x: pos.current.x, y: pos.current.y});
            if (input.say) setAnswer(String(input.say));
            return 'pointed';
          }
        }, {
          name: 'go_to',
          description: 'Open another part of m360 so you can point at something there. Returns the new SCREEN list.',
          inputSchema: {type: 'object', properties: {section: {type: 'string', enum: SECTIONS}}, required: ['section']},
          execute: async (input) => {
            const s = String(input.section || '');
            if (SECTIONS.indexOf(s) < 0) throw new Error('unknown section');
            if (!ctx.isFounder && ['hq', 'command', 'admin'].indexOf(s) >= 0) throw new Error('that section is for Kaavish only');
            M.nav('#' + s);
            await new Promise(r => setTimeout(r, 450));
            screen = scan();
            return screen.slice(0, 9000);
          }
        }].concat(M.ai.tools(ctx, nm, log));
        const lim = ctx.sample.limits ? await ctx.sample.limits().catch(() => null) : null;
        const prompt = M.ai.VOICE +
          'You are the m360 cursor buddy. You live next to the person\'s mouse cursor inside the m360 OS and help them use it. ' +
          'They are ' + (nm[ctx.uid] || 'a teammate') + (ctx.isFounder ? ', the founder' : '') + '. They are on the ' + (here.s || 'home') + ' section.\n' +
          'Rules: answer in one to three short spoken sentences. When the answer lives on screen, or they ask where or how, call point_at FIRST with the best element id, ' +
          'then answer. If it lives in another section, call go_to, then point_at. Never invent ids. You never click for them. ' +
          'When they ask you to create or move a task, use those tools and confirm in one line.\n\n' +
          'SCREEN (id | kind | label | area):\n' + screen.slice(0, 9000) + '\n\nTHEIR DATA:\n' + data.slice(0, 16000) + '\n\nTHEY SAID: ' + question;
        const out = await ctx.sample(prompt, {signal: c.signal, modelTier: 'quick', tools: lim && lim.tools ? tools : undefined,
          onText: ({text: t}) => setAnswer(t.replace(/\u2014|\u2013/g, ', '))});
        const final = out.text.replace(/\u2014|\u2013/g, ', ');
        setAnswer(final); setMode('answer'); speak(final);
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
      let holding = false, finalText = '';
      const start = () => {
        holding = true; finalText = ''; spoke.current = true;
        reset();
        pinned.current = true;
        setAnchor({x: pos.current.x, y: pos.current.y});
        const S = SR();
        if (!S) { spoke.current = false; openAt(pos.current.x, pos.current.y); return; }
        try {
          const r = new S();
          r.lang = 'en-IN'; r.interimResults = true; r.continuous = true;
          r.onresult = ev => {
            let t = '';
            for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
            finalText = t; setHeard(t);
          };
          r.onerror = ev => {
            if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture')) {
              spoke.current = false; rec.current = null; openAt(pos.current.x, pos.current.y);
              M.toast('Voice is off here. Type instead');
            }
          };
          rec.current = r; r.start(); setMode('listening');
        } catch (e) { spoke.current = false; openAt(pos.current.x, pos.current.y); }
      };
      const stop = () => {
        if (!holding) return;
        holding = false;
        if (rec.current) {
          try { rec.current.stop(); } catch (e) { /* stopped */ }
          rec.current = null;
          setTimeout(() => { if (finalText.trim()) askRef.current(finalText); else setMode('asking'); }, 250);
        }
      };
      const down = e => { if (e.ctrlKey && e.altKey && !holding && !e.repeat && (e.key === 'Control' || e.key === 'Alt')) { e.preventDefault(); start(); } };
      const up = e => { if (holding && (e.key === 'Control' || e.key === 'Alt')) stop(); };
      const esc = e => { if (e.key === 'Escape') reset(); };
      window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('keydown', esc);
      return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('keydown', esc); };
    }, [on, hidden, reset]);

    if (!on && mode !== 'tour') return null;

    const tapHome = () => {
      if (mode !== 'idle') { reset(); return; }
      spoke.current = false;
      const r = homeRef.current ? homeRef.current.getBoundingClientRect() : {left: window.innerWidth - 200, top: window.innerHeight - 80};
      pinned.current = true;
      fly(r.left + 10, r.top - 10);
      openAt(r.left, r.top - 10);
    };

    /* bubble placement, kept inside the viewport */
    const bw = Math.min(340, window.innerWidth - 32);
    const ax = anchor ? anchor.x : window.innerWidth - bw - 20, ay = anchor ? anchor.y : window.innerHeight - 200;
    const left = Math.max(16, Math.min(window.innerWidth - bw - 16, ax + 22));
    const below = ay + 30;
    const top = below + 190 > window.innerHeight ? Math.max(16, ay - 200) : below;

    return html`<div>
      ${!hidden ? html`<div ref=${pointerRef} class=${'buddy' + (mode === 'listening' ? ' listening' : '')}
        style=${coarse() && mode === 'idle' ? {display: 'none'} : null}><${Pointer}/></div>` : null}
      ${ring ? html`<div class="buddy-ring" style=${{left: ring.left + 'px', top: ring.top + 'px', width: ring.width + 'px', height: ring.height + 'px'}}/>` : null}
      ${mode !== 'idle' ? html`<div class="buddy-bubble" role="dialog" aria-label="Ask m360" style=${{left: left + 'px', top: top + 'px'}}>
        <div class="row between" style=${{marginBottom: '8px'}}>
          <span class="micro">${mode === 'listening' ? 'listening, let go to send' : mode === 'thinking' ? 'thinking' : mode === 'tour' ? 'the tour' : 'ask m360'}</span>
          <button type="button" class="iconbtn" style=${{color: '#fff', width: '26px', height: '26px'}} aria-label="Close" onClick=${reset}><${M.icons.x}/></button>
        </div>
        ${mode === 'listening' ? html`<div style=${{fontWeight: 500, minHeight: '22px'}}>${heard || 'Go ahead, I\'m listening.'}</div>` : null}
        ${mode === 'asking' ? html`<div class="stack tight">
          <input id="buddy-input" class="input" value=${q} autoFocus=${true} placeholder="Where do I check in? What's overdue?"
            onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') ask(q); }} aria-label="Ask m360"/>
          <div class="row between"><span class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>Hold Ctrl + Option to talk</span>
            <button type="button" class="btn on-dark sm" disabled=${!q.trim()} onClick=${() => ask(q)}>Ask</button></div>
        </div>` : null}
        ${mode === 'thinking' && !answer ? html`<${M.Thinking} label="Looking at your screen"/>` : null}
        ${mode === 'tour' ? html`<div class="row between" style=${{marginTop: '10px'}}>
          <span class="tiny" style=${{color: 'rgba(255,255,255,.6)'}}>${step + 1} of ${TOUR.length}</span>
          <span class="row nowrap">
            <button type="button" class="linky tiny" onClick=${reset}>Skip</button>
            <button type="button" class="btn on-dark sm" onClick=${() => step + 1 < TOUR.length ? showStep(step + 1) : (reset(), M.toast('Enjoy m360'))}>${step + 1 < TOUR.length ? 'Next' : 'Done'}</button>
          </span>
        </div>` : null}
        ${answer ? html`<${M.AIText} text=${answer}/>` : null}
        ${acts.map((a, i) => html`<div key=${i} class="tiny" style=${{marginTop: '6px'}}><span class="spark">${SPARK}</span> ${a}</div>`)}
        ${err ? html`<div class="small flame-t" style=${{marginTop: '6px'}}>${err}</div>` : null}
        ${mode === 'answer' ? html`<div class="row" style=${{marginTop: '10px', gap: '14px'}}>
          <button type="button" class="linky tiny" onClick=${() => { setQ(''); setMode('asking'); }}>Ask another</button>
          <button type="button" class="linky tiny" onClick=${() => { reset(); onOpenChat && onOpenChat(); }}>Open full chat</button>
          <button type="button" class="linky tiny" onClick=${() => { store.set('buddyHidden', hidden ? '0' : '1'); setHidden(!hidden); reset(); }}>${hidden ? 'Show pointer' : 'Hide pointer'}</button>
        </div>` : null}
      </div>` : null}
      <button ref=${homeRef} type="button" class="buddy-home" onClick=${tapHome} aria-label="Ask m360">
        <span style=${{color: 'var(--flame)', fontSize: '16px'}} aria-hidden="true">${SPARK}</span> <span class="lbl">Ask m360</span> <span class="k">hold ⌃⌥</span>
      </button>
    </div>`;
  }

  M.parts.Buddy = Buddy;
})();
