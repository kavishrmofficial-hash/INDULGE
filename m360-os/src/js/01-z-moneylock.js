/* module: money lock. On the owner's and the founders' screens every amount stays hidden ("₹ ••••") until a
   fingerprint says it is them: Touch ID on a Mac, the sensor or face on a phone, or the device's own screen
   lock where it has no sensor. It is a privacy screen for a room the team shares: the numbers are already
   theirs to see, and this keeps them off the screen until they ask.

   Shown, the amounts stay until 5 minutes pass without a touch, the tab is left for a minute, or Hide.
   The Books section shows one lock card in place of its pages while hidden.

     M.moneyLock.hidden()     true while amounts are masked for this viewer
     M.moneyLock.mask(str)    the same text with every amount masked while hidden (island, inbox, AI replies)
     M.moneyLock.unlock()     asks for the fingerprint; resolves true once shown
     M.moneyLock.hide()       masks again now
     M.moneyLock.setOn(bool)  the Me, Prefs switch (turning it off asks for the fingerprint first)
     M.moneyLock.use()        a hook: the component draws again when the lock opens or closes
     U.inrV(n)                U.inr for the screen: the amount, or the mask while hidden

   The fingerprint check is the browser's own (WebAuthn, user verification required). The key it makes is
   kept on this device only, so nothing about it reaches the server or the repo. */
(function () {
  const M = window.M, U = M.U, {html, React} = M;
  const DOTS = '••••';
  const MASK = '₹ ' + DOTS;
  const IDLE_MS = 5 * 60000, AWAY_MS = 60000;
  const subs = new Set();
  let viewer = false, open = false, lastTouch = 0, leftAt = 0, busy = false, fails = 0;

  /* test runs set M360_MONEY_LOCK_OFF so older tests read real figures; test_money_lock turns it on */
  const on = () => !window.M360_MONEY_LOCK_OFF && M.prefs.get('moneyLock', '1') !== '0';
  const active = () => viewer && on();
  const hidden = () => active() && !open;
  function paint() { try { document.documentElement.classList.toggle('money-hidden', hidden()); } catch (e) { /* no document */ } }
  function tell() { paint(); subs.forEach(f => { try { f(); } catch (e) { /* listener */ } }); }

  /* who is looking: the lock covers the people who see company money. Set during the shell's render, so the
     first frame is already masked; it only repaints the class, the shell's own render does the rest */
  function setViewer(ctx) {
    const v = !!(ctx && (ctx.isOwner || ctx.isFounder));
    if (v !== viewer) { viewer = v; paint(); }
  }

  /* any amount in a line of text: ₹, $, €, £, AED, SAR, USD, then the figure */
  const AMOUNT = /(?:₹|\$|€|£|\bAED|\bSAR|\bUSD|\bINR|\bRs\.?)\s?-?\d(?:[\d,]*\d)?(?:\.\d+)?(?:\s?(?:L|lakh|lakhs|Cr|crore|crores|k|K)\b)?/g;
  const mask = s => (hidden() && typeof s === 'string') ? s.replace(AMOUNT, MASK) : s;
  const inrV = n => hidden() ? MASK : U.inr(n);

  /* ---------- the fingerprint ---------- */
  const can = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
  const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(c => { s += String.fromCharCode(c); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let me = '';

  async function platform() {
    try { return !!(PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch (e) { return false; }
  }

  async function check() {
    const base = {challenge: rnd(32), timeout: 60000, userVerification: 'required'};
    const id = M.prefs.get('moneyLockKey', '');
    if (id) {
      await navigator.credentials.get({publicKey: Object.assign({}, base, {rpId: location.hostname, allowCredentials: [{type: 'public-key', id: unb64(id)}]})});
      return true;
    }
    /* the first time on this device: making the key asks for the fingerprint too, and counts as the check */
    const sel = {userVerification: 'required', residentKey: 'discouraged'};
    if (await platform()) sel.authenticatorAttachment = 'platform';
    const cred = await navigator.credentials.create({publicKey: Object.assign({}, base, {
      rp: {name: 'm360 OS', id: location.hostname},
      user: {id: rnd(16), name: me || 'm360', displayName: me || 'm360'},
      pubKeyCredParams: [{type: 'public-key', alg: -7}, {type: 'public-key', alg: -257}],
      authenticatorSelection: sel, attestation: 'none'})});
    if (!cred) return false;
    M.prefs.set('moneyLockKey', b64(cred.rawId));
    return true;
  }

  const say = (t, err) => { if (M.toast) M.toast(t, !!err); };
  async function unlock() {
    if (!hidden()) return true;
    if (busy) return false;
    if (!can()) { say('This browser cannot check a fingerprint. The money lock can be turned off in Me, Prefs', true); return false; }
    busy = true;
    try {
      const ok = await check();
      if (!ok) return false;
      fails = 0; open = true; lastTouch = Date.now(); tell();
      say('Money shown. It hides again after 5 minutes away');
      return true;
    } catch (e) {
      /* two misses in a row: the key may be gone from this device, so the next tap makes a new one */
      fails += 1;
      if (fails >= 2) M.prefs.set('moneyLockKey', '');
      say('Fingerprint not taken. Tap an amount to try again', true);
      return false;
    } finally { busy = false; }
  }
  function hide() { if (open) { open = false; tell(); } }
  async function setOn(v) {
    if (!v && hidden() && can()) { const ok = await unlock(); if (!ok) return false; }
    M.prefs.set('moneyLock', v ? '1' : '0');
    if (v) open = false;
    tell();
    return true;
  }

  /* ---------- it hides again on its own ---------- */
  const touch = () => { lastTouch = Date.now(); };
  try {
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(k => addEventListener(k, touch, {passive: true, capture: true}));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { leftAt = Date.now(); return; }
      if (open && leftAt && Date.now() - leftAt > AWAY_MS) hide();
      leftAt = 0;
    });
    setInterval(() => { if (open && Date.now() - lastTouch > IDLE_MS) hide(); }, 15000);
    /* a tap on a masked amount asks for the fingerprint, and does nothing else */
    addEventListener('click', e => {
      if (!hidden()) return;
      const t = e.target;
      const hit = t && t.closest && (t.closest('[data-money-unlock]') || (t.textContent && t.textContent.length < 160 && t.textContent.indexOf(DOTS) >= 0 ? t : null));
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      unlock();
    }, true);
  } catch (e) { /* no window */ }

  function use() {
    const [, bump] = React.useState(0);
    React.useEffect(() => { const f = () => bump(x => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
    return hidden();
  }

  M.moneyLock = {hidden, active, on, mask, unlock, hide, setOn, use, setViewer, can, DOTS, MASK,
    who(name) { me = String(name || ''); }};
  U.inrV = inrV;

  /* the Books section while hidden: one card in place of its pages */
  M.UI.MoneyGate = function MoneyGate() {
    const Lock = M.icons && M.icons.lock;
    return html`<div class="mlock-gate" id="money-gate">
      <${M.UI.PageHead} micro="private" title="The books are hidden"/>
      <p class="lede">Your fingerprint shows every number. They hide again after 5 minutes away.</p>
      <button type="button" class="btn" id="money-unlock" data-money-unlock="1">${Lock ? html`<${Lock} className="mlock-ic"/>` : null}Show with fingerprint</button>
    </div>`;
  };
})();
