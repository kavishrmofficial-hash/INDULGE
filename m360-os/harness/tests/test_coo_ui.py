#!/usr/bin/env python3
"""v33 test: the founder's and the team's COO surfaces (spec parts F, G and O6).

A working Tuesday next week at 15:20 IST, the COO on and out of its practice week. Its ledger for today:
it moved "Swisse reel cutdown" from Durvesh to Aanya, "Studio banner" from Durvesh to Ishaan, and the date of
"Studio footer" from Wednesday to Friday; it approved Ishaan's leave next week. Its cards: a client
follow-up to Swisse, a move proposal (Hero reel script to Ishaan), a structure proposal, Ekta's leave and
Friday review prep for Durvesh.

Checks:
- HQ > COO (#coo-tab) renders the cards (.coo-card[data-kind][data-id]) and today's rows, in light, dark
  and at 390 px with no sideways scroll; the dock badge counts the open cards;
- a card's Apply moves the task as Kaavish (by id, his ownerLog line) and settles the card; Edit saves the
  draft's subject; Decline keeps the note; Later snoozes;
- Undo on a row a person changed since is a conflict: nothing moves, the row says conflict and a card
  explains; Undo on an untouched row puts the date back and the row reads undone;
- Stop and undo today switches the COO off and puts today's moves and its leave approval back;
- Admin > COO (#coo-admin): the ceilings are greyed out (client mail cannot be set to alone) and a rung
  Kaavish raises is saved;
- HQ Workload: "Move it" moves the task with exactly that title by id, through the task's own save, and
  never its look-alike;
- the Week page shows the COO's ghost marks for Durvesh, and Confirm writes them as Kaavish's;
- Ishaan's Leave page reads "Approved by m360 COO, inside policy";
- Aanya's inbox has a 'coo' line "m360 COO handed you Swisse reel cutdown";
- a member's #coo is the charter (#coo-charter), with what the COO never does, and no cards.

Fails until builders 1, 2 and 3 are merged (M.coo, 89-coo.js, the coo rules); the message says so.

Run: cd m360-os && python3 harness/tests/test_coo_ui.py
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


def test(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    real = datetime.now(IST)
    tue = (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()
    today = tue.isoformat()
    lv = (tue + timedelta(days=8)).isoformat()

    def ms(hh, mm, day=0):
        return int((datetime(tue.year, tue.month, tue.day, hh, mm, tzinfo=IST) + timedelta(days=day)).timestamp() * 1000)

    def new_page():
        c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
        h.contexts.append(c)
        c.clock.set_fixed_time(datetime(tue.year, tue.month, tue.day, 15, 20, tzinfo=IST))
        p = c.new_page()
        p.set_default_timeout(20000)
        p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        p.add_init_script('window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };')
        return p

    def be(p, ident, hash):
        p.goto(h.url(ident, hash))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.lastCtx.activeMembers.length > 3)')
        p.wait_for_timeout(600)

    def doc(p, path):
        return p.evaluate('p => window.__db.get(p)', path)

    base = {'client': '', 'project': '', 'section': '', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': False,
            'subtasks': {}, 'comments': {}, 'created': ms(9, 0, -5), 'updated': ms(9, 0, -5), 'doneAt': None, 'by': F}

    def seed(p):
        p.goto(h.url('founder', '#home', reset=True, seed=True))
        h.ready(p)
        p.wait_for_function('() => !!window.__db.get("roster/team")')
        h.roster(p, [M1, M2, M3, M4], extra={M1: {'pod': 'Pod 1'}, M2: {'pod': 'Pod 1'}, M3: {'pod': 'Pod 2'}, M4: {'pod': 'Pod 2', 'title': 'Ekta Shah'}})
        due = (tue + timedelta(days=3)).isoformat()
        h.seed_doc(p, 'tasks/t_reel', {**base, 'title': 'Swisse reel cutdown', 'owner': M2, 'due': due, 'status': 'todo', 'updated': ms(15, 0), 'updatedBy': BOT,
                                       'ownerLog': [{'from': M1, 'to': M2, 'by': BOT, 'at': ms(15, 0), 'why': 'overload'}]})
        h.seed_doc(p, 'tasks/t_ban', {**base, 'title': 'Studio banner', 'owner': M3, 'due': due, 'status': 'todo', 'updated': ms(11, 0), 'updatedBy': BOT,
                                      'ownerLog': [{'from': M1, 'to': M3, 'by': BOT, 'at': ms(11, 0), 'why': 'overload'}]})
        wed, fri = (tue + timedelta(days=1)).isoformat(), (tue + timedelta(days=3)).isoformat()
        h.seed_doc(p, 'tasks/t_foot', {**base, 'title': 'Studio footer', 'owner': M1, 'due': fri, 'status': 'todo', 'updated': ms(12, 0), 'updatedBy': BOT,
                                       'dueLog': [{'from': wed, 'to': fri, 'by': BOT, 'at': ms(12, 0), 'why': 'pileup'}]})
        h.seed_doc(p, 'tasks/t_hero', {**base, 'title': 'Hero reel script', 'owner': M1, 'due': (tue + timedelta(days=6)).isoformat(), 'status': 'todo'})
        h.seed_doc(p, 'tasks/t_cb', {**base, 'title': 'Creator brief', 'owner': M2, 'due': (tue - timedelta(days=2)).isoformat(), 'status': 'todo'})
        h.seed_doc(p, 'tasks/t_cb2', {**base, 'title': 'Creator brief v2', 'owner': M2, 'due': (tue - timedelta(days=2)).isoformat(), 'status': 'todo'})
        h.seed_doc(p, 'leave/' + M3, {'reqs': [{'id': 'L9', 'from': lv, 'to': lv, 'type': 'casual', 'at': ms(9, 0, -2)}]})
        h.seed_doc(p, 'leavedec/' + M3, {'d': {'L9': {'status': 'approved', 'at': ms(10, 0), 'by': BOT, 'why': 'leave', 'checks': [],
                                                       'snap': {'from': lv, 'to': lv, 'type': 'casual', 'days': 1}, 'undoUntil': ms(9, 0, 8)}}})
        h.seed_doc(p, 'leave/' + M4, {'reqs': [{'id': 'L5', 'from': lv, 'to': lv, 'type': 'other', 'at': ms(11, 0)}]})
        wk = p.evaluate('() => M.U.isoWeek(new Date())')
        h.seed_doc(p, 'plan/' + M1, {'weeks': {wk: {'items': [{'id': 'o1', 'text': 'Ship the Swisse reel'}, {'id': 'o2', 'text': 'Studio site copy'}], 'at': ms(10, 0, -1)}}})
        s = p.evaluate('() => window.__db.get("settings/app") || {}')
        s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -9), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
        h.seed_doc(p, 'settings/app', s)

        def row(job, code, cap, args, refs, before, after, undo, at, why='overload'):
            return {'at': at, 'slot': 'r15', 'job': job, 'cap': cap, 'rung': 'tell', 'code': code, 'station': 'board', 'subject': 'task:' + (refs.get('task') or refs.get('uid')),
                    'args': args, 'refs': refs, 'why': {'code': why, 'args': {}}, 'checks': [{'k': 'load', 'ok': True, 'val': 9, 'limit': 6}], 'facts': [],
                    'before': before, 'after': after, 'told': [], 'undo': undo, 'status': 'done'}
        until = ms(15, 0, 1)
        acts = {
            'a_move': row('J31', 'rebalance', 'rebalance', {'task': 't_reel', 'uid': M1, 'to': M2, 'open': 9, 'over': 3, 'open2': 3, 'until': until},
                          {'task': 't_reel', 'uid': M1, 'to': M2}, {'owner': M1}, {'owner': M2}, {'k': 'task', 'task': 't_reel', 'fields': ['owner'], 'until': until}, ms(15, 0)),
            'a_ban': row('J31', 'rebalance', 'rebalance', {'task': 't_ban', 'uid': M1, 'to': M3, 'open': 9, 'over': 3, 'open2': 2, 'until': ms(11, 0, 1)},
                         {'task': 't_ban', 'uid': M1, 'to': M3}, {'owner': M1}, {'owner': M3}, {'k': 'task', 'task': 't_ban', 'fields': ['owner'], 'until': ms(11, 0, 1)}, ms(11, 0)),
            'a_foot': row('J35', 'pileup', 'shift', {'task': 't_foot', 'uid': M1, 'n': 3, 'day': wed, 'due': fri, 'until': ms(12, 0, 1)},
                          {'task': 't_foot', 'uid': M1}, {'due': wed}, {'due': fri}, {'k': 'task', 'task': 't_foot', 'fields': ['due'], 'until': ms(12, 0, 1)}, ms(12, 0), why='pileup'),
            'a_leave': {'at': ms(10, 0), 'slot': 'w1000', 'job': 'J10', 'cap': 'leave', 'rung': 'tell', 'code': 'leave_ok', 'station': 'calendar', 'subject': 'leave:' + M3 + ':L9',
                        'args': {'uid': M3, 'd1': lv, 'd2': lv, 'left': 5, 'out': 1, 'type': 'casual', 'until': ms(9, 0, 8)}, 'refs': {'uid': M3, 'req': 'L9'},
                        'why': {'code': 'leave', 'args': {}}, 'checks': [], 'facts': [], 'before': {}, 'after': {'status': 'approved'}, 'told': [],
                        'undo': {'k': 'leave', 'uid': M3, 'req': 'L9', 'until': ms(9, 0, 8)}, 'status': 'done'}}
        h.seed_doc(p, 'coo/L-' + today, {'acts': acts})

        def card(i, kind, title, payload, refs, **k):
            c = {'id': i, 'kind': kind, 'rung': 'propose', 'title': title, 'why': '', 'recommend': '', 'checks': [], 'options': [], 'payload': payload, 'sources': [],
                 'refs': refs, 'urgent': False, 'dedupe': kind + ':' + i, 'by': BOT, 'at': ms(12, 0), 'expires': ms(12, 0, 3), 'status': 'open', 'code': '', 'args': {}}
            c.update(k)
            return c
        h.seed_doc(p, 'coo/dec', {'items': {
            'c_mail': card('c_mail', 'client_mail', 'Drafted a follow-up to Swisse. It waits for your tap.',
                           {'action': '', 'input': {}, 'draft': {'to': 'priya@swisse.example', 'cc': '', 'subject': 'Following up on the Swisse proposal', 'text': 'Hi Priya, a quick follow-up.'}},
                           {'client': 'cl_sw'}, rung='draft'),
            'c_move': card('c_move', 'move', 'Hero reel script could go to Ishaan. Durvesh has 9 open.', {'action': 'coo.move_task', 'input': {'task': 't_hero', 'owner': M3, 'why': 'overload'}, 'draft': None},
                           {'task': 't_hero', 'uid': M1, 'to': M3}),
            'c_prop': card('c_prop', 'proposal', 'Two people have no reporting line and fall back to you.', {'action': 'coo.ack', 'input': {}, 'draft': None}, {}),
            'c_leave': card('c_leave', 'leave', 'Ekta asked for leave on ' + lv + '. It needs you.', {'action': 'coo.approve_leave', 'input': {'uid': M4, 'req': 'L5', 'from': lv, 'to': lv}, 'draft': None},
                            {'uid': M4, 'req': 'L5'}, urgent=True),
            # the engine's J18 shape: the marks ride on the option and on the draft, the evidence is {item, task}
            'c_rev': card('c_rev', 'review', 'Friday review prep is ready for Durvesh.',
                          {'action': '', 'input': {}, 'draft': {'marks': {'o1': 'hit', 'o2': 'miss'}, 'evidence': [{'item': 'o1', 'task': 't_hero'}]}},
                          {'uid': M1}, rung='draft', code='review_prep', args={'uid': M1, 'n': 1, 'week': wk},
                          options=[{'label': 'Confirm marks', 'action': 'coo.confirm_marks', 'input': {'uid': M1, 'week': wk, 'marks': {'o1': 'hit', 'o2': 'miss'}}}])}})
        p.wait_for_timeout(500)
        return wk

    p = new_page()
    wk = seed(p)

    # ---- the Leave page, as Ishaan ----
    be(p, 'm3', '#leave')
    p.wait_for_selector('#leave-mine .leave-by')
    check('Approved by m360 COO, inside policy' in p.inner_text('#leave-mine'), 'Ishaan\'s Leave page names the COO\'s approval')

    be(p, 'founder', '#coo')
    if not p.evaluate('() => !!(M.coo && M.pages && M.pages.Coo)'):
        raise AssertionError('the COO tab is not on the page: this test runs once builders 1 and 2 are merged')
    try:
        p.wait_for_selector('#coo-tab .coo-card[data-id="c_mail"]', timeout=20000)
    except Exception:
        raise AssertionError('the COO tab never showed the seeded cards: check the founder subscriptions to coo/dec and the coo rules')
    kinds = p.evaluate('() => [...document.querySelectorAll("#coo-tab .coo-card")].map(c => [c.dataset.kind, c.dataset.id])')
    check({k for k, _ in kinds} >= {'client_mail', 'move', 'proposal', 'leave', 'review'}, 'the cards render with their kind and id: %r' % kinds)
    p.wait_for_selector('.coo-row[data-id="a_move"]')
    check(p.locator('.coo-row[data-id="a_move"] [data-act="undo"]').count() == 1, 'today\'s rows show Undo while it holds')
    os.makedirs(SHOTS, exist_ok=True)
    p.screenshot(path=os.path.join(SHOTS, 'coo-tab-1280-light.png'), full_page=True)
    p.emulate_media(color_scheme='dark')
    p.wait_for_timeout(400)
    p.screenshot(path=os.path.join(SHOTS, 'coo-tab-1280-dark.png'), full_page=True)
    bg = p.evaluate('() => { const c = getComputedStyle(document.querySelector(".coo-card")); return [c.backgroundColor, c.color]; }')
    check(bg[0] != bg[1], 'a card reads in dark: %r' % bg)
    p.emulate_media(color_scheme='light')
    badge = p.evaluate('() => { const b = document.querySelector(".dock-badge"); return b ? b.textContent.trim() : ""; }')
    open_n = p.evaluate('() => M.coo.decisions(M.lastCtx).length')
    check(badge.isdigit() and int(badge) >= open_n and open_n >= 5, 'the dock badge counts the open cards: %r of %r' % (badge, open_n))

    # ---- the cards: Apply, Edit, Decline, Later ----
    p.locator('.coo-card[data-id="c_move"] [data-act="apply"]').click()
    p.wait_for_function('() => (window.__db.get("coo/dec").items.c_move || {}).status === "done"')
    hero = doc(p, 'tasks/t_hero')
    check(hero['owner'] == M3 and (hero.get('ownerLog') or [{}])[-1].get('by') == F, 'Apply moves the task as Kaavish: %r' % hero.get('ownerLog'))
    p.locator('.coo-card[data-id="c_mail"] [data-act="edit"]').click()
    subj = p.locator('.coo-card[data-id="c_mail"] .coo-edit input').nth(2)
    subj.fill('Following up on the Swisse launch proposal')
    p.locator('.coo-card[data-id="c_mail"] .coo-acts button', has_text='Save').click()
    p.wait_for_function('() => window.__db.get("coo/dec").items.c_mail.payload.draft.subject === "Following up on the Swisse launch proposal"')
    check(True, 'Edit saves the draft in place')
    p.locator('.coo-card[data-id="c_prop"] [data-act="decline"]').click()
    p.locator('.coo-card[data-id="c_prop"] .coo-note input').fill('Not this month')
    p.locator('.coo-card[data-id="c_prop"] .coo-note button', has_text='Decline').click()
    p.wait_for_function('() => window.__db.get("coo/dec").items.c_prop.status === "declined"')
    check('Not this month' in (doc(p, 'coo/dec')['items']['c_prop'].get('result') or ''), 'Decline keeps the note')
    p.locator('.coo-card[data-id="c_leave"] [data-act="later"]').click()
    p.wait_for_function('() => window.__db.get("coo/dec").items.c_leave.status === "snoozed"')
    check(not (doc(p, 'leavedec/' + M4) or {}).get('d'), 'Later snoozes the card and decides nothing')

    # ---- Undo: a conflict, then a clean one ----
    p.evaluate('t => { const d = window.__db.get("tasks/t_reel"); window.__db.set("tasks/t_reel", {...d, owner: "u_m3", ownerLog: (d.ownerLog || []).concat([{from: "u_m2", to: "u_m3", by: "u_m2", at: t}])}); }', ms(15, 10))
    p.wait_for_timeout(600)
    p.locator('.coo-row[data-id="a_move"] [data-act="undo"]').click()
    p.wait_for_function('d => !!((window.__db.get("coo/L-" + d).acts.a_move || {}).conflict)', arg=today)
    rr = doc(p, 'coo/L-' + today)['acts']['a_move']
    check(rr['status'] == 'done' and doc(p, 'tasks/t_reel')['owner'] == M3, 'a row a person changed since stays, marked conflict: %r' % rr.get('conflict'))
    p.wait_for_function('() => Object.values(window.__db.get("coo/dec").items).some(c => /Could not undo/.test(c.title || ""))')
    check(True, 'and a card says what changed')
    p.locator('.coo-row[data-id="a_foot"] [data-act="undo"]').click()
    p.wait_for_function('d => window.__db.get("coo/L-" + d).acts.a_foot.status === "undone"', arg=today)
    check(doc(p, 'tasks/t_foot')['due'] == (tue + timedelta(days=1)).isoformat(), 'a clean undo puts the date back')
    p.wait_for_timeout(500)
    check(p.locator('.coo-row[data-id="a_foot"] .coo-undone').count() == 1, 'the row reads undone by Kaavish')

    # ---- Stop and undo today ----
    p.locator('#coo-stop-open').click()
    p.wait_for_selector('#coo-stop')
    p.locator('#coo-stop-go').click()
    p.wait_for_function('() => window.__db.get("settings/app").coo.on === false')
    p.wait_for_function('d => window.__db.get("coo/L-" + d).acts.a_ban.status === "undone"', arg=today)
    check(doc(p, 'tasks/t_ban')['owner'] == M1, 'Stop and undo today switches it off and puts today\'s moves back')
    p.wait_for_function('d => window.__db.get("coo/L-" + d).acts.a_leave.status === "undone"', arg=today)
    check(not ((doc(p, 'leavedec/' + M3) or {}).get('d') or {}).get('L9'), 'and today\'s leave approval goes back to Kaavish')

    # ---- Admin: rungs and ceilings ----
    be(p, 'founder', '#admin')
    p.wait_for_selector('#coo-admin')
    cm = p.locator('#coo-admin [data-cap="clientMail"] [data-rung="alone"]')
    lvr = p.locator('#coo-admin [data-cap="leave"] [data-rung="alone"]')
    check(cm.count() == 1 and (cm.is_disabled() or cm.get_attribute('aria-disabled') == 'true'), 'client mail cannot be set above draft')
    lvr.click()
    p.wait_for_function('() => ((window.__db.get("settings/app").coo || {}).caps || {}).leave === "alone"')
    check(True, 'a rung Kaavish raises is saved')
    p.locator('#coo-admin').screenshot(path=os.path.join(SHOTS, 'coo-admin.png'))

    # ---- HQ Workload: by id, never the look-alike ----
    be(p, 'founder', '#hq')
    wl = p.locator('section.card', has=p.locator('h2', has_text='Workload')).first
    wl.locator('button', has_text='Rebalance').click()
    wl.locator('button', has_text='Move it').first.click()
    p.wait_for_function('() => window.__db.get("tasks/t_cb").owner === "u_m3"')
    cb, cb2 = doc(p, 'tasks/t_cb'), doc(p, 'tasks/t_cb2')
    check(cb2['owner'] == M2 and (cb.get('ownerLog') or [{}])[-1].get('by') == F, 'HQ apply moves exactly that task by id, through its own save: %r' % cb.get('ownerLog'))

    # ---- Week ghost marks ----
    be(p, 'founder', '#week')
    p.wait_for_selector('.coo-ghost-head[data-uid="u_m1"]')
    p.locator('.coo-ghost-head[data-uid="u_m1"] [data-act="confirm"]').click()
    p.wait_for_function('([u, w]) => (((window.__db.get("review/" + u) || {}).weeks || {})[w] || {}).marks', arg=[M1, wk])
    marks = doc(p, 'review/' + M1)['weeks'][wk]['marks']
    check(marks == {'o1': 'hit', 'o2': 'miss'}, 'Confirm writes the ghost marks as Kaavish\'s: %r' % marks)


    # ---- a member's inbox and charter ----
    be(p, 'm2', '#home')
    inbox = p.evaluate('''() => M.inbox.items(M.lastCtx).filter(i => i.kind === "coo")
      .map(i => typeof i.plain === "function" ? i.plain(u => M.coo.isCoo(u) ? M.coo.title(M.lastCtx) : u) : String(i.plain || ""))''')
    check(any('m360 COO handed you Swisse reel cutdown' in x for x in inbox), 'Aanya\'s inbox has the COO\'s line: %r' % inbox)
    be(p, 'm1', '#coo')
    p.wait_for_selector('#coo-charter')
    txt = p.inner_text('#coo-charter')
    check('What I never do' in txt and p.locator('.coo-card').count() == 0, 'a member reads the charter, and no cards')
    check(not p.evaluate('() => { const c = M.lastCtx.coo || {}; return !!(c.dec || (c.L && Object.keys(c.L).length) || c.now); }'), 'a member\'s page holds none of coo/*')
    p.screenshot(path=os.path.join(SHOTS, 'coo-charter-member.png'))

    # ---- the tab at 390, light and dark ----
    p.set_viewport_size({'width': 390, 'height': 844})
    be(p, 'founder', '#coo')
    for dark in (False, True):
        p.emulate_media(color_scheme='dark' if dark else 'light')
        p.wait_for_selector('#coo-tab')
        p.wait_for_timeout(600)
        name = 'coo-tab-390-' + ('dark' if dark else 'light') + '.png'
        p.screenshot(path=os.path.join(SHOTS, name))
        check(h.overflow(p) <= 0, 'no sideways scroll at 390 (%s)' % name)

    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return checks


if __name__ == '__main__':
    out = run(test)
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
