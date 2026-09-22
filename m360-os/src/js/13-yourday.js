/* module: yourday */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef, useCallback} = React;

  /* ---------- connector inputs, fixed references so each watch registers once ---------- */
  const MAIL_INPUT = {query: 'is:unread in:inbox', pageSize: 3, view: 'THREAD_VIEW_MINIMAL'};
  const DRIVE_INPUT = {orderBy: 'recency', pageSize: 5, excludeContentSnippets: true};
  const REFETCH_CAL = 300000;
  const REFETCH_MAIL = 300000;
  const REFETCH_DRIVE = 600000;
  const ICON = {width: '16px', height: '16px', flex: 'none'};
  const WRAP = {overflowWrap: 'anywhere'};

  /* today 00:00 to tomorrow 00:00, local ISO with offset */
  function calendarInput(ymd) {
    const start = U.parseYmd(ymd);
    return {startTime: U.isoLocal(start), endTime: U.isoLocal(U.addDays(start, 1)), orderBy: 'startTime', pageSize: 10};
  }

  /* ---------- pure helpers ---------- */
  const DENY_TEXT = {
    needs_reauth: s => 'Reconnect ' + s + ' in claude.ai Settings, Connectors.',
    server_not_connected: s => 'Add ' + s + ' in claude.ai Settings, Connectors to see it here.',
    not_in_manifest: () => 'Turned off for this page.',
    blocked_by_policy: () => 'Blocked by your organisation.',
    approval_required: () => 'Blocked by your organisation.',
    selection_required: s => 'Choose which ' + s + ' to use when Claude asks.',
    not_granted: s => 'Allow ' + s + ' for this page to see it here.',
    consent_required: s => 'Allow ' + s + ' for this page to see it here.',
    capability_disabled: () => 'Connectors are switched off for this page.',
    capability_removed: () => 'Connectors are switched off for this page.'
  };
  const NEUTRAL = ['not_in_manifest', 'selection_required', 'capability_disabled', 'capability_removed'];

  /* the one line a section shows in place of data, or null when data can render */
  function stateText(server, w) {
    if (!w || w.state === 'ok') return null;
    if (w.state === 'loading' || w.state === 'none') return {text: 'Loading', flame: false};
    const code = w.code || '';
    if (w.state === 'denied') {
      const f = DENY_TEXT[code];
      return {text: f ? f(server) : server + ' is unavailable on this page.', flame: !NEUTRAL.includes(code)};
    }
    if (code === 'tool_error') return {text: w.msg || server + ' returned an error.', flame: true};
    if (code === 'server_unavailable') return {text: server + ' is unreachable right now.', flame: true};
    return {text: w.msg || server + ' failed to load.', flame: true};
  }

  /* "10:30" from start.dateTime, "all day" when only start.date is set */
  function eventTime(ev) {
    const st = (ev && ev.start) || {};
    if (st.dateTime) {
      const t = Date.parse(st.dateTime);
      return isNaN(t) ? '' : U.hhmm(t);
    }
    return 'all day';
  }

  /* only http and https links are rendered as anchors */
  const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;

  /* "15m ago" from an ISO stamp, or "" when it cannot be parsed */
  function agoText(iso) {
    if (!iso) return '';
    const t = Date.parse(iso);
    return isNaN(t) ? '' : U.timeAgo(t);
  }

  const line = (text, flame) => html`<div class=${'small' + (flame ? ' flame-t' : ' sub')}>${text}</div>`;

  /* ---------- section views ---------- */
  function CalendarView({data}) {
    const events = Array.isArray(data && data.events) ? data.events : [];
    if (!events.length) return html`<${UI.Empty} text="Nothing on the calendar today."/>`;
    return html`<div>${events.map((ev, i) => {
      const join = safeUrl(ev && ev.conferenceUrl);
      return html`<div key=${(ev && ev.id) || 'e' + i} class="listrow">
        <span class="num sub small" style=${{width: '56px', flex: 'none'}}>${eventTime(ev)}</span>
        <span class="grow" style=${WRAP}>${(ev && ev.summary) || 'Untitled event'}</span>
        ${join ? html`<a class="linky" href=${join} target="_blank" rel="noopener">Join</a>` : null}
      </div>`;
    })}</div>`;
  }

  function MailView({data}) {
    const threads = Array.isArray(data && data.threads) ? data.threads : [];
    const est = data ? data.resultCountEstimate : null;
    const count = (est == null || est === '') ? String(threads.length) : String(est);
    if (!threads.length && !(Number(count) > 0)) return html`<${UI.Empty} text="No unread mail."/>`;
    return html`<div>
      <div class="num">${count} unread</div>
      ${threads.slice(0, 3).map((t, i) => {
        const m = (t && Array.isArray(t.messages) && t.messages[0]) || {};
        const ago = agoText(m.date);
        return html`<div key=${(t && t.id) || 'm' + i} class="listrow">
          <div class="grow" style=${WRAP}>
            <div>${m.subject || 'No subject'}</div>
            <div class="sub tiny">${m.sender || 'Unknown sender'}</div>
          </div>
          ${ago ? html`<span class="sub tiny num">${ago}</span>` : null}
        </div>`;
      })}
    </div>`;
  }

  function DriveView({data}) {
    const files = Array.isArray(data && data.files) ? data.files : [];
    if (!files.length) return html`<${UI.Empty} text="No recent files."/>`;
    return html`<div>${files.slice(0, 5).map((f, i) => {
      const url = safeUrl(f && f.viewUrl);
      const ago = agoText(f && f.modifiedTime);
      return html`<div key=${(f && f.id) || 'f' + i} class="listrow">
        <span class="grow" style=${WRAP}>${(f && f.title) || 'Untitled file'}</span>
        ${ago ? html`<span class="sub tiny num">${ago}</span>` : null}
        ${url ? html`<a class="linky" href=${url} target="_blank" rel="noopener">Open</a>` : null}
      </div>`;
    })}</div>`;
  }

  /* ---------- permission state, read once per section ---------- */
  function usePerm(permissions, server) {
    const [state, setState] = useState(permissions ? null : 'none');
    const [busy, setBusy] = useState(false);
    const live = useRef(true);
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    const read = useCallback(() => {
      if (!permissions || typeof permissions.state !== 'function') { setState('none'); return; }
      let p;
      try { p = Promise.resolve(permissions.state('mcp:' + server)); } catch (e) { setState('unknown'); return; }
      p.then(s => { if (live.current) setState(typeof s === 'string' ? s : 'unknown'); })
        .catch(() => { if (live.current) setState('unknown'); });
    }, [permissions, server]);
    useEffect(() => { read(); }, [read]);
    /* one request per tap, then a fresh read of the state */
    const request = () => {
      if (busy || !permissions || typeof permissions.request !== 'function') return;
      setBusy(true);
      let p;
      try { p = Promise.resolve(permissions.request(['mcp:' + server])); } catch (e) { p = Promise.reject(e); }
      p.catch(() => {}).then(() => { if (!live.current) return; setBusy(false); read(); });
    };
    return {state, busy, request};
  }

  /* ---------- one connector section ---------- */
  function Live({server, tool, input, ms, view}) {
    const ctx = M.useCtx();
    const w = M.useWatch(ctx && ctx.mcp, server, tool, input, ms);
    const st = stateText(server, w);
    if (st) return line(st.text, st.flame);
    const View = view;
    return html`<div class="stack tight">
      <${View} data=${w.data || {}}/>
      ${w.stale ? html`<div class="sub tiny num">updated ${U.timeAgo(w.at || Date.now())}</div>` : null}
    </div>`;
  }

  function Section({id, server, tool, input, ms, label, icon, view}) {
    const ctx = M.useCtx();
    const perm = usePerm(ctx && ctx.permissions, server);
    let body;
    if (perm.state === null) body = line('Loading', false);
    else if (perm.state === 'prompt') body = html`<div class="stack tight">
      <div class="sub small">Connect ${server} to see it here.</div>
      <div><${UI.Btn} kind="sec" sm disabled=${perm.busy} onClick=${perm.request}>Connect<//></div>
    </div>`;
    else body = html`<${Live} server=${server} tool=${tool} input=${input} ms=${ms} view=${view}/>`;
    const Icon = icon;
    return html`<div class="stack tight" id=${id}>
      <div class="row nowrap ink62" style=${{gap: '7px'}}><${Icon} style=${ICON}/><${UI.Micro} plain>${label}<//></div>
      ${body}
    </div>`;
  }

  /* ---------- the card ---------- */
  function YourDay() {
    const ctx = M.useCtx();
    const today = U.todayStr();
    const calInput = useMemo(() => calendarInput(today), [today]);
    if (!ctx || !ctx.mcp) return null;
    return html`<${UI.Card} title="Your day" id="yourday-card">
      <${Section} id="yourday-calendar" server="Google Calendar" tool="list_events" input=${calInput} ms=${REFETCH_CAL}
        label="calendar" icon=${icons.cal} view=${CalendarView}/>
      <hr class="hair"/>
      <${Section} id="yourday-mail" server="Gmail" tool="search_threads" input=${MAIL_INPUT} ms=${REFETCH_MAIL}
        label="mail" icon=${icons.mail} view=${MailView}/>
      <hr class="hair"/>
      <${Section} id="yourday-drive" server="Google Drive" tool="list_recent_files" input=${DRIVE_INPUT} ms=${REFETCH_DRIVE}
        label="drive" icon=${icons.drive} view=${DriveView}/>
    <//>`;
  }

  M.parts.YourDay = YourDay;
  M.yourday = {calendarInput, eventTime, stateText, agoText, safeUrl, MAIL_INPUT, DRIVE_INPUT};
})();
