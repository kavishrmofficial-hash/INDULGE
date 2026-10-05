#!/usr/bin/env python3
"""v33 test: the COO's heartbeat, .github/workflows/coo-tick.yml (spec part M, founder decisions 1 and 2).

The workflow wakes the team site every 15 minutes from 09:00 to 21:00 IST, Monday to Saturday, with the
21:00 close on a cron of its own. Cron is UTC, so the four lines are 03:30 and 03:45, every quarter from
04:00 to 14:45, 15:00 and 15:15, and 15:30 for the close: 49 wakes a day. Checks:
- the four cron lines, minute and hour, and the day-of-week 1-6 on every one (Sundays run on page traffic);
- every wake lands on a quarter between 09:00 and 21:00 IST, none twice, 09:00 and 21:00 included;
- the close label reads the close cron exactly as it is written;
- it POSTs {"a":"tick"} as application/json to /api/m360, retries once, and fails the run only after two
  answers without "ok":true;
- permissions {} (no token at all), the concurrency group coo-tick that never cancels a run in flight, a
  workflow_dispatch with the site as an input, and a 3 minute timeout;
- no key, password or secret in the file.

Run: cd m360-os && python3 harness/tests/test_coo_heartbeat.py
"""
import os
import re

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YML = os.environ.get('COO_TICK_YML') or os.path.join(os.path.dirname(ROOT), '.github', 'workflows', 'coo-tick.yml')
CRONS = [('30,45', '3'), ('0,15,30,45', '4-14'), ('0,15', '15'), ('30', '15')]


def expand(field, lo, hi):
    out = set()
    for part in field.split(','):
        if part == '*':
            out.update(range(lo, hi + 1))
        elif '-' in part:
            a, b = part.split('-')
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    return out


def test():
    checks = []

    def check(cond, msg):
        if not cond:
            raise AssertionError(msg)
        checks.append(msg)

    check(os.path.exists(YML), 'the workflow is at .github/workflows/coo-tick.yml: %s' % YML)
    text = open(YML, encoding='utf-8').read()
    doc = yaml.safe_load(text)
    on = doc.get('on', doc.get(True))
    check(doc.get('name') == 'coo-tick' and isinstance(on, dict), 'it is named coo-tick and has its triggers')
    crons = [c['cron'] for c in on.get('schedule') or []]
    check(len(crons) == 4, 'four cron lines: %r' % crons)
    parts = [c.split() for c in crons]
    check(all(len(p) == 5 for p in parts), 'five fields each: %r' % crons)
    check([(p[0], p[1]) for p in parts] == CRONS, 'minute and hour in UTC, as part M: %r' % crons)
    check(all(p[2] == '*' and p[3] == '*' for p in parts), 'every day of every month: %r' % crons)
    check(all(p[4] == '1-6' for p in parts), 'Monday to Saturday only, day-of-week 1-6 (founder decisions 2): %r' % crons)

    # every wake, in IST minutes past midnight
    wakes = []
    for p in parts:
        for hh in sorted(expand(p[1], 0, 23)):
            for mm in sorted(expand(p[0], 0, 59)):
                wakes.append((hh * 60 + mm + 330) % 1440)
    check(len(wakes) == len(set(wakes)), 'no quarter fires twice: %r' % sorted(wakes))
    check(sorted(wakes) == list(range(9 * 60, 21 * 60 + 1, 15)), 'every quarter from 09:00 to 21:00 IST: %r' % sorted(wakes)[:5])
    check(len(wakes) == 49, '49 wakes a day, as HOSTING.md says: %d' % len(wakes))

    close = crons[3]
    m = re.search(r"github\.event\.schedule == '([^']+)'", text)
    check(m and m.group(1) == close, 'the close label reads the close cron exactly: %r against %r' % (m and m.group(1), close))

    disp = on.get('workflow_dispatch') or {}
    check('site' in ((disp.get('inputs') or {})), 'it can be run by hand, with the site as an input')
    check(doc.get('permissions') == {}, 'permissions {}: no token: %r' % doc.get('permissions'))
    conc = doc.get('concurrency') or {}
    check(conc.get('group') == 'coo-tick' and conc.get('cancel-in-progress') is False, 'one tick at a time, none cancelled: %r' % conc)
    job = (doc.get('jobs') or {}).get('tick') or {}
    check(job.get('timeout-minutes') == 3 and job.get('runs-on') == 'ubuntu-latest', 'a 3 minute job: %r' % {k: job.get(k) for k in ('runs-on', 'timeout-minutes')})
    step = ' '.join(s.get('run', '') for s in job.get('steps') or [])
    check("-X POST" in step and '/api/m360' in step and "-d '{\"a\":\"tick\"}'" in step and "content-type: application/json" in step, 'it POSTs {"a":"tick"} as JSON to /api/m360')
    check('for i in 1 2' in step and '"ok":true' in step and 'exit 1' in step, 'one retry, and a failed run only after two answers without ok')
    check(not re.search(r'secret|password|api[_-]?key|token:', text, re.I), 'no key, password or secret in the file')
    return checks


if __name__ == '__main__':
    out = test()
    for c in out:
        print('ok', c)
    print('PASS', len(out), 'checks')
