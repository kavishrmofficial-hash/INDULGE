(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  let cur = 0;
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) cur = slides.indexOf(e.target); });
  }, { threshold: 0.55 });
  slides.forEach(s => io.observe(s));
  // the next slide is taken from cur, which go() sets at once, so two quick presses move two slides; focus follows, so Tab starts there.
  // Every move lands at once, page to page, with nothing animated.
  const go = i => { const j = Math.max(0, Math.min(total - 1, i)); cur = j; slides[j].scrollIntoView({ behavior: 'instant', block: 'start' }); slides[j].focus({ preventScroll: true }); };
  // phones and portrait windows read the slides as one scrolling document (deck.css), where the browser's own keys scroll
  const doc = matchMedia('(max-width:760px),(max-aspect-ratio:4/5)');
  // switching between the slide and phone layouts keeps the reader on the page they were reading
  let topIdx = 0;
  addEventListener('scroll', () => { const k = slides.findIndex(s => s.getBoundingClientRect().bottom > innerHeight * 0.4); if (k >= 0) topIdx = k; }, { passive: true });
  doc.addEventListener('change', () => requestAnimationFrame(() => slides[topIdx].scrollIntoView({ block: 'start', behavior: 'instant' })));

  addEventListener('keydown', e => {
    if (open) {  // the deck stays put under an open clip; the video keeps its own keys
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (!(e.target.closest && e.target.closest('video')) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault();
      return;
    }
    if (doc.matches || e.altKey || e.ctrlKey || e.metaKey) return;
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
    const { v, box, y } = open;
    open = null;
    v.pause();
    v.controls = false;
    box.insertBefore(v, box.firstChild);
    lb.hidden = true;
    document.documentElement.classList.remove('lb-open');
    document.querySelector('main').inert = false;
    scrollTo({ top: y, behavior: 'instant' });
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
    lb.innerHTML = '<div class="vl-stage"></div><p class="vl-cap"></p><button class="vl-x" type="button"><span>Close</span><i aria-hidden="true">×</i></button>';
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
      open = { v, box, y: scrollY };
      const stage = lb.querySelector('.vl-stage');
      stage.style.setProperty('--ar', box.style.getPropertyValue('--ar') || '9/16');
      stage.appendChild(v);
      lb.querySelector('.vl-cap').textContent = v.getAttribute('aria-label') || '';
      v.controls = true;
      lb.hidden = false;
      document.documentElement.classList.add('lb-open');
      document.querySelector('main').inert = true;  // keeps Tab inside the clip while it is open
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      v.focus({ preventScroll: true });
    });
  });
  vids.forEach(v => v.addEventListener('webkitendfullscreen', close));
  // the browser's seek bar keeps Esc to itself; hand focus back to the clip after a seek or a volume change
  vids.forEach(v => ['seeked', 'volumechange'].forEach(t => v.addEventListener(t, () => { if (open) v.focus({ preventScroll: true }); })));

  // the cover's clock: Kolkata time, the way Hanza shows its local time
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const tickClock = () => { clock.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 15000);
  }

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
})();
