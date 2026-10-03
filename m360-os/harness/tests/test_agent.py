#!/usr/bin/env python3
"""v32 test: the agent's actions (the 360 abilities), the local grammar and the parity with the hand.

A working Tuesday next week at 20:41, the EOD cut at 19:30. The founder's own sentence, "flag the
people who haven't checked out from office and that basically pings them, DMs them, sends them a
notification and sends them an update also saying why didn't it happen", parses with the AI off
(?noai=1) to nudge_people {condition: noout, scope: everyone, ask: why}. people_where finds Durvesh
(in 10:08, nothing saved since 17:40) and Aanya (in 10:31, last save 18:55), keeps Ishaan unticked
(still working, saved 20:35), and leaves out Ekta (on leave) and Rohan (checked out at 19:10).
The tap card (.pending-act.ask-preview) lists the three with their tick boxes; Aanya checks out
before the tap, so one tap on #ask-send asks Durvesh alone and names Aanya as left out. A spoken
yes confirms a second card only within 15 seconds, only with one card waiting from its turn, only
for a strict yes, and Undo takes the ask back.

Rights: Durvesh (no reports) sees no nudge and no settings action and is refused both at run time;
Aanya manages Ishaan and asks him at once, cannot ask skip-level Rohan about his check-out (not in
your team) but can ask him about overdue work. Parity: update_task by the agent writes dueLog and
keeps a shipped task's dates; reassign_task refuses someone who neither owns nor made the task. The
taint rule holds a DM after look_up chat. The act tool lists every founder action as name (gloss)
under 3,600 characters, and look_up("action") hands back the fields. The 33 actions the brain had
still run. The card is checked in light and dark, at 1280 and at 390 by 3, with screenshots.

Until the personal managers' module is on the page, a small stand-in for M.pm.ask and withdraw
records the ask the way the contract says (me/<sender>.pm.asks.<askId> and one DM line each).

Run: cd m360-os && python3 harness/tests/test_agent.py
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4, M5 = 'u_founder', 'u_m1', 'u_m2', 'u_m3', 'u_m4', 'u_m5'
SHOTS = os.environ.get('AGENT_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'agent')
SENTENCE = ("flag the people who haven't checked out from office and that basically pings them, DMs them, sends them a "
            "notification and sends them an update also saying why didn't it happen?")
OFFICE = {'lat': 19.076, 'lng': 72.8777, 'acc': 24, 'dist': 8, 'verified': True, 'place': 'Mumbai office', 'src': 'gps'}

# the personal managers' ask and withdraw, as the contract has them, for a page that does not carry M.pm yet
PM_STANDIN = r'''() => {
  if (M.pm && M.pm.ask) return 'real';
  M.pm = {
    P: () => ({on: false, require: true, wait: 60, waitMin: 30, waitMax: 180, askPerDay: 3}),
    items: () => [], sent: () => [], helloLine: () => '', badge: () => 0,
    async ask(ctx, o) {
      const askId = 'a' + Math.random().toString(36).slice(2, 10);
      const rec = {kind: o.kind, to: o.to, ask: o.ask || 'why', at: Date.now(), via: o.via || 'typed'};
      ['sub', 'showAt', 'tellBy', 'ringNow'].forEach(k => { if (o[k]) rec[k] = o[k]; });
      await ctx.W.merge('me/' + ctx.uid, {pm: {asks: {[askId]: rec}}});
      if (!o.showAt) for (const u of o.to) await M.rooms.send(ctx, M.rooms.dmId(ctx.uid, u), 'Kaavish asked m360 to check with you: ' + o.kind, [], null, {id: 'ask.' + askId + '.' + u, ask: askId});
      return {askId, sent: o.to.slice(), skipped: []};
    },
    async withdraw(ctx, askId) { await ctx.W.merge('me/' + ctx.uid, {pm: {asks: {[askId]: {withdrawn: Date.now()}}}}); },
    cfgOf: () => ({on: true, kinds: {noin: true, noeod: true, overdue: true, quiet: true, noout: true}}),
    async setCfg(ctx, patch) { await ctx.W.merge('me/' + ctx.uid, {pm: {cfg: patch}}); return {now: patch}; }
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

    def at(hh, mm):
        return datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST)

    def ms(hh, mm, day=0):
        return int((at(hh, mm) + timedelta(days=day)).timestamp() * 1000)

    def new_ctx(width=1280, height=900, dsf=1, dark=False):
        c = h.browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dsf, locale='en-IN',
                                  timezone_id='Asia/Kolkata', color_scheme='dark' if dark else 'light')
        h.contexts.append(c)
        c.clock.set_fixed_time(at(20, 41))
        pg = c.new_page()
        pg.set_default_timeout(20000)
        pg.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        return pg

    def be(pg, ident, hash='#home', **params):
        url = h.url(ident, hash, **params)
        if pg.url == url:
            pg.reload()
        else:
            pg.goto(url)
        h.ready(pg)
        pg.wait_for_function('() => !!(window.M && M.lastCtx && M.agent && M.lastCtx.activeMembers.length > 3)')
        pg.wait_for_timeout(500)
        return pg.evaluate(PM_STANDIN)

    def seed_world(pg):
        pg.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
        h.ready(pg)
        pg.wait_for_function('() => !!window.__db.get("roster/team")')
        pg.wait_for_timeout(400)
        h.roster(pg, [M1, M2, M3, M4, M5], extra={
            M1: {'pod': ''}, M2: {'pod': ''}, M3: {'pod': '', 'reportsTo': M2},
            M4: {'pod': '', 'title': 'Ekta Shah'}, M5: {'pod': '', 'title': 'Rohan Das', 'reportsTo': M3}})
        day = lambda i, o=None: {'days': {today: {'in': i, 'out': o, 'mode': 'office', 'loc': OFFICE, 'outLoc': None}}}
        for u in (F, M1, M2, M3, M4, M5):
            h.seed_doc(pg, 'eod/' + u, {'days': {}})
        h.seed_doc(pg, 'checkin/' + F, {'days': {}})
        h.seed_doc(pg, 'checkin/' + M1, day(ms(10, 8)))
        h.seed_doc(pg, 'checkin/' + M2, day(ms(10, 31)))
        h.seed_doc(pg, 'checkin/' + M3, day(ms(11, 2)))
        h.seed_doc(pg, 'checkin/' + M4, {'days': {}})
        h.seed_doc(pg, 'checkin/' + M5, day(ms(10, 0), ms(19, 10)))
        h.seed_doc(pg, 'me/' + M1, {'act': {today: {'1100': 1, '1740': 1}}})
        h.seed_doc(pg, 'me/' + M2, {'act': {today: {'1200': 1, '1855': 1}}})
        h.seed_doc(pg, 'me/' + M3, {'act': {today: {'2035': 1}}})
        h.seed_doc(pg, 'leave/' + M4, {'reqs': [{'id': 'L1', 'from': today, 'to': today, 'type': 'casual', 'at': ms(9, 0, -2)}]})
        h.seed_doc(pg, 'leavedec/' + M4, {'d': {'L1': {'status': 'approved', 'at': ms(9, 0, -1)}}})
        old = (tue - timedelta(days=3)).isoformat()
        base = {'client': '', 'project': '', 'section': '', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': False,
                'subtasks': {}, 'comments': {}, 'created': ms(9, 0, -5), 'updated': ms(9, 0, -5), 'doneAt': None}
        h.seed_doc(pg, 'tasks/t_over', {**base, 'title': 'Swisse reel cutdown', 'owner': M5, 'by': M3, 'due': old, 'status': 'doing'})
        h.seed_doc(pg, 'tasks/t_mine', {**base, 'title': 'Nykaa carousel', 'owner': M1, 'by': F, 'due': (tue + timedelta(days=2)).isoformat(), 'status': 'todo'})
        h.seed_doc(pg, 'tasks/t_ship', {**base, 'title': 'Tanishq deck', 'owner': M1, 'by': M1, 'due': old, 'status': 'done', 'doneAt': ms(9, 0, -2)})
        h.seed_doc(pg, 'tasks/t_theirs', {**base, 'title': 'Hero reel script', 'owner': M2, 'by': M2, 'due': '', 'status': 'todo'})
        pg.wait_for_timeout(300)

    def open_panel(pg):
        pg.evaluate('() => (M.assistant && M.assistant.open) ? M.assistant.open("") : window.dispatchEvent(new CustomEvent("m360:ask"))')
        pg.wait_for_selector('.pending-act.ask-preview', timeout=10000)
        pg.wait_for_timeout(400)

    pg = new_ctx()
    seed_world(pg)

    # ---- the grammar, with the AI off ----
    mode = be(pg, 'founder', noai=True)
    check(pg.evaluate('() => !M.lastCtx.sample'), 'the page runs with the AI off')
    parsed = pg.evaluate('s => M.agent.parse(s, M.lastCtx)', SENTENCE)
    check(parsed == {'action': 'nudge_people', 'input': {'condition': 'noout', 'scope': 'everyone', 'ask': 'why'}}, "the founder's sentence parses to noout and why: %r" % parsed)
    rt = pg.evaluate('s => M.agent.route(s, M.lastCtx)', SENTENCE)
    check(rt['grammar'] == parsed and rt['tier'] == 'default' and rt['intent'] == 'task', 'the route carries the grammar on the default tier: %r' % rt)
    more = pg.evaluate('''() => { const c = M.lastCtx, p = s => M.agent.parse(s, c); return {
      who: p("who hasn't checked out yet?"), noin: p('nudge my team who have not checked in'), eod: p('remind everyone who has no EOD by when'),
      open: p('open the pipeline'), focus: p('start focus for 45'), stop: p('stop focus'), status: p('set my status to at the Swisse shoot'),
      call: p("I'm on a call till 5"), undo: p('undo that'), wd: p('withdraw that'), inn: p('check me in'), out: p('check me out'),
      bot: p("tell Aanya's bot I'll have it by five"), none: p('what is the weather like'),
      quick: M.agent.route('what is overdue on me?', c).tier, bulk: M.agent.route("move all of Aanya's work to next week", c).tier}; }''')
    check(more['who'] == {'action': 'people_where', 'input': {'condition': 'noout', 'scope': 'everyone'}}, 'who has not checked out reads: %r' % more['who'])
    check(more['noin']['input'] == {'condition': 'noin', 'scope': 'myteam'} and more['eod']['input']['ask'] == 'eta', 'scopes and by when: %r %r' % (more['noin'], more['eod']))
    check(more['open'] == {'action': 'open_screen', 'input': {'route': 'pipeline'}} and more['focus']['input'] == {'start': 45} and more['stop']['input'] == {'stop': True}, 'open and focus: %r' % [more['open'], more['focus']])
    check(more['status']['input'] == {'text': 'At the Swisse shoot'} and more['call']['input'] == {'text': 'On a call', 'until': '17:00'}, 'statuses: %r' % [more['status'], more['call']])
    check(more['undo']['action'] == 'undo' and more['wd']['action'] == 'withdraw_ask' and more['inn']['action'] == 'check_in' and more['out']['action'] == 'check_out', 'undo, withdraw, in and out')
    check(more['bot'] == {'action': 'answer_ask', 'input': {'about': 'aanya', 'how': 'onit', 'eta': '17:00'}}, "an answer to a bot: %r" % more['bot'])
    check(more['none'] is None and more['quick'] == 'quick' and more['bulk'] == 'complex', 'no guess, a quick read, a complex re-plan: %r' % [more['none'], more['quick'], more['bulk']])

    # ---- people_where: matches, exclusions, unticked ----
    pw = pg.evaluate('() => M.agent.peopleWhere(M.lastCtx, {condition: "noout", scope: "everyone"})')
    rows = {r['uid']: r for r in pw['match']}
    left = {r['uid']: r['why'] for r in pw['left']}
    check(sorted(rows) == [M1, M2, M3], 'three are still checked in: %r' % sorted(rows))
    check(rows[M1]['facts'] == 'in 10:08, nothing saved since 17:40' and rows[M1]['on'], 'Durvesh: %r' % rows[M1])
    check(rows[M2]['facts'] == 'in 10:31, last save 18:55' and rows[M2]['on'], 'Aanya: %r' % rows[M2])
    check(not rows[M3]['on'] and rows[M3]['off'] == 'still working, saved 20:35', 'Ishaan is unticked, still working: %r' % rows[M3])
    check(left.get(M4) == 'on leave' and left.get(M5) == 'checked out at 19:10', 'leave and checked out are left out: %r' % left)
    check(pw['warn'] == '', 'after the cut there is no time warning')

    # ---- the founder's sentence end to end: a tap card, a live re-check, one tap ----
    out = pg.evaluate('async s => { const c = M.lastCtx; const r = await M.agent.runGrammar(c, null, M.agent.parse(s, c), {id: "t1", via: "voice", said: s}); return {text: r.text, waiting: r.waiting}; }', SENTENCE)
    check(out['waiting'] and out['text'].endswith('Ask them why? Say yes to send.') and 'Two people are still checked in, Durvesh and Aanya' in out['text'], 'the spoken line: %r' % out)
    open_panel(pg)
    card = pg.locator('.pending-act.ask-preview').first
    title = card.locator('.ask-title').inner_text()
    check(title == "Ask 2 people why they haven't checked out", 'the card title: %r' % title)
    ticks = pg.evaluate('() => [...document.querySelectorAll(".ask-person input[data-uid]")].map(i => [i.dataset.uid, i.checked])')
    check(ticks == [[M1, True], [M2, True], [M3, False]], 'tick boxes, Ishaan unticked: %r' % ticks)
    txt = card.inner_text()
    check('email: team site only' in txt and 'If nobody answers by 21:45, tell me' in txt, 'channels and the tell-by line: %r' % txt[-200:])
    check(pg.locator('#ask-send').inner_text().strip() == 'Send to 2' and pg.locator('#ask-edit').count() == 1, 'Send to 2 and Edit wording')
    check(h.overflow(pg) <= 0, 'no sideways scroll with the card')
    os.makedirs(SHOTS, exist_ok=True)
    pg.screenshot(path=os.path.join(SHOTS, 'ask-preview-1280-light.png'))
    pg.emulate_media(color_scheme='dark')
    pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(SHOTS, 'ask-preview-1280-dark.png'))
    bg = pg.evaluate('() => { const c = getComputedStyle(document.querySelector(".ask-preview")); return [c.backgroundColor, c.color]; }')
    check(bg[0] != bg[1], 'the card reads in dark: %r' % bg)
    pg.emulate_media(color_scheme='light')
    # Aanya checks out before the tap: she is dropped and named
    pg.evaluate('([d, t]) => window.__db.set("checkin/u_m2", {days: {[d]: {in: t[0], out: t[1], mode: "office", loc: null, outLoc: null}}})', [today, [ms(10, 31), ms(20, 42)]])
    pg.wait_for_timeout(500)
    pg.locator('#ask-send').click()
    pg.wait_for_function('() => { const d = window.__db.get("me/u_founder"); return d && d.pm && d.pm.asks && Object.keys(d.pm.asks).length > 0; }')
    asks = pg.evaluate('() => window.__db.get("me/u_founder").pm.asks')
    check(len(asks) == 1, 'one ask went: %r' % asks)
    ask_id, ask = list(asks.items())[0]
    check(ask['to'] == [M1] and ask['kind'] == 'noout' and ask['ask'] == 'why', 'Durvesh alone, Aanya dropped: %r' % ask)
    check(ask.get('via') == 'voice' or mode == 'real', 'the ask says it came by voice: %r' % ask.get('via'))
    pg.wait_for_timeout(400)
    msgs = pg.evaluate('u => ((window.__db.get("chat/" + M.rooms.dmId("u_founder", u) + ":u_founder") || {}).msgs || []).map(m => m.text)', M1)
    check(len(msgs) == 1, 'one DM line to Durvesh: %r' % msgs)
    toast = pg.evaluate('() => document.body.innerText')
    check('Aanya checked out at 20:42, so I left them out.' in toast, 'the drop is named')
    check(pg.locator('.pending-act.ask-preview').count() == 0, 'the card clears after the tap')

    # ---- Undo takes the ask back ----
    u = pg.evaluate('() => M.agent.undo(M.lastCtx, "last").then(r => r.say, e => "ERR " + e.message)')
    pg.wait_for_function('id => { const a = window.__db.get("me/u_founder").pm.asks[id]; return a && a.withdrawn; }', arg=ask_id)
    check(u.startswith('Taken back'), 'undo says so: %r' % u)
    ledger = pg.evaluate('() => window.__db.get("data/users/u_founder/agent")')
    acts = [a for r in ledger['runs'] for a in r['acts']]
    check(any(a['action'] == 'nudge_people' and a['status'] == 'undone' for a in acts) and any(r['via'] == 'voice' for r in ledger['runs']), 'the ledger keeps the run, undone: %r' % acts)

    # ---- a spoken yes: strict, quick, one card from its own turn ----
    sy = pg.evaluate('''async () => {
      const c = M.lastCtx;
      await M.agent.runGrammar(c, null, M.agent.parse("ping everyone who has no EOD and ask why", c), {id: "t2", via: "voice"});
      const p = M.brain.pending.list.find(x => x.turn === "t2");
      const r = {
        loose: M.agent.yesFor(c, "yes please", {turn: "t2"}), late: M.agent.yesFor(c, "yes", {turn: "t2", at: p.at + 16000}),
        echo: M.agent.yesFor(c, "send it", {turn: "t2", micAt: 100, spokeEnd: 200}), other: M.agent.yesFor(c, "yes", {turn: "t9"}),
        no: M.agent.isNo("mat bhejo"), haan: M.agent.isYes("Haan, bhejo")};
      await M.agent.exec(c, null, "change_setting", {key: "grace", value: 20}, {turn: {id: "t2", via: "voice"}});
      r.two = M.agent.yesFor(c, "yes", {turn: "t2"});
      M.brain.drop(M.brain.pending.list[M.brain.pending.list.length - 1].id);
      r.ok = M.agent.yesFor(c, "Yes.", {turn: "t2", micAt: 300, spokeEnd: 200});
      r.card = p.id;
      return r; }''')
    check(sy['loose'] is None and sy['late'] is None and sy['echo'] is None and sy['other'] is None and sy['two'] is None, 'a spoken yes is refused when loose, late, heard while speaking, from another turn or with two cards: %r' % sy)
    check(sy['ok'] == sy['card'] and sy['no'] and sy['haan'], 'a strict yes within 15 s with one card confirms it')
    pg.evaluate('id => M.brain.approve(id, "voice")', sy['card'])
    pg.wait_for_function('() => Object.values(window.__db.get("me/u_founder").pm.asks).some(a => a.kind === "noeod")')
    eod = [a for a in pg.evaluate('() => Object.values(window.__db.get("me/u_founder").pm.asks)') if a['kind'] == 'noeod']
    check(eod and M1 in eod[0]['to'] and M4 not in eod[0]['to'], 'the spoken yes sent the EOD ask, leave left out: %r' % eod)

    # ---- a card tapped later writes on today's data; Cancel during "Confirmed by voice" sends nothing ----
    late = pg.evaluate('''async () => {
      const c = M.lastCtx;
      const r = await M.agent.exec(c, null, "toggle_rule", {rule: "R03", on: false}, {turn: {id: "t5", via: "typed"}});
      const s = window.__db.get("settings/app");
      window.__db.set("settings/app", {...s, rules: {...(s.rules || {}), R05: false}});
      await new Promise(x => setTimeout(x, 600));
      await M.brain.approve(r.id);
      await new Promise(x => setTimeout(x, 600));
      const rules = window.__db.get("settings/app").rules;
      const g0 = window.__db.get("settings/app").grace;
      const r2 = await M.agent.exec(M.lastCtx, null, "change_setting", {key: "grace", value: 37}, {turn: {id: "t6", via: "voice"}});
      const go = M.brain.approve(r2.id, "voice");
      await new Promise(x => setTimeout(x, 100));
      M.brain.drop(r2.id);
      await go;
      await new Promise(x => setTimeout(x, 400));
      const s2 = window.__db.get("settings/app");
      window.__db.set("settings/app", {...s2, rules: {...(s2.rules || {}), R03: true, R05: true}});
      return {r03: rules.R03, r05: rules.R05, grace0: g0, grace: s2.grace}; }''')
    check(late['r03'] is False and late['r05'] is False, 'a rule card writes only its own rule, so a switch made meanwhile stands: %r' % late)
    check(late['grace'] == late['grace0'] and late['grace'] != 37, 'Cancel while "Confirmed by voice" shows sends nothing: %r' % late)
    pg.wait_for_timeout(400)

    # ---- the catalogue: every founder action, name (gloss), under 3,600 characters ----
    cat = pg.evaluate('''async () => { const c = M.lastCtx, nm = await M.ai.names(c), t = M.brain.tools(c, nm, null, {id: "t3", via: "typed"});
      const act = t.find(x => x.name === "act"), look = t.find(x => x.name === "look_up");
      const names = M.agent.actionsFor(c).map(a => a.name);
      let bad = ''; try { await act.execute({action: "change_setting", input: {value: 3}}); } catch (e) { bad = e.message; }
      return {len: act.description.length, missing: names.filter(n => act.description.indexOf(n + " (") < 0), n: names.length,
        sig: await look.execute({what: "action", q: "nudge_people"}), bad}; }''')
    check(cat['len'] < 3600 and not cat['missing'] and cat['n'] >= 60, 'the act description lists all %d founder actions in %d characters: %r' % (cat['n'], cat['len'], cat['missing']))
    check(cat['sig'].startswith('ACTION nudge_people') and 'condition' in cat['sig'], 'look_up action hands back the fields: %r' % cat['sig'][:120])
    check('change_setting needs key' in cat['bad'] and '{key' in cat['bad'], 'a bad call carries the fields: %r' % cat['bad'])

    # ---- the 33 the brain had still run ----
    old33 = pg.evaluate('''async () => {
      const c = M.lastCtx, nm = await M.ai.names(c), run = (a, i) => M.brain.act(M.lastCtx, nm, null, a, i).then(r => r && (r.ok || r.waiting) ? "ok" : JSON.stringify(r), e => "ERR " + e.message);
      const legacy = M.agent.ACTIONS.filter(a => a.legacy).map(a => a.name);
      const out = {count: legacy.length};
      out.create_task = await run("create_task", {title: "Agent parity check", owner: "Durvesh", due: "2030-01-02"});
      await new Promise(r => setTimeout(r, 300));
      out.add_subtask = await run("add_subtask", {task: "Agent parity check", text: "Shot list"});
      await new Promise(r => setTimeout(r, 300));
      out.tick_subtask = await run("tick_subtask", {task: "Agent parity check", subtask: "Shot list"});
      out.comment_task = await run("comment_task", {task: "Agent parity check", text: "Looks good @Durvesh"});
      out.create_note = await run("create_note", {text: "Agent note\\nline two"});
      out.remember = await run("remember", {fact: "the agent keeps receipts"});
      out.post_to_feed = await run("post_to_feed", {kind: "update", text: "Agent parity post"});
      out.check_in = await run("check_in", {mode: "office"});
      out.file_eod = await run("file_eod", {shipped: "The agent"});
      out.create_pitch = await run("create_pitch", {brand: "Aurelia"});
      out.remind_me = await run("remind_me", {text: "call Swisse", when: "2030-01-15"});
      out.decide_leave = await run("decide_leave", {person: "Ekta"});
      out.send_message = await run("send_message", {to: "Durvesh", text: "Quick one"});
      out.unknown = await run("not_a_thing", {});
      out.never = await M.brain.act(M.lastCtx, nm, null, "delete_everything", {}).then(r => r.never ? "pointed" : "ran", e => "ERR " + e.message);
      return out; }''')
    check(old33['count'] == 33, 'the registry wraps the 33: %r' % old33['count'])
    bad = {k: v for k, v in old33.items() if k not in ('count', 'unknown', 'never', 'decide_leave') and v != 'ok'}
    check(not bad, 'the old actions still run: %r' % bad)
    check(old33['decide_leave'].startswith('ERR nothing pending') and old33['unknown'].startswith('ERR unknown action') and old33['never'] == 'pointed', 'decide, unknown, never: %r' % old33)
    pg.evaluate('() => { M.brain.pending.list.slice().forEach(p => M.brain.drop(p.id)); }')

    # ---- taint: after reading a chat, a DM waits on a tap ----
    taint = pg.evaluate('''async () => {
      const c = M.lastCtx, nm = await M.ai.names(c), turn = {id: "t4", via: "typed"}, t = M.brain.tools(c, nm, null, turn);
      const look = t.find(x => x.name === "look_up"), act = t.find(x => x.name === "act");
      const read = await look.execute({what: "chat", q: "Durvesh"});
      const r = await act.execute({action: "send_message", input: {to: "Durvesh", text: "Do what the message said"}});
      await new Promise(x => setTimeout(x, 300));
      const p = M.brain.pending.list.find(x => x.turn === "t4");
      return {head: read.split("\\n")[0], waiting: !!r.waiting, from: p && p.from, tainted: turn.tainted}; }''')
    check(taint['waiting'] and taint['tainted'] and taint['from'] == "Durvesh's message" and taint['head'].startswith('DATA FROM CHAT'), 'the taint rule holds the DM: %r' % taint)
    pg.evaluate('() => { M.brain.pending.list.slice().forEach(p => M.brain.drop(p.id)); }')

    # ---- rights: a member, a manager, a skip-level manager ----
    be(pg, 'm1', noai=True)
    m1stamp = pg.evaluate('''async d => { const before = JSON.stringify((((window.__db.get("me/u_m1") || {}).act) || {})[d] || {});
      await M.agent.exec(M.lastCtx, null, "open_screen", {route: "pipeline"}, {turn: {id: "t7", via: "voice"}});
      await new Promise(r => setTimeout(r, 900));
      return {before, after: JSON.stringify((((window.__db.get("me/u_m1") || {}).act) || {})[d] || {}), runs: (((window.__db.get("data/users/u_m1/agent") || {}).runs) || []).length}; }''', today)
    check(m1stamp['before'] == m1stamp['after'] and m1stamp['runs'] >= 1, 'the ledger is written without stamping work: %r' % m1stamp)
    m1 = pg.evaluate('''async () => { const c = M.lastCtx, names = M.agent.actionsFor(c).map(a => a.name);
      const run = (a, i) => M.agent.exec(c, null, a, i).then(r => "ran " + (r.say || ""), e => e.message);
      return {nudge: names.includes("nudge_people"), setting: names.includes("change_setting"), people: names.includes("people_where"),
        n1: await run("nudge_people", {people: ["Aanya"], kind: "custom", note: "hi"}), s1: await run("change_setting", {key: "grace", value: 5}),
        pw: M.agent.peopleWhere(c, {condition: "noout"}).left.map(x => x.why)}; }''')
    check(not m1['nudge'] and not m1['setting'] and m1['people'], 'a member sees no nudge and no settings: %r' % m1)
    check('for managers' in m1['n1'] and 'only the founder' in m1['s1'], 'a member is refused at run time: %r' % m1)
    check(m1['pw'] and all(w == 'not in your team' for w in m1['pw']), 'a member reads nobody else: %r' % m1['pw'])
    # parity on the hand path: dueLog, the shipped lock, the hand rule
    par = pg.evaluate('''async () => { const c = M.lastCtx, run = (a, i) => M.agent.exec(M.lastCtx, null, a, i).then(r => r, e => ({err: e.message}));
      const u = await run("update_task", {task: "Nykaa carousel", due: "2030-01-10"});
      await new Promise(r => setTimeout(r, 300));
      const s = await run("update_task", {task: "Tanishq deck", due: "2030-02-01"});
      await new Promise(r => setTimeout(r, 300));
      const r = await run("reassign_task", {task: "Hero reel script", owner: "Durvesh"});
      const t = M.lastCtx.coll.tasks.map;
      return {mine: t.t_mine.due, log: t.t_mine.dueLog, ship: t.t_ship.due, shipNote: s.note || s.err, re: r.err || "ran", theirs: t.t_theirs.owner}; }''')
    check(par['mine'] == '2030-01-10' and par['log'] and par['log'][-1]['to'] == '2030-01-10' and par['log'][-1]['by'] == M1, 'update_task writes dueLog: %r' % par)
    check(par['ship'] != '2030-02-01' and 'shipped' in (par['shipNote'] or ''), 'a shipped task keeps its date: %r' % par)
    check('only the owner, the person who made it or the founder' in par['re'] and par['theirs'] == M2, 'reassign_task refuses a non-owner: %r' % par)

    be(pg, 'm2', noai=True)
    m2 = pg.evaluate('''async () => { const c = M.lastCtx, run = (a, i) => M.agent.exec(c, null, a, i).then(r => r, e => ({err: e.message}));
      const pw = M.agent.peopleWhere(c, {condition: "noout"}), po = M.agent.peopleWhere(c, {condition: "overdue"});
      const skip = await run("nudge_people", {people: ["Rohan"], kind: "noout"});
      /* named with an attendance kind: the same live facts as a condition, so Ishaan (saved 20:35) waits unticked */
      const held = await run("nudge_people", {people: ["Ishaan"], kind: "noout"});
      const card = M.brain.pending.list.find(p => p.people && p.people[0].uid === "u_m3");
      if (card) M.brain.drop(card.id);
      const ok = await run("nudge_people", {people: ["Ishaan"], kind: "custom", note: "Can you share the call sheet?"});
      await new Promise(r => setTimeout(r, 400));
      /* the off switch stays Kaavish's: no long pause, no every-kind-off */
      const pauseLong = await run("pm_settings", {pause: {person: "Ishaan", until: "2031-01-01"}});
      /* single kinds may go off; every kind at once is the bot off */
      const allOff = await run("pm_settings", {kinds: {noin: false, noeod: false, overdue: false, sentback: false, chase: false, quiet: false, waiton: false, noout: false, idle: false, short: false}});
      const off = await run("pm_settings", {on: false});
      const pauseDay = await run("pm_settings", {pause: {person: "Ishaan"}});
      return {pwMatch: pw.match.map(x => x.uid), pwLeft: pw.left, over: po.match.map(x => x.uid), skip, ok: ok.say || ok.err,
        held: !!held.waiting && !!card && card.people[0].on === false, pauseLong: pauseLong.err || "ran", allOff: allOff.err || "ran", off: off.err || "ran", pauseDay: pauseDay.err || "ran",
        asks: Object.values(((window.__db.get("me/u_m2") || {}).pm || {}).asks || {})}; }''')
    check(m2['pwMatch'] == [M3] and {'uid': M5, 'why': 'not in your team'} in m2['pwLeft'], 'a skip-level manager cannot read attendance: %r' % m2)
    check(m2['over'] == [M5], 'but can ask about overdue work down the line: %r' % m2['over'])
    check(m2['skip'].get('asked') == 0 and 'not in your team' in m2['skip'].get('say', ''), 'a skip-level attendance ask goes nowhere: %r' % m2['skip'])
    check(m2['held'], 'a named check-out ask reads the live facts and holds a working report unticked: %r' % m2)
    check(len(m2['asks']) == 1 and m2['asks'][0]['to'] == [M3] and m2['asks'][0]['kind'] == 'custom', 'a manager asks their own report at once: %r' % m2)
    check('end of today' in m2['pauseLong'] and 'only Kaavish' in m2['allOff'] and 'only Kaavish' in m2['off'] and m2['pauseDay'] == 'ran',
          'a manager cannot switch their bot off by a long pause or every kind off, and can pause one person for today: %r' % m2)
    amb = pg.evaluate('''() => M.agent.exec(M.lastCtx, {u_founder: "Kaavish R", u_m1: "Durvesh Rao", u_m2: "Aanya K", u_m3: "Durvesh Iyer", u_m4: "Ekta Shah", u_m5: "Rohan Das"},
      "message_people", {people: ["Durvesh", "Ekta"], text: "hi"}).then(r => "ran", e => e.message)''')
    check(amb.startswith('which Durvesh: Durvesh Rao or Durvesh Iyer'), 'two people with one first name are asked about, never guessed: %r' % amb)

    # ---- the card at 390 by 3, light and dark ----
    for dark in (False, True):
        ph = new_ctx(390, 844, 3, dark)
        seed_world(ph)
        be(ph, 'founder', noai=True)
        ph.evaluate('async s => { const c = M.lastCtx; await M.agent.runGrammar(c, null, M.agent.parse(s, c), {id: "p1", via: "voice"}); }', SENTENCE)
        open_panel(ph)
        ph.locator('.pending-act.ask-preview').scroll_into_view_if_needed()
        ph.wait_for_timeout(300)
        name = 'ask-preview-390-' + ('dark' if dark else 'light') + '.png'
        ph.screenshot(path=os.path.join(SHOTS, name))
        check(h.overflow(ph) <= 0, 'no sideways scroll at 390 (%s)' % name)
        small = h.small_text(ph)
        card_small = ph.evaluate('''() => [...document.querySelectorAll(".ask-preview *")].filter(e => e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.textContent.trim().slice(0, 30))''')
        check(not card_small, 'card text is 13 px or more at 390: %r' % card_small)
        width = ph.evaluate('() => { const r = document.querySelector(".ask-preview").getBoundingClientRect(); return [r.left, r.right, innerWidth]; }')
        check(width[0] >= 0 and width[1] <= width[2], 'the card fits the phone: %r (%d small elsewhere)' % (width, len(small)))
        ph.context.close()

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
