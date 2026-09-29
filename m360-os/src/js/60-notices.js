/* module: notices. Small cards in the top right corner, the way a phone shows a message: who, and a line
   of what, unless previews are off (Me, Prefs), in which case only who. A tap opens the thing. They stack,
   they slide away after a few seconds, and when the tab is hidden the same notice goes through the
   browser's own notification, honouring the same preview setting. */
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
    /* {key, who (uid), title, body, href, icon} */
    push(n) {
      if (!n || !n.title) return;
      if (n.key && list.some(x => x.key === n.key)) return;
      const item = {...n, id: ++seq, at: Date.now()};
      list = list.filter(x => x.key !== n.key).concat([item]).slice(-MAX);
      emit();
      setTimeout(() => { list = list.filter(x => x.id !== item.id); emit(); }, n.life || LIFE);
      /* the tab is away: the browser shows it too */
      try {
        if ((document.hidden || !document.hasFocus()) && window.Notification && Notification.permission === 'granted') {
          const nn = new Notification(n.title, {body: M.notices.previews() ? String(n.body || '').slice(0, 140) : 'New message', tag: n.key || ('m360-' + item.id), icon: 'icons/icon-192.png'});
          nn.onclick = () => { try { window.focus(); if (n.href) M.nav(n.href); nn.close(); } catch (e) { /* closed */ } };
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
    return html`<div class="notices" id="notices" aria-live="polite">
      ${items.map(n => html`<div key=${n.id} class="notice" role="status">
        <button type="button" class="notice-body" onClick=${() => { M.notices.dismiss(n.id); if (n.href) M.nav(n.href); }}>
          ${n.who ? html`<${UI.Avatar} id=${n.who} size=${34}/>` : html`<span class="notice-mark"><${M.Mark} width="34px"/></span>`}
          <span class="grow" style=${{minWidth: 0}}>
            <span class="notice-title">${n.title}</span>
            <span class="notice-text">${previews ? (n.body || '') : (n.hidden || 'New message')}</span>
          </span>
        </button>
        <button type="button" class="notice-x" aria-label="Dismiss" onClick=${() => M.notices.dismiss(n.id)}><${M.icons.x}/></button>
      </div>`)}
    </div>`;
  }

  M.parts.Notices = Notices;

  /* the one-time card on Home: browsers only grant notifications from a tap, so this asks for it */
  function NoticePermit() {
    const ctx = M.useCtx();
    const uid = ctx && ctx.uid;
    const [perm, setPerm] = useState(() => M.notices.state());
    const [gone, setGone] = useState(() => !!uid && M.prefs.get('notifyAsk.' + uid, '') === '0');
    if (!uid || perm !== 'default' || gone) return null;
    const later = () => { M.prefs.set('notifyAsk.' + uid, '0'); setGone(true); };
    const on = () => M.notices.ask().then(p => { setPerm(p || 'denied'); M.toast(p === 'granted' ? 'Notifications are on' : 'Notifications stay off'); });
    return html`<div class="card notify-card" id="notify-card">
      <div class="row between">
        <div class="grow" style=${{minWidth: 0}}>
          <div class="card-title">Get a bubble when something is for you</div>
          <div class="small ink62" style=${{marginTop: '4px'}}>A task handed to you, a message, an approval, kudos, a holiday: m360 shows it on your screen even while it sits in another window.</div>
        </div>
        <span class="row nowrap" style=${{gap: '8px'}}>
          <${UI.Btn} sm=${true} id="notify-on" onClick=${on}>Turn on notifications<//>
          <${UI.Btn} kind="ghost" sm=${true} id="notify-later" onClick=${later}>Not now<//>
        </span>
      </div>
    </div>`;
  }
  M.parts.NoticePermit = NoticePermit;
})();
