"""Builds the website copy of the proposal into a folder: python3 pitches/birla-fertility/web.py <out> [base-url].

The page is the standalone proposal (dist/index.html) plus an icon, a link-preview image and a no-index rule, so the
proposal opens from a link but stays out of search results."""
import sys, shutil, pathlib
HERE = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(sys.argv[1]); base = sys.argv[2].rstrip('/') if len(sys.argv) > 2 else ''
out.mkdir(parents=True, exist_ok=True)
for f in (HERE / 'web').iterdir():
    shutil.copy2(f, out / f.name)
t = (HERE / 'dist' / 'index.html').read_text()
title = 'Birla Fertility & IVF × Mask360'
desc = ('Mask360’s social media proposal to Birla Fertility &amp; IVF: No question too quiet. The content as a mind map, '
        'the grid, a month on the feed and three campaigns.')
img = (base + '/og.jpg') if base else 'og.jpg'
head = f'''<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="favicon.png" type="image/png">
<meta property="og:type" content="website">
<meta property="og:title" content="{title.replace('&', '&amp;')}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1E2F7A">
'''
assert t.count(f'<title>{title}</title>') == 1
(out / 'index.html').write_text(t.replace(f'<title>{title}</title>', f'<title>{title}</title>\n' + head))
print('site ready in', out)
