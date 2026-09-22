/* module: handbook (BRIEF 7.14). Sections, markdown-lite reader, live tokens, live rules. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useMemo, useEffect} = React;

  const TOKENS = ['start', 'grace', 'eodCut', 'mondayCut', 'wfhCap', 'revCap', 'ackHours', 'blockerDays'];

  function sections(ctx) {
    const map = (ctx.coll && ctx.coll.handbook && ctx.coll.handbook.map) || {};
    return Object.keys(map).map(id => ({id, ...map[id]}))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title || '').localeCompare(String(b.title || '')));
  }

  function readsOf(ctx, uid) {
    return ((ctx.coll.acks.map[uid] || {}).s) || {};
  }
  function unread(ctx, uid) {
    const r = readsOf(ctx, uid);
    return sections(ctx).filter(s => (r[s.id] || 0) < (s.updated || 0)).map(s => s.id);
  }

  /* live tokens replaced from settings on every render */
  function fillTokens(text, settings) {
    return String(text == null ? '' : text).replace(/\{\{(\w+)\}\}/g, (m, k) =>
      (TOKENS.indexOf(k) >= 0 && settings[k] != null && settings[k] !== '') ? String(settings[k]) : m);
  }

  /* **bold** runs, as React children (user text never becomes HTML) */
  function inline(text, key) {
    const out = [];
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((p, i) => {
      if (!p) return;
      if (p.length > 4 && p.slice(0, 2) === '**' && p.slice(-2) === '**') {
        out.push(html`<b key=${key + 'b' + i}>${p.slice(2, -2)}</b>`);
      } else out.push(p);
    });
    return out;
  }

  function HandbookBody({body}) {
    const ctx = M.useCtx();
    const src = fillTokens(body, ctx.settings);
    const lines = src.split('\n');
    const nodes = [];
    let para = [], list = [], n = 0;
    const flushPara = () => {
      if (!para.length) return;
      const t = para.join(' ');
      nodes.push(html`<p key=${'p' + (n++)}>${inline(t, 'p' + n)}</p>`);
      para = [];
    };
    const flushList = () => {
      if (!list.length) return;
      const items = list.slice();
      nodes.push(html`<ul key=${'u' + (n++)}>${items.map((it, i) =>
        html`<li key=${i}><span>${inline(it, 'l' + n + i)}</span></li>`)}</ul>`);
      list = [];
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { flushList(); flushPara(); continue; }
      if (line.slice(0, 3) === '## ') { flushList(); flushPara(); nodes.push(html`<h2 key=${'h' + (n++)}>${inline(line.slice(3), 'h' + n)}</h2>`); continue; }
      if (line.slice(0, 2) === '# ') { flushList(); flushPara(); nodes.push(html`<h1 key=${'h' + (n++)}>${inline(line.slice(2), 'h' + n)}</h1>`); continue; }
      if (line.slice(0, 2) === '- ') { flushPara(); list.push(line.slice(2)); continue; }
      flushList(); para.push(line.trim());
    }
    flushList(); flushPara();
    return html`<div class="hb">${nodes}</div>`;
  }

  function LiveRules({sectionId}) {
    const ctx = M.useCtx();
    if (!M.rules || !M.rules.SECTION_RULES) return null;
    const ids = M.rules.SECTION_RULES(sectionId) || [];
    const names = M.rules.NAMES || {};
    const relevant = f => f.rule !== 'R11' || f.section === sectionId;
    return html`<div style=${{marginTop: '18px'}}>
      <${UI.Micro}>live rules<//>
      <div class="stack tight" style=${{marginTop: '10px'}}>
        ${ids.map(rid => {
          const all = (ctx.flags || []).filter(f => f.rule === rid && relevant(f));
          const mine = all.filter(f => f.uid === ctx.uid);
          const who = ctx.isFounder ? all : mine;
          const uids = Array.from(new Set(all.map(f => f.uid)));
          return html`<div class="listrow" key=${rid}>
            <span class="grow">${names[rid] || rid}</span>
            ${ctx.isFounder
              ? (uids.length
                ? html`<span class="row"><span class="small ink62">${uids.map((u, i) => html`<span key=${u}>${i ? ', ' : ''}<${UI.Name} id=${u}/></span>`)}</span>
                    <${UI.Pill} kind="flame">${all.length} ${all.length === 1 ? 'flag' : 'flags'}<//></span>`
                : html`<${UI.Pill} kind="ink">All clear<//>`)
              : (who.length
                ? html`<${UI.Pill} kind="flame">${who.length} ${who.length === 1 ? 'flag' : 'flags'}<//>`
                : html`<${UI.Pill} kind="ink">All clear<//>`)}
          </div>`;
        })}
      </div>
    </div>`;
  }

  function slugOf(title, taken) {
    let base = String(title || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    let s = base, i = 2;
    while (taken.indexOf(s) >= 0) { s = base + '-' + i; i++; }
    return s;
  }

  function EditDrawer({section, onClose}) {
    const ctx = M.useCtx();
    const list = sections(ctx);
    const [f, setF] = useState(() => ({
      title: (section && section.title) || '',
      order: (section && section.order) || (list.length + 1),
      body: (section && section.body) || ''
    }));
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    async function save() {
      if (!f.title.trim()) return;
      const id = section ? section.id : slugOf(f.title, list.map(s => s.id));
      await ctx.W.set('handbook/' + id, {title: f.title.trim(), body: f.body,
        order: Number(f.order) || list.length + 1, updated: Date.now()});
      M.toast('Saved');
      onClose();
      if (!section) M.nav('#handbook/' + id);
    }
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${section ? 'Edit section' : 'New section'}
      footer=${html`<${UI.Btn} onClick=${save} disabled=${!f.title.trim()}>Save section<//>`}>
      <${UI.Input} id="hb-title" label="title" value=${f.title} onChange=${v => set('title', v)}/>
      <${UI.Input} label="position" type="number" value=${f.order} onChange=${v => set('order', v)}/>
      <${UI.TextArea} label="body" rows=${16} value=${f.body} onChange=${v => set('body', v)}
        hint="Use # for a heading, ## for a subheading, - for a list item, and double asterisks for bold."/>
    <//>`;
  }

  function Handbook({id}) {
    const ctx = M.useCtx();
    const [edit, setEdit] = useState(null); /* 'new' or a section object */
    const list = sections(ctx);
    const current = useMemo(() => list.find(s => s.id === id) || list[0] || null, [list, id]);
    const reads = readsOf(ctx, ctx.uid);
    const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 860 : true));
    useEffect(() => {
      const on = () => setWide(window.innerWidth > 860);
      window.addEventListener('resize', on);
      return () => window.removeEventListener('resize', on);
    }, []);

    const isUnread = s => (reads[s.id] || 0) < (s.updated || 0);
    const readers = current ? ctx.activeMembers.filter(m => m.uid !== ctx.founderUid
      && (readsOf(ctx, m.uid)[current.id] || 0) >= (current.updated || 0)) : [];
    const others = ctx.activeMembers.filter(m => m.uid !== ctx.founderUid);
    const meRead = current && !isUnread(current);

    return html`<div class="stack" style=${{gap: '18px'}}>
      <${UI.PageHead} micro="the source of truth" title="Handbook">
        ${ctx.isFounder ? html`<${UI.Btn} onClick=${() => setEdit('new')}>New section<//>` : null}
      <//>
      <div class="grid2" style=${wide ? {gridTemplateColumns: '260px minmax(0,1fr)'} : null}>
        <${UI.Card}>
          <div class="stack tight">
            ${list.length ? list.map(s => html`<button type="button" key=${s.id}
              class=${'side-item' + (current && s.id === current.id ? ' active' : '')}
              onClick=${() => M.nav('#handbook/' + s.id)}>
              <span class="grow">${s.title}</span>
              ${isUnread(s) ? html`<span class="dotflame"/>` : null}
            </button>`) : html`<${UI.Empty} text="No sections yet."/>`}
          </div>
        <//>

        ${current ? html`<${UI.Card}>
          <div class="row between">
            <div>
              <h2 class="pgt" style=${{fontSize: '26px'}}>${current.title}</h2>
              <div class="tiny ink62">updated ${current.updated ? U.timeAgo(current.updated) : 'never'}</div>
            </div>
            ${ctx.isFounder ? html`<div class="row nowrap">
              <${UI.Btn} kind="sec" sm=${true} onClick=${() => setEdit(current)}>Edit<//>
              <${UI.ConfirmBtn} onConfirm=${() => ctx.W.del('handbook/' + current.id).then(() => { M.toast('Deleted'); M.nav('#handbook'); })}>Delete<//>
            </div>` : null}
          </div>
          <hr class="hair"/>
          <${HandbookBody} body=${current.body}/>
          <${LiveRules} sectionId=${current.id}/>
          <hr class="hair"/>
          <div class="row between">
            ${meRead
              ? html`<${UI.Pill} kind="ink">Read<//>`
              : html`<${UI.Btn} onClick=${() => ctx.W.merge('acks/' + ctx.uid, {s: {[current.id]: Date.now()}})
                  .then(() => M.toast('Marked as read'))}>I've read this<//>`}
            ${ctx.isFounder ? html`<div class="row">
              <span class="tiny ink62 num">Read by ${readers.length} of ${others.length}</span>
              ${readers.length ? html`<${UI.AvatarRow} ids=${readers.map(r => r.uid)}/>` : null}
            </div>` : null}
          </div>
        <//>` : html`<${UI.Card}><${UI.Empty} text="No sections yet."/><//>`}
      </div>
      ${edit ? html`<${EditDrawer} section=${edit === 'new' ? null : edit} onClose=${() => setEdit(null)}/>` : null}
    </div>`;
  }

  M.pages.Handbook = Handbook;
  M.parts.HandbookBody = HandbookBody;
  M.handbook = {unread, sections, fillTokens};
})();
