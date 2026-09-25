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
        if (document.hidden && window.Notification && Notification.permission === 'granted') {
          const nn = new Notification(n.title, {body: M.notices.previews() ? String(n.body || '').slice(0, 140) : 'New message', tag: n.key || ('m360-' + item.id), icon: 'icons/icon-192.png'});
          nn.onclick = () => { try { window.focus(); if (n.href) M.nav(n.href); nn.close(); } catch (e) { /* closed */ } };
        }
      } catch (e) { /* no notices here */ }
    },
    dismiss(id) { list = list.filter(x => x.id !== id); emit(); },
    clear() { list = []; emit(); },
    ask: () => { try { if (window.Notification && Notification.permission === 'default') return Notification.requestPermission(); } catch (e) { /* none */ } return Promise.resolve(window.Notification ? Notification.permission : 'denied'); },
    on: f => { subs.add(f); return () => subs.delete(f); }
  };

  function Notices() {
    const [items, setItems] = useState(list);
    useEffect(() => M.notices.on(setItems), []);
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
})();
