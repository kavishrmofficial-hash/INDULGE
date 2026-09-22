/* module: feed. Updates, wins, questions and announcements from everyone, plus kudos, in one stream. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState} = React;

  const KINDS = [
    {v: 'update', label: 'Update'},
    {v: 'win', label: 'Win'},
    {v: 'question', label: 'Question'}
  ];
  const ANNOUNCE = {v: 'announce', label: 'Announcement'};
  const KIND_TEXT = {announce: 'announcement', win: 'win', question: 'question', update: 'update'};
  const KIND_PILL = {announce: 'flame', win: 'ink'};
  const FILTERS = [
    {v: 'all', label: 'All'},
    {v: 'announce', label: 'Announcements'},
    {v: 'win', label: 'Wins'},
    {v: 'kudos', label: 'Kudos'}
  ];
  const EMPTY = {all: 'Nothing posted yet.', announce: 'No announcements yet.', win: 'No wins yet.', kudos: 'No kudos yet.'};
  const EMOJIS = ['👍', '🔥', '👀', '✅'];
  const KEEP_POSTS = 80;
  const KEEP_KUDOS = 60;
  const STREAM_CAP = 120;
  const KUDOS_CAP = 3;

  /* ---------- pure helpers ---------- */
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const postsOf = (ctx, uid) => ((collMap(ctx, 'feed')[uid] || {}).posts || []).filter(p => p && p.id);
  const givenOf = (ctx, uid) => ((collMap(ctx, 'kudos')[uid] || {}).given || []).filter(g => g && g.id);
  const myReacts = (ctx, uid) => (collMap(ctx, 'reacts')[uid] || {}).r || {};
  /* only the founder's pinned field is read */
  const pinnedKey = ctx => (ctx.founderUid && (collMap(ctx, 'feed')[ctx.founderUid] || {}).pinned) || null;
  const kindOf = p => KIND_TEXT[p.kind] ? p.kind : 'update';

  /* kudos sent by uid inside the ISO week that holds `now` */
  function kudosThisWeek(ctx, uid, now) {
    const week = U.isoWeek(new Date(now || Date.now()));
    return givenOf(ctx, uid).filter(g => g.at && U.isoWeek(new Date(g.at)) === week).length;
  }

  /* every post and every kudos in one list: the pinned post first, then newest first, capped */
  function stream(ctx) {
    const pinned = pinnedKey(ctx);
    const out = [];
    const feed = collMap(ctx, 'feed');
    for (const author of Object.keys(feed)) {
      for (const p of postsOf(ctx, author)) {
        const key = author + ':' + p.id;
        out.push({key, type: 'post', author, id: p.id, kind: kindOf(p), text: String(p.text || ''),
          at: Number(p.at) || 0, pinned: key === pinned});
      }
    }
    const kudos = collMap(ctx, 'kudos');
    for (const giver of Object.keys(kudos)) {
      for (const g of givenOf(ctx, giver)) {
        out.push({key: 'k:' + giver + ':' + g.id, type: 'kudos', giver, id: g.id, to: g.to || '',
          why: String(g.why || ''), at: Number(g.at) || 0, pinned: false});
      }
    }
    out.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.at - a.at));
    return out.slice(0, STREAM_CAP);
  }

  /* reaction counts from every reacts document: {[postKey]: {[emoji]: n}} */
  function reactCounts(ctx) {
    const counts = {};
    const reacts = collMap(ctx, 'reacts');
    for (const who of Object.keys(reacts)) {
      const r = (reacts[who] || {}).r || {};
      for (const key of Object.keys(r)) {
        const e = r[key];
        if (!EMOJIS.includes(e)) continue;
        const c = counts[key] || (counts[key] = {});
        c[e] = (c[e] || 0) + 1;
      }
    }
    return counts;
  }

  /* Display names for a set of ids, held in page state. M.useProfiles re-renders only the first subscriber
     of an id per commit, so a UI.Name next to a UI.Avatar for the same id can keep its fallback until the
     next tree render. This hook re-renders the page once the fetch settles and feeds UI.Name a fallback. */
  function useNames(ctx, ids) {
    const key = Array.from(new Set((ids || []).filter(Boolean))).sort().join(',');
    const user = ctx && ctx.user;
    const [names, setNames] = useState({});
    React.useEffect(() => {
      if (!key || !user || typeof user.profiles !== 'function') return undefined;
      let live = true;
      Promise.resolve().then(() => user.profiles(key.split(','))).then(ps => {
        if (!live || !ps) return;
        setNames(prev => {
          const out = {...prev};
          for (const id of Object.keys(ps)) out[id] = (ps[id] && ps[id].name) || '';
          return out;
        });
      }).catch(() => {});
      return () => { live = false; };
    }, [user, key]);
    return names;
  }

  /* ---------- composer ---------- */
  function Composer() {
    const ctx = M.useCtx();
    const {W, uid, isFounder} = ctx;
    const [text, setText] = useState('');
    const [kind, setKind] = useState('update');
    const [busy, setBusy] = useState(false);
    const options = isFounder ? [...KINDS, ANNOUNCE] : KINDS;
    const canPost = !!text.trim() && !busy;

    const post = async () => {
      const t = text.trim();
      if (!t || busy) return;
      const k = (kind === 'announce' && !isFounder) ? 'update' : (KIND_TEXT[kind] ? kind : 'update');
      setBusy(true);
      try {
        const id = U.uid();
        const mine = collMap(ctx, 'feed')[uid] || {};
        const posts = [{id, kind: k, text: t, at: Date.now()}, ...U.clone(postsOf(ctx, uid))].slice(0, KEEP_POSTS);
        const pinned = k === 'announce' ? uid + ':' + id : (mine.pinned || null);
        await W.merge('feed/' + uid, {posts, pinned});
        setText('');
        setKind('update');
        M.toast('Posted');
      } catch (e) { /* the write layer already toasted the failure */ }
      setBusy(false);
    };

    return html`<${UI.Card} id="feed-composer">
      <div class="stack">
        <${UI.TextArea} id="feed-text" placeholder="Share an update, a win or a question" rows=${3} value=${text} onChange=${setText}/>
        <div class="row between">
          <${UI.Seg} ariaLabel="Post kind" value=${kind} onChange=${setKind} options=${options}/>
          <${UI.Btn} disabled=${!canPost} onClick=${post}>Post<//>
        </div>
        ${kind === 'announce' ? html`<div class="sub small">Announcements pin to the top of the feed and show on everyone's Today.</div>` : null}
      </div>
    <//>`;
  }

  /* ---------- kudos drawer ---------- */
  function KudosDrawer({open, onClose, names}) {
    const ctx = M.useCtx();
    const {W, uid} = ctx;
    const [to, setTo] = useState('');
    const [why, setWhy] = useState('');
    const [busy, setBusy] = useState(false);
    const people = (ctx.activeMembers || []).filter(m => m.uid !== uid);
    const options = people.map(m => ({v: m.uid, label: names[m.uid] || m.empId || 'Someone'}));
    const toId = options.some(o => o.v === to) ? to : (options[0] ? options[0].v : '');
    const used = kudosThisWeek(ctx, uid, ctx.now);
    const left = Math.max(0, KUDOS_CAP - used);
    const canSend = !!toId && !!why.trim() && left > 0 && !busy;

    const send = async () => {
      if (!canSend) return;
      setBusy(true);
      try {
        const given = [{id: U.uid(), to: toId, why: why.trim(), at: Date.now()}, ...U.clone(givenOf(ctx, uid))].slice(0, KEEP_KUDOS);
        await W.merge('kudos/' + uid, {given});
        setWhy('');
        setTo('');
        M.toast('Kudos sent');
        onClose();
      } catch (e) { /* the write layer already toasted the failure */ }
      setBusy(false);
    };

    const footer = html`<${UI.Btn} disabled=${!canSend} onClick=${send}>Send kudos<//>`;
    return html`<${UI.Drawer} open=${open} onClose=${onClose} title="Give kudos" footer=${footer}>
      ${people.length
        ? html`<${UI.Select} id="kudos-to" label="to" value=${toId} onChange=${setTo} options=${options}/>`
        : html`<${UI.Empty} text="No one else on the roster yet."/>`}
      <${UI.Input} id="kudos-why" label="why" placeholder="One line on what they did" value=${why} onChange=${setWhy} onEnter=${send}/>
      <div id="kudos-left" class=${'small num' + (left ? ' sub' : ' flame-t')}>${left} of ${KUDOS_CAP} left this week</div>
      <div class="sub small">Kudos show in the feed and count for points. The count resets on Monday.</div>
    <//>`;
  }

  /* ---------- cards ---------- */
  function PostCard({it, counts, mine, names}) {
    const ctx = M.useCtx();
    const {uid, isFounder, founderUid, W} = ctx;
    const c = counts[it.key] || {};
    const isAuthor = it.author === uid;

    const react = e => {
      const r = myReacts(ctx, uid);
      if (r[it.key] === e) {
        const next = {...r};
        delete next[it.key];
        W.set('reacts/' + uid, {r: next}).catch(() => {});
      } else {
        W.merge('reacts/' + uid, {r: {[it.key]: e}}).catch(() => {});
      }
    };
    const togglePin = () => {
      if (!founderUid) return;
      W.merge('feed/' + founderUid, {pinned: it.pinned ? null : it.key})
        .then(() => M.toast(it.pinned ? 'Unpinned' : 'Pinned')).catch(() => {});
    };
    const remove = () => {
      const mineDoc = collMap(ctx, 'feed')[uid] || {};
      const posts = U.clone(postsOf(ctx, uid)).filter(p => p.id !== it.id);
      const doc = {posts};
      if (mineDoc.pinned === it.key) doc.pinned = null;
      W.merge('feed/' + uid, doc).then(() => M.toast('Deleted')).catch(() => {});
    };

    return html`<section class=${'card' + (it.pinned ? ' flame' : '')} data-key=${it.key} data-kind=${it.kind}>
      <div class="row between">
        <div class="row nowrap grow">
          <${UI.Avatar} id=${it.author} size=${32}/>
          <div class="grow">
            <div class="row">
              <b><${UI.Name} id=${it.author} fallback=${names[it.author] || undefined}/></b>
              <${UI.Pill} kind=${KIND_PILL[it.kind]}>${KIND_TEXT[it.kind]}<//>
              ${it.pinned ? html`<${UI.Pill}><${icons.pin}/>pinned<//>` : null}
            </div>
            <div class="tiny sub num">${U.timeAgo(it.at)}</div>
          </div>
        </div>
        ${(isFounder || isAuthor) ? html`<div class="row nowrap">
          ${isFounder ? html`<${UI.Btn} kind="ghost" sm onClick=${togglePin}><${icons.pin}/>${it.pinned ? 'Unpin' : 'Pin'}<//>` : null}
          ${isAuthor ? html`<${UI.ConfirmBtn} onConfirm=${remove}>Delete<//>` : null}
        </div>` : null}
      </div>
      <div style=${{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '12px 0'}}>${it.text}</div>
      <div class="row" role="group" aria-label="Reactions">
        ${EMOJIS.map(e => html`<button key=${e} type="button" class=${'emoji-btn' + (mine === e ? ' on' : '')}
          aria-pressed=${mine === e} aria-label=${'React ' + e} onClick=${() => react(e)}>
          <span>${e}</span>${c[e] ? html`<span class="num">${c[e]}</span>` : null}</button>`)}
      </div>
    </section>`;
  }

  function KudosCard({it, names}) {
    return html`<section class="card" data-key=${it.key} data-kind="kudos">
      <div class="row nowrap">
        <${UI.Avatar} id=${it.giver} size=${32}/>
        <div class="grow">
          <div class="row">
            <b>Kudos to <${UI.Name} id=${it.to} fallback=${names[it.to] || undefined}/></b>
            <${UI.Pill} kind="ink">kudos<//>
          </div>
          <div class="tiny sub">from <${UI.Name} id=${it.giver} fallback=${names[it.giver] || undefined}/><span class="num"> · ${U.timeAgo(it.at)}</span></div>
        </div>
      </div>
      <div style=${{overflowWrap: 'anywhere', marginTop: '12px'}}>${it.why}</div>
    </section>`;
  }

  /* ---------- page ---------- */
  function Feed() {
    const ctx = M.useCtx();
    const [filter, setFilter] = useState('all');
    const [kudosOpen, setKudosOpen] = useState(false);
    M.useIntent('kudos', () => setKudosOpen(true));
    M.useIntent('post', () => setTimeout(() => { const el = document.getElementById('feed-text'); if (el) el.focus(); }, 60));
    const items = stream(ctx);
    const counts = reactCounts(ctx);
    const mine = myReacts(ctx, ctx.uid);
    const ids = [];
    for (const it of items) {
      if (it.type === 'post') ids.push(it.author);
      else { ids.push(it.giver); ids.push(it.to); }
    }
    for (const m of (ctx.activeMembers || [])) ids.push(m.uid);
    const names = useNames(ctx, ids);
    const shown = items.filter(it => filter === 'all'
      || (filter === 'kudos' ? it.type === 'kudos' : (it.type === 'post' && it.kind === filter)));
    const ready = !!(ctx.coll && ctx.coll.feed && ctx.coll.feed.ready && ctx.coll.kudos && ctx.coll.kudos.ready);

    return html`<${React.Fragment}>
      <${UI.PageHead} micro="updates, wins and kudos" title="Feed">
        <${UI.Btn} kind="sec" onClick=${() => setKudosOpen(true)}>Give kudos<//>
      <//>
      <${Composer}/>
      <div class="row between">
        <${UI.Seg} ariaLabel="Filter" value=${filter} onChange=${setFilter} options=${FILTERS}/>
        <span class="tiny sub num">${shown.length} shown</span>
      </div>
      <div class="stack" id="feed-stream">
        ${shown.length ? shown.map(it => it.type === 'kudos'
          ? html`<${KudosCard} key=${it.key} it=${it} names=${names}/>`
          : html`<${PostCard} key=${it.key} it=${it} counts=${counts} mine=${mine[it.key]} names=${names}/>`)
          : html`<${UI.Empty} text=${ready ? EMPTY[filter] : 'Loading the feed.'}/>`}
      </div>
      <${KudosDrawer} open=${kudosOpen} onClose=${() => setKudosOpen(false)} names=${names}/>
    <//>`;
  }

  M.pages.Feed = Feed;
  M.feed = {stream, reactCounts};
})();
