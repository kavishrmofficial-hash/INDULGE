#!/usr/bin/env python3
"""Hunt, the big brand lane, against the local EdgeOne stand-in (edgeone/dev/server.mjs with MOCK_AI=1,
which answers Apollo from edgeone/dev/fake-apollo.mjs): the founder pastes the Apollo key in Admin, finds
people at a company, pursues one, fills the audit, writes the copy, copies and marks a piece sent, and the
follow up ladder runs. Then a short pass on the claude.ai build through the mock harness, where people are
added by hand and the copy comes from the template.

Run: cd m360-os && python3 harness/tests/test_hunt.py
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


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def edge():
    from playwright.sync_api import sync_playwright
    build_edgeone.main()
    port = free_port()
    store = tempfile.mktemp(suffix='.json')
    env = dict(os.environ, MOCK_AI='1')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    for _ in range(50):
        try:
            urllib.request.urlopen(base, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    fails, errors = [], []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def store_all():
        return json.loads(urllib.request.urlopen(base + '__store').read())

    def store_doc(key):
        data = store_all()
        return json.loads(data[key]) if key in data else None

    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            c = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
            c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
            f = c.new_page()
            f.set_default_timeout(15000)
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
            api = lambda a, body=None: f.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, code: e.code, message: e.message}))', [a, body or {}])

            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'hunt-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')

            # ---- no key yet: the page says so, the search refuses politely ----
            st = api('apollostatus')['r']
            check(st['configured'] is False, 'fresh apollo status %r' % st)
            r = api('huntpeople', {'domain': 'tata.com'})
            check(r['ok'] is False and r['code'] == 'not_configured', 'search without a key %r' % r)
            f.goto(base + '#hunt')
            f.wait_for_selector('#hunt-finder')
            check('Apollo is not wired yet' in f.inner_text('#hunt-finder'), 'finder copy without a key')
            check(f.locator('.section-tabs .tab', has_text='Hunt').count() == 1, 'Hunt tab under Accounts')

            # ---- Admin: a bad key is refused, a good one is saved and never echoed ----
            f.goto(base + '#admin')
            f.wait_for_selector('#hunt-settings')
            f.fill('#hunt-apollo-key', 'short')
            f.locator('#hunt-apollo-save').click()
            f.wait_for_selector('.toast:has-text("does not look like")')
            f.fill('#hunt-apollo-key', 'apollo_test_key_0123456789')
            f.locator('#hunt-apollo-save').click()
            f.wait_for_selector('.toast:has-text("Apollo is on")')
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => !!s["x/apollo"])')
            x = store_doc('x/apollo')
            check(x['key'] == 'apollo_test_key_0123456789' and x['by'], 'stored key %r' % x)
            st = api('apollostatus')['r']
            check(st['configured'] is True and 'apollo_test_key' not in json.dumps(st) and st['hint'].endswith('789'), 'status hides the key %r' % st)
            check('apollo_test_key' not in f.content(), 'the key is on the page')
            # the proof bank and defaults
            f.fill('#hunt-proof-client-0', 'Swisse Wellness UAE')
            f.fill('#hunt-proof-after-0', '38k views')
            f.fill('#hunt-team', '12')
            f.fill('#hunt-link', 'https://mask360.agency/spec/tata')
            f.fill('#hunt-price', 'under 8 lakh, one PO')
            f.locator('#hunt-settings-save').click()
            f.wait_for_selector('.toast:has-text("Hunt settings saved")')
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => (JSON.parse(s["d/settings~app"]).hunt || {}).link === "https://mask360.agency/spec/tata")')
            settings = store_doc('d/settings~app')
            check(settings['hunt']['proofs'][0]['client'] == 'Swisse Wellness UAE' and settings['hunt']['teamSize'] == '12' and settings.get('start') == '10:30', 'hunt settings merge %r' % settings.get('hunt'))

            # ---- find people at tata.com, pursue one ----
            f.goto(base + '#hunt')
            f.wait_for_selector('#hunt-finder')
            f.wait_for_selector('#hunt-finder:has-text("Apollo on")')
            f.fill('#hunt-brand', 'Tata')
            f.locator('#hunt-find-co').click()
            f.wait_for_selector('#hunt-companies .chip')
            check(f.locator('#hunt-companies .chip').count() == 2, 'two companies %d' % f.locator('#hunt-companies .chip').count())
            f.locator('#hunt-companies .chip', has_text='Tata Digital').click()
            f.wait_for_selector('#hunt-people .hunt-person')
            check(f.input_value('#hunt-domain') == 'tata.com', 'domain filled from the company')
            names = f.evaluate('() => [...document.querySelectorAll("#hunt-people .hunt-person")].map(x => x.innerText)')
            check(len(names) == 2 and any('Kingshuk S***n' in n for n in names) and any('Rohit M***n' in n for n in names) and not any('Ananya' in n for n in names), 'social owners at tata.com %r' % names)
            check(any('work email on file' in n and 'a number on file' in n for n in names) and any('no email on file' in n for n in names), 'preview hints %r' % names)
            calls = json.loads(urllib.request.urlopen(base + '__apollo').read())['calls']
            last = calls[-1]
            check(last['url'].endswith('/mixed_people/api_search') and last['body']['q_organization_domains_list'] == ['tata.com'] and last['body']['person_locations'] == ['India'] and 'Head of Digital' in last['body']['person_titles'], 'apollo people call %r' % last)
            check(not any('@' in n or 'linkedin' in n.lower() for n in names), 'a preview leaked contact data')
            f.locator('#hunt-people .hunt-person', has_text='Kingshuk').get_by_role('button', name='Pursue').click()
            f.wait_for_selector('.drawer #hunt-who')
            check(f.input_value('#hunt-who') == 'Kingshuk S***n' and f.input_value('#hunt-title') == 'Head of Digital Marketing' and f.input_value('#hunt-p-brand') == 'Tata Digital' and f.input_value('#hunt-linkedin') == '', 'drawer prefilled from the preview')
            check(f.input_value('#hunt-mail') == '', 'masked email leaked into the pursuit')
            allk = store_all()
            hunt_keys = [k for k in allk if k.startswith('d/hunt~')]
            check(len(hunt_keys) == 1, 'one pursuit doc %r' % hunt_keys)
            pid = hunt_keys[0].split('~', 1)[1]
            doc = json.loads(allk[hunt_keys[0]])
            check(doc['apolloId'] == 'p_kingshuk_01' and doc['stage'] == 'found' and doc['owner'], 'pursuit doc %r' % {k: doc[k] for k in ('apolloId', 'stage')})

            # ---- enrich: the work email comes back, the phone lands through the webhook ----
            f.locator('#hunt-enrich-mail').click()
            f.wait_for_function('() => document.querySelector("#hunt-mail").value === "kingshuk.sen@tata.example"')
            check(f.input_value('#hunt-who') == 'Kingshuk Sen' and f.input_value('#hunt-linkedin') == 'https://www.linkedin.com/in/kingshuk-sen', 'enrichment completed the name and LinkedIn')
            f.locator('#hunt-enrich-phone').click()
            f.wait_for_function('() => document.querySelector("#hunt-phone").value === "+919820000001"', timeout=20000)
            hooks = json.loads(urllib.request.urlopen(base + '__apollo').read())['webhooks']
            check(hooks and hooks[-1].startswith(base.rstrip('/') + '/api/apollo?t=') and len(hooks[-1].split('t=')[1]) > 12, 'webhook url carries a token %r' % hooks)
            # a delivery without the token is dropped
            req = urllib.request.Request(base + 'api/apollo', data=json.dumps({'people': [{'id': 'p_rohit_03', 'phone_numbers': [{'sanitized_number': '+910000000000', 'type': 'mobile', 'status': 'valid'}]}]}).encode(), headers={'content-type': 'application/json'}, method='POST')
            check(json.loads(urllib.request.urlopen(req).read()) == {'ok': True, 'kept': 0}, 'unsigned webhook delivery kept')
            doc = store_doc('d/hunt~' + pid)
            check(doc['mail'] == 'kingshuk.sen@tata.example' and doc['phone'] == '+919820000001', 'enriched doc %r' % {k: doc.get(k) for k in ('mail', 'phone')})
            check(not [k for k in store_all() if k.startswith('n/hunt/pend/')], 'pending marker not cleared')

            # ---- the audit and the copy ----
            f.fill('#hunt-sub', '@tataneu')
            f.select_option('#hunt-trigger', 'newhead')
            f.fill('#hunt-trigger-note', 'joined as Head of Digital in August')
            f.fill('#hunt-a-posts', '38')
            f.fill('#hunt-a-reels', '7')
            f.fill('#hunt-a-comp', 'Flipkart')
            f.fill('#hunt-a-compposts', '52')
            f.fill('#hunt-a-compmult', '4')
            f.fill('#hunt-a-incumbent', 'Some Network')
            f.select_option('#hunt-lane', 'reels')
            f.locator('#hunt-write').click()
            f.wait_for_selector('#hunt-copyset', timeout=30000)
            prop = f.inner_text('#hunt-prop .hunt-copy')
            check('Tata Digital posted 38 times' in prop and 'Flipkart posted 52' in prop and '4 times the saves per reel' in prop, 'line 1 %r' % prop[:200])
            check('@tataneu' in prop and '8 weeks' in prop and '40 pieces' in prop, 'line 2 %r' % prop[:400])
            check('https://mask360.agency/spec/tata' in prop and 'under 8 lakh' in prop and 'Which sub brand' in prop, 'line 3 %r' % prop[-300:])
            check('Some Network' not in f.inner_text('#hunt-copyset'), 'the incumbent was named in the copy')
            check('!' not in f.inner_text('#hunt-copyset'), 'exclamation mark in the copy')
            connect = f.inner_text('#hunt-connect .hunt-copy')
            check(len(connect) <= 300 and connect.startswith('Hi Kingshuk'), 'connect note %d chars: %r' % (len(connect), connect[:60]))
            email = f.inner_text('#hunt-email .hunt-copy')
            check(email.startswith('Subject: Tata Digital on Instagram') and 'Kaavish, Mask360, Mumbai' in email, 'email %r' % email[:80])
            check(f.locator('#hunt-objections .hunt-obj').count() >= 14, 'objections %d' % f.locator('#hunt-objections .hunt-obj').count())
            check('for 8 weeks' in f.inner_text('#hunt-objections'), 'objection filled with the weeks')
            check(f.locator('#hunt-missing').count() == 0, 'nothing should be missing: %s' % (f.inner_text('#hunt-missing') if f.locator('#hunt-missing').count() else ''))
            doc = store_doc('d/hunt~' + pid)
            check(doc['stage'] == 'audited' and doc['copy']['by'] in ('ai', 'template') and len(doc['copy']['proposition']) == 3 and len(doc['copy']['followups']) == 4, 'copy saved %r' % (doc.get('copy') or {}).get('by'))
            check(doc['audit']['incumbent'] == 'Some Network' and 'Some Network' not in json.dumps(doc['copy']), 'incumbent kept for notes only')

            # ---- copy to the clipboard, mark sent, the ladder ----
            f.locator('#hunt-connect').get_by_role('button', name='Copy').click()
            f.wait_for_selector('.toast:has-text("Copied")')
            clip = f.evaluate('() => navigator.clipboard.readText()')
            check(clip == connect, 'clipboard holds the connect note')
            f.locator('#hunt-connect').get_by_role('button', name='Sent').click()
            f.wait_for_selector('.toast:has-text("Next touch on")')
            f.wait_for_function('p => fetch("/__store").then(r => r.json()).then(s => JSON.parse(s["d/hunt~" + p]).step === 1)', arg=pid)
            doc = store_doc('d/hunt~' + pid)
            in3 = f.evaluate('() => M.U.ymd(M.U.addDays(new Date(), 3))')
            check(doc['stage'] == 'sent' and doc['next'] == in3 and doc['touches'][0]['channel'] == 'linkedin', 'ladder after first touch %r' % {k: doc.get(k) for k in ('stage', 'next', 'step')})
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.wait_for_selector('#hunt-list .hunt-row:has-text("Kingshuk Sen")')
            row = f.inner_text('#hunt-list .hunt-row')
            check('Sent' in row and 'copy ready' in row and 'New marketing head' in row, 'row %r' % row)
            # due today: move the next date back from the Log tab and the strip appears
            f.locator('#hunt-list .hunt-row').first.click()
            f.wait_for_selector('.drawer #hunt-who')
            f.locator('.drawer').get_by_role('tab', name='Log').click()
            f.wait_for_selector('#hunt-next')
            f.fill('#hunt-next', f.evaluate('() => M.U.ymd(M.U.addDays(new Date(), -1))'))
            f.locator('#hunt-save').click()
            f.wait_for_selector('.toast:has-text("Saved")')
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.wait_for_selector('#hunt-due:has-text("Kingshuk Sen")')
            check('overdue' in f.inner_text('#hunt-due'), 'due strip marks overdue')

            # ---- a Radar story turns into a pursuit ----
            f.goto(base + '#radar')
            f.wait_for_selector('#radar-stream .rd-item')
            f.locator('#radar-stream .rd-item', has_text='Tata Neu').get_by_role('button', name='Pursue').click()
            f.wait_for_selector('.drawer #hunt-p-brand')
            check(f.input_value('#hunt-p-brand') == 'Tata Neu' and f.select_option('#hunt-trigger', 'mandate') and f.input_value('#hunt-trigger-note').startswith('Independent agency wins'), 'seed from the story')
            check(f.locator('#hunt-a-incumbent').input_value() == 'Independent agency', 'winner noted as the incumbent for the notes')
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            check(len([k for k in store_all() if k.startswith('d/hunt~')]) == 2, 'two pursuits after Pursue')

            # ---- a member sees the pursuits but not the key ----
            api('logout')
            f.set_viewport_size({'width': 390, 'height': 800})
            f.goto(base + '#hunt')
            f.wait_for_selector('.topbar, #signin-name')
            f.set_viewport_size({'width': 1280, 'height': 900})
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    bad = [e for e in errors if 'Failed to load resource' not in e]
    if bad:
        fails.append('console errors: %r' % bad[:4])
    return fails


def mock(h):
    """The claude.ai build: people by hand, the template writes the copy, the drawer works on a phone."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#hunt', reset=True, seed=True)
    h.roster(p)
    h.go(p, 'founder', hash='#hunt', width=1280)
    p.wait_for_selector('#hunt-finder')
    check('add people by hand' in p.inner_text('#hunt-finder'), 'claude build says people are added by hand')
    p.fill('#hunt-brand', 'Tata Sampann')
    p.locator('#hunt-manual').click()
    p.wait_for_selector('.drawer #hunt-who')
    p.fill('#hunt-who', 'Ananya Rao')
    p.fill('#hunt-title', 'Senior Brand Manager')
    p.fill('#hunt-a-posts', '22')
    p.fill('#hunt-a-comp', 'Aashirvaad')
    p.fill('#hunt-a-compposts', '40')
    p.fill('#hunt-a-compmult', '3')
    p.select_option('#hunt-lane', 'vernacular')
    p.locator('#hunt-write').click()
    p.wait_for_selector('#hunt-copyset')
    prop = p.inner_text('#hunt-prop .hunt-copy')
    check('Tata Sampann posted 22 times' in prop and 'Aashirvaad posted 40' in prop and 'Which language first?' in prop, 'template proposition %r' % prop[:300])
    check('[link to the three pieces]' in prop or '[link' in prop, 'missing link marked in brackets: %r' % prop[-200:])
    check('a proof outcome in Admin' in p.inner_text('#hunt-missing'), 'missing list names the proof bank')
    words = len(' '.join(prop.split('\n')).split())
    check(words <= 95, 'three lines run to %d words' % words)
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    docs = p.evaluate('() => Object.keys(window.__db.store()).filter(k => k.startsWith("hunt/"))')
    check(len(docs) == 1, 'one pursuit on the claude build %r' % docs)
    h.go(p, 'm1', hash='#hunt', width=390)
    p.wait_for_selector('#hunt-list .hunt-row:has-text("Ananya Rao")')
    p.locator('#hunt-list .hunt-row').first.click()
    p.wait_for_selector('.drawer #hunt-copyset, .drawer #hunt-who')
    check(h.overflow(p) <= 0, 'phone overflow on the drawer')
    p.keyboard.press('Escape')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'mock console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = edge()
    fails += run(mock)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
