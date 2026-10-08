#!/usr/bin/env python3
"""v34 test: the prospects store (M.prospects, src/js/25-prospects.js) on the claude.ai mock.

A frozen Mon 5 Oct 2026 10:00 IST. Kaavish founds; Durvesh (m1) owns the Swisse pitch, Aanya (m2) the Nykaa one,
Kaavish the Tata one. Meera Shah is in the Base at Swisse. Checks:
- one capture ("Met Rahul from Tata, sent the deck, he said talk after the 16th") writes exactly the private index,
  the month log, pitches/<id>.sent and the bridge fields (nextDate, next, nextBy), with the activity log and the
  person's own me doc as bookkeeping; never tasks/*, contacts/* or dm/*; no key called name or email anywhere;
- one open follow-up a person and a pitch: a second date closes the first as 'moved';
- compaction drops gone people past 100 in one rewrite; a month log past 200 KB overflows to prospects.<YYYY-MM>-2;
- a preview (viewAs) reads nothing and writes nothing; a member loads their own index with no owner gate;
- a send sets an auto check-back (5 working days for a proposal, src 'sent', the send id on it) and a reply
  closes it and marks the send row;
- the bridge runs only for the pitch's owner or the founder, says so otherwise, and its clear is safe: a next
  date changed by hand since is left alone.
window.__sampleCalls stays empty.

Fails until builder 1's 08-when.js and 25-prospects.js are merged; the message says so.

Run: cd m360-os && python3 harness/tests/test_prospects_store.py
"""
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3 = 'u_founder', 'u_m1', 'u_m2', 'u_m3'
MON = datetime(2026, 10, 5, 10, 0, tzinfo=IST)
NOW = int(MON.timestamp() * 1000)
DAY = 86400000
IX = 'data/users/%s/prospects'
MONTH = 'data/users/%s/prospects.2026-10'

# every key in a document, at any depth
KEYS_JS = '''d => { const out = new Set(); const walk = x => { if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.add(k); walk(x[k]); } }; walk(d); return Array.from(out); }'''


def test(h):
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
        # the Base rows too, since a capture links a person to a contact by name
        p.wait_for_function('() => !!(window.M && M.lastCtx && M.prospects && M.when && M.lastCtx.activeMembers.length >= 3 && M.lastCtx.priv.prospects.ready && M.lastCtx.coll.contacts && M.lastCtx.coll.contacts.ready)')
        p.wait_for_timeout(200)

    p.goto(h.url('founder', '#home', reset=True, seed=True, noai=True))
    h.ready(p)
    p.wait_for_function('() => !!window.__db.get("roster/team")')
    if not p.evaluate('() => !!(M.prospects && M.prospects.apply && M.when)'):
        raise AssertionError('M.prospects is not on the page: this test runs once builder 1 (08-when.js, 25-prospects.js) is merged')
    h.roster(p, [M1, M2, M3])
    base = {'category': '', 'contact': '', 'source': '', 'updated': NOW, 'stageAt': NOW - 5 * DAY, 'next': '', 'nextDate': '', 'project': '', 'lost': '', 'created': NOW - 5 * DAY}
    h.seed_doc(p, 'pitches/pt_tata', {**base, 'brand': 'Tata', 'owner': F, 'stage': 'qualified'})
    h.seed_doc(p, 'pitches/pt_swisse', {**base, 'brand': 'Swisse', 'owner': M1, 'stage': 'proposal'})
    h.seed_doc(p, 'pitches/pt_nykaa', {**base, 'brand': 'Nykaa', 'owner': M2, 'stage': 'lead'})
    org = {'id': 'o2', 'name': 'Swisse Wellness UAE', 'domain': 'swisse.ae', 'website': '', 'industry': 'Wellness', 'size': '', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'linkedin': '', 'phone': '',
           'keywords': [], 'source': 'manual', 'apolloId': '', 'client': '', 'tags': [], 'notes': '', 'edited': {}, 'at': NOW - 30 * DAY, 'updated': NOW - 30 * DAY, 'updatedBy': F, 'archived': False}
    row = {'id': 'c_meera', 'first': 'Meera', 'last': 'Shah', 'name': 'Meera Shah', 'title': 'Brand head', 'email': 'meera@swisse.ae', 'email2': '', 'phone': '', 'mobile': '', 'linkedin': '',
           'org': 'o2', 'orgName': 'Swisse Wellness UAE', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'seniority': 'head', 'dept': 'marketing', 'source': 'manual', 'apolloId': '', 'tags': [],
           'stage': 'lead', 'owner': F, 'notes': '', 'edited': {}, 'at': NOW - 30 * DAY, 'updated': NOW - 30 * DAY, 'updatedBy': F, 'archived': False}
    h.seed_doc(p, 'contacts/p000', {'rows': {'c_meera': row}, 'n': 1})
    h.seed_doc(p, 'orgs/p000', {'rows': {'o2': org}, 'n': 1})
    be('founder')

    keys = lambda: set(p.evaluate('() => Object.keys(localStorage).filter(k => k.startsWith("m360db:")).map(k => k.slice(7))'))  # noqa: E731
    doc = lambda path: p.evaluate('k => window.__db.get(k)', path)  # noqa: E731
    snap = lambda paths: {k: p.evaluate('k => JSON.stringify(window.__db.get(k))', k) for k in paths}  # noqa: E731

    # ---- one capture, one burst ----
    before_keys = keys()
    before = snap(before_keys)
    r = p.evaluate('''async () => { const c = M.lastCtx; const rd = M.prospects.read("Met Rahul from Tata, sent the deck, he said talk after the 16th", c);
      const res = await M.prospects.apply(c, rd, {}, {}); await new Promise(x => setTimeout(x, 500));
      return {say: res.say, fid: res.fid, pid: res.pid, sid: res.sid, pitch: res.pitch, bridged: res.bridged, chips: res.chips.map(x => x.label), hold: res.hold.map(x => x.label)}; }''')
    check(r['say'] == 'Logged. Met Rahul at Tata, deck sent. I will remind you on Sat 17 Oct at 10:00. Tata next step: Sat 17 Oct.', 'the receipt: %r' % r['say'])
    check(r['bridged'] and r['pitch'] == 'pt_tata' and r['fid'] and r['pid'] and r['sid'], 'a person, a follow-up, a send and the bridge: %r' % r)
    check('Keep the date private' in r['chips'] and r['chips'][0] == 'Undo', 'the chips carry Undo and Keep the date private: %r' % r['chips'])
    after_keys = keys()
    after = snap(after_keys)
    changed = sorted(k for k in after_keys if k not in before_keys or before.get(k) != after.get(k))
    real = [k for k in changed if not k.startswith('log/') and not k.startswith('me/')]
    check(sorted(real) == sorted([IX % F, MONTH % F, 'pitches/pt_tata']), 'exactly the index, the month log and the pitch change: %r' % changed)
    check(not [k for k in changed if k.startswith(('tasks/', 'contacts/', 'dm/', 'orgs/'))], 'no task, contact or DM write: %r' % changed)
    ix = doc(IX % F)
    fu = ix['fu'][r['fid']]
    person = ix['people'][r['pid']]
    check(person['who'] == 'Rahul' and person['org'] == 'Tata' and person['pi'] == ['pt_tata'] and person['cid'] == '' and person['mo'] == ['2026-10'] and person['last']['k'] == 'meet', 'the person row: %r' % person)
    check(fu['d'] == '2026-10-17' and fu['after'] == '2026-10-16' and fu['said'] == 'after the 16th' and fu['x'] == 'talk after the 16th' and fu['p'] == r['pid'] and fu['pi'] == 'pt_tata' and fu['sid'] == r['sid'] and fu['src'] == 'typed'
          and fu['mirror'] == {'nextDate': '2026-10-17', 'next': 'Follow up on deck'}, 'the follow-up row: %r' % fu)
    pitch = doc('pitches/pt_tata')
    sent = pitch['sent'][r['sid']]
    check(pitch['nextDate'] == '2026-10-17' and pitch['next'] == 'Follow up on deck' and pitch['nextBy'] == 'fu', 'the bridge wrote the date, the step and the marker: %r' % {k: pitch.get(k) for k in ('next', 'nextDate', 'nextBy')})
    check(sent['to'] == 'Rahul' and sent['via'] == 'meeting' and sent['what'] == 'deck' and sent['by'] == F and sent['reply'] == '' and sent['at'] == NOW, 'the shared send row: %r' % sent)
    month = doc(MONTH % F)
    touches = list(month['t'].values())
    check(len(touches) == 1 and touches[0]['k'] == 'meet' and touches[0]['p'] == r['pid'] and touches[0]['pi'] == 'pt_tata' and touches[0]['sid'] == r['sid'] and 'Rahul' in touches[0]['x'], 'the touch in the month log: %r' % touches)
    for path in (IX % F, MONTH % F, 'pitches/pt_tata'):
        ks = p.evaluate(KEYS_JS, doc(path))
        check('name' not in ks and 'email' not in ks, 'no name or email key in %s: %r' % (path, sorted(ks)))
    for pid in ix['people']:
        check(pid.startswith('pp') and len(pid) > 4, 'ids carry no words: %r' % pid)
    log = doc('log/%s/days/2026-10-05' % F) or {}
    lines = [e for e in (log.get('e') or {}).values() if 'prospects' in str(e.get('p', ''))]
    check(lines and all('Rahul' not in str(e.get('s', '')) and 'Tata' not in str(e.get('s', '')) for e in lines), 'the log line shows keys, never a name: %r' % [e.get('s') for e in lines])

    # ---- one open follow-up a person and a pitch ----
    r2 = p.evaluate('''async () => { const c = M.lastCtx; const res = await M.prospects.apply(c, M.prospects.read("Rahul said talk next week", c), {}, {}); await new Promise(x => setTimeout(x, 400)); return {fid: res.fid, pid: res.pid, say: res.say}; }''')
    ix = doc(IX % F)
    check(r2['pid'] == r['pid'] and r2['fid'] != r['fid'], 'the same person, a new follow-up: %r' % r2)
    check(ix['fu'][r['fid']]['done']['how'] == 'moved' and 'done' not in ix['fu'][r2['fid']], 'the first follow-up closed as moved')
    open_for = [k for k, f in ix['fu'].items() if not f.get('done') and f['p'] == r['pid']]
    check(open_for == [r2['fid']] and ix['fu'][r2['fid']]['d'] == '2026-10-12', 'one open follow-up for Rahul, Mon 12 Oct: %r' % open_for)
    pitch = doc('pitches/pt_tata')
    check(pitch['nextDate'] == '2026-10-12' and pitch['nextBy'] == 'fu', 'the bridge moved with it: %r' % pitch.get('nextDate'))
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call so far')

    # ---- compaction and the month overflow ----
    gone = {('ppgone%03d' % i): {'cid': '', 'who': 'Old %d' % i, 'org': '', 'pi': [], 'st': 'done', 'gone': NOW - 90 * DAY, 'last': {'at': NOW - 100 * DAY, 'k': 'note'}, 'mo': [], 'at': NOW - 100 * DAY, 'up': NOW - 90 * DAY} for i in range(101)}
    ix['people'].update(gone)
    h.seed_doc(p, IX % F, ix)
    p.wait_for_timeout(400)
    did = p.evaluate('async () => { const r = await M.prospects.compact(M.lastCtx); await new Promise(x => setTimeout(x, 400)); return r; }')
    ix2 = doc(IX % F)
    check(did is True and len(ix2['people']) == 1 and r['pid'] in ix2['people'] and ix2.get('v') == 1 and len(ix2['fu']) == 2, 'compaction drops the gone people in one rewrite: %r' % (sorted(ix2['people']), ))
    big = {'t': {('ttbig%04d' % i): {'p': '', 'pi': '', 'k': 'note', 'x': 'x' * 600, 'at': NOW - 3 * DAY} for i in range(380)}}
    h.seed_doc(p, MONTH % F, big)
    p.wait_for_timeout(400)
    size = p.evaluate('k => JSON.stringify(window.__db.get(k)).length', MONTH % F)
    t = p.evaluate('async () => { const r = await M.prospects.logTouch(M.lastCtx, {p: "", pi: "", k: "note", x: "overflow", at: Date.now()}); await new Promise(x => setTimeout(x, 300)); return r; }')
    check(size > 200000 and t['path'] == MONTH % F + '-2' and (doc(MONTH % F + '-2') or {}).get('t', {}).get(t['tid'], {}).get('x') == 'overflow', 'past 200 KB a touch goes to the -2 doc: %r' % t)

    # ---- a preview reads nothing and writes nothing ----
    pv = p.evaluate('''async () => { M.viewAs.set("u_m1"); await new Promise(r => setTimeout(r, 600)); const c = M.lastCtx;
      const n0 = window.__dbWrites.length;
      let err = ''; try { await M.prospects.apply(c, M.prospects.read("Spoke to Anil at Titan, follow up next week", c), {}, {}); } catch (e) { err = String(e.message || e); }
      await new Promise(r => setTimeout(r, 300));
      const out = {viewAs: c.viewAs, data: c.priv.prospects.data, people: Object.keys(M.prospects.data(c).people).length, day: M.prospects.day(c).counts, search: M.prospects.searchRows(c, "rahul").length, inbox: M.prospects.inboxItems(c).length, err, wrote: window.__dbWrites.length - n0};
      M.viewAs.set(null); await new Promise(r => setTimeout(r, 400)); return out; }''')
    check(pv['viewAs'] == M1 and pv['data'] is None and pv['people'] == 0 and pv['day'] == {'late': 0, 'today': 0, 'meetings': 0} and pv['search'] == 0 and pv['inbox'] == 0, 'a preview sees no prospects: %r' % pv)
    check(pv['err'] == 'Prospects are private to each person.' and pv['wrote'] == 0, 'a preview writes nothing: %r' % pv)

    # ---- a member loads their own index, no owner gate; a send sets a check-back; a reply closes it ----
    be('m1')
    m = p.evaluate('''async () => { const c = M.lastCtx; const ready = c.priv.prospects.ready;
      const res = await M.prospects.apply(c, M.prospects.read("Sent the Swisse proposal v2 to Meera", c), {}, {}); await new Promise(x => setTimeout(x, 500));
      return {ready, isOwner: c.isOwner, say: res.say, fid: res.fid, pid: res.pid, sid: res.sid, pitch: res.pitch, bridged: res.bridged}; }''')
    check(m['ready'] and not m['isOwner'], 'a member loads the index with no owner gate: %r' % m)
    ix = doc(IX % M1)
    fu = ix['fu'][m['fid']]
    person = ix['people'][m['pid']]
    check(person['cid'] == 'c_meera' and person['oid'] == 'o2' and person['who'] == 'Meera Shah' and person['org'] == 'Swisse Wellness UAE' and person['role'] == 'Brand head', 'the Base person links by id, with display caches only: %r' % person)
    check(fu['src'] == 'sent' and fu['sid'] == m['sid'] and fu['d'] == '2026-10-10' and fu['x'] == 'Check Meera Shah saw the proposal v2' and fu['pi'] == 'pt_swisse' and fu['mirror']['nextDate'] == '2026-10-10', 'the auto check-back after a proposal, 5 working days on: %r' % fu)
    sw = doc('pitches/pt_swisse')
    check(sw['sent'][m['sid']]['to'] == 'c_meera' and sw['sent'][m['sid']]['by'] == M1 and sw['nextDate'] == '2026-10-10' and sw['nextBy'] == 'fu', 'the owner bridges and the send names the Base id: %r' % {k: sw.get(k) for k in ('nextDate', 'nextBy')})
    check(m['say'].startswith('Logged. Sent the proposal v2 to Meera Shah at Swisse Wellness UAE. I will remind you to check on Sat 10 Oct.'), 'the member receipt: %r' % m['say'])
    rp = p.evaluate('''async () => { const c = M.lastCtx; const res = await M.prospects.apply(c, M.prospects.read("Swisse replied", c), {}, {}); await new Promise(x => setTimeout(x, 500)); return {say: res.say, pitch: res.pitch}; }''')
    ix = doc(IX % M1)
    sw = doc('pitches/pt_swisse')
    check(rp['say'] == 'Logged. Swisse replied.' and ix['fu'][m['fid']]['done']['how'] == 'replied', 'a reply closes the check-back: %r' % ix['fu'][m['fid']].get('done'))
    check(sw['sent'][m['sid']]['reply'] == 'replied' and sw['sent'][m['sid']]['replyAt'] == NOW and sw['nextDate'] == '' and sw['nextBy'] == '', 'the send row is marked and the mirrored date cleared: %r' % {k: sw.get(k) for k in ('nextDate', 'next', 'nextBy')})

    # ---- the bridge: only the owner or the founder ----
    nb = p.evaluate('''async () => { const c = M.lastCtx; const res = await M.prospects.apply(c, M.prospects.read("Spoke to Priya at Nykaa, follow up next week", c), {}, {}); await new Promise(x => setTimeout(x, 400)); return {say: res.say, bridged: res.bridged, fid: res.fid}; }''')
    ny = doc('pitches/pt_nykaa')
    check(not nb['bridged'] and 'owns the Nykaa pitch. Your date stays with you.' in nb['say'] and ny['nextDate'] == '' and not ny.get('nextBy'), 'a non-owner gets no bridge and the receipt says so: %r' % nb['say'])
    check('done' not in doc(IX % M1)['fu'][nb['fid']], 'the private follow-up still stands')
    be('founder')
    fb = p.evaluate('''async () => { const c = M.lastCtx; const res = await M.prospects.apply(c, M.prospects.read("Called Priya at Nykaa, chase her next Tuesday", c), {}, {}); await new Promise(x => setTimeout(x, 400)); return {say: res.say, bridged: res.bridged, fid: res.fid}; }''')
    ny = doc('pitches/pt_nykaa')
    check(fb['bridged'] and ny['nextDate'] == '2026-10-13' and ny['nextBy'] == 'fu' and 'Nykaa next step: Tue 13 Oct.' in fb['say'], 'the founder bridges on any pitch: %r' % fb['say'])
    # the safe clear: a date changed by hand since stays
    h.seed_doc(p, 'pitches/pt_nykaa', {**ny, 'nextDate': '2026-10-20', 'updated': NOW})
    p.wait_for_timeout(400)
    d = p.evaluate('async fid => { const r = await M.prospects.done(M.lastCtx, fid, "done"); await new Promise(x => setTimeout(x, 400)); return r; }', fb['fid'])
    ny = doc('pitches/pt_nykaa')
    ix = doc(IX % F)
    check(d and d['fid'] == fb['fid'] and ix['fu'][fb['fid']]['done']['how'] == 'done' and ny['nextDate'] == '2026-10-20', 'done leaves a hand-set date alone: %r' % ny.get('nextDate'))
    both = list((doc(MONTH % F) or {}).get('t', {}).values()) + list((doc(MONTH % F + '-2') or {}).get('t', {}).values())
    done_touch = [t for t in both if t.get('k') == 'done']
    check(len(done_touch) == 1 and done_touch[0]['pi'] == 'pt_nykaa', 'done logs a touch (in the overflow doc, since the month is full): %r' % done_touch)
    check(p.evaluate('() => window.__sampleCalls.length') == 0, 'no model call at all')
    errs = [e for e in h.errors() if 'favicon' not in e[1]]
    check(not errs, 'no console errors: %r' % errs[:3])
    print('test_prospects_store: %d checks passed' % len(checks))


run(test)
