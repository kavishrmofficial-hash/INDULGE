/* module: team. Getting people in: the join screen for anyone not on the roster yet,
   join requests the founder approves in one tap, and the invite link card. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState} = React;

  /* the published page; people open this link to join */
  M.APP_URL = 'https://claude.ai/artifact/D6nbirdVBLqU3ZD9qrA8Yq';
  const INVITE = 'You are on m360 OS, the Mask360 workspace. Open ' + M.APP_URL +
    ', sign in to Claude, tap Ask to join and you are in once Kaavish lets you in.';

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); M.toast('Copied'); return true; }
    catch (e) { M.toast('Copy is blocked here. Select the text and copy it.', true); return false; }
  }

  M.team = {
    /* pending requests, newest first, skipping anyone already active on the roster */
    requests(ctx) {
      const map = (ctx.coll.join && ctx.coll.join.map) || {};
      return Object.keys(map)
        .filter(id => !(ctx.members[id] && ctx.members[id].active !== false))
        .map(id => ({uid: id, at: map[id].at || 0, title: String(map[id].title || '').slice(0, 60)}))
        .sort((a, b) => b.at - a.at);
    },
    clear(ctx, id) { return ctx.W.del('join/' + id).catch(() => {}); }
  };

  /* ---------- the join screen, for anyone signed in but not on the roster ---------- */
  function JoinGate() {
    const ctx = M.useCtx();
    const mine = M.useDoc(ctx.db, 'join/' + ctx.uid);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const removed = ctx.member && ctx.member.active === false;
    /* can this viewer write at all? guests from outside the organisation and view-only people cannot */
    const [locked, setLocked] = useState(null);
    React.useEffect(() => {
      let live = true;
      (async () => {
        let canWrite = null, guest = false;
        try { canWrite = ctx.user && ctx.user.can ? await ctx.user.can('data.write') : null; } catch (e) { canWrite = null; }
        try { const ps = await ctx.user.profiles([ctx.uid]); guest = !!(ps[ctx.uid] && ps[ctx.uid].guest); } catch (e) { guest = false; }
        if (live && (guest || canWrite === false)) setLocked(guest ? 'guest' : 'view');
      })();
      return () => { live = false; };
    }, [ctx.uid]);

    async function ask() {
      setBusy(true); setErr('');
      try {
        await ctx.db.doc('join/' + ctx.uid).set({at: Date.now(), title: title.trim().slice(0, 60)});
      } catch (e) {
        const code = e && e.code;
        if (code === 'invalid_argument' || code === 'not_granted') setLocked('view');
        else setErr('That did not send. Try again in a moment.');
      }
      setBusy(false);
    }
    async function cancel() {
      try { await ctx.db.doc('join/' + ctx.uid).delete(); } catch (e) { /* stays pending */ }
    }

    const sent = mine.ready && !!mine.data;
    if (locked && !sent) {
      return html`<${M.Gate} title="Almost there"
        line=${locked === 'guest'
          ? 'You are signed in with a Claude account outside the Mask360 organisation, so this page is read only for you. Kaavish adds you to the organisation, then you reload and ask to join.'
          : 'Your access to this page is view only. Kaavish sets you to Can interact in Share, then you reload and ask to join.'}>
        <div class="join-box"><div class="row" style=${{justifyContent: 'center'}}>
          <${UI.Avatar} id=${ctx.uid} size=${40}/>
          <span style=${{fontWeight: 500}}><${UI.Name} id=${ctx.uid} fallback="You"/></span>
        </div></div>
      <//>`;
    }
    const title0 = sent ? 'Request sent' : removed ? 'Your access is paused' : 'Welcome to m360';
    const line = sent
      ? 'Kaavish sees it on HQ. This page opens by itself the moment you are let in.'
      : removed ? 'Ask to come back and Kaavish can switch you on again.'
      : 'You are signed in. Ask to join and Kaavish lets you in with one tap.';

    return html`<${M.Gate} title=${title0} line=${line}>
      <div class="join-box">
        <div class="row" style=${{justifyContent: 'center', marginBottom: '14px'}}>
          <${UI.Avatar} id=${ctx.uid} size=${40}/>
          <span style=${{fontWeight: 500}}><${UI.Name} id=${ctx.uid} fallback="You"/></span>
        </div>
        ${sent ? html`<div class="stack tight" style=${{alignItems: 'center'}}>
            <${UI.Pill} kind="flame-o">waiting for approval<//>
            <button type="button" class="linky small" onClick=${cancel}>Cancel request</button>
          </div>`
          : html`<div class="stack tight">
            <${UI.Input} id="join-title" label="your role, optional" value=${title} placeholder="Designer, strategist, editor"
              onChange=${setTitle} onEnter=${ask}/>
            <${UI.Btn} onClick=${ask} disabled=${busy || !mine.ready}>${busy ? 'Sending' : 'Ask to join'}<//>
            ${err ? html`<div class="small flame-t" role="alert">${err}</div>` : null}
          </div>`}
      </div>
    <//>`;
  }

  /* ---------- founder: requests waiting ---------- */
  function JoinRequests({onApprove}) {
    const ctx = M.useCtx();
    const reqs = M.team.requests(ctx);
    if (!reqs.length) return null;
    return html`<${UI.Card} flame=${true} id="join-requests" title=${'Waiting to join'}
      action=${html`<${UI.Pill} kind="flame">${reqs.length}<//>`}>
      <div class="stack tight">
        ${reqs.map(r => html`<div class="listrow" key=${r.uid}>
          <${UI.Avatar} id=${r.uid} size=${32}/>
          <div class="grow">
            <div style=${{fontWeight: 500}}><${UI.Name} id=${r.uid}/></div>
            <div class="tiny ink62">${r.title ? r.title + ' · ' : ''}asked ${U.timeAgo(r.at)}</div>
          </div>
          <span class="row nowrap">
            <${UI.Btn} sm=${true} onClick=${() => onApprove(r)}>Let them in<//>
            <${UI.ConfirmBtn} kind="ghost" sm=${true} onConfirm=${() => M.team.clear(ctx, r.uid).then(() => M.toast('Declined'))}>Decline<//>
          </span>
        </div>`)}
      </div>
    <//>`;
  }

  /* ---------- founder: how to invite ---------- */
  function InviteCard({open}) {
    const [show, setShow] = useState(!!open);
    return html`<${UI.Card} id="invite-card" title="Invite your team"
      action=${show ? null : html`<${UI.Btn} kind="sec" sm=${true} onClick=${() => setShow(true)}>Show how<//>`}>
      ${show ? html`<div class="stack" style=${{gap: '14px'}}>
        <ol class="steps">
          <li><b>Give them a seat.</b> Everyone signs in with a Claude account inside the same Claude organisation as this page. Add them as members in your Claude organisation settings. People outside it can only look.</li>
          <li><b>Share this page.</b> Open Share at the top of this page and set your organisation, or each person, to Can interact.</li>
          <li><b>Send them the link.</b> Copy the message below into WhatsApp or Slack.</li>
          <li><b>Let them in.</b> They tap Ask to join. Their request lands here and on HQ, you tap Let them in.</li>
        </ol>
        <div class="invite-link num">${M.APP_URL}</div>
        <div class="row">
          <${UI.Btn} sm=${true} onClick=${() => copy(INVITE)}>Copy invite message<//>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => copy(M.APP_URL)}>Copy link<//>
        </div>
      </div>` : html`<p class="small ink62" style=${{margin: 0}}>Share the page, send the link, approve each request in one tap.</p>`}
    <//>`;
  }

  /* ---------- founder: a nudge on HQ and Home ---------- */
  function JoinBanner() {
    const ctx = M.useCtx();
    if (!ctx.isFounder) return null;
    const reqs = M.team.requests(ctx);
    if (!reqs.length) return null;
    return html`<button type="button" class="card flame rowbtn join-banner" onClick=${() => M.nav('#admin')}>
      <${UI.AvatarRow} ids=${reqs.map(r => r.uid)} size=${28} max=${4}/>
      <span class="grow" style=${{fontWeight: 500}}>${reqs.length === 1
        ? html`<${UI.Name} id=${reqs[0].uid}/> wants to join the team`
        : reqs.length + ' people want to join the team'}</span>
      <span class="btn sm">Let them in</span>
    </button>`;
  }

  M.parts.JoinGate = JoinGate;
  M.parts.JoinRequests = JoinRequests;
  M.parts.InviteCard = InviteCard;
  M.parts.JoinBanner = JoinBanner;
})();
