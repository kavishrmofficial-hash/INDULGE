#!/usr/bin/env python3
"""v35 test: the 3D office's contract, read from the sources and both builds (spec parts H, N and O, checks of
part M). No browser.

- src/vendor/three.vendor.js carries the r186 header and no fetch(, import(, eval(, new Function or blocking
  dialog, inside its budget (640 KB minified, 170 KB gzip); fx/three-entry.js imports by name (never
  `import * as`) and exports what the office reads, with no loader;
- the artifact page (dist/index.html) holds 'window.M360_3D = function' exactly once, three script tags, no
  fetch(, at most 4.4 MB raw and 1.25 MB gzip. MB here is 1024 x 1024 bytes, as build.py's own 16 MB guard counts;
- the team site page (edgeone/public/index.html) holds none of the bundle and names vendor/three.<sha8>.js with
  its sha384 in the build stamp script, a script the Content-Security-Policy names by its hash; the file is the
  same window.M360_3D function, and edgeone.json gains exactly one immutable entry for it (O4), every other
  entry keeping its headers (only the page's CSP follows the page);
- the page loads three with createElement, never the literal script tag, never fetch( or import(;
- M.office, M.office3d, M.cast, M.figure and M.officeLive export every name of section N;
- no src/js file destructures M.office, M.office3d, M.cast, M.figure or M.officeLive at its top;
- capabilities.json, edgeone/server/rules.js and the BRIEF rules block are unchanged.

Run: cd m360-os && python3 harness/tests/test_contract_office3d.py
"""
import base64
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
MB = 1024 * 1024
# capabilities.json as v39 ships it (v39 closed statements and review; the office still adds no rule of its own)
CAPS_SHA256 = '36c87d1a471f602ba366875a347f9d11a87a9923ebbbc450c9490e7dceb06328'
HEADER = '/* vendor: three.js r186 (0.186.1), MIT, Copyright 2010-2026 Three.js Authors. Bundled by fx/build.sh from fx/three-entry.js. Never edited by hand. */'
N_OFFICE = ['dayOf', 'istYmd', 'istHm', 'istDayStart', 'layout', 'planOf', 'labelOf', 'desks', 'viewerOf', 'stateWord', 'STATE_WORD', 'shownStations',
            'STATION_POS', 'SPOTS', 'AREA', 'STATION_LABEL', 'NAV', 'MEET_SEATS', 'LUNCH_SEATS', 'aisles', 'walkway', 'path', 'route', 'standPoint', 'queue',
            'choreo', 'approvedAt', 'say', 'rowBubble', 'teamLine', 'NEEDS', 'restOf', 'clockLine', 'useData', 'useDrawers', 'StationDrawer', 'DeskDrawer',
            'CooDrawer', 'Rail', 'RunList', 'DeskList', 'Bubble', 'Mascot', 'ITEM', 'undoRow', 'useDirector', 'flatStage', 'useReduced', 'useLite',
            'useVisible', 'useHushed', 'useMedia']
N_OFFICE3D = ['can', 'useMode', 'load', 'acquire', 'release', 'tokens', 'Scene3D', 'stage3d', 'state']
N_CAST = ['NATURAL', 'SKIN', 'HAIR', 'CLOTH', 'FRAMES', 'SHAPES', 'COLOURS', 'FLAGS', 'ORDER', 'DEFAULT', 'clean', 'hash', 'same', 'starter', 'resolve',
          'lookOf', 'paint', 'head2d', 'headUrl']
N_FIGURE = ['build', 'crowd', 'coo']
N_LIVE = ['canDrive', 'useKaavish', 'sample', 'useController', 'walkTo', 'say', 'clear', 'Composer', 'Arrange', 'planWrite', 'state']
ENTRY = ['WebGLRenderer', 'Scene', 'PerspectiveCamera', 'Group', 'Mesh', 'HemisphereLight', 'DirectionalLight', 'MeshStandardMaterial', 'MeshPhysicalMaterial',
         'CanvasTexture', 'PMREMGenerator', 'Raycaster', 'NeutralToneMapping', 'SRGBColorSpace', 'VSMShadowMap', 'OrbitControls', 'RoomEnvironment',
         'RoundedBoxGeometry', 'mergeGeometries', 'mergeVertices']

checks = []


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    checks.append(msg)


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


def code_only(s):
    """JavaScript without its comments (a comment may name what the code must never do)"""
    s = re.sub(r'/\*[\s\S]*?\*/', '', s)
    return re.sub(r'(^|[^:\\])//[^\n]*', r'\1', s)


def exported(src, start):
    """the names of an object literal that begins at `start` (an index just past its opening brace)"""
    depth, i, out, key = 1, start, [], ''
    top = []
    while depth:
        ch = src[i]
        if ch in '{[(':
            depth += 1
        elif ch in '}])':
            depth -= 1
        if depth == 1 or (depth == 0 and ch == '}'):
            top.append(ch if depth == 1 else '')
        elif depth == 2 and ch in '{[(':
            top.append(ch)
        i += 1
    body = ''.join(top)
    body = re.sub(r'\{[^{}]*\}|\[[^\[\]]*\]|\([^()]*\)', '', body)
    for part in body.split(','):
        part = part.strip()
        if not part:
            continue
        key = re.match(r'([A-Za-z_$][\w$]*)', part)
        if key:
            out.append(key.group(1))
    return out


def names_of(file, pattern):
    src = read('src', 'js', file)
    m = re.search(pattern, src)
    check(m is not None, '%s assigns its namespace (%s)' % (file, pattern))
    return exported(src, m.end())


def main():
    # ---- the vendor bundle and its entry ----
    vendor = read('src', 'vendor', 'three.vendor.js')
    check(vendor.splitlines()[0] == HEADER, 'three.vendor.js opens with the r186 header')
    bad = [w for w in ('fetch(', 'import(', 'eval(', 'new Function') if w in vendor] + re.findall(r'(?<![\w.$])(?:alert|confirm|prompt)\s*\(', vendor)
    check(not bad, 'three.vendor.js has no fetch(, import(, eval(, new Function or blocking dialog: %r' % bad)
    size, gz = len(vendor.encode('utf-8')), len(gzip.compress(vendor.encode('utf-8'), 9))
    check(size <= 640 * 1024 and gz <= 170 * 1024, 'three.vendor.js is %d B minified and %d B gzip, inside 640 KB and 170 KB' % (size, gz))
    entry = read('fx', 'three-entry.js')
    code = code_only(entry)
    check(not re.search(r'\bimport\s*\*\s*as\b', code) and not re.search(r'\bexport\s*\*', code), 'fx/three-entry.js imports and exports by name only')
    check(all(re.search(r'\b%s\b' % n, code) for n in ENTRY) and not re.search(r'Loader\b|\bClock\b|PCFSoftShadowMap', code),
          'fx/three-entry.js names what the office reads, and no loader, Clock or PCFSoftShadowMap')

    # ---- the artifact page ----
    import build as builder
    out = builder.build()
    page = open(out, encoding='utf-8').read()
    raw = len(page.encode('utf-8'))
    packed = len(gzip.compress(page.encode('utf-8'), 9))
    check(page.count('window.M360_3D = function') == 1 and page.count('<script src=') == 3 and 'fetch(' not in page,
          'dist/index.html holds window.M360_3D = function once, three script tags and no fetch(')
    check(raw <= 4.4 * MB and packed <= 1.25 * MB, 'dist/index.html is %d B raw (at most %d) and %d B gzip (at most %d)' % (raw, 4.4 * MB, packed, 1.25 * MB))
    wrapped = page[page.index('window.M360_3D = function'):]
    check(wrapped.startswith('window.M360_3D = function () {\n' + vendor) or ('window.M360_3D = function () {\n' + vendor + '\nreturn M3D;\n};') in page,
          'the artifact carries the vendor file whole, wrapped so nothing of it runs at load')

    # ---- the team site ----
    committed = json.loads(subprocess.run(['git', 'show', 'HEAD:m360-os/edgeone/edgeone.json'], capture_output=True, text=True, cwd=ROOT).stdout or '{}')
    res = subprocess.run([sys.executable, 'build_edgeone.py'], capture_output=True, text=True, cwd=ROOT)
    check(res.returncode == 0, 'build_edgeone.py builds: %s' % (res.stdout + res.stderr)[-300:])
    site = read('edgeone', 'public', 'index.html')
    check('window.M360_3D = function' not in site and 'M3D=' not in site and HEADER not in site, 'the team site page holds none of the bundle')
    stamp = [m.group(1) for m in re.finditer(r'<script>([\s\S]*?)</script>', site) if 'window.M360_3D_SRC = "' in m.group(1)]
    check(len(stamp) == 1 and 'window.M360_BUILD = ' in stamp[0], 'one inline script, the build stamp, names the three file')
    src = re.search(r'window\.M360_3D_SRC = "(vendor/three\.([0-9a-f]{8})\.js)"', stamp[0])
    sri = re.search(r'window\.M360_3D_SRI = "(sha384-[A-Za-z0-9+/=]+)"', stamp[0])
    check(src is not None and sri is not None, 'the build stamp sets M360_3D_SRC and M360_3D_SRI: %r' % stamp[0][:200])
    body = open(os.path.join(ROOT, 'edgeone', 'public', src.group(1)), 'rb').read()
    check(body.decode('utf-8') == builder.three_js() and hashlib.sha256(body).hexdigest()[:8] == src.group(2)
          and 'sha384-' + base64.b64encode(hashlib.sha384(body).digest()).decode('ascii') == sri.group(1),
          '%s is the same window.M360_3D function, named by its sha256 and matching its integrity' % src.group(1))
    stale = [f for f in os.listdir(os.path.join(ROOT, 'edgeone', 'public', 'vendor')) if re.match(r'^three\.[0-9a-f]{8}\.js$', f) and f != src.group(1)[7:]]
    check(not stale, 'no stale three files beside it: %r' % stale)
    cfg = json.loads(read('edgeone', 'edgeone.json'))
    csp = [x['value'] for h in cfg['headers'] if h['source'] in ('/', '/index.html') for x in h['headers'] if x['key'] == 'Content-Security-Policy']
    h = "'sha256-%s'" % base64.b64encode(hashlib.sha256(stamp[0].encode('utf-8')).digest()).decode('ascii')
    check(csp and all(h in v for v in csp) and all(re.search(r"script-src 'self' ('sha256-[^']+' )+https://sdk\.scdn\.co;", v) for v in csp),
          'the CSP names the stamp script by its hash, and script-src is still self, hashes and the player')
    olds = {x['source']: x for x in committed.get('headers', [])}
    news = {x['source']: x for x in cfg['headers']}
    added = sorted(set(news) - set(olds))
    three = '/' + src.group(1)
    check(added == ([] if three in olds else [three]) and three in news and news[three]['headers'] == [{'key': 'Cache-Control', 'value': 'public, max-age=31536000, immutable'}],
          'edgeone.json holds one immutable entry for the three file, new only when the bundle changed: %r' % added)
    old3 = [s for s in olds if re.match(r'^/vendor/three\.[0-9a-f]{8}\.js$', s)]
    check(all(s == three or s not in news for s in old3), 'an older three file loses its entry: %r' % old3)
    check(set(olds) - set(old3) <= set(news), 'every other entry stays')
    for s, x in olds.items():
        if s in old3:
            continue
        a = [y for y in x['headers'] if y['key'] != 'Content-Security-Policy']
        b = [y for y in news[s]['headers'] if y['key'] != 'Content-Security-Policy']
        check(a == b, 'the headers of %s stay as they were (only the page\'s CSP follows the page)' % s)
    check(set(k for k in cfg if k != 'headers') == set(k for k in committed if k != 'headers') and all(cfg[k] == committed[k] for k in cfg if k != 'headers'),
          'every other key of edgeone.json stays')

    # ---- the loader ----
    o3 = code_only(read('src', 'js', '91-office3d.js'))
    check("createElement('script')" in o3 and 'M360_3D_SRI' in o3 and "crossOrigin = 'anonymous'" in o3, 'M.office3d.load() makes its script element with the integrity')
    leaks = [f for f in sorted(os.listdir(os.path.join(ROOT, 'src', 'js'))) if f.endswith('.js') and not f.endswith('.vendor.js')
             and ('<script src=' in read('src', 'js', f) or re.search(r'(?<![\w.$])import\s*\(', code_only(read('src', 'js', f))))]
    check(not leaks, 'no app file writes a script tag or a dynamic import: %r' % leaks)

    # ---- the namespaces of section N ----
    for file, pat, want, name in (('90-office.js', r'\n  M\.office = \{', N_OFFICE, 'M.office'),
                                  ('91-office3d.js', r'\n  M\.office3d = Object\.assign\(M\.office3d \|\| \{\}, \{', N_OFFICE3D, 'M.office3d'),
                                  ('14-cast.js', r'\n  M\.cast = \{', N_CAST, 'M.cast'),
                                  ('92-figure.js', r'\n  M\.figure = \{', N_FIGURE, 'M.figure'),
                                  ('93-office-live.js', r'\n  M\.officeLive = \{', N_LIVE, 'M.officeLive')):
        got = names_of(file, pat)
        missing = [n for n in want if n not in got]
        check(not missing, '%s exports every name of section N (%d): missing %r' % (name, len(want), missing))
    parts = read('src', 'js', '71-z-character.js')
    check('M.parts.CharacterCard = ' in parts and 'M.parts.CharacterSheet = ' in parts, 'M.parts.CharacterCard and M.parts.CharacterSheet')

    # ---- read at call time, never destructured at the top of a file ----
    top = []
    for f in sorted(os.listdir(os.path.join(ROOT, 'src', 'js'))):
        if f.endswith('.js') and not f.endswith('.vendor.js'):
            for m in re.finditer(r'^ {0,2}(?:const|let|var)\s*\{[^}]*\}\s*=\s*M\.(office|office3d|cast|figure|officeLive)\b', read('src', 'js', f), re.M):
                top.append((f, m.group(0)))
    check(not top, 'no file destructures M.office, M.office3d, M.cast, M.figure or M.officeLive at its top: %r' % top)

    # ---- the rules stay ----
    caps = open(os.path.join(ROOT, 'capabilities.json'), 'rb').read()
    check(hashlib.sha256(caps).hexdigest() == CAPS_SHA256, 'capabilities.json is unchanged')
    rules = subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', 'edgeone/server/rules.js'], cwd=ROOT)
    check(rules.returncode == 0, 'edgeone/server/rules.js comes out of the build unchanged')
    brief = read('BRIEF.md')
    block = json.loads(brief.split('Access rules to declare exactly, as `capabilities.db.rules`:', 1)[1].split('```json', 1)[1].split('```', 1)[0])
    check(all(r in json.loads(caps)['db']['rules'] for r in block) and not any(r['path'].startswith(('office/', 'x/')) for r in block),
          'the BRIEF rules block is the one capabilities.json declares, with no office or stage rule of its own')


if __name__ == '__main__':
    main()
    for c in checks:
        print('ok', c)
    print('PASS', len(checks), 'checks')
