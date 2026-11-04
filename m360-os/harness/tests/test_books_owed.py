"""Books, what is owed (42-books owed): outstanding splits into rupees and dirhams, and the total in rupees adds
the dirhams at today's rate (Setup, default 26.02), whether or not the invoice carries its own rate.

- the overview: three tiles (in rupees, in dirhams, total in rupees) and the age table with the same three columns
- 43,500 AED owed at 26.02 is 11,31,870 rupees
- changing today's rate in Setup moves the total
- the invoices list, open filter: the same split
Writes harness/out/books_owed/ screenshots at 1440 and 390.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from harness.sim.office_env import Office

OUT = os.path.join(os.path.dirname(__file__), '..', 'out', 'books_owed')
os.makedirs(OUT, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


SEED = '''() => {
  const c = M.lastCtx, W = c.W, fy = M.books.fyOf(M.U.todayStr()), now = Date.now();
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return M.U.ymd(x); };
  const inv = (no, cur, amt, due, extra) => Object.assign({no, clientId: '', clientName: cur === 'AED' ? 'Swisse Wellness Middle East' : 'Titan Company',
    currency: cur, gst: 'none', gstRate: 0, lines: [{desc: 'Retainer', qty: 1, rate: amt}], payments: [], tds: 0, date: d(-40), due,
    status: 'sent', sentAt: now, fx: '', createdAt: now, updatedAt: now}, extra || {});
  return W.set('invoices/' + fy, {rows: {
    o1: inv('MM/1', 'INR', 100000, d(10)),
    o2: inv('MM/2', 'INR', 250000, d(-45), {payments: [{amount: 50000, at: now}]}),
    o3: inv('MM/3', 'AED', 43500, d(-12)),
    o4: inv('MM/4', 'AED', 10000, d(5), {fx: '22.5'})}, updated: now});
}'''

with Office(users=4, warm=4) as o:
    for w, h in ((1440, 900), (390, 844)):
        p = o.page('founder', width=w, height=h)
        p.goto(o.base + '#hq'); p.wait_for_selector('.app', timeout=20000)
        if w == 1440:
            p.evaluate(SEED)
        p.goto(o.base + '#books'); p.wait_for_selector('#books-owed', timeout=20000); p.wait_for_timeout(900)
        tiles = p.eval_on_selector_all('#books-owed .kp', 'es => es.map(e => e.innerText.replace(/\\s+/g, " "))')
        print(tiles)
        # rupees 1,00,000 + 2,00,000 open; dirhams 53,500; total 3,00,000 + 53,500 x 26.02 = 16,92,070
        check(len(tiles) == 3, '%d: three tiles' % w)
        check(any('IN RUPEES' in t.upper() and '3,00,000' in t and '2 open, India' in t for t in tiles), '%d: rupees tile' % w)
        check(any('IN DIRHAMS' in t.upper() and 'AED 53,500' in t and '2 open, UAE' in t for t in tiles), '%d: dirhams tile' % w)
        check(any('TOTAL IN RUPEES' in t.upper() and '16,92,070' in t and '26.02' in t for t in tiles), '%d: total at 26.02' % w)
        tot = p.inner_text('#books-aging tr.tot').replace('\n', ' ').replace('\t', ' ')
        check('3,00,000' in tot and '53,500' in tot and '16,92,070' in tot, '%d: the age table totals: %r' % (w, tot))
        # 43,500 AED alone, 11 to 30 days late, is 11,31,870
        first = p.inner_text('#books-aging tbody tr:first-child').replace('\n', ' ').replace('\t', ' ')
        check('43,500' in first and '11,31,870' in first, '%d: 43,500 AED is 11,31,870: %r' % (w, first))
        ov = p.evaluate('() => document.documentElement.scrollWidth - innerWidth')
        check(ov <= 0, '%d: no sideways scroll (%d)' % (w, ov))
        p.screenshot(path=os.path.join(OUT, 'overview_%d.png' % w), full_page=True)
        o.problems(p)
        p.close()

    p = o.page('founder', width=1280, height=900)
    p.goto(o.base + '#books'); p.wait_for_selector('#books-owed', timeout=20000)
    p.evaluate('() => M.lastCtx.W.merge("books/settings", {fx: {AED: "27"}})')
    p.wait_for_function('() => /17,44,500/.test(document.getElementById("books-owed").innerText)', timeout=8000)
    check(True, 'today\'s rate of 27 moves the total to 17,44,500')
    p.goto(o.base + '#invoices'); p.wait_for_timeout(1200)
    p.evaluate('''() => { const b = [...document.querySelectorAll('#inv-list button, #inv-list [role=radio], #inv-list [role=tab]')].find(x => /^\\s*open/i.test(x.innerText)); if (b) b.click(); }''')
    p.wait_for_selector('#inv-outstanding', timeout=8000)
    t = p.inner_text('#inv-outstanding').replace('\n', ' ')
    check('53,500' in t and '3,00,000' in t and '17,44,500' in t, 'the invoices list splits it too: %r' % t)
    p.screenshot(path=os.path.join(OUT, 'invoices_open.png'), full_page=True)
    o.problems(p)
    p.close()

print('PASS' if not fails else 'FAIL %d' % len(fails))
sys.exit(1 if fails else 0)
