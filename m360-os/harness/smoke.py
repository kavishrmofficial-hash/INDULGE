#!/usr/bin/env python3
"""Smoke check: every page at 390, 768 and 1280 wide, as founder and member.
Fails on console errors, page-level horizontal overflow, or text under 11px."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run  # noqa: E402

PAGES = ['#today', '#tasks', '#projects', '#pitches', '#clients', '#feed', '#week', '#scores', '#people',
         '#hiring', '#handbook', '#voice', '#leave', '#command', '#desk']


def smoke(h):
    problems = []
    first = True
    for ident in ('founder', 'm1'):
        for w in (1280, 768, 390):
            for hsh in PAGES:
                if ident == 'm1' and hsh in ('#command', '#desk'):
                    continue
                page = h.open(ident, width=w, hash=hsh, reset=first, seed=True)
                first = False
                page.wait_for_timeout(250)
                ov = h.overflow(page)
                if ov > 0:
                    problems.append('%s %s %dpx overflow %dpx' % (ident, hsh, w, ov))
                st = h.small_text(page)
                if st:
                    problems.append('%s %s %dpx small text %r' % (ident, hsh, w, st[:3]))
                if w == 1280:
                    h.shot(page, '%s-%s' % (ident, hsh.strip('#').replace('/', '_')))
                page.context.close()
    errs = h.errors()
    for e in errs:
        problems.append('console %s: %s' % e)
    return problems


if __name__ == '__main__':
    probs = run(smoke)
    if probs:
        print('SMOKE PROBLEMS (%d):' % len(probs))
        for p in probs:
            print(' -', p)
        sys.exit(1)
    print('smoke ok')
