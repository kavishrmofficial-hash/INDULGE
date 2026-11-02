/* module: chrome. The v7 interaction layer, framework free where it can be: the live mark (M.mark), the
   island (M.island: toasts, confirmations with UNDO, live news, voice states and the Ask bar's frame), the
   glass sidebar's motion (pill, tick, tooltips, the [ toggle remembered per browser), the phone tab bar's
   lens and fold, and glide, flash and showAt so an answer can take you to the thing and ring it in flame.
   Ported from design/chrome.js and wired to this app's routes (M.nav) and data (ctx). */
'use strict';
(function () {
  const {html, React, U} = M;
  const {useEffect, useRef, useMemo} = React;

  const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const $q = (s, r) => (r || document).querySelector(s);
  const $qa = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const pnow = () => (window.performance && performance.now) ? performance.now() : Date.now();
  const phone = () => window.innerWidth <= 900;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const BOOT = Date.now();
  const docEl = document.documentElement;
  docEl.classList.add('js');
  try { if (localStorage.getItem('m360.sb') === 'x') docEl.classList.add('sbx'); } catch (e) { /* private window */ }

  /* ---------- the live mark: the m360 logo split into a body and a dot. Black, moved only by transforms ---------- */
  const BODY = 'M1112 416.6C1103.1 414.6 1099.9 413.2 1092.7 408.7C1072.8 396.1 1058.1 373.5 1054 349.1C1051.7 335.5 1047.5 335.2 1038.9 347.9C1031.1 359.3 1008.6 381.2 996.5 389.3C981.6 399.1 967.8 405.3 951.7 409.5C939.9 412.5 936.3 413 926.5 413C916.8 413 913.2 412.5 901.8 409.6C886 405.5 866.8 398.2 858.5 393.2C845.7 385.5 837.1 375.9 833.6 365.3C830.6 356.3 825.9 317.8 825.3 297.5C825 285.8 824.3 278.2 823.7 277.8C821.5 276.4 817 280.2 810.6 289C798.3 305.8 775.8 327.5 752.9 344.5C719.8 369.2 672.1 391.4 632.5 400.5C601.9 407.5 593.9 408.5 563.5 408.5C533.1 408.5 532.1 408.2 522.5 398.6C503.9 379.8 502.6 359.1 519.2 347.7C526.3 342.8 532.7 341.6 547 342.3C555.3 342.7 561.8 343.8 570.5 346.1C587.9 350.8 595.2 350.6 609 345.2C627 338.2 652.1 325.7 673 313.2C686.9 305 717.4 284.2 729.5 274.8C749.5 259.2 768.1 239.5 773 228.8C775.7 222.9 775.5 220.3 772.1 216.9C769.5 214.3 768.5 214 763.2 214C755.9 214 745.7 215.9 730.8 220C720.3 222.9 712.1 225.3 681.5 234.4C663.8 239.7 643.8 243.9 633 244.6C617.4 245.7 605.1 241.4 596.7 232C590.5 225.1 588.6 219.2 589.2 208.1C589.8 194.9 590.6 193.7 622.9 158.3C642.4 136.9 657.9 118.4 658.6 115.4C659 114 658.7 112.3 657.9 111.4C656.4 109.6 657.8 109.6 628.6 111.9C615 113 602.9 111.9 596.3 109C590.3 106.4 583.4 99.6 581.4 94.4C577.9 85.3 580.8 73.6 588.8 64.8C604.7 47 683.4 12 716.5 7.9C727.2 6.5 742.7 7.3 749 9.5C759.6 13.1 769.9 24.5 772.1 34.8C772.8 38.2 773 44 772.7 49C771.5 66.6 758.9 94.3 739.2 122.5C728.5 137.7 727 140.2 727 142.6C727 146.6 730.4 147.7 744.5 148.4C786.1 150.4 816.9 165 830.5 189.4C835.6 198.5 837 203.3 838 214.9C839 226.2 840.5 229.4 843.8 227.4C845.5 226.4 847.4 223.4 863 197.8C872.8 181.6 892.2 152.8 904.5 136C932.4 97.8 953 75.5 973.8 60.8C995.1 45.8 1016.4 49.5 1027.2 70.1C1029.3 74 1029.5 75.9 1029.5 87.5C1029.5 98.3 1029.2 101.2 1027.6 104.5C1026.4 106.9 1019.3 114.6 1009.6 123.9C951.8 179.4 922.6 214 907.9 244.4C903.4 253.6 903.2 255 906 257.5C908 259.3 908.3 259.3 919.8 254.5C956.8 239.3 979.1 233.8 1004 233.8C1016.3 233.8 1019.6 234.1 1025.5 236C1035 239 1039 241.2 1045 246.5C1052.3 252.9 1054.6 254.3 1057.4 253.6C1060 253 1060 253 1066 234C1083.6 178.5 1112.8 124.5 1149.3 80C1159.9 67.1 1183.2 44.4 1194.7 35.8C1214.3 21.1 1234.6 10.9 1252 6.9C1256.7 5.8 1266.2 4.7 1273.5 4.4C1290.6 3.6 1303 6 1316.2 12.6C1342.3 25.4 1355.1 41.7 1360.6 69C1363 80.4 1363.2 83 1362.7 98.5C1362.1 118.8 1359 137.6 1352.8 158.5C1326.9 245.8 1258.4 348.1 1196.5 391.9C1180.7 403.1 1163.9 411.6 1150.5 415.2C1141.5 417.7 1119.9 418.5 1112 416.6ZM397.9 413.6C392.9 411.9 389.5 409.2 382.8 402.3C376 395.1 369.9 385.9 366.8 378.1C364.9 373.3 364.6 370.5 364.6 358.5C364.5 333.6 368.4 322.5 403.2 250.8C410.3 236.1 413 229.5 412.5 228.1C411.1 223.7 407.1 225.7 390.2 239.2C350 271.3 281.1 332.2 236.5 375.1C226.6 384.7 219.7 390.4 216.5 391.9C199.6 399.9 179.6 391.1 174 373.3C167.8 353.4 172.4 316 187.5 264.7C191.2 251.8 191.7 248.1 189.8 246.2C187.8 244.2 186.2 244.8 181.4 249.2C174.3 255.8 160.3 273.6 133.5 310.5C97 360.5 91.7 367.3 79 380.1C61.3 397.9 52.9 402.4 37.5 402.5C26.6 402.5 21.7 400.6 13.9 393.3C6.1 386 4.5 382.3 4.5 371.5L4.5 362.5L16.9 337C43.2 282.5 91.8 187.6 101.5 171.5C118.9 142.9 125.6 133.8 132.2 130.4C136.4 128.1 151.7 127.3 158 129C163.7 130.5 171.3 137.9 173 143.5C173.6 145.7 174.4 152.7 174.7 159C175 165.3 175.7 171.1 176.2 171.8C178.2 174.2 181.1 172.9 190.7 165.2C213.5 146.9 230.6 136.1 241.8 133.1C251.2 130.6 253.1 130.5 259.8 132.5C265.5 134.2 270.8 138.3 274 143.5C278.8 151.3 278.6 169 273.6 192.1C269.4 211.2 263 244.9 263 248C263 251.3 265.3 254 268 254C269 254 272.3 252.1 275.3 249.8C278.4 247.4 285.3 242.1 290.7 238C296.1 233.9 309.3 223.7 320 215.4C330.7 207.2 346.7 195 355.5 188.4C393.8 159.6 448.2 123.1 459.3 118.7C465.5 116.3 481 115.8 487.7 117.8C498.6 121.1 508.5 131.5 512.4 144C515.6 153.9 515.7 161.8 513 172.6C510.8 181.2 507.1 188.8 489.8 220.5C447.6 297.4 432.4 339.3 429.5 386C429.1 391.8 428.4 398.2 427.9 400.3C426.7 404.9 420.7 411.8 416.3 413.7C412.3 415.3 402.7 415.3 397.9 413.6ZM1132.1 359.8C1140.7 356.9 1157.6 342.9 1171 327.5C1203.7 290 1238.5 234.2 1267.2 173.6C1289.4 126.5 1296.9 101.4 1294 83.8C1291.9 70.2 1286.8 68.9 1271.3 77.8C1227.2 103.1 1161.1 187.3 1131.2 256.5C1120.1 282.2 1114.1 305.4 1113.3 325.6C1112.9 336.1 1113.1 339.8 1114.5 344.6C1116.9 352.9 1120 358.1 1123.5 359.6C1127.2 361.3 1127.9 361.3 1132.1 359.8ZM933.3 346C946.5 341.8 958.2 334.5 970.7 322.5C981.6 312.2 984.6 307.9 982.9 304.8C981.4 302 976.7 302.6 967.6 306.6C947.9 315.2 931.9 324.1 921 332.5C912.7 338.9 911.2 344.9 917.3 347.5C921.8 349.5 922.8 349.4 933.3 346Z';
  const DOT = 'M1378.5 414.8C1367.5 410.7 1356.6 397.7 1352.6 384.1C1347.9 367.9 1354 347.7 1367.9 334C1376 326 1384.2 321.5 1393.5 320C1416 316.3 1433.5 327.1 1441.6 349.6C1449.7 371.8 1435.9 399 1410.2 411.7C1403.4 415.1 1402.2 415.4 1392.2 415.7C1385.9 415.8 1380.3 415.5 1378.5 414.8Z';
  const LIVE = '<span class="l-st"><span class="l-react"><svg class="lmk" viewBox="0 0 1448 422" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' +
    '<g class="l-pose"><g class="l-breathe"><path d="' + BODY + '"/><g class="l-eye"><path class="l-dot" d="' + DOT + '"/></g></g></g></svg></span></span>';

  const MK = (function () {
    let roots = [], bound = false, running = false, last = 0, lastIn = pnow(), lastMove = pnow();
    let sleeping = false, concern = false, baseLean = 0, holdT = 0, hold = false, lookT = 0, moodN = -1;
    const stateCls = {};
    const v = {lean: 0, sq: 0, ex: 0, ey: 0}, vel = {lean: 0, sq: 0, ex: 0, ey: 0}, tg = {lean: 0, sq: 0, ex: 0, ey: 0};
    function scan() {
      roots = $qa('.lm').filter(el => $q('.l-react', el)).map(el => ({el, st: $q('.l-st', el), react: $q('.l-react', el), pose: $q('.l-pose', el), eye: $q('.l-eye', el), dot: $q('.l-dot', el)}));
      roots.forEach(o => {
        Object.keys(stateCls).forEach(c => { if (o.st) o.st.classList.toggle(c, !!stateCls[c]); });
        const host = o.el.parentNode;
        if (host && !host.__mk) { host.__mk = 1; host.addEventListener('pointerenter', () => { if (!sleeping) react('wig', 780); }); }
      });
      apply();
    }
    function vis() { for (const o of roots) { if (o.el.isConnected && o.el.getClientRects().length) return o; } return null; }
    function apply() {
      const p = 'rotate(' + v.lean.toFixed(3) + 'deg) scale(' + (1 - v.sq / 220).toFixed(4) + ',' + (1 + v.sq / 100).toFixed(4) + ')';
      const e = 'translate(' + v.ex.toFixed(2) + 'px,' + v.ey.toFixed(2) + 'px)';
      roots.forEach(o => { if (o.pose) o.pose.style.transform = p; if (o.eye) o.eye.style.transform = e; });
    }
    function step(t) {
      const dt = Math.min(0.034, Math.max(0.001, (t - last) / 1000)); last = t; let moving = false;
      for (const k in v) { const a = 170 * (tg[k] - v[k]) - 17 * vel[k]; vel[k] += a * dt; v[k] += vel[k] * dt; if (Math.abs(vel[k]) > 0.02 || Math.abs(tg[k] - v[k]) > 0.02) moving = true; }
      apply(); if (moving) requestAnimationFrame(step); else running = false;
    }
    function kick() { if (!running && !RM()) { running = true; last = pnow(); requestAnimationFrame(step); } }
    function set(o) { for (const k in o) tg[k] = o[k]; kick(); }
    function react(name, ms) {
      if (RM()) return;
      roots.forEach(o => { const r = o.react; if (!r) return; r.className = 'l-react'; r.getBoundingClientRect(); r.className = 'l-react r-' + name; clearTimeout(o.rt); o.rt = setTimeout(() => { r.className = 'l-react'; }, ms || 900); });
    }
    function state(c, on) { stateCls[c] = on; roots.forEach(o => { if (o.st) o.st.classList.toggle(c, on); }); }
    function blinkOnce() {
      roots.forEach(o => { if (!o.dot) return; o.dot.classList.remove('blink'); o.dot.getBoundingClientRect(); o.dot.classList.add('blink'); });
      setTimeout(() => roots.forEach(o => { if (o.dot) o.dot.classList.remove('blink'); }), 230);
    }
    function blink() { if (!sleeping && !document.hidden) { blinkOnce(); if (Math.random() < 0.25) setTimeout(blinkOnce, 330); } setTimeout(blink, 2400 + Math.random() * 3600); }
    function sleepNow() { if (sleeping) return; sleeping = true; state('s-sleep', true); set({ex: -10, ey: 24, lean: -4, sq: 0}); }
    function wake() { lastIn = pnow(); if (sleeping && new Date().getHours() >= 5) { sleeping = false; state('s-sleep', false); react('pop', 520); set({ex: 0, ey: 0, lean: baseLean}); } }
    function glance() {
      if (!sleeping && !concern && !hold && pnow() - lastMove > 3500 && !document.hidden) {
        const a = Math.random() * Math.PI * 2, f = 0.45 + Math.random() * 0.55;
        set({ex: Math.cos(a) * 50 * f, ey: Math.sin(a) * 32 * f});
        setTimeout(() => { if (pnow() - lastMove > 3500 && !hold) set({ex: 0, ey: 0}); }, 650 + Math.random() * 700);
      }
      setTimeout(glance, 2300 + Math.random() * 2400);
    }
    function bind() {
      if (bound) return; bound = true;
      addEventListener('pointermove', e => {
        lastMove = pnow(); wake(); if (hold) return;
        const o = vis(); if (!o) return; const r = o.el.getBoundingClientRect(); if (!r.width) return;
        const dx = e.clientX - (r.left + r.width * 0.6), dy = e.clientY - (r.top + r.height * 0.5), d = Math.hypot(dx, dy) || 1, f = Math.min(1, d / 240);
        baseLean = clampN(dx / 900, -1, 1) * 2.6;
        set({ex: dx / d * f * 54, ey: dy / d * f * 36, lean: concern ? baseLean - 3.5 : baseLean});
      }, {passive: true});
      ['keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(n => addEventListener(n, wake, {passive: true}));
      setInterval(() => { if (!sleeping && pnow() - lastIn > 45000) sleepNow(); }, 1000);
      let sy = window.scrollY, st = pnow(), sT = 0;
      addEventListener('scroll', () => {
        const t = pnow(), y = window.scrollY, dt = Math.max(8, t - st), sp = (y - sy) / dt; sy = y; st = t; wake();
        set({sq: Math.min(14, Math.abs(sp) * 6), lean: clampN(sp * 3.2, -6, 6)});
        clearTimeout(sT); sT = setTimeout(() => set({sq: 0, lean: baseLean}), 110);
      }, {passive: true});
      /* anything flagged hot (an overdue card, a late row) makes it lean in, worried */
      document.addEventListener('pointerover', e => {
        const h = e.target.closest && e.target.closest('.hotz, .card.due, .is-hot');
        if (h && !concern) { concern = true; state('s-concern', true); set({lean: baseLean - 3.5}); }
        else if (!h && concern) { concern = false; state('s-concern', false); set({lean: baseLean}); }
      });
      setTimeout(blink, 1800); setTimeout(glance, 3000);
      /* a morning visit stretches, before five it is asleep */
      const hr = new Date().getHours();
      setTimeout(() => { if (hr < 5) sleepNow(); else if (hr < 12) react('stretch', 1600); else react('nod', 680); }, 900);
    }
    return {
      scan() { scan(); bind(); },
      happy() { react('hop', 820); state('s-happy', true); clearTimeout(holdT); holdT = setTimeout(() => state('s-happy', false), 1100); },
      nod() { react('nod', 680); }, pop() { react('pop', 520); }, spin() { react('spin', 1080); }, stretch() { react('stretch', 1600); },
      ahem() { if (!sleeping) react('ahem', 780); },
      think(on) { state('s-think', !!on); },
      lookAt(el, ms) {
        if (!el || RM()) return; const o = vis(); if (!o) return;
        const r = o.el.getBoundingClientRect(), t = el.getBoundingClientRect();
        const dx = t.left + t.width / 2 - (r.left + r.width * 0.6), dy = t.top + t.height / 2 - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
        hold = true; set({ex: dx / d * 56, ey: dy / d * 38}); clearTimeout(lookT); lookT = setTimeout(() => { hold = false; }, ms || 1800);
      },
      mood(n) { if (n === moodN) return; moodN = n; state('s-alert', n >= 4); state('s-calm', n === 0); },
      listen(on) { state('s-listen', !!on); set(on ? {lean: 3, ex: 30, ey: -26} : {lean: baseLean, ex: 0, ey: 0}); },
      sleeping: () => sleeping
    };
  })();

  /* the mark as a part: render it, then it joins the character. Its markup is the constant above. With onGo
     it is the design's link (a.lm, href #top): a tap spins it and glides to the top */
  function LiveMark({className, id, label, onGo}) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current && !ref.current.firstChild) ref.current.innerHTML = LIVE; MK.scan(); }, []);
    if (onGo) return html`<a class=${'lm' + (className ? ' ' + className : '')} id=${id} href="#top" aria-label=${label || 'm360 OS home'} ref=${ref}
      onClick=${e => { e.preventDefault(); onGo(); }}></a>`;
    return html`<span class=${'lm' + (className ? ' ' + className : '')} ref=${ref} aria-hidden="true"></span>`;
  }

  /* ---------- the design's own icon set (design/chrome.js IR and design/m360-os-v7.html), 24px, stroke 1.7 ---------- */
  const IR = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    feed: '<path d="M4 5.5h16v10H9l-5 3.5z"/>',
    tasks: '<rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="16.5" y="4" width="4" height="7" rx="1.6"/>',
    projects: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
    pitches: '<path d="M3.5 17.5l5.5-6 4 4 7.5-9"/><path d="M15.5 6.5h5v5"/>',
    week: '<rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    handbook: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>',
    clients: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.4"/><path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7M3.5 12.5h17"/>',
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.5" r="2.4"/><path d="M16 14.2a4.8 4.8 0 0 1 5 5.3"/>',
    leave: '<path d="M4 19.5h16M6.5 19.5c0-5 2.5-9.5 5.5-12.5 3 3 5.5 7.5 5.5 12.5"/><path d="M12 7v12.5"/>',
    desk: '<path d="M3.5 9.5h17v10h-17z"/><path d="M7.5 9.5V6.5a4.5 4.5 0 0 1 9 0v3"/>',
    command: '<rect x="3.5" y="4" width="17" height="12" rx="2.2"/><path d="M8 20h8M12 16v4M7 12l2.5-3 2.5 2 3-4"/>',
    scores: '<path d="M7 20.5h10M12 16.5v4"/><path d="M6.5 3.5h11v5.5a5.5 5.5 0 0 1-11 0z"/><path d="M6.5 6H3.5a2.5 2.5 0 0 0 2.5 4M17.5 6h3a2.5 2.5 0 0 1-2.5 4"/>',
    hiring: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M17 4.5l1 1 2-2"/>',
    voice: '<path d="M4 6.5h16v9H10l-4 3.5v-3.5H4z"/><path d="M8 11h8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
    cmdkey: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><path d="M9.5 4.5v15"/>',
    chev: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const SVG = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  /* the paths are this file's constants, set on the svg once it is drawn (never user text) */
  const DI = d => function Icon() {
    const r = useRef(null);
    React.useLayoutEffect(() => { if (r.current && r.current.innerHTML !== d) r.current.innerHTML = d; }, []);
    return html`<svg ref=${r} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>`;
  };
  const DICONS = {};
  Object.keys(IR).forEach(k => { DICONS[k] = DI(IR[k]); });
  /* an app icon name in the design's set where the design has one; anything else keeps the app's own */
  const ICON_OF = {today: 'today', home: 'today', feed: 'feed', tasks: 'tasks', review: 'tasks', projects: 'projects', pitches: 'pitches', week: 'week', cal: 'week', calendar: 'week',
    handbook: 'handbook', clients: 'clients', people: 'people', leave: 'leave', desk: 'desk', command: 'command', scores: 'scores', trophy: 'scores', hiring: 'hiring', voice: 'voice', search: 'search', x: 'x', chevD: 'chev'};
  const iconFor = name => (ICON_OF[name] && DICONS[ICON_OF[name]]) || (M.icons && M.icons[name]) || null;

  /* ---------- glide, flash, showAt: an answer takes you there and rings the thing in flame ---------- */
  function glide(y, done) {
    const from = window.scrollY, to = clampN(y, 0, Math.max(0, docEl.scrollHeight - window.innerHeight)), d = clampN(Math.abs(to - from) * 0.45, 520, 1100);
    let t0 = 0;
    if (RM() || Math.abs(to - from) < 2) { window.scrollTo(0, to); if (done) done(); return; }
    const ez = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const f = ts => { if (!t0) t0 = ts; const p = Math.min(1, (ts - t0) / d); window.scrollTo(0, from + (to - from) * ez(p)); if (p < 1) requestAnimationFrame(f); else if (done) done(); };
    requestAnimationFrame(f);
  }
  function glideTo(el, done) { const off = phone() ? 96 : 32; glide(el.getBoundingClientRect().top + window.scrollY - off, done); }
  function flash(els) {
    (els || []).forEach(el => {
      if (!el) return; el.classList.remove('flash', 'flash-out'); el.getBoundingClientRect(); el.classList.add('flash');
      setTimeout(() => el.classList.add('flash-out'), 1600); setTimeout(() => el.classList.remove('flash', 'flash-out'), 2000);
    });
  }
  /* go to a hash (when it is not the one open), wait for the selector, glide to it, ring it, look at it */
  function showAt(hash, sel, opts) {
    const o = opts || {};
    const here = (location.hash || '') === hash;
    if (hash && !here) M.nav(hash);
    let tries = 0;
    const look = () => {
      const els = sel ? $qa(sel).filter(e => e.getClientRects().length) : [];
      if (!els.length) { if (tries++ < 16) return setTimeout(look, 110); return; }
      glideTo(els[0], () => { flash(els.slice(0, o.max || 6)); MK.lookAt(els[0], 2200); });
    };
    if (sel) setTimeout(look, here ? 80 : 300);
  }

  /* ---------- the island ---------- */
  const ISL = (function () {
    let isl = null, isIn = null, slotEl = null, meas = null, its = [], mode = '', onTap = null, acts = {};
    const queue = [], tq = [];
    let shownAt = 0, kind = '', cmdFn = null, curKey = '';
    /* the keys of news showing or waiting: the same thing is told once */
    const newsKeys = new Set();
    const subs = new Set();
    function el() {
      if (isl) return;
      isl = document.createElement('div'); isl.id = 'island'; isl.setAttribute('role', 'status'); isl.setAttribute('aria-live', 'polite');
      isl.innerHTML = '<div class="is-in"></div><div class="is-cmd" id="isl-cmd"></div>';
      document.body.appendChild(isl);
      isIn = $q('.is-in', isl); slotEl = $q('.is-cmd', isl);
      meas = document.createElement('div'); meas.className = 'is-meas'; meas.setAttribute('aria-hidden', 'true'); document.body.appendChild(meas);
      isl.addEventListener('click', e => {
        if (mode === 'cmd') return;
        const b = e.target.closest('[data-act]');
        if (b) { e.stopPropagation(); const f = acts[b.getAttribute('data-act')]; close(); if (f) f(); return; }
        const t = onTap; if (!t) return; close(); t();
      });
    }
    function cx() {
      if (phone()) return window.innerWidth / 2;
      const s = $q('#side'); const r = s && s.getClientRects().length ? s.getBoundingClientRect() : null;
      return ((r ? r.right : 0) + 12 + window.innerWidth - 12) / 2;
    }
    const topY = () => (phone() ? 8 : 12);
    function put(l, t, w, h, rad) { isl.style.left = l + 'px'; isl.style.top = t + 'px'; isl.style.width = w + 'px'; isl.style.height = h + 'px'; isl.style.borderRadius = rad + 'px'; }
    function shape(w, h, r) { put(cx() - w / 2, topY(), w, h, r); }
    const pill = () => shape(120, 36, 18);
    function clr() { its.forEach(clearTimeout); its = []; }
    function later(fn, ms) { its.push(setTimeout(fn, ms)); }
    const isOpen = () => !!isl && isl.classList.contains('open') && !isl.classList.contains('closing');
    const busy = () => !!isl && isl.classList.contains('show');
    const W = n => (phone() ? window.innerWidth - 16 : (n || 440));
    const emit = () => subs.forEach(f => { try { f(mode); } catch (e) { /* listener */ } });
    /* how tall a line of copy runs in the island, measured off screen at the width it will have */
    function heightFor(text, w) {
      if (!meas) return 72;
      meas.style.width = Math.max(120, w - 104) + 'px'; meas.textContent = text;
      return clampN(meas.offsetHeight + 40, 72, 200);
    }
    function swapI(h, cls, cb) {
      isIn.classList.add('fade');
      later(() => { isIn.innerHTML = h; isIn.className = 'is-in' + (cls ? ' ' + cls : ''); if (cb) cb(); }, 200);
    }
    function open(h, opt) {
      el(); const o = opt || {}; const w = o.w || W(), hh = o.h || 72, r = o.r || 36;
      kind = o.kind || ''; shownAt = Date.now();
      if (curKey && curKey !== (o.key || '')) newsKeys.delete(curKey);
      curKey = o.key || ''; isl.setAttribute('data-key', curKey);
      docEl.classList.add('isl-on');
      if (isOpen() && mode !== 'cmd') { clr(); swapI(h, o.cls, o.cb); shape(w, hh, r); return; }
      if (mode === 'cmd') { isl.classList.remove('cmd'); mode = ''; if (cmdFn) cmdFn(false); emit(); }
      clr(); isl.classList.remove('closing', 'open', 'cmd'); isl.style.transition = 'none';
      if (o.from) { const f = o.from; put(f.left, f.top, f.width, f.height, f.height / 2); } else pill();
      isl.getBoundingClientRect(); isl.style.transition = '';
      isIn.className = 'is-in' + (o.cls ? ' ' + o.cls : ''); isIn.innerHTML = h; isl.classList.add('show'); if (o.cb) o.cb();
      requestAnimationFrame(() => requestAnimationFrame(() => { const sz = o.size ? o.size() : null; if (sz) shape(sz[0], sz[1], sz[2]); else shape(w, hh, r); isl.classList.add('open'); }));
    }
    function close(quiet) {
      clr(); if (!busy()) return;
      const wasCmd = mode === 'cmd';
      isl.classList.remove('open'); isl.classList.add('closing'); pill(); mode = ''; onTap = null; acts = {}; kind = '';
      if (curKey) { newsKeys.delete(curKey); curKey = ''; isl.setAttribute('data-key', ''); }
      if (wasCmd) { const a = document.activeElement; if (a && a.blur && isl.contains(a)) a.blur(); if (cmdFn && !quiet) cmdFn(false); emit(); }
      later(() => {
        isl.classList.remove('show', 'closing', 'cmd'); isIn.innerHTML = ''; isIn.className = 'is-in'; docEl.classList.remove('isl-on');
        if (tq.length) { const t = tq.shift(); setTimeout(t, 120); } else if (queue.length && !sheetOpen()) { const q = queue.shift(); setTimeout(() => { if (busy()) queue.unshift(q); else q(); }, 350); }
      }, 460);
      MK.think(false);
    }
    const sheetOpen = () => docEl.classList.contains('gs-open') || docEl.classList.contains('mn-open') || !!document.querySelector('.drawer');
    /* queued news waits for an open sheet to close, then comes in */
    const flush = () => { if (queue.length && !busy() && !sheetOpen()) { const q = queue.shift(); q(); } };
    const waiting = () => queue.map(q => q.key).filter(Boolean);
    setInterval(flush, 900);
    /* a glass sheet opening: the mark looks at it; closing lets the news through */
    addEventListener('m360:sheet', e => {
      const d = (e && e.detail) || {};
      if (d.open && d.el && d.el.getBoundingClientRect) setTimeout(() => MK.lookAt(d.el, 1400), 120);
      else if (!d.open) setTimeout(flush, 420);
    });
    const ML = s => (M.moneyLock ? M.moneyLock.mask(s) : s);   /* amounts stay masked in the island while hidden */
    const TX = (b, e, wrap) => '<span class="is-t' + (wrap ? ' wrap' : '') + '"><b>' + esc(ML(b)) + '</b>' + (e ? '<em>' + esc(ML(e)) + '</em>' : '') + '</span>';
    const EV = '<span class="is-ev"></span>';
    const CK = '<span class="is-ck"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>';
    const BAD = '<span class="is-ck bad"><svg viewBox="0 0 24 24"><path d="M12 6.5v7M12 17v.5"/></svg></span>';
    /* a toast: a white check, or the flame mark when something needs a look. It keeps the toast class so
       anything that waits for a toast by its words still finds it */
    function toast(msg, bad) {
      el();
      const text = String(msg == null ? '' : msg);
      const run = () => {
        acts = {}; onTap = null;
        const long = text.length > 46 || text.indexOf('\n') >= 0;
        const w = W(long ? 480 : 440), hh = long ? heightFor(text, w) : 72;
        open((bad ? BAD : CK) + TX(text, bad ? 'check this' : 'done', long), {w, h: hh, r: hh > 80 ? 28 : 36, cls: 'toast' + (bad ? ' err' : '') + (text.indexOf('\n') >= 0 ? ' multi' : ''), kind: 'toast'});
        later(close, text.indexOf('\n') >= 0 ? 7000 : (bad ? 4200 : 2800));
        if (bad) MK.ahem(); else MK.happy();
      };
      /* a toast that only just arrived keeps its moment; the next one follows it */
      if (busy() && mode === 'cmd') { tq.push(run); return; }
      if (busy() && kind === 'toast' && Date.now() - shownAt < 1100) { tq.push(run); return; }
      run();
    }
    /* a confirmation that can be taken back: UNDO runs undoFn */
    function confirmIsl(msg, cap, undo) {
      el();
      const run = () => {
        acts = {}; onTap = null;
        open(CK + TX(String(msg), cap || 'done') + (undo ? '<button class="ib" type="button" data-act="undo">UNDO</button>' : ''), {w: W(480), cls: 'toast', kind: 'toast'});
        if (undo) acts.undo = () => { try { undo(); } catch (e) { /* the undo itself toasts */ } };
        later(close, 5200); MK.happy();
      };
      if (busy() && mode === 'cmd') { tq.push(run); return; }
      run();
    }
    /* live news: queued behind whatever the island is saying and behind an open sheet. A tap goes to it.
       opt: {key (told once while it shows or waits), ms (how long it stays)} */
    function notify(text, cap, tap, look, opt) {
      el();
      const o = opt || {}, key = o.key ? String(o.key) : '';
      if (key && newsKeys.has(key)) return;
      if (key) newsKeys.add(key);
      const run = () => {
        acts = {}; open(EV + TX(text, cap), {kind: 'news', cls: 'news', key}); onTap = tap || null; later(close, o.ms || 3200); MK.pop();
        if (look) setTimeout(() => MK.lookAt(look, 1800), 200);
      };
      run.key = key;
      if (busy() || sheetOpen()) queue.push(run); else run();
    }
    /* news taken back before it is told, or closed while it shows */
    function drop(key) {
      if (!key) return;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].key === key) queue.splice(i, 1);
      newsKeys.delete(key);
      if (curKey === key && busy() && kind === 'news') close();
    }
    /* voice: 'listening' | 'heard' | 'thinking' | 'answer'. SHOW runs onShow */
    const WV = calm => '<span class="is-wave' + (calm ? ' calm' : '') + '"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i></span>';
    function voice(stage, text, cap, onShow) {
      acts = {}; onTap = null; clr();
      if (stage === 'listening') { open(WV() + TX('Listening', 'ask m360') + '<i class="is-mic"></i>', {kind: 'voice', cls: 'voice'}); onTap = () => { if (M.mic) M.mic.stop(); }; MK.listen(true); return; }
      if (stage === 'heard') { open(WV() + TX('“' + text + '”', 'you') + '<i class="is-mic"></i>', {kind: 'voice', cls: 'voice'}); return; }
      if (stage === 'thinking') { MK.listen(false); MK.think(true); open(WV(1) + TX('Thinking', 'm360'), {kind: 'voice', cls: 'voice'}); return; }
      MK.listen(false); MK.think(false); MK.nod();
      open(WV(1) + TX(text, cap || '') + (onShow ? '<button class="ib" type="button" data-act="show">SHOW</button>' : ''), {w: W(520), kind: 'voice', cls: 'voice'});
      if (onShow) acts.show = onShow;
      later(close, 8200);
    }
    /* the Ask bar frame: the island grows into a 600px bar out of the field you clicked. The bar's content is
       the palette, drawn by the shell into slot() */
    function cmdDims() {
      const list = slotEl && $q('.cbl', slotEl);
      const lh = list ? list.scrollHeight : 56, cap = phone() ? Math.round(window.innerHeight * 0.56) : 392;
      return [W(600), 64 + Math.min(lh, cap), 28];
    }
    function fit() { if (mode === 'cmd' && isOpen()) { const d = cmdDims(); shape(d[0], d[1], d[2]); } }
    function cmd(q, from) {
      el();
      if (mode === 'cmd') { const i = $q('input', slotEl); if (i) i.focus(); return; }
      clr();
      const r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : (from && from.width ? from : null);
      const startIt = () => { isl.classList.add('cmd'); mode = 'cmd'; kind = 'cmd'; emit(); if (cmdFn) cmdFn(true, q || ''); MK.lookAt(isl, 1400); };
      if (isOpen()) { isl.classList.add('cmd'); isIn.innerHTML = ''; startIt(); const d = cmdDims(); shape(d[0], Math.max(d[1], 120), d[2]); return; }
      open('', {from: r && r.width ? {left: r.left, top: r.top, width: r.width, height: r.height} : null, w: W(600), h: 120, r: 28, cb: startIt, size: cmdDims, kind: 'cmd'});
    }
    document.addEventListener('pointerdown', e => {
      if (mode === 'cmd' && isl && !isl.contains(e.target) && !(e.target.closest && e.target.closest('.c-askf, #sAsk, .tb-ask, .drawer, .buddy-bubble'))) close();
    });
    addEventListener('resize', () => { if (!busy()) return; if (mode === 'cmd') fit(); else if (isOpen()) shape(W(isl.offsetWidth), isl.offsetHeight, parseFloat(isl.style.borderRadius) || 36); });
    return {
      open, close, toast, confirm: confirmIsl, notify, drop, voice, cmd, fit,
      /* the key of the news showing, and the keys waiting behind it */
      showing: () => (busy() && kind === 'news' ? curKey : ''), waiting,
      slot() { el(); return slotEl; },
      isCmd: () => mode === 'cmd',
      busy,
      /* the shell hears when the Ask bar opens or closes */
      onCmd(fn) { cmdFn = fn; },
      on(fn) { subs.add(fn); return () => subs.delete(fn); }
    };
  })();

  /* a field a page draws with class c-askf opens the Ask bar out of itself */
  document.addEventListener('click', e => {
    const f = e.target.closest && e.target.closest('.c-askf');
    if (!f) return;
    e.preventDefault();
    const inp = f.matches('input') ? f : $q('input', f);
    if (inp) inp.blur();
    ISL.cmd('', f);
  });

  /* ---------- voice in the Ask bar: Listening, the heard line, Thinking, then the answer with SHOW ---------- */
  function listen() {
    if (!M.mic || !M.mic.can()) { ISL.toast('No microphone here. Type your question.', true); return; }
    ISL.close();
    setTimeout(() => {
      const h = M.mic.listen({
        onHearing: () => ISL.voice('thinking'),
        onEnd: text => {
          const said = String(text || '').trim();
          if (!said) { ISL.close(); return; }
          ISL.voice('heard', said);
          setTimeout(() => {
            ISL.voice('thinking');
            setTimeout(() => {
              const ctx = M.lastCtx;
              const a = ctx && M.palette && M.palette.answer ? M.palette.answer(ctx, said) : null;
              if (a) { ISL.voice('answer', a.t, a.s || 'm360', a.run); return; }
              ISL.close();
              /* nothing in the OS answers it: hand the words to m360 AI */
              if (M.assistant && M.assistant.open) M.assistant.open(said);
              else window.dispatchEvent(new CustomEvent('m360:ask', {detail: {initial: said}}));
            }, 520);
          }, 700);
        },
        onFail: () => { MK.listen(false); ISL.toast('The mic is off in this browser. Type instead', true); }
      });
      if (!h) { MK.listen(false); ISL.toast('No microphone here. Type your question.', true); return; }
      ISL.voice('listening');
    }, 360);
  }

  /* ---------- sidebar: a black pill marks the page, a warm pill follows the pointer, names on demand ---------- */
  const SB = (function () {
    let side = null, snav = null, spa = null, sph = null, here = null, tip = null, tipOn = false, lastK = null, bound = false;
    const subs = new Set();
    function placeEl(p, el, snap, dy) {
      if (!p || !el) return;
      if (snap) p.style.transition = 'none';
      p.style.transform = 'translate3d(0,' + (el.offsetTop + (dy || 0)) + 'px,0)';
      if (snap) { p.getBoundingClientRect(); p.style.transition = ''; }
    }
    function place(snap) {
      if (!snav || !snav.isConnected) return;
      const a = $q('.nv.on', snav);
      if (!a) { spa.style.opacity = '0'; here.style.opacity = '0'; lastK = null; return; }
      const first = !lastK; spa.style.opacity = '1'; here.style.opacity = '1';
      placeEl(spa, a, snap || first); placeEl(here, a, snap || first, 10);
      const k = a.getAttribute('data-k'); if (lastK && lastK !== k) MK.nod(); lastK = k;
    }
    function ovf() { if (!snav) return; const t = snav.scrollTop, m = snav.scrollHeight - snav.clientHeight; snav.classList.toggle('ovt', t > 2); snav.classList.toggle('ovb', m - t > 2); }
    function hideTip() { if (tip) tip.classList.remove('on'); tipOn = false; }
    function showTip(el) {
      if (!tip || !side) return;
      if (docEl.classList.contains('sbx') || phone()) { hideTip(); return; }
      const r = el.getBoundingClientRect(), s = side.getBoundingClientRect(), bd = $q('.bd', el), kb = $q('.kb', el);
      tip.innerHTML = esc(el.getAttribute('data-t') || '') + (kb ? '<kbd class="kb">' + kb.innerHTML + '</kbd>' : '') + (bd && !bd.hidden ? '<b class="bd">' + esc(bd.textContent) + '</b>' : '');
      tip.style.setProperty('--tx', (s.right + 10) + 'px'); tip.style.setProperty('--ty', (r.top + r.height / 2 - 15) + 'px');
      if (!tipOn) { tip.style.transition = 'none'; tip.getBoundingClientRect(); tip.style.transition = ''; }
      tip.classList.add('on'); tipOn = true;
    }
    function mount(el) {
      if (!el || el === side) return;
      side = el; snav = $q('.snav', el); spa = $q('.sp-a', el); sph = $q('.sp-h', el); here = $q('.here', el);
      tip = $q('#tip');
      if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true'); document.body.appendChild(tip); }
      snav.addEventListener('pointerover', e => {
        const b = e.target.closest('.nv'); if (!b) return;
        if (sph.style.opacity !== '1') placeEl(sph, b, true); else placeEl(sph, b);
        sph.style.opacity = b.classList.contains('on') ? '0' : '1'; showTip(b);
      });
      snav.addEventListener('pointerleave', () => { sph.style.opacity = '0'; hideTip(); });
      side.addEventListener('pointerover', e => { const b = e.target.closest('.sfoot .nv'); if (b) showTip(b); });
      side.addEventListener('pointerout', e => { const b = e.target.closest('.sfoot .nv'); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) hideTip(); });
      side.addEventListener('focusin', e => { const b = e.target.closest('.nv'); if (b && e.target.matches(':focus-visible')) showTip(b); });
      side.addEventListener('focusout', hideTip);
      snav.addEventListener('scroll', () => { hideTip(); ovf(); }, {passive: true});
      if (!bound) { bound = true; addEventListener('resize', () => { ovf(); place(true); }); }
      place(true); ovf(); setTimeout(ovf, 700);
    }
    function toggle() {
      const x = !docEl.classList.contains('sbx');
      docEl.classList.toggle('sbx', x);
      try { localStorage.setItem('m360.sb', x ? 'x' : 's'); } catch (e) { /* private window */ }
      hideTip(); MK.pop();
      subs.forEach(f => { try { f(x); } catch (e) { /* listener */ } });
      setTimeout(() => { ovf(); place(true); FX.frame(); }, 650);
    }
    return {mount, place, toggle, hideTip, ovf, expanded: () => docEl.classList.contains('sbx'), on(f) { subs.add(f); return () => subs.delete(f); }};
  })();

  /* ---------- phone tab bar: the black lens slides under the active tab ---------- */
  const TB = {
    place(nav, snap) {
      if (!nav) return;
      const a = $q('.tab.on', nav), lens = $q('.lens', nav);
      if (!lens) return;
      if (!a || !a.offsetWidth) { lens.style.opacity = '0'; return; }
      lens.style.opacity = '1';
      const first = !lens.__p;
      if (first || snap) lens.style.transition = 'none';
      lens.style.width = a.offsetWidth + 'px'; lens.style.transform = 'translate3d(' + a.offsetLeft + 'px,0,0)';
      if (first || snap) { lens.getBoundingClientRect(); lens.style.transition = ''; }
      lens.__p = 1;
    }
  };

  /* ---------- scroll frame: glass over a dark band, the tab bar folds on the way down ---------- */
  let jumpClose = null;
  const FX = (function () {
    let ticking = false, lastY = 0;
    function frame() {
      ticking = false; const y = window.scrollY, vh = window.innerHeight;
      const dark = $q('#c-biz, .c-band.dark'), side = $q('#side'), pbar = $q('#pbar'), tabbar = $q('#tabbar');
      if (dark) {
        const r = dark.getBoundingClientRect();
        if (side) side.classList.toggle('dk', r.top < vh - 60 && r.bottom > 60);
        if (pbar) pbar.classList.toggle('dk', r.top < 64 && r.bottom > 8);
        if (tabbar) tabbar.classList.toggle('dk', r.top < vh - 20 && r.bottom > vh - 70);
      } else {
        if (side) side.classList.remove('dk'); if (pbar) pbar.classList.remove('dk');
        if (tabbar) tabbar.classList.remove('dk');
      }
      if (tabbar) {
        if (y > lastY + 6 && y > 240) tabbar.classList.add('min');
        else if ((y < lastY - 6 || y < 240) && tabbar.classList.contains('min')) { tabbar.classList.remove('min'); setTimeout(() => TB.place(tabbar, false), 640); }
      }
      lastY = y;
    }
    addEventListener('scroll', () => { if (jumpClose) jumpClose(); if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, {passive: true});
    addEventListener('resize', () => frame());
    return {frame, onScrollClose(f) { jumpClose = f; }};
  })();

  /* [ toggles the sidebar; Escape closes the Ask bar from anywhere in it */
  addEventListener('keydown', e => {
    const k = e.key || '', tg = e.target || {};
    if (k === 'Escape' && ISL.isCmd()) { ISL.close(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(tg.tagName || '') || tg.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === '[' && !phone() && !document.querySelector('.drawer, .menu.open, [data-hotkeys]')) { e.preventDefault(); SB.toggle(); }
  });

  /* ---------- live news: the team as it happens, into the island ----------
     The founder sees check ins, EOD lines, leave asks, join asks, pulses and posts; everyone sees posts
     (their own kudos and approvals come through the inbox). Only what lands after this tab opened. */
  function events(ctx, nm) {
    const out = [], td = U.todayStr(), since = Date.now() - 36 * 3600000, me = ctx.uid;
    const coll = k => (ctx.coll[k] && ctx.coll[k].map) || {};
    for (const author of Object.keys(coll('feed'))) {
      for (const p of ((coll('feed')[author] || {}).posts || [])) {
        if (!p || !p.id || (p.at || 0) < since) continue;
        const what = p.kind === 'win' ? ' shared a win' : p.kind === 'question' ? ' asked a question' : p.kind === 'announce' ? ' posted an announcement' : p.kind === 'poll' ? ' started a poll' : ' posted an update';
        out.push({k: 'fd:' + author + ':' + p.id, at: p.at, uid: author, text: nm(author) + what, cap: 'feed', go: '#feed'});
      }
    }
    if (ctx.isFounder) {
      for (const m of ctx.activeMembers || []) {
        const uid = m.uid;
        const ci = ((coll('checkin')[uid] || {}).days || {})[td];
        if (ci && ci.in) {
          out.push({k: 'ci:' + uid + ':' + td, at: ci.in, uid, text: nm(uid) + ' checked in, ' + U.hhmm(ci.in) + ', ' + (ci.mode === 'wfh' ? 'WFH' : 'office'), cap: 'check in', go: '#people/' + uid});
          if (ci.out) out.push({k: 'co:' + uid + ':' + td, at: ci.out, uid, text: nm(uid) + ' checked out, ' + U.hhmm(ci.out), cap: 'check out', go: '#people/' + uid});
        }
        const ed = ((coll('eod')[uid] || {}).days || {})[td];
        if (ed && ed.at) out.push({k: 'eod:' + uid + ':' + td, at: ed.at, uid, text: nm(uid) + ' posted the EOD line' + (ed.blocked ? ', blocked' : ''), cap: 'eod', go: '#week'});
      }
      if (M.leave && M.leave.pending) {
        for (const x of M.leave.pending(ctx)) out.push({k: 'lv:' + x.uid + ':' + x.req.id, at: x.req.at || 0, uid: x.uid, text: nm(x.uid) + ' asked for leave, ' + (M.leave.rangeText ? M.leave.rangeText(x.req) : ''), cap: 'leave', go: '#admin'});
      }
      if (M.team && M.team.requests) {
        for (const j of M.team.requests(ctx)) out.push({k: 'jr:' + j.uid, at: j.at || 0, uid: j.uid, text: nm(j.uid) + ' asked to join m360', cap: 'join', go: '#admin'});
      }
      for (const id of Object.keys(coll('pulse'))) {
        const x = coll('pulse')[id];
        if (x && (x.at || 0) > since && x.energy) out.push({k: 'pu:' + id, at: x.at, text: 'A pulse came in, energy ' + x.energy + ' of 5', cap: 'pulse', go: '#voice'});
      }
    }
    return out.filter(e => e.uid !== me).sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function LiveWatch() {
    const ctx = M.useCtx();
    const seen = useRef(null);
    const ids = useMemo(() => {
      const s = new Set((ctx.activeMembers || []).map(m => m.uid));
      if (ctx.isFounder && M.team && M.team.requests) M.team.requests(ctx).forEach(j => s.add(j.uid));
      return Array.from(s);
    }, [ctx.activeMembers, ctx.coll.join && ctx.coll.join.map]);
    const profs = M.useProfiles(ids);
    const armed = useRef(0);
    useEffect(() => {
      if (!ctx.ready || !ctx.uid || ctx.viewAs) return;
      /* nothing is news until every collection it reads has arrived once */
      const loaded = ['feed', 'checkin', 'eod', 'leave', 'leavedec', 'pulse', 'join'].every(k => { const c = ctx.coll[k]; return !c || c.off || c.ready; });
      if (!loaded) return;
      if (!armed.current) armed.current = Date.now();
      const nm = id => (profs[id] && profs[id].name) || (ctx.members[id] && ctx.members[id].name) || '';
      const ev = events(ctx, id => nm(id) || 'Someone');
      if (!seen.current || Date.now() - armed.current < 2500) { seen.current = seen.current || {}; ev.forEach(e => { seen.current[e.k] = 1; }); return; }
      const fresh = ev.filter(e => !seen.current[e.k] && (e.at || 0) > BOOT - 60000);
      /* a name not known yet: the news waits for the profile, the next pass tells it */
      if (fresh.some(e => e.uid && !nm(e.uid))) return;
      fresh.forEach(e => { seen.current[e.k] = 1; });
      fresh.slice(0, 3).reverse().forEach(e => ISL.notify(e.text, e.cap, () => M.nav(e.go), null, {key: 'live:' + e.k}));
    }, [ctx, profs]);
    return null;
  }

  M.mark = MK;
  M.island = Object.assign(ISL, {listen});
  /* events(ctx, nm): the live news the island tells (check ins and outs, EOD lines, leave and join asks, pulses,
     posts), newest first, the viewer's own left out; Command's LIVE line reads the same list */
  M.chrome = {glide, glideTo, flash, showAt, sb: SB, tb: TB, fx: FX, phone, LIVE, IR, SVG, icons: DICONS, iconFor, events};
  M.parts.LiveMark = LiveMark;
  M.parts.LiveWatch = LiveWatch;
})();
