#!/usr/bin/env python3
"""Smoke check: every page at 390, 768 and 1280 wide, as founder and member.
Fails on console errors, page-level horizontal overflow, or text under 11px."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run  # noqa: E402

PAGES = ['#today', '#tasks', '#projects', '#pitches', '#clients', '#feed', '#week', '#scores', '#people',
         '#hiring', '#handbook', '#voice', '#leave', '#command', '#desk']


SMALL = """() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.textContent || !el.textContent.trim() || el.closest('.tabbar')) continue;
    if (!['DIV','SPAN','P','H1','H2','H3','LABEL','BUTTON','TD','TH','A','LI','SMALL','I','B','STRONG','INPUT','TEXTAREA','SELECT','OPTION'].includes(el.tagName)) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 11) out.push([el.tagName, fs, el.textContent.trim().slice(0, 40)]);
  }
  return out.slice(0, 20);
}"""


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
                # v40: the phone tab bar's labels are 10px in the design (design/m360-os-v7.html .tab); they are the
                # one place text runs under 11px, so the check leaves the tab bar out and reads only what is drawn
                st = [x for x in page.evaluate(SMALL) if x]
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
