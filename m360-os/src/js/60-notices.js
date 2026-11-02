/* module: notices. Live news in the island at the top of the canvas (v40, design/m360-os-v7.html): the line,
   with who sent it under it, unless previews are off (Me, Prefs), in which case only who. A tap opens the
   thing. They queue one at a time behind whatever the island is saying, and when the tab is hidden the same
   notice goes out of the page: in the m360 desktop app as its own card over every other window (black, the
   flame logo, our type; see desktop/notice.html), in a browser through the system's notification with the
   flame logo as its icon (the system draws that one, so its look is the system's). Both honour the same
   preview setting. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState, useEffect} = React;

  /* how long a notice stays in the island, unless it says */
  const LIFE = 4200;
  let seq = 0;
  const subs = new Set();
  /* what is showing or waiting in the island: the API keeps its list for anything that reads it */
  let list = [];
  const emit = () => subs.forEach(f => { try { f(list); } catch (e) { /* page handler */ } });
  const isl = () => (M.island && M.island.notify ? M.island : null);
  /* the island's line for a notice: a person's line with their name under it, the OS's title with its line */
  function lineOf(n, previews) {
    const body = previews ? String(n.body || '') : (n.hidden || 'New message');
    if (n.who || n.bot) return {b: body || String(n.title), cap: body ? String(n.title) : ''};
    return {b: String(n.title), cap: body};
  }

  M.notices = {
    previews: () => M.prefs.get('noticePreview', '1') !== '0',
    setPreviews: v => M.prefs.set('noticePreview', v ? '1' : '0'),
    /* {key, who (uid), title, body, href, icon, bot, life, away {title, body}}. v40: the notice is live news in
       the island, queued behind whatever the island is saying; a tap opens href. away is what goes out of the
       page (the system's notification, the service worker's, the desktop card) in place of title and body, so
       a lock screen never shows a name */
    push(n) {
      if (!n || !n.title) return;
      if (n.key && list.some(x => x.key === n.key)) return;
      const item = {...n, id: ++seq, at: Date.now()};
      const key = n.key ? String(n.key) : 'n' + item.id;
      item.nkey = key;
      list = list.concat([item]);
      emit();
      const I = isl();
      if (I) {
        const l = lineOf(n, M.notices.previews());
        I.notify(l.b, l.cap, n.href ? () => M.nav(n.href) : null, null, {key, ms: n.life || LIFE});
      }
      /* the list keeps the notice while the island could still be telling it */
      const forget = () => {
        const J = isl();
        if (J && (J.showing() === key || J.waiting().indexOf(key) >= 0)) { setTimeout(forget, 600); return; }
        list = list.filter(x => x.id !== item.id); emit();
      };
      setTimeout(forget, (n.life || LIFE) + 600);
      /* the tab is away: the notice goes out of the page too */
      try {
        if (document.hidden || !document.hasFocus()) {
          const away = n.away && typeof n.away === 'object' ? n.away : null;
          const title = String((away && away.title) || n.title).slice(0, 80);
          const body = away && away.body ? String(away.body).slice(0, 140) : M.notices.previews() ? String(n.body || '').slice(0, 140) : (n.hidden || 'New message');
          const desk = window.m360desktop;
          if (desk && typeof desk.notify === 'function') desk.notify({key: n.key || ('m360-' + item.id), title, body, href: n.href || '', life: n.life || LIFE});
          else if (window.Notification && Notification.permission === 'granted') {
            /* the same key is one notification: a second device or a second pass replaces it, never stacks */
            const opts = {body, tag: n.key || ('m360-' + item.id), icon: 'icons/notify-256.png', badge: 'icons/notify-badge-96.png', data: {href: n.href || ''}};
            const sw = window.M360_STANDALONE && navigator.serviceWorker && navigator.serviceWorker.controller;
            /* on the team site the service worker shows it (Android Chrome refuses a page's own); a tap
               comes back through the worker's notificationclick with the href */
            if (sw) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => {});
            else {
              const nn = new Notification(title, opts);
              nn.onclick = () => { try { window.focus(); if (n.href) M.nav(n.href); nn.close(); } catch (e) { /* closed */ } };
            }
          }
        }
      } catch (e) { /* no notices here */ }
    },
    dismiss(id) {
      const it = list.find(x => x.id === id);
      if (it && isl()) isl().drop(it.nkey);
      list = list.filter(x => x.id !== id); emit();
    },
    clear() { const I = isl(); if (I) list.forEach(x => I.drop(x.nkey)); list = []; emit(); },
    list: () => list.slice(),
    ask: () => { try { if (window.Notification && Notification.permission === 'default') return Notification.requestPermission(); } catch (e) { /* none */ } return Promise.resolve(window.Notification ? Notification.permission : 'denied'); },
    /* 'default' (never asked), 'granted', 'denied', or 'none' when this browser has no notifications */
    state: () => { try { return window.Notification ? Notification.permission : 'none'; } catch (e) { return 'none'; } },
    on: f => { subs.add(f); return () => subs.delete(f); }
  };

  /* a tap on a system notice the service worker showed comes back here with its href (team site) */
  try {
    if (window.M360_STANDALONE && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', e => {
        const href = e && e.data && typeof e.data.href === 'string' ? e.data.href : '';
        if (/^#[A-Za-z0-9_\-\/.:=~]*$/.test(href)) { try { window.focus(); } catch (er) { /* focus refused */ } M.nav(href); }
      });
    }
  } catch (e) { /* no service worker here */ }


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
