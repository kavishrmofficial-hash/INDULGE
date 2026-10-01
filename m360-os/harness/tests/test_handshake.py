#!/usr/bin/env python3
"""Handshake, the LinkedIn DM desk. On the claude.ai build (canned model): pasted lines become people,
the batch is sorted into buckets, the founder at a company is ready while the junior is held 48 hours
with a message that names the senior, a recruiter lands on the skip list, a pending connection waits
on the accept, a flag shows in the flags card, the copy rules are checked by code, Sent moves a person
to the sent log, a second intake of the same name is refused, the brain reads the desk, and a member
has it too, writing as themselves. On the team site (the dev stand-in): "DM:" with a screenshot in Ask m360 runs the
desk, the company is verified on the fake press so the hook is the news, and the image reached the model.

Run: cd m360-os && python3 harness/tests/test_handshake.py
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

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
LINES = '\n'.join([
    'Priya Mehta | Brand Manager at DERMATOUCH | Dermatouch | 1st',
    'Arjun Rao | Founder & CEO, Dermatouch | Dermatouch | 1st',
    'Neha Kapoor | Talent Acquisition Partner | Hirewell | 1st',
    'Rohit Shah | Head of Marketing, QUAFFINE | Quaffine | pending'])


def by_name(p, name):
    return p.evaluate('n => M.handshake.people(M.lastCtx).find(x => x.name === n) || null', name)


def artifact_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#handshake', width=1280)
    p.wait_for_selector('#hs-intake')
    check(p.locator('.section-tabs .tab:has-text("Handshake")').count() == 1, 'the Accounts tab for the founder')
    check(p.locator('#hs-file').count() == 0, 'no screenshot control without image support')
    # the copy rules, checked by code
    bad = p.evaluate('() => M.handshake.check("Hi Priya — loved the work. We do content rather than ads, see www.mask360.agency!")')
    check(any('dash' in x for x in bad) and any('contrast' in x for x in bad) and any('link' in x for x in bad) and any('sentences' in x for x in bad) and any('exclamation' in x for x in bad), 'the checker should catch the dash, the contrast, the link, the count and the mark: %r' % bad)
    pol = p.evaluate('() => M.handshake.polish("Reels and stories — both.")')
    check(pol == 'Reels & stories, both.', 'polish should fix the and and the dash: %r' % pol)
    # intake by lines, then the whole flow
    p.fill('#hs-lines', LINES)
    p.click('#hs-run')
    p.wait_for_selector('#hs-ready', timeout=30000)
    p.wait_for_function('() => M.handshake.people(M.lastCtx).length === 4 && M.handshake.people(M.lastCtx).every(x => x.state !== "new")', timeout=30000)
    arjun, priya, neha, rohit = by_name(p, 'Arjun Rao'), by_name(p, 'Priya Mehta'), by_name(p, 'Neha Kapoor'), by_name(p, 'Rohit Shah')
    check(arjun['bucket'] == 'decision' and arjun['state'] == 'ready', 'the founder is ready: %r' % {k: arjun.get(k) for k in ('bucket', 'state')})
    check(priya['bucket'] == 'marketer' and priya['state'] == 'hold' and priya['senior'] == arjun['id'] and priya['holdUntil'] > time.time() * 1000 + 47 * 3600000, 'the junior is held 48 hours behind the founder: %r' % {k: priya.get(k) for k in ('bucket', 'state', 'senior')})
    check('Arjun' in priya['message'], 'the junior message names the senior: ' + priya['message'])
    check(neha['state'] == 'skipped' and neha['bucket'] == 'skip', 'the recruiter is skipped: %r' % {k: neha.get(k) for k in ('bucket', 'state', 'skip')})
    check(rohit['state'] == 'waiting' and rohit['flags'] == ['possible IONIQ investor'], 'the pending one waits, with its flag: %r' % {k: rohit.get(k) for k in ('state', 'flags')})
    openers = [m.split('.')[0] for m in (arjun['message'], priya['message'])]
    check(sorted(openers) == ['Good to connect, Arjun', 'Thanks for connecting, Priya'] or sorted(openers) == ['Good to connect, Priya', 'Thanks for connecting, Arjun'], 'the openers alternate across the batch: %r' % openers)
    check(' and ' not in arjun['message'] and '&' in arjun['message'] and arjun['qc'] == [], 'the message passes the rules after polish: %r %r' % (arjun['qc'], arjun['message']))
    # the board: name in bold, the copy block, the skip list, the flags
    check(p.locator('#hs-ready .hs-person b.hs-name:has-text("Arjun Rao")').count() == 1 and p.locator('#hs-ready pre.hs-copy').count() == 1, 'the ready card with the copy block')
    check('Neha Kapoor' in p.inner_text('#hs-skipped') and 'recruiter' in p.inner_text('#hs-skipped'), 'the skip list names the recruiter with the reason')
    check('Rohit Shah' in p.inner_text('#hs-flags') and 'IONIQ' in p.inner_text('#hs-flags'), 'the flags card')
    check('Arjun' in p.inner_text('#hs-hold') and 'Release now' in p.inner_text('#hs-hold'), 'the held card names the senior and offers a release')
    # the accept unlocks the pending one; the release frees the junior
    p.click('#hs-accept-' + rohit['id'])
    p.wait_for_function('id => M.handshake.people(M.lastCtx).find(x => x.id === id).state === "ready"', arg=rohit['id'])
    p.locator('#hs-hold button:has-text("Release now")').click()
    p.wait_for_function('id => M.handshake.people(M.lastCtx).find(x => x.id === id).state === "ready"', arg=priya['id'])
    check(p.locator('#hs-ready .hs-person').count() == 3, 'three ready now: %d' % p.locator('#hs-ready .hs-person').count())
    # Sent moves it to the log
    p.click('#hs-sent-' + arjun['id'])
    p.wait_for_selector('#hs-sent')
    a2 = by_name(p, 'Arjun Rao')
    check(a2['state'] == 'sent' and a2['sentAt'] and 'Arjun Rao' in p.inner_text('#hs-sent'), 'Sent logs it: %r' % a2['state'])
    # the same name again is refused
    p.fill('#hs-lines', 'Priya Mehta | Brand Manager at DERMATOUCH | Dermatouch | 1st')
    p.click('#hs-run')
    p.wait_for_selector('#hs-intake:has-text("already in")', timeout=15000)
    check(p.evaluate('() => M.handshake.people(M.lastCtx).length') == 4, 'no second record for the same person')
    # the brain reads the desk
    txt = p.evaluate('() => M.brain.lookUp(M.lastCtx, {}, "handshake", "")')
    check(txt.startswith('HANDSHAKE: 4 people') and 'Priya Mehta' in txt, 'the brain area: ' + txt[:80])
    # the settings hold
    check(p.locator('#handshake input[type="number"]').count() == 1 and 'ZORÁE' in p.evaluate('() => Array.from(document.querySelectorAll("#handshake input")).map(i => i.value).join("|")'), 'the proof bank fields with the defaults')
    # a member has the desk too, sees the founder's batch, and writes as themselves without the founder's own line
    h.go(p, 'm1', hash='#handshake', width=1280)
    p.wait_for_selector('#hs-intake')
    check(p.locator('.section-tabs .tab:has-text("Handshake")').count() == 1 and 'Priya Mehta' in p.inner_text('#handshake'), 'a member reaches the shared desk')
    check(p.locator('#hs-setup').count() == 0 and p.locator('#handshake input[type="number"]').count() == 0, 'the proof bank is the founder\'s to edit')
    p.fill('#hs-lines', 'Sana Iyer | Social Lead, KLAW | Klaw | 1st')
    p.click('#hs-run')
    p.wait_for_function('() => { const x = M.handshake.people(M.lastCtx).find(y => y.name === "Sana Iyer"); return x && x.state !== "new"; }', timeout=30000)
    wr = p.evaluate('() => window.__sampleCalls.filter(c => /HANDSHAKE WRITE/.test(c.text)).pop().text')
    check('for Durvesh Patil' in wr and 'builder side' not in wr and 'Durvesh\'s voice' in wr, 'written as the member, without the founder\'s own line: %r' % wr[:160])
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
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'handshake-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            # "DM:" with a screenshot in Ask m360 runs the desk
            k.locator('.side-tools .iconbtn[aria-label="Ask m360"]').click()
            k.wait_for_selector('.drawer #ask-file', state='attached')
            k.locator('#ask-file').set_input_files({'name': 'connections.png', 'mimeType': 'image/png', 'buffer': PNG})
            k.wait_for_selector('#ask-attached img')
            k.fill('#ask-input', 'DM: lead with the Wipro deal')
            k.keyboard.press('Enter')
            k.wait_for_selector('.drawer .bubble.ai:has-text("Handshake has 4 new people")', timeout=30000)
            k.keyboard.press('Escape')
            k.wait_for_function('() => /#handshake/.test(location.hash)')
            k.wait_for_selector('#hs-ready', timeout=40000)
            k.wait_for_function('() => M.handshake.people(M.lastCtx).length === 4 && M.handshake.people(M.lastCtx).every(x => x.state !== "new")', timeout=40000)
            arjun = by_name(k, 'Arjun Rao')
            check(arjun['verified'] and arjun['verified'].get('news') and 'Wipro' in arjun['verified']['news'][0]['title'], 'the company was verified on the press: %r' % (arjun.get('verified') or {}).get('news'))
            check(arjun['hook']['kind'] == 'news' and 'Wipro' in arjun['message'] and '—' not in arjun['message'], 'the hook is the news and the dash is gone: ' + arjun['message'])
            check(arjun['note'] == 'lead with the Wipro deal', 'the note from Ask rides along: %r' % arjun.get('note'))
            reqs = json.load(urllib.request.urlopen(base + '__ai'))
            read = [r for r in reqs if r['images']]
            check(read and read[-1]['images'][0]['type'] == 'image/jpeg', 'the screenshot reached the model: %r' % [r['images'] for r in read][-1:])
            write = [r for r in reqs if r['model'] == 'claude-opus-5-5' and r['effort'] == 'high']
            check(len(write) >= 1, 'the writer runs on the complex tier: %r' % [(r['model'], r['effort']) for r in reqs][-4:])
            # the same screenshot again: everyone is already in
            k.locator('#hs-file').set_input_files({'name': 'connections.png', 'mimeType': 'image/png', 'buffer': PNG})
            k.wait_for_selector('#hs-intake .ask-thumb img')
            k.click('#hs-run')
            k.wait_for_selector('#hs-intake:has-text("already in")', timeout=30000)
            check(k.evaluate('() => M.handshake.people(M.lastCtx).length') == 4, 'no duplicates from the second read')
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
