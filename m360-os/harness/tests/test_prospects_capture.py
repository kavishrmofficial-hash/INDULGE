#!/usr/bin/env python3
"""v34 test: capture through the agent (src/js/56-z-agent.js, 56-brain.js, 57-panel.js, 62-palette.js), with no
model call.

A frozen Mon 5 Oct 2026 10:00 IST, the AI off (?noai=1). Kaavish founds; Durvesh (m1), Aanya (m2) and Ishaan (m3)
are on the roster; the pipeline holds Tata (Kaavish's), Swisse (Durvesh's, at proposal) and Nykaa (Kaavish's);
the COO holds a drafted Swisse follow-up card. Checks:
- the F3 table parses to the right actions and inputs (log_talk, follow_up, log_send, the reads, done, snooze,
  keep the date private), and the two sentences that used to become team nudges ("Follow up with Rahul from
  Tata, their payment is overdue", "Called Priya at Nykaa, she went quiet, chase her next Tuesday") are captures;
  a teammate's flag is still an ask, and "remind me" about a teammate is an own follow-up with nobody attached;
- "send the Swisse follow-up" still goes to coo_decide while "sent the Swisse follow-up" is captured;
- one line end to end: the receipt, the chips (Undo, Keep the date private), the ledger row (via typed or voice)
  and Undo until the end of the IST day; a pitch field changed by hand since is left alone and the receipt says so;
- a tainted turn holds the shared send for a tap and keeps the private follow-up;
- remind_me writes a private follow-up and never a task; look_up has the area prospects, own data, never untrusted;
- Home quick add sends a prospect line to Prospects and a plain line to a task;
- Cmd K offers "Log it: <line>", "New follow-up" and the Prospects page;
- the act description stays under 3,600 characters with every founder action named;
- the offline copy offers the capture chip. window.__sampleCalls stays empty throughout.

Fails until builders 1 and 2 are merged (M.prospects, the Home fold and the page); the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_capture.py
"""
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
MON = datetime(2026, 10, 5, 10, 0, tzinfo=IST)
NOW = int(MON.timestamp() * 1000)
DAY = 86400000
IX = 'data/users/u_founder/prospects'
SHOTS = os.environ.get('PROS_SHOTS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots', 'prospects')

# the F3 table: the line, the action, and the input fields that must be there (a subset)
F3 = [
    ('Met Rahul from Tata, sent the deck, he said talk after the 16th', 'log_talk', {'who': 'rahul', 'org': 'tata', 'kind': 'meet', 'what': 'deck', 'when': 'after the 16th'}),
    ('remind me to call Meera after the 16th', 'follow_up', {'who': 'meera', 'when': 'after the 16th'}),
    ('Rahul said talk after the 16th', 'follow_up', {'who': 'rahul', 'when': 'after the 16th'}),
    ('Sent the Swisse proposal v2 to Meera', 'log_send', {'pitch': 'swisse', 'to': 'meera', 'what': 'proposal v2'}),
    ('whatsapped Riya from Swisse the creds', 'log_talk', {'who': 'riya', 'org': 'swisse', 'kind': 'wa', 'what': 'creds'}),
    ('shared the rate card with Rohan at Bira', 'log_send', {'pitch': 'bira', 'to': 'rohan', 'what': 'rate card'}),
    ('Swisse replied', 'log_send', {'pitch': 'swisse', 'reply': 'replied'}),
    ('Nykaa said no', 'log_send', {'pitch': 'nykaa', 'reply': 'no'}),
    ('meeting with Kavya from Lakme on Thursday at 4', 'log_talk', {'who': 'kavya', 'org': 'lakme', 'kind': 'meet-plan', 'meet': '2026-10-08', 'at': '16:00'}),
    ('spoke to Anil at Titan, follow up next week', 'log_talk', {'who': 'anil', 'org': 'titan', 'kind': 'talk', 'when': 'next week'}),
    ('had a call with Sameer at Raymond, he will revert by friday', 'log_talk', {'who': 'sameer', 'org': 'raymond', 'kind': 'call', 'when': 'by friday'}),
    ('Follow up with Rahul from Tata, their payment is overdue', 'follow_up', {'who': 'rahul', 'org': 'tata'}),
    ('Called Priya at Nykaa, she went quiet, chase her next Tuesday', 'log_talk', {'who': 'priya', 'org': 'nykaa', 'kind': 'call', 'when': 'next tuesday'}),
    ('who do I follow up with today', 'follow_up', {'list': 'today'}),
    ('who am I meeting this week', 'follow_up', {'list': 'week'}),
    ('keep the date private', 'follow_up', {'private': True}),
    ('remind me to ping Aanya tomorrow', 'follow_up', {'when': 'tomorrow'}),
    ("flag the people who haven't checked out from office and ask them why", 'nudge_people', {'condition': 'noout'}),
    ('nudge Aanya who has not checked in', 'nudge_people', {'condition': 'noin'}),
    ('open the pipeline', 'open_screen', {'route': 'pipeline'}),
    ('sent the Swisse follow-up', 'log_send', {'pitch': 'swisse'}),
    ('send the Swisse follow-up', 'coo_decide', {'how': 'send'}),
]


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(MON)
    p = c.new_page()
    p.set_default_timeout(20000)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)

    def be(ident='founder', hash='#home'):
        p.goto(h.url(ident, hash, noai=True))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.agent && M.agent.capture && M.lastCtx.activeMembers.length >= 3)')
        p.wait_for_timeout(300)

    doc = lambda path: p.evaluate('k => window.__db.get(k)', path)  # noqa: E731

    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    if not p.evaluate('() => !!(M.prospects && M.prospects.apply && M.when && M.agent && M.agent.capture)'):
        raise AssertionError('M.prospects or M.agent.capture is not on the page: this test runs once builders 1 and 3 are merged')
    h.roster(p, [M1, M2, M3])
    base = {'category': '', 'contact': '', 'source': '', 'updated': NOW, 'stageAt': NOW - 5 * DAY, 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': NOW - 5 * DAY}
    h.seed_doc(p, 'pitches/pt_tata', {**base, 'brand': 'Tata', 'owner': F, 'stage': 'qualified'})
    h.seed_doc(p, 'pitches/pt_swisse', {**base, 'brand': 'Swisse', 'owner': M1, 'stage': 'proposal'})
    h.seed_doc(p, 'pitches/pt_nykaa', {**base, 'brand': 'Nykaa', 'owner': F, 'stage': 'lead'})
    s = doc('settings/app') or {}
    s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': NOW - 9 * DAY, 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
    h.seed_doc(p, 'settings/app', s)
    card = {'id': 'c_mail', 'kind': 'client_mail', 'rung': 'draft', 'title': 'Drafted a follow-up to Swisse. It waits for your tap.', 'code': 'client_mail', 'args': {}, 'why': '', 'recommend': '', 'checks': [], 'options': [], 'sources': [],
            'payload': {'action': '', 'input': {}, 'draft': {'to': 'priya@swisse.example', 'cc': '', 'subject': 'Following up on the Swisse proposal', 'text': 'Hi Priya, a quick follow-up on our proposal.'}},
            'refs': {'pitch': 'pt_swisse'}, 'dedupe': 'client_mail:pitch:pt_swisse', 'urgent': False, 'by': 'u_m360coo', 'at': NOW - 3600000, 'expires': NOW + 3 * DAY, 'status': 'open', 'money': False}
    h.seed_doc(p, 'coo/dec', {'items': {'c_mail': card}})
    be('founder')
    p.wait_for_function('() => M.lastCtx.priv.prospects.ready && M.coo && M.coo.decisions(M.lastCtx).length === 1')
    check(p.evaluate('() => !M.lastCtx.sample'), 'the page runs with the AI off')

    # ---- the F3 table ----
    out = p.evaluate('async rows => { const c = M.lastCtx, nm = await M.ai.names(c); return rows.map(r => M.agent.parse(r[0], c, nm)); }', F3)
    for (line, action, fields), got in zip(F3, out):
        check(got and got['action'] == action, '%r parses to %s: %r' % (line, action, got))
        for k, v in fields.items():
            check(got['input'].get(k) == v, '%r carries %s=%r: %r' % (line, k, v, got['input']))
    team = out[16]
    check('who' not in team['input'] and 'line' not in team['input'] and team['input']['note'] == 'remind me to ping Aanya tomorrow', 'a reminder about a teammate attaches nobody: %r' % team)
    coo = out[21]
    check(coo['input'].get('card') == 'swisse follow up' and coo['input'].get('kind') == 'mail', 'the imperative send is the COO draft: %r' % coo)
    none = p.evaluate('async () => { const c = M.lastCtx, nm = await M.ai.names(c); return ["done with Rahul", "snooze Rahul to Monday", "what is the weather like", "push the deadline to friday"].map(s => M.agent.parse(s, c, nm)); }')
    check(none == [None, None, None, None], 'done and snooze read as nothing until a follow-up exists, and other lines pass through: %r' % none)
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'the table costs no model call')
    reg = p.evaluate('() => ["log_talk", "follow_up", "log_send", "remind_me"].map(n => { const a = M.agent.byName(n); return [a.who, a.mode, !!a.out, a.gloss]; })')
    check(reg[0] == ['self', 'now', False, 'log a talk or meeting, private'] and reg[1] == ['self', 'now', False, 'a private follow-up date'] and reg[2] == ['self', 'now', False, 'where a pitch was sent, or a reply'], 'the three actions are self, now, no outward flag: %r' % reg)
    check(reg[3][3] == 'a private reminder on a day', 'remind_me is private: %r' % reg[3])

    # ---- one line end to end ----
    r = p.evaluate('''async () => { const c = M.lastCtx; const r = await M.agent.capture(c, "Met Rahul from Tata, sent the deck, he said talk after the 16th", {}); await new Promise(x => setTimeout(x, 500));
      const runs = await M.agent.ledger(c); const run = runs[runs.length - 1]; const act = run.acts[run.acts.length - 1];
      return {text: r.text, chips: r.chips.map(x => x.label || x), undoId: r.undoId, action: r.action, fid: r.fid, pid: r.pid, pitch: r.pitch, bridged: r.bridged, hold: r.hold.length, error: !!r.error,
        run: {said: run.said, via: run.via, action: act.action, status: act.status, undoK: act.undo && act.undo.k, undoable: M.agent.undoable(act), id: act.id}}; }''')
    check(not r['error'] and r['text'] == 'Logged. Met Rahul at Tata, deck sent. I will remind you on Sat 17 Oct at 10:00. Tata next step: Sat 17 Oct.', 'the receipt: %r' % r['text'])
    check(r['chips'][:2] == ['Undo', 'Tomorrow'] and 'Keep the date private' in r['chips'] and r['action'] == 'log_talk' and r['bridged'] and r['hold'] == 0, 'the chips and the action: %r' % r)
    check(r['run']['via'] == 'typed' and r['run']['action'] == 'log_talk' and r['run']['status'] == 'done' and r['run']['undoK'] == 'pros' and r['run']['undoable'] and r['run']['id'] == r['undoId'], 'the ledger row with a same-day undo: %r' % r['run'])
    ix = doc(IX)
    check(r['fid'] in ix['fu'] and r['pid'] in ix['people'] and doc('pitches/pt_tata')['nextDate'] == '2026-10-17', 'the index and the pitch carry it')
    # the pitch date changes by hand, then undo: the private rows go, the pitch stays
    t = doc('pitches/pt_tata')
    h.seed_doc(p, 'pitches/pt_tata', {**t, 'nextDate': '2026-10-20', 'updated': NOW})
    p.wait_for_timeout(400)
    u = p.evaluate('''async () => { const c = M.lastCtx; const g = await M.agent.runGrammar(c, null, M.agent.parse("undo that", c), {id: "t-undo", via: "typed", said: "undo that"}); await new Promise(x => setTimeout(x, 500)); return g.text; }''')
    check(u == "Undone. Tata's next step changed since, so I left it.", 'undo says what it left: %r' % u)
    ix = doc(IX)
    t = doc('pitches/pt_tata')
    check(ix['fu'].get(r['fid']) is None and ix['people'].get(r['pid']) is None and t['nextDate'] == '2026-10-20' and t['next'] == 'Follow up on deck', 'the private rows are gone, the hand-set date stays: %r' % {k: t.get(k) for k in ('next', 'nextDate')})
    check(t['sent'].get(list(t['sent'])[0]) is None if t.get('sent') else True, 'the send row is withdrawn')
    st = p.evaluate('async () => { const runs = await M.agent.ledger(M.lastCtx); const run = runs[runs.length - 2]; return run.acts[0].status; }')
    check(st == 'undone', 'the ledger reads undone: %r' % st)
    # undo after the IST day has passed is refused: the row is not undoable then
    late = p.evaluate('async () => { const runs = await M.agent.ledger(M.lastCtx); const row = {...runs[runs.length - 2].acts[0], status: "done", undo: {k: "pros", day: "2026-10-04"}}; return M.agent.undoable(row); }')
    check(late is False, 'a prospects run undoes only on its own IST day')

    # ---- by voice: the ledger says so, the spoken line is short ----
    v = p.evaluate('''async () => { const c = M.lastCtx; const g = await M.agent.runGrammar(c, null, M.agent.parse("spoke to Anil at Titan, follow up next week", c), {id: "t-voice", via: "voice", said: "spoke to Anil at Titan, follow up next week"});
      await new Promise(x => setTimeout(x, 400)); const runs = await M.agent.ledger(c); const run = runs[runs.length - 1]; return {text: g.text, via: run.via, spoken: M.assistant.spoken(g.text), hold: M.brain.pending.list.map(x => x.label)}; }''')
    check(v['text'].startswith('Logged. Spoke to Anil at Titan. I will remind you on Mon 12 Oct at 10:00.') and v['via'] == 'voice', 'a spoken line lands in the ledger by voice: %r' % v)
    check(v['hold'] == ['Add Titan to the pipeline?'], 'a brand off the pipeline offers a new pitch on a tap: %r' % v['hold'])
    check(len(v['spoken'].split(' ')) <= 24 and v['spoken'].startswith('Logged.'), 'the spoken reply is short: %r' % v['spoken'])
    p.evaluate('() => { M.brain.pending.list.slice().forEach(x => M.brain.drop(x.id)); }')

    # ---- done, snooze, keep the date private, what is due ----
    d = p.evaluate('''async () => { const c = M.lastCtx; const nm = await M.ai.names(c); const g = async s => { const parsed = M.agent.parse(s, c, nm); const r = parsed ? await M.agent.runGrammar(c, nm, parsed, {id: "t" + Math.random(), via: "typed", said: s}) : {text: null}; await new Promise(x => setTimeout(x, 350)); return [parsed && parsed.action, r.text]; };
      const out = {};
      out.cap = await g("Rahul from Tata said talk after the 16th");
      out.tata = (window.__db.get("pitches/pt_tata") || {}).nextDate;
      out.list = await g("who do I follow up with today");
      out.meet = await g("meeting with Kavya from Lakme on Thursday at 4");
      out.week = await g("who am I meeting this week");
      out.priv = await g("keep the date private");
      out.tata2 = window.__db.get("pitches/pt_tata");
      out.snooze = await g("snooze Rahul to Monday");
      out.done = await g("done with Rahul");
      out.undoDone = await g("undo that");
      M.brain.pending.list.slice().forEach(x => M.brain.drop(x.id));
      return out; }''')
    check(d['cap'] == ['follow_up', 'Noted. I will remind you on Sat 17 Oct at 10:00. Tata next step: Sat 17 Oct.'] and d['tata'] == '2026-10-17', 'a follow-up by its words, bridged onto the pitch: %r' % d['cap'])
    check(d['list'] == ['follow_up', 'Nothing to follow up today.'], 'what is due today reads back from the index: %r' % d['list'])
    check(d['meet'][0] == 'log_talk' and d['meet'][1].startswith('Logged. Meeting with Kavya at Lakme on Thu 8 Oct at 16:00. Kept in m360 only.') and 'Add Lakme to the pipeline? Tap it, or say yes.' in d['meet'][1], 'a meeting plan, with a new pitch offered on a tap: %r' % d['meet'])
    check(d['week'] == ['follow_up', '1 meeting this week. Kavya at Lakme, Thu 8 Oct at 16:00.'], 'the meetings read back: %r' % d['week'])
    check(d['priv'] == ['follow_up', 'Kept private. Tata shows no date from you.'] and d['tata2']['nextDate'] == '' and d['tata2']['nextBy'] == '', 'keep the date private takes the mirrored date off the pitch: %r' % d['priv'])
    check(d['snooze'] == ['follow_up', 'Snoozed. Rahul comes back on Mon 12 Oct.'], 'snooze by name: %r' % d['snooze'])
    check(d['done'] == ['follow_up', 'Done with Rahul. When next?'], 'done by name offers when next: %r' % d['done'])
    check(d['undoDone'] == ['undo', 'Undone.'], 'done undoes: %r' % d['undoDone'])
    ix = doc(IX)
    rahul = [f for f in ix['fu'].values() if f and f['x'] == 'talk after the 16th' and not f.get('done')]
    check(len(rahul) == 1 and rahul[0]['d'] == '2026-10-12' and not rahul[0].get('mirror'), 'Rahul is open again on Monday, private: %r' % rahul)

    # ---- a tainted turn holds the shared send ----
    tt = p.evaluate('''async () => { const c = M.lastCtx; const turn = {id: "t-taint", via: "typed", tainted: true, from: "the mail"};
      const r = await M.agent.exec(c, null, "log_send", {line: "Sent the Nykaa deck to Priya"}, {turn}); await new Promise(x => setTimeout(x, 400));
      const card = M.brain.pending.list.find(x => x.turn === "t-taint");
      const before = (window.__db.get("pitches/pt_nykaa") || {}).sent || {};
      const fu = Object.values((window.__db.get("data/users/u_founder/prospects") || {}).fu || {}).filter(f => f && !f.done && f.pi === "pt_nykaa");
      if (card) await M.brain.approve(card.id); await new Promise(x => setTimeout(x, 400));
      const after = (window.__db.get("pitches/pt_nykaa") || {}).sent || {};
      return {say: r.say, label: card && card.label, detail: card && card.detail, before: Object.keys(before).length, after: Object.keys(after).length, fu: fu.map(f => f.src)}; }''')
    check(tt['label'] == 'Log the send on Nykaa?' and 'From what I read in the mail' in tt['detail'] and tt['before'] == 0 and tt['after'] == 1, 'a tainted turn waits for a tap before the shared row: %r' % tt)
    check(tt['fu'] == [] and 'Tap it, or say yes.' in tt['say'], 'no check-back without the send, and the receipt points at the card: %r' % tt['say'])

    # ---- remind_me is private; look_up prospects ----
    rm = p.evaluate('''async () => { const c = M.lastCtx, nm = await M.ai.names(c); const r = await M.brain.act(c, nm, null, "remind_me", {text: "call Swisse", when: "2030-01-15"}); await new Promise(x => setTimeout(x, 400));
      const tasks = Object.values(c.coll.tasks.map).filter(t => /Reminder/.test(t.title || "")).length;
      const fu = Object.values((window.__db.get("data/users/u_founder/prospects") || {}).fu || {}).filter(f => f && f.x === "call Swisse");
      const look = await M.brain.lookUp(c, nm, "prospects", "rahul");
      return {ok: r.ok, say: r.say, tasks, fu: fu.map(f => [f.d, f.p, f.src]), look: look.split("\\n").slice(0, 2), untrusted: M.brain.UNTRUSTED.indexOf("prospects"), area: M.brain.areasFor(c).some(a => a[0] === "prospects")}; }''')
    check(rm['ok'] and rm['tasks'] == 0 and rm['fu'] == [['2030-01-15', '', 'remind']] and rm['say'] == 'I will remind you on Tue 15 Jan at 10:00.', 'remind_me writes a private follow-up and no task: %r' % rm)
    check(rm['look'][0].startswith('YOUR FOLLOW-UPS:') and rm['untrusted'] < 0 and rm['area'], 'look_up prospects reads own data and is never untrusted: %r' % rm['look'])

    # ---- Home quick add: a prospect line never becomes a task ----
    be('founder', '#home')
    p.wait_for_selector('#quick-add')
    n0 = p.evaluate('() => Object.keys(M.lastCtx.coll.tasks.map).length')
    p.fill('#quick-add', 'Spoke to Meera at Swisse, talk after the 16th')
    p.keyboard.press('Enter')
    p.wait_for_function('() => Object.values((window.__db.get("data/users/u_founder/prospects") || {}).people || {}).some(x => x && x.who === "Meera")')
    p.wait_for_timeout(400)
    check(p.evaluate('() => Object.keys(M.lastCtx.coll.tasks.map).length') == n0 and p.evaluate('() => document.querySelector("#quick-add").value') == '', 'the quick add guard: a prospect line goes to Prospects, no task')
    p.fill('#quick-add', 'Cut the teaser')
    p.keyboard.press('Enter')
    p.wait_for_function('n => Object.keys(M.lastCtx.coll.tasks.map).length === n + 1', arg=n0)
    check(p.evaluate('() => Object.values(M.lastCtx.coll.tasks.map).some(t => t.title === "Cut the teaser")'), 'a plain line is still a task')

    # ---- Cmd K ----
    p.keyboard.press('Control+k')
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'Called Sameer at Raymond, he will revert by friday')
    p.wait_for_selector('.pal-item[data-group="log it"]')
    row = p.locator('.pal-item[data-group="log it"]').first
    check(row.inner_text().startswith('Log it: Called Sameer at Raymond') and p.evaluate('() => document.querySelector(".pal-item.on").dataset.group') == 'log it', 'the Log it row sits first and is selected: %r' % row.inner_text())
    p.keyboard.press('Enter')
    p.wait_for_function('() => Object.values((window.__db.get("data/users/u_founder/prospects") || {}).people || {}).some(x => x && x.who === "Sameer")')
    check(p.locator('#pal-input').count() == 0, 'the palette closes after logging')
    p.keyboard.press('Control+k')
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'follow')
    p.wait_for_timeout(300)
    labels = p.evaluate('() => [...document.querySelectorAll(".pal-item")].map(b => [b.dataset.group, b.querySelector(".t").textContent])')
    check(['actions', 'New follow-up'] in labels and not any(g == 'log it' for g, _ in labels), 'New follow-up is an action row, and a bare word is not a capture: %r' % labels)
    p.fill('#pal-input', 'prospects')
    p.wait_for_timeout(300)
    labels = p.evaluate('() => [...document.querySelectorAll(".pal-item")].map(b => [b.dataset.group, b.querySelector(".t").textContent])')
    check(['go to', 'Prospects'] in labels, 'the Prospects page is a go to row: %r' % labels)
    p.keyboard.press('Escape')

    # ---- the budget and the offline copy ----
    cat = p.evaluate('''async () => { const c = M.lastCtx, nm = await M.ai.names(c); const tools = M.brain.tools(c, nm, () => {}, {id: "t-cat", via: "typed", tainted: false});
      const act = tools.find(t => t.name === "act"); const names = M.agent.actionsFor(c).map(a => a.name);
      return {len: act.description.length, missing: names.filter(n => act.description.indexOf(n) < 0), n: names.length, offline: M.agent.OFFLINE.chips, line: M.agent.OFFLINE.line}; }''')
    check(cat['len'] < 3600 and not cat['missing'] and cat['n'] >= 36, 'the act description stays under 3,600 with every action named: %r' % {k: cat[k] for k in ('len', 'missing', 'n')})
    check('Spoke to Meera at Swisse, talk after the 16th' in cat['offline'][:4] and 'follow up' in cat['line'], 'the offline chips offer a capture: %r' % cat['offline'])
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call throughout')
    os.makedirs(SHOTS, exist_ok=True)
    p.screenshot(path=os.path.join(SHOTS, 'capture-home-1280.png'))
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    print('test_prospects_capture: %d checks passed' % len(checks))


run(test)
