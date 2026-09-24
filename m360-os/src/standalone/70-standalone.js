/* module: standalone. Only in the EdgeOne build: first-run setup, sign in by email and password,
   reset codes, email links, sign-in links for other devices, sign out, and the founder's AI key. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
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

  /* ---------- sign in: email and password first; an email link, a reset code, setup and join are the other doors ---------- */
  const base = () => location.origin + location.pathname;
  const GENERIC = 'That did not work. Try again in a moment.';
  /* the server's own line when it is one meant for people, else the calm default */
  const said = (e, codes) => (e && e.message && codes.includes(e.code)) ? e.message : GENERIC;
  /* a password field with the right autocomplete hint, in the same dress as UI.Input */
  function PwInput({id, label, value, onChange, onEnter, auto, hint, placeholder}) {
    return html`<div class="field">
      <label for=${id}>${label}</label>
      <input id=${id} class="input" type="password" autocomplete=${auto || 'current-password'} value=${value} placeholder=${placeholder || ''}
        onInput=${e => onChange(e.target.value)} onKeyDown=${e => { if (onEnter && e.key === 'Enter') onEnter(); }}/>
      ${hint ? html`<div class="hint">${hint}</div>` : null}
    </div>`;
  }
  function SignIn() {
    const [info, setInfo] = useState(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [code, setCode] = useState('');
    const [mode, setMode] = useState('pw');            /* pw, magic, reset, join */
    const [step, setStep] = useState('ask');           /* reset: ask, then code */
    const [nomail, setNomail] = useState(false);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [err, setErr] = useState(window.M360_LOGIN_ERR || '');
    const [siteMode, setSiteMode] = useState(false);    /* first run: restoring a site backup from another address */
    const [restored, setRestored] = useState(false);
    /* an invite link: who it is for (name only) and whether it still stands */
    const [invite, setInvite] = useState(window.M360_INVITE || '');
    const [inv, setInv] = useState(null);           /* {name, title} or {dead: true} */
    useEffect(() => { api('me').then(setInfo, () => setInfo({uid: null, setup: false, down: true})); }, []);
    useEffect(() => { if (invite) api('invited', {code: invite}).then(setInv, () => setInv({dead: true})); }, [invite]);
    if (!info) return html`<${M.Gate} title="Signing you in" line="One moment."/>`;
    if (info.down) return html`<${M.Gate} title="Workspace unavailable" line="The workspace could not load. Reload in a moment."/>`;

    const first = !!info.setup;
    const joinOpen = info.joinOpen !== false;
    const em = email.trim();
    const swap = m => { setErr(''); setMode(m); setStep('ask'); setPw(''); setCode(''); setNomail(false); setSent(false); };
    const ready = first ? !!(name.trim() && em && pw) : !!(em && pw);
    /* setup (the founder) or signup (ask to join): name, email and a password */
    async function go() {
      if (!name.trim() || !em || !pw) return;
      setBusy(true); setErr('');
      try { await api(first ? 'setup' : 'signup', {name: name.trim(), email: em, password: pw}); location.reload(); }
      catch (e) {
        setErr(e && e.code === 'taken' && first ? 'Someone set this workspace up a moment ago. Reload and sign in.'
          : e && e.code === 'closed' ? 'm360 is invite only right now. Ask Kaavish for an invite.'
          : said(e, ['taken', 'weak', 'invalid_argument']));
        setBusy(false);
      }
    }
    async function signin() {
      if (!em || !pw) return;
      setBusy(true); setErr('');
      try { await api('pw', {email: em, password: pw}); location.reload(); }
      catch (e) { setErr(said(e, ['bad_login', 'slow_down'])); setBusy(false); }
    }
    /* the invited person confirms the email the invite went to and picks a password; only then are they on the team */
    async function accept() {
      if (!em || !pw) return;
      setBusy(true); setErr('');
      try { await api('accept', {code: invite, email: em, password: pw}); window.M360_INVITE = ''; location.reload(); }
      catch (e) {
        if (e && e.code === 'expired') setInv({dead: true});
        else setErr(said(e, ['mismatch', 'invalid_argument', 'weak']));
        setBusy(false);
      }
    }
    const leaveInvite = () => { window.M360_INVITE = ''; setInvite(''); setInv(null); setErr(''); };
    async function magic() {
      if (!em) return;
      setBusy(true); setErr('');
      try {
        const r = await api('magic', {email: em, base: base()});
        if (r.nomail) setErr('Email sign-in is not switched on yet. Sign in with your password, or ask Kaavish for a sign-in link.');
        else setSent(true);
      } catch (e) { setErr(said(e, ['invalid_argument'])); }
      setBusy(false);
    }
    /* reset: a code by email (or from Kaavish when email is off), then the code and a new password */
    async function askCode() {
      if (!em) return;
      setBusy(true); setErr('');
      try {
        const r = await api('reset', {email: em, base: base()});
        setNomail(!!r.nomail);
        setStep('code');
      } catch (e) { setErr(said(e, ['invalid_argument'])); }
      setBusy(false);
    }
    async function finishReset() {
      if (!em || !code.trim() || !pw) return;
      setBusy(true); setErr('');
      try { await api('resetpw', {email: em, code: code.trim(), password: pw}); location.reload(); }
      catch (e) { setErr(said(e, ['expired', 'bad_code', 'weak', 'invalid_argument'])); setBusy(false); }
    }
    const errLine = err ? html`<div class="small flame-t" role="alert">${err}</div>` : null;
    const backToSignIn = html`<button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => swap('pw')}>Back to sign in</button>`;
    /* a fresh deployment: set up from nothing, or bring a site backup across from the old address.
       After a restore the store has an owner, so me says setup is over and the sign-in form takes over. */
    const afterRestore = async () => {
      const m = await api('me').catch(() => null);
      if (m && !m.setup) { setRestored(true); setSiteMode(false); setErr(''); setInfo(m); }
    };
    if (first && siteMode) return html`<${M.Gate} title="Set up m360 OS" line="Bringing m360 from another address: pick the site backup you downloaded there and everything comes across, sign-ins included.">
      <div class="join-box stack tight" id="site-restore-box">
        ${M.parts.SiteRestore ? html`<${M.parts.SiteRestore} mode="missing" fresh=${true} onDone=${afterRestore}/>` : null}
        <div class="small ink62 pw-note">The AI key and the email key are never in a backup. Add them again in Admin once you are in.</div>
        <button type="button" class="linky small" id="site-restore-back" style=${{alignSelf: 'flex-start'}} onClick=${() => { setErr(''); setSiteMode(false); }}>Set up a fresh workspace</button>
      </div>
    <//>`;
    if (first) return html`<${M.Gate} title="Set up m360 OS" line="You are the first one here, so this workspace is yours. You get HQ, Admin and every number.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-name" label="your name" value=${name} placeholder="First and last name" onChange=${setName} onEnter=${go}/>
        <${UI.Input} id="signin-email" label="your email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${go}
          hint="This is what you sign in with. Never shown to the team."/>
        <${PwInput} id="signin-pw" label="a password" value=${pw} onChange=${setPw} onEnter=${go} auto="new-password" hint="At least 8 characters."/>
        <div class="small ink62 pw-note">This is the super admin account. Keep the password somewhere safe.</div>
        <${UI.Btn} onClick=${go} disabled=${busy || !ready}>${busy ? 'One moment' : 'Set up the workspace'}<//>
        ${errLine}
        <button type="button" class="linky small" id="site-restore-open" style=${{alignSelf: 'flex-start'}} onClick=${() => { setErr(''); setSiteMode(true); }}>Bringing m360 from another address? Restore a site backup</button>
      </div>
    <//>`;
    if (invite && !first) {
      if (!inv) return html`<${M.Gate} title="Opening your invite" line="One moment."/>`;
      if (inv.dead) return html`<${M.Gate} title="This invite is no longer valid" line="That invite has expired or was already used. Ask Kaavish for a new one.">
        <button type="button" class="linky small" onClick=${leaveInvite}>Already on the team? Sign in</button>
      <//>`;
      return html`<${M.Gate} title="You're invited" line=${(inv.name ? inv.name + ', you' : 'You') + ' have a place on m360 OS, the Mask360 workspace. Type the email your invite went to, pick a password, and you are in.'}>
        <div class="join-box stack tight" id="invite-box">
          ${inv.name ? html`<div class="invite-who"><${UI.Pill} kind="ink">${inv.name}<//>${inv.title ? html`<span class="small ink62">${inv.title}</span>` : null}</div>` : null}
          <${UI.Input} id="signin-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${accept}/>
          <${PwInput} id="signin-pw" label="a password" value=${pw} onChange=${setPw} onEnter=${accept} auto="new-password" hint="At least 8 characters. You sign in with your email and this."/>
          <${UI.Btn} id="invite-go" onClick=${accept} disabled=${busy || !ready}>${busy ? 'One moment' : 'Continue'}<//>
          ${errLine}
          <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${leaveInvite}>Already on the team? Sign in</button>
        </div>
      <//>`;
    }
    if (sent) return html`<${M.Gate} title="Check your email" line=${'A sign-in link is on its way to ' + em + '. It works once, for 20 minutes.'}>
      <button type="button" class="linky small" onClick=${() => setSent(false)}>Use a different email</button>
    <//>`;
    if (mode === 'join') return html`<${M.Gate} title="Welcome to m360" line="Your name, your email and a password to get started. Kaavish lets you in with one tap.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-name" label="your name" value=${name} placeholder="First and last name" onChange=${setName} onEnter=${go}/>
        <${UI.Input} id="signin-email" label="your email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${go}/>
        <${PwInput} id="signin-pw" label="a password" value=${pw} onChange=${setPw} onEnter=${go} auto="new-password" hint="At least 8 characters."/>
        <${UI.Btn} onClick=${go} disabled=${busy || !(name.trim() && em && pw)}>${busy ? 'One moment' : 'Continue'}<//>
        ${errLine}
        <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => swap('pw')}>Already on the team? Sign in</button>
      </div>
    <//>`;
    if (mode === 'magic') return html`<${M.Gate} title="Sign in to m360" line="Your work email gets you a one-time sign-in link.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${magic}/>
        <${UI.Btn} onClick=${magic} disabled=${busy || !em}>${busy ? 'Sending' : 'Send me a sign-in link'}<//>
        ${errLine}
        <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => swap('pw')}>Sign in with a password instead</button>
      </div>
    <//>`;
    if (mode === 'reset') {
      if (step === 'ask') return html`<${M.Gate} title="Reset your password" line="Type your work email and a 6 digit code comes to you. It works for 15 minutes.">
        <div class="join-box stack tight" id="reset-box">
          <${UI.Input} id="reset-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${askCode}/>
          <${UI.Btn} id="reset-send" onClick=${askCode} disabled=${busy || !em}>${busy ? 'One moment' : 'Send me a code'}<//>
          ${errLine}
          <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => { setErr(''); setStep('code'); }}>I already have a code</button>
          ${backToSignIn}
        </div>
      <//>`;
      return html`<${M.Gate} title="Reset your password" line=${nomail ? '' : 'If ' + em + ' is on the team, a 6 digit code is on its way there. It works once, for 15 minutes.'}>
        <div class="join-box stack tight" id="reset-box">
          ${nomail ? html`<div class="small pw-note" id="reset-nomail">Email is off here. Ask Kaavish for a reset code.</div>` : null}
          <${UI.Input} id="reset-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail}/>
          <${UI.Input} id="reset-code" label="the 6 digit code" value=${code} placeholder="123456" onChange=${setCode} onEnter=${finishReset}/>
          <${PwInput} id="reset-pw" label="a new password" value=${pw} onChange=${setPw} onEnter=${finishReset} auto="new-password" hint="At least 8 characters. Every other device is signed out."/>
          <${UI.Btn} id="reset-go" onClick=${finishReset} disabled=${busy || !em || !code.trim() || !pw}>${busy ? 'One moment' : 'Set the new password'}<//>
          ${errLine}
          ${nomail ? null : html`<button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => { setErr(''); setCode(''); setStep('ask'); }}>Send another code</button>`}
          ${backToSignIn}
        </div>
      <//>`;
    }
    return html`<${M.Gate} title="Sign in to m360" line="Your work email and your password.">
      <div class="join-box stack tight" id="signin-box">
        ${restored ? html`<div class="small pw-note" id="site-restored">Restored. Sign in with the email and password you used before.</div>` : null}
        <${UI.Input} id="signin-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${signin}/>
        <${PwInput} id="signin-pw" label="your password" value=${pw} onChange=${setPw} onEnter=${signin} auto="current-password"/>
        <${UI.Btn} id="signin-go" onClick=${signin} disabled=${busy || !ready}>${busy ? 'One moment' : 'Sign in'}<//>
        ${errLine}
        <div class="stack tight pw-links">
          <button type="button" class="linky small" id="pw-forgot" onClick=${() => swap('reset')}>Forgot it? Get a reset code</button>
          <button type="button" class="linky small" id="pw-magic" onClick=${() => swap('magic')}>Sign in with an email link instead</button>
          ${joinOpen
            ? html`<button type="button" class="linky small" onClick=${() => swap('join')}>New here without an invite? Ask to join</button>`
            : html`<div class="small ink62" id="join-closed">New here? Ask Kaavish for an invite.</div>`}
        </div>
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
          ? 'Open this link on your phone or laptop and you are signed in there too. It works once, for 24 hours.'
          : 'Send this to them. It signs them in on any device, works once, for 24 hours.'}</p>
        ${link ? html`<div class="invite-link num" id="signin-link">${link}</div>
          <div class="row"><${UI.Btn} sm=${true} onClick=${() => copy(link)}>Copy link<//></div>`
          : err ? html`<div class="small flame-t">${err}</div>` : html`<${UI.Empty} text="Making the link."/>`}
      </div>
    <//>`;
  }

  /* ---------- Me: devices and sign out ---------- */
  function EmailCard() {
    const [email, setEmail] = useState('');
    const [saved, setSaved] = useState('');
    useEffect(() => { api('me').then(m => { setEmail(m.email || ''); setSaved(m.email || ''); }, () => {}); }, []);
    const save = () => api('setemail', {email: email.trim()}).then(r => { setSaved(r.email); M.toast('Saved. Sign-in links go to ' + r.email); }, e => M.toast((e && e.message) || 'That did not save.', true));
    return html`<${UI.Card} id="email-card" title="Your email">
      <p class="small ink62" style=${{marginTop: 0}}>Sign-in links for new devices go here. The team never sees it.</p>
      <div class="row">
        <input class="input" type="email" style=${{maxWidth: '360px'}} placeholder="you@mask360.agency" aria-label="Your email" value=${email} onInput=${e => setEmail(e.target.value)}/>
        <${UI.Btn} sm=${true} disabled=${!email.trim() || email.trim().toLowerCase() === saved} onClick=${save}>Save<//>
      </div>
    <//>`;
  }

  /* your password: change it, or set one when the account is from before passwords existed */
  function PwCard() {
    const [has, setHas] = useState(null);
    const [cur, setCur] = useState('');
    const [nw, setNw] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => { api('me').then(m => setHas(!!m.hasPw), () => setHas(false)); }, []);
    if (has === null) return null;
    async function save() {
      if (!nw || (has && !cur)) return;
      setBusy(true); setErr('');
      try {
        await api('setpw', has ? {current: cur, password: nw} : {password: nw});
        M.toast(has ? 'Password changed' : 'Password set');
        setHas(true); setCur(''); setNw('');
      } catch (e) { setErr(said(e, ['weak', 'bad_current', 'slow_down'])); }
      setBusy(false);
    }
    return html`<${UI.Card} id="pw-card" title="Sign-in">
      <p class="small ink62" style=${{marginTop: 0}}>${has
        ? 'Your email and this password sign you in on any device. Forgot it? The sign-in screen sends you a reset code.'
        : 'This account has no password yet. Set one and you can sign in with your email on any device.'}</p>
      <div class="pw-form">
        ${has ? html`<${PwInput} id="pw-current" label="current password" value=${cur} onChange=${setCur} onEnter=${save} auto="current-password"/>` : null}
        <${PwInput} id="pw-new" label=${has ? 'new password' : 'a password'} value=${nw} onChange=${setNw} onEnter=${save} auto="new-password" hint="At least 8 characters."/>
      </div>
      <div class="row" style=${{marginTop: '12px'}}>
        <${UI.Btn} id="pw-save" sm=${true} disabled=${busy || !nw || (has && !cur)} onClick=${save}>${busy ? 'One moment' : has ? 'Change password' : 'Set a password'}<//>
      </div>
      ${err ? html`<div class="small flame-t" role="alert" style=${{marginTop: '8px'}}>${err}</div>` : null}
    <//>`;
  }
  M.meCards.push(PwCard);

  /* the sessions of one person, from the server: a short device label, when it signed in, when it was last seen */
  function useDevices(uid) {
    const [devs, setDevs] = useState(null);
    const [err, setErr] = useState('');
    const load = () => api('devices', uid ? {uid} : {}).then(r => { setDevs(r.devices || []); setErr(''); }, () => { setDevs([]); setErr('The device list could not load.'); });
    useEffect(() => { load(); }, [uid]);
    return {devs, err, load};
  }
  function DeviceList({devs, onSignout}) {
    if (!devs) return html`<${UI.Empty} text="Looking up the devices."/>`;
    if (!devs.length) return html`<${UI.Empty} text="No devices signed in."/>`;
    return html`<div class="stack tight devlist">${devs.map(d => html`<div class="listrow" key=${d.id}>
      <span class="grow">
        <span class="row nowrap"><span class="dev-ua">${d.ua}</span>${d.current ? html`<${UI.Pill} kind="ink">this device<//>` : null}</span>
        <div class="tiny ink62">signed in ${U.timeAgo(d.at)} · last seen ${U.timeAgo(d.last)}</div>
      </span>
      ${onSignout && !d.current ? html`<${UI.ConfirmBtn} kind="ghost" onConfirm=${() => onSignout(d)} label="Tap again to sign it out">Sign out<//>` : null}
    </div>`)}</div>`;
  }

  function DeviceCard() {
    const [open, setOpen] = useState(false);
    const [canInstall, setCanInstall] = useState(!!window.M360_INSTALL);
    const {devs, err, load} = useDevices(null);
    useEffect(() => { const on = () => setCanInstall(true); window.addEventListener('m360:installable', on); return () => window.removeEventListener('m360:installable', on); }, []);
    const install = async () => { const e = window.M360_INSTALL; if (!e) return; e.prompt(); try { await e.userChoice; } catch (x) { /* dismissed */ } window.M360_INSTALL = null; setCanInstall(false); };
    const signoutOne = d => api('signout', {id: d.id}).then(() => { M.toast('Signed out of ' + d.ua); load(); }, e => M.toast((e && e.message) || 'That did not work.', true));
    const signoutOthers = () => api('signoutall', {keepThis: true}).then(r => { M.toast(r.removed ? 'Signed out everywhere else' : 'No other devices were signed in'); load(); }, e => M.toast((e && e.message) || 'That did not work.', true));
    const others = (devs || []).filter(d => !d.current).length;
    return html`<${UI.Card} title="This account" id="device-card">
      <p class="small ink62" style=${{marginTop: 0}}>Every phone and laptop signed in as you. Sign out any you do not recognise.</p>
      <${DeviceList} devs=${devs} onSignout=${signoutOne}/>
      ${err ? html`<div class="small flame-t">${err}</div>` : null}
      <div class="row" style=${{marginTop: '12px'}}>
        ${canInstall ? html`<${UI.Btn} sm=${true} onClick=${install}>Add m360 to this phone<//>` : null}
        <${UI.Btn} kind="sec" sm=${true} onClick=${() => setOpen(true)}>Sign in on another device<//>
        ${others ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${signoutOthers} label="Tap again to sign them out">Sign out everywhere else<//>` : null}
        <${UI.ConfirmBtn} kind="ghost" onConfirm=${() => api('logout').then(() => location.reload(), () => location.reload())}
          label="Tap again to sign out">Sign out<//>
      </div>
      ${open ? html`<${LinkDrawer} onClose=${() => setOpen(false)}/>` : null}
    <//>`;
  }

  /* ---------- Admin: a member's devices, from the roster row ---------- */
  function MemberDevicesDrawer({uid, onClose}) {
    const ctx = M.useCtx();
    const {devs, err, load} = useDevices(uid);
    const [code, setCode] = useState('');       /* a reset code, shown once */
    const [npw, setNpw] = useState('');
    const [pwErr, setPwErr] = useState('');
    const owner = !!(ctx.me && ctx.me.isOwner);
    const all = () => api('signoutall', {uid}).then(r => { M.toast(r.removed ? 'Signed out of ' + r.removed + (r.removed === 1 ? ' device' : ' devices') : 'No devices were signed in'); load(); }, e => M.toast((e && e.message) || 'That did not work.', true));
    const resetCode = () => api('resetcode', {uid}).then(r => { setCode(r.code); setPwErr(''); }, e => setPwErr(said(e, ['invalid_argument'])));
    const setFor = () => !npw ? setPwErr('Type the password first.') : api('setpw', {uid, password: npw}).then(() => { M.toast('Password set. They are signed out everywhere.'); setNpw(''); setPwErr(''); load(); }, e => setPwErr(said(e, ['weak', 'invalid_argument'])));
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Devices"
      footer=${html`<${UI.ConfirmBtn} kind="flame" sm=${false} onConfirm=${all} label="Tap again to sign them out">Sign out everywhere<//>`}>
      <div class="stack" style=${{gap: '14px'}}>
        <div class="row"><${UI.Avatar} id=${uid} size=${34}/><span style=${{fontWeight: 500}}><${UI.Name} id=${uid}/></span></div>
        <p class="small ink62" style=${{margin: 0}}>Every device signed in as them. Sign out everywhere ends all of them; they get back in with their password or a fresh link.</p>
        <div id="member-devices"><${DeviceList} devs=${devs}/></div>
        ${err ? html`<div class="small flame-t">${err}</div>` : null}
        ${uid === ctx.uid ? html`<div class="pw-admin" id="member-pw"><${UI.Micro} plain>password<//><p class="small ink62" style=${{margin: 0}}>Your own password changes from Me.</p></div>` : html`<div class="pw-admin stack tight" id="member-pw">
          <${UI.Micro} plain>password<//>
          <p class="small ink62" style=${{margin: 0}}>A reset code is 6 digits they type on the sign-in screen under Forgot it, with a new password. It works once, for 15 minutes. Hand it over in person or on WhatsApp; it is shown here only once.</p>
          <div class="row">
            <${UI.ConfirmBtn} kind="sec" onConfirm=${resetCode} label="Tap again to make a code">Reset code<//>
            ${code ? html`<span class="reset-code num" id="reset-code-out">${code}</span><${UI.Btn} kind="ghost" sm=${true} onClick=${() => copy(code)}>Copy<//>` : null}
          </div>
          ${owner ? html`<div class="row pw-set">
            <${PwInput} id="member-pw-new" label="set a password for them" value=${npw} onChange=${setNpw} auto="off" placeholder="At least 8 characters"/>
            <${UI.ConfirmBtn} kind="sec" onConfirm=${setFor} label="Tap again to set it">Set a password for them<//>
          </div>
          <div class="tiny ink62">Setting it signs them out everywhere. Tell them the new one yourself.</div>` : null}
          ${pwErr ? html`<div class="small flame-t" role="alert">${pwErr}</div>` : null}
        </div>`}
      </div>
    <//>`;
  }
  /* the button sits in a roster row; the drawer itself is mounted on the body so a card's motion cannot pin it in place */
  function MemberDevices({uid}) {
    const [open, setOpen] = useState(false);
    const drawer = open ? html`<${MemberDevicesDrawer} uid=${uid} onClose=${() => setOpen(false)}/>` : null;
    return html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => setOpen(true)}>Devices<//>
      ${drawer && window.ReactDOM && ReactDOM.createPortal ? ReactDOM.createPortal(drawer, document.body) : drawer}`;
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

  /* ---------- Admin: invite by email ---------- */
  const ROLES = [{v: 'member', label: 'Member'}, {v: 'lead', label: 'Pod lead'}, {v: 'founder', label: 'Full access'}];
  function InviteByEmail() {
    const ctx = M.useCtx();
    const [f, setF] = useState({email: '', name: '', title: '', role: 'member'});
    const [busy, setBusy] = useState(false);
    const [last, setLast] = useState(null);       /* {email, link, sent, why} */
    const [list, setList] = useState([]);
    const [mail, setMail] = useState(null);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const refresh = () => api('invites').then(r => setList(r.invites || []), () => {});
    const rosterN = Object.keys(ctx.members || {}).length;
    useEffect(() => { refresh(); api('mailstatus').then(setMail, () => setMail({on: false})); }, []);
    /* an accepted invite shows up as a roster row: drop it from the waiting list as soon as it does */
    useEffect(() => { refresh(); }, [rosterN]);
    useEffect(() => { const t = setInterval(refresh, 30000); return () => clearInterval(t); }, []);
    if (!ctx.isFounder) return null;
    const message = link => 'You are on m360 OS, the Mask360 workspace. Open your personal link and type this email address to get in: ' + link + ' (it works once, for 7 days).';
    async function send() {
      if (!f.email.trim()) return;
      setBusy(true);
      try {
        const r = await api('invite', {...f, base: base()});
        setLast({email: f.email.trim(), ...r});
        setF({email: '', name: '', title: '', role: 'member'});
        refresh();
        M.toast(r.sent ? 'Invite emailed to ' + f.email.trim() : 'Invite made. Send them the link.');
      } catch (e) { M.toast((e && e.message) || 'That did not work.', true); }
      setBusy(false);
    }
    const copy = t => navigator.clipboard.writeText(t).then(() => M.toast('Copied'), () => M.toast('Copy is blocked here. Select the text and copy it.', true));
    return html`<${UI.Card} id="invite-email" title="Invite by email"
      action=${mail ? html`<span class=${'pill ' + (mail.on ? 'ink' : 'flame-o')}>${mail.on ? 'email on' : 'email off'}</span>` : null}>
      <p class="small ink62" style=${{marginTop: 0}}>${mail && mail.on
        ? 'They get an email with a personal link. They open it, type that same email to confirm it is them, and they are on the team, no approval needed.'
        : 'Email sending is off, so you get a personal link to send yourself (WhatsApp works). They open it and type the invited email to get in. Switch email on below to send it for you.'}</p>
      <div class="grid2">
        <${UI.Input} id="inv-email" label="email" type="email" value=${f.email} onChange=${set('email')} placeholder="name@mask360.agency" onEnter=${send}/>
        <${UI.Input} id="inv-name" label="name, optional" value=${f.name} onChange=${set('name')} placeholder="First and last name"/>
        <${UI.Input} id="inv-title" label="title, optional" value=${f.title} onChange=${set('title')} placeholder="Designer"/>
        <${UI.Field} label="access"><${UI.Seg} options=${ROLES} value=${f.role} onChange=${set('role')} ariaLabel="Invite role"/><//>
      </div>
      <div class="row" style=${{marginTop: '12px'}}><${UI.Btn} id="inv-send" disabled=${busy || !f.email.trim()} onClick=${send}>${busy ? 'One moment' : (mail && mail.on ? 'Send invite' : 'Make the invite link')}<//></div>
      ${last ? html`<div class="stack tight" style=${{marginTop: '14px'}} id="inv-last">
        <div class="small">${last.sent ? html`Emailed to <b>${last.email}</b>.` : html`Link for <b>${last.email}</b>${last.why ? html`. Email failed: ${last.why}` : ''}`}</div>
        <div class="invite-link num">${last.link}</div>
        <div class="row">
          <${UI.Btn} sm=${true} onClick=${() => copy(message(last.link))}>Copy invite message<//>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => copy(last.link)}>Copy link<//>
          <a class="btn sec sm" href=${'mailto:' + encodeURIComponent(last.email) + '?subject=' + encodeURIComponent('Your m360 OS invite') + '&body=' + encodeURIComponent(message(last.link))}>Open in my mail app</a>
        </div>
      </div>` : null}
      ${list.length ? html`<div style=${{marginTop: '16px'}}>
        <${UI.Micro} plain>waiting on them<//>
        <div class="stack tight" id="inv-list">${list.map(i => html`<div class="listrow" key=${i.code}>
          <span class="grow"><b>${i.name || i.email}</b>${i.name ? html` <span class="small ink62">${i.email}</span>` : ''}<div class="tiny ink62">${i.title ? i.title + ' · ' : ''}${ROLES.find(r => r.v === i.role).label} · invited ${U.timeAgo(i.at)}</div></span>
          <span class="row nowrap">
            <${UI.Btn} kind="ghost" sm=${true} onClick=${() => copy(base() + '#invite=' + i.code)}>Copy link<//>
            <${UI.ConfirmBtn} kind="ghost" onConfirm=${() => api('uninvite', {code: i.code}).then(refresh)}>Revoke<//>
          </span>
        </div>`)}</div>
      </div>` : null}
    <//>`;
  }

  /* ---------- Admin: email sending through Resend ---------- */
  function MailCard() {
    const ctx = M.useCtx();
    const [st, setSt] = useState(null);
    const [key, setKey] = useState('');
    const [from, setFrom] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { api('mailstatus').then(r => { setSt(r); setFrom(r.from || ''); }, () => setSt({on: false})); }, []);
    if (!ctx.isFounder || !st) return null;
    async function save(k) {
      setBusy(true);
      try { const r = await api('mailkey', {key: k, from}); setSt({...st, on: !!r.on}); setKey(''); M.toast(k ? 'Email is on' : 'Key removed'); }
      catch (e) { M.toast((e && e.message) || 'That did not save.', true); }
      setBusy(false);
    }
    return html`<${UI.Card} id="mail-card" title="Email sending" action=${st.on ? html`<span class="pill ink">on</span>` : html`<span class="pill flame-o">off</span>`}>
      <p class="small ink62" style=${{marginTop: 0}}>Invites and sign-in links go out through Resend. Make a free account at resend.com, add a key here, and set the sender to an address on a domain you verified there. Until a domain is verified, Resend only delivers to your own address.</p>
      <div class="grid2">
        <input class="input" type="password" autocomplete="off" placeholder="re_..." aria-label="Resend API key" value=${key} onInput=${e => setKey(e.target.value)}/>
        <input class="input" placeholder="m360 OS <hello@mask360.agency>" aria-label="Sender" value=${from} onInput=${e => setFrom(e.target.value)}/>
      </div>
      <div class="row" style=${{marginTop: '10px'}}>
        <${UI.Btn} sm=${true} disabled=${busy || !key.trim()} onClick=${() => save(key.trim())}>Save<//>
        ${st.on ? html`<${UI.Btn} kind="sec" sm=${true} disabled=${busy} onClick=${() => api('mailtest').then(() => M.toast('Test sent to your email'), e => M.toast((e && e.message) || 'Test failed', true))}>Send me a test<//>` : null}
        ${st.on && !st.env ? html`<${UI.ConfirmBtn} kind="ghost" onConfirm=${() => save('')} label="Tap again to switch off">Switch off<//>` : null}
      </div>
    <//>`;
  }

  M.parts.InviteByEmail = InviteByEmail;
  M.parts.MailCard = MailCard;
  M.parts.EmailCard = EmailCard;
  M.parts.SignIn = SignIn;
  M.parts.LinkDrawer = LinkDrawer;
  M.parts.DeviceCard = DeviceCard;
  M.parts.MemberDevices = MemberDevices;
  M.parts.AiKeyCard = AiKeyCard;

  /* ---------- Admin: the buddy's voice through ElevenLabs ---------- */
  function VoiceCard() {
    const ctx = M.useCtx();
    const [st, setSt] = useState(null);
    const [key, setKey] = useState('');
    const [voices, setVoices] = useState([]);
    const [voice, setVoice] = useState('');
    const [busy, setBusy] = useState(false);
    const load = () => api('voices').then(r => { setVoices(r.voices || []); setVoice(r.voice || ''); setSt({on: !!r.on, name: r.name || ''}); }, () => api('voicestatus').then(r => setSt({on: !!r.on, name: r.name || ''}), () => setSt({on: false, name: ''})));
    useEffect(() => { load(); if (M.voice) M.voice.refresh(); }, []);
    if (!ctx.isFounder || st === null) return null;
    async function save(k, vid) {
      setBusy(true);
      try {
        const r = await api('voicekey', {key: k, voice: vid || ''});
        setKey('');
        if (r.voices) setVoices(r.voices);
        setVoice(r.voice || ''); setSt({on: !!r.on, name: r.name || ''});
        if (M.voice) M.voice.refresh();
        M.toast(k ? 'Voice on: ' + (r.name || 'set') : 'Voice removed');
      } catch (e) { M.toast((e && e.message) || 'That did not save.', true); }
      setBusy(false);
    }
    const test = () => { if (M.voice) M.voice.say('Hey, I am the m360 buddy. Hold Control and Option and just talk to me.'); };
    return html`<${UI.Card} id="voice-card" title="The buddy's voice"
      action=${st.on ? html`<span class="pill ink">on, ${st.name || 'set'}</span>` : html`<span class="pill flame-o">browser voice</span>`}>
      <p class="small ink62" style=${{marginTop: 0}}>${st.on
        ? 'The buddy speaks with a natural voice from ElevenLabs. Pick another voice below, or remove the key to fall back to the browser voice.'
        : 'Right now the buddy uses the voice built into each browser. For a warm, human voice, make a free account at elevenlabs.com, copy an API key from your profile, and paste it here. The key stays on the server.'}</p>
      <div class="row">
        <input class="input" type="password" autocomplete="off" style=${{maxWidth: '360px'}} placeholder="ElevenLabs API key"
          aria-label="ElevenLabs API key" value=${key} onInput=${e => setKey(e.target.value)}/>
        <${UI.Btn} sm=${true} id="voice-save" disabled=${busy || !key.trim()} onClick=${() => save(key.trim(), voice)}>Save key<//>
        ${st.on ? html`<${UI.ConfirmBtn} kind="ghost" onConfirm=${() => save('', '')} label="Tap again to remove">Remove<//>` : null}
      </div>
      ${voices.length ? html`<div class="row" style=${{marginTop: '10px'}}>
        <${UI.Select} id="voice-pick" label="voice" value=${voice} onChange=${async v => { setVoice(v); try { const r = await api('voicekey', {key: '', voice: v, keep: true}); if (r && r.name) setSt({on: true, name: r.name}); } catch (e) { /* needs the key again */ } }}
          options=${voices.map(x => ({v: x.id, label: x.name}))}/>
        <${UI.Btn} kind="sec" sm=${true} id="voice-test" onClick=${test}>Say hello<//>
      </div>` : html`<div class="row" style=${{marginTop: '10px'}}><${UI.Btn} kind="sec" sm=${true} id="voice-test" onClick=${test}>Hear the browser voice<//></div>`}
    <//>`;
  }
  M.parts.VoiceCard = VoiceCard;
  /* the activity log lives on the server only; the Log tab reads it a day range at a time */
  M.logs = M.logs || {};
  M.logs.read = (ctx, {from, to}) => api('logs', {from, to}).then(r => r.docs || {});
  M.logs.prune = (ctx, days) => api('prunelogs', {days}).then(r => r.removed || 0);
})();
