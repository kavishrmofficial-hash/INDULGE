#!/usr/bin/env python3
"""v34 test: prospects stay private (spec B7, H10 and founder decision D2).

On the claude.ai mock: Durvesh (m1) logs a talk with Meera at Swisse. Kaavish's page then reads none of it: his
own index is empty, the read of Durvesh's document is refused, search has no "Your people" row for Meera, the
inbox carries no follow-up of Durvesh's, and the activity log line for the write shows the path and its keys with
no name in it; a preview of Durvesh shows nothing. Durvesh's own page finds Meera in search and the inbox.
On the team site (edgeone/dev/server.mjs, the real API code): a member writes data/users/<uid>/prospects and
prospects.<YYYY-MM> (the flat four-segment path, as on the page), and the agent ledger and buddy thread that carry
the same typed line; the owner is refused history and version on all of them, while the member reads their own
history and the owner still reads history on the member's other private document; the daily backup, a backup read by day and by collection, a snapshot by collection and the whole
snapshot leave the two documents out for the owner while the backup blob keeps them; a deleted month log never
shows in the owner's trash. The COO's state on the page and the server's collection list hold no data/users path
and no prospects key. window.__sampleCalls stays empty.

Fails until builder 1 (25-prospects.js, 02-state.js) is merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_privacy.py
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
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
MON = datetime(2026, 10, 5, 10, 0, tzinfo=IST)
NOW = int(MON.timestamp() * 1000)
DAY = 86400000


def mock_part(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(MON)
    p = c.new_page()
    p.set_default_timeout(20000)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))

    def be(ident):
        p.goto(h.url(ident, '#home', noai=True))
        h.ready(p)
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.prospects && M.lastCtx.activeMembers.length >= 3 && M.lastCtx.priv.prospects.ready)')
        p.wait_for_timeout(300)

    doc = lambda path: p.evaluate('k => window.__db.get(k)', path)  # noqa: E731

    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    if not p.evaluate('() => !!(M.prospects && M.prospects.apply && M.when)'):
        raise AssertionError('M.prospects is not on the page: this test runs once builder 1 is merged')
    h.roster(p, [M1, M2, M3])
    base = {'category': '', 'contact': '', 'source': '', 'updated': NOW, 'stageAt': NOW - 5 * DAY, 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': NOW - 5 * DAY}
    h.seed_doc(p, 'pitches/pt_swisse', {**base, 'brand': 'Swisse', 'owner': M1, 'stage': 'proposal'})

    # ---- Durvesh logs a talk, then a reminder due now (set straight on the store, since the day is today) ----
    be('m1')
    r = p.evaluate('''async () => { const c = M.lastCtx; const a = await M.prospects.apply(c, M.prospects.read("Spoke to Meera at Swisse, talk after the 16th", c), {}, {});
      const fid = await M.prospects.setFollow(c, {p: a.pid, pi: "", x: "chase Meera", d: M.when.ist.ymd(Date.now()), t: "", src: "remind"}); await new Promise(x => setTimeout(x, 600));
      /* the page as it is once the writes have landed: a context from before them holds the old index */
      const live = M.lastCtx;
      return {pid: a.pid, fid, search: M.search.hits(live, "meera", {names: {}}).filter(x => x.group === "prospects").map(x => [x.label, x.sub, x.hash]), inbox: M.inbox.items(live).filter(i => i.kind === "follow").map(i => i.id)}; }''')
    check(r['pid'] and r['search'] == [['Meera', 'Swisse, waiting', '#prospects/' + r['pid']]] or (r['search'] and r['search'][0][0] == 'Meera' and r['search'][0][2] == '#prospects/' + r['pid']), 'Durvesh finds Meera under Your people: %r' % r['search'])
    check(r['inbox'] and r['inbox'][0].startswith('fu:' + r['fid']), 'Durvesh sees his due follow-up in the inbox: %r' % r['inbox'])
    log = doc('log/%s/days/2026-10-05' % M1) or {}
    lines = [e for e in (log.get('e') or {}).values() if 'prospects' in str(e.get('p', ''))]
    check(lines and all(re.match(r'^[a-z, ]+$', str(e.get('s', ''))) and 'Meera' not in str(e.get('s', '')) for e in lines), 'the log lines show keys alone: %r' % [(e.get('p'), e.get('s')) for e in lines][:4])
    check(any(e.get('p') == 'data/users/u_m1/prospects' for e in lines) and any(e.get('p') == 'data/users/u_m1/prospects.2026-10' for e in lines), 'both documents are logged by path: %r' % sorted(set(e.get('p') for e in lines)))

    # ---- Kaavish's page sees none of it ----
    be('founder')
    k = p.evaluate('''async () => { const c = M.lastCtx;
      const own = M.prospects.data(c);
      const read = await c.db.doc("data/users/u_m1/prospects").get().then(s => s && s.exists ? "read" : "none", e => "refused");
      const month = await c.db.doc("data/users/u_m1/prospects.2026-10").get().then(s => s && s.exists ? "read" : "none", e => "refused");
      return {people: Object.keys(own.people).length, fu: Object.keys(own.fu).length, read, month, isOwner: c.isOwner,
        search: M.search.hits(c, "meera", {names: {}}).filter(x => x.group === "prospects").length, inbox: M.inbox.items(c).filter(i => i.kind === "follow").length,
        look: await M.brain.lookUp(c, {}, "prospects", "meera")}; }''')
    check(k['isOwner'] and k['people'] == 0 and k['fu'] == 0, 'the owner has no one in his own index: %r' % k)
    check(k['read'] in ('refused', 'none') and k['month'] in ('refused', 'none'), 'reading a member\'s documents gives nothing on the page: %r' % ((k['read'], k['month']),))
    check(k['search'] == 0 and k['inbox'] == 0 and 'Meera' not in k['look'], 'nothing of Durvesh\'s reaches search, the inbox or look_up: %r' % {x: k[x] for x in ('search', 'inbox')})
    flog = doc('log/%s/days/2026-10-05' % M1) or {}
    check(all('Meera' not in json.dumps(e) and 'Swisse' not in json.dumps(e) for e in (flog.get('e') or {}).values()), 'the log the founder reads carries no name from the private write')
    pv = p.evaluate('''async () => { M.viewAs.set("u_m1"); await new Promise(r => setTimeout(r, 600)); const c = M.lastCtx;
      const out = {data: c.priv.prospects.data, people: Object.keys(M.prospects.data(c).people).length, search: M.search.hits(c, "meera", {names: {}}).filter(x => x.group === "prospects").length, inbox: M.inbox.items(c).filter(i => i.kind === "follow").length};
      M.viewAs.set(null); await new Promise(r => setTimeout(r, 300)); return out; }''')
    check(pv['data'] is None and pv['people'] == 0 and pv['search'] == 0 and pv['inbox'] == 0, 'a preview of Durvesh shows nothing: %r' % pv)
    # the COO's state never carries the private index
    st = p.evaluate('() => { const s = JSON.stringify(M.coo.plan.stateOf(M.lastCtx, Date.now())); return {users: s.indexOf("data/users"), pros: s.indexOf("prospects"), keys: Object.keys(M.coo.plan.stateOf(M.lastCtx, Date.now()))}; }')
    check(st['users'] < 0 and st['pros'] < 0 and 'prospects' not in st['keys'], 'stateOf holds no data/users path and no prospects key: %r' % st['keys'])
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call')
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    return checks


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def site_part():
    from playwright.sync_api import sync_playwright
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    # the server's COO collection list: never data/users, never prospects
    src = open(os.path.join(ROOT, 'edgeone', 'server', 'coo.js'), encoding='utf-8').read()
    m = re.search(r"colls\(\[([^\]]+)\]\)", src[src.index('async function loadCtx'):])
    names = re.findall(r"'([^']+)'", m.group(1)) if m else []
    check(names and 'tasks' in names and not any(n.startswith('data') or 'prospects' in n for n in names), 'cooDesk reads an explicit list with no data/users and no prospects: %r' % names)

    build_edgeone.main()
    port = free_port()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    for _ in range(50):
        try:
            urllib.request.urlopen(base, timeout=1)
            break
        except Exception:
            time.sleep(0.1)

    def store_all():
        return json.loads(urllib.request.urlopen(base + '__store').read())

    today = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 19800))
    ym = today[:7]
    try:
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

            def device():
                ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
                pg = ctx.new_page()
                pg.set_default_timeout(15000)
                return pg

            f = device()
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'prospects-privacy-test-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            m = device()
            m.goto(base)
            m.wait_for_selector('text=Sign in to m360')
            muid = m.evaluate('() => window.M360_API("signup", {name: "Durvesh Patil", email: "durvesh@mask360.agency", password: "prospects-privacy-durvesh"}).then(r => r.uid)')
            f.evaluate('u => window.M360_API("write", {op: "update", path: "roster/team", data: {members: {[u]: {role: "member", empId: "M360-002", title: "Brand Strategist", pod: "", joined: "2026-01-05", start: "", probationEnd: "", active: true}}, updated: Date.now()}})', muid)
            m.reload()
            m.wait_for_selector('.sidebar', timeout=20000)
            ix = 'data/users/%s/prospects' % muid
            month = ix + '.' + ym
            api = lambda pg, a, body: pg.evaluate('([a, b]) => window.M360_API(a, b).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code}))', [a, body])  # noqa: E731

            # ---- the member writes the index and the month log on the flat paths ----
            w1 = api(m, 'write', {'op': 'set', 'path': ix, 'data': {'v': 1, 'people': {'pp1': {'cid': '', 'who': 'Meera', 'org': 'Swisse', 'pi': [], 'st': '', 'last': {'at': NOW, 'k': 'talk'}, 'mo': [ym], 'at': NOW, 'up': NOW}}, 'fu': {}, 'meet': {}, 'prefs': {'mirror': True}}})
            w2 = api(m, 'write', {'op': 'set', 'path': month, 'data': {'t': {'tt1': {'p': 'pp1', 'pi': '', 'k': 'talk', 'x': 'Spoke to Meera about the deck', 'at': NOW}}}})
            w3 = api(m, 'write', {'op': 'update', 'path': ix, 'data': {'prefs': {'mirror': False}}})
            w4 = api(m, 'write', {'op': 'set', 'path': 'data/users/%s/state' % muid, 'data': {'tab': 'home'}})
            # the agent's ledger and the buddy thread hold the typed line itself, so they close the same way
            w5 = api(m, 'write', {'op': 'set', 'path': 'data/users/%s/agent' % muid, 'data': {'runs': [{'id': 'r1', 'at': NOW, 'said': 'Spoke to Meera at Swisse, talk after the 16th', 'via': 'typed', 'acts': []}], 'at': NOW}})
            w6 = api(m, 'write', {'op': 'set', 'path': 'data/users/%s/chat' % muid, 'data': {'turns': [{'role': 'user', 'content': 'Spoke to Meera at Swisse, talk after the 16th', 'at': NOW}], 'at': NOW}})
            check(w1['ok'] and w2['ok'] and w3['ok'] and w4['ok'] and w5['ok'] and w6['ok'], 'the member writes the index, the month log (a four-segment path with a dot), a state doc, the ledger and the thread: %r' % [w1, w2, w3, w4, w5, w6])
            s = store_all()
            check(('d/' + ix.replace('/', '~')) in s and ('d/' + month.replace('/', '~')) in s, 'both documents sit in the store under their flat keys: %r' % [k for k in s if 'prospects' in k])
            # the page's copy arrives on one of its next sync rounds (the write above went straight to the API)
            got = None
            for _ in range(40):
                got = m.evaluate('p => M.lastCtx.db.doc(p).get().then(x => x && x.exists ? x.data() : null)', month)
                if got:
                    break
                m.wait_for_timeout(1000)
            check(got and got['t']['tt1']['x'] == 'Spoke to Meera about the deck', 'the member reads the month log back through the page: %r' % got)
            fw = api(f, 'write', {'op': 'update', 'path': ix, 'data': {'x': 1}})
            check(not fw['ok'] and fw['status'] == 403, 'the owner cannot write a member\'s index: %r' % fw)

            # ---- history and versions ----
            mh = api(m, 'history', {'path': ix})
            check(not mh['ok'] and mh['status'] == 403, 'history is an admin action, so the member is refused there (their page never needs it): %r' % mh)
            oh = api(f, 'history', {'path': ix})
            om = api(f, 'history', {'path': month})
            ov = api(f, 'version', {'path': ix, 'id': '1000000000000~' + muid})
            orv = api(f, 'revert', {'path': ix, 'id': '1000000000000~' + muid})
            check(all(not x['ok'] and x['status'] == 403 for x in (oh, om, ov, orv)), 'the owner is refused history, version and revert on a member\'s prospects: %r' % [oh, om, ov, orv])
            oa = api(f, 'history', {'path': 'data/users/%s/agent' % muid})
            oc = api(f, 'history', {'path': 'data/users/%s/chat' % muid})
            check(all(not x['ok'] and x['status'] == 403 for x in (oa, oc)), 'the owner is refused history on a member\'s agent ledger and buddy thread: %r' % [oa, oc])
            ost = api(f, 'history', {'path': 'data/users/%s/state' % muid})
            check(ost['ok'] and isinstance(ost['r'].get('versions'), list), 'the owner still reads history on the member\'s other private document: %r' % ost)
            own = api(f, 'history', {'path': 'data/users/%s/prospects' % f.evaluate('() => window.M360_API("me").then(x => x.uid)')})
            check(own['ok'], 'the owner reads history on his own prospects: %r' % own)

            # ---- backups: kept, never shown to anyone but their owner ----
            bk = api(f, 'backup', {'force': True})
            check(bk['ok'], 'the daily backup runs: %r' % bk)
            coll = 'data/users/' + muid
            blob = s = store_all()
            bkeys = [k for k in blob if k.startswith('bk/%s/' % today) and 'users' in k]
            kept = any('prospects' in blob[k] and '"agent"' in blob[k] and '"chat"' in blob[k] for k in bkeys)
            check(bkeys and kept, 'the backup blob keeps the prospects documents, the ledger and the thread: %r' % bkeys)
            one = api(f, 'backupget', {'ymd': today, 'coll': coll})
            check(one['ok'] and sorted(one['r']['docs']) == ['state'], 'a backup read by collection leaves the prospects out: %r' % sorted(one['r'].get('docs', {})) if one['ok'] else 'backupget by coll: %r' % one)
            day = api(f, 'backupget', {'ymd': today})
            cd = (day['r'].get('colls') or {}).get(coll, {}).get('docs', {}) if day['ok'] else None
            check(day['ok'] and cd is not None and sorted(cd) == ['state'], 'a backup read by day leaves the prospects out: %r' % (sorted(cd) if cd is not None else day))
            snap = api(f, 'snapshotall', {'coll': coll})
            check(snap['ok'] and sorted(snap['r']['docs']) == ['state'], 'a snapshot by collection leaves the prospects out: %r' % (sorted(snap['r'].get('docs', {})) if snap['ok'] else snap))
            whole = api(f, 'snapshotall', {})
            wd = (whole['r'].get('colls') or {}).get(coll, {}).get('docs', {}) if whole['ok'] else None
            # the member's documents and their words are out; a log line may still name the path it was written on
            blob = json.dumps(whole['r']) if whole['ok'] else ''
            check(whole['ok'] and wd is not None and sorted(wd) == ['state'] and 'Spoke to Meera' not in blob and '"prospects.%s"' % ym not in blob, 'the whole snapshot leaves the prospects out: %r' % (sorted(wd) if wd is not None else whole))

            # ---- the trash: a deleted month log never shows to the owner ----
            d = api(m, 'write', {'op': 'delete', 'path': month})
            check(d['ok'], 'the member deletes their month log: %r' % d)
            tr = api(f, 'trash', {})
            paths = [it['path'] for it in tr['r']['items']] if tr['ok'] else None
            check(tr['ok'] and month not in paths, 'the owner\'s trash hides it: %r' % paths)
            tkeys = [k for k in store_all() if k.startswith('t/') and 'prospects' in k]
            check(len(tkeys) == 1, 'the trash blob keeps it for a restore: %r' % tkeys)
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    return checks


if __name__ == '__main__':
    a = run(mock_part)
    b = site_part()
    print('test_prospects_privacy: %d checks passed (%d on the mock, %d on the team site)' % (len(a) + len(b), len(a), len(b)))
