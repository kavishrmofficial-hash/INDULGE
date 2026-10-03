/* module: voice. How m360 speaks and listens. On EdgeOne with a voice set up (the m360 voice box, or
   ElevenLabs), lines come back from the server as audio in the one m360 voice, in the language the
   question came in; the box also listens, so a recording goes up and the words come back with the
   language Whisper heard. Everywhere else the browser's best voice is picked and the line is read in
   sentences, so it breathes, and listening falls back to the browser's own recognition.
   One line at a time; a new line stops the old one. say() resolves when the line has been heard to the
   end (or was cut off), so the buddy can move its mouth while it talks and the tour can move on.
   endedAt() and done() tell a listener when the last line finished, so a microphone opened after it
   never hears m360's own voice. */
'use strict';
(function () {
  const GOOD = ['samantha', 'karen', 'moira', 'tessa', 'fiona', 'aria', 'jenny', 'sonia', 'libby', 'neerja', 'natasha', 'google uk english female', 'google us english', 'zira', 'susan', 'ava', 'allison', 'serena', 'kate'];
  let audio = null, serverOn = null, status = null, voicesCache = null, checkedAt = 0, speaking = false, seq = 0, said = 0, endedAt = 0;
  const waiting = new Set();

  function browserVoices() {
    try { const v = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; if (v && v.length) voicesCache = v; } catch (e) { /* none */ }
    return voicesCache || [];
  }
  try { if (window.speechSynthesis) { browserVoices(); window.speechSynthesis.addEventListener('voiceschanged', browserVoices); } } catch (e) { /* none */ }

  const state = on => {
    if (speaking === on) return;
    speaking = on;
    if (!on) { endedAt = Date.now(); waiting.forEach(f => f()); waiting.clear(); }
    try { window.dispatchEvent(new CustomEvent('m360:speech', {detail: {on, at: Date.now()}})); } catch (e) { /* none */ }
  };

  /* the most human sounding voice this browser has, in the language asked for */
  function pick(lang) {
    const vs = browserVoices();
    if (!vs.length) return null;
    const want = String(lang || 'en').toLowerCase();
    const score = v => {
      const n = String(v.name || '').toLowerCase(), l = String(v.lang || '').toLowerCase();
      let s = 0;
      if (/natural|neural|online|premium|enhanced/.test(n)) s += 6;
      if (want !== 'en') { if (l.startsWith(want)) s += 12; else s -= 12; }
      else { GOOD.forEach((g, i) => { if (n.includes(g)) s += 5 - Math.min(4, i / 5); }); if (l.startsWith('en-in')) s += 3; else if (l.startsWith('en-gb')) s += 2; else if (l.startsWith('en')) s += 1; else s -= 6; }
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
  function sayInBrowser(text, my, lang) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    const v = pick(lang);
    const parts = String(text).split(/(?<=[.!?।؟])\s+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return Promise.resolve(false);
    return new Promise(res => {
      let left = parts.length, done = false;
      const finish = () => { if (done) return; done = true; if (seq === my) state(false); res(true); };
      const guard = setTimeout(finish, 1200 + text.length * 90);
      parts.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p);
        if (v) { u.voice = v; u.lang = v.lang; }
        else if (lang && lang !== 'en') u.lang = lang;
        u.rate = .98; u.pitch = 1.04; u.volume = 1;
        if (i === 0) u.onstart = () => { if (seq === my) state(true); };
        u.onend = u.onerror = () => { if (--left <= 0) { clearTimeout(guard); finish(); } };
        window.speechSynthesis.speak(u);
      });
      state(true);
    });
  }

  const standalone = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';

  async function sayFromServer(text, my, lang) {
    if (!standalone()) return false;
    /* a no from the server is trusted for five minutes, then asked again (a voice may have been set up meanwhile) */
    if (serverOn === false && Date.now() - checkedAt < 300000) return false;
    try {
      const r = await window.M360_API('speak', {text, lang: lang || 'en'});
      if (!r || !r.audio) { serverOn = false; checkedAt = Date.now(); return false; }
      serverOn = true; checkedAt = Date.now(); said++;
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
  const toB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });

  M.speech = {
    /* resolves true when something was said and finished, false when nothing could speak; lang is a two letter code */
    say: async (text, lang) => {
      const t = clean(text);
      if (!t) return false;
      stop();
      const my = seq;
      if (await sayFromServer(t, my, lang)) return true;
      if (seq !== my) return false;
      return sayInBrowser(t, my, lang);
    },
    stop,
    pick,
    speaking: () => speaking,
    /* when the last line finished (or was cut off) */
    endedAt: () => endedAt,
    /* resolves once nothing is being said, at once when quiet */
    done: () => speaking ? new Promise(res => waiting.add(res)) : Promise.resolve(),
    voices: browserVoices,
    /* a recording to the box: {text, language}; throws when there is no box */
    listen: async (blob, lang) => {
      if (!standalone() || !(status && status.listen)) throw Object.assign(new Error('no box'), {code: 'voice_off'});
      const b64 = await toB64(blob);
      const r = await window.M360_API('listen', {audio: b64, mime: blob.type || 'audio/webm', ...(lang ? {lang} : {})});
      return {text: String((r && r.text) || ''), language: (r && r.language) || 'en'};
    },
    /* true when the server can turn a recording into words (the voice box is set up) */
    listenOn: () => !!(status && status.listen) && !!(navigator.mediaDevices && window.MediaRecorder),
    /* the page asks once whether the server has a voice; the answer also refreshes after Admin saves one */
    refresh: async () => {
      if (!standalone()) { serverOn = false; status = null; return false; }
      try { const r = await window.M360_API('voicestatus'); status = r || null; serverOn = !!(r && r.on); } catch (e) { serverOn = false; status = null; }
      checkedAt = Date.now();
      return serverOn;
    },
    serverOn: () => serverOn,
    status: () => status,
    said: () => said
  };
  M.speech.refresh();
})();
