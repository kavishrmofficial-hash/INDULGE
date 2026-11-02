"""Builds the proposal: python3 pitches/the-park-hotels/deck/build.py  (STRICT=1 fails on banned words or leftovers)

Writes to pitches/the-park-hotels/dist/:
  the-park-proposal.html  the page fragment published as the claude.ai artifact
  index.html              the standalone page, for a website or for printing to PDF
"""
import base64, os, pathlib, re, shutil, sys

V = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(V))
import content  # noqa: E402

DIST = pathlib.Path(os.environ.get('DIST', V.parent / 'dist'))
DIST.mkdir(parents=True, exist_ok=True)


def font(name):
    return 'data:font/woff2;base64,' + base64.b64encode((V / 'fonts' / f'{name}.woff2').read_bytes()).decode()


def path_d(svg):
    return re.search(r' d="([^"]+)"', (V / svg).read_text()).group(1)


def paths_d(svg):
    """Every path in an SVG joined into one d (each subpath starts with its own M)."""
    return ' '.join(re.sub(r'\s+', ' ', d) for d in re.findall(r' d="([^"]+)"', (V / svg).read_text()))


css = re.sub(r'\{\{FONT:([\w-]+)\}\}', lambda m: font(m.group(1)), (V / 'deck.css').read_text())
js = (V / 'deck.js').read_text()
symbols = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
           f'<symbol id="logo-m" viewBox="0 0 1632 473"><path fill-rule="evenodd" d="{path_d("m360.svg")}"/></symbol>'
           f'<symbol id="logo-p" viewBox="257.5 357.5 97 77"><path d="{paths_d("park.svg")}"/></symbol></svg>')

slides = content.slides()
n = len(slides)
slides = [s.replace('<span class="pg" data-pg></span>', f'<span class="pg"><span class="k">Page</span>{i + 1:02d}/{n:02d}</span>') for i, s in enumerate(slides)]

title = content.TITLE
fragment = (f'<title>{title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            f'<meta name="description" content="{content.DESCRIPTION}">\n<style>{css}</style>\n'
            f'{symbols}\n<main>\n' + '\n'.join(slides) + f'\n</main>\n<script>{js}</script>\n')

standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
              + fragment.split('<style>')[0] + '<style>' + fragment.split('<style>', 1)[1].split('</style>', 1)[0] + '</style>\n'
              '</head>\n<body>\n' + fragment.split('</style>\n', 1)[1] + '</body>\n</html>\n')

# Mask360's copy rules: no em or en dashes, no contrast constructions, no filler words, nothing left to fill in
BAN = [r'—', r'–', r',\s*not\s', r'\brather than\b', r'\binstead of\b', r'not just .{0,40}, but', r'\{\{', r'\[\[', r'\bTODO\b',
       r'\bTK\b', r'lorem', r'\[(agency|name|client|email|phone)', r'unlock', r'elevate', r'seamless', r'game[- ]chang', r'leverag',
       r'synerg', r'holistic', r'\.\s+Ours\b', r'delve', r'tapestry', r'in today.s', r'ever-evolving', r'cutting-edge', r'world-class', r'!']
text = re.sub(r'<script>.*?</script>', ' ', fragment.split('</style>', 1)[1], flags=re.S)
text = re.sub(r'<[^>]+>', ' ', text)
hits = [(b, m.group(0)) for b in BAN for m in re.finditer(b, text, re.I)]
if hits:
    print('BANNED:', hits[:20])
    if os.environ.get('STRICT'):
        sys.exit(1)

# the reference clips and their posters travel with the page, in dist/media (published with the artifact as its files)
MEDIA = V / 'media'
if MEDIA.is_dir():
    out = DIST / 'media'
    out.mkdir(exist_ok=True)
    used = set(re.findall(r'media/([\w.-]+)', fragment))
    for f in MEDIA.iterdir():
        if f.name in used:
            shutil.copy(f, out / f.name)
    missing = [u for u in used if not (MEDIA / u).exists()]
    if missing:
        sys.exit(f'missing media: {missing}')
(DIST / 'the-park-proposal.html').write_text(fragment)
(DIST / 'index.html').write_text(standalone)
print(f'{n} slides · fragment {len(fragment) / 1024:.0f} KB · standalone {len(standalone) / 1024:.0f} KB')
