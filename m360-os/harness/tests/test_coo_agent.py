#!/usr/bin/env python3
"""v33 test: the m360 COO in voice and chat (56-z-agent.js), answered from its ledger with no model call.

A working Tuesday next week at 15:20 IST, the AI off (?noai=1), so a line that misses the grammar would
come back as "the AI is off" and never as an answer. The COO is on. Its ledger for today holds two rows:
at 15:00 it moved "Swisse reel cutdown" from Durvesh to Aanya (rebalance, why overload, the load check
9 against 6, undo until 15:00 tomorrow) and at 10:00 it approved Ishaan's casual leave next week (leave_ok).
Two cards wait on Kaavish: a client follow-up to Swisse with its draft (to and subject set), and Ekta's leave
outside policy.

Checks:
- every founder line parses to its action with no model call: "what needs me today", "what did you do
  today", "why did you move the Swisse reel cutdown", "why did you approve Ishaan's leave", "undo that",
  "undo the move of ...", "undo Ishaan's leave approval", "approve Ekta's leave", "send the Swisse follow-up",
  "COO stop", "pause the COO till Monday", "COO resume", "rebalance now"; through M.assistant.ask each comes
  back as a grammar answer;
- what needs me names both cards and opens #coo; what did you do today counts the rows;
- why answers with the line, the checks and their values, and "Say undo to put it back."; "undo that" then
  means that row, waits on a tap, and the tap puts the task back with Durvesh and settles the row undone;
- approve Ekta's leave makes a tap card "Approve Ekta's leave" that a strict spoken yes confirms; the
  Swisse follow-up reads the recipient and the subject back before the yes, and the yes sends it through
  M.coo.decide (the page opens it in the mail app);
- COO stop and the pause land at once (settings/app.coo.on false; pausedUntil is Monday 09:00 IST);
  COO resume and rebalance now wait on a tap;
- a member asks why the COO moved their own work and what it may do, and nothing else: no founder action,
  no needs or done read, no look_up coo;
- look_up 'coo' is the founder's only and hands back the cards and today's rows as data (and taints the turn);
- the two v32 taps that threw are fixed: bulk_tasks and decide_fix run when tapped;
- History filters to the COO's runs.

Until builder 1's M.coo is merged, a small stand-in reads the same seeded documents (coo/L-<today>,
coo/dec, settings/app.coo) and keeps the contract's names; with the real M.coo the same checks run on it.

Run: cd m360-os && python3 harness/tests/test_coo_agent.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4 = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4'
BOT = 'u_m360coo'
SHOTS = os.environ.get('COO_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'coo')

# the contract's M.coo, read from the same documents, for a page that does not carry builder 1's module yet
COO_STANDIN = r'''() => {
  if (M.coo && M.coo.feed) return 'real';
  const UID = 'u_m360coo';
  const ist = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
  const L = () => (window.__db.get('coo/L-' + ist(Date.now())) || {}).acts || {};
  const rows = () => Object.keys(L()).map(id => ({...L()[id], id}));
  const dec = () => (window.__db.get('coo/dec') || {}).items || {};
  const task = id => ((M.lastCtx.coll.tasks.map[id]) || {}).title || 'a task';
  const first = u => ({u_m1: 'Durvesh', u_m2: 'Aanya', u_m3: 'Ishaan', u_m4: 'Ekta'})[u] || 'Someone';
  const COPY = {
    rebalance: a => 'Moved ' + task(a.task) + ' from ' + first(a.uid) + ' to ' + first(a.to) + '. ' + first(a.uid) + ' has ' + a.open + ' open, ' + a.over + ' overdue. Undo for 24 hours.',
    leave_ok: a => 'I approved ' + first(a.uid) + "'s leave. " + a.left + ' days left. Undo until Monday.'
  };
  window.__cooCalls = [];
  M.coo = {
    UID, isCoo: u => u === UID, title: () => 'm360 COO', on: ctx => !!(((ctx.settings || {}).coo || {}).on),
    JOBS: {J10: {station: 'calendar', cap: 'leave', label: 'Leave within policy'}, J31: {station: 'board', cap: 'rebalance', label: 'Rebalance'}},
    copy: (code, args, scope) => ({line: scope === 'team' ? 'Tidying the task board.' : (COPY[code] ? COPY[code](args || {}) : ''), why: (args || {}).why === 'overload' ? 'Evening out the load.' : ''}),
    feed: (ctx, since) => rows().filter(r => ['done', 'would', 'failed'].includes(r.status) && r.at > (since || 0))
      .map(r => ({id: r.id, at: r.at, job: r.job, code: r.code, station: r.station, args: r.args, why: r.why, status: r.status, undoUntil: r.status === 'done' && r.undo ? r.undo.until : 0, refs: r.refs})),
    why: (ctx, q) => rows().find(r => r.id === q) || null,
    decisions: ctx => ctx.isFounder ? Object.keys(dec()).map(id => ({...dec()[id], id})).filter(c => c.status === 'open') : [],
    charter: () => ({alone: 'What I do on my own: take the morning roll call.', tell: '', draft: 'What I only draft: client follow-ups.', propose: '',
      never: 'What I never do: move or pay money, decline leave, move a client deadline, mark work done, score anyone, delete anything.'}),
    health: () => ({status: 'on'}),
    async stop(ctx) { window.__cooCalls.push('stop'); await ctx.W.merge('settings/app', {coo: {on: false}}); return {ok: true, say: 'Stopped. Anything I did today can still be undone.'}; },
    async pause(ctx, until) { window.__cooCalls.push('pause'); await ctx.W.merge('settings/app', {coo: {pausedUntil: until}}); return {ok: true, say: 'Paused by you.'}; },
    async resume(ctx) { window.__cooCalls.push('resume'); await ctx.W.merge('settings/app', {coo: {on: true, pausedUntil: null}}); return {ok: true, say: 'Back on.'}; },
    async undo(ctx, id) {
      window.__cooCalls.push('undo ' + id);
      const r = rows().find(x => x.id === id);
      const t = ctx.coll.tasks.map[r.undo.task];
      if (!t || t.owner !== r.after.owner) return {ok: false, conflict: true, say: 'Could not undo. Someone changed it since.'};
      await M.tasks.save(ctx, r.undo.task, {owner: r.before.owner});
      await ctx.W.merge('coo/L-' + ist(Date.now()), {acts: {[id]: {status: 'undone'}}});
      return {ok: true, conflict: false, say: 'Put back with ' + first(r.before.owner) + '.'};
    },
    async decide(ctx, id, how) {
      window.__cooCalls.push('decide ' + id + ' ' + how);
      const c = dec()[id];
      if (how === 'send') window.open('mailto:' + c.payload.draft.to, '_blank', 'noopener');
      else if (c.payload.action === 'coo.approve_leave') await ctx.W.merge('leavedec/' + c.payload.input.uid, {d: {[c.payload.input.req]: {status: 'approved', at: Date.now(), by: ctx.uid}}});
      await ctx.W.merge('coo/dec', {items: {[id]: {status: 'done', decidedAt: Date.now(), decidedVia: how}}});
      return {ok: true, say: how === 'send' ? 'Opened in your mail app.' : 'Approved.'};
    },
    async rebalanceNow() { window.__cooCalls.push('rebalance'); return {rows: [], practice: false}; }
  };
  return 'stand-in';
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
    mon = (tue + timedelta(days=6)).isoformat()
    lv = (tue + timedelta(days=8)).isoformat()

    def at(hh, mm, day=0):
        return datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)

    def ms(hh, mm, day=0):
        return int(at(hh, mm, day).timestamp() * 1000)

    pg_ctx = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(pg_ctx)
    pg_ctx.clock.set_fixed_time(at(15, 20))
    pg = pg_ctx.new_page()
    pg.set_default_timeout(20000)
    pg.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    pg.add_init_script('window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };')

    def be(ident, hash='#home'):
        url = h.url(ident, hash, noai=True)
        if pg.url == url:
            pg.reload()
        else:
            pg.goto(url)
        h.ready(pg)
        pg.wait_for_function('() => !!(window.M && M.lastCtx && M.agent && M.lastCtx.activeMembers.length > 3)')
        pg.wait_for_timeout(500)
        mode = pg.evaluate(COO_STANDIN)
        if mode == 'real' and ident == 'founder':
            try:
                pg.wait_for_function('() => M.coo.decisions(M.lastCtx).length >= 2 && M.coo.feed(M.lastCtx, 0).length >= 2', timeout=20000)
            except Exception:
                raise AssertionError('the real M.coo never read the seeded coo/dec and coo/L-%s: check the founder subscriptions and the coo rules' % today)
        return mode

    # ---- the world ----
    pg.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(pg)
    pg.wait_for_function('() => !!window.__db.get("roster/team")')
    h.roster(pg, [M1, M2, M3, M4], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1'}, M3: {'pod': 'Pod 2'}, M4: {'pod': 'Pod 2', 'title': 'Ekta Shah'}})
    base = {'client': '', 'project': '', 'section': '', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': False,
            'subtasks': {}, 'comments': {}, 'created': ms(9, 0, -5), 'updated': ms(9, 0, -5), 'doneAt': None}
    h.seed_doc(pg, 'tasks/t_reel', {**base, 'title': 'Swisse reel cutdown', 'owner': M2, 'by': F, 'due': (tue + timedelta(days=3)).isoformat(), 'status': 'todo',
                                    'updated': ms(15, 0), 'updatedBy': BOT,
                                    'ownerLog': [{'from': M1, 'to': M2, 'by': BOT, 'at': ms(15, 0), 'why': 'overload'}],
                                    'comments': {'c1': {'by': BOT, 't': 'Moved to even out the load. Kaavish can undo this until 15:00 tomorrow.', 'at': ms(15, 0)}}})
    h.seed_doc(pg, 'tasks/t_ny', {**base, 'title': 'Nykaa carousel', 'owner': M1, 'by': F, 'due': (tue + timedelta(days=2)).isoformat(), 'status': 'todo'})
    h.seed_doc(pg, 'tasks/t_ny2', {**base, 'title': 'Nykaa stories', 'owner': M1, 'by': F, 'due': (tue + timedelta(days=4)).isoformat(), 'status': 'doing'})
    h.seed_doc(pg, 'leave/' + M3, {'reqs': [{'id': 'L9', 'from': lv, 'to': lv, 'type': 'casual', 'at': ms(9, 0, -2)}]})
    h.seed_doc(pg, 'leavedec/' + M3, {'d': {'L9': {'status': 'approved', 'at': ms(10, 0), 'by': BOT, 'why': 'leave', 'checks': [], 'snap': {'from': lv, 'to': lv, 'type': 'casual', 'days': 1}, 'undoUntil': ms(9, 0, 8)}}})
    h.seed_doc(pg, 'leave/' + M4, {'reqs': [{'id': 'L5', 'from': lv, 'to': (tue + timedelta(days=11)).isoformat(), 'type': 'casual', 'at': ms(11, 0)}]})
    yday = (tue - timedelta(days=1)).isoformat()
    h.seed_doc(pg, 'fixes/' + M1, {'reqs': {'fx1': {'kind': 'attendance', 'date': yday, 'field': 'in', 'want': '10:05', 'note': '', 'at': ms(12, 0), 'status': 'pending', 'decidedAt': None, 'decidedNote': ''}}})
    s = pg.evaluate('() => window.__db.get("settings/app") || {}')
    s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -9), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
    h.seed_doc(pg, 'settings/app', s)
    move = {'at': ms(15, 0), 'slot': 'r15', 'job': 'J31', 'cap': 'rebalance', 'rung': 'tell', 'code': 'rebalance', 'station': 'board', 'subject': 'task:t_reel',
            'args': {'task': 't_reel', 'uid': M1, 'to': M2, 'open': 9, 'over': 3, 'open2': 3, 'until': ms(15, 0, 1)},
            'refs': {'task': 't_reel', 'uid': M1, 'to': M2}, 'why': {'code': 'overload', 'args': {}},
            'checks': [{'k': 'load', 'ok': True, 'val': 9, 'limit': 6}, {'k': 'client', 'ok': True, 'val': 0, 'limit': 0}],
            'facts': [], 'before': {'owner': M1}, 'after': {'owner': M2}, 'told': [{'uid': M2, 'text': 'I handed you Swisse reel cutdown.', 'at': ms(15, 0)}],
            'undo': {'k': 'task', 'task': 't_reel', 'fields': ['owner'], 'until': ms(15, 0, 1)}, 'status': 'done'}
    leave = {'at': ms(10, 0), 'slot': 'w1000', 'job': 'J10', 'cap': 'leave', 'rung': 'tell', 'code': 'leave_ok', 'station': 'calendar', 'subject': 'leave:' + M3 + ':L9',
             'args': {'uid': M3, 'd1': lv, 'd2': lv, 'left': 5, 'out': 1, 'type': 'casual', 'until': ms(9, 0, 8)},
             'refs': {'uid': M3, 'req': 'L9'}, 'why': {'code': 'leave', 'args': {}},
             'checks': [{'k': 'balance', 'ok': True, 'val': 6, 'limit': 1}, {'k': 'notice', 'ok': True, 'val': 8, 'limit': 3}],
             'facts': [], 'before': {}, 'after': {'status': 'approved'}, 'told': [],
             'undo': {'k': 'leave', 'uid': M3, 'req': 'L9', 'until': ms(9, 0, 8)}, 'status': 'done'}
    h.seed_doc(pg, 'coo/L-' + today, {'acts': {'a_move': move, 'a_leave': leave}})
    card = lambda **k: {'rung': 'propose', 'why': '', 'recommend': '', 'checks': [], 'options': [], 'sources': [], 'urgent': False, 'by': BOT, 'at': ms(12, 0),
                        'expires': ms(12, 0, 3), 'status': 'open', 'money': False, **k}
    h.seed_doc(pg, 'coo/dec', {'items': {
        'c_mail': card(id='c_mail', kind='client_mail', rung='draft', title='Drafted a follow-up to Swisse. It waits for your tap.', code='client_mail', args={},
                       payload={'action': '', 'input': {}, 'draft': {'to': 'priya@swisse.example', 'cc': '', 'subject': 'Following up on the Swisse proposal', 'text': 'Hi Priya, a quick follow-up on our proposal.'}},
                       refs={'client': 'cl_sw'}, dedupe='client_mail:cl_sw:' + today),
        'c_leave': card(id='c_leave', kind='leave', title='Ekta asked for leave on ' + lv + '. It needs you.', code='leave_card', args={'uid': M4},
                        payload={'action': 'coo.approve_leave', 'input': {'uid': M4, 'req': 'L5', 'from': lv, 'to': (tue + timedelta(days=11)).isoformat()}, 'draft': None},
                        refs={'uid': M4, 'req': 'L5'}, dedupe='leave:' + M4 + ':L5', urgent=True)}})
    pg.wait_for_timeout(400)

    mode = be('founder')
    check(pg.evaluate('() => !M.lastCtx.sample'), 'the page runs with the AI off, so only the grammar can answer (M.coo: %s)' % mode)

    # ---- every line parses with no model call ----
    lines = {
        'what needs me today': ('coo_info', {'what': 'needs'}),
        'What did you do today?': ('coo_info', {'what': 'done'}),
        'why did you move the Swisse reel cutdown': ('coo_why', {'subject': 'the swisse reel cutdown'}),
        "Why did you approve Ishaan's leave?": ('coo_why', {'person': 'ishaan', 'kind': 'leave'}),
        'undo the move of the Swisse reel cutdown': ('coo_undo', {'task': 'the swisse reel cutdown'}),
        "undo Ishaan's leave approval": ('coo_undo', {'person': 'ishaan', 'kind': 'leave'}),
        "approve Ekta's leave": ('coo_decide', {'person': 'ekta', 'kind': 'leave', 'how': 'apply'}),
        'send the Swisse follow-up': ('coo_decide', {'card': 'swisse follow up', 'kind': 'mail', 'how': 'send'}),
        'COO stop': ('coo_stop', {}),
        'pause the COO till Monday': ('coo_pause', {'until': 'monday'}),
        'COO resume': ('coo_resume', {}),
        'rebalance now': ('coo_rebalance_now', {}),
        'what can the COO do': ('coo_info', {'what': 'can'}),
    }
    got = pg.evaluate('xs => Object.fromEntries(xs.map(s => [s, M.agent.route(s, M.lastCtx).grammar]))', list(lines))
    for s_, (a, i) in lines.items():
        check(got[s_] == {'action': a, 'input': i}, '"%s" parses to %s %r: %r' % (s_, a, i, got[s_]))
    plain = pg.evaluate('() => M.agent.parse("undo that", M.lastCtx)')
    check(plain == {'action': 'undo', 'input': {'id': 'last'}}, 'with no COO row discussed, undo that stays the agent\'s own: %r' % plain)

    ask = 'async s => { const r = await M.assistant.ask(M.lastCtx, s, {via: "typed"}); return {text: r.text, grammar: !!r.grammar, waiting: !!r.waiting, err: r.err || "", coo: !!r.coo}; }'
    needs = pg.evaluate(ask, 'what needs me today')
    check(needs['grammar'] and not needs['err'] and needs['text'].startswith('2 things need you') and 'Swisse' in needs['text'] and 'Ekta' in needs['text'], 'what needs me today, from the cards: %r' % needs)
    check(needs['coo'], 'the panel marks the answer as the COO\'s')
    pg.wait_for_timeout(300)
    check(pg.evaluate('() => location.hash').startswith('#coo'), 'and it opens the COO tab')
    done = pg.evaluate(ask, 'what did you do today')
    check(done['grammar'] and done['text'].startswith('2 things today') and 'can still be undone' in done['text'], 'what did you do today: %r' % done)

    why = pg.evaluate(ask, 'why did you move the Swisse reel cutdown')
    check(why['grammar'] and 'load 9 (limit 6)' in why['text'] and why['text'].endswith('Say undo to put it back.'), 'why, with the checks and Undo: %r' % why)
    check('Durvesh' in why['text'] and 'Aanya' in why['text'], 'in the COO\'s own words: %r' % why['text'])
    that = pg.evaluate('() => M.agent.parse("undo that", M.lastCtx)')
    check(that == {'action': 'coo_undo', 'input': {'act': 'a_move'}}, 'after a why, undo that is that row: %r' % that)
    u = pg.evaluate('''async () => { const r = await M.assistant.ask(M.lastCtx, "undo that", {via: "voice"});
      const p = M.brain.pending.list[M.brain.pending.list.length - 1];
      return {text: r.text, grammar: !!r.grammar, waiting: !!r.waiting, label: p && p.label, id: p && p.id}; }''')
    check(u['grammar'] and u['waiting'] and u['label'] == 'Put Swisse reel cutdown back', 'undo waits on a tap: %r' % u)
    check(pg.evaluate('() => window.__db.get("tasks/t_reel").owner') == M2, 'nothing moved before the tap')
    r = pg.evaluate('id => M.brain.approve(id)', u['id'])
    pg.wait_for_function('() => window.__db.get("tasks/t_reel").owner === "u_m1"')
    row = pg.evaluate('d => window.__db.get("coo/L-" + d).acts.a_move.status', today)
    check(row == 'undone' and r.get('ok'), 'the tap puts the task back with Durvesh and the row reads undone: %r %r' % (row, r))

    lw = pg.evaluate(ask, "why did you approve Ishaan's leave")
    check(lw['grammar'] and 'balance 6 (limit 1)' in lw['text'] and 'Say undo to put it back.' in lw['text'], 'why the leave was approved: %r' % lw)
    ul = pg.evaluate('''async () => { const r = await M.agent.runGrammar(M.lastCtx, null, M.agent.parse("undo Ishaan's leave approval", M.lastCtx), {id: "tl", via: "typed"});
      const p = M.brain.pending.list.find(x => x.turn === "tl"); if (p) M.brain.drop(p.id); return {waiting: !!r.waiting, label: p && p.label}; }''')
    check(ul['waiting'] and ul['label'] == "Undo Ishaan's leave approval", 'undoing a leave approval waits on a tap: %r' % ul)

    # ---- approve a leave and send a draft: the card's own tap, a spoken yes ----
    al = pg.evaluate('''async () => { const c = M.lastCtx; const r = await M.agent.runGrammar(c, null, M.agent.parse("approve Ekta's leave", c), {id: "tv", via: "voice"});
      const p = M.brain.pending.list.find(x => x.turn === "tv");
      return {text: r.text, label: p && p.label, yes: M.agent.yesFor(c, "yes", {turn: "tv"}), id: p && p.id}; }''')
    check(al['label'] == "Approve Ekta's leave" and al['yes'] == al['id'], 'approve Ekta\'s leave is one card a spoken yes confirms: %r' % al)
    pg.evaluate('id => M.brain.approve(id, "voice")', al['id'])
    pg.wait_for_function('() => ((window.__db.get("coo/dec").items.c_leave) || {}).status === "done"')
    dec = pg.evaluate('() => ((window.__db.get("leavedec/u_m4") || {}).d || {}).L5 || null')
    check(dec and dec['status'] == 'approved' and dec.get('by') == F, 'Kaavish approved it as himself: %r' % dec)
    sm = pg.evaluate('''async () => { const c = M.lastCtx; const r = await M.agent.runGrammar(c, null, M.agent.parse("send the Swisse follow-up", c), {id: "ts", via: "voice"});
      const p = M.brain.pending.list.find(x => x.turn === "ts");
      return {text: r.text, label: p && p.label, detail: p && p.detail, yes: M.agent.yesFor(c, "send it", {turn: "ts"}), id: p && p.id}; }''')
    check(sm['text'] == 'It goes to priya@swisse.example, subject "Following up on the Swisse proposal". Say yes to send.', 'the draft reads its recipient and subject back first: %r' % sm['text'])
    check(sm['label'] == 'Send to priya@swisse.example' and 'Following up on the Swisse proposal' in sm['detail'] and sm['yes'] == sm['id'], 'one card, a yes confirms it: %r' % sm)
    check(not pg.evaluate('() => window.__opened.length'), 'nothing left before the yes')
    pg.evaluate('id => M.brain.approve(id, "voice")', sm['id'])
    pg.wait_for_function('() => window.__opened.length === 1')
    check(pg.evaluate('() => window.__opened[0]').startswith('mailto:priya@swisse.example'), 'the yes opens it from Kaavish\'s own mail')

    # ---- the kill switch at once, resume and rebalance on a tap ----
    st = pg.evaluate(ask, 'COO stop')
    pg.wait_for_function('() => window.__db.get("settings/app").coo.on === false')
    check(st['grammar'] and not st['waiting'] and st['text'].startswith('Stopped'), 'COO stop lands at once: %r' % st)
    pz = pg.evaluate(ask, 'pause the COO till Monday')
    want = int(datetime.fromisoformat(mon + 'T09:00:00+05:30').timestamp() * 1000)
    pg.wait_for_function('w => window.__db.get("settings/app").coo.pausedUntil === w', arg=want)
    check(pz['grammar'] and not pz['waiting'], 'the pause lands at once, until Monday 09:00 IST: %r' % pz)
    until = pg.evaluate('() => [M.agent.cooUntil("tomorrow"), M.agent.cooUntil("till 4"), M.agent.cooUntil("next week"), M.agent.cooUntil("someday")]')
    check(until[0] == ms(9, 0, 1) and until[1] == ms(16, 0) and until[2] == ms(9, 0, 6) and until[3] is None, 'pause times read in IST: %r' % until)
    rs = pg.evaluate('''async () => { const r = await M.assistant.ask(M.lastCtx, "COO resume", {via: "typed"}); const p = M.brain.pending.list[M.brain.pending.list.length - 1];
      return {waiting: !!r.waiting, label: p && p.label, id: p && p.id}; }''')
    check(rs['waiting'] and rs['label'] == 'Switch the COO back on' and pg.evaluate('() => window.__db.get("settings/app").coo.on') is False, 'COO resume waits on a tap: %r' % rs)
    pg.evaluate('id => M.brain.approve(id)', rs['id'])
    pg.wait_for_function('() => window.__db.get("settings/app").coo.on === true')
    rb = pg.evaluate('''async () => { const r = await M.assistant.ask(M.lastCtx, "rebalance now", {via: "typed"}); const p = M.brain.pending.list[M.brain.pending.list.length - 1];
      if (p) M.brain.drop(p.id); return {waiting: !!r.waiting, label: p && p.label}; }''')
    check(rb['waiting'] and rb['label'] == 'Rebalance the load now', 'rebalance now waits on a tap: %r' % rb)

    # ---- look_up coo: the founder's, as data ----
    lk = pg.evaluate('''async () => { const c = M.lastCtx, nm = await M.ai.names(c), turn = {id: "tk", via: "typed"}, t = M.brain.tools(c, nm, null, turn);
      const look = t.find(x => x.name === "look_up"), act = t.find(x => x.name === "act");
      const text = await look.execute({what: "coo"});
      return {text, tainted: !!turn.tainted, listed: act.description.indexOf("coo_stop (") >= 0 && act.description.indexOf("coo_why (") >= 0, len: act.description.length,
        areas: M.brain.areasFor(c).map(a => a[0]).includes("coo")}; }''')
    check(lk['text'].startswith('DATA FROM COO') and 'WAITING ON YOU' in lk['text'] and 'TODAY: ' in lk['text'] and 'act a_leave' in lk['text'], 'look_up coo hands back the cards and today\'s rows: %r' % lk['text'][:300])
    check(lk['tainted'] and lk['areas'] and lk['listed'] and lk['len'] < 3600, 'it taints the turn, and the act tool lists the COO actions in %d characters' % lk['len'])

    # ---- the two v32 taps that threw ----
    bt = pg.evaluate('''async () => { const r = await M.agent.exec(M.lastCtx, null, "bulk_tasks", {filter: {owner: "Durvesh"}, change: {priority: "high"}}, {turn: {id: "tb", via: "typed"}});
      const out = await M.brain.approve(r.id); await new Promise(x => setTimeout(x, 500));
      return {say: out && out.say, p: ["t_ny", "t_ny2"].map(id => window.__db.get("tasks/" + id).priority)}; }''')
    check(bt['p'] == ['high', 'high'] and bt['say'].startswith('Changed '), 'bulk_tasks runs on its tap: %r' % bt)
    fx = pg.evaluate('''async () => { const r = await M.agent.exec(M.lastCtx, null, "decide_fix", {person: "Durvesh", decision: "approve"}, {turn: {id: "tf", via: "typed"}});
      const out = await M.brain.approve(r.id); await new Promise(x => setTimeout(x, 500));
      return {say: out && out.say, st: window.__db.get("fixes/u_m1").reqs.fx1.status}; }''', )
    check(fx['st'] == 'approved' and fx['say'] == 'Approved and applied.', 'decide_fix runs on its tap: %r' % fx)

    # ---- History narrows to the COO ----
    pg.evaluate('() => M.assistant.open("")')
    pg.wait_for_timeout(600)
    opened = pg.evaluate('''() => { const b = [...document.querySelectorAll("[id$=more]")].find(x => x.offsetParent); if (!b) return false; b.click(); return true; }''')
    if opened:
        pg.wait_for_timeout(200)
        pg.evaluate('''() => { const b = [...document.querySelectorAll("[id$=history-btn]")].find(x => x.offsetParent); if (b) b.click(); }''')
    pg.wait_for_selector('#agent-history-filter', timeout=10000)
    pg.locator('#agent-history-filter .seg-btn', has_text='COO').first.click()
    pg.wait_for_timeout(300)
    acts = pg.evaluate('() => [...document.querySelectorAll("#agent-history .agent-run")].map(r => [...r.querySelectorAll(".agent-act")].map(a => a.dataset.action))')
    check(pg.evaluate('() => document.querySelector("#agent-history").dataset.filter') == 'coo' and acts and all(any(a.startswith('coo_') for a in run_) for run_ in acts),
          'History shows only the COO runs: %r' % acts[:4])
    os.makedirs(SHOTS, exist_ok=True)
    pg.screenshot(path=os.path.join(SHOTS, 'agent-history-coo.png'))
    pg.keyboard.press('Escape')

    # ---- a member: their own work and the charter, nothing else ----
    be('m1')
    mem = pg.evaluate('''async () => { const c = M.lastCtx, p = s => M.agent.parse(s, c), run = (a, i) => M.agent.exec(c, null, a, i).then(r => r.say || "ran", e => "ERR " + e.message);
      const names = M.agent.actionsFor(c).map(a => a.name);
      return {mine: p("why did the COO move my task"), can: p("what can the COO do"), needs: p("what needs me today"), stop: p("COO stop"),
        founderish: names.filter(n => /^coo_/.test(n)), r1: await run("coo_info", {what: "mine"}), r2: await run("coo_info", {what: "needs"}), r3: await run("coo_stop", {}),
        r4: await run("coo_info", {what: "can"}), look: await M.brain.lookUp(c, {}, "coo", ""), areas: M.brain.areasFor(c).map(a => a[0]).includes("coo")}; }''')
    check(mem['mine'] == {'action': 'coo_info', 'input': {'what': 'mine'}} and mem['can'] == {'action': 'coo_info', 'input': {'what': 'can'}}, 'a member\'s two lines parse: %r' % mem)
    check(mem['needs'] is None or mem['needs']['action'] != 'coo_info', 'what needs me is not a COO read for a member: %r' % mem['needs'])
    check(mem['stop'] is None and mem['founderish'] == ['coo_info'], 'no founder control for a member: %r' % mem)
    check('Swisse reel cutdown' in mem['r1'] and 'handed it to Aanya' in mem['r1'] and 'ask Kaavish' in mem['r1'], 'why the COO moved my task, from the task log: %r' % mem['r1'])
    check(mem['r2'].startswith('ERR that is Kaavish') and mem['r3'].startswith('ERR only the founder'), 'the founder\'s reads and controls are refused: %r' % [mem['r2'], mem['r3']])
    check('What I never do' in mem['r4'] and 'Kaavish reads what you send it' in mem['r4'], 'what the COO can do, the charter: %r' % mem['r4'])
    check(not mem['areas'] and 'Kaavish' in mem['look'] and 'WAITING' not in mem['look'], 'look_up coo is the founder\'s only: %r' % mem['look'])

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
