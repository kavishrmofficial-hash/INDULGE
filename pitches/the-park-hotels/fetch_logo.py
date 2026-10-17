"""Fetches The Park Hotels' logo files for the deck: python3 pitches/the-park-hotels/fetch_logo.py <out-dir>

Runs in GitHub Actions (.github/workflows/park-logo.yml), because the coding sandbox cannot reach theparkhotels.com.
It reads the site's pages and stylesheets, collects every logo candidate (img tags, inline SVGs, CSS background images,
icons and the share image), downloads them into <out-dir> and writes manifest.json, so the right file can be picked by eye."""
import gzip, hashlib, json, pathlib, re, sys, urllib.request
from urllib.parse import urljoin, urlparse

PAGES = ['https://www.theparkhotels.com/', 'https://www.theparkhotels.com/corporate-information.html',
         'https://www.theparkhotels.com/kolkata/']
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'gzip'})
    with urllib.request.urlopen(req, timeout=40) as r:
        body = r.read()
        if r.headers.get('Content-Encoding') == 'gzip':
            body = gzip.decompress(body)
        return body, r.headers.get('Content-Type', ''), r.geturl()


found = {}   # url -> where it was seen
inline = []  # inline svg markup with "logo" in its attributes


def note(url, base, why):
    url = urljoin(base, url.strip().strip('\'"'))
    if url.startswith('http') and url not in found:
        found[url] = why


for page in PAGES:
    try:
        html, _, final = get(page)
    except Exception as e:  # keep going: one page failing should not stop the rest
        print('page failed', page, e)
        continue
    t = html.decode('utf-8', 'replace')
    (out / f'page-{hashlib.md5(page.encode()).hexdigest()[:6]}.html').write_text(t[:400000])
    for tag in re.findall(r'<img\b[^>]*>', t, re.I):
        if re.search(r'logo|brand|the-?park', tag, re.I):
            for attr in ('src', 'data-src', 'srcset'):
                m = re.search(attr + r'\s*=\s*["\']([^"\']+)', tag, re.I)
                if m:
                    note(m.group(1).split(' ')[0], final, f'img {attr} on {page}')
    for tag in re.findall(r'<(?:link|meta)\b[^>]*>', t, re.I):
        if re.search(r'icon|og:image|twitter:image|mask-icon', tag, re.I):
            m = re.search(r'(?:href|content)\s*=\s*["\']([^"\']+)', tag, re.I)
            if m:
                note(m.group(1), final, f'head tag on {page}')
    for svg in re.findall(r'<svg\b.*?</svg>', t, re.I | re.S):
        if re.search(r'logo|brand', svg[:400], re.I):
            inline.append({'page': page, 'svg': svg})
    for href in re.findall(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)', t, re.I):
        css_url = urljoin(final, href)
        try:
            css = get(css_url)[0].decode('utf-8', 'replace')
        except Exception as e:
            print('css failed', css_url, e)
            continue
        for u in re.findall(r'url\(([^)]+)\)', css):
            if re.search(r'logo', u, re.I):
                note(u, css_url, f'css {css_url}')

manifest = []
for i, (url, why) in enumerate(list(found.items())[:40]):
    try:
        body, ctype, _ = get(url)
    except Exception as e:
        manifest.append({'url': url, 'seen': why, 'error': str(e)})
        continue
    name = re.sub(r'[^\w.-]', '_', pathlib.Path(urlparse(url).path).name or f'file{i}')[:80]
    name = f'{i:02d}-{name}'
    (out / name).write_bytes(body)
    manifest.append({'file': name, 'url': url, 'seen': why, 'type': ctype, 'bytes': len(body)})
for i, s in enumerate(inline):
    name = f'inline-{i:02d}.svg'
    (out / name).write_text(s['svg'])
    manifest.append({'file': name, 'url': s['page'], 'seen': 'inline svg', 'bytes': len(s['svg'])})
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest, indent=2))
