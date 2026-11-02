"""Builds the proposal: python3 pitches/westside/v4/build.py  (STRICT=1 fails on banned words or leftovers)

Writes to pitches/westside/dist/:
  westside-proposal.html  the page fragment published as the claude.ai artifact
  index.html              the standalone page for the website (videos load from media/ beside it)
"""
import base64, json, os, pathlib, re, sys

V = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(V))
import content  # noqa: E402

DIST = pathlib.Path(os.environ.get('DIST', V.parent / 'dist'))
DIST.mkdir(parents=True, exist_ok=True)


def font(name):
    return 'data:font/woff2;base64,' + base64.b64encode((V / 'fonts' / f'{name}.woff2').read_bytes()).decode()


def path_d(svg):
    return re.search(r' d="([^"]+)"', (V / svg).read_text()).group(1)


css = re.sub(r'\{\{FONT:([\w-]+)\}\}', lambda m: font(m.group(1)), (V / 'deck.css').read_text())
js = (V / 'fabric.js').read_text() + '\n' + (V / 'deck.js').read_text()
symbols = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
           f'<symbol id="logo-w" viewBox="0 0 1506 1194"><path fill-rule="evenodd" d="{path_d("w.svg")}"/></symbol>'
           f'<symbol id="logo-m" viewBox="0 0 1632 473"><path fill-rule="evenodd" d="{path_d("m360.svg")}"/></symbol></svg>')

slides = content.slides()
n = len(slides)
slides = [s.replace('<span class="pg label" data-pg></span>', f'<span class="pg label">{i + 1:02d} / {n:02d}</span>') for i, s in enumerate(slides)]
counter = ''

title = content.TITLE
fragment = (f'<title>{title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            f'<meta name="description" content="{content.DESCRIPTION}">\n<style>{css}</style>\n'
            f'{symbols}\n<main>\n' + '\n'.join(slides) + f'\n</main>\n{counter}\n<script>{js}</script>\n')

standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
              + fragment.split('<style>')[0] + '<style>' + fragment.split('<style>', 1)[1].split('</style>', 1)[0] + '</style>\n'
              '</head>\n<body>\n' + fragment.split('</style>\n', 1)[1] + '</body>\n</html>\n')

BAN = [r'\bzara\b', r'inditex', r'target ?style', r'@targetstyle', r'add to (cart|bag|pilot)', r'every look has an address',
       r'#f63901', r'#f53b00', r'#ff5a1f', r'\{\{', r'\bTODO\b', r'\bTK\b', r'lorem', r'\bborrow', r'seen at westside',
       r'unlock', r'elevate', r'seamless', r'game[- ]chang', r'leverag', r'synerg', r'holistic', r'delve', r'tapestry',
       r'in today.s', r'\[\[', r'ever-evolving', r'cutting-edge', r'not just .{0,40}, but']
text = re.sub(r'<[^>]+>', ' ', fragment.split('</style>', 1)[1])
hits = [(b, m.group(0)) for b in BAN for m in re.finditer(b, text, re.I)]
hits += [('orange in css', m.group(0)) for m in re.finditer(r'#(f6|f5|ff)[3-6][0-9a-f]{3}\b', css, re.I)]
if hits:
    print('BANNED:', hits[:20])
    if os.environ.get('STRICT'):
        sys.exit(1)

# the claude.ai artifact carries only the H.264 files (its upload limits), so it drops the AV1 sources
artifact = re.sub(r'<source src="media/[\w.-]+\.av1\.mp4"[^>]*>', '', fragment)
(DIST / 'westside-proposal.html').write_text(artifact)
(DIST / 'index.html').write_text(standalone)
print(f'{n} slides · fragment {len(fragment) / 1024:.0f} KB · standalone {len(standalone) / 1024:.0f} KB')
