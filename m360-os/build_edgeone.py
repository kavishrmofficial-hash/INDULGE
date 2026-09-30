#!/usr/bin/env python3
"""Assemble the standalone m360 OS for EdgeOne Pages into edgeone/:

  edgeone/public/index.html        the same app as the artifact, plus the standalone runtime shim
  edgeone/public/vendor/*.js       pinned React, ReactDOM and htm (no CDN at runtime)
  edgeone/server/rules.js          the access rules, from capabilities.json
  edgeone/server/seed.js           the first-run workspace, from seed/seed.json
  edgeone/cloud-functions/api/m360.js   the one API function (hand-written, not generated)
"""
import json
import re
import os
import shutil

import build as builder

ROOT = os.path.dirname(os.path.abspath(__file__))
EO = os.path.join(ROOT, 'edgeone')
PUB = os.path.join(EO, 'public')

# the public address, for link previews (WhatsApp, Slack) which need absolute image urls
PUBLIC_URL = os.environ.get('M360_PUBLIC_URL', 'https://m360os-wx9u1bqs.edgeone.dev').rstrip('/')
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<link rel="icon" type="image/svg+xml" href="icon.svg">'
        '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">'
        '<link rel="icon" type="image/png" sizes="64x64" href="icons/favicon-64.png">'
        '<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">'
        '<meta name="theme-color" content="#FFFFFF">'
        '<link rel="manifest" href="manifest.json"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="m360">'
        '<meta name="application-name" content="m360 OS">'
        '<meta property="og:title" content="m360 OS"><meta property="og:description" content="The Mask360 operating system.">'
        '<meta property="og:type" content="website"><meta property="og:image" content="' + PUBLIC_URL + '/icons/og.png">'
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
        '<meta name="twitter:card" content="summary_large_image">'
        '<style>body{margin:0;background:#FFFFFF}</style>')
LOCAL = {builder.CDN[0]: 'vendor/react.js', builder.CDN[1]: 'vendor/react-dom.js', builder.CDN[2]: 'vendor/htm.js'}


SW = '''/* m360 OS service worker: the shell loads offline, the API always goes to the network */
const CACHE = 'm360-__BUILD__';
const SHELL = ['/', '/index.html', '/vendor/react.js', '/vendor/react-dom.js', '/vendor/htm.js', '/manifest.json', '/icon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  /* the page itself is always asked for afresh (no-cache: the server confirms or replaces it); the rest may come from the HTTP cache */
  const fresh = e.request.mode === 'navigate' || /\\/(index\\.html|sw\\.js|version\\.json|manifest\\.json)?$/.test(u.pathname);
  e.respondWith(fetch(fresh ? new Request(e.request, {cache: 'no-cache'}) : e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/index.html'))));
});
'''


def build_stamp():
    """<short commit>.<yymmdd-hhmm> of the commit being built; the working tree's moment when it has changes."""
    import subprocess
    import datetime
    try:
        sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=ROOT).stdout.strip() or 'local'
        dirty = subprocess.run(['git', 'status', '--porcelain', '--', 'src', 'edgeone/server', 'build_edgeone.py'], capture_output=True, text=True, cwd=ROOT).stdout.strip()
        when = subprocess.run(['git', 'log', '-1', '--format=%cI'], capture_output=True, text=True, cwd=ROOT).stdout.strip()
        t = datetime.datetime.now(datetime.timezone.utc) if (dirty or not when) else datetime.datetime.fromisoformat(when).astimezone(datetime.timezone.utc)
    except Exception:
        sha, t, dirty = 'local', datetime.datetime.now(datetime.timezone.utc), ''
    return '%s%s.%s' % (sha, '+' if dirty else '', t.strftime('%y%m%d-%H%M'))


# the security headers the site answers with. The Content-Security-Policy names every inline script by its
# hash (the build stamp, the shim and the app), so nothing injected into the page can run; scripts and the
# worker come from the site itself and Spotify's player; styles are inline by design; images, media and
# frames (reading mode) may come from any https address; the site is never framed by another.
SEC_HEADERS = [
    {'key': 'X-Content-Type-Options', 'value': 'nosniff'},
    {'key': 'X-Frame-Options', 'value': 'DENY'},
    {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'},
    {'key': 'Strict-Transport-Security', 'value': 'max-age=31536000; includeSubDomains'},
    {'key': 'Permissions-Policy', 'value': 'geolocation=(self), microphone=(self), camera=(self), payment=(), usb=(), interest-cohort=()'},
    {'key': 'Cross-Origin-Opener-Policy', 'value': 'same-origin-allow-popups'},
]
def csp_for(doc):
    import hashlib, base64
    hashes = []
    for m in re.finditer(r'<script>([\s\S]*?)</script>', doc):
        h = base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode('ascii')
        if "'sha256-%s'" % h not in hashes:
            hashes.append("'sha256-%s'" % h)
    return '; '.join([
        "default-src 'self'",
        "script-src 'self' %s https://sdk.scdn.co" % ' '.join(hashes),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "media-src 'self' data: blob: https:",
        "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://*.spotifycdn.com",
        "frame-src https:",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ])
def write_headers(doc):
    """edgeone.json carries the headers the platform answers with; the page's CSP hashes come from this build."""
    cfg_path = os.path.join(ROOT, 'edgeone', 'edgeone.json')
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    csp = csp_for(doc)
    out = []
    for h in cfg.get('headers', []):
        keep = [x for x in h.get('headers', []) if x['key'] not in ('Content-Security-Policy',) and x['key'] not in [y['key'] for y in SEC_HEADERS]]
        if h['source'] in ('/', '/index.html'):
            keep = keep + [{'key': 'Content-Security-Policy', 'value': csp}] + SEC_HEADERS
        elif h['source'] == '/*':
            keep = keep + SEC_HEADERS
        out.append({'source': h['source'], 'headers': keep})
    if not any(h['source'] == '/*' for h in out):
        out.append({'source': '/*', 'headers': list(SEC_HEADERS)})
    cfg['headers'] = out
    with open(cfg_path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2)
        f.write('\n')

def main():
    os.makedirs(os.path.join(PUB, 'vendor'), exist_ok=True)
    tmp = os.path.join(builder.DIST, 'index.edgeone.html')
    sa = os.path.join(ROOT, 'src', 'standalone')
    extra = [os.path.join(sa, f) for f in sorted(os.listdir(sa)) if f.endswith('.js') and f != 'shim.js']
    builder.build(extra=extra, out_path=tmp)
    page = open(tmp, encoding='utf-8').read()
    for url, local in LOCAL.items():
        assert url in page, 'CDN tag missing: ' + url
        page = page.replace(builder.script_tag(url), '<script src="%s"></script>' % local)
        assert url not in page, 'CDN tag not replaced: ' + url
    shim = open(os.path.join(ROOT, 'src', 'standalone', 'shim.js'), encoding='utf-8').read()
    # the title and viewport lines the artifact page opens with move into the head
    first_script = page.index('<script')
    head_part, body_part = page[:page.index('<div id="root">')], page[page.index('<div id="root">'):]
    # the build stamp: the commit and the moment, shown in the app and written to version.json, so anyone can tell
    # which build a page runs and the page can say when a newer one is up
    build = build_stamp()
    doc = HEAD + head_part + '<script>window.M360_BUILD = %s;</script><script>\n' % json.dumps(build) + shim + '\n</script></head><body>' + body_part + '</body></html>'
    with open(os.path.join(PUB, 'version.json'), 'w') as f:
        json.dump({'build': build}, f)
    assert first_script > 0
    # the frame helper extension, zipped for the Web page's download link
    import zipfile
    ext = os.path.join(ROOT, 'extension')
    if os.path.isdir(ext):
        with zipfile.ZipFile(os.path.join(PUB, 'm360-frame-helper.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
            for name in sorted(os.listdir(ext)):
                if name.endswith(('.json', '.js', '.md')): z.write(os.path.join(ext, name), 'm360-frame-helper/' + name)
    with open(os.path.join(PUB, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(doc)
    write_headers(doc)
    # a phone can install it: manifest, icons and a small service worker for the shell
    # the agency mark, black on white: the same mark the app shows, as the icon everywhere
    mark = open(os.path.join(ROOT, 'src', 'mark.svg'), encoding='utf-8').read().strip()
    inner = mark.replace('<svg ', '<svg x="48" y="171" width="416" height="121" ', 1).replace('fill="currentColor"', 'fill="#0A0A0A"')
    icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#FFFFFF"/>' + inner + '</svg>')
    with open(os.path.join(PUB, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(icon)
    with open(os.path.join(PUB, 'manifest.json'), 'w') as f:
        json.dump({'name': 'm360 OS', 'short_name': 'm360', 'description': 'The Mask360 operating system.', 'start_url': '/', 'display': 'standalone',
                   'background_color': '#FFFFFF', 'theme_color': '#FFFFFF',
                   'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
                             {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
                             {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
                             {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml', 'purpose': 'any'}]}, f)
    with open(os.path.join(PUB, 'sw.js'), 'w') as f:
        f.write(SW.replace('__BUILD__', build))
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
