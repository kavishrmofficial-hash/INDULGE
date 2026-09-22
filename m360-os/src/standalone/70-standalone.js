/* module: standalone. Only in the EdgeOne build: first-run setup, sign in by name,
   sign-in links for other devices, sign out, and the founder's AI key. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState, useEffect} = React;
  if (!window.M360_STANDALONE) return;
  const api = window.M360_API;

  /* the address people open; an anonymous preview keeps its access token in the query */
  M.APP_URL = location.origin + location.pathname + location.search;
  const linkFor = code => M.APP_URL + '#login=' + code;

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); M.toast('Copied'); }
    catch (e) { M.toast('Copy is blocked here. Select the text and copy it.', true); }
  }

  /* ---------- sign in: set up, or join by name ---------- */
  function SignIn() {
    const [info, setInfo] = useState(null);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(window.M360_LOGIN_ERR || '');
    useEffect(() => { api('me').then(setInfo, () => setInfo({uid: null, setup: false, down: true})); }, []);
    if (!info) return html`<${M.Gate} title="Signing you in" line="One moment."/>`;
    if (info.down) return html`<${M.Gate} title="Workspace unavailable" line="The workspace could not load. Reload in a moment."/>`;

    const first = !!info.setup;
    async function go() {
      if (!name.trim()) return;
      setBusy(true); setErr('');
      try { await api(first ? 'setup' : 'signup', {name: name.trim()}); location.reload(); }
      catch (e) {
        setErr(e && e.code === 'taken' ? 'Someone set this workspace up a moment ago. Reload and ask to join.' : 'That did not work. Try again in a moment.');
        setBusy(false);
      }
    }
    return html`<${M.Gate} title=${first ? 'Set up m360 OS' : 'Welcome to m360'}
      line=${first ? 'You are the first one here, so this workspace is yours. You get HQ, Admin and every number.'
        : 'Type your name to get started. Kaavish lets you in with one tap.'}>
      <div class="join-box stack tight">
        <${UI.Input} id="signin-name" label="your name" value=${name} placeholder="First and last name"
          onChange=${setName} onEnter=${go}/>
        <${UI.Btn} onClick=${go} disabled=${busy || !name.trim()}>${busy ? 'One moment' : first ? 'Set up the workspace' : 'Continue'}<//>
        ${err ? html`<div class="small flame-t" role="alert">${err}</div>` : null}
        ${first ? null : html`<p class="small ink62" style=${{margin: '6px 0 0'}}>Already on the team? Open the sign-in link from your other device or from Kaavish.</p>`}
      </div>
    <//>`;
  }

  /* ---------- a sign-in link for a person (the founder) or for yourself ---------- */
  function LinkDrawer({uid, onClose}) {
    const ctx = M.useCtx();
    const [link, setLink] = useState('');
    const [err, setErr] = useState('');
    const self = !uid || uid === ctx.uid;
    useEffect(() => {
      api('mklink', self ? {} : {uid}).then(r => setLink(linkFor(r.code)), () => setErr('That did not work. Try again in a moment.'));
    }, [uid]);
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${self ? 'Sign in on another device' : 'Sign-in link'}>
      <div class="stack" style=${{gap: '14px'}}>
        <div class="row"><${UI.Avatar} id=${uid || ctx.uid} size=${34}/><span style=${{fontWeight: 500}}><${UI.Name} id=${uid || ctx.uid}/></span></div>
        <p class="small ink62" style=${{margin: 0}}>${self
          ? 'Open this link on your phone or laptop and you are signed in there too. It works once, for 7 days.'
          : 'Send this to them. It signs them in on any device, works once, for 7 days.'}</p>
        ${link ? html`<div class="invite-link num" id="signin-link">${link}</div>
          <div class="row"><${UI.Btn} sm=${true} onClick=${() => copy(link)}>Copy link<//></div>`
          : err ? html`<div class="small flame-t">${err}</div>` : html`<${UI.Empty} text="Making the link."/>`}
      </div>
    <//>`;
  }

  /* ---------- Me: devices and sign out ---------- */
  function DeviceCard() {
    const [open, setOpen] = useState(false);
    return html`<${UI.Card} title="This account" id="device-card">
      <div class="row">
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setOpen(true)}>Sign in on another device<//>
        <${UI.ConfirmBtn} kind="ghost" onConfirm=${() => api('logout').then(() => location.reload(), () => location.reload())}
          label="Tap again to sign out">Sign out<//>
      </div>
      ${open ? html`<${LinkDrawer} onClose=${() => setOpen(false)}/>` : null}
    <//>`;
  }

  /* ---------- Admin: the AI key ---------- */
  function AiKeyCard() {
    const ctx = M.useCtx();
    const [on, setOn] = useState(null);
    const [key, setKey] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { api('aistatus').then(r => setOn(!!r.on), () => setOn(false)); }, []);
    if (!ctx.isFounder || on === null) return null;
    async function save(k) {
      setBusy(true);
      try {
        const r = await api('aikey', {key: k});
        setOn(!!r.on); setKey('');
        M.toast(k ? 'AI is on. Reload to use it.' : 'Key removed');
      } catch (e) { M.toast((e && e.message) || 'That did not save.', true); }
      setBusy(false);
    }
    return html`<${UI.Card} id="ai-key" title="m360 AI"
      action=${on ? html`<span class="pill ink">on</span>` : html`<span class="pill flame-o">off</span>`}>
      <p class="small ink62" style=${{marginTop: 0}}>${on
        ? 'Brief me, Ask m360, the cursor buddy and every AI button run on your Anthropic key. The key stays on the server and never reaches a page.'
        : 'Paste an Anthropic API key to switch on Brief me, Ask m360, the cursor buddy and every AI button. It stays on the server and never reaches a page.'}</p>
      <div class="row">
        <input class="input" type="password" autocomplete="off" style=${{maxWidth: '360px'}} placeholder="sk-ant-..."
          aria-label="Anthropic API key" value=${key} onInput=${e => setKey(e.target.value)}/>
        <${UI.Btn} sm=${true} disabled=${busy || !key.trim()} onClick=${() => save(key.trim())}>Save key<//>
        ${on ? html`<${UI.ConfirmBtn} kind="ghost" onConfirm=${() => save('')} label="Tap again to remove">Remove<//>` : null}
      </div>
    <//>`;
  }

  M.parts.SignIn = SignIn;
  M.parts.LinkDrawer = LinkDrawer;
  M.parts.DeviceCard = DeviceCard;
  M.parts.AiKeyCard = AiKeyCard;
})();
