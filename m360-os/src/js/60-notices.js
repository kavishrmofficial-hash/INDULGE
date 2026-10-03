/* module: notices. Small cards in the top right corner, the way a phone shows a message: who, and a line
   of what, unless previews are off (Me, Prefs), in which case only who. A tap opens the thing. They stack,
   they slide away after a few seconds, and when the tab is hidden the same notice goes out of the page:
   in the m360 desktop app as its own card over every other window (black, the flame logo, our type; see
   desktop/notice.html), in a browser through the system's notification with the flame logo as its icon
   (the system draws that one, so its look is the system's). Both honour the same preview setting. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState, useEffect} = React;

  const LIFE = 6500;
  const MAX = 4;
  let seq = 0;
  const subs = new Set();
  let list = [];
  const emit = () => subs.forEach(f => { try { f(list); } catch (e) { /* page handler */ } });

  M.notices = {
    previews: () => M.prefs.get('noticePreview', '1') !== '0',
    setPreviews: v => M.prefs.set('noticePreview', v ? '1' : '0'),
    /* {key, who (uid), title, body, href, icon, bot (the personal manager's pill face)} */
    push(n) {
      if (!n || !n.title) return;
      if (n.key && list.some(x => x.key === n.key)) return;
      const item = {...n, id: ++seq, at: Date.now()};
      list = list.filter(x => x.key !== n.key).concat([item]).slice(-MAX);
      emit();
      setTimeout(() => { list = list.filter(x => x.id !== item.id); emit(); }, n.life || LIFE);
      /* the tab is away: the notice goes out of the page too */
      try {
        if (document.hidden || !document.hasFocus()) {
          const body = M.notices.previews() ? String(n.body || '').slice(0, 140) : (n.hidden || 'New message');
          const desk = window.m360desktop;
          if (desk && typeof desk.notify === 'function') desk.notify({key: n.key || ('m360-' + item.id), title: String(n.title).slice(0, 80), body, href: n.href || '', life: n.life || LIFE});
          else if (window.Notification && Notification.permission === 'granted') {
            /* the same key is one notification: a second device or a second pass replaces it, never stacks */
            const opts = {body, tag: n.key || ('m360-' + item.id), icon: 'icons/notify-256.png', badge: 'icons/notify-badge-96.png', data: {href: n.href || ''}};
            const sw = window.M360_STANDALONE && navigator.serviceWorker && navigator.serviceWorker.controller;
            /* on the team site the service worker shows it (Android Chrome refuses a page's own); a tap
               comes back through the worker's notificationclick with the href */
            if (sw) navigator.serviceWorker.ready.then(r => r.showNotification(String(n.title).slice(0, 80), opts)).catch(() => {});
            else {
              const nn = new Notification(n.title, opts);
              nn.onclick = () => { try { window.focus(); if (n.href) M.nav(n.href); nn.close(); } catch (e) { /* closed */ } };
            }
          }
        }
      } catch (e) { /* no notices here */ }
    },
    dismiss(id) { list = list.filter(x => x.id !== id); emit(); },
    clear() { list = []; emit(); },
    ask: () => { try { if (window.Notification && Notification.permission === 'default') return Notification.requestPermission(); } catch (e) { /* none */ } return Promise.resolve(window.Notification ? Notification.permission : 'denied'); },
    /* 'default' (never asked), 'granted', 'denied', or 'none' when this browser has no notifications */
    state: () => { try { return window.Notification ? Notification.permission : 'none'; } catch (e) { return 'none'; } },
    on: f => { subs.add(f); return () => subs.delete(f); }
  };

  function Notices() {
    const [items, setItems] = useState(list);
    useEffect(() => { const un = M.notices.on(setItems); setItems(list); return un; }, []);
    if (!items.length) return null;
    const previews = M.notices.previews();
    /* black in both themes, the flame logo in a circle (the person's face tucked on it when a person sent
       it), the title and the line; a thin flame line runs down the notice's life. As compact as a phone's
       banner, so it covers as little of the page under it as it can */
    return html`<div class="notices" id="notices" aria-live="polite">
      ${items.map(n => html`<div key=${n.id} class=${'notice' + (n.bot ? ' is-bot' : '')} data-key=${n.key || ''} role="status" style=${{'--life': (n.life || LIFE) + 'ms'}}>
        <button type="button" class="notice-body" onClick=${() => { M.notices.dismiss(n.id); if (n.href) M.nav(n.href); }}>
          ${n.bot && M.fx && M.fx.Bot ? html`<span class="notice-logo notice-bot" aria-hidden="true"><${M.fx.Bot} type="pill" size=${30} label="bot"/></span>`
            : html`<span class="notice-logo" aria-hidden="true"><${M.Mark} width="23px"/>${n.who ? html`<span class="notice-who"><${UI.Avatar} id=${n.who} size=${16}/></span>` : null}</span>`}
          <span class="grow" style=${{minWidth: 0}}>
            <span class="notice-title">${n.title}</span>
            <span class="notice-text">${previews ? (n.body || '') : (n.hidden || 'New message')}</span>
          </span>
        </button>
        <button type="button" class="notice-x" aria-label="Dismiss" onClick=${() => M.notices.dismiss(n.id)}><${M.icons.x}/></button>
        <span class="notice-life" aria-hidden="true"/>
      </div>`)}
    </div>`;
  }

  M.parts.Notices = Notices;

  /* the desktop app's own card was tapped: bring the page to what it was about */
  try {
    const desk = window.m360desktop;
    if (desk && typeof desk.onNotice === 'function') desk.onNotice(p => { if (p && p.href && M.nav) M.nav(String(p.href)); });
  } catch (e) { /* an older desktop app */ }

  /* the one-time card on Home: browsers only grant notifications from a tap, so this asks for it */
  function NoticePermit() {
    const ctx = M.useCtx();
    const uid = ctx && ctx.uid;
    const [perm, setPerm] = useState(() => M.notices.state());
    const [gone, setGone] = useState(() => !!uid && M.prefs.get('notifyAsk.' + uid, '') === '0');
    if (!uid || perm !== 'default' || gone) return null;
    const later = () => { M.prefs.set('notifyAsk.' + uid, '0'); setGone(true); };
    const on = () => M.notices.ask().then(p => { setPerm(p || 'denied'); M.toast(p === 'granted' ? 'Notifications are on' : 'Notifications stay off'); });
    const Beam = M.fx ? M.fx.Beam : ({children}) => children;
    return html`<${Beam}><div class="card notify-card" id="notify-card">
      <div class="row between">
        <div class="grow" style=${{minWidth: 0}}>
          <div class="card-title">Get a bubble when something is for you</div>
          <div class="small ink62" style=${{marginTop: '4px'}}>A task handed to you, a message, an approval, kudos, a holiday: m360 shows it on your screen even while it sits in another window.</div>
        </div>
        <span class="row nowrap" style=${{gap: '8px'}}>
          ${M.fx && M.fx.Bell ? html`<${M.fx.Bell} id="notify-on" offLabel="Notify me" onLabel="You'll be notified" pressed=${false} onChange=${on}/>`
            : html`<${UI.Btn} sm=${true} id="notify-on" onClick=${on}>Turn on notifications<//>`}
          <${UI.Btn} kind="ghost" sm=${true} id="notify-later" onClick=${later}>Not now<//>
        </span>
      </div>
    </div><//>`;
  }
  M.parts.NoticePermit = NoticePermit;
})();
