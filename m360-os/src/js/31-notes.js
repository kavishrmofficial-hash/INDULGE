/* module: notes. A private notebook for each person: rough work, thoughts, whatever. Nobody else can read
   it, not even the founder (it lives under data/users/<uid>, the private space). An index of notes at
   data/users/<uid>/notes, each note's text at data/users/<uid>/note.<id>. Saves itself as you type. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const NOTE_MAX = 60000;
  const indexPath = ctx => 'data/users/' + ctx.uid + '/notes';
  const notePath = (ctx, id) => 'data/users/' + ctx.uid + '/note.' + id;
  const firstLine = t => String(t || '').split('\n').map(x => x.trim()).find(Boolean) || '';

  function Notes() {
    const ctx = M.useCtx();
    const idx = M.useDoc(ctx.db, indexPath(ctx));
    const items = (idx.data && idx.data.items) || {};
    const ids = useMemo(() => Object.keys(items).filter(k => items[k] && !items[k].gone).sort((a, b) => ((items[b].pinned ? 1 : 0) - (items[a].pinned ? 1 : 0)) || ((items[b].updated || 0) - (items[a].updated || 0))), [idx.data]);
    const [cur, setCur] = useState(() => { try { return localStorage.getItem('m360.note') || ''; } catch (e) { return ''; } });
    const [q, setQ] = useState('');
    const phone = M.usePhone();
    const [listOpen, setListOpen] = useState(true);
    useEffect(() => { if (idx.ready && ids.length && (!cur || !items[cur])) setCur(ids[0]); }, [idx.ready, ids.join(',')]);
    useEffect(() => { try { if (cur) localStorage.setItem('m360.note', cur); } catch (e) { /* private */ } }, [cur]);

    const make = async () => {
      const id = U.uid();
      await ctx.W.merge(indexPath(ctx), {items: {[id]: {title: '', updated: Date.now(), at: Date.now()}}});
      await ctx.W.set(notePath(ctx, id), {text: '', updated: Date.now()}).catch(() => {});
      setCur(id); setListOpen(false);
    };
    const pin = async id => { await ctx.W.merge(indexPath(ctx), {items: {[id]: {pinned: !(items[id] && items[id].pinned)}}}); };
    const remove = async id => {
      await ctx.W.merge(indexPath(ctx), {items: {[id]: {gone: true, updated: Date.now()}}});
      await ctx.W.del(notePath(ctx, id)).catch(() => {});
      if (cur === id) setCur('');
      M.toast('Note deleted');
    };
    const shown = ids.filter(id => !q || String(items[id].title || '').toLowerCase().includes(q.toLowerCase()));

    const list = html`<aside class="notes-list" id="notes-list">
      <div class="row nowrap" style=${{gap: '6px'}}>
        <input id="notes-q" class="input grow" placeholder="Find a note" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Find a note"/>
        <${UI.Btn} sm=${true} id="notes-new" onClick=${make}>New<//>
      </div>
      <div class="stack tight" style=${{marginTop: '8px'}}>
        ${!idx.ready ? html`<${M.Thinking} label="Opening your notes"/>` : !shown.length ? html`<div class="small ink62" style=${{padding: '8px 2px'}}>${ids.length ? 'No note matches.' : 'Nothing here yet. Your notes are yours alone.'}</div>`
          : shown.map(id => html`<button key=${id} type="button" class=${'note-row' + (id === cur ? ' active' : '')} onClick=${() => { setCur(id); setListOpen(false); }}>
            <span class="grow" style=${{minWidth: 0}}><span class="note-title">${items[id].pinned ? html`<span class="note-pinned">pinned</span>` : null}${items[id].title || 'Untitled'}</span>
              <span class="tiny ink62">${items[id].updated ? U.timeAgo(items[id].updated) : ''}</span></span>
          </button>`)}
      </div>
    </aside>`;

    return html`<div class=${'notes' + (phone ? (listOpen ? ' show-list' : ' show-pane') : '')} id="notes">
      ${list}
      <section class="notes-pane">
        ${cur && items[cur] ? html`<${Editor} key=${cur} ctx=${ctx} id=${cur} meta=${items[cur]} onPin=${() => pin(cur)} onRemove=${() => remove(cur)} onBack=${phone ? () => setListOpen(true) : null}/>`
          : html`<div class="notes-empty"><${UI.Empty} text="Pick a note, or make one. Only you can read them."/></div>`}
      </section>
    </div>`;
  }

  function Editor({ctx, id, meta, onPin, onRemove, onBack}) {
    const doc = M.useDoc(ctx.db, notePath(ctx, id));
    const [text, setText] = useState(null);
    const [saved, setSaved] = useState('');
    const timer = useRef(0);
    const dirty = useRef(false);
    useEffect(() => { if (doc.ready && text === null) setText((doc.data && doc.data.text) || ''); }, [doc.ready]);
    const save = async t => {
      const title = firstLine(t).slice(0, 80);
      await ctx.W.merge(notePath(ctx, id), {text: t.slice(0, NOTE_MAX), updated: Date.now()}).catch(() => {});
      await ctx.W.merge(indexPath(ctx), {items: {[id]: {title, updated: Date.now()}}}).catch(() => {});
      dirty.current = false; setSaved(U.hhmm ? U.hhmm(new Date()) : 'now');
    };
    const onInput = t => {
      setText(t); dirty.current = true; setSaved('');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save(t), 700);
    };
    useEffect(() => () => { clearTimeout(timer.current); }, []);
    /* leaving with unsaved keystrokes: save now */
    useEffect(() => { const f = () => { if (dirty.current && text != null) save(text); }; window.addEventListener('beforeunload', f); return () => { window.removeEventListener('beforeunload', f); f(); }; }, [text]);
    if (text === null) return html`<div style=${{padding: '20px'}}><${M.Thinking} label="Opening"/></div>`;
    const words = String(text).trim() ? String(text).trim().split(/\s+/).length : 0;
    return html`<div class="note-editor">
      <div class="row between nowrap note-head">
        <div class="row nowrap" style=${{gap: '8px', minWidth: 0}}>
          ${onBack ? html`<button type="button" class="iconbtn" aria-label="All notes" onClick=${onBack}><${icons.more}/></button>` : null}
          <span class="small ink62">${saved ? 'Saved ' + saved : dirty.current ? 'Saving' : 'Only you can read this'}${meta.updated ? ' · ' + U.timeAgo(meta.updated) : ''}</span>
        </div>
        <span class="row nowrap" style=${{gap: '6px'}}>
          <button type="button" class="linky tiny" id="note-pin" onClick=${onPin}>${meta.pinned ? 'Unpin' : 'Pin'}</button>
          <${UI.ConfirmBtn} kind="ghost" sm=${true} onConfirm=${onRemove}>Delete<//>
        </span>
      </div>
      <textarea id="note-text" class="note-text" value=${text} placeholder="Write anything. The first line becomes the title." spellCheck="true"
        onInput=${e => onInput(e.target.value)} aria-label="Note"/>
      <div class="tiny ink62 num note-foot">${words} words${text.length > NOTE_MAX * .9 ? ' · near the size limit, start a new note' : ''}</div>
    </div>`;
  }

  M.pages.Notes = Notes;
  M.parts.Notes = Notes;
})();
