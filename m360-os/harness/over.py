import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run
JS = """() => {
  const out = [], W = document.documentElement.clientWidth;
  const scrollable = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      out.push(['SCROLLS ' + el.tagName + '.' + (el.className||'').toString().slice(0,40), el.clientWidth, el.scrollWidth,
                'in:' + (el.parentElement ? el.parentElement.tagName + '.' + (el.parentElement.className||'').toString().slice(0,26) : ''),
                (el.textContent||'').trim().slice(0,30)]);
    }
    const r = el.getBoundingClientRect();
    if (r.right > W + 0.5 && !scrollable(el)) {
      const p = el.parentElement;
      out.push([el.tagName + '.' + (el.className||'').toString().slice(0,40), Math.round(r.left), Math.round(r.right),
                'in:' + (p ? p.tagName + '.' + (p.className||'').toString().slice(0,26) : ''),
                (el.textContent||'').trim().slice(0,30)]);
    }
  }
  return out.slice(0, 20);
}"""
def t(h):
    res = {}
    for hsh in ('#command',):
        page = h.open('founder', width=390, hash=hsh, reset=(hsh=='#command'), seed=True)
        page.wait_for_timeout(500)
        res[hsh] = (h.overflow(page), page.evaluate(JS))
    return res
r = run(t)
for k, (ov, items) in r.items():
    print('==', k, 'overflow', ov)
    for i in items: print('   ', i)
