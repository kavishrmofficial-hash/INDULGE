/* module: the gate's motion (v36.2). The sign-in and boot screens move the way Apple's do: the m360 mark
   writes itself in from left to right, the title, the line and the form rise into focus one after another
   on a soft spring, a wrong sign-in shakes the box, and the first screen after signing in settles into
   place. Every piece is timed from one start, the moment the static boot screen began to move (its CSS
   animation), so when React swaps that screen for its own, or the boot gate for the sign-in gate, the
   motion carries on where it was and never starts over. A later change (Forgot it?, the code step) rises in fresh. Reduced motion:
   none of it, everything simply shows. The CSS half is src/css/99-gate.css. */
'use strict';
(function () {
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const EASE = 'cubic-bezier(.22,1,.36,1)';      /* the curve Apple's sheets settle on */
  /* v39: the pen. The mark is drawn the way the Subject 360 film closes: an orange line runs in waving, its tip
     becomes a pen, and m, 3, 6 and 0 are written in brush strokes behind a thin orange tracer and its nib,
     then the full stop lands. The filled mark is shown through a mask of wide strokes that follow each
     letter's centre line in writing order (viewBox 0 0 1448 422, src/mark.svg) */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LEAD = 'M -380 384 C -350 362 -320 406 -290 384 C -260 362 -230 406 -200 384 C -170 362 -140 406 -110 384 C -80 362 -50 404 -20 386 C 0 378 20 382 40 380';
  const INK = [
    'M 40 380 L 145 150 Q 205 122 252 150 L 205 372 Q 214 400 242 372 L 470 140 Q 508 138 492 190 L 405 395',
    'M 595 85 C 640 45 725 20 760 38 C 778 60 700 140 640 190 L 615 222 C 690 235 750 205 805 200 C 835 215 790 280 720 315 C 650 360 590 375 530 370',
    'M 1005 80 C 940 140 880 220 850 300 C 835 360 870 395 920 395 C 990 395 1045 340 1045 290 C 1040 250 990 240 950 255 C 920 265 890 285 870 300',
    'M 1320 60 C 1270 30 1200 70 1150 150 C 1090 250 1060 360 1110 395 C 1170 420 1250 340 1300 250 C 1350 160 1370 80 1320 55'];
  const DOT = {x: 1397, y: 366, r: 52};
  /* hold: a beat before the line runs in, so the screen has painted when the pen starts */
  const PEN = {hold: 280, lead: 420, write: 1500, lift: 70, dot: 300, fade: 320, brush: 118};
  const PEN_MS = PEN.lead + PEN.write + PEN.lift * (INK.length - 1) + PEN.dot;
  const RISE = [['h1', 520], ['p', 620], ['.g-act', 720]];
  const RISE_MS = 760;
  const FRESH_MS = 460;
  const ENTERED = 'm360.entered';
  const RISE_KF = [{opacity: 0, transform: 'translateY(12px)', filter: 'blur(8px)'}, {opacity: 1, transform: 'none', filter: 'blur(0px)'}];
  const SHAKE_KF = [{transform: 'translateX(0)'}, {transform: 'translateX(-11px)'}, {transform: 'translateX(9px)'}, {transform: 'translateX(-6px)'},
    {transform: 'translateX(4px)'}, {transform: 'translateX(-2px)'}, {transform: 'translateX(0)'}];
  const ENTER_KF = [{opacity: 0, transform: 'scale(1.012) translateY(6px)', filter: 'blur(6px)'}, {opacity: 1, transform: 'none', filter: 'blur(0px)'}];

  const clock = () => (document.timeline && document.timeline.currentTime) || performance.now();
  const seen = new WeakSet();
  let T0 = null;                       /* when the motion began, on the document timeline */
  const now = () => clock() - (T0 == null ? clock() : T0);

  /* the static boot screen moves by CSS from its first paint: its start is the start of everything */
  function begin(gate) {
    if (T0 != null) return;
    const svg = gate.querySelector('.mark svg');
    const css = svg && svg.getAnimations ? svg.getAnimations()[0] : null;
    T0 = css && css.startTime != null ? css.startTime : clock();
    /* those first elements keep their CSS motion; only what React mounts after them is joined in */
    gate.querySelectorAll('.mark svg, :scope > div > h1, :scope > div > p, :scope > div > .g-act').forEach(el => seen.add(el));
  }

  /* play on that one clock: an element that mounts late joins its motion at the right moment */
  function synced(el, kf, delay, duration, easing) {
    if (!el.animate) return;
    el.style.animation = 'none';
    const a = el.animate(kf, {delay, duration, easing: easing || EASE, fill: 'both'});
    try { a.startTime = T0; } catch (e) { /* an old engine plays it from now */ }
  }
  /* one rise per change: two passes over the same swap (React commits it in steps) never stack two */
  const lastRise = new WeakMap();
  function fresh(el, kf, duration) {
    if (!el.animate) return;
    const t = clock();
    if (t - (lastRise.get(el) || -1e9) < 200) return;
    lastRise.set(el, t);
    el.style.animation = 'none';
    /* what an earlier rise left behind is let go, and this one leaves nothing behind either */
    el.getAnimations().forEach(a => { if (a.playState === 'finished') a.cancel(); });
    el.animate(kf, {duration, easing: EASE});
  }

  /* the pen's own clock: it starts when the first mark is taken over, and a mark React mounts later (the boot
     gate swapped for the sign-in gate) picks the drawing up where it is */
  /* the pen's time only moves while frames are drawn (at most 40 ms a frame), so a page busy starting up
     pauses the writing and never skips the opening strokes */
  let P0 = null, penSeq = 0, penT = 0, penLast = 0;
  const pens = [];
  const easeInOut = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  /* colours go on style: a CSS variable does not work in an SVG presentation attribute */
  const el = (tag, attrs, parent, css) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (css) Object.assign(n.style, css); if (parent) parent.appendChild(n); return n; };
  function pen(svg) {
    const logo = svg.querySelector('path');
    if (!logo || !svg.getBoundingClientRect || !logo.getTotalLength) return false;
    const px = 1448 / Math.max(40, svg.getBoundingClientRect().width || 110);
    const id = 'm360pen' + (++penSeq);
    const defs = el('defs', {}, svg);
    const mask = el('mask', {id, maskUnits: 'userSpaceOnUse', x: -60, y: -60, width: 1568, height: 542}, defs);
    const line = {fill: 'none', 'stroke-width': (1.7 * px).toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
    const FLAME = {stroke: 'var(--flame)'}, WHITE = {stroke: 'white', fill: 'none'};
    const ink = INK.map(d => { const m = el('path', {d, 'stroke-width': PEN.brush, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}, mask, WHITE); const len = m.getTotalLength(); m.style.strokeDasharray = len; m.style.strokeDashoffset = len; return {m, len}; });
    const dot = el('circle', {cx: DOT.x, cy: DOT.y, r: 0}, mask, {fill: 'white'});
    logo.setAttribute('mask', 'url(#' + id + ')');
    const lead = el('path', {d: LEAD, ...line}, svg, FLAME);
    const leadLen = lead.getTotalLength();
    lead.style.strokeDasharray = leadLen; lead.style.strokeDashoffset = leadLen;
    const traces = INK.map(d => { const t = el('path', {d, ...line}, svg, FLAME); const len = t.getTotalLength(); t.style.strokeDasharray = len; t.style.strokeDashoffset = len; return {t, len}; });
    const nib = el('circle', {r: (2.6 * px).toFixed(1), opacity: 0}, svg, {fill: 'var(--flame)'});
    const total = ink.reduce((n, x) => n + x.len, 0);
    let at = PEN.lead;
    const spans = ink.map(x => { const d = PEN.write * x.len / total; const s = {from: at, to: at + d}; at += d + PEN.lift; return s; });
    const dotAt = at - PEN.lift;
    svg.style.animation = 'none'; svg.style.opacity = '1'; svg.style.overflow = 'visible';
    svg.classList.add('pen');
    pens.push({svg, ink, dot, lead, leadLen, traces, nib, spans, dotAt, parts: [defs, lead, nib, ...traces.map(x => x.t)], logo});
    return true;
  }
  function drawPens(ts) {
    const c = typeof ts === 'number' ? ts : clock();
    penT += Math.min(40, Math.max(0, c - (penLast || c)));
    penLast = c;
    const t = penT - PEN.hold;
    for (let i = pens.length - 1; i >= 0; i--) {
      const P = pens[i];
      if (!P.svg.isConnected) { pens.splice(i, 1); continue; }
      let head = null;
      /* the line runs in waving, then pulls back as the writing starts */
      const lp = Math.max(0, Math.min(1, t / PEN.lead));
      P.lead.style.strokeDashoffset = P.leadLen * (1 - easeInOut(lp));
      P.lead.style.opacity = t < PEN.lead ? 1 : Math.max(0, 1 - (t - PEN.lead) / 500);
      if (t > 0 && t < PEN.lead) head = P.lead.getPointAtLength(P.leadLen * easeInOut(lp));
      P.spans.forEach((sp, k) => {
        const p = Math.max(0, Math.min(1, (t - sp.from) / (sp.to - sp.from)));
        const e = easeInOut(p);
        const {m, len} = P.ink[k], tr = P.traces[k];
        /* the tracer runs a touch ahead of the ink, and fades once its letter is written */
        const te = Math.min(1, e + 0.06 * (p > 0 ? 1 : 0));
        tr.t.style.strokeDashoffset = tr.len * (1 - te);
        tr.t.style.opacity = t <= sp.to ? (p > 0 ? 1 : 0) : Math.max(0, 1 - (t - sp.to) / PEN.fade);
        m.style.strokeDashoffset = len * (1 - e);
        if (p > 0 && p < 1) head = tr.t.getPointAtLength(tr.len * te);
      });
      /* the full stop lands with a small overshoot */
      const dp = Math.max(0, Math.min(1, (t - P.dotAt) / PEN.dot));
      const pop = dp < 0.7 ? dp / 0.7 * 1.12 : 1.12 - 0.12 * (dp - 0.7) / 0.3;
      P.dot.setAttribute('r', (DOT.r * 1.25 * pop).toFixed(1));
      if (head) { P.nib.setAttribute('cx', head.x); P.nib.setAttribute('cy', head.y); P.nib.setAttribute('opacity', 1); }
      else P.nib.setAttribute('opacity', 0);
      if (t >= PEN_MS + PEN.fade) {
        /* done: the plain mark stays, the pen's parts go */
        P.logo.removeAttribute('mask');
        P.parts.forEach(n => n.remove());
        P.svg.classList.remove('pen');
        pens.splice(i, 1);
      }
    }
    if (pens.length) requestAnimationFrame(drawPens);
  }

  function settle(gate) {
    if (still()) return;
    begin(gate);
    const t = now();
    gate.querySelectorAll('.mark svg').forEach(svg => {
      if (seen.has(svg) && svg.dataset.pen) return;
      seen.add(svg);
      svg.dataset.pen = '1';
      /* the pen draws once per page load; a mark that arrives after it finished simply shows */
      const fresh = P0 == null;
      if (fresh && t > 3000) { svg.style.animation = 'none'; svg.style.opacity = '1'; return; }
      if (!fresh && penT >= PEN.hold + PEN_MS) { svg.style.animation = 'none'; svg.style.opacity = '1'; return; }
      if (fresh) { P0 = clock(); penT = 0; penLast = 0; }
      try { if (pen(svg) && pens.length === 1) requestAnimationFrame(drawPens); } catch (e) { svg.style.animation = 'none'; svg.style.opacity = '1'; }
    });
    RISE.forEach(([sel, delay]) => gate.querySelectorAll(':scope > div > ' + sel).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      if (t < delay + RISE_MS) synced(el, RISE_KF, delay, RISE_MS);
      else fresh(el, RISE_KF, FRESH_MS);
    }));
  }

  /* what the gate says and asks for: when it changes after the opening, the changed part rises in fresh */
  const sig = gate => {
    const h = gate.querySelector('h1');
    const ids = [...gate.querySelectorAll('.g-act input, .g-act textarea')].map(i => i.id || i.name || i.type).join(',');
    return {h: h ? h.textContent : '', ids};
  };
  let last = null;
  function changed(gate) {
    if (still()) return;
    const s = sig(gate);
    const prev = last;
    last = s;
    if (!prev) return;
    /* the next step (the code, Forgot it?) arrives with a tick */
    if ((s.h !== prev.h || s.ids !== prev.ids) && M.haptic) M.haptic.buzz('tick');
    if (now() < 720 + RISE_MS) return;
    if (s.h !== prev.h) { const h = gate.querySelector('h1'); if (h) fresh(h, RISE_KF, FRESH_MS); }
    if (s.ids !== prev.ids) { const b = gate.querySelector('.g-act .join-box') || gate.querySelector('.g-act'); if (b) fresh(b, RISE_KF, FRESH_MS); }
  }

  /* a wrong sign-in, a bad code, a taken email: the box shakes, the way the Mac login does */
  function shake(alert) {
    if (M.haptic) M.haptic.buzz('warn');   /* felt as well as seen, reduced motion or not */
    if (still()) return;
    const box = alert.closest('.join-box') || alert.closest('.g-act');
    if (box && box.animate) box.animate(SHAKE_KF, {duration: 440, easing: 'cubic-bezier(.36,.07,.19,.97)'});
  }

  /* the first screen after signing in settles into place */
  function remember(e) {
    const t = e.target;
    if (!t || !t.closest || !t.closest('.gate')) return;
    const go = e.type === 'click' ? t.closest('.btn') : (e.key === 'Enter' && t.matches('input') ? t : null);
    if (go) try { sessionStorage.setItem(ENTERED, String(Date.now())); } catch (err) { /* private mode: no settle */ }
  }
  document.addEventListener('click', remember, true);
  document.addEventListener('keydown', remember, true);
  let entered = 0;
  try { entered = Number(sessionStorage.getItem(ENTERED)) || 0; } catch (e) { /* keep going */ }
  function arrive(root) {
    const app = root.querySelector(':scope > .app');
    if (!app) return;
    /* the doors (03-z-doors.js): on sign in, and on opening at most once every 4 hours; the page rises in as
       the light gives way to it */
    const signedIn = !!entered && Date.now() - entered < 15000;
    if (M.doors && M.doors.should(signedIn)) {
      entered = 0;
      try { sessionStorage.removeItem(ENTERED); } catch (e) { /* keep going */ }
      M.doors.play({onReveal: () => { if (app.animate) app.animate(ENTER_KF, {duration: 680, easing: EASE}); }});
      return;
    }
    if (!entered) return;
    const fresh15 = Date.now() - entered < 15000;
    entered = 0;
    try { sessionStorage.removeItem(ENTERED); } catch (e) { /* keep going */ }
    if (fresh15 && !still() && app.animate) app.animate(ENTER_KF, {duration: 680, easing: EASE});
  }

  /* once the app itself is up, the gate is done: the watch stops, so a working day costs nothing */
  let obs = null;
  function scan() {
    const root = document.getElementById('root');
    if (!root) return;
    const gate = root.querySelector(':scope > .gate');
    if (gate) { settle(gate); changed(gate); return; }
    if (root.querySelector(':scope > .app')) { arrive(root); if (obs) { obs.disconnect(); obs = null; } }
  }

  function watch() {
    const root = document.getElementById('root');
    if (!root || typeof MutationObserver === 'undefined') return;
    scan();
    if (root.querySelector(':scope > .app')) return;
    obs = new MutationObserver(muts => {
      scan();
      if (!obs) return;
      for (const m of muts) {
        const nodes = m.type === 'characterData' ? [m.target.parentElement] : [...m.addedNodes];
        for (const n of nodes) {
          if (!n || n.nodeType !== 1) continue;
          const a = n.matches('[role="alert"]') ? n : n.querySelector && n.querySelector('[role="alert"]');
          if (a && a.closest('.gate')) shake(a);
        }
      }
    });
    obs.observe(root, {childList: true, subtree: true, characterData: true});
  }
  /* the page carries #root with the static boot screen before its scripts, so the watch starts now, before
     React's first commit replaces that screen */
  if (document.getElementById('root')) watch();
  else document.addEventListener('DOMContentLoaded', watch);

  M.gateMotion = {still, EASE};
})();
