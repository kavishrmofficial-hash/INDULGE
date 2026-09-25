#!/usr/bin/env python3
"""Assemble the Atenx House members app.

  index.html          a standalone page: open it in any browser, or serve it as is
  dist/artifact.html  the same page without the document skeleton, for the claude.ai Artifact tool
"""
import os
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')

def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1'
         '&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap">')

def body():
    css = read('styles.css')
    js = read('data.js') + '\n' + read('app.js')
    return ('<title>Atenx House</title>\n' + FONTS + '\n<style>\n' + css + '\n</style>\n' + read('page.html')
            + '\n<script>\n' + js + '\n</script>\n')

def main():
    inner = body()
    for bad in ('—', '–'):
        if bad in inner:
            raise SystemExit('the page contains a dash the copy rules forbid: %r' % bad)
    standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                  '<meta name="color-scheme" content="light dark">\n'
                  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
                  'html{background:#FFFFFF}@media (prefers-color-scheme:dark){html{background:#0F0F10}}[hidden]{display:none!important}</style>\n'
                  '</head>\n<body>\n' + inner + '</body>\n</html>\n')
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(standalone)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    with open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf-8') as f:
        f.write(inner)
    print('index.html %d bytes, dist/artifact.html %d bytes' % (len(standalone.encode()), len(inner.encode())))

if __name__ == '__main__':
    main()
