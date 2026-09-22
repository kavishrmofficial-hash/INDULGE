import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run
from harness.qa import seed
def t(h):
    page = h.session('founder', width=1280, hash='#today', reset=True, seed=True)
    seed(h, page)
    for ident, hsh, name in (('founder','#command','command'), ('m1','#today','member-today'),
                             ('founder','#week','week'), ('founder','#people','people')):
        h.go(page, ident, hash=hsh, width=1280)
        page.wait_for_timeout(600)
        h.shot(page, 'v-' + name)
    return 'ok'
print(run(t))
