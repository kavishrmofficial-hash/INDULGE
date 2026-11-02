#!/usr/bin/env python3
"""v36.1 test: the AI says what is wrong, and recovers by itself where it safely can.

Kaavish said "AI stopped working" and the page only ever said "Something glitched". On the team site the server
now names every failure (edgeone/server/aicall.js) and the page words it (04-ai.js). Everything here runs on the
real server code through the local stand-in (edgeone/dev/server.mjs) with the canned model failing on purpose
(GET /__aifail), so no real key is needed:

- every failure end to end: credit, key, model, busy, unreachable and slow come back as ai_credit, ai_key,
  ai_model, ai_busy and ai_unreachable (HTTP 424), the owner's error carries the cleaned reason with no model
  name in it, a member's carries the code alone, and no failed turn counts against the daily cap;
- the recoveries: a model the account cannot reach is tried once on the tier's fallback, a refused beta is
  tried once without the beta and without fallbacks, an overloaded API is tried once after about 1.5 s; each
  answers on the second call, never makes a third, and counts once;
- the page: Ask m360 in the dock shows the house copy and the offline chips for each code, Kaavish also reads
  "Anthropic said: ..." on its own line, a member never does;
- a bad request is asked once and never again, even one whose message names a beta header; a refusal counts (the
  model answered) and its explanation reaches Kaavish and admins only; the platform's bare 504 on a model call
  reads as ai_unreachable;
- aicheck: both tiers reported for the owner (and an admin), whether a key is set and where it lives, never the
  key or a model name in the answer or the log; refused for a member and for nobody signed in;
- Admin > m360 AI > Check the AI at 1280 and 390, light and dark, readable;
- on a claude.ai page (the harness stand-in), a sample error keeps its code and the owner reads the cleaned
  message, a member does not; Check the AI there makes one tiny call.

Screenshots go to $V361_SHOTS (default harness/shots/v361).
The key the stand-in server holds and every sign-in in this file are made up for the test.

Run: cd m360-os && python3 harness/tests/test_ai_health.py
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402

SHOTS = os.environ.get('V361_SHOTS') or os.path.join(ROOT, 'harness', 'shots', 'v361')
COPY = {
    'ai_key': 'The AI key was refused. Kaavish can paste a new one in Admin under AI.',
    'ai_credit': 'The AI account is out of credit. Once credit is added in the Anthropic console it works again at once.',
    'ai_model': 'The AI could not reach the model it uses, or its backup. Kaavish can run Check the AI in Admin under AI.',
    'ai_busy': 'The AI is overloaded right now. Give it a minute and try again.',
    'ai_unreachable': 'The AI did not answer in time. Try again in a moment, or ask something shorter.',
}
BUDGET_S = 6
# mode on the canned model, the code the page gets, what the owner reads after "Anthropic said: "
CASES = [
    ('credit', 'ai_credit', 'Your credit balance is too low to access the Anthropic API'),
    ('key', 'ai_key', 'invalid x-api-key'),
    ('model', 'ai_model', 'model: the model'),
    ('busy', 'ai_busy', 'Overloaded'),
    ('unreachable', 'ai_unreachable', 'nothing, the call did not get through (fetch failed)'),
    ('slow', 'ai_unreachable', 'nothing, no answer came back within %d seconds' % BUDGET_S),
]
# the calls each failing turn makes: a refused key, no credit or no line are asked once; a missing model once more
# on the backup, an overloaded API once more after the wait; never a third
CALLS = {'credit': 1, 'key': 1, 'model': 2, 'busy': 2, 'unreachable': 1, 'slow': 1}
QUESTION = 'Write two lines about Monday mornings at the studio'
# made up for the test, like every sign-in here
PW = {'k': 'health-lamp-4471', 'd': 'health-desk-5582', 'a': 'health-reel-6693'}

# a readable pair: the text's colour over the box it sits in, alpha blended, as a WCAG contrast ratio
CONTRAST = '''([sel, boxSel]) => {
  const el = document.querySelector(sel), box = document.querySelector(boxSel);
  if (!el || !box) return 0;
  const rgb = s => (s.match(/[\\d.]+/g) || []).map(Number);
  const bgOf = n => { while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c.slice(0, 3); n = n.parentElement; } return [255, 255, 255]; };
  const bg = bgOf(box), fg = rgb(getComputedStyle(el).color), a = fg[3] === undefined ? 1 : fg[3];
  const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
  const lum = c => { const l = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  const L1 = lum(mix), L2 = lum(bg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}'''


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def site_part(check):
    build_edgeone.main()
    port = free_port()
    store = tempfile.mktemp(suffix='.json')
    env = dict(os.environ, MOCK_AI='1', AI_BUDGET_MS=str(BUDGET_S * 1000))
    env.pop('MOCK_AI_FAIL', None)
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    errors = []

    def get(path):
        return json.loads(urllib.request.urlopen(base + path, timeout=60).read())

    def fail(mode, n=0):
        get('__aifail?mode=%s&n=%d' % (mode, n))

    def calls():
        """the model calls the page's AI made (the COO's own calls carry a system prompt; these test turns do not)"""
        return [c for c in get('__ai') if not c.get('system')]

    def used(uid):
        """this person's AI turns counted today (n/ai/<ymd>/<uid>), however the day reads"""
        data = get('__store')
        keys = [k for k in data if k.startswith('n/ai/') and k.endswith('/' + uid)]
        return sum(json.loads(data[k]).get('n', 0) for k in keys)

    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

            def device(width=1280):
                c = browser.new_context(viewport={'width': width, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
                c.add_init_script('window.M360_WELCOME_OFF = true; window.M360_MONEY_LOCK_OFF = true')
                pg = c.new_page()
                pg.set_default_timeout(30000)
                pg.on('pageerror', lambda e: errors.append(str(e)))
                # a 4xx is an answer the page words; the 504s are the bare platform timeouts this test fakes on purpose
                pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text and 'status of 4' not in m.text
                      and 'status of 504' not in m.text else None)
                return c, pg

            # ---- Kaavish sets the workspace up; a member and an admin join it ----
            fc, f = device()
            f.goto(base)
            f.wait_for_selector('#signin-name')
            f.fill('#signin-name', 'Kaavish Ramchandani')
            f.fill('#signin-email', 'kaavish@mask360.agency')
            f.fill('#signin-pw', PW['k'])
            f.get_by_role('button', name='Set up the workspace').click()
            f.wait_for_selector('.sidebar')
            f.wait_for_function('() => !!(window.M && M.lastCtx && M.lastCtx.W)')
            fuid = f.evaluate('() => M.lastCtx.uid')

            def join(name, email, pw_, role, title, emp):
                c, p = device()
                p.goto(base)
                p.wait_for_selector('#signin-pw')
                uid = p.evaluate('([n, e, w]) => window.M360_API("signup", {name: n, email: e, password: w}).then(r => r.uid)', [name, email, pw_])
                f.evaluate('''([u, role, title, emp]) => M.lastCtx.W.merge("roster/team", {members: {[u]: {role, empId: emp, title, pod: "Pod 1",
                  joined: "2026-01-05", start: "", probationEnd: "", active: true}}, updated: Date.now()})''', [uid, role, title, emp])
                p.reload()
                p.wait_for_function('u => !!(window.M && M.lastCtx && M.lastCtx.uid === u && M.lastCtx.member)', arg=uid)
                # the shell sends a page opened with no route to Home (HQ for an admin) once it has drawn
                p.wait_for_function('() => location.hash.length > 1 && !!document.querySelector("main")')
                return c, p, uid
            mc, m, muid = join('Durvesh Patil', 'durvesh@mask360.agency', PW['d'], 'member', 'Brand Strategist', 'M360-002')
            ac, a, auid = join('Aanya Mehta', 'aanya@mask360.agency', PW['a'], 'founder', 'Partner', 'M360-003')
            check(f.evaluate('() => M.lastCtx.isFounder') and not m.evaluate('() => M.lastCtx.isFounder') and a.evaluate('() => M.lastCtx.isFounder'),
                  'the team: Kaavish owns it, Durvesh is a member, Aanya an admin')

            ask = '''async ([tier]) => { try { const r = await window.M360_API("ai", {tier, messages: [{role: "user", content: "hello there"}]});
                return {ok: true, text: (r.content || []).map(c => c.text || "").join("")}; }
              catch (e) { return {ok: false, code: e.code, message: e.message, status: e.status}; } }'''

            # ---- every failure, named, end to end through the server ----
            for mode, code, said in CASES:
                fail(mode)
                f0, m0 = used(fuid), used(muid)
                get('__ai?clear=1')
                rf = f.evaluate(ask, ['default'])
                nf = len(calls())
                get('__ai?clear=1')
                rm = m.evaluate(ask, ['default'])
                nm = len(calls())
                check(not rf['ok'] and rf['code'] == code and rf['status'] == 424, '%s: the owner gets %s (424): %r' % (mode, code, rf))
                check(said in (rf.get('message') or '') and 'claude-' not in (rf.get('message') or '') and 'sk-ant' not in (rf.get('message') or ''),
                      '%s: the owner\'s reason is cleaned, with no model name or key: %r' % (mode, rf.get('message')))
                check(not rm['ok'] and rm['code'] == code and rm.get('message') in ('', code), '%s: a member gets %s and no reason: %r' % (mode, code, rm))
                check(nf == CALLS[mode] and nm == CALLS[mode], '%s: %d call(s) a turn, never more (%d, %d)' % (mode, CALLS[mode], nf, nm))
                check(used(fuid) == f0 and used(muid) == m0, '%s: a failed turn does not count against the cap' % mode)
            fail('off')
            # a bad request is asked once, never again, even one whose message names a beta header (a thinking block
            # bound to another conversation does); the owner reads why, a member does not, and it does not count
            for mode, said in (('bad', 'roles must alternate'), ('signature', 'Invalid `signature` in `thinking` block')):
                fail(mode)
                f0, m0 = used(fuid), used(muid)
                get('__ai?clear=1')
                rf = f.evaluate(ask, ['default'])
                cs = calls()
                rm = m.evaluate(ask, ['default'])
                check(not rf['ok'] and rf['code'] == 'unavailable' and rf['status'] == 424 and said in (rf.get('message') or ''),
                      '%s: the owner gets unavailable with the reason: %r' % (mode, rf))
                check(len(cs) == 1 and cs[0]['fallbacks'] == 'default' and cs[0]['beta'], '%s: one call, the request kept as it was: %r' % (mode, [(c['model'], c['beta'], c['fallbacks']) for c in cs]))
                check(not rm['ok'] and rm['code'] == 'unavailable' and rm.get('message') in ('', 'unavailable'), '%s: a member gets the code alone: %r' % (mode, rm))
                check(used(fuid) == f0 and used(muid) == m0, '%s: a bad request does not count against the cap' % mode)
            fail('off')
            # a refusal: the model answered, so it counts; the explanation is Kaavish's and an admin's, cleaned of the model's name
            fail('refusal')
            f0, m0 = used(fuid), used(muid)
            get('__ai?clear=1')
            rf = f.evaluate(ask, ['default'])
            ra = a.evaluate(ask, ['default'])
            rm = m.evaluate(ask, ['default'])
            fail('off')
            check(not rf['ok'] and rf['code'] == 'refused' and rf.get('message') == 'the model declined this one.' and len(calls()) == 3,
                  'a refusal reaches the owner as refused, cleaned, one call each: %r' % rf)
            check(ra.get('code') == 'refused' and 'declined' in (ra.get('message') or '') and 'claude-' not in (ra.get('message') or ''), 'an admin reads it too: %r' % ra)
            check(rm.get('code') == 'refused' and rm.get('message') in ('', 'refused'), 'a member gets refused alone: %r' % rm)
            check(used(fuid) == f0 + 1 and used(muid) == m0 + 1, 'a refusal counts once: the model answered')
            # the platform's bare 504 on a model call reads as no answer in time; on any other action it stays unavailable
            def bare504(route):
                try:
                    act = json.loads(route.request.post_data or '{}').get('a')
                except Exception:
                    act = ''
                if act in ('ai', 'aistatus'):
                    route.fulfill(status=504, body='<html><body>504 Gateway Time-out</body></html>', headers={'content-type': 'text/html'})
                else:
                    route.continue_()
            m.route('**/api/m360*', bare504)
            r504 = m.evaluate(ask, ['default'])
            o504 = m.evaluate('() => window.M360_API("aistatus", {}).then(() => "ran", e => e.code + "|" + e.status)')
            m.unroute('**/api/m360*')
            check(not r504['ok'] and r504['code'] == 'ai_unreachable' and r504['status'] == 504, 'a bare 504 on a model call is ai_unreachable: %r' % r504)
            check(o504 == 'unavailable|504', 'a bare 504 on another action stays unavailable: %r' % o504)
            # quick answers are named the same way
            fail('key')
            rq = m.evaluate(ask, ['quick'])
            check(not rq['ok'] and rq['code'] == 'ai_key', 'a quick answer with a refused key is ai_key too: %r' % rq)
            fail('off')

            # ---- the recoveries: one extra call, and it answers ----
            for mode, n, tier, models, label in (('model', 1, 'default', ['claude-opus-5-5', 'claude-sonnet-5-5'], 'a missing model falls back once (thinking answers)'),
                                                ('model', 1, 'quick', ['claude-haiku-5-5', 'claude-sonnet-5-5'], 'a missing model falls back once (quick answers)'),
                                                ('busy', 1, 'default', ['claude-opus-5-5', 'claude-opus-5-5'], 'an overloaded API is tried once more after a short wait'),
                                                ('beta', 0, 'default', ['claude-opus-5-5', 'claude-opus-5-5'], 'a refused beta is tried once without it')):
                fail(mode, n)
                u0 = used(fuid)
                get('__ai?clear=1')
                t0 = time.time()
                r = f.evaluate(ask, [tier])
                dt = time.time() - t0
                cs = get('__ai')
                fail('off')
                check(r['ok'] and 'hero reel' in r['text'], '%s: it answers: %r' % (label, r))
                check([c['model'] for c in cs] == models and len(cs) == 2, '%s: two calls, %r' % (label, [(c['model'], c['fail']) for c in cs]))
                check(used(fuid) == u0 + 1, '%s: the turn counts once' % label)
                if mode == 'busy':
                    check(dt >= 1.4, 'the busy retry waits about 1.5 s: %.2f s' % dt)
                if mode == 'beta':
                    check(cs[0]['beta'] and cs[0]['fallbacks'] == 'default' and cs[1]['beta'] == '' and cs[1]['fallbacks'] is None,
                          'the retry drops the beta header and the fallbacks: %r' % [(c['beta'], c['fallbacks']) for c in cs])
            # nothing failing: one call, counted
            get('__ai?clear=1')
            u0 = used(muid)
            r = m.evaluate(ask, ['default'])
            check(r['ok'] and len(get('__ai')) == 1 and used(muid) == u0 + 1, 'a plain turn is one call and counts once')

            # ---- aicheck ----
            r = f.evaluate('() => window.M360_API("aicheck", {})')
            raw = json.dumps(r)
            check(r['key'] is True and r['source'] == 'environment' and r['tiers']['quick']['ok'] and r['tiers']['default']['ok']
                  and set(r['tiers']['quick']) == {'ok', 'ms', 'code', 'reason'}, 'aicheck for the owner: both tiers working, the key from the environment: %r' % r)
            check('sk-ant' not in raw and 'claude-' not in raw and 'local-test' not in raw, 'aicheck names no key and no model: %s' % raw)
            fail('credit')
            r = f.evaluate('() => window.M360_API("aicheck", {})')
            check(all(not r['tiers'][t]['ok'] and r['tiers'][t]['code'] == 'ai_credit' and 'credit balance is too low' in r['tiers'][t]['reason'] for t in ('quick', 'default')),
                  'aicheck with no credit says so for each tier: %r' % r['tiers'])
            fail('model')
            r = a.evaluate('() => window.M360_API("aicheck", {})')
            check(r['tiers']['default']['code'] == 'ai_model' and 'claude-' not in json.dumps(r), 'an admin checks the AI too, and a missing model reads without its name: %r' % r['tiers'])
            fail('off')
            get('__ai?clear=1')
            got = m.evaluate('() => window.M360_API("aicheck", {}).then(() => "ran", e => e.code + "|" + e.status)')
            check(got == 'not_granted|403', 'a member cannot check the AI: %r' % got)
            # nobody signed in: refused, and no model is asked
            req = urllib.request.Request(base + 'api/m360', data=json.dumps({'a': 'aicheck'}).encode(), headers={'content-type': 'application/json'}, method='POST')
            try:
                gs, gb = urllib.request.urlopen(req, timeout=30).status, ''
            except urllib.error.HTTPError as e:
                gs, gb = e.code, e.read().decode()
            check(gs == 403 and 'tiers' not in gb and 'sk-ant' not in gb and not calls(), 'a guest cannot check the AI and no model is asked: %r %r' % (gs, gb[:120]))
            data = get('__store')
            logs = [json.loads(v) for k, v in data.items() if k.startswith('d/log~') and k.endswith(fuid)]
            lines = [e for d in logs for e in d.get('e', {}).values() if e.get('a') == 'aicheck']
            check(len(lines) >= 2 and any('ai_credit' in e['s'] for e in lines) and not any('sk-ant' in e['s'] or 'claude-' in e['s'] for e in lines),
                  'aicheck is in the activity log, with no key or model: %r' % [e['s'] for e in lines])
            check('sk-ant' not in json.dumps({k: v for k, v in data.items() if not k.startswith('x/ai')}), 'no key anywhere in the store outside x/ai')

            # ---- the page: Ask m360 says it plainly, the owner reads what Anthropic said ----
            def dock(pg, q):
                pg.goto(base + '#home')
                pg.reload()
                pg.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); pg.keyboard.press('Control+k'); pg.locator('.pal-item[data-k="a-ai"]').click()   # v40: m360 AI opens from the Ask bar
                pg.fill('#buddy-input', q)
                pg.keyboard.press('Enter')
                pg.wait_for_selector('.buddy-bubble .panel-err', timeout=45000)
                return pg.inner_text('.buddy-bubble .panel-err'), pg.locator('.buddy-bubble .panel-chips .chip').count()
            for mode, code, said in CASES:
                fail(mode)
                t, chips = dock(f, QUESTION)
                check(COPY[code] in t and ('Anthropic said: ' + said) in t and 'claude-' not in t and chips >= 1,
                      '%s in Ask m360 for Kaavish: the copy, the offline chips and "Anthropic said": %r' % (mode, t))
                if mode == 'credit':
                    os.makedirs(SHOTS, exist_ok=True)
                    f.screenshot(path=os.path.join(SHOTS, 'v361-ai-error-kaavish-1280.png'))
                if mode == 'model':
                    f.screenshot(path=os.path.join(SHOTS, 'v361-ai-error-kaavish-model-1280.png'))
                t, chips = dock(m, QUESTION)
                check(COPY[code] in t and 'Anthropic said' not in t and chips >= 1, '%s in Ask m360 for a member: the copy and the chips, no reason: %r' % (mode, t))
                if mode == 'credit':
                    m.screenshot(path=os.path.join(SHOTS, 'v361-ai-error-member-1280.png'))
            fail('off')

            # ---- HQ's brief sits on a dark card: what Anthropic said reads there too, light and dark ----
            fail('credit')
            for theme in ('light', 'dark'):
                f.goto(base + '#hq')
                f.reload()
                f.wait_for_function('() => !!(window.M && M.lastCtx && M.theme)')
                f.evaluate('t => M.theme.set(t)', theme)
                # v40: HQ opens on Command; the brief sits under "more from HQ"
                f.wait_for_selector('#hq-more')
                if f.get_attribute('#hq-more', 'aria-expanded') != 'true':
                    f.click('#hq-more')
                f.locator('section.ai-card.dark button.btn').first.click()
                f.wait_for_selector('section.ai-card.dark .ai-why', timeout=45000)
                t = f.inner_text('section.ai-card.dark')
                ratio = f.evaluate(CONTRAST, ['section.ai-card.dark .ai-why', 'section.ai-card.dark'])
                check(COPY['ai_credit'] in t and 'Anthropic said: Your credit balance is too low' in t and ratio >= 4.5,
                      'HQ brief, %s: the copy and what Anthropic said, readable on the dark card (%.1f:1)' % (theme, ratio))
                if theme == 'dark':
                    f.locator('section.ai-card.dark').scroll_into_view_if_needed()
                    f.screenshot(path=os.path.join(SHOTS, 'v361-ai-error-hq-kaavish-1280-dark.png'))
                f.evaluate('() => M.theme.set("auto")')
            fail('off')

            # ---- Admin > m360 AI > Check the AI, at 1280 and 390, light and dark ----
            for width, theme, mode in ((1280, 'light', 'off'), (1280, 'dark', 'credit'), (390, 'light', 'credit'), (390, 'dark', 'off')):
                fail(mode)
                f.set_viewport_size({'width': width, 'height': 900})
                f.goto(base + '#admin')
                f.reload()
                f.wait_for_function('() => !!(window.M && M.lastCtx && M.theme)')
                f.evaluate('t => M.theme.set(t)', theme)
                if width < 700:
                    f.wait_for_selector('#fold-ai .fold-head')
                    f.click('#fold-ai .fold-head')
                f.wait_for_selector('#ai-check')
                f.click('#ai-check')
                f.wait_for_selector('#ai-check-out .ai-check-row[data-tier="default"]', timeout=45000)
                rows = f.evaluate('() => [...document.querySelectorAll("#ai-check-out .ai-check-row")].map(r => ({tier: r.dataset.tier, code: r.dataset.code, text: r.innerText}))')
                text = ' | '.join(r['text'].replace('\n', ' / ') for r in rows)
                if mode == 'off':
                    check(len(rows) == 2 and re.search(r'Quick answers: working, \d+\.\d s', text) and re.search(r'Thinking answers: working, \d+\.\d s', text),
                          'Check the AI at %d %s: both working, timed: %s' % (width, theme, text))
                else:
                    check(len(rows) == 2 and 'Thinking answers: out of credit' in text and 'Quick answers: out of credit' in text
                          and 'Anthropic said: Your credit balance is too low' in text and 'claude-' not in text,
                          'Check the AI at %d %s: out of credit, with what Anthropic said: %s' % (width, theme, text))
                    check(f.evaluate(CONTRAST, ['#ai-check-out .ai-check-row[data-tier="default"] .ai-why', '#ai-check-out']) >= 4.5
                          and f.evaluate(CONTRAST, ['#ai-check-out .ai-check-row[data-tier="default"] b', '#ai-check-out']) >= 4.5,
                          'Check the AI is readable at %d %s' % (width, theme))
                check('environment' in f.inner_text('#ai-check-source'), 'it says where the key lives')
                check(f.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, 'no sideways scroll at %d %s' % (width, theme))
                f.locator('#ai-check-box').scroll_into_view_if_needed()
                f.screenshot(path=os.path.join(SHOTS, 'v361-check-ai-%d-%s.png' % (width, theme)))
                f.evaluate('() => M.theme.set("auto")')
            # a refused key that lives in the site's environment: the hint says a pasted key is not used while it is set
            fail('key')
            f.set_viewport_size({'width': 1280, 'height': 900})
            f.goto(base + '#admin')
            f.reload()
            f.wait_for_selector('#ai-check')
            f.click('#ai-check')
            f.wait_for_selector('#ai-check-out .ai-check-row[data-code="ai_key"]', timeout=45000)
            t = f.inner_text('#ai-check-out')
            check('the key was refused' in t and "set in the site's environment settings, and a key pasted here is not used" in t and 'Paste a new key here' not in t,
                  'Check the AI: a refused environment key says where to change it: %r' % t)
            fail('off')
            # a member's Admin has no AI card at all
            m.goto(base + '#admin')
            m.wait_for_function('() => !!(window.M && M.lastCtx) && location.hash.length > 1 && !!document.querySelector("main") && document.querySelector("main").children.length > 0')
            check(m.locator('#ai-check').count() == 0, 'a member has no Check the AI')
            browser.close()
    except Exception:
        check(False, 'the team site part stopped: ' + traceback.format_exc()[-1500:])
    finally:
        srv.terminate()
    errs = [e for e in errors if 'AudioContext' not in e and 'play()' not in e]
    check(not errs, 'no page errors on the team site: %r' % errs[:4])


def artifact_part(h, check):
    """claude.ai: the sample's own codes stay, Kaavish reads the cleaned message, a member does not"""
    said = urllib.parse.quote('Rate limit reached for claude-sonnet-5-5 ' + chr(0x2014) + ' try again soon' + chr(33))
    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    h.roster(p, ['u_m1', 'u_m2'])
    h.go(p, 'founder', hash='#home', aierr='rate_limited', aimsg=said)
    p.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); p.keyboard.press('Control+k'); p.locator('.pal-item[data-k="a-ai"]').click()   # v40: m360 AI opens from the Ask bar
    p.fill('#buddy-input', QUESTION)
    p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble .panel-err', timeout=20000)
    t = p.inner_text('.buddy-bubble .panel-err')
    check('Claude needs a breather' in t and 'Anthropic said: Rate limit reached for the model, try again soon.' in t and 'claude-' not in t and chr(0x2014) not in t,
          'claude.ai: the owner reads the copy and the cleaned message: %r' % t)
    h.go(p, 'm1', hash='#home', aierr='rate_limited', aimsg=said)
    p.wait_for_function('() => !!(window.M && M.assistant && M.assistant.opener)'); p.keyboard.press('Control+k'); p.locator('.pal-item[data-k="a-ai"]').click()   # v40: m360 AI opens from the Ask bar
    p.fill('#buddy-input', QUESTION)
    p.keyboard.press('Enter')
    p.wait_for_selector('.buddy-bubble .panel-err', timeout=20000)
    t = p.inner_text('.buddy-bubble .panel-err')
    check('Claude needs a breather' in t and 'Anthropic said' not in t, 'claude.ai: a member reads the copy only: %r' % t)
    # what a person may read, from any message
    c = p.evaluate('''() => [M.ai.clean("model: claude-opus-5-5 not found \\u2013 sk-ant-zzzz1234"), M.ai.clean("x ".repeat(400)).length,
      M.ai.why({code: "ai_credit", message: "ai_credit"}), M.ai.why({code: "unavailable", message: "offline"}), M.ai.why({code: "cancelled", message: "stopped"}),
      M.ai.isDown("ai_busy"), M.ai.isDown("rate_limited")]''')
    check(c[0] == 'model: the model not found, a key' and c[1] <= 300 and c[2:] == ['', '', '', True, False], 'M.ai.clean and M.ai.why: %r' % c)
    # a toast that shows a desk's error (Handshake) says a named AI failure in the house words, never its bare code
    s = p.evaluate('''() => [M.ai.say({code: "ai_credit", message: "ai_credit"}, "Could not write"), M.ai.say({code: "unavailable", message: "unavailable"}, "x"),
      M.ai.say({code: "refused", message: "refused"}, "x"), M.ai.say({message: "Could not write Asha. Try again in a minute."}, "x"), M.ai.say(null, "Could not write")]''')
    check(s == [COPY['ai_credit'], 'Something glitched. Try again.', 'Claude passed on that one. Try asking differently.', 'Could not write Asha. Try again in a minute.', 'Could not write'],
          'M.ai.say for a member: %r' % s)
    # Check the AI on claude.ai: one tiny call on the viewer's own account
    h.go(p, 'founder', hash='#admin')
    p.wait_for_selector('#ai-check')
    n0 = p.evaluate('() => window.__sampleCalls.length')
    p.click('#ai-check')
    p.wait_for_selector('#ai-check-out .ai-check-row')
    t = p.inner_text('#ai-check-out')
    check(re.search(r'Quick answers: working, \d+\.\d s', t) and p.evaluate('() => window.__sampleCalls.length') == n0 + 1, 'claude.ai Check the AI: one call, working: %r' % t)
    h.go(p, 'founder', hash='#admin', aierr='rate_limited', aimsg=said)
    p.wait_for_selector('#ai-check')
    p.click('#ai-check')
    p.wait_for_selector('#ai-check-out .ai-check-row.bad')
    t = p.inner_text('#ai-check-out')
    check('Quick answers: at its rate limit for a minute' in t and 'Anthropic said: Rate limit reached for the model' in t, 'claude.ai Check the AI names the failure: %r' % t)
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'no console errors on claude.ai: %r' % errs[:3])


def main():
    checks, fails = [], []

    def check(cond, msg):
        (checks if cond else fails).append(msg)
    try:
        run(lambda h: artifact_part(h, check))
    except Exception:
        fails.append('the claude.ai part stopped: ' + traceback.format_exc()[-1500:])
    site_part(check)
    for c in checks:
        print('ok', c)
    for f in fails:
        print('FAIL', f)
    if fails:
        print('FAILED %d of %d checks' % (len(fails), len(fails) + len(checks)))
        sys.exit(1)
    print('PASS', len(checks), 'checks passed')


if __name__ == '__main__':
    main()
