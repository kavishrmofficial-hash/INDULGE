#!/usr/bin/env python3
"""Chat: rooms and direct messages on the mock (two people, one page each), the unread badge, the inbox,
mentions, edit and delete, a new room, attachments (a picture inline, a document as a card) and the
notices a line for you raises anywhere in m360, with previews on and off; then on the EdgeOne stand-in,
a direct message never reaches a third person, even in a snapshot, and neither does a file sent in one.

Run: cd m360-os && python3 harness/tests/test_chat.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402
import build_edgeone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# a 1 by 1 png
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0006010201e2cb46390000000049454e44ae426082')


def mock_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    k = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, k)
    h.roster(k, ('u_m1', 'u_m2'))
    # Kaavish opens Chat, general is there, sends a line
    h.go(k, 'founder', hash='#chat', width=1280)
    k.wait_for_selector('#chat-input')
    check('#general' in k.inner_text('#chat-title'), 'general should open first')
    k.fill('#chat-input', 'Morning team, shoot is Tuesday.'); k.keyboard.press('Enter')
    k.wait_for_selector('.chat-msg:has-text("shoot is Tuesday")')
    check(k.input_value('#chat-input') == '', 'the box clears after sending')
    # Durvesh, on another page in the same store, sees it and the badge
    def same(ident, hash, width=1280):
        pg = k.context.new_page(); pg.set_default_timeout(8000)
        pg.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
        pg.set_viewport_size({'width': width, 'height': 900}); pg.goto(h.url(ident, hash)); h.ready(pg)
        return pg
    d = same('m1', '#home')
    d.wait_for_selector('.sidebar')
    d.wait_for_function('() => (M.badges(M.lastCtx).chat || 0) >= 1', timeout=8000)
    h.go(d, 'm1', hash='#chat', width=1280)
    d.wait_for_selector('.chat-msg:has-text("shoot is Tuesday")')
    d.wait_for_function('() => (M.badges(M.lastCtx).chat || 0) === 0', timeout=8000)
    # a mention lands in Kaavish's inbox; @everyone lights up
    d.fill('#chat-input', '@Kaavish Ramchandani can we push it to Wednesday? @everyone note'); d.keyboard.press('Enter')
    d.wait_for_selector('.chat-msg:has-text("push it to Wednesday")')
    check(d.locator('.chat-msg .mention').count() >= 1, 'mentions should light up')
    k.wait_for_function('() => (M.badges(M.lastCtx).chat || 0) >= 1', timeout=8000)
    check(k.locator('.chat-msg.hot:has-text("push it to Wednesday")').count() == 1, 'a line that names you is marked')
    h.go(k, 'founder', hash='#home', width=1280)
    k.wait_for_selector('.bellbtn')
    inbox = k.evaluate('() => (M.inbox && M.inbox.items) ? M.inbox.items(M.lastCtx).filter(i => i.kind === "chat").length : -1')
    check(inbox >= 1, 'the mention should be in the inbox, got %r' % inbox)
    # a direct message: only visible to the two of them (client side on the mock)
    h.go(k, 'founder', hash='#chat', width=1280)
    k.wait_for_selector('#chat-list')
    k.locator('#chat-list .chat-room', has_text='Durvesh').click()
    k.wait_for_function('() => location.hash.startsWith("#chat/dm.")')
    k.fill('#chat-input', 'Just us: rate card goes up 10 percent.'); k.keyboard.press('Enter')
    k.wait_for_selector('.chat-msg:has-text("Just us")')
    d.wait_for_function('() => (M.badges(M.lastCtx).chat || 0) >= 1', timeout=8000)
    h.go(d, 'm1', hash=k.evaluate('() => location.hash'), width=1280)
    d.wait_for_selector('.chat-msg:has-text("Just us")')
    check('only the two of you' in d.inner_text('#chat-pane') or 'online' in d.inner_text('#chat-pane'), 'dm header copy')
    # a third person never sees the dm room in their list
    t = same('m2', '#chat')
    t.wait_for_selector('#chat-list')
    check('Just us' not in t.inner_text('#chat'), 'a third person must not see a dm')
    # edit and delete your own line
    k.locator('.chat-msg:has-text("Just us") .linky', has_text='Edit').click()
    k.fill('#chat-input', 'Just us: rate card goes up 12 percent.'); k.keyboard.press('Enter')
    k.wait_for_selector('.chat-msg:has-text("12 percent")')
    check(k.locator('.chat-msg:has-text("(edited)")').count() == 1, 'edited mark')
    k.locator('.chat-msg:has-text("12 percent") .linky', has_text='Delete').click()
    k.wait_for_function('() => !document.querySelector(".chat-msg")')
    # attachments: a picture shows inline, a document becomes a card with a download; Durvesh sees both
    check(k.locator('#chat-attach-btn').count() == 1, 'an attach button')
    k.set_input_files('#chat-file', [{'name': 'brief.png', 'mimeType': 'image/png', 'buffer': PNG}, {'name': 'rate-card.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 rate card'}])
    k.wait_for_selector('#chat-attach .chip:has-text("brief.png")')
    check(k.locator('#chat-attach .chip').count() == 2, 'two files waiting to go')
    check(k.locator('#chat-send').is_enabled(), 'send is possible with files and no text')
    k.locator('#chat-send').click()
    k.wait_for_selector('.chat-msg .chat-img')
    check(k.locator('.chat-msg .chat-file:has-text("rate-card.pdf")').count() == 1, 'a document becomes a card')
    check('Download' in k.inner_text('.chat-msg .chat-file'), 'the card offers a download')
    check(k.locator('#chat-attach').count() == 0, 'the waiting list clears after sending')
    d.wait_for_selector('.chat-msg .chat-img', timeout=8000)
    check(d.locator('.chat-file:has-text("rate-card.pdf")').count() == 1, 'the other person gets the card too')
    # a file over the limit never goes up
    k.evaluate('() => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(25 * 1024 * 1024 + 10)], "huge.bin", {type: "application/octet-stream"})); const inp = document.querySelector("#chat-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", {bubbles: true})); }')
    k.wait_for_selector('.toast:has-text("over 25 MB")')
    check(k.locator('#chat-attach').count() == 0, 'a file over the limit is refused')
    # notices: Durvesh is on Home; a direct message for him shows top right, with the line
    h.go(d, 'm1', hash='#home', width=1280)
    d.wait_for_selector('.sidebar')
    k.fill('#chat-input', 'Ping: the deck is ready'); k.keyboard.press('Enter')
    d.wait_for_selector('#notices .notice:has-text("deck is ready")', timeout=8000)
    nt = d.locator('#notices .notice:has-text("deck is ready")').inner_text()
    check('Kaavish' in nt and 'deck is ready' in nt, 'the notice names the sender and shows the line, got %r' % nt)
    # previews off: who, not what
    d.evaluate('() => M.notices.setPreviews(false)')
    k.fill('#chat-input', 'Second ping with the rate'); k.keyboard.press('Enter')
    d.wait_for_selector('#notices .notice:has-text("New message")', timeout=8000)
    nt2 = d.locator('#notices .notice:has-text("New message")').last.inner_text()
    check('Second ping' not in nt2 and 'Kaavish' in nt2, 'with previews off the line must stay hidden, got %r' % nt2)
    d.evaluate('() => M.notices.setPreviews(true)')
    # a tap on the notice opens the room
    d.locator('#notices .notice:has-text("New message") .notice-body').last.click()
    d.wait_for_function('() => location.hash.startsWith("#chat/dm.")')
    d.wait_for_selector('.chat-msg:has-text("Second ping")')
    # a general line does not raise a notice unless asked for; a mention always does
    h.go(d, 'm1', hash='#home', width=1280)
    d.wait_for_selector('.sidebar')
    h.go(k, 'founder', hash='#chat/general', width=1280)
    k.wait_for_selector('#chat-input')
    k.fill('#chat-input', 'Lunch is at one'); k.keyboard.press('Enter')
    k.wait_for_selector('.chat-msg:has-text("Lunch is at one")')
    k.fill('#chat-input', '@Durvesh Patil your turn on the deck'); k.keyboard.press('Enter')
    d.wait_for_selector('#notices .notice:has-text("your turn")', timeout=8000)
    check(d.locator('#notices .notice:has-text("Lunch")').count() == 0, 'a plain room line raises no notice by default')
    d.evaluate('() => M.prefs.set("noticeAll", "1")')
    k.fill('#chat-input', 'Coffee is here'); k.keyboard.press('Enter')
    d.wait_for_selector('#notices .notice:has-text("Coffee")', timeout=8000)
    check('in #general' in d.inner_text('#notices .notice:has-text("Coffee")'), 'a room notice names the room')
    d.evaluate('() => M.prefs.set("noticeAll", "0")')
    h.go(k, 'founder', hash='#chat/' + k.evaluate('() => M.rooms.dmId(M.lastCtx.uid, "u_m1")'), width=1280)
    k.wait_for_selector('#chat-input')
    h.go(d, 'm1', hash='#chat', width=1280)
    d.wait_for_selector('#chat-list')
    # a new room
    k.locator('#chat-new-room').click(); k.fill('#chat-room-name', 'Swisse squad'); k.keyboard.press('Enter')
    k.wait_for_function('() => location.hash === "#chat/swisse-squad"')
    check('#Swisse squad' in k.inner_text('#chat-title'), 'room title')
    d.wait_for_selector('#chat-list .chat-room:has-text("Swisse squad")', timeout=8000)
    # phone: list then pane
    h.go(d, 'm1', hash='#chat', width=390)
    d.wait_for_selector('#chat-list')
    d.locator('#chat-list .chat-room', has_text='general').click()
    d.wait_for_selector('#chat-input')
    check(d.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, 'no sideways scroll on the phone')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e) and 'Notification' not in str(e)]
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
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
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
            k = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); k.set_default_timeout(20000)
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'chat-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(400)
            api = lambda pg, a, body=None: pg.evaluate('([a, b]) => window.M360_API(a, b || {}).then(r => ({ok: true, r}), e => ({ok: false, status: e.status, code: e.code}))', [a, body or {}])

            def join(email, name, pw):
                inv = api(k, 'invite', {'email': email, 'name': name})
                p = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); p.set_default_timeout(20000)
                p.goto(inv['r']['link']); p.wait_for_selector("text=You're invited")
                p.fill('#signin-email', email); p.fill('#signin-pw', pw); p.locator('#invite-go').click(); p.wait_for_selector('.sidebar'); p.wait_for_timeout(300)
                return p
            d = join('durvesh@mask360.agency', 'Durvesh Patil', 'chat-test-pw-durvesh')
            t = join('shreya@mask360.agency', 'Shreya Iyer', 'chat-test-pw-shreya')
            kuid = api(k, 'me')['r']['uid']; duid = api(d, 'me')['r']['uid']
            room = 'dm.' + '.'.join(sorted([kuid, duid]))
            k.evaluate('([room]) => M.rooms.send(M.lastCtx, room, "Just us on the server", [])', [room])
            d.wait_for_function('([room]) => M.rooms.messagesOf(M.lastCtx, room).some(m => m.text.includes("Just us on the server"))', arg=[room], timeout=15000)
            t.wait_for_timeout(4000)
            snap = api(t, 'snapshot')['r']
            check('Just us on the server' not in json.dumps(snap), 'a third person must never receive a dm, not even in a snapshot')
            # nor can they write into it
            w = t.evaluate('([room, uid]) => window.M360_API("write", {op: "set", path: "chat/" + room + ":" + uid, data: {msgs: [{id: "x", at: Date.now(), text: "sneak"}]}}).then(() => "ok", e => e.status)', [room, api(t, 'me')['r']['uid']])
            check(w == 403, 'a third person must not write into a dm, got %r' % w)
            # but general reaches everyone
            k.evaluate('() => M.rooms.send(M.lastCtx, "general", "Hello all", [])')
            t.wait_for_function('() => M.rooms.messagesOf(M.lastCtx, "general").some(m => m.text === "Hello all")', timeout=15000)
            # a file in the dm goes up in parts; the two of them get the bytes back, the third gets nothing
            up = k.evaluate('''async ([room]) => {
              const bytes = new Uint8Array(1500 * 1024); for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) % 251;
              const f = new File([bytes], 'cut.bin', {type: 'application/octet-stream'});
              const steps = []; const r = await M.files.upload(f, room, (p, t) => steps.push(p + '/' + t));
              const got = await fetch(r.url); const buf = new Uint8Array(await got.arrayBuffer());
              let same = buf.length === bytes.length; for (let i = 0; same && i < buf.length; i += 997) same = buf[i] === bytes[i];
              return {id: r.id, url: r.url, size: r.size, steps, status: got.status, type: got.headers.get('content-type'), disp: got.headers.get('content-disposition'), same, len: buf.length};
            }''', [room])
            check(up['steps'] == ['0/3', '1/3', '2/3'] and up['same'] and up['status'] == 200, 'a 1.5 MB file goes up in three parts and comes back whole, got %r' % {k2: up[k2] for k2 in ('steps', 'status', 'same', 'len')})
            check('attachment' in (up['disp'] or ''), 'a binary comes back as a download, got %r' % up['disp'])
            fid = up['id']
            r_d = d.evaluate('u => fetch(u).then(r => r.status)', up['url'])
            r_t = t.evaluate('u => fetch(u).then(r => r.status)', up['url'])
            check(r_d == 200 and r_t == 404, 'the other half of the dm reads the file, a third person gets nothing, got %r %r' % (r_d, r_t))
            meta_t = t.evaluate('id => window.M360_API("filemeta", {id}).then(() => "seen", e => e.status)', fid)
            check(meta_t == 404, 'a third person cannot even see the record, got %r' % meta_t)
            # a picture in general shows inline to everyone, with its own type
            pic = k.evaluate('''async () => {
              const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAGAQIB4stGOQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
              const r = await M.files.upload(new File([png], 'dot.png', {type: 'image/png'}), 'general');
              await M.rooms.send(M.lastCtx, 'general', '', [], [r]);
              return r;
            }''')
            got = t.evaluate('u => fetch(u).then(r => ({status: r.status, type: r.headers.get("content-type"), disp: r.headers.get("content-disposition")}))', pic['url'])
            check(got['status'] == 200 and got['type'] == 'image/png' and 'inline' in (got['disp'] or ''), 'a picture in general is served inline to everyone, got %r' % got)
            t.wait_for_function('() => M.rooms.messagesOf(M.lastCtx, "general").some(m => (m.files || []).some(f => f.name === "dot.png"))', timeout=15000)
            # the uploader can take it down; a stranger to the file cannot
            dd = d.evaluate('id => window.M360_API("filedel", {id}).then(() => "gone", e => e.status)', pic['id'])
            check(dd == 403, 'only the uploader or an admin removes a file, got %r' % dd)
            kd = k.evaluate('id => window.M360_API("filedel", {id}).then(() => "gone", e => e.status)', pic['id'])
            after = t.evaluate('u => fetch(u, {cache: "no-store"}).then(r => r.status)', pic['url'])
            check(kd == 'gone' and after == 404, 'after removal the file is gone, got %r %r' % (kd, after))
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except Exception:
            pass
    return fails


if __name__ == '__main__':
    fails = run(mock_part)
    fails += standalone_part()
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
