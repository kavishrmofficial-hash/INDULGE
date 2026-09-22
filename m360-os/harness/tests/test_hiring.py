#!/usr/bin/env python3
"""Hiring module test: founder adds a candidate, m1 evaluates, m2 sees nothing of it, founder decides with
tap-again, m1's drawer turns read only; at 1280 and 390, console clean, no horizontal overflow.

Run: M360_MODULES=33-hiring.js M360_TAG=hiring python3 harness/tests/test_hiring.py
Playwright contexts keep separate localStorage, so every page after the first opens inside the first
page's context: the store is shared there and storage events keep every open page live.
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
WHY = 'Ships clean decks fast'
RISK = 'Thin on production experience'


def fmt(ymd):
    d = date.fromisoformat(ymd)
    return '%d %s %d' % (d.day, MON[d.month - 1], d.year)


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def open_page(h, ctx, ident, hsh, width):
    """A page inside an existing context, so it shares that context's store."""
    page = ctx.new_page()
    page.set_viewport_size({'width': width, 'height': 900})
    page.set_default_timeout(8000)
    page.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    page.goto(h.url(ident, hsh))
    h.ready(page)
    page.wait_for_timeout(250)
    return page


def seg(page, name, option):
    page.get_by_role('tablist', name=name, exact=True).get_by_role('tab', name=option, exact=True).click()
    page.wait_for_timeout(40)


def candidates(page):
    return page.evaluate('''() => {
      const s = window.__db.store(); const out = {};
      for (const k of Object.keys(s)) if (k.startsWith('candidates/')) out[k.slice(11)] = s[k];
      return out;
    }''')


def layout(h, page, label, opened):
    ov = h.overflow(page)
    check(ov == 0, '%s: horizontal overflow %dpx' % (label, ov))
    st = h.small_text(page)
    check(not st, '%s: text under 11px %r' % (label, st[:3]))
    opened.append(label)


def test(h):
    opened = []
    deadline = (date.today() + timedelta(days=7)).isoformat()

    # 1. founder at 1280: empty page, then a new candidate through the drawer
    pf = h.open('founder', width=1280, hash='#hiring', reset=True)
    h.roster(pf, ('u_m1', 'u_m2'))
    pf.wait_for_selector('h1.pgt:has-text("Hiring")')
    pf.wait_for_timeout(200)
    check('No candidates yet.' in pf.inner_text('#hiring-list'), 'empty state on a fresh workspace')
    layout(h, pf, 'founder list 1280', opened)
    pf.get_by_role('button', name='New candidate').click()
    pf.wait_for_selector('#cand-name')
    pf.fill('#cand-name', 'Priya Nair')
    pf.fill('#cand-role', 'Brand strategist')
    pf.select_option('#cand-stage', 'panel')
    pf.fill('#cand-links', 'https://portfolio.example.com\ndocs.example.com/test-brief\nhttps://drive.example.com/submission')
    pf.fill('#cand-notes', 'Two years at a Bangalore agency. Look at the second reel script.')
    pf.fill('#cand-deadline', deadline)
    pf.wait_for_selector('#cand-ev-u_m1:has-text("Durvesh Patil")')
    pf.wait_for_selector('#cand-ev-u_m2:has-text("Aanya Mehta")')
    check(pf.locator('#cand-ev-u_founder').count() == 0, 'the founder is never an evaluator option')
    pf.check('#cand-ev-u_m1 input')
    pf.check('#cand-ev-u_m2 input')
    pf.get_by_role('button', name='Add candidate').click()
    pf.wait_for_selector('.toast:has-text("Candidate added")')
    pf.wait_for_timeout(300)
    cands = candidates(pf)
    check(len(cands) == 1, 'one candidate stored: %r' % cands)
    cid = list(cands)[0]
    c = cands[cid]
    check(c['name'] == 'Priya Nair' and c['role'] == 'Brand strategist' and c['stage'] == 'panel', c)
    check(c['links'].startswith('https://portfolio.example.com') and 'submission' in c['links'], c)
    check(c['evaluators'] == ['u_m1', 'u_m2'] and c['deadline'] == deadline, c)
    check(c['decision'] == '' and c['decidedAt'] is None and c['created'], c)
    check('Bangalore' in c['notes'], c)
    pf.wait_for_function('() => location.hash === "#hiring/%s"' % cid)
    pf.wait_for_selector('#hiring-candidate:has-text("0 of 2 evaluations")')
    body = pf.inner_text('#hiring-list')
    check('Priya Nair' in body and 'panel' in body and 'due ' + fmt(deadline) in body and '0 of 2 evaluations' in body, body)
    check(pf.locator('#hiring-candidate a[target="_blank"][rel~="noopener"]').count() == 3, 'three link anchors on the candidate page')
    check(pf.locator('#hiring-eval-u_m1 .pill.flame-o:has-text("not submitted")').count() == 1, 'm1 not submitted')
    check(pf.locator('#hiring-eval-u_m2 .pill.flame-o:has-text("not submitted")').count() == 1, 'm2 not submitted')
    check(h.ctx(pf, 'M.hiring.panel(ctx)') == [{'id': cid, 'candidate': 'Priya Nair', 'submitted': 0, 'total': 2}], 'panel before any evaluation')

    # 2. m1 at 1280: the card carries the due marker, the drawer takes the evaluation
    p1 = open_page(h, pf.context, 'm1', '#hiring', 1280)
    p1.wait_for_selector('#cand-%s:has-text("evaluation due")' % cid)
    check(p1.locator('#cand-%s .dotflame' % cid).count() == 1, 'flame dot on the due card')
    check(h.ctx(p1, 'M.hiring.assignedToMe(ctx)') == [cid], 'assigned to m1 before submitting')
    check(h.ctx(p1, 'M.hiring.panel(ctx)') == [{'id': cid, 'candidate': 'Priya Nair', 'submitted': 0, 'total': 2}], 'panel as m1')
    check(p1.locator('button:has-text("New candidate")').count() == 0, 'members never see New candidate')
    layout(h, p1, 'm1 list 1280', opened)
    p1.locator('#cand-%s' % cid).click()
    p1.wait_for_selector('.drawer #eval-note')
    note = p1.inner_text('#eval-note')
    check(note == 'Your evaluation goes to Kaavish only. Nobody else on the panel sees it. Write what you would say to his face.', note)
    links = p1.locator('.drawer a[target="_blank"]')
    check(links.count() == 3, 'three links in the drawer')
    for i in range(3):
        rel = links.nth(i).get_attribute('rel') or ''
        check('noopener' in rel, 'link rel: ' + rel)
    check(links.nth(1).get_attribute('href') == 'https://docs.example.com/test-brief', 'bare links get https')
    submit = p1.get_by_role('button', name='Submit evaluation')
    check(submit.is_disabled(), 'submit starts disabled')
    seg(p1, 'Gets it?', 'Yes')
    seg(p1, 'Wants it?', 'Yes')
    seg(p1, 'Capacity to do it?', 'No')
    seg(p1, 'Quality of work', '4')
    seg(p1, 'Thinking and logic', '5')
    seg(p1, 'Communication', '3')
    seg(p1, 'Ownership (finishes things)', '4')
    seg(p1, 'Culture add', '5')
    seg(p1, 'Would you want them in your pod?', 'Yes')
    seg(p1, 'Verdict', 'Strong yes')
    check(submit.is_disabled(), 'submit stays disabled until both text fields are filled')
    p1.fill('#eval-why', WHY)
    p1.fill('#eval-risk', RISK)
    check(submit.is_enabled(), 'submit enables once every field is set')
    layout(h, p1, 'm1 drawer 1280', opened)
    h.shot(p1, 'hiring-m1-drawer-1280')
    submit.click()
    p1.wait_for_selector('.toast:has-text("Evaluation sent to Kaavish")')
    p1.wait_for_timeout(300)
    ev = p1.evaluate('window.__db.get("evals/u_m1")')
    check(ev and cid in ev['e'], 'evals/u_m1 holds the candidate: %r' % ev)
    e = ev['e'][cid]
    check(e['gwc'] == {'g': 'yes', 'w': 'yes', 'c': 'no'}, e)
    check(e['s'] == {'craft': 4, 'thinking': 5, 'comms': 3, 'ownership': 4, 'culture': 5}, e)
    check(e['pod'] == 'yes' and e['verdict'] == 'strong-yes' and e['why'] == WHY and e['risk'] == RISK and e['at'], e)
    check(p1.locator('.drawer').count() == 0, 'drawer closes after the write')
    p1.wait_for_selector('#cand-%s .pill.ink:has-text("submitted")' % cid)
    check(h.ctx(p1, 'M.hiring.assignedToMe(ctx)') == [], 'nothing assigned once submitted')
    check(h.ctx(p1, 'M.hiring.panel(ctx)[0].submitted') == 1, 'm1 counts their own evaluation')
    # reopening prefills the form
    p1.locator('#cand-%s' % cid).click()
    p1.wait_for_selector('.drawer #eval-why')
    check(p1.input_value('#eval-why') == WHY and p1.input_value('#eval-risk') == RISK, 'prefilled text')
    check(p1.get_by_role('tablist', name='Verdict', exact=True).get_by_role('tab', name='Strong yes', exact=True).get_attribute('aria-selected') == 'true', 'prefilled verdict')
    check('Submit again to replace it.' in p1.inner_text('.drawer'), 'resubmit line')
    p1.keyboard.press('Escape')
    p1.wait_for_timeout(150)
    check(p1.locator('.drawer').count() == 0, 'escape closes the drawer')

    # 3. m2 never sees a word of m1's evaluation
    p2 = open_page(h, pf.context, 'm2', '#hiring', 1280)
    p2.wait_for_selector('#cand-%s:has-text("evaluation due")' % cid)
    check(WHY not in p2.inner_text('body') and RISK not in p2.inner_text('body'), 'm2 list leaks m1 text')
    check('u_m1' not in h.ctx(p2, 'Object.keys(ctx.coll.evals.map)'), 'm2 can read evals/u_m1')
    check(h.ctx(p2, 'M.hiring.panel(ctx)') == [{'id': cid, 'candidate': 'Priya Nair', 'submitted': 0, 'total': 2}], 'panel as m2 shows only visible evaluations')
    check(h.ctx(p2, 'M.hiring.assignedToMe(ctx)') == [cid], 'assigned to m2')
    p2.locator('#cand-%s' % cid).click()
    p2.wait_for_selector('.drawer #eval-note')
    check(WHY not in p2.inner_text('body') and RISK not in p2.inner_text('body'), 'm2 drawer leaks m1 text')
    check(p2.input_value('#eval-why') == '' and p2.input_value('#eval-risk') == '', 'm2 form starts empty')
    check(p2.get_by_role('button', name='Submit evaluation').is_disabled(), 'm2 submit disabled')
    layout(h, p2, 'm2 drawer 1280', opened)
    p2.keyboard.press('Escape')
    p2.wait_for_timeout(150)

    # 4. founder: one of two in, summary, then Hire with the tap-again
    pf.wait_for_selector('#hiring-candidate:has-text("1 of 2 evaluations")')
    pf.wait_for_selector('#hiring-eval-u_m1 .pill.ink:has-text("submitted")')
    check(pf.locator('#hiring-eval-u_m2 .pill.flame-o:has-text("not submitted")').count() == 1, 'm2 still not submitted')
    check('1 of 2 evaluations' in pf.inner_text('#hiring-list'), 'list card counts one of two')
    check(pf.inner_text('#hiring-tally') == 'Strong yes 1', 'tally: ' + pf.inner_text('#hiring-tally'))
    avg = pf.inner_text('#hiring-avg')
    for v in ('4.0', '5.0', '3.0'):
        check(v in avg, 'average %s missing: %r' % (v, avg))
    gwc = pf.inner_text('#hiring-gwc')
    check('Gets it 1 of 1' in gwc and 'Wants it 1 of 1' in gwc and 'Capacity to do it 0 of 1' in gwc, gwc)
    check(pf.locator('#hiring-gwc .pill.ink').count() == 2 and pf.locator('#hiring-gwc .pill.flame-o').count() == 1, 'gwc pill kinds')
    check(WHY in pf.inner_text('#hiring-whys') and RISK in pf.inner_text('#hiring-risks'), 'reason and risk lists')
    ev1 = pf.inner_text('#hiring-eval-u_m1')
    check('Durvesh Patil' in ev1 and WHY in ev1 and RISK in ev1 and 'strong yes' in ev1, ev1)
    check(h.ctx(pf, 'M.hiring.panel(ctx)') == [{'id': cid, 'candidate': 'Priya Nair', 'submitted': 1, 'total': 2}], 'panel as founder')
    layout(h, pf, 'founder candidate 1280', opened)
    h.shot(pf, 'hiring-founder-1280')

    # edit through the same drawer
    pf.locator('#hiring-candidate button:has-text("Edit")').click()
    pf.wait_for_selector('#cand-role')
    check(pf.input_value('#cand-name') == 'Priya Nair' and pf.is_checked('#cand-ev-u_m2 input'), 'edit drawer prefilled')
    pf.fill('#cand-role', 'Senior brand strategist')
    pf.get_by_role('button', name='Save candidate').click()
    pf.wait_for_selector('.toast:has-text("Saved")')
    pf.wait_for_timeout(250)
    c = candidates(pf)[cid]
    check(c['role'] == 'Senior brand strategist' and c['evaluators'] == ['u_m1', 'u_m2'] and c['decision'] == '', c)
    pf.wait_for_selector('#hiring-candidate:has-text("Senior brand strategist")')

    hire = pf.locator('#hiring-decision button:has-text("Hire")')
    check(hire.count() == 1, 'one Hire button')
    hire.click()
    pf.wait_for_selector('#hiring-decision button:has-text("Decide without all evaluations")')
    pf.wait_for_timeout(200)
    check(candidates(pf)[cid]['decision'] == '', 'one tap must change nothing')
    pf.locator('#hiring-decision button:has-text("Decide without all evaluations")').click()
    pf.wait_for_selector('.toast:has-text("Marked hired")')
    pf.wait_for_timeout(300)
    c = candidates(pf)[cid]
    check(c['decision'] == 'hire' and c['stage'] == 'hired' and c['decidedAt'], c)
    pf.wait_for_selector('#hiring-decision .pill.ink:has-text("hired")')
    check(pf.locator('#hiring-decision button').count() == 0, 'no decision buttons after deciding')
    check(pf.locator('#cand-%s .pill.ink:has-text("hired")' % cid).count() == 1, 'list card shows hired')
    check(h.ctx(pf, 'M.hiring.panel(ctx)') == [], 'panel empties once decided')

    # 5. m1 after the decision: read only drawer
    p1.wait_for_selector('#cand-%s .pill.ink:has-text("hired")' % cid)
    p1.locator('#cand-%s' % cid).click()
    p1.wait_for_selector('.drawer #eval-decided')
    check('Decided.' in p1.inner_text('#eval-decided'), 'decided line')
    check(p1.locator('.drawer button:has-text("Submit evaluation")').count() == 0, 'no submit after the decision')
    check(p1.locator('.drawer [role="tablist"]').count() == 0 and p1.locator('.drawer input').count() == 0, 'no controls after the decision')
    d = p1.inner_text('.drawer')
    check(WHY in d and RISK in d and 'strong yes' in d, 'own evaluation shown read only: ' + d)
    layout(h, p1, 'm1 decided drawer 1280', opened)
    p1.keyboard.press('Escape')
    p1.wait_for_timeout(150)
    check(h.ctx(p1, 'M.hiring.assignedToMe(ctx)') == [], 'nothing assigned after the decision')
    check(h.ctx(p2, 'M.hiring.assignedToMe(ctx)') == [], 'm2 is off the hook after the decision')

    # 6. phone width: founder candidate page, m1 list plus drawer
    pf3 = open_page(h, pf.context, 'founder', '#hiring/' + cid, 390)
    pf3.wait_for_selector('#hiring-candidate:has-text("1 of 2 evaluations")')
    layout(h, pf3, 'founder candidate 390', opened)
    h.shot(pf3, 'hiring-founder-390')
    pf3.get_by_role('button', name='New candidate').click()
    pf3.wait_for_selector('#cand-name')
    layout(h, pf3, 'founder new drawer 390', opened)
    pf3.keyboard.press('Escape')
    p13 = open_page(h, pf.context, 'm1', '#hiring', 390)
    p13.wait_for_selector('#cand-%s' % cid)
    layout(h, p13, 'm1 list 390', opened)
    # a second, open candidate so the phone drawer shows the form
    h.seed_doc(p13, 'candidates/c_two', {'name': 'Arjun Sen', 'role': 'Producer', 'stage': 'test', 'links': 'https://arjun.example.com',
                                        'notes': '', 'evaluators': ['u_m1'], 'deadline': deadline, 'decision': '', 'decidedAt': None,
                                        'created': 1})
    p13.wait_for_selector('#cand-c_two:has-text("evaluation due")')
    p13.locator('#cand-c_two').click()
    p13.wait_for_selector('.drawer #eval-note')
    layout(h, p13, 'm1 drawer 390', opened)
    h.shot(p13, 'hiring-m1-390')
    p13.keyboard.press('Escape')
    check(h.ctx(p13, 'M.hiring.assignedToMe(ctx)') == ['c_two'], 'new open candidate is assigned to m1')
    check(h.ctx(pf, 'M.hiring.panel(ctx)') == [{'id': 'c_two', 'candidate': 'Arjun Sen', 'submitted': 0, 'total': 1}], 'panel picks up the seeded candidate')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    print('layout clean on: ' + ', '.join(opened))
    return True


if __name__ == '__main__':
    try:
        ok = run(test)
    except AssertionError as e:
        print('FAIL:', e)
        sys.exit(1)
    if not ok:
        print('FAIL')
        sys.exit(1)
    print('PASS')
