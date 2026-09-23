/* m360 OS UI primitives and icons. */
'use strict';
(function () {
  const {html, React} = M;

  /* ---------- icons: 24px line icons, stroke 1.7, round caps ---------- */
  const I = (paths) => function Icon(props) {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{__html: paths}}
      style=${props && props.style} class=${props && props.className}/>`;
  };
  M.icons = {
    today: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>'),
    tasks: I('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="m8.4 12.4 2.5 2.5 4.9-5.3"/>'),
    projects: I('<path d="m12 3 8.5 4.7L12 12.4 3.5 7.7 12 3Z"/><path d="m3.5 12.2 8.5 4.7 8.5-4.7"/><path d="m3.5 16.6 8.5 4.7 8.5-4.7"/>'),
    pitches: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>'),
    clients: I('<path d="M6.2 3.5h11.6L21 8.6 12 20.5 3 8.6l3.2-5.1Z"/><path d="M3 8.6h18M9 8.6l3 11.9 3-11.9"/>'),
    feed: I('<path d="M21 11.6a8.4 8.4 0 0 1-8.5 8.3c-1.5 0-2.9-.3-4.1-1L3 20l1.2-5.1a8 8 0 0 1-.7-3.3A8.4 8.4 0 0 1 12 3.3a8.4 8.4 0 0 1 9 8.3Z"/>'),
    week: I('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 9.8h17M8 2.8V6M16 2.8V6"/>'),
    scores: I('<circle cx="12" cy="9" r="5.7"/><path d="m8.7 13.6-1.5 7 4.8-2.7 4.8 2.7-1.5-7"/>'),
    people: I('<circle cx="9" cy="8.2" r="3.6"/><path d="M2.8 20c.9-3.7 3.3-5.4 6.2-5.4s5.3 1.7 6.2 5.4"/><path d="M15.5 5a3.5 3.5 0 0 1 0 6.5M17.6 14.9c2 .6 3.2 2.2 3.8 4.6"/>'),
    hiring: I('<circle cx="10" cy="8.2" r="3.6"/><path d="M3.6 20c.9-3.7 3.4-5.4 6.4-5.4 1.5 0 2.9.4 4 1.3"/><path d="M18.5 13.5v6M15.5 16.5h6"/>'),
    handbook: I('<path d="M12 5.6C10.4 4.2 8.3 3.6 5.8 3.6c-1 0-1.9.1-2.8.4v14.6c.9-.3 1.8-.4 2.8-.4 2.5 0 4.6.6 6.2 2 1.6-1.4 3.7-2 6.2-2 1 0 1.9.1 2.8.4V4c-.9-.3-1.8-.4-2.8-.4-2.5 0-4.6.6-6.2 2Z"/><path d="M12 5.6v14.6"/>'),
    voice: I('<rect x="9" y="2.8" width="6" height="11.5" rx="3"/><path d="M5.2 11.5a6.8 6.8 0 0 0 13.6 0M12 18.3v2.9"/>'),
    leave: I('<path d="M3.5 19.5h17"/><path d="M12 15.5a6.3 6.3 0 0 0-6.3-6.3A6.3 6.3 0 0 0 12 15.5Zm0 0a6.3 6.3 0 0 1 6.3-6.3A6.3 6.3 0 0 1 12 15.5Zm0 0V6.2"/>'),
    command: I('<circle cx="12" cy="13" r="8.5"/><path d="M12 13l3.6-3.6M8.6 21H4.9M19.1 21h-3.7"/>'),
    desk: I('<path d="M4 8h16M4 8v11M20 8v11M2.8 8 5 4.5h14L21.2 8M8 12h8"/>'),
    more: I('<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>'),
    plus: I('<path d="M12 5.5v13M5.5 12h13"/>'),
    x: I('<path d="m6 6 12 12M18 6 6 18"/>'),
    chevL: I('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
    chevR: I('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
    chevD: I('<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>'),
    search: I('<circle cx="10.8" cy="10.8" r="6.8"/><path d="m15.8 15.8 4.7 4.7"/>'),
    link: I('<path d="M9.5 14.5 14.5 9.5M8 12l-2.4 2.4a3.8 3.8 0 0 0 5.4 5.4L13.4 17M16 12l2.4-2.4a3.8 3.8 0 0 0-5.4-5.4L10.6 7"/>'),
    pin: I('<path d="M12 21.5s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10.3" r="2.6"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>'),
    check: I('<path d="m4.8 12.6 4.6 4.6L19.2 6.9"/>'),
    trash: I('<path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5 7.3 20h9.4l.8-13.5M10 10.5v6M14 10.5v6"/>'),
    edit: I('<path d="M16.8 3.8a2.3 2.3 0 0 1 3.3 3.3L8.5 18.7 3.8 20l1.3-4.7L16.8 3.8Z"/>'),
    send: I('<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z"/>'),
    up: I('<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>'),
    down: I('<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>'),
    cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 9.8h17M8 2.8V6M16 2.8V6"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="m3.8 7.5 8.2 6 8.2-6"/>'),
    drive: I('<path d="M4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 20 6.5h-8L9.8 4H4A1.5 1.5 0 0 0 2.5 5.5V18A1.5 1.5 0 0 0 4 19.5Z"/>'),
    out: I('<path d="M14 4.5h4A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-4M12.5 12H3.5M6.7 8.5 3.2 12l3.5 3.5"/>'),
    map: I('<path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>'),
    bell: I('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    timer: I('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.8M9.5 3h5M12 3v3"/>'),
    moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
    sun: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>'),
    play: I('<path d="M7 4.5v15l12-7.5-12-7.5Z"/>'),
    stop: I('<rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
    grip: I('<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>'),
    trophy: I('<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 2.8M17 6h2.5a2.5 2.5 0 0 1-2.6 2.8M12 14v4M8.5 20.5h7"/>'),
    flame: I('<path d="M12 3c1 3.5 4.5 5 4.5 9.5A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.5C7.5 9 10 7.5 10 4.5c1 .8 2 2 2 3.5Z"/><path d="M12 17v4"/>'),
    breath: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'),
    cmd: I('<path d="M9 9V6.5a2.5 2.5 0 1 0-2.5 2.5H9Zm0 0v6m0-6h6m-6 6H6.5A2.5 2.5 0 1 0 9 17.5V15Zm6-6V6.5A2.5 2.5 0 1 1 17.5 9H15Zm0 0v6m0 0h2.5a2.5 2.5 0 1 1-2.5 2.5V15Z"/>'),
    calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 9.8h17M8 2.8V6M16 2.8V6M8 13h2M12 13h2M8 16.5h2M12 16.5h2"/>'),
    review: I('<path d="M4 6.5h16M4 12h10M4 17.5h7"/><path d="m15.5 15.5 2 2 3.5-4"/>'),
    gift: I('<rect x="3.5" y="9" width="17" height="11.5" rx="2.5"/><path d="M3.5 13h17M12 9v11.5M12 9c-2.5 0-5-1.4-5-3.2C7 4.5 8.2 3.6 9.3 3.6c1.6 0 2.7 2.5 2.7 5.4Zm0 0c2.5 0 5-1.4 5-3.2 0-1.3-1.2-2.2-2.3-2.2-1.6 0-2.7 2.5-2.7 5.4Z"/>')
  };

  /* the m360 mark: injected by the build as M.MARK_SVG */
  M.Mark = function Mark({width}) {
    return html`<span class="mark" style=${width ? {width} : null} dangerouslySetInnerHTML=${{__html: M.MARK_SVG}}/>`;
  };

  /* ---------- primitives ---------- */
  const UI = M.UI = {};

  UI.Card = function Card({title, action, flame, className, children, id}) {
    return html`<section id=${id} class=${'card' + (flame ? ' flame' : '') + (className ? ' ' + className : '')}>
      ${(title || action) ? html`<div class="card-head">
        ${title ? html`<h2 class="card-title">${title}</h2>` : null}
        ${action || null}
      </div>` : null}
      ${children}
    </section>`;
  };

  UI.Micro = function Micro({children, plain}) {
    return html`<div class=${'micro' + (plain ? ' plain' : '')}>${children}</div>`;
  };

  UI.Btn = function Btn({kind, sm, disabled, onClick, children, type, title, ariaLabel}) {
    const cls = 'btn' + (kind === 'sec' ? ' sec' : kind === 'ghost' ? ' ghost' : kind === 'flame' ? ' flame' : '') + (sm ? ' sm' : '');
    return html`<button type=${type || 'button'} class=${cls} disabled=${!!disabled} onClick=${onClick} title=${title} aria-label=${ariaLabel}>${children}</button>`;
  };

  UI.ConfirmBtn = function ConfirmBtn({onConfirm, children, label, sm, kind}) {
    const [armed, setArmed] = React.useState(false);
    React.useEffect(() => {
      if (!armed) return;
      const t = setTimeout(() => setArmed(false), 3500);
      return () => clearTimeout(t);
    }, [armed]);
    const cls = 'btn ' + (armed ? 'arm' : (kind === 'sec' ? 'sec' : kind === 'flame' ? 'flame' : 'ghost')) + (sm !== false ? ' sm' : '');
    return html`<button type="button" class=${cls}
      onClick=${() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      ${armed ? (label || 'Tap again to confirm') : children}</button>`;
  };

  UI.Pill = function Pill({kind, children, title}) {
    const cls = 'pill' + (kind && kind !== 'outline' ? ' ' + kind : '');
    return html`<span class=${cls} title=${title}>${children}</span>`;
  };

  UI.Seg = function Seg({options, value, onChange, sm, ariaLabel}) {
    return html`<div class=${'seg' + (sm ? ' sm' : '')} role="tablist" aria-label=${ariaLabel}>
      ${options.map(o => html`<button key=${o.v} type="button" role="tab" aria-selected=${o.v === value}
        class=${'seg-btn' + (o.v === value ? ' active' : '')}
        onClick=${() => onChange(o.v)}>${o.label}</button>`)}
    </div>`;
  };

  let fieldSeq = 0;
  UI.Field = function Field({label, hint, children}) {
    return html`<div class="field">
      ${label ? html`<label>${label}</label>` : null}
      ${children}
      ${hint ? html`<div class="hint">${hint}</div>` : null}
    </div>`;
  };
  UI.Input = function Input({label, hint, value, onChange, type, placeholder, id, min, max, step, disabled, onEnter, onFocus}) {
    const iid = React.useMemo(() => id || ('f' + (++fieldSeq)), [id]);
    return html`<div class="field">
      ${label ? html`<label for=${iid}>${label}</label>` : null}
      <input id=${iid} class="input" type=${type || 'text'} value=${value == null ? '' : value} placeholder=${placeholder}
        min=${min} max=${max} step=${step} disabled=${disabled}
        onInput=${e => onChange && onChange(e.target.value)} onFocus=${onFocus}
        onKeyDown=${e => { if (onEnter && e.key === 'Enter') onEnter(e.target.value); }}/>
      ${hint ? html`<div class="hint">${hint}</div>` : null}
    </div>`;
  };
  UI.TextArea = function TextArea({label, hint, value, onChange, placeholder, rows, id}) {
    const iid = React.useMemo(() => id || ('f' + (++fieldSeq)), [id]);
    return html`<div class="field">
      ${label ? html`<label for=${iid}>${label}</label>` : null}
      <textarea id=${iid} class="input" rows=${rows || 3} placeholder=${placeholder}
        value=${value == null ? '' : value} onInput=${e => onChange && onChange(e.target.value)}/>
      ${hint ? html`<div class="hint">${hint}</div>` : null}
    </div>`;
  };
  UI.Select = function Select({label, value, onChange, options, id, hint}) {
    const iid = React.useMemo(() => id || ('f' + (++fieldSeq)), [id]);
    return html`<div class="field">
      ${label ? html`<label for=${iid}>${label}</label>` : null}
      <select id=${iid} class="input" value=${value == null ? '' : value} onChange=${e => onChange && onChange(e.target.value)}>
        ${options.map(o => html`<option key=${o.v} value=${o.v}>${o.label}</option>`)}
      </select>
      ${hint ? html`<div class="hint">${hint}</div>` : null}
    </div>`;
  };
  UI.Check = function Check({label, checked, onChange}) {
    return html`<label class="checkline"><input type="checkbox" checked=${!!checked}
      onChange=${e => onChange && onChange(e.target.checked)}/><span>${label}</span></label>`;
  };

  UI.Drawer = function Drawer({open, onClose, title, children, footer, head}) {
    React.useEffect(() => {
      if (!open) return;
      const on = e => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', on);
      return () => window.removeEventListener('keydown', on);
    }, [open, onClose]);
    if (!open) return null;
    return html`<div>
      <div class="scrim" onClick=${onClose}/>
      <div class="drawer" role="dialog" aria-modal="true" aria-label=${title}>
        <div class="drawer-head">
          <h2>${title}</h2>
          <div class="row nowrap">${head || null}
            <button type="button" class="iconbtn" aria-label="Close" onClick=${onClose}><${M.icons.x}/></button></div>
        </div>
        <div class="drawer-body">${children}</div>
        ${footer ? html`<div class="drawer-foot">${footer}</div>` : null}
      </div>
    </div>`;
  };

  UI.Avatar = function Avatar({id, size, title}) {
    const ps = M.useProfiles(id ? [id] : []);
    const p = id ? ps[id] : null;
    const s = size || 28;
    return html`<img class="av" width=${s} height=${s} style=${{width: s + 'px', height: s + 'px'}}
      src=${p ? p.avatarUrl : M.AV_FALLBACK} alt=${p && p.name ? p.name : 'avatar'} title=${title || (p && p.name) || ''}/>`;
  };
  UI.AvatarRow = function AvatarRow({ids, size, max}) {
    const list = (ids || []).slice(0, max || 6);
    return html`<span class="av-row">${list.map(id => html`<${UI.Avatar} key=${id} id=${id} size=${size || 24}/>`)}
      ${(ids || []).length > list.length ? html`<span class="pill warm">+${ids.length - list.length}</span>` : null}</span>`;
  };
  UI.Name = function Name({id, fallback}) {
    const ps = M.useProfiles(id ? [id] : []);
    const p = id ? ps[id] : null;
    return html`<span data-uid=${id || ''}>${(p && p.name) || fallback || 'Someone'}</span>`;
  };

  UI.Empty = function Empty({text}) {
    return html`<div class="sub small">${text}</div>`;
  };

  UI.Bar = function Bar({a, b, max, thin}) {
    const t = Math.max(1, max || 1);
    const wa = Math.max(0, Math.min(100, 100 * (a || 0) / t));
    const wb = Math.max(0, Math.min(100 - wa, 100 * (b || 0) / t));
    return html`<span class=${'bar grow' + (thin ? ' thin' : '')}>
      <i style=${{width: wa + '%'}}/>${b != null ? html`<i class="warmfill" style=${{width: wb + '%'}}/>` : null}
    </span>`;
  };

  /* a sparkline: points scaled into a small SVG, flame dot on the last value */
  UI.Spark = function Spark({values, width, height, hot}) {
    const vs = (values || []).map(v => (v == null ? null : Number(v)));
    const w = width || 120, h = height || 32, pad = 3;
    const nums = vs.filter(v => v != null && isFinite(v));
    if (nums.length < 2) return html`<svg class="sparkline" viewBox=${'0 0 ' + w + ' ' + h} width=${w} height=${h} aria-hidden="true"/>`;
    const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
    const pts = vs.map((v, i) => v == null ? null : [pad + (i / (vs.length - 1)) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)]);
    let d = '', last = null;
    pts.forEach(p => { if (!p) return; d += (d ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); last = p; });
    return html`<svg class=${'sparkline' + (hot ? ' hot' : '')} viewBox=${'0 0 ' + w + ' ' + h} width=${w} height=${h} aria-hidden="true">
      <path d=${d} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${last ? html`<circle cx=${last[0]} cy=${last[1]} r="2.6" fill="var(--flame)"/>` : null}
    </svg>`;
  };

  /* a number that rolls up to its value */
  UI.Num = function Num({value, className}) {
    const v = M.useCountUp(value);
    return html`<span class=${'num' + (className ? ' ' + className : '')}>${v}</span>`;
  };

  UI.PageHead = function PageHead({micro, title, children}) {
    return html`<header class="page-head">
      ${micro ? html`<${UI.Micro}>${micro}<//>` : null}
      <div class="head-row"><h1 class="pgt">${title}</h1><div class="row">${children || null}</div></div>
    </header>`;
  };
})();
