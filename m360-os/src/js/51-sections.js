/* module: sections. Work, Accounts, Vibe, Me and Admin: a colourful hero with live numbers,
   simple tabs, and the working screens underneath. Plus the AI tools that deploy work. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo} = React;

  const Embed = ({page, id}) => {
    const P = M.pages[page];
    return P ? html`<div class="embedded"><${P} id=${id || null}/></div>` : null;
  };
  /* v40: the design's lede under a section title (design/m360-os-v7.html .lede): the section's live numbers in one
     line, and what needs you in flame with an arrow that glides to it */
  const goTo = sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (M.chrome && M.chrome.glideTo) M.chrome.glideTo(el, () => { M.chrome.flash([el]); if (M.mark && M.mark.lookAt) M.mark.lookAt(el); });
    else el.scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  const Lede = ({parts, need, needLabel, target, children}) => html`<p class="lede">
    ${parts && parts.length ? html`<span class="lede-n">${parts.map((x, i) => html`<${React.Fragment} key=${i}>${i ? ', ' : ''}<b class="num">${x.v}</b> ${x.l}<//>`)}.</span>` : null}
    ${need > 0 ? html`<button type="button" class="needl" onClick=${() => goTo(target)}><b class="num">${need}</b> ${needLabel}<i class="ar"/></button>` : null}
    ${children || null}
  </p>`;
  const today = () => U.dateLabel(new Date()).toLowerCase();
  const SPARK = '\u2726';
  /* the effects, standing down to the plain element when the fx layer is missing */
  const fx = () => M.fx || null;
  const Metal = ({kind, block, children}) => fx() ? html`<${fx().Metal} kind=${kind || 'ink'} block=${block}>${children}<//>` : children;
  const Beam = ({children, radius}) => fx() ? html`<${fx().Beam} radius=${radius}>${children}<//>` : children;
  const Bot = ({feature, working, size}) => fx() ? html`<${fx().Bot} feature=${feature} state=${working ? 'working' : 'default'} size=${size || 28} label=${working ? 'm360, working' : 'm360'}/>` : null;

  /* ---------- AI: turn a brief into assigned tasks ---------- */
  function BriefToTasks({onClose}) {
    const ctx = M.useCtx();
    const [brief, setBrief] = useState('');
    const [project, setProject] = useState('');
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const [unread, setUnread] = useState('');
    const r = M.ai.useRun();
    const projects = Object.keys(ctx.coll.projects.map).map(id => ({id, ...ctx.coll.projects.map[id]})).filter(p => !p.archived && p.status !== 'done');
    const people = ctx.activeMembers;
    const profs = M.useProfiles(people.map(m => m.uid));

    async function breakDown() {
      setUnread('');
      const nm = await M.ai.names(ctx);
      const tasks = ctx.coll.tasks.map;
      const load = people.map(m => {
        const open = Object.keys(tasks).filter(id => tasks[id].owner === m.uid && tasks[id].status !== 'done').length;
        return '- ' + nm[m.uid] + ', ' + (m.title || m.role) + (m.pod ? ', ' + m.pod : '') + ', ' + open + ' open tasks' + (ctx.onLeave(m.uid, U.todayStr()) ? ', on leave today' : '');
      }).join('\n');
      const p = project ? ctx.coll.projects.map[project] : null;
      const out = await r.run(o => M.ai.json(ctx,
        'Break this brief into 4 to 10 concrete tasks a boutique luxury agency team would ship. Assign each to the best fit ' +
        'by role and current load (spread the work, never pile onto one person). Set realistic due dates from today (' + U.todayStr() + '), ' +
        'working days are Monday to Saturday. ' + (p ? 'Use these project sections where they fit: ' + (p.sections || []).map(s => s.name).join(', ') + '. ' : '') +
        'Reply with only a JSON array of {"title": "starts with a verb", "owner": "first name", "due": "YYYY-MM-DD", "section": "section name or empty", "why": "under 12 words"}.\n\n' +
        'TEAM AND LOAD:\n' + load + '\n\nBRIEF:\n' + brief.slice(0, 6000), {signal: o.signal, cache: false}));
      /* v39: a list wrapped in an object ({"tasks": [...]}) is read too; an answer with no tasks in it says so */
      const list = Array.isArray(out) ? out : (out && typeof out === 'object' ? (Object.values(out).find(Array.isArray) || null) : null);
      const usable = (list || []).filter(t => t && typeof t === 'object' && String(t.title || '').trim());
      if (out != null && !usable.length) setUnread('The answer held no tasks m360 could read. Tap Break it down to try again.');
      if (usable.length) {
        setRows(usable.slice(0, 12).map((t, i) => {
          const owner = M.ai.findMember(ctx, nm, t.owner) || ctx.uid;
          const sec = p ? ((p.sections || []).find(s => String(s.name).toLowerCase() === String(t.section || '').toLowerCase()) || (p.sections || [])[0] || {}).id || '' : '';
          return {k: i, on: true, title: String(t.title || '').slice(0, 140), owner, due: /^\d{4}-\d{2}-\d{2}$/.test(String(t.due || '')) ? t.due : '', section: sec, why: String(t.why || '')};
        }).filter(x => x.title));
      }
    }
    async function create(ev) {
      const pick = (rows || []).filter(x => x.on);
      if (!pick.length) return;
      setBusy(true);
      const p = project ? ctx.coll.projects.map[project] : null;
      for (const t of pick) {
        await ctx.W.set('tasks/' + U.uid(), {title: t.title, owner: t.owner, client: (p && p.client) || '', project: project || '', section: t.section || '',
          due: t.due, status: 'todo', priority: 'normal', link: '', revisions: 0, shown20: false, subtasks: {}, comments: {},
          by: ctx.uid, created: Date.now(), updated: Date.now(), doneAt: null}).catch(() => {});
      }
      setBusy(false);
      M.toast(pick.length + ' tasks sent to the team');
      onClose();
    }
    const upd = (k, patch) => setRows(rs => rs.map(x => x.k === k ? {...x, ...patch} : x));
    const thinking = r.state === 'thinking' || r.state === 'streaming';

    return html`<${UI.Drawer} open=${true} onClose=${onClose} title="Brief to tasks" head=${html`<span class="fx-head-bot" id="b2t-bot"><${Bot} feature="sections" working=${thinking}/></span>`}
      footer=${rows ? html`<${UI.Btn} disabled=${busy || !rows.some(x => x.on)} onClick=${create}>Send ${rows.filter(x => x.on).length} tasks<//>` : null}>
      ${!rows ? html`<div class="stack">
        <div class="small" style=${{fontWeight: 500}}>Paste a client brief, a call summary or a WhatsApp dump. m360 breaks it into tasks, picks owners by role and workload, and sets dates. You review before anything is sent.</div>
        <${Beam} radius=${14}><div class="fx-beam-pad"><${UI.TextArea} id="brief-text" label="the brief" rows=${8} value=${brief} onChange=${setBrief}
          placeholder="Swisse wants 10 more reels for Diwali, live by 20 Oct. Hindi and English. Two creators, one studio day..."/></div><//>
        <${UI.Select} label="project, optional" value=${project} onChange=${setProject}
          options=${[{v: '', label: 'No project'}].concat(projects.map(p => ({v: p.id, label: p.name})))}/>
        <${Metal} kind="ink" block=${true}><button type="button" class="btn" disabled=${thinking || brief.trim().length < 12} onClick=${breakDown}>
          ${thinking ? html`<${M.Thinking} label="Breaking it down" state="composing"/>` : html`<span class="spark">${SPARK}</span> Break it down`}</button><//>
        ${r.state === 'error' ? html`<div class="small flame-t">${M.ai.errLine(r.err, r.why)}</div>` : unread ? html`<div class="small flame-t" id="b2t-unread">${unread}</div>` : null}
      </div>` : html`<div class="stack tight">
        <div class="small" style=${{fontWeight: 500}}>Untick anything you don't want. Change owners or dates, then send.</div>
        ${rows.map(t => html`<div class="focus" key=${t.k} style=${{alignItems: 'flex-start', flexWrap: 'wrap'}}>
          <input type="checkbox" checked=${t.on} onChange=${e => upd(t.k, {on: e.target.checked})} style=${{width: '20px', height: '20px', marginTop: '3px', accentColor: '#111'}} aria-label="Include"/>
          <div class="grow" style=${{minWidth: '200px'}}>
            <input class="input" value=${t.title} onInput=${e => upd(t.k, {title: e.target.value})} style=${{minHeight: '38px', fontWeight: 600}} aria-label="Task title"/>
            <div class="row" style=${{marginTop: '6px', gap: '6px'}}>
              <select class="input" value=${t.owner} onChange=${e => upd(t.k, {owner: e.target.value})} style=${{minHeight: '34px', width: 'auto'}} aria-label="Owner">
                ${people.map(m => html`<option key=${m.uid} value=${m.uid}>${(profs[m.uid] && profs[m.uid].name) || m.title || 'Teammate'}</option>`)}
              </select>
              <input class="input" type="date" value=${t.due} onInput=${e => upd(t.k, {due: e.target.value})} style=${{minHeight: '34px', width: 'auto'}} aria-label="Due"/>
            </div>
            ${t.why ? html`<div class="tiny ink62" style=${{marginTop: '4px'}}>${t.why}</div>` : null}
          </div>
        </div>`)}
        <${UI.Btn} kind="ghost" sm=${true} onClick=${() => setRows(null)}>Start over<//>
      </div>`}
    <//>`;
  }
  M.parts.BriefToTasks = BriefToTasks;

  /* ---------- Work ---------- */
  function Work({tab, id}) {
    const ctx = M.useCtx();
    const [b2t, setB2t] = useState(false);
    const td = U.todayStr();
    const wkEnd = U.periodRange('week').to;
    const map = ctx.coll.tasks.map;
    const all = Object.keys(map).map(k => map[k]);
    const mineOpen = all.filter(t => t.owner === ctx.uid && t.status !== 'done');
    const over = mineOpen.filter(t => t.due && t.due < td).length;
    const dueWk = mineOpen.filter(t => t.due && t.due >= td && t.due <= wkEnd).length;
    const review = all.filter(t => t.status === 'review').length;
    const t = tab || 'tasks';
    return html`<div class="sect">
      <${M.SectionHero} micro=${today()} title="Work"
        right=${M.ai.on(ctx) ? html`<button type="button" class="btn sec" onClick=${() => setB2t(true)}><span class="spark">${SPARK}</span> Brief to tasks</button>` : null}>
        <${Lede} parts=${[{v: mineOpen.length, l: 'open on you'}, {v: dueWk, l: 'due this week'}, {v: review, l: 'in review across the team'}]}
          need=${over} needLabel="overdue" target=${t === 'tasks' ? '.tk.due' : '.sect-body'}/>
      <//>
      <${M.SectionTabs} section="work" active=${t}/>
      <div class="sect-body">
        ${t === 'projects' ? html`<${Embed} page="Projects" id=${id}/>` : t === 'week' ? html`<${Embed} page="Week"/>`
          : t === 'calendar' ? html`<${Embed} page="Calendar"/>` : t === 'reviews' ? (M.parts.Reviews ? html`<${M.parts.Reviews}/>` : null) : html`<${Embed} page="Tasks" id=${id}/>`}
      </div>
      ${b2t ? html`<${BriefToTasks} onClose=${() => setB2t(false)}/>` : null}
    </div>`;
  }

  /* ---------- Accounts ---------- */
  function Accounts({tab, id}) {
    const ctx = M.useCtx();
    const clients = Object.keys(ctx.coll.clients.map).map(k => ctx.coll.clients.map[k]);
    const live = clients.filter(c => c.status === 'live').length;
    const pitches = Object.keys(ctx.coll.pitches.map).map(k => ctx.coll.pitches.map[k]);
    const inPlay = pitches.filter(p => p.stage !== 'won' && p.stage !== 'lost').length;
    /* v39: money is the owner's alone (their finance doc is the only one loaded), so a second founder sees no money tiles */
    const pm = ctx.isOwner && M.pitches && M.pitches.metrics ? M.pitches.metrics(ctx) : null;
    const sh = ctx.isOwner && M.clients && M.clients.shares ? M.clients.shares(ctx) : [];
    const mrr = sh.reduce((n, r) => n + (r.monthly || 0), 0);
    const t = tab || 'talks';
    /* the older views still open by their hash; they sit behind one quiet line under the tabs */
    const older = [{h: '#prospects', l: 'Prospects'}, {h: '#crm', l: 'CRM table'}, {h: '#handshake', l: 'LinkedIn desk'}, {h: '#base', l: 'Database'}];
    const parts = [{v: live, l: live === 1 ? 'live client' : 'live clients'}, {v: inPlay, l: inPlay === 1 ? 'pitch in play' : 'pitches in play'}]
      .concat(pm ? [{v: U.inrV(pm.weighted), l: 'weighted pipeline'}] : [])
      .concat(ctx.isOwner ? [{v: U.inrV(mrr), l: 'monthly revenue'}] : []);
    return html`<div class="sect">
      <${M.SectionHero} micro=${today()} title="Accounts">
        <${Lede} parts=${parts}/>
      <//>
      <${M.SectionTabs} section="accounts" active=${t}/>
      <div class="sect-body">
        ${t === 'talks' ? (M.pages.Talks ? html`<${Embed} page="Talks" id=${id}/>` : null)
          : t === 'pipeline' ? html`<${Embed} page=${M.pages.Proposals ? 'Proposals' : 'Pitches'}/>` : t === 'prospects' ? html`<${Embed} page="Prospects" id=${id}/>` : t === 'crm' && M.parts.CRM ? html`<${M.parts.CRM}/>` : t === 'handshake' ? html`<${Embed} page="Handshake"/>` : html`<${Embed} page="Clients" id=${id}/>`}
      </div>
      <div class="sect-more" id="accounts-older">
        <span>More tools</span>
        ${older.map(o => html`<button key=${o.h} type="button" class="linky tiny" onClick=${() => M.nav(o.h)}>${o.l}</button>`)}
      </div>
    </div>`;
  }

  /* ---------- Vibe: weekly wrapped by AI ---------- */
  function Wrapped() {
    const ctx = M.useCtx();
    const r = M.ai.useRun();
    const cache = M.ai.useCache(ctx);
    const wk = U.isoWeek(new Date());
    const cached = cache.data && cache.data.wrapped && cache.data.wrapped.week === wk ? cache.data.wrapped.text : '';
    const text = r.text || cached;
    if (!M.ai.on(ctx)) return null;
    async function go() {
      const nm = await M.ai.names(ctx);
      const from = U.periodRange('week').from;
      const fromMs = U.parseYmd(from).getTime();
      const posts = [];
      Object.keys(ctx.coll.feed.map).forEach(u => ((ctx.coll.feed.map[u] || {}).posts || []).forEach(p => { if (p.at >= fromMs) posts.push('- ' + (nm[u] || 'someone') + ' (' + p.kind + '): ' + String(p.text).slice(0, 200)); }));
      const kudos = [];
      Object.keys(ctx.coll.kudos.map).forEach(u => ((ctx.coll.kudos.map[u] || {}).given || []).forEach(k => { if (k.at >= fromMs) kudos.push('- ' + (nm[u] || 'someone') + ' to ' + (nm[k.to] || 'someone') + ': ' + String(k.why).slice(0, 160)); }));
      const map = ctx.coll.tasks.map;
      const shipped = {};
      Object.keys(map).forEach(id => { const t = map[id]; if (t.status === 'done' && t.doneAt >= fromMs) shipped[t.owner] = (shipped[t.owner] || 0) + 1; });
      const ship = Object.keys(shipped).map(u => '- ' + (nm[u] || 'someone') + ': ' + shipped[u] + ' tasks shipped');
      const out = await r.run(o => M.ai.text(ctx,
        'Write this week\'s team "Wrapped" for the agency feed, in the style of Spotify Wrapped. Fun, specific, celebratory, ' +
        'no emoji. Structure: a bold headline, then 4 to 6 bullets (biggest wins, shoutouts by name, who shipped most, a fun stat), ' +
        'then one line hyping next week. Under 140 words. Only use facts below.\n\nPOSTS:\n' + (posts.join('\n') || '- none') +
        '\n\nKUDOS:\n' + (kudos.join('\n') || '- none') + '\n\nSHIPPED:\n' + (ship.join('\n') || '- none'),
        {signal: o.signal, onText: o.onText, cache: false}));
      if (typeof out === 'string' && out) M.ai.saveCache(ctx, 'wrapped', {text: out, week: wk});
    }
    const busy = r.state === 'thinking' || r.state === 'streaming';
    const btn = html`<button type="button" class=${'btn sm ' + (text ? 'sec' : '')} disabled=${busy} onClick=${go}>${busy ? html`<${M.Thinking} state="composing"/>` : html`<span class="spark">${SPARK}</span> ${text ? 'Write it again' : 'Wrap the week'}`}</button>`;
    return html`<${Beam}><section class="ai-card" id="wrapped-card">
      <div class="row between">
        <span class="fx-head-bot"><${Bot} feature="sections" working=${busy} size=${34}/></span>
        <div class="grow"><${UI.Micro}>m360 ai<//><div class="card-title" style=${{marginTop: '4px'}}>This week, wrapped</div></div>
        ${text ? btn : html`<${Metal} kind="ink">${btn}<//>`}
      </div>
      <div style=${{marginTop: '12px'}}>
        ${text ? html`<${M.AIText} text=${text}/>` : html`<div class="small" style=${{fontWeight: 500}}>Wins, shoutouts and who shipped the most, written up by m360.</div>`}
        ${r.state === 'error' ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${M.ai.errLine(r.err, r.why)}</div>` : null}
      </div>
    </section><//>`;
  }

  function Vibe({tab, id}) {
    const ctx = M.useCtx();
    const from = U.parseYmd(U.periodRange('week').from).getTime();
    let posts = 0, kudos = 0;
    Object.keys(ctx.coll.feed.map).forEach(u => ((ctx.coll.feed.map[u] || {}).posts || []).forEach(p => { if (p.at >= from) posts++; }));
    Object.keys(ctx.coll.kudos.map).forEach(u => ((ctx.coll.kudos.map[u] || {}).given || []).forEach(k => { if (k.at >= from) kudos++; }));
    const online = Object.keys(ctx.online || {}).length;
    const t = tab || 'feed';
    return html`<div class="sect">
      <${M.SectionHero} micro=${today()} title="Vibe">
        <${Lede} parts=${[{v: posts, l: posts === 1 ? 'post this week' : 'posts this week'}, {v: kudos, l: 'kudos this week'}, {v: online, l: 'online now'}]}/>
      <//>
      <${M.SectionTabs} section="vibe" active=${t}/>
      <div class="sect-body">
        ${t === 'feed' ? html`<${Wrapped}/>` : null}
        ${t === 'crew' ? html`<${Embed} page="People" id=${id}/>` : t === 'pulse' ? html`<${Embed} page="Voice"/>` : t === 'scores' ? html`<${Embed} page="Scores"/>` : t === 'music' ? html`<${Embed} page="Music"/>`
          : t === 'office' ? (M.pages.Office ? html`<${M.pages.Office} scope="team"/>` : null) : html`<${Embed} page="Feed"/>`}
      </div>
    </div>`;
  }

  /* ---------- Me ---------- */
  function Me({tab, id}) {
    const ctx = M.useCtx();
    const days = (ctx.coll.checkin.map[ctx.uid] || {}).days || {};
    const eods = (ctx.coll.eod.map[ctx.uid] || {}).days || {};
    const inStreak = M.home ? M.home.streak(ctx, ctx.uid, d => !!(days[d] && days[d].in)) : 0;
    const eodStreak = M.home ? M.home.streak(ctx, ctx.uid, d => !!eods[d]) : 0;
    const q = U.periodRange('quarter');
    const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, ctx.uid, q.from, q.to) : {total: 0, badges: []};
    const level = 1 + Math.floor(Math.max(0, pts.total) / 60);
    const t = tab || 'profile';
    return html`<div class="sect">
      <${M.SectionHero} micro=${(ctx.member && ctx.member.empId) || 'me'}
        title=${html`<${UI.Name} id=${ctx.uid} fallback="You"/>`}
        sub=${(ctx.member && ctx.member.title) ? ctx.member.title + (ctx.member.pod ? ', ' + ctx.member.pod : '') : null}
        right=${html`<${UI.Avatar} id=${ctx.uid} size=${72}/>`}>
        <${Lede} parts=${[{v: 'Level ' + level, l: 'with ' + pts.total + ' points this quarter'}, {v: inStreak, l: 'day streak'}, {v: eodStreak, l: 'EOD lines in a row'}]}>
          ${(pts.badges || []).map(b => html`<span key=${b} class="pill ink">${b}</span>`)}
        <//>
      <//>
      <${M.SectionTabs} section="me" active=${t}/>
      <div class="sect-body">
      ${t === 'profile' && M.parts.ProfileCard ? html`<${UI.Fold} title="Your profile" summary="photo, pronouns, city, bio, links, birthday" id="fold-profile"><${M.parts.ProfileCard}/><//>` : null}
      ${t === 'leave' ? html`<${Embed} page="Leave"/>` : t === 'handbook' ? html`<${Embed} page="Handbook" id=${id}/>` : t === 'notes' ? html`<${Embed} page="Notes" id=${id}/>`
        : t === 'hiring' ? html`<${Embed} page="Hiring" id=${id}/>` : t === 'trophies' ? (M.parts.Trophies ? html`<${M.parts.Trophies}/>` : null)
        : t === 'coo' ? (M.pages.CooCharter ? html`<${M.pages.CooCharter}/>` : null)
        : t === 'character' ? (M.pages.Character ? html`<${Embed} page="Character"/>` : null) : html`<${Embed} page="People" id=${ctx.uid}/>`}
      ${t === 'profile' ? html`<${UI.Fold} title="Your m360" summary="your character, look, sounds, notices, shortcuts" id="fold-prefs"><${Prefs}/><//>` : null}
      ${t === 'profile' && M.parts.BuddyPrefs ? html`<${M.parts.BuddyPrefs}/>` : null}
      ${t === 'profile' && M.parts.EmailCard ? html`<${UI.Fold} title="Your email" summary="for sign-in links" id="fold-email"><${M.parts.EmailCard}/><//>` : null}
      ${t === 'profile' && M.parts.DeviceCard ? html`<${UI.Fold} title="Your devices" summary="where you are signed in" id="fold-devices"><${M.parts.DeviceCard}/><//>` : null}
      ${t === 'profile' ? (M.meCards || []).map((C, i) => html`<${C} key=${i}/>`) : null}
      </div>
    </div>`;
  }

  /* ---------- Me: how the OS behaves for you ---------- */

  /* the money lock's switch: hide amounts until a fingerprint (01-z-moneylock.js). Turning it off asks first */
  function MoneyPref() {
    const hidden = M.moneyLock.use();
    const on = M.moneyLock.on();
    return html`<div class="row between" id="prefs-money">
      <span class="stack"><span>Hide money until fingerprint</span><span class="tiny ink62">${on ? (hidden ? 'Hidden now. Tap any amount to show it' : 'Shown now. Hides again after 5 minutes away') : 'Amounts show for everyone looking at this screen'}</span></span>
      <span class="row nowrap" style=${{gap: '8px'}}>
        ${on && !hidden ? html`<${UI.Btn} kind="sec" sm=${true} id="prefs-money-hide" onClick=${() => M.moneyLock.hide()}>Hide now<//>` : null}
        <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${on ? 'on' : 'off'} ariaLabel="Hide money" onChange=${v => { M.moneyLock.setOn(v === 'on'); }}/>
      </span>
    </div>`;
  }

  function Prefs() {
    const theme = M.useTheme();
    const [sound, setSound] = useState(M.sound.on());
    const [haptic, setHaptic] = useState(M.haptic.on());
    const [voiceOn, setVoiceOn] = useState(() => M.prefs.get('buddyVoice') !== '0');
    const [previews, setPreviews] = useState(() => M.notices ? M.notices.previews() : true);
    const [allRooms, setAllRooms] = useState(() => M.prefs.get('noticeAll', '0') === '1');
    const [perm, setPerm] = useState(() => { try { return window.Notification ? Notification.permission : 'denied'; } catch (e) { return 'denied'; } });
    const [castOpen, setCastOpen] = useState(false);
    const wk = U.periodRange('week');
    const ctx = M.useCtx();
    const deep = M.focus ? M.focus.minutes(ctx, ctx.uid, wk.from, wk.to) : 0;
    /* the character the office draws for you: your small head, and the sheet; read only while Kaavish holds your look */
    const Sheet = M.parts.CharacterSheet;
    const cast = Sheet && M.cast && ctx.uid ? M.cast.resolveFor(ctx, ctx.uid) : null;
    return html`<${UI.Card} id="prefs-card" title="Your m360">
      <div class="stack tight">
        ${cast ? html`<div class="row between prefs-character" id="prefs-character" data-locked=${cast.locked ? '1' : '0'}>
          <span class="row nowrap prefs-character-who">
            <img class="cast-mini" src=${M.cast.head2d(cast.look, {founder: cast.founder, size: 32}).url} alt="" width="32" height="32"/>
            <span class="stack prefs-character-words"><span>Your character</span>
              ${cast.locked ? html`<span class="tiny ink62" id="prefs-character-line">Kaavish set this look for you.</span>`
                : cast.src === 'starter' ? html`<span class="tiny ink62" id="prefs-character-line">Clay for now. Style it to step into the office.</span>` : null}</span>
          </span>
          <${UI.Btn} kind="sec" sm=${true} id="prefs-character-open" onClick=${() => setCastOpen(true)}>Style your character<//>
        </div>` : null}
        ${castOpen && Sheet ? html`<${Sheet} uid=${ctx.uid} onClose=${() => setCastOpen(false)}/>` : null}
        <div class="row between">
          <span>Look</span>
          <${UI.Seg} sm=${true} options=${[{v: 'auto', label: 'Auto'}, {v: 'light', label: 'Paper'}, {v: 'dark', label: 'Ink'}]} value=${theme} ariaLabel="Theme" onChange=${v => M.theme.set(v)}/>
        </div>
        <div class="row between">
          <span>Sounds</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${sound ? 'on' : 'off'} ariaLabel="Sounds"
            onChange=${v => { M.sound.set(v === 'on'); setSound(v === 'on'); if (v === 'on') M.sound.play('chime'); }}/>
        </div>
        ${ctx.isOwner || ctx.isFounder ? html`<${MoneyPref}/>` : null}
        <div class="row between"><span>Deep work this week</span><span class="num" style=${{fontWeight: 600}}>${Math.round(deep / 6) / 10}h</span></div>
        <div class="row between">
          <span>m360 AI speaks its answers</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${voiceOn ? 'on' : 'off'} ariaLabel="Buddy voice"
            onChange=${v => { M.prefs.set('buddyVoice', v === 'on' ? '1' : '0'); setVoiceOn(v === 'on'); if (v === 'on' && M.speech) M.speech.say('Answers will be read out loud.'); }}/>
        </div>
        <div class="row between">
          <span>Nudges on the phone</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${haptic ? 'on' : 'off'} ariaLabel="Haptics"
            onChange=${v => { M.haptic.set(v === 'on'); setHaptic(v === 'on'); if (v === 'on') M.haptic.buzz('done'); }}/>
        </div>
        ${haptic ? html`<div class="row between" id="haptic-try">
          <span class="tiny ink62">${M.haptic.kind() === 'tick' ? 'iPhone: a tick on every tap' : M.haptic.kind() === 'vibrate' ? 'Light to strong, by action' : 'This device has no motor a page can reach'}</span>
          <div class="row" style=${{gap: '8px'}}>
            <${UI.Btn} kind="sec" sm=${true} id="haptic-try-light" onClick=${() => M.haptic.buzz('tap')}>Light<//>
            <${UI.Btn} kind="sec" sm=${true} id="haptic-try-strong" onClick=${() => M.haptic.buzz('big')}>Strong<//>
          </div>
        </div>` : null}
        <div class="row between">
          <span>Message previews in notices</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'Show'}, {v: 'off', label: 'Hide'}]} value=${previews ? 'on' : 'off'} ariaLabel="Message previews"
            onChange=${v => { if (M.notices) M.notices.setPreviews(v === 'on'); setPreviews(v === 'on'); }}/>
        </div>
        <div class="row between">
          <span>Notices for every room message</span>
          <${UI.Seg} sm=${true} options=${[{v: 'on', label: 'On'}, {v: 'off', label: 'Off'}]} value=${allRooms ? 'on' : 'off'} ariaLabel="Room notices"
            onChange=${v => { M.prefs.set('noticeAll', v === 'on' ? '1' : '0'); setAllRooms(v === 'on'); }}/>
        </div>
        <div class="row between"><span>Bubbles while m360 is in another window</span>
          ${perm === 'default' ? html`<${UI.Btn} kind="sec" sm=${true} id="notify-ask" onClick=${() => M.notices && M.notices.ask().then(p => setPerm(p || 'denied'))}>Allow<//>`
            : perm === 'granted' ? html`<span class="pill ink" id="notify-state">on</span>`
            : perm === 'denied' ? html`<span class="tiny ink62" id="notify-state">blocked in this browser's site settings</span>`
            : html`<span class="tiny ink62" id="notify-state">not on this browser</span>`}</div>
        <div class="row between"><span>The tour</span><button type="button" class="linky small" id="tour-again" onClick=${() => M.tour && M.tour.start()}>Show me around</button></div>
        <div class="row between"><span>Keyboard shortcuts</span><button type="button" class="linky small" onClick=${() => window.dispatchEvent(new CustomEvent('m360:keys'))}>Show the sheet</button></div>
        <div class="row between"><span>This build</span><span class="num tiny ink62" id="build-stamp">${window.M360_BUILD || 'claude.ai page'}</span></div>
      </div>
    <//>`;
  }

  /* ---------- Admin ---------- */
  function Admin() {
    return html`<div class="sect">
      <${M.SectionHero} micro=${'founder' + (window.M360_BUILD ? ', build ' + window.M360_BUILD : '')} title="Admin">
        <p class="lede"><span class="lede-n">Team, rules, corrections, the activity log, payroll export and your super controls.</span></p>
      <//>
      <div class="sect-body">
      ${M.parts.AiKeyCard ? html`<${UI.Fold} title="m360 AI" summary="your Anthropic key, and Check the AI" id="fold-ai"><${M.parts.AiKeyCard}/><//>`
        : M.parts.AiCheck ? html`<${UI.Fold} title="m360 AI" summary="check that the AI answers" id="fold-ai"><${UI.Card} id="ai-card" title="m360 AI">
            <p class="small ink62" style=${{marginTop: 0}}>Here the AI runs on each person's own claude.ai account. Check that it answers, and see what Anthropic says when it does not.</p>
            <${M.parts.AiCheck}/>
          <//><//>` : null}
      ${M.parts.MailCard ? html`<${UI.Fold} title="Email sending" summary="Resend key and sender" id="fold-mail"><${M.parts.MailCard}/><//>` : null}
      ${M.parts.VoiceCard ? html`<${UI.Fold} title="m360 AI's voice" summary="a natural voice for m360 AI" id="fold-voice"><${M.parts.VoiceCard}/><//>` : null}
      ${M.parts.GoogleCard ? html`<${UI.Fold} title="Google Workspace" summary="mail, calendar, meetings and drive for everyone" id="fold-google"><${M.parts.GoogleCard}/><//>` : null}
      ${M.parts.BrowserCard ? html`<${UI.Fold} title="The browser" summary="reading mode, m360 Desktop, the frame helper" id="fold-browser"><${M.parts.BrowserCard}/><//>` : null}
      ${(M.adminCards || []).map((C, i) => html`<${UI.Fold} key=${i} title=${C.foldTitle || 'Radar settings'} summary=${C.foldSummary || 'keywords, sources, channels'} id=${'fold-admin-' + i}><${C}/><//>`)}
      <${Embed} page="Desk"/>
      </div>
    </div>`;
  }

  M.pages.Work = Work;
  M.pages.Accounts = Accounts;
  M.pages.Vibe = Vibe;
  M.pages.Me = Me;
  M.pages.Admin = Admin;
})();
