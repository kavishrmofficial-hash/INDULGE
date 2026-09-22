#!/usr/bin/env python3
"""Generate seed/seed.json from BRIEF.md section 13, verbatim.

The same JSON seeds the local harness and the published artifact's database.
"""
import json
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
brief = open(os.path.join(ROOT, 'BRIEF.md'), encoding='utf-8').read()

sec = brief.split('## 13. Seed data', 1)[1].split('## 14.', 1)[0]
pat = re.compile(r'\*\*handbook/([a-z\-]+)\*\* \(order (\d+), title "([^"]+)"\)\s*\n\s*```\n(.*?)\n```', re.S)
now = int(time.time() * 1000)

RULES = {('R%02d' % i): True for i in range(1, 17)}
POINTS = {'checkinOnTime': 2, 'eod': 2, 'planOnTime': 4, 'planLate': 1, 'outcomeHit': 12, 'outcomeMiss': -6,
          'taskOnTime': 6, 'taskLate': 2, 'revision': -2, 'shown20': 2, 'qualityMult': 4, 'kudos': 3,
          'rockDone': 20, 'overdueOpen': -2}

seed = {
    'settings/app': {
        'office': None, 'start': '10:30', 'grace': 15, 'eodCut': '19:30', 'mondayCut': '12:00',
        'wfhCap': 2, 'revCap': 2, 'ackHours': 48, 'blockerDays': 2, 'holidays': [],
        'rules': RULES, 'points': POINTS, 'leaderboardIncludesFounder': False, 'updated': now
    },
    'clients/swisse-wellness-uae': {
        'name': 'Swisse Wellness UAE', 'status': 'live', 'pod': 'Pod 1', 'owner': '',
        'memory': '30 reel shoot with Blah Studio as the production partner, run day to day with Durvesh.',
        'approvals': '', 'never': '', 'links': '', 'updated': now, 'by': ''
    }
}
count = 0
for m in pat.finditer(sec):
    sid, order, title, body = m.groups()
    seed['handbook/' + sid] = {'title': title, 'body': body.strip('\n'), 'order': int(order), 'updated': now}
    count += 1
assert count == 10, 'expected 10 handbook sections, found %d' % count
for k, v in seed.items():
    s = json.dumps(v, ensure_ascii=False)
    assert '—' not in s and '–' not in s, 'dash in seed ' + k

out = os.path.join(ROOT, 'seed', 'seed.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)
print('wrote', out, 'with', len(seed), 'documents')
