"""Builds the website copy of the proposal into a folder: python3 pitches/westside/web.py <out> [base-url].

The page is the v4 standalone deck (dist/index.html) plus its reference videos (media/out → media/),
an icon, a link-preview image and a no-index rule, so the proposal opens from a link but stays out of search results."""
import re, sys, shutil, pathlib
HERE = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(sys.argv[1]); base = sys.argv[2].rstrip('/') if len(sys.argv) > 2 else ''
out.mkdir(parents=True, exist_ok=True)
for f in (HERE / 'web').iterdir():
    shutil.copy2(f, out / f.name)
t = (HERE / 'dist' / 'index.html').read_text()
media = HERE / 'media' / 'out'
used = sorted(set(re.findall(r'media/([\w.-]+\.(?:mp4|webp))', t)))  # only the clips and posters the page uses
if used:
    (out / 'media').mkdir(exist_ok=True)
    for name in used:
        shutil.copy2(media / name, out / 'media' / name)
title = 'Westside × Mask360'
desc = 'Mask360’s proposal to Westside: styling as the content engine, the Westside coffee cart and story windows across the store network, measured at the billing counter.'
img = (base + '/og.jpg') if base else 'og.jpg'
head = f'''<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fafaf8">
'''
assert t.count(f'<title>{title}</title>') == 1
(out / 'index.html').write_text(t.replace(f'<title>{title}</title>', f'<title>{title}</title>\n' + head))
print('site ready in', out)
