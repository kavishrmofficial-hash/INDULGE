/* module: voice. How m360 speaks. On EdgeOne with a voice set up in Admin, lines come back from the
   server as audio (a natural, warm voice). Everywhere else the browser's best voice is picked and the
   line is read in sentences, so it breathes. One line at a time; a new line stops the old one.
   say() resolves when the line has been heard to the end (or was cut off), so the buddy can move its
   mouth while it talks and the tour can move on by itself. */
'use strict';
(function () {
  const GOOD = ['samantha', 'karen', 'moira', 'tessa', 'fiona', 'aria', 'jenny', 'sonia', 'libby', 'neerja', 'natasha', 'google uk english female', 'google us english', 'zira', 'susan', 'ava', 'allison', 'serena', 'kate'];
  let audio = null, serverOn = null, voicesCache = null, checkedAt = 0, speaking = false, seq = 0;

  function browserVoices() {
    try { const v = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; if (v && v.length) voicesCache = v; } catch (e) { /* none */ }
    return voicesCache || [];
  }
  try { if (window.speechSynthesis) { browserVoices(); window.speechSynthesis.addEventListener('voiceschanged', browserVoices); } } catch (e) { /* none */ }

  const state = on => {
    if (speaking === on) return;
    speaking = on;
    try { window.dispatchEvent(new CustomEvent('m360:speech', {detail: {on}})); } catch (e) { /* none */ }
  };

  /* the most human sounding voice this browser has */
  function pick() {
    const vs = browserVoices();
    if (!vs.length) return null;
    const score = v => {
      const n = String(v.name || '').toLowerCase(), l = String(v.lang || '').toLowerCase();
      let s = 0;
      if (/natural|neural|online|premium|enhanced/.test(n)) s += 6;
      GOOD.forEach((g, i) => { if (n.includes(g)) s += 5 - Math.min(4, i / 5); });
      if (l.startsWith('en-in')) s += 3; else if (l.startsWith('en-gb')) s += 2; else if (l.startsWith('en')) s += 1; else s -= 6;
      if (/compact|espeak|robot/.test(n)) s -= 5;
      return s;
    };
    return vs.slice().sort((a, b) => score(b) - score(a))[0];
  }

  function stop() {
    seq++;
    try { if (audio) { audio.pause(); audio.src = ''; audio = null; } } catch (e) { /* gone */ }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* none */ }
    state(false);
  }

  /* resolves when the last sentence ends; a stop() in between resolves early */
  function sayInBrowser(text, my) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    const v = pick();
    const parts = String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return Promise.resolve(false);
    return new Promise(res => {
      let left = parts.length, done = false;
      const finish = () => { if (done) return; done = true; if (seq === my) state(false); res(true); };
      const guard = setTimeout(finish, 1200 + text.length * 90);
      parts.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p);
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = .98; u.pitch = 1.04; u.volume = 1;
        if (i === 0) u.onstart = () => { if (seq === my) state(true); };
        u.onend = u.onerror = () => { if (--left <= 0) { clearTimeout(guard); finish(); } };
        window.speechSynthesis.speak(u);
      });
      state(true);
    });
  }

  async function sayFromServer(text, my) {
    if (!window.M360_STANDALONE || typeof window.M360_API !== 'function') return false;
    /* a no from the server is trusted for five minutes, then asked again (a voice may have been set up meanwhile) */
    if (serverOn === false && Date.now() - checkedAt < 300000) return false;
    try {
      const r = await window.M360_API('speak', {text});
      if (!r || !r.audio) { serverOn = false; checkedAt = Date.now(); return false; }
      serverOn = true; checkedAt = Date.now();
      if (seq !== my) return true;
      const bytes = Uint8Array.from(atob(r.audio), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type: r.mime || 'audio/mpeg'}));
      const a = new Audio(url);
      let blocked = false;
      audio = a;
      await new Promise(res => {
        a.onended = () => { URL.revokeObjectURL(url); if (audio === a) { audio = null; state(false); } res(); };
        a.onerror = () => { URL.revokeObjectURL(url); if (audio === a) { audio = null; state(false); } res(); };
        a.onpause = () => { if (audio !== a) res(); };
        state(true);
        a.play().catch(() => { state(false); blocked = true; res(); });
      });
      return !blocked;
    } catch (e) {
      if (e && (e.code === 'voice_off' || e.status === 404)) { serverOn = false; checkedAt = Date.now(); }
      return false;
    }
  }

  const clean = t => String(t || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);

  M.speech = {
    /* resolves true when something was said and finished, false when nothing could speak */
    say: async text => {
      const t = clean(text);
      if (!t) return false;
      stop();
      const my = seq;
      if (await sayFromServer(t, my)) return true;
      if (seq !== my) return false;
      return sayInBrowser(t, my);
    },
    stop,
    pick,
    speaking: () => speaking,
    voices: browserVoices,
    /* the page asks once whether the server has a voice; the answer also refreshes after Admin saves one */
    refresh: async () => {
      if (!window.M360_STANDALONE || typeof window.M360_API !== 'function') { serverOn = false; return false; }
      try { const r = await window.M360_API('voicestatus'); serverOn = !!(r && r.on); } catch (e) { serverOn = false; }
      checkedAt = Date.now();
      return serverOn;
    },
    serverOn: () => serverOn
  };
  M.speech.refresh();
})();
