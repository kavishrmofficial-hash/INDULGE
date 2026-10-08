#!/usr/bin/env python3
"""v34 test: where prospects meet the m360 COO (spec H2 and H3): J40 and J41 on the page (M.coo.runSlot,
src/js/10-coo.js) and on the server (edgeone/server/coo.js), the same on both.

A working Tuesday, 13 Oct 2026, Kaavish owning every pitch so each trigger is a card and nothing rides on the
personal managers. Seven proposals and leads:
- A: a next date ahead (tomorrow) keeps J40 quiet on a pitch with no next text and 20 days in stage, and J41 waits;
- B: no next step, 20 days in proposal: J40 raises its card, J41 drafts to the pitch contact (Priya);
- C: a next date of yesterday set by a private follow-up (nextBy 'fu') gets a working day of grace: no J40;
- D: the same date with no marker is one working day late: J40's card;
- E: the latest send has a reply: no J41 draft;
- F: the latest send went to Meera eight days ago, the pitch contact is Priya: J41 counts from the send and
  drafts to Meera;
- G: a send two days ago: too soon for J41.
The page runs the brief and r12 slots as Kaavish's visible page; the server runs the same two slots through
createApp on an in-memory store with the clock pinned. The rows and the cards must agree, pitch by pitch.
window.__sampleCalls stays empty.

Fails until builder 1's J40 and J41 changes are merged; the message says which side.

Run: cd m360-os && python3 harness/tests/test_prospects_coo.py
"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
CORE = os.path.join(ROOT, 'edgeone', 'server', 'core.js')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
TUE = datetime(2026, 10, 13, 9, 50, tzinfo=IST)
TODAY = '2026-10-13'
DAY = 86400000


def ms(hh, mm, d=0):
    return int((TUE.replace(hour=hh, minute=mm) + timedelta(days=d)).timestamp() * 1000)


def contact(cid, first, last, mail):
    return {'id': cid, 'first': first, 'last': last, 'name': first + ' ' + last, 'title': 'Brand head', 'email': mail, 'email2': '', 'phone': '', 'mobile': '', 'linkedin': '',
            'org': 'o2', 'orgName': 'Swisse Wellness UAE', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'seniority': 'head', 'dept': 'marketing', 'source': 'manual', 'apolloId': '', 'tags': [],
            'stage': 'lead', 'owner': F, 'notes': '', 'edited': {}, 'at': ms(9, 0, -30), 'updated': ms(9, 0, -30), 'updatedBy': F, 'archived': False}


def pitches(owner):
    base = {'category': '', 'contact': '', 'source': '', 'updated': ms(9, 0, -1), 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': ms(9, 0, -30), 'owner': owner}
    old = ms(9, 0, -20)
    send = lambda to, days, reply='': {'sd1': {'to': to, 'via': 'mail', 'what': 'Proposal v2', 'link': '', 'at': ms(11, 0, -days), 'by': owner, 'reply': reply, 'replyAt': ms(12, 0, -days + 1) if reply else 0}}  # noqa: E731
    return {
        'pt_a': {**base, 'brand': 'Alpha', 'stage': 'proposal', 'stageAt': old, 'nextDate': '2026-10-14', 'contact': 'c_priya'},
        'pt_b': {**base, 'brand': 'Bravo', 'stage': 'proposal', 'stageAt': old, 'contact': 'c_priya'},
        'pt_c': {**base, 'brand': 'Charlie', 'stage': 'qualified', 'stageAt': ms(9, 0, -5), 'next': 'Follow up', 'nextDate': '2026-10-12', 'nextBy': 'fu'},
        'pt_d': {**base, 'brand': 'Delta', 'stage': 'qualified', 'stageAt': ms(9, 0, -5), 'next': 'Call back', 'nextDate': '2026-10-12'},
        'pt_e': {**base, 'brand': 'Echo', 'stage': 'proposal', 'stageAt': old, 'contact': 'c_priya', 'sent': send('c_meera', 10, 'replied')},
        'pt_f': {**base, 'brand': 'Foxtrot', 'stage': 'proposal', 'stageAt': old, 'contact': 'c_priya', 'sent': send('c_meera', 8)},
        'pt_g': {**base, 'brand': 'Golf', 'stage': 'proposal', 'stageAt': old, 'contact': 'c_priya', 'sent': send('c_meera', 2)},
    }


CONTACTS = {'c_meera': contact('c_meera', 'Meera', 'Shah', 'meera@swisse.ae'), 'c_priya': contact('c_priya', 'Priya', 'Iyer', 'priya@nykaa.example')}

SCRIPT = r'''
import {createApp} from %(core)s;
const TODAY = %(today)s;
const DAY = 86400000;
const at = (h, m, d) => Date.parse(TODAY + 'T00:00:00Z') - 330 * 60000 + (h * 60 + m) * 60000 + (d || 0) * DAY;
let NOW = at(9, 46);
Date.now = () => NOW;
const NAMED = [['open', 540], ['brief', 585], ['r10', 600], ['r11', 660], ['r12', 720], ['m1230', 750], ['r15', 900], ['r16', 960], ['r1730', 1050], ['close', 1260],
  ['roll1045', 645], ['roll1045b', 705], ['eod', 1170], ['memo', 720]];
for (let t = 540; t <= 1260; t += 15) NAMED.push(['w' + String(Math.floor(t / 60)).padStart(2, '0') + String(t %% 60).padStart(2, '0'), t]);
const data = new Map();
const store = {
  async get(key, x) { if (!data.has(key)) return null; const v = data.get(key); return x && x.type === 'json' ? JSON.parse(v) : v; },
  async set(key, value) { data.set(key, String(value)); },
  async delete(key) { data.delete(key); },
  async list(x) { const p = (x && x.prefix) || ''; return {blobs: [...data.keys()].filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '"' + data.get(k).length + '"'})), directories: []}; }
};
const fetcher = async () => new Response('', {status: 404});
globalThis.fetch = fetcher;
const env = {fetch: fetcher, COO_SETTLE_MS: '5', PM_RECHECK_MS: '0', BOOKS_RECHECK_MS: '0', SITE_URL: 'https://m360.example.com'};
const app = createApp({store, env});
const put = (k, v) => data.set(k, JSON.stringify(v));
const doc = k => JSON.parse(data.get(k) || 'null');
const d = path => doc('d/' + path.split('/').join('~'));
const setDoc = (path, v) => put('d/' + path.split('/').join('~'), v);
const P = {u_founder: 'Kaavish Ramchandani', u_m1: 'Durvesh Patil', u_m2: 'Aanya Mehta', u_m3: 'Ishaan Rao'};
put('o/owner', {uid: 'u_founder'});
for (const u of Object.keys(P)) put('p/' + u, {name: P[u], email: u.slice(2) + '@example.com', at: NOW});
const mem = (role, x) => ({role, active: true, joined: '2025-01-06', empId: 'M360-' + Math.random().toString().slice(2, 5), start: '', ...(x || {})});
setDoc('roster/team', {members: {u_founder: mem('founder', {empId: 'M360-001'}), u_m1: mem('member', {pod: 'Pod 1'}), u_m2: mem('member', {pod: 'Pod 1'}), u_m3: mem('member', {pod: 'Pod 2'})}});
setDoc('settings/app', {start: '10:30', grace: 15, eodCut: '19:30', holidays: [], rules: {}, pm: {on: false},
  coo: {on: true, signedAt: at(9, 0, -20), signedBy: 'u_founder', practiceUntil: null, pausedUntil: null}});
for (const u of Object.keys(P)) { setDoc('checkin/' + u, {days: {}}); setDoc('eod/' + u, {days: {}}); setDoc('me/' + u, {}); setDoc('leave/' + u, {reqs: []}); setDoc('leavedec/' + u, {d: {}}); }
setDoc('contacts/p000', {rows: %(contacts)s, n: 2});
const PITCHES = %(pitches)s;
for (const id of Object.keys(PITCHES)) setDoc('pitches/' + id, PITCHES[id]);
const settle = keep => { const mins = Math.floor(((NOW + 330 * 60000) %% DAY) / 60000); for (const [id, t] of NAMED) if (t <= mins && keep.indexOf(id) < 0 && !data.has('x/coo/' + TODAY + '/' + id)) put('x/coo/' + TODAY + '/' + id, {state: 'done', at: NOW, acts: 0}); };
const call = async body => { const r = await app(new Request('http://localhost/api/m360', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})); let j = null; try { j = await r.json(); } catch (e) { j = null; } return {status: r.status, body: j}; };
const rows = () => { const L = d('coo/L-' + TODAY); return L ? Object.keys(L.acts || {}).map(id => ({id, ...L.acts[id]})) : []; };
const cards = () => { const c = d('coo/dec'); return c ? Object.keys(c.items || {}).map(id => ({id, ...c.items[id]})) : []; };
settle(['brief']);
const t1 = await call({a: 'tick'});
NOW = at(12, 1);
settle(['r12']);
const t2 = await call({a: 'tick'});
const out = {ticks: [t1.body && t1.body.coo, t2.body && t2.body.coo], j40: {}, j41: {}};
for (const r of rows()) {
  const pid = (r.refs || {}).pitch; if (!pid) continue;
  if (r.job === 'J40') (out.j40[pid] = out.j40[pid] || []).push(r.code + ':' + r.status);
}
for (const k of cards()) { const pid = (k.refs || {}).pitch; if (k.kind === 'client_mail' && pid) out.j41[pid] = ((k.payload || {}).draft || {}).to || ''; }
console.log(JSON.stringify(out));
'''


def page_part(h):
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    c = h.browser.new_context(viewport={'width': 1280, 'height': 900}, locale='en-IN', timezone_id='Asia/Kolkata')
    h.contexts.append(c)
    c.clock.set_fixed_time(TUE)
    p = c.new_page()
    p.set_default_timeout(25000)
    p.on('pageerror', lambda e: h.console.append(('pageerror', str(e))))
    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    if not p.evaluate('() => !!(M.coo && M.coo.runSlot)'):
        raise AssertionError('M.coo.runSlot is not on the page: this test runs once the COO is merged')
    h.roster(p, [M1, M2, M3])
    s = p.evaluate('() => window.__db.get("settings/app") || {}')
    s['coo'] = {'on': True, 'title': 'm360 COO', 'signedAt': ms(9, 0, -20), 'signedBy': F, 'practiceUntil': None, 'pausedUntil': None}
    s['holidays'] = []
    h.seed_doc(p, 'settings/app', s)
    h.seed_doc(p, 'contacts/p000', {'rows': CONTACTS, 'n': 2})
    for pid, doc in pitches(F).items():
        h.seed_doc(p, 'pitches/' + pid, doc)
    p.goto(h.url('founder', '#home', noai=True))
    h.ready(p)
    p.wait_for_function('() => !!(window.M && M.lastCtx && M.coo && M.lastCtx.activeMembers.length >= 3 && Object.keys(M.lastCtx.coll.pitches.map).length >= 7 && M.lastCtx.coll.contacts && M.lastCtx.coll.contacts.ready)')
    p.wait_for_timeout(400)
    out = p.evaluate('''async n => { const c = M.lastCtx;
      const a = await M.coo.runSlot(c, 'brief', {now: n[0]});
      await new Promise(x => setTimeout(x, 400));
      const b = await M.coo.runSlot(M.lastCtx, 'r12', {now: n[1]});
      const j40 = {}, j41 = {};
      for (const r of a.rows.concat(b.rows)) { const pid = (r.refs || {}).pitch; if (pid && r.job === 'J40') (j40[pid] = j40[pid] || []).push(r.code + ':' + r.status); }
      for (const k of a.cards.concat(b.cards)) { const pid = (k.refs || {}).pitch; if (k.kind === 'client_mail' && pid) j41[pid] = ((k.payload || {}).draft || {}).to || ''; }
      return {stopped: [a.stopped, b.stopped], practice: a.practice, j40, j41, calls: window.__sampleCalls.length, n: [a.rows.length, b.rows.length]}; }''', [ms(9, 50), ms(12, 5)])
    check(not out['stopped'][0] and not out['stopped'][1] and not out['practice'], 'both slots ran on the page: %r' % out)
    j40, j41 = out['j40'], out['j41']
    check('pt_a' not in j40, 'A: a next date ahead keeps J40 quiet: %r' % j40)
    check(j40.get('pt_b') == ['pitch_late:done'], 'B: no next step raises the card: %r' % j40.get('pt_b'))
    check('pt_c' not in j40, 'C: a date from a private follow-up gets a working day of grace: %r' % j40.get('pt_c'))
    check(j40.get('pt_d') == ['pitch_late:done'], 'D: the same date without the marker is late: %r' % j40.get('pt_d'))
    check('pt_a' not in j41 and 'pt_e' not in j41 and 'pt_g' not in j41, 'J41 waits on a date ahead, a reply and a fresh send: %r' % j41)
    check(j41.get('pt_b') == 'priya@nykaa.example', 'B: the draft goes to the pitch contact: %r' % j41.get('pt_b'))
    check(j41.get('pt_f') == 'meera@swisse.ae', 'F: the draft goes to the latest send\'s Base contact: %r' % j41.get('pt_f'))
    check(out['calls'] == 0, 'no model call on the page')
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    return {'j40': j40, 'j41': j41, 'checks': checks}


def server_part():
    if not os.path.exists(os.path.join(ROOT, 'edgeone', 'server', 'coo.js')):
        raise AssertionError('edgeone/server/coo.js is not here')
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, 'prospects_coo.mjs')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SCRIPT % {'core': json.dumps('file://' + CORE), 'today': json.dumps(TODAY), 'contacts': json.dumps(CONTACTS), 'pitches': json.dumps(pitches(F))})
    r = subprocess.run(['node', path], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit('node failed')
    return json.loads(r.stdout.strip().splitlines()[-1])


if __name__ == '__main__':
    page = run(page_part)
    srv = server_part()
    checks = list(page['checks'])

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    check(all(t and t.get('state') in ('busy', 'on', 'idle', 'ran', 'done') or (t and 'slot' in t) for t in srv['ticks']), 'the server ticks ran: %r' % srv['ticks'])
    check(srv['j40'] == page['j40'], 'J40 agrees on the page and the server: page %r, server %r' % (page['j40'], srv['j40']))
    check(srv['j41'] == page['j41'], 'J41 agrees on the page and the server: page %r, server %r' % (page['j41'], srv['j41']))
    print('test_prospects_coo: %d checks passed' % len(checks))
