/* voice: the buddy's spoken lines through ElevenLabs, when the founder has set a voice up in Admin
   (or ELEVENLABS_API_KEY in the environment, with ELEVENLABS_VOICE, ELEVENLABS_MODEL and ELEVENLABS_FORMAT
   as optional overrides). The key never reaches a page.
   x/voice {key, voice, name, at, by}
   n/tts/<voice>~<hash> {at, parts, bytes}   one cached line, 30 days: a small record that points at
   n/tta/<voice>~<hash>~<n>                  its mp3 as base64 text, in parts of up to 1 MiB
   n/ttsweep {at}                            when the cache last swept itself */
const MAX_TEXT = 700;
/* the defaults are ElevenLabs' own quickstart: George, a warm and clear narration voice every account has;
   the multilingual model, the highest quality one, which says Hindi and 28 other languages as written;
   and mp3 at 44.1 kHz, 128 kbps, the best mp3 the free tier serves */
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_FORMAT = 'mp3_44100_128';
const CACHE_MS = 30 * 86400000;
const SWEEP_MS = 86400000;
const SWEEP_MAX = 200;               /* records looked at per sweep, so a sweep never holds a request long */
const PART_MAX = 1024 * 1024;        /* base64 bytes per stored part */
const PREFER = ['sarah', 'rachel', 'laura', 'lily', 'alice', 'matilda', 'jessica', 'aria'];
/* the page plays what comes back as an mp3 blob, so only an mp3 format is honoured */
const MP3_FORMAT = /^mp3_(22050|24000|44100)_(32|64|96|128|192)$/;

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

export function voiceActions({store, env, getJ, putJ, listAll, levelOf, LEVEL, HttpError, log}) {
  const f = (...a) => (env.fetch || fetch)(...a);
  const MODEL = String(env.ELEVENLABS_MODEL || '').trim() || DEFAULT_MODEL;
  const FORMAT = MP3_FORMAT.test(String(env.ELEVENLABS_FORMAT || '').trim()) ? String(env.ELEVENLABS_FORMAT).trim() : DEFAULT_FORMAT;
  const info = () => ({model: MODEL, format: FORMAT});

  async function conf() {
    const x = await getJ('x/voice').catch(() => null);
    if (x && x.key) return {key: x.key, voice: x.voice || DEFAULT_VOICE, name: x.name || ''};
    if (env.ELEVENLABS_API_KEY) {
      const voice = String(env.ELEVENLABS_VOICE || '').trim();
      return {key: env.ELEVENLABS_API_KEY, voice: voice || DEFAULT_VOICE, name: voice ? '' : 'George'};
    }
    return null;
  }
  async function listVoices(key) {
    const r = await f('https://api.elevenlabs.io/v1/voices', {headers: {'xi-api-key': key}});
    /* a refused key is the caller's mistake, never a sign-in problem: 400, so the page does not sign anyone out */
    if (!r.ok) throw new HttpError(r.status === 401 ? 400 : 502, r.status === 401 ? 'bad_key' : 'unavailable', r.status === 401 ? 'That key was refused.' : 'The voice service did not answer.');
    const j = await r.json();
    return (j.voices || []).map(v => ({id: v.voice_id, name: v.name || '', labels: v.labels || {}})).filter(v => v.id);
  }
  /* George when the account lists him, then the warm voices by name, then any female voice, then the first */
  const bestOf = list => list.find(v => v.id === DEFAULT_VOICE)
    || PREFER.map(n => list.find(v => String(v.name).toLowerCase() === n)).find(Boolean)
    || list.find(v => (v.labels || {}).gender === 'female') || list[0] || null;

  /* ---------- the cache: a record per line, its audio in parts ---------- */
  const partKey = (key, n) => 'n/tta/' + key.slice('n/tts/'.length) + '~' + n;
  const partsOf = rec => Math.max(0, Math.min(64, Math.floor(Number((rec && rec.parts) || 0))));
  async function drop(key, rec) {
    for (let n = 0; n < partsOf(rec); n++) await store.delete(partKey(key, n)).catch(() => {});
    await store.delete(key).catch(() => {});
  }
  /* the parts go in first and the record last, so a record never points at a part that is missing;
     parts an earlier copy of the line had beyond these are removed */
  async function keep(key, audio, was) {
    const parts = [];
    for (let i = 0; i < audio.length; i += PART_MAX) parts.push(audio.slice(i, i + PART_MAX));
    for (let n = 0; n < parts.length; n++) await store.set(partKey(key, n), parts[n]);
    await putJ(key, {at: Date.now(), parts: parts.length, bytes: audio.length});
    for (let n = parts.length; n < partsOf(was); n++) await store.delete(partKey(key, n)).catch(() => {});
  }
  /* {audio, rec}: the line when it is cached and whole, and the record either way */
  async function recall(key) {
    const rec = await getJ(key).catch(() => null);
    if (!rec || !partsOf(rec) || Date.now() - (rec.at || 0) >= CACHE_MS) return {audio: null, rec};
    let audio = '';
    for (let n = 0; n < partsOf(rec); n++) {
      const s = await store.get(partKey(key, n), {type: 'text', consistency: 'strong'}).catch(() => null);
      if (s == null) return {audio: null, rec};
      audio += s;
    }
    return {audio: audio || null, rec};
  }
  /* once a day: lines nobody has asked for in 30 days go, and so do lines kept the old way (the audio inside
     the record), which today's cache key never reaches */
  async function sweep() {
    const mark = await getJ('n/ttsweep').catch(() => null);
    if (mark && Date.now() - (mark.at || 0) < SWEEP_MS) return;
    await putJ('n/ttsweep', {at: Date.now()});
    const blobs = ((await listAll('n/tts/').catch(() => [])) || []).slice(0, SWEEP_MAX);
    for (const b of blobs) {
      const rec = await getJ(b.key).catch(() => null);
      if (!rec || rec.audio || !partsOf(rec) || Date.now() - (rec.at || 0) >= CACHE_MS) await drop(b.key, rec);
    }
  }

  return {
    async voicestatus() { const c = await conf(); return {on: !!(c && c.key && c.voice), name: c ? c.name : '', ...info()}; },

    /* the founder sets the key and, optionally, which voice; with no voice named the best default is picked */
    async voicekey(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      let key = String(body.key || '').trim();
      /* changing only the voice keeps the stored key */
      if (!key && body.keep) { const c = await conf(); if (!c) throw new HttpError(404, 'voice_off', 'No key is set.'); key = c.key; }
      if (!key) { await store.delete('x/voice').catch(() => {}); await log(v.uid, 'voicekey', '', 'removed'); return {on: false, ...info()}; }
      if (!/^[A-Za-z0-9_\-]{16,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an ElevenLabs key.');
      const list = await listVoices(key);
      let voice = String(body.voice || '').trim();
      let pick = list.find(x => x.id === voice) || null;
      if (!pick) pick = bestOf(list);
      /* an account that lists no voices of its own still has George, the library voice every key can use */
      if (!pick) pick = {id: DEFAULT_VOICE, name: 'George'};
      await putJ('x/voice', {key, voice: pick.id, name: pick.name, at: Date.now(), by: v.uid});
      await log(v.uid, 'voicekey', '', 'set, voice ' + pick.name);
      return {on: true, voice: pick.id, name: pick.name, voices: list.map(x => ({id: x.id, name: x.name})), ...info()};
    },

    async voices(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const c = await conf();
      if (!c) return {voices: [], on: false, ...info()};
      const list = await listVoices(c.key);
      return {voices: list.map(x => ({id: x.id, name: x.name})), voice: c.voice, name: c.name, on: !!c.voice, ...info()};
    },

    /* one spoken line, as mp3 in base64; anyone on the roster may ask */
    async speak(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const c = await conf();
      if (!c || !c.voice) throw new HttpError(404, 'voice_off', 'No voice is set up.');
      const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
      if (!text) throw new HttpError(400, 'invalid_argument', 'nothing to say');
      /* the key names the voice, the model and the format, so a change to any of them is heard at once */
      const key = 'n/tts/' + c.voice.slice(0, 12) + '~' + hash(MODEL + '|' + FORMAT + '|' + text);
      const {audio: hit, rec: was} = await recall(key);
      if (hit) return {audio: hit, mime: 'audio/mpeg', cached: true};
      const r = await f('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(c.voice) + '?output_format=' + FORMAT, {
        method: 'POST',
        headers: {'xi-api-key': c.key, 'content-type': 'application/json', accept: 'audio/mpeg'},
        body: JSON.stringify({text, model_id: MODEL, voice_settings: {stability: .38, similarity_boost: .8, style: .4, use_speaker_boost: true}})
      });
      if (!r.ok) throw new HttpError(502, r.status === 401 ? 'bad_key' : 'unavailable', 'The voice service did not answer.');
      const audio = b64(await r.arrayBuffer());
      await keep(key, audio, was).catch(() => {});
      /* a miss already waits on ElevenLabs, so the daily sweep rides on one of those and never on a cached reply */
      await sweep().catch(() => {});
      return {audio, mime: 'audio/mpeg'};
    }
  };
}
