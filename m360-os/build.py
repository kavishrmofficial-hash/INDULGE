#!/usr/bin/env python3
"""Assemble m360 OS into one self-contained artifact page: dist/index.html.

The page is authored for the claude.ai artifact skeleton, so it carries no
doctype, html, head or body tags of its own. The harness wraps it for local QA.
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')

CDN = [
    'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
    'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
]

CORE_FILES = ('00-core.js', '01-ui.js', '02-state.js', '03-shell.js', '04-ai.js', '99-app.js')

LATIN_RANGE = ('U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, '
               'U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def b64(p):
    with open(p, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def font_face(path, urange, family='Space Grotesk', weight='300 700'):
    return ("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s;}" % (family, weight, b64(path), urange))


def build():
    css = read(os.path.join(SRC, 'css.css'))
    mark = read(os.path.join(SRC, 'mark.svg')).strip()
    js_dir = os.path.join(SRC, 'js')
    files = sorted(f for f in os.listdir(js_dir) if f.endswith('.js'))
    # M360_MODULES=10-today.js,11-checkin.js builds core plus only those modules (harness use)
    only = os.environ.get('M360_MODULES')
    if only:
        keep = set(CORE_FILES) | set(x.strip() for x in only.split(',') if x.strip())
        files = [f for f in files if f in keep]
    tag = os.environ.get('M360_TAG', '')
    parts = []
    for f in files:
        parts.append('/* ==== %s ==== */\n' % f + read(os.path.join(js_dir, f)))
        if f == '00-core.js':
            parts.append('M.MARK_SVG = %s;' % json.dumps(mark))
    app_js = '\n'.join(parts)

    fonts = font_face(os.path.join(ROOT, 'assets', 'sg-latin.woff2'), LATIN_RANGE) + \
        font_face(os.path.join(ROOT, 'assets', 'sg-rupee.woff2'), 'U+20B9')

    gate = ('<div class="gate"><div><span class="mark" style="width:110px">%s</span>'
            '<h1>Booting up</h1><p>Signing you in. One sec.</p></div></div>' % mark)

    html = '\n'.join([
        '<title>m360 OS</title>',
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
        '<meta name="color-scheme" content="light">',
        '<style>' + fonts + '\n' + css + '</style>',
        '<div id="root">' + gate + '</div>',
    ] + ['<script src="%s"></script>' % u for u in CDN] + [
        '<script>\n' + app_js + '\n</script>',
        '',
    ])

    # copy and safety assertions
    for ch, name in (('—', 'em dash'), ('–', 'en dash')):
        if ch in html:
            idx = html.index(ch)
            sys.exit('BUILD FAILED: %s found near: %r' % (name, html[max(0, idx - 80):idx + 40]))
    for bad in ('window.alert', 'window.confirm', 'window.prompt'):
        if bad in html:
            sys.exit('BUILD FAILED: %s is not allowed' % bad)
    if re.search(r'(?<![\w.$])(alert|confirm)\s*\(', app_js):
        sys.exit('BUILD FAILED: bare alert() or confirm() call found')
    if len(html.encode('utf-8')) > 16 * 1024 * 1024:
        sys.exit('BUILD FAILED: page over 16MB')

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'index%s.html' % ('.' + tag if tag else ''))
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('built %s (%d bytes, %d js files)' % (out, len(html.encode('utf-8')), len(files)))
    return out


if __name__ == '__main__':
    build()
