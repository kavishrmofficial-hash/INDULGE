#!/usr/bin/env python3
"""v32 contract test: the personal managers and asks, black box, from spec Parts C, D, F6 and L.

Written by the server builder against the contract alone, apart from builder 1's own test_pm.py, so the
two read the same promise from two sides. It covers what spec Part M lists for test_pm.py, test_pm_ui.py
and test_asks.py through the public names in Part L: M.pm (C9), the ids #pm-card, .pm-row[data-k],
button[data-how], [data-eta], .pm-ladder, .pm-said, #team-<uid> .pm-chip[data-k], .pm-menu button[data-do],
#person-pm, #task-chase, #pm-admin and its controls, #pm-me and its controls, notice keys 'pm:...', and the
ask DM line ids 'ask.<askId>.<uid>'.

The roster: m1 (Durvesh) reports to Kaavish by fallback, m2 (Aanya) names m1, m3 (Ishaan) names m2. The
bots are on. The clock is a working Tuesday next week in Asia/Kolkata.

1. The engine: the C9 names; the policy defaults with the founder's launch calls (off, require); the key;
   who hears; at 10:46 m3's noin with step 1 at 10:45 to m3 and step 2 at 11:45 to m2; nothing for the
   founder; nothing with the bots off, R01 off, approved leave, a holiday or a Sunday; a pending leave
   request holds; coach days keep step 2 back; a stricter wait starts tomorrow; noeod's card step at
   19:00 and ring at 19:30, and yesterday's missing line swept to the manager at their start; rings held
   over lunch and while focus runs; the daily cap; waiton after a blocked answer left for 120 minutes,
   closed by the manager's answer; the copy keeps the house rules.
2. The report's Home at 10:46: #pm-card with the row, the ladder line naming Aanya, the chips; "on it"
   with an eta writes the ack on K and the row reads back what was said. Two pages of one context ring
   at most one notice for the step, and told lands once in me/u_m3.
3. The manager: m2's Your team shows the chip on m3's flag and the menu; the founder's Admin card and the
   audit; m2's Me card with the bot switch held on (require); m1's chase button in m3's task drawer; the
   Bot log on m3's person page.
4. Asks (F6): the founder asks m2 and m3 why they have not checked out at 20:41; the ask record holds codes
   only; one DM line per person with the id ask.<askId>.<uid>, and a retry does not double it; m2's card,
   inbox and answer; the founder's receipt rows; the per-day cap (a ring budget: past it asks show
   silently); ringNow only for the founder; withdraw;
   m1 (m2's manager) sees the founder's ask as a line on Your team.
5. Design: dark and 390x844 at dsf 3: the card has no overflow, no text under 11 px, its chips' text colour
   differs from their background, phone buttons are at least 44 px tall, and the bot canvas is drawn at
   CSS size times the device pixel ratio. The radar save keeps pm (code check: no W.set on me/<uid>).

Expected to fail until builder 1's 09-pm.js and 88-pm.js are merged; every gap is listed by name.

Run: cd m360-os && python3 harness/tests/test_contract_pm.py
"""
import os
import re
import sys
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
SHOTS = os.environ.get('M360_SHOTS', '')
API = ['P', 'on', 'cfgOf', 'botOn', 'managerFor', 'key', 'items', 'forMe', 'board', 'sent', 'digest', 'log', 'inboxItems',
       'helloLine', 'badge', 'audit', 'answer', 'handle', 'chase', 'ask', 'withdraw', 'setCfg', 'told', 'qmerge']
BAD_COPY = re.compile(r'[–—!]|instead of|rather than', re.I)

# the engine, read through derived contexts the way test_quiet.py reads M.quiet
ENGINE = r'''([today, tomorrow, sunday, yesterday]) => {
  const base = M.lastCtx, U = M.U;
  const td = U.parseYmd(today).getTime(), at = (h, m, d) => td + (d || 0) * 86400000 + (h * 60 + m) * 60000;
  const pmOn = {on: true};
  const mk = o => {
    const s = o.settings || {};
    const settings = {...base.settings, ...s, pm: {...(base.settings.pm || {}), ...pmOn, ...(s.pm || {})}, rules: {...base.settings.rules, ...(s.rules || {})}};
    const members = {...base.members};
    for (const u of Object.keys(o.members || {})) members[u] = {...members[u], ...o.members[u]};
    const coll = {...base.coll,
      checkin: {...base.coll.checkin, map: o.checkin || {}}, eod: {...base.coll.eod, map: o.eod || {}},
      tasks: {...base.coll.tasks, map: o.tasks || {}}, me: {...base.coll.me, map: o.me || {}},
      leave: {...base.coll.leave, map: o.leave || {}}, leavedec: {...base.coll.leavedec, map: o.leavedec || {}},
      chat: {...base.coll.chat, map: o.chat || {}}};
    const day = o.day || today;
    const hol = new Set(o.holiday ? [day] : []);
    return {...base, settings, members, activeMembers: Object.keys(members).filter(k => members[k].active !== false).map(k => ({uid: k, ...members[k]})),
      coll, holidays: hol, now: o.now, uid: o.uid || base.uid,
      onLeave: (u, d) => !!(o.leaveOf && o.leaveOf[u] === d), isWorkingDay: (d, u) => U.parseYmd(d).getDay() !== 0 && !hol.has(d) && !(o.leaveOf && o.leaveOf[u] === d)};
  };
  const its = (c, rep, now) => (M.pm.items(c, rep, {now}) || []);
  const brief = it => ({K: it.K, kind: it.kind, sub: it.sub, state: it.state, source: it.source, line: it.line || '', mgrLine: it.mgrLine || '',
    steps: (it.steps || []).map(s => ({id: s.id, step: String(s.step), to: s.to, at: s.at, state: s.state}))});
  const out = {api: {}};
  for (const k of %(api)s) out.api[k] = typeof M.pm[k];
  out.consts = {COPY: typeof M.pm.COPY, KINDS: typeof M.pm.KINDS, ORDER: typeof M.pm.ORDER};
  const bare = {...base, settings: {...M.SETTINGS_DEFAULTS, rules: base.settings.rules}};
  const P = M.pm.P(bare);
  out.defaults = {on: P.on, require: P.require, wait: P.wait, waitMin: P.waitMin, waitMax: P.waitMax, perDay: P.perDay, idle: (P.kinds || {}).idle,
    noin: (P.kinds || {}).noin, digestAt: P.digestAt, coachDays: P.coachDays, blockerMins: P.blockerMins, askPerDay: P.askPerDay, mail: P.mail,
    stateDefault: !!(M.SETTINGS_DEFAULTS.pm && M.SETTINGS_DEFAULTS.pm.on === false), agent: M.SETTINGS_DEFAULTS.agent || null};
  out.key = M.pm.key('u_m3', 'noin', '', today);
  const ci = {u_m1: {days: {[today]: {in: at(10, 20), out: null, mode: 'office'}}}, u_m2: {days: {[today]: {in: at(10, 25), out: null, mode: 'office'}}}};
  const c = mk({checkin: ci, now: at(10, 46)});
  out.mgr = ['u_m3', 'u_m2', 'u_m1', 'u_founder'].map(u => M.pm.managerFor(c, u, today));
  out.m3 = its(c, 'u_m3', at(10, 46)).map(brief);
  out.founder = its(c, 'u_founder', at(10, 46)).map(brief);
  out.off = its(mk({checkin: ci, now: at(10, 46), settings: {pm: {on: false}}}), 'u_m3', at(10, 46)).filter(x => x.source !== 'ask').length;
  out.r01 = its(mk({checkin: ci, now: at(10, 46), settings: {rules: {R01: false}}}), 'u_m3', at(10, 46)).filter(x => x.kind === 'noin').length;
  out.leave = its(mk({checkin: ci, now: at(10, 46), leaveOf: {u_m3: today}}), 'u_m3', at(10, 46)).length;
  out.holiday = its(mk({checkin: ci, now: at(10, 46), holiday: true}), 'u_m3', at(10, 46)).length;
  const sd = U.parseYmd(sunday).getTime() + (10 * 60 + 46) * 60000;
  out.sunday = its(mk({checkin: ci, now: sd, day: sunday}), 'u_m3', sd).length;
  const pend = its(mk({checkin: ci, now: at(10, 46), leave: {u_m3: {reqs: [{id: 'L1', from: today, to: today, type: 'casual', at: at(9, 0)}]}}}), 'u_m3', at(10, 46));
  out.pending = pend.map(x => x.state);
  const coach = its(mk({checkin: ci, now: at(10, 46), members: {u_m3: {joined: yesterday}}}), 'u_m3', at(10, 46));
  out.coach = coach.map(brief);
  /* a stricter wait set today starts tomorrow */
  const me2 = {u_m2: {pm: {cfg: {wait: 60, next: {from: tomorrow, wait: 30}}}}};
  const cn = mk({checkin: ci, me: me2, now: at(10, 46)});
  out.cfg = {today: M.pm.cfgOf(cn, 'u_m2', today).wait, tomorrow: M.pm.cfgOf(cn, 'u_m2', tomorrow).wait,
    clamp: M.pm.cfgOf(mk({me: {u_m2: {pm: {cfg: {wait: 5}}}}, now: at(10, 46)}), 'u_m2', today).wait};
  /* noeod: m3 in, no line: the card step at 19:00, the ring at 19:30 */
  const ci3 = {...ci, u_m3: {days: {[today]: {in: at(10, 30), out: null, mode: 'office'}}}};
  const ne = its(mk({checkin: ci3, now: at(19, 10)}), 'u_m3', at(19, 10)).filter(x => x.kind === 'noeod');
  out.noeod = ne.filter(x => x.K.endsWith(':' + today)).map(brief);
  /* m3 posted nothing yesterday either: the morning sweep reaches m2 at m2's start */
  out.sweep = ne.filter(x => x.K.endsWith(':' + yesterday)).map(brief);
  /* ring: lunch and focus hold it */
  const ovd = {};
  for (let i = 0; i < 6; i++) ovd['ot' + i] = {title: 'Reel ' + (i + 1), owner: 'u_m3', by: 'u_m2', status: 'todo', due: yesterday, created: at(10, 0, -5), updated: at(10, 0, -5)};
  const fm = (now, extra) => (M.pm.forMe(mk({checkin: ci3, tasks: ovd, now, uid: 'u_m3', ...(extra || {})}), {now}) || []).map(x => ({stepId: x.stepId, ring: !!x.ring, bundle: x.bundle == null ? null : String(x.bundle)}));
  out.ringNoon = fm(at(11, 20));
  out.ringLunch = fm(at(13, 45));
  const f0 = M.focus.get();
  M.focus.start('', 'Deep work', 45);
  out.ringFocus = fm(at(11, 20));
  if (f0) M.focus.start(f0.task, f0.title, f0.mins); else M.focus.stop();
  /* waiton: m3 answered blocked at 12:10 on an overdue task; m2 has not answered */
  const tk = {t1: {title: 'Swisse reel cutdown', owner: 'u_m3', by: 'u_m2', status: 'doing', due: yesterday, created: at(10, 0, -5), updated: at(10, 0, -5)}};
  const kOv = M.pm.key('u_m3', 'overdue', 't1', today);
  const blocked = {u_m3: {pm: {ack: {[kOv]: {at: at(12, 10), how: 'blocked'}}}}};
  out.waiton = its(mk({checkin: ci3, tasks: tk, me: blocked, now: at(14, 15)}), 'u_m2', at(14, 15)).filter(x => x.kind === 'waiton').map(brief);
  const answered = {...blocked, u_m2: {pm: {ack: {[kOv]: {at: at(13, 30), how: 'answered'}}}}};
  out.waitonClosed = its(mk({checkin: ci3, tasks: tk, me: answered, now: at(14, 15)}), 'u_m2', at(14, 15)).filter(x => x.kind === 'waiton' && x.state === 'open').length;
  /* the copy, both voices */
  const lines = [];
  const walk = v => { if (typeof v === 'string') lines.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(M.pm.COPY);
  out.copy = lines;
  out.helloLine = M.pm.helloLine(c, (u => (base.members[u] || {}).name || u));
  return out;
}'''


def test(h):
    fails, passed = [], []

    def check(cond, msg):
        (passed if cond else fails).append(msg)

    def section(name, fn):
        try:
            fn()
        except Exception as e:
            fails.append('%s: %s' % (name, ''.join(traceback.format_exception_only(type(e), e)).strip()[:400]))

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()
    tomorrow = (tue + timedelta(days=1)).isoformat()
    yesterday = (tue - timedelta(days=1)).isoformat()
    sunday = (tue - timedelta(days=2)).isoformat()

    def at(hh, mm, day=0):
        return datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)

    def ms(hh, mm, day=0):
        return int(at(hh, mm, day).timestamp() * 1000)

    K3 = 'u_m3:noin:-:' + today

    def new_ctx(fixed, **opts):
        o = {'viewport': {'width': 1280, 'height': 900}, 'locale': 'en-IN', 'timezone_id': 'Asia/Kolkata'}
        o.update(opts)
        c = h.browser.new_context(**o)
        h.contexts.append(c)
        if fixed is not None:
            c.clock.set_fixed_time(fixed)
        return c

    def open_page(c, ident, hash, **params):
        p = c.new_page()
        p.set_default_timeout(15000)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type == 'error' else None)
        p.goto(h.url(ident, hash, **params))
        h.ready(p)
        return p

    def go(p, ident, hash):
        p.goto(h.url(ident, hash))
        h.ready(p)
        p.wait_for_timeout(600)

    # ---- the workspace. Playwright keeps a store per browser context, so every context writes it first ----
    def world(c, ident, hash):
        p = open_page(c, 'founder', '#home', reset=True, seed=True)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        p.wait_for_timeout(300)
        h.roster(p, [M1, M2, M3], extra={M1: {'pod': ''}, M2: {'pod': '', 'reportsTo': M1}, M3: {'pod': '', 'reportsTo': M2}})
        app = p.evaluate('() => window.__db.get("settings/app")') or {}
        h.seed_doc(p, 'settings/app', dict(app, pm=dict(app.get('pm') or {}, on=True), holidays=[]))
        for u in (F, M1, M2, M3):
            h.seed_doc(p, 'checkin/' + u, {'days': {}})
            h.seed_doc(p, 'eod/' + u, {'days': {}})
            p.evaluate('p => window.__db.del(p)', 'leave/' + u)
        for u in (F, M1, M2):
            h.seed_doc(p, 'checkin/' + u, {'days': {today: {'in': ms(10, 20), 'out': None, 'mode': 'office'}}})
        h.seed_doc(p, 'tasks/t1', {'title': 'Swisse reel cutdown', 'owner': M3, 'by': M2, 'status': 'doing', 'due': (tue + timedelta(days=3)).isoformat(),
                                   'created': ms(10, 0, -5), 'updated': ms(10, 0, -5)})
        go(p, ident, hash)
        return p

    c0 = new_ctx(at(10, 46))
    pg = world(c0, 'founder', '#home')

    # ---- 1. the engine ----
    eng = {}

    def engine():
        has = pg.evaluate('() => !!(window.M && M.pm)')
        if not has:
            raise AssertionError('M.pm is not in this build (builder 1, src/js/09-pm.js)')
        eng.update(pg.evaluate(ENGINE % {'api': repr(API)}, [today, tomorrow, sunday, yesterday]))
        missing = [k for k, t in eng['api'].items() if t != 'function']
        check(not missing, 'M.pm has every C9 function: missing %r' % missing)
        check(all(t == 'object' for t in eng['consts'].values()), 'M.pm has COPY, KINDS and ORDER: %r' % eng['consts'])
        d = eng['defaults']
        check(d['on'] is False and d['require'] is True, "the bots ship off and a manager cannot switch theirs off (founder decisions 1 and 2): %r" % d)
        check(d['wait'] == 60 and d['waitMin'] == 30 and d['waitMax'] == 180 and d['perDay'] == 4 and d['digestAt'] == '17:30' and d['coachDays'] == 10
              and d['blockerMins'] == 120 and d['askPerDay'] == 3 and d['mail'] is True and d['idle'] is False and d['noin'] is True, 'the C1 defaults: %r' % d)
        ag = d['agent'] or {}
        check(ag.get('on') is True and ag.get('bulkMax') == 12 and ag.get('perSenderDay') == 40 and ag.get('spokenYes') is True, 'SETTINGS_DEFAULTS.agent (F7): %r' % ag)
        check(eng['key'] == K3, 'the key is rep:kind:sub:ymd with - for no sub: %r' % eng['key'])
        check(eng['mgr'] == [M2, M1, F, None], 'who hears: %r' % eng['mgr'])
        noin = [x for x in eng['m3'] if x['kind'] == 'noin']
        check(len(noin) == 1 and noin[0]['K'] == K3, 'm3 has one noin item at 10:46: %r' % eng['m3'])
        if noin:
            st = {s['step']: s for s in noin[0]['steps']}
            check('1' in st and st['1']['at'] == ms(10, 45) and st['1']['to'] == M3 and st['1']['id'] == K3 + '#1', 'step 1 at 10:45 to m3: %r' % st.get('1'))
            check('2' in st and st['2']['at'] == ms(11, 45) and st['2']['to'] == M2, 'step 2 at 11:45 to m2: %r' % st.get('2'))
            check('Aanya' in noin[0]['line'] or 'Aanya' in noin[0]['mgrLine'] or 'check-in' in noin[0]['line'].lower(), 'the line speaks about the check-in: %r' % noin[0]['line'])
        check(eng['founder'] == [] or all(x['source'] == 'ask' for x in eng['founder']), 'nothing is chased for the founder: %r' % eng['founder'])
        check(eng['off'] == 0, 'the bots off: no automatic item')
        check(eng['r01'] == 0, 'R01 off: no noin')
        check(eng['leave'] == 0 and eng['holiday'] == 0 and eng['sunday'] == 0, 'leave, a holiday and a Sunday carry nothing: %r' % [eng['leave'], eng['holiday'], eng['sunday']])
        check(eng['pending'] == [] or all(s == 'held' for s in eng['pending']), 'a pending leave request holds the day: %r' % eng['pending'])
        co = [x for x in eng['coach'] if x['kind'] == 'noin']
        check(co and not any(s['step'] == '2' and s['state'] != 'skipped' for s in co[0]['steps']), 'coach days keep step 2 back: %r' % co)
        check(eng['cfg'] == {'today': 60, 'tomorrow': 30, 'clamp': 30}, 'a stricter wait starts tomorrow, held to the floor: %r' % eng['cfg'])
        ne = eng['noeod']
        if ne:
            st = {s['step']: s for s in ne[0]['steps']}
            check('0' in st and st['0']['at'] == ms(19, 0) and '1' in st and st['1']['at'] == ms(19, 30) and st['1']['state'] == 'waiting',
                  'noeod: the card at 19:00, the ring at 19:30: %r' % st)
        else:
            check(False, 'noeod at 19:10 shows its card step: %r' % ne)
        sw = eng['sweep']
        check(len(sw) == 1 and any(s['step'] == '2' and s['to'] == M2 and s['at'] == ms(10, 45) for s in sw[0]['steps']),
              "yesterday's missing EOD line reaches m2 once, at m2's start: %r" % sw)
        rn = eng['ringNoon']
        check(rn and sum(1 for x in rn if x['ring']) <= 4, 'six overdue tasks ring at most perDay (4) times: %r' % rn)
        check(rn and len(set(x['bundle'] for x in rn if x['ring'])) <= 2, 'steps due together ring as one bundle: %r' % rn)
        check(eng['ringLunch'] and not any(x['ring'] for x in eng['ringLunch']), 'nothing rings over lunch: %r' % eng['ringLunch'])
        check(eng['ringFocus'] and not any(x['ring'] for x in eng['ringFocus']), 'nothing rings while focus runs: %r' % eng['ringFocus'])
        wo = eng['waiton']
        check(len(wo) == 1 and wo[0]['sub'] == 'u_m3.overdue.t1' and any(s['step'] == '1' and s['at'] == ms(14, 10) and s['to'] == M2 for s in wo[0]['steps']),
              'waiton reaches m2 at 14:10 from the bot above: %r' % wo)
        check(eng['waitonClosed'] == 0, "m2's answer closes waiton: %r" % eng['waitonClosed'])
        bad = [s for s in eng['copy'] + [eng['helloLine'] or ''] if BAD_COPY.search(s)]
        check(eng['copy'] and not bad, 'every COPY line keeps the house rules: %r' % bad[:4])
    section('engine', engine)

    # ---- 2. the report's Home at 10:46 ----
    def report_home():
        c = new_ctx(None)
        c.clock.install(time=at(10, 46))
        p1 = world(c, 'm3', '#home')
        p2 = open_page(c, 'm3', '#work')
        hook = '''() => { if (window.__pmHook) return; window.__pmHook = 1; window.__pushes = []; window.__pmEvents = 0;
          const o = M.notices.push; M.notices.push = n => { window.__pushes.push(String((n && n.key) || '')); return o(n); };
          window.addEventListener('m360:pm', () => { window.__pmEvents++; }); }'''
        for p in (p1, p2):
            p.evaluate(hook)
        for _ in range(4):
            for p in (p1, p2):
                p.clock.run_for(12000)
            p1.wait_for_timeout(400)
        pushes = [k for p in (p1, p2) for k in p.evaluate('() => window.__pushes') if k.startswith('pm:')]
        check(len(pushes) == 1, 'two pages of one context ring the step once: %r' % pushes)
        told = p1.evaluate('k => (((window.__db.get("me/u_m3") || {}).pm || {}).told || {})[k] || null', K3 + '#1')
        check(bool(told), 'told is written for the step: %r' % told)
        p2.close()
        p1.wait_for_selector('#pm-card', timeout=15000)
        row = p1.locator('#pm-card .pm-row[data-k="%s"]' % K3)
        check(row.count() == 1, 'the card carries the noin row keyed by K')
        check('Aanya' in p1.inner_text('#pm-card'), "the card is from Aanya's bot: %r" % p1.inner_text('#pm-card')[:200])
        lad = row.locator('.pm-ladder')
        check(lad.count() == 1 and 'Aanya' in lad.inner_text() and '11:45' in lad.inner_text(), 'the ladder says when Aanya hears: %r' % (lad.inner_text() if lad.count() else ''))
        hows = row.locator('button[data-how]').evaluate_all('bs => bs.map(b => b.dataset.how)')
        check('onit' in hows and 'wrong' in hows and 'reply' in hows, 'the check-in chips: on it (running late), not right and reply: %r' % hows)
        row.locator('button[data-how="onit"]').first.click()
        eta = p1.locator('#pm-card [data-eta]')
        eta.first.wait_for(timeout=5000)
        eta.first.click()
        p1.wait_for_function('k => ((((window.__db.get("me/u_m3") || {}).pm || {}).ack || {})[k] || {}).how === "onit"', arg=K3, timeout=8000)
        ack = p1.evaluate('k => (((window.__db.get("me/u_m3") || {}).pm || {}).ack || {})[k]', K3)
        check(ack and ack.get('how') == 'onit' and ack.get('eta'), 'on it with an eta is written on K: %r' % ack)
        p1.wait_for_selector('#pm-card .pm-said', timeout=8000)
        check('Aanya can see this' in p1.inner_text('#pm-card .pm-said'), 'the row reads back what was said: %r' % p1.inner_text('#pm-card .pm-said'))
        c.close()
    section('report home', report_home)

    # ---- 3. the manager, Admin, Me, the task drawer and the person page ----
    def manager():
        c = new_ctx(at(11, 0))
        p = world(c, 'm2', '#home')
        p.wait_for_selector('#team-u_m3', timeout=15000)
        chip = p.locator('#team-u_m3 .pm-chip[data-k="%s"]' % K3)
        check(chip.count() == 1, "m3's noin flag carries the bot's chip")
        if chip.count():
            states = ('on it', 'nudged', 'seen', 'no answer', 'not on m360 today', 'with you since')
            check(any(x in chip.inner_text().lower() for x in states), 'the chip reads one of the D2 states: %r' % chip.inner_text())
            chip.click()
            p.wait_for_timeout(300)
            dos = p.locator('.pm-menu button[data-do]').evaluate_all('bs => bs.map(b => b.dataset.do)')
            check(set(['again', 'mine', 'drop', 'message', 'copy']) <= set(dos), 'the chip menu: %r' % dos)
        go(p, 'm2', '#me')
        p.wait_for_selector('#pm-me', timeout=10000)
        for sel in ('#pm-bot-on', '#pm-bot-wait', '#pm-bot-voice', '#pm-bot-kinds'):
            check(p.locator(sel).count() >= 1, "m2's Me card has %s" % sel)
        on = p.locator('#pm-bot-on')
        if on.count():
            held = on.first.evaluate('e => !!(e.disabled || e.getAttribute("aria-disabled") === "true" || e.querySelector("button:disabled, [aria-disabled=true], input:disabled"))')
            check(held, 'the bot switch is held on while the founder requires it (founder decision 2)')
        go(p, 'founder', '#admin')
        if p.locator('#pm-admin').count() and p.locator('#pm-audit').count() == 0:
            # the audit is worked out only while its fold is open (spec J): open it
            if p.locator('#pm-on').count() == 0:
                p.locator('#pm-admin').first.click()
                p.wait_for_timeout(300)
            fold = p.locator('#pm-admin .pm-audit-wrap button, #pm-admin button:has-text("This week")')
            if fold.count():
                fold.first.click()
                p.wait_for_timeout(500)
        for sel in ('#pm-admin', '#pm-on', '#pm-wait', '#pm-digest', '#pm-perday', '#pm-kinds .pill[data-kind]', '#pm-mail', '#pm-audit'):
            if sel != '#pm-admin' and p.locator(sel).count() == 0 and p.locator('#pm-admin').count():
                # folded cards open on a click of their title
                p.locator('#pm-admin').first.click()
                p.wait_for_timeout(300)
            check(p.locator(sel).count() >= 1, 'Admin > Personal managers has %s' % sel)
        if p.locator('#pm-admin').count():
            check('Email works on the team site' in p.inner_text('#pm-admin'), 'on claude.ai the mail row says it works on the team site')
        go(p, 'm1', '#tasks/t1')
        p.wait_for_selector('.drawer', timeout=10000)
        check(p.locator('#task-chase').count() == 1, "m1, in m3's chain, can ask m3's bot to chase the task")
        go(p, 'founder', '#people/u_m3')
        check(p.locator('#person-pm').count() == 1, "the Bot log on m3's person page")
        c.close()
    section('manager', manager)

    # ---- 4. asks: the founder at 20:41 ----
    asked = {}

    def asks():
        c = new_ctx(at(20, 41))
        p = world(c, 'founder', '#home')
        h.seed_doc(p, 'checkin/' + M2, {'days': {today: {'in': ms(10, 8), 'out': None, 'mode': 'office'}}})
        h.seed_doc(p, 'checkin/' + M3, {'days': {today: {'in': ms(10, 31), 'out': None, 'mode': 'office'}}})
        h.seed_doc(p, 'checkin/' + M1, {'days': {today: {'in': ms(11, 2), 'out': ms(19, 40), 'mode': 'office'}}})
        p.wait_for_timeout(600)
        r = p.evaluate('''async () => { const ctx = M.lastCtx;
          const r = await M.pm.ask(ctx, {kind: 'noout', to: ['u_m2', 'u_m3', 'u_m1'], ask: 'why', via: 'voice', tellBy: Date.now() + 64 * 60000});
          return r; }''')
        asked.update(r or {})
        aid = asked.get('askId')
        check(aid and sorted(asked.get('sent') or []) == [M2, M3], 'the ask goes to the two still checked in: %r' % asked)
        check(any((s or {}).get('uid') == M1 for s in (asked.get('skipped') or [])), 'the one who checked out is skipped with a reason: %r' % asked.get('skipped'))
        rec = p.evaluate('a => (((window.__db.get("me/u_founder") || {}).pm || {}).asks || {})[a]', aid)
        check(rec and rec.get('kind') == 'noout' and sorted(rec.get('to') or []) == sorted([M2, M3]) and rec.get('via') == 'voice', 'the ask record: %r' % rec)
        check(rec and not any(isinstance(v, str) and len(v) > 40 for v in rec.values()), 'the record holds codes, never free text: %r' % rec)
        for u in (M2, M3):
            room = 'chat/dm.' + '.'.join(sorted([F, u])) + ':' + F
            ids = p.evaluate('r => ((window.__db.get(r) || {}).msgs || []).map(m => m.id)', room)
            check(ids.count('ask.%s.%s' % (aid, u)) == 1, 'one DM line for %s with the deterministic id: %r' % (u, ids))
        again = p.evaluate('''async ([a, u]) => { const ctx = M.lastCtx; const room = M.rooms.dmId(ctx.uid, u);
          await M.rooms.send(ctx, room, 'again', [], null, {id: 'ask.' + a + '.' + u, ask: a});
          await new Promise(r => setTimeout(r, 400));
          return ((window.__db.get('chat/' + room + ':' + ctx.uid) || {}).msgs || []).filter(m => m.id === 'ask.' + a + '.' + u).length; }''', [aid, M2])
        check(again == 1, 'a retry does not double the DM line: %r' % again)
        # the recipient: card, inbox, answer
        go(p, 'm2', '#home')
        p.wait_for_selector('#pm-card', timeout=15000)
        row = p.locator('#pm-card .pm-row[data-k*=":noout:"]')
        check(row.count() >= 1, "m2's card carries the founder's ask")
        check('Kaavish' in p.inner_text('#pm-card'), 'the row says who asked: %r' % p.inner_text('#pm-card')[:200])
        inbox = p.evaluate('() => M.inbox.items(M.lastCtx).filter(i => String(i.id).startsWith("pm:")).map(i => i.id)')
        check(inbox, 'the ask lands in the inbox as a pm item: %r' % inbox)
        if row.count():
            row.first.locator('button[data-how]').first.click()
            p.wait_for_timeout(800)
        acks = p.evaluate('() => (((window.__db.get("me/u_m2") || {}).pm || {}).ack || {})')
        check(any(':noout:' in k for k in acks), 'the answer is written on K: %r' % acks)
        # the middle manager sees it, unpinged
        go(p, 'm1', '#home')
        p.wait_for_selector('#team-u_m2', timeout=15000)
        check('Kaavish asked' in p.inner_text('#team-u_m2'), "m1 sees the founder's ask on m2 as a line: %r" % p.inner_text('#team-u_m2')[:200])
        # the sender: receipt rows, caps, ringNow, withdraw
        go(p, 'founder', '#home')
        sent = p.evaluate('a => (M.pm.sent(M.lastCtx) || []).find(s => s.askId === a || s.id === a) || null', aid)
        check(sent is not None, "the founder's sent list holds the ask: %r" % sent)
        cap = p.evaluate('''async () => { const ctx = M.lastCtx, out = [];
          for (const kind of ['noeod', 'quiet', 'idle', 'late', 'custom', 'custom']) out.push(await M.pm.ask(ctx, {kind, to: ['u_m3'], ask: 'why', via: 'typed'}));
          await new Promise(r => setTimeout(r, 600));
          /* what m3's devices would do with them now: the budget is the same on every device */
          const now = Date.now(), steps = (M.pm.forMe({...M.lastCtx, uid: 'u_m3'}, {now}) || []).filter(x => String(x.step).startsWith('a.'));
          return {sends: out.map(r => ({sent: r.sent || [], skipped: (r.skipped || []).map(s => s.why || '')})), asks: steps.length, rings: steps.filter(x => x.ring).length}; }''')
        sent_n = 1 + sum(len(x['sent']) for x in cap['sends'])
        check(sent_n > 3 and cap['asks'] > 3, 'six more asks to m3 are made and show, so the cap is tested: %r' % cap)
        check(cap['rings'] <= 3, 'm3 is interrupted by at most askPerDay (3) asks a day, all senders together; the rest show silently: %r' % cap)
        wd = p.evaluate('async a => { await M.pm.withdraw(M.lastCtx, a); await new Promise(r => setTimeout(r, 400)); return ((((window.__db.get("me/u_founder") || {}).pm || {}).asks || {})[a] || {}).withdrawn || null; }', aid)
        check(bool(wd), 'withdraw marks the ask: %r' % wd)
        go(p, 'm1', '#home')
        rn = p.evaluate('''async () => { const r = await M.pm.ask(M.lastCtx, {kind: 'custom', to: ['u_m2'], ask: 'why', via: 'typed', note: 'Call me', ringNow: true});
          await new Promise(r => setTimeout(r, 400));
          const a = (((window.__db.get("me/u_m1") || {}).pm || {}).asks || {})[r.askId] || {};
          return {ringNow: !!a.ringNow, note: typeof a.note === 'string' || JSON.stringify(a).indexOf('Call me') >= 0}; }''')
        check(rn == {'ringNow': False, 'note': False}, 'only the founder may ring now, and the words of the note stay out of the record: %r' % rn)
        c.close()
    section('asks', asks)

    # ---- 5. design: dark, phone, and the card's details ----
    def design():
        for name, opts in (('dark-1280', {'viewport': {'width': 1280, 'height': 900}, 'color_scheme': 'dark'}),
                           ('light-390', {'viewport': {'width': 390, 'height': 844}, 'device_scale_factor': 3, 'is_mobile': True, 'has_touch': True}),
                           ('dark-390', {'viewport': {'width': 390, 'height': 844}, 'device_scale_factor': 3, 'is_mobile': True, 'has_touch': True, 'color_scheme': 'dark'})):
            c = new_ctx(at(11, 0), **opts)
            p = world(c, 'm3', '#home')
            if 'dark' in name:
                p.emulate_media(color_scheme='dark')
            p.wait_for_selector('#pm-card', timeout=15000)
            check(h.overflow(p) <= 0, '%s: no page overflow' % name)
            st = h.small_text(p)
            check(not st, '%s: no text under 11 px: %r' % (name, st[:3]))
            cols = p.evaluate('''() => [...document.querySelectorAll('#pm-card button[data-how], .pm-chip')].map(b => { const cs = getComputedStyle(b); return [cs.color, cs.backgroundColor]; })''')
            check(cols and all(a != b for a, b in cols), '%s: chip text differs from its background: %r' % (name, cols[:3]))
            cv = p.evaluate('''() => { const c = document.querySelector('#pm-card canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [c.width, r.width, devicePixelRatio]; }''')
            check(cv and abs(cv[0] - round(cv[1] * cv[2])) <= 2, '%s: the bot canvas is drawn at CSS size times DPR: %r' % (name, cv))
            if '390' in name:
                small = p.evaluate('''() => [...document.querySelectorAll('#pm-card button')].filter(b => b.offsetParent).map(b => [b.getBoundingClientRect().height, b.className, b.textContent.trim().slice(0, 24)]).filter(x => x[0] < 44)''')
                check(not small, '%s: phone buttons are at least 44 px tall: %r' % (name, small[:4]))
            if SHOTS:
                os.makedirs(SHOTS, exist_ok=True)
                p.screenshot(path=os.path.join(SHOTS, 'contract-pm-%s.png' % name), full_page=False)
            c.close()
        c = new_ctx(at(11, 0), viewport={'width': 3840, 'height': 2160})
        p = world(c, 'm3', '#home')
        p.wait_for_selector('#pm-card canvas', timeout=15000)
        cv = p.evaluate('''() => { const c = document.querySelector('#pm-card canvas'); const r = c.getBoundingClientRect(); return [c.width, r.width, devicePixelRatio]; }''')
        check(abs(cv[0] - round(cv[1] * cv[2])) <= 2, 'at 3840 wide the bot canvas stays sharp: %r' % cv)
        c.close()
        radar = open(os.path.join(ROOT, 'src', 'js', '75-radar.js'), encoding='utf-8').read()
        check("W.set('me/'" not in radar and 'W.set("me/' not in radar, 'the radar save never rewrites me/<uid> whole, so pm survives it')
    section('design', design)

    errs = [e for e in h.errors()]
    check(not errs, 'no console errors: %r' % errs[:3])
    if fails:
        raise AssertionError('%d of %d contract checks failed:\n - ' % (len(fails), len(fails) + len(passed)) + '\n - '.join(fails))
    return passed


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
