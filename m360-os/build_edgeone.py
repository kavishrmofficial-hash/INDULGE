#!/usr/bin/env python3
"""Assemble the standalone m360 OS for EdgeOne Pages into edgeone/:

  edgeone/public/index.html        the same app as the artifact, plus the standalone runtime shim
  edgeone/public/vendor/*.js       pinned React, ReactDOM and htm (no CDN at runtime)
  edgeone/server/rules.js          the access rules, from capabilities.json
  edgeone/server/seed.js           the first-run workspace, from seed/seed.json
  edgeone/cloud-functions/api/m360.js   the one API function (hand-written, not generated)
"""
import json
import os
import shutil

import build as builder

ROOT = os.path.dirname(os.path.abspath(__file__))
EO = os.path.join(ROOT, 'edgeone')
PUB = os.path.join(EO, 'public')

HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E'
        '%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%230A0A0A%22/%3E%3Ccircle cx=%2223%22 cy=%229%22 r=%223%22 fill=%22%23F53901%22/%3E%3C/svg%3E">'
        '<meta name="theme-color" content="#FFFFFF">'
        '<link rel="manifest" href="manifest.json"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="m360">'
        '<style>body{margin:0;background:#FFFFFF}</style>')
LOCAL = {builder.CDN[0]: 'vendor/react.js', builder.CDN[1]: 'vendor/react-dom.js', builder.CDN[2]: 'vendor/htm.js'}


SW = '''/* m360 OS service worker: the shell loads offline, the API always goes to the network */
const CACHE = 'm360-v4';
const SHELL = ['/', '/index.html', '/vendor/react.js', '/vendor/react-dom.js', '/vendor/htm.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/index.html'))));
});
'''


def main():
    os.makedirs(os.path.join(PUB, 'vendor'), exist_ok=True)
    tmp = os.path.join(builder.DIST, 'index.edgeone.html')
    builder.build(extra=[os.path.join(ROOT, 'src', 'standalone', '70-standalone.js')], out_path=tmp)
    page = open(tmp, encoding='utf-8').read()
    for url, local in LOCAL.items():
        assert url in page, 'CDN tag missing: ' + url
        page = page.replace('<script src="%s"></script>' % url, '<script src="%s"></script>' % local)
    shim = open(os.path.join(ROOT, 'src', 'standalone', 'shim.js'), encoding='utf-8').read()
    # the title and viewport lines the artifact page opens with move into the head
    first_script = page.index('<script')
    head_part, body_part = page[:page.index('<div id="root">')], page[page.index('<div id="root">'):]
    doc = HEAD + head_part + '<script>\n' + shim + '\n</script></head><body>' + body_part + '</body></html>'
    assert first_script > 0
    with open(os.path.join(PUB, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(doc)
    # a phone can install it: manifest, icons and a small service worker for the shell
    icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0A0A0A"/>'
            '<circle cx="372" cy="140" r="34" fill="#F53901"/><text x="256" y="330" font-family="Arial, sans-serif" font-size="190" font-weight="700" fill="#FFFFFF" text-anchor="middle">m</text></svg>')
    with open(os.path.join(PUB, 'icon.svg'), 'w') as f:
        f.write(icon)
    with open(os.path.join(PUB, 'manifest.json'), 'w') as f:
        json.dump({'name': 'm360 OS', 'short_name': 'm360', 'start_url': '/', 'display': 'standalone', 'background_color': '#FFFFFF',
                   'theme_color': '#0A0A0A', 'icons': [{'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml', 'purpose': 'any'}]}, f)
    with open(os.path.join(PUB, 'sw.js'), 'w') as f:
        f.write(SW)
    # the pinned UMD builds are committed under edgeone/public/vendor; refresh them from the harness copy when present
    for name in ('react.js', 'react-dom.js', 'htm.js'):
        src = os.path.join(ROOT, 'harness', 'vendor', name)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(PUB, 'vendor', name))
        assert os.path.exists(os.path.join(PUB, 'vendor', name)), 'missing vendor/' + name

    caps = json.load(open(os.path.join(ROOT, 'capabilities.json')))
    with open(os.path.join(EO, 'server', 'rules.js'), 'w') as f:
        f.write('/* generated by build_edgeone.py from capabilities.json */\nexport const RULES = %s;\n'
                % json.dumps(caps['db']['rules'], indent=1))
    seed = json.load(open(os.path.join(ROOT, 'seed', 'seed.json')))
    with open(os.path.join(EO, 'server', 'seed.js'), 'w', encoding='utf-8') as f:
        f.write('/* generated by build_edgeone.py from seed/seed.json */\nexport const SEED = %s;\n'
                % json.dumps(seed, ensure_ascii=False))
    print('edgeone build ready: %s (%d bytes)' % (os.path.join(PUB, 'index.html'), len(doc.encode('utf-8'))))


if __name__ == '__main__':
    main()
