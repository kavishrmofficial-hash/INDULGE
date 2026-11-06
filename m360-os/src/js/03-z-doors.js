/* module: the doors. Signing in walks you into the OS: the room dims, a doorway draws itself in one line, two
   doors fill it with a thread of light at the seam, they swing open away from you, light spills onto the floor,
   and the view walks through into the light, which is the white of the page. "Opening the doors to
   opportunity" sits under the threshold while it happens.

   About 2.8 seconds with the mark, on one clock, transforms and opacity only. It plays on sign in, and on opening the OS at most
   once every 4 hours on a device. Reduced motion never sees it. A browser driven by a test skips it unless the
   test sets window.M360_DOORS = true (test_doors).

     M.doors.should(signedIn)   whether this arrival gets the doors
     M.doors.play({onReveal})   plays them over the page; onReveal runs as the light gives way to the page */
(function () {
  const M = window.M;
  const SAY = 'Opening the doors to opportunity';
  const KEY = 'm360.doorsAt', GAP_MS = 4 * 3600000;
  /* Apple's curves: `apple` is the sheet curve (a quick start that settles softly), `inout` draws lines,
     `push` carries the walk through the doorway, slow to start and slow to land */
  const EASE = {apple: 'cubic-bezier(.32,.72,0,1)', out: 'cubic-bezier(.22,1,.36,1)', inout: 'cubic-bezier(.65,0,.35,1)', push: 'cubic-bezier(.7,0,.3,1)'};
  const ROOM = '#0A0A0A', LIGHT = '#FFFFFF';
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  let playing = false;

  function should(signedIn) {
    if (playing || still() || window.M360_DOORS === false) return false;
    if (navigator.webdriver && !window.M360_DOORS) return false;
    if (signedIn) return true;
    let at = 0;
    try { at = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* private window: play */ }
    return Date.now() - at > GAP_MS;
  }

  function play(o) {
    o = o || {};
    playing = true;
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* private window */ }
    /* it starts from the screen that was there, so the dimming is the first thing that moves */
    let from = LIGHT;
    try { from = getComputedStyle(document.body).backgroundColor || LIGHT; } catch (e) { /* keep white */ }
    const root = document.createElement('div');
    root.id = 'doors';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="dr-stage"><div class="dr-spill"></div><div class="dr-door"><div class="dr-light"></div>' +
      '<div class="dr-leaf dr-l"></div><div class="dr-leaf dr-r"></div><div class="dr-seam"></div>' +
      '<svg class="dr-frame" viewBox="0 0 128 256"><path d="M0 256V64A64 64 0 0 1 128 64V256"/></svg></div>' +
      '<div class="dr-floor"></div><p class="dr-say"></p></div>';
    root.querySelector('.dr-say').textContent = SAY;
    root.style.backgroundColor = from;
    document.body.appendChild(root);

    const q = s => root.querySelector(s);
    const all = [];
    const A = (el, kf, delay, duration, easing) => { const a = el.animate(kf, {delay, duration, easing: easing || 'linear', fill: 'both'}); all.push(a); return a; };
    const stage = q('.dr-stage'), door = q('.dr-door'), path = q('.dr-frame path');
    const len = path.getTotalLength ? path.getTotalLength() : 520;
    path.style.strokeDasharray = String(len);

    /* the walk through: the view scales about the middle of the doorway's straight part until the light covers
       the screen with room to spare */
    const vw = innerWidth, vh = innerHeight;
    const r = door.getBoundingClientRect(), s0 = stage.getBoundingClientRect();
    const w = r.width || 128, h = r.height || 256;
    const cx = r.left + w / 2, cy = r.top + w / 2 + (h - w / 2) / 2;
    const S = 1.35 * Math.max(2 * Math.max(cx, vw - cx) / w, 2 * Math.max(cy, vh - cy) / (h - w / 2));
    stage.style.transformOrigin = (cx - s0.left) + 'px ' + (cy - s0.top) + 'px';

    A(root, [{backgroundColor: from}, {backgroundColor: ROOM}], 0, 240, EASE.apple);
    A(q('.dr-floor'), [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], 100, 420, EASE.apple);
    A(path, [{strokeDashoffset: len}, {strokeDashoffset: 0}], 200, 560, EASE.inout);
    A(q('.dr-say'), [{opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)'}, {opacity: 1, transform: 'none', filter: 'blur(0px)'}], 280, 520, EASE.apple);
    A(q('.dr-l'), [{opacity: 0}, {opacity: 1}], 560, 260, EASE.out);
    A(q('.dr-r'), [{opacity: 0}, {opacity: 1}], 560, 260, EASE.out);
    const seam = q('.dr-seam');
    A(seam, [{opacity: 0, transform: 'translateX(-50%) scaleY(.2)'}, {opacity: 1, transform: 'translateX(-50%) scaleY(1)'}], 740, 260, EASE.apple);
    A(q('.dr-light'), [{opacity: 0}, {opacity: 1}], 940, 80);
    /* the doors swing away from you, into the light */
    A(q('.dr-l'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(100deg)'}], 960, 600, EASE.apple);
    A(q('.dr-r'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-100deg)'}], 960, 600, EASE.apple);
    seam.animate([{opacity: 1}, {opacity: 0}], {delay: 990, duration: 180, fill: 'forwards'});
    /* felt too: two beats as the doors part, a tick as the mark lands in its place */
    const T = [];
    if (M.haptic) T.push(setTimeout(() => M.haptic.buzz('done'), 960));
    A(q('.dr-spill'), [{opacity: 0, transform: 'translateX(-50%) scaleY(.4)'}, {opacity: 1, transform: 'translateX(-50%) scaleY(1)'}], 1020, 480, EASE.apple);
    q('.dr-say').animate([{opacity: 1, filter: 'blur(0px)'}, {opacity: 0, filter: 'blur(6px)'}], {delay: 1120, duration: 260, fill: 'forwards'});
    A(stage, [{transform: 'scale(1)'}, {transform: 'scale(' + S.toFixed(2) + ')'}], 1180, 620, EASE.push);

    /* the mark: once the light fills the screen it rises onto the white from behind a line, holds a beat, then
       glides into its own place in the sidebar (or the phone's capsule) as the page arrives, and hands over to
       the live mark there. Black, and moved by transforms only */
    const SVG = M.chrome && M.chrome.LIVE;
    let mark = null, home = null;
    if (SVG) {
      mark = document.createElement('div');
      mark.id = 'doors-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = '<span class="dm-clip"><span class="dm-in">' + SVG + '</span></span>';
      document.body.appendChild(mark);
      A(mark.querySelector('.dm-in'), [{transform: 'translateY(108%) scale(.96)'}, {transform: 'none'}], 1620, 520, EASE.apple);
    }
    const HAND = 2240;
    const fade = A(root, [{opacity: 1}, {opacity: 0}], HAND, 420, EASE.out);
    const timers = T;
    timers.push(setTimeout(() => { if (o.onReveal) try { o.onReveal(); } catch (e) { /* page motion is extra */ } }, HAND));
    let flight = null;
    if (mark) timers.push(setTimeout(() => {
      const spots = ['#lmS .lmk', '#lmP .lmk'].map(sel => document.querySelector(sel)).filter(el => el && el.getClientRects().length && el.getBoundingClientRect().width > 0);
      const t = spots[0];
      const m = mark.querySelector('.lmk');
      if (!t || !m) { flight = A(mark, [{transform: 'none'}, {transform: 'translateY(-12px)', opacity: 0}], 0, 320, EASE.apple); return; }
      home = t.closest('.lm') || t;
      home.style.visibility = 'hidden';
      mark.querySelector('.dm-clip').style.overflow = 'visible';
      /* the mark's svg lands on the live mark's: with the origin at the box's corner, a point p inside moves to
         box + d + k p, so d = target - box - k (svg - box) */
      const a = m.getBoundingClientRect(), z = t.getBoundingClientRect(), b0 = mark.getBoundingClientRect();
      const k = z.width / a.width;
      const dx = z.left - b0.left - k * (a.left - b0.left), dy = z.top - b0.top - k * (a.top - b0.top);
      flight = mark.animate([{transform: 'none'}, {transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')'}],
        {duration: 560, easing: EASE.apple, fill: 'forwards'});
      if (M.haptic) flight.finished.then(() => M.haptic.buzz('tick')).catch(() => { /* cut short */ });
      all.push(flight);
    }, HAND));

    return new Promise(done => {
      let over = false;
      const end = () => {
        if (over) return;
        over = true;
        timers.forEach(clearTimeout);
        if (home) home.style.visibility = '';
        all.forEach(a => { try { a.cancel(); } catch (e) { /* gone */ } });
        root.remove(); if (mark) mark.remove();
        playing = false; done();
      };
      /* it ends when the light has gone and the mark has landed */
      const landed = () => (!flight || flight.playState === 'finished') && fade.playState === 'finished';
      const tick = () => { if (over) return; if (landed()) end(); else setTimeout(tick, 40); };
      timers.push(setTimeout(tick, HAND + 420));
      /* a hidden tab may never finish the animation: the page is never kept behind it */
      setTimeout(end, 6000);
    });
  }

  M.doors = {should, play, SAY};
})();
