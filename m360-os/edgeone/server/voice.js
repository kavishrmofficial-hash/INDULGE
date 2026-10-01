/* voice: how m360 speaks and listens on the site. Two engines, one key policy: a key never reaches a page.
   The voice box (m360-voice/, Chatterbox for speech and Whisper for listening, MIT licensed) when the
   founder has set it in Admin or VOICE_URL and VOICE_API_KEY are in the environment; ElevenLabs when
   only an ElevenLabs key is set. The box also listens (speech to text), ElevenLabs does not.
   x/voice {engine, url, key, voice, name, at, by}   n/tts/<hash> {audio, mime, at}  cached lines, 30 days */
const MAX_TEXT = 700;
const MAX_AUDIO = 5500000;     /* base64 characters of one recording, under the function's body cap */
const MODEL = 'eleven_turbo_v2_5';
const CACHE_MS = 30 * 86400000;
const CACHE_MAX = 400000;      /* base64 characters: longer lines are not cached */
const PREFER = ['sarah', 'rachel', 'laura', 'lily', 'alice', 'matilda', 'jessica', 'aria'];
const LANG = /^[a-z]{2}$/;

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + s.length.toString(36);
}
const b64 = buf => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const unb64 = s => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '');
const okUrl = u => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);

export function voiceActions({store, env, getJ, putJ, levelOf, LEVEL, HttpError, log}) {
  const f = (...a) => (env.fetch || fetch)(...a);
  async function conf() {
    const x = await getJ('x/voice').catch(() => null);
    if (x && x.engine === 'box' && x.url && x.key) return {engine: 'box', url: x.url, key: x.key, voice: x.voice || 'm360', name: x.voice || 'm360'};
    if (x && x.key && x.engine !== 'box') return {engine: 'eleven', key: x.key, voice: x.voice || '', name: x.name || ''};
    if (env.VOICE_URL && env.VOICE_API_KEY) return {engine: 'box', url: cleanUrl(env.VOICE_URL), key: env.VOICE_API_KEY, voice: env.VOICE_NAME || 'm360', name: env.VOICE_NAME || 'm360'};
    if (env.ELEVENLABS_API_KEY) return {engine: 'eleven', key: env.ELEVENLABS_API_KEY, voice: env.ELEVENLABS_VOICE || '', name: ''};
    return null;
  }
  const bearer = c => ({authorization: 'Bearer ' + c.key});
  /* the box's health line: a refused key is the caller's mistake (400), a silent box is 502 */
  async function health(url, key) {
    let r;
    try { r = await f(url + '/health', {headers: {authorization: 'Bearer ' + key}}); } catch (e) { throw new HttpError(502, 'unavailable', 'The voice box did not answer.'); }
    if (r.status === 401) throw new HttpError(400, 'bad_key', 'The voice box refused that key.');
    if (!r.ok) throw new HttpError(502, 'unavailable', 'The voice box did not answer.');
    const j = await r.json().catch(() => ({}));
    /* the box answers /health without a key; the key is checked on a call that needs one */
    const v = await f(url + '/v1/voices', {headers: {authorization: 'Bearer ' + key}}).catch(() => null);
    if (v && v.status === 401) throw new HttpError(400, 'bad_key', 'The voice box refused that key.');
    const voices = v && v.ok ? ((await v.json().catch(() => ({}))).voices || []) : (j.voices || []);
    return {device: j.device || '', multilingual: !!j.multilingual, voices, languages: j.languages || []};
  }
  async function listVoices(key) {
    const r = await f('https://api.elevenlabs.io/v1/voices', {headers: {'xi-api-key': key}});
    if (!r.ok) throw new HttpError(r.status === 401 ? 400 : 502, r.status === 401 ? 'bad_key' : 'unavailable', r.status === 401 ? 'That key was refused.' : 'The voice service did not answer.');
    const j = await r.json();
    return (j.voices || []).map(v => ({id: v.voice_id, name: v.name || '', labels: v.labels || {}})).filter(v => v.id);
  }
  const bestOf = list => {
    const byPref = PREFER.map(n => list.find(v => String(v.name).toLowerCase() === n)).find(Boolean);
    return byPref || list.find(v => (v.labels || {}).gender === 'female') || list[0] || null;
  };
  const admin = async v => { if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument'); };

  /* one line through the box, wav bytes; a voice the box does not know falls back to its default */
  async function boxSpeak(c, text, lang) {
    const call = voice => f(c.url + '/v1/audio/speech', {method: 'POST', headers: {...bearer(c), 'content-type': 'application/json'}, body: JSON.stringify({input: text, voice, language: lang})});
    let r = await call(c.voice);
    if (r.status === 404 && c.voice !== 'default') r = await call('default');
    if (r.status === 401) throw new HttpError(502, 'bad_key', 'The voice box refused the key.');
    if (!r.ok) throw new HttpError(502, 'unavailable', 'The voice box did not answer.');
    return b64(await r.arrayBuffer());
  }

  return {
    async voicestatus() {
      const c = await conf();
      if (!c) return {on: false, engine: '', listen: false, name: ''};
      if (c.engine === 'box') return {on: true, engine: 'box', listen: true, name: c.name};
      return {on: !!(c.key && c.voice), engine: 'eleven', listen: false, name: c.name};
    },

    /* the founder points the site at the voice box: its https address, the key it runs with, the voice name */
    async voicebox(v, body) {
      await admin(v);
      const url = cleanUrl(body.url);
      if (!url) { await store.delete('x/voice').catch(() => {}); await log(v.uid, 'voicebox', '', 'removed'); const c = await conf(); return {on: !!c, engine: c ? c.engine : ''}; }
      if (!okUrl(url)) throw new HttpError(400, 'invalid_argument', 'The box needs an https address, like https://voice.mask360.agency');
      let key = String(body.key || '').trim();
      if (!key && body.keep) { const x = await getJ('x/voice').catch(() => null); key = x && x.engine === 'box' ? x.key : (env.VOICE_API_KEY || ''); }
      if (!key || key.length < 12 || key.length > 200) throw new HttpError(400, 'invalid_argument', 'The key is the long random string the box runs with.');
      const h = await health(url, key);
      let voice = String(body.voice || '').trim().toLowerCase();
      if (voice && !/^[a-z0-9_-]{1,40}$/.test(voice)) throw new HttpError(400, 'invalid_argument', 'Voice names are lowercase letters, numbers, - or _');
      if (!voice) voice = h.voices.includes('m360') ? 'm360' : 'default';
      if (h.voices.length && !h.voices.includes(voice)) throw new HttpError(400, 'invalid_argument', 'The box has no voice called ' + voice + '. It has: ' + h.voices.join(', '));
      await putJ('x/voice', {engine: 'box', url, key, voice, name: voice, at: Date.now(), by: v.uid});
      await log(v.uid, 'voicebox', '', 'set, voice ' + voice + ', ' + (h.device || 'device unknown'));
      return {on: true, engine: 'box', voice, voices: h.voices, device: h.device, multilingual: h.multilingual, languages: h.languages};
    },

    /* the ElevenLabs path stays: the founder sets the key and, optionally, which voice */
    async voicekey(v, body) {
      await admin(v);
      let key = String(body.key || '').trim();
      if (!key && body.keep) { const c = await conf(); if (!c || c.engine !== 'eleven') throw new HttpError(404, 'voice_off', 'No key is set.'); key = c.key; }
      if (!key) { await store.delete('x/voice').catch(() => {}); await log(v.uid, 'voicekey', '', 'removed'); return {on: false}; }
      if (!/^[A-Za-z0-9_\-]{16,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an ElevenLabs key.');
      const list = await listVoices(key);
      let voice = String(body.voice || '').trim();
      let pick = list.find(x => x.id === voice) || null;
      if (!pick) pick = bestOf(list);
      if (!pick) throw new HttpError(400, 'invalid_argument', 'That account has no voices yet.');
      await putJ('x/voice', {engine: 'eleven', key, voice: pick.id, name: pick.name, at: Date.now(), by: v.uid});
      await log(v.uid, 'voicekey', '', 'set, voice ' + pick.name);
      return {on: true, voice: pick.id, name: pick.name, voices: list.map(x => ({id: x.id, name: x.name}))};
    },

    async voices(v) {
      await admin(v);
      const c = await conf();
      if (!c) return {voices: [], on: false};
      if (c.engine === 'box') { const h = await health(c.url, c.key); return {voices: h.voices.map(n => ({id: n, name: n})), voice: c.voice, name: c.name, on: true, engine: 'box', device: h.device}; }
      const list = await listVoices(c.key);
      return {voices: list.map(x => ({id: x.id, name: x.name})), voice: c.voice, name: c.name, on: !!c.voice, engine: 'eleven'};
    },

    /* one spoken line, audio in base64 (wav from the box, mp3 from ElevenLabs); anyone on the roster may ask */
    async speak(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const c = await conf();
      if (!c || !c.voice) throw new HttpError(404, 'voice_off', 'No voice is set up.');
      const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
      if (!text) throw new HttpError(400, 'invalid_argument', 'nothing to say');
      const lang = LANG.test(String(body.lang || '')) ? String(body.lang).toLowerCase() : 'en';
      const mime = c.engine === 'box' ? 'audio/wav' : 'audio/mpeg';
      const key = 'n/tts/' + c.engine.slice(0, 2) + c.voice.slice(0, 12) + '~' + hash(lang + '|' + text);
      const hit = await getJ(key).catch(() => null);
      if (hit && hit.audio && Date.now() - (hit.at || 0) < CACHE_MS) return {audio: hit.audio, mime: hit.mime || mime, lang, cached: true};
      let audio;
      if (c.engine === 'box') audio = await boxSpeak(c, text, lang);
      else {
        const r = await f('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(c.voice) + '?output_format=mp3_22050_32', {
          method: 'POST',
          headers: {'xi-api-key': c.key, 'content-type': 'application/json', accept: 'audio/mpeg'},
          body: JSON.stringify({text, model_id: MODEL, voice_settings: {stability: .38, similarity_boost: .8, style: .4, use_speaker_boost: true}})
        });
        if (!r.ok) throw new HttpError(502, r.status === 401 ? 'bad_key' : 'unavailable', 'The voice service did not answer.');
        audio = b64(await r.arrayBuffer());
      }
      if (audio.length <= CACHE_MAX) await putJ(key, {audio, mime, at: Date.now()}).catch(() => {});
      return {audio, mime, lang};
    },

    /* a recording in, the words out, with the language Whisper heard; the box only */
    async listen(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const c = await conf();
      if (!c || c.engine !== 'box') throw new HttpError(404, 'voice_off', 'No voice box is set up.');
      const audio = typeof body.audio === 'string' ? body.audio : '';
      if (!audio || audio.length > MAX_AUDIO || !/^[A-Za-z0-9+/=]+$/.test(audio)) throw new HttpError(400, 'invalid_argument', audio.length > MAX_AUDIO ? 'That recording is too long.' : 'no audio');
      const mime = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|m4a|aac|flac)/i.test(String(body.mime || '')) ? String(body.mime).split(';')[0] : 'audio/webm';
      const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : /mpeg/.test(mime) ? 'mp3' : /flac/.test(mime) ? 'flac' : 'webm';
      const form = new FormData();
      form.append('file', new Blob([unb64(audio)], {type: mime}), 'in.' + ext);
      if (LANG.test(String(body.lang || ''))) form.append('language', String(body.lang).toLowerCase());
      let r;
      try { r = await f(c.url + '/v1/audio/transcriptions', {method: 'POST', headers: bearer(c), body: form}); } catch (e) { throw new HttpError(502, 'unavailable', 'The voice box did not answer.'); }
      if (r.status === 401) throw new HttpError(502, 'bad_key', 'The voice box refused the key.');
      if (!r.ok) throw new HttpError(502, 'unavailable', 'The voice box did not answer.');
      const j = await r.json().catch(() => ({}));
      const text = String(j.text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
      const language = LANG.test(String(j.language || '')) ? String(j.language).toLowerCase() : 'en';
      return {text, language};
    }
  };
}
