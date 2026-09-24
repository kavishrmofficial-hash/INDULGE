/* voice: the buddy's spoken lines through ElevenLabs, when the founder has set a voice up in Admin
   (or ELEVENLABS_API_KEY and ELEVENLABS_VOICE in the environment). The key never reaches a page.
   x/voice {key, voice, name, at, by}   n/tts/<hash> {audio, at}  cached lines, 7 days */
const MAX_TEXT = 700;
const MODEL = 'eleven_turbo_v2_5';
const CACHE_MS = 7 * 86400000;
const PREFER = ['sarah', 'rachel', 'laura', 'lily', 'alice', 'matilda', 'jessica', 'aria'];

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

export function voiceActions({store, env, getJ, putJ, levelOf, LEVEL, HttpError, log}) {
  const f = (...a) => (env.fetch || fetch)(...a);
  async function conf() {
    const x = await getJ('x/voice').catch(() => null);
    if (x && x.key) return {key: x.key, voice: x.voice || '', name: x.name || ''};
    if (env.ELEVENLABS_API_KEY) return {key: env.ELEVENLABS_API_KEY, voice: env.ELEVENLABS_VOICE || '', name: ''};
    return null;
  }
  async function listVoices(key) {
    const r = await f('https://api.elevenlabs.io/v1/voices', {headers: {'xi-api-key': key}});
    /* a refused key is the caller's mistake, never a sign-in problem: 400, so the page does not sign anyone out */
    if (!r.ok) throw new HttpError(r.status === 401 ? 400 : 502, r.status === 401 ? 'bad_key' : 'unavailable', r.status === 401 ? 'That key was refused.' : 'The voice service did not answer.');
    const j = await r.json();
    return (j.voices || []).map(v => ({id: v.voice_id, name: v.name || '', labels: v.labels || {}})).filter(v => v.id);
  }
  const bestOf = list => {
    const byPref = PREFER.map(n => list.find(v => String(v.name).toLowerCase() === n)).find(Boolean);
    return byPref || list.find(v => (v.labels || {}).gender === 'female') || list[0] || null;
  };

  return {
    async voicestatus() { const c = await conf(); return {on: !!(c && c.key && c.voice), name: c ? c.name : ''}; },

    /* the founder sets the key and, optionally, which voice; with no voice named the best default is picked */
    async voicekey(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      let key = String(body.key || '').trim();
      /* changing only the voice keeps the stored key */
      if (!key && body.keep) { const c = await conf(); if (!c) throw new HttpError(404, 'voice_off', 'No key is set.'); key = c.key; }
      if (!key) { await store.delete('x/voice').catch(() => {}); await log(v.uid, 'voicekey', '', 'removed'); return {on: false}; }
      if (!/^[A-Za-z0-9_\-]{16,200}$/.test(key)) throw new HttpError(400, 'invalid_argument', 'That does not look like an ElevenLabs key.');
      const list = await listVoices(key);
      let voice = String(body.voice || '').trim();
      let pick = list.find(x => x.id === voice) || null;
      if (!pick) pick = bestOf(list);
      if (!pick) throw new HttpError(400, 'invalid_argument', 'That account has no voices yet.');
      await putJ('x/voice', {key, voice: pick.id, name: pick.name, at: Date.now(), by: v.uid});
      await log(v.uid, 'voicekey', '', 'set, voice ' + pick.name);
      return {on: true, voice: pick.id, name: pick.name, voices: list.map(x => ({id: x.id, name: x.name}))};
    },

    async voices(v) {
      if (!v || (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      const c = await conf();
      if (!c) return {voices: [], on: false};
      const list = await listVoices(c.key);
      return {voices: list.map(x => ({id: x.id, name: x.name})), voice: c.voice, name: c.name, on: !!c.voice};
    },

    /* one spoken line, as mp3 in base64; anyone on the roster may ask */
    async speak(v, body) {
      if (!v || (await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'not_granted');
      const c = await conf();
      if (!c || !c.voice) throw new HttpError(404, 'voice_off', 'No voice is set up.');
      const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
      if (!text) throw new HttpError(400, 'invalid_argument', 'nothing to say');
      const key = 'n/tts/' + c.voice.slice(0, 12) + '~' + hash(text);
      const hit = await getJ(key).catch(() => null);
      if (hit && hit.audio && Date.now() - (hit.at || 0) < CACHE_MS) return {audio: hit.audio, mime: 'audio/mpeg', cached: true};
      const r = await f('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(c.voice) + '?output_format=mp3_22050_32', {
        method: 'POST',
        headers: {'xi-api-key': c.key, 'content-type': 'application/json', accept: 'audio/mpeg'},
        body: JSON.stringify({text, model_id: MODEL, voice_settings: {stability: .38, similarity_boost: .8, style: .4, use_speaker_boost: true}})
      });
      if (!r.ok) throw new HttpError(502, r.status === 401 ? 'bad_key' : 'unavailable', 'The voice service did not answer.');
      const audio = b64(await r.arrayBuffer());
      await putJ(key, {audio, at: Date.now()}).catch(() => {});
      return {audio, mime: 'audio/mpeg'};
    }
  };
}
