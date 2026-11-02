/* module: character. Me > Your character: everyone styles the character the office draws for them, and
   Kaavish can restyle anyone, lock a look or unlock it (Admin > Characters).

     me/<uid>.look   written by the person on Save (me/{self}), or by Kaavish on Restyle with by set
     office/cast     Kaavish's locks {v, at, locks: {uid: {look, at}}}, created with set, then whole-map updates

   Nothing writes until Save. Every tile is the person's own 2D head with that one option changed (M.cast), and
   the preview is a live 3D turntable on the shared renderer when this device draws the office in 3D. */
'use strict';
(function () {
  const {html, React, UI} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const TABS = [
    {v: 'skin', label: 'Skin'}, {v: 'face', label: 'Face'}, {v: 'eyes', label: 'Eyes'}, {v: 'brows', label: 'Brows'},
    {v: 'hair', label: 'Hair'}, {v: 'facial', label: 'Facial hair'}, {v: 'glasses', label: 'Glasses'}, {v: 'head', label: 'Headwear'},
    {v: 'top', label: 'Top'}, {v: 'bottom', label: 'Bottom and shoes'}, {v: 'extras', label: 'Extras'}, {v: 'pose', label: 'Pose'}];
  /* what each tab offers: rows of shapes (head tiles, or words where a head cannot show the part) and swatches */
  const PANELS = {
    skin: [{k: 'skin', tiles: true}],
    face: [{k: 'face'}, {k: 'nose', label: 'nose'}, {k: 'mouth', label: 'mouth'}],
    eyes: [{k: 'eyes'}],
    brows: [{k: 'brows'}],
    hair: [{k: 'hair'}, {k: 'hairColor', label: 'colour'}],
    facial: [{k: 'facial'}],
    glasses: [{k: 'glasses'}, {k: 'frame', label: 'frame'}],
    head: [{k: 'head'}, {k: 'headColor', label: 'colour'}],
    top: [{k: 'top'}, {k: 'topColor', label: 'colour'}],
    bottom: [{k: 'bottom', words: true}, {k: 'bottomColor', label: 'colour'}, {k: 'shoes', words: true, label: 'shoes'}, {k: 'shoeColor', label: 'colour'}],
    extras: [{k: 'ears', label: 'ears'}, {flags: true}],
    pose: [{k: 'pose', words: true}]
  };
  const WORD = {
    s1: 'Tone 1', s2: 'Tone 2', s3: 'Tone 3', s4: 'Tone 4', s5: 'Tone 5', s6: 'Tone 6', s7: 'Tone 7', s8: 'Tone 8', clay: 'Clay',
    crew: 'Crew neck', bucket: 'Bucket hat', scarf: 'Headscarf', short: 'Short beard', full: 'Full beard', soft: 'Soft',
    pockets: 'Hands in pockets', folded: 'Arms folded', mug: 'With a mug', easy: 'Easy', stud: 'Nose stud', bindi: 'Bindi', watch: 'Watch'
  };
  const wordOf = v => WORD[v] || (v.charAt(0).toUpperCase() + v.slice(1));
  const rgb = c => 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';

  /* ---------- the preview: the 3D turntable when the office is 3D on this device, else the 2D head ---------- */
  function readToken(name) {
    /* a CSS token as sRGB bytes: a probe's computed colour, painted over the paper into a 1 by 1 canvas */
    try {
      const probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const g = cv.getContext('2d');
      probe.style.color = 'var(--paper)';
      g.fillStyle = getComputedStyle(probe).color; g.fillRect(0, 0, 1, 1);
      probe.style.color = 'var(' + name + ')';
      g.fillStyle = getComputedStyle(probe).color; g.fillRect(0, 0, 1, 1);
      probe.remove();
      const d = g.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return null; }
  }
  function Turntable({look, founder, label}) {
    const host = useRef(null);
    const st = useRef(null);
    const [flat, setFlat] = useState(false);
    const key = M.cast.hash(look, founder ? 'F' : '');
    useEffect(() => {
      let alive = true;
      const O = M.office3d, el = host.current;
      const draw = () => {
        const s = st.current;
        if (!s || !s.rig || !el) return;
        const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
        if (s.w !== w || s.h !== h) { s.w = w; s.h = h; s.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); s.r.setSize(w, h, false); s.cam.aspect = w / h; s.cam.updateProjectionMatrix(); }
        s.rig.root.rotation.y = s.yaw;
        s.r.setClearColor(s.ground, 1);
        s.r.render(s.scene, s.cam);
      };
      const tint = () => {
        const s = st.current;
        if (!s) return;
        const T = s.T, c = v => new T.Color().setRGB(v[0] / 255, v[1] / 255, v[2] / 255, T.SRGBColorSpace);
        const read = n => readToken(n) || [128, 128, 128];
        /* people keep their physical colours, so the light is always the light end of the theme: paper by day,
           the inverted ink at night */
        const paper = read('--paper'), ink = read('--ink');
        const light = paper[0] + paper[1] + paper[2] >= ink[0] + ink[1] + ink[2] ? paper : ink;
        s.ground = c(read('--warm'));
        s.hemi.color = c(light); s.hemi.groundColor = c(read('--col'));
        s.sun.color = c(light);
        draw();
      };
      O.load().then(T => {
        if (!alive || !el) return;
        /* the shared renderer: acquire hands over {gl, canvas}, or null while the office holds it */
        const got = O.acquire(el, 'editor');
        const r = got && (got.gl || got.renderer || got);
        if (!r || typeof r.render !== 'function') { if (got) O.release(el); setFlat(true); return; }
        const canvas = got.canvas || r.domElement;
        if (canvas && canvas.parentNode !== el) el.appendChild(canvas);
        /* the stage is the one tab stop here; the office gets its canvas back focusable */
        const tab = canvas ? canvas.tabIndex : 0;
        if (canvas) canvas.tabIndex = -1;
        const scene = new T.Scene();
        const hemi = new T.HemisphereLight(undefined, undefined, 0.75);
        const sun = new T.DirectionalLight(undefined, 2.2);
        sun.position.set(-2.5, 4, 3.5);
        scene.add(hemi, sun);
        const cam = new T.PerspectiveCamera(22, 1, 0.1, 40);
        cam.position.set(0, 1.12, 3.8); cam.lookAt(0, 0.66, 0);
        st.current = {T, r, scene, cam, hemi, sun, rig: null, yaw: -0.35, w: 0, h: 0, draw};
        tint();
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
        if (ro) ro.observe(el);
        st.current.off = [M.theme.subscribe(() => setTimeout(tint, 0)), () => ro && ro.disconnect(), () => { if (canvas) canvas.tabIndex = tab; }];
        el.dispatchEvent(new CustomEvent('cast:ready'));
      }).catch(() => setFlat(true));
      return () => {
        alive = false;
        const s = st.current;
        st.current = null;
        if (s) { (s.off || []).forEach(f => f && f()); if (s.rig) { s.scene.remove(s.rig.root); s.rig.dispose(); } }
        try { O.release(el); } catch (e) { /* already released */ }
      };
    }, []);
    useEffect(() => {
      const build = () => {
        const s = st.current;
        if (!s) return;
        if (s.rig) { s.scene.remove(s.rig.root); s.rig.dispose(); }
        s.rig = M.figure.build(s.T, look, {founder, lod: 0});
        s.scene.add(s.rig.root);
        s.draw();
      };
      build();
      const el = host.current;
      if (el) el.addEventListener('cast:ready', build);
      return () => { if (el) el.removeEventListener('cast:ready', build); };
    }, [key]);
    const drag = useRef(null);
    const turn = d => { const s = st.current; if (s) { s.yaw += d; s.draw(); } };
    if (flat) return html`<${Head2d} look=${look} founder=${founder}/>`;
    return html`<div class="cast-stage cast-3d" ref=${host} tabIndex="0" role="img" aria-label=${label || 'Your character'}
      onPointerDown=${e => { drag.current = e.clientX; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ } }}
      onPointerMove=${e => { if (drag.current == null) return; turn((e.clientX - drag.current) * 0.012); drag.current = e.clientX; }}
      onPointerUp=${() => { drag.current = null; }} onPointerCancel=${() => { drag.current = null; }}
      onKeyDown=${e => { if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-0.3); } if (e.key === 'ArrowRight') { e.preventDefault(); turn(0.3); } }}/>`;
  }
  function Head2d({look, founder}) {
    return html`<div class="cast-stage"><img class="cast-big" src=${M.cast.head2d(look, {founder, size: 176}).url} alt="" width="176" height="176"/></div>`;
  }
  function Preview({look, founder, label}) {
    const O = M.office3d;
    const mode = O && O.useMode && M.figure ? O.useMode('editor') : 'flat';
    return mode === '3d' ? html`<${Turntable} look=${look} founder=${founder} label=${label}/>` : html`<${Head2d} look=${look} founder=${founder}/>`;
  }

  /* ---------- the parts ---------- */
  function Tiles({k, words, draft, founder, set, ro}) {
    const C = M.cast;
    const list = C.SHAPES[k] || (C.COLOURS[k] || []).map(x => x.id);
    if (words) {
      return html`<div class="cast-words" role="group" aria-label=${k}>${list.map(v => html`<button key=${v} type="button"
        class=${'cast-word' + (draft[k] === v ? ' on' : '')} aria-pressed=${draft[k] === v} disabled=${ro} onClick=${() => set({[k]: v})}>${wordOf(v)}</button>`)}</div>`;
    }
    return html`<div class="cast-tiles" role="group" aria-label=${k}>${list.map(v => html`<button key=${v} type="button" data-part=${k} data-v=${v}
      class=${'cast-tile' + (draft[k] === v ? ' on' : '')} aria-pressed=${draft[k] === v} disabled=${ro} onClick=${() => set({[k]: v})}>
      <img src=${C.head2d({...draft, [k]: v}, {founder, size: 64}).url} alt="" width="52" height="52" loading="lazy"/>
      <span>${wordOf(v)}</span></button>`)}</div>`;
  }
  function Swatches({k, draft, set, ro}) {
    const list = M.cast.COLOURS[k] || [];
    return html`<div class="cast-swatches" role="group" aria-label=${k}>${list.map(x => html`<button key=${x.id} type="button" data-part=${k} data-v=${x.id}
      class=${'cast-sw' + (draft[k] === x.id ? ' on' : '')} style=${{background: rgb(x.c)}} title=${wordOf(x.id)} aria-label=${wordOf(x.id)}
      aria-pressed=${draft[k] === x.id} disabled=${ro} onClick=${() => set({[k]: x.id})}/>`)}</div>`;
  }
  function Panel({tab, draft, founder, set, ro}) {
    const C = M.cast;
    return html`<div class="cast-panel stack tight">${(PANELS[tab] || []).map((row, i) => {
      const head = row.label ? html`<div class="micro plain cast-row-label">${row.label}</div>` : null;
      if (row.flags) return html`<div key=${i} class="stack tight">${C.FLAGS.map(f => html`<div key=${f} class=${ro ? 'cast-ro' : ''}>
        <${UI.Check} label=${wordOf(f)} checked=${draft[f]} onChange=${v => !ro && set({[f]: !!v})}/></div>`)}</div>`;
      const colour = !!C.COLOURS[row.k] && !row.tiles;
      return html`<div key=${i} class="stack tight">${head}${colour ? html`<${Swatches} k=${row.k} draft=${draft} set=${set} ro=${ro}/>`
        : html`<${Tiles} k=${row.k} words=${row.words} draft=${draft} founder=${founder} set=${set} ro=${ro}/>`}</div>`;
    })}</div>`;
  }

  /* ---------- the sheet ---------- */
  function CharacterSheet({uid, onClose, inline}) {
    const ctx = M.useCtx();
    const C = M.cast;
    const who = uid || (ctx && ctx.uid);
    const own = !!ctx && who === ctx.uid;
    /* the owner restyles anyone; anyone else only ever edits their own */
    const may = !!ctx && !!C && (own || !!ctx.isOwner);
    const r = useMemo(() => C && ctx ? C.resolveFor(ctx, who) : null, [ctx && ctx.coll && ctx.coll.me, ctx && ctx.office, who]);
    const base = useMemo(() => r ? C.clean({...r.look, pic: r.pic}) : null, [r]);
    const [draft, setDraft] = useState(base);
    const touched = useRef(false);
    /* until the person touches a part, the sheet follows the saved look (it may arrive after the sheet opens) */
    const baseKey = base ? C.hash(base) + base.pic : '';
    useEffect(() => { if (!touched.current) setDraft(base); }, [baseKey]);
    const [tab, setTab] = useState('skin');
    const [busy, setBusy] = useState(false);
    const ps = M.useProfiles(own || !who ? [] : [who]);
    if (!ctx || !C || !r || !draft) return null;
    const founder = r.founder;
    /* a member's sheet is read only while Kaavish holds a lock on it; his own sheet never is */
    const ro = !may || (own && r.locked);
    const dirty = C.hash(draft) !== C.hash(base) || draft.pic !== base.pic;
    const set = patch => { if (ro) return; touched.current = true; setDraft(d => C.clean({...d, ...patch})); };
    const save = async () => {
      if (ro || busy) return;
      setBusy(true);
      const look = C.clean(draft);
      delete look.by; delete look.at;
      const at = Date.now();
      try {
        if (own) {
          await ctx.W.merge('me/' + ctx.uid, {look: {...look, by: null, at}});
          M.toast('Saved. This is you in the office now.');
        } else {
          await ctx.W.merge('me/' + who, {look: {...look, pic: base.pic, by: ctx.uid, at}});
          /* a locked look is what shows, so a restyle of a locked person moves the lock with it */
          if (r.locked) await writeLocks(ctx, {[who]: {look: {...look, pic: 'auto'}, at}});
          M.toast('Saved. Their character shows the new look.');
        }
        if (inline) touched.current = false;
        if (onClose) onClose();
      } catch (e) { /* the write toasted */ }
      setBusy(false);
    };
    const name = own ? '' : ((ps[who] && ps[who].name) || '');
    const note = own && r.locked ? 'Kaavish set this look for you.'
      : own && r.src === 'own' && r.by && r.by === ctx.founderUid && !founder ? 'Kaavish styled your character. Change it any time.' : null;
    const footer = ro ? null : html`<div class="cast-foot">
      ${own ? html`<${UI.Check} label="Show my character where my photo goes" checked=${draft.pic === 'char'} onChange=${v => set({pic: v ? 'char' : 'auto'})}/>` : null}
      <span class="grow"/>
      <${UI.Btn} id="cast-save" disabled=${busy || !dirty} onClick=${save}>Save character<//>
    </div>`;
    const body = html`<div class="cast-sheet" id="cast-sheet" data-uid=${who} data-ro=${ro ? '1' : '0'} data-inline=${inline ? '1' : '0'}>
        ${own && !ro ? html`<div class="small ink62">Pick what feels like you. You can change it any time.</div>` : own ? null : html`<${UI.Micro}>character<//>`}
        ${note ? html`<div class="cast-note small" id="cast-note">${note}</div>` : null}
        <div class="cast-preview">
          <${Preview} look=${draft} founder=${founder} label=${own ? 'Your character' : (name || 'character')}/>
          ${ro ? null : html`<div class="cast-tools">
            <${UI.Btn} kind="sec" sm=${true} id="cast-shuffle" onClick=${() => { touched.current = true; setDraft(d => C.shuffle(Math.random, d)); }}>Shuffle<//>
            <${UI.Btn} kind="ghost" sm=${true} id="cast-undo" disabled=${!dirty} onClick=${() => { touched.current = false; setDraft(base); }}>Undo changes<//>
          </div>`}
        </div>
        <${UI.Seg} sm=${true} ariaLabel="Character parts" options=${TABS} value=${tab} onChange=${setTab}/>
        <${Panel} tab=${tab} draft=${draft} founder=${founder} set=${set} ro=${ro}/>
      </div>`;
    /* v37: Me, Character shows the sheet on the page itself */
    if (inline) return html`<${UI.Card} id="character-page-card" title=${own ? 'Style your character' : (name || 'Style your character')}>${body}${footer}<//>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${own ? 'Style your character' : (name || 'Style your character')} footer=${footer}>${body}<//>`;
  }

  /* ---------- emotes (v37): a wave, a high five, a coffee. The latest sits on the person's me doc as
     emote {e, at}; the office shows it over their character for about six seconds ---------- */
  const EMOTES = [{e: 'wave', ch: '\u{1F44B}', label: 'Wave'}, {e: 'five', ch: '\u{1F64C}', label: 'High five'}, {e: 'coffee', ch: '\u2615', label: 'Coffee'},
    {e: 'clap', ch: '\u{1F44F}', label: 'Clap'}, {e: 'fire', ch: '\u{1F525}', label: 'On fire'}, {e: 'party', ch: '\u{1F389}', label: 'Party'}];
  const EMOTE_OF = {};
  EMOTES.forEach(x => { EMOTE_OF[x.e] = x; });
  function EmoteBar({compact}) {
    const ctx = M.useCtx();
    const [sent, setSent] = useState('');
    const last = useRef(0);
    if (!ctx || !ctx.uid || ctx.viewAs) return null;
    const send = async e => {
      const now = Date.now();
      if (now - last.current < 1500) return;
      last.current = now;
      setSent(e);
      try { await ctx.W.merge('me/' + ctx.uid, {emote: {e, at: Date.now()}}); } catch (err) { /* the write toasted */ }
      setTimeout(() => setSent(''), 1800);
    };
    return html`<div class=${'emote-bar' + (compact ? ' compact' : '')} role="toolbar" aria-label="Send an emote to the office" id=${compact ? 'office-emotes' : 'emote-bar'}>
      ${EMOTES.map(x => html`<button key=${x.e} type="button" class=${'emote-btn' + (sent === x.e ? ' on' : '')} data-e=${x.e} title=${x.label} aria-label=${x.label}
        onClick=${() => send(x.e)}><span class="emote-ch" aria-hidden="true">${x.ch}</span>${compact ? null : html`<span class="tiny">${x.label}</span>`}</button>`)}
    </div>`;
  }
  /* v39: when an emote happened, on this device's clock. at comes from the sender's phone, and two phones'
     clocks are never compared: an emote that changes while this page watches is timed from when it arrived here.
     The sender's at only places the ones already there when the page first sees the me docs. One clock per
     reader: see(coll, now) returns [{uid, e, at, seen}] with seen in this device's time */
  function emoteClock() {
    let primed = false;
    const last = {};
    return function see(coll, now) {
      const map = (coll && coll.map) || {};
      if (!primed && !(coll && coll.ready)) return [];
      const out = [];
      for (const uid of Object.keys(map)) {
        const m = map[uid] && map[uid].emote;
        if (!m || !EMOTE_OF[m.e]) continue;
        const at = Number(m.at) || 0;
        let r = last[uid];
        if (!r || r.at !== at) r = last[uid] = {at, seen: primed ? now : Math.min(now, at)};
        out.push({uid, e: m.e, at, seen: r.seen});
      }
      primed = true;
      return out;
    };
  }
  /* the last few emotes, as a line: for the flat office, and anyone who looks away for a second */
  function EmoteFeed() {
    const ctx = M.useCtx();
    const [, tick] = useState(0);
    const clock = useRef(null);
    if (!clock.current) clock.current = emoteClock();
    const now = Date.now();
    const recent = clock.current(ctx && ctx.coll && ctx.coll.me, now).filter(x => x.seen > now - 15000)
      .sort((a, b) => b.seen - a.seen).slice(0, 4);
    const soonest = recent.length ? Math.min(...recent.map(x => x.seen + 15000 - now)) : 0;
    useEffect(() => { if (!soonest) return undefined; const t = setTimeout(() => tick(n => n + 1), Math.max(500, soonest + 50)); return () => clearTimeout(t); }, [soonest]);
    if (!recent.length) return null;
    return html`<div class="emote-feed small" id="emote-feed" aria-live="polite">${recent.map(x => html`<span key=${x.uid} class="emote-chip">
      <span aria-hidden="true">${EMOTE_OF[x.e].ch}</span> <${UI.Name} id=${x.uid} fallback="Someone"/></span>`)}</div>`;
  }

  /* office life on this device: people get up, go for coffee and wave (91-office3d.js reads office.life) */
  function LifePref() {
    const [on, setOn] = useState(() => M.prefs.get('office.life', 'on') !== 'off');
    return html`<${UI.Check} label="Office life on this device: people get up, grab a coffee and say hi" checked=${on}
      onChange=${v => { setOn(!!v); M.prefs.set('office.life', v ? 'on' : 'off'); }}/>`;
  }

  /* ---------- Me, Character: the sheet on the page, the emote bar, and Kaavish's looks ---------- */
  function Character() {
    const ctx = M.useCtx();
    if (!ctx || !ctx.uid || !M.cast) return null;
    return html`<div class="stack" id="character-page" style=${{gap: '16px'}}>
      <${UI.PageHead} micro="the office" title="Your character">
        <${UI.Btn} kind="sec" onClick=${() => M.nav('#office')}>Open the office<//>
      <//>
      <${CharacterSheet} uid=${ctx.uid} inline=${true}/>
      <${UI.Card} title="Say hi in the office">
        <div class="small ink62">Your character does it in the office for everyone to see.</div>
        <div style=${{marginTop: '10px'}}><${EmoteBar}/></div>
        <div style=${{marginTop: '14px'}}><${LifePref}/></div>
      <//>
      ${ctx.isFounder ? html`<${AdminCharacters}/>` : null}
    </div>`;
  }

  /* office/cast: created once with set, then whole-map updates; null clears one lock. Before the doc is known
     here, merge updates it or sets it when missing: writes to one path run in turn, so a second lock made while
     the first is still on its way lands on the doc the first created */
  async function writeLocks(ctx, patch) {
    const cur = ctx.office && ctx.office.cast;
    const at = Date.now();
    if (!cur) {
      const locks = {};
      for (const k of Object.keys(patch)) if (patch[k]) locks[k] = patch[k];
      return ctx.W.merge('office/cast', {v: 1, at, locks});
    }
    const locks = {...(cur.locks || {}), ...patch};
    return ctx.W.update('office/cast', {v: 1, at, locks});
  }

  /* ---------- Me > Your character ---------- */
  function CharacterCard() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(false);
    if (!ctx || !ctx.uid || !M.cast) return null;
    const r = M.cast.resolveFor(ctx, ctx.uid);
    const line = r.locked ? 'Kaavish set this look for you.'
      : r.src === 'starter' ? 'You are clay for now. Style your character to step in.'
      : r.by && r.by === ctx.founderUid && !r.founder ? 'Kaavish styled your character. Change it any time.'
      : 'This is you in the office. Everyone sees it.';
    return html`<${UI.Card} id="character-card" title="Your character">
      <div class="cast-card">
        <img class="cast-card-head" src=${M.cast.head2d(r.look, {founder: r.founder, size: 72}).url} alt="" width="72" height="72"/>
        <div class="stack tight grow">
          <${UI.Micro}>character<//>
          <div class="small" id="character-line">${line}</div>
          <div><${UI.Btn} kind="sec" sm=${true} id="character-open" onClick=${() => setOpen(true)}>Style your character<//></div>
        </div>
      </div>
      ${open ? html`<${CharacterSheet} uid=${ctx.uid} onClose=${() => setOpen(false)}/>` : null}
    <//>`;
  }

  /* ---------- Admin > Characters: Kaavish restyles, locks and unlocks ---------- */
  function AdminCharacters() {
    const ctx = M.useCtx();
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState('');
    const going = useRef(false);
    /* every founder sees the looks (Admin folds this card for each of them); Kaavish alone restyles, locks and unlocks */
    const people = ctx && ctx.isFounder ? (ctx.activeMembers || []).filter(m => m.uid !== ctx.founderUid) : [];
    const ps = M.useProfiles(people.map(m => m.uid));
    if (!ctx || !ctx.isFounder || !M.cast) return null;
    const owner = !!ctx.isOwner;
    /* one lock write at a time: every row waits while one is on its way */
    const run = async (uid, patch) => {
      if (going.current) return;
      going.current = true;
      setBusy(uid);
      try { await writeLocks(ctx, patch); } catch (e) { /* the write toasted */ }
      going.current = false;
      setBusy('');
    };
    return html`<${UI.Card} id="cast-admin" title="Characters">
      <div class="small ink62">the looks people chose, and the ones you set</div>
      <div class="cast-admin">${people.map(m => {
        const name = (ps[m.uid] && ps[m.uid].name) || '';
        const r = M.cast.resolveFor(ctx, m.uid, name);
        const state = r.locked ? 'locked' : r.src === 'starter' ? 'clay' : r.by && r.by === ctx.founderUid ? (owner ? 'you set' : 'set by Kaavish') : 'their own';
        return html`<div class="cast-admin-row" key=${m.uid} data-uid=${m.uid} data-src=${r.src}>
          <img src=${M.cast.head2d(r.look, {size: 40}).url} alt="" width="40" height="40"/>
          <div class="grow cast-admin-who"><div class="small"><${UI.Name} id=${m.uid}/></div><div class="tiny ink62">${state}</div></div>
          ${owner ? html`<div class="cast-actions">
            <${UI.Btn} kind="sec" sm=${true} onClick=${() => setEditing(m.uid)}>Restyle<//>
            ${r.locked ? html`<${UI.Btn} kind="ghost" sm=${true} disabled=${!!busy} onClick=${() => run(m.uid, {[m.uid]: null})}>Unlock<//>`
              : r.src === 'own' ? html`<${UI.Btn} kind="ghost" sm=${true} disabled=${!!busy} onClick=${() => run(m.uid, {[m.uid]: {look: {...M.cast.clean(r.look), pic: 'auto'}, at: Date.now()}})}>Lock this look<//>` : null}
          </div>` : null}
        </div>`;
      })}</div>
      ${editing && owner ? html`<${CharacterSheet} uid=${editing} onClose=${() => setEditing(null)}/>` : null}
    <//>`;
  }
  AdminCharacters.foldTitle = 'Characters';
  AdminCharacters.foldSummary = 'the looks people chose, and the ones you set';

  M.parts.CharacterCard = CharacterCard;
  M.parts.EmoteBar = EmoteBar;
  M.parts.EmoteFeed = EmoteFeed;
  M.pages.Character = Character;
  M.character = {EMOTES, emoteClock};
  M.parts.CharacterSheet = CharacterSheet;
  M.meCards.push(CharacterCard);
  M.adminCards.push(AdminCharacters);
})();
