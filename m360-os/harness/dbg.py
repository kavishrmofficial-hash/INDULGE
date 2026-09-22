import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.lib import run
from harness.qa import seed
JS = """() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length === 0 && /Someone/.test(el.textContent)) {
      let path = [], p = el;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) path.push(p.tagName + '.' + (p.className||'').toString().slice(0,22));
      out.push(path.join(' < '));
    }
  }
  return out.slice(0, 8);
}"""
def t(h):
    page = h.session('founder', width=1280, hash='#today', reset=True, seed=True)
    seed(h, page)
    h.go(page, 'm1', hash='#today', width=1280, seed=True)
    page.wait_for_timeout(500)
    a = page.evaluate(JS)
    probe = page.evaluate('''async () => {
      const fd = M.lastCtx.coll.feed.map[M.lastCtx.founderUid];
      const ps = await M.userNs.profiles(['u_founder']);
      const span = [...document.querySelectorAll('.card.flame span')].map(e => e.textContent).slice(0,4);
      return {founderUid: M.lastCtx.founderUid, pinned: fd && fd.pinned,
              profileName: ps['u_founder'] && ps['u_founder'].name,
              cacheKeys: Object.keys(M.__prof.cache),
              cacheFounder: JSON.stringify(M.__prof.cache['u_founder'] || null).slice(0,90),
              subs: M.__prof.subs.size, spans: span,
              avatarSrc: (document.querySelector('.card.flame img.av')||{}).src ?
                         ((document.querySelector('.card.flame img.av').src.indexOf('KR') > 0) ? 'KR-initials' :
                          document.querySelector('.card.flame img.av').src.slice(0, 60)) : 'no avatar',
              log: (M.__log||[]).filter(x => x[1] === 'u_founder'),
              nameUids: [...document.querySelectorAll('.card.flame span[data-uid]')].map(e => [e.getAttribute('data-uid'), e.textContent]),
              postAuthor: (function(){ const fd = M.lastCtx.coll.feed.map[M.lastCtx.founderUid];
                 const k = fd.pinned; const c = k.indexOf(':');
                 return JSON.stringify({au: k.slice(0,c), pid: k.slice(c+1),
                   found: !!(fd.posts||[]).find(x => x && x.id === k.slice(c+1))}); })()};
    }''')
    return {'at_500ms': a, 'probe': probe}
print(run(t))
