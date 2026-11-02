"""Design lint: walks every page as the founder, in light and dark, at 1440, 1024, 768 and 390, with long real
content seeded, and lists the layout mistakes a person sees at a glance:

  spill   something sticks out past the card, column, pill or button it sits in
  cut     text clipped by its own box with no ellipsis
  page    the page scrolls sideways

Run from m360-os/:  ../.venv/bin/python harness/design_lint.py [route ...]
Writes harness/out/lint/report.json and a screenshot of every page that has a finding.
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness.sim.office_env import Office

OUT = os.path.join(os.path.dirname(__file__), 'out', 'lint')
os.makedirs(OUT, exist_ok=True)

ROUTES = sys.argv[1:] or ['hq', 'home', 'tasks', 'projects', 'calendar', 'reviews', 'week', 'talks', 'pitches', 'clients',
                          'prospects', 'crm', 'feed', 'people', 'voice', 'scores', 'music', 'play', 'admin', 'books', 'invoices',
                          'expenses', 'payroll', 'statement', 'letters', 'chat', 'me', 'notes', 'leave', 'radar', 'base', 'hiring',
                          'handbook', 'mail', 'search', 'office']
WIDTHS = [(1440, 900), (1024, 800), (768, 1024), (390, 844)]

LINT = r'''() => {
  const vw = document.documentElement.clientWidth, out = [];
  const CARD = '.card, .tcard, .colm, .c-card, .c-nc, .kp, .pill, .btn, .listrow, .drawer, .fold, .tile, .chip, .seg';
  const clips = cs => /hidden|clip|auto|scroll/.test(cs.overflowX);
  const sig = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '')
    + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"');
  const seen = new Set();
  for (const e of document.querySelectorAll('#root *')) {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(e);
    if (cs.position === 'fixed' || cs.visibility === 'hidden' || +cs.opacity === 0 || e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    const card = e.parentElement && e.parentElement.closest(CARD);
    if (card) {
      const c = card.getBoundingClientRect();
      const over = Math.max(r.right - c.right, c.left - r.left);
      if (over > 2) {
        let a = e.parentElement, clipped = clips(getComputedStyle(card));
        while (!clipped && a && a !== card) { if (clips(getComputedStyle(a))) clipped = true; a = a.parentElement; }
        const k = 'spill|' + sig(card);
        if (!clipped && !seen.has(k)) { seen.add(k); out.push({kind: 'spill', el: sig(e), in: sig(card), px: Math.round(over)}); }
      }
    }
    if (e.children.length === 0 && (e.textContent || '').trim() && clips(cs) && !/auto|scroll/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2) {
      out.push({kind: 'cut', el: sig(e), px: e.scrollWidth - e.clientWidth});
    }
  }
  const sx = document.documentElement.scrollWidth - vw;
  if (sx > 0) out.push({kind: 'page', px: sx});
  return out;
}'''

LONG = 'Westside, Apparel and Fashion, a long brand name'


def seed(pg):
    pg.evaluate('''() => {
      const c = M.lastCtx, W = c.W, now = Date.now(), ids = [];
      const rows = [['Westside, Apparel and Fashion India', 'Social Media + Experiential + Digital retainer', 'lead'],
        ['Pip by Arete Group Hospitality', 'Awaiting on project scope and the second round', 'negotiation'],
        ['The Park Hotels', 'Social retainer, 3 months', 'negotiation'], ['Birla Fertility and IVF', 'Pitch deck and film', 'proposal'],
        ['Tank Tailor', 'Shoot', 'won']];
      const fin = {};
      rows.forEach(([brand, next, stage], i) => { const id = 'lint' + i; ids.push(id);
        W.set('pitches/' + id, {brand, category: '', contact: 'Meera Kapoor', source: '', owner: c.uid, stage, stageAt: now, next, nextDate: '', project: '', lost: '', created: now, updated: now});
        fin[id] = {value: [2800000, 5200000, 450000, 1250000, 90000][i]}; });
      const long = ['Final cut of the Diwali hero film with Hindi and English supers for every platform', 'Recce for the Park Hotels shoot',
        'Westside winter launch: thirty two reels, twelve statics and the influencer kit, signed off by brand'];
      long.forEach((title, i) => W.set('tasks/lint' + i, {title, owner: c.uid, client: 'lintc0', project: '', section: '', due: '', status: ['todo', 'doing', 'review'][i] || 'todo',
        priority: 'high', link: '', revisions: 0, shown20: false, subtasks: {}, comments: {}, by: c.uid, created: now, updated: now, doneAt: null}));
      ['Birla Fertility and IVF, Mumbai and Delhi NCR clinics', 'Pip by Arete Group Hospitality and Residences'].forEach((name, i) =>
        W.set('clients/lintc' + i, {name, status: 'live', pod: '', owner: c.uid, memory: '', approvals: '', never: '', links: '', updated: now, by: c.uid}));
      fin.x = 0;
      return W.merge('data/users/' + c.uid + '/finance', {pitch: fin, clients: {lintc0: {monthly: 1850000}, lintc1: {monthly: 640000}}});
    }''')


report = []
with Office(users=10, warm=20) as o:
    for theme in ('light', 'dark'):
        for w, h in WIDTHS:
            pg = o.page('founder', width=w, height=h)
            pg.set_default_timeout(20000)
            pg.evaluate('t => { localStorage.setItem("m360.theme", t); }', theme)
            pg.goto(o.base + '#hq'); pg.reload(); pg.wait_for_timeout(1500)   # the theme is read as the page loads
            if theme == 'light' and w == 1440:
                seed(pg); pg.wait_for_timeout(1500)
            for r in ROUTES:
                try:
                    pg.goto(o.base + '#' + r); pg.wait_for_timeout(1300)
                    found = pg.evaluate(LINT)
                except Exception as e:
                    found = [{'kind': 'error', 'el': str(e)[:160]}]
                o.problems(pg)
                if found:
                    shot = os.path.join(OUT, '%s_%s_%d.png' % (r, theme, w))
                    try: pg.screenshot(path=shot, full_page=True)
                    except Exception: shot = ''
                    report.append({'route': r, 'theme': theme, 'width': w, 'found': found, 'shot': shot})
                    print('%-10s %-5s %4d  %d finding(s)' % (r, theme, w, len(found)))
            pg.close()

json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
kinds = {}
for x in report:
    for f in x['found']:
        kinds[f['kind']] = kinds.get(f['kind'], 0) + 1
print('pages with findings: %d, by kind: %r' % (len(report), kinds))
