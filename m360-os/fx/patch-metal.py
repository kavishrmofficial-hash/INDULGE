#!/usr/bin/env python3
"""One fix to metal-fx 2.0.11, applied by build.sh before bundling; everything else is as the package ships.

When a metal control changes size, the glow is rebuilt along the new outline. The library clamps the
glow's current point to the new outline but copies the index of its next resting point as it was, so a
shorter outline leaves that index past the end and every frame throws "Cannot read properties of
undefined (reading 'x')". This clamps the next point the same way. Idempotent."""
import os

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'node_modules/metal-fx/dist/index.es.js')
s = open(p, encoding='utf-8').read()
old = 'e.relocNextIdx = t.relocNextIdx,'
new = 'e.relocNextIdx = t.relocNextIdx >= 0 ? Math.min(t.relocNextIdx, Math.max(0, e.perim.length - 1)) : t.relocNextIdx,'
if new not in s:
    assert s.count(old) == 1, 'metal-fx: the relocNextIdx line moved; check this patch against the new version'
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('metal-fx: next resting point clamped')
