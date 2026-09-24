/* module: voice. Anonymous weekly pulse, the founder's team energy view, and an attributed ideas box with votes. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState} = React;

  const STATUS = [
    {v: 'open', label: 'Open', pill: undefined},
    {v: 'doing', label: 'Doing', pill: 'ink'},
    {v: 'done', label: 'Done', pill: 'ink'},
    {v: 'parked', label: 'Parked', pill: 'warm'}
  ];
  const pillFor = s => { const o = STATUS.find(x => x.v === s); return o ? o.pill : undefined; };
  const collMap = (ctx, name) => ((ctx && ctx.coll && ctx.coll[name]) || {}).map || {};
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /* ---------- pure helpers, exported as M.voice ---------- */

  /* the last n ISO weeks, oldest first: [{week, avg or null, n}] */
  function energyByWeek(ctx, n) {
    const count = Math.max(1, Number(n) || 8);
    const base = new Date((ctx && ctx.now) || Date.now());
    const sums = {};
    for (const p of Object.values(collMap(ctx, 'pulse'))) {
      if (!p || !p.week) continue;
      const e = Number(p.energy);
      if (!(e >= 1 && e <= 5)) continue;
      const s = sums[p.week] || (sums[p.week] = {sum: 0, n: 0});
      s.sum += e; s.n += 1;
    }
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const week = U.isoWeek(U.addDays(base, -7 * i));
      const s = sums[week];
      out.push({week, avg: s ? Math.round(10 * s.sum / s.n) / 10 : null, n: s ? s.n : 0});
    }
    return out;
  }

  /* the newest n pulse responses; every response when n is missing */
  function latest(ctx, n) {
    const m = collMap(ctx, 'pulse');
    const list = Object.keys(m).map(id => ({id, ...(m[id] || {})}))
      .filter(p => p.week || p.at)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    return n ? list.slice(0, n) : list;
  }

  /* ---------- pulse card: anonymous, once per ISO week ---------- */
  function PulseCard() {
    const ctx = M.useCtx();
    const {W, uid} = ctx;
    const weekId = U.isoWeek(new Date(ctx.now || Date.now()));
    const st = (ctx.priv && ctx.priv.state && ctx.priv.state.data) || {};
    const flagged = !!(st.pulse && st.pulse[weekId]);
    const [energy, setEnergy] = useState(0);
    const [working, setWorking] = useState('');
    const [broken, setBroken] = useState('');
    const [change, setChange] = useState('');
    const [busy, setBusy] = useState(false);
    const [sentWeek, setSentWeek] = useState('');
    const sent = flagged || sentWeek === weekId;

    const send = async () => {
      if (!energy || busy) return;
      setBusy(true);
      try {
        await W.set('pulse/' + U.uid(), {
          at: Date.now(), week: weekId, energy,
          working: working.trim(), broken: broken.trim(), change: change.trim()
        });
        await W.merge('data/users/' + uid + '/state', {pulse: {[weekId]: true}});
        setSentWeek(weekId);
        M.toast('Pulse sent');
      } catch (e) { /* the write layer already toasted the failure */ }
      setBusy(false);
    };

    return html`<${UI.Card} title="Pulse" id="pulse-card">
      <div class="stack">
        <div class="sub">Anonymous. Your name is never stored with it.</div>
        ${sent ? html`<div class="stack tight">
            <div class="row"><${UI.Pill} kind="ink">sent<//><span>Sent for this week.</span></div>
            <div class="sub small">The next pulse opens on Monday.</div>
          </div>` : html`<div class="stack">
            <${UI.Field} label="energy this week" hint="1 to 5. 5 means full.">
              <${UI.Seg} ariaLabel="Energy this week" value=${energy} onChange=${setEnergy}
                options=${[1, 2, 3, 4, 5].map(v => ({v, label: String(v)}))}/>
            <//>
            <${UI.TextArea} id="pulse-working" label="What's working" rows=${2} value=${working} onChange=${setWorking} placeholder="One line is enough"/>
            <${UI.TextArea} id="pulse-broken" label="What's broken" rows=${2} value=${broken} onChange=${setBroken} placeholder="One line is enough"/>
            <${UI.TextArea} id="pulse-change" label="One thing Kaavish should change" rows=${2} value=${change} onChange=${setChange} placeholder="One line is enough"/>
            <div class="row between">
              <span class="sub small">${energy ? 'Energy ' + energy + ' of 5.' : 'Pick your energy to send.'}</span>
              <${UI.Btn} disabled=${!energy || busy} onClick=${send}>Send pulse<//>
            </div>
          </div>`}
      </div>
    <//>`;
  }

  /* ---------- founder: team energy over 8 weeks plus every response ---------- */
  function Response({r}) {
    const e = Number(r.energy) || 0;
    const fields = [['working', r.working], ['broken', r.broken], ['change', r.change]]
      .filter(f => f[1] && String(f[1]).trim());
    return html`<div class="listrow"><div class="grow stack tight">
      <div class="row between">
        <${UI.Pill} kind=${e && e < 3 ? 'flame' : undefined}>energy ${e}<//>
        <span class="tiny sub num">${U.timeAgo(r.at || 0)}</span>
      </div>
      ${fields.map(([k, v]) => html`<div key=${k}>
        <${UI.Micro} plain>${k}<//>
        <div style=${{overflowWrap: 'anywhere'}}>${String(v)}</div>
      </div>`)}
      ${fields.length ? null : html`<div class="sub small">Energy only.</div>`}
    </div></div>`;
  }

  function TeamEnergyCard() {
    const ctx = M.useCtx();
    const weeks = energyByWeek(ctx, 8);
    const responses = latest(ctx);
    const cur = weeks[weeks.length - 1];
    const weekNo = w => Number(String(w).split('-W')[1]) || '';
    return html`<${UI.Card} title="Team energy" id="team-energy-card"
      action=${html`<${UI.Pill}>${plural(responses.length, 'response', 'responses')}<//>`}>
      <div class="stack">
        <${UI.Micro}>average energy, last 8 weeks<//>
        <div>
          <div class="vbars" role="img" aria-label="Average energy per week, last 8 weeks">
            ${weeks.map(w => html`<div key=${w.week}
              class=${'vb' + (w.avg != null && w.avg < 3 ? ' low' : '')}
              title=${w.week + (w.avg == null ? ': no responses' : ': ' + w.avg + ' average from ' + plural(w.n, 'response', 'responses'))}
              style=${w.avg == null ? {height: '6px', opacity: .3} : {height: Math.max(6, Math.round(100 * w.avg / 5)) + '%'}}/>`)}
          </div>
          <div style=${{display: 'flex', gap: '7px', marginTop: '5px'}}>
            ${weeks.map(w => html`<div key=${w.week} class="tiny sub num" style=${{flex: 1, minWidth: '8px', textAlign: 'center'}}>${weekNo(w.week)}</div>`)}
          </div>
        </div>
        <div class="sub small">${cur.n
          ? 'This week: ' + cur.avg + ' average from ' + plural(cur.n, 'response.', 'responses.')
          : 'No responses this week yet.'}</div>
        <${UI.Micro}>responses, newest first<//>
        ${responses.length
          ? html`<div>${responses.map(r => html`<${Response} key=${r.id} r=${r}/>`)}</div>`
          : html`<${UI.Empty} text="No pulse responses yet."/>`}
      </div>
    <//>`;
  }

  /* ---------- ideas box: attributed, one +1 per person, founder sets status ---------- */

  /* Author profiles resolved once per card into local state, so every row shows the name as soon as it arrives.
     M.useProfiles wakes only the first subscriber of an id within one commit, so a second subscriber of the
     same id (an avatar next to a name) can keep its fallback until an unrelated re-render. */
  function useAuthors(ctx, ids) {
    const key = Array.from(new Set(ids)).sort().join(',');
    const user = ctx && ctx.user;
    const [profs, setProfs] = useState({});
    React.useEffect(() => {
      if (!key || !user || typeof user.profiles !== 'function') return;
      let live = true;
      Promise.resolve().then(() => user.profiles(key.split(','))).then(ps => {
        if (!live || !ps) return;
        setProfs(prev => {
          const out = {...prev};
          for (const id of Object.keys(ps)) {
            const p = ps[id] || {};
            out[id] = {name: p.name || '', avatarUrl: p.avatarUrl || ''};
          }
          return out;
        });
      }).catch(() => {});
      return () => { live = false; };
    }, [user, key]);
    return profs;
  }

  function IdeaRow({it, p, isFounder, onVote, onStatus}) {
    const name = (p && p.name) || '';
    return html`<div class="listrow" data-idea=${it.key}>
      <img class="av" width="30" height="30" style=${{width: '30px', height: '30px'}}
        src=${(p && p.avatarUrl) || M.AV_FALLBACK} alt=${name || 'avatar'} title=${name}/>
      <div class="grow stack tight">
        <div style=${{overflowWrap: 'anywhere'}}>${it.t}</div>
        <div class="row between">
          <div class="row">
            <span class="small">${name || 'Someone'}</span>
            <span class="tiny sub num">${U.timeAgo(it.at)}</span>
            <${UI.Pill} kind=${pillFor(it.status)}>${it.status}<//>
          </div>
          <div class="row nowrap">
            <span class="tiny sub num">${plural(it.votes, 'vote', 'votes')}</span>
            <button type="button" class=${'emoji-btn' + (it.voted ? ' on' : '')} aria-pressed=${it.voted}
              aria-label=${it.voted ? 'Remove your +1' : 'Give +1'} onClick=${onVote}>+1</button>
          </div>
        </div>
        ${isFounder ? html`<${UI.Seg} sm ariaLabel="Idea status" value=${it.status} onChange=${onStatus}
          options=${STATUS.map(s => ({v: s.v, label: s.label}))}/>` : null}
      </div>
    </div>`;
  }

  function IdeasCard() {
    const ctx = M.useCtx();
    const {W, uid, isFounder} = ctx;
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const ideasMap = collMap(ctx, 'ideas');
    const votesMap = collMap(ctx, 'votes');
    const mine = (votesMap[uid] || {}).v || {};

    const counts = {};
    for (const voter of Object.keys(votesMap)) {
      const v = (votesMap[voter] || {}).v || {};
      for (const k of Object.keys(v)) if (v[k]) counts[k] = (counts[k] || 0) + 1;
    }
    const list = [];
    for (const author of Object.keys(ideasMap)) {
      const items = (ideasMap[author] || {}).items || {};
      for (const id of Object.keys(items)) {
        const it = items[id];
        if (!it || !it.t) continue;
        const key = author + ':' + id;
        list.push({key, author, id, t: String(it.t), at: it.at || 0, status: it.status || 'open',
          votes: counts[key] || 0, voted: !!mine[key]});
      }
    }
    list.sort((a, b) => (b.votes - a.votes) || (b.at - a.at));
    const profs = useAuthors(ctx, list.map(it => it.author));

    const post = async () => {
      const t = text.trim();
      if (!t || busy) return;
      setBusy(true);
      try {
        await W.merge('ideas/' + uid, {items: {[U.uid()]: {t, at: Date.now(), status: 'open'}}});
        setText('');
        M.toast('Idea posted');
      } catch (e) { /* the write layer already toasted the failure */ }
      setBusy(false);
    };
    const toggle = it => {
      if (it.voted) {
        const v = {...mine};
        delete v[it.key];
        W.set('votes/' + uid, {...(votesMap[uid] || {}), v}).catch(() => {});
      } else {
        W.merge('votes/' + uid, {v: {[it.key]: true}}).catch(() => {});
      }
    };
    const setStatus = (it, status) => {
      if (status === it.status) return;
      W.update('ideas/' + it.author, {items: {[it.id]: {status}}});
    };

    return html`<${UI.Card} title="Ideas box" id="ideas-card"
      action=${html`<${UI.Pill}>${plural(list.length, 'idea', 'ideas')}<//>`}>
      <div class="stack">
        <div class="row nowrap">
          <div class="grow"><${UI.Input} id="idea-text" placeholder="One idea in one line" value=${text} onChange=${setText} onEnter=${post}/></div>
          <${UI.Btn} disabled=${!text.trim() || busy} onClick=${post}>Post idea<//>
        </div>
        <div class="sub small">One +1 per person per idea. Kaavish sets the status.</div>
        ${list.length
          ? html`<div>${list.map(it => html`<${IdeaRow} key=${it.key} it=${it} p=${profs[it.author]} isFounder=${isFounder}
              onVote=${() => toggle(it)} onStatus=${s => setStatus(it, s)}/>`)}</div>`
          : html`<${UI.Empty} text="No ideas yet."/>`}
      </div>
    <//>`;
  }

  /* ---------- page ---------- */
  function Voice() {
    const ctx = M.useCtx();
    return html`<${React.Fragment}>
      <${UI.PageHead} micro="pulse and ideas" title="Voice"/>
      <${PulseCard}/>
      ${ctx.isFounder ? html`<${TeamEnergyCard}/>` : null}
      <${IdeasCard}/>
    <//>`;
  }

  M.pages.Voice = Voice;
  M.voice = {energyByWeek, latest};
})();
