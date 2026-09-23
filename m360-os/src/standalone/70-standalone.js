/* module: standalone. Only in the EdgeOne build: first-run setup, sign in by name,
   sign-in links for other devices, sign out, and the founder's AI key. */
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

  /* ---------- sign in: by email link, or set up, or ask to join by name ---------- */
  const base = () => location.origin + location.pathname;
  function SignIn() {
    const [info, setInfo] = useState(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mode, setMode] = useState('email');            /* email, join */
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [err, setErr] = useState(window.M360_LOGIN_ERR || '');
    useEffect(() => { api('me').then(setInfo, () => setInfo({uid: null, setup: false, down: true})); }, []);
    if (!info) return html`<${M.Gate} title="Signing you in" line="One moment."/>`;
    if (info.down) return html`<${M.Gate} title="Workspace unavailable" line="The workspace could not load. Reload in a moment."/>`;

    const first = !!info.setup;
    async function go() {
      if (!name.trim()) return;
      setBusy(true); setErr('');
      try { await api(first ? 'setup' : 'signup', {name: name.trim(), email: email.trim()}); location.reload(); }
      catch (e) {
        setErr(e && e.code === 'taken' ? 'Someone set this workspace up a moment ago. Reload and ask to join.' : 'That did not work. Try again in a moment.');
        setBusy(false);
      }
    }
    async function magic() {
      if (!email.trim()) return;
      setBusy(true); setErr('');
      try {
        const r = await api('magic', {email: email.trim(), base: base()});
        if (r.nomail) setErr('Email sign-in is not switched on yet. Ask Kaavish for a sign-in link, or open your invite link again.');
        else setSent(true);
      } catch (e) { setErr((e && e.message) || 'That did not work. Try again in a moment.'); }
      setBusy(false);
    }
    if (first) return html`<${M.Gate} title="Set up m360 OS" line="You are the first one here, so this workspace is yours. You get HQ, Admin and every number.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-name" label="your name" value=${name} placeholder="First and last name" onChange=${setName} onEnter=${go}/>
        <${UI.Input} id="signin-email" label="your email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${go}
          hint="For sign-in links on other devices. Never shown to the team."/>
        <${UI.Btn} onClick=${go} disabled=${busy || !name.trim()}>${busy ? 'One moment' : 'Set up the workspace'}<//>
        ${err ? html`<div class="small flame-t" role="alert">${err}</div>` : null}
      </div>
    <//>`;
    if (sent) return html`<${M.Gate} title="Check your email" line=${'A sign-in link is on its way to ' + email.trim() + '. It works once, for 24 hours.'}>
      <button type="button" class="linky small" onClick=${() => setSent(false)}>Use a different email</button>
    <//>`;
    if (mode === 'join') return html`<${M.Gate} title="Welcome to m360" line="Type your name to get started. Kaavish lets you in with one tap.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-name" label="your name" value=${name} placeholder="First and last name" onChange=${setName} onEnter=${go}/>
        <${UI.Input} id="signin-email" label="your email, optional" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${go}/>
        <${UI.Btn} onClick=${go} disabled=${busy || !name.trim()}>${busy ? 'One moment' : 'Continue'}<//>
        ${err ? html`<div class="small flame-t" role="alert">${err}</div>` : null}
        <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => setMode('email')}>Already on the team? Sign in by email</button>
      </div>
    <//>`;
    return html`<${M.Gate} title="Sign in to m360" line="Your work email gets you a sign-in link. No password, ever.">
      <div class="join-box stack tight">
        <${UI.Input} id="signin-email" label="your work email" type="email" value=${email} placeholder="you@mask360.agency" onChange=${setEmail} onEnter=${magic}/>
        <${UI.Btn} onClick=${magic} disabled=${busy || !email.trim()}>${busy ? 'Sending' : 'Send me a sign-in link'}<//>
        ${err ? html`<div class="small flame-t" role="alert">${err}</div>` : null}
        <button type="button" class="linky small" style=${{alignSelf: 'flex-start'}} onClick=${() => { setErr(''); setMode('join'); }}>New here without an invite? Ask to join</button>
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

  function DeviceCard() {
    const [open, setOpen] = useState(false);
    const [canInstall, setCanInstall] = useState(!!window.M360_INSTALL);
    useEffect(() => { const on = () => setCanInstall(true); window.addEventListener('m360:installable', on); return () => window.removeEventListener('m360:installable', on); }, []);
    const install = async () => { const e = window.M360_INSTALL; if (!e) return; e.prompt(); try { await e.userChoice; } catch (x) { /* dismissed */ } window.M360_INSTALL = null; setCanInstall(false); };
    return html`<${UI.Card} title="This account" id="device-card">
      <div class="row">
        ${canInstall ? html`<${UI.Btn} sm=${true} onClick=${install}>Add m360 to this phone<//>` : null}
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
    const message = link => 'You are on m360 OS, the Mask360 workspace. Open your personal link to get in: ' + link + ' (it works once, for 14 days).';
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
        ? 'They get an email with a personal link. Opening it signs them in and puts them on the team, no approval needed.'
        : 'Email sending is off, so you get a personal link to send yourself (WhatsApp works). Switch email on below to send it for you.'}</p>
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
  M.parts.AiKeyCard = AiKeyCard;
})();
