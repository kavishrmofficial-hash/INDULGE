/* module: office3d. The office in 3D (v35): one clean floor on a soft backdrop, the team at their desks, the
   m360 COO at the station of what it is really doing, and Kaavish, live. It draws what the flat office knows
   (M.office: useData, desks, restOf, the director) and decides nothing of its own; the flat floor plan stays the
   fallback, chosen automatically, and every test that does not ask for 3D runs on it.

     M.office3d.can()                 {ok, why}: may this device draw it (pref, reduced motion, WebGL2, software, memory)
     M.office3d.useMode(kind)         'pending', '3d' or 'flat' for 'page' (#office), 'window' (HQ, the COO tab, Home), 'editor'
     M.office3d.load()                a Promise of the three.js namespace T (inlined in the artifact, a hashed file on the team site)
     M.office3d.acquire(host, kind)   the one renderer of the page, or null while another host holds it; release(host)
     M.office3d.tokens()              the room's colours, read back from the CSS tokens (src/css/99-office3d.css)
     M.office3d.Scene3D(props)        the scene: {data, mode, phone, cam, onCam, drawers, onSay, onFrame, focusKey}
     M.office3d.stage3d(api)          the director's stage in 3D (walk, fly, fade, fx)
     M.office3d.state()               what is drawn, for checks: frames, renders, calls, tris, figures, the COO, Kaavish

   Renders on demand: zero frames while nothing moves, none while hidden, off screen, behind a drawer, dozing or at
   night. Any failure (no WebGL2, a lost context, three not loading, an exception) lands on the flat office, never
   on a blank one. Every word is DOM in a projected overlay; no colour is written here. */
'use strict';
(function () {
  const {html, React} = M;
  const {useState, useEffect, useLayoutEffect, useRef, useCallback} = React;
  const OF = () => M.office;
  const WD = () => M.office3d.world;
  const MIN = 60000;
  const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
  const cm = v => v / 100;
  const DEG = Math.PI / 180;
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const later = f => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, {timeout: 60}) : setTimeout(f, 0));
  const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

  /* ---------- the gate ---------- */
  let session = '';                     /* why this session draws flat: lost, load, start, error */
  const subs = new Set();
  const notify = () => subs.forEach(f => { try { f(); } catch (e) { /* a gone listener */ } });
  function setFlag(why) { if (session) return; session = why; notify(); }
  let probed = null;
  /* one throwaway WebGL2 context: is there one, what draws it, how big a texture; then it is let go */
  function probe() {
    if (probed) return probed;
    probed = {gl2: false, renderer: '', maxTex: 0};
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (gl) {
        probed.gl2 = true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        probed.renderer = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
        probed.maxTex = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { probed.gl2 = false; }
    return probed;
  }
  const SOFT = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i;
  const forced = () => M.prefs.get('office.mode', 'auto') === '3d';
  function can() {
    const mode = M.prefs.get('office.mode', 'auto');
    if (mode === 'flat') return {ok: false, why: 'pref'};
    const force = mode === '3d';
    if (!force && (Number(M.prefs.get('office.flatUntil', '0')) || 0) > Date.now()) return {ok: false, why: 'slow'};
    if (M.reduced()) return {ok: false, why: 'reduced'};
    if (session) return {ok: false, why: session};
    const g = probe();
    if (!g.gl2) return {ok: false, why: 'nogl'};
    if (!force) {
      if (SOFT.test(g.renderer)) return {ok: false, why: 'software'};
      let lite = false;
      try { lite = !!(navigator.connection && navigator.connection.saveData) || (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2); } catch (e) { lite = false; }
      if (lite || g.maxTex < 4096) return {ok: false, why: 'lite'};
    }
    return {ok: true, why: force ? 'forced' : ''};
  }
  function setMode(m) { M.prefs.set('office.mode', m); notify(); }
  /* 'Try 3D again' after the slow watchdog */
  function retry() { M.prefs.set('office.flatUntil', '0'); notify(); }

  /* ---------- the loader: the same function on both builds ---------- */
  let three = null, loading = null;
  function load() {
    if (three) return Promise.resolve(three);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const done = () => { try { three = window.M360_3D(); res(three); } catch (e) { rej(e); } };
      if (typeof window.M360_3D === 'function') { done(); return; }
      const src = window.M360_3D_SRC;
      if (!src) { rej(new Error('three is not on this page')); return; }
      const s = document.createElement('script');
      s.src = src;
      if (window.M360_3D_SRI) s.integrity = window.M360_3D_SRI;
      s.crossOrigin = 'anonymous';
      const t = setTimeout(() => rej(new Error('three took too long')), 20000);
      s.onload = () => { clearTimeout(t); if (typeof window.M360_3D === 'function') done(); else rej(new Error('three did not load')); };
      s.onerror = () => { clearTimeout(t); rej(new Error('three did not load')); };
      document.head.appendChild(s);
    });
    loading.catch(() => setFlag('load'));
    return loading;
  }

  /* ---------- useMode: flat, pending or 3D, live with the preference and reduced motion ---------- */
  function useMQ(q) {
    const get = () => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
    const [v, set] = useState(get);
    useEffect(() => {
      let m = null;
      try { m = window.matchMedia(q); } catch (e) { return undefined; }
      const on = () => set(m.matches);
      try { m.addEventListener('change', on); } catch (e) { m.addListener(on); }
      return () => { try { m.removeEventListener('change', on); } catch (e) { m.removeListener(on); } };
    }, [q]);
    return v;
  }
  let lastMode = 'flat';
  function useMode(kind) {
    const [, bump] = useState(0);
    useMQ('(prefers-reduced-motion: reduce)');
    const phone = useMQ('(max-width: 700px)');
    useEffect(() => { const f = () => bump(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
    /* a window on a phone, or one turned off, is flat before anything is probed */
    const ok = !(kind === 'window' && (phone || M.prefs.get('office.window3d', '1') === '0')) && can().ok;
    const [T, setT] = useState(three);
    useEffect(() => {
      if (!ok || T) return undefined;
      let live = true;
      load().then(t => { if (live) setT(t); }, () => { /* the gate goes flat */ });
      return () => { live = false; };
    }, [ok]);
    const out = !ok ? 'flat' : (T || three) ? '3d' : 'pending';
    if (kind === 'page') lastMode = out;
    return out;
  }

  /* ---------- the room's colours: CSS tokens, read back through a 1x1 canvas ---------- */
  const ROLES = ['back-c', 'back-e', 'floor', 'plinth', 'rug', 'rug-edge', 'shade', 'wall', 'cap', 'leg', 'seat', 'board', 'cell', 'mark', 'ink', 'glass', 'pot',
    'screen-off', 'screen-on', 'lamp', 'pool', 'pampas', 'hemi-sky', 'hemi-ground', 'key', 'clay', 'suit'];
  const CORE = ['paper', 'warm', 'col', 'ink', 'flame', 'dark'];
  let tok = null;
  try { M.theme.subscribe(() => { tok = null; }); } catch (e) { /* no theme yet */ }
  function tokens() {
    const theme = M.theme ? M.theme.resolved() : 'light';
    if (tok && tok.theme === theme) return tok.v;
    const v = {};
    const probeEl = document.createElement('i');
    probeEl.style.cssText = 'position:absolute;left:-9px;top:-9px;width:1px;height:1px;visibility:hidden;pointer-events:none';
    (document.body || document.documentElement).appendChild(probeEl);
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const g = cv.getContext('2d', {willReadFrequently: true});
      const computed = name => { probeEl.style.color = ''; probeEl.style.color = 'var(--' + name + ')'; return getComputedStyle(probeEl).color; };
      const paper = computed('paper');
      const read = name => {
        const c = computed(name);
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = paper; g.fillRect(0, 0, 1, 1);
        g.fillStyle = c; g.fillRect(0, 0, 1, 1);
        const d = g.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      CORE.forEach(k => { v[k] = read(k); });
      ROLES.forEach(k => { v[k] = read('o3-' + k); });
      /* v37: the office in colour, from the game palette in 14-cast.js; a role it does not name keeps its token */
      const room = M.cast && M.cast.ROOM ? M.cast.ROOM[theme === 'dark' ? 'dark' : 'light'] : null;
      if (room) ROLES.forEach(k => { if (room[k]) v[k] = room[k].slice(); });
    } finally { probeEl.remove(); }
    tok = {theme, v};
    return v;
  }
  const setCol = (T, c, b) => c.setRGB(b[0] / 255, b[1] / 255, b[2] / 255, T.SRGBColorSpace);
  const bytesOf = s => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '')); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  /* desk tops: oak by day, walnut by night, from the natural palette in 14-cast.js; the board tone without it */
  function wood(col, dark) {
    const N = M.cast && M.cast.NATURAL;
    const w = N ? bytesOf(dark ? N.walnut : N.oak) : null;
    return w || col.board;
  }

  /* ---------- the renderer: one canvas a page ---------- */
  const R = {gl: null, canvas: null, host: null, kind: '', timer: 0, lost: false, tries: 0, restore: 0, env: null, aa: true, onRestored: null};
  function acquire(host, kind) {
    if (R.host && R.host !== host) return null;
    if (!three) return null;
    clearTimeout(R.timer);
    if (!R.gl) {
      const T = three;
      const canvas = document.createElement('canvas');
      canvas.className = 'office-gl';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.tabIndex = 0;
      /* v37: smooth edges on every desktop; only a dense touch screen (already sharp, and short of power) goes without */
      const coarse = (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
      R.aa = !coarse || (window.devicePixelRatio || 1) <= 1.5;
      const gl = new T.WebGLRenderer({canvas, antialias: R.aa, powerPreference: 'default', stencil: false, alpha: false});
      gl.toneMapping = T.NeutralToneMapping;
      gl.toneMappingExposure = 1.06;
      gl.outputColorSpace = T.SRGBColorSpace;
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = T.VSMShadowMap;
      gl.shadowMap.autoUpdate = false;
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
      Object.assign(R, {gl, canvas, lost: false, env: null});
    }
    R.host = host; R.kind = kind;
    return R;
  }
  function release(host) {
    if (R.host !== host) return;
    R.host = null; R.kind = ''; R.onRestored = null;
    if (R.canvas && R.canvas.parentNode) R.canvas.parentNode.removeChild(R.canvas);
    clearTimeout(R.timer);
    if (R.lost) dispose(); else R.timer = setTimeout(dispose, 60000);
  }
  /* sixty seconds with no host: the renderer goes, and its context with it */
  function dispose() {
    if (R.host || !R.gl) return;
    const {gl, canvas} = R;
    canvas.removeEventListener('webglcontextlost', onLost, false);
    canvas.removeEventListener('webglcontextrestored', onRestored, false);
    try { if (R.env) R.env.dispose(); } catch (e) { /* gone */ }
    try { gl.dispose(); if (!R.lost) gl.forceContextLoss(); } catch (e) { /* gone */ }
    Object.assign(R, {gl: null, canvas: null, env: null, lost: false});
  }
  /* a lost context gets one chance to come back; a second loss, or none back in 1.5 s, is flat for the session */
  function onLost(e) {
    e.preventDefault();
    R.lost = true;
    if (R.tries >= 1) { setFlag('lost'); return; }
    R.tries++;
    clearTimeout(R.restore);
    R.restore = setTimeout(() => { if (R.lost) setFlag('lost'); }, 1500);
  }
  function onRestored() {
    R.lost = false;
    clearTimeout(R.restore);
    if (R.onRestored) R.onRestored();
  }

  /* ---------- the people: M.figure draws them (92-figure.js), M.cast says how each looks (14-cast.js) ----------
     The name is only for a starter's initials on its chest sticker, so the sticker is part of what a figure is */
  const lookOf = (d, uid) => M.cast.lookOf(d.ctx, uid, ((d.profs || {})[uid] || {}).name || '');
  const lookHash = look => (look ? M.cast.hash(look, look.starter ? 'S' + M.cast.sticker(look.initials) : '') : '');

  /* ---------- the overlay: DOM over the canvas, projected through the same camera ---------- */
  function rectHit(a, b, pad) { return !(a.x1 + pad < b.x0 || b.x1 + pad < a.x0 || a.y1 + pad < b.y0 || b.y1 + pad < a.y0); }
  function overArea(a, b) { const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && h > 0 ? w * h : 0; }

  /* ---------- the engine: one per mounted scene ---------- */
  let cur = null;
  function makeEngine(T, Rr, o) {
    const gl = Rr.gl, canvas = Rr.canvas;
    const O = OF();
    const phone = !!o.phone, win = o.kind !== 'page';
    const touch = phone || (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
    const FPS = touch ? 30 : 60;
    o.slot.appendChild(canvas);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(phone ? 26 : 22, 1, 0.3, 220);
    const controls = new T.OrbitControls(camera, canvas);
    Object.assign(controls, {enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.7, zoomToCursor: true,
      minPolarAngle: 20 * DEG, maxPolarAngle: 69 * DEG});
    controls.enabled = !win;
    const st = {frames: 0, renders: 0, calls: 0, tris: 0, dpr: 1, ready: false, firstFrame: 0};
    let dead = false, data = null, view = null, K = null, extra = {};
    let world = null, worldKey = '', building = false, crowdKey = '', crowd = null, crowdItems = [], dropMesh = null;
    let raf = 0, need = 0, last = 0, moving = false, userCam = false, camKind = o.cam || 'floor', fitD = 40;
    let visible = document.visibilityState !== 'hidden', onScreen = true, hushed = false, doze = false;
    const ticks = new Set();
    const items = o.items;       /* the scene's overlay elements, by key (the component keeps the map) */
    const extras = new Map();    /* elements others add through the api */
    /* every way in from outside (an effect, the theme, an observer, a key) runs guarded: a throw lands on the flat office */
    const safe = f => function () { if (dead) return undefined; try { return f.apply(this, arguments); } catch (e) { fail(e); return undefined; } };
    const col = () => tokens();
    const dark = () => (M.theme ? M.theme.resolved() === 'dark' : false);

    /* materials, one a role */
    const std = (r, m) => new T.MeshStandardMaterial({roughness: r, metalness: m || 0});
    const mats = {
      plinth: std(0.9), floor: std(0.92), wall: std(0.95), cap: std(0.9), top: std(0.55), leg: std(0.5, 0.1), seat: std(0.9), board: std(0.85),
      cell: std(0.85), mark: std(0.8), ink: std(0.6), pot: std(0.8), pampas: std(0.95),
      glass: new T.MeshStandardMaterial({roughness: 0.2, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false}),
      screen: new T.MeshBasicMaterial(), lampOn: std(0.5), lampOff: std(0.6), cabOn: std(0.5),
      drop: new T.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false}),
      pool: new T.MeshBasicMaterial({transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3}),
      focus: new T.MeshBasicMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}),
      blob: new T.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3}),
      kpool: new T.MeshBasicMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}),
      cpool: new T.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3}),
      home: new T.MeshBasicMaterial()
    };
    const tex = {grain: WD().grainTexture(T), soft: WD().radial(T, [[0, 1], [0.35, 0.55], [0.7, 0.14], [1, 0]]), drop: WD().dropShadowTexture(T), floor: null, back: null, home: null};
    mats.top.map = tex.grain;
    mats.drop.map = tex.drop; mats.pool.map = tex.soft; mats.focus.map = tex.soft; mats.blob.map = tex.soft; mats.kpool.map = tex.soft; mats.cpool.map = tex.soft;

    /* lights: a hemisphere and one high key from the front left, the way a product is lit */
    const hemi = new T.HemisphereLight();
    const key = new T.DirectionalLight();
    key.castShadow = true;
    const sz = phone ? 1024 : 2048;
    key.shadow.mapSize.set(sz, sz);
    key.shadow.radius = 9; key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    key.shadow.intensity = 0.7;
    scene.add(hemi, key, key.target);
    if (!phone) {
      try {
        if (!Rr.env) { const pm = new T.PMREMGenerator(gl); Rr.env = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose(); }
        scene.environment = Rr.env;
      } catch (e) { scene.environment = null; }
    }

    const root = new T.Group();
    scene.add(root);
    const decals = new T.Group();
    scene.add(decals);
    const actors = new T.Group();
    scene.add(actors);

    /* ---------- paint: the tokens onto the materials, the textures redrawn; no geometry rebuilt ---------- */
    function paint() {
      const c = col(), dk = dark(), night = !!(data && data.day && data.day.night);
      for (const r of ['plinth', 'wall', 'cap', 'leg', 'seat', 'board', 'cell', 'mark', 'ink', 'pot', 'pampas', 'glass']) setCol(T, mats[r].color, c[r]);
      setCol(T, mats.top.color, wood(c, dk));
      setCol(T, mats.lampOff.color, c.pot);
      setCol(T, mats.lampOn.color, c.pot);
      const glow = dk || night;
      setCol(T, mats.lampOn.emissive, c.lamp);
      mats.lampOn.emissiveIntensity = glow ? 1.1 : 0;
      /* the cabin lamp says Kaavish is here, so it reads as lit by day too: a paper warm dome and a soft pool */
      setCol(T, mats.cabOn.color, c.pot); setCol(T, mats.cabOn.emissive, c.lamp);
      mats.cabOn.emissiveIntensity = glow ? 1.1 : 0.95;
      setCol(T, mats.cpool.color, glow ? c.lamp : c.pool);
      mats.cpool.blending = glow ? T.AdditiveBlending : T.NormalBlending; mats.cpool.opacity = glow ? (dk ? 0.42 : 0.3) : 0.45; mats.cpool.needsUpdate = true;
      setCol(T, mats.screen.color, glow ? c['screen-on'] : c['screen-off']);
      mats.floor.color.setRGB(1, 1, 1);
      setCol(T, mats.drop.color, c.shade); mats.drop.opacity = dk ? 0.62 : 0.2;
      setCol(T, mats.pool.color, c.lamp); mats.pool.opacity = dk ? 0.42 : 0.3;
      setCol(T, mats.focus.color, c.pool);
      mats.focus.blending = dk ? T.AdditiveBlending : T.NormalBlending; mats.focus.opacity = dk ? 0.3 : 0.5; mats.focus.needsUpdate = true;
      setCol(T, mats.blob.color, c.shade); mats.blob.opacity = dk ? 0.5 : 0.26;
      setCol(T, mats.kpool.color, c.pool);
      mats.kpool.blending = dk ? T.AdditiveBlending : T.NormalBlending; mats.kpool.opacity = dk ? 0.3 : 0.35; mats.kpool.needsUpdate = true;
      setCol(T, hemi.color, c['hemi-sky']); setCol(T, hemi.groundColor, c['hemi-ground']);
      hemi.intensity = (dk ? 0.72 : 0.62) + (phone ? 0.1 : 0);
      setCol(T, key.color, c.key);
      key.intensity = (dk ? 1.55 : 2.3) * (night ? 0.4 : 1);
      scene.environmentIntensity = dk ? 0.3 : 0.42;
      /* a light haze in the backdrop's colour: the far side of the floor sits back a little */
      const haze = c['back-c'] || c.warm;
      /* the bundle carries the fog shaders without the class: the renderer only reads these fields */
      if (!scene.fog) scene.fog = {isFogExp2: true, name: '', color: mats.floor.color.clone(), density: 0.0055, clone() { return {...this, color: this.color.clone()}; }, toJSON() { return {}; }};
      setCol(T, scene.fog.color, haze);
      scene.fog.density = dk ? 0.0075 : 0.0055;
      backdrop();
      if (world) floorTex();
      if (pools.lamp) pools.lamp.visible = glow;
      if (cooRig && cooRig.setAccent) cooRig.setAccent(dk);
      if (homeAtlas.uids.length) drawHomes();
      gl.shadowMap.needsUpdate = true;
      invalidate(2);
    }
    function backdrop() {
      const r = o.view.getBoundingClientRect();
      const t = WD().backdropTexture(T, col(), (r.width || 16) / (r.height || 10));
      if (tex.back) tex.back.dispose();
      tex.back = t;
      scene.background = t;
    }
    function floorTex() {
      const t = WD().floorTexture(T, world.slab, world.ao, col(), dark() ? 0.5 : 0.24, phone ? 1536 : 2048);
      if (tex.floor) tex.floor.dispose();
      tex.floor = t;
      mats.floor.map = t;
      mats.floor.needsUpdate = true;
    }

    /* ---------- the world: built in idle slices, swapped in whole ---------- */
    const pools = {lamp: null, focus: null, cab: null};
    const meshes = [];
    function signature(d) {
      const D = d.D || [];
      const seats = D.map(x => [x.uid, x.state, x.place, x.focus ? 1 : 0, x.pile || 0].join(':')).join('|');
      return [d.L.H, Object.keys(d.L.seats).length, d.L.benches.map(b => b.slot + b.pod + b.ids.join(',')).join(';'), JSON.stringify(d.L.props || {}),
        d.scope, seats, kOnline(d) ? 1 : 0].join('#');
    }
    const kOnline = d => !!(d.ctx && d.ctx.online && d.L.founder && d.ctx.online[d.L.founder]);
    function rebuild(d, first) {
      const sig = signature(d);
      if (sig === worldKey || building) return;
      building = true;
      const want = sig;
      const gen = WD().build(T, {L: d.L, D: d.D, owner: d.scope === 'owner', lite: phone, kaavishOnline: kOnline(d)});
      const step = () => {
        if (dead) return;
        const t0 = performance.now();
        try {
          for (;;) {
            const r = gen.next();
            if (r.done) { swap(r.value); building = false; worldKey = want; if (first) first(); else { gl.shadowMap.needsUpdate = true; invalidate(2); } if (data && signature(data) !== worldKey) rebuild(data); return; }
            if (performance.now() - t0 > 8) break;
          }
        } catch (e) { fail(e); return; }
        later(step);
      };
      step();
    }
    function swap(w) {
      meshes.forEach(m => { root.remove(m); m.geometry.dispose(); });
      meshes.length = 0;
      world = w;
      const S = w.slab;
      /* the plinth and its recessed foot */
      const K2 = WD().kit(T, phone);
      const body = T.mergeGeometries([K2.prep(K2.planSlab(S.x0, S.z0, S.x1, S.z1, S.r, -S.h, S.h, 0.05, phone ? 10 : 24)),
        K2.prep(K2.planSlab(S.x0 + 0.5, S.z0 + 0.5, S.x1 - 0.5, S.z1 - 0.5, S.r, -S.h - 0.16, 0.17, 0.02, phone ? 10 : 24))], false);
      const pm = new T.Mesh(body, mats.plinth); pm.receiveShadow = true;
      const fm = new T.Mesh(WD().floorFace(T, S, 0.05), mats.floor); fm.receiveShadow = true; fm.position.y = 0.0015;
      meshes.push(pm, fm);
      for (const role of Object.keys(w.roles)) {
        const list = w.roles[role];
        if (!list.length) continue;
        const g = T.mergeGeometries(list, false);
        list.forEach(x => x.dispose());
        if (!g) continue;
        if (role === 'top') {
          const p = g.attributes.position, uv = new Float32Array(p.count * 2);
          for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 1.4; uv[i * 2 + 1] = p.getZ(i) / 1.4; }
          g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        }
        const m = new T.Mesh(g, mats[role]);
        m.castShadow = role !== 'glass' && role !== 'screen';
        m.receiveShadow = role !== 'glass' && role !== 'screen';
        if (role === 'glass') m.renderOrder = 2;
        meshes.push(m);
      }
      /* lamp domes: lit for whoever is at the desk, at night and in dark */
      const on = [], off = [], cabin = [];
      for (const l of w.lamps) {
        const s = l.floor ? 2.2 : 1;
        const gd = new T.SphereGeometry(0.085 * s, phone ? 14 : 24, phone ? 6 : 10, 0, Math.PI * 2, 0, Math.PI / 2);
        gd.deleteAttribute('uv'); gd.scale(1, 0.8, 1); gd.translate(l.x, l.y, l.z);
        (l.on ? (l.cabin ? cabin : on) : off).push(gd);
      }
      if (on.length) { const m = new T.Mesh(T.mergeGeometries(on, false), mats.lampOn); m.castShadow = true; meshes.push(m); }
      if (off.length) { const m = new T.Mesh(T.mergeGeometries(off, false), mats.lampOff); m.castShadow = true; meshes.push(m); }
      if (cabin.length) { const m = new T.Mesh(T.mergeGeometries(cabin, false), mats.cabOn); m.castShadow = true; meshes.push(m); }
      on.concat(off, cabin).forEach(x => x.dispose());
      /* pools: a soft light on the desk under each lit lamp (at night and in dark), the cabin's own while he is online,
         and a wider one on the floor round a focus desk */
      const plane = (x, y, z, s) => { const g = new T.PlaneGeometry(s, s); g.rotateX(-Math.PI / 2); g.translate(x, y, z); g.deleteAttribute('normal'); return g; };
      const lit = w.lamps.filter(l => l.on && !l.floor && !l.cabin).map(l => plane(l.x, 0.743, l.z - 0.05, 1.0));
      pools.lamp = lit.length ? new T.Mesh(T.mergeGeometries(lit, false), mats.pool) : null;
      lit.forEach(x => x.dispose());
      const cab = w.lamps.find(l => l.cabin && l.on);
      const cp = cab ? [plane(cab.x, 0.743, cab.z - 0.05, 1.0), plane(cab.x - 0.3, 0.004, cab.z - 0.2, 3.0)] : [];
      pools.cab = cp.length ? new T.Mesh(T.mergeGeometries(cp, false), mats.cpool) : null;
      cp.forEach(x => x.dispose());
      const fp = w.pools.filter(p => p.kind === 'focus').map(p => plane(p.x, 0.004, p.z, p.r * 2));
      pools.focus = fp.length ? new T.Mesh(T.mergeGeometries(fp, false), mats.focus) : null;
      fp.forEach(x => x.dispose());
      for (const p of [pools.lamp, pools.focus, pools.cab]) if (p) { p.renderOrder = 1; meshes.push(p); }
      if (pools.lamp) pools.lamp.visible = dark() || !!(data && data.day && data.day.night);
      /* the call tiles: one canvas for every person working from home */
      homeAtlas.uids = w.homes.map(h => h.uid);
      if (w.homes.length) {
        const n = Math.ceil(Math.sqrt(w.homes.length)), list = [];
        w.homes.forEach((h, i) => {
          const g = new T.PlaneGeometry(h.w, h.h);
          g.rotateY(Math.PI);
          g.translate(h.at[0], h.at[1], h.at[2]);
          g.applyMatrix4(h.m);
          const uv = g.attributes.uv, cx = i % n, cy = Math.floor(i / n);
          for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / n, 1 - (cy + 1 - uv.getY(k)) / n);
          g.deleteAttribute('normal');
          list.push(g);
        });
        homeAtlas.n = n;
        drawHomes();
        const m = new T.Mesh(T.mergeGeometries(list, false), mats.home);
        list.forEach(x => x.dispose());
        meshes.push(m);
      }
      meshes.forEach(m => root.add(m));
      /* the slab's own shadow, below and a little behind */
      if (!dropMesh) {
        dropMesh = new T.Mesh(new T.PlaneGeometry(1, 1), mats.drop);
        dropMesh.rotation.x = -Math.PI / 2; dropMesh.renderOrder = -1;
        scene.add(dropMesh);
      }
      dropMesh.scale.set(S.x1 - S.x0 + 7, S.z1 - S.z0 + 4.4, 1);
      dropMesh.position.set((S.x0 + S.x1) / 2 + 0.6, -1.7, (S.z0 + S.z1) / 2 + 0.9);
      floorTex();
      fitShadow();
      refit();
      crowdKey = '';
      syncCrowd();
    }
    /* the key light's shadow box, fitted to the slab */
    function fitShadow() {
      const S = world.slab, cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2;
      key.position.set(cx - 5, 15.5, cz + 4.7);
      key.target.position.set(cx, 0, cz);
      key.updateMatrixWorld(); key.target.updateMatrixWorld();
      const m = new T.Matrix4().lookAt(key.position, key.target.position, new T.Vector3(0, 1, 0)).invert();
      m.premultiply(new T.Matrix4().makeTranslation(-key.position.x, -key.position.y, -key.position.z).premultiply(new T.Matrix4()));
      const view = new T.Matrix4().copy(key.matrixWorld).invert();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const x of [S.x0, S.x1]) for (const z of [S.z0, S.z1]) for (const y of [-0.7, 2.4]) {
        const v = new T.Vector3(x, y, z).applyMatrix4(view);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
      }
      Object.assign(key.shadow.camera, {left: x0 - 0.3, right: x1 + 0.3, top: y1 + 0.3, bottom: y0 - 0.3, near: Math.max(0.5, -z1 - 1), far: -z0 + 1});
      key.shadow.camera.updateProjectionMatrix();
    }

    /* ---------- the call tiles (WFH): each person's 2D head on their monitor ---------- */
    const homeAtlas = {uids: [], n: 1, canvas: null};
    function drawHomes() {
      const n = homeAtlas.n, px = 128, c = col();
      const cv = homeAtlas.canvas && homeAtlas.canvas.width === n * px ? homeAtlas.canvas : document.createElement('canvas');
      cv.width = cv.height = n * px;
      const g = cv.getContext('2d');
      g.fillStyle = WD().css(c['screen-on']); g.fillRect(0, 0, cv.width, cv.height);
      homeAtlas.uids.forEach((u, i) => {
        const x = (i % n) * px, y = Math.floor(i / n) * px;
        g.save(); g.translate(x, y);
        let drawn = false;
        try {
          const look = data ? lookOf(data, u) : null;
          if (look && M.cast && M.cast.head2d) { const hd = M.cast.head2d(look, {founder: false, size: px}); if (hd && hd.draw) { g.translate(px * 0.1, px * 0.06); g.scale(0.8, 0.8); hd.draw(g, px); drawn = true; } }
        } catch (e) { drawn = false; }
        if (!drawn) {
          g.fillStyle = WD().css(c.leg);
          g.beginPath(); g.arc(px / 2, px * 0.42, px * 0.17, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(px / 2, px * 0.98, px * 0.32, px * 0.3, 0, Math.PI, 0); g.fill();
        }
        g.restore();
      });
      homeAtlas.canvas = cv;
      if (!tex.home || tex.home.image !== cv) { if (tex.home) tex.home.dispose(); tex.home = new T.CanvasTexture(cv); tex.home.colorSpace = T.SRGBColorSpace; mats.home.map = tex.home; mats.home.needsUpdate = true; }
      else tex.home.needsUpdate = true;
    }

    /* ---------- the crowd: every still person, baked into one mesh; rebuilt only when it changes ---------- */
    let crowdTimer = 0, crowdGen = 0;
    /* who sits still: at their desk typing, in the meeting room, at lunch. World metres for the engine, and the
       crowd's own items (plan cm, heading in degrees, the seat's height) */
    function seatedItems(d) {
      if (!world) return [];
      const out = [], L = d.L;
      for (const x of d.D || []) {
        if (x.cabin || walkins.has(x.uid) || (visits.has(x.uid) && visits.get(x.uid).phase !== 'home')) continue;
        let p = null;
        if (x.state === 'office' && x.place === 'desk') { const s = world.seats[x.uid]; if (s) p = {x: s.x, y: s.z, h: s.h, pose: 'type', seat: 0.46}; }
        else if (x.place === 'meeting') p = {x: cm(x.x), y: cm(x.y), h: Math.atan2(14.0 - cm(x.x), 3.67 - cm(x.y)), pose: 'sit', seat: 0.46};
        else if (x.place === 'lunch') { const lz = cm(O.sy(L, 890)); const near = Math.hypot(cm(x.x) - 10.7, cm(x.y) - lz) < 0.8; p = {x: cm(x.x), y: cm(x.y), h: near ? Math.atan2(10.7 - cm(x.x), lz - cm(x.y)) : 0, pose: 'sit', seat: 0.49}; }
        if (!p) continue;
        const look = lookOf(d, x.uid);
        out.push(Object.assign(p, {uid: x.uid, look, founder: false, acc: x.focus ? ['headphones'] : [], lod: 1, hash: lookHash(look), state: x.state}));
      }
      return out;
    }
    const crowdIn = list => list.map(i => ({look: i.look, founder: false, x: Math.round(i.x * 100), y: Math.round(i.y * 100), h: i.h / DEG, pose: i.pose, acc: i.acc, lod: i.lod, seat: i.seat}));
    function syncCrowd() {
      if (!data || !world) return;
      const items2 = seatedItems(data);
      const sig = items2.map(i => [i.uid, i.x.toFixed(2), i.y.toFixed(2), i.h.toFixed(2), i.pose, i.acc.join(','), i.hash].join(':')).join('|');
      if (sig === crowdKey) return;
      clearTimeout(crowdTimer);
      const gen = ++crowdGen;
      const swapIn = mesh => {
        if (dead || gen !== crowdGen) { if (mesh) mesh.geometry.dispose(); return; }
        if (crowd) { actors.remove(crowd); try { crowd.geometry.dispose(); } catch (e) { /* gone */ } }
        crowd = mesh;
        if (crowd) { crowd.castShadow = true; crowd.receiveShadow = true; actors.add(crowd); }
        crowdItems = items2;
        crowdKey = sig;
        gl.shadowMap.needsUpdate = true;
        invalidate(2);
      };
      /* the old crowd stays until the new one is ready; the characters build one figure an idle slice */
      const build = () => {
        if (dead || gen !== crowdGen) return;
        const F = M.figure;
        if (F.crowd.async && crowdKey) { F.crowd.async(T, crowdIn(items2), {budget: 8}).then(safe(swapIn), fail); return; }
        swapIn(F.crowd(T, crowdIn(items2)));
      };
      if (!crowdKey) build(); else crowdTimer = setTimeout(() => later(safe(build)), 500);
    }

    /* ---------- the COO ---------- */
    let cooRig = null, cooBlob = null;
    const coo = {x: 4.1, z: 8.62, y: 0.95, yaw: 0, walk: null, landed: 0, hop: 0, lift: 0, spot: 'desk', state: 'default', listening: false};
    function makeCoo() {
      cooRig = M.figure.coo(T, {lod: phone ? 1 : 0, dark: dark()});
      actors.add(cooRig.root);
      cooBlob = new T.Mesh(new T.CircleGeometry(0.36, 32), mats.blob);
      cooBlob.rotation.x = -Math.PI / 2; cooBlob.renderOrder = 1;
      decals.add(cooBlob);
    }
    /* where the COO rests: its spot; the rig keeps its own height (on the pad at its desk, else hovering).
       Waiting at the tray it hops once every 40 s, never while dozing or at night */
    function cooRest(now) {
      const v = view || {};
      const r = (data && data.rest) || {};
      const sp = O.spotOf(data.L, v.spot || 'desk');
      let lift = 0, anim = false;
      const waiting = !v.walking && v.spot === 'tray' && r.station === 'tray';
      if (waiting && !doze && !dayNight()) {
        if (now - coo.hop > 40000) coo.hop = now;
        const h = now - coo.hop;
        if (h < 500) { lift = 0.12 * Math.sin(h / 500 * Math.PI); anim = true; }
      }
      return {x: cm(sp.x), z: cm(sp.y), lift, anim};
    }
    const dayNight = () => !!(data && data.day && (data.day.night || data.day.closed));
    function cooWalk(pts, dur) {
      return new Promise(res => {
        let len = 0;
        const offs = [0];
        for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); offs.push(len); }
        coo.walk = {pts, offs, len, t0: performance.now(), dur, res};
        setTimeout(() => { if (coo.walk && coo.walk.res === res) endWalk(); }, dur + 400);
        invalidate(1);
      });
    }
    function endWalk() {
      const w = coo.walk;
      if (!w) return;
      coo.walk = null;
      coo.landed = performance.now();
      const p = w.pts[w.pts.length - 1];
      coo.x = cm(p.x); coo.z = cm(p.y);
      w.res();
      invalidate(2);
    }
    function cooTick(dt, now) {
      if (!cooRig || !data) return false;
      let anim = false, travel = null;
      const w = coo.walk;
      let lift = 0;
      if (w) {
        const t = clamp(0, 1, (now - w.t0) / w.dur);
        const s = OF().bez ? OF().bez(t) : ease(t);
        let at = s * w.len, i = 1;
        while (i < w.pts.length - 1 && w.offs[i] < at) i++;
        const a = w.pts[i - 1], b = w.pts[i], seg = Math.max(1e-6, w.offs[i] - w.offs[i - 1]);
        const k = clamp(0, 1, (at - w.offs[i - 1]) / seg);
        coo.x = cm(a.x + (b.x - a.x) * k); coo.z = cm(a.y + (b.y - a.y) * k);
        lift = 0.02 * Math.abs(Math.sin(at / 18));
        travel = Math.atan2(b.x - a.x, b.y - a.y);
        anim = true;
        if (t >= 1) endWalk();
      } else {
        const r = cooRest(now);
        const dx = r.x - coo.x, dz = r.z - coo.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.002) { coo.x += dx * Math.min(1, dt * 8); coo.z += dz * Math.min(1, dt * 8); anim = true; }
        lift = r.lift;
        anim = anim || r.anim;
      }
      /* it looks the way it travels, turned a third of the way toward whoever watches */
      const toCam = Math.atan2(camera.position.x - coo.x, camera.position.z - coo.z);
      let want = travel != null ? angle(travel, toCam, 0.35) : toCam;
      if (coo.listening && !w) want = toCam - 0.45;
      const before = coo.yaw;
      coo.yaw = angle(coo.yaw, want, Math.min(1, dt * 8));
      if (Math.abs(coo.yaw - before) > 0.001) anim = true;
      cooRig.root.position.set(coo.x, lift, coo.z);
      if (cooRig.setYaw) cooRig.setYaw(coo.yaw); else cooRig.root.rotation.y = coo.yaw;
      /* the rig eases to its pad or its hover and bobs a few seconds after it lands, then holds still */
      try { if (cooRig.update && cooRig.update(dt)) anim = true; } catch (e) { /* a rig's own beat */ }
      coo.y = (cooRig.body ? cooRig.body.position.y : 1.15) + lift;
      cooBlob.position.set(coo.x, 0.004, coo.z);
      cooBlob.scale.setScalar(clamp(0.45, 1, 1.25 - (coo.y - 0.95) * 0.9));
      return anim;
    }

    /* ---------- Kaavish ---------- */
    let kRig = null, kBlob = null, kPool = null, kLook = '', blinkAt = 0, blinkOn = false, blinkT = 0;
    const kav = {x: 14.5, z: 7.1, px: 14.5, pz: 7.1, h: 0, mode: 'sit', seat: 'cabin', dist: 0, live: false, talking: false, seq: 0};
    function makeKaavish() {
      const look = lookOf(data, data.L.founder);
      const h = lookHash(look);
      if (kRig && kLook === h) return false;
      if (kRig) { actors.remove(kRig.root); try { kRig.dispose(); } catch (e) { /* gone */ } }
      kRig = M.figure.build(T, look, {founder: true, lod: 0, live: true});
      kLook = h;
      actors.add(kRig.root);
      if (!kBlob) {
        kBlob = new T.Mesh(new T.CircleGeometry(0.42, 32), mats.blob); kBlob.rotation.x = -Math.PI / 2; kBlob.renderOrder = 1; decals.add(kBlob);
        kPool = new T.Mesh(new T.CircleGeometry(0.75, 40), mats.kpool); kPool.rotation.x = -Math.PI / 2; kPool.renderOrder = 1; kPool.position.y = 0.003; decals.add(kPool);
      }
      return true;
    }
    function kTick(dt, now) {
      if (!kRig || !data || !world) return false;
      const live = !!(K && K.live);
      let anim = false, moved2 = false;
      if (live) {
        const s = OF().kaavishAt(Date.now());
        if (s && s.mode !== 'sit') {
          const nx = cm(s.x), nz = cm(s.y);
          const moved = Math.hypot(nx - kav.x, nz - kav.z);
          kav.x = nx; kav.z = nz;
          /* his heading in degrees, a turn about the vertical as the crowd's is (0 faces the front of the floor) */
          /* v37: he turns toward his heading over a few frames */
          const hWant = isFinite(s.h) ? s.h * DEG : moved > 0.002 ? Math.atan2(nx - kav.px, nz - kav.pz) : kav.h;
          const hWas = kav.h;
          kav.h = angle(kav.h, hWant, Math.min(1, (dt || 0.016) * 12));
          if (Math.abs(kav.h - hWas) > 0.002) moved2 = true;
          kav.px = nx; kav.pz = nz;
          kav.mode = s.mode === 'walk' || (s.mode === 'pad' && moved > 0.0005) ? 'walk' : 'stand';
          kav.dist += moved;
          kav.talking = !!s.talking;
          anim = s.mode === 'walk' || s.mode === 'pad' || moved > 0.0005 || moved2;
        } else Object.assign(kav, seatOf('cabin'), {mode: 'sit', talking: !!(s && s.talking)});
      } else Object.assign(kav, seatOf(kOnline(data) ? 'cabin' : 'lounge'), {mode: 'sit', talking: false});
      kav.live = live;
      const talking = kav.talking || !!extra.typing;
      try {
        kRig.root.position.set(kav.x, 0, kav.z);
        kRig.root.rotation.y = kav.h;
        kRig.setPose(kav.mode === 'sit' ? 'sit' : kav.mode === 'walk' ? 'walk' : talking ? 'talk' : 'stand', now / 1000, {dist: kav.dist, seat: kav.seat === 'lounge' ? 0.42 : 0.46});
        if (kRig.talk) kRig.talk(talking ? 0.6 + 0.4 * Math.sin(now / 90) : 0);
      } catch (e) { /* a rig's own pose */ }
      /* a blink is two single frames every 4.2 s, only while he drives or talks: a timer asks for each one, so a
         still floor draws nothing in between */
      const blinking = (live || talking) && !doze;
      clearTimeout(blinkT);
      if (blinking && kRig.blink) {
        if (!blinkAt) blinkAt = now + 4200;
        if (!blinkOn && now >= blinkAt) { kRig.blink(true); blinkOn = true; blinkAt = now + 110; }
        else if (blinkOn && now >= blinkAt) { kRig.blink(false); blinkOn = false; blinkAt = now + 4200; }
        blinkT = setTimeout(() => invalidate(1), Math.max(16, blinkAt - now));
      } else if (blinkOn) { try { kRig.blink(false); } catch (e) { /* a rig's own eyes */ } blinkOn = false; blinkAt = 0; }
      kBlob.position.set(kav.x, 0.004, kav.z);
      kBlob.visible = kav.mode !== 'sit';
      kPool.visible = OF().driving(K);
      kPool.position.set(kav.x, 0.003, kav.z);
      return anim || talking;
    }
    function seatOf(which) {
      const s = world && world.seats[which];
      if (!s) return {x: 14.5, z: 7.1, h: 0, seat: which};
      return {x: s.x, z: s.z, h: s.h, seat: which};
    }

    /* ---------- walk-ins: a check-in under two minutes old walks from the door, past attendance ---------- */
    const walkins = new Map();
    function syncWalkins() {
      if (!data || !world) return false;
      const now = performance.now();
      const want = new Set((data.D || []).filter(x => x.arrival && x.state === 'office' && x.place === 'desk' && world.seats[x.uid]).map(x => x.uid));
      let changed = false;
      for (const [u, w] of walkins) if (!want.has(u)) { actors.remove(w.rig.root); try { w.rig.dispose(); } catch (e) { /* gone */ } decals.remove(w.blob); walkins.delete(u); crowdKey = crowdKey + '+'; changed = true; }
      for (const u of want) {
        if (walkins.has(u)) continue;
        changed = true;
        const rig = M.figure.build(T, lookOf(data, u), {founder: false, lod: 1});
        const blob = new T.Mesh(new T.CircleGeometry(0.34, 24), mats.blob); blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1;
        decals.add(blob); actors.add(rig.root);
        const s = world.seats[u], L = data.L;
        const pts = [{x: 0.44, z: cm(O.sy(L, 862))}, {x: 2.32, z: 6.62}, {x: s.x, z: s.z - s.dir * 0.6}, {x: s.x, z: s.z}];
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        /* v37: a walking pace, about 1.3 m a second */
        walkins.set(u, {rig, blob, pts, t0: now, seat: s, dur: clamp(1800, 9000, len / 1.3 * 1000)});
      }
      syncCrowd();
      return changed;
    }
    function walkTick(dt, now) {
      let anim = false;
      for (const w of walkins.values()) {
        const t = clamp(0, 1, (now - w.t0) / (w.dur || 800)), e = ease(t);
        let len = 0; const L2 = [0];
        for (let i = 1; i < w.pts.length; i++) { len += Math.hypot(w.pts[i].x - w.pts[i - 1].x, w.pts[i].z - w.pts[i - 1].z); L2.push(len); }
        const at = e * len; let i = 1;
        while (i < w.pts.length - 1 && L2[i] < at) i++;
        const a = w.pts[i - 1], b = w.pts[i], k = clamp(0, 1, (at - L2[i - 1]) / Math.max(1e-6, L2[i] - L2[i - 1]));
        const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
        w.rig.root.position.set(x, 0, z);
        w.rig.root.rotation.y = t < 1 ? Math.atan2(b.x - a.x, b.z - a.z) : w.seat.h;
        try { w.rig.setPose(t < 1 ? 'walk' : 'type', now / 1000, {dist: at, seat: 0.46}); } catch (x2) { /* a rig's own pose */ }
        w.blob.position.set(x, 0.004, z);
        w.blob.visible = t < 1;
        if (t < 1) anim = true;
      }
      return anim;
    }

    /* ---------- life (v37): people get up, go over to someone or the coffee, wave, and sit back down ----------
       A visit takes the person out of the baked crowd for its length: their own rig walks the plan's aisles
       (M.office.route), holds a wave with a bubble, walks back, and rejoins the crowd. An emote a person sends
       (me/<uid>.emote {e, at}) stands them up for a wave where they sit, or floats over their desk when they are
       away. Nothing here runs while the office is hidden, off screen, behind a drawer or dozing */
    const visits = new Map();
    const EMOJI = {wave: '\u{1F44B}', five: '\u{1F64C}', coffee: '☕', clap: '\u{1F44F}', fire: '\u{1F525}', party: '\u{1F389}'};
    const CHAT = [['Coffee?', 'coffee'], ['High five', 'five'], ['Nice work', 'clap'], ['Lunch?', 'party'], ['Quick sync?', 'wave'], ['You got this', 'fire']];
    const SPEED = 1.15;
    const seenEmote = {};
    /* v39: emotes are timed from when they arrive here (M.character.emoteClock); the sender's clock alone when it is missing */
    const emoteSee = M.character && M.character.emoteClock ? M.character.emoteClock()
      : (c, now) => Object.keys((c && c.map) || {}).map(uid => { const m = c.map[uid] && c.map[uid].emote; return m ? {uid, e: m.e, at: m.at, seen: Number(m.at) || 0} : null; }).filter(Boolean);
    const meColl = d => (d && d.ctx && d.ctx.coll ? d.ctx.coll.me : null);
    let nextVisit = performance.now() + 9000 + Math.random() * 9000;
    const planSeat = uid => (data && data.L && data.L.seats ? data.L.seats[uid] : null);
    function inOffice(uid) {
      const d = (data && data.D || []).find(x => x.uid === uid);
      return !!(d && d.state === 'office' && d.place === 'desk' && !d.cabin && world && world.seats[uid] && planSeat(uid));
    }
    const free = uid => inOffice(uid) && !walkins.has(uid) && !visits.has(uid);
    function bubble(text, anchor) {
      if (!o.layer) return null;
      const el = document.createElement('div');
      el.className = 'o3-emote';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = text;
      o.layer.appendChild(el);
      el.classList.add('o3-item');
      extras.set(el, {anchor, prio: 900});
      sizes.set(el, [el.offsetWidth, el.offsetHeight]);
      return el;
    }
    function unbubble(el) { if (!el) return; extras.delete(el); sizes.delete(el); el.remove(); }
    /* a visit: pts in world metres from the seat out; hold is the wave at the far end */
    function visit(uid, pts, o2) {
      const rig = M.figure.build(T, lookOf(data, uid), {founder: false, lod: 1});
      rig.root.visible = false;
      const blob = new T.Mesh(new T.CircleGeometry(0.34, 24), mats.blob); blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1; blob.visible = false;
      actors.add(rig.root); decals.add(blob);
      let len = 0; const offs = [0];
      for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); offs.push(len); }
      const v = {uid, rig, blob, pts, offs, len, phase: 'wait', t0: 0, made: performance.now(), hold: o2.hold || 2600, face: o2.face || null,
        say: o2.say || '', pose: o2.pose || 'wave', el: null, partner: o2.partner || '', seat: world.seats[uid]};
      /* an emote shows at once, over the desk until the person is up */
      if (o2.now && v.say) v.el = bubble(v.say, () => { const q = v.rig.root.visible ? v.rig.root.position : v.seat; return [q.x, v.rig.root.visible ? 2.05 : 1.95, q.z]; });
      visits.set(uid, v);
      crowdKey = crowdKey + '~';
      syncCrowd();
      invalidate(1);
      return v;
    }
    const at = (v, d) => {
      let i = 1;
      while (i < v.pts.length - 1 && v.offs[i] < d) i++;
      const a = v.pts[i - 1], b = v.pts[i], k = clamp(0, 1, (d - v.offs[i - 1]) / Math.max(1e-6, v.offs[i] - v.offs[i - 1]));
      return {x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: Math.atan2(b.x - a.x, b.z - a.z)};
    };
    const inCrowd = uid => crowdItems.some(i => i.uid === uid);
    function endVisit(v) {
      unbubble(v.el);
      actors.remove(v.rig.root); decals.remove(v.blob);
      try { v.rig.dispose(); } catch (e) { /* gone */ }
      v.blob.geometry.dispose();
      visits.delete(v.uid);
    }
    function visitTick(dt, now) {
      if (!visits.size) return false;
      for (const v of Array.from(visits.values())) {
        const walkMs = Math.max(400, v.len / SPEED * 1000);
        /* out of the crowd first, so nobody shows twice */
        if (v.phase === 'wait') {
          if (inCrowd(v.uid) && now - v.made < 4000) continue;
          v.phase = v.len > 0.05 ? 'out' : 'hold'; v.t0 = now; v.rig.root.visible = true; v.blob.visible = true;
        }
        let p = null, pose = 'walk', dist = 0;
        if (v.phase === 'out' || v.phase === 'back') {
          const t = clamp(0, 1, (now - v.t0) / walkMs), e = ease(t);
          dist = (v.phase === 'out' ? e : 1 - e) * v.len;
          p = at(v, dist);
          if (v.phase === 'back') p.h += Math.PI;
          if (t >= 1) {
            if (v.phase === 'out') { v.phase = 'hold'; v.t0 = now; }
            else { v.phase = 'home'; v.t0 = now; crowdKey = crowdKey + '~'; syncCrowd(); }
          }
        }
        if (v.phase === 'hold') {
          const end = v.pts[v.pts.length - 1];
          const f = typeof v.face === 'function' ? v.face() : v.face;
          const toCam = Math.atan2(camera.position.x - end.x, camera.position.z - end.z);
          p = {x: end.x, z: end.z, h: f ? angle(Math.atan2(f.x - end.x, f.z - end.z), toCam, 0.3) : toCam};
          pose = v.pose;
          if (!v.el && v.say) { const vv = v; v.el = bubble(v.say, () => { const q = vv.rig.root.position; return [q.x, 2.05, q.z]; }); }
          if (now - v.t0 > v.hold) { unbubble(v.el); v.el = null; v.phase = v.len > 0.05 ? 'back' : 'home'; v.t0 = now; if (v.phase === 'home') { crowdKey = crowdKey + '~'; syncCrowd(); } }
        }
        if (v.phase === 'home') {
          const s = v.seat;
          p = {x: s.x, z: s.z, h: s.h};
          pose = 'type';
          v.blob.visible = false;
          /* the crowd has them back, or it is taking too long: the rig goes */
          if (inCrowd(v.uid) || now - v.t0 > 5000) { endVisit(v); invalidate(2); continue; }
        }
        if (!p) continue;
        v.rig.root.position.set(p.x, 0, p.z);
        v.rig.root.rotation.y = p.h;
        try { v.rig.setPose(pose, now / 1000, {dist, seat: 0.46}); } catch (e) { /* a rig's own pose */ }
        v.blob.position.set(p.x, 0.004, p.z);
      }
      return visits.size > 0;
    }
    /* the world points of a walk on the plan: the seat, then the aisles to the place (plan cm, y down the floor) */
    function walkPts(uid, to) {
      const s = world.seats[uid], ps = planSeat(uid);
      const r = O.route ? O.route(data.L, {x: ps.x, y: ps.y}, to) : [{x: ps.x, y: ps.y}, to];
      const pts = [{x: s.x, z: s.z}];
      for (const q of r.slice(1)) pts.push({x: cm(q.x), z: cm(q.y)});
      return pts;
    }
    /* stand up and wave where they sit: a step back from the desk into the aisle */
    function standWave(uid, say, face, hold, now) {
      const s = world.seats[uid];
      const step = {x: s.x, z: s.z - (s.dir || 1) * 0.42};
      return visit(uid, [{x: s.x, z: s.z}, step], {say, face, hold: hold || 3000, pose: 'wave', now: !!now});
    }
    function ambient() {
      if (dead || !st.ready || !world || !data || paused() || doze || win || M.prefs.get('office.life', 'on') === 'off') return;
      const now = performance.now();
      if (now < nextVisit || visits.size >= 2) return;
      nextVisit = now + 20000 + Math.random() * 20000;
      if (dayNight()) return;
      const people = (data.D || []).map(x => x.uid).filter(free);
      if (!people.length) return;
      const who = people[Math.floor(Math.random() * people.length)];
      const others = people.filter(u => u !== who);
      const [line, emo] = CHAT[Math.floor(Math.random() * CHAT.length)];
      if (others.length && Math.random() < 0.65) {
        const mate = others[Math.floor(Math.random() * others.length)];
        const sp = O.standPoint ? O.standPoint(data.L, 'desk:' + mate) : null;
        if (!sp) return;
        const pts = walkPts(who, sp);
        const ms = world.seats[mate];
        const v = visit(who, pts, {say: EMOJI[emo] + ' ' + line, face: {x: ms.x, z: ms.z}, hold: 3200, pose: 'wave'});
        /* the colleague stands to wave back when the visitor arrives */
        const walkMs = Math.max(400, v.len / SPEED * 1000);
        setTimeout(safe(() => { if (!dead && free(mate)) { const vv = visits.get(who); standWave(mate, EMOJI.wave, vv ? () => vv.rig.root.position : null, 2600); } }), walkMs + 900);
      } else {
        const spot = O.spotOf ? O.spotOf(data.L, 'coffee') : null;
        if (!spot) return;
        visit(who, walkPts(who, {x: spot.x, y: spot.y}), {say: EMOJI.coffee + ' Coffee run', hold: 3600, pose: 'talk'});
      }
    }
    const lifeTimer = setInterval(() => { try { ambient(); } catch (e) { fail(e); } }, 1500);
    /* the emotes people send from the emote bar, read off their me doc */
    function emotes(d) {
      const now = Date.now();
      for (const m of emoteSee(meColl(d), now)) {
        const uid = m.uid;
        if (!EMOJI[m.e] || !(m.seen > now - 9000) || seenEmote[uid] === m.at) continue;
        seenEmote[uid] = m.at;
        if (!st.ready || !world) continue;
        if (free(uid)) { standWave(uid, EMOJI[m.e], null, 4200, true); continue; }
        const founder = d.L && uid === d.L.founder;
        const el = bubble(EMOJI[m.e], () => (founder ? [kav.x, kav.mode === 'sit' ? 1.9 : 2.1, kav.z] : (() => { const a = anchorOf('desk:' + uid); return a ? [a[0], a[1] + 0.55, a[2]] : null; })()));
        if (el) { invalidate(2); setTimeout(safe(() => { unbubble(el); invalidate(1); }), 6000); }
      }
    }

    /* ---------- the camera ---------- */
    const fit = {dx: 0, dy: 0};
    function slabPts() {
      const S = world ? world.slab : WD().slab(data.L);
      const out = [];
      for (const x of [S.x0, S.x1]) for (const z of [S.z0, S.z1]) for (const y of [-S.h - 0.2, 2.3]) out.push(new T.Vector3(x, y, z));
      return out;
    }
    function place(cam, t, az, el, d) {
      cam.position.set(t.x + Math.sin(az) * Math.cos(el) * d, t.y + Math.sin(el) * d, t.z + Math.cos(az) * Math.cos(el) * d);
      cam.lookAt(t); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    }
    function fitDist(c, aspect) {
      const pts = slabPts(), cam = new T.PerspectiveCamera(c.fov, aspect, 0.3, 300);
      const [pt, pb, pl, pr] = c.pad;
      let lo = 4, hi = 160;
      /* the lens shift centres it after, so only its height has to fit, and its width */
      for (let i = 0; i < 28; i++) {
        const dd = (lo + hi) / 2;
        place(cam, c.target, c.az, c.el, dd);
        let ok = true, x0 = 1, x1 = -1, y0 = 1, y1 = -1;
        for (const p of pts) { const v = p.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); if (v.z > 1) ok = false; }
        if (ok && (y1 - y0 > 2 - 2 * (pt + pb) || x1 - x0 > 2 - 2 * (pl + pr))) ok = false;
        if (ok) hi = dd; else lo = dd;
      }
      return hi;
    }
    function preset(kind) {
      const S = world ? world.slab : WD().slab(data.L);
      const mid = new T.Vector3((S.x0 + S.x1) / 2, 0.35, (S.z0 + S.z1) / 2);
      const az = phone ? -79 * DEG : -21 * DEG, fov = phone ? 26 : 22;
      if (kind === 'floor' || kind === 'floor-phone') return phone ? {target: mid, az, el: 56 * DEG, fov, pad: [0.05, 0.05, 0.03, 0.03], whole: true} : {target: mid, az, el: 37 * DEG, fov, pad: [0.05, 0.05, 0.03, 0.03], whole: true};
      if (kind === 'kaavish') return {target: new T.Vector3(kav.x, 0.9, kav.z), az, el: 30 * DEG, fov, dist: win ? 6.5 : 5.5, follow: 'kaavish'};
      return {target: new T.Vector3(coo.x, 1.0, coo.z), az, el: 30 * DEG, fov, dist: win ? 6.5 : 5.5, follow: 'coo'};
    }
    let tween = null, follow = null;
    function setCam(kind, instant) {
      camKind = kind || 'floor';
      userCam = false;
      const c = preset(camKind);
      const r = o.view.getBoundingClientRect(), Wd = Math.max(1, r.width), Hd = Math.max(1, r.height);
      const aspect = Wd / Hd;
      const whole = preset(phone ? 'floor-phone' : 'floor');
      fitD = fitDist(whole, aspect);
      const d = c.dist || fitDist(c, aspect);
      /* a lens shift, as a product photographer would use: the floor centred in the frame without tilting */
      let dx = 0, dy = 0;
      if (c.whole) {
        const cam2 = new T.PerspectiveCamera(c.fov, aspect, 0.3, 300);
        place(cam2, c.target, c.az, c.el, d);
        let lo = 1, hi = -1, l = 1, r2 = -1;
        for (const p of slabPts()) { const v = p.clone().project(cam2); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); l = Math.min(l, v.x); r2 = Math.max(r2, v.x); }
        dy = -(lo + hi) / 2 * Hd / 2;
        dx = (l + r2) / 2 * Wd / 2;
      }
      controls.minAzimuthAngle = c.az - 50 * DEG; controls.maxAzimuthAngle = c.az + 50 * DEG;
      controls.minDistance = Math.min(0.3 * fitD, 0.6 * d); controls.maxDistance = Math.max(1.15 * fitD, d);
      follow = c.follow || null;
      const from = {target: controls.target.clone(), pos: camera.position.clone(), fov: camera.fov, dx: fit.dx, dy: fit.dy};
      const to = {target: c.target.clone(), az: c.az, el: c.el, d, fov: c.fov, dx, dy};
      if (instant || !st.ready) { apply(to); tween = null; }
      else tween = {from, to, t0: performance.now(), dur: 700};
      invalidate(2);
    }
    function apply(to) {
      camera.fov = to.fov;
      fit.dx = to.dx || 0; fit.dy = to.dy || 0;
      size();
      controls.target.copy(to.target);
      place(camera, to.target, to.az, to.el, to.d);
      controls.update();
    }
    function size() {
      const r = o.view.getBoundingClientRect(), Wd = Math.max(1, Math.round(r.width)), Hd = Math.max(1, Math.round(r.height));
      camera.aspect = Wd / Hd;
      if (fit.dx || fit.dy) camera.setViewOffset(Wd, Hd, Math.round(fit.dx), Math.round(fit.dy), Wd, Hd); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function camTick(dt, now) {
      let anim = false;
      if (tween) {
        const t = clamp(0, 1, (now - tween.t0) / tween.dur), e = ease(t), a = tween.from, b = tween.to;
        const tgt = a.target.clone().lerp(b.target, e);
        const endPos = new T.Vector3(b.target.x + Math.sin(b.az) * Math.cos(b.el) * b.d, b.target.y + Math.sin(b.el) * b.d, b.target.z + Math.cos(b.az) * Math.cos(b.el) * b.d);
        camera.position.copy(a.pos.clone().lerp(endPos, e));
        camera.fov = a.fov + (b.fov - a.fov) * e;
        fit.dx = (a.dx || 0) + ((b.dx || 0) - (a.dx || 0)) * e; fit.dy = (a.dy || 0) + ((b.dy || 0) - (a.dy || 0)) * e;
        size();
        controls.target.copy(tgt);
        camera.lookAt(tgt);
        if (t >= 1) { tween = null; apply(b); }
        anim = true;
      } else if (follow) {
        /* follow: the target glides after the COO or Kaavish, the viewer's own orbit kept */
        const want = follow === 'coo' ? new T.Vector3(coo.x, 1.0, coo.z) : new T.Vector3(kav.x, 0.9, kav.z);
        const d = want.clone().sub(controls.target);
        if (d.lengthSq() > 1e-6) {
          const step = d.multiplyScalar(Math.min(1, dt * 4));
          controls.target.add(step); camera.position.add(step);
          anim = true;
        }
      }
      return anim;
    }
    /* ease the viewer's own camera toward something they tapped */
    function look(target) {
      if (!target || win) return;
      const to = target.clone ? target : new T.Vector3(target[0], 0.8, target[2]);
      const off = camera.position.clone().sub(controls.target);
      const d = Math.min(off.length(), Math.max(controls.minDistance * 1.6, fitD * 0.55));
      off.setLength(d);
      const sph = {az: Math.atan2(off.x, off.z), el: Math.asin(clamp(-1, 1, off.y / d))};
      tween = {from: {target: controls.target.clone(), pos: camera.position.clone(), fov: camera.fov, dx: fit.dx, dy: fit.dy},
        to: {target: new T.Vector3(to.x, 0.8, to.z), az: sph.az, el: sph.el, d, fov: camera.fov, dx: 0, dy: 0}, t0: performance.now(), dur: 700};
      follow = null;
      invalidate(2);
    }
    function refit() { if (!userCam) setCam(camKind, true); else size(); }
    controls.addEventListener('start', safe(() => { userCam = true; tween = null; poke(); }));
    controls.addEventListener('change', safe(() => invalidate(1)));

    /* ---------- the loop: on demand, capped, paused when nobody can see it ---------- */
    let lastPoke = Date.now();
    function poke() { lastPoke = Date.now(); if (doze) { doze = false; if (o.onDoze) o.onDoze(false); } invalidate(1); }
    const dprMax = () => Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 2);
    let dprMove = dprMax(), slow = [], watch = [];
    const stillDpr = () => {
      const w = o.view.clientWidth, h = o.view.clientHeight, base = window.devicePixelRatio || 1, cap = phone ? 3 : 2, mp = phone ? 3e6 : 8.3e6;
      return Math.max(1, Math.min(base, cap, Math.sqrt(mp / Math.max(1, w * h))));
    };
    function paused() { return !visible || !onScreen || hushed; }
    function invalidate(n) { need = Math.max(need, n || 1); kick(); }
    function kick() { if (!raf && !dead && st.ready && !paused() && !Rr.lost) raf = requestAnimationFrame(frame); }
    function setDpr(r) { if (Math.abs(gl.getPixelRatio() - r) < 0.01) return; gl.setPixelRatio(r); const v = o.view; gl.setSize(Math.max(1, v.clientWidth), Math.max(1, v.clientHeight), false); st.dpr = r; }
    function frame(now) {
      raf = 0;
      /* paused mid motion: the time away is not a frame, so neither the density step nor the watchdog sees it */
      if (dead || paused() || Rr.lost) { last = 0; return; }
      if (last && now - last < 1000 / FPS - 2) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
      const gap = last ? now - last : 0;
      last = now;
      st.frames++;
      let busy = false;
      try {
        st.why = [];
        for (const f of ticks) if (f(dt, now)) { busy = true; st.why.push(f.name || 'tick'); }
        const moved = controls.enabled && controls.update(dt);
        if (moved) st.why.push('orbit');
        if (need > 0) st.why.push('need');
        if (busy || moved || need > 0) {
          need = Math.max(0, need - 1);
          if (busy || moved) {
            if (!moving) { moving = true; setDpr(dprMove); }
            else if (gap) adapt(gap);
          }
          draw();
        }
        if (busy || moved || need > 0) raf = requestAnimationFrame(frame);
        else { last = 0; settle(); }
      } catch (e) { fail(e); }
    }
    /* moving frames step down to 1x when the p75 interval misses the budget; the watchdog may go flat */
    function adapt(gap) {
      slow.push(gap);
      if (slow.length > 30) slow.shift();
      const p75 = q75(slow);
      if (slow.length >= 20 && dprMove > 1 && p75 > (FPS === 60 ? 16.7 : 33.3) * 1.15) { dprMove = 1; setDpr(1); slow = []; }
      if (gl.getPixelRatio() <= 1.001 && !forced() && watch.length < 90) {
        watch.push(gap);
        if (watch.length === 90 && q75(watch) > 50) { M.prefs.set('office.flatUntil', String(Date.now() + 7 * 86400000)); notify(); }
      }
    }
    const q75 = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.75)] || 0; };
    /* motion settled: one still frame at full density */
    function settle() {
      if (!moving) return;
      moving = false;
      const r = stillDpr();
      if (Math.abs(gl.getPixelRatio() - r) > 0.01) { setDpr(r); draw(); }
    }
    function draw() {
      gl.info.autoReset = false;
      gl.info.reset();
      gl.render(scene, camera);
      st.renders++;
      st.calls = gl.info.render.calls;
      st.tris = gl.info.render.triangles;
      overlayUpdate();
    }

    /* ---------- the overlay solver ---------- */
    const _v = new T.Vector3();
    function project(p, Wd, Hd) {
      _v.set(p[0], p[1], p[2]).project(camera);
      return {x: (_v.x + 1) / 2 * Wd, y: (1 - _v.y) / 2 * Hd, ok: _v.z < 1 && _v.z > -1};
    }
    const sizes = new Map();
    function measure() {
      for (const [k, el] of items) {
        if (!el || !el.isConnected) continue;
        const f = el.classList.contains('is-folded');
        if (f) el.classList.remove('is-folded');
        sizes.set(k, [el.offsetWidth, el.offsetHeight]);
        if (f) el.classList.add('is-folded');
      }
      for (const [el] of extras) if (el.isConnected) sizes.set(el, [el.offsetWidth, el.offsetHeight]);
    }
    function anchorOf(k) {
      if (!world || !data) return null;
      const L = data.L;
      if (k.indexOf('st:') === 0) return world.anchors[k.slice(3)] || null;
      if (k.indexOf('desk:') === 0) {
        const u = k.slice(5), d = (data.D || []).find(x => x.uid === u);
        if (!d) return null;
        const s = world.seats[u];
        if (d.place === 'meeting' || d.place === 'lunch') return [cm(d.x), 1.42, cm(d.y)];
        if (!s) return [cm(d.x), 1.0, cm(d.y)];
        const w = walkins.get(u);
        if (w) { const p = w.rig.root.position; return [p.x, 1.45, p.z]; }
        const vz = visits.get(u);
        if (vz && vz.rig.root.visible) { const p = vz.rig.root.position; return [p.x, 1.62, p.z]; }
        return d.state === 'office' ? [s.x, 1.42, s.z] : [s.x, 0.98, s.edge + s.dir * 0.42];
      }
      if (k === 'founder') return [kav.x, kav.mode === 'sit' ? 1.36 : 1.5, kav.z];
      if (k === 'coo' || k === 'dot:coo') return [coo.x, coo.y + (k === 'dot:coo' ? 0.34 : 0), coo.z];
      if (k === 'bubble') return [coo.x, coo.y + 0.3, coo.z];
      if (k === 'say' || k === 'dot:k') return [kav.x, kav.mode === 'sit' ? 1.3 : 1.6, kav.z];
      void L;
      return null;
    }
    function faces(Wd, Hd) {
      const out = [];
      const add = (p, r, tag) => { const c = project(p, Wd, Hd), e = project([p[0], p[1] + r, p[2]], Wd, Hd); out.push({x: c.x, y: c.y, r: Math.max(6, Math.abs(c.y - e.y) * 1.25), tag}); };
      for (const it of crowdItems) add([it.x, 1.0, it.y], 0.21);
      add([coo.x, coo.y, coo.z], 0.26);
      add([kav.x, kav.mode === 'sit' ? 1.0 : 1.13, kav.z], 0.22);
      return out;
    }
    function overlayUpdate() {
      if (!world || !data) return;
      const Wd = o.view.clientWidth, Hd = o.view.clientHeight;
      if (!Wd || !Hd) return;
      const F = faces(Wd, Hd);
      const placed = (extra.reserved || []).slice();
      const faceHit = (r, noTags) => F.reduce((n, f) => { if (noTags && f.tag) return n; const cx = clamp(r.x0, r.x1, f.x), cy = clamp(r.y0, r.y1, f.y); const dd = Math.hypot(f.x - cx, f.y - cy); return n + (dd < f.r ? f.r - dd : 0); }, 0);
      const put = (el, x, y) => { el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)'; };
      const hide = el => { el.style.transform = 'translate3d(-9999px,-9999px,0)'; };
      /* Kaavish's pill and the COO's hit area first: they are always there, and nothing sits on them */
      let pill = null;
      for (const k of ['founder', 'coo']) {
        const el = items.get(k);
        if (!el || !el.isConnected) continue;
        const a = anchorOf(k), s = a ? project(a, Wd, Hd) : null;
        if (!s || !s.ok || s.x < -60 || s.x > Wd + 60 || s.y < -40 || s.y > Hd + 80) { hide(el); continue; }
        if (k === 'coo') {
          /* its head on screen, at least 32 px */
          const e = project([a[0], a[1] + 0.22, a[2]], Wd, Hd);
          const px = clamp(32, 120, Math.abs(s.y - e.y) * 2.2);
          el.style.setProperty('--bot', Math.round(px) + 'px');
          put(el, s.x - px / 2, s.y - px / 2);
          placed.push({x0: s.x - px / 2, x1: s.x + px / 2, y0: s.y - px / 2, y1: s.y + px / 2});
          continue;
        }
        const [w, h] = sizes.get(k) || [el.offsetWidth, el.offsetHeight];
        pill = {x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h, y1: s.y};
        put(el, pill.x0, pill.y0);
        placed.push(pill);
      }
      /* then the two bubbles, chosen together: five places each, the fewest faces covered, never on each other;
         Kaavish's sits over his pill */
      const bubs = ['bubble', 'say'].filter(k => items.get(k) && items.get(k).isConnected);
      const opts = bubs.map(k => {
        const el = items.get(k), [w, h] = sizes.get(k) || [el.offsetWidth, el.offsetHeight];
        const s = project(anchorOf(k), Wd, Hd);
        if (!s.ok) return [{k, el, off: true, cost: 0}];
        const y = k === 'say' && pill ? Math.min(s.y - 14, pill.y0 - 10) : s.y - 14;
        return [0, -w / 2 + 22, w / 2 - 22, -w / 2 - 10, w / 2 + 10].map(dx => {
          const r = {x0: s.x + dx - w / 2, x1: s.x + dx + w / 2, y0: y - h, y1: y};
          const sh = Math.max(8 - r.x0, Math.min(0, Wd - 8 - r.x1));
          r.x0 += sh; r.x1 += sh;
          let cost = faceHit(r) * 4 + Math.abs(dx) * 0.05 + Math.abs(sh) * 0.5;
          if (r.y0 < 8) cost += (8 - r.y0) * 3;
          cost += placed.reduce((n, p) => n + (rectHit(r, p, 6) ? 400 : 0), 0);
          return {k, el, r, cost, ax: s.x};
        });
      });
      let pick = opts.map(list => list.reduce((m, c) => (c.cost < m.cost ? c : m)));
      if (opts.length === 2) {
        let best = Infinity;
        for (const p of opts[0]) for (const q of opts[1]) {
          const c = p.cost + q.cost + (p.r && q.r ? (rectHit(p.r, q.r, 6) ? 400 : 0) + overArea(p.r, q.r) / 40 : 0);
          if (c < best) { best = c; pick = [p, q]; }
        }
      }
      for (const b of pick) {
        if (b.off || !b.r) { hide(b.el); continue; }
        b.el.style.setProperty('--tail', Math.round(clamp(14, b.r.x1 - b.r.x0 - 14, b.ax - b.r.x0)) + 'px');
        put(b.el, b.r.x0, b.r.y0);
        placed.push(b.r);
      }
      /* then the people, then the stations, quietest last */
      const keys = [];
      for (const k of items.keys()) if (k !== 'bubble' && k !== 'say' && k !== 'founder' && k !== 'coo') keys.push(k);
      const prio = k => (k.indexOf('dot:') === 0 ? 870 : k.indexOf('desk:') === 0 ? 520 : k.indexOf('st:') === 0 ? 300 : 100);
      keys.sort((a, b) => prio(b) - prio(a));
      for (const k of keys) {
        const el = items.get(k);
        if (!el || !el.isConnected) continue;
        const a = anchorOf(k);
        if (!a) { hide(el); continue; }
        const s = project(a, Wd, Hd);
        if (!s.ok || s.x < -60 || s.x > Wd + 60 || s.y < -40 || s.y > Hd + 80) { hide(el); continue; }
        const [w, h] = sizes.get(k) || [el.offsetWidth, el.offsetHeight];
        if (k.indexOf('dot:') === 0) { put(el, s.x - 4, s.y - 4); continue; }
        let r = {x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h, y1: s.y};
        const station = k.indexOf('st:') === 0;
        if (station) {
          /* a station's label fades while its place is small on screen; focus or a closer look brings it back */
          const A = OF().AREA[k.slice(3)];
          if (A) {
            const z0 = cm(OF().sy(data.L, A[1])), z1 = cm(OF().sy(data.L, A[1] + A[3]));
            const xs = [[A[0], z0], [A[0] + A[2], z0], [A[0], z1], [A[0] + A[2], z1]].map(([x, z]) => project([cm(x), 0, z], Wd, Hd).x);
            el.classList.toggle('is-faded', Math.max(...xs) - Math.min(...xs) < 90);
          }
        }
        const bad = q => placed.some(p => rectHit(q, p, 3)) || faceHit(q, true) > 2 || q.y0 < 0 || q.x0 < 0 || q.x1 > Wd;
        let collide = bad(r);
        if (collide) {
          const alts = station ? [[-(w / 2 + 8), 0], [w / 2 + 8, 0]] : [[0, h + 16], [-(w / 2 + 8), 0], [w / 2 + 8, 0]];
          for (const [dx, dy] of alts) { const q = {x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + dy, y1: r.y1 + dy}; if (!bad(q)) { r = q; collide = false; break; } }
        }
        const fold = collide || (phone && k.indexOf('desk:') === 0);
        el.classList.toggle('is-folded', fold);
        if (fold) {
          /* v39: the dot keeps off every tag already placed (it showed through a quiet tag's words), and later tags keep off it */
          const dots = [[0, 0], [0, -12], [-12, 0], [12, 0], [0, 12]].map(([dx, dy]) => ({x0: s.x - 4 + dx, x1: s.x + 4 + dx, y0: s.y - 8 + dy, y1: s.y + dy}));
          const spot = dots.find(q => !placed.some(p => rectHit(q, p, 1))) || dots[0];
          put(el, spot.x0, spot.y0);
          placed.push(spot);
          continue;
        }
        put(el, r.x0, r.y0);
        placed.push(r);
      }
      /* what others placed (the Arrange handles, a walk target) */
      for (const [el, x] of extras) {
        if (!el.isConnected) continue;
        let a = null;
        try { a = x.anchor(); } catch (e) { a = null; }
        if (!a) { hide(el); continue; }
        const p = Array.isArray(a) ? a : [cm(a.x), a.h == null ? 0 : a.h, cm(a.y)];
        const s = project(p, Wd, Hd);
        const [w, h] = sizes.get(el) || [el.offsetWidth, el.offsetHeight];
        if (!s.ok) hide(el); else put(el, s.x - w / 2, s.y - h / 2);
      }
      flightsTick();
    }

    /* ---------- flights and beats ---------- */
    const flights = new Map();
    function flight(el, f, done) {
      if (!el) return;
      const from = [cm(f.from.x), 0.9, cm(f.from.y)], to = [cm(f.to.x), 0.9, cm(f.to.y)];
      const dd = Math.hypot(to[0] - from[0], to[2] - from[2]);
      flights.set(f.id, {el, from, to, apex: 0.6 + 0.18 * dd, t0: performance.now(), dur: clamp(360, 900, 300 + dd * 60), done});
      invalidate(1);
    }
    function flightsTick() {
      const now = performance.now(), Wd = o.view.clientWidth, Hd = o.view.clientHeight;
      for (const [id, f] of flights) {
        const t = clamp(0, 1, (now - f.t0) / f.dur), e = ease(t);
        const p = [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + Math.sin(Math.PI * t) * f.apex, f.from[2] + (f.to[2] - f.from[2]) * e];
        const s = project(p, Wd, Hd);
        f.el.style.transform = 'translate3d(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px,0)';
        if (t >= 1) { flights.delete(id); f.done(id); }
      }
    }
    ticks.add(function flightTick() { return flights.size > 0; });
    const BEAT_AT = {roll: 'attendance', stamp: 'calendar', slide: 'board', pin: 'review', pitch: 'clients', books: 'books', board: 'meeting', orb: 'desk'};
    function beat(k) {
      const at = world && world.anchors[BEAT_AT[k]];
      if (!at || !o.layer) return;
      const el = document.createElement('div');
      el.className = 'o3-beat o3-item';
      el.setAttribute('aria-hidden', 'true');
      o.layer.appendChild(el);
      const Wd = o.view.clientWidth, Hd = o.view.clientHeight;
      const s = project([at[0], at[1] - 0.25, at[2]], Wd, Hd);
      el.style.transform = 'translate3d(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px,0)';
      setTimeout(() => el.remove(), 1400);
    }

    /* ---------- the floor under a pointer, and a plan point on screen ---------- */
    const ray = new T.Raycaster(), floorPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function floorHit(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !world) return null;
      ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      const p = new T.Vector3();
      if (!ray.ray.intersectPlane(floorPlane, p)) return null;
      const S = world.slab;
      if (p.x < S.x0 + 0.3 || p.x > S.x1 - 0.3 || p.z < S.z0 + 0.3 || p.z > S.z1 - 0.3) return null;
      return {x: Math.round(p.x * 100), y: Math.round(p.z * 100)};
    }
    function toScreen(pt, h) {
      const s = project([cm(pt.x), h || 0, cm(pt.y)], o.view.clientWidth, o.view.clientHeight);
      return {x: s.x, y: s.y, visible: s.ok};
    }

    /* ---------- life ---------- */
    ticks.add(cooTick); ticks.add(kTick); ticks.add(walkTick); ticks.add(visitTick); ticks.add(camTick);
    /* a new size clears the canvas: it is drawn again at once, even behind a drawer, so it never stands blank */
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(safe(() => {
      const v = o.view;
      gl.setSize(Math.max(1, v.clientWidth), Math.max(1, v.clientHeight), false);
      backdrop(); refit(); measure();
      if (st.ready && visible && !Rr.lost) draw();
      invalidate(2);
    })) : null;
    if (ro) ro.observe(o.view);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(safe(es => { onScreen = es.some(e => e.isIntersecting); if (o.onScreen) o.onScreen(onScreen); if (onScreen) invalidate(2); }), {threshold: 0.02}) : null;
    if (io) io.observe(o.host);
    const onVis = safe(() => { visible = document.visibilityState !== 'hidden'; if (visible) { last = 0; invalidate(2); } });
    document.addEventListener('visibilitychange', onVis);
    const offTheme = M.theme && M.theme.subscribe ? M.theme.subscribe(safe(() => { if (st.ready) { tok = null; paint(); } })) : null;
    Rr.onRestored = safe(() => { gl.shadowMap.needsUpdate = true; invalidate(2); });
    const onKey = safe(e => {
      if (e.ctrlKey || e.metaKey || e.altKey || win) return;
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        e.preventDefault();
        const off = camera.position.clone().sub(controls.target);
        off.setLength(clamp(controls.minDistance, controls.maxDistance, off.length() * (e.key === '-' || e.key === '_' ? 1.18 : 0.85)));
        camera.position.copy(controls.target).add(off);
        userCam = true;
        invalidate(2);
      }
    });
    const onPoke = safe(poke);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPoke);
    canvas.addEventListener('wheel', onPoke, {passive: true});
    canvas.addEventListener('focus', onPoke);

    function fail(e) {
      if (dead) return;
      try { console.warn('The 3D office stopped:', e && e.message ? e.message : e); } catch (x) { /* quiet */ }
      setFlag('error');
    }

    const api = {T, camera, canvas, controls, mode: o.kind, phone,
      floorHit, toScreen, invalidate,
      tick(fn) { ticks.add(fn); invalidate(1); return () => ticks.delete(fn); },
      overlay: {add(el, anchor, prio) { if (!el) return; extras.set(el, {anchor, prio: prio || 100}); if (!el.parentNode && o.layer) o.layer.appendChild(el); el.classList.add('o3-item'); sizes.set(el, [el.offsetWidth, el.offsetHeight]); invalidate(1); },
        remove(el) { extras.delete(el); sizes.delete(el); if (el && el.parentNode === o.layer) el.remove(); invalidate(1); }},
      colliders: () => (world ? world.colliders.slice() : []),
      drawers: o.drawers,
      preset: kind => setCam(kind),
      /* the camera is the viewer's own from here (Arrange moves it): a rebuild or a resize keeps it where it is */
      hold() { userCam = true; tween = null; follow = null; },
      look: p => look(new T.Vector3(cm(p.x), 0.8, cm(p.y))),
      reserve(list) { extra.reserved = list || []; invalidate(1); }};

    /* ---------- start: lights, the world, the actors, the first frame ---------- */
    function start(d0) {
      data = d0;
      try { const t0 = Date.now(); for (const m of emoteSee(meColl(d0), t0)) if (!(m.seen > t0 - 4000)) seenEmote[m.uid] = m.at; } catch (e) { /* none yet */ }
      tok = null;
      makeCoo();
      makeKaavish();
      rebuild(data, () => {
        paint();
        syncWalkins();
        setCam(camKind, true);
        const first = () => {
          if (dead) return;
          const t0 = performance.now();
          for (const f of ticks) f(0.016, t0);
          setDpr(stillDpr());
          gl.shadowMap.needsUpdate = true;
          draw();
          st.firstFrame = performance.now() - t0;
          st.ready = true;
          measure();
          overlayUpdate();
          if (o.onReady) o.onReady();
          invalidate(1);
        };
        const go = safe(first);
        const p = gl.compileAsync ? gl.compileAsync(scene, camera) : null;
        if (p && p.then) p.then(go, go); else go();
      });
    }
    function setData(d) {
      const prev = data;
      data = d;
      if (!world || !st.ready) return;
      if (signature(d) !== worldKey) rebuild(d);
      if (!prev || prev.day.night !== d.day.night) paint();
      /* the app's data moves every minute and with every change anywhere: that alone draws nothing. The world, the
         paint and the crowd ask for their own frames; a new rig for him or a walk-in asks here */
      const rig = makeKaavish();
      const walk = syncWalkins();
      syncCrowd();
      emotes(d);
      if (rig || walk) invalidate(1);
    }
    /* the rig's state, from the director's view: walking, asleep on its pad, on its pad at its desk, working, or hovering */
    let rigState = '';
    function setView(v, rest, lst) {
      const was = view;
      view = v;
      coo.listening = !!lst;
      if (cooRig) {
        const r = rest || {};
        const seated = !v.walking && v.spot === 'desk' && r.seat !== false;
        const name = v.walking ? 'walking' : r.asleep && v.spot === r.station ? 'sleeping' : seated ? 'desk' : v.state === 'working' ? 'working' : 'default';
        try {
          if (name !== rigState && cooRig.setState) cooRig.setState(name);
          if (cooRig.listen) cooRig.listen(!!lst);
        } catch (e) { /* a rig's own state */ }
        rigState = name;
      }
      if (!was || was.spot !== v.spot) coo.landed = performance.now();
      invalidate(1);
    }
    function setKaavish(k, ex) { K = k; extra.typing = !!(ex && ex.typing); invalidate(1); }
    /* back from behind a drawer: one frame. Dozing off only stops the blink, so it draws nothing */
    function setPause(p) {
      const was = paused();
      hushed = !!p.hushed;
      doze = !!p.doze;
      if (paused()) last = 0; else if (was) invalidate(1);
    }
    function disposeAll() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(crowdTimer);
      clearTimeout(blinkT);
      clearInterval(lifeTimer);
      for (const v of Array.from(visits.values())) { try { endVisit(v); } catch (e) { /* gone */ } }
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (offTheme) offTheme();
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPoke);
      canvas.removeEventListener('wheel', onPoke);
      canvas.removeEventListener('focus', onPoke);
      controls.dispose();
      /* the key light's shadow maps live on the shared renderer: they go with the scene, not with the renderer */
      try { key.dispose(); } catch (e) { /* gone */ }
      for (const m of meshes) m.geometry.dispose();
      if (crowd) crowd.geometry.dispose();
      if (dropMesh) dropMesh.geometry.dispose();
      for (const d of [cooBlob, kBlob, kPool]) if (d) d.geometry.dispose();
      try { if (cooRig && cooRig.dispose) cooRig.dispose(); } catch (e) { /* gone */ }
      try { if (kRig && kRig.dispose) kRig.dispose(); } catch (e) { /* gone */ }
      for (const w of walkins.values()) { try { w.rig.dispose(); } catch (e) { /* gone */ } w.blob.geometry.dispose(); }
      for (const k of Object.keys(mats)) mats[k].dispose();
      for (const k of Object.keys(tex)) if (tex[k]) tex[k].dispose();
      scene.background = null; scene.environment = null;
      Rr.onRestored = null;
    }
    function state() {
      const figures = {};
      for (const it of crowdItems) figures[it.uid] = {x: Math.round(it.x * 100), y: Math.round(it.y * 100), seated: true, state: it.state};
      for (const [u, w] of walkins) { const p = w.rig.root.position; figures[u] = {x: Math.round(p.x * 100), y: Math.round(p.z * 100), seated: performance.now() - w.t0 > (w.dur || 800), state: 'office'}; }
      for (const [u, v] of visits) { const p = v.rig.root.position; figures[u] = {x: Math.round(p.x * 100), y: Math.round(p.z * 100), seated: false, state: 'office', visit: v.phase, say: v.el ? v.el.textContent : ''}; }
      return {ready: st.ready, frames: st.frames, renders: st.renders, dpr: st.dpr, calls: st.calls, tris: st.tris, firstFrame: Math.round(st.firstFrame),
        figures, coo: {spot: view ? view.spot : '', state: view ? (view.walking ? 'walking' : view.state) : '', x: Math.round(coo.x * 100), y: Math.round(coo.z * 100)},
        kaavish: {mode: kav.mode, x: Math.round(kav.x * 100), y: Math.round(kav.z * 100), seq: K ? K.seq || 0 : 0, say: K && K.say ? K.say : null, live: kav.live},
        plan: data && data.L.plan ? data.L.plan.rev : 0, cam: camKind, paused: paused(), doze, moving, building, busy: (st.why || []).slice()};
    }
    return {start: safe(start), setData: safe(setData), setView: safe(setView), setKaavish: safe(setKaavish), setPause: safe(setPause), setCam: safe(setCam),
      invalidate: safe(invalidate), measure: safe(measure), overlay: safe(overlayUpdate), flight: safe(flight), beat: safe(beat), cooWalk, look: safe(look), api, state,
      dispose: disposeAll, get ready() { return st.ready; }, anchorOf: safe(anchorOf), poke: safe(poke),
      /* v37: start the next visit now (the checks and a curious founder) */
      life: safe(() => { nextVisit = 0; ambient(); })};
  }

  /* ---------- the stage in 3D: the director's walk, fly, fade and fx ---------- */
  function stage3d(api) {
    const {E, set, alive, still, flightDone, land, fxOn} = api;
    const en = () => (api.engine ? api.engine() : null);
    async function walk(from, to, carry) {
      const e = E.current, L = e.data.L, g = en();
      if (!g || !g.ready || !e.onScreen || document.visibilityState === 'hidden') { set({spot: to, walking: false, carry: '', pose: null}); return; }
      const pts = OF().path(L, from, to);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (len < 1) { set({spot: to}); return; }
      const dur = clamp(1400, 5000, len / 200 * 1000);
      set({walking: true, carry: carry || '', pose: null, state: 'default', speed: null});
      await g.cooWalk(pts, dur);
      if (!alive.current) return;
      set({spot: to, walking: false, carry: '', pose: null});
    }
    /* reduced motion never reaches 3D; a fade is a step to the new place */
    function fade(to) { set({spot: to}); return Promise.resolve(); }
    function fly(item, from, to) {
      const e = E.current;
      if (still() || e.lite || !from || !to || !en()) return Promise.resolve();
      const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return new Promise(res => { flightDone.current[id] = res; set(v => ({flights: v.flights.concat([{id, item, from, to}])})); setTimeout(() => { if (flightDone.current[id]) land(id); }, 1600); });
    }
    function fx(k, x) { fxOn(k, x); const g = en(); if (g && g.ready) g.beat(k, x); }
    return {walk, fly, fade, fx};
  }

  /* ---------- the scene ---------- */
  const HOUSE = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.4 8 3l5.5 4.4V13a.6.6 0 0 1-.6.6H9.6V10H6.4v3.6H3.1a.6.6 0 0 1-.6-.6Z"/></svg>`;
  const lower = s => String(s || '').toLowerCase();
  /* the state word on a name tag: the flat office's words, short */
  function tagWord(d, founder) {
    if (d.focus && (d.state === 'office' || d.state === 'wfh')) return 'focus';
    if (d.state === 'elsewhere') return lower(d.tag);
    if (d.state === 'leave') return 'away today';
    if (d.state === 'wfh') return 'WFH';
    if (d.state === 'out') return founder ? lower(d.tag) : 'out';
    if (d.state === 'closed') return '';
    if (d.state === 'notin') return d.hot ? 'not in yet' : '';
    if (d.quiet) return lower(d.quiet);
    return '';
  }
  /* v39: a tag's name. The first name, with the next word's initial where two people share it, and the
     whole name where even that matches */
  function tagNames(uids, nm) {
    const words = u => String(nm(u) || '').trim().split(/\s+/);
    const count = (key) => { const n = {}; for (const u of uids) { const k = key(u); n[k] = (n[k] || 0) + 1; } return n; };
    const first = u => words(u)[0] || '';
    const initial = u => { const w = words(u); return !w[1] ? w[0] || '' : /^\d/.test(w[1]) ? w[0] + ' ' + w[1] : w[0] + ' ' + w[1].charAt(0).toUpperCase() + '.'; };
    const byFirst = count(first), byInitial = count(initial);
    const out = {};
    for (const u of uids) out[u] = byFirst[first(u)] < 2 ? first(u) : byInitial[initial(u)] < 2 ? initial(u) : words(u).join(' ');
    return out;
  }
  const viewStyle = (mode, phone) => (mode === 'page' ? {aspectRatio: phone ? '3 / 4' : '16 / 10', maxHeight: phone ? '78vh' : '80vh'} : {aspectRatio: '16 / 9'});

  function Placeholder({mode, phone, scope}) {
    return html`<div class=${'office o3 o3-wait' + (mode === 'page' ? '' : ' window') + (phone ? ' on-phone' : '')} role="region" aria-label="The office" data-render="3d" data-office3d="pending"
      data-scope=${scope || undefined} data-mode=${mode}>
      <div class="office-view" style=${viewStyle(mode, phone)}>
        <div class="o3-wait-in"><div class="micro">the office</div><p class="sub small">Setting up the office.</p></div>
      </div>
    </div>`;
  }

  /* a throw while the scene renders (its own parts, or one it hosts) is caught here: flat for the session, and the
     page around it stays up */
  class Guard extends React.Component {
    constructor(p) { super(p); this.state = {bad: false}; }
    static getDerivedStateFromError() { return {bad: true}; }
    componentDidCatch(e) {
      try { console.warn('The 3D office stopped:', e && e.message ? e.message : e); } catch (x) { /* quiet */ }
      setFlag('error');
    }
    render() { return this.state.bad ? null : this.props.children; }
  }
  const Scene3D = props => html`<${Guard}><${SceneIn} ...${props}/><//>`;

  function SceneIn(props) {
    const {data, mode, phone, cam, drawers, onSay, onFrame, focusKey, onOpenStation} = props;
    const {ctx, L, D, scope, founder, day, rest} = data;
    const O = OF();
    const host = useRef(null), slot = useRef(null), layer = useRef(null), viewEl = useRef(null);
    const eng = useRef(null);
    const items = useRef(new Map()).current;
    const refs = useRef({}).current;
    const reg = k => refs[k] || (refs[k] = el => { if (el) items.set(k, el); else items.delete(k); });
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [api, setApi] = useState(null);
    const reduced = O.useReduced();
    const lite = O.useLite();
    const hushed = O.useHushed();
    const visible = O.useVisible();
    const dark = M.useResolvedTheme() === 'dark';
    const [onScreen, setOnScreen] = useState(true);
    const [doze, setDoze] = useState(false);
    const [listening, setListening] = useState(false);
    const [announce, setAnnounce] = useState('');
    const lastSaid = useRef(0), held = useRef(0);
    const poke = useRef(Date.now());
    const wake = useCallback(() => { poke.current = Date.now(); setDoze(false); if (eng.current) eng.current.invalidate(1); }, []);
    useEffect(() => {
      const t = setInterval(() => { if (Date.now() - poke.current > 2 * MIN) setDoze(true); }, 20000);
      return () => clearInterval(t);
    }, []);
    useEffect(() => { wake(); }, [data.rows.length, data.pub && data.pub.seq, data.pub && data.pub.at]);
    useEffect(() => {
      const S = M.assistant;
      if (!S || !S.subs) return undefined;
      const f = () => { const s = S.st || {}; setListening(['listening', 'hearing', 'thinking'].indexOf(s.phase) >= 0 || !!s.speaking); };
      f();
      S.subs.add(f);
      return () => { S.subs.delete(f); };
    }, []);
    /* the one polite region: the COO's acts at most once a minute, Kaavish's words at most once every 10 s */
    const sayLine = useCallback(b => {
      if (!b || !b.line || b.rest || (founder && M.prefs.get('office.mute', '0') === '1')) return;
      const now = Date.now();
      if (now - lastSaid.current < MIN) { held.current++; return; }
      lastSaid.current = now;
      const more = held.current;
      held.current = 0;
      setAnnounce('m360 COO: ' + b.line + (more ? ' And ' + more + ' more.' : ''));
    }, [founder]);

    const stageOf = useRef(a => stage3d(Object.assign(a, {engine: () => eng.current}))).current;
    const dir = O.useDirector({data, reduced, lite, onScreen: onScreen && visible, onSay: sayLine, onWake: wake}, stageOf);
    const {view} = dir;
    const bubble = view.bubble || (rest.bubble ? {...rest.bubble, fold: true, id: 'rest'} : null);
    useEffect(() => { if (onSay) onSay(bubble); }, [bubble && bubble.line, bubble && bubble.fold]);
    /* the drawers a tap or Kaavish's arrival opens: one handle for the scene's life, reading this render's drawers;
       the COO's opens on what it is saying now */
    const drawNow = useRef(null);
    drawNow.current = {drawers, bubble, station: onOpenStation || drawers.station};
    const dr = useRef({station: k => drawNow.current.station(k), desk: u => drawNow.current.drawers.desk(u),
      coo: b => drawNow.current.drawers.coo(b || drawNow.current.bubble)}).current;
    useEffect(() => { if (onFrame) onFrame(false); }, []);
    const K = O.useKaavish(ctx);
    const said = O.useSay(K.say);
    O.useSayAloud(said, setAnnounce);
    const drive = O.canDrive(ctx) && mode === 'page';
    const L3 = M.officeLive;
    const Arrange = L3 && L3.Arrange;
    if (L3 && L3.useController) L3.useController(api, data);

    /* the engine, made once; it never outlives the scene */
    const dataRef = useRef(data);
    dataRef.current = data;
    useEffect(() => {
      const h = host.current;
      const T = three;
      const Rr = T ? acquire(h, mode === 'page' ? 'page' : 'window') : null;
      if (!Rr) { setBusy(true); return undefined; }
      let e = null;
      try {
        e = makeEngine(T, Rr, {host: h, view: viewEl.current, slot: slot.current, layer: layer.current, kind: mode === 'page' ? 'page' : 'window', phone, cam, items, drawers: dr,
          onScreen: v => setOnScreen(v), onReady: () => { setReady(true); setApi(e.api); }});
        eng.current = e; cur = e;
        e.start(dataRef.current);
      } catch (err) {
        try { console.warn('The 3D office stopped:', err && err.message); } catch (x) { /* quiet */ }
        setFlag('error');
        release(h);
        return undefined;
      }
      /* not ready in 8 s (30 s when forced): flat for the session. A hidden tab builds slowly, so the wait holds
         until it is shown again */
      let slowT = 0;
      const slowly = () => { if (e.ready) return; if (document.visibilityState === 'hidden') { slowT = setTimeout(slowly, 2000); return; } setFlag('start'); };
      slowT = setTimeout(slowly, forced() ? 30000 : 8000);
      return () => { clearTimeout(slowT); e.dispose(); if (cur === e) cur = null; eng.current = null; release(h); };
    }, []);
    useEffect(() => { if (eng.current) eng.current.setData(data); });
    /* rest is made again on every render: the scene hears it when where or how the COO rests has changed */
    const restKey = [rest.station, rest.state, rest.asleep ? 1 : 0, rest.seat === false ? 0 : 1].join('|');
    useEffect(() => { if (eng.current) eng.current.setView(view, rest, listening); }, [view, restKey, listening]);
    useEffect(() => { if (eng.current) eng.current.setKaavish(K, {typing: !!(said && said.typing)}); }, [K, said && said.typing]);
    useEffect(() => { if (eng.current && ready) eng.current.setCam(cam); }, [cam, ready]);
    useEffect(() => { if (eng.current) eng.current.setPause({hushed, doze}); }, [hushed, doze, visible, onScreen]);
    useEffect(() => {
      if (!focusKey || !eng.current || !ready) return;
      const a = eng.current.anchorOf('st:' + focusKey);
      if (a) eng.current.look(a);
    }, [focusKey, ready]);
    /* after every render: the overlay's sizes and places */
    useLayoutEffect(() => { if (eng.current && eng.current.ready) { eng.current.measure(); eng.current.overlay(); } });
    /* the keyboard's stop in each pod: a hook, so it stays above the flat return below */
    const [rove, setRove] = useState({});
    /* the canvas's own words */
    useEffect(() => {
      const c = R.canvas;
      if (c && R.host === host.current) c.setAttribute('aria-label', drive && L3 && L3.walkTo ? 'The office floor. Use W A S D to walk.' : 'The office floor. Drag to look around.');
    }, [drive, ready]);

    if (busy) {
      /* another scene holds the renderer: this one is flat */
      return html`<${O.Scene} data=${data} mode=${mode} follow=${mode !== 'page' || cam === 'follow'} phone=${phone} whole=${mode === 'page' && cam !== 'follow'}
        onSay=${onSay} onFrame=${onFrame} onOpenStation=${dr.station} onOpenDesk=${dr.desk} onOpenCoo=${() => dr.coo()}/>`;
    }

    const open = (kind, k) => {
      wake();
      const target = kind === 'desk' ? 'desk:' + k : kind === 'station' ? k : 'coo';
      if (drive && L3 && L3.walkTo) { try { if (L3.walkTo(target)) return; } catch (e) { /* opens it here */ } }
      if (kind === 'station') dr.station(k);
      else if (kind === 'desk') dr.desk(k);
      else dr.coo();
      const e = eng.current;
      if (e && e.ready && mode === 'page') { const a = e.anchorOf(kind === 'station' ? 'st:' + k : kind === 'desk' ? 'desk:' + k : 'coo'); if (a) e.look(a); }
    };
    const names = data.profs;
    const nm = u => ((names[u] || {}).name) || 'Someone';
    const tags = tagNames(D.map(d => d.uid), nm);
    const first = u => tags[u] || String(nm(u)).split(' ')[0];
    const asked = (view.fx.asked && Date.now() - (Number(view.fx.asked.at) || 0) < 10 * MIN) ? view.fx.asked : null;
    const counts = {};
    data.rows.forEach(x => { const s = x.station || 'desk'; counts[s] = (counts[s] || 0) + 1; });
    const stationKeys = O.shownStations(ctx, scope);
    const late = founder ? !!(data.health && data.health.stale) : false;
    /* keyboard: the stations, then one stop a pod with the arrows inside it, then the COO, then the floor */
    const pods = {};
    D.forEach(d => { const k = d.cabin ? 'cabin' : d.pod; (pods[k] = pods[k] || []).push(d.uid); });
    const keyDesk = (d, ev) => {
      const k = d.cabin ? 'cabin' : d.pod, list = pods[k] || [], i = list.indexOf(d.uid);
      const n = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? i + 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? i - 1 : null;
      if (n === null) return;
      ev.preventDefault();
      const next = list[(n + list.length) % list.length];
      setRove(x => ({...x, [k]: next}));
      const el = host.current && host.current.querySelector('[data-uid="' + next + '"]:is(.office-desk, .office-founder)');
      if (el) el.focus();
    };
    const tabFor = d => { const k = d.cabin ? 'cabin' : d.pod; return (rove[k] || (pods[k] || [])[0]) === d.uid ? 0 : -1; };
    const walking = view.walking;
    const seated = !walking && view.spot === 'desk' && rest.seat !== false;
    const cst = walking ? 'default' : rest.asleep && view.spot === rest.station ? 'sleeping' : view.state === 'working' ? 'working' : (view.state === 'sleeping' ? 'sleeping' : 'default');
    const paused = !visible || !onScreen || hushed || doze;
    const roll = view.fx.roll;
    const kd = D.find(d => d.cabin);
    const kLive = !!K.live;
    const kPlace = kd ? (O.driving(K) ? 'floor' : kd.place) : 'cabin';

    return html`<div ref=${host} class=${'office o3' + (mode === 'page' ? '' : ' window') + (day.night ? ' is-night' : '') + (day.closed ? ' is-closed' : '') + (phone ? ' on-phone' : '') + (lite ? ' lite' : '') + (paused ? ' is-paused' : '')}
      data-scope=${scope} data-mode=${mode} data-night=${day.night ? '1' : '0'} data-lite=${lite ? '1' : '0'} data-paused=${paused ? '1' : '0'} data-render="3d" data-office3d=${ready ? 'ready' : 'pending'}
      role="region" aria-label="The office" onPointerEnter=${wake} onFocus=${wake}>
      <div class="office-view" ref=${viewEl} style=${viewStyle(mode, phone)}>
        <div class="office-overlay o3-layer" ref=${layer}>
          ${stationKeys.map(k => html`<button key=${'st' + k} ref=${reg('st:' + k)} type="button" class=${'office-station o3-item' + (k === 'clock' && late ? ' late' : '')} data-key=${k} data-ai="station"
            aria-label=${O.stationAria(data, k, counts)} onClick=${() => open('station', k)}><span class="o3-label">${O.labelOf(ctx, k)}</span>
            ${k === 'tray' && data.dec.length ? html`<span class="os-count"><span class="pill flame">${data.dec.length}</span></span>` : null}</button>`)}
          ${D.map((d, i) => {
            const word = tagWord(d, founder);
            const here = d.state === 'office' || d.state === 'wfh' || d.place === 'meeting' || d.place === 'lunch';
            if (d.cabin) {
              return html`<button key=${'k' + d.uid} ref=${reg('founder')} type="button" class="office-founder o3-item" data-uid=${d.uid} data-state=${d.state} data-place=${kPlace} data-live=${kLive ? '1' : '0'}
                tabIndex=${tabFor(d)} aria-label=${O.deskAria(O.onFloor(d, K), nm(d.uid))} title=${nm(d.uid)} onClick=${() => open('desk', d.uid)} onKeyDown=${ev => keyDesk(d, ev)}><b>${first(d.uid)}</b></button>`;
            }
            return html`<button key=${'d' + d.uid} ref=${reg('desk:' + d.uid)} type="button" class=${'office-desk o3-item' + (here ? '' : ' away') + (roll && d.state !== 'closed' ? ' lit' : '')}
              data-uid=${d.uid} data-state=${d.state} data-place=${d.place} data-ai="desk" tabIndex=${tabFor(d)} aria-label=${O.deskAria(d, nm(d.uid))} title=${nm(d.uid)}
              style=${{'--d': Math.min(i, 12) * 80 + 'ms'}} onClick=${() => open('desk', d.uid)} onKeyDown=${ev => keyDesk(d, ev)}>
              ${d.hot ? html`<i class="od-hot" aria-hidden="true"/>` : null}${d.state === 'wfh' ? html`<span class="o3-ic" aria-hidden="true">${HOUSE}</span>` : null}<b>${first(d.uid)}</b>
              ${asked && asked.uid === d.uid ? html`<span class="o3-st">asked ${O.istHm(asked.at)}</span>` : word ? html`<span class="o3-st">${word}</span>` : null}
              ${d.late ? html`<span class="od-late">Late</span>` : null}${d.newHire ? html`<span class="od-new">New</span>` : null}</button>`;
          })}
          <div ref=${reg('coo')} class="office-mascot o3-item" data-spot=${view.spot} data-state=${walking ? 'walking' : cst}>
            ${(rest.orb || (view.fx.orb && Date.now() - view.fx.orb.k < 2400)) && seated && M.fx && M.fx.Orb ? html`<span class="office-orb" aria-hidden="true"><${M.fx.Orb} state="composing" size=${20}/></span>` : null}
            ${(rest.dot || view.failed) && !walking ? html`<i class="office-flamedot" aria-hidden="true"/>` : null}
            <button type="button" class="office-mascot-hit" data-ai="coo" aria-label=${O.cooAria(ctx, bubble, rest, view.spot)} onClick=${() => open('coo')}/>
          </div>
          ${!phone ? html`<${O.Bubble} b=${bubble} founder=${founder} who="m360 coo" className="o3-b o3-item" bref=${reg('bubble')} onUndo=${id => O.undoRow(ctx, id)}/>` : bubble ? html`<i ref=${reg('dot:coo')} class="o3-dot o3-item" aria-hidden="true"/>` : null}
          ${!phone ? html`<${O.Say} s=${said} className="o3-b o3-item" sref=${reg('say')}/>` : said ? html`<i ref=${reg('dot:k')} class="o3-dot k o3-item" aria-hidden="true"/>` : null}
          ${view.flights.map(f => html`<${Flight3D} key=${f.id} f=${f} eng=${eng} onDone=${dir.land}/>`)}
        </div>
        <div class="o3-gl" ref=${slot}/>
        ${Arrange && drive && !phone && api ? html`<${Arrange} api=${api} data=${data}/>` : null}
      </div>
      ${phone ? html`<div class="office-under" data-dock-avoid="">${said ? html`<${O.Say} s=${{...said, fold: false}} className="big"/>` : null}${bubble ? html`<${O.Bubble} b=${{...bubble, fold: false}} founder=${founder} who="m360 coo" onUndo=${id => O.undoRow(ctx, id)} big=${true}/>` : null}</div>` : null}
      <div class="office-sr" aria-live="polite">${announce}</div>
    </div>`;
  }
  /* an item on its arc, moved by the engine; it lands where the flat office's lands */
  function Flight3D({f, eng, onDone}) {
    const ref = useRef(null);
    useLayoutEffect(() => {
      const e = eng.current;
      if (!e || !ref.current) { onDone(f.id); return undefined; }
      e.flight(ref.current, f, onDone);
      return undefined;
    }, []);
    const ITEM = OF().ITEM;
    return html`<div ref=${ref} class="o3-flight o3-item" aria-hidden="true"><span class=${'office-item ' + f.item}>${ITEM[f.item] || ITEM.card}</span></div>`;
  }

  /* ---------- state(): what is drawn, for checks and the buddy ---------- */
  function state() {
    const g = can();
    if (!cur) return {mode: lastMode === '3d' ? 'pending' : lastMode, why: g.why, ready: false, frames: 0, renders: 0, dpr: 0, calls: 0, tris: 0, figures: {}, coo: null, kaavish: null, plan: 0, cam: ''};
    return Object.assign({mode: '3d', why: g.why}, cur.state());
  }
  const apiNow = () => (cur ? cur.api : null);

  /* life(): the next visit now, for the checks */
  const life = () => (cur && cur.life ? cur.life() : undefined);
  M.office3d = Object.assign(M.office3d || {}, {can, useMode, load, acquire, release, tokens, Scene3D, Placeholder, stage3d, state, api: apiNow, setMode, retry, life, tagNames});
})();
