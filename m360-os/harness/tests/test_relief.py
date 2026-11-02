#!/usr/bin/env python3
"""v36 relief test: m360 stops nagging (brain-spec section 13, rows R1 to R15).

Kaavish said the personal manager's nudges were too annoying. Release 1 takes out what interrupts people
for things they already know, and this test holds one named check per row, each proven in the real app
(Playwright, the clock pinned to a working Tuesday next week in Asia/Kolkata) or on the real team site
code (edgeone/server in Node, Date.now pinned):

R1  work in review is not overdue: no overdue, chase or overdue-ask item on the page or the team site, no
    overdue count on Your team, no rule R07 flag.
R2  a step 1 about one piece of work rings once across days: an earlier day's mark makes today's step a
    silent mark, on the engine and on the person's Home.
R3  a manager is never pinged on a timer: step 2, the morning EOD sweep and the 17:30 note list silently.
    Blocked with the direct manager present goes only by the DM; with the direct manager on leave it
    rings the next one up, once, with a sound.
R4  a quiet stretch never rings.
R5  no "saw the nudge" unless the step rang; no "has not opened m360 today" or "has m360 open".
R6  the COO: no due-tomorrow ask at 17:30 (page and server), the close counts the EOD lines live, J41
    waits for the pitch owner, the hello rides inside the first line, the away mail is for urgent cards.
R7  mail: only an ask goes, never an automatic step and never a manager; "has not been seen" is gone.
R8  the island tells an inbox row only when one that speaks arrives: never on the first snapshot or a silent row.
R9  the inbox: flags list silently, Kaavish gets no flag about his own sign-off, a review row goes to the
    reviewer of record alone, a COO move its DM carries lists silently.
R10 a COO line with no ask rings nothing in chat; a person's DM still does.
R11 PM bubbles are quiet (no sound, no m360:pm) except Blocked and Kaavish's now asks, carry away text that
    names nobody, a COO ask is titled "m360 COO", and no check-in step rings in a device's first minutes.
    No notice anywhere in this test is titled "m360 COO asked m360".
R12 no countdowns or read receipts: the ladder line, the chips, no beam or "N new", the Me card.
R13 the hello waits in the dock: it never opens the panel or speaks, reads loaded data with a capital on
    each clause, and reads "Kaavish asked you 1 thing" and "The COO has 1 thing for you"; no idle jump and
    no brief hop.
R14 no takeovers: check-out opens no day rating (the hero's button does), the studio fold starts closed for
    Kaavish with Close, the brief row is silent.
R15 slow_down has its own line and the offline chips.

Each row is checked on its own: a failing row is listed by name, and the others still run. Run against the
v34 code (31269a8), every one of the 15 rows fails. Waits are on
conditions under fixed clocks; a check that nothing rang waits for the personal manager's watcher to make
its passes (it reads M.pm.devList once a pass, and nothing else does).

Run: cd m360-os && python3 harness/tests/test_relief.py
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4, COO = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4', 'u_m360coo'
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}
ROWS = [
    ('R1', 'work in review is not overdue'),
    ('R2', 'a step 1 rings once across days'),
    ('R3', 'a manager is never pinged on a timer, and Blocked still reaches one'),
    ('R4', 'a quiet stretch never rings'),
    ('R5', 'no read receipts or presence in a manager line'),
    ('R6', 'the COO asks less and counts right'),
    ('R7', 'mail is for asks only'),
    ('R8', 'the island tells only a row that speaks'),
    ('R9', 'the inbox lists silently what is not news'),
    ('R10', 'COO lines with no ask ring nothing in chat'),
    ('R11', 'PM bubbles are quiet, name nobody away, and wait for arrival'),
    ('R12', 'no countdowns or read receipts'),
    ('R13', 'the hello waits in the dock and reads plainly'),
    ('R14', 'no takeovers on Home'),
    ('R15', 'slow_down has its own line'),
]
HIDDEN = ('Object.defineProperty(document, "visibilityState", {configurable: true, get: () => "hidden"});'
          'Object.defineProperty(document, "hidden", {configurable: true, get: () => true});')

# in every document, before the app: what speaks and moves, recorded on window and sent to the test. The
# notices, sounds and speech are wrapped as M gets them; the bell's swings are its element animations; the
# dock's droid is wrapped to read the jump it is given
HOOKS = r'''
(() => {
  window.__bell = 0; window.__notices = []; window.__sounds = []; window.__pmEv = []; window.__said = []; window.__log = []; window.__dockJump = [];
  const rec = (k, x) => { try { if (window.__reliefRec) window.__reliefRec(k, x); } catch (e) {} };
  const anim = Element.prototype.animate;
  Element.prototype.animate = function (...a) { try { if (this.closest && this.closest('.bellbtn')) window.__bell++; } catch (e) {} return anim.apply(this, a); };
  window.addEventListener('m360:pm', e => { window.__pmEv.push(e.detail); window.__log.push(['pmev']); });
  const trap = (o, k, f) => { let v; Object.defineProperty(o, k, {configurable: true, enumerable: true, get() { return v; }, set(x) { try { f(x); } catch (e) {} v = x; }}); };
  const wrapBot = fx => {
    if (!fx || !fx.Bot || fx.Bot.__spy) return;
    const B = fx.Bot;
    const W = function BotSpy(p) { if (p && p.className === 'dock-bot') window.__dockJump.push(Number(p.jumpEvery) || 0); return window.React.createElement(B, p); };
    W.__spy = true;
    fx.Bot = W;
  };
  let real;
  Object.defineProperty(window, 'M', {configurable: true, get() { return real; }, set(m) {
    real = m;
    trap(m, 'notices', n => { const push = n.push; n.push = x => { try { const c = JSON.parse(JSON.stringify(x)); window.__notices.push(c); window.__log.push(['notice', String(c.key || '')]);
      rec('notice', {key: String(c.key || ''), title: String(c.title || ''), body: String(c.body || ''), away: c.away || null, as: (new URLSearchParams(location.search)).get('as')}); } catch (e) {} return push.call(n, x); }; });
    trap(m, 'sound', s => { const play = s.play; s.play = k => { window.__sounds.push(k); window.__log.push(['sound', String(k)]); return play.call(s, k); }; });
    trap(m, 'speech', s => { const say = s.say; s.say = (...a) => { window.__said.push(String(a[0])); return say.apply(s, a); }; });
    trap(m, 'fx', wrapBot);
  }});
})();
'''

# the personal manager's watcher has had its chance: its passes span two PASS lengths
PASSES = '''() => { window.__pmPassAt = []; if (M.pm.__passSpy) return; M.pm.__passSpy = true;
  const d = M.pm.devList; M.pm.devList = u => { window.__pmPassAt.push(performance.now()); return d(u); }; }'''
PASSED = '() => { const t = window.__pmPassAt || []; return t.length >= 2 && t[t.length - 1] - t[0] >= 2 * M.pm.PASS; }'
# React has committed and run its effects: two frames and a task
FRAMES = 'async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))); return true; }'

# ---------------------------------------------------------------- the team site, in Node
SERVER = r'''
const out = {errors: []};
const part = async (name, fn) => { try { await fn(); } catch (e) { out.errors.push(name + ': ' + String(e && e.stack || e).slice(0, 600)); } };
const TODAY = %(today)s;
const DAY = 86400000;
const at = (h, m, d) => Date.parse(TODAY + 'T00:00:00Z') - 330 * 60000 + (h * 60 + m) * 60000 + (d || 0) * DAY;
const Y = new Date(Date.parse(TODAY + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.parse(TODAY + 'T00:00:00Z') + DAY).toISOString().slice(0, 10);
const realNow = Date.now;
const {createApp} = await import(%(core)s);
const pmjs = await import(%(pm)s);

/* R1 and R7 on pm.js: Prathna has a reel in review and a deck in doing, both past due, and Kaavish's ask;
   Ishaan has only the bot's check-in step; everyone is away and has mail */
await part('pm', async () => {
  const mem = (role, x) => ({role, active: true, joined: '2025-01-06', start: '', ...(x || {})});
  const state = {
    members: {u_f: mem('founder'), u_a: mem('member'), u_i: mem('member', {reportsTo: 'u_a'}), u_p: mem('member', {reportsTo: 'u_a'})},
    founderUid: 'u_f',
    settings: {start: '10:30', grace: 15, eodCut: '19:30', holidays: [], rules: {}, pm: {on: true, mail: true}},
    me: {u_f: {pm: {asks: {k1: {kind: 'custom', to: ['u_p'], ask: 'why', at: at(11, 0), via: 'voice'}}}}, u_a: {}, u_i: {}, u_p: {}},
    checkin: {u_f: {days: {[TODAY]: {in: at(10, 0)}}}, u_a: {days: {[TODAY]: {in: at(10, 0)}}}, u_i: {days: {}}, u_p: {days: {[TODAY]: {in: at(10, 20)}}}},
    eod: {u_f: {days: {}}, u_a: {days: {}}, u_i: {days: {}}, u_p: {days: {}}},
    tasks: {
      tr: {title: 'Swisse reel cutdown', owner: 'u_p', status: 'review', due: Y, updated: at(16, 45, -1)},
      td: {title: 'Nykaa deck', owner: 'u_p', status: 'doing', due: Y, updated: at(10, 0, -3)}
    },
    leave: {}, leavedec: {}
  };
  out.items = pmjs.items(state, 'u_p', at(12, 30)).map(it => it.K);
  /* 13:00: the step 2s on Ishaan's check-in and Prathna's deck are long due */
  const plan = pmjs.plan(state, at(13, 10), {beacons: {}, emailOf: u => u + '@example.com', mailed: {}});
  out.plan = plan.map(x => ({to: x.to, slot: x.slot, sources: (x.items || []).map(it => (it.it || it).source), keys: (x.items || []).map(it => (it.it || it).K)}));
  const names = u => ({u_i: 'Ishaan Rao', u_a: 'Aanya Mehta', u_p: 'Prathna Shah', u_f: 'Kaavish Ramchandani'})[u] || '';
  const it = {K: 'u_i:noin:-:' + TODAY, id: 'u_i:noin:-:' + TODAY + '#1', rep: 'u_i', kind: 'noin', ymd: TODAY};
  out.mgrText = pmjs.managerMail ? pmjs.managerMail({...state, me: {...state.me, u_i: {pm: {told: {}}}}}, 'u_a', [{it, esc: {step: '2'}}], names, 'https://m360.example.com', at(20, 0)).text : '';
});

/* R6 on the COO server: a working Tuesday through the brief, r12, m1230, r1730, eod and close */
await part('coo', async () => {
  let NOW = at(9, 46);
  Date.now = () => NOW;
  const NAMED = [['open', 540], ['brief', 585], ['r10', 600], ['r11', 660], ['r12', 720], ['m1230', 750], ['r15', 900], ['r16', 960], ['r1730', 1050], ['close', 1260],
    ['roll1045', 645], ['roll1045b', 705], ['eod', 1170], ['memo', 720]];
  for (let t = 540; t <= 1260; t += 15) NAMED.push(['w' + String(Math.floor(t / 60)).padStart(2, '0') + String(t %% 60).padStart(2, '0'), t]);
  const data = new Map();
  const store = {
    async get(key, x) { if (!data.has(key)) return null; const v = data.get(key); return x && x.type === 'json' ? JSON.parse(v) : v; },
    async set(key, value) { data.set(key, String(value)); },
    async delete(key) { data.delete(key); },
    async list(x) { const p = (x && x.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '"' + data.get(k).length + '"'})), directories: []}; }
  };
  const mails = [];
  const fetcher = async (url, init) => {
    if (String(url).includes('api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response(JSON.stringify({id: 'm' + mails.length}), {status: 200, headers: {'content-type': 'application/json'}}); }
    return new Response('', {status: 404});
  };
  globalThis.fetch = fetcher;
  const env = {fetch: fetcher, COO_SETTLE_MS: '5', PM_RECHECK_MS: '999999999', BOOKS_RECHECK_MS: '999999999', SITE_URL: 'https://m360.example.com'};
  const app = createApp({store, env});
  const put = (k, v) => data.set(k, JSON.stringify(v));
  const doc = k => JSON.parse(data.get(k) || 'null');
  const d = path => doc('d/' + path.split('/').join('~'));
  const setDoc = (path, v) => put('d/' + path.split('/').join('~'), v);
  const P = {u_founder: 'Kaavish Ramchandani', u_m1: 'Shreya Kapoor', u_m2: 'Riya Shah', u_m3: 'Dev Malhotra'};
  put('o/owner', {uid: 'u_founder'});
  put('x/mail', {key: 're_standin_for_tests', from: 'm360 <m360@example.com>'});
  for (const u of Object.keys(P)) put('p/' + u, {name: P[u], email: u.slice(2) + '@example.com', at: NOW});
  const mem = (role, x) => ({role, active: true, joined: '2025-01-06', start: '', ...(x || {})});
  setDoc('roster/team', {members: {u_founder: mem('founder', {empId: 'M360-001'}), u_m1: mem('member', {empId: 'M360-002'}), u_m2: mem('member', {reportsTo: 'u_m1', empId: 'M360-003'}),
    u_m3: mem('member', {reportsTo: 'u_m1', empId: 'M360-004'})}});
  setDoc('settings/app', {start: '10:30', grace: 15, eodCut: '19:30', holidays: [], rules: {}, pm: {on: true},
    coo: {on: true, signedAt: at(9, 0, -20), signedBy: 'u_founder', practiceUntil: null, pausedUntil: null}});
  for (const u of Object.keys(P)) {
    setDoc('checkin/' + u, {days: {[TODAY]: {in: at(10, 0), out: null, mode: 'office'}}});
    setDoc('eod/' + u, {days: {}}); setDoc('me/' + u, {name: P[u]}); setDoc('leave/' + u, {reqs: []}); setDoc('leavedec/' + u, {d: {}});
  }
  const contact = (cid, first, mail) => ({id: cid, first, last: 'X', name: first + ' X', email: mail, email2: '', org: 'o2', orgName: 'Bira 91', stage: 'lead', owner: 'u_founder', at: at(9, 0, -30), updated: at(9, 0, -30), archived: false});
  setDoc('contacts/p000', {rows: {c_priya: contact('c_priya', 'Priya', 'priya@bira.example')}, n: 1});
  const base = {category: '', source: '', updated: at(9, 0, -9), next: '', nextDate: '', project: '', lost: '', created: at(9, 0, -30), stage: 'proposal', stageAt: at(9, 0, -20), contact: 'c_priya'};
  setDoc('pitches/pt_bira', {...base, brand: 'Bira 91', owner: 'u_m1'});
  setDoc('pitches/pt_kav', {...base, brand: 'Kingfisher', owner: 'u_founder'});
  setDoc('tasks/t_tm', {title: 'Read the brand book', owner: 'u_m3', by: 'u_m1', status: 'todo', due: TOMORROW, created: at(10, 0, -1), updated: at(10, 0, -1)});
  const settle = keep => { const mins = Math.floor(((NOW + 330 * 60000) %% DAY) / 60000); for (const [id, t] of NAMED) if (t <= mins && keep.indexOf(id) < 0 && !data.has('x/coo/' + TODAY + '/' + id)) put('x/coo/' + TODAY + '/' + id, {state: 'done', at: NOW, acts: 0}); };
  const call = async body => { const r = await app(new Request('http://localhost/api/m360', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})); let j = null; try { j = await r.json(); } catch (e) { j = null; } return {status: r.status, body: j}; };
  const rows = () => { const L = d('coo/L-' + TODAY); return L ? Object.keys(L.acts || {}).map(id => ({id, ...L.acts[id]})) : []; };
  const cards = () => { const c = d('coo/dec'); return c ? Object.keys(c.items || {}).map(id => ({id, ...c.items[id]})) : []; };
  const tick = async (slot, h, m) => { NOW = at(h, m); settle([slot]); return call({a: 'tick'}); };
  const asksNow = () => Object.values(((d('me/u_m360coo') || {}).pm || {}).asks || {});

  await tick('brief', 9, 46);
  out.briefAsks = asksNow().map(a => [a.code, (a.args || {}).pitch || '']);
  out.room = ((d('chat/dm.u_m1.u_m360coo:u_m360coo') || {}).msgs || []).map(m => [m.id, m.text, !!m.ask]);
  await tick('r12', 12, 1);
  out.drafts = cards().filter(k => k.kind === 'client_mail').map(k => (k.refs || {}).pitch);
  /* a plain card two hours old: no away mail; an urgent one: the away mail */
  const dec = d('coo/dec') || {items: {}};
  dec.items = dec.items || {};
  dec.items.c_old = {id: 'c_old', kind: 'info', status: 'open', at: at(9, 0), by: 'u_m360coo', title: 'Something to look at.', urgent: false, payload: {action: 'coo.ack', input: {}}, refs: {}};
  setDoc('coo/dec', dec);
  await tick('m1230', 12, 31);
  out.m1230 = mails.filter(m => /waiting on you/.test(m.subject || '')).map(m => [m.subject, m.text]);
  const dec2 = d('coo/dec');
  dec2.items.c_urg = {id: 'c_urg', kind: 'leave', status: 'open', at: at(11, 0), by: 'u_m360coo', title: 'Riya asked for leave tomorrow. It needs you.', urgent: true, payload: {action: 'coo.ack', input: {}}, refs: {}};
  setDoc('coo/dec', dec2);
  out.before1730 = asksNow().length;
  await tick('r1730', 17, 31);
  out.after1730 = asksNow().map(a => a.code);
  out.j37 = rows().filter(r => r.job === 'J37').length;
  out.awayMail = mails.filter(m => /waiting on you/.test(m.subject || '')).map(m => [m.subject, m.text]);
  setDoc('eod/u_m1', {days: {[TODAY]: {shipped: 'Decks', next: 'Shoot', at: at(19, 0)}}});
  await tick('eod', 19, 31);
  out.sweep = (rows().find(r => r.job === 'J04') || {}).args || null;
  setDoc('eod/u_m2', {days: {[TODAY]: {shipped: 'Reel', next: 'Grade', at: at(20, 10)}}});
  await tick('close', 21, 1);
  out.close = (rows().find(r => r.job === 'J05') || {}).args || null;
  Date.now = realNow;
});
console.log(JSON.stringify(out));
'''


def server_world(today):
    """The team site's code in Node: observations for R1, R6 and R7, checked in Python."""
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'relief_server.mjs')
    core = 'file://' + os.path.join(ROOT, 'edgeone', 'server', 'core.js')
    pm = 'file://' + os.path.join(ROOT, 'edgeone', 'server', 'pm.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SERVER % {'core': json.dumps(core), 'pm': json.dumps(pm), 'today': json.dumps(today)})
    p = subprocess.run(['node', path], capture_output=True, text=True, timeout=240)
    lines = [x for x in p.stdout.strip().splitlines() if x.startswith('{')]
    if p.returncode != 0 or not lines:
        raise AssertionError('node failed: %s %s' % (p.stdout[-1500:], p.stderr[-1500:]))
    return json.loads(lines[-1])


def test(h):
    fails = {r: [] for r, _ in ROWS}
    passed = {r: [] for r, _ in ROWS}
    seen = []   # every notice any page pushed, from the binding

    def check(row, cond, msg):
        (passed if cond else fails)[row].append(msg)

    def section(rows, fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            msg = 'stopped: ' + ''.join(traceback.format_exception_only(type(e), e)).strip()[:500]
            for r in (rows if isinstance(rows, (list, tuple)) else [rows]):
                fails[r].append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today, mon, fri = tue.isoformat(), (tue - timedelta(days=1)).isoformat(), (tue - timedelta(days=4)).isoformat()
    wed, thu = (tue + timedelta(days=1)).isoformat(), (tue + timedelta(days=2)).isoformat()

    def at(hh, mm, day=0):
        d = tue + timedelta(days=day)
        return datetime(d.year, d.month, d.day, hh, mm, tzinfo=IST)

    def ms(hh, mm, day=0):
        return int(at(hh, mm, day).timestamp() * 1000)

    def new_ctx(fixed, init=''):
        c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
        h.contexts.append(c)
        c.clock.set_fixed_time(fixed)
        c.expose_binding('__reliefRec', lambda src, kind, x: seen.append((kind, x)))
        c.add_init_script(HOOKS)
        if init:
            c.add_init_script(init)
        return c

    def new_page(c):
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        return p

    def go(p, ident, hash='#home', **params):
        # a fresh document each time, so the store and the pinned clock are read afresh
        p.goto('about:blank')
        p.goto(h.url(ident, hash, **params))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.pm && M.pm.loaded(M.lastCtx) && (!M.inbox || !M.inbox.loaded || M.inbox.loaded(M.lastCtx)))')
        p.evaluate(FRAMES)

    def ev(p, expr, arg=None):
        return p.evaluate('(a) => { const ctx = M.lastCtx; return (%s); }' % expr, arg)

    def told(p, uid):
        return p.evaluate('u => (((window.__db.get("me/" + u) || {}).pm || {}).told || {})', uid)

    def passes(p):
        p.evaluate('() => { M.pm.PASS = 800; }')
        p.evaluate(PASSES)
        p.wait_for_function(PASSED, timeout=30000)

    def pm_notices(p):
        return [n for n in p.evaluate('() => window.__notices') if str(n.get('key', '')).startswith('pm:')]

    def pm_sounded(p):
        # the PM bubbles that played a sound: the watcher plays it right after its own notice, in one go
        log = p.evaluate('() => window.__log')
        return [x[1] for i, x in enumerate(log) if x[0] == 'notice' and x[1].startswith('pm:') and i + 1 < len(log) and log[i + 1][0] == 'sound']

    def clear(p):
        p.evaluate('() => { window.__notices = []; window.__sounds = []; window.__pmEv = []; window.__said = []; window.__log = []; }')

    # ================================================================ the team site (R1, R6, R7)
    srv = {}

    def server():
        srv.update(server_world(today))
        for e in srv.get('errors', []):
            row = 'R6' if e.startswith('coo') else 'R7'
            fails[row].append('server part stopped: ' + e[:300])
    section(['R1', 'R6', 'R7'], server)

    def server_r1():
        its = srv['items']
        check('R1', not any(':overdue:tr:' in k for k in its), 'team site: a task in review gives no overdue item: %r' % its)
        check('R1', any(':overdue:td:' in k for k in its), 'team site: a doing task past due still does: %r' % its)
    section('R1', server_r1)

    def server_r7():
        plan = srv['plan']
        check('R7', not any(x['slot'] == 'esc' for x in plan), 'no esc mail to a manager while step 2s are long due: %r' % plan)
        check('R7', not any(x['to'] == 'u_i' for x in plan), 'no mail for an automatic step (Ishaan has only the check-in step): %r' % plan)
        pr = [x for x in plan if x['to'] == 'u_p']
        check('R7', len(pr) == 1 and pr[0]['sources'] == ['ask'], "Prathna's one mail carries only Kaavish's ask, never her overdue step: %r" % pr)
        check('R7', 'has not been seen' not in srv['mgrText'] and 'Nudged at' not in srv['mgrText'], 'the manager words carry no "The nudge has not been seen yet." and no "Nudged at": %r' % srv['mgrText'])
        with open(os.path.join(ROOT, 'edgeone', 'server', 'pm.js'), encoding='utf-8') as f:
            check('R7', 'has not been seen' not in f.read(), '"has not been seen" is nowhere in edgeone/server/pm.js')
    section('R7', server_r7)

    def server_r6():
        check('R6', ['pitch_ask', 'pt_bira'] in srv['briefAsks'], 'setup: the brief asks Shreya about Bira (J40): %r' % srv['briefAsks'])
        room = srv['room']
        check('R6', len(room) == 1 and room[0][1].startswith('Hi Shreya, I am m360 COO.') and 'next step' in room[0][1] and room[0][2],
              "team site: the COO's first line to Shreya is one message, the hello inside the ask: %r" % room)
        check('R6', 'pt_bira' not in srv['drafts'] and 'pt_kav' in srv['drafts'], 'team site J41: no draft on Bira while the ask to its owner is fresh; Kingfisher (Kaavish owns it) is drafted: %r' % srv['drafts'])
        check('R6', srv['m1230'] == [], 'team site J07: no away mail at 12:30 for a card that is not urgent: %r' % srv['m1230'])
        check('R6', 'due_tomorrow' not in srv['after1730'] and srv['j37'] == 0 and len(srv['after1730']) == srv['before1730'],
              'team site J37: the 17:30 round sends no due-tomorrow ask (Dev has work due tomorrow): %r' % srv['after1730'])
        am = srv['awayMail']
        check('R6', len(am) == 1 and 'Riya asked for leave' in am[0][1] and 'Something to look at' not in am[0][1], 'team site J07: the 17:30 away mail goes for the urgent card alone: %r' % am)
        check('R6', srv['sweep'] and srv['sweep'].get('n') == 1 and srv['sweep'].get('of') == 3, 'setup: the 19:30 sweep reads 1 of 3: %r' % srv['sweep'])
        check('R6', srv['close'] and srv['close'].get('eod') == 2 and srv['close'].get('of') == 3, 'team site J05: the close counts the EOD lines live, 2 of 3 with the 20:10 line: %r' % srv['close'])
    section('R6', server_r6)

    # ================================================================ world A: the personal managers (R1 to R5, R3 Blocked)
    # m1 reports to Kaavish, m2 to m1, m3 and m4 to m2. 12:30: everyone in at 10:00 but m4, who has m360 open
    # and no check-in. m3 owns tr (in review, due Monday), td, tp, tq (doing, due Monday), to (doing, due last
    # Friday) and tw (to do, due tomorrow). m3's marks: Monday's K#1 for to, today's K#1 for td shown quietly
    # (negative) and for tp rung (positive). m2 chases tr; Kaavish asks m3 about tr as overdue; no EOD line
    # from m3 on Monday
    cA = new_ctx(at(12, 30))
    pA = new_page(cA)
    names = {F: 'Kaavish Ramchandani', M1: 'Shreya Kapoor', M2: 'Aanya Mehta', M3: 'Riya Shah', M4: 'Arjun Rao'}
    K = lambda tid, day=today: 'u_m3:overdue:%s:%s' % (tid, day)  # noqa: E731

    def seed_people(p, coo, people=(M1, M2, M3, M4)):
        extra = {M1: {'pod': ''}, M2: {'pod': '', 'reportsTo': M1}, M3: {'pod': '', 'reportsTo': M2}, M4: {'pod': '', 'reportsTo': M2}}
        h.roster(p, list(people), extra={u: extra[u] for u in people})
        for u in (F,) + tuple(people):
            h.seed_doc(p, 'checkin/' + u, {'days': {} if u == M4 else {today: {'in': ms(10, 0), 'out': None, 'mode': 'office'}}})
            h.seed_doc(p, 'eod/' + u, {'days': {} if u == M3 else {mon: {'shipped': 'x', 'next': 'y', 'blocked': '', 'at': ms(19, 0, -1)}}})
            h.seed_doc(p, 'leave/' + u, {'reqs': []})
            h.seed_doc(p, 'me/' + u, {'name': names[u]})
        s = p.evaluate('() => window.__db.get("settings/app") || {}')
        s = dict(s, pm={'on': True}, holidays=[], rules={})
        if coo:
            s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -20), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
        else:
            s.pop('coo', None)
        h.seed_doc(p, 'settings/app', s)

    def task(owner, title, status, due):
        return {'title': title, 'owner': owner, 'by': M2, 'status': status, 'due': due, 'priority': 'normal', 'created': ms(10, 0, -8), 'updated': ms(10, 0, -3)}

    def world_a():
        pA.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
        h.ready(pA)
        pA.wait_for_function('() => !!window.__db.get("roster/team")')
        seed_people(pA, False)
        for tid, t in {'tr': task(M3, 'Swisse reel cutdown', 'review', mon), 'td': task(M3, 'Nykaa deck', 'doing', mon), 'tp': task(M3, 'Titan storyboard', 'doing', mon),
                       'tq': task(M3, 'Lakme moodboard', 'doing', mon), 'to': task(M3, 'Raymond callsheet', 'doing', fri),
                       'tw': task(M3, 'Brand book', 'todo', wed)}.items():
            h.seed_doc(pA, 'tasks/' + tid, t)
        h.seed_doc(pA, 'me/' + M3, {'name': names[M3], 'pm': {'told': {K('to', mon) + '#1': ms(11, 20, -1), K('td') + '#1': -ms(11, 16), K('tp') + '#1': ms(11, 16)}}})
        h.seed_doc(pA, 'me/' + M4, {'name': names[M4], 'act': {today: {'1100': 1, '1200': 1}}})
        h.seed_doc(pA, 'me/' + M2, {'name': names[M2], 'pm': {'chase': {'tr': {'rep': M3, 'at': ms(10, 0, -1)}}}})
        h.seed_doc(pA, 'me/' + F, {'name': names[F], 'pm': {'asks': {'a1': {'kind': 'overdue', 'sub': 'tr', 'to': [M3], 'ask': 'eta', 'at': ms(11, 30), 'via': 'voice'}}}})
        go(pA, 'founder', noai=True)
        pA.wait_for_function('() => Object.keys(M.lastCtx.coll.tasks.map).length >= 6')
    section(['R1', 'R2', 'R3', 'R4', 'R5'], world_a)

    def r1_page():
        its3 = ev(pA, 'M.pm.items(ctx, "u_m3").map(i => [i.kind, i.sub, i.source, i.state])')
        check('R1', not any(x[1] == 'tr' for x in its3), 'page: nothing about the reel in review, no overdue item, no chase item, no overdue ask item: %r' % its3)
        check('R1', any(x[0] == 'overdue' and x[1] == 'td' for x in its3), 'page: the deck in doing, past due, keeps its overdue item: %r' % its3)
        wf = ev(pA, '(M.lines.watch(ctx, "u_m3").find(f => f.k === "overdue") || {}).text')
        check('R1', wf == '4 overdue tasks', "Your team's overdue flag counts 4 (td, tp, tq, to), never the reel in review: %r" % wf)
        r07 = ev(pA, 'M.rules.evaluate(ctx, new Date()).filter(f => f.rule === "R07" && f.uid === "u_m3").map(f => f.key)')
        check('R1', 'R07:u_m3:tr' not in r07 and 'R07:u_m3:td' in r07, 'rule R07: no flag for the reel in review, one for the deck: %r' % r07)
    section('R1', r1_page)

    def r2_engine():
        fm3 = ev(pA, 'M.pm.forMe({...ctx, uid: "u_m3"}).filter(x => x.item.kind === "overdue" && x.step === "1").map(x => [x.item.sub, x.ring, x.inBudget, x.held, !!x.told])')
        by = {x[0]: x for x in fm3}
        check('R2', by.get('to') and by['to'][1] is False and by['to'][2] is True and by['to'][3] is False,
              'the callsheet rang on Monday: today its step 1 is a silent mark, neither held nor over the budget: %r' % by.get('to'))
        check('R2', by.get('tq') and by['tq'][1] is True, 'the moodboard, never told before, rings today: %r' % by.get('tq'))
    section('R2', r2_engine)

    def r4():
        q = ev(pA, 'M.pm.forMe({...ctx, uid: "u_m3"}).filter(x => x.item.kind === "quiet").map(x => [x.step, x.ring, x.held])')
        check('R4', q and all(x[1] is False and x[2] is False for x in q), "m3's quiet stretch (nothing saved since 10:00) has steps and none rings: %r" % q)
    section('R4', r4)

    def r3_engine():
        fm2 = ev(pA, 'M.pm.forMe({...ctx, uid: "u_m2"}).map(x => [x.stepId, x.step, x.ring, x.inBudget])')
        s2 = [x for x in fm2 if x[1] in ('2', '2b')]
        check('R3', s2 and all(x[2] is False and x[3] is True for x in s2), "m2's step 2 rows for m3 and m4 are due and silent: %r" % s2)
        sweep = [x for x in s2 if (':noeod:-:' + mon) in x[0]]
        check('R3', sweep and sweep[0][2] is False, "the morning EOD sweep (m3's Monday line) reaches m2 silently: %r" % s2)
        inbox = ev(pA, 'M.pm.inboxItems({...ctx, uid: "u_m2"}).filter(r => /#2b?$/.test(r.id)).map(r => [r.id, r.silent])')
        check('R3', inbox and all(x[1] is True for x in inbox), "they still list in m2's inbox, silently: %r" % inbox)
        dg = ev(pA, 'M.pm.forMe({...ctx, uid: "u_m1"}, {now: a}).filter(x => x.step === "digest").map(x => [x.ring, x.item.line])', ms(17, 45))
        check('R3', dg and dg[0][0] is False, 'the 17:30 note up the line to m1 is there and silent: %r' % dg)
    section('R3', r3_engine)

    def r5():
        m4 = ev(pA, '(M.pm.items(ctx, "u_m4").find(i => i.kind === "noin") || {}).mgrLine')
        check('R5', m4 and 'opened m360' not in m4 and 'has m360 open' not in m4 and 'Nudged' not in m4, 'the check-in line to a manager carries no presence: %r' % m4)
        lines = ev(pA, 'Object.fromEntries(M.pm.items(ctx, "u_m3").filter(i => i.kind === "overdue").map(i => [i.sub, i.mgrLine]))')
        check('R5', 'saw the nudge' not in (lines.get('td') or 'x'), 'a step a card showed quietly (a negative mark) never reads "saw the nudge": %r' % lines.get('td'))
        check('R5', 'saw the nudge' in (lines.get('tp') or ''), 'a step that rang (a positive mark) still does: %r' % lines.get('tp'))
    section('R5', r5)

    def r2_page():
        # m3's own Home: the card marks the repeat step quietly, the bubble rings the new one
        go(pA, 'm3', noai=True)
        pA.evaluate('() => { M.pm.PASS = 800; }')
        pA.wait_for_function('k => { const t = ((window.__db.get("me/u_m3") || {}).pm || {}).told || {}; return t[k[0]] != null && t[k[1]] != null; }', arg=[K('to') + '#1', K('tq') + '#1'])
        t3 = told(pA, M3)
        check('R2', (t3.get(K('to') + '#1') or 0) < 0, "on m3's Home the callsheet's step 1 is marked quietly (negative): %r" % t3.get(K('to') + '#1'))
        check('R2', (t3.get(K('tq') + '#1') or 0) > 0, 'and the moodboard rang (positive): %r' % t3.get(K('tq') + '#1'))
    section('R2', r2_page)

    def r3_blocked():
        # m3 answers Blocked on the moodboard: the note is a DM to m2
        pA.evaluate('k => M.pm.answer(M.lastCtx, k, {how: "blocked", note: "Waiting on the footage"})', K('tq'))
        pA.wait_for_function('() => ((window.__db.get("chat/dm.u_m2.u_m3:u_m3") || {}).msgs || []).length > 0')
        # the direct manager is in: the DM only, the step 2 beside it never rings
        go(pA, 'm2', noai=True)
        pA.wait_for_function('() => M.rooms.messagesOf(M.lastCtx, M.rooms.dmId("u_m3", "u_m2")).length > 0')
        bl = ev(pA, 'M.pm.forMe(ctx).filter(x => x.item.K === a && x.step === "2").map(x => [x.ring, x.chat])', K('tq'))
        dm = ev(pA, 'M.rooms.messagesOf(ctx, M.rooms.dmId("u_m3", "u_m2")).filter(m => m.by === "u_m3" && m.pm === a).length', K('tq'))
        check('R3', bl and bl[0][1] is True and bl[0][0] is False and dm == 1, "Blocked, m2 present: the note is m3's message to m2, and the step 2 beside it is silent: %r" % [bl, dm])
        pA.evaluate('() => { M.pm.PASS = 800; }')
        pA.wait_for_function('k => ((((window.__db.get("me/u_m2") || {}).pm || {}).told || {})[k] || 0) < 0', arg=K('tq') + '#2')
        passes(pA)
        check('R3', pm_notices(pA) == [], 'Blocked, m2 present: no ringing step for m2, the DM is the one place: %r' % pm_notices(pA))
        # the direct manager is on leave: the next one up (m1) hears once, with a sound
        h.seed_doc(pA, 'leave/' + M2, {'reqs': [{'id': 'L2', 'from': today, 'to': today, 'type': 'casual', 'at': ms(9, 0, -3)}]})
        h.seed_doc(pA, 'leavedec/' + M2, {'d': {'L2': {'status': 'approved', 'by': F, 'at': ms(9, 0, -2)}}})
        go(pA, 'm1', noai=True)
        pA.wait_for_function('() => M.lastCtx.onLeave("u_m2", M.U.todayStr())')
        up = ev(pA, 'M.pm.forMe(ctx).filter(x => x.step === "2" || x.step === "2b").map(x => [x.stepId, x.ring])')
        check('R3', [K('tq') + '#2', True] in up and all(not r for sid, r in up if sid != K('tq') + '#2'),
              "Blocked, m2 on leave: m3's Blocked step 2 rings for m1, every other step 2 that moved up to m1 stays silent: %r" % up)
        pA.evaluate('() => { M.pm.PASS = 800; }')
        pA.wait_for_function('k => ((((window.__db.get("me/u_m1") || {}).pm || {}).told || {})[k] || 0) > 0', arg=K('tq') + '#2')
        passes(pA)
        bb = [[n['key'], n['title'], n['body']] for n in pm_notices(pA)]
        check('R3', len(bb) == 1 and bb[0][0] == 'pm:' + K('tq') + '#2' and bb[0][1] == 'Your bot' and 'blocked' in bb[0][2] and 'on leave today' in bb[0][2],
              'Blocked, m2 on leave: one bubble for m1, titled Your bot, naming the block and the leave: %r' % bb)
        check('R3', pm_sounded(pA) == ['pm:' + K('tq') + '#2'] and len(pA.evaluate('() => window.__pmEv')) == 1, 'and it sounds and hops once: someone waits on them: %r %r' % (pA.evaluate('() => window.__log'), pA.evaluate('() => window.__pmEv')))
    section('R3', r3_blocked)

    # ================================================================ world B: the COO on the page (R6)
    # a hidden founder tab keeps the page runner out; the slots are run by hand through M.coo.runSlot
    cB = new_ctx(at(9, 50), HIDDEN)
    pB = new_page(cB)

    def world_b():
        pB.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
        h.ready(pB)
        pB.wait_for_function('() => !!window.__db.get("roster/team")')
        seed_people(pB, True)
        base = {'category': '', 'source': '', 'updated': ms(9, 0, -9), 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': ms(9, 0, -30), 'stage': 'proposal',
                'stageAt': ms(9, 0, -20), 'contact': ''}
        h.seed_doc(pB, 'pitches/pt_bira', dict(base, brand='Bira 91', owner=M1))
        h.seed_doc(pB, 'pitches/pt_kav', dict(base, brand='Kingfisher', owner=F))
        h.seed_doc(pB, 'tasks/tw', task(M3, 'Brand book', 'todo', wed))
        h.seed_doc(pB, 'eod/' + M1, {'days': {today: {'shipped': 'Decks', 'next': 'Shoot', 'blocked': '', 'at': ms(19, 0)}}})
        pB.goto('about:blank')
        pB.goto(h.url('founder', '#home', noai=True))
        h.ready(pB)
        pB.wait_for_function('() => !!(window.M && M.lastCtx && M.coo && M.coo.runSlot && M.lastCtx.activeMembers.length >= 4 && Object.keys(M.lastCtx.coll.pitches.map).length >= 2)')
        pB.evaluate(FRAMES)

    def slot(name, hh, mm):
        return pB.evaluate('''async ([s, n]) => { const r = await M.coo.runSlot(M.lastCtx, s, {now: n}); await new Promise(x => setTimeout(x, 0));
          return {stopped: r.stopped, rows: r.rows.map(x => ({job: x.job, code: x.code, status: x.status, args: x.args, refs: x.refs})), cards: r.cards.map(k => ({kind: k.kind, refs: k.refs}))}; }''', [name, ms(hh, mm)])

    def r6_page():
        world_b()
        b = slot('brief', 9, 46)
        asked = [r for r in b['rows'] if r['code'] == 'pitch_ask']
        check('R6', not b['stopped'] and asked and asked[0]['refs'].get('pitch') == 'pt_bira', 'setup: the brief asks Shreya about Bira (J40): %r' % b['rows'])
        pB.wait_for_function('() => ((window.__db.get("chat/dm.u_m1.u_m360coo:u_m360coo") || {}).msgs || []).length > 0')
        room = pB.evaluate('() => ((window.__db.get("chat/dm.u_m1.u_m360coo:u_m360coo") || {}).msgs || []).map(m => [m.id, m.text, !!m.ask])')
        check('R6', len(room) == 1 and room[0][1].startswith('Hi ') and ', I am m360 COO. ' in room[0][1] and 'next step' in room[0][1] and room[0][2],
              'page: one message to Shreya, the hello inside the first line: %r' % room)
        r12 = slot('r12', 12, 1)
        drafts = [k['refs'].get('pitch') for k in r12['cards'] if k['kind'] == 'client_mail']
        check('R6', 'pt_bira' not in drafts and 'pt_kav' in drafts, 'page J41: Bira waits for its owner Shreya; Kingfisher (Kaavish owns it) is drafted: %r' % r12['cards'])
        r1730 = slot('r1730', 17, 31)
        asks = pB.evaluate('() => Object.values((((window.__db.get("me/u_m360coo") || {}).pm) || {}).asks || {}).map(a => a.code)')
        check('R6', not any(r['job'] == 'J37' for r in r1730['rows']) and 'due_tomorrow' not in asks, 'page J37: the 17:30 round sends no due-tomorrow ask (Riya has work due tomorrow): %r' % [r1730['rows'], asks])
        eod = slot('eod', 19, 31)
        sw = [r for r in eod['rows'] if r['job'] == 'J04']
        h.seed_doc(pB, 'eod/' + M2, {'days': {today: {'shipped': 'Reel', 'next': 'Grade', 'blocked': '', 'at': ms(20, 10)}}})
        pB.wait_for_function('() => !!((M.lastCtx.coll.eod.map.u_m2 || {}).days || {})[M.U.todayStr()]')
        close = slot('close', 21, 1)
        cl = [r for r in close['rows'] if r['job'] == 'J05']
        check('R6', sw and cl and cl[0]['args']['eod'] == sw[0]['args']['n'] + 1 and cl[0]['args']['of'] == sw[0]['args']['of'],
              "page J05: the close counts the EOD lines live, one more than the 19:30 sweep after Aanya's 20:10 line: %r" % [sw and sw[0]['args'], cl and cl[0]['args']])
    section('R6', r6_page)
    cB.close()

    # ================================================================ world C: the inbox, the bell, the dock and Home (R8 to R15)
    # m1 (Durvesh) reports to Kaavish, m2 (Aanya) to m1, m3 (Ishaan) to m2. 11:00. Aanya owns the Swisse project
    # (members m1, m2, m3): Ishaan's reel is in review there; Durvesh's account setup (no project) is in review
    # too. Kaavish signed off Durvesh's callsheet, a day late; Aanya signed off Ishaan's moodboard, a day late.
    # The COO handed Ishaan the Bira carousel at 10:55 and told him in its DM; it moved his Titan storyboard
    # at 09:00 and said nothing. The morning brief is in the COO's ledger
    cC = new_ctx(at(11, 0))
    p = new_page(cC)

    def seed(path, doc):
        p.evaluate('([q, d]) => window.__db.set(q, d)', [path, doc])

    def get(path):
        return p.evaluate('q => window.__db.get(q)', path)

    def items():
        return {i['id']: i for i in p.evaluate('''() => M.inbox.items(M.lastCtx).map(i => ({id: i.id, kind: i.kind, silent: !!i.silent,
          text: i.plain(u => M.coo && M.coo.isCoo(u) ? M.coo.title(M.lastCtx) : u)}))''')}

    def bell_settled():
        # v40: no bell; the inbox has loaded and React has run its effects since (its news goes to the island)
        p.wait_for_function('() => !!M.lastCtx && (!M.inbox.loaded || M.inbox.loaded(M.lastCtx))')
        p.wait_for_timeout(300)
        p.evaluate(FRAMES)

    coo_room = 'dm.' + '.'.join(sorted([M3, COO]))

    def world_c():
        p.goto(h.url('founder', '#home', reset=True, seed=True))
        h.ready(p)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        h.roster(p, [M1, M2, M3], extra={M2: {'reportsTo': M1}, M3: {'reportsTo': M2}})
        nm = {F: 'Kaavish Ramchandani', M1: 'Durvesh Patil', M2: 'Aanya Mehta', M3: 'Ishaan Rao'}
        for u in (F, M1, M2, M3):
            seed('eod/' + u, {'days': {mon: {'shipped': 'x', 'next': 'y', 'blocked': '', 'at': ms(19, 0, -1)}}})
            seed('leave/' + u, {'reqs': []})
            seed('me/' + u, {'name': nm[u]})
        seed('checkin/' + F, {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        seed('checkin/' + M1, {'days': {today: {'in': ms(10, 20), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        seed('checkin/' + M2, {'days': {today: {'in': ms(10, 25), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        seed('checkin/' + M3, {'days': {}})
        base = get('settings/app') or {}
        base['pm'] = {'on': True}
        base['holidays'] = []
        base['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -9), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
        seed('settings/app', base)
        seed('projects/p1', {'name': 'Swisse', 'owner': M2, 'members': [M1, M2, M3], 'status': 'on', 'created': ms(9, 0, -30)})
        T = {
            't_rev': {'title': 'Swisse reel cutdown', 'owner': M3, 'by': M2, 'project': 'p1', 'status': 'review', 'reviewAt': ms(10, 50), 'due': today, 'created': ms(9, 0, -3), 'updated': ms(10, 50)},
            't_rev2': {'title': 'Set up your accounts', 'owner': M1, 'by': F, 'status': 'review', 'reviewAt': ms(10, 52), 'due': today, 'created': ms(9, 0, -3), 'updated': ms(10, 52)},
            't_self': {'title': 'Raymond shoot callsheet', 'owner': M1, 'by': F, 'status': 'done', 'due': mon, 'doneAt': ms(10, 30), 'approvedBy': F, 'approvedAt': ms(10, 30), 'created': ms(9, 0, -5), 'updated': ms(10, 30)},
            't_other': {'title': 'Lakme moodboard', 'owner': M3, 'by': M2, 'project': 'p1', 'status': 'done', 'due': mon, 'doneAt': ms(10, 35), 'approvedBy': M2, 'approvedAt': ms(10, 35), 'created': ms(9, 0, -5), 'updated': ms(10, 35)},
            't_over': {'title': 'Investor update', 'owner': M1, 'by': M1, 'status': 'doing', 'due': mon, 'created': ms(9, 0, -6), 'updated': ms(9, 0, -1)},
            't_coo': {'title': 'Bira carousel copy', 'owner': M3, 'by': M1, 'status': 'todo', 'due': wed, 'created': ms(9, 0, -4), 'updated': ms(10, 55),
                      'ownerLog': [{'by': COO, 'at': ms(10, 55), 'from': M1, 'to': M3, 'why': 'overload'}]},
            't_coo2': {'title': 'Titan storyboard', 'owner': M3, 'by': M2, 'status': 'todo', 'due': thu, 'created': ms(9, 0, -4), 'updated': ms(9, 0),
                       'dueLog': [{'by': COO, 'at': ms(9, 0), 'from': today, 'to': thu, 'why': 'pileup'}]},
        }
        for k, v in T.items():
            seed('tasks/' + k, v)
        seed('chat/' + coo_room + ':' + COO, {'msgs': [{'id': 'coo.r1.' + M3, 'at': ms(10, 55) + 2000, 'text': 'I handed you Bira carousel copy. Durvesh had too much on.', 'mentions': [], 'via': 'coo'}],
                                             'room': coo_room, 'by': COO, 'updated': ms(10, 55)})
        seed('kudos/' + M1, {'given': [{'id': 'k1', 'to': F, 'why': 'Great pitch yesterday', 'at': ms(10, 40)}]})
        # every COO slot of the day settled, so the page runner does nothing; the morning brief is in the ledger
        p.goto('about:blank')
        p.goto(h.url('founder', '#home'))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.coo && M.coo.plan && M.lastCtx && M.lastCtx.activeMembers.length > 3)')
        p.evaluate('''d => { const P = M.coo.plan; const ids = P.slotList(P.stateOf(M.lastCtx, Date.now()).slots).map(x => x.id);
          window.__db.set('coo/slots-' + d, Object.fromEntries(ids.map(id => [id, {state: 'done', at: Date.now(), acts: 0}]))); }''', today)
        row = {'at': ms(9, 45), 'slot': 'brief', 'job': 'J02', 'cap': None, 'rung': 'alone', 'code': 'brief', 'station': 'desk', 'subject': 'x:brief',
               'args': {'leave': 0, 'wfh': 0, 'roll': '10:45', 'wait': 0}, 'refs': {}, 'why': {'code': '', 'args': {}}, 'checks': [], 'facts': [], 'before': {}, 'after': {}, 'told': [], 'status': 'done'}
        seed('coo/L-' + today, {'acts': {'r_brief': row}})
        # a first visit on this device, with no marks of what was announced before
        p.evaluate('() => { for (const k of Object.keys(localStorage)) if (/^m360\\.(inboxNotice|inboxNoticed|pmPass|pmRing|cooDigestHop|studioOpen|buddyHelloDay)/.test(k)) localStorage.removeItem(k); }')
    section(['R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'], world_c)

    def r8():
        go(p, 'founder')
        bell_settled()
        loud0 = p.evaluate('() => M.inbox.loud ? M.inbox.loud(M.lastCtx) : -1')
        check('R8', loud0 >= 1 and p.evaluate('() => window.__notices.filter(n => String(n.key || "").startsWith("inbox:")).length') == 0, 'the first full snapshot holds %d unread rows that speak, and the island stays quiet: %d inbox news' % (loud0, p.evaluate('() => window.__notices.filter(n => String(n.key || "").startsWith("inbox:")).length')))
        n0 = p.evaluate('() => M.inbox.unread(M.lastCtx)')
        # a silent row lands: Aanya signs off another task (a founder flag)
        seed('tasks/t_sil', {'title': 'Nykaa deck v2', 'owner': M3, 'by': M2, 'project': 'p1', 'status': 'done', 'due': wed, 'doneAt': ms(10, 58), 'approvedBy': M2, 'approvedAt': ms(10, 58),
                             'created': ms(9, 0, -2), 'updated': ms(10, 58)})
        p.wait_for_function('n => M.inbox.unread(M.lastCtx) > n', arg=n0)
        bell_settled()
        sil = items().get('flag:signed:t_sil')
        check('R8', sil and sil['silent'] and p.evaluate('() => window.__notices.filter(n => String(n.key || "").startsWith("inbox:")).length') == 0 and p.evaluate('() => M.inbox.loud(M.lastCtx)') == loud0,
              'a silent row lands (a sign-off flag): the island stays quiet and the loud count holds: %r, %d inbox news' % (sil, p.evaluate('() => window.__notices.filter(n => String(n.key || "").startsWith("inbox:")).length')))
        # a row that speaks lands: kudos from Aanya
        seed('kudos/' + M2, {'given': [{'id': 'k2', 'to': F, 'why': 'Saved the Swisse shoot', 'at': ms(10, 59)}]})
        p.wait_for_function('() => window.__notices.filter(n => String(n.key || "").startsWith("inbox:")).length > 0', timeout=10000)
        check('R8', p.evaluate('() => M.inbox.loud(M.lastCtx)') == loud0 + 1, 'a row that speaks lands (kudos): the loud count rises and the island tells it')
    section('R8', r8)

    def r9_founder():
        fi = items()
        check('R9', 'rev:t_rev' not in fi and 'rev:t_rev2' in fi, 'Kaavish: no review row for the Swisse reel (Aanya reviews her project), one for the task with no project: %r' % [k for k in fi if k.startswith('rev:')])
        check('R9', not any(k.endswith(':t_self') for k in fi if k.startswith('flag:')), 'Kaavish gets no inbox flag about his own sign-off of a late task: %r' % [k for k in fi if 't_self' in k])
        check('R9', fi.get('flag:late:t_other', {}).get('silent') and fi.get('flag:signed:t_other', {}).get('silent'), "the late and signed flags on Aanya's sign-off list silently")
        flags = [i for i in fi.values() if i['id'].startswith('flag:') or i['id'].startswith('team:')]
        check('R9', flags and all(i['silent'] for i in flags), 'every flag: and team: row lists silently: %r' % sorted(i['id'] for i in flags if not i['silent']))
    section('R9', r9_founder)

    def r14_brief():
        fi = items()
        brief = [i for i in fi.values() if i['id'].startswith('coo:brief:')]
        check('R14', brief and all(i['silent'] for i in brief), 'the COO brief row lists silently for Kaavish: %r' % brief)
    section('R14', r14_brief)

    def r13_dock_still():
        check('R13', p.locator('.dock-char.hop').count() == 0, 'the morning brief makes no dock hop')
        # v40: the robot is retired, so nothing in the dock is ever drawn, let alone given an idle jump
        jumps = p.evaluate('() => window.__dockJump')
        check('R13', jumps == [], 'no droid is drawn in the dock: %r' % sorted(set(jumps)))
    section('R13', r13_dock_still)

    def r9_members():
        go(p, 'm3')
        i3 = items()
        own = i3.get('coo:own:t_coo:%d' % ms(10, 55))
        check('R9', own and own['silent'] is True, "Ishaan: the COO's handover that its DM carries lists silently: %r" % own)
        due = i3.get('coo:due:t_coo2:%d' % ms(9, 0))
        check('R9', due and due['silent'] is False, "Ishaan: a COO date move with no DM line near it still speaks: %r" % due)
        chat = [i for i in i3.values() if i['kind'] == 'chat']
        check('R9', chat and all(i['silent'] for i in chat), "Ishaan: the COO's DM line lists silently in the inbox: %r" % chat)
        go(p, 'm1')
        i1 = items()
        check('R9', 'rev:t_rev' not in i1, 'Durvesh, on the Swisse project but not its reviewer: no review row, so no review bubble')
        off = i1.get('coo:off:t_coo:%d' % ms(10, 55))
        check('R9', off and off['silent'] is False, 'Durvesh: the handover off him, with no DM to him, still speaks: %r' % off)
        go(p, 'm2')
        i2 = items()
        check('R9', 'rev:t_rev' in i2 and not i2['rev:t_rev']['silent'] and 'rev:t_rev2' not in i2, 'Aanya, the Swisse owner: the Swisse review row, and it speaks: %r' % [k for k in i2 if k.startswith('rev:')])
        # a new review comes in: the bubble reaches Aanya, its reviewer of record
        clear(p)
        seed('tasks/t_rev3', {'title': 'Swisse stills', 'owner': M3, 'by': M2, 'project': 'p1', 'status': 'review', 'reviewAt': ms(11, 0) + 1000, 'due': today, 'created': ms(9, 0, -1), 'updated': ms(11, 0) + 1000})
        p.wait_for_function('() => window.__notices.some(n => n.key === "inbox:rev:t_rev3")', timeout=15000)
        check('R9', True, 'a new review bubbles for Aanya, its reviewer of record')
    section('R9', r9_members)

    def r10():
        go(p, 'm3', '#tasks')
        clear(p)
        cur = get('chat/' + coo_room + ':' + COO)
        cur['msgs'].append({'id': 'coo.r2.' + M3, 'at': ms(11, 0), 'text': 'I moved Titan storyboard to Thursday. You had three things due Wednesday.', 'mentions': [], 'via': 'coo'})
        seed('chat/' + coo_room + ':' + COO, cur)
        p.wait_for_function('() => M.rooms.messagesOf(M.lastCtx, M.rooms.dmId("u_m360coo", "u_m3")).some(m => m.id === "coo.r2.u_m3")')
        # then a person's DM: once its notice is up, the COO line before it has had its turn
        pr = 'dm.' + '.'.join(sorted([M2, M3]))
        seed('chat/' + pr + ':' + M2, {'msgs': [{'id': 'h1', 'at': ms(11, 0) + 500, 'text': 'How is the Swisse cutdown looking?', 'mentions': []}], 'room': pr, 'by': M2, 'updated': ms(11, 0)})
        p.wait_for_function('() => window.__notices.some(n => String(n.key || "").startsWith("chat:") && /h1/.test(n.key))', timeout=10000)
        coo_chat = [n for n in p.evaluate('() => window.__notices') if str(n.get('key', '')).startswith('chat:') and 'coo.r2' in str(n.get('key', ''))]
        check('R10', not coo_chat, 'a COO line with no ask rings nothing in chat: %r' % coo_chat)
        check('R10', True, "a person's DM still rings in chat")
    section('R10', r10)

    k3 = M3 + ':noin:-:' + today

    def r11_arrival():
        # a device's first pass of the day: no check-in step rings in its first five minutes
        p.evaluate('() => { localStorage.removeItem("m360.pmPass.u_m3"); localStorage.removeItem("m360.pmRing.u_m3"); }')
        go(p, 'm3')
        passes(p)
        t3 = told(p, M3)
        check('R11', pm_notices(p) == [] and (k3 + '#1') not in t3, 'arrival grace: on the first pass of the day the check-in step does not ring: %r, told %r' % (pm_notices(p), t3))
    section('R11', r11_arrival)

    def r11_quiet():
        # this device arrived at 10:54: past the grace, the step rings, quietly
        p.evaluate('t => localStorage.setItem("m360.pmPass.u_m3", t + ":" + t)', ms(10, 54))
        go(p, 'm3')
        p.evaluate('() => { M.pm.PASS = 800; }')
        p.wait_for_function('() => window.__notices.some(n => String(n.key || "").startsWith("pm:"))', timeout=20000)
        passes(p)
        pmn = pm_notices(p)
        check('R11', pmn and pmn[0].get('away') == {'title': 'm360', 'body': 'Something needs you in m360.'}, 'past the grace the step rings, and out of the page it names nobody: %r' % (pmn and pmn[0].get('away')))
        check('R11', pm_sounded(p) == [], 'the PM bubble plays no sound: %r' % p.evaluate('() => window.__log'))
        check('R11', p.evaluate('() => window.__pmEv') == [], 'and fires no m360:pm (no hop, no paper plane): %r' % p.evaluate('() => window.__pmEv'))
    section('R11', r11_quiet)

    def r12_card():
        card = p.inner_text('#pm-card')
        check('R12', 'Aanya can see this on Your team.' in card and 'If there is no answer' not in card and 'saw it at' not in card and 'was told at' not in card,
              'the ladder line says who can see it, with no countdown: %r' % card[:300])
        check('R12', p.evaluate('() => !document.querySelector("#pm-card").closest(".beam-host") && !document.querySelector("#pm-card .metal-badge-host") && !/\\d+ new/.test(document.querySelector("#pm-card .pm-head").innerText)'),
              'no beam and no "N new" badge on the card')
        go(p, 'm2')
        p.wait_for_selector('#team-u_m3 .pm-chip[data-k="%s"]' % k3)
        chip = p.inner_text('#team-u_m3 .pm-chip[data-k="%s"]' % k3)
        check('R12', chip == 'open' and not any(x in chip for x in ('seen', 'nudged', 'nudge at', 'not on m360')), "Aanya's chip reads no receipt: %r" % chip)
        go(p, 'm3', '#me')
        p.wait_for_selector('#pm-me-bot')
        me_txt = p.inner_text('#pm-me')
        check('R12', 'At most 4 bubbles a day of its own and 3 for asks, inside your hours and silent unless someone is blocked on you.' in me_txt
              and 'Mute its sound' not in me_txt and 'Sounds and previews for all of m360 are under Your m360.' in me_txt, 'the Me card promise and pointer tell the truth: %r' % me_txt[-420:])
    section('R12', r12_card)

    def r11_titles():
        # Ishaan checks in; the COO asks him something, then Kaavish asks him now
        go(p, 'm3', '#tasks')
        seed('checkin/' + M3, {'days': {today: {'in': ms(10, 58), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
        seed('me/' + COO, {'pm': {'asks': {'c1': {'kind': 'custom', 'to': [M3], 'ask': 'why', 'at': ms(10, 59), 'via': 'coo'}}}})
        p.evaluate('() => localStorage.removeItem("m360.pmRing.u_m3")')
        go(p, 'm3', '#tasks')
        p.evaluate('() => { M.pm.PASS = 800; }')
        p.wait_for_function('() => window.__notices.some(n => String(n.key || "").startsWith("pm:"))', timeout=20000)
        passes(p)
        pmn = pm_notices(p)
        check('R11', pmn and pmn[0]['title'] == 'm360 COO', 'the COO ask is titled "m360 COO": %r' % [n['title'] for n in pmn])
        check('R11', p.evaluate('() => window.__pmEv') == [] and pm_sounded(p) == [], 'and it is quiet: no sound after it, no m360:pm: %r, %r' % (p.evaluate('() => window.__log'), p.evaluate('() => window.__pmEv')))
        me_f = get('me/' + F) or {}
        me_f['pm'] = {'asks': {'k1': {'kind': 'custom', 'to': [M3], 'ask': 'why', 'at': ms(11, 0), 'via': 'typed', 'ringNow': True}}}
        clear(p)
        seed('me/' + F, me_f)
        p.wait_for_function('() => window.__pmEv.length > 0', timeout=20000)
        pmn = pm_notices(p)
        check('R11', pm_sounded(p) and pmn and pmn[-1]['title'] == 'Kaavish asked m360', "Kaavish's now ask sounds and hops: %r, %r" % (p.evaluate('() => window.__log'), [n['title'] for n in pmn]))
    section('R11', r11_titles)

    def r13_hello():
        p.evaluate('() => { localStorage.setItem("m360.forceHello", "1"); localStorage.setItem("m360.tourSeen", "1"); localStorage.removeItem("m360.buddyHelloDay"); }')
        go(p, 'm1')
        p.wait_for_function('() => !!localStorage.getItem("m360.buddyHelloDay")', timeout=15000)
        # the day is marked just before the hello reads the names (an immediate promise here): once ours are in, it is set
        p.evaluate('async () => { await M.ai.names(M.lastCtx); }')
        p.evaluate(FRAMES)
        check('R13', p.locator('#buddy-hello').count() == 0 and not p.evaluate('() => M.buddy.state().open') and p.evaluate('() => window.__said') == [],
              'the hello is made and waits: it never opens the pop-up and never speaks (said %r)' % p.evaluate('() => window.__said'))
        p.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); p.evaluate("() => M.assistant.open('')")   # v40: what the Ask bar's m360 AI row does (the pinned clock holds the island still)
        p.wait_for_selector('#buddy-hello')
        hello = p.inner_text('#buddy-hello')
        parts = [s.strip() for s in re.split(r'(?<=\.) ', hello) if s.strip()]
        check('R13', hello.startswith('Morning, Durvesh.') and '2 open, 1 overdue' in hello, 'the hello waits for the tasks and reads them: %r' % hello)
        check('R13', all(s[0].isupper() or s[0].isdigit() or s.startswith('m360') for s in parts), 'each clause starts with a capital: %r' % parts)
        check('R13', p.evaluate('() => window.__said') == [], 'opening the dock to read it says nothing aloud either')
        p.locator('#hello-later').click()
        p.wait_for_function('() => !document.querySelector("#buddy-hello")')
        p.keyboard.press('Escape')
        p.wait_for_function('() => !M.buddy.state().open')
        p.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); p.evaluate("() => M.assistant.open('')")   # v40: what the Ask bar's m360 AI row does (the pinned clock holds the island still)
        p.wait_for_function('() => M.buddy.state().open')
        check('R13', p.locator('#buddy-hello').count() == 0, 'read once: the next open has no hello')
        p.keyboard.press('Escape')
    section('R13', r13_hello)

    def r14_studio():
        p.evaluate('() => localStorage.removeItem("m360.studioOpen")')
        go(p, 'founder')
        p.wait_for_selector('#studio-now')
        check('R14', p.locator('#studio-look').count() == 1 and p.locator('#studio-now .office-window').count() == 0, "Kaavish's studio fold starts closed, with Look in")
        p.locator('#studio-look').click()
        p.wait_for_selector('#studio-close')
        check('R14', p.locator('#studio-now .office-window').count() == 1, 'looked in, the office shows, and Kaavish can Close it')
        p.locator('#studio-close').click()
        p.wait_for_selector('#studio-look')
        check('R14', p.evaluate('() => localStorage.getItem("m360.studioOpen")') == '0', 'Close keeps it closed on this device')
    section('R14', r14_studio)

    def r14_checkout():
        cC.clock.set_fixed_time(at(19, 40))
        go(p, 'm1')
        p.click('#home-hero button:has-text("Check out")')
        p.wait_for_selector('#home-rate')
        p.evaluate(FRAMES)
        check('R14', p.locator('#dayrate').count() == 0, 'check-out opens no day rating; How did it go? waits on the hero')
        p.locator('#home-rate').click()
        p.wait_for_selector('#dayrate')
        check('R14', True, "the hero's button opens the day rating")
        p.click('#dayrate-skip')
        p.wait_for_selector('#dayrate', state='detached')
    section('R14', r14_checkout)

    def r15():
        line = p.evaluate('() => M.ai.errCopy("slow_down")')
        check('R15', line == "You have used today's AI. It is back tomorrow, and everything else still works.", 'slow_down has its own line: %r' % line)
        p.evaluate('() => M.buddy.open("")')
        p.wait_for_function('() => M.buddy.state().open')
        p.evaluate('''() => { const c = Object.assign({}, M.lastCtx, {sample: Object.assign(() => Promise.reject({code: 'slow_down', message: 'cap'}), {limits: () => Promise.resolve(null)})});
          return M.assistant.send(c, 'Write me a short poem about the Swisse shoot', {via: 'typed', size: 'pop'}); }''')
        p.wait_for_function('() => M.assistant.st.phase === "answer"', timeout=15000)
        st = p.evaluate('() => ({err: M.assistant.st.err, chips: M.assistant.st.chips})')
        check('R15', st['err'].startswith("You have used today's AI.") and 'Something glitched' not in st['err'] and st['chips'] and len(st['chips']) >= 1,
              'at the daily cap the panel reads its line with the offline chips: %r' % st)
        p.keyboard.press('Escape')
    section('R15', r15)

    def r13_forms():
        # the bots off (asks still go): Kaavish asks Durvesh one thing, the COO asks Aanya one thing; each
        # reads it in the dock's hello the next morning
        cC.clock.set_fixed_time(at(11, 30))
        s = get('settings/app')
        s['pm'] = {'on': False}
        seed('settings/app', s)
        seed('me/' + F, {'name': 'Kaavish Ramchandani', 'pm': {'asks': {'k2': {'kind': 'custom', 'to': [M1], 'ask': 'why', 'at': ms(11, 10), 'via': 'typed'}}}})
        seed('me/' + COO, {'pm': {'asks': {'c2': {'kind': 'custom', 'to': [M2], 'ask': 'why', 'at': ms(11, 12), 'via': 'coo'}}}})
        for ident, want in (('m1', 'Kaavish asked you 1 thing: '), ('m2', 'The COO has 1 thing for you: ')):
            p.evaluate('() => { localStorage.setItem("m360.forceHello", "1"); localStorage.removeItem("m360.buddyHelloDay"); }')
            go(p, ident)
            p.wait_for_function('() => !!localStorage.getItem("m360.buddyHelloDay")', timeout=15000)
            p.evaluate('async () => { await M.ai.names(M.lastCtx); }')
            p.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); p.evaluate("() => M.assistant.open('')")   # v40: what the Ask bar's m360 AI row does (the pinned clock holds the island still)
            p.wait_for_selector('#buddy-hello')
            hello = p.inner_text('#buddy-hello')
            check('R13', want in hello and 'asked m360' not in hello and 'm360 COO asked' not in hello, '%s reads "%s...": %r' % (ident, want.strip(), hello))
            line = ev(p, 'M.pm.helloLine(ctx)')
            check('R13', line.startswith(want), 'the PM clause itself: %r' % line)
            p.keyboard.press('Escape')
            p.wait_for_function('() => !M.buddy.state().open')
    section('R13', r13_forms)
    cC.close()

    # ================================================================ across every page of this test
    def titles():
        ns = [x for k, x in seen if k == 'notice']
        bad = [n for n in ns if n['title'] == 'm360 COO asked m360' or re.search(r'm360 COO asked', n['title'])]
        check('R11', not bad, 'no notice anywhere in this test is titled "m360 COO asked m360": %r' % bad[:3])
        check('R11', any(n['title'] == 'm360 COO' and n['key'].startswith('pm:') for n in ns), 'a COO ask did ring in this test, so the line above is about real notices')
        away = [n for n in ns if n['key'].startswith('pm:') and n.get('away') != {'title': 'm360', 'body': 'Something needs you in m360.'}]
        check('R11', not away, 'every PM notice in this test carries the away text: %r' % away[:3])
    section('R11', titles)

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    if errs:
        fails['R13'].append('page errors: %r' % errs[:3])

    lines = []
    for r, name in ROWS:
        ok = not fails[r] and passed[r]
        lines.append('%-4s %-4s %s (%d checks)' % (r, 'ok' if ok else 'FAIL', name, len(passed[r]) + len(fails[r])))
        for m in fails[r]:
            lines.append('          - ' + m[:600])
    print('\n'.join(lines))
    bad = [r for r, _ in ROWS if fails[r] or not passed[r]]
    if bad:
        raise AssertionError('%d of %d relief rows failed: %s' % (len(bad), len(ROWS), ', '.join(bad)))
    return sum(len(v) for v in passed.values())


if __name__ == '__main__':
    n = run(test)
    print('%d checks' % n)
    print('PASS')
