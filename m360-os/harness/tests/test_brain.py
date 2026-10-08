#!/usr/bin/env python3
"""The buddy's brain: through look_up and act the buddy and Ask m360 read any area and change things
the way a hand would. On the claude.ai build (canned model): remember lands in the private memory and
shows in Prefs with a Forget; a post goes on Vibe; a reminder becomes a private follow-up; the calendar is read
through look_up; approving a task waits on a tap in the bubble; a long chat folds into a summary;
with images allowed the Ask drawer attaches a picture. On the team site (the dev stand-in): the model
is the current Opus with the server side fallback, act and look_up ride along, an attached image
reaches the model as an image block, and a look_up round answers from what it read.

Run: cd m360-os && python3 harness/tests/test_brain.py
"""
import base64
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

# a 1 by 1 PNG
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')


def ask_buddy(p, text):
    """Ask through the dock's pop-up and wait for the answer: the question and the reply land in the thread."""
    for _ in range(4):
        if not p.locator('.buddy-bubble').count():
            break
        p.keyboard.press('Escape')
        p.wait_for_timeout(250)
    p.locator('#buddy-dock .buddy-home').click()
    p.wait_for_selector('#buddy-input')
    n = p.evaluate('() => M.chat.turns.length')
    p.fill('#buddy-input', text)
    p.keyboard.press('Enter')
    p.wait_for_function('n => M.buddy.state().mode === "answer" && M.chat.turns.length >= n + 2', arg=n, timeout=20000)
    return p.inner_text('.buddy-bubble')


def artifact_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    # remember: the fact lands in the private memory
    out = ask_buddy(p, 'remember that I like short answers')
    check('Noted' in out, 'the buddy should note it: ' + out[:120])
    mem = p.evaluate('() => { const d = window.__db.get("data/users/u_founder/ai"); return d && d.memory ? d.memory.items.map(x => x.t) : []; }')
    check(mem == ['I like short answers'], 'memory should hold the fact: %r' % mem)
    # the prompt of the next question carries it
    ask_buddy(p, 'what can you do?')
    last = p.evaluate('() => window.__sampleCalls.filter(c => c.kind === "text").pop()')
    check('WHAT YOU REMEMBER' in last['text'] and 'I like short answers' in last['text'], 'the next prompt should carry the memory')
    check('look_up' in last['tools'] and 'act' in last['tools'], 'look_up and act should ride along: %r' % last['tools'])
    check(len(last['tools']) <= 8, 'the host cap of 8 tools holds: %d' % len(last['tools']))
    # a post on Vibe through act
    out = ask_buddy(p, 'post to the feed: Shipping the Swisse reel today')
    posts = p.evaluate('() => ((window.__db.get("feed/u_founder") || {}).posts || []).map(x => x.text)')
    check('Posted' in out and posts and posts[0] == 'Shipping the Swisse reel today', 'the post should be on Vibe: %r' % posts[:2])
    # a reminder is private (v34): a follow-up in the founder's own prospects on that day, never a task
    ask_buddy(p, 'remind me to call Swisse on 2030-01-15')
    tasks = h.ctx(p, 'Object.values(ctx.coll.tasks.map).filter(t => /^Reminder: call Swisse/.test(t.title)).length')
    # the grammar reads the line once Prospects is on the build (a follow-up, typed); with it absent the model's
    # remind_me writes the same private row (src remind). Either way: that day, open, and never a task
    fus = p.evaluate('() => { const d = window.__db.get("data/users/u_founder/prospects") || {}; return Object.values(d.fu || {}).filter(f => f && /call Swisse/.test(f.x)).map(f => [f.d, !!f.done]); }')
    check(tasks == 0 and fus == [['2030-01-15', False]], 'the reminder should be a private follow-up on that day and no task: %r (%r)' % (fus, tasks))
    # the calendar through look_up
    out = ask_buddy(p, 'what is on my calendar this week?')
    check(out.startswith('Your calendar:') or 'Your calendar:' in out, 'the calendar should be read through look_up: ' + out[:160])
    # approving a task in review waits on a tap
    h.seed_doc(p, 'tasks/t_rev', {'title': 'Cut the teaser', 'owner': 'u_m2', 'client': '', 'project': '', 'section': '', 'due': '', 'status': 'review', 'priority': 'normal', 'link': '', 'revisions': 0, 'shown20': False, 'subtasks': {}, 'comments': {}, 'by': 'u_m2', 'created': 1, 'updated': 1, 'doneAt': None, 'reviewAt': 1})
    out = ask_buddy(p, 'approve Cut the teaser')
    check('Tap Approve' in out and p.locator('.buddy-bubble .pending-act button.btn').count() == 1, 'the approval should wait on a tap: ' + out[:160])
    check(h.ctx(p, 'ctx.coll.tasks.map.t_rev.status') == 'review', 'nothing changes before the tap')
    p.locator('.buddy-bubble .pending-act button.btn').click()
    p.wait_for_function('() => M.lastCtx.coll.tasks.map.t_rev.status === "done"')
    t = h.ctx(p, 'ctx.coll.tasks.map.t_rev')
    check(t['approvedBy'] == 'u_founder' and t['doneAt'], 'the tap approves it as the founder: %r' % {k: t.get(k) for k in ('status', 'approvedBy')})
    check(p.locator('.pending-act').count() == 0, 'the waiting act clears after the tap')
    # Prefs: the memory shows with a Forget
    h.go(p, 'founder', hash='#me', width=1280)
    p.wait_for_selector('#buddy-prefs')
    check('I like short answers' in p.inner_text('#buddy-prefs'), 'Prefs should list the memory')
    p.locator('#buddy-prefs .memory-row button').click()
    p.wait_for_function('() => !/I like short answers/.test(document.querySelector("#buddy-prefs").innerText)')
    mem = p.evaluate('() => { const d = window.__db.get("data/users/u_founder/ai"); return d && d.memory ? d.memory.items.map(x => x.t) : []; }')
    check(mem == [], 'Forget should clear it: %r' % mem)
    # a long chat folds into a summary
    turns = []
    for i in range(26):
        turns.append({'role': 'user', 'content': 'question %d about the reel' % i})
        turns.append({'role': 'assistant', 'content': 'answer %d' % i})
    h.seed_doc(p, 'data/users/u_founder/chat', {'turns': turns, 'at': 1})
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    p.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
    p.locator('#buddy-expand').click()
    p.wait_for_selector('.drawer:has-text("question 25")')
    p.fill('#ask-input', 'what is overdue')
    p.keyboard.press('Enter')
    p.wait_for_function('() => { const d = window.__db.get("data/users/u_founder/chat"); return d && d.summary; }', timeout=15000)
    doc = p.evaluate('() => window.__db.get("data/users/u_founder/chat")')
    check(len(doc['turns']) <= 16 and doc['summary'], 'the chat should fold: %d turns, summary %r' % (len(doc['turns']), doc['summary'][:60]))
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    # no image button when the host allows none
    p.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
    p.locator('#buddy-expand').click()
    p.wait_for_selector('.drawer #ask-input')
    check(p.locator('#ask-file').count() == 0, 'no attach control without image support')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    # with images allowed: attach a picture, the call carries it
    h.go(p, 'founder', hash='#home', width=1280, img='1')
    p.wait_for_selector('.buddy-home')
    p.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
    p.locator('#buddy-expand').click()
    p.wait_for_selector('.drawer #ask-file', state='attached')
    p.locator('#ask-file').set_input_files({'name': 'shot.png', 'mimeType': 'image/png', 'buffer': PNG})
    p.wait_for_selector('#ask-attached img')
    p.fill('#ask-input', 'what is this')
    p.keyboard.press('Enter')
    p.wait_for_selector('.drawer .bubble.ai:has-text("I see 1 image")', timeout=15000)
    last = p.evaluate('() => window.__sampleCalls.filter(c => c.kind === "text").pop()')
    check(last['images'] == 1, 'the call should carry one image: %r' % last.get('images'))
    check(p.locator('.drawer .bubble.me:has-text("[image]")').count() == 1, 'the turn shows it carried an image')
    p.keyboard.press('Escape'); p.wait_for_function('() => !document.querySelector(".drawer")')
    # the hello, once a day, after the tour is behind them
    p.evaluate('() => { localStorage.setItem("m360.forceHello", "1"); localStorage.setItem("m360.tourSeen", "1"); localStorage.removeItem("m360.buddyHelloDay"); }')
    h.go(p, 'founder', hash='#tasks', width=1280)
    p.wait_for_selector('#buddy-hello', timeout=8000)
    line = p.inner_text('#buddy-hello')
    check(line.startswith(('Morning, Kaavish', 'Afternoon, Kaavish', 'Evening, Kaavish')) and 'open' in line, 'the hello with their numbers: ' + line)
    p.locator('#hello-later').click()
    p.wait_for_function('() => !document.querySelector("#buddy-hello")')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home'); p.wait_for_timeout(2200)
    check(p.locator('#buddy-hello').count() == 0, 'no second hello the same day')
    # a member sees no founder-only area in the catalog, and cannot reassign
    h.go(p, 'm2', hash='#home', width=1280)
    p.wait_for_selector('.buddy-home')
    cat = h.ctx(p, 'M.brain.catalog(ctx)')
    check('hiring' not in cat and 'decide_leave' not in cat and 'reassign_task' in cat and 'create_task' in cat, 'a member catalog: %s' % cat[:80])
    err = p.evaluate('() => M.brain.act(M.lastCtx, {}, null, "decide_leave", {person: "Ishaan", status: "approved"}).then(() => "ok", e => e.message)')
    check('founder' in err, 'a member cannot decide leave: %r' % err)
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def standalone_part():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store],
                           env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            k = browser.new_context(viewport={'width': 1280, 'height': 900}, timezone_id='Asia/Kolkata').new_page(); k.set_default_timeout(20000)
            errs = []
            k.on('pageerror', lambda e: errs.append(str(e)))
            k.add_init_script('window.M360_WELCOME_OFF = true')
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'brain-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            k.wait_for_selector('.buddy-home')
            # remember through act: the fake model calls the tool, the second round confirms
            out = ask_buddy(k, 'remember that the Swisse invoice goes to Omar')
            check('Done' in out, 'the site buddy should confirm: ' + out[:120])
            k.wait_for_timeout(300)
            mem = k.evaluate('() => M.brain.readAi(M.lastCtx).then(d => M.brain.memoryOf(d).map(x => x.t))')
            check(mem == ['the Swisse invoice goes to Omar'], 'the memory on the site: %r' % mem)
            reqs = json.load(urllib.request.urlopen(base + '__ai'))
            r0 = reqs[-2]
            check(r0['model'] == 'claude-opus-5-5' and r0['fallbacks'] == 'default' and 'server-side-fallback' in r0['beta'] and r0['effort'] == 'medium', 'the current Opus with the fallback: %r' % r0)
            check('act' in r0['tools'] and 'look_up' in r0['tools'], 'the brain tools ride along on the site: %r' % r0['tools'])
            # the calendar through look_up: the second round reads what came back
            out = ask_buddy(k, 'what is on my calendar')
            check('Your calendar' in out, 'a look_up round should answer from the tool: ' + out[:160])
            # an attached image reaches the model as an image block
            k.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
            k.locator('#buddy-expand').click()
            k.wait_for_selector('.drawer #ask-file', state='attached')
            k.locator('#ask-file').set_input_files({'name': 'shot.png', 'mimeType': 'image/png', 'buffer': PNG})
            k.wait_for_selector('#ask-attached img')
            k.fill('#ask-input', 'what is this')
            k.keyboard.press('Enter')
            k.wait_for_selector('.drawer .bubble.ai:has-text("I see 1 image")', timeout=20000)
            reqs = json.load(urllib.request.urlopen(base + '__ai'))
            img = reqs[-1]['images']
            check(len(img) == 1 and img[0]['type'] == 'image/jpeg' and img[0]['bytes'] > 100, 'the image block: %r' % img)
            k.keyboard.press('Escape')
            check(not errs, 'page errors: %r' % errs[:3])
            browser.close()
    finally:
        srv.terminate()
    return fails


def main():
    fails = run(artifact_part)
    fails = list(fails or []) + standalone_part()
    if fails:
        for f in fails:
            print('FAIL', f)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
