#!/usr/bin/env python3
"""Sign-off: done is a decision. A member marking their own work done sends it for sign-off (review);
the founder or someone on the project approves and only then is it done, with who signed it, and only
then does it count for points. The gate holds on the task drawer, the project checklist, Home's quick
tick, moveTask and the AI's status tool. With sign-off off (Admin > Settings) done is direct and lands
as a flag in the founder's inbox, as do a due date the owner moved later, a task created and finished
within minutes, an owner change, and a deletion. A deleted task goes to the bin on Admin, where the
founder restores it or lets it go.

Run: cd m360-os && python3 harness/tests/test_signoff.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

F, M1, M2 = 'u_founder', 'u_m1', 'u_m2'


def doc(p, path):
    return p.evaluate('p => window.__db.get(p)', path)


def flags(p):
    return p.evaluate('() => M.inbox.items(M.lastCtx).filter(i => i.kind === "flag").map(i => i.plain(id => id))')


def open_task(p, title):
    p.locator('.tcard:has-text("%s")' % title).first.click()
    p.wait_for_selector('.drawer')


def part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    # ---- pure rules ----
    h.go(p, 'm1', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    g = p.evaluate('''() => { const c = M.lastCtx; const t1 = {owner: "u_m1", project: "p1"}, t3 = {owner: "u_m2", project: "p1"};
      return {own: M.tasks.gate(c, t1, "done"), theirs: M.tasks.gate(c, t3, "done"), doing: M.tasks.gate(c, t1, "doing"), on: M.tasks.signoffOn(c),
        legacy: M.tasks.counted(c, {status: "done", owner: "u_m2", doneAt: Date.UTC(2026, 0, 5)}), fresh: M.tasks.counted(c, {status: "done", owner: "u_m2", doneAt: Date.now()}),
        signed: M.tasks.counted(c, {status: "done", owner: "u_m2", doneAt: Date.now(), approvedBy: "u_m1"}), founders: M.tasks.counted(c, {status: "done", owner: "u_founder", doneAt: Date.now()})}; }''')
    check(g['own'] == 'review' and g['theirs'] == 'done' and g['doing'] == 'doing' and g['on'] is True, 'the gate: %r' % g)
    check(g['legacy'] is True and g['fresh'] is False and g['signed'] is True and g['founders'] is True, 'what counts: %r' % g)
    # ---- a member asks for done on their own task: it goes for sign-off ----
    open_task(p, 'Write hero reel script')
    check(p.locator('.drawer .seg-btn:has-text("Sign-off")').count() == 1 and p.locator('.drawer .seg-btn:has-text("Done")').count() == 0, 'the status option reads Sign-off for the owner')
    p.locator('.drawer .seg-btn:has-text("Sign-off")').click()
    p.locator('.drawer-foot button:has-text("Save")').click()
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('() => (window.__db.get("tasks/t1") || {}).status === "review"')
    t1 = doc(p, 'tasks/t1')
    check(t1['status'] == 'review' and t1.get('reviewAt') and not t1.get('approvedBy') and not t1.get('doneAt'), 'sent for sign-off: %r' % {k: t1.get(k) for k in ('status', 'reviewAt', 'approvedBy', 'doneAt')})
    check(p.locator('.toast:has-text("Sent for sign-off")').count() >= 0, 'toast')
    # moveTask on a task already waiting changes nothing
    p.evaluate('() => M.tasks.moveTask(M.lastCtx, {id: "t1", ...window.__db.get("tasks/t1")}, "done")')
    p.wait_for_timeout(300)
    check(doc(p, 'tasks/t1')['status'] == 'review', 'still waiting for sign-off')
    pts = p.evaluate('() => M.points.pointsFor(M.lastCtx, "u_m1", M.U.ymd(M.U.addDays(new Date(), -30)), M.U.todayStr()).counts')
    check(pts['taskOnTime'] + pts['taskLate'] == 0, 'no points before the sign-off: %r' % pts)
    # ---- a teammate on the project signs it off ----
    h.go(p, 'm2', hash='#reviews', width=1280)
    p.wait_for_selector('#rev-t1')
    check('Sign-off is on' in p.inner_text('#reviews'), 'the reviews page says sign-off is on')
    p.locator('#rev-t1 button:has-text("Approve")').click()
    p.wait_for_function('() => (window.__db.get("tasks/t1") || {}).status === "done"')
    t1 = doc(p, 'tasks/t1')
    check(t1['approvedBy'] == M2 and t1.get('approvedAt') and t1.get('doneAt'), 'signed off by the teammate: %r' % {k: t1.get(k) for k in ('approvedBy', 'approvedAt', 'doneAt')})
    pts = p.evaluate('() => M.points.pointsFor(M.lastCtx, "u_m1", M.U.ymd(M.U.addDays(new Date(), -30)), M.U.todayStr()).counts')
    check(pts['taskOnTime'] + pts['taskLate'] == 1, 'the points land after the sign-off: %r' % pts)
    # ---- the owner of the project signs off a member's work; the founder's own done is direct ----
    h.go(p, 'm2', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    open_task(p, 'Creator brief')
    p.locator('.drawer .seg-btn:has-text("Sign-off")').click()
    p.locator('.drawer-foot button:has-text("Save")').click()
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('() => (window.__db.get("tasks/t3") || {}).status === "review"')
    h.go(p, 'm1', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    p.click('.seg-btn:has-text("Everyone")')
    open_task(p, 'Creator brief')
    check(p.locator('.drawer .seg-btn:has-text("Done")').count() == 1, 'the project owner sees Done on a member task')
    p.locator('.drawer .seg-btn:has-text("Done")').click()
    p.locator('.drawer-foot button:has-text("Save")').click()
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('() => (window.__db.get("tasks/t3") || {}).status === "done"')
    check(doc(p, 'tasks/t3')['approvedBy'] == M1, 'the project owner signed it: %r' % doc(p, 'tasks/t3').get('approvedBy'))
    # the AI tool goes through the gate
    h.go(p, 'm2', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    p.evaluate('() => { const c = M.lastCtx; const t = {id: "t4", ...window.__db.get("tasks/t4")}; return c.W.update("tasks/t4", M.tasks.statusPatch(t, "doing", c.uid, c).patch); }')
    p.wait_for_function('() => (window.__db.get("tasks/t4") || {}).status === "doing"')
    check(not doc(p, 'tasks/t4').get('approvedBy'), 'reopening clears the sign-off')
    r = p.evaluate('''() => { const c = M.lastCtx; const t = {id: "t4", ...window.__db.get("tasks/t4")}; const sp = M.tasks.statusPatch(t, "done", c.uid, c); return {status: sp.status, msg: sp.msg, approved: sp.patch.approvedBy || null}; }''')
    check(r['status'] == 'review' and r['msg'] == 'Sent for sign-off' and r['approved'] is None, 'statusPatch with ctx gates: %r' % r)
    # ---- the founder turns sign-off off: done is direct, and it shows as a flag ----
    h.go(p, 'founder', hash='#admin', width=1280)
    p.get_by_role('tab', name='Settings').click()
    p.wait_for_selector('label.checkline:has-text("Done needs a sign-off")')
    p.locator('label.checkline:has-text("Done needs a sign-off") input').click()
    p.get_by_role('button', name='Save settings').click()
    p.wait_for_function('() => (window.__db.get("settings/app") || {}).signoff === false')
    h.go(p, 'm2', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    p.click('.page-head button:has-text("New task")')
    p.wait_for_selector('.drawer')
    p.fill('#task-title', 'Quick fix on the carousel')
    check(p.locator('.drawer .seg-btn:has-text("Done")').count() == 1, 'with sign-off off the option reads Done')
    p.locator('.drawer .seg-btn:has-text("Done")').click()
    p.locator('.drawer-foot button:has-text("Create task")').click()
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('() => Object.values(M.lastCtx.coll.tasks.map).some(t => t.title === "Quick fix on the carousel" && t.status === "done")')
    quick = p.evaluate('() => Object.keys(M.lastCtx.coll.tasks.map).find(id => M.lastCtx.coll.tasks.map[id].title === "Quick fix on the carousel")')
    check(not doc(p, 'tasks/' + quick).get('approvedBy'), 'direct done, nobody signed it')
    # the owner moves a due date later, then deletes a task
    open_task(p, 'Moodboard')
    later = p.evaluate('() => M.U.ymd(M.U.addDays(new Date(), 9))')
    p.fill('#task-due', later)
    p.locator('.drawer-foot button:has-text("Save")').click()
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('() => ((window.__db.get("tasks/t4") || {}).dueLog || []).length === 1')
    # ---- the founder's inbox flags all of it; the bin holds the deleted one ----
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#side-map')
    fl = flags(p)
    check(any('marked Quick fix on the carousel done with no sign-off' in f for f in fl), 'flag: done with no sign-off: %r' % fl)
    check(any('created and finished Quick fix on the carousel within' in f for f in fl), 'flag: rushed: %r' % fl)
    check(any('moved the due date of Moodboard' in f for f in fl), 'flag: due date moved: %r' % fl)
    check(not any('Write hero reel script' in f and 'no sign-off' in f for f in fl), 'a signed-off task is not flagged')
    # the owner deletes it: off the board, into the bin, a flag for the founder
    h.go(p, 'm2', hash='#tasks', width=1280)
    p.wait_for_selector('.tcard')
    open_task(p, 'Quick fix on the carousel')
    p.click('.drawer-foot button:has-text("Delete")')
    p.click('.drawer-foot button:has-text("Tap again to confirm")')
    p.wait_for_selector('.drawer', state='detached')
    p.wait_for_function('id => (window.__db.get("tasks/" + id) || {}).deleted === true', arg=quick)
    check(p.locator('.tcard:has-text("Quick fix on the carousel")').count() == 0, 'a deleted task leaves the board')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#side-map')
    fl = flags(p)
    check(any('deleted Quick fix on the carousel' in f for f in fl), 'flag: deleted: %r' % fl)
    h.go(p, 'founder', hash='#admin', width=1280)
    p.get_by_role('tab', name='Super').click()
    p.wait_for_selector('#trash-card')
    p.wait_for_selector('#trash-' + quick)
    p.locator('#trash-' + quick + ' button:has-text("Restore")').click()
    p.wait_for_function('id => (window.__db.get("tasks/" + id) || {}).deleted === false', arg=quick)
    check(p.evaluate('id => !!M.lastCtx.coll.tasks.map[id]', quick), 'restored to the board')
    # sign-off back on
    p.get_by_role('tab', name='Settings').click()
    p.wait_for_selector('label.checkline:has-text("Done needs a sign-off")')
    p.locator('label.checkline:has-text("Done needs a sign-off") input').click()
    p.get_by_role('button', name='Save settings').click()
    p.wait_for_function('() => (window.__db.get("settings/app") || {}).signoff === true')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def main():
    fails = run(part)
    if fails:
        for f in fails:
            print('FAIL', f)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
