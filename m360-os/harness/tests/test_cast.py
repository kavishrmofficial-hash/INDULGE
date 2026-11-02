#!/usr/bin/env python3
"""v35 test: the characters (spec part D, checks of part M).

- clean() keeps ids from the tables only: unknown values become the default, unknown keys go, typed text never
  survives, and flame is no one's colour; the one flame on a human is Kaavish's detail, painted for him alone and
  drawn at 40 px and up;
- the hash is FNV-1a over the parts in ORDER (recomputed here in Python), pinned for the default look, and blind
  to key order, at, by and pic; ORDER only ever grows;
- which look shows: Kaavish's lock, else the person's own, else the clay starter; his own look is never locked;
- avatars: a styled member who picked "Show my character where my photo goes" shows the head in every chip, and
  with pic 'auto' the photo wins (test_profile.py keeps the photo checks);
- Kaavish locks a look from Admin > Characters and the member's sheet is read only, with the line he sees;
- Kaavish's Restyle writes me/<uid>.look with by, ids only, and says so;
- the figures keep their budgets (LOD0, LOD1, his live rig, the COO in four draw calls);
- a lineup of the cast (3D figures on the shared renderer, the 2D heads under them) at 1280 and 390, light and dark.
- v36.1, where people find it: Me > Your m360 has a Your character row (the small head, Style your character) and the
  office's head has a Your character button, flat and 3D, for members and for Kaavish; each opens the sheet for the
  viewer, a save shows in the office at once, and while Kaavish holds a look both read "Kaavish set this look for
  you." and open read only. The same on the team site (build_edgeone.py and the local stand-in server).

Run: cd m360-os && python3 harness/tests/test_cast.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run, FORCE_3D  # noqa: E402

F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
SHOTS = os.environ.get('COO_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'office3d')
# v36.1: the character from settings and the office
V361 = os.environ.get('V361_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'v361')
# the parts a hash reads, in order: a new part is appended, so every hash made before stays put
ORDER = ['skin', 'face', 'eyes', 'brows', 'nose', 'mouth', 'hair', 'hairColor', 'facial', 'glasses', 'frame', 'head', 'headColor',
         'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'ears', 'bindi', 'stud', 'watch', 'pose']
DEFAULT_HASH = 'kip86w'
LOOK_A = {'v': 1, 'skin': 's6', 'face': 'round', 'eyes': 'almond', 'brows': 'bold', 'hair': 'coils', 'hairColor': 'black', 'glasses': 'round', 'frame': 'tortoise',
          'top': 'hoodie', 'topColor': 'graphite', 'bottom': 'trousers', 'bottomColor': 'ink', 'shoes': 'sneakers', 'shoeColor': 'chalk', 'pic': 'auto'}
LOOK_B = {'v': 1, 'skin': 's3', 'face': 'heart', 'eyes': 'lashes', 'brows': 'arched', 'hair': 'long', 'hairColor': 'chestnut', 'bindi': True, 'ears': 'studs',
          'top': 'kurta', 'topColor': 'oat', 'bottom': 'skirt', 'bottomColor': 'cocoa', 'shoes': 'loafers', 'shoeColor': 'cocoa', 'pic': 'char'}
LOOK_K = {'v': 1, 'skin': 's5', 'face': 'oval', 'hair': 'side', 'hairColor': 'black', 'facial': 'short', 'glasses': 'square', 'frame': 'ink',
          'top': 'blazer', 'topColor': 'ink', 'bottomColor': 'ink', 'shoes': 'loafers', 'shoeColor': 'cocoa', 'watch': True, 'pic': 'auto'}
PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='


def fnv36(s):
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    out = ''
    while True:
        h, r = divmod(h, 36)
        out = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + out
        if not h:
            return out


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    os.makedirs(SHOTS, exist_ok=True)
    # one context, so the founder's page and Durvesh's share the store
    c = h.context(width=1280, height=900)
    p = h.page(c)
    p.goto(h.url('founder', '#home', reset=True, seed=True))
    h.ready(p)
    h.roster(p, [M1, M2, M3])
    p.wait_for_function('() => !!(window.M && M.cast && M.lastCtx && M.lastCtx.activeMembers.length > 3)')

    # ---- clean: ids from the tables only, never flame ----
    got = p.evaluate('''() => { const C = M.cast, D = C.DEFAULT;
      const c1 = C.clean({skin: 'zz', topColor: 'flame', hair: '<img src=x onerror=1>', face: 'round', extra: 'x', name: 'Riya', email: 'r@x.in', by: 'u_founder', at: 5.7, bindi: 'yes', glasses: 'round', pic: 'char'});
      const flames = Object.keys(C.COLOURS).map(k => C.clean({[k]: 'flame'})[k] === D[k]);
      const bad = [C.clean(['crop']), C.clean('crop'), C.clean(null), C.clean({by: '<b>x</b>', at: 'now'})];
      const cloth = C.CLOTH.map(x => x.id), skin = C.SKIN.map(x => x.id);
      return {c1, keys: Object.keys(c1).sort(), flames, bad: bad.map(x => C.hash(x) === C.hash(D) && !('by' in x) && !('at' in x)), cloth, skin,
        D: {skin: D.skin, topColor: D.topColor, hair: D.hair}}; }''')
    c1 = got['c1']
    check(c1['skin'] == got['D']['skin'] and c1['topColor'] == got['D']['topColor'] and c1['hair'] == got['D']['hair'] and c1['face'] == 'round' and c1['glasses'] == 'round',
          'clean: unknown ids become the default, known ones stay: %r' % {k: c1[k] for k in ('skin', 'topColor', 'hair', 'face', 'glasses')})
    check('extra' not in c1 and 'name' not in c1 and 'email' not in c1 and c1['by'] == F and c1['at'] == 5 and c1['bindi'] is False and c1['pic'] == 'char',
          'clean: unknown keys go, by is an id, at a whole number, a flag only true: %r' % got['keys'])
    check(all(got['flames']) and 'flame' not in got['cloth'] and all(got['bad']), 'clean: flame is refused for every colour, and a list, a string or nothing is the default look')
    check(got['skin'] == ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'clay'], 'skin is s1 to s8 and clay: %r' % got['skin'])
    fl = p.evaluate('''([a, k]) => { const C = M.cast, flame = s => /f53901/i.test(decodeURIComponent(s));
      const shuffled = Array.from({length: 200}, () => C.shuffle(Math.random, a));
      return {member: C.paint(a, false).accent, founder: C.paint(k, true).accent,
        memberHead: flame(C.head2d(a, {founder: false, size: 176}).url), founderBig: flame(C.head2d(k, {founder: true, size: 64}).url),
        founderSmall: flame(C.head2d(k, {founder: true, size: 32}).url), starterBig: flame(C.head2d(C.starter({founder: true, name: 'Kaavish R'}), {founder: true, size: 72}).url),
        shuffle: shuffled.every(x => C.hash(C.clean(x)) === C.hash(x) && !Object.values(x).includes('flame'))}; }''', [LOOK_A, LOOK_K])
    check(fl['member'] is None and fl['founder'] == [245, 57, 1], 'paint: no flame for a member, Kaavish\'s one detail in flame: %r' % [fl['member'], fl['founder']])
    check(not fl['memberHead'] and fl['founderBig'] and fl['starterBig'] and not fl['founderSmall'],
          'head2d: no flame on a member\'s head, his detail at 40 px and up and never below: %r' % fl)
    check(fl['shuffle'], 'Shuffle stays inside the tables and never picks flame')

    # ---- the hash: FNV-1a over ORDER, stable ----
    hs = p.evaluate('''([a, D]) => { const C = M.cast, l = C.clean(a);
      const shuffled = Object.fromEntries(Object.keys(a).reverse().map(k => [k, a[k]]));
      return {order: C.ORDER, def: C.hash(C.DEFAULT), a: C.hash(a), str: C.ORDER.map(k => String(l[k])).join('|'),
        same: [C.hash(shuffled), C.hash({...a, at: 99, by: 'u_founder', pic: 'char'})], other: C.hash({...a, skin: 's2'}), extra: C.hash(a, 'S' + 'AB'),
        strDef: C.ORDER.map(k => String(C.clean(D)[k])).join('|')}; }''', [LOOK_A, None])
    check(hs['order'][:len(ORDER)] == ORDER, 'ORDER only grows: %r' % hs['order'])
    check(hs['a'] == fnv36(hs['str']) and hs['extra'] == fnv36(hs['str'] + '|SAB') and hs['def'] == fnv36(hs['strDef']), 'the hash is FNV-1a over the parts in ORDER, base 36')
    check(hs['def'] == DEFAULT_HASH, 'the default look hashes to %s as it always has: %s' % (DEFAULT_HASH, hs['def']))
    check(hs['same'] == [hs['a'], hs['a']] and hs['other'] != hs['a'], 'key order, at, by and pic never move a hash; a part does')

    # ---- which look shows: lock, own, starter; never a lock on Kaavish ----
    rs = p.evaluate('''([a, b, k]) => { const C = M.cast, r = o => { const x = C.resolve(o); return [x.src, C.hash(x.look), x.locked, x.pic, x.look.skin]; };
      return {lock: r({uid: 'u_m1', me: {look: b}, cast: {locks: {u_m1: {look: a}}}, founderUid: 'u_founder'}),
        own: r({uid: 'u_m1', me: {look: b}, cast: {locks: {}}, founderUid: 'u_founder'}),
        starter: r({uid: 'u_m1', me: {}, cast: null, founderUid: 'u_founder', member: {pod: 'Pod 1'}, name: 'Durvesh Patil'}),
        list: r({uid: 'u_m1', me: {look: ['s1']}, founderUid: 'u_founder'}),
        founder: r({uid: 'u_founder', me: {look: k}, cast: {locks: {u_founder: {look: a}}}, founderUid: 'u_founder'}),
        ha: C.hash(a), hb: C.hash(b), hk: C.hash(k), initials: C.resolve({uid: 'u_m1', name: 'Durvesh Patil', founderUid: 'u_founder'}).look.initials}; }''', [LOOK_A, LOOK_B, LOOK_K])
    check(rs['lock'][:3] == ['lock', rs['ha'], True] and rs['lock'][3] == 'char', 'a lock shows first, and pic stays the person\'s own: %r' % rs['lock'])
    check(rs['own'][:2] == ['own', rs['hb']], 'without a lock, the person\'s own look: %r' % rs['own'])
    check(rs['starter'][0] == 'starter' and rs['starter'][4] == 'clay' and rs['list'][0] == 'starter' and rs['initials'] == 'DP',
          'with nothing saved, the clay starter with initials (a list is no look): %r' % [rs['starter'], rs['initials']])
    check(rs['founder'][:3] == ['own', rs['hk'], False], 'Kaavish is never locked: %r' % rs['founder'])

    # ---- the same order read from the app's own documents ----
    h.seed_doc(p, 'me/' + M1, {'look': LOOK_B})
    h.seed_doc(p, 'office/cast', {'v': 1, 'at': 1, 'locks': {M1: {'look': LOOK_A, 'at': 1}, F: {'look': LOOK_A, 'at': 1}}})
    p.wait_for_function('() => !!(M.lastCtx.office && M.lastCtx.office.cast)')
    live = p.evaluate('() => [M.cast.resolveFor(M.lastCtx, "u_m1").src, M.cast.resolveFor(M.lastCtx, "u_founder").src, M.cast.resolveFor(M.lastCtx, "u_m2").src]')
    check(live == ['lock', 'starter', 'starter'], 'from the documents: Durvesh locked, Kaavish not, Aanya clay: %r' % live)
    h.seed_doc(p, 'office/cast', {'v': 1, 'at': 2, 'locks': {}})

    # ---- avatars: the head where the person asked for it, the photo otherwise ----
    h.seed_doc(p, 'me/' + M1, {'look': LOOK_B, 'photo': PHOTO})

    def chips(pg):
        """Durvesh's avatar chips on the page (UI.Avatar), leaving out the photo field's own preview on Me"""
        return pg.evaluate('''([photo]) => { const head = (M.heads || {}).u_m1 || '!'; const all = [...document.querySelectorAll('img.av')].filter(i => !i.closest('.prof-preview')).map(i => i.getAttribute('src'));
          return {head: all.filter(s => s === head).length, photo: all.filter(s => s === photo).length, isHead: /^data:image\\/svg\\+xml/.test(head)}; }''', [PHOTO])
    for hsh in ('#people', '#home'):
        h.go(p, 'founder', hash=hsh)
        p.wait_for_function('() => !!(M.heads && M.heads.u_m1)', timeout=10000)
        p.wait_for_timeout(300)
        n = chips(p)
        check(n['isHead'] and n['head'] >= 1 and n['photo'] == 0, 'pic char: Durvesh\'s chips on %s show his head, never the photo: %r' % (hsh, n))
    m = h.page(c)
    h.go(m, 'm1', hash='#me')
    m.wait_for_function('() => !!(M.heads && M.heads.u_m1)', timeout=10000)
    m.wait_for_selector('#character-card')
    n = chips(m)
    check(n['head'] >= 2 and n['photo'] == 0, 'and on his own pages (the sidebar, Me): %r' % n)
    h.seed_doc(p, 'me/' + M1, {'look': {**LOOK_B, 'pic': 'auto'}, 'photo': PHOTO})
    m.wait_for_function('() => (M.headPic || {}).u_m1 === "auto"', timeout=10000)
    m.wait_for_timeout(300)
    n = chips(m)
    check(n['photo'] >= 2 and n['head'] == 0, 'pic auto: the photo wins in every chip: %r' % n)
    check(m.inner_text('#character-line') == 'This is you in the office. Everyone sees it.', 'Me > Your character: %r' % m.inner_text('#character-line'))

    # ---- Kaavish locks the look from Admin > Characters; the member's sheet is read only ----
    h.go(p, 'founder', hash='#admin')
    row = p.locator('#cast-admin .cast-admin-row[data-uid="%s"]' % M1)
    row.wait_for(timeout=10000)
    check(row.get_attribute('data-src') == 'own' and 'their own' in row.inner_text(), 'Admin > Characters lists Durvesh with his own look')
    w0 = p.evaluate('() => window.__dbWrites.length')
    row.get_by_role('button', name='Lock this look').click()
    p.wait_for_function('() => !!((window.__db.get("office/cast") || {}).locks || {}).u_m1', timeout=10000)
    lock = p.evaluate('() => window.__db.get("office/cast")')
    check(lock['locks'][M1]['look']['skin'] == LOOK_B['skin'] and lock['v'] == 1, 'Lock this look writes office/cast with his look')
    m.wait_for_function('() => M.cast.resolveFor(M.lastCtx, M.lastCtx.uid).locked', timeout=10000)
    m.wait_for_function('() => document.querySelector("#character-line").textContent === "Kaavish set this look for you."', timeout=10000)
    m.click('#character-open')
    m.wait_for_selector('#cast-sheet', timeout=10000)
    ro = m.evaluate('''() => ({ro: document.querySelector('#cast-sheet').dataset.ro, note: (document.querySelector('#cast-note') || {}).textContent, save: !!document.querySelector('#cast-save'), shuffle: !!document.querySelector('#cast-shuffle'),
      live: [...document.querySelectorAll('#cast-sheet .cast-tile, #cast-sheet .cast-sw, #cast-sheet .cast-word')].filter(b => !b.disabled).length})''')
    check(ro == {'ro': '1', 'note': 'Kaavish set this look for you.', 'save': False, 'shuffle': False, 'live': 0}, 'a locked member\'s sheet is read only: %r' % ro)
    m.screenshot(path=os.path.join(SHOTS, 'cast-sheet-locked-1280.png'))
    m.keyboard.press('Escape')
    row.get_by_role('button', name='Unlock').click()
    p.wait_for_function('() => !((window.__db.get("office/cast") || {}).locks || {}).u_m1', timeout=10000)
    m.wait_for_function('() => !M.cast.resolveFor(M.lastCtx, M.lastCtx.uid).locked', timeout=10000)
    check(True, 'Unlock gives the look back to him')

    # ---- Kaavish restyles Aanya: me/u_m2.look with by ----
    row2 = p.locator('#cast-admin .cast-admin-row[data-uid="%s"]' % M2)
    check(row2.get_attribute('data-src') == 'starter', 'Aanya is still clay')
    row2.get_by_role('button', name='Restyle').click()
    p.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % M2)
    tools = p.evaluate('''() => { const s = document.querySelector('#cast-sheet .cast-stage').getBoundingClientRect(), t = document.querySelector('#cast-sheet .cast-tools').getBoundingClientRect();
      return [Math.round(s.bottom), Math.round(t.top)]; }''')
    check(tools[1] >= tools[0], 'Shuffle and Undo changes sit under the stage, clear of the figure: %r' % tools)
    p.click('#cast-sheet .cast-tile[data-part="skin"][data-v="s2"]')
    p.get_by_role('tab', name='Hair', exact=True).click()
    p.click('#cast-sheet .cast-tile[data-part="hair"][data-v="bob"]')
    w0 = p.evaluate('() => window.__dbWrites.length')
    p.click('#cast-save')
    p.wait_for_function('n => window.__dbWrites.slice(n).some(w => w.path === "me/u_m2")', arg=w0, timeout=10000)
    p.wait_for_selector('.toast:has-text("Saved. Their character shows the new look.")', timeout=10000)
    writes = p.evaluate('n => window.__dbWrites.slice(n)', w0)
    look = p.evaluate('() => (window.__db.get("me/u_m2") || {}).look')
    check(look.get('by') == F and look.get('skin') == 's2' and look['hair'] == 'bob' and isinstance(look.get('at'), int), 'Restyle writes me/u_m2.look with by %s: %r' % (F, {k: look.get(k) for k in ('skin', 'hair', 'by')}))
    mine = [w for w in writes if not w['path'].startswith('log/')]
    check([w['path'] for w in mine] == ['me/u_m2'] and not re.search(r"'(name|email)':", str(mine[0]['data'])), 'one write besides the activity log, ids only: %r' % [w['path'] for w in writes])
    p.wait_for_function('() => document.querySelector(\'#cast-admin .cast-admin-row[data-uid="u_m2"]\').dataset.src === "own"', timeout=10000)
    check('you set' in row2.inner_text(), 'the row now reads "you set"')
    p.screenshot(path=os.path.join(SHOTS, 'cast-admin-1280.png'))

    # ---- a second roster founder (not the owner) sees the looks, read only: Kaavish alone restyles and locks ----
    team = p.evaluate('() => window.__db.get("roster/team")')
    was = team['members'][M3].get('role')
    team['members'][M3]['role'] = 'founder'
    h.seed_doc(p, 'roster/team', team)
    q = h.page(c)
    # on claude.ai a roster founder who is not the owner is a founder with edit access (edit=1 in the stand-in)
    h.go(q, 'm3', hash='#admin', edit=True)
    q.wait_for_selector('#cast-admin .cast-admin-row[data-uid="%s"]' % M2, timeout=10000)
    seen = q.evaluate('''() => ({rows: document.querySelectorAll('#cast-admin .cast-admin-row').length, buttons: document.querySelectorAll('#cast-admin button').length,
      aanya: document.querySelector('#cast-admin .cast-admin-row[data-uid="u_m2"] .tiny').textContent})''')
    check(seen['rows'] >= 2 and seen['buttons'] == 0 and seen['aanya'] == 'set by Kaavish', 'a second founder sees Characters with no Restyle, Lock or Unlock: %r' % seen)
    q.close()
    team['members'][M3]['role'] = was
    h.seed_doc(p, 'roster/team', team)

    # ---- v36.1: Your character from Me > Your m360 and from the office's head, for a member and for Kaavish ----
    os.makedirs(V361, exist_ok=True)
    # the drawer has finished sliding in (for a screenshot that shows it whole)
    settled = '() => { const d = document.querySelector(".drawer"); return !!d && getComputedStyle(d).opacity === "1" && d.getAnimations().every(a => a.playState !== "running"); }'
    # Durvesh, a member, from settings: his small head, the sheet for himself, a save
    h.go(m, 'm1', hash='#me')
    m.wait_for_selector('#prefs-character')
    row = m.evaluate('''() => { const r = document.querySelector('#prefs-character'), img = r.querySelector('img.cast-mini');
      return {text: r.innerText, head: !!img && img.getAttribute('src') === M.cast.head2d(M.cast.resolveFor(M.lastCtx, 'u_m1').look, {size: 32}).url,
        inPrefs: !!r.closest('#prefs-card'), locked: r.dataset.locked}; }''')
    check(row['inPrefs'] and row['head'] and 'Your character' in row['text'] and 'Style your character' in row['text'] and row['locked'] == '0',
          'Me > Your m360 has a Your character row with his own small head and Style your character: %r' % row)
    m.locator('#prefs-character').scroll_into_view_if_needed()
    m.screenshot(path=os.path.join(V361, 'v361-character-settings-member-1280.png'))
    m.click('#prefs-character-open')
    m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % M1)
    m.click('#cast-sheet .cast-tile[data-part="skin"][data-v="s7"]')
    m.click('#cast-save')
    m.wait_for_function('() => ((window.__db.get("me/u_m1") || {}).look || {}).skin === "s7"', timeout=10000)
    look = m.evaluate('() => window.__db.get("me/u_m1").look')
    check(look.get('by') is None and look['skin'] == 's7' and not re.search(r"'(name|email)':", str(look)), 'a member saves his own look from settings, ids only: %r' % {k: look.get(k) for k in ('skin', 'by')})
    m.wait_for_selector('#cast-sheet', state='detached', timeout=10000)
    # and from the office: the button in the head, flat
    h.go(m, 'm1', hash='#office')
    m.wait_for_selector('.office-head #office-character')
    head = m.evaluate('''() => { const b = document.querySelector('#office-character'), img = b.querySelector('img');
      return {text: b.innerText.trim(), head: img.getAttribute('src') === M.cast.head2d(M.cast.resolveFor(M.lastCtx, 'u_m1').look, {size: 24}).url}; }''')
    check(head == {'text': 'Your character', 'head': True}, 'the office head has Your character with his head, for a member: %r' % head)
    m.screenshot(path=os.path.join(V361, 'v361-character-office-member-1280.png'))
    m.click('#office-character')
    m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % M1)
    m.get_by_role('tab', name='Hair', exact=True).click()
    m.click('#cast-sheet .cast-tile[data-part="hair"][data-v="buzz"]')
    m.get_by_label('Show my character where my photo goes').check()
    m.click('#cast-save')
    m.wait_for_function('() => { const l = (window.__db.get("me/u_m1") || {}).look || {}; return l.hair === "buzz" && l.pic === "char"; }', timeout=10000)
    m.wait_for_selector('#cast-sheet', state='detached', timeout=10000)
    # the office shows the new look: the head in his button, his desk's chip and the figure the office draws
    m.wait_for_function('''() => { const r = M.cast.resolveFor(M.lastCtx, 'u_m1'), want = M.cast.head2d(r.look, {size: 24}).url;
      return r.look.hair === 'buzz' && document.querySelector('#office-character img').getAttribute('src') === want
        && [...document.querySelectorAll('.office-page img.av')].some(i => i.getAttribute('src') === (M.heads || {}).u_m1); }''', timeout=10000)
    seen = m.evaluate('() => M.cast.hash(M.cast.lookOf(M.lastCtx, "u_m1", "Durvesh Patil")) === M.cast.hash(window.__db.get("me/u_m1").look)')
    check(seen, 'after a save in the office, the office draws his new look (his desk chip, the figure, the button)')
    # Kaavish: the same row and the same button, his own sheet
    h.go(p, 'founder', hash='#me')
    p.wait_for_selector('#prefs-character')
    p.click('#prefs-character-open')
    p.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % F)
    p.click('#cast-sheet .cast-tile[data-part="skin"][data-v="s5"]')
    p.click('#cast-save')
    p.wait_for_function('() => ((window.__db.get("me/u_founder") || {}).look || {}).skin === "s5"', timeout=10000)
    p.wait_for_selector('#cast-sheet', state='detached', timeout=10000)
    check(True, 'Kaavish styles his own character from settings')
    h.go(p, 'founder', hash='#office')
    p.wait_for_selector('.office-head #office-character')
    p.click('#office-character')
    p.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % F)
    check(p.inner_text('#cast-sheet').count('Kaavish set this look') == 0, 'his own sheet from the office is never read only')
    p.wait_for_function(settled)
    p.screenshot(path=os.path.join(SHOTS, 'cast-sheet-office-founder-1280.png'))
    p.keyboard.press('Escape')
    p.wait_for_selector('#cast-sheet', state='detached', timeout=10000)
    p.screenshot(path=os.path.join(V361, 'v361-character-office-kaavish-1280.png'))
    # locked: Kaavish holds Durvesh's look; both places say so and open read only
    h.go(p, 'founder', hash='#admin')
    row = p.locator('#cast-admin .cast-admin-row[data-uid="%s"]' % M1)
    row.wait_for(timeout=10000)
    row.get_by_role('button', name='Lock this look').click()
    p.wait_for_function('() => !!((window.__db.get("office/cast") || {}).locks || {}).u_m1', timeout=10000)
    h.go(m, 'm1', hash='#me')
    m.wait_for_selector('#prefs-character[data-locked="1"]', timeout=10000)
    check(m.inner_text('#prefs-character-line') == 'Kaavish set this look for you.', 'locked: the settings row reads "Kaavish set this look for you."')
    m.click('#prefs-character-open')
    m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="1"]' % M1)
    ro = m.evaluate('''() => ({note: (document.querySelector('#cast-note') || {}).textContent, save: !!document.querySelector('#cast-save'),
      live: [...document.querySelectorAll('#cast-sheet .cast-tile, #cast-sheet .cast-sw, #cast-sheet .cast-word')].filter(b => !b.disabled).length})''')
    check(ro == {'note': 'Kaavish set this look for you.', 'save': False, 'live': 0}, 'locked: settings opens the sheet read only: %r' % ro)
    m.wait_for_function(settled)
    m.screenshot(path=os.path.join(V361, 'v361-character-settings-locked-1280.png'))
    m.keyboard.press('Escape')
    m.wait_for_selector('#cast-sheet', state='detached', timeout=10000)
    h.go(m, 'm1', hash='#office')
    m.wait_for_selector('#office-character[data-locked="1"]', timeout=10000)
    m.click('#office-character')
    m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="1"]' % M1)
    check(m.locator('#cast-save').count() == 0, 'locked: the office opens it read only too')
    m.keyboard.press('Escape')
    row.get_by_role('button', name='Unlock').click()
    p.wait_for_function('() => !((window.__db.get("office/cast") || {}).locks || {}).u_m1', timeout=10000)
    m.wait_for_selector('#office-character[data-locked="0"]', timeout=10000)
    # at 390: the button sits in the head, nothing scrolls sideways
    m.set_viewport_size({'width': 390, 'height': 844})
    m.wait_for_function('() => window.innerWidth === 390 && document.documentElement.clientWidth <= 390')
    box = m.evaluate('''() => { const b = document.querySelector('#office-character').getBoundingClientRect();
      return {w: Math.round(b.width), right: Math.round(b.right), over: document.documentElement.scrollWidth - document.documentElement.clientWidth}; }''')
    check(box['right'] <= 390 and box['over'] <= 0 and box['w'] >= 44, 'at 390 the office button fits, 44 px and up, no sideways scroll: %r' % box)
    m.screenshot(path=os.path.join(V361, 'v361-character-office-member-390.png'))
    h.go(m, 'm1', hash='#me')
    # on a phone Your m360 is a fold, and its summary names the character first
    m.wait_for_selector('#fold-prefs .fold-head')
    check(m.inner_text('#fold-prefs .fold-sum').startswith('your character'), 'at 390 the Your m360 fold names the character: %r' % m.inner_text('#fold-prefs .fold-sum'))
    m.click('#fold-prefs .fold-head')
    m.wait_for_selector('#prefs-character')
    m.locator('#prefs-character').scroll_into_view_if_needed()
    check(m.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, 'at 390 the settings row fits')
    m.screenshot(path=os.path.join(V361, 'v361-character-settings-member-390.png'))
    m.set_viewport_size({'width': 1280, 'height': 900})
    # the 3D office has the same head: the button opens the sheet there too
    c3 = h.context(width=1280, height=800, init=(FORCE_3D,))
    q3 = h.page(c3, timeout=60000)
    q3.goto(h.url('founder', '#home', reset=True, seed=True))
    h.ready(q3)
    h.roster(q3, [M1, M2, M3])
    h.go(q3, 'm1', hash='#office')
    q3.wait_for_selector('.office-page.o3-page .office-head #office-character', timeout=60000)
    q3.click('#office-character')
    q3.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % M1, timeout=30000)
    check(True, 'in the 3D office a member opens his sheet from the head')
    q3.wait_for_function(settled)
    q3.screenshot(path=os.path.join(V361, 'v361-character-office3d-member-1280.png'))
    q3.keyboard.press('Escape')
    q3.close()
    c3.close()

    # ---- the figures keep their budgets ----
    budget = p.evaluate('''async ([a, b, k]) => { const T = await M.office3d.load(), C = M.cast, F = M.figure, out = {};
      const heavy = [a, b, k, {...a, hair: 'curls', head: 'turban', facial: 'full', glasses: 'soft', ears: 'hoops', bindi: true, stud: true, watch: true, pose: 'mug'},
        {...b, hair: 'braid', head: 'cap', glasses: 'shades', top: 'dress'}, C.starter({name: 'Riya Shah'}), C.DEFAULT];
      const tri = (look, o) => { const r = F.build(T, C.clean(look), o); const n = [r.tris, r.calls]; r.dispose(); return n; };
      out.lod0 = Math.max(...heavy.map(l => tri(l, {lod: 0})[0]));
      out.lod1 = Math.max(...heavy.map(l => tri(l, {lod: 1})[0]));
      out.live = Math.max(...heavy.map(l => tri(l, {lod: 0, founder: true, live: true})[0]));
      const coo = F.coo(T, {lod: 0, dark: false}); out.coo = [coo.calls, coo.tris]; coo.dispose();
      return out; }''', [LOOK_A, LOOK_B, LOOK_K])
    check(budget['lod0'] <= 8000 and budget['lod1'] <= 2500 and budget['live'] <= 12000 and budget['coo'][0] <= 4,
          'the figures keep their budgets (LOD0 8k, LOD1 2.5k, his live rig 12k, the COO in 4 calls): %r' % budget)

    # ---- the lineup ----
    lineup = '''async ([looks, wide]) => { const T = await M.office3d.load(), C = M.cast, tok = M.office3d.tokens();
      const col = c => new T.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, T.SRGBColorSpace);
      let host = document.getElementById('cast-lineup'); if (host) { M.office3d.release(host); host.remove(); }
      host = document.createElement('div'); host.id = 'cast-lineup';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:var(--warm);display:flex;flex-direction:column';
      const stage = document.createElement('div'); stage.style.cssText = 'flex:1;min-height:0';
      const heads = document.createElement('div'); heads.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:12px';
      host.append(stage, heads); document.body.appendChild(host);
      looks.forEach((l, i) => { const im = document.createElement('img'); im.className = 'av'; im.width = im.height = wide ? 64 : 44; im.src = C.head2d(l, {founder: i === 0, size: 64}).url; heads.appendChild(im); });
      const R = M.office3d.acquire(host, 'editor'); if (!R) return 'busy';
      stage.appendChild(R.canvas); R.canvas.style.cssText = 'width:100%;height:100%;display:block';
      /* people keep their physical colours: lit by the light end of the theme (paper by day, the inverted ink at night), as the turntable is */
      const lightEnd = tok.paper[0] + tok.paper[1] + tok.paper[2] >= tok.ink[0] + tok.ink[1] + tok.ink[2] ? tok.paper : tok.ink;
      const scene = new T.Scene(); scene.background = col(tok.warm);
      const hemi = new T.HemisphereLight(col(lightEnd), col(tok.col), 0.8), key = new T.DirectionalLight(col(lightEnd), 2.2);
      key.position.set(-3, 5, 4); scene.add(hemi, key);
      const n = looks.length + 1, cols = wide ? n : 3, gap = 0.95, rigs = [];
      looks.forEach((l, i) => { const r = M.figure.build(T, C.clean(l), {founder: i === 0, lod: 0}); r.setPose(['stand', 'wave', 'stand', 'talk'][i % 4], 0.4, {}); rigs.push(r); });
      const coo = M.figure.coo(T, {lod: 0, dark: M.theme.resolved() === 'dark'}); if (coo.update) coo.update(0.1); rigs.push(coo);
      /* rows stacked like shelves, seen from the front */
      rigs.forEach((r, i) => { const row = Math.floor(i / cols), c = i % cols; r.root.position.set((c - (cols - 1) / 2) * gap, -row * 1.75, 0); scene.add(r.root); });
      const rows = Math.ceil(n / cols), w = stage.clientWidth, h = stage.clientHeight;
      R.gl.setPixelRatio(1); R.gl.setSize(w, h, false); R.gl.shadowMap.enabled = false;
      const half = 12 * Math.PI / 180, mid = 0.7 - (rows - 1) * 0.875;
      const d = Math.max((cols * gap + 0.4) / 2 / Math.tan(half) / (w / h), (rows * 1.75 + 0.2) / 2 / Math.tan(half)) * 1.05;
      const cam = new T.PerspectiveCamera(24, w / h, 0.1, 100);
      cam.position.set(0, mid + d * 0.12, d); cam.lookAt(0, mid, 0);
      R.gl.render(scene, cam); R.gl.shadowMap.enabled = true;
      const px = new Uint8Array(4 * 64), g = R.gl.getContext(); g.readPixels(Math.floor(w / 2) - 32, Math.floor(h / 2), 64, 1, g.RGBA, g.UNSIGNED_BYTE, px);
      let lit = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) > 30) lit++;
      window.__lineup = () => { rigs.forEach(r => r.dispose()); M.office3d.release(host); host.remove(); };
      return {figures: rigs.length, varied: lit}; }'''
    cast = [LOOK_K, LOOK_A, LOOK_B, {**LOOK_A, 'skin': 's1', 'hair': 'bun', 'hairColor': 'auburn', 'top': 'dress', 'topColor': 'chalk', 'glasses': 'none'},
            {**LOOK_B, 'skin': 's8', 'hair': 'buzz', 'facial': 'full', 'bindi': False, 'top': 'shirt', 'topColor': 'stone', 'bottom': 'trousers'},
            {**LOOK_A, 'skin': 's4', 'hair': 'none', 'head': 'turban', 'headColor': 'camel', 'facial': 'full', 'top': 'kurta', 'topColor': 'chalk'},
            {**LOOK_B, 'skin': 's2', 'hair': 'ponytail', 'hairColor': 'sand', 'top': 'crew', 'topColor': 'camel', 'bottom': 'shorts'}]
    for width, height, dark in ((1280, 720, False), (1280, 720, True), (390, 844, False), (390, 844, True)):
        q = p if width == 1280 else m
        q.set_viewport_size({'width': width, 'height': height})
        q.emulate_media(color_scheme='dark' if dark else 'light')
        q.wait_for_timeout(300)
        r = q.evaluate(lineup, [cast, width > 700])
        check(isinstance(r, dict) and r['figures'] == len(cast) + 1 and r['varied'] > 4, 'the lineup draws the cast and the COO at %d, %s: %r' % (width, 'dark' if dark else 'light', r))
        q.screenshot(path=os.path.join(SHOTS, 'cast-lineup-%d-%s.png' % (width, 'dark' if dark else 'light')))
        q.evaluate('() => window.__lineup()')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'no console errors: %r' % errs[:3])
    return checks


def site_part():
    """v36.1 on the team site (build_edgeone.py, the local stand-in server): a member opens the sheet from Me >
    Your m360 and from the office's head, saves, and the office draws the new look; locked, both open read only. The sign-ins are made up for the test"""
    import json
    import socket
    import subprocess
    import tempfile
    import time
    import urllib.request
    sys.path.insert(0, ROOT)
    import build_edgeone
    checks, fails, errors = [], [], []

    def check(cond, msg):
        (checks if cond else fails).append(msg)
    build_edgeone.main()
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'),
                           stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port

    def doc(key):
        data = json.loads(urllib.request.urlopen(base + '__store', timeout=30).read())
        return json.loads(data[key]) if key in data else None
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

            def device(width=1280):
                c = browser.new_context(viewport={'width': width, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
                c.add_init_script('window.M360_WELCOME_OFF = true; window.M360_MONEY_LOCK_OFF = true')
                pg = c.new_page()
                pg.set_default_timeout(30000)
                pg.on('pageerror', lambda e: errors.append(str(e)))
                return c, pg
            fc, f = device()
            f.goto(base)
            f.wait_for_selector('#signin-name')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'cast-lamp-2026-9911')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            f.wait_for_function('() => !!(window.M && M.lastCtx && M.lastCtx.W)')
            mc, m = device()
            m.goto(base)
            m.wait_for_selector('#signin-pw')
            uid = m.evaluate('() => window.M360_API("signup", {name: "Durvesh Patil", email: "durvesh@mask360.agency", password: "cast-desk-2026-8822"}).then(r => r.uid)')
            f.evaluate('''u => M.lastCtx.W.merge("roster/team", {members: {[u]: {role: "member", empId: "M360-002", title: "Brand Strategist", pod: "Pod 1",
              joined: "2026-01-05", start: "", probationEnd: "", active: true}}, updated: Date.now()})''', uid)
            m.reload()
            m.wait_for_function('u => !!(window.M && M.lastCtx && M.lastCtx.uid === u && M.lastCtx.member && M.cast)', arg=uid)
            # the shell sends a page opened with no route to Home once it has drawn; only then go elsewhere
            m.wait_for_function('() => location.hash.length > 1 && !!document.querySelector("main")')
            # from Me > Your m360
            m.goto(base + '#me')
            m.wait_for_selector('#prefs-character')
            check('Style your character' in m.inner_text('#prefs-character'), 'team site: a member has Your character in Me > Your m360')
            m.click('#prefs-character-open')
            m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % uid)
            m.click('#cast-sheet .cast-tile[data-part="skin"][data-v="s4"]')
            m.click('#cast-save')
            m.wait_for_function('() => !document.querySelector("#cast-sheet")', timeout=20000)
            for _ in range(60):
                d = doc('d/me~' + uid)
                if d and (d.get('look') or {}).get('skin') == 's4':
                    break
                time.sleep(0.25)
            look = ((doc('d/me~' + uid) or {}).get('look') or {})
            check(look.get('skin') == 's4' and look.get('by') is None, 'team site: the save from settings lands on the server, his own: %r' % {k: look.get(k) for k in ('skin', 'by')})
            check('name' not in look and 'email' not in look, 'team site: the stored look carries ids only')
            # from the office's head
            m.goto(base + '#office')
            m.wait_for_selector('.office-head #office-character')
            m.click('#office-character')
            m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="0"]' % uid)
            m.get_by_role('tab', name='Hair', exact=True).click()
            m.click('#cast-sheet .cast-tile[data-part="hair"][data-v="bun"]')
            m.get_by_label('Show my character where my photo goes').check()
            m.click('#cast-save')
            m.wait_for_function('() => !document.querySelector("#cast-sheet")', timeout=20000)
            m.wait_for_function('''u => { const r = M.cast.resolveFor(M.lastCtx, u);
              return r.look.hair === 'bun' && r.look.skin === 's4' && document.querySelector('#office-character img').getAttribute('src') === M.cast.head2d(r.look, {size: 24}).url
                && [...document.querySelectorAll('.office-page img.av')].some(i => i.getAttribute('src') === (M.heads || {})[u]); }''', arg=uid, timeout=20000)
            check(True, 'team site: a member saves from the office and the office draws his new look')
            # Kaavish sees it in his own office too
            f.goto(base + '#office')
            f.wait_for_function('u => { const l = M.cast.lookOf(M.lastCtx, u, "Durvesh Patil"); return l.hair === "bun" && l.skin === "s4"; }', arg=uid, timeout=30000)
            check(True, 'team site: Kaavish\'s office draws Durvesh\'s new look')
            # locked: read only from both places
            f.goto(base + '#admin')
            row = f.locator('#cast-admin .cast-admin-row[data-uid="%s"]' % uid)
            row.wait_for(timeout=20000)
            row.get_by_role('button', name='Lock this look').click()
            m.wait_for_selector('#office-character[data-locked="1"]', timeout=30000)
            m.click('#office-character')
            m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="1"]' % uid)
            check(m.locator('#cast-save').count() == 0 and m.inner_text('#cast-note') == 'Kaavish set this look for you.', 'team site: locked, the office opens the sheet read only')
            m.keyboard.press('Escape')
            m.goto(base + '#me')
            m.wait_for_selector('#prefs-character[data-locked="1"]')
            check(m.inner_text('#prefs-character-line') == 'Kaavish set this look for you.', 'team site: locked, the settings row says so')
            m.click('#prefs-character-open')
            m.wait_for_selector('#cast-sheet[data-uid="%s"][data-ro="1"]' % uid)
            check(m.locator('#cast-save').count() == 0, 'team site: locked, settings opens the sheet read only')
            browser.close()
    except Exception:
        import traceback
        fails.append('the team site part stopped: ' + traceback.format_exc()[-1500:])
    finally:
        srv.terminate()
    check(not errors, 'team site: no page errors: %r' % errors[:3])
    return checks, fails


if __name__ == '__main__':
    out = run(test)
    more, fails = site_part()
    out = list(out) + more
    for c in out:
        print('ok', c)
    for f in fails:
        print('FAIL', f)
    if fails:
        print('FAILED %d of %d checks' % (len(fails), len(fails) + len(out)))
        sys.exit(1)
    print('PASS', len(out), 'checks')
