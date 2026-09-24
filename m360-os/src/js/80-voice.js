/* module: voice. How m360 speaks. On EdgeOne with a voice set up in Admin, lines come back from the
   server as audio (a natural, warm voice). Everywhere else the browser's best voice is picked and the
   line is read in sentences, so it breathes. One line at a time; a new line stops the old one. */
'use strict';
(function () {
  const GOOD = ['samantha', 'karen', 'moira', 'tessa', 'fiona', 'aria', 'jenny', 'sonia', 'libby', 'neerja', 'natasha', 'google uk english female', 'google us english', 'zira', 'susan', 'ava', 'allison', 'serena', 'kate'];
  let audio = null, serverOn = null, voicesCache = null, checkedAt = 0;

  function browserVoices() {
    try { const v = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; if (v && v.length) voicesCache = v; } catch (e) { /* none */ }
    return voicesCache || [];
  }
  try { if (window.speechSynthesis) { browserVoices(); window.speechSynthesis.addEventListener('voiceschanged', browserVoices); } } catch (e) { /* none */ }

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
    try { if (audio) { audio.pause(); audio.src = ''; audio = null; } } catch (e) { /* gone */ }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* none */ }
  }

  function sayInBrowser(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    const v = pick();
    const parts = String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = .98; u.pitch = 1.04; u.volume = 1;
      if (i) u.onstart = null;
      window.speechSynthesis.speak(u);
    });
    return true;
  }

  async function sayFromServer(text) {
    if (!window.M360_STANDALONE || typeof window.M360_API !== 'function') return false;
    /* a no from the server is trusted for five minutes, then asked again (a voice may have been set up meanwhile) */
    if (serverOn === false && Date.now() - checkedAt < 300000) return false;
    try {
      const r = await window.M360_API('speak', {text});
      if (!r || !r.audio) { serverOn = false; checkedAt = Date.now(); return false; }
      serverOn = true; checkedAt = Date.now();
      const bytes = Uint8Array.from(atob(r.audio), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type: r.mime || 'audio/mpeg'}));
      stop();
      audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); };
      await audio.play();
      return true;
    } catch (e) {
      if (e && (e.code === 'voice_off' || e.status === 404)) { serverOn = false; checkedAt = Date.now(); }
      return false;
    }
  }

  const clean = t => String(t || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);

  M.speech = {
    say: async text => {
      const t = clean(text);
      if (!t) return;
      stop();
      if (await sayFromServer(t)) return;
      sayInBrowser(t);
    },
    stop,
    pick,
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
