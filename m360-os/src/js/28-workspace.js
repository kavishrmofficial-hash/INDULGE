/* module: workspace. Google Workspace inside m360: mail, calendar and meetings, drive. On EdgeOne each
   person signs in with Google once (the server keeps their tokens) and everything comes through the
   m360 API. On the claude.ai page the connectors from Your day do the reading. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef, useCallback} = React;

  const standalone = () => !!(window.M360_STANDALONE && typeof window.M360_API === 'function');
  const api = (a, body) => window.M360_API(a, body || {});
  const fmtTime = iso => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'}); };
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'}); };
  const dayOf = iso => U.ymd(new Date(iso));
  const shortAgo = at => at ? U.timeAgo(at) : '';

  /* one status per page load, shared by every tab; refreshed after a connect */
  let statusCache = null;
  function useStatus() {
    const [st, setSt] = useState(statusCache);
    const load = useCallback(async () => {
      if (!standalone()) { setSt({configured: false, connected: false, none: true}); return; }
      try { const r = await api('googlestatus'); statusCache = r; setSt(r); } catch (e) { setSt({configured: false, connected: false, err: true}); }
    }, []);
    useEffect(() => { if (!statusCache) load(); }, []);
    /* back from Google: a query string says how it went */
    useEffect(() => {
      const qs = new URLSearchParams(location.search);
      if (!qs.has('google')) return;
      const ok = qs.get('google') === 'ok';
      M.toast(ok ? 'Google connected' : 'Google did not connect' + (qs.get('why') ? ' (' + qs.get('why') + ')' : ''), !ok);
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* fine */ }
      statusCache = null; load();
    }, []);
    return {st, reload: load};
  }

  function Connect({st, reload}) {
    const [busy, setBusy] = useState(false);
    const ctx = M.useCtx();
    const start = async () => {
      setBusy(true);
      try { const r = await api('googlestart', {back: location.hash || '#mail'}); location.href = r.url; }
      catch (e) { setBusy(false); M.toast((e && e.message) || 'Could not start', true); }
    };
    if (!st) return html`<${UI.Card}><${M.Thinking} label="Checking Google"/><//>`;
    if (st.none) return html`<${UI.Card} title="Google Workspace">
      <p class="small ink62" style=${{marginTop: 0}}>On this page Google comes through your claude.ai connectors. Open Home, Your day. On the team site each person signs in with Google once and mail, calendar and drive live here.</p>
      ${M.parts.YourDay ? html`<${M.parts.YourDay}/>` : null}
    <//>`;
    if (!st.configured) return html`<${UI.Card} title="Google Workspace" id="google-unconfigured">
      <p class="small ink62" style=${{marginTop: 0}}>${ctx.isFounder ? 'Set up the Google sign-in first: Admin, Google Workspace.' : 'Kaavish switches Google on from Admin. Once that is done, connect yours here.'}</p>
      ${ctx.isFounder ? html`<${UI.Btn} kind="sec" onClick=${() => M.nav('#admin')}>Open Admin<//>` : null}
    <//>`;
    return html`<${UI.Card} title="Connect your Google" id="google-connect">
      <p class="small ink62" style=${{marginTop: 0}}>One sign-in, then your inbox, calendar, meetings and drive are here. Only you see yours. m360 keeps your tokens on the server, never in the page.</p>
      <${UI.Btn} id="google-go" disabled=${busy} onClick=${start}>${busy ? 'Opening Google' : 'Sign in with Google'}<//>
    <//>`;
  }

  /* ---------- mail ---------- */
  function Mail({st, reload}) {
    const ctx = M.useCtx();
    const [q, setQ] = useState('');
    const [box, setBox] = useState('inbox');
    const [rows, setRows] = useState(null);
    const [err, setErr] = useState('');
    const [open, setOpen] = useState(null);
    const [compose, setCompose] = useState(null);
    const [busy, setBusy] = useState(false);
    const [next, setNext] = useState('');
    const timer = useRef(0);
    const query = useMemo(() => (q.trim() ? q.trim() + ' ' : '') + (box === 'inbox' ? 'in:inbox' : box === 'unread' ? 'is:unread' : box === 'sent' ? 'in:sent' : box === 'starred' ? 'is:starred' : ''), [q, box]);
    const load = useCallback(async (more) => {
      setBusy(true); setErr('');
      try {
        const r = await api('gmail', {q: query, max: 25, pageToken: more ? next : ''});
        setRows(more ? xs => (xs || []).concat(r.messages) : r.messages); setNext(r.next || '');
      } catch (e) { setErr((e && e.message) || 'Mail did not load'); if (e && e.code === 'google_off') reload(); }
      setBusy(false);
    }, [query, next, reload]);
    useEffect(() => { load(false); }, [query]);
    useEffect(() => { clearInterval(timer.current); timer.current = setInterval(() => { if (!document.hidden && !open && !compose) load(false); }, 120000); return () => clearInterval(timer.current); }, [load, open, compose]);
    const unread = (rows || []).filter(m => m.unread).length;
    const openMsg = async m => {
      setOpen({...m, loading: true});
      try { const full = await api('gmailread', {id: m.id}); setOpen(full); setRows(xs => (xs || []).map(x => x.id === m.id ? {...x, unread: false} : x)); }
      catch (e) { setOpen({...m, loading: false, err: (e && e.message) || 'Could not open'}); }
    };
    const mark = async (m, patch) => {
      try { await api('gmailmark', {id: m.id, ...patch}); setRows(xs => (xs || []).map(x => x.id === m.id ? {...x, ...('unread' in patch ? {unread: patch.unread} : {}), ...('starred' in patch ? {starred: patch.starred} : {})} : x).filter(x => !(patch.archive && x.id === m.id && box === 'inbox'))); if (patch.archive) setOpen(null); }
      catch (e) { M.toast((e && e.message) || 'That did not stick', true); }
    };
    return html`<div class="stack" style=${{gap: '12px'}}>
      <${UI.Card} id="mail-card">
        <div class="row" style=${{gap: '8px', flexWrap: 'wrap'}}>
          <input id="mail-q" class="input" style=${{flex: '1 1 220px'}} placeholder="Search mail" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Search mail"/>
          <${UI.Seg} sm=${true} ariaLabel="Mailbox" value=${box} onChange=${setBox} options=${[{v: 'inbox', label: 'Inbox'}, {v: 'unread', label: 'Unread'}, {v: 'starred', label: 'Starred'}, {v: 'sent', label: 'Sent'}]}/>
          <${UI.Btn} sm=${true} id="mail-compose" onClick=${() => setCompose({to: '', subject: '', text: ''})}>New mail<//>
          <button type="button" class="iconbtn" aria-label="Refresh" title="Refresh" onClick=${() => load(false)}><${icons.clock}/></button>
        </div>
        <div class="row between small ink62" style=${{marginTop: '8px'}}><span>${st.who}</span><span>${unread ? unread + ' unread here' : ''}</span></div>
        ${err ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${err}</div>` : null}
        ${rows === null ? html`<div style=${{marginTop: '10px'}}><${M.Thinking} label="Fetching mail"/></div>`
          : rows.length ? html`<div class="list" id="mail-list" style=${{marginTop: '10px'}}>
            ${rows.map(m => html`<button key=${m.id} type="button" class=${'listrow mail-row' + (m.unread ? ' unread' : '')} onClick=${() => openMsg(m)}>
              <span class="mail-from">${m.fromName || m.fromAddress || m.from}</span>
              <span class="grow mail-subj" style=${{minWidth: 0}}><span>${m.subject}</span><span class="ink62 mail-snip"> ${m.snippet}</span></span>
              <span class="tiny ink62 num">${shortAgo(m.at)}</span>
            </button>`)}
          </div>` : html`<div style=${{marginTop: '10px'}}><${UI.Empty} text="Nothing here."/></div>`}
        ${next ? html`<button type="button" class="linky small" style=${{marginTop: '8px'}} disabled=${busy} onClick=${() => load(true)}>More</button>` : null}
      <//>
      ${open ? html`<${MessageDrawer} m=${open} onClose=${() => setOpen(null)} onMark=${mark} onReply=${() => { setCompose({to: open.fromAddress || open.from, subject: /^re:/i.test(open.subject) ? open.subject : 'Re: ' + open.subject, text: '', threadId: open.threadId, inReplyTo: open.messageId, quote: open.text}); }}/>` : null}
      ${compose ? html`<${Compose} draft=${compose} me=${st.who} onClose=${() => setCompose(null)} onSent=${() => { setCompose(null); setOpen(null); load(false); }}/>` : null}
    </div>`;
  }

  function MessageDrawer({m, onClose, onMark, onReply}) {
    const safeHtml = m.html ? '<base target="_blank"><style>body{font:15px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#0a0a0a;margin:0;padding:4px;word-break:break-word}img{max-width:100%;height:auto}</style>' + m.html : '';
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${m.subject || 'Message'}
      footer=${html`<span class="row nowrap" style=${{gap: '8px'}}>
        <${UI.Btn} id="mail-reply" onClick=${onReply}>Reply<//>
        <${UI.Btn} kind="sec" onClick=${() => onMark(m, {archive: true})}>Archive<//>
        <${UI.Btn} kind="ghost" onClick=${() => onMark(m, {starred: !m.starred})}>${m.starred ? 'Unstar' : 'Star'}<//>
        <${UI.Btn} kind="ghost" onClick=${() => onMark(m, {unread: true})}>Keep unread<//>
      </span>`}>
      <div class="row between small" style=${{gap: '8px'}}><div><span style=${{fontWeight: 500}}>${m.fromName || m.fromAddress}</span> <span class="ink62">${m.fromAddress && m.fromName ? '<' + m.fromAddress + '>' : ''}</span></div><span class="ink62 num">${m.date ? fmtDate(m.date) + ' ' + fmtTime(m.date) : ''}</span></div>
      ${m.to ? html`<div class="tiny ink62">to ${m.to}${m.cc ? ', cc ' + m.cc : ''}</div>` : null}
      <hr class="hair"/>
      ${m.loading ? html`<${M.Thinking} label="Opening"/>` : m.err ? html`<div class="small flame-t">${m.err}</div>`
        : safeHtml ? html`<iframe class="mail-frame" sandbox="" srcdoc=${safeHtml} title="Message"/>`
        : html`<div class="mail-body" style=${{whiteSpace: 'pre-wrap'}}>${m.text || m.snippet}</div>`}
      ${(m.attachments || []).length ? html`<div class="row" style=${{gap: '6px', marginTop: '10px', flexWrap: 'wrap'}}>${m.attachments.map((a, i) => html`<${UI.Pill} key=${i} kind="warm">${a.name}<//>`)}</div>` : null}
    <//>`;
  }

  function Compose({draft, me, onClose, onSent}) {
    const [f, setF] = useState(draft);
    const [busy, setBusy] = useState(false);
    const set = k => v => setF(x => ({...x, [k]: v}));
    const send = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const text = f.text + (f.quote ? '\n\n' + f.quote.split('\n').map(l => '> ' + l).join('\n') : '');
        await api('gmailsend', {to: f.to, cc: f.cc || '', subject: f.subject, text, threadId: f.threadId || '', inReplyTo: f.inReplyTo || ''});
        M.toast('Sent'); onSent();
      } catch (e) { setBusy(false); M.toast((e && e.message) || 'Not sent', true); }
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${draft.threadId ? 'Reply' : 'New mail'}
      footer=${html`<${UI.Btn} id="mail-send" disabled=${busy || !f.to.trim() || !f.text.trim()} onClick=${send}>${busy ? 'Sending' : 'Send'}<//>`}>
      <div class="tiny ink62">from ${me}</div>
      <${UI.Input} id="mail-to" label="to" value=${f.to} onChange=${set('to')} placeholder="name@company.com, another@company.com"/>
      <${UI.Input} id="mail-subject" label="subject" value=${f.subject} onChange=${set('subject')}/>
      <${UI.TextArea} id="mail-text" label="message" rows=${8} value=${f.text} onChange=${set('text')} placeholder="Write it plainly."/>
      ${f.quote ? html`<div class="tiny ink62">The message you are replying to rides along below yours.</div>` : null}
    <//>`;
  }

  /* ---------- calendar and meetings ---------- */
  function Calendar({st, reload}) {
    const ctx = M.useCtx();
    const [events, setEvents] = useState(null);
    const [err, setErr] = useState('');
    const [span, setSpan] = useState('week');
    const [making, setMaking] = useState(false);
    const load = useCallback(async () => {
      setErr('');
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + (span === 'today' ? 1 : span === 'week' ? 7 : 30) * 86400000);
      try { const r = await api('gcal', {from: from.toISOString(), to: to.toISOString()}); setEvents(r.events); }
      catch (e) { setErr((e && e.message) || 'Calendar did not load'); if (e && e.code === 'google_off') reload(); }
    }, [span, reload]);
    useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 180000); return () => clearInterval(t); }, [load]);
    const now = Date.now();
    const byDay = {};
    (events || []).forEach(e => { const d = dayOf(e.start); (byDay[d] = byDay[d] || []).push(e); });
    const days = Object.keys(byDay).sort();
    const rsvp = async (e, status) => { try { await api('gcalrsvp', {id: e.id, status}); M.toast(status === 'accepted' ? 'Accepted' : status === 'declined' ? 'Declined' : 'Maybe'); load(); } catch (x) { M.toast((x && x.message) || 'That did not stick', true); } };
    const soon = e => { const s = new Date(e.start).getTime(); return s - now < 15 * 60000 && new Date(e.end).getTime() > now; };
    return html`<div class="stack" style=${{gap: '12px'}}>
      <${UI.Card} id="cal-card" title="Meetings" action=${html`<span class="row nowrap" style=${{gap: '6px'}}>
          <${UI.Seg} sm=${true} ariaLabel="Span" value=${span} onChange=${setSpan} options=${[{v: 'today', label: 'Today'}, {v: 'week', label: '7 days'}, {v: 'month', label: '30 days'}]}/>
          <${UI.Btn} sm=${true} id="cal-new" onClick=${() => setMaking(true)}>New meeting<//></span>`}>
        ${err ? html`<div class="small flame-t">${err}</div>` : null}
        ${events === null ? html`<${M.Thinking} label="Fetching the calendar"/>`
          : !days.length ? html`<${UI.Empty} text="Nothing on the calendar in this span."/>`
          : days.map(d => html`<div key=${d} class="cal-day">
            <div class="micro" style=${{marginTop: '6px'}}>${d === U.todayStr() ? 'today' : fmtDate(d)}</div>
            ${byDay[d].map(e => html`<div key=${e.id} class=${'cal-ev' + (soon(e) ? ' soon' : '') + (new Date(e.end).getTime() < now ? ' past' : '')} id=${'ev-' + e.id}>
              <div class="cal-time num">${e.allDay ? 'all day' : fmtTime(e.start) + (e.end ? ' to ' + fmtTime(e.end) : '')}</div>
              <div class="grow" style=${{minWidth: 0}}>
                <div style=${{fontWeight: 500}}>${e.title}</div>
                <div class="tiny ink62">${[e.organizer && !e.mine ? 'by ' + e.organizer : '', e.attendees.length ? e.attendees.length + ' people' : '', e.location].filter(Boolean).join(' · ')}</div>
                ${!e.mine && e.myStatus === 'needsAction' ? html`<div class="row" style=${{gap: '6px', marginTop: '6px'}}>
                  <button type="button" class="chip" onClick=${() => rsvp(e, 'accepted')}>Yes</button><button type="button" class="chip" onClick=${() => rsvp(e, 'tentative')}>Maybe</button><button type="button" class="chip" onClick=${() => rsvp(e, 'declined')}>No</button></div>` : null}
              </div>
              ${e.meet ? html`<a class="btn sm" href=${e.meet} target="_blank" rel="noopener">Join Meet</a>` : e.link ? html`<a class="btn sec sm" href=${e.link} target="_blank" rel="noopener">Open</a>` : null}
            </div>`)}
          </div>`)}
      <//>
      ${making ? html`<${NewMeeting} onClose=${() => setMaking(false)} onMade=${() => { setMaking(false); load(); }}/>` : null}
    </div>`;
  }

  function NewMeeting({onClose, onMade}) {
    const ctx = M.useCtx();
    const [f, setF] = useState(() => { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); return {title: '', date: U.ymd(d), start: U.hhmm ? U.hhmm(d) : d.toTimeString().slice(0, 5), mins: 30, who: '', meet: true, description: ''}; });
    const [team, setTeam] = useState({});
    const [busy, setBusy] = useState(false);
    const set = k => v => setF(x => ({...x, [k]: v}));
    useEffect(() => { api('teamemails').then(r => setTeam(r.people || {})).catch(() => {}); }, []);
    const chips = Object.keys(team).filter(u => u !== ctx.uid);
    const add = addr => setF(x => ({...x, who: (x.who.trim() ? x.who.trim().replace(/,\s*$/, '') + ', ' : '') + addr}));
    const make = async () => {
      if (busy || !f.title.trim()) return;
      setBusy(true);
      const start = new Date(f.date + 'T' + f.start + ':00');
      const end = new Date(start.getTime() + (Number(f.mins) || 30) * 60000);
      try {
        const r = await api('gcalcreate', {title: f.title, start: start.toISOString(), end: end.toISOString(), attendees: f.who.split(/[,;\s]+/).filter(Boolean), meet: f.meet, description: f.description});
        M.toast(r.meet ? 'Meeting made, Meet link ready' : 'Meeting made');
        onMade(r);
      } catch (e) { setBusy(false); M.toast((e && e.message) || 'Not made', true); }
    };
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="New meeting"
      footer=${html`<${UI.Btn} id="cal-make" disabled=${busy || !f.title.trim()} onClick=${make}>${busy ? 'Making' : 'Make the meeting'}<//>`}>
      <${UI.Input} id="cal-title" label="what" value=${f.title} onChange=${set('title')} placeholder="Swisse creative review"/>
      <div class="grid2">
        <${UI.Input} label="date" type="date" value=${f.date} onChange=${set('date')}/>
        <${UI.Input} label="start" type="time" value=${f.start} onChange=${set('start')}/>
      </div>
      <${UI.Field} label="length"><${UI.Seg} sm=${true} ariaLabel="Length" value=${String(f.mins)} onChange=${v => set('mins')(Number(v))} options=${[{v: '15', label: '15'}, {v: '30', label: '30'}, {v: '45', label: '45'}, {v: '60', label: '60'}]}/><//>
      <${UI.Input} id="cal-who" label="who, emails" value=${f.who} onChange=${set('who')} placeholder="priya@client.com, durvesh@mask360.agency"/>
      ${chips.length ? html`<div class="row" style=${{gap: '6px', flexWrap: 'wrap'}}>${chips.map(u => html`<button key=${u} type="button" class="chip" onClick=${() => add(team[u].addr)}>${(team[u].name || team[u].addr).split(' ')[0]}</button>`)}</div>` : null}
      <${UI.Field} label="google meet"><${UI.Seg} sm=${true} ariaLabel="Meet" value=${f.meet ? 'on' : 'off'} onChange=${v => set('meet')(v === 'on')} options=${[{v: 'on', label: 'Add a Meet link'}, {v: 'off', label: 'No link'}]}/><//>
      <${UI.TextArea} label="agenda, optional" rows=${3} value=${f.description} onChange=${set('description')}/>
    <//>`;
  }

  /* ---------- drive ---------- */
  function Drive({st, reload}) {
    const [q, setQ] = useState('');
    const [files, setFiles] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      const t = setTimeout(async () => {
        setErr('');
        try { const r = await api('gdrive', {q: q.trim()}); setFiles(r.files); }
        catch (e) { setErr((e && e.message) || 'Drive did not load'); if (e && e.code === 'google_off') reload(); }
      }, q ? 350 : 0);
      return () => clearTimeout(t);
    }, [q]);
    const kind = mime => /spreadsheet|excel/.test(mime) ? 'sheet' : /presentation|powerpoint/.test(mime) ? 'deck' : /document|word/.test(mime) ? 'doc' : /pdf/.test(mime) ? 'pdf' : /image/.test(mime) ? 'image' : /folder/.test(mime) ? 'folder' : 'file';
    return html`<${UI.Card} id="drive-card" title="Drive">
      <input id="drive-q" class="input" placeholder="Find a file" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Find a file"/>
      ${err ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${err}</div>` : null}
      ${files === null ? html`<div style=${{marginTop: '10px'}}><${M.Thinking} label="Fetching files"/></div>`
        : files.length ? html`<div class="list" id="drive-list" style=${{marginTop: '10px'}}>${files.map(f => html`<a key=${f.id} class="listrow" href=${f.link} target="_blank" rel="noopener">
            <${UI.Pill} kind="warm">${kind(f.mime)}<//><span class="grow" style=${{minWidth: 0}}>${f.name}</span><span class="tiny ink62">${f.owner ? f.owner.split(' ')[0] + ' · ' : ''}${f.modified ? U.timeAgo(new Date(f.modified).getTime()) : ''}</span></a>`)}</div>`
        : html`<div style=${{marginTop: '10px'}}><${UI.Empty} text="No files match."/></div>`}
      <p class="tiny ink62" style=${{marginTop: '10px'}}>Google opens documents in their own tab; that is Google's rule, not ours.</p>
    <//>`;
  }

  /* ---------- the page ---------- */
  function Workspace({tab}) {
    const {st, reload} = useStatus();
    const t = tab || 'mail';
    const ready = st && st.connected;
    return html`<div class="stack" style=${{gap: '20px'}}>
      <${M.SectionHero} micro="workspace" title="Workspace" sub=${ready ? st.who : 'mail, calendar, meetings, drive'}>
        ${ready ? html`<button type="button" class="linky small" id="google-disconnect" onClick=${async () => { await api('googledisconnect').catch(() => {}); statusCache = null; reload(); M.toast('Google disconnected'); }}>Disconnect Google</button>` : null}
      <//>
      <${M.SectionTabs} section="workspace" active=${t}/>
      ${!ready ? html`<${Connect} st=${st} reload=${reload}/>`
        : t === 'gcal' ? html`<${Calendar} st=${st} reload=${reload}/>` : t === 'drive' ? html`<${Drive} st=${st} reload=${reload}/>` : html`<${Mail} st=${st} reload=${reload}/>`}
    </div>`;
  }

  /* ---------- Admin: the OAuth client ---------- */
  function GoogleCard() {
    const [st, setSt] = useState(null);
    const [id, setId] = useState('');
    const [key2, setKey2] = useState('');
    const [busy, setBusy] = useState(false);
    const load = () => api('googlestatus').then(r => { setSt(r); setId(r.clientId || ''); }).catch(() => setSt({}));
    useEffect(() => { load(); }, []);
    const save = async () => {
      setBusy(true);
      try { await api('googlekey', {clientId: id.trim(), clientKey: key2.trim()}); setKey2(''); statusCache = null; M.toast(id.trim() ? 'Google is set up. Everyone can connect from Workspace' : 'Google removed'); load(); }
      catch (e) { M.toast((e && e.message) || 'Not saved', true); }
      setBusy(false);
    };
    const copy = () => { try { navigator.clipboard.writeText(st.redirect); M.toast('Copied'); } catch (e) { /* select it by hand */ } };
    if (!st) return html`<${UI.Card} id="google-card"><${M.Thinking} label="Checking"/><//>`;
    return html`<${UI.Card} id="google-card">
      <div class="row between"><span class="small">${st.configured ? html`<${UI.Pill} kind="ink">on<//>` : html`<${UI.Pill}>off<//>`} ${st.fromEnv ? 'set on the server' : st.configured ? 'client saved' : 'no client yet'}</span></div>
      <ol class="small" style=${{paddingLeft: '18px', margin: '10px 0'}}>
        <li>Open console.cloud.google.com with the mask360.agency account. Make a project called m360.</li>
        <li>APIs and Services, Library: enable Gmail API, Google Calendar API and Google Drive API.</li>
        <li>OAuth consent screen: choose Internal (that is what a Workspace organisation gets, no review, no expiry). App name m360 OS.</li>
        <li>Credentials, Create credentials, OAuth client ID, type Web application. Under Authorised redirect URIs paste exactly:
          <div class="row nowrap" style=${{gap: '6px', marginTop: '4px'}}><code class="grow" style=${{overflow: 'auto'}} id="google-redirect">${st.redirect}</code><${UI.Btn} kind="sec" sm=${true} onClick=${copy}>Copy<//></div></li>
        <li>Paste the client ID and the client key below. Then everyone connects their own Google from Workspace.</li>
      </ol>
      <${UI.Input} id="google-id" label="client id" value=${id} onChange=${setId} placeholder="1234567890-abc.apps.googleusercontent.com"/>
      <${UI.Input} id="google-key" label=${st.configured ? 'client key (the GOCSPX value), leave blank to keep the saved one' : 'client key (the GOCSPX value next to the ID)'} value=${key2} onChange=${setKey2} placeholder="GOCSPX-..."/>
      <div class="row" style=${{gap: '8px'}}>
        <${UI.Btn} id="google-save" disabled=${busy} onClick=${save}>${st.configured ? 'Save' : 'Switch Google on'}<//>
        ${st.configured && !st.fromEnv ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${() => { setId(''); setKey2(''); api('googlekey', {clientId: ''}).then(() => { statusCache = null; load(); M.toast('Google removed'); }); }}>Remove<//>` : null}
      </div>
    <//>`;
  }

  M.pages.Workspace = Workspace;
  if (standalone()) M.parts.GoogleCard = GoogleCard;
  M.workspace = {fmtTime, fmtDate};
})();
