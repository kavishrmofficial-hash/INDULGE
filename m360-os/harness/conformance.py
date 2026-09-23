#!/usr/bin/env python3
"""Static conformance checks against BRIEF sections 2, 3, 4, 5 and 12.
Reads the built page and the sources. Reports every violation it finds."""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
PAGE = open(os.path.join(ROOT, 'dist', 'index.html'), encoding='utf-8').read()
JS_FILES = sorted(f for f in os.listdir(os.path.join(SRC, 'js')) if f.endswith('.js'))
JS = {f: open(os.path.join(SRC, 'js', f), encoding='utf-8').read() for f in JS_FILES}
CSS = open(os.path.join(SRC, 'css.css'), encoding='utf-8').read()
_cssdir = os.path.join(SRC, 'css')
if os.path.isdir(_cssdir):
    for _f in sorted(os.listdir(_cssdir)):
        if _f.endswith('.css'):
            CSS += '\n' + open(os.path.join(_cssdir, _f), encoding='utf-8').read()
ALL_JS = '\n'.join(JS.values())

problems = []


def bad(msg):
    problems.append(msg)


# ---- section 2: copy rules ----
for ch, name in (('—', 'em dash'), ('–', 'en dash')):
    for f, s in list(JS.items()) + [('css.css', CSS)]:
        if ch in s:
            i = s.index(ch)
            bad('%s in %s: %r' % (name, f, s[max(0, i - 60):i + 30]))

# contrast constructions in user-visible strings
CONTRAST = [r'\brather than\b', r'\binstead of\b', r'\bnot\s+[A-Za-z]+,\s*but\b']
STRINGS = re.compile(r"'([^'\\\n]{12,})'|\"([^\"\\\n]{12,})\"|>([A-Z][^<>{}\n]{14,})<")
# a candidate is prose only when it has no JavaScript in it
CODEY = ('!==', '===', '&&', '||', '=>', '${', '?', '(', ')', '{', '}', ';', '==', '<', '>')
for f, s in JS.items():
    for m in STRINGS.finditer(s):
        text = (m.group(1) or m.group(2) or m.group(3) or '').strip()
        if text.startswith(('http', 'data:', 'M.', 'https')) or '/' in text[:12]:
            continue
        if any(c in text for c in CODEY) or ' ' not in text or not text[0].isalpha():
            continue
        for pat in CONTRAST:
            if re.search(pat, text, re.I):
                bad('contrast construction in %s: %r' % (f, text))
        if '!' in text and 'https' not in text:
            bad('exclamation mark in %s: %r' % (f, text))

# ---- section 3: design system ----
COLOUR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(green|blue|yellow|purple|teal|orange)\b', re.I)
ALLOWED_HEX = {'#FFFFFF', '#F7F6F2', '#EFEDE7', '#0A0A0A', '#0E0E0E', '#F53901', '#000', '#fff',
               '#121212', '#181817', '#222220', '#050505', '#F2F1EC',  # the night palette: the same grounds, inverted
               '#d93100', '#000000', '#ffffff', '#BBBBBB', '#EFEDE7'}
for m in COLOUR.finditer(CSS):
    tok = m.group(0)
    if tok.lower() in ('green', 'blue', 'yellow', 'purple', 'teal', 'orange'):
        bad('forbidden colour word in css: %s' % tok)
    if tok.startswith('#') and tok not in ALLOWED_HEX and tok.upper() not in ALLOWED_HEX:
        bad('unexpected hex in css: %s' % tok)
for f, s in JS.items():
    for m in re.finditer(r'#[0-9a-fA-F]{6}\b', s):
        if m.group(0) not in ALLOWED_HEX and m.group(0).upper() not in ALLOWED_HEX:
            bad('unexpected hex in %s: %s' % (f, m.group(0)))

TOKENS = {'--paper': '#FFFFFF', '--warm': '#F7F6F2', '--col': '#EFEDE7', '--dark': '#0A0A0A',
          '--ink': '#0E0E0E', '--ink62': 'rgba(14,14,14,.62)', '--micro': 'rgba(14,14,14,.64)',
          '--line': 'rgba(14,14,14,.10)', '--line2': 'rgba(14,14,14,.18)', '--flame': '#F53901'}
for name, value in TOKENS.items():
    if not re.search(re.escape(name) + r'\s*:\s*' + re.escape(value), CSS):
        bad('design token missing or changed: %s should be %s' % (name, value))

for want in ('border-radius:999px', 'Space Grotesk'):
    if want not in CSS:
        bad('css is missing %s' % want)
if 'font-size:15px' not in CSS.replace(' ', ''):
    bad('body font size is not 15px')

# no blocking dialogs anywhere
for f, s in JS.items():
    for m in re.finditer(r'(?<![\w.$])(alert|confirm|prompt)\s*\(', s):
        bad('blocking dialog %s( in %s' % (m.group(1), f))

# user text is never injected as HTML, except the mark and the icon paths in core UI
for f, s in JS.items():
    for m in re.finditer(r'dangerouslySetInnerHTML', s):
        if f != '01-ui.js':
            bad('dangerouslySetInnerHTML outside the icon and mark helpers: %s' % f)

# ---- section 4 and 5: capabilities and database rules ----
caps = json.load(open(os.path.join(ROOT, 'capabilities.json'), encoding='utf-8'))
brief = open(os.path.join(ROOT, 'BRIEF.md'), encoding='utf-8').read()
block = brief.split('Access rules to declare exactly, as `capabilities.db.rules`:', 1)[1]
block = block.split('```json', 1)[1].split('```', 1)[0]
want_rules = json.loads(block)
# v2 adds one per-person collection: me/<uid> holds today's status
want_rules += [{"path": "me", "read": "interact", "write": "admin"}, {"path": "me/{self}", "write": "interact"}]
want_rules += [{"path": "join", "read": "admin", "write": "admin"}, {"path": "join/{self}", "read": "interact", "write": "interact"}]
if caps['db']['rules'] != want_rules:
    bad('capabilities.db.rules do not match BRIEF section 5 plus the me and join rules')
for k in ('sample', 'room'):
    if caps.get(k) != {}:
        bad('capability %s is not declared' % k)
# the brand: Space Grotesk only, no emoji in the app's own interface copy
if 'Bricolage' in PAGE:
    bad('a second font family is embedded')
EMO = re.compile('[\U0001F300-\U0001FAFF\u2600-\u26FF\u2700-\u27BF]')
for f in ('03-shell.js', '04-ai.js', '50-home.js', '51-sections.js', '55-hq.js', '57-ask.js', '58-buddy.js'):
    for m in EMO.finditer(JS[f]):
        if m.group(0) in '\u2713\u2726\u2303\u2325':
            continue
        bad('emoji %r in %s' % (m.group(0), f))
# this workspace refuses the email scope, so the app declares profile only and shows no addresses
if caps.get('user', {}).get('scopes') != ['profile']:
    bad('user scopes are not profile')
for f, s_ in JS.items():
    if re.search(r'\.email\b', s_) and f != '00-core.js':
        bad('email field rendered in %s' % f)
if caps.get('downloads') is not True:
    bad('downloads is not declared')
servers = {s['server']: s['tools'] for s in caps.get('mcp', {}).get('servers', [])}
for srv, tool in (('Google Calendar', 'list_events'), ('Gmail', 'search_threads'),
                  ('Google Drive', 'list_recent_files')):
    if servers.get(srv) != [tool]:
        bad('mcp manifest entry wrong for %s' % srv)
if 'permissions' in caps:
    bad('permissions must never be declared')

# ---- database discipline ----
if 'pruneDays' not in ALL_JS or 'pruneWeeks' not in ALL_JS:
    bad('rolling documents are never pruned')
# names, emails and avatars are never written to the database
for f, s in JS.items():
    for m in re.finditer(r'W\.(set|update|merge)\([^)]{0,400}?(\bname:\s*(?!.*(client|project|section|brand|title))|avatarUrl|\bemail:)', s, re.S):
        bad('possible profile field written to the database in %s: %r' % (f, m.group(0)[:90]))

# ---- section 4: routes ----
ROUTES = ['command', 'today', 'tasks', 'projects', 'pitches', 'clients', 'feed', 'week', 'scores',
          'people', 'hiring', 'handbook', 'voice', 'leave', 'desk']
shell = JS['03-shell.js']
for r in ROUTES:
    if "'" + r + "'" not in shell:
        bad('route missing from the shell: #%s' % r)

# ---- section 12: no credentials anywhere ----
for f, s in JS.items():
    for word in ('password', 'passcode', 'secret', 'apiKey', 'api_key'):
        for m in re.finditer(word, s, re.I):
            line = s[max(0, m.start() - 90):m.start() + 90]
            if 'Never passwords' in line or 'never passwords' in line.lower():
                continue
            bad('credential wording in %s: %r' % (f, line.strip()[:110]))

# ---- built page ----
if PAGE.count('<script src=') != 3:
    bad('expected exactly three CDN script tags, found %d' % PAGE.count('<script src='))
for url in ('react/18.3.1/umd/react.production.min.js', 'react-dom/18.3.1/umd/react-dom.production.min.js',
            'htm@3.1.1/dist/htm.umd.js'):
    if url not in PAGE:
        bad('pinned library missing from the page: %s' % url)
if 'https://fonts.' in PAGE or 'fetch(' in PAGE:
    bad('the page makes a network request beyond the three libraries')
if '<title>m360 OS</title>' not in PAGE:
    bad('page title is not m360 OS')
if 'viewport-fit=cover' not in PAGE:
    bad('viewport meta is missing viewport-fit=cover')
if PAGE.count('@font-face') != 2:  # Space Grotesk latin plus the rupee subset
    bad('expected two embedded font faces')
if 'U+20B9' not in PAGE:
    bad('the rupee subset unicode-range is missing')
if 'harness' in PAGE or '__db' in PAGE or 'mock.js' in PAGE:
    bad('harness code leaked into the built page')

if __name__ == '__main__':
    if problems:
        print('CONFORMANCE PROBLEMS (%d):' % len(problems))
        for p in problems:
            print(' -', p)
        sys.exit(1)
    print('conformance ok (%d js files, %d bytes)' % (len(JS_FILES), len(PAGE)))
