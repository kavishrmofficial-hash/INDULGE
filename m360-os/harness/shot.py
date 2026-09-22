"""Screenshots of the key screens with a seeded workspace (dev aid)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run
from harness.qa import seed
SHOTS = [('m1', '#home', 1280, 'home-member'), ('founder', '#hq', 1280, 'hq'), ('m1', '#work', 1280, 'work'),
         ('m3', '#home', 390, 'home-phone-tapin'), ('m1', '#vibe', 1280, 'vibe'), ('m1', '#me', 1280, 'me'),
         ('founder', '#accounts', 1280, 'accounts'), ('m1', '#home', 390, 'home-phone')]
def t(h):
    page = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, page)
    for ident, hsh, w, name in (SHOTS if len(sys.argv) < 2 else [x for x in SHOTS if x[3] in sys.argv[1:]]):
        h.go(page, ident, hash=hsh, width=w, seed=True, online='u_m2')
        page.wait_for_timeout(700)
        h.shot(page, 'v2-' + name)
    return 'ok'
print(run(t))
