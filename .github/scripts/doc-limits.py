"""Prints the lines of a saved documentation page that mention a limit, for the api-check workflow.
The docs site renders in the browser, so the text also hides inside script tags as JSON: those are read too."""
import re, html, sys
s = open(sys.argv[1], encoding='utf-8', errors='replace').read()
print('  bytes', len(s), 'scripts', s.count('<script'))
t = html.unescape(re.sub(r'<[^>]+>', '\n', s))
t = t.replace('\\n', '\n').replace('\\"', '"').replace('\\u003c', '<').replace('\\u003e', '>')
t = re.sub(r'[ \t]+', ' ', t)
seen = set()
for line in t.split('\n'):
    l = line.strip()
    if len(l) > 600 or l in seen: continue
    if re.search(r'(?i)timeout|time out|\bMB\b|\bKB\b|seconds|\d+\s*s\b|\bsize\b|memory|\b502\b|\b504\b|Bad Gateway|concurren|exceed', l):
        seen.add(l); print(' ', l[:400])
