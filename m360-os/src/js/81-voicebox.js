/* module: voicebox. Admin > Controls > Super: point the site at the m360 voice box (m360-voice/, the
   open source speaker and listener). The founder gives its https address, the key it runs with and the
   voice name; the server checks the box's health and keeps the key where no page can read it. The
   site only: the artifact cannot reach outside servers and says so. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState, useEffect} = React;

  function VoiceBoxCard() {
    const ctx = M.useCtx();
    const api = typeof window.M360_API === 'function' && window.M360_STANDALONE ? window.M360_API : null;
    const [st, setSt] = useState(null);
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [voice, setVoice] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [info, setInfo] = useState(null);
    const load = () => { if (api) api('voicestatus').then(r => setSt(r || null)).catch(() => setSt(null)); };
    useEffect(load, []);
    if (!ctx.isFounder) return null;
    if (!api) return html`<${UI.Card} id="voicebox-card" title="Voice box" action=${M.fx ? html`<${M.fx.Orb} state="breathing" size=${20} label="the browser voice"/>` : null}>
      <div class="small ink62">The one m360 voice (Chatterbox to speak, Whisper to listen) runs on the team site. This page cannot reach outside servers, so here m360 uses the browser's own voice.</div>
    <//>`;
    const save = async () => {
      setBusy(true); setErr(''); setInfo(null);
      try {
        const r = await api('voicebox', {url: url.trim(), key: key.trim(), keep: !key.trim(), voice: voice.trim()});
        setInfo(r); setKey(''); load();
        if (M.speech) { await M.speech.refresh(); if (r.on) M.speech.say('Hi, this is the m360 voice. All set.'); }
        M.toast(r.on ? 'Voice box on' : 'Voice box removed');
      } catch (e) { setErr((e && e.message) || 'That did not save.'); }
      setBusy(false);
    };
    const remove = async () => { setBusy(true); try { await api('voicebox', {url: ''}); setInfo(null); load(); if (M.speech) M.speech.refresh(); M.toast('Voice box removed'); } catch (e) { setErr((e && e.message) || 'That did not save.'); } setBusy(false); };
    const on = !!(st && st.on && st.engine === 'box');
    /* the thinking orb (thinking-orbs): listening while the box is on, connecting while it saves */
    const orb = M.fx && (busy || on) ? html`<${M.fx.Orb} state=${busy ? 'connecting' : 'listening'} size=${20} label=${busy ? 'connecting' : 'the voice box is on'}/>` : null;
    return html`<${UI.Card} id="voicebox-card" title="Voice box" action=${html`<span class="row nowrap" style=${{gap: '6px'}}>${orb}<span class=${'tiny ' + (on ? 'flame-t' : 'ink62')} id="voicebox-status">${on ? 'on, voice ' + (st.name || 'm360') : st && st.on ? 'ElevenLabs is on; the box replaces it' : 'off'}</span></span>`}>
      <div class="small" style=${{marginBottom: '10px'}}>The one m360 voice: Chatterbox speaks (English, Hindi, Arabic and twenty one more), Whisper listens. Open source, MIT, on a box you run (see m360-voice/ in the repo). The key stays on the server.</div>
      <div class="stack tight">
        <${UI.Input} id="voicebox-url" label="box address" placeholder="https://voice.mask360.agency" value=${url} onChange=${setUrl}/>
        <${UI.Input} id="voicebox-key" label=${on ? 'key (blank keeps the one saved)' : 'key'} placeholder="the long random string the box runs with" value=${key} onChange=${setKey}/>
        <${UI.Input} id="voicebox-voice" label="voice name" placeholder="m360 (blank picks m360, or default)" value=${voice} onChange=${setVoice}/>
        <div class="row between">
          <span class="row nowrap">
            <${UI.Btn} id="voicebox-save" sm=${true} disabled=${busy || !url.trim()} onClick=${save}>${on ? 'Update' : 'Connect'}<//>
            ${on ? html`<${UI.Btn} id="voicebox-say" sm=${true} kind="sec" onClick=${() => M.speech && M.speech.say('Hi, this is the m360 voice.')}>Say a line<//>` : null}
          </span>
          ${on ? html`<button type="button" class="linky tiny" id="voicebox-remove" onClick=${remove}>Remove</button>` : null}
        </div>
        ${err ? html`<div class="tiny flame-t" id="voicebox-err">${err}</div>` : null}
        ${info && info.on ? html`<div class="tiny ink62" id="voicebox-info">Connected: ${info.device || 'device unknown'}, ${info.multilingual ? 'multilingual on' : 'English only'}, voices ${(info.voices || []).join(', ') || 'none saved yet'}.</div>` : null}
      </div>
    <//>`;
  }

  M.superCards = (M.superCards || []).concat([VoiceBoxCard]);
})();
