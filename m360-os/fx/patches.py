#!/usr/bin/env python3
"""The few fixes m360 makes to the effect packages, applied by build.sh before bundling; everything else
is as the packages ship. Each patch states what it fixes, checks its anchor and is idempotent: on an
upgrade that moves an anchor, the build stops so the patch can be checked against the new version.

1. metal-fx 2.0.11. When a metal control changes size, the glow is rebuilt along the new outline. The
   library clamps the glow's current point to the new outline but copies the index of its next resting
   point as it was, so a shorter outline leaves that index past the end and every frame throws "Cannot
   read properties of undefined (reading 'x')". The next point is clamped the same way.
2. thinking-orbs 0.3.2. The orb draws at its preset size (20, 32 or 64 CSS px) and at most twice the
   screen's pixel density, so an orb shown larger (the phone's orb screen) or on a 3x phone is a soft,
   upscaled picture. It now draws at the size it is shown, up to 3x density, with the preset's own look.
3. bot-avatars 0.2.1. The same density cap of 2: raised to 3, so the bots are sharp on 3x phones.
4. voice-glow 0.2.1. The same density cap of 2 on the beam's canvas: raised to 3, so the voice beam
   along the phone's orb screen is drawn at the screen's own density.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PATCHES = [
    ('node_modules/metal-fx/dist/index.es.js', 1,
     'e.relocNextIdx = t.relocNextIdx,',
     'e.relocNextIdx = t.relocNextIdx >= 0 ? Math.min(t.relocNextIdx, Math.max(0, e.perim.length - 1)) : t.relocNextIdx,'),
    ('node_modules/thinking-orbs/dist/index.es.js', 1,
     'const dpr = Math.min(2, typeof devicePixelRatio !== "undefined" && devicePixelRatio || 1);',
     'const shown = canvas.getBoundingClientRect().width, zoom = shown > size * 1.05 ? Math.min(6, shown / size) : 1;\n'
     '    const dpr = Math.min(3, typeof devicePixelRatio !== "undefined" && devicePixelRatio || 1) * zoom;'),
    ('node_modules/bot-avatars/dist/index.es.js', 3,
     'Math.min(2, typeof devicePixelRatio == "number" && devicePixelRatio || 1)',
     'Math.min(3, typeof devicePixelRatio == "number" && devicePixelRatio || 1)'),
    ('node_modules/voice-glow/dist/index.es.js', 1,
     'Math.min(ln, typeof window < "u" && window.devicePixelRatio || 1)',
     'Math.min(3, typeof window < "u" && window.devicePixelRatio || 1)'),
]

for rel, count, old, new in PATCHES:
    p = os.path.join(HERE, rel)
    s = open(p, encoding='utf-8').read()
    if new in s and old not in s:
        continue
    assert s.count(old) == count, '%s: the patched line moved (%d found, %d expected); check this patch against the new version' % (rel, s.count(old), count)
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('patched', rel.split('/')[1])
