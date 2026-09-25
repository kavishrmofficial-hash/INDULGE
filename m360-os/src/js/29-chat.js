/* module: chat. The team's own chat: rooms (general, plus any the team makes) and direct messages.
   Messages live per room per sender (chat/<room>:<uid> {msgs}), so two people never overwrite each other;
   a room view merges every sender's doc by time. When a sender's doc passes 300 lines, the oldest go to
   chatlog/<room>:<uid>:<ts>. Read markers sit in the person's private state (chatRead). A direct message
   room is dm.<a>.<b> (sorted); on EdgeOne the server lets only those two read it. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const CAP = 300, KEEP = 160;
  const ROOMS_DOC = 'chatrooms/team';
  const dmId = (a, b) => 'dm.' + [a, b].sort().join('.');
  const isDm = id => String(id).startsWith('dm.');
  const dmOther = (id, me) => String(id).slice(3).split('.').find(u => u !== me) || me;
  const docId = (room, uid) => room + ':' + uid;
  const norm = s => String(s || '').toLowerCase();

  /* every room this person can see: general, the team's rooms, and their own direct messages */
  function roomsOf(ctx) {
    const doc = ctx.coll.chatrooms.map.team || {};
    const list = [{id: 'general', name: 'general', kind: 'room', pinned: true}];
    for (const id of Object.keys(doc.rooms || {})) {
      const r = doc.rooms[id];
      if (r && !r.gone && id !== 'general' && !isDm(id)) list.push({id, name: r.name || id, kind: 'room', by: r.by, at: r.at, topic: r.topic || ''});
    }
    return list;
  }
  /* all messages in one room, every sender merged, oldest first */
  function messagesOf(ctx, room) {
    const map = ctx.coll.chat.map;
    const out = [];
    for (const key of Object.keys(map)) {
      const i = key.lastIndexOf(':');
      if (i < 0 || key.slice(0, i) !== room) continue;
      const by = key.slice(i + 1);
      for (const m of ((map[key] || {}).msgs || [])) if (m && !m.del) out.push({...m, by, room});
    }
    return out.sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const readMark = (ctx, room) => Number((((ctx.priv && ctx.priv.state && ctx.priv.state.data) || {}).chatRead || {})[room]) || 0;
  const unreadIn = (ctx, room) => { const mark = readMark(ctx, room); return messagesOf(ctx, room).filter(m => m.by !== ctx.uid && (m.at || 0) > mark).length; };
  const mentionsMe = (m, ctx, name) => /(^|\s)@everyone\b/i.test(m.text || '') || (name && String(m.text || '').includes('@' + name)) || (m.mentions || []).includes(ctx.uid);
  /* every dm room with any message in it, from the docs this person can see */
  function dmRoomsOf(ctx) {
    const seen = new Set();
    for (const key of Object.keys(ctx.coll.chat.map)) { const room = key.slice(0, key.lastIndexOf(':')); if (isDm(room) && room.includes(ctx.uid)) seen.add(room); }
    return Array.from(seen);
  }
  /* the badge: rooms with something unread, dms counted by message */
  function unreadRooms(ctx) {
    let n = 0;
    for (const r of roomsOf(ctx)) if (unreadIn(ctx, r.id) > 0) n++;
    for (const d of dmRoomsOf(ctx)) n += unreadIn(ctx, d);
    return n;
  }
  /* inbox lines: direct messages and mentions since the read mark */
  function inboxItems(ctx, myName) {
    const out = [];
    for (const d of dmRoomsOf(ctx)) {
      const mark = readMark(ctx, d);
      for (const m of messagesOf(ctx, d)) if (m.by !== ctx.uid && (m.at || 0) > mark) out.push({id: 'chat:' + d + ':' + m.id, room: d, m, dm: true});
    }
    for (const r of roomsOf(ctx)) {
      const mark = readMark(ctx, r.id);
      for (const m of messagesOf(ctx, r.id)) if (m.by !== ctx.uid && (m.at || 0) > mark && mentionsMe(m, ctx, myName)) out.push({id: 'chat:' + r.id + ':' + m.id, room: r.id, m, dm: false});
    }
    return out;
  }

  async function send(ctx, room, text, mentions) {
    const t = String(text || '').trim().slice(0, 4000);
    if (!t) return;
    const key = docId(room, ctx.uid);
    const cur = ((ctx.coll.chat.map[key] || {}).msgs || []).slice();
    const m = {id: U.uid(), at: Date.now(), text: t, mentions: mentions || []};
    let msgs = cur.concat([m]);
    if (msgs.length > CAP) {
      const old = msgs.slice(0, msgs.length - KEEP);
      msgs = msgs.slice(msgs.length - KEEP);
      await ctx.W.set('chatlog/' + key + ':' + Date.now(), {msgs: old, room, by: ctx.uid}).catch(() => {});
    }
    await ctx.W.merge('chat/' + key, {msgs, room, by: ctx.uid, updated: Date.now()});
    return m;
  }
  const edit = (ctx, room, id, text) => {
    const key = docId(room, ctx.uid);
    const msgs = ((ctx.coll.chat.map[key] || {}).msgs || []).map(m => m.id === id ? {...m, text: String(text || '').trim().slice(0, 4000), edited: Date.now()} : m);
    return ctx.W.merge('chat/' + key, {msgs, updated: Date.now()});
  };
  const remove = (ctx, room, id) => {
    const key = docId(room, ctx.uid);
    const msgs = ((ctx.coll.chat.map[key] || {}).msgs || []).map(m => m.id === id ? {...m, del: true, text: ''} : m);
    return ctx.W.merge('chat/' + key, {msgs, updated: Date.now()});
  };
  const markRead = (ctx, room, at) => ctx.W.merge('data/users/' + ctx.uid + '/state', {chatRead: {[room]: at || Date.now()}}).catch(() => {});
  const makeRoom = async (ctx, name, topic) => {
    const id = norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!id || id === 'general' || id.startsWith('dm')) throw new Error('bad name');
    await ctx.W.merge(ROOMS_DOC, {rooms: {[id]: {name: String(name).trim().slice(0, 40), topic: String(topic || '').slice(0, 140), by: ctx.uid, at: Date.now()}}, updated: Date.now()});
    return id;
  };

  /* text with links and @names lit up */
  function Rich({text, names}) {
    const parts = String(text || '').split(/(https?:\/\/[^\s<>"')]+|@everyone|@[A-Z][\w.-]*(?:\s[A-Z][\w.-]*)?)/g);
    return html`<span>${parts.map((p, i) => {
      if (/^https?:\/\//.test(p)) return html`<a key=${i} href=${p} target="_blank" rel="noopener">${p.length > 70 ? p.slice(0, 67) + '...' : p}</a>`;
      if (p === '@everyone' || (p.startsWith('@') && names.some(n => p === '@' + n || p.startsWith('@' + n.split(' ')[0])))) return html`<b key=${i} class="mention">${p}</b>`;
      return p;
    })}</span>`;
  }

  function Chat(props) {
    const roomFromRoute = props.room || props.id || '';
    const ctx = M.useCtx();
    const uid = ctx.uid;
    const rooms = useMemo(() => roomsOf(ctx), [ctx.coll.chatrooms]);
    const dms = useMemo(() => dmRoomsOf(ctx), [ctx.coll.chat]);
    const [room, setRoom] = useState(() => roomFromRoute || (localStorage.getItem('m360.chatRoom') || 'general'));
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [naming, setNaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [editing, setEditing] = useState(null);
    const [listOpen, setListOpen] = useState(!roomFromRoute);
    const endRef = useRef(null);
    const boxRef = useRef(null);
    const phone = M.usePhone();
    /* the route decides: a room in it opens that room; none means the list (the Chat tab on a phone) */
    useEffect(() => { if (roomFromRoute) { if (roomFromRoute !== room) setRoom(roomFromRoute); setListOpen(false); } else setListOpen(true); }, [roomFromRoute]);
    useEffect(() => { try { localStorage.setItem('m360.chatRoom', room); } catch (e) { /* private */ } }, [room]);
    const people = ctx.activeMembers.filter(m => m.uid !== uid);
    const ids = useMemo(() => Array.from(new Set(ctx.activeMembers.map(m => m.uid).concat(dms.map(d => dmOther(d, uid))))), [ctx.activeMembers, dms]);
    const profs = M.useProfiles(ids.concat([uid]));
    const nameOf = id => (profs[id] && profs[id].name) || (ctx.members[id] && ctx.members[id].name) || 'Someone';
    const names = ids.map(nameOf).filter(Boolean);
    const msgs = useMemo(() => messagesOf(ctx, room), [ctx.coll.chat, room]);
    const latest = msgs.length ? msgs[msgs.length - 1].at : 0;
    const online = ctx.online || new Set();
    const isOn = id => online.has ? online.has(id) : (Array.isArray(online) ? online.includes(id) : false);

    /* this room is read up to its latest line while it is open */
    useEffect(() => {
      if (!latest || latest <= readMark(ctx, room)) return;
      const t = setTimeout(() => markRead(ctx, room, latest), 600);
      return () => clearTimeout(t);
    }, [room, latest]);
    useEffect(() => { if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({block: 'end'}); }, [msgs.length, room]);

    /* a browser notice when a line arrives for you while this tab is hidden */
    const seenAt = useRef(0);
    useEffect(() => {
      const items = inboxItems(ctx, nameOf(uid));
      const fresh = items.filter(it => it.m.at > seenAt.current && Date.now() - it.m.at < 60000);
      seenAt.current = Date.now();
      if (!fresh.length || !document.hidden) return;
      try {
        if (window.Notification && Notification.permission === 'granted') {
          const it = fresh[fresh.length - 1];
          new Notification(nameOf(it.m.by) + (it.dm ? '' : ' in #' + it.room), {body: String(it.m.text).slice(0, 120), tag: 'm360-chat', icon: 'icons/icon-192.png'});
        }
      } catch (e) { /* no notices here */ }
    }, [ctx.coll.chat]);

    const mentionIds = t => ctx.activeMembers.filter(m => String(t).includes('@' + nameOf(m.uid)) || String(t).includes('@' + String(nameOf(m.uid)).split(' ')[0] + ' ')).map(m => m.uid);
    const go = async () => {
      const t = text.trim();
      if (!t) return;
      setText('');
      if (editing) { await edit(ctx, room, editing, t).catch(() => {}); setEditing(null); return; }
      await send(ctx, room, t, mentionIds(t)).catch(() => setText(t));
      M.sound.play('soft');
    };
    const onKey = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); }
      if (e.key === 'Escape' && editing) { setEditing(null); setText(''); }
    };
    const openDm = other => { setRoom(dmId(uid, other)); setListOpen(false); M.nav('#chat/' + dmId(uid, other)); };
    const openRoom = id => { setRoom(id); setListOpen(false); M.nav('#chat/' + id); };
    const create = async () => {
      try { const id = await makeRoom(ctx, newName); setNaming(false); setNewName(''); openRoom(id); M.toast('Room made'); } catch (e) { M.toast('Pick a simple name', true); }
    };
    const askNotify = () => { try { if (window.Notification) Notification.requestPermission().then(p => M.toast(p === 'granted' ? 'You will hear about messages for you' : 'Notices stay off')); } catch (e) { /* none */ } };
    const title = isDm(room) ? nameOf(dmOther(room, uid)) : '#' + ((rooms.find(r => r.id === room) || {}).name || room);
    const roomMeta = rooms.find(r => r.id === room);
    const filtered = people.filter(p => !q || norm(nameOf(p.uid)).includes(norm(q)));
    const canNotify = !!(window.Notification && Notification.permission === 'default');

    /* day separators */
    let lastDay = '';
    const rows = [];
    msgs.forEach((m, i) => {
      const day = U.fmtDay ? U.fmtDay(U.ymd(new Date(m.at))) : U.ymd(new Date(m.at));
      if (day !== lastDay) { rows.push(html`<div key=${'d' + i} class="chat-day"><span>${day === (U.fmtDay ? U.fmtDay(U.todayStr()) : U.todayStr()) ? 'today' : day}</span></div>`); lastDay = day; }
      const prev = msgs[i - 1];
      const cont = prev && prev.by === m.by && m.at - prev.at < 5 * 60000;
      rows.push(html`<div key=${m.id} class=${'chat-msg' + (cont ? ' cont' : '') + (m.by === uid ? ' mine' : '') + (mentionsMe(m, ctx, nameOf(uid)) ? ' hot' : '')}>
        ${cont ? html`<span class="chat-gap"/>` : html`<${UI.Avatar} id=${m.by} size=${30}/>`}
        <div class="grow" style=${{minWidth: 0}}>
          ${cont ? null : html`<div class="row nowrap" style=${{gap: '8px', alignItems: 'baseline'}}><span style=${{fontWeight: 500}}>${nameOf(m.by)}</span><span class="tiny ink62 num">${U.hhmm ? U.hhmm(new Date(m.at)) : new Date(m.at).toLocaleTimeString()}</span></div>`}
          <div class="chat-text"><${Rich} text=${m.text} names=${names}/>${m.edited ? html` <span class="tiny ink62">(edited)</span>` : null}</div>
        </div>
        ${m.by === uid ? html`<span class="chat-tools row nowrap">
          <button type="button" class="linky tiny" onClick=${() => { setEditing(m.id); setText(m.text); if (boxRef.current) boxRef.current.focus(); }}>Edit</button>
          <button type="button" class="linky tiny" onClick=${() => remove(ctx, room, m.id)}>Delete</button>
        </span>` : null}
      </div>`);
    });

    const list = html`<aside class="chat-list" id="chat-list">
      <div class="row between" style=${{marginBottom: '6px'}}><${UI.Micro} plain>rooms<//>
        <button type="button" class="linky tiny" id="chat-new-room" onClick=${() => setNaming(x => !x)}>New room</button></div>
      ${naming ? html`<div class="row nowrap" style=${{gap: '6px', marginBottom: '8px'}}>
        <input id="chat-room-name" class="input grow" placeholder="design, ops, swisse" value=${newName} onInput=${e => setNewName(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') create(); }} aria-label="Room name"/>
        <${UI.Btn} sm=${true} onClick=${create}>Make<//></div>` : null}
      ${rooms.map(r => { const n = unreadIn(ctx, r.id); return html`<button key=${r.id} type="button" class=${'chat-room' + (room === r.id ? ' active' : '')} onClick=${() => openRoom(r.id)}>
        <span class="grow"># ${r.name}</span>${n ? html`<span class="badge">${n}</span>` : null}</button>`; })}
      <div class="row between" style=${{margin: '14px 0 6px'}}><${UI.Micro} plain>people<//></div>
      <input id="chat-find" class="input" placeholder="Find someone" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Find someone" style=${{marginBottom: '6px'}}/>
      ${filtered.map(p => { const d = dmId(uid, p.uid); const n = unreadIn(ctx, d); return html`<button key=${p.uid} type="button" class=${'chat-room' + (room === d ? ' active' : '')} onClick=${() => openDm(p.uid)}>
        <${UI.Avatar} id=${p.uid} size=${24}/><span class="grow">${nameOf(p.uid)}</span>${isOn(p.uid) ? html`<span class="dot on" title="online"/>` : null}${n ? html`<span class="badge">${n}</span>` : null}</button>`; })}
      ${!people.length ? html`<div class="small ink62">Just you so far. Invite the team from Admin.</div>` : null}
    </aside>`;

    const pane = html`<section class="chat-pane" id="chat-pane">
      <div class="chat-head row between nowrap">
        <div class="row nowrap" style=${{gap: '8px', minWidth: 0}}>
          ${phone ? html`<button type="button" class="iconbtn" aria-label="Rooms" onClick=${() => setListOpen(true)}><${icons.more}/></button>` : null}
          <div style=${{minWidth: 0}}><div style=${{fontWeight: 600, fontSize: '17px', letterSpacing: '-.01em'}} id="chat-title">${title}</div>
            ${roomMeta && roomMeta.topic ? html`<div class="tiny ink62">${roomMeta.topic}</div>` : isDm(room) ? html`<div class="tiny ink62">${isOn(dmOther(room, uid)) ? 'online now' : 'direct message, only the two of you'}</div>` : html`<div class="tiny ink62">the whole team</div>`}</div>
        </div>
        ${canNotify ? html`<button type="button" class="linky tiny" id="chat-notify" onClick=${askNotify}>Turn on notices</button>` : null}
      </div>
      <div class="chat-scroll" id="chat-scroll">
        ${rows.length ? rows : html`<div class="chat-empty"><${UI.Empty} text=${isDm(room) ? 'Say hi. Only ' + nameOf(dmOther(room, uid)) + ' and you see this.' : 'Nothing here yet. Start the room.'}/></div>`}
        <div ref=${endRef}/>
      </div>
      <div class="chat-composer">
        ${editing ? html`<div class="tiny ink62" style=${{marginBottom: '4px'}}>Editing. Escape to stop.</div>` : null}
        <div class="row nowrap" style=${{gap: '8px', alignItems: 'flex-end'}}>
          <textarea ref=${boxRef} id="chat-input" class="input grow" rows=${1} placeholder=${'Message ' + title + '. @ a name, or @everyone'} value=${text}
            onInput=${e => setText(e.target.value)} onKeyDown=${onKey} aria-label="Message"/>
          <${UI.Btn} id="chat-send" disabled=${!text.trim()} onClick=${go}>${editing ? 'Save' : 'Send'}<//>
        </div>
      </div>
    </section>`;

    return html`<div class=${'chat' + (phone ? (listOpen ? ' show-list' : ' show-pane') : '')} id="chat">${list}${pane}</div>`;
  }

  M.rooms = {roomsOf, messagesOf, unreadIn, unreadRooms, inboxItems, dmId, isDm, dmOther, send, makeRoom, markRead, readMark};
  M.pages.Chat = Chat;
})();
