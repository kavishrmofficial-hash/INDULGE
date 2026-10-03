#!/usr/bin/env python3
"""v32 contract test: the voice and chat commands (M.agent and M.brain), black box, from spec Parts F and L.

Written by the server builder against the contract alone, apart from builder 2's own test_agent.py. It
covers what spec Part M lists for test_agent.py through the public names: M.agent (ACTIONS, actionsFor,
parse, route, peopleWhere, runGrammar, isYes, isNo, undo, ledger), M.brain.tools(ctx, nm, log, turn),
M.brain.hold(label, detail, run, opts) with pending entries carrying {turn, at}, and M.tasks.save.

The roster: m1 (Durvesh) reports to Kaavish, m2 (Aanya) to m1, m3 (Ishaan) to m2. At 20:41 on a working
Tuesday m2 and m3 are still checked in and m1 checked out at 19:40.

1. The grammar, with ?noai=1 (no model at all): the founder's exact sentence parses to nudge_people
   {condition: noout, scope: everyone, ask: why}; "who hasn't checked in" reads people_where; "open
   the swisse project", "check me out", "start focus for 45", "undo that"; route() puts a bulk outward
   act on the default tier and a plain question on quick.
2. Rights: actionsFor hides change_setting, toggle_rule and set_reports_to from a member and shows them
   to the founder; peopleWhere for m3 (no reports) leaves everyone out as "not in your team"; m2 can
   reach m3; m1 (skip level) cannot ask m3 about attendance but can about overdue work.
3. Parity: update_task through the agent writes dueLog and keeps a shipped task's due date for a
   member; reassign_task refuses someone who neither owns nor made the task.
4. Taint: after look_up chat in a turn, send_message is held for a tap (a pending card), never sent.
5. Spoken yes: isYes and isNo hold to the strict grammar; pending cards carry their turn and the time; a
   yes approves only inside 15 seconds, only when exactly one card waits for the turn, and never when the
   mic opened before the agent stopped speaking (M.agent.yesFor).
6. The act tool's description lists every founder action by name and stays under 3,600 characters.
7. Undo: nudge_people run by the grammar writes an ask; undo('last') withdraws it.
8. Rights at run time: a member calling change_setting by hand, and then approving whatever waits, leaves
   the settings as they were.

Expected to fail until builder 2's 56-z-agent.js and the 56-brain.js changes are merged.

Run: cd m360-os && python3 harness/tests/test_contract_agent.py
"""
import os
import sys
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
NM = {F: 'Kaavish Ramchandani', M1: 'Durvesh Patil', M2: 'Aanya Mehta', M3: 'Ishaan Rao'}
SENTENCE = ("flag the people who haven't checked out from office and that basically pings them, DMs them, sends them a "
            "notification and sends them an update also saying why didn't it happen")


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

    def ms(hh, mm, day=0):
        return int((datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)).timestamp() * 1000)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(datetime(tue.year, tue.month, tue.day, 20, 41, tzinfo=IST))
    p = c.new_page()
    p.set_default_timeout(15000)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    p.wait_for_timeout(300)
    h.roster(p, [M1, M2, M3], extra={M1: {'pod': ''}, M2: {'pod': '', 'reportsTo': M1}, M3: {'pod': '', 'reportsTo': M2}})
    for u in (F, M1, M2, M3):
        h.seed_doc(p, 'eod/' + u, {'days': {}})
        p.evaluate('p => window.__db.del(p)', 'leave/' + u)
    h.seed_doc(p, 'checkin/' + F, {'days': {today: {'in': ms(10, 0), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + M1, {'days': {today: {'in': ms(11, 2), 'out': ms(19, 40), 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + M2, {'days': {today: {'in': ms(10, 8), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'checkin/' + M3, {'days': {today: {'in': ms(10, 31), 'out': None, 'mode': 'office'}}})
    h.seed_doc(p, 'tasks/ta', {'title': 'Hero reel script', 'owner': M3, 'by': M2, 'status': 'doing', 'due': (tue - timedelta(days=2)).isoformat(),
                               'created': ms(10, 0, -6), 'updated': ms(10, 0, -3)})
    h.seed_doc(p, 'tasks/tb', {'title': 'Nykaa carousel', 'owner': M2, 'by': M1, 'status': 'done', 'due': (tue - timedelta(days=1)).isoformat(),
                               'created': ms(10, 0, -6), 'updated': ms(10, 0, -1), 'doneAt': ms(10, 0, -1)})
    h.seed_doc(p, 'tasks/tc', {'title': 'Tanishq pitch deck', 'owner': M2, 'by': M1, 'status': 'todo', 'due': (tue + timedelta(days=3)).isoformat(),
                               'created': ms(10, 0, -2), 'updated': ms(10, 0, -2)})

    def be(ident):
        p.goto(h.url(ident, '#home', noai=True))
        h.ready(p)
        p.wait_for_timeout(700)

    be('founder')
    if not p.evaluate('() => !!(window.M && M.agent)'):
        raise AssertionError('M.agent is not in this build (builder 2, src/js/56-z-agent.js)')

    def grammar():
        names = ['ACTIONS', 'actionsFor', 'parse', 'route', 'peopleWhere', 'runGrammar', 'isYes', 'isNo', 'undo', 'ledger']
        have = p.evaluate('n => n.filter(k => !(k in M.agent))', names)
        check(not have, 'M.agent exports the Part L names: missing %r' % have)
        r = p.evaluate('s => M.agent.parse(s, M.lastCtx)', SENTENCE)
        check(r and r.get('action') == 'nudge_people' and (r.get('input') or {}).get('condition') == 'noout'
              and (r.get('input') or {}).get('scope') == 'everyone' and (r.get('input') or {}).get('ask') == 'why',
              "the founder's sentence parses with no AI: %r" % r)
        short = p.evaluate('() => M.agent.parse("flag the people who haven\'t checked out from office and ask them why", M.lastCtx)')
        check(short and short.get('action') == 'nudge_people' and (short.get('input') or {}).get('condition') == 'noout', 'the short form too: %r' % short)
        who = p.evaluate('() => M.agent.parse("who hasn\'t checked in yet", M.lastCtx)')
        check(who and who.get('action') == 'people_where' and (who.get('input') or {}).get('condition') == 'noin', 'who has not checked in reads people_where: %r' % who)
        for text, action in (('check me out', 'check_out'), ('start focus for 45', 'focus'), ('undo that', 'undo'), ('open hiring', 'open_screen')):
            g = p.evaluate('t => M.agent.parse(t, M.lastCtx)', text)
            check(g and g.get('action') == action, '"%s" parses to %s: %r' % (text, action, g))
        rt = p.evaluate('s => M.agent.route(s, M.lastCtx)', SENTENCE)
        check(rt and rt.get('grammar') and rt.get('tier') != 'quick', 'a bulk outward act never runs on the quick tier: %r' % rt)
        q = p.evaluate('() => M.agent.route("how many tasks are overdue", M.lastCtx)')
        check(q and q.get('tier') == 'quick', 'a read-only question is quick: %r' % q)
    section('grammar', grammar)

    def rights():
        fo = p.evaluate('() => (M.agent.actionsFor(M.lastCtx) || []).map(a => a.name || a[0])')
        check(all(a in fo for a in ('nudge_people', 'people_where', 'change_setting', 'toggle_rule', 'set_reports_to')), 'the founder holds the founder controls: %r' % fo[:12])
        be('m3')
        mo = p.evaluate('() => (M.agent.actionsFor(M.lastCtx) || []).map(a => a.name || a[0])')
        check(not any(a in mo for a in ('change_setting', 'toggle_rule', 'set_reports_to', 'pm_policy')), 'a member never sees a founder control: %r' % mo)
        pw = p.evaluate('() => M.agent.peopleWhere(M.lastCtx, {condition: "noout", scope: "everyone"})')
        check(not (pw or {}).get('match') and any('not in your team' in str(x.get('why', '')) for x in (pw or {}).get('left', [])), 'm3 can nudge nobody: %r' % pw)
        be('m2')
        pw = p.evaluate('() => M.agent.peopleWhere(M.lastCtx, {condition: "noout", scope: "my team"})')
        check([x.get('uid') for x in (pw or {}).get('match', [])] == [M3], 'm2 reaches m3: %r' % pw)
        be('m1')
        pw = p.evaluate('() => M.agent.peopleWhere(M.lastCtx, {condition: "noout", scope: "everyone"})')
        check(M3 not in [x.get('uid') for x in (pw or {}).get('match', [])] and M2 in [x.get('uid') for x in (pw or {}).get('match', [])],
              'm1 asks m2 about attendance and never m3, two levels down: %r' % pw)
        ov = p.evaluate('() => M.agent.peopleWhere(M.lastCtx, {condition: "overdue", scope: "everyone"})')
        check(M3 in [x.get('uid') for x in (ov or {}).get('match', [])], 'm1 can ask m3, down the line, about overdue work: %r' % ov)
    section('rights', rights)

    def parity():
        be('m2')
        new_due = (tue + timedelta(days=5)).isoformat()
        r = p.evaluate('''async ([due]) => { const ctx = M.lastCtx, nm = %r, log = () => {};
          const out = {};
          try { out.a = await M.brain.act(ctx, nm, log, 'update_task', {task: 'Tanishq pitch deck', due}); } catch (e) { out.a = String(e.message || e); }
          try { out.b = await M.brain.act(ctx, nm, log, 'update_task', {task: 'Nykaa carousel', due}); } catch (e) { out.b = String(e.message || e); }
          await new Promise(r => setTimeout(r, 500));
          return out; }''' % NM, [new_due])
        tc = p.evaluate('() => window.__db.get("tasks/tc")')
        check(tc.get('due') == new_due and isinstance(tc.get('dueLog'), list) and tc['dueLog'] and tc['dueLog'][-1].get('to') == new_due, 'update_task writes dueLog: %r' % {k: tc.get(k) for k in ('due', 'dueLog')})
        tb = p.evaluate('() => window.__db.get("tasks/tb")')
        check(tb.get('due') == (tue - timedelta(days=1)).isoformat(), 'a shipped task keeps its due date for a member: %r %r' % (tb.get('due'), r.get('b')))
        check(p.evaluate('() => !!(M.tasks && typeof M.tasks.save === "function")'), 'M.tasks.save is exported')
        be('m1')
        rr = p.evaluate('''async () => { try { await M.brain.act(M.lastCtx, %r, () => {}, 'reassign_task', {task: 'Hero reel script', owner: 'Durvesh'}); return 'ran'; } catch (e) { return String(e.message || e); } }''' % NM)
        ta = p.evaluate('() => window.__db.get("tasks/ta")')
        check(ta.get('owner') == M3 and rr != 'ran', 'reassign_task refuses someone who neither owns nor made the task: %r' % rr)
    section('parity', parity)

    def taint():
        be('m2')
        r = p.evaluate('''async () => { const ctx = M.lastCtx, nm = %r, turn = {id: 't-taint', via: 'typed', tainted: false};
          const tools = M.brain.tools(ctx, nm, () => {}, turn);
          const look = tools.find(t => t.name === 'look_up'), act = tools.find(t => t.name === 'act');
          const before = M.brain.pending.list.length;
          await look.execute({what: 'chat', q: 'Ishaan'});
          const res = await act.execute({action: 'send_message', input: {to: 'Ishaan', text: 'Ping me when the cut is up'}});
          await new Promise(r => setTimeout(r, 400));
          const room = 'chat/' + M.rooms.dmId(ctx.uid, 'u_m3') + ':' + ctx.uid;
          const sent = ((window.__db.get(room) || {}).msgs || []).filter(m => m.text === 'Ping me when the cut is up').length;
          const card = M.brain.pending.list.slice(before).find(x => x.turn === 't-taint' || (x.turn && x.turn.id === 't-taint')) || M.brain.pending.list.slice(before)[0] || null;
          return {waiting: !!(res && res.waiting), sent, card: card ? {label: card.label, at: card.at, turn: card.turn && (card.turn.id || card.turn)} : null}; }''' % NM)
        check(r['waiting'] and r['sent'] == 0 and r['card'], 'after look_up chat, send_message waits for a tap: %r' % r)
        check(r['card'] and r['card'].get('turn') == 't-taint' and r['card'].get('at'), 'the card carries its turn and the time: %r' % r)
        p.evaluate('() => M.brain.pending.list.slice().forEach(x => M.brain.drop(x.id))')
    section('taint', taint)

    def spoken_yes():
        yes = ['yes', 'yeah', 'yep', 'send', 'send it', 'do it', 'go ahead', 'confirm', 'haan', 'haan bhejo']
        no = ['no', 'cancel', 'stop', "don't", 'mat bhejo']
        other = ['yes but only to Aanya', 'maybe', 'send it to everyone tomorrow', 'okay so what about Ekta']
        r = p.evaluate('([y, n, o]) => ({y: y.map(M.agent.isYes), n: n.map(M.agent.isNo), oy: o.map(M.agent.isYes), ny: n.map(M.agent.isYes)})', [yes, no, other])
        check(all(r['y']) and all(r['n']), 'the strict yes and no words: %r' % r)
        check(not any(r['oy']) and not any(r['ny']), 'anything else is never a yes: %r' % r)
    section('spoken yes', spoken_yes)

    def spoken_window():
        be('founder')
        r = p.evaluate('''() => { const ctx = M.lastCtx;
          if (typeof M.agent.yesFor !== 'function') return {missing: true};
          const h1 = M.brain.hold('Send it', 'one card', async () => 'ran', {turn: {id: 't-yes', via: 'voice'}});
          const card = M.brain.pending.list.find(x => x.id === h1.id) || {};
          const at = Number(card.at) || Date.now();
          const y = (text, o) => M.agent.yesFor(ctx, text, {turn: 't-yes', promptAt: at, ...o});
          const out = {inside: y('yes', {at: at + 5000}) === h1.id, late: y('yes', {at: at + 16000}), other: y('yes but only to Aanya', {at: at + 2000}),
            echo: y('yes', {at: at + 2000, micAt: at + 500, spokeEnd: at + 1500})};
          const h2 = M.brain.hold('Send that too', 'a second card', async () => 'ran', {turn: {id: 't-yes', via: 'voice'}});
          out.two = y('yes', {at: at + 3000});
          M.brain.drop(h1.id); M.brain.drop(h2.id);
          return out; }''')
        if r.get('missing'):
            check(False, 'M.agent.yesFor (the spoken-yes window, F9) is in this build')
            return
        check(r['inside'], 'a yes inside 15 seconds approves the one card: %r' % r)
        check(r['late'] is None and r['other'] is None, 'a yes after 15 seconds, or anything past the strict words, approves nothing: %r' % r)
        check(r['echo'] is None, 'a yes heard on a mic opened while the agent was still speaking approves nothing: %r' % r)
        check(r['two'] is None, 'with two cards waiting a yes approves neither: %r' % r)
    section('spoken window', spoken_window)

    def run_rights():
        be('m3')
        r = p.evaluate('''async () => { const ctx = M.lastCtx, nm = %r;
          const before = (window.__db.get('settings/app') || {}).grace;
          let res;
          try { res = await M.brain.act(ctx, nm, () => {}, 'change_setting', {key: 'grace', value: 55}); } catch (e) { res = String(e.message || e); }
          for (const x of M.brain.pending.list.slice()) { try { await M.brain.approve(x.id); } catch (e) { /* refused */ } }
          await new Promise(r => setTimeout(r, 500));
          return {before: before == null ? null : before, after: (window.__db.get('settings/app') || {}).grace, res: typeof res === 'string' ? res : JSON.stringify(res || null).slice(0, 200)}; }''' % NM)
        check(r['after'] == r['before'], 'a member calling change_setting by hand changes nothing: %r' % r)
    section('rights at run time', run_rights)

    def catalogue():
        be('founder')
        r = p.evaluate('''() => { const ctx = M.lastCtx, tools = M.brain.tools(ctx, %r, () => {}, {id: 't-cat', via: 'typed', tainted: false});
          const act = tools.find(t => t.name === 'act');
          const names = (M.agent.actionsFor(ctx) || []).map(a => a.name || a[0]);
          return {len: act.description.length, missing: names.filter(n => act.description.indexOf(n) < 0), n: names.length}; }''' % NM)
        check(r['len'] < 3600, 'the act description is under 3,600 characters for the founder: %r' % r['len'])
        check(not r['missing'] and r['n'] >= 33, 'it lists every founder action by name: %r' % r)
    section('catalogue', catalogue)

    def undo():
        be('founder')
        r = p.evaluate('''async () => { const ctx = M.lastCtx, nm = %r, turn = {id: 't-undo', via: 'grammar', tainted: false};
          const parsed = M.agent.parse("flag the people who haven't checked out from office and ask them why", ctx);
          await M.agent.runGrammar(ctx, nm, parsed, turn, () => {});
          for (const x of M.brain.pending.list.slice()) await M.brain.approve(x.id);
          await new Promise(r => setTimeout(r, 600));
          const asks = (((window.__db.get('me/u_founder') || {}).pm || {}).asks || {});
          const ids = Object.keys(asks);
          await M.agent.undo(M.lastCtx, 'last');
          await new Promise(r => setTimeout(r, 600));
          const after = (((window.__db.get('me/u_founder') || {}).pm || {}).asks || {});
          return {parsed, ids, withdrawn: ids.map(k => !!(after[k] || {}).withdrawn || !after[k])}; }''' % NM)
        check(r['ids'], 'the grammar run writes an ask: %r' % r)
        check(r['ids'] and all(r['withdrawn']), 'undo withdraws it: %r' % r)
        led = p.evaluate('() => window.__db.get("data/users/u_founder/agent")')
        check(led and isinstance(led.get('runs'), list) and led['runs'], 'the run lands in the private ledger: %r' % (led and list(led.keys())))
    section('undo', undo)

    errs = h.errors()
    check(not errs, 'no console errors: %r' % errs[:3])
    if fails:
        raise AssertionError('%d of %d contract checks failed:\n - ' % (len(fails), len(fails) + len(passed)) + '\n - '.join(fails))
    return passed


if __name__ == '__main__':
    out = run(test)
    print('%d checks' % len(out))
    print('PASS')
