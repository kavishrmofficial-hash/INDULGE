"""Prints the lines of a saved documentation page that mention a limit, for the api-check workflow."""
import re, html, sys
s = open(sys.argv[1], encoding='utf-8', errors='replace').read()
s = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', '', s)
t = html.unescape(re.sub(r'<[^>]+>', ' ', s))
t = re.sub(r'[ \t]+', ' ', t)
t = re.sub(r'\n\s*\n+', '\n', t)
for line in t.split('\n'):
    l = line.strip()
    if re.search(r'(?i)timeout|time out|\bMB\b|\bKB\b|seconds|\d+\s*s\b|size|memory|502|504|Bad Gateway|concurren|exceed', l) and len(l) < 400:
        print(' ', l)
