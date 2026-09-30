#!/usr/bin/env python3
"""Scout, the founder's business development buddy: on the claude.ai page it writes copy for a pursuit
that has none and leaves the pitch in the inbox with a LinkedIn note to copy; on the team site it reads
the press, picks a brand with a trigger, finds the person on Apollo, writes the pitch, and lands it in
the inbox, once a day, and never twice for the same brand. Members see none of it.

Run: cd m360-os && python3 harness/tests/test_scout.py
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
    # a pursuit with no copy yet, and Scout asked to run now
    h.seed_doc(p, 'hunt/p1', {'brand': 'Tata Neu', 'company': 'Tata Neu', 'who': 'Kingshuk Sen', 'title': 'Head of Digital', 'platform': 'Instagram', 'trigger': 'mandate', 'triggerNote': 'the creative account moved',
                              'lane': 'reels', 'audit': {'competitor': 'Flipkart'}, 'copy': None, 'touches': [], 'step': 0, 'next': '', 'stage': 'found', 'owner': 'u_founder', 'by': 'scout', 'created': 1, 'updated': 1})
    h.seed_doc(p, 'hunt/scout', {'force': True, 'updated': 1})
    h.go(p, 'founder', hash='#scout', width=1280)
    p.wait_for_selector('#scout-card')
    check(p.locator('.scout-figure').count() == 1 and p.locator('#scout-run').count() == 1, 'the card with the drawn buddy and Run now')
    p.wait_for_function('() => { const s = window.__db.get("hunt/scout"); return s && s.state === "rest" && s.day === M.U.todayStr(); }', timeout=40000)
    st = p.evaluate('window.__db.get("hunt/scout")')
    kinds = [l['state'] for l in st['log']]
    check('write' in kinds and 'deliver' in kinds and 'rest' in kinds and not st.get('force'), 'the log after a run: %r' % kinds)
    pu = p.evaluate('window.__db.get("hunt/p1")')
    check(pu.get('copy') and pu['copy'].get('connect') and 'Tata Neu' in pu['copy']['connect'] and pu['stage'] == 'audited' and isinstance(pu['copy'].get('missing'), list), 'the pursuit got its copy: %r' % (pu.get('copy') or {}).get('connect'))
    deliver = [l for l in st['log'] if l['state'] == 'deliver'][0]
    check(deliver['ref'] == '#hunt/p1' and 'Tata Neu' in deliver['line'] and 'to count' in deliver['line'], 'the deliver line: %r' % deliver)
    p.wait_for_selector('#scout-outputs')
    row = p.inner_text('#scout-outputs')
    check('Tata Neu' in row and 'Copy the LinkedIn note' in row and 'Copy the email' in row and 'to count' in row, 'the output row: ' + row.replace(chr(10), ' | ')[:300])
    check(p.locator('#scout-outputs a[href*="linkedin.com"]').count() == 1, 'an Open LinkedIn link')
    items = h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("scout:")).map(i => i.text)')
    check(len(items) == 1 and 'Scout: Pitch for Tata Neu' in items[0], 'the inbox line: %r' % items)
    # the inbox drawer itself opens with the Scout line in it
    p.keyboard.press('i')
    p.wait_for_selector('.drawer:has-text("Inbox")')
    check('Pitch for Tata Neu' in p.inner_text('.drawer'), 'the inbox drawer should show the Scout line: ' + p.inner_text('.drawer')[:200].replace(chr(10), ' | '))
    p.keyboard.press('Escape')
    p.wait_for_selector('.drawer', state='detached')
    # a second run the same day does nothing more (no force, day marked)
    n_before = len(st['log'])
    p.wait_for_timeout(2500)
    check(len(p.evaluate('window.__db.get("hunt/scout").log')) == n_before, 'no second run the same day')
    # a name and a face
    p.fill('#scout-name', 'Bolt')
    p.click('#scout-name-save')
    p.wait_for_function('() => window.__db.get("hunt/scout").name === "Bolt"')
    p.wait_for_selector('#scout-card:has-text("Bolt")')
    # pause: the figure sleeps
    p.click('#scout-pause')
    p.wait_for_selector('.scout-figure.sc-sleep')
    p.click('#scout-pause')
    p.wait_for_function('() => !document.querySelector(".scout-figure.sc-sleep")')
    # the HQ brief carries the compact card; a member sees nothing
    h.go(p, 'founder', hash='#hq', width=1280)
    p.wait_for_selector('#scout-card')
    check(h.overflow(p) == 0, 'overflow on HQ: %d' % h.overflow(p))
    h.go(p, 'founder', hash='#scout', width=390)
    p.wait_for_selector('#scout-card')
    p.wait_for_timeout(300)
    check(h.overflow(p) == 0, 'phone overflow: %d' % h.overflow(p))
    h.go(p, 'm1', hash='#scout', width=1280)
    p.wait_for_timeout(500)
    check(p.locator('#scout-card').count() == 0 and h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("scout")).length') == 0, 'a member landed on Scout')
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
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'scout-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            k.evaluate('window.M360_API("apollokey", {key: "apollo_test_key_000000000000"})')
            k.goto(base + '#scout'); k.wait_for_selector('#scout-card')
            k.click('#scout-run')
            k.wait_for_function('() => { const s = M.lastCtx.coll.hunt.map.scout; return s && s.state === "rest" && s.day === M.U.todayStr(); }', timeout=60000)
            st = k.evaluate('M.lastCtx.coll.hunt.map.scout')
            kinds = [l['state'] for l in st['log']]
            check(kinds[::-1][:4] == ['read', 'find', 'think', 'write'] or ('read' in kinds and 'find' in kinds and 'write' in kinds), 'the site run reads, finds, thinks and writes: %r' % kinds[::-1])
            mine = k.evaluate('M.hunt.pursuits(M.lastCtx).filter(p => p.by === "scout")')
            check(len(mine) == 1 and mine[0]['brand'] == 'Tata Neu' and mine[0]['trigger'] == 'mandate' and mine[0].get('copy') and mine[0]['stage'] == 'audited', 'the pursuit from the press: %r, log %r' % ([(p.get('brand'), p.get('trigger'), p.get('stage'), p.get('who')) for p in mine], [l['line'] for l in st['log']][:8]))
            check(mine and str(mine[0].get('who') or '').split(' ')[0] in ('Kingshuk', 'Rohit', 'Ananya') and mine[0].get('title'), 'the person from Apollo: %r' % [(p.get('who'), p.get('title')) for p in mine])
            found = [l for l in st['log'] if l['state'] == 'find']
            check(found and 'Tata Neu' in found[0]['line'], 'the trigger line: %r' % found)
            items = k.evaluate('M.inbox.items(M.lastCtx).filter(i => i.id.startsWith("scout:")).map(i => i.text)')
            check(len(items) == 1 and 'Tata Neu' in items[0], 'the inbox line on the site: %r' % items)
            # run again: the same brand is not pursued twice, the day is done
            k.evaluate('M.lastCtx.W.merge("hunt/scout", {force: true, updated: Date.now()})')
            k.wait_for_function('() => { const s = M.lastCtx.coll.hunt.map.scout; return s && !s.force && s.state === "rest"; }', timeout=60000)
            mine2 = k.evaluate('M.hunt.pursuits(M.lastCtx).filter(p => p.by === "scout")')
            brands = [p['brand'] for p in mine2]
            check(brands.count('Tata Neu') == 1 and len(set(brands)) == len(brands), 'a second run must move to a new brand, never repeat one: %r' % brands)
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
