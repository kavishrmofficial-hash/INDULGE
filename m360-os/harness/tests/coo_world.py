"""The COO planner's world for the v33 tests (test_coo_plan.py, test_coo_parity.py): one plain state in the
shape M.coo.plan.stateOf builds on the page and coo.js builds on the server, plus small variants of it.

The day is a working Tuesday next week, in IST. Kaavish founds; Durvesh (m1), Aanya (m2) and Neel (m6) are
in Pod 1, Ishaan (m3), Ekta (m4) and Sana (m5) in Pod 2; Sana is in probation. The leave policy is set
(12 casual, 12 sick, 5 other a year from 1 April, 2 days alone, notice 3, 0 and 7, 2 out a day, 1 a pod).
Nothing here is a key, a password or anything private: names are made up.
"""
import copy
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo('Asia/Kolkata')
F, M1, M2, M3, M4, M5, M6 = 'u_f', 'u_m1', 'u_m2', 'u_m3', 'u_m4', 'u_m5', 'u_m6'
BOT = 'u_m360coo'


def tuesday():
    real = datetime.now(IST)
    return (real + timedelta(days=(1 - real.weekday()) % 7 + 7)).date()


TUE = tuesday()


def ymd(d=0, base=None):
    return ((base or TUE) + timedelta(days=d)).isoformat()


def ms(hh, mm, d=0, base=None):
    b = (base or TUE) + timedelta(days=d)
    return int(datetime(b.year, b.month, b.day, hh, mm, tzinfo=IST).timestamp() * 1000)


def member(role='member', pod='', **k):
    m = {'role': role, 'active': True, 'pod': pod, 'joined': '2025-01-06', 'start': '', 'probationEnd': '', 'reportsTo': ''}
    m.update(k)
    return m


def task(owner, due='', status='todo', priority='normal', **k):
    t = {'title': 'Task', 'owner': owner, 'by': F, 'due': due, 'status': status, 'priority': priority, 'client': '', 'project': '',
         'created': ms(9, 0, -10), 'updated': ms(9, 0, -10), 'deleted': False}
    t.update(k)
    return t


POLICY = {'yearStart': '04-01', 'perType': {'casual': 12, 'sick': 12, 'other': 5}, 'maxAutoDays': 2,
          'noticeDays': {'casual': 3, 'sick': 0, 'other': 7}, 'probationLop': False, 'maxOutPerDay': 2, 'maxOutPerPod': 1, 'blackout': []}


def cfg(defaults, **over):
    """settings.coo deep-merged on the defaults, the way M.coo.cfg reads it"""
    c = copy.deepcopy(defaults)
    c['on'] = True
    c['leave'] = copy.deepcopy(POLICY)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(c.get(k), dict):
            c[k].update(v)
        else:
            c[k] = v
    return c


def state(defaults, now=None, **over):
    now = now or ms(11, 0)
    today = datetime.fromtimestamp(now / 1000, IST).date().isoformat()
    s = {
        'now': now, 'today': today, 'cfg': cfg(defaults), 'founder': F,
        'rungs': {k: v for k, v in defaults['caps'].items()},
        'members': {F: member('founder'), M1: member(pod='Pod 1'), M2: member(pod='Pod 1'), M6: member(pod='Pod 1'),
                    M3: member(pod='Pod 2'), M4: member(pod='Pod 2'), M5: member(pod='Pod 2', probationEnd=ymd(60))},
        'holidays': [], 'settings': {'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'wfhCap': 2, 'mondayCut': '12:00'},
        'tasks': {}, 'projects': {}, 'pitches': {}, 'clients': {}, 'leave': {}, 'leavedec': {}, 'checkin': {},
        'holds': {}, 'seen': {}, 'acts': [],
        'slots': {'holidays': [], 'rollAt': ['10:45'], 'eodCut': '19:30', 'memoDay': 'sat'}
    }
    for k, v in over.items():
        s[k] = v
    return s


def approve(s, uid, rid, frm, to, typ='casual', at=None):
    s['leave'].setdefault(uid, []).append({'id': rid, 'from': frm, 'to': to, 'type': typ, 'at': at or ms(9, 0, -20)})
    s['leavedec'].setdefault(uid, {})[rid] = {'status': 'approved', 'at': ms(10, 0, -19), 'by': F}


def ask(s, uid, rid, frm, to, typ='casual', at=None):
    s['leave'].setdefault(uid, []).append({'id': rid, 'from': frm, 'to': to, 'type': typ, 'at': at or ms(9, 0, -1)})


def busy_world(defaults):
    """the load, cover and rebalance world: Durvesh carries far too much, Aanya and Neel little, Ishaan is
    away tomorrow, Ekta is on a hold, a client project and an internal one"""
    s = state(defaults)
    s['projects'] = {'p_int': {'name': 'Studio site', 'kind': 'internal', 'owner': M2, 'members': [M1, M2, M3, M4, M5, M6], 'due': ymd(20), 'status': 'on'},
                     'p_cl': {'name': 'Swisse launch', 'kind': 'client', 'owner': M1, 'members': [M1, M2], 'due': ymd(9), 'status': 'on'}}
    t = {}
    for i in range(9):
        t['t_d%d' % i] = task(M1, due=ymd(10 + i), priority='low' if i < 3 else 'normal', project='p_int', title='Studio page %d' % i)
    t['t_over'] = task(M1, due=ymd(-3), priority='normal', project='p_int', title='Old banner')
    t['t_cl'] = task(M1, due=ymd(2), priority='low', project='p_cl', title='Swisse reel')
    t['t_kind'] = task(M1, due=ymd(3), priority='low', dueKind='client', title='Client deck')
    t['t_rev'] = task(M1, due=ymd(1), status='review', priority='low', project='p_int', title='Review me', reviewAt=ms(9, 0, -2))
    t['t_done'] = task(M1, due=ymd(1), status='done', priority='low', project='p_int', title='Shipped')
    t['t_doing'] = task(M1, due=ymd(4), status='doing', priority='low', project='p_int', title='Fresh doing', updated=ms(10, 0))
    t['t_a'] = task(M2, due=ymd(5), project='p_int', title='Aanya one')
    t['t_n'] = task(M6, due=ymd(6), priority='low', project='p_int', title='Neel one')
    t['t_e'] = task(M4, due=ymd(6), priority='low', project='p_int', title='Ekta one')
    for u, n in ((M3, 'i'), (M5, 's')):
        t['t_%s1' % n] = task(u, due=ymd(12), title='Pod 2 one')
        t['t_%s2' % n] = task(u, due=ymd(13), title='Pod 2 two')
    s['tasks'] = t
    approve(s, M3, 'Li', ymd(1), ymd(1))
    s['holds'] = {'uid:' + M4: ms(9, 0, 5)}
    return s


def cover_world(defaults):
    """Durvesh's approved leave next Tuesday: his work due inside it and the day after"""
    s = state(defaults)
    s['projects'] = {'p_int': {'name': 'Studio site', 'kind': 'internal', 'owner': M2, 'members': [M1, M2, M6], 'due': ymd(30), 'status': 'on'}}
    lv = ymd(7)
    s['tasks'] = {
        't1': task(M1, due=lv, project='p_int', title='Internal one'),
        't2': task(M1, due=lv, client='cl_sw', title='Client one'),
        't3': task(M1, due=lv, status='review', project='p_int', title='In review'),
        't4': task(M1, due=lv, status='done', project='p_int', title='Done one'),
        't5': task(M1, due=ymd(8), status='doing', priority='low', project='p_int', title='Day after'),
        't6': task(M1, due=lv, priority='high', project='p_int', title='Internal two'),
    }
    for u in (M3, M4, M5):
        s['tasks']['t_%s_1' % u] = task(u, due=ymd(20), title='Pod 2 one')
        s['tasks']['t_%s_2' % u] = task(u, due=ymd(21), title='Pod 2 two')
    s['leave'] = {M1: [{'id': 'R1', 'from': lv, 'to': lv, 'type': 'casual', 'at': ms(9, 0, -1)}]}
    s['leavedec'] = {M1: {'R1': {'status': 'approved', 'at': ms(10, 0), 'by': BOT, 'snap': {'from': lv, 'to': lv, 'type': 'casual', 'days': 1}}}}
    return s
