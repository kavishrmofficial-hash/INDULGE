#!/usr/bin/env python3
"""Radar test: the news stream, awards season and watch channels against the local EdgeOne stand-in
(edgeone/dev/server.mjs with MOCK_AI=1, which answers every feed from edgeone/dev/fake-radar.mjs),
plus a short pass on the claude.ai build through the mock harness, where feeds cannot load.

Run: cd m360-os && python3 harness/tests/test_radar.py
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
    """The real page against the real function code and the canned feeds."""
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
            f = c.new_page()
            f.set_default_timeout(15000)
            f.on('pageerror', lambda e: errors.append(str(e)))
            f.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

            # ---- first run: the founder ----
            f.goto(base)
            f.wait_for_selector('text=Set up m360 OS')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', 'radar-test-pw-2026')
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            fuid = f.evaluate('() => window.M360_API("me").then(x => x.uid)')

            # ---- news: the canned items, newest first, the failing source named ----
            f.goto(base + '#radar')
            f.wait_for_selector('#radar-stream .rd-item')
            f.wait_for_selector('#radar-updated:has-text("updated")')
            titles = f.evaluate('() => [...document.querySelectorAll("#radar-stream .rd-title")].map(a => a.textContent)')
            check(len(titles) == 10, 'expected 10 canned stories, got %d' % len(titles))
            check(titles[0].startswith('Independent agency wins the Tata Neu'), 'newest first: %r' % titles[:2])
            check(any('Swisse' in t for t in titles), 'Swisse story missing')
            first = f.locator('#radar-stream .rd-item').first
            check(first.locator('a.rd-title').get_attribute('target') == '_blank' and 'noopener' in (first.locator('a.rd-title').get_attribute('rel') or ''), 'title link attrs')
            check('Campaign India' in first.inner_text(), 'Google News source pill missing: ' + first.inner_text()[:80])
            errline = f.inner_text('#radar-errors')
            check('Digiday' in errline and '1 source' in errline, 'errors line: ' + errline)
            check(f.locator('#radar-stream .rd-item.hot').count() == 0, 'hot before any keyword')
            blob = store_doc('n/news')
            check(blob and len(blob['items']) == 10 and blob['errors'] == [{'id': 'digiday', 'why': 'http 500'}], 'n/news blob %r' % (blob and blob.get('errors')))
            check(not [k for k in store_all() if k.startswith('d/n')], 'radar wrote under d/')

            # ---- filter chips and search ----
            f.locator('.rd-chips').get_by_role('button', name='Business').click()
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 6')
            f.locator('.rd-chips').get_by_role('button', name='Campaigns').click()
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 6')
            shown = f.evaluate('() => [...document.querySelectorAll("#radar-stream .rd-title")].map(a => a.textContent)')
            check(all('Tata' not in t for t in shown), 'Campaigns chip shows a Google News item: %r' % shown)
            f.locator('.rd-chips').get_by_role('button', name='All', exact=True).click()
            f.fill('#radar-search', 'swisse')
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 1')
            f.fill('#radar-search', '')
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 10')

            # ---- save toggles a bookmark in me/<uid> ----
            item = f.locator('#radar-stream .rd-item', has_text='Swisse')
            sid = item.get_attribute('data-id')
            item.get_by_role('button', name='Save').click()
            f.wait_for_function('() => document.querySelector(".rd-item[data-id=\\"%s\\"] .btn.sec")' % sid)
            me = store_doc('d/me~' + fuid)
            check(me and sid in me.get('saved', {}) and me['saved'][sid]['link'].startswith('https://www.creativereview.co.uk/swisse'), 'saved doc %r' % me)
            f.locator('.rd-chips').get_by_role('button', name='Saved').click()
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 1')
            f.locator('.rd-chips').get_by_role('button', name='All', exact=True).click()
            f.locator('#radar-stream .rd-item', has_text='Swisse').get_by_role('button', name='Saved').click()
            f.wait_for_function('u => fetch("/__store").then(r => r.json()).then(s => !Object.keys(JSON.parse(s["d/me~" + u]).saved || {}).length)', arg=fuid)

            # ---- share to Vibe makes a link post ----
            f.locator('#radar-stream .rd-item', has_text='Tata Neu').get_by_role('button', name='Share to Vibe').click()
            f.wait_for_function('u => fetch("/__store").then(r => r.json()).then(s => s["d/feed~" + u] && JSON.parse(s["d/feed~" + u]).posts[0].kind === "link")', arg=fuid)
            post = store_doc('d/feed~' + fuid)['posts'][0]
            check(post['link'] == 'https://news.google.com/rss/articles/CBMiTata' and 'Tata Neu' in post['text'], 'link post %r' % post)
            f.goto(base + '#feed')
            f.wait_for_selector('#feed-stream .card[data-kind="link"]')
            chip = f.locator('#feed-stream .card[data-kind="link"] a.linkchip')
            check(chip.get_attribute('href') == post['link'] and chip.get_attribute('target') == '_blank', 'link chip on the feed')

            # ---- the founder sets watch keywords in Admin; the Swisse story lights up ----
            f.goto(base + '#admin')
            f.wait_for_selector('#radar-settings')
            f.fill('#radar-keywords', 'Swisse, Tata Neu')
            f.locator('#radar-keywords-save').click()
            f.wait_for_function('() => fetch("/__store").then(r => r.json()).then(s => (JSON.parse(s["d/settings~app"]).radar || {}).keywords && JSON.parse(s["d/settings~app"]).radar.keywords.length === 2)')
            settings = store_doc('d/settings~app')
            check(settings['radar']['keywords'] == ['Swisse', 'Tata Neu'] and settings.get('start') == '10:30', 'keywords merge %r' % settings.get('radar'))
            f.goto(base + '#radar')
            f.wait_for_selector('#radar-stream .rd-item.hot')
            hot = f.evaluate('() => [...document.querySelectorAll("#radar-stream .rd-item.hot .rd-title")].map(a => a.textContent)')
            check(len(hot) == 2 and any('Swisse' in t for t in hot), 'hot items %r' % hot)
            check(f.locator('#radar-stream .rd-item.hot .pill.flame-o', has_text='Swisse').count() == 1, 'keyword pill')
            f.locator('.rd-chips').get_by_role('button', name='Watchlist hits').click()
            f.wait_for_function('() => document.querySelectorAll("#radar-stream .rd-item").length === 2')
            # the server marks them too, on the next call
            served = f.evaluate('() => window.M360_API("news").then(r => r.items.filter(i => i.hot).map(i => i.hits))')
            check(sorted(map(tuple, served)) == [('Swisse',), ('Tata Neu',)], 'server hits %r' % served)
            # a member may read, only the founder forces a refresh
            check(f.evaluate('() => window.M360_API("news", {force: true}).then(r => r.at)') >= blob['at'], 'force refresh')

            # ---- radar brief through the mock model ----
            f.locator('.rd-chips').get_by_role('button', name='All', exact=True).click()
            f.locator('#radar-brief').get_by_role('button', name='What moved this week').click()
            f.wait_for_selector('#radar-brief .ai-out')
            check(json.loads(f.evaluate('() => localStorage.getItem("m360.radar.brief")'))['date'], 'brief cached')
            f.locator('#radar-stream .rd-item').first.get_by_role('button', name='Why it matters').click()
            f.wait_for_selector('#radar-stream .rd-item .rd-why .ai-out')

            # ---- awards ----
            f.goto(base + '#awards')
            f.wait_for_selector('#awards-table')
            rows = f.locator('#awards-table tbody tr').count()
            check(rows == 14, 'awards rows %d' % rows)
            tbl = f.inner_text('#awards-table')
            check('Cannes Lions' in tbl and 'usually June' in tbl and 'canneslions.com' in tbl, 'awards table text')
            check('Typical timing' in f.inner_text('#awards-card'), 'awards caption')
            f.wait_for_selector('#awards-stream .rd-item')
            aw = f.evaluate('() => [...document.querySelectorAll("#awards-stream .rd-title")].map(a => a.textContent)')
            check(aw == ['Cannes Lions opens entries for 2027 with two new Lions'], 'awards stream %r' % aw)

            # ---- watch: the canned channel, two videos, the drawer, watch together ----
            f.goto(base + '#watch')
            f.wait_for_selector('.rd-ch[data-handle="CannesLions"] .rd-vid')
            ch = f.locator('.rd-ch[data-handle="CannesLions"]')
            check(ch.locator('.rd-vid').count() == 2, 'video count %d' % ch.locator('.rd-vid').count())
            check(f.locator('.rd-ch').count() == 13, 'channel cards %d' % f.locator('.rd-ch').count())
            thumb = ch.locator('.rd-vid img').first.get_attribute('src')
            check(thumb == 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'thumb %r' % thumb)
            ch.locator('.rd-vid').first.click()
            f.wait_for_selector('.drawer iframe')
            src = f.locator('.drawer iframe').get_attribute('src')
            check('youtube-nocookie.com/embed/dQw4w9WgXcQ' in src and 'autoplay=1' in src, 'iframe src %r' % src)
            check(f.locator('.drawer iframe').get_attribute('allow') and f.locator('.drawer iframe').get_attribute('title'), 'iframe attrs')
            check(f.locator('.drawer a', has_text='Open on YouTube').get_attribute('href') == 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube link')
            f.wait_for_function('u => fetch("/__store").then(r => r.json()).then(s => (JSON.parse(s["d/me~" + u]).watching || {}).ytId === "dQw4w9WgXcQ")', arg=fuid)
            f.keyboard.press('Escape')
            f.wait_for_function('() => !document.querySelector(".drawer")')
            f.wait_for_selector('#radar-watching:has-text("is watching Grand Prix winners 2026")')

            # the founder adds a channel by link and removes it again
            f.fill('#radar-channel', 'https://www.youtube.com/@Mask360/videos')
            f.locator('#radar-channel-go').click()
            f.wait_for_selector('.rd-ch[data-handle="Mask360"]', timeout=20000)
            settings = store_doc('d/settings~app')
            added = [x for x in settings['radar']['channels'] if x['handle'] == 'Mask360']
            check(added and added[0]['id'].startswith('UC') and len(added[0]['id']) == 24, 'added channel %r' % settings['radar'].get('channels'))
            check([k for k in store_all() if k.startswith('n/yt/mask360')], 'handle resolution not cached')
            f.locator('.rd-ch[data-handle="Mask360"]').get_by_role('button', name='Remove').click()
            f.locator('.rd-ch[data-handle="Mask360"]').get_by_role('button', name='Tap again to confirm').click()
            f.wait_for_selector('.rd-ch[data-handle="Mask360"]', state='detached')
            check(not [x for x in store_doc('d/settings~app')['radar']['channels'] if x['handle'] == 'Mask360'], 'channel not removed')

            # ---- phone: no overflow on any tab ----
            f.set_viewport_size({'width': 390, 'height': 800})
            for hsh in ('#radar', '#awards', '#watch'):
                f.goto(base + hsh)
                f.wait_for_selector('.topbar')
                f.wait_for_timeout(400)
                ov = f.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
                check(ov <= 0, 'phone overflow %d on %s' % (ov, hsh))
            os.makedirs(os.path.join(ROOT, 'harness', 'shots'), exist_ok=True)
            f.goto(base + '#radar')
            f.wait_for_selector('#radar-stream .rd-item')
            f.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'radar-390.png'), full_page=False)
            f.set_viewport_size({'width': 1280, 'height': 900})
            f.goto(base + '#watch')
            f.wait_for_selector('.rd-ch .rd-vid')
            f.screenshot(path=os.path.join(ROOT, 'harness', 'shots', 'radar-watch.png'), full_page=False)
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
    """The claude.ai build: no feeds, the directories and the awards table instead."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    p = h.session('founder', width=1280, hash='#radar', reset=True, seed=True)
    h.roster(p)
    h.go(p, 'founder', hash='#radar', width=1280)
    p.wait_for_selector('#radar-off')
    check('Live feeds run on your EdgeOne address' in p.inner_text('#radar-off'), 'fallback card copy')
    check(p.locator('#radar-sources .listrow').count() == 25, 'source directory %d' % p.locator('#radar-sources .listrow').count())
    p.locator('.rd-chips').get_by_role('button', name='Awards').click()
    p.wait_for_function('() => document.querySelectorAll("#radar-sources .listrow").length === 6')
    h.go(p, 'founder', hash='#awards', width=1280)
    p.wait_for_selector('#awards-table')
    check(p.locator('#awards-table tbody tr').count() == 14, 'awards table on the claude build')
    h.go(p, 'm1', hash='#watch', width=390)
    p.wait_for_selector('#radar-off')
    check(p.locator('.rd-ch').count() == 13, 'channel directory')
    check(p.locator('#radar-channel-go').inner_text().strip() == 'Suggest a channel', 'member sees Suggest')
    p.fill('#radar-channel', '@LBBOnline')
    p.locator('#radar-channel-go').click()
    p.wait_for_function('() => (window.__db.get("feed/u_m1") || {posts: []}).posts.some(x => x.kind === "link" && x.link === "https://www.youtube.com/@LBBOnline")')
    check(h.overflow(p) <= 0, 'phone overflow on watch')
    h.go(p, 'founder', hash='#admin', width=1280)
    p.wait_for_selector('#radar-settings')
    p.fill('#radar-keywords', 'Swisse')
    p.locator('#radar-keywords-save').click()
    p.wait_for_function('() => ((window.__db.get("settings/app") || {}).radar || {}).keywords')
    check(p.evaluate('window.__db.get("settings/app").radar.keywords') == ['Swisse'], 'keywords on the claude build')
    p.fill('#radar-add-channel', 'youtube.com/@Mask360')
    p.get_by_role('button', name='Add channel').click()
    p.wait_for_function('() => (((window.__db.get("settings/app") || {}).radar || {}).channels || []).some(c => c.handle === "Mask360")')
    p.locator('#radar-channel-list').get_by_role('button', name='Remove CannesLions').click()
    p.wait_for_function('() => (((window.__db.get("settings/app") || {}).radar || {}).dropped || []).includes("CannesLions")')
    check(p.locator('#radar-channel-list .chipline').count() == 13, 'channel list after add and drop: %d' % p.locator('#radar-channel-list .chipline').count())
    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'mock console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = edge()
    fails += run(mock)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
