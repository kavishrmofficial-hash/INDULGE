#!/usr/bin/env python3
"""The browser half of the office simulation: while office_sim.mjs keeps a busy office on the server (people
chatting, moving tasks, logging talks, posting), three real browser windows (the founder on a laptop, an admin
on a laptop, a member on a phone) open every page of m360 and use the main new features. Records page crashes,
console errors, server errors and pages that come up blank. Writes harness/out/office_walk.json.

Run: cd m360-os && ../.venv/bin/python harness/sim/office_walk.py     (env WALK_LOAD_USERS=60, WALK_LOAD_SECONDS=200)
Every password here is made up for the test."""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402

ROUTES = ['today', 'office', 'feed', 'tasks', 'projects', 'talks', 'pitches', 'clients', 'companies', 'base', 'people',
          'calendar', 'leave', 'handbook', 'hiring', 'reviews', 'scores', 'awards', 'trophies', 'play', 'music', 'notes',
          'voice', 'me', 'character', 'week', 'reflect', 'care', 'watch', 'radar', 'mail', 'drive', 'gcal', 'hq', 'coo',
          'command', 'import', 'books', 'invoices', 'expenses', 'statement', 'payroll', 'letters', 'billing']
OWNER_ONLY = {'books', 'invoices', 'expenses', 'statement', 'payroll', 'letters', 'billing'}
NOISE = ('favicon', 'Download the React DevTools', 'net::ERR_ABORTED', 'WebGL', 'GPU stall', 'THREE.WebGLRenderer')


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def api(base, a, body, cookie=''):
    req = urllib.request.Request(base + 'api/m360', data=json.dumps(dict(a=a, **body)).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'cookie': 'm360s=' + cookie if cookie else ''})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            sc = r.headers.get('set-cookie') or ''
            tok = sc.split('m360s=')[1].split(';')[0] if 'm360s=' in sc else ''
            return r.status, json.loads(r.read() or b'{}'), tok
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}'), ''


def main():
    from playwright.sync_api import sync_playwright
    build_edgeone.main()
    port = free_port()
    base = 'http://localhost:%d/' % port
    env = dict(os.environ, MOCK_AI='1', STORE_LAG_MS=os.environ.get('STORE_LAG_MS', '20'))
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), ':memory:'], env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        try:
            urllib.request.urlopen(base, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    femail, fpw = 'founder.walk@mask360.test', 'Walk-founder-7731!Qz'
    load = subprocess.Popen(['node', os.path.join(ROOT, 'harness', 'sim', 'office_sim.mjs')],
                            env=dict(os.environ, SIM_PORT=str(port), SIM_USERS=os.environ.get('WALK_LOAD_USERS', '60'),
                                     SIM_SECONDS=os.environ.get('WALK_LOAD_SECONDS', '200'), SIM_FOUNDER_EMAIL=femail, SIM_FOUNDER_PW=fpw),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=ROOT)
    fcookie = ''
    for _ in range(200):
        st, out, tok = api(base, 'pw', {'email': femail, 'password': fpw})
        if st == 200 and tok:
            fcookie = tok
            break
        time.sleep(0.3)
    assert fcookie, 'the load never set up the founder'
    walkers = {'founder': fcookie}
    for who, role in (('admin', 'founder'), ('member', 'member')):
        st, out, tok = api(base, 'signup', {'name': 'Walk ' + who.title(), 'email': 'walk.%s@mask360.test' % who, 'password': 'Walk-%s-5521!Qz' % who})
        assert st == 200, out
        st2, out2, _ = api(base, 'write', {'op': 'merge', 'path': 'roster/team', 'data': {'members': {out['uid']: {'role': role, 'title': who, 'active': True, 'joined': '2026-10-01'}}}}, fcookie)
        assert st2 == 200, out2
        walkers[who] = tok

    report = {'pages': {}, 'flows': {}, 'server500': []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        setups = {'founder': dict(viewport={'width': 1440, 'height': 900}), 'admin': dict(viewport={'width': 1280, 'height': 800}),
                  'member': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)}
        pages = {}
        for who, opts in setups.items():
            ctx = browser.new_context(locale='en-IN', timezone_id='Asia/Kolkata', **opts)
            ctx.add_cookies([{'name': 'm360s', 'value': walkers[who], 'url': base}])
            pg = ctx.new_page()
            pg._errs = []
            pg.on('pageerror', lambda e, pg=pg: pg._errs.append('crash: ' + str(e)[:300]))
            pg.on('console', lambda m, pg=pg: pg._errs.append('console: ' + m.text[:300]) if m.type == 'error' and not any(n in m.text for n in NOISE) else None)
            pg.on('response', lambda r: report['server500'].append(r.url + ' ' + str(r.status)) if r.status >= 500 else None)
            pg.goto(base)
            pg.wait_for_timeout(2500)
            pages[who] = pg

        for route in ROUTES:
            for who, pg in pages.items():
                if route in OWNER_ONLY and who != 'founder':
                    continue
                pg._errs.clear()
                try:
                    pg.goto(base + '#' + route)
                    pg.wait_for_timeout(1800)
                    text = pg.evaluate('document.body.innerText.length')
                except Exception as e:  # noqa: BLE001
                    pg._errs.append('navigate: ' + str(e)[:200])
                    text = 0
                errs = list(dict.fromkeys(pg._errs))
                if who != 'founder' and pg.get_by_text('Ask to join').count():
                    errs.append('shown the join screen: not on the team')
                if text < 40:
                    errs.append('page came up blank')
                if errs:
                    report['pages'].setdefault(route, {})[who] = errs
                    pg.screenshot(path=os.path.join(ROOT, 'harness', 'out', 'walk_%s_%s.png' % (route, who)))
            print('[walk]', route, 'ok' if route not in report['pages'] else 'PROBLEMS ' + json.dumps(report['pages'][route])[:300], flush=True)

        # the new features, used the way a person would
        def flow(name, who, fn):
            pg = pages[who]
            pg._errs.clear()
            # a new person is offered the buddy's tour once; a person would tap Later
            later = pg.locator('#tour-later')
            if later.count():
                later.first.click()
                pg.wait_for_timeout(600)
            try:
                note = fn(pg)
                ok = True
            except Exception as e:  # noqa: BLE001
                note, ok = str(e)[:300], False
            report['flows'][name] = {'ok': ok and not pg._errs, 'note': note, 'errors': list(dict.fromkeys(pg._errs))}
            if not report['flows'][name]['ok']:
                pg.screenshot(path=os.path.join(ROOT, 'harness', 'out', 'walk_flow_%s.png' % name.replace(' ', '_')))
            print('[walk] flow', name, 'ok' if report['flows'][name]['ok'] else 'FAILED ' + json.dumps(report['flows'][name])[:400], flush=True)

        def people_quick_add(pg):
            pg.goto(base + '#talks')
            pg.wait_for_selector('#talk-who', timeout=15000)
            pg.fill('#talk-who', 'Umashan')
            pg.fill('#talk-org input, input#talk-org', 'Tank Tailor') if pg.locator('#talk-org input').count() else pg.fill('#talk-org', 'Tank Tailor')
            note = '#talk-note input' if pg.locator('#talk-note input').count() else '#talk-note'
            pg.fill(note, 'Asked me to connect after 16 Oct')
            pg.click('#talk-save')
            pg.wait_for_timeout(2500)
            assert pg.get_by_text('Umashan').count() > 0, 'the new person did not show'
            return 'added'

        def pipeline_quick_add(pg):
            pg.goto(base + '#pitches')
            pg.wait_for_selector('#prop-brand', timeout=15000)
            brand = '#prop-brand input' if pg.locator('#prop-brand input').count() else '#prop-brand'
            pg.fill(brand, 'Tank Tailor walk')
            pg.click('#prop-save')
            pg.wait_for_timeout(2500)
            assert pg.get_by_text('Tank Tailor walk').count() > 0, 'the proposal did not show'
            return 'added'

        def bank_csv(pg):
            path = os.path.join(ROOT, 'harness', 'out', 'walk_statement.csv')
            rows = ['Date,Narration,Withdrawal,Deposit,Balance']
            for k in range(60):
                party = ['STARBUCKS COFFEE MUMBAI', 'SOHO HOUSE MUMBAI', 'JUNCO HOSPITALITY PVT', 'UBER INDIA', 'NEFT CR TANK TAILOR'][k % 5]
                out_amt, in_amt = ('', '125000.00') if 'NEFT' in party else ('%d.00' % (300 + k * 17), '')
                rows.append('%02d/10/2026,%s %d,%s,%s,%d.00' % (k % 28 + 1, party, k, out_amt, in_amt, 500000 - k * 100))
            open(path, 'w').write('\n'.join(rows))
            pg.goto(base + '#statement')
            pg.wait_for_timeout(1500)
            pg.locator('input[type=file]').first.set_input_files(path)
            pg.wait_for_timeout(6000)
            body = pg.evaluate('document.body.innerText')
            assert 'Starbucks' in body or 'STARBUCKS' in body, 'no Starbucks group after upload'
            return 'grouped'

        def character_emote(pg):
            pg.goto(base + '#character')
            pg.wait_for_selector('#character-page', timeout=15000)
            pg.locator('#emote-bar .emote-btn').first.click()
            pg.wait_for_timeout(1000)
            return 'sent'

        def office_live(pg):
            pg.goto(base + '#office')
            pg.wait_for_timeout(6000)
            return 'watched'

        def chatbot(pg):
            pg.goto(base + '#today')
            pg.wait_for_timeout(1200)
            return 'opened'

        flow('people quick add', 'admin', people_quick_add)
        flow('pipeline quick add', 'member', pipeline_quick_add)
        flow('bank statement csv', 'founder', bank_csv)
        flow('character emote', 'member', character_emote)
        flow('office live', 'founder', office_live)
        flow('today', 'member', chatbot)
        browser.close()

    out, _ = load.communicate(timeout=900)
    report['load'] = out.decode()[-6000:]
    srv.terminate()
    srv_out = srv.communicate(timeout=10)[0].decode()
    report['serverErrors'] = [ln for ln in srv_out.splitlines() if 'failed:' in ln or 'Error' in ln][:80]
    json.dump(report, open(os.path.join(ROOT, 'harness', 'out', 'office_walk.json'), 'w'), indent=1)
    bad = {k: v for k, v in report['pages'].items()}
    print('\n=== browser walk: %d pages with problems, %d of %d flows failed, %d server 500s ===' % (
        len(bad), sum(1 for f in report['flows'].values() if not f['ok']), len(report['flows']), len(report['server500'])))
    print('\n'.join(report['serverErrors'][:30]))
    print(report['load'][-2500:])


if __name__ == '__main__':
    main()
