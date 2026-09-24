#!/usr/bin/env python3
"""Client brain test (v7): logos, the company brain built from the site, news, meeting prep and health.

Part one runs the standalone page against the real function code on the local stand-in with the canned
site (edgeone/dev/fake-peek.mjs) and the fake model: the founder sets the seeded client's website, the auto
logo carries the favicon address, peek reads the site (title, description, text without scripts, the about
page) and caches it under n/peek/, private addresses are refused, a silent site times out, Build the brain
fills the fields from the model's JSON and stores brain with its sources, an edit saves, the news list shows
the Swisse story, meeting prep writes text, and health reads watch once a task is overdue.

Part two runs the claude.ai mock: a logo upload through the file input shows on the card, the brain says the
"no site read" line, completeness reads x of 8, a bad website is refused, and 390 px holds with the drawer open.

Run: cd m360-os && python3 harness/tests/test_brain.py
"""
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

CLIENT = 'swisse-wellness-uae'
SITE = 'https://swissewellness.example'
MODEL_LINE = 'From what m360 knows, no site read. Verify before you quote it.'


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def make_png(w=120, h=80):
    """A small RGB gradient PNG, built by hand so the test needs no image library."""
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes(((x * 255) // w, (y * 255) // h, 120))
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))


TINY_PNG = make_png(4, 4)


def route_favicons(context):
    """The sandbox has no web: answer the favicon service with a tiny PNG so the auto logo can load."""
    context.route('https://www.google.com/s2/favicons**', lambda r: r.fulfill(status=200, content_type='image/png', body=TINY_PNG))


def edge():
    """The standalone page against the real function code, the canned site and the fake model."""
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
            route_favicons(c)
            f = c.new_page()
            f.set_default_timeout(15000)
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

            # ---- first run: the founder, with a made-up password ----
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'brain-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            fuid = f.evaluate('() => window.M360_API("me").then(x => x.uid)')
            check(store_doc('d/clients~' + CLIENT) is not None, 'seed missing')

            # ---- the seeded client: initials first, then the website and the site's logo ----
            f.goto(base + '#clients/' + CLIENT)
            f.wait_for_selector('.drawer #client-name')
            check(f.locator('.drawer #client-logo [data-logo="initials"]').count() == 1, 'no initials logo before a website')
            check(f.inner_text('.drawer #client-logo [data-logo="initials"]').strip() == 'SW', 'initials %r' % f.inner_text('.drawer #client-logo [data-logo="initials"]'))
            f.fill('#client-website', SITE)
            f.get_by_role('button', name="Use the site's logo").click()
            f.wait_for_selector('.drawer #client-logo img[data-logo="auto"]')
            src = f.get_attribute('.drawer #client-logo img[data-logo="auto"]', 'src')
            check(src == 'https://www.google.com/s2/favicons?domain=swissewellness.example&sz=128', 'auto logo src %r' % src)
            f.fill('#client-industry', 'Wellness')
            f.fill('#client-instagram', '@swisseuae')
            f.locator('.drawer-foot').get_by_role('button', name='Save', exact=True).click()
            f.wait_for_function('() => !document.querySelector(".drawer")')
            doc = store_doc('d/clients~' + CLIENT)
            check(doc['website'] == SITE and doc['domain'] == 'swissewellness.example' and doc['useAutoLogo'] is True and doc['logo'] == '', 'client fields after save %r' % {k: doc.get(k) for k in ('website', 'domain', 'useAutoLogo', 'logo')})
            check(doc['industry'] == 'Wellness' and doc['socials'] == {'instagram': '@swisseuae', 'linkedin': '', 'youtube': ''}, 'industry and socials %r' % doc.get('socials'))
            f.wait_for_selector('[data-client="%s"] img[data-logo="auto"]' % CLIENT)
            card = f.inner_text('[data-client="%s"]' % CLIENT)
            check('3 of 8 fields' in card, 'card completeness (memory, website, industry): %r' % card)

            # ---- peek: the site as text, cached a day per domain ----
            pk = f.evaluate('() => window.M360_API("peek", {url: "%s"})' % SITE)
            check(pk.get('title') == 'Swisse Wellness UAE & Middle East', 'peek title %r' % pk.get('title'))
            check(pk.get('description', '').startswith('Premium collagen'), 'peek description %r' % pk.get('description'))
            txt = pk.get('text', '')
            check('collagen' in txt and 'Founded in Melbourne' in txt, 'peek text misses the homepage or the about page: %r' % txt[:200])
            check('SECRET_SCRIPT_TEXT' not in txt and '.hero' not in txt and '<' not in txt, 'peek text carries script, style or tags')
            check('–' not in txt and '—' not in txt and 'AED 150' in txt, 'entities not decoded or a dash survived')
            check(pk.get('links') == [SITE + '/about'], 'about links %r' % pk.get('links'))
            check(pk.get('sources') == [SITE, SITE + '/about'] and pk.get('fetchedAt', 0) > 0, 'peek sources %r' % pk.get('sources'))
            check(pk.get('url') == SITE and 'error' not in pk, 'peek url or error %r' % pk.get('url'))
            cached = store_doc('n/peek/swissewellness.example')
            check(cached and cached['title'] == pk['title'], 'peek not cached under n/peek/')
            pk2 = f.evaluate('() => window.M360_API("peek", {url: "swissewellness.example"})')
            check(pk2.get('cached') is True and pk2.get('fetchedAt') == pk['fetchedAt'], 'second peek did not come from the cache')

            # ---- private and non-http addresses are refused ----
            for u in ('http://192.168.1.5/', 'http://localhost/', 'http://10.0.0.1/', 'http://127.0.0.1:%d/' % port, 'http://169.254.169.254/latest',
                      'http://172.20.0.1/', 'http://172.16.0.1/', 'http://172.31.9.9/', 'ftp://swissewellness.example/', 'file:///etc/hosts', 'intranet', ''):
                r = f.evaluate('u => window.M360_API("peek", {url: u}).then(() => "ok", e => e.code + ":" + e.status)', u)
                check(r == 'invalid_argument:400', 'peek accepted %r: %r' % (u, r))
            check('n/peek/localhost' not in store_all() and not [k for k in store_all() if k.startswith('n/peek/192')], 'a refused address was cached')
            # a site that never answers is a timeout, never a cached entry
            slow = f.evaluate('() => window.M360_API("peek", {url: "https://slow.example/"}).then(() => "ok", e => e.code + ":" + e.status + ":" + e.message)')
            check(slow == 'site_unreachable:502:timeout', 'slow site %r' % slow)
            check('n/peek/slow.example' not in store_all(), 'a failed read was cached')

            # ---- Build the brain: the site text reaches the model, the answer lands in the fields and on the client ----
            f.goto(base + '#clients/' + CLIENT)
            f.wait_for_selector('.drawer #client-name')
            check(f.input_value('#brain-about') == '', 'brain field filled before a build')
            f.click('#brain-build')
            f.wait_for_function('() => /collagen/.test(document.querySelector("#brain-about").value)', timeout=20000)
            check('Women 25 to 45' in f.input_value('#brain-audience'), 'audience from the about page: %r' % f.input_value('#brain-audience'))
            check(f.input_value('#brain-pitchNext') == 'A creator led morning ritual series.', 'pitchNext %r' % f.input_value('#brain-pitchNext'))
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => JSON.parse(s["d/clients~%s"]).brain)' % CLIENT)
            brain = store_doc('d/clients~' + CLIENT)['brain']
            check(brain['sources'] == [SITE, SITE + '/about'], 'brain sources %r' % brain.get('sources'))
            check(brain['by'] == fuid and brain['at'] > 0 and 'collagen' in brain['about'], 'brain at, by, about %r' % {k: brain.get(k) for k in ('by', 'at', 'about')})
            check(all(isinstance(brain.get(k), str) and len(brain[k]) <= 400 for k in ('about', 'offers', 'audience', 'voice', 'competitors', 'moves', 'talking', 'risks', 'pitchNext')), 'brain field shapes')
            f.wait_for_selector('#brain-built')
            built = f.inner_text('#brain-built')
            check(built.startswith('Built') and 'Kaavish' in built, 'built line %r' % built)
            hrefs = f.evaluate('() => [...document.querySelectorAll("#client-brain .cl-src a")].map(a => a.href)')
            check(hrefs == [SITE + '/', SITE + '/about'] or hrefs == [SITE, SITE + '/about'], 'source links %r' % hrefs)
            check(f.locator('#brain-model-line').count() == 0, 'model line shown for a site-built brain')
            check(f.locator('#brain-build').inner_text().strip().endswith('Rebuild'), 'button did not turn into Rebuild')
            # an inline edit keeps the sources and the build stamp
            f.fill('#brain-risks', 'Never promise results.')
            f.click('#brain-save')
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => JSON.parse(s["d/clients~%s"]).brain.risks === "Never promise results.")' % CLIENT)
            brain2 = store_doc('d/clients~' + CLIENT)['brain']
            check(brain2['sources'] == brain['sources'] and brain2['at'] == brain['at'] and brain2['editedBy'] == fuid, 'edit changed the build stamp')

            # ---- In the news: the Radar item about Swisse, with a link and a time ----
            f.wait_for_selector('#client-news')
            news = f.inner_text('#client-news')
            check('Swisse launches a wellness campaign' in news and 'ago' in news, 'news list %r' % news[:200])
            check(f.get_attribute('#client-news a', 'href') == 'https://www.creativereview.co.uk/swisse-mumbai-creators/', 'news link')
            check(f.locator('#client-news a').count() <= 5, 'more than five stories')

            # ---- Meeting prep writes text that can be copied ----
            f.click('#prep-go')
            f.wait_for_selector('#client-prep .ai-out', timeout=20000)
            check(len(f.inner_text('#client-prep .ai-out').strip()) > 10, 'prep text empty')
            check(f.locator('#client-prep button:has-text("Copy the prep")').count() == 1, 'no copy button on the prep')

            # ---- health: on track with nothing overdue, watch once a task is overdue ----
            h0 = f.evaluate('() => M.clients.health(M.lastCtx, "%s")' % CLIENT)
            check(h0['level'] == 'ok' and 'no overdue tasks' in h0['why'], 'health before %r' % h0)
            f.evaluate('''() => M.lastCtx.W.set("tasks/tb1", {title: "Send the collagen scripts", owner: M.lastCtx.uid, client: "%s", project: "", section: "",
                due: "2026-01-05", status: "todo", priority: "normal", link: "", revisions: 0, shown20: false, subtasks: {}, comments: {},
                by: M.lastCtx.uid, created: Date.now(), updated: Date.now(), doneAt: null})''' % CLIENT)
            f.wait_for_function('() => M.clients.health(M.lastCtx, "%s").level === "watch"' % CLIENT)
            h1 = f.evaluate('() => M.clients.health(M.lastCtx, "%s")' % CLIENT)
            check('1 overdue task' in h1['why'], 'health why %r' % h1)
            f.wait_for_selector('#client-health[data-health="watch"]')
            check('Watch' in f.inner_text('#client-health') and 'overdue' in f.inner_text('#client-health'), 'health line %r' % f.inner_text('#client-health'))
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.wait_for_selector('[data-client="%s"] .pill[data-health="watch"]' % CLIENT)

            # ---- the phone: the drawer open at 390 with no sideways scroll ----
            m = c.new_page()
            m.set_viewport_size({'width': 390, 'height': 800})
            m.on('pageerror', lambda e: errors.append(str(e)))
            m.goto(base + '#clients/' + CLIENT)
            m.wait_for_selector('.drawer #client-name')
            ov = m.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, 'phone overflow %d' % ov)
            check(m.locator('#fold-client-brain').count() == 1, 'brain is not a fold on the phone')
            os.makedirs(os.path.join(ROOT, 'harness', 'shots'), exist_ok=True)
            m.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'brain-390.png'), full_page=False)
            f.goto(base + '#clients/' + CLIENT)
            f.wait_for_selector('#client-brain')
            f.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'brain-edge.png'), full_page=False)
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except OSError:
            pass
    bad = [e for e in errors if 'Failed to load resource' not in e]
    check(not bad, 'console errors: %r' % bad[:4])
    return fails


def mock(h):
    """The claude.ai build: upload, the model-only brain, completeness, validation and the phone."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    p = h.session('founder', width=1280, hash='#clients', reset=True, seed=True)
    route_favicons(p.context)
    seed(h, p)
    h.go(p, 'founder', hash='#clients', width=1280)
    p.wait_for_selector('[data-client="%s"]' % CLIENT)
    card = p.inner_text('[data-client="%s"]' % CLIENT)
    check('3 of 8 fields' in card, 'completeness before: %r' % card)
    check(p.locator('[data-client="%s"] .pill[data-health="watch"]' % CLIENT).count() == 1, 'seeded client (project at risk, overdue tasks) is not on watch')
    hw = h.ctx(p, 'M.clients.health(ctx, "%s")' % CLIENT)
    check(hw['level'] == 'watch' and 'overdue' in hw['why'] and 'at risk' in hw['why'], 'health %r' % hw)
    check(h.ctx(p, 'M.clients.completeness(ctx.coll.clients.map["%s"])' % CLIENT) == {'filled': 3, 'total': 8, 'missing': ['website', 'industry', 'brain.about', 'brain.audience', 'brain.voice']}, 'completeness shape')

    # ---- upload a logo through the file input; the card shows it after Save ----
    p.locator('[data-client="%s"]' % CLIENT).click()
    p.wait_for_selector('.drawer #client-name')
    p.set_input_files('#client-logo-file', {'name': 'logo.png', 'mimeType': 'image/png', 'buffer': make_png()})
    p.wait_for_function('() => ((document.querySelector("#client-logo img[data-logo=upload]") || {}).src || "").startsWith("data:image/")')
    src = p.get_attribute('#client-logo img[data-logo=upload]', 'src')
    check(len(src) < 40 * 1024, 'logo over 40 KB: %d' % len(src))
    check(p.locator('#client-logo img').evaluate('i => i.naturalWidth') in (0, 128), 'logo not 128 px')
    p.fill('#client-website', 'swisse.ae')
    p.fill('#client-industry', 'Wellness')
    p.fill('#client-hq', 'Dubai')
    p.fill('#client-since', '2024')
    p.fill('#client-tone', 'Warm, premium, never salesy')
    p.fill('#client-linkedin', 'swisse')
    p.locator('.drawer-foot').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_function('() => !document.querySelector(".drawer")')
    d = doc(p, 'clients/' + CLIENT)
    check(d['logo'].startswith('data:image/') and d['useAutoLogo'] is False, 'logo not stored %r' % d.get('useAutoLogo'))
    check(d['website'] == 'https://swisse.ae' and d['domain'] == 'swisse.ae' and d['industry'] == 'Wellness' and d['hq'] == 'Dubai' and d['since'] == '2024', 'new fields %r' % {k: d.get(k) for k in ('website', 'domain', 'industry', 'hq', 'since')})
    check(d['tone'] == 'Warm, premium, never salesy' and d['socials'] == {'instagram': '', 'linkedin': 'swisse', 'youtube': ''}, 'tone or socials %r' % d.get('socials'))
    check('name' in d and 'email' not in json.dumps(d), 'client document shape')
    p.wait_for_function('() => ((document.querySelector("[data-client=%s] img[data-logo=upload]") || {}).src || "").startsWith("data:image/")' % CLIENT)
    check('5 of 8 fields' in p.inner_text('[data-client="%s"]' % CLIENT), 'completeness after: %r' % p.inner_text('[data-client="%s"]' % CLIENT))

    # ---- the brain on this build: no site read, marked as the model's own ----
    p.locator('[data-client="%s"]' % CLIENT).click()
    p.wait_for_selector('.drawer #client-brain')
    check('No site read on this build' in p.inner_text('#client-brain'), 'hint before the build: %r' % p.inner_text('#client-brain')[:160])
    check(p.locator('#client-news').count() == 0, 'news shown on the claude.ai build')
    p.click('#brain-build')
    p.wait_for_selector('#brain-model-line')
    check(p.inner_text('#brain-model-line').strip() == MODEL_LINE, 'model line %r' % p.inner_text('#brain-model-line'))
    b = doc(p, 'clients/' + CLIENT)['brain']
    check(b['sources'] == ['model'] and b['by'] == 'u_founder' and b['at'] > 0, 'brain on the mock %r' % {k: b.get(k) for k in ('sources', 'by', 'at')})
    calls = p.evaluate('() => window.__sampleCalls.filter(c => c.kind === "json").map(c => c.text)')
    check(calls and 'NO SITE TEXT' in calls[-1] and 'Swisse Wellness UAE' in calls[-1] and 'Omar signs off' in calls[-1], 'brain prompt: %r' % (calls[-1][:200] if calls else None))
    check('Reads swisse.ae' not in p.inner_text('#client-brain'), 'standalone copy on the claude.ai build')
    # a by-hand edit saves
    p.fill('#brain-voice', 'Warm and plain.')
    p.click('#brain-save')
    p.wait_for_function('() => window.__db.get("clients/%s").brain.voice === "Warm and plain."' % CLIENT)
    check(doc(p, 'clients/' + CLIENT)['brain']['sources'] == ['model'], 'edit dropped the sources')
    # meeting prep on the mock: the prompt carries the projects, the people and the brain
    p.click('#prep-go')
    p.wait_for_selector('#client-prep .ai-out')
    texts = p.evaluate('() => window.__sampleCalls.filter(c => c.kind === "text").map(c => c.text)')
    prep = [t for t in texts if 'Prep me for a meeting' in t]
    check(prep and 'Swisse 30 reels' in prep[-1] and 'Write hero reel script' in prep[-1] and 'OVERDUE' in prep[-1] and 'Warm and plain.' in prep[-1], 'prep prompt: %r' % (prep[-1][:300] if prep else None))
    check(prep and 'Three Swisse scripts to Durvesh' in prep[-1], 'prep prompt lacks the EOD line mentioning the client')
    # a bad website never saves
    p.fill('#client-website', 'not a site')
    p.locator('.drawer-foot').get_by_role('button', name='Save', exact=True).click()
    p.wait_for_selector('text=Check the website')
    check(p.locator('.drawer').count() == 1, 'drawer closed on a bad website')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    check('6 of 8 fields' in p.inner_text('[data-client="%s"]' % CLIENT), 'completeness with the brain voice: %r' % p.inner_text('[data-client="%s"]' % CLIENT))

    # ---- the phone: no sideways scroll with the drawer open ----
    h.go(p, 'founder', hash='#clients/' + CLIENT, width=390)
    p.wait_for_selector('.drawer #client-name')
    ov = h.overflow(p)
    check(ov <= 0, 'phone overflow %d' % ov)
    check(p.locator('#fold-client-brain').count() == 1 and p.locator('#fold-client-prep').count() == 1, 'folds missing on the phone')
    check(not h.small_text(p), 'text under 11px: %r' % h.small_text(p))
    h.shot(p, 'brain-mock-390')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = edge()
    fails += run(mock)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
