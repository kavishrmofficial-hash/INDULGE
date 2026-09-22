#!/usr/bin/env python3
"""Tasks module checks: board, drawer, status logic, subtasks, comments, filters, helpers, phone width.

Run:  cd m360-os && M360_MODULES=21-tasks.js M360_TAG=tasks python3 harness/tests/test_tasks.py
Prints PASS and exits 0 on success, prints FAIL and exits 1 otherwise.
"""
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

TITLE = 'Swisse reel scripts'
CLIENT = 'swisse-wellness-uae'


def open_in(h, page, ident, width, hash):
    """Open another identity in the same browser context, so it shares the localStorage database.
    h.open creates a fresh context each time and a fresh context starts with an empty store."""
    p = page.context.new_page()
    p.set_viewport_size({'width': width, 'height': 900})
    p.set_default_timeout(8000)
    p.on('console', lambda m: h.console.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.goto(h.url(ident, hash))
    h.ready(p)
    return p


def task_paths(page):
    return page.evaluate('() => Object.keys(window.__db.store()).filter(k => k.startsWith("tasks/"))')


def get_doc(page, path):
    return page.evaluate('p => window.__db.get(p)', path)


def open_card(page, title):
    page.click('.tcard:has-text("%s")' % title)
    page.wait_for_selector('.drawer')
    page.wait_for_timeout(120)


def close_drawer(page):
    page.keyboard.press('Escape')
    page.wait_for_selector('.drawer', state='detached')


def set_status_and_save(page, title, label):
    open_card(page, title)
    page.click('.drawer .seg-btn:has-text("%s")' % label)
    page.click('.drawer-foot button:has-text("Save")')
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(250)


def col_titles(page, n):
    return page.locator('.colm').nth(n).locator('.tcard .t').all_inner_texts()


def test(h):
    opened = []
    now = int(time.time() * 1000)

    # ---- founder, desktop ----
    page = h.open('founder', width=1280, hash='#tasks', reset=True, seed=True)
    opened.append(page)
    h.roster(page)
    h.seed_doc(page, 'projects/p1', {
        'name': 'Swisse Q4 reels', 'kind': 'client', 'client': CLIENT, 'pitch': '', 'owner': 'u_founder',
        'members': ['u_founder', 'u_m1'], 'status': 'on', 'start': '2026-09-01', 'due': '2026-10-15', 'desc': '',
        'sections': [{'id': 's1', 'name': 'Brief'}, {'id': 's2', 'name': 'Creative'}], 'updates': {},
        'archived': False, 'by': 'u_founder', 'created': now})
    page.wait_for_timeout(250)

    assert page.inner_text('.pgt').strip() == 'My tasks'
    assert page.locator('.colm').count() == 4, 'four columns'
    heads = [t.strip() for t in page.locator('.col-head').all_inner_texts()]
    assert len(heads) == 4 and all('0' in t for t in heads), heads
    assert page.locator('.colm:has-text("Nothing here.")').count() == 4

    # ---- create a task through the drawer, due yesterday ----
    yesterday = page.evaluate('() => M.U.ymd(M.U.addDays(new Date(), -1))')
    page.click('.page-head button:has-text("New task")')
    page.wait_for_selector('.drawer')
    assert page.inner_text('.drawer-head h2').strip() == 'New task'
    page.fill('#task-title', TITLE)
    page.fill('#task-due', yesterday)
    page.select_option('#task-project', 'p1')
    secs = page.eval_on_selector_all('#task-section option', 'os => os.map(o => o.value)')
    assert secs == ['', 's1', 's2'], secs
    page.select_option('#task-section', 's2')
    assert page.input_value('#task-client') == CLIENT, 'client follows the project'
    page.select_option('#task-priority', 'high')
    page.check('.drawer .checkline:has-text("20% check") input')
    page.fill('#task-link', 'drive.google.com/folder/abc')
    assert page.locator('.drawer a:has-text("Open the output")').get_attribute('href') == 'https://drive.google.com/folder/abc'
    assert 'No revisions yet' in page.inner_text('.drawer')
    page.click('.drawer-foot button:has-text("Create task")')
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(300)

    paths = task_paths(page)
    assert len(paths) == 1, paths
    path = paths[0]
    doc = get_doc(page, path)
    assert doc['title'] == TITLE and doc['status'] == 'todo' and doc['owner'] == 'u_founder' and doc['by'] == 'u_founder'
    assert doc['due'] == yesterday and doc['revisions'] == 0 and doc['doneAt'] is None
    assert doc['project'] == 'p1' and doc['section'] == 's2' and doc['client'] == CLIENT
    assert doc['priority'] == 'high' and doc['shown20'] is True and doc['link'] == 'drive.google.com/folder/abc'
    assert doc['subtasks'] == {} and doc['comments'] == {}
    assert isinstance(doc['created'], int) and isinstance(doc['updated'], int)

    card = page.locator('.colm').nth(0).locator('.tcard')
    assert card.count() == 1, 'card sits in To do'
    assert card.locator('.pill.flame:has-text("due")').count() == 1, 'flame due pill when overdue'
    assert card.locator('.pill.flame:has-text("high")').count() == 1
    assert card.locator('.pill:has-text("20% shown")').count() == 1
    assert card.locator('.pill.warm:has-text("Swisse Q4 reels")').count() == 1
    assert card.locator('.pill.warm:has-text("Swisse Wellness UAE")').count() == 1
    assert card.locator('img.av').count() == 1
    assert '1' in page.locator('.col-head').nth(0).inner_text()
    assert '1 open, 1 overdue' in page.inner_text('.page-head')

    # ---- status logic ----
    set_status_and_save(page, TITLE, 'In review')
    doc = get_doc(page, path)
    assert doc['status'] == 'review' and doc['revisions'] == 0, doc
    assert col_titles(page, 2) == [TITLE]

    open_card(page, TITLE)
    page.click('.drawer .seg-btn:has-text("Doing")')
    page.click('.drawer-foot button:has-text("Save")')
    page.wait_for_selector('.toast:has-text("Sent back, revision 1")', timeout=3000)
    page.wait_for_selector('.drawer', state='detached')
    page.wait_for_timeout(250)
    doc = get_doc(page, path)
    assert doc['status'] == 'doing' and doc['revisions'] == 1, doc
    assert col_titles(page, 1) == [TITLE]
    assert page.locator('.colm').nth(1).locator('.pill.flame-o:has-text("1 rev")').count() == 1

    set_status_and_save(page, TITLE, 'Done')
    doc = get_doc(page, path)
    assert doc['status'] == 'done' and isinstance(doc['doneAt'], int) and doc['doneAt'] > 0, doc
    assert col_titles(page, 3) == [TITLE]
    assert page.locator('.colm').nth(3).locator('.pill.flame:has-text("due")').count() == 0, 'done tasks are never overdue'

    set_status_and_save(page, TITLE, 'To do')
    doc = get_doc(page, path)
    assert doc['status'] == 'todo' and doc['doneAt'] is None and doc['revisions'] == 1, doc
    assert col_titles(page, 0) == [TITLE]

    # ---- subtasks and comments write live ----
    open_card(page, TITLE)
    assert '1 revision' in page.inner_text('.drawer')
    page.fill('#task-subtask', 'Draft 3 scripts')
    page.press('#task-subtask', 'Enter')
    page.wait_for_timeout(250)
    subs = get_doc(page, path)['subtasks']
    assert len(subs) == 1, subs
    sid = list(subs)[0]
    assert subs[sid]['t'] == 'Draft 3 scripts' and subs[sid]['done'] is False and isinstance(subs[sid]['o'], int)
    assert page.input_value('#task-subtask') == ''
    # the checkbox is controlled by the live document, so the tick lands after the snapshot round trip
    page.click('.drawer .checkline:has-text("Draft 3 scripts")')
    page.wait_for_timeout(250)
    assert get_doc(page, path)['subtasks'][sid]['done'] is True
    assert page.is_checked('.drawer .checkline:has-text("Draft 3 scripts") input')

    page.fill('#task-comment', 'Scripts are in the shared folder.')
    page.click('.drawer button:has-text("Add comment")')
    page.wait_for_timeout(300)
    cs = get_doc(page, path)['comments']
    assert len(cs) == 1, cs
    c = list(cs.values())[0]
    assert c['by'] == 'u_founder' and c['t'] == 'Scripts are in the shared folder.' and isinstance(c['at'], int)
    assert sorted(c.keys()) == ['at', 'by', 't'], 'comments store ids only'
    assert page.input_value('#task-comment') == ''
    thread = page.inner_text('.drawer')
    assert 'Kaavish Ramchandani' in thread and 'Scripts are in the shared folder.' in thread

    page.fill('#task-subtask', 'Send to Omar')
    page.press('#task-subtask', 'Enter')
    page.wait_for_timeout(250)
    assert len(get_doc(page, path)['subtasks']) == 2
    page.locator('.drawer button[aria-label="Delete subtask"]').nth(0).click()
    page.wait_for_timeout(300)
    doc = get_doc(page, path)
    assert len(doc['subtasks']) == 1 and list(doc['subtasks'].values())[0]['t'] == 'Send to Omar', doc['subtasks']
    assert len(doc['comments']) == 1 and doc['revisions'] == 1, 'the rest of the task survives a subtask delete'
    close_drawer(page)
    assert page.locator('.tcard .pill:has-text("0 of 1")').count() == 1

    # ---- Mine and Everyone, project and client filters ----
    h.seed_doc(page, 'tasks/t_m1', {
        'title': 'Blah Studio call sheet', 'owner': 'u_m1', 'client': '', 'project': '', 'section': '', 'due': '',
        'status': 'doing', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': False, 'subtasks': {},
        'comments': {}, 'by': 'u_m1', 'created': now, 'updated': now, 'doneAt': None})
    page.wait_for_timeout(250)
    other = page.locator('.tcard:has-text("Blah Studio call sheet")')
    assert other.count() == 0, 'Mine shows my tasks only'
    page.click('.seg-btn:has-text("Everyone")')
    page.wait_for_timeout(150)
    assert other.count() == 1, 'Everyone includes the task owned by u_m1'
    page.select_option('#task-filter-project', 'p1')
    page.wait_for_timeout(150)
    assert other.count() == 0 and page.locator('.tcard:has-text("%s")' % TITLE).count() == 1
    page.select_option('#task-filter-project', '')
    page.select_option('#task-filter-client', CLIENT)
    page.wait_for_timeout(150)
    assert other.count() == 0 and page.locator('.tcard:has-text("%s")' % TITLE).count() == 1
    page.select_option('#task-filter-client', '')
    page.wait_for_timeout(150)
    assert page.locator('.tcard').count() == 2

    # ---- helpers ----
    assert h.ctx(page, 'M.tasks.open(ctx).map(t => t.id).sort()') == sorted([path.split('/')[1], 't_m1'])
    assert h.ctx(page, 'M.tasks.progress(ctx, "p1")') == {'done': 0, 'total': 1, 'overdue': 1}
    assert h.ctx(page, 'M.tasks.progress(ctx, "nope")') == {'done': 0, 'total': 0, 'overdue': 0}
    assert h.ctx(page, 'M.tasks.isOverdue({due: "2026-01-01", status: "todo"}, "2026-01-02")') is True
    assert h.ctx(page, 'M.tasks.isOverdue({due: "2026-01-02", status: "todo"}, "2026-01-02")') is False
    assert h.ctx(page, 'M.tasks.isOverdue({due: "2026-01-01", status: "done"}, "2026-01-02")') is False
    assert h.ctx(page, 'M.tasks.isOverdue({due: "", status: "todo"}, "2026-01-02")') is False
    assert h.ctx(page, 'typeof M.parts.TaskDrawer') == 'function'

    # ---- member view: own task, delete only for the creator ----
    pm = open_in(h, page, 'm1', 1280, '#tasks')
    opened.append(pm)
    pm.wait_for_timeout(250)
    assert pm.locator('.tcard:has-text("Blah Studio call sheet")').count() == 1
    assert pm.locator('.tcard:has-text("%s")' % TITLE).count() == 0
    pm.click('.seg-btn:has-text("Everyone")')
    pm.wait_for_timeout(150)
    open_card(pm, TITLE)
    assert pm.locator('.drawer-foot button:has-text("Delete")').count() == 0, 'a member cannot delete the founder task'
    close_drawer(pm)
    open_card(pm, 'Blah Studio call sheet')
    assert pm.locator('.drawer-foot button:has-text("Delete")').count() == 1
    pm.click('.drawer-foot button:has-text("Delete")')
    assert pm.locator('.drawer-foot button.arm:has-text("Tap again to confirm")').count() == 1
    pm.click('.drawer-foot button:has-text("Tap again to confirm")')
    pm.wait_for_selector('.drawer', state='detached')
    pm.wait_for_timeout(250)
    assert get_doc(pm, 'tasks/t_m1') is None, 'tap again deletes'
    assert pm.locator('.tcard').count() == 1

    # ---- phone width: the board scrolls inside its card, the page never overflows ----
    p3 = open_in(h, page, 'founder', 390, '#tasks')
    opened.append(p3)
    p3.wait_for_timeout(300)
    assert h.overflow(p3) == 0, 'no page overflow at 390'
    sw, cw = p3.evaluate('() => { const w = document.querySelector(".board-wrap"); return [w.scrollWidth, w.clientWidth]; }')
    assert sw > cw, 'board scrolls inside the card (%d, %d)' % (sw, cw)
    assert h.small_text(p3) == [], h.small_text(p3)
    p3.click('.page-head button:has-text("New task")')
    p3.wait_for_selector('.drawer')
    assert h.overflow(p3) == 0, 'no overflow with the new task sheet open'
    assert h.small_text(p3) == [], h.small_text(p3)
    close_drawer(p3)
    open_card(p3, TITLE)
    assert h.overflow(p3) == 0, 'no overflow with the task sheet open'
    close_drawer(p3)

    # ---- closing checks ----
    errs = h.errors()
    assert not errs, errs
    for p in opened:
        assert h.overflow(p) == 0, 'page overflow'
    return True


if __name__ == '__main__':
    try:
        ok = run(test)
    except Exception:
        traceback.print_exc()
        print('FAIL')
        sys.exit(1)
    if not ok:
        print('FAIL')
        sys.exit(1)
    print('PASS')
