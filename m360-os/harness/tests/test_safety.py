#!/usr/bin/env python3
"""Safety test. Part one runs the standalone page against the local stand-in (edgeone/dev/server.mjs):
a deleted task lands in the trash and is put back from the Backups tab; Back up now makes today's
backup with the tasks collection; the day downloads as JSON with the task in it; restore in missing
mode brings a deleted task back; overwrite mode trashes the edited copy and restores the backed up
title; integrity reports counts and names a corrupt blob; a member gets 403 on the safety actions;
emptytrash with days 0 clears the trash. Part two is the Claude mock: the founder's Super tab shows
the Safety card, Download everything records a download, importing that file after a delete adds the
task back, and the write guard refuses a roster without members.

Run: cd m360-os && python3 harness/tests/test_safety.py
"""
import json
import os
import re
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


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def standalone(fails, errors):
    from playwright.sync_api import sync_playwright

    def check(cond, msg):
        if not cond:
            fails.append(msg)

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

    def store_all():
        return json.loads(urllib.request.urlopen(base + '__store').read())

    def store_doc(key):
        data = store_all()
        return json.loads(data[key]) if key in data else None

    today = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 19800))
    srv2, store2 = None, None

    def api_at(base_url, body):
        """one API call with no cookie jar: (status, json)"""
        req = urllib.request.Request(base_url + 'api/m360', data=json.dumps(body).encode('utf-8'), method='POST', headers={'content-type': 'application/json'})
        try:
            r = urllib.request.urlopen(req)
            return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

            def device(width=1280):
                c = browser.new_context(viewport={'width': width, 'height':900}, locale='en-IN', timezone_id='Asia/Kolkata')
                pg = c.new_page()
                pg.set_default_timeout(12000)
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
                return c, pg

            # ---- the founder sets up ----
            fc, f = device()
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'safety-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            fuid = f.evaluate('() => window.M360_API("me").then(x => x.uid)')

            # ---- a task, deleted: it waits in the trash ----
            f.evaluate('u => window.M360_API("write", {op: "set", path: "tasks/t1", data: {title: "Write hero reel script", owner: u, by: u, status: "todo", created: Date.now()}})', fuid)
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'task not written')
            f.evaluate('() => window.M360_API("write", {op: "delete", path: "tasks/t1"})')
            check(store_doc('d/tasks~t1') is None, 'task still in the store after delete')
            tr = f.evaluate('() => window.M360_API("trash")')
            check(len(tr['items']) == 1 and tr['items'][0]['path'] == 'tasks/t1' and tr['items'][0]['by'] == fuid and tr['items'][0]['at'], 'trash list %r' % tr)
            tkeys = [k for k in store_all() if k.startswith('t/')]
            check(len(tkeys) == 1 and tkeys[0].endswith('~tasks~t1') and store_doc(tkeys[0])['doc']['title'] == 'Write hero reel script', 'trash blob %r' % tkeys)

            # ---- the Backups tab: put the task back from the trash ----
            f.goto(base + '#admin')
            f.wait_for_selector('#invite-email')
            f.get_by_role('tab', name='Backups').click()
            f.wait_for_selector('#backups-tab')
            row = f.locator('#trash-list .trash-row[data-path="tasks/t1"]')
            row.wait_for()
            check('Kaavish Ramchandani' in row.inner_text(), 'trash row does not name who deleted it: ' + row.inner_text())
            row.get_by_role('button', name='Put back').click()
            row.get_by_role('button', name='Tap again to put back').click()
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => "d/tasks~t1" in s)')
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'put back wrote a different document')
            f.wait_for_selector('#trash-card:has-text("The trash is empty.")')
            check(not [k for k in store_all() if k.startswith('t/')], 'trash entry left behind after put back')
            # putting back over an existing document is refused with 409 unless forced
            f.evaluate('() => window.M360_API("write", {op: "delete", path: "tasks/t1"})')
            tid = f.evaluate('() => window.M360_API("trash").then(r => r.items[0].id)')
            f.evaluate('u => window.M360_API("write", {op: "set", path: "tasks/t1", data: {title: "Another one", owner: u, by: u, status: "todo"}})', fuid)
            r409 = f.evaluate('id => window.M360_API("restore", {id}).then(() => "ok", e => e.status + ":" + e.code)', tid)
            check(r409 == '409:exists', 'restore over an existing doc: %r' % r409)
            f.evaluate('id => window.M360_API("restore", {id, force: true})', tid)
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'forced restore did not replace')
            tr = f.evaluate('() => window.M360_API("trash")')
            check(len(tr['items']) == 1 and tr['items'][0]['path'] == 'tasks/t1', 'the replaced document did not go to the trash: %r' % tr)

            # ---- Back up now: today, with the tasks collection ----
            first = f.evaluate('() => window.M360_API("backups")')
            check([d['ymd'] for d in first['days']] == [today], 'upkeep did not make today on its own: %r' % first)
            f.locator('#bk-now').click()
            f.wait_for_selector('.toast:has-text("Backed up")')
            f.wait_for_selector('#bk-row-' + today)
            bk = f.evaluate('() => window.M360_API("backups")')
            check([d['ymd'] for d in bk['days']] == [today] and bk['days'][0]['colls'].get('tasks') == 1 and bk['days'][0]['bytes'] > 0 and bk['days'][0]['at'] > first['days'][0]['at'], 'backups %r' % bk)
            check(bk['keepDays'] == 45 and bk['trashDays'] == 30 and bk['last'] == bk['days'][0]['at'], 'backups meta %r' % bk)
            check(store_doc('bk/index')['days'] == [today], 'bk/index %r' % store_doc('bk/index'))
            check(store_doc('bk/%s/tasks' % today)['docs']['t1']['title'] == 'Write hero reel script', 'backup blob for tasks')
            check('roster' in store_doc('bk/%s/index' % today)['colls'] and 'clients' in store_doc('bk/%s/index' % today)['colls'], 'manifest colls %r' % store_doc('bk/%s/index' % today)['colls'])
            check('bk/%s/lock' % today not in store_all(), 'lock left behind')
            check('collection' in f.inner_text('#bk-row-' + today) and 'KB' in f.inner_text('#bk-row-' + today), 'row text: ' + f.inner_text('#bk-row-' + today))
            f.wait_for_function('() => /ago|just now/.test(document.querySelector("#bk-last").textContent)')

            # ---- download the day ----
            with f.expect_download() as dl:
                f.locator('#bk-row-' + today).get_by_role('button', name='Download').click()
            data = json.load(open(dl.value.path()))
            check(dl.value.suggested_filename == 'm360-backup-%s.json' % today, 'download name %r' % dl.value.suggested_filename)
            check(data['ymd'] == today and data['colls']['tasks']['docs']['t1']['title'] == 'Write hero reel script', 'download content %r' % list(data))
            one = f.evaluate('d => window.M360_API("backupget", {ymd: d, coll: "tasks"})', today)
            check(one['docs']['t1']['title'] == 'Write hero reel script' and one['coll'] == 'tasks', 'backupget one coll %r' % one)

            # ---- restore, missing mode: the deleted task comes back ----
            f.evaluate('() => window.M360_API("write", {op: "delete", path: "tasks/t1"})')
            check(store_doc('d/tasks~t1') is None, 'delete before restore')
            f.locator('#bk-row-' + today).get_by_role('button', name='Restore').click()
            f.wait_for_selector('#bk-restore-drawer')
            f.select_option('#bk-restore-coll', 'tasks')
            f.locator('#bk-restore-run').click()
            f.wait_for_selector('#bk-restore-result')
            check('1 written' in f.inner_text('#bk-restore-result') and '0 skipped' in f.inner_text('#bk-restore-result'), 'restore result: ' + f.inner_text('#bk-restore-result'))
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'missing mode did not bring the task back')
            f.keyboard.press('Escape')
            f.wait_for_selector('#bk-restore-drawer', state='detached')

            # ---- restore, overwrite mode: the edited copy goes to the trash, the backed up title returns ----
            f.evaluate('() => window.M360_API("write", {op: "update", path: "tasks/t1", data: {title: "Changed title"}})')
            check(store_doc('d/tasks~t1')['title'] == 'Changed title', 'edit before overwrite')
            n_trash = len([k for k in store_all() if k.startswith('t/')])
            f.locator('#bk-row-' + today).get_by_role('button', name='Restore').click()
            f.wait_for_selector('#bk-restore-drawer')
            f.select_option('#bk-restore-coll', 'tasks')
            f.locator('#bk-restore-drawer').get_by_role('tab', name='Overwrite').click()
            f.wait_for_selector('#bk-restore-warn')
            check('goes to the trash first' in f.inner_text('#bk-restore-warn'), 'overwrite warning: ' + f.inner_text('#bk-restore-warn'))
            f.locator('.drawer').get_by_role('button', name='Overwrite from this backup').click()
            f.locator('.drawer').get_by_role('button', name='Tap again to overwrite').click()
            f.wait_for_selector('#bk-restore-result')
            check('1 written' in f.inner_text('#bk-restore-result') and '1 moved to the trash' in f.inner_text('#bk-restore-result'), 'overwrite result: ' + f.inner_text('#bk-restore-result'))
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'overwrite did not restore the title')
            tkeys = sorted(k for k in store_all() if k.startswith('t/'))
            check(len(tkeys) == n_trash + 1 and store_doc(tkeys[-1])['doc']['title'] == 'Changed title' and store_doc(tkeys[-1])['by'] == fuid, 'edited copy not trashed: %r' % tkeys)
            f.keyboard.press('Escape')
            f.wait_for_selector('#bk-restore-drawer', state='detached')
            # a member cannot restore a collection, only the founder
            logs = f.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(r => r.docs)', today)
            ents = list(((logs.get(today + '-' + fuid) or {}).get('e') or {}).values())
            check(any(x['a'] == 'restore' and x['p'] == 'tasks' and 'overwrite' in x['s'] and '1 written' in x['s'] for x in ents), 'restore not logged: %r' % [x for x in ents if x['a'] == 'restore'])
            check(any(x['a'] == 'restore' and x['p'] == 'tasks/t1' for x in ents), 'put back not logged')
            check(any(x['a'] == 'backup' for x in ents), 'backup not logged')

            # ---- integrity: counts, no problems; then a corrupt blob is named ----
            integ = f.evaluate('() => window.M360_API("integrity")')
            check(integ['ok'] is True and integ['colls']['tasks']['count'] == 1 and integ['colls']['roster']['count'] == 1 and integ['bad'] == [] and integ['docs'] >= 10, 'integrity %r' % integ)
            check(integ['colls']['roster']['newest'] and integ['caches']['stale'] == [] and integ['orphans']['sessions'] == 0, 'integrity detail %r' % integ)
            f.locator('#bk-status').get_by_role('button', name='Check again').click()
            f.wait_for_selector('#bk-health:has-text("all readable")')
            check(('%d documents' % integ['docs']) in f.inner_text('#bk-health'), 'health line: ' + f.inner_text('#bk-health'))
            f.evaluate('u => window.M360_API("write", {op: "set", path: "tasks/t2", data: {title: "Lock the shot list", owner: u, by: u, status: "todo"}})', fuid)
            urllib.request.urlopen(base + '__corrupt?key=d/tasks~t2').read()
            integ2 = f.evaluate('() => window.M360_API("integrity")')
            check(integ2['ok'] is False and integ2['bad'] == ['d/tasks~t2'] and integ2['colls']['tasks']['count'] == 1, 'integrity after corruption %r' % integ2)
            f.locator('#bk-status').get_by_role('button', name='Check again').click()
            f.wait_for_selector('#bk-health:has-text("cannot be read")')
            check('tasks/t2' in f.inner_text('#bk-health'), 'health line after corruption: ' + f.inner_text('#bk-health'))
            # a backup still runs around the corrupt blob and records it
            b2 = f.evaluate('() => window.M360_API("backup", {force: true})')
            check(b2['bad'] == ['d/tasks~t2'] and b2['colls']['tasks'] == 1, 'backup with a corrupt blob %r' % b2)
            # a stale read cache is rebuilt (the pages poll every 3 seconds, so let them settle first)
            f.wait_for_timeout(3500)
            urllib.request.urlopen(base + '__corrupt?key=a/tasks').read()
            integ3 = f.evaluate('() => window.M360_API("integrity")')
            check('tasks' in integ3['caches']['stale'] and integ3['caches']['rebuilt'] >= 1, 'stale cache %r' % integ3['caches'])
            check(store_doc('a/tasks')['docs']['t1']['d']['title'] == 'Write hero reel script', 'cache not rebuilt')
            # the corrupt document is deleted: the raw text goes to the trash, nothing is lost
            f.evaluate('() => window.M360_API("write", {op: "delete", path: "tasks/t2"})')
            tkeys = sorted(k for k in store_all() if k.startswith('t/'))
            check(tkeys and store_doc(tkeys[-1])['path'] == 'tasks/t2' and store_doc(tkeys[-1])['doc'].get('raw', '').startswith('{"broken"'), 'corrupt blob not kept in the trash')

            # ---- a member gets 403 on the safety actions ----
            mc, m = device(390)
            m.goto(base)
            m.wait_for_selector('text=Sign in to m360')
            muid = m.evaluate('() => window.M360_API("signup", {name: "Durvesh Patil", email: "durvesh@mask360.agency", password: "safety-test-pw-durvesh"}).then(r => r.uid)')
            f.evaluate('u => window.M360_API("write", {op: "update", path: "roster/team", data: {members: {[u]: {role: "member", empId: "M360-002", title: "Brand Strategist", pod: "", joined: "2026-01-05", start: "", probationEnd: "", active: true}}, updated: Date.now()}})', muid)
            codes = m.evaluate('''d => Promise.all(['trash', 'backups', 'restorecoll', 'backup', 'backupget', 'integrity', 'snapshotall', 'emptytrash', 'restore'].map(a =>
              window.M360_API(a, {ymd: d, coll: 'tasks', mode: 'missing', id: '1~tasks~t1'}).then(() => 'ok', e => e.status)))''', today)
            check(codes == [403] * 9, 'member codes %r' % codes)
            m.reload()
            m.wait_for_selector('.topbar', timeout=15000)
            m.goto(base + '#admin')
            m.wait_for_timeout(500)
            check(m.locator('#backups-tab').count() == 0 and m.get_by_role('tab', name='Backups').count() == 0, 'member sees the Backups tab')

            # ---- every change: a version before each write, view, revert, per document cap ----
            f.evaluate('() => window.M360_API("write", {op: "update", path: "tasks/t1", data: {title: "Version two"}})')
            f.evaluate('() => window.M360_API("write", {op: "update", path: "tasks/t1", data: {title: "Version three"}})')
            hist = f.evaluate('() => window.M360_API("history", {path: "tasks/t1"})')
            check(len(hist['versions']) >= 2 and hist['versions'][0]['at'] >= hist['versions'][1]['at'] and hist['versions'][0]['by'] == fuid, 'history list %r' % hist)
            ver = f.evaluate('id => window.M360_API("version", {path: "tasks/t1", id})', hist['versions'][0]['id'])
            check(ver['doc']['title'] == 'Version two', 'newest kept version should be the one just replaced: %r' % ver['doc'].get('title'))
            f.evaluate('id => window.M360_API("revert", {path: "tasks/t1", id})', hist['versions'][0]['id'])
            check(store_doc('d/tasks~t1')['title'] == 'Version two', 'revert did not put the version back')
            hist2 = f.evaluate('() => window.M360_API("history", {path: "tasks/t1"})')
            check(len(hist2['versions']) == len(hist['versions']) + 1, 'a revert keeps the replaced version too')
            check(any(v['doc']['title'] == 'Version three' for v in [f.evaluate('id => window.M360_API("version", {path: "tasks/t1", id})', hist2['versions'][0]['id'])]), 'the reverted-from version is kept')
            f.evaluate('() => Promise.all(Array.from({length: 36}, (_, i) => window.M360_API("write", {op: "update", path: "tasks/t1", data: {n: i}})))')
            hist3 = f.evaluate('() => window.M360_API("history", {path: "tasks/t1"})')
            check(len(hist3['versions']) <= 30, 'per document cap %d' % len(hist3['versions']))
            check(not [k for k in store_all() if k.startswith('h/log~')], 'log documents must not gather versions')
            codes_h = m.evaluate('() => Promise.all(["history", "version", "revert"].map(a => window.M360_API(a, {path: "tasks/t1", id: "1~u_x"}).then(() => "ok", e => e.status)))')
            check(codes_h == [403, 403, 403], 'member history codes %r' % codes_h)
            bad = f.evaluate('() => window.M360_API("history", {path: "../x"}).then(() => "ok", e => e.status)')
            check(bad == 400, 'bad path %r' % bad)
            f.goto(base + '#admin')
            f.get_by_role('tab', name='Backups').click()
            f.wait_for_selector('#history-card')
            f.fill('#hist-path', 'tasks/t1')
            f.locator('#hist-go').click()
            f.wait_for_selector('#hist-list .hist-row')
            f.locator('#hist-list .hist-row').first.get_by_role('button', name='View').click()
            f.wait_for_selector('.hist-doc')
            f.get_by_role('tab', name='Log').click()
            f.wait_for_selector('.log-versions')
            f.locator('.log-versions').first.click()
            f.wait_for_selector('.drawer #hist-list')
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.get_by_role('tab', name='Backups').click()
            f.wait_for_selector('#backups-tab')
            f.evaluate('() => window.M360_API("write", {op: "update", path: "tasks/t1", data: {title: "Write hero reel script"}})')
            check(store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'title put back for the later checks')

            # ---- snapshot all ----
            snap = f.evaluate('() => window.M360_API("snapshotall")')
            check(snap['colls']['tasks']['docs']['t1']['title'] == 'Write hero reel script' and 'roster' in snap['colls'] and snap['app'] == 'm360 OS', 'snapshotall %r' % list(snap))
            with f.expect_download() as dl2:
                f.locator('#bk-all').click()
            data2 = json.load(open(dl2.value.path()))
            check(dl2.value.suggested_filename.startswith('m360-everything-') and data2['colls']['tasks']['docs']['t1']['title'] == 'Write hero reel script', 'download everything %r' % dl2.value.suggested_filename)
            # profile records (p/) stay out: full names live there only; the handbook copy may mention first names
            check('Kaavish Ramchandani' not in json.dumps(data2) and 'Durvesh Patil' not in json.dumps(data2), 'a profile record in the snapshot')

            # ---- empty the trash ----
            r0 = f.evaluate('() => window.M360_API("emptytrash", {days: 0})')
            check(r0['removed'] >= 2 and r0['days'] == 0, 'emptytrash %r' % r0)
            check(f.evaluate('() => window.M360_API("trash").then(r => r.items.length)') == 0, 'trash not empty')
            check(not [k for k in store_all() if k.startswith('t/')], 'trash blobs left')
            check(store_doc('d/tasks~t1') is not None and store_doc('bk/%s/tasks' % today) is not None, 'emptytrash touched documents or backups')
            # the button reads Rebuild caches when the page's last health check saw the corrupt blob before the poll
            # rebuilt the cache, and Check again otherwise; both run the same check
            f.locator('#bk-status').get_by_role('button', name=re.compile('Check again|Rebuild caches')).click()
            f.wait_for_selector('#bk-health:has-text("all readable")')

            # ---- phone ----
            f.set_viewport_size({'width': 390, 'height': 800})
            f.wait_for_timeout(300)
            ov = f.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow %d' % ov)
            os.makedirs(os.path.join(ROOT, 'harness', 'shots'), exist_ok=True)
            f.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'safety-backups-390.png'), full_page=True)

            # ---- moving to a new address: the site backup (the Backups tab is still open) ----
            f.set_viewport_size({'width': 1280, 'height': 900})
            f.wait_for_selector('#site-move')
            card = f.inner_text('#site-move')
            check('Restore a site backup' in card and 'AI key' in card and 'restore a site backup here' in card, 'move card: ' + card[:300])
            with f.expect_download() as dl3:
                f.locator('#site-backup-dl').click()
            check(dl3.value.suggested_filename == 'm360-site-%s.json' % today, 'site filename %r' % dl3.value.suggested_filename)
            site_text = open(dl3.value.path(), encoding='utf-8').read()
            site = json.loads(site_text)
            check(site['app'] == 'm360' and site['kind'] == 'site' and site['exported'] and sorted(site) == ['app', 'bad', 'colls', 'exported', 'identity', 'kind', 'settingsKeys'], 'site shape %r' % sorted(site))
            check(site['colls']['tasks']['docs']['t1']['title'] == 'Write hero reel script' and 'roster' in site['colls'] and 'settings' in site['colls'], 'site colls %r' % sorted(site['colls']))
            idn = site['identity']
            check(idn['people'][fuid]['name'] == 'Kaavish Ramchandani' and idn['people'][fuid]['email'] == 'kaavish@mask360.agency' and idn['people'][muid]['name'] == 'Durvesh Patil', 'site people %r' % idn['people'])
            check(idn['owner'] == {'uid': fuid} and idn['emails'].get('kaavish%40mask360.agency') == {'uid': fuid} and idn['emails'].get('durvesh%40mask360.agency') == {'uid': muid}, 'site owner or emails %r' % [idn['owner'], sorted(idn['emails'])])
            check(set(idn['passwords']) == {fuid, muid} and all(set(w) == {'salt', 'hash', 'iter', 'at'} and w['iter'] > 0 and len(w['hash']) > 20 for w in idn['passwords'].values()), 'site passwords %r' % idn['passwords'])
            check('safety-test-pw-2026' not in site_text and 'safety-test-pw-durvesh' not in site_text, 'a plain password in the site backup')
            skeys = [k for k in store_all() if k.startswith('s/')]
            check(skeys and not any(k[2:] in site_text for k in skeys), 'a session token in the site backup')
            check(site['settingsKeys'] == {'ai': True, 'mail': False} and 'sk-ant' not in site_text, 'settings keys %r' % site.get('settingsKeys'))
            latest = store_doc('bk/site/latest')
            check(latest and latest['kind'] == 'site' and store_doc('bk/site/index')['digest'] and store_doc('bk/site/index')['bytes'] > 0, 'bk/site/latest missing')
            f.wait_for_selector('#site-latest:has-text("Daily site copy")')
            ident = f.evaluate('() => window.M360_API("siteidentity")')
            check(ident['kind'] == 'site' and ident['colls'] == {} and ident['identity']['owner'] == {'uid': fuid} and fuid in ident['identity']['passwords'], 'siteidentity %r' % sorted(ident))
            # a member gets 403 on all three
            codes3 = m.evaluate('''() => Promise.all(['sitebackup', 'siteidentity', 'siterestore'].map(a => window.M360_API(a, {backup: {kind: 'site'}, mode: 'missing'}).then(() => 'ok', e => e.status)))''')
            check(codes3 == [403] * 3, 'member site codes %r' % codes3)
            # the owner restoring the unchanged backup in missing mode writes nothing
            before = sorted(k for k in store_all() if k.startswith(('d/', 'p/', 'w/', 'e/', 'o/')))
            same = f.evaluate('b => window.M360_API("siterestore", {backup: b, mode: "missing"})', site)
            check(same['docs'] == 0 and same['people'] == 0 and same['colls'] == 0 and same['skipped'] >= 2 and same['mode'] == 'missing' and same['fresh'] is False, 'restore of an unchanged backup %r' % same)
            check(sorted(k for k in store_all() if k.startswith(('d/', 'p/', 'w/', 'e/', 'o/'))) == before, 'a missing-mode restore added keys')
            # replace mode puts a renamed task back, trashing the edited copy, and leaves the log alone
            f.evaluate('() => window.M360_API("write", {op: "update", path: "tasks/t1", data: {title: "Renamed since the backup"}})')
            n_trash = len([k for k in store_all() if k.startswith('t/')])
            rep = f.evaluate('b => window.M360_API("siterestore", {backup: b, mode: "replace"})', site)
            check(rep['mode'] == 'replace' and rep['docs'] >= 1 and rep['trashed'] >= 1 and store_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'replace %r' % rep)
            tkeys = sorted(k for k in store_all() if k.startswith('t/'))
            check(len(tkeys) == n_trash + rep['trashed'] and any(store_doc(k)['doc'].get('title') == 'Renamed since the backup' for k in tkeys), 'replace did not trash the edited copy')
            logs = f.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(r => r.docs)', today)
            ents = list(((logs.get(today + '-' + fuid) or {}).get('e') or {}).values())
            check(any(x['a'] == 'restore' and x['s'].startswith('site, replace') for x in ents) and any(x['a'] == 'sitebackup' for x in ents), 'site restore or backup not logged: %r' % [x['s'] for x in ents if x['a'] in ('restore', 'sitebackup')][-3:])
            # the replace-mode restore is itself in the log, so the log document was never rolled back
            check(any(x['a'] == 'restore' and x['s'].startswith('site, missing') for x in ents), 'the log was rolled back by replace mode')

            # ---- a brand new deployment: the site backup restored on its setup screen ----
            port2 = free_port()
            store2 = tempfile.mktemp(suffix='.json')
            srv2 = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port2), store2], env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            base2 = 'http://localhost:%d/' % port2
            for _ in range(50):
                try:
                    urllib.request.urlopen(base2, timeout=1)
                    break
                except Exception:
                    time.sleep(0.1)

            def store2_all():
                return json.loads(urllib.request.urlopen(base2 + '__store').read())

            def store2_doc(key):
                data = store2_all()
                return json.loads(data[key]) if key in data else None

            check(api_at(base2, {'a': 'me'})[1].get('setup') is True, 'the second server is not fresh')
            # a malformed file is refused with 400 and nothing is written
            bads = [
                'not an object',
                {'kind': 'nope', 'colls': {}, 'identity': idn},
                {'kind': 'site', 'colls': {'tasks': {'docs': {'..': {'title': 'x'}}}}, 'identity': idn},
                {'kind': 'site', 'colls': {'tasks': {'docs': {'t1': [1, 2]}}}, 'identity': idn},
                {'kind': 'site', 'colls': {'odd': {'docs': {'a/b': {'x': 1}}}}, 'identity': idn},
                {'kind': 'site', 'colls': {'tasks': {'docs': {'t~1': {'x': 1}}}}, 'identity': idn},
                {'kind': 'site', 'colls': {'tasks': 'docs'}, 'identity': idn},
                {'kind': 'site', 'colls': {}, 'identity': {'people': {'bad id': {'name': 'x', 'email': '', 'at': 1}}, 'emails': {}, 'owner': {}, 'passwords': {}}},
                {'kind': 'site', 'colls': {}, 'identity': {'people': {}, 'emails': {}, 'owner': {'uid': fuid}, 'passwords': {}}},
                {'kind': 'site', 'colls': {}, 'identity': {'people': idn['people'], 'emails': {'kaavish@mask360.agency': {'uid': fuid}}, 'owner': {}, 'passwords': {}}},
                {'kind': 'site', 'colls': {}, 'identity': {'people': idn['people'], 'emails': {}, 'owner': {}, 'passwords': {fuid: {'salt': 'x'}}}},
                {'kind': 'site', 'colls': {}, 'identity': {'people': {fuid: {'name': 'K', 'email': 'nope', 'at': 1}}, 'emails': {}, 'owner': {}, 'passwords': {}}},
            ]
            for b in bads:
                st, j = api_at(base2, {'a': 'siterestore', 'backup': b, 'mode': 'missing'})
                check(st == 400 and j['error']['code'] == 'invalid_argument', 'malformed accepted: %r -> %r' % (str(b)[:70], (st, j)))
            st, j = api_at(base2, {'a': 'siterestore', 'mode': 'missing'})
            check(st == 400, 'no backup accepted: %r' % j)
            leaked = [k for k in store2_all() if k.startswith(('d/', 'p/', 'w/', 'e/', 'o/'))]
            check(not leaked, 'a refused restore wrote something: %r' % leaked[:5])
            check(api_at(base2, {'a': 'me'})[1].get('setup') is True, 'a refused restore ended setup')

            # the setup screen: choose Restore a site backup, pick the file, restore, sign in with the old email and password
            nc, n = device()
            n.goto(base2)
            n.wait_for_selector('text=Set up m360 OS')
            n.locator('#site-restore-open').click()
            n.wait_for_selector('#site-restore-box')
            check('never in a backup' in n.inner_text('.gate') and '!' not in n.inner_text('.gate'), 'setup restore copy: ' + n.inner_text('.gate')[:300])
            n.set_input_files('#site-restore-file', {'name': 'notes.json', 'mimeType': 'application/json', 'buffer': b'{"hello": 1}'})
            n.wait_for_selector('#site-restore-err')
            check(n.locator('#site-restore-counts').count() == 0, 'a file with nothing in it showed counts')
            n.set_input_files('#site-restore-file', {'name': dl3.value.suggested_filename, 'mimeType': 'application/json', 'buffer': site_text.encode('utf-8')})
            n.wait_for_selector('#site-restore-counts')
            counts = n.inner_text('#site-restore-counts')
            check('2 people' in counts and 'exported' in counts and 'tasks' in n.inner_text('#site-restore'), 'restore counts: ' + counts + ' / ' + n.inner_text('#site-restore')[:200])
            n.locator('#site-restore-go').get_by_role('button', name='Restore everything').click()
            n.locator('#site-restore-go').get_by_role('button', name='Tap again to restore').click()
            n.wait_for_selector('#site-restored')
            check('Sign in with the email and password you used before' in n.inner_text('#site-restored'), 'restored line: ' + n.inner_text('#site-restored'))
            check(store2_doc('o/owner') == {'uid': fuid} and store2_doc('p/' + muid)['name'] == 'Durvesh Patil' and store2_doc('d/tasks~t1')['title'] == 'Write hero reel script', 'new site store')
            check(store2_doc('w/' + fuid) == idn['passwords'][fuid] and store2_doc('e/kaavish%40mask360.agency') == {'uid': fuid}, 'password hash or email index not carried across')
            left = [k for k in store2_all() if k.startswith(('s/', 'x/', 'k/', 'i/', 'c/', 'a/')) and not k.startswith('x/v/')]
            check(not left, 'sessions, keys or stale caches on the new site: %r' % left[:6])
            st, j = api_at(base2, {'a': 'setup', 'name': 'Intruder', 'email': 'intruder@example.com', 'password': 'intruder-pw-77'})
            check(st == 409, 'setup still open after a restore: %d' % st)
            n.fill('#signin-email', 'kaavish@mask360.agency')
            n.fill('#signin-pw', 'safety-test-pw-2026')
            n.locator('#signin-go').click()
            n.wait_for_selector('.sidebar')
            me2 = n.evaluate('() => window.M360_API("me")')
            check(me2['uid'] == fuid and me2['isOwner'] is True and me2['name'] == 'Kaavish Ramchandani' and me2['hasPw'] is True, 'me on the new site %r' % me2)
            titles1 = sorted(t['title'] for t in site['colls']['tasks']['docs'].values())
            titles2 = n.evaluate('() => window.M360_API("snapshot").then(r => Object.values(r.colls.tasks.docs).map(t => t.title).sort())')
            check(titles1 == titles2 == ['Write hero reel script'], 'task titles %r vs %r' % (titles1, titles2))
            n.goto(base2 + '#tasks')
            n.wait_for_selector('text=Write hero reel script')
            # the member signs in with their old password too; a wrong one is still refused
            check(api_at(base2, {'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': 'safety-test-pw-durvesh'})[0] == 200, 'member cannot sign in on the new site')
            check(api_at(base2, {'a': 'pw', 'email': 'durvesh@mask360.agency', 'password': 'wrong-pw-000000'})[0] == 401, 'a wrong password signs in on the new site')
            logs2 = n.evaluate('d => window.M360_API("logs", {from: d, to: d}).then(r => r.docs)', today)
            ents2 = list(((logs2.get(today + '-' + fuid) or {}).get('e') or {}).values())
            check(any(x['a'] == 'restore' and x['s'].startswith('site, missing, fresh site') and '2 people' in x['s'] for x in ents2), 'restore not logged on the new site: %r' % [x['s'] for x in ents2 if x['a'] == 'restore'])
            integ4 = n.evaluate('() => window.M360_API("integrity")')
            check(integ4['ok'] is True and integ4['colls']['tasks']['count'] == 1 and integ4['docs'] >= sum(len(c['docs']) for c in site['colls'].values()), 'integrity on the new site %r' % integ4)
            # the new site's own site backup carries the same people and documents
            site2 = n.evaluate('() => window.M360_API("sitebackup")')
            check(site2['kind'] == 'site' and set(site2['identity']['people']) == {fuid, muid} and sorted(site2['colls']) == sorted(site['colls']), 'site backup on the new site %r' % sorted(site2.get('colls', {})))
            n.goto(base2 + '#admin')
            n.wait_for_selector('#invite-email')
            n.get_by_role('tab', name='Backups').click()
            n.wait_for_selector('#site-restore-here')
            n.set_viewport_size({'width': 390, 'height': 800})
            n.wait_for_timeout(300)
            ov = n.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow on the move card %d' % ov)
            nc.close()
            browser.close()
    finally:
        srv.terminate()
        if srv2:
            srv2.terminate()
        for fpath in (store, store2):
            try:
                if fpath:
                    os.remove(fpath)
            except OSError:
                pass


def mock(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    def open_super(p, width=1280):
        h.go(p, 'founder', hash='#admin', width=width)
        p.get_by_role('tab', name='Super').click()
        p.wait_for_selector('#super-tab')

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)

    # ---- the Safety card on Super, download everything ----
    open_super(p)
    p.wait_for_selector('#safety-card')
    check('Download everything' in p.inner_text('#safety-card') and 'Import a backup' in p.inner_text('#safety-card'), 'safety card: ' + p.inner_text('#safety-card')[:200])
    p.locator('#safety-export').click()
    p.wait_for_function('() => window.__downloads.length === 1')
    dl = p.evaluate('window.__downloads[0]')
    check(dl['filename'].startswith('m360-everything-') and dl['filename'].endswith('.json'), 'export filename %r' % dl['filename'])
    data = json.loads(dl['data'])
    check(set(data) >= {'roster', 'settings', 'collections'} and data['collections']['tasks']['t1']['title'] == 'Write hero reel script', 'export shape %r' % sorted(data))
    check('Kaavish Ramchandani' not in dl['data'] and '@mask360' not in dl['data'], 'export carries names or addresses')

    # ---- import after a delete: only the missing task comes back ----
    n_writes = p.evaluate('() => window.__dbWrites.length')
    p.evaluate('() => window.__db.del("tasks/t1")')
    p.wait_for_timeout(200)
    check(doc(p, 'tasks/t1') is None, 'task not deleted')
    p.set_input_files('#safety-import input[type="file"]', {'name': dl['filename'], 'mimeType': 'application/json', 'buffer': dl['data'].encode('utf-8')})
    p.wait_for_selector('#safety-counts')
    counts = p.inner_text('#safety-counts')
    check('tasks' in counts and 'roster' in counts and 'settings' in counts, 'import counts: ' + counts)
    p.locator('#safety-import').get_by_role('button', name='Add the missing documents').click()
    p.locator('#safety-import').get_by_role('button', name='Tap again to add them').click()
    p.wait_for_selector('#safety-import-result')
    res = p.inner_text('#safety-import-result')
    check(res.startswith('1 added'), 'import result: ' + res)
    check(doc(p, 'tasks/t1') and doc(p, 'tasks/t1')['title'] == 'Write hero reel script', 'task not restored by import')
    added = p.evaluate('n => window.__dbWrites.slice(n).filter(w => !w.path.startsWith("log/")).map(w => w.path)', n_writes)
    check(added == ['tasks/t1'], 'import wrote more than the missing task: %r' % added)
    check(doc(p, 'tasks/t2')['title'] == 'Lock the shot list', 'import touched an existing task')
    # a day backup from the standalone server imports the same way
    p.evaluate('() => window.__db.del("tasks/t2")')
    p.wait_for_timeout(200)
    day = json.dumps({'ymd': '2026-01-01', 'colls': {'tasks': {'docs': data['collections']['tasks']}, 'log': {'docs': {'2026-01-01-u_m1': {'e': {}}}}}})
    p.set_input_files('#safety-import input[type="file"]', {'name': 'm360-backup-2026-01-01.json', 'mimeType': 'application/json', 'buffer': day.encode('utf-8')})
    p.wait_for_selector('#safety-counts')
    check('left out' in p.inner_text('#safety-import'), 'log entries not reported as left out: ' + p.inner_text('#safety-import'))
    p.locator('#safety-import').get_by_role('button', name='Add the missing documents').click()
    p.locator('#safety-import').get_by_role('button', name='Tap again to add them').click()
    p.wait_for_function('() => !!window.__db.get("tasks/t2")')
    check(doc(p, 'log/u_m1/days/2026-01-01') is None and doc(p, 'log/2026-01-01-u_m1') is None, 'log imported')

    # ---- the write guard ----
    n_roster = p.evaluate('() => window.__dbWrites.filter(w => w.path === "roster/team").length')
    r = p.evaluate('() => M.lastCtx.W.set("roster/team", {}).then(() => "wrote", e => e.code)')
    check(r == 'refused', 'roster without members: %r' % r)
    p.wait_for_selector('.toast:has-text("was not saved")')
    check(p.evaluate('() => window.__dbWrites.filter(w => w.path === "roster/team").length') == n_roster, 'refused roster write reached the db')
    check(doc(p, 'roster/team')['members'].get('u_founder'), 'roster damaged')
    bad = p.evaluate('''() => Promise.all([
      M.lastCtx.W.set('settings/app', {}),
      M.lastCtx.W.set('tasks/x1', [1, 2]),
      M.lastCtx.W.set('tasks/x2', {title: undefined}),
      M.lastCtx.W.merge('tasks/x3', {fn: () => 1}),
      M.lastCtx.W.set('tasks/x4', {note: 'a'.repeat(200001)}),
      M.lastCtx.W.update('tasks/t1', 'nope'),
      M.lastCtx.W.set('tasks/x5', {deep: {fn: function () {}}})
    ].map(pr => pr.then(() => 'wrote', e => e.code)))''')
    check(bad == ['refused'] * 7, 'guard codes %r' % bad)
    check(not p.evaluate('() => window.__dbWrites.some(w => /^tasks\\/x/.test(w.path))'), 'a refused payload reached the db')
    ok = p.evaluate('() => M.lastCtx.W.merge("tasks/t1", {note: "fine"}).then(() => "wrote", e => e.code)')
    check(ok == 'wrote' and doc(p, 'tasks/t1')['note'] == 'fine', 'a good write was refused: %r' % ok)
    ok2 = p.evaluate('() => M.lastCtx.W.merge("roster/team", {updated: Date.now()}).then(() => "wrote", e => e.code)')
    check(ok2 == 'wrote', 'a roster merge was refused: %r' % ok2)

    # ---- members do not see the card; the phone layout holds ----
    h.go(p, 'm1', hash='#admin', width=1280)
    p.wait_for_timeout(300)
    check(p.locator('#safety-card').count() == 0, 'member sees the safety card')
    open_super(p, width=390)
    p.wait_for_selector('#safety-card')
    p.wait_for_timeout(300)
    ov = h.overflow(p)
    check(ov <= 0, 'phone overflow %d' % ov)
    check(not h.small_text(p), 'small text %r' % h.small_text(p)[:2])
    h.shot(p, 'safety-super-390')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def main():
    fails, errors = [], []
    standalone(fails, errors)
    bad = [e for e in errors if 'Failed to load resource' not in e]
    if bad:
        fails.append('standalone console errors: %r' % bad[:4])
    fails += ['mock: ' + x for x in run(mock)]
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))


if __name__ == '__main__':
    main()
