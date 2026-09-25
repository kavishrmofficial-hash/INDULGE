/* module: chat. The team's own chat: rooms (general, plus any the team makes) and direct messages.
   Messages live per room per sender (chat/<room>:<uid> {msgs}), so two people never overwrite each other;
   a room view merges every sender's doc by time. When a sender's doc passes 300 lines, the oldest go to
   chatlog/<room>:<uid>:<ts>. Read markers sit in the person's private state (chatRead). A direct message
   room is dm.<a>.<b> (sorted); on EdgeOne the server lets only those two read it. Any file can ride along
   with a line (files: [{id, name, type, size, url}]): on the team site it goes up in parts to /api/file, on
   claude.ai into the page's assets. ChatWatch, mounted everywhere, turns a line for you into a notice. */
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

  async function send(ctx, room, text, mentions, files) {
    const t = String(text || '').trim().slice(0, 4000);
    const fs = (files || []).filter(f => f && f.url).slice(0, 10).map(f => ({id: String(f.id || ''), name: String(f.name || 'file').slice(0, 160), type: String(f.type || ''), size: Number(f.size) || 0, url: String(f.url)}));
    if (!t && !fs.length) return;
    const key = docId(room, ctx.uid);
    const cur = ((ctx.coll.chat.map[key] || {}).msgs || []).slice();
    const m = {id: U.uid(), at: Date.now(), text: t, mentions: mentions || []};
    if (fs.length) m.files = fs;
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

  /* ---------- attachments: any file, up in parts on the team site, into assets on claude.ai ---------- */
  const FILE_MAX = 25 * 1024 * 1024;
  const RAW_PART = 720 * 1024;   /* bytes per part, under the server's base64 limit */
  const standalone = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');
  const fmtSize = n => n < 1024 ? n + ' B' : n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (Math.round(n / 1024 / 1024 * 10) / 10) + ' MB';
  const isImage = f => /^image\//.test(f.type || '') && !/svg/.test(f.type || '');
  const isAudio = f => /^audio\//.test(f.type || '');
  const isVideo = f => /^video\//.test(f.type || '');
  const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(blob); });
  const QS = () => { try { return location.search && location.search.length > 1 ? '&' + location.search.slice(1) : ''; } catch (e) { return ''; } };
  async function upload(file, room, onStep) {
    if (!file) throw new Error('no file');
    if (file.size > FILE_MAX) throw new Error('Files up to 25 MB.');
    const size = file.size || 0;
    if (standalone()) {
      const total = Math.max(1, Math.ceil(size / RAW_PART));
      let id = '';
      let out = null;
      for (let i = 0; i < total; i++) {
        if (onStep) onStep(i, total);
        const data = size ? await b64(file.slice(i * RAW_PART, Math.min(size, (i + 1) * RAW_PART))) : '';
        out = await window.M360_API('fileput', {id, name: file.name, type: file.type || 'application/octet-stream', size: size || 1, part: i, total, data, room});
        id = out.id;
      }
      return {id, name: file.name, type: file.type || 'application/octet-stream', size, url: out.url + QS()};
    }
    const assets = await window.claude.use('assets');
    if (!assets) throw new Error('Attachments work on the team site. This page cannot keep files.');
    if (onStep) onStep(0, 1);
    const r = await assets.upload(file);
    return {id: r.id, name: file.name, type: r.contentType || file.type || 'application/octet-stream', size: r.sizeBytes || size, url: r.url};
  }
  M.files = {upload, fmtSize, isImage, isAudio, isVideo, FILE_MAX};

  /* a file on a line: pictures inline, sound and video with controls, everything else a card */
  function FileLine({f}) {
    const dl = standalone() ? f.url + '&dl=1' : f.url;
    if (isImage(f)) return html`<a class="chat-img-link" href=${f.url} target="_blank" rel="noopener" data-out="1" title=${f.name}><img class="chat-img" src=${f.url} alt=${f.name} loading="lazy"/></a>`;
    if (isAudio(f)) return html`<div class="chat-file media"><audio controls preload="none" src=${f.url}/><a class="tiny" href=${dl} download=${f.name} data-out="1">${f.name}</a></div>`;
    if (isVideo(f)) return html`<div class="chat-file media"><video controls preload="metadata" src=${f.url} playsInline/><a class="tiny" href=${dl} download=${f.name} data-out="1">${f.name}</a></div>`;
    return html`<a class="chat-file" href=${dl} download=${f.name} data-out="1" title=${'Download ' + f.name}>
      <span class="chat-file-ico"><${icons.upload}/></span>
      <span class="grow" style=${{minWidth: 0}}><span class="chat-file-name">${f.name}</span><span class="tiny ink62">${(f.type || '').split('/')[1] || 'file'}${f.size ? ' · ' + fmtSize(f.size) : ''}</span></span>
      <span class="tiny ink62">Download</span>
    </a>`;
  }

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
    /* the room you were in last, remembered per person; a direct message you are not part of never opens */
    const [room, setRoom] = useState(() => { const r = roomFromRoute || M.prefs.get('chatRoom.' + uid, '') || 'general'; return (isDm(r) && !r.split('.').includes(uid)) ? 'general' : r; });
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [naming, setNaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [editing, setEditing] = useState(null);
    const [listOpen, setListOpen] = useState(!roomFromRoute);
    const [pending, setPending] = useState([]);      /* files picked, not sent yet */
    const [busy, setBusy] = useState('');            /* 'Uploading 1 of 2' while sending */
    const [over, setOver] = useState(false);
    const endRef = useRef(null);
    const boxRef = useRef(null);
    const fileRef = useRef(null);
    const phone = M.usePhone();
    /* the route decides: a room in it opens that room; none means the list (the Chat tab on a phone) */
    useEffect(() => { if (roomFromRoute) { if (roomFromRoute !== room) setRoom(roomFromRoute); setListOpen(false); } else setListOpen(true); }, [roomFromRoute]);
    useEffect(() => { M.prefs.set('chatRoom.' + uid, room); }, [room]);
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

    const mentionIds = t => ctx.activeMembers.filter(m => String(t).includes('@' + nameOf(m.uid)) || String(t).includes('@' + String(nameOf(m.uid)).split(' ')[0] + ' ')).map(m => m.uid);
    const pick = list => {
      const add = Array.from(list || []).filter(Boolean);
      if (!add.length) return;
      const big = add.find(f => f.size > FILE_MAX);
      if (big) { M.toast(big.name + ' is over 25 MB', true); return; }
      setPending(p => p.concat(add).slice(0, 10));
    };
    const go = async () => {
      const t = text.trim();
      if (!t && !pending.length) return;
      if (busy) return;
      if (editing) { if (!t) return; setText(''); await edit(ctx, room, editing, t).catch(() => {}); setEditing(null); return; }
      const files = [];
      try {
        for (let i = 0; i < pending.length; i++) {
          setBusy('Uploading ' + (i + 1) + ' of ' + pending.length);
          files.push(await upload(pending[i], room, (part, total) => { if (total > 1) setBusy('Uploading ' + (i + 1) + ' of ' + pending.length + ', part ' + (part + 1) + ' of ' + total); }));
        }
      } catch (e) { setBusy(''); M.toast((e && e.message) || 'That file did not go up', true); return; }
      setBusy(''); setText(''); setPending([]);
      await send(ctx, room, t, mentionIds(t), files).catch(() => { setText(t); M.toast('Not sent. Try again.', true); });
      M.sound.play('soft');
    };
    const onPaste = e => { const fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); pick(fs); } };
    const onDrop = e => { e.preventDefault(); setOver(false); pick(e.dataTransfer && e.dataTransfer.files); };
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
          ${m.text ? html`<div class="chat-text"><${Rich} text=${m.text} names=${names}/>${m.edited ? html` <span class="tiny ink62">(edited)</span>` : null}</div>` : null}
          ${(m.files || []).length ? html`<div class="chat-files">${m.files.map((f, k) => html`<${FileLine} key=${k} f=${f}/>`)}</div>` : null}
        </div>
        ${m.by === uid ? html`<span class="chat-tools row nowrap">
          ${m.text ? html`<button type="button" class="linky tiny" onClick=${() => { setEditing(m.id); setText(m.text); if (boxRef.current) boxRef.current.focus(); }}>Edit</button>` : null}
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

    const pane = html`<section class=${'chat-pane' + (over ? ' over' : '')} id="chat-pane" onDragOver=${e => { e.preventDefault(); if (!over) setOver(true); }} onDragLeave=${e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }} onDrop=${onDrop}>
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
        ${pending.length ? html`<div class="chat-attach" id="chat-attach">${pending.map((f, i) => html`<span key=${i} class="chip"><span class="chat-file-name">${f.name}</span><span class="tiny ink62"> ${fmtSize(f.size)}</span><button type="button" class="chip-x" aria-label=${'Remove ' + f.name} onClick=${() => setPending(p => p.filter((_, k) => k !== i))}><${icons.x}/></button></span>`)}</div>` : null}
        ${busy ? html`<div class="tiny ink62" id="chat-busy" style=${{marginBottom: '4px'}}>${busy}</div>` : null}
        <div class="row nowrap" style=${{gap: '8px', alignItems: 'flex-end'}}>
          <input ref=${fileRef} type="file" id="chat-file" multiple style=${{display: 'none'}} onChange=${e => { pick(e.target.files); e.target.value = ''; }} aria-label="Attach files"/>
          <button type="button" class="iconbtn" id="chat-attach-btn" aria-label="Attach a file" title="Attach any file, up to 25 MB" disabled=${!!busy || !!editing} onClick=${() => fileRef.current && fileRef.current.click()}><${icons.plus}/></button>
          <textarea ref=${boxRef} id="chat-input" class="input grow" rows=${1} placeholder=${'Message ' + title + '. @ a name, or @everyone. Drop or paste files here'} value=${text}
            onInput=${e => setText(e.target.value)} onKeyDown=${onKey} onPaste=${onPaste} aria-label="Message"/>
          <${UI.Btn} id="chat-send" disabled=${(!text.trim() && !pending.length) || !!busy} onClick=${go}>${editing ? 'Save' : 'Send'}<//>
        </div>
      </div>
    </section>`;

    return html`<div class=${'chat' + (phone ? (listOpen ? ' show-list' : ' show-pane') : '')} id="chat">${list}${pane}</div>`;
  }

  /* ---------- the watcher: a line for you becomes a notice, wherever you are in m360 ---------- */
  const noticeAll = () => M.prefs.get('noticeAll', '0') === '1';
  function ChatWatch() {
    const ctx = M.useCtx();
    const uid = ctx.uid;
    const seenAt = useRef(Date.now());
    const ids = useMemo(() => ctx.activeMembers.map(m => m.uid), [ctx.activeMembers]);
    const profs = M.useProfiles(ids);
    const nameOf = id => (profs[id] && profs[id].name) || (ctx.members[id] && ctx.members[id].name) || 'Someone';
    useEffect(() => {
      if (!uid || !ctx.coll.chat.ready) return;
      const rooms = roomsOf(ctx);
      const roomName = id => ((rooms.find(r => r.id === id) || {}).name || id);
      const hm = /^#chat\/(.+)$/.exec(location.hash);
      const openRoom = hm ? decodeURIComponent(hm[1]) : (location.hash === '#chat' ? (M.prefs.get('chatRoom.' + uid, '') || 'general') : '');
      const since = seenAt.current;
      seenAt.current = Date.now();
      const fresh = [];
      const all = rooms.map(r => r.id).concat(dmRoomsOf(ctx));
      for (const room of all) {
        for (const m of messagesOf(ctx, room)) {
          if (m.by === uid || (m.at || 0) <= since || Date.now() - (m.at || 0) > 90000) continue;
          const dm = isDm(room);
          const forMe = dm || mentionsMe(m, ctx, nameOf(uid));
          if (!forMe && !noticeAll()) continue;
          if (room === openRoom && !document.hidden) continue;
          fresh.push({room, m, dm});
        }
      }
      if (!fresh.length) return;
      fresh.sort((a, b) => (a.m.at || 0) - (b.m.at || 0));
      for (const it of fresh.slice(-3)) {
        const files = (it.m.files || []);
        const body = it.m.text || (files.length ? 'Sent ' + (files.length === 1 ? files[0].name : files.length + ' files') : 'New message');
        M.notices.push({key: 'chat:' + it.m.id, who: it.m.by, title: nameOf(it.m.by) + (it.dm ? '' : ' in #' + roomName(it.room)), body, hidden: it.dm ? 'New message' : 'New message in #' + roomName(it.room), href: '#chat/' + it.room});
      }
      M.sound.play('soft');
    }, [ctx.coll.chat, uid]);
    return null;
  }

  M.rooms = {roomsOf, messagesOf, unreadIn, unreadRooms, inboxItems, dmId, isDm, dmOther, send, makeRoom, markRead, readMark, noticeAll};
  M.pages.Chat = Chat;
  M.parts.ChatWatch = ChatWatch;
})();
