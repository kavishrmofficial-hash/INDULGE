(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  let cur = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) cur = slides.indexOf(e.target); });
  }, { threshold: 0.55 });
  slides.forEach(s => io.observe(s));
  const go = i => slides[Math.max(0, Math.min(total - 1, i))].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

  addEventListener('keydown', e => {
    if (open) { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'PageDown' || e.key === 'PageUp') e.preventDefault(); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest && (t.closest('video, input, textarea, select, [contenteditable]') || (e.key === ' ' && t.closest('button')))) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); go(cur + 1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(total - 1); }
  });

  // reference videos: nothing loads until someone presses play. Play opens the clip large, over the deck, with the browser's own
  // controls (play, sound, volume, full screen); Esc, the close button or a click outside puts it back on its slide.
  const vids = [...document.querySelectorAll('.vbox video')];
  let lb = null, open = null;
  function close() {
    if (!open) return;
    const { v, box } = open;
    open = null;
    v.pause();
    v.controls = false;
    box.insertBefore(v, box.firstChild);
    lb.hidden = true;
    document.documentElement.classList.remove('lb-open');
    const b = box.querySelector('.vplay');
    if (b) b.focus({ preventScroll: true });
  }
  function build() {
    lb = document.createElement('div');
    lb.className = 'vlight';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Reference clip');
    lb.innerHTML = '<div class="vl-stage"></div><p class="vl-cap"></p><button class="vl-x" type="button">Close</button>';
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    lb.querySelector('.vl-x').addEventListener('click', close);
    document.body.appendChild(lb);
  }
  document.querySelectorAll('.vbox .vplay').forEach(b => {
    b.addEventListener('click', () => {
      if (!lb) build();
      if (open) close();
      const box = b.closest('.vbox');
      const v = box.querySelector('video');
      const cap = box.parentElement.querySelector('.cap');
      open = { v, box };
      lb.querySelector('.vl-stage').appendChild(v);
      lb.querySelector('.vl-cap').textContent = cap ? cap.textContent : '';
      v.controls = true;
      lb.hidden = false;
      document.documentElement.classList.add('lb-open');
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      v.focus({ preventScroll: true });
    });
  });
  vids.forEach(v => v.addEventListener('webkitendfullscreen', close));
  // the browser's seek bar keeps Esc to itself; hand focus back to the clip after a seek or a volume change
  vids.forEach(v => ['seeked', 'volumechange'].forEach(t => v.addEventListener(t, () => { if (open) v.focus({ preventScroll: true }); })));

  // cloth: each canvas is painted (fabric.js) when it comes near the screen, and again when its size changes
  const fabs = [...document.querySelectorAll('canvas[data-fab]')];
  const paint = (cv, force) => { try { Fabric.draw(cv, cv.dataset.fab, +cv.dataset.seed || 1, undefined, force); } catch (e) {} };
  const fio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) paint(e.target); }), { rootMargin: '100% 0px' });
  fabs.forEach(c => fio.observe(c));
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => fabs.forEach(c => { fio.unobserve(c); fio.observe(c); }), 150); });
  addEventListener('beforeprint', () => fabs.forEach(c => paint(c, true)));

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }
})();
