#!/usr/bin/env python3
"""The day before a holiday: the line on Home, the corner notice, the inbox item for everyone, the
founder's page posting the announcement on the claude.ai build, and on the team site the server posting
it and mailing the team at its first request, once.

Run: cd m360-os && python3 harness/tests/test_holiday.py
"""
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


def artifact_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    tm = p.evaluate('M.U.ymd(M.U.addDays(M.U.parseYmd(M.U.todayStr()), 1))')
    s = p.evaluate('window.__db.get("settings/app")')
    s['holidays'] = [tm]
    h.seed_doc(p, 'settings/app', s)
    # a member first: the line, the notice and the inbox item exist before any announcement
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#hero-tomorrow')
    line = p.inner_text('#hero-tomorrow')
    check(line.startswith('Tomorrow, ') and 'is a holiday' in line and 'm360 rests too' in line, 'hero line: %r' % line)
    p.wait_for_selector('.notice-body:has-text("Tomorrow is a holiday")')
    hol = h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("hol:")).map(i => i.id)')
    check(hol == ['hol:' + tm], 'inbox line for the member: %r' % hol)
    check(p.evaluate('localStorage.getItem("m360.holnote.u_m1.%s")' % tm) == '1', 'the notice is remembered per person')
    p.reload()
    p.wait_for_selector('#hero-tomorrow')
    p.wait_for_timeout(600)
    check(p.locator('.notice-body:has-text("Tomorrow is a holiday")').count() == 0, 'the notice shows once, not on every load')
    # the founder's page posts the announcement after the wait, once
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_function('() => { const f = window.__db.get("feed/u_founder"); return f && (f.posts || []).some(x => x.auto === "holiday"); }', timeout=40000)
    feed = p.evaluate('window.__db.get("feed/u_founder")')
    post = [x for x in feed['posts'] if x.get('auto') == 'holiday'][0]
    check(post['kind'] == 'announce' and post['text'].startswith('Tomorrow, ') and feed.get('pinned') == 'u_founder:' + post['id'], 'the announcement: %r' % post)
    check(tm in (p.evaluate('window.__db.get("settings/app")').get('holNotes') or []), 'holNotes not marked')
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('#hero-tomorrow')
    p.wait_for_timeout(17000)
    n = len([x for x in p.evaluate('window.__db.get("feed/u_founder")')['posts'] if x.get('auto') == 'holiday'])
    check(n == 1, 'the announcement was posted %d times' % n)
    # the member: the announcement takes the inbox line's place
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('#hero-tomorrow')
    hol = h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("hol:")).length')
    check(hol == 0, 'the derived inbox line should step aside for the announcement')
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    body = p.inner_text('.drawer')
    check('announced: Tomorrow' in body, 'member inbox missing the announcement: ' + body[:300])
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
                           env=dict(os.environ, MOCK_AI='1', HOLIDAY_RECHECK_MS='0'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
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
            k.add_init_script('window.M360_WELCOME_OFF = true')
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'holiday-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            uid = k.evaluate('M.lastCtx.uid')
            tm = k.evaluate('M.U.ymd(M.U.addDays(M.U.parseYmd(M.U.todayStr()), 1))')
            k.evaluate('window.M360_API("mailkey", {key: "re_holidaytestkey0000000"})')
            k.evaluate('tm => M.lastCtx.W.merge("settings/app", {holidays: [tm]})', tm)
            k.wait_for_timeout(400)
            # the next request makes the server post the announcement and mail the team, once
            k.evaluate('window.M360_API("me", {})')
            k.wait_for_function('() => { const c = M.lastCtx; return c && Array.isArray(c.settings.holNotes) && c.settings.holNotes.includes("%s"); }' % tm)
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            hol = [m for m in mails if m['subject'] == 'Tomorrow is a holiday']
            check(len(hol) == 1 and 'kaavish@mask360.agency' in hol[0]['to'] and 'is a holiday' in hol[0]['text'], 'holiday mail: %r' % hol)
            data = json.loads(urllib.request.urlopen(base + '__store').read())
            feed = json.loads(data['d/feed~' + uid])
            posts = [x for x in feed.get('posts', []) if x.get('auto') == 'holiday']
            check(len(posts) == 1 and posts[0]['kind'] == 'announce' and feed.get('pinned') == uid + ':' + posts[0]['id'], 'server announcement: %r' % posts)
            k.goto(base + '#home'); k.wait_for_selector('#hero-tomorrow')
            # the founder's page does not post a second one; the server does not mail twice
            k.evaluate('window.M360_API("me", {})')
            k.wait_for_timeout(17000)
            feed = json.loads(json.loads(urllib.request.urlopen(base + '__store').read())['d/feed~' + uid])
            check(len([x for x in feed.get('posts', []) if x.get('auto') == 'holiday']) == 1, 'a second announcement appeared')
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            check(len([m for m in mails if m['subject'] == 'Tomorrow is a holiday']) == 1, 'a second mail went out')
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
