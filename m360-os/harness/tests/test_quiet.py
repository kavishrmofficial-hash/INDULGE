#!/usr/bin/env python3
"""v30 test: quiet stretches, the automated idle flag.

m2 leads Pod 1, so m1 reports to m2; m3 is named as reporting to m2 and is on approved leave. On a
working Tuesday next week m1 checks in at 10:30. The stamp writer: m1 adds a task from Home at 10:40
and me/u_m1.act[today]['1040'] is 1, written once; a second save and a focus tick in the same bucket
write nothing; a pulse and a profile write never stamp; the day ten days back leaves act with the
first stamp; a pulse, its private mark and a chat read mark never stamp, and the pulse and its mark
leave no log line; a save at 10:47 stamps '1045'. A profile that does not exist yet is created by its first
stamp, a focus tick stamps 0 and a save in that bucket turns it to 1, and a refused stamp stops the
tries for the visit. A view-as preview writes nothing.

The watch: at 14:40 m2's Your team carries a hot quiet flag for m1, "Nothing recorded on m360 since
10:50 (2h 50m so far, lunch aside)", with m1's status, and the inbox holds it once, timed at 12:50 when
it ran past two hours. m1 saves at 14:45: the same stretch closes, "from 10:50 to 14:45 (2h 55m, lunch
aside)", with the same inbox key, still once. settings.quietMins 60 adds the running stretch since
14:50; rule R17 off takes every quiet flag away. At 21:00 the open stretch closes at the EOD cut, and a
check-out at 17:00 ends the window there. m3 on leave carries no quiet flag.

The engine (M.quiet, through page.evaluate): leave, a holiday, a Sunday and a day without a check-in
carry no stretch; a focus session and running focus buckets cover their span; check-out, the EOD cut,
a past day, now before check-in and a check-in after the cut; the threshold, its clamp and R17; marks
before check-in and overlapping; the five-minute grid keeps a stretch's start whichever mark of a bucket
arrives; the moment a stretch passes the threshold, lunch paused, also for one that starts inside lunch;
a manager's sign-off never counts as the owner's activity; a focus session longer than any timer covers
no more than three hours; only today's status rides along; the log reader; and the watch for twenty
people over two thousand tasks stays quick.

Run: cd m360-os && python3 harness/tests/test_quiet.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}


def new_ctx(h, fixed):
    ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(ctx)
    ctx.clock.set_fixed_time(fixed)
    return ctx


def open_page(h, ctx, ident, hash, **params):
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hash, **params))
    h.ready(page)
    return page


def flags(page, uid):
    return page.evaluate('u => [...document.querySelectorAll("#team-" + u + " .team-flag")].map(f => [f.dataset.k, f.dataset.hot, f.textContent.replace(/Open$/, "").trim()])', uid)


def quiet(page, uid):
    return [f for f in flags(page, uid) if f[0] == 'quiet']


def inbox_quiet(page, uid):
    return page.evaluate('u => M.inbox.items(M.lastCtx).filter(i => i.id.startsWith("team:" + u + ":quiet")).map(i => [i.id, i.at, i.hot, i.plain(x => x)])', uid)


def act(page, uid, day):
    return page.evaluate('([u, d]) => (((window.__db.get("me/" + u) || {}).act) || {})[d] || null', [uid, day])


def me_writes(page, uid):
    return page.evaluate('u => window.__dbWrites.filter(w => w.path === "me/" + u).length', uid)


ENGINE = r'''([today, sunday, monday]) => {
  const base = M.lastCtx, U = M.U, uid = 'u_m1';
  const mk = o => {
    const day = o.day || today;
    const dd = U.parseYmd(day).getTime(), tt = (h, m) => dd + (h * 60 + m) * 60000;
    const td = U.parseYmd(today).getTime();
    const ci = o.in === null ? {} : {[day]: {in: tt(...(o.in || [10, 30])), out: o.out ? tt(...o.out) : null, mode: 'office'}};
    const a = {};
    for (const [h, m, v] of (o.act || [])) a[U.pad(h) + U.pad(m)] = v == null ? 1 : v;
    const tasks = {};
    (o.tasks || []).forEach(([h, m], i) => { tasks['e' + i] = {title: 'x', owner: 'u_m2', by: uid, created: tt(h, m), status: 'todo'}; });
    (o.comments || []).forEach(([h, m], i) => { tasks['c' + i] = {title: 'y', owner: 'u_m2', by: 'u_m2', created: tt(9, 0) - 86400000, status: 'todo', comments: {k: {by: uid, at: tt(h, m), text: 'ok'}}}; });
    /* [review h, m], [done h, m], who signed it off */
    (o.done || []).forEach(([r, d, who], i) => { tasks['d' + i] = {title: 'z', owner: uid, by: uid, created: tt(9, 0) - 86400000, status: 'done', reviewAt: tt(...r), doneAt: tt(...d), approvedBy: who, approvedAt: tt(...d)}; });
    const coll = {...base.coll, checkin: {map: {[uid]: {days: ci}}},
      me: {map: {[uid]: {act: {[day]: a}, focus: {sessions: (o.focus || []).map(([h, m, mins]) => ({at: tt(h, m), mins}))}, status: o.status ? {text: o.status[0], at: tt(...o.status[1]) + (o.status[2] || 0) * 86400000} : null}}},
      eod: {map: {}}, feed: {map: {}}, kudos: {map: {}}, tasks: {map: tasks}};
    const s = o.settings || {};
    const settings = {...base.settings, ...s, rules: {...base.settings.rules, ...(s.rules || {})}};
    const nowAt = o.now ? (o.nowDay === 'today' ? td + (o.now[0] * 60 + o.now[1]) * 60000 : tt(...o.now)) : Date.now();
    return {...base, coll, settings, now: nowAt, onLeave: () => !!o.leave, holidays: new Set(o.holiday ? [day] : [])};
  };
  const run = o => {
    const c = mk(o), r = M.quiet.day(c, uid, o.day || today);
    return {n: r.stretches.length, s: r.stretches.map(x => [U.hhmm(x.from), U.hhmm(x.to), Math.round(x.quietMs / 60000), x.live, U.hhmm(x.at)]),
      from: r.from, on: r.on, mins: r.mins, live: !!r.live, idle: r.idle ? U.hhmm(r.idle.from) : null, kinds: r.marks.map(x => x.k), status: r.status};
  };
  const out = {
    gap: run({act: [[10, 40], [10, 45]], now: [14, 40]}),
    leave: run({act: [[10, 40]], now: [16, 0], leave: true}),
    holiday: run({act: [[10, 40]], now: [16, 0], holiday: true}),
    sunday: run({day: sunday, act: [[10, 40]], now: [16, 0]}),
    noin: run({in: null, act: [[10, 40]], now: [16, 0]}),
    nofocus: run({now: [13, 10]}),
    focus: run({focus: [[13, 0, 90]], now: [13, 10]}),
    running: run({act: [[10, 35, 0], [10, 40, 0], [10, 45, 0], [10, 50, 0], [10, 55, 0], [11, 0, 0], [11, 5, 0], [11, 10, 0], [11, 15, 0], [11, 20, 0], [11, 25, 0], [11, 30, 0], [11, 35, 0], [11, 40, 0], [11, 45, 0], [11, 50, 0], [11, 55, 0], [12, 0, 0], [12, 5, 0], [12, 10, 0], [12, 15, 0], [12, 20, 0], [12, 25, 0], [12, 30, 0], [12, 35, 0], [12, 40, 0]], now: [12, 50]}),
    outEarly: run({out: [12, 0], now: [16, 0]}),
    outLate: run({out: [15, 0], now: [18, 0]}),
    nout: run({now: [16, 0]}),
    cut: run({act: [[16, 0]], now: [21, 0]}),
    past: run({day: monday, act: [[16, 0]], now: [10, 0], nowDay: 'today'}),
    before: run({now: [10, 0]}),
    lateIn: run({in: [20, 0], now: [22, 0]}),
    t120: run({act: [[10, 40], [12, 0]], now: [12, 30]}),
    t60: run({act: [[10, 40], [12, 0]], now: [12, 30], settings: {quietMins: 60}}),
    clampLo: run({now: [11, 10], settings: {quietMins: 5}}),
    clampHi: run({now: [12, 0], settings: {quietMins: 9999}}),
    r17: run({act: [[10, 40]], now: [16, 0], settings: {rules: {R17: false}}}),
    overlap: run({focus: [[11, 0, 90]], act: [[10, 55], [10, 50]], now: [13, 20]}),
    pointOnly: run({tasks: [[10, 47]], now: [14, 40]}),
    stampOnly: run({act: [[10, 45]], now: [14, 40]}),
    both: run({act: [[10, 45]], tasks: [[10, 47]], now: [14, 40]}),
    comment: run({comments: [[10, 51]], now: [14, 40]}),
    lunchBefore: run({act: [[11, 55]], now: [14, 50]}),
    lunchCross: run({act: [[11, 55]], now: [15, 10]}),
    lunchIn: run({act: [[13, 40]], now: [16, 50]}),
    approved: run({done: [[[10, 42], [13, 0], 'u_m2']], now: [14, 40]}),
    selfDone: run({done: [[[10, 42], [13, 0], uid]], now: [14, 40]}),
    focusBad: run({focus: [[19, 0, 5400000]], now: [19, 0]}),
    statusToday: run({status: ['At the shoot', [9, 50]], now: [14, 40]}),
    statusOld: run({status: ['At the shoot', [18, 0], -1], now: [14, 40]}),
    dur: [M.quiet.dur(50 * 60000), M.quiet.dur(225 * 60000), M.quiet.dur(60 * 60000)],
    cfg: M.quiet.cfg({settings: {quietMins: '90', lunchFrom: '13:00', lunchTo: '14:00', rules: {}}}),
    cfgBad: M.quiet.cfg({settings: {quietMins: 'x', lunchFrom: '14:00', lunchTo: '13:00', rules: {R17: true}}}),
    week: M.quiet.week(mk({act: [[10, 45]], now: [14, 40]}), uid, today, {}).map(d => [d.ymd, d.stretches.length, Math.round(d.total / 60000), Math.round(d.longest / 60000)])
  };
  const td = U.parseYmd(today).getTime(), at = (h, m) => td + (h * 60 + m) * 60000;
  out.log = M.quiet.fromLog({[today + '-u_m1']: {e: {
    a: {at: at(11, 0), a: 'set', p: 'tasks/x'}, b: {at: at(11, 1), a: 'login', p: ''}, c: {at: at(11, 2), a: 'update', p: 'me/u_m1'},
    d: {at: at(11, 3), a: 'update', p: 'data/users/u_m1/state'}, e: {at: at(11, 4), a: 'set', p: 'data/users/u_m1/notes'},
    f: {at: at(11, 5), a: 'set', p: 'pulse/x'}, g: {at: at(11, 6), a: 'set', p: 'play/u_m1'}}}});
  out.logAt = [at(11, 0), at(11, 4)];
  out.extra = run({now: [14, 40]});
  out.extraLog = (() => { const c = mk({now: [14, 40]}); const r = M.quiet.day(c, uid, today, {extra: [at(12, 2)]}); return r.stretches.map(x => [U.hhmm(x.from), U.hhmm(x.to), x.live]); })();
  /* twenty people reporting to one lead, two thousand tasks with comments: the board and the inbox stay quick */
  const members = {u_founder: base.members.u_founder, u_m2: base.members.u_m2}, checkin = {}, me = {};
  for (let i = 0; i < 20; i++) {
    const u = 'u_p' + i;
    members[u] = {role: 'member', empId: 'M360-' + (100 + i), pod: 'Pod 1', active: true, reportsTo: 'u_m2'};
    checkin[u] = {days: {[today]: {in: at(10, 30), out: null, mode: 'office'}}};
    me[u] = {act: {[today]: {'1040': 1, '1045': 1}}};
  }
  const tasks = {};
  for (let i = 0; i < 2000; i++) {
    const u = 'u_p' + (i % 20), cs = {};
    for (let j = 0; j < 3; j++) cs['c' + i + '_' + j] = {by: 'u_p' + ((i + j) % 20), at: at(9, 0) - j * 3600000, text: 'ok'};
    tasks['t' + i] = {title: 'Task ' + i, owner: u, by: 'u_m2', status: i % 3 ? 'todo' : 'done', due: today, created: at(9, 0) - 86400000 * (i % 9), updated: at(9, 0) - 86400000, comments: cs};
  }
  const big = {...base, members, activeMembers: Object.keys(members).map(k => ({uid: k, ...members[k]})),
    coll: {...base.coll, checkin: {map: checkin}, me: {map: me}, tasks: {map: tasks, trash: {}}, eod: {map: {}}}, now: at(14, 40)};
  let t0 = performance.now();
  const board = M.lines.board(big, 'u_m2');
  const first = performance.now() - t0;
  t0 = performance.now();
  for (let k = 0; k < 10; k++) M.lines.board({...big, now: at(14, 41 + k)}, 'u_m2');
  const again = (performance.now() - t0) / 10;
  t0 = performance.now();
  for (let k = 0; k < 10; k++) M.inbox.items({...big, uid: 'u_m2'});
  const inbox = (performance.now() - t0) / 10;
  out.perf = {people: board.length, quiet: board.filter(r => r.flags.some(f => f.k === 'quiet')).length, first, again, inbox};
  return out;
}'''


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()

    def at(hh, mm):
        return datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST)

    def ms(hh, mm, day=0):
        return int((at(hh, mm) + timedelta(days=day)).timestamp() * 1000)

    old = (tue - timedelta(days=10)).isoformat()
    recent = (tue - timedelta(days=3)).isoformat()

    # ---- the workspace: m1 and m3 report to m2, m3 on approved leave today, m1 in at 10:30 ----
    # One page walks every identity in turn: each page keeps the mock store in memory and writes it back
    # whole, so two pages open at once can overwrite each other's saves.
    ctx = new_ctx(h, at(10, 20))
    pg = open_page(h, ctx, 'founder', '#home', reset=True, seed=True)

    def be(ident, hash='#home', **params):
        url = h.url(ident, hash, **params)
        # the same address with a hash is no navigation at all: reload to read the store and the clock afresh
        if pg.url == url:
            pg.reload()
        else:
            pg.goto(url)
        h.ready(pg)
        pg.wait_for_timeout(500)

    # the founder's first open writes a roster of one; let it land before the roster below replaces it
    pg.wait_for_function('() => !!window.__db.get("roster/team")')
    pg.wait_for_timeout(300)
    h.roster(pg, [M1, M2, M3], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1', 'role': 'lead'}, M3: {'pod': 'Pod 2', 'reportsTo': M2}})
    for u in (F, M1, M2, M3):
        h.seed_doc(pg, 'checkin/' + u, {'days': {}})
        h.seed_doc(pg, 'eod/' + u, {'days': {}})
    h.seed_doc(pg, 'checkin/' + M1, {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
    h.seed_doc(pg, 'checkin/' + M3, {'days': {today: {'in': ms(10, 30), 'out': None, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}})
    h.seed_doc(pg, 'leave/' + M3, {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'kind': 'casual', 'note': 'family', 'at': ms(9, 0, -2)}]})
    h.seed_doc(pg, 'leavedec/' + M3, {'d': {'L1': {'status': 'approved', 'by': F, 'at': ms(9, 0, -1)}}})
    h.seed_doc(pg, 'me/' + M1, {'name': 'Durvesh Patil', 'act': {old: {'1000': 1}, recent: {'1100': 1}}})
    pg.evaluate('() => window.__db.del("me/u_m3")')
    base = pg.evaluate('() => window.__db.get("settings/app")')
    check(sorted(pg.evaluate('() => Object.keys(window.__db.get("roster/team").members)')) == [F, M1, M2, M3], 'the roster holds the four of them')

    # ---- view as: the founder's preview writes nothing ----
    be('founder')
    vw = pg.evaluate("""async () => {
      M.viewAs.set('u_m1');
      await new Promise(r => setTimeout(r, 400));
      const n = window.__dbWrites.length;
      let refused = false;
      try { await M.lastCtx.W.set('tasks/va1', {title: 'x', owner: 'u_m1', by: 'u_m1'}); } catch (e) { refused = true; }
      M.stamp(M.lastCtx.db, 'u_m1', 'tasks/va1');
      M.stamp(M.lastCtx.db, 'u_founder', 'tasks/va1');
      M.stamp(M.lastCtx.db, M.lastCtx.uid, null, true);
      await new Promise(r => setTimeout(r, 400));
      const after = window.__dbWrites.slice(n).map(w => w.path);
      M.viewAs.set(null);
      return {refused, after};
    }""")
    check(vw['refused'] and vw['after'] == [], 'view as stamps nothing: %r' % vw)

    # ---- the stamp writer, as m1: a task added on Home stamps 10:40 once ----
    ctx.clock.set_fixed_time(at(10, 40))
    be('m1', noai=True)
    pg.wait_for_selector('#quick-add')
    w0 = me_writes(pg, M1)
    pg.fill('#quick-add', 'Draft the Swisse captions')
    pg.keyboard.press('Enter')
    pg.wait_for_function('([u, d]) => ((((window.__db.get("me/" + u) || {}).act) || {})[d] || {})["1040"] === 1', arg=[M1, today])
    pg.wait_for_timeout(400)
    check(me_writes(pg, M1) - w0 == 1, 'a save stamps the profile once: %r' % (me_writes(pg, M1) - w0))
    a1 = pg.evaluate('u => (window.__db.get("me/" + u) || {}).act', M1)
    check(a1.get(old) is None and a1.get(recent) == {'1100': 1}, 'the day past the window goes, the recent one stays: %r' % a1)
    check(pg.evaluate('() => Object.values(window.__db.store()).some(t => t && t.title === "Draft the Swisse captions" && t.by === "u_m1")'), 'the task is saved')
    # a second save and a focus tick in the same bucket write nothing
    ctx.clock.set_fixed_time(at(10, 43))
    w0 = me_writes(pg, M1)
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.set('tasks/qt2', {title: 'Book the studio', owner: 'u_m1', by: 'u_m1', status: 'todo', created: Date.now(), updated: Date.now(), subtasks: {}, comments: {}});
      M.stamp(c.db, c.uid, null, true); }""")
    pg.wait_for_timeout(500)
    check(me_writes(pg, M1) - w0 == 0 and act(pg, M1, today) == {'1040': 1}, 'one write per bucket, a focus tick leaves saved work alone: %r' % act(pg, M1, today))
    # a pulse answer, its private mark, a chat read mark and a profile write never stamp; the pulse and
    # its mark leave no line in the log either, so nothing ties the anonymous answer to m1
    ctx.clock.set_fixed_time(at(10, 46))
    w0 = me_writes(pg, M1)
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.set('pulse/q' + Date.now(), {at: Date.now(), week: 'x', energy: 4});
      await c.W.merge('data/users/u_m1/state', {pulse: {x: true}});
      await c.W.merge('data/users/u_m1/state', {chatRead: {general: Date.now()}});
      await c.W.merge('me/u_m1', {status: {text: 'At the Blah Studio shoot', at: Date.now()}}); }""")
    pg.wait_for_timeout(500)
    check(me_writes(pg, M1) - w0 == 1 and '1045' not in (act(pg, M1, today) or {}), 'pulse, bookkeeping and profile writes leave no stamp: %r' % act(pg, M1, today))
    lines = pg.evaluate('([u, d]) => Object.values(((window.__db.get("log/" + u + "/days/" + d) || {}).e) || {}).filter(x => x.at === Date.now()).map(x => x.p)', [M1, today])
    check(sorted(lines) == ['data/users/u_m1/state', 'me/u_m1'], 'the pulse and its mark leave no log line, the read mark and the profile do: %r' % lines)
    # a save at 10:47, a focus tick right behind it before the snapshot lands: 1045 is saved work
    ctx.clock.set_fixed_time(at(10, 47))
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.set('tasks/qt3', {title: 'Cut the teaser', owner: 'u_m1', by: 'u_m1', status: 'todo', created: Date.now(), updated: Date.now(), subtasks: {}, comments: {}});
      M.stamp(c.db, c.uid, null, true); }""")
    pg.wait_for_timeout(500)
    check(act(pg, M1, today) == {'1040': 1, '1045': 1}, 'a focus tick in flight never overwrites saved work: %r' % act(pg, M1, today))

    # ---- m3: the first stamp creates the profile; focus 0, then saved work 1; a refusal stops the tries ----
    ctx.clock.set_fixed_time(at(11, 0))
    be('m3', noai=True)
    check(pg.evaluate('() => window.__db.get("me/u_m3") === undefined'), 'm3 has no profile yet')
    pg.evaluate('() => M.stamp(M.lastCtx.db, "u_m3", null, true)')
    pg.wait_for_function('() => ((((window.__db.get("me/u_m3") || {}).act) || {})[%r] || {})["1100"] === 0' % today)
    check(True, 'a focus tick creates the missing profile with a 0 bucket')
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.set('tasks/m3a', {title: 'Read the brief', owner: 'u_m3', by: 'u_m3', status: 'todo', created: Date.now(), updated: Date.now(), subtasks: {}, comments: {}}); }""")
    pg.wait_for_function('() => ((((window.__db.get("me/u_m3") || {}).act) || {})[%r] || {})["1100"] === 1' % today)
    pg.evaluate('() => M.stamp(M.lastCtx.db, "u_m3", null, true)')
    pg.wait_for_timeout(400)
    check(act(pg, M3, today) == {'1100': 1}, 'saved work outranks focus in its bucket: %r' % act(pg, M3, today))
    w0 = pg.evaluate('() => window.__dbWrites.length')
    pg.evaluate('() => M.stamp(M.lastCtx.db, "u_m1", "tasks/x")')
    pg.wait_for_timeout(400)
    check(pg.evaluate('() => window.__db.get("me/u_m1").act[%r]' % today) == {'1040': 1, '1045': 1}, 'a stamp on someone else is refused')
    ctx.clock.set_fixed_time(at(11, 6))
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.set('tasks/m3b', {title: 'Reply to Omar', owner: 'u_m3', by: 'u_m3', status: 'todo', created: Date.now(), updated: Date.now(), subtasks: {}, comments: {}}); }""")
    pg.wait_for_timeout(500)
    paths = pg.evaluate('n => window.__dbWrites.slice(n).map(w => w.path)', w0)
    check(act(pg, M3, today) == {'1100': 1} and 'tasks/m3b' in paths and not any(x.startswith('me/') for x in paths), 'after a refusal the visit stops stamping: %r %r' % (act(pg, M3, today), paths))

    # ---- 14:40: the manager's watch carries the running stretch, hot, and the inbox holds it once ----
    ctx.clock.set_fixed_time(at(14, 40))
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    q = quiet(pg, M1)
    want = 'Nothing recorded on m360 since 10:50 (2h 50m so far, lunch aside), status: At the Blah Studio shoot'
    check(len(q) == 1 and q[0][1] == '1' and q[0][2] == want, 'the live stretch on Your team: %r' % q)
    check(not quiet(pg, M3) and 'on leave' in pg.inner_text('#team-u_m3'), 'm3 on leave carries no quiet flag: %r' % flags(pg, M3))
    check(pg.evaluate('() => M.quiet.day(M.lastCtx, "u_m3", M.U.todayStr()).stretches.length') == 0, 'the engine agrees on leave')
    key = 'team:u_m1:quiet1050:' + today
    iq = inbox_quiet(pg, M1)
    check(len(iq) == 1 and iq[0][0] == key and iq[0][2] is True, 'the inbox holds the stretch once: %r' % iq)
    check(iq[0][1] == ms(12, 50), 'timed when it passed two hours: %r vs %r' % (iq[0][1], ms(12, 50)))
    check(not inbox_quiet(pg, M3), 'no quiet line for m3 in the inbox')
    pg.locator('.bellbtn').first.click()
    pg.wait_for_selector('.drawer')
    check(pg.inner_text('.drawer').count('nothing recorded on m360 since 10:50') == 1, 'the drawer says it once')
    pg.keyboard.press('Escape')
    pg.set_viewport_size({'width': 390, 'height': 844})
    pg.wait_for_timeout(300)
    check(h.overflow(pg) <= 0, 'no sideways scroll at 390 with the flag: %r' % h.overflow(pg))
    pg.set_viewport_size({'width': 1280, 'height': 900})

    # ---- 14:45: m1 saves; the stretch closes under the same key ----
    ctx.clock.set_fixed_time(at(14, 45))
    be('m1', noai=True)
    pg.evaluate("""async () => { const c = M.lastCtx;
      await c.W.update('tasks/qt3', {status: 'doing', updated: Date.now()}); }""")
    pg.wait_for_function('([u, d]) => ((((window.__db.get("me/" + u) || {}).act) || {})[d] || {})["1445"] === 1', arg=[M1, today])
    ctx.clock.set_fixed_time(at(14, 46))
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    q = quiet(pg, M1)
    want = 'Nothing recorded on m360 from 10:50 to 14:45 (2h 55m, lunch aside), status: At the Blah Studio shoot'
    check(len(q) == 1 and q[0][1] == '0' and q[0][2] == want, 'the stretch closes: %r' % q)
    iq = inbox_quiet(pg, M1)
    check(len(iq) == 1 and iq[0][0] == key and iq[0][1] == ms(12, 50) and iq[0][2] is False, 'same key, same moment, once: %r' % iq)
    pg.locator('.bellbtn').first.click()
    pg.wait_for_selector('.drawer')
    dr = pg.inner_text('.drawer')
    check(dr.count('nothing recorded on m360') == 1 and 'from 10:50 to 14:45' in dr, 'the drawer holds the closed line once')
    pg.keyboard.press('Escape')

    # ---- the threshold and the rule switch, from settings ----
    ctx.clock.set_fixed_time(at(16, 0))
    h.seed_doc(pg, 'settings/app', dict(base, quietMins=60))
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    q = quiet(pg, M1)
    check(len(q) == 2 and q[0][1] == '1' and q[1][1] == '1', 'an hour: the closed stretch and the running one, both hot: %r' % q)
    check(any('since 14:50 (1h 10m so far)' in t for _, _, t in q), 'the running stretch since 14:50: %r' % q)
    ids = sorted(i[0] for i in inbox_quiet(pg, M1))
    check(ids == [key, 'team:u_m1:quiet1450:' + today], 'two stretches, two lines: %r' % ids)
    h.seed_doc(pg, 'settings/app', dict(base, quietMins=60, rules=dict(base.get('rules') or {}, R17=False)))
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    check(not quiet(pg, M1) and not inbox_quiet(pg, M1), 'R17 off: no quiet flags: %r' % flags(pg, M1))
    h.seed_doc(pg, 'settings/app', base)

    # ---- 21:00: no check-out, the open stretch closes at the EOD cut; a check-out ends the window ----
    ctx.clock.set_fixed_time(at(21, 0))
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    q = quiet(pg, M1)
    check(len(q) == 2 and any('from 14:50 to 19:30 (4h 40m)' in t and hot == '1' for _, hot, t in q), 'the open stretch closes at the cut: %r' % q)
    check(any(k == 'noout' for k, _, _ in flags(pg, M1)), 'and no check-out is its own flag')
    h.seed_doc(pg, 'checkin/' + M1, {'days': {today: {'in': ms(10, 30), 'out': ms(17, 0), 'mode': 'office', 'loc': OFFICE, 'outLoc': OFFICE}}})
    be('m2')
    pg.wait_for_selector('#team-u_m1')
    q = quiet(pg, M1)
    check(len(q) == 2 and any('from 14:50 to 17:00 (2h 10m)' in t and hot == '0' for _, hot, t in q), 'the check-out ends the window: %r' % q)
    check(any(i[0] == 'team:u_m1:quiet1450:' + today for i in inbox_quiet(pg, M1)), 'the closed stretch keeps its key')

    # ---- the engine ----
    sunday = (tue + timedelta(days=5)).isoformat()
    monday = (tue - timedelta(days=1)).isoformat()
    e = pg.evaluate(ENGINE, [today, sunday, monday])
    check(e['gap']['s'] == [['10:50', '14:40', 170, True, '12:50']], 'the probe stretch: %r' % e['gap'])
    for k in ('leave', 'holiday', 'sunday', 'noin'):
        check(e[k]['n'] == 0, '%s carries no stretch: %r' % (k, e[k]))
    check(e['noin']['from'] is None, 'no check-in, no window')
    check(e['nofocus']['s'] == [['10:35', '13:10', 155, True, '12:35']] and e['focus']['n'] == 0, 'a focus session covers its span: %r / %r' % (e['nofocus'], e['focus']))
    check(e['running']['n'] == 0 and 'f' in e['running']['kinds'], 'running focus buckets cover theirs: %r' % e['running'])
    check(e['outEarly']['n'] == 0, 'a check-out at 12:00 ends the window: %r' % e['outEarly'])
    check(e['outLate']['s'] == [['10:35', '15:00', 205, False, '12:35']], 'a stretch closes at the check-out: %r' % e['outLate'])
    check(e['nout']['s'] == [['10:35', '16:00', 265, True, '12:35']], 'and runs on without one: %r' % e['nout'])
    check(e['cut']['s'] == [['10:35', '16:00', 265, False, '12:35'], ['16:05', '19:30', 205, False, '18:05']], 'the EOD cut closes the day: %r' % e['cut'])
    check(e['past']['s'][-1][1:4] == ['19:30', 205, False], 'a past day with no check-out closes at the cut: %r' % e['past'])
    check(e['before']['n'] == 0 and e['before']['idle'] is None, 'now before the check-in: %r' % e['before'])
    check(e['lateIn']['n'] == 0, 'a check-in after the cut: %r' % e['lateIn'])
    check(e['t120']['n'] == 0 and e['t60']['s'] == [['10:45', '12:00', 75, False, '11:45']], 'the threshold from settings: %r / %r' % (e['t120'], e['t60']))
    check(e['clampLo']['mins'] == 30 and e['clampLo']['s'] == [['10:35', '11:10', 35, True, '11:05']], 'the threshold floor is 30 minutes: %r' % e['clampLo'])
    check(e['clampHi']['mins'] == 480 and e['clampHi']['n'] == 0, 'and the ceiling 480: %r' % e['clampHi'])
    check(e['r17']['on'] is False and e['r17']['n'] == 0, 'R17 off switches the engine off: %r' % e['r17'])
    check(e['overlap']['s'] == [['11:00', '13:20', 140, True, '13:00']], 'marks before the check-in and overlapping ones: %r' % e['overlap'])
    for k in ('pointOnly', 'stampOnly', 'both'):
        check(e[k]['s'][0][0] == '10:50', 'the stretch starts on the bucket edge whichever mark arrives (%s): %r' % (k, e[k]))
    check(e['comment']['s'][0][0] == '10:55', 'a comment marks its bucket: %r' % e['comment'])
    check(e['lunchBefore']['n'] == 0 and e['lunchCross']['s'] == [['12:00', '15:10', 130, True, '15:00']], 'the lunch hour pauses the clock: %r / %r' % (e['lunchBefore'], e['lunchCross']))
    check(e['lunchIn']['s'] == [['10:35', '13:40', 175, False, '12:35'], ['13:45', '16:50', 140, True, '16:30']], 'a stretch that starts in the lunch hour counts from its end: %r' % e['lunchIn'])
    check(e['approved']['s'] == [['10:45', '14:40', 175, True, '12:45']], "a manager's sign-off is never the owner's activity: %r" % e['approved'])
    check(e['selfDone']['s'] == [['10:45', '13:00', 135, False, '12:45']], 'the owner finishing a task is: %r' % e['selfDone'])
    check(e['focusBad']['s'] == [['10:35', '16:00', 265, False, '12:35']], 'a focus session never covers more than the longest timer: %r' % e['focusBad'])
    check(e['statusToday']['status'] == 'At the shoot' and e['statusOld']['status'] == '', "only today's status rides along: %r / %r" % (e['statusToday']['status'], e['statusOld']['status']))
    check(e['dur'] == ['50m', '3h 45m', '1h 00m'], 'durations read short: %r' % e['dur'])
    check(e['cfg'] == {'on': True, 'mins': 90, 'lunch': [780, 840]} and e['cfgBad'] == {'on': True, 'mins': 120, 'lunch': None}, 'settings read safely: %r / %r' % (e['cfg'], e['cfgBad']))
    check(len(e['week']) == 1 and e['week'][0][:2] == [today, 1] and e['week'][0][2] == 170, 'the week view: %r' % e['week'])
    check(e['log'] == {'u_m1': {today: e['logAt']}}, 'the log reader keeps work and leaves sign-ins, profile, bookkeeping, pulse and play: %r' % e['log'])
    check(e['extra']['s'] == [['10:35', '14:40', 185, True, '12:35']] and e['extraLog'] == [], 'a log time splits the day for the founder: %r / %r' % (e['extra'], e['extraLog']))
    pf = e['perf']
    check(pf['people'] == 20 and pf['quiet'] == 20, 'twenty reports, each with a quiet stretch: %r' % pf)
    check(pf['first'] < 600 and pf['again'] < 120 and pf['inbox'] < 200, 'the watch stays quick: %r' % pf)

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
