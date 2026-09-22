#!/usr/bin/env python3
"""Projects module: create through the drawer, list, board, overview, phone width, console clean.

Run: M360_MODULES=22-projects.js M360_TAG=projects python3 harness/tests/test_projects.py
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

CAMPAIGN = ['Brief', 'Strategy', 'Creative', 'Production', 'Live', 'Report']


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def doc(page, path):
    return page.evaluate('p => window.__db.get(p) || null', path)


def tasks_of(page, pid):
    return page.evaluate('''pid => {
      const s = window.__db.store(); const out = {};
      for (const k of Object.keys(s)) if (k.startsWith('tasks/') && s[k].project === pid) out[k.slice(6)] = s[k];
      return out;
    }''', pid)


def no_overflow(h, page, where, checks):
    ov = h.overflow(page)
    check(ov == 0, '%s: horizontal overflow %dpx' % (where, ov))
    st = h.small_text(page)
    check(not st, '%s: text under 11px %r' % (where, st[:3]))
    checks.append(where)


def tab(page, name):
    page.get_by_role('tab', name=name, exact=True).click()
    page.wait_for_timeout(150)


def test(h):
    checks = []
    page = h.open('founder', width=1280, hash='#projects', reset=True, seed=True)
    h.roster(page, ('u_m1', 'u_m2'))
    page.wait_for_timeout(250)
    check('Projects' in page.locator('h1.pgt').inner_text(), 'projects list title')
    check('No projects yet.' in page.inner_text('body'), 'empty state on a fresh workspace')
    no_overflow(h, page, 'list 1280', checks)

    # 1. create a Campaign project through the drawer, as founder
    page.get_by_role('button', name='New project').click()
    page.fill('#proj-name', 'Swisse Q4 campaign')
    page.select_option('#proj-kind', 'client')
    page.select_option('#proj-template', 'campaign')
    page.select_option('#proj-client', 'swisse-wellness-uae')
    page.select_option('#proj-owner', 'u_founder')
    page.fill('#proj-due', '2026-10-15')
    page.get_by_role('button', name='Create project').click()
    page.wait_for_function("() => /^#projects\\/.+/.test(location.hash)")
    pid = page.evaluate('location.hash.split("/")[1]')
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(proj is not None, 'project document stored at projects/' + pid)
    secs = proj['sections']
    check([s['name'] for s in secs] == CAMPAIGN, 'six campaign sections stored: %r' % [s['name'] for s in secs])
    check(len(set(s['id'] for s in secs)) == 6, 'section ids unique')
    check(proj['name'] == 'Swisse Q4 campaign' and proj['kind'] == 'client' and proj['client'] == 'swisse-wellness-uae', 'project name, kind, client')
    check(proj['owner'] == 'u_founder' and proj['members'] == ['u_founder'] and proj['status'] == 'on', 'owner, members, status')
    check(proj['due'] == '2026-10-15' and proj['by'] == 'u_founder' and proj['archived'] is False and proj['updates'] == {}, 'due, by, archived, updates')
    page.wait_for_selector('h1.pgt:has-text("Swisse Q4 campaign")')
    check('Swisse Wellness UAE' in page.inner_text('body'), 'client name shown on the page')
    check(page.locator('.pill.ink', has_text='On track').count() >= 1, 'On track pill in ink')
    for s in secs:
        check(page.locator('#sec-' + s['id']).count() == 1, 'list group for ' + s['name'])
    no_overflow(h, page, 'project list tab 1280', checks)

    # 2. add a task inline in Brief
    brief, strategy = secs[0], secs[1]
    page.fill('#add-task-' + brief['id'], 'Write the brief')
    page.press('#add-task-' + brief['id'], 'Enter')
    page.wait_for_timeout(300)
    ts = tasks_of(page, pid)
    check(len(ts) == 1, 'one task stored, found %d' % len(ts))
    tid, task = list(ts.items())[0]
    check(task['status'] == 'todo' and task['section'] == brief['id'] and task['owner'] == 'u_founder', 'task todo, in Brief, owned by me')
    check(task['title'] == 'Write the brief' and task['client'] == 'swisse-wellness-uae', 'task title and client')
    check(page.locator('#sec-' + brief['id']).get_by_text('Write the brief').count() == 1, 'task row shows in Brief')
    check(page.locator('#sec-' + brief['id'] + ' .pill', has_text='To do').count() == 1, 'todo pill on the row')
    check(page.input_value('#add-task-' + brief['id']) == '', 'add task input cleared')
    check('1 of 1 tasks' not in page.inner_text('body') and '0 of 1 tasks' in page.inner_text('body'), 'progress 0 of 1')

    # 3. board: move the task to the next section
    tab(page, 'Board')
    check(page.locator('.colm').count() == 6, 'six board columns')
    card = page.locator('.tcard', has_text='Write the brief')
    check(card.count() == 1, 'task card on the board')
    card.get_by_role('button', name='Move to next section').click()
    page.wait_for_timeout(300)
    task = tasks_of(page, pid)[tid]
    check(task['section'] == strategy['id'], 'task moved to Strategy')
    check(page.locator('.colm[data-section="%s"] .tcard' % strategy['id']).count() == 1, 'card now in the Strategy column')
    no_overflow(h, page, 'project board tab 1280', checks)

    # 4. overview: post an At risk update
    tab(page, 'Overview')
    page.get_by_role('tab', name='At risk', exact=True).click()
    page.fill('#proj-update', 'Client approvals are 3 days late.')
    page.get_by_role('button', name='Post update').click()
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(proj['status'] == 'risk', 'project status risk')
    ups = list(proj['updates'].values())
    check(len(ups) == 1, 'one update stored')
    check(ups[0]['by'] == 'u_founder' and ups[0]['status'] == 'risk' and ups[0]['text'] == 'Client approvals are 3 days late.' and ups[0]['at'] > 0, 'update fields')
    check('Client approvals are 3 days late.' in page.inner_text('body'), 'update text rendered')
    check(page.locator('.pill.flame-o', has_text='At risk').count() >= 2, 'At risk pill in flame outline on header and update')
    check(page.input_value('#proj-update') == '', 'update composer cleared')

    # description
    page.fill('#proj-desc', 'Thirty reels for Q4.')
    page.get_by_role('button', name='Save description').click()
    page.wait_for_timeout(300)
    check(doc(page, 'projects/' + pid)['desc'] == 'Thirty reels for Q4.', 'description saved')

    # members picker
    page.locator('label.checkline', has_text='Durvesh Patil').locator('input').check()
    page.wait_for_timeout(300)
    check(doc(page, 'projects/' + pid)['members'] == ['u_founder', 'u_m1'], 'member added')

    # 5. rename a section
    page.fill('#sec-name-' + brief['id'], 'Brief v2')
    page.press('#sec-name-' + brief['id'], 'Enter')
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(proj['sections'][0]['name'] == 'Brief v2' and proj['sections'][0]['id'] == brief['id'], 'section renamed in place')

    # sections editor: move down, delete rules
    row = page.locator('#sec-name-' + brief['id']).locator('..')
    row.get_by_role('button', name='Move down').click()
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(proj['sections'][1]['id'] == brief['id'] and proj['sections'][0]['id'] == strategy['id'], 'section moved down')
    srow = page.locator('#sec-name-' + strategy['id']).locator('..')
    check(srow.get_by_role('button', name='Delete section').is_disabled(), 'delete disabled while the section has tasks')
    check(srow.get_by_role('button', name='Move up').is_disabled(), 'move up disabled on the first section')
    report = secs[5]
    rrow = page.locator('#sec-name-' + report['id']).locator('..')
    rrow.locator('button').nth(2).click()
    rrow.get_by_role('button', name='Tap again to delete').click()
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(len(proj['sections']) == 5 and all(s['id'] != report['id'] for s in proj['sections']), 'empty section deleted after tap again')
    page.fill('#add-section', 'Wrap')
    page.press('#add-section', 'Enter')
    page.wait_for_timeout(300)
    proj = doc(page, 'projects/' + pid)
    check(proj['sections'][-1]['name'] == 'Wrap' and len(proj['sections']) == 6, 'section added')
    no_overflow(h, page, 'project overview tab 1280', checks)

    # 6. list: tick the checkbox, then untick
    tab(page, 'List')
    cb = page.locator('input[type=checkbox][data-task="%s"]' % tid)
    cb.check()
    page.wait_for_timeout(300)
    task = tasks_of(page, pid)[tid]
    check(task['status'] == 'done' and task['doneAt'] > 0, 'task done with doneAt')
    check(page.locator('#sec-' + strategy['id'] + ' .pill.ink', has_text='Done').count() == 1, 'done pill in ink')
    check('1 of 1 tasks' in page.inner_text('body'), 'progress 1 of 1')
    cb.uncheck()
    page.wait_for_timeout(300)
    task = tasks_of(page, pid)[tid]
    check(task['status'] == 'todo' and task.get('doneAt') is None, 'task reopened, doneAt cleared')

    # projects list shows the card with progress and the risk pill
    page.get_by_role('button', name='All projects').click()
    page.wait_for_timeout(250)
    check(page.get_by_role('button', name='Open Swisse Q4 campaign').count() == 1, 'project card on the list')
    check(page.locator('.pill.flame-o', has_text='At risk').count() == 1, 'risk pill on the card')
    check('0 of 1 tasks' in page.inner_text('body'), 'card progress')
    page.get_by_role('tab', name='Done', exact=True).click()
    page.wait_for_timeout(150)
    check('No projects match these filters.' in page.inner_text('body'), 'done filter empty')
    page.get_by_role('tab', name='Active', exact=True).click()
    page.get_by_role('tab', name='Pitch', exact=True).click()
    page.wait_for_timeout(150)
    check('No projects match these filters.' in page.inner_text('body'), 'kind filter empty')
    page.get_by_role('tab', name='Client', exact=True).click()
    page.wait_for_timeout(150)
    check(page.get_by_role('button', name='Open Swisse Q4 campaign').count() == 1, 'kind filter client')
    page.get_by_role('button', name='Open Swisse Q4 campaign').click()
    page.wait_for_function("() => /^#projects\\/.+/.test(location.hash)")
    page.wait_for_timeout(200)
    check('Swisse Q4 campaign' in page.locator('h1.pgt').inner_text(), 'card opens the project')

    # 7. phone width: every view, no overflow
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(250)
    no_overflow(h, page, 'project list tab 390', checks)
    tab(page, 'Board')
    no_overflow(h, page, 'project board tab 390', checks)
    tab(page, 'Overview')
    no_overflow(h, page, 'project overview tab 390', checks)
    wrap_id = doc(page, 'projects/' + pid)['sections'][-1]['id']
    page.locator('#sec-name-' + wrap_id).locator('..').locator('button').nth(2).click()
    page.wait_for_timeout(100)
    check(page.get_by_role('button', name='Tap again to delete').count() == 1, 'delete armed at 390')
    no_overflow(h, page, 'project overview tab 390 with delete armed', checks)
    page.evaluate("location.hash = '#projects'")
    page.wait_for_timeout(250)
    no_overflow(h, page, 'list 390', checks)
    page.get_by_role('button', name='New project').click()
    page.wait_for_timeout(200)
    no_overflow(h, page, 'new project drawer 390', checks)
    h.shot(page, 'projects-390')

    # a member sees the same project, opens it and can add a task
    page.set_viewport_size({'width': 1280, 'height': 900})
    m = page.context.new_page()
    m.on('console', lambda msg: h.console.append((msg.type, msg.text)) if msg.type in ('error', 'warning') else None)
    m.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    m.goto(h.url('m1', '#projects/' + pid))
    h.ready(m)
    m.wait_for_timeout(250)
    check('Swisse Q4 campaign' in m.locator('h1.pgt').inner_text(), 'member opens the project')
    m.fill('#add-task-' + strategy['id'], 'Draft the strategy')
    m.press('#add-task-' + strategy['id'], 'Enter')
    m.wait_for_timeout(300)
    mt = [t for t in tasks_of(m, pid).values() if t['title'] == 'Draft the strategy']
    check(len(mt) == 1 and mt[0]['owner'] == 'u_m1', 'member task owned by the member')
    no_overflow(h, m, 'member project page 1280', checks)
    h.shot(m, 'projects-member')

    # missing project id
    m.goto(h.url('m1', '#projects/nope'))
    h.ready(m)
    m.wait_for_timeout(200)
    check('No project with this link.' in m.inner_text('body'), 'missing project line')

    errs = h.errors()
    check(not errs, 'console errors: %r' % errs)
    return checks


if __name__ == '__main__':
    try:
        checks = run(test)
    except Exception:
        traceback.print_exc()
        print('FAIL')
        sys.exit(1)
    print('overflow and text size checked on: ' + ', '.join(checks))
    print('PASS')
